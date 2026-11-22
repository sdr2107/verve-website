// Body: the sections only a report fills, and the two cholesterol rows that say why (canvas "Verve, Horizon as a
// programme", board 35; the founder, 22 November 2026: "build what you mocked - all five as drawn").
// Every figure here is made up. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REPORT_SECTIONS, REPORT_SECTION_KEYS, REPORT_SECTION_LEAD, againstPrinted, printedRange, printedTrack, reportHeadline, reportSectionCounts, reportSectionsOf } from "../src/my-health/derive/reportSections.ts";
import { bodyHeadline, bodyListOf, remnantNoFigureWords } from "../src/my-health/derive/body.ts";
import { remnantNoFigure } from "../src/my-health/derive/lipids.ts";
import { derivePerson } from "../src/my-health/derive/person.ts";
import { BODY_DEFS } from "../src/data/body-list.ts";
import { chartKeyFor } from "../src/my-health/derive/markers.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const emptyDoc = (over = {}) => ({ person: { id: "p", account_id: "u" }, labs: [], imaging: [], reports: [], files: [], weeks: [], web_crf: [], web_body: [], app_labs: [], activities: [], app_crf: [], waist: [], profile: { sex: "male", age: 50, height_cm: 168, weekly_met_hours_goal: 16.67 }, signals: [], weights: [], ai: { summary: null, consent: null }, ...over });
const lab = (analyte, value, unit, section, measured_on, lo = null, hi = null, text = null) => ({ analyte, value, unit, section, measured_on, ref_low: lo, ref_high: hi, ref_text: text, report_path: `u/${measured_on}.pdf` });

// Asha's two reports, made up
const LABS = [
  lab("TSH", 3.2, "mIU/L", "thyroid", "2025-09-03", 0.4, 4.0),
  lab("TSH", 5.1, "mIU/L", "thyroid", "2026-03-12", 0.4, 4.0),
  lab("Free T4", 1.2, "ng/dL", "thyroid", "2026-03-12", 0.8, 1.8),
  lab("Thyroglobulin", 8.4, "ng/mL", "thyroid", "2025-09-03"),
  lab("Haemoglobin", 11.2, "g/dL", "haematology", "2026-03-12", 12, 15.5),
  lab("ALT", 31, "U/L", "liver", "2026-03-12", null, 40),
  lab("Urine Glucose", 0, "", "urine", "2026-03-12", null, null, "Negative"),
  lab("Non-HDL Cholesterol", 121, "mg/dL", "lipids", "2026-03-12", null, 130),
  lab("Uric Acid", 5.9, "mg/dL", "metabolic", "2026-03-12", 3.5, 7.2),
  // markers the app's own list draws: never drawn a second time
  lab("HDL Cholesterol", 48, "mg/dL", "metabolic", "2026-03-12", 40, null),
  lab("LDL Cholesterol", 96, "mg/dL", "heart", "2026-03-12", null, 100),
  lab("Total Cholesterol", 172, "mg/dL", "lipids", "2026-03-12", null, 200),
  lab("HbA1c", 5.4, "%", "metabolic", "2026-03-12", null, 5.7),
];

test("every section a report can fill has an address, a name and a word to count in", () => {
  assert.deepEqual([...REPORT_SECTION_KEYS], ["blood", "liver", "kidney", "thyroid", "vitamins", "hormones", "lipids", "inflammation", "urine", "metabolic-more", "heart-more", "muscle-more", "other"]);
  assert.equal(REPORT_SECTIONS.find((s) => s.from === "haematology").title, "Blood count", "his pick: the plain word");
  assert.equal(new Set(REPORT_SECTIONS.map((s) => s.from)).size, REPORT_SECTIONS.length);
  for (const s of REPORT_SECTIONS) assert.match(s.noun, / marker$/);
});

test("a marker the app's list draws is not drawn a second time; everything else a report holds is", () => {
  const secs = reportSectionsOf(LABS);
  const names = secs.flatMap((s) => s.rows.map((r) => r.label));
  for (const taken of ["HDL Cholesterol", "LDL Cholesterol", "Total Cholesterol", "HbA1c"]) {
    assert.ok(BODY_DEFS.some((d) => d.key === chartKeyFor(taken)), `${taken} is a row of the app's list`);
    assert.equal(names.includes(taken), false, `${taken} is not drawn again`);
  }
  assert.equal(names.length, 8, "TSH, Free T4, thyroglobulin, haemoglobin, ALT, urine glucose, non-HDL, uric acid");
});

