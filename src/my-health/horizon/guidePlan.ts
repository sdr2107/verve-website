/**
 * The Guide's plan on Horizon (canvas "Verve, the Guide's plan", boards 02
 * to 06, 13 November 2026): the shape of a week, how it steps each week to
 * the date, and how strength is laid out, for a person with no coach.
 *
 * Every figure is arithmetic over the person's own weeks, their targets and
 * the published rules in ../../data/plan-rules.ts; every sentence is fixed
 * here, so the same targets and the same weeks always give the same plan and
 * each line can show the rule it came from. No model writes any of it: the
 * model speaks only in the chat about the plan, and is given these figures.
 *
 * The plan answers to the person's targets and never sets or changes one.
 * It is guidance on exercise, not medical advice: three questions come
 * before the first plan (the ACSM's screening of 2015), and they decide
 * whether a plan is offered at all and whether it carries harder minutes.
 *
 * 14 November 2026 (boards 09 and 10, from the founder's recording): a
 * finished week stays on the page, read line by line against what it was
 * asked; a short week can be won back; the plan says what it does for every
 * target; and the person can change the zone 2 number the plan climbs to. A
 * week behind the person is never rewritten by a change: what it asked is
 * kept with the plan (GuideStored.past), and a change to a number the plan
 * follows starts from the week it is made in (GuideStored.leg).
 *
 * Pure, no DOM, no fetch; tests/guide-plan.test.mjs runs it under node, and
 * the horizon edge function copies this file for the chat's inputs.
 */
import { addDays, localDay, mondayOf } from "../derive/format.ts";
import { restingBPOf } from "../derive/markers.ts";
import RULES from "../../data/plan-rules.ts";
import {
  MARKER_BY_KEY, dayMonthLong, dedupeSessions, horizonMondays, lastCompleteMonday, latestOf, numberWord, round, typicalWeek, weekFigures,
  type HorizonLike, type Person, type PlanRow, type Target,
} from "./derive.ts";

// ── the three questions (board 06) ──

export type ScreenAnswers = { active: boolean; disease: boolean; symptoms: boolean };
/** full: the plan as drawn. easy4: zone 2 only, harder minutes after four weeks. easy: zone 2 only until a doctor's word. none: no plan. */
export type ScreenOutcome = "full" | "easy4" | "easy" | "none";
export const SCREEN_QUESTIONS: { key: keyof ScreenAnswers; text: string; /** A line under the question, in the page's small type. */ help?: string }[] = [
  { key: "active", text: `Have you been active on at least ${numberWord(RULES.screening.activeDays)} days a week for the last ${numberWord(RULES.screening.activeMonths)} months?` },
  // The screen's "cardiovascular, metabolic or renal disease", in plain words (board 10). Blood pressure is not asked:
  // the screen dropped risk factors in 2015, and the plan reads the person's own pressure (pressureHigh, below).
  { key: "disease", text: "Do you have heart disease, diabetes or kidney disease?",
    help: "Heart disease includes disease of the blood vessels and a past stroke. High blood pressure by itself is not counted here: the plan reads your pressure from your page." },
  { key: "symptoms", text: "With effort, do you get chest pain, unusual breathlessness, dizziness or fainting?" },
];
export function screenOutcome(a: ScreenAnswers): ScreenOutcome {
  if (a.symptoms) return "none";
  if (a.disease) return a.active ? "easy" : "none";
  return a.active ? "full" : "easy4";
}
/** What each outcome offers, in the page's words, said to the person who answered. */
export const SCREEN_WORDS: Record<ScreenOutcome, string> = {
  full: "The plan is offered as it is worked out.",
  easy4: `The plan is in zone 2 only for its first ${numberWord(RULES.screening.harderAfterWeeks)} weeks. Harder minutes come back after that.`,
  easy: "The plan is in zone 2 only. Harder minutes wait for a doctor's word.",
  none: "No plan is offered. See a doctor first, and answer again after.",
};

// ── what is kept with the plan ──

export type Layout = "whole" | "ppl" | "upper_lower" | "push_pull";
export type GuideChoices = {
  aerobic_days?: number | null; strength_days?: number | null; layout?: Layout | null;
  /** Logged types the person asked to leave out of the plan's Type line. */
  leave_out?: string[];
};
/** A typical week of the eight before the plan: what it starts from. */
export type GuideBase = { zone2: number; harder: number; dose: number | null; aerobic: number; strength: number; steps: number | null; weeks_read: number; types: string[] };
/** What a week of the plan asked, kept once the week is behind the person and they change something. */
export type Asked = { monday: string; zone2: number; harder: number; steps: number | null; sessions: number; strength: number };
/** The week a number the plan follows was last changed in: that week keeps what it asked, and the climb goes on from it. */
export type Leg = { monday: string; zone2: number; harder: number; steps: number | null };
/** The plan in use, as horizon_plans.guide keeps it. The answers themselves are not here: only what they allow. */
export type GuideStored = { v: 1; accepted_on: string; first_monday: string; base: GuideBase; choices: GuideChoices; mode: Exclude<ScreenOutcome, "none">;
  /** The finished weeks' own lines, written when the person changes the plan (freezeOf): a change never rewrites a week behind them. */
  past?: Asked[];
  leg?: Leg | null };
/** The targets the plan's figures follow. A change to one of these, once the plan has started, starts from the week it is made in. */
export const PLAN_MARKERS = new Set<string>(["zone2_week", "steps", "strength_week", "dose"]);

export function isGuideStored(x: unknown): x is GuideStored {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, any>;
  return o.v === 1 && typeof o.first_monday === "string" && typeof o.accepted_on === "string" && !!o.base && typeof o.base === "object"
    && Number.isFinite(Number(o.base.zone2)) && Number.isFinite(Number(o.base.harder)) && (o.mode === "full" || o.mode === "easy4" || o.mode === "easy");
}

// ── small parts ──

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const round5 = (v: number) => Math.round(v / 5) * 5;
/** A figure to one decimal, rounded as the targets table rounds it (derive.ts fmtValue): toFixed alone can read a figure ending in 5 one tenth lower than the table does. */
const one = (v: number) => round(v, 1).toFixed(1);
const thousands = (n: number) => Math.round(n).toLocaleString("en-GB");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const orList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);
const andList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);
const timesWords = (ratio: number) => { const t = Math.round(ratio); return t === 2 ? "twice" : `${numberWord(t)} times`; };

