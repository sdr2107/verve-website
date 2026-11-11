/**
 * In depth opens with the week that closed on Sunday, then the longer view
 * (canvas "My health, redesigned", board 13).
 *
 *   weekFiguresOf   one Monday-to-Sunday week as the page reads it: the app's
 *                   week row where it wrote one (dose, zones, strength,
 *                   background), the sessions, and the day rows' sleep,
 *                   resting rate, HRV, steps and sitting
 *   lastWeekOf      the week that finished, six tiles, and one sentence
 *                   against the week before
 *   snapshotOf      the same markers and the blood work against the same
 *                   date three, six or twelve months back: each row one
 *                   thing measured twice by the same writer; no score
 *
 * Pure. Every figure is from the derive layer's rules: mergeWeeks for the
 * dose, the day rows for the rest, the app's bands (derive/body) for the
 * words. A marker measured once in a window shows one value and no change.
 */
import type { PersonData } from "./person.ts";
import { addDays, daysBetween, fmt1, fmtDay, medianOf, mondayOf, round0 } from "./format.ts";
import { dedupeSessions, doseOf, mergeWeeks, type WeekRow } from "./activity.ts";
import { backgroundOf, fmtHMin, meanOver, weekZones, writerOf } from "./signals.ts";
import { restingBPOf } from "./markers.ts";
import { fitnessSummary } from "./activity.ts";
import { metsOfTest, tierIndexFromCategory, tierIndexOf, tierRowFor, tierShort } from "./fitness.ts";
import { judgeValue } from "./body.ts";
import { REMNANT_LABEL } from "./lipids.ts";

