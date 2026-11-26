// The plans page, hidden until payments open (the founder, 21 November 2026: "make the plans page on the website
// only visible for me and hide it from the live website. We will make it live after we add payments. Dont delete
// the code for it."). Read from the source. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PLANS_OPEN, PLANS_PAGE_PUBLIC, FREE_AND_PRO_PATH, PLANS, FEATURE_ROWS } from "../src/data/plans.ts";
import { NAV, FOOTER_LINKS } from "../src/data/site.ts";
import { HELP_DOORS } from "../src/data/help.ts";
import { planDoor, PRO_IN_THE_APP } from "../src/data/plan-door.ts";
import { GET_APP_PATH } from "../src/data/site.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const plans = read("../src/pages/plans.astro");

test("the switch is off, and it is its own switch: checkout's is untouched", () => {
  assert.equal(PLANS_PAGE_PUBLIC, false);
  assert.equal(PLANS_OPEN, true);
});

test("while it is off, the page is in neither the top bar nor the footer", () => {
  assert.equal([...NAV, ...FOOTER_LINKS].some((l) => l.href.replace(/\/$/, "") === "/plans"), PLANS_PAGE_PUBLIC);
  assert.match(read("../src/data/site.ts"), /\.\.\.\(PLANS_OPEN && PLANS_PAGE_PUBLIC \? \[\{ key: "plans" as const, label: "Plans", href: "\/plans" \}\] : \[\]\)/);
});

test("search engines are asked to leave it out while it is hidden", () => {
  assert.match(plans, /noindex=\{!PLANS_PAGE_PUBLIC\}/);
});

test("a visitor reads three lines and is given something to do; the chart is drawn but not shown", () => {
  const closed = plans.slice(plans.indexOf("{!PLANS_PAGE_PUBLIC && ("), plans.indexOf("<div data-plans-chart"));
  assert.match(closed, /<section data-plans-closed /);
  assert.match(closed, />Plans are not open yet\.<\/h1>/);
  assert.match(closed, /Paying for Pro on the website opens later\. Pro bought in the app works here too, on the same sign-in\./);
  assert.match(closed, /<a href=\{GET_APP_PATH\}[^>]*>Get the app<\/a>/);
  assert.match(closed, /<a href=\{ACCOUNT_PATH\}[^>]*>Open My health<\/a>/);
  assert.doesNotMatch(closed, /[$€£₹]\s?\d|price|\bmet\b/i);
  assert.match(plans, /<div data-plans-chart hidden=\{!PLANS_PAGE_PUBLIC\}>/);
});

test("the chart is shown to a test account only, through the one question My health asks", () => {
  const gate = plans.slice(plans.indexOf("// While the page is hidden"));
  // the team's own accounts since 25 November 2026: a founding member has the programme, and still reads that plans are not open
  assert.match(gate, /import \{ teamAnswer \} from "\.\.\/my-health\/horizon\/api\.ts";/);
  assert.match(gate, /if \(!uid\) return;/, "signed out: the page stays closed");
  assert.match(gate, /if \(recall\(uid\)\.team === true\) show\(true\);/, "what the last visit learned, at once");
  assert.match(gate, /const answer = await teamAnswer\(supabase, uid\);\s*if \(answer == null\) return;/, "an ask that failed changes nothing");
  assert.match(gate, /remember\(uid, \{ team: answer \}\);\s*show\(answer\);/, "a no closes it again");
  // 26 November 2026: one of the team's accounts shown the site as a founding member reads what a member reads here
  assert.match(gate, /const show = \(team: boolean\) => \{ const yes = team && viewAsFor\(readViewAs\(\), team\) === "team"; chart\.hidden = !yes; closed\.hidden = yes; \};/);
});

