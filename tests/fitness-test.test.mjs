// "Add a fitness test": a treadmill report, checked line by line and saved with the lines it prints (27 November 2026).
// Every figure here is made up; Asha is nobody. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DATE_UNSURE, NOT_A_TEST, NOT_READ, checkedOf, clockOf, dayMonth, dayMonthYear, detailLine, detailRowsOf, detailsFor, draftFrom, parseDetails, rowsOf, secondsOfTyped, testLine, timeWords,
} from "../src/my-health/fitnessTest.ts";
import { columnMissing, keepFitnessTest, loadTestDetails } from "../src/my-health/fitnessTestApi.ts";
import { crfRow, parseTestRead } from "../src/my-health/horizon/fitnessEntry.ts";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const TODAY = "2026-11-27";
const ASHA = { age: 45, sex: "female", weightKg: 62, heightCm: 160 };
const OUT = {
  doc_type: "exercise_test", report_date: "2026-11-14", patient_name: "MRS ASHA RAO",
  exercise_test: { mask: false, protocol: "Bruce", duration_text: "9:20", duration_seconds: 560, mets: 10.2, mets_label: "METs achieved", peak_vo2: null, peak_hr: 168, peak_hr_percent: 95, stopped_because: "Target heart rate achieved" },
  impression: "Negative for inducible ischaemia. Good effort tolerance.",
};
const READ = parseTestRead(OUT);

test("a time is typed as minutes and seconds and kept as seconds, exactly", () => {
  for (const [t, s] of [["9:20", 560], ["09:20", 560], ["9 min 20 s", 560], ["9 minutes 20 seconds", 560], ["12 min", 720], ["10:05", 605]]) assert.equal(secondsOfTyped(t), s, t);
  for (const bad of ["9.2", "9:75", "", "nine", "560"]) assert.equal(secondsOfTyped(bad), null, bad);
  assert.equal(clockOf(560), "9:20");
  assert.equal(clockOf(605), "10:05");
  assert.equal(timeWords(560), "9 min 20 s");
  assert.equal(timeWords(720), "12 min");
  assert.equal(secondsOfTyped(clockOf(1234)), 1234);
});

test("the card's lines are the sketch's, in its order, each as the report prints it", () => {
  const rows = rowsOf(draftFrom(READ), false);
  assert.deepEqual(rows.map((r) => r.key), ["date", "mets", "protocol", "time", "peak", "stopped"]);
  assert.deepEqual(rows.map((r) => r.label), ["Date", "METs reached", "Protocol", "Time", "Peak heart rate", "Stopped"]);
  assert.deepEqual(rows.map((r) => r.shown), ["14 November 2026", "10.2", "Bruce", "9 min 20 s", "168 · 95% of predicted", "Target heart rate achieved"]);
  assert.equal(dayMonth("2026-11-14"), "14 November");
  assert.equal(dayMonthYear("2026-02-09"), "9 February 2026");
});

test("a line the reader did not find is empty for the person, and a percentage is said only when the report prints one", () => {
  const bare = parseTestRead({ doc_type: "exercise_test", report_date: null, exercise_test: { mask: false, mets: 9.1 }, impression: null });
  const rows = rowsOf(draftFrom(bare), false);
  assert.deepEqual(rows.map((r) => r.shown), ["", "9.1", "", "", "", ""]);
  assert.equal(NOT_READ, "Not read");
  const noPercent = rowsOf(draftFrom(parseTestRead({ ...OUT, exercise_test: { ...OUT.exercise_test, peak_hr_percent: null } })), false);
  assert.equal(noPercent.find((r) => r.key === "peak").shown, "168");
  assert.equal(/predicted/.test(noPercent.map((r) => r.shown).join(" ")), false);
});

test("the reader's doubt about the day reaches the card: the date is empty and one line says why", () => {
  const unsure = parseTestRead({ ...OUT, report_date: null, date_unsure: true });
  assert.equal(unsure.date, null);
  assert.equal(unsure.dateUnsure, true);
  assert.equal(rowsOf(draftFrom(unsure), false)[0].shown, "");
  assert.equal(DATE_UNSURE, "The report prints its date in more than one way. Type the day of the test.");
  // a settled date carries no flag, and a flag beside a date is not believed
  assert.equal("dateUnsure" in READ, false);
  assert.equal("dateUnsure" in parseTestRead({ ...OUT, date_unsure: true }), false);
});

