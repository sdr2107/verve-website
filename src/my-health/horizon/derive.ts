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
import { FITNESS_RULES, GRIP } from "../../data/programme.ts";

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
  // The same measure in its other unit (1 MET is 3.5 mL/kg/min). Kept in the catalogue so a reading can be shown as
  // VO₂max and a target set on it before 14 November 2026 is still read; it is not offered as a target (TARGET_MARKERS).
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

/**
 * Blood markers are OUT of Horizon, pending the lawyers' review (the founder's word, 12 November 2026: "keep all
 * blood markers out of horizon for now pending a legal review"). While this is false, no blood marker is offered
 * as a target, a blood target already on file is not shown, paced, checked in on or announced, and the Guide's
 * "Make it a target" is not offered on a blood line. Nothing is deleted: a target set before the pause stays in its
 * row and returns if this is switched back on. The guards a blood target carries (the usual swing, a medicine on
 * file; below) stay in the code and under test, so reopening is this one line. The horizon function copies this
 * file, so the check-in and its email follow the same switch.
 */
export const BLOOD_TARGETS_OPEN = false;
/** Whether a target can be held on a marker today. A marker the catalogue does not know is left to its row. */
export const isTargetable = (marker: string): boolean => BLOOD_TARGETS_OPEN || MARKER_BY_KEY[marker]?.kind !== "blood";
/**
 * Fitness and VO₂max are one measure in two units: 1 MET is 3.5 mL of oxygen a kilo a minute. Horizon keeps one
 * marker for it, Fitness, typed in METs, and shows the VO₂max beside it (the founder, 14 November 2026: "they are the
 * same thing").
 */
export const ML_PER_MET = 3.5;
/** The marker a target is held on: VO₂max is read as Fitness. */
export const targetKeyOf = (marker: string): string => (marker === "vo2" ? "mets" : marker);
/** The markers a target can be set on today: the catalogue, less the blood markers while they are out, and less VO₂max, which is Fitness in another unit. */
export const TARGET_MARKERS: MarkerDef[] = MARKERS.filter((m) => isTargetable(m.key) && targetKeyOf(m.key) === m.key);
const perMet = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? v : Number(v) / ML_PER_MET);
/**
 * A horizon's targets as the page and the check-in read them: one on a marker that is out is left where it is, unread.
 * A target set on VO₂max is read as the Fitness target it is, in METs; where a Fitness target is also on file, that one
 * is read and the VO₂max row is left where it is.
 */
export function openTargets<T extends { marker: string }>(targets: T[]): T[] {
  const open = targets.filter((t) => isTargetable(t.marker));
  const hasMets = open.some((t) => t.marker === "mets");
  return open.flatMap((t) => {
    if (t.marker !== "vo2") return [t];
    if (hasMets) return [];
    const r = t as unknown as Record<string, unknown>;
    return [{ ...t, marker: "mets", label: "Fitness", unit: "METs", start_value: perMet(r.start_value), target_value: perMet(r.target_value) } as unknown as T];
  });
}
/** The markers the setup offers first; the rest sit behind "Add another". */
export const FIRST_MARKERS: MarkerKey[] = (["mets", "weight", "waist", "almi", "ldl", "dose", "rhr"] as MarkerKey[]).filter(isTargetable);

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
export type Reading = { value: number; on: string; unit: string | null; writer: string | null; display?: string;
  /** A rolling average's own days: the oldest one it holds, and how many. */ from?: string; n?: number };

export type Target = {
  id?: string; marker: MarkerKey; label: string; unit: string | null;
  start_value: number | null; start_on: string | null; target_value: number;
  cadence: Cadence;
  /** A blood target may carry the date of the report you plan to have: "next in April". */
  next_on?: string | null;
  /**
   * How the number is held (Horizon as a programme, 16 November 2026): null reaches it by the date, as every target did
   * before; "floor" holds at least it; "ceiling" holds at most it (a time in seconds); "band" stays between `low_value`
   * and it. The weekly dose is a floor by its marker, whatever this says.
   */
  mode?: TargetMode | null;
  /** A band's lower edge; the number itself is the upper one. */
  low_value?: number | null;
  /** The way a fitness number is measured for the whole horizon (programme.ts DoorKey): one method from start to end. */
  method?: string | null;
};
export type TargetMode = "floor" | "ceiling" | "band";
/** A target held every week from here, read as the weeks that reached it: the dose by its marker, any weekly marker set as a floor. */
export const isStanding = (def: MarkerDef | undefined, t: { mode?: string | null } | null | undefined): boolean => !!def && (!!def.standing || (def.kind === "weekly" && t?.mode === "floor"));
/** A number held, not reached: a floor, a ceiling or a band on a marker that is not a weekly count. */
export const isHeld = (def: MarkerDef | undefined, t: { mode?: string | null } | null | undefined): boolean => !!def && def.kind !== "weekly" && (t?.mode === "floor" || t?.mode === "ceiling" || t?.mode === "band");
/**
 * What two readings of one person differ by with nothing changed, in the marker's own unit: 5% of the start for a
 * fitness test, 5 kg for grip (../../data/programme.ts, each with its paper). Null where no figure is on file.
 */
export function noChangeOf(marker: string, start: number | null | undefined): number | null {
  if (marker === "grip") return GRIP.noChangeKg;
  if ((marker === "mets" || marker === "vo2") && start != null && Number.isFinite(start)) return Math.abs(start) * FITNESS_RULES.noChangeShare;
  return null;
}
/**
 * A horizon as the arithmetic reads it. `pauses` is the Mondays of the weeks its owner set aside (board 13, 17 November
 * 2026; horizons.pauses, written only by the horizon function): a paused week is shown, is never judged and has no
 * number, exactly as a short week. Absent or empty on a horizon that was never paused.
 */
