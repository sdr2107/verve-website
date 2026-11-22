/**
 * Body, the sections that only a report fills (canvas "Verve, Horizon as a programme", board 35; the founder,
 * 22 November 2026: "build what you mocked - all five as drawn").
 *
 * When Labs was folded into Body (8 November 2026) the page kept the app's own list, Metabolic, Heart and Muscle,
 * and stopped drawing everything else a report holds: the blood count, liver, kidney, thyroid, vitamins and the
 * rest. Nothing was deleted: every value is a lab row with the section the parser filed it under. This brings
 * those sections back, under the app's three.
 *
 * Two rules:
 *   1. A marker the app's list already draws is not drawn again here. What is left of a report's "metabolic",
 *      "heart", "muscle" and "lipids" rows are the markers the app has no row for; they sit under "Other ...".
 *   2. A row here is read ONLY against the range the lab printed beside it. Verve adds no band and no target of
 *      its own, and no row says when to test again. No printed range: the row says so and is not judged.
 *
 * A marker is one series: every reading of one name, by the folded name (../../lib/canon.js), under the section of
 * its newest reading. A section is listed only when it holds a marker. Pure; tests/body-report-sections.test.mjs.
 */
import { canonName } from "../../lib/canon.js";
import { BODY_DEFS, type Band } from "../../data/body-list.ts";
import { chartKeyFor } from "./markers.ts";
import type { Reading, Tone, Track } from "./body.ts";

/** The sections, in the sidebar's order: the address's word, the name, and the words the headline counts in. */
export const REPORT_SECTIONS = [
  { key: "blood", from: "haematology", title: "Blood count", noun: "blood count marker" },
  { key: "liver", from: "liver", title: "Liver", noun: "liver marker" },
  { key: "kidney", from: "kidney", title: "Kidney", noun: "kidney marker" },
  { key: "thyroid", from: "thyroid", title: "Thyroid", noun: "thyroid marker" },
  { key: "vitamins", from: "vitamins_iron", title: "Vitamins and iron", noun: "vitamin and iron marker" },
  { key: "hormones", from: "hormones", title: "Hormones", noun: "hormone marker" },
  { key: "lipids", from: "lipids", title: "Other lipids", noun: "other lipid marker" },
  { key: "inflammation", from: "inflammation", title: "Inflammation", noun: "inflammation marker" },
  { key: "urine", from: "urine", title: "Urine", noun: "urine marker" },
  { key: "metabolic-more", from: "metabolic", title: "Other metabolic", noun: "other metabolic marker" },
  { key: "heart-more", from: "heart", title: "Other heart", noun: "other heart marker" },
  { key: "muscle-more", from: "muscle", title: "Other muscle", noun: "other muscle marker" },
  { key: "other", from: "other", title: "Other", noun: "other marker" },
] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number]["key"];
export const REPORT_SECTION_KEYS = REPORT_SECTIONS.map((s) => s.key) as readonly ReportSectionKey[];
const KEY_OF: Record<string, ReportSectionKey> = Object.fromEntries(REPORT_SECTIONS.map((s) => [s.from, s.key]));

/** A lab row, as much of it as these sections read. */
export type LabReading = {
  analyte: string; value: number | string; unit?: string | null; section?: string | null; measured_on: string;
  ref_low?: number | null; ref_high?: number | null; ref_text?: string | null; computed?: boolean;
};

/** A marker as a row of the page: the same shape the app's rows have, so one row component draws both. */
export interface ReportRow {
  key: string; section: ReportSectionKey; label: string;
  value: string; unit: string; on: string; writer: string;
  /** Where the value sits against the lab's range, in words; never null: a row with no range says so. */
  bandLabel: string; tone: Tone; outside: boolean;
  track: Track | null; history: Reading[];
  bands: Band[]; band: number | null; once: boolean; subline: string | null; bandNote: string | null; noFigure: boolean;
}
export interface ReportSection { key: ReportSectionKey; title: string; noun: string; rows: ReportRow[]; total: number; outside: number }

/** The markers the app's list draws, by the key a report's name folds to. */
const IN_APP_LIST = new Set(BODY_DEFS.map((d) => d.key));
const drawnByApp = (analyte: string) => { const k = chartKeyFor(analyte); return !!k && IN_APP_LIST.has(k); };

const num = (v: unknown): number | null => { const n = typeof v === "number" ? v : v == null || v === "" ? NaN : Number(v); return Number.isFinite(n) ? n : null; };
const trim = (v: number) => (Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString());

/** The range a lab printed, in words: "0.4 to 4", "below 150", "above 40", the lab's own words, or nothing. */
export function printedRange(r: { ref_low?: number | null; ref_high?: number | null; ref_text?: string | null }): string {
  const lo = num(r.ref_low), hi = num(r.ref_high);
  if (lo != null && hi != null) return `${trim(lo)} to ${trim(hi)}`;
  if (hi != null) return `below ${trim(hi)}`;
  if (lo != null) return `above ${trim(lo)}`;
  return String(r.ref_text ?? "").trim();
}

