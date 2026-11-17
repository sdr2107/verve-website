// Pausing a horizon for a week (board 13 of "Verve, Horizon as a programme"): the rule the page and the function
// share, and how a paused week is then read. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import {
  MARKER_BY_KEY, horizonSpans, horizonMondays, weekOf, weekWords, weeksWords, pausedWeeksWords, pausedSpanOn, pausedRunOn, daysToGo, elapsedShare, activeDays,
  pacesOf, fullWeeksSoFar, checkinInputs, pausedCheckinLines, guideView, weekLine, checkinLinesOf, linesText, horizonLinesByCard, roadOf, toTarget, PAUSED_WORD, CHECKIN_HEADS,
} from "../src/my-health/horizon/derive.ts";
import {
  pauseAllowance, pauseRefusal, pauseChoices, pauseState, applyPause, pauseMovesDate, dateAsSet, movedWords, pauseWhyWords, PAUSES_TOGETHER, PAUSES_MOST,
} from "../src/my-health/horizon/pause.ts";
import { callsKept, sheetWeeks, mondayRow } from "../src/my-health/horizon/programme.ts";
import { horizonFacts } from "../src/my-health/horizon/facts.ts";
import { BARRIERS, WAYS } from "../src/data/programme.ts";
import * as programmeData from "../src/data/programme.ts";
import * as programmeRules from "../src/my-health/horizon/programme.ts";

// The board's own horizon: set on Tuesday 17 November 2026, its date Tuesday 16 February 2027. Six days, twelve weeks
// from Monday to Sunday, two days.
const H = { starts_on: "2026-11-17", ends_on: "2027-02-16", kind: "months", months: 3, title: "Build fitness, 3 months" };
const PAUSED = { ...H, ends_on: "2027-02-23", ends_on_set: "2027-02-16", pauses: ["2026-12-21"] };

// ── the weeks, with one of them set aside ──

test("a paused week is in the list, has no number, and every week after it keeps the number it had", () => {
  const before = horizonSpans(H), after = horizonSpans(PAUSED);
  assert.deepEqual(before.map((s) => s.week), [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, null]);
  assert.deepEqual(after.map((s) => s.week), [null, 1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, null]);
  const p = after[5];
  assert.deepEqual([p.from, p.to, p.days, p.full, p.paused], ["2026-12-21", "2026-12-27", 7, false, true]);
  // week five is a week later, and the count is still twelve
  assert.deepEqual([before[5].week, before[5].from], [5, "2026-12-21"]);
  assert.deepEqual([after[6].week, after[6].from], [5, "2026-12-28"]);
  assert.deepEqual([after[13].week, after[13].from, after[13].to], [12, "2027-02-15", "2027-02-21"]);
  // the short days at either end are as they were: six, then two
  assert.deepEqual([after[0].days, after[14].from, after[14].to, after[14].days], [6, "2027-02-22", "2027-02-23", 2]);
  assert.ok(after.every((s) => !s.paused || !s.full));
  assert.equal(horizonSpans({ ...H, pauses: null }).filter((s) => s.paused).length, 0);
});

test("the header reads the paused week as paused, with the weeks behind and the days to go", () => {
  assert.deepEqual(weekOf(PAUSED, "2026-12-23"), { week: 4, weeks: 12, short: null, paused: true });
  assert.equal(weekWords(PAUSED, "2026-12-23"), "paused this week");
  assert.equal(daysToGo(PAUSED, "2026-12-21"), 64);
  assert.equal(weekWords(PAUSED, "2026-12-28"), "week 5 of 12");
  assert.equal(weekWords(PAUSED, "2026-12-20"), "week 4 of 12");
  assert.equal(weekWords(PAUSED, "2027-02-22"), "the short last week");
  assert.equal(roadOf(PAUSED, "2026-12-23").find((s) => s.state === "now").sub, "paused");
  assert.equal(pausedSpanOn(PAUSED, "2026-12-27").from, "2026-12-21");
  assert.equal(pausedSpanOn(PAUSED, "2026-12-28"), null);
  assert.equal(pausedWeeksWords(H), "");
  assert.equal(pausedWeeksWords(PAUSED), "Paused: Mon 21 to Sun 27 Dec. A paused week is shown as it was, is not judged, and has no number.");
  // the sentence about short weeks counts the weeks that are judged
  assert.match(weeksWords(PAUSED), /a short first week, Tue 17 to Sun 22 Nov, then 12 weeks from Monday to Sunday, then a short last week, Mon 22 to Tue 23 Feb/);
  assert.equal(movedWords(H), "");
  assert.equal(movedWords(PAUSED), "Moved one week, from 16 February, by a pause.");
});

