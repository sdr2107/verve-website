// Horizon's arithmetic under node: pace, the words, the plan's adherence, the Guide's draft, the road. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import {
  MARKERS, MARKER_BY_KEY, latestOf, historyOf, paceOf, pacesOf, impliedPace, amountWords, fmtValue,
  adherenceOf, guideDraftPlan, weekOf, daysToGo, roadOf, nextCheckins, checkinInputs, weekFigures, weeklyHistory, dedupeSessions, addMonths, clockOf,
  landedLine, reachedTarget, upTo, horizonMondays, horizonWeeks, outcomeOf, outcomesOf, lastRoadWords, nextSpan,
  swingRead, medicineOf,
} from "../src/my-health/horizon/derive.ts";

const TODAY = "2026-11-08";                      // a Sunday; the last complete week is 26 October
const H = { starts_on: "2026-09-01", ends_on: "2027-04-18", title: "Boston Marathon" };

/** A synced person's document: eight weeks of sessions, nights, mornings, weighings, two lipid reports, a waist. */
function document() {
  const activities = [], weeks = [], signals = [], weights = [];
  // weeks from 14 Sep to 2 Nov (eight complete + the current one): two runs, a cycle, one strength session; the long run on Saturday
  for (let i = 8; i >= 0; i--) {
    const monday = addDays("2026-11-02", -7 * i);
    const s = (day, h, name, type, cat, mins, met, z2) => activities.push({ timestamp: `${addDays(monday, day)}T${String(h).padStart(2, "0")}:00:00`, activity_name: name, activity_type: type, intensity_category: cat, duration_minutes: mins, met_minutes: met, met_hours: met / 60, zone2_minutes: z2, source: "healthkit" });
    s(0, 7, "Run", "aerobic", "moderate", 44, 210, 30);
    s(1, 18, "Strength", "strength", "moderate", 42, 0, 0);
    s(2, 7, "Cycle", "aerobic", "moderate", 46, 184, 36);
    if (i !== 0) s(4, 7, "Run", "aerobic", "vigorous", 52, 268, 20); else s(4, 7, "Run", "aerobic", "vigorous", 52, 268, 20);
    s(5, 7, "Long run", "aerobic", "moderate", i === 0 ? 112 : 100, i === 0 ? 420 : 380, 70);
    // the app's own row for every complete week: the dose it counted, the zones, the strength count
    if (i > 0) weeks.push({ week_start: monday, source: "sync", synced_at: "2026-11-08T07:12:00Z", met_hours: 17, minutes: 284, workouts: 5, dose_met_min: i % 2 ? 1040 : 880, dose_goal_met_min: 1000, zone1_min: 110, zone2_min: 102, zone3_min: 38, strength_sessions: 1, background_min_avg: 44 });
    // nights and mornings: in bed 23:20, 8 h; resting 52; HRV 48 from WHOOP
    for (let d = 0; d < 7; d++) {
      const day = addDays(monday, d);
      if (day > TODAY) break;
      const late = d === 3;   // Thursday runs late
      signals.push({ day, resting_hr: 52 + (d % 2), sleep_minutes: 480 + d * 2, sleep_start: `${addDays(day, -1)}T${late ? "00:40" : "23:20"}:00`, sleep_end: `${day}T07:40:00`, hrv_night_ms: 48, hrv_source: "WHOOP", steps: 8000 + d * 100, sedentary_minutes: 430, sri_30d: 84, breathing_rpm: 14, spo2_pct: 97, bp_sbp: 118, bp_dbp: 76, bp_n: 2, bp_sbp_max: 124, bp_dbp_max: 80 });
    }
    weights.push({ measured_on: monday, weight_kg: 75.6 - (8 - i) * 0.175, source: "health" });
  }
  // this week's app row too (the current week, written on today's sync)
  weeks.push({ week_start: "2026-11-02", source: "sync", synced_at: "2026-11-08T07:12:00Z", met_hours: 14, minutes: 296, workouts: 5, dose_met_min: 814, dose_goal_met_min: 1000, zone1_min: 128, zone2_min: 96, zone3_min: 41, strength_sessions: 1, background_min_avg: 46 });
  const labs = [
    { analyte: "LDL", value: 143, unit: "mg/dL", ref_low: null, ref_high: 100, measured_on: "2026-04-14" },
    { analyte: "LDL", value: 131, unit: "mg/dL", ref_low: null, ref_high: 100, measured_on: "2026-10-12" },
    { analyte: "Total cholesterol", value: 193, unit: "mg/dL", measured_on: "2026-10-12" },
    { analyte: "HDL", value: 54, unit: "mg/dL", measured_on: "2026-10-12" },
    { analyte: "Triglycerides", value: 97, unit: "mg/dL", measured_on: "2026-10-12" },
    { analyte: "HbA1c", value: 5.4, unit: "%", measured_on: "2026-10-12" },
  ];
  return {
    generated_at: TODAY, me: { id: "u1", email: "x@y", profile: null, role: null }, people: [], grants_to_me: [],
    person: { id: "p1", owner_id: "u1", account_id: "u1", name: "Sudeep", born_year: 1981 },
    labs, imaging: [], reports: [], files: [], weeks, web_crf: [], web_body: [],
    app_labs: [{ measured_at: "2026-11-07T08:00:00", alm_kg: 24.8, ffm_kg: 60.6, body_fat_pct: 18.4 }, { measured_at: "2026-05-08T08:00:00", alm_kg: 24.5 }],
    activities,
    app_crf: [{ timestamp: "2026-05-08T08:00:00", met_capacity: 8.4, vo2_max_estimate: 29.4, estimation_method: "wearable", performance_category: "below-average" }, { timestamp: "2026-11-01T08:00:00", met_capacity: 8.9, vo2_max_estimate: 31.2, estimation_method: "wearable", performance_category: "above-average" }],
    waist: [{ measured_at: "2026-05-03T08:00:00", waist_cm: 99 }, { measured_at: "2026-11-03T08:00:00", waist_cm: 96 }],
    profile: { weekly_met_hours_goal: 16.67, height_cm: 175, sex: "male", age: 45 },
    signals, weights, note: null, sharing: [], sharing_pros: [], invites: [], asked: [], requests: [], ai: { summary: null, consent: null },
  };
}
const person = derivePerson(document());