/** Where a value sits against the range printed beside it. "none": no range was printed. "words": the range is words, not numbers, so nothing is judged. */
export type Against = "inside" | "above" | "below" | "words" | "none";
export function againstPrinted(v: number, r: { ref_low?: number | null; ref_high?: number | null; ref_text?: string | null }): Against {
  const lo = num(r.ref_low), hi = num(r.ref_high);
  if (lo == null && hi == null) return String(r.ref_text ?? "").trim() ? "words" : "none";
  if (lo != null && v < lo) return "below";
  if (hi != null && v > hi) return "above";
  return "inside";
}
const WORDS: Record<Exclude<Against, "words">, string> = { inside: "In the lab's range", above: "Above the lab's range", below: "Below the lab's range", none: "no range printed" };

/** The lab's range on a line with the value on it: the range in the middle, room on both sides, wider when the value lies outside. */
export function printedTrack(v: number, r: { ref_low?: number | null; ref_high?: number | null }): Track | null {
  const lo = num(r.ref_low), hi = num(r.ref_high);
  if (lo == null && hi == null) return null;
  let from: number, to: number;
  if (lo != null && hi != null) { if (!(hi > lo)) return null; const half = (hi - lo) / 2; from = lo - half; to = hi + half; }
  else if (hi != null) { if (!(hi > 0)) return null; from = 0; to = hi * (4 / 3); }
  else { const pad = Math.max(Math.abs(lo!) / 2, 1e-6); from = lo! - pad; to = lo! + pad * 3; }
  if (lo != null && lo >= 0) from = Math.max(0, from);
  const step = (to - from) / 8;
  from = Math.min(from, v - step); to = Math.max(to, v + step);
  if (lo != null && lo >= 0 && v >= 0) from = Math.max(0, from);
  const span = to - from;
  if (!(span > 0)) return null;
  const at = (x: number) => Math.min(1, Math.max(0, (x - from) / span));
  const a = at(lo ?? from), b = at(hi ?? to);
  return { lo: from, hi: to, segments: [{ band: 0, start: a, width: b - a, neutral: true }], position: at(v), edges: [] };
}

/** Every marker a report holds that the app's list has no row for, by section, in the sidebar's order. */
export function reportSectionsOf(labs: LabReading[]): ReportSection[] {
  const series = new Map<string, LabReading[]>();
  for (const r of labs ?? []) {
    if (!r || r.computed) continue;
    const name = canonName(String(r.analyte ?? ""));
    if (!name || num(r.value) == null || !String(r.measured_on ?? "")) continue;
    if (drawnByApp(String(r.analyte))) continue;
    (series.get(name) ?? series.set(name, []).get(name)!).push(r);
  }
  const bySection = new Map<ReportSectionKey, ReportRow[]>();
  for (const [name, rs] of series) {
    rs.sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on)));
    const latest = rs[rs.length - 1], v = num(latest.value)!;
    const section = KEY_OF[String(latest.section ?? "")] ?? "other";
    const against = againstPrinted(v, latest);
    const row: ReportRow = {
      key: `report:${name}`, section, label: name,
      value: trim(v), unit: String(latest.unit ?? ""), on: String(latest.measured_on).slice(0, 10), writer: "lab report",
      bandLabel: against === "words" ? `Lab's range: ${printedRange(latest)}` : WORDS[against],
      tone: against === "above" || against === "below" ? "caution" : "neutral",
      outside: against === "above" || against === "below",
      track: printedTrack(v, latest),
      history: rs.map((r) => { const range = printedRange(r); return { d: String(r.measured_on).slice(0, 10), v: num(r.value)!, unit: r.unit ?? null, writer: range ? `lab report · range ${range}` : "lab report · no range printed" }; }),
      bands: [], band: null, once: false, subline: null, bandNote: null, noFigure: false,
    };
    (bySection.get(section) ?? bySection.set(section, []).get(section)!).push(row);
  }
  return REPORT_SECTIONS.filter((s) => bySection.has(s.key)).map((s) => {
    const rows = bySection.get(s.key)!.sort((a, b) => a.label.localeCompare(b.label));
    return { key: s.key, title: s.title, noun: s.noun, rows, total: rows.length, outside: rows.filter((r) => r.outside).length };
  });
}

/** How many markers each listed section holds: what the sidebar prints beside a name, and hides a name without. */
export function reportSectionCounts(labs: LabReading[]): Partial<Record<ReportSectionKey, number>> {
  return Object.fromEntries(reportSectionsOf(labs).map((s) => [s.key, s.total]));
}

const WORD = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const count = (n: number) => WORD[n - 1] ?? String(n);
/** The sentence over a section: "Five thyroid markers on file. One sits outside its lab's range." */
export function reportHeadline(s: ReportSection): string {
  const n = s.total, k = s.outside;
  const first = `${count(n)} ${s.noun}${n === 1 ? "" : "s"} on file.`;
  if (!k) return `${first} ${n === 1 ? "It does not sit outside its lab's range." : "None sits outside its lab's range."}`;
  return `${first} ${k === 1 ? "One sits outside its lab's range." : `${count(k)} sit outside their lab's range.`}`;
}
/** Under the headline: what these rows are, and what they are read against. */
export const REPORT_SECTION_LEAD = "These come straight from your reports. Each is read against the range the lab printed beside it. Verve adds no range of its own here.";
