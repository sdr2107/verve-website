/**
 * One question, one request.
 *
 * My health draws itself more than once as it starts: several views mount, the person becomes known, the fresh
 * document arrives. Each of those used to ask the server the same thing again: one load sent the plan's question
 * four times, the horizons' twice, and "can the Guide's plan be kept" three times (measured 20 November 2026).
 * On a server that is sometimes slow to answer a page's worth of requests, that is load it did not need.
 *
 * `shared` lets callers that ask while an answer is on its way wait for that answer. Nothing is kept once it has
 * arrived: the next caller asks again, so a write is never followed by an old answer. A failure is shared by the
 * callers who were waiting and by nobody after them.
 *
 * `fresh` is for the one answer that is kept for a few seconds on purpose (the plan, which the Horizon view asks for
 * again each time the page redraws). Pure; tests/once.test.mjs.
 */

/** The answer already on its way for this key, or a new ask that the next callers will share until it settles. */
export function shared<T>(going: Map<string, Promise<unknown>>, key: string, ask: () => Promise<T>): Promise<T> {
  const waiting = going.get(key) as Promise<T> | undefined;
  if (waiting) return waiting;
  // started inside a promise, so an ask that throws at once is a rejection and not an exception in the caller
  const mine: Promise<T> = (async () => ask())().finally(() => { if (going.get(key) === mine) going.delete(key); });
  going.set(key, mine);
  return mine;
}

/** An ask that must not join one already on its way (after a write: the answer has to be younger than the write). Later callers share this one. */
export function anew<T>(going: Map<string, Promise<unknown>>, key: string, ask: () => Promise<T>): Promise<T> {
  going.delete(key);
  return shared(going, key, ask);
}

export type Kept<T> = { at: number; value: T } | null;
/** A kept answer while it is younger than `forMs`; undefined once it is older, or when the clock has gone backwards. */
export function fresh<T>(kept: Kept<T>, forMs: number, now: number = Date.now()): T | undefined {
  return kept && now >= kept.at && now - kept.at < forMs ? kept.value : undefined;
}