test("the catalogue names every allowed marker once, with a unit and a way of being measured", () => {
  const keys = MARKERS.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const m of MARKERS) { assert.ok(m.label && m.how, m.key); assert.ok(MARKER_BY_KEY[m.key] === m); }
  assert.equal(keys.length, 36);
});

test("latestOf reads each kind from the document: tests, the app's week row, the scale, the reports, the nights", () => {
  assert.equal(latestOf("mets", person, TODAY).value, 8.9);
  assert.equal(latestOf("vo2", person, TODAY).value, 31.2);
  const dose = latestOf("dose", person, TODAY);
  assert.equal(dose.value, 1040, "the last complete week, from the app's row");
  assert.equal(dose.on, "2026-11-01");
  assert.equal(latestOf("strength_week", person, TODAY).value, 1);
  assert.equal(latestOf("longest_session", person, TODAY).value, 100);
  assert.equal(Math.round(latestOf("weight", person, TODAY).value * 10) / 10, 74.2);
  assert.equal(latestOf("waist", person, TODAY).value, 96);
  const ldl = latestOf("ldl", person, TODAY);
  assert.equal(ldl.value, 131); assert.equal(ldl.unit, "mg/dL"); assert.equal(ldl.on, "2026-10-12");
  assert.equal(latestOf("non_hdl", person, TODAY).value, 139);
  assert.equal(Math.round(latestOf("almi", person, TODAY).value * 10) / 10, 8.1);
  const bp = latestOf("bp", person, TODAY);
  assert.equal(bp.value, 118); assert.equal(bp.display, "118/76");
  assert.equal(Math.round(latestOf("rhr", person, TODAY).value * 100) / 100, 52.43, "the mean of the last seven mornings");
  assert.equal(latestOf("sleep", person, TODAY).value, 486);
  assert.equal(latestOf("sri", person, TODAY).value, 84);
  assert.equal(latestOf("hrv", person, TODAY).writer, "WHOOP");
  assert.equal(latestOf("grip", person, TODAY), null, "no reading is null, never zero");
});

test("the app's week row wins over the sessions; a week without one is counted from the sessions", () => {
  const withRow = weekFigures(person, "2026-10-26");
  assert.equal(withRow.from, "app"); assert.equal(withRow.dose, 1040); assert.equal(withRow.zoned, 140, "zones 2 and 3, the training minutes");
  const fresh = derivePerson({ ...document(), weeks: [] });
  const counted = weekFigures(fresh, "2026-10-26");
  assert.equal(counted.from, "sessions");
  assert.equal(counted.dose, 210 + 184 + 268 + 380, "moderate or vigorous aerobic sessions, MET × minutes; strength is not dose");
  assert.equal(counted.strength, 1); assert.equal(counted.longest, 100);
  assert.equal(weeklyHistory(person, "dose", TODAY, 4).map((w) => w.v).join(","), "880,1040,880,1040");
});

test("two writers of one session are one session", () => {
  const a = { timestamp: "2026-11-03T07:00:00", duration_minutes: 40, source: "healthkit", zone2_minutes: null };
  const b = { ...a, source: "manual", zone2_minutes: 22 };
  const out = dedupeSessions([a, b]);
  assert.equal(out.length, 1); assert.equal(out[0].zone2_minutes, 22, "the scored row is kept");
});

const tgt = (marker, start, target, extra = {}) => ({ marker, label: MARKER_BY_KEY[marker].label, unit: MARKER_BY_KEY[marker].unit, start_value: start, start_on: "2026-09-01", target_value: target, cadence: MARKER_BY_KEY[marker].cadence, ...extra });
const read = (value, on = "2026-11-07") => ({ value, on, unit: null, writer: null });

