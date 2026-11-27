/**
 * The horizons this browser was last given for an account and a person, so Horizon draws at once on a return visit
 * (the founder, 27 November 2026: "the app is slow to load at places and glitches").
 *
 * Measured that day in his browser: on one load every call to the database took about fourteen seconds and came back
 * together, then under half a second each. The Overview had drawn within a second, from the document the page keeps
 * on the device (../store.ts); Horizon kept nothing, so it stood empty for fifteen. This is the same idea for
 * Horizon: what the server last said is kept, the page opens on it, and the fresh answer replaces it when it lands.
 *
 * THE SAME RULE AS THE DOCUMENT'S (../store.ts readDocument, sameDay): only a copy kept TODAY is drawn. An older one
 * is not painted at all, so a figure never changes under the reader's eyes; the fresh answer is waited for instead,
 * as on a first visit.
 *
 * WHOSE: one row an account and a person, the account's id in the key, so another account's copy is never read. It is
 * dropped with everything else the page keeps when the account signs out or is deleted (../known.ts forget).
 *
 * NOTHING HERE DECIDES ANYTHING. It is what the server said last time, shown until the server says it again. While it
 * is all the page has, nothing that writes may be pressed (views/Horizon.tsx `waiting`).
 *
 * localStorage, not the document's IndexedDB: it is read in the same turn the page draws, with no wait at all, and
 * what is kept is small (a few horizons, their targets, plan and check-ins). Pure but for the storage it is handed;
 * tests/horizon-kept.test.mjs runs it under node.
 */
import type { HorizonFull } from "./api.ts";

export type KeptStore = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; readonly length?: number; key?(i: number): string | null };
/** What is kept: the horizons as the server gave them, and whether the Guide's plan could be kept for this project (it decides what a week "asks"). */
export type KeptHorizons = { horizons: HorizonFull[]; guide: boolean };

const PREFIX = "mh-horizons-";
const keyOf = (uid: string, personId: string) => `${PREFIX}${uid}:${personId}`;
function browserStore(): KeptStore | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
/** A horizon as the page reads it: enough of its shape to be drawn, or it is not one. */
const isHorizon = (h: any): boolean => !!h && typeof h === "object" && typeof h.id === "string" && typeof h.title === "string"
  && typeof h.starts_on === "string" && typeof h.ends_on === "string" && Array.isArray(h.targets) && Array.isArray(h.checkins);

/**
 * The copy kept for this account and person, when it was kept today. Null for anything else: nothing kept, another
 * day's copy, a private window, or a row that is not the shape written below.
 */
export function readKept(uid: string | null | undefined, personId: string | null | undefined, today: string, store: KeptStore | null = browserStore()): KeptHorizons | null {
  if (!uid || !personId || !store) return null;
  try {
    const o = JSON.parse(store.getItem(keyOf(uid, personId)) ?? "null");
    if (!o || typeof o !== "object" || o.v !== 1 || o.day !== today || !Array.isArray(o.horizons) || !o.horizons.every(isHorizon)) return null;
    return { horizons: o.horizons as HorizonFull[], guide: o.guide === true };
  } catch { return null; }
}

/** Keep the server's answer for the next visit today. Never throws: a private window or a full store keeps nothing. */
export function writeKept(uid: string | null | undefined, personId: string | null | undefined, today: string, kept: KeptHorizons, store: KeptStore | null = browserStore()): void {
  if (!uid || !personId || !store) return;
  try { store.setItem(keyOf(uid, personId), JSON.stringify({ v: 1, day: today, guide: kept.guide === true, horizons: kept.horizons })); }
  catch { /* nothing is kept: the next visit waits for the server, as a first one does */ }
}

/** Forget everything kept for this account, every person of it: signing out, or deleting the account. */
export function forgetKept(uid: string | null | undefined, store: KeptStore | null = browserStore()): void {
  if (!uid || !store || typeof store.length !== "number" || typeof store.key !== "function") return;
  try {
    const mine: string[] = [];
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith(`${PREFIX}${uid}:`)) mine.push(k); }
    for (const k of mine) store.removeItem(k);
  } catch { /* fine */ }
}
