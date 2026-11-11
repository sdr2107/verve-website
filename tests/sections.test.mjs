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

test("In depth and Body have no page of their own: In depth opens on one year, Body on its first section", () => {
  assert.equal(sectionFor("depth", "all"), "1y");
  assert.equal(sectionFor("depth", "6m"), "6m");
  assert.equal(sectionFor("depth", "sleep"), "1y", "an address from before In depth went by time lands on one year");
  assert.equal(sectionFor("depth", "body"), "1y", "Body is a card on the Overview, not a window of In depth");
  assert.equal(sectionFor("body", "all"), "metabolic");
  assert.equal(sectionFor("body", "reports"), "reports");
  assert.equal(sectionFor("body", "fitness"), "metabolic");
  assert.deepEqual([...DEPTH_KEYS], ["1m", "3m", "6m", "1y", "3y"]); assert.equal(BODY_KEYS.length, 4);
});

test("a tab with no sections holds none", () => {
  for (const tab of ["guide", "horizon", "reports", "messages", "settings", "group"]) assert.equal(sectionFor(tab, "fitness"), "all");
  assert.deepEqual(Object.keys(TAB_SECTIONS), ["overview", "depth", "body"]);
});