/** The aerobic types the person logged most in the eight weeks before a day, by name, most frequent first. */
export function loggedTypes(person: Person, today: string): string[] {
  const from = addDays(lastCompleteMonday(today), -49);
  const counts = new Map<string, number>();
  for (const a of dedupeSessions(person.acts)) {
    if (localDay(a.timestamp) < from) continue;
    if (a.activity_type !== "aerobic" && a.activity_type !== "mixed") continue;
    const k = String(a.activity_name ?? "").split(/[,(]/)[0].trim().toLowerCase();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([k]) => k);
}

/** A typical week of the last eight complete ones (derive.ts typicalWeek, the one reader the set-up shares), with the steps a day and the types logged. */
export function baseOf(person: Person, today: string): GuideBase {
  const t = typicalWeek(person, today);
  const steps = latestOf("steps", person, today);
  return { zone2: t.zone2, harder: t.harder, dose: t.dose, aerobic: t.aerobic, strength: t.strength, steps: steps ? Math.round(steps.value) : null, weeks_read: t.weeks_read, types: loggedTypes(person, today) };
}

// ── what the plan answers to: the person's targets, read live ──

export type Aims = {
  zone2: number | null; strength: number | null; steps: number | null;
  /** The dose the week should not fall under: the person's dose target, else the app's weekly goal, else the guideline's low figure. */
  doseFloor: number; doseFloorFrom: "target" | "goal" | "guideline";
  mets: number | null; metsTarget: number | null;
};
export function aimsOf(targets: Pick<Target, "marker" | "target_value">[], person: Person, today: string): Aims {
  const of = (k: string) => { const t = targets.find((x) => x.marker === k); return t && Number.isFinite(Number(t.target_value)) ? Number(t.target_value) : null; };
  const dose = of("dose");
  const goal = weekFigures(person, lastCompleteMonday(today)).goal;
  return {
    zone2: of("zone2_week"), strength: of("strength_week"), steps: of("steps"),
    doseFloor: dose ?? (goal && goal > 0 ? goal : RULES.dose.lowMetMin), doseFloorFrom: dose != null ? "target" : goal && goal > 0 ? "goal" : "guideline",
    mets: latestOf("mets", person, today)?.value ?? null, metsTarget: of("mets"),
  };
}

/** The intensity tier a fitness figure puts a person in; no test on file reads as the first: volume before intensity. */
export const tierOf = (mets: number | null): 1 | 2 | 3 => (mets == null || mets < RULES.tiers.secondFromMets ? 1 : mets < RULES.tiers.thirdFromMets ? 2 : 3);

/** What a planned minute adds to the dose, in METs: from the person's fitness, else the guideline's own equivalence. */
export function metPerMinute(mets: number | null): { zone2: number; harder: number; from: "fitness" | "guideline" } {
  if (mets == null || !(mets > 1)) return { zone2: RULES.dose.lowMetMin / RULES.dose.moderateMinForLow, harder: RULES.dose.lowMetMin / RULES.dose.vigorousMinForLow, from: "guideline" };
  const reserve = mets - 1;
  return { zone2: 1 + RULES.metPerMinute.zone2Share * reserve, harder: 1 + (tierOf(mets) >= 2 ? RULES.metPerMinute.secondTierShare : RULES.metPerMinute.harderShare) * reserve, from: "fitness" };
}

/** A resting pressure on file at or over the line the app holds for hard tests. */
export function pressureHigh(person: Person): boolean {
  const bp = restingBPOf(person.by.get("sbp") ?? [], person.by.get("dbp") ?? []);
  return !!bp && (bp.sbp >= RULES.pressure.systolic || bp.dbp >= RULES.pressure.diastolic);
}

// ── the climb: one step for each week of the plan ──

export type Step = { zone2: number; harder: number; total: number; /** An estimate, to the nearest five; null is never returned once a base exists. */ dose: number; lo: number; hi: number };
export type Climb = { steps: Step[]; climbs: boolean; eases: boolean; start: { zone2: number; harder: number } };

/** The dose a planned week comes to: the typical week's own dose, moved by the minutes the plan adds or takes away. */
const doseAt = (base: GuideBase, per: { zone2: number; harder: number }, z: number, h: number) =>
  (base.dose != null ? base.dose + (z - base.zone2) * per.zone2 + (h - base.harder) * per.harder : z * per.zone2 + h * per.harder);
/** The length of a session, from the week's minutes and its aerobic days: a ten-minute band inside the guideline's 20 to 60. */
const spanOf = (total: number, days: number) => {
  const lo = Math.max(RULES.aerobic.minSessionMin, Math.min(RULES.aerobic.maxSessionMin - 10, Math.floor(total / Math.max(1, days) / 10) * 10));
  return { lo, hi: lo + 10 };
};

export function climbOf(a: { base: GuideBase; aims: Aims; mode: "full" | "easy4" | "easy"; noHarder: boolean; weeks: number; days: number;
  /** A climb that goes on from a week already begun (GuideStored.leg): its first step is that week's own figures, kept as they were asked. */
  from?: { zone2: number; harder: number } | null;
  /** The plan's weeks before this climb's first, so the weeks counted from the plan's start (harder minutes coming back) stay where they were. */
  before?: number }): Climb {
  const { base, aims } = a;
  const n = Math.max(1, a.weeks);
  const before = Math.max(0, a.before ?? 0);
  const tier = tierOf(aims.mets);
  const per = metPerMinute(aims.mets);
  const easy = a.mode !== "full" || a.noHarder;
  const harderBase = round5(base.harder);
  // zone 2 only: the harder minutes of a typical week are done in zone 2 instead
  const zoneBase = easy ? base.zone2 + base.harder : base.zone2;
  const fromHarder = a.from ? (a.noHarder || a.mode === "easy" || (a.mode === "easy4" && before < RULES.screening.harderAfterWeeks) ? 0 : a.from.harder) : 0;
  const start = a.from ? { zone2: a.from.zone2 + (a.from.harder - fromHarder), harder: fromHarder } : { zone2: round5(zoneBase), harder: harderBase };
  const doseOf = (z: number, h: number) => doseAt(base, per, z, h);
  const smallest = RULES.aerobic.minDays * RULES.aerobic.minSessionMin;
  const wantsZone = aims.zone2 != null && aims.zone2 > start.zone2;
  const needs = (z: number, h: number) => (aims.zone2 != null && z < aims.zone2) || doseOf(z, h) < aims.doseFloor - 0.5 || z + h < smallest;
  const up = (z: number, h: number) => {
    const next = z + RULES.progression.zone2StepMin;
    // the zone 2 target is not stepped past unless the dose or the smallest week still asks for more
    return aims.zone2 != null && z < aims.zone2 && next > aims.zone2 && doseOf(aims.zone2, h) >= aims.doseFloor - 0.5 && aims.zone2 + h >= smallest ? aims.zone2 : next;
  };
  const harderAt = (i: number, prev: number, zPrev: number) => {
    if (a.noHarder || a.mode === "easy") return 0;
    if (a.mode === "easy4") return i + before < RULES.screening.harderAfterWeeks ? 0 : Math.min(harderBase, RULES.progression.harderFloorMin);
    // first tier, zone 2 climbing to a target: harder minutes ease while it climbs, never under the floor, never under the dose
    if (i > 0 && tier === 1 && wantsZone && zPrev < (aims.zone2 ?? 0) && prev > RULES.progression.harderFloorMin) return Math.max(RULES.progression.harderFloorMin, prev - RULES.progression.harderEaseMin);
    return prev;
  };
  const steps: Step[] = [];
  let z = 0, h = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0 && a.from) {
      // a week already begun keeps what it asked
      z = start.zone2; h = start.harder;
    } else if (i === 0) {
      h = harderAt(0, harderBase, 0);
      const hold = round5(zoneBase);
      z = needs(hold, h) ? Math.max(round5(zoneBase + RULES.progression.zone2StepMin), Math.min(smallest - h, hold + RULES.progression.zone2StepMin * 6)) : hold;
      if (aims.zone2 != null && wantsZone && z > aims.zone2 && doseOf(aims.zone2, h) >= aims.doseFloor - 0.5) z = aims.zone2;
    } else {
      let nh = harderAt(i, h, z);
      // easing never takes the week under the dose floor
      if (nh < h && doseOf(z + RULES.progression.zone2StepMin, nh) < aims.doseFloor - 0.5 && doseOf(z + RULES.progression.zone2StepMin, h) >= aims.doseFloor - 0.5) nh = h;
      // harder minutes that come back leave zone 2, so the week's total does not jump; the climb goes on from there
      const nz = nh > h ? Math.max(0, round5(z - (nh - h))) : needs(z, nh) ? up(z, nh) : z;
      z = nz; h = nh;
    }
    steps.push({ zone2: z, harder: h, total: z + h, dose: round5(doseOf(z, h)), ...spanOf(z + h, a.days) });
  }
  return { steps, climbs: steps.some((s) => s.zone2 !== steps[0].zone2), eases: steps.some((s) => s.harder < steps[0].harder), start };
}

/**
 * The steps a day a week of the plan asks for, when steps are a target above today's figure: even steps, reaching it a
 * week before the end. `from` is a climb that goes on from a week already begun: that week keeps its figure and the
 * even steps run from it.
 */
export function stepsAt(base: GuideBase, aims: Aims, i: number, n: number, from?: { week: number; steps: number | null } | null): number | null {
  if (aims.steps == null) return null;
  const first = from?.week ?? 0;
  const begin = from?.steps ?? (base.steps == null ? null : Math.min(aims.steps, Math.ceil(base.steps / 100) * 100));
  if (begin == null) return null;
  if (aims.steps <= (from?.steps ?? base.steps ?? begin)) return aims.steps;
  if (i >= n - 2) return aims.steps;
  const span = n - 2 - first;
  if (span <= 0 || i <= first) return begin;
  return Math.min(aims.steps, Math.round((begin + ((aims.steps - begin) * (i - first)) / span) / 50) * 50);
}

// ── where the person is on the climb ──

/** What a finished week did to the plan: it went on, its step repeats, the plan stepped back, or a week was won back. */
export type WeekOutcome = "on" | "short" | "back" | "won";
export type Progress = {
  /** The plan's week today is in, from 0; -1 before its first Monday. */ week: number;
  /** The step that week carries, from 0: behind the week when a step was repeated. */ step: number;
  repeated: number; steppedBack: boolean;
  /** The step each week of the plan carries: what was asked in the weeks behind, what will be asked in those ahead. */ stepOfWeek: number[];
  /** What each finished week did to the plan; null for a week not finished, and for one from before the plan was last changed. */ outcomeOfWeek: (WeekOutcome | null)[];
};
/**
 * A week that did not reach its zone 2 figure repeats its step; two in a row step the plan back one. "Reached" allows
 * half a step's rounding (five minutes under). The missed minutes are never added to a later week.
 *
 * A week can be won back (the founder, 14 November 2026: "the week won back"). The plan's first line is a step a week.
 * When the plan is behind that line and a week comes to the figure of the next step as well as its own, that step is
 * not asked twice: the week after takes the one beyond it. Zone 2 alone decides, the plan never asks for it, and it
 * never goes past the first line, so on the first line a week above the plan still changes nothing.
 *
 * `startAt` is the week the plan was last changed in (GuideStored.leg): the weeks before it are read as they were
 * asked, a step each, and are not judged again.
 */
