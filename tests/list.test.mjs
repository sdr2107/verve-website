// The letter's one list, as its reader's page counts it (board 29 of "Verve, Horizon as a programme"), and the word
// a post's link may carry (board 27). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { byDoor, byTag, countsOf, doorWords, listCsv, newest, readSubstackFile, stateOf, stateWords, weeksOf, whenWords } from "../src/my-health/list/list.ts";
import { LETTER_CONSENT, tagOf } from "../src/data/letter.ts";

// a row written at local noon on a day, so the day is the same in any zone the tests run in
const at = (day, time = "12:00:00") => new Date(`${day}T${time}`).toISOString();
const row = (id, day, o = {}) => ({ id, email: `${id}@example.com`, consented_at: at(day), source: "horizon", tag: null, confirmed_at: null, welcome_sent_at: null, unsubscribed_at: null, ...o });
// Thursday 19 November 2026; its week began on Monday the 16th
const TODAY = "2026-11-19";
const ROWS = [
  row("a", "2026-11-19", { tag: "clip-12" }),
  row("b", "2026-11-19", { source: "app", confirmed_at: at("2026-11-19") }),
  row("c", "2026-11-17", { tag: "clip-12", confirmed_at: at("2026-11-17") }),
  row("d", "2026-11-16", { source: "start", confirmed_at: at("2026-11-16") }),
  row("e", "2026-11-15", { tag: "thread-4", confirmed_at: at("2026-11-15"), unsubscribed_at: at("2026-11-18") }),
  row("f", "2026-11-09", { source: "my-health", confirmed_at: at("2026-11-09") }),
  row("g", "2026-10-06", { source: "substack", confirmed_at: at("2026-10-06") }),
];

test("a row is in exactly one state, and stopped wins over confirmed", () => {
  assert.equal(stateOf(ROWS[0]), "waiting");
  assert.equal(stateOf(ROWS[1]), "confirmed");
  assert.equal(stateOf(ROWS[4]), "stopped");
  assert.equal(stateWords(ROWS[0]), "Waiting for the press");
  assert.equal(stateWords(ROWS[1]), "Confirmed");
  assert.equal(stateWords(ROWS[4]), "Stopped 18 Nov");
});

test("the six figures add up: every row is confirmed, waiting or stopped", () => {
  const c = countsOf(ROWS, TODAY);
  assert.deepEqual(c, { all: 7, confirmed: 5, waiting: 1, stopped: 1, thisWeek: 4, lastWeek: 2, today: 2 });
  assert.equal(c.confirmed + c.waiting + c.stopped, c.all);
});

test("a week is Monday to Sunday: Sunday the 15th is last week, Monday the 16th is this week", () => {
  assert.equal(countsOf([row("x", "2026-11-15")], TODAY).lastWeek, 1);
  assert.equal(countsOf([row("x", "2026-11-16")], TODAY).thisWeek, 1);
  assert.equal(countsOf([row("x", "2026-11-08")], TODAY).lastWeek, 0, "two weeks back is neither");
  assert.deepEqual(countsOf([], TODAY), { all: 0, confirmed: 0, waiting: 0, stopped: 0, thisWeek: 0, lastWeek: 0, today: 0 });
});

test("twelve weeks, oldest first, the last one the week today is in", () => {
  const w = weeksOf(ROWS, TODAY);
  assert.equal(w.length, 12);
  assert.equal(w[11].monday, "2026-11-16");
  assert.equal(w[11].now, true);
  assert.equal(w[0].monday, "2026-08-31");
  assert.deepEqual(w.slice(-3).map((x) => x.count), [0, 2, 4]);
  assert.equal(w.find((x) => x.monday === "2026-10-05").count, 1);
  assert.equal(w.reduce((a, x) => a + x.count, 0), 7);
});

test("a row older than the twelve weeks is on the list and not in the bars", () => {
  const old = [row("x", "2026-01-05")];
  assert.equal(weeksOf(old, TODAY).reduce((a, x) => a + x.count, 0), 0);
  assert.equal(countsOf(old, TODAY).all, 1);
});

test("by door: largest first, in the page's words, and the counts add up to the list", () => {
  const d = byDoor(ROWS);
  assert.deepEqual(d.map((x) => [x.label, x.count]), [["The Horizon page", 3], ["/start and /sheet", 1], ["The app's question", 1], ["My health's question", 1], ["Substack, copied in", 1]]);
  assert.equal(d.reduce((a, x) => a + x.count, 0), ROWS.length);
  assert.equal(doorWords("a-door-from-later"), "a-door-from-later");
});

