/**
 * The Overview's glance and its four sections, as views of the document
 * (step 3). Three mounts: the line under the greeting, the six cards,
 * and one section with its tiles and the open marker, drawn UNDER the
 * cards rather than in their place since 24 October 2026. Each reads the
 * signals in ../state and the derived person; a fresh document or a tap
 * re-renders only the nodes whose values changed, and the entrance
 * animation plays once per session (../motion).
 *
 * What Verve reads, the charts and the sessions list are still HTML
 * strings from the derive layer, set as innerHTML: the words and the
 * drawings are the same as before, only the frame around them diffs.
 */
import { render } from "preact";
import { useState } from "preact/hooks";
import { derived, person, ovSection, openMarkerKey, openRange, openYear, focusTile, setSection } from "../state.ts";
import { riseOnce } from "../motion.ts";
import { addDays, daysBetween, dayWord, esc, fmt1, fmtSleepMin, mondayOf, plural, round0, todayStr } from "../derive/format.ts";
import { bodyDueFrom, labRowsFrom, methodLabel, type Due } from "../derive/markers.ts";
import { activitySummary, actsByDay, fitnessSummary } from "../derive/activity.ts";
import { sleepHeartSummary } from "../derive/heart.ts";
import { labsJudged } from "../derive/labs.ts";
import { SEC_META, SEC_ORDER, RANGE_LABEL, SHELVES, alongsideHtml, chartSvg, drawnFor, workoutsListHtml, type Marker, type Rng, type SecKey } from "../derive/lenses.ts";

// ── the glance: six cards, one figure each, a sparkline with your normal, a chip, a writer ──
//
// Rebuilt 30 October 2026 from the canvas "Overview: your normal, the week,
// any wearable". Every card has the same seven parts: the name and its
// section dot; one figure, its unit in words and when; the sparkline with
// the person's own normal drawn through it as a labelled dashed line, the
// newest bar full; a chip with the change in the reading's own unit (never
// a percent), grey until a line is crossed; the span under the bars; one
// sentence a person would say; and who wrote the reading, to which store,
// and what that writer leaves out. The last line is what makes the page
// wearable-agnostic without pretending every wearable writes the same
// things: the elected day writer (daily_signals.steps_source), the HRV
// writer, and whether the night carried stages.

type Tone = "grey" | "good" | "warn" | "danger";
type Glance = {
  key: string; sec: SecKey; marker?: string; label: string; color: string;
  value: string; beside: string; line: string; spark: number[];
  /** The person's own normal, drawn through the bars. */
  norm?: { value: number; label: string } | null;
  /** The change, in the reading's own unit; its tone colours the figure and the newest bar too. */
  chip: { text: string; tone: Tone };
  /** Under the bars: first and last. */
  span: [string, string];
  /** Who wrote it, to which store, and what that writer leaves out. */
  writer: string;
};

