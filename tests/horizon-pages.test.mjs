// A horizon's pages: the three tabs it opens on and Settings (27 November 2026), the pages of 18 November that are
// hidden behind one switch (boards 22 and 24 of "Verve, Horizon as a programme"), and each one's address. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HORIZON_OLD_PAGES, HORIZON_PAGES, HORIZON_TABS, horizonRoute, isOldPage, isTab, routeOfPage, shownPage } from "../src/my-health/horizon/pages.ts";
import { cardOfRoute } from "../src/my-health/horizon/setupCards.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const ID = "3f6c1d1e-0000-4000-8000-000000000000";
const SHOWN = ["now", "past", "plan", "settings"];
const OLD = ["glance", "targets", "week", "science", "notes"];

test("a horizon opens on three tabs: this week, past weeks, your plan", () => {
  assert.deepEqual(HORIZON_TABS.map(([k, label]) => [k, label]), [["now", "This week"], ["past", "Past weeks"], ["plan", "Your plan"]]);
  assert.deepEqual(SHOWN.map(isTab), [true, true, true, false]);
  assert.deepEqual(OLD.map(isTab), [false, false, false, false, false]);
  assert.deepEqual(OLD.map(isOldPage), [true, true, true, true, true]);
  assert.deepEqual(SHOWN.map(isOldPage), [false, false, false, false]);
});

test("the pages of 18 November are hidden, not deleted: one switch, and it is off", () => {
  assert.equal(HORIZON_OLD_PAGES, false);
  // their names are still here, and none shares a tab's name
  assert.deepEqual(HORIZON_PAGES.map(([, label]) => label), ["Glance", "Targets", "The week's plan", "The science"]);
  for (const [, label] of HORIZON_PAGES) assert.equal(HORIZON_TABS.some(([, tab]) => tab === label), false, label);
  // and so is their code: the long page is still in the view, behind the tabs
  const view = read("../src/my-health/views/Horizon.tsx");
  for (const kept of ['on("targets")', 'page === "glance"', "<GuidePlanCard", 'on("notes")', "Check-ins and who sees them"]) assert.ok(view.includes(kept), kept);
  // the link to them is handed to the page only while the switch is on
  assert.match(view, /onMore=\{HORIZON_OLD_PAGES && owner \? \(\) => goPage\("glance"\) : undefined\}/);
  const page = read("../src/my-health/views/SimpleHorizon.tsx");
  assert.match(page, /\{onMore \? <button [^>]*data-simple-link="more">How the numbers are set<\/button> : null\}/);
});

test("each page that is shown has an address; a horizon's own address is this week", () => {
  assert.equal(routeOfPage(ID, "now"), ID);
  assert.equal(routeOfPage(ID, "past"), `${ID}-past`);
  assert.equal(routeOfPage(ID, "plan"), `${ID}-plan`);
  assert.equal(routeOfPage(ID, "settings"), `${ID}-settings`);
  assert.deepEqual(horizonRoute(ID), { id: ID, page: "now" });
  for (const page of SHOWN) assert.deepEqual(horizonRoute(routeOfPage(ID, page)), { id: ID, page });
  // an id's own hyphens are not read as a page, and a page's name alone is not a horizon
  assert.deepEqual(horizonRoute("a-b-c"), { id: "a-b-c", page: "now" });
  assert.deepEqual(horizonRoute("-past"), { id: "-past", page: "now" });
  assert.deepEqual(horizonRoute(""), { id: "", page: "now" });
});

