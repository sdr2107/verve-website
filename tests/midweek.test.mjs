// The midweek note (board 15 of "Verve, Horizon as a programme"): Thursday's four lines, counted. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import { midweekOf, askedOf, MIDWEEK_HEADS } from "../src/my-health/horizon/midweek.ts";

// Set on Tuesday 17 November 2026: six days, then weeks from Monday. Week 2 is Mon 30 Nov to Sun 6 Dec.
const H = { starts_on: "2026-11-17", ends_on: "2027-02-13", title: "A wedding" };
const THU = "2026-12-03";
const PLAN = [{ kind: "zone2_min", label: "Zone 2", n: 80 }, { kind: "strength_week", label: "Strength", n: 2 }, { kind: "harder_min", label: "Harder", n: 100 }, { kind: "steps_day", label: "Steps", n: 7400 }];
const TARGETS = [{ marker: "dose", target_value: 1030 }, { marker: "zone2_week", target_value: 150 }];

/** An invented person. `week2` is this week's days from Monday: [zone 2 minutes, "strength" or null]; `week1` the week before. */
function person({ week2 = [[14, null], [38, null], [0, "strength"]], week1 = [[20, null], [0, "strength"], [25, null], [0, null], [30, null]], steps = null, upTo = THU } = {}) {
  const activities = [], signals = [];
  const lay = (monday, days) => days.forEach(([z2, extra], i) => {
    const day = addDays(monday, i);
    if (day >= upTo) return;
    if (z2 > 0) activities.push({ timestamp: `${day}T07:00:00`, activity_name: "Walking", activity_type: "aerobic", intensity_category: "moderate", duration_minutes: z2 + 10, met_minutes: z2 * 5, zone2_minutes: z2 });
    if (extra === "strength") activities.push({ timestamp: `${day}T18:00:00`, activity_name: "Strength", activity_type: "strength", intensity_category: "moderate", duration_minutes: 40, met_minutes: 0 });
    signals.push({ day, zone2_min: z2, zone3_min: 0, steps: steps ? steps[day] ?? steps.all : null });
  });
  lay("2026-11-23", week1); lay("2026-11-30", week2);
  return derivePerson({
    generated_at: upTo, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1981 },
    labs: [], imaging: [], reports: [], files: [], weeks: [], web_crf: [], web_body: [], app_labs: [], activities, app_crf: [], waist: [],
    profile: { weekly_met_hours_goal: 15, height_cm: 160, sex: "female", age: 45 },
    signals, weights: [], note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  });
}
const note = (o = {}, extra = {}) => midweekOf({ horizon: H, person: person(o), today: THU, plan: PLAN, targets: TARGETS, ...extra });
const line = (n, head) => n.lines.find((l) => l.head === head)?.text ?? null;

test("Thursday's note counts the week to Wednesday night against the plan's lines", () => {
  const n = note();
  assert.deepEqual([n.on, n.readTo, n.week, n.weeks, n.state], ["2026-12-03", "2026-12-02", 2, 11, "counting"]);
  assert.equal(line(n, MIDWEEK_HEADS.soFar), "52 of 80 zone 2 minutes. 1 of 2 strength sessions. 260 of 1,030 MET-minutes.");
  assert.equal(line(n, MIDWEEK_HEADS.left), "28 zone 2 minutes and 1 strength session, with four days to go.");
  assert.equal(line(n, MIDWEEK_HEADS.fit), "One session of 30 minutes covers the zone 2 line. One strength session is still ahead. Both fit before Sunday.");
  assert.equal(line(n, MIDWEEK_HEADS.did), "Tuesday's 38 minutes is your longest zone 2 day on this horizon.");
  // the strip: three days read, the note's own day, three ahead
  assert.deepEqual(n.days.map((d) => d.kind), ["read", "read", "read", "note", "ahead", "ahead", "ahead"]);
  assert.deepEqual(n.days.slice(0, 3).map((d) => d.text), ["14 min", "38 min", "strength"]);
});

test("the note is Thursday's: it is not written before, and it stays as written until Monday", () => {
  for (const day of ["2026-11-30", "2026-12-01", "2026-12-02"]) assert.equal(midweekOf({ horizon: H, person: person(), today: day, plan: PLAN, targets: TARGETS }), null);
  // read on Saturday with Thursday's and Friday's sessions on file: still Monday to Wednesday
  const later = person({ week2: [[14, null], [38, null], [0, "strength"], [45, null], [30, "strength"]], upTo: "2026-12-06" });
  const sat = midweekOf({ horizon: H, person: later, today: "2026-12-05", plan: PLAN, targets: TARGETS });
  assert.equal(sat.on, "2026-12-03");
  assert.equal(line(sat, MIDWEEK_HEADS.soFar), "52 of 80 zone 2 minutes. 1 of 2 strength sessions. 260 of 1,030 MET-minutes.");
});

