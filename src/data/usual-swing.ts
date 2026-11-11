/**
 * A copy of the app's data/met-thresholds.json#usualSwing (METTracker): how far
 * two results from one person can differ with nothing having changed. In depth
 * reads it to say whether a change between two reports is more than that. A
 * module so Node's test runner and the Astro build read it alike (the same
 * discipline body-thresholds.ts and lipid-ratios.ts keep). Copied 11 November
 * 2026; regenerate from the app's file when it changes. Do not edit by hand.
 */
export default {
  "_note": "How far two results from one person can differ with nothing having changed: the reference change value of laboratory medicine. The website's In depth page (My health) says, for each blood marker, whether the change between two reports is more than this, and the Guide is told the same figures so it never calls a difference inside them a rise or a fall. Descriptive only: never a target, never a reading of health. 11 Nov 2026.",
  "formula": "swing % = 2.77 x sqrt(CVa^2 + CVi^2), the two-sided 95 % reference change value. CVi is the published within-person biological variation. CVa is the laboratory's own imprecision, which differs by laboratory and is an ASSUMPTION stated per marker (measured only where the study reports it). hs-CRP is skewed, so its figure is worked on the log scale: sd = sqrt(ln(CVi^2 + 1) + ln(CVa^2 + 1)), rise = exp(1.96 x sqrt(2) x sd) - 1, fall = 1 - exp(-1.96 x sqrt(2) x sd).",
  "readAs": "Below swingLowPct: inside the usual swing. Between the two: at its edge. Above swingHighPct: more than the usual swing. The two differ only where a marker's figure depends on how the laboratory arrived at it.",
  "assumes": "The person was in a steady state and the two samples were taken alike (fasting, time of day, recent illness). A different laboratory or method widens the swing by an amount this file does not hold.",
  "markers": {
    "ldlC": {
      "cviPct": 8.7,
      "cviPctCalculated": 9.3,
      "cvaAssumedPct": 3,
      "swingLowPct": 25.5,
      "swingHighPct": 27.1,
      "source": "Alkan Baylan F, Ozcan M, Ercan S, Ciriz A, Avci E, Ercan M. Biological variation estimates of direct and indirect LDL cholesterol by Friedewald and Martin-Hopkins formulas in healthy individuals. Scand J Clin Lab Invest 2025;86(1):1-8. 26 healthy adults, ten weekly samples, in duplicate: within-person variation 8.7 % measured directly, 9.3 % by Friedewald, 9.0 % by Martin-Hopkins.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/41443929/",
      "note": "The low figure is a directly measured LDL, the high one a calculated (Friedewald) LDL. One small study; the EuBIVAS lipid paper (Aarsand 2018, PMID 29941472) reports that LDL's within-person variation did not come out lower than older estimates, which agrees with it."
    },
    "apoB": {
      "cviPct": 6.7,
      "cvaPct": 1.5,
      "swingLowPct": 19.0,
      "swingHighPct": 19.0,
      "source": "Clouet-Foraison N, Marcovina SM, Guerra E, et al. Analytical performance specifications for lipoprotein(a), apolipoprotein B-100, and apolipoprotein A-I using the biological variation model in the EuBIVAS population. Clin Chem 2020;66(5):727-736. 91 healthy adults, ten weekly samples, six European laboratories.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/32353129/",
      "note": "The within-person figure (6.7 %, 95 % CI 6.4 to 7.0) and the analytical figure (1.5 %) are from the paper's tables, not its abstract. The paper's own one-directional figures are -14.7 % and +17.3 %."
    },
    "hba1c": {
      "cviPct": 1.2,
      "cvaAssumedLowPct": 1,
      "cvaAssumedHighPct": 3,
      "swingLowPct": 4.3,
      "swingHighPct": 9.0,
      "source": "Ricos C, Fernandez-Calle P, Gonzalez-Lao E, et al. Critical appraisal and meta-analysis of biological variation studies on glycosylated albumin, glucose and HbA1c. Adv Lab Med 2020;1(3):20200029. Within-person variation of HbA1c 1.2 % (0.3 to 2.5) in healthy adults.",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/37361503/",
      "note": "A per cent of the value, not percentage points: at an HbA1c of 5.7 % it is about 0.2 to 0.5 points. The spread is the laboratory's own imprecision, 1 % to 3 %."
    },
    "fastingGlucose": {
      "cviPct": 5.0,
      "cvaAssumedPct": 2,
      "swingLowPct": 14.9,
      "swingHighPct": 14.9,
      "source": "Ricos C, Fernandez-Calle P, Gonzalez-Lao E, et al. Critical appraisal and meta-analysis of biological variation studies on glycosylated albumin, glucose and HbA1c. Adv Lab Med 2020;1(3):20200029. Within-person variation of fasting glucose 5.0 % (4.1 to 12.0).",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/37361503/",
      "note": "A laboratory's venous sample. A finger-prick meter is less precise and its swing is wider."
    },
    "hsCRP": {
      "cviPct": 44,
      "cvaAssumedPct": 5,
      "logScale": true,
      "risePct": 224,
      "fallPct": 69,
      "source": "Gough A, Sitch A, Ferris E, Marshall T. Within-subject variation of C-reactive protein and high-sensitivity C-reactive protein: a systematic review and meta-analysis. PLoS One 2024;19(11):e0304961. 60 studies, 26 of them of hs-CRP: median within-person variation of hs-CRP 44 % (range 27 % to 76 %).",
      "pubmed": "https://pubmed.ncbi.nlm.nih.gov/39485740/",
      "note": "A second result has to be more than about three times the first, or under about a third of it, before it is more than the usual swing. The review's authors warn that the estimates rest on few people and few repeats."
    },
    "lpa": {
      "trend": false,
      "note": "Largely inherited and steady through life (see cardiovascularMarkers.lpa): shown once, never drawn as a trend and never given a change."
    }
  },
  "notHeld": "Triglycerides, HDL, total cholesterol, ApoA1, fasting insulin and remnant cholesterol: no figure was verified against its paper, so the page says none is on file and describes the two results without judging the gap."
} as const;
