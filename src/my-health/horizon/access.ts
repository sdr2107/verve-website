/**
 * What an account may do on Horizon, in the page's words. Pure, so
 * tests/horizon-errors.test.mjs can read it without a client; the call is
 * in ./api.ts (fetchAccess), and the decision is the horizon function's.
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
