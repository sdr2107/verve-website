/**
 * The doors an account has, and adding one (Settings › Profile › Sign-in
 * methods). The same rules and words as the app's lib/signInMethods.ts, for
 * the same account: Apple, Google, an email and a password.
 *
 * Most accounts have one door. A person who signed in with Apple and "Hide My
 * Email" has an address nothing else can match, so Google on another device
 * opens a second, empty account. The cure is to add a second door to the
 * FIRST account while signed in to it, which Supabase calls linking an
 * identity.
 *
 * Pure, so tests/sign-in-methods.test.mjs reads it without a client; the calls
 * are ./signInMethodsApi.ts and the block is ./views/SignInMethods.tsx.
 *
 * ADDING ONLY. There is no way here to take a door away: taking the last one
 * away locks a person out of their own page.
 *
 * What the server does was read in its public source (supabase/auth, 28
 * November 2026) and has not been exercised against the real project:
 *   · with "Allow manual linking" off, linking is refused with the code
 *     `manual_linking_disabled`;
 *   · an Apple or Google account that already opens another Verve account
 *     is refused with `identity_already_exists`;
 *   · confirming a new email makes it the account's email and creates the
 *     email door; with "Secure email change" on, a second code sent to the
 *     current address must be confirmed too.
 */

export type Door = "apple" | "google" | "email";
export const DOORS: readonly Door[] = ["apple", "google", "email"];
export const DOOR_NAME: Record<Door, string> = { apple: "Apple", google: "Google", email: "Email and password" };

/** The floor the sign-up card keeps on this site ("Choose a password of at least 8 characters"). */
export const MIN_PASSWORD = 8;

/**
 * Written to the account's own metadata when a password is set here, as the
 * app writes it: the server keeps no sign a browser can read that an account
 * has a password unless the email door exists as an identity. A display hint;
 * nothing is decided by it.
 */
export const PASSWORD_FLAG = "verve_password_set";

/** An address Apple made to hide the person's own ("Hide My Email"). */
export const isRelayEmail = (email: unknown): boolean => /@privaterelay\.appleid\.com$/i.test(String(email ?? ""));

type IdentityLike = { provider?: string | null; identity_data?: Record<string, unknown> | null };
export type UserLike = {
  id?: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  identities?: IdentityLike[] | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

export type DoorState = { door: Door; has: boolean; /** The address this door carries, when saying it helps. */ detail: string | null };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The three doors, each with whether this account has it. */
export function doorsOf(user: UserLike): DoorState[] {
  const ids = (user?.identities ?? []).filter(Boolean);
  const of = (p: string) => ids.find((i) => String(i.provider ?? "") === p) ?? null;
  const email = text(user?.email);
  const apple = of("apple");
  const appleEmail = text(apple?.identity_data?.email);
  const google = of("google");
  const hasPassword = !!of("email") || user?.user_metadata?.[PASSWORD_FLAG] === true;
  return [
    { door: "apple", has: !!apple, detail: !apple ? null : isRelayEmail(appleEmail) ? "with your email hidden" : appleEmail || null },
    { door: "google", has: !!google, detail: google ? text(google.identity_data?.email) || null : null },
    { door: "email", has: hasPassword, detail: hasPassword && email && !isRelayEmail(email) ? email : null },
  ];
}

/**
 * What the email door asks for. An account whose email is its own and
 * confirmed needs only a password. One behind Apple's hidden address, or with
 * no address, gives a real one first: that becomes the account's email.
 */
export type EmailPlan = { kind: "password"; email: string } | { kind: "email-first"; hidden: boolean };
export function emailPlan(user: UserLike): EmailPlan {
  const email = text(user?.email);
  if (email && !isRelayEmail(email) && !!user?.email_confirmed_at) return { kind: "password", email };
  return { kind: "email-first", hidden: isRelayEmail(email) };
}

/**
 * Whether what an email list gives this person hangs on the account's email.
 * Verve keeps two lists by ADDRESS (`vip_emails`, `founding_members`), each
 * matched against the account's email when it is asked. The email door, for
 * an account behind Apple's hidden address, CHANGES that email: a founding
 * member, or anyone given Pro by the list, would lose it the moment the new
 * address was confirmed. Until the lists follow a person and not an address,
 * such an account is not offered the change, and neither is one whose plan
 * the server has not told us. `through` is the plan's own word for where Pro
 * comes from (./account.ts PlanInfo).
 */
export type ListCheck = "listed" | "not-listed" | "unknown";
export function listFromPlan(plan: { through: string | null } | null | undefined): ListCheck {
  if (!plan) return "unknown";
  return plan.through === "vip" || plan.through === "founding" ? "listed" : "not-listed";
}
export const EMAIL_KEPT_BY_LIST = "Your Pro or your place in the programme is kept by this account's email, so it cannot be changed here. Add Google instead, or ask Verve to move it.";
export const EMAIL_NOT_CHECKED = "Verve could not check your plan just now. Try again in a moment. Nothing was changed.";

/** Good enough to send a code to; the server has the last word. */
export const looksLikeEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** "a•••@example.com": enough to recognise an address without printing it whole. */
export function maskEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf("@");
  if (at < 1) return e;
  return `${e[0]}•••${e.slice(at)}`;
}

