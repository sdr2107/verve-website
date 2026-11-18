/**
 * The programme's set-up, one card at a time (canvas "Verve, Horizon as a programme", board 18; the founder, 18
 * November 2026: "Can the five cards that are asked prior to the 6th card be show as a slide show of cards ... next
 * and back buttons built in - so that its not a long scroll").
 *
 * Seven cards: six with Next and Back, then the numbers, which get the whole page. This file holds the rules and none
 * of the drawing: which cards there are, the one answer each needs before Next lights, how far a person may open, the
 * address each card has, and the answers kept for the tab so a reload loses nothing.
 *
 * Nothing is kept on the account before "Keep this horizon". The answers here live in the tab's own storage and are
 * cleared when the horizon is kept or the set-up is left.
 *
 * The rules are pure; tests/setup-cards.test.mjs runs them under node.
 */

export const SETUP_CARDS = [
  { key: "day", label: "The day" },
  { key: "goal", label: "What for" },
  { key: "writer", label: "Who writes" },
  { key: "reads", label: "What the page reads" },
  { key: "three", label: "Three things" },
  { key: "beside", label: "Beside it" },
  { key: "numbers", label: "Your numbers" },
] as const;
export type SetupCardKey = (typeof SETUP_CARDS)[number]["key"];
export const CARD_COUNT = SETUP_CARDS.length;
/** The numbers are the last card, and are drawn as a page of their own. */
export const NUMBERS_CARD = CARD_COUNT;

/** What the cards' rules need to know of the answers so far. */
export type SetupFacts = {
  /** A day was picked (board 14); with one, its date is the card's needed answer. */
  hasDay: boolean;
  /** The day's date is given and ahead of today. */
  dateAhead: boolean;
  /** What the horizon is for is chosen. */
  goal: boolean;
  /** The Guide writes the plan and can keep one, so its three health questions are asked. */
  guideAsks: boolean;
  /** All three are answered. */
  screenAnswered: boolean;
  /** A coach was chosen to write or edit the week, and nobody shares this page with them yet. */
  coachNeeded: boolean;
  /** What the coach part of the card holds: nothing, an email that can be used, one that cannot, the person's own, or "invite them later". */
  coach: "none" | "ok" | "bad" | "self" | "later";
  /** With an email given, at least one thing is ticked for them to see. */
  coachTicks: boolean;
  /** A coach who writes the week has the tick that lets them see the horizon ("Activity and fitness"). */
  coachSeesHorizon: boolean;
  /** A diet chart was read and is still waiting for the person's check. */
  chartUnchecked: boolean;
};

/** Why a card's Next is not lit: one short line, or "" when the card has what it needs. Cards 4 and 6 need nothing, until a coach has to be invited. */
export function cardNeeds(key: SetupCardKey, f: SetupFacts): string {
  switch (key) {
    case "day": return f.hasDay && !f.dateAhead ? "Give the day's date. It has to be ahead of today." : "";
    case "goal": return f.goal ? "" : "Choose what this horizon is for.";
    case "writer": return "";
    case "reads": return "";
    case "three": return f.guideAsks && !f.screenAnswered ? "Answer the three questions about your health." : "";
    case "beside":
      if (f.chartUnchecked) return "Check what was read from the chart, or leave that file.";
      if (f.coach === "bad") return "That email is not complete.";
      if (f.coach === "self") return "That email is yours. Give your coach's.";
      if (f.coach === "ok" && !f.coachTicks) return "Tick at least one thing for them to see.";
      if (f.coach === "ok" && f.coachNeeded && !f.coachSeesHorizon) return "A coach who writes the week needs \"Activity and fitness\" to see the horizon.";
      if (f.coachNeeded && f.coach === "none") return "Give your coach's email, or choose to invite them later.";
      return "";
    case "numbers": return "";
  }
}
export const cardReady = (key: SetupCardKey, f: SetupFacts): boolean => cardNeeds(key, f) === "";
/** Card 6 is optional until a coach who writes the week has to be invited (board 18). */
export const besideOptional = (f: Pick<SetupFacts, "coachNeeded">): boolean => !f.coachNeeded;

/**
 * The furthest card a person may open, 1 to 7: one past the last card that has what it needs, counted from the first,
 * and never past the furthest card they have already seen plus one. So no card is reached by its address alone, and a
 * card already seen can be opened again from the rail.
 */
export function reachOf(f: SetupFacts, seen: number): number {
  let n = 1;
  while (n < CARD_COUNT && cardReady(SETUP_CARDS[n - 1].key, f)) n++;
  return Math.max(1, Math.min(n, Math.max(1, seen) + 1, CARD_COUNT));
}
/**
 * The card shown for the one asked for: the one asked where it may be opened. An address past that lands on the
 * furthest card already seen that may still be opened, so a set-up opened afresh at a late card's address starts on
 * its first card, and an answer taken back returns to the card that needs it.
 */
export function cardShown(asked: number, f: SetupFacts, seen: number): number {
  const want = Number.isFinite(asked) ? Math.max(1, Math.round(asked)) : 1;
  const reach = reachOf(f, seen);
  return want <= reach ? want : Math.max(1, Math.min(reach, Math.max(1, seen)));
}

// ── a card's address ──

/** The set-up's route inside Horizon's pane: "new" is card 1, "new-4" card 4. 0 for a route that is not the set-up. */
export function cardOfRoute(route: string): number {
  if (route === "new") return 1;
  const m = /^new-([1-9])$/.exec(route);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= CARD_COUNT ? n : 0;
}
export const routeOfCard = (card: number): string => (card > 1 && card <= CARD_COUNT ? `new-${card}` : "new");

/** An email a share can be made to. The access sheet's own check is the browser's; this is the same shape. */
export const emailShape = (s: string): "none" | "ok" | "bad" => { const t = s.trim(); return !t ? "none" : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? "ok" : "bad"; };

// ── the answers, kept for the tab ──

const KEY = "verve-horizon-setup";
/** Bumped when the shape of what is kept changes: an older copy is then ignored. */
const VERSION = 1;
/** What the set-up keeps for a reload: the person it is for, and the answers as the page holds them. */
export type KeptSetup = { v: number; person: string; seen: number; answers: Record<string, unknown> };
/** The kept answers for this person, or null: none kept, another person's, an older shape, or a private window. */
export function loadSetup(person: string): KeptSetup | null {
  try {
    const x = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return x && x.v === VERSION && x.person === person && x.answers && typeof x.answers === "object" ? { v: VERSION, person, seen: Number.isFinite(Number(x.seen)) ? Math.max(1, Math.min(CARD_COUNT, Number(x.seen))) : 1, answers: x.answers } : null;
  } catch { return null; }
}
export function saveSetup(person: string, seen: number, answers: Record<string, unknown>) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ v: VERSION, person, seen, answers })); } catch { /* a private window: a reload starts again */ }
}
export function clearSetup() { try { sessionStorage.removeItem(KEY); } catch { /* nothing was kept */ } }
