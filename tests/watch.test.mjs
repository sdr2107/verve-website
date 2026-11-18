// Adding a marker to a horizon's draft, and watching one (board 19 of "Verve, Horizon as a programme"): what can be
// added, how each may be held, and the words of a watched row. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OFTEN_ADDED, BLOOD_WATCHED, addChoices, waysFor, opensOn, modeFor, wayOf, watchedStart, watchedLine, isBlood } from "../src/my-health/horizon/watch.ts";
import { MARKERS, TARGET_MARKERS, BLOOD_TARGETS_OPEN, isTargetable } from "../src/my-health/horizon/derive.ts";
import { GOALS } from "../src/data/programme.ts";

const keys = (xs) => xs.map((c) => c.def.key);
const all = (lists) => [...keys(lists.often), ...lists.groups.flatMap((g) => keys(g.items)), ...keys(lists.blood)];

test("the picker lists every marker the page can follow, once, less the goal's own", () => {
  const fitness = GOALS.find((g) => g.key === "build_fitness").markers.map((m) => m.marker);
  const lists = addChoices({ taken: fitness, canWatch: true });
  // the eight often added, in the board's order: none of them is one of this goal's
  assert.deepEqual(keys(lists.often), OFTEN_ADDED);
  assert.deepEqual(keys(lists.often), ["steps", "grip", "chair_stands", "weight", "waist", "sleep", "hrv", "longest_session"]);
  assert.deepEqual(lists.groups.map((g) => g.label), ["Movement", "Sleep and vitals", "Body"]);
  assert.deepEqual(keys(lists.groups[0].items), ["sessions_week", "vigorous_week", "background", "sitting", "pal", "cadence"]);
  assert.deepEqual(keys(lists.groups[1].items), ["sri", "hrr", "bp", "breathing", "spo2"]);
  assert.deepEqual(keys(lists.groups[2].items), ["almi", "body_fat", "ffmi", "gait_speed", "balance", "sppb"]);
  assert.deepEqual(keys(lists.blood), BLOOD_WATCHED);
  const listed = all(lists);
  assert.equal(new Set(listed).size, listed.length, "no marker is listed twice");
  // every marker of the catalogue is either the goal's, listed, or VO2max (Fitness in another unit, never listed)
  for (const m of MARKERS) assert.ok(fitness.includes(m.key) || listed.includes(m.key) || m.key === "vo2", m.key);
  assert.ok(!listed.includes("vo2") && !listed.includes("mets") && !listed.includes("rhr"));
});

test("a goal without fitness offers it, under its own group; waist is offered wherever the goal does not hold it", () => {
  const weight = GOALS.find((g) => g.key === "lose_weight").markers.map((m) => m.marker);
  const lists = addChoices({ taken: weight, canWatch: true });
  assert.deepEqual(lists.groups[0].label, "Fitness");
  assert.deepEqual(keys(lists.groups[0].items), ["mets"]);
  // this goal already ticks weight, waist, steps, grip and the chair stand: they are not offered again
  assert.deepEqual(keys(lists.often), ["sleep", "hrv", "longest_session"]);
  for (const g of GOALS) {
    const own = g.markers.map((m) => m.marker);
    assert.equal(all(addChoices({ taken: own, canWatch: true })).includes("waist"), !own.includes("waist"), g.key);
  }
});

test("a blood marker can only be watched, and is never a target", () => {
  // the switch the lawyers' review holds is untouched: no blood marker is offered as a target anywhere
  assert.equal(BLOOD_TARGETS_OPEN, false);
  for (const k of BLOOD_WATCHED) {
    assert.ok(isBlood(k));
    assert.equal(isTargetable(k), false);
    assert.ok(!TARGET_MARKERS.some((m) => m.key === k));
    assert.deepEqual(waysFor(k, { canWatch: true }), ["watch"]);
    assert.equal(opensOn(k, { canWatch: true }), "watch");
    // with nowhere to keep a watched row, a blood marker cannot be added at all
    assert.deepEqual(waysFor(k, { canWatch: false }), []);
    assert.equal(opensOn(k, { canWatch: false }), null);
  }
  assert.deepEqual(addChoices({ taken: [], canWatch: false }).blood, []);
  // every blood marker of the catalogue is in the watched list
  assert.deepEqual(MARKERS.filter((m) => m.kind === "blood").map((m) => m.key).sort(), [...BLOOD_WATCHED].sort());
});

test("the picker opens on the way that suits the marker, and Hold remembers its kind", () => {
  assert.equal(opensOn("steps"), "reach");
  assert.equal(opensOn("waist"), "reach");
  assert.equal(opensOn("grip"), "floor");
  assert.equal(opensOn("chair_stands"), "ceiling");
  assert.equal(opensOn("sitting"), "ceiling");
  assert.equal(opensOn("rhr"), "watch");
  assert.equal(opensOn("hrv"), "watch");
  // the four added on 18 November 2026: the weekly counts to reach, the two tests to hold
  assert.deepEqual(["sessions_week", "vigorous_week", "gait_speed", "balance"].map((k) => opensOn(k)), ["reach", "reach", "floor", "floor"]);
  // nowhere to keep a watched row: a marker that suits Watch opens on a number
  assert.equal(opensOn("hrv", { canWatch: false }), "reach");
  assert.deepEqual(waysFor("steps", { canWatch: false }), ["reach", "hold"]);
  assert.deepEqual(waysFor("steps"), ["reach", "hold", "watch"]);
  assert.equal(wayOf("band"), "hold");
  assert.equal(modeFor("steps", "hold"), "floor");
  assert.equal(modeFor("chair_stands", "hold"), "ceiling");
  assert.equal(modeFor("weight", "hold", "band"), "band");
  assert.equal(modeFor("weight", "watch", "band"), "watch");
});

