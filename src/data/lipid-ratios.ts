/**
 * A copy of the app's data/met-thresholds.json#lipidRatios (METTracker), with
 * #remnantCholesterol beside it under the key remnantCholesterol, as a module
 * so Node's test runner and the Astro build read it alike. If the app's file
 * changes, regenerate this one from it (the same discipline
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
  },
  "remnantCholesterol": {
    "_note": "Remnant cholesterol = total cholesterol - HDL - LDL, the three from one report; computed at read, never stored (lib/lipids.ts remnantCholesterol). The LDL's METHOD labels the figure and never changes the arithmetic: with a directly measured LDL it is a measurement of the cholesterol in triglyceride-rich particles; with a calculated LDL it is the share of triglycerides the lab's equation set aside for VLDL (triglycerides / 5 under Friedewald; Martin-Hopkins and Sampson change the divisor, so Verve never recomputes it). With no total cholesterol or no HDL there is no figure: nothing is estimated from triglycerides alone. A screening line, not a treatment target.",
    "unit": "mg/dL",
    "elevatedFrom": 30,
    "mgdlPerMmol": 38.67,
    "elevatedFromMmol": 0.78,
    "friedewald": {
      "tgDivisor": 5,
      "validBelowTgMgdl": 400,
      "matchWithinMgdl": 0.5,
      "tgDivisorMmol": 2.2,
      "matchWithinMmol": 0.02,
      "note": "When a report does not print the LDL's method and total - HDL - LDL agrees with triglycerides / 5 to the unit (within matchWithinMgdl, the rounding of a printed LDL), the LDL reads as calculated, by the arithmetic. Not applied at or above validBelowTgMgdl, where Friedewald is not valid and a lab does not use it. A mmol/L report is judged in its own unit, where Friedewald is triglycerides / 2.2 (tgDivisorMmol), within matchWithinMmol: the rounding of an LDL printed to two decimals. A report printed to one decimal will mostly not match and reads as method not known, which is the safe way to be wrong. The app stores mg/dL and uses the mg/dL pair; the website reads a report in its printed unit and uses whichever fits."
    },
    "source": "Castaner O, Pinto X, Subirana I, et al. Remnant Cholesterol, Not LDL Cholesterol, Is Associated With Incident Cardiovascular Disease. J Am Coll Cardiol 2020;76(23):2712-2724 (PREDIMED, n=6,901 overweight or obese adults at high cardiovascular risk; median follow-up 4.8 years; remnant cholesterol >=30 mg/dL, 0.78 mmol/L, marked the higher-risk group whether or not LDL-C was on target at <=100 mg/dL). The line Verve draws.",
    "pubmed": "https://pubmed.ncbi.nlm.nih.gov/33272365/",
    "causalSource": "Varbo A, Benn M, Tybjaerg-Hansen A, et al. Remnant cholesterol as a causal risk factor for ischemic heart disease. J Am Coll Cardiol 2013;61(4):427-436 (Copenhagen, n=73,513; a 1 mmol/L, 39 mg/dL, higher nonfasting remnant cholesterol went with 1.4x the observed and 2.8x the causal risk of ischemic heart disease, independent of HDL). Navarese EP, Vine D, Proctor S, et al. Independent Causal Effect of Remnant Cholesterol on Atherosclerotic Cardiovascular Outcomes: A Mendelian Randomization Study. Arterioscler Thromb Vasc Biol 2023;43(9):e373-e380 (combined sample 958,434; causal effect on coronary artery disease, myocardial infarction and stroke; for coronary disease and infarction it held after accounting for LDL cholesterol).",
    "causalPubmed": "https://pubmed.ncbi.nlm.nih.gov/23265341/",
    "causalPubmed2": "https://pubmed.ncbi.nlm.nih.gov/37439258/",
    "beyondLdlSource": "Quispe R, Martin SS, Michos ED, et al. Remnant cholesterol predicts cardiovascular disease beyond LDL and ApoB: a primary prevention study. Eur Heart J 2021;42(42):4324-4332 (n=17,532 pooled from ARIC, MESA and CARDIA; 2,143 events over a median 18.7 years; log remnant cholesterol HR 1.65 after adjustment including LDL-C and apoB; discordant high remnant / low LDL-C HR 1.21 against the concordant group; remnant computed as non-HDL-C minus a calculated LDL-C).",
    "beyondLdlPubmed": "https://pubmed.ncbi.nlm.nih.gov/34293083/",
    "methodSource": "Friedewald WT, Levy RI, Fredrickson DS. Estimation of the concentration of low-density lipoprotein cholesterol in plasma, without use of the preparative ultracentrifuge. Clin Chem 1972;18(6):499-502 (VLDL cholesterol taken as triglycerides / 5 in mg/dL; not valid above 400 mg/dL of triglycerides). Martin SS, Blaha MJ, Elshazly MB, et al. Comparison of a novel method vs the Friedewald equation for estimating low-density lipoprotein cholesterol levels from the standard lipid profile. JAMA 2013;310(19):2061-2068. Sampson M, Ling C, Sun Q, et al. A New Equation for Calculation of Low-Density Lipoprotein Cholesterol in Patients With Normolipidemia and/or Hypertriglyceridemia. JAMA Cardiol 2020;5(5):540-548.",
    "methodPubmed": "https://pubmed.ncbi.nlm.nih.gov/4337382/",
    "methodPubmed2": "https://pubmed.ncbi.nlm.nih.gov/24240933/",
    "methodPubmed3": "https://pubmed.ncbi.nlm.nih.gov/32101259/",
    "note": "Copenhagen draws its line at 1 mmol/L (39 mg/dL); PREDIMED at 30 mg/dL (0.78 mmol/L). Verve reads below 30 as in range and 30 and above as elevated, and names the Copenhagen line on the science page."
  }
} as const;
