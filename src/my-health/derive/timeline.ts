/**
 * In depth, across time (canvas "Verve, one story in four parts", board 04;
 * built 11 Nov 2026). The page answers "how did I get here?": not by topic
 * but over five windows, each marker in its own lane on one line of time.
 *
 *   WINDOWS        1 month · 3 months · 6 months · 1 year (opens first) · 3 years
 *   timelineOf     one window: the lanes, the months under them, the table
 *                  "what moved, and what held", and the notes that keep it honest
 *   windowWorking  the same window as plain figures, for the Guide to read
 *
 * Which window shows what:
 *   every window   the weekly dose, resting heart rate, sleep, steps, weight
 *   3 months up    fitness tests
 *   6 months up    blood work (the founder's rule, 11 Nov 2026: three months is
 *                  too narrow for two reports to differ by more than their
 *                  usual swing)
 *
 * Rules, each from the research behind the canvas:
 *   · a marker is compared with itself, never with anyone else, and never with
 *     another marker: each lane has its own scale and no two share a plot
 *   · a change between two blood results is said to be inside, at the edge of,
 *     or more than that marker's usual swing (data/usual-swing.ts, the app's
 *     thresholds file); a marker with no figure on file says so
 *   · a change of wearable is marked on the line and nothing is compared across it
 *   · a stretch with nothing logged is left empty, never drawn as zero
 *   · a blood result that repeats unchanged from one entry to the next is one result, drawn and compared once, at
 *     its first date: the app's entry form saves the figures already on file with every new entry, and a report's
 *     value is often typed again on the day it arrives (12 Nov 2026: one result read as two, "0%, inside its usual swing")
 *   · Lp(a) is shown once and never as a trend
 *   · no colour and no word marks a change as good or bad
 *
 * Pure: geometry comes out as shares of the lane (x and y from 0 to 1), so the
 * view draws it at any width. Every figure is the derive layer's own.
 */
import type { PersonData } from "./person.ts";
import { addDays, daysBetween, mondayOf } from "./format.ts";
import { fitnessSummary, type WeekRow } from "./activity.ts";
import { metsOfTest } from "./fitness.ts";
import { LABELS, methodLabel, type Pt } from "./markers.ts";
import { weightSeries } from "./lenses.ts";
import SWING from "../../data/usual-swing.ts";

// ── the windows ─────────────────────────────────────────────────────────────

export const WINDOW_KEYS = ["1m", "3m", "6m", "1y", "3y"] as const;
export type WindowKey = (typeof WINDOW_KEYS)[number];
/** One year opens first: it sets the same season against itself. */
export const DEFAULT_WINDOW: WindowKey = "1y";
type Unit = "day" | "week" | "fortnight" | "month";
export interface WindowDef {
  key: WindowKey; label: string; months: number;
  /** "The last year": the heading's subject, and the Guide's name for the window. */
  name: string;
  /** How the dose is barred and how a wearable's line is stepped. */
  bars: Exclude<Unit, "day">; line: Exclude<Unit, "fortnight">;
  fitness: boolean; blood: boolean;
}
export const WINDOWS: Record<WindowKey, WindowDef> = {
  "1m": { key: "1m", label: "1 month", months: 1, name: "The last month", bars: "week", line: "day", fitness: false, blood: false },
  "3m": { key: "3m", label: "3 months", months: 3, name: "The last three months", bars: "week", line: "week", fitness: true, blood: false },
  "6m": { key: "6m", label: "6 months", months: 6, name: "The last six months", bars: "week", line: "week", fitness: true, blood: true },
  "1y": { key: "1y", label: "1 year", months: 12, name: "The last year", bars: "fortnight", line: "month", fitness: true, blood: true },
  "3y": { key: "3y", label: "3 years", months: 36, name: "The last three years", bars: "month", line: "month", fitness: true, blood: true },
};
export const isWindowKey = (k: string): k is WindowKey => (WINDOW_KEYS as readonly string[]).includes(k);

/** The blood markers that get a lane, in the Body page's order of interest. */
const BLOOD: { key: string; label: string; swing: keyof typeof SWING.markers | null; dp: number; points?: boolean }[] = [
  { key: "ldl_mgdl", label: "LDL", swing: "ldlC", dp: 1 },
  { key: "apo_b_mgdl", label: "ApoB", swing: "apoB", dp: 1 },
  { key: "hba1c_pct", label: "HbA1c", swing: "hba1c", dp: 1, points: true },
  { key: "glucose_mgdl", label: "Fasting glucose", swing: "fastingGlucose", dp: 1 },
  { key: "triglycerides_mgdl", label: "Triglycerides", swing: null, dp: 1 },
  { key: "hs_crp_mgl", label: "hs-CRP", swing: "hsCRP", dp: 2 },
];
/** The lane a figure elsewhere on the page leads to: an Overview section, a Horizon marker, a Guide line. */
export const LANE_FOR: Record<string, string> = {
  // the Overview's sections
  fitness: "fitness", vitals: "rhr", sleep: "sleep", exertion: "dose", movement: "dose", body: "weight",
  // Horizon's markers (horizon/derive MarkerKey)
  mets: "fitness", vo2: "fitness", dose: "dose", zone2_week: "dose", strength_week: "dose", longest_session: "dose",
  rhr: "rhr", steps: "steps", weight: "weight",
  ldl: "ldl_mgdl", apob: "apo_b_mgdl", hba1c: "hba1c_pct", fasting_glucose: "glucose_mgdl", triglycerides: "triglycerides_mgdl", hs_crp: "hs_crp_mgl",
};

