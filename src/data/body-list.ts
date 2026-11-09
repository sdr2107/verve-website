/**
 * The app's Body list, row for row and in its order, with the app's own bands
 * (canvas "My health, redesigned", board 6; 8 November 2026).
 *
 * Ported from METTracker/lib/markers.ts (the registry: MARKERS, in the order
 * METABOLIC, HEART, MUSCLE, with the two companions that have a row of their
 * own, total and remnant cholesterol) and METTracker/lib/body.ts (the
 * classifiers the bands call). The numbers that live in the app's thresholds
 * file come through ./body-thresholds.ts, a verbatim copy; the few that live
 * in the app's code (the EWGSOP2 grip and ALMI cut-offs, the ESPEN FFMI line,
 * the body-fat ladder, the balance and chair-stand age norms, the gait bands,
 * the IDF waist cut-offs, the Alberti 2009 glucose, triglyceride and HDL
 * lines) are copied here under CODE_CUTS with the function they came from
 * named beside each. Blood pressure is left out: it lives in Vitals now.
 *
 * A band's `match` is the app's predicate, kept as written; `min`/`max` are
 * for drawing the track only. Best band first; the app colours by index.
 */
import TH from "./body-thresholds.ts";

const CV = TH.cardiovascularMarkers;
const MSM = TH.metabolicSupplementaryMarkers;
const RC = TH.remnantCholesterol;

/** Cut-offs that live in the app's code, not its thresholds file. Each names its source function. */
export const CODE_CUTS = {
  /** lib/markers.ts glucose bands: Alberti et al. 2009 */
  glucoseElevatedFrom: 100,
  /** lib/markers.ts tg bands: Alberti 2009 */
  tgElevatedFrom: 150,
  /** lib/markers.ts hdl bands: Alberti 2009, by sex */
  hdlLowBelow: { male: 40, female: 50 },
  /** lib/body.ts waistElevatedThresholdCm: IDF 2006, men by ancestry, women 80 */
  waistCm: { male: 94, maleAsian: 90, female: 80 },
  /** lib/body.ts gripSarcopeniaThreshold: EWGSOP2 27/16, AWGS 28/18 */
  gripKg: { male: 27, maleAsian: 28, female: 16, femaleAsian: 18 },
  /** lib/body.ts almiSarcopeniaThreshold: EWGSOP2 7.0/5.5, AWGS 5.4 by DXA for women */
  almi: { male: 7.0, female: 5.5, femaleAsian: 5.4 },
  /** lib/body.ts ffmiSarcopeniaThreshold: ESPEN 2015 / GLIM 2019 */
  ffmi: { male: 17, female: 15 },
  /** lib/body.ts classifyBodyFat: low 8/14; elevated by age; borderline = elevated − 4 */
  bodyFatLow: { male: 8, female: 14 },
  bodyFatElevated: { male: [[80, 33], [60, 31], [40, 29], [0, 25]], female: [[80, 45], [60, 43], [40, 41], [0, 35]] } as Record<"male" | "female", [number, number][]>,
  /** lib/body.ts BALANCE_NORMS (seconds by age) and the 10 s floor (Araujo 2022) */
  balanceNorms: [[39, 43], [49, 40], [59, 37], [69, 27], [79, 15], [999, 6]] as [number, number][],
  balanceFloor: 10,
  /** lib/body.ts CHAIRSTAND_NORMS (seconds by age) and the 15 s EWGSOP2 line */
  chairNorms: [[59, 10.0], [69, 11.4], [79, 12.6], [999, 14.8]] as [number, number][],
  chairCeiling: 15,
  /** lib/body.ts classifyGaitSpeed: EWGSOP2 0.8, Studenski 1.0 and 1.2 */
  gait: { impairedBelow: 0.8, belowBelow: 1.0, averageBelow: 1.2 },
  /** lib/markers.ts sppb bands */
  sppb: { goodFrom: 10, intermediateFrom: 7 },
} as const;

export type BodySection = "metabolic" | "heart" | "muscle";
export type Sex = "male" | "female";
export interface BodyCtx { sex: Sex; age: number | null; heightCm: number | null; weightKg: number | null; ethnicity?: string | null }
export interface Band { label: string; range: string; min: number | null; max: number | null; match: (v: number) => boolean; unjudged?: boolean }

