/**
 * In depth, across time (canvas "Verve, one story in four parts", board 04,
 * built 11 Nov 2026; redrawn on the canvas "Verve, In depth redrawn", built
 * 12 Nov 2026). The page answers "how did I get here?": not by topic but over
 * five windows, a card for each marker.
 *
 *   WINDOWS        1 month · 3 months · 6 months · 1 year (opens first) · 3 years
 *   timelineOf     one window: the cards under their headings, the one line
 *                  that counts them, and the notes that keep it honest
 *   windowWorking  the same window as plain figures, for the Guide to read
 *
 * A card is three figures over one chart, and one sentence under it:
 *   Baseline   where the person stood when the window began: the two-week
 *              average to its first day, or the test or report nearest it. The
 *              dashed line on the chart is this figure.
 *   Average    the mean across the window. Left out for a marker with fewer
 *              than three points; a marker drawn test by test says how many.
 *   Now        the two-week average to today, or the latest test or report,
 *              with how far it sits from the baseline in the marker's own unit.
 *
 * Which window shows what, and what one point stands for:
 *   every window   the weekly dose (a week a bar; a month a bar across a year;
 *                  three months a bar across three), resting heart rate, sleep,
 *                  steps and weight (a week's average; a month's from a year up;
 *                  the month also shows each day behind the line)
 *   3 months up    fitness tests, each one a mark
 *   6 months up    blood work, each result a mark (the founder's rule, 11 Nov
 *                  2026: three months is too narrow for two reports to differ
 *                  by more than their usual swing)
 *
 * Rules, each from the research behind the canvases:
 *   · a marker is compared with itself, never with anyone else, and never with
 *     another marker: each card has its own scale and no two share a plot
 *   · no chart is drawn tighter than a set span (MIN_SPAN), so a small move
 *     looks small: the founder's recording of 12 Nov 2026 showed five beats of
 *     resting heart rate filling a lane
 *   · a change between two blood results is said to be inside, at the edge of,
 *     or more than that marker's usual swing (data/usual-swing.ts, the app's
 *     thresholds file), and the swing is a shaded band around the baseline; a
 *     marker with no figure on file says so and draws no band
 *   · a change of wearable is marked on the line, the line breaks, the baseline
 *     stops there, and nothing is compared across it
 *   · a stretch with nothing logged is left empty, never drawn as zero
 *   · a blood result that repeats unchanged from one entry to the next is one
 *     result, drawn and compared once, at its first date (12 Nov 2026)
 *   · Lp(a) is shown once and never as a trend
 *   · no colour and no word marks a change as good or bad
 *
 * Pure: geometry comes out as shares of the plot (x and y from 0 to 1), so the
 * view draws it at any width. Every figure is the derive layer's own.
 */
import type { PersonData } from "./person.ts";
import { addDays, daysBetween, mondayOf } from "./format.ts";
import { fitnessSummary, type WeekRow } from "./activity.ts";
import { metsOfTest } from "./fitness.ts";
import { LABELS, methodLabel, type Pt } from "./markers.ts";
import { weightSeries } from "./lenses.ts";
import SWING from "../../data/usual-swing.ts";
import { swingOf } from "./swing.ts";

/** Where a change between two results sits against a marker's usual swing (derive/swing.ts: Horizon reads the same rule). */
export { swingOf };

// ── the windows ─────────────────────────────────────────────────────────────

export const WINDOW_KEYS = ["1m", "3m", "6m", "1y", "3y"] as const;
export type WindowKey = (typeof WINDOW_KEYS)[number];
/** One year opens first: it sets the same season against itself. */
export const DEFAULT_WINDOW: WindowKey = "1y";
type BarUnit = "week" | "month" | "quarter";
type LineUnit = "week" | "month";
export interface WindowDef {
  key: WindowKey; label: string;
  /** The switch's label on a phone; a screen reader hears `label`. */
  short: string;
  months: number;
  /** "The last year": the heading, and the Guide's name for the window. */
  name: string;
  /** "this year": how a figure and the head's link call the window in view. */
  these: string;
  /** What one bar of the dose stands for, and what one point of a line does. */
  bars: BarUnit; line: LineUnit;
  /** The month alone has a point for every day: they sit behind the line. */
  days: boolean;
  fitness: boolean; blood: boolean;
}
export const WINDOWS: Record<WindowKey, WindowDef> = {
  "1m": { key: "1m", label: "1 month", short: "1 mo", months: 1, name: "The last month", these: "this month", bars: "week", line: "week", days: true, fitness: false, blood: false },
  "3m": { key: "3m", label: "3 months", short: "3 mo", months: 3, name: "The last three months", these: "these three months", bars: "week", line: "week", days: false, fitness: true, blood: false },
  "6m": { key: "6m", label: "6 months", short: "6 mo", months: 6, name: "The last six months", these: "these six months", bars: "week", line: "week", days: false, fitness: true, blood: true },
  "1y": { key: "1y", label: "1 year", short: "1 yr", months: 12, name: "The last year", these: "this year", bars: "month", line: "month", days: false, fitness: true, blood: true },
  "3y": { key: "3y", label: "3 years", short: "3 yr", months: 36, name: "The last three years", these: "these three years", bars: "quarter", line: "month", days: false, fitness: true, blood: true },
};
export const isWindowKey = (k: string): k is WindowKey => (WINDOW_KEYS as readonly string[]).includes(k);

/** The blood markers that get a card, in the Body page's order of interest. */
const BLOOD: { key: string; label: string; /** The name inside a sentence, when it is not the label as it stands. */ said?: string; swing: keyof typeof SWING.markers | null; dp: number; points?: boolean }[] = [
  { key: "ldl_mgdl", label: "LDL", swing: "ldlC", dp: 1 },
  { key: "apo_b_mgdl", label: "ApoB", swing: "apoB", dp: 1 },
  { key: "hba1c_pct", label: "HbA1c", swing: "hba1c", dp: 1, points: true },
  { key: "glucose_mgdl", label: "Fasting glucose", said: "fasting glucose", swing: "fastingGlucose", dp: 1 },
  { key: "triglycerides_mgdl", label: "Triglycerides", swing: null, dp: 1 },
  { key: "hs_crp_mgl", label: "hs-CRP", swing: "hsCRP", dp: 2 },
];
/** The card a figure elsewhere on the page leads to: an Overview section, a Horizon marker, a Guide line. */
export const LANE_FOR: Record<string, string> = {
  // the Overview's sections
  fitness: "fitness", vitals: "rhr", sleep: "sleep", exertion: "dose", movement: "dose", body: "weight",
  // Horizon's markers (horizon/derive MarkerKey)
  mets: "fitness", vo2: "fitness", dose: "dose", zone2_week: "dose", strength_week: "dose", longest_session: "dose",
  rhr: "rhr", steps: "steps", weight: "weight",
  ldl: "ldl_mgdl", apob: "apo_b_mgdl", hba1c: "hba1c_pct", fasting_glucose: "glucose_mgdl", triglycerides: "triglycerides_mgdl", hs_crp: "hs_crp_mgl",
};

