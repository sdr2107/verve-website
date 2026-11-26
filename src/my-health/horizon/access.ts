/**
 * What an account may do on Horizon, in the page's words. Pure, so
 * tests/horizon-errors.test.mjs can read it without a client; the call is
 * in ./api.ts (fetchAccess), and the decision is the horizon function's.
 *
 * The horizon function takes this file verbatim, with the rest of Horizon's arithmetic: it must not reach for the
 * browser, and it imports nothing.
 */

/**
 * What the account may do on Horizon, from the function's `plan` action: Pro, or the one free week a Free account
 * has (one horizon, seven days from the day it is set, with the plan, the Monday check-in and one question).
 * Null when the function cannot say (an older deploy, offline): the page then behaves as it did before.
 */
export type HorizonAccess = {
  pro: boolean;
  free: { /** No horizon has ever been set: the free week is still theirs to start. */ available: boolean; /** When the free week ends, or ended. */ until: string | null; /** It is running now. */ running: boolean };
  asks: { /** Questions a week on Pro; the one free question on Free. */ limit: number; left: number };
};
export function parseAccess(x: unknown, nowMs = Date.now()): HorizonAccess | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, any>;
  if ((o.plan !== "pro" && o.plan !== "free") || !o.horizon_free || typeof o.horizon_free !== "object") return null;
  const until = typeof o.horizon_free.until === "string" && o.horizon_free.until ? o.horizon_free.until : null;
  const limit = Number(o.asks?.limit), used = Number(o.asks?.used);
  return {
    pro: o.plan === "pro",
    free: { available: o.horizon_free.available === true, until, running: !!until && Date.parse(until) > nowMs },
    asks: { limit: Number.isFinite(limit) ? limit : 0, left: Number.isFinite(limit) && Number.isFinite(used) ? Math.max(0, limit - used) : 0 },
  };
}

// ── who has Horizon at all (26 November 2026) ──

/**
 * Whether Horizon is offered to everyone. Off from 26 November 2026 (the founder: Horizon is for the founding
 * members of his community for now). While it is off:
 *   - the landing page, How it works, Help and the sign-in card say nothing of Horizon (../../data/story.ts tells
 *     the story in three parts);
 *   - inside My health the Horizon tab and every door to it are drawn only for an account that has Horizon
 *     (hasHorizon below: one of Verve's own, a founding member, or a person who already has a horizon);
 *   - /horizon shows its five questions to those accounts only;
 *   - the horizon function starts a new horizon only where maySetHorizon below says so. It takes this file verbatim
 *     (METTracker tools/sync-horizon-web.sh), so this is not only a matter of what is drawn.
 * Turn it on the day Horizon is offered, then copy this file to the function again and deploy it: every surface
 * and the server read this one value. It hides; it is not a secret (the words are in the page's source and in
 * this public repository).
 */
export const HORIZON_PUBLIC = false;

/**
 * A horizon the page can show: one that is open, or one read to its date (closed, with its final read). A horizon
 * stopped under the old "Stop this horizon" (closed, no final read) is drawn nowhere, so it opens no door.
 */
export const isShownHorizon = (h: { closed_at?: string | null; checkins?: { kind?: string | null }[] | null }): boolean =>
  !h.closed_at || !!h.checkins?.some((c) => c?.kind === "final");

/**
 * Whether Horizon is drawn at all for the person on the page. While Horizon is not offered to everyone it is for an
 * account the programme is on for (one of Verve's own, or a founding member not past their day) and for a person who
 * already has a horizon to show, so nobody loses what they started and a coach still reads a client's. Everyone
 * else has no tab, no door and no mention of it.
 */
export function hasHorizon(a: { /** Horizon is offered to everyone. */ open: boolean; /** The programme is on for the signed-in account. */ programme: boolean; /** The horizons of the person on the page that can be shown. */ horizons: number }): boolean {
  return a.open || a.programme || a.horizons > 0;
}

/**
 * Whether a new horizon may be set: by its owner, and while Horizon is not offered to everyone only for an account
 * the programme is on for. The page asks it before it draws "Set a horizon", and the horizon function's `start`
 * asks it before it writes, so the two cannot disagree. A person who only keeps a horizon they set before is shown
 * no "Set another".
 */
export function maySetHorizon(a: { open: boolean; programme: boolean; owner: boolean }): boolean {
  return a.owner && (a.open || a.programme);
}

/**
 * What a person reads where the plan would be once their Pro has ended and Horizon is not offered to everyone: no
 * price and no button, because there is nothing to buy yet. Their horizon is not taken away.
 */
export const HORIZON_KEPT = "Your horizon stays here to read, with its targets and your readings. The Guide's plan and the Monday check-in have stopped, and Horizon is not open to new members at the moment.";
