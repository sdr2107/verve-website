/**
 * A fitness test, typed on the website or read from a report (canvas "Verve, Horizon as a programme", board 16; the
 * founder, 17 November 2026: "ability to enter values in a card and/or upload reports and they parse and sync to the
 * horizon page", and "if the device does not send the watch estimate of VO2max, allow the user to type it in").
 *
 * What is here: the fields of each test turned into METs, the row the reading is kept as, and the reader's answer for
 * a treadmill or mask-test report made safe to show. Nothing here is a second equation. A walk or a run is worked
 * out by the app's own functions, copied word for word (../../vendor/app/crfEquations.ts, tools/sync-app-equations.mjs),
 * so a result typed here and one logged in the app give the same METs. A mask test and a watch's estimate need no
 * equation: oxygen in ml per kg per minute is divided by 3.5. The METs a treadmill report prints are kept as printed.
 *
 * The reading is filed where the app files its own tests (public.crf_entries), so there is one list of fitness
 * readings, not two, and the app picks it up on its next sync. The tier is read from the app's own tables
 * (../../data/fitness-tiers.ts) and kept under the app's own names.
 *
 * Pure, no DOM, no fetch; tests/fitness-entry.test.mjs runs it under node.
 */
import { ENTRY_METHOD, type EntryKey } from "../../data/programme.ts";
import { tierFor } from "../../data/fitness-tiers.ts";
import { ML_PER_MET } from "../../data/first-number.ts";
import { estimateCRFFrom1MileWalk, estimateCRFFrom1_5MileRun, estimateCRFFrom6MinuteWalk, estimateCRFFromBruceProtocol, estimateCRFFromCooperRun } from "../../vendor/app/crfEquations.ts";

