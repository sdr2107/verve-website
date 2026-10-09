/**
 * Formatting and small arithmetic the My health page shares: dates as the
 * page writes them, the medians and quartiles the bands rest on. Pure, no
 * DOM, no document: every function is a function of its arguments.
 */

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export const fmtDay = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const dayOf = (iso: string) => fmtDay(String(iso).slice(0, 10));
export const dayWord = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
export const monthOf = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short" });
export const monthYearOf = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "numeric" });
export const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); return x.toLocaleDateString("en-CA"); };
export const daysBack = (day: string, n: number) => addDays(day, -n);
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
export const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
export const mondayOf = (d: Date) => { const x = new Date(d); const day = x.getDay() === 0 ? 7 : x.getDay(); x.setDate(x.getDate() - day + 1); return x.toLocaleDateString("en-CA"); };
export const todayStr = () => new Date().toLocaleDateString("en-CA");

export const fmt1 = (v: number) => (Math.round(v * 10) / 10).toString();
export const round0 = (v: number) => String(Math.round(v));
export const signed = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 10 ** digits) / 10 ** digits)}`;
export const fmtHM = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
export const fmtSleepMin = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")} m`;
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
export const ordinal = (n: number) => ORD[n] ?? `${n}th`;

export const medianOf = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** The middle half: the median of the lower half and of the upper half (Tukey's hinges). */
export const quartilesOf = (xs: number[]) => { const sorted = [...xs].sort((a, b) => a - b); const h = sorted.length >> 1; return { q1: medianOf(sorted.slice(0, h))!, q3: medianOf(sorted.slice(sorted.length % 2 ? h + 1 : h))! }; };
export const byDate = (k: string) => (x: any, y: any) => String(x[k]).localeCompare(String(y[k]));

/** A small mono heading, as an HTML string, for the parts still drawn as strings. */
export const kicker = (t: string, tone = "text-text-tertiary") => `<div class="font-mono text-[10px] font-semibold tracking-[0.12em] ${tone}">${t}</div>`;
