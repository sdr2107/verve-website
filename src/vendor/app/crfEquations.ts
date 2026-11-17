/**
 * The app's fitness-test equations, copied word for word from METTracker lib/calculations.ts at bb53b78 by
 * tools/sync-app-equations.mjs. DO NOT EDIT: change the app's file and run the script again.
 *
 * One equation for each test, wherever it is typed: the app's log, and the website's card for a test result. The table
 * of worked examples in tests/fixtures/crfEquationExamples.json is the app's own, and both repositories test against it.
 */

/**
 * Estimates VO₂Max and CRF from Bruce Protocol treadmill test duration.
 *
 * The Bruce Protocol is a standardised incremental treadmill test used in
 * clinical cardiology. Speed and grade increase every 3 minutes. The user
 * exercises to exhaustion; total time in minutes predicts VO₂Max.
 *
 * Formula (standard Bruce Protocol — men and women, mixed):
 *   VO₂Max (mL/kg/min) = 14.76 − (1.379 × T) + (0.451 × T²) − (0.012 × T³)
 *   CRF (METs)         = VO₂Max ÷ 3.5
 *
 * Where T = total test duration in minutes (typically 6–16 min).
 *
 * Rated ★★★★ — clinically validated, widely used in cardiology.
 * ✅ Safe for beta-blocker users (duration-based, not HR-based).
 *
 * Example: T = 10 min → VO₂Max = 14.76 − 13.79 + 45.1 − 12.0 = 34.1 → 9.7 METs
 *
 * @param durationMinutes Total treadmill test duration in minutes (1–20 valid range)
 * @returns Estimated CRF in METs (0 if invalid input)
 *
 * @source Bruce RA et al. "Exercising testing in adult normal subjects and
 *         cardiac patients." Pediatrics. 1963.
 *         Foster C et al. "Generalized equations for predicting functional
 *         capacity from treadmill performance." Am Heart J. 1984.
 */
export function estimateCRFFromBruceProtocol(durationMinutes: number): number {
  if (durationMinutes <= 0 || durationMinutes > 30) return 0;
  const T = durationMinutes;
  const vo2Max = 14.76 - (1.379 * T) + (0.451 * T * T) - (0.012 * T * T * T);
  return Math.round((Math.max(0, vo2Max) / 3.5) * 100) / 100;
}

/**
 * Estimates VO₂Max and CRF from the 6-Minute Walk Test (6MWT).
 *
 * The 6MWT measures the maximum distance a person can walk on a flat surface
 * in exactly 6 minutes. It is widely used in cardiac rehabilitation and
 * requires no equipment beyond a measured corridor and a timer.
 *
 * Age-stratified estimation cascade:
 *   Age ≥ 60 + height → Šagát 2023 (R² = 72.3%, SEE = 3.99, validated 60-80):
 *     VO₂Max = 59.44 − 3.83×sex − 0.56×age − 0.48×BMI + 0.04×distance
 *     (sex: 0 = male, 1 = female)
 *   Age < 60 (or ≥60 without height) → Hong 2019 (R² = 74.4%, SEE = 4.6):
 *     VO₂Max = 61.1 − 11.1×sex − 0.4×age − 0.2×weight + 0.02×distance
 *     (sex: 1 = male, 2 = female)
 *   No profile → Cahalin 1996 fallback (~55% R²):
 *     VO₂Max = 0.03 × distance + 3.98
 *
 * Rated ★★★★ — clinically validated, practical, no HR needed.
 * ✅ Fully safe for beta-blocker users.
 * ✅ Validated for cardiac, COPD, and elderly populations.
 *
 * @param distanceMetres Distance walked in 6 minutes (metres, typically 200–800m)
 * @param profile        Optional user profile for age-stratified equations
 * @returns { mets, vo2Max, source } — estimated CRF in METs, VO₂Max, and equation used
 *
 * @source Šagát P et al. "A Simple Equation to Estimate Maximal Oxygen Uptake
 *         in Older Adults Using the 6 min Walk Test, Sex, Age and Body Mass Index."
 *         J Clin Med. 2023;12(13):4476. PMC10342654.
 * @source Hong SH et al. "Prediction of VO₂max from 6MWT in young healthy adults."
 *         J Exerc Rehabil. 2019;15(6):833-838. PMC6926792.
 * @source Cahalin LP et al. "The six-minute walk test predicts peak oxygen
 *         uptake and survival in patients with advanced heart failure."
 *         Chest. 1996;110(2):325-32.
 */
