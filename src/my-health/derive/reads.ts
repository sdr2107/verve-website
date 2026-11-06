/**
 * A stored read's "Due" sentence, and when it may be shown. Pure.
 *
 * A read is text the Guide wrote from the page's working on the day it was
 * asked for. Until 6 Nov 2026 that working carried a retest phrase for every
 * lab marker, so the read's "Due" sentence could name a lab on a cadence
 * ("the lipid panel is due in March"). When to test a lab again is a
 * clinician's call, not a wellness product's: the working stopped sending
 * lab timing that day, and the sentences already written are not shown.
 *
 * The sentence cannot be split into its lab part and its fitness-test part,
 * so the rule is by date: a read written on or after DUE_LINE_FROM shows its
 * sentence (it can only speak of the app's own two reminders); an older one
 * does not, and neither does a read whose date is unknown. The day the
 * change landed is treated as before it, since a date cannot split a day.
 */
export const DUE_LINE_FROM = "2026-11-07";

/** The sentence to show for a read written on `writtenOn` (an ISO date or timestamp), or "" for none. */
export function dueLineOf(due: unknown, writtenOn: string | null | undefined): string {
  const text = String(due ?? "").trim();
  if (!text) return "";
  return String(writtenOn ?? "").slice(0, 10) >= DUE_LINE_FROM ? text : "";
}
