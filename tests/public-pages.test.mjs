// The public pages' fixed points (11 Nov 2026, the canvas "Verve on the web, rethought"): the bar, the footer,
// where the videos went, and the line that was retired. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAV, FOOTER_LINKS, APP_SOCIAL, FOUNDER_SOCIAL, APP_HANDLE, ACCOUNT_PATH } from "../src/data/site.ts";
import { VIDEOS, videosInGroup } from "../src/data/videos.ts";
import { STORY, STORY_TITLE, STORY_LINE } from "../src/data/story.ts";

const SRC = new URL("../src/", import.meta.url).pathname;
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(astro|ts|tsx|js|mjs|json|md)$/.test(name)) yield p;
  }
}

test("the bar holds three places; what left it is still reachable from the footer", () => {
  assert.deepEqual(NAV.map((l) => l.href), ["/how-it-works", "/science", "/plans"]);
  assert.equal(ACCOUNT_PATH, "/my-health");
  for (const href of ["/videos", "/sheet"]) assert.ok(FOOTER_LINKS.some((l) => l.href === href), `${href} is in the footer`);
  assert.ok(!NAV.some((l) => ["/start", "/videos", "/my-health"].includes(l.href)));
});

test("the footer's five accounts: the app's three under one handle, then the founder's two", () => {
  assert.deepEqual(APP_SOCIAL.map((s) => s.label), ["Instagram", "TikTok", "YouTube"]);
  assert.ok(APP_SOCIAL.every((s) => s.handle === APP_HANDLE));
  assert.deepEqual(FOUNDER_SOCIAL.map((s) => s.label), ["X", "Substack"]);
  assert.deepEqual([...APP_SOCIAL, ...FOUNDER_SOCIAL].map((s) => s.key), ["instagram", "tiktok", "youtube", "x", "substack"]);
});

test("a store's link shows the official badge only when its file is in the repo; no artwork is drawn in its place", () => {
  const badge = readFileSync(join(SRC, "components/StoreBadge.astro"), "utf8");
  assert.match(badge, /import\.meta\.glob\("\.\.\/assets\/badges\/\*\.svg"/, "the badge is whatever official file is in src/assets/badges at build time");
  assert.ok(!/<svg|<path/.test(badge), "the component holds no drawn mark");
  const footer = readFileSync(join(SRC, "components/Footer.astro"), "utf8");
  assert.match(footer, /Android &middot; soon/);
  assert.ok(!/AppGallery/i.test(footer));
});

test("every video has a home: a topic page, How it works, or the full list", () => {
  assert.equal(videosInGroup("how-verve-works").length, 6, "the six product videos sit on How it works");
  assert.ok(VIDEOS.every((v) => v.topic || v.group === "how-verve-works" || v.group === "wider-picture"));
});

test("the story is four questions, in the order My health's sidebar holds its pages", () => {
  assert.deepEqual(STORY.map((s) => s.key), ["overview", "depth", "guide", "horizon"]);
  assert.deepEqual(STORY.map((s) => s.question), ["Where am I today?", "How did I get here?", "What stands out?", "Where am I going?"]);
  assert.ok(STORY.every((s) => s.line.split(/\s+/).length <= 14), "one short line each");
  assert.equal(STORY_TITLE, "Your health, in four questions");
  // the sidebar's four pages come in the same order
  const page = readFileSync(join(SRC, "pages/my-health.astro"), "utf8");
  const at = STORY.map((s) => page.indexOf(`class="mh-tab" data-tab="${s.key}"`));
  assert.ok(at.every((i) => i > 0) && at.every((i, n) => n === 0 || i > at[n - 1]), "Overview, In depth, the Guide, Horizon");
  // the landing page tells it where "What you come back for" stood
  const landing = readFileSync(join(SRC, "pages/index.astro"), "utf8");
  assert.ok(landing.includes("{STORY_TITLE}") && !/come back for<\/h2>/.test(landing));
});

test("the story says what stands out, and never that Verve finds, detects, warns or predicts", () => {
  const told = [STORY_TITLE, STORY_LINE, ...STORY.flatMap((s) => [s.question, s.line, s.more, s.plan])].join(" ");
  for (const rx of [/\bdetects?\b/i, /\bwarns?\b/i, /\bpredicts?\b/i, /did not know/i, /\binsights?\b/i, /longevity/i, /healthspan/i, /you will (become|reach)/i, /medical-grade/i, /\bprotocol\b/i]) assert.ok(!rx.test(told), `the story carries a word it must not: ${rx}`);
  // nor does any page of the site use the retired framing for the Guide
  for (const f of files(SRC)) assert.ok(!/what (you|i) did(n't| not) know about (yourself|myself)/i.test(readFileSync(f, "utf8")), `${f.slice(SRC.length)} promises to reveal`);
});

test("no page promises anything about how long a person will live", () => {
  const retired = [/predicts? how long/i, /how long (and how well )?you('ll| will)? live/i, /add years to your life/i, /live longer with verve/i];
  for (const f of files(SRC)) {
    const text = readFileSync(f, "utf8");
    for (const rx of retired) assert.ok(!rx.test(text), `${f.slice(SRC.length)} carries a retired line: ${rx}`);
  }
});
