// The two lipid ratios and remnant cholesterol the Labs tab computes from a report's own rows. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lipidRatioRows, withLipidRatios, tgHdlRatio, apoRatio, TG_HDL_LABEL, APO_RATIO_LABEL,
  REMNANT_LABEL, remnantCholesterol, remnantCut, ldlMethodByArithmetic, readLdlMethod, ldlMethodTag, remnantFromTag, remnantMeaning,
} from "../src/my-health/derive/lipids.ts";
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

// ── remnant cholesterol ──────────────────────────────────────────────────────
// The two panels drawn on the approved canvas (4 Nov 2026).
const measured   = { total: 182, totalUnit: "mg/dL", hdl: 64, hdlUnit: "mg/dL", ldl: 96,  ldlUnit: "mg/dL", tg: 88,  tgUnit: "mg/dL", method: "measured" };
const calculated = { total: 210, totalUnit: "mg/dL", hdl: 58, hdlUnit: "mg/dL", ldl: 118, ldlUnit: "mg/dL", tg: 170, tgUnit: "mg/dL", method: "calculated" };
const panelRows = (d, p, path = "u/report.pdf") => [
  row("Total Cholesterol", p.total, p.totalUnit, d, { report_path: path }),
  row("HDL Cholesterol", p.hdl, p.hdlUnit, d, { report_path: path }),
  row("LDL Cholesterol", p.ldl, p.ldlUnit, d, { report_path: path, method: p.method ?? null }),
  row("Triglycerides", p.tg, p.tgUnit, d, { report_path: path }),
];

test("remnant cholesterol is total minus HDL minus LDL, in the report's own unit, and needs all three", () => {
  assert.deepEqual(remnantCholesterol(measured), { value: 22, unit: "mg/dL" });
  assert.deepEqual(remnantCholesterol(calculated), { value: 34, unit: "mg/dL" });
  assert.equal(remnantCholesterol({ ...calculated, total: null }), null);
  assert.equal(remnantCholesterol({ ...calculated, hdl: undefined }), null);
  // nothing is estimated from triglycerides alone
  assert.equal(remnantCholesterol({ tg: 170, tgUnit: "mg/dL", ldl: 118, ldlUnit: "mg/dL", method: "calculated" }), null);
  // a mmol/L report computes in mmol/L, to two decimals
  assert.deepEqual(remnantCholesterol({ total: 5.43, totalUnit: "mmol/L", hdl: 1.5, hdlUnit: "mmol/L", ldl: 3.05, ldlUnit: "mmol/L" }), { value: 0.88, unit: "mmol/L" });
  // three numbers that are not one draw
  assert.equal(remnantCholesterol({ total: 150, totalUnit: "mg/dL", hdl: 60, hdlUnit: "mg/dL", ldl: 110, ldlUnit: "mg/dL" }), null);
});

test("the line is 30 mg/dL, which is 0.78 mmol/L and not 1", () => {
  assert.equal(remnantCut("mg/dL"), 30);
  assert.equal(remnantCut("mmol/L"), 0.78);
});

test("the remnant row reads against the line: 29 inside, 30 outside, and says how it was made", () => {
  const out = lipidRatioRows(panelRows("2026-11-03", calculated), null);
  const r = out.find((x) => x.analyte === REMNANT_LABEL);
  assert.equal(r.value, 34);
  assert.equal(r.unit, "mg/dL");
  assert.equal(r.computed, true);
  assert.equal(r.section, "lipids");
  assert.equal(rangeLabel(r), "< 30");
  assert.equal(inRange(r), false);
  assert.deepEqual(r.tags, ["computed", "from a calculated LDL"]);
  assert.match(r.explain.formula, /^210 total − 58 HDL − 118 LDL, all from the .* report$/);
  assert.match(r.explain.body, /170 ÷ 5 under Friedewald/);
  assert.equal(r.explain.link.href, "/science/body/heart-health#remnant-cholesterol");
  // the remnant is listed before the ratios
  assert.equal(out[0].analyte, REMNANT_LABEL);
  assert.equal(inRange({ ...r, value: 29 }), true);
  assert.equal(inRange({ ...r, value: 30 }), false);
  // in mmol/L the same line at 0.78
  const mm = lipidRatioRows([
    row("Total Cholesterol", 5.43, "mmol/L", "2026-11-03"), row("HDL Cholesterol", 1.5, "mmol/L", "2026-11-03"), row("LDL Cholesterol", 3.05, "mmol/L", "2026-11-03"),
  ], null).find((x) => x.analyte === REMNANT_LABEL);
  assert.equal(mm.value, 0.88);
  assert.equal(rangeLabel(mm), "< 0.78");
  assert.equal(inRange(mm), false);
  assert.equal(inRange({ ...mm, value: 0.77 }), true);
  assert.equal(inRange({ ...mm, value: 0.78 }), false);
});

