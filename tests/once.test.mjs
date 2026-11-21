// One question, one request (src/my-health/once.ts): callers that ask while an answer is on its way share it, and
// nothing is kept once it has arrived. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anew, fresh, shared } from "../src/my-health/once.ts";

/** An ask the test settles by hand, and a count of how many times it was started. */
function slow() {
  const calls = [];
  const ask = () => new Promise((resolve, reject) => { calls.push({ resolve, reject }); });
  return { ask, calls };
}

test("callers who ask while an answer is on its way share one ask", async () => {
  const going = new Map(), { ask, calls } = slow();
  const a = shared(going, "plan", ask), b = shared(going, "plan", ask), c = shared(going, "plan", ask);
  await Promise.resolve();
  assert.equal(calls.length, 1, "three callers, one request");
  calls[0].resolve("Pro");
  assert.deepEqual(await Promise.all([a, b, c]), ["Pro", "Pro", "Pro"]);
});

test("nothing is kept once it has arrived: the next caller asks again", async () => {
  const going = new Map(); let n = 0;
  const ask = async () => ++n;
  assert.equal(await shared(going, "plan", ask), 1);
  assert.equal(going.size, 0, "the slot is empty again");
  assert.equal(await shared(going, "plan", ask), 2, "so a write is never followed by an old answer");
});

test("each question has its own ask", async () => {
  const going = new Map(), a = slow(), b = slow();
  const pa = shared(going, "horizons:p1:all", a.ask), pb = shared(going, "horizons:p2:all", b.ask);
  await Promise.resolve();
  assert.equal(a.calls.length, 1); assert.equal(b.calls.length, 1);
  a.calls[0].resolve(["one"]); b.calls[0].resolve(["two"]);
  assert.deepEqual(await pa, ["one"]); assert.deepEqual(await pb, ["two"]);
});

test("a failure reaches the callers who were waiting, and nobody after them", async () => {
  const going = new Map(), { ask, calls } = slow();
  const a = shared(going, "plan", ask), b = shared(going, "plan", ask);
  await Promise.resolve();
  calls[0].reject(new Error("offline"));
  await assert.rejects(a, /offline/); await assert.rejects(b, /offline/);
  assert.equal(going.size, 0);
  assert.equal(await shared(going, "plan", async () => "back"), "back", "a failed ask is not kept as the answer");
});

test("an ask that throws at once is a rejection, not an exception in the caller", async () => {
  const going = new Map();
  const p = shared(going, "plan", () => { throw new Error("no session"); });
  await assert.rejects(p, /no session/);
  assert.equal(going.size, 0);
});

test("after a write, the ask never joins one that left before it; later callers share the new one", async () => {
  const going = new Map(), before = slow(), after = slow();
  const old = shared(going, "plan", before.ask);
  await Promise.resolve();
  const mine = anew(going, "plan", after.ask), later = shared(going, "plan", after.ask);
  await Promise.resolve();
  assert.equal(before.calls.length, 1); assert.equal(after.calls.length, 1, "the later caller joined the new ask");
  before.calls[0].resolve("Free"); after.calls[0].resolve("Pro, on a trial");
  assert.equal(await old, "Free");
  assert.equal(await mine, "Pro, on a trial"); assert.equal(await later, "Pro, on a trial");
  assert.equal(going.size, 0, "the old ask settling did not clear the new one's slot early, and nothing is left");
});

test("the old ask settling first does not empty the slot the new ask holds", async () => {
  const going = new Map(), before = slow(), after = slow();
  const old = shared(going, "plan", before.ask);
  await Promise.resolve();
  const mine = anew(going, "plan", after.ask);
  await Promise.resolve();
  before.calls[0].resolve("Free"); await old;
  assert.equal(going.size, 1, "a caller arriving now still joins the new ask");
  const joiner = shared(going, "plan", async () => "a third request");
  after.calls[0].resolve("Pro");
  assert.equal(await joiner, "Pro"); assert.equal(await mine, "Pro");
});

test("a kept answer is the answer for a few seconds, and no longer", () => {
  const kept = { at: 1_000_000, value: { plan: "pro" } };
  assert.deepEqual(fresh(kept, 10_000, 1_000_000 + 9_999), { plan: "pro" });
  assert.equal(fresh(kept, 10_000, 1_000_000 + 10_000), undefined, "at ten seconds it is asked again");
  assert.equal(fresh(kept, 10_000, 999_000), undefined, "a clock that went backwards keeps nothing");
  assert.equal(fresh(null, 10_000, 1_000_000), undefined);
});

// The wiring, read from the source: which questions are shared, and which asks must be new.
const api = readFileSync(new URL("../src/my-health/horizon/api.ts", import.meta.url), "utf8");
const account = readFileSync(new URL("../src/my-health/accountApi.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/my-health/views/Settings.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/my-health.astro", import.meta.url), "utf8");

test("the plan is asked through one door, by the line under the name and by Horizon alike", () => {
  assert.match(account, /const \{ ok, out \} = await planAnswer\(sb, again\);/);
  assert.doesNotMatch(account, /functions\/v1\/horizon/, "the account's call no longer makes a request of its own");
  const access = api.slice(api.indexOf("export async function fetchAccess"), api.indexOf("const ACCESS_KEY"));
  assert.match(access, /await planAnswer\(sb\)/);
  assert.equal(api.split('callHorizon(sb, { action: "plan" })').length - 1, 1, "one place sends the plan's question");
});

test("the first ask of a load is the head start's, for the account the browser is signed in as", () => {
  const fn = api.slice(api.indexOf("export function planAnswer"), api.indexOf("// ── reads ──"));
  assert.match(fn, /head\.user === storedUserId\(\)/);
  assert.match(fn, /head\.planTaken = true/);
  assert.match(fn, /return again \? anew\(going, "plan", ask\) : shared\(going, "plan", ask\);/);
});

test("the horizons and the two readiness questions are shared while they are out", () => {
  assert.match(api, /shared\(going, `horizons:\$\{personId\}:\$\{includeClosed \? "all" : "open"\}`/);
  assert.match(api, /shared\(going, "guide-ready"/);
  assert.match(api, /shared\(going, "watched-ready"/);
});

test("a write drops what was kept, and the asks that follow a write are new ones", () => {
  assert.match(api, /export function forgetAccess\(\) \{ lastPlan = null;/);
  assert.match(api, /if \(ok\) lastPlan = null;/, "a horizon being set");
  assert.equal(settings.split("await refreshPlan(true)").length - 1, 2, "before and after a trial is started");
  assert.equal(page.split("settingsView.refreshPlan(true)").length - 1, 2, "and when a number is kept from the landing page");
});
