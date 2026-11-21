// The plans page, hidden until payments open (the founder, 21 November 2026: "make the plans page on the website
// only visible for me and hide it from the live website. We will make it live after we add payments. Dont delete
// the code for it."). Read from the source. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLANS_OPEN, PLANS_PAGE_PUBLIC, FREE_AND_PRO_PATH, PLANS, FEATURE_ROWS } from "../src/data/plans.ts";
import { NAV, FOOTER_LINKS } from "../src/data/site.ts";
import { HELP_DOORS } from "../src/data/help.ts";

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
  assert.match(gate, /import \{ testerAnswer \} from "\.\.\/my-health\/horizon\/api\.ts";/);
  assert.match(gate, /if \(!uid\) return;/, "signed out: the page stays closed");
  assert.match(gate, /if \(recall\(uid\)\.tester === true\) show\(true\);/, "what the last visit learned, at once");
  assert.match(gate, /const answer = await testerAnswer\(supabase, uid\);\s*if \(answer == null\) return;/, "an ask that failed changes nothing");
  assert.match(gate, /remember\(uid, \{ tester: answer \}\);\s*show\(answer\);/, "a no closes it again");
  assert.match(gate, /const show = \(yes: boolean\) => \{ chart\.hidden = !yes; closed\.hidden = yes; \};/);
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
