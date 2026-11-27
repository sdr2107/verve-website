/**
 * The week, kept light (canvas "Verve, the plan you follow", board 08; decided by the founder on 25 November 2026:
 * "the user giving time and doing something is more important - not to overwhelm the user", then "Yes, amounts first").
 *
 * Most people will not open the page every day. So the first thing a week shows is three amounts, each "done of
 * asked": aerobic time, strength, steps. Under them, a few ideas from the activities the person ticked, and what
 * each session they logged this week filled.
 *
 * NOTHING IS COUNTED A SECOND WAY HERE.
 *   - What the week asks is the plan's own lines for the week (./midweek.ts askedOf, over planRowsNow), and for steps
 *     the plan's steps line or the person's own steps number.
 *   - What the week did is the plan's own reader (./guidePlan.ts doneOf): the app's week when it wrote one, else the
 *     sessions; the steps are the average of the days that have arrived.
 *   - Whether anything has arrived at all is the midweek note's test (./midweek.ts arrived).
 * An amount the horizon does not ask for is left out. A figure that has not arrived is left out: the page then shows
 * what is asked, and says nothing has arrived. It never shows a nought for a reading that is missing.
 *
 * THE IDEAS ARE RULES. A person's ticks (../../data/activities.ts) and which amounts are still short decide them;
 * no model writes one. They are offered only for an amount still short, and never more than five.
 *
 * WHAT A SESSION FILLED is read from the session: logged as strength, it is a strength session; with minutes at a
 * steady effort, those are its aerobic minutes; with a heart rate and none of it at a steady effort, it is a session
 * and active minutes; with no heart rate at all it is a session, and it adds no aerobic time. That last line is what
 * the counting does today (the app credits zone 2 from heart-rate samples), and the page says it as it is.
 *
 * A week that is not judged (short at either end of the horizon, or set aside) has no amounts: lightWeekOf is null.
 *
 * MONDAY'S EMAIL READS THE SAME AMOUNTS (board 09; the horizon function takes this file verbatim): the week that ended
 * is finishedWeekOf, the week that begins is asksOf, and the opening line names the week's sessions with sessionKinds.
 *
 * Pure, no DOM, no fetch; tests/light-week.test.mjs runs it under node.
 */
import { addDays, localDay } from "../derive/format.ts";
import { dedupeSessions, lastCompleteMonday, numberWord, spanOf, type HorizonLike, type Person, type PlanRow } from "./derive.ts";
import { doneOf } from "./guidePlan.ts";
import { arrived, askedOf } from "./midweek.ts";
import { ACTIVITIES, ACTIVITY_BY_KEY, FILL_WORDS, IDEAS_AT_MOST, LOGGED_WEEKS, OWN_AT_MOST, OWN_LENGTH, isActivityKey, type ActivityKey, type Fill } from "../../data/activities.ts";

const num = (x: unknown): number | null => (x != null && Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : null);
const thousands = (n: number) => Math.round(n).toLocaleString("en-GB");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── the three amounts ──

export type AmountKey = "aerobic" | "strength" | "steps";
export type Amount = {
  key: AmountKey; label: string;
  /** What the week did so far; null when nothing has arrived to count it from. */ done: number | null;
  /** What the week asks. */ of: number;
  /** "42 of 110", or "110" while nothing has arrived. */ figure: string;
  /** "min", "sessions", "a day"; with "asked" while nothing has arrived. */ unit: string;
  reached: boolean;
  /** One small line under the figure, or none. */ note: string | null;
};
export const AMOUNT_LABEL: Record<AmountKey, string> = { aerobic: "Aerobic time", strength: "Strength", steps: "Steps" };
export const AEROBIC_NOTE = "At a steady effort (zone 2). Any activity that gets you there.";
export const STEPS_NOTE = "The average of the days so far.";
export const REACHED = "Reached";
export const NOTHING_ARRIVED = "Nothing has arrived since Monday, so there is nothing to count yet. Open the app to send the week so far.";

export type LightWeek = {
  /** The week's Monday and Sunday. */ from: string; to: string;
  /** Its number among the horizon's judged weeks. */ week: number | null;
  /** Whether anything at all has arrived for the week. */ arrived: boolean;
  amounts: Amount[];
};

/**
 * The week today is in, as its three amounts. Null outside the horizon, in a week that is not judged (short, or set
 * aside), and when the week asks for none of the three.
 */
