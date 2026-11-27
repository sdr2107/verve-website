// Horizon, made simple (the founder, 27 November 2026): one page, two tabs. "This week" is five rows and the week's
// sessions; "Past weeks" is one row a finished week. Nothing is counted a second way. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { doneOf } from "../src/my-health/horizon/guidePlan.ts";
import { lightWeekOf, loggedLines, finishedWeekOf } from "../src/my-health/horizon/lightWeek.ts";
import {
  thisWeek, pastWeeks, sessionRows, headLine, firstWeekLine, fitnessLine, nextTestWeek,
  ROW_LABEL, PAST_LABEL, NOTHING_YET, NO_TEST,
} from "../src/my-health/horizon/simple.ts";

// Set on Tuesday 17 November 2026: six days, then thirteen weeks from Monday. Week 2 is Mon 30 Nov to Sun 6 Dec.
const H = { starts_on: "2026-11-17", ends_on: "2027-02-22", title: "Build fitness" };
const MON = "2026-11-30", THU = "2026-12-03";
const PLAN = [{ kind: "sessions_week", label: "Five sessions", n: 5 }, { kind: "zone2_min", label: "Zone 2", n: 110 }, { kind: "harder_min", label: "Harder", n: 20 }, { kind: "strength_week", label: "Strength", n: 2 }, { kind: "steps_day", label: "Steps", n: 6800 }];
const TARGETS = [{ marker: "dose", target_value: 1000 }, { marker: "zone2_week", target_value: 150 }, { marker: "steps", target_value: 8000 }, { marker: "strength_week", target_value: 2 }, { marker: "mets", target_value: 9.4, start_value: 8.4 }];

/**
 * An invented person, Asha. A session is [day offset from Monday 30 November, name, kind, minutes, zone 2 minutes or
 * null]. `steps` are a day's steps, for `signalDays` days from that Monday, and for every day of the week before when
 * `lastWeekSteps` is given. `crf` are fitness readings: [date, METs].
 */
function person({ sessions = [[0, "Badminton", "aerobic", 45, 24], [1, "Outdoor Walk (watch)", "aerobic", 30, 18], [2, "Strength", "strength", 25, null]], earlier = [], steps = 6900, signalDays = 3, lastWeekSteps = null, crf = [["2026-11-10", 8.4]] } = {}) {
  const activities = [], signals = [];
  const add = ([off, name, kind, min, z2]) => activities.push({ timestamp: `${addDays(MON, off)}T07:00:00`, activity_name: name, activity_type: kind, intensity_category: "moderate", duration_minutes: min, met_minutes: min * 5, ...(z2 != null ? { zone2_minutes: z2 } : {}) });
  for (const s of [...earlier, ...sessions]) add(s);
  for (let i = 0; i < signalDays; i++) signals.push({ day: addDays(MON, i), steps });
  if (lastWeekSteps != null) for (let i = -7; i < 0; i++) signals.push({ day: addDays(MON, i), steps: lastWeekSteps });
  return derivePerson({
    generated_at: THU, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1981 },
    labs: [], imaging: [], reports: [], files: [], weeks: [], web_crf: [], web_body: [], app_labs: [], activities, waist: [],
    app_crf: crf.map(([d, m]) => ({ timestamp: `${d}T08:00:00`, met_capacity: m, vo2_max_estimate: m * 3.5, estimation_method: "cooper-test" })),
    profile: { weekly_met_hours_goal: 15, height_cm: 160, sex: "female", age: 45 },
    signals, weights: [], note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  });
}
const now = (o = {}, extra = {}) => thisWeek({ horizon: H, person: person(o), today: THU, rows: PLAN, targets: TARGETS, asks: true, ...extra });
const say = (r) => [r.label, r.figure, r.unit, r.extra, r.reached, r.note];

// ── this week ──

test("this week is five rows, always the same five in the same order, each done of asked", () => {
  const w = now();
  assert.deepEqual([w.from, w.to, w.week, w.weeks, w.judged, w.arrived, w.line], ["2026-11-30", "2026-12-06", 2, 13, true, true, null]);
  assert.deepEqual(w.rows.map((r) => r.key), ["zone2", "strength", "steps", "dose", "fitness"]);
  assert.deepEqual(w.rows.map(say), [
    ["Zone 2", "42 of 110", "min", null, false, null],
    ["Strength", "1 of 2", "sessions", "25 min", false, null],
    ["Steps", "6,900 of 6,800", "a day", null, true, null],
    // the dose is the person's own number against the week's own dose: the two aerobic sessions, 225 and 150
    ["Weekly dose", "375 of 1,000", "MET-min", null, false, null],
    ["Fitness", "8.4", "METs", null, false, "Started at 8.4 · goal 9.4 · test in week 12"],
  ]);
  // a bar for each of the four weekly rows, none for fitness; a row over its line is a full bar, never more
  assert.deepEqual(w.rows.map((r) => (r.share == null ? null : Math.round(r.share * 100))), [38, 50, 100, 38, null]);
});