test("checked and saved: the METs are the report's own, and the other lines are kept beside them", () => {
  const c = checkedOf(draftFrom(READ), false, ASHA, TODAY);
  assert.equal(c.ok, true);
  assert.equal(c.kind, "treadmill");
  assert.equal(c.result.mets, 10.2);
  assert.equal(c.result.method, "treadmill-test");
  assert.deepEqual(c.fields, { date: "2026-11-14", mets: 10.2 }, "no protocol and no time is handed to the arithmetic: nothing is worked out from them");
  assert.deepEqual(c.details, { v: 1, protocol: "Bruce", seconds: 560, peak_hr: 168, peak_hr_percent: 95, stopped: "Target heart rate achieved" });
  // the row is the one the typed card writes: midday on the day, the app's method name, read from a report
  const made = crfRow({ id: "web-1", userId: "u-1", kind: c.kind, fields: c.fields, result: c.result, profile: ASHA, from: "report", now: "2026-11-27T08:00:00.000Z" });
  assert.equal(made.row.estimation_method, "treadmill-test");
  assert.equal(made.row.met_capacity, 10.2);
  assert.equal(made.row.source_test, "Read from a report on verve-app.health");
  assert.equal("test_details" in made.row, false, "the lines travel beside the row, so the row still saves before the column exists");
});

test("what is missing is asked for, by its line; what is typed must read as what it is; nothing is worked out", () => {
  const d = draftFrom(READ);
  assert.deepEqual(checkedOf({ ...d, date: "" }, false, ASHA, TODAY), { ok: false, why: "Give the day of the test.", row: "date" });
  assert.deepEqual(checkedOf({ ...d, date: "2026-11-28" }, false, ASHA, TODAY), { ok: false, why: "The day of the test cannot be ahead of today.", row: "date" });
  // no METs printed: the person types them. A Bruce time on the same card is never turned into METs here.
  assert.deepEqual(checkedOf({ ...d, mets: "" }, false, ASHA, TODAY), { ok: false, why: "Type the METs the report prints.", row: "mets" });
  assert.equal(checkedOf({ ...d, time: "9.2" }, false, ASHA, TODAY).row, "time");
  assert.equal(checkedOf({ ...d, peakHr: "fast" }, false, ASHA, TODAY).row, "peak");
  assert.equal(checkedOf({ ...d, peakPct: "950" }, false, ASHA, TODAY).row, "peak");
  assert.equal(checkedOf({ ...d, mets: "44" }, false, ASHA, TODAY).row, "mets");
  // the lines that may be empty
  const bare = checkedOf({ ...d, protocol: " ", time: "", peakHr: "", peakPct: "95", stopped: "" }, false, ASHA, TODAY);
  assert.deepEqual(bare.details, { v: 1, protocol: null, seconds: null, peak_hr: null, peak_hr_percent: null, stopped: null }, "a percentage with no heart rate beside it is not kept");
  // a corrected line is the person's
  assert.equal(checkedOf({ ...d, time: "10:05", protocol: "Modified Bruce" }, false, ASHA, TODAY).details.seconds, 605);
});

test("a test with a mask is kept as measured oxygen, by the page's one division", () => {
  const mask = parseTestRead({ ...OUT, exercise_test: { ...OUT.exercise_test, mask: true, peak_vo2: 35.7, mets: null } });
  const rows = rowsOf(draftFrom(mask), true);
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.key, r.label, r.shown]), [["date", "Date", "14 November 2026"], ["vo2", "Peak oxygen", "35.7 ml/kg/min"]]);
  const c = checkedOf(draftFrom(mask), true, ASHA, TODAY);
  assert.equal(c.ok && c.kind, "mask");
  assert.equal(c.result.method, "cpet");
  assert.equal(c.result.mets, 10.2);
  assert.equal(checkedOf({ ...draftFrom(mask), vo2: "" }, true, ASHA, TODAY).row, "vo2");
});

