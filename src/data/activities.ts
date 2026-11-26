/**
 * "My activities", and the ideas a week offers from them (canvas "Verve, the plan you follow", board 08; the founder,
 * 25 November 2026: "the user giving time and doing something is more important - not to overwhelm the user").
 *
 * A week on Horizon asks for amounts: aerobic time, strength sessions, steps a day. What a person does with that
 * time is theirs. This file is the short list they tick from, and one plain idea for each: a rule, never a model's
 * sentence, so the same ticks and the same week always give the same ideas.
 *
 * NOTHING HERE CHANGES WHAT A WEEK ASKS, AND NOTHING HERE COUNTS ANYTHING. What a logged session fills is decided by
 * the session itself (its heart rate, and whether it was logged as strength): ../my-health/horizon/lightWeek.ts reads
 * that from the same figures the plan reads. `fills` below is only what an idea is offered FOR.
 *
 * Yoga is on the list and has no idea: it is a session and active minutes, and is never offered as aerobic time or
 * as a strength session (the board says so).
 */
export type Fill = "aerobic" | "steps" | "strength";
export type ActivityKey = "walking" | "cycling" | "swimming" | "badminton" | "aerobics" | "kickboxing" | "yoga" | "strength_home" | "gym" | "running";
export type Activity = {
  key: ActivityKey;
  /** The chip's word. */ label: string;
  /** The idea, as the page says it; null for an activity that is never offered as an idea. */ idea: string | null;
  /** The idea's usual minutes; null where an idea is a session and not a length of time. */ minutes: number | null;
  /** The amounts the idea is offered for. */ fills: Fill[];
  /** A logged session of this activity, by its name. Null where the name does not say (strength is read from the session's kind). */ names: RegExp | null;
};

/** The chips, in the order they are drawn (the board's). */
export const ACTIVITIES: Activity[] = [
  { key: "walking", label: "Walking", idea: "A brisk walk after dinner", minutes: 20, fills: ["aerobic", "steps"], names: /\bwalk|\bhik/ },
  { key: "cycling", label: "Cycling", idea: "A bike ride", minutes: 40, fills: ["aerobic"], names: /cycl|\bbik|\bspin/ },
  { key: "swimming", label: "Swimming", idea: "A swim", minutes: 30, fills: ["aerobic"], names: /\bswim/ },
  { key: "badminton", label: "Badminton", idea: "Badminton with a friend", minutes: 45, fills: ["aerobic"], names: /badminton/ },
  { key: "aerobics", label: "Aerobics class", idea: "An aerobics class on YouTube", minutes: 30, fills: ["aerobic"], names: /aerobics|\bdanc|zumba/ },
  { key: "kickboxing", label: "Kickboxing", idea: "A kickboxing session", minutes: 40, fills: ["aerobic"], names: /kickbox|\bboxing|martial/ },
  { key: "yoga", label: "Yoga", idea: null, minutes: null, fills: [], names: /\byoga/ },
  { key: "strength_home", label: "Strength at home", idea: "Five moves at home", minutes: null, fills: ["strength"], names: null },
  { key: "gym", label: "Gym", idea: "A session at the gym", minutes: null, fills: ["strength"], names: null },
  { key: "running", label: "Running", idea: "An easy run", minutes: 25, fills: ["aerobic", "steps"], names: /\brun|\bjog/ },
];
export const ACTIVITY_BY_KEY: Record<string, Activity> = Object.fromEntries(ACTIVITIES.map((a) => [a.key, a]));
export const isActivityKey = (x: unknown): x is ActivityKey => typeof x === "string" && x in ACTIVITY_BY_KEY;

/** What an idea is offered for, in the page's words. */
export const FILL_WORDS: Record<Fill, string> = { aerobic: "aerobic time", steps: "steps", strength: "a strength session" };

/** At most this many ideas are shown. */
export const IDEAS_AT_MOST = 5;
/** Activities a person can add in their own words: how many, and how long each may be. */
export const OWN_AT_MOST = 3;
export const OWN_LENGTH = 30;
/** Until a person ticks anything, the list starts from the sessions of this many complete weeks before today. */
export const LOGGED_WEEKS = 8;
