/**
 * A fitness test taken in the middle of a horizon (the founder, 27 November 2026: "If in the middle of an horizon a
 * user takes a fitness test eg Like i took the treadmill test - my fitness tier changed - that should recalibrate the
 * FITTVP tier accordingly ... can the horizon sense that a new fitness test has been uploaded to the website and/or
 * app and continue the horizon with a recalibrated target?"; and to the sketch of this card: "Yes, build it").
 *
 * A horizon already reads every test: the app and the website file them in one list. What was missing is a word on
 * the page, and a choice. Until that day the plan's tier read the newest reading of ANY method, a watch's daily
 * estimate among them, so a tier could move silently while the fitness row beside it stayed on the horizon's first
 * method. Now the plan reads the test the horizon KEEPS (./derive.ts horizonFitness), and this file decides the one
 * card "This week" shows when a test arrives:
 *
 *   another method   a test the person TOOK (a lab test, a walk, a run, a treadmill test: never a watch's estimate) by
 *                    a method the horizon does not keep. Nothing has moved. The card says what the test would do and
 *                    asks: "Use this test" (the fitness line restarts from it, and the tier follows) or "Keep my first
 *                    test" (nothing changes, and the card does not come back for that test).
 *   the same method  the line has moved by itself, as it always did. The card speaks only when that test changed the
 *                    tier, or newly reached the aim: "Got it", and a new aim to set when the old one is reached.
 *
 * One card at a time, for the newest test not yet answered. The answer is remembered with the horizon
 * (./programme.ts Programme.tests). A test dated on or before the day the horizon was set is where it started, and is
 * never asked about.
 *
 * EVERY WORD IS A RULE, AND NO FIGURE IS NEW. The tier is the plan's own (./guidePlan.ts tierOf). The range for harder
 * minutes is the plan's own share of the reserve (plan-rules.ts tiers) on the app's own maximum and resting rate
 * (./heartBand.ts). What the method can read off by is the figure ../../data/programme.ts already holds for its door.
 * A new aim is offered only where ./defaults.ts offers one: about twelve weeks left, the average gain of the trials.
 * What "stays" is not asserted: the caller works the plan out both ways and hands in what moved (planMoves).
 *
 * Pure, no DOM, no fetch; tests/new-test.test.mjs runs it under node. The horizon function does not copy this file.
 */
import RULES from "../../data/plan-rules.ts";
import { DOOR_BY_KEY } from "../../data/programme.ts";
import { daysBetween } from "../derive/format.ts";
import { methodLabel } from "../derive/markers.ts";
import { FITNESS_GAIN_METS, FITNESS_GAIN_WEEKS } from "./defaults.ts";
import { dayMonthLong, fitnessReadings, horizonFitness, round, type DoorReading, type Person } from "./derive.ts";
import { tierOf, type GuidePlanView } from "./guidePlan.ts";
import type { Heart } from "./heartBand.ts";

const one = (v: number) => round(v, 1).toFixed(1);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const andList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The tests a person takes. A watch's estimate arrives by itself, as often as daily, and is never asked about. */
const TAKEN = new Set<string>(["lab", "walk", "run", "treadmill"]);
/** A test as the horizon remembers an answer about it: its day and its method's family. */
export const testKey = (r: { on: string; family: string | null }): string => `${r.on}|${r.family ?? ""}`;

export type TestTarget = { id?: string; marker: string; target_value: number; start_value?: number | null; start_on?: string | null; method?: string | null };
export type Pending = {
  reading: DoorReading; key: string;
  /** "other": a method the horizon does not keep. "same": the horizon's own, already read by the plan. */ kind: "other" | "same";
  /** The reading the plan read before this one: the fitness figure, and null when there was none. */ before: number | null;
};

/**
 * The newest test that has something to say and has not been answered; null when there is none. A horizon with no
 * fitness target has no line to restart and no aim, and is never asked.
 */
export function pendingTest(a: { horizon: { starts_on: string }; person: Person; today: string; targets: TestTarget[]; answered?: string[] | null }): Pending | null {
  const t = a.targets.find((x) => x.marker === "mets") ?? null;
  if (!t) return null;
  const kept = t.method ?? null;
  const answered = new Set(a.answered ?? []);
  const all = fitnessReadings(a.person).filter((r) => r.on <= a.today);
  const aim = Number.isFinite(Number(t.target_value)) ? Number(t.target_value) : null;
  const start = t.start_value != null && Number.isFinite(Number(t.start_value)) ? Number(t.start_value) : null;
  const now = horizonFitness(a.person, a.targets, a.today);
  let ownSeen = false;
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i];
    if (r.on <= a.horizon.starts_on) break;   // oldest first: nothing before this one is after the day the horizon was set
    const own = kept != null ? r.family === kept : !!r.door && TAKEN.has(r.door);
    if (!own) {
      // another method: only a test a person takes; with no kept method a watch's estimate is not the horizon's own either
      if (kept != null && r.door && TAKEN.has(r.door) && !answered.has(testKey(r))) return { reading: r, key: testKey(r), kind: "other", before: now ? now.value : start };
      continue;
    }
    if (ownSeen) continue;   // only the reading the plan now reads can have changed anything
    ownSeen = true;
    if (answered.has(testKey(r)) || !now || now.on !== r.on) continue;
    // what the plan read before it: the reading of the same line before this one, else where the target started
    const line = all.slice(0, i).filter((x) => (kept != null ? x.family === kept : true));
    const before = line.length ? line[line.length - 1].value : start;
    const tierMoved = tierOf(before) !== tierOf(r.value);
    const reached = aim != null && round(r.value, 1) >= round(aim, 1) && (before == null || round(before, 1) < round(aim, 1));
    // a watch the horizon is kept to sends an estimate as often as daily: it speaks only when the tier moves
    if (r.door === "watch" ? tierMoved : tierMoved || reached) return { reading: r, key: testKey(r), kind: "same", before };
  }
  return null;
}

