// The Guide's read, the parts that are rules (src/my-health/derive/guideLines.ts), and the one line a card
// carries for a horizon (horizon/derive horizonLinesByCard). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { markerOf, standOut, MARKER_KEYS, WILL_NOT } from "../src/my-health/derive/guideLines.ts";
import { horizonLinesByCard, toTarget, MARKER_BY_KEY } from "../src/my-health/horizon/derive.ts";
import { LANE_FOR } from "../src/my-health/derive/timeline.ts";

test("a line's marker is the function's own tag when it is one of the list", () => {
  assert.equal(markerOf({ marker: "ldl", topic: "strength days", text: "…" }), "ldl");
  assert.equal(markerOf({ marker: "not-a-marker", topic: "zone 2", text: "Zone 2 fell." }), "zone2_week", "a tag off the list is passed over");
  assert.ok(MARKER_KEYS.split(" ").every((k) => MARKER_BY_KEY[k]), "the list sent to the function is Horizon's own markers");
});

test("an older read's marker is the first one its words name; a line that names none has none", () => {
  assert.equal(markerOf({ topic: "triglycerides", text: "Outside the lab's range." }), "triglycerides");
  assert.equal(markerOf({ topic: "training volume", text: "No workouts are recorded against a weekly goal of 10 MET-hours." }), "dose");
  assert.equal(markerOf({ topic: "fitness", text: "8.9 METs on the last test." }), "mets");
  assert.equal(markerOf({ topic: "retest", text: "The six-minute walk retest is overdue." }), null);
  assert.equal(markerOf(null), null);
});

test("every marker a line can name leads somewhere: a lane on In depth, or In depth itself", () => {
  // the lanes a line's "See it over time" can open; a marker without one opens the window with no lane lit
  for (const k of ["mets", "dose", "zone2_week", "rhr", "sleep", "steps", "weight", "ldl", "apob", "hba1c", "fasting_glucose", "triglycerides", "hs_crp"]) assert.ok(LANE_FOR[k], k);
  assert.equal(LANE_FOR.remnant, undefined, "remnant cholesterol is not LDL: it has no lane to be mistaken for");
});

test("the read is headed by how many things stand out", () => {
  assert.deepEqual([0, 1, 2, 3, 7].map(standOut), ["Nothing stands out", "One thing stands out", "Two things stand out", "Three things stand out", "Three things stand out"]);
  assert.equal(WILL_NOT.length, 4);
});

test("a card carries one line for the horizon: the aim, the date, the pace", () => {
  const h = { starts_on: "2026-11-09", ends_on: "2027-02-09" };
  const person = {
    doc: { weeks: [0, 1, 2, 3].map((i) => ({ week_start: ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"][i], source: "sync", synced_at: "2026-11-09T00:00:00Z", workouts: 3, dose_met_min: [1316, 1081, 900, 1132][i], dose_goal_met_min: 1000 })) },
    acts: [], signals: [], weights: [], profile: null, by: new Map([["ldl_mgdl", [{ d: "2026-10-20", v: 112, lo: null, hi: null, unit: "mg/dL" }]]]),
    crf: [{ measured_on: "2026-11-06", vo2max: 31.15, met_capacity: 8.9, method: "cooper" }],
  };
  const targets = [
    { marker: "mets", label: "Fitness", unit: "METs", start_value: 8.9, start_on: "2026-11-06", target_value: 9.5, cadence: "monthly" },
    { marker: "dose", label: "Weekly dose", unit: "MET-min", start_value: 1132, start_on: "2026-11-08", target_value: 1000, cadence: "weekly" },
    { marker: "ldl", label: "LDL", unit: "mg/dL", start_value: 112, start_on: "2026-10-20", target_value: 100, cadence: "when-measured" },
  ].map(toTarget);
  const lines = horizonLinesByCard(h, targets, person, "2026-11-11");
  assert.equal(lines.fitness, "On your horizon: 9.5 by 9 February · on pace");
  assert.equal(lines.movement, "On your horizon: at least 1,000 a week · reached in 3 of the last 4");
  assert.equal(lines.body, "On your horizon: LDL 100.0 mg/dL by 9 February · October's report");
  assert.equal(lines.sleep, undefined, "a card with no target carries no line");
  assert.match(horizonLinesByCard(h, targets, person, "2026-11-11", false).fitness, /^On their horizon/);
});
