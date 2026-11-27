// The week, kept light (board 08 of "Verve, the plan you follow"; decided 25 November 2026): three amounts first,
// a few ideas from the person's activities, and what each logged session filled. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { doneOf } from "../src/my-health/horizon/guidePlan.ts";
import { parseProgramme } from "../src/my-health/horizon/programme.ts";
import { ACTIVITIES, ACTIVITY_BY_KEY, IDEAS_AT_MOST, OWN_AT_MOST, OWN_LENGTH } from "../src/data/activities.ts";
import {
  lightWeekOf, chosenOf, ideasFor, loggedLines, cleanOwn, cleanKeys, activityOfName, finishedWeekOf, asksOf, sessionKinds,
  AEROBIC_NOTE, STEPS_NOTE, IDEAS_LEAD, IDEAS_NONE, COUNTS_NOTE, CHOSEN_LEAD, NOTHING_ARRIVED,
} from "../src/my-health/horizon/lightWeek.ts";

// Set on Tuesday 17 November 2026: six days, then weeks from Monday. Week 2 is Mon 30 Nov to Sun 6 Dec.
const H = { starts_on: "2026-11-17", ends_on: "2027-02-13", title: "Build fitness" };
const MON = "2026-11-30", THU = "2026-12-03";
const PLAN = [{ kind: "sessions_week", label: "Five sessions", n: 5 }, { kind: "zone2_min", label: "Zone 2", n: 110 }, { kind: "harder_min", label: "Harder", n: 20 }, { kind: "strength_week", label: "Strength", n: 2 }, { kind: "steps_day", label: "Steps", n: 6800 }];
const TARGETS = [{ marker: "dose", target_value: 1030 }, { marker: "zone2_week", target_value: 150 }, { marker: "steps", target_value: 8000 }];

/**
 * An invented person, Asha. `sessions` are this week's: [day offset from Monday, name, kind, minutes, zone 2 minutes
 * or null]. `earlier` are sessions of the weeks before. `steps` is a day's steps for each day that has arrived.
 */
function person({ sessions = [[0, "Badminton", "aerobic", 45, 24], [1, "Outdoor Walk (watch)", "aerobic", 30, 18], [2, "Strength", "strength", 25, null]], earlier = [], steps = 6900, signalDays = 3, upTo = THU } = {}) {
  const activities = [], signals = [];
  const add = (day, [, name, kind, min, z2]) => activities.push({ timestamp: `${day}T07:00:00`, activity_name: name, activity_type: kind, intensity_category: "moderate", duration_minutes: min, met_minutes: min * 5, ...(z2 != null ? { zone2_minutes: z2 } : {}) });
  for (const s of sessions) add(addDays(MON, s[0]), s);
  for (const s of earlier) add(addDays(MON, s[0]), s);
  for (let i = 0; i < signalDays; i++) signals.push({ day: addDays(MON, i), steps });
  return derivePerson({
    generated_at: upTo, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1981 },
    labs: [], imaging: [], reports: [], files: [], weeks: [], web_crf: [], web_body: [], app_labs: [], activities, app_crf: [], waist: [],
    profile: { weekly_met_hours_goal: 15, height_cm: 160, sex: "female", age: 45 },
    signals, weights: [], note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  });
}
const week = (o = {}, extra = {}) => lightWeekOf({ horizon: H, person: person(o), today: THU, rows: PLAN, targets: TARGETS, ...extra });
const amount = (w, key) => w.amounts.find((a) => a.key === key) ?? null;
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// ── the three amounts ──

