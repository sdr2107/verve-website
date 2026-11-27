// A fitness test taken in the middle of a horizon (the founder, 27 November 2026): the plan reads the test the horizon
// keeps, and one card on "This week" says what a new test would do and asks. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import RULES from "../src/data/plan-rules.ts";
import { DOORS } from "../src/data/programme.ts";
import { fitnessBy, horizonFitness, latestOf } from "../src/my-health/horizon/derive.ts";
import { aimsOf, tierOf, guidePlan, storeOf, freezeOf } from "../src/my-health/horizon/guidePlan.ts";
import { heartOf } from "../src/my-health/horizon/heartBand.ts";
import { parseProgramme, testKeys, TESTS_KEPT } from "../src/my-health/horizon/programme.ts";
import { thisWeek, fitnessLine } from "../src/my-health/horizon/simple.ts";
import { FITNESS_GAIN_METS } from "../src/my-health/horizon/defaults.ts";
import {
  pendingTest, newTestCard, planMoves, harderWords, harderBeats, methodLine, aimOffered, aimTyped, withoutReading, testKey,
  HEAD, USE, KEEP, GOT_IT, SET_AIM, NOTHING_CHANGES, NOTHING_MOVES,
} from "../src/my-health/horizon/newTest.ts";

// Every figure here is invented, and so is the person: no one's weeks, fitness, steps or targets. Keep it so; this repo is public.
const H = { starts_on: "2026-11-02", ends_on: "2027-02-01", title: "Build fitness" };   // a Monday; thirteen complete weeks
const TODAY = "2026-11-26";                                                              // the Thursday of the plan's fourth week
const TARGETS = [
  { id: "t-mets", marker: "mets", target_value: 9.4, start_value: 8.4, start_on: "2026-10-20", method: "run" },
  { id: "t-dose", marker: "dose", target_value: 900 }, { id: "t-z2", marker: "zone2_week", target_value: 150 },
  { id: "t-st", marker: "strength_week", target_value: 2 }, { id: "t-steps", marker: "steps", target_value: 8000 },
];
const RUN = ["2026-10-20", 8.4, "cooper-run"];

/**
 * An invented person, Asha: eight like weeks before the plan (40 minutes in zone 2, 120 harder, four aerobic sessions
 * and one of strength), the plan's first three weeks as the app wrote them, 6,480 steps a day, and the fitness readings
 * given, each [day, METs, the method its row carries].
 */
function person({ crf = [RUN], today = TODAY } = {}) {
  const activities = [], weeks = [], signals = [];
  for (let i = 8; i >= 1; i--) {
    const monday = addDays(H.starts_on, -7 * i);
    const s = (day, name, type, cat, mins) => activities.push({ timestamp: `${addDays(monday, day)}T07:00:00`, activity_name: name, activity_type: type, intensity_category: cat, duration_minutes: mins, met_minutes: 200 });
    s(0, "Running", "aerobic", "vigorous", 40); s(2, "Cycling", "aerobic", "moderate", 45); s(4, "Running", "aerobic", "vigorous", 40); s(5, "Walking", "aerobic", "moderate", 50); s(1, "Strength", "strength", "moderate", 40);
    weeks.push({ week_start: monday, source: "sync", synced_at: `${addDays(monday, 7)}T06:00:00Z`, workouts: 5, dose_met_min: 1060, dose_goal_met_min: 900, zone1_min: 60, zone2_min: 40, zone3_min: 120, strength_sessions: 1 });
  }
  for (let i = 0; i < 3; i++) weeks.push({ week_start: addDays(H.starts_on, 7 * i), source: "sync", synced_at: `${addDays(H.starts_on, 7 * i + 7)}T06:00:00Z`, workouts: 5, dose_met_min: 1000, dose_goal_met_min: 900, zone1_min: 50, zone2_min: 50 + 10 * i, zone3_min: 115, strength_sessions: 2 });
  for (let d = 30; d >= 0; d--) signals.push({ day: addDays(today, -d), steps: 6480 });
  return derivePerson({
    generated_at: today, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1974 },
    labs: [], imaging: [], reports: [], files: [], weeks, web_crf: [], web_body: [], app_labs: [], activities,
    app_crf: crf.map(([d, m, method]) => ({ timestamp: `${d}T08:00:00`, met_capacity: m, vo2_max_estimate: m * 3.5, estimation_method: method })),
    waist: [], profile: { weekly_met_hours_goal: 15, height_cm: 168, sex: "female", age: 52 },
    signals, weights: [], note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  });
}
const TREADMILL = ["2026-11-24", 10.2, "treadmill-test"];
const targetsWith = (patch) => TARGETS.map((t) => (t.marker === "mets" ? { ...t, ...patch } : t));
// a profile the app's band is made from: 52 years and 62 at rest give a maximum of 172 and zone 2 at 106 to 128
const HEART = heartOf({ age: 52, resting_hr: 62 }, TODAY);

