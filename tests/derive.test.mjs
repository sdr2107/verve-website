// The derive layer, under node: the same functions the page draws from,
// with rows shaped like the document's. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { activitySummary, fitnessSummary, weeksFrom, mergeBy, actsByDay } from "../src/my-health/derive/activity.ts";
import { markerPointsFrom, labRowsFrom, inRange, chartKeyFor } from "../src/my-health/derive/markers.ts";
import { sleepHeartSummaryRaw, HRV_MIN_NIGHTS } from "../src/my-health/derive/heart.ts";
import { buildMarkers, drawnFor } from "../src/my-health/derive/lenses.ts";
import { addDays, medianOf, quartilesOf, mondayOf } from "../src/my-health/derive/format.ts";

const day = (n) => addDays("2026-10-09", -n);

test("weeksFrom buckets workouts by the Monday and keeps background out", () => {
  const acts = [
    { timestamp: "2026-10-06T07:00:00Z", duration_minutes: 30, met_hours: 2.5, intensity_category: "moderate" },
    { timestamp: "2026-10-08T07:00:00Z", duration_minutes: 20, met_hours: 2, intensity_category: "vigorous" },
  ];
  const weeks = weeksFrom(acts);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].week_start, mondayOf(new Date("2026-10-06T07:00:00Z")));
  assert.equal(weeks[0].met_hours, 4.5);
  assert.equal(weeks[0].vigorous_min, 20);
});

test("mergeBy lets the app's row win over the import's on the same key", () => {
  const out = mergeBy("week_start", [{ week_start: "2026-10-05", met_hours: 9 }], [{ week_start: "2026-10-05", met_hours: 1 }, { week_start: "2026-09-28", met_hours: 3 }]);
  assert.deepEqual(out.map((w) => w.met_hours), [3, 9]);
});

test("activitySummary fills empty weeks as zero weeks and counts a streak", () => {
  const monday = mondayOf(new Date());
  const weeks = [1, 2, 3].map((i) => ({ week_start: addDays(monday, -7 * i), met_hours: 8, minutes: 100, workouts: 2, vigorous_min: 20, moderate_min: 40 }));
  const a = activitySummary(weeks, [], 7.5, "2026-10-09", monday);
  assert.equal(a.streak, 3);
  assert.equal(a.complete.length, 3);
  assert.equal(a.thisWeek.source, "gap", "this week has no row, so it is a zero week");
});

test("fitnessSummary compares only within a method and sets the eight-week retest", () => {
  const f = fitnessSummary([
    { measured_on: "2026-06-01", vo2max: 35, method: "six-minute-walk" },
    { measured_on: "2026-08-01", vo2max: 40, method: "cpet" },
    { measured_on: "2026-09-01", vo2max: 37, method: "six-minute-walk" },
  ], "2026-10-09");
  assert.equal(f.latest.v, 37);
  assert.equal(f.prevSame.v, 35);
  assert.equal(f.within, 2);
  assert.equal(f.due.on, addDays("2026-09-01", 56));
});

test("markerPointsFrom dedups the same value on the same day and keeps the lab's range", () => {
  const by = markerPointsFrom(
    [{ analyte: "HbA1c", value: 5.6, unit: "%", ref_low: 4, ref_high: 5.7, measured_on: "2026-08-04" }, { analyte: "HbA1c", value: 5.6, unit: "%", measured_on: "2026-08-04" }],
    [{ measured_at: "2026-08-04T06:00:00", hba1c_pct: 5.6, sbp: 118, dbp: 76 }],
    [{ measured_on: "2026-09-30", waist_cm: 96 }],
  );
  assert.equal(by.get("hba1c_pct").length, 1);
  assert.equal(by.get("hba1c_pct")[0].hi, 5.7);
  assert.equal(by.get("sbp")[0].v, 118);
  assert.equal(by.get("waist_cm")[0].v, 96);
  assert.equal(chartKeyFor("Glycated haemoglobin"), "hba1c_pct");
});

test("labRowsFrom reads each marker against its own printed range", () => {
  const by = markerPointsFrom([{ analyte: "Triglycerides", value: 172, unit: "mg/dL", ref_low: 0, ref_high: 150, measured_on: "2026-08-04" }], [], []);
  const rows = labRowsFrom(by, "2026-10-09");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].out, true);
  assert.equal(inRange({ value: 172, ref_low: 0, ref_high: 150 }), false);
});

test("sleepHeartSummaryRaw: the night HRV band appears after 7 nights of one writer and never mixes writers", () => {
  const rows = [];
  for (let i = 40; i >= 1; i--) rows.push({ day: day(i), hrv_night_ms: 60 + (i % 5), hrv_source: "Apple Watch", hrv_method: "sdnn", sleep_minutes: 420 });
  rows.push({ day: day(0), hrv_night_ms: 40, hrv_source: "Apple Watch", hrv_method: "sdnn", sleep_minutes: 400 });
  const h = sleepHeartSummaryRaw(rows, "2026-10-09");
  assert.equal(h.hrv.writer, "Apple Watch");
  assert.ok(h.hrv.band, "a band after 30 nights");
  assert.equal(h.hrv.below, true);
  const few = sleepHeartSummaryRaw(rows.slice(-HRV_MIN_NIGHTS), "2026-10-09");
  assert.equal(few.hrv.band, null, "under 7 prior nights there is no band");
  const mixed = [...rows.slice(0, 20), ...rows.slice(20).map((r) => ({ ...r, hrv_source: "HRV4Training", hrv_method: "rmssd" }))];
  const m = sleepHeartSummaryRaw(mixed, "2026-10-09");
  assert.equal(m.hrv.writer, "HRV4Training");
  assert.deepEqual(m.hrv.otherWriters, ["Apple Watch"]);
});

test("buildMarkers: 39 markers, the week lens of a summing marker adds the days", () => {
  const acts = [{ timestamp: `${mondayOf(new Date())}T07:00:00`, duration_minutes: 30, met_hours: 2.5, intensity_category: "moderate", zone2_minutes: 10 }];
  const markers = buildMarkers({ signals: [], acts, weights: [], profile: { weekly_met_hours_goal: 7.5 }, crf: [], weeks: [], app: [], by: new Map() });
  assert.equal(markers.length, 39);
  const met = markers.find((m) => m.key === "met");
  const dr = drawnFor(met, "week");
  assert.equal(dr.headline, "2.5");
  assert.equal(dr.pts.length, 7);
  assert.equal(actsByDay(acts).size, 1);
});

test("medians and Tukey's hinges", () => {
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.deepEqual(quartilesOf([1, 2, 3, 4, 5, 6, 7, 8]), { q1: 2.5, q3: 6.5 });
});