test("pace interpolates from the start to the date and reads the gap", () => {
  const p = paceOf(tgt("mets", 8.6, 9.6), H, read(8.9), TODAY);
  assert.equal(Math.round(p.elapsed * 1000) / 1000, Math.round((68 / 229) * 1000) / 1000);
  assert.equal(Math.round(p.expected_today * 100) / 100, 8.9);
  assert.equal(p.pace_word, "On pace"); assert.equal(p.tone, "good");
  assert.equal(paceOf(tgt("weight", 75.6, 72.0), H, read(74.2), TODAY).pace_word, "Ahead of pace");
  const waist = paceOf(tgt("waist", 98, 90), H, read(96.5), TODAY);
  assert.equal(waist.pace_word, "A centimetre behind"); assert.equal(waist.tone, "caution");
  assert.equal(paceOf(tgt("longest_session", 90, 180), H, read(112), TODAY).pace_word, "Five minutes behind");
  assert.equal(paceOf(tgt("strength_week", 1, 2), H, read(1), TODAY).pace_word, "Not yet moving");
  assert.equal(paceOf(tgt("sri", 79, 85), H, read(84), TODAY).pace_word, "Nearly there");
  assert.equal(paceOf(tgt("sri", 79, 85), H, read(85), TODAY).pace_word, "Reached");
  assert.equal(paceOf(tgt("rhr", 55, 52), H, null, TODAY).pace_word, "No reading yet");
  assert.equal(paceOf(tgt("rhr", 52, 52), H, read(52), TODAY).pace_word, "Already there");
});

test("a standing weekly figure reads as the weeks that reached it", () => {
  const weekly = [{ week_start: "2026-10-05", v: 1040 }, { week_start: "2026-10-12", v: 880 }, { week_start: "2026-10-19", v: 1120 }, { week_start: "2026-10-26", v: 814 }];
  const p = paceOf(tgt("dose", 820, 1000), H, read(814), TODAY, weekly);
  assert.equal(p.pace_word, "Reached in 2 of the last 4 weeks"); assert.equal(p.tone, "caution");
  assert.equal(paceOf(tgt("dose", 820, 1000), H, read(814), TODAY, []).pace_word, "No complete week yet");
  // a floor set BELOW the latest week is still a floor: the weeks at or above it are met, not the weeks under it
  const under = [{ week_start: "2026-10-05", v: 1040 }, { week_start: "2026-10-12", v: 880 }, { week_start: "2026-10-19", v: 1120 }, { week_start: "2026-10-26", v: 1132 }];
  const floor = paceOf(tgt("dose", 1132, 1000), H, read(1132), TODAY, under);
  assert.equal(floor.pace_word, "Reached in 3 of the last 4 weeks"); assert.equal(floor.tone, "caution");
});

test("a blood marker is known when you measure", () => {
  const p = paceOf(tgt("ldl", 143, 100, { start_on: "2026-10-12", next_on: "2027-04-10" }), H, read(131, "2026-10-12"), TODAY);
  assert.equal(p.pace_word, "October's report · next in April"); assert.equal(p.tone, "neutral");
  const later = paceOf(tgt("ldl", 143, 100, { start_on: "2026-04-14" }), H, read(131, "2026-10-12"), TODAY);
  assert.notEqual(later.pace_word, "October's report", "a report after the start is read for pace");
});

test("pacesOf looks the readings up in the document", () => {
  const ps = pacesOf([tgt("mets", 8.6, 9.6), tgt("dose", 820, 1000), tgt("waist", 98, 90)], H, person, TODAY);
  assert.equal(ps[0].now, 8.9); assert.equal(ps[0].nowText, "8.9");
  assert.equal(ps[1].pace_word, "Reached in 2 of the last 4 weeks");
  assert.equal(ps[2].now, 96); assert.equal(ps[2].startText, "98");
});

test("amounts in a marker's own words, and figures as the page writes them", () => {
  assert.equal(amountWords(MARKER_BY_KEY.waist, 1), "a centimetre");
  assert.equal(amountWords(MARKER_BY_KEY.waist, 6), "six centimetres");
  assert.equal(amountWords(MARKER_BY_KEY.weight, 2.2), "2.2 kg");
  assert.equal(amountWords(MARKER_BY_KEY.weight, 0.5), "half a kilo");
  assert.equal(amountWords(MARKER_BY_KEY.mets, 0.7), "0.7 METs");
  assert.equal(amountWords(MARKER_BY_KEY.strength_week, 2), "two sessions");
  assert.equal(amountWords(MARKER_BY_KEY.longest_session, 5), "five minutes");
  assert.equal(amountWords(MARKER_BY_KEY.longest_session, 90), "1 h 30");
  assert.equal(fmtValue(MARKER_BY_KEY.longest_session, 112), "1 h 52");
  assert.equal(fmtValue(MARKER_BY_KEY.dose, 1120), "1,120");
  assert.equal(fmtValue(MARKER_BY_KEY.mets, 8.9), "8.9");
  assert.equal(fmtValue(MARKER_BY_KEY.mets, null), "—");
});