/** What an equation needs to know about the person, each null where the page does not hold it. */
export type EntryProfile = { age: number | null; sex: "male" | "female" | null; weightKg: number | null; heightCm: number | null };
/** What can be typed. Which of these a test reads is in ENTRY_FIELDS. */
export type EntryFields = {
  /** The day of the test. */ date: string;
  /** Where it was done, in the person's words. */ where?: string | null;
  /** METs as a report prints them. */ mets?: number | null;
  /** Oxygen, ml per kg per minute: measured with a mask, or a watch's estimate. */ vo2?: number | null;
  /** A treadmill protocol's name, as printed. */ protocol?: string | null;
  /** A time, in minutes (9 minutes 12 seconds is 9.2). */ minutes?: number | null;
  /** A distance, in metres. */ metres?: number | null;
  /** Heart rate at the finish, beats a minute. */ heartRate?: number | null;
};
export type EntryField = "mets" | "vo2" | "protocol" | "minutes" | "metres" | "heartRate";
/** The fields each test shows, in order, with the words on them. */
export const ENTRY_FIELDS: Record<EntryKey, { field: EntryField; label: string; unit: string }[]> = {
  mask: [{ field: "vo2", label: "Peak oxygen, as the report prints it", unit: "ml/kg/min" }],
  walk6: [{ field: "metres", label: "Distance in six minutes", unit: "metres" }],
  walk1: [{ field: "minutes", label: "Time for the mile", unit: "min:s" }, { field: "heartRate", label: "Heart rate at the finish", unit: "beats a minute" }],
  cooper: [{ field: "metres", label: "Distance in twelve minutes", unit: "metres" }],
  run15: [{ field: "minutes", label: "Time for the mile and a half", unit: "min:s" }],
  treadmill: [{ field: "mets", label: "METs reached, as the report prints it", unit: "METs" }, { field: "protocol", label: "Or the protocol", unit: "" }, { field: "minutes", label: "And the time", unit: "min:s" }],
  watch: [{ field: "vo2", label: "The estimate your device shows", unit: "ml/kg/min" }],
};
/** "9:12" as 9.2 minutes; a plain number is minutes already. Null for anything else. */
export function minutesOf(text: string): number | null {
  const t = text.trim();
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  return t !== "" && Number.isFinite(Number(t)) && Number(t) > 0 ? Number(t) : null;
}
/** Minutes as "9:12". */
export const clockWords = (minutes: number): string => { const s = Math.round(minutes * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export type EntryResult =
  | { ok: true; mets: number; vo2: number; method: string; /** How the number was reached, for the card. */ how: string; distance: number | null }
  | { ok: false; why: string };
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const inside = (v: number | null | undefined, lo: number, hi: number): v is number => v != null && Number.isFinite(v) && v >= lo && v <= hi;
const WALK_SOURCE: Record<string, string> = {
  sagat2023: "The six-minute walk, by the equation for ages 60 and over (Šagát 2023), as the app works it out.",
  hong2019: "The six-minute walk, by the equation that reads your age, sex and weight (Hong 2019), as the app works it out.",
  cahalin1996: "The six-minute walk, from the distance alone (Cahalin 1996): your age, sex and weight are not on file, so the surer equation could not be used.",
};

/** A typed test turned into METs, or the reason it cannot be. Nothing is guessed: a missing field is asked for. */
export function entryResult(kind: EntryKey, f: EntryFields, p: EntryProfile, today: string): EntryResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date ?? "")) return { ok: false, why: "Give the day of the test." };
  if (f.date > today) return { ok: false, why: "The day of the test cannot be ahead of today." };
  const done = (mets: number, vo2: number, method: string, how: string, distance: number | null = null): EntryResult =>
    mets > 0 && mets <= 25 ? { ok: true, mets: round(mets, 2), vo2: round(vo2, 1), method, how, distance } : { ok: false, why: "Those figures give a number outside what a person can reach. Check them against the test." };
  const full = p.age != null && p.age > 0 && p.sex != null && p.weightKg != null && p.weightKg > 0 ? { age: p.age, sex: p.sex, weightKg: p.weightKg, ...(p.heightCm ? { heightCm: p.heightCm } : {}) } : null;
  switch (kind) {
    case "mask":
      if (!inside(f.vo2, 5, 95)) return { ok: false, why: "Type the peak oxygen the report prints, in ml per kg per minute." };
      return done(f.vo2 / ML_PER_MET, f.vo2, ENTRY_METHOD.mask, "Oxygen measured with a mask, divided by 3.5.");
    case "watch":
      if (!inside(f.vo2, 5, 95)) return { ok: false, why: "Type the estimate your device shows, in ml per kg per minute." };
      return done(f.vo2 / ML_PER_MET, f.vo2, ENTRY_METHOD.watch, "Your device's estimate, divided by 3.5. It is an estimate, not a test.");
    case "treadmill": {
      if (f.mets != null && Number.isFinite(f.mets)) {
        if (!inside(f.mets, 1, 25)) return { ok: false, why: "METs on a treadmill report run from about 2 to 20. Check the figure." };
        return done(f.mets, f.mets * ML_PER_MET, ENTRY_METHOD.treadmill, "The METs the report prints, kept as printed.");
      }
      if (f.minutes == null) return { ok: false, why: "Type the METs the report prints, or the Bruce protocol's time." };
      if (!/bruce/i.test(f.protocol ?? "") || /modif/i.test(f.protocol ?? "")) return { ok: false, why: "Only the standard Bruce protocol's time can be turned into METs. For any other, type the METs the report prints." };
      const mets = estimateCRFFromBruceProtocol(f.minutes);
      return mets > 0 ? done(mets, mets * ML_PER_MET, "bruce-protocol", "The Bruce protocol's time, by the equation the app uses.") : { ok: false, why: "That time is outside what the Bruce protocol's equation reads." };
    }
    case "walk6": {
      if (f.metres == null) return { ok: false, why: "Type how far you walked in six minutes, in metres." };
      const r = estimateCRFFrom6MinuteWalk(f.metres, full);
      return r.mets > 0 ? done(r.mets, r.vo2Max, ENTRY_METHOD.walk6, WALK_SOURCE[r.source], f.metres) : { ok: false, why: "That distance is outside what the walk's equation reads." };
    }
    case "walk1": {
      if (f.minutes == null || f.heartRate == null) return { ok: false, why: "Type the time for the mile and your heart rate at the finish." };
      if (!full) return { ok: false, why: "The one-mile walk's equation reads your age, sex and weight, and they are not all on file. Set them in the app first." };
      const r = estimateCRFFrom1MileWalk(f.minutes, f.heartRate, full);
      return r.mets > 0 ? done(r.mets, r.vo2Max, ENTRY_METHOD.walk1, "The one-mile walk, from your time and finishing heart rate (Kline 1987), as the app works it out.", 1609) : { ok: false, why: "Those figures are outside what the one-mile walk's equation reads: 8 to 30 minutes, and a heart rate of 60 to 220." };
    }
    case "cooper": {
      if (f.metres == null) return { ok: false, why: "Type how far you ran in twelve minutes, in metres." };
      const r = estimateCRFFromCooperRun(f.metres);
      return r.mets > 0 ? done(r.mets, r.vo2Max, ENTRY_METHOD.cooper, "The twelve-minute run, from the distance (Cooper 1968), as the app works it out.", f.metres) : { ok: false, why: "That distance is outside what the run's equation reads: 400 to 5,000 metres." };
    }
    case "run15": {
      if (f.minutes == null) return { ok: false, why: "Type your time for the mile and a half." };
      const r = estimateCRFFrom1_5MileRun(f.minutes, p.sex && p.weightKg ? { sex: p.sex, weightKg: p.weightKg } : null);
      return r.mets > 0 ? done(r.mets, r.vo2Max, ENTRY_METHOD.run15, r.source === "george1993" ? "The 1.5-mile run, from your time, sex and weight (George 1993), as the app works it out." : "The 1.5-mile run, from the time alone: your weight is not on file, so the surer equation could not be used.", 2414) : { ok: false, why: "That time is outside what the run's equation reads: 5 to 25 minutes." };
    }
  }
}

