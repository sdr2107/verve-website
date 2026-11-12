/**
 * Horizon, the arithmetic: a horizon is a date (or three, six or twelve
 * months), the markers you want different by then, and the week that gets
 * you there. Everything here is a function of the person's document and
 * the horizon's rows. Pace is interpolation between where a marker started
 * and where it should be on the date, read against where it is now; it
 * says how the weeks are keeping it and never what to do. The Guide's
 * check-in (the edge function) receives these figures and writes prose
 * around them; it adds no number of its own.
 *
 * Pure, no DOM, no fetch; tests/horizon.test.mjs runs it under node.
 */
import { addDays, daysBetween, localDay, medianOf, mondayOf } from "../derive/format.ts";
import { restingBPOf, type Pt } from "../derive/markers.ts";
import { isWorkout } from "../derive/activity.ts";
import { weightSeries, sppbSeries } from "../derive/lenses.ts";
import { REMNANT_LABEL } from "../derive/lipids.ts";
import { swingOf, type SwingKey } from "../derive/swing.ts";

// ── the markers a target can be set on ──

export type MarkerKey =
  | "mets" | "vo2" | "dose" | "zone2_week" | "longest_session" | "strength_week"
  | "weight" | "waist" | "almi" | "body_fat" | "ffmi"
  | "ldl" | "apob" | "remnant" | "non_hdl" | "triglycerides" | "hdl" | "hba1c" | "fasting_glucose" | "hs_crp"
  | "bp" | "rhr" | "hrv" | "hrr" | "sleep" | "sri" | "steps" | "background" | "sitting" | "pal"
  | "grip" | "chair_stands" | "sppb" | "cadence" | "breathing" | "spo2";
export type Cadence = "weekly" | "monthly" | "when-measured";
export type MarkerKind = "measured" | "daily" | "weekly" | "blood";
export type MarkerGroup = "fitness" | "movement" | "sleep" | "vitals" | "body" | "blood";

export type MarkerDef = {
  key: MarkerKey; label: string;
  /** How it is measured, the small grey line under the name. */
  how: string;
  /** The unit the target is typed in; a blood marker takes the unit of the person's own reading. */
  unit: string; decimals: number; kind: MarkerKind; cadence: Cadence; group: MarkerGroup;
  /** A standing weekly figure to hold every week from here (the dose): read as "reached in k of the last n weeks" (never "met": the word sits beside MET-minutes). */
  standing?: boolean;
  /** Shown as hours and minutes. */
  hm?: boolean;
};

export const MARKERS: MarkerDef[] = [
  { key: "mets", label: "Fitness", how: "METs, from sessions with heart rate", unit: "METs", decimals: 1, kind: "measured", cadence: "monthly", group: "fitness" },
  { key: "vo2", label: "VO₂max", how: "mL/kg/min, the same tests", unit: "mL/kg/min", decimals: 1, kind: "measured", cadence: "monthly", group: "fitness" },
  { key: "dose", label: "Weekly dose", how: "every week from here", unit: "MET-min", decimals: 0, kind: "weekly", cadence: "weekly", group: "movement", standing: true },
  { key: "zone2_week", label: "Zone 2 a week", how: "minutes, logged sessions", unit: "min", decimals: 0, kind: "weekly", cadence: "weekly", group: "movement" },
  { key: "longest_session", label: "Longest session", how: "duration of the week's longest", unit: "min", decimals: 0, kind: "weekly", cadence: "weekly", group: "movement", hm: true },
  { key: "strength_week", label: "Strength a week", how: "sessions", unit: "sessions", decimals: 0, kind: "weekly", cadence: "weekly", group: "movement" },
  { key: "steps", label: "Steps a day", how: "seven-day average", unit: "steps", decimals: 0, kind: "daily", cadence: "weekly", group: "movement" },
  { key: "background", label: "Background movement", how: "minutes a day outside sessions, seven-day average", unit: "min", decimals: 0, kind: "daily", cadence: "weekly", group: "movement" },
  { key: "sitting", label: "Sitting", how: "a day, seven-day average", unit: "min", decimals: 0, kind: "daily", cadence: "weekly", group: "movement", hm: true },
  { key: "pal", label: "Activity level", how: "PAL, seven-day average", unit: "PAL", decimals: 2, kind: "daily", cadence: "weekly", group: "movement" },
  { key: "cadence", label: "Cadence", how: "steps a minute, the day's best half hour", unit: "spm", decimals: 0, kind: "daily", cadence: "weekly", group: "movement" },
  { key: "sleep", label: "Sleep", how: "a night, seven-night average", unit: "min", decimals: 0, kind: "daily", cadence: "weekly", group: "sleep", hm: true },
  { key: "sri", label: "Sleep regularity", how: "30-day index", unit: "", decimals: 0, kind: "daily", cadence: "weekly", group: "sleep" },
  { key: "rhr", label: "Resting heart rate", how: "seven-morning average", unit: "bpm", decimals: 0, kind: "daily", cadence: "weekly", group: "vitals" },
  { key: "hrv", label: "Night HRV", how: "one writer, seven-night average", unit: "ms", decimals: 0, kind: "daily", cadence: "weekly", group: "vitals" },
  { key: "hrr", label: "1-minute recovery", how: "after sessions, the last seven", unit: "bpm", decimals: 0, kind: "daily", cadence: "weekly", group: "vitals" },
  { key: "bp", label: "Blood pressure, systolic", how: "the cuff's 30-day mean", unit: "mmHg", decimals: 0, kind: "measured", cadence: "monthly", group: "vitals" },
  { key: "breathing", label: "Breathing rate", how: "a night, seven-night average", unit: "/min", decimals: 1, kind: "daily", cadence: "weekly", group: "vitals" },
  { key: "spo2", label: "Blood oxygen", how: "a night, seven-night average", unit: "%", decimals: 1, kind: "daily", cadence: "weekly", group: "vitals" },
  { key: "weight", label: "Weight", how: "the scale, the latest weighing", unit: "kg", decimals: 1, kind: "measured", cadence: "weekly", group: "body" },
  { key: "waist", label: "Waist", how: "the tape", unit: "cm", decimals: 0, kind: "measured", cadence: "monthly", group: "body" },
  { key: "almi", label: "Muscle, ALMI", how: "lean mass of arms and legs over height squared", unit: "kg/m²", decimals: 1, kind: "measured", cadence: "monthly", group: "body" },
  { key: "body_fat", label: "Body fat", how: "the scale or a report, one method", unit: "%", decimals: 1, kind: "measured", cadence: "monthly", group: "body" },
  { key: "ffmi", label: "Fat-free mass index", how: "whole-body lean mass over height squared", unit: "kg/m²", decimals: 1, kind: "measured", cadence: "monthly", group: "body" },
  { key: "grip", label: "Grip strength", how: "the app's test", unit: "kg", decimals: 1, kind: "measured", cadence: "monthly", group: "body" },
  { key: "chair_stands", label: "Chair stand, five rises", how: "seconds, the app's test", unit: "s", decimals: 1, kind: "measured", cadence: "monthly", group: "body" },
  { key: "sppb", label: "SPPB", how: "of 12, the three tests on one day", unit: "of 12", decimals: 0, kind: "measured", cadence: "monthly", group: "body" },
  { key: "ldl", label: "LDL", how: "known when you measure", unit: "mg/dL", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "apob", label: "ApoB", how: "known when you measure", unit: "mg/dL", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "remnant", label: "Remnant cholesterol", how: "total − LDL − HDL, known when you measure", unit: "mg/dL", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "non_hdl", label: "Non-HDL", how: "total − HDL, known when you measure", unit: "mg/dL", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "triglycerides", label: "Triglycerides", how: "known when you measure", unit: "mg/dL", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "hdl", label: "HDL", how: "known when you measure", unit: "mg/dL", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "hba1c", label: "HbA1c", how: "known when you measure", unit: "%", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "fasting_glucose", label: "Fasting glucose", how: "known when you measure", unit: "mg/dL", decimals: 1, kind: "blood", cadence: "when-measured", group: "blood" },
  { key: "hs_crp", label: "hs-CRP", how: "known when you measure", unit: "mg/L", decimals: 2, kind: "blood", cadence: "when-measured", group: "blood" },
];
export const MARKER_BY_KEY: Record<string, MarkerDef> = Object.fromEntries(MARKERS.map((m) => [m.key, m]));
export const GROUP_LABEL: Record<MarkerGroup, string> = { fitness: "Fitness", movement: "Movement", sleep: "Sleep", vitals: "Vitals", body: "Body", blood: "Blood" };
/** The markers the setup offers first; the rest sit behind "Add another". */
export const FIRST_MARKERS: MarkerKey[] = ["mets", "weight", "waist", "almi", "ldl", "dose", "rhr"];

