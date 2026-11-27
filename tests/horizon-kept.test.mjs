// Horizon draws at once, and stays where it is (the founder, 27 November 2026: "the app is slow to load at places and
// glitches"; "When i click from this week to past weeks - the screen moves up and thats not good to see").
//
// src/my-health/horizon/kept.ts keeps the server's last answer in this browser, one row an account and a person, and
// the page opens on it when it was kept today. Every figure below is made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readKept, writeKept, forgetKept } from "../src/my-health/horizon/kept.ts";
import { forget, remember, recall } from "../src/my-health/known.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
/** A browser's storage, with the two things forgetKept needs to walk it. */
const store = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, keys: () => [...m.keys()] };
};
const TODAY = "2026-11-27", ASHA = "user-asha", RAVI = "user-ravi", SELF = "person-1";
const HORIZON = { id: "h-1", title: "Build fitness, 3 months", starts_on: "2026-11-09", ends_on: "2027-02-09", closed_at: null,
  targets: [{ id: "t-1", marker: "steps", label: "Steps a day", unit: "steps", start_value: 6400, target_value: 7000 }], plan: null, checkins: [], programme: { v: 1, goal: "build_fitness" } };

test("what the server last said is kept for the account and the person, and read back the same day", () => {
  const s = store();
  assert.equal(readKept(ASHA, SELF, TODAY, s), null, "a first visit: nothing kept");
  writeKept(ASHA, SELF, TODAY, { horizons: [HORIZON], guide: true }, s);
  assert.deepEqual(readKept(ASHA, SELF, TODAY, s), { horizons: [HORIZON], guide: true });
  // no horizon at all is an answer too: the set-up is what the page then opens on
  writeKept(ASHA, "person-2", TODAY, { horizons: [], guide: false }, s);
  assert.deepEqual(readKept(ASHA, "person-2", TODAY, s), { horizons: [], guide: false });
  // the later answer replaces the earlier one
  writeKept(ASHA, SELF, TODAY, { horizons: [{ ...HORIZON, title: "Build fitness" }], guide: false }, s);
  assert.equal(readKept(ASHA, SELF, TODAY, s).horizons[0].title, "Build fitness"); assert.equal(readKept(ASHA, SELF, TODAY, s).guide, false);
});

test("never another account's copy, never another person's, and never another day's", () => {
  const s = store();
  writeKept(ASHA, SELF, TODAY, { horizons: [HORIZON], guide: true }, s);
  assert.equal(readKept(RAVI, SELF, TODAY, s), null, "another account on this browser");
  assert.equal(readKept(ASHA, "person-2", TODAY, s), null, "another person on the same account");
  // the document's own rule (store.ts readDocument, sameDay): yesterday's copy is not painted, the fresh one is waited for
  assert.equal(readKept(ASHA, SELF, "2026-11-28", s), null);
  assert.equal(readKept(ASHA, SELF, "2026-11-26", s), null);
  for (const nobody of [null, undefined, ""]) { assert.equal(readKept(nobody, SELF, TODAY, s), null); assert.equal(readKept(ASHA, nobody, TODAY, s), null); }
});

test("a row that is not the shape written is nothing, and storage that fails is not an error", () => {
  const s = store(), key = "mh-horizons-" + ASHA + ":" + SELF;
  for (const bad of ["", "not json", "null", "[]", JSON.stringify({ v: 2, day: TODAY, horizons: [HORIZON] }), JSON.stringify({ v: 1, day: TODAY, horizons: "x" }),
    JSON.stringify({ v: 1, day: TODAY, horizons: [{ id: "h-1" }] }), JSON.stringify({ v: 1, day: TODAY, horizons: [{ ...HORIZON, targets: null }] })]) {
    s.setItem(key, bad);
    assert.equal(readKept(ASHA, SELF, TODAY, s), null, bad.slice(0, 30));
  }
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); }, length: 1, key: () => { throw new Error("blocked"); } };
  assert.equal(readKept(ASHA, SELF, TODAY, broken), null);
  writeKept(ASHA, SELF, TODAY, { horizons: [HORIZON], guide: true }, broken);
  forgetKept(ASHA, broken);
  assert.equal(readKept(ASHA, SELF, TODAY, null), null); writeKept(ASHA, SELF, TODAY, { horizons: [], guide: false }, null); forgetKept(ASHA, null);
});

