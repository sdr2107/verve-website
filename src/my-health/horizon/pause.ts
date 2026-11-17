/**
 * Pausing a horizon for a week (canvas "Verve, Horizon as a programme", board 13; the founder, 16 and 17 November 2026).
 *
 * His rule: a horizon can be paused for one week, for illness, travel or anything else. Nothing in the paused week is
 * asked or judged, the date moves seven days later, and the person is not behind for it. The plan they pay for runs
 * on. His three additions, 17 November:
 *   A  the pause can reach back to the week that has just ended, until that week's following Sunday;
 *   B  a horizon has one pause for every three months it was set for (one, two, four), and at most two side by side;
 *   C  on the marathon goal the date stays, because a race is on the day it is on, and the plan closes up by a week.
 *
 * THE ONE RULE. The page asks here which weeks it may offer; the horizon function asks here before it writes
 * (METTracker supabase/functions/horizon, action `pause`, with this file vendored). The page never writes a pause:
 * horizons.pauses and horizons.ends_on_set are refused to a signed-in person by the database
 * (supabase/migrations/20261117_horizon_pause.sql), so a pause that this rule does not allow cannot be kept.
 *
 * How a paused week is then read (shown, not judged, no number) is ./derive.ts horizonSpans, which every reader of a
 * horizon's weeks already goes through.
 *
 * Pure, no DOM, no fetch; tests/pause.test.mjs runs it under node.
 */
import { addDays, mondayOf } from "../derive/format.ts";
import { addMonths, daysWords, horizonSpans, numberWord, pausesOf, type HorizonLike } from "./derive.ts";

/** A horizon's row, as much of it as the rule reads. */
export type PauseHorizon = HorizonLike & {
  kind?: string | null; months?: number | null; closed_at?: string | null;
  /** The date as first set, kept when a pause moves it; null or absent on a horizon whose date has not moved. */
  ends_on_set?: string | null;
  /** horizons.programme: only its goal is read here. */
  programme?: unknown;
};

/** Weeks that may sit side by side: a fortnight away, never more. */
export const PAUSES_TOGETHER = 2;
/** The most a horizon can hold, whatever its length. */
export const PAUSES_MOST = 4;

/** The date the person set, before any pause moved it. */
export const dateAsSet = (h: PauseHorizon): string => (h.ends_on_set ? String(h.ends_on_set).slice(0, 10) : h.ends_on);
/** Whether a pause moves the date. Not on the marathon goal: the race's day is not the page's to move. */
export const pauseMovesDate = (h: PauseHorizon): boolean => (h.programme && typeof h.programme === "object" ? (h.programme as { goal?: unknown }).goal : null) !== "marathon";

/**
 * How many weeks a horizon may set aside: one for every three months it was set for. A horizon set by its months says
 * so itself; one set by a date is counted in whole months from its start to the date as first set. Never fewer than
 * one, never more than four.
 */
export function pauseAllowance(h: PauseHorizon): number {
  let months = h.kind !== "date" && (h.months === 3 || h.months === 6 || h.months === 12) ? h.months : 0;
  if (!months) { const end = dateAsSet(h); while (months < 60 && addMonths(h.starts_on, months + 1) <= end) months++; }
  return Math.max(1, Math.min(PAUSES_MOST, Math.floor(months / 3)));
}

export type PauseKey = "last" | "this" | "next";
export type PauseWhy = "spent" | "closed" | "over" | "short" | "paused" | "together" | "outside";
export type PauseChoice = {
  key: PauseKey; /** The week's Monday. */ monday: string; to: string; /** "Mon 21 to Sun 27 Dec" */ words: string;
  ok: boolean; /** Why not, when it cannot be set aside. */ why: PauseWhy | null;
  /** The date after this pause: seven days later, or where it was on a goal whose day cannot move. */ ends_on: string;
};
const WHY_WORDS: Record<PauseWhy, string> = {
  spent: "Every pause of this horizon has been used.",
  closed: "This horizon is closed.",
  over: "This horizon has reached its date.",
  short: "A short week at either end is not judged, so there is nothing to pause.",
  paused: "That week is already paused.",
  together: "No more than two weeks can be paused together.",
  outside: "A pause is for last week, this week or next week.",
};
export const pauseWhyWords = (why: PauseWhy | null | undefined): string => (why ? WHY_WORDS[why] : "");

