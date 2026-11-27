// The five numbers a new horizon opens with (the founder, 27 November 2026: "these 5 should be in the horizon as
// default"). Each is a published figure already on file, set against the person's own typical week. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { latestOf } from "../src/my-health/horizon/derive.ts";
import RULES from "../src/data/plan-rules.ts";
import STEPS from "../src/data/step-thresholds.ts";
import { GOAL_BY_KEY } from "../src/data/programme.ts";
import { defaultTargets, DEFAULT_ORDER, FITNESS_GAIN_METS } from "../src/my-health/horizon/defaults.ts";

const TODAY = "2026-12-03";            // a Thursday; the last complete week began on Monday 23 November
const LAST = "2026-11-23";

/**
 * An invented person, Asha: the same week for each of the eight before today. `week` is that week's sessions, as
 * [day offset, kind, minutes, zone 2 minutes]; `steps` a day's steps; `goal` the app's weekly goal in MET-minutes,
 * sent on its week rows; `mets` a fitness test on file.
 */
function person({ week = [[0, "aerobic", 40, 40], [2, "aerobic", 40, 40], [4, "strength", 30, null]], steps = 6400, goal = null, mets = 8.4 } = {}) {
  const activities = [], signals = [], weeks = [];
  for (let w = 0; w < 8; w++) {
    const monday = addDays(LAST, -7 * w);
    for (const [off, kind, min, z2] of week) activities.push({ timestamp: `${addDays(monday, off)}T07:00:00`, activity_name: kind === "strength" ? "Strength" : "Walk", activity_type: kind, intensity_category: "moderate", duration_minutes: min, met_minutes: min * 5, ...(z2 != null ? { zone2_minutes: z2 } : {}) });
    if (steps != null) for (let d = 0; d < 7; d++) signals.push({ day: addDays(monday, d), steps });
    if (goal != null) weeks.push({ week_start: monday, source: "sync", synced_at: `${addDays(monday, 7)}T02:00:00Z`, dose_met_min: 400, dose_goal_met_min: goal, zone2_min: 80, zone3_min: 0, strength_sessions: 1, workouts: 3 });
  }
  return derivePerson({
    generated_at: TODAY, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1981 },
    labs: [], imaging: [], reports: [], files: [], weeks, web_crf: [], web_body: [], app_labs: [], activities, waist: [],
    app_crf: mets == null ? [] : [{ timestamp: "2026-11-10T08:00:00", met_capacity: mets, vo2_max_estimate: mets * 3.5, estimation_method: "cooper-test" }],
    profile: { weekly_met_hours_goal: 15, height_cm: 160, sex: "female", age: 45 },
    signals, weights: [], note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  });
}
const rows = (o = {}, weeks = 12) => { const p = person(o); return defaultTargets({ person: p, today: TODAY, weeks, fitness: latestOf("mets", p, TODAY) }); };
const say = (r) => [r.label, r.now, r.value, r.from];

test("the five, in his order, each with what is on file, a number and where the number comes from", () => {
  const five = rows();
  assert.deepEqual(five.map((r) => r.marker), DEFAULT_ORDER);
  assert.deepEqual(DEFAULT_ORDER, ["zone2_week", "strength_week", "steps", "dose", "mets"]);
  assert.deepEqual(five.map(say), [
    ["Zone 2", "80 in a typical week", 150, "The guideline's 150 minutes a week."],
    ["Strength", "1 in a typical week", 2, "The guideline's two sessions a week."],
    ["Steps", "6,400 a day now", 7000, "The next published line above your days: 7,000."],
    ["Weekly dose", "400 in a typical week", 500, "The guideline's low figure, 500."],
    ["Fitness", "8.4 at your last test", 9.5, "1.1 METs up: the average gain across trials of about twelve weeks."],
  ]);
  for (const r of five) assert.ok(r.unit && !/\n/.test(r.from) && r.from.length < 90, r.marker);
});

test("no figure is new: each default is a figure the repository already holds", () => {
  const five = rows();
  assert.equal(five[0].value, RULES.dose.moderateMinForLow);
  assert.equal(five[1].value, RULES.strength.minDays);
  assert.equal(five[2].value, STEPS.referenceLines.cvdPeak);
  assert.equal(five[3].value, RULES.dose.lowMetMin);
  // the gain is the one the goal's own evidence line cites
  assert.ok(GOAL_BY_KEY.build_fitness.evidence.some((e) => e.text.startsWith(`+${FITNESS_GAIN_METS} METs is the average gain across trials of about twelve weeks`) && e.cites.includes("Lin 2015")));
});

