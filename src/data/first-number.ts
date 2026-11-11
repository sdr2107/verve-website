/**
 * first-number — the two field-test equations, as arithmetic.
 *
 * One place for the sum. The printed sheet (/sheet, /start/sheet) prints
 * its lines and its worked examples from here, and the Find-your-number
 * tool on the landing page computes with the same functions, so the page
 * and the paper cannot give two answers.
 *
 * The equations are the app's own (`lib/calculations.ts`:
 * `estimateCRFFromCooperRun`, and the Hong 2019 branch of
 * `estimateCRFFrom6MinuteWalk`), with the app's own input ranges. If the
 * app's file changes, change this one the same day. The app also holds a
 * line for people over 60 that takes height (Šagát 2023); the sheet and
 * this tool ask for no height, so both use the Hong line and say so.
 *
 * Pure: no imports, no DOM, no dates. `tests/first-number.test.mjs`.
 */

/** One MET is 3.5 mL of oxygen per kg per minute. */
export const ML_PER_MET = 3.5;

/** Cooper KH, JAMA, 1968: VO2max = (metres − 504.9) ÷ 44.73. */
export const RUN_EQ = { offset: 504.9, divisor: 44.73, minMetres: 400, maxMetres: 5000 } as const;

/** Hong SH et al., 2019: VO2max = 61.1 − 11.1 × sex − 0.4 × age − 0.2 × kg + 0.02 × metres; sex 1 for a man, 2 for a woman. */
export const WALK_EQ = { base: 61.1, sex: 11.1, age: 0.4, weight: 0.2, metres: 0.02, maxMetres: 1500 } as const;

export type Test = "walk6" | "run12";
export type Sex = "male" | "female";

const round1 = (n: number) => Math.round(n * 10) / 10;
/** A number as the sheet prints it: no trailing ".0" on a whole number, a comma in the thousands. */
const plain = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : String(round1(n)));

/** VO2max from a twelve-minute run, unrounded. */
export const runVo2 = (metres: number): number => (metres - RUN_EQ.offset) / RUN_EQ.divisor;

/** VO2max from a six-minute walk, unrounded. */
export const walkVo2 = (p: { sex: Sex; age: number; weightKg: number; metres: number }): number =>
  WALK_EQ.base - WALK_EQ.sex * (p.sex === "female" ? 2 : 1) - WALK_EQ.age * p.age - WALK_EQ.weight * p.weightKg + WALK_EQ.metres * p.metres;

/** METs from VO2max, unrounded. */
export const metsFromVo2 = (vo2: number): number => vo2 / ML_PER_MET;

/** The equations as the sheet prints them, built from the constants above. */
export const RUN_LINES = [`VO2max = (metres − ${RUN_EQ.offset}) ÷ ${RUN_EQ.divisor}`, `METs = VO2max ÷ ${ML_PER_MET}`];
export const WALK_LINES = [
  `VO2max = ${WALK_EQ.base} − ${WALK_EQ.sex} × sex − ${WALK_EQ.age} × age − ${WALK_EQ.weight} × weight kg + ${WALK_EQ.metres} × metres`,
  "sex: 1 for a man, 2 for a woman",
  `METs = VO2max ÷ ${ML_PER_MET}`,
];

/** The run's sum, written out: "(2400 − 504.9) ÷ 44.73 = 42.4". */
export function runWorking(metres: number): { sum: string; vo2: number; mets: number } {
  const vo2 = runVo2(metres);
  return { sum: `(${metres} − ${RUN_EQ.offset}) ÷ ${RUN_EQ.divisor} = ${round1(vo2).toFixed(1)}`, vo2: round1(vo2), mets: round1(metsFromVo2(vo2)) };
}

/** The walk's sum, written out: "61.1 − 11.1 − 18 − 16 + 12 = 28.0". */
export function walkWorking(p: { sex: Sex; age: number; weightKg: number; metres: number }): { sum: string; vo2: number; mets: number } {
  const vo2 = walkVo2(p);
  const terms = [WALK_EQ.sex * (p.sex === "female" ? 2 : 1), WALK_EQ.age * p.age, WALK_EQ.weight * p.weightKg, WALK_EQ.metres * p.metres].map((t) => plain(round1(t)));
  return { sum: `${WALK_EQ.base} − ${terms[0]} − ${terms[1]} − ${terms[2]} + ${terms[3]} = ${round1(vo2).toFixed(1)}`, vo2: round1(vo2), mets: round1(metsFromVo2(vo2)) };
}