export type HorizonLike = { starts_on: string; ends_on: string; title?: string; pauses?: string[] | null };
/** The Mondays a horizon's owner set aside, as dates; empty when there are none. */
export const pausesOf = (h: { pauses?: unknown }): string[] => (Array.isArray(h.pauses) ? h.pauses.map((d) => String(d).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : []);

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
/**
 * A stretch of days counted without a week row of the app's: the dose, the sessions and the strength sessions from the
 * sessions themselves (the interim rule), the zone minutes from the app's own days (daily_signals zone2_min and
 * zone3_min, which add up to its week row) when it sent them, else from the sessions.
 */
function countedFigures(person: Person, from: string, toExclusive: string): WeekFigures {
  const sessions = dedupeSessions(person.acts).filter((a) => { const d = localDay(a.timestamp); return d >= from && d < toExclusive; });
  const longest = sessions.reduce((m, a) => Math.max(m, Number(a.duration_minutes) || 0), 0);
  const strength = sessions.filter((a) => a.activity_type === "strength").length;
  const dose = sessions.length ? sessions.filter(isDose).reduce((t, a) => t + (Number(a.met_minutes) || 0), 0) : null;
  const days = (person.signals ?? []).filter((r) => { const d = String(r?.day ?? "").slice(0, 10); return d >= from && d < toExclusive; });
  const daySum = (col: string) => { const xs = days.filter((r) => r?.[col] != null).map((r) => Number(r[col])); return xs.length ? xs.reduce((t, x) => t + x, 0) : null; };
  const z2 = daySum("zone2_min"), z3 = daySum("zone3_min");
  if (z2 != null || z3 != null) return { week_start: from, dose, goal: null, zone2: z2 ?? 0, zone3: z3 ?? 0, zoned: (z2 ?? 0) + (z3 ?? 0), strength, sessions: sessions.length, longest, from: "sessions" };
  const zone2 = sessions.length ? sessions.reduce((t, a) => t + (Number(a.zone2_minutes) || 0), 0) : null;
  // without the app's zone split, the training minutes are the moderate and vigorous aerobic sessions' minutes
  const zoned = sessions.length ? sessions.filter(isDose).reduce((t, a) => t + (Number(a.duration_minutes) || 0), 0) : null;
  return { week_start: from, dose, goal: null, zone2, zone3: null, zoned, strength, sessions: sessions.length, longest, from: "sessions" };
}
/** One week's figures: the app's row when it wrote one, else counted from the sessions with the interim rule. */
export function weekFigures(person: Person, weekStart: string): WeekFigures {
  const counted = countedFigures(person, weekStart, addDays(weekStart, 7));
  const row = appWeekRows(person.doc).get(weekStart);
  if (!row) return counted;
  const z2 = row.zone2_min != null ? Number(row.zone2_min) : null, z3 = row.zone3_min != null ? Number(row.zone3_min) : null;
  return { week_start: weekStart, dose: row.dose_met_min != null ? Number(row.dose_met_min) : null, goal: row.dose_goal_met_min != null ? Number(row.dose_goal_met_min) : null,
    // "most minutes in zone 2" is read against the training zones, 2 and 3; zone 1 is the easy remainder
    zone2: z2, zone3: z3, zoned: z2 != null && z3 != null ? z2 + z3 : null,
    strength: row.strength_sessions != null ? Number(row.strength_sessions) : counted.strength, sessions: row.workouts != null ? Number(row.workouts) : counted.sessions, longest: counted.longest, from: "app" };
}

// ── a horizon's weeks ──

/**
 * A horizon reads from the day it was set (the founder's rule, 15 November 2026). Its first week runs from that day
 * to the Sunday, the weeks after it from Monday to Sunday, and its last from the Monday to its date. A week short at
 * either end is shown as the days it holds and is never judged against a weekly number. THE ONE LIST: the week
 * count, the week a day falls in, a weekly target's figures and the check-in's week are all read from it.
 *
 * A week the owner set aside (HorizonLike.pauses) is in the list as a week of seven days with `paused` set and `full`
 * not: it is shown as it was, is never judged, and has no number, so the weeks after it keep the numbers they had.
 * Every reader that judges a week asks `full`, so none of them needs to know about a pause.
 */
export type Span = { /** Its place in the list, from 1. */ n: number; from: string; to: string; days: number; /** Monday to Sunday, and not set aside: a week that is judged. */ full: boolean;
  /** Set aside by the horizon's owner: Monday to Sunday, shown and not judged. */ paused: boolean;
  /** The week's number: the count starts on the first Monday, so a short week at either end has none, and neither has a paused one. */ week: number | null };
export function horizonSpans(h: HorizonLike): Span[] {
  const out: Span[] = [];
  const set = new Set(pausesOf(h));
  for (let from = h.starts_on; from <= h.ends_on && out.length < 600;) {
    const sunday = addDays(mondayOf(new Date(from + "T00:00:00")), 6);
    const to = sunday < h.ends_on ? sunday : h.ends_on;
    const days = daysBetween(from, to) + 1;
    const paused = days === 7 && set.has(from);
    out.push({ n: out.length + 1, from, to, days, full: days === 7 && !paused, paused, week: null });
    from = addDays(to, 1);
  }
  let k = 0;
  for (const s of out) if (s.full) s.week = ++k;
  return out;
}
/** The horizon week a day falls in: the first for a day before the start, the last for a day after the date. Null for a horizon with no day in it. */
export function spanOf(h: HorizonLike, day: string): Span | null {
  const spans = horizonSpans(h);
  return spans.find((s) => day <= s.to) ?? spans[spans.length - 1] ?? null;
}
const shortDay = (d: string, month = true) => { const x = new Date(d + "T00:00:00"); return `${x.toLocaleDateString("en-GB", { weekday: "short" })} ${x.getDate()}${month ? ` ${x.toLocaleDateString("en-GB", { month: "short" })}` : ""}`; };
/** A stretch of days in words: "Sat 14 to Sun 15 Nov", "Mon 30 Nov to Sun 6 Dec", "Sat 14 Nov" for one day. */
export const daysWords = (from: string, to: string) => from === to ? shortDay(from) : `${shortDay(from, from.slice(0, 7) !== to.slice(0, 7))} to ${shortDay(to)}`;
/**
 * A horizon's weeks in one sentence, for the page: "This horizon reads from the day it was set: a short first week,
 * Sat 14 to Sun 15 Nov, then 13 weeks from Monday to Sunday." Empty when every week runs Monday to Sunday.
 */
export function weeksWords(h: HorizonLike): string {
  const spans = horizonSpans(h);
  const first = spans[0], last = spans[spans.length - 1];
  const full = spans.filter((s) => s.full).length;
  if (!first || (first.days === 7 && last.days === 7)) return "";
  const parts: string[] = [];
  if (first.days < 7) parts.push(`a short first week, ${daysWords(first.from, first.to)}`);
  if (full) parts.push(`${full} week${full === 1 ? "" : "s"} from Monday to Sunday`);
  if (spans.length > 1 && last.days < 7) parts.push(`a short last week, ${daysWords(last.from, last.to)}`);
  const list = parts.join(", then ");
  return `This horizon reads from the day it was set: ${list}. A short week is shown as the days it holds and is not judged against a weekly number.`;
}
/**
 * A horizon's paused weeks in one sentence, for the page: "Paused: Mon 21 to Sun 27 Dec. A paused week is shown as it
 * was, is not judged, and has no number." Two side by side are said as one stretch. Empty when none was set aside.
 */
export function pausedWeeksWords(h: HorizonLike): string {
  const weeks = horizonSpans(h).filter((s) => s.paused);
  if (!weeks.length) return "";
  const runs: { from: string; to: string }[] = [];
  for (const w of weeks) { const last = runs[runs.length - 1]; if (last && addDays(last.to, 1) === w.from) last.to = w.to; else runs.push({ from: w.from, to: w.to }); }
  return `Paused: ${listWords(runs.map((r) => daysWords(r.from, r.to)))}. A paused week is shown as it was, is not judged, and has no number.`;
}
/** The paused week a day falls in; null on any other day. */
export const pausedSpanOn = (h: HorizonLike, day: string): Span | null => horizonSpans(h).find((s) => s.paused && day >= s.from && day <= s.to) ?? null;
/**
 * The stretch of paused weeks a day falls in (one week, or two side by side): its first and last day, and the Monday
 * the horizon picks up again. Null on any other day.
 */
export function pausedRunOn(h: HorizonLike, day: string): { from: string; to: string; resumes: string } | null {
  const spans = horizonSpans(h);
  const i = spans.findIndex((s) => s.paused && day >= s.from && day <= s.to);
  if (i < 0) return null;
  let a = i, b = i;
  while (a > 0 && spans[a - 1].paused) a--;
  while (b < spans.length - 1 && spans[b + 1].paused) b++;
  return { from: spans[a].from, to: spans[b].to, resumes: addDays(spans[b].to, 1) };
}
/**
 * One horizon week's figures, up to today for the week in progress. A full week reads as any week does (the app's own
 * row when it wrote one). A short one has no row of the app's, which holds the whole calendar week, so it is counted
 * from its own days (countedFigures).
 */
export function spanFigures(person: Person, s: Span): WeekFigures {
  return s.days === 7 ? weekFigures(person, s.from) : countedFigures(person, s.from, addDays(s.to, 1));
}
export const lastCompleteMonday = (today: string) => addDays(mondayOf(new Date(today + "T00:00:00")), -7);
const weeklyValue = (f: WeekFigures, key: MarkerKey): number | null =>
  key === "dose" ? f.dose : key === "zone2_week" ? f.zone2 : key === "strength_week" ? f.strength : key === "longest_session" ? f.longest : null;

/** A typical week of the last eight complete ones. */
export type TypicalWeek = { zone2: number; harder: number; dose: number | null; aerobic: number; strength: number; longest: number; /** Weeks of the eight with anything on file. */ weeks_read: number };
/**
 * A typical week: the medians of the last eight complete weeks, a week with nothing on file counted as nothing. THE ONE
 * READER: the set-up's "a typical week", the targets table and the Guide's plan (./guidePlan.ts baseOf) all take it
 * from here, so a number set against one is never planned against another. (A target set from last week alone, a low
 * one, sat under what the person already did, and the plan had nothing to add: the recording of 14 November 2026.)
 */
export function typicalWeek(person: Person, today: string): TypicalWeek {
  const weeks: WeekFigures[] = [];
  let m = lastCompleteMonday(today);
  for (let i = 0; i < 8; i++) { weeks.push(weekFigures(person, m)); m = addDays(m, -7); }
  const med = (xs: number[]) => (xs.length ? medianOf(xs)! : 0);
  const doses = weeks.filter((w) => w.dose != null).map((w) => w.dose!);
  return {
    zone2: Math.round(med(weeks.map((w) => w.zone2 ?? 0))),
    harder: Math.round(med(weeks.map((w) => w.zone3 ?? Math.max(0, (w.zoned ?? 0) - (w.zone2 ?? 0))))),
    dose: doses.length ? Math.round(med(doses)) : null,
    aerobic: Math.round(med(weeks.map((w) => Math.max(0, w.sessions - w.strength)))),
    strength: Math.round(med(weeks.map((w) => w.strength))),
    longest: Math.round(med(weeks.map((w) => w.longest))),
    weeks_read: weeks.filter((w) => w.sessions > 0 || w.dose != null).length,
  };
}
/** A weekly marker's typical week; null for any other marker, and when none of the eight weeks has anything on file. */
export function typicalOf(key: MarkerKey, person: Person, today: string): number | null {
  if (MARKER_BY_KEY[key]?.kind !== "weekly") return null;
  const t = typicalWeek(person, today);
  if (!t.weeks_read) return null;
  return key === "dose" ? t.dose : key === "zone2_week" ? t.zone2 : key === "strength_week" ? t.strength : key === "longest_session" ? t.longest : null;
}

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
  return { value: v, on: String(last[last.length - 1].day).slice(0, 10), unit: null, writer: writerCol ? String(last[last.length - 1][writerCol] ?? "") || null : null,
    from: String(last[0].day).slice(0, 10), n: last.length };
}

