/**
 * The four sections under Overview and their markers: each marker a small
 * definition that says where its points come from, what Verve reads of
 * them and how to draw a range. Built from a person's rows by
 * buildMarkers(), so a marker is a function of the document, never of a
 * page's globals. Pure.
 *
 * A daily marker gets the app's Over Time lenses (week, 4 weeks, months,
 * years); one read now and then (a fitness test, a waist, a grip) gets six
 * months, a year, or everything: a week of a waist is nothing to look at.
 */
import { addDays, dayWord, esc, fmt1, fmtDay, fmtHM, fmtSleepMin, kicker, localDay, medianOf, mondayOf, round0, todayStr } from "./format.ts";
import { dueTone, dueWord, type Pt } from "./markers.ts";
import { actsByDay, activitySummary, fitnessSummary } from "./activity.ts";
import { sleepHeartSummary } from "./heart.ts";
import { methodLabel } from "./markers.ts";

export type SecKey = "fitness" | "movement" | "heart" | "body";
export type Rng = "week" | "4w" | "months" | "years" | "6m" | "1y" | "all";
export type Pt2 = { d: string; v: number; note?: string };
export type Marker = {
  key: string; section: SecKey; label: string; unit: string; sub: string;
  daily: boolean; sum?: boolean;              // a daily marker that adds up (steps, MET-hours) rather than averages
  avgDay?: boolean;                           // adds up within a day, but a year of it reads as a daily average (steps)
  color: string; science: string; source: string;
  fmt: (v: number) => string;
  series: () => Pt2[];                        // every point, oldest first
  goal?: () => number | null;                 // a weekly goal, drawn as a line on the week
  band?: () => { lo: number; hi: number; why: string } | null;   // the person's own normal, shaded
  reads: (pts: Pt2[]) => string[];            // what Verve reads, in sentences (HTML)
  rangeReads?: (range: Rng, year: number | null) => string[];   // sentences for one range, after `reads` (night HRV's months and years)
  companion?: string;                         // another marker's key whose same-range figure sits beside this one's (activity level ↔ active energy)
  group?: "metabolic" | "heart" | "muscle";   // Body only: the app's three shelves
  pointLabel?: (p: Pt2) => string;            // the tile's figure when one number is not the whole reading (118/76)
};
export const SEC_META: Record<SecKey, { label: string; dot: string; blurb: string; science: string }> = {
  fitness:  { label: "Fitness",       dot: "#f97316", blurb: "What a MET is, how yours is measured, and how much to trust the answer.", science: "/science/fitness" },
  movement: { label: "Movement",      dot: "#34d399", blurb: "How much, how hard, how often, and how much of the rest of the day is sitting.", science: "/science/movement" },
  heart:    { label: "Sleep & heart", dot: "#818cf8", blurb: "What the watch reads while you are asleep and in the minute after you stop.", science: "/science/sleep-heart" },
  body:     { label: "Body",          dot: "#FBBF24", blurb: "Metabolic, heart and muscle: the same three shelves as the app's Body page, from the app and the reports.", science: "/science/body" },
};
export const SEC_ORDER: SecKey[] = ["fitness", "movement", "heart", "body"];
export const RANGE_LABEL: Record<Rng, string> = { week: "Week", "4w": "4 weeks", months: "Months", years: "Years", "6m": "6 months", "1y": "Year", all: "All" };
export const SHELVES: Array<["metabolic" | "heart" | "muscle", string]> = [["metabolic", "Metabolic"], ["heart", "Heart"], ["muscle", "Muscle"]];

/** The person's own normal for a daily marker: the median of the prior 30 days, five either side. */
export function ownBand(pts: Pt2[], spread: number, why: string) {
  const last = pts[pts.length - 1]; if (!last) return null;
  const from = addDays(last.d, -30);
  const pri = pts.filter((p) => p.d >= from && p.d < last.d).map((p) => p.v);
  if (pri.length < 14) return null;
  const m = medianOf(pri)!;
  return { lo: Math.round(m) - spread, hi: Math.round(m) + spread, why };
}

/** The weighings, one a day, Health's over Settings' on the same day. */
export function weightSeries(weights: any[]): Pt2[] {
  const by = new Map<string, { v: number; health: boolean }>();
  for (const r of weights) { const d = String(r.measured_on).slice(0, 10), v = Number(r.weight_kg); if (!Number.isFinite(v)) continue; const cur = by.get(d); if (cur && cur.health && r.source !== "health") continue; by.set(d, { v, health: r.source === "health" }); }
  return [...by].map(([d, x]) => ({ d, v: x.v })).sort((a, b) => a.d.localeCompare(b.d));
}

// The SPPB, scored the way the app scores it (lib/body.ts, Guralnik 1994):
// balance from the tandem progression, each stand held up to ten seconds;
// walk from the four-metre time; chair from five rises. Kept in step by hand.
const sppbBalance = (a: any, b: any, c: any) => { const cap = (v: any) => v == null ? null : Math.min(Number(v), 10); const s1 = cap(a), s2 = cap(b), s3 = cap(c); if (s1 == null) return null; if (s1 < 10) return 0; if (s2 == null) return null; if (s2 < 10) return 1; if (s3 == null) return null; return s3 >= 10 ? 4 : s3 >= 3 ? 3 : 2; };
const sppbGait = (v: any) => { const g = Number(v); if (!(g > 0)) return null; const t = 4 / g; return t > 8.7 ? 1 : t > 6.2 ? 2 : t > 4.82 ? 3 : 4; };
const sppbChair = (v: any) => { const c = Number(v); if (!(c > 0)) return null; return c > 60 ? 0 : c >= 16.7 ? 1 : c >= 13.7 ? 2 : c >= 11.2 ? 3 : 4; };
export function sppbSeries(app: any[]): Pt2[] {
  const out: Pt2[] = [];
  for (const r of app) {
    const b = sppbBalance(r.sppb_side_by_side_seconds, r.sppb_semi_tandem_seconds, r.sppb_tandem_seconds), g = sppbGait(r.gait_speed_ms), c = sppbChair(r.chair_stand_seconds);
    if (b == null || g == null || c == null) continue;
    out.push({ d: localDay(r.measured_at), v: b + g + c, note: `balance ${b}, walk ${g}, chair ${c}` });
  }
  return out.sort((x, y) => x.d.localeCompare(y.d));
}

/** What a person's markers are built from: the rows the document carries, already merged. */
export interface MarkerSources {
  signals: any[];
  acts: any[];
  weights: any[];
  profile: any;
  crf: any[];
  weeks: any[];
  app: any[];
  by: Map<string, Pt[]>;
}