/** What a lab marker is read from in the person's rows (markers.ts chart keys). */
const LAB_KEY: Partial<Record<MarkerKey, string>> = {
  ldl: "ldl_mgdl", apob: "apo_b_mgdl", triglycerides: "triglycerides_mgdl", hdl: "hdl_mgdl", hba1c: "hba1c_pct", fasting_glucose: "glucose_mgdl", hs_crp: "hs_crp_mgl",
  waist: "waist_cm", body_fat: "body_fat_pct", grip: "handgrip_kg", chair_stands: "chair_stand_seconds",
};
const DAILY_COL: Partial<Record<MarkerKey, string>> = {
  steps: "steps", background: "background_min", sitting: "sedentary_minutes", pal: "pal", cadence: "cadence_spm", sleep: "sleep_minutes", sri: "sri_30d",
  rhr: "resting_hr", hrv: "hrv_night_ms", hrr: "hrr_bpm", breathing: "breathing_rpm", spo2: "spo2_pct",
};

// ── the person, as the page derives it (derive/person.ts PersonData; only what Horizon reads) ──

export type Person = {
  doc: { weeks: any[]; app_labs?: any[] };
  acts: any[]; signals: any[]; crf: any[]; weights: any[]; profile: any;
  by: Map<string, Pt[]>;
  labsShown?: any[];
};
export type Reading = { value: number; on: string; unit: string | null; writer: string | null; display?: string };

export type Target = {
  id?: string; marker: MarkerKey; label: string; unit: string | null;
  start_value: number | null; start_on: string | null; target_value: number;
  cadence: Cadence;
  /** A blood target may carry the date of the report you plan to have: "next in April". */
  next_on?: string | null;
};
export type HorizonLike = { starts_on: string; ends_on: string; title?: string };

export const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** The app's week rows, the ones it wrote itself (source "sync" and a synced_at; the browser's own rows carry neither). */
export function appWeekRows(doc: { weeks: any[] }): Map<string, any> {
  const out = new Map<string, any>();
  for (const w of doc.weeks ?? []) if (w && w.source === "sync" && w.synced_at) out.set(String(w.week_start).slice(0, 10), w);
  return out;
}
const sessionEnd = (a: any) => a.ended_at ? new Date(a.ended_at).getTime() : new Date(a.timestamp).getTime() + (Number(a.duration_minutes) || 0) * 60_000;
/** One row per session: two writers of the same start and end are one session; the scored row (zone minutes present) is kept. */
export function dedupeSessions(acts: any[]): any[] {
  const by = new Map<string, any>();
  for (const a of acts) {
    if (!a?.timestamp || !isWorkout(a)) continue;
    const k = `${Math.round(new Date(a.timestamp).getTime() / 60_000)}|${Math.round(sessionEnd(a) / 60_000)}`;
    const cur = by.get(k);
    if (!cur || (cur.zone2_minutes == null && a.zone2_minutes != null)) by.set(k, a);
  }
  return [...by.values()].sort((x, y) => String(x.timestamp).localeCompare(String(y.timestamp)));
}
const inWeek = (a: any, weekStart: string) => { const d = localDay(a.timestamp); return d >= weekStart && d < addDays(weekStart, 7); };
const isDose = (a: any) => (a.activity_type === "aerobic" || a.activity_type === "mixed") && (a.intensity_category === "moderate" || a.intensity_category === "vigorous");

export type WeekFigures = { week_start: string; dose: number | null; goal: number | null; zone2: number | null; zone3: number | null; zoned: number | null; strength: number; sessions: number; longest: number; from: "app" | "sessions" };
/** One week's figures: the app's row when it wrote one, else counted from the sessions with the interim rule. */
export function weekFigures(person: Person, weekStart: string): WeekFigures {
  const sessions = dedupeSessions(person.acts).filter((a) => inWeek(a, weekStart));
  const longest = sessions.reduce((m, a) => Math.max(m, Number(a.duration_minutes) || 0), 0);
  const strength = sessions.filter((a) => a.activity_type === "strength").length;
  const row = appWeekRows(person.doc).get(weekStart);
  if (row) {
    const z2 = row.zone2_min != null ? Number(row.zone2_min) : null, z3 = row.zone3_min != null ? Number(row.zone3_min) : null;
    return { week_start: weekStart, dose: row.dose_met_min != null ? Number(row.dose_met_min) : null, goal: row.dose_goal_met_min != null ? Number(row.dose_goal_met_min) : null,
      // "most minutes in zone 2" is read against the training zones, 2 and 3; zone 1 is the easy remainder
      zone2: z2, zone3: z3, zoned: z2 != null && z3 != null ? z2 + z3 : null,
      strength: row.strength_sessions != null ? Number(row.strength_sessions) : strength, sessions: row.workouts != null ? Number(row.workouts) : sessions.length, longest, from: "app" };
  }
  const dose = sessions.length ? sessions.filter(isDose).reduce((t, a) => t + (Number(a.met_minutes) || 0), 0) : null;
  const zone2 = sessions.length ? sessions.reduce((t, a) => t + (Number(a.zone2_minutes) || 0), 0) : null;
  // without the app's zone split, the training minutes are the moderate and vigorous aerobic sessions' minutes
  const zoned = sessions.length ? sessions.filter(isDose).reduce((t, a) => t + (Number(a.duration_minutes) || 0), 0) : null;
  return { week_start: weekStart, dose, goal: null, zone2, zone3: null, zoned, strength, sessions: sessions.length, longest, from: "sessions" };
}
export const lastCompleteMonday = (today: string) => addDays(mondayOf(new Date(today + "T00:00:00")), -7);
const weeklyValue = (f: WeekFigures, key: MarkerKey): number | null =>
  key === "dose" ? f.dose : key === "zone2_week" ? f.zone2 : key === "strength_week" ? f.strength : key === "longest_session" ? f.longest : null;

/** The last n complete weeks' values of a weekly marker, oldest first; a week with no sessions and no row is null. */
export function weeklyHistory(person: Person, key: MarkerKey, today: string, n = 13): { week_start: string; v: number | null }[] {
  const out: { week_start: string; v: number | null }[] = [];
  let m = lastCompleteMonday(today);
  for (let i = 0; i < n; i++) { out.unshift({ week_start: m, v: weeklyValue(weekFigures(person, m), key) }); m = addDays(m, -7); }
  return out;
}

const lastPt = <T,>(pts: T[] | undefined): T | null => (pts && pts.length ? pts[pts.length - 1] : null);
const heightM = (profile: any) => { const h = Number(profile?.height_cm) || 0; return h > 0 ? h / 100 : null; };
/** The last seven readings of a daily column, their mean and the newest day. */
function dailyMean(signals: any[], col: string, n = 7, writerCol?: string): Reading | null {
  let rows = signals.filter((r) => r?.[col] != null);
  if (writerCol && rows.length) { const w = rows[rows.length - 1][writerCol] ?? null; rows = rows.filter((r) => (r[writerCol] ?? null) === w); }
  const last = rows.slice(-n);
  if (!last.length) return null;
  const v = mean(last.map((r) => Number(r[col])))!;
  return { value: v, on: String(last[last.length - 1].day).slice(0, 10), unit: null, writer: writerCol ? String(last[last.length - 1][writerCol] ?? "") || null : null };
}