test("the Fitness card says the test back: its name and day, and one line of what the report prints", () => {
  assert.equal(testLine("treadmill-test", "2026-11-14"), "Treadmill test · 14 November");
  assert.equal(testLine("cpet", "2026-02-09"), "CPET · 9 February");
  assert.equal(detailLine({ v: 1, protocol: "Bruce", seconds: 560, peak_hr: 168, peak_hr_percent: 95, stopped: "Target heart rate achieved" }), "Bruce · 9 min 20 s · peak 168");
  assert.equal(detailLine({ v: 1, protocol: null, seconds: 720, peak_hr: null, peak_hr_percent: null, stopped: null }), "12 min");
  assert.equal(detailLine({ v: 1, protocol: null, seconds: null, peak_hr: null, peak_hr_percent: null, stopped: "Fatigue" }), null, "why it stopped is kept, and is not on the card's one line");
  assert.equal(detailLine(null), null);
});

test("kept lines are read back safely, and belong to one reading: the same day, test and METs", () => {
  assert.equal(parseDetails(null), null);
  assert.equal(parseDetails({ v: 1 }), null);
  assert.equal(parseDetails([1, 2]), null);
  assert.deepEqual(parseDetails({ protocol: "  Bruce   protocol ", seconds: "560", peak_hr: 999, peak_hr_percent: 95.4, stopped: 7, extra: "x" }), { v: 1, protocol: "Bruce protocol", seconds: 560, peak_hr: null, peak_hr_percent: 95, stopped: null });
  const rows = detailRowsOf([
    { timestamp: "2026-11-14T12:00:00", estimation_method: "treadmill-test", met_capacity: 10.2, test_details: { v: 1, protocol: "Bruce", seconds: 560, peak_hr: 168 } },
    { timestamp: "2026-10-01T12:00:00", estimation_method: "treadmill-test", met_capacity: 9.4, test_details: null },
    { timestamp: null, estimation_method: "cpet", met_capacity: 10, test_details: { protocol: "Ramp" } },
    "not a row",
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].day, "2026-11-14");
  assert.equal(detailLine(detailsFor(rows, { measured_on: "2026-11-14", method: "treadmill-test", met_capacity: 10.2 })), "Bruce · 9 min 20 s · peak 168");
  assert.equal(detailsFor(rows, { measured_on: "2026-11-14", method: "treadmill-test", met_capacity: 10.24 })?.protocol, "Bruce", "to one decimal");
  assert.equal(detailsFor(rows, { measured_on: "2026-11-14", method: "cooper-run", met_capacity: 10.2 }), null);
  assert.equal(detailsFor(rows, { measured_on: "2026-11-15", method: "treadmill-test", met_capacity: 10.2 }), null);
  assert.equal(detailsFor(rows, { measured_on: "2026-11-14", method: "treadmill-test", met_capacity: 9.9 }), null);
  assert.equal(detailsFor(rows, null), null);
  assert.deepEqual(detailRowsOf(null), []);
});

