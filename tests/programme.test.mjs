// Horizon as a programme under node: the goals, the fitness doors, a number that is held, weight read as a pace,
// three signs for fat or muscle, and the week with a coach. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAV, FOOTER_LINKS } from "../src/data/site.ts";
import { horizonFacts, fill, needOf } from "../src/my-health/horizon/facts.ts";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import {
  MARKER_BY_KEY, isTargetable, paceOf, pacesOf, outcomeOf, impliedPace, horizonLinesByCard, toTarget,
  doorOfMethod, methodFamily, fitnessReadings, fitnessBy, isStanding, isHeld, noChangeOf,
} from "../src/my-health/horizon/derive.ts";
import { GOALS, SOURCES, DOORS, GRIP, WEIGHT, FITNESS_RULES, BARRIERS, WAYS, doiUrl } from "../src/data/programme.ts";
import {
  parseProgramme, goalDraft, alreadyReads, doorsOnFile, startingMethod, doorLine, weightPace, threeSigns, callsKept, sheetWeeks, mondayRow,
} from "../src/my-health/horizon/programme.ts";

const TODAY = "2026-11-08";                                   // a Sunday
const H = { starts_on: "2026-09-07", ends_on: "2026-12-06", title: "Build fitness, 3 months" };   // Monday to Sunday: thirteen full weeks

/** An invented person. The name, the birth year, the height and every reading are no one's: this repo is public. */
function document(over = {}) {
  const activities = [], signals = [], weights = [];
  for (let i = 16; i >= 0; i--) {
    const monday = addDays("2026-11-02", -7 * i);
    const s = (day, name, type, cat, mins, met, z2) => activities.push({ timestamp: `${addDays(monday, day)}T07:00:00`, activity_name: name, activity_type: type, intensity_category: cat, duration_minutes: mins, met_minutes: met, met_hours: met / 60, zone2_minutes: z2, source: "healthkit" });
    s(0, "Walk", "aerobic", "moderate", 45, 200, 30);
    s(2, "Cycle", "aerobic", "moderate", 45, 190, 30);
    s(1, "Strength", "strength", "moderate", 40, 0, 0);
    if (i % 4 !== 0) s(4, "Strength", "strength", "moderate", 40, 0, 0);   // every fourth week has one strength session, not two
    for (let d = 0; d < 7; d++) { const day = addDays(monday, d); if (day <= TODAY) signals.push({ day, resting_hr: 57, steps: 6900 + d * 10 }); }
    weights.push({ measured_on: monday, weight_kg: 71.4 - (16 - i) * 0.2, source: "health" });
  }
  return {
    generated_at: TODAY, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1974 },
    labs: [], imaging: [], reports: [], files: [], weeks: [], web_body: [],
    // a six-minute walk on the website, then a watch's estimate, then a second walk
    web_crf: [{ measured_on: "2026-08-30", met_capacity: 8.4, vo2max: 29.4, method: "six-minute walk" }],
    app_crf: [
      { timestamp: "2026-10-10T08:00:00", met_capacity: 9.6, vo2_max_estimate: 33.6, estimation_method: "non-exercise-formula" },
      { timestamp: "2026-11-01T08:00:00", met_capacity: 8.7, vo2_max_estimate: 30.5, estimation_method: "six-minute-walk" },
    ],
    app_labs: [
      { measured_at: "2026-09-01T08:00:00", handgrip_kg: 31, chair_stand_seconds: 11.2, alm_kg: 19.0 },
      { measured_at: "2026-11-03T08:00:00", handgrip_kg: 29, chair_stand_seconds: 10.8, alm_kg: 18.6 },
    ],
    waist: [{ measured_at: "2026-09-02T08:00:00", waist_cm: 93 }, { measured_at: "2026-11-04T08:00:00", waist_cm: 90 }],
    activities, signals, weights,
    profile: { weekly_met_hours_goal: 10, height_cm: 160, sex: "female", age: 52 },
    note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
    ...over,
  };
}
const person = derivePerson(document());
const target = (marker, start, goal, extra = {}) => toTarget({ marker, label: MARKER_BY_KEY[marker].label, unit: MARKER_BY_KEY[marker].unit, start_value: start, start_on: H.starts_on, target_value: goal, cadence: MARKER_BY_KEY[marker].cadence, ...extra });

