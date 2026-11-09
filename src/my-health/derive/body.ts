/**
 * The Body page as a list (canvas "My health, redesigned", board 6): the
 * app's rows, in the app's order, each judged by the app's own bands from
 * src/data/body-list.ts, with Labs folded in. A row says the name, when and
 * by whom it was read, where the value sits in its range, the band in words,
 * and the value. No row says when a test is due; no row draws a trend.
 *
 * The readings come from the person's document the way derive/markers reads
 * them (reports, the app's own rows, the scale's days); remnant cholesterol
 * from derive/lipids (computed, never stored); the SPPB from the app's three
 * tests on one day. A report's value in another unit than the app's is
 * converted to judge it and shown as printed. Pure.
 */
import type { PersonData } from "./person.ts";
import { BODY_DEFS, BODY_SECTIONS, lpaBands, remnantBands, type Band, type BodyCtx, type BodyDef, type BodySection } from "../../data/body-list.ts";
import { chartKeyFor, type Pt } from "./markers.ts";
import { REMNANT_LABEL } from "./lipids.ts";
import { sppbSeries } from "./lenses.ts";
import { unitKey } from "../../lib/canon.js";

export type Tone = "good" | "caution" | "concern" | "neutral";
export interface TrackSegment { band: number; start: number; width: number; neutral?: boolean }
export interface Track { lo: number; hi: number; segments: TrackSegment[]; position: number | null; edges: { value: number; at: number }[] }
export interface Reading { d: string; v: number; unit: string | null; writer: string }
export interface BodyRow {
  key: string; section: BodySection; label: string;
  /** The value as printed, or null when nothing is on file. */
  value: string | null;
  /** The unit shown beside it: the reading's own, else the app's. */
  unit: string;
  on: string | null;
  writer: string | null;
  bands: Band[];
  band: number | null;
  bandLabel: string | null;
  tone: Tone;
  /** Recorded, judged, and outside the best band; never for a marker read once. */
  watch: boolean;
  once: boolean;
  track: Track | null;
  /** The line under the name where the usual words would be wrong. */
  subline: string | null;
  history: Reading[];
}
export interface BodySectionRows { key: BodySection; title: string; rows: BodyRow[]; total: number; recorded: number; watch: number }
export interface BodyList { sections: BodySectionRows[]; total: number; recorded: number; watch: number; outside: BodyRow[]; latestLab: string | null }

const u = (x: unknown) => unitKey(x == null ? "" : String(x));
const isMmol = (x: unknown) => u(x) === "mmol/l";
/** A report's value in the app's unit, for judging only; the shown value stays as printed. */
export function toAppUnit(key: string, v: number, unit: string | null | undefined): number {
  const k = u(unit);
  switch (key) {
    case "glucose_mgdl": case "post_meal_glucose_mgdl": return k === "mmol/l" ? v * 18.0182 : v;
    case "triglycerides_mgdl": return k === "mmol/l" ? v * 88.57 : v;
    case "hdl_mgdl": case "ldl_mgdl": case "total_cholesterol_mgdl": return k === "mmol/l" ? v * 38.67 : v;
    case "hba1c_pct": return k === "mmol/mol" ? v * 0.09148 + 2.152 : v;
    case "apo_b_mgdl": return k === "g/l" ? v * 100 : v;
    case "hs_crp_mgl": return k === "mg/dl" ? v * 10 : v;
    case "waist_cm": return k === "in" || k === "inch" || k === "inches" ? v * 2.54 : v;
    default: return v;
  }
}

export const toneOf = (band: number | null, bands: Band[]): Tone =>
  band == null ? "neutral" : bands[band]?.unjudged ? "neutral" : band === 0 ? "good" : band === 1 ? "caution" : "concern";

