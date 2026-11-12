// In depth across time (canvas "Verve, one story in four parts", board 04; redrawn on "Verve, In depth redrawn"):
// the five windows, which window shows what, a card for each marker (baseline, average, now, a scale, a dashed
// baseline, a line of averages, a band for a blood marker's usual swing), and the line that counts them. `npm test`.
// Every figure here is invented.
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
const card = (t, k) => t.cards.find((c) => c.key === k);
const row = (t, k) => t.rows.find((r) => r.key === k);
const figs = (c) => [c.baseline.value, c.middle?.value ?? null, c.now.value];
/** The same person on one wearable throughout, whose resting heart rate fell in June. */
function oneWearable() {
  const p = person();
  p.signals = p.signals.map((s) => ({ ...s, hrv_source: null, steps_source: "WHOOP", resting_hr: s.day < "2026-06-01" ? 56 : 51 }));
  return p;
}

test("five windows, in order, and one year opens first", () => {
  assert.deepEqual([...WINDOW_KEYS], ["1m", "3m", "6m", "1y", "3y"]);
  assert.equal(DEFAULT_WINDOW, "1y");
  assert.deepEqual(WINDOW_KEYS.map((k) => WINDOWS[k].months), [1, 3, 6, 12, 36]);
  assert.deepEqual(WINDOW_KEYS.map((k) => WINDOWS[k].short), ["1 mo", "3 mo", "6 mo", "1 yr", "3 yr"], "the switch's labels on a phone");
  assert.ok(isWindowKey("6m") && !isWindowKey("fitness"), "an old chapter's name is not a window");
});

test("what one point stands for: a week a bar and a week's average, a month's from a year up, three months a bar across three years", () => {
  assert.deepEqual(WINDOW_KEYS.map((k) => WINDOWS[k].bars), ["week", "week", "week", "month", "quarter"]);
  assert.deepEqual(WINDOW_KEYS.map((k) => WINDOWS[k].line), ["week", "week", "week", "month", "month"]);
  assert.deepEqual(WINDOW_KEYS.filter((k) => WINDOWS[k].days), ["1m"], "the month alone shows each day behind the line");
  const p = person();
  assert.equal(card(timelineOf(p, "1m", TODAY), "dose").how, "MET-min · a week a bar");
  assert.equal(card(timelineOf(p, "1y", TODAY), "dose").how, "MET-min a week · each month's average");
  assert.equal(card(timelineOf(p, "3y", TODAY), "dose").how, "MET-min a week · each three months' average");
  assert.equal(card(timelineOf(p, "6m", TODAY), "rhr").how, "bpm · each week's average");
  assert.equal(card(timelineOf(p, "1y", TODAY), "sleep").how, "a night · each month's average");
});

test("blood work is drawn from six months up, and fitness from three", () => {
  assert.deepEqual(WINDOW_KEYS.filter((k) => WINDOWS[k].blood), ["6m", "1y", "3y"]);
  assert.deepEqual(WINDOW_KEYS.filter((k) => WINDOWS[k].fitness), ["3m", "6m", "1y", "3y"]);
  const p = person();
  const m1 = timelineOf(p, "1m", TODAY), m3 = timelineOf(p, "3m", TODAY), m6 = timelineOf(p, "6m", TODAY);
  assert.deepEqual(m1.cards.map((c) => c.key), ["dose", "steps", "rhr", "sleep", "weight"]);
  assert.ok(!card(m3, "ldl_mgdl") && card(m3, "fitness"), "three months: fitness, and no blood yet");
  assert.ok(m3.notes.some((n) => n.startsWith("Blood work is drawn from six months up")));
  assert.ok(m1.notes.some((n) => n.startsWith("Fitness tests are drawn from three months up")));
  assert.ok(card(m6, "ldl_mgdl") && card(m6, "hba1c_pct"), "six months holds the October report");
  assert.ok(!row(m3, "ldl_mgdl") && !row(m3, "lpa_value") && m3.once === null, "no blood in a window that draws no blood");
});