// ── fitness by its door (Horizon as a programme, rule C: one method from start to end) ──

/** The four ways a fitness figure arrives, and the reference (../../data/programme.ts DOORS). */
export type FitnessDoor = "walk" | "run" | "watch" | "treadmill" | "lab";
/**
 * The door a fitness reading came by, from the method its row carries: the app's keys ("six-minute-walk",
 * "cooper-run", "non-exercise-formula" for a watch's estimate) and the website's own ("six-minute walk",
 * "twelve-minute run"). A method with no door (a one-mile walk, a heart-rate formula, a typed figure) is null: it is
 * shown by its own name, with no error figure borrowed from another test.
 */
export function doorOfMethod(method: unknown): FitnessDoor | null {
  const m = String(method ?? "").toLowerCase().replace(/[\s_]+/g, "-");
  if (m === "cpet") return "lab";
  if (m === "six-minute-walk") return "walk";
  if (m === "cooper-run" || m === "1.5-mile-run" || m === "twelve-minute-run") return "run";
  if (m === "treadmill-test" || m === "bruce-protocol") return "treadmill";
  if (m === "non-exercise-formula") return "watch";
  return null;
}
/** What two readings must share to be compared: the door, or for a method with none, the method itself. */
export const methodFamily = (method: unknown): string | null => doorOfMethod(method) ?? (String(method ?? "").trim() ? String(method).toLowerCase().replace(/[\s_]+/g, "-") : null);
export type DoorReading = Reading & { door: FitnessDoor | null; family: string | null };
/** Every fitness reading on file in METs, oldest first, each with its door. */
export function fitnessReadings(person: Person): DoorReading[] {
  return [...person.crf].filter((c) => c.vo2max != null || c.met_capacity != null).sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on)))
    .map((t) => ({ value: t.met_capacity != null ? Number(t.met_capacity) : Number(t.vo2max) / ML_PER_MET, on: String(t.measured_on).slice(0, 10), unit: "METs", writer: t.method ? String(t.method) : null,
      door: doorOfMethod(t.method), family: methodFamily(t.method) }));
}
/** The latest fitness reading by one method family; null when none of that family is on file. */
export function fitnessBy(person: Person, family: string | null | undefined): DoorReading | null {
  if (!family) return null;
  const all = fitnessReadings(person).filter((r) => r.family === family);
  return all[all.length - 1] ?? null;
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
      const mets = t.met_capacity != null ? Number(t.met_capacity) : Number(t.vo2max) / ML_PER_MET;
      const v = key === "mets" ? mets : t.vo2max != null ? Number(t.vo2max) : mets * ML_PER_MET;
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
      .map((t) => { const mets = t.met_capacity != null ? Number(t.met_capacity) : Number(t.vo2max) / ML_PER_MET; return { d: String(t.measured_on).slice(0, 10), v: key === "mets" ? mets : t.vo2max != null ? Number(t.vo2max) : mets * ML_PER_MET }; });
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
/**
 * A figure with its unit, as the page prints the two side by side: "5,610 steps", "7 h 50", "1 session", "53 bpm",
 * "118/76 mmHg", "18.4%". Null where the page prints a dash. `text` is the figure as the page already wrote it.
 */
export function withUnit(def: MarkerDef | undefined, text: string | null | undefined, value: number | null | undefined, unit?: string | null): string | null {
  if (value == null || !Number.isFinite(value) || !text || text === "—") return null;
  const u = def?.hm ? "" : unit ?? def?.unit ?? "";
  if (!u) return text;
  if (u === "%") return `${text}%`;
  // the unit follows the figure as it is printed: 1.08 sessions prints "1", and reads "1 session"
  return `${text} ${u === "sessions" && text === "1" ? "session" : u}`;
}
/** "a", "a and b", "a, b and c". */
export const listWords = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
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
    case "METs": return one ? "1 MET" : `${whole ? String(a) : a.toFixed(def.decimals)} METs`;
    default: return `${whole ? (a >= 1000 ? a.toLocaleString("en-GB") : String(a)) : a.toFixed(def.decimals)} ${def.unit}`;
  }
}

// ── the guards on a blood target (12 November 2026) ──
//
// DORMANT while BLOOD_TARGETS_OPEN is false: blood markers are out of Horizon pending the lawyers' review, so no row
// reaches these functions through the page or the check-in. They are kept, and tested, for the day it reopens.
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
  /**
   * A weekly row's week in progress, counted from the horizon's own days: the figure so far, the days it holds, and
   * whether the week is a short one (never judged). The pace word is read from the full weeks that have ended.
   */
  week?: WeekSoFar | null;
  /** A weekly row: the last full week of the horizon that has ended, the one the pace is read from; null before the first. */
  judged?: { from: string; to: string; text: string } | null;
  /** A rolling average's days, in words: "8 to 14 Nov", "5 days on file, 10 to 14 Nov". Null for every other row. */
  window?: string | null;
  /** How the number is held: "floor" for the dose and any "at least", "ceiling", "band"; null for a number to reach by the date. */
  mode?: TargetMode | null;
  /** A band's lower edge, as words. */ lowText?: string | null;
  /** The method a fitness row is kept to, and a newer reading by another method that is shown and not compared. */
  method?: string | null; other?: { method: string | null; on: string; text: string } | null;
  /**
   * Today is in a week the owner set aside. The word and the figures are as they stood when the week began (the line
   * to the date stands still through it); the page prints PAUSED_WORD in the word's place, because nothing is judged
   * in a paused week. The Monday check-in, which reads the week before, keeps the word.
   */
  paused?: boolean;
};
/** What the page prints in a pace word's place while today is in a paused week. */
export const PAUSED_WORD = "Paused this week";
export type WeekSoFar = { n: number; of: number; from: string; to: string; /** The last day counted: today, or the week's last day. */ upto: string; days: number; full: boolean; /** Set aside by the owner: shown, and not judged. */ paused?: boolean; value: number | null; text: string };

const monthName = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { month: "long" });
/**
 * The days from one day to another that count towards a horizon's line: the days of a paused week are left out, so
 * the line stands still through it and the person is not behind for a week they set aside.
 */
export function activeDays(h: HorizonLike, from: string, to: string): number {
  let days = daysBetween(from, to);
  for (const m of pausesOf(h)) {
    const a = m > from ? m : from, b = addDays(m, 7) < to ? addDays(m, 7) : to;
    if (b > a) days -= daysBetween(a, b);
  }
  return days;
}
/** The track's tick: the share of the horizon's days that have passed, clamped to the horizon. A paused week's days are in neither count. */
export const elapsedShare = (h: HorizonLike, today: string) => { const total = activeDays(h, h.starts_on, h.ends_on); return total > 0 ? clamp01(activeDays(h, h.starts_on, today) / total) : 1; };

