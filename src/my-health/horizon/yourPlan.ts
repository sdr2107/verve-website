/**
 * "Your plan", the third tab of a horizon (the founder, 27 November 2026: "rename the science to 'your plan' tabs - in
 * the your plan tab - keep it simple - the three cards - your fitness, your tier and your aim - good. Below that
 * FITTVP - tighten the boxes - calm and simple").
 *
 * Three cards, then six small cards of one size, one for each letter of FITT-VP: a name, ONE line for this week and
 * ONE small line under it. Nothing here is worked out: every figure is the Guide's plan as ./guidePlan.ts already
 * holds it (its `place` and its `fitt`), said shorter. The long note the Intensity card carried on the old page is one
 * line here: the person's own range in beats when the app's band was handed in (./heartBand.ts), else what the effort
 * feels like.
 *
 * What the old page showed around these and this tab leaves out, on the founder's word: the three tier rows and the
 * note under them, "Ask about it", "The plan works on N of your targets", "It watches N and has no line for them",
 * "The rules behind it", the climb and the strength layouts. They are still drawn by views/GuidePlan.tsx on the
 * hidden pages (./pages.ts HORIZON_OLD_PAGES).
 *
 * Where there are no six letters to show, the tab says why in one line and shows the three cards it can:
 *   a plan that has not begun    the cards and the letters, and the Monday it starts;
 *   a horizon kept or stopped    the cards, and that the plan has stopped;
 *   no Guide's plan              the cards, and that the horizon follows the person's own targets.
 *
 * Pure, no DOM, no fetch; tests/your-plan.test.mjs runs it under node. The horizon function does not copy this file.
 */
import RULES from "../../data/plan-rules.ts";
import { weekdayDayMonth } from "./derive.ts";
import type { GuidePlanView } from "./guidePlan.ts";
import { STEADY_FEEL, beatsWords, type Heart } from "./heartBand.ts";

export type PlanCard = { key: "fitness" | "tier" | "aim"; label: string; big: string; small: string };
export type LetterCard = { key: "frequency" | "intensity" | "time" | "type" | "volume" | "progression"; /** "F · Frequency" */ label: string; /** This week, in one line. */ now: string; /** One small line under it. */ by: string };
export type YourPlan = { cards: PlanCard[]; letters: LetterCard[]; /** One quiet line, where something has to be said; else null. */ line: string | null };

export const PLAN_STOPPED = "The plan has stopped. These are the figures it worked from.";
export const PLAN_OWN = "This horizon follows your own targets. It has no weekly plan.";
export const PLAN_OWN_THEIRS = "This horizon follows their own targets. It has no weekly plan.";
export const BY_SAME = "By the date: the same";
export const TYPE_ANY = "Or any steady activity";
export const TYPE_NONE = "Brisk walking, cycling, swimming";
export const SHORT_WEEK = "A short week is asked again";
export const HELD = "The same week, held";
export const NOTHING_ADDED = "Nothing is ever added on";
export const EFFORT_NOW = "A steady effort";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const noStop = (s: string) => s.replace(/\.$/, "");
/** "minutes" and "MET-minutes" as the tab writes them. */
const shorter = (s: string) => s.replace(/MET-minutes/g, "MET-min").replace(/\bminutes\b/g, "min");
/** The first sentence of a line that may carry a second. */
const firstSentence = (s: string) => { const i = s.search(/\.(\s|$)/); return i < 0 ? s : s.slice(0, i); };
/** The plan's "by the date" words as one small line. */
const byLine = (by: string, drop = "") => (by.trim() === "The same" ? BY_SAME : `By the date: ${lowerFirst(noStop(shorter(firstSentence(by)))).replace(drop, "").trim()}`);

/** The three cards: fitness, the tier it puts the person in, and their own aim. */
export function planCards(view: Pick<GuidePlanView, "place">, self: boolean): PlanCard[] {
  const p = view.place, who = self ? "Your" : "Their";
  return [
    { key: "fitness", label: `${who} fitness`, big: p.fitness.big, small: p.fitness.small },
    { key: "tier", label: `${who} tier`, big: p.tier.big, small: p.tier.small },
    { key: "aim", label: `${who} aim`, big: p.aim ? p.aim.big : "Not set", small: p.aim ? p.aim.small : "This horizon has no fitness target." },
  ];
}

/** The six letters, each as one line and one small line. */
export function planLetters(view: Pick<GuidePlanView, "fitt" | "climbs" | "base" | "choices">, heart: Heart | null | undefined): LetterCard[] {
  const of = (letter: string, name: string) => view.fitt.find((r) => r.letter === letter && r.name === name) ?? null;
  const f = of("F", "Frequency"), time = of("T", "Time"), vol = of("V", "Volume");
  const types = view.base.types.filter((t) => !(view.choices.leave_out ?? []).includes(t));
  return [
    // "3 aerobic sessions, 2 strength, 1 day off" without the word that pushed it onto a second line at a phone's width
    { key: "frequency", label: "F · Frequency", now: f ? noStop(f.now).replace(/ aerobic sessions?/, " aerobic") : "", by: f ? byLine(f.by) : BY_SAME },
    { key: "intensity", label: "I · Intensity", now: heart?.kind === "beats" ? cap(beatsWords(heart.band)) : EFFORT_NOW, by: noStop(STEADY_FEEL) },
    { key: "time", label: "T · Time", now: time ? noStop(shorter(time.now)) : "", by: time ? byLine(time.by, " a session") : BY_SAME },
    { key: "type", label: "T · Type", now: types.length ? cap(types.join(", ")) : TYPE_NONE, by: TYPE_ANY },
    { key: "volume", label: "V · Volume", now: vol ? noStop(shorter(vol.now)) : "", by: vol ? byLine(vol.by) : BY_SAME },
    { key: "progression", label: "P · Progression", now: view.climbs ? `${RULES.progression.zone2StepMin} more zone 2 min a week` : HELD, by: view.climbs ? SHORT_WEEK : NOTHING_ADDED },
  ];
}

/**
 * The tab, for a horizon as it stands.
 *   view      the Guide's plan in use (guidePlan with the stored plan), or a draft worked out today when the horizon
 *             has none (only its three cards are used), or null when neither can be said;
 *   inUse     the view is the plan in use, not a draft;
 *   running   the plan is still being run: the horizon is open and not merely kept.
 */
export function yourPlanOf(a: { view: GuidePlanView | null; inUse: boolean; running: boolean; self: boolean; heart?: Heart | null }): YourPlan {
  const { view, self } = a;
  if (!view) return { cards: [], letters: [], line: a.inUse ? PLAN_STOPPED : self ? PLAN_OWN : PLAN_OWN_THEIRS };
  const cards = planCards(view, self);
  if (!a.inUse) return { cards, letters: [], line: self ? PLAN_OWN : PLAN_OWN_THEIRS };
  if (!a.running) return { cards, letters: [], line: PLAN_STOPPED };
  return { cards, letters: planLetters(view, a.heart), line: view.started ? null : `The plan starts on ${weekdayDayMonth(view.firstMonday)}.` };
}
