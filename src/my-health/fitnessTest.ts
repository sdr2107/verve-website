/**
 * A treadmill report, uploaded and checked (the founder, 26 November 2026: "I want an option on the app and website
 * to upload the treadmill test report, it parses and adds the date, the METs value and other relevant info and saves
 * it to the CRF test card"; the sketch he approved on 27 November 2026 has three steps: add, check what was read, saved).
 *
 * What is here: the lines of "Check what was read" as the person sees and corrects them, the test they make, and the
 * few lines a report prints beside its METs (the protocol, the time, the peak heart rate, why it stopped), which are
 * kept WITH the fitness reading so the Fitness card can say them back.
 *
 * NOTHING IS WORKED OUT HERE. The METs are the report's own, checked by the person. A mask test's oxygen becomes
 * METs by the one division the page already makes (./horizon/fitnessEntry.ts entryResult). A line the reader could
 * not find is empty for the person to fill, never guessed. The conclusion is the report's own words: it is shown,
 * kept as the report's, and read by no code. Verve says nothing about what a result means.
 *
 * Pure, no DOM, no fetch; tests/fitness-test.test.mjs runs it under node.
 */
import { localDay } from "./derive/format.ts";
import { methodLabel } from "./derive/markers.ts";
import { entryResult, type EntryFields, type EntryProfile, type EntryResult, type TestRead } from "./horizon/fitnessEntry.ts";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "14 November", from a date string, without the runtime's locale. */
export const dayMonth = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
/** "14 November 2026". */
export const dayMonthYear = (d: string) => `${dayMonth(d)} ${d.slice(0, 4)}`;

// ── a time, as the person types it and as the page says it ──

/** "9:20", "9 min 20 s" or "12 min" as seconds, exactly. Null for anything else: a decimal of minutes is not guessed. */
export function secondsOfTyped(text: string): number | null {
  const s = text.trim().toLowerCase();
  let m = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,3})\s*(?:min(?:ute)?s?|m)\s*(?:and\s*)?([0-5]?\d)\s*(?:sec(?:ond)?s?|s)$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,3})\s*(?:min(?:ute)?s?|m)$/.exec(s);
  if (m) return Number(m[1]) * 60;
  return null;
}
/** Seconds as "9:20", for a field. */
export const clockOf = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
/** Seconds as "9 min 20 s"; "12 min" on the minute. */
export const timeWords = (seconds: number): string => { const m = Math.floor(seconds / 60), s = seconds % 60; return s ? `${m} min ${s} s` : `${m} min`; };

// ── what a report prints beside its METs, kept with the reading ──

