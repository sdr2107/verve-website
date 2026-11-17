// A fitness test typed on the website or read from a report (board 16 of "Verve, Horizon as a programme"): one set of
// equations, the app's; the row a reading is kept as; what a report's reader may hand over. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as eq from "../src/vendor/app/crfEquations.ts";
import { walkVo2, runVo2, metsFromVo2 } from "../src/data/first-number.ts";
import { entryResult, crfRow, onFileAlready, minutesOf, clockWords, parseTestRead, entryFromRead, APP_TIERS, ENTRY_FIELDS, ENTRY_FROM } from "../src/my-health/horizon/fitnessEntry.ts";
import { doorOfMethod, methodFamily } from "../src/my-health/horizon/derive.ts";
import { ENTRY_METHOD, ENTRY_LABEL, FITNESS_TESTS, DOOR_BY_KEY, SOURCES } from "../src/data/programme.ts";

const EXAMPLES = JSON.parse(readFileSync(new URL("./fixtures/crfEquationExamples.json", import.meta.url), "utf8")).examples;
const ASHA = { age: 45, sex: "female", weightKg: 62, heightCm: 160 };
const TODAY = "2026-11-17";
const NONE = { age: null, sex: null, weightKg: null, heightCm: null };

test("the copied equations give the app's own worked examples, to the digit", () => {
  assert.ok(EXAMPLES.length >= 20);
  for (const e of EXAMPLES) {
    const out = eq[e.fn](...e.args);
    const mets = typeof out === "number" ? out : out.mets;
    assert.equal(mets, e.mets, `${e.fn}(${JSON.stringify(e.args)})`);
    if (e.vo2Max != null) assert.equal(out.vo2Max, e.vo2Max);
    if (e.source) assert.equal(out.source, e.source);
  }
  // the copy says where it came from, and is not edited by hand
  const src = readFileSync(new URL("../src/vendor/app/crfEquations.ts", import.meta.url), "utf8");
  assert.match(src, /copied word for word from METTracker lib\/calculations\.ts at [0-9a-f]{7}/);
  assert.match(readFileSync(new URL("../src/vendor/app/SOURCE", import.meta.url), "utf8"), /^METTracker [0-9a-f]{7}\n/);
});

test("the Find-your-number sheet and the card agree: one walk, one run, one number", () => {
  for (const p of [{ sex: "male", age: 45, weightKg: 80, metres: 600 }, { sex: "female", age: 33, weightKg: 58, metres: 640 }]) {
    const app = eq.estimateCRFFrom6MinuteWalk(p.metres, { age: p.age, sex: p.sex, weightKg: p.weightKg });
    assert.equal(app.source, "hong2019");
    assert.ok(Math.abs(app.mets - metsFromVo2(walkVo2(p))) < 0.006, `${app.mets} against ${metsFromVo2(walkVo2(p))}`);
  }
  for (const metres of [1800, 2400, 3000]) assert.ok(Math.abs(eq.estimateCRFFromCooperRun(metres).mets - metsFromVo2(runVo2(metres))) < 0.006);
});

