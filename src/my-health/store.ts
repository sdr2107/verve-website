/**
 * The document store — the last document for each person, kept on the
 * device, so a return visit paints before the network answers
 * (docs/my-health-architecture.md, step 2).
 *
 * IndexedDB, one database, one object store, one row per account and
 * person: { doc, savedAt }. Everything here is best effort: a private
 * window, a blocked store or a quota error reads as "nothing kept" and
 * the page fetches as it would on a first visit. Nothing here decides a
 * reading; it only remembers what the function said last time.
 */
import type { MyHealthDocument } from "./document";

const DB = "my-health", STORE = "documents", VERSION = 1;
/** A document older than this is not painted; the fresh one is waited for. */
const MAX_AGE_MS = 30 * 86_400_000;

type Row = { key: string; doc: MyHealthDocument; savedAt: number };

const keyOf = (userId: string, personId: string) => `${userId}:${personId}`;

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then((db) => new Promise<T | null>((resolve) => {
    if (!db) return resolve(null);
    try {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => { db.close(); resolve(null); };
    } catch { db.close(); resolve(null); }
  }));
}

/** The document kept for this person, or null when none, or none young enough. */
export async function readDocument(userId: string, personId: string): Promise<MyHealthDocument | null> {
  const row = await run<Row | undefined>("readonly", (s) => s.get(keyOf(userId, personId)) as IDBRequest<Row | undefined>);
  if (!row?.doc || typeof row.savedAt !== "number") return null;
  if (Date.now() - row.savedAt > MAX_AGE_MS) return null;
  return row.doc;
}

/** Keep a document; never throws, never awaited by the page. */
export async function writeDocument(userId: string, personId: string, doc: MyHealthDocument): Promise<void> {
  await run("readwrite", (s) => s.put({ key: keyOf(userId, personId), doc, savedAt: Date.now() } as Row));
}

/** Drop the documents of people no longer on the account's list ("" is the account's own and always stays). */
export async function pruneDocuments(userId: string, keepPersonIds: string[]): Promise<void> {
  const keys = await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
  if (!keys) return;
  const keep = new Set(["", ...keepPersonIds].map((id) => keyOf(userId, id)));
  for (const k of keys) {
    const key = String(k);
    if (key.startsWith(`${userId}:`) && !keep.has(key)) await run("readwrite", (s) => s.delete(key));
  }
}

/** Forget everything of this account's: sign-out. */
export async function clearDocuments(userId: string): Promise<void> {
  const keys = await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
  for (const k of keys ?? []) if (String(k).startsWith(`${userId}:`)) await run("readwrite", (s) => s.delete(String(k)));
}

/** The same content, whenever each was generated. */
export function sameDocument(a: MyHealthDocument, b: MyHealthDocument): boolean {
  const strip = (d: MyHealthDocument) => JSON.stringify({ ...d, generated_at: "" });
  return strip(a) === strip(b);
}
