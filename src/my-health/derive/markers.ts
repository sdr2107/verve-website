/**
 * The 22 markers the app tracks (ApoA1 joined ApoB on 2026-10-27), read from a person's rows: the columns,
 * the names a report may use for them, every reading of each by chart key,
 * the lab's own range on each reading, and when each is next due. Pure.
 */
import { canonName } from "../../lib/canon.js";
import { addDays, daysBetween, esc, fmt1, fmtDay, localDay, monthOf, monthYearOf, ordinal, signed } from "./format.ts";

export const LABELS: Record<string, { label: string; unit: string; section: "metabolic" | "heart" | "sarcopenia" }> = {
  glucose_mgdl:           { label: "Fasting glucose",   unit: "mg/dL",  section: "metabolic" },
  hba1c_pct:              { label: "HbA1c",             unit: "%",      section: "metabolic" },
  post_meal_glucose_mgdl: { label: "Post-meal glucose", unit: "mg/dL",  section: "metabolic" },
  fasting_insulin_uiuml:  { label: "Fasting insulin",   unit: "uIU/mL", section: "metabolic" },
  triglycerides_mgdl:     { label: "Triglycerides",     unit: "mg/dL",  section: "metabolic" },
  hdl_mgdl:               { label: "HDL",               unit: "mg/dL",  section: "metabolic" },
  waist_cm:               { label: "Waist",             unit: "cm",     section: "metabolic" },
  sbp:                    { label: "Systolic BP",       unit: "mmHg",   section: "metabolic" },
  dbp:                    { label: "Diastolic BP",      unit: "mmHg",   section: "metabolic" },
  apo_b_mgdl:             { label: "ApoB",              unit: "mg/dL",  section: "heart" },
  apo_a1_mgdl:            { label: "ApoA1",             unit: "mg/dL",  section: "heart" },
  ldl_mgdl:               { label: "LDL",               unit: "mg/dL",  section: "heart" },
  lpa_value:              { label: "Lp(a)",             unit: "",       section: "heart" },
  hs_crp_mgl:             { label: "hs-CRP",            unit: "mg/L",   section: "heart" },
  body_fat_pct:           { label: "Body fat",          unit: "%",      section: "sarcopenia" },
  skel_musc_pct:          { label: "Skeletal muscle",   unit: "%",      section: "sarcopenia" },
  alm_kg:                     { label: "Lean mass, arms and legs", unit: "kg",  section: "sarcopenia" },
  ffm_kg:                     { label: "Whole-body lean mass",     unit: "kg",  section: "sarcopenia" },
  handgrip_kg:                { label: "Grip strength",            unit: "kg",  section: "sarcopenia" },
  single_leg_balance_seconds: { label: "Single-leg balance",       unit: "s",   section: "sarcopenia" },
  chair_stand_seconds:        { label: "Chair stand",              unit: "s",   section: "sarcopenia" },
  gait_speed_ms:              { label: "Walk speed",               unit: "m/s", section: "sarcopenia" },
};

// A chart key is a lab_readings column, except "bp", which pairs sbp and
// dbp, and "sppb_score", which the app computes and no table stores. A
// marker with no reading anywhere shows as a dashed chip, never hidden:
// the page says 22 markers, and 22 it is.
export type ChartMarker = { key: string; label: string; section: "metabolic" | "heart" | "muscle"; pair?: [string, string]; lines?: [number, number] };
export const CHART_MARKERS: ChartMarker[] = [
  { key: "glucose_mgdl", label: "Fasting glucose", section: "metabolic" },
  { key: "hba1c_pct", label: "HbA1c", section: "metabolic" },
  { key: "bp", label: "Blood pressure", section: "metabolic", pair: ["sbp", "dbp"], lines: [120, 80] },
  { key: "triglycerides_mgdl", label: "Triglycerides", section: "metabolic" },
  { key: "hdl_mgdl", label: "HDL", section: "metabolic" },
  { key: "waist_cm", label: "Waist", section: "metabolic" },
  { key: "post_meal_glucose_mgdl", label: "Post-meal glucose", section: "metabolic" },
  { key: "fasting_insulin_uiuml", label: "Fasting insulin", section: "metabolic" },
  { key: "apo_b_mgdl", label: "ApoB", section: "heart" },
  { key: "apo_a1_mgdl", label: "ApoA1", section: "heart" },
  { key: "ldl_mgdl", label: "LDL", section: "heart" },
  { key: "lpa_value", label: "Lp(a)", section: "heart" },
  { key: "hs_crp_mgl", label: "hs-CRP", section: "heart" },
  { key: "body_fat_pct", label: "Body fat", section: "muscle" },
  { key: "skel_musc_pct", label: "Muscle mass", section: "muscle" },
  { key: "alm_kg", label: "Lean mass, arms and legs", section: "muscle" },
  { key: "ffm_kg", label: "Whole-body lean mass", section: "muscle" },
  { key: "handgrip_kg", label: "Grip strength", section: "muscle" },
  { key: "single_leg_balance_seconds", label: "Single-leg balance", section: "muscle" },
  { key: "chair_stand_seconds", label: "Chair stand", section: "muscle" },
  { key: "sppb_score", label: "SPPB", section: "muscle" },
  { key: "gait_speed_ms", label: "Walk speed", section: "muscle" },
];

