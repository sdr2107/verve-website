/**
 * The app's daily rows, read the way its Today tile reads them: resting
 * heart rate against the person's own 30-morning median, the night against
 * the median of 30 nights, recovery and night HRV against their own middle
 * half, steps over seven days. Pure; memoised on the rows' identity.
 *
 * Night HRV: one writer, read against that writer's own last 30 nights with
 * a reading (the median, and the middle half of them). The app writes the
 * night's median SDNN-field value, the sample count, the writer's name and
 * the method it declares; a new writer starts a new band, and two writers
 * never share a line.
 */
import { daysBack, esc, fmtDay, medianOf, quartilesOf } from "./format.ts";

/**
 * The app's rule (data/met-thresholds.json nightHrv.minNights): the night
 * HRV band appears after 7 nights from one writer. The two surfaces read
 * one night against one band; they must agree on when it exists.
 */
export const HRV_MIN_NIGHTS = 7;

export function sleepHeartSummaryRaw(rows: any[], today: string) {
  if (!rows.length) return null;

  // resting heart rate: the latest morning against the median of the 30 before it, latest excluded
  const rhrRows = rows.filter((r) => r.resting_hr != null).map((r) => ({ day: String(r.day), bpm: Number(r.resting_hr) }));
  const latestR = rhrRows[rhrRows.length - 1] ?? null;
  let baseline: number | null = null, priors = 0, delta: number | null = null, status = "", level = "", run = 0, inBand = 0, read = 0, svg = "";
  let rhrSeries: Array<{ day: string; bpm: number; b: number | null; above: boolean }> = [];
  if (latestR) {
    const from = daysBack(latestR.day, 30);
    const pri = rhrRows.filter((r) => r.day >= from && r.day < latestR.day).map((r) => r.bpm);
    priors = pri.length;
    if (pri.length >= 14) {
      baseline = Math.round(medianOf(pri)!);
      delta = Math.round(latestR.bpm - baseline);
      status = delta >= 10 ? "stronglyElevated" : delta >= 5 ? "elevated" : delta <= -5 ? "below" : "typical";
    }
    level = latestR.bpm < 50 ? "low" : latestR.bpm <= 60 ? "optimal" : latestR.bpm <= 75 ? "typical" : latestR.bpm <= 80 ? "elevated" : "high";
    // the last 28 mornings, drawn; each judged against the median of its own prior 30
    const win = rhrRows.filter((r) => r.day > daysBack(today, 28));
    const judged = win.map((r) => { const f = daysBack(r.day, 30); const pr = rhrRows.filter((x) => x.day >= f && x.day < r.day).map((x) => x.bpm); const b = pr.length >= 14 ? medianOf(pr)! : null; return { ...r, b, above: b != null && r.bpm - b >= 5 }; });
    rhrSeries = judged;
    read = judged.length; inBand = judged.filter((j) => j.b != null && !j.above && j.bpm - j.b! > -5).length;
    for (let i = judged.length - 1; i >= 0 && judged[i].above; i--) run++;
    if (judged.length) {
      const vs = judged.map((j) => j.bpm); const lo = Math.min(...vs, baseline != null ? baseline - 5 : Infinity) - 2, hi = Math.max(...vs, baseline != null ? baseline + 5 : -Infinity) + 2;
      const t0 = new Date(daysBack(today, 27) + "T00:00:00").getTime(), t1 = new Date(today + "T00:00:00").getTime();
      const xf = (d: string) => 30 + ((new Date(d + "T00:00:00").getTime() - t0) / Math.max(1, t1 - t0)) * 490;
      const yf = (v: number) => 122 - ((v - lo) / Math.max(1, hi - lo)) * 100;
      if (baseline != null) svg += `<rect x="30" y="${yf(baseline + 5).toFixed(1)}" width="490" height="${(yf(baseline - 5) - yf(baseline + 5)).toFixed(1)}" fill="rgba(52,211,153,0.12)"/><text x="524" y="${(yf(baseline + 5) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${baseline + 5}</text><text x="524" y="${(yf(baseline - 5) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${baseline - 5}</text>`;
      svg += `<line x1="30" y1="122" x2="520" y2="122" stroke="rgba(255,255,255,0.14)"/>`;
      if (judged.length > 1) svg += `<polyline points="${judged.map((j) => `${xf(j.day).toFixed(1)},${yf(j.bpm).toFixed(1)}`).join(" ")}" fill="none" stroke="#a5b4fc" stroke-width="1.8"/>`;
      for (const j of judged) svg += `<circle cx="${xf(j.day).toFixed(1)}" cy="${yf(j.bpm).toFixed(1)}" r="4" fill="${j.above ? "#FBBF24" : "#818cf8"}" stroke="#0D0D1C" stroke-width="1.5"><title>${esc(fmtDay(j.day))}: ${j.bpm} bpm${j.b != null ? ` · median before ${Math.round(j.b)}` : ""}</title></circle>`;
      svg += `<text x="${xf(judged[0].day).toFixed(1)}" y="140" fill="#94a3b8" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${esc(fmtDay(judged[0].day)).toUpperCase()}</text><text x="520" y="140" text-anchor="end" fill="#94a3b8" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${esc(fmtDay(judged[judged.length - 1].day)).toUpperCase()}</text>`;
    }
  }

  // the night that ended this morning, against the median of 30 nights
  const nightRows = rows.filter((r) => r.sleep_minutes != null && r.day > daysBack(today, 30));
  const lastN = nightRows[nightRows.length - 1] ?? null;
  const usual = nightRows.length >= 7 ? Math.round(medianOf(nightRows.map((r) => Number(r.sleep_minutes)))!) : null;
  const bedOf = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "";
  const sleep = { nights: nightRows.length, shortNights: nightRows.filter((r) => Number(r.sleep_minutes) < 420).length, usual,
    last: lastN ? { day: String(lastN.day), min: Number(lastN.sleep_minutes), band: Number(lastN.sleep_minutes) < 420 ? "short" : Number(lastN.sleep_minutes) > 540 ? "long" : "inRange", bed: bedOf(lastN.sleep_start) } : null };

  // recovery: the latest day's median, against the median of the 30 days before
  const hrrRows = rows.filter((r) => r.hrr_bpm != null);
  const lastH = hrrRows[hrrRows.length - 1] ?? null;
  const hrrPri = lastH ? hrrRows.filter((r) => r.day >= daysBack(String(lastH.day), 30) && r.day < String(lastH.day)).map((r) => Number(r.hrr_bpm)) : [];
  // each recovery against the middle half of the 30 days before it: "low" is under the lower quartile
  const hrrJudged = hrrRows.map((r) => { const pr = hrrRows.filter((x) => x.day >= daysBack(String(r.day), 30) && x.day < String(r.day)).map((x) => Number(x.hrr_bpm)); const q = pr.length >= 5 ? quartilesOf(pr) : null; return { day: String(r.day), bpm: Number(r.hrr_bpm), low: q != null && Number(r.hrr_bpm) < q.q1 }; });
  const hrr = { latest: lastH ? Number(lastH.hrr_bpm) : null, latestDay: lastH ? String(lastH.day) : null, median: hrrPri.length >= 5 ? Math.round(medianOf(hrrPri)!) : null, source: lastH?.hrr_source ?? null,
    band: hrrPri.length >= 5 ? (() => { const q = quartilesOf(hrrPri); return { lo: Math.round(q.q1), hi: Math.round(q.q3) }; })() : null, judged: hrrJudged };

  // night HRV, one writer at a time
  const hrvAll = rows.filter((r) => r.hrv_night_ms != null).map((r) => ({ day: String(r.day), ms: Number(r.hrv_night_ms), n: r.hrv_n != null ? Number(r.hrv_n) : null, writer: String(r.hrv_source ?? "unknown writer"), method: String(r.hrv_method ?? "undeclared") }));
  const lastV = hrvAll[hrvAll.length - 1] ?? null;
  const hrvWriter = lastV?.writer ?? null, hrvMethod = lastV?.method ?? null;
  const otherWriters = lastV ? [...new Set(hrvAll.slice(-30).map((r) => r.writer))].filter((w) => w !== lastV.writer) : [];
  const own = lastV ? hrvAll.filter((r) => r.writer === lastV.writer) : [];
  /** The writer's last 30 nights before a day, judged against which a night is read. */
  const hrvPriorOf = (day: string) => own.filter((r) => r.day < day).slice(-30).map((r) => r.ms);
  const hrvPri = lastV ? hrvPriorOf(lastV.day) : [];
  const hrvUsual = hrvPri.length >= HRV_MIN_NIGHTS ? Math.round(medianOf(hrvPri)!) : null;
  const hrvBand = hrvPri.length >= HRV_MIN_NIGHTS ? (() => { const q = quartilesOf(hrvPri); return { lo: Math.round(q.q1), hi: Math.round(q.q3) }; })() : null;
  // the last 28 nights, drawn; each judged against the writer's own 30 nights before it
  const hrvWin = own.filter((r) => r.day > daysBack(today, 28));
  const hrvJudged = hrvWin.map((r) => { const pr = hrvPriorOf(r.day); const q = pr.length >= HRV_MIN_NIGHTS ? quartilesOf(pr) : null; return { ...r, q1: q?.q1 ?? null, q3: q?.q3 ?? null, below: q != null && r.ms < q.q1, above: q != null && r.ms > q.q3 }; });
  let hrvRun = 0; for (let i = hrvJudged.length - 1; i >= 0 && hrvJudged[i].below; i--) hrvRun++;
  const hrvRead = hrvJudged.filter((j) => j.q1 != null).length, hrvBelow = hrvJudged.filter((j) => j.below).length;
  let hrvSvg = "";
  if (hrvJudged.length) {
    const vs = hrvJudged.map((j) => j.ms); const lo = Math.min(...vs, hrvBand ? hrvBand.lo : Infinity) - 3, hi = Math.max(...vs, hrvBand ? hrvBand.hi : -Infinity) + 3;
    const t0 = new Date(daysBack(today, 27) + "T00:00:00").getTime(), t1 = new Date(today + "T00:00:00").getTime();
    const xf = (d: string) => 30 + ((new Date(d + "T00:00:00").getTime() - t0) / Math.max(1, t1 - t0)) * 490;
    const yf = (v: number) => 122 - ((v - lo) / Math.max(1, hi - lo)) * 100;
    if (hrvBand) hrvSvg += `<rect x="30" y="${yf(hrvBand.hi).toFixed(1)}" width="490" height="${(yf(hrvBand.lo) - yf(hrvBand.hi)).toFixed(1)}" fill="rgba(52,211,153,0.12)"/><text x="524" y="${(yf(hrvBand.hi) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${hrvBand.hi}</text><text x="524" y="${(yf(hrvBand.lo) + 4).toFixed(1)}" fill="#64748b" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${hrvBand.lo}</text>`;
    hrvSvg += `<line x1="30" y1="122" x2="520" y2="122" stroke="rgba(255,255,255,0.14)"/>`;
    if (hrvJudged.length > 1) hrvSvg += `<polyline points="${hrvJudged.map((j) => `${xf(j.day).toFixed(1)},${yf(j.ms).toFixed(1)}`).join(" ")}" fill="none" stroke="#a5b4fc" stroke-width="1.8"/>`;
    for (const j of hrvJudged) hrvSvg += `<circle cx="${xf(j.day).toFixed(1)}" cy="${yf(j.ms).toFixed(1)}" r="4" fill="${j.below ? "#FBBF24" : "#818cf8"}" stroke="#0D0D1C" stroke-width="1.5"><title>${esc(fmtDay(j.day))}: ${j.ms} ms${j.n != null ? ` from ${j.n} sample${j.n === 1 ? "" : "s"}` : ""}${j.q1 != null ? ` · own band before ${Math.round(j.q1)}–${Math.round(j.q3!)}` : ""}</title></circle>`;
    hrvSvg += `<text x="${xf(hrvJudged[0].day).toFixed(1)}" y="140" fill="#94a3b8" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${esc(fmtDay(hrvJudged[0].day)).toUpperCase()}</text><text x="520" y="140" text-anchor="end" fill="#94a3b8" font-size="10" font-family="JetBrains Mono, ui-monospace, monospace">${esc(fmtDay(hrvJudged[hrvJudged.length - 1].day)).toUpperCase()}</text>`;
  }
  // sleep rows in the window but no HRV: the wearable is not writing it
  const hrvAbsent = !hrvAll.some((r) => r.day > daysBack(today, 30)) && rows.some((r) => r.sleep_minutes != null && r.day > daysBack(today, 30));
  // The 7-night mean, the app's rule (data/met-thresholds.json nightHrv.rollingNights
  // / rollingMinNights): the writer's last 7 nights ending at the latest night, no
  // further back than 14 days, shown from 3 nights, against the same band.
  const m7Rows = lastV ? own.filter((r) => r.day <= lastV.day && r.day > daysBack(lastV.day, 14)).slice(-7) : [];
  const mean7 = m7Rows.length >= 3 ? (() => { const ms = Math.round(m7Rows.reduce((a, r) => a + r.ms, 0) / m7Rows.length); return { ms, nights: m7Rows.length, settled: m7Rows.length >= 7, status: hrvBand ? (ms < hrvBand.lo ? "below" : ms > hrvBand.hi ? "above" : "inside") : null }; })() : null;
  // The last four whole weeks, Monday to Sunday, newest first: each week's mean and
  // scatter (sample SD / mean, %), the scatter read against this person's own prior
  // 8 weeks (median and middle half; needs 3), the app's rule (nightHrv.scatter*).
  const mondayOf = (iso: string) => { const d = new Date(iso + "T00:00:00"); const back = (d.getDay() + 6) % 7; d.setDate(d.getDate() - back); return d; };
  const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weekCV = (startIso: string, endIsoExcl: string) => { const xs = own.filter((r) => r.day >= startIso && r.day < endIsoExcl).map((r) => r.ms); if (xs.length < 3) return null; const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); return { mean: Math.round(m), cv: Math.round((sd / m) * 1000) / 10, nights: xs.length }; };
  const thisMonday = mondayOf(today);
  const weekSpan = (i: number) => { const s = new Date(thisMonday); s.setDate(s.getDate() - 7 * (i + 1)); const e = new Date(thisMonday); e.setDate(e.getDate() - 7 * i); return { start: isoOf(s), end: isoOf(e) }; };
  const hrvWeeks = [0, 1, 2, 3].map((i) => {
    const sp = weekSpan(i); const w = weekCV(sp.start, sp.end);
    const priors = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => { const ps = weekSpan(i + k); return weekCV(ps.start, ps.end)?.cv ?? null; }).filter((v): v is number => v != null);
    const q = priors.length >= 3 ? quartilesOf(priors) : null;
    const status = w && q ? (w.cv < q.q1 ? "settled" : w.cv > q.q3 ? "unsettled" : "usual") : null;
    return { start: sp.start, endExcl: sp.end, mean: w?.mean ?? null, cv: w?.cv ?? null, nights: w?.nights ?? 0, status, usualCv: q ? Math.round(medianOf(priors)! * 10) / 10 : null };
  });
  const hrv = { latest: lastV?.ms ?? null, latestDay: lastV?.day ?? null, samples: lastV?.n ?? null, writer: hrvWriter, method: hrvMethod, otherWriters, usual: hrvUsual, band: hrvBand, priors: hrvPri.length,
    below: lastV != null && hrvBand != null && lastV.ms < hrvBand.lo, run: hrvRun, read: hrvRead, nightsBelow: hrvBelow, absent: hrvAbsent, svg: hrvSvg, series: hrvJudged, mean7, weeks: hrvWeeks };

  // The one pattern the Guide names: night HRV low, resting rate high and
  // recovery small, each against its own band, for the last 3 readings of
  // each, and all 9 readings within the last 10 days so the three agree
  // about the same stretch rather than three different weeks.
  const rhrJudgedAll = rhrRows.map((r) => { const pr = rhrRows.filter((x) => x.day >= daysBack(r.day, 30) && x.day < r.day).map((x) => x.bpm); const b = pr.length >= 14 ? medianOf(pr)! : null; return { day: r.day, high: b != null && r.bpm - b >= 5 }; });
  const lastThree = <T extends { day: string }>(xs: T[]) => xs.slice(-3);
  const trio = [lastThree(hrvJudged), lastThree(rhrJudgedAll), lastThree(hrrJudged)];
  const threeTogether = trio.every((t) => t.length === 3)
    && lastThree(hrvJudged).every((j) => j.below) && lastThree(rhrJudgedAll).every((j) => j.high) && lastThree(hrrJudged).every((j) => j.low)
    && trio.flat().every((j) => j.day > daysBack(today, 10));

  // steps: the last seven days, and the seven before
  const stepAvg = (from: string, to: string) => { const xs = rows.filter((r) => r.steps != null && r.day > from && r.day <= to).map((r) => Number(r.steps)); return xs.length ? { avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), n: xs.length } : null; };
  const s7 = stepAvg(daysBack(today, 7), today), s14 = stepAvg(daysBack(today, 14), daysBack(today, 7));
  const lastS = [...rows].reverse().find((r) => r.steps != null) ?? null;
  const steps = { avg: s7?.avg ?? null, days: s7?.n ?? 0, prior: s14?.avg ?? null, latest: lastS ? { day: String(lastS.day), steps: Number(lastS.steps) } : null };

  const first = rows[0]?.day ? String(rows[0].day) : today;
  const days = Math.round((new Date(today + "T00:00:00").getTime() - new Date(first + "T00:00:00").getTime()) / 86400000) + 1;
  return { days, rhr: { latest: latestR?.bpm ?? null, latestDay: latestR?.day ?? null, baseline, priors, delta, status, level, run, inBand, read, svg, series: rhrSeries }, sleep, hrr, hrv, threeTogether, steps };
}
export type SleepHeartSummary = NonNullable<ReturnType<typeof sleepHeartSummaryRaw>>;

let memo: { rows: any[]; today: string; out: ReturnType<typeof sleepHeartSummaryRaw> } | null = null;
/** The same rows and the same day give the same answer without the work again. */
export function sleepHeartSummary(rows: any[], today: string) {
  if (memo && memo.rows === rows && memo.today === today) return memo.out;
  const out = sleepHeartSummaryRaw(rows, today);
  memo = { rows, today, out };
  return out;
}
