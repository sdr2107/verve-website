// What a page says after an address is left, now that an address already on the list is answered
// (METTracker newsletter-welcome/again.ts; the founder, 21 November 2026). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LETTER_PRESS, accountAfter, addressWords, afterKind, letterAfter, letterComing, sheetAfter } from "../src/data/letter.ts";

const ASHA = "asha@example.com", RELAY = "abc123@privaterelay.appleid.com";
const KINDS = ["first", "again", "back", "on", "lately", "write", "failed", "later", "had", "stopped"];
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the function's answer is read as one outcome", () => {
  assert.equal(afterKind({ sent: true }, false), "first");
  assert.equal(afterKind({ sent: true, back: true }, false), "first");
  assert.equal(afterKind({ sent: true, again: true }, false), "again");
  assert.equal(afterKind({ sent: false, reason: "already sent", on: true, back: true }, false), "back");
  assert.equal(afterKind({ sent: false, reason: "already sent", on: true }, false), "on");
  assert.equal(afterKind({ sent: false, reason: "unsubscribed", lately: true, days: 7 }, false), "lately");
  assert.equal(afterKind({ sent: false, reason: "already sent", lately: true, days: 7 }, false), "lately");
  assert.equal(afterKind({ sent: false, reason: "unsubscribed", write: true }, false), "write");
  assert.equal(afterKind({ sent: false, reason: "not sent", again: true }, false), "failed");
});

test("the function as it answered before 21 November 2026 is still read", () => {
  assert.equal(afterKind({ sent: false, reason: "already sent" }, false), "had");
  assert.equal(afterKind({ sent: false, reason: "unsubscribed" }, false), "stopped");
  assert.equal(afterKind({ sent: false, reason: "copied in" }, false), "later");
});

test("no answer, or a call that failed, is a first letter for the daily retry", () => {
  assert.equal(afterKind(null, false), "later");
  assert.equal(afterKind(undefined, true), "later");
  assert.equal(afterKind({ sent: true }, true), "later");
  assert.equal(afterKind("ok", false), "later");
});

test("a letter is named as on its way only when one went", () => {
  assert.deepEqual(KINDS.filter(letterComing), ["first", "again", "later"]);
  for (const kind of KINDS) {
    const a = letterAfter(ASHA, kind);
    const promises = /on its way/.test(a.head + " " + a.text);
    assert.equal(promises, kind === "first" || kind === "again", kind);
  }
});

test("only a first letter is promised within a day", () => {
  for (const kind of KINDS) {
    const all = [letterAfter(ASHA, kind).text, sheetAfter(kind), accountAfter(ASHA, kind)].join(" ");
    assert.equal(/within a day/.test(all), kind === "later", kind);
  }
});

test("the Horizon box: the heading and the sentence, outcome by outcome", () => {
  assert.deepEqual(letterAfter(ASHA, "first"), { head: "The first letter is on its way.", text: `To ${ASHA}, from hello@verve-app.health. ${LETTER_PRESS}` });
  assert.deepEqual(letterAfter(ASHA, "again"), { head: "A letter is on its way.", text: `To ${ASHA}, from hello@verve-app.health. ${LETTER_PRESS}` });
  assert.deepEqual(letterAfter(ASHA, "back"), { head: "The letter is on.", text: `It comes to ${ASHA} once a week. Nothing more is needed.` });
  assert.deepEqual(letterAfter(ASHA, "on"), { head: "You are on the list.", text: `${ASHA} is on the list already. The next letter comes to it.` });
  assert.deepEqual(letterAfter(ASHA, "write"), { head: "Not from this box.", text: `The letter cannot be started for ${ASHA} from here. Write to hello@verve-app.health.` });
  assert.deepEqual(letterAfter(ASHA, "failed"), { head: "The letter could not be sent.", text: `Nothing went to ${ASHA} just now. Reload this page and try again in a minute.` });
});

