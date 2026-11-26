/**
 * A founding member's twelve weeks, and the week after them (26 November 2026).
 *
 * The founder gives a founding member Pro and Horizon free for 12 weeks, then one more week of continuity, by
 * setting one last day on the list (METTracker supabase/migrations/20261125_founding_members.sql: the day they are
 * added plus 91). Nothing else is stored: the day the 12 free weeks ended is that last day less seven.
 *
 * In those last seven days the person reads one sentence, on their horizon's page, in Settings beside the plan
 * line, and in Monday's email. It is the same sentence in all three because all three ask this file: the horizon
 * function takes it verbatim (METTracker tools/sync-horizon-web.sh), as it takes the rest of Horizon's arithmetic.
 *
 * What comes after the last day is not written here: the founder has not set it (a monthly place in his community
 * is the idea; no price, so no line and no button).
 *
 * Pure: days in, words out. No clock, no zone, no DOM. tests/founding.test.mjs.
 */

/** The free weeks a founding member is given. */
export const FOUNDING_FREE_WEEKS = 12;
/** The days after them in which everything is kept. */
export const CONTINUITY_DAYS = 7;
/** From the day a member is added to the list's last day: 12 weeks and the week of continuity. */
export const FOUNDING_DAYS = FOUNDING_FREE_WEEKS * 7 + CONTINUITY_DAYS;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A day, some days on or back, read as a calendar date and never as a moment in a zone. */
export const shiftDay = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** "18 February", with the year only when it is not today's: as the plan line writes its date (../account.ts longDay). */
export const writtenDay = (day: string, today: string): string => {
  const words = new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  return day.slice(0, 4) === today.slice(0, 4) ? words : `${words} ${day.slice(0, 4)}`;
};

export type Continuity = { /** The day the 12 free weeks ended. */ endedOn: string; /** The last day everything is kept. */ until: string };

/**
 * Whether a founding member is in the week of continuity today, and its two dates. `through` and `until` are the
 * plan as the server says it (the horizon function's `plan` answer, or the database's listed_pro()); `until` may be
 * a day or a moment on that day. Null for anyone else, before the week, and after the last day.
 */
export function foundingContinuity(a: { through?: string | null; until?: string | null; today: string }): Continuity | null {
  if (a.through !== "founding" || !a.until) return null;
  const until = String(a.until).slice(0, 10);
  if (!DAY.test(until) || !DAY.test(a.today)) return null;
  const endedOn = shiftDay(until, -CONTINUITY_DAYS);
  return a.today > endedOn && a.today <= until ? { endedOn, until } : null;
}

/** The one sentence of that week; null outside it. */
export function continuityLine(a: { through?: string | null; until?: string | null; today: string }): string | null {
  const c = foundingContinuity(a);
  return c ? `Your ${FOUNDING_FREE_WEEKS} free weeks ended on ${writtenDay(c.endedOn, a.today)}. You keep everything until ${writtenDay(c.until, a.today)}.` : null;
}
