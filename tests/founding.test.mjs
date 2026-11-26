// A founding member's twelve weeks and the week after them (26 November 2026; src/my-health/horizon/founding.ts).
// The founder: 12 weeks free, then one more week of continuity. The list holds one last day (the day a member is
// added plus 91); the day the 12 free weeks ended is that day less seven. The page, Settings and Monday's email
// say one sentence in that last week, from this one file. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTINUITY_DAYS, FOUNDING_DAYS, FOUNDING_FREE_WEEKS, continuityLine, foundingContinuity, shiftDay, writtenDay } from "../src/my-health/horizon/founding.ts";
import { planLine } from "../src/my-health/account.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
// added on 26 November 2026: the last day is 91 days on
const ADDED = "2026-11-26";
const UNTIL = shiftDay(ADDED, FOUNDING_DAYS);
const member = (today, until = UNTIL) => ({ through: "founding", until, today });

test("the last day is 12 weeks and one week from the day a member is added", () => {
  assert.equal(FOUNDING_FREE_WEEKS, 12); assert.equal(CONTINUITY_DAYS, 7); assert.equal(FOUNDING_DAYS, 91);
  assert.equal(UNTIL, "2027-02-25");
  assert.equal(shiftDay(UNTIL, -CONTINUITY_DAYS), "2027-02-18", "the 12 free weeks end 84 days after the day they began");
  assert.equal(shiftDay("2027-03-01", -1), "2027-02-28"); assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

test("nothing is said through the 12 weeks, on their last day included", () => {
  for (const today of [ADDED, "2026-12-25", "2027-02-10", "2027-02-17", "2027-02-18"]) {
    assert.equal(foundingContinuity(member(today)), null, today);
    assert.equal(continuityLine(member(today)), null, today);
  }
});

test("the week of continuity: seven days, each reading the same sentence with the same two dates", () => {
  const days = [];
  for (let n = -30; n <= 10; n++) { const today = shiftDay(UNTIL, n); if (foundingContinuity(member(today))) days.push(today); }
  assert.deepEqual(days, ["2027-02-19", "2027-02-20", "2027-02-21", "2027-02-22", "2027-02-23", "2027-02-24", "2027-02-25"]);
  for (const today of days) {
    assert.deepEqual(foundingContinuity(member(today)), { endedOn: "2027-02-18", until: "2027-02-25" });
    assert.equal(continuityLine(member(today)), "Your 12 free weeks ended on 18 February. You keep everything until 25 February.");
  }
});

test("after the last day nothing is said: the account is no longer a founding member's", () => {
  assert.equal(continuityLine(member("2027-02-26")), null);
  assert.equal(continuityLine(member("2027-06-01")), null);
});

test("it is a founding member's sentence and nobody else's", () => {
  const today = "2027-02-22";
  for (const through of ["vip", "trial", "web", "app", null, undefined, ""]) assert.equal(continuityLine({ through, until: UNTIL, today }), null, String(through));
  assert.equal(continuityLine({ through: "founding", until: null, today }), null, "no last day, nothing to say");
  assert.equal(continuityLine({ through: "founding", until: "soon", today }), null);
  assert.equal(continuityLine({ through: "founding", until: UNTIL, today: "today" }), null);
});

test("the last day arrives as a day or as a moment on that day, and reads the same", () => {
  const today = "2027-02-20";
  const line = continuityLine(member(today));
  assert.equal(continuityLine(member(today, `${UNTIL}T12:00:00Z`)), line, "the horizon function's plan answer: noon on the day");
  assert.equal(continuityLine(member(today, `${UNTIL}T12:00:00.000+00:00`)), line);
});

test("a date carries its year only when it is not today's, as the plan line beside it does", () => {
  assert.equal(writtenDay("2027-02-18", "2027-02-20"), "18 February");
  assert.equal(writtenDay("2027-01-04", "2026-12-30"), "4 January 2027");
  // a week that crosses the new year
  assert.equal(continuityLine(member("2026-12-30", "2027-01-04")), "Your 12 free weeks ended on 28 December. You keep everything until 4 January 2027.");
  assert.equal(continuityLine(member("2027-01-02", "2027-01-04")), "Your 12 free weeks ended on 28 December 2026. You keep everything until 4 January.");
  // the same day, beside it: "Pro · founding member, until 25 February"
  assert.equal(planLine({ plan: "pro", through: "founding", until: `${UNTIL}T12:00:00Z`, trial: { available: false, ends_at: null } }, new Date("2027-02-20T09:00:00Z")), "Pro · founding member, until 25 February");
});

test("the sentence promises nothing beyond the last day: no price, no subscription, no button's words", () => {
  const line = continuityLine(member("2027-02-22"));
  assert.doesNotMatch(line, /subscri|price|[$€£₹]|pay|renew|upgrade|\bmet\b/i);
  // the file reads no clock and no zone of its own
  const src = read("../src/my-health/horizon/founding.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /Date\.now\(|new Date\(\)|localStorage|window\.|document\./);
});

test("the page says it in the two places the founder named, from this file", () => {
  const settings = read("../src/my-health/views/Settings.tsx"), horizon = read("../src/my-health/views/Horizon.tsx");
  assert.match(settings, /const lastWeek = continuityLine\(\{ through: info\?\.through, until: info\?\.until, today: todayStr\(\) \}\);/);
  assert.match(settings, /<Row first label="Plan" value=\{planLine\(info\)\} note=\{lastWeek \?\? undefined\} \/>/, "beside the plan line");
  assert.match(horizon, /const lastWeek = owner \? continuityLine\(\{ through: planNow\?\.through, until: planNow\?\.until, today \}\) : null;/, "a coach reading a client's horizon is not told about the client's plan");
  assert.match(horizon, /\{lastWeek && <p [^>]*data-continuity>\{lastWeek\}<\/p>\}/);
  // nowhere does the page write the sentence itself
  for (const src of [settings, horizon]) assert.doesNotMatch(src, /free weeks ended/);
});
