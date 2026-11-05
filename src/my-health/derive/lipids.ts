/**
 * The two lipid ratios and remnant cholesterol on the website, computed from
 * a report's own rows and never stored: TG/HDL (an insulin-resistance screen;
 * McLaughlin 2003, 2005), ApoB/ApoA1 (AMORIS, INTERHEART), and remnant
 * cholesterol (total minus HDL minus LDL; one line at 30 mg/dL, PREDIMED,
 * Castaner 2020). The same arithmetic and the same thresholds as the app's
 * lib/lipids.ts, read from a generated copy of the app's thresholds file, so
 * a report read here and a value typed in the app land on the same figure
 * and the same band.
 *
 * Remnant cholesterol is ONE arithmetic, and the LDL's method only labels
 * what it means: a directly measured LDL makes it a measurement; a
 * calculated LDL makes it the share of triglycerides the lab's equation set
 * aside for VLDL (triglycerides / 5 under Friedewald in mg/dL, / 2.2 in
 * mmol/L; Martin-Hopkins and Sampson change the divisor, so it is labelled
 * and never recomputed). The method is the LDL row's own `method`, read off
 * the report by the parser; where none came with the row and the panel's
 * numbers match Friedewald, it reads as calculated, by the arithmetic. A
 * mmol/L report computes in mmol/L, and the line converts (0.78).
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
import { fmtDay } from "./format.ts";

const TG_MGDL_PER_MMOL = 88.57;
const HDL_MGDL_PER_MMOL = 38.67;

export type LdlMethod = "measured" | "calculated";

export type LabRow = {
  analyte: string; value: number | string; unit?: string | null;
  ref_low?: number | null; ref_high?: number | null; ref_text?: string | null;
  section: string; measured_on: string; report_path?: string | null; computed?: boolean;
  /** How the lab got the value, on an LDL row: web_labs.method. Absent on rows filed before the parser read it. */
  method?: LdlMethod | null;
  /** Short labels beside the name in the Labs tab: "computed", an LDL's method, what a remnant was made from. */
  tags?: string[];
  /** Under an opened row: the arithmetic in the report's own numbers, what the figure means, and the way onward. */
  explain?: { formula: string; body: string; link: { label: string; href: string } };
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
export const REMNANT_LABEL = "Remnant cholesterol";
export const REMNANT_SCIENCE_HREF = "/science/body/heart-health#remnant-cholesterol";

// ── remnant cholesterol ──────────────────────────────────────────────────────
const RC = LR.remnantCholesterol;
const CHOL_MGDL_PER_MMOL = RC.mgdlPerMmol;

type Num = number | null | undefined;
type Unit = string | null | undefined;
/** One report date's lipid panel, each value with the unit it was printed in. */
export type LipidPanel = {
  total?: Num; totalUnit?: Unit; hdl?: Num; hdlUnit?: Unit; ldl?: Num; ldlUnit?: Unit; tg?: Num; tgUnit?: Unit;
  method?: LdlMethod | null;
};

/** A report whose three cholesterols are all in mmol/L computes there; anything else computes in mg/dL. */
const panelInMmol = (p: LipidPanel) => isMmol(p.totalUnit) && isMmol(p.hdlUnit) && isMmol(p.ldlUnit);
const cholMgdl = (v: number, u: Unit) => (isMmol(u) ? v * CHOL_MGDL_PER_MMOL : v);

/**
 * Total minus HDL minus LDL, in the report's own unit: whole mg/dL, or
 * mmol/L to two decimals. Null without all three, and null for a negative
 * result, which no panel produces: it means the three are not one draw or a
 * digit was misread, and a remnant below zero would read as a very good one.
 * Nothing is estimated from triglycerides alone.
 */