const DASH = "—";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayName = (d: string) => DAY_NAMES[new Date(d + "T00:00:00").getDay()];
export const dayMonth = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });
export const dayMonthYear = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The kind of a session, as the week's tiles count them: run · cycle · walk · swim · strength · the first word otherwise. */
export function kindOf(a: any): string {
  const n = String(a?.activity_name ?? "").toLowerCase();
  if (a?.activity_type === "strength" || /strength|weight|resistance/.test(n)) return "strength";
  if (/run|jog/.test(n)) return "run";
  if (/cycl|bike|ride|spin/.test(n)) return "cycle";
  if (/walk|hik/.test(n)) return "walk";
  if (/swim/.test(n)) return "swim";
  if (/row/.test(n)) return "row";
  if (/yoga|pilates|stretch/.test(n)) return "yoga";
  return n.split(/[,(]/)[0].trim().split(" ")[0] || "session";
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const kindsLine = (acts: any[]) => { const by = new Map<string, number>(); for (const a of acts) by.set(kindOf(a), (by.get(kindOf(a)) ?? 0) + 1); return [...by].sort((x, y) => y[1] - x[1]).map(([k, n]) => `${n} ${k}${n === 1 || k === "strength" || k === "yoga" ? "" : "s"}`).join(" · "); };

export interface WeekFigures {
  start: string; end: string;
  basis: "app" | "browser" | "none";
  dose: number | null; goal: number;
  /** The day the running total passed the goal, from the sessions; null when it did not. */
  goalMetOn: string | null;
  sessions: number; kinds: string; strength: number | null;
  z1: number | null; z2: number | null; z3: number | null;
  sleepAvg: number | null; nights: number; sri: number | null;
  rhr: number | null; hrv: number | null;
  steps: number | null; sitting: number | null; background: number | null;
  weight: number | null;
}

/** One week, Monday to Sunday, as the page reads it. */
export function weekFiguresOf(d: PersonData, weekStart: string, today: string): WeekFigures {
  const end = addDays(weekStart, 7);
  const rows = new Map(mergeWeeks(d.weeks, d.acts).map((w) => [w.week_start, w]));
  const w: WeekRow | null = rows.get(weekStart) ?? null;
  const acts = dedupeSessions(d.acts).filter((a) => { const t = String(a.timestamp); const day = new Date(t).toLocaleDateString("en-CA"); return day >= weekStart && day < end; });
  const goal = w?.dose_goal_met_min ?? Math.round(d.goal * 60);
  let cum = 0, goalMetOn: string | null = null;
  for (const a of acts) { cum += doseOf(a); if (cum >= goal && !goalMetOn) goalMetOn = new Date(a.timestamp).toLocaleDateString("en-CA"); }
  const zonesFromApp = w?.dose_basis === "app" && (w.zone1_min != null || w.zone2_min != null || w.zone3_min != null);
  const dz = zonesFromApp ? null : weekZones(d.signals, weekStart);
  const z2FromSessions = acts.reduce((t, a) => t + (Number(a.zone2_minutes) || 0), 0);
  const inWeek = (col: string) => d.signals.filter((r) => String(r.day) >= weekStart && String(r.day) < end && r[col] != null).map((r) => Number(r[col]));
  const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const sleep = inWeek("sleep_minutes");
  const sriRows = d.signals.filter((r) => String(r.day) >= weekStart && String(r.day) < end && r.sri_30d != null);
  const bg = backgroundOf(d.signals, weekStart, today, writerOf(d.signals, today));
  const weights = d.markerByKey("weight")?.series().filter((p) => p.d >= weekStart && p.d < end) ?? [];
  return {
    start: weekStart, end: addDays(weekStart, 6),
    basis: w?.dose_basis ?? "none",
    dose: w?.dose_met_min ?? null, goal, goalMetOn,
    sessions: acts.length, kinds: kindsLine(acts),
    strength: w?.strength_sessions ?? (acts.length ? acts.filter((a) => a.activity_type === "strength").length : null),
    z1: zonesFromApp ? w!.zone1_min : dz?.z1 ?? null,
    z2: zonesFromApp ? w!.zone2_min : dz?.z2 ?? (acts.length ? z2FromSessions : null),
    z3: zonesFromApp ? w!.zone3_min : dz?.z3 ?? null,
    sleepAvg: mean(sleep), nights: sleep.length,
    sri: sriRows.length ? Number(sriRows[sriRows.length - 1].sri_30d) : null,
    rhr: mean(inWeek("resting_hr")), hrv: mean(inWeek("hrv_night_ms")),
    steps: mean(inWeek("steps")), sitting: mean(inWeek("sedentary_minutes")),
    background: w?.dose_basis === "app" && w.background_min_avg != null ? w.background_min_avg : bg.minutes,
    weight: weights.length ? weights[weights.length - 1].v : null,
  };
}

export interface Tile { label: string; figure: string; unit: string; note: string }
export interface LastWeek { week: WeekFigures; before: WeekFigures; tiles: Tile[]; counted: string; compared: string; fitnessLine: string }

const signedWord = (delta: number, unit: string, what: string, noun = "") => delta === 0 ? `${what} the same` : `${what} ${delta > 0 ? "up" : "down"} ${Math.abs(Math.round(delta)).toLocaleString()}${unit ? ` ${unit}` : ""}${noun}`;

/** The week that finished on Sunday, against the one before it. */
export function lastWeekOf(d: PersonData, today = new Date().toLocaleDateString("en-CA")): LastWeek {
  const monday = mondayOf(new Date(today + "T00:00:00"));
  const start = addDays(monday, -7), before = addDays(monday, -14);
  const week = weekFiguresOf(d, start, today), prev = weekFiguresOf(d, before, today);
  const tiles: Tile[] = [
    { label: "Dose", figure: week.dose != null ? week.dose.toLocaleString() : DASH, unit: week.dose != null ? "MET-min" : "", note: week.dose == null ? (week.basis === "none" ? "no sessions logged" : "no dose counted") : week.goalMetOn ? `goal met on ${dayName(week.goalMetOn)}` : week.dose >= week.goal ? "goal met" : `${(week.goal - week.dose).toLocaleString()} short of ${week.goal.toLocaleString()}` },
    { label: "Sessions", figure: String(week.sessions), unit: "", note: week.sessions ? week.kinds : "none logged" },
    { label: "Zone 2 · 3", figure: week.z2 != null || week.z3 != null ? `${week.z2 != null ? round0(week.z2) : DASH} · ${week.z3 != null ? round0(week.z3) : DASH}` : DASH, unit: week.z2 != null || week.z3 != null ? "min" : "", note: week.z2 == null && week.z3 == null ? "the app writes the zones on its next sync" : week.z2 != null && week.z3 != null ? (week.z2 >= week.z3 ? "most minutes in zone 2" : "most minutes in zone 3") : "zone 3 comes with the app's next sync" },
    { label: "Sleep", figure: week.sleepAvg != null ? fmtHMin(week.sleepAvg) : DASH, unit: week.sleepAvg != null ? "a night" : "", note: week.sleepAvg == null ? "no nights from the wearable" : week.sri != null ? `regularity ${round0(week.sri)}` : `${plural(week.nights, "night")} read` },
    { label: "Resting HR · HRV", figure: week.rhr != null || week.hrv != null ? `${week.rhr != null ? round0(week.rhr) : DASH} · ${week.hrv != null ? round0(week.hrv) : DASH}` : DASH, unit: week.rhr != null || week.hrv != null ? "bpm · ms" : "", note: week.rhr == null && week.hrv == null ? "no mornings from the wearable" : "the week's mean" },
    { label: "Steps", figure: week.steps != null ? Math.round(week.steps).toLocaleString() : DASH, unit: week.steps != null ? "a day" : "", note: week.sitting != null ? `sitting ${fmtHMin(week.sitting)}` : week.steps == null ? "no steps in the store" : "" },
  ];
  const counted = week.basis === "app" ? "Counted by the app's week-in-review, the same figures the Guide read" : week.basis === "browser" ? "Counted from the synced sessions until the app writes this week" : "No sessions were logged; the rest is from the day rows";
  const bits: string[] = [];
  if (week.dose != null && prev.dose != null) bits.push(signedWord(week.dose - prev.dose, "", "dose"));
  else if (week.dose != null) bits.push("the week before had no dose to compare");
  if (week.sleepAvg != null && prev.sleepAvg != null) bits.push(signedWord(week.sleepAvg - prev.sleepAvg, "minutes", "sleep", " a night"));
  if (week.rhr != null && prev.rhr != null) { const dd = Math.round(week.rhr - prev.rhr); bits.push(dd === 0 ? "resting heart rate the same" : `resting heart rate ${dd > 0 ? "up" : "down"} ${Math.abs(dd)}`); }
  if (week.strength != null && prev.strength != null && week.strength !== prev.strength) { const dd = week.strength - prev.strength; bits.push(`${["one", "two", "three", "four"][Math.abs(dd) - 1] ?? Math.abs(dd)} ${dd < 0 ? "fewer" : "more"} strength session${Math.abs(dd) === 1 ? "" : "s"}`); }
  const fit = fitnessSummary(d.crf, today);
  const mets = metsOfTest(fit.latest), prevMets = metsOfTest(fit.prevSame);
  const newTest = fit.latest && fit.latest.measured_on >= start;
  const fitnessLine = mets == null ? "" : `Fitness ${fmt1(mets)} METs${newTest && prevMets != null ? `, ${mets - prevMets >= 0 ? "up" : "down"} ${fmt1(Math.abs(mets - prevMets))} on the last test` : ", unchanged"}.`;
  const compared = bits.length ? `Against the week before: ${bits.join(", ")}.` : "";
  return { week, before: prev, tiles, counted, compared, fitnessLine };
}

// ── the snapshot: three, six or twelve months ──────────────────────────────
export type SnapTone = "good" | "caution" | "concern" | "neutral";
export interface SnapRow { label: string; then: string; thenOn: string | null; now: string; nowOn: string | null; change: string; reads: string; tone: SnapTone; unit: string }
export interface SnapGroup { title: string; rows: SnapRow[] }
export interface Snapshot { months: number; anchor: string; groups: SnapGroup[]; empty: boolean }

export function addMonths(day: string, n: number): string {
  const x = new Date(day + "T00:00:00"); const dom = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(dom, last));
  return x.toLocaleDateString("en-CA");
}
const fmtN = (v: number, dp: number) => dp === 0 ? Math.round(v).toLocaleString() : (Math.round(v * 10 ** dp) / 10 ** dp).toFixed(dp);
const signedN = (v: number, dp: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtN(Math.abs(v), dp)}`;

/** The reading nearest a day, within a window of days; null when none is that close. */
function nearest<T extends { d: string }>(pts: T[], day: string, within: number): T | null {
  let best: T | null = null, bestGap = Infinity;
  for (const p of pts) { const gap = Math.abs(daysBetween(p.d, day)); if (gap <= within && gap < bestGap) { best = p; bestGap = gap; } }
  return best;
}

export function snapshotOf(d: PersonData, months: 3 | 6 | 12, today = new Date().toLocaleDateString("en-CA")): Snapshot {
  const anchor = addMonths(today, -months);
  const weeksBack = Math.round(months * 4.33);
  const rows = (pts: { d: string; v: number }[]) => pts.filter((p) => p.d <= today);
  const meanBetween = (col: string, from: string, to: string) => meanOver(d.signals.filter((r) => String(r.day) <= to), col, daysBetween(from, to), to);
  const row = (label: string, unit: string, dp: number, then: { v: number; d: string | null } | null, now: { v: number; d: string | null } | null, reads: (t: number | null, n: number | null) => { text: string; tone: SnapTone }): SnapRow | null => {
    if (!now && !then) return null;
    const single = !then || !now || (then.d && now.d && then.d === now.d);
    const r = reads(single ? null : then!.v, now?.v ?? then!.v);
    return { label, unit, then: !single ? fmtN(then!.v, dp) : (now ? DASH : fmtN(then!.v, dp)), thenOn: !single ? then!.d : (now ? null : then!.d), now: now ? fmtN(now.v, dp) : DASH, nowOn: now?.d ?? null, change: single ? "measured once" : signedN(now!.v - then!.v, dp), reads: r.text, tone: r.tone };
  };
  const judgeWords = (key: string, thenV: number | null, nowV: number, unit: string | null): { text: string; tone: SnapTone } => {
    const nowJ = judgeValue(d, key, nowV, unit), thenJ = thenV == null ? null : judgeValue(d, key, thenV, unit);
    const inNow = nowJ.tone === "good", inThen = thenJ?.tone === "good";
    if (nowJ.label == null) return { text: "no band", tone: "neutral" };
    if (inNow && thenJ && !inThen) return { text: `into range, from ${(thenJ.label ?? "outside").toLowerCase()}`, tone: "good" };
    if (inNow) return { text: nowJ.label.toLowerCase() === "in range" ? "in range" : nowJ.label.toLowerCase(), tone: "good" };
    if (thenJ && thenV != null && Math.abs(nowV - thenV) > 0 && ((key === "hdl_mgdl" || key === "handgrip_kg" || key === "alm_kg") ? nowV > thenV : nowV < thenV)) return { text: `moving, still ${nowJ.label.toLowerCase()}`, tone: "caution" };
    return { text: nowJ.label.toLowerCase(), tone: nowJ.tone };
  };

  // ── fitness and heart ──
  const fh: (SnapRow | null)[] = [];
  const fit = fitnessSummary(d.crf, today);
  const tests = fit.tests.map((t) => ({ d: String(t.measured_on), v: metsOfTest(t) ?? t.v / 3.5, cat: t.category }));
  const tNow = tests[tests.length - 1] ?? null, tThen = nearest(tests.filter((t) => t.d < (tNow?.d ?? today)), anchor, 60);
  const tierRow = tierRowFor(d.profile?.age, d.profile?.sex);
  fh.push(row("Fitness", "METs", 1, tThen ? { v: tThen.v, d: tThen.d } : null, tNow ? { v: tNow.v, d: tNow.d } : null, (t, n) => {
    const ni = tNow ? (tierIndexFromCategory(tNow.cat) ?? tierIndexOf(n!, tierRow)) : null, ti = t != null ? tierIndexOf(t, tierRow) : null;
    if (ni == null) return { text: "", tone: "neutral" };
    return { text: ti != null && ti !== ni ? `${tierShort(ni).toLowerCase()}, from ${tierShort(ti).toLowerCase()}` : `${tierShort(ni).toLowerCase()} for your age and sex`, tone: ni >= 2 ? "good" : ni === 1 ? "caution" : "concern" };
  }));
  const rhrThen = meanBetween("resting_hr", addDays(anchor, -14), anchor), rhrNow = meanBetween("resting_hr", addDays(today, -14), today);
  fh.push(row("Resting heart rate", "bpm", 0, rhrThen != null ? { v: rhrThen, d: anchor } : null, rhrNow != null ? { v: rhrNow, d: today } : null, (t, n) => t == null ? { text: "the 14-day mean", tone: "neutral" } : Math.abs(n! - t) < 3 ? { text: "your normal", tone: "neutral" } : { text: `your normal has moved ${n! < t ? "down" : "up"}`, tone: n! < t ? "good" : "caution" }));
  const hrvRows = d.signals.filter((r) => r.hrv_night_ms != null);
  const writerAt = (day: string) => [...hrvRows].reverse().find((r) => String(r.day) <= day)?.hrv_source ?? null;
  const hrvThen = meanBetween("hrv_night_ms", addDays(anchor, -14), anchor), hrvNow = meanBetween("hrv_night_ms", addDays(today, -14), today);
  fh.push(row("HRV, night", "ms", 0, hrvThen != null ? { v: hrvThen, d: anchor } : null, hrvNow != null ? { v: hrvNow, d: today } : null, (t) => t == null ? { text: "the 14-day mean", tone: "neutral" } : writerAt(anchor) === writerAt(today) ? { text: "same writer, same method", tone: "neutral" } : { text: `a different writer then (${writerAt(anchor) ?? "unknown"}): not compared`, tone: "neutral" }));
  const hrrPts = d.signals.filter((r) => r.hrr_bpm != null).map((r) => ({ d: String(r.day), v: Number(r.hrr_bpm) }));
  const hrrMed = (to: string) => { const xs = hrrPts.filter((p) => p.d > addDays(to, -30) && p.d <= to).map((p) => p.v); return xs.length >= 3 ? medianOf(xs)! : null; };
  const hrrT = hrrMed(anchor), hrrN = hrrMed(today);
  fh.push(row("1-minute recovery", "bpm", 0, hrrT != null ? { v: hrrT, d: anchor } : null, hrrN != null ? { v: hrrN, d: today } : null, (t, n) => t == null ? { text: "the 30-day median", tone: "neutral" } : n! > t ? { text: "faster", tone: "good" } : n! < t ? { text: "slower", tone: "caution" } : { text: "the same", tone: "neutral" }));
  const weeks = mergeWeeks(d.weeks, d.acts).filter((w) => w.week_start < mondayOf(new Date(today + "T00:00:00")));
  const doseAvg = (to: string, n: number) => { const ws = weeks.filter((w) => w.week_start < to).slice(-n).filter((w) => w.dose_met_min != null); return ws.length >= 2 ? { v: ws.reduce((t, w) => t + w.dose_met_min!, 0) / ws.length, n: ws.length } : null; };
  const dT = doseAvg(anchor, 8), dN = doseAvg(today, 8);
  const goalOf = (w: WeekRow) => w.dose_goal_met_min ?? Math.round(d.goal * 60);
  const recent = weeks.slice(-weeksBack), met = recent.filter((w) => w.dose_met_min != null && w.dose_met_min >= goalOf(w)).length;
  fh.push(row("Weekly dose, average", "MET-min", 0, dT ? { v: dT.v, d: anchor } : null, dN ? { v: dN.v, d: today } : null, () => ({ text: recent.length ? `goal reached in ${met} of the last ${recent.length} weeks` : "the 8-week mean", tone: recent.length && met >= recent.length / 2 ? "good" : "neutral" })));
  const slT = meanBetween("sleep_minutes", addDays(anchor, -14), anchor), slN = meanBetween("sleep_minutes", addDays(today, -14), today);
  fh.push(row("Sleep, average", "h", 2, slT != null ? { v: slT / 60, d: anchor } : null, slN != null ? { v: slN / 60, d: today } : null, (_t, n) => n! * 60 < 420 ? { text: "short nights", tone: "caution" } : n! * 60 > 540 ? { text: "long nights", tone: "neutral" } : { text: "inside the 7 to 9 hours", tone: "good" }));
  const sriAt = (day: string) => { const r = [...d.signals].reverse().find((x) => String(x.day) <= day && x.sri_30d != null); return r ? { v: Number(r.sri_30d), d: String(r.day) } : null; };
  const sT = sriAt(anchor), sN = sriAt(today);
  fh.push(row("Regularity, 30 days", "", 0, sT && daysBetween(sT.d, anchor) <= 21 ? sT : null, sN && daysBetween(sN.d, today) <= 21 ? sN : null, (t, n) => t == null ? { text: "the index that morning", tone: "neutral" } : n! - t >= 3 ? { text: "steadier bedtimes", tone: "good" } : t - n! >= 3 ? { text: "bedtimes wander more", tone: "caution" } : { text: "steady", tone: "neutral" }));
  const S = d.by.get("sbp") ?? [], D = d.by.get("dbp") ?? [];
  const bpN = restingBPOf(S, D), bpT = restingBPOf(S.filter((p) => p.d <= anchor), D.filter((p) => p.d <= anchor));
  if (bpN || bpT) {
    const same = !!bpN && !!bpT && bpN.d === bpT.d;
    const words = (bp: NonNullable<typeof bpN>) => bp.crisis ? { text: "a crisis-level reading: see a doctor today", tone: "concern" as SnapTone } : bp.sbp < 120 && bp.dbp < 80 ? { text: "in range", tone: "good" as SnapTone } : { text: "at or over the 120 and 80 lines", tone: "caution" as SnapTone };
    const w = words((bpN ?? bpT)!);
    fh.push({ label: "Blood pressure, 30-day mean", unit: "mmHg", then: bpT && !same ? `${bpT.sbp}/${bpT.dbp}` : DASH, thenOn: bpT && !same ? bpT.d : null, now: bpN ? `${bpN.sbp}/${bpN.dbp}` : DASH, nowOn: bpN?.d ?? null,
      change: bpT && bpN && !same ? `${signedN(bpN.sbp - bpT.sbp, 0)}/${signedN(bpN.dbp - bpT.dbp, 0)}` : "measured once", reads: w.text, tone: w.tone });
  }

  // ── body ──
  const body: (SnapRow | null)[] = [];
  const ser = (key: string) => rows((d.markerByKey(key)?.series() ?? []).map((p) => ({ d: p.d, v: p.v })));
  const pair = (pts: { d: string; v: number }[], within: number) => { const now = pts[pts.length - 1] ?? null; const then = now ? nearest(pts.filter((p) => p.d < now.d), anchor, within) : null; return { then, now }; };
  const wp = pair(ser("weight"), 21);
  const weeksSpan = wp.then && wp.now ? Math.max(1, daysBetween(wp.then.d, wp.now.d) / 7) : 1;
  body.push(row("Weight", "kg", 1, wp.then, wp.now, (t, n) => t == null ? { text: "one weighing in the window", tone: "neutral" } : Math.abs(n! - t) < 0.5 ? { text: "steady", tone: "neutral" } : { text: `${n! < t ? "down" : "up"}, about ${fmt1(Math.abs(n! - t) / weeksSpan)} kg a week`, tone: "neutral" }));
  const unitOf = (key: string, day: string | null) => (d.by.get(key) ?? []).find((p) => p.d === day)?.unit ?? null;
  const wa = pair(rows((d.by.get("waist_cm") ?? []).map((p) => ({ d: p.d, v: p.v }))), 45);
  body.push(row("Waist", "cm", 0, wa.then, wa.now, (t, n) => judgeWords("waist_cm", t, n!, "cm")));
  const bf = pair(rows((d.by.get("body_fat_pct") ?? []).map((p) => ({ d: p.d, v: p.v }))), 45);
  body.push(row("Body fat", "%", 1, bf.then, bf.now, (t, n) => judgeWords("body_fat_pct", t, n!, "%")));
  const h = Number(d.profile?.height_cm) || null;
  if (h) {
    const almi = rows((d.by.get("alm_kg") ?? []).map((p) => ({ d: p.d, v: p.v / Math.pow(h / 100, 2) })));
    const ap = pair(almi, 60);
    if (ap.now) body.push(row("Appendicular lean mass index", "kg/m²", 1, ap.then, ap.now, (t, n) => { const j = judgeValue(d, "alm_kg", n! * Math.pow(h / 100, 2), "kg"); const weightFell = wp.then && wp.now && wp.now.v < wp.then.v; return t != null && n! >= t && weightFell ? { text: "muscle kept while weight fell", tone: "good" } : { text: j.label?.toLowerCase() ?? "no band", tone: j.tone }; }));
  }

  // ── blood: the two reports nearest the window's ends ──
  const labDays = [...new Set(d.labs.map((l) => String(l.measured_on ?? "").slice(0, 10)).filter(Boolean))].sort();
  const nowDay = labDays[labDays.length - 1] ?? null;
  const thenDay = nowDay ? (labDays.filter((x) => x < nowDay && x <= addDays(anchor, 21)).pop() ?? labDays.find((x) => x < nowDay && x > anchor && daysBetween(anchor, x) <= 45) ?? null) : null;
  const blood: (SnapRow | null)[] = [];
  const bloodRow = (key: string, label: string, dp: number) => {
    const pts = key === "remnant"
      ? [...d.labsShown].filter((l) => l.analyte === REMNANT_LABEL && Number.isFinite(Number(l.value))).map((l) => ({ d: String(l.measured_on).slice(0, 10), v: Number(l.value), unit: l.unit ?? null }))
      : (d.by.get(key) ?? []).map((p) => ({ d: p.d, v: p.v, unit: p.unit ?? null }));
    const onDay = (day: string | null) => day ? pts.find((p) => p.d === day) ?? null : null;
    const now = onDay(nowDay) ?? (pts.length ? pts[pts.length - 1] : null), then = onDay(thenDay);
    if (!now) return null;
    const unit = now.unit ?? unitOf(key, now.d);
    return row(label, unit ?? "", dp, then && then.d !== now.d ? then : null, now, (t, n) => judgeWords(key, t, n!, unit));
  };
  blood.push(bloodRow("ldl_mgdl", "LDL", 1));
  blood.push(bloodRow("remnant", REMNANT_LABEL, 1));
  blood.push(bloodRow("apo_b_mgdl", "ApoB", 2));
  blood.push(bloodRow("triglycerides_mgdl", "Triglycerides", 1));
  blood.push(bloodRow("hba1c_pct", "HbA1c", 1));
  blood.push(bloodRow("glucose_mgdl", "Fasting glucose", 1));
  blood.push(bloodRow("hs_crp_mgl", "hs-CRP", 1));

  const groups: SnapGroup[] = [
    { title: "Fitness and heart", rows: fh.filter((r): r is SnapRow => !!r) },
    { title: "Body", rows: body.filter((r): r is SnapRow => !!r) },
    { title: `Blood${thenDay && nowDay ? ` · ${dayMonth(thenDay)} and ${dayMonth(nowDay)} reports` : nowDay ? ` · the ${dayMonth(nowDay)} report` : ""}`, rows: blood.filter((r): r is SnapRow => !!r) },
  ].filter((g) => g.rows.length);
  return { months, anchor, groups, empty: !groups.length };
}

/** "Monday 26 October to Sunday 1 November" */
export const weekSpanWords = (start: string) => `Monday ${dayMonth(start)} to Sunday ${dayMonth(addDays(start, 6))}`;
export { fmtDay };
