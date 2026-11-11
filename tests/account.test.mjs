// The account in the page's words: the plan line, the trial's rules, "Keep it", the weekly switch. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePlan, planLine, planRows, trialOffered, trialStartedLine, parseTrial, longDay,
  parseKeep, keepLine, keepRow, alreadyKept, keepCard, KEEP_METHOD, metsText,
  weeklyNote, ONE_MONDAY_EMAIL, isSettingsSection, SETTINGS_SECTIONS,
} from "../src/my-health/account.ts";

const TODAY = new Date("2026-11-11T08:00:00Z");

test("the plan line says where Pro comes from, and reads Free when the server cannot say", () => {
  assert.equal(planLine(null, TODAY), "Free", "unknown reads as the page read before the server could answer");
  assert.equal(planLine(parsePlan({ error: "action must be start or checkin" }), TODAY), "Free", "an older function's 400 body is not a plan");
  assert.equal(planLine(parsePlan({ plan: "free", through: null, until: null, trial: { available: true, ends_at: null } }), TODAY), "Free");
  assert.equal(planLine(parsePlan({ plan: "pro", through: "app", until: null, trial: { available: false, ends_at: null } }), TODAY), "Pro · through the app");
  assert.equal(planLine(parsePlan({ plan: "pro", through: "vip", until: null, trial: { available: true, ends_at: null } }), TODAY), "Pro · on the VIP list");
  assert.equal(planLine(parsePlan({ plan: "pro", through: "trial", until: "2026-11-25T06:00:00Z", trial: { available: false, ends_at: "2026-11-25T06:00:00Z" } }), TODAY), "Pro · 14-day trial on the website, until 25 November");
  assert.equal(planLine(parsePlan({ plan: "pro", through: "web", until: "2027-01-01T00:00:00Z", trial: { available: false, ends_at: null } }), TODAY), "Pro · on the website");
  // a through on a free plan is ignored: the label never claims more than the plan
  assert.equal(parsePlan({ plan: "free", through: "app", trial: {} }).through, null);
  assert.equal(longDay("2027-01-03T00:00:00Z", TODAY), "3 January 2027", "another year is named");
});

test("a trial is offered, and so started, only on Free with the trial unspent", () => {
  const free = parsePlan({ plan: "free", through: null, until: null, trial: { available: true, ends_at: null } });
  const used = parsePlan({ plan: "free", through: null, until: null, trial: { available: false, ends_at: "2026-10-01T00:00:00Z" } });
  const vip = parsePlan({ plan: "pro", through: "vip", until: null, trial: { available: true, ends_at: null } });
  const app = parsePlan({ plan: "pro", through: "app", until: null, trial: { available: true, ends_at: null } });
  assert.equal(trialOffered(free), true);
  assert.equal(trialOffered(used), false);
  assert.equal(trialOffered(vip), false, "someone on the VIP list would spend their one trial for nothing");
  assert.equal(trialOffered(app), false, "an app subscriber is Pro already");
  assert.equal(trialOffered(null), false, "the server cannot say: nothing is started");
  assert.equal(trialStartedLine("2026-11-25T06:00:00Z", TODAY), "Pro on the website until 25 November. Nothing free is taken away when it ends.");
  assert.deepEqual(parseTrial({ started: false, reason: "used", status: "trialing", ends_at: "2026-11-20T00:00:00Z" }), { started: false, reason: "used", ends_at: "2026-11-20T00:00:00Z" });
  assert.equal(parseTrial({ message: "function not found" }), null);
});

test("the plan's rows say where it is managed, and that there are no receipts while no till is open", () => {
  const app = planRows(parsePlan({ plan: "pro", through: "app", until: null, trial: { available: false, ends_at: null } }), TODAY);
  assert.match(app.renews.note, /App Store or Google Play/);
  assert.match(app.payment.note, /No card is held here/);
  const trial = planRows(parsePlan({ plan: "pro", through: "trial", until: "2026-11-25T06:00:00Z", trial: { available: false, ends_at: null } }), TODAY);
  assert.equal(trial.renews.value, "Does not renew");
  assert.match(trial.renews.note, /^Pro on the website until 25 November\./);
  assert.match(trial.payment.note, /No card was asked for/);
  const free = planRows(null, TODAY);
  assert.match(free.payment.note, /not open for payment/);
  assert.match(free.receipts, /^None yet\./);
});