/**
 * Pace: what has moved against what the date needs. Within five per cent of the whole way either side is on pace;
 * further ahead is ahead; further behind is behind by the gap in the marker's words. A marker that has not moved from
 * its start after four weeks is not yet moving; one within five per cent of the target is nearly there. A weekly
 * figure is read from the horizon's own full weeks (pacesOf): a standing one (the dose) reads as the weeks that reached it; a blood marker is known only when a report lands, and
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
    mode: isStanding(def, target) ? "floor" : isHeld(def, target) ? target.mode! : null,
    lowText: target.mode === "band" && target.low_value != null ? fmtValue(def, target.low_value) : null,
    method: target.method ?? null,
  };
  const dir = start != null && goal < start ? -1 : 1;
  const needed = start != null ? Math.abs(goal - start) : null;
  const expected_today = start != null ? start + (goal - start) * elapsed : null;
  const progress = start != null && cur != null && needed ? clamp01(((cur - start) * dir) / needed) : start != null && cur != null && needed === 0 ? 1 : 0;

  // a number held, not reached: there is no line to the date, only whether today's reading is on the right side of it
  if (isHeld(def, target)) {
    if (cur == null) return { ...base, expected_today: null, progress: 0, pace_word: "No reading yet", tone: "neutral" };
    const lo = target.mode === "band" ? target.low_value ?? null : target.mode === "floor" ? goal : null;
    const hi = target.mode === "floor" ? null : goal;
    const under = lo != null && cur < lo ? lo - cur : 0, over = hi != null && cur > hi ? cur - hi : 0;
    if (!under && !over) return { ...base, expected_today: null, progress: 1, pace_word: target.mode === "band" ? "Inside your band" : "Held", tone: "good" };
    // two readings of one person differ with nothing changed: a move from the start smaller than that is not a change
    const slack = noChangeOf(target.marker, start);
    if (slack != null && start != null && Math.abs(cur - start) < slack) return { ...base, expected_today: null, progress: 1, pace_word: "Held: the move is inside what two readings differ by", tone: "neutral" };
    const gap = round(under || over, def.decimals);
    const side = target.mode === "band" ? (under ? "under your band" : "over your band") : under ? "under your floor" : "over your line";
    return { ...base, expected_today: null, progress: 0, pace_word: gap > 0 ? `${cap(amountWords(def, gap))} ${side}` : `Just ${side}`, tone: "caution" };
  }
  if (isStanding(def, target)) {
    const read = (weekly ?? []).filter((w) => w.v != null);
    // none has ended yet, or the ones that have hold nothing: a dash with its reason, never a nought
    if (!read.length) return { ...base, expected_today, progress, pace_word: (weekly ?? []).length ? "No session on file yet" : "No full week yet", tone: "neutral" };
    // A standing figure is a floor whatever the start was: a dose target set below this week's figure still reads
    // "hold at least this", so the weeks AT OR ABOVE it are the ones that reached it, never the weeks under it.
    const met = read.filter((w) => w.v! >= goal).length;
    return { ...base, expected_today, progress: met / read.length, pace_word: `Reached in ${met} of ${read.length} full week${read.length === 1 ? "" : "s"}`, tone: met === read.length ? "good" : "caution" };
  }
  // a weekly figure is judged on the horizon's own full weeks: none has ended yet, so there is nothing to judge
  if (cur == null && def.kind === "weekly") return { ...base, expected_today, progress, pace_word: (weekly ?? []).length ? "No session on file yet" : "No full week yet", tone: "neutral" };
  if (cur == null) return { ...base, expected_today, progress, pace_word: "No reading yet", tone: "neutral" };
  if (def.kind === "blood" && now && target.start_on && now.on <= target.start_on) {
    return { ...base, expected_today, progress, pace_word: `${monthName(now.on)}'s report${target.next_on ? ` · next in ${monthName(target.next_on)}` : ""}`, tone: "neutral" };
  }
  if (start == null || needed == null) return { ...base, expected_today, progress, pace_word: "No starting value", tone: "neutral" };
  if (needed === 0) return { ...base, expected_today, progress: 1, pace_word: "Already there", tone: "good" };
  // a blood figure at its number is reached only when the move is more than its usual swing (or none is on file)
  if (progress >= 1) {
    // a fitness test at its number is reached only when the move from the start is more than two tests of one person differ by
    const slack = target.marker === "mets" || target.marker === "vo2" ? noChangeOf(target.marker, start) : null;
    const insideTest = slack != null && Math.abs(cur - start) < slack;
    return withinSwing(base.swing) || insideTest ? { ...base, expected_today, progress, pace_word: "At your number", tone: "neutral" } : { ...base, expected_today, progress, pace_word: "Reached", tone: "good" };
  }
  // nearly there: within one step of the marker's own precision, or five per cent of the whole way, whichever is wider
  const step = 10 ** -def.decimals;
  if (progress > 0 && (1 - progress) * needed <= Math.max(step, 0.05 * needed) + 1e-9) return { ...base, expected_today, progress, pace_word: "Nearly there", tone: "good" };
  const gap = progress - elapsed;
  if (Math.abs(gap) <= 0.05) return { ...base, expected_today, progress, pace_word: "On pace", tone: "good" };
  if (gap > 0) return { ...base, expected_today, progress, pace_word: "Ahead of pace", tone: "good" };
  const weeksIn = activeDays(horizon, target.start_on ?? horizon.starts_on, today) / 7;
  if (progress <= 0 && weeksIn >= 4) return { ...base, expected_today, progress, pace_word: "Not yet moving", tone: "caution" };
  const behind = round(Math.abs(gap) * needed, def.decimals);
  return { ...base, expected_today, progress, pace_word: behind > 0 ? `${cap(amountWords(def, behind))} behind` : "Slightly behind", tone: "caution" };
}

/** A target's row (horizon_targets) as the arithmetic reads it. */
export const toTarget = (t: { marker: string; label: string; unit: string | null; start_value: number | null; start_on: string | null; target_value: number; cadence: any; id?: string; mode?: string | null; low_value?: number | null; method?: string | null }): Target =>
  ({ id: t.id, marker: t.marker as MarkerKey, label: t.label, unit: t.unit, start_value: t.start_value != null ? Number(t.start_value) : null, start_on: t.start_on, target_value: Number(t.target_value), cadence: t.cadence ?? MARKER_BY_KEY[t.marker]?.cadence ?? "monthly",
    mode: t.mode === "floor" || t.mode === "ceiling" || t.mode === "band" ? t.mode : null, low_value: t.low_value != null && Number.isFinite(Number(t.low_value)) ? Number(t.low_value) : null, method: t.method ? String(t.method) : null });

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
    const word = p.paused ? PAUSED_WORD : p.pace_word;
    const pace = /^(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(word) ? word : word.charAt(0).toLowerCase() + word.slice(1);
    const held = p.mode && def.kind !== "weekly";
    const line = p.mode === "floor" && def.kind === "weekly" ? `${named}at least ${p.targetText} a week · ${p.paused ? pace : pace.replace(/ (full )?weeks?$/, "")}`
      : held ? `${named}${p.mode === "band" ? `${p.lowText ?? "—"} to ${p.targetText}` : `${p.mode === "floor" ? "at least" : "at most"} ${p.targetText}`}${p.unit ? ` ${p.unit}` : ""} · ${pace}`
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

/** The Fitness row's second line: the same number as VO₂max. "As VO₂max: 31.5 mL/kg/min · today 29.4. One measure in two units: 1 MET is 3.5 mL/kg/min." */
export function vo2Line(person: Person, today: string, targetMets?: number | null,
  /** A fitness number kept to one method: today's figure in METs by that method, shown in place of the newest reading of any method. */ nowMets?: number | null): string {
  const now = nowMets != null ? { value: nowMets * ML_PER_MET } : latestOf("vo2", person, today);
  const aim = targetMets != null && Number.isFinite(targetMets) && targetMets > 0 ? round(targetMets * ML_PER_MET, 1).toFixed(1) : null;
  const fig = now ? round(now.value, 1).toFixed(1) : null;
  const lead = aim ? `As VO₂max: ${aim} mL/kg/min${fig ? ` · today ${fig}` : ""}. ` : fig ? `As VO₂max, today is ${fig} mL/kg/min. ` : "";
  return `${lead}One measure in two units: 1 MET is ${ML_PER_MET} mL/kg/min.`;
}

/** A marker as it stood at the end of a day: what the document held then, read by the same rule as today's figure. */
export const readingAt = (key: MarkerKey, person: Person, day: string): Reading | null => latestOf(key, upTo(person, day), addDays(day, 1));

/** A target over one finished week: the figure at the end of the week before, the figure at the end of that week, and the pace word the table carries. */
export type WeekMove = { marker: MarkerKey; label: string; unit: string; before: string | null; after: string | null; /** No reading newer than the week before: the figure stands as it was. */ fresh: boolean; pace_word: string; tone: Tone };
/**
 * What moved against the targets in a finished week (canvas "Verve, the Guide's plan", board 09): each target's figure
 * at the end of the week before and at the end of that week, with today's pace word. Arithmetic on the person's own
 * readings; the weekly dose, a floor to hold, is left to the plan's own line for it.
 */
export function weekMoves(targets: Target[], horizon: HorizonLike, person: Person, monday: string, today: string): WeekMove[] {
  return pacesOf(targets, horizon, person, today).filter((p) => !(p.mode === "floor" && MARKER_BY_KEY[p.marker]?.kind === "weekly")).map((p) => {
    const def = MARKER_BY_KEY[p.marker];
    // a weekly figure's "before" is the full week of the horizon before this one: a week from before the horizon, or a short one, is not read
    const prior = def?.kind !== "weekly" || horizonSpans(horizon).some((s) => s.full && s.from === addDays(monday, -7));
    // a fitness number kept to one method moves only by that method's own readings
    const at = (day: string): Reading | null => (p.marker === "mets" && p.method ? fitnessBy(upTo(person, day), p.method) : readingAt(p.marker, person, day));
    const a = prior ? at(addDays(monday, -1)) : null, b = at(addDays(monday, 6));
    const text = (r: Reading | null) => (r ? r.display ?? (def ? fmtValue(def, r.value) : String(round(r.value, 1))) : null);
    return { marker: p.marker, label: p.label, unit: def?.hm ? "" : p.unit, before: text(a), after: text(b), fresh: !!b && (!a || b.on > a.on), pace_word: p.pace_word, tone: p.tone };
  });
}

/** A weekly marker over the FULL weeks of a horizon that have ended before today, oldest first. */
export function fullWeeksSoFar(person: Person, key: MarkerKey, h: HorizonLike, today: string): { week_start: string; v: number | null }[] {
  return horizonSpans(h).filter((s) => s.full && s.to < today).map((s) => ({ week_start: s.from, v: weeklyValue(weekFigures(person, s.from), key) }));
}
/** A weekly marker's week in progress on a horizon: the figure so far, from the horizon's own days. Null outside the horizon's days. */
export function weekSoFar(person: Person, key: MarkerKey, h: HorizonLike, today: string): WeekSoFar | null {
  if (today < h.starts_on || today > h.ends_on) return null;
  const spans = horizonSpans(h);
  const s = spans.find((x) => today <= x.to);
  const def = MARKER_BY_KEY[key];
  if (!s || !def) return null;
  const f = spanFigures(person, s);
  // a week with no session on file yet is a dash with its reason, never a nought: not "0 sessions", not "0 minutes"
  const v = f.sessions === 0 ? null : weeklyValue(f, key);
  return { n: s.n, of: spans.length, from: s.from, to: s.to, upto: today, days: s.days, full: s.full, ...(s.paused ? { paused: true } : {}), value: v, text: fmtValue(def, v) };
}
/** A rolling average's days in words: "8 to 14 Nov"; with fewer than seven on file, "5 days on file, 10 to 14 Nov". */
export function windowWords(r: Reading | null, want = 7): string | null {
  if (!r?.from || !r.n) return null;
  const days = daysWords(r.from, r.on).replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /g, "");
  return r.n < want ? `${r.n} day${r.n === 1 ? "" : "s"} on file, ${days}` : days;
}
/**
 * Every target's pace, with the readings looked up in the person's document. A weekly marker is read from the
 * horizon's own weeks (horizonSpans): its figure is the last FULL week that has ended since the horizon was set, its
 * week in progress rides beside it, and a week from before the horizon is never read.
 */
