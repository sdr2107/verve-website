/**
 * The fitness tier tables, and the words the sheet prints for the two
 * field-test equations. Written once here so the sheet's page, the A4
 * sheet and the Find-your-number tool cannot drift apart. The arithmetic
 * itself is in first-number.ts; the lines and examples here are built from it.
 *
 * The tables are the app's own: `data/met-thresholds.json` in the app repo,
 * `crfPerformanceCategories` (ages 40 and over) and `acsmCRFCategories`
 * (under 40). Copied on 2026-10-06; if the app's file changes, change this
 * one the same day. The equations are from `lib/calculations.ts` in the app.
 */

import { RUN_LINES, WALK_LINES, runExampleText, walkExampleText, tierIndex, type Sex } from "./first-number.ts";

/** The five categories, in order, as the app names them. */
export const TIER_LABELS = ["Low", "Below average", "Above average", "High", "Elite"] as const;

/** Short labels for a narrow table. */
export const TIER_SHORT = ["Low", "Below avg", "Above avg", "High", "Elite"] as const;

/**
 * One row per age band: the lower bound of each category in METs. The first
 * category runs from 0 to just under the second's lower bound; the last has
 * no ceiling. Lower bounds are what the app stores; the printed ranges are
 * derived (see `tierRanges`).
 */
export interface TierRow {
  age: string;
  /** Lower bound of Below average, Above average, High, Elite, in METs. */
  bounds: [number, number, number, number];
}

export const TIERS_MEN: TierRow[] = [
  { age: "20–29", bounds: [9.4, 10.4, 12.1, 13.3] },
  { age: "30–39", bounds: [9.0, 10.1, 11.7, 12.9] },
  { age: "40–49", bounds: [8.0, 10.0, 12.0, 14.0] },
  { age: "50–59", bounds: [7.0, 9.0, 11.0, 13.0] },
  { age: "60–69", bounds: [6.0, 8.0, 10.0, 12.0] },
  { age: "70+", bounds: [5.0, 7.0, 9.0, 11.0] },
];

export const TIERS_WOMEN: TierRow[] = [
  { age: "20–29", bounds: [6.7, 8.3, 9.4, 10.6] },
  { age: "30–39", bounds: [6.5, 7.7, 9.0, 10.2] },
  { age: "40–49", bounds: [6.0, 8.0, 10.0, 12.0] },
  { age: "50–59", bounds: [5.0, 7.0, 9.0, 11.0] },
  { age: "60–69", bounds: [4.0, 6.0, 8.0, 10.0] },
  { age: "70+", bounds: [3.5, 5.0, 7.0, 9.0] },
];

/** The five printed ranges for a row: "to 9.3", "9.4–10.3", …, "13.3+". */
export function tierRanges(row: TierRow): string[] {
  const [b1, b2, b3, b4] = row.bounds;
  const below = (n: number) => (Math.round((n - 0.1) * 10) / 10).toFixed(1);
  return [
    `to ${below(b1)}`,
    `${b1.toFixed(1)}–${below(b2)}`,
    `${b2.toFixed(1)}–${below(b3)}`,
    `${b3.toFixed(1)}–${below(b4)}`,
    `${b4.toFixed(1)}+`,
  ];
}

/** The table row for an age, or null under 20, where the tables do not reach. */
export function tierRowFor(sex: Sex, age: number): TierRow | null {
  if (!(age >= 20)) return null;
  const rows = sex === "female" ? TIERS_WOMEN : TIERS_MEN;
  const i = age >= 70 ? 5 : Math.floor((age - 20) / 10);
  return rows[Math.min(i, rows.length - 1)];
}

/**
 * Where a figure lands for a person: the row, the tier (0 to 4), its label,
 * and where the next tier starts. The figure is compared as it is printed,
 * to one decimal, which is how a person reads the table on the sheet.
 */
export function tierFor(sex: Sex, age: number, mets: number): { row: TierRow; index: number; label: string; next: { label: string; from: number; away: number } | null } | null {
  const row = tierRowFor(sex, age);
  if (!row) return null;
  const shown = Math.round(mets * 10) / 10;
  const index = tierIndex(row.bounds, shown);
  const next = index < 4 ? { label: TIER_LABELS[index + 1], from: row.bounds[index], away: Math.round((row.bounds[index] - shown) * 10) / 10 } : null;
  return { row, index, label: TIER_LABELS[index], next };
}

/** The study a row's tiers come from, short, for a caption. */
export const tierSourceShort = (age: number): string =>
  age >= 40 ? "Mandsager et al., JAMA Netw Open 2018" : "Cooper Institute and ACSM norms, 1997";

export const TIER_SOURCES = {
  over40: "Ages 40 and over: Mandsager K et al., JAMA Network Open, 2018, 122,007 patients at the Cleveland Clinic, treadmill tested.",
  under40: "Under 40: Cooper Institute and ACSM norms, 1997, VO2max ÷ 3.5.",
  meaning: "In the Cleveland Clinic study, below average rather than above carried about the same risk of dying as smoking or diabetes. A tier is a place in a table, and it moves.",
};

/** The Cooper 12-minute run (Cooper KH, JAMA, 1968), as the app computes it. The lines and the example are built from the arithmetic in first-number.ts. */
export const RUN = {
  lines: RUN_LINES,
  example: runExampleText().text,
  exampleMets: runExampleText().mets,
  source: "Cooper KH, JAMA, 1968.",
};

/** The six-minute walk, the line the app uses under 60 (Hong SH et al., 2019). Built from the same arithmetic. */
export const WALK = {
  lines: WALK_LINES,
  example: walkExampleText().text,
  exampleMets: walkExampleText().mets,
  source: "Hong et al., 2019, young adults. Over 60 the app uses a line that also takes height (Šagát et al., 2023).",
};

/** The retest window, as the app states it (thresholds file, crfRetestOutlook). */
export const RETEST =
  "Test again after about eight weeks of training. Sooner is hard to tell from a good or bad day (Hickson et al., 1981). That is the window the app uses.";

export const SAFETY =
  "A heart condition, chest pain on exertion, or told not to exert yourself? Walk, do not run, and ask your doctor first.";

/** Where the A4 sheet lives; linked from the welcome email, not from the page. */
export const SHEET_PDF = "/start/your-first-fitness-number.pdf";

/**
 * The sentence a person agrees to when they leave an address on the sheet's page. It
 * is stored with the row in newsletter_signups, so the record says what was
 * consented to, not just when. Change the wording here and the stored text
 * changes with it for new rows only.
 */
export const NEWSLETTER_CONSENT =
  "We use your address for the Verve newsletter, one letter a week, and for nothing else. Unsubscribe any time by replying to a letter.";