export function buildMarkers(src: MarkerSources): Marker[] {
  const { signals, acts, weights, profile, crf, weeks, app, by } = src;
  const signalSeries = (col: string): Pt2[] => signals.filter((r) => r[col] != null).map((r) => ({ d: String(r.day), v: Number(r[col]) }));
  const sparseFrom = (key: string): Pt2[] => (by.get(key) ?? []).map((p) => ({ d: p.d, v: p.v }));
  const weeklyGoal = () => Number(profile?.weekly_met_hours_goal) || 7.5;
  const days = () => actsByDay(acts);
  const weighings = () => weightSeries(weights);
  const dbpOn = (d: string) => (by.get("dbp") ?? []).find((q) => q.d === d) ?? null;
  const heart = () => sleepHeartSummary(signals, todayStr());

  /** What Verve reads of a lab marker: the latest value, the change since the first, and the lab's own range when it printed one. */
  function labReads(key: string, label: string, unit: string, pts: Pt2[]): string[] {
    if (!pts.length) return [`No ${label.toLowerCase()} on file. A report dropped on Reports fills this in.`];
    const l = pts[pts.length - 1], lp = (by.get(key) ?? []).find((p) => p.d === l.d && p.v === l.v) ?? null;
    const u = lp?.unit || unit;
    const out = [`<strong class="text-text-primary">${fmt1(l.v)}${u ? ` ${esc(u)}` : ""}</strong> on ${esc(fmtDay(l.d))}${pts.length > 1 ? `, ${l.v === pts[0].v ? "the same as" : `${l.v > pts[0].v ? "up" : "down"} ${fmt1(Math.abs(l.v - pts[0].v))} from`} the first on ${esc(fmtDay(pts[0].d))}` : ""}.`];
    if (lp && (lp.lo != null || lp.hi != null)) {
      const below = lp.lo != null && l.v < lp.lo, above = lp.hi != null && l.v > lp.hi;
      out.push(`${below || above ? `<span class="text-warning">${below ? "Below" : "Above"} the lab's own range</span>` : `<span class="text-success-light">Within the lab's own range</span>`} of ${lp.lo != null ? fmt1(lp.lo) : "…"} to ${lp.hi != null ? fmt1(lp.hi) : "…"}. The app's bands are on Labs.`);
    }
    return out;
  }
  /** A tile for a marker read from reports or the app's rows: Body, on one of its three shelves. */
  const labMarker = (key: string, group: "metabolic" | "heart" | "muscle", label: string, unit: string, sub: string, science: string, extra: Partial<Marker> = {}): Marker => ({
    key, section: "body", group, label, unit, sub, daily: false, color: "#FBBF24", science,
    source: "Read from a report, or the app's own row; the same value on the same day is one reading.",
    fmt: (v) => fmt1(v), series: () => sparseFrom(key), reads: (pts) => labReads(key, label, unit, pts), ...extra,
  });

  return [
    // ── fitness ──
    { key: "mets", section: "fitness", label: "Fitness", unit: "METs", sub: "The number Verve leads with, from each test", daily: false, color: "#f97316",
      science: "/science/fitness/crf", source: "Every fitness test the app holds, compared only within its method.", fmt: (v) => fmt1(v),
      series: () => crf.filter((c) => c.met_capacity != null || c.vo2max != null).map((c) => ({ d: String(c.measured_on), v: c.met_capacity != null ? Number(c.met_capacity) : Number(c.vo2max) / 3.5, note: methodLabel(c.method) })),
      reads: () => { const f = fitnessSummary(crf, todayStr()); if (!f.latest) return ["No fitness test on file. The app offers one in six to twelve minutes."]; const out = [`<strong class="text-text-primary">${fmt1(f.latest.v / 3.5)} METs</strong> by ${esc(methodLabel(f.latest.method))} on ${esc(fmtDay(f.latest.measured_on))}${f.within != null ? `, ${f.within >= 0 ? "up" : "down"} ${fmt1(Math.abs(f.within) / 3.5)} on the same method before` : ", the first of its method"}.`]; if (f.latest.category) out.push(`Tier <strong class="text-text-primary">${esc(String(f.latest.category).replace(/-/g, " "))}</strong> for this age and sex. Each MET more is worth about 13% lower all-cause mortality in Kodama's pooled 33 studies.`); if (f.due) out.push(`Retest <strong class="${dueTone(f.due)}">${dueWord(f.due)}</strong>: the app's own reminder, eight weeks from the last.`); return out; } },
    { key: "vo2", section: "fitness", label: "VO₂max", unit: "mL/kg/min", sub: "The same tests, in the unit the studies use", daily: false, color: "#f97316",
      science: "/science/fitness/mets-vs-met-h", source: "Estimated from each test; a wearable's own figure is shown in grey in the app and never graded.", fmt: (v) => fmt1(v),
      series: () => crf.filter((c) => c.vo2max != null).map((c) => ({ d: String(c.measured_on), v: Number(c.vo2max), note: methodLabel(c.method) })),
      reads: (pts) => pts.length ? [`<strong class="text-text-primary">${fmt1(pts[pts.length - 1].v)} mL/kg/min</strong> on ${esc(fmtDay(pts[pts.length - 1].d))}. One MET is 3.5 of these; the tiers are drawn in METs.`] : ["No test on file."] },
    // ── movement ──
    { key: "met", section: "movement", label: "MET-hours", unit: "MET-h", sub: "The week's dose of movement", daily: true, sum: true, color: "#f97316",
      science: "/science/movement/weekly-volume", source: "Workouts the app synced, each as Verve read it; background movement is not counted here.", fmt: (v) => fmt1(v),
      series: () => [...days()].map(([d, r]) => ({ d, v: r.met })).sort((a, b) => a.d.localeCompare(b.d)), goal: weeklyGoal,
      reads: () => { const t = todayStr(), m = mondayOf(new Date()); const a = activitySummary(weeks, acts, weeklyGoal(), t, m); const tw = a.thisWeek ? Number(a.thisWeek.met_hours) : 0; const out = [`<strong class="text-text-primary">${fmt1(tw)} of ${weeklyGoal()}</strong> this week${tw >= weeklyGoal() ? ", at goal" : `, ${fmt1(weeklyGoal() - tw)} to go`}${a.streak ? ` · ${a.streak} week${a.streak === 1 ? "" : "s"} at goal in a row` : ""}.`]; if (a.change != null) out.push(`The last four weeks averaged <strong class="text-text-primary">${fmt1(a.recentAvg)}</strong> a week, ${a.change >= 0 ? "up" : "down"} ${Math.round(Math.abs(a.change) * 100)}% on the four before.`); out.push("One MET-hour is an hour at rest; a run earns more than a walk of the same length. The third flag sits well above 150 minutes, and the climb has no top."); return out; } },
    { key: "z2", section: "movement", label: "Zone 2", unit: "min", sub: "Minutes in the personal heart-rate band", daily: true, sum: true, color: "#34d399",
      science: "/science/movement/zone-2", source: "Scored against each day's own band, set from the resting rate and the highest rate the app has seen.", fmt: (v) => round0(v),
      series: () => [...days()].map(([d, r]) => ({ d, v: r.z2 })).sort((a, b) => a.d.localeCompare(b.d)), goal: () => 150,
      reads: (pts) => { const m = mondayOf(new Date()); const wk = pts.filter((p) => p.d >= m).reduce((t, p) => t + p.v, 0); return [`<strong class="text-text-primary">${round0(wk)} of 150 minutes</strong> this week in the band. The target is a weekly dose, not a daily one.`, "The band moves as you do: a morning above your normal resting rate narrows it."]; } },
    { key: "sessions", section: "movement", label: "Workouts", unit: "", sub: "Sessions the app read, by day", daily: true, sum: true, color: "#a5b4fc",
      science: "/science/movement/a-workout", source: "One session is one row; the app keeps what the watch recorded and only reads the rest.", fmt: (v) => round0(v),
      series: () => [...days()].map(([d, r]) => ({ d, v: r.n })).sort((a, b) => a.d.localeCompare(b.d)),
      reads: () => { const a = activitySummary(weeks, acts, weeklyGoal(), todayStr(), mondayOf(new Date())); const kinds = [...a.kinds].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, n]) => `${k} ${Math.round(n / Math.max(1, a.recent.length))}`).join(", "); return [`<strong class="text-text-primary">${Math.round(a.perWeek)} a week</strong> over the last ${a.recent.length} weeks${kinds ? `: ${esc(kinds)}` : ""}.`, `Last workout <strong class="text-text-primary">${a.quietDays == null ? "none on file" : a.quietDays === 0 ? "today" : a.quietDays === 1 ? "yesterday" : `${a.quietDays} days ago`}</strong>.`]; } },
    { key: "vig", section: "movement", label: "Vigorous", unit: "min", sub: "Minutes graded vigorous, by day", daily: true, sum: true, color: "#f87171",
      science: "/science/movement/weekly-volume", source: "Each session graded against the person's own heart-rate reserve, not a population band.", fmt: (v) => round0(v),
      series: () => [...days()].map(([d, r]) => ({ d, v: r.vig })).sort((a, b) => a.d.localeCompare(b.d)),
      reads: () => { const a = activitySummary(weeks, acts, weeklyGoal(), todayStr(), mondayOf(new Date())); return a.minutes ? [`Vigorous share <strong class="text-text-primary">${Math.round((a.vig / a.minutes) * 100)}%</strong> of the last four weeks' minutes.`, "Most of a week easy, one hard day: the shape the endurance literature keeps finding."] : ["No minutes on file yet."]; } },
    { key: "steps", section: "movement", label: "Steps", unit: "", sub: "Every source, one total a day", daily: true, sum: true, avgDay: true, color: "#34d399",
      science: "/science/movement/steps", source: "Apple Health's daily total, watch and phone together, pushed by the app on every sync.", fmt: (v) => Math.round(v).toLocaleString(),
      series: () => signalSeries("steps"),
      reads: () => { const h = heart(); if (!h?.steps.avg) return ["No steps on file yet."]; return [`<strong class="text-text-primary">${h.steps.avg.toLocaleString()} a day</strong> over the last seven${h.steps.prior != null ? `, ${h.steps.avg >= h.steps.prior ? "up" : "down"} from ${h.steps.prior.toLocaleString()} the week before` : ""}.`, "Paluch's 2023 pooled cohorts found the mortality curve flattening around 7,000 to 8,000 a day for adults over 60, higher for younger adults, with the fall steepest from the lowest counts."]; } },
    { key: "strength", section: "movement", label: "Strength", unit: "min", sub: "Minutes of strength work, by day", daily: true, sum: true, color: "#a78bfa",
      science: "/science/movement/strength-training", source: "Sessions the app graded as strength, each as the watch or the person recorded it.", fmt: (v) => round0(v),
      series: () => { const by2 = new Map<string, number>(); for (const a of acts) { if (!a?.timestamp || a.activity_type !== "strength") continue; const d = localDay(a.timestamp); by2.set(d, (by2.get(d) ?? 0) + (Number(a.duration_minutes) || 0)); } return [...by2].map(([d, v]) => ({ d, v })).sort((a, b) => a.d.localeCompare(b.d)); },
      goal: () => 60,
      reads: (pts) => { const m = mondayOf(new Date()); const wk = pts.filter((p) => p.d >= m).reduce((t, p) => t + p.v, 0); return [`<strong class="text-text-primary">${round0(wk)} min</strong> this week, Monday to today, against the cited 60 a week.`]; } },
    { key: "pal", section: "movement", label: "Activity level", unit: "", sub: "The day's energy over the energy at rest, in the app's four bands", daily: true, color: "#34d399",
      science: "/science/movement/activity-level", source: "Worked out on the phone from Apple Health's energy, one figure a day, sent on each sync.", fmt: (v) => v.toFixed(2),
      series: () => signalSeries("pal"),
      companion: "active_kcal",
      rangeReads: (range) => energyRangeReads(range, signals),
      reads: (pts) => { if (!pts.length) return ["No activity level yet: it needs a week of energy data in Apple Health, and an app that sends it."]; const l = pts[pts.length - 1]; const band = l.v < 1.4 ? "sedentary, 1.0 to 1.39" : l.v < 1.6 ? "low active, 1.4 to 1.59" : l.v < 1.9 ? "active, 1.6 to 1.89" : "very active, 1.9 and up"; return [`<strong class="text-text-primary">${l.v.toFixed(2)}</strong> ${l.d === todayStr() ? "today" : `on ${esc(fmtDay(l.d))}`}: ${band}, the same four bands the app's Physical activity level row uses.`]; } },
    { key: "active_kcal", section: "movement", label: "Active energy", unit: "kcal", sub: "Active energy a day, the part of the day's energy that makes the activity level rise", daily: true, color: "#F59E0B",
      science: "/science/movement/activity-level", source: "Apple Health's or Health Connect's active energy, one total a day, sent by the app on each sync, up to five years back.", fmt: (v) => round0(v),
      series: () => signalSeries("active_kcal"),
      reads: (pts) => {
        if (!pts.length) return ["No active energy yet: the app sends it once Back up watch readings is on."];
        const l = pts[pts.length - 1];
        const avgOf = (from: string) => { const xs = pts.filter((p) => p.d > from).map((p) => p.v); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };
        const a7 = avgOf(addDays(todayStr(), -7)), a30 = avgOf(addDays(todayStr(), -30));
        return [
          `<strong class="text-text-primary">${round0(l.v)} kcal</strong> ${l.d === todayStr() ? "today so far" : `on ${esc(fmtDay(l.d))}`}${a7 != null ? `; ${a7} a day over the last 7 days` : ""}${a30 != null ? `, ${a30} over the last 30` : ""}.`,
          "It is the watch's estimate: wrist energy is off by more than 30% in studies, so read the trend and the activity level beside it, not the calorie.",
        ];
      },
      rangeReads: (range) => energyRangeReads(range, signals) },
    { key: "standing", section: "movement", label: "Standing", unit: "min", sub: "Movement balance: minutes on your feet, with a watch", daily: true, color: "#34d399",
      science: "/science/movement/movement-balance", source: "Apple Health's stand minutes, one total a day, sent by the app on each sync.", fmt: (v) => round0(v),
      series: () => signalSeries("standing_minutes"),
      reads: (pts) => pts.length ? [`<strong class="text-text-primary">${round0(pts[pts.length - 1].v)} min</strong> standing ${pts[pts.length - 1].d === todayStr() ? "today" : `on ${esc(fmtDay(pts[pts.length - 1].d))}`}; the other side of the day is Sitting, beside this.`] : ["No standing minutes yet: a watch writes them, and the app sends them."] },
    { key: "sitting", section: "movement", label: "Sitting", unit: "h", sub: "Movement balance: hours seated, from the day's energy", daily: true, color: "#f87171",
      science: "/science/movement/movement-balance", source: "The app's own reading of the day's sedentary hours, sent on each sync.", fmt: (v) => fmt1(v),
      series: () => signalSeries("sedentary_minutes").map((p) => ({ d: p.d, v: p.v / 60 })),
      reads: (pts) => pts.length ? [`<strong class="text-text-primary">${fmt1(pts[pts.length - 1].v)} h</strong> seated ${pts[pts.length - 1].d === todayStr() ? "today" : `on ${esc(fmtDay(pts[pts.length - 1].d))}`}. The app marks more than eight as a long day and more than ten as a very long one.`] : ["No sitting hours yet: the app reads them from the day's energy and sends them."] },
    { key: "cadence", section: "movement", label: "Cadence", unit: "spm", sub: "The day's best thirty minutes, steps a minute", daily: true, color: "#34d399",
      science: "/science/movement/steps", source: "Apple Health's walking cadence, the day's best half hour, sent by the app on each sync.", fmt: (v) => round0(v),
      series: () => signalSeries("cadence_spm"),
      reads: (pts) => pts.length ? [`<strong class="text-text-primary">${round0(pts[pts.length - 1].v)} steps a minute</strong> for the best thirty minutes ${pts[pts.length - 1].d === todayStr() ? "today" : `on ${esc(fmtDay(pts[pts.length - 1].d))}`}; a hundred is the brisk line the app cites.`] : ["No cadence yet: a watch or phone in the pocket writes it, and the app sends it."] },
    // ── sleep & heart ──
    { key: "rhr", section: "heart", label: "Resting heart rate", unit: "bpm", sub: "Every morning, against your own normal", daily: true, color: "#818cf8",
      science: "/science/sleep-heart/resting-heart-rate", source: "Apple's one figure per day, from heart rate during stillness, weighted to sleep and the early morning.", fmt: (v) => round0(v),
      series: () => signalSeries("resting_hr"), band: () => ownBand(signalSeries("resting_hr"), 5, "the median of the prior 30 mornings, five either side"),
      reads: () => { const h = heart(); if (!h?.rhr.latest) return ["No resting heart rate on file yet."]; const r = h.rhr; const out = [`<strong class="text-text-primary">${r.latest} bpm</strong> ${esc(dayWord(r.latestDay!))}${r.baseline != null ? `, ${r.delta === 0 ? "at" : `${Math.abs(r.delta!)} ${r.delta! > 0 ? "above" : "below"}`} the median of the ${r.priors} mornings before${r.status === "elevated" ? `: <span class="text-warning">elevated</span>` : r.status === "stronglyElevated" ? `: <span class="text-danger">strongly elevated</span>` : ""}` : `; a normal needs 14 mornings, ${r.priors} so far`}.`]; out.push(r.run > 1 ? `<strong class="text-text-primary">${r.run} mornings running</strong> above the band. One is noise; three is a pattern. It says nothing about why: a late meal, heat, hard training and a cold all do this.` : `Inside the band ${r.inBand} of the last ${r.read} mornings read.`); if (r.level) out.push(`Absolute level <strong class="text-text-primary">${r.level}</strong> on the ARIC bands: a reading aid for a graded association, not a diagnosis.`); return out; } },
    { key: "sleep", section: "heart", label: "Sleep", unit: "", sub: "Time asleep, the night that ended each morning", daily: true, color: "#a5b4fc",
      science: "/science/sleep-heart/sleep-rhythm", source: "Every writer's asleep intervals; the stages from one elected writer per night.", fmt: (v) => fmtHM(v),
      series: () => signalSeries("sleep_minutes"), band: () => ({ lo: 420, hi: 540, why: "7 to 9 hours, the adult band" }),
      reads: () => { const h = heart(); if (!h?.sleep.last) return ["No night on file yet."]; const s = { ...h.sleep, last: h.sleep.last }; return [`<strong class="text-text-primary">${fmtSleepMin(s.last.min)}</strong> ${esc(dayWord(s.last.day))}${s.usual != null ? `, ${Math.abs(s.last.min - s.usual) < 20 ? "about the usual" : `${fmtSleepMin(Math.abs(s.last.min - s.usual))} ${s.last.min < s.usual ? "under" : "over"} the usual ${fmtSleepMin(s.usual)}`}` : ""}${s.last.bed ? ` · in bed ${esc(s.last.bed)}` : ""}.`, `${s.shortNights} of the last ${s.nights} nights under 7 h. A move toward the band is the improvement, not more sleep without limit.`]; } },
    { key: "hrr", section: "heart", label: "Heart rate recovery", unit: "bpm", sub: "The drop in the minute after a workout", daily: true, color: "#818cf8",
      science: "/science/sleep-heart/heart-rate-recovery", source: "Apple's stored one-minute recovery after each workout; for a workout without one, the rate at the end minus the rate a minute later, marked derived.", fmt: (v) => round0(v),
      series: () => signalSeries("hrr_bpm"),
      reads: () => { const h = heart(); if (!h || h.hrr.latest == null) return ["No recovery on file: the watch records one after a workout that ends above the Zone 2 floor."]; return [`<strong class="${h.hrr.latest <= 12 ? "text-danger" : "text-text-primary"}">${h.hrr.latest} bpm</strong> ${esc(dayWord(h.hrr.latestDay!))}${h.hrr.median != null ? `, own 30-day median ${h.hrr.median}` : ""}.`, h.hrr.latest <= 12 ? `<span class="text-danger">At or under the one cited line, 12 bpm</span> (Cole 1999). Worth a conversation if it stays there; one reading is not.` : "Above the one cited line, 12 bpm. There is no validated \"good\" threshold, so no verdict word above it."]; } },
    { key: "hrv", section: "heart", label: "Night HRV", unit: "ms", sub: "One writer's nights, against your own middle half", daily: true, color: "#818cf8",
      science: "/science/sleep-heart/night-hrv", source: "The median of the HRV samples inside each night's sleep window, from the most recent writer only; the writer and its method are on the card.", fmt: (v) => round0(v),
      series: () => { const rows = signals.filter((r) => r.hrv_night_ms != null); const w = rows[rows.length - 1]?.hrv_source ?? null; return rows.filter((r) => (r.hrv_source ?? null) === w).map((r) => ({ d: String(r.day), v: Number(r.hrv_night_ms), note: `${String(r.hrv_source ?? "unknown writer")} · ${r.hrv_method === "sdnn" ? "SDNN" : r.hrv_method === "rmssd" ? "rMSSD" : "method undeclared"}` })); },
      band: () => { const h = heart(); return h?.hrv.band ? { lo: h.hrv.band.lo, hi: h.hrv.band.hi, why: `the middle half of the last ${h.hrv.priors} nights from ${h.hrv.writer}` } : null; },
      rangeReads: (range, year) => {
        const h = heart(); if (!h || h.hrv.latest == null) return [];
        if (range === "months") {
          const ms = h.hrv.months.filter((m) => m.mean != null);
          if (!ms.length) return [];
          const word = (m: typeof ms[number]) => `<strong class="text-text-primary">${esc(m.label)}</strong> ${m.mean} ms${m.meanStatus && m.meanStatus !== "inside" ? ` <span class="${m.meanStatus === "below" ? "text-warning" : "text-success-light"}">${m.meanStatus}</span>` : ""} · scatter ${Math.round(m.cv!)}%${m.scatterStatus && m.scatterStatus !== "usual" ? ` <span class="${m.scatterStatus === "unsettled" ? "text-warning" : "text-success-light"}">${m.scatterStatus}</span>` : ""} · ${m.nights} night${m.nights === 1 ? "" : "s"}`;
          return [`Month by month, newest first, from ${esc(h.hrv.writer ?? "one writer")}: ${ms.map(word).join("; ")}.`, "Each month's mean is read against the middle half of your own 6 months before it, and its scatter against theirs: below, above, unsettled and settled are relative to you, never to a population. A month with under 3 nights is left out."];
        }
        if (range === "years") {
          const ys = year != null ? h.hrv.years.filter((y) => y.year === year) : h.hrv.years;
          if (!ys.length) return [];
          return [`Year by year: ${ys.map((y) => `<strong class="text-text-primary">${y.year}</strong> median ${y.median} ms over ${y.nights} night${y.nights === 1 ? "" : "s"}${y.months >= 2 && y.lowMonth != null ? `, months from ${y.lowMonth} to ${y.highMonth} ms` : ""}`).join("; ")}.`, "A year's median is a long baseline, not a verdict: HRV falls slowly with age in everyone, so compare a year with the one before it, not with anyone else's."];
        }
        return [];
      },
      reads: () => { const h = heart(); if (!h || h.hrv.latest == null) return [h?.hrv.absent ? "No HRV reaches Apple Health from this wearable." : "No night HRV on file yet: Apple Watch writes it, and the app sends the night's median on each sync."]; const v = h.hrv; const out = [`<strong class="${v.below ? "text-warning" : "text-text-primary"}">${v.latest} ms</strong> ${esc(dayWord(v.latestDay!))}, ${esc(v.writer ?? "")} · ${v.method === "sdnn" ? "SDNN" : v.method === "rmssd" ? "rMSSD" : "method undeclared"}${v.band ? `, against ${v.band.lo}–${v.band.hi}, the middle half of the last ${v.priors} nights${v.below ? ": <span class=\"text-warning\">under the band</span>" : ""}` : `; a band needs 7 nights from this writer, ${v.priors} so far`}.`]; if (v.otherWriters.length) out.push(`${esc(v.otherWriters.join(", "))} also wrote HRV in the last 30 nights with data. Only ${esc(v.writer ?? "the latest writer")}'s nights are read, never mixed: two methods are two different numbers.`); if (v.mean7) out.push(`<strong class="text-text-primary">7-night mean ${v.mean7.ms} ms</strong>${v.mean7.status ? `, ${v.mean7.status} the band` : ""}${v.mean7.settled ? "" : ` (${v.mean7.nights} of 7 nights)`}. One night is a night; the mean is the reading to act on.`); const wk = v.weeks.filter((w) => w.cv != null); if (wk.length) out.push(`Scatter, the week's spread around its own mean, newest first: ${wk.map((w) => `<strong class="text-text-primary">${Math.round(w.cv!)}%</strong>${w.status ? ` ${w.status === "usual" ? "usual" : w.status}` : ""}`).join(" · ")}${wk[0].usualCv != null ? `; your usual ${Math.round(wk[0].usualCv)}%` : ""}. It is read against your own prior weeks only, and it widens before the mean falls.`); out.push(v.run > 1 ? `<strong class="text-text-primary">${v.run} nights running</strong> below the band. One is a night; a pattern needs resting rate and recovery to agree${h.threeTogether ? ", <span class=\"text-warning\">and for the last 3 readings of each, they do</span>" : ", and they do not yet"}.` : "HRV spans a fivefold range between healthy people and falls with age, so there is no population figure here: only your own nights."); return out; } },
    // ── body ──
    { key: "waist_cm", section: "body", group: "metabolic", label: "Waist", unit: "cm", sub: "The measure that stands in for the fat that matters", daily: false, color: "#FBBF24",
      science: "/science/body/body-phenotyping", source: "Measured in the app or read from a report; the app's row wins on the same day.", fmt: (v) => fmt1(v),
      series: () => sparseFrom("waist_cm"),
      reads: (pts) => { if (!pts.length) return ["No waist on file."]; const l = pts[pts.length - 1], h = Number(profile?.height_cm) || null; const out = [`<strong class="text-text-primary">${fmt1(l.v)} cm</strong> on ${esc(fmtDay(l.d))}${pts.length > 1 ? `, ${l.v === pts[0].v ? "the same as" : `${fmt1(Math.abs(l.v - pts[0].v))} cm ${l.v < pts[0].v ? "less than" : "more than"}`} the first on ${esc(fmtDay(pts[0].d))}` : ""}.`]; if (h) out.push(`Waist-to-height <strong class="text-text-primary">${(l.v / h).toFixed(2)}</strong> at ${h} cm; the screening line is 0.5.`); return out; } },
    { key: "weight", section: "body", group: "metabolic", label: "Weight", unit: "kg", sub: "Every weighing, from Apple Health or Settings", daily: true, color: "#FBBF24",
      science: "/science/body/body-phenotyping", source: "Apple Health's weighings and the weight typed in Settings, one row a day a source; a day with both keeps Health's.", fmt: (v) => fmt1(v),
      series: () => weighings(),
      band: () => ownBand(weighings(), 1, "within a kilo of your own 30-day median"),
      reads: (pts) => { if (!pts.length) return ["No weighing yet. The app sends Apple Health's weighings, and the weight in Settings, once it learns to."]; const l = pts[pts.length - 1]; const ago = pts.filter((p) => p.d >= addDays(l.d, -28) && p.d < l.d); const first = ago[0] ?? null; return [`<strong class="text-text-primary">${fmt1(l.v)} kg</strong> ${l.d === todayStr() ? "today" : `on ${esc(fmtDay(l.d))}`}${first ? `, ${Math.abs(l.v - first.v) < 0.05 ? "the same as" : `${l.v < first.v ? "down" : "up"} ${fmt1(Math.abs(l.v - first.v))} kg from`} four weeks ago` : ""}. ${pts.length} weighing${pts.length === 1 ? "" : "s"} on file.`]; } },
    { key: "bmi", section: "body", group: "metabolic", label: "BMI", unit: "", sub: "Weight against height, the number every report asks for", daily: true, color: "#FBBF24",
      science: "/science/body/body-phenotyping", source: "Worked out here from each weighing and the height on the profile, never stored, so it cannot disagree with the weight.", fmt: (v) => fmt1(v),
      series: () => { const h = Number(profile?.height_cm) || 0; if (!(h > 0)) return []; const m = h / 100; return weighings().map((p) => ({ d: p.d, v: p.v / (m * m) })); },
      reads: (pts) => { const h = Number(profile?.height_cm) || 0; if (!(h > 0)) return ["BMI needs a height on the profile; the app's Settings takes it."]; if (!pts.length) return ["No weighing yet, so no BMI."]; const l = pts[pts.length - 1]; const band = l.v < 18.5 ? "under the 18.5 line" : l.v < 25 ? "in the 18.5 to 24.9 band" : l.v < 30 ? "in the 25 to 29.9 band, overweight by the WHO's general cut-offs" : "at or over 30, obese by the WHO's general cut-offs"; const w = weighings(); return [`<strong class="text-text-primary">${fmt1(l.v)}</strong> from ${fmt1(w[w.length - 1].v)} kg at ${h} cm: ${band}. For South Asian adults the WHO's action points sit lower, at 23 and 27.5. Waist to height is Verve's first ratio for the fat that matters; BMI moves with muscle as much as fat.`]; } },
    { key: "body_fat_pct", section: "body", group: "muscle", label: "Body fat", unit: "%", sub: "Composition, by whichever method the report used", daily: false, color: "#FBBF24", science: "/science/body/body-phenotyping", source: "From a body-composition report or the app.", fmt: (v) => fmt1(v), series: () => sparseFrom("body_fat_pct"), reads: (pts) => pts.length ? [`<strong class="text-text-primary">${fmt1(pts[pts.length - 1].v)}%</strong> on ${esc(fmtDay(pts[pts.length - 1].d))}. Methods differ; compare only within one.`] : ["No body fat on file."] },
    { key: "skel_musc_pct", section: "body", group: "muscle", label: "Skeletal muscle", unit: "%", sub: "Muscle as a share of weight", daily: false, color: "#FBBF24", science: "/science/body/muscle-health", source: "From a body-composition report or the app.", fmt: (v) => fmt1(v), series: () => sparseFrom("skel_musc_pct"), reads: (pts) => pts.length ? [`<strong class="text-text-primary">${fmt1(pts[pts.length - 1].v)}%</strong> on ${esc(fmtDay(pts[pts.length - 1].d))}.`] : ["No muscle mass on file."] },
    { key: "handgrip_kg", section: "body", group: "muscle", label: "Grip strength", unit: "kg", sub: "Why grip is in a fitness app at all", daily: false, color: "#FBBF24", science: "/science/body/muscle-health", source: "The app's grip test, or a report.", fmt: (v) => fmt1(v), series: () => sparseFrom("handgrip_kg"), reads: (pts) => { if (!pts.length) return ["No grip test on file."]; const cut = String(profile?.sex ?? "") === "female" ? 16 : 27; const l = pts[pts.length - 1]; return [`<strong class="text-text-primary">${fmt1(l.v)} kg</strong> on ${esc(fmtDay(l.d))}, <span class="${l.v >= cut ? "text-success-light" : "text-warning"}">${l.v >= cut ? "above" : "below"} the EWGSOP2 cut-off of ${cut}</span>.`]; } },
    { key: "chair_stand_seconds", section: "body", group: "muscle", label: "Chair stand", unit: "s", sub: "Five rises, timed", daily: false, color: "#FBBF24", science: "/science/body/intrinsic-capacity", source: "The app's chair-stand test.", fmt: (v) => fmt1(v), series: () => sparseFrom("chair_stand_seconds"), reads: (pts) => pts.length ? [`<strong class="text-text-primary">${fmt1(pts[pts.length - 1].v)} s</strong>, <span class="${pts[pts.length - 1].v <= 15 ? "text-success-light" : "text-warning"}">${pts[pts.length - 1].v <= 15 ? "under" : "over"} the 15-second line</span>.`] : ["No chair stand on file."] },
    { key: "gait_speed_ms", section: "body", group: "muscle", label: "Walk speed", unit: "m/s", sub: "Usual pace over a short course", daily: false, color: "#FBBF24", science: "/science/body/intrinsic-capacity", source: "The app's walk test.", fmt: (v) => v.toFixed(2), series: () => sparseFrom("gait_speed_ms"), reads: (pts) => pts.length ? [`<strong class="text-text-primary">${pts[pts.length - 1].v.toFixed(2)} m/s</strong>, <span class="${pts[pts.length - 1].v >= 0.8 ? "text-success-light" : "text-warning"}">${pts[pts.length - 1].v >= 0.8 ? "above" : "below"} 0.8</span>.`] : ["No walk speed on file."] },
    { key: "single_leg_balance_seconds", section: "body", group: "muscle", label: "Single-leg balance", unit: "s", sub: "How long one leg holds", daily: false, color: "#FBBF24", science: "/science/body/intrinsic-capacity", source: "The app's balance test.", fmt: (v) => round0(v), series: () => sparseFrom("single_leg_balance_seconds"), reads: (pts) => pts.length ? [`<strong class="text-text-primary">${round0(pts[pts.length - 1].v)} s</strong>, <span class="${pts[pts.length - 1].v >= 10 ? "text-success-light" : "text-warning"}">${pts[pts.length - 1].v >= 10 ? "held past" : "under"} 10 seconds</span>.`] : ["No balance test on file."] },
    // ── the rest of the app's 21, on the same three shelves ──
    labMarker("glucose_mgdl", "metabolic", "Fasting glucose", "mg/dL", "The morning figure the metabolic criteria start with", "/science/body/body-phenotyping"),
    labMarker("hba1c_pct", "metabolic", "HbA1c", "%", "Three months of glucose in one number", "/science/body/body-phenotyping"),
    labMarker("bp", "metabolic", "Blood pressure", "mmHg", "Systolic over diastolic, the 120 and 80 lines", "/science/body/heart-health", {
      series: () => sparseFrom("sbp"),
      pointLabel: (p) => { const d = dbpOn(p.d); return d ? `${round0(p.v)}/${round0(d.v)}` : round0(p.v); },
      fmt: (v) => round0(v),
      reads: (pts) => { if (!pts.length) return ["No blood pressure on file."]; const l = pts[pts.length - 1], d = dbpOn(l.d); return [`<strong class="text-text-primary">${round0(l.v)}${d ? `/${round0(d.v)}` : ""} mmHg</strong> on ${esc(fmtDay(l.d))}. The chart follows the systolic figure; <span class="${l.v < 120 && (!d || d.v < 80) ? "text-success-light" : "text-warning"}">${l.v < 120 && (!d || d.v < 80) ? "under" : "at or over"} the 120 and 80 lines</span>. The app's bands, AHA or ESC, are on Labs.`]; } }),
    labMarker("triglycerides_mgdl", "metabolic", "Triglycerides", "mg/dL", "The fat in the blood after fasting", "/science/body/body-phenotyping"),
    labMarker("hdl_mgdl", "metabolic", "HDL", "mg/dL", "The one lipid where higher is the better side", "/science/body/body-phenotyping"),
    labMarker("post_meal_glucose_mgdl", "metabolic", "Post-meal glucose", "mg/dL", "Two hours after eating", "/science/body/body-phenotyping"),
    labMarker("fasting_insulin_uiuml", "metabolic", "Fasting insulin", "uIU/mL", "How hard the pancreas works at rest", "/science/body/body-phenotyping"),
    labMarker("apo_b_mgdl", "heart", "ApoB", "mg/dL", "A count of the particles that carry cholesterol into artery walls", "/science/body/heart-health"),
    labMarker("ldl_mgdl", "heart", "LDL", "mg/dL", "The cholesterol most guidelines treat to a target", "/science/body/heart-health"),
    labMarker("lpa_value", "heart", "Lp(a)", "", "Set by your genes, measured once", "/science/body/heart-health"),
    labMarker("hs_crp_mgl", "heart", "hs-CRP", "mg/L", "Low-grade inflammation, the heart's quiet risk", "/science/body/heart-health"),
    labMarker("alm_kg", "muscle", "Lean mass, arms and legs", "kg", "The muscle that moves you, from a DXA or bioimpedance", "/science/body/muscle-health"),
    labMarker("ffm_kg", "muscle", "Whole-body lean mass", "kg", "Everything that is not fat", "/science/body/muscle-health"),
    labMarker("sppb_score", "muscle", "SPPB", "of 12", "Balance, walk and chair stand, scored the way the app scores them", "/science/body/intrinsic-capacity", {
      source: "Computed from the app's three tests on the same day, never stored; balance held up to ten seconds, the walk timed over four metres, five rises from a chair.",
      series: () => sppbSeries(app), fmt: (v) => round0(v),
      reads: (pts) => { if (!pts.length) return ["No full battery on file: the three tests on one day score it."]; const l = pts[pts.length - 1]; const cat = l.v <= 6 ? "poor" : l.v <= 9 ? "intermediate" : "good"; return [`<strong class="text-text-primary">${round0(l.v)} of 12</strong> on ${esc(fmtDay(l.d))}${l.note ? ` (${esc(l.note)})` : ""}: <span class="${cat === "good" ? "text-success-light" : "text-warning"}">${cat}</span>, where 10 to 12 is good, 7 to 9 intermediate and 6 or under poor.`]; } }),
  ];
}