// ── what moves in the plan ──

/** What differs between two workings of one plan, from the week today is in onwards. */
export type PlanMoves = { zone2: boolean; harder: boolean; steps: boolean; strength: boolean };
export const NOTHING_MOVES: PlanMoves = { zone2: false, harder: false, steps: false, strength: false };
/**
 * The plan worked out two ways (before a test and with it), set side by side from this week on: which of its lines
 * ask a different number in any week. The caller works both out; with no plan in use nothing moves.
 */
export function planMoves(before: Pick<GuidePlanView, "climb"> | null, after: Pick<GuidePlanView, "climb"> | null): PlanMoves {
  if (!before || !after) return NOTHING_MOVES;
  const ahead = (v: Pick<GuidePlanView, "climb">) => new Map(v.climb.filter((w) => w.state !== "past").map((w) => [w.monday, w]));
  const x = ahead(before), y = ahead(after);
  const out = { zone2: false, harder: false, steps: false, strength: false };
  for (const [monday, w] of x) {
    const v = y.get(monday);
    if (!v) continue;
    if (w.zone2 !== v.zone2) out.zone2 = true;
    if (w.harder !== v.harder) out.harder = true;
    if ((w.steps ?? null) !== (v.steps ?? null)) out.steps = true;
    if (w.strengthDays !== v.strengthDays || w.sets !== v.sets) out.strength = true;
  }
  return out;
}

// ── the card ──

export type TestRow = { key: "changes" | "stays" | "aim"; label: string; text: string };
export type TestCard = {
  key: string; kind: "other" | "same";
  head: string;
  /** "Treadmill test · 26 November" */ test: string;
  /** "10.2", and its unit. */ figure: string; unit: string;
  /** The tier the test gives, and the one before it when the two differ. */ tier: { to: string; from: string | null };
  rows: TestRow[];
  /** The old aim is reached by this figure: a field is drawn, with this number in it when one is offered. */ aim: { was: number; suggest: number | null } | null;
  /** One line under the rows: what the method can read off by, and what using it does. Only for another method. */ line: string | null;
  /** What "Use this test" writes to the fitness target; null for the horizon's own method, which needs nothing written. */ use: { method: string; start_value: number; start_on: string } | null;
  primary: string; secondary: string | null;
};
export const HEAD = "A new fitness test arrived";
export const USE = "Use this test";
export const KEEP = "Keep my first test";
export const GOT_IT = "Got it";
export const SET_AIM = "Set my new aim";
export const NOTHING_CHANGES = "Nothing in the week";
const AMOUNTS: [keyof PlanMoves | "dose", string][] = [["zone2", "zone 2"], ["strength", "strength"], ["steps", "steps"], ["dose", "the weekly dose"]];

/** The range for harder minutes in the second tier, in beats: the plan's own share of the reserve, on the app's own maximum and resting rate. Null without both. */
export function harderBeats(heart: Heart | null | undefined): { low: number; high: number } | null {
  if (heart?.kind !== "beats" || heart.band.max == null || heart.band.rest == null) return null;
  const reserve = heart.band.max - heart.band.rest;
  return { low: Math.round(heart.band.rest + (RULES.tiers.secondHrrLowPct / 100) * reserve), high: Math.round(heart.band.rest + (RULES.tiers.secondHrrHighPct / 100) * reserve) };
}

/**
 * What a move between tiers does to the harder minutes, in a few words; null when it does nothing. The first tier's
 * harder minutes are "above zone 2"; the second and third name them by their share of the reserve, and ask the same.
 * A plan that carries no harder minutes has none to move.
 */
