/**
 * canonName — one analyte, one name, whatever the lab printed.
 *
 * Different labs print the same analyte differently ("SGPT (ALT)",
 * "Alanine Aminotransferase", "ALT (SGPT)") and a trend line is only a
 * trend if all of them land on it. The model is ASKED to canonicalise in
 * the parser prompt, but this module is the ENFORCEMENT: it runs on every
 * name at insert time, at render-grouping time, and once over the rows
 * that predate it — so the guarantee never rests on a model's mood.
 *
 * Three passes, first hit wins:
 *   1. strip ", Serum" / ", Plasma"  (specimen noise — ", Urine" is KEPT:
 *      urine creatinine is a different analyte from serum creatinine, and
 *      sections keep them apart besides)
 *   2. whole-name alias lookup (the curated map below)
 *   3. "ABBR (Long Explanation)" → ABBR when the head reads as an
 *      abbreviation (MCH, TSH, ESR…), then alias the abbreviation too
 *
 * Plain JS (not TS) so the SQL-cleanup script can run it under node
 * directly — one implementation, three call sites.
 */

/** @type {Record<string, string>} lowercase spelling → canonical name */
const ALIASES = {
  // liver
  "sgpt": "ALT", "sgpt (alt)": "ALT", "alt (sgpt)": "ALT", "alt": "ALT",
  "alanine aminotransferase": "ALT",
  "sgot": "AST", "sgot (ast)": "AST", "ast (sgot)": "AST", "ast": "AST",
  "aspartate aminotransferase": "AST",
  "gamma gt (ggtp)": "GGT", "ggt": "GGT", "ggtp": "GGT", "gamma-gt": "GGT",
  "gamma glutamyl transferase": "GGT", "gamma glutamyl transpeptidase": "GGT",
  "alkaline phosphatase (alp)": "Alkaline Phosphatase", "alp": "Alkaline Phosphatase",
  "total bilirubin": "Bilirubin Total", "direct bilirubin": "Bilirubin Direct",
  "indirect bilirubin": "Bilirubin Indirect",
  "sr. albumin": "Albumin", "serum albumin": "Albumin",
  // glucose & insulin
  "glucose fasting": "Fasting Glucose", "fasting glucose": "Fasting Glucose",
  "fasting blood sugar": "Fasting Glucose", "fbs": "Fasting Glucose",
  "fasting plasma glucose": "Fasting Glucose", "glucose (f)": "Fasting Glucose",
  "glucose post prandial": "Post-Prandial Glucose", "glucose (pp)": "Post-Prandial Glucose",
  "post prandial blood sugar": "Post-Prandial Glucose", "ppbs": "Post-Prandial Glucose",
  "glucose random": "Random Glucose", "random blood sugar": "Random Glucose",
  "hba1c": "HbA1c", "hba1c - glycated haemoglobin": "HbA1c",
  "glycated hemoglobin": "HbA1c", "glycated haemoglobin": "HbA1c",
  "glycosylated hemoglobin": "HbA1c", "glycosylated haemoglobin": "HbA1c",
  "estimated average glucose (eag)": "Estimated Average Glucose",
  "insulin - fasting": "Fasting Insulin", "fasting insulin": "Fasting Insulin",
  "insulin fasting": "Fasting Insulin",
  // lipids
  "cholesterol total": "Total Cholesterol", "total cholesterol": "Total Cholesterol",
  "cholesterol": "Total Cholesterol",
  "hdl cholesterol direct": "HDL Cholesterol", "hdl": "HDL Cholesterol",
  "hdl-c": "HDL Cholesterol", "hdl cholesterol": "HDL Cholesterol",
  "ldl": "LDL Cholesterol", "ldl-c": "LDL Cholesterol", "ldl cholesterol": "LDL Cholesterol",
  "ldl cholesterol calculated": "LDL Cholesterol", "ldl cholesterol - direct": "LDL Cholesterol",
  "vldl": "VLDL Cholesterol", "vldl cholesterol": "VLDL Cholesterol",
  "triglyceride": "Triglycerides", "triglycerides": "Triglycerides", "tg": "Triglycerides",
  "non hdl cholesterol": "Non-HDL Cholesterol", "non-hdl cholesterol": "Non-HDL Cholesterol",
  "lipoprotein(a)": "Lipoprotein(a)", "lipoprotein (a)": "Lipoprotein(a)", "lp(a)": "Lipoprotein(a)",
  "apolipoprotein b": "Apolipoprotein B", "apo b": "Apolipoprotein B", "apo-b": "Apolipoprotein B",
  "apolipoprotein a1": "Apolipoprotein A1", "apo a1": "Apolipoprotein A1",
  // inflammation
  "hscrp": "hs-CRP", "hs-crp": "hs-CRP", "hs crp": "hs-CRP", "cardio crp": "hs-CRP",
  "hscrp (high sensitivity crp)": "hs-CRP", "high sensitivity c-reactive protein": "hs-CRP",
  "crp": "CRP", "c-reactive protein": "CRP", "c reactive protein": "CRP",
  "erythrocyte sedimentation rate": "ESR",
  // kidney
  "bun": "BUN", "blood urea nitrogen": "BUN",
  "s. creatinine": "Creatinine", "serum creatinine": "Creatinine",
  "egfr": "eGFR", "egfr by sr. creatinine": "eGFR", "e-gfr": "eGFR",
  "estimated glomerular filtration rate": "eGFR",
  // haematology
  "haemoglobin (hb)": "Hemoglobin", "hemoglobin (hb)": "Hemoglobin",
  "hemoglobin": "Hemoglobin", "haemoglobin": "Hemoglobin", "hb": "Hemoglobin",
  "pcv": "Hematocrit", "pcv (packed cell volume)": "Hematocrit",
  "packed cell volume": "Hematocrit", "hematocrit": "Hematocrit",
  "haematocrit": "Hematocrit", "hct": "Hematocrit",
  "total leucocytes (wbc) count": "WBC Count", "total leucocyte count": "WBC Count",
  "total leukocyte count": "WBC Count", "tlc": "WBC Count", "wbc": "WBC Count",
  "wbc count": "WBC Count", "white blood cell count": "WBC Count",
  "erythrocyte (rbc) count": "RBC Count", "rbc": "RBC Count", "rbc count": "RBC Count",
  "total rbc count": "RBC Count", "red blood cell count": "RBC Count",
  // thyroid
  "tsh": "TSH", "t.s.h.": "TSH", "thyroid stimulating hormone": "TSH", "ultra tsh": "TSH",
  "ft3": "Free T3", "free t3": "Free T3", "free triiodothyronine": "Free T3",
  "ft4": "Free T4", "free t4": "Free T4", "free thyroxine": "Free T4",
  "total t3": "Total T3", "triiodothyronine (t3)": "Total T3", "t3": "Total T3",
  "total t4": "Total T4", "thyroxine (t4)": "Total T4", "t4": "Total T4",
  // vitamins & iron
  "vitamin d total - 25 hydroxy (oh)": "Vitamin D (25-OH)",
  "vitamin d (25-oh)": "Vitamin D (25-OH)", "25-oh vitamin d": "Vitamin D (25-OH)",
  "25 hydroxy vitamin d": "Vitamin D (25-OH)", "vitamin d3": "Vitamin D (25-OH)",
  "vit d3": "Vitamin D (25-OH)", "25(oh)d": "Vitamin D (25-OH)",
  "vitamin b12 (cyanocobalamin)": "Vitamin B12", "vitamin b12": "Vitamin B12",
  "vitamin b-12": "Vitamin B12", "vit b12": "Vitamin B12", "cyanocobalamin": "Vitamin B12",
  "folate": "Folic Acid", "folic acid": "Folic Acid",
  "tibc": "TIBC", "total iron binding capacity": "TIBC",
  "uibc": "UIBC", "iron": "Iron", "serum iron": "Iron",
  // misc named forms
  "total psa (prostate specific antigen)": "Total PSA", "psa": "Total PSA",
  "prostate specific antigen": "Total PSA",
  "ra (rheumatoid arthritis) factor": "RA Factor", "rheumatoid factor": "RA Factor",
  "cpk": "CPK Total", "cpk total": "CPK Total", "creatine phosphokinase": "CPK Total",
};

/** Heads like "MCH", "TSH", "HsCRP" — at least two capitals/digits. */
const ABBR_HEAD = /^([A-Za-z][A-Za-z0-9.\-]{1,7})\s+\((.{3,})\)$/;
const LOOKS_ABBR = /[A-Z].*[A-Z0-9]/;

/** @param {string} raw @returns {string} */
export function canonName(raw) {
  let n = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!n) return n;
  n = n.replace(/,\s*(serum|plasma)$/i, "");
  const direct = ALIASES[n.toLowerCase()];
  if (direct) return direct;
  const m = n.match(ABBR_HEAD);
  if (m && LOOKS_ABBR.test(m[1])) return ALIASES[m[1].toLowerCase()] ?? m[1];
  return n;
}

/** Normalised unit key — "mg/dL" and "MG/DL " are the same unit. */
/** @param {string|null|undefined} u @returns {string} */
export function unitKey(u) {
  return String(u ?? "").trim().toLowerCase().replace(/\s+/g, "");
}
