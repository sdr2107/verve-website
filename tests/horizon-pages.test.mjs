// A horizon's small pages (boards 22 and 24 of "Verve, Horizon as a programme"): their names, and each one's address.
// `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HORIZON_PAGES, horizonRoute, routeOfPage } from "../src/my-health/horizon/pages.ts";
import { cardOfRoute } from "../src/my-health/horizon/setupCards.ts";

const ID = "3f6c1d1e-0000-4000-8000-000000000000";

test("four places on the switch, in the founder's words, and the glance first", () => {
  assert.deepEqual(HORIZON_PAGES.map(([, label]) => label), ["Glance", "Targets", "This week", "The science"]);
  assert.equal(HORIZON_PAGES[0][0], "glance");
});

test("each page has an address; a horizon's own address is its glance", () => {
  assert.equal(routeOfPage(ID, "glance"), ID);
  assert.equal(routeOfPage(ID, "week"), `${ID}-week`);
  assert.deepEqual(horizonRoute(ID), { id: ID, page: "glance" });
  for (const page of ["targets", "week", "science", "notes"]) assert.deepEqual(horizonRoute(routeOfPage(ID, page)), { id: ID, page });
  // an id's own hyphens are not read as a page, and a page's name alone is not a horizon
  assert.deepEqual(horizonRoute("a-b-c"), { id: "a-b-c", page: "glance" });
  assert.deepEqual(horizonRoute("-week"), { id: "-week", page: "glance" });
  assert.deepEqual(horizonRoute(""), { id: "", page: "glance" });
});

test("a page of a horizon is never taken for a card of the set-up, nor a card for a page", () => {
  for (const page of ["glance", "targets", "week", "science", "notes"]) assert.equal(cardOfRoute(routeOfPage(ID, page)), 0);
  assert.deepEqual(horizonRoute("new-4"), { id: "new-4", page: "glance" });
  assert.equal(cardOfRoute("new-4"), 4);
});
