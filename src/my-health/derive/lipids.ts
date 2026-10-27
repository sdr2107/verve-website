/**
 * The two lipid ratios on the website, computed from a report's own rows and
 * never stored: TG/HDL (an insulin-resistance screen; McLaughlin 2003, 2005)
 * and ApoB/ApoA1 (AMORIS, INTERHEART). The same arithmetic and the same
 * thresholds as the app's lib/lipids.ts, read from a generated copy of the
 * app's thresholds file, so a report read here and a value typed in the app
 * land on the same ratio and the same band.
 *
 * A ratio is formed only from two analytes printed on the SAME report date:
 * the ratio of a January triglyceride and a June HDL is not a reading. A
 * mmol/L report is converted first (TG × 88.57, HDL × 38.67); ApoB and
 * ApoA1 cancel their units when they share one.
 *
 * The computed row looks like any other lab row (analyte, value, unit,
 * ref_high, ref_text, section, measured_on), so the Labs tab, its spark
 * line, its chart and the "outside range" count read it without a special
 * case. `computed: true` keeps it out of exports and report echoes.
 */
import LR from "../../data/lipid-ratios.ts";
import { canonName } from "../../lib/canon.js";

const TG_MGDL_PER_MMOL = 88.57;
const HDL_MGDL_PER_MMOL = 38.67;

export type LabRow = {
  analyte: string; value: number | string; unit?: string | null;
  ref_low?: number | null; ref_high?: number | null; ref_text?: string | null;
  section: string; measured_on: string; report_path?: string | null; computed?: boolean;
};

const isMmol = (u: string | null | undefined) => /mmol/i.test(u ?? "");

/** TG ÷ HDL in mg/dL terms, one decimal; null without both halves or with a zero HDL. */
export function tgHdlRatio(tg: number, tgUnit: string | null | undefined, hdl: number, hdlUnit: string | null | undefined): number | null {
  const t = isMmol(tgUnit) ? tg * TG_MGDL_PER_MMOL : tg;
  const h = isMmol(hdlUnit) ? hdl * HDL_MGDL_PER_MMOL : hdl;
  if (!(h > 0) || !(t >= 0)) return null;
  return Math.round((t / h) * 10) / 10;
}

/** ApoB ÷ ApoA1, two decimals; null unless both share a unit and ApoA1 is above zero. */
export function apoRatio(apoB: number, apoBUnit: string | null | undefined, apoA1: number, apoA1Unit: string | null | undefined): number | null {
  const norm = (u: string | null | undefined) => (u ?? "").toLowerCase().replace(/\s+/g, "");
  if (norm(apoBUnit) !== norm(apoA1Unit)) return null;
  if (!(apoA1 > 0) || !(apoB >= 0)) return null;
  return Math.round((apoB / apoA1) * 100) / 100;
}

export const apoRatioCut = (sex: string | null | undefined) => (sex === "female" ? LR.apoBApoA1.elevatedFromFemale : LR.apoBApoA1.elevatedFromMale);
export const tgHdlUnbanded = (ethnicity: string | null | undefined) => !!ethnicity && (LR.tgHdl.notForEthnicity as readonly string[]).includes(ethnicity);

export const TG_HDL_LABEL = "TG/HDL ratio";
export const APO_RATIO_LABEL = "ApoB/ApoA1 ratio";

/**
 * The computed rows for a person's lab rows: one TG/HDL and one ApoB/ApoA1
 * per report date that carries both halves. `profile` supplies the sex
 * (which ApoB/ApoA1 line) and the ancestry setting (whether TG/HDL has a
 * band at all); both default to the men's line and a band drawn.
 */
export function lipidRatioRows(labs: LabRow[], profile?: { sex?: string | null; ethnicity?: string | null } | null): LabRow[] {
  const byDay = new Map<string, Record<string, LabRow>>();
  for (const r of labs) {
    if (r.computed) continue;
    const name = canonName(String(r.analyte));
    if (!["Triglycerides", "HDL Cholesterol", "Apolipoprotein B", "Apolipoprotein A1"].includes(name)) continue;
    const v = Number(r.value);
    if (!Number.isFinite(v)) continue;
    const d = String(r.measured_on).slice(0, 10);
    const slot = byDay.get(d) ?? byDay.set(d, {}).get(d)!;
    if (!slot[name]) slot[name] = r;   // the first printed value on that date stands
  }
  const out: LabRow[] = [];
  const unbanded = tgHdlUnbanded(profile?.ethnicity);
  const cut = apoRatioCut(profile?.sex);
  for (const [d, slot] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const tg = slot["Triglycerides"], hdl = slot["HDL Cholesterol"];
    if (tg && hdl) {
      const v = tgHdlRatio(Number(tg.value), tg.unit, Number(hdl.value), hdl.unit);
      if (v != null) out.push({
        analyte: TG_HDL_LABEL, value: v, unit: "", section: "lipids", measured_on: d, computed: true,
        report_path: tg.report_path ?? hdl.report_path ?? null,
        // No band for an ancestry where the ratio does not mark insulin resistance (Sumner 2005).
        ref_low: null, ref_high: unbanded ? null : LR.tgHdl.elevatedFrom - 0.05,
        ref_text: unbanded ? "no band for this ancestry" : `< ${LR.tgHdl.elevatedFrom.toFixed(1)}`,
      });
    }
    const b = slot["Apolipoprotein B"], a1 = slot["Apolipoprotein A1"];
    if (b && a1) {
      const v = apoRatio(Number(b.value), b.unit, Number(a1.value), a1.unit);
      if (v != null) out.push({
        analyte: APO_RATIO_LABEL, value: v, unit: "", section: "lipids", measured_on: d, computed: true,
        report_path: b.report_path ?? a1.report_path ?? null,
        ref_low: null, ref_high: cut - 0.005, ref_text: `< ${cut.toFixed(2)}`,
      });
    }
  }
  return out;
}

/** The person's lab rows with the two computed ratios appended. */
export function withLipidRatios(labs: LabRow[], profile?: { sex?: string | null; ethnicity?: string | null } | null): LabRow[] {
  // Idempotent: a list that already carries computed rows is rebuilt from its measured rows.
  const base = labs.some((r) => r.computed) ? labs.filter((r) => !r.computed) : labs;
  const extra = lipidRatioRows(base, profile);
  return extra.length ? [...base, ...extra] : base;
}
