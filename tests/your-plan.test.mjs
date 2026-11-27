// "Your plan", the third tab of a horizon (the founder, 27 November 2026): three cards, then six small cards of one
// size. Every figure is the Guide's plan as guidePlan.ts holds it, said shorter. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { guidePlan, storeOf } from "../src/my-health/horizon/guidePlan.ts";
import { heartOf } from "../src/my-health/horizon/heartBand.ts";
import { yourPlanOf, planCards, planLetters, PLAN_STOPPED, PLAN_OWN, PLAN_OWN_THEIRS, BY_SAME, TYPE_ANY, TYPE_NONE, SHORT_WEEK, HELD, NOTHING_ADDED, EFFORT_NOW } from "../src/my-health/horizon/yourPlan.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
// Every figure here is invented, and so is the person, Asha. Keep it so; this repo is public.
const H = { starts_on: "2026-11-02", ends_on: "2027-02-01", title: "Build fitness" };   // a Monday; thirteen complete weeks
const TODAY = "2026-11-04";
const TARGETS = [{ marker: "mets", target_value: 9.4 }, { marker: "dose", target_value: 900 }, { marker: "zone2_week", target_value: 150 }, { marker: "strength_week", target_value: 2 }, { marker: "steps", target_value: 8000 }];

/** Eight like weeks before the plan: three aerobic sessions (walking twice, cycling once) and one of strength; 6,480 steps a day; 8.4 METs. */
function person({ mets = 8.4, noWeeks = false } = {}) {
  const activities = [], weeks = [], signals = [];
  if (!noWeeks) for (let i = 8; i >= 1; i--) {
    const monday = addDays(H.starts_on, -7 * i);
    const s = (day, name, type, mins) => activities.push({ timestamp: `${addDays(monday, day)}T07:00:00`, activity_name: name, activity_type: type, intensity_category: "moderate", duration_minutes: mins, met_minutes: 200 });
    s(0, "Walking", "aerobic", 40); s(2, "Cycling", "aerobic", 45); s(4, "Walking", "aerobic", 40); s(1, "Strength", "strength", 40);
    weeks.push({ week_start: monday, source: "sync", synced_at: `${addDays(monday, 7)}T06:00:00Z`, workouts: 4, dose_met_min: 720, dose_goal_met_min: 900, zone1_min: 60, zone2_min: 80, zone3_min: 40, strength_sessions: 1 });
  }
  for (let d = 13; d >= 0; d--) signals.push({ day: addDays(TODAY, -d), steps: 6480 });
  return derivePerson({
    generated_at: TODAY, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1982 },
    labs: [], imaging: [], reports: [], files: [], weeks, web_crf: [], web_body: [], app_labs: [], activities,
    app_crf: mets == null ? [] : [{ timestamp: "2026-10-20T08:00:00", met_capacity: mets, vo2_max_estimate: mets * 3.5, estimation_method: "cooper-test" }],
    waist: [], profile: { weekly_met_hours_goal: 15, height_cm: 160, sex: "female", age: 44 },
    signals, weights: [], note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  });
}
const HEART = heartOf({ age: 44, resting_hr: 62, on_beta_blockers: false, zone2_low_hr: null, zone2_high_hr: null }, TODAY);
const inUse = (o = {}, extra = {}) => { const p = person(o), draft = guidePlan({ horizon: H, targets: TARGETS, person: p, today: TODAY }); return guidePlan({ horizon: H, targets: TARGETS, person: p, today: TODAY, stored: storeOf(draft, TODAY), self: true, ...extra }); };
const tab = (view, extra = {}) => yourPlanOf({ view, inUse: true, running: true, self: true, ...extra });

