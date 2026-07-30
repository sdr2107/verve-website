/**
 * Science page content — ported from METTracker's app/settings/science.tsx
 * and data/met-thresholds.json. Every citation here should match the in-app
 * Science screen (now a shortened teaser pointing here) — if one changes,
 * update both, same discipline the app itself uses for its own thresholds.
 */

export interface Citation {
  title: string;
  summary: string;
  url: string;
  color: string;
  isCommentary?: boolean;
}

export interface ScienceSection {
  /** Anchor id — the app links to /science#{slug} from specific cards. */
  slug: string;
  label: string;
  citations: Citation[];
}

export const CRF_SECTION: Citation[] = [
  {
    title: "Blair et al, JAMA 2009",
    summary:
      "33 studies, 102,980 participants. Each 1 MET improvement in CRF capacity is associated with a 13% reduction in all-cause mortality and 15% in cardiovascular mortality. Achieving 7.9 MET-hours/week is linked to substantially reduced cardiovascular mortality.",
    url: "https://pubmed.ncbi.nlm.nih.gov/19454641/",
    color: "#4338ca",
  },
  {
    title: "Mandsager et al, Cleveland Clinic 2018",
    summary:
      "122,007 patients. Being below vs above average CRF carries the same mortality risk as smoking or diabetes. Low to Elite CRF shows a 5-fold difference in all-cause mortality. Verve uses this data for ages 40+ and ACSM/Cooper Institute normative data for ages 18–39.",
    url: "https://pubmed.ncbi.nlm.nih.gov/30646252/",
    color: "#be123c",
  },
  {
    title: "Kokkinos et al 2022",
    summary:
      "750,000 veterans, 10.2-year follow-up. Extremely fit vs lowest fitness shows a 4-fold mortality difference. No increased mortality seen at highest fitness levels.",
    url: "https://pubmed.ncbi.nlm.nih.gov/35926933/",
    color: "#15803d",
  },
  {
    title: "Kim et al, UK Biobank",
    summary:
      "70,000+ participants. CRF and muscle strength together reduces mortality more than either alone. Strength training is a co-equal recommendation alongside aerobic activity.",
    url: "https://pubmed.ncbi.nlm.nih.gov/29594847/",
    color: "#b45309",
  },
  {
    title: "AHA 2016 Scientific Statement",
    summary:
      "CRF should be regarded as a clinical vital sign, as predictive of health outcomes as blood pressure or cholesterol. Routine CRF assessment is recommended.",
    url: "https://pubmed.ncbi.nlm.nih.gov/27881567/",
    color: "#7e22ce",
  },
  {
    title: "Why not VO₂Max? (Topol commentary)",
    summary:
      "234× more participants in MET-based CRF studies than VO₂Max studies. Over 99% of outcome data is based on METs. Wearable VO₂Max has 7–16% error and should not be used as a primary health metric.",
    url: "https://erictopol.substack.com/p/the-flawed-v02-max-craze",
    color: "#c2410c",
    isCommentary: true,
  },
  {
    title: "Nakanishi et al 2021",
    summary:
      "Validates heart rate reserve (%HRR) + demographics for estimating MET intensity during free-living daily activity from wrist-worn wearables. Basis of Verve's Background Activity passive estimation.",
    url: "https://pubmed.ncbi.nlm.nih.gov/?term=nakanishi+metabolic+equivalent+heart+rate+reserve+wearable",
    color: "#5b21b6",
  },
];

export const MOVEMENT_BALANCE_SECTION: Citation[] = [
  {
    title: "Biswas et al, Annals of Internal Medicine 2015",
    summary:
      "Meta-analysis of 47 studies, 240,818 person-years. Prolonged sedentary time is independently associated with all-cause mortality, cardiovascular disease, type 2 diabetes, and cancer — regardless of moderate-to-vigorous physical activity level. Participants in the highest quartile of sedentary time (≈10.6 h/day) had significantly elevated risk. Basis of Verve's first sedentary bar threshold at 10.6 h.",
    url: "https://pubmed.ncbi.nlm.nih.gov/25599530/",
    color: "#b45309",
  },
  {
    title: "Ekelund et al, The Lancet 2016",
    summary:
      "Pooled analysis of 16 studies, 1,005,791 individuals. Sitting ≥8 h/day was associated with increased all-cause mortality unless offset by 60–75 min/day of moderate physical activity — a threshold most adults do not reach. Risk was highest above 12 h/day of total sedentary time, regardless of activity. Basis of Verve's second sedentary bar threshold at 12 h.",
    url: "https://pubmed.ncbi.nlm.nih.gov/27475271/",
    color: "#c2410c",
  },
  {
    title: "Patterson et al, BMJ 2018",
    summary:
      "Systematic review and meta-analysis of 13 prospective studies, 1,020,840 person-years. High sedentary time is associated with a 24% greater all-cause mortality risk, 14% greater CVD mortality risk, and 17% greater cancer risk, independent of physical activity. Risk increases steeply above 10 h/day.",
    url: "https://pubmed.ncbi.nlm.nih.gov/30446977/",
    color: "#92400e",
  },
  {
    title: "Diaz et al, Annals of Internal Medicine 2017",
    summary:
      "7,985 adults followed for 4 years. Total sedentary time AND uninterrupted sitting bouts both independently predict mortality. Frequent breaks from sitting are protective even for those with the same total sedentary hours — supporting the importance of how sitting is distributed, not just how much.",
    url: "https://pubmed.ncbi.nlm.nih.gov/28892811/",
    color: "#b45309",
  },
];

