// The derive layer, under node: the same functions the page draws from,
// with rows shaped like the document's. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { activitySummary, fitnessSummary, weeksFrom, mergeWeeks, dedupeSessions, doseReason, mergeBy, actsByDay, doseOf, isWorkout, STEP_LINES } from "../src/my-health/derive/activity.ts";
import { backgroundOf, weekZones, dayBars, inBedWindow, efficiencyOf, wristTemp, writerOf } from "../src/my-health/derive/signals.ts";
import { tierRowFor, tierIndexOf, tierIndexFromCategory, tierWords } from "../src/my-health/derive/fitness.ts";
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

test("activitySummary fills empty weeks as gaps with no dose and counts a streak of the app's weeks", () => {
  const monday = mondayOf(new Date());
  // the app's rows: the dose is the app's figure; an import's 8 MET-hours would count for nothing since 8 Nov 2026
  const weeks = [1, 2, 3].map((i) => ({ week_start: addDays(monday, -7 * i), source: "sync", synced_at: "2026-11-01T00:00:00Z", dose_met_min: 480, met_hours: 8, minutes: 100, workouts: 2, vigorous_min: 20, moderate_min: 40 }));
  const a = activitySummary(weeks, [], 7.5, "2026-10-09", monday);
  assert.equal(a.streak, 3);
  assert.equal(a.complete.length, 3);
  assert.equal(a.thisWeek.source, "gap", "this week has no row, so it is a gap");
  assert.equal(a.thisWeek.dose_met_min, null, "a gap has no dose, not a zero");
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

// 40 since 6b0d423 (2026-10-11), when active_kcal joined the movement markers; the pin was left at 39 and failed unnoticed until 2026-10-20.
test("buildMarkers: 54 markers, the week lens of a summing marker adds the days", () => {
  const acts = [{ timestamp: `${mondayOf(new Date())}T07:00:00`, duration_minutes: 30, met_hours: 2.5, intensity_category: "moderate", zone2_minutes: 10 }];
  const markers = buildMarkers({ signals: [], acts, weights: [], profile: { weekly_met_hours_goal: 7.5 }, crf: [], weeks: [], app: [], by: new Map() });
  assert.equal(markers.length, 54); // 54 since 2026-11-08: the eleven stored readings and the day's zones and background joined
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

test("the dose: a workout's MET-minutes when aerobic and moderate or vigorous; nothing for light, strength or background", () => {
  const mon = mondayOf(new Date());
  const acts = [
    { timestamp: `${mon}T07:00:00`, duration_minutes: 52, met_minutes: 176, met_hours: 2.93, intensity_category: "moderate", activity_type: "aerobic", source: "manual" },
    { timestamp: `${mon}T18:00:00`, duration_minutes: 18, met_minutes: 47, met_hours: 0.78, intensity_category: "light", activity_type: "aerobic", source: "manual" },
    { timestamp: `${mon}T19:00:00`, duration_minutes: 30, met_minutes: 150, met_hours: 2.5, intensity_category: "moderate", activity_type: "strength", source: "manual" },
    { timestamp: `${mon}T12:00:00`, duration_minutes: 200, met_minutes: 600, met_hours: 10, intensity_category: "moderate", activity_type: "aerobic", source: "passive-nakanishi" },
  ];
  assert.equal(acts.map(doseOf).join(","), "176,0,0,0");
  assert.equal(weeksFrom(acts.filter(isWorkout))[0].dose_met_min, 176);
  assert.equal(actsByDay(acts).get(mon).dose, 176);
  const a = activitySummary([], acts, 500 / 60, mon, mon);
  assert.equal(a.goalDose, 500);
  assert.equal(a.thisWeek.dose_met_min, 176);
});

test("the step lines are the app's tier floors, lowest first, the zero floor left out", () => {
  assert.deepEqual(STEP_LINES.map((l) => l.value), [2600, 7000, 8800]);
  assert.ok(STEP_LINES.every((l) => l.label && l.color.startsWith("#")));
});

test("a table marker's twelve weeks carry one row a week, newest first, and the median of the complete ones", () => {
  const mon = mondayOf(new Date());
  const today = new Date().toLocaleDateString("en-CA");
  const signals = [];
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) { const day = addDays(mon, -7 * w + d); if (day <= today) signals.push({ day, steps: w === 0 ? 1000 : 5000 + w * 100 }); }
  const markers = buildMarkers({ signals, acts: [], weights: [], profile: {}, crf: [], weeks: [], app: [], by: new Map() });
  const steps = markers.find((m) => m.key === "steps");
  const dr = drawnFor(steps, "4w");
  assert.equal(dr.pts.length, 12);
  assert.equal(dr.rows.length, 12);
  assert.equal(dr.rows[0].current, true);
  assert.equal(dr.rows[1].total, 7 * 5100);
  assert.equal(dr.median, 7 * 5600);   // the median of weeks 1..11: 5100..6100 a day × 7
});

test("sleepHeartSummaryRaw: efficiency is asleep ÷ the in-bed window the app sends, awake carried through", () => {
  const rows = [];
  for (let i = 10; i >= 1; i--) rows.push({ day: `2026-10-${String(29 - i).padStart(2, "0")}`, sleep_minutes: 440 });
  rows.push({ day: "2026-10-29", sleep_minutes: 481, sleep_start: "2026-10-28T16:52:00.000Z", sleep_end: "2026-10-29T01:12:00.000Z", sleep_awake_min: 14 });
  const h = sleepHeartSummaryRaw(rows, "2026-10-29");
  assert.equal(h.sleep.last.inBedMin, 500);
  assert.equal(h.sleep.last.efficiency, 96);
  assert.equal(h.sleep.last.awakeMin, 14);
  const bare = sleepHeartSummaryRaw([{ day: "2026-10-29", sleep_minutes: 400 }], "2026-10-29");
  assert.equal(bare.sleep.last.efficiency, null);
});

// ── a stored read's Due sentence ──────────────────────────────────────
import { dueLineOf, DUE_LINE_FROM } from "../src/my-health/derive/reads.ts";

test("a read written before the cut-off does not show its Due sentence; a later one does", () => {
  const due = "The lipid panel is due in March 2027. The fitness test is two weeks overdue.";
  assert.equal(DUE_LINE_FROM, "2026-11-07");
  // Written while the working still carried lab timing: hidden, whatever it says.
  assert.equal(dueLineOf(due, "2026-10-28T09:12:00Z"), "");
  assert.equal(dueLineOf(due, "2026-11-06T23:59:59Z"), "");
  assert.equal(dueLineOf(due, "2026-11-06"), "");
  // Written after: it can only speak of the app's own reminders, so it shows.
  assert.equal(dueLineOf("The fitness test is due on 14 Nov.", "2026-11-07T00:00:01Z"), "The fitness test is due on 14 Nov.");
  assert.equal(dueLineOf("  The fitness test is due.  ", "2026-12-01"), "The fitness test is due.");
  // Nothing to show, or no date to judge it by: nothing.
  assert.equal(dueLineOf("", "2026-12-01"), "");
  assert.equal(dueLineOf(null, "2026-12-01"), "");
  assert.equal(dueLineOf(due, null), "");
  assert.equal(dueLineOf(due, undefined), "");
});

test("a lab row carries no retest date; a blood pressure at crisis level keeps its line as an alert", () => {
  const pt = (d, v, extra = {}) => ({ d, v, unit: "mg/dL", lo: null, hi: 150, ...extra });
  const by = new Map([
    ["triglycerides_mgdl", [pt("2026-06-01", 140), pt("2026-10-01", 170)]],
    ["sbp", [{ d: "2026-10-05", v: 184, unit: "mmHg", n: 1, max: 184 }]],
    ["dbp", [{ d: "2026-10-05", v: 96, unit: "mmHg", n: 1, max: 96 }]],
  ]);
  const rows = labRowsFrom(by, "2026-10-09");
  for (const r of rows) {
    assert.equal("due" in r, false);
    assert.equal("retest" in r, false);
  }
  const tg = rows.find((r) => r.key === "triglycerides_mgdl");
  assert.equal(tg.out, true);
  assert.equal(tg.alert, null);
  const bp = rows.find((r) => r.key === "bp");
  assert.match(bp.alert, /crisis level/);
});

// ── the dose rule of 8 Nov 2026: the app computes, the website shows ──
test("mergeWeeks: an app week wins whole, a zero-session app week has no dose, a week without one is counted from sessions, an import carries none", () => {
  const monday = mondayOf(new Date("2026-10-26T12:00:00"));
  const prev = addDays(monday, -7), older = addDays(monday, -14);
  const acts = [
    { timestamp: `${monday}T07:00:00`, duration_minutes: 40, met_hours: 5, met_minutes: 300, activity_type: "aerobic", intensity_category: "moderate", source: "healthkit", zone2_minutes: 20 },
    { timestamp: `${prev}T07:00:00`, duration_minutes: 30, met_hours: 4, met_minutes: 240, activity_type: "aerobic", intensity_category: "vigorous", source: "healthkit", zone2_minutes: 10 },
  ];
  const doc = [
    { week_start: monday, source: "sync", dose_met_min: 814, dose_goal_met_min: 1000, workouts: 3, met_hours: 11, minutes: 180, zone1_min: 128, zone2_min: 96, zone3_min: 41, strength_sessions: 1, background_min_avg: 46, synced_at: "2026-10-31T07:12:00Z" },
    { week_start: older, source: "sync", dose_met_min: 0, workouts: 0, met_hours: 0, minutes: 0, synced_at: "2026-10-31T07:12:00Z" },
    { week_start: addDays(monday, -21), source: "export", met_hours: 6.5, minutes: 120, workouts: 2 },
  ];
  const w = mergeWeeks(doc, acts);
  const by = Object.fromEntries(w.map((x) => [x.week_start, x]));
  assert.equal(by[monday].dose_met_min, 814, "the app's figure, not the browser's 300");
  assert.equal(by[monday].dose_basis, "app");
  assert.deepEqual([by[monday].zone1_min, by[monday].zone2_min, by[monday].zone3_min, by[monday].strength_sessions, by[monday].background_min_avg], [128, 96, 41, 1, 46]);
  assert.equal(by[older].dose_met_min, null, "workouts 0 on an app row is no sessions logged, not a zero figure");
  assert.equal(doseReason(by[older], true), "no sessions logged");
  assert.equal(by[prev].dose_met_min, 240, "no app row: the browser counts the sessions");
  assert.equal(by[prev].dose_basis, "browser");
  assert.equal(doseReason(by[prev], true), "the app writes this on its next sync");
  assert.equal(by[addDays(monday, -21)].dose_met_min, null, "an import's week has hours but no dose");
  assert.equal(by[addDays(monday, -21)].met_hours, 6.5);
  assert.deepEqual(mergeWeeks(w, acts).map((x) => x.dose_met_min), w.map((x) => x.dose_met_min), "idempotent");
});

test("dedupeSessions: one row per start and end, the device's row over a typed one; no MET-hours fallback anywhere", () => {
  const acts = [
    { timestamp: "2026-10-27T07:00:00", duration_minutes: 40, met_minutes: 300, met_hours: 5, activity_type: "aerobic", intensity_category: "moderate", source: "manual" },
    { timestamp: "2026-10-27T07:00:00", duration_minutes: 40, met_minutes: 280, met_hours: 4.7, activity_type: "aerobic", intensity_category: "moderate", source: "healthkit", zone2_minutes: 22 },
    { timestamp: "2026-10-28T07:00:00", duration_minutes: 20, met_minutes: 100, met_hours: 1.7, activity_type: "aerobic", intensity_category: "light", source: "healthkit" },
  ];
  const one = dedupeSessions(acts);
  assert.equal(one.length, 2);
  assert.equal(one[0].source, "healthkit");
  const week = weeksFrom(acts)[0];
  assert.equal(week.dose_met_min, 280, "the kept row's dose, the light walk adds nothing");
  assert.equal(week.workouts, 2);
  assert.deepEqual(week.writers, ["Apple Health"]);
  const monday = mondayOf(new Date());
  const a = activitySummary([{ week_start: addDays(monday, -7), source: "export", met_hours: 9, minutes: 100, workouts: 2 }], [], 7.5, "2026-10-09", monday);
  assert.equal(a.complete[0].dose_met_min, null, "9 MET-hours is not 540 MET-minutes");
  assert.equal(a.thisWeek.dose_met_min, null);
  assert.equal(a.goalDose, 450);
});

test("activitySummary judges a week against the goal the app wrote for it", () => {
  const monday = mondayOf(new Date());
  const weeks = [1, 2].map((i) => ({ week_start: addDays(monday, -7 * i), source: "sync", dose_met_min: 600, dose_goal_met_min: i === 1 ? 500 : 700, workouts: 2, met_hours: 8, minutes: 90, synced_at: "2026-11-01T00:00:00Z" }));
  const a = activitySummary(weeks, [], 7.5, "2026-11-08", monday);
  assert.equal(a.atGoal, 1, "600 meets 500 but not 700");
  assert.equal(a.streak, 1);
});

// ── the day rows: background movement is judged from the newest day; the zones sum over the days that carry them ──
test("backgroundOf: minutes give the week's mean, a reason gives a dash in words, nothing gives the sync line; never a zero", () => {
  const mon = "2026-11-02";
  const rows = [
    { day: "2026-11-02", background_min: 40 }, { day: "2026-11-03", background_min: 52 }, { day: "2026-11-04", background_min: null },
  ];
  const b = backgroundOf(rows, mon, "2026-11-05", "WHOOP");
  assert.equal(b.minutes, 46); assert.equal(b.days, 2);
  const whoop = backgroundOf([{ day: "2026-11-02", background_min: null, background_reason: "no-heart-rate" }], mon, "2026-11-05", "WHOOP");
  assert.equal(whoop.minutes, null); assert.equal(whoop.words, "no all-day heart rate from WHOOP");
  const none = backgroundOf([{ day: "2026-11-02", steps: 8000 }], mon, "2026-11-05", null);
  assert.equal(none.minutes, null); assert.equal(none.words, "the app writes this on its next sync");
  assert.equal(weekZones([{ day: "2026-11-02", zone1_min: 30, zone2_min: 20, zone3_min: 5 }, { day: "2026-11-03", zone2_min: 15 }, { day: "2026-11-04", steps: 1 }], mon).z2, 35);
  assert.equal(weekZones([{ day: "2026-11-02", steps: 1 }], mon), null);
  const bars = dayBars([{ day: "2026-11-02", zone1_min: 10, zone2_min: 20, zone3_min: 0 }], [{ timestamp: "2026-11-03T07:00:00", duration_minutes: 30, zone2_minutes: 12 }], mon, "2026-11-04");
  assert.equal(bars.length, 7); assert.equal(bars[0].z2, 20); assert.equal(bars[1].z2, 12); assert.equal(bars[1].other, 18); assert.equal(bars[6].future, true);
});

test("the stored readings read: the in-bed window, efficiency, wrist temperature against the person's own nights, the writer", () => {
  const r = { day: "2026-11-07", sleep_minutes: 520, sleep_in_bed_min: 560, sleep_start: "2026-11-06T23:10:00", sleep_end: "2026-11-07T07:50:00", steps_source: "WHOOP" };
  assert.match(inBedWindow(r), /^\d\d:\d\d – \d\d:\d\d$/);
  assert.equal(efficiencyOf(r), 93);
  assert.equal(efficiencyOf({ sleep_minutes: 400 }), null);
  const nights = Array.from({ length: 8 }, (_, i) => ({ day: addDays("2026-11-07", -8 + i), wrist_temp_c: 35.6 }));
  const t = wristTemp([...nights, { day: "2026-11-07", wrist_temp_c: 35.9 }], "2026-11-07");
  assert.equal(t.delta, true); assert.equal(Math.round(t.value * 10) / 10, 0.3);
  assert.equal(wristTemp([{ day: "2026-11-07", wrist_temp_c: 35.9 }], "2026-11-07").delta, false);
  assert.equal(wristTemp([{ day: "2026-11-07", skin_temp_delta_c: -0.2 }], "2026-11-07").value, -0.2);
  assert.equal(writerOf([r], "2026-11-08"), "WHOOP");
});

test("the fitness tiers come from the app's table for the age and sex; the stored category is the one shown", () => {
  const row = tierRowFor(46, "male");
  assert.equal(row.age, "40–49");
  assert.equal(tierIndexOf(8.9, row), 1, "8.9 METs at 40–49 for a man sits in below average by the table");
  assert.equal(tierIndexFromCategory("aboveAverage"), 2);
  assert.equal(tierIndexFromCategory("above-average"), 2);
  assert.equal(tierIndexFromCategory(null), null);
  assert.equal(tierWords(2), "Above average for your age and sex");
  assert.equal(tierRowFor(72, "female").age, "70+");
});

// ── stage 2 (8 Nov 2026): the Body list port, last week, the snapshot, the store's name ──
import { BODY_DEFS } from "../src/data/body-list.ts";
import { bodyListOf, judgeValue, rangeTrack, toAppUnit, bodyHeadline } from "../src/my-health/derive/body.ts";
import { lastWeekOf, snapshotOf, weekFiguresOf, addMonths, kindOf } from "../src/my-health/derive/snapshot.ts";
import { storeOf } from "../src/my-health/derive/activity.ts";
import { derivePerson } from "../src/my-health/derive/person.ts";

const emptyDoc = (over = {}) => ({ person: { id: "p", account_id: "u" }, labs: [], imaging: [], reports: [], files: [], weeks: [], web_crf: [], web_body: [], app_labs: [], activities: [], app_crf: [], waist: [], profile: { sex: "male", age: 50, height_cm: 175, weekly_met_hours_goal: 16.67 }, signals: [], weights: [], ai: { summary: null, consent: null }, ...over });

test("the Body list is the app's 22 rows in the app's order, blood pressure left to Vitals", () => {
  assert.equal(BODY_DEFS.length, 22);
  assert.deepEqual(BODY_DEFS.slice(0, 3).map((d) => d.label), ["Fasting blood sugar", "HbA1c", "Triglycerides"]);
  assert.ok(!BODY_DEFS.some((d) => d.key === "bp" || d.label === "Blood pressure"));
  assert.deepEqual(BODY_DEFS.filter((d) => d.section === "heart").map((d) => d.label), ["ApoB", "LDL cholesterol", "Total cholesterol", "Remnant cholesterol", "Lp(a)", "hs-CRP"]);
});

test("a report in mmol/L is judged by the app's mg/dL bands and shown as printed", () => {
  const doc = emptyDoc({ labs: [
    { analyte: "LDL Cholesterol", value: 3.4, unit: "mmol/L", measured_on: "2026-10-12", report_path: "u/r.pdf", ref_low: null, ref_high: 3.0 },
    { analyte: "HbA1c", value: 5.4, unit: "%", measured_on: "2026-10-12", report_path: "u/r.pdf" },
  ] });
  const list = bodyListOf(derivePerson(doc));
  const ldl = list.sections[1].rows.find((r) => r.key === "ldl_mgdl");
  assert.equal(ldl.value, "3.4"); assert.equal(ldl.unit, "mmol/L");
  assert.equal(ldl.bandLabel, "Elevated", "3.4 mmol/L is 131 mg/dL, past the app's 129");
  assert.equal(ldl.writer, "lab report");
  assert.ok(ldl.track && ldl.track.position > 0.5);
  const a1c = list.sections[0].rows.find((r) => r.key === "hba1c_pct");
  assert.equal(a1c.bandLabel, "In range"); assert.equal(a1c.tone, "good");
  assert.equal(list.watch, 1);
  assert.equal(bodyHeadline(list), "One marker outside its range: LDL");
  assert.equal(toAppUnit("triglycerides_mgdl", 1.1, "mmol/L").toFixed(0), "97");
});

test("Lp(a) is judged in its own unit and never to watch; hs-CRP at 10 is not a heart reading", () => {
  const doc = emptyDoc({ app_labs: [{ measured_at: "2026-10-12T08:00:00Z", lpa_value: 32, lpa_unit: "nmol/L", hs_crp_mgl: 12 }] });
  const list = bodyListOf(derivePerson(doc));
  const lpa = list.sections[1].rows.find((r) => r.key === "lpa_value");
  assert.equal(lpa.bandLabel, "Low"); assert.equal(lpa.once, true); assert.equal(lpa.watch, false);
  const crp = list.sections[1].rows.find((r) => r.key === "hs_crp_mgl");
  assert.equal(crp.bandLabel, "Not a heart reading"); assert.equal(crp.tone, "neutral"); assert.equal(crp.watch, false);
});

test("the track lays the bands on one line with the value on it", () => {
  const t = rangeTrack(BODY_DEFS.find((d) => d.key === "waist_cm").bands({ sex: "male", age: 50, heightCm: 175, weightKg: 74, ethnicity: null }), 96);
  assert.equal(t.segments.length, 2);
  assert.ok(t.position > 0.5 && t.position < 1, "96 cm sits past the 94 cm cut for a man");
  assert.equal(judgeValue(derivePerson(emptyDoc()), "waist_cm", 96, "cm").label, "Elevated");
});

test("last week is the app's week row where it wrote one, and the comparison names the moves", () => {
  const monday = mondayOf(new Date("2026-11-08T12:00:00"));
  const last = addDays(monday, -7), before = addDays(monday, -14);
  const weeks = [
    { week_start: last, source: "sync", synced_at: "2026-11-08T00:00:00Z", dose_met_min: 1120, dose_goal_met_min: 1000, workouts: 4, zone1_min: 120, zone2_min: 118, zone3_min: 44, strength_sessions: 1, background_min_avg: 46, met_hours: 20, minutes: 190 },
    { week_start: before, source: "sync", synced_at: "2026-11-01T00:00:00Z", dose_met_min: 880, dose_goal_met_min: 1000, workouts: 3, zone1_min: 96, zone2_min: 88, zone3_min: 30, strength_sessions: 2, background_min_avg: 41, met_hours: 16, minutes: 150 },
  ];
  const signals = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ day: addDays(last, i), sleep_minutes: 492, resting_hr: 52, hrv_night_ms: 48, steps: 8360, sedentary_minutes: 425, sri_30d: 84 }))
    .concat([0, 1, 2, 3, 4, 5, 6].map((i) => ({ day: addDays(before, i), sleep_minutes: 474, resting_hr: 52, steps: 7900 })));
  const acts = [{ timestamp: `${addDays(last, 4)}T07:00:00`, duration_minutes: 52, met_minutes: 600, intensity_category: "vigorous", activity_type: "aerobic", activity_name: "Run", source: "healthkit" },
    { timestamp: `${addDays(last, 1)}T07:00:00`, duration_minutes: 42, met_minutes: 0, intensity_category: "moderate", activity_type: "strength", activity_name: "Strength", source: "healthkit" }];
  const d = derivePerson(emptyDoc({ weeks, activities: acts, signals }));
  const lw = lastWeekOf(d, "2026-11-08");
  assert.equal(lw.week.basis, "app");
  assert.equal(lw.tiles[0].figure, "1,120");
  assert.equal(lw.tiles[2].figure, "118 · 44");
  assert.equal(lw.tiles[3].figure, "8 h 12");
  assert.ok(lw.counted.startsWith("Counted by the app's week-in-review"));
  assert.ok(lw.compared.includes("dose up 240"), lw.compared);
  assert.ok(lw.compared.includes("sleep up 18 minutes a night"), lw.compared);
  assert.ok(lw.compared.includes("resting heart rate the same"), lw.compared);
  assert.ok(lw.compared.includes("one fewer strength session"), lw.compared);
  assert.equal(kindOf(acts[0]), "run");
  const wf = weekFiguresOf(d, last, "2026-11-08");
  assert.equal(wf.background, 46);
});

