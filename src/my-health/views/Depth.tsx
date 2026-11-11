/**
 * In depth (canvas "My health, redesigned", boards 13 and 5): the week that
 * closed on Sunday, then the longer view, then five of the Overview's cards,
 * one chapter each with one chart and one table, in the same units, then the
 * week's every number. A coach sees exactly this page, read-only. Every
 * figure is from the derive layer; the working for "The Guide's read" is
 * still published on a signal for the page.
 *
 * One section at a time (canvas "Verve on the web, refined", board 07): the
 * sidebar lists the eight, a press shows that one and nothing else, and the
 * arrows at its foot step to the one before and the one after. In depth has
 * no page of its own: it opens on Last week.
 */
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { derived, person, depthLocked, depthWorking, actions, section, setSection, sectionFor, fitUnit, setFitUnit, DEPTH_KEYS } from "../state.ts";
import { depthEmpty, depthEmptyText, depthOf } from "../derive/depth.ts";
import { addDays, dayWord, fmt1, fmtDay, medianOf, mondayOf, round0, todayStr } from "../derive/format.ts";
import { eventsFrom, labRowsFrom, restingBPOf } from "../derive/markers.ts";
import { activitySummary, dedupeSessions, doseOf, fitnessSummary, sourceWords, storeOf } from "../derive/activity.ts";
import { sleepHeartSummary } from "../derive/heart.ts";
import { lastWeekOf, snapshotOf, weekFiguresOf, weekSpanWords, dayMonth, dayMonthYear, type Snapshot } from "../derive/snapshot.ts";
import { bedWakeSvg, hm, nightsSvg, recoverySvg, testsSvg, weekBarsSvg, type NightSpan } from "../derive/charts.ts";
import { VO2_CAVEAT, metsOfTest, tierIndexFromCategory, tierIndexOf, tierRowFor, vo2OfTest } from "../derive/fitness.ts";
import { TIER_LABELS } from "../../data/fitness-tiers.ts";
import { efficiencyOf, fmtHMin, fmtSigned1, latestWith, rowOn, stagesOf, writerOf } from "../derive/signals.ts";
import { WeekTable } from "./Overview.tsx";
import { Pager } from "./Pager.tsx";

/** The eight sections, by the names the sidebar gives them. */
const DEPTH_TITLE: Record<(typeof DEPTH_KEYS)[number], string> = {
  lastweek: "Last week", snapshot: "Snapshot", fitness: "Fitness", vitals: "Vitals", sleep: "Sleep", exertion: "Exertion", movement: "Movement", everynumber: "The week, every number",
};

const DASH = "—";
const TONE: Record<string, string> = { good: "text-good", caution: "text-caution", concern: "text-concern", neutral: "text-text-2" };

/** The person's sleep and heart rows of the last 90 days, as a CSV the browser saves. */
function exportHeartRows(rows: any[], today: string, name: string) {
  const cols = ["day", "sleep_minutes", "sleep_start", "resting_hr", "hrr_bpm", "hrr_source", "hrv_night_ms", "hrv_n", "hrv_source", "hrv_method"];
  const cell = (v: unknown) => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `verve-sleep-heart-${(name || "me").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${today}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SNAP_KEY = "mh-snap";
const storedSnap = (): 3 | 6 | 12 => { try { const v = Number(localStorage.getItem(SNAP_KEY)); return v === 3 || v === 12 ? v : 6; } catch { return 6; } };

function Lock({ self, name }: { self: boolean; name: string }) {
  return (
    <div class="r-card flex max-w-2xl flex-col gap-3 border border-dashed border-accent-border bg-card p-5">
      <div class="t-title text-text">{self ? "In depth is on Pro." : "In depth on other people is on Max."}</div>
      <p class="t-small text-text-2">{self ? "The week that closed, the longer view and the six chapters with the working shown. Your Overview, Body and Reports stay as they are." : `${name || "This person"}'s Overview, Body and Reports are here as before. In depth on everyone you see comes with Max.`}</p>
      <div class="flex flex-wrap gap-2"><a href="/plans" class="r-btn inline-flex min-h-10 items-center bg-accent px-4 text-[13px] font-semibold text-canvas">See the plans</a><button type="button" onClick={() => actions.goTab("overview")} class="min-h-10 px-3 text-[13px] font-semibold text-text-2 hover:text-text">Not now</button></div>
    </div>
  );
}