test("the sections come in the sidebar's order, only those that hold a marker, each with its count", () => {
  const secs = reportSectionsOf(LABS);
  assert.deepEqual(secs.map((s) => [s.key, s.title, s.total, s.outside]), [
    ["blood", "Blood count", 1, 1], ["liver", "Liver", 1, 0], ["thyroid", "Thyroid", 3, 1], ["lipids", "Other lipids", 1, 0], ["urine", "Urine", 1, 0], ["metabolic-more", "Other metabolic", 1, 0],
  ]);
  assert.deepEqual(reportSectionCounts(LABS), { blood: 1, liver: 1, thyroid: 3, lipids: 1, urine: 1, "metabolic-more": 1 });
  assert.deepEqual(reportSectionsOf([]), []);
  assert.deepEqual(reportSectionCounts(undefined), {});
});

test("a row is read only against the range its lab printed", () => {
  const thyroid = reportSectionsOf(LABS).find((s) => s.key === "thyroid");
  const [ft4, tg, tsh] = thyroid.rows;
  assert.deepEqual(thyroid.rows.map((r) => r.label), ["Free T4", "Thyroglobulin", "TSH"], "by name");
  assert.equal(tsh.value, "5.1"); assert.equal(tsh.unit, "mIU/L"); assert.equal(tsh.on, "2026-03-12"); assert.equal(tsh.writer, "lab report");
  assert.equal(tsh.bandLabel, "Above the lab's range"); assert.equal(tsh.tone, "caution"); assert.equal(tsh.outside, true);
  assert.equal(ft4.bandLabel, "In the lab's range"); assert.equal(ft4.tone, "neutral", "inside is not called good: Verve adds no judgement of its own");
  assert.equal(tg.bandLabel, "no range printed"); assert.equal(tg.outside, false); assert.equal(tg.track, null);
  const blood = reportSectionsOf(LABS).find((s) => s.key === "blood").rows[0];
  assert.equal(blood.bandLabel, "Below the lab's range");
  // no band, no target, nothing about testing again
  for (const r of reportSectionsOf(LABS).flatMap((s) => s.rows)) { assert.deepEqual(r.bands, []); assert.doesNotMatch(r.bandLabel, /due|retest|again|target|optimal/i); }
});

test("a marker is one series: every reading of one name, each with the range its own report printed", () => {
  const tsh = reportSectionsOf(LABS).find((s) => s.key === "thyroid").rows.find((r) => r.label === "TSH");
  assert.deepEqual(tsh.history, [
    { d: "2025-09-03", v: 3.2, unit: "mIU/L", writer: "lab report · range 0.4 to 4" },
    { d: "2026-03-12", v: 5.1, unit: "mIU/L", writer: "lab report · range 0.4 to 4" },
  ]);
  // a name filed under two sections over time sits under its newest one, once
  const moved = reportSectionsOf([lab("Ferritin", 40, "ng/mL", "other", "2025-01-10", 30, 400), lab("Ferritin", 55, "ng/mL", "vitamins_iron", "2026-01-10", 30, 400)]);
  assert.deepEqual(moved.map((s) => [s.key, s.total]), [["vitamins", 1]]);
  assert.equal(moved[0].rows[0].history.length, 2);
  // a section name the page does not know lands in Other, and a row with no number is left out
  assert.deepEqual(reportSectionsOf([lab("Odd Marker", 3, "u", "something-new", "2026-01-10"), lab("Words Only", "trace", "", "urine", "2026-01-10")]).map((s) => [s.key, s.total]), [["other", 1]]);
});

test("the printed range in words, and where a value sits against it", () => {
  assert.equal(printedRange({ ref_low: 0.4, ref_high: 4.0 }), "0.4 to 4");
  assert.equal(printedRange({ ref_high: 150 }), "below 150");
  assert.equal(printedRange({ ref_low: 40 }), "above 40");
  assert.equal(printedRange({ ref_text: "Negative" }), "Negative");
  assert.equal(printedRange({}), "");
  assert.equal(againstPrinted(5.1, { ref_low: 0.4, ref_high: 4 }), "above");
  assert.equal(againstPrinted(0.2, { ref_low: 0.4, ref_high: 4 }), "below");
  assert.equal(againstPrinted(4, { ref_low: 0.4, ref_high: 4 }), "inside", "the printed edge is inside");
  assert.equal(againstPrinted(0, { ref_text: "Negative" }), "words", "a range in words is shown, never judged");
  assert.equal(againstPrinted(3, {}), "none");
  const urine = reportSectionsOf(LABS).find((s) => s.key === "urine").rows[0];
  assert.equal(urine.bandLabel, "Lab's range: Negative"); assert.equal(urine.outside, false);
});