test("the week is three amounts, each done of asked, read from the plan's own lines", () => {
  const w = week();
  assert.deepEqual([w.from, w.to, w.week, w.arrived], ["2026-11-30", "2026-12-06", 2, true]);
  assert.deepEqual(w.amounts.map((a) => a.key), ["aerobic", "strength", "steps"]);
  assert.deepEqual(w.amounts.map((a) => `${a.label}: ${a.figure} ${a.unit}`), ["Aerobic time: 42 of 110 min", "Strength: 1 of 2 sessions", "Steps: 6,900 of 6,800 a day"]);
  assert.deepEqual(w.amounts.map((a) => a.reached), [false, false, true]);
  assert.equal(amount(w, "aerobic").note, AEROBIC_NOTE);
  assert.equal(amount(w, "steps").note, STEPS_NOTE);
  assert.equal(amount(w, "strength").note, null);
  // the plan's steps line is the one asked, not the person's own steps number, while a plan carries one
  assert.equal(amount(w, "steps").of, 6800);
});

test("nothing is counted a second way: the amounts are the plan's own reader of the week", () => {
  const p = person();
  const d = doneOf(p, MON);
  const w = lightWeekOf({ horizon: H, person: p, today: THU, rows: PLAN, targets: TARGETS });
  assert.deepEqual([amount(w, "aerobic").done, amount(w, "strength").done, amount(w, "steps").done], [d.zone2, d.strength, d.steps]);
  const src = read("../src/my-health/horizon/lightWeek.ts");
  assert.match(src, /import \{ doneOf \} from "\.\/guidePlan\.ts";/);
  assert.match(src, /import \{ arrived, askedOf \} from "\.\/midweek\.ts";/);
});

test("an amount the horizon does not ask for is left out, and with none of the three there is no light week", () => {
  const two = week({}, { rows: [{ kind: "zone2_min", label: "Zone 2", n: 110 }, { kind: "strength_week", label: "Strength", n: 2 }], targets: [] });
  assert.deepEqual(two.amounts.map((a) => a.key), ["aerobic", "strength"]);
  assert.equal(week({}, { rows: [{ kind: "sessions_week", label: "Sessions", n: 4 }], targets: [{ marker: "dose", target_value: 1030 }] }), null);
  assert.equal(week({}, { rows: [], targets: [] }), null);
});

test("with no plan, the week asks the numbers the person set", () => {
  const w = week({}, { rows: [], targets: [{ marker: "zone2_week", target_value: 150 }, { marker: "strength_week", target_value: 1 }, { marker: "steps", target_value: 8000 }] });
  assert.deepEqual(w.amounts.map((a) => `${a.figure} ${a.unit}`), ["42 of 150 min", "1 of 1 session", "6,900 of 8,000 a day"]);
  assert.deepEqual(w.amounts.map((a) => a.reached), [false, true, false]);
});

test("a figure that has not arrived is left out, never drawn as a nought", () => {
  // nothing at all since Monday: what is asked is shown, with no figure for what is done
  const none = week({ sessions: [], signalDays: 0 });
  assert.equal(none.arrived, false);
  assert.deepEqual(none.amounts.map((a) => [a.done, a.figure, a.unit, a.reached]), [[null, "110", "min asked", false], [null, "2", "sessions asked", false], [null, "6,800", "a day asked", false]]);
  assert.match(NOTHING_ARRIVED, /^Nothing has arrived since Monday/);
  // sessions arrived and no day of steps did: the steps amount has no figure, the other two are counted
  const noSteps = week({ steps: null });
  assert.equal(noSteps.arrived, true);
  assert.deepEqual([amount(noSteps, "steps").done, amount(noSteps, "steps").figure, amount(noSteps, "steps").note], [null, "6,800", null]);
  assert.equal(amount(noSteps, "aerobic").figure, "42 of 110");
  // days arrived and no session did: no aerobic minutes is then a fact, and is said as one
  const quiet = week({ sessions: [] });
  assert.deepEqual([amount(quiet, "aerobic").figure, amount(quiet, "strength").figure], ["0 of 110", "0 of 2"]);
});

test("a week that is not judged has no amounts: the short first days, a paused week, a day outside the horizon", () => {
  assert.equal(lightWeekOf({ horizon: H, person: person(), today: "2026-11-20", rows: PLAN, targets: TARGETS }), null);
  assert.equal(lightWeekOf({ horizon: { ...H, pauses: [MON] }, person: person(), today: THU, rows: PLAN, targets: TARGETS }), null);
  assert.equal(lightWeekOf({ horizon: H, person: person(), today: "2027-03-04", rows: PLAN, targets: TARGETS }), null);
  assert.equal(lightWeekOf({ horizon: H, person: person(), today: "2026-11-10", rows: PLAN, targets: TARGETS }), null);
});

