/**
 * Fitness, one card, two units (canvas "My health, redesigned", board 12).
 * A MET is VO₂ divided by 3.5; the two are one measurement. The tier shown
 * is the app's own stored category; the five bands of the strip come from
 * src/data/fitness-tiers.ts for the person's age and sex, never typed here.
 */
import { TIERS_MEN, TIERS_WOMEN, TIER_LABELS, TIER_SHORT, tierRanges, type TierRow } from "../../data/fitness-tiers.ts";

export const VO2_CAVEAT = "Estimated by your wearable; such estimates miss the lab figure by 7 to 16 % on average.";

/** The row of the tier table for this age and sex; under 20 reads the 20–29 row, an unknown sex the men's. */
export function tierRowFor(age: number | null | undefined, sex: string | null | undefined): TierRow {
  const rows = String(sex ?? "").toLowerCase() === "female" ? TIERS_WOMEN : TIERS_MEN;
  const a = Number(age) || 0;
  const i = a >= 70 ? 5 : a >= 60 ? 4 : a >= 50 ? 3 : a >= 40 ? 2 : a >= 30 ? 1 : 0;
  return rows[i];
}
/** Where a METs figure sits in a row: 0 low … 4 elite. */
export function tierIndexOf(mets: number, row: TierRow): number {
  const [b1, b2, b3, b4] = row.bounds;
  return mets >= b4 ? 4 : mets >= b3 ? 3 : mets >= b2 ? 2 : mets >= b1 ? 1 : 0;
}
/** The app's stored category ("aboveAverage", "above-average", "Above average"…) as an index; null when it says nothing. */
export function tierIndexFromCategory(cat: unknown): number | null {
  const k = String(cat ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return k === "low" ? 0 : k === "belowaverage" ? 1 : k === "aboveaverage" ? 2 : k === "high" ? 3 : k === "elite" ? 4 : null;
}
/** "Above average for your age and sex" */
export const tierWords = (i: number, self = true) => `${TIER_LABELS[i]} for ${self ? "your" : "their"} age and sex`;
export const tierShort = (i: number) => TIER_SHORT[i];
/** The five printed ranges of a row, "to 7.9", "8.0–9.9", … */
export const tierRangeWords = (row: TierRow) => tierRanges(row);
/** METs from a test row: the stored capacity, else VO₂max ÷ 3.5. */
export const metsOfTest = (c: any): number | null => c == null ? null : c.met_capacity != null ? Number(c.met_capacity) : c.vo2max != null ? Number(c.vo2max) / 3.5 : c.v != null ? Number(c.v) / 3.5 : null;
export const vo2OfTest = (c: any): number | null => c == null ? null : c.vo2max != null ? Number(c.vo2max) : c.v != null ? Number(c.v) : c.met_capacity != null ? Number(c.met_capacity) * 3.5 : null;
