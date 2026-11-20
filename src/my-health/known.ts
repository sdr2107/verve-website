/**
 * What the page already knows about the signed-in account, kept in this browser between visits: whether it is on
 * the list of test accounts, and the plan as the server last said it.
 *
 * Why: both answers used to arrive some seconds after every load, and until they did the page read "Free" and told
 * a test account that its own pages held nothing for it (the founder's recordings, 20 November 2026). A reload
 * began the wait again. Now the page opens on the last answer and asks again behind it.
 *
 * Neither answer opens anything by itself. A test account's pages are filled from rows that only the database
 * gives to a test account, and Pro is decided by the server on every call that needs it. A wrong value here can
 * only draw an empty page, or a stale label for a moment.
 *
 * Pure but for the storage it is handed; tests/known.test.mjs.
 */
import { type PlanInfo, parsePlan } from "./account.ts";

export type Known = { tester?: boolean; plan?: PlanInfo };
export type KnownStore = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

/** Where the page stands on the question "is this a test account": not answered yet, answered, or could not be asked. */
export type AskState = "asking" | "known" | "failed";

const keyOf = (uid: string) => `mh-known-${uid}`;
function browserStore(): KnownStore | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

/** What the last visit learned about this account. Anything that is not the shape written below reads as nothing. */
export function recall(uid: string, store: KnownStore | null = browserStore()): Known {
  if (!uid || !store) return {};
  try {
    const o = JSON.parse(store.getItem(keyOf(uid)) ?? "null");
    if (!o || typeof o !== "object") return {};
    const out: Known = {};
    if (typeof o.tester === "boolean") out.tester = o.tester;
    const plan = parsePlan(o.plan);
    if (plan) out.plan = plan;
    return out;
  } catch { return {}; }
}

/** Keep an answer for the next visit. What is already kept and is not in the patch stays. */
export function remember(uid: string, patch: Known, store: KnownStore | null = browserStore()): void {
  if (!uid || !store) return;
  try { store.setItem(keyOf(uid), JSON.stringify({ ...recall(uid, store), ...patch })); }
  catch { /* private mode, or the store is full: the page asks again next time */ }
}

/** Signing out, or deleting the account: nothing about it stays in this browser. */
export function forget(uid: string, store: KnownStore | null = browserStore()): void {
  if (!uid || !store) return;
  try { store.removeItem(keyOf(uid)); } catch { /* fine */ }
}

/** The words a test account's page shows in place of its content, while the question is open or after it failed. */
export function waitingWords(state: AskState, nothing: string): string {
  if (state === "asking") return "Checking this account…";
  if (state === "failed") return "Could not check this account just now. Reload the page to try again.";
  return nothing;
}