// ── my activities ──

test("the list is the board's ten, and yoga is on it with no idea of its own", () => {
  assert.deepEqual(ACTIVITIES.map((a) => a.label), ["Walking", "Cycling", "Swimming", "Badminton", "Aerobics class", "Kickboxing", "Yoga", "Strength at home", "Gym", "Running"]);
  assert.deepEqual([ACTIVITY_BY_KEY.yoga.idea, ACTIVITY_BY_KEY.yoga.fills], [null, []]);
  // every other activity has an idea and says what it is offered for
  for (const a of ACTIVITIES.filter((x) => x.key !== "yoga")) assert.ok(a.idea && a.fills.length, a.key);
  assert.match(CHOSEN_LEAD, /Nothing here changes what the week asks\.$/);
});

test("what the person ticked is what the ideas draw from", () => {
  const c = chosenOf({ activities: ["running", "swimming", "a horse", "swimming"], own: ["  Rowing   on the river  ", "rowing on the river", "Yoga", 7], place: "home" }, person(), THU);
  assert.deepEqual(c, { keys: ["swimming", "running"], own: ["Rowing on the river"], from: "chosen" });
  // an empty list is a choice too: nothing is put back from the sessions
  assert.deepEqual(chosenOf({ activities: [], own: [] }, person(), THU), { keys: [], own: [], from: "chosen" });
});

test("until anything is ticked, the list starts from the sessions of the last eight weeks, with walking", () => {
  const earlier = [[-7, "Swimming", "aerobic", 30, 26], [-14, "Tennis", "aerobic", 60, 30], [-21, "Tennis", "aerobic", 60, 28], [-10, "Other", "aerobic", 20, 5], [-9, "Yoga", "mixed", 40, 0], [-100, "Cycling", "aerobic", 50, 40]];
  const c = chosenOf(null, person({ earlier }), THU);
  assert.equal(c.from, "sessions");
  // walking always; badminton and the walk from this week; swimming and yoga from earlier; strength at home because a strength session was logged
  assert.deepEqual(c.keys, ["walking", "swimming", "badminton", "yoga", "strength_home"]);
  // a name the list does not hold is kept in the person's words; "Other" is not a name; a ride of fourteen weeks ago is too old
  assert.deepEqual(c.own, ["Tennis"]);
  // the place said at set-up decides where strength is offered
  assert.deepEqual(chosenOf({ place: "gym" }, person({ sessions: [] }), THU).keys, ["walking", "gym"]);
  assert.deepEqual(chosenOf({ place: "both" }, person({ sessions: [] }), THU).keys, ["walking", "strength_home", "gym"]);
  assert.deepEqual(chosenOf({ place: null }, person({ sessions: [] }), THU).keys, ["walking"]);
});

test("words of the person's own are kept short, few and single", () => {
  assert.deepEqual(cleanOwn(["Tennis", "tennis", "Squash", "Rowing", "Climbing"]), ["Tennis", "Squash", "Rowing"]);
  assert.equal(cleanOwn(["x".repeat(80)])[0].length, OWN_LENGTH);
  assert.equal(OWN_AT_MOST, 3);
  assert.deepEqual(cleanOwn(["Walking", "  ", null]), []);
  assert.deepEqual(cleanKeys(["gym", "nothing", "walking", "gym"]), ["walking", "gym"]);
  assert.deepEqual(["Outdoor Walk", "pool swim", "Functional Strength", "HIIT"].map(activityOfName), ["walking", "swimming", null, null]);
});