export function estimateCRFFrom6MinuteWalk(
  distanceMetres: number,
  profile?: { age: number; sex: string; weightKg: number; heightCm?: number } | null
): { mets: number; vo2Max: number; source: "sagat2023" | "hong2019" | "cahalin1996" } {
  if (distanceMetres <= 0 || distanceMetres > 1500) {
    return { mets: 0, vo2Max: 0, source: "cahalin1996" };
  }

  // Šagát 2023 — age ≥ 60 with height available (validated 60-80, R² = 72.3%)
  if (
    profile &&
    profile.age >= 60 &&
    profile.age > 0 &&
    profile.weightKg > 0 &&
    profile.heightCm &&
    profile.heightCm > 0
  ) {
    const sexCode = profile.sex === "female" ? 1 : 0;
    const bmi = profile.weightKg / ((profile.heightCm / 100) ** 2);
    const vo2Max =
      59.44 -
      3.83 * sexCode -
      0.56 * profile.age -
      0.48 * bmi +
      0.04 * distanceMetres;
    const clamped = Math.max(0, vo2Max);
    const mets = Math.round((clamped / 3.5) * 100) / 100;
    return { mets, vo2Max: Math.round(clamped * 10) / 10, source: "sagat2023" };
  }

  // Hong 2019 — age < 60 or ≥ 60 without height (R² = 74.4%)
  if (profile && profile.age > 0 && profile.weightKg > 0) {
    const sexCode = profile.sex === "female" ? 2 : 1;
    const vo2Max =
      61.1 -
      11.1 * sexCode -
      0.4 * profile.age -
      0.2 * profile.weightKg +
      0.02 * distanceMetres;
    const clamped = Math.max(0, vo2Max);
    const mets = Math.round((clamped / 3.5) * 100) / 100;
    return { mets, vo2Max: Math.round(clamped * 10) / 10, source: "hong2019" };
  }

  // Cahalin 1996 fallback — distance-only (~55% R²)
  const vo2Max = 0.03 * distanceMetres + 3.98;
  const mets = Math.round((Math.max(0, vo2Max) / 3.5) * 100) / 100;
  return { mets, vo2Max: Math.round(vo2Max * 10) / 10, source: "cahalin1996" };
}

/**
 * Rockport 1-Mile Walk Test — Kline et al. 1987 (Med Sci Sports Exerc).
 *
 * The person walks 1 mile as briskly as they can sustain, then records the
 * finish time and their heart rate immediately at the finish. A submaximal
 * test — the missing rung between the 6MWT and the maximal runs, for people
 * who can sustain walking but not yet running. Validated r ≈ 0.88,
 * SEE ≈ 5 mL/kg/min.
 *
 * Formula:
 *   VO₂Max (mL/kg/min) = 132.853 − (0.0769 × weight_lb) − (0.3877 × age)
 *                        + (6.315 × sex) − (3.2649 × time_min) − (0.1565 × HR)
 *   sex: male = 1, female = 0 · weight in pounds · HR at finish (bpm)
 *
 * Requires age, sex, and body weight — the equation has no distance-only
 * fallback, so returns 0 when the profile or inputs are incomplete/out of range.
 *
 * @param timeMinutes  Time to walk 1 mile (minutes; 8–30 valid)
 * @param endHeartRate Heart rate at the finish (bpm; 60–220 valid)
 * @param profile      { age, sex, weightKg } — all required
 * @source Kline GM et al. "Estimation of VO2max from a one-mile track walk."
 *         Med Sci Sports Exerc. 1987.
 */
export function estimateCRFFrom1MileWalk(
  timeMinutes: number,
  endHeartRate: number,
  profile?: { age: number; sex: string; weightKg: number } | null,
): { mets: number; vo2Max: number; source: "kline1987" } {
  if (
    timeMinutes < 8 || timeMinutes > 30 ||
    endHeartRate < 60 || endHeartRate > 220 ||
    !profile || !profile.age || profile.age <= 0 ||
    !profile.weightKg || profile.weightKg <= 0
  ) {
    return { mets: 0, vo2Max: 0, source: "kline1987" };
  }

  const sexCode  = profile.sex === "female" ? 0 : 1;
  const weightLb = profile.weightKg * 2.20462;
  const vo2Max =
    132.853
    - 0.0769 * weightLb
    - 0.3877 * profile.age
    + 6.315  * sexCode
    - 3.2649 * timeMinutes
    - 0.1565 * endHeartRate;
  const clamped = Math.max(0, vo2Max);
  return {
    mets:   Math.round((clamped / 3.5) * 100) / 100,
    vo2Max: Math.round(clamped * 10) / 10,
    source: "kline1987",
  };
}