/**
 * The narrowest span a chart is drawn across (canvas "In depth redrawn", board
 * 03): 16 beats, 3 hours, 8,000 steps, 5 kg, 2 METs. A blood marker's chart
 * holds its baseline and the swing around it; one with no swing on file spans
 * at least two fifths of its value.
 */
const MIN_SPAN = { rhr: 16, sleep: 3, steps: 8000, weight: 5, fitness: 2, bloodShare: 0.4 };
/** How far two figures can sit apart and still be said to have held. The dose's is a share of the weekly goal. */
const HELD = { rhr: 3, sleepMin: 20, steps: 500, weight: 0.5, fitness: 0.5, doseShare: 0.1 };

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
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const countWord = (n: number) => COUNT[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A weight or a fitness figure: always one decimal, so 79.0 sits beside 76.9. */
const one = (v: number) => v.toFixed(1);
const hmOf = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };

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

export interface XY { x: number; y: number }
/** Where a line's word sits: centred at `at` along it, over or under it; `shown` is false when nothing drawn leaves it room, and the sentence under the chart names the line. */
export interface Spot { at: number; above: boolean; shown: boolean }
/** One of a card's three figures: its label, the figure, and the small line under it (shorter on a phone). */
export interface Fig { label: string; value: string; sub: string; short: string; /** What the figure is, said in full on hover. */ title?: string }
/** Where a card's answer falls in the line that counts them. */
export type CardState = "moved" | "held" | "edge" | "notCompared" | "noSwing" | "once";
export interface CardChart {
  /** The scale: figures on the left edge, with a faint line across at each. */
  ticks: { y: number; label: string }[];
  /** The dashed line: where the person stood when the window began. It stops where a new wearable begins. */
  baseline: ({ y: number; x0: number; x1: number; label: string } & Spot) | null;
  /** The weekly goal, across the bars. */
  goal: ({ y: number; label: string } & Spot) | null;
  /** A blood marker's usual swing around its baseline; `inner` is the part inside the swing's lower figure, so the rim is its edge. */
  band: { x0: number; y0: number; y1: number; inner: { y0: number; y1: number } | null } | null;
  bars: { x0: number; x1: number; h: number; reached: boolean; title: string }[];
  /** Each day behind the line: the month alone. */
  days: XY[];
  /** The line of averages, in the pieces a gap or a change of wearable breaks it into. */
  lines: XY[][];
  /** Faint links: between two tests of one method, or across a stretch with no weighing. */
  links: XY[][];
  /** The averages the line is drawn from, one point each. */
  points: (XY & { title: string })[];
  /** A test or a report: a mark and its figure. */
  marks: (XY & { shape: "dot" | "diamond"; label: string | null; above: boolean; title: string })[];
  /** A change of wearable. */
  wearable: { x: number; text: string; title: string }[];
  /** A stretch with nothing logged. */
  gaps: { x0: number; x1: number }[];
}
export interface Card {
  key: string; label: string;
  kind: "bars" | "line" | "marks";
  /** The small line under the name: the unit, and what one point stands for. */
  how: string;
  baseline: Fig; middle: Fig | null; now: Fig;
  chart: CardChart;
  /** One sentence: moved, held, not compared, or where a blood change sits against its usual swing. */
  answer: string;
  /** What the chart's lines mean, said in the sentence where there is no room beside them: on a phone, and (`legendWide`) for a line whose word found no room on the chart. */
  legend: string; legendWide: string;
  quiet: boolean;
  state: CardState;
  /** "The record begins on …": a marker with only part of the window on file. */
  begins: string | null;
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
  /** A row that says why nothing is compared. */
  quiet: boolean;
  swing: "inside" | "edge" | "more" | null;
  /** A blood marker's usual swing, in words, when one is on file: "about 26 to 27%". */
  range?: string;
}
export interface Timeline {
  def: WindowDef; from: string; to: string;
  /** The window was started after a gap, at the person's word. */
  custom: boolean;
  cards: Card[];
  /** The cards under their headings; a heading with nothing in the window is not here. */
  groups: { key: string; title: string; cards: Card[] }[];
  /** The window in one line: how many moved, held, sit at the edge of their swing, and so on. */
  digest: { state: CardState; label: string; short: string; n: number }[];
  /** The months, or the weeks, under every chart. */
  axis: { x: number; label: string }[];
  /** Each marker's baseline beside its latest figure: what the Guide reads first, and what a read's figures are taken from. */
  rows: MoveRow[];
  notes: string[];
  /** Lp(a): one line, never a card. */
  once: string | null;
  /** The longest stretch of four weeks or more with nothing logged; the page offers to start after it. */
  gap: { from: string; to: string } | null;
  changes: WriterChange[];
  empty: boolean;
}
export type TimelinePerson = Pick<PersonData, "weeks" | "crf" | "signals" | "weights" | "by" | "goal">;

const DIGEST: { state: CardState; label: string; short: string }[] = [
  { state: "moved", label: "Moved", short: "Moved" }, { state: "held", label: "Held", short: "Held" },
  { state: "edge", label: "At the edge of its swing", short: "At the edge" }, { state: "notCompared", label: "Not compared", short: "Not compared" },
  { state: "noSwing", label: "No swing on file", short: "No swing on file" }, { state: "once", label: "Measured once", short: "Measured once" },
];

// ── buckets ─────────────────────────────────────────────────────────────────

type Span = { from: string; to: string };
function spansOf(from: string, to: string, unit: BarUnit): Span[] {
  const out: Span[] = [];
  if (unit === "week") { for (let d = mondayOf(new Date(from + "T00:00:00")); d <= to; d = addDays(d, 7)) out.push({ from: d, to: addDays(d, 6) }); return out; }
  const step = unit === "quarter" ? 3 : 1;
  // a month, or a quarter of the calendar year: January to March, April to June, and so on
  const m0 = Number(from.slice(5, 7)) - 1, first = unit === "quarter" ? Math.floor(m0 / 3) * 3 : m0;
  for (let d = `${from.slice(0, 4)}-${String(first + 1).padStart(2, "0")}-01`; d <= to; d = addMonths(d, step)) out.push({ from: d, to: addDays(addMonths(d, step), -1) });
  return out;
}
const EACH: Record<BarUnit, string> = { week: "each week's average", month: "each month's average", quarter: "each three months' average" };
/** The fewest days that make a point: about five of a week's seven nights, about ten of a month's. In the month every day is on the page behind the line, so one day is a point. */
const MIN_DAYS: Record<LineUnit, number> = { week: 5, month: 10 };

// ── a chart's scale, and where its words sit ────────────────────────────────

/** The largest step of 1, 2 or 5 (times ten to a power) that still puts two steps in the span. */
function niceStep(span: number): number {
  const raw = span / 2, pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [5, 2, 1]) if (m * pow <= raw) return m * pow;
  return pow;
}
interface Scale { y: (v: number) => number; ticks: { y: number; label: string }[] }
/**
 * A chart's own scale: centred on what it has to hold, never tighter than
 * `minSpan`, never below `floor`. The figures on its left edge are round ones.
 */
