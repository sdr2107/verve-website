// When a person's figures are from, and when the page reads them again (25 November 2026). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lastAppSync, asOfWords, asOfLine, rereadDue, REREAD_MIN_MS } from "../src/my-health/derive/asOf.ts";

const NOW = new Date("2026-11-25T17:04:00Z");

test("the last sync is the newest stamp among the rows the app wrote", () => {
  const weeks = [
    { source: "sync", week_start: "2026-11-16", synced_at: "2026-11-22T05:10:00Z" },
    { source: "sync", week_start: "2026-11-23", synced_at: "2026-11-25T16:41:00Z" },
    { source: "export", week_start: "2026-11-09", synced_at: "2026-11-25T16:59:00Z" },   // an export is not the app's sync
    { source: "sync", week_start: "2026-11-02", synced_at: null },
    { source: "sync", week_start: "2026-10-26", synced_at: "not a date" },
  ];
  assert.equal(lastAppSync(weeks), "2026-11-25T16:41:00.000Z");
});

test("no row from the app: nothing to date", () => {
  assert.equal(lastAppSync([]), null);
  assert.equal(lastAppSync(null), null);
  assert.equal(lastAppSync(undefined), null);
  assert.equal(lastAppSync([{ source: "export", synced_at: "2026-11-25T16:59:00Z" }]), null);
});

test("today, yesterday, and a named day, in the zone given", () => {
  assert.equal(asOfWords("2026-11-25T16:41:00Z", NOW, "UTC"), "today at 16:41");
  assert.equal(asOfWords("2026-11-24T07:12:00Z", NOW, "UTC"), "yesterday at 07:12");
  assert.equal(asOfWords("2026-11-21T09:00:00Z", NOW, "UTC"), "on Saturday 21 November");
});

test("the day is the reader's day, not the server's", () => {
  // 20:41 in Dubai is 16:41 UTC; 01:30 in Dubai on the 25th is still the 24th in UTC
  assert.equal(asOfWords("2026-11-25T16:41:00Z", NOW, "Asia/Dubai"), "today at 20:41");
  assert.equal(asOfWords("2026-11-24T21:30:00Z", NOW, "Asia/Dubai"), "today at 01:30");
  assert.equal(asOfWords("2026-11-24T21:30:00Z", NOW, "UTC"), "yesterday at 21:30");
});

test("the line: the owner is told how to bring it up to date, a viewer is not", () => {
  assert.equal(asOfLine("2026-11-25T16:41:00Z", NOW, true, "UTC"), "Figures as of the app's last sync, today at 16:41. Open the app to send what is new.");
  assert.equal(asOfLine("2026-11-25T16:41:00Z", NOW, false, "UTC"), "Figures as of the app's last sync, today at 16:41.");
  assert.equal(asOfLine(null, NOW, true, "UTC"), null);
});

test("a return to the tab reads again once the last read is a minute old", () => {
  const base = { visible: true, signedIn: true, hasDocument: true, typing: false, lastMs: 1_000_000 };
  assert.equal(rereadDue({ ...base, nowMs: 1_000_000 + REREAD_MIN_MS }), true);
  assert.equal(rereadDue({ ...base, nowMs: 1_000_000 + REREAD_MIN_MS - 1 }), false);
});

test("never while hidden, signed out, with nothing in hand, or while a field has the caret", () => {
  const due = { visible: true, signedIn: true, hasDocument: true, typing: false, lastMs: 0, nowMs: 10 * REREAD_MIN_MS };
  assert.equal(rereadDue(due), true);
  assert.equal(rereadDue({ ...due, visible: false }), false);
  assert.equal(rereadDue({ ...due, signedIn: false }), false);
  assert.equal(rereadDue({ ...due, hasDocument: false }), false);
  assert.equal(rereadDue({ ...due, typing: true }), false);
});

// The fault of 25 November 2026: the view imported asOfLine and already had a helper of that name inside View,
// so the call above the helper read a name that did not exist yet and the horizon's page stopped drawing.
// The build and the other tests passed; only the type check saw it. Every name a view takes from derive/asOf
// must be one that nothing else in that file declares.
test("the Horizon view takes the sentence under a name nothing else in the file declares", () => {
  const src = readFileSync(new URL("../src/my-health/views/Horizon.tsx", import.meta.url), "utf8");
  const line = src.match(/import \{([^}]+)\} from "\.\.\/derive\/asOf\.ts";/);
  assert.ok(line, "the view imports from derive/asOf");
  const names = line[1].split(",").map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean);
  assert.ok(names.length >= 2);
  for (const name of names) {
    const declared = new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b`).test(src);
    assert.equal(declared, false, `${name} is imported from derive/asOf and declared again in the view`);
    assert.ok(new RegExp(`\\b${name}\\(`).test(src), `${name} is imported and never called`);
  }
});