/** The five tiers under the app's own names (METTracker lib/types.ts CRFPerformanceCategory), in the tables' order. */
export const APP_TIERS = ["low", "below-average", "above-average", "high", "elite"] as const;
/** Where a reading came from, kept on its row. */
export const ENTRY_FROM = { typed: "Typed on verve-app.health", report: "Read from a report on verve-app.health", device: "Typed from the device's own app on verve-app.health" } as const;

/**
 * The row a reading is kept as, in the app's own table. An error in words when the tier cannot be read: the table
 * holds one for every reading, and the page does not invent it.
 */
export function crfRow(a: { id: string; userId: string; kind: EntryKey; fields: EntryFields; result: Extract<EntryResult, { ok: true }>; profile: EntryProfile; from: keyof typeof ENTRY_FROM; now: string }):
  { row: Record<string, unknown> } | { error: string } {
  const { profile: p, result: r } = a;
  const tier = p.age != null && p.sex != null ? tierFor(p.sex, p.age, r.mets) : null;
  if (!tier) return { error: "Your age and sex are not on file, so the reading's tier cannot be read. Set them in the app first, then type the result again." };
  const where = (a.fields.where ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return { row: {
    id: a.id, user_id: a.userId,
    // midday on the day of the test, so it stays that day in every time zone the app is likely to read it in
    timestamp: new Date(`${a.fields.date}T12:00:00`).toISOString(),
    met_capacity: r.mets, performance_category: APP_TIERS[tier.index], estimation_method: r.method,
    vo2_max_estimate: r.vo2,
    vo2_max_source: a.kind === "mask" ? "lab-test" : a.kind === "watch" ? "wearable-imputation" : "calculated-from-mets",
    wearable_vo2_max_disclaimer: a.kind === "watch" ? true : null,
    source_test: `${ENTRY_FROM[a.from]}${where ? ` · ${where}` : ""}`,
    distance_metres: r.distance, updated_at: a.now,
  } };
}
/** Whether a reading like this one is on file already: the same day, the same method, the same METs to one decimal. */
export function onFileAlready(crf: { measured_on?: unknown; method?: unknown; met_capacity?: unknown }[], date: string, method: string, mets: number): boolean {
  return crf.some((c) => String(c.measured_on ?? "").slice(0, 10) === date && String(c.method ?? "") === method && c.met_capacity != null && Math.round(Number(c.met_capacity) * 10) === Math.round(mets * 10));
}

// ── a treadmill or mask-test report, as the reader answered ──

/** What the reader took from an exercise-test report: only what the report prints, each null where it prints nothing. */
export type TestRead = {
  /** Oxygen was measured (a mask). */ mask: boolean;
  date: string | null; protocol: string | null; seconds: number | null; mets: number | null; peakVo2: number | null; peakHr: number | null; peakHrPercent: number | null;
  stopped: string | null;
  /** The report's own conclusion, word for word. Shown as the report's; used by nothing. */ conclusion: string | null;
};
const numOr = (x: unknown, lo: number, hi: number): number | null => (x != null && x !== "" && Number.isFinite(Number(x)) && Number(x) >= lo && Number(x) <= hi ? Number(x) : null);
const text = (x: unknown, max: number): string | null => (typeof x === "string" && x.trim() ? x.replace(/\s+/g, " ").trim().slice(0, max) : null);
/** The reader's answer made safe to show: numbers inside what a test can print, strings bounded, nothing added. Null when it is not an exercise test. */
export function parseTestRead(out: unknown): TestRead | null {
  const o = out && typeof out === "object" ? (out as Record<string, unknown>) : null;
  const t = o?.exercise_test && typeof o.exercise_test === "object" ? (o.exercise_test as Record<string, unknown>) : null;
  if (!o || o.doc_type !== "exercise_test" || !t) return null;
  const peakVo2 = numOr(t.peak_vo2, 5, 95);
  const date = typeof o.report_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.report_date.slice(0, 10)) ? o.report_date.slice(0, 10) : null;
  return {
    mask: t.mask === true && peakVo2 != null, date, protocol: text(t.protocol, 60), seconds: numOr(t.duration_seconds, 30, 3600), mets: numOr(t.mets, 1, 25), peakVo2,
    peakHr: numOr(t.peak_hr, 40, 240), peakHrPercent: numOr(t.peak_hr_percent, 20, 130), stopped: text(t.stopped_because, 200), conclusion: text(o.impression, 2000),
  };
}
/** The card a report opens on, and the fields it fills: a mask test when oxygen was measured, else a treadmill test. */
export function entryFromRead(r: TestRead): { kind: EntryKey; fields: EntryFields } {
  const minutes = r.seconds != null ? r.seconds / 60 : null;
  return r.mask ? { kind: "mask", fields: { date: r.date ?? "", vo2: r.peakVo2 } } : { kind: "treadmill", fields: { date: r.date ?? "", mets: r.mets, protocol: r.protocol, minutes } };
}
/** What stands over a report's own conclusion wherever it is shown. */
export const CONCLUSION_WORDS = "Read from the printed text. Verve does not read the conclusion or act on it. Anything it asks of you is between you and your doctor.";