export function pacesOf(targets: Target[], horizon: HorizonLike, person: Person, today: string): Pace[] {
  const pausedNow = pausedSpanOn(horizon, today) != null;
  return pacesAsRead(targets, horizon, person, today).map((p) => (pausedNow ? { ...p, paused: true } : p));
}
function pacesAsRead(targets: Target[], horizon: HorizonLike, person: Person, today: string): Pace[] {
  // a target on a marker that is out of Horizon (blood, pending review) is not paced: the page, the Overview's card
  // and the check-in's inputs all read their rows from here
  return openTargets(targets).map((t) => {
    const def = MARKER_BY_KEY[t.marker];
    const medicine = medicineOf(t.marker, person, today)?.line ?? null;
    if (def?.kind !== "weekly") {
      const latest = latestOf(t.marker, person, today);
      // one method from start to end: a fitness number kept to a door is read from that door's own readings
      if (t.marker === "mets" && t.method) {
        const same = fitnessBy(person, t.method);
        const newest = fitnessReadings(person).slice(-1)[0] ?? null;
        const other = newest && newest.family !== t.method && (!same || newest.on > same.on) ? { method: newest.writer, on: newest.on, text: fmtValue(def, newest.value) } : null;
        return { ...paceOf(t, horizon, same, today), medicine, window: null, other };
      }
      return { ...paceOf(t, horizon, latest, today), medicine, window: def?.kind === "daily" ? windowWords(latest) : null };
    }
    const done = fullWeeksSoFar(person, t.marker, horizon, today);
    const last = [...done].reverse().find((w) => w.v != null) ?? null;
    const now: Reading | null = last ? { value: last.v!, on: addDays(last.week_start, 6), unit: def.unit, writer: null } : null;
    return { ...paceOf(t, horizon, now, today, done), medicine, week: weekSoFar(person, t.marker, horizon, today),
      judged: last ? { from: last.week_start, to: addDays(last.week_start, 6), text: fmtValue(def, last.v) } : null };
  });
}

// ── the setup's note under a ticked marker: the pace the number implies, against the person's own six months ──

/** The reading on or nearest before a day, from a history; null when none is that old. */
export function valueNear(history: { d: string; v: number }[], day: string, tolerance = 45): { d: string; v: number } | null {
  const before = history.filter((p) => p.d <= day);
  const p = before[before.length - 1] ?? history.find((x) => x.d > day && daysBetween(day, x.d) <= tolerance) ?? null;
  return p && Math.abs(daysBetween(p.d, day)) <= tolerance ? p : null;
}

/** What a plan would have to add, said under a weekly number set at or under a typical week. */
const NOTHING_TO_ADD: Partial<Record<MarkerKey, string>> = { zone2_week: " A plan would have nothing to add in zone 2.", strength_week: " A plan would have nothing to add in strength." };

