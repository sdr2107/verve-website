// "See the site as" (26 November 2026; src/my-health/horizon/preview.ts): one of Verve's own accounts is shown the
// page as a founding member would see it. A preview of what the page shows, through the same functions as the real
// thing, honoured for a team account only, and changing nothing on the server. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  VIEW_AS, VIEW_AS_HEAD, VIEW_AS_KEY, VIEW_AS_NOTE, PREVIEW_BACK, DEFAULT_VIEW, MEMBER_VIEW, TEAM_VIEW, SEE_TEAM, SEE_MEMBER,
  parseViewAs, previewLine, readViewAs, sampleUntil, seenAccess, seenFlags, seenPlan, viewAsFor, viewStrip, writeViewAs,
} from "../src/my-health/horizon/preview.ts";
import { continuityLine } from "../src/my-health/horizon/founding.ts";
import { hasHorizon, maySetHorizon } from "../src/my-health/horizon/access.ts";
import { planLine, planRows } from "../src/my-health/account.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const store = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, size: () => m.size };
};
const TODAY = "2026-11-26", NOW = new Date("2026-11-26T09:00:00Z");
const TEAM = { tester: true, team: true };
const VIP = { plan: "pro", through: "vip", until: null, trial: { available: false, ends_at: null } };
const PRO_ACCESS = { pro: true, free: { available: false, until: null, running: false }, asks: { limit: 10, left: 7 } };
/** Everything the page is drawn from, for one view of a team account. */
const seen = (view) => {
  const flags = seenFlags(TEAM, view), plan = seenPlan(VIP, view, TODAY), access = seenAccess(PRO_ACCESS, view);
  return { flags, plan, access, line: planLine(plan, NOW), lastWeek: continuityLine({ through: plan?.through, until: plan?.until, today: TODAY }) };
};

test("the control: four choices in the founder's order, and its words", () => {
  assert.deepEqual(VIEW_AS.map((v) => v.label), ["Team", "Founding member", "Founding member, last week", "After the 12 weeks"]);
  assert.deepEqual(VIEW_AS.map((v) => v.key), ["team", "founding", "founding_last_week", "after"]);
  assert.equal(VIEW_AS_HEAD, "See the site as");
  assert.equal(VIEW_AS_NOTE, "A preview of what the page shows. Your account stays the team's.");
  assert.equal(PREVIEW_BACK, "Back to the team's view");
});

test("Team: the page as the server says it, nothing touched", () => {
  const s = seen("team");
  assert.deepEqual(s.flags, TEAM);
  assert.equal(s.plan, VIP); assert.equal(s.access, PRO_ACCESS);
  assert.equal(s.line, "Pro · on the VIP list");
  assert.equal(s.lastWeek, null);
  assert.equal(previewLine("team"), null, "no line on the page");
});

test("Founding member: the programme, nothing that is the team's, and a last day far off", () => {
  const s = seen("founding");
  assert.deepEqual(s.flags, { tester: true, team: false });
  assert.equal(s.plan.plan, "pro"); assert.equal(s.plan.through, "founding");
  assert.equal(sampleUntil("founding", TODAY), "2027-01-21");
  assert.equal(s.line, "Pro · founding member, until 21 January 2027");
  assert.equal(s.lastWeek, null, "not in the last week: no sentence");
  assert.match(planRows(s.plan, NOW).renews.note, /Given by Verve to its founding members, until 21 January 2027\./);
  assert.equal(s.access.pro, true);
  assert.equal(previewLine("founding"), "You are seeing what a member sees");
});

test("Founding member, last week: the same person inside the last seven days, reading the one sentence", () => {
  const s = seen("founding_last_week");
  assert.deepEqual(s.flags, { tester: true, team: false });
  assert.equal(sampleUntil("founding_last_week", TODAY), "2026-11-29");
  assert.equal(s.line, "Pro · founding member, until 29 November");
  assert.equal(s.lastWeek, "Your 12 free weeks ended on 22 November. You keep everything until 29 November.");
  assert.equal(previewLine("founding_last_week"), "Previewing as a founding member in the last week");
});