export const STEPS_SECTION: Citation[] = [
  {
    title: "Stens et al, JACC 2023",
    summary:
      "111,309 participants, 7.1-year follow-up. Dose-response relationship between daily step counts and all-cause mortality + cardiovascular events. Minimum effective dose: ~2,600 steps/day. CVD mortality benefit peaks around 7,200 steps/day. Basis of Verve's daily step tier thresholds.",
    url: "https://pubmed.ncbi.nlm.nih.gov/37676198/",
    color: "#0369a1",
  },
  {
    title: "Ding et al, Lancet Public Health 2025",
    summary:
      "Systematic review and dose-response meta-analysis. Optimal daily step count for all-cause mortality is approximately 8,800 steps/day. Confirms and extends the JACC 2023 findings across broader populations.",
    url: "https://pubmed.ncbi.nlm.nih.gov/40713949/",
    color: "#0e7490",
  },
  {
    title: "Del Pozo Cruz et al, JAMA Internal Medicine 2022",
    summary:
      "Prospective associations between daily step counts, cadence intensity, and cancer/cardiovascular disease incidence, CVD mortality, and all-cause mortality. Peak 30-minute cadence (steps/minute) independently predicts mortality regardless of total daily step volume.",
    url: "https://pubmed.ncbi.nlm.nih.gov/36094529/",
    color: "#047857",
  },
];

export const ZONE2_SECTION: Citation[] = [
  {
    title: "Arnett et al — ACC/AHA 2019 Primary Prevention Guideline",
    summary:
      "ACC/AHA guidelines recommend at least 150 min/week of moderate-intensity (Zone 2) or 75 min/week of vigorous-intensity aerobic activity for primary prevention of cardiovascular disease. Strong evidence basis for Verve's 150–300 min/week Zone 2 target.",
    url: "https://www.jacc.org/doi/10.1016/j.jacc.2019.03.010",
    color: "#0284c7",
  },
  {
    title: "Tucker et al — Exercise for CVD Prevention, JACC 2022",
    summary:
      "JACC Focus Seminar on exercise for primary and secondary CVD prevention. Confirms dose-response benefits of moderate-intensity exercise and supports Zone 2 as the primary training zone for cardiovascular health in the general population.",
    url: "https://pubmed.ncbi.nlm.nih.gov/36075680/",
    color: "#0369a1",
  },
  {
    title: "Piercy et al — Physical Activity Guidelines for Americans, JAMA 2018",
    summary:
      "US Department of Health and Human Services evidence review underlying the 2018 Physical Activity Guidelines. Established 150–300 min/week of moderate-intensity activity as the target range with the greatest health benefit.",
    url: "https://pubmed.ncbi.nlm.nih.gov/30418471/",
    color: "#075985",
  },
];

export const ZONE2_HR_SECTION: Citation[] = [
  {
    title: "Garber et al — ACSM Position Stand 2011",
    summary:
      "American College of Sports Medicine position stand on quantity and quality of exercise. Recommends 40–60% Heart Rate Reserve (HRR, Karvonen method) as the moderate-intensity aerobic training range. Basis of Verve's Karvonen HRR zone calculation.",
    url: "https://pubmed.ncbi.nlm.nih.gov/21694556/",
    color: "#0369a1",
  },
  {
    title: "Fletcher et al — AHA Exercise Standards 2013",
    summary:
      "AHA scientific statement on exercise standards for testing and training. Endorses the Karvonen (HRR) method for prescribing moderate-intensity exercise, anchoring intensity to resting HR for greater individualisation.",
    url: "https://pubmed.ncbi.nlm.nih.gov/23877260/",
    color: "#075985",
  },
];