test("nothing is counted a second way: the three amounts are the light week's own, and the dose is the plan's reader's", () => {
  const p = person();
  const light = lightWeekOf({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS });
  const w = thisWeek({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS, asks: true });
  for (const [mine, theirs] of [["zone2", "aerobic"], ["strength", "strength"], ["steps", "steps"]]) {
    const a = light.amounts.find((x) => x.key === theirs), r = w.rows.find((x) => x.key === mine);
    assert.equal(r.figure, a.figure, mine);
    assert.equal(r.reached, a.reached, mine);
  }
  assert.equal(w.rows[3].figure, `${doneOf(p, MON).dose} of 1,000`);
});

test("a figure that has not arrived is left out: the row says what is asked, never a nought", () => {
  const w = now({ sessions: [], signalDays: 0 });
  assert.equal(w.arrived, false);
  assert.deepEqual(w.rows.slice(0, 4).map(say), [
    ["Zone 2", "110", "min asked", null, false, null],
    ["Strength", "2", "sessions asked", null, false, null],
    ["Steps", "6,800", "a day asked", null, false, null],
    ["Weekly dose", "1,000", "MET-min asked", null, false, null],
  ]);
  for (const r of w.rows) assert.equal(/^0\b/.test(r.figure ?? ""), false, r.key);
  // sessions arrived and no day of steps: the steps row waits, the others count
  const noSteps = now({ signalDays: 0 });
  assert.deepEqual(say(noSteps.rows[2]), ["Steps", "6,800", "a day asked", null, false, null]);
  assert.equal(noSteps.rows[0].figure, "42 of 110");
  // no fitness test on file: the row says so, with the goal and the test's week
  assert.deepEqual(say(now({ crf: [] }).rows[4]), ["Fitness", null, "", null, false, "No test on file yet · goal 9.4 · test in week 12"]);
  assert.equal(NO_TEST, "No test on file yet");
});

test("a row the horizon does not ask for still shows what was done, with no of", () => {
  const w = thisWeek({ horizon: H, person: person(), today: THU, rows: [], targets: [{ marker: "zone2_week", target_value: 150 }], asks: true });
  assert.deepEqual(w.rows.map(say), [
    ["Zone 2", "42 of 150", "min", null, false, null],
    ["Strength", "1", "session", "25 min", false, null],
    ["Steps", "6,900", "a day", null, false, null],
    ["Weekly dose", "375", "MET-min", null, false, null],
    ["Fitness", "8.4", "METs", null, false, null],
  ]);
  assert.deepEqual(w.rows.map((r) => r.share == null), [false, true, true, true, true]);
  // nothing done and nothing asked: words, not a nought
  const none = thisWeek({ horizon: H, person: person({ sessions: [[0, "Badminton", "aerobic", 45, 24]] }), today: THU, rows: [], targets: [], asks: true });
  assert.deepEqual(say(none.rows[1]), ["Strength", null, "", null, false, NOTHING_YET]);
});

test("a week that is not judged shows what was done and says why in one line", () => {
  // the short first week: Tuesday 17 to Sunday 22 November
  const early = [[-12, "Walk", "aerobic", 30, 20], [-11, "Strength", "strength", 20, null]];
  const short = thisWeek({ horizon: H, person: person({ sessions: [], earlier: early, signalDays: 0 }), today: "2026-11-20", rows: PLAN, targets: TARGETS, asks: true });
  assert.deepEqual([short.week, short.judged, short.line], [null, false, "A short first week, Tue 17 to Sun 22 Nov: it is not judged."]);
  assert.deepEqual(short.rows.slice(0, 4).map(say), [
    ["Zone 2", "20", "min", null, false, null],
    ["Strength", "1", "session", "20 min", false, null],
    ["Steps", null, "", null, false, NOTHING_YET],
    ["Weekly dose", "150", "MET-min", null, false, null],
  ]);
  // a week set aside
  const paused = thisWeek({ horizon: { ...H, pauses: [MON] }, person: person(), today: THU, rows: PLAN, targets: TARGETS, asks: true });
  assert.deepEqual([paused.judged, paused.line, paused.rows[0].figure], [false, "This week is set aside: nothing is asked.", "42"]);
  // a Guide's plan that has not begun says when it does
  const waiting = now({}, { asks: false, startsOn: "2026-12-07" });
  assert.deepEqual([waiting.judged, waiting.line, waiting.rows[0].figure], [false, "The plan begins on Monday 7 December.", "42"]);
});