/**
 * Months and years for activity level and active energy together, from the
 * daily rows: each period's PAL is the mean of its days' 7-day PAL, its
 * active energy the mean of its days', and its band the app's four. The
 * same reading on both markers, so the two cannot disagree.
 */
function energyRangeReads(range: Rng, signals: any[]): string[] {
  if (range !== "months" && range !== "years") return [];
  const rows = signals.filter((r) => r.pal != null || r.active_kcal != null);
  if (!rows.length) return [];
  const band = (v: number) => (v < 1.4 ? "Sedentary" : v < 1.6 ? "Low Active" : v < 1.9 ? "Active" : "Very Active");
  const keyOf = (d: string) => (range === "months" ? d.slice(0, 7) : d.slice(0, 4));
  const groups = new Map<string, { pal: number[]; act: number[] }>();
  for (const r of rows) { const k = keyOf(String(r.day)); const g = groups.get(k) ?? { pal: [], act: [] }; if (r.pal != null) g.pal.push(Number(r.pal)); if (r.active_kcal != null) g.act.push(Number(r.active_kcal)); groups.set(k, g); }
  const keys = [...groups.keys()].sort().reverse().slice(0, range === "months" ? 12 : 5);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const label = (k: string) => (range === "months" ? new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : k);
  const parts = keys.map((k) => { const g = groups.get(k)!; const p = mean(g.pal), a = mean(g.act); return `<strong class="text-text-primary">${esc(label(k))}</strong> ${p != null ? `${p.toFixed(2)} ${band(p)}` : "no PAL"}${a != null ? ` · ${Math.round(a)} kcal active a day` : ""}`; });
  return [`${range === "months" ? "Month by month" : "Year by year"}, newest first: ${parts.join("; ")}.`, "Each period's activity level is the average of its days' seven-day readings; the bands are the app's four."];
}