/** Canonical analyte name (letters and digits only) → the app's column. */
export const APP_KEY_BY_NAME: Record<string, string> = {
  fastingglucose: "glucose_mgdl", glucosefasting: "glucose_mgdl", fastingbloodsugar: "glucose_mgdl", fbs: "glucose_mgdl", glucosef: "glucose_mgdl",
  hba1c: "hba1c_pct", hemoglobina1c: "hba1c_pct", glycatedhemoglobin: "hba1c_pct", glycosylatedhemoglobin: "hba1c_pct",
  postmealglucose: "post_meal_glucose_mgdl", postprandialglucose: "post_meal_glucose_mgdl", ppglucose: "post_meal_glucose_mgdl", glucosepp: "post_meal_glucose_mgdl", glucosepostprandial: "post_meal_glucose_mgdl",
  fastinginsulin: "fasting_insulin_uiuml", insulinfasting: "fasting_insulin_uiuml", insulin: "fasting_insulin_uiuml",
  triglycerides: "triglycerides_mgdl", hdl: "hdl_mgdl", hdlcholesterol: "hdl_mgdl",
  waist: "waist_cm", waistcircumference: "waist_cm",
  systolicbp: "sbp", systolicbloodpressure: "sbp", diastolicbp: "dbp", diastolicbloodpressure: "dbp",
  apob: "apo_b_mgdl", apolipoproteinb: "apo_b_mgdl", apoa1: "apo_a1_mgdl", apolipoproteina1: "apo_a1_mgdl", ldl: "ldl_mgdl", ldlcholesterol: "ldl_mgdl",
  lpa: "lpa_value", lipoproteina: "lpa_value",
  hscrp: "hs_crp_mgl", highsensitivitycrp: "hs_crp_mgl", crphs: "hs_crp_mgl", hscreactiveprotein: "hs_crp_mgl",
  bodyfat: "body_fat_pct", bodyfatpercentage: "body_fat_pct", skeletalmuscle: "skel_musc_pct", skeletalmusclepercentage: "skel_musc_pct",
  musclemass: "skel_musc_pct", musclemasspercentage: "skel_musc_pct",
  leanmassarmsandlegs: "alm_kg", appendicularleanmass: "alm_kg", alm: "alm_kg",
  wholebodyleanmass: "ffm_kg", fatfreemass: "ffm_kg", leanmass: "ffm_kg", leanbodymass: "ffm_kg",
  gripstrength: "handgrip_kg", handgrip: "handgrip_kg", handgripstrength: "handgrip_kg",
  singlelegbalance: "single_leg_balance_seconds", singlelegstand: "single_leg_balance_seconds", onelegstand: "single_leg_balance_seconds",
  chairstand: "chair_stand_seconds", chairstand5: "chair_stand_seconds", sittostand: "chair_stand_seconds", fivetimessittostand: "chair_stand_seconds",
  walkspeed: "gait_speed_ms", gaitspeed: "gait_speed_ms", usualgaitspeed: "gait_speed_ms",
};
export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
export function appKeyFor(analyte: string): string | null {
  return APP_KEY_BY_NAME[squash(canonName(String(analyte)))] ?? null;
}
/** The chart's key for an analyte name: the app's column, or SPPB. */
export const chartKeyFor = (analyte: string) => appKeyFor(analyte) ?? (squash(canonName(analyte)) === "sppb" || squash(canonName(analyte)) === "sppbscore" ? "sppb_score" : null);