export function remnantCholesterol(p: LipidPanel): { value: number; unit: "mg/dL" | "mmol/L" } | null {
  const { total, hdl, ldl } = p;
  if (total == null || hdl == null || ldl == null) return null;
  const mmol = panelInMmol(p);
  const t = mmol ? total : cholMgdl(total, p.totalUnit);
  const h = mmol ? hdl : cholMgdl(hdl, p.hdlUnit);
  const l = mmol ? ldl : cholMgdl(ldl, p.ldlUnit);
  if (!(t > 0) || !(h > 0) || !(l > 0)) return null;
  const r = t - h - l;
  if (!Number.isFinite(r) || r < -1e-6) return null;
  return mmol ? { value: Math.round(Math.max(0, r) * 100) / 100, unit: "mmol/L" } : { value: Math.round(Math.max(0, r)), unit: "mg/dL" };
}

/** Where the line is drawn, in the unit the remnant was computed in. */
export const remnantCut = (unit: "mg/dL" | "mmol/L") => (unit === "mmol/L" ? RC.elevatedFromMmol : RC.elevatedFrom);

/**
 * True when the panel's own arithmetic says the lab used Friedewald: total
 * minus HDL minus LDL comes to triglycerides / 5 (mg/dL) or / 2.2 (mmol/L),
 * within the rounding of a printed LDL. Read only when no method came with
 * the LDL. Never at or above 400 mg/dL of triglycerides, where Friedewald is
 * not valid and a lab does not use it.
 */
export function ldlMethodByArithmetic(p: LipidPanel): boolean {
  const { total, hdl, ldl, tg } = p;
  if (total == null || hdl == null || ldl == null || tg == null) return false;
  if (remnantCholesterol(p) == null) return false;
  const f = RC.friedewald;
  const tgMgdl = isMmol(p.tgUnit) ? tg * TG_MGDL_PER_MMOL : tg;
  if (!(tgMgdl > 0) || tgMgdl >= f.validBelowTgMgdl) return false;
  if (panelInMmol(p) && isMmol(p.tgUnit)) {
    return Math.abs(total - hdl - ldl - tg / f.tgDivisorMmol) <= f.matchWithinMmol + 1e-9;
  }
  const r = cholMgdl(total, p.totalUnit) - cholMgdl(hdl, p.hdlUnit) - cholMgdl(ldl, p.ldlUnit);
  return Math.abs(r - tgMgdl / f.tgDivisor) <= f.matchWithinMgdl + 1e-9;
}

/**
 * The LDL's method and how it is known. "stated": it came with the row.
 * "arithmetic": none came and the numbers match Friedewald. Null: none came
 * and nothing matches, which is NOT evidence of a direct measurement, since
 * Martin-Hopkins and Sampson are calculations that leave something else.
 */
export function readLdlMethod(p: LipidPanel): { method: LdlMethod | null; basis: "stated" | "arithmetic" | null } {
  if (p.method === "measured" || p.method === "calculated") return { method: p.method, basis: "stated" };
  if (ldlMethodByArithmetic(p)) return { method: "calculated", basis: "arithmetic" };
  return { method: null, basis: null };
}

/**
 * The tag beside an LDL row. "Not known", never "not printed": a row filed
 * before the parser read methods has none, and that says nothing about what
 * its report prints.
 */
export function ldlMethodTag(p: LipidPanel): string {
  const read = readLdlMethod(p);
  if (read.basis === "arithmetic") return "calculated, by the arithmetic";
  if (read.method === "measured") return "measured directly";
  if (read.method === "calculated") return "calculated";
  return "method not known";
}
/** The tag beside a remnant: which kind of LDL it was made from. */
export function remnantFromTag(p: LipidPanel): string {
  const read = readLdlMethod(p);
  return read.method === "measured" ? "from a direct LDL" : read.method === "calculated" ? "from a calculated LDL" : "LDL method not known";
}

const trim = (n: number) => String(Math.round(n * 100) / 100);

/**
 * What the remnant figure means, by the LDL's method, and where the line is.
 * The Friedewald division is printed only when the panel's own numbers bear
 * it out: a lab that prints "Calculated" and used Martin-Hopkins leaves a
 * remainder that is not triglycerides / 5.
 */