test("the track draws the lab's range with the value on it, and stays on the line when the value lies outside", () => {
  const inside = printedTrack(2.2, { ref_low: 0.4, ref_high: 4 });
  assert.equal(inside.segments.length, 1); assert.equal(inside.segments[0].neutral, true);
  assert.ok(inside.position > inside.segments[0].start && inside.position < inside.segments[0].start + inside.segments[0].width);
  const above = printedTrack(9, { ref_low: 0.4, ref_high: 4 });
  assert.ok(above.position > above.segments[0].start + above.segments[0].width && above.position <= 1);
  const upperOnly = printedTrack(31, { ref_high: 40 });
  assert.equal(upperOnly.segments[0].start, 0); assert.ok(upperOnly.position < upperOnly.segments[0].width);
  const lowerOnly = printedTrack(48, { ref_low: 40 });
  assert.ok(lowerOnly.position > lowerOnly.segments[0].start); assert.ok(Math.abs(lowerOnly.segments[0].start + lowerOnly.segments[0].width - 1) < 1e-9);
  assert.equal(printedTrack(3, {}), null);
  assert.equal(printedTrack(3, { ref_low: 5, ref_high: 5 }), null, "a range with no width draws nothing");
});

test("the sentence over a section counts in the section's own words", () => {
  const by = Object.fromEntries(reportSectionsOf(LABS).map((s) => [s.key, s]));
  assert.equal(reportHeadline(by.thyroid), "Three thyroid markers on file. One sits outside its lab's range.");
  assert.equal(reportHeadline(by.liver), "One liver marker on file. It does not sit outside its lab's range.");
  assert.equal(reportHeadline({ ...by.thyroid, total: 30, outside: 4, noun: "blood count marker" }), "30 blood count markers on file. Four sit outside their lab's range.");
  assert.equal(reportHeadline({ ...by.thyroid, total: 5, outside: 0 }), "Five thyroid markers on file. None sits outside its lab's range.");
  assert.match(REPORT_SECTION_LEAD, /Verve adds no range of its own here\.$/);
});

// ── the two cholesterol rows ────────────────────────────────────────────────────────────
const lipids = (d, total, hdl, ldl) => [lab("Total Cholesterol", total, "mg/dL", "lipids", d), lab("HDL Cholesterol", hdl, "mg/dL", "metabolic", d), lab("LDL Cholesterol", ldl, "mg/dL", "heart", d)];
const heartRow = (labs, key) => bodyListOf(derivePerson(emptyDoc({ labs }))).sections[1].rows.find((r) => r.key === key);

test("total cholesterol shows its date like every other row, and says 'not judged alone' where the band goes", () => {
  const total = heartRow(lipids("2026-03-12", 172, 48, 96), "total_cholesterol_mgdl");
  assert.equal(total.value, "172"); assert.equal(total.on, "2026-03-12"); assert.equal(total.writer, "lab report");
  assert.equal(total.subline, null, "no sentence where the date goes");
  assert.equal(total.bandNote, "not judged alone"); assert.equal(total.bandLabel, null); assert.equal(total.watch, false);
  assert.equal(heartRow(lipids("2026-03-12", 172, 48, 96), "ldl_mgdl").bandNote, null, "a marker with a band has no note");
  assert.doesNotMatch(read("../src/data/body-list.ts"), /one half of remnant cholesterol/);
});

test("the newest report that holds all three cholesterols and gives no figure is named by its date", () => {
  assert.equal(remnantNoFigure(lipids("2026-03-12", 150, 48, 110)), "2026-03-12", "150 − 48 − 110 is below zero");
  assert.equal(remnantNoFigure(lipids("2026-03-12", 172, 48, 96)), null, "a figure: nothing to say");
  assert.equal(remnantNoFigure([...lipids("2025-09-03", 150, 48, 110), ...lipids("2026-03-12", 172, 48, 96)]), null, "only the newest whole panel counts");
  assert.equal(remnantNoFigure([...lipids("2025-09-03", 172, 48, 96), ...lipids("2026-03-12", 150, 48, 110)]), "2026-03-12");
  // a newer report with only two of the three is not a panel: the last whole one stands
  assert.equal(remnantNoFigure([...lipids("2025-09-03", 172, 48, 96), lab("Total Cholesterol", 150, "mg/dL", "lipids", "2026-03-12"), lab("LDL Cholesterol", 110, "mg/dL", "heart", "2026-03-12")]), null);
  assert.equal(remnantNoFigure([]), null);
  // a panel is three cholesterols each above zero: a zero is a misread, and is not called "lower than"
  assert.equal(remnantNoFigure(lipids("2026-03-12", 0, 48, 110)), null);
});