export type Pt = { d: string; v: number; lo: number | null; hi: number | null; unit: string | null; n?: number; max?: number };
/**
 * Every reading of every marker this person has, by chart key, from the
 * three places one can come from: the values read from reports and
 * imports (web_labs), the app's own rows (lab_readings), and waist days
 * (web_body). The same value on the same day is one reading.
 */
export function markerPointsFrom(labs: any[], app: any[], body: any[], signals: any[] = []): Map<string, Pt[]> {
  const by = new Map<string, Pt[]>();
  const seen = new Set<string>();
  const add = (key: string, pt: Pt) => {
    const id = `${key}|${pt.d}|${pt.v}`;
    if (seen.has(id)) return;
    seen.add(id);
    (by.get(key) ?? by.set(key, []).get(key)!).push(pt);
  };
  for (const r of labs) {
    const k = chartKeyFor(String(r.analyte));
    if (!k || !Number.isFinite(Number(r.value))) continue;
    add(k, { d: String(r.measured_on).slice(0, 10), v: Number(r.value), lo: Number.isFinite(Number(r.ref_low)) && r.ref_low != null ? Number(r.ref_low) : null, hi: Number.isFinite(Number(r.ref_high)) && r.ref_high != null ? Number(r.ref_high) : null, unit: r.unit ?? null });
  }
  for (const r of app) {
    const d = localDay(r.measured_at);
    for (const m of CHART_MARKERS) {
      const cols = m.pair ?? [m.key];
      for (const col of cols) {
        const v = Number(r[col]);
        if (r[col] == null || !Number.isFinite(v)) continue;
        add(col, { d, v, lo: null, hi: null, unit: col === "lpa_value" ? (r.lpa_unit ?? null) : (LABELS[col]?.unit || null) });
      }
    }
  }
  // a cuff's readings from Apple Health, one point a day: the day's mean, how many, and its highest
  // (daily_signals, 2026-10-26). A reading typed into Verve on the same day wins: it is the one that can be edited.
  const typedDays = new Set((by.get("sbp") ?? []).map((p) => p.d));
  for (const r of signals) {
    const n = Number(r.bp_n);
    if (!n || r.bp_sbp == null || r.bp_dbp == null) continue;
    const d = String(r.day).slice(0, 10);
    if (typedDays.has(d)) continue;
    add("sbp", { d, v: Math.round(Number(r.bp_sbp)), lo: null, hi: null, unit: "mmHg", n, max: Number(r.bp_sbp_max) || undefined });
    add("dbp", { d, v: Math.round(Number(r.bp_dbp)), lo: null, hi: null, unit: "mmHg", n, max: Number(r.bp_dbp_max) || undefined });
  }
  for (const b of body) if (b.waist_cm != null && Number.isFinite(Number(b.waist_cm)))
    add("waist_cm", { d: String(b.measured_on).slice(0, 10), v: Number(b.waist_cm), lo: null, hi: null, unit: "cm" });
  for (const pts of by.values()) pts.sort((a, b) => a.d.localeCompare(b.d));
  return by;
}
export const hasPoints = (m: ChartMarker, by: Map<string, Pt[]>) => m.pair ? m.pair.some((k) => by.has(k)) : by.has(m.key);

export function inRange(v: { value: number; ref_low?: number | null; ref_high?: number | null }): boolean | null {
  const lo = v.ref_low, hi = v.ref_high;
  if (lo == null && hi == null) return null;
  if (lo != null && v.value < lo) return false;
  if (hi != null && v.value > hi) return false;
  return true;
}
export function rangeLabel(v: { ref_low?: number | null; ref_high?: number | null; ref_text?: string | null }): string {
  if (v.ref_text) return v.ref_text;
  if (v.ref_low != null && v.ref_high != null) return `${v.ref_low}–${v.ref_high}`;
  if (v.ref_high != null) return `<${v.ref_high}`;
  if (v.ref_low != null) return `>${v.ref_low}`;
  return "";
}
export const rangeText = (pt: Pt | null) => !pt ? "" : pt.lo != null && pt.hi != null ? `${pt.lo} to ${pt.hi}` : pt.hi != null ? `below ${pt.hi}` : pt.lo != null ? `above ${pt.lo}` : "";

