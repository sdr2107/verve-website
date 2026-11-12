// In depth across time (canvas "Verve, one story in four parts", board 04): the five windows, which
// window shows what, the lanes, and the table "what moved, and what held". `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WINDOW_KEYS, WINDOWS, DEFAULT_WINDOW, LANE_FOR, isWindowKey, timelineOf, swingOf, writerChanges, windowWorking, addMonths, distinctResults } from "../src/my-health/derive/timeline.ts";
import { mergeWeeks } from "../src/my-health/derive/activity.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import SWING from "../src/data/usual-swing.ts";

const TODAY = "2026-11-11";   // a Wednesday; the week in hand began on Monday 9 November

/** A year and a bit of one person: weekly doses with five empty weeks in January, three tests of one method, a change of wearable on 19 October, two blood reports. */
function person(over = {}) {
  const weeks = [];
  for (let m = "2025-09-01"; m < "2026-11-09"; m = addDays(m, 7)) {
    if (m >= "2026-01-05" && m <= "2026-02-02") continue;   // five weeks with nothing logged
    weeks.push({ week_start: m, source: "sync", synced_at: "2026-11-10T00:00:00Z", workouts: 3, dose_met_min: m < "2026-03-01" ? 760 : 1090, dose_goal_met_min: 1000, met_hours: 14, minutes: 180 });
  }
  const signals = [];
  for (let d = "2025-10-20"; d <= TODAY; d = addDays(d, 1)) {
    const whoop = d >= "2026-10-19";
    signals.push({ day: d, resting_hr: whoop ? 50 : 53, sleep_minutes: 440, steps: 8000, hrv_source: whoop ? null : "Asha's Apple Watch", steps_source: whoop ? "WHOOP" : null });
  }
  const by = new Map([
    ["ldl_mgdl", [{ d: "2026-10-20", v: 112, lo: null, hi: null, unit: "mg/dL" }, { d: "2026-03-14", v: 128, lo: null, hi: null, unit: "mg/dL" }]],
    ["hba1c_pct", [{ d: "2026-03-14", v: 5.7, lo: null, hi: null, unit: "%" }, { d: "2026-10-20", v: 5.4, lo: null, hi: null, unit: "%" }]],
    ["triglycerides_mgdl", [{ d: "2026-03-14", v: 140, lo: null, hi: null, unit: "mg/dL" }, { d: "2026-10-20", v: 120, lo: null, hi: null, unit: "mg/dL" }]],
    ["lpa_value", [{ d: "2026-03-14", v: 38, lo: null, hi: null, unit: "nmol/L" }]],
  ]);
  return {
    weeks: mergeWeeks(weeks, []), goal: 16.7,
    crf: [
      { measured_on: "2026-02-01", vo2max: 28.35, met_capacity: 8.1, method: "cooper" },
      { measured_on: "2026-09-12", vo2max: 30.45, met_capacity: 8.7, method: "cooper" },
      { measured_on: "2026-11-06", vo2max: 31.15, met_capacity: 8.9, method: "cooper" },
    ],
    signals, by,
    weights: [["2025-12-10", 77.4], ["2026-03-01", 76.9], ["2026-06-01", 76.2], ["2026-09-20", 75.7], ["2026-11-08", 75.7]].map(([measured_on, weight_kg]) => ({ measured_on, weight_kg, source: "health" })),
    ...over,
  };
}
const lane = (t, k) => t.lanes.find((l) => l.key === k);
const row = (t, k) => t.rows.find((r) => r.key === k);

test("five windows, in order, and one year opens first", () => {
  assert.deepEqual([...WINDOW_KEYS], ["1m", "3m", "6m", "1y", "3y"]);
  assert.equal(DEFAULT_WINDOW, "1y");
  assert.deepEqual(WINDOW_KEYS.map((k) => WINDOWS[k].months), [1, 3, 6, 12, 36]);
  assert.ok(isWindowKey("6m") && !isWindowKey("fitness"), "an old chapter's name is not a window");
});