// ── the one reader ──

test("a horizon reads the test it keeps: a newer reading by another method moves nothing", () => {
  const p = person({ crf: [RUN, TREADMILL, ["2026-11-25", 9.6, "non-exercise-formula"]] });
  // the newest reading of any kind is the watch's estimate; the horizon keeps the run
  assert.equal(latestOf("mets", p, TODAY).value, 9.6);
  assert.deepEqual([horizonFitness(p, TARGETS, TODAY).value, horizonFitness(p, TARGETS, TODAY).on], [8.4, "2026-10-20"]);
  assert.equal(horizonFitness(p, TARGETS, TODAY).value, fitnessBy(p, "run").value);
  // the plan's fitness, and so its tier, is that reading: until 27 November 2026 it was the newest of any method
  assert.equal(aimsOf(TARGETS, p, TODAY).mets, 8.4);
  assert.equal(tierOf(aimsOf(TARGETS, p, TODAY).mets), 1);
  // kept to the treadmill test, the same person is in the second tier
  assert.equal(aimsOf(targetsWith({ method: "treadmill" }), p, TODAY).mets, 10.2);
  assert.equal(tierOf(aimsOf(targetsWith({ method: "treadmill" }), p, TODAY).mets), 2);
  // a later reading by the kept method moves the line by itself, as it always did
  assert.equal(horizonFitness(person({ crf: [RUN, ["2026-11-23", 8.9, "1.5-mile-run"]] }), TARGETS, TODAY).value, 8.9);
});

test("a horizon that keeps no method, or none of whose method is left on file, reads the newest reading of any kind", () => {
  const p = person({ crf: [RUN, TREADMILL] });
  assert.equal(horizonFitness(p, targetsWith({ method: null }), TODAY).value, 10.2);
  assert.equal(horizonFitness(p, [{ marker: "dose" }], TODAY).value, 10.2, "no fitness target at all");
  assert.equal(horizonFitness(p, targetsWith({ method: "lab" }), TODAY).value, 10.2, "kept to a method with no reading: the newest of any");
  assert.equal(horizonFitness(person({ crf: [] }), TARGETS, TODAY), null);
  assert.equal(aimsOf(TARGETS.map(({ method: _m, ...t }) => t), p, TODAY).mets, 10.2, "a target handed in without its method reads as before");
});