test("remnant with no figure from the newest report: a dash and the reason, the older figure in its history, not counted as outside", () => {
  const older = lipids("2025-09-03", 190, 48, 108), newer = lipids("2026-03-12", 150, 48, 110);   // 34 then below zero
  const before = heartRow(older, "remnant");
  assert.equal(before.value, "34"); assert.equal(before.bandLabel, "Elevated"); assert.equal(before.watch, true);
  const row = heartRow([...older, ...newer], "remnant");
  assert.equal(row.value, null, "a dash on the page");
  assert.equal(row.subline, remnantNoFigureWords("2026-03-12"));
  assert.equal(row.subline, "12 Mar: no figure. That report's total is lower than its HDL and LDL together.");
  assert.equal(row.watch, false); assert.equal(row.bandLabel, null); assert.equal(row.track, null);
  assert.equal(row.noFigure, true); assert.equal(before.noFigure, false);
  assert.deepEqual(row.history.map((h) => [h.d, h.v]), [["2025-09-03", 34]], "the older figure is still there to open");
  const list = bodyListOf(derivePerson(emptyDoc({ labs: [...older, ...newer] })));
  assert.equal(list.outside.some((r) => r.key === "remnant"), false);
  // the three it is made of were read, so the row counts as read, as the app counts it
  assert.equal(list.sections[1].recorded, 3, "LDL, total, and the remnant with no figure");
  assert.doesNotMatch(bodyHeadline(list), /Remnant/);
  // a newer report that does give a figure is the row again
  const back = heartRow([...older, ...newer, ...lipids("2026-06-01", 172, 48, 96)], "remnant");
  assert.equal(back.value, "28"); assert.equal(back.on, "2026-06-01"); assert.equal(back.subline, null);
  // with no older figure at all: still the dash and the reason, never "not read yet"
  const first = heartRow(newer, "remnant");
  assert.equal(first.value, null); assert.match(first.subline, /^12 Mar: no figure\./);
});

// ── the page and the sidebar ────────────────────────────────────────────────────────────
test("the page draws the report sections after the app's three, and the duplicate list of files is gone", () => {
  const view = read("../src/my-health/views/Body.tsx");
  assert.match(view, /const present: string\[\] = \[\.\.\.APP_BODY_KEYS, \.\.\.reportSecs\.map\(\(s\) => s\.key\)\];/);
  assert.match(view, /const cur = present\.includes\(wanted\) \? wanted : APP_BODY_KEYS\[0\];/, "a section this person has no marker in falls back to Metabolic");
  assert.match(view, /\{curReport \? reportHeadline\(curReport\) : bodyHeadline\(list\)\}/, "the headline's count stays the app's list");
  assert.match(view, /outside \$\{s\.outside === 1 \? "its" : "their"\} lab's range/);
  assert.match(view, /r\.bandNote \?\? \(r\.bands\.length \? "no band for this value" : ""\)/);
  assert.match(view, /const unread = r\.value == null && !r\.noFigure;/, "read with no figure is not drawn as not read yet");
  assert.match(view, /r\.noFigure \? "col-span-2 sm:col-span-3" : ""/, "the reason is read whole, not cut off");
  assert.doesNotMatch(view, /Lab reports on file|body-reports|labsByPath/);
  assert.match(view, /reportSecs\.flatMap\(\(s\) => s\.rows\)\.filter\(lands\)/, "a search reads the report sections too");
});

test("the sidebar lists a report section only when it holds a marker, and old addresses still land", () => {
  const page = read("../src/pages/my-health.astro");
  for (const key of REPORT_SECTION_KEYS) assert.match(page, new RegExp(`data-tab-for="body" data-section="${key}" data-report-section hidden>`), key);
  assert.doesNotMatch(page, /data-section="reports">Lab reports/);
  assert.match(page, /<span class="mh-grp" data-body-group hidden>The app's list<\/span>/);
  assert.match(page, /<span class="mh-grp" data-body-group hidden>From your reports<\/span>/);
  assert.match(page, /#tabbar \.mh-sub\[hidden\], #tabbar \.mh-grp\[hidden\] \{ display: none; \}/, "the flex rule would otherwise show a hidden one");
  assert.match(page, /const counts: Record<string, number> = d \? reportSectionCounts\(d\.labs\) : \{\};/);
  assert.match(page, /b\.hidden = !n;/);
  assert.match(page, /if \(tab === "body" && wantSec === "reports"\) \{ setSectionState\("all"\); setTab\("reports"\); return; \}/);
  assert.match(page, /tab === "overview" \? SECTION_ALIAS\[wantSec\] \?\? wantSec : wantSec/, "#body-heart is Body's Heart, not the Overview's old name for Vitals");
});
