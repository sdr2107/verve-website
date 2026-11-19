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
