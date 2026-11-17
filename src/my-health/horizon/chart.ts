/**
 * A diet chart, beside the horizon (canvas "Verve, Horizon as a programme", board 17; the founder, 17 November 2026:
 * "the ability to upload a diet chart - if in case a user gets one from his dietician - so that can run along with
 * the horizon").
 *
 * The chart is someone else's advice, held as it was written. Verve shows it and counts the days the person says they
 * followed it. It does not write a chart, grade one, change one, or work anything out from one: no calories, no food
 * diary, no score. The plan still writes no diet, and the Guide's chat still stops at food.
 *
 * What is here: the chart as it is read back from the report reader (its own words, in its own script), which chart
 * is in force on a day, the day's lines, the count of days, and the one sentence the count is said in. The count is
 * the person's own word. It is not a marker, has no target and is never judged, and no sentence joins it to another
 * number with "because" or "so".
 *
 * This file is copied into the horizon function (METTracker tools/sync-horizon-web.sh), which says the same sentence
 * in Monday's check-in. Pure, no DOM, no fetch; tests/chart.test.mjs runs it under node.
 */
import { addDays } from "../derive/format.ts";

export type ChartAnswer = "yes" | "mostly" | "no";
export const CHART_ANSWERS: { key: ChartAnswer; label: string }[] = [{ key: "yes", label: "Yes" }, { key: "mostly", label: "Mostly" }, { key: "no", label: "No" }];
/** One line of a chart: when, and what, as printed. `day` only on a chart that differs by the day of the week. */
export type ChartMeal = { when: string; items: string; day?: string | null };
export type ChartTotal = { name: string; value: string };
/** What the reader took from a chart, for the person to check before it is kept. */
export type ChartRead = { written_by: string | null; given_on: string | null; review_on: string | null; meals: ChartMeal[]; notes: string[]; totals: ChartTotal[] };
/** A chart kept with a horizon (public.horizon_charts). */
export type ChartRow = ChartRead & { id: string; horizon_id: string; user_id: string; report_path: string | null; given_on: string; removed_at: string | null; created_at: string };
/** One day's answer (public.horizon_chart_days). */
export type ChartDay = { day: string; answer: ChartAnswer };

const str = (x: unknown, max: number): string => (typeof x === "string" ? x.replace(/\s+/g, " ").trim().slice(0, max) : "");
const iso = (x: unknown): string | null => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.slice(0, 10)) ? x.slice(0, 10) : null);
/**
 * The reader's answer for a diet chart, made safe to show and to keep: strings only, trimmed and bounded, nothing
 * added. Null when it holds no line of a chart at all.
 */
export function parseChart(read: unknown, reportDate?: unknown): ChartRead | null {
  const r = read && typeof read === "object" ? (read as Record<string, unknown>) : null;
  if (!r) return null;
  const meals: ChartMeal[] = (Array.isArray(r.meals) ? r.meals : []).flatMap((m): ChartMeal[] => {
    const x = m && typeof m === "object" ? (m as Record<string, unknown>) : null;
    const items = str(x?.items, 600), when = str(x?.when, 60), day = str(x?.day, 20);
    return x && items ? [{ when: when || "Any time", items, ...(day ? { day } : {}) }] : [];
  }).slice(0, 120);
  const notes = (Array.isArray(r.notes) ? r.notes : []).map((n) => str(n, 400)).filter(Boolean).slice(0, 40);
  const totals: ChartTotal[] = (Array.isArray(r.totals) ? r.totals : []).flatMap((t): ChartTotal[] => {
    const x = t && typeof t === "object" ? (t as Record<string, unknown>) : null;
    const name = str(x?.name, 60), value = str(x?.value, 60);
    return name && value ? [{ name, value }] : [];
  }).slice(0, 12);
  if (!meals.length && !notes.length) return null;
  return { written_by: str(r.written_by, 120) || null, given_on: iso(reportDate) ?? iso(r.given_on), review_on: iso(r.review_on), meals, notes, totals };
}

/** The chart in force on a day: the newest one given on or before it that has not been taken off the horizon. */
export function chartInForce(charts: ChartRow[], day: string): ChartRow | null {
  const live = charts.filter((c) => !c.removed_at && c.given_on <= day).sort((a, b) => a.given_on.localeCompare(b.given_on) || a.created_at.localeCompare(b.created_at));
  return live[live.length - 1] ?? null;
}
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** A day's lines: all of them on a chart that is the same every day, the day's own on one that differs by the day. */
export function mealsOn(chart: Pick<ChartRead, "meals">, day: string): ChartMeal[] {
  if (!chart.meals.some((m) => m.day)) return chart.meals;
  const name = WEEKDAYS[new Date(day + "T00:00:00").getDay()];
  return chart.meals.filter((m) => !m.day || m.day.toLowerCase().startsWith(name.slice(0, 3)));
}

export type ChartCount = { yes: number; mostly: number; no: number; /** Days with an answer. */ marked: number; /** Days in the stretch on which a chart was in force. */ days: number };
/** The answers from one day to another, both counted, over the days a chart was in force. */
export function chartCount(charts: ChartRow[], answers: ChartDay[], from: string, to: string): ChartCount {
  const by = new Map(answers.map((a) => [a.day.slice(0, 10), a.answer]));
  const c: ChartCount = { yes: 0, mostly: 0, no: 0, marked: 0, days: 0 };
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!chartInForce(charts, d)) continue;
    c.days++;
    const a = by.get(d);
    if (a === "yes" || a === "mostly" || a === "no") { c[a]++; c.marked++; }
  }
  return c;
}
/**
 * The count in one sentence, with no head: "yes on 5 of 7 days, mostly on 1, by your own count." Said to a coach it
 * is "by their own count". A day with no answer
 * is not a "no", so the sentence counts the days that were marked and says so when some were not. Empty when no day
 * was marked: there is nothing to say, and nothing is said.
 */
export function chartCountWords(c: ChartCount, soFar = false, who: "you" | "they" = "you"): string {
  if (!c.marked) return "";
  const of = c.marked === c.days ? `${c.marked} ${c.marked === 1 ? "day" : "days"}` : `the ${c.marked} ${c.marked === 1 ? "day" : "days"} ${who} marked`;
  return `yes on ${c.yes} of ${of}${soFar ? " so far" : ""}${c.mostly ? `, mostly on ${c.mostly}` : ""}, by ${who === "they" ? "their" : "your"} own count.`;
}
/**
 * Sharing a chart (17 November 2026; board 17, "the chart has its own tick when you give a coach access"). The tick
 * is the share's scope "chart". A person with it and with the horizon's own tick ("activity") reads the chart's lines
 * and the count of days, and changes nothing: only its owner adds a chart, marks a day or takes a chart off. The file
 * the chart was read from is not shared by this tick.
 */
export const CHART_SCOPE = "chart";
/** How many people a chart is shared with: the active shares of the page that carry the chart's tick and the horizon's. */
export const chartSharedWith = (shares: { status?: unknown; scopes?: unknown }[] | null | undefined): number =>
  (shares ?? []).filter((g) => g?.status === "active" && Array.isArray(g.scopes) && g.scopes.includes(CHART_SCOPE) && g.scopes.includes("activity")).length;
/** The head the count carries in a check-in and in the midweek note. */
export const CHART_HEAD = "The chart";
/** What the page says where a chart's own words would otherwise be answered about. */
export const CHART_ASK_WORDS = "That is a question for the person who wrote your chart.";
