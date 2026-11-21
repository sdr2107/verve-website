// The weekly letter's page (board 32 of "Verve, Horizon as a programme"): what it works out around a letter.
// The email itself is drawn by the function, in the app repository; nothing here draws one. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  QUESTIONS, STEPS, checkLines, draftOf, furthest, goneOf, goneRow, halfwayOf, notReady, pastedWords, stoppedWords, subjectHint, tested, typedRight, wordsHash, wordsOf,
} from "../src/my-health/letter/letter.ts";

const L = (id, o = {}) => ({ id, subject: "What a MET is", preheader: "One unit.", body: "Head\n\nWords", created_at: "2026-11-19T09:00:00Z", updated_at: "2026-11-19T09:00:00Z", tested_at: null, tested_hash: null, send_started_at: null, send_finished_at: null, to_count: null, ...o });

test("five pages, one question each", () => {
  assert.deepEqual([...STEPS], ["Write", "See it", "Send yourself one", "Send", "After"]);
  assert.equal(QUESTIONS.length, 5);
  for (const q of QUESTIONS) assert.match(q, /\?$/);
});

test("the sum of the words is the function's sum: one fixed input is pinned in both repositories", async () => {
  assert.equal(wordsOf({ subject: "S", preheader: "P", body: "B" }), '["S","P","B"]');
  assert.equal(await wordsHash({ subject: "S", preheader: "P", body: "B" }), "9946b4dd9dde179491a66934cfe7758ed2243e5806fc53a8fdafc54996660d31");
  assert.equal(await wordsHash({ subject: " S ", preheader: "P ", body: "B\r\n" }), await wordsHash({ subject: "S", preheader: "P", body: "B" }), "spaces at the ends and Windows line ends are not a change");
  assert.notEqual(await wordsHash({ subject: "S", preheader: "P", body: "B." }), await wordsHash({ subject: "S", preheader: "P", body: "B" }));
});

test("a letter with no subject or no words cannot go on", () => {
  assert.equal(notReady({ subject: "", preheader: "", body: "words" }), "The letter has no subject.");
  assert.equal(notReady({ subject: "Subject", preheader: "", body: " " }), "The letter has no words.");
  assert.equal(notReady({ subject: "Subject", preheader: "", body: "words" }), "");
  assert.equal(subjectHint("What a MET is, and why your week is counted in them"), "51 characters. Most inboxes show about 60.");
  assert.equal(subjectHint(""), "Most inboxes show about 60 characters.");
});

test("which letter the page opens on: one that stopped halfway, else the draft", () => {
  const draft = L("d"), older = L("o", { created_at: "2026-11-01T09:00:00Z" });
  const sent = L("s", { send_started_at: "2026-11-12T09:00:00Z", send_finished_at: "2026-11-12T09:02:00Z", to_count: 142 });
  const half = L("h", { send_started_at: "2026-11-19T09:00:00Z", to_count: 171 });
  assert.equal(draftOf([sent, older, draft]).id, "d", "the newest letter that has not begun to go");
  assert.equal(draftOf([sent]), null);
  assert.equal(halfwayOf([sent, draft]), null);
  assert.equal(halfwayOf([sent, half, draft]).id, "h");
  assert.deepEqual(goneOf([draft, sent, half]).map((l) => l.id), ["h", "s"], "newest first, and a draft is not among them");
});

test("Send stays shut until a test of these exact words has gone", async () => {
  const words = { subject: "What a MET is", preheader: "One unit.", body: "Head\n\nWords" };
  const sum = await wordsHash(words);
  assert.equal(tested(L("d"), sum), false, "no test yet");
  assert.equal(tested(L("d", { tested_hash: sum }), sum), true);
  assert.equal(tested(L("d", { tested_hash: sum }), await wordsHash({ ...words, body: "Head\n\nWords, changed" })), false, "a word changed after the test");
  assert.equal(tested(L("d", { tested_hash: sum }), ""), false, "the sum is not worked out yet");
  assert.equal(furthest(L("d"), sum), 2, "an untested letter gets as far as the test");
  assert.equal(furthest(L("d", { tested_hash: sum }), sum), 3);
  assert.equal(furthest(L("d", { subject: "" }), sum), 0);
  assert.equal(furthest(L("s", { send_started_at: "2026-11-19T09:00:00Z" }), sum), 3, "a letter that stopped halfway opens on Send");
  assert.equal(furthest(L("s", { send_started_at: "2026-11-19T09:00:00Z", send_finished_at: "2026-11-19T09:02:00Z" }), sum), 4);
});

test("what 'See it' says before anything is sent", () => {
  const ok = checkLines({ subject_length: 51, subject_fits: true, links: [{ href: "https://verve-app.health/science/", ok: true }, { href: "https://verve-app.health/get", ok: true }], days_since_last: 7 });
  assert.deepEqual(ok, [{ warn: false, text: "Every link opens." }, { warn: false, text: "The subject fits a phone." }, { warn: false, text: "The last letter went 7 days ago." }]);
  const soon = checkLines({ subject_length: 72, subject_fits: false, links: [{ href: "https://example.com/gone", ok: false }], days_since_last: 5 });
  assert.deepEqual(soon.map((x) => x.warn), [true, true, true]);
  assert.equal(soon[0].text, "A link did not open just now: https://example.com/gone");
  assert.equal(soon[1].text, "The subject is 72 characters. Most inboxes show about 60.");
  assert.equal(soon[2].text, "The last letter went 5 days ago. The list was promised one a week.");
  assert.equal(checkLines({ subject_length: 10, subject_fits: true, links: [], days_since_last: null })[2].text, "No letter has gone from here before.");
  assert.match(checkLines({ subject_length: 10, subject_fits: true, links: [], days_since_last: 0 })[2].text, /went today\./);
});