/** Why a week cannot be set aside today; null when it can. `monday` is the week's Monday, `today` the person's own day. */
export function pauseRefusal(h: PauseHorizon, monday: string, today: string): PauseWhy | null {
  if (h.closed_at) return "closed";
  if (today > h.ends_on) return "over";
  const thisMonday = mondayOf(new Date(today + "T00:00:00"));
  if (monday !== addDays(thisMonday, -7) && monday !== thisMonday && monday !== addDays(thisMonday, 7)) return "outside";
  const set = pausesOf(h);
  if (set.includes(monday)) return "paused";
  if (set.length >= pauseAllowance(h)) return "spent";
  // a week of seven days inside the horizon: the short first and last days are never judged, so they are never paused
  if (!horizonSpans(h).some((s) => s.from === monday && s.days === 7)) return "short";
  // with this week added, the longest run of paused weeks side by side
  const all = new Set([...set, monday]);
  let run = 1;
  for (let m = addDays(monday, -7); all.has(m); m = addDays(m, -7)) run++;
  for (let m = addDays(monday, 7); all.has(m); m = addDays(m, 7)) run++;
  return run > PAUSES_TOGETHER ? "together" : null;
}

/** Last week, this week and next week, each with whether it can be set aside today and the date that would follow. */
export function pauseChoices(h: PauseHorizon, today: string): PauseChoice[] {
  const thisMonday = mondayOf(new Date(today + "T00:00:00"));
  const moves = pauseMovesDate(h);
  return (["last", "this", "next"] as PauseKey[]).map((key, i) => {
    const monday = addDays(thisMonday, (i - 1) * 7), to = addDays(monday, 6);
    const why = pauseRefusal(h, monday, today);
    return { key, monday, to, words: daysWords(monday, to), ok: why == null, why, ends_on: moves ? addDays(h.ends_on, 7) : h.ends_on };
  });
}

export type PauseState = {
  allowed: number; used: number; left: number;
  /** Whether a pause moves this horizon's date. */ moves: boolean;
  choices: PauseChoice[];
  /** At least one week can be set aside today. */ open: boolean;
  /** The weeks already set aside, by their days: "21 to 27 Dec". */ taken: string[];
  /** "This horizon can be paused once.", "This horizon can be paused twice. One is left." */ words: string;
};
const TIMES = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${numberWord(n)} times`);
/** What the foot of a horizon's page reads: how many pauses it has, how many are left, and the weeks on offer today. */
export function pauseState(h: PauseHorizon, today: string): PauseState {
  const allowed = pauseAllowance(h), set = pausesOf(h), used = set.length, left = Math.max(0, allowed - used);
  const choices = pauseChoices(h, today);
  const taken = set.map((m) => daysWords(m, addDays(m, 6)).replace(/\b(Mon|Sun) /g, ""));
  const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const leftWords = !used ? "" : allowed === 1 ? " It has been used." : left === 0 ? " None is left." : ` ${capital(numberWord(left))} ${left === 1 ? "is" : "are"} left.`;
  return { allowed, used, left, moves: pauseMovesDate(h), choices, open: choices.some((c) => c.ok), taken, words: `This horizon can be paused ${TIMES(allowed)}.${leftWords}` };
}

/**
 * What a pause writes to the horizon's row: the week added to its paused weeks, and, where the date moves, the date
 * seven days later with the date as first set kept beside it. The function writes exactly this and nothing else.
 */
export function applyPause(h: PauseHorizon, monday: string, today: string): { ok: true; patch: { pauses: string[]; ends_on: string; ends_on_set: string | null } } | { ok: false; why: PauseWhy } {
  const why = pauseRefusal(h, monday, today);
  if (why) return { ok: false, why };
  const moves = pauseMovesDate(h);
  return { ok: true, patch: {
    pauses: [...pausesOf(h), monday].sort(),
    ends_on: moves ? addDays(h.ends_on, 7) : h.ends_on,
    ends_on_set: moves ? dateAsSet(h) : (h.ends_on_set ? String(h.ends_on_set).slice(0, 10) : null),
  } };
}

/**
 * Under the date, once a horizon has been paused: "Moved one week, from 16 February, by a pause." A date that stays
 * says that it stayed. Empty on a horizon that was never paused.
 */
export function movedWords(h: PauseHorizon): string {
  const n = pausesOf(h).length;
  if (!n) return "";
  const set = dateAsSet(h);
  if (set === h.ends_on) return `The date stays where it was. ${n === 1 ? "One week was" : `${numberWord(n).charAt(0).toUpperCase()}${numberWord(n).slice(1)} weeks were`} set aside, and the plan closes up by ${n === 1 ? "one week" : `${numberWord(n)} weeks`}.`;
  const from = new Date(set + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", ...(set.slice(0, 4) !== h.ends_on.slice(0, 4) ? { year: "numeric" } : {}) });
  return `Moved ${n === 1 ? "one week" : `${numberWord(n)} weeks`}, from ${from}, by ${n === 1 ? "a pause" : `${numberWord(n)} pauses`}.`;
}