test("a day under four full weeks away gives a number only to what a week can count", () => {
  assert.deepEqual(waysFor("steps", { short: true, canWatch: true }), ["reach", "hold", "watch"]);
  assert.deepEqual(waysFor("waist", { short: true, canWatch: true }), ["watch"]);
  assert.equal(opensOn("waist", { short: true, canWatch: true }), "watch");
  assert.deepEqual(waysFor("waist", { short: true, canWatch: false }), []);
  const lists = addChoices({ taken: [], short: true, canWatch: true });
  assert.equal(lists.often.find((c) => c.def.key === "waist").watchOnly, true);
  assert.equal(lists.often.find((c) => c.def.key === "steps").watchOnly, false);
  // with nothing to watch, a short day lists only what a week can count
  assert.deepEqual(all(addChoices({ taken: [], short: true, canWatch: false })).sort(), ["dose", "longest_session", "sessions_week", "steps", "strength_week", "vigorous_week", "zone2_week"]);
});

test("a marker nothing is sending is shown and cannot be picked", () => {
  const lists = addChoices({ taken: [], canWatch: true, canFollow: (m) => m !== "hrr" });
  const vitals = lists.groups.find((g) => g.key === "sleep_vitals").items;
  assert.equal(vitals.find((c) => c.def.key === "hrr").missing, true);
  assert.equal(vitals.find((c) => c.def.key === "bp").missing, false);
});

test("a watched row keeps where the marker stood, and asks nothing of it", () => {
  assert.deepEqual(watchedStart("rhr", { value: 57.44, on: "2026-11-17", unit: "bpm", writer: null }, "2026-11-18"), { marker: "rhr", unit: "bpm", start_value: 57.4, start_on: "2026-11-17" });
  assert.deepEqual(watchedStart("ldl", null, "2026-11-18"), { marker: "ldl", unit: "mg/dL", start_value: null, start_on: "2026-11-18" });
});

test("a watched row says the value, the day and what it was, and nothing else", () => {
  const rhr = watchedLine({ marker: "rhr", unit: "bpm", start_value: 58, start_on: "2026-11-10" }, { value: 57.2, on: "2026-11-17", unit: "bpm", writer: null });
  assert.deepEqual([rhr.label, rhr.how, rhr.value, rhr.words], ["Resting heart rate", "bpm · seven-morning average", "57", "Was 58 when the horizon was set."]);
  // one added to a horizon already running says so
  assert.equal(watchedLine({ marker: "rhr", unit: "bpm", start_value: 58, start_on: "2026-11-10" }, { value: 57, on: "2026-11-17", unit: "bpm", writer: null }, { withHorizon: false }).words, "Was 58 when you began to watch it.");
  assert.equal(watchedLine({ marker: "steps", unit: "steps", start_value: null, start_on: "2026-11-10" }, null).words, "No reading on file.");
  assert.equal(watchedLine({ marker: "hrv", unit: "ms", start_value: 40, start_on: "2026-11-10" }, null, { paused: "Paused · nothing is sending this reading" }).words, "Paused · nothing is sending this reading");
});

test("a watched blood marker: its report's day, the one before, and the usual swing in In depth's words", () => {
  const start = { marker: "ldl", unit: "mg/dL", start_value: 112, start_on: "2026-11-03" };
  const same = watchedLine(start, { value: 112, on: "2026-11-03", unit: "mg/dL", writer: null });
  assert.deepEqual([same.how, same.value, same.words], ["mg/dL · from your reports", "112", "Report of 3 November. No newer report is on file."]);
  const newer = watchedLine(start, { value: 104, on: "2027-02-09", unit: "mg/dL", writer: null });
  assert.equal(newer.value, "104");
  // a figure keeps the decimals it has, and loses only a trailing zero
  assert.equal(watchedLine({ marker: "hba1c", unit: "%", start_value: 5.6, start_on: "2026-11-03" }, { value: 5.6, on: "2026-11-03", unit: "%", writer: null }).value, "5.6");
  assert.match(newer.words, /^Report of 9 February, after the one of 3 November\. The move from 112 is inside LDL's usual swing, about \d+ to \d+%\. Two results can differ by this much with nothing changed\.$/);
  const far = watchedLine(start, { value: 60, on: "2027-02-09", unit: "mg/dL", writer: null });
  assert.match(far.words, /is more than LDL's usual swing of about/);
  assert.doesNotMatch(far.words, /nothing changed/);
  assert.equal(watchedLine({ marker: "ldl", unit: "mg/dL", start_value: null, start_on: "2026-11-18" }, null).words, "No report on file holds it.");
  assert.equal(watchedLine({ marker: "ldl", unit: "mg/dL", start_value: null, start_on: "2026-11-18" }, { value: 104, on: "2027-02-09", unit: "mg/dL", writer: null }).words, "Report of 9 February. None was on file when the horizon was set.");
  // no row of any kind judges a move, names a cause, or asks for another test
  for (const l of [same, newer, far]) assert.doesNotMatch(l.words, /good|bad|better|worse|improv|because|should|retest|next test|target|reached|on pace/i);
});
