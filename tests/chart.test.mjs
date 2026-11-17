// A diet chart beside the horizon (board 17 of "Verve, Horizon as a programme"): what is read, which chart is in
// force, and the count of days in the person's own word. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChart, chartInForce, mealsOn, chartCount, chartCountWords, CHART_HEAD } from "../src/my-health/horizon/chart.ts";
import { CHECKIN_HEADS, checkinLinesOf } from "../src/my-health/horizon/derive.ts";
import * as chartRules from "../src/my-health/horizon/chart.ts";

const READ = {
  written_by: "R. Kulkarni, dietitian", review_on: "2026-12-12",
  meals: [{ when: "On waking", items: "Warm water, 5 soaked almonds" }, { when: "Breakfast", items: "2 moong chilla with curd, or 2 idli with sambar" }, { when: "Lunch", items: "2 phulka, dal, sabzi, salad" }, { when: "", items: "1 fruit" }, { when: "Dinner", items: "" }, "not a meal"],
  notes: ["Dinner by 8 pm. 3 litres of water.", "", 7], totals: [{ name: "Energy", value: "1500 kcal" }, { name: "Protein" }],
};
const chart = (o) => ({ id: "c1", horizon_id: "h1", user_id: "u1", report_path: "u1/1-chart.pdf", written_by: null, given_on: "2026-11-14", review_on: null, meals: [{ when: "Breakfast", items: "Poha" }], notes: [], totals: [], removed_at: null, created_at: "2026-11-14T08:00:00Z", ...o });

test("a chart is kept in its own words: strings only, bounded, nothing added", () => {
  const c = parseChart(READ, "2026-11-14");
  assert.equal(c.written_by, "R. Kulkarni, dietitian");
  assert.deepEqual([c.given_on, c.review_on], ["2026-11-14", "2026-12-12"]);
  // a line with no words is dropped; a line with no time keeps its words
  assert.deepEqual(c.meals.map((m) => m.when), ["On waking", "Breakfast", "Lunch", "Any time"]);
  assert.equal(c.meals[1].items, "2 moong chilla with curd, or 2 idli with sambar");
  assert.deepEqual(c.notes, ["Dinner by 8 pm. 3 litres of water."]);
  // a total is kept only where the chart printed both its name and its value
  assert.deepEqual(c.totals, [{ name: "Energy", value: "1500 kcal" }]);
  assert.equal(parseChart({ meals: [], notes: [] }), null);
  assert.equal(parseChart(null), null);
  // words stay in the script they were written in
  assert.equal(parseChart({ meals: [{ when: "सुबह", items: "पोहा, चाय बिना चीनी" }] }).meals[0].items, "पोहा, चाय बिना चीनी");
});

test("one chart is in force at a time: the newest given on or before the day, and not one taken off", () => {
  const old = chart({ id: "a", given_on: "2026-11-14" }), newer = chart({ id: "b", given_on: "2026-12-01" }), gone = chart({ id: "c", given_on: "2026-12-05", removed_at: "2026-12-06T00:00:00Z" });
  assert.equal(chartInForce([old, newer, gone], "2026-11-13"), null);
  assert.equal(chartInForce([old, newer, gone], "2026-11-20").id, "a");
  assert.equal(chartInForce([newer, old, gone], "2026-12-01").id, "b");
  assert.equal(chartInForce([old, newer, gone], "2026-12-10").id, "b");
});

test("a chart that differs by the day shows the day's own lines", () => {
  const c = { meals: [{ day: "Monday", when: "Lunch", items: "Dal, rice" }, { day: "Tue", when: "Lunch", items: "Rajma, roti" }, { when: "Bedtime", items: "Milk" }] };
  assert.deepEqual(mealsOn(c, "2026-11-30").map((m) => m.items), ["Dal, rice", "Milk"]);      // a Monday
  assert.deepEqual(mealsOn(c, "2026-12-01").map((m) => m.items), ["Rajma, roti", "Milk"]);    // a Tuesday
  assert.equal(mealsOn({ meals: [{ when: "Lunch", items: "Dal" }] }, "2026-12-01").length, 1);
});