/**
 * Estimates VO₂Max and CRF from the Cooper 12-Minute Run Test.
 *
 * The participant runs/walks to cover the maximum distance possible in exactly
 * 12 minutes. Distance covered predicts VO₂Max — a maximal field test.
 *
 * Formula (Cooper 1968):
 *   VO₂Max (mL/kg/min) = (distance_metres − 504.9) / 44.73
 *   CRF (METs)         = VO₂Max ÷ 3.5
 *
 * Rated ★★★★ — highest correlation with lab VO₂Max among field tests
 * (r = 0.87–0.92 in young adults). ✅ HR-independent, safe on beta-blockers,
 * BUT requires maximal effort — not for deconditioned or at-risk users.
 * Bias note: tends to under-estimate at low fitness, over-estimate at high.
 *
 * Example: 2400 m → (2400 − 504.9) / 44.73 = 42.4 mL/kg/min → 12.1 METs
 *
 * @param distanceMetres Distance covered in 12 minutes (metres; 400–5000 valid)
 * @returns { mets, vo2Max } — 0 when input is out of range
 *
 * @source Cooper KH. "A means of assessing maximal oxygen intake." JAMA. 1968.
 */
export function estimateCRFFromCooperRun(
  distanceMetres: number,
): { mets: number; vo2Max: number } {
  if (distanceMetres < 400 || distanceMetres > 5000) return { mets: 0, vo2Max: 0 };
  const vo2Max = (distanceMetres - 504.9) / 44.73;
  const clamped = Math.max(0, vo2Max);
  return {
    mets:   Math.round((clamped / 3.5) * 100) / 100,
    vo2Max: Math.round(clamped * 10) / 10,
  };
}

/**
 * Estimates VO₂Max and CRF from a 1.5-mile (2414 m) timed run.
 *
 * The participant runs 1.5 miles as fast as possible; faster time predicts a
 * higher VO₂Max — a maximal field test with a fixed distance.
 *
 * Primary (George et al. 1993 — requires body weight, R² ≈ 0.79):
 *   VO₂Max = 88.02 + 3.716×sex − 0.0753×weight_lb − 2.767×time_min
 *   (sex: 1 = male, 0 = female)
 * Fallback (weight unavailable):
 *   VO₂Max = 483 ÷ time_min + 3.5   (distance/time approximation)
 *   CRF (METs) = VO₂Max ÷ 3.5
 *
 * Rated ★★★★ — high correlation with lab VO₂Max (r = 0.79–0.87). ✅ HR-
 * independent, safe on beta-blockers, BUT requires maximal effort.
 *
 * Example: male, 70 kg, 12.0 min →
 *   88.02 + 3.716 − 0.0753×154.3 − 2.767×12 = 46.9 mL/kg/min → 13.4 METs
 *
 * @param timeMinutes Total run time in decimal minutes (5–25 valid)
 * @param profile     Optional — enables the weight-based George equation
 * @returns { mets, vo2Max, source } — 0 when input is out of range
 *
 * @source George JD, Vehrs PR, Allsen PE, et al. "VO₂max estimation from a
 *         1.5-mile endurance run." Med Sci Sports Exerc. 1993;25(3):401-6.
 */
export function estimateCRFFrom1_5MileRun(
  timeMinutes: number,
  profile?: { sex: string; weightKg: number } | null,
): { mets: number; vo2Max: number; source: "george1993" | "generic" } {
  if (timeMinutes < 5 || timeMinutes > 25) return { mets: 0, vo2Max: 0, source: "generic" };

  if (profile && profile.weightKg > 0) {
    const sexCode = profile.sex === "female" ? 0 : 1;
    const weightLb = profile.weightKg * 2.20462;
    const vo2Max = 88.02 + 3.716 * sexCode - 0.0753 * weightLb - 2.767 * timeMinutes;
    const clamped = Math.max(0, vo2Max);
    return {
      mets:   Math.round((clamped / 3.5) * 100) / 100,
      vo2Max: Math.round(clamped * 10) / 10,
      source: "george1993",
    };
  }

  const vo2Max = 483 / timeMinutes + 3.5;
  const clamped = Math.max(0, vo2Max);
  return {
    mets:   Math.round((clamped / 3.5) * 100) / 100,
    vo2Max: Math.round(clamped * 10) / 10,
    source: "generic",
  };
}
