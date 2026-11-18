// What goes with a horizon, for a test account (board 25 of "Verve, Horizon as a programme"): the arithmetic that
// picks among a row's sentences. The sentences themselves are a row in the database and are not in this repository.
// `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fullWeeksDone, onTheDate, weekDue, verdictOf, offerDates, isOfferBody, weekSheetSeen, markWeekSheetSeen } from "../src/my-health/horizon/offer.ts";
import { fill } from "../src/my-health/horizon/facts.ts";
import { SETTINGS_SECTIONS } from "../src/my-health/account.ts";

// set on a Monday, for thirteen weeks
const H = { starts_on: "2026-08-17", ends_on: "2026-11-16" };

test("full weeks behind: a week counts once its Sunday has passed", () => {
  assert.equal(fullWeeksDone(H, "2026-08-17"), 0);
  assert.equal(fullWeeksDone(H, "2026-08-23"), 0, "the first week's Sunday is still that week");
  assert.equal(fullWeeksDone(H, "2026-08-24"), 1);
  assert.equal(fullWeeksDone(H, "2026-09-28"), 6);
});

test("a horizon set midweek: the short first week is not one of the six", () => {
  const mid = { starts_on: "2026-08-19", ends_on: "2026-11-18" };
  assert.equal(fullWeeksDone(mid, "2026-09-28"), 5);
  assert.equal(fullWeeksDone(mid, "2026-10-05"), 6);
});

test("a paused week is not one of the weeks behind", () => {
  const paused = { ...H, ends_on: "2026-11-23", pauses: ["2026-08-31"] };
  assert.equal(fullWeeksDone(paused, "2026-09-28"), 5);
  assert.equal(fullWeeksDone(paused, "2026-10-05"), 6);
});

test("the week's sheet is due once that many full weeks are behind, and never on or after the date", () => {
  assert.equal(weekDue(H, "2026-09-27", 6), false);
  assert.equal(weekDue(H, "2026-09-28", 6), true);
  assert.equal(weekDue(H, "2026-11-15", 6), true);
  assert.equal(weekDue(H, "2026-11-16", 6), false, "the date has come: the date's own block speaks");
  assert.equal(weekDue(H, "2026-09-28", undefined), false, "a row with no week part asks for nothing");
  assert.equal(weekDue(H, "2026-09-28", 0), false);
});

test("the date has come on the day itself", () => {
  assert.equal(onTheDate(H, "2026-11-15"), false);
  assert.equal(onTheDate(H, "2026-11-16"), true);
  assert.equal(onTheDate(H, "2027-01-01"), true);
});

test("the verdict: every target, or the plan's weeks; nothing judged gives none", () => {
  assert.equal(verdictOf({}, { calls: false }), null);
  assert.equal(verdictOf({ targets_ok: null, plan_ok: null }, { calls: false }), null);
  assert.equal(verdictOf({ targets_ok: true, plan_ok: null }, { calls: false }), "reached");
  assert.equal(verdictOf({ targets_ok: false, plan_ok: true }, { calls: false }), "reached", "the second way");
  assert.equal(verdictOf({ targets_ok: false, plan_ok: false }, { calls: false }), "not");
  assert.equal(verdictOf({ targets_ok: false, plan_ok: null }, { calls: false }), "not");
});

test("a coach's calls count only where a coach is part of the horizon", () => {
  const facts = { targets_ok: true, plan_ok: null, calls_ok: false };
  assert.equal(verdictOf(facts, { calls: false }), "reached");
  assert.equal(verdictOf(facts, { calls: true }), "not");
  assert.equal(verdictOf({ ...facts, calls_ok: true }, { calls: true }), "reached");
  assert.equal(verdictOf({ ...facts, calls_ok: null }, { calls: true }), "reached", "no week has ended, so no call was missed");
});

test("the dates a sentence may name, and the months a row gives", () => {
  const d = offerDates(H, "2026-09-28", 3);
  assert.equal(d.starts, "17 August");
  assert.equal(d.ends, "16 November");
  assert.equal(d.free_to, "17 November");
  assert.equal(d.weeks_done, 6);
  assert.equal(offerDates(H, "2026-09-28", undefined).free_to, null, "a row that gives no months names no such day");
  assert.equal(fill("Running to {free_to}.", d), "Running to 17 November.");
});

test("a pause moves that day by a week, as it moves the date", () => {
  const paused = { ...H, ends_on: "2026-11-23", pauses: ["2026-08-31"] };
  assert.equal(offerDates(paused, "2026-09-28", 3).free_to, "24 November");
});

test("a month's end is kept in the month it falls in", () => {
  assert.equal(offerDates({ starts_on: "2026-11-30", ends_on: "2027-05-30" }, "2026-11-30", 3).free_to, "28 February");
});

test("a row is an object, or it is nothing", () => {
  assert.equal(isOfferBody({ setup: {} }), true);
  assert.equal(isOfferBody(null), false);
  assert.equal(isOfferBody("words"), false);
  assert.equal(isOfferBody([]), false);
});

test("the sheet is shown once on a browser, and a browser that keeps nothing shows it again", () => {
  const was = globalThis.localStorage;
  try {
    delete globalThis.localStorage;
    assert.equal(weekSheetSeen("h1"), false);
    markWeekSheetSeen("h1");
    assert.equal(weekSheetSeen("h1"), false, "nothing to keep it in");
    const kept = new Map();
    globalThis.localStorage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); } };
    assert.equal(weekSheetSeen("h1"), false);
    markWeekSheetSeen("h1");
    assert.equal(weekSheetSeen("h1"), true);
    assert.equal(weekSheetSeen("h2"), false, "each horizon has its own");
  } finally { if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was; }
});

test("Settings has a place for it, before our own notes", () => {
  const keys = SETTINGS_SECTIONS.map(([k]) => k);
  assert.ok(keys.includes("offer"));
  assert.ok(keys.indexOf("offer") < keys.indexOf("team"));
});

test("no amount, and none of the row's sentences, is in the code that draws it", () => {
  for (const f of ["src/my-health/horizon/offer.ts", "src/my-health/views/Offer.tsx"]) {
    const code = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    assert.equal(/[$€£₹]\s?\d/.test(code), false, `${f} holds an amount`);
    assert.equal(/\bfree\b|\bcredit\b|\bredeem\b|\bearn\b|\bdiscount\b/i.test(code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/free_to|freeTo/g, "")), false, `${f} holds a word of the row`);
  }
});