test("the count is the person's own word: a day with no answer is a dash, never a no", () => {
  const charts = [chart({ given_on: "2026-11-14" })];
  const days = [{ day: "2026-11-30", answer: "yes" }, { day: "2026-12-01", answer: "yes" }, { day: "2026-12-02", answer: "mostly" }, { day: "2026-12-04", answer: "no" }];
  const soFar = chartCount(charts, days, "2026-11-30", "2026-12-02");
  assert.deepEqual(soFar, { yes: 2, mostly: 1, no: 0, marked: 3, days: 3 });
  assert.equal(chartCountWords(soFar, true), "yes on 2 of 3 days so far, mostly on 1, by your own count.");
  const week = chartCount(charts, days, "2026-11-30", "2026-12-06");
  assert.deepEqual(week, { yes: 2, mostly: 1, no: 1, marked: 4, days: 7 });
  assert.equal(chartCountWords(week), "yes on 2 of the 4 days you marked, mostly on 1, by your own count.");
  // nothing marked: nothing is said
  assert.equal(chartCountWords(chartCount(charts, [], "2026-11-30", "2026-12-06")), "");
  // a day before the chart was given is not one of its days
  assert.equal(chartCount([chart({ given_on: "2026-12-02" })], days, "2026-11-30", "2026-12-06").days, 5);
});

test("the count can sit in a check-in as a line of its own, and nothing in this file works anything out from a chart", () => {
  assert.equal(CHECKIN_HEADS.chart, CHART_HEAD);
  const lines = checkinLinesOf(`The week: Two sessions, one of strength.\n${CHART_HEAD}: yes on 5 of 7 days, by your own count.`);
  assert.deepEqual(lines.map((l) => l.head), ["The week", "The chart"]);
  // no calories, no score, no grade: the file exports nothing of the kind
  assert.ok(!Object.keys(chartRules).some((k) => /calor|energy|score|grade|macro/i.test(k)));
});

// ── sharing a chart with a coach (17 November 2026) ──

test("the chart has its own tick: offered to test accounts only, in no preset, and counted only on a share that also holds the horizon", async () => {
  const { SCOPE_LABEL, TEST_SCOPES, offeredScopes, scopeList } = await import("../src/my-health/derive/scopes.ts");
  const { chartSharedWith, CHART_SCOPE } = chartRules;
  assert.equal(CHART_SCOPE, "chart");
  assert.equal(SCOPE_LABEL.chart, "Diet chart");
  assert.ok(TEST_SCOPES.has("chart"));
  // anyone else is offered exactly what they were offered before
  assert.deepEqual(offeredScopes({ hasAccount: true, tester: false }), ["labs", "imaging", "activity", "body", "heart"]);
  assert.deepEqual(offeredScopes({ hasAccount: false, tester: false }), ["labs", "imaging"]);
  assert.deepEqual(offeredScopes({ hasAccount: true, tester: true }), ["labs", "imaging", "activity", "body", "heart", "chart"]);
  assert.equal(scopeList(["activity", "chart"]), "Activity and fitness · Diet chart");
  // shared with: active, the chart's tick, and the horizon's own tick; a waiting invitation and a stopped share are not counted
  const shares = [
    { status: "active", scopes: ["activity", "chart"] }, { status: "active", scopes: ["activity", "body"] }, { status: "active", scopes: ["chart"] },
    { status: "invited", scopes: ["activity", "chart"] }, { status: "stopped", scopes: ["activity", "chart"] },
  ];
  assert.equal(chartSharedWith(shares), 1);
  assert.equal(chartSharedWith([]), 0);
  assert.equal(chartSharedWith(null), 0);
});

test("said to a coach, the count is the person's own word and not the coach's", () => {
  const charts = [chart({ given_on: "2026-11-14" })];
  const days = [{ day: "2026-11-30", answer: "yes" }, { day: "2026-12-01", answer: "yes" }, { day: "2026-12-02", answer: "mostly" }];
  assert.equal(chartCountWords(chartCount(charts, days, "2026-11-30", "2026-12-06"), false, "they"), "yes on 2 of the 3 days they marked, mostly on 1, by their own count.");
  assert.equal(chartCountWords(chartCount(charts, days, "2026-11-30", "2026-12-02"), true, "they"), "yes on 2 of 3 days so far, mostly on 1, by their own count.");
  // the person's own sentence is unchanged
  assert.equal(chartCountWords(chartCount(charts, days, "2026-11-30", "2026-12-02"), true), "yes on 2 of 3 days so far, mostly on 1, by your own count.");
});