test("each test turns its own fields into METs, and asks for a field it does not have", () => {
  // a mask test and a watch's estimate need no equation: oxygen divided by 3.5
  const mask = entryResult("mask", { date: "2026-11-12", vo2: 31.5 }, ASHA, TODAY);
  assert.deepEqual([mask.ok, mask.mets, mask.vo2, mask.method], [true, 9, 31.5, "cpet"]);
  const watch = entryResult("watch", { date: "2026-11-16", vo2: 38 }, NONE, TODAY);
  assert.deepEqual([watch.ok, watch.mets, watch.method], [true, 10.86, "non-exercise-formula"]);
  assert.match(watch.how, /estimate, not a test/);
  // a treadmill report's printed METs are kept as printed; a Bruce time goes through the app's equation
  const printed = entryResult("treadmill", { date: "2026-11-12", mets: 10.1, protocol: "Bruce", minutes: 9.2 }, ASHA, TODAY);
  assert.deepEqual([printed.mets, printed.method], [10.1, "treadmill-test"]);
  const timed = entryResult("treadmill", { date: "2026-11-12", protocol: "Bruce", minutes: 9.2 }, ASHA, TODAY);
  assert.deepEqual([timed.mets, timed.method], [eq.estimateCRFFromBruceProtocol(9.2), "bruce-protocol"]);
  assert.equal(entryResult("treadmill", { date: "2026-11-12", protocol: "Modified Bruce", minutes: 9.2 }, ASHA, TODAY).ok, false);
  assert.equal(entryResult("treadmill", { date: "2026-11-12", protocol: "Naughton", minutes: 9.2 }, ASHA, TODAY).ok, false);
  // the walks and the runs are the app's
  assert.equal(entryResult("walk6", { date: "2026-11-09", metres: 560 }, ASHA, TODAY).mets, eq.estimateCRFFrom6MinuteWalk(560, ASHA).mets);
  assert.match(entryResult("walk6", { date: "2026-11-09", metres: 560 }, NONE, TODAY).how, /distance alone/);
  assert.equal(entryResult("walk1", { date: "2026-11-09", minutes: 14.5, heartRate: 132 }, ASHA, TODAY).mets, 10.54);
  assert.equal(entryResult("walk1", { date: "2026-11-09", minutes: 14.5, heartRate: 132 }, NONE, TODAY).ok, false);
  assert.equal(entryResult("cooper", { date: "2026-11-09", metres: 2400 }, NONE, TODAY).mets, 12.11);
  assert.equal(entryResult("run15", { date: "2026-11-09", minutes: 14.5 }, ASHA, TODAY).mets, 10.74);
  // nothing is guessed
  assert.equal(entryResult("mask", { date: "2026-11-12" }, ASHA, TODAY).ok, false);
  assert.equal(entryResult("mask", { date: "2026-11-20", vo2: 31.5 }, ASHA, TODAY).ok, false);   // ahead of today
  assert.equal(entryResult("mask", { date: "", vo2: 31.5 }, ASHA, TODAY).ok, false);
  assert.equal(entryResult("cooper", { date: "2026-11-09", metres: 100 }, NONE, TODAY).ok, false);
  // every test has fields, a label and one of the app's own method names
  for (const k of Object.keys(ENTRY_LABEL)) { assert.ok(ENTRY_FIELDS[k].length > 0); assert.ok(ENTRY_METHOD[k]); }
});

test("a time is typed as minutes and seconds", () => {
  assert.equal(minutesOf("9:12"), 9.2);
  assert.equal(minutesOf("14:30"), 14.5);
  assert.equal(minutesOf("12"), 12);
  assert.equal(minutesOf("9:75"), null);
  assert.equal(minutesOf("nine"), null);
  assert.equal(clockWords(9.2), "9:12");
});

test("the row is the app's own: its table's names, its tiers, and where the reading came from", () => {
  const result = entryResult("treadmill", { date: "2026-11-12", mets: 10.1 }, ASHA, TODAY);
  const made = crfRow({ id: "web-1", userId: "u1", kind: "treadmill", fields: { date: "2026-11-12", mets: 10.1, where: "City hospital" }, result, profile: ASHA, from: "report", now: "2026-11-17T10:00:00Z" });
  assert.ok("row" in made);
  const r = made.row;
  assert.deepEqual([r.id, r.user_id, r.met_capacity, r.estimation_method, r.vo2_max_source, r.wearable_vo2_max_disclaimer], ["web-1", "u1", 10.1, "treadmill-test", "calculated-from-mets", null]);
  assert.ok(APP_TIERS.includes(r.performance_category));
  assert.equal(r.source_test, `${ENTRY_FROM.report} · City hospital`);
  assert.equal(String(r.timestamp).slice(0, 10), "2026-11-12");
  // a watch's estimate is kept as the device's estimate, with the app's own flag
  const w = crfRow({ id: "web-2", userId: "u1", kind: "watch", fields: { date: "2026-11-16", vo2: 38 }, result: entryResult("watch", { date: "2026-11-16", vo2: 38 }, ASHA, TODAY), profile: ASHA, from: "device", now: "2026-11-17T10:00:00Z" });
  assert.deepEqual([w.row.estimation_method, w.row.vo2_max_source, w.row.wearable_vo2_max_disclaimer, w.row.vo2_max_estimate], ["non-exercise-formula", "wearable-imputation", true, 38]);
  // the tier is never invented: with no age or sex on file the reading is not kept
  assert.ok("error" in crfRow({ id: "web-3", userId: "u1", kind: "mask", fields: { date: "2026-11-12", vo2: 31.5 }, result: entryResult("mask", { date: "2026-11-12", vo2: 31.5 }, NONE, TODAY), profile: NONE, from: "typed", now: "2026-11-17T10:00:00Z" }));
  // the same day, test and METs is on file already
  const crf = [{ measured_on: "2026-11-12", method: "treadmill-test", met_capacity: 10.1 }];
  assert.equal(onFileAlready(crf, "2026-11-12", "treadmill-test", 10.1), true);
  assert.equal(onFileAlready(crf, "2026-11-12", "cpet", 10.1), false);
});