// ── the goals ──

test("a goal ticks markers the catalogue holds, shows evidence with a named paper, and fills no number in", () => {
  assert.deepEqual(GOALS.map((g) => g.key), ["lose_weight", "build_fitness", "hold", "marathon"]);
  for (const g of GOALS) {
    for (const m of g.markers) { assert.ok(MARKER_BY_KEY[m.marker], `${g.key}: ${m.marker}`); assert.ok(isTargetable(m.marker), `${g.key}: ${m.marker} is out of Horizon`); assert.equal("value" in m, false); }
    assert.ok(g.evidence.length >= 3);
    for (const l of g.evidence) { assert.ok(l.cites.length, l.text); for (const c of l.cites) assert.ok(SOURCES[c], `no source for ${c}`); }
  }
  // the marathon has no rules in the Guide yet: a coach writes it
  assert.equal(GOALS.find((g) => g.key === "marathon").writer, "coach");
  assert.equal(doiUrl("Lin 2015"), "https://doi.org/10.1161/JAHA.115.002014");
  assert.equal(doiUrl("Hickson 1985"), null);
});

test("no line of the programme promises a result, a length of life, or a diet", () => {
  const lines = [...GOALS.flatMap((g) => [g.lead, g.plan, ...g.evidence.map((l) => l.text)]), ...DOORS.flatMap((d) => [d.lead, d.errorNote.text]), ...FITNESS_RULES.lines.map((l) => l.text),
    GRIP.how.text, GRIP.moves.text, GRIP.notMuscle.text, WEIGHT.after.text, WEIGHT.stops, ...BARRIERS.map((b) => b.does), weightPace(71.4, 58, 13).words, weightPace(71.4, 67, 26).words];
  for (const t of lines) {
    assert.doesNotMatch(t, /you will (lose|reach|gain|become)|guarantee|money back|live longer|years to your life/i, t);
    assert.doesNotMatch(t, /\bmet\b(?! |-)/, t);            // a goal is reached, never "met": the word sits beside MET
    assert.doesNotMatch(t, /—/, t);
  }
  assert.match(GOALS[0].plan, /It writes no diet\./);
});

test("a goal's draft keeps a marker nothing is sending, marked, and leaves out none of its own", () => {
  const rows = goalDraft("lose_weight", (m) => m !== "steps");
  assert.deepEqual(rows.map((r) => [r.marker, r.mode, r.missing]), [["weight", "reach", false], ["waist", "reach", false], ["dose", "floor", false], ["strength_week", "reach", false], ["steps", "reach", true], ["grip", "floor", false], ["chair_stands", "ceiling", false]]);
  assert.deepEqual(goalDraft("hold").map((r) => r.mode), ["floor", "floor", "floor", "band", "floor"]);
  assert.deepEqual(goalDraft("nonsense"), []);
});

test("a stored programme is read back whole, and anything else is not a programme", () => {
  assert.deepEqual(parseProgramme({ v: 1, goal: "hold", aims: ["Play a full game with friends", 7, ""], barriers: ["time"], days: [4, 0, 0, 9], place: "home", writer: "both" }),
    { v: 1, goal: "hold", aims: ["Play a full game with friends"], barriers: ["time"], days: [0, 4], place: "home", writer: "both" });
  assert.equal(parseProgramme(null), null);
  assert.equal(parseProgramme({ goal: "get rich" }), null);
  assert.equal(parseProgramme({ goal: "own" }).writer, "guide");
});

// ── fitness by its door ──