test("blood work is drawn from six months up, and fitness from three", () => {
  assert.deepEqual(WINDOW_KEYS.filter((k) => WINDOWS[k].blood), ["6m", "1y", "3y"]);
  assert.deepEqual(WINDOW_KEYS.filter((k) => WINDOWS[k].fitness), ["3m", "6m", "1y", "3y"]);
  const p = person();
  const m1 = timelineOf(p, "1m", TODAY), m3 = timelineOf(p, "3m", TODAY), m6 = timelineOf(p, "6m", TODAY);
  assert.deepEqual(m1.lanes.map((l) => l.key), ["dose", "rhr", "sleep", "steps", "weight"]);
  assert.ok(!lane(m3, "ldl_mgdl") && lane(m3, "fitness"), "three months: fitness, and no blood yet");
  assert.ok(m3.notes.some((n) => n.startsWith("Blood work is drawn from six months up")));
  assert.ok(m1.notes.some((n) => n.startsWith("Fitness tests are drawn from three months up")));
  assert.ok(lane(m6, "ldl_mgdl") && lane(m6, "hba1c_pct"), "six months holds the October report");
  assert.ok(!row(m3, "ldl_mgdl") && !row(m3, "lpa_value"), "no blood row in a window that draws no blood");
});

test("one year: every lane, each on its own scale, in the page's order", () => {
  const t = timelineOf(person(), "1y", TODAY);
  assert.deepEqual(t.lanes.map((l) => l.key), ["fitness", "dose", "rhr", "sleep", "steps", "weight", "ldl_mgdl", "hba1c_pct", "triglycerides_mgdl"]);
  assert.equal(t.from, "2025-11-11");
  for (const l of t.lanes) for (const d of l.dots ?? []) assert.ok(d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1, `${l.key}: a mark inside its lane`);
  assert.deepEqual(lane(t, "fitness").dots.map((d) => d.label), ["8.1", "8.7", "8.9"]);
  assert.ok(lane(t, "ldl_mgdl").dots.every((d) => d.shape === "diamond"), "a report is a mark, never a line");
  assert.equal(lane(t, "ldl_mgdl").lines, undefined);
  assert.equal(lane(t, "ldl_mgdl").dots[0].label, "128", "the readings are in date order whatever order they were filed in");
  assert.ok(!t.lanes.some((l) => l.key === "lpa_value"), "Lp(a) has no lane");
});

test("the dose: two weeks a bar across a year, the goal as a line, a stretch with nothing logged left empty", () => {
  const t = timelineOf(person(), "1y", TODAY);
  const d = lane(t, "dose");
  assert.equal(d.sub, "MET-min · two weeks a bar");
  assert.equal(d.goal.text, "goal 1,000");
  assert.ok(d.bars.length >= 20 && d.bars.length <= 26);
  assert.equal(d.gaps.length, 1);
  assert.deepEqual(t.gap, { from: "2026-01-05", to: "2026-02-08" });
  assert.ok(d.bars.every((b) => b.h > 0), "a bar is never drawn for a week with nothing logged");
  // the last bar is the two complete weeks before the week in hand
  assert.ok(d.bars[d.bars.length - 1].title.startsWith("26 Oct to 8 Nov"));
  const r = row(t, "dose");
  assert.equal(r.now, "1,090");
  assert.equal(r.words, "Goal reached in 13 of the last 13 weeks.");
});

test("the page offers to start after a gap; started there, the window is the person's own and offers nothing more", () => {
  const p = person();
  const t = timelineOf(p, "1y", TODAY);
  const after = timelineOf(p, "1y", TODAY, { from: addDays(t.gap.to, 1) });
  assert.equal(after.custom, true);
  assert.equal(after.from, "2026-02-09");
  assert.equal(after.gap, null);
  assert.equal(lane(after, "dose").gaps.length, 0);
  // a start outside the window is not taken
  assert.equal(timelineOf(p, "1y", TODAY, { from: "2020-01-01" }).custom, false);
});

test("a change of wearable is marked on the line, and nothing is compared across it", () => {
  const p = person();
  assert.deepEqual(writerChanges(p.signals), [{ day: "2026-10-19", from: "Apple Watch", to: "WHOOP" }]);
  const t = timelineOf(p, "1y", TODAY);
  const rhr = lane(t, "rhr");
  assert.equal(rhr.marks.length, 1);
  assert.equal(rhr.marks[0].text, "new wearable, 19 Oct");
  assert.equal(rhr.lines.length, 2, "the line is in two pieces, one each side of the change");
  const r = row(t, "rhr");
  assert.equal(r.change, "—");
  assert.equal(r.words, "Not compared: the wearable changed on 19 October.");
  assert.equal(lane(t, "steps").marks.length, 0, "steps are the phone's as much as the wearable's: no mark");
  // a phone on its own is never a change of wearable
  assert.deepEqual(writerChanges(p.signals.map((s) => ({ ...s, hrv_source: null, steps_source: s.day < "2026-06-01" ? "iPhone" : "WHOOP" }))), []);
});