test("signing out forgets every person's copy of that account, and nobody else's", () => {
  const s = store();
  writeKept(ASHA, SELF, TODAY, { horizons: [HORIZON], guide: true }, s);
  writeKept(ASHA, "person-2", TODAY, { horizons: [], guide: false }, s);
  writeKept(RAVI, SELF, TODAY, { horizons: [HORIZON], guide: false }, s);
  remember(ASHA, { tester: true, team: false }, s); remember(RAVI, { tester: false }, s);
  // the page's two sign-out paths call known.ts forget: that one call drops the kept horizons with the rest
  forget(ASHA, s);
  assert.equal(readKept(ASHA, SELF, TODAY, s), null); assert.equal(readKept(ASHA, "person-2", TODAY, s), null);
  assert.deepEqual(recall(ASHA, s), {});
  assert.deepEqual(readKept(RAVI, SELF, TODAY, s), { horizons: [HORIZON], guide: false }); assert.deepEqual(recall(RAVI, s), { tester: false });
  assert.deepEqual(s.keys().filter((k) => k.includes(ASHA)), []);
  const page = read("../src/pages/my-health.astro");
  assert.equal((page.match(/if \(userId\) forgetKnown\(userId\);/g) ?? []).length, 2, "sign-out and deleting the account");
  // a storage with no way to walk it (a test double of the older kind) is left alone, not an error
  const plain = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  forgetKept(ASHA, plain); forget(ASHA, plain);
});

test("the page opens on the kept copy, the server's answer replaces it, and nothing that writes is pressed in between", () => {
  const view = read("../src/my-health/views/Horizon.tsx"), simple = read("../src/my-health/views/SimpleHorizon.tsx"), quick = read("../src/my-health/views/QuickSetup.tsx");
  // read in the same turn, for this account and this person, before anything is awaited
  assert.match(view, /const kept = readKept\(deps\.userId\?\.\(\) \|\| null, personId, today\);\n\s+if \(kept\) \{\n\s+keptShown\.current = true; setWaiting\(true\);/);
  assert.ok(view.indexOf("const kept = readKept(") < view.indexOf("const uid = (await userId()) ?? undefined;"), "before the first await of the read");
  // the fresh answer: shown, kept, and the page may be written on again
  assert.match(view, /keptShown\.current = false; setWaiting\(false\);\n\s+writeKept\(uid \?\? null, personId, today, \{ horizons: hs, guide \}\);/);
  // a failed read leaves the kept copy where it is, still not to be written on
  assert.match(view, /if \(!keptShown\.current\) setList\(\[\]\);/);
  // the horizons alone are not drawn: the person's figures must be there too
  assert.match(view, /if \(waiting && !person\) return calm;/);
  // what waits: Start, Settings' three controls, the new-test card, the zone write, and every older screen that writes
  assert.match(quick, /<button type="submit" disabled=\{busy \|\| waiting\} data-quick="start"/);
  assert.match(simple, /disabled=\{!weekly \|\| weeklyBusy \|\| waiting\}/);
  assert.match(simple, /disabled=\{!pause\.open \|\| waiting\}/);
  assert.match(simple, /disabled=\{deleting \|\| waiting\}/);
  assert.match(view, /if \(!simpleOn \|\| !owner \|\| !!h\.closed_at \|\| !programme \|\| !person \|\| waiting\) return null;/);
  assert.match(view, /if \(!owner \|\| closed \|\| h\.timezone \|\| waiting\) return;/);
  assert.match(view, /: waiting && \(showSetup \|\| \(!!current && isDone\(current\)\)\)\n\s+\? calm/);
  // and one quiet line says why, where a control is held
  assert.ok(simple.includes("Checking for changes…") && quick.includes("Checking your horizons…"));
});

test("a tab change leaves the page where it is: only a hidden page of 18 November opens at its top", () => {
  const view = read("../src/my-health/views/Horizon.tsx"), simple = read("../src/my-health/views/SimpleHorizon.tsx");
  assert.equal((view.match(/scrollIntoView/g) ?? []).length, 1, "one place, and it is behind the switch");
  assert.match(view, /if \(HORIZON_OLD_PAGES && isOldPage\(pg\)\) \{ try \{ document\.getElementById\("horizonroot"\)\?\.scrollIntoView/);
  assert.doesNotMatch(simple, /scrollIntoView|scrollTo\(/);
  // the only scrolls to the top left in the pane are where a wholly different screen opens: a horizon just started, or the set-up for the next one
  assert.equal((view.match(/window\.scrollTo\(\{ top: 0 \}\)/g) ?? []).length, 3);
});
