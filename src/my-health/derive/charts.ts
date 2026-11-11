/**
 * The In depth chapters' charts, one each (canvas "My health, redesigned",
 * board 5), as SVG inner markup in the page's tokens. Pure: dates and numbers
 * in, markup out; the view wraps each in an <svg viewBox="0 0 W H">.
 *
 *   nightsSvg     a line over the last N days with the person's own band shaded
 *                 (resting heart rate, 30 nights)
 *   testsSvg      the fitness tests over twelve months, the above-average band
 *                 for age and sex shaded, in the chosen unit
 *   bedWakeSvg    Monday to Sunday, bed to wake, with the usual window
 *   recoverySvg   one dot a session over eight weeks, the own band shaded
 *   weekBarsSvg   the weekly dose, four weeks, the goal dashed
 */
import { addDays, daysBetween, esc, fmtDay } from "./format.ts";

/** The tokens, by name, for SVG: each drawing takes its colours from the page's theme, so one string is right in light and in dark. */
export const C = { accent: "var(--color-accent)", accentText: "var(--color-accent-text)", good: "var(--color-good)", caution: "var(--color-caution)", concern: "var(--color-concern)", text: "var(--color-text)", text2: "var(--color-text-2)", text3: "var(--color-text-3)", text4: "var(--color-text-4)", border: "var(--color-border)", borderStrong: "var(--color-border-strong)", alt: "var(--color-alt)", card: "var(--color-card)", canvas: "var(--color-canvas)", z2: "var(--color-z2)", z3: "var(--color-z3)", z3text: "var(--color-z3-text)" };
const MONO = "JetBrains Mono, ui-monospace, monospace";
const axisText = (x: number, y: number, t: string, anchor = "start") => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" fill="${C.text3}" font-size="10" font-family="${MONO}">${esc(t)}</text>`;
const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export type Night = { day: string; v: number; off?: boolean; title?: string };
/** W 560 × H 150. */
export function nightsSvg(pts: Night[], band: { lo: number; hi: number } | null, usual: number | null, from: string, to: string, unit: string): string {
  if (!pts.length) return "";
  const W = 560, H = 150, L = 34, R = 44, T = 14, B = 26;
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs, band ? band.lo : Infinity) - 2, hi = Math.max(...vs, band ? band.hi : -Infinity) + 2;
  const t0 = new Date(from + "T00:00:00").getTime(), t1 = Math.max(new Date(to + "T00:00:00").getTime(), t0 + 86400000);
  const x = (d: string) => L + ((new Date(d + "T00:00:00").getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  let s = "";
  if (band) s += `<rect x="${L}" y="${y(band.hi).toFixed(1)}" width="${W - L - R}" height="${Math.max(1, y(band.lo) - y(band.hi)).toFixed(1)}" fill="${C.good}" fill-opacity="0.1"/>${axisText(W - R + 6, y(band.hi) + 4, String(band.hi))}${axisText(W - R + 6, y(band.lo) + 4, String(band.lo))}`;
  if (usual != null) s += `<line x1="${L}" y1="${y(usual).toFixed(1)}" x2="${W - R}" y2="${y(usual).toFixed(1)}" stroke="${C.accent}" stroke-opacity="0.55" stroke-dasharray="3 4"/>`;
  s += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="${C.border}"/>`;
  if (pts.length > 1) s += `<polyline points="${pts.map((p) => `${x(p.day).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}" fill="none" stroke="${C.accent}" stroke-width="1.6" stroke-linejoin="round"/>`;
  for (const p of pts) s += `<circle cx="${x(p.day).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.off ? 3.6 : 2.6}" fill="${p.off ? C.caution : C.accent}" stroke="${C.card}" stroke-width="1.2"><title>${esc(p.title ?? `${fmtDay(p.day)}: ${p.v} ${unit}`)}</title></circle>`;
  s += axisText(L, H - 8, shortDay(pts[0].day)) + axisText(W - R, H - 8, shortDay(pts[pts.length - 1].day), "end") + axisText(4, y(hi) + 4, String(Math.round(hi))) + axisText(4, y(lo) + 4, String(Math.round(lo)));
  return s;
}

export type Test = { d: string; v: number; label: string; maximal: boolean };
/** W 560 × H 160. The band is above average for this age and sex, in the chart's unit. */
export function testsSvg(tests: Test[], band: { lo: number; hi: number } | null, today: string, unit: string, months = 12): string {
  if (!tests.length) return "";
  const W = 560, H = 160, L = 34, R = 16, T = 18, B = 28;
  const from = addDays(today, -Math.round(months * 30.4));
  const shown = tests.filter((t) => t.d >= from);
  const pts = shown.length ? shown : tests.slice(-1);
  const vs = pts.map((p) => p.v);
  const lo = Math.min(...vs, band ? band.lo : Infinity) - (unit === "METs" ? 0.6 : 2), hi = Math.max(...vs, band ? band.hi : -Infinity) + (unit === "METs" ? 0.6 : 2);
  const t0 = new Date((shown.length ? from : pts[0].d) + "T00:00:00").getTime(), t1 = Math.max(new Date(today + "T00:00:00").getTime(), t0 + 86400000);
  const x = (d: string) => L + ((new Date(d + "T00:00:00").getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / Math.max(0.1, hi - lo)) * (H - T - B);
  let s = "";
  if (band) s += `<rect x="${L}" y="${y(band.hi).toFixed(1)}" width="${W - L - R}" height="${Math.max(1, y(band.lo) - y(band.hi)).toFixed(1)}" fill="${C.accent}" fill-opacity="0.1"/>`;
  s += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="${C.border}"/>`;
  for (const grp of [false, true]) { const g = pts.filter((p) => p.maximal === grp); if (g.length > 1) s += `<polyline points="${g.map((p) => `${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}" fill="none" stroke="${grp ? C.accent : C.text3}" stroke-width="1.8"${grp ? "" : ' stroke-dasharray="3 4"'}/>`; }
  for (const p of pts) s += `<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="5" fill="${p.maximal ? C.accent : C.text3}" stroke="${C.card}" stroke-width="2"><title>${esc(`${fmtDay(p.d)}: ${p.v} ${unit} by ${p.label}`)}</title></circle><text x="${x(p.d).toFixed(1)}" y="${(y(p.v) - 10).toFixed(1)}" text-anchor="middle" fill="${C.text}" font-size="11" font-weight="600" font-family="${MONO}">${esc(String(p.v))}</text>`;
  // month ticks
  let last = "";
  for (let d = new Date(t0); d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) { const iso = d.toLocaleDateString("en-CA"); const m = new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { month: "short" }); if (m === last) continue; last = m; const xx = x(iso); if (xx >= L && xx <= W - R) s += axisText(xx, H - 8, m, "middle"); }
  s += axisText(4, y(hi) + 4, unit === "METs" ? (Math.round(hi * 10) / 10).toFixed(1) : String(Math.round(hi))) + axisText(4, y(lo) + 4, unit === "METs" ? (Math.round(lo * 10) / 10).toFixed(1) : String(Math.round(lo)));
  return s;
}

export type NightSpan = { day: string; label: string; startMin: number | null; endMin: number | null; late?: boolean };
/** W 560 × H 170. Minutes from 18:00 of the evening before; the usual window as a band. */
export function bedWakeSvg(nights: NightSpan[], usual: { start: number; end: number } | null): string {
  const W = 560, H = 170, L = 40, R = 16, T = 12, B = 24;
  const lo = 18 * 60, hi = 36 * 60;   // 18:00 to 12:00 next day
  const x = (m: number) => L + ((m - lo) / (hi - lo)) * (W - L - R);
  const rowH = (H - T - B) / 7;
  let s = "";
  if (usual) s += `<rect x="${x(usual.start).toFixed(1)}" y="${T}" width="${Math.max(1, x(usual.end) - x(usual.start)).toFixed(1)}" height="${H - T - B}" fill="${C.accent}" fill-opacity="0.08"/>`;
  for (const hr of [21, 24, 27, 30, 33]) { const xx = x(hr * 60); s += `<line x1="${xx.toFixed(1)}" y1="${T}" x2="${xx.toFixed(1)}" y2="${H - B}" stroke="${C.border}"/>` + axisText(xx, H - 8, `${String(hr % 24).padStart(2, "0")}:00`, "middle"); }
  nights.forEach((n, i) => {
    const yy = T + i * rowH + rowH / 2;
    s += axisText(4, yy + 4, n.label);
    if (n.startMin == null || n.endMin == null) { s += `<text x="${x(lo + 60)}" y="${(yy + 4).toFixed(1)}" fill="${C.text3}" font-size="10" font-family="${MONO}">—</text>`; return; }
    s += `<rect x="${x(n.startMin).toFixed(1)}" y="${(yy - rowH * 0.28).toFixed(1)}" width="${Math.max(2, x(n.endMin) - x(n.startMin)).toFixed(1)}" height="${(rowH * 0.56).toFixed(1)}" rx="3" fill="${n.late ? C.caution : C.accent}" fill-opacity="${n.late ? 0.85 : 0.7}"><title>${esc(`${fmtDay(n.day)}: ${hm(n.startMin)} to ${hm(n.endMin)}`)}</title></rect>`;
  });
  return s;
}
export const hm = (m: number) => `${String(Math.floor((m / 60) % 24)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

export type Dot = { day: string; v: number; low?: boolean; title?: string };
/** W 560 × H 140: one dot a session, eight weeks, the own band shaded. */
export function recoverySvg(dots: Dot[], band: { lo: number; hi: number } | null, median: number | null, today: string, weeks = 8): string {
  if (!dots.length) return "";
  const W = 560, H = 140, L = 34, R = 16, T = 12, B = 26;
  const from = addDays(today, -weeks * 7);
  const pts = dots.filter((p) => p.day > from);
  const use = pts.length ? pts : dots.slice(-8);
  const vs = use.map((p) => p.v);
  const lo = Math.min(...vs, band ? band.lo : Infinity, 12) - 2, hi = Math.max(...vs, band ? band.hi : -Infinity) + 2;
  const t0 = new Date((pts.length ? from : use[0].day) + "T00:00:00").getTime(), t1 = Math.max(new Date(today + "T00:00:00").getTime(), t0 + 86400000);
  const x = (d: string) => L + ((new Date(d + "T00:00:00").getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  let s = "";
  if (band) s += `<rect x="${L}" y="${y(band.hi).toFixed(1)}" width="${W - L - R}" height="${Math.max(1, y(band.lo) - y(band.hi)).toFixed(1)}" fill="${C.good}" fill-opacity="0.1"/>`;
  if (median != null) s += `<line x1="${L}" y1="${y(median).toFixed(1)}" x2="${W - R}" y2="${y(median).toFixed(1)}" stroke="${C.accent}" stroke-opacity="0.55" stroke-dasharray="3 4"/>`;
  s += `<line x1="${L}" y1="${y(12).toFixed(1)}" x2="${W - R}" y2="${y(12).toFixed(1)}" stroke="${C.concern}" stroke-opacity="0.5" stroke-dasharray="2 4"/>` + axisText(W - R + 2, y(12) + 4, "12");
  s += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="${C.border}"/>`;
  for (const p of use) s += `<circle cx="${x(p.day).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" fill="${p.v <= 12 ? C.concern : p.low ? C.caution : C.accent}" stroke="${C.card}" stroke-width="1.4"><title>${esc(p.title ?? `${fmtDay(p.day)}: ${p.v} bpm in the first minute`)}</title></circle>`;
  s += axisText(L, H - 8, shortDay(use[0].day)) + axisText(W - R, H - 8, shortDay(use[use.length - 1].day), "end") + axisText(4, y(hi) + 4, String(Math.round(hi))) + axisText(4, y(lo) + 4, String(Math.round(lo)));
  return s;
}