/**
 * The cited retest cadences, in days, from the app's own threshold table:
 * one figure while the latest reading is in range, a shorter one once it
 * is outside. The lipid panel shares one draw and one interval.
 */
export const RETEST: Record<string, { ok: number; out: number; text: string; source: string }> = {
  glucose_mgdl:       { ok: 1095, out: 365,  text: "every 3 years · yearly from 100 mg/dL",            source: "ADA Standards of Care 2026" },
  hba1c_pct:          { ok: 1095, out: 365,  text: "every 3 years · yearly from 5.7%",                 source: "ADA Standards of Care 2026" },
  bp:                 { ok: 365,  out: 91,   text: "yearly under 120/80 · 3 to 6 months once above",   source: "AHA/ACC 2017" },
  triglycerides_mgdl: { ok: 1461, out: 1461, text: "every 4 to 6 years · one draw for the panel",       source: "AHA · USPSTF" },
  hdl_mgdl:           { ok: 1461, out: 1461, text: "every 4 to 6 years · one draw for the panel",       source: "AHA · USPSTF" },
  apo_b_mgdl:         { ok: 1461, out: 1461, text: "every 4 to 6 years · one draw for the panel",       source: "AHA · USPSTF" },
  ldl_mgdl:           { ok: 1461, out: 1461, text: "every 4 to 6 years · one draw for the panel",       source: "AHA · USPSTF" },
  alm_kg:             { ok: 182,  out: 182,  text: "every 6 months",                                   source: "Verve's own cadence, anchored to EWGSOP2" },
};
export const CRF_RETEST = { due: 56, overdue: 112 };          // the app's own reminder: eight weeks, overdue at sixteen
export const BODY_RETEST = 182;                               // a body assessment every six months, the app's cadence
export const METHOD_LABEL: Record<string, string> = { cpet: "CPET", "treadmill-test": "treadmill test", "bruce-protocol": "Bruce protocol", "cooper-run": "Cooper run", "1.5-mile-run": "1.5-mile run", "six-minute-walk": "six-minute walk", "one-mile-walk": "one-mile walk" };
export const MAXIMAL = new Set(["cpet", "treadmill-test", "bruce-protocol", "cooper-run", "1.5-mile-run"]);
export const methodLabel = (m: unknown) => METHOD_LABEL[String(m ?? "")] ?? String(m ?? "").replace(/-/g, " ");

export type Due = { what: string; on: string; days: number; why: string };
/** When a marker is next due, from its latest reading and whether that reading sits in the lab's range. */
export function dueFor(key: string, pts: Pt[], today = new Date().toLocaleDateString("en-CA")): Due | null {
  const r = RETEST[key]; if (!r || !pts.length) return null;
  const last = pts[pts.length - 1];
  const ranged = [...pts].reverse().find((p) => p.lo != null || p.hi != null) ?? null;
  const out = ranged ? inRange({ value: last.v, ref_low: ranged.lo, ref_high: ranged.hi }) === false : false;
  const on = addDays(last.d, out ? r.out : r.ok);
  return { what: CHART_MARKERS.find((m) => m.key === key)?.label ?? key, on, days: daysBetween(today, on), why: r.text };
}
export const dueWord = (d: Due) => d.days < 0 ? `overdue ${Math.abs(d.days) < 14 ? `${Math.abs(d.days)} days` : `${Math.round(Math.abs(d.days) / 7)} weeks`}` : d.days === 0 ? "due today" : d.days < 45 ? `due ${fmtDay(d.on)}` : `due ${monthYearOf(d.on)}`;
export const dueTone = (d: Due) => d.days < 0 ? "text-danger" : d.days <= 30 ? "text-warning" : "text-text-secondary";