/** Where a marker stands now: the value, the day it is from, its unit, who wrote it. Null when the person has no reading. */
export function latestOf(key: MarkerKey, person: Person, today: string): Reading | null {
  const def = MARKER_BY_KEY[key];
  if (!def) return null;
  const withUnit = (r: Reading | null) => r ? { ...r, unit: r.unit ?? def.unit } : null;
  switch (key) {
    case "mets": case "vo2": {
      const tests = [...person.crf].filter((c) => c.vo2max != null || c.met_capacity != null).sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on)));
      const t = tests[tests.length - 1];
      if (!t) return null;
      const mets = t.met_capacity != null ? Number(t.met_capacity) : Number(t.vo2max) / 3.5;
      const v = key === "mets" ? mets : t.vo2max != null ? Number(t.vo2max) : mets * 3.5;
      return { value: v, on: String(t.measured_on).slice(0, 10), unit: def.unit, writer: t.method ? String(t.method) : null };
    }
    case "dose": case "zone2_week": case "strength_week": case "longest_session": {
      const m = lastCompleteMonday(today);
      const f = weekFigures(person, m);
      const v = weeklyValue(f, key);
      return v == null ? null : { value: v, on: addDays(m, 6), unit: def.unit, writer: f.from === "app" ? "the app's week row" : "the synced sessions" };
    }
    case "weight": { const p = lastPt(weightSeries(person.weights)); return p ? { value: p.v, on: p.d, unit: "kg", writer: null } : null; }
    case "almi": case "ffmi": {
      const h = heightM(person.profile); const p = lastPt(person.by.get(key === "almi" ? "alm_kg" : "ffm_kg"));
      return h && p ? { value: p.v / (h * h), on: p.d, unit: "kg/m²", writer: null } : null;
    }
    case "sppb": { const p = lastPt(sppbSeries(person.doc.app_labs ?? [])); return p ? { value: p.v, on: p.d, unit: "of 12", writer: null } : null; }
    case "bp": {
      const bp = restingBPOf(person.by.get("sbp") ?? [], person.by.get("dbp") ?? []);
      return bp ? { value: bp.sbp, on: bp.d, unit: "mmHg", writer: bp.basis === "average" ? `${bp.days}-day mean of ${bp.n} readings` : bp.basis, display: `${bp.sbp}/${bp.dbp}` } : null;
    }
    case "remnant": {
      const rows = (person.labsShown ?? []).filter((r) => r.analyte === REMNANT_LABEL && Number.isFinite(Number(r.value))).sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on)));
      const r = rows[rows.length - 1];
      return r ? { value: Number(r.value), on: String(r.measured_on).slice(0, 10), unit: r.unit ?? def.unit, writer: "computed" } : null;
    }
    case "non_hdl": {
      const tc = person.by.get("total_cholesterol_mgdl") ?? [], hdl = person.by.get("hdl_mgdl") ?? [];
      for (let i = tc.length - 1; i >= 0; i--) { const h = hdl.find((x) => x.d === tc[i].d); if (h) return { value: tc[i].v - h.v, on: tc[i].d, unit: tc[i].unit ?? def.unit, writer: "computed" }; }
      return null;
    }
    default: {
      const lab = LAB_KEY[key];
      if (lab) { const p = lastPt(person.by.get(lab)); return p ? { value: p.v, on: p.d, unit: p.unit ?? def.unit, writer: null } : null; }
      const col = DAILY_COL[key];
      if (col) return withUnit(key === "sri" ? (() => { const r = [...person.signals].reverse().find((x) => x?.[col] != null); return r ? { value: Number(r[col]), on: String(r.day).slice(0, 10), unit: "", writer: null } : null; })()
        : dailyMean(person.signals, col, 7, key === "hrv" ? "hrv_source" : undefined));
      return null;
    }
  }
}

/** Every reading of a marker, oldest first, for the six-month comparison and the weekly history. */
export function historyOf(key: MarkerKey, person: Person, today: string): { d: string; v: number }[] {
  const def = MARKER_BY_KEY[key];
  if (!def) return [];
  if (def.kind === "weekly") return weeklyHistory(person, key, today, 26).filter((w) => w.v != null).map((w) => ({ d: addDays(w.week_start, 6), v: w.v! }));
  switch (key) {
    case "mets": case "vo2": return [...person.crf].filter((c) => c.vo2max != null || c.met_capacity != null).sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on)))
      .map((t) => { const mets = t.met_capacity != null ? Number(t.met_capacity) : Number(t.vo2max) / 3.5; return { d: String(t.measured_on).slice(0, 10), v: key === "mets" ? mets : t.vo2max != null ? Number(t.vo2max) : mets * 3.5 }; });
    case "weight": return weightSeries(person.weights);
    case "almi": case "ffmi": { const h = heightM(person.profile); return h ? (person.by.get(key === "almi" ? "alm_kg" : "ffm_kg") ?? []).map((p) => ({ d: p.d, v: p.v / (h * h) })) : []; }
    case "sppb": return sppbSeries(person.doc.app_labs ?? []);
    case "bp": return (person.by.get("sbp") ?? []).map((p) => ({ d: p.d, v: p.v }));
    case "remnant": return (person.labsShown ?? []).filter((r) => r.analyte === REMNANT_LABEL && Number.isFinite(Number(r.value))).map((r) => ({ d: String(r.measured_on).slice(0, 10), v: Number(r.value) })).sort((a, b) => a.d.localeCompare(b.d));
    case "non_hdl": { const tc = person.by.get("total_cholesterol_mgdl") ?? [], hdl = person.by.get("hdl_mgdl") ?? []; return tc.flatMap((t) => { const h = hdl.find((x) => x.d === t.d); return h ? [{ d: t.d, v: t.v - h.v }] : []; }); }
    default: {
      const lab = LAB_KEY[key];
      if (lab) return (person.by.get(lab) ?? []).map((p) => ({ d: p.d, v: p.v }));
      const col = DAILY_COL[key];
      if (!col) return [];
      let rows = person.signals.filter((r) => r?.[col] != null);
      if (key === "hrv" && rows.length) { const w = rows[rows.length - 1].hrv_source ?? null; rows = rows.filter((r) => (r.hrv_source ?? null) === w); }
      return rows.map((r) => ({ d: String(r.day).slice(0, 10), v: Number(r[col]) }));
    }
  }
}

// ── words for figures ──