test("the horizon keeps the ticks with its other answers, and a horizon set before them reads as nothing ticked", () => {
  const kept = parseProgramme({ v: 1, goal: "build_fitness", aims: [], barriers: [], days: [0, 2], place: "home", writer: "guide", activities: ["running", "walking", "polo"], own: ["Tennis", 4, "y".repeat(90)] });
  assert.deepEqual(kept.activities, ["walking", "running"]);
  assert.deepEqual(kept.own, ["Tennis", "y".repeat(OWN_LENGTH)]);
  const before = parseProgramme({ v: 1, goal: "build_fitness", aims: [], barriers: [], days: [], place: null, writer: "guide" });
  assert.deepEqual([before.activities, before.own], [null, []]);
});

// ── ideas ──

const BOARD = { keys: ["walking", "swimming", "badminton", "aerobics", "kickboxing", "yoga", "strength_home"], own: [], from: "chosen" };

test("the board's week: five ideas from the ticked activities, for the amounts still short", () => {
  const ideas = ideasFor(week().amounts, BOARD);
  assert.equal(ideas.state, "ideas");
  assert.equal(ideas.lead, "From the activities you chose. Use one, or do your own thing: whatever you log counts.");
  assert.deepEqual(ideas.ideas.map((i) => `${i.text} · ${i.fills}`), [
    "A swim, 30 minutes · aerobic time",
    "Badminton with a friend, 45 minutes · aerobic time",
    "An aerobics class on YouTube, 30 minutes · aerobic time",
    "A brisk walk after dinner, 20 minutes · aerobic time, steps",
    "Five moves at home · a strength session",
  ]);
  assert.equal(ideas.ideas.length, IDEAS_AT_MOST);
});

test("take cycling off and no idea mentions a bike; yoga is never offered as aerobic time or as strength", () => {
  const all = { keys: ACTIVITIES.map((a) => a.key), own: [], from: "chosen" };
  assert.ok(ideasFor(week().amounts, all).ideas.some((i) => /bike/.test(i.text)));
  for (const set of [BOARD, { ...all, keys: all.keys.filter((k) => k !== "cycling") }]) {
    const texts = ideasFor(week().amounts, set).ideas.map((i) => i.text).join(" | ");
    assert.doesNotMatch(texts, /bike|cycl/i);
    assert.doesNotMatch(texts, /yoga/i);
  }
  assert.equal(ideasFor(week().amounts, { keys: ["yoga"], own: [], from: "chosen" }).state, "none");
});

test("ideas are offered only for an amount still short, and when all are reached the page says so in one line", () => {
  const amounts = (a, s, st) => week({ sessions: [[0, "Walk", "aerobic", a + 5, a], ...Array.from({ length: s }, (_, i) => [i, "Strength", "strength", 25, null])], steps: st }).amounts;
  // aerobic time reached, strength short: the strength idea and nothing else
  assert.deepEqual(ideasFor(amounts(120, 1, 7000), BOARD).ideas.map((i) => i.text), ["Five moves at home"]);
  // only steps short: a walk, and nothing that fills aerobic time alone
  assert.deepEqual(ideasFor(amounts(120, 2, 5000), BOARD).ideas.map((i) => i.text), ["A brisk walk after dinner, 20 minutes"]);
  // all three reached
  assert.deepEqual(ideasFor(amounts(120, 2, 7000), BOARD), { state: "reached", line: "All three amounts are reached. Nothing more is asked this week." });
  // two asked, both reached
  const two = lightWeekOf({ horizon: H, person: person({ sessions: [[0, "Walk", "aerobic", 125, 120], [1, "Strength", "strength", 25, null], [2, "Strength", "strength", 25, null]] }), today: THU, rows: PLAN.filter((r) => r.kind !== "steps_day"), targets: [] });
  assert.equal(ideasFor(two.amounts, BOARD).line, "Both amounts are reached. Nothing more is asked this week.");
  // something short and nothing ticked is offered for it
  assert.deepEqual(ideasFor(amounts(120, 1, 7000), { keys: ["walking", "swimming"], own: [], from: "chosen" }), { state: "none", line: IDEAS_NONE });
});

