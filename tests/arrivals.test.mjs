// Only what your device shares, on the website (src/my-health/derive/arrivals.ts): the app's list decides a row. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

const { arrivalsOf, leftOff, dropUnsent, shows, ROW_READING, HORIZON_READING, followable, pausedWords } = await import("../src/my-health/derive/arrivals.ts");
const { MARKERS } = await import("../src/my-health/horizon/derive.ts");

// The list as the app sends it for a band that writes six readings (the app's lib/arrivals arrivalList).
const LIST = {
  v: 1, day: "2026-11-14", store: "Apple Health",
  on: [{ key: "rhr", label: "Resting heart rate" }, { key: "steps", label: "Steps" }],
  off: [{ key: "hrv", label: "Night HRV", why: "WHOOP keeps it in its own app" }, { key: "sitting", label: "Sitting", why: "steps arrive as a day's total, not by the hour" }, { key: "cadence", label: "Step cadence", why: "no steps by the minute" }],
  devices: [{ name: "WHOOP", phone: false, readings: ["rhr", "steps"], sent: "06:52", quiet: false }],
  foot: "Three readings your WHOOP does not send are left off these cards.", show_all: false,
};
const week = (start, over = {}) => ({ week_start: start, source: "sync", synced_at: `${start}T05:00:00+00:00`, ...over });

test("the list is the newest one the app wrote; a row from an export or an older app carries none", () => {
  assert.equal(arrivalsOf([]), null);
  assert.equal(arrivalsOf(null), null);
  assert.equal(arrivalsOf([week("2026-11-02"), week("2026-11-09")]), null, "the app has sent no list: nothing changes");
  const older = { ...LIST, day: "2026-11-07" };
  assert.equal(arrivalsOf([week("2026-11-09", { reading_arrivals: LIST }), week("2026-11-02", { reading_arrivals: older })]).day, "2026-11-14");
  assert.equal(arrivalsOf([week("2026-11-09"), week("2026-11-02", { reading_arrivals: older })]).day, "2026-11-07", "the newest row that carries one");
  assert.equal(arrivalsOf([{ week_start: "2026-11-09", source: "export", reading_arrivals: LIST }]), null, "only the app's own rows");
  assert.equal(arrivalsOf([week("2026-11-09", { reading_arrivals: { v: 2, on: [], off: [] } })]), null, "a shape this site does not know is not read");
});

test("what is left off: the list's off side; nothing with no list, and nothing under Show them anyway", () => {
  assert.deepEqual([...leftOff(LIST)], ["hrv", "sitting", "cadence"]);
  assert.equal(leftOff(null).size, 0);
  assert.equal(leftOff({ ...LIST, show_all: true }).size, 0);
  assert.equal(shows(leftOff(LIST), "hrv"), false);
  assert.equal(shows(leftOff(LIST), "rhr"), true);
});

test("a row with no figure for a reading that does not arrive is dropped; a figure always stays", () => {
  const off = leftOff(LIST);
  const rows = [
    { label: "HRV", value: "—", note: "none from this writer" },
    { label: "Breathing", value: "14.2" },
    { label: "Blood pressure, 30-day mean", value: "—", note: "no cuff readings" },
    { label: "Sitting, average day", value: "—" },
    { label: "Cadence", value: "—" },
    { label: "Steps", value: "—", note: "no steps in the store" },
  ];
  assert.deepEqual(dropUnsent(rows, off).map((r) => r.label), ["Breathing", "Blood pressure, 30-day mean", "Steps"]);
  // Blood pressure is the person's own: it keeps its row and its reason whatever is worn.
  // Steps arrive: a week with none is a gap, and says so.
  assert.deepEqual(dropUnsent([{ label: "HRV", value: "48" }, { label: "Sitting", value: "9.5" }], off).map((r) => r.label), ["HRV", "Sitting"], "a past figure is the fact");
  assert.equal(dropUnsent(rows, new Set()).length, rows.length, "no list: every row, as before");
});

test("every row the map names is a reading of the app's list, and nothing the person supplies is on it", () => {
  const readings = new Set(["vo2max", "rhr", "hrv", "breathing", "spo2", "temp", "sleepHours", "sleepStages", "sleepEfficiency", "sessionHR", "hrr", "pal", "sitting", "background", "steps", "cadence"]);
  for (const [label, key] of Object.entries(ROW_READING)) assert.ok(readings.has(key), `${label} → ${key}`);
  for (const own of ["Blood pressure, 30-day mean", "Weight", "LDL", "Strength", "Zone 2", "Weekly dose"]) assert.equal(ROW_READING[own], undefined, own);
});

test("Horizon offers only goals that can be followed; what the person supplies is always offered", () => {
  const off = leftOff(LIST);
  assert.equal(followable(off, "hrv"), false);
  assert.equal(followable(off, "sitting"), false);
  assert.equal(followable(off, "cadence"), false);
  assert.equal(followable(off, "rhr"), true);
  for (const own of ["mets", "vo2", "dose", "zone2_week", "strength_week", "bp", "weight", "waist", "grip", "ldl", "apob"]) assert.equal(followable(off, own), true, own);
  // with no list every goal is offered, as before
  for (const m of MARKERS) assert.equal(followable(leftOff(null), m.key), true, m.key);
  // every goal the map names is a marker Horizon has
  const keys = new Set(MARKERS.map((m) => m.key));
  for (const k of Object.keys(HORIZON_READING)) assert.ok(keys.has(k), k);
});

test("a goal already set on a reading that stops arriving is kept, and says it is paused", () => {
  assert.equal(pausedWords(LIST, "rhr"), null);
  assert.equal(pausedWords(LIST, "weight"), null);
  assert.equal(pausedWords(LIST, "hrv"), "Paused · nothing is sending this reading");
  const stopped = { ...LIST, off: [{ key: "hrv", label: "Night HRV", why: "WHOOP keeps it in its own app", last: "24 Oct" }] };
  assert.equal(pausedWords(stopped, "hrv"), "Paused · nothing has arrived since 24 Oct");
  assert.equal(pausedWords(null, "hrv"), null);
  assert.equal(pausedWords({ ...stopped, show_all: true }, "hrv"), null);
});