export type LabRow = { key: string; label: string; latest: string; tone: string; range: string; since: string; sinceTone: string; retest: string; retestTone: string; out: boolean; d: string; due: Due | null; noFollow: number | null };
/** Labs: one row per marker on file, against the lab's own range, with the change since last and the cited cadence. */
export function labRowsFrom(by: Map<string, Pt[]>, today: string): LabRow[] {
  const rows: LabRow[] = [];
  for (const m of CHART_MARKERS) {
    if (m.section === "muscle" || m.key === "waist_cm") continue;
    if (m.pair) {
      const S = by.get("sbp") ?? [], D = by.get("dbp") ?? [];
      if (!S.length) continue;
      const bp = restingBPOf(S, D);
      if (!bp) continue;
      const out = bp.crisis || bp.sbp >= 120 || bp.dbp >= 80;
      const due: Due = { what: "Blood pressure", on: addDays(bp.d, out ? RETEST.bp.out : RETEST.bp.ok), days: 0, why: RETEST.bp.text };
      due.days = daysBetween(today, due.on);
      const latest = bp.crisis ? `${bp.sbp}/${bp.dbp} mmHg, a crisis-level reading on ${fmtDay(bp.d)}`
        : bp.basis === "average" ? `${bp.sbp}/${bp.dbp} mmHg, the ${bp.days}-day average of ${bp.n} readings to ${fmtDay(bp.d)}`
        : `${bp.sbp}/${bp.dbp} mmHg, a single reading on ${fmtDay(bp.d)}`;
      rows.push({ key: "bp", label: "Blood pressure", latest, tone: bp.crisis ? "text-danger" : out ? "text-warning" : "text-text-primary", range: "under 120/80 (crisis 180/120 or above)",
        since: bp.prev ? `${signed(bp.sbp - bp.prev.sbp, 0)}/${signed(bp.dbp - bp.prev.dbp, 0)} against the ${bp.days ?? 30} days before` : "no earlier average", sinceTone: out ? "text-warning" : "text-text-secondary",
        retest: bp.crisis ? "a reading at crisis level is acted on now, not averaged: see a doctor today" : `${dueWord(due)} · ${due.why}`, retestTone: bp.crisis ? "text-danger" : dueTone(due), out, d: bp.d, due, noFollow: null });
      continue;
    }
    const pts = by.get(m.key) ?? [];
    if (!pts.length) continue;
    const last = pts[pts.length - 1], prev = pts[pts.length - 2] ?? null;
    const ranged = [...pts].reverse().find((x) => x.lo != null || x.hi != null) ?? null;
    const out = ranged ? inRange({ value: last.v, ref_low: ranged.lo, ref_high: ranged.hi }) === false : false;
    const due = dueFor(m.key, pts, today);
    const months = Math.floor(daysBetween(last.d, today) / 30);
    const noFollow = out && months >= 3 ? months : null;
    rows.push({ key: m.key, label: m.label, latest: `${last.v}${last.unit ? ` ${last.unit}` : ""}`, tone: out ? "text-warning" : "text-text-primary", range: ranged ? rangeText(ranged) : "no range on file", since: prev ? `${signed(last.v - prev.v, Number.isInteger(last.v) && Number.isInteger(prev.v) ? 0 : 1)} since ${monthOf(prev.d)}` : "measured once", sinceTone: out ? "text-warning" : prev && ranged && inRange({ value: prev.v, ref_low: ranged.lo, ref_high: ranged.hi }) === false ? "text-success-light" : "text-text-secondary", retest: noFollow ? `outside range, no follow-up in ${noFollow} months` : due ? `${dueWord(due)} · ${due.why}` : "—", retestTone: noFollow ? "text-warning" : due ? dueTone(due) : "text-text-muted", out, d: last.d, due, noFollow });
  }
  rows.sort((x, y) => Number(y.out) - Number(x.out) || y.d.localeCompare(x.d));
  return rows;
}
/**
 * Resting blood pressure, the app's rule (lib/restingBPCore.ts): the mean of every reading in the 30 days to
 * the newest, else 14, else 7 (each needs two readings or more), else the newest single reading. Days from a
 * cuff carry their count, so the mean is of readings, not of days. The exception: a reading at hypertensive
 * crisis level (180 systolic or 120 diastolic, or above; 2017 ACC/AHA) in those 30 days leads on its own.
 */
