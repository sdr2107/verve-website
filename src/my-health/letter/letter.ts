/**
 * The weekly letter's page, its arithmetic and its words (canvas "Verve, Horizon as a programme", board 32; built
 * 20 November 2026). Pure; tests/letter.test.mjs.
 *
 * The page does not draw the letter: the `letter` function does (METTracker supabase/functions/letter/render.ts),
 * and "See it" shows what the function returns. What is here is everything around that: which of the five small
 * pages a letter is on, whether the words changed since a test went, what the checks say, and what the page says
 * when a send stops.
 */

export type Letter = {
  id: string; subject: string; preheader: string; body: string;
  created_at: string; updated_at: string;
  /** When a test went, and the sum of the words it carried. */
  tested_at: string | null; tested_hash: string | null;
  send_started_at: string | null; send_finished_at: string | null;
  /** How many addresses it was written for when Send was pressed. */
  to_count: number | null;
};
export type Counts = { letter_id: string; queued: number; gone: number; delivered: number; bounced: number; complained: number; skipped: number; unsubscribed: number; reported: boolean };
export type Audience = { confirmed: number; waiting: number; stopped: number };
export type Checks = { subject_length: number; subject_fits: boolean; links: { href: string; ok: boolean }[]; days_since_last: number | null };
export type Words = { subject: string; preheader: string; body: string };

export const STEPS = ["Write", "See it", "Send yourself one", "Send", "After"] as const;
export const QUESTIONS = [
  "What does this week's letter say?",
  "Is this how it should arrive?",
  "Does it read right in your own inbox?",
  "Send it?",
  "What happened to it?",
] as const;
/** Most inboxes show about this much of a subject. */
export const SUBJECT_FITS = 60;
/** The list was promised one letter a week: a second one inside this many days is said before it goes. */
export const WEEK_GAP_DAYS = 6;

/**
 * What the words are, for telling whether they changed since a test went. The function computes the same sum
 * (render.ts wordsOf / wordsHash); one fixed input is pinned in the tests of both.
 */
