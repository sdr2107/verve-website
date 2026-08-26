/**
 * Body-marker explainers — GENERATED. Do not edit by hand.
 *
 * Written by scripts/gen-marker-explainers.mjs in the Verve app repo, from
 * lib/markers.ts. That file is what the app classifies readings with, so the
 * thresholds printed here cannot drift from the ones a reader was just shown
 * on their phone. Edit the marker definition and regenerate.
 *
 * Ranges shown for a 50-year-old man; several move with sex, age or ancestry.
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
}

export const BODY_MARKER_CONTEXT = "Ranges shown for a 50-year-old man; several move with sex, age or ancestry.";

export const BODY_MARKERS: BodyMarkerExplainer[] = [
  {
    slug: "glucose",
    section: "Metabolic",
    label: "Blood sugar",
    purpose: "Fasting blood sugar, and your three-month average",
    note: "Enter either or both — they satisfy the same criterion independently.",
    units: ["mg/dL", "%"],
    howTo: [],
    bands: [
      "In range: < 100 mg/dL · < 5.7%",
      "Elevated: ≥ 100 mg/dL · ≥ 5.7%",
    ],
    citation: "Alberti et al. 2009 — harmonised metabolic syndrome criteria.",
  },
  {
    slug: "bp",
    section: "Metabolic",
    label: "Blood pressure",
    purpose: "Systolic over diastolic, seated and rested",
    note: "",
    units: ["mmHg"],
    howTo: [
      "Rest quietly for 5 minutes first — back supported, feet flat, legs uncrossed.",
      "Support your arm on a table so the cuff sits at heart level.",
      "No caffeine, exercise, or smoking in the 30 minutes before.",
      "Take 2 readings a minute apart and enter the average.",
      "Use the same arm each time you measure.",
    ],
    bands: [
      "In range: < 130 / 85",
      "Elevated: ≥ 130 / 85",
    ],
    citation: "Alberti et al. 2009 — harmonised metabolic syndrome criteria.",
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
      "In range: < 102 cm",
      "Elevated: ≥ 102 cm",
    ],
    citation: "IDF 2006 ethnicity-adjusted cutoffs.",
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
      "In range: Below the age cut",
      "High: Above the age cut",
    ],
    citation: "",
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
    citation: "",
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
  },
];