/** A chapter's card: the page's heading names it, so the card opens with what its chart shows. */
const Chapter = ({ id, sub, children }: { id: string; sub: string; children: any }) => (
  <section id={`depth-${id}`} class="r-card border border-border bg-card p-5 sm:p-6">
    <p class="t-caption max-w-3xl text-text-3">{sub}</p>
    {children}
  </section>
);
const Svg = ({ w, h, inner, label }: { w: number; h: number; inner: string; label: string }) => inner
  ? <div class="mt-4 overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} class="block h-auto w-full min-w-[480px]" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: inner }} /></div>
  : <p class="t-small mt-4 text-text-3">Nothing to draw yet.</p>;
const Th = ({ t, right }: { t: string; right?: boolean }) => <th class={`t-eyebrow pb-2 font-medium ${right ? "text-right" : "text-left"}`}>{t}</th>;
const Td = ({ v, unit, tone, right = true }: { v: string; unit?: string; tone?: string; right?: boolean }) => (
  <td class={`py-2 ${right ? "text-right" : "text-left"}`}><span class={`t-figure-row ${v === DASH ? "text-text-3" : tone ?? "text-text"}`}>{v}</span>{unit && v !== DASH ? <span class="t-unit ml-1">{unit}</span> : null}</td>
);

export function Depth() {
  const d = derived.value, p = person.value;
  const locked = depthLocked.value;
  const today = todayStr();
  const unit = fitUnit.value;
  const cur = sectionFor("depth", section.value) as (typeof DEPTH_KEYS)[number];
  const [months, setMonths] = useState<3 | 6 | 12>(typeof localStorage === "undefined" ? 6 : storedSnap());
  const pickMonths = (m: 3 | 6 | 12) => { setMonths(m); try { localStorage.setItem(SNAP_KEY, String(m)); } catch { /* private mode */ } };
  const depth = useMemo(() => (d && p && !locked && !depthEmpty(d) ? depthOf(d, p, today) : null), [d, p, locked, today]);
  useEffect(() => { depthWorking.value = depth?.working ?? null; }, [depth]);
  const last = useMemo(() => (d ? lastWeekOf(d, today) : null), [d, today]);
  const snap: Snapshot | null = useMemo(() => (d ? snapshotOf(d, months, today) : null), [d, months, today]);
  if (!d || !p) return null;
  if (locked) return <Lock self={p.self} name={p.name} />;
  if (!depth || !last) return <p class="t-body max-w-3xl text-text-3">{depthEmptyText(p)}</p>;

  const monday = mondayOf(new Date());
  const heart = sleepHeartSummary(d.signals, today);
  const act = activitySummary(d.weeks, d.acts, d.goal, today, monday);
  const fit = fitnessSummary(d.crf, today);
  const writer = writerOf(d.signals, today);
  const store = storeOf(d.acts, today);
  const events = eventsFrom(d.labs, labRowsFrom(d.by, today), fit, act, today).slice(0, 3);
  const synced = d.signals.length ? String(d.signals[d.signals.length - 1].day) : String(d.doc.generated_at ?? "").slice(0, 10);

  // ── fitness ──
  const row = tierRowFor(d.profile?.age, d.profile?.sex);
  const inUnit = (m: number) => unit === "mets" ? m : m * 3.5;
  const tests = fit.tests.map((t) => ({ d: String(t.measured_on), v: Math.round(inUnit(metsOfTest(t) ?? t.v / 3.5) * 10) / 10, label: String(t.method ?? "").replace(/-/g, " "), maximal: t.max }));
  const tierIdx = fit.latest ? (tierIndexFromCategory(fit.latest.category) ?? (metsOfTest(fit.latest) != null ? tierIndexOf(metsOfTest(fit.latest)!, row) : null)) : null;
  const b = row.bounds;
  const edges = [null, b[0], b[1], b[2], b[3], null];
  const rangeOf = (i: number) => { const lo = edges[i], hi = edges[i + 1]; const f = (x: number) => unit === "mets" ? fmt1(x) : fmt1(x * 3.5); return lo == null ? `below ${f(hi!)}` : hi == null ? `above ${f(lo)}` : `${f(lo)} to ${f(hi)}`; };
  const you = fit.latest ? (unit === "mets" ? metsOfTest(fit.latest) : vo2OfTest(fit.latest)) : null;

  // ── vitals ──
  const rh = heart?.rhr ?? null;
  const rhBand = rh?.baseline != null ? { lo: rh.baseline - 5, hi: rh.baseline + 5 } : null;
  const nights = rh ? rh.series.map((j) => ({ day: j.day, v: j.bpm, off: j.above, title: `${fmtDay(j.day)}: ${j.bpm} bpm${j.b != null ? ` · median before ${Math.round(j.b)}` : ""}` })) : [];
  const weekDays = DAYS.map((_, i) => addDays(monday, i));
  const dayRow = (x: string) => rowOn(d.signals, x);
  const typedBP = (x: string) => { const s = (d.by.get("sbp") ?? []).find((q) => q.d === x), dd = (d.by.get("dbp") ?? []).find((q) => q.d === x); return s && dd ? `${round0(s.v)}/${round0(dd.v)}` : null; };
  const vitalRows: { label: string; unit: string; of: (x: string) => string | null }[] = [
    { label: "Resting HR", unit: "bpm", of: (x) => dayRow(x)?.resting_hr != null ? round0(Number(dayRow(x).resting_hr)) : null },
    { label: "HRV", unit: "ms", of: (x) => dayRow(x)?.hrv_night_ms != null ? round0(Number(dayRow(x).hrv_night_ms)) : null },
    { label: "Breathing", unit: "/min", of: (x) => dayRow(x)?.breathing_rpm != null ? fmt1(Number(dayRow(x).breathing_rpm)) : null },
    { label: "Blood oxygen", unit: "%", of: (x) => dayRow(x)?.spo2_pct != null ? round0(Number(dayRow(x).spo2_pct)) : null },
    { label: "Wrist temp", unit: "°C", of: (x) => { const r = dayRow(x); return r?.skin_temp_delta_c != null ? fmtSigned1(Number(r.skin_temp_delta_c)) : r?.wrist_temp_c != null ? fmt1(Number(r.wrist_temp_c)) : null; } },
    { label: "Blood pressure", unit: "", of: (x) => { const r = dayRow(x); return r?.bp_sbp != null && r?.bp_dbp != null ? `${round0(Number(r.bp_sbp))}/${round0(Number(r.bp_dbp))}` : typedBP(x); } },
  ];
  const bp = restingBPOf(d.by.get("sbp") ?? [], d.by.get("dbp") ?? []);

  // ── sleep ──
  const minsFrom18 = (iso: string, day: string) => { const t = new Date(iso).getTime(); const base = new Date(day + "T00:00:00").getTime() - 6 * 3600000; return Math.round((t - base) / 60000); };
  const last30 = d.signals.filter((r) => r.sleep_start && r.sleep_end && String(r.day) > addDays(today, -30));
  const starts = last30.map((r) => minsFrom18(r.sleep_start, String(r.day))), ends = last30.map((r) => minsFrom18(r.sleep_end, String(r.day)));
  const usual = starts.length >= 7 ? { start: medianOf(starts)!, end: medianOf(ends)! } : null;
  const nightSpans: NightSpan[] = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => {
    const r = dayRow(day);
    const s = r?.sleep_start ? minsFrom18(r.sleep_start, day) : null, e = r?.sleep_end ? minsFrom18(r.sleep_end, day) : null;
    return { day, label: new Date(day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }), startMin: s, endMin: e, late: !!(s != null && usual && s > usual.start + 45) };
  });
  const lastNight = heart?.sleep.last ? dayRow(heart.sleep.last.day) : null;
  const st = lastNight ? stagesOf(lastNight) : null;
  const sd = latestWith(d.signals, "bedtime_sd_min", today), sri = latestWith(d.signals, "sri_30d", today);
  const eff = lastNight ? efficiencyOf(lastNight) : null;
  const sleepRows: [string, string, string][] = [
    ["Usual bedtime", usual ? hm(usual.start) : DASH, usual ? `the median of ${starts.length} nights` : "needs seven nights with a window"],
    ["Spread of bedtimes", sd ? `± ${round0(Number(sd.bedtime_sd_min))} min` : DASH, sd ? (Number(sd.bedtime_sd_min) <= 30 ? "steady" : Number(sd.bedtime_sd_min) <= 60 ? "wanders a little" : "wanders") : "the app writes it on sync"],
    ["Regularity, 30 days", sri ? round0(Number(sri.sri_30d)) : DASH, sri ? (Number(sri.sri_30d) >= 87.3 ? "high" : Number(sri.sri_30d) >= 71.6 ? "middle" : "low") : "needs 30 nights"],
    ["Efficiency", eff != null ? `${eff} %` : DASH, eff != null ? (eff >= 85 ? "usual" : "under the 85 % mark") : "needs the in-bed window"],
    ["Stages", st ? `deep ${st.deep != null ? fmtHMin(st.deep) : DASH}${st.rem != null ? ` · REM ${fmtHMin(st.rem)}` : ""}` : DASH, st ? `${writer ?? "this writer"} writes stages` : `${writer ?? "this writer"} does not stage sleep`],
  ];

  // ── exertion ──
  const hr = heart?.hrr ?? null;
  const dots = hr ? hr.judged.map((j) => ({ day: j.day, v: j.bpm, low: j.low })) : [];
  const acts = dedupeSessions(d.acts);
  const inWeek = acts.filter((a) => new Date(a.timestamp).toLocaleDateString("en-CA") >= monday);
  const sessions = (inWeek.length ? inWeek : acts.slice(-7)).slice().reverse();
  const effortWord = (a: any) => a.activity_type === "strength" ? "Strength" : String(a.intensity_category ?? "").replace(/^\w/, (c) => c.toUpperCase()) || DASH;

  // ── movement ──
  const mondays = [3, 2, 1, 0].map((i) => addDays(monday, -7 * i));
  const byWeek = mondays.map((m) => ({ m, f: weekFiguresOf(d, m, today), cadence: (() => { const xs = d.signals.filter((r) => String(r.day) >= m && String(r.day) < addDays(m, 7) && r.cadence_spm != null).map((r) => Number(r.cadence_spm)); return xs.length ? Math.round(xs.reduce((a, b2) => a + b2, 0) / xs.length) : null; })() }));
  const bars = byWeek.map(({ m, f }) => ({ label: dayMonth(m).replace(/ (\w+)$/, (_s, mo) => ` ${String(mo).slice(0, 3)}`), dose: f.dose, goal: f.goal, current: m === monday }));
  const cell = (v: number | null, dp = 0) => v == null ? DASH : dp ? fmt1(v) : Math.round(v).toLocaleString();

  const at = DEPTH_KEYS.indexOf(cur);
  const chapter = cur === "fitness" || cur === "vitals" || cur === "sleep" || cur === "exertion" || cur === "movement";
  const seg = (on: boolean) => `r-btn min-h-8 px-3 text-[13px] font-semibold transition-colors ${on ? "bg-accent-fill text-accent-text" : "text-text-3 hover:text-text"}`;
  const unitSwitch = (
    <div class="r-btn flex w-fit gap-1 border border-border p-1" role="group" aria-label="Unit">
      <button type="button" class={seg(unit === "mets")} onClick={() => setFitUnit("mets")}>METs</button>
      <button type="button" class={seg(unit === "vo2")} onClick={() => setFitUnit("vo2")}>VO₂max</button>
    </div>
  );

  return (
    <div class="flex flex-col gap-5">
      {!p.self ? <p class="t-caption text-text-3">Viewing {p.name || "this person"} · read-only · synced {synced ? fmtDay(synced) : "—"} · the athlete's own words appear only in Messages</p> : null}
      <div>
        <div class="t-eyebrow">In depth <span aria-hidden="true">&rsaquo;</span> {DEPTH_TITLE[cur]}</div>
        {cur === "lastweek" ? <>
          <h1 class="t-display mt-2 text-text">Last week, complete. Then three, six or twelve months.</h1>
          <p class="t-body mt-3 max-w-3xl text-text-2">The Overview is this week so far. In depth opens with the week that closed on Sunday, the one the Guide read. The Snapshot puts the same markers and your blood work against the same date three, six or twelve months back, and each chapter after it is one chart and one table.</p>
          {events.length ? <div class="mt-4 flex flex-wrap gap-x-6 gap-y-1"><span class="t-eyebrow">What changed this week</span>{events.map((e) => <span key={e.d + e.text} class="t-small text-text-2"><span class="text-text-3">{dayWord(e.d)}</span> <span dangerouslySetInnerHTML={{ __html: e.text }} /></span>)}</div> : null}
        </> : cur === "everynumber" ? <h1 class="sr-only">{DEPTH_TITLE[cur]}</h1> : <>
          <h1 class="t-display mt-2 text-text">{cur === "snapshot" ? "The snapshot" : DEPTH_TITLE[cur]}</h1>
          {chapter ? <p class="t-small mt-2 max-w-3xl text-text-2">One chart and one table. Same order as the Overview, same units. METs stay METs, MET-minutes stay MET-minutes; VO₂max appears only as a second unit you choose.</p> : null}
        </>}
      </div>

      {/* ── last week ── */}
      {cur === "lastweek" ? <section id="depth-lastweek" class="r-card border border-border bg-card p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="t-title text-text">Last week · {weekSpanWords(last.week.start)}</h3>
          <span class="t-caption text-text-3">{last.counted}</span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {last.tiles.map((t) => (
            <div key={t.label} class="r-btn border border-border bg-alt p-3">
              <div class="t-caption text-text-2">{t.label}</div>
              <div class="mt-1.5 flex flex-wrap items-baseline gap-x-1.5"><span class={`t-figure text-[22px] ${t.figure === DASH ? "text-text-3" : "text-text"}`}>{t.figure}</span>{t.unit ? <span class="t-unit">{t.unit}</span> : null}</div>
              <div class="t-caption mt-1 text-text-3">{t.note}</div>
            </div>
          ))}
        </div>
        {(last.compared || last.fitnessLine) ? <p class="t-small mt-4 max-w-3xl text-text-2">{last.compared} {last.fitnessLine}</p> : null}
      </section> : null}

      {/* ── the snapshot ── */}
      {cur === "snapshot" ? <section id="depth-snapshot" class="r-card border border-border bg-card p-5 sm:p-6">
        <div class="flex flex-wrap items-center gap-3">
          <div class="r-btn flex gap-1 border border-border p-1" role="group" aria-label="Window">
            {([3, 6, 12] as const).map((m) => <button key={m} type="button" class={seg(months === m)} aria-pressed={months === m ? "true" : "false"} onClick={() => pickMonths(m)}>{m} months</button>)}
          </div>
        </div>
        <p class="t-small mt-2 max-w-3xl text-text-2">Each row is one thing, measured twice by the same writer: on or near {snap ? dayMonthYear(snap.anchor) : ""} and now. Blood values take the two reports nearest the window's ends. There is no score; the rows speak one at a time.</p>
        {snap && !snap.empty ? (
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[560px] border-collapse">
              <thead><tr><Th t="Marker" /><Th t={dayMonth(snap.anchor)} right /><Th t="Now" right /><Th t="Change" right /><Th t="Reads as" /></tr></thead>
              <tbody>
                {snap.groups.map((g) => (<>
                  <tr key={g.title}><td colSpan={5} class="t-eyebrow pb-1 pt-4 text-accent-text">{g.title}</td></tr>
                  {g.rows.map((r) => (
                    <tr key={g.title + r.label} class="border-t border-border">
                      <td class="t-small py-2 pr-3 text-text">{r.label}{r.unit ? <span class="t-unit ml-1.5">{r.unit}</span> : null}</td>
                      <Td v={r.then} tone="text-text-2" />
                      <Td v={r.now} />
                      <Td v={r.change} tone={r.change === "measured once" ? "text-text-3" : r.change.startsWith("+") || r.change.startsWith("−") ? "text-text" : "text-text-3"} />
                      <td class={`t-small py-2 pl-3 ${TONE[r.tone]}`}>{r.reads}</td>
                    </tr>
                  ))}
                </>))}
              </tbody>
            </table>
          </div>
        ) : <p class="t-small mt-4 text-text-3">Nothing measured twice in this window yet.</p>}
        <p class="t-caption mt-3 text-text-3">A marker measured once in the window shows its one value and date and no change. Lp(a) is never in this table. Units as on the Body page.</p>
      </section> : null}

      {/* ── the five chapters, one on the page ── */}
      {cur === "fitness" ? <Chapter id="fitness" sub={`${fit.tests.length ? "Twelve months of tests" : "No test on file"} · the shaded band is above average for your age and sex${unit === "vo2" ? " · the estimate carries a 7 to 16 % error" : ""}`}>
        <div class="mt-3">{unitSwitch}</div>
        <Svg w={560} h={160} inner={testsSvg(tests, { lo: inUnit(b[1]), hi: inUnit(b[2]) }, today, unit === "mets" ? "METs" : "mL/kg/min")} label="Fitness tests over twelve months" />
        {unit === "vo2" ? <p class="t-caption mt-2 text-text-3">{VO2_CAVEAT}</p> : null}
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[420px] border-collapse">
            <thead><tr><Th t="Tier for your age" /><Th t={unit === "mets" ? "METs" : "mL/kg/min"} right /><Th t="You" right /></tr></thead>
            <tbody>
              {TIER_LABELS.map((label, i) => (
                <tr key={label} class={`border-t border-border ${i === tierIdx ? "bg-accent-fill" : ""}`}>
                  <td class={`t-small py-2 pl-2 ${i === tierIdx ? "font-semibold text-text" : "text-text-2"}`}>{label}</td>
                  <Td v={rangeOf(i)} tone="text-text-2" />
                  <Td v={i === tierIdx && you != null ? fmt1(you) : ""} tone="text-accent-text" />
                </tr>
              ))}
            </tbody>
          </table>
          <p class="t-caption mt-2 text-text-3">Tiers for {row.age} · {String(d.profile?.sex ?? "").toLowerCase() === "female" ? "women" : "men"} · the app's table{fit.latest ? ` · last test ${fmtDay(fit.latest.measured_on)}` : ""}</p>
        </div>
      </Chapter> : null}

      {cur === "vitals" ? <Chapter id="vitals" sub="Resting heart rate, 28 nights · the band is your own normal, not a population range · blood pressure is the cuff's 30-day mean, a crisis reading named on its own">
        <Svg w={560} h={150} inner={nightsSvg(nights, rhBand, rh?.baseline ?? null, addDays(today, -27), today, "bpm")} label="Resting heart rate over 28 mornings with the person's own band" />
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[520px] border-collapse">
            <thead><tr><Th t="This week" />{weekDays.map((x, i) => <th key={x} class={`t-eyebrow pb-2 text-center ${x === today ? "text-accent-text" : ""}`}>{DAYS[i]}</th>)}</tr></thead>
            <tbody>
              {vitalRows.map((r) => (
                <tr key={r.label} class="border-t border-border">
                  <td class="t-small py-2 pr-2 text-text-2">{r.label}{r.unit ? <span class="t-unit ml-1">{r.unit}</span> : null}</td>
                  {weekDays.map((x) => { const v = x > today ? null : r.of(x); return <td key={x} class={`py-2 text-center font-mono text-[13px] ${v == null ? "text-text-3" : "font-semibold text-text"}`}>{x > today ? "·" : v ?? DASH}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
          {bp ? <p class="t-caption mt-2 text-text-3">Blood pressure, {bp.basis === "average" ? `the ${bp.days}-day mean of ${bp.n} readings` : bp.crisis ? "a crisis-level reading" : "one reading"}: {bp.sbp}/{bp.dbp} mmHg{bp.crisis ? ", acted on now, not averaged" : ""}.</p> : null}
          {depth.heartRows.length ? <button type="button" onClick={() => exportHeartRows(depth.heartRows, today, p.name)} class="t-caption mt-2 font-semibold text-accent-text hover:text-text">Export these {depth.heartRows.length} rows as CSV</button> : null}
        </div>
      </Chapter> : null}

      {cur === "sleep" ? <Chapter id="sleep" sub="The last seven nights, bed to wake · the band is your usual window · a night that ran late is marked">
        <Svg w={560} h={170} inner={bedWakeSvg(nightSpans, usual)} label="Seven nights from bedtime to waking, against the usual window" />
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[420px] border-collapse">
            <thead><tr><Th t="Timing" /><Th t="Value" right /><Th t="Reads as" /></tr></thead>
            <tbody>{sleepRows.map(([l, v, w]) => <tr key={l} class="border-t border-border"><td class="t-small py-2 text-text-2">{l}</td><Td v={v} /><td class="t-small py-2 pl-3 text-text-3">{w}</td></tr>)}</tbody>
          </table>
        </div>
      </Chapter> : null}

      {cur === "exertion" ? <Chapter id="exertion" sub="1-minute recovery after each session, 8 weeks · the band is your own middle half · the dotted line is the cited 12">
        <Svg w={560} h={140} inner={recoverySvg(dots, hr?.band ?? null, hr?.median ?? null, today)} label="Heart rate recovery after each session over eight weeks" />
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[520px] border-collapse">
            <thead><tr><Th t={inWeek.length ? "Session · this week" : "Session · the last seven"} /><Th t="Min" right /><Th t="Effort" right /><Th t="MET-min" right /><Th t="Writer" right /></tr></thead>
            <tbody>
              {sessions.length ? sessions.map((a) => {
                const day = new Date(a.timestamp).toLocaleDateString("en-CA"), dose = doseOf(a);
                return (
                  <tr key={a.id ?? a.timestamp} class="border-t border-border">
                    <td class="t-small py-2 text-text">{dayWord(day).split(" ")[0]} · {String(a.activity_name ?? "Session")}</td>
                    <Td v={String(Math.round(Number(a.duration_minutes) || 0))} />
                    <Td v={`${effortWord(a)}${a.effort != null ? ` · ${Number(a.effort)}/10` : ""}`} tone="text-text-2" />
                    <Td v={a.activity_type === "strength" || !dose ? DASH : String(Math.round(dose))} />
                    <Td v={sourceWords(a.source)} tone="text-text-3" />
                  </tr>
                );
              }) : <tr><td colSpan={5} class="t-small py-3 text-text-3">No sessions synced yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Chapter> : null}

      {cur === "movement" ? <Chapter id="movement" sub={`The weekly dose, four weeks · the dashed line is the ${last.week.goal.toLocaleString()} MET-min goal · the zones and the rest in the table`}>
        <Svg w={560} h={150} inner={weekBarsSvg(bars)} label="Weekly dose over four weeks against the goal" />
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[520px] border-collapse">
            <thead><tr><Th t="By week" />{byWeek.map(({ m }) => <Th key={m} t={m === monday ? "this week" : dayMonth(m)} right />)}</tr></thead>
            <tbody>
              {([
                ["Weekly dose", "MET-min", (x: typeof byWeek[number]) => cell(x.f.dose)],
                ["Zone 1 · 2 · 3", "min", (x: typeof byWeek[number]) => x.f.z1 == null && x.f.z2 == null && x.f.z3 == null ? DASH : `${cell(x.f.z1)} · ${cell(x.f.z2)} · ${cell(x.f.z3)}`],
                ["Strength", "sessions", (x: typeof byWeek[number]) => cell(x.f.strength)],
                ["Background movement", "min a day", (x: typeof byWeek[number]) => cell(x.f.background)],
                ["Steps a day", "", (x: typeof byWeek[number]) => cell(x.f.steps)],
                ["Cadence", "spm", (x: typeof byWeek[number]) => cell(x.cadence)],
              ] as [string, string, (x: typeof byWeek[number]) => string][]).map(([l, u, of]) => (
                <tr key={l} class="border-t border-border"><td class="t-small py-2 pr-2 text-text-2">{l}{u ? <span class="t-unit ml-1">{u}</span> : null}</td>{byWeek.map((x) => <Td key={x.m} v={of(x)} />)}</tr>
              ))}
            </tbody>
          </table>
          <p class="t-caption mt-2 text-text-3">A week the app has written is its figures; a week it has not yet is counted here from the synced sessions. A dash is nothing to show, never a zero.</p>
        </div>
      </Chapter> : null}

      {cur === "everynumber" ? <section id="depth-everynumber">
        {d.signals.length ? <>
          <WeekTable />
          <p class="t-caption mt-2 max-w-3xl text-text-3">The table that sat on the Overview, moved here whole. Monday to Sunday, one writer per day.</p>
          <p class="t-caption mt-1 max-w-3xl text-text-3">Where the readings come from: {writer ?? "the wearable"} writes heart rate, sleep and workouts to {store}; the iPhone writes steps; you enter labs. Verve reads the store, never the wearable.</p>
        </> : <p class="t-caption max-w-3xl text-text-3">The week, every number, fills in once the app's day rows arrive: in the app, Settings → Your data → Back up watch readings.</p>}
      </section> : null}

      <Pager at={at + 1} of={DEPTH_KEYS.length}
        prev={at > 0 ? { label: DEPTH_TITLE[DEPTH_KEYS[at - 1]], go: () => setSection(DEPTH_KEYS[at - 1]) } : null}
        next={at < DEPTH_KEYS.length - 1 ? { label: DEPTH_TITLE[DEPTH_KEYS[at + 1]], go: () => setSection(DEPTH_KEYS[at + 1]) } : null} />
    </div>
  );
}

export function mountDepth(root: HTMLElement) { render(<Depth />, root); }
