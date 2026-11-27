/**
 * A fitness test read from a report: its two calls (./fitnessTest.ts has the arithmetic, ./views/FitnessTestAdd.tsx
 * the card).
 *
 * The reading is one row where the app files its own tests (public.crf_entries), written with the person's own
 * session, as the typed card has done since 17 November 2026 (./horizon/api.ts keepFitnessReading). The lines a
 * report prints beside its METs go in one column of that row, test_details (METTracker
 * supabase/migrations/20261127_crf_test_details.sql).
 *
 * BEFORE THAT FILE IS RUN the column is not there. Nothing here fails for it: the test is kept without its lines,
 * and reading the lines back finds none. The person is shown no error for a column they have never heard of.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TestDetails } from "./fitnessTest.ts";

/** The database saying the column is not there yet (PostgREST's PGRST204 on a write, Postgres's 42703 on a read). */
export const columnMissing = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === "PGRST204" || e.code === "42703" || /test_details/i.test(String(e.message ?? "")));

/**
 * Keep the reading with its lines. Answers an error in words, or null; `details` says whether the lines were kept
 * (false before the column exists: the reading is kept all the same).
 */
export async function keepFitnessTest(sb: SupabaseClient, row: Record<string, unknown>, details: TestDetails): Promise<{ error: string | null; details: boolean }> {
  const first = await sb.from("crf_entries").insert({ ...row, test_details: details });
  if (!first.error) return { error: null, details: true };
  if (!columnMissing(first.error)) return { error: first.error.message, details: false };
  const again = await sb.from("crf_entries").insert(row);
  return { error: again.error ? again.error.message : null, details: false };
}

/** The person's own readings that carry lines, newest first; none before the column exists, and none on any error. */
export async function loadTestDetails(sb: SupabaseClient, userId: string): Promise<unknown[]> {
  try {
    const { data, error } = await sb.from("crf_entries").select("timestamp, estimation_method, met_capacity, test_details")
      .eq("user_id", userId).is("deleted_at", null).not("test_details", "is", null).order("timestamp", { ascending: false }).limit(20);
    return error ? [] : (data ?? []);
  } catch { return []; }
}