const TONE: Record<Tone, string> = { grey: "", good: "#34d399", warn: "#FBBF24", danger: "#f87171" };
const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}${unit}`;
const shortDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase();

/** The day's elected writer, as the app names it; the newest in the window, else the store's own merge. */
function dayWriter(signals: any[], today: string): string | null {
  for (let i = signals.length - 1; i >= 0; i--) { const r = signals[i]; if (r?.steps_source && String(r.day) > addDays(today, -14)) return String(r.steps_source); }
  return null;
}

/** The six cards and the line under the greeting, from the derived person. */
function glanceOf(d: NonNullable<typeof derived.value>, self: boolean): { cards: Glance[]; line: string } {
  const today = todayStr(), thisMonday = mondayOf(new Date());
  const you = self ? "your" : "their";
  const heart = sleepHeartSummary(d.signals, today);
  const goal = d.goal;
  const act = d.weeks.length || d.acts.length ? activitySummary(d.weeks, d.acts, goal, today, thisMonday) : null;
  const fit = fitnessSummary(d.crf, today);
  const by = d.by;
  const dues = [...labRowsFrom(by, today).map((r) => r.due), fit.due, bodyDueFrom(by, today)]
    .filter((x): x is Due => !!x).sort((x, y) => x.days - y.days);
  const { outside, judged } = labsJudged(d.labs);
  const series = (key: string) => d.markers.find((m) => m.key === key)?.series() ?? [];
  const tail = (key: string, n: number) => series(key).slice(-n);
  const spanOf = (pts: { d: string }[], right = "TODAY"): [string, string] => pts.length ? [shortDay(pts[0].d), pts[pts.length - 1].d === today ? right : shortDay(pts[pts.length - 1].d)] : ["", ""];
  const writer = dayWriter(d.signals, today);
  const who = writer ? esc(writer) : "Your wearable";
  const store = "the phone's health store";
  const cards: Glance[] = [];
  // fitness: the latest test, in METs, and when the next is due
  { const l = fit.latest;
    const mets = l ? (l.met_capacity != null ? Number(l.met_capacity) : l.v / 3.5) : null;
    const ago = l ? daysBetween(l.measured_on, today) : 0;
    const dueLine = fit.due ? (fit.due.days < 0 ? ` A retest is ${plural(-fit.due.days, "day")} overdue.` : fit.due.days === 0 ? " A retest is due today." : ` Next test in ${plural(fit.due.days, "day")}.`) : "";
    const pts = tail("mets", 10);
    const prev = fit.prevSame ? (fit.prevSame.met_capacity != null ? Number(fit.prevSame.met_capacity) : fit.prevSame.v / 3.5) : null;
    cards.push({ key: "fitness", sec: "fitness", label: "Fitness", color: SEC_META.fitness.dot, value: mets != null ? fmt1(mets) : "—",
      beside: l ? "METs" : "no test on file", spark: pts.map((x) => x.v),
      norm: prev != null ? { value: prev, label: `last test ${fmt1(prev)}` } : null,
      chip: { text: fit.trendWord || (l ? "first test" : "—"), tone: fit.trendWord === "rising" ? "good" : fit.trendWord === "falling" ? "warn" : "grey" },
      span: pts.length ? [shortDay(pts[0].d), `${shortDay(pts[pts.length - 1].d)} · ${plural(pts.length, "TEST").toUpperCase()}`] : ["", ""],
      line: l ? `By the ${esc(methodLabel(l.method))}, ${ago === 0 ? "today" : `${plural(ago, "day")} ago`}.${dueLine}` : "The app offers a test in six to twelve minutes.",
      writer: "<b>Verve's own test</b> · no wearable needed" }); }
  // movement: the week against the goal, a bar a day, the week before as the chip
  { const tw = act?.thisWeek ? Number(act.thisWeek.dose_met_min) : 0, n = act?.thisWeek ? Number(act.thisWeek.workouts) : 0, gd = act?.goalDose ?? Math.round(goal * 60);
    const byDay = actsByDay(d.acts);
    const z2 = [...byDay].filter(([x]) => x >= thisMonday).reduce((t, [, r]) => t + r.z2, 0);
    const lastRow = act?.weeks.find((w: any) => String(w.week_start) === addDays(thisMonday, -7));
    const steps = heart?.steps.avg;
    const days = Array.from({ length: 7 }, (_, i) => addDays(thisMonday, i)).filter((x) => x <= today);
    const spark = days.map((x) => byDay.get(x)?.dose ?? 0);
    const lastDose = lastRow ? Number(lastRow.dose_met_min) : null;
    cards.push({ key: "movement", sec: "movement", label: "Movement", color: SEC_META.movement.dot, value: act ? round0(tw) : "—",
      beside: act ? `of ${gd.toLocaleString()} MET-minutes this week` : "nothing from the app yet", spark,
      norm: act ? { value: gd / 7, label: `goal ${gd.toLocaleString()} a week` } : null,
      chip: { text: lastDose != null ? `${signed(tw - lastDose, "")} vs last week` : act ? "first week" : "—", tone: "grey" },
      span: ["MON", today < addDays(thisMonday, 6) ? `${new Date(today + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()} · ${7 - days.length} TO GO` : "SUN"],
      line: act ? `${n === 0 ? "No workout yet this week" : plural(n, "workout")}${z2 ? `, ${round0(z2)} min in Zone 2` : ""}${steps ? `, ${steps.toLocaleString()} steps a day` : ""}.${lastDose != null ? ` Last week ended at ${round0(lastDose)}.` : ""}` : "Cloud sync in the app fills this in.",
      writer: act ? `<b>${who}</b> → ${store} · workouts and heart rate` : "<b>Any wearable</b> that writes workouts to the phone's health store" }); }
  // sleep: last night against the person's own usual, the night's writer and whether it staged
  { const sl = heart?.sleep.last ?? null, usual = heart?.sleep.usual ?? null;
    const pts = tail("sleep", 14);
    const staged = sl ? d.signals.find((r) => String(r.day) === sl.day)?.sleep_staged : null;
    const dd = sl && usual != null ? sl.min - usual : null;
    const line = sl ? (usual != null ? (Math.abs(dd!) < 20 ? `About ${you} usual of ${fmtSleepMin(usual)}.` : `${fmtSleepMin(Math.abs(dd!))} ${dd! < 0 ? "under" : "over"} ${you} usual of ${fmtSleepMin(usual)}.`) : sl.band === "short" ? "Under seven hours. A usual comes after seven nights." : "A usual comes after seven nights.") : "Whatever you wear writes its nights to the phone's health store; the app syncs them here.";
    cards.push({ key: "sleep", sec: "heart", marker: "sleep", label: "Sleep", color: "#a5b4fc", value: sl ? fmtSleepMin(sl.min) : "—",
      beside: sl ? (sl.day === today ? "last night" : `night of ${esc(dayWord(sl.day))}`) : "nothing from a wearable yet", spark: pts.map((x) => x.v),
      norm: usual != null ? { value: usual, label: `usual ${fmtSleepMin(usual)}` } : null,
      chip: { text: dd != null ? `${signed(dd, " min")}` : sl ? "first nights" : "—", tone: sl?.band === "short" ? "warn" : "grey" },
      span: pts.length ? [shortDay(pts[0].d), `${pts[pts.length - 1].d === today ? "TODAY" : shortDay(pts[pts.length - 1].d)} · ${pts.length} OF 14 NIGHTS`] : ["", ""],
      line,
      writer: sl ? `<b>${who}</b> → ${store} · ${staged ? "asleep intervals with stages" : "asleep intervals, no stages from this writer"}` : "<b>Any wearable</b> worn to bed that writes to the phone's health store" }); }
  // resting heart rate: this morning against the median of the 30 before
  { const r = heart?.rhr;
    const pts = tail("rhr", 14);
    const tone: Tone = r?.status === "stronglyElevated" ? "danger" : r?.status === "elevated" ? "warn" : "grey";
    const line = r?.latest != null ? (r.baseline != null
      ? ((r.status === "elevated" || r.status === "stronglyElevated") && r.delta ? `${Math.abs(r.delta)} above ${you} own normal of ${r.baseline}${r.run > 1 ? `, ${r.run} mornings running` : ""}. Amber from +5, rose from +10.` : r.delta === 0 ? `At ${you} own normal of ${r.baseline}. Amber from +5, rose from +10.` : `${Math.abs(r.delta!)} ${r.delta! > 0 ? "above" : "under"} ${you} own normal of ${r.baseline}. Amber from +5, rose from +10.`)
      : `A normal needs 14 mornings; ${r.priors} so far.`) : "Whatever you wear writes one resting figure a morning to the phone's health store.";
    cards.push({ key: "rhr", sec: "heart", marker: "rhr", label: "Resting heart rate", color: SEC_META.heart.dot, value: r?.latest != null ? String(r.latest) : "—",
      beside: r?.latest != null ? (r.latestDay === today ? "bpm this morning" : `bpm, ${esc(dayWord(r.latestDay!))}`) : "nothing from a wearable yet", spark: pts.map((x) => x.v),
      norm: r?.baseline != null ? { value: r.baseline, label: `normal ${r.baseline}` } : null,
      chip: { text: r?.delta != null ? signed(r.delta, " bpm") : r?.latest != null ? `${r.priors} of 14 mornings` : "—", tone },
      span: spanOf(pts), line,
      writer: r?.latest != null ? `<b>${who}</b> → ${store} · one figure a morning` : "<b>Any wearable</b> worn overnight that writes a resting rate" }); }
  // recovery: the drop after the last workout, against the own median and the one cited line
  { const h = heart?.hrr;
    const pts = tail("hrr", 7);
    const src = h?.latestDay ? d.signals.find((r) => String(r.day) === h.latestDay)?.hrr_source : null;
    const under = h?.latest != null && h.latest <= 12;
    cards.push({ key: "hrr", sec: "heart", marker: "hrr", label: "Recovery", color: "#22C55E", value: h?.latest != null ? `↓${h.latest}` : "—",
      beside: h?.latest != null ? `bpm after the last workout${h.latestDay && h.latestDay !== today ? `, ${esc(dayWord(h.latestDay))}` : ""}` : "nothing after a workout yet", spark: pts.map((x) => x.v),
      norm: h?.median != null ? { value: h.median, label: `median ${h.median}` } : null,
      chip: { text: under ? "under the line" : h?.median != null && h?.latest != null ? (Math.abs(h.latest - h.median) < 3 ? "steady" : signed(h.latest - h.median, " vs median")) : h?.latest != null ? "first readings" : "—", tone: under ? "danger" : "grey" },
      span: pts.length ? [plural(pts.length, "WORKOUT").toUpperCase(), "THE LINE IS 12"] : ["", ""],
      line: h?.latest != null ? `${h.median != null ? `${you.charAt(0).toUpperCase()}${you.slice(1)} own 30-day median is ${h.median}. ` : ""}The line is 12 (Cole 1999).` : "A wearable records one after a workout that ends above the Zone 2 floor.",
      writer: h?.latest != null ? (src === "derived" ? `<b>Derived by Verve</b> from ${who === "Your wearable" ? "the wearable's" : `${who}'s`} heart rate after each workout` : src === "apple" ? `<b>${who}</b> → ${store} · its own reading after each workout` : `<b>${who}</b> and <b>Verve</b> · the wearable's own readings, and ones derived from its heart rate`) : "<b>Any wearable</b> that writes heart rate through and after a workout" }); }
  // body: waist to height when both are known, the grip, the count, and what is due
  { const waist = (by.get("waist_cm") ?? []).slice(-1)[0] ?? null, grip = (by.get("handgrip_kg") ?? []).slice(-1)[0] ?? null;
    const height = Number(d.profile?.height_cm) || null;
    const whr = waist && height ? waist.v / height : null;
    const read = [...by.values()].filter((v) => v.length).length;
    const due = dues[0] ?? null;
    const dueText = due ? (due.days < 0 ? ` ${esc(due.what)} is ${plural(-due.days, "day")} overdue.` : due.days === 0 ? ` ${esc(due.what)} is due today.` : due.days <= 31 ? ` ${esc(due.what)} is due in ${plural(due.days, "day")}.` : "") : "";
    const pts = whr != null && height ? (by.get("waist_cm") ?? []).slice(-8).map((p) => ({ d: p.d, v: p.v / height })) : grip ? (by.get("handgrip_kg") ?? []).slice(-8) : [];
    cards.push({ key: "body", sec: "body", label: "Body", color: SEC_META.body.dot, value: whr != null ? whr.toFixed(2) : grip ? fmt1(grip.v) : read ? String(read) : "—",
      beside: whr != null ? "waist to height" : grip ? "kg grip" : read ? "markers read" : "nothing read yet", spark: pts.map((x) => x.v),
      norm: whr != null ? { value: 0.5, label: "line 0.5" } : null,
      chip: due && due.days <= 31 ? { text: due.days < 0 ? `${esc(due.what)} overdue` : `${esc(due.what)} due`, tone: "warn" } : outside ? { text: `${outside} outside range`, tone: "warn" } : { text: judged ? "all in range" : read ? `${read} read` : "—", tone: "grey" },
      span: pts.length ? [String(pts[0].d).slice(0, 4), `${shortDay(pts[pts.length - 1].d)} · ${plural(pts.length, "READING").toUpperCase()}`] : ["", ""],
      line: `${read ? `${plural(read, "marker")} read${outside ? `, ${outside} outside ${outside === 1 ? "its" : "their"} range` : judged ? ", all in range" : ""}.` : "No marker read yet: drop a report on Reports."}${dueText}`,
      writer: "<b>Typed, and from reports</b> · no wearable writes these" }); }

  // the line under the greeting
  const bits: string[] = [];
  if (act?.thisWeek) { const tw = Number(act.thisWeek.dose_met_min), gd = act.goalDose; bits.push(tw >= gd ? "a week past the goal" : tw >= gd / 2 ? "halfway to the week's goal" : "a quiet week so far"); }
  if (heart?.sleep.last && heart.sleep.usual != null) { const dd = heart.sleep.last.min - heart.sleep.usual; bits.push(Math.abs(dd) < 20 ? "sleep as usual" : dd < 0 ? "sleep a little short" : "sleep a little long"); }
  if (outside) bits.push(`${plural(outside, "lab value")} outside range`);
  if (dues[0] && dues[0].days <= 31) bits.push(dues[0].days < 0 ? `${dues[0].what.toLowerCase()} overdue` : "one retest due this month");
  const line = bits.length ? `${bits[0].charAt(0).toUpperCase()}${bits[0].slice(1)}${bits.slice(1).map((x) => `, ${x}`).join("")}.` : "";
  return { cards, line };
}

