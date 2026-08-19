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

export const SLEEP_RHYTHM_SECTION: Citation[] = [
  {
    title: "Windred et al — Sleep regularity vs sleep duration, SLEEP 2024",
    summary:
      "60,977 UK Biobank participants wearing accelerometers for a week, followed for around 7 years. The Sleep Regularity Index — the chance of being in the same state, asleep or awake, at any two clock times 24 hours apart — predicted all-cause mortality more strongly than sleep duration did. The four most regular quintiles carried 20–48% lower risk than the least regular. The sample median was 81.0, which is why Verve treats 81 as ordinary rather than as a shortfall, and the 25th and 75th percentiles (71.6 and 87.3) are the band edges the dial draws.",
    url: "https://doi.org/10.1093/sleep/zsad253",
    color: "#6366f1",
  },
  {
    title: "AHA 2025 — Multidimensional Sleep Health scientific statement",
    summary:
      "The American Heart Association's scientific statement names regularity as one of the core dimensions of sleep health. Its suggested way of measuring it is NOT the Sleep Regularity Index — it is the night-to-night standard deviation of sleep timing, commonly with a mark at 60 minutes. That is the number Verve shows in minutes beneath the score, and it is the one a guideline actually stands behind. The statement presents regularity as a research and clinical concept, not tied to any commercial device.",
    url: "https://doi.org/10.1161/hcq.0000000000000139",
    color: "#4f46e5",
  },
  {
    title: "Why Verve shows a number nothing else does",
    summary:
      "SRI is a research metric. As of 2026 no FDA-cleared device and no major consumer wearable — Oura, Fitbit, Apple Watch, Whoop — reports a Sleep Regularity Index by that name; they report duration, staging, and proprietary sleep or readiness composites. Published SRI values come from academic pipelines such as GGIR and sleepreg run on raw accelerometry. Verve is ahead of the field here, and that is a reason for more disclosure rather than less: no clinical guideline recommends SRI for individual patient management, and a 2025 systematic review, while finding the evidence on mortality and cardiometabolic outcomes consistent, called for regularity to become a public-health recommendation rather than describing existing clinical use.",
    url: "https://doi.org/10.1093/sleep/zsad253",
    color: "#4338ca",
    isCommentary: true,
  },
  {
    title: "Why your score is not comparable with anyone else's",
    summary:
      "The 2026 RIRI statement applied two accepted open-source SRI calculators, sleepreg and GGIR, to the same 73,794-adult accelerometer dataset. They produced meaningfully different SRI values — different enough to change how clinical outcome models read — and a 14-item reporting standard came out of it. So SRI is a method, not a standard. Verve states its own: 1-minute epochs, sleep taken from Apple Health whichever device wrote it, naps included, everything outside a recorded sleep interval treated as awake, local clock times compared, and both partial edge days of the window dropped. Read your own trend over weeks; do not compare the number with a friend's.",
    url: "https://doi.org/10.1093/sleep/zsad253",
    color: "#6366f1",
    isCommentary: true,
  },
  {
    title: "What Verve needs before it will show a score",
    summary:
      "8 nights of recorded sleep for a 7-day score. The first and last day of any window are only partly covered — the night that would have supplied the first morning began before the window, and no night follows the last evening — so both are dropped rather than counted as irregularity that never happened. The minutes-of-spread measure needs only 5 bedtimes, so it appears first. Any device that writes sleep to Apple Health qualifies, including Oura, Whoop and Garmin; an Apple Watch is not required.",
    url: "https://doi.org/10.1093/sleep/zsad253",
    color: "#818cf8",
    isCommentary: true,
  },
];