test("a method names its door: the app's keys and the website's own words", () => {
  assert.equal(doorOfMethod("six-minute-walk"), "walk");
  assert.equal(doorOfMethod("six-minute walk"), "walk");            // as the website's first number writes it
  assert.equal(doorOfMethod("twelve-minute run"), "run");
  assert.equal(doorOfMethod("cooper-run"), "run");
  assert.equal(doorOfMethod("1.5-mile-run"), "run");
  assert.equal(doorOfMethod("bruce-protocol"), "treadmill");
  assert.equal(doorOfMethod("cpet"), "lab");
  assert.equal(doorOfMethod("non-exercise-formula"), "watch");
  // a method with no door borrows no other test's error: it is its own family
  assert.equal(doorOfMethod("one-mile-walk"), null);
  assert.equal(methodFamily("one-mile-walk"), "one-mile-walk");
  assert.equal(methodFamily(null), null);
  assert.equal(doorLine("walk"), "six-minute walk · about 1 MET either way");
  assert.equal(doorLine("one-mile-walk"), "");
});

test("the readings on file keep their doors, the surest first, and a new target starts on the latest one's", () => {
  assert.deepEqual(fitnessReadings(person).map((r) => [r.on, r.value, r.door]), [["2026-08-30", 8.4, "walk"], ["2026-10-10", 9.6, "watch"], ["2026-11-01", 8.7, "walk"]]);
  assert.deepEqual(doorsOnFile(person).map((d) => [d.door.key, d.reading.value]), [["walk", 8.7], ["watch", 9.6]]);
  assert.equal(startingMethod(person, TODAY), "walk");
  // the surest door with a reading in the last ninety days, not simply the newest reading
  const watchLast = derivePerson(document({ app_crf: [{ timestamp: "2026-11-05T08:00:00", met_capacity: 9.6, estimation_method: "non-exercise-formula" }] }));
  assert.equal(startingMethod(watchLast, TODAY), "walk");                    // the walk of 30 August is 70 days old
  assert.equal(startingMethod(watchLast, "2027-01-15"), "watch");           // by January only the watch is that recent
  assert.equal(startingMethod(derivePerson(document({ web_crf: [], app_crf: [] })), TODAY), null);
  assert.equal(fitnessBy(person, "watch").value, 9.6);
  assert.equal(fitnessBy(person, "run"), null);
});

test("one method from start to end: a fitness number kept to a walk is never read from a watch", () => {
  // set on the walk of 30 August, with the watch's higher estimate the newest reading on 20 October
  const t = target("mets", 8.4, 9.4, { method: "walk", start_on: "2026-08-30" });
  const mid = pacesOf([t], H, derivePerson(document({ app_crf: [{ timestamp: "2026-10-10T08:00:00", met_capacity: 9.6, estimation_method: "non-exercise-formula" }] })), "2026-10-20")[0];
  assert.equal(mid.now, 8.4);                                        // the walk, not the watch's 9.6
  assert.equal(mid.method, "walk");
  assert.deepEqual(mid.other, { method: "non-exercise-formula", on: "2026-10-10", text: "9.6" });
  assert.notEqual(mid.pace_word, "Reached");
  // without a method, the row reads the newest reading whatever it is, as it always did
  assert.equal(pacesOf([target("mets", 8.4, 9.4)], H, derivePerson(document({ app_crf: [{ timestamp: "2026-10-10T08:00:00", met_capacity: 9.6, estimation_method: "non-exercise-formula" }] })), "2026-10-20")[0].pace_word, "Reached");
  // on the date, the same rule
  assert.equal(outcomeOf(t, H, person).endText, "8.7");
});

test("a fitness test at its number is not reached while the move is inside what two tests differ by", () => {
  assert.equal(noChangeOf("mets", 8.4), 8.4 * 0.05);
  const small = paceOf(target("mets", 8.4, 8.6), H, { value: 8.7, on: "2026-11-01", unit: "METs", writer: "six-minute-walk" }, TODAY);   // +0.3 is under 5% of 8.4
  assert.equal(small.pace_word, "At your number");
  const real = paceOf(target("mets", 8.4, 8.9), H, { value: 9.0, on: "2026-11-01", unit: "METs", writer: "six-minute-walk" }, TODAY);    // +0.6 is more
  assert.equal(real.pace_word, "Reached");
});

// ── a number that is held ──

