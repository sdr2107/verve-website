/**
 * Horizon's error words, and the one answer that is not an error: the backend
 * not being in place yet (the tables unrun, the function undeployed). Pure, so
 * tests/horizon-errors.test.mjs can read it without a client.
 */
export type ApiError = "pro_required" | "consent_required" | "allowance" | "week_limit" | "no_plan" | "forbidden" | "horizon_closed" | "not_open" | "not_switched_on" | "bad_request" | "offline" | "unknown";

/** What a status and body from the function mean, in the page's words. */
export function mapError(status: number, out: any): ApiError {
  const code = String(out?.error ?? "");
  // the chat about the plan: the week's questions are used up, or there is no plan in use to ask about
  if (code === "weekly_limit") return "week_limit";
  if (code === "no_plan") return "no_plan";
  if (status === 402 || code === "pro_required") return "pro_required";
  if (status === 412 || code === "consent_required") return "consent_required";
  if (status === 429) return "allowance";
  if (status === 403) return "forbidden";
  if (status === 409 || code === "horizon_closed") return "horizon_closed";
  if (status === 503 || code === "horizon_not_open") return "not_open";
  if (status === 404) return "not_switched_on";
  if (status === 400) return "bad_request";
  if (status === 0) return "offline";
  return "unknown";
}

export const ERROR_WORDS: Record<ApiError, string> = {
  pro_required: "Horizon is part of Pro on the website.",
  consent_required: "Tick the consent box first: it says what is sent, and what is not.",
  allowance: "Today's allowance of Guide writing is used up; try tomorrow.",
  week_limit: "This week's questions about the plan are used up. They come back on Monday.",
  no_plan: "There is no plan in use to ask about yet.",
  forbidden: "Only the person whose horizon this is can ask for a check-in.",
  horizon_closed: "This horizon is closed. A final read is still possible.",
  not_open: "The Guide is not available right now.",
  not_switched_on: "Horizon is not switched on for this account yet.",
  bad_request: "Something in the horizon did not pass the writer's checks.",
  offline: "Could not reach the writer. Try again in a moment.",
  unknown: "Could not write it.",
};

/** A PostgREST answer that says the table is not there: the Horizon SQL has not been run for this project yet. */
export function isMissingRelation(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  const code = String(e.code ?? "");
  if (code === "42P01" || code === "PGRST205") return true;
  return /relation .* does not exist|could not find the table/i.test(String(e.message ?? ""));
}

/** Thrown by the reads when the tables are missing; the page shows the door, not an error. */
export class HorizonOffError extends Error {
  constructor() { super("Horizon is not switched on for this account yet."); this.name = "HorizonOff"; }
}