test("no note in a week that is not judged: the short first days, a paused week, a day outside the horizon", () => {
  assert.equal(midweekOf({ horizon: H, person: person(), today: "2026-11-20", plan: PLAN, targets: TARGETS }), null);   // Tue to Sun, six days
  assert.equal(midweekOf({ horizon: { ...H, pauses: ["2026-11-30"] }, person: person(), today: THU, plan: PLAN, targets: TARGETS }), null);
  assert.equal(midweekOf({ horizon: H, person: person(), today: "2027-03-04", plan: PLAN, targets: TARGETS }), null);
  // and none when the week asks nothing that can be counted
  assert.equal(midweekOf({ horizon: H, person: person(), today: THU, plan: [], targets: [{ marker: "mets", target_value: 9 }] }), null);
});

test("the lines done: nothing more is asked, and the note does not ask for more", () => {
  const n = note({ week2: [[40, "strength"], [44, null], [0, "strength"]] });
  assert.equal(n.state, "done");
  assert.equal(line(n, MIDWEEK_HEADS.soFar).startsWith("84 of 80 zone 2 minutes. 2 of 2 strength sessions."), true);
  assert.equal(line(n, MIDWEEK_HEADS.left), "Nothing. The week's lines are done with four days to go. Nothing more is asked this week.");
  assert.equal(line(n, MIDWEEK_HEADS.fit), null);
});

test("out of reach is said, and the shortfall is never carried into the next week", () => {
  // the horizon's longest day held 30 minutes; 300 are asked and 10 are done
  const n = note({ week2: [[10, null], [0, null], [0, null]] }, { plan: [{ kind: "zone2_min", label: "Zone 2", n: 300 }] });
  assert.equal(n.state, "out_of_reach");
  assert.equal(line(n, MIDWEEK_HEADS.fit), "290 zone 2 minutes in four days is more than this horizon's longest days have held. The line is asked again next week. It is never added to it.");
});

test("nothing arrived is said plainly, with what to do, and is never a zero", () => {
  const n = note({ week2: [], upTo: THU });
  assert.equal(n.state, "nothing");
  assert.equal(line(n, MIDWEEK_HEADS.soFar), "Nothing has arrived since Monday, so there is nothing to count yet.");
  assert.ok(!n.lines.some((l) => /\b0 of\b/.test(l.text)));
  // days that arrived with nothing in them are a count, not a silence
  const quiet = note({ week2: [[0, null], [0, null], [0, null]] });
  assert.equal(quiet.state, "counting");
  assert.equal(line(quiet, MIDWEEK_HEADS.soFar).startsWith("0 of 80 zone 2 minutes."), true);
});

test("without a plan the week is read against the person's own weekly numbers; harder minutes and steps are never asked for", () => {
  assert.deepEqual(askedOf(PLAN, TARGETS), { zone2: 80, strength: 2, sessions: null, dose: 1030 });
  assert.deepEqual(askedOf([], TARGETS), { zone2: 150, strength: null, sessions: null, dose: 1030 });
  assert.deepEqual(askedOf([{ kind: "sessions_week", label: "Sessions", n: 4 }], []), { zone2: null, strength: null, sessions: 4, dose: null });
  const n = midweekOf({ horizon: H, person: person(), today: THU, plan: [], targets: TARGETS });
  assert.equal(line(n, MIDWEEK_HEADS.left), "98 zone 2 minutes, with four days to go.");
  for (const l of n.lines) assert.ok(!/harder|steps a day/i.test(l.text) || l.head === MIDWEEK_HEADS.did);
});

test("one thing you did: true lines from a fixed list, about the work, and none when none is true", () => {
  // strength by Wednesday for the first time (the week before had it on Tuesday, so this is not a first)
  assert.equal(line(note({ week2: [[14, null], [20, null], [0, "strength"]] }), MIDWEEK_HEADS.did), null);
  const first = note({ week1: [[20, null], [0, null], [25, null], [0, "strength"], [30, null]], week2: [[14, null], [20, null], [0, "strength"]] });
  assert.equal(line(first, MIDWEEK_HEADS.did), "This is the first week on this horizon with a strength session done by Wednesday.");
  // nothing here praises the person or compares them with anyone
  for (const n of [note(), first]) for (const l of n.lines) assert.ok(!/great|well done|good job|amazing|proud|better than|others/i.test(l.text), l.text);
});