test("one year: a card for each marker under four headings, and one line that counts them", () => {
  const t = timelineOf(person(), "1y", TODAY);
  assert.equal(t.from, "2025-11-11");
  assert.deepEqual(t.groups.map((g) => [g.title, g.cards.map((c) => c.key)]), [
    ["Movement", ["dose", "steps"]],
    ["Fitness and body", ["fitness", "weight"]],
    ["Heart and sleep", ["rhr", "sleep"]],
    ["Blood work · drawn from six months up", ["ldl_mgdl", "hba1c_pct", "triglycerides_mgdl"]],
  ]);
  assert.deepEqual(t.cards.map((c) => c.key), t.groups.flatMap((g) => g.cards.map((c) => c.key)));
  assert.deepEqual(t.digest.map((g) => [g.label, g.n]), [["Moved", 3], ["Held", 2], ["At the edge of its swing", 1], ["Not compared", 2], ["No swing on file", 1]]);
  assert.equal(t.digest.reduce((a, g) => a + g.n, 0), t.cards.length, "every card is counted once");
  assert.ok(!t.cards.some((c) => c.key === "lpa_value"), "Lp(a) has no card");
  assert.equal(t.once, "Lp(a) 38 nmol/L, report of 14 March 2026. Shown once: it is largely inherited and is not drawn as a trend.");
  assert.deepEqual(t.axis.map((a) => a.label), ["Dec", "Feb", "Apr", "Jun", "Aug", "Oct"], "every second month, each under its middle");
  // everything drawn sits inside its plot
  for (const c of t.cards) {
    for (const q of [...c.chart.points, ...c.chart.marks, ...c.chart.lines.flat(), ...c.chart.links.flat()]) assert.ok(q.x >= 0 && q.x <= 1 && q.y >= 0 && q.y <= 1, `${c.key}: a mark inside its plot`);
    for (const k of c.chart.ticks) assert.ok(k.y >= 0 && k.y <= 1, `${c.key}: a figure of the scale inside its plot`);
  }
});

test("one month: five cards, the body beside heart and sleep, and each day behind the line", () => {
  const t = timelineOf(person(), "1m", TODAY);
  assert.deepEqual(t.groups.map((g) => g.title), ["Movement", "Heart, sleep and body"]);
  const steps = card(t, "steps");
  assert.equal(steps.chart.days.length, 32, "a faint dot for each day of the window");
  assert.equal(steps.chart.points.length, 6, "and a point for each week's average, the week in hand among them");
  assert.match(steps.answer, /Each faint dot is a day\.$/);
  assert.equal(card(timelineOf(person(), "3m", TODAY), "steps").chart.days.length, 0, "from three months up the days are not drawn");
  const dose = card(t, "dose");
  assert.deepEqual([dose.middle.label, dose.middle.value, dose.middle.sub], ["Weeks", "5", "5 reached the goal"]);
  assert.equal(dose.answer, "Goal reached in 5 of the last 5 weeks, the bars in full colour. The week in hand is not drawn until it is whole.");
  assert.equal(dose.baseline.sub, "four weeks to 11 Oct");
});

test("every chart has a scale, and none is drawn tighter than its set span", () => {
  const t = timelineOf(person(), "1y", TODAY);
  assert.deepEqual(card(t, "rhr").chart.ticks.map((k) => k.label), ["45", "50", "55"]);
  assert.deepEqual(card(t, "steps").chart.ticks.map((k) => k.label), ["6,000", "8,000", "10,000"]);
  assert.deepEqual(card(t, "fitness").chart.ticks.map((k) => k.label), ["8", "9"]);
  assert.deepEqual(card(t, "dose").chart.ticks.map((k) => k.label), ["0", "500", "1,000"], "bars are drawn from zero");
  assert.ok(card(t, "sleep").chart.ticks.every((k) => / h$/.test(k.label)));
  // three beats across a span of sixteen is under a fifth of the chart's height, not all of it
  const ys = card(t, "rhr").chart.points.map((q) => q.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 0.2);
  // a weight that moved 1.7 kg is drawn across a span of 5 kg
  const ws = card(t, "weight").chart.points.map((q) => q.y);
  assert.ok(Math.max(...ws) - Math.min(...ws) < 0.36 && Math.max(...ws) - Math.min(...ws) > 0.3);
});