export function lightWeekOf(a: { horizon: HorizonLike; person: Person; today: string; rows: PlanRow[]; targets: { marker: string; target_value: number }[] }): LightWeek | null {
  const { horizon: h, person, today } = a;
  if (today < h.starts_on || today > h.ends_on) return null;
  const span = spanOf(h, today);
  if (!span || !span.full) return null;
  const asked = askedOf(a.rows, a.targets);
  const aerobic = num(asked.zone2), strength = num(asked.strength);
  // the plan's own steps line when it has one, else the number the person set
  const steps = num(a.rows.find((r) => r.kind === "steps_day")?.n) ?? num(a.targets.find((t) => t.marker === "steps")?.target_value);
  if (aerobic == null && strength == null && steps == null) return null;
  const here = arrived(person, span.from, addDays(today, 1));
  const d = doneOf(person, span.from);
  const amounts: Amount[] = [];
  const count = (key: AmountKey, done: number | null, of: number, unit: string, note: string | null, write: (n: number) => string = String) =>
    amounts.push({ key, label: AMOUNT_LABEL[key], done, of, figure: done != null ? `${write(done)} of ${write(of)}` : write(of), unit: done != null ? unit : `${unit} asked`, reached: done != null && done >= of, note });
  if (aerobic != null) count("aerobic", here ? d.zone2 : null, Math.round(aerobic), "min", AEROBIC_NOTE);
  if (strength != null) { const of = Math.round(strength); count("strength", here ? d.strength : null, of, of === 1 ? "session" : "sessions", null); }
  // steps are the days' own: a week with sessions and no day of steps on file has no steps figure yet
  if (steps != null) count("steps", d.steps, Math.round(steps), "a day", d.steps != null ? STEPS_NOTE : null, thousands);
  return { from: span.from, to: span.to, week: span.week, arrived: here, amounts };
}

// ── my activities ──

export type Chosen = {
  /** Ticked activities of the list, in the list's order. */ keys: ActivityKey[];
  /** Activities in the person's own words. */ own: string[];
  /** "chosen": the person ticked them. "sessions": nothing is ticked yet, and these are read from what they logged. */ from: "chosen" | "sessions";
};
const NOT_A_NAME = /^(other|workout|session|training|mixed|cardio|exercise)$/;
/** A logged session's name, as its first words: "Outdoor Walk (Apple Watch)" is "outdoor walk". */
const nameOf = (a: { activity_name?: unknown }): string => String(a?.activity_name ?? "").split(/[,(]/)[0].trim().toLowerCase();
/** The activity of the list a logged name is, or null. */
export const activityOfName = (name: string): ActivityKey | null => ACTIVITIES.find((x) => x.names?.test(name.toLowerCase()))?.key ?? null;
/** Own words made safe to keep: trimmed, short, no doubles, none that is already on the list, and only a few. */
export function cleanOwn(list: unknown): string[] {
  const out: string[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== "string") continue;
    const s = raw.replace(/\s+/g, " ").trim().slice(0, OWN_LENGTH).trim();
    if (!s || out.some((o) => o.toLowerCase() === s.toLowerCase()) || ACTIVITIES.some((x) => x.label.toLowerCase() === s.toLowerCase())) continue;
    out.push(s);
    if (out.length === OWN_AT_MOST) break;
  }
  return out;
}
/** Ticks made safe to keep: only keys of the list, each once, in the list's order. */
export const cleanKeys = (list: unknown): ActivityKey[] => { const set = new Set((Array.isArray(list) ? list : []).filter(isActivityKey)); return ACTIVITIES.filter((x) => set.has(x.key)).map((x) => x.key); };

/**
 * The activities the ideas draw from. What the person ticked, when they have ticked anything (the horizon keeps it:
 * ./programme.ts Programme.activities). Until then, what their sessions of the last eight weeks say, with walking,
 * and with strength where they said at set-up where they do it. The page says which of the two it is showing.
 */
export function chosenOf(programme: { activities?: ActivityKey[] | null; own?: string[] | null; place?: "home" | "gym" | "both" | null } | null, person: Person, today: string): Chosen {
  if (programme && Array.isArray(programme.activities)) return { keys: cleanKeys(programme.activities), own: cleanOwn(programme.own), from: "chosen" };
  const from = addDays(lastCompleteMonday(today), -7 * (LOGGED_WEEKS - 1));
  const set = new Set<ActivityKey>(["walking"]);
  const other = new Map<string, number>();
  let strength = false;
  for (const s of dedupeSessions(person.acts)) {
    if (localDay(s.timestamp) < from) continue;
    if (s.activity_type === "strength") { strength = true; continue; }
    const name = nameOf(s), key = activityOfName(name);
    if (key) set.add(key);
    else if (name && !NOT_A_NAME.test(name)) other.set(name, (other.get(name) ?? 0) + 1);
  }
  const place = programme?.place ?? null;
  if (strength || place) { if (place !== "gym") set.add("strength_home"); if (place === "gym" || place === "both") set.add("gym"); }
  const own = [...other.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([name]) => cap(name));
  return { keys: cleanKeys([...set]), own: cleanOwn(own), from: "sessions" };
}
export const CHOSEN_LEAD = "Tick what you do or can get to. Take cycling off, and no idea ever mentions a bike again. Nothing here changes what the week asks.";
export const CHOSEN_FROM_SESSIONS = "Nothing is ticked yet: these are from your sessions of the last eight weeks, with walking. Tick or untick one and the list is yours.";