test("without a change of wearable the two-week averages are set side by side", () => {
  const p = person();
  p.signals = p.signals.map((s) => ({ ...s, hrv_source: null, steps_source: "WHOOP", resting_hr: s.day < "2026-06-01" ? 56 : 51 }));
  const r = row(timelineOf(p, "1y", TODAY), "rhr");
  assert.equal(r.then, "56"); assert.equal(r.now, "51"); assert.equal(r.change, "−5");
  assert.equal(r.words, "Moved down, on two-week averages.");
  const held = row(timelineOf(p, "1m", TODAY), "rhr");
  assert.equal(held.words, "Held: two-week averages within 3 beats of each other.");
});

test("a blood change is said against that marker's usual swing; a marker with none on file says so", () => {
  const t = timelineOf(person(), "1y", TODAY);
  const ldl = row(t, "ldl_mgdl");
  assert.deepEqual([ldl.then, ldl.now, ldl.change, ldl.swing], ["128", "112", "−13%", "inside"]);
  assert.equal(ldl.words, "Inside LDL's usual swing, which is about 26 to 27%.");
  const a1c = row(t, "hba1c_pct");
  assert.deepEqual([a1c.then, a1c.now, a1c.change, a1c.swing], ["5.7", "5.4", "−0.3", "edge"]);
  assert.equal(a1c.words, "At the edge of its usual swing, about 0.2 to 0.5 points at this level.");
  const tg = row(t, "triglycerides_mgdl");
  assert.equal(tg.swing, null);
  assert.match(tg.words, /^No usual swing is on file/);
  const lpa = row(t, "lpa_value");
  assert.deepEqual([lpa.then, lpa.change, lpa.quiet], ["—", "—", true]);
  assert.equal(lpa.words, "Shown once. It is largely inherited and is not drawn as a trend.");
});

test("six months: one report in the window is measured once, and the season is named", () => {
  const t = timelineOf(person(), "6m", TODAY);
  assert.equal(row(t, "ldl_mgdl").words, "Measured once in this window.");
  assert.ok(t.notes.some((n) => n.startsWith("Six months sets May beside November")));
});

test("swingOf reads the app's figures: inside, at the edge, more than", () => {
  assert.equal(swingOf("ldlC", 100, 80).state, "inside");
  assert.equal(swingOf("ldlC", 100, 74).state, "edge");
  assert.equal(swingOf("ldlC", 100, 70).state, "more");
  assert.equal(swingOf("apoB", 90, 74).state, "inside");
  assert.equal(swingOf("apoB", 90, 72).state, "more");
  assert.equal(swingOf("fastingGlucose", 100, 112).state, "inside");
  assert.equal(swingOf("fastingGlucose", 100, 116).state, "more");
  // hs-CRP is skewed: a rise has to pass about 3.2 times, a fall about two thirds
  assert.equal(swingOf("hsCRP", 1.0, 3.0).state, "inside");
  assert.equal(swingOf("hsCRP", 1.0, 3.3).state, "more");
  assert.equal(swingOf("hsCRP", 1.0, 0.4).state, "inside");
  assert.equal(swingOf("hsCRP", 1.0, 0.3).state, "more");
  assert.equal(swingOf(null, 100, 50), null);
  assert.equal(swingOf("lpa", 38, 60), null, "Lp(a) holds no swing: it is never a change");
  assert.equal(SWING.markers.lpa.trend, false);
});

test("two reports in different units are not compared", () => {
  const p = person();
  p.by.set("ldl_mgdl", [{ d: "2026-03-14", v: 3.3, lo: null, hi: null, unit: "mmol/L" }, { d: "2026-10-20", v: 112, lo: null, hi: null, unit: "mg/dL" }]);
  const r = row(timelineOf(p, "1y", TODAY), "ldl_mgdl");
  assert.equal(r.change, "—");
  assert.equal(r.words, "Not compared: the two reports use different units.");
});

test("fitness is compared only within one method", () => {
  const t = timelineOf(person(), "1y", TODAY);
  const f = row(t, "fitness");
  assert.deepEqual([f.then, f.now, f.change], ["8.1", "8.9", "+0.8"]);
  assert.equal(f.words, "Three tests of one method, each higher than the last.");
  assert.equal(lane(t, "fitness").links.length, 2);
  const p = person();
  p.crf[0].method = "six-minute-walk";
  const mixed = timelineOf(p, "1y", TODAY);
  assert.equal(row(mixed, "fitness").words, "Not compared: the two tests used different methods.");
  assert.equal(lane(mixed, "fitness").links.length, 1, "no link is drawn between two methods");
});