const isAsian = (e: string | null | undefined) => e === "asian" || e === "south_asian" || e === "chinese";

export interface BodyDef {
  /** The website's chart key (derive/markers.ts), or a computed key. */
  key: string;
  /** The app's registry key, for the record. */
  appKey: string;
  section: BodySection;
  label: string;
  /** The app's unit for the primary value. */
  unit: string;
  /** The app's bands for this person, best first; [] means shown and not judged. */
  bands: (ctx: BodyCtx) => Band[];
  /** The line under the name of a value the app does not judge alone. */
  subline?: string;
  /** Read once in a lifetime: the band shows, the row is never "to watch". */
  once?: boolean;
  /** Judge another figure than the one shown (ALM is judged as ALMI, which needs height). */
  judge?: (v: number, ctx: BodyCtx) => number | null;
  /** The unit of the judged figure when it differs from the shown one. */
  judgeUnit?: string;
  /** A value worked out, never typed: SPPB, remnant cholesterol, whole-body lean mass. */
  computed?: boolean;
  /** What is missing when a computed value cannot be made. */
  needs?: string;
}

const two = (goodLabel: string, badLabel: string, cut: number, unit: string, goodBelow: boolean): Band[] => goodBelow
  ? [{ label: goodLabel, range: `< ${cut}${unit}`, min: null, max: cut, match: (v) => v < cut }, { label: badLabel, range: `≥ ${cut}${unit}`, min: cut, max: null, match: (v) => v >= cut }]
  : [{ label: goodLabel, range: `≥ ${cut}${unit}`, min: cut, max: null, match: (v) => v >= cut }, { label: badLabel, range: `< ${cut}${unit}`, min: null, max: cut, match: (v) => v < cut }];

const bodyFatElevated = (sex: Sex, age: number | null) => { const a = age ?? 40; return CODE_CUTS.bodyFatElevated[sex].find(([from]) => a >= from)![1]; };
const normFor = (rows: readonly [number, number][], age: number | null, fallback: number) => (rows.find(([maxAge]) => (age ?? fallback) <= maxAge) ?? rows[rows.length - 1])[1];