test("a floor is held or under it, and a grip move under five kilos is not a change", () => {
  const grip = target("grip", 31, 30, { mode: "floor" });
  assert.ok(isHeld(MARKER_BY_KEY.grip, grip)); assert.equal(isStanding(MARKER_BY_KEY.grip, grip), false);
  const at = (v) => paceOf(grip, H, { value: v, on: "2026-11-03", unit: "kg", writer: null }, TODAY);
  assert.deepEqual([at(31).pace_word, at(31).tone, at(31).mode], ["Held", "good", "floor"]);
  assert.equal(at(29).pace_word, "Held: the move is inside what two readings differ by");     // 2 kg from the start of 31
  assert.deepEqual([at(25).pace_word, at(25).tone], ["Five kilos under your floor", "caution"]);  // 6 kg from the start: a change
  assert.equal(paceOf(grip, H, null, TODAY).pace_word, "No reading yet");
  // a ceiling, for a time in seconds; a band, for a weight to stay inside
  const chair = target("chair_stands", 11.2, 12, { mode: "ceiling" });
  assert.equal(paceOf(chair, H, { value: 10.8, on: TODAY, unit: "s", writer: null }, TODAY).pace_word, "Held");
  assert.equal(paceOf(chair, H, { value: 13.5, on: TODAY, unit: "s", writer: null }, TODAY).pace_word, "1.5 s over your line");
  const band = target("weight", 68, 69.5, { mode: "band", low_value: 66.5 });
  const w = (v) => paceOf(band, H, { value: v, on: TODAY, unit: "kg", writer: null }, TODAY);
  assert.deepEqual([w(68.2).pace_word, w(70.5).pace_word, w(65.5).pace_word, w(68.2).lowText], ["Inside your band", "A kilo over your band", "A kilo under your band", "66.5"]);
});

test("a weekly marker set as a floor is read like the dose: the full weeks that reached it", () => {
  const t = target("strength_week", 2, 2, { mode: "floor" });
  assert.ok(isStanding(MARKER_BY_KEY.strength_week, t));
  const p = pacesOf([t], H, person, TODAY)[0];
  // eight full weeks have ended (7 Sep to 1 Nov); every fourth week of this person's has one session
  assert.equal(p.pace_word, "Reached in 6 of 8 full weeks");
  assert.equal(p.mode, "floor");
  assert.equal(outcomeOf(t, H, derivePerson(document())).word.startsWith("Reached in"), true);
});

test("the Overview's line and the set-up's note say a held number in its own words", () => {
  const grip = target("grip", 31, 30, { mode: "floor" });
  assert.equal(horizonLinesByCard(H, [grip], person, TODAY).body, "On your horizon: Grip strength at least 30.0 kg · held: the move is inside what two readings differ by");
  const now = { value: 31, on: TODAY, unit: "kg", writer: null };
  assert.equal(impliedPace(MARKER_BY_KEY.grip, now, 30, 13, [], TODAY, undefined, null, { mode: "floor" }), "A floor to hold, not a number to raise. Today's 31.0 is above it.");
  assert.equal(impliedPace(MARKER_BY_KEY.weight, { ...now, value: 68 }, 69.5, 13, [], TODAY, undefined, null, { mode: "band", low: 66.5 }), "A band to stay inside. Today's 68.0 is inside it.");
  assert.equal(impliedPace(MARKER_BY_KEY.weight, { ...now, value: 68 }, 69.5, 13, [], TODAY, undefined, null, { mode: "band", low: null }), "Set both ends of the band: the lower number first.");
  assert.equal(outcomeOf(grip, H, person).targetText, "at least 30.0");
});

// ── weight, read as a pace ──