function scaleOf(vs: number[], minSpan: number, label: (v: number, step: number) => string, floor: number | null = 0): Scale {
  const lo0 = Math.min(...vs), hi0 = Math.max(...vs);
  const span = Math.max(minSpan, (hi0 - lo0) * 1.3, 1e-6);
  let lo = (lo0 + hi0) / 2 - span / 2;
  if (floor != null && lo < floor) lo = floor;
  const hi = lo + span, step = niceStep(span);
  const ticks: Scale["ticks"] = [];
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) {
    const v = Math.round(k * step * 1e6) / 1e6, y = (v - lo) / span;
    if (y >= 0.04 && y <= 0.96) ticks.push({ y, label: label(v, step) });
  }
  return { y: (v) => clamp01((v - lo) / span), ticks };
}
const tickBy = (v: number, step: number) => (step >= 1 ? whole(v) : trim(v, step >= 0.1 ? 1 : 2));

/**
 * Where a line's word ("baseline 53", "goal 1,000") sits: over or under its
 * line, at the end or the stretch where it is furthest from anything drawn. The
 * ends come first, so the word sits at the right end unless somewhere else is
 * clearly freer. Distances are in the pixels of a chart about 360 wide and 112
 * tall; the word is about 80 by 12. With no room anywhere it is not shown.
 */
function labelSpot(y: number, x0: number, x1: number, drawn: XY[], also: number[] = []): Spot {
  const W = 360, H = 112, hw = 0.11, hh = 0.055, off = 0.085, ROOM = 3, PLENTY = 30;
  const lo = Math.min(x0 + hw, 1 - hw), hi = Math.max(x1 - hw, hw);
  const xs = hi > lo ? [hi, lo, ...also.filter((x) => x > lo && x < hi), ...[0.5, 0.75, 0.25].map((f) => lo + (hi - lo) * f)] : [hi];
  let best: { s: number; at: number; above: boolean } | null = null;
  for (const at of xs) for (const above of [true, false]) {
    const cy = y + (above ? off : -off);
    if (cy > 0.95 || cy < 0.06) continue;
    let s = PLENTY;
    for (const o of drawn) s = Math.min(s, Math.hypot(Math.max(0, Math.abs(o.x - at) - hw) * W, Math.max(0, Math.abs(o.y - cy) - hh) * H));
    if (!best || s > best.s + 0.5) best = { s, at, above };
  }
  return best ? { at: best.at, above: best.above, shown: best.s >= ROOM } : { at: xs[0], above: y < 0.5, shown: false };
}
/** What the sentence under a chart says of its lines: on a phone both, and at any width the ones whose word found no room. */
function legendsOf(goal: Spot | null, baseline: Spot | null): { legend: string; legendWide: string } {
  const say = (g: boolean, b: boolean) => (g && b ? "Solid line: the goal. Dashed: the baseline." : g ? "Solid line: the goal." : b ? "Dashed line: the baseline." : "");
  return { legend: say(!!goal, !!baseline), legendWide: say(!!goal && !goal.shown, !!baseline && !baseline.shown) };
}
/** A mark's figure sits over it, or under it when the mark is near the top or sits below the baseline. */
const figureAbove = (y: number, baseY: number | null, isBase: boolean) => !(y > 0.8) && !(!isBase && baseY != null && y < baseY - 0.03 && y > 0.16);
const emptyChart = (): CardChart => ({ ticks: [], baseline: null, goal: null, band: null, bars: [], days: [], lines: [], links: [], points: [], marks: [], wearable: [], gaps: [] });

/** How far the latest figure sits from the baseline, in words: "330 more than the baseline", and "330 more" on a phone. */
function versus(diff: number, text: string, short: string, words: [string, string], than = true): { sub: string; short: string } {
  if (!diff) return { sub: "the same as the baseline", short: "the same" };
  const w = diff > 0 ? words[0] : words[1];
  return { sub: `${text} ${w}${than ? " than" : ""} the baseline`, short: `${short} ${w}` };
}
const MORE: [string, string] = ["more", "less"], COUNTED: [string, string] = ["more", "fewer"], LEVEL: [string, string] = ["higher", "lower"], BLOODWORDS: [string, string] = ["over", "under"];

// ── one window ──────────────────────────────────────────────────────────────