test("three cards: your fitness, your tier, your aim, each a label, one figure and one short line", () => {
  const v = inUse();
  const cards = planCards(v, true);
  assert.deepEqual(cards.map((c) => [c.key, c.label]), [["fitness", "Your fitness"], ["tier", "Your tier"], ["aim", "Your aim"]]);
  assert.equal(cards[0].big, "8.4 METs");
  assert.equal(cards[1].big, "Tier 1 of 3");
  assert.equal(cards[1].small, "Under 9 METs: build minutes at a steady effort first.");
  assert.equal(cards[2].big, "9.4 METs");
  assert.match(cards[2].small, /^Your own target · tested again in week 12$/);
  // the words are the plan's own (guidePlan.ts place): nothing is said a second way
  assert.deepEqual(cards.map((c) => [c.big, c.small]), [[v.place.fitness.big, v.place.fitness.small], [v.place.tier.big, v.place.tier.small], [v.place.aim.big, v.place.aim.small]]);
  for (const c of cards) assert.ok(c.small.length <= 60, `${c.key}: one short line`);
  // someone the page is shared with reads "Their"
  assert.deepEqual(planCards(inUse({}, { self: false }), false).map((c) => c.label), ["Their fitness", "Their tier", "Their aim"]);
  // no fitness target on the horizon: the third card says so, and is still a card
  const none = guidePlan({ horizon: H, targets: TARGETS.filter((t) => t.marker !== "mets"), person: person(), today: TODAY });
  assert.deepEqual(planCards(none, true)[2], { key: "aim", label: "Your aim", big: "Not set", small: "This horizon has no fitness target." });
  // no test on file: the first card says so
  assert.equal(planCards(guidePlan({ horizon: H, targets: TARGETS, person: person({ mets: null }), today: TODAY }), true)[0].big, "No test on file");
});

test("six small cards, one for each letter, each ONE line for now and ONE small line", () => {
  const v = inUse({}, { heart: HEART });
  const letters = planLetters(v, HEART);
  assert.deepEqual(letters.map((l) => l.label), ["F · Frequency", "I · Intensity", "T · Time", "T · Type", "V · Volume", "P · Progression"]);
  assert.deepEqual(letters.map((l) => l.key), ["frequency", "intensity", "time", "type", "volume", "progression"]);
  const of = (k) => letters.find((l) => l.key === k);
  // frequency is the plan's own line, without the one word that made it two lines on a phone
  assert.match(of("frequency").now, /^\d aerobic, \d strength, \d days? off$/);
  assert.equal(of("frequency").now, v.fitt[0].now.replace(/ aerobic sessions?/, " aerobic"));
  assert.equal(of("frequency").by, BY_SAME);
  // intensity: the long note of the old card is one line, the person's own range in beats, and what it feels like
  assert.match(of("intensity").now, /^\d+ to \d+ beats a minute$/);
  assert.equal(of("intensity").by, "You can talk in full sentences");
  // time and volume are the plan's figures with the units written short
  assert.match(of("time").now, /^\d+ to \d+ min a session$/);
  assert.match(of("time").by, /^By the date: (the same|\d+ to \d+ min)$/);
  assert.match(of("volume").now, /^About [\d,]+ MET-min$/);
  assert.match(of("volume").by, /^By the date: about [\d,]+$/);
  // type is what the person already logs
  assert.equal(of("type").now, "Walking, cycling");
  assert.equal(of("type").by, TYPE_ANY);
  // progression is the rule's own ten minutes
  assert.equal(of("progression").now, "10 more zone 2 min a week");
  assert.equal(of("progression").by, SHORT_WEEK);
  // equal and calm: no line is long enough to push one card past the others, and none is a sentence with a stop
  for (const l of letters) {
    assert.ok(l.now.length > 0 && l.now.length <= 34, `${l.key} now: "${l.now}"`);
    assert.ok(l.by.length > 0 && l.by.length <= 44, `${l.key} by: "${l.by}"`);
    assert.equal(/\.$/.test(l.now) || /\.$/.test(l.by), false, l.key);
  }
});

test("intensity goes by effort where there are no beats to say", () => {
  const v = inUse();
  // someone the page is shared with, or a profile with no age: no heart is handed in
  assert.equal(planLetters(v, null).find((l) => l.key === "intensity").now, EFFORT_NOW);
  // the app was told heart rate is not a guide
  const effort = heartOf({ age: 44, resting_hr: 62, on_beta_blockers: true, zone2_low_hr: null, zone2_high_hr: null }, TODAY);
  assert.equal(effort.kind, "effort");
  assert.equal(planLetters(v, effort).find((l) => l.key === "intensity").now, EFFORT_NOW);
});

