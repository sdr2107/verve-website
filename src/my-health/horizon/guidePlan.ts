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
 * Pure, no DOM, no fetch; tests/guide-plan.test.mjs runs it under node, and
 * the horizon edge function copies this file for the chat's inputs.
 */
import { addDays, localDay, medianOf, mondayOf } from "../derive/format.ts";
import { restingBPOf } from "../derive/markers.ts";
import RULES from "../../data/plan-rules.ts";
import {
  dedupeSessions, horizonMondays, lastCompleteMonday, latestOf, numberWord, weekFigures,
  type HorizonLike, type Person, type PlanRow, type Target,
} from "./derive.ts";

// ── the three questions (board 06) ──

export type ScreenAnswers = { active: boolean; disease: boolean; symptoms: boolean };
/** full: the plan as drawn. easy4: zone 2 only, harder minutes after four weeks. easy: zone 2 only until a doctor's word. none: no plan. */
export type ScreenOutcome = "full" | "easy4" | "easy" | "none";
export const SCREEN_QUESTIONS: { key: keyof ScreenAnswers; text: string }[] = [
  { key: "active", text: `Have you been active on at least ${numberWord(RULES.screening.activeDays)} days a week for the last ${numberWord(RULES.screening.activeMonths)} months?` },
  { key: "disease", text: "Do you have heart, metabolic or kidney disease?" },
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
/** The plan in use, as horizon_plans.guide keeps it. The answers themselves are not here: only what they allow. */
export type GuideStored = { v: 1; accepted_on: string; first_monday: string; base: GuideBase; choices: GuideChoices; mode: Exclude<ScreenOutcome, "none"> };

export function isGuideStored(x: unknown): x is GuideStored {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, any>;
  return o.v === 1 && typeof o.first_monday === "string" && typeof o.accepted_on === "string" && !!o.base && typeof o.base === "object"
    && Number.isFinite(Number(o.base.zone2)) && Number.isFinite(Number(o.base.harder)) && (o.mode === "full" || o.mode === "easy4" || o.mode === "easy");
}

// ── small parts ──

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const round5 = (v: number) => Math.round(v / 5) * 5;
const thousands = (n: number) => Math.round(n).toLocaleString("en-GB");
const med = (xs: number[]) => (xs.length ? medianOf(xs)! : 0);
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

/** A typical week of the last eight complete ones: the medians, a week with nothing on file counted as nothing. */
export function baseOf(person: Person, today: string): GuideBase {
  const weeks = [];
  let m = lastCompleteMonday(today);
  for (let i = 0; i < 8; i++) { weeks.push(weekFigures(person, m)); m = addDays(m, -7); }
  const doses = weeks.filter((w) => w.dose != null).map((w) => w.dose!);
  const steps = latestOf("steps", person, today);
  return {
    zone2: Math.round(med(weeks.map((w) => w.zone2 ?? 0))),
    harder: Math.round(med(weeks.map((w) => w.zone3 ?? Math.max(0, (w.zoned ?? 0) - (w.zone2 ?? 0))))),
    dose: doses.length ? Math.round(med(doses)) : null,
    aerobic: Math.round(med(weeks.map((w) => Math.max(0, w.sessions - w.strength)))),
    strength: Math.round(med(weeks.map((w) => w.strength))),
    steps: steps ? Math.round(steps.value) : null,
    weeks_read: weeks.filter((w) => w.sessions > 0 || w.dose != null).length,
    types: loggedTypes(person, today),
  };
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

export function climbOf(a: { base: GuideBase; aims: Aims; mode: "full" | "easy4" | "easy"; noHarder: boolean; weeks: number; days: number }): Climb {
  const { base, aims } = a;
  const n = Math.max(1, a.weeks);
  const tier = tierOf(aims.mets);
  const per = metPerMinute(aims.mets);
  const easy = a.mode !== "full" || a.noHarder;
  const harderBase = round5(base.harder);
  // zone 2 only: the harder minutes of a typical week are done in zone 2 instead
  const zoneBase = easy ? base.zone2 + base.harder : base.zone2;
  const doseOf = (z: number, h: number) => (base.dose != null ? base.dose + (z - base.zone2) * per.zone2 + (h - base.harder) * per.harder : z * per.zone2 + h * per.harder);
  const smallest = RULES.aerobic.minDays * RULES.aerobic.minSessionMin;
  const wantsZone = aims.zone2 != null && aims.zone2 > round5(zoneBase);
  const needs = (z: number, h: number) => (aims.zone2 != null && z < aims.zone2) || doseOf(z, h) < aims.doseFloor - 0.5 || z + h < smallest;
  const up = (z: number, h: number) => {
    const next = z + RULES.progression.zone2StepMin;
    // the zone 2 target is not stepped past unless the dose or the smallest week still asks for more
    return aims.zone2 != null && z < aims.zone2 && next > aims.zone2 && doseOf(aims.zone2, h) >= aims.doseFloor - 0.5 && aims.zone2 + h >= smallest ? aims.zone2 : next;
  };
  const harderAt = (i: number, prev: number, zPrev: number) => {
    if (a.noHarder || a.mode === "easy") return 0;
    if (a.mode === "easy4") return i < RULES.screening.harderAfterWeeks ? 0 : Math.min(harderBase, RULES.progression.harderFloorMin);
    // first tier, zone 2 climbing to a target: harder minutes ease while it climbs, never under the floor, never under the dose
    if (i > 0 && tier === 1 && wantsZone && zPrev < (aims.zone2 ?? 0) && prev > RULES.progression.harderFloorMin) return Math.max(RULES.progression.harderFloorMin, prev - RULES.progression.harderEaseMin);
    return prev;
  };
  const steps: Step[] = [];
  let z = 0, h = 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) {
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
    const total = z + h;
    const avg = total / Math.max(1, a.days);
    const lo = Math.max(RULES.aerobic.minSessionMin, Math.min(RULES.aerobic.maxSessionMin - 10, Math.floor(avg / 10) * 10));
    steps.push({ zone2: z, harder: h, total, dose: round5(doseOf(z, h)), lo, hi: lo + 10 });
  }
  return { steps, climbs: steps.some((s) => s.zone2 !== steps[0].zone2), eases: steps.some((s) => s.harder < steps[0].harder), start: { zone2: round5(zoneBase), harder: harderBase } };
}

/** The steps a day a week of the plan asks for, when steps are a target above today's figure: even steps, reaching it a week before the end. */
export function stepsAt(base: GuideBase, aims: Aims, i: number, n: number): number | null {
  if (aims.steps == null || base.steps == null) return null;
  if (aims.steps <= base.steps) return aims.steps;
  const start = Math.min(aims.steps, Math.ceil(base.steps / 100) * 100);
  if (n <= 2 || i >= n - 2) return i >= n - 2 ? aims.steps : start;
  return Math.min(aims.steps, Math.round((start + ((aims.steps - start) * i) / (n - 2)) / 50) * 50);
}

// ── where the person is on the climb ──

export type Progress = {
  /** The plan's week today is in, from 0; -1 before its first Monday. */ week: number;
  /** The step that week carries, from 0: behind the week when a step was repeated. */ step: number;
  repeated: number; steppedBack: boolean;
  /** The step each week of the plan carries: what was asked in the weeks behind, what will be asked in those ahead. */ stepOfWeek: number[];
};
/**
 * A week that did not reach its zone 2 figure repeats its step; two in a row step the plan back one. A week above the
 * plan changes nothing. "Reached" allows half a step's rounding (five minutes under). Nothing is ever asked back.
 */
export function progressOf(climb: Climb, mondays: string[], person: Person, today: string): Progress {
  const n = climb.steps.length;
  const thisMonday = mondayOf(new Date(today + "T00:00:00"));
  let week = -1;
  for (let i = 0; i < mondays.length; i++) if (mondays[i] <= thisMonday) week = i;
  const stepOfWeek: number[] = [];
  let s = 0, misses = 0, steppedBack = false;
  for (let i = 0; i < n; i++) {
    stepOfWeek.push(Math.min(s, n - 1));
    if (i >= week) { s = Math.min(n - 1, s + 1); continue; }          // this week and the ones ahead: a step each
    const want = climb.steps[Math.min(s, n - 1)].zone2;
    const next = climb.steps[Math.min(s + 1, n - 1)].zone2;
    const did = weekFigures(person, mondays[i]).zone2 ?? 0;
    if (next <= want || did >= want - RULES.progression.zone2StepMin / 2) { s = Math.min(n - 1, s + 1); misses = 0; steppedBack = false; }
    else if (++misses >= 2) { s = Math.max(0, s - 1); misses = 0; steppedBack = true; }
  }
  const step = week < 0 ? 0 : stepOfWeek[Math.min(week, n - 1)];
  return { week, step, repeated: week < 0 ? 0 : Math.max(0, Math.min(week, n - 1) - step), steppedBack: steppedBack && week >= 0, stepOfWeek };
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
export type ClimbRow = { week: number; monday: string; zone2: number; harder: number; total: number; dose: number; sets: string; steps: number | null; test: boolean; state: "past" | "now" | "future"; repeats: boolean };
export type SoFar = { key: string; label: string; done: number; of: number; text: string };
export type Option = { id: string; title: string; says: string; rows: { label: string; from: string; to: string }[]; choices: GuideChoices };
export type GuidePlanView = {
  mode: "full" | "easy4" | "easy"; noHarder: boolean;
  weeks: number; /** The plan's week today is in, from 1; 0 before its first Monday. */ week: number; firstMonday: string; started: boolean;
  status: string; lead: string; tiles: Tile[];
  fitt: { letter: string; name: string; now: string; by: string }[];
  why: { head: string; text: string }[];
  climb: ClimbRow[]; climbNote: string;
  moves: { head: string; text: string }[];
  soFar: SoFar[];
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

  const climb = climbOf({ base, aims, mode, noHarder, weeks: n, days });
  const prog = progressOf(climb, mondays, person, today);
  const started = prog.week >= 0;
  const wk = Math.max(0, Math.min(prog.week, n - 1));
  const now = climb.steps[prog.step];
  const last = climb.steps[prog.stepOfWeek[n - 1]];
  const weekOfStep = (pred: (s: Step) => boolean) => { for (let i = 0; i < n; i++) if (pred(climb.steps[prog.stepOfWeek[i]])) return i + 1; return null; };
  const zoneAt = aims.zone2 != null ? weekOfStep((s) => s.zone2 >= aims.zone2!) : null;
  const zoneShort = aims.zone2 != null && last.zone2 < aims.zone2;
  const doseShort = last.dose < aims.doseFloor - 2.5;
  const harderFloorAt = climb.eases ? weekOfStep((s) => s.harder <= Math.min(...climb.steps.map((x) => x.harder))) : null;
  const harderEnd = Math.min(...climb.steps.map((x) => x.harder));
  const testWeeks = [...new Set([RULES.retest.weeks, n].filter((w) => w >= 1 && w <= n))].sort((x, y) => x - y);
  const stepsNow = stepsAt(base, aims, wk, n);
  const stepsReach = aims.steps != null && base.steps != null && aims.steps > base.steps ? (() => { for (let i = 0; i < n; i++) if ((stepsAt(base, aims, i, n) ?? 0) >= aims.steps!) return i + 1; return null; })() : null;
  const stepsPer = aims.steps != null && base.steps != null && aims.steps > base.steps && n > 2 ? Math.max(50, Math.round((aims.steps - Math.ceil(base.steps / 100) * 100) / (n - 2) / 50) * 50) : null;
  const off = Math.max(1, 7 - days - strengthDays);
  const shares = days + strengthDays > 6;
  const floorWords = aims.doseFloorFrom === "target" ? `your floor of ${thousands(aims.doseFloor)}` : aims.doseFloorFrom === "goal" ? `your weekly goal of ${thousands(aims.doseFloor)}` : `the guideline's ${thousands(aims.doseFloor)}`;
  const sets = setsWords(base, wk);
  const typeLine = types.length ? `${cap(orList(types))}: the types you already log.` : "Brisk walking, cycling or swimming: any steady activity of the large muscles.";
  const harderName = tier >= 2 ? `at ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve` : "above zone 2";

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
    ? `So the plan moves minutes into zone 2, ${numberWord(RULES.progression.zone2StepMin)} more each week, and keeps ${harderEnd} harder minutes in the week for your fitness.`
    : `So the plan adds ${numberWord(RULES.progression.zone2StepMin)} minutes of zone 2 each week${zoneAt ? ` until week ${zoneAt}` : ""}.`);
  else lead.push(mode !== "full" || noHarder ? "The week's minutes stay as they are, all of them in zone 2." : "The plan holds the week as it is.");

  // the week, as six tiles
  const tiles: Tile[] = [
    { key: "aerobic", small: "Aerobic", big: plural(days, "session"), text: `${now.lo} to ${now.hi} minutes each. ${typeLine}` },
    { key: "zone2", small: "Of which, easy", big: `${now.zone2} minutes in zone 2`, text: ["You can talk in full sentences.", now.zone2 > base.zone2 && base.zone2 > 0 ? `Up from ${base.zone2}.` : "", aims.zone2 != null && now.zone2 < aims.zone2 ? (zoneShort ? `It reaches ${last.zone2} by the date.` : `It reaches ${aims.zone2} in week ${zoneAt}.`) : ""].filter(Boolean).join(" ") },
    now.harder > 0
      ? { key: "harder", small: "Of which, harder", big: `${now.harder} minutes ${harderName}`, text: ["Talking is broken into phrases.", climb.eases && now.harder > harderEnd ? `It steps down to ${harderEnd} by week ${harderFloorAt} and stays there.` : "", mode === "easy4" ? "" : ""].filter(Boolean).join(" ") }
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
    { letter: "P", name: "Pattern", now: climb.climbs ? `${cap(numberWord(RULES.progression.zone2StepMin))} more minutes of zone 2 each week${climb.eases ? `, ${numberWord(RULES.progression.harderEaseMin)} fewer harder` : ""}` : "The same week, held", by: [climb.climbs && zoneAt && zoneAt < n ? `Held from week ${zoneAt}.` : "", `Fitness tested in week ${testWeeks.join(" and week ")}.`].filter(Boolean).join(" ") },
  ];

  // why this, for this person
  const why: { head: string; text: string }[] = [];
  if (aims.mets == null) why.push({ head: "No fitness test is on file.", text: `The plan starts as for a fitness under ${RULES.tiers.secondFromMets} METs: volume before intensity. A test would place you.` });
  else if (tier === 1) why.push({ head: `Your fitness is ${aims.mets.toFixed(1)} METs.`, text: `Under ${RULES.tiers.secondFromMets}, the rule is to build volume at about half of heart-rate reserve before adding intensity. If a test reads ${RULES.tiers.secondFromMets.toFixed(1)} or more, the harder minutes move to ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}%.` });
  else why.push({ head: `Your fitness is ${aims.mets.toFixed(1)} METs.`, text: tier === 2 ? `From ${RULES.tiers.secondFromMets} to ${RULES.tiers.thirdFromMets}, the rule puts harder work at ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve. The plan keeps your harder minutes and adds none.` : `At ${RULES.tiers.thirdFromMets} or more the rule allows harder work than the plan writes. The plan keeps your harder minutes and adds none.` });
  if (aims.zone2 != null && aims.zone2 > climb.start.zone2) why.push({
    head: base.zone2 > 0 && aims.zone2 / base.zone2 >= 1.8 ? `Your zone 2 target is ${timesWords(aims.zone2 / base.zone2)} a typical week's figure.` : `Your zone 2 target is ${aims.zone2} minutes.`,
    text: zoneShort ? `${cap(numberWord(RULES.progression.zone2StepMin))} minutes a week reaches ${last.zone2} by the date, short of your ${aims.zone2}. The plan does not take bigger steps.`
      : `${cap(numberWord(RULES.progression.zone2StepMin))} minutes a week reaches ${aims.zone2} in week ${zoneAt}${zoneAt != null && n - zoneAt >= 1 ? ` and leaves ${plural(n - zoneAt, "week")} to hold it before the date` : ""}.`,
  });
  if (climb.eases) why.push({ head: `${cap(floorWords)} is kept.`, text: `A minute in zone 2 adds less to the dose than a harder one: about ${per.zone2.toFixed(1)} against ${per.harder.toFixed(1)} METs for you. So the plan keeps ${harderEnd} harder minutes in the week.` });
  else if (doseShort) why.push({ head: `${cap(floorWords)} is not reached by the date.`, text: `At ${numberWord(RULES.progression.zone2StepMin)} minutes a week the plan's last week comes to about ${thousands(last.dose)}. The plan does not take bigger steps.` });
  else if (base.dose != null && base.dose < aims.doseFloor) why.push({ head: `Your weeks are under ${floorWords}.`, text: `The plan adds zone 2 minutes until the week reaches it, in week ${weekOfStep((s) => s.dose >= aims.doseFloor - 2.5)}.` });

  // every week of the plan
  const climbRows: ClimbRow[] = mondays.map((monday, i) => {
    const s = climb.steps[prog.stepOfWeek[i]];
    return { week: i + 1, monday, zone2: s.zone2, harder: s.harder, total: s.total, dose: s.dose, sets: setsWords(base, i), steps: stepsAt(base, aims, i, n), test: testWeeks.includes(i + 1),
      state: !started ? "future" : i < wk ? "past" : i === wk ? "now" : "future", repeats: i > 0 && prog.stepOfWeek[i] === prog.stepOfWeek[i - 1] && climb.steps[Math.min(n - 1, prog.stepOfWeek[i] + 1)].zone2 > s.zone2 };
  });
  const climbNote = per.from === "fitness"
    ? `A zone 2 minute is counted at about ${per.zone2.toFixed(1)} METs for you and a harder minute at about ${per.harder.toFixed(1)}, from your fitness of ${aims.mets!.toFixed(1)} METs. The dose of a planned week is an estimate: the app measures the real one.`
    : "No fitness test is on file, so a planned minute is counted by the guideline's own equivalence. The dose of a planned week is an estimate: the app measures the real one.";

  const moves = [
    { head: "A missed week", text: "The plan repeats that week's step. It never asks you to catch up." },
    { head: "A week above it", text: `Nothing changes. The next step is still ${numberWord(RULES.progression.zone2StepMin)} minutes.` },
    ...(tier === 1 && aims.mets != null ? [{ head: `The week ${testWeeks[0]} test`, text: `At ${RULES.tiers.secondFromMets.toFixed(1)} METs or more, the harder minutes move to ${RULES.tiers.secondHrrLowPct} to ${RULES.tiers.secondHrrHighPct}% of heart-rate reserve. Under ${RULES.tiers.secondFromMets.toFixed(1)}, they stay as they are.` }] : []),
    { head: "Two weeks missed", text: "The plan steps back one week and says so." },
  ];

  // this week so far, from the sessions and the days
  const f = weekFigures(person, mondays[wk]);
  const weekDays = person.signals.filter((s) => s?.steps != null && String(s.day).slice(0, 10) >= mondays[wk] && String(s.day).slice(0, 10) < addDays(mondays[wk], 7)).map((s) => Number(s.steps));
  const stepsDone = weekDays.length ? Math.round(weekDays.reduce((t, v) => t + v, 0) / weekDays.length) : 0;
  const harderDone = Math.round(f.zone3 ?? Math.max(0, (f.zoned ?? 0) - (f.zone2 ?? 0)));
  const soFar: SoFar[] = started ? [
    { key: "sessions", label: "Sessions", done: f.sessions, of: days + strengthDays, text: `${f.sessions} of ${days + strengthDays}` },
    { key: "zone2", label: "Zone 2", done: Math.round(f.zone2 ?? 0), of: now.zone2, text: `${Math.round(f.zone2 ?? 0)} of ${now.zone2} min` },
    ...(now.harder > 0 ? [{ key: "harder", label: "Harder", done: harderDone, of: now.harder, text: `${harderDone} of ${now.harder} min` }] : []),
    { key: "strength", label: "Strength", done: f.strength, of: strengthDays, text: `${f.strength} of ${strengthDays}` },
    ...(stepsNow != null ? [{ key: "steps", label: "Steps a day", done: stepsDone, of: stepsNow, text: `${thousands(stepsDone)} of ${thousands(stepsNow)}` }] : []),
  ] : [];

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
  else if (prog.repeated > 0) notes.push(`${prog.repeated === 1 ? "One week was" : `${cap(numberWord(prog.repeated))} weeks were`} under the plan's zone 2 figure, so ${prog.repeated === 1 ? "its step is" : "their steps are"} repeated. Nothing is asked back.`);
  if (zoneShort) notes.push(`At this pace zone 2 reaches ${last.zone2} minutes by the date, short of your ${aims.zone2}.`);
  if (!started) notes.push(`The plan's first week starts on Monday ${new Date(mondays[0] + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`);

  // the changes the person, or the chat, can make: a closed list, each worked out by the same arithmetic
  const options: Option[] = [];
  const pickedNow = { aerobic_days: days, strength_days: strengthDays, layout, leave_out: leaveOut };
  for (const d of [3, 4, 5]) {
    if (d === days) continue;
    const c = climbOf({ base, aims, mode, noHarder, weeks: n, days: d }).steps[prog.step];
    const offD = Math.max(1, 7 - d - strengthDays);
    options.push({ id: `days-${d}`, title: `${cap(numberWord(d))} aerobic days`, says: `${cap(numberWord(d))} aerobic sessions of ${c.lo} to ${c.hi} minutes. The week's minutes stay at ${c.total}, with ${c.zone2} in zone 2.`,
      rows: [{ label: "Aerobic sessions", from: String(days), to: String(d) }, { label: "Minutes a session", from: `${now.lo} to ${now.hi}`, to: `${c.lo} to ${c.hi}` }, { label: "Days off", from: String(off), to: String(offD) }],
      choices: { ...pickedNow, aerobic_days: d } });
  }
  const strengthChoices: [number, Layout][] = [[2, "whole"], [3, "whole"], [3, "ppl"], [4, "upper_lower"], [4, "push_pull"]];
  for (const [d, l] of strengthChoices) {
    if (d === strengthDays && l === layout) continue;
    const more = d - strengthDays;
    options.push({ id: `strength-${d}-${l}`, title: `${cap(numberWord(d))} strength days: ${LAYOUT_WORDS[l].name}`,
      says: `${layoutLine(d, l)}. Each muscle group is loaded ${eachGroup(d, l)}.${more > 0 ? ` That adds ${plural(more, "session")} to your week.` : more < 0 ? ` That takes ${plural(-more, "session")} out of your week.` : ""}`,
      rows: [{ label: "Strength sessions", from: String(strengthDays), to: String(d) }, { label: "Layout", from: layoutLine(strengthDays, layout), to: layoutLine(d, l) }, { label: "Each muscle group", from: eachGroup(strengthDays, layout), to: eachGroup(d, l) }],
      choices: { ...pickedNow, strength_days: d, layout: l } });
  }
  for (const t of types) {
    if (types.length < 2) break;
    const rest = types.filter((x) => x !== t);
    options.push({ id: `leave-${t.replace(/[^a-z0-9]+/g, "-")}`, title: `Leave out ${t}`, says: `${cap(t)} is left out. Its minutes move to ${orList(rest)} at the same intensity.`,
      rows: [{ label: "Type", from: orList(types), to: orList(rest) }], choices: { ...pickedNow, leave_out: [...leaveOut, t] } });
  }
  if (leaveOut.length) options.push({ id: "types-all", title: "Bring every type back", says: `${cap(andList(leaveOut))} ${leaveOut.length === 1 ? "comes" : "come"} back into the plan.`,
    rows: [{ label: "Type", from: orList(types), to: orList(base.types) }], choices: { ...pickedNow, leave_out: [] } });

  return {
    mode, noHarder, weeks: n, week: started ? wk + 1 : 0, firstMonday: mondays[0], started,
    status: started ? `Week ${wk + 1} of ${n}${prog.repeated > 0 ? " · a step repeated" : ""}` : `Starts Monday · ${plural(n, "week")}`,
    lead: lead.join(" "), tiles, fitt, why, climb: climbRows, climbNote, moves, soFar,
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
  how_the_plan_moves: string[];
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
    how_the_plan_moves: view.moves.map((m) => `${m.head}: ${m.text}`),
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