export function harderWords(a: { from: 1 | 2 | 3; to: 1 | 2 | 3; harder: number | null | undefined; heart?: Heart | null; /** The harder minutes of a later week differ. */ moved: boolean }): string | null {
  if (!(Number(a.harder) > 0) && !a.moved) return null;
  const up = a.from === 1 && a.to >= 2, down = a.from >= 2 && a.to === 1;
  if (!up && !down) return a.moved ? "Harder minutes in later weeks" : null;
  if (a.heart?.kind === "effort") return up ? "Harder minutes are no longer cut back" : "Harder minutes ease while zone 2 climbs";
  if (up) { const b = harderBeats(a.heart); return b ? `Harder minutes move to ${b.low} to ${b.high} beats a minute` : `Harder minutes move to ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve`; }
  return a.heart?.kind === "beats" ? `Harder minutes go back to above ${a.heart.band.high} beats a minute` : "Harder minutes go back to above zone 2";
}

/** What another method can read off by, in the words its door already carries, and what using it does. */
export function methodLine(r: Pick<DoorReading, "door" | "value">): string {
  const d = r.door ? DOOR_BY_KEY[r.door] : null;
  const first = !d ? "A test by another method is not compared with your first."
    : d.error === "the reference" ? `${d.title} is the reference.` : /^can /.test(d.error) ? `${d.title} ${d.error}.` : `${d.title} is ${d.error}.`;
  return `${first} Using it restarts your fitness line from ${one(r.value)}.`;
}

/** The aim a field opens with: the test plus the trials' average gain, only with about twelve weeks left (./defaults.ts). */
export function aimOffered(value: number, today: string, endsOn: string): number | null {
  const weeks = Math.max(0, Math.floor(daysBetween(today, endsOn) / 7));
  return weeks >= FITNESS_GAIN_WEEKS.from && weeks <= FITNESS_GAIN_WEEKS.to ? round(value + FITNESS_GAIN_METS, 1) : null;
}

/**
 * The card for the newest unanswered test, or null. `moves` is what the plan asks differently from this week on with
 * the test than without it (planMoves); `harder` is this week's harder minutes as the plan asks them.
 */
export function newTestCard(a: {
  horizon: { starts_on: string; ends_on: string }; person: Person; today: string; targets: TestTarget[]; answered?: string[] | null;
  harder?: number | null; heart?: Heart | null;
  /** Asked once the test is known, so the caller can work the plan out both ways. */ movesFor?: (p: Pending) => PlanMoves | null;
}): TestCard | null {
  const p = pendingTest(a);
  if (!p) return null;
  const t = a.targets.find((x) => x.marker === "mets")!;
  const r = p.reading;
  const moves = a.movesFor?.(p) ?? NOTHING_MOVES;
  const from = tierOf(p.before), to = tierOf(r.value);
  const aim = Number.isFinite(Number(t.target_value)) ? Number(t.target_value) : null;
  const reached = aim != null && round(r.value, 1) >= round(aim, 1);
  // what changes: the harder minutes' own words, then any other line the plan asks differently in a later week
  const changed = [
    harderWords({ from, to, harder: a.harder, heart: a.heart, moved: moves.harder }),
    moves.zone2 ? "zone 2 minutes in later weeks" : null, moves.steps ? "steps in later weeks" : null, moves.strength ? "strength in later weeks" : null,
  ].filter((x): x is string => !!x);
  const stays = AMOUNTS.filter(([k]) => k === "dose" || !moves[k]).map(([, words]) => words);
  const rows: TestRow[] = [
    { key: "changes", label: "Changes", text: changed.length ? cap(changed.join("; ")) : NOTHING_CHANGES },
    { key: "stays", label: "Stays", text: cap(andList(stays)) },
    ...(reached ? [{ key: "aim" as const, label: "Your aim", text: `${one(aim!)} METs is reached. New aim:` }] : []),
  ];
  const other = p.kind === "other";
  return {
    key: p.key, kind: p.kind, head: HEAD,
    test: `${cap(methodLabel(r.writer)) || "A test"} · ${dayMonthLong(r.on)}`,
    figure: one(r.value), unit: "METs",
    tier: { to: `Tier ${to} of 3`, from: from !== to ? `Tier ${from}` : null },
    rows,
    aim: reached ? { was: aim!, suggest: aimOffered(r.value, a.today, a.horizon.ends_on) } : null,
    line: other ? methodLine(r) : null,
    use: other && r.family ? { method: r.family, start_value: round(r.value, 2), start_on: r.on } : null,
    primary: other ? USE : reached ? SET_AIM : GOT_IT,
    secondary: other ? KEEP : reached ? GOT_IT : null,
  };
}

/** A typed aim made safe to keep: a number over nought, to one decimal; null for anything else. */
export function aimTyped(s: string | null | undefined): number | null {
  const v = Number(String(s ?? "").trim());
  return String(s ?? "").trim() !== "" && Number.isFinite(v) && v > 0 && v < 30 ? round(v, 1) : null;
}

/** A person without one fitness reading: the plan as it stood before that test arrived, for planMoves. */
export function withoutReading(person: Person, r: Pick<DoorReading, "on" | "writer">): Person {
  return { ...person, crf: person.crf.filter((c) => !(String(c.measured_on).slice(0, 10) === r.on && String(c.method ?? "") === String(r.writer ?? ""))) };
}
