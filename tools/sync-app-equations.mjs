#!/usr/bin/env node
/**
 * Copies the app's fitness-test equations into this repository, word for word.
 *
 *   node tools/sync-app-equations.mjs <path to a METTracker checkout>
 *
 * The app holds one equation for each field test (METTracker lib/calculations.ts). The website's card for typing a
 * test result (src/my-health/views/FitnessEntry.tsx) must give the same METs for the same walk, so it does not carry
 * equations of its own: this script lifts the five functions out of the app's file, with their notes, into
 * src/vendor/app/crfEquations.ts, and copies the app's table of worked examples beside the website's tests. The test
 * tests/crf-equations.test.mjs runs the copied functions against that table, and the app runs its own functions
 * against the same table (METTracker __tests__/crfEquationExamples.test.ts). If the app's equations change, its test
 * fails until the table is changed, and this script is run again.
 *
 * Nothing in src/vendor/app is edited by hand.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = process.argv[2] ? resolve(process.argv[2]) : null;
if (!app) { console.error("usage: node tools/sync-app-equations.mjs <path to a METTracker checkout>"); process.exit(2); }

const NAMES = ["estimateCRFFromBruceProtocol", "estimateCRFFrom6MinuteWalk", "estimateCRFFrom1MileWalk", "estimateCRFFromCooperRun", "estimateCRFFrom1_5MileRun"];
const lines = readFileSync(join(app, "lib/calculations.ts"), "utf8").split("\n");

/** One function, from the note above it to the brace that closes it (the only `}` in column 0 after its first line). */
function lift(name) {
  const at = lines.findIndex((l) => l.startsWith(`export function ${name}(`));
  if (at < 0) throw new Error(`${name} is not in lib/calculations.ts`);
  let from = at;
  if (lines[at - 1]?.trim() === "*/") { from = at - 1; while (from > 0 && !lines[from].trimStart().startsWith("/**")) from--; }
  let to = at + 1;
  while (to < lines.length && lines[to] !== "}") to++;
  if (to >= lines.length) throw new Error(`${name} has no closing brace in column 0`);
  return lines.slice(from, to + 1).join("\n");
}

const commit = execFileSync("git", ["-C", app, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const head = `/**
 * The app's fitness-test equations, copied word for word from METTracker lib/calculations.ts at ${commit} by
 * tools/sync-app-equations.mjs. DO NOT EDIT: change the app's file and run the script again.
 *
 * One equation for each test, wherever it is typed: the app's log, and the website's card for a test result. The table
 * of worked examples in tests/fixtures/crfEquationExamples.json is the app's own, and both repositories test against it.
 */
`;
writeFileSync(join(here, "../src/vendor/app/crfEquations.ts"), `${head}\n${NAMES.map(lift).join("\n\n")}\n`);
copyFileSync(join(app, "__tests__/fixtures/crfEquationExamples.json"), join(here, "../tests/fixtures/crfEquationExamples.json"));
writeFileSync(join(here, "../src/vendor/app/SOURCE"), `METTracker ${commit}\nlib/calculations.ts: ${NAMES.join(", ")}\n__tests__/fixtures/crfEquationExamples.json\n`);
console.log(`copied ${NAMES.length} equations and the examples from METTracker ${commit}`);