export function remnantMeaning(p: LipidPanel): string {
  const read = readLdlMethod(p);
  const mmol = panelInMmol(p) && isMmol(p.tgUnit);
  const f = RC.friedewald;
  const divisor = mmol ? f.tgDivisorMmol : f.tgDivisor;
  const tgShare = ldlMethodByArithmetic(p) && p.tg != null
    ? `${trim(mmol ? p.tg : isMmol(p.tgUnit) ? p.tg * TG_MGDL_PER_MMOL : p.tg)} ÷ ${divisor}`
    : null;
  const line = panelInMmol(p)
    ? `The line at ${RC.elevatedFromMmol} mmol/L (${RC.elevatedFrom} mg/dL) is the PREDIMED cut; Copenhagen draws it at 1 mmol/L.`
    : `The line at ${RC.elevatedFrom} mg/dL is the PREDIMED cut; Copenhagen draws it at 1 mmol/L, 39 mg/dL.`;
  const body =
    read.method === "measured"
      ? "The LDL on this report was measured directly, so the remnant is a measurement: the cholesterol in triglyceride-rich particles, the part an LDL figure does not count."
    : read.basis === "arithmetic"
      ? `No method came with this LDL, but total minus HDL minus LDL comes to triglycerides ÷ ${divisor} (${tgShare}), which is what the Friedewald equation leaves behind. So it reads as calculated: the share of triglycerides the equation set aside for VLDL. It rises and falls with triglycerides.`
    : read.method === "calculated"
      ? (tgShare
        ? `The LDL on this report is calculated, so the remnant is the share of triglycerides the equation set aside for VLDL: ${tgShare} under Friedewald. It rises and falls with triglycerides. A directly measured LDL makes it a measurement.`
        : "The LDL on this report is calculated, so the remnant is the share of triglycerides the lab's equation set aside for VLDL. It rises and falls with triglycerides. A directly measured LDL makes it a measurement.")
      : "No method came with this LDL, so this is the arithmetic and no more: whether it is a measurement or a share of triglycerides turns on how the lab got the LDL. Reading the report again picks the method up where the report prints one.";
  return `${body} ${line}`;
}

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
    if (!["Triglycerides", "HDL Cholesterol", "Apolipoprotein B", "Apolipoprotein A1", "Total Cholesterol", "LDL Cholesterol"].includes(name)) continue;
    const v = Number(r.value);
    if (!Number.isFinite(v)) continue;
    const d = String(r.measured_on).slice(0, 10);
    const slot = byDay.get(d) ?? byDay.set(d, {}).get(d)!;
    if (!slot[name]) slot[name] = r;   // the first printed value on that date stands
  }
  // Remnant cholesterol first, then the two ratios: it reads beside the four
  // numbers it is made of, as the Labs tab lists a section in row order.
  const out: LabRow[] = [];
  const remnants: LabRow[] = [];
  const unbanded = tgHdlUnbanded(profile?.ethnicity);
  const cut = apoRatioCut(profile?.sex);
  for (const [d, slot] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const tg = slot["Triglycerides"], hdl = slot["HDL Cholesterol"];
    if (tg && hdl) {
      const v = tgHdlRatio(Number(tg.value), tg.unit, Number(hdl.value), hdl.unit);
      if (v != null) out.push({
        analyte: TG_HDL_LABEL, value: v, unit: "", section: "lipids", measured_on: d, computed: true, tags: ["computed"],
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
        analyte: APO_RATIO_LABEL, value: v, unit: "", section: "lipids", measured_on: d, computed: true, tags: ["computed"],
        report_path: b.report_path ?? a1.report_path ?? null,
        ref_low: null, ref_high: cut - 0.005, ref_text: `< ${cut.toFixed(2)}`,
      });
    }
    const total = slot["Total Cholesterol"], ldl = slot["LDL Cholesterol"];
    if (total && hdl && ldl) {
      const panel = panelOf(slot);
      const rc = remnantCholesterol(panel);
      if (rc) {
        const cutAt = remnantCut(rc.unit);
        const paths = [total.report_path, hdl.report_path, ldl.report_path];
        const oneReport = paths[0] != null && paths.every((x) => x === paths[0]);
        remnants.push({
          analyte: REMNANT_LABEL, value: rc.value, unit: rc.unit, section: "lipids", measured_on: d, computed: true,
          report_path: ldl.report_path ?? total.report_path ?? hdl.report_path ?? null,
          // "< 30": a whole-number 30 is outside, a 29 inside; in mmol/L the same at 0.78.
          ref_low: null, ref_high: rc.unit === "mmol/L" ? cutAt - 0.005 : cutAt - 0.5, ref_text: `< ${cutAt}`,
          tags: ["computed", remnantFromTag(panel)],
          explain: {
            formula: `${trim(Number(total.value))} total − ${trim(Number(hdl.value))} HDL − ${trim(Number(ldl.value))} LDL, ${oneReport ? `all from the ${fmtDay(d)} report` : `all dated ${fmtDay(d)}`}`,
            body: remnantMeaning(panel),
            link: { label: "Remnant cholesterol, with its evidence", href: REMNANT_SCIENCE_HREF },
          },
        });
      }
    }
  }
  return [...remnants, ...out];
}