test("a weight number is read as a pace, beside what the guidelines describe", () => {
  const steady = weightPace(71.4, 67.0, 26);
  assert.equal(steady.read, "inside");
  assert.equal(steady.words, "4.4 kg in 26 weeks is 0.17 kg a week, and 6.2% of your weight. The US guideline describes 5 to 10% within six months. Your number sits inside it.");
  const fast = weightPace(71.4, 58.0, 13);
  assert.equal(fast.read, "faster");
  assert.equal(fast.words, "13.4 kg in 13 weeks is 1.03 kg a week, and 18.8% of your weight. That is faster than the 0.5 to 1 kg a week a guideline states, and more than the 5 to 10% in six months. Verve sets no number. This one is yours to weigh with your doctor.");
  const steep = weightPace(80, 60, 10);
  assert.equal(steep.read, "steep");
  assert.match(steep.words, /Above 1\.5 kg a week the risk of gallstones climbs steeply\./);
  assert.equal(weightPace(71.4, 70, 13).read, "under");
  assert.match(weightPace(71.4, 70, 13).words, /Your number asks for less than that\.$/);
  assert.equal(weightPace(71.4, 73, 13).read, "gain");
  assert.equal(weightPace(71.4, 71.4, 13).read, "none");
  // a year: the guideline's share is read on the part that falls in the first six months
  assert.equal(weightPace(80, 68, 52).read, "inside");               // 15% in a year is 7.5% in six months
  // the mark on the track from 0 to 1.5 kg a week
  assert.equal(Math.round(fast.mark * 1000), 687);
  assert.equal(weightPace(80, 40, 10).mark, 1);
});

test("fat or muscle is three signs and no verdict", () => {
  const weight = target("weight", 69.4, 66);
  const s = threeSigns(H, [weight, target("strength_week", 2, 2)], person, TODAY);
  assert.deepEqual(s.signs.map((x) => x.key), ["waist", "strength", "scale"]);
  assert.equal(s.signs[0].figure, "93 → 90 cm");
  assert.match(s.signs[0].words, /^The waist is down 3 cm\./);
  assert.match(s.signs[1].words, /Grip is held: 31 to 29 kg, and a move under 5 kg is not a change\./);
  assert.match(s.signs[1].words, /Five chair rises: 11\.2 to 10\.8 seconds\./);
  assert.match(s.signs[1].words, /2 strength sessions done in 6 of 8 full weeks\./);
  assert.equal(s.signs[2].figure, "trend only");
  assert.match(s.signs[2].words, /^It moved 0\.4 kg across 9 weeks\. That is inside what a home scale can tell/);
  assert.match(s.read, /Weight is down \d\.\d kg\./);
  // the page never says the loss is fat, and says that it does not
  assert.doesNotMatch(s.read, /\bfat\b/i);
  assert.match(s.stops, /It does not say the loss is fat\./);
  // nothing on file is said as that, never as a nought
  const bare = threeSigns(H, [weight], derivePerson(document({ waist: [], app_labs: [], activities: [], weights: [] })), TODAY);
  assert.equal(bare.signs[0].figure, "No tape reading");
  assert.equal(bare.weight, null);
  assert.match(bare.signs[2].words, /^Two readings at least four weeks apart are needed\./);
});

// ── what the page already reads ──

test("the set-up lays out what is on file, each with where it came from, and says what is not", () => {
  const rows = Object.fromEntries(alreadyReads(person, TODAY).map((r) => [r.key, r]));
  assert.equal(rows.fitness.value, "8.7 METs");
  assert.equal(rows.fitness.from, "A six-minute walk, 1 November · about 1 MET either way.");
  assert.match(rows.week.from, /zone 2 and harder minutes, 2 aerobic sessions$/);
  // a newer reading by a less sure method is named beside it
  const withWatch = derivePerson(document({ app_crf: [{ timestamp: "2026-11-05T08:00:00", met_capacity: 9.6, estimation_method: "non-exercise-formula" }] }));
  assert.equal(alreadyReads(withWatch, TODAY)[0].from, "A six-minute walk, 30 August · about 1 MET either way. Also on file: your watch's estimate, 9.6 on 5 November.");
  assert.equal(rows.fitness.action.label, "Test again");
  assert.match(rows.week.value, /^\d+ min · /);
  assert.match(rows.steps.from, /^Seven-day average, /);
  assert.equal(rows.waist.value, "90 cm");
  assert.equal(rows.grip.value, "29.0 kg");
  const none = Object.fromEntries(alreadyReads(derivePerson(document({ app_labs: [], waist: [], web_crf: [], app_crf: [] })), TODAY).map((r) => [r.key, r]));
  assert.equal(none.grip.value, null);
  assert.equal(none.waist.value, null);
  assert.equal(none.fitness.value, null);
  assert.equal(none.fitness.action.label, "Find your number");
});