// ── one range of one marker: the points to draw, the headline, the caption ──
export type Drawn = { pts: { x: string; v: number | null; tone?: string; note?: string }[]; headline: string; caption: string; labelEvery: number; goalLine?: number | null; monthLabels?: boolean };
export function drawnFor(m: Marker, range: Rng, year: number | null = null): Drawn | null {
  const all = m.series();
  if (!all.length) return null;
  const t = todayStr();
  const by = new Map(all.map((p) => [p.d, p.v]));
  const summing = !!m.sum && !((range === "months" || range === "years") && m.avgDay);
  const agg = (from: string, to: string) => { const xs = all.filter((p) => p.d >= from && p.d <= to).map((p) => p.v); return xs.length ? (summing ? xs.reduce((a, b) => a + b, 0) : xs.reduce((a, b) => a + b, 0) / xs.length) : null; };
  const band = m.band?.() ?? null;
  const toneOf = (v: number | null) => v == null ? "" : band ? (v > band.hi ? "warn" : v < band.lo ? "low" : "") : "";
  if (year != null && m.daily) {
    // one year, month by month: the Years lens with a year chosen
    const nowY = new Date().getFullYear(), nowM = new Date().getMonth();
    const pts = []; for (let mo = 0; mo < 12; mo++) { const from = `${year}-${String(mo + 1).padStart(2, "0")}-01`, to = new Date(year, mo + 1, 0).toLocaleDateString("en-CA"); const future = year > nowY || (year === nowY && mo > nowM); pts.push({ x: from, v: future ? null : agg(from, to), tone: year === nowY && mo === nowM ? "today" : "" }); }
    const have = pts.filter((p) => p.v != null).map((p) => p.v!);
    const val = have.length ? (summing ? have.reduce((a, b) => a + b, 0) : have.reduce((a, b) => a + b, 0) / have.length) : null;
    return { pts, headline: val != null ? m.fmt(val) : "—", caption: `${m.unit ? `${m.unit} ` : ""}${summing ? `over ${year}, month by month` : `a day, averaged over ${year}, month by month`}`, labelEvery: 1, goalLine: null, monthLabels: true };
  }
  if (year != null) {
    // a sparse marker: the readings of one year
    const sel = all.filter((p) => p.d.startsWith(`${year}-`));
    const pts = sel.map((p) => ({ x: p.d, v: p.v, note: p.note, tone: toneOf(p.v) }));
    const l = sel[sel.length - 1] ?? null;
    return { pts, headline: l ? (m.pointLabel ? m.pointLabel(l) : m.fmt(l.v)) : "—", caption: l ? `${m.unit ? `${m.unit}, ` : ""}${sel.length} reading${sel.length === 1 ? "" : "s"} in ${year}, latest ${esc(fmtDay(l.d))}` : `nothing read in ${year}`, labelEvery: 1, goalLine: null };
  }
  if (range === "week") {
    const start = mondayOf(new Date());
    const pts = []; for (let d = start, i = 0; i < 7; d = addDays(d, 1), i++) { const v = by.has(d) ? by.get(d)! : null; pts.push({ x: d, v, tone: d === t ? "today" : toneOf(v) }); }
    const latest = [...all].reverse().find((p) => p.d <= t) ?? null;
    const inRangePts = pts.filter((p) => p.v != null).map((p) => p.v!);
    const total = inRangePts.reduce((a, b) => a + b, 0);
    const goal = m.goal?.() ?? null;
    const headline = m.sum ? m.fmt(total) : latest ? m.fmt(latest.v) : "—";
    const caption = m.sum ? (goal != null ? `of ${m.fmt(goal)}${m.unit ? ` ${m.unit}` : ""} this week, Monday to today` : `${m.unit ? `${m.unit} ` : ""}this week so far`) : `${inRangePts.length ? `${m.fmt(inRangePts.reduce((a, b) => a + b, 0) / inRangePts.length)} ${m.unit} average this week, ` : ""}${latest ? `latest ${esc(dayWord(latest.d))}` : ""}`;
    return { pts, headline, caption, labelEvery: 1, goalLine: null };
  }
  if (range === "4w") {
    // four bars, one a week, Monday to Sunday, this week unfinished: a week's
    // total for a marker that adds up, a day's average for one that is read
    const thisMon = mondayOf(new Date());
    const pts = []; for (let i = 3; i >= 0; i--) { const from = addDays(thisMon, -7 * i); const v = agg(from, addDays(from, 6)); pts.push({ x: from, v, tone: i === 0 ? "today" : toneOf(v) }); }
    const have = pts.filter((p) => p.v != null).map((p) => p.v!);
    const val = have.length ? have.reduce((a, b) => a + b, 0) / have.length : null;
    return { pts, headline: val != null ? m.fmt(val) : "—", caption: `${m.unit ? `${m.unit} ` : ""}${summing ? "a week, averaged over the last four, this week so far included" : "a day, averaged over the last four weeks"}`, labelEvery: 1, goalLine: null };
  }
  if (range === "months") {
    const pts = []; const now = new Date();
    for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const from = d.toLocaleDateString("en-CA"), to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString("en-CA"); const v = agg(from, to); pts.push({ x: from, v, tone: i === 0 ? "today" : toneOf(v) }); }
    const have = pts.filter((p) => p.v != null).map((p) => p.v!);
    const yearVal = summing ? have.reduce((a, b) => a + b, 0) : have.length ? have.reduce((a, b) => a + b, 0) / have.length : null;
    return { pts, headline: yearVal != null ? m.fmt(yearVal) : "—", caption: `${m.unit ? `${m.unit} ` : ""}${summing ? "over the last twelve months, month by month" : "a day, averaged over the last twelve months"}`, labelEvery: 1, goalLine: null };
  }
  if (range === "years") {
    // one bar a year, from the first year on file to this one, this year unfinished
    const y1 = new Date().getFullYear(), y0 = Math.min(y1, Number(all[0].d.slice(0, 4)) || y1);
    const pts = []; for (let y = y0; y <= y1; y++) { const v = agg(`${y}-01-01`, `${y}-12-31`); pts.push({ x: `${y}-01-01`, v, tone: y === y1 ? "today" : toneOf(v) }); }
    const have = pts.filter((p) => p.v != null).map((p) => p.v!);
    const val = have.length ? (summing ? have.reduce((a, b) => a + b, 0) : have.reduce((a, b) => a + b, 0) / have.length) : null;
    return { pts, headline: val != null ? m.fmt(val) : "—", caption: `${m.unit ? `${m.unit} ` : ""}${summing ? "over every year on file, this year so far included" : "a day, averaged over every year on file"}`, labelEvery: 1, goalLine: null };
  }
  // sparse: six months, a year, everything
  const from = range === "6m" ? addDays(t, -182) : range === "1y" ? addDays(t, -365) : "0000";
  const sel = all.filter((p) => p.d >= from);
  const pts = sel.map((p) => ({ x: p.d, v: p.v, note: p.note, tone: toneOf(p.v) }));
  const l = sel[sel.length - 1] ?? null;
  return { pts, headline: l ? (m.pointLabel ? m.pointLabel(l) : m.fmt(l.v)) : "—", caption: l ? `${m.unit ? `${m.unit}, ` : ""}latest ${esc(fmtDay(l.d))}${sel.length > 1 ? ` · ${sel.length} readings${sel[0].v !== l.v ? `, ${l.v > sel[0].v ? "up" : "down"} ${m.fmt(Math.abs(l.v - sel[0].v))} since ${esc(fmtDay(sel[0].d))}` : ""}` : ""}` : "nothing in this range", labelEvery: Math.max(1, Math.ceil(sel.length / 8)), goalLine: null };
}

