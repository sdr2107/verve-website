/**
 * The midweek note (canvas "Verve, Horizon as a programme", board 15; the founder, 17 November 2026: "Give mid week
 * feedback and motivation within the guide").
 *
 * On Thursday the Guide says what is done, what is left, and how the days left can hold it. Four short lines, the
 * Monday check-in's shape, and every figure in them is counted here: no model writes any of it, so no number can be
 * wrong and nothing is sent anywhere to write it.
 *
 *   So far            the week's sessions and minutes from Monday to Wednesday night, beside what the week asks
 *   Left              what the week asks, less what is done, and the days to Sunday
 *   A way to fit it   how the days left can hold what is left; or that they cannot, and that nothing is carried over
 *   One thing you did one true line from a fixed list, about the work and never about the person; left out when
 *                     none is true
 *
 * What the week asks is the plan's lines for the week when there is a plan (the Guide's or a coach's), else the
 * weekly numbers the person set. Harder minutes and steps are counted by the plan and never asked for, so they are
 * not in "Left".
 *
 * THE RULES IT KEEPS
 *   - The note is Thursday's, read to Wednesday night, and stays as written until Monday. Three days are enough to
 *     count and four are enough to act.
 *   - No note in a week that is not judged: a short first or last week, or one the owner set aside.
 *   - Nothing arrived is said plainly, with what to do. It is never shown as a zero.
 *   - A shortfall is never pushed into the next week, and the note never asks for more than the week's own lines.
 *   - "Motivation" is the true gap, shown small, and one thing that was done. Feedback that turns attention to the
 *     person has hurt as often as it has helped (Kluger and DeNisi 1996), so nothing here praises or grades anyone.
 *
 * Pure, no DOM, no fetch; tests/midweek.test.mjs runs it under node.
 */
import { addDays, localDay } from "../derive/format.ts";
import { appWeekRows, countedFigures, dedupeSessions, horizonSpans, numberWord, spanOf, type HorizonLike, type Person, type PlanRow, type Span } from "./derive.ts";
import { guidePlan, isGuideStored, type GuideStored } from "./guidePlan.ts";

/** Thursday: the days after Monday on which the note is written. */
export const MIDWEEK_AFTER = 3;
export const MIDWEEK_HEADS = { soFar: "So far", left: "Left", fit: "A way to fit it", did: "One thing you did" } as const;
export type MidweekLine = { head: string; text: string };
/** What a week asks: each null where the week asks nothing of that kind. */
export type Asked = { zone2: number | null; strength: number | null; sessions: number | null; dose: number | null };
export type MidweekState = "counting" | "done" | "out_of_reach" | "nothing";
export type MidweekDay = { day: string; name: string; text: string; kind: "read" | "note" | "ahead" };
export type Midweek = {
  /** The Thursday it is written on, and the Wednesday it is read to. */ on: string; readTo: string;
  /** The week's number among the horizon's judged weeks, and how many there are. */ week: number | null; weeks: number;
  state: MidweekState; lines: MidweekLine[]; days: MidweekDay[];
};

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const thousands = (n: number) => Math.round(n).toLocaleString("en-GB");
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const num = (x: unknown): number | null => (x != null && Number.isFinite(Number(x)) ? Number(x) : null);

/**
 * What this week asks, from the plan's lines when there are any, else from the weekly numbers the person set. The
 * weekly dose is always the person's own number: a plan carries no line for it.
 */
export function askedOf(plan: PlanRow[], targets: { marker: string; target_value: number }[]): Asked {
  const row = (kind: string) => num(plan.find((r) => r.kind === kind)?.n);
  const target = (marker: string) => num(targets.find((t) => t.marker === marker)?.target_value);
  const hasPlan = plan.some((r) => r.kind === "zone2_min" || r.kind === "strength_week" || r.kind === "sessions_week");
  return {
    zone2: hasPlan ? row("zone2_min") : target("zone2_week"),
    strength: hasPlan ? row("strength_week") : target("strength_week"),
    sessions: hasPlan ? row("sessions_week") : null,
    dose: target("dose"),
  };
}