// ── the week with a coach ──

test("calls are counted over the full weeks that have ended, and a paused week is not counted", () => {
  const note = (week_start, extra) => ({ horizon_id: "h1", week_start, way: null, away: false, call_at: null, call_kept: null, lines: [], lines_by: null, ...extra });
  const notes = [note("2026-09-07", { call_kept: true }), note("2026-09-14", { call_kept: true }), note("2026-09-21", { way: "travel" }), note("2026-09-28", { call_kept: false })];
  // four full weeks ended; "Travel" is a note for the call and takes no week out of the count (tests/pause.test.mjs)
  assert.deepEqual(callsKept(notes, H, "2026-10-06"), { kept: 2, of: 4, paused: 0 });
  // the same weeks with the third one paused: three are counted
  assert.deepEqual(callsKept(notes, { ...H, pauses: ["2026-09-21"] }, "2026-10-06"), { kept: 2, of: 3, paused: 1 });
  assert.deepEqual(callsKept([], H, "2026-09-09"), { kept: 0, of: 0, paused: 0 });
  assert.deepEqual(WAYS.map((w) => w.key), ["time", "travel", "illness", "unsure", "other"]);
});

test("the sheet names this week and the full week before it by their days, and a short week has no number", () => {
  const s = sheetWeeks(H, "2026-10-14");
  assert.deepEqual([s.thisWeek.n, s.thisWeek.words, s.lastWeek.n, s.lastWeek.words], [6, "Mon 12 to Sun 18 Oct", 5, "Mon 5 to Sun 11 Oct"]);
  // a horizon set on a Tuesday: its first days are a short week, and no full week is behind it yet
  const tue = sheetWeeks({ starts_on: "2026-11-17", ends_on: "2027-02-16" }, "2026-11-19");
  assert.deepEqual([tue.thisWeek.n, tue.thisWeek.full, tue.lastWeek], [null, false, null]);
});

test("the trainer's list reads a client's week from what the horizon already holds", () => {
  const h = { ...H, programme: { v: 1, goal: "build_fitness", aims: [], barriers: [], days: [], place: null, writer: "coach" } };
  const day = "2026-10-14";                                           // a Wednesday in week 6
  const note = (week_start, extra) => ({ horizon_id: "h1", week_start, way: null, away: false, call_at: null, call_kept: null, lines: [], lines_by: null, ...extra });
  const lines = [{ label: "Zone 2 minutes", done: 48, of: 60 }, { label: "Strength sessions", done: 2, of: 2 }];
  const r = mondayRow(h, [note("2026-10-12", { call_at: "2026-10-14T13:00:00" })], lines, day);
  assert.equal(r.horizon, "Build fitness · week 6 of 13");
  assert.equal(r.lastWeek, "Zone 2 minutes: 48 of 60");
  assert.match(r.call, /^Call today, 13:00$/);
  assert.equal(r.today, true);
  // a call already kept is not the row to start from; a paused week says so; no check-in is said, never guessed
  assert.equal(mondayRow(h, [note("2026-10-12", { call_at: "2026-10-14T13:00:00", call_kept: true })], lines, day).today, false);
  assert.equal(mondayRow({ ...h, pauses: ["2026-10-05"] }, [], lines, day).lastWeek, "Paused");
  assert.equal(mondayRow(h, [], null, day).lastWeek, "No check-in yet");
  assert.equal(mondayRow(h, [], [{ label: "Strength sessions", done: 2, of: 2 }], day).lastWeek, "All lines done");
  assert.equal(mondayRow(h, [], null, day).call, "No call set");
  // a horizon of the person's own targets is named by its title
  assert.equal(mondayRow({ ...H, title: "Boston Marathon, 18 April" }, [], null, day).horizon, "Boston Marathon · week 6 of 13");
});

// ── being tried, not offered ──

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.(astro|ts|tsx|js|mjs|json|md)$/.test(f) ? [p] : []; });

