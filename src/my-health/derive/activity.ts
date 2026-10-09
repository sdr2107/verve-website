/**
 * Activity and fitness, from a person's weeks, workouts and tests. Pure:
 * the imported weeks and the app's rows come in, the summaries the
 * Overview and In depth read come out.
 */
import { addDays, byDate, daysBetween, localDay, mondayOf } from "./format.ts";
import { CRF_RETEST, MAXIMAL, type Due } from "./markers.ts";

/** The app's weeks from its workouts, bucketed the way the app does: by the Monday, in local time. */
export function weeksFrom(activities: any[]): any[] {
  const by = new Map<string, any>();
  for (const a of activities) {
    if (!a?.timestamp) continue;
    const start = mondayOf(new Date(a.timestamp));
    const w = by.get(start) ?? { week_start: start, met_hours: 0, minutes: 0, light_min: 0, moderate_min: 0, vigorous_min: 0, workouts: 0, source: "sync" };
    const mins = Number(a.duration_minutes) || 0;
    w.met_hours += Number(a.met_hours) || 0; w.minutes += mins; w.workouts += 1;
    const cat = String(a.intensity_category ?? "");
    if (cat === "vigorous") w.vigorous_min += mins; else if (cat === "moderate") w.moderate_min += mins; else w.light_min += mins;
    by.set(start, w);
  }
  return [...by.values()].map((w) => ({ ...w, met_hours: Math.round(w.met_hours * 100) / 100 })).sort((x, y) => x.week_start.localeCompare(y.week_start));
}
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
/** A workout, not the day's background movement (source "passive-nakanishi", one row a day). */
export const isWorkout = (a: any) => a && a.source !== "passive-nakanishi";

export type DayActs = { met: number; z2: number; n: number; vig: number; mod: number; min: number };
/** The app's rows by day: MET-hours, minutes by effort, Zone 2, the count. Only when the sessions themselves are here. */
export function actsByDay(acts: any[]): Map<string, DayActs> {
  const by = new Map<string, DayActs>();
  for (const a of acts) {
    if (!a?.timestamp) continue;
    const d = localDay(a.timestamp);
    const r = by.get(d) ?? { met: 0, z2: 0, n: 0, vig: 0, mod: 0, min: 0 };
    const mins = Number(a.duration_minutes) || 0;
    r.met += Number(a.met_hours) || 0; r.z2 += Number(a.zone2_minutes) || 0; r.n += 1; r.min += mins;
    if (a.intensity_category === "vigorous") r.vig += mins; else if (a.intensity_category === "moderate") r.mod += mins;
    by.set(d, r);
  }
  return by;
}

/** Activity, from a person's weeks and (where synced) their workouts, against their own goal. */
export function activitySummary(weeksIn: any[], actsIn: any[], goal: number, today: string, thisMonday: string) {
  // a week with nothing logged has no row anywhere, so the calendar is filled: an empty week is a zero week, not a missing one
  const have = new Map<string, any>([...weeksIn].map((w) => [String(w.week_start), w]));
  const weeks: any[] = [];
  if (have.size) {
    for (let d = [...have.keys()].sort()[0]; d <= thisMonday; d = addDays(d, 7)) weeks.push(have.get(d) ?? { week_start: d, met_hours: 0, minutes: 0, light_min: 0, moderate_min: 0, vigorous_min: 0, workouts: 0, source: "gap" });
    for (const [d, w] of have) if (d > thisMonday) weeks.push(w);
  }
  const acts = [...actsIn].sort(byDate("timestamp"));
  const complete = weeks.filter((w) => w.week_start < thisMonday);
  const recent = (complete.length ? complete : weeks).slice(-4), prior = complete.slice(-8, -4);
  const sum = (xs: any[], k: string) => xs.reduce((t, w) => t + (Number(w[k]) || 0), 0);
  const recentAvg = recent.length ? sum(recent, "met_hours") / recent.length : 0;
  const priorAvg = prior.length ? sum(prior, "met_hours") / prior.length : null;
  const change = priorAvg && priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : null;
  let streak = 0; for (let i = complete.length - 1; i >= 0 && Number(complete[i].met_hours) >= goal; i--) streak++;
  const last12 = complete.slice(-12);
  const atGoal = last12.filter((w) => Number(w.met_hours) >= goal).length;
  const thisWeek = weeks.find((w) => w.week_start === thisMonday) ?? null;
  const lastWorkoutDay = acts.length ? localDay(acts[acts.length - 1].timestamp) : ([...weeks].reverse().find((w) => Number(w.workouts) > 0)?.week_start ?? "");
  const quietDays = lastWorkoutDay ? daysBetween(lastWorkoutDay, today) : null;
  const recentActs = acts.filter((x) => recent.length && localDay(x.timestamp) >= recent[0].week_start && localDay(x.timestamp) < addDays(recent[recent.length - 1].week_start, 7));
  const kinds = new Map<string, number>();
  for (const x of recentActs) { const k = String(x.activity_name ?? "workout").split(/[,(]/)[0].trim().toLowerCase(); kinds.set(k, (kinds.get(k) ?? 0) + 1); }
  const perWeek = recent.length ? sum(recent, "workouts") / recent.length : 0;
  const minutes = sum(recent, "minutes"), vig = sum(recent, "vigorous_min");
  const zone2 = recentActs.length ? recentActs.reduce((t, x) => t + (Number(x.zone2_minutes) || 0), 0) / recent.length : null;
  return { weeks, complete, recent, prior, recentAvg, priorAvg, change, streak, atGoal, of: last12.length, thisWeek, lastWorkoutDay, quietDays, recentActs, kinds, perWeek, minutes, vig, zone2 };
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