/**
 * What the page says when the server wants the second code, the one it sent to the address the account has now.
 * An address Apple made is never printed, here or anywhere: the person chose to hide their own, and mail to
 * Apple's address arrives in their own inbox.
 */
export function secondCodeWords(current: string | null | undefined): string {
  const e = String(current ?? "").trim();
  if (isRelayEmail(e)) return "One more code. Verve also sent one to the address Apple keeps for you. It arrives in your own inbox. Enter that one.";
  return `One more code. Verve also sent one to the address this account has now (${maskEmail(e)}). Enter that one.`;
}

// ── What a refusal means ─────────────────────────────────────────────────────

export type Trouble =
  /** The server is not set up for this yet (a switch in the Supabase dashboard is off). */
  | "not-ready"
  /** That Apple or Google account already opens another Verve account. */
  | "belongs-elsewhere"
  /** That Apple or Google account is already on this account. */
  | "already-here"
  /** That email already opens another Verve account. */
  | "email-elsewhere"
  /** The address typed is the one the account already has. */
  | "same-email"
  | "bad-email"
  /** The code was wrong, used, or too old. */
  | "bad-code"
  | "weak-password"
  | "same-password"
  /** The account already has a password, and the server wants it before a new one. */
  | "has-password"
  /** The server wants a recent sign-in before a password is set. */
  | "fresh-sign-in"
  | "too-many"
  | "offline"
  | "unknown";

/** A refusal, from the client's error or from what came back on the address. Never the raw text on the page. */
export function troubleOf(err: unknown): Trouble {
  const e = (err && typeof err === "object" ? err : {}) as { code?: unknown; message?: unknown; status?: unknown; name?: unknown };
  const code = text(e.code).toLowerCase();
  const message = text(e.message).toLowerCase();
  const status = typeof e.status === "number" ? e.status : 0;
  const name = text(e.name);

  if (code === "manual_linking_disabled" || /manual linking is disabled/.test(message)) return "not-ready";
  if (code === "provider_disabled" || code === "email_provider_disabled" || code === "otp_disabled" || code === "email_address_not_authorized") return "not-ready";
  if (code === "identity_already_exists" || /identity is already linked/.test(message)) return /another user/.test(message) ? "belongs-elsewhere" : "already-here";
  if (code === "email_exists" || /already been registered|already registered/.test(message)) return "email-elsewhere";
  if (code === "otp_expired" || /token has expired or is invalid|link is invalid or has expired/.test(message)) return "bad-code";
  if (code === "weak_password" || name === "AuthWeakPasswordError") return "weak-password";
  if (code === "same_password") return "same-password";
  if (code === "current_password_required" || code === "current_password_invalid") return "has-password";
  if (code === "reauthentication_needed" || code === "reauthentication_not_valid") return "fresh-sign-in";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || status === 429) return "too-many";
  if (code === "email_address_invalid" || (code === "validation_failed" && /email/.test(message))) return "bad-email";
  if (name === "AuthRetryableFetchError" || /network request failed|failed to fetch|load failed/.test(message)) return "offline";
  return "unknown";
}

