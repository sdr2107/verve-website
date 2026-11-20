/**
 * The weekly letter's calls. Drafts are rows the list's reader writes and reads under the database's own rules
 * (METTracker supabase/migrations/20261122_letters.sql): an account that is not the reader is answered with
 * nothing. Seeing a letter, testing it and sending it go through the `letter` function, which holds the sender's
 * key and checks the reader again for itself.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase.ts";
import type { Audience, Checks, Counts, Letter, Words } from "./letter.ts";

const COLS = "id, subject, preheader, body, created_at, updated_at, tested_at, tested_hash, send_started_at, send_finished_at, to_count";

/** Every letter, newest first. null: they could not be read just now (or the database has no such table yet). */
export async function readLetters(sb: SupabaseClient): Promise<Letter[] | null> {
  try {
    const { data, error } = await sb.from("letters").select(COLS).order("created_at", { ascending: false }).limit(200);
    return error || !Array.isArray(data) ? null : (data as unknown as Letter[]);
  } catch { return null; }
}
/** Keep the words: a new draft, or the one being written. A string is why it was not kept. */
export async function keepDraft(sb: SupabaseClient, id: string | null, w: Words): Promise<Letter | string> {
  try {
    const q = id ? sb.from("letters").update(w).eq("id", id) : sb.from("letters").insert(w);
    const { data, error } = await q.select(COLS).maybeSingle();
    if (error) return error.message;
    return data ? (data as unknown as Letter) : "This letter has already begun to go, so its words cannot change.";
  } catch (e) { return e instanceof Error ? e.message : "Could not keep it."; }
}
export async function dropDraft(sb: SupabaseClient, id: string): Promise<boolean> {
  try { const { error } = await sb.from("letters").delete().eq("id", id); return !error; } catch { return false; }
}
export async function readCounts(sb: SupabaseClient): Promise<Counts[]> {
  try { const { data, error } = await sb.rpc("letter_counts"); return error || !Array.isArray(data) ? [] : (data as Counts[]); } catch { return []; }
}
export async function readAudience(sb: SupabaseClient): Promise<Audience | null> {
  try {
    const { data, error } = await sb.rpc("letter_audience");
    const r = (Array.isArray(data) ? data[0] : data) as Audience | null;
    return error || !r ? null : { confirmed: Number(r.confirmed ?? 0), waiting: Number(r.waiting ?? 0), stopped: Number(r.stopped ?? 0) };
  } catch { return null; }
}

async function call(sb: SupabaseClient, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; out: any }> {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/letter`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token ?? ""}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    return { ok: resp.ok, status: resp.status, out: await resp.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, out: {} }; }
}
const why = (status: number, out: any, fallback: string): string =>
  status === 0 ? "Could not reach the server. Check your connection and try again."
  : status === 404 ? "The sender is not switched on yet."
  : status === 403 ? String(out?.error ?? "This account may not do that.")
  : typeof out?.error === "string" && out.error && !/^[a-z_]+$/.test(out.error) ? out.error : fallback;

/** The letter as it will arrive, drawn by the function, and what can be checked before anything is sent. */
export async function seeIt(sb: SupabaseClient, w: Words): Promise<{ html: string; checks: Checks } | string> {
  const { ok, status, out } = await call(sb, { action: "preview", ...w });
  return ok && typeof out?.html === "string" && out.checks ? { html: out.html, checks: out.checks as Checks } : why(status, out, "Could not draw it just now.");
}
/** One copy, to the signed-in account's own address, or to `to` when that is a confirmed address on the list. */
export async function sendTest(sb: SupabaseClient, id: string, to?: string): Promise<{ tested_hash: string } | string> {
  const { ok, status, out } = await call(sb, { action: "test", letter_id: id, ...(to ? { to } : {}) });
  return ok && typeof out?.tested_hash === "string" ? { tested_hash: out.tested_hash } : why(status, out, "The test did not go.");
}
export type SendAnswer =
  | { kind: "going"; done: boolean; to: number; left: number; stopped: string | null }
  | { kind: "count_changed"; now: number }
  | { kind: "test_first" }
  | { kind: "failed"; why: string };
/** Send, or send to the rest. `count` is the number the person typed; the database checks it is the number there is. */
export async function sendLetter(sb: SupabaseClient, id: string, count: number): Promise<SendAnswer> {
  const { ok, status, out } = await call(sb, { action: "send", letter_id: id, count });
  if (ok) return { kind: "going", done: !!out.done, to: Number(out.to ?? 0), left: Number(out.left ?? 0), stopped: typeof out.stopped === "string" ? out.stopped : null };
  if (status === 409 && out?.error === "count_changed") return { kind: "count_changed", now: Number(out.now ?? 0) };
  if (status === 409 && out?.error === "test_first") return { kind: "test_first" };
  return { kind: "failed", why: why(status, out, "It did not go.") };
}