test("sent lately: the box says where to look and when another can go, in the function's own days", () => {
  assert.equal(letterAfter(ASHA, "lately", 7).text, `A letter with the press has gone to ${ASHA}. Look for it from hello@verve-app.health, in spam too. Another can be sent 7 days after it.`);
  assert.match(letterAfter(ASHA, "lately", 14).text, /Another can be sent 14 days after it\./);
  // a number that is missing or cannot be right falls back to 7
  for (const days of [undefined, 0, -3, 1000, "7", NaN]) assert.match(letterAfter(ASHA, "lately", days).text, /Another can be sent 7 days after it\./);
});

test("the sheet's box: the sheet is on the page whatever happened, and a copy is promised only when one went", () => {
  assert.equal(sheetAfter("first"), `A copy is on its way to your inbox, from hello@verve-app.health. ${LETTER_PRESS}`);
  for (const kind of ["again", "back", "on", "lately", "write", "failed", "stopped"]) assert.match(sheetAfter(kind), /^The link above is the sheet\./, kind);
  assert.match(sheetAfter("stopped"), /no copy was sent/);
  assert.match(sheetAfter("again"), /A letter with the press that starts the weekly letter is on its way/);
  for (const kind of ["back", "on", "lately", "write", "failed", "stopped"]) assert.doesNotMatch(sheetAfter(kind), /on its way/, kind);
});

test("My health: one sentence, and an address Apple made is never printed", () => {
  assert.equal(addressWords(RELAY), "the address Apple keeps for you");
  assert.equal(addressWords(ASHA), ASHA);
  assert.equal(accountAfter(ASHA, "first"), `Done. The first letter is on its way to ${ASHA}, from hello@verve-app.health.`);
  assert.equal(accountAfter(ASHA, "back"), `Done. The letter is on for ${ASHA}. The next one comes to it.`);
  assert.equal(accountAfter(RELAY, "back"), "Done. The letter is on for the address Apple keeps for you. The next one comes to it.");
  assert.equal(accountAfter(RELAY, "on"), "You are on the list already; the next letter comes to you.");
  assert.equal(accountAfter(ASHA, "later"), `Saved. The first letter to ${ASHA} could not go out just now; it goes within a day.`);
  for (const kind of KINDS) assert.doesNotMatch(accountAfter(RELAY, kind), /privaterelay/, kind);
});

test("the words use no dash as punctuation and never the word 'met'", () => {
  for (const kind of KINDS) {
    for (const s of [letterAfter(ASHA, kind).head, letterAfter(ASHA, kind).text, sheetAfter(kind), accountAfter(ASHA, kind), accountAfter(RELAY, kind)]) {
      assert.doesNotMatch(s, /[–—]/, kind);
      assert.doesNotMatch(s, /\bmet\b/i, kind);
    }
  }
});

test("each box reads the answer through the one reader, and promises nothing to a returning address until it has it", () => {
  const letterBox = read("../src/components/LetterBox.astro"), sheetBox = read("../src/components/SheetBox.astro"), page = read("../src/pages/my-health.astro");
  for (const [name, src] of [["LetterBox", letterBox], ["SheetBox", sheetBox], ["my-health", page]]) {
    assert.match(src, /afterKind\(data, !!fnErr\)/, name);
    assert.match(src, /const returning = (error|rowErr)\?\.code === "23505";/, name);
    // only a first letter is tried again within a day: a returning address that could not be reached is told so
    assert.match(src, /returning && kind === "later" \? "failed" : kind/, name);
  }
  assert.match(letterBox, /if \(returning\) \{ head\.textContent = "This address is on the list already\."; where\.textContent = "Checking what it needs…";/);
  assert.match(sheetBox, /if \(returning\) mail\.textContent = "The link above is the sheet\.";/);
  assert.match(page, /let said = accountAfter\(to, returning \? "failed" : "later"\);/);
  // the old sentences, written in each box by hand, are gone
  for (const src of [letterBox, sheetBox]) assert.doesNotMatch(src, /data\?\.reason === /);
});