test("the dose: a month a bar across a year, the goal and the baseline as lines, a stretch with nothing logged left empty", () => {
  const t = timelineOf(person(), "1y", TODAY);
  const d = card(t, "dose");
  assert.equal(d.kind, "bars");
  assert.equal(d.chart.goal.label, "goal 1,000");
  assert.equal(d.chart.baseline.label, "baseline 760");
  assert.equal(d.chart.bars.length, 12, "thirteen months, and January has no bar");
  assert.deepEqual([d.chart.bars.filter((b) => b.reached).length, d.chart.bars.filter((b) => !b.reached).length], [9, 3], "a bar is in full colour when its average reached the goal");
  assert.ok(d.chart.bars.every((b) => b.h > 0), "a bar is never drawn for a stretch with nothing logged");
  assert.equal(d.chart.gaps.length, 1);
  assert.deepEqual(t.gap, { from: "2026-01-05", to: "2026-02-08" });
  assert.deepEqual(figs(d), ["760", "1,013", "1,090"]);
  assert.deepEqual([d.baseline.sub, d.middle.sub, d.now.sub, d.now.short], ["eight weeks to 11 Nov 25", "a week, this year", "330 more than the baseline", "330 more"]);
  assert.equal(d.answer, "Goal reached in 13 of the last 13 weeks. Bars in full colour are months whose average reached it.");
  assert.equal(d.legend, "Solid line: the goal. Dashed: the baseline.");
  assert.equal(d.state, "moved");
  const r = row(t, "dose");
  assert.deepEqual([r.then, r.now, r.words], ["760", "1,090", "Goal reached in 13 of the last 13 weeks."]);
  // within a tenth of the goal of its baseline, the dose held
  assert.equal(card(timelineOf(person(), "1m", TODAY), "dose").state, "held");
});

test("the page offers to start after a gap; started there, the window is the person's own and offers nothing more", () => {
  const p = person();
  const t = timelineOf(p, "1y", TODAY);
  const after = timelineOf(p, "1y", TODAY, { from: addDays(t.gap.to, 1) });
  assert.equal(after.custom, true);
  assert.equal(after.from, "2026-02-09");
  assert.equal(after.gap, null);
  assert.equal(card(after, "dose").chart.gaps.length, 0);
  // a start outside the window is not taken
  assert.equal(timelineOf(p, "1y", TODAY, { from: "2020-01-01" }).custom, false);
});

test("a change of wearable is marked, the line breaks, the baseline stops there, and nothing is compared across it", () => {
  const p = person();
  assert.deepEqual(writerChanges(p.signals), [{ day: "2026-10-19", from: "Apple Watch", to: "WHOOP" }]);
  const t = timelineOf(p, "1y", TODAY);
  const rhr = card(t, "rhr");
  assert.equal(rhr.chart.wearable.length, 1);
  assert.equal(rhr.chart.wearable[0].text, "new wearable, 19 Oct");
  assert.equal(rhr.chart.lines.length, 2, "the line is in two pieces, one each side of the change");
  assert.equal(rhr.chart.baseline.x0, 0);
  assert.equal(rhr.chart.baseline.x1, rhr.chart.wearable[0].x, "the dashed line stops at the mark");
  assert.deepEqual(figs(rhr), ["53", "53", "50"]);
  assert.equal(rhr.now.sub, "from a new wearable");
  assert.equal(rhr.answer, "Not compared: the wearable changed on 19 October. The baseline stops there.");
  assert.deepEqual([rhr.state, rhr.quiet], ["notCompared", true]);
  const r = row(t, "rhr");
  assert.equal(r.change, "—");
  assert.equal(r.words, "Not compared: the wearable changed on 19 October.");
  assert.equal(card(t, "steps").chart.wearable.length, 0, "steps are the phone's as much as the wearable's: no mark");
  assert.equal(card(t, "steps").chart.baseline.x1, 1);
  // a phone on its own is never a change of wearable
  assert.deepEqual(writerChanges(p.signals.map((s) => ({ ...s, hrv_source: null, steps_source: s.day < "2026-06-01" ? "iPhone" : "WHOOP" }))), []);
});

test("without a change of wearable the latest two weeks are set against the baseline", () => {
  const p = oneWearable();
  const t = timelineOf(p, "1y", TODAY);
  const c = card(t, "rhr"), r = row(t, "rhr");
  assert.deepEqual([r.then, r.now, r.change], ["56", "51", "−5"]);
  assert.equal(r.words, "Moved down by 5, on two-week averages.");
  assert.deepEqual([c.baseline.value, c.baseline.sub, c.now.value, c.now.sub, c.now.short], ["56", "two weeks to 11 Nov 25", "51", "5 lower than the baseline", "5 lower"]);
  assert.equal(c.chart.baseline.label, "baseline 56");
  assert.equal(c.chart.baseline.x1, 1, "the dashed line runs the whole window");
  assert.equal(c.chart.lines.length, 1);
  assert.equal(c.state, "moved");
  assert.equal(c.legend, "Dashed line: the baseline.");
  const held = card(timelineOf(p, "1m", TODAY), "rhr");
  assert.equal(held.answer, "Held: within 3 beats of the baseline. Each faint dot is a day.");
  assert.equal(held.state, "held");
  const steps = card(t, "steps"), sleep = card(t, "sleep");
  assert.equal(steps.answer, "Held: within 500 steps a day of the baseline.");
  assert.deepEqual([steps.middle.value, steps.middle.sub, steps.now.sub], ["8,000", "a day, this year", "the same as the baseline"]);
  assert.equal(sleep.answer, "Held: within 20 minutes a night of the baseline.");
  assert.deepEqual(figs(sleep), ["7 h 20", "7 h 20", "7 h 20"]);
});