export function wordsOf(w: Words): string {
  return JSON.stringify([String(w.subject ?? "").trim(), String(w.preheader ?? "").trim(), String(w.body ?? "").replace(/\r\n?/g, "\n").trim()]);
}
export async function wordsHash(w: Words): Promise<string> {
  const sum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(wordsOf(w)));
  return [...new Uint8Array(sum)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Why the words cannot go on to "See it" yet; empty when they can. The function says the same. */
export function notReady(w: Words): string {
  if (!w.subject.trim()) return "The letter has no subject.";
  if (w.subject.trim().length > 200) return "The subject is longer than 200 characters.";
  if (!w.body.trim()) return "The letter has no words.";
  if (w.body.length > 40000) return "The letter is longer than 40,000 characters.";
  return "";
}
export function subjectHint(subject: string): string {
  const n = subject.trim().length;
  if (!n) return "Most inboxes show about 60 characters.";
  return `${n} ${n === 1 ? "character" : "characters"}. Most inboxes show about ${SUBJECT_FITS}.`;
}

/** The letter being written: the newest one that has not begun to go. */
export const draftOf = (letters: Letter[]): Letter | null =>
  [...letters].filter((l) => !l.send_started_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
/** A letter that began to go and did not finish: the page opens on it, with "Send to the rest". */
export const halfwayOf = (letters: Letter[]): Letter | null => letters.find((l) => l.send_started_at && !l.send_finished_at) ?? null;
/** Every letter that has gone, or begun to, newest first. */
export const goneOf = (letters: Letter[]): Letter[] =>
  letters.filter((l) => !!l.send_started_at).sort((a, b) => ((a.send_started_at ?? "") < (b.send_started_at ?? "") ? 1 : -1));

/** A test of these exact words has gone. */
export const tested = (l: Pick<Letter, "tested_hash"> | null, hashNow: string): boolean => !!l?.tested_hash && !!hashNow && l.tested_hash === hashNow;

/** The furthest of the five pages a letter may be opened on (0 to 4). */
export function furthest(l: Letter | null, hashNow: string): number {
  if (!l) return 0;
  if (l.send_finished_at) return 4;
  if (l.send_started_at) return 3;
  if (tested(l, hashNow)) return 3;
  return notReady(l) ? 0 : 2;
}

/** What "See it" can say before anything is sent. `warn` rows are said, and do not stop the letter. */
export function checkLines(c: Checks): { warn: boolean; text: string }[] {
  const out: { warn: boolean; text: string }[] = [];
  const broken = c.links.filter((l) => !l.ok);
  if (!c.links.length) out.push({ warn: false, text: "The letter has no links." });
  else if (!broken.length) out.push({ warn: false, text: c.links.length === 1 ? "Its link opens." : "Every link opens." });
  else for (const b of broken) out.push({ warn: true, text: `A link did not open just now: ${b.href}` });
  out.push(c.subject_fits
    ? { warn: false, text: "The subject fits a phone." }
    : { warn: true, text: `The subject is ${c.subject_length} characters. Most inboxes show about ${SUBJECT_FITS}.` });
  if (c.days_since_last == null) out.push({ warn: false, text: "No letter has gone from here before." });
  else if (c.days_since_last < WEEK_GAP_DAYS) out.push({ warn: true, text: `The last letter went ${c.days_since_last === 0 ? "today" : c.days_since_last === 1 ? "yesterday" : `${c.days_since_last} days ago`}. The list was promised one a week.` });
  else out.push({ warn: false, text: `The last letter went ${c.days_since_last} days ago.` });
  return out;
}

/** The number typed on the Send page is the number of confirmed addresses, and there is at least one. */
export function typedRight(typed: string, a: Audience | null): boolean {
  return !!a && a.confirmed > 0 && /^\d+$/.test(typed.trim()) && Number(typed.trim()) === a.confirmed;
}

/** Why a send stopped, in the page's words. */
export function stoppedWords(stopped: string | null, left: number): string {
  if (!stopped) return "";
  const rest = `${left} ${left === 1 ? "address is" : "addresses are"} still to go.`;
  if (stopped === "limit") return `The sender stopped: its allowance is used up for now. ${rest} Nobody who has had it gets it again.`;
  if (stopped === "busy") return `Another press is already sending this letter. ${rest}`;
  if (stopped === "could_not_mark" || stopped === "could_not_read") return `It stopped on our side. ${rest} Nobody who has had it gets it again.`;
  return `The sender refused it. ${rest} Nobody who has had it gets it again.`;
}

/** "Thu 19 Nov", in the reader's own zone. */
export function dayShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
export function clock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** One row of "every letter that has gone". A count the sender has not reported is null, drawn as a dash: never a zero. */
export function goneRow(l: Letter, c: Counts | undefined): { sent: string; subject: string; to: number; delivered: number | null; bounced: number | null; left: number } {
  return {
    sent: dayShort(l.send_started_at), subject: l.subject,
    to: c ? c.gone : 0,
    delivered: c?.reported ? c.delivered : null,
    bounced: c?.reported ? c.bounced : null,
    left: c?.unsubscribed ?? 0,
  };
}

// ── pasting ─────────────────────────────────────────────────────────────────────────────
/** The little of a DOM node this reads: enough for the browser's own nodes, and for a stand-in in the tests. */
export type PastedNode = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<PastedNode>; getAttribute?: (name: string) => string | null };
const BLOCK = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "SECTION", "ARTICLE", "TR", "UL", "OL", "FIGURE", "HR"]);
const DROP = new Set(["SCRIPT", "STYLE", "IMG", "PICTURE", "SVG", "VIDEO", "AUDIO", "IFRAME", "BUTTON", "FIGCAPTION", "NOSCRIPT"]);
/**
 * What was pasted from a web page (Substack's editor, a post), as the letter's plain words: the paragraphs and the
 * links are kept, everything else is dropped.
 */
export function pastedWords(root: PastedNode): string {
  let out = "";
  const brk = () => { if (out && !out.endsWith("\n\n")) out = out.replace(/[ \t]*\n?$/, "") + "\n\n"; };
  const walk = (n: PastedNode) => {
    if (n.nodeType === 3) { out += (n.textContent ?? "").replace(/\s+/g, " "); return; }
    if (n.nodeType !== 1) return;
    const name = n.nodeName.toUpperCase();
    if (DROP.has(name)) return;
    if (name === "BR") { out = out.replace(/[ \t]+$/, "") + "\n"; return; }
    if (name === "A") {
      const href = n.getAttribute?.("href") ?? "";
      const label = (n.textContent ?? "").replace(/\s+/g, " ").trim().replace(/[\[\]]/g, "");
      if (/^https?:\/\//.test(href) && label) { out += label === href ? href : `[${label}](${href})`; return; }
    }
    const block = BLOCK.has(name);
    if (block) brk();
    for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
    if (block) brk();
  };
  walk(root);
  return out.split(/\n{2,}/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join("\n")).filter(Boolean).join("\n\n");
}
