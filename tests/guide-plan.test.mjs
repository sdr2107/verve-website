// The Guide's plan under node: the three questions, the climb, where a person is on it, the words, the changes, the chat's inputs. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { adherenceOf, typicalWeek } from "../src/my-health/horizon/derive.ts";
import RULES from "../src/data/plan-rules.ts";
import { heartOf } from "../src/my-health/horizon/heartBand.ts";
import {
  screenOutcome, SCREEN_QUESTIONS, SCREEN_WORDS, baseOf, aimsOf, tierOf, metPerMinute, climbOf, stepsAt, progressOf, guidePlan, applyOption, storeOf, rowsWith,
  isGuideStored, askInputs, isRedFlag, FIXED_SYMPTOM_ANSWER, RULE_LINES, loggedTypes, freezeOf, PLAN_MARKERS, testWeeksOf, lineProgress, LINES_JUDGED_FROM,
} from "../src/my-health/horizon/guidePlan.ts";

// Every figure here is invented, and so is the person: no one's weeks, fitness, steps or targets. Keep it so; this repo is public.
const H = { starts_on: "2026-11-02", ends_on: "2027-02-01", title: "Three months" };   // a Monday; thirteen complete weeks
const TODAY = "2026-11-04";                                                              // the Wednesday of the plan's first week
const TARGETS = [
  { marker: "mets", target_value: 9.0 }, { marker: "dose", target_value: 900 }, { marker: "zone2_week", target_value: 120 },
  { marker: "strength_week", target_value: 2 }, { marker: "steps", target_value: 8000 },
];

/** A synced person: eight like weeks before the plan (40 min in zone 2, 120 harder, a dose of 1,060, four aerobic sessions and one of strength), 6,480 steps a day, a fitness of 8.4 METs. */
function document({ today = TODAY, mets = 8.4, zone2 = 40, zone3 = 120, dose = 1060, strength = 1, planWeeks = [], steps = 6480, pressure = null, noWeeks = false, first = "2026-11-02" } = {}) {
  const activities = [], weeks = [], signals = [];
  const firstPlanMonday = first;
  if (!noWeeks) for (let i = 8; i >= 1; i--) {
    const monday = addDays(firstPlanMonday, -7 * i);
    const s = (day, name, type, cat, mins) => activities.push({ timestamp: `${addDays(monday, day)}T07:00:00`, activity_name: name, activity_type: type, intensity_category: cat, duration_minutes: mins, met_minutes: 200 });
    s(0, "Running", "aerobic", "vigorous", 40); s(2, "Cycling", "aerobic", "moderate", 45); s(4, "Running", "aerobic", "vigorous", 40); s(5, "Walking", "aerobic", "moderate", 50);
    for (let k = 0; k < strength; k++) s(1 + 2 * k, "Strength", "strength", "moderate", 40);
    weeks.push({ week_start: monday, source: "sync", synced_at: `${addDays(monday, 7)}T06:00:00Z`, workouts: 4 + strength, dose_met_min: dose, dose_goal_met_min: 900, zone1_min: 60, zone2_min: zone2, zone3_min: zone3, strength_sessions: strength });
  }
  // the plan's own weeks, as the app wrote them: [zone 2 minutes, harder minutes]
  // (a third figure is the week's strength sessions, two when it is not given; a fourth its steps a day, or null for a week no day of steps arrived in)
  planWeeks.forEach(([z2, z3, st = 2], i) => weeks.push({ week_start: addDays(firstPlanMonday, 7 * i), source: "sync", synced_at: `${addDays(firstPlanMonday, 7 * i + 7)}T06:00:00Z`, workouts: 5, dose_met_min: 1000, dose_goal_met_min: 900, zone1_min: 50, zone2_min: z2, zone3_min: z3, strength_sessions: st }));
  const byDay = new Map();
  for (let d = 13; d >= 0; d--) byDay.set(addDays(today, -d), steps == null ? null : steps);
  planWeeks.forEach((w, i) => { if (w.length > 3) for (let d = 0; d < 7; d++) { const day = addDays(firstPlanMonday, 7 * i + d); if (day <= today) byDay.set(day, w[3]); } });
  for (const [day, v] of [...byDay].sort((x, y) => x[0].localeCompare(y[0]))) signals.push({ day, steps: v });
  const app_labs = pressure ? [{ measured_at: `${addDays(today, -3)}T08:00:00`, sbp: pressure[0], dbp: pressure[1], source: "bp" }] : [];
  return {
    generated_at: today, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1974 },
    labs: [], imaging: [], reports: [], files: [], weeks, web_crf: [], web_body: [], app_labs, activities,
    app_crf: mets == null ? [] : [{ timestamp: "2026-10-20T08:00:00", met_capacity: mets, vo2_max_estimate: mets * 3.5, estimation_method: "field test" }],
    waist: [], profile: { weekly_met_hours_goal: 15, height_cm: 168, sex: "female", age: 52 },
    signals, weights: [], note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  };
}
const person = (o) => derivePerson(document(o));
const plan = (o = {}, extra = {}) => guidePlan({ horizon: H, targets: TARGETS, person: person(o), today: o.today ?? TODAY, ...extra });