test("a plan in use follows the kept test: its tier, its fitness card, and the simple page's fitness row", () => {
  const p0 = person();
  const stored = storeOf(guidePlan({ horizon: H, targets: TARGETS, person: p0, today: "2026-11-02", mode: "full" }), "2026-11-02");
  const p = person({ crf: [RUN, TREADMILL] });
  const kept = guidePlan({ horizon: H, targets: TARGETS, person: p, today: TODAY, stored, self: true });
  assert.deepEqual([kept.place.fitness.big, kept.place.tier.n, kept.aims.mets], ["8.4 METs", 1, 8.4]);
  assert.match(kept.place.fitness.small, /^Cooper run · 20 October$/);
  assert.match(kept.place.note, /^The tier is read from the latest test by the method this horizon keeps\./);
  const moved = guidePlan({ horizon: H, targets: targetsWith({ method: "treadmill" }), person: p, today: TODAY, stored, self: true });
  assert.deepEqual([moved.place.fitness.big, moved.place.tier.n, moved.aims.mets], ["10.2 METs", 2, 10.2]);
  assert.match(moved.place.fitness.small, /^Treadmill test · 24 November$/);
  // with no kept method the words are as they were
  assert.match(guidePlan({ horizon: H, targets: targetsWith({ method: null }), person: p, today: TODAY, stored, self: true }).place.note, /^The tier is read from the latest fitness test on file\./);
  // "This week" and "Past weeks" say the same reading
  const row = (targets) => thisWeek({ horizon: H, person: p, today: TODAY, rows: kept.rows, targets, asks: true }).rows.find((r) => r.key === "fitness");
  assert.equal(row(TARGETS).figure, "8.4");
  assert.equal(row(targetsWith({ method: "treadmill", start_value: 10.2 })).figure, "10.2");
  assert.match(fitnessLine({ horizon: H, person: p, today: TODAY, targets: TARGETS, asks: true }), /^Fitness: 8\.4 METs at the start · next test in week 12\.$/);
});

// ── which test is asked about ──

test("another method: a test the person took after the horizon was set is asked about, and nothing else", () => {
  const ask = (crf, o = {}) => pendingTest({ horizon: H, person: person({ crf }), today: TODAY, targets: TARGETS, answered: [], ...o });
  const p = ask([RUN, TREADMILL]);
  assert.deepEqual([p.kind, p.key, p.reading.value, p.reading.door, p.before], ["other", "2026-11-24|treadmill", 10.2, "treadmill", 8.4]);
  assert.equal(testKey(p.reading), "2026-11-24|treadmill");
  // each of the four doors a person takes; never a watch's estimate, and never a method with no door
  for (const [method, door] of [["cpet", "lab"], ["six-minute-walk", "walk"], ["bruce-protocol", "treadmill"]]) assert.equal(ask([RUN, ["2026-11-24", 9.9, method]]).reading.door, door);
  assert.equal(ask([RUN, ["2026-11-24", 9.9, "non-exercise-formula"]]), null);
  assert.equal(ask([RUN, ["2026-11-24", 9.9, "typed by hand"]]), null);
  // dated on or before the day the horizon was set: that is where it started
  assert.equal(ask([RUN, ["2026-11-02", 10.2, "treadmill-test"]]), null);
  assert.equal(ask([RUN, ["2026-10-30", 10.2, "treadmill-test"]]), null);
  assert.equal(ask([RUN, ["2026-11-03", 10.2, "treadmill-test"]]).key, "2026-11-03|treadmill");
  // a reading dated after today is not on the page yet
  assert.equal(ask([RUN, ["2026-11-27", 10.2, "treadmill-test"]]), null);
  // answered: it does not come back; an older unanswered one is then the one asked about
  assert.equal(ask([RUN, TREADMILL], { answered: ["2026-11-24|treadmill"] }), null);
  const two = [RUN, ["2026-11-10", 7.6, "six-minute-walk"], TREADMILL];
  assert.equal(ask(two).key, "2026-11-24|treadmill", "the newest first");
  assert.equal(ask(two, { answered: ["2026-11-24|treadmill"] }).key, "2026-11-10|walk");
  // a horizon with no fitness target has no line to restart
  assert.equal(pendingTest({ horizon: H, person: person({ crf: [RUN, TREADMILL] }), today: TODAY, targets: TARGETS.filter((t) => t.marker !== "mets"), answered: [] }), null);
});