export type WeekBar = { label: string; dose: number | null; goal: number; current?: boolean; z1?: number | null; z2?: number | null; z3?: number | null };
/** W 560 × H 150: the dose by week as bars, the goal dashed; a week with no dose is a dash. */
export function weekBarsSvg(weeks: WeekBar[]): string {
  if (!weeks.length) return "";
  const W = 560, H = 150, L = 40, R = 16, T = 16, B = 26;
  const goal = Math.max(...weeks.map((w) => w.goal));
  const max = Math.max(goal * 1.15, ...weeks.map((w) => w.dose ?? 0)) || 1;
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const slot = (W - L - R) / weeks.length, bw = Math.min(56, slot * 0.6);
  let s = `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="${C.border}"/>`;
  s += `<line x1="${L}" y1="${y(goal).toFixed(1)}" x2="${W - R}" y2="${y(goal).toFixed(1)}" stroke="${C.accent}" stroke-opacity="0.7" stroke-dasharray="4 4"/>` + axisText(4, y(goal) + 4, goal.toLocaleString());
  weeks.forEach((w, i) => {
    const cx = L + slot * i + slot / 2;
    if (w.dose == null) { s += `<text x="${cx.toFixed(1)}" y="${(H - B - 6).toFixed(1)}" text-anchor="middle" fill="${C.text3}" font-size="12" font-family="${MONO}">—</text>`; }
    else {
      const top = y(w.dose);
      s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - B - top).toFixed(1)}" rx="3" fill="${w.dose >= w.goal ? C.good : C.accent}" fill-opacity="${w.current ? 0.55 : 0.9}"><title>${esc(`${w.label}: ${w.dose.toLocaleString()} MET-min of ${w.goal.toLocaleString()}`)}</title></rect>`;
      s += `<text x="${cx.toFixed(1)}" y="${(top - 5).toFixed(1)}" text-anchor="middle" fill="${C.text}" font-size="11" font-weight="600" font-family="${MONO}">${w.dose.toLocaleString()}</text>`;
    }
    s += axisText(cx, H - 8, w.label, "middle");
  });
  return s;
}

/** Days between two ISO dates, for callers that have none of format's helpers. */
export { daysBetween };
