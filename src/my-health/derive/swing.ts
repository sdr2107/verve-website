/**
 * A marker's usual swing: how far two results from one person can differ with
 * nothing having changed (the reference change value of laboratory medicine;
 * data/usual-swing.ts, a copy of the app's thresholds file). `swingOf` says
 * where a change between two results sits against it: inside it, at its edge,
 * or more than it.
 *
 * Two pages read it, so it lives here and nowhere else:
 *   In depth   a blood marker's card, and the band around its baseline
 *              (derive/timeline.ts)
 *   Horizon    whether a report at a blood target's number is called reached
 *              (horizon/derive.ts; the Guide's check-in is written from the
 *              same file, copied into the horizon function)
 *
 * Pure, and it reaches for nothing but the figures.
 */
import SWING from "../../data/usual-swing.ts";

export type SwingKey = keyof typeof SWING.markers;
export type SwingState = "inside" | "edge" | "more";
const trim = (v: number, dp: number) => { const f = 10 ** dp; return String(Math.round(v * f) / f); };

/** Where a change between two results sits against the marker's usual swing: inside it, at its edge, or more than it. Null for a marker with no swing on file. */
export function swingOf(swingKey: SwingKey | null, thenV: number, nowV: number): { state: SwingState; range: string } | null {
  if (!swingKey || !(thenV > 0)) return null;
  const m = SWING.markers[swingKey] as Record<string, unknown>;
  if (m.logScale) {
    const rise = Number(m.risePct), fall = Number(m.fallPct), ratio = nowV / thenV;
    const more = ratio > 1 + rise / 100 || ratio < 1 - fall / 100;
    return { state: more ? "more" : "inside", range: `a rise to more than ${trim(1 + rise / 100, 1)} times, or a fall of more than ${Math.round(fall)}%` };
  }
  if (m.swingLowPct == null) return null;
  const lo = Number(m.swingLowPct), hi = Number(m.swingHighPct), pct = (Math.abs(nowV - thenV) / thenV) * 100;
  const range = swingKey === "hba1c" ? `${trim((thenV * lo) / 100, 1)} to ${trim((thenV * hi) / 100, 1)} points at this level`
    : Math.round(lo) === Math.round(hi) ? `${Math.round(lo)}%` : `${Math.round(lo)} to ${Math.round(hi)}%`;
  return { state: pct < lo ? "inside" : pct <= hi ? "edge" : "more", range };
}
