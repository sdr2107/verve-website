// The two lipid ratios the Labs tab computes from a report's own rows. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lipidRatioRows, withLipidRatios, tgHdlRatio, apoRatio, TG_HDL_LABEL, APO_RATIO_LABEL } from "../src/my-health/derive/lipids.ts";
import { inRange, rangeLabel } from "../src/my-health/derive/markers.ts";

const row = (analyte, value, unit, measured_on, extra = {}) => ({ analyte, value, unit, section: "lipids", measured_on, ...extra });

test("TG/HDL pairs the two halves printed on one report date, and leaves other dates alone", () => {
  const labs = [
    row("Triglycerides", 138, "mg/dL", "2026-10-12"),
    row("HDL Cholesterol", 44, "mg/dL", "2026-10-12"),
    row("Triglycerides", 165, "mg/dL", "2026-04-02"),   // no HDL that day
  ];
  const out = lipidRatioRows(labs, null);
  assert.equal(out.length, 1);
  assert.equal(out[0].analyte, TG_HDL_LABEL);
  assert.equal(out[0].value, 3.1);
  assert.equal(out[0].measured_on, "2026-10-12");
  assert.equal(out[0].computed, true);
  assert.equal(rangeLabel(out[0]), "< 3.5");
  assert.equal(inRange(out[0]), true);
});

test("TG/HDL at 3.5 reads outside the band; a mmol/L report converts first", () => {
  assert.equal(tgHdlRatio(165, "mg/dL", 43, "mg/dL"), 3.8);
  assert.equal(inRange(lipidRatioRows([row("Triglycerides", 165, "mg/dL", "2026-10-12"), row("HDL Cholesterol", 43, "mg/dL", "2026-10-12")])[0]), false);
  // 1.56 mmol/L TG and 1.14 mmol/L HDL: 138 and 44 mg/dL
  assert.equal(tgHdlRatio(1.56, "mmol/L", 1.14, "mmol/L"), 3.1);
  assert.equal(tgHdlRatio(138, "mg/dL", 0, "mg/dL"), null);
});

test("TG/HDL draws no band for African-American ancestry, but the ratio still appears", () => {
  const labs = [row("Triglycerides", 190, "mg/dL", "2026-10-12"), row("HDL Cholesterol", 45, "mg/dL", "2026-10-12")];
  const out = lipidRatioRows(labs, { ethnicity: "african_american" });
  assert.equal(out[0].value, 4.2);
  assert.equal(out[0].ref_high, null);
  assert.equal(inRange(out[0]), null);
  assert.equal(rangeLabel(out[0]), "no band for this ancestry");
});

test("ApoB/ApoA1 needs one unit on both sides and reads against the sex's line", () => {
  assert.equal(apoRatio(92, "mg/dL", 144, "mg/dL"), 0.64);
  assert.equal(apoRatio(0.92, "g/L", 1.44, "g/L"), 0.64);
  assert.equal(apoRatio(92, "mg/dL", 1.44, "g/L"), null);
  const labs = [row("Apolipoprotein B", 118, "mg/dL", "2026-10-12"), row("Apolipoprotein A1", 126, "mg/dL", "2026-10-12")];
  const men = lipidRatioRows(labs, { sex: "male" })[0];
  assert.equal(men.analyte, APO_RATIO_LABEL);
  assert.equal(men.value, 0.94);
  assert.equal(rangeLabel(men), "< 0.90");
  assert.equal(inRange(men), false);
  const women = lipidRatioRows([row("Apolipoprotein B", 100, "mg/dL", "2026-10-12"), row("Apolipoprotein A1", 120, "mg/dL", "2026-10-12")], { sex: "female" })[0];
  assert.equal(women.value, 0.83);
  assert.equal(rangeLabel(women), "< 0.80");
  assert.equal(inRange(women), false);
  assert.equal(inRange(lipidRatioRows([row("Apolipoprotein B", 100, "mg/dL", "2026-10-12"), row("Apolipoprotein A1", 120, "mg/dL", "2026-10-12")], { sex: "male" })[0]), true);
});

test("withLipidRatios appends and never doubles a computed row", () => {
  const labs = [row("Triglycerides", 138, "mg/dL", "2026-10-12"), row("HDL Cholesterol", 44, "mg/dL", "2026-10-12")];
  const once = withLipidRatios(labs, null);
  assert.equal(once.length, 3);
  assert.equal(withLipidRatios(once, null).length, 3);
  assert.equal(withLipidRatios([row("LDL Cholesterol", 100, "mg/dL", "2026-10-12")], null).length, 1);
});