/** The sheet's two worked examples, as inputs; the printed sentences are built from them. */
export const RUN_EXAMPLE = { metres: 2400 } as const;
export const WALK_EXAMPLE = { sex: "male" as Sex, age: 45, weightKg: 80, metres: 600 } as const;

export function runExampleText(): { text: string; mets: string } {
  const w = runWorking(RUN_EXAMPLE.metres);
  const mets = `${w.mets.toFixed(1)} METs`;
  return { text: `${RUN_EXAMPLE.metres.toLocaleString("en-US")} m: ${w.sum}, and ${w.vo2.toFixed(1)} ÷ ${ML_PER_MET} = ${mets}.`, mets };
}
export function walkExampleText(): { text: string; mets: string } {
  const e = WALK_EXAMPLE, w = walkWorking(e);
  const mets = `${w.mets.toFixed(1)} METs`;
  return { text: `A man of ${e.age}, ${e.weightKg} kg, ${e.metres} m: ${w.sum}, and ${w.vo2.toFixed(1)} ÷ ${ML_PER_MET} = ${mets}.`, mets };
}

/** What a person types into the tool. Anything may be missing or not a number. */
export interface FirstNumberInput { test: Test; metres: number; age: number; sex: Sex; weightKg: number }

export type FirstNumber =
  | { ok: true; test: Test; metres: number; age: number; sex: Sex; weightKg: number; vo2: number; mets: number; working: string; over60: boolean }
  | { ok: false; field: "metres" | "age" | "weightKg" | "result"; reason: string };

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * The result, or the one plain reason there is none. Never a number for an
 * input the equations were not written for: the ranges are the app's
 * (walk up to 1,500 m; run 400 to 5,000 m), the ages are Verve's (18 and
 * over), and a result under one MET, which is below rest, is refused.
 */
export function firstNumber(i: FirstNumberInput): FirstNumber {
  if (!isNum(i.metres) || i.metres <= 0) return { ok: false, field: "metres", reason: "Enter the distance in metres." };
  if (i.test === "walk6" && i.metres > WALK_EQ.maxMetres) return { ok: false, field: "metres", reason: `More than ${WALK_EQ.maxMetres.toLocaleString("en-US")} m in six minutes is a run. Choose the twelve-minute run.` };
  if (i.test === "run12" && i.metres < RUN_EQ.minMetres) return { ok: false, field: "metres", reason: `Under ${RUN_EQ.minMetres} m the run's equation has nothing to say. Try the six-minute walk.` };
  if (i.test === "run12" && i.metres > RUN_EQ.maxMetres) return { ok: false, field: "metres", reason: `The run's equation stops at ${RUN_EQ.maxMetres.toLocaleString("en-US")} m. Check the distance.` };
  if (!isNum(i.age) || i.age < 18) return { ok: false, field: "age", reason: isNum(i.age) && i.age > 0 ? "Verve is for adults: 18 and over." : "Enter your age in years." };
  if (i.age > 100) return { ok: false, field: "age", reason: "Enter an age up to 100." };
  if (i.test === "walk6" && (!isNum(i.weightKg) || i.weightKg < 30 || i.weightKg > 250)) return { ok: false, field: "weightKg", reason: "Enter your weight in kg, between 30 and 250. The walk's equation needs it." };

  const w = i.test === "run12" ? runWorking(i.metres) : walkWorking({ sex: i.sex, age: i.age, weightKg: i.weightKg, metres: i.metres });
  if (!(w.mets >= 1)) return { ok: false, field: "result", reason: "These figures give less than one MET, which is below rest. Check the distance, age and weight." };
  return {
    ok: true, test: i.test, metres: i.metres, age: i.age, sex: i.sex, weightKg: i.weightKg,
    vo2: w.vo2, mets: w.mets,
    working: `${w.sum} · ÷ ${ML_PER_MET} = ${w.mets.toFixed(1)}`,
    over60: i.test === "walk6" && i.age >= 60,
  };
}

/** Which of the five tiers a figure is in, given a row's four lower bounds: 0 (the lowest) to 4. */
export function tierIndex(bounds: readonly number[], mets: number): number {
  let n = 0;
  for (const b of bounds) if (mets >= b) n++;
  return n;
}