test("an idea says only what the week asks for, the person's own words are offered last, and the lead says where the list came from", () => {
  const noSteps = lightWeekOf({ horizon: H, person: person(), today: THU, rows: PLAN.filter((r) => r.kind !== "steps_day"), targets: [] });
  const walk = ideasFor(noSteps.amounts, { keys: ["walking"], own: ["Tennis"], from: "sessions" });
  assert.equal(walk.lead, IDEAS_LEAD.sessions);
  assert.deepEqual(walk.ideas.map((i) => `${i.text} · ${i.fills}`), ["Tennis · your own", "A brisk walk after dinner, 20 minutes · aerobic time"]);
  // no more than five, however much is ticked
  const many = ideasFor(week().amounts, { keys: ACTIVITIES.map((a) => a.key), own: ["Tennis", "Rowing"], from: "chosen" });
  assert.equal(many.ideas.length, IDEAS_AT_MOST);
});

// ── whatever you log counts ──

test("each session logged this week says what it filled, read from the session and not from its name", () => {
  const p = person({ sessions: [[0, "Badminton", "aerobic", 45, 24], [1, "Functional Strength Training", "strength", 25, null], [2, "Yoga", "mixed", 40, 0], [2, "Swimming, pool", "aerobic", 30, null]] });
  assert.deepEqual(loggedLines(p, MON, addDays(THU, 1)).map((l) => [l.logged, l.filled, l.kind]), [
    ["Badminton · 45 min", "24 aerobic minutes", "aerobic"],
    ["Functional strength training · 25 min", "1 strength session", "strength"],
    ["Yoga · 40 min", "A session and 40 active minutes. Not aerobic time, and not a strength session.", "active"],
    ["Swimming · 30 min", "A session and 30 minutes. No heart rate came with it, so it adds no aerobic time.", "no_heart_rate"],
  ]);
  // a week before this one is not this week's
  assert.deepEqual(loggedLines(p, addDays(MON, -7), MON), []);
});

test("the page tells the truth about a session with no heart rate: it is a session, and it adds no aerobic time", () => {
  // the counting itself: a swim with no heart rate adds nothing to the week's aerobic minutes
  const withHr = week({ sessions: [[0, "Swimming", "aerobic", 30, 26]] }), without = week({ sessions: [[0, "Swimming", "aerobic", 30, null]] });
  assert.deepEqual([amount(withHr, "aerobic").done, amount(without, "aerobic").done], [26, 0]);
  assert.equal(COUNTS_NOTE, "Your heart rate decides the line, not the name of the activity. A session that arrives with no heart rate is still a session, and it adds no aerobic time.");
  // the board's "every session counts in full" is not what the week counts today, so no page says it
  for (const f of ["../src/my-health/horizon/lightWeek.ts", "../src/my-health/views/LightWeek.tsx", "../src/data/activities.ts"]) assert.doesNotMatch(read(f).replace(/^\s*(\/\/|\*|\/\*).*$/gm, ""), /counts in full/);
});

// ── where it is drawn ──

