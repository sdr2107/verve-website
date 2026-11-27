/**
 * Horizon, made simple (the founder, 27 November 2026, after seeing the page live: "Too many screens - too complex to
 * follow. I want something simple." "I just want to know where am i now, what i did and how i am progressing in
 * fitness."). A horizon opens on one page with two tabs:
 *
 *   This week    where you are: five rows, always the same five and in the same order (zone 2, strength, steps, the
 *                weekly dose, fitness), each "done of asked" on one line. Then what you did: the week's sessions.
 *   Past weeks   how you are progressing: one row for each finished week, with the same four weekly figures, and
 *                fitness in one line.
 *
 * His five (the same day): "1. Strength minutes and sessions, 2. steps, 3. zone 2 minutes, 4. weekly MET-min dose and
 * 5. fitness in METs. these 5 should be in the horizon as default - any app can show this".
 *
 * NOTHING IS COUNTED A SECOND WAY HERE. What a week asks and what it did are the light week's own readers
 * (./lightWeek.ts lightWeekOf and finishedWeekOf, which ask ./midweek.ts askedOf and ./guidePlan.ts doneOf): the
 * three amounts the page showed until today, and the ones Monday's email says. The weekly dose is the person's own
 * number against the week's own dose. A week of the Guide's plan that is behind the person is read against the line
 * the plan kept for it (the plan's climb), never against today's. What is new here is only the order, the words and
 * one sum: the minutes of the week's strength sessions.
 *
 * A row whose number the horizon does not ask for still shows what was done. A figure that has not arrived is left
 * out: the row then says what is asked, or that nothing is there yet. It is never a nought for a missing reading.
 *
 * Pure, no DOM, no fetch; tests/simple-horizon.test.mjs runs it under node. The horizon function does not copy this
 * file: Monday's email reads lightWeek.ts itself.
 */
import { addDays, localDay } from "../derive/format.ts";
import RULES from "../../data/plan-rules.ts";
import { countedFigures, dayMonthLong, daysWords, dedupeSessions, horizonSpans, latestOf, round, spanOf, weekOf, weekWords, weekdayDayMonth, type HorizonLike, type Person, type PlanRow, type Span } from "./derive.ts";
import { doneOf, testWeeksOf, type ClimbRow } from "./guidePlan.ts";
import { finishedWeekOf, lightWeekOf } from "./lightWeek.ts";
import { arrived, askedOf } from "./midweek.ts";

/** A target as these pages read one: its marker, its number, and where the marker stood when the horizon was set. */
export type TargetLite = { marker: string; target_value: number; start_value?: number | null };

const num = (x: unknown): number | null => (x != null && Number.isFinite(Number(x)) ? Number(x) : null);
const thousands = (n: number) => Math.round(n).toLocaleString("en-GB");
const whole = (n: number) => String(Math.round(n));
const one = (v: number) => round(v, 1).toFixed(1);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayOf = (date: string) => DAYS[new Date(date + "T00:00:00").getDay()];

/** The header's one line: "Week 3 of 12 · to 22 February". A short or paused week says so in the week's place. */
export const headLine = (h: HorizonLike, today: string) => `${cap(weekWords(h, today))} · to ${dayMonthLong(h.ends_on)}`;

// ── what you did ──

export type SessionRow = {
  date: string; /** "Mon" */ day: string; /** "Badminton" */ name: string; /** "45 min"; empty for a session with no length */ minutes: string;
  /** What it counted as, in a few words: "24 zone 2 min", "1 strength session", "active time", "no heart rate". */ counted: string;
  kind: "aerobic" | "strength" | "active" | "no_heart_rate";
};
export const NO_SESSIONS = "No session has arrived this week yet.";

/**
 * The sessions of a stretch of days, oldest first, each with what it counted as. The rule is the light week's own
 * (./lightWeek.ts loggedLines, and the test holds the two together): logged as strength, a strength session; with
 * minutes at a steady effort, those minutes; with a heart rate and none of it steady, active time; with no heart
 * rate, a session that adds no aerobic time.
 */
