/**
 * The rules the Guide's plan on Horizon is worked out from (canvas "Verve,
 * the Guide's plan", board 06, 13 November 2026). Every figure the plan
 * uses is here, with where it comes from and how well it has been checked.
 * "source" is what the page shows a person. "checked" is for whoever
 * maintains this file and is not shown: whether the source itself was read,
 * a brief of it, or only a second-hand account. A rule marked second-hand
 * is to be read in the original before its words are relied on.
 *
 * The plan is arithmetic over these rules and the person's own weeks. It
 * sets no target and changes none: the targets are the person's.
 *
 * A module so Node's test runner, the Astro build and the horizon edge
 * function (which copies this file) read it alike. The figures that the app
 * also holds (zone 2, the dose, the retest, the screening, the pressure)
 * are copies of METTracker data/met-thresholds.json; change them there first.
 */
export default {
  tiers: {
    /** Fitness under this, in METs, is the first tier: build volume before intensity. */
    secondFromMets: 9,
    thirdFromMets: 14,
    firstHrrPct: 50,
    secondHrrLowPct: 65,
    secondHrrHighPct: 85,
    label: "Intensity by fitness tier",
    source: "Verve, \"How to Know If Your Exercise Routine Is Actually Improving Your Fitness\" (10 August 2026), which rests on Ross R, Blair SN, Arena R, et al. Importance of Assessing Cardiorespiratory Fitness in Clinical Practice: A Case for Fitness as a Clinical Vital Sign. Circulation 2016.",
    checked: "Read from the article. The AHA statement has not been read for these cut-points.",
  },
  zone2: {
    hrrLowPct: 40,
    hrrHighPct: 60,
    label: "Zone 2 is 40 to 60% of heart-rate reserve",
    source: "Karvonen's method of heart-rate reserve; Swain DP et al, 1994. The same rule as the Verve app.",
    checked: "In the app's code (METTracker lib/zone2.ts).",
  },
  aerobic: {
    minDays: 3,
    maxDays: 5,
    minSessionMin: 20,
    maxSessionMin: 60,
    label: "Three to five aerobic days, 20 to 60 minutes a session",
    source: "Myers J, et al. Exercise Prescriptions for Cardiovascular Health in Adults: 2026 ACC Scientific Statement. J Am Coll Cardiol 2026. DOI 10.1016/j.jacc.2026.09.008.",
    checked: "From a brief of the paper's PDF.",
  },
  dose: {
    lowMetMin: 500,
    highMetMin: 1000,
    /** The guideline's own equivalence: 150 moderate or 75 vigorous minutes for the low figure. */
    moderateMinForLow: 150,
    vigorousMinForLow: 75,
    label: "A dose of 500 to 1,000 MET-minutes a week",
    source: "The same ACC statement, and the 2018 Physical Activity Guidelines for Americans.",
    checked: "In the app's thresholds (data/met-thresholds.json#weeklyGoals).",
  },
  progression: {
    /** Minutes of zone 2 added in a week. */
    zone2StepMin: 10,
    /** Harder minutes taken out in a week, in the first tier, while zone 2 climbs. */
    harderEaseMin: 5,
    /** Harder minutes are never eased under this: the guideline's vigorous figure. */
    harderFloorMin: 75,
    label: "Ten more minutes a week; volume before intensity",
    source: "ACSM's Guidelines for Exercise Testing and Prescription: add five to ten minutes a session every week or two over the first four to six weeks. Volume before intensity: the Verve article above.",
    checked: "Second-hand: read in secondary sources only. How the plan moves after a short week (the same zone 2 minutes asked again, a step back after two, a week won back when the next figure is reached as well) is the plan's own rule, not a published one: it never asks for more than the ten-minute step.",
  },
  strength: {
    minDays: 2,
    maxDays: 4,
    setsLow: 1,
    setsHigh: 3,
    repsLow: 8,
    repsHigh: 12,
    /** For someone older or out of training. */
    easyRepsLow: 10,
    easyRepsHigh: 15,
    /** The plan's weeks with the lower sets, for someone lifting less than twice a week before it. */
    lowSetsWeeks: 4,
    label: "Strength for the major muscle groups on at least two days",
    source: "The same ACC statement: 1 to 3 sets of 8 to 12 repetitions (10 to 15 for older or deconditioned adults) at 40 to 60% of one-repetition maximum, progressing to 60 to 80%.",
    checked: "From a brief of the paper's PDF. The plan's translation of a share of one-repetition maximum into \"a load you could lift so many times\" is approximate.",
  },
  layouts: {
    /** Splits are offered only from this many strength days a week. */
    splitFromDays: 3,
    label: "Whole body at two days; splits from three or four",
    source: "American College of Sports Medicine position stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009. PMID 19204579.",
    checked: "Second-hand: a newer edition exists. To be read in the original.",
  },
  retest: {
    weeks: 8,
    label: "Test fitness again after eight weeks",
    source: "Hickson RC et al, 1981: fitness adapts over six to nine weeks. The same rule as the Verve app.",
    checked: "In the app's thresholds (data/met-thresholds.json#crfRetestCadence).",
  },
  screening: {
    activeDays: 3,
    activeMonths: 3,
    /** Weeks before harder minutes return for someone who was not active and has no disease or symptom. */
    harderAfterWeeks: 4,
    label: "Three questions before the first plan",
    source: "Riebe D, Franklin BA, Thompson PD, et al. Updating ACSM's Recommendations for Exercise Preparticipation Health Screening. Med Sci Sports Exerc 2015.",
    checked: "In the app's thresholds (data/met-thresholds.json#preparticipationScreening). The plan follows the paper's own table: someone active with a known disease and no symptom keeps moderate work without a doctor's word; the app's test gate is stricter. The paper itself could not be opened on 14 November 2026 (paywalled). Read that day in Whitfield GP et al, Med Sci Sports Exerc 2017 (DOI 10.1249/MSS.0000000000001331), which applies the algorithm: risk factors are not assessed, medication for hypertension is not considered, and peripheral vascular disease is part of the cardiovascular history. Still from memory of the algorithm's footnote, to be read in the original: that metabolic disease means diabetes, type 1 and 2, and that cardiovascular disease includes cerebrovascular disease (the second question's plain words rest on both). Two differences from the original, not yet changed: it defines active as at least 30 minutes of moderate exercise on at least three days a week for three months, where the first question asks only for three days; and its list of signs and symptoms is longer than the third question's four (it adds palpitations, ankle swelling, leg pain on walking, breathlessness lying down or at night, a known heart murmur, unusual fatigue).",
  },
  pressure: {
    systolic: 180,
    diastolic: 110,
    label: "No harder minutes at a resting pressure of 180/110 or more",
    source: "ACSM's Guidelines for Exercise Testing and Prescription, 11th edition. The same line the Verve app holds for hard tests.",
    checked: "In the app's thresholds (data/met-thresholds.json#maximalTestSafety).",
  },
  metPerMinute: {
    /** The share of the reserve a minute is counted at: the middle of zone 2. */
    zone2Share: 0.5,
    /** An assumption: a harder minute in the first tier is counted at 70% of the reserve. */
    harderShare: 0.7,
    /** The middle of the second tier's 65 to 85%. */
    secondTierShare: 0.75,
    label: "What a planned minute adds to the dose",
    source: "A minute at a share of heart-rate reserve is counted at 1 + share x (fitness in METs - 1): heart-rate reserve tracks oxygen-uptake reserve (Swain DP, Leutholtz BC, 1997). With no fitness test on file the guideline's own equivalence is used (150 moderate or 75 vigorous minutes for 500 MET-minutes).",
    checked: "The 70% figure is the plan's assumption, not a published one. The dose of a planned week is an estimate; the app measures the real one.",
  },
} as const;
