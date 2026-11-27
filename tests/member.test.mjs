// A founding member of the community (27 November 2026): who one is, the Guide's page hidden for them, and a horizon
// of three months with the longer lengths locked. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOUNDING_LONGEST_MONTHS, GUIDE_FOR_FOUNDING, LENGTH_LOCKED_LINE, guidePageShown, isFoundingMember, lengthLocked } from "../src/my-health/horizon/member.ts";
import { seenFlags } from "../src/my-health/horizon/preview.ts";
import { ERROR_WORDS, mapError } from "../src/my-health/horizon/errors.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const TEAM = { tester: true, team: true }, FOUNDING = { tester: true, team: false }, NOBODY = { tester: false, team: false };

test("a founding member is an account the programme is on for that is not the team's", () => {
  assert.equal(isFoundingMember(FOUNDING), true);
  assert.equal(isFoundingMember(TEAM), false);
  assert.equal(isFoundingMember(NOBODY), false);
  // one of the team's accounts previewing as a founding member is drawn as one; after the 12 weeks it is not
  assert.equal(isFoundingMember(seenFlags(TEAM, "founding")), true);
  assert.equal(isFoundingMember(seenFlags(TEAM, "founding_last_week")), true);
  assert.equal(isFoundingMember(seenFlags(TEAM, "after")), false);
  assert.equal(isFoundingMember(seenFlags(TEAM, "team")), false);
});

test("the Guide's page is hidden for a founding member, and for nobody else", () => {
  assert.equal(GUIDE_FOR_FOUNDING, false);
  assert.equal(guidePageShown(FOUNDING), false);
  assert.equal(guidePageShown(TEAM), true);
  assert.equal(guidePageShown(NOBODY), true);
  assert.equal(guidePageShown(seenFlags(TEAM, "founding")), false);
  assert.equal(guidePageShown(seenFlags(TEAM, "after")), true);
});

test("the page hides the Guide's tab, its strip on the Overview and the way in from In depth, and its address opens the Overview", () => {
  const page = read("../src/pages/my-health.astro");
  assert.match(page, /if \(t === "guide" && !guideShown\.value\) t = "overview";/);
  assert.match(page, /\$\("readtab"\)\.classList\.toggle\("hidden", !on\);\n\s+\$\("guidepointer"\)\.classList\.toggle\("hidden", !on\);\n\s+if \(!on && activeTab === "guide"\) quietly\(\(\) => setTab\("overview"\)\);/);
  // the tab sits in the bar whose hidden tabs are taken out of the page (26 November 2026)
  assert.match(page, /:is\(#tabbar, #settingsnav\) \.mh-tab\.hidden \{ display: none; \}/);
  assert.match(read("../src/my-health/views/Overview.tsx"), /export function GuidePointer\(\) \{\n[^\n]*\n\s+if \(!guideShown\.value\) return null;/);
  assert.match(read("../src/my-health/views/Depth.tsx"), /ask=\{depth && guideShown\.value \? askGuide : null\}/);
  // Body, Reports, Messages and Sharing are not touched by it
  for (const tab of ["body", "reports", "messages"]) assert.equal(new RegExp(`\\$\\("[^"]*"\\)[^\\n]*${tab}[^\\n]*guideShown`).test(page), false, tab);
});

test("a founding member's horizon is three months: the longer lengths are locked, the team's are not", () => {
  assert.equal(FOUNDING_LONGEST_MONTHS, 3);
  assert.deepEqual([3, 6, 12].map((m) => lengthLocked(m, true)), [false, true, true]);
  assert.deepEqual([3, 6, 12].map((m) => lengthLocked(m, false)), [false, false, false]);
  assert.equal(LENGTH_LOCKED_LINE, "Longer horizons open after your 12 weeks, with a subscription.");
  // no price, no link
  assert.equal(/\$|₹|http|per month|a month/.test(LENGTH_LOCKED_LINE), false);
});

test("the set-up draws the lock, the one line, and no \"More choices\" for a founding member", () => {
  const quick = read("../src/my-health/views/QuickSetup.tsx"), view = read("../src/my-health/views/Horizon.tsx");
  assert.match(quick, /lengthLocked\(m, founding\)\n\s+\? <button type="button" role="radio" aria-checked=\{false\} aria-disabled="true" disabled key=\{m\} data-quick-length=\{m\} data-quick-locked="yes"/);
  assert.match(quick, /\{founding \? <p [^>]*data-quick="locked-line">\{LENGTH_LOCKED_LINE\}<\/p> : null\}/);
  assert.match(quick, /\{founding \|\| !SETUP_MORE_CHOICES \? null : <button type="button" onClick=\{onMore\} [^>]*data-quick-link="more">More choices<\/button>\}/);
  // whatever was pressed, the length kept is one the account may have
  assert.match(quick, /const length: Length = lengthLocked\(picked, founding\) \? 3 : picked;/);
  // the page hands in who it is drawn for, and a founding member never meets the seven-card set-up
  assert.match(view, /showSetup && tester && owner && \(isFounding\.value \|\| !SETUP_MORE_CHOICES \|\| \(!ownTargets && !fullSetup && setupCard <= 1 && \(open\.length > 0 \|\| !done\[0\]\)\)\)\n\s+\? <QuickSetup [^\n]*founding=\{isFounding\.value\}/);
});

test("the function's refusal of a longer horizon has plain words on the page", () => {
  assert.equal(mapError(403, { error: "horizon_length_locked" }), "length_locked");
  assert.equal(ERROR_WORDS.length_locked, "Longer horizons open after your 12 weeks, with a subscription. Nothing was set.");
  // and the older refusal still reads as itself
  assert.equal(mapError(403, { error: "horizon_members_only" }), "members_only");
});

test("\"More choices\" is hidden for everyone, the team too, behind one switch; nothing of the old set-up is deleted", async () => {
  const { SETUP_MORE_CHOICES } = await import("../src/my-health/horizon/member.ts");
  assert.equal(SETUP_MORE_CHOICES, false);
  const quick = read("../src/my-health/views/QuickSetup.tsx"), view = read("../src/my-health/views/Horizon.tsx"), programme = read("../src/my-health/views/Programme.tsx");
  // with no link and no other horizon to cancel back to, the row of small links is not drawn at all
  assert.match(quick, /\{\(founding \|\| !SETUP_MORE_CHOICES\) && !hasOthers \? null : \(/);
  // the seven-card set-up, "My own targets" and the prefilled next horizon are all still in the code
  assert.match(programme, /export function ProgrammeSetup\(/);
  assert.match(view, /\? <ProgrammeSetup /); assert.match(view, /\? <Setup deps=\{deps\}/);
  assert.match(view, /: <Setup deps=\{deps\} person=\{person\} today=\{today\} personId=\{personId\} hasOthers=\{false\} nav=\{null\} prefill=\{prefill\}/);
});

