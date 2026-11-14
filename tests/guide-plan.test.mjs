// The Guide's plan under node: the three questions, the climb, where a person is on it, the words, the changes, the chat's inputs. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { adherenceOf } from "../src/my-health/horizon/derive.ts";
import RULES from "../src/data/plan-rules.ts";
import {
  screenOutcome, SCREEN_QUESTIONS, SCREEN_WORDS, baseOf, aimsOf, tierOf, metPerMinute, climbOf, stepsAt, progressOf, guidePlan, applyOption, storeOf, rowsWith,
  isGuideStored, askInputs, isRedFlag, FIXED_SYMPTOM_ANSWER, RULE_LINES, loggedTypes,
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
  assert.match(v.lead, /The plan holds the week as it is\./);
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
  assert.equal(one.status, "Week 3 of 13 · a step repeated");
  assert.equal(one.tiles.find((t) => t.key === "zone2").big, "60 minutes in zone 2");
  assert.ok(one.notes.some((n) => /One week was under the plan's zone 2 figure, so its step is repeated\. Nothing is asked back\./.test(n)));
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