/** The lines kept with a fitness reading read from a report (crf_entries.test_details). Each null where the report prints nothing. */
export type TestDetails = { v: 1; protocol: string | null; seconds: number | null; peak_hr: number | null; peak_hr_percent: number | null; stopped: string | null };
const text = (x: unknown, max: number): string | null => (typeof x === "string" && x.replace(/\s+/g, " ").trim() ? x.replace(/\s+/g, " ").trim().slice(0, max) : null);
const whole = (x: unknown, lo: number, hi: number): number | null => (x != null && x !== "" && typeof x !== "boolean" && Number.isFinite(Number(x)) && Number(x) >= lo && Number(x) <= hi ? Math.round(Number(x)) : null);
/** The kept lines made safe to show: bounded, nothing added. Null when there is nothing in them to say. */
export function parseDetails(x: unknown): TestDetails | null {
  const o = x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
  if (!o) return null;
  const d: TestDetails = { v: 1, protocol: text(o.protocol, 60), seconds: whole(o.seconds, 30, 3600), peak_hr: whole(o.peak_hr, 40, 240), peak_hr_percent: whole(o.peak_hr_percent, 20, 130), stopped: text(o.stopped, 200) };
  return d.protocol || d.seconds != null || d.peak_hr != null || d.stopped ? d : null;
}
/** "Bruce · 9 min 20 s · peak 168": the one line the Fitness card says of a report's details. Null when none can be said. */
export function detailLine(d: TestDetails | null): string | null {
  if (!d) return null;
  const parts = [d.protocol, d.seconds != null ? timeWords(d.seconds) : null, d.peak_hr != null ? `peak ${d.peak_hr}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
/** "Treadmill test · 14 November". */
export const testLine = (method: unknown, day: string): string => `${cap(methodLabel(method))}${ISO.test(day) ? ` · ${dayMonth(day)}` : ""}`;

/** A fitness row as the person's own table holds it, with its kept lines. */
export type DetailRow = { day: string; method: string; mets: number | null; details: TestDetails };
/** The person's own rows that carry details, as read with their session (./fitnessTestApi.ts loadTestDetails). */
export function detailRowsOf(rows: unknown): DetailRow[] {
  const out: DetailRow[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const details = parseDetails(r?.test_details);
    if (!details || !r?.timestamp) continue;
    out.push({ day: localDay(String(r.timestamp)), method: String(r.estimation_method ?? ""), mets: r.met_capacity != null && Number.isFinite(Number(r.met_capacity)) ? Number(r.met_capacity) : null, details });
  }
  return out;
}
const tenth = (v: number) => Math.round(v * 10);
/** The kept lines of one reading: the same day, the same test, the same METs to one decimal. Null when the reading has none. */
export function detailsFor(rows: DetailRow[], test: { measured_on?: unknown; method?: unknown; met_capacity?: unknown } | null): TestDetails | null {
  if (!test) return null;
  const day = String(test.measured_on ?? "").slice(0, 10), method = String(test.method ?? "");
  const mets = test.met_capacity != null && Number.isFinite(Number(test.met_capacity)) ? Number(test.met_capacity) : null;
  return rows.find((r) => r.day === day && r.method === method && (mets == null || r.mets == null || tenth(r.mets) === tenth(mets)))?.details ?? null;
}

// ── "Check what was read": the lines, as read and as corrected ──

export type RowKey = "date" | "mets" | "vo2" | "protocol" | "time" | "peak" | "stopped";
/** What the person may correct, as text in each field. */
export type Draft = { date: string; mets: string; vo2: string; protocol: string; time: string; peakHr: string; peakPct: string; stopped: string };
const numText = (v: number | null) => (v != null ? String(v) : "");
/** The fields as the reader left them: empty where it found nothing. */
export const draftFrom = (r: TestRead): Draft => ({
  date: r.date ?? "", mets: numText(r.mets), vo2: numText(r.peakVo2), protocol: r.protocol ?? "", time: r.seconds != null ? clockOf(r.seconds) : "",
  peakHr: numText(r.peakHr), peakPct: numText(r.peakHrPercent), stopped: r.stopped ?? "",
});
export type CheckRow = { key: RowKey; label: string; /** The line as it reads; empty where nothing was found. */ shown: string };
const numOf = (s: string): number | null => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);
/** The card's lines, in the sketch's order. A mask test shows the oxygen that was measured where a treadmill test shows METs. */
export function rowsOf(d: Draft, mask: boolean): CheckRow[] {
  const secs = secondsOfTyped(d.time), hr = numOf(d.peakHr), pct = numOf(d.peakPct);
  return [
    { key: "date", label: "Date", shown: ISO.test(d.date) ? dayMonthYear(d.date) : "" },
    mask ? { key: "vo2", label: "Peak oxygen", shown: numOf(d.vo2) != null ? `${d.vo2.trim()} ml/kg/min` : "" } : { key: "mets", label: "METs reached", shown: numOf(d.mets) != null ? d.mets.trim() : "" },
    { key: "protocol", label: "Protocol", shown: d.protocol.trim() },
    { key: "time", label: "Time", shown: secs != null ? timeWords(secs) : "" },
    // "% of predicted" only when the report prints one, or the person types it: it is never divided out here
    { key: "peak", label: "Peak heart rate", shown: hr != null ? `${hr}${pct != null ? ` · ${pct}% of predicted` : ""}` : "" },
    { key: "stopped", label: "Stopped", shown: d.stopped.trim() },
  ];
}
/** One line when the reader could not settle the day (the report prints it in more than one way, or two days fit). */
export const DATE_UNSURE = "The report prints its date in more than one way. Type the day of the test.";
/** What stands in a line the reader left empty. */
export const NOT_READ = "Not read";
export const NOT_A_TEST = "That file was not read as a treadmill test. It is kept in Reports, and nothing was added to your fitness.";

export type Checked =
  | { ok: true; kind: "treadmill" | "mask"; fields: EntryFields; result: Extract<EntryResult, { ok: true }>; details: TestDetails }
  | { ok: false; why: string; row: RowKey };
/**
 * The corrected lines as one test, or the first line that still needs the person. The date and the METs (or the
 * measured oxygen) are needed; the other lines may be empty. A line that is filled must read as what it is.
 */
export function checkedOf(d: Draft, mask: boolean, profile: EntryProfile, today: string): Checked {
  if (!ISO.test(d.date)) return { ok: false, why: "Give the day of the test.", row: "date" };
  if (d.date > today) return { ok: false, why: "The day of the test cannot be ahead of today.", row: "date" };
  const mets = numOf(d.mets), vo2 = numOf(d.vo2);
  if (!mask && mets == null) return { ok: false, why: "Type the METs the report prints.", row: "mets" };
  if (mask && vo2 == null) return { ok: false, why: "Type the peak oxygen the report prints, in ml per kg per minute.", row: "vo2" };
  const seconds = d.time.trim() ? secondsOfTyped(d.time) : null;
  if (d.time.trim() && (seconds == null || seconds < 30 || seconds > 3600)) return { ok: false, why: "Write the time as minutes and seconds, like 9:20.", row: "time" };
  const hr = d.peakHr.trim() ? whole(d.peakHr, 40, 240) : null;
  if (d.peakHr.trim() && hr == null) return { ok: false, why: "Peak heart rate is a number of beats a minute.", row: "peak" };
  const pct = d.peakPct.trim() ? whole(d.peakPct, 20, 130) : null;
  if (d.peakPct.trim() && pct == null) return { ok: false, why: "The percentage of predicted is a number, as the report prints it.", row: "peak" };
  // the METs are the report's own: no protocol and no time is handed over, so nothing is worked out from them
  const fields: EntryFields = mask ? { date: d.date, vo2 } : { date: d.date, mets };
  const kind = mask ? "mask" : "treadmill";
  const result = entryResult(kind, fields, profile, today);
  if (!result.ok) return { ok: false, why: result.why, row: mask ? "vo2" : "mets" };
  return { ok: true, kind, fields, result, details: { v: 1, protocol: text(d.protocol, 60), seconds, peak_hr: hr, peak_hr_percent: hr != null ? pct : null, stopped: text(d.stopped, 200) } };
}