test("a plan's weeks leave the paused week out, and still number twelve", () => {
  const m = horizonMondays(PAUSED);
  assert.equal(m.length, 12);
  assert.ok(!m.includes("2026-12-21"));
  assert.deepEqual([m[3], m[4], m[11]], ["2026-12-14", "2026-12-28", "2027-02-15"]);
  assert.equal(horizonMondays(H).length, 12);
});

test("the line to the date stands still through a paused week, so nobody is behind for it", () => {
  // on the Monday the pause begins the line is where it would have been without one
  assert.equal(elapsedShare(PAUSED, "2026-12-21"), elapsedShare(H, "2026-12-21"));
  // it does not move all week
  assert.equal(elapsedShare(PAUSED, "2026-12-27"), elapsedShare(H, "2026-12-21"));
  assert.equal(elapsedShare(PAUSED, "2026-12-28"), elapsedShare(H, "2026-12-21"));
  // and from then on it is one week behind the line of the horizon that was not paused
  assert.equal(elapsedShare(PAUSED, "2027-01-11"), elapsedShare(H, "2027-01-04"));
  assert.equal(elapsedShare(PAUSED, "2027-02-23"), 1);
  assert.equal(activeDays(PAUSED, "2026-11-17", "2027-02-23"), 91);
  assert.equal(activeDays(PAUSED, "2026-12-23", "2026-12-30"), 2, "from a Wednesday inside the pause to the Wednesday after: Monday and Tuesday count");
});

// ── the rule ──

test("one pause for every three months a horizon was set for: one, two, four", () => {
  const months = (n) => pauseAllowance({ starts_on: "2026-11-17", ends_on: "2027-02-16", kind: "months", months: n });
  assert.deepEqual([months(3), months(6), months(12)], [1, 2, 4]);
  // a horizon set by a date is counted in whole months, never fewer than one and never more than four
  const dated = (ends_on) => pauseAllowance({ starts_on: "2026-11-17", ends_on, kind: "date", months: null });
  assert.deepEqual([dated("2026-12-29"), dated("2027-02-16"), dated("2027-05-17"), dated("2027-08-17"), dated("2027-11-17"), dated("2031-11-17")], [1, 1, 2, 3, 4, 4]);
  // the allowance is read from the date as first set, so a pause that moves the date never earns another
  assert.equal(pauseAllowance({ starts_on: "2026-11-17", ends_on: "2027-05-19", ends_on_set: "2027-05-12", kind: "date", months: null, pauses: ["2026-12-21"] }), 1);
  assert.equal(PAUSES_MOST, 4);
});

test("this week or next week, and the week just ended until Sunday night", () => {
  const c = pauseChoices(H, "2026-12-23");                               // a Wednesday in week 5
  assert.deepEqual(c.map((x) => [x.key, x.monday, x.ok, x.words]), [
    ["last", "2026-12-14", true, "Mon 14 to Sun 20 Dec"],
    ["this", "2026-12-21", true, "Mon 21 to Sun 27 Dec"],
    ["next", "2026-12-28", true, "Mon 28 Dec to Sun 3 Jan"],
  ]);
  assert.ok(c.every((x) => x.ends_on === "2027-02-23"), "the date moves seven days whichever week is chosen");
  // the week just ended can be set aside on the Sunday after it, and not on the Monday after that
  assert.equal(pauseRefusal(H, "2026-12-14", "2026-12-27"), null);
  assert.equal(pauseRefusal(H, "2026-12-14", "2026-12-28"), "outside");
  assert.equal(pauseRefusal(H, "2027-01-11", "2026-12-23"), "outside");
});

