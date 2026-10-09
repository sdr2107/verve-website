/**
 * The lab values, grouped the way the Labs tab shows them: section →
 * canonical analyte → readings by date. Pure.
 */
import { canonName, unitKey } from "../../lib/canon.js";
import { esc, fmtDay } from "./format.ts";
import { inRange, rangeLabel } from "./markers.ts";

export const SECTIONS: Record<string, string> = {
  metabolic: "Metabolic", heart: "Heart", muscle: "Muscle",
  haematology: "Haematology", lipids: "Lipids", liver: "Liver", kidney: "Kidney",
  thyroid: "Thyroid", vitamins_iron: "Vitamins & iron", hormones: "Hormones",
  inflammation: "Inflammation", urine: "Urine", imaging: "Imaging", other: "Other",
};
export const SECTION_ORDER = Object.keys(SECTIONS);

export function groupLabs(labs: any[]): Map<string, Map<string, any[]>> {
  const secs = new Map<string, Map<string, any[]>>();
  for (const r of labs) {
    const s = SECTIONS[r.section] ? r.section : "other";
    const sec = secs.get(s) ?? secs.set(s, new Map()).get(s)!;
    const key = canonName(String(r.analyte));
    (sec.get(key) ?? sec.set(key, []).get(key)!).push(r);
  }
  return secs;
}

/** How many series there are, and how many latest values sit outside their lab's own range. */
export function labsJudged(labs: any[]): { outside: number; judged: number } {
  let outside = 0, judged = 0;
  for (const m of groupLabs(labs).values()) for (const rs of m.values()) { const ok = inRange(rs[rs.length - 1]); if (ok !== null) judged++; if (ok === false) outside++; }
  return { outside, judged };
}

// ── search: every word typed must land ───────────────────────────────────────
export const searchTermsOf = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);
export const landsAll = (hay: string, terms: string[]) => terms.every((t) => hay.includes(t));
/** A date, every way someone might type it: 2026-09-12, Sep 12, September, 2026. */
export function dateHay(d: string): string {
  if (!d) return "undated";
  const dt = new Date(d.slice(0, 10) + "T00:00:00");
  return `${d.slice(0, 10)} ${fmtDay(d.slice(0, 10))} ${dt.toLocaleDateString(undefined, { month: "long" })} ${dt.toLocaleDateString(undefined, { month: "short" })} ${dt.getFullYear()}`.toLowerCase();
}
/** The Labs sections with only the markers the search lands on; all of them when nothing is typed. */
export function filterSecs(secs: Map<string, Map<string, any[]>>, query: string): Map<string, Map<string, any[]>> {
  const terms = searchTermsOf(query);
  if (!terms.length) return secs;
  const out = new Map<string, Map<string, any[]>>();
  for (const [sec, analytes] of secs) {
    for (const [name, rows] of analytes) {
      if (landsAll(`${name} ${SECTIONS[sec] ?? ""} ${sec}`.toLowerCase(), terms)) (out.get(sec) ?? out.set(sec, new Map()).get(sec)!).set(name, rows);
    }
  }
  return out;
}

// ── one marker's history, drawn ───────────────────────────────────────────────
/** The small line beside a marker's name: its readings, the latest largest, each judged by its own range. */
export function sparkSvg(rs: any[]): string {
  const vals = rs.map((r) => Number(r.value));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const y = (v: number) => hi === lo ? 14 : 24 - ((v - lo) / (hi - lo)) * 20;
  const x = (i: number) => rs.length === 1 ? 60 : 6 + (i / (rs.length - 1)) * 108;
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dots = vals.map((v, i) => {
    const own = inRange(rs[i]);
    return `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === vals.length - 1 ? 3.5 : 2.5}" fill="${own === false ? "#FBBF24" : "#818cf8"}"><title>${rs[i].measured_on}: ${v}</title></circle>`;
  }).join("");
  return `${rs.length > 1 ? `<polyline points="${pts}" fill="none" stroke="#818cf8" stroke-width="1.5" opacity="0.6"/>` : ""}${dots}`;
}

/**
 * The chart under an opened marker: every dot judged against ITS OWN
 * report's printed range, per-reading band shading, a diamond where a
 * different lab's range enters the series, and readings in another unit
 * than the latest LISTED under the chart, never mixed onto the line.
 */
