// The letter's own page and the link to it in the footer of every page (board 34; the founder, 21 November 2026:
// "build what you mocked - all four as drawn, keep it as newsletter"). Read from the source. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOOTER_LINKS, HELP_PATH, NAV, NEWSLETTER_PATH, SUBSTACK_URL } from "../src/data/site.ts";
import { DOORS, byDoor, doorWords } from "../src/my-health/list/list.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../src/pages/newsletter.astro"), box = read("../src/components/LetterBox.astro"), footer = read("../src/components/Footer.astro");
const body = page.slice(page.indexOf("<Layout"));

test("the footer of every page carries Newsletter, just before Help, and the top bar does not", () => {
  assert.equal(NEWSLETTER_PATH, "/newsletter");
  const hrefs = FOOTER_LINKS.map((l) => l.href);
  assert.deepEqual(FOOTER_LINKS.find((l) => l.href === NEWSLETTER_PATH), { label: "Newsletter", href: "/newsletter" });
  assert.equal(hrefs.indexOf(NEWSLETTER_PATH), hrefs.indexOf(HELP_PATH) - 1);
  assert.equal(hrefs.at(-1), HELP_PATH);
  assert.equal(NAV.some((l) => l.href === NEWSLETTER_PATH), false);
  // one footer for the whole site, and it prints the row
  assert.match(footer, /FOOTER_LINKS/);
});

test("the page does one job: says what the letter is, takes an address, says what happens next", () => {
  assert.match(body, /<h1[^>]*>The Verve letter<\/h1>/);
  assert.match(body, /One email a week\. One number, its threshold, the study behind it, and what to check\./);
  assert.match(body, /<LetterBox door="newsletter" \/>/);
  assert.match(page, /The first letter comes at once, from hello@verve-app\.health\./);
  assert.match(page, /One press inside it starts the weekly letter\. Without the press, it is the only email you get\./);
  assert.match(page, /Every letter has an Unsubscribe button\. One click, and nothing else is sent\./);
});

test("it can be found by search, and it says nothing about Horizon, a price or an offer", () => {
  assert.doesNotMatch(body, /noindex/);
  assert.doesNotMatch(body, /horizon/i);
  assert.doesNotMatch(body, /[$€£₹]\s?\d|\bfree\b|discount|\bPro\b|\/plans/);
});

test("past letters: one link to Substack, the same address the footer uses", () => {
  assert.match(body, /<a href=\{SUBSTACK_URL\}[^>]*>Read past letters on Substack<\/a>/);
  assert.match(SUBSTACK_URL, /^https:\/\/substack\.com\//);
});

test("the box on this page writes its own door, keeps the word on a post's link, and offers two things to do", () => {
  // the third place is the Horizon page's, and that page holds it back while Horizon is not offered to everyone (26 Nov 2026)
  assert.match(box, /data-door=\{door\} data-places=\{own && third \? "Three" : "Two"\}/);
  assert.match(box, /const door = box\.dataset\.door === "newsletter" \? "newsletter" : "horizon";/);
  // 22 Nov 2026: posts link /newsletter?from=<word>, so this door keeps the word as the Horizon page does
  assert.match(box, /source: door, user_id: userId, tag: tagOf\(location\.search\) \}\);/);
  // the heading and the third thing to do belong to the Horizon page only
  assert.match(box, /\{own && <div class="flex flex-col gap-1">\s*<h2 id="letterhead"/);
  assert.match(box, /\{own && <div class="flex gap-3" data-letter-third hidden=\{!third\}><span class=\{step\}>3<\/span>/);
  assert.match(box, /aria-label=\{own \? undefined : "The Verve letter"\}/);
  assert.match(box, /const begin = \(\) => `\$\{box\.dataset\.places \?\? "Three"\} places to begin`;/);
});

test("the Horizon page's box is as it was: its own heading, the word on the link, three things to do", () => {
  const horizon = read("../src/pages/horizon.astro");
  assert.match(horizon, /<LetterBox(\s[^>]*)?\/>/);
  assert.doesNotMatch(horizon, /door="newsletter"/);
  assert.match(horizon, /noindex/);
});

test("the list page names the new door, and counts it on its own", () => {
  assert.equal(DOORS.newsletter, "The newsletter page");
  assert.equal(doorWords("newsletter"), "The newsletter page");
  const rows = ["newsletter", "newsletter", "horizon"].map((source, i) => ({ id: String(i), email: `a${i}@example.com`, consented_at: "2026-11-21T06:00:00Z", source, tag: null, confirmed_at: null, welcome_sent_at: null, unsubscribed_at: null }));
  assert.deepEqual(byDoor(rows).map((d) => [d.label, d.count]), [["The newsletter page", 2], ["The Horizon page", 1]]);
});
