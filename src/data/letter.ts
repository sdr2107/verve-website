/**
 * The letter's box on the Horizon page: the sentence a person agrees to, and the word a post's link may carry
 * (canvas "Verve, Horizon as a programme", board 27; decided 19 November 2026).
 *
 * The sentence is stored with the row in newsletter_signups, so the record says what was agreed to and not only
 * when. Change it here and it changes for new rows only.
 */
export const LETTER_CONSENT =
  "We use your address for the Verve letter, one a week, and for nothing else. Every letter has an Unsubscribe button.";
/** Said wherever an address has just been left: the weekly letter starts only on a press made from the mailbox. */
export const LETTER_PRESS = "One press inside it keeps the weekly letter coming.";

/**
 * The word on a post's link, /horizon?from=clip-12: which post brought the reader. Lower-case letters, digits and
 * dashes, at most forty, starting with a letter or a digit (the database checks the same shape). Anything else is
 * no tag: the address is still kept, and nothing is said about where it came from.
 */
export function tagOf(search: string): string | null {
  let raw = "";
  try { raw = new URLSearchParams(search).get("from") ?? ""; } catch { return null; }
  const tag = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(tag) ? tag : null;
}

// ── what a page says after an address is left ───────────────────────────────────────────
/**
 * The newsletter-welcome function's answer (METTracker supabase/functions/newsletter-welcome/again.ts). Since
 * 21 November 2026 an address that is on the list already no longer gets silence: the account that owns it
 * is switched on at once, and an address typed into a box is sent one note with the press, at most once in 7 days
 * and three times in all. A page says which of these happened, and promises a letter only when one went.
 */
export type WelcomeAnswer = { sent?: boolean; reason?: string; again?: boolean; lately?: boolean; write?: boolean; on?: boolean; back?: boolean; days?: number } | null | undefined;
/**
 *   first    the first letter went
 *   again    the note with the press went, to an address that was stopped or still waiting
 *   back     the account's own address was switched on, no press needed
 *   on       the address is on the list and reading the letter: nothing was sent
 *   lately   a letter with the press went within the last days: nothing was sent
 *   write    nothing can be sent from a box: the notes are used up, or a letter bounced or was marked as spam
 *   failed   the note could not be sent, and nothing sends it later
 *   later    a first letter could not be sent now: the daily retry sends it
 *   had, stopped   the function as it answered before 21 November 2026
 */
export type AfterKind = "first" | "again" | "back" | "on" | "lately" | "write" | "failed" | "later" | "had" | "stopped";
export function afterKind(data: WelcomeAnswer, failed: boolean): AfterKind {
  if (failed || !data || typeof data !== "object") return "later";
  if (data.sent === true) return data.again === true ? "again" : "first";
  if (data.again === true) return "failed";
  if (data.lately === true) return "lately";
  if (data.write === true) return "write";
  if (data.back === true) return "back";
  if (data.on === true) return "on";
  if (data.reason === "already sent") return "had";
  if (data.reason === "unsubscribed") return "stopped";
  return "later";
}
/** Whether a letter is on its way after this answer: what "While you wait" may be said over. */
export const letterComing = (kind: AfterKind): boolean => kind === "first" || kind === "again" || kind === "later";

const FROM = "hello@verve-app.health";
const daysOf = (days: unknown): number => (typeof days === "number" && days >= 1 && days <= 60 ? Math.round(days) : 7);

/** The Horizon page's box: the heading and the sentence under it. */
export function letterAfter(email: string, kind: AfterKind, days?: number): { head: string; text: string } {
  switch (kind) {
    case "first": return { head: "The first letter is on its way.", text: `To ${email}, from ${FROM}. ${LETTER_PRESS}` };
    case "again": return { head: "A letter is on its way.", text: `To ${email}, from ${FROM}. ${LETTER_PRESS}` };
    case "back": return { head: "The letter is on.", text: `It comes to ${email} once a week. Nothing more is needed.` };
    case "on": return { head: "You are on the list.", text: `${email} is on the list already. The next letter comes to it.` };
    case "lately": return { head: "A letter has gone already.", text: `A letter with the press has gone to ${email}. Look for it from ${FROM}, in spam too. Another can be sent ${daysOf(days)} days after it.` };
    case "write": return { head: "Not from this box.", text: `The letter cannot be started for ${email} from here. Write to ${FROM}.` };
    case "failed": return { head: "The letter could not be sent.", text: `Nothing went to ${email} just now. Reload this page and try again in a minute.` };
    case "had": return { head: "The first letter went earlier.", text: `${email} has had the first letter already. The press that starts the weekly letter is inside it.` };
    case "stopped": return { head: "The letters are stopped.", text: `${email} asked for no more letters. The first letter you had carries a press that starts them again.` };
    default: return { head: "Your address is saved.", text: `The letter to ${email} could not be sent just now. It goes out within a day. ${LETTER_PRESS}` };
  }
}

/** The sheet's box (/start and /sheet): the line under the sheet's link. The sheet is on the page whatever happened. */
export function sheetAfter(kind: AfterKind): string {
  switch (kind) {
    case "first": return `A copy is on its way to your inbox, from ${FROM}. ${LETTER_PRESS}`;
    case "again": return `The link above is the sheet. A letter with the press that starts the weekly letter is on its way to your inbox, from ${FROM}.`;
    case "back": return "The link above is the sheet. The weekly letter is on for your address.";
    case "on": return "The link above is the sheet. Your address is on the list already, and the next letter comes to it.";
    case "lately": return `The link above is the sheet. A letter with the press has gone to your address already: look for it from ${FROM}, in spam too.`;
    case "write": return `The link above is the sheet. The weekly letter cannot be started for this address from here: write to ${FROM}.`;
    case "failed": return "The link above is the sheet. The letter could not be sent just now. Try again in a minute.";
    case "had": return "You already had the first letter by email; the link above is the same sheet. The press that starts the weekly letter is inside that email.";
    case "stopped": return "The link above is the sheet. This address asked for no more letters, so no copy was sent.";
    default: return "The email copy could not be sent just now; it will go out within a day. The link above is the same sheet.";
  }
}

const RELAY = /@privaterelay\.appleid\.com$/i;
/** An address Apple made is never printed: the page says whose it is. */
export const addressWords = (to: string): string => (RELAY.test(to) ? "the address Apple keeps for you" : to);

/** My health, after "Yes, send it": one sentence. The account's answer is saved by then, whatever the letter did. */
export function accountAfter(to: string, kind: AfterKind): string {
  const where = addressWords(to), relay = RELAY.test(to);
  switch (kind) {
    case "first": return `Done. The first letter is on its way to ${where}, from ${FROM}.`;
    case "again": return `Done. A letter is on its way to ${where}, from ${FROM}. ${LETTER_PRESS}`;
    case "back": return `Done. The letter is on for ${where}. The next one comes to it.`;
    case "on": return relay ? "You are on the list already; the next letter comes to you." : `${to} is on the list already; the next letter comes to it.`;
    case "lately": return `Saved. A letter with the press has gone to ${where} already. Look for it from ${FROM}, in spam too.`;
    case "write": return `Saved, but the letter cannot be started for ${where} from here. Write to ${FROM}.`;
    case "failed": return `Saved. The letter to ${where} could not go out just now. Write to ${FROM} if none comes.`;
    case "had": return relay ? "You already had the first letter; the next ones follow." : `${to} already had the first letter; the next ones follow.`;
    case "stopped": return `Saved, but ${where} asked for no more letters earlier. The first letter it had carries a press that starts them again.`;
    default: return `Saved. The first letter to ${where} could not go out just now; it goes within a day.`;
  }
}
