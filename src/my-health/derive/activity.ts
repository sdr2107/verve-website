/**
 * Activity and fitness, from a person's weeks, workouts and tests. Pure:
 * the app's week rows, the imported weeks and the session rows come in, the
 * summaries the Overview and In depth read come out.
 *
 * The rule since 8 November 2026 (canvas "My health, redesigned", board 10):
 * the app computes, the website shows. A week the app has written (a
 * web_weeks row with source "sync") is that week's figures, and the browser
 * never recounts it. A week with no app row is counted here from the
 * session rows with an interim rule: one row per session, keyed by its
 * start and end, the device's row preferred. A week with neither has no
 * dose at all: a dash and "no sessions logged", never a number from another
 * unit. The MET-hours × 60 fallback is gone.
 */
import { addDays, byDate, daysBetween, localDay, mondayOf } from "./format.ts";
import { CRF_RETEST, MAXIMAL, type Due } from "./markers.ts";
import stepData from "../../data/step-thresholds.ts";

/**
 * The step tier floors the app draws — 2,600, 7,000, 8,800 — from a copy of
 * the app's data/step-thresholds.json kept in src/data (the same discipline
 * as science.ts: if one changes, change both). Lowest first; the zero floor
 * left out, since it is not a line.
 */
export const STEP_LINES: { value: number; label: string; color: string }[] =
  (stepData.tiers as readonly { label: string; min: number; color: string }[]).filter((t) => t.min > 0).map((t) => ({ value: t.min, label: t.label, color: t.color }));

/**
 * The weekly dose, as the app counts it (lib/periodSummary aerobicMETMinutes):
 * a session's MET-minutes when it is a workout (not the day's background
 * movement), an aerobic one, and its average effort came out moderate or
 * vigorous. The unit the ACC's 500–1,000 a week is written in.
 */
export const doseOf = (a: any): number =>
  isWorkout(a) && (a.activity_type === "aerobic" || a.activity_type === "mixed") && (a.intensity_category === "moderate" || a.intensity_category === "vigorous")
    ? Number(a.met_minutes) || 0
    : 0;

/** A workout, not the day's background movement (source "passive-nakanishi", one row a day). */
export const isWorkout = (a: any) => a && a.source !== "passive-nakanishi";

// ── one row per session ──────────────────────────────────────────────────
// The app elects one writer per session (lib/calculations dedupeActivities).
// The document does not carry the app's key, so the interim rule here is the
// one board 10 names: a session is its start and its end, to the minute; of
// two rows with the same key the device's row is kept, a typed one last.
const minuteOf = (iso: string) => Math.round(new Date(iso).getTime() / 60000);
/** The start and the end of a session, to the minute: the key one writer per session is judged by. */
export const sessionKey = (a: any): string => {
  const start = minuteOf(a.timestamp);
  const end = a.ended_at ? minuteOf(a.ended_at) : start + Math.round(Number(a.duration_minutes) || 0);
  return `${start}|${end}`;
};
const SOURCE_RANK: Record<string, number> = { healthkit: 0, healthconnect: 0, "hr-estimated": 1, manual: 2 };
const rankOf = (a: any) => SOURCE_RANK[String(a?.source ?? "")] ?? 3;
/** The workouts with one row per session: the device's row over an estimate over a typed one, then the fuller row. */
export function dedupeSessions(acts: any[]): any[] {
  const by = new Map<string, any>();
  for (const a of acts) {
    if (!a?.timestamp || !isWorkout(a)) continue;
    const k = sessionKey(a);
    const cur = by.get(k);
    if (!cur) { by.set(k, a); continue; }
    const better = rankOf(a) < rankOf(cur) || (rankOf(a) === rankOf(cur) && (Number(a.zone2_minutes) || 0) > (Number(cur.zone2_minutes) || 0));
    if (better) by.set(k, a);
  }
  return [...by.values()].sort(byDate("timestamp"));
}
/** The store a session row came through, in words, for the writer line. */
export const sourceWords = (source: unknown): string =>
  source === "healthkit" ? "Apple Health" : source === "healthconnect" ? "Health Connect" : source === "manual" ? "typed in Verve" : source === "hr-estimated" ? "estimated from heart rate" : String(source ?? "the app");