/**
 * The plan's lines for the week today is in. The Guide's plan keeps its rows as they stood when it was last kept, and
 * works each week out afresh, so its lines are asked of it here (guidePlan's own rows for the week), as the page's
 * plan card and Monday's check-in do. Any other plan's rows are the week's lines as they are.
 */
export function planRowsNow(h: HorizonLike & { plan?: { rows?: PlanRow[] | null; author?: string | null; guide?: unknown } | null }, targets: { marker: string; target_value: number }[], person: Person, today: string): PlanRow[] {
  const rows = h.plan?.rows ?? [];
  if (h.plan?.author !== "guide" || !isGuideStored(h.plan?.guide)) return rows;
  try { return guidePlan({ horizon: h, targets: targets as never, person, today, stored: h.plan.guide as GuideStored }).rows; } catch { return rows; }
}

/** Zone 2 minutes by day, from the app's own days when it sent them, else from the sessions. */
function zone2ByDay(person: Person, from: string, toExclusive: string): Map<string, number> {
  const out = new Map<string, number>();
  const days = (person.signals ?? []).filter((r) => { const d = String(r?.day ?? "").slice(0, 10); return d >= from && d < toExclusive && r?.zone2_min != null; });
  if (days.length) { for (const r of days) out.set(String(r.day).slice(0, 10), (out.get(String(r.day).slice(0, 10)) ?? 0) + Number(r.zone2_min)); return out; }
  for (const a of dedupeSessions(person.acts)) {
    const d = localDay(a.timestamp);
    if (d >= from && d < toExclusive && a.zone2_minutes != null) out.set(d, (out.get(d) ?? 0) + Number(a.zone2_minutes));
  }
  return out;
}
const sessionDays = (person: Person, from: string, toExclusive: string, strength?: boolean): Set<string> =>
  new Set(dedupeSessions(person.acts).filter((a) => { const d = localDay(a.timestamp); return d >= from && d < toExclusive && (strength == null || (a.activity_type === "strength") === strength); }).map((a) => localDay(a.timestamp)));
/** Whether anything at all has arrived for the week: a session, a day of signals, or the app's own row for the week. */
function arrived(person: Person, from: string, toExclusive: string): boolean {
  if (appWeekRows(person.doc).has(from)) return true;
  if ((person.signals ?? []).some((r) => { const d = String(r?.day ?? "").slice(0, 10); return d >= from && d < toExclusive; })) return true;
  return sessionDays(person, from, toExclusive).size > 0;
}

/** One true line about the work of the week, from a fixed list; null when none is true. */
function oneThing(person: Person, h: HorizonLike, span: Span, thu: string, strengthDone: number): string | null {
  const spans = horizonSpans(h);
  const before = spans.filter((s) => s.full && s.to < span.from);
  // the longest zone 2 day on this horizon is one of this week's
  const mine = zone2ByDay(person, span.from, thu);
  const earlier = zone2ByDay(person, h.starts_on, span.from);
  let best: { day: string; min: number } | null = null;
  for (const [day, min] of mine) if (!best || min > best.min) best = { day, min };
  if (best && best.min > 0 && earlier.size > 0 && best.min > Math.max(...earlier.values())) {
    const i = (new Date(best.day + "T00:00:00").getDay() + 6) % 7;
    return `${DAY_LONG[i]}'s ${Math.round(best.min)} minutes is your longest zone 2 day on this horizon.`;
  }
  // the first week with strength done by Wednesday
  if (strengthDone >= 1 && before.length > 0 && before.every((s) => sessionDays(person, s.from, addDays(s.from, MIDWEEK_AFTER), true).size === 0)) {
    return "This is the first week on this horizon with a strength session done by Wednesday.";
  }
  // three weeks running with a session on the same day
  const two = before.slice(-2);
  if (two.length === 2 && two[1].to === addDays(span.from, -1) && two[0].to === addDays(two[1].from, -1)) {
    for (let i = 0; i < MIDWEEK_AFTER; i++) {
      const on = (s: Span) => sessionDays(person, addDays(s.from, i), addDays(s.from, i + 1)).size > 0;
      if (on(span) && on(two[0]) && on(two[1])) return `Three weeks running you have trained on a ${DAY_LONG[i]}.`;
    }
  }
  // steps so far this week over the horizon's own average
  const steps = (from: string, toExclusive: string) => (person.signals ?? []).filter((r) => { const d = String(r?.day ?? "").slice(0, 10); return r?.steps != null && d >= from && d < toExclusive; }).map((r) => Number(r.steps));
  const now = steps(span.from, thu), then = steps(h.starts_on, span.from);
  if (now.length >= 2 && then.length >= 7) {
    const a = now.reduce((t, v) => t + v, 0) / now.length, b = then.reduce((t, v) => t + v, 0) / then.length;
    if (a > b && Math.round(a / 100) > Math.round(b / 100)) return `Your steps so far this week, ${thousands(Math.round(a / 100) * 100)} a day, are over this horizon's ${thousands(Math.round(b / 100) * 100)}.`;
  }
  return null;
}

