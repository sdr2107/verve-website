// A horizon's pages: the two tabs it opens on (27 November 2026), the pages kept behind "How the numbers are set"
// (boards 22 and 24 of "Verve, Horizon as a programme"), and each one's address. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HORIZON_PAGES, HORIZON_TABS, horizonRoute, isTab, routeOfPage } from "../src/my-health/horizon/pages.ts";
import { cardOfRoute } from "../src/my-health/horizon/setupCards.ts";

const ID = "3f6c1d1e-0000-4000-8000-000000000000";
const ALL = ["now", "past", "glance", "targets", "week", "science", "notes"];

test("a horizon opens on two tabs and nothing else: this week, then past weeks", () => {
  assert.deepEqual(HORIZON_TABS.map(([k, label]) => [k, label]), [["now", "This week"], ["past", "Past weeks"]]);
  assert.deepEqual(ALL.map(isTab), [true, true, false, false, false, false, false]);
});

test("the pages behind the link are the four of 18 November, and none shares a tab's name", () => {
  assert.deepEqual(HORIZON_PAGES.map(([, label]) => label), ["Glance", "Targets", "The week's plan", "The science"]);
  assert.equal(HORIZON_PAGES[0][0], "glance");
  for (const [, label] of HORIZON_PAGES) assert.equal(HORIZON_TABS.some(([, tab]) => tab === label), false, label);
});

test("each page has an address; a horizon's own address is this week", () => {
  assert.equal(routeOfPage(ID, "now"), ID);
  assert.equal(routeOfPage(ID, "past"), `${ID}-past`);
  assert.equal(routeOfPage(ID, "glance"), `${ID}-more`);
  assert.equal(routeOfPage(ID, "week"), `${ID}-plan`);
  assert.deepEqual(horizonRoute(ID), { id: ID, page: "now" });
  for (const page of ALL) assert.deepEqual(horizonRoute(routeOfPage(ID, page)), { id: ID, page });
  // an id's own hyphens are not read as a page, and a page's name alone is not a horizon
  assert.deepEqual(horizonRoute("a-b-c"), { id: "a-b-c", page: "now" });
  assert.deepEqual(horizonRoute("-past"), { id: "-past", page: "now" });
  assert.deepEqual(horizonRoute(""), { id: "", page: "now" });
});

test("the address Monday's email links to still opens this week", () => {
  // the horizon function writes "#horizon-<id>-week" (week.ts): it was the week's small page, and is now the first tab
  assert.deepEqual(horizonRoute(`${ID}-week`), { id: ID, page: "now" });
});

test("a page of a horizon is never taken for a card of the set-up, nor a card for a page", () => {
  for (const page of ALL) assert.equal(cardOfRoute(routeOfPage(ID, page)), 0);
  assert.equal(cardOfRoute(`${ID}-week`), 0);
  assert.deepEqual(horizonRoute("new-4"), { id: "new-4", page: "now" });
  assert.equal(cardOfRoute("new-4"), 4);
});