// ── small arithmetic ────────────────────────────────────────────────────────

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const trim = (v: number, dp: number) => { const f = 10 ** dp; return String(Math.round(v * f) / f); };
const whole = (v: number) => Math.round(v).toLocaleString("en-GB");
const signedText = (v: number, text: string) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${text}`;
export function addMonths(day: string, n: number): string {
  const x = new Date(day + "T00:00:00"); const dom = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(dom, last));
  return x.toLocaleDateString("en-CA");
}
const dayMonth = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const dayMonthShort = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const dayMonthYear = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const monthShort = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { month: "short" });
const monthLong = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { month: "long" });
const yy = (d: string) => d.slice(2, 4);

// ── a change of wearable ────────────────────────────────────────────────────

/** The maker's name in a writer's name, so "Asha's Apple Watch" and "Apple Watch" are one writer. */
const brandOf = (w: string): string => {
  const s = w.toLowerCase();
  for (const [re, name] of [[/whoop/, "WHOOP"], [/apple watch|watch/, "Apple Watch"], [/oura/, "Oura"], [/garmin/, "Garmin"], [/fitbit/, "Fitbit"], [/polar/, "Polar"], [/withings/, "Withings"], [/samsung|galaxy/, "Samsung"]] as [RegExp, string][]) if (re.test(s)) return name;
  return w;
};
export interface WriterChange { day: string; from: string; to: string }
/**
 * The days a different wearable began writing the mornings and nights: a run of
 * five days or more from one writer, then five or more from another. A phone is
 * not a wearable and is passed over. Day rows from before the app named its
 * writers (October 2026) carry none, so an older change cannot be seen.
 */
export function writerChanges(signals: any[]): WriterChange[] {
  const runs: { w: string; from: string; n: number }[] = [];
  for (const r of signals ?? []) {
    const steps = r?.steps_source && !/phone/i.test(String(r.steps_source)) ? String(r.steps_source) : null;
    const raw = r?.hrv_source ? String(r.hrv_source) : steps;
    if (!raw) continue;
    const w = brandOf(raw), last = runs[runs.length - 1];
    if (last && last.w === w) last.n++; else runs.push({ w, from: String(r.day), n: 1 });
  }
  const solid = runs.filter((r) => r.n >= 5);
  const out: WriterChange[] = [];
  for (let i = 1; i < solid.length; i++) if (solid[i].w !== solid[i - 1].w) out.push({ day: solid[i].from, from: solid[i - 1].w, to: solid[i].w });
  return out;
}

// ── the shapes the view draws ───────────────────────────────────────────────

export interface LaneDot { x: number; y: number; shape: "dot" | "diamond"; label: string | null; title: string }
export interface Lane {
  key: string; label: string;
  /** The small line under the name: the unit, and how the lane is stepped. */
  sub: string;
  /** Bars: the dose. `h` is the share of the lane's height. */
  bars?: { x0: number; x1: number; h: number; title: string }[];
  /** The goal line across the bars, as a share of the height, and its words. */
  goal?: { y: number; text: string } | null;
  /** A wearable's line, in the pieces a gap or a change of wearable breaks it into. */
  lines?: { x: number; y: number }[][];
  /** Faint links between two tests of one method. */
  links?: { x: number; y: number }[][];
  dots?: LaneDot[];
  /** A change of wearable, marked on the line. */
  marks?: { x: number; text: string; title: string }[];
  /** A stretch with nothing logged. */
  gaps?: { x0: number; x1: number }[];
  /** The same figures in order, for the Guide and for a screen reader. */
  values: { on: string; v: number }[];
  /** One sentence a screen reader hears in place of the drawing. */
  alt: string;
}
export interface MoveRow {
  key: string; label: string; unit: string;
  then: string; thenOn: string | null; now: string; nowOn: string | null; change: string;
  /** "More than its usual swing?", answered in words. */
  words: string;
  /** A row that says why nothing is compared: drawn quieter. */
  quiet: boolean;
  swing: "inside" | "edge" | "more" | null;
  /** A blood marker's usual swing, in words, when one is on file: "about 26 to 27%". */
  range?: string;
}
export interface Stretch { from: string; to: string; label: string }
export interface Timeline {
  def: WindowDef; from: string; to: string;
  /** The window was started after a gap, at the person's word. */
  custom: boolean;
  lanes: Lane[];
  axis: { x: number; label: string }[];
  /** A horizon's own stretch of time, marked on the axis. */
  stretches: { x0: number; x1: number; label: string }[];
  rows: MoveRow[];
  notes: string[];
  /** The longest stretch of four weeks or more with nothing logged; the page offers to start after it. */
  gap: { from: string; to: string } | null;
  changes: WriterChange[];
  empty: boolean;
}
export type TimelinePerson = Pick<PersonData, "weeks" | "crf" | "signals" | "weights" | "by" | "goal">;

// ── buckets ─────────────────────────────────────────────────────────────────

type Span = { from: string; to: string };
function spansOf(from: string, to: string, unit: Unit): Span[] {
  const out: Span[] = [];
  if (unit === "day") { for (let d = from; d <= to; d = addDays(d, 1)) out.push({ from: d, to: d }); return out; }
  if (unit === "week") { for (let d = mondayOf(new Date(from + "T00:00:00")); d <= to; d = addDays(d, 7)) out.push({ from: d, to: addDays(d, 6) }); return out; }
  if (unit === "fortnight") {
    // counted back from the last complete week, so the newest bar is two whole weeks
    for (let end = addDays(mondayOf(new Date(addDays(to, 1) + "T00:00:00")), -1); end >= from; end = addDays(end, -14)) out.push({ from: addDays(end, -13), to: end });
    return out.reverse();
  }
  for (let d = from.slice(0, 8) + "01"; d <= to; d = addMonths(d, 1)) out.push({ from: d, to: addDays(addMonths(d, 1), -1) });
  return out;
}
const UNIT_WORDS: Record<Unit, string> = { day: "day by day", week: "week by week", fortnight: "two weeks a bar", month: "month by month" };
/** The fewest days that make a bucket's mean: about five of a week's seven nights, about ten of a month's. */
const MIN_DAYS: Record<Exclude<Unit, "fortnight">, number> = { day: 1, week: 5, month: 10 };

// ── one window ──────────────────────────────────────────────────────────────

export function timelineOf(d: TimelinePerson, key: WindowKey, today: string, opts: { from?: string; horizons?: Stretch[] } = {}): Timeline {
  const def = WINDOWS[key];
  const anchor = addMonths(today, -def.months);
  const from = opts.from && opts.from > anchor && opts.from < today ? opts.from : anchor;
  const custom = from !== anchor;
  const span = Math.max(1, daysBetween(from, today));
  const xOf = (day: string) => clamp01(daysBetween(from, day) / span);
  const inWin = (day: string) => day >= from && day <= today;
  const mondayNow = mondayOf(new Date(today + "T00:00:00"));
  const changes = writerChanges(d.signals).filter((c) => c.day > from && c.day <= today);
  const lanes: Lane[] = [];
  const rows: MoveRow[] = [];
  const notes: string[] = [];

  /** A lane's own scale: the lowest value at a tenth of the height, the highest at nine tenths. */
  const scale = (vs: number[]) => { const lo = Math.min(...vs), hi = Math.max(...vs); return (v: number) => (hi === lo ? 0.5 : 0.1 + 0.8 * ((v - lo) / (hi - lo))); };
  const single = (label: string, unit: string, now: string, nowOn: string | null, words: string): MoveRow => ({ key: "", label, unit, then: "—", thenOn: null, now, nowOn, change: "—", words, quiet: true, swing: null });

  // ── fitness: each test, in METs, linked only to the next test of its own method ──
  const fit = fitnessSummary(d.crf, today);
  const tests = fit.tests.map((t) => ({ d: String(t.measured_on), v: metsOfTest(t) ?? t.v / 3.5, method: String(t.method ?? "") })).filter((t) => t.d <= today);
  if (def.fitness) {
    const shown = tests.filter((t) => inWin(t.d));
    if (shown.length) {
      const y = scale(shown.map((t) => t.v));
      const links: { x: number; y: number }[][] = [];
      for (let i = 1; i < shown.length; i++) if (shown[i].method === shown[i - 1].method) links.push([{ x: xOf(shown[i - 1].d), y: y(shown[i - 1].v) }, { x: xOf(shown[i].d), y: y(shown[i].v) }]);
      lanes.push({
        key: "fitness", label: "Fitness", sub: "METs · each test", links,
        dots: shown.map((t, i) => ({ x: xOf(t.d), y: y(t.v), shape: "dot", label: shown.length <= 4 || i === 0 || i === shown.length - 1 ? trim(t.v, 1) : null, title: `${dayMonthYear(t.d)}: ${trim(t.v, 1)} METs by ${methodLabel(t.method)}` })),
        values: shown.map((t) => ({ on: dayMonthYear(t.d), v: Math.round(t.v * 10) / 10 })),
        alt: `${shown.length === 1 ? "One fitness test" : `${shown.length} fitness tests`} in this window: ${shown.map((t) => trim(t.v, 1)).join(", ")} METs`,
      });
      const now = shown[shown.length - 1];
      const then = pairOf(tests, from, today).then;
      if (!then) rows.push({ ...single("Fitness", "METs", trim(now.v, 1), now.d, "One test in this window."), key: "fitness" });
      else if (then.method !== now.method) rows.push({ key: "fitness", label: "Fitness", unit: "METs", then: trim(then.v, 1), thenOn: then.d, now: trim(now.v, 1), nowOn: now.d, change: "—", words: "Not compared: the two tests used different methods.", quiet: true, swing: null });
      else {
        const same = tests.filter((t) => t.method === now.method && t.d >= then.d && t.d <= now.d);
        const rising = same.every((t, i) => i === 0 || t.v > same[i - 1].v), falling = same.every((t, i) => i === 0 || t.v < same[i - 1].v);
        const n = same.length, count = n === 2 ? "Two" : n === 3 ? "Three" : n === 4 ? "Four" : String(n);
        rows.push({ key: "fitness", label: "Fitness", unit: "METs", then: trim(then.v, 1), thenOn: then.d, now: trim(now.v, 1), nowOn: now.d, change: signedText(now.v - then.v, trim(Math.abs(now.v - then.v), 1)),
          words: `${count} tests of one method${n > 2 && rising ? ", each higher than the last" : n > 2 && falling ? ", each lower than the last" : ""}.`, quiet: false, swing: null });
      }
    } else if (tests.length) notes.push(`Fitness: the latest test is from ${dayMonthYear(tests[tests.length - 1].d)}, before this window.`);
  } else notes.push("Fitness tests are drawn from three months up: a test repeats every eight weeks at the soonest.");

  // ── the weekly dose: complete weeks only, a week with nothing logged left empty ──
  const weeks = new Map<string, WeekRow>(d.weeks.filter((w) => w.week_start < mondayNow).map((w) => [w.week_start, w]));
  const goalOf = (w: WeekRow | undefined) => w?.dose_goal_met_min ?? Math.round(d.goal * 60);
  const weekStarts: string[] = [];
  for (let m = mondayOf(new Date(from + "T00:00:00")); m < mondayNow; m = addDays(m, 7)) if (addDays(m, 6) >= from) weekStarts.push(m);
  const doseOfWeek = (m: string) => weeks.get(m)?.dose_met_min ?? null;
  const logged = weekStarts.filter((m) => doseOfWeek(m) != null);
  let gap: Timeline["gap"] = null;
  if (logged.length) {
    const goal = goalOf(weeks.get(logged[logged.length - 1]));
    const spans = spansOf(from, addDays(mondayNow, -1), def.bars);
    const buckets = spans.map((s) => { const vs = weekStarts.filter((m) => m >= s.from && m <= s.to).map(doseOfWeek).filter((v): v is number => v != null); return { ...s, v: mean(vs) }; });
    const top = Math.max(goal * 1.15, ...buckets.map((b) => b.v ?? 0));
    const pad = def.bars === "week" ? 0.12 : 0.1;
    const bars = buckets.filter((b) => b.v != null).map((b) => {
      const x0 = xOf(b.from < from ? from : b.from), x1 = xOf(addDays(b.to, 1) > today ? today : addDays(b.to, 1)), w = x1 - x0;
      return { x0: x0 + w * pad, x1: x1 - w * pad, h: clamp01(b.v! / top), title: `${def.bars === "week" ? `Week of ${dayMonth(b.from)}` : `${dayMonthShort(b.from)} to ${dayMonthShort(b.to)}`}: ${whole(b.v!)} MET-min${def.bars === "week" ? "" : " a week"}` };
    });
    // runs of weeks with nothing logged, between the first and the last logged week
    const gaps: Span[] = [];
    let run: string[] = [];
    for (const m of weekStarts) {
      if (m <= logged[0] || m >= logged[logged.length - 1]) continue;
      if (doseOfWeek(m) == null) run.push(m); else { if (run.length >= 4) gaps.push({ from: run[0], to: addDays(run[run.length - 1], 6) }); run = []; }
    }
    if (run.length >= 4) gaps.push({ from: run[0], to: addDays(run[run.length - 1], 6) });
    gap = gaps.sort((a, b) => daysBetween(b.from, b.to) - daysBetween(a.from, a.to))[0] ?? null;
    lanes.push({
      key: "dose", label: "Weekly dose", sub: `MET-min · ${def.bars === "week" ? "a week a bar" : def.bars === "fortnight" ? "two weeks a bar" : "a month a bar"}`,
      bars, goal: { y: clamp01(goal / top), text: `goal ${whole(goal)}` }, gaps: gaps.map((g) => ({ x0: xOf(g.from), x1: xOf(addDays(g.to, 1)) })),
      values: buckets.filter((b) => b.v != null).map((b) => ({ on: dayMonthYear(b.from), v: Math.round(b.v!) })),
      alt: `The weekly dose across this window against the goal of ${whole(goal)} MET-minutes${gaps.length ? ", with a stretch where nothing was logged" : ""}`,
    });
    // the table: the mean of the last complete weeks against the same count before the window
    const n = def.months === 1 ? 4 : 8;
    const avg = (ms: string[]) => { const vs = ms.map(doseOfWeek).filter((v): v is number => v != null); return vs.length >= 2 ? mean(vs)! : null; };
    const lastN = logged.slice(-n), firstMon = mondayOf(new Date(from + "T00:00:00"));
    const before = [...weeks.keys()].filter((m) => m < firstMon).sort().slice(-n);
    const nowV = avg(lastN), thenV = avg(before);
    const judged = weekStarts.slice(-13), reached = judged.filter((m) => { const v = doseOfWeek(m); return v != null && v >= goalOf(weeks.get(m)); }).length;
    const words = `Goal reached in ${reached} of the last ${judged.length} ${judged.length === 1 ? "week" : "weeks"}.`;
    if (nowV != null) rows.push({ key: "dose", label: "Weekly dose, average", unit: "MET-min", then: thenV != null ? whole(thenV) : "—", thenOn: thenV != null ? from : null, now: whole(nowV), nowOn: today,
      change: thenV != null ? signedText(nowV - thenV, whole(Math.abs(nowV - thenV))) : "—", words, quiet: false, swing: null });
  }

  // ── the wearable's lines: resting heart rate, sleep, steps ──
  const rowsIn = (d.signals ?? []).filter((r) => inWin(String(r.day)));
  const cut = changes[changes.length - 1] ?? null;
  const wearable = (key: string, label: string, col: string, unit: string, conv: (v: number) => number, fmt: (v: number) => string, breakAtChange: boolean, table: (thenV: number | null, nowV: number, crossed: boolean) => { change: string; words: string; quiet: boolean }) => {
    const have = rowsIn.filter((r) => r[col] != null);
    if (!have.length) return;
    const spans = spansOf(from, today, def.line);
    const buckets = spans.map((s) => {
      let days = have.filter((r) => String(r.day) >= s.from && String(r.day) <= s.to);
      // a bucket a change of wearable falls in is the new wearable's days when it has enough of them, else the old one's
      const split = breakAtChange && cut && cut.day > s.from && cut.day <= s.to;
      let side: "before" | "after" | null = null;
      if (split) { const after = days.filter((r) => String(r.day) >= cut!.day), bef = days.filter((r) => String(r.day) < cut!.day); if (after.length >= MIN_DAYS[def.line]) { days = after; side = "after"; } else { days = bef; side = "before"; } }
      const v = days.length >= MIN_DAYS[def.line] ? conv(mean(days.map((r) => Number(r[col])))!) : null;
      // the point sits at the middle of the days it was made from, so one made of the new wearable's days never falls before its mark
      const lo = side === "after" ? cut!.day : s.from, hi = side === "before" ? addDays(cut!.day, -1) : s.to;
      const mid = addDays(lo, Math.floor(daysBetween(lo, hi) / 2));
      return { ...s, v, mid: mid < from ? from : mid > today ? today : mid, after: breakAtChange && cut ? (side ? side === "after" : s.from >= cut.day) : false };
    });
    const vs = buckets.map((b) => b.v).filter((v): v is number => v != null);
    if (!vs.length) return;
    const y = scale(vs);
    const lines: { x: number; y: number }[][] = [];
    let seg: { x: number; y: number }[] = [], prevAfter = false;
    for (const b of buckets) {
      if (b.v == null || (seg.length && b.after !== prevAfter)) { if (seg.length) lines.push(seg); seg = []; }
      if (b.v != null) { seg.push({ x: xOf(b.mid), y: y(b.v) }); prevAfter = b.after; }
    }
    if (seg.length) lines.push(seg);
    const real = buckets.filter((b) => b.v != null), first = real[0], last = real[real.length - 1];
    const dots: LaneDot[] = [first, ...(last !== first ? [last] : [])].map((b) => ({ x: xOf(b.mid), y: y(b.v!), shape: "dot", label: fmt(b.v!), title: `${def.line === "day" ? dayMonth(b.from) : `${dayMonthShort(b.from)} to ${dayMonthShort(b.to)}`}: ${fmt(b.v!)}${unit ? ` ${unit}` : ""}` }));
    lanes.push({
      key, label, sub: `${unit ? `${unit} · ` : ""}${UNIT_WORDS[def.line]}`, lines, dots,
      marks: breakAtChange ? changes.map((c) => ({ x: xOf(c.day), text: `new wearable, ${dayMonthShort(c.day)}`, title: `${c.to} in place of ${c.from} from ${dayMonthYear(c.day)}` })) : [],
      values: real.map((b) => ({ on: dayMonthYear(b.from), v: Math.round(b.v! * 10) / 10 })),
      alt: `${label} across this window, ${UNIT_WORDS[def.line]}${breakAtChange && changes.length ? ", with the day the wearable changed marked" : ""}`,
    });
    // the table: a two-week average at each end of the window
    const avg14 = (end: string) => { const xs = (d.signals ?? []).filter((r) => String(r.day) > addDays(end, -14) && String(r.day) <= end && r[col] != null).map((r) => Number(r[col])); return xs.length >= 5 ? conv(mean(xs)!) : null; };
    const nowV = avg14(today), thenV = avg14(from);
    if (nowV == null) return;
    const crossed = breakAtChange && !!cut;
    const t = table(thenV, nowV, crossed);
    rows.push({ key, label, unit, then: thenV != null ? fmt(thenV) : "—", thenOn: thenV != null ? from : null, now: fmt(nowV), nowOn: today, change: t.change, words: t.words, quiet: t.quiet, swing: null });
  };
  const noThen = "Nothing from a wearable at the start of this window to set it against.";
  wearable("rhr", "Resting heart rate", "resting_hr", "bpm", (v) => v, (v) => whole(v), true, (t, n, crossed) =>
    crossed ? { change: "—", words: `Not compared: the wearable changed on ${dayMonth(cut!.day)}.`, quiet: true }
    : t == null ? { change: "—", words: noThen, quiet: true }
    : Math.abs(Math.round(n) - Math.round(t)) < 3 ? { change: signedText(Math.round(n) - Math.round(t), String(Math.abs(Math.round(n) - Math.round(t)))), words: "Held: two-week averages within 3 beats of each other.", quiet: false }
    : { change: signedText(n - t, String(Math.abs(Math.round(n) - Math.round(t)))), words: `Moved ${n < t ? "down" : "up"}, on two-week averages.`, quiet: false });
  const hmOf = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  wearable("sleep", "Sleep", "sleep_minutes", "a night", (v) => v / 60, hmOf, true, (t, n, crossed) => {
    if (crossed) return { change: "—", words: `Not compared: the wearable changed on ${dayMonth(cut!.day)}.`, quiet: true };
    if (t == null) return { change: "—", words: noThen, quiet: true };
    const mins = Math.round((n - t) * 60);
    return Math.abs(mins) < 20 ? { change: signedText(mins, `${Math.abs(mins)} min`), words: "Held: two-week averages within 20 minutes of each other.", quiet: false }
      : { change: signedText(mins, `${Math.abs(mins)} min`), words: `About ${Math.abs(mins)} minutes ${mins > 0 ? "more" : "less"} a night, on two-week averages.`, quiet: false };
  });
  wearable("steps", "Steps", "steps", "a day", (v) => v, (v) => whole(v), false, (t, n) => {
    if (t == null) return { change: "—", words: "No steps at the start of this window to set it against.", quiet: true };
    const dd = Math.round((n - t) / 100) * 100;
    return Math.abs(dd) < 500 ? { change: signedText(dd, whole(Math.abs(dd))), words: "Held: two-week averages within 500 steps a day.", quiet: false }
      : { change: signedText(dd, whole(Math.abs(dd))), words: `About ${whole(Math.abs(dd))} ${dd > 0 ? "more" : "fewer"} a day, on two-week averages.`, quiet: false };
  });

  // ── weight: each weighing; stepped like a wearable's line once there are too many to tell apart ──
  const weighings = weightSeries(d.weights ?? []).filter((p) => p.d <= today);
  const wShown = weighings.filter((p) => inWin(p.d));
  if (wShown.length) {
    if (wShown.length > 45) {
      const unit = def.line === "day" ? "week" : def.line;
      const buckets = spansOf(from, today, unit).map((s) => { const vs = wShown.filter((p) => p.d >= s.from && p.d <= s.to).map((p) => p.v); const mid = addDays(s.from, Math.floor(daysBetween(s.from, s.to) / 2)); return { ...s, v: mean(vs), mid: mid < from ? from : mid > today ? today : mid }; });
      const real = buckets.filter((b) => b.v != null);
      const y = scale(real.map((b) => b.v!));
      const lines: { x: number; y: number }[][] = []; let seg: { x: number; y: number }[] = [];
      for (const b of buckets) { if (b.v == null) { if (seg.length) lines.push(seg); seg = []; } else seg.push({ x: xOf(b.mid), y: y(b.v) }); }
      if (seg.length) lines.push(seg);
      const first = real[0], last = real[real.length - 1];
      lanes.push({ key: "weight", label: "Weight", sub: `kg · ${UNIT_WORDS[unit]}`, lines,
        dots: [first, ...(last !== first ? [last] : [])].map((b) => ({ x: xOf(b.mid), y: y(b.v!), shape: "dot", label: trim(b.v!, 1), title: `${dayMonthShort(b.from)} to ${dayMonthShort(b.to)}: ${trim(b.v!, 1)} kg` })),
        values: real.map((b) => ({ on: dayMonthYear(b.from), v: Math.round(b.v! * 10) / 10 })), alt: `Weight across this window, ${UNIT_WORDS[unit]}` });
    } else {
      const y = scale(wShown.map((p) => p.v));
      lanes.push({ key: "weight", label: "Weight", sub: "kg · each weighing",
        links: wShown.length > 1 ? [wShown.map((p) => ({ x: xOf(p.d), y: y(p.v) }))] : [],
        dots: wShown.map((p, i) => ({ x: xOf(p.d), y: y(p.v), shape: "dot", label: i === 0 || i === wShown.length - 1 ? trim(p.v, 1) : null, title: `${dayMonthYear(p.d)}: ${trim(p.v, 1)} kg` })),
        values: wShown.map((p) => ({ on: dayMonthYear(p.d), v: Math.round(p.v * 10) / 10 })), alt: `${wShown.length === 1 ? "One weighing" : `${wShown.length} weighings`} in this window, from ${trim(wShown[0].v, 1)} to ${trim(wShown[wShown.length - 1].v, 1)} kilograms` });
    }
    const { then, now } = pairOf(weighings, from, today);
    if (now && !then) rows.push({ ...single("Weight", "kg", trim(now.v, 1), now.d, "One weighing in this window."), key: "weight" });
    else if (now && then) {
      const dd = now.v - then.v, wks = Math.max(1, daysBetween(then.d, now.d) / 7);
      rows.push({ key: "weight", label: "Weight", unit: "kg", then: trim(then.v, 1), thenOn: then.d, now: trim(now.v, 1), nowOn: now.d, change: signedText(dd, trim(Math.abs(dd), 1)),
        words: Math.abs(dd) < 0.5 ? "Held: within half a kilogram." : `${dd < 0 ? "Down" : "Up"}, ${trim(Math.abs(dd) / wks, 1) === "0" ? "by less than 0.1" : `about ${trim(Math.abs(dd) / wks, 1)}`} kg a week.`, quiet: false, swing: null });
    }
  }

  // ── blood work: each report a mark, never a line; from six months up ──
  if (def.blood) {
    let anyBefore: string | null = null, repeated = false;
    for (const b of BLOOD) {
      const all = (d.by.get(b.key) ?? []).filter((p) => p.d <= today).slice().sort((a, c) => a.d.localeCompare(c.d));
      const pts = distinctResults(all);
      if (all.some((p) => inWin(p.d) && !pts.includes(p))) repeated = true;
      const shown = pts.filter((p) => inWin(p.d));
      if (!shown.length) { const last = pts[pts.length - 1]; if (last && (!anyBefore || last.d > anyBefore)) anyBefore = last.d; continue; }
      const unit = shown[shown.length - 1].unit ?? LABELS[b.key]?.unit ?? "";
      const y = scale(shown.map((p) => p.v));
      lanes.push({ key: b.key, label: b.label, sub: `${unit ? `${unit} · ` : ""}each report`,
        dots: shown.map((p, i) => ({ x: xOf(p.d), y: y(p.v), shape: "diamond", label: shown.length <= 4 || i === 0 || i === shown.length - 1 ? trim(p.v, b.dp) : null, title: `Report of ${dayMonthYear(p.d)}: ${trim(p.v, b.dp)}${unit ? ` ${unit}` : ""}` })),
        values: shown.map((p) => ({ on: dayMonthYear(p.d), v: p.v })),
        alt: `${shown.length === 1 ? "One" : shown.length} ${b.label} ${shown.length === 1 ? "result" : "results"} in this window: ${shown.map((p) => `${trim(p.v, b.dp)} on ${dayMonth(p.d)}`).join(", ")}` });
      rows.push(bloodRow(b, pts, from, today, unit));
    }
    if (anyBefore && !lanes.some((l) => BLOOD.some((b) => b.key === l.key))) notes.push(`Blood work: the latest report is from ${dayMonthYear(anyBefore)}, before this window.`);
    if (repeated) notes.push("A blood result that repeats unchanged from one entry to the next is drawn once, at its first date.");
    const lpa = (d.by.get("lpa_value") ?? []).filter((p) => p.d <= today).slice().sort((a, c) => a.d.localeCompare(c.d)).pop();
    if (lpa) rows.push({ ...single("Lp(a)", lpa.unit ?? "", trim(lpa.v, 1), lpa.d, "Shown once. It is largely inherited and is not drawn as a trend."), key: "lpa_value" });
  } else notes.push("Blood work is drawn from six months up: two reports closer together than that rarely differ by more than their usual swing.");

  if (key === "6m") notes.push(`Six months sets ${monthLong(from)} beside ${monthLong(today)}, opposite ends of the year. Cholesterol, blood pressure and resting heart rate can shift a little with the season alone.`);
  if (changes.length && !lanes.some((l) => l.marks?.length)) changes.length = 0;

  // ── the months under the lanes ──
  const axis: Timeline["axis"] = [];
  if (span <= 45) { for (let m = mondayOf(new Date(from + "T00:00:00")); m <= today; m = addDays(m, 7)) if (m >= from) axis.push({ x: xOf(m), label: dayMonthShort(m) }); }
  else {
    const stepMonths = span <= 200 ? 1 : span <= 400 ? 2 : 6;
    let m = from.slice(0, 8) + "01"; if (m < from) m = addMonths(m, 1);
    // the year is said on the first label of a window that crosses a new year, and wherever the year turns
    const crosses = from.slice(0, 4) !== today.slice(0, 4);
    let prevYear = "";
    for (; m <= today; m = addMonths(m, stepMonths)) { const y = m.slice(0, 4); axis.push({ x: xOf(m), label: `${monthShort(m)}${crosses && y !== prevYear ? ` ${yy(m)}` : ""}` }); prevYear = y; }
  }
  const stretches = (opts.horizons ?? []).filter((h) => h.to > from && h.from < today).map((h) => ({ x0: xOf(h.from < from ? from : h.from), x1: xOf(h.to > today ? today : h.to), label: h.label }));

  return { def, from, to: today, custom, lanes, axis, stretches, rows, notes, gap: custom ? null : gap, changes, empty: !lanes.length };
}

/**
 * Each result once. The app's entry form saves the figures already on file with every new entry, a report's value is
 * typed again on the day it arrives, and an export carries both: so the same value on the next entry is the same
 * result, not a second one. A run of one value (in one unit) is its first reading. A repeat test that came back
 * identical to the last is folded into it too; nothing is lost, since the page would have said it held.
 */
export function distinctResults<T extends { v: number; unit?: string | null }>(pts: T[]): T[] {
  return pts.filter((p, i) => i === 0 || p.v !== pts[i - 1].v || (p.unit ?? "") !== (pts[i - 1].unit ?? ""));
}

/** The reading at the window's start and the latest one inside it: the earliest inside the window, or one up to 45 days before it when that is nearer the start. */
function pairOf<T extends { d: string }>(pts: T[], from: string, today: string): { then: T | null; now: T | null } {
  const inside = pts.filter((p) => p.d >= from && p.d <= today);
  const now = inside[inside.length - 1] ?? null;
  if (!now) return { then: null, now: null };
  const before = pts.filter((p) => p.d < from && daysBetween(p.d, from) <= 45).pop() ?? null;
  const firstIn = inside[0] !== now ? inside[0] : null;
  const then = before && firstIn ? (daysBetween(before.d, from) <= daysBetween(from, firstIn.d) ? before : firstIn) : (before ?? firstIn);
  return { then, now };
}

/** Where a change between two results sits against the marker's usual swing: inside it, at its edge, or more than it. */
export function swingOf(swingKey: keyof typeof SWING.markers | null, thenV: number, nowV: number): { state: "inside" | "edge" | "more"; range: string } | null {
  if (!swingKey || !(thenV > 0)) return null;
  const m = SWING.markers[swingKey] as Record<string, unknown>;
  if (m.logScale) {
    const rise = Number(m.risePct), fall = Number(m.fallPct), ratio = nowV / thenV;
    const more = ratio > 1 + rise / 100 || ratio < 1 - fall / 100;
    return { state: more ? "more" : "inside", range: `a rise to more than ${trim(1 + rise / 100, 1)} times, or a fall of more than ${Math.round(fall)}%` };
  }
  if (m.swingLowPct == null) return null;
  const lo = Number(m.swingLowPct), hi = Number(m.swingHighPct), pct = (Math.abs(nowV - thenV) / thenV) * 100;
  const range = swingKey === "hba1c" ? `${trim((thenV * lo) / 100, 1)} to ${trim((thenV * hi) / 100, 1)} points at this level`
    : Math.round(lo) === Math.round(hi) ? `${Math.round(lo)}%` : `${Math.round(lo)} to ${Math.round(hi)}%`;
  return { state: pct < lo ? "inside" : pct <= hi ? "edge" : "more", range };
}

function bloodRow(b: (typeof BLOOD)[number], pts: Pt[], from: string, today: string, unit: string): MoveRow {
  const { then, now } = pairOf(pts, from, today);
  const fmt = (v: number) => (b.points ? v.toFixed(1) : trim(v, b.dp));
  if (!now) return { key: b.key, label: b.label, unit, then: "—", thenOn: null, now: "—", nowOn: null, change: "—", words: "", quiet: true, swing: null };
  if (!then) return { key: b.key, label: b.label, unit, then: "—", thenOn: null, now: fmt(now.v), nowOn: now.d, change: "—", words: "Measured once in this window.", quiet: true, swing: null };
  if ((then.unit ?? "") !== (now.unit ?? "")) return { key: b.key, label: b.label, unit, then: fmt(then.v), thenOn: then.d, now: fmt(now.v), nowOn: now.d, change: "—", words: "Not compared: the two reports use different units.", quiet: true, swing: null };
  const dd = now.v - then.v, pct = then.v ? (dd / then.v) * 100 : 0;
  const change = b.points ? signedText(dd, Math.abs(dd).toFixed(1)) : signedText(dd, `${Math.round(Math.abs(pct))}%`);
  const s = swingOf(b.swing, then.v, now.v);
  const words = !s ? "No usual swing is on file for this marker, so the two results are shown as they are."
    : b.swing === "hsCRP" ? (s.state === "more" ? `More than its usual swing: ${s.range}.` : `Inside its usual swing. It takes ${s.range} to be more than that.`)
    : s.state === "inside" ? `Inside ${b.label}'s usual swing, which is about ${s.range}.`
    : s.state === "edge" ? `At the edge of its usual swing, about ${s.range}.`
    : `More than its usual swing of about ${s.range}.`;
  return { key: b.key, label: b.label, unit, then: fmt(then.v), thenOn: then.d, now: fmt(now.v), nowOn: now.d, change, words, quiet: false, swing: s?.state ?? null, range: s ? (b.swing === "hsCRP" ? s.range : `about ${s.range}`) : undefined };
}