export const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`;
/** A marker's value as the page writes it: hours and minutes where the unit is time, else to the marker's decimals. */
export function fmtValue(def: MarkerDef, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (def.hm) return hm(v);
  if (def.unit === "steps" || (def.unit === "MET-min" && v >= 1000)) return Math.round(v).toLocaleString("en-GB");
  return round(v, def.decimals).toFixed(def.decimals);
}
const SMALL = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const numberWord = (n: number) => (Number.isInteger(n) && n >= 1 && n <= 12 ? SMALL[n] : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** An amount in a marker's own words: "a centimetre", "five minutes", "0.3 METs", "two sessions". */
export function amountWords(def: MarkerDef, amount: number): string {
  const a = round(Math.abs(amount), def.decimals);
  const whole = Number.isInteger(a);
  const one = whole && a === 1;
  const w = (sing: string, plur: string, article = "a") => (one ? `${article} ${sing}` : `${whole ? numberWord(a) : a.toFixed(def.decimals)} ${plur}`);
  if (def.hm && a >= 60) return `${Math.floor(a / 60)} h ${String(Math.round(a % 60)).padStart(2, "0")}`;
  switch (def.unit) {
    case "cm": return whole ? w("centimetre", "centimetres") : `${a.toFixed(def.decimals)} cm`;
    case "kg": return a === 0.5 ? "half a kilo" : whole ? w("kilo", "kilos") : `${a.toFixed(def.decimals)} kg`;
    case "min": return w("minute", "minutes");
    case "sessions": return w("session", "sessions");
    case "steps": return `${Math.round(a).toLocaleString("en-GB")} steps`;
    case "of 12": return w("point", "points");
    case "%": return w("point", "points");
    case "": return w("point", "points");
    case "PAL": return `${a.toFixed(def.decimals)} PAL`;
    default: return `${whole ? (a >= 1000 ? a.toLocaleString("en-GB") : String(a)) : a.toFixed(def.decimals)} ${def.unit}`;
  }
}

// ── the guards on a blood target (12 November 2026) ──
//
// Blood results stay as targets on three conditions. The person sets every number: none is suggested and no
// guideline's figure is filled in (the page's rule since Horizon was built). A report at the number is called reached
// only when the move from the target's start is more than that marker's usual swing: inside the swing two results
// cannot be told apart, so the row reads "At your number" and says why. And a medicine the person has told the app
// they take for the marker is shown beside the target, so nobody reads a medicine's effect as the effect of the plan.
// Nothing here suggests a number, names a cause, or asks for another test.

const SWING_KEY: Partial<Record<MarkerKey, SwingKey>> = { ldl: "ldlC", apob: "apoB", hba1c: "hba1c", fasting_glucose: "fastingGlucose", hs_crp: "hsCRP" };
/** A marker's name inside a sentence, where its label would carry a capital it does not need. */
const SAID: Partial<Record<MarkerKey, string>> = { remnant: "remnant cholesterol", non_hdl: "non-HDL", triglycerides: "triglycerides", fasting_glucose: "fasting glucose" };
const saidName = (def: MarkerDef) => SAID[def.key] ?? def.label;

export type SwingRead = {
  /** "none": no usual swing is on file for the marker, so its number is read as it stands. */
  state: "inside" | "edge" | "more" | "none";
  /** The swing in words, when one is on file: "about 26 to 27%". */
  range: string | null;
  /** One sentence for the row. */
  words: string;
};
/** A blood figure's move from a starting figure, read against the marker's usual swing (derive/swing.ts, the rule In depth reads). Null for a marker that is not blood, and when either figure is missing. */
export function swingRead(marker: MarkerKey, start: number | null | undefined, value: number | null | undefined): SwingRead | null {
  const def = MARKER_BY_KEY[marker];
  if (!def || def.kind !== "blood" || start == null || value == null || !(start > 0) || !Number.isFinite(value)) return null;
  const from = plainValue(def, start), name = saidName(def), key = SWING_KEY[marker] ?? null;
  const s = swingOf(key, start, value);
  if (!s) return { state: "none", range: null, words: `No usual swing is on file for ${name}, so the number is read as it stands.` };
  if (round(value - start, def.decimals) === 0) return { state: "inside", range: key === "hsCRP" ? s.range : `about ${s.range}`, words: `It has not moved from ${from}.` };
  if (key === "hsCRP") return s.state === "more"
    ? { state: "more", range: s.range, words: `The move from ${from} is more than ${name}'s usual swing: ${s.range}.` }
    : { state: "inside", range: s.range, words: `The move from ${from} is inside ${name}'s usual swing. It takes ${s.range}, to be more than that.` };
  const range = `about ${s.range}`;
  return s.state === "inside" ? { state: "inside", range, words: `The move from ${from} is inside ${name}'s usual swing, ${range}.` }
    : s.state === "edge" ? { state: "edge", range, words: `The move from ${from} is at the edge of ${name}'s usual swing, ${range}.` }
    : { state: "more", range, words: `The move from ${from} is more than ${name}'s usual swing of ${range}.` };
}
/** A move that cannot be told from no change: inside the usual swing, or at its edge. */
const withinSwing = (s: SwingRead | null | undefined) => !!s && (s.state === "inside" || s.state === "edge");

type MedCol = "on_cholesterol_med" | "on_diabetes_med" | "on_bp_med";
const CHOLESTEROL = { col: "on_cholesterol_med" as MedCol, words: "On cholesterol medication" };
const DIABETES = { col: "on_diabetes_med" as MedCol, words: "On diabetes medication" };
const PRESSURE = { col: "on_bp_med" as MedCol, words: "On blood pressure medication" };
/** The app's three switches, and the targets each bears on: every lipid marker, the two sugar markers, the cuff. */
const MEDICINE_OF: Partial<Record<MarkerKey, { col: MedCol; words: string }>> = {
  ldl: CHOLESTEROL, apob: CHOLESTEROL, remnant: CHOLESTEROL, non_hdl: CHOLESTEROL, triglycerides: CHOLESTEROL, hdl: CHOLESTEROL,
  hba1c: DIABETES, fasting_glucose: DIABETES, bp: PRESSURE,
};
export type Medicine = { words: string; said_on: string; /** "On cholesterol medication, as last said in the app on 5 November." */ line: string };
/**
 * The medicine on file for a marker on a day: the newest answer the person gave the app, on a row of its Metabolic
 * section dated on or before that day (the app's own rule, lib/markers medStatedBy: a medication is a standing fact
 * and not a property of one blood draw; a row with no answer on it says nothing). Null when the newest answer is "no",
 * when nothing was ever said, and for a marker with no switch. Verve never asks which medicine, and never reads one
 * as the cause of a change: the line is a fact beside the target, for whoever reads the row.
 */
export function medicineOf(marker: MarkerKey, person: Person, day: string): Medicine | null {
  const m = MEDICINE_OF[marker];
  if (!m) return null;
  let best: { t: number; on: string; v: boolean } | null = null;
  for (const r of person.doc.app_labs ?? []) {
    if (r?.source !== "metabolic" || typeof r[m.col] !== "boolean" || !r.measured_at) continue;
    const t = new Date(r.measured_at).getTime(), on = localDay(r.measured_at);
    if (!Number.isFinite(t) || on > day) continue;
    if (!best || t > best.t) best = { t, on, v: r[m.col] };
  }
  if (!best?.v) return null;
  const when = best.on.slice(0, 4) === day.slice(0, 4) ? dayMonthLong(best.on) : dayMonthYear(best.on);
  return { words: m.words, said_on: best.on, line: `${m.words}, as last said in the app on ${when}.` };
}

// ── pace ──

export type Tone = "good" | "caution" | "neutral";
export type Pace = {
  marker: MarkerKey; label: string; unit: string;
  start: number | null; now: number | null; target: number;
  /** Where the marker should be today on a straight line from the start to the date. */
  expected_today: number | null;
  /** The share of the way from the start to the target that has been covered (the track's filled part, 0 to 1). */
  progress: number; /** The share of the time that has passed (the track's tick, 0 to 1). */ elapsed: number;
  pace_word: string; tone: Tone; measured_on: string | null;
  /** The figures as words, for the table. */ startText: string; nowText: string; targetText: string;
  /** Where a blood reading came from, once a report newer than the start has landed: "from the report of 3 December". Null for every other row. */
  source?: string | null;
  /** A blood row read from a report newer than its start: where the move from the start sits against the marker's usual swing. Null for every other row. */
  swing?: SwingRead | null;
  /** A medicine the person has told the app they take for this marker, as the line beside the target; null when there is none on file. */
  medicine?: string | null;
};

const monthName = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { month: "long" });
/** The track's tick: the share of the horizon's days that have passed, clamped to the horizon. */
export const elapsedShare = (h: HorizonLike, today: string) => { const total = daysBetween(h.starts_on, h.ends_on); return total > 0 ? clamp01(daysBetween(h.starts_on, today) / total) : 1; };

/**
 * Pace: what has moved against what the date needs. Within five per cent of the whole way either side is on pace;
 * further ahead is ahead; further behind is behind by the gap in the marker's words. A marker that has not moved from
 * its start after four weeks is not yet moving; one within five per cent of the target is nearly there. A standing
 * weekly figure (the dose) reads as the weeks that reached it; a blood marker is known only when a report lands, and
 * a report at its number reads "At your number", not "Reached", while the move is inside the marker's usual swing.
 */