/** The chart of one range, as the inner markup of an 820×200 SVG. */
export function chartSvg(m: Marker, range: Rng, dr: Drawn): string {
  const W = 820, H = 200, L = 34, R = 20, T = 18, B = 34;
  const band = m.daily && range === "week" ? (m.band?.() ?? null) : null;
  const weekGoal = range === "week" && m.goal?.() ? m.goal()! : null;
  const vals = dr.pts.map((p) => p.v).filter((v): v is number => v != null);
  if (!vals.length) return `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#64748b" font-size="13">Nothing read in this range.</text>`;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (band) { lo = Math.min(lo, band.lo); hi = Math.max(hi, band.hi); }
  const bars = !!m.sum;
  if (bars) lo = 0; else { const pad = Math.max((hi - lo) * 0.15, 1); lo -= pad; hi += pad; }
  if (hi === lo) hi = lo + 1;
  const n = dr.pts.length, slot = (W - L - R) / Math.max(1, n);
  const xf = (i: number) => L + slot * (i + 0.5);
  const yf = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let s = "";
  if (band) s += `<rect x="${L}" y="${yf(band.hi).toFixed(1)}" width="${W - L - R}" height="${(yf(band.lo) - yf(band.hi)).toFixed(1)}" fill="rgba(52,211,153,0.12)"/><text x="${W - R + 3}" y="${(yf(band.hi) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${m.fmt(band.hi)}</text><text x="${W - R + 3}" y="${(yf(band.lo) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${m.fmt(band.lo)}</text>`;
  s += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="rgba(255,255,255,0.12)"/>`;
  if (!bars) s += `<text x="4" y="${(yf(hi) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${m.fmt(hi)}</text><text x="4" y="${(yf(lo) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${m.fmt(lo)}</text>`;
  if (weekGoal != null && m.sum) {
    // the week's running total against the goal, dashed; the goal line above
    const gy = yf(Math.min(weekGoal, hi)); if (weekGoal <= hi) s += `<line x1="${L}" y1="${gy.toFixed(1)}" x2="${W - R}" y2="${gy.toFixed(1)}" stroke="#a5b4fc" stroke-opacity="0.6" stroke-dasharray="4 4"/><text x="${W - R}" y="${(gy - 5).toFixed(1)}" text-anchor="end" fill="#a5b4fc" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">GOAL ${m.fmt(weekGoal)}</text>`;
    let run = 0; const rp: string[] = [];
    dr.pts.forEach((p, i) => { if (p.v == null && p.x > todayStr()) return; run += p.v ?? 0; rp.push(`${xf(i).toFixed(1)},${yf(Math.min(run, hi)).toFixed(1)}`); });
    if (rp.length > 1) s += `<polyline points="${rp.join(" ")}" fill="none" stroke="#a5b4fc" stroke-width="1.5" stroke-dasharray="3 4" stroke-opacity="0.8"/>`;
  }
  const color = m.color;
  if (bars) {
    const bw = Math.min(46, slot * 0.62);
    dr.pts.forEach((p, i) => {
      if (p.v == null) { if (p.x <= todayStr()) s += `<rect x="${(xf(i) - bw / 2).toFixed(1)}" y="${H - B - 3}" width="${bw.toFixed(1)}" height="3" rx="1.5" fill="rgba(255,255,255,0.08)"/>`; return; }
      const y = yf(p.v), hgt = Math.max(2, H - B - y);
      s += `<rect x="${(xf(i) - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" rx="3" fill="${color}" fill-opacity="${p.tone === "today" ? 1 : 0.6}"><title>${esc(fmtDay(p.x))}: ${m.fmt(p.v)} ${m.unit}</title></rect>`;
      if (n <= 14 && p.v > 0) s += `<text x="${xf(i).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" fill="#f1f5f9" font-size="11" font-weight="700">${m.fmt(p.v)}</text>`;
    });
  } else {
    const have = dr.pts.map((p, i) => ({ p, i })).filter(({ p }) => p.v != null);
    if (have.length > 1) s += `<polyline points="${have.map(({ p, i }) => `${xf(i).toFixed(1)},${yf(p.v!).toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-opacity="0.8" stroke-width="1.8"/>`;
    for (const { p, i } of have) {
      const fill = p.tone === "warn" ? "#FBBF24" : p.tone === "low" ? "#94a3b8" : color;
      s += `<circle cx="${xf(i).toFixed(1)}" cy="${yf(p.v!).toFixed(1)}" r="${n <= 14 ? 5.5 : 3.5}" fill="${fill}" stroke="#0D0D1C" stroke-width="1.5"><title>${esc(fmtDay(p.x))}: ${m.fmt(p.v!)} ${m.unit}${p.note ? ` · ${esc(p.note)}` : ""}</title></circle>`;
      if (n <= 14) s += `<text x="${xf(i).toFixed(1)}" y="${(yf(p.v!) - 11).toFixed(1)}" text-anchor="middle" fill="${p.tone === "warn" ? "#FBBF24" : "#c7d2fe"}" font-size="11" font-weight="700">${m.fmt(p.v!)}</text>`;
    }
  }
  const label = (x: string) => (range === "months" || dr.monthLabels) ? new Date(x + "T00:00:00").toLocaleDateString(undefined, { month: "short" }).toUpperCase() : range === "week" ? new Date(x + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }).toUpperCase() : range === "4w" ? new Date(x + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase() : range === "years" ? x.slice(0, 4) : new Date(x + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "2-digit" }).toUpperCase();
  dr.pts.forEach((p, i) => { if (i % dr.labelEvery === 0 || i === n - 1) s += `<text x="${xf(i).toFixed(1)}" y="${H - B + 16}" text-anchor="middle" fill="${p.tone === "today" ? "#f1f5f9" : "#94a3b8"}" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${label(p.x)}</text>`; });
  return s;
}