export function progressOf(climb: Climb | Step[], mondays: string[], person: Person, today: string, startAt = 0): Progress {
  const steps = Array.isArray(climb) ? climb : climb.steps;
  const n = steps.length;
  const tol = RULES.progression.zone2StepMin / 2;
  const thisMonday = mondayOf(new Date(today + "T00:00:00"));
  let week = -1;
  for (let i = 0; i < mondays.length; i++) if (mondays[i] <= thisMonday) week = i;
  const stepOfWeek: number[] = [], outcomeOfWeek: (WeekOutcome | null)[] = [];
  let s = Math.max(0, startAt), misses = 0, steppedBack = false;
  for (let i = 0; i < n; i++) {
    if (i < startAt) { stepOfWeek.push(i); outcomeOfWeek.push(null); continue; }
    stepOfWeek.push(Math.min(s, n - 1));
    if (i >= week) { outcomeOfWeek.push(null); s = Math.min(n - 1, s + 1); continue; }   // this week and the ones ahead: a step each
    const want = steps[Math.min(s, n - 1)].zone2;
    const next = steps[Math.min(s + 1, n - 1)].zone2;
    const did = weekFigures(person, mondays[i]).zone2 ?? 0;
    if (next <= want || did >= want - tol) {
      s = Math.min(n - 1, s + 1); misses = 0; steppedBack = false;
      let won = false;
      // behind the first line (the step is behind the week), and the week also covered the step it would be asked next
      while (s <= i && s < n - 1 && steps[s].zone2 > want && did >= steps[s].zone2 - tol) { s++; won = true; }
      outcomeOfWeek.push(won ? "won" : "on");
    } else if (++misses >= 2) { s = Math.max(startAt, s - 1); misses = 0; steppedBack = true; outcomeOfWeek.push("back"); }
    else outcomeOfWeek.push("short");
  }
  const step = week < 0 ? Math.max(0, Math.min(startAt, n - 1)) : stepOfWeek[Math.min(week, n - 1)];
  return { week, step, repeated: week < 0 ? 0 : Math.max(0, Math.min(week, n - 1) - step), steppedBack: steppedBack && week >= 0, stepOfWeek, outcomeOfWeek };
}

// ── strength ──

export const LAYOUT_WORDS: Record<Layout, { name: string; each: string }> = {
  whole: { name: "whole body", each: "" },
  ppl: { name: "push, pull and legs, once each", each: "once a week" },
  upper_lower: { name: "upper and lower, twice each", each: "twice a week" },
  push_pull: { name: "push and pull, twice each", each: "twice a week" },
};
const layoutFor = (days: number, wanted: Layout | null | undefined): Layout =>
  days >= 4 ? (wanted === "push_pull" ? "push_pull" : wanted === "whole" ? "whole" : "upper_lower") : days === 3 ? (wanted === "ppl" ? "ppl" : "whole") : "whole";
const layoutLine = (days: number, layout: Layout) => (layout === "whole" ? `Whole body ${days === 2 ? "twice" : `${numberWord(days)} times`}` : cap(LAYOUT_WORDS[layout].name));
const eachGroup = (days: number, layout: Layout) => (layout === "whole" ? `${days === 2 ? "twice" : `${numberWord(days)} times`} a week` : LAYOUT_WORDS[layout].each);

/** The two sessions and how hard: fixed words, the same for everyone; the examples are examples. */
export const STRENGTH = {
  a: { name: "Session A", sub: "Five moves, one of each", moves: [["Push", "A press-up, or a chest press"], ["Pull", "A row, with a band, cable or dumbbell"], ["Squat", "A goblet squat, or sit to stand with a load"], ["Hinge", "A hip hinge with a kettlebell or dumbbells"], ["Carry or core", "A loaded carry, or a plank"]] },
  b: { name: "Session B", sub: "The same five, other versions", moves: [["Push", "An overhead press"], ["Pull", "A pull-down, or an assisted pull-up"], ["Lunge", "A lunge or a step-up"], ["Hinge", "A hip thrust or a glute bridge"], ["Core", "A side plank, or a dead bug"]] },
  note: "The examples are examples. Any exercise of the same kind fits its line, at home or in a gym: the plan names the five kinds of move and leaves the choice to you.",
  keeps: "Verve keeps the sessions in the week against your number, and how hard each one felt on the 1 to 10 scale the app asks for after it. Nothing else: no bar to fill, no minutes target, and strength never counts towards the aerobic dose.",
} as const;

// ── the plan, as the page and the chat read it ──

export type Tile = { key: string; small: string; big: string; text: string };
/** What a week did, from the sessions and the days. */
export type Done = { sessions: number; zone2: number; harder: number; strength: number; steps: number | null; dose: number | null };
export type ClimbRow = { week: number; monday: string; zone2: number; harder: number; total: number; dose: number; sets: string; steps: number | null; test: boolean; state: "past" | "now" | "future"; repeats: boolean;
  /** The sessions and the strength sessions the week asks for. */ sessions: number; strengthDays: number;
  /** A finished week: what it did, the lines it was short on, and what that did to the plan. */
  done: Done | null; short: string[]; outcome: WeekOutcome | null };
export type SoFar = { key: string; label: string; done: number; of: number; text: string };
export type Option = { id: string; title: string; says: string; rows: { label: string; from: string; to: string }[]; choices: GuideChoices };
/** A line of a finished week: what the plan asked, what the week did, and the word for it. */
export type ReviewLine = { key: "sessions" | "zone2" | "harder" | "strength" | "steps"; label: string; plan: string; done: string; /** The share of the plan's figure that was done, 0 to 1, for the bar. */ share: number; word: string; state: "reached" | "short" | "neutral" };
/** The last finished week of the plan (board 09): its lines, where a zone 2 gap went, and what it does to the plan. All arithmetic and fixed words. */
export type WeekReview = {
  week: number; monday: string; sunday: string;
  lines: ReviewLine[]; summary: string;
  gap: { head: string; parts: { head: string; text: string }[] } | null;
  /** "hold": nothing in the aerobic week climbs. "changed": a number the plan follows was changed in the week after. "end": it was the plan's last week. */
  outcome: WeekOutcome | "hold" | "changed" | "end";
  after: { small: string; head: string; text: string }[];
};
/** What the plan does for a target: a line it works on, or a figure it only watches. */
export type Answer = { marker: string; label: string; text: string };
export type GuidePlanView = {
  mode: "full" | "easy4" | "easy"; noHarder: boolean;
  weeks: number; /** The plan's week today is in, from 1; 0 before its first Monday. */ week: number; firstMonday: string; started: boolean;
  status: string; lead: string; tiles: Tile[];
  fitt: { letter: string; name: string; now: string; by: string }[];
  why: { head: string; text: string }[];
  /** Whether anything in the aerobic week changes from here to the date. When nothing does, the page shows the weeks, not a climb. */
  climbs: boolean;
  climb: ClimbRow[]; climbNote: string;
  moves: { head: string; text: string }[];
  soFar: SoFar[];
  /** The last finished week; null before the plan has one. */
  review: WeekReview | null;
  /** What the plan does for each target (board 10): the ones it has a line for, the ones it watches, and what it leaves untouched. */
  answers: { worksHead: string; works: Answer[]; watchesHead: string; watches: Answer[]; note: string | null };
  /** How the person changes the numbers the plan follows: fixed words, for the panel and for the chat. */
  changing: string[];
  testWeeks: number[];
  strength: { days: number; layout: Layout; layoutLine: string; each: string; sets: string; hard: [string, string][] };
  /** The lines the Monday check-in reads the week against. */
  rows: PlanRow[];
  notes: string[];
  options: Option[];
  choices: Required<Pick<GuideChoices, "aerobic_days" | "strength_days" | "layout">> & { leave_out: string[] };
  base: GuideBase; aims: Aims;
};

export type GuidePlanArgs = {
  horizon: HorizonLike; targets: Pick<Target, "marker" | "target_value">[]; person: Person; today: string;
  /** The plan in use; absent for a draft, which is worked out from today. */
  stored?: GuideStored | null;
  /** A draft's mode, from the three answers; ignored when a plan is in use. */
  mode?: "full" | "easy4" | "easy";
  /** A draft's choices, or choices being tried before they are saved. */
  choices?: GuideChoices | null;
  /** The reader is the person whose plan it is: only they are told why a plan is in zone 2 only. */
  self?: boolean;
};

const setsWords = (base: GuideBase, i: number) => (base.strength >= RULES.strength.minDays || i >= RULES.strength.lowSetsWeeks ? "two to three sets" : "one to two sets");
const TOL = RULES.progression.zone2StepMin / 2;
/** What a week did: the sessions, the minutes in zone 2 and above it, strength, and the days' steps. */
function doneOf(person: Person, monday: string): Done {
  const f = weekFigures(person, monday);
  const days = person.signals.filter((s) => s?.steps != null && String(s.day).slice(0, 10) >= monday && String(s.day).slice(0, 10) < addDays(monday, 7)).map((s) => Number(s.steps));
  return {
    sessions: f.sessions, zone2: Math.round(f.zone2 ?? 0), harder: Math.round(f.zone3 ?? Math.max(0, (f.zoned ?? 0) - (f.zone2 ?? 0))), strength: f.strength,
    steps: days.length ? Math.round(days.reduce((t, v) => t + v, 0) / days.length) : null, dose: f.dose != null ? Math.round(f.dose) : null,
  };
}

