/**
 * The account's calls: the plan from the horizon function, the trial, the
 * weekly email's switch, and the first number. Every one fails soft: the
 * server side lands with a later deploy, and until then a call answers
 * "unknown" and the page carries on as it was.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRelation } from "./horizon/errors.ts";
import { type FirstNumberRow, type PlanInfo, type TrialAnswer, type WeeklyState, parsePlan, parseTrial } from "./account.ts";

/** The plan as the server knows it; null on anything but a 200 in the contract's shape. */
export async function fetchPlan(sb: SupabaseClient, url: string, anonKey: string): Promise<PlanInfo | null> {
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${url}/functions/v1/horizon`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "plan" }),
    });
    if (!res.ok) return null;
    return parsePlan(await res.json());
  } catch { return null; }
}

/** A function PostgREST does not know: the SQL has not been run yet. */
const isMissingFunction = (e: { code?: string | null; message?: string | null } | null | undefined): boolean =>
  !!e && (String(e.code ?? "") === "PGRST202" || String(e.code ?? "") === "42883" || /could not find the function|function .* does not exist/i.test(String(e.message ?? "")));

/** Start the 14 days. null = the server cannot say (not there yet, offline): the offer hides. */
export async function startWebTrial(sb: SupabaseClient): Promise<TrialAnswer | null> {
  try {
    const { data, error } = await sb.rpc("start_web_trial");
    if (error) return null;
    return parseTrial(data);
  } catch { return null; }
}

/** The weekly email's switch for this account. A missing table reads "unavailable", never an error. */
export async function loadWeekly(sb: SupabaseClient, userId: string): Promise<WeeklyState> {
  try {
    let { data, error } = await sb.from("email_prefs").select("weekly, timezone, weekly_since").eq("user_id", userId).maybeSingle() as { data: any; error: any };
    // an older table without weekly_since: the switch still reads
    if (error && /weekly_since/i.test(String(error.message ?? ""))) ({ data, error } = await sb.from("email_prefs").select("weekly, timezone").eq("user_id", userId).maybeSingle() as { data: any; error: any });
    if (error) return { state: isMissingRelation(error) ? "unavailable" : "off", timezone: null };
    return { state: data?.weekly === true ? "on" : "off", timezone: (data?.timezone as string | null) ?? null, since: (data?.weekly_since as string | null) ?? null };
  } catch { return { state: "unavailable", timezone: null }; }
}

/**
 * Save the choice with the browser's zone: only `weekly` and `timezone` are
 * written (a trigger keeps updated_at and weekly_since). Answers the state the
 * server now holds, or "unavailable".
 */
export async function saveWeekly(sb: SupabaseClient, userId: string, on: boolean, timezone: string | null): Promise<WeeklyState> {
  try {
    const { error } = await sb.from("email_prefs").upsert({ user_id: userId, weekly: on, timezone }, { onConflict: "user_id" });
    if (error) return { state: isMissingRelation(error) ? "unavailable" : on ? "off" : "on", timezone };
    return on ? await loadWeekly(sb, userId) : { state: "off", timezone };
  } catch { return { state: "unavailable", timezone }; }
}

/** The fitness numbers the website itself filed for this person, by date and method. */
export async function websiteNumbers(sb: SupabaseClient, personId: string): Promise<{ measured_on: string; method: string | null }[] | null> {
  try {
    const { data, error } = await sb.from("web_crf").select("measured_on, method").eq("person_id", personId).eq("source", "website");
    if (error) return null;
    return (data ?? []) as { measured_on: string; method: string | null }[];
  } catch { return null; }
}

/** File the first number. True when the row is in. */
export async function insertFirstNumber(sb: SupabaseClient, row: FirstNumberRow): Promise<boolean> {
  try {
    const { error } = await sb.from("web_crf").insert(row);
    return !error;
  } catch { return false; }
}

/** The weekly email's one-click off, from the link in the email. True when the token was known. */
export async function weeklyEmailOff(sb: SupabaseClient, token: string): Promise<boolean | null> {
  try {
    const { data, error } = await sb.rpc("weekly_email_off", { token });
    if (error) return isMissingFunction(error) ? null : false;
    return data === true;
  } catch { return null; }
}