test("weight: a month's average a point, a faint link across a stretch with no weighing, the baseline its nearest weighing", () => {
  const t = timelineOf(person(), "1y", TODAY);
  const w = card(t, "weight");
  assert.equal(w.how, "kg · each month's average");
  assert.equal(w.chart.points.length, 5);
  assert.deepEqual([w.chart.lines.length, w.chart.links.length], [0, 4], "no two of these months sit side by side");
  assert.deepEqual(figs(w), ["77.4", "76.4", "75.7"]);
  assert.deepEqual([w.baseline.sub, w.baseline.short, w.now.sub], ["weighing of 10 December 2025", "10 Dec 25", "1.7 less than the baseline"]);
  assert.equal(w.answer, "Down 1.7 kg, by less than 0.1 kg a week.");
  assert.ok(w.chart.baseline.x0 > 0, "the dashed line starts at the weighing it is, not before it");
  // many weighings in one week are one point, and neighbouring weeks are joined by the line itself
  const p = person();
  p.weights = ["2026-10-13", "2026-10-14", "2026-10-16", "2026-10-20", "2026-10-22", "2026-10-27", "2026-11-03", "2026-11-04"].map((measured_on, i) => ({ measured_on, weight_kg: 76 - i * 0.05, source: "health" }));
  const m = card(timelineOf(p, "1m", TODAY), "weight");
  assert.equal(m.chart.points.length, 4, "eight weighings in four weeks are four points");
  assert.deepEqual([m.chart.lines.length, m.chart.links.length], [1, 0]);
  assert.equal(m.chart.days.length, 0, "weight has no dots behind its line");
  assert.equal(m.answer, "Held: within half a kilogram of the baseline.");
});

test("a blood change is said against that marker's usual swing, which is a band around the baseline", () => {
  const t = timelineOf(person(), "1y", TODAY);
  const ldl = row(t, "ldl_mgdl"), cl = card(t, "ldl_mgdl");
  assert.deepEqual([ldl.then, ldl.now, ldl.change, ldl.swing], ["128", "112", "−13%", "inside"]);
  assert.equal(ldl.words, "Inside LDL's usual swing, which is about 26 to 27%.");
  assert.equal(cl.answer, "Inside LDL's usual swing, which is about 26 to 27%. The shaded band is that swing around the baseline.");
  assert.deepEqual(figs(cl), ["128", "2", "112"]);
  assert.deepEqual([cl.baseline.sub, cl.middle.label, cl.middle.sub, cl.now.sub, cl.now.short], ["report of 14 March", "Results", "each counted once", "13% under the baseline", "13% under"]);
  assert.deepEqual(cl.chart.marks.map((q) => [q.shape, q.label]), [["diamond", "128"], ["diamond", "112"]], "a report is a mark, never a line, in date order whatever order it was filed in");
  assert.equal(cl.chart.lines.length + cl.chart.links.length, 0);
  assert.equal(cl.chart.baseline.label, "baseline 128");
  assert.equal(cl.chart.baseline.x0, cl.chart.marks[0].x, "the dashed line and the band start at the baseline's own mark");
  assert.equal(cl.chart.band.x0, cl.chart.marks[0].x);
  const [first, second] = cl.chart.marks;
  assert.ok(cl.chart.band.y0 < second.y && second.y < first.y && first.y < cl.chart.band.y1, "inside the swing is inside the band");
  assert.ok(cl.chart.band.y0 > 0 && cl.chart.band.y1 < 1, "the scale holds the baseline and its swing");
  assert.equal(cl.state, "held", "inside its usual swing counts as held");

  const a1c = row(t, "hba1c_pct"), ca = card(t, "hba1c_pct");
  assert.deepEqual([a1c.then, a1c.now, a1c.change, a1c.swing], ["5.7", "5.4", "−0.3", "edge"]);
  assert.equal(ca.answer, "At the edge of its usual swing, about 0.2 to 0.5 points at this level. The lighter band is that edge.");
  assert.equal(ca.now.sub, "0.3 under the baseline");
  const inner = ca.chart.band.inner, mark = ca.chart.marks[1].y;
  assert.ok(inner && ca.chart.band.y0 < mark && mark < inner.y0, "at the edge is in the band's lighter rim");
  assert.deepEqual(ca.chart.marks.map((q) => q.above), [true, false], "a figure under the baseline is set under its mark, clear of the dashed line");
  assert.equal(ca.state, "edge");

  const tg = row(t, "triglycerides_mgdl"), ct = card(t, "triglycerides_mgdl");
  assert.equal(tg.swing, null);
  assert.match(tg.words, /^No usual swing is on file/);
  assert.equal(ct.answer, "No usual swing is on file for this marker, so no band is drawn. The two results are shown as they are.");
  assert.equal(ct.chart.band, null);
  assert.equal(ct.state, "noSwing");
  const lpa = row(t, "lpa_value");
  assert.deepEqual([lpa.then, lpa.change, lpa.quiet], ["—", "—", true]);
  assert.equal(lpa.words, "Shown once. It is largely inherited and is not drawn as a trend.");
});