/** Up to three other daily markers on the same seven days, as small lines. */
export function alongsideHtml(markers: Marker[], m: Marker, range: Rng, dr: Drawn): string {
  if (!m.daily || range !== "week") return "";
  const others = markers.filter((o) => o.daily && o.key !== m.key && o.series().length).slice(0, 3);
  if (!others.length) return "";
  const days = dr.pts.map((p) => p.x);
  const rows = others.map((o) => {
    const by = new Map(o.series().map((p) => [p.d, p.v]));
    const vs = days.map((d) => by.has(d) ? by.get(d)! : null);
    const have = vs.filter((v): v is number => v != null);
    if (!have.length) return "";
    const lo = Math.min(...have), hi = Math.max(...have) || 1;
    const W = 300, Hh = 26, slot = W / days.length;
    const svg = o.sum
      ? vs.map((v, i) => v == null ? "" : `<rect x="${(i * slot + slot * 0.2).toFixed(1)}" y="${(Hh - (v / hi) * (Hh - 2)).toFixed(1)}" width="${(slot * 0.6).toFixed(1)}" height="${((v / hi) * (Hh - 2)).toFixed(1)}" fill="${o.color}" opacity="0.6"/>`).join("")
      : `<polyline points="${vs.map((v, i) => v == null ? null : `${(i * slot + slot / 2).toFixed(1)},${(Hh - 3 - ((v - lo) / (hi - lo || 1)) * (Hh - 6)).toFixed(1)}`).filter(Boolean).join(" ")}" fill="none" stroke="${o.color}" stroke-width="1.6" stroke-opacity="0.9"/>`;
    return `<div class="flex items-center gap-3"><span class="w-24 shrink-0 text-[12.5px] text-text-secondary">${esc(o.label)}</span><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" class="h-[26px] w-full" aria-hidden="true">${svg}</svg></div>`;
  }).filter(Boolean).join("");
  return rows ? `<div class="flex flex-col gap-2">${rows}</div><p class="mt-2 text-[12px] leading-relaxed text-text-muted">The same days. Two things on one timeline, with no claim about which moved the other.</p>` : "";
}