test("the three questions decide what is offered, as the ACSM's screening sets it out", () => {
  assert.equal(SCREEN_QUESTIONS.length, 3);
  assert.equal(screenOutcome({ active: true, disease: false, symptoms: false }), "full");
  assert.equal(screenOutcome({ active: false, disease: false, symptoms: false }), "easy4");
  assert.equal(screenOutcome({ active: true, disease: true, symptoms: false }), "easy");
  assert.equal(screenOutcome({ active: false, disease: true, symptoms: false }), "none");
  for (const active of [true, false]) for (const disease of [true, false]) assert.equal(screenOutcome({ active, disease, symptoms: true }), "none", "any symptom: no plan");
  assert.match(SCREEN_WORDS.none, /See a doctor first/);
  assert.match(SCREEN_WORDS.easy, /doctor's word/);
});

test("the base is a typical week of the eight before, and the aims are the person's own targets", () => {
  const p = person();
  const base = baseOf(p, TODAY);
  assert.deepEqual({ zone2: base.zone2, harder: base.harder, dose: base.dose, aerobic: base.aerobic, strength: base.strength, steps: base.steps, weeks_read: base.weeks_read }, { zone2: 40, harder: 120, dose: 1060, aerobic: 4, strength: 1, steps: 6480, weeks_read: 8 });
  assert.deepEqual(base.types, ["running", "cycling", "walking"]);
  assert.deepEqual(loggedTypes(p, TODAY), base.types);
  const aims = aimsOf(TARGETS, p, TODAY);
  assert.deepEqual(aims, { zone2: 120, strength: 2, steps: 8000, doseFloor: 900, doseFloorFrom: "target", mets: 8.4, metsTarget: 9 });
  // no dose target: the app's weekly goal is the floor; without one, the guideline's low figure
  assert.equal(aimsOf([], p, TODAY).doseFloorFrom, "goal");
  assert.equal(aimsOf([], person({ noWeeks: true }), TODAY).doseFloor, RULES.dose.lowMetMin);
});

test("fitness picks the tier, and what a planned minute adds to the dose", () => {
  assert.equal(tierOf(null), 1); assert.equal(tierOf(8.95), 1); assert.equal(tierOf(9), 2); assert.equal(tierOf(13.9), 2); assert.equal(tierOf(14), 3);
  const per = metPerMinute(8.4);
  assert.equal(per.from, "fitness");
  assert.ok(Math.abs(per.zone2 - 4.7) < 1e-9 && Math.abs(per.harder - 6.18) < 1e-9);
  const none = metPerMinute(null);
  assert.equal(none.from, "guideline");
  assert.ok(Math.abs(none.zone2 * 150 - 500) < 1e-9 && Math.abs(none.harder * 75 - 500) < 1e-9);
});

test("the climb: ten more minutes of zone 2 a week to the target, harder minutes eased and never under the floor, the dose never under the person's", () => {
  const p = person();
  const c = climbOf({ base: baseOf(p, TODAY), aims: aimsOf(TARGETS, p, TODAY), mode: "full", noHarder: false, weeks: 13, days: 4 });
  assert.equal(c.steps.length, 13);
  assert.deepEqual(c.steps.map((s) => s.zone2), [50, 60, 70, 80, 90, 100, 110, 120, 120, 120, 120, 120, 120]);
  assert.deepEqual(c.steps.map((s) => s.harder), [120, 115, 110, 105, 100, 95, 90, 85, 85, 85, 85, 85, 85]);
  for (let i = 1; i < 13; i++) {
    assert.ok(c.steps[i].zone2 - c.steps[i - 1].zone2 <= RULES.progression.zone2StepMin, "never more than the step");
    assert.ok(c.steps[i].zone2 >= c.steps[i - 1].zone2 && c.steps[i].harder <= c.steps[i - 1].harder);
  }
  assert.ok(c.steps.every((s) => s.harder >= RULES.progression.harderFloorMin && s.dose >= 900 && s.total === s.zone2 + s.harder));
  // the dose is the typical week's, moved by the change in minutes: 1,060 + 10 × 4.7
  assert.equal(c.steps[0].dose, 1105);
  assert.ok(c.climbs && c.eases);
  // session length is the week's minutes over the days, as a ten-minute band inside 20 to 60
  assert.deepEqual([c.steps[0].lo, c.steps[0].hi], [40, 50]);
});

test("a target ten minutes a week cannot reach is said, not chased", () => {
  const v = guidePlan({ horizon: H, targets: [{ marker: "zone2_week", target_value: 300 }], person: person(), today: TODAY });
  assert.equal(v.climb[12].zone2, 170);
  assert.ok(v.notes.some((n) => /reaches 170 minutes by the date, short of your 300/.test(n)));
  assert.ok(v.why.some((w) => /does not take bigger steps/.test(w.text)));
});

test("nothing to climb: the plan holds the week", () => {
  const v = guidePlan({ horizon: H, targets: [{ marker: "dose", target_value: 900 }], person: person(), today: TODAY });
  assert.ok(v.climb.every((w) => w.zone2 === 40 && w.harder === 120));
  // the week this person brings has one strength session, and the guideline's two are the plan's: the aerobic week is what is held
  assert.match(v.lead, /What your targets ask for is one change: a second strength session\. The plan holds your aerobic week as it is\.$/);
  assert.match(guidePlan({ horizon: H, targets: [{ marker: "dose", target_value: 900 }], person: person({ strength: 2 }), today: TODAY }).lead, /The plan holds the week as it is\.$/);
});

test("a figure is rounded as the targets table rounds it, and a move smaller than half a step is not called a step", () => {
  // 7.35 is one of the figures toFixed reads a tenth low; the table shows 7.4, so the plan says 7.4
  const v = plan({ mets: 7.35 });
  assert.equal(v.why[0].head, "Your fitness is 7.4 METs.");
  assert.match(v.climbNote, /from your fitness of 7\.4 METs/);
  // a typical week of 38 minutes is planned as 40 (the plan's figures are in fives): that is rounding, and the tile does not say "Up from 38"
  const held = guidePlan({ horizon: H, targets: [{ marker: "dose", target_value: 900 }], person: person({ zone2: 38 }), today: TODAY });
  const tile = held.tiles.find((t) => t.key === "zone2");
  assert.equal(tile.big, "40 minutes in zone 2");
  assert.doesNotMatch(tile.text, /Up from/);
  // a real step is still said
  assert.match(plan().tiles.find((t) => t.key === "zone2").text, /Up from 40\./);
});

test("the second tier keeps its harder minutes; no test on file starts as the first", () => {
  const two = plan({ mets: 10.2 });
  assert.ok(two.climb.every((w) => w.harder === 120), "harder minutes are not eased from 9 METs up");
  assert.match(two.tiles.find((t) => t.key === "harder").big, /65 to 85% of heart-rate reserve/);
  const none = plan({ mets: null });
  assert.match(none.why[0].head, /No fitness test is on file/);
  assert.match(none.climbNote, /guideline's own equivalence/);
});

test("zone 2 only: the harder minutes are done in zone 2, and come back after four weeks only for someone who was not active", () => {
  const easy = plan({}, { mode: "easy" });
  assert.ok(easy.climb.every((w) => w.harder === 0));
  // 40 + 120 minutes, all in zone 2, come to less than the person's floor of 900: the plan adds its step until the week reaches it
  assert.equal(easy.climb[0].zone2, 170);
  assert.ok(easy.climb.every((w) => w.zone2 === 170 && w.dose >= 900));
  assert.match(easy.lead, /Harder minutes wait for a doctor's word/);
  assert.equal(easy.tiles.find((t) => t.key === "harder").big, "No harder minutes");
  // the reason is the person's alone: a coach reading the same plan is not told it
  assert.doesNotMatch(plan({}, { mode: "easy", self: false }).lead, /doctor/);
  const easy4 = plan({}, { mode: "easy4" });
  assert.deepEqual(easy4.climb.slice(0, 6).map((w) => w.harder), [0, 0, 0, 0, 75, 75]);
  // the minutes that come back as harder leave zone 2: the week's total does not jump, and the climb to the target goes on from there
  assert.deepEqual(easy4.climb.slice(3, 8).map((w) => [w.zone2, w.total]), [[170, 170], [95, 170], [105, 180], [115, 190], [120, 195]]);
  assert.match(easy4.lead, /You said you have not been active on three days a week, so the first four weeks are in zone 2 only\./);
  assert.match(easy.lead, /all of them in zone 2\./);
  // a pressure of 180/110 or more on file: no harder minutes, whatever the answers were
  const high = plan({ pressure: [184, 96] });
  assert.ok(high.noHarder && high.climb.every((w) => w.harder === 0));
});

test("no weeks on file: the plan starts at the guideline's smallest week", () => {
  const v = guidePlan({ horizon: H, targets: [], person: person({ noWeeks: true, steps: null, mets: null }), today: TODAY });
  assert.equal(v.climb[0].zone2, 60);
  assert.match(v.lead, /three sessions of 20 minutes/);
  assert.equal(v.tiles.find((t) => t.key === "aerobic").big, "3 sessions");
  assert.ok(!v.tiles.some((t) => t.key === "steps"), "no steps line without a steps target");
});

test("steps climb evenly to the person's number and reach it a week before the end", () => {
  const p = person();
  const base = baseOf(p, TODAY), aims = aimsOf(TARGETS, p, TODAY);
  const path = Array.from({ length: 13 }, (_, i) => stepsAt(base, aims, i, 13));
  assert.equal(path[0], 6500); assert.equal(path[11], 8000); assert.equal(path[12], 8000);
  for (let i = 1; i < 13; i++) assert.ok(path[i] >= path[i - 1]);
  assert.equal(stepsAt(base, { ...aims, steps: null }, 0, 13), null);
  assert.equal(stepsAt(base, { ...aims, steps: 6000 }, 3, 13), 6000, "a number already reached is held");
});

test("the view: the week as tiles, FITT-VP, the reasons, every week, and the lines the check-in reads", () => {
  const v = plan();
  assert.equal(v.status, "Week 1 of 13");
  assert.equal(v.weeks, 13); assert.equal(v.week, 1); assert.equal(v.firstMonday, "2026-11-02");
  assert.match(v.lead, /Your weeks come to about 1,060 MET-minutes, above your floor of 900\./);
  assert.match(v.lead, /three times the minutes in zone 2, a second strength session, and more steps/);
  assert.match(v.lead, /keeps 85 harder minutes in the week/);
  assert.deepEqual(v.tiles.map((t) => t.key), ["aerobic", "zone2", "harder", "strength", "steps", "rest"]);
  assert.equal(v.tiles[0].big, "4 sessions");
  assert.match(v.tiles[0].text, /40 to 50 minutes each\. Running, cycling or walking: the types you already log\./);
  assert.equal(v.tiles[1].big, "50 minutes in zone 2");
  assert.match(v.tiles[1].text, /Up from 40\. It reaches 120 in week 8\./);
  assert.match(v.tiles[2].text, /steps down to 85 by week 8/);
  assert.equal(v.tiles[3].big, "2 sessions");
  assert.match(v.tiles[3].text, /Whole body twice, five moves each, one to two sets\./);
  assert.deepEqual(v.fitt.map((r) => r.letter).join(""), "FITTVP");
  // frequency, intensity, time, type, volume, progression (the founder, 26 November 2026: P is Progression, not Pattern)
  assert.deepEqual(v.fitt.map((r) => r.name), ["Frequency", "Intensity", "Time", "Type", "Volume", "Progression"]);
  assert.match(v.fitt[5].now, /more minutes of zone 2 each week/, "the P row says how the plan climbs");
  assert.match(v.fitt[5].by, /Held from week 8\. Fitness tested in week 12\./);
  assert.match(v.fitt[4].by, /Never under your 900\./);
  assert.equal(v.why.length, 3);
  assert.match(v.why[0].head, /Your fitness is 8\.4 METs\./);
  assert.match(v.why[1].text, /reaches 120 in week 8 and leaves 5 weeks to hold it/);
  assert.equal(v.climb.length, 13);
  assert.deepEqual(v.climb.filter((w) => w.test).map((w) => w.week), [12]);
  assert.equal(v.climb[0].sets, "one to two sets"); assert.equal(v.climb[4].sets, "two to three sets");
  assert.deepEqual(v.rows.map((r) => [r.kind, r.n]), [["sessions_week", 6], ["zone2_min", 50], ["harder_min", 120], ["strength_week", 2], ["steps_day", 6500]]);
  // a bedtime or a line of the person's own is kept beside the plan's lines; an old exercise line is replaced
  const kept = rowsWith(v, [{ kind: "bedtime_by", label: "In bed by 23:30", n: 1410 }, { kind: "sessions_week", label: "Five sessions a week", n: 5 }, { kind: "custom", label: "Stretch on Sundays" }]);
  assert.deepEqual(kept.map((r) => r.kind), ["sessions_week", "zone2_min", "harder_min", "strength_week", "steps_day", "bedtime_by", "custom"]);
  // no sentence carries a dash used as a pause, and none says "met" for reached
  const words = [v.lead, ...v.tiles.map((t) => t.text), ...v.why.map((w) => `${w.head} ${w.text}`), ...v.moves.map((m) => m.text), v.climbNote].join(" ");
  assert.doesNotMatch(words, /—|\bmet\b/);
});

test("the plan in use keeps what it started from, and the same weeks give the same plan", () => {
  const draft = plan();
  const stored = storeOf(draft, TODAY);
  assert.ok(isGuideStored(stored));
  assert.ok(!isGuideStored({ v: 1 }) && !isGuideStored(null) && !isGuideStored({ ...stored, mode: "none" }));
  assert.equal(stored.first_monday, "2026-11-02");
  // three weeks on, with three plan weeks kept: the base is still the eight weeks before the plan, not the weeks since
  const later = "2026-11-25";
  const v = guidePlan({ horizon: H, targets: TARGETS, person: person({ today: later, planWeeks: [[52, 118], [61, 110], [70, 111]] }), today: later, stored });
  assert.equal(v.base.zone2, 40);
  assert.equal(v.status, "Week 4 of 13");
  assert.equal(v.tiles.find((t) => t.key === "zone2").big, "80 minutes in zone 2");
  assert.deepEqual(v.climb.map((w) => w.state).slice(0, 5), ["past", "past", "past", "now", "future"]);
  assert.deepEqual(JSON.stringify(guidePlan({ horizon: H, targets: TARGETS, person: person({ today: later, planWeeks: [[52, 118], [61, 110], [70, 111]] }), today: later, stored })), JSON.stringify(v));
});

test("a missed week repeats its step; two in a row step the plan back; a week above changes nothing", () => {
  const stored = storeOf(plan(), TODAY);
  const at = (today, planWeeks) => guidePlan({ horizon: H, targets: TARGETS, person: person({ today, planWeeks }), today, stored });
  // week 2 under its 60: week 3 repeats 60
  const one = at("2026-11-18", [[50, 120], [30, 100]]);
  assert.equal(one.status, "Week 3 of 13 · zone 2 asked again");
  assert.equal(one.tiles.find((t) => t.key === "zone2").big, "60 minutes in zone 2");
  assert.ok(one.notes.some((n) => /One week was under the plan's zone 2 figure, so its zone 2 minutes are asked again\. Nothing is added to a later week\./.test(n)));
  assert.ok(one.climb[2].repeats);
  // within five minutes of the figure is the figure
  assert.equal(at("2026-11-18", [[50, 120], [56, 100]]).tiles.find((t) => t.key === "zone2").big, "70 minutes in zone 2");
  // weeks 2 and 3 under: the plan steps back to week 1's figure and says so
  const two = at("2026-11-25", [[50, 120], [10, 100], [0, 0]]);
  assert.equal(two.tiles.find((t) => t.key === "zone2").big, "50 minutes in zone 2");
  assert.ok(two.notes.some((n) => /has stepped back one week/.test(n)));
  // a week far above the plan: the next step is still ten minutes
  assert.equal(at("2026-11-18", [[50, 120], [200, 100]]).tiles.find((t) => t.key === "zone2").big, "70 minutes in zone 2");
  // the weeks ahead follow from the step the person is on, and the page says when the target will not be reached
  const late = at("2027-01-27", [[50, 0], ...Array.from({ length: 11 }, () => [0, 0])]);
  assert.ok(late.notes.some((n) => /short of your 120/.test(n)));
});

test("progress before the first Monday and after the last week", () => {
  const p = person({ today: "2026-10-30" });
  const stored = { v: 1, accepted_on: "2026-10-30", first_monday: "2026-11-02", base: baseOf(p, "2026-10-30"), choices: {}, mode: "full" };
  const before = guidePlan({ horizon: H, targets: TARGETS, person: p, today: "2026-10-30", stored });
  assert.equal(before.week, 0); assert.ok(!before.started); assert.deepEqual(before.soFar, []);
  assert.ok(before.notes.some((n) => /first week starts on Monday 2 November/.test(n)));
  const c = climbOf({ base: stored.base, aims: aimsOf(TARGETS, p, "2026-10-30"), mode: "full", noHarder: false, weeks: 13, days: 4 });
  const mondays = Array.from({ length: 13 }, (_, i) => addDays("2026-11-02", 7 * i));
  assert.equal(progressOf(c, mondays, p, "2027-03-01").week, 12, "after the last week the plan holds its last week");
});

test("the changes are a closed list, each worked out by the same arithmetic, and nothing changes until one is applied", () => {
  const v = plan();
  const ids = v.options.map((o) => o.id);
  assert.deepEqual(ids, ["days-3", "days-5", "strength-3-whole", "strength-3-ppl", "strength-4-upper_lower", "strength-4-push_pull", "leave-running", "leave-cycling", "leave-walking"]);
  const five = v.options.find((o) => o.id === "days-5");
  assert.match(five.says, /Five aerobic sessions of 30 to 40 minutes\. The week's minutes stay at 170, with 50 in zone 2\./);
  assert.deepEqual(five.rows[0], { label: "Aerobic sessions", from: "4", to: "5" });
  const ppl = v.options.find((o) => o.id === "strength-3-ppl");
  assert.match(ppl.says, /Push, pull and legs, once each\. Each muscle group is loaded once a week\. That adds 1 session to your week\./);
  assert.equal(applyOption(v, "no-such"), null);
  const after = guidePlan({ horizon: H, targets: TARGETS, person: person(), today: TODAY, choices: applyOption(v, "strength-3-ppl") });
  assert.equal(after.strength.days, 3); assert.equal(after.strength.layout, "ppl");
  assert.ok(after.options.some((o) => o.id === "strength-2-whole"), "the way back is offered");
  const left = guidePlan({ horizon: H, targets: TARGETS, person: person(), today: TODAY, choices: applyOption(v, "leave-running") });
  assert.match(left.tiles[0].text, /Cycling or walking: the types you already log\./);
  assert.ok(left.options.some((o) => o.id === "types-all"));
  // a split is never offered at two days
  assert.ok(!ids.some((id) => /^strength-2-(ppl|push_pull|upper_lower)$/.test(id)));
});

test("the check-in reads the new lines from the week, and never judges harder minutes or steps", () => {
  const today = "2026-11-18";
  const p = person({ today, planWeeks: [[50, 120], [61, 110], [22, 35]] });
  const rows = [{ kind: "zone2_min", label: "70 minutes in zone 2", n: 70 }, { kind: "harder_min", label: "110 harder minutes", n: 110 }, { kind: "steps_day", label: "6,800 steps a day", n: 6800 }];
  const a = adherenceOf(rows, p, "2026-11-16", today);
  assert.deepEqual([a[0].done, a[0].of, a[0].word, a[0].tone], [22, 70, "48 min to go", "neutral"]);
  assert.deepEqual([a[1].done, a[1].of, a[1].word, a[1].tone], [35, 110, "35 of 110 min", "neutral"]);
  assert.deepEqual([a[2].done, a[2].of, a[2].tone], [6480, 6800, "neutral"]);
  const done = adherenceOf(rows, p, "2026-11-09", "2026-11-15");
  assert.equal(done[0].word, "9 min to go");
  assert.equal(done[0].tone, "caution", "a week that ended under its figure");
});

test("the chat's inputs carry the plan's figures and fixed words, the options and the rules, and nothing that names a person or an answer", () => {
  const v = plan({}, { mode: "easy" });
  const inputs = askInputs(v, TARGETS);
  const text = JSON.stringify(inputs);
  assert.doesNotMatch(text, /Asha|born|email|x@y|sex|age"/);
  assert.equal(inputs.mode, "zone 2 only");
  assert.equal(inputs.weeks.length, 13);
  assert.ok(inputs.options.length >= 5 && inputs.options.every((o) => o.id && o.says));
  assert.ok(inputs.rules.every((r) => r.id !== "screening" && r.id !== "pressure"));
  assert.equal(RULE_LINES.length, 11);
  assert.ok(RULE_LINES.every((r) => r.label && r.source && r.checked));
});

test("a question that names a symptom gets the fixed answer, not the model", () => {
  for (const q of ["I get chest pain on hills", "felt dizzy after the run", "I nearly fainted", "short of breath walking upstairs", "my heart was racing at rest", "tightness in my chest"]) assert.ok(isRedFlag(q), q);
  for (const q of ["Why so much zone 2?", "I can only train four days a week", "Can I do push and pull days instead?", "My knee hurts when I run"]) assert.ok(!isRedFlag(q), q);
  assert.match(FIXED_SYMPTOM_ANSWER, /needs a doctor/);
});

// ── 14 November 2026: boards 09 and 10 ──

const storedPlan = () => storeOf(plan(), TODAY);
const atWeek = (today, planWeeks, extra = {}) => guidePlan({ horizon: H, targets: TARGETS, person: person({ today, planWeeks }), today, stored: storedPlan(), ...extra });
const zone2Of = (v) => v.tiles.find((t) => t.key === "zone2").big;

test("a week can be won back: behind its first line, a week that also covers the next step is not asked that step twice", () => {
  // the first line is 50, 60, 70, 80. Week 2 came to 30 of 60, so week 3 is asked 60 again
  assert.equal(zone2Of(atWeek("2026-11-18", [[50, 120], [30, 100]])), "60 minutes in zone 2");
  // week 3 comes to 72: its own 60, and the 70 the first line had for it. Week 4 is back on the first line, at 80
  const won = atWeek("2026-11-25", [[50, 120], [30, 100], [72, 100]]);
  assert.equal(zone2Of(won), "80 minutes in zone 2");
  assert.equal(won.status, "Week 4 of 13", "no longer behind");
  assert.equal(won.review.outcome, "won");
  assert.match(won.review.after[0].head, /^A week won back: 80 minutes in zone 2$/);
  assert.match(won.review.after[0].text, /The week came to 72 minutes in zone 2: its own figure and the next week's as well\. So that figure is not asked twice, and the plan is back on its first line\. The plan did not ask for it\./);
  assert.match(won.review.after[1].head, /^Zone 2 reaches 120 in week 8, as first drawn$/);
  // week 3 comes to its 60 and no more: week 4 is asked 70, a week behind, and the date moves a week
  const on = atWeek("2026-11-25", [[50, 120], [30, 100], [60, 100]]);
  assert.equal(zone2Of(on), "70 minutes in zone 2");
  assert.equal(on.status, "Week 4 of 13 · zone 2 asked again");
  assert.equal(on.review.outcome, "on");
  assert.match(on.review.after[1].head, /^Zone 2 reaches 120 in week 9, not week 8$/);
  assert.match(on.review.after[1].text, /The plan had five weeks to spare at the end\. It now has four\. Your date still holds\./);
  // never past the first line: on it, a week far above changes nothing; behind it, a huge week wins back only what was lost
  assert.equal(zone2Of(atWeek("2026-11-18", [[50, 120], [200, 100]])), "70 minutes in zone 2");
  assert.equal(zone2Of(atWeek("2026-11-25", [[50, 120], [30, 100], [300, 100]])), "80 minutes in zone 2");
  // two short weeks still step the plan back, and a later week can win a week back from there
  assert.equal(zone2Of(atWeek("2026-11-25", [[50, 120], [10, 100], [0, 0]])), "50 minutes in zone 2");
  assert.equal(zone2Of(atWeek("2026-12-02", [[50, 120], [10, 100], [0, 0], [61, 100]])), "70 minutes in zone 2");
});

test("a finished week stays on the page: each line against what it was asked, where the zone 2 gap went, what it does to the plan", () => {
  assert.equal(plan().review, null, "the plan's first week has no week behind it");
  const v = atWeek("2026-11-18", [[50, 120], [30, 100]]);
  const r = v.review;
  assert.deepEqual([r.week, r.monday, r.sunday], [2, "2026-11-09", "2026-11-15"]);
  assert.deepEqual(r.lines.map((l) => [l.key, l.plan, l.done, l.word, l.state]), [
    ["sessions", "6", "5", "One short", "short"],
    ["zone2", "60 min", "30 min", "30 min short", "short"],
    ["harder", "115 min", "100 min", "15 min under", "neutral"],
    ["strength", "2", "2", "Reached", "reached"],
    ["steps", String(v.climb[1].steps.toLocaleString("en-GB")), "6,480", `${(v.climb[1].steps - 6480).toLocaleString("en-GB")} a day short`, "short"],
  ]);
  assert.equal(r.summary, "One line of five reached. The week came to 1,000 MET-minutes, above your floor of 900.");
  // 30 short: the week had 130 minutes in zone 2 or above against 175, so all 30 were not done
  assert.equal(r.gap.head, "Where the 30 minutes of zone 2 went");
  assert.deepEqual(r.gap.parts, [{ head: "30 were not done", text: "130 minutes in zone 2 or above, against the plan's 175. The week had one session fewer." }]);
  assert.equal(r.outcome, "short");
  assert.equal(r.after[0].small, "This week · week 3");
  assert.equal(r.after[0].head, "Zone 2 is asked again: 60 minutes, not 70");
  // the plan's sentence stands alone too, for Monday's email: the same words, without the week's other figures
  assert.equal(r.after[0].why, "Zone 2 was more than five minutes under its line, so the plan asks for the same zone 2 minutes again. The 30 minutes are not added to this week.");
  assert.ok(r.after[0].text.startsWith(`${r.after[0].why} `) && !/strength|steps|harder/i.test(r.after[0].why));
  assert.match(r.after[0].text, /^Zone 2 was more than five minutes under its line, so the plan asks for the same zone 2 minutes again\. The 30 minutes are not added to this week\. Harder minutes stay at 115, strength stays at 2, and steps go on to [\d,]+ a day\.$/);
  // the minutes were there, at a higher effort: 40 in zone 2 and 140 harder against 60 and 115
  const hard = atWeek("2026-11-18", [[50, 120], [40, 140]]).review;
  assert.deepEqual(hard.gap.parts, [{ head: "20 were done harder", text: "140 harder minutes against 115. The minutes were there, at a higher effort than zone 2." }]);
  // some of each
  const mixed = atWeek("2026-11-18", [[50, 120], [35, 125]]).review;
  assert.deepEqual(mixed.gap.parts.map((p) => p.head), ["15 were not done", "10 were done harder"]);
  // a week inside the plan's five minutes is reached, and has no gap to explain
  const near = atWeek("2026-11-18", [[50, 120], [56, 115]]).review;
  assert.deepEqual([near.lines[1].word, near.lines[1].state, near.gap, near.outcome], ["Within 5 min", "reached", null, "on"]);
  assert.equal(near.lines[2].word, "As planned");
  assert.equal(near.after[0].head, "The plan goes on: 70 minutes in zone 2");
  // the table of weeks: a finished week carries what it did and where it was short; a week ahead carries the plan only
  assert.deepEqual([v.climb[0].done.zone2, v.climb[0].short, v.climb[0].outcome], [50, ["sessions", "steps"], "on"]);
  assert.deepEqual([v.climb[1].done.zone2, v.climb[1].short.includes("zone2"), v.climb[1].outcome], [30, true, "short"]);
  assert.equal(v.climb[2].done, null); assert.equal(v.climb[5].done, null);
  // the chat is given the same week
  const inputs = askInputs(v, TARGETS);
  assert.equal(inputs.last_week.week, 2);
  assert.ok(inputs.last_week.lines.includes("Zone 2: plan 60 min, done 30 min. 30 min short."));
  assert.equal(askInputs(plan(), TARGETS).last_week, null);
});

test("the plan says what it does for every target, and says so when it leaves a fitness target untouched", () => {
  const v = plan();
  assert.equal(v.answers.worksHead, "The plan works on 4 of your 5 targets");
  assert.deepEqual(v.answers.works.map((a) => [a.label, a.text]), [
    ["Weekly dose", "Held above 900 every week"],
    ["Zone 2 a week", "Ten more minutes each week, 120 in week 8"],
    ["Strength a week", "2 a week, whole body"],
    ["Steps a day", `About ${v.tiles.find((t) => t.key === "steps").text.match(/About ([\d,]+) more/)[1]} more a day each week, 8,000 in week 12`],
  ]);
  assert.equal(v.answers.watchesHead, "It watches 1 and has no line for it");
  assert.deepEqual(v.answers.watches.map((a) => [a.label, a.text]), [["Fitness", "Tested in week 12"]]);
  assert.equal(v.answers.note, null, "the plan climbs, so nothing is left untouched");
  assert.ok(v.climbs);
  // a zone 2 number under the typical week, as in the recording: nothing climbs, and the plan says what that means for fitness
  const flat = guidePlan({ horizon: H, targets: [{ marker: "mets", target_value: 9.0 }, { marker: "zone2_week", target_value: 30 }, { marker: "weight", target_value: 70 }, { marker: "waist", target_value: 90 }], person: person(), today: TODAY });
  assert.equal(flat.climbs, false);
  assert.equal(flat.answers.works.find((a) => a.marker === "zone2_week").text, "Nothing to add: your 30 is under your typical 40");
  assert.deepEqual(flat.answers.watches.map((a) => [a.label, a.text]), [["Fitness", "Tested in week 12"], ["Weight", "Read every Monday"], ["Waist", "Read at each month's end"]]);
  assert.equal(flat.answers.note, 'You asked for fitness to move from 8.4 to 9.0 METs. Nothing in this plan changes your aerobic week. The plan builds only towards a zone 2 number above your typical week of 40, and yours is 30. The number is yours to change, under "Change it".');
  assert.match(flat.lead, /The plan holds your aerobic week as it is\.$/);
  // steps or strength asked for, and nothing aerobic: the lead does not say the whole week is held
  assert.match(guidePlan({ horizon: H, targets: TARGETS.map((t) => (t.marker === "zone2_week" ? { ...t, target_value: 30 } : t)), person: person(), today: TODAY }).lead, /What your targets ask for is a different mix: a second strength session and more steps\. The plan holds your aerobic week as it is\.$/);
  assert.deepEqual(flat.moves.map((m) => m.head), ["A short week", "To make it build", "The week 12 test"]);
  assert.match(flat.moves[1].text, /only towards a zone 2 number above your typical week of 40\. Yours is 30\./);
  // no zone 2 number at all
  const none = guidePlan({ horizon: H, targets: [{ marker: "mets", target_value: 9.0 }], person: person(), today: TODAY });
  assert.match(none.answers.note, /and you have set none\./);
  // how the plan moves names zone 2 minutes, never "its step": steps a day are a line of their own
  for (const view of [v, flat]) assert.doesNotMatch(view.moves.map((m) => m.text).join(" "), /repeats (that week's|its) step/);
  // steps a day and the strength sets answer their own week, and the plan says so where it says what a short week does
  assert.match(v.moves[0].text, /Steps a day and the strength sets answer their own week: under the line, the same is asked again; two weeks in a row, one step back\. Nothing is added on\. A week with no steps on file is not judged\.$/);
  // no steps number: the strength sets alone have a line of their own; and someone who already lifts twice a week has none
  assert.match(flat.moves[0].text, /The strength sets answer their own week: under the line, the same is asked again; two weeks in a row, one step back\. Nothing is added on\.$/);
  assert.match(guidePlan({ horizon: H, targets: [{ marker: "mets", target_value: 9.0 }], person: person({ strength: 2 }), today: TODAY }).moves[0].text, /Strength stays at your own number whatever zone 2 did\.$/);
  assert.deepEqual(askInputs(v, TARGETS).changing_the_numbers, v.changing);
  assert.match(v.changing[0], /^The plan's minutes in zone 2 follow your zone 2 number, now 120\. You change it under "Change it" on the plan\./);
});

test("the zone 2 number can be changed: before the plan starts it is worked out again; after, the week begun keeps what it asked and no week behind is rewritten", () => {
  const with2 = (n) => TARGETS.map((t) => (t.marker === "zone2_week" ? { ...t, target_value: n } : t));
  assert.ok(PLAN_MARKERS.has("zone2_week") && !PLAN_MARKERS.has("mets") && !PLAN_MARKERS.has("weight"));
  // not started: nothing to keep
  const p0 = person({ today: "2026-10-30" });
  const s0 = { v: 1, accepted_on: "2026-10-30", first_monday: "2026-11-02", base: baseOf(p0, "2026-10-30"), choices: {}, mode: "full" };
  const before = guidePlan({ horizon: H, targets: TARGETS, person: p0, today: "2026-10-30", stored: s0 });
  assert.equal(freezeOf(before, s0, true), s0);
  assert.equal(guidePlan({ horizon: H, targets: with2(200), person: p0, today: "2026-10-30", stored: s0 }).climb[12].zone2, 170, "ten a week from 50");

  // week 3 of a plan on its line: 50 and 61 done against 50 and 60
  const today = "2026-11-18", weeks = [[50, 120], [61, 115]];
  const stored = storedPlan();
  const v = atWeek(today, weeks);
  assert.deepEqual(v.climb.slice(0, 4).map((w) => [w.zone2, w.harder]), [[50, 120], [60, 115], [70, 110], [80, 105]]);
  const frozen = freezeOf(v, stored, true);
  assert.deepEqual(frozen.past.map((w) => [w.monday, w.zone2, w.harder, w.sessions, w.strength]), [["2026-11-02", 50, 120, 6, 2], ["2026-11-09", 60, 115, 6, 2]]);
  assert.deepEqual([frozen.leg.monday, frozen.leg.zone2, frozen.leg.harder], ["2026-11-16", 70, 110]);
  assert.ok(isGuideStored(frozen));
  // with nothing changed, the plan reads exactly as it did
  const same = guidePlan({ horizon: H, targets: TARGETS, person: person({ today, planWeeks: weeks }), today, stored: frozen });
  assert.deepEqual(same.climb.map((w) => [w.zone2, w.harder, w.steps]), v.climb.map((w) => [w.zone2, w.harder, w.steps]));
  assert.equal(same.status, v.status);
  // the number raised to 200: weeks 1 and 2 stand, week 3 keeps its 70, and the climb goes on from it
  const up = guidePlan({ horizon: H, targets: with2(200), person: person({ today, planWeeks: weeks }), today, stored: frozen });
  assert.deepEqual(up.climb.slice(0, 5).map((w) => w.zone2), [50, 60, 70, 80, 90]);
  assert.equal(up.climb[12].zone2, 170);
  assert.equal(zone2Of(up), "70 minutes in zone 2");
  assert.ok(up.notes.some((n) => /A number the plan follows was changed in week 3\. That week kept what it asked, and the weeks before it stand as they were\./.test(n)));
  // the week before the change is still read line by line, and says the week after keeps what it asked
  assert.equal(up.review.outcome, "changed");
  assert.equal(up.review.after[0].head, "The week keeps what it asked: 70 minutes in zone 2");
  assert.deepEqual(up.review.lines[1].plan, "60 min", "week 2 is read against what it was asked");
  // without the record, the same change would have rewritten the weeks behind: that is what freezeOf is for
  const rewritten = guidePlan({ horizon: H, targets: with2(30), person: person({ today, planWeeks: weeks }), today, stored });
  assert.notDeepEqual(rewritten.climb.slice(0, 2).map((w) => w.zone2), [50, 60]);
  // the number lowered under the week it is in: the weeks behind stand, and the plan holds where it is
  const down = guidePlan({ horizon: H, targets: with2(30), person: person({ today, planWeeks: weeks }), today, stored: frozen });
  assert.deepEqual(down.climb.map((w) => w.zone2), [50, 60, ...Array.from({ length: 11 }, () => 70)]);
  assert.equal(down.answers.works.find((a) => a.marker === "zone2_week").text, "Held at 70");
  // a later change keeps the first record and adds the weeks since
  const later = "2026-12-02", weeks2 = [...weeks, [70, 110], [80, 105]];
  const v2 = guidePlan({ horizon: H, targets: with2(200), person: person({ today: later, planWeeks: weeks2 }), today: later, stored: frozen });
  const again = freezeOf(v2, frozen, true);
  assert.deepEqual(again.past.map((w) => w.zone2), [50, 60, 70, 80]);
  assert.deepEqual([again.leg.monday, again.leg.zone2], ["2026-11-30", 90]);
  // a change to the days or the layout records the weeks behind and starts nothing new
  const choice = freezeOf(v, stored, false);
  assert.equal(choice.leg, undefined); assert.equal(choice.past.length, 2);
  // the plan's base is the set-up's typical week: one reader
  const t = typicalWeek(person(), TODAY), b = baseOf(person(), TODAY);
  assert.deepEqual([b.zone2, b.harder, b.dose, b.aerobic, b.strength], [t.zone2, t.harder, t.dose, t.aerobic, t.strength]);
});

test("the second question is in plain words, and says what it does not count", () => {
  assert.equal(SCREEN_QUESTIONS[1].text, "Do you have heart disease, diabetes or kidney disease?");
  assert.match(SCREEN_QUESTIONS[1].help, /High blood pressure by itself is not counted here: the plan reads your pressure from your page\./);
  assert.equal(SCREEN_QUESTIONS[0].help, undefined);
});

// ── a paused week (board 13 of "Verve, Horizon as a programme") ──

test("a paused week is not one of the plan's weeks: nothing is asked in it, and the week after asks what it would have asked", () => {
  const stored = storeOf(plan(), TODAY);
  // week 3 of the plan, Mon 16 to Sun 22 Nov, set aside; the date moved a week, so the plan still has thirteen weeks
  const PAUSED = { ...H, ends_on: "2027-02-08", ends_on_set: "2027-02-01", pauses: ["2026-11-16"] };
  const at = (h, today, planWeeks) => guidePlan({ horizon: h, targets: TARGETS, person: person({ today, planWeeks }), today, stored });
  const weeks = [[50, 120], [30, 100]];                                 // week 2 came in under its 60
  // without a pause, week 3 asks for 60 again
  const plain = at(H, "2026-11-18", weeks);
  assert.equal(plain.paused, null);
  assert.equal(plain.status, "Week 3 of 13 · zone 2 asked again");

  // in the paused week: the plan is shown as it picks up, and says the week is paused
  const during = at(PAUSED, "2026-11-18", weeks);
  assert.deepEqual(during.paused, { from: "2026-11-16", to: "2026-11-22", resumes: "2026-11-23" });
  assert.equal(during.status, "Paused this week · week 3 of 13 starts Monday 23 November");
  assert.equal(during.weeks, 13);
  assert.deepEqual(during.soFar, [], "nothing is asked of a paused week, so it has no count so far");
  assert.equal(zone2Of(during), zone2Of(plain), "week 3's lines, as they would have been");
  assert.ok(during.notes.some((n) => /^Paused, Mon 16 to Sun 22 Nov\. Nothing is asked and nothing in it is judged\. Week 3 starts on Monday 23 November/.test(n)));
  assert.ok(!during.climb.some((w) => w.monday === "2026-11-16"));
  assert.deepEqual([during.climb[2].monday, during.climb[2].state, during.climb[12].monday], ["2026-11-23", "now", "2027-02-01"]);
  // the week before the pause is the one reviewed, and what follows is named by its own day, not as "this week"
  assert.deepEqual([during.review.week, during.review.monday], [2, "2026-11-09"]);
  assert.equal(during.review.after[0].small, "Week 3 · from 23 November");

  // the Monday it picks up: week 3, the same lines, and one line that says a week was paused
  const after = at(PAUSED, "2026-11-25", weeks);
  assert.equal(after.paused, null);
  assert.equal(after.status, plain.status);
  assert.deepEqual(after.rows, plain.rows);
  assert.ok(after.notes.some((n) => n === "One week was paused and is not among the plan's weeks: Mon 16 to Sun 22 Nov."));
  // the paused week is never read against a line: the last week reviewed is still week 2
  assert.deepEqual([after.review.week, after.review.monday, after.review.after[0].small], [2, "2026-11-09", "This week · week 3"]);
});

test("a date that cannot move: the plan closes up by the paused week", () => {
  const stored = storeOf(plan(), TODAY);
  const fixed = { ...H, pauses: ["2026-11-16"] };                       // the date stays where it was
  const v = guidePlan({ horizon: fixed, targets: TARGETS, person: person({ today: "2026-11-25", planWeeks: [[50, 120], [60, 110]] }), today: "2026-11-25", stored });
  assert.equal(v.weeks, 12);
  assert.equal(v.status, "Week 3 of 12");
});

test("a number changed in a week that is then set aside is carried to the week the plan picks up in", () => {
  const stored = storeOf(plan(), TODAY);
  const today = "2026-11-18";
  const weeks = [[50, 120], [60, 110]];
  // the person changes a number the plan follows in week 3; the plan keeps that week's figures as the place it goes on from
  const before = guidePlan({ horizon: H, targets: TARGETS, person: person({ today, planWeeks: weeks }), today, stored });
  const frozen = freezeOf(before, stored, true);
  assert.equal(frozen.leg.monday, "2026-11-16");
  // then week 3 is set aside from the Monday after
  const PAUSED = { ...H, ends_on: "2027-02-08", ends_on_set: "2027-02-01", pauses: ["2026-11-16"] };
  const v = guidePlan({ horizon: PAUSED, targets: TARGETS, person: person({ today: "2026-11-25", planWeeks: weeks }), today: "2026-11-25", stored: frozen });
  assert.equal(v.status, "Week 3 of 13");
  assert.equal(zone2Of(v), zone2Of(before), "the week it picks up in asks what the paused one asked");
  assert.ok(v.notes.some((n) => /A number the plan follows was changed in week 3/.test(n)));
});

// ── 27 November 2026: the plan in the person's own numbers (canvas "Verve, the plan you follow", boards 03 and 04) ──

test("fitness is tested again in week twelve: every twelfth week, the last week of a shorter plan, and a last week six or more after", () => {
  assert.deepEqual([RULES.retest.weeks, RULES.retest.lastAfterWeeks], [12, 6]);
  const cases = [[12, [12]], [13, [12]], [17, [12]], [18, [12, 18]], [20, [12, 20]], [24, [12, 24]], [26, [12, 24]], [30, [12, 24, 30]], [52, [12, 24, 36, 48]], [8, [8]], [1, [1]], [0, []]];
  for (const [n, want] of cases) assert.deepEqual(testWeeksOf(n), want, `${n} weeks`);
  const v = plan();
  assert.deepEqual(v.testWeeks, [12]);
  assert.deepEqual(v.climb.filter((w) => w.test).map((w) => w.week), [12]);
  assert.match(v.fitt[5].by, /Fitness tested in week 12\.$/);
  assert.equal(v.moves.find((m) => /test$/.test(m.head)).head, "The week 12 test");
  assert.deepEqual(askInputs(v, TARGETS).weeks.filter((w) => w.fitness_test).map((w) => w.week), [12]);
  // a plan of six weeks tests once, at its end
  const six = guidePlan({ horizon: { starts_on: "2026-11-02", ends_on: "2026-12-14", title: "Six weeks" }, targets: TARGETS, person: person(), today: TODAY });
  assert.deepEqual([six.weeks, six.testWeeks], [6, [6]]);
  // the rule says whose choice it is, and that the app's reminder is another thing
  assert.match(RULES.retest.source, /The plan's own choice/);
  assert.match(RULES.retest.checked, /stays at eight weeks on purpose/);
  assert.doesNotMatch(RULE_LINES.find((r) => r.id === "retest").label, /eight/);
});

test("a line that climbs a rung a week: reached goes on, short is asked again, two in a row go one back, nothing arrived is not judged", () => {
  const run = (verdicts, o = {}) => lineProgress({ weeks: 8, week: verdicts.length, first: 0, from: 0, top: 7, verdict: (i) => verdicts[i], ...o });
  assert.deepEqual(run(["reached", "reached"]).rungOfWeek, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(run(["reached", "short"]), { rungOfWeek: [0, 1, 1, 2, 3, 4, 5, 6], outcomeOfWeek: ["on", "short", null, null, null, null, null, null] });
  assert.deepEqual(run(["reached", "short", "short"]).rungOfWeek.slice(0, 5), [0, 1, 1, 0, 1], "two short in a row: one rung back, then a rung a week again");
  assert.deepEqual(run(["reached", "short", "short"]).outcomeOfWeek.slice(0, 3), ["on", "short", "back"]);
  // never under the first rung; a reached week between two short ones starts the count again
  assert.deepEqual(run(["short", "short", "short", "short"]).rungOfWeek.slice(0, 5), [0, 0, 0, 0, 0]);
  assert.deepEqual(run(["reached", "short", "reached", "short"]).rungOfWeek.slice(0, 5), [0, 1, 1, 2, 2]);
  // nothing arrived: the same rung again, and it is not a miss. It does not come between two short weeks either: short, nothing, short is two in a row
  assert.deepEqual(run(["reached", "short", "none", "short"]).outcomeOfWeek.slice(0, 4), ["on", "short", "unread", "back"]);
  assert.deepEqual(run(["reached", "none", "reached"]), { rungOfWeek: [0, 1, 1, 2, 3, 4, 5, 6], outcomeOfWeek: ["on", "unread", "on", null, null, null, null, null] });
  assert.deepEqual(run(["none", "none", "none"]).rungOfWeek.slice(0, 4), [0, 0, 0, 0]);
  // weeks before the rule are read as they were asked, a rung each, and are not judged
  assert.deepEqual(run(["short", "short", "short"], { from: 2 }), { rungOfWeek: [0, 1, 2, 2, 3, 4, 5, 6], outcomeOfWeek: [null, null, "short", null, null, null, null, null] });
  // the top is never passed; the weeks before `first` carry their own number
  assert.deepEqual(run(["reached", "reached", "reached", "reached", "reached", "reached"], { top: 4 }).rungOfWeek, [0, 1, 2, 3, 4, 4, 4, 4]);
  assert.deepEqual(run(["reached", "reached", "reached", "short"], { first: 2 }).rungOfWeek.slice(0, 5), [0, 1, 2, 3, 3]);
  // a plan that has not begun: a rung a week
  assert.deepEqual(lineProgress({ weeks: 4, week: -1, first: 0, from: 0, top: 3, verdict: () => "short" }).rungOfWeek, [0, 1, 2, 3]);
});

// The plan of the fixture: steps a day climb 6,500, 6,650, 6,750, 6,900, 7,050, 7,200, 7,300 … to 8,000. Its fifth week
// begins on Monday 30 November 2026, the first week the rule judges.
const STEPS_LADDER = [6500, 6650, 6750, 6900, 7050, 7200, 7300];
const ON = [50, 120, 2];   // a week that reached zone 2 and strength
const stepsOf = (v) => v.rows.find((r) => r.kind === "steps_day").n;

test("steps a day answer their own week: reached moves up, short is asked again, two in a row step back, no day on file is not judged", () => {
  assert.equal(LINES_JUDGED_FROM, "2026-11-30");
  assert.deepEqual(plan().climb.slice(0, 7).map((w) => w.steps), STEPS_LADDER, "the ladder as first drawn");
  // the weeks before the rule are read as they were asked, whatever they did: a rung each, to the week that begins on 30 November
  const before = atWeek("2026-12-02", [[...ON, 3000], [...ON, 3000], [...ON, 3000], [...ON, 3000]]);
  assert.equal(stepsOf(before), 7050);
  assert.deepEqual(before.climb.slice(0, 5).map((w) => w.steps), STEPS_LADDER.slice(0, 5));
  assert.equal(before.review.after[0].why_steps, undefined, "the week of 23 November is not judged on steps");
  assert.match(before.review.after[0].text, /steps go on to 7,050 a day\.$/);
  // week 5 reached its 7,050: week 6 asks the next rung
  const reached = atWeek("2026-12-09", [ON, ON, ON, ON, [...ON, 7100]]);
  assert.equal(stepsOf(reached), 7200);
  assert.equal(reached.review.after[0].why_steps, "Steps reached their line, so this week asks 150 more a day.");
  // the sentence stands beside zone 2's own, and the steps are not said a second time among the week's other figures
  assert.match(reached.review.after[0].text, /^Zone 2 .+ Steps reached their line, so this week asks 150 more a day\. Harder minutes (stay at|are) \d+ and strength stays at 2\.$/);
  assert.doesNotMatch(reached.review.after[0].text, /go on to/);
  // week 5 came to 6,900 of 7,050: week 6 asks 7,050 again, and the 150 are not added
  const short = atWeek("2026-12-09", [ON, ON, ON, ON, [...ON, 6900]]);
  assert.equal(stepsOf(short), 7050);
  assert.equal(short.review.after[0].why_steps, "Steps were under their line, so the plan asks for the same 7,050 a day again.");
  assert.equal(short.review.lines.find((l) => l.key === "steps").word, "150 a day short");
  assert.equal(short.climb[5].steps, 7050); assert.equal(short.climb[6].steps, 7200, "the weeks ahead take a rung each from where the line stands");
  // two short in a row: week 7 steps back one rung, to 6,900
  const back = atWeek("2026-12-16", [ON, ON, ON, ON, [...ON, 6900], [...ON, 6800]]);
  assert.equal(stepsOf(back), 6900);
  assert.equal(back.review.after[0].why_steps, "Steps were under their line two weeks in a row, so the plan steps back to 6,900 a day.");
  assert.deepEqual(back.climb.slice(4, 7).map((w) => w.steps), [7050, 7050, 6900], "the weeks behind keep what they asked");
  // a week no day of steps arrived in is asked again, and is not a miss: the short week after it is the first of two
  const unread = atWeek("2026-12-09", [ON, ON, ON, ON, [...ON, null]]);
  assert.equal(stepsOf(unread), 7050);
  assert.equal(unread.review.after[0].why_steps, "No day of steps arrived, so the plan asks for the same 7,050 a day again.");
  assert.equal(stepsOf(atWeek("2026-12-16", [ON, ON, ON, ON, [...ON, null], [...ON, 6800]])), 7050);
  // zone 2 does not move the steps, and steps do not move zone 2
  const z2short = atWeek("2026-12-09", [ON, ON, ON, ON, [10, 100, 2, 7100]]);
  assert.equal(stepsOf(z2short), 7200);
  assert.equal(zone2Of(short), zone2Of(reached));
  // never above the person's own number, and a steps number already reached is held, not climbed
  const top = atWeek("2027-01-27", Array.from({ length: 12 }, () => [...ON, 9000]));
  assert.equal(stepsOf(top), 8000);
  const held = guidePlan({ horizon: H, targets: TARGETS.map((t) => (t.marker === "steps" ? { ...t, target_value: 6000 } : t)), person: person({ today: "2026-12-09", planWeeks: [ON, ON, ON, ON, [...ON, 6100]] }), today: "2026-12-09", stored: storedPlan() });
  assert.equal(held.review.after[0].why_steps, "Steps reached their line, and the plan holds it from here.");
  // the chat is given the same weeks
  assert.equal(askInputs(short, TARGETS).weeks[5].steps_a_day, 7050);
});

test("the strength sets answer their own week: a rung for each week the strength asked was done", () => {
  // a plan that begins on 30 November 2026, so every week of it is judged; the person lifted once a week before it
  const H2 = { starts_on: "2026-11-30", ends_on: "2027-03-01", title: "From the rule" };
  const first = "2026-11-30";
  const p0 = person({ today: "2026-11-27", first });
  const stored = storeOf(guidePlan({ horizon: H2, targets: TARGETS, person: p0, today: "2026-11-27" }), "2026-11-27");
  assert.equal(stored.first_monday, first);
  const at = (today, planWeeks) => guidePlan({ horizon: H2, targets: TARGETS, person: person({ today, planWeeks, first }), today, stored });
  const setsNow = (v) => v.strength.sets;
  // four weeks with both sessions done: week 5 moves to the higher sets, and says so
  const up = at("2026-12-30", [ON, ON, ON, ON]);
  assert.equal(setsNow(up), "two to three sets");
  assert.equal(up.review.after[0].why_strength, "Strength reached its line, so this week moves to two to three sets.");
  assert.deepEqual(up.climb.slice(0, 6).map((w) => w.sets), ["one to two sets", "one to two sets", "one to two sets", "one to two sets", "two to three sets", "two to three sets"]);
  // the fourth week was one session short: the sets stay, and the week is not counted
  const stay = at("2026-12-30", [ON, ON, ON, [50, 120, 1]]);
  assert.equal(setsNow(stay), "one to two sets");
  assert.equal(stay.review.after[0].why_strength, "Strength was under its line, so the sets stay at one to two for now.");
  assert.equal(stay.climb[5].sets, "two to three sets", "a reached week is all it takes");
  // an early short week is counted against nothing yet: no sentence, and the higher sets come a week later
  const early = at("2026-12-16", [ON, [50, 120, 1]]);
  assert.equal(early.review.after[0].why_strength, undefined);
  assert.deepEqual(early.climb.slice(0, 6).map((w) => w.sets), ["one to two sets", "one to two sets", "one to two sets", "one to two sets", "one to two sets", "two to three sets"]);
  // at the higher sets, two short weeks in a row go back to the lower
  const back = at("2027-01-13", [ON, ON, ON, ON, [50, 120, 1], [50, 120, 0]]);
  assert.equal(setsNow(back), "one to two sets");
  assert.equal(back.review.after[0].why_strength, "Strength was under its line two weeks in a row, so the sets go back to one to two.");
  assert.equal(at("2027-01-06", [ON, ON, ON, ON, [50, 120, 1]]).strength.sets, "two to three sets", "one short week at the higher sets changes nothing");
  // someone who already lifted twice a week has no ladder: two to three from the first week, whatever a week did
  const lifter = guidePlan({ horizon: H2, targets: TARGETS, person: person({ today: "2026-12-16", strength: 2, planWeeks: [ON, [50, 120, 0]], first }), today: "2026-12-16", stored: { ...stored, base: { ...stored.base, strength: 2 } } });
  assert.equal(lifter.strength.sets, "two to three sets");
  assert.equal(lifter.review.after[0].why_strength, undefined);
  assert.match(lifter.moves[0].text, /Steps a day answer their own week: under the line/);
  // the page's own words on sets say the rule
  assert.match(up.strength.hard.find(([k]) => k === "Sets")[1], /One to two until the strength sessions asked have been done in four weeks of the plan\. Two to three after\./);
  // the fixture's first plan began before the rule: its first four weeks count as asked, so week 5 is at the higher sets as it always was
  assert.equal(atWeek("2026-12-02", [ON, [50, 120, 0], [50, 120, 0], [50, 120, 0]]).strength.sets, "two to three sets");
});

test("a plan changed midway keeps what its weeks asked, and the lines go on from the week of the change", () => {
  // week 5 was short on steps, so week 6 (the week of 7 December) asks 7,050 again; in it the person changes their zone 2 number
  const weeks = [ON, ON, ON, ON, [...ON, 6900]];
  const today = "2026-12-09";
  const v = atWeek(today, weeks);
  assert.equal(stepsOf(v), 7050);
  const frozen = freezeOf(v, storedPlan(), true);
  assert.deepEqual(frozen.past.map((w) => w.steps), [6500, 6650, 6750, 6900, 7050], "the finished weeks are written down as they were asked");
  assert.deepEqual([frozen.leg.monday, frozen.leg.steps], ["2026-12-07", 7050], "the week of the change keeps the figure it was asked");
  const after = guidePlan({ horizon: H, targets: TARGETS.map((t) => (t.marker === "zone2_week" ? { ...t, target_value: 150 } : t)), person: person({ today, planWeeks: weeks }), today, stored: frozen });
  assert.deepEqual(after.climb.slice(0, 6).map((w) => w.steps), [6500, 6650, 6750, 6900, 7050, 7050]);
  assert.equal(after.review.after[0].why_steps, undefined, "the week before a change is not read against the new line");
  // the climb goes on from the week of the change: a rung a week from 7,050, reached moves up, short is asked again
  const next = (w6) => guidePlan({ horizon: H, targets: TARGETS.map((t) => (t.marker === "zone2_week" ? { ...t, target_value: 150 } : t)), person: person({ today: "2026-12-16", planWeeks: [...weeks, w6] }), today: "2026-12-16", stored: frozen });
  const moved = next([...ON, 7100]), again = next([...ON, 7000]);
  assert.ok(stepsOf(moved) > 7050 && stepsOf(moved) <= 8000);
  assert.equal(stepsOf(again), 7050);
  assert.equal(again.review.after[0].why_steps, "Steps were under their line, so the plan asks for the same 7,050 a day again.");
  assert.deepEqual(moved.climb.slice(0, 5).map((w) => w.steps), [6500, 6650, 6750, 6900, 7050], "nothing behind the change is rewritten");
});

test("where the fitness figure puts the person: the figure and its test, the tier, their own aim, and the three tiers with theirs marked", () => {
  const v = plan();
  assert.deepEqual(v.place.fitness, { big: "8.4 METs", small: "Field test · 20 October" });
  assert.deepEqual(v.place.tier, { n: 1, big: "Tier 1 of 3", small: "Under 9 METs: build minutes at a steady effort first." });
  assert.deepEqual(v.place.aim, { big: "9.0 METs", small: "Your own target · tested again in week 12" });
  assert.deepEqual(v.place.tiers.map((t) => [t.head, t.here]), [["Tier 1 · under 9 METs", true], ["Tier 2 · 9 to 14 METs", false], ["Tier 3 · 14 METs and over", false]]);
  assert.equal(v.place.tiers.filter((t) => t.here).length, 1);
  // what a test does, as the plan does it: in the second tier the harder minutes are no longer eased
  assert.equal(v.place.note, "The tier is read from the latest fitness test on file. At 9.0 METs or more it is tier 2: the harder minutes are then at 65 to 85% of heart-rate reserve, and the plan stops easing them.");
  const two = plan({ mets: 10.2 });
  assert.deepEqual([two.place.tier.big, two.place.tiers.find((t) => t.here).n], ["Tier 2 of 3", 2]);
  assert.match(two.place.note, /At 14\.0 METs or more it is tier 3\. The plan asks the same minutes in both\.$/);
  assert.ok(plan().climb.some((w) => w.harder < plan().climb[0].harder) && two.climb.every((w) => w.harder === two.climb[0].harder), "the note is true of the climb: eased in tier 1, held in tier 2");
  const three = plan({ mets: 14.5 });
  assert.deepEqual(three.climb.map((w) => [w.zone2, w.harder]), plan({ mets: 13.9 }).climb.map((w) => [w.zone2, w.harder]), "tiers 2 and 3 ask the same minutes");
  assert.match(three.place.note, /This is the highest tier\.$/);
  // no test on file: the first tier, and the page says a test would place them
  const none = plan({ mets: null });
  assert.deepEqual(none.place.fitness, { big: "No test on file", small: "A fitness test places you in a tier." });
  assert.equal(none.place.tier.small, "With no test on file the plan starts as tier 1: minutes at a steady effort first.");
  // no fitness target: no aim is drawn; a viewer reads "their"
  assert.equal(guidePlan({ horizon: H, targets: TARGETS.filter((t) => t.marker !== "mets"), person: person(), today: TODAY }).place.aim, null);
  assert.match(plan({}, { self: false }).place.aim.small, /^Their own target/);
});

test("the Intensity card: beats for the person's own heart when the app's band is handed in, effort when the app was told so, and never a beat for anyone else", () => {
  const plain = plan();
  const I = (v) => v.fitt.find((r) => r.name === "Intensity");
  // nothing handed in (a coach, a viewer, the function's chat): the card as it was, and what the effort feels like
  assert.equal(I(plain).now, "Zone 2 for 50 of 170 minutes. The rest harder.");
  assert.equal(I(plain).note, "Steady: you can talk in full sentences. Harder: talking is broken into phrases.");
  assert.equal(plain.effortWhere, null);
  assert.doesNotMatch(JSON.stringify(plain.fitt), /beats|bpm/);
  // the band of someone aged 44 with a resting rate of 62: 108 to 131, from a maximum of 177
  const heart = heartOf({ age: 44, resting_hr: 62 }, TODAY);
  const mine = plan({}, { heart });
  assert.equal(I(mine).now, "Zone 2 is 108 to 131 beats a minute for you, for 50 of 170 minutes. The rest harder.");
  assert.match(I(mine).by, /^The same range, for \d+ of \d+ minutes$/);
  assert.match(I(mine).note, /^Steady: you can talk in full sentences\. Harder: talking is broken into phrases\. 40 to 60% of your heart-rate reserve: a maximum of 177 for your age, less 62 at rest\. The app counts your zone 2 minutes against the same range\./);
  assert.match(mine.effortWhere, /Settings, then Profile, then "Heart-rate medication"/);
  // only the card and its line change: every figure of the plan is the same
  assert.deepEqual({ ...mine, fitt: null, effortWhere: null, heartKind: null }, { ...plain, fitt: null, effortWhere: null, heartKind: null });
  assert.deepEqual([plain.heartKind, mine.heartKind], [null, "beats"]);
  assert.deepEqual(mine.fitt.filter((r) => r.name !== "Intensity"), plain.fitt.filter((r) => r.name !== "Intensity"));
  // the app was told heart rate is not a guide: effort, no beats, and no medicine is named
  const effort = plan({}, { heart: heartOf({ age: 44, resting_hr: 62, on_beta_blockers: true }, TODAY) });
  assert.equal(I(effort).now, "A steady effort for 50 of 170 minutes. The rest harder.");
  assert.match(I(effort).note, /Guided by effort, not by heart rate, as you set in the app\./);
  assert.doesNotMatch(JSON.stringify(effort.fitt), /beats a minute|beta|medic/i);
  assert.equal(effort.effortWhere, null);
  // no age on the profile: no beats, and the card says why
  const noAge = plan({}, { heart: heartOf({ resting_hr: 62 }, TODAY) });
  assert.equal(I(noAge).now, I(plain).now);
  assert.match(I(noAge).note, /Your age is not on your profile, so the range in beats cannot be worked out\./);
  // a reader who is not the person is never shown beats, whatever is handed in
  const viewer = plan({}, { heart, self: false });
  assert.doesNotMatch(JSON.stringify(viewer.fitt), /beats/);
  assert.equal(viewer.effortWhere, null);
  // zone 2 only: the card has no "harder" to describe
  const easy = guidePlan({ horizon: H, targets: TARGETS, person: person(), today: TODAY, mode: "easy", heart });
  assert.match(I(easy).now, /^Zone 2 is 108 to 131 beats a minute for you, for all \d+ minutes\.$/);
  assert.equal(I(easy).note.includes("Harder:"), false);
  // the chat is given the card's two cells, as before
  assert.equal(askInputs(mine, TARGETS).fitt[1].this_week, I(mine).now);
});

