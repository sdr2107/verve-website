/**
 * Readers over the app's daily rows (daily_signals) for the columns the
 * cards show: the in-bed window, efficiency, stages, regularity, the spread
 * of bedtimes, the wakes, wrist temperature, breathing, oxygen, the day's
 * zone minutes and background movement, and who wrote the day. Pure. A
 * reading that is not there reads as null and the card writes a dash with
 * the reason, never a zero (canvas "My health, redesigned", boards 2, 3, 11).
 */
import { addDays, mondayOf } from "./format.ts";

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
/** The newest row, on or before `today`, that carries the column. */
export function latestWith(signals: any[], col: string, today?: string): any | null {
  for (let i = signals.length - 1; i >= 0; i--) { const r = signals[i]; if (r?.[col] != null && (!today || String(r.day) <= today)) return r; }
  return null;
}
export const rowOn = (signals: any[], day: string): any | null => signals.find((r) => String(r.day) === day) ?? null;

/** "23:10" from a timestamp, in the browser's clock. */
const hm = (iso: unknown) => iso ? new Date(String(iso)).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
/** The night's window: "23:10 – 07:50" from the first and last asleep interval; null when the writer gives neither. */
export const inBedWindow = (r: any): string | null => r?.sleep_start && r?.sleep_end ? `${hm(r.sleep_start)} – ${hm(r.sleep_end)}` : null;
export const bedtimeOf = (r: any): string | null => r?.sleep_start ? hm(r.sleep_start) : null;
/** Asleep over the in-bed window the app sends, in percent. */
export const efficiencyOf = (r: any): number | null => r?.sleep_minutes != null && Number(r.sleep_in_bed_min) > 0 ? Math.round((100 * Number(r.sleep_minutes)) / Number(r.sleep_in_bed_min)) : null;
/** The stages, when the night's writer staged it. */
export const stagesOf = (r: any): { deep: number | null; core: number | null; rem: number | null; awake: number | null } | null =>
  r?.sleep_staged ? { deep: num(r.sleep_deep_min), core: num(r.sleep_core_min), rem: num(r.sleep_rem_min), awake: num(r.sleep_awake_min) } : null;

/** "8 h 40" from minutes. */
export const fmtHMin = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}`;
/** "+0.1" from a signed delta, one decimal. */
export const fmtSigned1 = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 10) / 10).toFixed(1)}`;
/**
 * Wrist temperature: Android writes a deviation from the writer's own baseline
 * (skin_temp_delta_c); the iPhone writes the night's temperature in °C
 * (wrist_temp_c), read here against the median of the person's own prior 30
 * nights once seven are on file, else shown as the reading.
 */
export function wristTemp(signals: any[], today: string): { value: number; delta: boolean; day: string } | null {
  const r = [...signals].reverse().find((x) => String(x.day) <= today && (x.skin_temp_delta_c != null || x.wrist_temp_c != null)) ?? null;
  if (!r) return null;
  if (r.skin_temp_delta_c != null) return { value: Number(r.skin_temp_delta_c), delta: true, day: String(r.day) };
  const v = Number(r.wrist_temp_c);
  const from = addDays(String(r.day), -30);
  const pri = signals.filter((x) => String(x.day) >= from && String(x.day) < String(r.day) && x.wrist_temp_c != null).map((x) => Number(x.wrist_temp_c)).sort((a, b) => a - b);
  if (pri.length >= 7) { const m = pri.length % 2 ? pri[pri.length >> 1] : (pri[(pri.length >> 1) - 1] + pri[pri.length >> 1]) / 2; return { value: v - m, delta: true, day: String(r.day) }; }
  return { value: v, delta: false, day: String(r.day) };
}