test("the number typed has to be the number of confirmed addresses", () => {
  const a = { confirmed: 171, waiting: 34, stopped: 9 };
  assert.equal(typedRight("171", a), true);
  assert.equal(typedRight(" 171 ", a), true);
  for (const t of ["170", "214", "", "171.0", "one seven one", "-171"]) assert.equal(typedRight(t, a), false, t);
  assert.equal(typedRight("0", { confirmed: 0, waiting: 3, stopped: 0 }), false, "nobody confirmed: nothing to send");
  assert.equal(typedRight("171", null), false);
});

test("a send that stops says how many are still to go, and that nobody gets it twice", () => {
  assert.equal(stoppedWords(null, 0), "");
  assert.equal(stoppedWords("limit", 71), "The sender stopped: its allowance is used up for now. 71 addresses are still to go. Nobody who has had it gets it again.");
  assert.match(stoppedWords("refused_500", 1), /^The sender refused it\. 1 address is still to go\./);
  assert.match(stoppedWords("busy", 100), /^Another press is already sending this letter\./);
  assert.match(stoppedWords("could_not_mark", 100), /^It stopped on our side\./);
});

test("a count the sender has not reported is a dash, never a zero", () => {
  const sent = L("s", { send_started_at: "2026-11-19T09:00:00Z", send_finished_at: "2026-11-19T09:21:00Z", to_count: 171 });
  const quiet = goneRow(sent, { letter_id: "s", queued: 0, gone: 171, delivered: 0, bounced: 0, complained: 0, skipped: 0, unsubscribed: 0, reported: false });
  assert.equal(quiet.delivered, null); assert.equal(quiet.bounced, null); assert.equal(quiet.to, 171);
  const told = goneRow(sent, { letter_id: "s", queued: 0, gone: 171, delivered: 168, bounced: 2, complained: 1, skipped: 0, unsubscribed: 3, reported: true });
  assert.deepEqual([told.to, told.delivered, told.bounced, told.left], [171, 168, 2, 3]);
});

// a stand-in for the browser's nodes: an element, or text
const el = (name, kids = [], attrs = {}) => ({ nodeType: 1, nodeName: name, childNodes: kids, get textContent() { return kids.map((k) => k.textContent ?? "").join(""); }, getAttribute: (a) => attrs[a] ?? null });
const tx = (t) => ({ nodeType: 3, nodeName: "#text", textContent: t, childNodes: [] });

test("pasting from a web page keeps the paragraphs and the links, and drops the rest", () => {
  const pasted = el("BODY", [
    el("H1", [tx("One MET is what your body spends sitting still.")]),
    el("P", [tx("A brisk walk costs about four times that. See "), el("A", [tx("how the goal is set")], { href: "https://verve-app.health/science/" }), tx(".")]),
    el("FIGURE", [el("IMG", [], { src: "https://example.com/pixel.png" }), el("FIGCAPTION", [tx("A caption")])]),
    el("P", [el("STRONG", [tx("Bold")]), tx(" stays as words."), el("BR"), tx("A second line.")]),
    el("P", [el("A", [tx("javascript")], { href: "javascript:alert(1)" })]),
    el("SCRIPT", [tx("alert(1)")]),
    el("UL", [el("LI", [tx("First")]), el("LI", [tx("Second")])]),
  ]);
  assert.equal(pastedWords(pasted), [
    "One MET is what your body spends sitting still.",
    "A brisk walk costs about four times that. See [how the goal is set](https://verve-app.health/science/).",
    "Bold stays as words.\nA second line.",
    "javascript",
    "First",
    "Second",
  ].join("\n\n"));
});

// The wiring, read from the source.
const page = readFileSync(new URL("../src/my-health/views/TheLetter.tsx", import.meta.url), "utf8");
const team = readFileSync(new URL("../src/my-health/views/TesterPanel.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/my-health/letter/api.ts", import.meta.url), "utf8");
const out = readFileSync(new URL("../src/pages/unsubscribe.astro", import.meta.url), "utf8");

test("the page draws no email of its own: it shows what the function returns, in a frame that runs nothing", () => {
  assert.match(page, /<iframe title="The letter as it will arrive" sandbox="" srcdoc=\{seen\.html\}/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.match(api, /functions\/v1\/letter/);
});

test("the letter is the reader's third tab, beside the list", () => {
  assert.match(team, /tab\("list", "The list"\)\}\{tab\("letter", "The letter"\)\}\{tab\("notes", "Our notes"\)/);
  assert.match(team, /if \(reader && view === "letter"\)/, "drawn only for the account the database names");
});

test("Send is offered only after the test, and only for the number typed", () => {
  assert.match(page, /disabled=\{!tested\(letter, hashNow\)\} onClick=\{\(\) => setPage\(3\)\}>I have read it/);
  assert.match(page, /disabled=\{!typedRight\(typed, audience\) \|\| busy === "send"\}/);
});

test("the way out, pressed from a letter, says which letter, and still works on a database that cannot yet record it", () => {
  assert.match(out, /supabase\.rpc\("letter_unsubscribe", \{ token, letter: from \}\)/);
  assert.match(out, /if \(fromLetter && error\) \(\{ data, error \} = await supabase\.rpc\("newsletter_unsubscribe", \{ token \}\)\);/);
});
