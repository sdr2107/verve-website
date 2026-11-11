// The first fitness number: the sheet's arithmetic and the tier it lands in. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { firstNumber, runVo2, walkVo2, metsFromVo2, runWorking, walkWorking, tierIndex, RUN_LINES, WALK_LINES } from "../src/data/first-number.ts";
import { RUN, WALK, tierFor, tierRowFor, tierSourceShort, TIERS_MEN, TIERS_WOMEN } from "../src/data/fitness-tiers.ts";

test("the sheet's two worked examples come out of the functions the tool uses", () => {
  // the run: 2,400 m
  assert.equal(runWorking(2400).vo2, 42.4);
  assert.equal(runWorking(2400).mets, 12.1);
  assert.equal(RUN.example, "2,400 m: (2400 − 504.9) ÷ 44.73 = 42.4, and 42.4 ÷ 3.5 = 12.1 METs.");
  assert.equal(RUN.exampleMets, "12.1 METs");
  // the walk: a man of 45, 80 kg, 600 m. 61.1 − 11.1 − 18 − 16 + 12 is 28.0 (the sheet once printed 28.1)
  const w = walkWorking({ sex: "male", age: 45, weightKg: 80, metres: 600 });
  assert.equal(w.sum, "61.1 − 11.1 − 18 − 16 + 12 = 28.0");
  assert.equal(w.vo2, 28); assert.equal(w.mets, 8);
  assert.equal(WALK.example, "A man of 45, 80 kg, 600 m: 61.1 − 11.1 − 18 − 16 + 12 = 28.0, and 28.0 ÷ 3.5 = 8.0 METs.");
  assert.equal(WALK.exampleMets, "8.0 METs");
  // the printed lines are the constants, not a second copy
  assert.deepEqual(RUN_LINES, ["VO2max = (metres − 504.9) ÷ 44.73", "METs = VO2max ÷ 3.5"]);
  assert.equal(WALK_LINES[0], "VO2max = 61.1 − 11.1 × sex − 0.4 × age − 0.2 × weight kg + 0.02 × metres");
  assert.equal(RUN.lines, RUN_LINES); assert.equal(WALK.lines, WALK_LINES);
});

test("the equations are the app's", () => {
  assert.ok(Math.abs(runVo2(2400) - 42.3675) < 0.001);
  assert.ok(Math.abs(walkVo2({ sex: "female", age: 30, weightKg: 60, metres: 650 }) - (61.1 - 22.2 - 12 - 12 + 13)) < 1e-9);
  assert.equal(metsFromVo2(35), 10);
});

test("a result names its figures; an input the equations were not written for gets a reason, never a number", () => {
  const ok = firstNumber({ test: "walk6", metres: 600, age: 45, sex: "male", weightKg: 80 });
  assert.equal(ok.ok, true);
  assert.equal(ok.mets, 8); assert.equal(ok.vo2, 28); assert.equal(ok.over60, false);
  assert.equal(ok.working, "61.1 − 11.1 − 18 − 16 + 12 = 28.0 · ÷ 3.5 = 8.0");
  const run = firstNumber({ test: "run12", metres: 2400, age: 33, sex: "female", weightKg: NaN });
  assert.equal(run.ok, true, "the run does not need a weight"); assert.equal(run.mets, 12.1);
  assert.equal(firstNumber({ test: "walk6", metres: 520, age: 67, sex: "female", weightKg: 62 }).over60, true);

  const bad = (i) => { const r = firstNumber(i); assert.equal(r.ok, false); assert.equal("mets" in r, false); return r; };
  assert.equal(bad({ test: "walk6", metres: NaN, age: 45, sex: "male", weightKg: 80 }).field, "metres");
  assert.equal(bad({ test: "walk6", metres: 0, age: 45, sex: "male", weightKg: 80 }).field, "metres");
  assert.match(bad({ test: "walk6", metres: 1600, age: 45, sex: "male", weightKg: 80 }).reason, /is a run/);
  assert.match(bad({ test: "run12", metres: 300, age: 45, sex: "male", weightKg: 80 }).reason, /Under 400 m/);
  assert.equal(bad({ test: "run12", metres: 5200, age: 45, sex: "male", weightKg: 80 }).field, "metres");
  assert.match(bad({ test: "walk6", metres: 600, age: 16, sex: "male", weightKg: 60 }).reason, /18 and over/);
  assert.equal(bad({ test: "walk6", metres: 600, age: NaN, sex: "male", weightKg: 60 }).field, "age");
  assert.equal(bad({ test: "walk6", metres: 600, age: 45, sex: "male", weightKg: NaN }).field, "weightKg");
  // a short walk by a heavy older woman: the line falls under one MET, which is below rest
  assert.equal(bad({ test: "walk6", metres: 60, age: 90, sex: "female", weightKg: 120 }).field, "result");
});

test("the tier is read from the app's tables, at the figure as printed", () => {
  assert.equal(tierIndex([8, 10, 12, 14], 7.9), 0);
  assert.equal(tierIndex([8, 10, 12, 14], 8), 1);
  assert.equal(tierIndex([8, 10, 12, 14], 14), 4);
  assert.equal(tierRowFor("male", 45), TIERS_MEN[2]);
  assert.equal(tierRowFor("female", 29), TIERS_WOMEN[0]);
  assert.equal(tierRowFor("female", 70), TIERS_WOMEN[5]);
  assert.equal(tierRowFor("male", 93), TIERS_MEN[5]);
  assert.equal(tierRowFor("male", 19), null, "the tables start at 20");
  const t = tierFor("male", 45, 8.0);
  assert.equal(t.label, "Below average");
  assert.deepEqual(t.next, { label: "Above average", from: 10, away: 2 });
  assert.equal(tierFor("male", 45, 14.2).next, null, "the top tier has no next");
  assert.equal(tierFor("female", 52, 4.96).label, "Below average", "4.96 is printed as 5.0 and read as 5.0");
  assert.equal(tierSourceShort(45), "Mandsager et al., JAMA Netw Open 2018");
  assert.match(tierSourceShort(31), /ACSM/);
});
