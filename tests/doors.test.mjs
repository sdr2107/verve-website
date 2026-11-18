// A reading that is not there: where it is added, how it stands, and when the phone last sent anything (board 21 of
// "Verve, Horizon as a programme"). `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { doorsFor, doorsInWords, storeOf, stateOf, ageWords, lastSyncOf, syncNote, OLD_AFTER_DAYS, SYNC_QUIET_DAYS } from "../src/my-health/horizon/doors.ts";
import { MARKERS } from "../src/my-health/horizon/derive.ts";

const iphone = { store: "apple", synced: true }, android = { store: "connect", synced: true }, unknown = { store: null, synced: true }, noApp = { store: null, synced: false };
const heads = (m, who) => doorsFor(m, who).map((d) => d.head);
const text = (m, who) => doorsFor(m, who).map((d) => `${d.head}: ${d.words}`).join(" | ");

test("the phone's health store is the one the app names", () => {
  assert.equal(storeOf({ store: "Apple Health" }), "apple");
  assert.equal(storeOf({ store: "Health Connect" }), "connect");
  assert.equal(storeOf(null), null);
  assert.equal(storeOf({ store: "" }), null);
});

test("weight and waist name the health store first, and the website takes neither", () => {
  assert.deepEqual(heads("weight", iphone), ["In Apple Health · first", "In the app"]);
  assert.match(text("weight", iphone), /Browse › Body Measurements › Weight\. From there it reaches Verve and every other app that reads it\./);
  assert.deepEqual(heads("weight", android), ["In Health Connect · first", "In the app"]);
  assert.match(text("weight", android), /Google Fit once Fit's sync with Health Connect is on/);
  assert.deepEqual(heads("waist", iphone), ["In Apple Health · first", "In the app"]);
  assert.match(text("waist", iphone), /Waist Circumference/);
  for (const m of ["weight", "waist"]) for (const who of [iphone, android, unknown]) assert.ok(!doorsFor(m, who).some((d) => d.key === "page"), `${m}: no door on the website`);
});

test("only the doors that exist for the phone are named: Health Connect has no waist, no recovery reading, no fitness estimate", () => {
  assert.deepEqual(heads("waist", android), ["In the app"]);
  assert.match(text("waist", android), /Body › Metabolic › Waist\. Health Connect has no place for waist/);
  assert.deepEqual(heads("hrr", android), ["In Settings › Devices"]);
  assert.deepEqual(heads("hrr", iphone), ["In Apple Health", "In Settings › Devices"]);
  assert.ok(!doorsFor("mets", android).some((d) => d.key === "health"));
  assert.ok(doorsFor("mets", iphone).some((d) => d.key === "health" && /Apple Watch's estimate/.test(d.words)));
  // with no list from the app, the page does not guess the phone: it names both stores, and says which holds what
  assert.deepEqual(heads("weight", unknown), ["In Apple Health or Health Connect · first", "In the app"]);
  assert.deepEqual(heads("waist", unknown), ["In Apple Health, on an iPhone · first", "In the app"]);
  assert.match(text("waist", unknown), /On an Android phone this is the only place/);
});

test("a reading a device counts cannot be typed, and says where to see what the device sends", () => {
  for (const m of ["steps", "sitting", "sleep", "rhr", "hrv", "spo2"]) {
    assert.deepEqual(doorsFor(m, iphone).map((d) => d.key), ["health", "devices"], m);
    assert.match(text(m, iphone), /cannot be typed/, m);
  }
  assert.equal(doorsFor("hrv", iphone)[1].go, "devices");
});

test("the app's own tests, sessions, and the shelves the app types a value on", () => {
  assert.equal(text("grip", iphone), "In the app: Body › Muscle › Grip strength. One of the app's own tests. It needs a hand dynamometer.");
  assert.equal(text("gait_speed", iphone), "In the app: Body › Muscle › Walk speed. One of the app's own tests.");
  assert.equal(text("balance", android), "In the app: Body › Muscle › Single-leg balance. One of the app's own tests.");
  assert.deepEqual(heads("sessions_week", iphone), ["In Apple Health", "In the app"]);
  assert.match(text("zone2_week", android), /Exercise sessions recorded by a watch or a phone/);
  assert.match(text("bp", iphone), /Body › Metabolic › Blood pressure, systolic\. Typed by hand\./);
  assert.match(text("almi", iphone), /DXA scan/);
});

test("a blood marker's doors: a lab report on this page, or a value typed in the app", () => {
  const d = doorsFor("ldl", iphone);
  assert.deepEqual(d.map((x) => x.key), ["page", "app"]);
  assert.equal(d[0].go, "body");
  assert.match(d[0].words, /Add a lab report/);
  assert.match(d[1].words, /^Body › Heart › LDL\./);
  assert.match(text("hba1c", android), /Body › Metabolic › HbA1c\./);
});

test("someone with no app is shown the app, and nothing else is asked of them", () => {
  assert.deepEqual(doorsFor("steps", noApp).map((d) => [d.key, d.go]), [["get", "get"]]);
  assert.deepEqual(doorsFor("weight", noApp).map((d) => d.key), ["get"]);
  // a lab report and a typed fitness test need no app
  assert.deepEqual(doorsFor("ldl", noApp).map((d) => d.key), ["page"]);
  assert.deepEqual(doorsFor("mets", noApp).map((d) => d.key), ["page", "get"]);
});

test("every marker of the catalogue has a door for every kind of phone, and none promises, judges or asks for a test again", () => {
  for (const m of MARKERS) for (const who of [iphone, android, unknown, noApp]) {
    const doors = doorsFor(m.key, who);
    assert.ok(doors.length >= 1, `${m.key}`);
    for (const d of doors) {
      assert.ok(d.head && d.words, m.key);
      assert.doesNotMatch(`${d.head} ${d.words}`, /should|must|test again|retest|overdue|time to|remind|recommended|—/i, `${m.key}: ${d.words}`);
    }
  }
  assert.deepEqual(doorsFor("not_a_marker", iphone), []);
});

test("the doors in a few words, for a line with no room for the tiles", () => {
  assert.equal(doorsInWords(doorsFor("waist", iphone)), "Apple Health, or the app");
  assert.equal(doorsInWords(doorsFor("grip", iphone)), "the app");
  assert.equal(doorsInWords(doorsFor("ldl", iphone)), "this page, or the app");
  assert.equal(doorsInWords(doorsFor("mets", iphone)), "the app, this page, or Apple Health");
  assert.equal(doorsInWords([]), "");
});

test("a reading is from a while ago past ninety days, and only one a person takes now and then", () => {
  assert.equal(OLD_AFTER_DAYS, 90);
  assert.equal(stateOf("weight", { on: "2026-09-02" }, "2026-11-18"), "on_file");   // 77 days
  assert.equal(stateOf("weight", { on: "2026-08-01" }, "2026-11-18"), "old");
  assert.equal(stateOf("waist", null, "2026-11-18"), "missing");
  assert.equal(stateOf("hrv", null, "2026-11-18", false), "not_sent");
  // a nightly average and a weekly count are as fresh as the phone's last sync, which is said once, apart
  assert.equal(stateOf("rhr", { on: "2026-06-01" }, "2026-11-18"), "on_file");
  assert.equal(stateOf("dose", { on: "2026-06-01" }, "2026-11-18"), "on_file");
  // a blood marker is never called old: Verve asks nobody for a blood test
  assert.equal(stateOf("ldl", { on: "2024-01-01" }, "2026-11-18"), "on_file");
});

test("an age is said in words, and is all that is said", () => {
  assert.equal(ageWords("2026-11-18", "2026-11-18"), "today");
  assert.equal(ageWords("2026-11-17", "2026-11-18"), "yesterday");
  assert.equal(ageWords("2026-11-09", "2026-11-18"), "nine days ago");
  assert.equal(ageWords("2026-09-02", "2026-11-18"), "eleven weeks ago");
  assert.equal(ageWords("2026-02-18", "2026-11-18"), "nine months ago");
  assert.equal(ageWords("2024-10-18", "2026-11-18"), "two years ago");
});

test("the phone's last sync is named past three days, and not before", () => {
  const weeks = [{ week_start: "2026-11-02", source: "sync", synced_at: "2026-11-09T06:00:00Z" }, { week_start: "2026-10-26", source: "sync", synced_at: "2026-11-02T06:00:00Z" }, { week_start: "2026-11-09", source: "import", synced_at: "2026-11-17T06:00:00Z" }];
  assert.equal(SYNC_QUIET_DAYS, 3);
  assert.equal(lastSyncOf(weeks), "2026-11-09T06:00:00Z");
  const note = syncNote(weeks, true, new Date("2026-11-18T08:00:00Z"));
  assert.equal(note.days, 9);
  assert.equal(note.lead, "Your phone last sent its readings nine days ago.");
  assert.match(note.words, /Open Verve on your phone: it sends when it opens\./);
  assert.equal(syncNote(weeks, true, new Date("2026-11-12T08:00:00Z")), null, "three days: nothing is said");
  assert.equal(syncNote(weeks, true, new Date("2026-11-13T08:00:00Z")).days, 4);
  // an account whose app has never written says so; someone with no app is told nothing here
  assert.equal(syncNote([], true, new Date("2026-11-18T08:00:00Z")).lead, "Nothing has arrived from the app yet.");
  assert.equal(syncNote(weeks, false, new Date("2026-11-18T08:00:00Z")), null);
});