export const BODY_PHENOTYPING_SECTION: Citation[] = [
  {
    title: "Alberti et al. 2009 — Harmonizing the Metabolic Syndrome",
    summary:
      "Joint Scientific Statement from IDF, NHLBI, AHA, WHF, IAS, and IASO. Defines metabolic syndrome as any 3 of 5 criteria: waist circumference, fasting glucose, blood pressure, triglycerides, and HDL. Verve flags ≥1 abnormal criterion — intentionally more sensitive than the clinical ≥3 threshold — to surface early metabolic risk before full syndrome develops.",
    url: "https://pubmed.ncbi.nlm.nih.gov/19560804/",
    color: "#0891b2",
  },
  {
    title: "Wildman et al. 2008 — Metabolically Healthy Obese (NHANES)",
    summary:
      "Analysis of NHANES III data. Found that 31.7% of obese and 23.5% of overweight US adults are metabolically healthy — while 23.5% of normal-weight adults have ≥2 cardiometabolic risk abnormalities. Established that BMI alone is an unreliable proxy for metabolic health.",
    url: "https://pubmed.ncbi.nlm.nih.gov/18695077/",
    color: "#0e7490",
  },
  {
    title: "Thomas et al. 2012 — TOFI: Normal Weight, Hidden Fat (MRI/MRS)",
    summary:
      "MRI and magnetic resonance spectroscopy study. Demonstrated that individuals with normal BMI can carry substantial visceral and liver fat — the TOFI (Thin Outside, Fat Inside) phenotype. Visceral fat, not subcutaneous fat, drives the elevated metabolic risk.",
    url: "https://pubmed.ncbi.nlm.nih.gov/22226027/",
    color: "#0369a1",
  },
];

export const HEART_HEALTH_SECTION: Citation[] = [
  {
    title: "ApoB — ESC/EAS 2019 Dyslipidaemia Guidelines",
    summary:
      "Risk-stratified ApoB goals: <65 mg/dL very-high risk, <80 mg/dL high risk, <100 mg/dL moderate risk. Verve screens against the <80 / <100 boundaries. ApoB counts atherogenic particles directly — one per LDL, IDL, VLDL and Lp(a) particle — capturing risk LDL-C alone can miss.",
    url: "https://pubmed.ncbi.nlm.nih.gov/31504418/",
    color: "#be123c",
  },
  {
    title: "LDL-C — NCEP ATP III",
    summary:
      "Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults. Optimal <100, near-optimal 100–129, borderline-high 130–159, high 160–189, very high ≥190 mg/dL. Verve collapses the upper bands into one “elevated” tier for screening.",
    url: "https://pubmed.ncbi.nlm.nih.gov/11368702/",
    color: "#b45309",
  },
  {
    title: "Lp(a) — EAS 2022 Consensus Statement",
    summary:
      "Risk rises continuously; commonly cited bands are <75 nmol/L (~<30 mg/dL) low, 75–125 nmol/L (30–50 mg/dL) intermediate, >125 nmol/L (>50 mg/dL) high. Lp(a) is ~90% genetically determined and stable through life — a single measurement is usually sufficient.",
    url: "https://pubmed.ncbi.nlm.nih.gov/36036785/",
    color: "#7e22ce",
  },
  {
    title: "hs-CRP — AHA/CDC Scientific Statement 2003",
    summary:
      "Relative cardiovascular risk bands: <1.0 mg/L low, 1.0–3.0 mg/L average, >3.0 mg/L high. Values above 10 mg/L usually reflect acute infection or inflammation rather than chronic cardiovascular risk — re-test once well.",
    url: "https://pubmed.ncbi.nlm.nih.gov/12551878/",
    color: "#0891b2",
  },
];

export const MUSCLE_HEALTH_SECTION: Citation[] = [
  {
    title: "Leong et al — PURE Study, The Lancet 2015",
    summary:
      "142,861 adults across 17 countries, median 4-year follow-up. For every 5 kg reduction in grip strength, cardiovascular death increased 17%, all-cause mortality 16%. Grip strength was a stronger predictor of cardiovascular death than systolic blood pressure. Low grip flags who lacks the physiological reserve to survive a cardiovascular crisis.",
    url: "https://pubmed.ncbi.nlm.nih.gov/25982160/",
    color: "#0f766e",
  },
  {
    title: "Celis-Morales et al — UK Biobank, BMJ 2018",
    summary:
      "502,293 participants. Grip weakness (<26 kg men / <16 kg women) was associated with 26% higher all-cause mortality, 31% higher cardiovascular mortality — independent of physical activity, diet, and smoking. Obese individuals with high grip strength had lower mortality than non-obese individuals with low grip strength.",
    url: "https://pubmed.ncbi.nlm.nih.gov/29472272/",
    color: "#0e7490",
  },
];