test("a horizon's stretch is marked on the months, clipped to the window", () => {
  const t = timelineOf(person(), "1y", TODAY, { horizons: [{ from: "2026-11-09", to: "2027-02-09", label: "Horizon to 9 Feb" }, { from: "2024-01-01", to: "2024-04-01", label: "old" }] });
  assert.equal(t.stretches.length, 1);
  assert.ok(t.stretches[0].x1 === 1 && t.stretches[0].x0 > 0.98);
  assert.ok(t.axis.length >= 5 && t.axis.every((a) => a.x >= 0 && a.x <= 1));
  assert.match(t.axis[0].label, / 25$/, "a window that crosses a new year says the year on its first month");
});

test("the Guide is sent the window as figures, with every date in words", () => {
  const w = windowWorking(timelineOf(person(), "1y", TODAY));
  assert.equal(w.name, "the last year");
  assert.equal(w.from, "11 November 2025");
  const ldl = w.movedAndHeld.find((r) => r.marker === "ldl_mgdl");
  assert.equal(ldl.thenOn, "14 March 2026");
  assert.equal(ldl.moreThanItsUsualSwing, "Inside LDL's usual swing, which is about 26 to 27%.");
  assert.deepEqual(w.wearableChangedOn, ["19 October 2026"]);
  assert.ok(!JSON.stringify(w).match(/\d{4}-\d{2}-\d{2}/), "no ISO date travels: a day the Guide names must be a number it was given");
});

test("nothing on file is an empty window, not a drawn one", () => {
  const t = timelineOf({ weeks: [], crf: [], signals: [], weights: [], by: new Map(), goal: 7.5 }, "1y", TODAY);
  assert.equal(t.empty, true);
  assert.deepEqual(t.rows, []);
});

test("every Overview section and the Horizon markers that have one lead to a lane", () => {
  for (const k of ["fitness", "vitals", "sleep", "exertion", "movement", "body"]) assert.ok(LANE_FOR[k], k);
  assert.equal(LANE_FOR.ldl, "ldl_mgdl");
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
});

test("a result filed more than once is one result: drawn once, at its first date, and never compared with itself", () => {
  // the app's entry form saves the figures already on file with every new entry, and a report's value is typed again
  // on the day it arrives: here one LDL result sits on three dates, and three triglyceride results on seven
  const p = person();
  p.by.set("ldl_mgdl", [
    { d: "2024-10-12", v: 131, lo: null, hi: null, unit: "mg/dL" },
    { d: "2026-07-20", v: 104, lo: null, hi: null, unit: "mg/dL" }, { d: "2026-07-24", v: 104, lo: null, hi: null, unit: "mg/dL" }, { d: "2026-11-02", v: 104, lo: null, hi: null, unit: "mg/dL" },
  ]);
  p.by.set("triglycerides_mgdl", [["2026-05-10", 150], ["2026-05-14", 150], ["2026-06-02", 150], ["2026-07-20", 190], ["2026-07-21", 190], ["2026-07-24", 190], ["2026-11-01", 141]].map(([d, v]) => ({ d, v, lo: null, hi: null, unit: "mg/dL" })));
  const t = timelineOf(p, "1y", TODAY);
  assert.deepEqual(lane(t, "ldl_mgdl").dots.map((q) => q.label), ["104"], "one mark, not three");
  assert.equal(row(t, "ldl_mgdl").words, "Measured once in this window.");
  assert.equal(row(t, "ldl_mgdl").nowOn, "2026-07-20", "at its first date");
  assert.deepEqual(lane(t, "triglycerides_mgdl").values.map((x) => x.v), [150, 190, 141]);
  const tg = row(t, "triglycerides_mgdl");
  assert.deepEqual([tg.then, tg.now], ["150", "141"]);
  assert.ok(t.notes.some((n) => n.startsWith("A blood result that repeats unchanged")));
  // three years: the 2024 result and the 2026 one are two results, 21 % apart
  const y3 = row(timelineOf(p, "3y", TODAY), "ldl_mgdl");
  assert.deepEqual([y3.then, y3.now, y3.change, y3.swing], ["131", "104", "−21%", "inside"]);
  // a different unit is a different result; a value that returns after another is a new one
  assert.equal(distinctResults([{ v: 3.3, unit: "mmol/L" }, { v: 3.3, unit: "mg/dL" }]).length, 2);
  assert.deepEqual(distinctResults([{ v: 5.6 }, { v: 5.4 }, { v: 5.6 }]).map((x) => x.v), [5.6, 5.4, 5.6]);
  // without a repeat, nothing is said about one
  assert.ok(!timelineOf(person(), "1y", TODAY).notes.some((n) => n.startsWith("A blood result that repeats")));
});