test("zone 2 is never set beyond what ten minutes a week can reach, and is held where the person is already past the line", () => {
  // a typical week of 20 minutes, six weeks: 20 + 5 steps of 10
  assert.deepEqual(say(rows({ week: [[0, "aerobic", 20, 20]] }, 6)[0]), ["Zone 2", "20 in a typical week", 70, "10 minutes more each week, towards the guideline's 150."]);
  assert.deepEqual(say(rows({ week: [[0, "aerobic", 60, 60], [2, "aerobic", 60, 60], [4, "aerobic", 62, 62]] })[0]), ["Zone 2", "182 in a typical week", 180, "Your typical week, held."]);
  // nothing on file at all: the guideline's line, and no word about a week that was never read
  const none = rows({ week: [], steps: null, mets: null });
  assert.deepEqual(say(none[0]), ["Zone 2", null, 110, "10 minutes more each week, towards the guideline's 150."]);
  assert.deepEqual(say(none[1]), ["Strength", null, 2, "The guideline's two sessions a week."]);
});

test("strength keeps a typical week that is already more than two, up to four", () => {
  const three = rows({ week: [[0, "strength", 30, null], [2, "strength", 30, null], [4, "strength", 30, null]] })[1];
  assert.deepEqual(say(three), ["Strength", "3 in a typical week", 3, "Your typical week, held."]);
  const six = rows({ week: [0, 1, 2, 3, 4, 5].map((d) => [d, "strength", 30, null]) })[1];
  assert.equal(six.value, RULES.strength.maxDays);
});

test("steps take the next published line above the person's days, and none is offered before steps have arrived", () => {
  assert.equal(rows({ steps: 2000 })[2].value, 2600);
  assert.equal(rows({ steps: 7400 })[2].value, 8800);
  assert.deepEqual(say(rows({ steps: 9240 })[2]), ["Steps", "9,240 a day now", 9200, "Your own days, held: they are past the last published line."]);
  assert.deepEqual(say(rows({ steps: null })[2]), ["Steps", null, null, "Steps arrive from a phone or a watch. None has arrived yet."]);
});

test("the dose is the person's goal in the app when it sent one", () => {
  assert.deepEqual(say(rows({ goal: 1200 })[3]), ["Weekly dose", "400 in a typical week", 1200, "Your weekly goal in the app."]);
});

test("fitness is offered only from a test on file, and only for about twelve weeks", () => {
  assert.deepEqual(say(rows({ mets: null })[4]), ["Fitness", null, null, "A fitness number needs a test on file. One can be added once the horizon is set."]);
  assert.equal(rows({}, 13)[4].value, 9.5);
  assert.deepEqual(say(rows({}, 26)[4]), ["Fitness", "8.4 at your last test", null, "No published gain for this length. The number is yours to set."]);
});

test("the set-up opens short, and the set-up with every choice is one link away, as it was", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const view = read("../src/my-health/views/Horizon.tsx"), quick = read("../src/my-health/views/QuickSetup.tsx");
  // short first for an account that may set one; never in place of the set-up that follows a horizon read to its date
  assert.match(view, /!ownTargets && !fullSetup && setupCard <= 1 && \(open\.length > 0 \|\| !done\[0\]\)\n\s+\? <QuickSetup /);
  assert.match(view, /onMore=\{\(\) => setFullSetup\(true\)\}/);
  assert.match(view, /: showSetup && tester && owner && !ownTargets && \(open\.length > 0 \|\| !done\[0\] \|\| !!parseProgramme\(done\[0\]\.programme\)\)\n\s+\? <ProgrammeSetup /);
  // an existing programme, so the function needs no change; the three questions stay; and it is kept by the full set-up's own calls
  assert.match(quick, /const GOAL = "build_fitness" as const;/);
  for (const call of ["SCREEN_QUESTIONS.map(", "startHorizon(sb, {", "saveProgramme(sb, id, programme)", "setTargetHold(sb, id, \"mets\"", "saveScreen(sb, id, uid", "saveGuidePlan(sb, id, rowsWith(v, []), storeOf(v, today), uid)"]) assert.ok(quick.includes(call), call);
  assert.match(quick, /if \(guideOn && !answered\) \{ setProblem\("Answer the three questions about your health\."\); return; \}/);
  // nothing is ticked on for them: the check-in's own email stays off, as in the full set-up
  assert.match(quick, /email_checkin: false/);
  // the Monday email (27 November 2026, "Yes, ticked"): offered only while "Your week" is off, ticked, and switched on at Start by Settings' own call
  assert.match(quick, /const \[emailMe, setEmailMe\] = useState\(true\);/);
  assert.match(quick, /const offersEmail = weekly\?\.state === "off";/);
  assert.match(quick, /if \(uid && offersEmail && emailMe\) writes\.push\(saveWeekly\(sb, uid, true, browserZone\(\)\)/);
  assert.match(quick, /\{offersEmail \? \(\n\s+<label [^>]*data-quick="email">/);
  assert.ok(quick.includes("Email me my week on Mondays") && quick.includes("One email a week. One click in any email turns it off."));
});
