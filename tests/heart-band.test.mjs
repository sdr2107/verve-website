// The person's zone 2 in beats, as the page works it out: a copy of the app's rule. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn, heartBandOf, heartOf, beatsWords, heartSource, EFFORT_WHERE, DEFAULT_RESTING_HR } from "../src/my-health/horizon/heartBand.ts";

// Every figure here is invented. The expected bands are what the app's own function gives for the same answers
// (METTracker lib/zone2.ts calculateZone2Range: resting + 40% and + 60% of (round(208 - 0.7 x age) - resting), each rounded).
const TODAY = "2026-11-27";

test("the band is the app's: Karvonen's reserve over Tanaka's maximum, from the profile's own answers", () => {
  assert.deepEqual(heartBandOf({ age: 44, resting_hr: 62 }, TODAY), { low: 108, high: 131, source: "estimated", max: 177, rest: 62, restAssumed: false });
  assert.deepEqual(heartBandOf({ age: 30, resting_hr: 50 }, TODAY), { low: 105, high: 132, source: "estimated", max: 187, rest: 50, restAssumed: false });
  assert.deepEqual(heartBandOf({ age: 67, resting_hr: 71 }, TODAY), { low: 107, high: 125, source: "estimated", max: 161, rest: 71, restAssumed: false });
  // the figures arrive from the database as numbers or as text
  assert.deepEqual(heartBandOf({ age: "44", resting_hr: "62" }, TODAY), heartBandOf({ age: 44, resting_hr: 62 }, TODAY));
});

test("no resting rate on the profile: 60 is used, as the app does, and the band says it was assumed", () => {
  for (const resting_hr of [null, undefined, 0, 30, 140, 200]) {
    const b = heartBandOf({ age: 44, resting_hr }, TODAY);
    assert.deepEqual([b.rest, b.restAssumed, b.low, b.high], [DEFAULT_RESTING_HR, true, 107, 130], String(resting_hr));
  }
  // 31 and 139 are measured values and are used
  assert.equal(heartBandOf({ age: 44, resting_hr: 139 }, TODAY).restAssumed, false);
  assert.equal(heartBandOf({ age: 44, resting_hr: 31 }, TODAY).rest, 31);
});

test("a tested band replaces the estimate when it is sane, and only then", () => {
  assert.deepEqual(heartBandOf({ age: 44, resting_hr: 62, zone2_low_hr: 118, zone2_high_hr: 136 }, TODAY), { low: 118, high: 136, source: "tested", max: null, rest: null, restAssumed: false });
  // a tested band needs no age
  assert.equal(heartBandOf({ zone2_low_hr: 118, zone2_high_hr: 136 }, TODAY).source, "tested");
  for (const [lo, hi] of [[30, 120], [130, 120], [120, 120], [120, 230], [120, null], [null, 140]])
    assert.equal(heartBandOf({ age: 44, resting_hr: 62, zone2_low_hr: lo, zone2_high_hr: hi }, TODAY).source, "estimated", `${lo} to ${hi}`);
});

test("the age is the app's: counted from the date of birth when the profile holds one, on the day itself", () => {
  assert.equal(ageOn("1982-11-28", "2026-11-27"), 43);
  assert.equal(ageOn("1982-11-27", "2026-11-27"), 44, "the birthday moves the age on the day");
  assert.equal(ageOn("1982-02-29", "2026-02-28"), 43);
  for (const bad of [null, undefined, "", "1982", "1982-13-01", "1982-00-10", "not a date"]) assert.equal(ageOn(bad, TODAY), null, String(bad));
  // the date of birth wins over a stored age that has gone stale
  assert.equal(heartBandOf({ age: 43, date_of_birth: "1982-11-27", resting_hr: 62 }, TODAY).max, 177);
  assert.equal(heartBandOf({ age: 43, date_of_birth: "1982-11-28", resting_hr: 62 }, TODAY).max, 178);
});

test("no age, no range: the page never prints a band from an age nobody gave", () => {
  assert.equal(heartBandOf({ resting_hr: 62 }, TODAY), null);
  assert.equal(heartBandOf({ age: 0, resting_hr: 62 }, TODAY), null);
  assert.equal(heartBandOf(null, TODAY), null);
  assert.deepEqual(heartOf({ resting_hr: 62 }, TODAY), { kind: "none", why: "no-age" });
  assert.deepEqual(heartOf(null, TODAY), { kind: "none", why: "no-profile" });
  assert.equal(heartOf({ age: 44, resting_hr: 62 }, TODAY).kind, "beats");
});

test("the app's own answer switches the card to effort, whatever else the profile holds", () => {
  assert.deepEqual(heartOf({ age: 44, resting_hr: 62, on_beta_blockers: true }, TODAY), { kind: "effort" });
  assert.deepEqual(heartOf({ on_beta_blockers: true, zone2_low_hr: 118, zone2_high_hr: 136 }, TODAY), { kind: "effort" });
  for (const answer of [false, null, undefined]) assert.equal(heartOf({ age: 44, resting_hr: 62, on_beta_blockers: answer }, TODAY).kind, "beats");
});

test("the card's words: where a range comes from, and where the app keeps the answer that turns it off", () => {
  assert.equal(beatsWords({ low: 108, high: 131 }), "108 to 131 beats a minute");
  assert.equal(heartSource(heartOf({ age: 44, resting_hr: 62 }, TODAY)), "40 to 60% of your heart-rate reserve: a maximum of 177 for your age, less 62 at rest. The app counts your zone 2 minutes against the same range. The maximum is an estimate from age alone, so the range can be some beats out for you.");
  assert.match(heartSource(heartOf({ age: 44 }, TODAY)), /less 60 at rest \(no resting rate is on your profile, so 60 is assumed, as the app does\)\./);
  assert.equal(heartSource(heartOf({ zone2_low_hr: 118, zone2_high_hr: 136 }, TODAY)), "The range you typed into the app from a test. The app counts your zone 2 minutes against the same range.");
  assert.match(heartSource({ kind: "effort" }), /^Guided by effort, not by heart rate, as you set in the app\./);
  assert.match(heartSource({ kind: "none", why: "no-age" }), /Add it in the app, under Settings, then Profile\.$/);
  assert.equal(heartSource({ kind: "none", why: "no-profile" }), null);
  // the app's own label, word for word (METTracker app/settings/profile.tsx)
  assert.match(EFFORT_WHERE, /"Heart-rate medication"/);
  for (const words of [heartSource({ kind: "effort" }), heartSource(heartOf({ age: 44, resting_hr: 62 }, TODAY))]) assert.doesNotMatch(words, /beta|medic/i);
});