export const RESTING_HR_SECTION: Citation[] = [
  {
    title: "Radin et al — Wearable data and population health, Lancet Digital Health 2020",
    summary:
      "A population-based study using resting heart rate and sleep data from Fitbit wearers across several US states. Deviation from an individual's OWN baseline — not from a population range — improved real-time state-level prediction of influenza-like illness. The principle Verve borrows is the comparison, not the diagnosis: several beats above your own normal, sustained across days, is a signal that any single reading inside 60–100 bpm can never be.",
    url: "https://doi.org/10.1016/S2589-7500(19)30222-5",
    color: "#e11d48",
  },
  {
    title: "Why a personal baseline, and why the median",
    summary:
      "The usual healthy range spans roughly 60 to 100 bpm — wide enough that someone who normally rests at 52 can wake 11 beats up and still sit comfortably inside it. Verve compares you only with the middle of your own last 30 days. It uses the median rather than the mean so that one feverish night, one late flight or one heavy evening cannot drag the very line it is being judged against, and it excludes today's reading from its own baseline, which would otherwise shrink every deviation it is meant to reveal.",
    url: "https://doi.org/10.1016/S2589-7500(19)30222-5",
    color: "#be123c",
    isCommentary: true,
  },
  {
    title: "What an elevated reading does not mean",
    summary:
      "Alcohol, a late or heavy meal, a hot room, poor sleep, altitude, stress and hard training all raise resting heart rate, as does illness. Verve reports the size and direction of the change and stops there — it cannot distinguish between those causes and does not attempt to. A resting rate drifting DOWN over weeks is a well-recognised response to aerobic training, and that slow movement carries more meaning than any single morning.",
    url: "https://doi.org/10.1016/S2589-7500(19)30222-5",
    color: "#9f1239",
    isCommentary: true,
  },
];

// Sitting is shown on the Conditions card and on Movement Balance as one
// number from one source, so its evidence lives in one section too.
export const SEDENTARY_EXTRA: Citation[] = [
  {
    title: "Diaz et al — Patterns of sedentary behavior and mortality, Annals of Internal Medicine 2017",
    summary:
      "7,985 adults aged 45 and over from the REGARDS cohort, wearing hip accelerometers, followed for a median of 4 years. Mortality was associated with the MEAN LENGTH of uninterrupted sedentary stretches independently of total sedentary time: people accumulating their sitting in bouts of 30 minutes or more carried the highest risk. Total volume and the pattern of accumulation are separate exposures — the same 8 hours broken every half hour is not the same 8 hours taken in blocks. 30 minutes is the mark Verve draws on the meter.",
    url: "https://doi.org/10.7326/M17-0212",
    color: "#f59e0b",
  },
  {
    title: "Dempsey et al — Interrupting prolonged sitting, Diabetes Care 2016",
    summary:
      "A randomised crossover trial in adults with type 2 diabetes. Breaking up prolonged sitting with brief, frequent activity — short bouts of light walking or simple resistance activities every 30 minutes — lowered postprandial glucose and insulin compared with sitting continuously. The consistent finding across this literature is the FREQUENCY of breaking, not the intensity of the break: a single hard session later does not substitute for standing up.",
    url: "https://doi.org/10.2337/dc15-2336",
    color: "#d97706",
  },
];

export const WEEKLY_VOLUME_SECTION: Citation[] = [
  {
    title: "Liang et al — BJSM 2026, device-measured activity and CVD",
    summary:
      "17,088 UK Biobank participants wearing accelerometers, mean age 57, followed for incident cardiovascular disease, with Mendelian randomisation used to test causal consistency. Meeting the familiar 150 min/week gave only an 8–9% risk reduction; reaching 560–610 min/week was associated with over 30% lower risk of myocardial infarction, stroke, heart failure and atrial fibrillation. People with lower cardiorespiratory fitness needed 30–50 min/week more than fitter people for the same benefit. Verve's summit line sits at 610, the upper bound of that range — the dose-response curve flattens around there, which is why nothing is drawn above it. Worth noting the cohort was 96% white and middle-aged, so the exact numbers may not transfer to every population.",
    url: "https://doi.org/10.1136/bjsports-2025-111351",
    color: "#0ea5e9",
  },
  {
    title: "Why Verve counts minutes as measured",
    summary:
      "Public-health targets credit vigorous activity double — 150 moderate-equivalent minutes can be met with 75 vigorous ones. Those figures come from questionnaires. Verve counts what your device actually recorded, without doubling, which is the same way the study above measured activity. It is the more conservative reading: a vigorous week counts for less here than a guideline would allow, never more.",
    url: "https://doi.org/10.1136/bjsports-2025-111351",
    color: "#0284c7",
    isCommentary: true,
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