// ── the week rows ────────────────────────────────────────────────────────
/** One week as the page reads it, whoever counted it. */
export interface WeekRow {
  week_start: string;
  /** sync: the app wrote it · browser: counted here from sessions · export, csv: an import · gap: an empty week filled in */
  source: "sync" | "browser" | "export" | "csv" | "gap" | string;
  /** Who counted the dose: the app, the browser's interim rule, or no one (no sessions logged). */
  dose_basis: "app" | "browser" | "none";
  /** MET-minutes; null means no sessions were logged that week (never 0 for that). */
  dose_met_min: number | null;
  /** The goal in force that week, from the app's row; null when the profile's goal stands. */
  dose_goal_met_min: number | null;
  met_hours: number; minutes: number; light_min: number; moderate_min: number; vigorous_min: number; workouts: number;
  zone1_min: number | null; zone2_min: number | null; zone3_min: number | null;
  strength_sessions: number | null;
  /** The mean of the week's background minutes over the days that had any; null when none. */
  background_min_avg: number | null;
  synced_at: string | null;
  /** The sources counted, when the browser counted (empty when the app did). */
  writers: string[];
  import_tag?: string | null;
}
const num = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export const emptyWeek = (week_start: string, source: WeekRow["source"] = "gap"): WeekRow => ({
  week_start, source, dose_basis: "none", dose_met_min: null, dose_goal_met_min: null,
  met_hours: 0, minutes: 0, light_min: 0, moderate_min: 0, vigorous_min: 0, workouts: 0,
  zone1_min: null, zone2_min: null, zone3_min: null, strength_sessions: null, background_min_avg: null, synced_at: null, writers: [],
});
/** An app row: the app wrote it on sync. */
export const isAppWeek = (w: any) => !!w && w.source === "sync" && (w.dose_met_min != null || w.synced_at != null);
/** The week as the app wrote it. A row with no sessions (workouts 0) has no dose: a dash, not a zero figure. */
export function weekFromApp(w: any): WeekRow {
  const workouts = Number(w.workouts) || 0;
  return {
    week_start: String(w.week_start), source: "sync", dose_basis: "app",
    dose_met_min: workouts > 0 && w.dose_met_min != null ? Math.round(Number(w.dose_met_min)) : null,
    dose_goal_met_min: num(w.dose_goal_met_min),
    met_hours: Number(w.met_hours) || 0, minutes: Number(w.minutes) || 0, light_min: Number(w.light_min) || 0, moderate_min: Number(w.moderate_min) || 0, vigorous_min: Number(w.vigorous_min) || 0, workouts,
    zone1_min: num(w.zone1_min), zone2_min: num(w.zone2_min), zone3_min: num(w.zone3_min),
    strength_sessions: num(w.strength_sessions), background_min_avg: num(w.background_min_avg),
    synced_at: w.synced_at ?? null, writers: [], import_tag: w.import_tag ?? null,
  };
}
/** The app's weeks from its workouts, bucketed the way the app does: by the Monday, in local time; one row per session. */
export function weeksFrom(activities: any[]): WeekRow[] {
  const by = new Map<string, WeekRow>();
  for (const a of dedupeSessions(activities)) {
    const start = mondayOf(new Date(a.timestamp));
    const w = by.get(start) ?? { ...emptyWeek(start, "browser"), dose_basis: "browser" as const, dose_met_min: 0, zone2_min: 0, strength_sessions: 0 };
    const mins = Number(a.duration_minutes) || 0;
    w.met_hours += Number(a.met_hours) || 0; w.minutes += mins; w.workouts += 1; w.dose_met_min! += doseOf(a);
    w.zone2_min! += Number(a.zone2_minutes) || 0;
    if (a.activity_type === "strength") w.strength_sessions! += 1;
    const cat = String(a.intensity_category ?? "");
    if (cat === "vigorous") w.vigorous_min += mins; else if (cat === "moderate") w.moderate_min += mins; else w.light_min += mins;
    const src = sourceWords(a.source); if (!w.writers.includes(src)) w.writers.push(src);
    by.set(start, w);
  }
  return [...by.values()].map((w) => ({ ...w, met_hours: Math.round(w.met_hours * 100) / 100, dose_met_min: Math.round(w.dose_met_min!) })).sort((x, y) => x.week_start.localeCompare(y.week_start));
}
/** An import's week (an export or a CSV): its hours and minutes stand, but it carries no dose. */
export function weekFromImport(w: any): WeekRow {
  return { ...emptyWeek(String(w.week_start), String(w.source ?? "export")), met_hours: Number(w.met_hours) || 0, minutes: Number(w.minutes) || 0,
    light_min: Number(w.light_min) || 0, moderate_min: Number(w.moderate_min) || 0, vigorous_min: Number(w.vigorous_min) || 0, workouts: Number(w.workouts) || 0, import_tag: w.import_tag ?? null };
}
/**
 * The weeks the page reads: for each Monday the app's row when it wrote one,
 * else the browser's count of that week's sessions, else the import's row.
 * Idempotent: rows that came out of here go in again unchanged.
 */
