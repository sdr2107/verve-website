// One section on the page at a time (src/my-health/state.ts): which section a tab shows for the one that was asked for. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

const { sectionFor, TAB_SECTIONS, CARD_KEYS, DEPTH_KEYS, BODY_KEYS } = await import("../src/my-health/state.ts");

test("the Overview is its six cards until one section is named", () => {
  assert.equal(sectionFor("overview", "all"), "all");
  assert.equal(sectionFor("overview", "movement"), "movement");
  assert.equal(sectionFor("overview", "snapshot"), "all", "a section of another tab never follows a switch");
  assert.deepEqual([...CARD_KEYS], ["fitness", "vitals", "sleep", "exertion", "movement", "body"]);
});

test("In depth and Body have no page of their own: they open on their first section", () => {
  assert.equal(sectionFor("depth", "all"), "lastweek");
  assert.equal(sectionFor("depth", "sleep"), "sleep");
  assert.equal(sectionFor("depth", "body"), "lastweek", "Body is a card on the Overview, not a chapter of In depth");
  assert.equal(sectionFor("body", "all"), "metabolic");
  assert.equal(sectionFor("body", "reports"), "reports");
  assert.equal(sectionFor("body", "fitness"), "metabolic");
  assert.equal(DEPTH_KEYS.length, 8); assert.equal(BODY_KEYS.length, 4);
});

test("a tab with no sections holds none", () => {
  for (const tab of ["guide", "horizon", "reports", "messages", "settings", "group"]) assert.equal(sectionFor(tab, "fitness"), "all");
  assert.deepEqual(Object.keys(TAB_SECTIONS), ["overview", "depth", "body"]);
});