test("the setup's note says the pace a number implies, against the person's own six months", () => {
  const hist = [{ d: "2026-05-08", v: 8.4 }, { d: "2026-11-01", v: 8.9 }];
  const note = impliedPace(MARKER_BY_KEY.mets, read(8.9, "2026-11-01"), 9.6, 23, hist, TODAY);
  assert.match(note, /^0\.7 METs in 23 weeks/);
  assert.match(note, /last six months, which moved 0\.5 METs/);
  const w = impliedPace(MARKER_BY_KEY.weight, read(74.2), 72.0, 23, [{ d: "2026-05-04", v: 76.8 }, { d: "2026-11-02", v: 74.2 }], TODAY);
  assert.match(w, /^2\.2 kg in 23 weeks is under 0\.1 kg a week\./);
  assert.match(w, /About your recent pace: your last six months moved 2\.6 kg/);
  assert.match(impliedPace(MARKER_BY_KEY.ldl, read(131), 100, 23, [], TODAY), /known only when you measure/);
  // a blood number inside the usual swing of today's figure says so when it is set; one beyond it says nothing more
  assert.equal(impliedPace(MARKER_BY_KEY.ldl, read(131), 100, 23, [], TODAY), "A blood target is known only when you measure. Choose the week you will, and the report lands here. Your number is inside LDL's usual swing from 131, which is about 26 to 27%. A report at your number will not be called reached.");
  assert.equal(impliedPace(MARKER_BY_KEY.ldl, read(131), 80, 23, [], TODAY), "A blood target is known only when you measure. Choose the week you will, and the report lands here.");
  assert.equal(impliedPace(MARKER_BY_KEY.triglycerides, read(190), 150, 23, [], TODAY), "A blood target is known only when you measure. Choose the week you will, and the report lands here.", "no swing on file: nothing is said at set-up");
  assert.equal(impliedPace(MARKER_BY_KEY.ldl, null, 100, 23, [], TODAY), "A blood target is known only when you measure. Choose the week you will, and the report lands here.");
  assert.match(impliedPace(MARKER_BY_KEY.hs_crp, read(1.4), 1.0, 23, [], TODAY), /inside hs-CRP's usual swing from 1\.4: it takes a rise to more than 3\.2 times, or a fall of more than 69%, to be more than that\. A report at your number will not be called reached\.$/);
  assert.match(impliedPace(MARKER_BY_KEY.dose, read(880), 1000, 23, [], TODAY, [{ week_start: "a", v: 1040 }, { week_start: "b", v: 880 }]), /reached it in 1 of the last 2/);
  assert.match(impliedPace(MARKER_BY_KEY.grip, null, 46, 23, [], TODAY), /No reading yet/);
  assert.match(impliedPace(MARKER_BY_KEY.waist, read(96), 90, 23, [{ d: "2026-05-03", v: 99 }, { d: "2026-11-03", v: 96 }], TODAY), /^Six centimetres in 23 weeks\. Twice your recent pace/);
});

test("adherence is read from the sessions and the nights, per row kind", () => {
  const plan = [
    { kind: "sessions_week", label: "Three runs a week, one of them long", n: 3 },
    { kind: "strength_week", label: "Strength twice a week", n: 2 },
    { kind: "long_session", label: "One session of 3 h 00 or more", n: 180 },
    { kind: "zone2_most", label: "Most minutes in zone 2" },
    { kind: "bedtime_by", label: "In bed by 23:30", n: 1410 },
    { kind: "weigh_in", label: "Weigh in on Monday mornings" },
    { kind: "custom", label: "Stretch after the long run", note: "your own line" },
  ];
  const a = adherenceOf(plan, person, "2026-11-02", TODAY);
  assert.equal(a[0].done, 5); assert.equal(a[0].word, "Done"); assert.equal(a[0].tone, "good");
  assert.equal(a[1].done, 1); assert.equal(a[1].of, 2); assert.equal(a[1].word, "One to go"); assert.equal(a[1].tone, "caution", "no days left in the week");
  assert.equal(a[2].word, "Longest so far 1 h 52");
  assert.equal(a[3].done, 96); assert.equal(a[3].of, 137); assert.equal(a[3].word, "Yes");
  assert.equal(a[4].done, 6); assert.equal(a[4].of, 7); assert.equal(a[4].word, "Yes");
  assert.equal(a[5].word, "Done, 74.2 kg");
  assert.equal(a[6].word, "your own line");
  const mid = adherenceOf([{ kind: "sessions_week", label: "Six sessions a week", n: 6 }], person, "2026-11-02", "2026-11-04");
  assert.equal(mid[0].word, "One to go"); assert.equal(mid[0].tone, "neutral", "with days left, a session to go is not a worry");
});

test("the Guide's draft is the last eight weeks written as intent", () => {
  const rows = guideDraftPlan(person, TODAY);
  const kinds = rows.map((r) => r.kind);
  assert.deepEqual(kinds, ["sessions_week", "long_session", "strength_week", "zone2_most", "bedtime_by", "weigh_in"]);
  assert.equal(rows[0].label, "Five sessions a week"); assert.equal(rows[0].n, 5);
  assert.equal(rows[1].n, 100); assert.equal(rows[1].label, "One session of 1 h 40 or more");
  assert.equal(rows[2].label, "Strength once a week");
  assert.equal(rows[4].label, "In bed by 23:15"); assert.equal(clockOf(rows[4].n), "23:15");
});

test("weeks, days and the road are counted from the dates", () => {
  assert.deepEqual(weekOf(H, TODAY), { week: 10, weeks: 33 });
  assert.equal(daysToGo(H, TODAY), 161);
  const road = roadOf(H, TODAY);
  assert.equal(road.length, 10);
  assert.deepEqual(road.map((s) => s.sub), ["set", "month read", "month read", "week 10", "month read", "month read", "month read", "month read", "month read", "Boston Marathon"]);
  assert.deepEqual(road.map((s) => s.state).slice(0, 4), ["past", "past", "past", "now"]);
  assert.equal(road[road.length - 1].state, "end");
  assert.deepEqual(nextCheckins(H, TODAY), { thisMonday: "2026-11-02", nextMonday: "2026-11-09", monthReview: "2026-12-01" });
  assert.equal(addMonths("2026-11-08", 3), "2027-02-08");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28", "a short month clamps");
});

test("the check-in's inputs carry the week, the paces, the plan and its adherence, with no prose", () => {
  const targets = [tgt("mets", 8.6, 9.6), tgt("dose", 820, 1000)];
  const plan = [{ kind: "sessions_week", label: "Five sessions a week", n: 5 }];
  const inp = checkinInputs(H, targets, plan, person, TODAY);
  assert.equal(inp.week.dose, 1040); assert.equal(inp.week.goal, 1000); assert.equal(inp.week.strength, 1);
  assert.equal(inp.week.rhr, 52); assert.equal(inp.week.sleep_avg, 486);
  assert.equal(inp.pace.length, 2); assert.equal(inp.pace[0].pace_word, "On pace");
  assert.equal(inp.adherence[0].word, "Done");
  assert.deepEqual(inp.horizon, { title: "Boston Marathon", ends_on: "2027-04-18", week_of: 10, weeks_total: 33, days_to_go: 161 });
});

test("history gives the readings a six-month comparison needs", () => {
  assert.equal(historyOf("mets", person, TODAY).length, 2);
  assert.equal(historyOf("weight", person, TODAY).length, 9);
  assert.equal(historyOf("dose", person, TODAY).length, 8, "complete weeks with a figure");
  assert.equal(historyOf("ldl", person, TODAY)[0].v, 143);
});

test("the markers a target can be set on are 36, the count the page names", () => {
  assert.equal(MARKERS.length, 36);
  assert.equal(new Set(MARKERS.map((m) => m.key)).size, 36);
});

test("a blood target says which report it is read from once one newer than the start lands (board 04)", () => {
  const ldl = latestOf("ldl", person, TODAY);
  // set in April on April's report; October's report has landed since
  const after = paceOf(tgt("ldl", 143, 100, { start_on: "2026-04-14" }), H, ldl, TODAY);
  assert.equal(after.source, "from the report of 12 October");
  assert.equal(after.nowText, "131.0"); assert.ok(!/next in|retest|test again/i.test(after.pace_word), "no retest wording");
  // set on October's report itself: nothing newer, so the row waits and names no source
  const waiting = paceOf(tgt("ldl", 131, 100, { start_on: "2026-10-12" }), H, ldl, TODAY);
  assert.equal(waiting.source, null); assert.equal(waiting.pace_word, "October's report");
  // at the number, by the measured value: but a move inside LDL's usual swing is not called reached
  const at = paceOf(tgt("ldl", 143, 135, { start_on: "2026-04-14" }), H, ldl, TODAY);
  assert.equal(at.pace_word, "At your number"); assert.equal(at.tone, "neutral"); assert.equal(at.source, "from the report of 12 October");
  assert.equal(at.swing.words, "The move from 143 is inside LDL's usual swing, about 26 to 27%.");
  // a move of more than the swing is reached
  const reached = paceOf(tgt("ldl", 200, 135, { start_on: "2026-04-14" }), H, ldl, TODAY);
  assert.equal(reached.pace_word, "Reached"); assert.equal(reached.tone, "good"); assert.equal(reached.swing.state, "more");
  // the row waiting on its first report carries no swing, and neither does a marker that is not blood
  assert.equal(waiting.swing, null); assert.equal(paceOf(tgt("mets", 8.6, 9.6), H, read(8.9), TODAY).swing, null);
  // a marker that is not blood never carries a source
  assert.equal(paceOf(tgt("mets", 8.6, 9.6), H, read(8.9), TODAY).source, null);
});

test("a landed report writes one line: what it said, what it said before, and whether the target is reached", () => {
  const landed = { marker: "ldl", label: "LDL", value: 92, unit: "mg/dL", on: "2026-12-03", previous: 118 };
  assert.equal(landedLine(landed), "A report landed: LDL 92, from 118.");
  // at the number, but 118 to 92 is inside LDL's usual swing: the line says so and does not call it reached
  assert.equal(landedLine(landed, { start_value: 118, target_value: 100 }), "A report landed: LDL 92, from 118. It is at your number of 100. The move from 118 is inside LDL's usual swing, about 26 to 27%. So the horizon does not call it reached.");
  // a move of more than the swing is reached, and the line says why
  assert.equal(landedLine({ ...landed, previous: 160 }, { start_value: 160, target_value: 100 }), "A report landed: LDL 92, from 160. The target of 100 is reached. The move from 160 is more than LDL's usual swing of about 26 to 27%. The horizon keeps it as a floor to hold.");
  // a marker with no swing on file is read as it stands, and the line says that too
  assert.equal(landedLine({ marker: "triglycerides", label: "Triglycerides", value: 140, unit: "mg/dL", on: "2026-12-03", previous: 190 }, { start_value: 190, target_value: 150 }), "A report landed: Triglycerides 140, from 190. The target of 150 is reached. No usual swing is on file for triglycerides, so the number is read as it stands. The horizon keeps it as a floor to hold.");
  assert.equal(landedLine({ ...landed, value: 109 }, { start_value: 118, target_value: 100 }), "A report landed: LDL 109, from 118.");
  assert.equal(landedLine({ ...landed, previous: null }), "A report landed: LDL 92.");
  assert.equal(landedLine({ marker: "hba1c", label: "HbA1c", value: 5.4, unit: "%", on: "2026-12-03", previous: 5.7 }, { start_value: 5.7, target_value: 5.5 }), "A report landed: HbA1c 5.4, from 5.7. It is at your number of 5.5. The move from 5.7 is at the edge of HbA1c's usual swing, about 0.2 to 0.5 points at this level. So the horizon does not call it reached.");
  // a target with no start reads its direction, and its swing, from the reading before
  assert.ok(landedLine(landed, { start_value: null, target_value: 100 }).includes("It is at your number of 100"));
  // with no start and no reading before, there is nothing to read a swing from: the number is reached as it stands
  assert.equal(landedLine({ ...landed, previous: null }, { start_value: null, target_value: 90 }), "A report landed: LDL 92. The target of 90 is reached; the horizon keeps it as a floor to hold.");
  assert.equal(reachedTarget({ start_value: 49, target_value: 150 }, 152), true); assert.equal(reachedTarget({ start_value: 49, target_value: 150 }, 120), false);
  for (const start of [118, 160]) assert.ok(!/retest|test again|next test|another test/i.test(landedLine({ ...landed, previous: start }, { start_value: start, target_value: 100 })), "nothing asks for another test");
});


// ── the whole road (board 06) ──
const DONE = { starts_on: "2026-09-14", ends_on: "2026-11-08", title: "8 weeks" };   // a Monday to a Sunday: eight complete weeks, 14 Sep to 2 Nov

test("a horizon's complete weeks run from its first Monday to the last week that ends by its date", () => {
  assert.equal(horizonMondays(DONE).length, 8);
  assert.equal(horizonMondays(DONE)[0], "2026-09-14"); assert.equal(horizonMondays(DONE)[7], "2026-11-02");
  assert.equal(horizonMondays({ starts_on: "2026-11-09", ends_on: "2027-02-09" }).length, 13, "9 November to 9 February is thirteen complete weeks");
  assert.equal(horizonMondays({ starts_on: "2026-09-16", ends_on: "2026-11-08" })[0], "2026-09-21", "set on a Wednesday, the first complete week starts the Monday after");
  assert.equal(horizonWeeks(person, "dose", DONE).map((w) => w.v).join(","), "1040,880,1040,880,1040,880,1040,814");
});

test("the document as it stood on a day keeps only what was on file by then", () => {
  const then = upTo(person, "2026-10-01");
  assert.equal(latestOf("mets", then, "2026-10-02").value, 8.4, "November's test is not on file yet");
  assert.equal(latestOf("dose", then, "2026-10-02").value, 880, "the week of 21 September, the last complete one");
  assert.equal(latestOf("ldl", then, "2026-10-02").value, 143);
  assert.equal(latestOf("mets", person, TODAY).value, 8.9, "the person in hand is not changed");
});

test("an outcome is the pace rule read on the date: weeks met, the week a number was reached, or short by the gap", () => {
  const dose = outcomeOf(tgt("dose", 1040, 1000, { start_on: "2026-09-13" }), DONE, person);
  assert.equal(dose.word, "Reached in 4 of 8 weeks"); assert.equal(dose.tone, "caution"); assert.equal(dose.endText, "814");
  assert.equal(outcomeOf(tgt("dose", 1040, 800, { start_on: "2026-09-13" }), DONE, person).word, "Reached in 8 of 8 weeks");
  const held = outcomeOf(tgt("zone2_week", 90, 96, { start_on: "2026-09-13" }), DONE, person);
  assert.equal(held.word, "Reached in week 1"); assert.equal(held.tone, "good"); assert.equal(held.endText, "96");
  const lost = outcomeOf(tgt("zone2_week", 90, 100, { start_on: "2026-09-13" }), DONE, person);
  assert.equal(lost.word, "Reached in week 1, not held"); assert.equal(lost.tone, "caution");
  assert.equal(outcomeOf(tgt("zone2_week", 90, 150, { start_on: "2026-09-13" }), DONE, person).word, "54 minutes short");
  const mets = outcomeOf(tgt("mets", 8.4, 9.5, { start_on: "2026-05-08" }), DONE, person);
  assert.equal(mets.word, "0.6 METs short"); assert.equal(mets.startText, "8.4"); assert.equal(mets.endText, "8.9"); assert.equal(mets.targetText, "9.5");
  assert.equal(outcomeOf(tgt("mets", 8.4, 8.9, { start_on: "2026-05-08" }), DONE, person).word, "Reached");
  assert.equal(outcomeOf(tgt("ldl", 131, 100, { start_on: "2026-10-12" }), DONE, person).word, "No report since the start");
  assert.equal(outcomeOf(tgt("ldl", 143, 100, { start_on: "2026-04-14" }), DONE, person).word, "31 mg/dL short");
  // a blood target at its number on the date is reached only when the move is more than its usual swing
  const atNumber = outcomeOf(tgt("ldl", 143, 135, { start_on: "2026-04-14" }), DONE, person);
  assert.equal(atNumber.word, "At the number, inside its usual swing"); assert.equal(atNumber.tone, "neutral");
  assert.equal(atNumber.swing, "The move from 143 is inside LDL's usual swing, about 26 to 27%.");
  assert.equal(outcomeOf(tgt("ldl", 200, 135, { start_on: "2026-04-14" }), DONE, person).word, "Reached");
  assert.equal(mets.swing, null); assert.equal(mets.medicine, null);
  assert.equal(outcomeOf(tgt("grip", null, 40), DONE, person).word, "No reading");
  assert.equal(outcomesOf([tgt("mets", 8.4, 9.5), tgt("dose", 1040, 1000)], DONE, person).length, 2);
  for (const o of outcomesOf([tgt("mets", 8.4, 9.5, { start_on: "2026-05-08" }), tgt("dose", 1040, 1000), tgt("zone2_week", 90, 150)], DONE, person)) assert.ok(!/behind/.test(o.word), "the road is over: short, not behind");
});

test("the next horizon opens on the same span, and each row carries what the last road did", () => {
  assert.equal(lastRoadWords(tgt("mets", 8.4, 9.5, { start_on: "2026-05-08" }), DONE, person), "+0.5 METs in 8 weeks");
  assert.equal(lastRoadWords(tgt("dose", 1040, 1000), DONE, person), "1,000 held in 4 of 8");
  assert.equal(lastRoadWords(tgt("zone2_week", 90, 150), DONE, person), "90 → 96 in 8 weeks");
  assert.equal(lastRoadWords(tgt("weight", 75.4, 74.0), DONE, person), "−1.2 kg in 8 weeks");
  assert.equal(lastRoadWords(tgt("grip", null, 40), DONE, person), "No reading to compare");
  assert.deepEqual(nextSpan({ starts_on: "2026-11-09", ends_on: "2027-02-09", title: "3 months", months: 3 }, "2027-02-09"), { kind: 3, title: "", date: "" });
  assert.deepEqual(nextSpan({ starts_on: "2026-09-01", ends_on: "2027-04-18", title: "Boston Marathon", months: null }, "2027-04-18"), { kind: "date", title: "Boston Marathon", date: addDays("2027-04-18", 229) });
});

// ── the guards on a blood target (12 Nov 2026): every figure here is invented ──

test("a blood move is read against the marker's usual swing: inside, at its edge, more than, or none on file", () => {
  assert.deepEqual(swingRead("ldl", 110, 99), { state: "inside", range: "about 26 to 27%", words: "The move from 110 is inside LDL's usual swing, about 26 to 27%." });
  assert.equal(swingRead("ldl", 100, 74).state, "edge");
  assert.equal(swingRead("ldl", 100, 74).words, "The move from 100 is at the edge of LDL's usual swing, about 26 to 27%.");
  assert.equal(swingRead("apob", 100, 78).words, "The move from 100 is more than ApoB's usual swing of about 19%.");
  assert.equal(swingRead("fasting_glucose", 100, 92).words, "The move from 100 is inside fasting glucose's usual swing, about 15%.");
  assert.equal(swingRead("hba1c", 6.0, 5.2).state, "more");
  assert.equal(swingRead("hs_crp", 2.0, 1.2).words, "The move from 2 is inside hs-CRP's usual swing. It takes a rise to more than 3.2 times, or a fall of more than 69%, to be more than that.");
  assert.equal(swingRead("hs_crp", 2.0, 0.5).state, "more");
  // the four with no swing on file say so: the number is read as it stands
  for (const [k, name] of [["triglycerides", "triglycerides"], ["hdl", "HDL"], ["non_hdl", "non-HDL"], ["remnant", "remnant cholesterol"]]) assert.deepEqual(swingRead(k, 150, 120), { state: "none", range: null, words: `No usual swing is on file for ${name}, so the number is read as it stands.` });
  assert.equal(swingRead("ldl", 110, 110).words, "It has not moved from 110.");
  // only blood has a swing, and only two figures make a move
  assert.equal(swingRead("weight", 80, 70), null); assert.equal(swingRead("bp", 130, 110), null);
  assert.equal(swingRead("ldl", null, 99), null); assert.equal(swingRead("ldl", 110, null), null);
});

/** The same person, having told the app about a medicine: rows of the app's Metabolic section carry the answers. */
function withMedicine(rows) {
  const d = document();
  d.app_labs = [...d.app_labs, ...rows];
  return derivePerson(d);
}

test("a medicine on file is the newest answer given in the app, on a Metabolic row on or before the day", () => {
  const p = withMedicine([
    { measured_at: "2026-09-02T08:00:00", source: "metabolic", on_cholesterol_med: true, on_diabetes_med: false },
    { measured_at: "2026-10-12T08:00:00", source: "metabolic", waist_cm: 96 },                       // says nothing about a medicine
    { measured_at: "2026-10-20T08:00:00", source: "heart", on_cholesterol_med: false },               // not a row of the section that asks
  ]);
  const m = medicineOf("ldl", p, TODAY);
  assert.deepEqual(m, { words: "On cholesterol medication", said_on: "2026-09-02", line: "On cholesterol medication, as last said in the app on 2 September." });
  // every lipid target reads the one switch; the sugar markers and the cuff read their own
  for (const k of ["apob", "remnant", "non_hdl", "triglycerides", "hdl"]) assert.equal(medicineOf(k, p, TODAY)?.words, "On cholesterol medication", k);
  assert.equal(medicineOf("hba1c", p, TODAY), null, "the newest answer about diabetes medication is no");
  assert.equal(medicineOf("bp", p, TODAY), null, "nothing was ever said about blood pressure medication");
  assert.equal(medicineOf("hs_crp", p, TODAY), null); assert.equal(medicineOf("weight", p, TODAY), null);
  // as of a day before the answer, there is none; a later "no" ends it; another year is named
  assert.equal(medicineOf("ldl", p, "2026-09-01"), null);
  assert.equal(medicineOf("ldl", withMedicine([{ measured_at: "2026-09-02T08:00:00", source: "metabolic", on_cholesterol_med: true }, { measured_at: "2026-10-30T08:00:00", source: "metabolic", on_cholesterol_med: false }]), TODAY), null);
  assert.equal(medicineOf("fasting_glucose", withMedicine([{ measured_at: "2025-12-03T08:00:00", source: "metabolic", on_diabetes_med: true }]), TODAY).line, "On diabetes medication, as last said in the app on 3 December 2025.");
  assert.equal(medicineOf("bp", withMedicine([{ measured_at: "2026-11-01T08:00:00", source: "metabolic", on_bp_med: true }]), TODAY).line, "On blood pressure medication, as last said in the app on 1 November.");
  assert.equal(medicineOf("ldl", person, TODAY), null, "a person who has said nothing has no line");
});

test("the row carries both guards in the page's own sentences; the check-in's inputs carry the swing alone", () => {
  const p = withMedicine([{ measured_at: "2026-09-02T08:00:00", source: "metabolic", on_cholesterol_med: true }]);
  const targets = [tgt("ldl", 143, 135, { start_on: "2026-04-14" }), tgt("mets", 8.6, 9.6), tgt("dose", 820, 1000)];
  const [ldl, mets, dose] = pacesOf(targets, H, p, TODAY);
  assert.equal(ldl.pace_word, "At your number");
  assert.equal(ldl.medicine, "On cholesterol medication, as last said in the app on 2 September.");
  assert.equal(mets.medicine, null); assert.equal(dose.medicine, null); assert.equal(mets.swing, null);
  const inputs = checkinInputs(H, targets, [], p, TODAY);
  // the check-in's inputs carry the swing's sentence; the medicine stays on the page (the inputs go to the model, the email and a coach's thread)
  assert.deepEqual(Object.keys(inputs.pace[0]).sort(), ["expected_today", "label", "marker", "measured_on", "now", "pace_word", "start", "swing", "target", "unit"]);
  assert.equal(inputs.pace[0].swing, "The move from 143 is inside LDL's usual swing, about 26 to 27%.");
  assert.ok(!/medic/i.test(JSON.stringify(inputs)), "nothing about a medicine leaves the page");
  assert.deepEqual(Object.keys(inputs.pace[1]).sort(), ["expected_today", "label", "marker", "measured_on", "now", "pace_word", "start", "target", "unit"], "a row with no swing carries no such key");
  // on the date, the outcome carries the medicine on file by then
  assert.equal(outcomeOf(tgt("ldl", 143, 135, { start_on: "2026-04-14" }), DONE, p).medicine, "On cholesterol medication, as last said in the app on 2 September.");
  // no sentence the guards write names a cause, suggests a number or asks for a test
  for (const text of [ldl.swing.words, ldl.medicine, landedLine({ marker: "ldl", label: "LDL", value: 131, unit: "mg/dL", on: "2026-10-12", previous: 143 }, { start_value: 143, target_value: 135 })]) assert.ok(!/because|due to|thanks to|should|aim for|recommend|retest|test again|another test/i.test(text), text);
});