/** The mean of a column over the last `days` days up to today, rounded; null when no day carries it. */
export function meanOver(signals: any[], col: string, days: number, today: string): number | null {
  const from = addDays(today, -days);
  const xs = signals.filter((r) => String(r.day) > from && String(r.day) <= today && r[col] != null).map((r) => Number(r[col]));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** The day's elected writer, as the app names it (steps_source, else the HRV writer); null when the store's own merge. */
export function writerOf(signals: any[], today: string): string | null {
  for (let i = signals.length - 1; i >= 0; i--) {
    const r = signals[i]; if (String(r.day) < addDays(today, -14)) break;
    if (r?.steps_source) return String(r.steps_source);
  }
  for (let i = signals.length - 1; i >= 0; i--) { const r = signals[i]; if (r?.hrv_source && String(r.day) >= addDays(today, -30)) return String(r.hrv_source); }
  return null;
}
/** "WHOOP via the phone's health store" */
export const writerLine = (writer: string | null, store = "the phone's health store") => writer ? `${writer} via ${store}` : `Any wearable, via ${store}`;

// ── the zones and background movement, from the day rows the app writes ──
export type DayZones = { day: string; z1: number | null; z2: number | null; z3: number | null };
export const dayZonesOf = (r: any): DayZones => ({ day: String(r.day), z1: num(r.zone1_min), z2: num(r.zone2_min), z3: num(r.zone3_min) });
/** The week's zone minutes summed over the days that carry any; null when no day does (the app has not sent them yet). */
export function weekZones(signals: any[], weekStart: string): { z1: number; z2: number; z3: number; days: number } | null {
  const end = addDays(weekStart, 7);
  const rows = signals.filter((r) => String(r.day) >= weekStart && String(r.day) < end && (r.zone1_min != null || r.zone2_min != null || r.zone3_min != null));
  if (!rows.length) return null;
  const s = (k: string) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  return { z1: s("zone1_min"), z2: s("zone2_min"), z3: s("zone3_min"), days: rows.length };
}
/** The words beside a dash where background movement would be, from the app's own reason. */
export function backgroundReasonWords(reason: string | null, writer: string | null): string {
  if (reason === "no-heart-rate") return `no all-day heart rate from ${writer ?? "this writer"}`;
  if (reason === "no-fine-steps") return "no step detail";
  if (reason === "nothing-counted") return "nothing counted outside sessions";
  return "the app writes this on its next sync";
}
/**
 * The Background row, judged from the NEWEST day that carries minutes or a
 * reason (the app's rule, PR #89): minutes → the week's mean over the days
 * with minutes; a reason → a dash with it in words; neither → a dash and
 * "the app writes this on its next sync". Never a zero.
 */
export function backgroundOf(signals: any[], weekStart: string, today: string, writer: string | null): { minutes: number | null; days: number; reason: string | null; words: string } {
  const newest = [...signals].reverse().find((r) => String(r.day) <= today && (r.background_min != null || r.background_reason != null)) ?? null;
  const end = addDays(weekStart, 7);
  const week = signals.filter((r) => String(r.day) >= weekStart && String(r.day) < end && r.background_min != null).map((r) => Number(r.background_min));
  if (newest?.background_min != null && week.length) return { minutes: Math.round(week.reduce((a, b) => a + b, 0) / week.length), days: week.length, reason: null, words: "outside sessions, from heart rate" };
  if (newest?.background_min != null) return { minutes: Math.round(Number(newest.background_min)), days: 1, reason: null, words: `on ${newest.day}, the newest day` };
  const reason = newest?.background_reason ?? null;
  return { minutes: null, days: 0, reason, words: backgroundReasonWords(reason, writer) };
}
/** Mon to Sun of the week, each day's zone minutes from the day rows, or the sessions' minutes when the rows carry none. */
export function dayBars(signals: any[], acts: any[], weekStart: string, today: string): { day: string; z1: number; z2: number; z3: number; other: number; future: boolean }[] {
  const byDay = new Map(signals.map((r) => [String(r.day), r]));
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
    const r = byDay.get(day);
    const has = r && (r.zone1_min != null || r.zone2_min != null || r.zone3_min != null);
    if (has) return { day, z1: Number(r.zone1_min) || 0, z2: Number(r.zone2_min) || 0, z3: Number(r.zone3_min) || 0, other: 0, future: day > today };
    let z2 = 0, other = 0;
    for (const a of acts) { if (!a?.timestamp || new Date(a.timestamp).toLocaleDateString("en-CA") !== day) continue; const m = Number(a.duration_minutes) || 0, z = Math.min(m, Number(a.zone2_minutes) || 0); z2 += z; other += m - z; }
    return { day, z1: 0, z2, z3: 0, other, future: day > today };
  });
}
/** This Monday, in local time, as the page writes dates. */
export const thisMonday = () => mondayOf(new Date());