test("the amounts are the first thing on the glance and the head of This week, for a horizon that is running", () => {
  const view = read("../src/my-health/views/Horizon.tsx");
  // only for the owner's paged horizon, never on one that has stopped: a kept horizon (Pro ended) is not paged
  assert.match(view, /const light = useMemo\(\(\) => \(paged && person && !closed \? lightWeekOf\(/);
  const glanceAt = view.indexOf('{paged && page === "glance" ? lightCard(true) : null}');
  assert.ok(glanceAt > 0 && glanceAt < view.indexOf('{paged && page === "glance" ? glance : null}'));
  const weekAt = view.indexOf('{paged && page === "week" ? lightCard(false) : null}');
  assert.ok(weekAt > 0 && weekAt < view.indexOf('{paged && page === "week" && !closed ? weekDays : null}'));
  assert.match(view, /<LoggedCard lines=\{loggedLines\(person, lightNow\.from, addDays\(today, 1\)\)\} \/>/);
  // a Guide's plan that has not begun asks nothing yet, so no amounts are shown before its first Monday
  assert.match(view, /const lightNow = planView && !planView\.started \? null : light;/);
  // what the glance showed before is one tap away, not shown twice
  assert.match(view, /\{lightNow \? null : tile\("This week",/);
});

test("no dead button: each way further in is drawn only where its page exists", () => {
  const view = read("../src/my-health/views/Horizon.tsx"), card = read("../src/my-health/views/LightWeek.tsx");
  assert.match(view, /onSeven=\{onGlance \? \(\) => goPage\("week"\) : undefined\}/);
  assert.match(view, /onPlan=\{planView \? \(\) => goPage\("science"\) : undefined\}/);
  assert.match(card, /\{onSeven \? <button/);
  assert.match(card, /\{onPlan \? <button/);
  // the activities are kept with the horizon's programme, so a horizon of the person's own targets is not offered the chips
  assert.match(view, /\{programme \? <MyActivities /);
  assert.match(view, /saveProgramme\(deps\.supabase, h\.id, \{ \.\.\.programme, activities: next\.activities, own: next\.own \}\)/);
});

test("every block carries a hook, so the page can be checked signed in", () => {
  const card = read("../src/my-health/views/LightWeek.tsx");
  for (const hook of ['data-light="week"', 'data-light="amounts"', "data-amount={a.key}", 'data-light="ideas"', 'data-light="activities"', 'data-light="counts"', 'data-light="nothing"', "data-idea={i.key}", "data-activity={a.key}", "data-logged={l.kind}"]) assert.ok(card.includes(hook), hook);
  // figures use the site's one figure style
  assert.match(card, /<span class="t-figure text-text">\{a\.figure\}<\/span>/);
});

// ── Monday's email reads the same amounts (board 09; 26 November 2026) ──

const NEXT_MON = "2026-12-07";
const NEXT_PLAN = [{ kind: "sessions_week", label: "Five sessions", n: 5 }, { kind: "zone2_min", label: "Zone 2", n: 110 }, { kind: "harder_min", label: "Harder", n: 20 }, { kind: "strength_week", label: "Strength", n: 2 }, { kind: "steps_day", label: "Steps", n: 6930 }];
const whole = (o = {}) => person({ signalDays: 7, upTo: NEXT_MON, ...o });
const finished = (o = {}, extra = {}) => finishedWeekOf({ horizon: H, person: whole(o), monday: MON, rows: PLAN, targets: TARGETS, ...extra });
const WHY = "Zone 2 was more than five minutes under its line, so the plan asks for the same zone 2 minutes again. The 68 minutes are not added to this week.";

test("the week that ended is the page's own week, asked on its Sunday: done of asked, and one word each", () => {
  const f = finished();
  assert.deepEqual([f.from, f.to, f.week], ["2026-11-30", "2026-12-06", 2]);
  assert.deepEqual(f.amounts.map((a) => `${a.label} · ${a.figure} · ${a.word}`), ["Aerobic time · 42 of 110 min · 68 short", "Strength · 1 of 2 sessions · 1 short", "Steps · 6,900 of 6,800 a day · Reached"]);
  assert.deepEqual(f.amounts.map((a) => a.state), ["short", "short", "reached"]);
  // the same figures the page showed on the week's last day
  const page = lightWeekOf({ horizon: H, person: whole(), today: "2026-12-06", rows: PLAN, targets: TARGETS });
  assert.deepEqual(f.amounts.map((a) => [a.done, a.of]), page.amounts.map((a) => [a.done, a.of]));
  // steps short are written with their thousands
  assert.equal(finished({ steps: 5600 }).amounts.find((a) => a.key === "steps").word, "1,200 short");
});

test("the plan's own allowance: a week within five minutes of its aerobic line is not called short", () => {
  const near = { sessions: [[0, "Badminton", "aerobic", 60, 56], [1, "Swim", "aerobic", 60, 50], [2, "Strength", "strength", 25, null], [4, "Strength", "strength", 25, null]] };
  assert.equal(finished(near).amounts[0].word, "4 short");                       // with no plan of the Guide's there is no allowance
  const a = finished(near, { within: 5 }).amounts[0];
  assert.deepEqual([a.figure, a.word, a.state], ["106 of 110 min", "Within 5 min", "reached"]);
  assert.equal(finished({ sessions: [[0, "Badminton", "aerobic", 60, 50]] }, { within: 5 }).amounts[0].word, "60 short");
  // the allowance is on aerobic time alone
  assert.equal(finished(near, { within: 5 }).amounts[1].word, "Reached");
});

test("a week nothing arrived for says what was asked and never a nought; a week that is not judged has no part B", () => {
  const none = finishedWeekOf({ horizon: H, person: person({ sessions: [], signalDays: 0, upTo: NEXT_MON }), monday: MON, rows: PLAN, targets: TARGETS });
  assert.deepEqual(none.amounts.map((a) => `${a.figure} · ${a.word}`), ["110 min asked · Nothing arrived", "2 sessions asked · Nothing arrived", "6,800 a day asked · Nothing arrived"]);
  assert.ok(none.amounts.every((a) => a.state === "none" && a.done === null));
  // the horizon's first days (Tuesday to Sunday) are not a week from Monday
  assert.equal(finishedWeekOf({ horizon: H, person: whole(), monday: "2026-11-16", rows: PLAN, targets: TARGETS }), null);
  assert.equal(finishedWeekOf({ horizon: { ...H, pauses: [MON] }, person: whole(), monday: MON, rows: PLAN, targets: TARGETS }), null);
});

test("the week that begins: each ask, and at most one sentence written by rule", () => {
  const chosen = { keys: ["walking", "swimming", "strength_home"], own: [], from: "chosen" };
  const w = asksOf({ horizon: H, person: whole(), today: NEXT_MON, rows: NEXT_PLAN, targets: TARGETS, finished: finished(), chosen, why: WHY });
  assert.deepEqual([w.from, w.week], [NEXT_MON, 3]);
  assert.deepEqual(w.asks.map((a) => `${a.label} · ${a.ask}`), ["Aerobic time · 110 min", "Strength · 2 sessions", "Steps · 6,930 a day"]);
  // aerobic time: the plan's own sentence, as it is handed in; no idea is added to it
  assert.equal(w.asks[0].line, WHY);
  // strength was one short: one way, from the person's activities
  assert.equal(w.asks[1].line, "Five moves at home counts as one.");
  // steps were reached: only that the plan's figure went up
  assert.equal(w.asks[2].line, "130 more a day than last week asked.");
});

test("where last week was short, one way to fill it comes from the ticked activities and from nowhere else", () => {
  const short = finished({ steps: 5600 });
  const base = { horizon: H, person: whole(), today: NEXT_MON, rows: NEXT_PLAN, targets: TARGETS, finished: short };
  const line = (chosen, key, extra = {}) => asksOf({ ...base, chosen, ...extra }).asks.find((a) => a.key === key).line;
  const mine = { keys: ["walking", "swimming", "gym"], own: [], from: "chosen" };
  // no plan of the Guide's: aerobic time gets one way, a swim before the walk (the page's own order)
  assert.equal(line(mine, "aerobic"), "One way: a swim, 30 minutes.");
  assert.equal(line(mine, "strength"), "A session at the gym counts as one.");
  assert.equal(line(mine, "steps"), "130 more a day than last week asked; one way is a brisk walk after dinner, 20 minutes.");
  // the figure did not go up: the way alone
  assert.equal(line(mine, "steps", { rows: PLAN }), "One way: a brisk walk after dinner, 20 minutes.");
  // cycling is off the list and nothing mentions a bike; with nothing ticked that fits, nothing is said
  const none = { keys: ["yoga"], own: [], from: "chosen" };
  assert.deepEqual(["aerobic", "strength", "steps"].map((k) => line(none, k, { rows: PLAN })), [null, null, null]);
  // no activities handed in (a horizon with no programme): the asks, and no way
  assert.deepEqual(asksOf({ ...base, rows: PLAN, chosen: null }).asks.map((a) => a.line), [null, null, null]);
  // a week that reached everything is given no way at all
  const all = finished({ sessions: [[0, "Badminton", "aerobic", 60, 60], [1, "Swim", "aerobic", 60, 55], [2, "Strength", "strength", 25, null], [4, "Strength", "strength", 25, null]] });
  assert.deepEqual(asksOf({ ...base, finished: all, rows: PLAN, chosen: mine }).asks.map((a) => a.line), [null, null, null]);
});

test("where the plan judged last week on steps or on the strength sets, its own sentence is said, and the way follows it", () => {
  const chosen = { keys: ["walking", "swimming", "strength_home"], own: [], from: "chosen" };
  const base = { horizon: H, person: whole(), today: NEXT_MON, rows: NEXT_PLAN, targets: TARGETS, chosen, why: WHY };
  const line = (o, key) => asksOf({ ...base, ...o }).asks.find((a) => a.key === key).line;
  // steps reached, and the plan moved them up: the plan's sentence in place of "more than last week asked"
  const up = "Steps reached their line, so this week asks 130 more a day.";
  assert.equal(line({ finished: finished(), whySteps: up }, "steps"), up);
  // steps short: the plan's sentence, then one way from the person's activities
  const again = "Steps were under their line, so the plan asks for the same 6,800 a day again.";
  assert.equal(line({ finished: finished({ steps: 5600 }), rows: PLAN, whySteps: again }, "steps"), `${again} One way: a brisk walk after dinner, 20 minutes.`);
  // strength: the plan's sentence on the sets, then the way when the week was short
  const stay = "Strength was under its line, so the sets stay at one to two for now.";
  assert.equal(line({ finished: finished(), whyStrength: stay }, "strength"), `${stay} Five moves at home counts as one.`);
  const moved = "Strength reached its line, so this week moves to two to three sets.";
  const all = finished({ sessions: [[0, "Badminton", "aerobic", 60, 60], [1, "Swim", "aerobic", 60, 55], [2, "Strength", "strength", 25, null], [4, "Strength", "strength", 25, null]] });
  assert.equal(line({ finished: all, whyStrength: moved }, "strength"), moved);
  // nothing handed in: the lines are the ones they were
  assert.equal(line({ finished: finished() }, "steps"), "130 more a day than last week asked.");
  assert.equal(line({ finished: finished(), whySteps: null, whyStrength: null }, "strength"), "Five moves at home counts as one.");
  // aerobic time is not touched by either
  assert.equal(line({ finished: finished(), whySteps: up, whyStrength: stay }, "aerobic"), WHY);
});

test("the week that begins has no asks where the page has no light week: the horizon's short last days", () => {
  const last = "2027-02-08";   // Monday of the days that end on Saturday 13 February
  assert.equal(asksOf({ horizon: H, person: whole(), today: last, rows: NEXT_PLAN, targets: TARGETS, finished: null, chosen: null }), null);
});

test("the opening line's sessions: how many, their minutes, and each kind once with its count, named by the list", () => {
  const p = whole({ sessions: [[0, "Outdoor Walk (watch)", "aerobic", 30, 18], [1, "Badminton", "aerobic", 45, 24], [2, "Walking", "aerobic", 20, 12], [3, "Pool Swim", "aerobic", 30, 26], [4, "Strength", "strength", 30, null], [5, "Other", "aerobic", 15, 5], [5, "Rowing, indoor", "aerobic", 10, 4]] });
  const k = sessionKinds(p, MON, NEXT_MON);
  assert.deepEqual([k.sessions, k.minutes], [7, 180]);
  assert.deepEqual(k.kinds, [{ name: "walking", n: 2 }, { name: "badminton", n: 1 }, { name: "swimming", n: 1 }, { name: "strength", n: 1 }, { name: "rowing", n: 1 }, { name: "other", n: 1 }]);
  assert.deepEqual(sessionKinds(p, NEXT_MON, addDays(NEXT_MON, 7)), { sessions: 0, minutes: 0, kinds: [] });
});