/** The app's list: METABOLIC, HEART, MUSCLE, in the registry's order; blood pressure left to Vitals. */
export const BODY_DEFS: BodyDef[] = [
  // ── metabolic ──
  { key: "glucose_mgdl", appKey: "glucose", section: "metabolic", label: "Fasting blood sugar", unit: "mg/dL",
    bands: () => two("In range", "Elevated", CODE_CUTS.glucoseElevatedFrom, " mg/dL", true) },
  { key: "hba1c_pct", appKey: "hba1c", section: "metabolic", label: "HbA1c", unit: "%",
    bands: () => [
      { label: "In range", range: `< ${MSM.hba1c.prediabetesMin}%`, min: null, max: MSM.hba1c.prediabetesMin, match: (v) => v < MSM.hba1c.prediabetesMin },
      { label: "Prediabetes", range: `${MSM.hba1c.prediabetesMin}–${(MSM.hba1c.diabetesMin - 0.1).toFixed(1)}%`, min: MSM.hba1c.prediabetesMin, max: MSM.hba1c.diabetesMin, match: (v) => v >= MSM.hba1c.prediabetesMin && v < MSM.hba1c.diabetesMin },
      { label: "Diabetes", range: `≥ ${MSM.hba1c.diabetesMin}%`, min: MSM.hba1c.diabetesMin, max: null, match: (v) => v >= MSM.hba1c.diabetesMin },
    ] },
  { key: "triglycerides_mgdl", appKey: "tg", section: "metabolic", label: "Triglycerides", unit: "mg/dL",
    bands: () => two("In range", "Elevated", CODE_CUTS.tgElevatedFrom, "", true) },
  { key: "hdl_mgdl", appKey: "hdl", section: "metabolic", label: "HDL cholesterol", unit: "mg/dL",
    bands: (ctx) => two("In range", "Low", CODE_CUTS.hdlLowBelow[ctx.sex], "", false) },
  { key: "waist_cm", appKey: "waist", section: "metabolic", label: "Waist", unit: "cm",
    bands: (ctx) => { const cm = ctx.sex === "male" ? (isAsian(ctx.ethnicity) ? CODE_CUTS.waistCm.maleAsian : CODE_CUTS.waistCm.male) : CODE_CUTS.waistCm.female; return two("In range", "Elevated", cm, " cm", true); } },
  { key: "post_meal_glucose_mgdl", appKey: "postMealGlucose", section: "metabolic", label: "Post-meal glucose", unit: "mg/dL",
    bands: () => [
      { label: "In range", range: `< ${MSM.postMealGlucose.inRangeMax + 1}`, min: null, max: MSM.postMealGlucose.inRangeMax, match: (v) => v <= MSM.postMealGlucose.inRangeMax },
      { label: "Elevated", range: `≥ ${MSM.postMealGlucose.inRangeMax + 1}`, min: MSM.postMealGlucose.inRangeMax, max: null, match: (v) => v > MSM.postMealGlucose.inRangeMax },
    ] },
  { key: "fasting_insulin_uiuml", appKey: "homaIr", section: "metabolic", label: "Fasting insulin", unit: "uIU/mL", bands: () => [], subline: "not judged alone; HOMA-IR, from it and the fasting glucose, is" },
  // ── heart ──
  { key: "apo_b_mgdl", appKey: "apoB", section: "heart", label: "ApoB", unit: CV.apoB.unit,
    bands: () => [
      { label: "Optimal", range: `≤ ${CV.apoB.optimalMax}`, min: null, max: CV.apoB.optimalMax, match: (v) => v <= CV.apoB.optimalMax },
      { label: "Borderline", range: `${CV.apoB.optimalMax + 1}–${CV.apoB.borderlineMax}`, min: CV.apoB.optimalMax, max: CV.apoB.borderlineMax, match: (v) => v > CV.apoB.optimalMax && v <= CV.apoB.borderlineMax },
      { label: "Elevated", range: `> ${CV.apoB.borderlineMax}`, min: CV.apoB.borderlineMax, max: null, match: (v) => v > CV.apoB.borderlineMax },
    ] },
  { key: "ldl_mgdl", appKey: "ldl", section: "heart", label: "LDL cholesterol", unit: CV.ldlC.unit,
    bands: () => [
      { label: "Optimal", range: `≤ ${CV.ldlC.optimalMax}`, min: null, max: CV.ldlC.optimalMax, match: (v) => v <= CV.ldlC.optimalMax },
      { label: "Borderline", range: `${CV.ldlC.optimalMax + 1}–${CV.ldlC.borderlineMax}`, min: CV.ldlC.optimalMax, max: CV.ldlC.borderlineMax, match: (v) => v > CV.ldlC.optimalMax && v <= CV.ldlC.borderlineMax },
      { label: "Elevated", range: `> ${CV.ldlC.borderlineMax}`, min: CV.ldlC.borderlineMax, max: null, match: (v) => v > CV.ldlC.borderlineMax },
    ] },
  { key: "total_cholesterol_mgdl", appKey: "ldl/Total cholesterol", section: "heart", label: "Total cholesterol", unit: CV.ldlC.unit, bands: () => [], subline: "not judged alone; one half of remnant cholesterol" },
  { key: "remnant", appKey: "ldl/Remnant cholesterol", section: "heart", label: "Remnant cholesterol", unit: RC.unit, computed: true,
    needs: "Total, HDL and LDL from one report make this appear.",
    bands: () => two("In range", "Elevated", RC.elevatedFrom, ` ${RC.unit}`, true) },
  { key: "lpa_value", appKey: "lpa", section: "heart", label: "Lp(a)", unit: "nmol/L", once: true,
    bands: () => lpaBands("nmol/L") },
  { key: "hs_crp_mgl", appKey: "hsCrp", section: "heart", label: "hs-CRP", unit: CV.hsCRP.unit,
    bands: () => [
      { label: "Low", range: `< ${(CV.hsCRP.lowMax + 0.1).toFixed(1)}`, min: null, max: CV.hsCRP.lowMax, match: (v) => v < CV.hsCRP.acuteInflammationMin && v <= CV.hsCRP.lowMax },
      { label: "Average", range: `${(CV.hsCRP.lowMax + 0.1).toFixed(1)}–${CV.hsCRP.averageMax.toFixed(1)}`, min: CV.hsCRP.lowMax, max: CV.hsCRP.averageMax, match: (v) => v < CV.hsCRP.acuteInflammationMin && v > CV.hsCRP.lowMax && v <= CV.hsCRP.averageMax },
      { label: "High", range: `> ${CV.hsCRP.averageMax.toFixed(1)}`, min: CV.hsCRP.averageMax, max: CV.hsCRP.acuteInflammationMin, match: (v) => v < CV.hsCRP.acuteInflammationMin && v > CV.hsCRP.averageMax },
      { label: "Not a heart reading", range: `≥ ${CV.hsCRP.acuteInflammationMin}`, min: CV.hsCRP.acuteInflammationMin, max: null, match: (v) => v >= CV.hsCRP.acuteInflammationMin, unjudged: true },
    ] },
  // ── muscle ──
  { key: "alm_kg", appKey: "alm", section: "muscle", label: "Lean Mass (arms + legs)", unit: "kg", judgeUnit: "kg/m²",
    judge: (v, ctx) => ctx.heightCm ? v / Math.pow(ctx.heightCm / 100, 2) : null,
    bands: (ctx) => { const t = ctx.sex === "male" ? CODE_CUTS.almi.male : isAsian(ctx.ethnicity) ? CODE_CUTS.almi.femaleAsian : CODE_CUTS.almi.female; return ctx.heightCm ? two("In range", "Low", t, " kg/m²", false) : [{ label: "Add your height", range: `ALMI needs height · low is < ${t} kg/m²`, min: null, max: null, match: () => false }]; } },
  { key: "handgrip_kg", appKey: "handgrip", section: "muscle", label: "Grip strength", unit: "kg",
    bands: (ctx) => { const a = isAsian(ctx.ethnicity); const t = ctx.sex === "male" ? (a ? CODE_CUTS.gripKg.maleAsian : CODE_CUTS.gripKg.male) : (a ? CODE_CUTS.gripKg.femaleAsian : CODE_CUTS.gripKg.female); return two("In range", "Low", t, " kg", false); } },
  { key: "body_fat_pct", appKey: "bodyFat", section: "muscle", label: "Body fat", unit: "%",
    bands: (ctx) => { const lo = CODE_CUTS.bodyFatLow[ctx.sex], el = bodyFatElevated(ctx.sex, ctx.age), bl = el - 4; return [
      { label: "In range", range: `${lo}–${(bl - 0.1).toFixed(1)}%`, min: lo, max: bl, match: (v) => v >= lo && v < bl },
      { label: "Borderline", range: `${bl}–${(el - 0.1).toFixed(1)}%`, min: bl, max: el, match: (v) => v >= bl && v < el },
      { label: "Low", range: `< ${lo}%`, min: null, max: lo, match: (v) => v < lo },
      { label: "Elevated", range: `≥ ${el}%`, min: el, max: null, match: (v) => v >= el },
    ]; } },
  { key: "ffm_kg", appKey: "leanBodyMass", section: "muscle", label: "Whole-body lean mass", unit: "kg", computed: true, bands: () => [], subline: "from body fat and weight; shown, not judged" },
  { key: "skel_musc_pct", appKey: "skelMusc", section: "muscle", label: "Muscle mass", unit: "%", bands: () => [], subline: "a trend to watch; no guideline cut-off" },
  { key: "single_leg_balance_seconds", appKey: "balance", section: "muscle", label: "Single-leg balance", unit: "s",
    bands: (ctx) => { const norm = normFor(CODE_CUTS.balanceNorms, ctx.age, 50); return [
      { label: "Good", range: "At or above the age norm", min: null, max: null, match: (v) => v >= CODE_CUTS.balanceFloor && v >= norm },
      { label: "Fair", range: "Below the age norm", min: null, max: null, match: (v) => v >= CODE_CUTS.balanceFloor && v < norm },
      { label: "Impaired", range: "Under 10 s", min: null, max: null, match: (v) => v < CODE_CUTS.balanceFloor },
    ]; } },
  { key: "chair_stand_seconds", appKey: "chairStand", section: "muscle", label: "Chair stand", unit: "s",
    bands: (ctx) => { const norm = normFor(CODE_CUTS.chairNorms, ctx.age, 50); return [
      { label: "Good", range: "At or under the age norm", min: null, max: null, match: (v) => v <= CODE_CUTS.chairCeiling && v <= norm },
      { label: "Fair", range: "Over the age norm", min: null, max: null, match: (v) => v <= CODE_CUTS.chairCeiling && v > norm },
      { label: "Impaired", range: "Over 15 s", min: null, max: null, match: (v) => v > CODE_CUTS.chairCeiling },
    ]; } },
  { key: "sppb_score", appKey: "sppb", section: "muscle", label: "SPPB", unit: "/12", computed: true, needs: "The three tests on one day score it.",
    bands: () => [
      { label: "Good", range: "10–12", min: CODE_CUTS.sppb.goodFrom, max: null, match: (v) => v >= CODE_CUTS.sppb.goodFrom },
      { label: "Intermediate", range: "7–9", min: CODE_CUTS.sppb.intermediateFrom, max: CODE_CUTS.sppb.goodFrom, match: (v) => v >= CODE_CUTS.sppb.intermediateFrom && v < CODE_CUTS.sppb.goodFrom },
      { label: "Poor", range: "≤ 6", min: null, max: CODE_CUTS.sppb.intermediateFrom, match: (v) => v < CODE_CUTS.sppb.intermediateFrom },
    ] },
  { key: "gait_speed_ms", appKey: "gaitSpeed", section: "muscle", label: "Walk speed", unit: "m/s",
    bands: () => { const g = CODE_CUTS.gait; return [
      { label: "Good", range: `≥ ${g.averageBelow} m/s`, min: g.averageBelow, max: null, match: (v) => v >= g.averageBelow },
      { label: "Average", range: `${g.belowBelow}-${g.averageBelow} m/s`, min: g.belowBelow, max: g.averageBelow, match: (v) => v >= g.belowBelow && v < g.averageBelow },
      { label: "Below", range: `${g.impairedBelow}-${g.belowBelow} m/s`, min: g.impairedBelow, max: g.belowBelow, match: (v) => v >= g.impairedBelow && v < g.belowBelow },
      { label: "Impaired", range: `< ${g.impairedBelow} m/s`, min: null, max: g.impairedBelow, match: (v) => v < g.impairedBelow },
    ]; } },
];