/** The one plain line a person reads. */
export function troubleWords(t: Trouble, door: Door): string {
  const who = door === "email" ? "email" : `${DOOR_NAME[door]} account`;
  switch (t) {
    case "not-ready":         return "Verve is not ready to add a sign-in method yet. Nothing was changed.";
    case "belongs-elsewhere": return `That ${who} already opens a different Verve account. Nothing was changed.`;
    case "already-here":      return `That ${who} is already on this account.`;
    case "email-elsewhere":   return "That email already opens a different Verve account. Nothing was changed.";
    case "same-email":        return "That is already this account's email.";
    case "bad-email":         return "That does not look like an email address.";
    case "bad-code":          return "That code was wrong or too old. Ask for a new one.";
    case "weak-password":     return "That password is too easy to guess. Try a longer one.";
    case "same-password":     return "That is already your password.";
    case "has-password":      return "This account already has a password. To change it, use Forgot password when you sign in.";
    case "fresh-sign-in":     return "Verve needs a fresh sign-in before it sets a password. Sign out, sign in, then try again.";
    case "too-many":          return "Too many tries just now. Wait a minute, then try again.";
    case "offline":           return "No connection. Nothing was changed.";
    case "unknown":           return "That did not work. Nothing was changed.";
  }
}

/** What to say once a door is on the account. */
export function addedWords(door: Door, email?: string | null): string {
  if (door === "email") return email ? `Added. You can now sign in with ${email} and your password.` : "Added. You can now sign in with your email and password.";
  return `Added. You can now sign in with ${DOOR_NAME[door]}.`;
}

// ── Back from Apple's or Google's page ───────────────────────────────────────
//
// Adding Apple or Google leaves this page for theirs and comes back to
// /my-health/ with a code, or with an error. The page is loaded afresh, so
// what was being added is kept in the browser for the trip.

export const PENDING_LINK = "verve:pending-link";
/** A trip longer than this was given up on: the note is ignored. */
export const PENDING_LINK_MAX_MS = 15 * 60_000;

export const pendingLinkValue = (door: "apple" | "google", now: number): string => `${door}:${now}`;

/** `trouble` null: no error came back. That is not yet "added": the account is read, and the account says. */
export type LinkBack = { door: "apple" | "google"; trouble: Trouble | null };

/**
 * What a return to the page means. Null unless a door was being added a few
 * minutes ago AND this address carries what a provider sends back: a code, or
 * an error. A plain visit with an old note in the browser is nothing.
 */
export function readLinkBack(href: string, pending: string | null | undefined, now: number): LinkBack | null {
  const [door, at] = String(pending ?? "").split(":");
  if (door !== "apple" && door !== "google") return null;
  const since = now - Number(at);
  if (!Number.isFinite(since) || since < 0 || since > PENDING_LINK_MAX_MS) return null;

  let query = new URLSearchParams(), hash = new URLSearchParams();
  try {
    const u = new URL(href);
    query = u.searchParams;
    hash = new URLSearchParams(u.hash.replace(/^#/, ""));
  } catch { return null; }
  const get = (k: string) => query.get(k) ?? hash.get(k) ?? "";
  const error = get("error"), code = get("error_code"), description = get("error_description");
  if (error || code || description) return { door, trouble: troubleOf({ code, message: description || error }) };
  if (query.has("code") || hash.has("access_token")) return { door, trouble: null };
  return null;
}