test("before the column exists the test is still kept, without its lines, and reading them back finds none", async () => {
  const DETAILS = { v: 1, protocol: "Bruce", seconds: 560, peak_hr: 168, peak_hr_percent: 95, stopped: null };
  const client = (answers) => { const sent = []; return { sent, from: () => ({ insert: (row) => { sent.push(row); return Promise.resolve({ error: answers[sent.length - 1] ?? null }); } }) }; };
  // the column is there
  let sb = client([null]);
  assert.deepEqual(await keepFitnessTest(sb, { id: "web-1" }, DETAILS), { error: null, details: true });
  assert.deepEqual(sb.sent, [{ id: "web-1", test_details: DETAILS }]);
  // the column is not there yet: the row is sent again without it, and no error reaches the person
  sb = client([{ code: "PGRST204", message: "Could not find the 'test_details' column of 'crf_entries' in the schema cache" }, null]);
  assert.deepEqual(await keepFitnessTest(sb, { id: "web-1" }, DETAILS), { error: null, details: false });
  assert.deepEqual(sb.sent, [{ id: "web-1", test_details: DETAILS }, { id: "web-1" }]);
  // any other refusal is said, and nothing is sent twice
  sb = client([{ code: "42501", message: "new row violates row-level security policy" }]);
  assert.deepEqual(await keepFitnessTest(sb, { id: "web-1" }, DETAILS), { error: "new row violates row-level security policy", details: false });
  assert.equal(sb.sent.length, 1);
  assert.equal(columnMissing({ code: "42703", message: "column crf_entries.test_details does not exist" }), true);
  assert.equal(columnMissing({ code: "42501", message: "permission denied" }), false);
  assert.equal(columnMissing(null), false);
  // reading back: an error (the column is not there) is no lines, never a thrown error
  const chain = (result) => { const q = { select: () => q, eq: () => q, is: () => q, not: () => q, order: () => q, limit: () => Promise.resolve(result) }; return { from: () => q }; };
  assert.deepEqual(await loadTestDetails(chain({ data: null, error: { code: "42703", message: "column crf_entries.test_details does not exist" } }), "u-1"), []);
  assert.deepEqual(await loadTestDetails(chain({ data: [{ timestamp: "2026-11-14T12:00:00" }], error: null }), "u-1"), [{ timestamp: "2026-11-14T12:00:00" }]);
  assert.deepEqual(await loadTestDetails({ from: () => { throw new Error("offline"); } }, "u-1"), []);
});

test("the way in is on the person's own Fitness card, for every account, and the card sits over any tab", () => {
  const overview = read("../src/my-health/views/Overview.tsx"), page = read("../src/pages/my-health.astro"), view = read("../src/my-health/views/FitnessTestAdd.tsx");
  // the link: on the face and on the Fitness page, only for the page's owner; a press on it does not open the card under it
  assert.match(overview, /\{c\.key === "fitness" && canAdd \? <AddFitnessTest cls="t-caption/);
  assert.match(overview, /\{c\.key === "fitness" && canAdd \? <AddFitnessTest cls="t-small/);
  assert.match(overview, /fitTest=\{fitTest\} canAdd=\{self\}/);
  assert.match(overview, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); openTestAdd\(\); \}\}/);
  assert.ok(overview.includes(">Add a fitness test</button>"));
  // the report's lines are said only where they were kept, and only on the person's own page
  assert.match(overview, /if \(!self\) return null;\n  const l = fitnessSummary\(d\.crf, todayStr\(\)\)\.latest;/);
  // a report dropped into Reports opens the card for any owner: no programme gate stands before it
  const after = page.slice(page.indexOf("async function afterOtherRead"), page.indexOf("function readOneFile"));
  assert.match(after, /if \(!who\.self\) return "Read as a treadmill or exercise test\. It is kept as a file\.";\n\s+return openTestCheck\(out, path, pretty\(name\)\)/);
  assert.equal(/tester/.test(after), false);
  // both cards are panels over the page, outside every tab
  const roots = page.indexOf('<div id="fittestroot"></div>');
  assert.ok(roots > page.indexOf("</main>") && page.indexOf('<div id="fitcardroot"></div>') > page.indexOf("</main>"));
  assert.match(page, /mountFitnessTest\(\$\("fittestroot"\)/);
  // the three steps' words, and nothing that judges a result
  for (const words of ["Upload a treadmill report", "A PDF or a photo", "Or type the result", "Check what was read", "Conclusion, as printed:", ">{busy ? \"Saving…\" : \"Save\"}<", "\"Fix a line\""]) assert.ok(view.includes(words), words);
  assert.equal(/\b(normal|abnormal|good result|poor|excellent)\b/i.test(view.replace(/\/\*[\s\S]*?\*\//g, "")), false);
  assert.equal(NOT_A_TEST, "That file was not read as a treadmill test. It is kept in Reports, and nothing was added to your fitness.");
  // the upload is the page's own: the same bucket and reader as Reports
  assert.match(view, /await actions\.readFile\("exercise_test"\)/);
});