export function restingBPOf(S: Pt[], D: Pt[]) {
  const pairs = S.map((s) => { const d = D.find((x) => x.d === s.d && (x.n ?? 1) === (s.n ?? 1)) ?? D.find((x) => x.d === s.d); return d ? { d: s.d, s: s.v, dv: d.v, n: s.n ?? 1, smax: s.max ?? s.v, dmax: d.max ?? d.v } : null; })
    .filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => a.d.localeCompare(b.d));
  if (!pairs.length) return null;
  const newest = pairs[pairs.length - 1].d;
  const within = (days: number, end = newest) => pairs.filter((p) => p.d > addDays(end, -days) && p.d <= end);
  const crisis = within(30).filter((p) => p.smax >= 180 || p.dmax >= 120).pop();
  if (crisis) return { basis: "crisis" as const, crisis: true, sbp: crisis.smax, dbp: crisis.dmax, d: crisis.d, n: 1, days: null as number | null, prev: null as { sbp: number; dbp: number } | null };
  const mean = (w: typeof pairs) => { const n = w.reduce((a, p) => a + p.n, 0); return { n, sbp: Math.round(w.reduce((a, p) => a + p.s * p.n, 0) / n), dbp: Math.round(w.reduce((a, p) => a + p.dv * p.n, 0) / n) }; };
  for (const days of [30, 14, 7]) {
    const w = within(days);
    const n = w.reduce((a, p) => a + p.n, 0);
    if (n >= 2) {
      const m = mean(w);
      const before = within(days, addDays(newest, -days));
      const pm = before.reduce((a, p) => a + p.n, 0) >= 2 ? mean(before) : null;
      return { basis: "average" as const, crisis: false, sbp: m.sbp, dbp: m.dbp, d: newest, n: m.n, days, prev: pm ? { sbp: pm.sbp, dbp: pm.dbp } : null };
    }
  }
  const last = pairs[pairs.length - 1];
  return { basis: "single" as const, crisis: false, sbp: last.s, dbp: last.dv, d: last.d, n: 1, days: null, prev: null };
}

/** The next body assessment, six months after the latest muscle reading of any kind. */
export function bodyDueFrom(by: Map<string, Pt[]>, today: string): Due | null {
  const days = ["alm_kg", "body_fat_pct", "skel_musc_pct", "handgrip_kg", "chair_stand_seconds", "gait_speed_ms", "single_leg_balance_seconds"].flatMap((k) => (by.get(k) ?? []).map((x) => x.d)).sort();
  if (!days.length) return null;
  const on = addDays(days[days.length - 1], BODY_RETEST);
  return { what: "Body assessment", on, days: daysBetween(today, on), why: "every 6 months, Verve's own cadence anchored to EWGSOP2" };
}
/** What changed in the last seven days: values read, tests taken, a streak reached, a quiet spell. */
export function eventsFrom(labs: any[], labRows: LabRow[], fit: { tests: any[]; latest: any; within: number | null }, act: { streak: number; complete: any[]; quietDays: number | null }, today: string): Array<{ d: string; text: string }> {
  const weekAgo = addDays(today, -7);
  const events: Array<{ d: string; text: string }> = [];
  const byDayFiled = new Map<string, any[]>();
  for (const r of labs) { const d = String(r.created_at ?? "").slice(0, 10); if (d >= weekAgo) (byDayFiled.get(d) ?? byDayFiled.set(d, []).get(d)!).push(r); }
  for (const [d, rows] of byDayFiled) {
    const named = rows.map((r) => ({ r, key: chartKeyFor(String(r.analyte)) })).filter((x) => x.key && labRows.some((l) => l.key === x.key || (l.key === "bp" && (x.key === "sbp" || x.key === "dbp"))));
    const pick = named.find((x) => labRows.find((l) => l.key === x.key)?.out) ?? named[0];
    if (pick) { const l = labRows.find((x) => x.key === pick.key); events.push({ d, text: `${esc(String(pick.r.analyte))} ${pick.r.value} read from a report${l && l.since !== "measured once" ? `, ${esc(l.since)}` : ""}${l?.out ? ", above the lab's range" : ""}` }); }
    else events.push({ d, text: `${rows.length} value${rows.length === 1 ? "" : "s"} read from a report` });
  }
  for (const t of fit.tests.filter((t) => t.measured_on >= weekAgo)) events.push({ d: t.measured_on, text: `${esc(methodLabel(t.method))} ${fmt1(t.v)}${t === fit.latest && fit.within != null ? `, ${fit.within >= 0 ? "up" : "down"} ${fmt1(Math.abs(fit.within))} within the method` : ""}` });
  if (act.streak >= 2 && act.complete.length) events.push({ d: addDays(act.complete[act.complete.length - 1].week_start, 6), text: `${ordinal(act.streak)} week at goal in a row` });
  if (act.quietDays != null && act.quietDays >= 14) events.push({ d: today, text: `${act.quietDays} days without a workout` });
  return events.sort((x, y) => y.d.localeCompare(x.d));
}