/** One report date's slot of lipid rows, as the panel the remnant and the method read. */
function panelOf(slot: Record<string, LabRow>): LipidPanel {
  const n = (r?: LabRow) => (r ? Number(r.value) : null);
  const total = slot["Total Cholesterol"], hdl = slot["HDL Cholesterol"], ldl = slot["LDL Cholesterol"], tg = slot["Triglycerides"];
  return {
    total: n(total), totalUnit: total?.unit, hdl: n(hdl), hdlUnit: hdl?.unit, ldl: n(ldl), ldlUnit: ldl?.unit, tg: n(tg), tgUnit: tg?.unit,
    method: ldl?.method === "measured" || ldl?.method === "calculated" ? ldl.method : null,
  };
}

/**
 * The LDL rows with their method tag, as copies: the tag needs the rest of
 * that date's panel (the arithmetic), which a row alone does not carry. An
 * LDL with nothing else printed beside it is tagged from its own `method`.
 */
function tagLdlRows(labs: LabRow[]): LabRow[] {
  const isLdl = (r: LabRow) => !r.computed && canonName(String(r.analyte)) === "LDL Cholesterol";
  if (!labs.some(isLdl)) return labs;
  const byDay = new Map<string, Record<string, LabRow>>();
  for (const r of labs) {
    if (r.computed || !Number.isFinite(Number(r.value))) continue;
    const name = canonName(String(r.analyte));
    if (!["Triglycerides", "HDL Cholesterol", "Total Cholesterol", "LDL Cholesterol"].includes(name)) continue;
    const d = String(r.measured_on).slice(0, 10);
    const slot = byDay.get(d) ?? byDay.set(d, {}).get(d)!;
    if (!slot[name]) slot[name] = r;
  }
  return labs.map((r) => {
    if (!isLdl(r)) return r;
    const slot = byDay.get(String(r.measured_on).slice(0, 10)) ?? {};
    // This row's own value and method, against the rest of its date's panel.
    return { ...r, tags: [ldlMethodTag(panelOf({ ...slot, "LDL Cholesterol": r }))] };
  });
}

/** The person's lab rows, each LDL tagged with its method, with the two computed ratios and remnant cholesterol appended. */
export function withLipidRatios(labs: LabRow[], profile?: { sex?: string | null; ethnicity?: string | null } | null): LabRow[] {
  // Idempotent: a list that already carries computed rows is rebuilt from its measured rows.
  const base = labs.some((r) => r.computed) ? labs.filter((r) => !r.computed) : labs;
  const extra = lipidRatioRows(base, profile);
  const tagged = tagLdlRows(base);
  return extra.length ? [...tagged, ...extra] : tagged;
}