/** The last readings as bars, the newest full, the person's normal through them as a labelled dashed line. */
function Spark({ values, color, norm, tone }: { values: number[]; color: string; norm?: { value: number; label: string } | null; tone: Tone }) {
  if (values.length < 2) return <span class="block h-11" aria-hidden="true"></span>;
  const all = norm ? [...values, norm.value] : values;
  const hi = Math.max(...all), lo = Math.min(...all), range = hi - lo;
  const y = (v: number) => (range > 0 ? 20 + Math.round(((v - lo) / range) * 76) : 60);
  const last = values.length - 1;
  return (
    <span class="relative block h-11" aria-hidden="true">
      <span class="flex h-11 items-end gap-[3px]">
        {values.map((v, i) => <span key={i} class="flex-1 rounded-t-[2px]" style={{ height: `${y(v)}%`, background: i === last && TONE[tone] ? TONE[tone] : color, opacity: i === last ? 1 : 0.5 }}></span>)}
      </span>
      {norm && <>
        <span class="absolute left-0 right-0 border-t border-dashed border-text-secondary" style={{ bottom: `${y(norm.value)}%` }}></span>
        <span class="absolute right-0 bg-canvas px-[3px] font-mono text-[9px] text-text-secondary" style={{ bottom: `${y(norm.value)}%`, transform: "translateY(55%)" }}>{norm.label}</span>
      </>}
    </span>
  );
}