export function sessionRows(person: Person, from: string, toExclusive: string): SessionRow[] {
  const out: (SessionRow & { at: string })[] = [];
  for (const s of dedupeSessions(person.acts)) {
    const date = localDay(s.timestamp);
    if (date < from || date >= toExclusive) continue;
    const min = Math.round(Number(s.duration_minutes) || 0);
    const strength = s.activity_type === "strength";
    const name = cap(String(s?.activity_name ?? "").split(/[,(]/)[0].trim().toLowerCase()) || (strength ? "Strength" : "A session");
    const z2 = s.zone2_minutes != null && Number.isFinite(Number(s.zone2_minutes)) ? Math.round(Number(s.zone2_minutes)) : null;
    const kind: SessionRow["kind"] = strength ? "strength" : z2 != null && z2 > 0 ? "aerobic" : z2 === 0 ? "active" : "no_heart_rate";
    const counted = kind === "strength" ? "1 strength session" : kind === "aerobic" ? `${z2} zone 2 min` : kind === "active" ? "active time" : "no heart rate";
    out.push({ at: String(s.timestamp), date, day: dayOf(date), name, minutes: min > 0 ? `${min} min` : "", counted, kind });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).map(({ at: _at, ...row }) => row);
}

// ── this week: where you are ──

export type RowKey = "zone2" | "strength" | "steps" | "dose" | "fitness";
export type NowRow = {
  key: RowKey; label: string;
  /** "64 of 110", "1 of 2", "6,900 of 6,800", "610 of 1,000", "8.4"; the ask alone ("110") while nothing has arrived; null when there is neither. */
  figure: string | null;
  /** "min", "sessions", "a day", "MET-min", "METs"; "min asked" while only the ask is shown. */ unit: string;
  /** Beside the figure, in the same line: the minutes of the week's strength sessions ("25 min"). */ extra: string | null;
  /** The bar's share, 0 to 1. Null where nothing is asked, where nothing has arrived, and for fitness. */ share: number | null;
  reached: boolean;
  /** In the bar's place, for fitness: "Started at 8.4 · goal 9.4 · test in week 12". Where a row has no figure at all: "Nothing yet". */ note: string | null;
};
export type NowWeek = {
  from: string; to: string; /** The week's number among the horizon's judged weeks; null in a short or paused week. */ week: number | null; weeks: number;
  /** The week is asked something: the rows say "done of asked". */ judged: boolean;
  /** Whether anything at all has arrived for the week. */ arrived: boolean;
  rows: NowRow[];
  /** One quiet line when the week is not judged, and why. */ line: string | null;
};
export const ROW_LABEL: Record<RowKey, string> = { zone2: "Zone 2", strength: "Strength", steps: "Steps", dose: "Weekly dose", fitness: "Fitness" };
export const NOTHING_YET = "Nothing yet";
export const NO_TEST = "No test on file yet";

const strengthMinutes = (person: Person, from: string, toExclusive: string) =>
  dedupeSessions(person.acts).filter((s) => { const d = localDay(s.timestamp); return d >= from && d < toExclusive && s.activity_type === "strength"; })
    .reduce((t, s) => t + Math.max(0, Math.round(Number(s.duration_minutes) || 0)), 0);
const stepsAverage = (person: Person, from: string, toExclusive: string): number | null => {
  const days = (person.signals ?? []).filter((s) => { const d = String(s?.day ?? "").slice(0, 10); return s?.steps != null && d >= from && d < toExclusive; }).map((s) => Number(s.steps));
  return days.length ? Math.round(days.reduce((t, v) => t + v, 0) / days.length) : null;
};
/** What a stretch of the horizon did. A week of seven days is the plan's own reader (doneOf); a short one is counted from its own days. */
function doneIn(person: Person, s: Span): { zone2: number | null; strength: number; steps: number | null; dose: number | null } {
  if (s.days === 7) { const d = doneOf(person, s.from); return { zone2: d.zone2, strength: d.strength, steps: d.steps, dose: d.dose }; }
  const to = addDays(s.to, 1), f = countedFigures(person, s.from, to);
  return { zone2: f.zone2 != null ? Math.round(f.zone2) : null, strength: f.strength, steps: stepsAverage(person, s.from, to), dose: f.dose != null ? Math.round(f.dose) : null };
}
/** One row from what was done and what is asked. A count of nought with nothing asked is not shown as a figure. */
function row(key: RowKey, done: number | null, of: number | null, unit: string, write: (n: number) => string, extra: string | null = null): NowRow {
  const label = ROW_LABEL[key];
  if (done != null && of != null) return { key, label, figure: `${write(done)} of ${write(of)}`, unit, extra, share: of > 0 ? Math.max(0, Math.min(1, done / of)) : null, reached: done >= of, note: null };
  if (done != null && done > 0) return { key, label, figure: write(done), unit, extra, share: null, reached: false, note: null };
  if (of != null) return { key, label, figure: write(of), unit: `${unit} asked`, extra, share: 0, reached: false, note: null };
  return { key, label, figure: null, unit: "", extra, share: null, reached: false, note: NOTHING_YET };
}

/** The fitness row: the latest figure, and in the bar's place where it started, its goal and the next test's week. */
function fitnessRow(a: { horizon: HorizonLike; person: Person; today: string; targets: TargetLite[]; asks: boolean }): NowRow {
  const now = latestOf("mets", a.person, a.today);
  const t = a.targets.find((x) => x.marker === "mets") ?? null;
  const goal = t ? num(t.target_value) : null, start = t ? num(t.start_value) : null;
  const next = t && a.asks ? nextTestWeek(a.horizon, a.today) : null;
  const parts = [...(now ? [start != null ? `started at ${one(start)}` : null, goal != null ? `goal ${one(goal)}` : null] : [NO_TEST.toLowerCase(), goal != null ? `goal ${one(goal)}` : null]), next != null ? `test in week ${next}` : null].filter((x): x is string => !!x);
  const reached = !!now && goal != null && (start == null || goal >= start ? now.value >= goal : now.value <= goal);
  return { key: "fitness", label: ROW_LABEL.fitness, figure: now ? one(now.value) : null, unit: now ? "METs" : "", extra: null, share: null, reached, note: parts.length ? cap(parts.join(" · ")) : null };
}
/** The week of the plan's next fitness test (./guidePlan.ts testWeeksOf): this week's, or the first one ahead. Null when none is left. */
export function nextTestWeek(h: HorizonLike, today: string): number | null {
  const { week, weeks } = weekOf(h, today);
  return testWeeksOf(weeks).find((w) => w >= Math.max(1, week)) ?? null;
}

/**
 * The week today is in, as the five rows. `asks` is whether the horizon asks anything of a week at all: false for a
 * horizon that is kept and no longer run, one that has stopped, and a Guide's plan that has not begun (`startsOn`).
 * Null only for a horizon with no day in it.
 */
export function thisWeek(a: { horizon: HorizonLike; person: Person; today: string; rows: PlanRow[]; targets: TargetLite[]; asks: boolean; startsOn?: string | null }): NowWeek | null {
  const { horizon: h, person, today } = a;
  const span = spanOf(h, today);
  if (!span) return null;
  const { weeks, short, paused } = weekOf(h, today);
  const upto = addDays(today < span.to ? today : span.to, 1);
  const here = today >= span.from && arrived(person, span.from, upto);
  // the light week's own three amounts: null in a week that is not judged, and when the week asks for none of them
  const light = a.asks && span.full ? lightWeekOf({ horizon: h, person, today, rows: a.rows, targets: a.targets }) : null;
  const amount = (k: "aerobic" | "strength" | "steps") => light?.amounts.find((x) => x.key === k) ?? null;
  const d = here ? doneIn(person, span) : null;
  const of = (k: "aerobic" | "strength" | "steps") => amount(k)?.of ?? null;
  const done = (k: "aerobic" | "strength" | "steps", own: number | null) => { const x = amount(k); return x ? x.done : own; };
  const minutes = here ? strengthMinutes(person, span.from, upto) : 0;
  const doseAsked = light ? num(askedOf(a.rows, a.targets).dose) : a.asks && span.full ? num(a.targets.find((t) => t.marker === "dose")?.target_value) : null;
  const rows: NowRow[] = [
    row("zone2", done("aerobic", d?.zone2 ?? null), of("aerobic"), "min", whole),
    row("strength", done("strength", d ? d.strength : null), of("strength"), (of("strength") ?? done("strength", d ? d.strength : null)) === 1 ? "session" : "sessions", whole, minutes > 0 ? `${minutes} min` : null),
    row("steps", done("steps", d?.steps ?? null), of("steps"), "a day", thousands),
    row("dose", d?.dose ?? null, doseAsked, "MET-min", thousands),
    fitnessRow(a),
  ];
  const line = paused ? "This week is set aside: nothing is asked."
    : short === "first" ? `A short first week, ${daysWords(span.from, span.to)}: it is not judged.`
    : short === "last" ? `The short last week, ${daysWords(span.from, span.to)}: it is not judged.`
    : !a.asks && a.startsOn && a.startsOn > today ? `The plan begins on ${weekdayDayMonth(a.startsOn)}.`
    : null;
  return { from: span.from, to: span.to, week: span.week, weeks, judged: !!light || doseAsked != null, arrived: here, rows, line };
}

// ── past weeks: how you are progressing ──

export type PastKey = "zone2" | "strength" | "steps" | "dose";
export type PastCell = {
  key: PastKey; label: string;
  /** "100 of 100", or what was done alone ("85") where nothing was asked; null when nothing was counted. */ text: string | null;
  /** The week was asked this, so it counts towards "3 of 4 reached". */ asked: boolean; reached: boolean;
};
export type PastWeek = {
  from: string; to: string; week: number; /** "Mon 30 Nov to Sun 6 Dec" */ dates: string;
  cells: PastCell[];
  /** "3 of 4 reached"; null for a week that was asked nothing. */ count: string | null;
  /** The week's sessions, shown when its row is opened. */ sessions: SessionRow[];
};
export const PAST_LABEL: Record<PastKey, string> = { zone2: "Zone 2", strength: "Strength", steps: "Steps", dose: "Dose" };

/** A week of the Guide's plan, as the lines it was asked (the plan's climb keeps them: guidePlan.ts ClimbRow). */
const linesOfClimb = (c: ClimbRow): PlanRow[] => [
  { kind: "zone2_min", label: "Zone 2", n: c.zone2 }, { kind: "strength_week", label: "Strength", n: c.strengthDays },
  ...(c.steps != null ? [{ kind: "steps_day" as const, label: "Steps", n: c.steps }] : []),
];

/**
 * Every finished, judged week of the horizon, newest first. What a week was asked is the plan's own: for the Guide's
 * plan the line its climb kept for that week (`climb`), and a week from before that plan began was asked nothing; for
 * any other plan its lines as they are (`rows`), else the person's own weekly numbers. `asks` false (a kept horizon)
 * shows what each week did and no "of".
 */
export function pastWeeks(a: { horizon: HorizonLike; person: Person; today: string; rows: PlanRow[]; targets: TargetLite[]; climb?: ClimbRow[] | null; asks: boolean }): PastWeek[] {
  const { horizon: h, person, today } = a;
  const out: PastWeek[] = [];
  for (const s of horizonSpans(h)) {
    if (!s.full || s.week == null || s.to >= today) continue;
    const c = a.climb ? a.climb.find((x) => x.monday === s.from) ?? null : null;
    const asked = a.asks && (!a.climb || !!c);
    const rows = c ? linesOfClimb(c) : a.rows;
    const fin = asked ? finishedWeekOf({ horizon: h, person, monday: s.from, rows, targets: a.targets, within: c ? RULES.progression.zone2StepMin / 2 : null }) : null;
    const here = arrived(person, s.from, addDays(s.to, 1));
    const d = here ? doneIn(person, s) : null;
    const cell = (key: PastKey, lightKey: "aerobic" | "strength" | "steps", own: number | null, write: (n: number) => string): PastCell => {
      const x = fin?.amounts.find((m) => m.key === lightKey) ?? null;
      if (x) return { key, label: PAST_LABEL[key], text: x.done != null ? `${write(x.done)} of ${write(x.of)}` : null, asked: true, reached: x.state === "reached" };
      return { key, label: PAST_LABEL[key], text: own != null && own > 0 ? write(own) : null, asked: false, reached: false };
    };
    const doseAsked = asked ? num(askedOf(rows, a.targets).dose) : null, dose = d?.dose ?? null;
    const cells: PastCell[] = [
      cell("zone2", "aerobic", d?.zone2 ?? null, whole), cell("strength", "strength", d ? d.strength : null, whole), cell("steps", "steps", d?.steps ?? null, thousands),
      doseAsked != null
        ? { key: "dose", label: PAST_LABEL.dose, text: dose != null ? `${thousands(dose)} of ${thousands(doseAsked)}` : null, asked: true, reached: dose != null && dose >= doseAsked }
        : { key: "dose", label: PAST_LABEL.dose, text: dose != null && dose > 0 ? thousands(dose) : null, asked: false, reached: false },
    ];
    const judged = cells.filter((x) => x.asked);
    out.push({ from: s.from, to: s.to, week: s.week, dates: daysWords(s.from, s.to), cells,
      count: judged.length ? `${judged.filter((x) => x.reached).length} of ${judged.length} reached` : null, sessions: sessionRows(person, s.from, addDays(s.to, 1)) });
  }
  return out.reverse();
}

/** Before any week is finished: when the first full week ends. Null once one has, and for a horizon that holds no full week. */
export function firstWeekLine(h: HorizonLike, today: string): string | null {
  const first = horizonSpans(h).find((s) => s.full) ?? null;
  return first && first.to >= today ? `The first full week ends on ${weekdayDayMonth(first.to)}.` : null;
}

/**
 * Fitness in one line, under the weeks: where it started, where it stands when it has been measured since, and the
 * next test's week. "Fitness: 8.4 METs at the start · 8.9 METs on 6 January · next test in week 12."
 */
export function fitnessLine(a: { horizon: HorizonLike; person: Person; today: string; targets: TargetLite[]; asks: boolean }): string {
  const now = latestOf("mets", a.person, a.today);
  const t = a.targets.find((x) => x.marker === "mets") ?? null;
  const start = t ? num(t.start_value) : null;
  const next = t && a.asks ? nextTestWeek(a.horizon, a.today) : null;
  const since = now && (start == null || now.on > a.horizon.starts_on) ? `${one(now.value)} METs${start == null ? "" : ` on ${dayMonthLong(now.on)}`}` : null;
  const parts = [start != null ? `${one(start)} METs at the start` : null, since, !now && start == null ? NO_TEST.toLowerCase() : null, next != null ? `next test in week ${next}` : null].filter((x): x is string => !!x);
  return `Fitness: ${parts.join(" · ")}.`;
}
