/**
 * "Write to us", on the Help page: what the form checks before it sends, and the two things it may add
 * (canvas "Verve, Horizon as a programme", board 33).
 *
 * The judge is the function, METTracker supabase/functions/help-message/message.ts. These rules mirror it, so
 * the page can say what is wrong before anything is sent. If the two ever differ, the function's answer is the
 * one the person sees.
 *
 * What may be added to a message is the page the person came from and their browser in a few words, shown on
 * the form before it is sent and only while the box is ticked. Never a figure, never a name, never anything
 * from the person's own page.
 *
 * Pure; tests/help.test.mjs.
 */

export const HELP_LIMITS = { min: 3, doing: 1000, saw: 2000, page: 120, browser: 80, email: 254 } as const;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isEmail = (email: string): boolean => EMAIL.test(email) && email.length <= HELP_LIMITS.email;
/** An address Apple made to hide a person's own. Apple passes on mail only from senders it has on file. */
export const isRelay = (email: string): boolean => /@privaterelay\.appleid\.com$/i.test(email.trim());

/** Whether the form must ask where a reply should go: nobody is signed in, or Apple hides the account's address. */
export function needsAddress(who: { signedIn: boolean; ownEmail: string }): boolean {
  const own = who.ownEmail.trim();
  return !who.signedIn || !isEmail(own) || isRelay(own);
}

export type HelpInput = { doing: string; saw: string; email: string; signedIn: boolean; ownEmail: string };
export type HelpCheck = { ok: true; email: string } | { ok: false; field: "doing" | "saw" | "email"; error: string };

/** The form, checked. The address returned is where a reply will go. */
export function checkHelp(x: HelpInput): HelpCheck {
  const doing = x.doing.trim(), saw = x.saw.trim();
  if (doing.length < HELP_LIMITS.min) return { ok: false, field: "doing", error: "Say a few words in both boxes." };
  if (saw.length < HELP_LIMITS.min) return { ok: false, field: "saw", error: "Say a few words in both boxes." };
  if (doing.length > HELP_LIMITS.doing) return { ok: false, field: "doing", error: `That is longer than this box takes (${HELP_LIMITS.doing} characters).` };
  if (saw.length > HELP_LIMITS.saw) return { ok: false, field: "saw", error: `That is longer than this box takes (${HELP_LIMITS.saw} characters).` };
  const typed = x.email.trim().toLowerCase();
  if (needsAddress(x)) {
    if (!isEmail(typed)) return { ok: false, field: "email", error: "That does not look like an email address." };
    if (isRelay(typed)) return { ok: false, field: "email", error: "That is an address Apple hides, and a reply could not reach it. One Apple does not hide, please." };
    return { ok: true, email: typed };
  }
  return { ok: true, email: x.ownEmail.trim().toLowerCase() };
}

/**
 * The page a person came from, as this site's own path and nothing more: no host, no query (a link from an
 * email carries a token there), and a hash only when it is plain words. A horizon's page carries that
 * horizon's own id in its address; only the word "horizon" is kept. Anything else reads as no page.
 */
export function safePage(from: string, origin: string): string | null {
  if (!from.trim()) return null;            // no page is known: nothing to add
  let u: URL;
  try { u = new URL(from, origin); } catch { return null; }
  if (u.origin !== origin) return null;
  const path = u.pathname;
  if (!/^\/[a-z0-9\-/]*$/.test(path)) return null;
  let hash = u.hash;
  if (/^#horizon/.test(hash)) hash = hash === "#horizon-new" ? hash : "#horizon";
  if (!/^#[a-z]+(-[a-z]+){0,3}$/.test(hash) || hash.length > 41) hash = "";
  const page = path + hash;
  return page.length <= HELP_LIMITS.page && !/^\/help\/?$/.test(path) ? page : null;
}

/** The browser, in the few words a person would use: "Safari on an iPhone". Never the whole string it sends. */
export function browserWords(ua: string, o: { brave?: boolean } = {}): string {
  const on = /iPhone|iPod/.test(ua) ? "an iPhone" : /iPad/.test(ua) ? "an iPad" : /Android/.test(ua) ? "Android"
    : /Macintosh|Mac OS X/.test(ua) ? "a Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "a Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  const name = o.brave ? "Brave" : /Edg(e|A|iOS)?\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /SamsungBrowser\//.test(ua) ? "Samsung Internet" : /Chrome\/|CriOS\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  if (!name && !on) return "";
  return `${name || "A browser"}${on ? ` on ${on}` : ""}`;
}

/** The line under the tick box: exactly what will travel with the message. */
export function addedWords(x: { page: string | null; browser: string }): string {
  const parts = [x.page ? `the page you came from (${x.page})` : "", x.browser ? `your browser (${x.browser})` : ""].filter(Boolean);
  return parts.length ? `This will be added: ${parts.join(" and ")}.` : "Nothing can be added from here: no page or browser is known.";
}

/** What the form sends. With the box unticked, nothing is added. */
export function helpBody(x: { doing: string; saw: string; email: string; add: boolean; page: string | null; browser: string; website: string }): Record<string, string> {
  const body: Record<string, string> = { doing: x.doing.trim(), saw: x.saw.trim(), email: x.email, website: x.website };
  if (x.add && x.page) body.page = x.page;
  if (x.add && x.browser) body.browser = x.browser;
  return body;
}