export function bigChartHtml(rsAll: any[]): string {
  const latestUnit = unitKey(rsAll[rsAll.length - 1].unit);
  const rs = rsAll.filter((r) => unitKey(r.unit) === latestUnit);
  const offLine = rsAll.filter((r) => unitKey(r.unit) !== latestUnit);

  const W = 640, H = 200, L = 46, R = 16, T = 20, B = 30;
  const vals = rs.map((r) => Number(r.value));
  const bounds = [...vals];
  for (const r of rs) {
    if (r.ref_low != null) bounds.push(Number(r.ref_low));
    if (r.ref_high != null) bounds.push(Number(r.ref_high));
  }
  let lo = Math.min(...bounds), hi = Math.max(...bounds);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  lo -= pad; hi += pad;
  const X = (i: number) => rs.length === 1 ? L + (W - L - R) / 2 : L + (i / (rs.length - 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const midX = (i: number) => i < 0 ? L : i >= rs.length - 1 ? W - R : (X(i) + X(i + 1)) / 2;

  // ① band segments — each reading's own range shades its neighbourhood
  const bands = rs.map((r, i) => {
    if (r.ref_low == null && r.ref_high == null) return "";
    const yTop = Y(r.ref_high != null ? Number(r.ref_high) : hi);
    const yBot = Y(r.ref_low != null ? Number(r.ref_low) : lo);
    return `<rect x="${midX(i - 1).toFixed(1)}" y="${yTop.toFixed(1)}" width="${(midX(i) - midX(i - 1)).toFixed(1)}" height="${Math.max(0, yBot - yTop).toFixed(1)}" fill="#10B981" opacity="0.09"/>`;
  }).join("");

  // ② range-change diamonds
  const rk = (r: any) => `${r.ref_low ?? ""}|${r.ref_high ?? ""}`;
  let diamonds = "";
  const changes: string[] = [];
  for (let i = 1; i < rs.length; i++) {
    if (rk(rs[i]) !== rk(rs[i - 1])) {
      diamonds += `<g transform="translate(${X(i).toFixed(1)},${T - 8})"><rect x="-4.5" y="-4.5" width="9" height="9" transform="rotate(45)" fill="#818cf8"><title>Different lab range from ${fmtDay(rs[i].measured_on)}: ${rangeLabel(rs[i - 1]) || "none"} → ${rangeLabel(rs[i]) || "none"}</title></rect></g>`;
      changes.push(`${rangeLabel(rs[i - 1]) || "no range"} → ${rangeLabel(rs[i]) || "no range"} from ${fmtDay(rs[i].measured_on)}`);
    }
  }

  // ③ line, dots (own-range verdicts), axis
  const line = rs.length > 1
    ? `<polyline points="${vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="#818cf8" stroke-width="2"/>` : "";
  const dots = rs.map((r, i) => {
    const own = inRange(r);
    const c = own === false ? "#FBBF24" : own === true ? "#34D399" : "#94A3B8";
    return `<circle cx="${X(i).toFixed(1)}" cy="${Y(Number(r.value)).toFixed(1)}" r="4" fill="${c}" stroke="#0B0F1A" stroke-width="1.5"><title>${fmtDay(r.measured_on)}: ${r.value}${r.unit ? " " + r.unit : ""} (range ${rangeLabel(r) || "—"})</title></circle>`;
  }).join("");
  const step = Math.max(1, Math.ceil(rs.length / 6));
  const xlabels = rs.map((r, i) => (i % step === 0 || i === rs.length - 1)
    ? `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#64748B" font-family="ui-monospace,monospace">${new Date(r.measured_on + "T00:00:00").toLocaleDateString(undefined, { month: "short", year: "2-digit" })}</text>` : "").join("");
  const ticks = [0.15, 0.5, 0.85].map((f) => {
    const v = lo + (hi - lo) * (1 - f);
    const yy = T + f * (H - T - B);
    return `<line x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}" stroke="#FFFFFF" opacity="0.05"/><text x="${L - 6}" y="${yy + 3}" text-anchor="end" font-size="9" fill="#64748B" font-family="ui-monospace,monospace">${Number(v.toPrecision(3))}</text>`;
  }).join("");

  const unitLabel = rs[rs.length - 1].unit ? esc(String(rs[rs.length - 1].unit)) : "";
  return `
    <div class="mh-open mb-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <svg viewBox="0 0 ${W} ${H}" class="w-full">${ticks}${bands}${line}${dots}${diamonds}${xlabels}</svg>
      <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-tertiary">
        <span><span class="text-success">●</span> in its lab's range</span>
        <span><span class="text-warning">●</span> outside</span>
        <span class="opacity-80">▩ the printed range, per report${unitLabel ? ` · ${unitLabel}` : ""}</span>
      </div>
      ${changes.map((c) => `<div class="mt-1.5 text-[10px] font-semibold text-accent-light">◆ DIFFERENT LAB RANGE · ${esc(c)}</div>`).join("")}
      ${offLine.length ? `
        <div class="mt-1.5 text-[10px] font-semibold text-warning">⚠ UNIT CHANGED — ${offLine.length} earlier reading${offLine.length === 1 ? "" : "s"} in a different unit, listed below, not on this line</div>
        ${offLine.map((r) => `<div class="mt-0.5 font-mono text-[10px] text-text-tertiary">${fmtDay(r.measured_on)} · ${r.value}${r.unit ? " " + esc(r.unit) : ""} (range ${esc(rangeLabel(r) || "—")})</div>`).join("")}` : ""}
      <div class="mt-2 divide-y divide-white/[0.04]">
        ${[...rs].reverse().map((r) => {
          const own = inRange(r);
          return `<div class="flex items-baseline gap-3 py-1">
            <span class="w-24 font-mono text-[10px] text-text-tertiary">${fmtDay(r.measured_on)}</span>
            <span class="flex-1 font-mono text-xs ${own === false ? "text-warning" : own === true ? "text-success" : "text-text-primary"}">${r.value}${r.unit ? ` ${esc(r.unit)}` : ""}</span>
            <span class="font-mono text-[10px] text-text-muted">${esc(rangeLabel(r) || "no printed range")}</span>
          </div>`;
        }).join("")}
      </div>
    </div>`;
}
