/**
 * A copy of the parts of the app's data/met-thresholds.json (METTracker) that
 * the Body page's bands read: the cardiovascular and supplementary metabolic
 * markers, central adiposity and remnant cholesterol. A module rather than a
 * JSON file so Node's test runner and the Astro build read it alike (the same
 * discipline step-thresholds.ts and lipid-ratios.ts keep). Copied 8 November
 * 2026; regenerate from the app's file when it changes. Do not edit by hand.
 */
export default {
  "_source": "A verbatim subset of METTracker/data/met-thresholds.json (the app's one thresholds file), copied 8 November 2026 for the website's Body page. Regenerate from the app's file when it changes; never edit a number here by hand.",
  "version": "2.0",
  "cardiovascularMarkers": {
    "_note": "Heart Health section (Body page). Screening bands only — these are NOT treatment targets. For ApoB and LDL-C in particular, clinical targets are set by the individual's overall cardiovascular risk category, so a value in the 'borderline' band may be perfectly appropriate for one person and a treatment trigger for another. Verve classifies against population screening bands and always defers to a clinician.",
    "apoB": {
      "unit": "mg/dL",
      "optimalMax": 79,
      "borderlineMax": 99,
      "source": "ESC/EAS 2019 Guidelines for the Management of Dyslipidaemias (Mach F et al, Eur Heart J 2020;41:111-188). Risk-stratified ApoB goals: <65 mg/dL very-high risk, <80 mg/dL high risk, <100 mg/dL moderate risk. Verve screens against the <80 / <100 boundaries.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/31504418/",
      "note": "ApoB counts atherogenic particles directly — one ApoB per LDL, IDL, VLDL and Lp(a) particle — so it captures risk that LDL-C alone can miss, particularly in insulin resistance and high triglycerides."
    },
    "ldlC": {
      "unit": "mg/dL",
      "optimalMax": 99,
      "borderlineMax": 129,
      "source": "NCEP ATP III (Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults, JAMA 2001;285:2486-2497). LDL-C classification: optimal <100, near-optimal 100-129, borderline-high 130-159, high 160-189, very high >=190 mg/dL. Verve collapses the upper bands into one 'elevated' tier for screening.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/11368702/",
      "note": "LDL cholesterol measures the cholesterol carried by LDL particles, not the particle count itself. Where the two disagree, ApoB is the better risk marker."
    },
    "lpa": {
      "primaryUnit": "nmol/L",
      "nmolL": {
        "lowMax": 74,
        "intermediateMax": 124
      },
      "mgdl": {
        "lowMax": 29,
        "intermediateMax": 49
      },
      "approxNmolPerMgdl": 2.15,
      "source": "EAS 2022 Consensus Statement on lipoprotein(a) (Kronenberg F et al, Eur Heart J 2022;43:3925-3946). Risk rises continuously; commonly cited bands are <75 nmol/L (~<30 mg/dL) low, 75-125 nmol/L (30-50 mg/dL) intermediate, >125 nmol/L (>50 mg/dL) high.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/36036785/",
      "note": "Lp(a) is ~90% genetically determined and stable through life — a single measurement is usually sufficient. Unit conversion between nmol/L and mg/dL is only approximate because it depends on apolipoprotein(a) isoform size; Verve stores the unit you entered and marks any converted value as approximate."
    },
    "hsCRP": {
      "unit": "mg/L",
      "lowMax": 0.9,
      "averageMax": 3.0,
      "acuteInflammationMin": 10.0,
      "source": "AHA/CDC Scientific Statement on markers of inflammation and cardiovascular disease (Pearson TA et al, Circulation 2003;107:499-511). Relative cardiovascular risk bands: <1.0 mg/L low, 1.0-3.0 mg/L average, >3.0 mg/L high.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/12551878/",
      "note": "Values above 10 mg/L usually reflect a passing infection or inflammation, not long-term heart risk. Verve does not read a value this high as a heart marker."
    }
  },
  "metabolicSupplementaryMarkers": {
    "_note": "Blood Sugar and Insulin Resistance markers tracked alongside the Alberti 2009 metabolic-syndrome criteria (Body page) but NOT counted toward that 5-criteria score — same 'tracked, not counted' treatment as the Heart Health markers. Screening context only, not a diagnostic verdict.",
    "hba1c": {
      "unit": "%",
      "measuredAt": "Any time of day, no fasting required - reflects average blood sugar over the prior 2-3 months",
      "inRangeMax": 5.6,
      "prediabetesMin": 5.7,
      "diabetesMin": 6.5,
      "source": "American Diabetes Association, Standards of Care in Diabetes-2026, Section 2: Diagnosis and Classification of Diabetes. Normal <5.7%, prediabetes 5.7-6.4%, diabetes >=6.5%.",
      "note": "The 5.7% cut point is ALSO what satisfies the glucose criterion of the Alberti 2009 metabolic-syndrome definition when no fasting glucose is on record. assessMetabolicCriteria() reads prediabetesMin from here, so the criterion and this marker's bands can never drift apart."
    },
    "postMealGlucose": {
      "unit": "mg/dL",
      "measuredAt": "1-2 hours after starting a meal, home glucometer reading",
      "inRangeMax": 179,
      "source": "American Diabetes Association, Standards of Care in Diabetes-2026, Section 6: Glycemic Goals, Hypoglycemia, and Hyperglycemic Crises (Diabetes Care 2026;49(Suppl 1):S132-S149). Peak postprandial self-monitoring target: <180 mg/dL.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/41358894/",
      "note": "This is the ADA's self-monitoring target for a home reading 1-2 hours after a normal meal — a different measurement from a supervised diagnostic oral glucose tolerance test, which uses a standardized glucose drink and different cutoffs."
    },
    "homaIr": {
      "formula": "(fasting glucose mg/dL x fasting insulin uIU/mL) / 405",
      "formulaSource": "Matthews DR et al, Diabetologia 1985;28:412-419 (original HOMA model).",
      "formulaPubmed": "https://pubmed.ncbi.nlm.nih.gov/3899825/",
      "cutoffMale": 1.85,
      "cutoffFemaleUnder40": 2.36,
      "cutoffFemale40to59": 2.07,
      "cutoffFemale60plus": 2.47,
      "source": "Gayoso-Diz P et al, BMC Endocr Disord 2013;13:47 (EPIRCE cross-sectional study, n=2,459 Spanish adults). ROC-derived cutoffs (Youden Index) against ATP III metabolic syndrome, stratified by sex and age. Men: no significant age effect, flat 1.85. Women: non-linear age effect, 2.36 at age 30, 2.07 at age 50, 2.47 at age 70.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/24131857/",
      "note": "No universally accepted single cutoff exists for HOMA-IR — results vary by population, assay, and lab. This threshold is derived from a Spanish cohort; some populations, including South Asian, tend to show insulin resistance at somewhat lower absolute values (MDCalc/NHANES-referenced range approximately 1.4-2.5). Not part of any validated management algorithm — a screening signal, not a diagnosis."
    }
  },
  "centralAdiposity": {
    "_note": "Ratios that describe WHERE fat sits, read alongside waist circumference on the Body page. Waist circumference itself keeps its IDF 2006 ethnicity-adjusted cutoff (see waistElevatedThresholdCm in lib/body.ts) because that is the number the Alberti 2009 metabolic-syndrome criterion is written against; the ratios below are a separate, cardiovascular reading of the same tape. Only waist circumference has ethnicity-specific cutoffs — waist-to-height and waist-to-hip do not, and inventing them would be worse than not offering them.",
    "waistToHeight": {
      "unit": "",
      "elevated": 0.5,
      "source": "Ashwell M, Gunn P, Gibson S. Waist-to-height ratio is a better screening tool than waist circumference and BMI for adult cardiometabolic risk factors: systematic review and meta-analysis. Obes Rev 2012;13(3):275-86. Adopted by NICE guideline CG189 (2022 update): keep waist to less than half your height.",
      "note": "The primary ratio in Verve. It needs waist and height only, both of which the app already holds, so it appears the moment a waist is recorded. Same 0.50 boundary for both sexes and all ancestries — no ethnicity-specific version has been established."
    },
    "waistToHip": {
      "unit": "",
      "elevatedMale": 0.9,
      "elevatedFemale": 0.85,
      "source": "WHO Expert Consultation. Waist Circumference and Waist-Hip Ratio: Report of a WHO Expert Consultation, Geneva, 8-11 December 2008. Substantially increased risk at >=0.90 in men and >=0.85 in women.",
      "note": "Needs a hip measurement, which no wearable supplies, so it is the optional upgrade rather than the default. No ethnicity-specific cutoffs exist."
    }
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