test("never in the short first or last days, where nothing is judged already", () => {
  const first = pauseChoices(H, "2026-11-18");                           // the day after it was set
  assert.deepEqual(first.map((x) => [x.key, x.ok, x.why]), [["last", false, "short"], ["this", false, "short"], ["next", true, null]]);
  const last = pauseChoices(H, "2027-02-10");                            // the Wednesday of week 12
  assert.deepEqual(last.map((x) => [x.key, x.ok, x.why]), [["last", true, null], ["this", true, null], ["next", false, "short"]]);
  assert.deepEqual(pauseChoices(H, "2027-02-16").map((x) => x.ok), [true, false, false], "on the date itself only the last full week can still be set aside");
  assert.equal(pauseRefusal(H, "2027-02-15", "2027-02-17"), "over");
  assert.equal(pauseRefusal({ ...H, closed_at: "2026-12-01T00:00:00Z" }, "2026-12-21", "2026-12-23"), "closed");
});

test("once means once on a three-month horizon; a longer one has more, and never three weeks together", () => {
  assert.equal(pauseRefusal(PAUSED, "2027-01-04", "2027-01-06"), "spent");
  assert.deepEqual(pauseState(PAUSED, "2027-01-06").choices.map((c) => c.why), ["spent", "spent", "spent"]);
  const year = { starts_on: "2026-11-17", ends_on: "2027-11-17", kind: "months", months: 12 };
  // the same week twice
  assert.equal(pauseRefusal({ ...year, pauses: ["2026-12-21"] }, "2026-12-21", "2026-12-23"), "paused");
  // two side by side is a fortnight away
  assert.equal(pauseRefusal({ ...year, pauses: ["2026-12-14"] }, "2026-12-21", "2026-12-23"), null);
  // a third beside them is not offered, on either side or in between
  assert.equal(pauseRefusal({ ...year, pauses: ["2026-12-14", "2026-12-21"] }, "2026-12-28", "2026-12-23"), "together");
  assert.equal(pauseRefusal({ ...year, pauses: ["2026-12-21", "2026-12-28"] }, "2026-12-14", "2026-12-23"), "together");
  assert.equal(pauseRefusal({ ...year, pauses: ["2026-12-14", "2026-12-28"] }, "2026-12-21", "2026-12-23"), "together");
  // apart, a third and a fourth are
  assert.equal(pauseRefusal({ ...year, pauses: ["2026-11-23", "2026-11-30", "2026-12-14"] }, "2026-12-28", "2026-12-23"), null);
  assert.equal(pauseRefusal({ ...year, pauses: ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"] }, "2026-12-28", "2026-12-23"), "spent");
  assert.equal(PAUSES_TOGETHER, 2);
  for (const why of ["spent", "closed", "over", "short", "paused", "together", "outside"]) assert.ok(pauseWhyWords(why).length > 10);
  assert.equal(pauseWhyWords(null), "");
});

test("what a pause writes: the week, the date seven days later, and the date as first set", () => {
  const out = applyPause(H, "2026-12-21", "2026-12-21");
  assert.deepEqual(out, { ok: true, patch: { pauses: ["2026-12-21"], ends_on: "2027-02-23", ends_on_set: "2027-02-16" } });
  assert.deepEqual(applyPause(PAUSED, "2027-01-04", "2027-01-06"), { ok: false, why: "spent" });
  // a second pause on a longer horizon moves the date again and keeps the first date
  const six = { starts_on: "2026-11-17", ends_on: "2027-05-17", kind: "months", months: 6 };
  const one = applyPause(six, "2026-12-21", "2026-12-21");
  const two = applyPause({ ...six, ...one.patch }, "2027-01-11", "2027-01-13");
  assert.deepEqual(two.patch, { pauses: ["2026-12-21", "2027-01-11"], ends_on: "2027-05-31", ends_on_set: "2027-05-17" });
  assert.equal(dateAsSet({ ...six, ...two.patch }), "2027-05-17");
  assert.equal(movedWords({ ...six, ...two.patch }), "Moved two weeks, from 17 May, by two pauses.");
  // reaching back writes the same thing
  assert.deepEqual(applyPause(H, "2026-12-14", "2026-12-23").patch, { pauses: ["2026-12-14"], ends_on: "2027-02-23", ends_on_set: "2027-02-16" });
});

test("on the marathon goal the date stays and the plan closes up by a week", () => {
  const race = { starts_on: "2026-11-17", ends_on: "2027-04-25", kind: "date", months: null, programme: { v: 1, goal: "marathon" } };
  assert.equal(pauseMovesDate(race), false);
  assert.equal(pauseMovesDate(H), true);
  assert.equal(pauseMovesDate({ ...H, programme: { v: 1, goal: "build_fitness" } }), true);
  const out = applyPause(race, "2026-12-21", "2026-12-21");
  assert.deepEqual(out.patch, { pauses: ["2026-12-21"], ends_on: "2027-04-25", ends_on_set: null });
  const before = horizonSpans(race).filter((s) => s.full).length, after = horizonSpans({ ...race, ...out.patch }).filter((s) => s.full).length;
  assert.equal(after, before - 1);
  assert.ok(pauseChoices(race, "2026-12-21").every((c) => c.ends_on === "2027-04-25"));
  assert.equal(movedWords({ ...race, ...out.patch }), "The date stays where it was. One week was set aside, and the plan closes up by one week.");
});

test("the foot of the page says how many pauses a horizon has and which weeks were taken", () => {
  const fresh = pauseState(H, "2026-12-23");
  assert.deepEqual([fresh.allowed, fresh.used, fresh.left, fresh.moves, fresh.open, fresh.words], [1, 0, 1, true, true, "This horizon can be paused once."]);
  const used = pauseState(PAUSED, "2026-12-23");
  assert.deepEqual([used.left, used.open, used.words, used.taken], [0, false, "This horizon can be paused once. It has been used.", ["21 to 27 Dec"]]);
  const six = { starts_on: "2026-11-17", ends_on: "2027-05-17", kind: "months", months: 6 };
  assert.equal(pauseState(six, "2026-12-23").words, "This horizon can be paused twice.");
  assert.equal(pauseState({ ...six, pauses: ["2026-12-21"], ends_on: "2027-05-24", ends_on_set: "2027-05-17" }, "2027-01-06").words, "This horizon can be paused twice. One is left.");
  assert.equal(pauseState({ ...six, pauses: ["2026-12-21", "2027-01-11"], ends_on: "2027-05-31", ends_on_set: "2027-05-17" }, "2027-02-03").words, "This horizon can be paused twice. None is left.");
});

// ── how a paused week is read ──

/** An invented person. The name, the birth year, the height and every reading are no one's: this repo is public. */
function document(today) {
  const activities = [], signals = [], weights = [];
  for (let i = 20; i >= 0; i--) {
    const monday = addDays("2027-01-04", -7 * i);
    const s = (day, name, type, mins, met, z2) => activities.push({ timestamp: `${addDays(monday, day)}T07:00:00`, activity_name: name, activity_type: type, intensity_category: "moderate", duration_minutes: mins, met_minutes: met, met_hours: met / 60, zone2_minutes: z2 });
    if (addDays(monday, 0) <= today) s(0, "Walk", "aerobic", 45, 320, 30);
    if (addDays(monday, 2) <= today) s(2, "Cycle", "aerobic", 45, 300, 30);
    if (addDays(monday, 1) <= today) s(1, "Strength", "strength", 40, 0, 0);
    for (let d = 0; d < 7; d++) { const day = addDays(monday, d); if (day <= today) signals.push({ day, resting_hr: 57, steps: 6900 }); }
    if (monday <= today) weights.push({ measured_on: monday, weight_kg: 72 - (20 - i) * 0.2, source: "health" });
  }
  return {
    generated_at: today, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Asha", born_year: 1974 },
    labs: [], imaging: [], reports: [], files: [], weeks: [], web_body: [], web_crf: [], app_crf: [], app_labs: [], waist: [],
    activities, signals, weights, profile: { weekly_met_hours_goal: 10, height_cm: 160, sex: "female", age: 52 },
    note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  };
}
const personOn = (today) => derivePerson(document(today));
const target = (marker, start, goal, extra = {}) => toTarget({ marker, label: MARKER_BY_KEY[marker].label, unit: MARKER_BY_KEY[marker].unit, start_value: start, start_on: H.starts_on, target_value: goal, cadence: MARKER_BY_KEY[marker].cadence, ...extra });
const TARGETS = [target("dose", 600, 600), target("weight", 72, 68)];

test("in the paused week every row says so, and the weeks that are judged leave the paused one out", () => {
  const during = pacesOf(TARGETS, PAUSED, personOn("2026-12-23"), "2026-12-23");
  assert.ok(during.every((p) => p.paused === true));
  assert.equal(PAUSED_WORD, "Paused this week");
  // the word under it is the one that stood when the week began: four full weeks, not five
  assert.equal(during[0].pace_word, "Reached in 4 of 4 full weeks");
  assert.equal(during[0].week.paused, true);
  assert.match(horizonLinesByCard(PAUSED, TARGETS, personOn("2026-12-23"), "2026-12-23").movement ?? horizonLinesByCard(PAUSED, TARGETS, personOn("2026-12-23"), "2026-12-23").fitness, /paused this week$/);
  // the Monday after, the row is judged again and the paused week is not one of the weeks counted
  const after = pacesOf(TARGETS, PAUSED, personOn("2026-12-30"), "2026-12-30");
  assert.ok(after.every((p) => !p.paused));
  assert.equal(after[0].pace_word, "Reached in 4 of 4 full weeks");
  assert.deepEqual(fullWeeksSoFar(personOn("2026-12-30"), "dose", PAUSED, "2026-12-30").map((w) => w.week_start), ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
  assert.equal(fullWeeksSoFar(personOn("2026-12-30"), "dose", H, "2026-12-30").length, 5);
  // a number to reach is read against the line that stood still: the same expected figure on the two Mondays
  const mon = pacesOf(TARGETS, PAUSED, personOn("2026-12-21"), "2026-12-21")[1], next = pacesOf(TARGETS, PAUSED, personOn("2026-12-28"), "2026-12-28")[1];
  assert.equal(mon.expected_today, next.expected_today);
});

test("the Monday after a paused week the check-in is two fixed lines, and judges nothing", () => {
  const today = "2026-12-28";
  const inputs = checkinInputs(PAUSED, TARGETS, [{ kind: "sessions_week", label: "Three sessions a week", n: 3 }], personOn(today), today);
  assert.deepEqual([inputs.week.from, inputs.week.to, inputs.week.days, inputs.week.short, inputs.week.paused], ["2026-12-21", "2026-12-27", 7, false, true]);
  assert.deepEqual(inputs.adherence, [], "a paused week is not read against the plan's lines");
  assert.deepEqual(inputs.horizon.pauses, [{ from: "2026-12-21", to: "2026-12-27" }]);
  assert.equal(inputs.horizon.date_set, "2027-02-16");
  assert.deepEqual([inputs.horizon.week_of, inputs.horizon.weeks_total], [5, 12]);
  const lines = pausedCheckinLines(inputs);
  assert.deepEqual(lines, [
    { head: "The week", text: "Paused, Mon 21 to Sun 27 Dec. Nothing in it was asked or judged." },
    { head: "The date", text: "Tuesday 23 February 2027, one week later than first set." },
  ]);
  // kept and read back as lines, like any Monday check-in
  assert.deepEqual(checkinLinesOf(linesText(lines)), lines);
  assert.equal(CHECKIN_HEADS.date, "The date");
  // the Guide is shown the week's days and no figure of it
  assert.deepEqual(guideView(inputs, "month").week, { from: "2026-12-21", to: "2026-12-27", days: 7, short: false, paused: true });
  assert.equal(weekLine(inputs), "Paused, Mon 21 to Sun 27 Dec. Nothing in it was asked or judged.");
});

test("the Monday a paused week begins, the check-in reads the week before as usual", () => {
  const today = "2026-12-21";
  const inputs = checkinInputs(PAUSED, TARGETS, [], personOn(today), today);
  assert.deepEqual([inputs.week.from, inputs.week.to, inputs.week.paused], ["2026-12-14", "2026-12-20", undefined]);
  assert.equal(pausedCheckinLines(inputs), null);
  assert.equal(inputs.pace[0].pace_word, "Reached in 4 of 4 full weeks");
  // a week paused ahead of time is not named before it begins
  assert.equal(checkinInputs(PAUSED, TARGETS, [], personOn("2026-12-14"), "2026-12-14").horizon.pauses, undefined);
  // and a horizon that was never paused carries neither key
  const plain = checkinInputs(H, TARGETS, [], personOn(today), today).horizon;
  assert.ok(!("pauses" in plain) && !("date_set" in plain));
});

test("a date that stays says so in the check-in", () => {
  const race = { starts_on: "2026-11-17", ends_on: "2027-04-25", title: "A marathon", pauses: ["2026-12-21"], programme: { goal: "marathon" } };
  const lines = pausedCheckinLines(checkinInputs(race, TARGETS, [], personOn("2026-12-28"), "2026-12-28"));
  assert.equal(lines[1].text, "Sunday 25 April 2027, where it was. The plan closes up by one week.");
});

test("two weeks side by side read as one stretch", () => {
  const year = { starts_on: "2026-11-17", ends_on: "2027-12-01", ends_on_set: "2027-11-17", kind: "months", months: 12, pauses: ["2026-12-21", "2026-12-28"] };
  assert.deepEqual(pausedRunOn(year, "2026-12-30"), { from: "2026-12-21", to: "2027-01-03", resumes: "2027-01-04" });
  assert.equal(pausedRunOn(year, "2027-01-04"), null);
  assert.equal(pausedWeeksWords(year), "Paused: Mon 21 Dec to Sun 3 Jan. A paused week is shown as it was, is not judged, and has no number.");
  assert.equal(movedWords(year), "Moved two weeks, from 17 November, by two pauses.");
});

// ── the week with a coach ──

test("a paused week has no call and is not counted; the sheet says paused", () => {
  const note = (week_start, extra) => ({ horizon_id: "h1", week_start, way: null, away: false, call_at: null, call_kept: null, lines: [], lines_by: null, ...extra });
  const notes = [note("2026-11-23", { call_kept: true }), note("2026-11-30", { call_kept: true }), note("2026-12-07", { call_kept: false }), note("2026-12-14", { call_kept: true })];
  assert.deepEqual(callsKept(notes, PAUSED, "2026-12-30"), { kept: 3, of: 4, paused: 1 });
  assert.deepEqual(callsKept(notes, H, "2026-12-30"), { kept: 3, of: 5, paused: 0 });
  // an answer to "What got in the way?" no longer changes how a week is read
  assert.deepEqual(callsKept([...notes, note("2026-12-28", { way: "travel", away: true })], PAUSED, "2027-01-06"), { kept: 3, of: 5, paused: 1 });
  const during = sheetWeeks(PAUSED, "2026-12-23");
  assert.deepEqual([during.thisWeek.paused, during.thisWeek.n, during.lastWeek.n, during.lastWeek.paused], [true, null, 4, false]);
  const after = sheetWeeks(PAUSED, "2026-12-30");
  assert.deepEqual([after.thisWeek.n, after.thisWeek.paused, after.lastWeek.words, after.lastWeek.paused, after.lastWeek.n], [5, false, "Mon 21 to Sun 27 Dec", true, null]);
  const h = { ...PAUSED, programme: { v: 1, goal: "build_fitness", aims: [], barriers: [], days: [], place: null, writer: "coach" } };
  assert.equal(mondayRow(h, notes, [], "2026-12-30").lastWeek, "Paused");
  assert.equal(mondayRow(h, notes, [], "2026-12-23").call, "No call: paused");
  assert.equal(mondayRow(h, notes, [], "2026-12-23").horizon, "Build fitness · paused this week");
});

test("the counts a test panel reads leave the paused week out of the weeks", () => {
  const today = "2026-12-30";
  const f = horizonFacts({ h: PAUSED, paces: pacesOf(TARGETS, PAUSED, personOn(today), today), targets: TARGETS, notes: [], today });
  assert.deepEqual([f.week, f.weeks_total, f.calls_of, f.weeks_paused, f.weeks_away], [5, 12, 4, 1, 1]);
});

test("the one way a week is set aside is the pause: no answer marks a week away any more", () => {
  assert.equal("AWAY_WAYS" in programmeData, false);
  assert.equal("isAwayWay" in programmeRules, false);
  assert.deepEqual(WAYS.map((w) => w.key), ["time", "travel", "illness", "unsure", "other"]);
  assert.match(BARRIERS.find((b) => b.key === "travel").does, /^A week can be paused\./);
});