test("the way in is being tried: out of search, linked from nowhere, with no price on it", () => {
  const page = readFileSync("src/pages/horizon.astro", "utf8");
  assert.match(page, /<Layout[^>]*\bnoindex\b/);
  assert.doesNotMatch(page, /[$₹£€]\s?\d/);
  for (const l of [...NAV, ...FOOTER_LINKS]) assert.notEqual(l.href.replace(/\/$/, ""), "/horizon");
  // no other page links to it yet
  for (const f of walk("src").filter((x) => x.endsWith(".astro") && !x.endsWith("pages/horizon.astro"))) assert.doesNotMatch(readFileSync(f, "utf8"), /href="\/horizon\/?"/, f);
});

test("the offer is not in this repository: no free months, no credit, no money back", () => {
  // The offer, its credit and its price wait for the lawyers, and a public commit is publication.
  for (const f of walk("src")) {
    const t = readFileSync(f, "utf8");
    assert.doesNotMatch(t, /money[- ]back|more months free|months,? free\b|as credit\b|earns? (the|a) credit/i, f);
  }
});

// ── a panel for test accounts: its counts ──

test("a horizon's standing is plain counts: targets that read reached, calls kept, plan weeks kept", () => {
  const note = (week_start, extra) => ({ horizon_id: "h1", week_start, way: null, away: false, call_at: null, call_kept: null, lines: [], lines_by: null, ...extra });
  const kept = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"].map((m) => note(m, { call_kept: true }));
  const pace = (marker, pace_word, extra = {}) => ({ marker, pace_word, ...extra });
  const day = "2026-10-21";                                           // six full weeks have ended; week 7
  const share = 10 / 12;
  const f = horizonFacts({ h: H, paces: [pace("mets", "Reached", { method: "walk" }), pace("dose", "Reached in 6 of 6 full weeks"), pace("grip", "Held: the move is inside what two readings differ by"), pace("waist", "No reading yet")], targets: [], notes: kept, today: day, planWeeks: { kept: 4, of: 6 }, share });
  assert.deepEqual([f.week, f.weeks_total, f.judged, f.reached, f.targets_ok], [7, 13, 3, 3, true]);     // a row with no reading is not judged
  assert.deepEqual([f.calls_kept, f.calls_of, f.calls_need, f.calls_ok], [6, 6, 5, true]);
  assert.deepEqual([f.plan_kept, f.plan_of, f.plan_need, f.plan_ok], [4, 6, 5, false]);
  assert.equal(f.method_kept, true);
  assert.equal(f.standing, "targets");
  // "nearly there" is not reached; the plan's weeks kept stand in for the numbers
  const g = horizonFacts({ h: H, paces: [pace("mets", "Nearly there")], targets: [], notes: kept, today: day, planWeeks: { kept: 5, of: 6 }, share });
  assert.deepEqual([g.reached, g.targets_ok, g.standing], [0, false, "weeks"]);
  // five calls of six is ten of twelve; four is not
  assert.equal(horizonFacts({ h: H, paces: [pace("mets", "Reached")], targets: [], notes: kept.slice(0, 4), today: day, share }).standing, "not_yet");
  assert.equal(needOf(12, share), 10); assert.equal(needOf(6, share), 5); assert.equal(needOf(13, share), 11);
  // a weight number faster than guidelines describe is said in the counts, and the targets do not all stand
  const fast = horizonFacts({ h: H, paces: [pace("weight", "Reached")], targets: [target("weight", 71.4, 58)], notes: kept, today: day, share });
  assert.deepEqual([fast.weight_read, fast.weight_ok, fast.targets_ok], ["faster", false, false]);
  // before anything can be read
  assert.equal(horizonFacts({ h: H, paces: [], targets: [], notes: [], today: "2026-09-08" }).standing, "none");
  assert.equal(horizonFacts({ h: H, paces: [], targets: [], notes: [], today: "2026-09-08" }).plan_of, null);
});

test("a panel's sentence takes its counts, and a name the counts do not hold is left out", () => {
  assert.equal(fill("{reached} of {judged} would read reached today", { reached: 2, judged: 6 }), "2 of 6 would read reached today");
  assert.equal(fill("{plan_kept} of {plan_of}{nothing}", { plan_kept: null, plan_of: 0 }), " of 0");
  assert.equal(fill("No counts here.", {}), "No counts here.");
});
