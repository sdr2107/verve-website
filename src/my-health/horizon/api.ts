/**
 * Horizon's rows and its writer. Reads and the small writes go straight to
 * the tables under row-level security (the owner reads and writes their
 * horizon; a coach with the activity grant reads it all and writes the
 * plan). Starting a horizon and writing a check-in go through the edge
 * function `horizon` (METTracker/supabase/functions/horizon), which holds
 * the Pro gate: Horizon has no free tier on the website.
 *
 * Tables: horizons, horizon_targets, horizon_plans, horizon_checkins
 * (METTracker/supabase/migrations/20261109_horizon.sql, 20261110_horizon_cron.sql).
 * The check-in's email (canvas "What brings people back", board 01) is the
 * function's: the page only keeps the switch, horizons.email_checkin, and the
 * one-click way out is /unsubscribe/?h=<token> (the RPC horizon_email_off).
 *
 * The figures a check-in is written from are computed by the function, from the
 * document, with this site's own arithmetic vendored there: one source, whether
 * the hour came round (pg_cron) or the person pressed the button. The browser
 * sends its zone so day boundaries are the person's; it sends figures only as
 * a fallback for a function that cannot read the document.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase.ts";
import type { Cadence, CheckinInputs, Landed, MarkerKey, PlanRow } from "./derive.ts";
import { mapError, isMissingRelation, HorizonOffError, type ApiError } from "./errors.ts";
import type { GuideStored, ScreenAnswers } from "./guidePlan.ts";
import { parseAccess, type HorizonAccess } from "./access.ts";
export { mapError, ERROR_WORDS, isMissingRelation, HorizonOffError, type ApiError } from "./errors.ts";

export type HorizonKind = "date" | "months";
export type PlanAuthor = "coach" | "guide" | "user";
export type CheckinKind = "week" | "month" | "final";

export type HorizonRow = {
  id: string; user_id: string; person_id: string; title: string; kind: HorizonKind; months: 3 | 6 | 12 | null;
  starts_on: string; ends_on: string; checkin_monday: boolean; checkin_month: boolean; send_to_coach: boolean;
  closed_at: string | null; created_at: string;
  /** The IANA zone the horizon was set in; the scheduled check-in reads Monday in it. Absent before 20261110_horizon_cron.sql; the page fills it on the owner's next visit. */
  timezone?: string | null;
  /** The Guide's check-in also goes to the person's inbox, from the same round that writes it. Absent before 20261111 (the column); the page shows the switch only when the row carries it. */
  email_checkin?: boolean;
};
export type TargetRow = {
  id: string; horizon_id: string; user_id: string; marker: MarkerKey; label: string; unit: string | null;
  start_value: number | null; start_on: string | null; target_value: number; cadence: Cadence | null; created_at: string;
};
export type PlanRecord = { horizon_id: string; rows: PlanRow[]; author: PlanAuthor | null; updated_by: string | null; updated_at: string;
  /** The Guide's plan in use (./guidePlan.ts GuideStored): what it started from and the choices made. Absent before 20261114_horizon_guide_plan.sql, and null when the plan is the coach's or the person's own lines. */
  guide?: unknown };
/** What the function stored beside the text: the inputs it wrote from, and where and when they were read. `as_of` is set when a Monday check-in was written before the app had synced the week (the synced_at the figures are from, or null when there was no row). */
export type CheckinPace = CheckinInputs & { as_of?: string | null; tz?: string; today?: string; computed?: "server" | "browser"; dropped?: number;
  /** Blood readings that arrived since the last check-in (a report was filed): the page says so above the check-in. */
  landed?: Landed[] };
export type CheckinRow = { id: string; horizon_id: string; user_id: string; kind: CheckinKind; for_date: string; text: string; pace: CheckinPace | null; model: string | null; created_at: string };
export type HorizonFull = HorizonRow & { targets: TargetRow[]; plan: PlanRecord | null; checkins: CheckinRow[] };

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError; status: number; detail: string };