test("a week that does not climb, and a person with no logged type, still read as one line each", () => {
  const v = inUse();
  const held = planLetters({ ...v, climbs: false }, null).find((l) => l.key === "progression");
  assert.deepEqual([held.now, held.by], [HELD, NOTHING_ADDED]);
  const none = planLetters({ ...v, base: { ...v.base, types: [] } }, null).find((l) => l.key === "type");
  assert.deepEqual([none.now, none.by], [TYPE_NONE, TYPE_ANY]);
  // a type the person asked to leave out of the plan is left out here too
  const left = planLetters({ ...v, choices: { ...v.choices, leave_out: ["cycling"] } }, null).find((l) => l.key === "type");
  assert.equal(left.now, "Walking");
});

test("the tab: cards and letters while the plan runs; one quiet line where there are no letters to show", () => {
  const v = inUse();
  const running = tab(v, { heart: HEART });
  assert.equal(running.cards.length, 3);
  assert.equal(running.letters.length, 6);
  assert.equal(running.line, null);
  // a plan kept midweek begins on the next Monday: the tab says which
  const later = yourPlanOf({ view: { ...v, started: false, firstMonday: "2026-11-09" }, inUse: true, running: true, self: true });
  assert.equal(later.letters.length, 6);
  assert.match(later.line, /^The plan starts on Monday,? 9 November\.$/);
  // a horizon that is kept after the 12 weeks, or stopped: the cards, and that the plan has stopped
  const kept = tab(v, { running: false });
  assert.deepEqual([kept.cards.length, kept.letters.length, kept.line], [3, 0, PLAN_STOPPED]);
  // no Guide's plan in use: a draft's three cards, and that the horizon follows the person's own targets
  const draft = guidePlan({ horizon: H, targets: TARGETS, person: person(), today: TODAY });
  const own = yourPlanOf({ view: draft, inUse: false, running: true, self: true });
  assert.deepEqual([own.cards.length, own.letters.length, own.line], [3, 0, PLAN_OWN]);
  assert.equal(yourPlanOf({ view: draft, inUse: false, running: true, self: false }).line, PLAN_OWN_THEIRS);
  // nothing can be worked out at all: the one line, and no empty card
  assert.deepEqual(yourPlanOf({ view: null, inUse: false, running: true, self: true }), { cards: [], letters: [], line: PLAN_OWN });
});

test("the tab draws the three cards, six equal cards, and none of what the old page showed around them", () => {
  const page = read("../src/my-health/views/SimpleHorizon.tsx");
  const i = page.indexOf("function Plan("), j = page.indexOf("export function SimpleHorizon(");
  const plan = page.slice(i, j);
  assert.ok(i > 0 && j > i);
  assert.match(plan, /data-plan="cards"/);
  assert.match(plan, /data-plan="letters"/);
  // one size: every letter's card has the same least height, in a grid of one, two or three across
  assert.match(plan, /grid-cols-1 gap-2\.5 p-0 sm:grid-cols-2 lg:grid-cols-3" data-plan="letters"/);
  assert.match(plan, /data-plan-letter=\{l\.key\} class="flex min-h-\[88px\] flex-col/);
  // left out on the founder's word: the tier rows, the chat, the targets the plan works on or watches, the rules, the climb
  for (const gone of ["tiers", "Ask about it", "works on", "watches", "rules behind", "RULE_LINES", "climb", "GuidePlanCard"]) assert.equal(plan.includes(gone), false, gone);
  const view = read("../src/my-health/views/Horizon.tsx");
  assert.match(view, /plan=\{seen === "plan" && person \? yourPlanOf\(\{ view: simpleGuide \?\? planDraft, inUse: !!simpleGuide, running: !closed && !keptOnly, self: selfPlan, heart: selfPlan \? heart : null \}\) : null\}/);
});
