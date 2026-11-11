// The public pages' fixed points (11 Nov 2026, the canvas "Verve on the web, rethought"): the bar, the footer,
// where the videos went, and the line that was retired. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NAV, FOOTER_LINKS, APP_SOCIAL, FOUNDER_SOCIAL, APP_HANDLE, ACCOUNT_PATH } from "../src/data/site.ts";
import { VIDEOS, videosInGroup } from "../src/data/videos.ts";
import { RETURNS } from "../src/data/returns.ts";

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

test("the footer writes the app's handle once, and names the founder's accounts as his", () => {
  assert.deepEqual(APP_SOCIAL.map((s) => s.label), ["Instagram", "TikTok", "YouTube"]);
  assert.ok(APP_SOCIAL.every((s) => s.handle === APP_HANDLE));
  assert.deepEqual(FOUNDER_SOCIAL.map((s) => s.label), ["X", "Substack"]);
});

test("every video has a home: a topic page, How it works, or the full list", () => {
  assert.equal(videosInGroup("how-verve-works").length, 6, "the six product videos sit on How it works");
  assert.ok(VIDEOS.every((v) => v.topic || v.group === "how-verve-works" || v.group === "wider-picture"));
});

test("what you come back for is four short lines", () => {
  assert.deepEqual(RETURNS.map((r) => r.cadence), ["Daily", "Weekly", "Quarterly", "Yearly"]);
  assert.ok(RETURNS.every((r) => r.line.split(/\s+/).length <= 7));
});

test("no page promises anything about how long a person will live", () => {
  const retired = [/predicts? how long/i, /how long (and how well )?you('ll| will)? live/i, /add years to your life/i, /live longer with verve/i];
  for (const f of files(SRC)) {
    const text = readFileSync(f, "utf8");
    for (const rx of retired) assert.ok(!rx.test(text), `${f.slice(SRC.length)} carries a retired line: ${rx}`);
  }
});