/** The bands laid out on one line with the value on it: lib/rangeTrack.ts, as the app draws it. */
export function rangeTrack(bands: Band[], value: number | null | undefined): Track | null {
  const edgeSet = new Set<number>();
  for (const b of bands) { if (b.min != null && Number.isFinite(b.min)) edgeSet.add(b.min); if (b.max != null && Number.isFinite(b.max)) edgeSet.add(b.max); }
  const edges = [...edgeSet].sort((a, b) => a - b);
  if (!edges.length) return null;
  const first = edges[0], last = edges[edges.length - 1];
  const step = edges.length > 1 ? (last - first) / (edges.length - 1) : Math.max(Math.abs(first) * 0.5, 1e-6);
  let lo = first - step, hi = last + step;
  if (first >= 0) lo = Math.max(0, lo);
  const v = value != null && Number.isFinite(value) ? value : null;
  if (v != null) { lo = Math.min(lo, v - step * 0.25); hi = Math.max(hi, v + step * 0.25); if (first >= 0) lo = Math.max(0, lo); }
  const span = hi - lo;
  if (!(span > 0)) return null;
  const at = (x: number) => Math.min(1, Math.max(0, (x - lo) / span));
  const segments: TrackSegment[] = [];
  bands.forEach((b, band) => {
    if (b.min == null && b.max == null) return;
    const from = Math.max(lo, b.min ?? -Infinity), to = Math.min(hi, b.max ?? Infinity);
    if (!(to > from)) return;
    segments.push({ band, start: at(from), width: at(to) - at(from), ...(b.unjudged ? { neutral: true } : {}) });
  });
  if (!segments.length) return null;
  segments.sort((a, b) => a.start - b.start);
  return { lo, hi, segments, position: v != null ? at(v) : null, edges: edges.filter((e) => e > lo && e < hi).map((e) => ({ value: e, at: at(e) })) };
}

/** The person as the bands need them: sex, age, height, weight; the document carries no ancestry, so the standard cut-offs stand. */
export function bodyCtxOf(d: PersonData): BodyCtx {
  const weight = d.markerByKey("weight")?.series().slice(-1)[0]?.v ?? null;
  return { sex: String(d.profile?.sex ?? "").toLowerCase() === "female" ? "female" : "male", age: d.profile?.age != null ? Number(d.profile.age) : null, heightCm: Number(d.profile?.height_cm) || null, weightKg: weight, ethnicity: null };
}

/** Who wrote a reading: the report it was read from, the scale's day in the store, or the app's own row. */
function writerIndex(d: PersonData): (key: string, day: string, v: number) => string {
  const fromReport = new Set<string>();
  for (const r of d.labs) { const k = chartKeyFor(String(r.analyte)); if (k && Number.isFinite(Number(r.value))) fromReport.add(`${k}|${String(r.measured_on).slice(0, 10)}|${Number(r.value)}`); }
  const fromScale = new Set<string>();
  for (const r of d.signals) for (const col of ["body_fat_pct", "ffm_kg", "waist_cm"]) if (r[col] != null) fromScale.add(`${col}|${String(r.day).slice(0, 10)}|${Number(r[col])}`);
  return (key, day, v) => fromReport.has(`${key}|${day}|${v}`) ? "lab report" : fromScale.has(`${key}|${day}|${v}`) ? "the scale, via the phone's health store" : "entered in the app";
}

const fmtVal = (v: number, key: string) => key === "gait_speed_ms" ? v.toFixed(2) : Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();

function readingsOf(d: PersonData, def: BodyDef, who: ReturnType<typeof writerIndex>): Reading[] {
  if (def.key === "remnant") {
    return [...d.labsShown].filter((l) => l.analyte === REMNANT_LABEL && Number.isFinite(Number(l.value)))
      .map((l) => ({ d: String(l.measured_on).slice(0, 10), v: Number(l.value), unit: l.unit ?? null, writer: "total − HDL − LDL, one report" }))
      .sort((a, b) => a.d.localeCompare(b.d));
  }
  if (def.key === "sppb_score") return sppbSeries(d.app).map((p) => ({ d: p.d, v: p.v, unit: null, writer: "the app's three tests, one day" }));
  const pts: Pt[] = d.by.get(def.key) ?? [];
  return pts.map((p) => ({ d: p.d, v: p.v, unit: p.unit ?? null, writer: who(def.key, p.d, p.v) }));
}