async function callHorizon(sb: SupabaseClient, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; out: any }> {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/horizon`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    return { ok: resp.ok, status: resp.status, out: await resp.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, out: {} }; }
}
const fail = <T,>(status: number, out: any): Result<T> => ({ ok: false, error: mapError(status, out), status, detail: String(out?.detail ?? out?.error ?? "") });

// ── reads ──

/** A person's horizons, open ones unless asked, with their targets, plan and check-ins (newest first). */
export async function listHorizons(sb: SupabaseClient, personId: string, includeClosed = false): Promise<HorizonFull[]> {
  let q = sb.from("horizons").select("*").eq("person_id", personId).order("ends_on", { ascending: true });
  if (!includeClosed) q = q.is("closed_at", null);
  const { data: hs, error } = await q;
  if (error) { if (isMissingRelation(error)) throw new HorizonOffError(); throw new Error(error.message); }
  if (!hs?.length) return [];
  const ids = hs.map((h: any) => h.id);
  const [t, p, c] = await Promise.all([
    sb.from("horizon_targets").select("*").in("horizon_id", ids).order("created_at", { ascending: true }),
    sb.from("horizon_plans").select("*").in("horizon_id", ids),
    sb.from("horizon_checkins").select("*").in("horizon_id", ids).order("for_date", { ascending: false }),
  ]);
  return (hs as HorizonRow[]).map((h) => ({
    ...h,
    targets: ((t.data ?? []) as TargetRow[]).filter((x) => x.horizon_id === h.id),
    plan: ((p.data ?? []) as PlanRecord[]).find((x) => x.horizon_id === h.id) ?? null,
    checkins: ((c.data ?? []) as CheckinRow[]).filter((x) => x.horizon_id === h.id),
  }));
}

// ── the function: start, check in ──

export type StartTarget = { marker: MarkerKey; label: string; unit: string | null; start_value: number | null; start_on: string | null; target_value: number; cadence: Cadence };
export type StartPayload = {
  person_id: string; title: string; kind: HorizonKind;
  /** Null on a dated horizon; the function rejects a number there. */
  months: 3 | 6 | 12 | null;
  starts_on: string; ends_on: string; targets: StartTarget[];
  plan: { rows: PlanRow[]; author: PlanAuthor | null };
  checkin_monday: boolean; checkin_month: boolean; send_to_coach: boolean;
  /** The browser's zone (Intl), so the scheduled check-in reads the person's Monday. */
  timezone?: string | null;
  /** Email each check-in to the person; ticked by default in the set-up, theirs to untick. */
  email_checkin?: boolean;
};
export async function startHorizon(sb: SupabaseClient, payload: StartPayload): Promise<Result<{ id: string }>> {
  const body = { action: "start", ...payload, months: payload.kind === "date" ? null : payload.months };
  const { ok, status, out } = await callHorizon(sb, body);
  return ok && out?.id ? { ok: true, data: { id: String(out.id) } } : fail(status, out);
}

export type CheckinPayload = { horizon_id: string; kind: CheckinKind; for_date: string; force?: boolean; /** the browser's zone, for a horizon that has none recorded yet */ timezone?: string | null; /** the page's own figures, kept by the function only as a fallback for a document it cannot read; it computes them itself otherwise */ inputs?: CheckinInputs };
export async function requestCheckin(sb: SupabaseClient, payload: CheckinPayload): Promise<Result<{ id: string; text: string; created_at: string }>> {
  const { ok, status, out } = await callHorizon(sb, { action: "checkin", ...payload });
  return ok && out?.text ? { ok: true, data: { id: String(out.id ?? ""), text: String(out.text), created_at: String(out.created_at ?? new Date().toISOString()) } } : fail(status, out);
}

/** The consent the Guide's writing needs (ai_consent.summary_at), the same row the Guide's read sets. */
export async function grantConsent(sb: SupabaseClient, userId: string): Promise<string | null> {
  const { error } = await sb.from("ai_consent").upsert({ user_id: userId, summary_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? error.message : null;
}

// ── the small writes, under row-level security ──

/** The plan's rows; `updatedBy` must be the signed-in user's id (the policy checks it). The owner or the coach may write. */
export async function savePlan(sb: SupabaseClient, horizonId: string, rows: PlanRow[], author: PlanAuthor, updatedBy: string): Promise<string | null> {
  const { error } = await sb.from("horizon_plans").upsert({ horizon_id: horizonId, rows, author, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "horizon_id" });
  return error ? error.message : null;
}
export async function updateHorizon(sb: SupabaseClient, id: string, patch: Partial<Pick<HorizonRow, "title" | "ends_on" | "checkin_monday" | "checkin_month" | "send_to_coach" | "timezone" | "email_checkin">>): Promise<string | null> {
  const { error } = await sb.from("horizons").update(patch).eq("id", id);
  return error ? error.message : null;
}
/** Stopping keeps every row; the readings stay and the horizon leaves the open list. */
export async function stopHorizon(sb: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await sb.from("horizons").update({ closed_at: new Date().toISOString() }).eq("id", id);
  return error ? error.message : null;
}
export async function addTarget(sb: SupabaseClient, t: Omit<TargetRow, "id" | "created_at">): Promise<Result<TargetRow>> {
  const { data, error } = await sb.from("horizon_targets").insert(t).select("*").single();
  return error || !data ? { ok: false, error: "unknown", status: 0, detail: error?.message ?? "" } : { ok: true, data: data as TargetRow };
}
export async function removeTarget(sb: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await sb.from("horizon_targets").delete().eq("id", id);
  return error ? error.message : null;
}

// ── the Guide's plan: the plan in use, the three questions, the chat (canvas "Verve, the Guide's plan", 13 Nov 2026) ──

/**
 * Whether the Guide's plan can be kept for this project: the column horizon_plans.guide is there
 * (METTracker/supabase/migrations/20261114_horizon_guide_plan.sql). Asked once; a network failure is not an answer.
 */
let guideReady: boolean | null = null;
export async function guidePlanReady(sb: SupabaseClient): Promise<boolean> {
  if (guideReady != null) return guideReady;
  try {
    const { error } = await sb.from("horizon_plans").select("guide").limit(1);
    if (!error) return (guideReady = true);
    if (String(error.code ?? "") === "42703" || /guide/i.test(String(error.message ?? "")) || isMissingRelation(error)) return (guideReady = false);
    return false;
  } catch { return false; }
}

/** The plan's lines for the week and the Guide's plan they come from; `guide` null leaves the Guide's plan (the lines stay, the author becomes the person). */
export async function saveGuidePlan(sb: SupabaseClient, horizonId: string, rows: PlanRow[], guide: GuideStored | null, updatedBy: string): Promise<string | null> {
  const { error } = await sb.from("horizon_plans").upsert({ horizon_id: horizonId, rows, author: guide ? "guide" : "user", guide, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "horizon_id" });
  return error ? error.message : null;
}

/** The three answers that come before the first plan. The person's alone: no share reads this table. */
export type ScreenRow = ScreenAnswers & { horizon_id: string; user_id: string; answered_at: string };
export async function loadScreen(sb: SupabaseClient, horizonId: string): Promise<ScreenRow | null> {
  const { data, error } = await sb.from("horizon_screens").select("*").eq("horizon_id", horizonId).maybeSingle();
  return error || !data ? null : (data as ScreenRow);
}
export async function saveScreen(sb: SupabaseClient, horizonId: string, userId: string, a: ScreenAnswers): Promise<string | null> {
  const { error } = await sb.from("horizon_screens").upsert({ horizon_id: horizonId, user_id: userId, active: a.active, disease: a.disease, symptoms: a.symptoms, answered_at: new Date().toISOString() }, { onConflict: "horizon_id" });
  return error ? error.message : null;
}
export async function removeScreen(sb: SupabaseClient, horizonId: string): Promise<string | null> {
  const { error } = await sb.from("horizon_screens").delete().eq("horizon_id", horizonId);
  return error ? error.message : null;
}

/** A question about the plan and the Guide's answer, as kept for the person to read again. */
export type AskRow = { id: string; horizon_id: string; question: string; answer: string; rule: string | null; option: string | null; created_at: string };
/** The last thirty, oldest first. An empty list when the table is not there yet. */
export async function listAsks(sb: SupabaseClient, horizonId: string): Promise<AskRow[]> {
  const { data, error } = await sb.from("horizon_asks").select("id, horizon_id, question, answer, rule, option, created_at").eq("horizon_id", horizonId).order("created_at", { ascending: false }).limit(30);
  return error || !data ? [] : (data as AskRow[]).reverse();
}
/** The person clears their questions; the week's count is kept elsewhere and does not come back with them. */
export async function clearAsks(sb: SupabaseClient, horizonId: string): Promise<string | null> {
  const { error } = await sb.from("horizon_asks").delete().eq("horizon_id", horizonId);
  return error ? error.message : null;
}
export type AskAnswer = { id: string; answer: string; rule: string | null; option: string | null; created_at: string;
  /** Questions left: this week's on Pro, the free one on Free. Null when the function did not say. */
  left: number | null };
export async function askGuide(sb: SupabaseClient, payload: { horizon_id: string; question: string; timezone?: string | null }): Promise<Result<AskAnswer>> {
  const { ok, status, out } = await callHorizon(sb, { action: "ask", ...payload });
  return ok && typeof out?.answer === "string"
    ? { ok: true, data: { id: String(out.id ?? ""), answer: out.answer, rule: out.rule ? String(out.rule) : null, option: out.option ? String(out.option) : null, created_at: String(out.created_at ?? new Date().toISOString()), left: Number.isFinite(Number(out.left)) && out.left != null ? Number(out.left) : null } }
    : fail(status, out);
}

export { parseAccess, type HorizonAccess } from "./access.ts";
export async function fetchAccess(sb: SupabaseClient): Promise<HorizonAccess | null> {
  const { ok, out } = await callHorizon(sb, { action: "plan" });
  return ok ? parseAccess(out) : null;
}