test("the same method: the line moves by itself, and the card speaks only when the tier moved or the aim was newly reached", () => {
  const ask = (crf, o = {}) => pendingTest({ horizon: H, person: person({ crf }), today: TODAY, targets: TARGETS, answered: [], ...o });
  // 8.4 to 8.9: the same tier, under the aim of 9.4: nothing to say
  assert.equal(ask([RUN, ["2026-11-23", 8.9, "cooper-run"]]), null);
  // 8.4 to 9.1: the second tier
  const tier = ask([RUN, ["2026-11-23", 9.1, "1.5-mile-run"]]);
  assert.deepEqual([tier.kind, tier.key, tier.before, tier.reading.value], ["same", "2026-11-23|run", 8.4, 9.1]);
  // the aim reached, and the tier with it
  assert.equal(ask([RUN, ["2026-11-23", 9.5, "cooper-run"]]).kind, "same");
  // reached again a week later: it was already reached, and the tier is the same, so nothing is said twice
  assert.equal(ask([RUN, ["2026-11-16", 9.5, "cooper-run"], ["2026-11-23", 9.6, "cooper-run"]], { answered: ["2026-11-16|run"] }), null);
  // an older reading of the line is not what the plan reads now: only the newest can have changed anything
  assert.equal(ask([RUN, ["2026-11-16", 9.5, "cooper-run"], ["2026-11-23", 9.6, "cooper-run"]], { answered: ["2026-11-23|run"] }), null);
  // answered
  assert.equal(ask([RUN, ["2026-11-23", 9.1, "cooper-run"]], { answered: ["2026-11-23|run"] }), null);
  // a horizon kept to the watch: an estimate arrives as often as daily, and speaks only when the tier moves
  const watch = (crf) => pendingTest({ horizon: H, person: person({ crf }), today: TODAY, targets: targetsWith({ method: "watch", start_value: 8.4 }), answered: [] });
  const W = ["2026-10-20", 8.4, "non-exercise-formula"];
  assert.equal(watch([W, ["2026-11-25", 9.5, "non-exercise-formula"]]).kind, "same", "8.4 to 9.5 crosses a tier");
  assert.equal(watch([W, ["2026-11-24", 9.5, "non-exercise-formula"], ["2026-11-25", 9.6, "non-exercise-formula"]]), null, "the aim alone never speaks for a watch");
  // no kept method: the plan reads the newest of any, so a test the person took is the horizon's own
  const none = (crf) => pendingTest({ horizon: H, person: person({ crf }), today: TODAY, targets: targetsWith({ method: null }), answered: [] });
  assert.equal(none([RUN, TREADMILL]).kind, "same");
  assert.equal(none([RUN, ["2026-11-24", 9.9, "non-exercise-formula"]]), null);
});

// ── the card ──

test("the card for another method: the test, the tier's move, what changes and stays, a new aim, the method's own figure", () => {
  const p = person({ crf: [RUN, TREADMILL] });
  const c = newTestCard({ horizon: H, person: p, today: TODAY, targets: TARGETS, answered: [], harder: 115, heart: HEART });
  assert.deepEqual([c.head, c.kind, c.key, c.test, c.figure, c.unit], [HEAD, "other", "2026-11-24|treadmill", "Treadmill test · 24 November", "10.2", "METs"]);
  assert.deepEqual(c.tier, { to: "Tier 2 of 3", from: "Tier 1" });
  // 65 to 85% of the reserve of 172 less 62: 62 + 71.5 and 62 + 93.5
  assert.deepEqual(harderBeats(HEART), { low: 134, high: 156 });
  assert.deepEqual(c.rows, [
    { key: "changes", label: "Changes", text: "Harder minutes move to 134 to 156 beats a minute" },
    { key: "stays", label: "Stays", text: "Zone 2, strength, steps and the weekly dose" },
    { key: "aim", label: "Your aim", text: "9.4 METs is reached. New aim:" },
  ]);
  // nine full weeks are left: no published gain for that length, so the field opens empty
  assert.deepEqual(c.aim, { was: 9.4, suggest: null });
  assert.equal(c.line, "A treadmill test can read 2.3 METs high. Using it restarts your fitness line from 10.2.");
  assert.deepEqual(c.use, { method: "treadmill", start_value: 10.2, start_on: "2026-11-24" });
  assert.deepEqual([c.primary, c.secondary], [USE, KEEP]);
  // with about twelve weeks left the field opens on the trials' average gain
  const early = newTestCard({ horizon: H, person: person({ crf: [RUN, ["2026-11-04", 10.2, "treadmill-test"]], today: "2026-11-05" }), today: "2026-11-05", targets: TARGETS, answered: [] });
  assert.deepEqual(early.aim, { was: 9.4, suggest: 11.3 });
  assert.equal(FITNESS_GAIN_METS, 1.1);
  // answered, it is gone
  assert.equal(newTestCard({ horizon: H, person: p, today: TODAY, targets: TARGETS, answered: [c.key] }), null);
});