export function timelineOf(d: TimelinePerson, key: WindowKey, today: string, opts: { from?: string } = {}): Timeline {
  const def = WINDOWS[key];
  const anchor = addMonths(today, -def.months);
  const from = opts.from && opts.from > anchor && opts.from < today ? opts.from : anchor;
  const custom = from !== anchor;
  const span = Math.max(1, daysBetween(from, today));
  const xOf = (day: string) => clamp01(daysBetween(from, day) / span);
  const inWin = (day: string) => day >= from && day <= today;
  const mondayNow = mondayOf(new Date(today + "T00:00:00"));
  const changes = writerChanges(d.signals).filter((c) => c.day > from && c.day <= today);
  const cards: Card[] = [];
  const rows: MoveRow[] = [];
  const notes: string[] = [];
  /** A day as a figure's small line says it: the year only when it is not this one. */
  const on = (day: string) => (day.slice(0, 4) === today.slice(0, 4) ? dayMonth(day) : dayMonthYear(day));
  const onShort = (day: string) => `${dayMonthShort(day)}${day.slice(0, 4) === today.slice(0, 4) ? "" : ` ${yy(day)}`}`;
  const single = (label: string, unit: string, now: string, nowOn: string | null, words: string): MoveRow => ({ key: "", label, unit, then: "—", thenOn: null, now, nowOn, change: "—", words, quiet: true, swing: null });
  /** A marker with only part of the window on file: the rest of its chart is left empty, and the card says when its record begins. */
  const beginsOf = (first: string, anyBefore: boolean) => (!anyBefore && daysBetween(from, first) > span * 0.25 ? `The record begins on ${dayMonthYear(first)}.` : null);
  const spot = (y: number, x0: number, x1: number, label: string, drawn: XY[], also: number[] = []): NonNullable<CardChart["baseline"]> => ({ y, x0, x1, label, ...labelSpot(y, x0, x1, drawn, also) });

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
    const buckets = spansOf(from, addDays(mondayNow, -1), def.bars).map((s) => { const vs = weekStarts.filter((m) => m >= s.from && m <= s.to).map(doseOfWeek).filter((v): v is number => v != null); return { ...s, v: mean(vs), n: vs.length }; });
    // the baseline and the latest figure: the mean of the last complete weeks, and of the same count before the window
    const n = def.months === 1 ? 4 : 8;
    const avg = (ms: string[]) => { const vs = ms.map(doseOfWeek).filter((v): v is number => v != null); return vs.length >= 2 ? { v: mean(vs)!, n: vs.length } : null; };
    const firstMon = mondayOf(new Date(from + "T00:00:00"));
    const before = [...weeks.keys()].filter((m) => m < firstMon).sort().slice(-n);
    const nowA = avg(logged.slice(-n)), thenA = avg(before);
    const nowV = nowA?.v ?? null, thenV = thenA?.v ?? null;
    const top = Math.max(goal * 1.2, (thenV ?? 0) * 1.08, ...buckets.map((b) => (b.v ?? 0) * 1.08));
    const yb = (v: number) => clamp01(v / top);
    const step = niceStep(top);
    const chart = emptyChart();
    for (let k = 0; k * step <= top * 0.96; k++) chart.ticks.push({ y: (k * step) / top, label: whole(k * step) });
    const pad = 0.12;
    chart.bars = buckets.filter((b) => b.v != null).map((b) => {
      const x0 = xOf(b.from < from ? from : b.from), x1 = xOf(addDays(b.to, 1) > today ? today : addDays(b.to, 1)), w = x1 - x0;
      const what = def.bars === "week" ? `Week of ${dayMonth(b.from)}` : def.bars === "month" ? `${monthLong(b.from)} ${b.from.slice(0, 4)}` : `${monthShort(b.from)} to ${monthShort(b.to)} ${b.to.slice(0, 4)}`;
      return { x0: x0 + w * pad, x1: x1 - w * pad, h: yb(b.v!), reached: b.v! >= goal, title: `${what}: ${whole(b.v!)} MET-min${def.bars === "week" ? "" : ` a week, the average of ${b.n} ${b.n === 1 ? "week" : "weeks"}`}` };
    });
    // runs of weeks with nothing logged, between the first and the last logged week
    const gaps: Span[] = [];
    let run: string[] = [];
    for (const m of weekStarts) {
      if (m <= logged[0] || m >= logged[logged.length - 1]) continue;
      if (doseOfWeek(m) == null) run.push(m); else { if (run.length >= 4) gaps.push({ from: run[0], to: addDays(run[run.length - 1], 6) }); run = []; }
    }
    if (run.length >= 4) gaps.push({ from: run[0], to: addDays(run[run.length - 1], 6) });
    gap = gaps.slice().sort((a, b) => daysBetween(b.from, b.to) - daysBetween(a.from, a.to))[0] ?? null;
    chart.gaps = gaps.map((g) => ({ x0: xOf(g.from), x1: xOf(addDays(g.to, 1)) }));
    // what a line's word must keep clear of: the bars, the other line and its word; an empty stretch is a place to look for room
    const drawn: XY[] = [];
    for (const b of chart.bars) for (const x of [b.x0, (b.x0 + b.x1) / 2, b.x1]) for (let y = 0; y <= b.h + 0.001; y += 0.05) drawn.push({ x, y });
    const across = (y: number) => Array.from({ length: 21 }, (_, i) => ({ x: i / 20, y }));
    const free = chart.gaps.map((g) => (g.x0 + g.x1) / 2);
    const gy = yb(goal), by0 = thenV != null ? yb(thenV) : null;
    chart.goal = { y: gy, label: `goal ${whole(goal)}`, ...labelSpot(gy, 0, 1, [...drawn, ...(by0 != null ? across(by0) : [])], free) };
    if (by0 != null) chart.baseline = spot(by0, 0, 1, `baseline ${whole(thenV!)}`, [...drawn, ...across(gy), ...(chart.goal.shown ? [{ x: chart.goal.at, y: gy + (chart.goal.above ? 0.085 : -0.085) }] : [])], free);

    const judged = weekStarts.slice(-13), reachedOf = (ms: string[]) => ms.filter((m) => { const v = doseOfWeek(m); return v != null && v >= goalOf(weeks.get(m)); }).length;
    const words = `Goal reached in ${reachedOf(judged)} of the last ${judged.length} ${judged.length === 1 ? "week" : "weeks"}.`;
    const diff = nowV != null && thenV != null ? Math.round(nowV) - Math.round(thenV) : 0;
    const state: CardState = nowV == null || thenV == null ? "notCompared" : Math.abs(nowV - thenV) < goal * HELD.doseShare ? "held" : "moved";
    const allAvg = logged.length >= 3 ? mean(logged.map((m) => doseOfWeek(m)!))! : null;
    cards.push({
      key: "dose", label: "Weekly dose", kind: "bars", how: def.bars === "week" ? "MET-min · a week a bar" : `MET-min a week · ${EACH[def.bars]}`,
      baseline: thenA ? { label: "Baseline", value: whole(thenA.v), sub: `${countWord(thenA.n)} weeks to ${onShort(from)}`, short: `to ${onShort(from)}`, title: `The average of the ${countWord(thenA.n)} complete weeks before ${dayMonthYear(from)}` }
        : { label: "Baseline", value: "—", sub: "nothing logged before this window", short: "none before" },
      middle: def.months === 1 ? { label: "Weeks", value: String(logged.length), sub: `${reachedOf(logged)} reached the goal`, short: `${reachedOf(logged)} reached` }
        : allAvg != null ? { label: "Average", value: whole(allAvg), sub: `a week, ${def.these}`, short: def.these, title: `The mean of the ${logged.length} complete weeks logged in this window` } : null,
      now: nowA ? { label: "Now", value: whole(nowA.v), ...(thenV != null ? versus(diff, whole(Math.abs(diff)), whole(Math.abs(diff)), MORE) : { sub: `the last ${countWord(nowA.n)} weeks`, short: `last ${nowA.n} weeks` }), title: `The average of the last ${countWord(nowA.n)} complete weeks` }
        : { label: "Now", value: "—", sub: "fewer than two weeks logged", short: "too few weeks" },
      chart, state, quiet: false,
      answer: `${def.bars === "week" ? `${words.slice(0, -1)}, the bars in full colour.` : `${words} Bars in full colour are ${def.bars === "month" ? "months" : "three-month stretches"} whose average reached it.`}${def.months === 1 ? " The week in hand is not drawn until it is whole." : ""}`,
      ...legendsOf(chart.goal, chart.baseline),
      begins: beginsOf(logged[0], before.length > 0),
      values: buckets.filter((b) => b.v != null).map((b) => ({ on: dayMonthYear(b.from), v: Math.round(b.v!) })),
      alt: `The weekly dose across ${def.name.toLowerCase()} against the goal of ${whole(goal)} MET-minutes${thenV != null ? ` and a baseline of ${whole(thenV)}` : ""}${gaps.length ? ", with a stretch where nothing was logged" : ""}`,
    });
    if (nowV != null) rows.push({ key: "dose", label: "Weekly dose, average", unit: "MET-min", then: thenV != null ? whole(thenV) : "—", thenOn: thenV != null ? from : null, now: whole(nowV), nowOn: today,
      change: thenV != null ? signedText(nowV - thenV, whole(Math.abs(nowV - thenV))) : "—", words, quiet: false, swing: null });
  }

  // ── the wearable's lines: resting heart rate, sleep, steps ──
  const rowsIn = (d.signals ?? []).filter((r) => inWin(String(r.day)));
  const cut = changes[changes.length - 1] ?? null;
  const minDays = def.days ? 1 : MIN_DAYS[def.line];
  type Judged = { change: string; words: string; state: CardState; sub: string; short: string };
  const wearable = (o: { key: string; label: string; col: string; unit: string; minSpan: number; conv: (v: number) => number; fmt: (v: number) => string; tick: (v: number, step: number) => string; breakAtChange: boolean; avgSub: string; noThen: string; judge: (thenV: number, nowV: number) => Judged }) => {
    const have = rowsIn.filter((r) => r[o.col] != null);
    if (!have.length) return;
    const crossed = o.breakAtChange && !!cut;
    const buckets = spansOf(from, today, def.line).map((s) => {
      let days = have.filter((r) => String(r.day) >= s.from && String(r.day) <= s.to);
      // a bucket a change of wearable falls in is the new wearable's days when it has enough of them, else the old one's
      const split = crossed && cut!.day > s.from && cut!.day <= s.to;
      let side: "before" | "after" | null = null;
      if (split) { const after = days.filter((r) => String(r.day) >= cut!.day), bef = days.filter((r) => String(r.day) < cut!.day); if (after.length >= minDays) { days = after; side = "after"; } else { days = bef; side = "before"; } }
      const v = days.length >= minDays ? o.conv(mean(days.map((r) => Number(r[o.col])))!) : null;
      // the point sits at the middle of the days it was made from, so one made of the new wearable's days never falls before its mark
      const lo0 = side === "after" ? cut!.day : s.from, hi0 = side === "before" ? addDays(cut!.day, -1) : s.to;
      const lo = lo0 < from ? from : lo0, hi = hi0 > today ? today : hi0;
      return { ...s, v, mid: addDays(lo, Math.floor(daysBetween(lo, hi) / 2)), after: crossed ? (side ? side === "after" : s.from >= cut!.day) : false };
    });
    const real = buckets.filter((b) => b.v != null);
    if (!real.length) return;
    // a two-week average at each end of the window
    const avg14 = (end: string) => { const xs = (d.signals ?? []).filter((r) => String(r.day) > addDays(end, -14) && String(r.day) <= end && r[o.col] != null).map((r) => Number(r[o.col])); return xs.length >= 5 ? o.conv(mean(xs)!) : null; };
    const nowV = avg14(today), thenV = avg14(from);
    const days = def.days ? have.map((r) => ({ d: String(r.day), v: o.conv(Number(r[o.col])) })) : [];
    const sc = scaleOf([...real.map((b) => b.v!), ...days.map((x) => x.v), ...(thenV != null ? [thenV] : []), ...(nowV != null ? [nowV] : [])], o.minSpan, o.tick);
    const chart = emptyChart();
    chart.ticks = sc.ticks;
    let seg: XY[] = [], prevAfter = false;
    for (const b of buckets) {
      if (b.v == null || (seg.length && b.after !== prevAfter)) { if (seg.length) chart.lines.push(seg); seg = []; }
      if (b.v != null) { seg.push({ x: xOf(b.mid), y: sc.y(b.v) }); prevAfter = b.after; }
    }
    if (seg.length) chart.lines.push(seg);
    const unit = o.unit ? ` ${o.unit}` : "";
    chart.points = real.map((b) => ({ x: xOf(b.mid), y: sc.y(b.v!), title: `${def.line === "week" ? `Week of ${dayMonth(b.from < from ? from : b.from)}` : `${monthLong(b.from)} ${b.from.slice(0, 4)}`}: ${o.fmt(b.v!)}${unit}` }));
    chart.days = days.map((x) => ({ x: xOf(x.d), y: sc.y(x.v) }));
    chart.wearable = o.breakAtChange ? changes.map((c) => ({ x: xOf(c.day), text: `new wearable, ${onShort(c.day)}`, title: `${c.to} in place of ${c.from} from ${dayMonthYear(c.day)}` })) : [];
    if (thenV != null) chart.baseline = spot(sc.y(thenV), 0, crossed ? xOf(cut!.day) : 1, `baseline ${o.fmt(thenV)}`, [...chart.points, ...chart.days]);
    const j: Judged = crossed ? { change: "—", words: `Not compared: the wearable changed on ${on(cut!.day)}.`, state: "notCompared", sub: "from a new wearable", short: "new wearable" }
      : thenV == null || nowV == null ? { change: "—", words: o.noThen, state: "notCompared", sub: "two weeks to today", short: "to today" }
      : o.judge(thenV, nowV);
    const quiet = j.state === "notCompared";
    const all = mean(have.map((r) => o.conv(Number(r[o.col]))))!;
    const firstDay = String(have[0].day);
    cards.push({
      key: o.key, label: o.label, kind: "line", how: `${o.unit ? `${o.unit} · ` : ""}${EACH[def.line]}`,
      baseline: thenV != null ? { label: "Baseline", value: o.fmt(thenV), sub: `two weeks to ${onShort(from)}`, short: `to ${onShort(from)}`, title: `The average of the two weeks to ${dayMonthYear(from)}` }
        : { label: "Baseline", value: "—", sub: "nothing at the start of this window", short: "none at the start" },
      middle: real.length >= 3 ? { label: "Average", value: o.fmt(all), sub: o.avgSub, short: def.these, title: `The mean of the ${have.length} days recorded in this window` } : null,
      now: nowV != null ? { label: "Now", value: o.fmt(nowV), sub: j.sub, short: j.short, title: "The average of the two weeks to today" } : { label: "Now", value: "—", sub: "fewer than five days in the last two weeks", short: "too few days" },
      chart, state: j.state, quiet,
      answer: `${j.words}${crossed && thenV != null ? " The baseline stops there." : ""}${def.days ? " Each faint dot is a day." : ""}`,
      ...legendsOf(null, chart.baseline),
      begins: beginsOf(firstDay, (d.signals ?? []).some((r) => String(r.day) < from && r[o.col] != null)),
      values: real.map((b) => ({ on: dayMonthYear(b.from < from ? from : b.from), v: Math.round(b.v! * 10) / 10 })),
      alt: `${o.label} across ${def.name.toLowerCase()}, ${EACH[def.line]}${thenV != null ? `, against a baseline of ${o.fmt(thenV)}${unit}` : ""}${chart.wearable.length ? ", with the day the wearable changed marked and the line broken there" : ""}`,
    });
    if (nowV != null) rows.push({ key: o.key, label: o.label, unit: o.unit, then: thenV != null ? o.fmt(thenV) : "—", thenOn: thenV != null ? from : null, now: o.fmt(nowV), nowOn: today, change: j.change, words: j.words, quiet, swing: null });
  };
  wearable({
    key: "steps", label: "Steps", col: "steps", unit: "a day", minSpan: MIN_SPAN.steps, conv: (v) => v, fmt: whole, tick: (v) => whole(v), breakAtChange: false,
    avgSub: `a day, ${def.these}`, noThen: "No steps at the start of this window to set it against.",
    judge: (t, n) => {
      const dd = Math.round((n - t) / 100) * 100, a = whole(Math.abs(dd)), held = Math.abs(dd) < HELD.steps;
      return { change: signedText(dd, a), state: held ? "held" : "moved", ...versus(dd, a, a, COUNTED),
        words: held ? `Held: within ${whole(HELD.steps)} steps a day of the baseline.` : `About ${a} ${dd > 0 ? "more" : "fewer"} a day than at the baseline.` };
    },
  });

  // ── fitness: each test, in METs, linked only to the next test of its own method ──
  const fit = fitnessSummary(d.crf, today);
  const tests = fit.tests.map((t) => ({ d: String(t.measured_on), v: metsOfTest(t) ?? t.v / 3.5, method: String(t.method ?? "") })).filter((t) => t.d <= today);
  if (def.fitness) {
    const shown = tests.filter((t) => inWin(t.d));
    if (shown.length) {
      const now = shown[shown.length - 1];
      const then = pairOf(tests, from, today).then;
      const same = !!then && then.method === now.method;
      const sc = scaleOf([...shown.map((t) => t.v), ...(then && same ? [then.v] : [])], MIN_SPAN.fitness, tickBy);
      const baseY = then && same ? sc.y(then.v) : null;
      const chart = emptyChart();
      chart.ticks = sc.ticks;
      for (let i = 1; i < shown.length; i++) if (shown[i].method === shown[i - 1].method) chart.links.push([{ x: xOf(shown[i - 1].d), y: sc.y(shown[i - 1].v) }, { x: xOf(shown[i].d), y: sc.y(shown[i].v) }]);
      chart.marks = shown.map((t, i) => { const y = sc.y(t.v); return { x: xOf(t.d), y, shape: "dot" as const, label: shown.length <= 4 || i === 0 || i === shown.length - 1 ? one(t.v) : null, above: figureAbove(y, baseY, t === then), title: `${dayMonthYear(t.d)}: ${one(t.v)} METs by ${methodLabel(t.method)}` }; });
      if (then && same) chart.baseline = spot(baseY!, then.d < from ? 0 : xOf(then.d), 1, `baseline ${one(then.v)}`, chart.marks.flatMap((m) => [m, { x: m.x, y: m.y + (m.above ? 0.13 : -0.13) }]));
      const methods = new Set(shown.map((t) => t.method)).size;
      let row: MoveRow, state: CardState;
      if (!then) { row = { ...single("Fitness", "METs", one(now.v), now.d, "One test in this window."), key: "fitness" }; state = "once"; }
      else if (!same) { row = { key: "fitness", label: "Fitness", unit: "METs", then: one(then.v), thenOn: then.d, now: one(now.v), nowOn: now.d, change: "—", words: "Not compared: the two tests used different methods.", quiet: true, swing: null }; state = "notCompared"; }
      else {
        const run = tests.filter((t) => t.method === now.method && t.d >= then.d && t.d <= now.d);
        const rising = run.every((t, i) => i === 0 || t.v > run[i - 1].v), falling = run.every((t, i) => i === 0 || t.v < run[i - 1].v);
        const held = Math.abs(now.v - then.v) < HELD.fitness;
        state = held ? "held" : "moved";
        row = { key: "fitness", label: "Fitness", unit: "METs", then: one(then.v), thenOn: then.d, now: one(now.v), nowOn: now.d, change: signedText(now.v - then.v, trim(Math.abs(now.v - then.v), 1)),
          words: `${cap(countWord(run.length))} tests of one method${held ? ", within half a MET of each other" : run.length > 2 && rising ? ", each higher than the last" : run.length > 2 && falling ? ", each lower than the last" : ""}.`, quiet: false, swing: null };
      }
      const dd = then ? Math.round(now.v * 10) - Math.round(then.v * 10) : 0;
      cards.push({
        key: "fitness", label: "Fitness", kind: "marks", how: "METs · each test",
        baseline: then ? { label: "Baseline", value: one(then.v), sub: `test of ${on(then.d)}`, short: onShort(then.d) } : { label: "Baseline", value: "—", sub: "one test in this window", short: "one test" },
        middle: { label: "Tests", value: String(shown.length), sub: methods === 1 ? "one method" : `${countWord(methods)} methods`, short: methods === 1 ? "one method" : `${methods} methods` },
        now: { label: "Now", value: one(now.v), ...(!then ? { sub: `test of ${on(now.d)}`, short: onShort(now.d) } : !same ? { sub: "by another method", short: "another method" } : versus(dd, trim(Math.abs(dd) / 10, 1), trim(Math.abs(dd) / 10, 1), MORE)) },
        chart, state, quiet: row.quiet, answer: row.words, ...legendsOf(null, chart.baseline), begins: null,
        values: shown.map((t) => ({ on: dayMonthYear(t.d), v: Math.round(t.v * 10) / 10 })),
        alt: `${shown.length === 1 ? "One fitness test" : `${cap(countWord(shown.length))} fitness tests`} across ${def.name.toLowerCase()}: ${shown.map((t) => one(t.v)).join(", ")} METs`,
      });
      rows.push(row);
    } else if (tests.length) notes.push(`Fitness: the latest test is from ${dayMonthYear(tests[tests.length - 1].d)}, before this window.`);
  } else notes.push("Fitness tests are drawn from three months up: a test repeats every eight weeks at the soonest.");

  // ── weight: a week's or a month's average, so many weighings are one point and not a string of dots ──
  const weighings = weightSeries(d.weights ?? []).filter((p) => p.d <= today);
  const wShown = weighings.filter((p) => inWin(p.d));
  if (wShown.length) {
    const { then, now } = pairOf(weighings, from, today);
    const buckets = spansOf(from, today, def.line).map((s, i) => {
      const ps = wShown.filter((p) => p.d >= s.from && p.d <= s.to);
      // the point sits at the middle of the days it was weighed on
      return ps.length ? { ...s, i, v: mean(ps.map((p) => p.v))!, at: addDays(ps[0].d, Math.round(mean(ps.map((p) => daysBetween(ps[0].d, p.d)))!)), n: ps.length } : null;
    }).filter((b): b is NonNullable<typeof b> => b != null);
    const sc = scaleOf([...buckets.map((b) => b.v), now!.v, ...(then ? [then.v] : [])], MIN_SPAN.weight, tickBy);
    const chart = emptyChart();
    chart.ticks = sc.ticks;
    // a solid line joins one week (or month) to the next; across a stretch with no weighing the link is faint
    let seg: XY[] = [];
    buckets.forEach((b, k) => {
      const p = { x: xOf(b.at), y: sc.y(b.v) }, prev = buckets[k - 1];
      if (prev && b.i - prev.i > 1) { const last = seg[seg.length - 1]; if (seg.length > 1) chart.lines.push(seg); chart.links.push([last, p]); seg = [p]; } else seg.push(p);
    });
    if (seg.length > 1) chart.lines.push(seg);
    chart.points = buckets.map((b) => ({ x: xOf(b.at), y: sc.y(b.v), title: `${def.line === "week" ? `Week of ${dayMonth(b.from < from ? from : b.from)}` : `${monthLong(b.from)} ${b.from.slice(0, 4)}`}: ${one(b.v)} kg${b.n > 1 ? `, the average of ${b.n} weighings` : ""}` }));
    if (then) chart.baseline = spot(sc.y(then.v), then.d <= from ? 0 : xOf(then.d), 1, `baseline ${one(then.v)}`, chart.points);
    const dd = then ? Math.round(now!.v * 10) - Math.round(then.v * 10) : 0, a = trim(Math.abs(dd) / 10, 1);
    const held = Math.abs(dd) / 10 < HELD.weight;
    const state: CardState = !then ? "once" : held ? "held" : "moved";
    let row: MoveRow;
    if (!then) row = { ...single("Weight", "kg", one(now!.v), now!.d, "One weighing in this window."), key: "weight" };
    else {
      const wks = Math.max(1, daysBetween(then.d, now!.d) / 7), rate = trim(Math.abs(dd) / 10 / wks, 1);
      row = { key: "weight", label: "Weight", unit: "kg", then: one(then.v), thenOn: then.d, now: one(now!.v), nowOn: now!.d, change: signedText(dd, a),
        words: held ? "Held: within half a kilogram of the baseline." : `${dd < 0 ? "Down" : "Up"} ${a} kg, ${rate === "0" ? "by less than 0.1" : `about ${rate}`} kg a week.`, quiet: false, swing: null };
    }
    cards.push({
      key: "weight", label: "Weight", kind: "line", how: `kg · ${EACH[def.line]}`,
      baseline: then ? { label: "Baseline", value: one(then.v), sub: `weighing of ${on(then.d)}`, short: onShort(then.d) } : { label: "Baseline", value: "—", sub: "one weighing in this window", short: "one weighing" },
      middle: buckets.length >= 3 ? { label: "Average", value: one(mean(buckets.map((b) => b.v))!), sub: def.these, short: def.these, title: `The mean of the ${buckets.length} ${def.line === "week" ? "weeks" : "months"} with a weighing in this window` } : null,
      now: { label: "Now", value: one(now!.v), ...(then ? versus(dd, a, a, MORE) : { sub: `weighing of ${on(now!.d)}`, short: onShort(now!.d) }), title: `The latest weighing, on ${dayMonthYear(now!.d)}` },
      chart, state, quiet: row.quiet, answer: row.words, ...legendsOf(null, chart.baseline),
      begins: beginsOf(wShown[0].d, weighings.some((p) => p.d < from)),
      values: buckets.map((b) => ({ on: dayMonthYear(b.from < from ? from : b.from), v: Math.round(b.v * 10) / 10 })),
      alt: `Weight across ${def.name.toLowerCase()}, ${EACH[def.line]}, from ${one(buckets[0].v)} to ${one(buckets[buckets.length - 1].v)} kilograms${then ? `, against a baseline of ${one(then.v)}` : ""}`,
    });
    rows.push(row);
  }

  wearable({
    key: "rhr", label: "Resting heart rate", col: "resting_hr", unit: "bpm", minSpan: MIN_SPAN.rhr, conv: (v) => v, fmt: whole, tick: (v) => whole(v), breakAtChange: true,
    avgSub: def.these, noThen: "Nothing from a wearable at the start of this window to set it against.",
    judge: (t, n) => {
      const dd = Math.round(n) - Math.round(t), a = String(Math.abs(dd)), held = Math.abs(dd) < HELD.rhr;
      return { change: signedText(dd, a), state: held ? "held" : "moved", ...versus(dd, a, a, LEVEL),
        words: held ? `Held: within ${HELD.rhr} beats of the baseline.` : `Moved ${dd < 0 ? "down" : "up"} by ${a}, on two-week averages.` };
    },
  });
  wearable({
    key: "sleep", label: "Sleep", col: "sleep_minutes", unit: "a night", minSpan: MIN_SPAN.sleep, conv: (v) => v / 60, fmt: hmOf, tick: (v, step) => (step >= 1 ? `${v} h` : hmOf(v)), breakAtChange: true,
    avgSub: def.these, noThen: "Nothing from a wearable at the start of this window to set it against.",
    judge: (t, n) => {
      const mins = Math.round((n - t) * 60), a = Math.abs(mins), held = a < HELD.sleepMin;
      return { change: signedText(mins, `${a} min`), state: held ? "held" : "moved", ...versus(mins, `${a} ${a === 1 ? "minute" : "minutes"}`, `${a} min`, MORE),
        words: held ? `Held: within ${HELD.sleepMin} minutes a night of the baseline.` : `About ${a} minutes ${mins > 0 ? "more" : "less"} a night than at the baseline.` };
    },
  });

  // ── blood work: each result a mark, never a line; from six months up ──
  let once: string | null = null;
  if (def.blood) {
    let anyBefore: string | null = null, repeated = false, any = false;
    for (const b of BLOOD) {
      const all = (d.by.get(b.key) ?? []).filter((p) => p.d <= today).slice().sort((a, c) => a.d.localeCompare(c.d));
      const pts = distinctResults(all);
      if (all.some((p) => inWin(p.d) && !pts.includes(p))) repeated = true;
      const shown = pts.filter((p) => inWin(p.d));
      if (!shown.length) { const last = pts[pts.length - 1]; if (last && (!anyBefore || last.d > anyBefore)) anyBefore = last.d; continue; }
      any = true;
      const unit = shown[shown.length - 1].unit ?? LABELS[b.key]?.unit ?? "";
      const fmt = (v: number) => (b.points ? v.toFixed(1) : trim(v, b.dp));
      const { then, now } = pairOf(pts, from, today);
      const same = !!then && (then.unit ?? "") === (now!.unit ?? "");
      const row = bloodRow(b, pts, from, today, unit);
      // the usual swing around the baseline: the band the chart has to hold
      let band: { lo: number; hi: number; ilo?: number; ihi?: number } | null = null;
      if (then && same && row.swing && b.swing) {
        const m = SWING.markers[b.swing] as Record<string, unknown>;
        if (m.logScale) band = { lo: then.v * (1 - Number(m.fallPct) / 100), hi: then.v * (1 + Number(m.risePct) / 100) };
        else { const lo = Number(m.swingLowPct), hi = Number(m.swingHighPct); band = { lo: then.v * (1 - hi / 100), hi: then.v * (1 + hi / 100), ...(hi - lo >= 0.5 ? { ilo: then.v * (1 - lo / 100), ihi: then.v * (1 + lo / 100) } : {}) }; }
      }
      // two units on one scale would be a drawing of nothing: only the latest unit's results are marked
      const drawn = shown.filter((p) => (p.unit ?? "") === (now!.unit ?? ""));
      const ref = then && same ? then.v : now!.v;
      const sc = scaleOf([...drawn.map((p) => p.v), ...(then && same ? [then.v] : []), ...(band ? [band.lo, band.hi] : [])], Math.abs(ref) * MIN_SPAN.bloodShare, tickBy);
      const baseY = then && same ? sc.y(then.v) : null, baseX = then && same ? (then.d < from ? 0 : xOf(then.d)) : 0;
      const chart = emptyChart();
      chart.ticks = sc.ticks;
      chart.marks = drawn.map((p, i) => { const y = sc.y(p.v); return { x: xOf(p.d), y, shape: "diamond" as const, label: drawn.length <= 4 || i === 0 || i === drawn.length - 1 ? fmt(p.v) : null, above: figureAbove(y, baseY, p === then), title: `Report of ${dayMonthYear(p.d)}: ${fmt(p.v)}${unit ? ` ${unit}` : ""}` }; });
      if (baseY != null) chart.baseline = spot(baseY, baseX, 1, `baseline ${fmt(then!.v)}`, chart.marks.flatMap((m) => [m, { x: m.x, y: m.y + (m.above ? 0.13 : -0.13) }]));
      if (band) chart.band = { x0: baseX, y0: sc.y(band.lo), y1: sc.y(band.hi), inner: band.ilo != null ? { y0: sc.y(band.ilo), y1: sc.y(band.ihi!) } : null };
      const state: CardState = !then ? "once" : !same ? "notCompared" : !row.swing ? "noSwing" : row.swing === "inside" ? "held" : row.swing === "edge" ? "edge" : "moved";
      const dd = then && same ? now!.v - then.v : 0, pct = then && same && then.v ? Math.round((Math.abs(dd) / then.v) * 100) : 0;
      const far = b.points ? Math.abs(dd).toFixed(1) : `${pct}%`;
      cards.push({
        key: b.key, label: b.label, kind: "marks", how: `${unit ? `${unit} · ` : ""}each result`,
        baseline: then ? { label: "Baseline", value: fmt(then.v), sub: `report of ${on(then.d)}`, short: onShort(then.d) } : { label: "Baseline", value: "—", sub: "measured once in this window", short: "measured once" },
        middle: { label: "Results", value: String(shown.length), sub: "each counted once", short: "each once" },
        now: { label: "Now", value: fmt(now!.v), ...(!then ? { sub: `report of ${on(now!.d)}`, short: onShort(now!.d) } : !same ? { sub: "in another unit", short: "another unit" } : versus(b.points ? Math.round(dd * 10) : Math.sign(dd) * pct, far, far, BLOODWORDS, false)) },
        chart, state, quiet: row.quiet,
        answer: state === "noSwing" ? "No usual swing is on file for this marker, so no band is drawn. The two results are shown as they are."
          : `${row.words}${state === "edge" && band?.ilo != null ? " The lighter band is that edge." : band ? " The shaded band is that swing around the baseline." : ""}`,
        ...legendsOf(null, chart.baseline), begins: null,
        values: shown.map((p) => ({ on: dayMonthYear(p.d), v: p.v })),
        alt: `${shown.length === 1 ? "One" : cap(countWord(shown.length))} ${b.label} ${shown.length === 1 ? "result" : "results"} across ${def.name.toLowerCase()}: ${shown.map((p) => `${fmt(p.v)} on ${dayMonth(p.d)}`).join(", ")}${band ? ", with the band of its usual swing around the first" : ""}`,
      });
      rows.push(row);
    }
    if (anyBefore && !any) notes.push(`Blood work: the latest report is from ${dayMonthYear(anyBefore)}, before this window.`);
    if (repeated) notes.push("A blood result that repeats unchanged from one entry to the next is drawn once, at its first date.");
    const lpa = (d.by.get("lpa_value") ?? []).filter((p) => p.d <= today).slice().sort((a, c) => a.d.localeCompare(c.d)).pop();
    if (lpa) {
      rows.push({ ...single("Lp(a)", lpa.unit ?? "", trim(lpa.v, 1), lpa.d, "Shown once. It is largely inherited and is not drawn as a trend."), key: "lpa_value" });
      once = `Lp(a) ${trim(lpa.v, 1)}${lpa.unit ? ` ${lpa.unit}` : ""}, report of ${dayMonthYear(lpa.d)}. Shown once: it is largely inherited and is not drawn as a trend.`;
    }
  } else notes.push("Blood work is drawn from six months up: two reports closer together than that rarely differ by more than their usual swing.");

  if (key === "6m") notes.push(`Six months sets ${monthLong(from)} beside ${monthLong(today)}, opposite ends of the year. Cholesterol, blood pressure and resting heart rate can shift a little with the season alone.`);
  if (!cards.some((c) => c.chart.wearable.length)) changes.length = 0;

  // ── the weeks, or the months, under every chart ──
  const axis: Timeline["axis"] = [];
  if (span <= 45) { for (let m = mondayOf(new Date(from + "T00:00:00")); m <= today; m = addDays(m, 7)) if (m >= from) axis.push({ x: xOf(m), label: dayMonthShort(m) }); }
  else {
    // a month's name sits under its middle, where its point is; across more than a year each name carries its year
    const stepMonths = span <= 200 ? 1 : span <= 400 ? 2 : 6;
    let m = from.slice(0, 8) + "01"; if (m < from) m = addMonths(m, 1);
    for (; addDays(m, 14) <= today; m = addMonths(m, stepMonths)) axis.push({ x: xOf(addDays(m, 14)), label: `${monthShort(m)}${span > 400 ? ` ${yy(m)}` : ""}` });
  }

  // ── the cards under their headings, and the one line that counts them ──
  const by = (...keys: string[]) => keys.map((k) => cards.find((c) => c.key === k)).filter((c): c is Card => !!c);
  const hasFitness = cards.some((c) => c.key === "fitness");
  const rest = by("rhr", "sleep", ...(hasFitness ? [] : ["weight"]));
  const restNames = rest.map((c) => (c.key === "rhr" ? "heart" : c.key === "sleep" ? "sleep" : "body"));
  const groups: Timeline["groups"] = [
    { key: "movement", title: "Movement", cards: by("dose", "steps") },
    { key: "fitness", title: by("weight").length ? "Fitness and body" : "Fitness", cards: hasFitness ? by("fitness", "weight") : [] },
    { key: "heart", title: cap(restNames.length > 1 ? `${restNames.slice(0, -1).join(", ")} and ${restNames[restNames.length - 1]}` : restNames[0] ?? ""), cards: rest },
    { key: "blood", title: "Blood work · drawn from six months up", cards: cards.filter((c) => BLOOD.some((b) => b.key === c.key)) },
  ].filter((g) => g.cards.length);
  const ordered = groups.flatMap((g) => g.cards);
  const digest = DIGEST.map((g) => ({ ...g, n: ordered.filter((c) => c.state === g.state).length })).filter((g) => g.n);

  return { def, from, to: today, custom, cards: ordered, groups, digest, axis, rows, notes, once, gap: custom ? null : gap, changes, empty: !ordered.length };
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
    : s.state === "inside" ? `Inside ${b.said ?? b.label}'s usual swing, which is about ${s.range}.`
    : s.state === "edge" ? `At the edge of its usual swing, about ${s.range}.`
    : `More than its usual swing of about ${s.range}.`;
  return { key: b.key, label: b.label, unit, then: fmt(then.v), thenOn: then.d, now: fmt(now.v), nowOn: now.d, change, words, quiet: false, swing: s?.state ?? null, range: s ? (b.swing === "hsCRP" ? s.range : `about ${s.range}`) : undefined };
}

// ── the same window, as figures for the Guide ───────────────────────────────

/** What the Guide is sent when it reads a window: each marker's baseline beside its latest figure, then each card's figures, dates in words so a day it names is a number it was given. */
export function windowWorking(t: Timeline): Record<string, unknown> {
  return {
    name: t.def.name.toLowerCase(), from: dayMonthYear(t.from), to: dayMonthYear(t.to),
    baselineIs: "Where each marker stood when the window began: the two-week average to its first day, or the test or report nearest it. It is each row's 'then'.",
    movedAndHeld: t.rows.map((r) => ({ marker: r.key, label: r.label, unit: r.unit, then: r.then, thenOn: r.thenOn ? dayMonthYear(r.thenOn) : null, now: r.now, nowOn: r.nowOn ? dayMonthYear(r.nowOn) : null, change: r.change, moreThanItsUsualSwing: r.words })),
    lanes: t.cards.map((c) => ({ marker: c.key, label: c.label, how: c.how, ...(c.middle?.label === "Average" ? { averageAcrossTheWindow: c.middle.value } : {}), values: c.values.slice(-40) })),
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
