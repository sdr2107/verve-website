/**
 * What a test account is shown about what goes with its horizon: where the horizon stands in time, and which of a
 * row's sentences that calls for (canvas "Verve, Horizon as a programme", board 25).
 *
 * NOTHING IS OFFERED HERE AND NO WORD OF IT IS IN THIS FILE. The sentences, the amounts and the names of the buttons
 * are one row in `programme_panels`, keyed "offer", which only an account in `programme_testers` can read. This file
 * holds the arithmetic that picks among them: how many full weeks are behind, whether the date has come, which of two
 * sentences the counts call for, and the dates a sentence may name. With no row, nothing is drawn anywhere.
 *
 * NOTHING IS TAKEN OR GIVEN. There is no till behind any of it: a button the row names is drawn switched off, with
 * the row's own words saying so. Nothing here writes to the database.
 *
 * Not yet in the arithmetic, and said in WIRING.md: which readings count (a device's or a filed report's, not a typed
 * one) and a lock on the numbers and the date from the day a horizon is kept. The counts are the page's own
 * (./facts.ts), read today.
 *
 * Pure; tests/offer.test.mjs.
 */
import { addDays } from "../derive/format.ts";
import { addMonths, dayMonthLong, horizonSpans, type HorizonLike } from "./derive.ts";
import type { Facts } from "./facts.ts";

/** The row keyed "offer". Every part is optional; a part that is not there is not drawn. */
export type OfferLine = { head?: string; text?: string; tag?: string };
export type OfferBody = {
  /** The part of the plan's weeks, and of the calls, that counts as kept (0 to 1). */
  share?: number;
  /** How many months from the day a horizon was set a sentence may name as {free_to}. */
  months?: number;
  /** On the last page of the set-up, above the button that keeps the horizon. */
  setup?: { head?: string; lines?: string[]; link?: string };
  /** Under Settings, while the horizon runs. */
  page?: { lead?: string; rows?: OfferLine[]; how_head?: string; how?: string[]; none?: string; foot?: string };
  /** Shown once, by itself, when `after` full weeks are behind. `row` is the line it leaves under Settings. */
  week?: { after?: number; kicker?: string; title?: string; text?: string; yes?: string; no?: string; off?: string; foot?: string; row?: OfferLine; waiting?: OfferLine };
  /** On the horizon's date: one of two blocks, and one line on the horizon itself. */
  date?: {
    /** `text_weeks` is said in place of `text` when it is the plan's weeks, not the targets, that read kept. */
    reached?: { head?: string; text?: string; text_weeks?: string; figure?: string; small?: string; button?: string; sums?: string; off?: string };
    not?: { head?: string; text?: string };
    line?: string; go?: string;
  };
};
export const isOfferBody = (x: unknown): x is OfferBody => !!x && typeof x === "object" && !Array.isArray(x);

/** Full weeks of the horizon that have ended. A paused week is not a full week, so it is not one of them. */
export const fullWeeksDone = (h: HorizonLike, today: string): number => horizonSpans(h).filter((s) => s.full && s.to < today).length;
/** The date has come. */
export const onTheDate = (h: HorizonLike, today: string): boolean => today >= h.ends_on;
/** The row's `week` part is due: that many full weeks are behind, and the date has not come. */
export const weekDue = (h: HorizonLike, today: string, after: number | undefined): boolean =>
  typeof after === "number" && after > 0 && !onTheDate(h, today) && fullWeeksDone(h, today) >= after;

/**
 * Which of the date's two blocks the counts call for. Every judged target reads reached at a steady weight pace, or
 * the plan's weeks were kept; and, where a coach's calls are part of the horizon, the calls were kept too. With
 * nothing judged yet there is no verdict.
 */
export function verdictOf(facts: Facts, a: { calls: boolean }): "reached" | "not" | null {
  if (facts.targets_ok == null && facts.plan_ok == null) return null;
  const callsOk = !a.calls || facts.calls_ok !== false;
  return (facts.targets_ok === true || facts.plan_ok === true) && callsOk ? "reached" : "not";
}

/**
 * The dates a sentence may name, as words: {starts} the day the horizon was set, {ends} its date, {free_to} `months`
 * after the start, moved a week for every week set aside (a pause moves the date, and this with it), {weeks_done}.
 */
export function offerDates(h: HorizonLike, today: string, months: number | undefined): Facts {
  const paused = horizonSpans(h).filter((s) => s.paused).length;
  const freeTo = typeof months === "number" && months > 0 ? addDays(addMonths(h.starts_on, Math.round(months)), paused * 7) : null;
  return { starts: dayMonthLong(h.starts_on), ends: dayMonthLong(h.ends_on), free_to: freeTo ? dayMonthLong(freeTo) : null, weeks_done: fullWeeksDone(h, today) };
}

// ── shown once ────────────────────────────────────────────────────────────────
// The week's sheet is shown one time on a browser. That is kept in the browser, not on the account: nothing about it
// is decided or owed, so there is nothing for the account to hold yet.
const seenKey = (horizonId: string) => `verve-horizon-week-sheet-${horizonId}`;
export function weekSheetSeen(horizonId: string): boolean {
  try { return localStorage.getItem(seenKey(horizonId)) === "1"; } catch { return false; }
}
export function markWeekSheetSeen(horizonId: string): void {
  try { localStorage.setItem(seenKey(horizonId), "1"); } catch { /* a private window: it is shown again next time */ }
}