test("the card for another method that changes nothing says so, and still asks", () => {
  const c = newTestCard({ horizon: H, person: person({ crf: [RUN, ["2026-11-24", 8.7, "six-minute-walk"]] }), today: TODAY, targets: TARGETS, answered: [], harder: 115, heart: HEART });
  assert.deepEqual(c.tier, { to: "Tier 1 of 3", from: null });
  assert.deepEqual(c.rows, [{ key: "changes", label: "Changes", text: NOTHING_CHANGES }, { key: "stays", label: "Stays", text: "Zone 2, strength, steps and the weekly dose" }]);
  assert.equal(c.aim, null);
  assert.equal(c.line, "A six-minute walk is about 1 MET either way. Using it restarts your fitness line from 8.7.");
  assert.deepEqual([c.test, c.primary, c.secondary], ["Six-minute walk · 24 November", USE, KEEP]);
  assert.equal(c.use.method, "walk");
});

test("the card for the horizon's own method: no choice of test, a new aim to set when the old one is reached", () => {
  const reached = newTestCard({ horizon: H, person: person({ crf: [RUN, ["2026-11-23", 9.5, "cooper-run"]] }), today: TODAY, targets: TARGETS, answered: [], harder: 115, heart: HEART });
  assert.deepEqual([reached.kind, reached.key, reached.test, reached.figure], ["same", "2026-11-23|run", "Cooper run · 23 November", "9.5"]);
  assert.deepEqual(reached.tier, { to: "Tier 2 of 3", from: "Tier 1" });
  assert.deepEqual(reached.rows.map((r) => r.key), ["changes", "stays", "aim"]);
  assert.deepEqual([reached.line, reached.use, reached.primary, reached.secondary], [null, null, SET_AIM, GOT_IT]);
  // the tier moved and the aim is not reached: one button
  const tier = newTestCard({ horizon: H, person: person({ crf: [RUN, ["2026-11-23", 9.1, "cooper-run"]] }), today: TODAY, targets: TARGETS, answered: [], harder: 115, heart: HEART });
  assert.deepEqual([tier.aim, tier.primary, tier.secondary], [null, GOT_IT, null]);
  assert.equal(tier.rows[0].text, "Harder minutes move to 134 to 156 beats a minute");
});

test("what the plan asks differently is handed in, and the card's rows say only what is true", () => {
  const p = person({ crf: [RUN, TREADMILL] });
  const card = (moves) => newTestCard({ horizon: H, person: p, today: TODAY, targets: TARGETS, answered: [], harder: 115, heart: HEART, movesFor: () => moves });
  const rows = (moves) => card(moves).rows.slice(0, 2).map((r) => r.text);
  assert.deepEqual(rows({ ...NOTHING_MOVES, zone2: true }), ["Harder minutes move to 134 to 156 beats a minute; zone 2 minutes in later weeks", "Strength, steps and the weekly dose"]);
  assert.deepEqual(rows({ ...NOTHING_MOVES, steps: true, strength: true }), ["Harder minutes move to 134 to 156 beats a minute; steps in later weeks; strength in later weeks", "Zone 2 and the weekly dose"]);
  assert.deepEqual(rows(null), rows(NOTHING_MOVES));
  // the test is handed to the caller, so the plan can be worked out both ways for it
  let asked = null;
  newTestCard({ horizon: H, person: p, today: TODAY, targets: TARGETS, answered: [], movesFor: (x) => { asked = x; return null; } });
  assert.deepEqual([asked.kind, asked.key], ["other", "2026-11-24|treadmill"]);
});