// ── ideas for this week ──

export type Idea = { key: string; /** "A swim, 30 minutes" */ text: string; /** "aerobic time" */ fills: string };
export type Ideas =
  | { state: "ideas"; lead: string; ideas: Idea[] }
  /** Every amount is reached: one line, and nothing to do. */
  | { state: "reached"; line: string }
  /** Something is short and nothing ticked is offered for it. */
  | { state: "none"; line: string };
export const IDEAS_LEAD: Record<Chosen["from"], string> = {
  chosen: "From the activities you chose. Use one, or do your own thing: whatever you log counts.",
  sessions: "From the activities in your sessions. Use one, or do your own thing: whatever you log counts.",
};
export const IDEAS_NONE = "None of the activities you ticked is offered for what is left. Do your own thing: whatever you log counts.";
const reachedLine = (n: number) => `${n === 1 ? "This week's amount is" : n === 2 ? "Both amounts are" : `All ${numberWord(n)} amounts are`} reached. Nothing more is asked this week.`;

/**
 * At most five ideas, for the amounts still short, from the person's activities. One strength idea when strength is
 * short; a walk or a run when aerobic time or steps are short; the rest of the places go to the aerobic activities in
 * the list's order, then to the person's own. An amount with no figure yet counts as short: an idea does no harm.
 */
export function ideasFor(amounts: Amount[], chosen: Chosen): Ideas {
  if (!amounts.length) return { state: "none", line: IDEAS_NONE };
  const short = new Set(amounts.filter((x) => !x.reached).map((x) => x.key));
  if (!short.size) return { state: "reached", line: reachedLine(amounts.length) };
  const asked = new Set(amounts.map((x) => x.key));
  const mine = chosen.keys.map((k) => ACTIVITY_BY_KEY[k]).filter((x) => x && x.idea);
  const words = (fills: Fill[]) => fills.filter((f) => asked.has(f)).map((f) => FILL_WORDS[f]).join(", ");
  const idea = (x: (typeof ACTIVITIES)[number]): Idea => ({ key: x.key, text: x.minutes != null ? `${x.idea}, ${x.minutes} minutes` : x.idea!, fills: words(x.fills) });
  const strength = short.has("strength") ? mine.filter((x) => x.fills.includes("strength")).slice(0, 1) : [];
  const moving = short.has("aerobic") || short.has("steps") ? mine.filter((x) => x.fills.includes("steps")).slice(0, 1) : [];
  let left = IDEAS_AT_MOST - strength.length - moving.length;
  const aerobic = short.has("aerobic") ? mine.filter((x) => x.fills.includes("aerobic") && !x.fills.includes("steps")).slice(0, left) : [];
  left -= aerobic.length;
  // the person's own words are offered where aerobic time is short: what they fill is read when they are logged
  const own: Idea[] = short.has("aerobic") ? chosen.own.slice(0, Math.max(0, left)).map((s) => ({ key: `own:${s.toLowerCase()}`, text: s, fills: "your own" })) : [];
  const ideas = [...aerobic.map(idea), ...own, ...moving.map(idea), ...strength.map(idea)];
  return ideas.length ? { state: "ideas", lead: IDEAS_LEAD[chosen.from], ideas } : { state: "none", line: IDEAS_NONE };
}

// ── whatever you log counts ──

export type LoggedLine = {
  day: string;
  /** "Badminton · 45 min" */ logged: string;
  /** "24 aerobic minutes" */ filled: string;
  kind: "aerobic" | "strength" | "active" | "no_heart_rate";
};
export const COUNTS_HEAD = "Whatever you log counts";
export const COUNTS_NONE = "No session has arrived this week yet.";
/** The truth of the counting today: a session with no heart rate is a session, and adds no aerobic time. */
export const COUNTS_NOTE = "Your heart rate decides the line, not the name of the activity. A session that arrives with no heart rate is still a session, and it adds no aerobic time.";