export function mergeWeeks(docWeeks: any[], activities: any[]): WeekRow[] {
  const out = new Map<string, WeekRow>();
  for (const w of docWeeks ?? []) if (w?.week_start && !isAppWeek(w) && w.source !== "browser") out.set(String(w.week_start), weekFromImport(w));
  for (const w of weeksFrom(activities ?? [])) out.set(w.week_start, w);
  for (const w of docWeeks ?? []) if (w?.week_start && isAppWeek(w)) out.set(String(w.week_start), weekFromApp(w));
  return [...out.values()].sort((x, y) => x.week_start.localeCompare(y.week_start));
}
/** The short reason under a dash where a dose would be. */
export const doseReason = (w: WeekRow | null | undefined, synced: boolean): string =>
  !w || w.dose_basis === "none" ? "no sessions logged" : w.dose_met_min == null ? "no sessions logged" : w.dose_basis === "browser" && synced ? "the app writes this on its next sync" : "";

export const crfFromSync = (rows: any[]) => rows.filter((c) => c?.timestamp).map((c) => ({
  measured_on: localDay(c.timestamp),
  vo2max: c.vo2_max_estimate ?? (c.met_capacity != null ? Math.round(Number(c.met_capacity) * 3.5 * 10) / 10 : null),
  met_capacity: c.met_capacity ?? null, method: c.estimation_method ?? null, category: c.performance_category ?? null, source: "sync",
}));
export const bodyFromSync = (rows: any[]) => rows.filter((w) => w?.measured_at && w.waist_cm != null).map((w) => ({ measured_on: localDay(w.measured_at), waist_cm: w.waist_cm, source: "sync" }));
/** The primary's rows win over the fallback's on the same key; the result is sorted by it. */
export function mergeBy(key: string, primary: any[], fallback: any[]): any[] {
  const out = new Map<string, any>();
  for (const r of fallback) out.set(String(r[key]), r);
  for (const r of primary) out.set(String(r[key]), r);
  return [...out.values()].sort((x, y) => String(x[key]).localeCompare(String(y[key])));
}

export type DayActs = { met: number; z2: number; n: number; vig: number; mod: number; min: number; dose: number };
/** The app's rows by day, one row per session: MET-hours, minutes by effort, Zone 2, the count. Only when the sessions themselves are here. */
export function actsByDay(acts: any[]): Map<string, DayActs> {
  const by = new Map<string, DayActs>();
  for (const a of dedupeSessions(acts)) {
    const d = localDay(a.timestamp);
    const r = by.get(d) ?? { met: 0, z2: 0, n: 0, vig: 0, mod: 0, min: 0, dose: 0 };
    const mins = Number(a.duration_minutes) || 0;
    r.met += Number(a.met_hours) || 0; r.z2 += Number(a.zone2_minutes) || 0; r.n += 1; r.min += mins; r.dose += doseOf(a);
    if (a.intensity_category === "vigorous") r.vig += mins; else if (a.intensity_category === "moderate") r.mod += mins;
    by.set(d, r);
  }
  return by;
}

