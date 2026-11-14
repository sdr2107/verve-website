// The Guide's plan under node: the three questions, the climb, where a person is on it, the words, the changes, the chat's inputs. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { adherenceOf, typicalWeek } from "../src/my-health/horizon/derive.ts";
import RULES from "../src/data/plan-rules.ts";
import {
  screenOutcome, SCREEN_QUESTIONS, SCREEN_WORDS, baseOf, aimsOf, tierOf, metPerMinute, climbOf, stepsAt, progressOf, guidePlan, applyOption, storeOf, rowsWith,
  isGuideStored, askInputs, isRedFlag, FIXED_SYMPTOM_ANSWER, RULE_LINES, loggedTypes, freezeOf, PLAN_MARKERS,
} from "../src/my-health/horizon/guidePlan.ts";

// Every figure here is invented, and so is the person: no one's weeks, fitness, steps or targets. Keep it so; this repo is public.
const H = { starts_on: "2026-11-02", ends_on: "2027-02-01", title: "Three months" };   // a Monday; thirteen complete weeks
const TODAY = "2026-11-04";                                                              // the Wednesday of the plan's first week
const TARGETS = [
  { marker: "mets", target_value: 9.0 }, { marker: "dose", target_value: 900 }, { marker: "zone2_week", target_value: 120 },
  { marker: "strength_week", target_value: 2 }, { marker: "steps", target_value: 8000 },
];

/** A synced person: eight like weeks before the plan (40 min in zone 2, 120 harder, a dose of 1,060, four aerobic sessions and one of strength), 6,480 steps a day, a fitness of 8.4 METs. */
function document({ today = TODAY, mets = 8.4, zone2 = 40, zone3 = 120, dose = 1060, strength = 1, planWeeks = [], steps = 6480, pressure = null, noWeeks = false } = {}) {
  const activities = [], weeks = [], signals = [];
  const firstPlanMonday = "2026-11-02";
  if (!noWeeks) for (let i = 8; i >= 1; i--) {
    const monday = addDays(firstPlanMonday, -7 * i);
    const s = (day, name, type, cat, mins) => activities.push({ timestamp: `${addDays(monday, day)}T07:00:00`, activity_name: name, activity_type: type, intensity_category: cat, duration_minutes: mins, met_minutes: 200 });
    s(0, "Running", "aerobic", "vigorous", 40); s(2, "Cycling", "aerobic", "moderate", 45); s(4, "Running", "aerobic", "vigorous", 40); s(5, "Walking", "aerobic", "moderate", 50);
    for (let k = 0; k < strength; k++) s(1 + 2 * k, "Strength", "strength", "moderate", 40);
    weeks.push({ week_start: monday, source: "sync", synced_at: `${addDays(monday, 7)}T06:00:00Z`, workouts: 4 + strength, dose_met_min: dose, dose_goal_met_min: 900, zone1_min: 60, zone2_min: zone2, zone3_min: zone3, strength_sessions: strength });
  }
  // the plan's own weeks, as the app wrote them: [zone 2 minutes, harder minutes]
  planWeeks.forEach(([z2, z3], i) => weeks.push({ week_start: addDays(firstPlanMonday, 7 * i), source: "sync", synced_at: `${addDays(firstPlanMonday, 7 * i + 7)}T06:00:00Z`, workouts: 5, dose_met_min: 1000, dose_goal_met_min: 900, zone1_min: 50, zone2_min: z2, zone3_min: z3, strength_sessions: 2 }));
  for (let d = 13; d >= 0; d--) signals.push({ day: addDays(today, -d), steps: steps == null ? null : steps });
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
  assert.match(v.fitt[5].by, /Held from week 8\. Fitness tested in week 8 and week 13\./);
  assert.match(v.fitt[4].by, /Never under your 900\./);
  assert.equal(v.why.length, 3);
  assert.match(v.why[0].head, /Your fitness is 8\.4 METs\./);
  assert.match(v.why[1].text, /reaches 120 in week 8 and leaves 5 weeks to hold it/);
  assert.equal(v.climb.length, 13);
  assert.deepEqual(v.climb.filter((w) => w.test).map((w) => w.week), [8, 13]);
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
  assert.deepEqual(v.answers.watches.map((a) => [a.label, a.text]), [["Fitness", "Tested in weeks 8 and 13"]]);
  assert.equal(v.answers.note, null, "the plan climbs, so nothing is left untouched");
  assert.ok(v.climbs);
  // a zone 2 number under the typical week, as in the recording: nothing climbs, and the plan says what that means for fitness
  const flat = guidePlan({ horizon: H, targets: [{ marker: "mets", target_value: 9.0 }, { marker: "zone2_week", target_value: 30 }, { marker: "weight", target_value: 70 }, { marker: "waist", target_value: 90 }], person: person(), today: TODAY });
  assert.equal(flat.climbs, false);
  assert.equal(flat.answers.works.find((a) => a.marker === "zone2_week").text, "Nothing to add: your 30 is under your typical 40");
  assert.deepEqual(flat.answers.watches.map((a) => [a.label, a.text]), [["Fitness", "Tested in weeks 8 and 13"], ["Weight", "Read every Monday"], ["Waist", "Read at each month's end"]]);
  assert.equal(flat.answers.note, 'You asked for fitness to move from 8.4 to 9.0 METs. Nothing in this plan changes your aerobic week. The plan builds only towards a zone 2 number above your typical week of 40, and yours is 30. The number is yours to change, under "Change it".');
  assert.match(flat.lead, /The plan holds your aerobic week as it is\.$/);
  // steps or strength asked for, and nothing aerobic: the lead does not say the whole week is held
  assert.match(guidePlan({ horizon: H, targets: TARGETS.map((t) => (t.marker === "zone2_week" ? { ...t, target_value: 30 } : t)), person: person(), today: TODAY }).lead, /What your targets ask for is a different mix: a second strength session and more steps\. The plan holds your aerobic week as it is\.$/);
  assert.deepEqual(flat.moves.map((m) => m.head), ["A short week", "To make it build", "The week 8 test"]);
  assert.match(flat.moves[1].text, /only towards a zone 2 number above your typical week of 40\. Yours is 30\./);
  // no zone 2 number at all
  const none = guidePlan({ horizon: H, targets: [{ marker: "mets", target_value: 9.0 }], person: person(), today: TODAY });
  assert.match(none.answers.note, /and you have set none\./);
  // how the plan moves names zone 2 minutes, never "its step": steps a day are a line of their own
  for (const view of [v, flat]) assert.doesNotMatch(view.moves.map((m) => m.text).join(" "), /repeats (that week's|its) step/);
  assert.match(v.moves[0].text, /Strength and steps a day go on by the week whatever zone 2 did\./);
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
