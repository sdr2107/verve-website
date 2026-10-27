/**
 * A copy of the app's data/met-thresholds.json#lipidRatios (METTracker), as a
 * module so Node's test runner and the Astro build read it alike. If the
 * app's file changes, regenerate this one from it (the same discipline
 * step-thresholds.ts keeps). Do not edit by hand.
 */
export default {
  "_note": "Two ratios computed from stored lipid values; neither is stored. TG/HDL is an insulin-resistance screen (metabolic); ApoB/ApoA1 is an atherogenic-balance marker (heart). Screening bands, not treatment targets. Thresholds in mg/dL over mg/dL; a mmol/L report converts each half first (TG x 88.57, HDL x 38.67; the ratio is 2.29x the mmol ratio).",
  "tgHdl": {
    "unit": "mg/dL / mg/dL",
    "inRangeBelow": 3.0,
    "elevatedFrom": 3.5,
    "mgdlRatioPerMmolRatio": 2.29,
    "notForEthnicity": [
      "african_american"
    ],
    "source": "McLaughlin T, Abbasi F, Cheal K, Chu J, Lamendola C, Reaven G. Use of metabolic markers to identify overweight individuals who are insulin resistant. Ann Intern Med 2003;139:802-9 (optimal cut-point 3.0 in mg/dL units, n=258 overweight adults). McLaughlin T, Reaven G, Abbasi F, et al. Is there a simple way to identify insulin-resistant individuals at increased risk of cardiovascular disease? Am J Cardiol 2005;96:399-404 (>=3.5 best identified insulin resistance and small dense LDL, n=449).",
    "pubmed": "https://pubmed.ncbi.nlm.nih.gov/14623617/",
    "pubmed2": "https://pubmed.ncbi.nlm.nih.gov/16054467/",
    "caveatSource": "Sumner AE, Finley KB, Genovese DJ, Criqui MH, Boston RC. Fasting triglyceride and the triglyceride-HDL cholesterol ratio are not markers of insulin resistance in African Americans. Arch Intern Med 2005;165:1395-400 (AUC 0.56). Verve shows the ratio and draws no band for that ancestry setting.",
    "caveatPubmed": "https://pubmed.ncbi.nlm.nih.gov/15983289/",
    "note": "Derived in mostly white, overweight cohorts at Stanford. South Asian cut-points are not settled; the band is a screen for insulin resistance, read beside HOMA-IR, waist and fasting insulin rather than alone."
  },
  "apoBApoA1": {
    "unit": "mg/dL / mg/dL (units cancel; g/L reports give the same ratio)",
    "elevatedFromMale": 0.9,
    "elevatedFromFemale": 0.8,
    "source": "Walldius G, Jungner I. Apolipoprotein B and apolipoprotein A-I: risk indicators of coronary heart disease and targets for lipid-modifying therapy. J Intern Med 2004;255:188-205 (risk cut-offs about 0.9 men, 0.8 women, from AMORIS). Walldius G, Jungner I, Holme I, et al. High apolipoprotein B, low apolipoprotein A-I, and improvement in the prediction of fatal myocardial infarction (AMORIS study). Lancet 2001;358:2026-33 (n=175,553). McQueen MJ, Hawken S, Wang X, et al. Lipids, lipoproteins, and apolipoproteins as risk markers of myocardial infarction in 52 countries (INTERHEART). Lancet 2008;372:224-33 (highest population-attributable risk of any lipid measure, 54%, consistent in every ethnic group incl. South Asia, both sexes, all ages).",
    "pubmed": "https://pubmed.ncbi.nlm.nih.gov/14746556/",
    "pubmed2": "https://pubmed.ncbi.nlm.nih.gov/11755609/",
    "pubmed3": "https://pubmed.ncbi.nlm.nih.gov/18640459/",
    "note": "ApoA1 is not on a standard lipid panel; it is printed beside ApoB on an advanced one. One ApoB per atherogenic particle, ApoA1 on the particles that carry cholesterol away: the ratio is the balance of the two."
  }
} as const;