export function guidePlan(args: GuidePlanArgs): GuidePlanView {
  const { horizon, person, today } = args;
  const self = args.self !== false;
  const stored = args.stored ?? null;
  const base = stored?.base ?? baseOf(person, today);
  const aims = aimsOf(args.targets, person, today);
  const mode = stored?.mode ?? args.mode ?? "full";
  const noHarder = pressureHigh(person);
  const tier = tierOf(aims.mets);
  const per = metPerMinute(aims.mets);
  const firstMonday = stored?.first_monday ?? mondayOf(new Date(today + "T00:00:00"));
  let mondays = horizonMondays(horizon).filter((m) => m >= firstMonday);
  // a horizon with no complete week left still has a plan for the week it is in
  if (!mondays.length) mondays = [firstMonday];
  const n = mondays.length;

  const picked = { ...(stored?.choices ?? {}), ...(args.choices ?? {}) };
  const days = Math.max(RULES.aerobic.minDays, Math.min(RULES.aerobic.maxDays, Math.round(Number(picked.aerobic_days) || base.aerobic || RULES.aerobic.minDays)));
  const strengthDays = Math.max(RULES.strength.minDays, Math.min(RULES.strength.maxDays, Math.round(Number(picked.strength_days) || Math.max(aims.strength ?? 0, base.strength, RULES.strength.minDays))));
  const layout = layoutFor(strengthDays, picked.layout);
  const leaveOut = (picked.leave_out ?? []).filter((t) => base.types.includes(t));
  const types = base.types.filter((t) => !leaveOut.includes(t));

  // The week the plan was last changed in (GuideStored.leg): the weeks before it read as they were asked, the climb goes on from it.
  const legAt = stored?.leg ? mondays.indexOf(stored.leg.monday) : -1;
  const leg = legAt >= 0 ? stored!.leg! : null;
  const L = Math.max(0, legAt);
  const pastBy = new Map((stored?.past ?? []).map((w) => [w.monday, w] as const));
  const climb = climbOf({ base, aims, mode, noHarder, weeks: n - L, days, from: leg ? { zone2: leg.zone2, harder: leg.harder } : null, before: L });
  const asked = (i: number): Step => {
    const w = pastBy.get(mondays[i]);
    const z = w?.zone2 ?? climb.steps[0].zone2, h = w?.harder ?? climb.steps[0].harder;
    return { zone2: z, harder: h, total: z + h, dose: round5(doseAt(base, per, z, h)), ...spanOf(z + h, days) };
  };
  /** A step for each week of the plan: the weeks before the last change as they were asked, then the climb. */
  const steps: Step[] = [...Array.from({ length: L }, (_, i) => asked(i)), ...climb.steps];
  const prog = progressOf(steps, mondays, person, today, L);
  const started = prog.week >= 0;
  const wk = Math.max(0, Math.min(prog.week, n - 1));
  const now = steps[prog.step];
  const last = steps[prog.stepOfWeek[n - 1]];
  const weekOfStep = (pred: (s: Step) => boolean) => { for (let i = L; i < n; i++) if (pred(steps[prog.stepOfWeek[i]])) return i + 1; return null; };
  const zoneAt = aims.zone2 != null ? weekOfStep((s) => s.zone2 >= aims.zone2!) : null;
  /** The week zone 2 reaches its number on the plan's first line, a step a week. */
  const zoneAtFirst = aims.zone2 != null ? (() => { for (let i = L; i < n; i++) if (steps[i].zone2 >= aims.zone2!) return i + 1; return null; })() : null;
  const zoneShort = aims.zone2 != null && last.zone2 < aims.zone2;
  const doseShort = last.dose < aims.doseFloor - 2.5;
  const harderEnd = Math.min(...climb.steps.map((x) => x.harder));
  const harderFloorAt = climb.eases ? weekOfStep((s) => s.harder <= harderEnd) : null;
  const testWeeks = [...new Set([RULES.retest.weeks, n].filter((w) => w >= 1 && w <= n))].sort((x, y) => x - y);
  // the steps a day run on as first drawn unless the week the plan was changed in asked something else: then they run from that week
  const stepsFrom = leg && leg.steps !== stepsAt(base, aims, L, n) ? { week: L, steps: leg.steps } : null;
  const stepsFor = (i: number) => (i < L ? pastBy.get(mondays[i])?.steps ?? null : stepsAt(base, aims, i, n, stepsFrom));
  const stepsNow = stepsFor(wk);
  const stepsBegin = stepsFor(L);
  const stepsClimb = aims.steps != null && stepsBegin != null && aims.steps > stepsBegin && n - 2 - L > 0;
  const stepsReach = stepsClimb ? (() => { for (let i = L; i < n; i++) if ((stepsFor(i) ?? 0) >= aims.steps!) return i + 1; return null; })() : null;
  const stepsPer = stepsClimb ? Math.max(50, Math.round((aims.steps! - stepsBegin!) / (n - 2 - L) / 50) * 50) : null;
  const off = Math.max(1, 7 - days - strengthDays);
  const shares = days + strengthDays > 6;
  const floorWords = aims.doseFloorFrom === "target" ? `your floor of ${thousands(aims.doseFloor)}` : aims.doseFloorFrom === "goal" ? `your weekly goal of ${thousands(aims.doseFloor)}` : `the guideline's ${thousands(aims.doseFloor)}`;
  const sets = setsWords(base, wk);
  const typeLine = types.length ? `${cap(orList(types))}: the types you already log.` : "Brisk walking, cycling or swimming: any steady activity of the large muscles.";
  const harderName = tier >= 2 ? `at ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve` : "above zone 2";
  const stepWord = numberWord(RULES.progression.zone2StepMin);
  /** Nothing in the aerobic week changes from the week the climb starts in to the date. */
  const moving = climb.climbs || climb.eases;

  // the lead: what the weeks come to, what the targets ask, what the plan does
  const asks: string[] = [];
  if (aims.zone2 != null && aims.zone2 > climb.start.zone2) asks.push(base.zone2 > 0 && aims.zone2 / base.zone2 >= 1.8 ? `${timesWords(aims.zone2 / base.zone2)} the minutes in zone 2` : "more minutes in zone 2");
  if (strengthDays > base.strength) asks.push(strengthDays === 2 && base.strength === 1 ? "a second strength session" : `strength ${strengthDays === 2 ? "twice" : `${numberWord(strengthDays)} times`} a week`);
  if (stepsPer != null) asks.push("more steps");
  const lead: string[] = [];
  if (base.dose != null) lead.push(`Your weeks come to about ${thousands(round5(base.dose))} MET-minutes, ${base.dose >= aims.doseFloor ? "above" : "under"} ${floorWords}.`);
  else lead.push(`No complete week is on file yet, so the plan starts at the guideline's smallest week: ${numberWord(RULES.aerobic.minDays)} sessions of ${RULES.aerobic.minSessionMin} minutes.`);
  if (asks.length) lead.push(`What your targets ask for is ${asks.length > 1 ? "a different mix" : "one change"}: ${andList(asks)}.`);
  if (mode === "easy4" && self) lead.push(`You said you have not been active on ${numberWord(RULES.screening.activeDays)} days a week, so the first ${numberWord(RULES.screening.harderAfterWeeks)} weeks are in zone 2 only.`);
  else if (mode === "easy") lead.push(self ? "The plan is in zone 2 only. Harder minutes wait for a doctor's word." : "The plan is in zone 2 only.");
  else if (noHarder) lead.push(self ? `A resting pressure of ${RULES.pressure.systolic}/${RULES.pressure.diastolic} or more is on file, so the plan has no harder minutes.` : "The plan is in zone 2 only.");
  if (climb.climbs) lead.push(climb.eases
    ? `So the plan moves minutes into zone 2, ${stepWord} more each week, and keeps ${harderEnd} harder minutes in the week for your fitness.`
    : `So the plan adds ${stepWord} minutes of zone 2 each week${zoneAt ? ` until week ${zoneAt}` : ""}.`);
  else lead.push(mode !== "full" || noHarder ? "The week's minutes stay as they are, all of them in zone 2." : asks.length ? "The plan holds your aerobic week as it is." : "The plan holds the week as it is.");

  // the week, as six tiles
  const tiles: Tile[] = [
    { key: "aerobic", small: "Aerobic", big: plural(days, "session"), text: `${now.lo} to ${now.hi} minutes each. ${typeLine}` },
    { key: "zone2", small: "Of which, easy", big: `${now.zone2} minutes in zone 2`, text: ["You can talk in full sentences.", now.zone2 - base.zone2 >= RULES.progression.zone2StepMin / 2 && base.zone2 > 0 ? `Up from ${base.zone2}.` : "", aims.zone2 != null && now.zone2 < aims.zone2 ? (zoneShort ? `It reaches ${last.zone2} by the date.` : `It reaches ${aims.zone2} in week ${zoneAt}.`) : ""].filter(Boolean).join(" ") },
    now.harder > 0
      ? { key: "harder", small: "Of which, harder", big: `${now.harder} minutes ${harderName}`, text: ["Talking is broken into phrases.", climb.eases && now.harder > harderEnd ? `It steps down to ${harderEnd} by week ${harderFloorAt} and stays there.` : ""].filter(Boolean).join(" ") }
      : { key: "harder", small: "Of which, harder", big: "No harder minutes", text: mode === "easy4" && !noHarder ? `They come back in week ${RULES.screening.harderAfterWeeks + 1}.` : self && mode === "easy" ? "They wait for a doctor's word." : "The plan is in zone 2 only." },
    { key: "strength", small: "Strength", big: plural(strengthDays, "session"), text: `${layoutLine(strengthDays, layout)}, ${layout === "whole" ? "five moves each, " : ""}${sets}.` },
  ];
  if (stepsNow != null) tiles.push({ key: "steps", small: "Steps", big: `${thousands(stepsNow)} a day`, text: stepsPer != null && stepsNow < aims.steps! ? `About ${thousands(stepsPer)} more a day each week. It reaches ${thousands(aims.steps!)} in week ${stepsReach}.` : "Held at your number." });
  tiles.push({ key: "rest", small: "Rest", big: `${plural(off, "day")} with no session`, text: shares ? "Any day. A strength session may share a day with an easy one." : "Any day." });

  // the same plan as FITT-VP
  const fitt = [
    { letter: "F", name: "Frequency", now: `${plural(days, "aerobic session")}, ${strengthDays} strength, ${plural(off, "day")} off`, by: "The same" },
    { letter: "I", name: "Intensity", now: now.harder > 0 ? `Zone 2 for ${now.zone2} of ${now.total} minutes. The rest ${tier >= 2 ? harderName : "harder"}.` : `Zone 2 for all ${now.total} minutes`, by: last.harder > 0 ? `Zone 2 for ${last.zone2} of ${last.total} minutes` : `Zone 2 for all ${last.total} minutes` },
    { letter: "T", name: "Time", now: `${now.lo} to ${now.hi} minutes a session`, by: last.lo === now.lo ? "The same" : `${last.lo} to ${last.hi} minutes a session` },
    { letter: "T", name: "Type", now: types.length ? "What you already log. Any steady activity of the large muscles counts." : "Any steady activity of the large muscles: brisk walking, cycling, swimming.", by: "The same" },
    { letter: "V", name: "Volume", now: `About ${thousands(now.dose)} MET-minutes`, by: `About ${thousands(last.dose)}.${doseShort ? ` Under ${floorWords}.` : aims.doseFloorFrom === "target" ? ` Never under your ${thousands(aims.doseFloor)}.` : ""}` },
    { letter: "P", name: "Pattern", now: climb.climbs ? `${cap(stepWord)} more minutes of zone 2 each week${climb.eases ? `, ${numberWord(RULES.progression.harderEaseMin)} fewer harder` : ""}` : "The same week, held", by: [climb.climbs && zoneAt && zoneAt < n ? `Held from week ${zoneAt}.` : "", `Fitness tested in week ${testWeeks.join(" and week ")}.`].filter(Boolean).join(" ") },
  ];

  // why this, for this person
  const why: { head: string; text: string }[] = [];
  if (aims.mets == null) why.push({ head: "No fitness test is on file.", text: `The plan starts as for a fitness under ${RULES.tiers.secondFromMets} METs: volume before intensity. A test would place you.` });
  else if (tier === 1) why.push({ head: `Your fitness is ${one(aims.mets)} METs.`, text: `Under ${RULES.tiers.secondFromMets}, the rule is to build volume at about half of heart-rate reserve before adding intensity. If a test reads ${RULES.tiers.secondFromMets.toFixed(1)} or more, the harder minutes move to ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}%.` });
  else why.push({ head: `Your fitness is ${one(aims.mets)} METs.`, text: tier === 2 ? `From ${RULES.tiers.secondFromMets} to ${RULES.tiers.thirdFromMets}, the rule puts harder work at ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve. The plan keeps your harder minutes and adds none.` : `At ${RULES.tiers.thirdFromMets} or more the rule allows harder work than the plan writes. The plan keeps your harder minutes and adds none.` });
  if (aims.zone2 != null && aims.zone2 > climb.start.zone2) why.push({
    head: base.zone2 > 0 && aims.zone2 / base.zone2 >= 1.8 ? `Your zone 2 target is ${timesWords(aims.zone2 / base.zone2)} a typical week's figure.` : `Your zone 2 target is ${aims.zone2} minutes.`,
    text: zoneShort ? `${cap(stepWord)} minutes a week reaches ${last.zone2} by the date, short of your ${aims.zone2}. The plan does not take bigger steps.`
      : `${cap(stepWord)} minutes a week reaches ${aims.zone2} in week ${zoneAt}${zoneAt != null && n - zoneAt >= 1 ? ` and leaves ${plural(n - zoneAt, "week")} to hold it before the date` : ""}.`,
  });
  if (climb.eases) why.push({ head: `${cap(floorWords)} is kept.`, text: `A minute in zone 2 adds less to the dose than a harder one: about ${one(per.zone2)} against ${one(per.harder)} METs for you. So the plan keeps ${harderEnd} harder minutes in the week.` });
  else if (doseShort) why.push({ head: `${cap(floorWords)} is not reached by the date.`, text: `At ${stepWord} minutes a week the plan's last week comes to about ${thousands(last.dose)}. The plan does not take bigger steps.` });
  else if (base.dose != null && base.dose < aims.doseFloor) why.push({ head: `Your weeks are under ${floorWords}.`, text: `The plan adds zone 2 minutes until the week reaches it, in week ${weekOfStep((s) => s.dose >= aims.doseFloor - 2.5)}.` });

  // every week of the plan: what it asks, and for a finished one what it did
  const finished = (i: number) => started && today >= addDays(mondays[i], 7);
  const sessionsFor = (i: number) => pastBy.get(mondays[i])?.sessions ?? days + strengthDays;
  const strengthFor = (i: number) => pastBy.get(mondays[i])?.strength ?? strengthDays;
  const shortOf = (i: number, d: Done) => {
    const s = steps[prog.stepOfWeek[i]], st = stepsFor(i), out: string[] = [];
    if (d.zone2 < s.zone2 - TOL) out.push("zone2");
    if (d.sessions < sessionsFor(i)) out.push("sessions");
    if (d.strength < strengthFor(i)) out.push("strength");
    if (st != null && d.steps != null && d.steps < st) out.push("steps");
    return out;
  };
  const climbRows: ClimbRow[] = mondays.map((monday, i) => {
    const s = steps[prog.stepOfWeek[i]];
    const done = finished(i) ? doneOf(person, monday) : null;
    return { week: i + 1, monday, zone2: s.zone2, harder: s.harder, total: s.total, dose: s.dose, sets: setsWords(base, i), steps: stepsFor(i), test: testWeeks.includes(i + 1),
      state: !started ? "future" : i < wk ? "past" : i === wk ? "now" : "future", repeats: i > 0 && prog.stepOfWeek[i] === prog.stepOfWeek[i - 1] && steps[Math.min(n - 1, prog.stepOfWeek[i] + 1)].zone2 > s.zone2,
      sessions: sessionsFor(i), strengthDays: strengthFor(i), done, short: done ? shortOf(i, done) : [], outcome: prog.outcomeOfWeek[i] };
  });
  const climbNote = per.from === "fitness"
    ? `A zone 2 minute is counted at about ${one(per.zone2)} METs for you and a harder minute at about ${one(per.harder)}, from your fitness of ${one(aims.mets!)} METs. The dose of a planned week is an estimate: the app measures the real one.`
    : "No fitness test is on file, so a planned minute is counted by the guideline's own equivalence. The dose of a planned week is an estimate: the app measures the real one.";

  // How the plan moves. The words name zone 2 minutes, never "the step" alone: steps a day are a line of their own and
  // go on by the week (the chat once read "repeats its step" as the steps a day holding still, 14 November 2026).
  const testMove = tier === 1 && aims.mets != null ? [{ head: `The week ${testWeeks[0]} test`, text: `At ${RULES.tiers.secondFromMets.toFixed(1)} METs or more, the harder minutes move to ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve. Under ${RULES.tiers.secondFromMets.toFixed(1)}, they stay as they are.` }] : [];
  const others = `Strength${stepsNow != null ? " and steps a day go" : " goes"} on by the week whatever zone 2 did.`;
  const moves = climb.climbs ? [
    { head: "A short week", text: `A week more than ${numberWord(TOL)} minutes under its zone 2 figure is asked for the same zone 2 minutes again. The missed minutes are never added to a later week. ${others}` },
    { head: "A week won back", text: `If a week comes to the next week's zone 2 figure as well as its own, that figure is not asked twice, and the plan is back on its first line. The plan never asks for this and never goes past that line.` },
    { head: "A week above it", text: `On its first line, nothing changes. The next week still adds ${stepWord} minutes.` },
    ...testMove,
    { head: "Two short weeks", text: "Two in a row step the zone 2 minutes back one week, and the plan says so." },
  ] : [
    { head: "A short week", text: `The plan holds the same week, so nothing moves and nothing is added to the next one. ${others}` },
    { head: "To make it build", text: aims.zone2 != null
      ? `The plan adds zone 2 minutes only towards a zone 2 number above your typical week of ${base.zone2}. Yours is ${aims.zone2}. The number is yours to change, under "Change it".`
      : `The plan adds zone 2 minutes only towards a zone 2 number, and you have set none. One above your typical week of ${base.zone2} makes it build, under "Change it".` },
    ...testMove,
  ];

  // this week so far, from the sessions and the days
  const d = doneOf(person, mondays[wk]);
  const soFar: SoFar[] = started ? [
    { key: "sessions", label: "Sessions", done: d.sessions, of: days + strengthDays, text: `${d.sessions} of ${days + strengthDays}` },
    { key: "zone2", label: "Zone 2", done: d.zone2, of: now.zone2, text: `${d.zone2} of ${now.zone2} min` },
    ...(now.harder > 0 ? [{ key: "harder", label: "Harder", done: d.harder, of: now.harder, text: `${d.harder} of ${now.harder} min` }] : []),
    { key: "strength", label: "Strength", done: d.strength, of: strengthDays, text: `${d.strength} of ${strengthDays}` },
    ...(stepsNow != null ? [{ key: "steps", label: "Steps a day", done: d.steps ?? 0, of: stepsNow, text: `${thousands(d.steps ?? 0)} of ${thousands(stepsNow)}` }] : []),
  ] : [];

  // the last finished week (board 09): each line against what it was asked, where a zone 2 gap went, what it does to the plan
  const r = (() => { let x = -1; for (let i = 0; i < n; i++) if (finished(i)) x = i; return x; })();
  const review: WeekReview | null = r < 0 ? null : (() => {
    const row = climbRows[r], did = row.done!;
    const share = (done: number, of: number) => (of > 0 ? Math.max(0, Math.min(1, done / of)) : done > 0 ? 1 : 0);
    const count = (key: "sessions" | "strength", label: string, done: number, of: number): ReviewLine =>
      ({ key, label, plan: String(of), done: String(done), share: share(done, of), word: done >= of ? "Reached" : `${cap(numberWord(of - done))} short`, state: done >= of ? "reached" : "short" });
    const lines: ReviewLine[] = [count("sessions", "Sessions", did.sessions, row.sessions)];
    lines.push({ key: "zone2", label: "Zone 2", plan: `${row.zone2} min`, done: `${did.zone2} min`, share: share(did.zone2, row.zone2),
      word: did.zone2 >= row.zone2 ? "Reached" : did.zone2 >= row.zone2 - TOL ? `Within ${TOL} min` : `${row.zone2 - did.zone2} min short`, state: did.zone2 >= row.zone2 - TOL ? "reached" : "short" });
    // harder minutes are counted and never judged: the plan's harder figure is not one to chase
    if (row.harder > 0 || did.harder > 0) lines.push({ key: "harder", label: "Harder", plan: row.harder > 0 ? `${row.harder} min` : "None", done: `${did.harder} min`, share: share(did.harder, row.harder),
      word: Math.abs(did.harder - row.harder) <= TOL ? "As planned" : did.harder > row.harder ? `${did.harder - row.harder} min over` : `${row.harder - did.harder} min under`, state: Math.abs(did.harder - row.harder) <= TOL ? "reached" : "neutral" });
    lines.push(count("strength", "Strength", did.strength, row.strengthDays));
    if (row.steps != null) lines.push({ key: "steps", label: "Steps a day", plan: thousands(row.steps), done: did.steps != null ? thousands(did.steps) : "—", share: share(did.steps ?? 0, row.steps),
      word: did.steps == null ? "No days on file" : did.steps >= row.steps ? "Reached" : `${thousands(row.steps - did.steps)} a day short`, state: did.steps == null ? "neutral" : did.steps >= row.steps ? "reached" : "short" });
    const reached = lines.filter((l) => l.state === "reached").length;
    const summary = [
      reached === lines.length ? `All ${numberWord(lines.length)} lines reached.` : reached === 0 ? `No line of ${numberWord(lines.length)} reached.` : `${cap(numberWord(reached))} ${reached === 1 ? "line" : "lines"} of ${numberWord(lines.length)} reached.`,
      did.dose != null ? `The week came to ${thousands(did.dose)} MET-minutes, ${did.dose >= aims.doseFloor ? "above" : "under"} ${floorWords}.` : "",
    ].filter(Boolean).join(" ");

    // where a zone 2 gap went: minutes that were not there, and minutes that were there at a higher effort
    const gapMin = row.zone2 - did.zone2;
    const gap = gapMin > TOL ? (() => {
      const there = did.zone2 + did.harder;
      const missing = Math.max(0, Math.min(gapMin, row.total - there)), harder = gapMin - missing;
      const fewer = row.sessions - did.sessions;
      return { head: `Where the ${gapMin} minutes of zone 2 went`, parts: [
        ...(missing > 0 ? [{ head: `${missing} were not done`, text: `${there} minutes in zone 2 or above, against the plan's ${row.total}.${fewer > 0 ? ` The week had ${numberWord(fewer)} session${fewer === 1 ? "" : "s"} fewer.` : ""}` }] : []),
        ...(harder > 0 ? [{ head: `${harder} were done harder`, text: `${did.harder} harder minutes against ${row.harder}. The minutes were there, at a higher effort than zone 2.` }] : []),
      ] };
    })() : null;

    // what it does to the plan: the week after, and the date
    if (r >= n - 1) return { week: r + 1, monday: mondays[r], sunday: addDays(mondays[r], 6), lines, summary, gap, outcome: "end" as const,
      after: [{ small: "The plan", head: "That was the plan's last week", text: `The horizon's date is ${dayMonthLong(horizon.ends_on)}. The read of the whole road is written on it.` }] };
    const nx = climbRows[r + 1];
    const small = r + 1 === wk ? `This week · week ${r + 2}` : `Week ${r + 2}`;
    const o: WeekOutcome | "hold" | "changed" = r < L ? "changed" : !moving ? "hold" : prog.outcomeOfWeek[r] ?? "on";
    const rest = cap(andList([...(nx.harder > 0 ? [`harder minutes ${nx.harder === row.harder ? "stay at" : "are"} ${nx.harder}`] : []), `strength ${nx.strengthDays === row.strengthDays ? "stays at" : "is"} ${nx.strengthDays}`, ...(nx.steps != null ? [`steps ${row.steps != null && nx.steps > row.steps ? "go on to" : "are"} ${thousands(nx.steps)} a day`] : [])]));
    const wouldBe = steps[Math.min(n - 1, prog.stepOfWeek[r] + 1)].zone2;
    const first: { small: string; head: string; text: string } =
      o === "changed" ? { small, head: `The week keeps what it asked: ${nx.zone2} minutes in zone 2`, text: `A number the plan follows was changed in week ${L + 1}. That week keeps its own figures, and the plan goes on from it. ${rest}.` }
      : o === "hold" ? { small, head: `The same week: ${nx.zone2} minutes in zone 2`, text: `The plan holds the week as it is${gapMin > TOL ? ", so a short week moves nothing in it and nothing is added" : ""}. ${rest}.` }
      : o === "short" ? { small, head: `Zone 2 is asked again: ${nx.zone2} minutes, not ${wouldBe}`, text: `Zone 2 was more than ${numberWord(TOL)} minutes under its line, so the plan asks for the same zone 2 minutes again. The ${gapMin} minutes are not added to this week. ${rest}.` }
      : o === "back" ? { small, head: `The plan steps back: ${nx.zone2} minutes in zone 2`, text: `Two weeks in a row were more than ${numberWord(TOL)} minutes under the zone 2 line, so the plan steps back one week. Nothing is added to it. ${rest}.` }
      : o === "won" ? { small, head: `A week won back: ${nx.zone2} minutes in zone 2`, text: `The week came to ${did.zone2} minutes in zone 2: its own figure and the next week's as well. So that figure is not asked twice${prog.stepOfWeek[r + 1] === r + 1 ? ", and the plan is back on its first line" : ""}. The plan did not ask for it. ${rest}.` }
      : { small, head: `The plan goes on: ${nx.zone2} minutes in zone 2`, text: `${nx.zone2 > row.zone2 ? `Zone 2 reached its line, so this week adds ${numberWord(nx.zone2 - row.zone2)} minutes.` : nx.zone2 === row.zone2 ? "Zone 2 reached its line, and the plan holds it from here." : "The harder minutes come back this week, and zone 2 gives way to them."} ${rest}.` };
    const after = [first];
    if (aims.zone2 != null && climb.climbs) {
      const end = dayMonthLong(horizon.ends_on);
      if (nx.zone2 >= aims.zone2) after.push({ small: "The date", head: `Zone 2 is at your ${aims.zone2}`, text: `The plan holds it to ${end}.` });
      else if (zoneShort || zoneAt == null) after.push({ small: "The date", head: `Zone 2 reaches ${last.zone2} of your ${aims.zone2} by ${end}`, text: `At ${stepWord} minutes a week the plan now ends short of your number. The number, the date and the plan's days are yours to change. Verve does not move your target.` });
      else if (zoneAtFirst != null && zoneAt > zoneAtFirst) after.push({ small: "The date", head: `Zone 2 reaches ${aims.zone2} in week ${zoneAt}, not week ${zoneAtFirst}`, text: `The plan had ${numberWord(n - zoneAtFirst)} week${n - zoneAtFirst === 1 ? "" : "s"} to spare at the end. It now has ${n - zoneAt === 0 ? "none" : numberWord(n - zoneAt)}. Your date still holds.` });
      else after.push({ small: "The date", head: `Zone 2 reaches ${aims.zone2} in week ${zoneAt}, as first drawn`, text: n - zoneAt > 0 ? `That leaves ${plural(n - zoneAt, "week")} to hold it before ${end}.` : `That is the plan's last week before ${end}.` });
    }
    return { week: r + 1, monday: mondays[r], sunday: addDays(mondays[r], 6), lines, summary, gap, outcome: o, after };
  })();

  // what the plan does for each target (board 10): a line it works on, or a figure it only watches
  const works: Answer[] = [], watches: Answer[] = [];
  for (const t of args.targets) {
    const def = MARKER_BY_KEY[t.marker];
    const label = def?.label ?? t.marker;
    const put = (list: Answer[], text: string) => list.push({ marker: t.marker, label, text });
    if (t.marker === "dose") put(works, doseShort ? `Not reached by the date: the plan's last week comes to about ${thousands(last.dose)}` : base.dose != null && base.dose < aims.doseFloor ? `Reached in week ${weekOfStep((s) => s.dose >= aims.doseFloor - 2.5)}, then held` : `Held above ${thousands(aims.doseFloor)} every week`);
    else if (t.marker === "zone2_week" && aims.zone2 != null) put(works,
      now.zone2 < aims.zone2 ? (zoneShort ? `${cap(stepWord)} more minutes each week, ${last.zone2} of your ${aims.zone2} by the date` : `${cap(stepWord)} more minutes each week, ${aims.zone2} in week ${zoneAt}`)
      : aims.zone2 < base.zone2 && !climb.climbs && !leg ? `Nothing to add: your ${aims.zone2} is under your typical ${base.zone2}`
      : `Held at ${now.zone2}`);
    else if (t.marker === "strength_week") put(works, `${strengthDays} a week, ${LAYOUT_WORDS[layout].name}${aims.strength != null && strengthDays < aims.strength ? `, under your number of ${aims.strength}` : ""}`);
    else if (t.marker === "steps" && aims.steps != null) { if (stepsNow == null) put(watches, "No daily steps on file yet"); else put(works, stepsPer != null && stepsNow < aims.steps ? `About ${thousands(stepsPer)} more a day each week, ${thousands(aims.steps)} in week ${stepsReach}` : `Held at your ${thousands(aims.steps)}`); }
    else if (t.marker === "mets") put(watches, aims.mets == null ? "No fitness test on file yet" : `Tested in week${testWeeks.length > 1 ? "s" : ""} ${andList(testWeeks.map(String))}`);
    else put(watches, def?.cadence === "weekly" ? "Read every Monday" : def?.cadence === "monthly" ? "Read at each month's end" : "Known when you measure");
  }
  const total = works.length + watches.length;
  const answers = {
    worksHead: total ? `The plan works on ${works.length} of your ${total} target${total === 1 ? "" : "s"}` : "",
    works, watches,
    watchesHead: watches.length ? `It watches ${watches.length} and has no line for ${watches.length === 1 ? "it" : "them"}` : "",
    // a fitness target the plan leaves untouched: said, with what would make the plan build
    note: aims.metsTarget != null && aims.mets != null && round(aims.metsTarget, 1) > round(aims.mets, 1) && !moving
      ? `You asked for fitness to move from ${one(aims.mets)} to ${one(aims.metsTarget)} METs. Nothing in this plan changes your aerobic week. ${aims.zone2 != null ? `The plan builds only towards a zone 2 number above your typical week of ${base.zone2}, and yours is ${aims.zone2}.` : `The plan builds only towards a zone 2 number above your typical week of ${base.zone2}, and you have set none.`} The number is yours to change, under "Change it".`
      : null,
  };
  const changing = [
    `The plan's minutes in zone 2 follow your zone 2 number${aims.zone2 != null ? `, now ${aims.zone2}` : ", and you have set none"}. You change it under "Change it" on the plan. Above the week the plan is in, the plan adds ${stepWord} minutes a week towards it.`,
    "A week already begun keeps what it asked, and the weeks behind you are not rewritten.",
    "Steps a day and strength follow their own numbers in your targets, and the weekly dose its floor. The plan sets none of them.",
  ];

  const all = days + strengthDays;
  const rows: PlanRow[] = [
    { kind: "sessions_week", label: `${cap(numberWord(all))} session${all === 1 ? "" : "s"} a week`, n: all },
    { kind: "zone2_min", label: `${now.zone2} minutes in zone 2`, n: now.zone2 },
    ...(now.harder > 0 ? [{ kind: "harder_min" as const, label: `${now.harder} harder minutes`, n: now.harder }] : []),
    { kind: "strength_week", label: `Strength ${strengthDays === 2 ? "twice" : `${numberWord(strengthDays)} times`} a week`, n: strengthDays },
    ...(stepsNow != null ? [{ kind: "steps_day" as const, label: `${thousands(stepsNow)} steps a day`, n: stepsNow }] : []),
  ];

  const notes: string[] = [];
  if (prog.steppedBack) notes.push("Two weeks in a row were under the plan's zone 2 figure, so the plan has stepped back one week.");
  else if (prog.repeated > 0) notes.push(`${prog.repeated === 1 ? "One week was" : `${cap(numberWord(prog.repeated))} weeks were`} under the plan's zone 2 figure, so ${prog.repeated === 1 ? "its zone 2 minutes are" : "their zone 2 minutes are"} asked again. Nothing is added to a later week.`);
  if (zoneShort) notes.push(`At this pace zone 2 reaches ${last.zone2} minutes by the date, short of your ${aims.zone2}.`);
  if (!started) notes.push(`The plan's first week starts on Monday ${new Date(mondays[0] + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`);
  if (leg && L > 0) notes.push(`A number the plan follows was changed in week ${L + 1}. That week kept what it asked, and the weeks before it stand as they were.`);

  // the changes the person, or the chat, can make: a closed list, each worked out by the same arithmetic
  const options: Option[] = [];
  const pickedNow = { aerobic_days: days, strength_days: strengthDays, layout, leave_out: leaveOut };
  for (const dd of [3, 4, 5]) {
    if (dd === days) continue;
    const c = spanOf(now.total, dd);
    const offD = Math.max(1, 7 - dd - strengthDays);
    options.push({ id: `days-${dd}`, title: `${cap(numberWord(dd))} aerobic days`, says: `${cap(numberWord(dd))} aerobic sessions of ${c.lo} to ${c.hi} minutes. The week's minutes stay at ${now.total}, with ${now.zone2} in zone 2.`,
      rows: [{ label: "Aerobic sessions", from: String(days), to: String(dd) }, { label: "Minutes a session", from: `${now.lo} to ${now.hi}`, to: `${c.lo} to ${c.hi}` }, { label: "Days off", from: String(off), to: String(offD) }],
      choices: { ...pickedNow, aerobic_days: dd } });
  }
  const strengthChoices: [number, Layout][] = [[2, "whole"], [3, "whole"], [3, "ppl"], [4, "upper_lower"], [4, "push_pull"]];
  for (const [sd, l] of strengthChoices) {
    if (sd === strengthDays && l === layout) continue;
    const more = sd - strengthDays;
    options.push({ id: `strength-${sd}-${l}`, title: `${cap(numberWord(sd))} strength days: ${LAYOUT_WORDS[l].name}`,
      says: `${layoutLine(sd, l)}. Each muscle group is loaded ${eachGroup(sd, l)}.${more > 0 ? ` That adds ${plural(more, "session")} to your week.` : more < 0 ? ` That takes ${plural(-more, "session")} out of your week.` : ""}`,
      rows: [{ label: "Strength sessions", from: String(strengthDays), to: String(sd) }, { label: "Layout", from: layoutLine(strengthDays, layout), to: layoutLine(sd, l) }, { label: "Each muscle group", from: eachGroup(strengthDays, layout), to: eachGroup(sd, l) }],
      choices: { ...pickedNow, strength_days: sd, layout: l } });
  }
  for (const t of types) {
    if (types.length < 2) break;
    const others2 = types.filter((x) => x !== t);
    options.push({ id: `leave-${t.replace(/[^a-z0-9]+/g, "-")}`, title: `Leave out ${t}`, says: `${cap(t)} is left out. Its minutes move to ${orList(others2)} at the same intensity.`,
      rows: [{ label: "Type", from: orList(types), to: orList(others2) }], choices: { ...pickedNow, leave_out: [...leaveOut, t] } });
  }
  if (leaveOut.length) options.push({ id: "types-all", title: "Bring every type back", says: `${cap(andList(leaveOut))} ${leaveOut.length === 1 ? "comes" : "come"} back into the plan.`,
    rows: [{ label: "Type", from: orList(types), to: orList(base.types) }], choices: { ...pickedNow, leave_out: [] } });

  return {
    mode, noHarder, weeks: n, week: started ? wk + 1 : 0, firstMonday: mondays[0], started,
    status: started ? `Week ${wk + 1} of ${n}${prog.repeated > 0 ? " · zone 2 asked again" : ""}` : `Starts Monday · ${plural(n, "week")}`,
    lead: lead.join(" "), tiles, fitt, why, climbs: moving, climb: climbRows, climbNote, moves, soFar, review, answers, changing, testWeeks,
    strength: { days: strengthDays, layout, layoutLine: layoutLine(strengthDays, layout), each: eachGroup(strengthDays, layout), sets,
      hard: [
        ["Sets", base.strength >= RULES.strength.minDays ? "Two to three." : `One to two in the plan's first ${numberWord(RULES.strength.lowSetsWeeks)} weeks. Two to three after.`],
        ["Reps", `${RULES.strength.repsLow} to ${RULES.strength.repsHigh} in a set. ${RULES.strength.easyRepsLow} to ${RULES.strength.easyRepsHigh} if you are older or out of training.`],
        ["Load", "Start light: a load you could lift 15 times or more. Over the weeks, move towards one you could lift 10 to 12 times."],
        ["Effort", "Stop with about two good reps left."],
        ["Next step", "When one or two extra reps come easily two sessions running, add a little load."],
        ["Between", "A day between two sessions that load the same muscles."],
      ] },
    rows, notes, options, choices: pickedNow, base, aims,
  };
}

