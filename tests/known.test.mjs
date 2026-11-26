// What the page keeps between visits about the signed-in account: the plan's line and whether it is a test account
// (src/my-health/known.ts). The page opens on these and asks again behind them. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accessFlags, accessOf, forget, recall, remember, waitingWords } from "../src/my-health/known.ts";
import { planLine } from "../src/my-health/account.ts";

const store = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, keys: () => [...m.keys()] };
};
const PRO = { plan: "pro", through: "vip", until: null, trial: { available: false, ends_at: null } };

test("whether the account's own person has a horizon to show is kept too, so the tab is drawn at once on the next visit", () => {
  const s = store();
  remember("u1", { tester: false, team: false }, s);
  remember("u1", { horizon: true }, s);
  assert.deepEqual(recall("u1", s), { tester: false, team: false, horizon: true });
  remember("u1", { horizon: false }, s);
  assert.equal(recall("u1", s).horizon, false, "the horizon was deleted: the tab is not drawn on a memory");
  assert.equal(recall("u1", store({ "mh-known-u1": JSON.stringify({ horizon: "yes" }) })).horizon, undefined, "anything but a yes or a no is nothing");
});

test("nothing kept reads as nothing known", () => {
  assert.deepEqual(recall("u1", store()), {});
  assert.deepEqual(recall("", store()), {}, "no account, nothing to recall");
  assert.deepEqual(recall("u1", null), {}, "no storage at all (a private window) is not an error");
});

test("an answer is kept for the next visit, and a second answer does not drop the first", () => {
  const s = store();
  remember("u1", { tester: true }, s);
  assert.deepEqual(recall("u1", s), { tester: true });
  remember("u1", { plan: PRO }, s);
  assert.deepEqual(recall("u1", s), { tester: true, plan: PRO });
  assert.equal(planLine(recall("u1", s).plan ?? null), "Pro · on the VIP list", "the line under the name can be drawn from it at once");
  remember("u1", { tester: false }, s);
  assert.deepEqual(recall("u1", s), { tester: false, plan: PRO }, "a later no replaces an earlier yes");
});

test("each account has its own, and signing out leaves nothing behind", () => {
  const s = store();
  remember("u1", { tester: true, plan: PRO }, s);
  assert.deepEqual(recall("u2", s), {}, "another account on the same browser knows nothing of it");
  forget("u1", s);
  assert.deepEqual(recall("u1", s), {});
  assert.deepEqual(s.keys(), []);
});

test("anything that is not the shape written reads as nothing", () => {
  assert.deepEqual(recall("u1", store({ "mh-known-u1": "not json" })), {});
  assert.deepEqual(recall("u1", store({ "mh-known-u1": "[1,2]" })), {});
  assert.deepEqual(recall("u1", store({ "mh-known-u1": JSON.stringify({ tester: "yes", plan: { plan: "gold" } }) })), {}, "a word is not a yes, and an unknown plan is not a plan");
  assert.deepEqual(recall("u1", store({ "mh-known-u1": JSON.stringify({ tester: true, plan: null }) })), { tester: true });
});

test("a store that refuses is not an error", () => {
  const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("denied"); } };
  assert.deepEqual(recall("u1", broken), {});
  assert.doesNotThrow(() => remember("u1", { tester: true }, broken));
  assert.doesNotThrow(() => forget("u1", broken));
});

test("while the question is open the page says so, and never 'nothing here'", () => {
  const nothing = "There is nothing on this page for this account.";
  assert.equal(waitingWords("asking", nothing), "Checking this account…");
  assert.match(waitingWords("failed", nothing), /^Could not check this account just now\./);
  assert.equal(waitingWords("known", nothing), nothing, "only an answer lets the page say there is nothing");
});