/** Activity, from a person's weeks and (where synced) their workouts, against their own goal. */
export function activitySummary(weeksIn: any[], actsIn: any[], goal: number, today: string, thisMonday: string) {
  // The rows as the page reads them: the app's week where it wrote one, the
  // browser's count where it did not, an import's hours where neither. A week
  // with nothing anywhere is a gap: it is on the calendar with no dose.
  const have = new Map<string, WeekRow>(mergeWeeks(weeksIn, actsIn).map((w) => [w.week_start, w]));
  const weeks: WeekRow[] = [];
  if (have.size) {
    for (let d = [...have.keys()].sort()[0]; d <= thisMonday; d = addDays(d, 7)) weeks.push(have.get(d) ?? emptyWeek(d));
    for (const [d, w] of have) if (d > thisMonday) weeks.push(w);
  }
  const acts = dedupeSessions(actsIn);
  const complete = weeks.filter((w) => w.week_start < thisMonday);
  const recent = (complete.length ? complete : weeks).slice(-4), prior = complete.slice(-8, -4);
  const sum = (xs: any[], k: string) => xs.reduce((t, w) => t + (Number(w[k]) || 0), 0);
  const recentAvg = recent.length ? sum(recent, "met_hours") / recent.length : 0;
  const priorAvg = prior.length ? sum(prior, "met_hours") / prior.length : null;
  const change = priorAvg && priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : null;
  // The goal is the app's: stored in MET-hours, judged as a dose in MET-minutes;
  // a week the app wrote carries the goal in force that week and is judged against it.
  const thisWeek = weeks.find((w) => w.week_start === thisMonday) ?? null;
  const goalDose = thisWeek?.dose_goal_met_min ?? Math.round(goal * 60);
  const goalFor = (w: WeekRow) => w.dose_goal_met_min ?? goalDose;
  const atGoalW = (w: WeekRow) => w.dose_met_min != null && w.dose_met_min >= goalFor(w);
  let streak = 0; for (let i = complete.length - 1; i >= 0 && atGoalW(complete[i]); i--) streak++;
  const last12 = complete.slice(-12);
  const atGoal = last12.filter(atGoalW).length;
  const lastWorkoutDay = acts.length ? localDay(acts[acts.length - 1].timestamp) : ([...weeks].reverse().find((w) => Number(w.workouts) > 0)?.week_start ?? "");
  const quietDays = lastWorkoutDay ? daysBetween(lastWorkoutDay, today) : null;
  const recentActs = acts.filter((x) => recent.length && localDay(x.timestamp) >= recent[0].week_start && localDay(x.timestamp) < addDays(recent[recent.length - 1].week_start, 7));
  const kinds = new Map<string, number>();
  for (const x of recentActs) { const k = String(x.activity_name ?? "workout").split(/[,(]/)[0].trim().toLowerCase(); kinds.set(k, (kinds.get(k) ?? 0) + 1); }
  const perWeek = recent.length ? sum(recent, "workouts") / recent.length : 0;
  const minutes = sum(recent, "minutes"), vig = sum(recent, "vigorous_min");
  const zone2 = recentActs.length ? recentActs.reduce((t, x) => t + (Number(x.zone2_minutes) || 0), 0) / recent.length : null;
  return { weeks, complete, recent, prior, recentAvg, priorAvg, change, streak, atGoal, of: last12.length, thisWeek, lastWorkoutDay, quietDays, recentActs, kinds, perWeek, minutes, vig, zone2, goalDose };
}
export type ActivitySummary = ReturnType<typeof activitySummary>;

/** Fitness: every test, the latest judged only against the previous test of the same method, and the app's retest reminder. */
export function fitnessSummary(crfIn: any[], today: string) {
  const tests = [...crfIn].filter((c) => c.vo2max != null).sort(byDate("measured_on")).map((c) => ({ ...c, v: Number(c.vo2max), max: MAXIMAL.has(String(c.method)) }));
  const latest = tests[tests.length - 1] ?? null;
  const prevSame = latest ? [...tests.slice(0, -1)].reverse().find((t) => t.method === latest.method) ?? null : null;
  const within = latest && prevSame ? latest.v - prevSame.v : null;
  const trendWord = within == null ? "" : within >= 1 ? "rising" : within <= -1 ? "falling" : "flat";
  const due: Due | null = latest ? { what: "Fitness test", on: addDays(latest.measured_on, CRF_RETEST.due), days: daysBetween(today, addDays(latest.measured_on, CRF_RETEST.due)), why: "the app's own reminder, eight weeks" } : null;
  return { tests, latest, prevSame, within, trendWord, due };
}
export type FitnessSummary = ReturnType<typeof fitnessSummary>;