test("the harder minutes' words: beats on the app's own maximum and resting rate, the plan's share without them, effort where heart rate is no guide", () => {
  const say = (o) => harderWords({ from: 1, to: 2, harder: 60, heart: HEART, moved: false, ...o });
  assert.equal(say({}), "Harder minutes move to 134 to 156 beats a minute");
  assert.equal(say({ to: 3 }), "Harder minutes move to 134 to 156 beats a minute", "the second and third tiers ask the same");
  assert.equal(say({ heart: null }), `Harder minutes move to ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve`);
  // a band the person typed from a test has no maximum to take a share of
  assert.equal(say({ heart: heartOf({ age: 52, zone2_low_hr: 110, zone2_high_hr: 130 }, TODAY) }), "Harder minutes move to 65 to 85% of heart-rate reserve");
  assert.equal(say({ heart: { kind: "effort" } }), "Harder minutes are no longer cut back");
  // back to the first tier
  assert.equal(say({ from: 2, to: 1 }), "Harder minutes go back to above 128 beats a minute");
  assert.equal(say({ from: 3, to: 1, heart: null }), "Harder minutes go back to above zone 2");
  assert.equal(say({ from: 2, to: 1, heart: { kind: "effort" } }), "Harder minutes ease while zone 2 climbs");
  // nothing to say: the same tier, the second to the third, a plan with no harder minutes
  assert.equal(say({ to: 1 }), null);
  assert.equal(say({ from: 2, to: 3 }), null);
  assert.equal(say({ harder: 0 }), null);
  assert.equal(say({ harder: null }), null);
  // a later week's harder minutes differ though the tier does not: said plainly
  assert.equal(say({ from: 2, to: 3, moved: true }), "Harder minutes in later weeks");
  assert.equal(harderBeats({ kind: "effort" }), null);
  assert.equal(harderBeats(null), null);
});

test("what a method can read off by is its door's own figure, and no other", () => {
  const line = (door) => methodLine({ door, value: 9.26 });
  assert.equal(line("treadmill"), "A treadmill test can read 2.3 METs high. Using it restarts your fitness line from 9.3.");
  assert.equal(line("walk"), "A six-minute walk is about 1 MET either way. Using it restarts your fitness line from 9.3.");
  assert.equal(line("run"), "A timed run is about 1 MET either way. Using it restarts your fitness line from 9.3.");
  assert.equal(line("lab"), "A test with a mask is the reference. Using it restarts your fitness line from 9.3.");
  assert.equal(line(null), "A test by another method is not compared with your first. Using it restarts your fitness line from 9.3.");
  // every figure in those lines is the one the set-up shows for that door
  for (const d of DOORS.filter((x) => x.key !== "watch")) assert.ok(line(d.key).includes(d.error) && line(d.key).startsWith(d.title), d.key);
});

test("a new aim is offered only with about twelve weeks left, and what is typed is made safe", () => {
  assert.equal(aimOffered(10.2, "2026-11-05", "2027-02-01"), 11.3, "twelve full weeks left");
  assert.equal(aimOffered(10.2, "2026-11-26", "2027-02-01"), null, "nine left");
  assert.equal(aimOffered(10.2, "2026-11-05", "2027-05-01"), null, "twenty-five left");
  assert.deepEqual(["11", " 11.26 ", "0", "-2", "", "abc", null, "45"].map(aimTyped), [11, 11.3, null, null, null, null, null, null]);
});

test("the plan worked out two ways is compared from this week on, line by line", () => {
  const w = (monday, state, o = {}) => ({ monday, state, zone2: 100, harder: 40, steps: 6800, strengthDays: 2, sets: "one to two sets", ...o });
  const before = { climb: [w("2026-11-02", "past"), w("2026-11-09", "now"), w("2026-11-16", "future")] };
  assert.deepEqual(planMoves(before, before), NOTHING_MOVES);
  assert.deepEqual(planMoves(null, before), NOTHING_MOVES);
  // a week behind the person is not looked at
  assert.deepEqual(planMoves(before, { climb: [w("2026-11-02", "past", { zone2: 50 }), w("2026-11-09", "now"), w("2026-11-16", "future")] }), NOTHING_MOVES);
  assert.deepEqual(planMoves(before, { climb: [w("2026-11-02", "past"), w("2026-11-09", "now"), w("2026-11-16", "future", { zone2: 110, harder: 60 })] }), { ...NOTHING_MOVES, zone2: true, harder: true });
  assert.deepEqual(planMoves(before, { climb: [w("2026-11-02", "past"), w("2026-11-09", "now", { steps: 6900 }), w("2026-11-16", "future", { sets: "two to three sets" })] }), { ...NOTHING_MOVES, steps: true, strength: true });
});