const KEEP = { test: "walk6", distance_m: 600, age: 45, sex: "male", weight_kg: 80, mets: 8, vo2: 28.1, tier: "Below average", on: "2026-11-11", weekly: false };

test("Keep it: the number is read only when it is one the page can file", () => {
  const k = parseKeep(JSON.stringify(KEEP));
  assert.equal(k.mets, 8); assert.equal(k.weekly, false);
  assert.equal(keepLine(k), "Sign in to keep your number: 8.0 METs.");
  assert.equal(metsText(9.25), "9.3");
  assert.equal(parseKeep(null), null);
  assert.equal(parseKeep("not json"), null);
  assert.equal(parseKeep(JSON.stringify({ ...KEEP, test: "bike" })), null, "a test the page does not know");
  assert.equal(parseKeep(JSON.stringify({ ...KEEP, mets: 40 })), null, "a number nobody has");
  assert.equal(parseKeep(JSON.stringify({ ...KEEP, on: "11/11/2026" })), null, "a date it cannot file under");
  assert.equal(parseKeep(JSON.stringify({ ...KEEP, weekly: "yes" })).weekly, false, "the weekly email is asked for only by a literal true");
  assert.equal(parseKeep(JSON.stringify({ ...KEEP, weekly: true })).weekly, true);
});

test("Keep it: the row carries the method exactly as the server reads it, and is written once", () => {
  const k = parseKeep(JSON.stringify(KEEP));
  const row = keepRow(k, { userId: "u1", personId: "p1" });
  assert.deepEqual(row, { user_id: "u1", person_id: "p1", measured_on: "2026-11-11", met_capacity: 8, vo2max: 28.1, method: "six-minute walk", source: "website" });
  assert.equal(KEEP_METHOD.run12, "twelve-minute run");
  assert.equal(alreadyKept(k, []), false);
  assert.equal(alreadyKept(k, [{ measured_on: "2026-11-11", method: "twelve-minute run" }]), false, "another test on the same day is another number");
  assert.equal(alreadyKept(k, [{ measured_on: "2026-11-11", method: "six-minute walk" }]), true);
});

test("Keep it: the card says only what happened", () => {
  const started = keepCard({ kept: true, mets: 8, trial: { started: true, ends_at: "2026-11-25T06:00:00Z" }, weekly: false }, TODAY);
  assert.equal(started.title, "14 days of Pro on the website. No card.");
  assert.equal(started.lines[0], "Your number is on your page: 8.0 METs.");
  assert.equal(started.lines.length, 3);
  assert.match(started.foot, /^Pro on the website until 25 November\./);
  assert.match(started.foot, /nothing free is taken away/);
  const withWeek = keepCard({ kept: true, mets: 8, trial: { started: true, ends_at: "2026-11-25T06:00:00Z" }, weekly: true }, TODAY);
  assert.equal(withWeek.lines.at(-1), "Your week arrives by email on Mondays.");
  // the trial was used before, or the server could not be asked: no trial is claimed
  for (const trial of [{ started: false, reason: "used", ends_at: null }, null]) {
    const plain = keepCard({ kept: true, mets: 8, trial, weekly: false }, TODAY);
    assert.equal(plain.title, "Your number is on your page.");
    assert.equal(plain.foot, null);
    assert.ok(!plain.lines.join(" ").includes("Pro"));
  }
  assert.equal(keepCard({ kept: false, mets: 8, trial: null, weekly: false }, TODAY), null, "nothing was kept: no card");
});

test("the weekly email's switch has three states, and the rule of one Monday email is said once", () => {
  assert.equal(weeklyNote({ state: "off", timezone: null }, TODAY), "Off unless you turn it on.");
  assert.equal(weeklyNote({ state: "unavailable", timezone: null }, TODAY), "Not switched on for this account yet.");
  assert.equal(weeklyNote({ state: "on", timezone: "Asia/Dubai", since: "2026-11-11T05:00:00Z" }, TODAY), "On since 11 November. Mondays, once the app has synced the week.");
  assert.equal(weeklyNote({ state: "on", timezone: null }, TODAY), "On. Mondays, once the app has synced the week.");
  assert.match(ONE_MONDAY_EMAIL, /one email on Monday/);
});

test("Settings has six sections and knows its own links", () => {
  assert.deepEqual(SETTINGS_SECTIONS.map(([k]) => k), ["profile", "plan", "email", "sharing", "data", "appearance"]);
  assert.equal(isSettingsSection("plan"), true);
  assert.equal(isSettingsSection("billing"), false);
});