test("a report's reader hands over only what the report prints, and the conclusion is kept as the report's own", () => {
  const out = { doc_type: "exercise_test", report_date: "2026-11-12", patient_name: "MRS ASHA RAO",
    exercise_test: { mask: false, protocol: "Bruce", duration_seconds: 552, mets: 10.1, peak_vo2: null, peak_hr: 171, peak_hr_percent: 96, stopped_because: "Fatigue" },
    impression: "Good effort tolerance. No significant ST changes at peak exercise." };
  const r = parseTestRead(out);
  assert.deepEqual([r.mask, r.date, r.protocol, r.seconds, r.mets, r.peakVo2, r.peakHr, r.peakHrPercent, r.stopped], [false, "2026-11-12", "Bruce", 552, 10.1, null, 171, 96, "Fatigue"]);
  assert.equal(r.conclusion, "Good effort tolerance. No significant ST changes at peak exercise.");
  assert.deepEqual(entryFromRead(r), { kind: "treadmill", fields: { date: "2026-11-12", mets: 10.1, protocol: "Bruce", minutes: 9.2 } });
  // a mask test opens the mask card; "mask" with no measured oxygen is not one
  const masked = parseTestRead({ ...out, exercise_test: { ...out.exercise_test, mask: true, peak_vo2: 31.5 } });
  assert.deepEqual(entryFromRead(masked), { kind: "mask", fields: { date: "2026-11-12", vo2: 31.5 } });
  assert.equal(parseTestRead({ ...out, exercise_test: { ...out.exercise_test, mask: true } }).mask, false);
  // a figure outside what a test can print is dropped, never kept
  assert.equal(parseTestRead({ ...out, exercise_test: { ...out.exercise_test, mets: 140 } }).mets, null);
  // any other document is not a test
  assert.equal(parseTestRead({ doc_type: "lab", report_date: "2026-11-12" }), null);
  assert.equal(parseTestRead(null), null);
});

test("the one-mile walk is listed as a walk test and is its own test; the five tests are in the order of sureness", () => {
  // it borrows no other test's error, so it has no door of its own; the set-up lists it beside the six-minute walk
  assert.equal(doorOfMethod("one-mile-walk"), null);
  assert.equal(methodFamily("one-mile-walk"), "one-mile-walk");
  assert.deepEqual(FITNESS_TESTS.find((t) => t.door === "walk").families, ["walk", "one-mile-walk"]);
  assert.equal(methodFamily("six-minute-walk"), "walk");
  assert.equal(methodFamily("cooper-run"), "run");
  assert.equal(methodFamily("1.5-mile-run"), "run");
  assert.deepEqual(FITNESS_TESTS.map((t) => t.door), ["lab", "walk", "run", "treadmill", "watch"]);
  assert.deepEqual(FITNESS_TESTS.map((t) => DOOR_BY_KEY[t.door].rank), [1, 2, 2, 3, 4]);
  // a watch's estimate can be typed; a walk and a run cannot be read from a report
  assert.deepEqual(FITNESS_TESTS.find((t) => t.door === "watch").entries, ["watch"]);
  assert.deepEqual(FITNESS_TESTS.filter((t) => t.report).map((t) => t.door), ["lab", "treadmill"]);
  assert.ok(SOURCES["Kline 1987"]);
});