const GLANCE_FRAMES = ["Fitness", "Movement", "Sleep", "Resting heart rate", "Recovery", "Body"];
function Frame({ label }: { label: string }) {
  return (
    <div class="flex min-h-[220px] flex-col gap-3.5 rounded-[20px] border border-white/10 bg-white/[0.03] p-6" aria-hidden="true">
      <span class="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{label}</span>
      <span class="mt-1 h-10 w-28 animate-pulse rounded-md bg-white/[0.05]"></span>
      <span class="h-11 w-full animate-pulse rounded bg-white/[0.03]"></span>
      <span class="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.04]"></span>
    </div>
  );
}

export function GlanceLine() {
  const d = derived.value;
  const text = d ? glanceOf(d, !!person.value?.self).line : "";
  return <>{text}</>;
}

/** Fourteen dots under the greeting: a day with a night or a resting rate is full, steps alone half, nothing empty. */
export function DaysWithData() {
  const d = derived.value;
  if (!d) return null;
  const today = todayStr();
  const byDay = new Map<string, any>(d.signals.map((r) => [String(r.day), r]));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const kind = (r: any) => !r ? "none" : (r.sleep_minutes != null || r.resting_hr != null) ? "full" : r.steps != null ? "part" : "none";
  const nights = days.filter((x) => byDay.get(x)?.sleep_minutes != null).length;
  const mornings = days.filter((x) => byDay.get(x)?.resting_hr != null).length;
  const writers = [...new Set(days.map((x) => byDay.get(x)?.steps_source).filter(Boolean).map(String))];
  if (!d.signals.length) return null;
  return (
    <div class="flex flex-col items-start gap-2 sm:items-end">
      <span class="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Days with data · last 14</span>
      <span class="flex gap-[5px]" role="img" aria-label={`Days with data in the last fourteen: ${nights} nights, ${mornings} mornings`}>
        {days.map((x) => { const k = kind(byDay.get(x)); return <span key={x} title={`${dayWord(x)}: ${k === "full" ? "a night or a resting rate" : k === "part" ? "steps only" : "nothing in the store"}`} class="h-2.5 w-2.5 rounded-full" style={{ background: k === "full" ? "#818cf8" : k === "part" ? "rgba(129,140,248,0.45)" : "rgba(255,255,255,0.1)" }}></span>; })}
      </span>
      <span class="font-mono text-[10px] text-text-tertiary">{nights} nights · {mornings} mornings{writers.length ? ` · ${esc(writers.join(", "))}` : ""}</span>
    </div>
  );
}