test("an old address still lands somewhere sensible, never on a hidden page", () => {
  const at = (word) => horizonRoute(`${ID}-${word}`).page;
  // the old science and plan pages are Your plan; the old notes are Settings; the old glance and targets are This week
  assert.equal(at("science"), "plan");
  assert.equal(at("plan"), "plan");
  assert.equal(at("weekplan"), "plan");
  assert.equal(at("notes"), "settings");
  assert.equal(at("more"), "now");
  assert.equal(at("targets"), "now");
  for (const word of ["science", "plan", "weekplan", "notes", "more", "targets", "week", "past", "settings"]) assert.equal(isOldPage(at(word)), false, word);
  // and asking the code for a hidden page gives the address of the tab that took its place
  assert.equal(routeOfPage(ID, "science"), `${ID}-plan`);
  assert.equal(routeOfPage(ID, "week"), `${ID}-plan`);
  assert.equal(routeOfPage(ID, "notes"), `${ID}-settings`);
  assert.equal(routeOfPage(ID, "glance"), ID);
  assert.equal(routeOfPage(ID, "targets"), ID);
});

test("the address Monday's email links to still opens this week", () => {
  // the horizon function writes "#horizon-<id>-week" (week.ts): it was the week's small page, and is now the first tab
  assert.deepEqual(horizonRoute(`${ID}-week`), { id: ID, page: "now" });
});

test("what a reader is shown: the tabs for anyone, Settings for the owner alone, and no hidden page for anybody", () => {
  for (const tab of ["now", "past", "plan"]) for (const owner of [true, false]) assert.equal(shownPage(tab, owner), tab);
  assert.equal(shownPage("settings", true), "settings");
  assert.equal(shownPage("settings", false), "now");
  assert.deepEqual(OLD.map((p) => shownPage(p, true)), ["now", "now", "plan", "plan", "settings"]);
  assert.deepEqual(OLD.map((p) => shownPage(p, false)), ["now", "now", "plan", "plan", "now"]);
  // the view asks this before it draws anything, and draws the tabs for a shared page too while the old pages are hidden
  const view = read("../src/my-health/views/Horizon.tsx");
  assert.match(view, /const simpleOn = owner \|\| !HORIZON_OLD_PAGES;\n\s+const seen = shownPage\(page, owner\);/);
  assert.match(view, /if \(simpleOn && seen === "settings"\) \{/);
  assert.match(view, /if \(simpleOn && isTab\(seen\)\) \{/);
  // Settings and "Set another" are the owner's
  assert.match(view, /onSettings=\{owner \? \(\) => goPage\("settings"\) : undefined\}/);
  assert.match(view, /onSetAnother=\{owner \? onSetAnother : undefined\}/);
});

test("a page of a horizon is never taken for a card of the set-up, nor a card for a page", () => {
  for (const page of [...SHOWN, ...OLD]) assert.equal(cardOfRoute(routeOfPage(ID, page)), 0);
  assert.equal(cardOfRoute(`${ID}-week`), 0);
  assert.deepEqual(horizonRoute("new-4"), { id: "new-4", page: "now" });
  assert.equal(cardOfRoute("new-4"), 4);
});

test("Settings is three lines and nothing else, with the way back", () => {
  const page = read("../src/my-health/views/SimpleHorizon.tsx");
  const i = page.indexOf("export function SimpleSettings("), settings = page.slice(i);
  assert.ok(i > 0);
  assert.deepEqual([...settings.matchAll(/data-setting="(\w+)"/g)].map((m) => m[1]), ["email", "pause", "delete"]);
  for (const words of ["Email me my week on Mondays", "Pause a week", "Delete this horizon", "← This week"]) assert.ok(settings.includes(words), words);
  // none of the horizon's older switches is drawn here
  for (const gone of ["Monday morning check-in", "A Guide read at each month", "Send each check-in", "Email me each check-in", "midweek"]) assert.equal(settings.includes(gone), false, gone);
  // the email is the account's own switch, by the call the account's Settings makes; the pause and delete are the existing ones
  const view = read("../src/my-health/views/Horizon.tsx");
  assert.match(view, /setWeekly\(await saveWeekly\(deps\.supabase, uid, on, browserZone\(\)\)\);/);
  assert.match(view, /pauseAsk=\{pause && pauseAsk \? <PauseAsk /);
  assert.match(view, /onDelete=\{\(\) => void remove\(\)\}/);
});