/** A choice applied: the choices the plan is kept with after a change is accepted. Null when the id is not one the plan offers. */
export function applyOption(view: GuidePlanView, id: string): GuideChoices | null {
  return view.options.find((o) => o.id === id)?.choices ?? null;
}

/** The plan as it is kept when the person presses "Use this plan". */
export function storeOf(view: GuidePlanView, today: string): GuideStored {
  return { v: 1, accepted_on: today, first_monday: view.firstMonday, base: view.base, choices: view.choices, mode: view.mode };
}

/**
 * The plan as it is kept just before the person changes it. The finished weeks' own lines are written down, so no
 * change rewrites a week behind them. When the change is to a number the plan follows (`newLeg`: a target in
 * PLAN_MARKERS), the week it is made in keeps what it asked and the climb goes on from that week. A plan that has not
 * started has nothing to keep: it is simply worked out again.
 */
export function freezeOf(view: GuidePlanView, stored: GuideStored, newLeg: boolean): GuideStored {
  if (!view.started) return stored;
  const had = new Set((stored.past ?? []).map((w) => w.monday));
  const line = (w: ClimbRow) => ({ monday: w.monday, zone2: w.zone2, harder: w.harder, steps: w.steps, sessions: w.sessions, strength: w.strengthDays });
  const past = [...(stored.past ?? []), ...view.climb.filter((w) => w.state === "past" && !had.has(w.monday)).map(line)].sort((x, y) => x.monday.localeCompare(y.monday));
  const now = view.climb.find((w) => w.state === "now");
  return { ...stored, past, ...(newLeg && now ? { leg: { monday: now.monday, zone2: now.zone2, harder: now.harder, steps: now.steps } } : {}) };
}