test("using a test keeps this week's lines: the plan goes on from the week it is used in", () => {
  const p0 = person();
  const stored = storeOf(guidePlan({ horizon: H, targets: TARGETS, person: p0, today: "2026-11-02", mode: "full" }), "2026-11-02");
  const p = person({ crf: [RUN, TREADMILL] });
  const before = guidePlan({ horizon: H, targets: TARGETS, person: p, today: TODAY, stored, self: true });
  const frozen = freezeOf(before, stored, true);
  const after = guidePlan({ horizon: H, targets: targetsWith({ method: "treadmill", start_value: 10.2, start_on: "2026-11-24" }), person: p, today: TODAY, stored: frozen, self: true });
  const now = (v) => v.climb.find((x) => x.state === "now");
  assert.deepEqual([now(after).zone2, now(after).harder, now(after).steps, now(after).strengthDays], [now(before).zone2, now(before).harder, now(before).steps, now(before).strengthDays]);
  // the weeks behind are as they were asked
  const past = (v) => v.climb.filter((x) => x.state === "past").map((x) => [x.monday, x.zone2, x.harder, x.steps]);
  assert.deepEqual(past(after), past(before));
  assert.deepEqual([before.place.tier.n, after.place.tier.n], [1, 2]);
  // and what the card is told moves is worked out from those two
  const moves = planMoves(before, after);
  assert.equal(moves.strength, false);
  const c = newTestCard({ horizon: H, person: p, today: TODAY, targets: TARGETS, answered: [], harder: now(before).harder, heart: HEART, movesFor: () => moves });
  assert.equal(c.rows.find((r) => r.key === "stays").text.endsWith("the weekly dose"), true);
});

test("the plan without one reading is the plan as it stood before that test arrived", () => {
  const p = person({ crf: [RUN, ["2026-11-23", 9.5, "cooper-run"]] });
  const r = pendingTest({ horizon: H, person: p, today: TODAY, targets: TARGETS, answered: [] }).reading;
  const q = withoutReading(p, r);
  assert.deepEqual([horizonFitness(p, TARGETS, TODAY).value, horizonFitness(q, TARGETS, TODAY).value], [9.5, 8.4]);
  assert.equal(p.crf.length, 2, "the person handed in is not changed");
});

// ── what the horizon remembers ──

test("the tests a person has answered are kept with the horizon, and a save does not drop them", () => {
  const stored = { v: 1, goal: "build_fitness", aims: [], barriers: [], days: [], place: null, writer: "guide", tests: ["2026-11-24|treadmill", "2026-11-10|walk", "nonsense", 7, "2026-11-24|treadmill", "2026-13-99|x y"] };
  const p = parseProgramme(stored);
  assert.deepEqual(p.tests, ["2026-11-10|walk", "2026-11-24|treadmill"]);
  // the page writes back what it parsed, with one more key: the round trip holds
  assert.deepEqual(parseProgramme({ ...p, tests: testKeys([...p.tests, "2026-11-26|run"]) }).tests, ["2026-11-10|walk", "2026-11-24|treadmill", "2026-11-26|run"]);
  assert.deepEqual(parseProgramme({ v: 1, goal: "hold" }).tests, [], "a horizon no test was answered for");
  // only the newest few are kept
  const many = Array.from({ length: 40 }, (_, i) => `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}|run`);
  assert.equal(testKeys(many).length, Math.min(TESTS_KEPT, new Set(many).size));
  assert.deepEqual(testKeys(null), []);
});
