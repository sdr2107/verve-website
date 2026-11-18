/**
 * A reading that is not there: say so, and say where it is added (canvas "Verve, Horizon as a programme", board 21;
 * built on the founder's word of 18 November 2026, for test accounts: "if those metrics are empty - there should be a
 * prompt given to the user to update these metrics - at the relevant places for each of them - what can be done in
 * the app, what can be done in Apple health / google health and what can be done on the website").
 *
 * For each marker this file names the doors a reading comes in by: the phone's health store (Apple Health, or Health
 * Connect, which Google Fit can write to), the app, this website, or the page that lists what a device sends. Only
 * the doors that exist for the person are named: a phone on Health Connect is not told about a place Health Connect
 * does not have. Weight and waist name the health store first (the founder, 18 November 2026: "it will flow from
 * there everywhere"), and the website takes neither.
 *
 * It also says when a reading is from a while ago, and when the phone last sent anything. It states an age and
 * nothing else: no "time to test again", no reminder, no count that nags. A blood marker is never called old, and its
 * doors are named only once a person has added it: Verve does not ask for a blood test. Nothing here fills a value in.
 *
 * What the health stores carry is what the app asks each of them for today (METTracker modules and
 * lib/health/android.ts, read on 18 November 2026): Health Connect has no waist and no recovery reading, and the app
 * asks it for no fitness estimate. The app's shelves are named as the app names them (lib/bodyList.ts: Metabolic,
 * Heart, Muscle).
 *
 * Pure, no DOM, no fetch; tests/doors.test.mjs runs it under node. Not copied into the horizon function.
 */
import { MARKER_BY_KEY, numberWord, type MarkerKey, type Reading } from "./derive.ts";
import { daysBetween } from "../derive/format.ts";

/** The phone's health store, as the app's own list names it ("Apple Health", "Health Connect"); null when the app has sent no list. */
export type Store = "apple" | "connect" | null;
export const storeOf = (list: { store?: unknown } | null | undefined): Store => {
  const s = String(list?.store ?? "").toLowerCase();
  return s.includes("apple") ? "apple" : s.includes("connect") ? "connect" : null;
};
const storeName = (s: Store) => (s === "apple" ? "Apple Health" : s === "connect" ? "Health Connect" : "Apple Health or Health Connect");

export type DoorKey = "health" | "app" | "page" | "devices" | "get";
export type Door = {
  key: DoorKey;
  /** The small head over the door: "In Apple Health · first". */ head: string;
  words: string;
  /** Somewhere the page can take the person: Body, Settings › Devices, the paper sheet, the page that gets the app. */ go?: "body" | "devices" | "sheet" | "get";
};
export type Who = { store: Store; /** The person has the app: an account of their own, so the app's rows exist. */ synced: boolean };

const SESSIONS = new Set(["dose", "zone2_week", "strength_week", "longest_session", "sessions_week", "vigorous_week"]);
const PHONE = new Set(["steps", "sitting", "background", "cadence", "pal"]);
const WORN = new Set(["sleep", "sri", "rhr", "hrv", "breathing", "spo2"]);
const TESTS = new Set(["grip", "chair_stands", "sppb", "gait_speed", "balance"]);
/** The app's Body shelf a marker is typed on. */
const SHELF: Record<string, string> = {
  waist: "Metabolic", bp: "Metabolic", hba1c: "Metabolic", fasting_glucose: "Metabolic", triglycerides: "Metabolic", hdl: "Metabolic",
  ldl: "Heart", apob: "Heart", hs_crp: "Heart", non_hdl: "Heart", remnant: "Heart",
  grip: "Muscle", chair_stands: "Muscle", sppb: "Muscle", gait_speed: "Muscle", balance: "Muscle", body_fat: "Muscle", almi: "Muscle", ffmi: "Muscle",
};
const FLOWS = "From there it reaches Verve and every other app that reads it.";
const DEVICES: Door = { key: "devices", head: "In Settings › Devices", words: "What your devices send, and why a reading is not here.", go: "devices" };

