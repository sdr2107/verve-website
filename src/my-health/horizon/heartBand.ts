/**
 * A person's zone 2 in beats a minute, for the plan's Intensity card (canvas "Verve, the plan you follow", board 03;
 * the founder, 25 November 2026: "we should show it being implemented to the user based on his own fitness level").
 *
 * THIS IS A COPY OF THE APP'S RULE, NOT A SECOND ONE. The Verve app credits a session's zone 2 minutes against one
 * band (METTracker lib/zone2.ts calculateZone2Range, called by lib/liveZone2Range.ts), and the minutes the plan
 * counts are those minutes. So the range the page prints must be that band, worked out from the same four answers
 * of the person's own profile row, in the same order:
 *
 *   1. a tested band (a CPET or a lactate test typed into the app), when it is sane: both rates between 30 and 230,
 *      the upper above the lower. It replaces the estimate.
 *   2. otherwise Karvonen's reserve: resting + 40% to resting + 60% of (maximum − resting), each rounded;
 *      maximum = 208 − 0.7 × age (Tanaka 2001), rounded;
 *      resting = the profile's resting rate when it is between 30 and 140, else 60, and the page says 60 was assumed.
 *   3. the age is the one the app uses: counted from the date of birth when the profile holds one (METTracker
 *      lib/age.ts ageFromDateOfBirth: a calendar comparison, the birthday moves it on the day), else the stored age.
 *   4. the profile's "Heart-rate medication" answer (on_beta_blockers): the app then measures intensity by the effort
 *      the person rates and uses no heart-rate band. The page does the same: no beats, effort words only.
 *
 * Where this file goes further than the app: the app falls back to an age of 35 when the profile has none, because it
 * must credit minutes against something. A page that printed "your range" from an age nobody gave would be stating a
 * guess as the person's own figure, so with no age (and no tested band) there is no range here: null.
 *
 * Change the rule in the app first, then here; tests/heart-band.test.mjs holds the figures the app's own function
 * gives for the same answers.
 *
 * Pure, no DOM, no fetch.
 */

/** The answers the band is made from: the person's own row of `profiles`, as the app wrote it. */
export type HeartProfile = {
  age?: number | null; date_of_birth?: string | null; resting_hr?: number | null; on_beta_blockers?: boolean | null;
  zone2_low_hr?: number | null; zone2_high_hr?: number | null;
};
export type HeartBand = {
  /** Zone 2, beats a minute. */ low: number; high: number;
  /** "tested": the band the person typed from a test. "estimated": from age and resting rate. */ source: "tested" | "estimated";
  /** The maximum the estimate used (Tanaka); null for a tested band. */ max: number | null;
  /** The resting rate the estimate used; null for a tested band. */ rest: number | null;
  /** The profile held no usable resting rate, so 60 was used, as the app does. */ restAssumed: boolean;
};
/** What the Intensity card is given. */
export type Heart =
  | { kind: "beats"; band: HeartBand }
  /** The person told the app their heart rate is not a guide for them: intensity goes by effort. */
  | { kind: "effort" }
  /** Nothing to make a range from: no profile row, or no age on it. */
  | { kind: "none"; why: "no-profile" | "no-age" };

export const ZONE2_RESERVE_LOW = 0.4;
export const ZONE2_RESERVE_HIGH = 0.6;
export const DEFAULT_RESTING_HR = 60;
const num = (x: unknown): number | null => (x != null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null);

/** Age on a day, from a date of birth: the app's lib/age.ts ageFromDateOfBirth. Null when the date is missing or unreadable. */
export function ageOn(dob: string | null | undefined, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob ?? "").trim());
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(today ?? ""));
  if (!m || !t) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const before = +t[2] < mo || (+t[2] === mo && +t[3] < d);
  return +t[1] - y - (before ? 1 : 0);
}

/** The band alone, by the app's rule; null with no tested band and no age. */
export function heartBandOf(p: HeartProfile | null | undefined, today: string): HeartBand | null {
  if (!p) return null;
  const lo = num(p.zone2_low_hr), hi = num(p.zone2_high_hr);
  if (lo != null && hi != null && lo > 30 && hi > lo && hi < 230) return { low: Math.round(lo), high: Math.round(hi), source: "tested", max: null, rest: null, restAssumed: false };
  const stored = num(p.age);
  const age = ageOn(p.date_of_birth, today) ?? (stored != null && stored > 0 ? stored : null);
  if (age == null || !(age > 0) || age > 120) return null;
  const max = Math.round(208 - 0.7 * age);
  const r = num(p.resting_hr);
  const measured = r != null && r > 30 && r < 140;
  const rest = measured ? r! : DEFAULT_RESTING_HR;
  const reserve = max - rest;
  return { low: Math.round(rest + ZONE2_RESERVE_LOW * reserve), high: Math.round(rest + ZONE2_RESERVE_HIGH * reserve), source: "estimated", max, rest, restAssumed: !measured };
}

/** What the card is given: effort when the app was told so, else the band, else why there is none. */
export function heartOf(p: HeartProfile | null | undefined, today: string): Heart {
  if (!p) return { kind: "none", why: "no-profile" };
  if (p.on_beta_blockers === true) return { kind: "effort" };
  const band = heartBandOf(p, today);
  return band ? { kind: "beats", band } : { kind: "none", why: "no-age" };
}

// ── the card's words: fixed, every figure counted above ──

/** What zone 2 feels like, and what harder feels like: the plan's own two sentences (guidePlan.ts tiles), said once here. */
export const STEADY_FEEL = "You can talk in full sentences.";
export const HARDER_FEEL = "Talking is broken into phrases.";
/** "108 to 131 beats a minute" */
export const beatsWords = (b: Pick<HeartBand, "low" | "high">) => `${b.low} to ${b.high} beats a minute`;
/** Where the range comes from, in one line under the card. */
export function heartSource(h: Heart): string | null {
  if (h.kind === "effort") return "Guided by effort, not by heart rate, as you set in the app. A session's zone comes from the effort you rate after it.";
  if (h.kind === "none") return h.why === "no-age" ? "Your age is not on your profile, so the range in beats cannot be worked out. Add it in the app, under Settings, then Profile." : null;
  const b = h.band;
  if (b.source === "tested") return "The range you typed into the app from a test. The app counts your zone 2 minutes against the same range.";
  return `40 to 60% of your heart-rate reserve: a maximum of ${b.max} for your age, less ${b.rest} at rest${b.restAssumed ? " (no resting rate is on your profile, so 60 is assumed, as the app does)" : ""}. The app counts your zone 2 minutes against the same range. The maximum is an estimate from age alone, so the range can be some beats out for you.`;
}
/** For someone whose heart rate is not a guide: where the app keeps that answer. The label is the app's own (Settings, Profile). */
export const EFFORT_WHERE = "Is heart rate not a guide for you? Some medicines hold it down. The app has an answer for that: Settings, then Profile, then \"Heart-rate medication\". The plan then goes by effort, and shows no beats.";