test("inside My health no link opens the hidden page: every one asks the one helper where it leads", () => {
  // the helper: the Plans page once it is public; until then the app where Pro bought there is the next step, else nothing
  assert.deepEqual(planDoor("See the plans", true, true), { href: "/plans", label: "See the plans" });
  assert.deepEqual(planDoor("See every plan", false, true), { href: "/plans", label: "See every plan" });
  assert.deepEqual(planDoor("See the plans", true, false), { href: GET_APP_PATH, label: "Get Pro in the app" });
  assert.equal(planDoor("See the plans", false, false), null);
  assert.deepEqual(planDoor("See the plans", true), PLANS_PAGE_PUBLIC ? { href: "/plans", label: "See the plans" } : { href: GET_APP_PATH, label: PRO_IN_THE_APP });
  // no file of My health writes the address itself any more: turning the switch on is the only way a link returns
  const dir = new URL("../src/my-health/", import.meta.url);
  const sources = readdirSync(dir, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(String(f))).map((f) => String(f));
  assert.ok(sources.length > 40);
  for (const f of sources) assert.doesNotMatch(readFileSync(new URL(f, dir), "utf8"), /href=["'`{]+\/plans|["'`]\/plans\/?["'`]/, `${f} links to /plans itself`);
  const page = read("../src/pages/my-health.astro");
  assert.doesNotMatch(page, /href="\/plans"/, "my-health.astro links to /plans itself");
  for (const [file, uses] of [["views/Settings.tsx", 'planDoor("See every plan", false)'], ["views/PlanSheet.tsx", 'planDoor("See every plan", false)'], ["views/Depth.tsx", 'planDoor("See the plans", self)'], ["views/Reads.ts", 'planDoor("The plans", false)'], ["views/Horizon.tsx", 'planDoor("See the plans", false)'], ["views/GuidePlan.tsx", 'planDoor("See the plans", false)']])
    assert.ok(readFileSync(new URL(file, dir), "utf8").includes(uses), `${file} asks the helper`);
  assert.ok(page.includes('planDoor("See the plans", false)') && page.includes("planDoor(cta, false)"));
});

test("nothing was deleted: the chart, its plans and its rows are all still in the page", () => {
  assert.match(plans, />One login\. Three plans\.<\/h1>/);
  assert.match(plans, /PLANS\.map\(|FEATURE_ROWS\.map\(/);
  assert.match(plans, /data-choose/);
  assert.ok(PLANS.length >= 4 && FEATURE_ROWS.length > 0);
});

test("no public page links to the hidden page", () => {
  for (const file of ["../src/pages/index.astro", "../src/pages/start.astro", "../src/pages/how-it-works.astro"]) {
    for (const line of read(file).split("\n").filter((l) => /["'`]\/plans["'`]/.test(l))) {
      assert.match(line, /PLANS_PAGE_PUBLIC/, `${file}: a link to /plans that the switch does not guard: ${line.trim().slice(0, 90)}`);
    }
  }
  const links = HELP_DOORS.flatMap((d) => d.questions).map((q) => q.link?.href).filter(Boolean);
  assert.equal(links.some((h) => h.startsWith("/plans")), PLANS_PAGE_PUBLIC);
});

test("the question 'what is free and what is Pro' goes to the manual's own section meanwhile", () => {
  assert.equal(FREE_AND_PRO_PATH, "/how-it-works#free-and-pro");
  assert.match(read("../src/pages/how-it-works.astro"), /id: "free-and-pro"/);
  assert.match(read("../src/pages/index.astro"), /<a href=\{PLANS_PAGE_PUBLIC \? "\/plans" : FREE_AND_PRO_PATH\} class=\{quiet\}>See what is free and what is Pro<\/a>/);
  const pro = HELP_DOORS.flatMap((d) => d.questions).find((q) => q.q === "What does Pro add?");
  assert.deepEqual(pro.link, PLANS_PAGE_PUBLIC ? { label: "See every plan", href: "/plans" } : { label: "See what is free and what is Pro", href: FREE_AND_PRO_PATH });
});