test("After the 12 weeks: Free, no programme, nothing of the team's, the plan locked; a horizon already set stays", () => {
  const s = seen("after");
  assert.deepEqual(s.flags, { tester: false, team: false });
  assert.equal(s.plan.plan, "free"); assert.equal(s.plan.through, null);
  assert.equal(s.line, "Free");
  assert.equal(s.lastWeek, null);
  assert.deepEqual(s.access, { pro: false, free: { available: false, until: null, running: false }, asks: { limit: 0, left: 0 } });
  assert.equal(sampleUntil("after", TODAY), null);
  assert.equal(previewLine("after"), "Previewing as a member after the 12 weeks");
  // the doors that follow from it, while Horizon is not offered to everyone: the tab only if a horizon is on file, and no new one
  assert.equal(hasHorizon({ open: false, programme: s.flags.tester, horizons: 1 }), true);
  assert.equal(hasHorizon({ open: false, programme: s.flags.tester, horizons: 0 }), false);
  assert.equal(maySetHorizon({ open: false, programme: s.flags.tester, owner: true }), false);
});

test("an account that is not the team's is never affected, whatever its browser holds", () => {
  for (const stored of ["founding", "founding_last_week", "after", "team", "", null, undefined, "admin", 1, {}]) {
    assert.equal(viewAsFor(stored, false), "team", String(stored));
  }
  // a founding member, an ordinary account, and one the server has not answered about yet
  for (const real of [{ tester: true, team: false }, { tester: false, team: false }]) {
    for (const view of ["team", "founding", "founding_last_week", "after"]) {
      assert.equal(seenFlags(real, view), real, "handed back as it is, even if a view were forced on it");
      // and the view in force for it is always the team's, so the plan and the access are the server's own
      const inForce = viewAsFor(view, real.team);
      assert.equal(seenPlan(VIP, inForce, TODAY), VIP); assert.equal(seenAccess(PRO_ACCESS, inForce), PRO_ACCESS);
      assert.equal(previewLine(inForce), null);
    }
  }
  // the team's own account is the only one a stored choice reaches
  assert.equal(viewAsFor("after", true), "after");
  // 27 November 2026: with nothing kept, or nothing it knows, the team's account is shown what a member sees
  assert.equal(DEFAULT_VIEW, "founding");
  for (const nothing of ["nonsense", "", null, undefined, 1, {}]) assert.equal(viewAsFor(nothing, true), "founding", String(nothing));
  assert.equal(viewAsFor("team", true), "team", "the team's view is a choice that is honoured");
});

test("the choice is kept in this browser only, and a browser that keeps nothing shows what a member sees", () => {
  const s = store();
  assert.equal(readViewAs(s), "founding", "nothing kept: the member's view");
  writeViewAs("founding_last_week", s);
  assert.equal(s.getItem(VIEW_AS_KEY), "founding_last_week"); assert.equal(readViewAs(s), "founding_last_week");
  // the team's view is a choice like the others now: it is written, and read back
  writeViewAs("team", s);
  assert.equal(s.getItem(VIEW_AS_KEY), "team"); assert.equal(readViewAs(s), "team");
  writeViewAs("founding", s);
  assert.equal(s.getItem(VIEW_AS_KEY), "founding"); assert.equal(readViewAs(s), "founding");
  assert.equal(readViewAs(null), "founding"); writeViewAs("after", null);
  assert.equal(readViewAs({ getItem: () => { throw new Error("blocked"); }, setItem: () => {}, removeItem: () => {} }), "founding", "storage that throws is not an error");
  assert.equal(readViewAs(store({ [VIEW_AS_KEY]: "owner" })), "founding"); assert.equal(parseViewAs("after"), "after"); assert.equal(parseViewAs("team"), "team");
});