/**
 * The doors a marker's reading comes in by, the first choice first. Empty for a marker the catalogue does not know.
 * Someone with no app is shown one door, the app itself: every reading here but a lab report and a typed fitness
 * test comes from it.
 */
export function doorsFor(marker: string, who: Who): Door[] {
  const def = MARKER_BY_KEY[marker];
  if (!def) return [];
  const blood = def.kind === "blood";
  const page: Door = { key: "page", head: "On this page", words: "Body › Add a lab report. A PDF or a photo: it is read, and you check it.", go: "body" };
  const get: Door = { key: "get", head: "From the app", words: "This reading comes from the Verve app on a phone. The app is free to get.", go: "get" };
  if (!who.synced) return blood ? [page] : marker === "mets" ? [{ key: "page", head: "On this page", words: "Type a test's result or add its report, on the last page of this set-up. The paper sheet walks you through a six-minute walk.", go: "sheet" }, get] : [get];
  const s = who.store, health = `In ${storeName(s)}`;
  const app = (words: string): Door => ({ key: "app", head: "In the app", words });
  const shelf = SHELF[marker] ? `Body › ${SHELF[marker]} › ${def.label}.` : "";

  if (blood) return [page, app(`${shelf} A value typed by hand.`)];
  if (marker === "mets") return [
    app("Take a test: a six-minute walk, or a timed run."),
    { key: "page", head: "On this page", words: "Type a test's result or add its report, on the last page of this set-up. The paper sheet walks you through a six-minute walk.", go: "sheet" },
    ...(s !== "connect" ? [{ key: "health" as const, head: s === "apple" ? "In Apple Health" : "In Apple Health, on an iPhone", words: "An Apple Watch's estimate arrives by itself." }] : []),
  ];
  if (SESSIONS.has(marker)) return [
    { key: "health", head: health, words: `${s === "connect" ? "Exercise sessions" : "Workouts"} recorded by a watch or a phone arrive by themselves.` },
    app("Or log a session by hand."),
  ];
  if (PHONE.has(marker)) return [{ key: "health", head: health, words: "Counted by the phone or a watch. It cannot be typed." }, DEVICES];
  if (WORN.has(marker)) return [{ key: "health", head: health, words: `From a watch, band or ring that writes to ${storeName(s)}. It cannot be typed.` }, DEVICES];
  if (marker === "hrr") return s === "connect" ? [DEVICES] : [{ key: "health", head: s === "apple" ? "In Apple Health" : "In Apple Health, on an iPhone", words: "From an Apple Watch, after a workout. Health Connect carries no recovery reading." }, DEVICES];
  if (marker === "weight") return [
    { key: "health", head: `${health} · first`, words: `${s === "apple" ? "Step on a scale that writes to Health, or add it by hand: Browse › Body Measurements › Weight." : s === "connect" ? "A scale that writes to Health Connect, or typed into Google Fit once Fit's sync with Health Connect is on." : "A scale that writes to it, or the weight typed into it by hand."} ${FLOWS}` },
    app("Body › Weight. It stays in Verve."),
  ];
  if (marker === "waist") return s === "connect"
    ? [app(`${shelf} Health Connect has no place for waist, so on this phone it is typed here.`)]
    : [{ key: "health", head: s === "apple" ? "In Apple Health · first" : "In Apple Health, on an iPhone · first", words: `Browse › Body Measurements › Waist Circumference. ${FLOWS}` },
      app(`${shelf}${s === "apple" ? " It stays in Verve." : " On an Android phone this is the only place: Health Connect has no waist."}`)];
  if (marker === "bp") return [{ key: "health", head: health, words: `A cuff that writes to ${storeName(s)}, or a reading typed into it by hand.` }, app(`${shelf} Typed by hand.`)];
  if (marker === "body_fat" || marker === "ffmi") return [{ key: "health", head: health, words: `A body-composition scale that writes to ${storeName(s)}.` }, app(`${shelf} Typed from a scan's or a scale's report.`)];
  if (marker === "almi") return [app(`${shelf} Typed from a DXA scan's report.`)];
  if (TESTS.has(marker)) return [app(`${shelf} One of the app's own tests.${marker === "grip" ? " It needs a hand dynamometer." : ""}`)];
  return [app("Added in the app.")];
}
/** The doors named in a few words, for a line that has no room for the tiles: "Apple Health, or the app". */
export function doorsInWords(doors: Door[]): string {
  const names = doors.map((d) => d.head.replace(/^(In|On|From) /, "").replace(/ · first$/, "").replace(/, on an iPhone$/, " on an iPhone").replace(/^this page$/, "this page"));
  const uniq = names.filter((n, i) => names.indexOf(n) === i);
  return uniq.length <= 1 ? uniq[0] ?? "" : `${uniq.slice(0, -1).join(", ")}, or ${uniq[uniq.length - 1]}`;
}