/**
 * The midweek note for the week today is in. Null before Thursday, in a week that is not judged (short, or set aside),
 * outside the horizon, and when the week asks nothing that can be counted.
 */
export function midweekOf(a: { horizon: HorizonLike; person: Person; today: string; plan: PlanRow[]; targets: { marker: string; target_value: number }[] }): Midweek | null {
  const { horizon: h, person, today } = a;
  const span = spanOf(h, today);
  if (!span || !span.full) return null;
  const thu = addDays(span.from, MIDWEEK_AFTER);
  if (today < thu) return null;
  const asked = askedOf(a.plan, a.targets);
  if (asked.zone2 == null && asked.strength == null && asked.sessions == null && asked.dose == null) return null;
  const readTo = addDays(thu, -1);
  const daysLeft = 7 - MIDWEEK_AFTER;
  const toGo = `${numberWord(daysLeft)} days to go`;
  const weeks = horizonSpans(h).filter((s) => s.full).length;

  const by = zone2ByDay(person, span.from, thu);
  const strengthOn = sessionDays(person, span.from, thu, true), anyOn = sessionDays(person, span.from, thu);
  const days: MidweekDay[] = DAY_SHORT.map((name, i) => {
    const day = addDays(span.from, i);
    if (i > MIDWEEK_AFTER) return { day, name, text: "", kind: "ahead" };
    if (i === MIDWEEK_AFTER) return { day, name, text: "the note", kind: "note" };
    const min = Math.round(by.get(day) ?? 0);
    return { day, name, text: min > 0 ? `${min} min` : strengthOn.has(day) ? "strength" : anyOn.has(day) ? "a session" : "none", kind: "read" };
  });
  const base = { on: thu, readTo, week: span.week, weeks, days };

  if (!arrived(person, span.from, thu)) {
    return { ...base, state: "nothing", lines: [
      { head: MIDWEEK_HEADS.soFar, text: "Nothing has arrived since Monday, so there is nothing to count yet." },
      { head: MIDWEEK_HEADS.left, text: "Open the app to send the week so far. This note is then read again." },
    ] };
  }

  const f = countedFigures(person, span.from, thu);
  const done = { zone2: Math.round(f.zone2 ?? 0), strength: f.strength, sessions: f.sessions, dose: Math.round(f.dose ?? 0) };
  const soFar: string[] = [];
  if (asked.zone2 != null) soFar.push(`${done.zone2} of ${Math.round(asked.zone2)} zone 2 minutes`);
  if (asked.strength != null) soFar.push(`${done.strength} of ${Math.round(asked.strength)} strength ${plural(Math.round(asked.strength), "session", "sessions")}`);
  if (asked.sessions != null && asked.zone2 == null) soFar.push(`${done.sessions} of ${Math.round(asked.sessions)} sessions`);
  if (asked.dose != null) soFar.push(`${thousands(done.dose)} of ${thousands(asked.dose)} MET-minutes`);
  const lines: MidweekLine[] = [{ head: MIDWEEK_HEADS.soFar, text: `${soFar.join(". ")}.` }];

  const left = {
    zone2: asked.zone2 != null ? Math.max(0, Math.round(asked.zone2) - done.zone2) : 0,
    strength: asked.strength != null ? Math.max(0, Math.round(asked.strength) - done.strength) : 0,
    sessions: asked.sessions != null && asked.zone2 == null ? Math.max(0, Math.round(asked.sessions) - done.sessions) : 0,
    // the dose is a result of the sessions: it is "left" only where it is the one thing the week asks
    dose: asked.dose != null && asked.zone2 == null && asked.strength == null && asked.sessions == null ? Math.max(0, Math.round(asked.dose) - done.dose) : 0,
  };
  const leftParts = [
    left.zone2 ? `${left.zone2} zone 2 minutes` : "", left.strength ? `${left.strength} strength ${plural(left.strength, "session", "sessions")}` : "",
    left.sessions ? `${left.sessions} ${plural(left.sessions, "session", "sessions")}` : "", left.dose ? `${thousands(left.dose)} MET-minutes` : "",
  ].filter(Boolean);
  const did = oneThing(person, h, span, thu, done.strength);

  if (!leftParts.length) {
    lines.push({ head: MIDWEEK_HEADS.left, text: `Nothing. The week's lines are done with ${toGo}. Nothing more is asked this week.` });
    if (did) lines.push({ head: MIDWEEK_HEADS.did, text: did });
    return { ...base, state: "done", lines };
  }
  lines.push({ head: MIDWEEK_HEADS.left, text: `${leftParts.join(" and ")}, with ${toGo}.` });

  // how the days left can hold it: no day is asked for more zone 2 than the longest day on this horizon has held
  const longest = Math.max(0, ...zone2ByDay(person, h.starts_on, thu).values());
  const need = left.zone2 > 0 ? (longest > 0 ? Math.ceil(left.zone2 / longest) : 1) : 0;
  const tooMuch = need > daysLeft || left.strength > daysLeft || left.sessions > daysLeft;
  if (tooMuch) {
    const what = need > daysLeft ? `${left.zone2} zone 2 minutes in ${numberWord(daysLeft)} days is more than this horizon's longest days have held.` : `${cap(numberWord(Math.max(left.strength, left.sessions)))} sessions do not fit in ${numberWord(daysLeft)} days.`;
    lines.push({ head: MIDWEEK_HEADS.fit, text: `${what} The line is asked again next week. It is never added to it.` });
    if (did) lines.push({ head: MIDWEEK_HEADS.did, text: did });
    return { ...base, state: "out_of_reach", lines };
  }
  const fit: string[] = [];
  if (left.zone2 > 0) {
    const per = Math.ceil(left.zone2 / need / 5) * 5;
    fit.push(`${cap(numberWord(need))} ${plural(need, "session", "sessions")} of ${per} minutes ${plural(need, "covers", "cover")} the zone 2 line.`);
  }
  if (left.strength > 0) fit.push(`${cap(numberWord(left.strength))} strength ${plural(left.strength, "session is", "sessions are")} still ahead.`);
  if (left.sessions > 0) fit.push(`${cap(numberWord(left.sessions))} ${plural(left.sessions, "session is", "sessions are")} still ahead.`);
  if (fit.length) lines.push({ head: MIDWEEK_HEADS.fit, text: `${fit.join(" ")} ${fit.length > 1 ? "Both fit" : "It fits"} before Sunday.` });
  if (did) lines.push({ head: MIDWEEK_HEADS.did, text: did });
  return { ...base, state: "counting", lines };
}