export function paceOf(target: Target, horizon: HorizonLike, now: Reading | null, today: string, weekly?: { week_start: string; v: number | null }[]): Pace {
  const def = MARKER_BY_KEY[target.marker] ?? { key: target.marker, label: target.label, unit: target.unit ?? "", decimals: 1, kind: "measured", cadence: "monthly", group: "body", how: "" } as MarkerDef;
  const unit = target.unit ?? def.unit;
  const start = target.start_value, goal = target.target_value, cur = now?.value ?? null;
  const elapsed = elapsedShare(horizon, today);
  const base: Omit<Pace, "pace_word" | "tone" | "progress" | "expected_today"> = {
    marker: target.marker, label: target.label || def.label, unit, start, now: cur, target: goal, elapsed, measured_on: now?.on ?? null,
    startText: fmtValue(def, start), nowText: now?.display ?? fmtValue(def, cur), targetText: fmtValue(def, goal),
    // a blood marker says which report it is read from once one newer than the start is on file (board 04)
    source: def.kind === "blood" && now && target.start_on && now.on > target.start_on ? `from the report of ${dayMonthLong(now.on)}` : null,
    // the same report's move from the start, against the marker's usual swing
    swing: def.kind === "blood" && now && target.start_on && now.on > target.start_on ? swingRead(target.marker, start, cur) : null,
  };
  const dir = start != null && goal < start ? -1 : 1;
  const needed = start != null ? Math.abs(goal - start) : null;
  const expected_today = start != null ? start + (goal - start) * elapsed : null;
  const progress = start != null && cur != null && needed ? clamp01(((cur - start) * dir) / needed) : start != null && cur != null && needed === 0 ? 1 : 0;

  if (def.standing) {
    const read = (weekly ?? []).slice(-4).filter((w) => w.v != null);
    if (!read.length) return { ...base, expected_today, progress, pace_word: "No complete week yet", tone: "neutral" };
    // A standing figure is a floor whatever the start was: a dose target set below this week's figure still reads
    // "hold at least this", so the weeks AT OR ABOVE it are the ones that reached it, never the weeks under it.
    const met = read.filter((w) => w.v! >= goal).length;
    return { ...base, expected_today, progress: met / read.length, pace_word: `Reached in ${met} of the last ${read.length} week${read.length === 1 ? "" : "s"}`, tone: met === read.length ? "good" : "caution" };
  }
  if (cur == null) return { ...base, expected_today, progress, pace_word: "No reading yet", tone: "neutral" };
  if (def.kind === "blood" && now && target.start_on && now.on <= target.start_on) {
    return { ...base, expected_today, progress, pace_word: `${monthName(now.on)}'s report${target.next_on ? ` · next in ${monthName(target.next_on)}` : ""}`, tone: "neutral" };
  }
  if (start == null || needed == null) return { ...base, expected_today, progress, pace_word: "No starting value", tone: "neutral" };
  if (needed === 0) return { ...base, expected_today, progress: 1, pace_word: "Already there", tone: "good" };
  // a blood figure at its number is reached only when the move is more than its usual swing (or none is on file)
  if (progress >= 1) return withinSwing(base.swing) ? { ...base, expected_today, progress, pace_word: "At your number", tone: "neutral" } : { ...base, expected_today, progress, pace_word: "Reached", tone: "good" };
  // nearly there: within one step of the marker's own precision, or five per cent of the whole way, whichever is wider
  const step = 10 ** -def.decimals;
  if (progress > 0 && (1 - progress) * needed <= Math.max(step, 0.05 * needed) + 1e-9) return { ...base, expected_today, progress, pace_word: "Nearly there", tone: "good" };
  const gap = progress - elapsed;
  if (Math.abs(gap) <= 0.05) return { ...base, expected_today, progress, pace_word: "On pace", tone: "good" };
  if (gap > 0) return { ...base, expected_today, progress, pace_word: "Ahead of pace", tone: "good" };
  const weeksIn = daysBetween(target.start_on ?? horizon.starts_on, today) / 7;
  if (progress <= 0 && weeksIn >= 4) return { ...base, expected_today, progress, pace_word: "Not yet moving", tone: "caution" };
  const behind = round(Math.abs(gap) * needed, def.decimals);
  return { ...base, expected_today, progress, pace_word: behind > 0 ? `${cap(amountWords(def, behind))} behind` : "Slightly behind", tone: "caution" };
}

/** A target's row (horizon_targets) as the arithmetic reads it. */
export const toTarget = (t: { marker: string; label: string; unit: string | null; start_value: number | null; start_on: string | null; target_value: number; cadence: any; id?: string }): Target =>
  ({ id: t.id, marker: t.marker as MarkerKey, label: t.label, unit: t.unit, start_value: t.start_value != null ? Number(t.start_value) : null, start_on: t.start_on, target_value: Number(t.target_value), cadence: t.cadence ?? MARKER_BY_KEY[t.marker]?.cadence ?? "monthly" });

/** The Overview card a marker's target shows on: blood and the body's measures sit on Body. */
const CARD_OF_GROUP: Record<MarkerGroup, string> = { fitness: "fitness", movement: "movement", sleep: "sleep", vitals: "vitals", body: "body", blood: "body" };
/**
 * Horizon to Overview (canvas "Verve, one story in four parts", board 07): the one line a card carries when a marker
 * on it is a target, so today and the aim are read together. "On your horizon: 9.5 by 9 February · on pace". The
 * card's own headline marker needs no name; any other is named. A card with several targets shows the first and counts the rest.
 */