/** One marker as a row of the list. */
export function bodyRowOf(d: PersonData, def: BodyDef, ctx: BodyCtx, who = writerIndex(d)): BodyRow {
  const history = readingsOf(d, def, who);
  const latest = history[history.length - 1] ?? null;
  // Lp(a) and remnant are judged in the unit the reading carries; every other marker in the app's unit
  let bands: Band[];
  if (def.key === "lpa_value") bands = lpaBands(latest && u(latest.unit) === "mg/dl" ? "mg/dL" : "nmol/L");
  else if (def.key === "remnant") bands = remnantBands(latest && isMmol(latest.unit) ? "mmol/L" : "mg/dL");
  else bands = def.bands(ctx);
  const judged = latest ? (def.judge ? def.judge(latest.v, ctx) : def.key === "lpa_value" || def.key === "remnant" ? latest.v : toAppUnit(def.key, latest.v, latest.unit)) : null;
  const band = judged != null && bands.length ? (() => { const i = bands.findIndex((b) => b.match(judged)); return i >= 0 ? i : null; })() : null;
  const tone = toneOf(band, bands);
  const shownUnit = latest?.unit || def.unit;
  return {
    key: def.key, section: def.section, label: def.label,
    value: latest ? fmtVal(latest.v, def.key) : null, unit: latest ? shownUnit : def.unit,
    on: latest?.d ?? null, writer: latest?.writer ?? null,
    bands, band, bandLabel: band != null ? bands[band].label : null, tone,
    watch: !!latest && !def.once && band != null && band > 0 && !bands[band].unjudged,
    once: !!def.once,
    track: judged != null && band != null ? rangeTrack(bands, judged) : null,
    subline: latest ? (bands.length ? null : def.subline ?? null) : (def.computed ? def.needs ?? null : null),
    history,
  };
}

/** The list: three sections in the app's order, the counts, the rows outside their range, the latest report date. */
export function bodyListOf(d: PersonData): BodyList {
  const ctx = bodyCtxOf(d);
  const who = writerIndex(d);
  const sections = BODY_SECTIONS.map(({ key, title }) => {
    const rows = BODY_DEFS.filter((x) => x.section === key).map((x) => bodyRowOf(d, x, ctx, who));
    return { key, title, rows, total: rows.length, recorded: rows.filter((r) => r.value != null).length, watch: rows.filter((r) => r.watch).length };
  });
  const all = sections.flatMap((s) => s.rows);
  const latestLab = d.labs.map((l) => String(l.measured_on ?? "").slice(0, 10)).filter(Boolean).sort().pop() ?? null;
  return { sections, total: all.length, recorded: all.filter((r) => r.value != null).length, watch: all.filter((r) => r.watch).length, outside: all.filter((r) => r.watch), latestLab };
}

/** The band a value of one marker falls in, in the app's words: for the snapshot's "reads as" column. */
export function judgeValue(d: PersonData, key: string, v: number, unit: string | null): { label: string | null; tone: Tone } {
  const def = BODY_DEFS.find((x) => x.key === key);
  if (!def) return { label: null, tone: "neutral" };
  const ctx = bodyCtxOf(d);
  const bands = def.key === "lpa_value" ? lpaBands(u(unit) === "mg/dl" ? "mg/dL" : "nmol/L") : def.key === "remnant" ? remnantBands(isMmol(unit) ? "mmol/L" : "mg/dL") : def.bands(ctx);
  const judged = def.judge ? def.judge(v, ctx) : def.key === "lpa_value" || def.key === "remnant" ? v : toAppUnit(key, v, unit);
  if (judged == null || !bands.length) return { label: null, tone: "neutral" };
  const i = bands.findIndex((b) => b.match(judged));
  return { label: i >= 0 ? bands[i].label : null, tone: toneOf(i >= 0 ? i : null, bands) };
}

/** The sentence over the list: "Two markers outside their range: LDL and waist". */
export function bodyHeadline(list: BodyList): string {
  if (!list.recorded) return "Nothing read yet";
  if (!list.outside.length) return "Every marker read sits in its range";
  const names = list.outside.map((r) => r.label.replace(" cholesterol", "").replace("Fasting blood sugar", "fasting glucose"));
  const n = list.outside.length;
  const word = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][n - 1] ?? String(n);
  return `${word} marker${n === 1 ? "" : "s"} outside ${n === 1 ? "its" : "their"} range: ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}`;
}