test("the snapshot pairs each marker's reading near the anchor with the latest, and a single reading shows no change", () => {
  const today = "2026-11-08";
  assert.equal(addMonths(today, -6), "2026-05-08");
  const labs = [
    { analyte: "LDL Cholesterol", value: 3.7, unit: "mmol/L", measured_on: "2026-04-14", report_path: "u/a.pdf" },
    { analyte: "LDL Cholesterol", value: 3.4, unit: "mmol/L", measured_on: "2026-10-12", report_path: "u/b.pdf" },
    { analyte: "HbA1c", value: 5.4, unit: "%", measured_on: "2026-10-12", report_path: "u/b.pdf" },
  ];
  const signals = Array.from({ length: 220 }, (_, i) => ({ day: addDays(today, -i), resting_hr: i > 150 ? 55 : 52 }));
  const d = derivePerson(emptyDoc({ labs, signals, weights: [{ measured_on: "2026-05-05", weight_kg: 76.8, source: "health" }, { measured_on: "2026-11-07", weight_kg: 74.2, source: "health" }] }));
  const s = snapshotOf(d, 6, today);
  const blood = s.groups.find((g) => g.title.startsWith("Blood"));
  assert.ok(blood.title.includes("14 April") && blood.title.includes("12 October"), blood.title);
  const ldl = blood.rows.find((r) => r.label === "LDL");
  assert.equal(ldl.then, "3.7"); assert.equal(ldl.now, "3.4"); assert.equal(ldl.change, "−0.3");
  assert.equal(ldl.reads, "moving, still elevated");
  const a1c = blood.rows.find((r) => r.label === "HbA1c");
  assert.equal(a1c.change, "measured once"); assert.equal(a1c.then, "—");
  const w = s.groups.find((g) => g.title === "Body").rows.find((r) => r.label === "Weight");
  assert.equal(w.change, "−2.6"); assert.ok(w.reads.startsWith("down, about 0.1 kg a week"), w.reads);
  const rhr = s.groups[0].rows.find((r) => r.label === "Resting heart rate");
  assert.equal(rhr.then, "55"); assert.equal(rhr.now, "52"); assert.equal(rhr.reads, "your normal has moved down");
  assert.ok(!s.groups.some((g) => g.rows.some((r) => /Lp\(a\)/.test(r.label))));
});

test("the store is named from the sessions' source: Apple Health, Health Connect, or neither", () => {
  assert.equal(storeOf([{ timestamp: "2026-11-01T07:00:00Z", source: "healthkit" }], "2026-11-08"), "Apple Health");
  assert.equal(storeOf([{ timestamp: "2026-11-01T07:00:00Z", source: "healthconnect" }], "2026-11-08"), "Health Connect");
  assert.equal(storeOf([{ timestamp: "2026-11-01T07:00:00Z", source: "healthkit" }, { timestamp: "2026-11-02T07:00:00Z", source: "healthconnect" }], "2026-11-08"), "the phone's health store");
  assert.equal(storeOf([{ timestamp: "2026-11-01T07:00:00Z", source: "manual" }], "2026-11-08"), "the phone's health store");
});