/** Lp(a)'s bands in the unit the reading was entered in; the two are not interchangeable. */
export function lpaBands(unit: "nmol/L" | "mg/dL"): Band[] {
  const cut = unit === "mg/dL" ? CV.lpa.mgdl : CV.lpa.nmolL;
  return [
    { label: "Low", range: `≤ ${cut.lowMax} ${unit}`, min: null, max: cut.lowMax, match: (v) => v <= cut.lowMax },
    { label: "Intermediate", range: `${cut.lowMax + 1}–${cut.intermediateMax} ${unit}`, min: cut.lowMax, max: cut.intermediateMax, match: (v) => v > cut.lowMax && v <= cut.intermediateMax },
    { label: "High", range: `> ${cut.intermediateMax} ${unit}`, min: cut.intermediateMax, max: null, match: (v) => v > cut.intermediateMax },
  ];
}
/** Remnant cholesterol's one line, in the unit the report was read in. */
export function remnantBands(unit: "mg/dL" | "mmol/L"): Band[] {
  const cut = unit === "mmol/L" ? RC.elevatedFromMmol : RC.elevatedFrom;
  return two("In range", "Elevated", cut, ` ${unit}`, true);
}

export const BODY_SECTIONS: { key: BodySection; title: string }[] = [
  { key: "metabolic", title: "Metabolic" },
  { key: "heart", title: "Heart" },
  { key: "muscle", title: "Muscle" },
];
