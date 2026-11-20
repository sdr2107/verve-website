/**
 * The letter's list, read from the database by an account that may read it (METTracker
 * supabase/migrations/20261121_one_list.sql). The database decides who that is: an account that is not in
 * `list_readers` is answered with no rows, whatever this page asks for. A row's token is never readable.
 *
 * Nothing here writes a row except `bringIn`, which hands Substack's file to the database's own function.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListRow } from "./list.ts";

const COLS = "id, email, consented_at, source, tag, confirmed_at, welcome_sent_at, unsubscribed_at";
const PAGE = 1000;

/** Whether this account may read the list. False for everyone else, and until the database has the function. */
export async function listReader(sb: SupabaseClient): Promise<boolean> {
  try { const { data, error } = await sb.rpc("list_reader"); return !error && data === true; } catch { return false; }
}

/** Every row, newest first. null: the list could not be read just now. */
export async function readList(sb: SupabaseClient): Promise<ListRow[] | null> {
  const out: ListRow[] = [];
  try {
    for (let from = 0; from < 100 * PAGE; from += PAGE) {
      const { data, error } = await sb.from("newsletter_signups").select(COLS).order("consented_at", { ascending: false }).range(from, from + PAGE - 1);
      if (error || !Array.isArray(data)) return null;
      out.push(...(data as unknown as ListRow[]));
      if (data.length < PAGE) break;
    }
  } catch { return null; }
  return out;
}

export type BroughtIn = { added: number; already: number; refused: number };
/** Substack's file, handed to the database: each address is added once and is never sent a welcome. A string is why it did not work. */
export async function bringIn(sb: SupabaseClient, rows: { email: string; subscribed_at: string | null }[]): Promise<BroughtIn | string> {
  try {
    const { data, error } = await sb.rpc("newsletter_import", { rows });
    if (error) return error.message;
    const r = (Array.isArray(data) ? data[0] : data) as Partial<BroughtIn> | null;
    return { added: Number(r?.added ?? 0), already: Number(r?.already ?? 0), refused: Number(r?.refused ?? 0) };
  } catch (e) { return e instanceof Error ? e.message : "The file could not be brought in."; }
}

/**
 * Hear of every change to the list as it is written. `onChange` is called for each one, `onOpen` says whether
 * the line is open. Returns the way to stop listening. A browser or a project that cannot listen simply never
 * says the line is open, and the page falls back to reading again each minute.
 */
export function listen(sb: SupabaseClient, onChange: () => void, onOpen: (open: boolean) => void): () => void {
  try {
    const channel = sb.channel("the-list")
      .on("postgres_changes" as never, { event: "*", schema: "public", table: "newsletter_signups" } as never, () => onChange())
      .subscribe((status: string) => onOpen(status === "SUBSCRIBED"));
    return () => { try { void sb.removeChannel(channel); } catch { /* already gone */ } };
  } catch { onOpen(false); return () => {}; }
}
