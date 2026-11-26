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
import { accessFlags, accessOf, type ProgrammeAccess } from "../known.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase.ts";
import type { Cadence, CheckinInputs, Landed, MarkerKey, PlanRow } from "./derive.ts";
import { mapError, isMissingRelation, HorizonOffError, type ApiError } from "./errors.ts";
import type { GuideStored, ScreenAnswers } from "./guidePlan.ts";
import { parseAccess, type HorizonAccess } from "./access.ts";
import { anew, fresh, shared, type Kept } from "../once.ts";
import type { Programme, WeekNote } from "./programme.ts";
import type { ChartAnswer, ChartDay, ChartRead, ChartRow } from "./chart.ts";
import type { WatchedRow } from "./watch.ts";
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
  /** What a horizon set up as a programme keeps: its goal, the person's aims, the days they train (./programme.ts Programme). Absent before 20261116_horizon_programme.sql, null on a horizon of the person's own targets. */
  programme?: unknown;
  /**
   * The Mondays of the weeks its owner set aside, and the date as first set once a pause has moved it (./pause.ts).
   * Written only by the horizon function: the database refuses both to a signed-in person. Absent before
   * 20261117_horizon_pause.sql, which reads as never paused.
   */
  pauses?: string[] | null; ends_on_set?: string | null;
  /** The midweek note is shown (./midweek.ts, board 15). Absent before 20261118_horizon_days_midweek_chart.sql, which reads as on. */
  checkin_midweek?: boolean | null;
};
export type TargetRow = {
  id: string; horizon_id: string; user_id: string; marker: MarkerKey; label: string; unit: string | null;
  start_value: number | null; start_on: string | null; target_value: number; cadence: Cadence | null; created_at: string;
  /** How the number is held, a band's lower edge, and the method a fitness number is kept to. Absent before 20261116_horizon_programme.sql. */
  mode?: string | null; low_value?: number | null; method?: string | null;
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

// ── one question, one request (../once.ts) ──
/** The asks on their way, by question. Callers that arrive while one is out share its answer. */
const going = new Map<string, Promise<unknown>>();

/** The account the browser's stored session belongs to: the one the head start asked for. */
function storedUserId(): string {
  try {
    const ref = SUPABASE_URL.replace("https://", "").split(".")[0];
    const s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? "null");
    return typeof s?.user?.id === "string" ? s.user.id : "";
  } catch { return ""; }
}
/** The function's last `plan` answer, kept a few seconds: see fetchAccess. */
let lastPlan: Kept<unknown> = null;
const PLAN_FRESH_MS = 10_000;
/**
 * The horizon function's `plan` answer: what the account holds (the line under the name, ../accountApi.ts fetchPlan)
 * and what it may do on Horizon (fetchAccess). One answer serves both, and one request serves every caller that asks
 * while it is out. The first ask of a load is the head start's, sent as the page was parsed (my-health.astro), when it
 * was for the account the browser is signed in as. `again` is for a caller that has just written something the
 * answer depends on: it never joins an ask that left before the write.
 */
export function planAnswer(sb: SupabaseClient, again = false): Promise<{ ok: boolean; out: any }> {
  const ask = async (): Promise<{ ok: boolean; out: any }> => {
    if (!again) {
      try {
        const head = (globalThis as any).__mh as { user?: string; plan?: Promise<unknown>; planTaken?: boolean } | undefined;
        if (head?.plan && !head.planTaken && head.user && head.user === storedUserId()) {
          head.planTaken = true;
          const early = await head.plan;
          if (early) { lastPlan = { at: Date.now(), value: early }; return { ok: true, out: early }; }
        }
      } catch { /* no head start: ask as before */ }
    }
    const { ok, out } = await callHorizon(sb, { action: "plan" });
    if (ok) lastPlan = { at: Date.now(), value: out };
    return { ok, out };
  };
  return again ? anew(going, "plan", ask) : shared(going, "plan", ask);
}

// ── reads ──