test("by post: only the Horizon page's rows, the word on the link, and the rows with none last", () => {
  const t = byTag([...ROWS, row("h", "2026-11-19")]);
  assert.equal(t.of, 4);
  assert.deepEqual(t.rows, [{ tag: "clip-12", count: 2 }, { tag: "thread-4", count: 1 }, { tag: null, count: 1 }]);
  assert.equal(t.rows.reduce((a, x) => a + x.count, 0), t.of);
  assert.deepEqual(byTag([]), { of: 0, rows: [] });
});

test("the newest rows first, and an address is found by any part of it", () => {
  assert.deepEqual(newest(ROWS).map((r) => r.id).slice(0, 3).sort(), ["a", "b", "c"].sort());
  assert.equal(newest(ROWS)[6].id, "g");
  assert.deepEqual(newest(ROWS, "  G@EXAMPLE ").map((r) => r.id), ["g"]);
  assert.deepEqual(newest(ROWS, "nobody"), []);
});

test("when a row was written, in the page's words", () => {
  const now = new Date("2026-11-19T15:00:00");
  assert.equal(whenWords(new Date("2026-11-19T14:59:40").toISOString(), now), "Just now");
  assert.equal(whenWords(new Date("2026-11-19T14:59:00").toISOString(), now), "1 minute ago");
  assert.equal(whenWords(new Date("2026-11-19T14:56:00").toISOString(), now), "4 minutes ago");
  assert.equal(whenWords(new Date("2026-11-19T09:12:00").toISOString(), now), "Today, 09:12");
  assert.equal(whenWords(new Date("2026-11-18T09:12:00").toISOString(), now), "Wed 18 Nov");
  assert.equal(whenWords(new Date("2025-12-31T09:12:00").toISOString(), now), "Wed 31 Dec 2025");
  assert.equal(whenWords("not a date", now), "");
});

test("the file that goes out: one line an address, and nothing a spreadsheet would run", () => {
  const csv = listCsv([row("a", "2026-11-19", { tag: "clip-12" }), { ...row("b", "2026-11-18"), email: '=cmd|"x"@example.com' }]);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[0], "address,state,door,post,written,confirmed,stopped");
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith("a@example.com,waiting,horizon,clip-12,"));
  assert.ok(lines[2].startsWith(`"'=cmd|""x""@example.com",waiting,horizon,,`), lines[2]);
  assert.equal(csv.includes("token"), false);
});

test("Substack's file: the address and the day, emails switched off left out, twice taken once", () => {
  const file = [
    "email,active_subscription,expiry,plan,email_disabled,created_at",
    "One@Example.com,false,,,false,2026-10-06T10:00:00.000Z",
    '"two@example.com",false,,,true,2026-10-07T10:00:00.000Z',
    "one@example.com,false,,,false,2026-10-08T10:00:00.000Z",
    "not an address,false,,,false,2026-10-08T10:00:00.000Z",
    "three@example.com,false,,,false,nonsense",
    "",
  ].join("\r\n");
  const r = readSubstackFile("﻿" + file);
  assert.deepEqual(r.rows, [{ email: "one@example.com", subscribed_at: "2026-10-06T10:00:00.000Z" }, { email: "three@example.com", subscribed_at: null }]);
  assert.deepEqual([r.off, r.twice, r.bad], [1, 1, 1]);
});

test("a file with no heading: the first column that holds an address", () => {
  const r = readSubstackFile("Asha R,asha@example.com\nImran K,imran@example.com\n");
  assert.deepEqual(r.rows.map((x) => x.email), ["asha@example.com", "imran@example.com"]);
  assert.deepEqual(readSubstackFile(""), { rows: [], off: 0, bad: 0, twice: 0 });
  assert.equal(readSubstackFile("name,city\nAsha,Pune\n").rows.length, 0);
});

test("the word on a post's link: lower case, digits and dashes, or no word at all", () => {
  assert.equal(tagOf("?from=clip-12"), "clip-12");
  assert.equal(tagOf("?x=1&from=Thread-4"), "thread-4");
  assert.equal(tagOf("?from=clip 12"), null);
  assert.equal(tagOf("?from=-clip"), null);
  assert.equal(tagOf("?from=" + "a".repeat(41)), null);
  assert.equal(tagOf("?from=" + "a".repeat(40)), "a".repeat(40));
  assert.equal(tagOf("?from=<script>"), null);
  assert.equal(tagOf(""), null);
  assert.equal(tagOf("?utm_source=x"), null);
});

test("the sentence beside the button says how often, and how to stop", () => {
  assert.match(LETTER_CONSENT, /one a week/);
  assert.match(LETTER_CONSENT, /Unsubscribe/);
  assert.ok(LETTER_CONSENT.length >= 20 && LETTER_CONSENT.length <= 600, "the database's own limits");
});