/** The sessions logged in a stretch of days, each with what it filled, oldest first. */
export function loggedLines(person: Person, from: string, toExclusive: string): LoggedLine[] {
  const out: LoggedLine[] = [];
  for (const s of dedupeSessions(person.acts)) {
    const day = localDay(s.timestamp);
    if (day < from || day >= toExclusive) continue;
    const min = Math.round(Number(s.duration_minutes) || 0);
    const strength = s.activity_type === "strength";
    const logged = `${cap(nameOf(s)) || (strength ? "Strength" : "A session")}${min > 0 ? ` · ${min} min` : ""}`;
    if (strength) { out.push({ day, logged, filled: "1 strength session", kind: "strength" }); continue; }
    const z2 = s.zone2_minutes != null && Number.isFinite(Number(s.zone2_minutes)) ? Math.round(Number(s.zone2_minutes)) : null;
    if (z2 != null && z2 > 0) out.push({ day, logged, filled: `${z2} aerobic ${z2 === 1 ? "minute" : "minutes"}`, kind: "aerobic" });
    else if (z2 === 0) out.push({ day, logged, filled: `A session and ${min} active ${min === 1 ? "minute" : "minutes"}. Not aerobic time, and not a strength session.`, kind: "active" });
    else out.push({ day, logged, filled: `A session${min > 0 ? ` and ${min} ${min === 1 ? "minute" : "minutes"}` : ""}. No heart rate came with it, so it adds no aerobic time.`, kind: "no_heart_rate" });
  }
  return out;
}

// ── Monday's email: the week that ended, and the week that begins (board 09, 26 November 2026) ──
//
// The founder, 25 November 2026: one email on Monday in two parts. Part B is the horizon: "what out of the three
// targets i achieved and where i was behind - and how i can achieve that for this week". Both halves are read here,
// from the same amounts the page shows, so the email and the page cannot disagree: the week that ended is this file's
// own week asked on its Sunday, and the week that begins is this file's own week asked on its Monday.
//
// Every sentence is a rule; no model writes one. For aerobic time the sentence is the plan's own (./guidePlan.ts, the
// `why` of a finished week's review): it is handed in, never rewritten here. For strength and steps the plan has no
// such rule yet, so the line says only what is true today: one way to fill what was short, from the person's own
// activities, and for steps that the plan's figure went up.

export type FinishedAmount = {
  key: AmountKey; label: string; done: number | null; of: number;
  /** "85 of 110 min", "1 of 2 sessions", "6,900 of 6,800 a day"; "110 min asked" when nothing arrived to count. */ figure: string;
  /** "Reached", "25 short", "Within 5 min", "Nothing arrived". */ word: string;
  state: "reached" | "short" | "none";
};
export type FinishedWeek = { from: string; to: string; week: number | null; amounts: FinishedAmount[] };
export const NOTHING_WORD = "Nothing arrived";

/**
 * The week that began on `monday`, whole: each amount as done of asked, and one word for it. Null where lightWeekOf
 * is null (a week that is not judged, a horizon that asks for none of the three).
 *
 * `within` is the plan's own allowance on aerobic minutes. The Guide's plan counts a week within five minutes of its
 * line as reached and moves on (./guidePlan.ts progressOf): where the email says "This week adds ten minutes", the
 * line above it must not say the week was short. Without a plan of the Guide's there is no allowance.
 */
export function finishedWeekOf(a: { horizon: HorizonLike; person: Person; monday: string; rows: PlanRow[]; targets: { marker: string; target_value: number }[]; within?: number | null }): FinishedWeek | null {
  const w = lightWeekOf({ horizon: a.horizon, person: a.person, today: addDays(a.monday, 6), rows: a.rows, targets: a.targets });
  if (!w || w.from !== a.monday) return null;
  const within = a.within != null && a.within > 0 ? a.within : 0;
  const amounts = w.amounts.map((x): FinishedAmount => {
    const figure = `${x.figure} ${x.unit}`;
    if (x.done == null) return { key: x.key, label: x.label, done: null, of: x.of, figure, word: NOTHING_WORD, state: "none" };
    if (x.done >= x.of) return { key: x.key, label: x.label, done: x.done, of: x.of, figure, word: REACHED, state: "reached" };
    if (x.key === "aerobic" && within && x.done >= x.of - within) return { key: x.key, label: x.label, done: x.done, of: x.of, figure, word: `Within ${within} min`, state: "reached" };
    return { key: x.key, label: x.label, done: x.done, of: x.of, figure, word: `${thousands(x.of - x.done)} short`, state: "short" };
  });
  return { from: w.from, to: w.to, week: w.week, amounts };
}