test("more than its usual swing is the only blood change counted as moved, and its mark sits outside the band", () => {
  const p = person();
  p.by.set("apo_b_mgdl", [{ d: "2026-03-14", v: 100, lo: null, hi: null, unit: "mg/dL" }, { d: "2026-10-20", v: 70, lo: null, hi: null, unit: "mg/dL" }]);
  const c = card(timelineOf(p, "1y", TODAY), "apo_b_mgdl");
  assert.equal(c.state, "moved");
  assert.equal(c.answer, "More than its usual swing of about 19%. The shaded band is that swing around the baseline.");
  assert.equal(c.chart.band.inner, null, "one figure for the swing is one band");
  assert.ok(c.chart.marks[1].y < c.chart.band.y0);
  assert.equal(c.chart.marks[1].above, true, "a mark near the chart's foot keeps its figure over it, inside the plot");
});

test("six months: one report in the window is measured once, with no baseline and no band, and the season is named", () => {
  const t = timelineOf(person(), "6m", TODAY);
  const c = card(t, "ldl_mgdl");
  assert.equal(row(t, "ldl_mgdl").words, "Measured once in this window.");
  assert.deepEqual([c.baseline.value, c.baseline.sub, c.now.value, c.now.sub], ["—", "measured once in this window", "112", "report of 20 October"]);
  assert.deepEqual([c.chart.baseline, c.chart.band, c.chart.marks.length, c.state], [null, null, 1, "once"]);
  assert.ok(t.digest.some((g) => g.label === "Measured once"));
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

test("two reports in different units are not compared, and only the latest unit is drawn", () => {
  const p = person();
  p.by.set("ldl_mgdl", [{ d: "2026-03-14", v: 3.3, lo: null, hi: null, unit: "mmol/L" }, { d: "2026-10-20", v: 112, lo: null, hi: null, unit: "mg/dL" }]);
  const t = timelineOf(p, "1y", TODAY);
  const r = row(t, "ldl_mgdl"), c = card(t, "ldl_mgdl");
  assert.equal(r.change, "—");
  assert.equal(r.words, "Not compared: the two reports use different units.");
  assert.deepEqual([c.state, c.now.sub, c.chart.marks.length, c.chart.baseline, c.chart.band], ["notCompared", "in another unit", 1, null, null]);
});

test("fitness is compared only within one method", () => {
  const t = timelineOf(person(), "1y", TODAY);
  const f = row(t, "fitness"), c = card(t, "fitness");
  assert.deepEqual([f.then, f.now, f.change], ["8.1", "8.9", "+0.8"]);
  assert.equal(f.words, "Three tests of one method, each higher than the last.");
  assert.deepEqual(c.chart.marks.map((q) => q.label), ["8.1", "8.7", "8.9"]);
  assert.equal(c.chart.links.length, 2);
  assert.deepEqual(figs(c), ["8.1", "3", "8.9"]);
  assert.deepEqual([c.baseline.sub, c.middle.label, c.middle.sub, c.now.sub], ["test of 1 February", "Tests", "one method", "0.8 more than the baseline"]);
  assert.equal(c.chart.baseline.label, "baseline 8.1");
  assert.equal(c.state, "moved");
  // two tests within half a MET of each other held
  const m3 = card(timelineOf(person(), "3m", TODAY), "fitness");
  assert.equal(m3.answer, "Two tests of one method, within half a MET of each other.");
  assert.equal(m3.state, "held");
  const p = person();
  p.crf[0].method = "six-minute-walk";
  const mixed = timelineOf(p, "1y", TODAY);
  assert.equal(row(mixed, "fitness").words, "Not compared: the two tests used different methods.");
  assert.equal(card(mixed, "fitness").chart.links.length, 1, "no link is drawn between two methods");
  assert.deepEqual([card(mixed, "fitness").chart.baseline, card(mixed, "fitness").state, card(mixed, "fitness").now.sub], [null, "notCompared", "by another method"]);
});

test("three years: each month's name carries its year, and a marker with part of the window on file says when its record begins", () => {
  const t = timelineOf(person(), "3y", TODAY);
  assert.ok(t.axis.length >= 5 && t.axis.every((a) => a.x >= 0 && a.x <= 1 && / \d\d$/.test(a.label)));
  assert.equal(card(t, "rhr").begins, "The record begins on 20 October 2025.");
  assert.equal(card(t, "dose").begins, "The record begins on 1 September 2025.");
  assert.equal(card(timelineOf(person(), "1y", TODAY), "rhr").begins, null, "a record that began before the window says nothing");
});

test("the Guide is sent the window as figures, with every date in words", () => {
  const w = windowWorking(timelineOf(person(), "1y", TODAY));
  assert.equal(w.name, "the last year");
  assert.equal(w.from, "11 November 2025");
  const ldl = w.movedAndHeld.find((r) => r.marker === "ldl_mgdl");
  assert.equal(ldl.thenOn, "14 March 2026");
  assert.equal(ldl.moreThanItsUsualSwing, "Inside LDL's usual swing, which is about 26 to 27%.");
  assert.deepEqual(w.wearableChangedOn, ["19 October 2026"]);
  assert.deepEqual(w.lanes.map((l) => l.marker), ["dose", "steps", "fitness", "weight", "rhr", "sleep", "ldl_mgdl", "hba1c_pct", "triglycerides_mgdl"]);
  assert.equal(w.lanes.find((l) => l.marker === "dose").averageAcrossTheWindow, "1,013", "the average on the card is a figure the Guide was given");
  assert.equal(w.lanes.find((l) => l.marker === "ldl_mgdl").averageAcrossTheWindow, undefined, "two results have no average");
  assert.match(w.baselineIs, /^Where each marker stood when the window began/);
  assert.ok(!JSON.stringify(w).match(/\d{4}-\d{2}-\d{2}/), "no ISO date travels: a day the Guide names must be a number it was given");
});

test("nothing on file is an empty window, not a drawn one", () => {
  const t = timelineOf({ weeks: [], crf: [], signals: [], weights: [], by: new Map(), goal: 7.5 }, "1y", TODAY);
  assert.equal(t.empty, true);
  assert.deepEqual([t.rows, t.cards, t.groups, t.digest], [[], [], [], []]);
});

test("every Overview section and the Horizon markers that have one lead to a card", () => {
  for (const k of ["fitness", "vitals", "sleep", "exertion", "movement", "body"]) assert.ok(LANE_FOR[k], k);
  assert.equal(LANE_FOR.ldl, "ldl_mgdl");
  const keys = new Set(timelineOf(person(), "1y", TODAY).cards.map((c) => c.key));
  for (const k of ["fitness", "vitals", "sleep", "exertion", "movement", "body", "ldl", "hba1c", "triglycerides"]) assert.ok(keys.has(LANE_FOR[k]), `${k} leads to a card that is on the page`);
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
  assert.deepEqual(card(t, "ldl_mgdl").chart.marks.map((q) => q.label), ["104"], "one mark, not three");
  assert.equal(card(t, "ldl_mgdl").middle.value, "1");
  assert.equal(row(t, "ldl_mgdl").words, "Measured once in this window.");
  assert.equal(row(t, "ldl_mgdl").nowOn, "2026-07-20", "at its first date");
  assert.deepEqual(card(t, "triglycerides_mgdl").values.map((x) => x.v), [150, 190, 141]);
  assert.equal(card(t, "triglycerides_mgdl").middle.value, "3");
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