test("the strip: only for the team's account, it says which view is on and leads to the other in one press", () => {
  // a real member, an ordinary account: no strip, whatever view were forced
  for (const view of ["team", "founding", "founding_last_week", "after"]) assert.equal(viewStrip(view, false), null, view);
  assert.deepEqual(viewStrip("founding", true), { text: "You are seeing what a member sees", action: "See the team's view", to: "team" });
  assert.deepEqual(viewStrip("team", true), { text: "You are seeing the team's view", action: "See what a member sees", to: "founding" });
  // the two rarer previews keep their own line and lead to the team's view, where their control is
  assert.deepEqual(viewStrip("founding_last_week", true), { text: "Previewing as a founding member in the last week", action: PREVIEW_BACK, to: "team" });
  assert.deepEqual(viewStrip("after", true), { text: "Previewing as a member after the 12 weeks", action: PREVIEW_BACK, to: "team" });
  assert.deepEqual([MEMBER_VIEW, TEAM_VIEW, SEE_TEAM, SEE_MEMBER], ["You are seeing what a member sees", "You are seeing the team's view", "See the team's view", "See what a member sees"]);
  // pressing it twice comes back to where it started
  assert.equal(viewStrip(viewStrip("founding", true).to, true).to, "founding");
  // the default view draws the page as a founding member's: the programme on, nothing that is the team's
  assert.deepEqual(seenFlags(TEAM, viewAsFor(null, true)), { tester: true, team: false });
});

test("a preview has no access the server did not give, and the functions it leans on are the real ones", () => {
  assert.equal(seenAccess(null, "founding"), null, "nothing known about the account: nothing made up");
  const src = read("../src/my-health/horizon/preview.ts");
  // no request, no table, no function: it cannot change anything on the server
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /supabase|fetch\(|\.rpc\(|\.from\(/);
  assert.match(src, /import \{ shiftDay \} from "\.\/founding\.ts";/);
});

test("the page: the signals are the server's answer or the previewed person's, and the server's answer is what is remembered", () => {
  const state = read("../src/my-health/state.ts"), page = read("../src/pages/my-health.astro"), team = read("../src/my-health/views/TesterPanel.tsx");
  assert.match(state, /export const seenAs = computed<ViewAs>\(\(\) => viewAsFor\(viewAs\.value, accountTeam\.value\)\);/, "honoured only while the server says team");
  assert.match(state, /export const isTester = computed\(\(\) => seenFlagsNow\.value\.tester\);/);
  assert.match(state, /export const isTeam = computed\(\(\) => seenFlagsNow\.value\.team\);/);
  // the server's flags are written to their own signals and kept as they came: a preview is never remembered as the account
  assert.match(page, /accountTester\.value = flags\.tester; accountTeam\.value = flags\.team; testerState\.value = "known"; remember\(askedFor, flags\);/);
  assert.doesNotMatch(page, /isTesterSignal|isTeamSignal\.value\s*=/);
  // the control lives on the team's own page, and the way back on every tab
  assert.match(team, /function SeeAs\(\)/); assert.match(team, /VIEW_AS\.map\(/); assert.match(team, /<Quiet>\{VIEW_AS_NOTE\}<\/Quiet>/);
  assert.match(page, /<p id="previewline" class="[^"]*hidden[^"]*" role="status">/);
  assert.match(page, /\$\("previewback"\)\.addEventListener\("click", \(\) => setViewAs\(stripTo\)\);/);
  assert.match(page, /const view = seenAs\.value, strip = viewStrip\(view, accountTeam\.value\), el = \$\("previewline"\);/, "the strip is asked with the server's own answer, never the previewed one");
  const at = page.indexOf('id="previewline"');
  assert.ok(at > page.indexOf("THE PAGE: one person") && at < page.indexOf('id="pagehead"'), "above every tab's page, not inside one tab");
  // the plan line, the last week's sentence and the Horizon pane read the previewed person through the same three functions
  const settings = read("../src/my-health/views/Settings.tsx"), horizon = read("../src/my-health/views/Horizon.tsx");
  assert.match(settings, /export const planInfoSignal = computed<PlanInfo \| null>\(\(\) => seenPlan\(planInfoReal\.value, seenAs\.value, todayStr\(\)\)\);/);
  assert.match(horizon, /const access = seenAccess\(accessReal, seenAs\.value\);/);
  // the two other pages that ask about the account follow it too
  assert.match(read("../src/pages/plans.astro"), /viewAsFor\(readViewAs\(\), team\) === "team"/);
  assert.match(read("../src/pages/horizon.astro"), /seenFlags\(flags, viewAsFor\(readViewAs\(\), flags\.team\)\)\.tester/);
});
