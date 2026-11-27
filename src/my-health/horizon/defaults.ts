/**
 * The five numbers a new horizon opens with (the founder, 27 November 2026: "Horizon targets will be - 1. Strength
 * minutes and sessions, 2. steps, 3. zone 2 minutes, 4. weekly MET-min dose and 5. fitness in METs. these 5 should be
 * in the horizon as default - any app can show this and sync to apple and google health").
 *
 * Until that day the set-up filled in no number: every field stood empty until the person typed in it. A default is a
 * suggestion: it is drawn in the field, it is theirs to change or to empty, and nothing is kept until they press
 * Start. The targets stay the person's own; the plan still sets none and changes none.
 *
 * NO FIGURE IS NEW HERE. Each default is a published figure this repository already holds, set against the person's
 * own typical week, and each row says in a few words where its number comes from:
 *
 *   zone 2     the guideline's 150 minutes a week (plan-rules.ts dose.moderateMinForLow), or the typical week where
 *              it is already more. Never more than the plan's own climb reaches by the date: ten minutes a week
 *              (plan-rules.ts progression.zone2StepMin).
 *   strength   two sessions a week (plan-rules.ts strength.minDays), or the typical week where it is more, up to four.
 *              Strength minutes are shown on the page and carry no number of their own: the guideline counts sessions.
 *   steps      the next of the published lines above the person's own days: 2,600, 7,000, 8,800 a day
 *              (step-thresholds.ts referenceLines). Offered only once steps have arrived from a device.
 *   dose       the person's weekly goal in the app when the app has sent one, else the guideline's low figure: the
 *              same floor the Guide's plan already reads when no dose is set (guidePlan.ts aimsOf).
 *   fitness    the latest test plus 1.1 METs, "the average gain across trials of about twelve weeks" (Lin 2015, as
 *              data/programme.ts already cites it for this goal). Offered only for a horizon of about twelve weeks,
 *              and only when a test is on file: a fitness number is kept to the method it started on.
 *
 * Pure, no DOM, no fetch; tests/horizon-defaults.test.mjs runs it under node.
 */
import RULES from "../../data/plan-rules.ts";
import STEPS from "../../data/step-thresholds.ts";
import { lastCompleteMonday, latestOf, round, typicalWeek, weekFigures, type Person, type Reading } from "./derive.ts";

export type DefaultKey = "zone2_week" | "strength_week" | "steps" | "dose" | "mets";
export type DefaultRow = {
  marker: DefaultKey; label: string; unit: string;
  /** What is on file, in a few words: "80 in a typical week", "6,400 a day now", "8.4 at your last test". Null when nothing is. */
  now: string | null;
  /** The number the field opens with. Null when none is offered: no steps from a device, no fitness test on file, a horizon too long or short for the published gain. */
  value: number | null;
  /** Where the number comes from, in a few words. */
  from: string;
};
/** The order the set-up and the horizon's page show them in. */
export const DEFAULT_ORDER: DefaultKey[] = ["zone2_week", "strength_week", "steps", "dose", "mets"];
export const DEFAULT_LABEL: Record<DefaultKey, string> = { zone2_week: "Zone 2", strength_week: "Strength", steps: "Steps", dose: "Weekly dose", mets: "Fitness" };
export const DEFAULT_UNIT: Record<DefaultKey, string> = { zone2_week: "min a week", strength_week: "sessions a week", steps: "a day", dose: "MET-min a week, at least", mets: "METs" };
/** The average gain in fitness across trials of about twelve weeks (data/programme.ts, build_fitness: Lin 2015). */
export const FITNESS_GAIN_METS = 1.1;
/** "About twelve weeks": the lengths, in full weeks, the published gain is offered for. */
export const FITNESS_GAIN_WEEKS = { from: 10, to: 14 };

const round5 = (v: number) => Math.round(v / 5) * 5;
const thousands = (n: number) => Math.round(n).toLocaleString("en-GB");

/**
 * The five rows for a horizon of `weeks` full weeks set today. `fitness` is the reading the fitness number would be
 * kept to (the set-up's own choice of method: programme.ts startingMethod); null when no test is on file.
 */