test("a kept horizon shows the figures as they stand and asks nothing", () => {
  const w = now({}, { asks: false });
  assert.equal(w.judged, false);
  assert.equal(w.line, null);
  assert.deepEqual(w.rows.map((r) => r.figure), ["42", "1", "6,900", "375", "8.4"]);
  assert.equal(w.rows.some((r) => / of /.test(r.figure ?? "") || / asked$/.test(r.unit)), false);
  // no test is promised to it
  assert.equal(w.rows[4].note, "Started at 8.4 · goal 9.4");
});

// ── what you did ──

test("what you did: the week's sessions, oldest first, each with what it counted as in a few words", () => {
  const p = person({ sessions: [[2, "Strength", "strength", 25, null], [0, "Badminton", "aerobic", 45, 24], [1, "Outdoor Walk (watch)", "aerobic", 30, 0], [3, "Yoga", "flexibility", 40, null], [3, "", "aerobic", 0, 12]] });
  const rows = sessionRows(p, MON, addDays(MON, 7));
  assert.deepEqual(rows.map((r) => [r.day, r.name, r.minutes, r.counted]), [
    ["Mon", "Badminton", "45 min", "24 zone 2 min"],
    ["Tue", "Outdoor walk", "30 min", "active time"],
    ["Wed", "Strength", "25 min", "1 strength session"],
    ["Thu", "Yoga", "40 min", "no heart rate"],
    ["Thu", "A session", "", "12 zone 2 min"],
  ]);
  // the rule is the light week's own: the same sessions, the same kinds
  const theirs = loggedLines(p, MON, addDays(MON, 7));
  assert.deepEqual(rows.map((r) => r.kind).sort(), theirs.map((l) => l.kind).sort());
  assert.equal(rows.length, theirs.length);
  for (const r of rows) assert.equal(/\.$/.test(r.counted), false, "a few words, never a sentence");
  assert.deepEqual(sessionRows(p, addDays(MON, 7), addDays(MON, 14)), []);
});

// ── past weeks ──

const LAST = [[-7, "Walk", "aerobic", 40, 35], [-6, "Strength", "strength", 30, null], [-5, "Swim", "aerobic", 30, 30], [-4, "Strength", "strength", 20, null], [-2, "Walk", "aerobic", 45, 40]];

test("past weeks: one row a finished, judged week, newest first, with what it did of what it was asked", () => {
  const p = person({ earlier: LAST, lastWeekSteps: 6700 });
  const weeks = pastWeeks({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS, asks: true });
  // the short first week is not a row; the week in progress is not one either
  assert.deepEqual(weeks.map((w) => [w.week, w.from, w.to, w.dates]), [[1, "2026-11-23", "2026-11-29", "Mon 23 to Sun 29 Nov"]]);
  const w = weeks[0];
  assert.deepEqual(w.cells.map((c) => [c.label, c.text, c.asked, c.reached]), [
    ["Zone 2", "105 of 110", true, false],
    ["Strength", "2 of 2", true, true],
    ["Steps", "6,700 of 6,800", true, false],
    ["Dose", "575 of 1,000", true, false],
  ]);
  assert.equal(w.count, "1 of 4 reached");
  assert.deepEqual(w.sessions.map((s) => `${s.day} ${s.name} ${s.minutes} ${s.counted}`), ["Mon Walk 40 min 35 zone 2 min", "Tue Strength 30 min 1 strength session", "Wed Swim 30 min 30 zone 2 min", "Thu Strength 20 min 1 strength session", "Sat Walk 45 min 40 zone 2 min"]);
  // the figures are the finished week's own, as Monday's email reads them
  const fin = finishedWeekOf({ horizon: H, person: p, monday: "2026-11-23", rows: PLAN, targets: TARGETS });
  assert.deepEqual(fin.amounts.map((a) => `${a.done} of ${a.of}`), w.cells.slice(0, 3).map((c) => c.text.replace(/,/g, "")));
  assert.deepEqual(Object.values(PAST_LABEL), ["Zone 2", "Strength", "Steps", "Dose"]);
  // two finished weeks: the newer one first
  const later = pastWeeks({ horizon: H, person: p, today: "2026-12-08", rows: PLAN, targets: TARGETS, asks: true });
  assert.deepEqual(later.map((x) => x.week), [2, 1]);
});