/** The lines a plan in use adds to the rows a person already keeps that are not about exercise (a bedtime, a weigh-in, their own lines). */
const EXERCISE_KINDS = new Set(["sessions_week", "long_session", "strength_week", "zone2_most", "zone2_min", "harder_min", "steps_day"]);
export const rowsWith = (view: GuidePlanView, existing: PlanRow[]): PlanRow[] => [...view.rows, ...existing.filter((r) => !EXERCISE_KINDS.has(r.kind))];

// ── the rules, as the page lists them and the chat cites them ──

export type RuleLine = { id: string; label: string; source: string; checked: string };
export const RULE_LINES: RuleLine[] = (["tiers", "zone2", "aerobic", "dose", "progression", "strength", "layouts", "retest", "screening", "pressure", "metPerMinute"] as const)
  .map((id) => ({ id, label: RULES[id].label, source: RULES[id].source, checked: RULES[id].checked }));

// ── what the chat is given ──

export type AskInputs = {
  week: string; mode: string; lead: string;
  this_week: { line: string; figure: string; note: string }[];
  fitt: { letter: string; name: string; this_week: string; by_the_date: string }[];
  why: string[];
  weeks: { week: number; zone2_min: number; harder_min: number; total_min: number; dose_met_min: number; strength: string; steps_a_day: number | null; fitness_test: boolean }[];
  so_far: { line: string; done: number; of: number }[];
  last_week: { week: number; lines: string[]; summary: string; what_it_does_to_the_plan: string[] } | null;
  what_the_plan_does_for_each_target: string[];
  how_the_plan_moves: string[];
  /** How the person changes the numbers the plan follows. The chat explains this; it never names a number. */
  changing_the_numbers: string[];
  strength: { sessions: number; layout: string; each_muscle_group: string; how_hard: string[] };
  targets: { marker: string; target: number }[];
  typical_week_before: { zone2_min: number; harder_min: number; dose_met_min: number | null; aerobic_sessions: number; strength_sessions: number; steps_a_day: number | null };
  options: { id: string; title: string; says: string }[];
  rules: { id: string; rule: string; source: string }[];
  notes: string[];
};
/** The figures and fixed words the chat answers from: nothing that names a person, no answer to the three questions. */
export function askInputs(view: GuidePlanView, targets: Pick<Target, "marker" | "target_value">[]): AskInputs {
  return {
    week: view.status, mode: view.mode === "full" && !view.noHarder ? "the plan as worked out" : "zone 2 only", lead: view.lead,
    this_week: view.tiles.map((t) => ({ line: t.small, figure: t.big, note: t.text })),
    fitt: view.fitt.map((r) => ({ letter: r.letter, name: r.name, this_week: r.now, by_the_date: r.by })),
    why: view.why.map((w) => `${w.head} ${w.text}`),
    weeks: view.climb.map((w) => ({ week: w.week, zone2_min: w.zone2, harder_min: w.harder, total_min: w.total, dose_met_min: w.dose, strength: `${view.strength.days} sessions, ${w.sets}`, steps_a_day: w.steps, fitness_test: w.test })),
    so_far: view.soFar.map((s) => ({ line: s.label, done: s.done, of: s.of })),
    last_week: view.review ? { week: view.review.week, lines: view.review.lines.map((l) => `${l.label}: plan ${l.plan}, done ${l.done}. ${l.word}.`), summary: view.review.summary, what_it_does_to_the_plan: view.review.after.map((x) => `${x.head}. ${x.text}`) } : null,
    what_the_plan_does_for_each_target: [...view.answers.works, ...view.answers.watches].map((x) => `${x.label}: ${x.text}.`).concat(view.answers.note ? [view.answers.note] : []),
    how_the_plan_moves: view.moves.map((m) => `${m.head}: ${m.text}`),
    changing_the_numbers: view.changing,
    strength: { sessions: view.strength.days, layout: view.strength.layoutLine, each_muscle_group: view.strength.each, how_hard: view.strength.hard.map(([k, v]) => `${k}: ${v}`) },
    targets: targets.map((t) => ({ marker: t.marker, target: Number(t.target_value) })),
    typical_week_before: { zone2_min: view.base.zone2, harder_min: view.base.harder, dose_met_min: view.base.dose, aerobic_sessions: view.base.aerobic, strength_sessions: view.base.strength, steps_a_day: view.base.steps },
    options: view.options.map((o) => ({ id: o.id, title: o.title, says: o.says })),
    rules: RULE_LINES.filter((r) => r.id !== "screening" && r.id !== "pressure").map((r) => ({ id: r.id, rule: r.label, source: r.source })),
    notes: view.notes,
  };
}

/**
 * A question that names a symptom the three questions ask about is not sent to the model: the answer is fixed.
 * Deliberately wide: a false alarm costs one fixed answer, a miss could cost more.
 */
const RED_FLAGS = /chest\s+(pain|tight|pressure|discomfort)|tight(ness)?\s+in\s+(my\s+)?chest|\bangina\b|faint|pass(ed|ing)?\s+out|black(ed|ing)?\s+out|dizz|light[- ]?headed|breathless|short(ness)?\s+of\s+breath|can'?t\s+breathe|palpitation|heart\b.{0,12}\b(racing|pounding|flutter)|irregular\s+heart/i;
export const FIXED_SYMPTOM_ANSWER = "I cannot say what a symptom is, and the plan is not built around one. Stop the session that brings it on. Chest pain, fainting, dizziness or breathlessness that is unusual for you needs a doctor: today, if it is happening now.";
export const isRedFlag = (question: string): boolean => RED_FLAGS.test(question);