// The wiring, read from the source: the question is asked as the page starts, and its two pages wait for the answer.
const page = readFileSync(new URL("../src/pages/my-health.astro", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/my-health/horizon/api.ts", import.meta.url), "utf8");
const team = readFileSync(new URL("../src/my-health/views/TesterPanel.tsx", import.meta.url), "utf8");
const offer = readFileSync(new URL("../src/my-health/views/Offer.tsx", import.meta.url), "utf8");

test("the head start asks the two small questions beside the document", () => {
  const head = page.slice(page.indexOf("<script is:inline"), page.indexOf("</script>", page.indexOf("<script is:inline")));
  assert.match(head, /\/rest\/v1\/rpc\/my_health_document/);
  assert.match(head, /\/rest\/v1\/programme_testers\?select=user_id/);
  assert.match(head, /\/functions\/v1\/horizon/);
  assert.match(head, /action: "plan"/);
  assert.match(head, /user: uid/, "the bundle uses an early answer only for the account it was asked for");
});

test("boot opens on what is known and asks again; the Horizon view is no longer the only one who asks", () => {
  const boot = page.slice(page.indexOf("async function boot()"), page.indexOf("// Apple's and Google's doors"));
  assert.match(boot, /recall\(userId\)/);
  // one question with three answers since 25 November 2026 (a test account, a founding member, neither), kept as two flags
  assert.match(boot, /accessAnswer\(supabase as any, askedFor\)/);
  assert.match(boot, /const flags = accessFlags\(t\);/);
  assert.match(boot, /remember\(askedFor, flags\)/);
  assert.match(boot, /testerState\.value = "failed"/, "a question that cannot be asked ends in words, not in a page that waits for ever");
});

test("a failed ask is not kept as a no", () => {
  const fn = api.slice(api.indexOf("export function accessAnswer"), api.indexOf("export function forgetTester"));
  assert.match(fn, /return error \? null : data \? "team" : "none";/);
  assert.match(fn, /if \(a == null && accessAsk === mine\) accessAsk = null;/);
  // and the two questions asked of that answer pass a null on as a null
  assert.match(fn, /a == null \? null : accessFlags\(a\)\.tester/);
  assert.match(fn, /a == null \? null : accessFlags\(a\)\.team/);
});

test("the two pages a test account is shown wait for the answer before saying there is nothing", () => {
  assert.match(team, /waitingWords\(testerState\.value, "This page holds notes/);
  assert.match(offer, /waitingWords\(testerState\.value, "There is nothing on this page for this account\."\)/);
  assert.match(offer, /if \(body === undefined\)/, "nor while the row is being read");
});

test("signing out forgets what was kept", () => {
  assert.equal(page.split("forgetTester(); if (userId) forgetKnown(userId);").length - 1, 2, "the sign-out, and the deleted account");
});

test("the database's answer is one of three, and anything else is none", () => {
  assert.equal(accessOf("team"), "team");
  assert.equal(accessOf("founding"), "founding");
  for (const x of [null, undefined, "", "none", "Team", true, { access: "team" }, ["team"]]) assert.equal(accessOf(x), "none");
});

test("one answer, two flags: a founding member has the programme and nothing of the team's", () => {
  assert.deepEqual(accessFlags("team"), { tester: true, team: true });
  assert.deepEqual(accessFlags("founding"), { tester: true, team: false });
  assert.deepEqual(accessFlags("none"), { tester: false, team: false });
});

test("both flags are kept for the next visit, and a visit before there was a second flag reads as not the team's", () => {
  const s = store();
  remember("u1", accessFlags("founding"), s);
  assert.deepEqual(recall("u1", s), { tester: true, team: false });
  remember("u1", accessFlags("team"), s);
  assert.deepEqual(recall("u1", s), { tester: true, team: true });
  const old = store({ "mh-known-u2": JSON.stringify({ tester: true }) });
  assert.equal(recall("u2", old).team, undefined);          // the page then draws nothing of the team's until the database answers
  const bad = store({ "mh-known-u3": JSON.stringify({ tester: true, team: "yes" }) });
  assert.equal(recall("u3", bad).team, undefined);
});
