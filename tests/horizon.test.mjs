// Horizon's arithmetic under node: pace, the words, the plan's adherence, the Guide's draft, the road. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { addDays } from "../src/my-health/derive/format.ts";
import {
  MARKERS, MARKER_BY_KEY, latestOf, historyOf, paceOf, pacesOf, impliedPace, amountWords, fmtValue,
  adherenceOf, guideDraftPlan, weekOf, daysToGo, roadOf, nextCheckins, checkinInputs, weekFigures, weeklyHistory, dedupeSessions, addMonths, clockOf,
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

test("a standing weekly figure reads as the weeks that met it", () => {
  const weekly = [{ week_start: "2026-10-05", v: 1040 }, { week_start: "2026-10-12", v: 880 }, { week_start: "2026-10-19", v: 1120 }, { week_start: "2026-10-26", v: 814 }];
  const p = paceOf(tgt("dose", 820, 1000), H, read(814), TODAY, weekly);
  assert.equal(p.pace_word, "Met in 2 of the last 4 weeks"); assert.equal(p.tone, "caution");
  assert.equal(paceOf(tgt("dose", 820, 1000), H, read(814), TODAY, []).pace_word, "No complete week yet");
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
  assert.equal(ps[1].pace_word, "Met in 2 of the last 4 weeks");
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
  assert.match(impliedPace(MARKER_BY_KEY.dose, read(880), 1000, 23, [], TODAY, [{ week_start: "a", v: 1040 }, { week_start: "b", v: 880 }]), /met it in 1 of the last 2/);
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