test("a remnant forms only from one report date, and says when the three came from different files", () => {
  const split = [
    row("Total Cholesterol", 182, "mg/dL", "2026-10-12"), row("HDL Cholesterol", 64, "mg/dL", "2026-10-12"),
    row("LDL Cholesterol", 96, "mg/dL", "2026-11-03"),
  ];
  assert.equal(lipidRatioRows(split, null).some((x) => x.analyte === REMNANT_LABEL), false);
  const twoFiles = [
    row("Total Cholesterol", 182, "mg/dL", "2026-10-12", { report_path: "u/a.pdf" }), row("HDL Cholesterol", 64, "mg/dL", "2026-10-12", { report_path: "u/a.pdf" }),
    row("LDL Cholesterol", 96, "mg/dL", "2026-10-12", { report_path: "u/b.pdf", method: "measured" }),
  ];
  const r = lipidRatioRows(twoFiles, null).find((x) => x.analyte === REMNANT_LABEL);
  assert.match(r.explain.formula, /all dated /);
  assert.deepEqual(r.tags, ["computed", "from a direct LDL"]);
  assert.match(r.explain.body, /^The LDL on this report was measured directly, so the remnant is a measurement/);
});

test("the LDL's method is what came with the row; with none, the arithmetic; with neither, not known", () => {
  assert.deepEqual(readLdlMethod(measured), { method: "measured", basis: "stated" });
  assert.deepEqual(readLdlMethod(calculated), { method: "calculated", basis: "stated" });
  // a stated method wins over the arithmetic
  assert.deepEqual(readLdlMethod({ ...calculated, method: "measured" }), { method: "measured", basis: "stated" });
  // 210 - 58 - 118 = 34 = 170 / 5
  assert.equal(ldlMethodByArithmetic({ ...calculated, method: null }), true);
  assert.deepEqual(readLdlMethod({ ...calculated, method: null }), { method: "calculated", basis: "arithmetic" });
  // 22 against 88 / 5 = 17.6: no match is not a measurement
  assert.deepEqual(readLdlMethod({ ...measured, method: null }), { method: null, basis: null });
  // one unit off is off
  assert.equal(ldlMethodByArithmetic({ ...calculated, ldl: 116, method: null }), false);
  // never without triglycerides, never at 400 mg/dL and above
  assert.equal(ldlMethodByArithmetic({ ...calculated, tg: null, method: null }), false);
  assert.equal(ldlMethodByArithmetic({ total: 300, totalUnit: "mg/dL", hdl: 40, hdlUnit: "mg/dL", ldl: 180, ldlUnit: "mg/dL", tg: 400, tgUnit: "mg/dL" }), false);
});

test("a mmol/L report is judged against triglycerides / 2.2", () => {
  // TG 1.92 / 2.2 = 0.873; LDL = 5.43 - 1.50 - 0.873 = 3.057, printed 3.06; remainder 0.87
  const mm = { total: 5.43, totalUnit: "mmol/L", hdl: 1.5, hdlUnit: "mmol/L", ldl: 3.06, ldlUnit: "mmol/L", tg: 1.92, tgUnit: "mmol/L" };
  assert.equal(ldlMethodByArithmetic(mm), true);
  assert.match(remnantMeaning(mm), /triglycerides ÷ 2\.2 \(1\.92 ÷ 2\.2\)/);
  assert.match(remnantMeaning(mm), /The line at 0\.78 mmol\/L \(30 mg\/dL\)/);
  assert.equal(ldlMethodByArithmetic({ ...mm, ldl: 3.2 }), false);
});

test("the tags name each state, and never say 'not printed' of a row filed before methods were read", () => {
  assert.equal(ldlMethodTag(measured), "measured directly");
  assert.equal(ldlMethodTag(calculated), "calculated");
  assert.equal(ldlMethodTag({ ...calculated, method: null }), "calculated, by the arithmetic");
  assert.equal(ldlMethodTag({ ...measured, method: null }), "method not known");
  assert.equal(remnantFromTag(measured), "from a direct LDL");
  assert.equal(remnantFromTag({ ...calculated, method: null }), "from a calculated LDL");
  assert.equal(remnantFromTag({ ...measured, method: null }), "LDL method not known");
});

test("a calculated LDL names the division only when the numbers bear it out", () => {
  assert.match(remnantMeaning(calculated), /170 ÷ 5 under Friedewald/);
  // "Calculated" by Martin-Hopkins: remainder 29 against 34, so no division is printed
  const martin = { ...calculated, ldl: 123 };
  assert.doesNotMatch(remnantMeaning(martin), /÷/);
  assert.match(remnantMeaning(martin), /the lab's equation set aside for VLDL/);
  assert.match(remnantMeaning({ ...measured, method: null }), /^No method came with this LDL, so this is the arithmetic and no more/);
});

test("withLipidRatios tags every LDL row with its method and the ratios as computed, without touching the rows it was given", () => {
  const labs = [...panelRows("2026-10-12", measured), ...panelRows("2026-11-03", { ...calculated, method: null })];
  const before = JSON.stringify(labs);
  const out = withLipidRatios(labs, null);
  assert.equal(JSON.stringify(labs), before);
  const ldls = out.filter((r) => r.analyte === "LDL Cholesterol");
  assert.deepEqual(ldls.map((r) => r.tags), [["measured directly"], ["calculated, by the arithmetic"]]);
  assert.deepEqual(out.find((r) => r.analyte === TG_HDL_LABEL).tags, ["computed"]);
  assert.equal(out.filter((r) => r.analyte === REMNANT_LABEL).length, 2);
  // idempotent
  assert.equal(withLipidRatios(out, null).length, out.length);
  // an LDL with nothing printed beside it is tagged from its own method
  assert.deepEqual(withLipidRatios([row("LDL Cholesterol", 96, "mg/dL", "2026-01-05", { method: "measured" })], null)[0].tags, ["measured directly"]);
});