export function horizonLinesByCard(h: HorizonLike, targets: Target[], person: Person, today: string, self = true): Record<string, string> {
  const by: Record<string, string[]> = {};
  for (const p of pacesOf(targets, h, person, today)) {
    const def = MARKER_BY_KEY[p.marker];
    if (!def) continue;
    const named = p.marker === "mets" || p.marker === "dose" ? "" : `${def.label} `;
    // the pace's words run on inside the line; a month's name keeps its capital ("October's report")
    const pace = /^(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(p.pace_word) ? p.pace_word : p.pace_word.charAt(0).toLowerCase() + p.pace_word.slice(1);
    const line = def.standing ? `${named}at least ${p.targetText} a week · ${pace.replace(/ weeks?$/, "")}`
      : `${named}${p.targetText}${named && p.unit ? ` ${p.unit}` : ""} by ${dayMonthLong(h.ends_on)} · ${pace}`;
    (by[CARD_OF_GROUP[def.group]] ??= []).push(line);
  }
  return Object.fromEntries(Object.entries(by).map(([card, ls]) => [card, `On ${self ? "your" : "their"} horizon: ${ls[0]}${ls.length > 1 ? `, and ${ls.length - 1} more` : ""}`]));
}

// ── a report lands (board 04): a when-measured target answers ──

/** A blood reading that arrived since the last check-in, as the function notes it beside the check-in's figures. */
export type Landed = { marker: string; label: string; value: number; unit: string | null; on: string; previous: number | null };
/** A figure in a sentence: the marker's own precision, without trailing zeros ("92", "5.4", "1.4"). */
const plainValue = (def: MarkerDef | undefined, v: number) => (def ? fmtValue(def, v).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : String(round(v, 1)));
/** Whether a reading has reached a target, read in the target's own direction: down for one set below its start, up otherwise. */
export function reachedTarget(target: Pick<Target, "start_value" | "target_value">, value: number): boolean {
  const down = target.start_value != null && target.target_value < target.start_value;
  return down ? value <= target.target_value : value >= target.target_value;
}
/**
 * The line a landed report writes on the horizon: what the report said and what it said before. "Reached" is said only
 * of the measured value, and only when its move from the start is more than the marker's usual swing (or the marker has
 * none on file); inside the swing the line says the report is at the number and why the horizon does not call it
 * reached. A reached blood target stays as a floor to hold, and nothing here asks for another test.
 */
export function landedLine(l: Landed, target?: Pick<Target, "start_value" | "target_value"> | null): string {
  const def = MARKER_BY_KEY[l.marker];
  const lead = `A report landed: ${l.label} ${plainValue(def, l.value)}${l.previous != null ? `, from ${plainValue(def, l.previous)}` : ""}.`;
  if (!target) return lead;
  const t = target.start_value == null && l.previous != null ? { ...target, start_value: l.previous } : target;
  if (!reachedTarget(t, l.value)) return lead;
  const goal = plainValue(def, target.target_value);
  const swing = swingRead(l.marker as MarkerKey, t.start_value, l.value);
  if (withinSwing(swing)) return `${lead} It is at your number of ${goal}. ${swing!.words} So the horizon does not call it reached.`;
  return `${lead} The target of ${goal} is reached${swing ? `. ${swing.words} The` : "; the"} horizon keeps it as a floor to hold.`;
}

/** Every target's pace, with the readings looked up in the person's document. */
export function pacesOf(targets: Target[], horizon: HorizonLike, person: Person, today: string): Pace[] {
  return targets.map((t) => ({
    ...paceOf(t, horizon, latestOf(t.marker, person, today), today, MARKER_BY_KEY[t.marker]?.standing ? weeklyHistory(person, t.marker, today, 13) : undefined),
    medicine: medicineOf(t.marker, person, today)?.line ?? null,
  }));
}

// ── the setup's note under a ticked marker: the pace the number implies, against the person's own six months ──

/** The reading on or nearest before a day, from a history; null when none is that old. */
export function valueNear(history: { d: string; v: number }[], day: string, tolerance = 45): { d: string; v: number } | null {
  const before = history.filter((p) => p.d <= day);
  const p = before[before.length - 1] ?? history.find((x) => x.d > day && daysBetween(day, x.d) <= tolerance) ?? null;
  return p && Math.abs(daysBetween(p.d, day)) <= tolerance ? p : null;
}

export function impliedPace(def: MarkerDef, now: Reading | null, target: number, weeks: number, history: { d: string; v: number }[], today: string, weekly?: { week_start: string; v: number | null }[]): string {
  if (def.standing) {
    const read = (weekly ?? []).filter((w) => w.v != null);
    const met = read.filter((w) => w.v! >= target).length;
    return read.length ? `Every week from here. You have reached it in ${met} of the last ${read.length}.` : "Every week from here. No complete week on file yet.";
  }
  if (def.kind === "blood") {
    const lead = "A blood target is known only when you measure. Choose the week you will, and the report lands here.";
    // the number as the next report would read it: one inside the usual swing of today's figure could not be called reached
    const s = now ? swingRead(def.key, now.value, target) : null;
    if (!withinSwing(s) || round(target - now!.value, def.decimals) === 0) return lead;
    const where = s!.state === "edge" ? "at the edge of" : "inside";
    return def.key === "hs_crp" ? `${lead} Your number is ${where} ${saidName(def)}'s usual swing from ${plainValue(def, now!.value)}: it takes ${s!.range}, to be more than that. A report at your number will not be called reached.`
      : `${lead} Your number is ${where} ${saidName(def)}'s usual swing from ${plainValue(def, now!.value)}, which is ${s!.range}. A report at your number will not be called reached.`;
  }
  if (!now) return "No reading yet; the first one becomes the start.";
  const needed = target - now.value;
  if (Math.abs(round(needed, def.decimals)) === 0) return "Already there; the horizon keeps it in view.";
  const perWeek = needed / Math.max(1, weeks);
  const sixAgo = valueNear(history, addDays(today, -182));
  const moved = sixAgo ? now.value - sixAgo.v : null;
  const lead = `${cap(amountWords(def, needed))} in ${weeks} week${weeks === 1 ? "" : "s"}`;
  const rate = def.decimals === 0 && Math.abs(perWeek) < 1 ? "" : def.hm ? "" : ` is ${Math.abs(perWeek) < 0.1 && def.decimals <= 1 ? `under 0.1 ${def.unit}` : amountWords(def, round(perWeek, Math.max(def.decimals, 1)))} a week`;
  if (moved == null) return `${lead}${rate}. No reading from six months ago to compare with.`;
  const sameWay = Math.sign(moved) === Math.sign(needed) && moved !== 0;
  const recentWord = round(Math.abs(moved), def.decimals) === 0 ? "Your last six months did not move."
    : !sameWay ? `Your last six months moved the other way, ${amountWords(def, moved)}.`
    : (() => { const ratio = Math.abs(needed * (26 / weeks)) / Math.abs(moved); const times = Math.round(ratio); return ratio >= 1.8 ? `${times === 2 ? "Twice" : `${cap(numberWord(times))} times`} your recent pace: your last six months moved ${amountWords(def, moved)}.` : ratio > 1.15 ? `Faster than your last six months, which moved ${amountWords(def, moved)}.` : ratio < 0.85 ? `Slower than your last six months, which moved ${amountWords(def, moved)}.` : `About your recent pace: your last six months moved ${amountWords(def, moved)}.`; })();
  return `${lead}${rate}. ${recentWord}`;
}

// ── the plan: intent for a week, and what the week did ──

export type PlanKind = "sessions_week" | "long_session" | "strength_week" | "zone2_most" | "bedtime_by" | "weigh_in" | "custom";
export type PlanRow = { kind: PlanKind; label: string; n?: number | null; note?: string | null };
export type Adherence = { kind: PlanKind; label: string; done: number | null; of: number | null; word: string; tone: Tone };

const minutesOfDay = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
/** "23:30" from minutes of the day; a plan row's n for bedtime_by is minutes after midnight (1410 = 23:30). */
export const clockOf = (n: number) => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((n % 1440) + 1440) % 1440 % 60).padStart(2, "0")}`;
/** A bedtime read against a cut: a time after midnight is a late night, so it sits past 24:00 on the line. */
const bedtimeLine = (m: number) => (m < 6 * 60 ? m + 1440 : m);

/** What this week did against each row of the plan, from the sessions and the nights, never from a tick box. */
export function adherenceOf(rows: PlanRow[], person: Person, weekStart: string, today: string): Adherence[] {
  const sessions = dedupeSessions(person.acts).filter((a) => inWeek(a, weekStart));
  const daysLeft = Math.max(0, 7 - (daysBetween(weekStart, today) + 1));
  const f = weekFigures(person, weekStart);
  const countRow = (kind: PlanKind, label: string, done: number, n: number): Adherence => {
    const remaining = Math.max(0, n - done);
    if (done >= n) return { kind, label, done, of: n, word: "Done", tone: "good" };
    return { kind, label, done, of: n, word: `${cap(numberWord(remaining))} to go`, tone: remaining <= daysLeft ? "neutral" : "caution" };
  };
  return rows.map((r): Adherence => {
    const n = r.n != null ? Number(r.n) : null;
    switch (r.kind) {
      case "sessions_week": return countRow(r.kind, r.label, sessions.length, n ?? 1);
      case "strength_week": return countRow(r.kind, r.label, f.strength, n ?? 1);
      case "long_session": {
        const longest = f.longest;
        if (n != null && longest >= n) return { kind: r.kind, label: r.label, done: longest, of: n, word: `Done · ${hm(longest)}`, tone: "good" };
        return { kind: r.kind, label: r.label, done: longest, of: n, word: longest ? `Longest so far ${hm(longest)}` : "Not yet this week", tone: daysLeft ? "neutral" : "caution" };
      }
      case "zone2_most": {
        const z2 = f.zone2, zoned = f.zoned;
        if (z2 == null || !zoned) return { kind: r.kind, label: r.label, done: null, of: null, word: "No zoned minutes yet", tone: "neutral" };
        const most = z2 >= zoned / 2;
        return { kind: r.kind, label: r.label, done: Math.round(z2), of: Math.round(zoned), word: most ? "Yes" : daysLeft ? "Not yet" : "No", tone: most ? "good" : daysLeft ? "neutral" : "caution" };
      }
      case "bedtime_by": {
        const nights = person.signals.filter((s) => s?.sleep_start && String(s.day) >= weekStart && String(s.day) < addDays(weekStart, 7));
        if (!nights.length || n == null) return { kind: r.kind, label: r.label, done: null, of: null, word: "No nights yet", tone: "neutral" };
        const by = nights.filter((s) => bedtimeLine(minutesOfDay(String(s.sleep_start))) <= bedtimeLine(n)).length;
        const ratio = by / nights.length;
        return { kind: r.kind, label: r.label, done: by, of: nights.length, word: ratio >= 0.8 ? "Yes" : ratio >= 0.5 ? "Mostly" : daysLeft ? "Not yet" : "No", tone: ratio >= 0.8 ? "good" : ratio >= 0.5 ? "neutral" : "caution" };
      }
      case "weigh_in": {
        const w = weightSeries(person.weights).find((p) => p.d === weekStart);
        if (w) return { kind: r.kind, label: r.label, done: 1, of: 1, word: `Done, ${w.v.toFixed(1)} kg`, tone: "good" };
        return { kind: r.kind, label: r.label, done: 0, of: 1, word: today > weekStart ? "Missed this Monday" : "Monday", tone: today > weekStart ? "caution" : "neutral" };
      }
      default: return { kind: "custom", label: r.label, done: null, of: null, word: r.note ?? "", tone: "neutral" };
    }
  });
}

/** The Guide's draft: what the last eight complete weeks did, written as the intent for a week. The person edits it before it starts. */
export function guideDraftPlan(person: Person, today: string): PlanRow[] {
  const weeks: WeekFigures[] = [];
  let m = lastCompleteMonday(today);
  for (let i = 0; i < 8; i++) { weeks.push(weekFigures(person, m)); m = addDays(m, -7); }
  const withSessions = weeks.filter((w) => w.sessions > 0);
  const rows: PlanRow[] = [];
  const sessions = withSessions.length ? Math.round(medianOf(withSessions.map((w) => w.sessions))!) : 0;
  if (sessions >= 1) rows.push({ kind: "sessions_week", label: `${cap(numberWord(sessions))} session${sessions === 1 ? "" : "s"} a week`, n: sessions });
  const longest = withSessions.length ? Math.round(medianOf(withSessions.map((w) => w.longest))! / 5) * 5 : 0;
  if (longest >= 45) rows.push({ kind: "long_session", label: `One session of ${hm(longest)} or more`, n: longest });
  const strength = Math.round(medianOf(weeks.map((w) => w.strength)) ?? 0);
  if (strength >= 1) rows.push({ kind: "strength_week", label: `Strength ${strength === 1 ? "once" : strength === 2 ? "twice" : `${numberWord(strength)} times`} a week`, n: strength });
  const shares = weeks.filter((w) => w.zone2 != null && w.zoned).map((w) => w.zone2! / w.zoned!);
  if (shares.length >= 3 && medianOf(shares)! >= 0.4) rows.push({ kind: "zone2_most", label: "Most minutes in zone 2" });
  const from = addDays(lastCompleteMonday(today), -49);
  const beds = person.signals.filter((s) => s?.sleep_start && String(s.day) >= from).map((s) => bedtimeLine(minutesOfDay(String(s.sleep_start))));
  if (beds.length >= 14) { const med = Math.round(medianOf(beds)! / 15) * 15 % 1440; rows.push({ kind: "bedtime_by", label: `In bed by ${clockOf(med)}`, n: med }); }
  const mondays = new Set<string>(); let mm = lastCompleteMonday(today); for (let i = 0; i < 8; i++) { mondays.add(mm); mm = addDays(mm, -7); }
  const weighed = weightSeries(person.weights).filter((p) => mondays.has(p.d)).length;
  if (weighed >= 4) rows.push({ kind: "weigh_in", label: "Weigh in on Monday mornings" });
  return rows;
}

// ── dates on the road ──

export const addMonths = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() !== day) x.setDate(0); return x.toLocaleDateString("en-CA"); };
export const longDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const dayMonth = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const dayMonthLong = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });
export const dayMonthYear = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
export const weekdayDayMonth = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export const daysToGo = (h: HorizonLike, today: string) => Math.max(0, daysBetween(today, h.ends_on));
/** Week k of n: the weeks the horizon spans, and the one today is in. */
export function weekOf(h: HorizonLike, today: string): { week: number; weeks: number } {
  const weeks = Math.max(1, Math.ceil(daysBetween(h.starts_on, h.ends_on) / 7));
  const week = Math.min(weeks, Math.max(1, Math.floor(daysBetween(h.starts_on, today) / 7) + 1));
  return { week, weeks };
}
export type Stop = { date: string; label: string; sub: string; state: "past" | "now" | "future" | "end" };
/** The road: the day it was set, each month's read, today, the date. */
export function roadOf(h: HorizonLike, today: string): Stop[] {
  const stops: Stop[] = [{ date: h.starts_on, label: dayMonth(h.starts_on), sub: "set", state: "past" }];
  for (let d = addMonths(h.starts_on.slice(0, 7) + "-01", 1); d < h.ends_on; d = addMonths(d, 1)) if (d > h.starts_on) stops.push({ date: d, label: dayMonth(d), sub: "month read", state: d <= today ? "past" : "future" });
  const { week } = weekOf(h, today);
  if (today > h.starts_on && today < h.ends_on) stops.push({ date: today, label: "Today", sub: `week ${week}`, state: "now" });
  stops.push({ date: h.ends_on, label: dayMonth(h.ends_on), sub: h.title ? h.title.split(",")[0].split(" ").slice(0, 2).join(" ") : "the date", state: "end" });
  return stops.sort((a, b) => a.date.localeCompare(b.date) || (a.state === "now" ? 1 : -1));
}
/** The Monday check-in this week is for, and the next; the month review is the first of the next month. */
export function nextCheckins(h: HorizonLike, today: string) {
  const thisMonday = mondayOf(new Date(today + "T00:00:00"));
  const nextMonday = addDays(thisMonday, 7);
  const monthReview = addMonths(today.slice(0, 7) + "-01", 1);
  return { thisMonday, nextMonday, monthReview: monthReview < h.ends_on ? monthReview : null };
}

// ── the whole road (board 06): what each target came to, and the next horizon prefilled from it ──

const day10 = (x: unknown) => String(x ?? "").slice(0, 10);
/** The person's rows on or before a day: what the document held on the date a horizon ended. */
export function upTo(person: Person, day: string): Person {
  const by = new Map<string, Pt[]>();
  for (const [k, pts] of person.by) by.set(k, pts.filter((p) => p.d <= day));
  return {
    ...person,
    doc: { ...person.doc, weeks: (person.doc.weeks ?? []).filter((w) => day10(w?.week_start) <= day), app_labs: (person.doc.app_labs ?? []).filter((r) => day10(r?.measured_at) <= day) },
    acts: person.acts.filter((a) => a?.timestamp && localDay(a.timestamp) <= day),
    signals: person.signals.filter((s) => day10(s?.day) <= day),
    crf: person.crf.filter((c) => day10(c?.measured_on) <= day),
    weights: person.weights.filter((w) => day10(w?.measured_on) <= day),
    by,
    labsShown: (person.labsShown ?? []).filter((r) => day10(r?.measured_on) <= day),
  };
}
/** The Mondays of the complete weeks inside a horizon: from the first Monday on or after its start to the last week that ends by its date. */
export function horizonMondays(h: HorizonLike): string[] {
  const out: string[] = [];
  let m = mondayOf(new Date(h.starts_on + "T00:00:00"));
  if (m < h.starts_on) m = addDays(m, 7);
  for (; addDays(m, 6) <= h.ends_on; m = addDays(m, 7)) out.push(m);
  return out;
}
/** A weekly marker over every complete week of a horizon, oldest first; a week with no sessions and no row is null. */
export function horizonWeeks(person: Person, key: MarkerKey, h: HorizonLike): { week_start: string; v: number | null }[] {
  return horizonMondays(h).map((m) => ({ week_start: m, v: weeklyValue(weekFigures(person, m), key) }));
}

export type Outcome = { marker: MarkerKey; label: string; how: string; unit: string; startText: string; endText: string; targetText: string; word: string; tone: Tone;
  /** A blood target's move against its usual swing, and a medicine on file on the date: the lines under the row. */
  swing?: string | null; medicine?: string | null };
/**
 * What a target came to on the date, by the same pace rule read at the end of the line: a standing weekly figure is
 * the weeks of the whole road that reached it; a weekly marker names the week it first reached its number (and says so if
 * it did not hold); everything else is reached, nearly there, or short by the gap in the marker's own words. A blood
 * target at its number is reached only when the move is more than the marker's usual swing.
 */
export function outcomeOf(target: Target, h: HorizonLike, person: Person): Outcome {
  const def = MARKER_BY_KEY[target.marker] ?? ({ key: target.marker, label: target.label, unit: target.unit ?? "", decimals: 1, kind: "measured", cadence: "monthly", group: "body", how: "" } as MarkerDef);
  const then = upTo(person, h.ends_on);
  const end = latestOf(target.marker, then, addDays(h.ends_on, 1));
  const p = paceOf(target, h, end, h.ends_on);
  const base = { marker: target.marker, label: p.label, how: def.how, unit: p.unit, startText: p.startText, endText: end?.display ?? fmtValue(def, end?.value), targetText: p.targetText,
    swing: p.swing?.words ?? null, medicine: medicineOf(target.marker, then, h.ends_on)?.line ?? null };
  const goal = target.target_value;
  if (def.standing) {
    const read = horizonWeeks(then, target.marker, h).filter((w) => w.v != null);
    if (!read.length) return { ...base, word: "No complete week", tone: "neutral" };
    const met = read.filter((w) => w.v! >= goal).length;
    return { ...base, word: `Reached in ${met} of ${read.length} week${read.length === 1 ? "" : "s"}`, tone: met === read.length ? "good" : "caution" };
  }
  if (def.kind === "weekly") {
    const first = horizonWeeks(then, target.marker, h).find((w) => w.v != null && reachedTarget(target, w.v));
    if (first) {
      const week = weekOf(h, addDays(first.week_start, 6)).week;
      const held = end != null && reachedTarget(target, end.value);
      return { ...base, word: held ? `Reached in week ${week}` : `Reached in week ${week}, not held`, tone: held ? "good" : "caution" };
    }
  }
  const w = p.pace_word;
  if (w === "Reached" || w === "Nearly there" || w === "Already there") return { ...base, word: w, tone: "good" };
  if (w === "At your number") return { ...base, word: p.swing?.state === "edge" ? "At the number, at the edge of its usual swing" : "At the number, inside its usual swing", tone: "neutral" };
  if (w === "No reading yet") return { ...base, word: "No reading", tone: "neutral" };
  if (w === "No starting value") return { ...base, word: w, tone: "neutral" };
  if (def.kind === "blood" && end && target.start_on && end.on <= target.start_on) return { ...base, word: "No report since the start", tone: "neutral" };
  if (w === "Not yet moving") return { ...base, word: "Did not move", tone: "caution" };
  if (w === "Slightly behind") return { ...base, word: "Just short", tone: "caution" };
  if (/ behind$/.test(w)) return { ...base, word: w.replace(/ behind$/, " short"), tone: "caution" };
  return { ...base, word: w, tone: p.tone };
}
export const outcomesOf = (targets: Target[], h: HorizonLike, person: Person): Outcome[] => targets.map((t) => outcomeOf(t, h, person));

const trimZeros = (s: string) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
/** What the last road did to a marker, beside its row on the next horizon's set-up: "+0.55 METs in 13 weeks", "49 → 152 in 13 weeks", "1,000 held in 11 of 13". */
export function lastRoadWords(target: Target, h: HorizonLike, person: Person): string {
  const def = MARKER_BY_KEY[target.marker];
  if (!def) return "";
  const then = upTo(person, h.ends_on);
  const weeks = Math.max(1, horizonMondays(h).length);
  const span = `in ${weeks} week${weeks === 1 ? "" : "s"}`;
  if (def.standing) {
    const read = horizonWeeks(then, target.marker, h).filter((w) => w.v != null);
    return read.length ? `${fmtValue(def, target.target_value)} held in ${read.filter((w) => w.v! >= target.target_value).length} of ${read.length}` : "No complete week on the last road";
  }
  const end = latestOf(target.marker, then, addDays(h.ends_on, 1));
  const start = target.start_value;
  if (start == null || end == null) return "No reading to compare";
  if (def.kind === "weekly") return `${fmtValue(def, start)} → ${fmtValue(def, end.value)} ${span}`;
  const delta = end.value - start;
  if (round(Math.abs(delta), def.decimals + 1) === 0) return `Did not move ${span}`;
  const amount = def.hm ? hm(Math.abs(delta)) : `${trimZeros(round(Math.abs(delta), def.decimals + 1).toFixed(def.decimals + 1))}${end.unit ?? def.unit ? ` ${end.unit ?? def.unit}` : ""}`;
  return `${delta > 0 ? "+" : "−"}${amount} ${span}`;
}

/** The span the next horizon opens on: the same months, or for a dated one the same number of days from today under the same name. */
export function nextSpan(h: HorizonLike & { months?: number | null }, today: string): { kind: "date" | 3 | 6 | 12; title: string; date: string } {
  if (h.months === 3 || h.months === 6 || h.months === 12) return { kind: h.months, title: "", date: "" };
  return { kind: "date", title: h.title ?? "", date: addDays(today, Math.max(7, daysBetween(h.starts_on, h.ends_on))) };
}

// ── the figures the check-in is written from ──

export type CheckinInputs = {
  pace: { marker: string; label: string; unit: string; start: number | null; now: number | null; target: number; expected_today: number | null; pace_word: string; measured_on: string | null;
    /**
     * A blood target read from a report newer than its start: where the move sits against the marker's usual swing, in
     * the page's own sentence. The medicine on file is NOT here, on purpose: these inputs go to the model, into the
     * stored check-in, into its email and to a coach's thread, and a person's medication has never left the page.
     */
    swing?: string }[];
  plan: { kind: string; label: string; n: number | null }[];
  adherence: { label: string; done: number | null; of: number | null; word: string }[];
  week: { dose: number | null; goal: number | null; sessions: number; zone2: number | null; zone3: number | null; strength: number; sleep_avg: number | null; rhr: number | null; hrv: number | null };
  horizon: { title: string; ends_on: string; week_of: number; weeks_total: number; days_to_go: number };
};
export function checkinInputs(h: HorizonLike & { title: string }, targets: Target[], plan: PlanRow[], person: Person, today: string): CheckinInputs {
  const lastWeek = lastCompleteMonday(today);
  const f = weekFigures(person, lastWeek);
  const inLast = (s: any) => String(s.day) >= lastWeek && String(s.day) < addDays(lastWeek, 7);
  const avg = (col: string) => { const xs = person.signals.filter((s) => s?.[col] != null && inLast(s)).map((s) => Number(s[col])); return xs.length ? round(mean(xs)!, 0) : null; };
  const { week, weeks } = weekOf(h, today);
  return {
    pace: pacesOf(targets, h, person, today).map((p) => ({ marker: p.marker, label: p.label, unit: p.unit, start: p.start, now: p.now != null ? round(p.now, 2) : null, target: p.target, expected_today: p.expected_today != null ? round(p.expected_today, 2) : null, pace_word: p.pace_word, measured_on: p.measured_on,
      ...(p.swing ? { swing: p.swing.words } : {}) })),
    plan: plan.map((r) => ({ kind: r.kind, label: r.label, n: r.n ?? null })),
    adherence: adherenceOf(plan, person, lastWeek, addDays(lastWeek, 6)).map((a) => ({ label: a.label, done: a.done, of: a.of, word: a.word })),
    week: { dose: f.dose, goal: f.goal, sessions: f.sessions, zone2: f.zone2, zone3: f.zone3, strength: f.strength, sleep_avg: avg("sleep_minutes"), rhr: avg("resting_hr"), hrv: avg("hrv_night_ms") },
    horizon: { title: h.title, ends_on: h.ends_on, week_of: week, weeks_total: weeks, days_to_go: daysToGo(h, today) },
  };
}