export type Ask = {
  key: AmountKey; label: string;
  /** "110 min", "2 sessions", "6,930 a day". */ ask: string;
  /** One plain sentence, by rule; null when there is nothing true to add. */ line: string | null;
};
export type WeekAsks = { from: string; to: string; week: number | null; asks: Ask[] };
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * What the week that begins on `today` asks, each amount with at most one sentence.
 *   aerobic   the plan's own sentence on what last week did to it (`why`), when the plan is the Guide's. Otherwise,
 *             where last week was short, one way to fill it from the person's activities.
 *   strength  where last week was short, one way: "Five moves at home counts as one."
 *   steps     that the figure went up from last week's, when it did; where last week was short, one way.
 * Null where lightWeekOf is null: a short last week, a week set aside, a horizon that asks for none of the three.
 */
export function asksOf(a: { horizon: HorizonLike; person: Person; today: string; rows: PlanRow[]; targets: { marker: string; target_value: number }[];
  /** The week before, as finishedWeekOf read it; null when it was not judged. */ finished?: FinishedWeek | null;
  /** The person's activities (chosenOf); null and no idea is offered. */ chosen?: Chosen | null;
  /** The plan's sentence on what the finished week did to this week's aerobic minutes; null when the plan is not the Guide's. */ why?: string | null }): WeekAsks | null {
  const w = lightWeekOf({ horizon: a.horizon, person: a.person, today: a.today, rows: a.rows, targets: a.targets });
  if (!w) return null;
  const before = (key: AmountKey) => a.finished?.amounts.find((x) => x.key === key) ?? null;
  const short = (key: AmountKey) => before(key)?.state === "short";
  // one way to fill an amount, from the person's activities: the first idea the page itself would offer for it
  const way = (x: Amount): string | null => {
    if (!a.chosen) return null;
    const ideas = ideasFor([{ ...x, done: 0, reached: false }], a.chosen);
    return ideas.state === "ideas" ? ideas.ideas[0]?.text ?? null : null;
  };
  const asks = w.amounts.map((x): Ask => {
    if (x.key === "aerobic") {
      const idea = !a.why && short("aerobic") ? way(x) : null;
      return { key: x.key, label: x.label, ask: `${x.of} min`, line: a.why ? a.why : idea ? `One way: ${lowerFirst(idea)}.` : null };
    }
    if (x.key === "strength") {
      const idea = short("strength") ? way(x) : null;
      return { key: x.key, label: x.label, ask: `${x.of} ${x.of === 1 ? "session" : "sessions"}`, line: idea ? `${idea} counts as one.` : null };
    }
    const was = before("steps");
    const more = was && x.of > was.of ? `${thousands(x.of - was.of)} more a day than last week asked` : null;
    const idea = short("steps") ? way(x) : null;
    return { key: x.key, label: x.label, ask: `${thousands(x.of)} a day`, line: more && idea ? `${more}; one way is ${lowerFirst(idea)}.` : more ? `${more}.` : idea ? `One way: ${lowerFirst(idea)}.` : null };
  });
  return { from: w.from, to: w.to, week: w.week, asks };
}

/**
 * A stretch of days as the opening line of Monday's email names it: how many sessions, and each kind once with its
 * count, most often first. A session is named by the list (./data/activities.ts) where its name is on it, "strength"
 * where it was logged as strength, and otherwise by its own first words.
 */
export type SessionKinds = { sessions: number; minutes: number; kinds: { name: string; n: number }[] };
export function sessionKinds(person: Person, from: string, toExclusive: string): SessionKinds {
  const count = new Map<string, number>();
  let sessions = 0, minutes = 0;
  for (const s of dedupeSessions(person.acts)) {
    const day = localDay(s.timestamp);
    if (day < from || day >= toExclusive) continue;
    sessions++;
    minutes += Math.max(0, Math.round(Number(s.duration_minutes) || 0));
    const name = nameOf(s), key = s.activity_type === "strength" ? null : activityOfName(name);
    const kind = s.activity_type === "strength" ? "strength" : key ? ACTIVITY_BY_KEY[key].label.toLowerCase() : name && !NOT_A_NAME.test(name) ? name : "other";
    count.set(kind, (count.get(kind) ?? 0) + 1);
  }
  // most often first; "other" last; ties in the order they were first logged
  const kinds = [...count.entries()].map(([name, n], i) => ({ name, n, i })).sort((x, y) => Number(x.name === "other") - Number(y.name === "other") || y.n - x.n || x.i - y.i).map(({ name, n }) => ({ name, n }));
  return { sessions, minutes, kinds };
}