/** The sessions in a range, newest first, under the Workouts marker. */
export function workoutsListHtml(acts: any[], range: Rng): string {
  const t = todayStr();
  const from = range === "week" ? mondayOf(new Date()) : range === "4w" ? addDays(mondayOf(new Date()), -21) : range === "months" ? addDays(t, -365) : "0000";
  const rows = acts.filter((a) => a?.timestamp && localDay(a.timestamp) >= from).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  if (!rows.length) return `<div class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[13px] text-text-tertiary">No session in this range.</div>`;
  const dot: Record<string, string> = { light: "#38bdf8", moderate: "#fbbf24", vigorous: "#f87171" };
  const srcWord = (a: any) => a.source === "healthkit" ? "Apple Health" : a.source === "hr-estimated" ? "heart rate" : "logged by hand";
  const shown = rows.slice(0, 40);
  return `<div class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
    ${kicker(`THE SESSIONS · ${rows.length}`)}
    <div class="mt-2 flex flex-col">${shown.map((a) => `
      <div class="flex items-center gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0">
        <span class="h-2 w-2 shrink-0 rounded-full" style="background: ${dot[String(a.intensity_category)] ?? "#64748b"}"></span>
        <span class="min-w-0 flex-1"><span class="block truncate text-[13.5px] font-semibold text-text-primary">${esc(String(a.activity_name || "Workout"))}</span><span class="block text-[11.5px] text-text-tertiary">${esc(fmtDay(localDay(a.timestamp)))} · ${round0(Number(a.duration_minutes) || 0)} min · ${esc(srcWord(a))}${a.activity_type === "strength" ? " · strength" : ""}</span></span>
        <span class="font-mono text-[13px] font-bold text-text-primary">${fmt1(Number(a.met_hours) || 0)} <span class="text-[10px] font-medium text-text-tertiary">MET-h</span></span>
      </div>`).join("")}</div>
    ${rows.length > shown.length ? `<p class="mt-2 text-[12px] text-text-muted">and ${rows.length - shown.length} more in this range</p>` : ""}
  </div>`;
}