test("a week of the Guide's plan is read against the line the plan kept for it; a week before the plan was asked nothing", () => {
  const p = person({ earlier: LAST, lastWeekSteps: 6700 });
  const climb = [{ monday: "2026-11-23", zone2: 100, strengthDays: 2, steps: 6650 }];
  const [w] = pastWeeks({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS, climb, asks: true });
  // 105 of the 100 that week asked, not of today's 110; and the plan's five minutes of allowance is its own
  assert.deepEqual(w.cells.map((c) => [c.text, c.reached]), [["105 of 100", true], ["2 of 2", true], ["6,700 of 6,650", true], ["575 of 1,000", false]]);
  assert.equal(w.count, "3 of 4 reached");
  const [within] = pastWeeks({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS, climb: [{ ...climb[0], zone2: 108 }], asks: true });
  assert.deepEqual([within.cells[0].text, within.cells[0].reached], ["105 of 108", true]);
  // the plan began after this week: it shows what the week did, and counts nothing
  const [before] = pastWeeks({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS, climb: [], asks: true });
  assert.deepEqual(before.cells.map((c) => [c.text, c.asked]), [["105", false], ["2", false], ["6,700", false], ["575", false]]);
  assert.equal(before.count, null);
});

test("a kept horizon's past weeks show what each did, with no of and no count; an empty week shows no noughts", () => {
  const p = person({ earlier: LAST, lastWeekSteps: 6700 });
  const [w] = pastWeeks({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS, asks: false });
  assert.deepEqual(w.cells.map((c) => c.text), ["105", "2", "6,700", "575"]);
  assert.equal(w.count, null);
  const [empty] = pastWeeks({ horizon: H, person: person({ sessions: [], signalDays: 0 }), today: THU, rows: PLAN, targets: TARGETS, asks: false });
  assert.deepEqual(empty.cells.map((c) => c.text), [null, null, null, null]);
  assert.deepEqual(empty.sessions, []);
});

test("before a week is finished the page says when the first full week ends", () => {
  assert.deepEqual(pastWeeks({ horizon: H, person: person(), today: "2026-11-26", rows: PLAN, targets: TARGETS, asks: true }), []);
  assert.equal(firstWeekLine(H, "2026-11-26"), "The first full week ends on Sunday 29 November.");
  assert.equal(firstWeekLine(H, "2026-11-29"), "The first full week ends on Sunday 29 November.");
  assert.equal(firstWeekLine(H, "2026-11-30"), null);
  assert.equal(firstWeekLine({ starts_on: "2026-11-17", ends_on: "2026-11-20" }, "2026-11-18"), null);
});

// ── the header, and fitness ──

test("the header is one line, and fitness is one line: the start, a reading since, and the next test's week", () => {
  assert.equal(headLine(H, THU), "Week 2 of 13 · to 22 February");
  assert.equal(headLine(H, "2026-11-20"), "A short first week · to 22 February");
  assert.equal(headLine({ ...H, pauses: [MON] }, THU), "Paused this week · to 22 February");
  // thirteen weeks: one test, in week 12 (guidePlan.ts testWeeksOf)
  assert.equal(nextTestWeek(H, THU), 12);
  assert.equal(nextTestWeek(H, "2026-11-20"), 12);
  assert.equal(nextTestWeek(H, "2027-02-20"), null, "week 13 is after the plan's only test");
  const args = (o = {}, extra = {}) => ({ horizon: H, person: person(o), today: THU, targets: TARGETS, asks: true, ...extra });
  assert.equal(fitnessLine(args()), "Fitness: 8.4 METs at the start · next test in week 12.");
  assert.equal(fitnessLine(args({ crf: [["2026-11-10", 8.4], ["2026-12-01", 8.9]] })), "Fitness: 8.4 METs at the start · 8.9 METs on 1 December · next test in week 12.");
  assert.equal(fitnessLine(args({}, { asks: false })), "Fitness: 8.4 METs at the start.");
  assert.equal(fitnessLine(args({ crf: [] }, { targets: [] })), "Fitness: no test on file yet.");
  assert.equal(fitnessLine(args({}, { targets: [] })), "Fitness: 8.4 METs.");
  assert.deepEqual(Object.values(ROW_LABEL), ["Zone 2", "Strength", "Steps", "Weekly dose", "Fitness"]);
});