// ── how a reading stands ──

/** Past this many days a measured reading is "from a while ago": the figure the set-up already uses for a fitness test (programme.ts FRESH_DAYS). */
export const OLD_AFTER_DAYS = 90;
export type ReadingState = "on_file" | "old" | "missing" | "not_sent";
/**
 * How a marker's reading stands for the set-up. Only a reading a person takes now and then can be "from a while ago":
 * a weekly count and a nightly average are as fresh as the phone's last sync, which the page says once, apart. A blood
 * marker is never called old: its age is its report's date, and Verve asks nobody for a blood test.
 */
export function stateOf(marker: string, now: Pick<Reading, "on"> | null, today: string, sending = true): ReadingState {
  if (!sending) return "not_sent";
  if (!now) return "missing";
  const def = MARKER_BY_KEY[marker];
  return def?.kind === "measured" && daysBetween(now.on, today) > OLD_AFTER_DAYS ? "old" : "on_file";
}
/** A reading's age in words, and nothing more: "eleven weeks ago". */
export function ageWords(on: string, today: string): string {
  const days = Math.max(0, daysBetween(on, today));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${numberWord(days)} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 26) return `${numberWord(weeks)} weeks ago`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${numberWord(months)} months ago`;
  return `${numberWord(Math.round(days / 365.25))} years ago`;
}
export const STATE_WORDS: Record<ReadingState, string> = { on_file: "on file", old: "from a while ago", missing: "not on file", not_sent: "not on file" };

// ── the phone's last sync ──

/** Past this many days the page says when the phone last sent its readings. Under it, it says nothing. */
export const SYNC_QUIET_DAYS = 3;
/** The last time the app wrote: the newest week row it synced (its week row is written on every sync, for any signed-in account). Null when it never has. */
export function lastSyncOf(weeks: readonly any[] | null | undefined): string | null {
  let last: string | null = null;
  for (const w of weeks ?? []) if (w && w.source === "sync" && w.synced_at && (!last || String(w.synced_at) > last)) last = String(w.synced_at);
  return last;
}
/**
 * The line about the phone's last sync, or null when there is nothing to say: the person has no app, or it wrote
 * within the last three days. `now` is the moment the page is read; the days are whole days between the two.
 */
export function syncNote(weeks: readonly any[] | null | undefined, synced: boolean, now: Date): { days: number | null; lead: string; words: string } | null {
  if (!synced) return null;
  const last = lastSyncOf(weeks);
  if (!last) return { days: null, lead: "Nothing has arrived from the app yet.", words: "Open Verve on your phone, signed in to this account: it sends when it opens." };
  const then = new Date(last).getTime();
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  if (days <= SYNC_QUIET_DAYS) return null;
  return { days, lead: `Your phone last sent its readings ${numberWord(days)} days ago.`, words: "Open Verve on your phone: it sends when it opens. Sessions, steps and sleep since then are not here yet." };
}
