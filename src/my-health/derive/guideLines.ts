/**
 * The Guide's read, the parts that are rules and not drawing (canvas "Verve,
 * one story in four parts", board 05): which marker a line is about, how the
 * read is headed, and what the Guide will not do. Pure, so `npm test` holds them.
 */
import { MARKERS, MARKER_BY_KEY, type MarkerKey } from "../horizon/derive.ts";

/**
 * The marker a line is about, when the function did not say (reads from before 11 Nov 2026): the first of these its
 * words name. The key is one Horizon can hold as a target (horizon/derive MARKERS), so the line's two doors lead somewhere.
 */
const MARKER_WORDS: [RegExp, MarkerKey][] = [
  [/triglycer/i, "triglycerides"], [/apo ?b\b/i, "apob"], [/remnant/i, "remnant"], [/\bldl\b|cholesterol/i, "ldl"], [/hba1c|a1c/i, "hba1c"], [/glucose|blood sugar/i, "fasting_glucose"], [/hs-?crp|c-reactive/i, "hs_crp"],
  [/blood pressure|systolic/i, "bp"], [/strength|resistance/i, "strength_week"], [/zone 2/i, "zone2_week"], [/fitness|vo2|\bmets\b|cooper|walk test/i, "mets"],
  [/\bdose\b|met-min|volume|sessions?|workouts?|activity/i, "dose"], [/hrv/i, "hrv"], [/resting heart|resting rate/i, "rhr"], [/recovery/i, "hrr"], [/sleep|bedtime/i, "sleep"],
  [/steps/i, "steps"], [/waist/i, "waist"], [/body fat/i, "body_fat"], [/weight/i, "weight"], [/muscle|lean mass/i, "almi"],
];
/** The keys the function may tag a line with: the markers a target can be set on. Sent with the working, so the tag is one of a fixed list. */
export const MARKER_KEYS = MARKERS.map((m) => m.key).join(" ");
/** The marker a line is about: the function's own tag when it is one of the list, else the first marker its words name, else none. */
export const markerOf = (c: { marker?: unknown; topic?: unknown; text?: unknown; headline?: unknown } | null | undefined): MarkerKey | null => {
  const said = String(c?.marker ?? "");
  if (MARKER_BY_KEY[said]) return said as MarkerKey;
  const words = `${c?.topic ?? ""} ${c?.headline ?? ""} ${c?.text ?? ""}`;
  return MARKER_WORDS.find(([re]) => re.test(words))?.[1] ?? null;
};
const COUNT_WORDS = ["Nothing stands", "One thing stands", "Two things stand", "Three things stand"];
/** "Three things stand out": the read's heading, by how many it raised. */
export const standOut = (n: number) => `${COUNT_WORDS[Math.max(0, Math.min(3, Math.round(n) || 0))]} out`;
/** What the Guide will not do: said on the page, and held by the function's rules. */
export const WILL_NOT = ["Name a condition.", "Say why a figure moved.", "Tell you what to do.", "Use a number that is not on your page."];
