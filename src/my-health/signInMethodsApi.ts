/**
 * Adding a door to the account that is signed in: the calls. The rules and
 * the words are ./signInMethods.ts; the block is ./views/SignInMethods.tsx.
 *
 * Through the Supabase client as installed (auth-js 2.112: `linkIdentity`
 * with a provider sends the browser to that provider's page for THIS
 * account).
 *
 *   Apple, Google         the browser leaves for their page and comes back
 *                         to /my-health/ with a code the client trades, as
 *                         the sign-in does. The door being added is kept in
 *                         the browser for the trip (PENDING_LINK).
 *   Email and password    a real address first when the account has none of
 *                         its own (Apple's hidden address), confirmed by a
 *                         6-digit code; then a password.
 *
 * Nobody is signed out by any of this. Every function resolves; none throws.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MIN_PASSWORD, PASSWORD_FLAG, PENDING_LINK, looksLikeEmail, pendingLinkValue, troubleOf,
  type Trouble, type UserLike,
} from "./signInMethods.ts";

export type StepResult = { ok: true } | { ok: false; trouble: Trouble };
type Keep = Pick<Storage, "setItem" | "removeItem">;

/** The account as the server has it now; null when it could not be read. */
export async function readAccount(sb: SupabaseClient): Promise<UserLike> {
  try {
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) return null;
    return data.user as UserLike;
  } catch { return null; }
}

/**
 * Leave for Apple's or Google's page to add it to this account. On a yes from
 * the server the browser is already on its way and this page is gone; what
 * comes back is read at the next load (signInMethods readLinkBack). The landing
 * address is the one the sign-in uses, which is on Supabase's allowed list.
 */
export async function startProviderLink(sb: SupabaseClient, door: "apple" | "google", origin: string, keep: Keep | null, now = Date.now()): Promise<StepResult> {
  try { keep?.setItem(PENDING_LINK, pendingLinkValue(door, now)); } catch { /* private mode: the return will read as a plain visit */ }
  const forget = () => { try { keep?.removeItem(PENDING_LINK); } catch { /* fine */ } };
  try {
    const { error } = await sb.auth.linkIdentity({ provider: door, options: { redirectTo: `${origin}/my-health/` } });
    if (error) { forget(); return { ok: false, trouble: troubleOf(error) }; }
    return { ok: true };
  } catch (e) {
    forget();
    return { ok: false, trouble: troubleOf(e) };
  }
}

/**
 * Ask the server to send a 6-digit code to a new address. Nothing changes on
 * the account until the code is confirmed. `current` is the account's address
 * now, to catch the same one typed again (the server would send nothing).
 */
export async function sendEmailCode(sb: SupabaseClient, email: string, current: string | null | undefined): Promise<StepResult> {
  const to = email.trim();
  if (!looksLikeEmail(to)) return { ok: false, trouble: "bad-email" };
  if (current && to.toLowerCase() === current.trim().toLowerCase()) return { ok: false, trouble: "same-email" };
  try {
    const { error } = await sb.auth.updateUser({ email: to });
    return error ? { ok: false, trouble: troubleOf(error) } : { ok: true };
  } catch (e) { return { ok: false, trouble: troubleOf(e) }; }
}

/** The same code again, to the new address. */
export async function resendEmailCode(sb: SupabaseClient, email: string): Promise<StepResult> {
  try {
    const { error } = await sb.auth.resend({ type: "email_change", email: email.trim() });
    return error ? { ok: false, trouble: troubleOf(error) } : { ok: true };
  } catch (e) { return { ok: false, trouble: troubleOf(e) }; }
}

/**
 * Check a code. `sentTo` is the address THAT code was sent to: the server
 * works the code out from the address and the digits together. `done` false
 * means the server took the code and wants the other one too ("Secure email
 * change": one code to the new address, one to the current).
 */
export async function confirmEmailCode(sb: SupabaseClient, sentTo: string, code: string): Promise<{ ok: true; done: boolean } | { ok: false; trouble: Trouble }> {
  const token = code.replace(/\D/g, "");
  if (token.length < 6) return { ok: false, trouble: "bad-code" };
  try {
    const { data, error } = await sb.auth.verifyOtp({ email: sentTo.trim(), token, type: "email_change" });
    if (error) return { ok: false, trouble: troubleOf(error) };
    return { ok: true, done: !!data?.session };
  } catch (e) { return { ok: false, trouble: troubleOf(e) }; }
}

/** Whether the account's email is now `email`: for a person who pressed the link in the email instead of typing the code. */
export async function emailIsNow(sb: SupabaseClient, email: string): Promise<boolean> {
  const account = await readAccount(sb);
  return !!account?.email && account.email.trim().toLowerCase() === email.trim().toLowerCase();
}

/** Set the password, and leave the mark that says the account has one (signInMethods PASSWORD_FLAG). */
export async function setPassword(sb: SupabaseClient, password: string): Promise<StepResult> {
  if (password.length < MIN_PASSWORD) return { ok: false, trouble: "weak-password" };
  try {
    const { error } = await sb.auth.updateUser({ password, data: { [PASSWORD_FLAG]: true } });
    return error ? { ok: false, trouble: troubleOf(error) } : { ok: true };
  } catch (e) { return { ok: false, trouble: troubleOf(e) }; }
}