export function impliedPace(def: MarkerDef, now: Reading | null, target: number, weeks: number, history: { d: string; v: number }[], today: string, weekly?: { week_start: string; v: number | null }[],
  /** A weekly marker's typical week (typicalOf): its number is read against that, not against last week alone. */ typical?: number | null,
  /** How the number is held (a floor, a ceiling, a band with its lower edge); absent for a number to reach by the date. */ held?: { mode: TargetMode; low?: number | null } | null): string {
  if (held && def.kind !== "weekly") {
    if (!now) return "A number to hold. No reading yet; the first one is read against it.";
    const fig = now.display ?? fmtValue(def, now.value), by = (d: number) => amountWords(def, round(Math.abs(d), def.decimals));
    if (held.mode === "floor") return now.value >= target ? `A floor to hold, not a number to raise. Today's ${fig} is above it.` : `A floor to hold. Today's ${fig} is under it by ${by(target - now.value)}.`;
    if (held.mode === "ceiling") return now.value <= target ? `A line to stay under. Today's ${fig} is under it.` : `A line to stay under. Today's ${fig} is over it by ${by(now.value - target)}.`;
    const lo = held.low ?? null;
    if (lo == null || !(lo < target)) return "Set both ends of the band: the lower number first.";
    return now.value < lo ? `A band to stay inside. Today's ${fig} is under it by ${by(lo - now.value)}.` : now.value > target ? `A band to stay inside. Today's ${fig} is over it by ${by(now.value - target)}.` : `A band to stay inside. Today's ${fig} is inside it.`;
  }
  if (def.standing || held?.mode === "floor") {
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
  if (def.kind === "weekly" && typical != null) {
    // one week is noise: a weekly number is read against a typical week of the last eight
    const usual = round(typical, def.decimals), gap = round(target - usual, def.decimals);
    if (gap < 0) return `${fmtValue(def, target)} is under your typical week of ${fmtValue(def, usual)}.${NOTHING_TO_ADD[def.key] ?? ""}`;
    if (gap === 0) return `${fmtValue(def, target)} is your typical week.${NOTHING_TO_ADD[def.key] ?? ""}`;
    const each = gap / Math.max(1, weeks);
    const rate = def.hm || each < 1 ? "" : `: about ${amountWords(def, Math.round(each))} a week`;
    return `${cap(amountWords(def, gap))} more than your typical week of ${fmtValue(def, usual)}, in ${weeks} week${weeks === 1 ? "" : "s"}${rate}.`;
  }
  if (!now) return "No reading yet; the first one becomes the start.";
  // the gap between the two figures as the row shows them: the reading is rounded first, as it is on the page
  const needed = target - round(now.value, def.decimals);
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

/**
 * The last three came with the Guide's plan (13 November 2026; ./guidePlan.ts): a week's minutes in zone 2, its harder
 * minutes, and its steps a day. Harder minutes and steps are counted and never judged: the plan's harder figure is not
 * one to chase.
 */
export type PlanKind = "sessions_week" | "long_session" | "strength_week" | "zone2_most" | "bedtime_by" | "weigh_in" | "custom" | "zone2_min" | "harder_min" | "steps_day";
export type PlanRow = { kind: PlanKind; label: string; n?: number | null; note?: string | null };
export type Adherence = { kind: PlanKind; label: string; done: number | null; of: number | null; word: string; tone: Tone };

const minutesOfDay = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
/** "23:30" from minutes of the day; a plan row's n for bedtime_by is minutes after midnight (1410 = 23:30). */
export const clockOf = (n: number) => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((n % 1440) + 1440) % 1440 % 60).padStart(2, "0")}`;
/** A bedtime read against a cut: a time after midnight is a late night, so it sits past 24:00 on the line. */
const bedtimeLine = (m: number) => (m < 6 * 60 ? m + 1440 : m);

/**
 * What this week did against each row of the plan, from the sessions and the nights, never from a tick box. `from` is
 * the day a horizon was set: in the week it was set in, only the sessions from that day on are counted.
 */
export function adherenceOf(rows: PlanRow[], person: Person, weekStart: string, today: string, from?: string | null): Adherence[] {
  const cut = from != null && from > weekStart && from < addDays(weekStart, 7) ? from : null;
  const sessions = dedupeSessions(person.acts).filter((a) => inWeek(a, weekStart) && (!cut || localDay(a.timestamp) >= cut));
  const daysLeft = Math.max(0, 7 - (daysBetween(weekStart, today) + 1));
  const f = cut ? countedFigures(person, cut, addDays(weekStart, 7)) : weekFigures(person, weekStart);
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
      case "zone2_min": {
        const done = Math.round(f.zone2 ?? 0);
        if (n == null) return { kind: r.kind, label: r.label, done, of: null, word: "", tone: "neutral" };
        return { kind: r.kind, label: r.label, done, of: n, word: done >= n ? "Done" : `${n - done} min to go`, tone: done >= n ? "good" : daysLeft ? "neutral" : "caution" };
      }
      case "harder_min": {
        const done = Math.round(f.zone3 ?? Math.max(0, (f.zoned ?? 0) - (f.zone2 ?? 0)));
        return { kind: r.kind, label: r.label, done, of: n, word: n != null ? `${done} of ${n} min` : `${done} min`, tone: "neutral" };
      }
      case "steps_day": {
        const days = person.signals.filter((s) => s?.steps != null && String(s.day).slice(0, 10) >= weekStart && String(s.day).slice(0, 10) < addDays(weekStart, 7)).map((s) => Number(s.steps));
        if (!days.length) return { kind: r.kind, label: r.label, done: null, of: n, word: "No days yet", tone: "neutral" };
        const done = Math.round(days.reduce((t, v) => t + v, 0) / days.length);
        return { kind: r.kind, label: r.label, done, of: n, word: `${done.toLocaleString("en-GB")} a day so far`, tone: "neutral" };
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
/**
 * Week k of n. The count starts on the horizon's first Monday (horizonSpans), so it is the same count a plan's weeks
 * carry: n is the weeks that run Monday to Sunday and are judged, and a day in a short week at either end has `short`
 * set and no number of its own (0 in the short first week, n in the short last one). A day in a paused week has
 * `paused` set, and `week` is the number of the last week before it: the weeks behind.
 */
export function weekOf(h: HorizonLike, today: string): { week: number; weeks: number; short: "first" | "last" | null; paused?: boolean } {
  const spans = horizonSpans(h);
  const weeks = Math.max(1, spans.filter((s) => s.full).length);
  const s = spans.find((x) => today <= x.to) ?? spans[spans.length - 1];
  if (!s) return { week: 1, weeks, short: null };
  if (s.week != null) return { week: s.week, weeks, short: null };
  if (s.paused) return { week: spans.filter((x) => x.full && x.to < s.from).length, weeks, short: null, paused: true };
  return s.n === 1 ? { week: 0, weeks, short: "first" } : { week: weeks, weeks, short: "last" };
}
/** The week today is in, in words: "week 3 of 13", "a short first week", "the short last week", "paused this week". */
export function weekWords(h: HorizonLike, today: string): string {
  const { week, weeks, short, paused } = weekOf(h, today);
  return paused ? "paused this week" : short === "first" ? "a short first week" : short === "last" ? "the short last week" : `week ${week} of ${weeks}`;
}
export type Stop = { date: string; label: string; sub: string; state: "past" | "now" | "future" | "end" };
/** The road: the day it was set, each month's read, today, the date. */
export function roadOf(h: HorizonLike, today: string): Stop[] {
  const stops: Stop[] = [{ date: h.starts_on, label: dayMonth(h.starts_on), sub: "set", state: "past" }];
  for (let d = addMonths(h.starts_on.slice(0, 7) + "-01", 1); d < h.ends_on; d = addMonths(d, 1)) if (d > h.starts_on) stops.push({ date: d, label: dayMonth(d), sub: "month read", state: d <= today ? "past" : "future" });
  const { week, short, paused } = weekOf(h, today);
  if (today > h.starts_on && today < h.ends_on) stops.push({ date: today, label: "Today", sub: paused ? "paused" : short ? "a short week" : `week ${week}`, state: "now" });
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
/**
 * The Mondays of the complete weeks inside a horizon that are judged: from the first Monday on or after its start to
 * the last week that ends by its date, less the weeks its owner set aside. A plan's weeks are these, so a paused week
 * is not one of them and the week after it carries the number the paused one would have had.
 */
export function horizonMondays(h: HorizonLike): string[] {
  const out: string[] = [];
  const set = new Set(pausesOf(h));
  let m = mondayOf(new Date(h.starts_on + "T00:00:00"));
  if (m < h.starts_on) m = addDays(m, 7);
  for (; addDays(m, 6) <= h.ends_on; m = addDays(m, 7)) if (!set.has(m)) out.push(m);
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
  // a fitness number kept to a method is read on the date by that method alone
  const end = target.marker === "mets" && target.method ? fitnessBy(then, target.method) : latestOf(target.marker, then, addDays(h.ends_on, 1));
  const p = paceOf(target, h, end, h.ends_on);
  const base = { marker: target.marker, label: p.label, how: def.how, unit: p.unit, startText: p.startText, endText: end?.display ?? fmtValue(def, end?.value), targetText: p.targetText,
    swing: p.swing?.words ?? null, medicine: medicineOf(target.marker, then, h.ends_on)?.line ?? null };
  const goal = target.target_value;
  // a number held: the word the table carried, read on the date
  if (isHeld(def, target)) return { ...base, targetText: target.mode === "band" ? `${p.lowText ?? "—"} to ${p.targetText}` : `${target.mode === "floor" ? "at least" : "at most"} ${p.targetText}`, word: p.pace_word === "No reading yet" ? "No reading" : p.pace_word, tone: p.tone };
  if (isStanding(def, target)) {
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
export const outcomesOf = (targets: Target[], h: HorizonLike, person: Person): Outcome[] => openTargets(targets).map((t) => outcomeOf(t, h, person));

const trimZeros = (s: string) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
/** What the last road did to a marker, beside its row on the next horizon's set-up: "+0.55 METs in 13 weeks", "49 → 152 in 13 weeks", "1,000 held in 11 of 13". */
export function lastRoadWords(target: Target, h: HorizonLike, person: Person): string {
  const def = MARKER_BY_KEY[target.marker];
  if (!def) return "";
  const then = upTo(person, h.ends_on);
  const weeks = Math.max(1, horizonMondays(h).length);
  const span = `in ${weeks} week${weeks === 1 ? "" : "s"}`;
  if (isStanding(def, target)) {
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
    /** The colour the page gives the pace word. Absent in a row stored before 16 November 2026. */
    tone?: Tone;
    /**
     * The row's figures as the page prints them, each with its unit: "5,610 steps", "7 h 50", "53 bpm"; null where
     * the page prints a dash. These, and never the raw numbers beside them, are what the Guide is shown (guideView):
     * it copies a figure exactly, and it once copied a steps average to two decimals. Absent before 16 November 2026.
     */
    said?: { start: string | null; now: string | null; target: string | null; expected: string | null };
    /**
     * A blood target read from a report newer than its start: where the move sits against the marker's usual swing, in
     * the page's own sentence. The medicine on file is NOT here, on purpose: these inputs go to the model, into the
     * stored check-in, into its email and to a coach's thread, and a person's medication has never left the page.
     */
    swing?: string }[];
  plan: { kind: string; label: string; n: number | null }[];
  adherence: { label: string; done: number | null; of: number | null; word: string }[];
  /**
   * The horizon week that has just ended, read from the horizon's own days (horizonSpans): its first and last day, how
   * many days it holds, and whether it is a short one (the first week of a horizon set mid-week, the last of one
   * that ends mid-week). Every figure is null, and days 0, when no week of the horizon has ended yet.
   */
  week: { from: string | null; to: string | null; days: number; short: boolean; dose: number | null; goal: number | null; sessions: number; zone2: number | null; zone3: number | null; strength: number; sleep_avg: number | null; rhr: number | null; hrv: number | null;
    /** The week that has just ended was set aside by the horizon's owner: nothing in it is judged, and the check-in says so in fixed words (pausedCheckinLines). Absent on any other week. */
    paused?: boolean };
  /**
   * week_of counts from the horizon's first Monday: 0 on a day in a short first week, which `short_week` names.
   * `pauses` lists the weeks set aside so far, by their days, and `date_set` is the date as first set when a pause has
   * moved it; both are absent on a horizon that was never paused.
   */
  horizon: { title: string; ends_on: string; week_of: number; weeks_total: number; days_to_go: number; short_week: "first" | "last" | null;
    pauses?: { from: string; to: string }[]; date_set?: string };
  /** The two lines of a Monday check-in that are counted and not written (countedLines). Absent before 16 November 2026. */
  lines?: CheckinLine[];
};
export function checkinInputs(h: HorizonLike & { title: string; ends_on_set?: string | null }, targets: Target[], plan: PlanRow[], person: Person, today: string): CheckinInputs {
  // the horizon week that has just ended: a short first or last one is reported as the days it holds, and a week
  // from before the horizon was set is never read
  const span = [...horizonSpans(h)].reverse().find((s) => s.to < today) ?? null;
  const f = span ? spanFigures(person, span) : null;
  const inSpan = (s: any) => { const d = String(s?.day ?? "").slice(0, 10); return span != null && d >= span.from && d <= span.to; };
  const avg = (col: string) => { const xs = person.signals.filter((s) => s?.[col] != null && inSpan(s)).map((s) => Number(s[col])); return xs.length ? round(mean(xs)!, 0) : null; };
  const { week, weeks, short } = weekOf(h, today);
  // the weeks set aside up to today: a week paused ahead of time is not named until it has begun
  const set = horizonSpans(h).filter((s) => s.paused && s.from <= today);
  const pace = pacesOf(targets, h, person, today).map((p) => {
    const def = MARKER_BY_KEY[p.marker];
    return { marker: p.marker, label: p.label, unit: p.unit, start: p.start, now: p.now != null ? round(p.now, 2) : null, target: p.target, expected_today: p.expected_today != null ? round(p.expected_today, 2) : null, pace_word: p.pace_word, measured_on: p.measured_on,
      tone: p.tone,
      said: { start: withUnit(def, p.startText, p.start, p.unit), now: withUnit(def, p.nowText, p.now, p.unit), target: withUnit(def, p.targetText, p.target, p.unit),
        // where the straight line to the date stands today; a number that is held or stands every week has no such line
        expected: def && p.expected_today != null && !p.mode ? withUnit(def, fmtValue(def, p.expected_today), p.expected_today, p.unit) : null },
      ...(p.swing ? { swing: p.swing.words } : {}) };
  });
  return {
    pace,
    lines: countedLines(pace, horizonSpans(h).find((s) => s.full)?.to ?? null),
    plan: plan.map((r) => ({ kind: r.kind, label: r.label, n: r.n ?? null })),
    // a hand-written plan's weekly counts are read against a full week only
    adherence: span?.full ? adherenceOf(plan, person, span.from, span.to).map((a) => ({ label: a.label, done: a.done, of: a.of, word: a.word })) : [],
    week: { from: span?.from ?? null, to: span?.to ?? null, days: span?.days ?? 0, short: span != null && span.days < 7,
      dose: f?.dose ?? null, goal: f?.goal ?? null, sessions: f?.sessions ?? 0, zone2: f?.zone2 ?? null, zone3: f?.zone3 ?? null, strength: f?.strength ?? 0, sleep_avg: avg("sleep_minutes"), rhr: avg("resting_hr"), hrv: avg("hrv_night_ms"),
      ...(span?.paused ? { paused: true } : {}) },
    horizon: { title: h.title, ends_on: h.ends_on, week_of: week, weeks_total: weeks, days_to_go: daysToGo(h, today), short_week: short,
      ...(set.length ? { pauses: set.map((s) => ({ from: s.from, to: s.to })) } : {}),
      ...(h.ends_on_set && String(h.ends_on_set).slice(0, 10) !== h.ends_on ? { date_set: String(h.ends_on_set).slice(0, 10) } : {}) },
  };
}

// ── the Monday check-in as short lines (16 November 2026) ──
//
// The founder, on the first check-in to reach him: "the guide as a paragraph looks like a long prose - would concise
// bullet points work better?" A Monday check-in is now at most four short lines, each with one job: the week, what is
// on pace, what is not, the plan. The two in the middle are COUNTED here, from the pace words the page already
// shows, and are never written by the model: a count cannot be miscounted and a name cannot be left out. The Guide
// writes the first and the last. A figure is written only for a target that is not simply on pace, because the table
// beside the check-in (above it in "Your week", below it in its own email) already holds every figure. The month's read and the whole road stay as paragraphs.
//
// It is kept as it always was, in the check-in's one column of text: one line to a row, "Head: words". The page, the
// check-in's email and "Your week" all read it back with checkinLinesOf, so the three cannot drift.

export type CheckinLine = { head: string; text: string };
/** The heads a Monday check-in can carry, in the order they are shown. A text is read as lines only when every row opens with one of them. */
export const CHECKIN_HEADS = { week: "The week", on: "On pace", off: "Not on pace", waitingWeek: "Waiting on a full week", waiting: "Waiting", plan: "The plan", date: "The date" } as const;
/** The Guide's last line when it finds nothing to say about the plan: fixed words, so the null answer always reads the same. */
export const PLAN_NOTHING = "Nothing in this week's figures argues for more or less than it asks.";

/** A target's name inside a sentence: no capital it does not need, and no comma of its own to break a list. */
const IN_A_SENTENCE: Partial<Record<MarkerKey, string>> = {
  mets: "fitness", vo2: "VO₂max", dose: "weekly dose", zone2_week: "zone 2 a week", longest_session: "longest session", strength_week: "strength a week",
  steps: "steps a day", background: "background movement", sitting: "sitting", pal: "activity level", cadence: "cadence", sleep: "sleep", sri: "sleep regularity",
  rhr: "resting heart rate", hrv: "night HRV", hrr: "1-minute recovery", bp: "blood pressure", breathing: "breathing rate", spo2: "blood oxygen",
  weight: "weight", waist: "waist", almi: "ALMI", body_fat: "body fat", ffmi: "fat-free mass index", grip: "grip strength", chair_stands: "chair stand", sppb: "SPPB",
};
const nameInSentence = (p: { marker: string; label: string }) => IN_A_SENTENCE[p.marker as MarkerKey] ?? SAID[p.marker as MarkerKey] ?? p.label;
const MONTH_FIRST = /^(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
/** A pace word inside a sentence: "A centimetre behind" reads "a centimetre behind"; a month's name and a numeral keep their start. */
const lowerFirst = (w: string) => (MONTH_FIRST.test(w) ? w : w.charAt(0).toLowerCase() + w.slice(1));
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "Sunday 22 November", from the date's own digits: no clock and no locale data, so it reads the same wherever it runs. */
const plainDay = (d: string) => { const [y, m, dd] = d.slice(0, 10).split("-").map(Number); return `${WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]} ${dd} ${MONTH_NAMES[m - 1]}`; };

type PaceRow = CheckinInputs["pace"][number];
const NOT_JUDGED_YET = /^No (full week|session on file|reading|starting value)\b/;
/**
 * Where a row sits in the check-in. "on": the page colours its word good, or it is at its number (a move inside what
 * two readings differ by is not a change, and is not a miss). "off": the page colours it caution. "waiting": there is
 * nothing to judge yet, and the word says why.
 */
const groupOf = (p: PaceRow): "on" | "off" | "waiting" =>
  p.tone === "good" ? "on" : p.tone === "caution" ? "off" : /^(At your number|Held\b)/.test(p.pace_word) ? "on" : "waiting";

/**
 * The counted lines of a Monday check-in, from the pace rows: which targets are on pace, as a count and their names,
 * and the rest with their reasons. A target that is simply on pace is named and not re-quoted; one that is ahead,
 * reached or behind carries its figure. `firstFullWeekEnds` is the Sunday the horizon's first Monday-to-Sunday week
 * ends on, for the line that says what a weekly target is waiting for. Empty when the horizon holds no target.
 */
export function countedLines(pace: PaceRow[], firstFullWeekEnds: string | null): CheckinLine[] {
  const out: CheckinLine[] = [];
  const on = pace.filter((p) => groupOf(p) === "on"), off = pace.filter((p) => groupOf(p) === "off"), waiting = pace.filter((p) => groupOf(p) === "waiting");
  if (on.length) {
    const item = (p: PaceRow) => {
      if (p.pace_word === "On pace") return nameInSentence(p);
      const figure = /^(Ahead of pace|Reached|Nearly there|At your number)$/.test(p.pace_word) && p.said?.now ? `${p.said.now}, ` : "";
      return `${nameInSentence(p)} (${figure}${lowerFirst(p.pace_word.replace(/^Held: .*/, "Held"))})`;
    };
    const names = listWords(on.map(item));
    out.push({ head: CHECKIN_HEADS.on, text: pace.length === 1 ? `${cap(names)}, your one target.` : on.length === pace.length ? `All ${pace.length} targets: ${names}.` : `${on.length} of ${pace.length} targets: ${names}.` });
  }
  // the targets with nothing to judge yet, said once for each reason: "weekly dose and zone 2 a week, no full week yet"
  const reasons = [...new Set(waiting.map((p) => p.pace_word))];
  const waitingItems = reasons.map((r) => `${listWords(waiting.filter((p) => p.pace_word === r).map(nameInSentence))}, ${lowerFirst(r)}`);
  if (off.length) {
    // "Reached in 2 of 5 full weeks" is its own figure; every other word is read beside where the marker stands now.
    // Never a nought ("0 sessions now"). Past four such targets the line would run long: the figures are left to the
    // table beside it, and targets that share a word are said together ("waist and weight, slightly behind").
    const item = (p: PaceRow) => `${nameInSentence(p)}, ${lowerFirst(p.pace_word)}${p.said?.now && p.now !== 0 && !/^Reached in /.test(p.pace_word) ? ` (${p.said.now} now)` : ""}`;
    const words = [...new Set(off.map((p) => p.pace_word))];
    const offItems = off.length <= 4 ? off.map(item) : words.map((w) => `${listWords(off.filter((p) => p.pace_word === w).map(nameInSentence))}, ${lowerFirst(w)}`);
    out.push({ head: CHECKIN_HEADS.off, text: `${cap([...offItems, ...waitingItems].join("; "))}.` });
  } else if (waiting.length) {
    const weekOnly = reasons.length === 1 && reasons[0] === "No full week yet";
    out.push(weekOnly
      ? { head: CHECKIN_HEADS.waitingWeek, text: `${cap(listWords(waiting.map(nameInSentence)))}.${firstFullWeekEnds ? ` The first full week ends on ${plainDay(firstFullWeekEnds)}.` : ""}` }
      : { head: CHECKIN_HEADS.waiting, text: `${cap(waitingItems.join("; "))}.` });
  }
  return out;
}

/** "Tuesday 23 February 2027", from the date's own digits. */
const plainDate = (d: string) => `${plainDay(d)} ${d.slice(0, 4)}`;
/**
 * The Monday check-in for a week the owner set aside (board 13): two lines of fixed words, written by no model. The
 * week is named and nothing in it is judged; then where the date stands. A date a pause moved is said with how far;
 * one that stays (a day that cannot move) says that the plan closes up. Null when the week was not a paused one.
 */
export function pausedCheckinLines(inputs: Pick<CheckinInputs, "week" | "horizon">): CheckinLine[] | null {
  const w = inputs.week, hz = inputs.horizon;
  if (!w?.paused || !w.from || !w.to) return null;
  const end = hz?.ends_on ? plainDate(hz.ends_on) : null;
  const moved = hz?.date_set && hz.ends_on ? Math.round(daysBetween(hz.date_set, hz.ends_on) / 7) : 0;
  const date = !end ? "It is where the horizon's page shows it."
    : moved > 0 ? `${end}, ${numberWord(moved)} week${moved === 1 ? "" : "s"} later than first set.`
    : `${end}, where it was. The plan closes up by one week.`;
  return [
    { head: CHECKIN_HEADS.week, text: `Paused, ${daysWords(w.from, w.to)}. Nothing in it was asked or judged.` },
    { head: CHECKIN_HEADS.date, text: date },
  ];
}

/** A check-in's lines as the one column of text keeps them: one line to a row, "Head: words". */
export const linesText = (lines: CheckinLine[]) => lines.map((l) => `${l.head}: ${l.text}`).join("\n");
/**
 * A stored check-in read back. Its lines, when it was kept as lines: two rows or more, every one opening with a head
 * this file knows. Null for prose: every check-in written before 16 November 2026, the month's read, the whole road.
 */
export function checkinLinesOf(text: string | null | undefined): CheckinLine[] | null {
  const rows = String(text ?? "").split(/\n+/).map((r) => r.trim()).filter(Boolean);
  if (rows.length < 2) return null;
  const heads = Object.values(CHECKIN_HEADS) as string[];
  const out: CheckinLine[] = [];
  for (const r of rows) {
    const head = heads.find((h) => r.startsWith(`${h}: `));
    const rest = head ? r.slice(head.length + 2).trim() : "";
    if (!head || !rest) return null;
    out.push({ head, text: rest });
  }
  return out;
}

/**
 * The inputs as the Guide is shown them. Every figure is the page's own print of it, with its unit; a figure that was
 * not recorded is left out, and a week with no session says "none on file", so the Guide has no nought and no raw
 * decimal to copy. The numbers the email's table and the next check-in read stay in the stored inputs beside this;
 * this is only what the model sees, and what the numbers-only check then holds its words to.
 *
 * A Monday check-in is not shown the week's sleep, resting heart rate or night HRV: they are averages of the
 * horizon week's own days, which on a short week are few, and beside the page's seven-day figure for the same marker
 * they read as a disagreement. A marker the person made a target is in the pace rows, as the page prints it.
 */
export function guideView(inputs: CheckinInputs, kind: "week" | "month" | "final"): Record<string, unknown> {
  const n = (v: number) => Math.round(v).toLocaleString("en-GB");
  const big = (v: number) => (Math.abs(v) >= 1000 ? n(v) : v);
  const w = inputs.week;
  const week: Record<string, unknown> = { from: w.from, to: w.to, days: w.days, short: w.short, ...(w.paused ? { paused: true } : {}) };
  // a week the person set aside is named and nothing else: the Guide has no figure of it to judge
  if (w.from != null && !w.paused) {
    week.sessions = w.sessions > 0 ? `${n(w.sessions)} ${w.sessions === 1 ? "session" : "sessions"}` : "none on file";
    if (w.dose != null && w.dose > 0) week.dose = `${n(w.dose)} MET-min`;
    // a short week is never read against a weekly number, so it is not shown one
    if (w.goal != null && w.goal > 0 && !w.short) week.goal = `${n(w.goal)} MET-min`;
    if (w.zone2 != null && w.zone2 > 0) week.zone2 = `${n(w.zone2)} min`;
    if (w.zone3 != null && w.zone3 > 0) week.zone3 = `${n(w.zone3)} min`;
    if (w.strength > 0) week.strength = `${n(w.strength)} ${w.strength === 1 ? "strength session" : "strength sessions"}`;
    if (kind !== "week") {
      if (w.sleep_avg != null) week.sleep_avg = hm(w.sleep_avg);
      if (w.rhr != null) week.rhr = `${n(w.rhr)} bpm`;
      if (w.hrv != null) week.hrv = `${n(w.hrv)} ms`;
    }
  }
  const pace = inputs.pace.map((p) => {
    const def = MARKER_BY_KEY[p.marker];
    // a row from a page that predates `said` is printed here by the same rule
    const say = (text: string | null | undefined, v: number | null | undefined) => (text !== undefined ? text : def ? withUnit(def, fmtValue(def, v), v, p.unit) : v == null ? null : String(v));
    // a weekly figure that came to nothing is said in a word, never as a nought
    const now = p.now === 0 && def?.kind === "weekly" ? "none" : say(p.said?.now, p.now);
    // a figure that stands every week has no line to the date, so no place it should be today
    const expected = p.said ? p.said.expected : def?.standing ? null : say(undefined, p.expected_today);
    return { label: p.label, start: say(p.said?.start, p.start), now, target: say(p.said?.target, p.target), expected_today: expected,
      pace_word: p.pace_word, measured_on: p.measured_on, ...(p.swing ? { swing: p.swing } : {}) };
  });
  const plan = inputs.plan.map((r) => (r.kind === "bedtime_by" && r.n != null ? { label: r.label, by: clockOf(r.n) } : { label: r.label, ...(r.n != null ? { n: big(r.n) } : {}) }));
  const adherence = inputs.adherence.map((a) => ({ label: a.label, ...(a.done != null ? { done: big(a.done) } : {}), ...(a.of != null ? { of: big(a.of) } : {}), word: a.word }));
  return { horizon: inputs.horizon, week, pace, plan, adherence,
    ...(kind === "week" && inputs.lines?.length ? { written: inputs.lines.map((l) => `${l.head}: ${l.text}`) } : {}) };
}

/**
 * The week in one counted line, for when the Guide's own first line does not survive the numbers-only check: the
 * check-in is never left without it. Null when no week of the horizon has ended.
 */
export function weekLine(inputs: CheckinInputs): string | null {
  const w = inputs.week;
  if (!w.from || !w.to) return null;
  const v = guideView(inputs, "week").week as Record<string, string | undefined>;
  const figures = [v.sessions !== "none on file" ? v.sessions : null, v.dose ? (v.goal ? `${v.dose} against your goal of ${v.goal}` : v.dose) : null, v.zone2 ? `${v.zone2} in zone 2` : null, v.strength ?? null].filter((x): x is string => !!x);
  const days = daysWords(w.from, w.to);
  if (w.paused) return `Paused, ${days}. Nothing in it was asked or judged.`;
  if (w.short) return `A short week of ${w.days} day${w.days === 1 ? "" : "s"}, ${days}${figures.length ? `: ${listWords(figures)}` : ", with no session on file"}. A short week is not read against a weekly number.`;
  return figures.length ? `${cap(listWords(figures))}.` : `No session on file for ${days}.`;
}
