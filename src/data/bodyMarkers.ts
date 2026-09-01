/**
 * Body-marker explainers — GENERATED. Do not edit by hand.
 *
 * Written by scripts/gen-marker-explainers.mjs in the Verve app repo, from
 * lib/markers.ts. That file is what the app classifies readings with, so the
 * thresholds printed here cannot drift from the ones a reader was just shown
 * on their phone. Edit the marker definition and regenerate.
 *
 * Ranges shown for a 50-year-old man of 175 cm; several move with sex, age, height or ancestry.
 */

export interface BodyMarkerExplainer {
  /** Anchor id. The app links to /science#{slug}. */
  slug: string;
  section: string;
  label: string;
  purpose: string;
  note: string;
  units: string[];
  howTo: string[];
  bands: string[];
  citation: string;
  /** Long-form explanation, paragraph per entry. Empty for most markers. */
  detail: string[];
  /** Papers behind the cut-offs, for markers that carry a full list. */
  references: string[];
}

export const BODY_MARKER_CONTEXT = "Ranges shown for a 50-year-old man of 175 cm; several move with sex, age, height or ancestry.";

export const BODY_MARKERS: BodyMarkerExplainer[] = [
  {
    slug: "glucose",
    section: "Metabolic",
    label: "Fasting blood sugar",
    purpose: "Blood sugar after an overnight fast",
    note: "HbA1c is recorded separately — either one satisfies this criterion.",
    units: ["mg/dL"],
    howTo: [],
    bands: [
      "In range: < 100 mg/dL",
      "Elevated: ≥ 100 mg/dL",
    ],
    citation: "Alberti et al. 2009 — harmonised metabolic syndrome criteria.",
    detail: [],
    references: [],
  },
  {
    slug: "hba1c",
    section: "Metabolic",
    label: "HbA1c",
    purpose: "Your average blood sugar over the last three months",
    note: "No fasting needed — it can be drawn at any time of day.",
    units: ["%"],
    howTo: [],
    bands: [
      "In range: < 5.7%",
      "Prediabetes: 5.7–6.4%",
      "Diabetes: ≥ 6.5%",
    ],
    citation: "American Diabetes Association — Standards of Care in Diabetes, Section 2.",
    detail: [],
    references: [],
  },
  {
    slug: "bp",
    section: "Metabolic",
    label: "Blood pressure",
    purpose: "Systolic over diastolic, seated and rested",
    note: "Two major guidelines classify blood pressure, and they genuinely disagree between 120 and 139 mmHg systolic. Verve classifies by whichever you choose — a toggle on the Blood pressure card — so the app agrees with the system your own doctor uses. Home readings are the preferred basis for both: an office reading can run higher (the white-coat effect), which is why Verve lets you tag where a reading was taken. Verve also reads your cuff's own log from Apple Health, so the average reflects every measurement, not just the ones typed in.",
    units: ["mmHg"],
    howTo: [
      "Rest quietly for 5 minutes first — back supported, feet flat, legs uncrossed.",
      "Support your arm on a table so the cuff sits at heart level.",
      "No caffeine, exercise, or smoking in the 30 minutes before.",
      "Take 2 readings a minute apart and enter the average.",
      "Use the same arm each time you measure.",
    ],
    bands: [
      "AHA/ACC 2017 — Normal: < 120 · Elevated: 120–129 · Stage 1 hypertension: 130–139 · Stage 2: ≥ 140",
      "ESC 2024 — Non-elevated: < 120 · Elevated: 120–139 · Hypertension: ≥ 140",
      "Metabolic-syndrome criterion (unchanged by the toggle): ≥ 130/85 counts toward the Alberti 2009 definition",
    ],
    citation: "Whelton et al. 2017 (AHA/ACC) · McEvoy et al. 2024 (ESC) · Alberti et al. 2009.",
    detail: [],
    references: [],
  },
  {
    slug: "tg",
    section: "Metabolic",
    label: "Triglycerides",
    purpose: "Fat circulating in fasting blood",
    note: "Fasting blood panel.",
    units: ["mg/dL"],
    howTo: [],
    bands: [
      "In range: < 150",
      "Elevated: ≥ 150",
    ],
    citation: "Alberti et al. 2009 — harmonised metabolic syndrome criteria.",
    detail: [],
    references: [],
  },
  {
    slug: "hdl",
    section: "Metabolic",
    label: "HDL cholesterol",
    purpose: "Cholesterol carried away from vessel walls",
    note: "Fasting blood panel.",
    units: ["mg/dL"],
    howTo: [],
    bands: [
      "In range: ≥ 40",
      "Low: < 40",
    ],
    citation: "Alberti et al. 2009 — harmonised metabolic syndrome criteria.",
    detail: [],
    references: [],
  },
  {
    slug: "waist",
    section: "Metabolic",
    label: "Waist circumference",
    purpose: "Circumference at the navel",
    note: "",
    units: ["cm"],
    howTo: [
      "Measure directly on skin, standing, after breathing out normally.",
      "Place the tape midway between your lowest rib and the top of your hip bone.",
      "Keep the tape snug but not compressing, and level all the way around.",
      "Don't hold your breath or pull your stomach in.",
    ],
    bands: [
      "In range: < 94 cm",
      "Elevated: ≥ 94 cm",
    ],
    citation: "IDF 2006 ethnicity-adjusted cutoffs.",
    detail: [],
    references: [],
  },
  {
    slug: "post-meal-glucose",
    section: "Metabolic",
    label: "Post-meal glucose",
    purpose: "Blood sugar two hours after eating",
    note: "Home glucometer reading, 1–2 hours after starting a meal.",
    units: ["mg/dL"],
    howTo: [],
    bands: [
      "In range: < 180",
      "Elevated: ≥ 180",
    ],
    citation: "American Diabetes Association, Standards of Care in Diabetes-2026, Section 6: Glycemic Goals, Hypoglycemia, and Hyperglycemic Crises (Diabetes Care 2026;49(Suppl 1):S132-S149). Peak postprandial self-monitoring target: <180 mg/dL.",
    detail: [],
    references: [],
  },
  {
    slug: "homa-ir",
    section: "Metabolic",
    label: "Insulin resistance",
    purpose: "Insulin resistance, derived from glucose and insulin",
    note: "HOMA-IR is computed from this and your fasting glucose — enter both to see a result.",
    units: ["uIU/mL"],
    howTo: [],
    bands: [
      "Normal: HOMA-IR ≤ 1.85",
      "Elevated: HOMA-IR > 1.85",
    ],
    citation: "No universally accepted single cutoff exists for HOMA-IR — results vary by population, assay, and lab. This threshold is derived from a Spanish cohort; some populations, including South Asian, tend to show insulin resistance at somewhat lower absolute values (MDCalc/NHANES-referenced range approximately 1.4-2.5). Not part of any validated management algorithm — a screening signal, not a diagnosis.",
    detail: [],
    references: [],
  },
  {
    slug: "apo-b",
    section: "Heart",
    label: "ApoB",
    purpose: "The particles that carry cholesterol into artery walls",
    note: "ApoB counts atherogenic particles directly — one ApoB per LDL, IDL, VLDL and Lp(a) particle — so it captures risk that LDL-C alone can miss, particularly in insulin resistance and high triglycerides.",
    units: ["mg/dL"],
    howTo: [],
    bands: [
      "Optimal: ≤ 79",
      "Borderline: 80–99",
      "Elevated: > 99",
    ],
    citation: "ESC/EAS 2019 Guidelines for the Management of Dyslipidaemias (Mach F et al, Eur Heart J 2020;41:111-188). Risk-stratified ApoB goals: <65 mg/dL very-high risk, <80 mg/dL high risk, <100 mg/dL moderate risk. Verve screens against the <80 / <100 boundaries.",
    detail: [],
    references: [],
  },
  {
    slug: "ldl",
    section: "Heart",
    label: "LDL cholesterol",
    purpose: "Cholesterol on its way toward vessel walls",
    note: "LDL cholesterol measures the cholesterol carried by LDL particles, not the particle count itself. Where the two disagree, ApoB is the better risk marker.",
    units: ["mg/dL"],
    howTo: [],
    bands: [
      "Optimal: ≤ 99",
      "Borderline: 100–129",
      "Elevated: > 129",
    ],
    citation: "NCEP ATP III (Expert Panel on Detection, Evaluation, and Treatment of High Blood Cholesterol in Adults, JAMA 2001;285:2486-2497). LDL-C classification: optimal <100, near-optimal 100-129, borderline-high 130-159, high 160-189, very high >=190 mg/dL. Verve collapses the upper bands into one 'elevated' tier for screening.",
    detail: [],
    references: [],
  },
  {
    slug: "lpa",
    section: "Heart",
    label: "Lp(a)",
    purpose: "An inherited particle that adds risk on its own",
    note: "Lp(a) is ~90% genetically determined and stable through life — a single measurement is usually sufficient. Unit conversion between nmol/L and mg/dL is only approximate because it depends on apolipoprotein(a) isoform size; Verve stores the unit you entered and marks any converted value as approximate.",
    units: [],
    howTo: [],
    bands: [
      "Low: ≤ 74 nmol/L · ≤ 29 mg/dL",
      "Intermediate: 75–124 nmol/L",
      "High: > 124 nmol/L · > 49 mg/dL",
    ],
    citation: "EAS 2022 Consensus Statement on lipoprotein(a) (Kronenberg F et al, Eur Heart J 2022;43:3925-3946). Risk rises continuously; commonly cited bands are <75 nmol/L (~<30 mg/dL) low, 75-125 nmol/L (30-50 mg/dL) intermediate, >125 nmol/L (>50 mg/dL) high.",
    detail: [],
    references: [],
  },
  {
    slug: "hs-crp",
    section: "Heart",
    label: "hs-CRP",
    purpose: "Low-grade inflammation in blood vessels",
    note: "Values above 10 mg/L usually reflect acute infection or inflammation rather than chronic cardiovascular risk — the AHA/CDC statement advises discarding the result and re-testing once well.",
    units: ["mg/L"],
    howTo: [],
    bands: [
      "Low: < 1",
      "Average: 1–3",
      "High: > 3",
      "Re-test: ≥ 10",
    ],
    citation: "AHA/CDC Scientific Statement on markers of inflammation and cardiovascular disease (Pearson TA et al, Circulation 2003;107:499-511). Relative cardiovascular risk bands: <1.0 mg/L low, 1.0-3.0 mg/L average, >3.0 mg/L high.",
    detail: [],
    references: [],
  },
  {
    slug: "alm",
    section: "Muscle",
    label: "Lean Mass",
    purpose: "Muscle on your arms and legs, from a DXA scan",
    note: "Arms + legs lean mass, read straight off a DXA report — not Apple Health's lean mass, which is whole-body and roughly twice this. Judged as ALMI (ALM ÷ height²), the form EWGSOP2 writes its cut-offs against.",
    units: ["kg"],
    howTo: [
      "Open your DXA report and find the appendicular or arms+legs lean mass.",
      "It is the sum of the four limbs, in kilograms — not total lean mass.",
      "Enter that figure; Verve divides it by your height squared to get ALMI.",
    ],
    bands: [
      "In range: ≥ 21.4 kg",
      "Low: < 21.4 kg",
    ],
    citation: "EWGSOP2 (Cruz-Jentoft 2019) · AWGS 2019 (Chen 2020) for Asian cut-offs.",
    detail: [
      "EWGSOP2 does not define a cut-off for FFMI — fat-free mass index is not part of its algorithm at all. Its muscle-mass criterion is appendicular lean mass (ALM) and its height-indexed form, ALMI, measured by DXA. Appendicular means the limbs: EWGSOP2 isolates arm and leg lean mass because it reflects the skeletal muscle that carries strength and mobility, excluding trunk lean mass, which includes organs.",
      "The algorithm is sequential, and the order is the point: STRENGTH DEFINES IT, MASS CONFIRMS IT, PERFORMANCE GRADES IT. Low grip strength identifies PROBABLE sarcopenia; low ALM or ALMI CONFIRMS it; and low physical performance — gait speed or Timed Up and Go — grades it as SEVERE. Low muscle mass on its own is not sarcopenia under EWGSOP2, which is why Verve never reports it as such.",
      "EWGSOP2 thresholds. Grip strength: <27 kg men, <16 kg women — defines probable sarcopenia. ALM absolute: <20 kg men, <15 kg women — the alternative mass threshold, used when height is not on file. ALMI (ALM ÷ height², DXA): <7.0 kg/m² men, <5.5 kg/m² women — confirms. Gait speed (4 m usual pace): ≤0.8 m/s — severity. Timed Up and Go: ≥20 s — alternative to gait speed.",
      "The women's ALMI cut-off differs by guideline AND by measurement, and the two must not be mixed: EWGSOP2 reads <5.5 kg/m² by DXA, while AWGS reads <5.4 kg/m² by DXA and <5.7 kg/m² by BIA. Verve applies the DXA figure, because ALM is entered from a DXA report.",
    ],
    references: [
      "Cruz-Jentoft AJ, et al. Sarcopenia: revised European consensus on definition and diagnosis (EWGSOP2). Age and Ageing. 2019.",
      "Chen LK, et al. Asian Working Group for Sarcopenia: 2019 consensus update. JAMDA. 2020.",
      "Chen LK, Hsiao FY, Akishita M, et al. A focus shift from sarcopenia to muscle health in the Asian Working Group for Sarcopenia 2025 Consensus Update. Nature Aging. 2025.",
      "de Santana FM, Domiciano DS, Gonçalves MA, et al. Association of Appendicular Lean Mass, and Subcutaneous and Visceral Adipose Tissue With Mortality in Older Brazilians: The São Paulo Ageing & Health Study. Journal of Bone and Mineral Research. 2019.",
      "Westerterp KR, Yamada Y, Sagayama H, et al. Physical activity and fat-free mass during growth and in later life. The American Journal of Clinical Nutrition. 2021.",
      "Jagim AR, Harty PS, Jones MT, et al. Fat-Free Mass Index in Sport: Normative Profiles and Applications for Collegiate Athletes. Journal of Strength and Conditioning Research. 2024.",
      "Olshvang D, Harris C, Chellappa R, Santhanam P. Predictive modeling of lean body mass, appendicular lean mass, and appendicular skeletal muscle mass using machine learning techniques: NHANES and the Look AHEAD study. PLoS One. 2024.",
    ],
  },
  {
    slug: "handgrip",
    section: "Muscle",
    label: "Grip strength",
    purpose: "Whole-body strength, measured at the hand",
    note: "",
    units: ["kg"],
    howTo: [
      "Sit with your elbow at 90°, forearm neutral, wrist straight.",
      "Squeeze the dynamometer as hard as you can for 3 seconds.",
      "Take 3 attempts per hand with a short rest between.",
      "Enter your single best result from either hand.",
    ],
    bands: [
      "In range: ≥ 27 kg",
      "Low: < 27 kg",
    ],
    citation: "EWGSOP2 (Cruz-Jentoft 2019) — sarcopenia case-finding.",
    detail: [],
    references: [],
  },
  {
    slug: "body-fat",
    section: "Muscle",
    label: "Body fat",
    purpose: "Share of body mass that is fat",
    note: "From a DXA scan or a BIA smart scale.",
    units: ["%"],
    howTo: [],
    bands: [
      "In range: 8–24.9%",
      "Borderline: 25–28.9%",
      "Low: < 8%",
      "Elevated: ≥ 29%",
    ],
    citation: "ESPEN/EASO 2022 — sarcopenic obesity; WHO thresholds below age 40.",
    detail: [],
    references: [],
  },
  {
    slug: "skel-musc",
    section: "Muscle",
    label: "Muscle mass",
    purpose: "Share of body mass that is skeletal muscle",
    note: "Skeletal muscle percentage, as reported by a BIA scale.",
    units: ["%"],
    howTo: [],
    bands: [],
    citation: "Janssen et al. 2000 (NHANES) with BIA population survey norms.",
    detail: [],
    references: [],
  },
  {
    slug: "balance",
    section: "Muscle",
    label: "Single-leg balance",
    purpose: "How long you can stand on one leg",
    note: "",
    units: ["seconds"],
    howTo: [
      "Stand on one leg, eyes open, hands on hips or by your sides.",
      "Start timing when you lift the other foot clear of the floor.",
      "Stop when you put the foot down, hop, or grab support.",
      "Stand near a wall or chair you can reach for safety.",
    ],
    bands: [
      "Good: At or above the age norm",
      "Fair: Below the age norm",
      "Impaired: Under 10 s",
    ],
    citation: "Araujo et al. 2022 — 10-second one-leg stand and survival.",
    detail: [],
    references: [],
  },
  {
    slug: "chair-stand",
    section: "Muscle",
    label: "Chair stand",
    purpose: "Time to rise from a chair five times",
    note: "",
    units: ["seconds"],
    howTo: [
      "Use a standard chair against a wall; arms folded across your chest.",
      "Stand fully upright and sit back down — that is one repetition.",
      "Time 5 complete repetitions as fast as you safely can.",
    ],
    bands: [
      "Good: At or under the age norm",
      "Fair: Over the age norm",
      "Impaired: Over 15 s",
    ],
    citation: "EWGSOP2 — 5-repetition sit-to-stand.",
    detail: [],
    references: [],
  },
  {
    slug: "gait-speed",
    section: "Muscle",
    label: "Walk speed",
    purpose: "Your usual walking pace",
    note: "",
    units: ["m/s"],
    howTo: [
      "Mark a 4-metre straight course with clear space at both ends.",
      "Walk it at your usual comfortable pace, not a fast one.",
      "Divide 4 by your time in seconds to get metres per second.",
    ],
    bands: [
      "Good: ≥ 1.2 m/s",
      "Average: 1.0-1.2 m/s",
      "Below: 0.8-1.0 m/s",
      "Impaired: < 0.8 m/s",
    ],
    citation: "EWGSOP2 — usual-pace 4-metre gait speed.",
    detail: [],
    references: [],
  },
];