export function defaultTargets(a: { person: Person; today: string; weeks: number; fitness?: Reading | null }): DefaultRow[] {
  const { person, today } = a;
  const weeks = Math.max(1, Math.round(a.weeks));
  const t = typicalWeek(person, today);
  const read = t.weeks_read > 0;

  // zone 2: the guideline's line, held where the person is already past it, and never beyond the plan's own climb
  const line = RULES.dose.moderateMinForLow, base = round5(t.zone2);
  const reach = base + RULES.progression.zone2StepMin * Math.max(0, weeks - 1);
  const zone2: DefaultRow = base >= line
    ? { marker: "zone2_week", label: DEFAULT_LABEL.zone2_week, unit: DEFAULT_UNIT.zone2_week, now: `${t.zone2} in a typical week`, value: base, from: "Your typical week, held." }
    : { marker: "zone2_week", label: DEFAULT_LABEL.zone2_week, unit: DEFAULT_UNIT.zone2_week, now: read ? `${t.zone2} in a typical week` : null, value: Math.min(line, reach),
        from: reach >= line ? `The guideline's ${line} minutes a week.` : `${RULES.progression.zone2StepMin} minutes more each week, towards the guideline's ${line}.` };

  // strength: the guideline's two sessions, or the typical week where it is more
  const least = RULES.strength.minDays, most = RULES.strength.maxDays;
  const strength: DefaultRow = { marker: "strength_week", label: DEFAULT_LABEL.strength_week, unit: DEFAULT_UNIT.strength_week, now: read ? `${t.strength} in a typical week` : null,
    value: Math.max(least, Math.min(most, t.strength)), from: t.strength > least ? "Your typical week, held." : "The guideline's two sessions a week." };

  // steps: the next published line above the person's own days
  const steps = latestOf("steps", person, today);
  const lines = [STEPS.referenceLines.minimumDose, STEPS.referenceLines.cvdPeak, STEPS.referenceLines.mortalityOptimal];
  const next = steps ? lines.find((x) => x > steps.value) ?? null : null;
  const stepsRow: DefaultRow = !steps
    ? { marker: "steps", label: DEFAULT_LABEL.steps, unit: DEFAULT_UNIT.steps, now: null, value: null, from: "Steps arrive from a phone or a watch. None has arrived yet." }
    : { marker: "steps", label: DEFAULT_LABEL.steps, unit: DEFAULT_UNIT.steps, now: `${thousands(steps.value)} a day now`, value: next ?? Math.round(steps.value / 100) * 100,
        from: next ? `The next published line above your days: ${thousands(next)}.` : "Your own days, held: they are past the last published line." };

  // the weekly dose: the person's goal in the app, else the guideline's low figure (the floor guidePlan.ts aimsOf reads)
  const goal = weekFigures(person, lastCompleteMonday(today)).goal;
  const dose: DefaultRow = { marker: "dose", label: DEFAULT_LABEL.dose, unit: DEFAULT_UNIT.dose, now: t.dose != null ? `${thousands(t.dose)} in a typical week` : null,
    value: goal && goal > 0 ? Math.round(goal) : RULES.dose.lowMetMin, from: goal && goal > 0 ? "Your weekly goal in the app." : `The guideline's low figure, ${RULES.dose.lowMetMin}.` };

  // fitness: the average gain across trials of about twelve weeks, from the test on file
  const fit = a.fitness ?? null;
  const about12 = weeks >= FITNESS_GAIN_WEEKS.from && weeks <= FITNESS_GAIN_WEEKS.to;
  const mets: DefaultRow = !fit
    ? { marker: "mets", label: DEFAULT_LABEL.mets, unit: DEFAULT_UNIT.mets, now: null, value: null, from: "A fitness number needs a test on file. One can be added once the horizon is set." }
    : { marker: "mets", label: DEFAULT_LABEL.mets, unit: DEFAULT_UNIT.mets, now: `${round(fit.value, 1).toFixed(1)} at your last test`, value: about12 ? round(fit.value + FITNESS_GAIN_METS, 1) : null,
        from: about12 ? `${FITNESS_GAIN_METS} METs up: the average gain across trials of about twelve weeks.` : "No published gain for this length. The number is yours to set." };

  return [zone2, strength, stepsRow, dose, mets];
}
