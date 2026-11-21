// The public pages' fixed points (11 Nov 2026, the canvas "Verve on the web, rethought"): the bar, the footer,
// where the videos went, and the line that was retired. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PLANS_PAGE_PUBLIC } from "../src/data/plans.ts";
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

test("the bar holds its places; what left it is still reachable from the footer", () => {
  // Plans is in the bar only while its page is public (data/plans.ts PLANS_PAGE_PUBLIC; tests/plans-hidden.test.mjs)
  assert.deepEqual(NAV.map((l) => l.href), ["/how-it-works", "/science", ...(PLANS_PAGE_PUBLIC ? ["/plans"] : [])]);
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

// 15 Nov 2026: the live site read "may not.On a morning" and "is inMy health". Astro 7's default whitespace
// handling ('jsx') deletes a line break that sits between a tag and the text beside it, and these pages are
// prose wrapped across lines. `true` is the lossless handling: such a break becomes one space.
test("prose wrapped across lines keeps its spaces: the build's whitespace handling is lossless", () => {
  const config = readFileSync(new URL("../astro.config.mjs", import.meta.url), "utf8");
  assert.match(config, /^\s*compressHTML:\s*true\s*,/m, "astro.config.mjs sets compressHTML: true");
});

// 15 Nov 2026: Arc Story 17 opens with a caption that carries a retired line. The founder took the video off
// the site until that card is recut; it stays on the channels. A sweep that puts posted videos on their topic
// pages must not bring the old cut back. Remove this test when the recut file goes in.
test("the fitness-and-survival video stays off the site until it is recut", () => {
  assert.ok(!VIDEOS.some((v) => v.slug === "arc-fitness-survival"), "arc-fitness-survival is back in videos.ts: only the recut may return, and this test goes with it");
});

// 16 Nov 2026: a search for "home blood pressure" missed the home BP video (its title says "BP"), and every
// YouTube link opened the channel's home page. Each video now carries the words on its screens, its own id on
// the channel, and, when it was made from one, the founder's post to read instead.
test("every video is searchable by what it says, and links to itself on YouTube and to its posts", () => {
  const words = JSON.parse(readFileSync(join(SRC, "data/videoWords.json"), "utf8"));
  for (const v of VIDEOS) {
    assert.ok((words[v.slug] ?? "").length >= 40, `${v.slug} has no words for the search: run verve-videos/tools/web_words.py`);
    if (v.youtube !== undefined) assert.match(v.youtube, /^[\w-]{11}$/, `${v.slug}: youtube is the video's own id, not a channel address`);
    if (v.posts?.substack) assert.match(v.posts.substack, /^https:\/\/(substack\.com\/@roplekarsudeep\/note\/c-\d+|roplekarsudeep\.substack\.com\/p\/[\w-]+)$/, `${v.slug}: substack`);
    if (v.posts?.x) assert.match(v.posts.x, /^https:\/\/x\.com\/RoplekarSudeep\/status\/\d+$/, `${v.slug}: x`);
  }
  const ids = VIDEOS.filter((v) => v.youtube).map((v) => v.youtube);
  assert.equal(new Set(ids).size, ids.length, "no two videos share a YouTube id");
  assert.ok(Object.keys(words).every((s) => VIDEOS.some((v) => v.slug === s)), "videoWords.json holds only the site's videos");
});