/** Your week: Monday to Sunday across, the five signals down, straight from the daily signals. */
export function WeekTable() {
  const d = derived.value;
  if (!d || !d.signals.length) return null;
  const today = todayStr(), mon = mondayOf(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const byDay = new Map<string, any>(d.signals.map((r) => [String(r.day), r]));
  const dose = actsByDay(d.acts);
  const heart = sleepHeartSummary(d.signals, today);
  const base = heart?.rhr.baseline ?? null;
  type Row = { label: string; unit: string; of: (x: string) => number | null; fmt: (v: number) => string; tone: (v: number) => string };
  const rows: Row[] = [
    { label: "Sleep", unit: "h", of: (x) => byDay.get(x)?.sleep_minutes != null ? byDay.get(x).sleep_minutes / 60 : null, fmt: (v) => v.toFixed(1), tone: (v) => v < 7 ? "text-warning" : "" },
    { label: "Resting heart rate", unit: "bpm", of: (x) => byDay.get(x)?.resting_hr ?? null, fmt: (v) => round0(v), tone: (v) => base != null && v - base >= 10 ? "text-danger" : base != null && v - base >= 5 ? "text-warning" : "" },
    { label: "Recovery", unit: "↓bpm", of: (x) => byDay.get(x)?.hrr_bpm ?? null, fmt: (v) => round0(v), tone: (v) => v <= 12 ? "text-danger" : "" },
    { label: "Dose", unit: "MET-min", of: (x) => x <= today ? (dose.get(x)?.dose ?? 0) : null, fmt: (v) => round0(v), tone: () => "" },
    { label: "Sitting", unit: "h", of: (x) => byDay.get(x)?.sedentary_minutes != null ? byDay.get(x).sedentary_minutes / 60 : null, fmt: (v) => v.toFixed(1), tone: (v) => v >= 12 ? "text-danger" : v >= 10.6 ? "text-warning" : "" },
  ];
  const wd = (x: string) => new Date(x + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
  return (
    <div class="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 sm:px-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <span class="text-lg font-extrabold tracking-[-0.02em] text-text-primary">Your week</span>
        <span class="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{dayWord(mon)} – {dayWord(addDays(mon, 6))} · from the daily signals</span>
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[520px] border-collapse">
          <thead><tr>
            <th class="w-[150px]"></th>
            {days.map((x) => <th key={x} class={`pb-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${x === today ? "rounded-t-md bg-accent/[0.08] text-accent-light" : "text-text-tertiary"}`}>{wd(x)}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} class="border-t border-white/[0.06]">
                <td class="py-2 pr-2 text-[13px] text-text-secondary">{r.label} <span class="font-mono text-[10px] text-text-muted">{r.unit}</span></td>
                {days.map((x) => { const v = r.of(x); const future = x > today; return <td key={x} class={`py-2 text-center font-mono text-[13px] ${x === today ? "bg-accent/[0.08]" : ""} ${v == null ? "text-text-muted" : `font-semibold ${r.tone(v) || "text-text-primary"}`}`}>{future ? "·" : v == null ? "—" : r.fmt(v)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-[11.5px] text-text-tertiary">A dash is a day the store holds nothing for; a dot is a day not yet here. Colour only where a line is crossed: sleep under 7 h, a resting rate 5 over normal, a recovery under 12, sitting past 10.6 h.</p>
    </div>
  );
}

export function Glance() {
  const d = derived.value;
  if (!d) return <>{GLANCE_FRAMES.map((l) => <Frame key={l} label={l} />)}</>;
  const { cards } = glanceOf(d, !!person.value?.self);
  const rise = riseOnce("glance");
  const sec = ovSection.value, mk = openMarkerKey.value;
  const open = (c: Glance) => { setSection(c.sec); if (c.marker) openMarkerKey.value = c.marker; };
  const isOn = (c: Glance) => sec !== "all" && sec === c.sec && (c.marker ? mk === c.marker : !["sleep", "rhr", "hrr"].includes(mk));
  return (
    <>
      {cards.map((c, i) => {
        const on = isOn(c);
        const tc = TONE[c.chip.tone];
        return (
          <button key={c.key} type="button" style={{ "--i": i } as any} aria-expanded={on ? "true" : "false"} onClick={() => on ? setSection("all") : open(c)}
            class={`${rise} flex min-h-[220px] flex-col gap-3 rounded-[20px] border p-5 text-left transition-colors sm:p-6 ${on ? "border-accent/60 bg-accent/[0.07]" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"}`}>
            <span class="flex items-center gap-2"><span class="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }}></span><span class="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">{c.label}</span>
              <span class="ml-auto rounded-full border px-2 py-[3px] font-mono text-[10.5px] font-semibold" style={{ borderColor: tc ? tc + "99" : "rgba(255,255,255,0.12)", color: tc || "#94a3b8" }} dangerouslySetInnerHTML={{ __html: c.chip.text }} />
              {on ? <span class="text-[12px] font-bold text-accent-light">▾</span> : null}</span>
            <span class="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span class="font-mono text-[40px] font-bold leading-none tracking-[-0.02em]" style={{ color: tc || c.color }}>{c.value}</span><span class="text-[14px] text-text-secondary" dangerouslySetInnerHTML={{ __html: c.beside }} /></span>
            <Spark values={c.spark} color={c.color} norm={c.norm} tone={c.chip.tone} />
            {c.span[0] || c.span[1] ? <span class="flex justify-between font-mono text-[9.5px] text-text-tertiary"><span>{c.span[0]}</span><span>{c.span[1]}</span></span> : null}
            <span class="text-[14px] leading-[1.55] text-text-secondary" dangerouslySetInnerHTML={{ __html: c.line }} />
            <span class="mt-auto text-[11.5px] leading-snug text-text-tertiary [&_b]:font-semibold [&_b]:text-text-secondary" dangerouslySetInnerHTML={{ __html: c.writer }} />
          </button>
        );
      })}
    </>
  );
}

// ── one section: its markers as tiles, one of them open ──────────────────────

function Tile({ m, i, on, out, rise, dim, onTap }: { m: Marker; i: number; on: boolean; out: boolean; rise: string; dim: boolean; onTap: () => void }) {
  const pts = m.series(); const l = pts[pts.length - 1] ?? null;
  const t = m.tile ? m.tile() : null;
  if (t) out = t.out;
  return (
    <button type="button" style={{ "--i": i } as any} aria-current={on ? "true" : "false"} onClick={onTap}
      class={`${rise}${dim ? " mh-dim" : ""} flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition-colors ${on ? "border-accent/60 bg-accent/[0.08]" : l ? "border-white/8 bg-white/4 hover:border-white/16" : "border-dashed border-white/10 hover:border-white/20"}`}>
      <span class="text-[12px] text-text-secondary">{m.label}</span>
      <span class={`font-mono text-[20px] font-bold leading-none ${l ? (out ? "text-warning" : "text-text-primary") : "text-text-muted"}`}>
        {t ? t.headline : l ? (m.pointLabel ? m.pointLabel(l) : m.fmt(l.v)) : "—"}{l && m.unit ? <> <span class="text-[10px] text-text-tertiary">{m.unit}</span></> : null}
      </span>
      <span class="text-[11.5px] leading-snug text-text-tertiary">{t ? t.sub : l ? (l.d === todayStr() ? "today" : dayWord(l.d)) : "not read yet"}</span>
    </button>
  );
}

const Kicker = ({ text }: { text: string }) => <div class="font-mono text-[10px] font-semibold tracking-[0.12em] text-text-tertiary">{text}</div>;

export function Section() {
  const [dimTo, setDimTo] = useState<string | null>(null);
  const sec = ovSection.value;
  const d = derived.value;
  if (sec === "all") return null;
  const meta = SEC_META[sec];
  const ms = d ? d.markers.filter((m) => m.section === sec) : [];
  const have = ms.filter((m) => m.series().length);
  // Nothing is open until a tile is tapped, except in a short section (six
  // tiles or fewer), which opens its first marker itself: the chart sits
  // right under the grid and reads as part of it. Body, three shelves
  // deep, waits for a tap. A marker of another section is not this one's.
  const wanted = openMarkerKey.value && ms.some((m) => m.key === openMarkerKey.value) ? openMarkerKey.value : "";
  const openKey = wanted || (ms.length <= 6 && ms.length ? (have[0] ?? ms[0]).key : "");
  const open = openKey ? ms.find((m) => m.key === openKey) ?? null : null;
  const outKeys = d ? new Set(labRowsFrom(d.by, todayStr()).filter((r) => r.out).map((r) => r.key)) : new Set<string>();
  const rise = riseOnce(`tiles:${sec}`);
  const focus = focusTile.value && open;
  const tap = (m: Marker) => {
    if (focusTile.value) { openMarkerKey.value = m.key; openRange.value = ""; openYear.value = null; return; }
    // the others fade and blur, then the page redraws with this one alone and its marker right under it
    setDimTo(m.key);
    setTimeout(() => { openMarkerKey.value = m.key; openRange.value = ""; openYear.value = null; focusTile.value = true; setDimTo(null); }, 220);
  };
  const tile = (m: Marker, i: number) => <Tile key={m.key} m={m} i={i} on={m.key === openKey} out={outKeys.has(m.key)} rise={rise} dim={dimTo != null && dimTo !== m.key} onTap={() => tap(m)} />;

  return (
    <>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="font-mono text-[10px] font-semibold tracking-[0.14em] text-text-tertiary">OVERVIEW · {meta.label.toUpperCase()} · {sec === "body" ? "FROM THE APP AND THE REPORTS" : "FROM THE APP"}</div>
          <h2 class="mt-1.5 flex items-center gap-2.5 text-[24px] font-extrabold tracking-[-0.02em] text-text-primary"><span class="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.dot }}></span><span>{meta.label}</span></h2>
          <p class="mt-1.5 text-[13px] text-text-tertiary">{meta.blurb}</p>
        </div>
        <div class="flex items-center gap-4">
          <a href={meta.science} class="text-[13px] font-medium text-accent-light hover:text-text-primary">The science behind these &rarr;</a>
          <button type="button" onClick={() => setSection("all")} class="min-h-9 rounded-full border border-white/14 px-3.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-white/30 hover:text-text-primary">Close ▴</button>
        </div>
      </div>
      <div class="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {focus
          ? <div class="col-span-full flex flex-wrap items-center gap-3">{tile(open!, 0)}<button type="button" onClick={() => { focusTile.value = false; openMarkerKey.value = ""; }} class="min-h-9 rounded-full border border-white/14 px-3.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-white/30 hover:text-text-primary">All markers</button></div>
          : sec === "body"
          ? SHELVES.map(([g, name]) => { const gm = ms.filter((m) => m.group === g); if (!gm.length) return null; const read = gm.filter((m) => m.series().length).length; return (
              <>
                <div key={`shelf:${g}`} class="col-span-full mt-2 flex items-baseline gap-2 first:mt-0"><span class="font-mono text-[10px] font-semibold tracking-[0.14em] text-text-tertiary">{name.toUpperCase()} · {gm.length}</span><span class="text-[11px] text-text-muted">{read} of {gm.length} read</span></div>
                {gm.map((m) => tile(m, ms.indexOf(m)))}
              </>); })
          : ms.map(tile)}
      </div>
      <div class="mt-4">{open && d ? <OpenMarker open={open} markers={d.markers} acts={d.acts} out={outKeys.has(open.key)} /> : null}</div>
    </>
  );
}

function OpenMarker({ open, markers, acts, out }: { open: Marker; markers: Marker[]; acts: any[]; out: boolean }) {
  // the app's Over Time lenses, by the same names, drawing the same bars
  const ranges: Rng[] = open.daily ? ["week", "4w", "months", "years"] : ["6m", "1y", "all"];
  const range: Rng = openRange.value && ranges.includes(openRange.value as Rng) ? (openRange.value as Rng) : open.daily ? "week" : "1y";
  const year = openYear.value;
  const dr = drawnFor(open, range, year);
  // the years on file, newest first, for the year menu under Years and All
  const years = [...new Set(open.series().map((p) => Number(p.d.slice(0, 4))))].sort((a, b) => b - a);
  const yearMenu = (open.daily ? range === "years" : range === "all") && years.length;
  const band = open.daily && range === "week" ? (open.band?.() ?? null) : null;
  const pts = open.series();
  const reads = [...open.reads(pts), ...(open.rangeReads?.(range, year) ?? [])];
  const t = todayStr();
  const monthAgg = (from: string, to: string) => { const xs = pts.filter((p) => p.d >= from && p.d <= to).map((p) => p.v); return xs.length ? { v: open.sum ? xs.reduce((a, b) => a + b, 0) : xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length } : null; };
  const m30 = monthAgg(addDays(t, -29), t), y1 = monthAgg(addDays(t, -364), t), y2 = monthAgg(addDays(t, -729), addDays(t, -365));
  const alongside = dr && open.daily && range === "week" ? alongsideHtml(markers, open, range, dr) : "";
  // a companion marker's figure for the same range, beside this one's (activity level ↔ active energy)
  const comp = open.companion ? markers.find((m) => m.key === open.companion) ?? null : null;
  const compDr = comp ? drawnFor(comp, range, year) : null;
  const compPts = comp ? comp.series() : [];
  const compAgg = (from: string, to: string) => { const xs = compPts.filter((p) => p.d >= from && p.d <= to).map((p) => p.v); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const c30 = comp ? compAgg(addDays(t, -29), t) : null, c1y = comp ? compAgg(addDays(t, -364), t) : null;
  return (
    <>
      <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-[20px] font-extrabold tracking-[-0.02em] text-text-primary">{open.label}</h3>
            <p class="mt-0.5 text-[12.5px] text-text-tertiary">{open.sub}</p>
          </div>
          <div class="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="Range">
            {ranges.map((r) => <button key={r} type="button" onClick={() => { openRange.value = r; openYear.value = null; }} class={`min-h-8 rounded-lg px-3.5 text-[13px] font-semibold transition-colors ${r === range ? "bg-accent/20 text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}>{r === "4w" && open.table ? "12 weeks" : RANGE_LABEL[r]}</button>)}
          </div>
          {yearMenu ? (
            <label class="flex items-center gap-2 text-[12px] text-text-tertiary">Year
              <select value={year ?? ""} onChange={(e) => { openYear.value = Number((e.target as HTMLSelectElement).value) || null; }} class="min-h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[13px] font-semibold text-text-primary focus:border-accent focus:outline-none">
                <option value="">all</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select></label>
          ) : null}
        </div>
        {dr ? (
          <>
            <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div class="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <div class="flex items-baseline gap-2.5"><span class={`font-mono text-[38px] font-bold leading-none ${out ? "text-warning" : "text-text-primary"}`}>{dr.headline}</span><span class="text-[13.5px] text-text-secondary" dangerouslySetInnerHTML={{ __html: dr.caption }} /></div>
                {comp && compDr && compDr.headline !== "—" ? (
                  <div class="flex items-baseline gap-2"><span class="font-mono text-[38px] font-bold leading-none" style={`color:${comp.color}`}>{compDr.headline}</span><span class="text-[13.5px] text-text-secondary">{range === "week" ? `kcal active ${compPts.length && compPts[compPts.length - 1].d === t ? "today" : "on the latest day"}` : "kcal active a day"}</span></div>
                ) : null}
              </div>
              <div class="flex flex-wrap gap-4 text-[12px] text-text-secondary">
                {band ? <span><span class="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-success/50 bg-success/20 align-[-1px]"></span>{band.why}</span> : null}
                {range === "week" && open.goal?.() ? <span><span class="mr-1.5 inline-block h-0.5 w-3 bg-accent-light align-[3px]"></span>the week's running total, against the goal</span> : null}
                {range === "week" && open.daily && open.lines?.()?.length ? open.lines().map((l) => <span key={l.value}><span class="mr-1.5 inline-block h-0.5 w-3 align-[3px]" style={`background:${l.color}`}></span>{open.fmt(l.value)} {l.label.toLowerCase()}</span>) : null}
              </div>
            </div>
            <div class="mt-2 overflow-x-auto"><svg viewBox="0 0 820 200" class="block h-auto w-full min-w-[560px]" role="img" aria-label={`${open.label}, ${RANGE_LABEL[range].toLowerCase()} view`} dangerouslySetInnerHTML={{ __html: chartSvg(open, range, dr) }} /></div>
            {dr.rows ? (
              <div class="mt-3 border-t border-white/[0.07]">
                {dr.rows.map((r) => (
                  <div key={r.label} class="grid grid-cols-[1.3fr_0.8fr_1fr_auto] items-baseline gap-3 border-b border-white/[0.07] py-1.5 text-[12.5px] tabular-nums">
                    <span class={r.total ? (r.current ? "font-semibold text-text-primary" : "text-text-secondary") : "text-text-muted"}>{r.label}</span>
                    <span class={`text-right font-mono ${r.total ? "text-text-primary" : "text-text-muted"}`}>{r.total ? open.fmt(r.total) : "—"}</span>
                    <span class="text-right text-text-tertiary">{r.avg != null ? `${open.fmt(r.avg)} a day` : ""}</span>
                    <span class="w-12 text-right font-mono text-[9.5px] tracking-[0.06em] text-accent-light">{r.current ? "SO FAR" : ""}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : <p class="mt-4 text-[13px] text-text-tertiary">Nothing read yet for {open.label.toLowerCase()}.{open.section === "heart" || open.key === "steps" ? " The app sends it on every sync once Apple Health is on." : ""}</p>}
        <div class="mt-4 grid gap-4 border-t border-white/[0.07] pt-4 lg:grid-cols-2">
          <div>
            <Kicker text="WHAT VERVE READS" />
            <div class="mt-2 flex flex-col gap-2 text-[13.5px] leading-relaxed text-text-secondary">{reads.map((r, i) => <p key={i} dangerouslySetInnerHTML={{ __html: r }} />)}</div>
            <a href={open.science} class="mt-2.5 inline-block text-[12.5px] font-semibold text-accent-light hover:text-text-primary">The science behind this &rarr;</a>
          </div>
          <div>
            {dr && open.daily && range === "week"
              ? <><Kicker text="ALONGSIDE · THE SAME DAYS" />{alongside ? <div class="mt-2" dangerouslySetInnerHTML={{ __html: alongside }} /> : <div class="mt-2"><p class="text-[12.5px] text-text-tertiary">Nothing else read on these days yet.</p></div>}</>
              : <><Kicker text="SOURCE" /><p class="mt-2 text-[13px] leading-relaxed text-text-secondary">{open.source}</p></>}
          </div>
        </div>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Kicker text={open.daily ? "LAST 30 DAYS" : "LAST YEAR"} /><div class="mt-1.5 font-mono text-[20px] font-bold text-text-primary">{open.daily ? (m30 ? open.fmt(m30.v) : "—") : (y1 ? open.fmt(y1.v) : "—")} <span class="text-[11px] font-semibold text-text-tertiary">{open.daily ? (m30 ? `${open.unit}${open.sum ? "" : " a day"}` : "") : (y1 ? `${open.unit} average` : "")}</span></div><div class="mt-0.5 text-[12px] text-text-tertiary">{open.daily ? (m30 ? `${m30.n} days read` : "nothing read") : (y1 ? `${y1.n} reading${y1.n === 1 ? "" : "s"}` : "no reading")}</div>{comp && c30 != null ? <div class="mt-1 font-mono text-[13px] font-semibold" style={`color:${comp.color}`}>{Math.round(c30)} <span class="text-[11px] text-text-tertiary">kcal active a day</span></div> : null}</div>
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Kicker text={open.daily ? "LAST 12 MONTHS" : "THE YEAR BEFORE"} /><div class="mt-1.5 font-mono text-[20px] font-bold text-text-primary">{open.daily ? (y1 ? open.fmt(y1.v) : "—") : (y2 ? open.fmt(y2.v) : "—")} <span class="text-[11px] font-semibold text-text-tertiary">{open.daily ? (y1 ? `${open.unit}${open.sum ? " in all" : " a day"}` : "") : (y2 ? `${open.unit} average` : "")}</span></div><div class="mt-0.5 text-[12px] text-text-tertiary">{open.daily ? (y1 && y2 ? `the year before: ${open.fmt(y2.v)}` : y1 ? `${y1.n} days read` : "nothing read") : (y2 ? `${y2.n} reading${y2.n === 1 ? "" : "s"}` : "no reading")}</div>{comp && c1y != null ? <div class="mt-1 font-mono text-[13px] font-semibold" style={`color:${comp.color}`}>{Math.round(c1y)} <span class="text-[11px] text-text-tertiary">kcal active a day</span></div> : null}</div>
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><Kicker text="SOURCE" /><div class="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{open.source}</div></div>
      </div>
      {open.key === "sessions" ? <div dangerouslySetInnerHTML={{ __html: workoutsListHtml(acts, range) }} /> : null}
    </>
  );
}

/** Mount the three views into the page's containers, once. */
export function mountOverview(els: { line: HTMLElement; glance: HTMLElement; section: HTMLElement; days?: HTMLElement; week?: HTMLElement }) {
  render(<GlanceLine />, els.line);
  render(<Glance />, els.glance);
  render(<Section />, els.section);
  if (els.days) render(<DaysWithData />, els.days);
  if (els.week) render(<WeekTable />, els.week);
}
