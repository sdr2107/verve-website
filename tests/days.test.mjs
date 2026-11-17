// A day to be ready for (board 14 of "Verve, Horizon as a programme"): the day sets the date and nothing else. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DAYS, DAY_BY_KEY, DAY_CHIPS, DAY_FEWEST_FULL_WEEKS, WEEK_COUNTED, LONG_ENOUGH, GOAL_BY_KEY, SOURCES } from "../src/data/programme.ts";
import { dayCount, dayKindOf, goalDraft, parseProgramme } from "../src/my-health/horizon/programme.ts";
import { MARKER_BY_KEY } from "../src/my-health/horizon/derive.ts";
import { pauseMovesDate, applyPause, movedWords } from "../src/my-health/horizon/pause.ts";

test("the days: nine suggestions, each a reason and a date, none of them a goal", () => {
  assert.deepEqual(DAY_CHIPS.map((d) => d.label), ["A wedding", "A race", "A trek or a climb", "A match or a season", "A fitness test for work", "A round birthday", "A trip on foot", "A reunion", "Something else"]);
  for (const d of DAYS) {
    // a title a coach and the Guide may read, never a person's own words
    assert.ok(d.title.length >= 4 && d.title.length <= 80 && d.forWords);
    for (const g of d.goals) assert.ok(GOAL_BY_KEY[g], `${d.key} offers a goal that exists`);
    for (const m of d.adds) assert.ok(MARKER_BY_KEY[m.marker], `${d.key} adds a marker that exists`);
  }
  // a wedding assumes nothing about weight: no goal is picked for it
  assert.deepEqual(DAY_BY_KEY.wedding.goals, []);
  // a long race is the marathon goal, which a coach writes; it is reached from "A race"
  assert.deepEqual([DAY_BY_KEY.race_long.goals, DAY_BY_KEY.race_long.under], [["marathon"], "race"]);
  // nothing medical is suggested
  assert.ok(!DAYS.some((d) => /surgery|operation|pregnan|baby|doctor/i.test(`${d.label} ${d.title}`)));
  // no line promises an outcome or speaks of how anyone will look
  for (const d of DAYS) assert.ok(!/you will|guarantee|look your best|body|slim|tone/i.test(d.note), d.note);
});

test("a day is counted from today: the days, the full weeks, and the short weeks that are never judged", () => {
  // Tuesday 17 November 2026 to Saturday 13 February 2027: the board's own day
  assert.deepEqual(dayCount("2026-11-17", "2027-02-13"), { days: 88, full: 11, short: 2 });
  // a Monday to a Sunday: whole weeks and nothing short
  assert.deepEqual(dayCount("2026-11-16", "2026-12-13"), { days: 27, full: 4, short: 0 });
  assert.equal(dayCount("2026-11-17", "2026-11-17"), null);
  assert.equal(dayCount("2026-11-17", "2026-11-10"), null);
  assert.equal(dayCount("2026-11-17", "soon"), null);
});

test("what the time is long enough for: each line carries its paper, and a short time says so", () => {
  for (const l of LONG_ENOUGH) { assert.ok(l.short); for (const c of l.line.cites) assert.ok(SOURCES[c], c); }
  const at = (weeks) => LONG_ENOUGH.filter((l) => weeks >= l.least).map((l) => l.key);
  assert.deepEqual(at(11), ["fitness", "weight", "waist", "week"]);
  assert.deepEqual(at(3), ["week"]);
  assert.deepEqual(at(30), ["fitness", "weight", "waist", "week", "grip"]);
  assert.equal(DAY_FEWEST_FULL_WEEKS, 4);
  // under four full weeks only what a week can count
  assert.ok(WEEK_COUNTED.has("steps") && WEEK_COUNTED.has("zone2_week") && !WEEK_COUNTED.has("mets") && !WEEK_COUNTED.has("weight"));
});

test("a day adds markers to the goal's own and fills no field", () => {
  const plain = goalDraft("build_fitness").map((r) => r.marker);
  const trek = goalDraft("build_fitness", () => true, DAY_BY_KEY.trek.adds).map((r) => r.marker);
  assert.deepEqual(trek.filter((m) => !plain.includes(m)), ["longest_session", "steps", "chair_stands"]);
  // one the goal already holds is not listed twice
  const marathon = goalDraft("marathon", () => true, DAY_BY_KEY.race.adds).map((r) => r.marker);
  assert.equal(marathon.filter((m) => m === "longest_session").length, 1);
  for (const r of goalDraft("build_fitness", () => true, DAY_BY_KEY.trek.adds)) assert.ok(!("value" in r));
});

test("the horizon keeps the kind of day, and never the name the person gave it", () => {
  const p = parseProgramme({ goal: "hold", aims: [], barriers: [], days: [], place: null, writer: "guide", day: { kind: "wedding", name: "My sister's wedding" } });
  assert.deepEqual(p.day, { kind: "wedding" });
  assert.ok(!JSON.stringify(p).includes("sister"));
  assert.equal(parseProgramme({ goal: "hold", day: { kind: "a party" } }).day, null);
  assert.equal(parseProgramme({ goal: "hold" }).day, null);
  assert.equal(dayKindOf({ goal: "hold", day: { kind: "trek" } }).forWords, "a trek or a climb");
  assert.equal(dayKindOf({ goal: "hold" }), null);
  assert.equal(dayKindOf(null), null);
});

test("a day cannot move: a paused week is set aside, the date stays, and the plan closes up", () => {
  const H = { starts_on: "2026-11-17", ends_on: "2027-02-13", kind: "date", months: null };
  const forDay = { ...H, programme: { goal: "hold", day: { kind: "wedding" } } };
  assert.equal(pauseMovesDate(forDay), false);
  assert.equal(pauseMovesDate({ ...H, programme: { goal: "hold" } }), true);
  assert.equal(pauseMovesDate({ ...H, programme: { goal: "marathon" } }), false);
  assert.equal(pauseMovesDate(H), true);
  const out = applyPause(forDay, "2026-12-21", "2026-12-21");
  assert.equal(out.ok, true);
  assert.deepEqual([out.patch.ends_on, out.patch.pauses], ["2027-02-13", ["2026-12-21"]]);
  assert.match(movedWords({ ...forDay, ...out.patch }), /The date stays where it was/);
});
