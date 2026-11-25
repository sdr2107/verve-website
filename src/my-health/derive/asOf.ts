/**
 * asOf.ts — when a person's figures were last sent by the app, and when the
 * page should read them again. Pure; no DOM, no fetch.
 *
 * The page read a person's figures when it opened and kept them until a
 * reload, and nothing on it said how old they were. A walk the app had and
 * the cloud did not yet have left the app's Movement card and the Horizon's
 * targets disagreeing at the same minute (the founder, 25 November 2026:
 * "they do not seem to match ? how can the horizon then be reliable ?").
 * Two things answer that here: the page says when its figures are from, and
 * a return to the tab reads them again.
 *
 * tests/as-of.test.mjs runs this under node.
 */

/**
 * The latest moment the app wrote this person's weeks: the newest
 * `synced_at` among the rows the app writes (source "sync"; the app stamps
 * every row it sends on every sync, METTracker lib/weekRowSync). Null when
 * the app has written none: there is then nothing to date.
 */
export function lastAppSync(weeks: readonly { source?: unknown; synced_at?: unknown }[] | null | undefined): string | null {
  let best: number | null = null;
  for (const w of weeks ?? []) {
    if (!w || w.source !== "sync" || !w.synced_at) continue;
    const t = new Date(String(w.synced_at)).getTime();
    if (Number.isFinite(t) && (best == null || t > best)) best = t;
  }
  return best == null ? null : new Date(best).toISOString();
}

const dayKey = (d: Date, tz?: string) => d.toLocaleDateString("en-CA", tz ? { timeZone: tz } : undefined);

/**
 * "today at 20:41", "yesterday at 07:12", "on Saturday 21 November": in the
 * reader's own zone, unless one is given (the tests give one).
 */
export function asOfWords(iso: string, now: Date, tz?: string): string {
  const at = new Date(iso);
  const zone = tz ? { timeZone: tz } : {};
  const time = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, ...zone });
  const day = dayKey(at, tz);
  if (day === dayKey(now, tz)) return `today at ${time}`;
  if (day === dayKey(new Date(now.getTime() - 86_400_000), tz)) return `yesterday at ${time}`;
  return `on ${at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", ...zone })}`;
}

/**
 * The line under a person's figures: when they are from and, for the person
 * whose page it is, how to bring them up to date. Null when the app has
 * never synced.
 */
export function asOfLine(iso: string | null, now: Date, owner: boolean, tz?: string): string | null {
  if (!iso) return null;
  const when = `Figures as of the app's last sync, ${asOfWords(iso, now, tz)}.`;
  return owner ? `${when} Open the app to send what is new.` : when;
}

/** The shortest gap between two reads when the tab comes back to the front. */
export const REREAD_MIN_MS = 60_000;

/**
 * Whether a return to the tab should read the person's figures again: the
 * tab is showing, someone is signed in, a document is in hand, no field has
 * the caret (a redraw would take the words being typed), and the last read
 * is at least a minute old.
 */
export function rereadDue(a: { visible: boolean; signedIn: boolean; hasDocument: boolean; typing: boolean; nowMs: number; lastMs: number; minMs?: number }): boolean {
  if (!a.visible || !a.signedIn || !a.hasDocument || a.typing) return false;
  return a.nowMs - a.lastMs >= (a.minMs ?? REREAD_MIN_MS);
}