// ── the same window, as figures for the Guide ───────────────────────────────

/** What the Guide is sent when it reads a window: the table and each lane's figures, dates in words so a day it names is a number it was given. */
export function windowWorking(t: Timeline): Record<string, unknown> {
  return {
    name: t.def.name.toLowerCase(), from: dayMonthYear(t.from), to: dayMonthYear(t.to),
    movedAndHeld: t.rows.map((r) => ({ marker: r.key, label: r.label, unit: r.unit, then: r.then, thenOn: r.thenOn ? dayMonthYear(r.thenOn) : null, now: r.now, nowOn: r.nowOn ? dayMonthYear(r.nowOn) : null, change: r.change, moreThanItsUsualSwing: r.words })),
    lanes: t.lanes.map((l) => ({ marker: l.key, label: l.label, how: l.sub, values: l.values.slice(-40) })),
    wearableChangedOn: t.changes.map((c) => dayMonthYear(c.day)),
    nothingLogged: t.gap ? `${dayMonthYear(t.gap.from)} to ${dayMonthYear(t.gap.to)}` : null,
    notes: t.notes,
    usualSwing: usualSwingForGuide(),
  };
}

/** The swing figures as the Guide is told them: how far two results from one person can differ with nothing having changed. */
export function usualSwingForGuide(): Record<string, string> {
  const m = SWING.markers;
  return {
    what: "How far two results from one person can differ with nothing having changed. A difference inside it is not a rise and not a fall.",
    ldl: `about ${Math.round(m.ldlC.swingLowPct)} to ${Math.round(m.ldlC.swingHighPct)}%`,
    apob: `about ${Math.round(m.apoB.swingLowPct)}%`,
    hba1c: `about ${m.hba1c.swingLowPct} to ${m.hba1c.swingHighPct}% of the value`,
    fasting_glucose: `about ${Math.round(m.fastingGlucose.swingLowPct)}%`,
    hs_crp: `a rise to more than ${(1 + m.hsCRP.risePct / 100).toFixed(1)} times, or a fall of more than ${m.hsCRP.fallPct}%`,
    lpa: "shown once; never a trend",
    others: "no figure on file: describe the two results without calling the gap a change",
  };
}