/** A person's horizons, open ones unless asked, with their targets, plan and check-ins (newest first). */
export function listHorizons(sb: SupabaseClient, personId: string, includeClosed = false): Promise<HorizonFull[]> {
  // the Horizon view (all of them) and Settings (the open ones) both ask as the page starts: while the fuller read is
  // out, the open ones are taken from it; two asks for the same thing share one read. Nothing is kept once it lands.
  if (!includeClosed) {
    const all = going.get(`horizons:${personId}:all`) as Promise<HorizonFull[]> | undefined;
    if (all) return all.then((hs) => hs.filter((h) => !h.closed_at));
  }
  return shared(going, `horizons:${personId}:${includeClosed ? "all" : "open"}`, () => readHorizons(sb, personId, includeClosed));
}
async function readHorizons(sb: SupabaseClient, personId: string, includeClosed: boolean): Promise<HorizonFull[]> {
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
  if (ok) lastPlan = null;                                // the free week may have begun: the next ask is a new one
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
export async function updateHorizon(sb: SupabaseClient, id: string, patch: Partial<Pick<HorizonRow, "title" | "ends_on" | "checkin_monday" | "checkin_month" | "send_to_coach" | "timezone" | "email_checkin" | "checkin_midweek">>): Promise<string | null> {
  const { error } = await sb.from("horizons").update(patch).eq("id", id);
  return error ? error.message : null;
}
/**
 * Deleting a horizon removes it for good: its row, and with it its targets, plan, check-ins, questions, week notes
 * and three health answers (every one of those tables is tied to the horizon and goes with it). The person's
 * readings are not the horizon's and are not touched. It took the place of "Stop this horizon" on 17 November 2026,
 * which only hid the horizon and kept every row where nobody saw it again. The owner's own row, under row-level
 * security; the answer says so when nothing was removed.
 */
export async function deleteHorizon(sb: SupabaseClient, id: string): Promise<string | null> {
  const { data, error } = await sb.from("horizons").delete().eq("id", id).select("id");
  if (error) return error.message;
  return data && data.length ? null : "Nothing was removed. Only the person whose horizon it is can delete it.";
}
/**
 * Set a week aside (./pause.ts; board 13). The function checks the rule and writes the week and the date; the page
 * only names the week's Monday. The answer is the horizon's new date.
 */
export async function pauseHorizon(sb: SupabaseClient, payload: { horizon_id: string; week: string; timezone?: string | null }): Promise<Result<{ ends_on: string; pauses: string[] }>> {
  const { ok, status, out } = await callHorizon(sb, { action: "pause", ...payload });
  return ok && out?.ends_on ? { ok: true, data: { ends_on: String(out.ends_on), pauses: Array.isArray(out.pauses) ? out.pauses.map(String) : [] } } : fail(status, out);
}
export async function addTarget(sb: SupabaseClient, t: Omit<TargetRow, "id" | "created_at">): Promise<Result<TargetRow>> {
  const { data, error } = await sb.from("horizon_targets").insert(t).select("*").single();
  return error || !data ? { ok: false, error: "unknown", status: 0, detail: error?.message ?? "" } : { ok: true, data: data as TargetRow };
}
/** A target's number, changed by the person who set it. Where it started, and the day, stay as they were. */
export async function updateTarget(sb: SupabaseClient, id: string, targetValue: number): Promise<string | null> {
  const { error } = await sb.from("horizon_targets").update({ target_value: targetValue }).eq("id", id);
  return error ? error.message : null;
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
  // three views ask as the page starts: they share one read
  return shared(going, "guide-ready", async () => {
    try {
      const { error } = await sb.from("horizon_plans").select("guide").limit(1);
      if (!error) return (guideReady = true);
      if (String(error.code ?? "") === "42703" || /guide/i.test(String(error.message ?? "")) || isMissingRelation(error)) return (guideReady = false);
      return false;
    } catch { return false; }
  });
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
  // The Horizon view asks each time the page redraws, which is several times as it starts. An answer that arrived
  // in the last few seconds is the answer; forgetAccess() and a horizon being set drop it at once.
  const kept = fresh(lastPlan, PLAN_FRESH_MS);
  const { ok, out } = kept !== undefined ? { ok: true, out: kept } : await planAnswer(sb);
  const access = ok ? parseAccess(out) : null;
  if (access) rememberAccess(out);
  return access;
}
/**
 * The function's last answer about what the account may do, kept for this tab (17 November 2026: the founder found
 * the page slow to settle). The function takes a second or more to answer, and until it did the page drew itself
 * without knowing, then drew itself again. The page now opens on the last answer and asks again behind it. The
 * function still decides every write, so a stale answer can only show a button that the function then refuses.
 */
const ACCESS_KEY = "verve-horizon-access";
const ACCESS_KEEP_MS = 30 * 60_000;
function rememberAccess(out: unknown) {
  try { sessionStorage.setItem(ACCESS_KEY, JSON.stringify({ at: Date.now(), out })); } catch { /* a private window: asked again next time */ }
}
export function rememberedAccess(): HorizonAccess | null {
  try {
    const kept = JSON.parse(sessionStorage.getItem(ACCESS_KEY) ?? "null");
    return kept && typeof kept.at === "number" && Date.now() - kept.at < ACCESS_KEEP_MS ? parseAccess(kept.out) : null;
  } catch { return null; }
}
/** Forget the kept answer: on signing out, and after anything that changes it (a horizon set, a plan bought). */
export function forgetAccess() { lastPlan = null; try { sessionStorage.removeItem(ACCESS_KEY); } catch { /* nothing was kept */ } }

// ── Horizon as a programme (canvas "Verve, Horizon as a programme"; built for test accounts, 16 November 2026) ──

/**
 * Whether this account is on the list of test accounts (programme_testers, METTracker
 * supabase/migrations/20261116_horizon_programme.sql). The programme's set-up is offered to nobody else: the offer, a
 * coach's words on food and the lines about weight wait for the lawyers. A table that is not there, a row that is
 * not there and a network failure all read as "no". Asked once for the page.
 */
let accessAsk: { uid: string; answer: Promise<ProgrammeAccess | null> } | null = null;
/** The head start's answer (my-health.astro asks the team's list as the page is parsed, beside the document), when it was for this account. */
function headTester(uid: string): Promise<boolean | null> | null {
  try { const h = (globalThis as any).__mh; return h && h.user === uid && h.tester ? (h.tester as Promise<boolean | null>) : null; }
  catch { return null; }
}
/**
 * What the account holds of Horizon as a programme: "team", "founding", "none", or null when it could not be asked
 * (offline, a refused call, no session yet). null is not an answer: it is not kept, and the next caller asks again.
 *
 * 25 November 2026: founding members. The database answers programme_access() (METTracker
 * supabase/migrations/20261125_founding_members.sql). A yes from the head start is the team's list and is the answer
 * at once. Where that function is not in the database yet, the team's list is read as it always was.
 */
export function accessAnswer(sb: SupabaseClient, uid?: string): Promise<ProgrammeAccess | null> {
  if (accessAsk && (!uid || accessAsk.uid === uid)) return accessAsk.answer;
  const answer = (async (): Promise<ProgrammeAccess | null> => {
    try {
      let id = uid ?? "";
      if (id) { const early = await (headTester(id) ?? Promise.resolve(null)); if (early === true) return "team"; }
      if (!id) { const { data: { session } } = await sb.auth.getSession(); id = session?.user?.id ?? ""; }
      if (!id) return null;
      const asked = await sb.rpc("programme_access");
      if (!asked.error) return accessOf(asked.data);
      const { data, error } = await sb.from("programme_testers").select("user_id").eq("user_id", id).maybeSingle();
      return error ? null : data ? "team" : "none";
    } catch { return null; }
  })();
  const mine = { uid: uid ?? "", answer };
  accessAsk = mine;
  void answer.then((a) => { if (a == null && accessAsk === mine) accessAsk = null; });
  return answer;
}
/**
 * Whether Horizon as a programme is on for this account: a test account or a founding member. true, false, or null
 * when it could not be asked. Until 20 November 2026 a failed first ask was kept as "no" for as long as the page
 * stayed open.
 */
export function testerAnswer(sb: SupabaseClient, uid?: string): Promise<boolean | null> {
  return accessAnswer(sb, uid).then((a) => (a == null ? null : accessFlags(a).tester));
}
/** Whether this is one of the team's own accounts: what is the team's alone is drawn for these and nobody else. */
export function teamAnswer(sb: SupabaseClient, uid?: string): Promise<boolean | null> {
  return accessAnswer(sb, uid).then((a) => (a == null ? null : accessFlags(a).team));
}
/** Yes or no, for a caller with nothing to fall back on: "could not be asked" reads as no. */
export function programmeTester(sb: SupabaseClient): Promise<boolean> {
  return testerAnswer(sb).then((a) => a === true);
}
/** Signing out: the answer was the last account's. */
export function forgetTester(): void { accessAsk = null; }
/**
 * A panel for test accounts (views/TesterPanel.tsx): the row's body, or null when it cannot be read. Its words live in
 * the database, not here: only an account in programme_testers can read programme_panels.
 */
export async function loadPanel(sb: SupabaseClient, key: string): Promise<unknown | null> {
  try {
    const { data, error } = await sb.from("programme_panels").select("body").eq("key", key).maybeSingle();
    const body = (data as { body?: unknown } | null)?.body;
    return error || !body || typeof body !== "object" ? null : body;
  } catch { return null; }
}
/** What the horizon keeps about its programme; written by its owner once it is set. */
export async function saveProgramme(sb: SupabaseClient, horizonId: string, programme: Programme): Promise<string | null> {
  const { error } = await sb.from("horizons").update({ programme }).eq("id", horizonId);
  return error ? error.message : null;
}
/** How a target's number is held, and the method a fitness number is kept to: written by the owner after the horizon is set. */
export async function setTargetHold(sb: SupabaseClient, horizonId: string, marker: string, patch: { mode?: string | null; low_value?: number | null; method?: string | null }): Promise<string | null> {
  const { error } = await sb.from("horizon_targets").update(patch).eq("horizon_id", horizonId).eq("marker", marker);
  return error ? error.message : null;
}
/** The weeks a horizon has kept notes for: the person's answer, the call and its three lines. Empty when the table is not there. */
export async function listWeekNotes(sb: SupabaseClient, horizonId: string): Promise<WeekNote[]> {
  const { data, error } = await sb.from("horizon_weeks").select("horizon_id, week_start, way, away, call_at, call_kept, lines, lines_by, updated_at").eq("horizon_id", horizonId).order("week_start", { ascending: true });
  return error || !data ? [] : (data as any[]).map((r) => ({ ...r, week_start: String(r.week_start).slice(0, 10), away: !!r.away, lines: Array.isArray(r.lines) ? r.lines.filter((l: unknown) => typeof l === "string") : [] })) as WeekNote[];
}
/** One week's note, written by the person or by the coach they share with; `updatedBy` must be the signed-in user's id (the policy checks it). */
export async function saveWeekNote(sb: SupabaseClient, horizonId: string, weekStart: string, patch: Partial<Pick<WeekNote, "way" | "away" | "call_at" | "call_kept" | "lines" | "lines_by">>, updatedBy: string): Promise<string | null> {
  const { error } = await sb.from("horizon_weeks").upsert({ horizon_id: horizonId, week_start: weekStart, ...patch, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "horizon_id,week_start" });
  return error ? error.message : null;
}

// ── a day to be ready for (board 14, 17 November 2026) ──

/**
 * The name a person gave the day their horizon is for ("My sister's wedding"). It is theirs alone: it is kept in
 * horizon_days, which only its owner can read, and never on the horizon's own row, which a coach reads and the
 * function sends on. A table that is not there yet reads as no name.
 */
export async function loadDayName(sb: SupabaseClient, horizonId: string): Promise<string | null> {
  try {
    const { data, error } = await sb.from("horizon_days").select("name").eq("horizon_id", horizonId).maybeSingle();
    const name = (data as { name?: unknown } | null)?.name;
    return error || typeof name !== "string" || !name.trim() ? null : name;
  } catch { return null; }
}
export async function saveDayName(sb: SupabaseClient, horizonId: string, userId: string, name: string): Promise<string | null> {
  const { error } = await sb.from("horizon_days").upsert({ horizon_id: horizonId, user_id: userId, name: name.trim().slice(0, 80) }, { onConflict: "horizon_id" });
  return error ? error.message : null;
}

// ── a fitness test, typed or read from a report (board 16) ──

/** A reading filed where the app files its own tests, so the page and the phone read one list (./fitnessEntry.ts crfRow). */
export async function keepFitnessReading(sb: SupabaseClient, row: Record<string, unknown>): Promise<string | null> {
  const { error } = await sb.from("crf_entries").insert(row);
  return error ? error.message : null;
}

// ── a diet chart, beside the horizon (board 17) ──

/** A horizon's charts, oldest first; null when the tables are not there yet (the card is then not offered). */
export async function listCharts(sb: SupabaseClient, horizonId: string): Promise<ChartRow[] | null> {
  try {
    const { data, error } = await sb.from("horizon_charts").select("*").eq("horizon_id", horizonId).is("removed_at", null).order("given_on", { ascending: true });
    if (error) return isMissingRelation(error) ? null : [];
    return ((data ?? []) as any[]).map((r) => ({ ...r, given_on: String(r.given_on).slice(0, 10), review_on: r.review_on ? String(r.review_on).slice(0, 10) : null,
      meals: Array.isArray(r.meals) ? r.meals : [], notes: Array.isArray(r.notes) ? r.notes : [], totals: Array.isArray(r.totals) ? r.totals : [] })) as ChartRow[];
  } catch { return null; }
}
export async function keepChart(sb: SupabaseClient, row: { horizon_id: string; user_id: string; report_path: string | null } & ChartRead & { given_on: string }): Promise<string | null> {
  const { error } = await sb.from("horizon_charts").insert(row);
  return error ? error.message : null;
}
/** Take a chart off its horizon. The file stays in Reports: it is the person's paper, not the horizon's. */
export async function removeChart(sb: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await sb.from("horizon_charts").update({ removed_at: new Date().toISOString() }).eq("id", id);
  return error ? error.message : null;
}
export async function listChartDays(sb: SupabaseClient, horizonId: string): Promise<ChartDay[]> {
  try {
    const { data, error } = await sb.from("horizon_chart_days").select("day, answer").eq("horizon_id", horizonId).order("day", { ascending: true });
    return error ? [] : ((data ?? []) as any[]).map((r) => ({ day: String(r.day).slice(0, 10), answer: r.answer }));
  } catch { return []; }
}
/** One day's answer; null takes the answer back, and the day is a dash again. */
export async function saveChartDay(sb: SupabaseClient, horizonId: string, userId: string, day: string, answer: ChartAnswer | null): Promise<string | null> {
  const { error } = answer
    ? await sb.from("horizon_chart_days").upsert({ horizon_id: horizonId, user_id: userId, day, answer, updated_at: new Date().toISOString() }, { onConflict: "horizon_id,day" })
    : await sb.from("horizon_chart_days").delete().eq("horizon_id", horizonId).eq("day", day);
  return error ? error.message : null;
}

// ── markers watched on a horizon, with no number on them (board 19, 18 November 2026) ──

/**
 * Whether watched markers can be kept for this project: the table horizon_watched is there (METTracker
 * supabase/migrations/20261120_horizon_watched.sql). Asked once; a network failure is not an answer. Until it is
 * there the set-up offers nothing to watch, and a goal's watched row is left off the horizon as it always was.
 */
let watchReady: boolean | null = null;
export async function watchedReady(sb: SupabaseClient): Promise<boolean> {
  if (watchReady != null) return watchReady;
  return shared(going, "watched-ready", async () => {
    try {
      const { error } = await sb.from("horizon_watched").select("id").limit(1);
      if (!error) return (watchReady = true);
      if (isMissingRelation(error)) return (watchReady = false);
      return false;
    } catch { return false; }
  });
}
/**
 * A horizon's watched markers, oldest first. They are their owner's alone: the database gives a coach none, and the
 * horizon function cannot read the table, so nothing watched reaches a check-in or the Guide. Empty for anyone else,
 * and when the table is not there.
 */
export async function listWatched(sb: SupabaseClient, horizonId: string): Promise<WatchedRow[]> {
  try {
    const { data, error } = await sb.from("horizon_watched").select("id, horizon_id, marker, unit, start_value, start_on, created_at").eq("horizon_id", horizonId).order("created_at", { ascending: true });
    return error ? [] : ((data ?? []) as any[]).map((r) => ({ ...r, start_value: r.start_value == null ? null : Number(r.start_value), start_on: r.start_on ? String(r.start_on).slice(0, 10) : null })) as WatchedRow[];
  } catch { return []; }
}
export async function keepWatched(sb: SupabaseClient, horizonId: string, userId: string, rows: Pick<WatchedRow, "marker" | "unit" | "start_value" | "start_on">[]): Promise<string | null> {
  if (!rows.length) return null;
  const { error } = await sb.from("horizon_watched").upsert(rows.map((r) => ({ horizon_id: horizonId, user_id: userId, marker: r.marker, unit: r.unit, start_value: r.start_value, start_on: r.start_on })), { onConflict: "horizon_id,marker", ignoreDuplicates: true });
  return error ? error.message : null;
}
/** Stop watching a marker. Its readings are the person's and are not touched. */
export async function removeWatched(sb: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await sb.from("horizon_watched").delete().eq("id", id);
  return error ? error.message : null;
}
