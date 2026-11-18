/**
 * Two cards that sit beside a horizon's numbers (canvas "Verve, Horizon as a programme", boards 15 and 17; built on
 * the founder's word of 17 November 2026, for test accounts only).
 *
 *   MidweekCard   Thursday's note: what is done, what is left, how the days left can hold it, one thing that was
 *                 done. Counted by ../horizon/midweek.ts; no model writes any of it.
 *   ChartCard     a diet chart from the person's dietitian, kept with the horizon: add it, check what was read, see
 *                 today's lines as written, and mark once a day whether the day followed it. Verve shows and counts.
 *                 It does not write a chart, grade one or change one, and nothing here is worked out from one.
 *
 * The chart's file is uploaded and read by the page (state.ts actions.readFile), as every report is. Its rows and the
 * daily answers are the owner's alone: no coach reads them until sharing a chart is built.
 */
import { useMemo, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { actions } from "../state.ts";
import { addDays } from "../derive/format.ts";
import { dayMonthLong, dayMonthYear, spanOf, type HorizonLike } from "../horizon/derive.ts";
import type { Midweek } from "../horizon/midweek.ts";
import { CHART_ANSWERS, CHART_HEAD, chartCount, chartCountWords, chartInForce, mealsOn, parseChart, type ChartAnswer, type ChartDay, type ChartRead, type ChartRow } from "../horizon/chart.ts";
import { horizonSpans } from "../horizon/derive.ts";
import { keepChart, listChartDays, listCharts, removeChart, saveChartDay } from "../horizon/api.ts";

const Eyebrow = ({ children, accent }: { children: any; accent?: boolean }) => <div class={`font-mono text-[11px] font-medium ${accent ? "text-accent-text" : "text-text-3"}`}>{children}</div>;
const H2 = ({ children }: { children: any }) => <h2 class="m-0 text-[18px] font-semibold text-text">{children}</h2>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;
const Button = ({ children, onClick, primary, disabled }: { children: any; onClick?: () => void; primary?: boolean; disabled?: boolean }) => (
  <button type="button" disabled={disabled} onClick={onClick} class={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-50 ${primary ? "bg-accent text-canvas" : "border border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
const inputClass = "min-h-10 w-full rounded-[10px] border border-border bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border";
const weekday = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── midweek ──

export function MidweekCard({ note, chartLine }: { note: Midweek; /** The chart's count so far this week, when a chart is in force. */ chartLine?: string | null }) {
  const lines = chartLine ? [...note.lines, { head: CHART_HEAD, text: chartLine }] : note.lines;
  return (
    <section id="horizon-midweek" class="flex flex-col gap-3 rounded-[16px] border border-accent-border bg-card p-5" aria-label="The midweek note">
      <Eyebrow accent>Midweek · {weekday(note.on)}{note.week != null ? ` · week ${note.week} of ${note.weeks}` : ""} · read to Wednesday night</Eyebrow>
      <div class="flex flex-col">
        {lines.map((l, i) => (
          <div class={`grid grid-cols-1 gap-x-4 gap-y-1 py-2.5 md:grid-cols-[140px_minmax(0,1fr)] ${i ? "border-t border-border" : ""}`} key={l.head}>
            <span class="font-mono text-[11px] font-medium uppercase tracking-wider text-text-3">{l.head}</span>
            <span class="text-[15px] leading-relaxed text-text">{l.text}</span>
          </div>
        ))}
      </div>
      {note.state !== "nothing" ? (
        <div class="grid grid-cols-7 gap-1" aria-hidden="true">
          {note.days.map((d) => (
            <div class={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-[8px] border font-mono text-[11px] font-semibold ${d.kind === "note" ? "border-accent-border bg-accent-fill text-accent-text" : d.kind === "ahead" ? "border-dashed border-border-strong text-text-3" : "border-border-strong bg-alt text-text-2"}`} key={d.day}>
              <span>{d.name}</span>{d.text ? <span class="text-[10px] font-medium">{d.text}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      <Quiet>Counted from your week on Thursday morning, and not written by a model. It names what is done and what is left, and asks for nothing beyond the week's own lines. It can be switched off under "Check-ins and who sees them".</Quiet>
    </section>
  );
}

// ── a diet chart ──

/** What the card holds for a horizon: its charts and the days answered; `off` when the tables are not there yet. */
export type ChartState = { charts: ChartRow[]; days: ChartDay[]; off: boolean };
export async function loadChartState(sb: SupabaseClient, horizonId: string): Promise<ChartState> {
  const charts = await listCharts(sb, horizonId);
  if (charts == null) return { charts: [], days: [], off: true };
  return { charts, days: charts.length ? await listChartDays(sb, horizonId) : [], off: false };
}
/** The chart's count for the week today is in, up to today: the sentence for the midweek note and the weight card. Empty when no day was marked. */
export function chartSoFar(state: ChartState | null, h: HorizonLike, today: string, who: "you" | "they" = "you"): string {
  if (!state || !state.charts.length) return "";
  const span = spanOf(h, today);
  if (!span) return "";
  return chartCountWords(chartCount(state.charts, state.days, span.from, today < span.to ? today : span.to), true, who);
}
/** The chart's count for the last whole week that has ended, for the call sheet. Empty when no day of it was marked. */
export function chartLastWeek(state: ChartState | null, h: HorizonLike, today: string, who: "you" | "they" = "you"): string {
  if (!state || !state.charts.length) return "";
  const last = [...horizonSpans(h)].reverse().find((s) => s.days === 7 && s.to < today);
  return last ? chartCountWords(chartCount(state.charts, state.days, last.from, last.to), false, who) : "";
}

/** A chart that was read and is waiting for its owner's check: what was read, and the file it came from. */
export type ChartDraft = { read: ChartRead; path: string; name: string };
/** What the owner settled when they checked a chart: who wrote it, the day it was given, the day it says it is to be reviewed. */
export type ChartChecked = { written_by: string | null; given_on: string; review_on: string | null };
/**
 * Ask for a chart's file, keep it in the person's archive and have it read (state.ts actions.readFile): the draft to
 * check, the words for why there is none, or null when no file was chosen. One road for the horizon's page and for the
 * sixth card of its set-up (board 18).
 */
export async function readChartFile(): Promise<{ draft: ChartDraft } | { note: string } | null> {
  const res = await actions.readFile("diet_chart");
  if (!res) return null;
  if ("error" in res) return { note: res.error };
  const read = res.out?.doc_type === "diet_chart" ? parseChart(res.out.diet_chart, res.out.report_date) : null;
  return read ? { draft: { read, path: res.path, name: res.name } } : { note: "That file was not read as a diet chart. It is kept in Reports, and nothing was added here." };
}
const ChartMeals = ({ meals }: { meals: { when: string; items: string; day?: string | null }[] }) => (
  <div class="flex flex-col">
    {meals.map((m, i) => (
      <div class={`grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-2 ${i ? "border-t border-border" : ""}`} key={`${m.day ?? ""}-${m.when}-${i}`}>
        <span class="font-mono text-[11px] font-medium uppercase tracking-wider text-text-3">{m.day ? `${m.day} · ` : ""}{m.when}</span>
        <span class="text-[14px] leading-relaxed text-text">{m.items}</span>
      </div>
    ))}
  </div>
);
/**
 * "Check what was read": the chart's lines in its own words, and the three things its owner can correct. It keeps
 * nothing itself: `onKeep` is told what was settled, and the caller decides where the chart goes.
 */
export function ChartCheck({ draft, today, busy, note, keepWords, onKeep, onLeave }: {
  draft: ChartDraft; today: string; busy?: boolean; note?: string; /** The words on the button that keeps it. */ keepWords: string;
  onKeep: (c: ChartChecked) => void; onLeave: () => void;
}) {
  const [by, setBy] = useState(draft.read.written_by ?? ""), [given, setGiven] = useState(draft.read.given_on ?? today), [review, setReview] = useState(draft.read.review_on ?? "");
  const [why, setWhy] = useState("");
  const keep = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(given) || given > today) { setWhy("Give the day the chart was given. It cannot be ahead of today."); return; }
    setWhy("");
    onKeep({ written_by: by.trim().slice(0, 120) || null, given_on: given, review_on: /^\d{4}-\d{2}-\d{2}$/.test(review) ? review : null });
  };
  return (
    <>
      <div class="flex flex-col gap-1"><Eyebrow accent>Diet chart · {draft.name} · read in the chart's own words</Eyebrow><H2>Check what was read</H2></div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label class="flex flex-col gap-1"><Eyebrow>Who wrote it</Eyebrow><input type="text" value={by} maxLength={120} onInput={(e) => setBy((e.currentTarget as HTMLInputElement).value)} placeholder="Their name, as you would say it" class={inputClass} /></label>
        <label class="flex flex-col gap-1"><Eyebrow>Given on</Eyebrow><input type="date" value={given} max={today} onInput={(e) => setGiven((e.currentTarget as HTMLInputElement).value)} class={`${inputClass} font-mono`} /></label>
        <label class="flex flex-col gap-1"><Eyebrow>To be reviewed · if it says</Eyebrow><input type="date" value={review} onInput={(e) => setReview((e.currentTarget as HTMLInputElement).value)} class={`${inputClass} font-mono`} /></label>
      </div>
      {draft.read.meals.length ? <ChartMeals meals={draft.read.meals} /> : <Quiet>No meal lines could be read from this page.</Quiet>}
      {draft.read.totals.length ? <p class="m-0 text-[13px] leading-relaxed text-text-2">Printed on the chart: {draft.read.totals.map((t) => `${t.name} ${t.value}`).join(" · ")}</p> : null}
      {draft.read.notes.length ? <div class="flex flex-col gap-1"><span class="text-[13px] text-text-2">The chart's own notes, word for word:</span>{draft.read.notes.map((n) => <p class="m-0 border-l-[3px] border-border-strong pl-3 text-[13px] leading-relaxed text-text" key={n}>"{n}"</p>)}</div> : null}
      <Quiet>Nothing is added, and nothing is worked out. A total is shown only where the chart prints one. If a line was read wrongly, the chart itself is one press away in Reports, and you can add it again from a clearer page.</Quiet>
      {why || note ? <p class="m-0 text-[13px] leading-relaxed text-caution">{why || note}</p> : null}
      <div class="flex flex-wrap gap-3"><Button primary disabled={busy} onClick={keep}>{busy ? "Keeping…" : keepWords}</Button><Button onClick={onLeave}>Not this file</Button></div>
    </>
  );
}

export function ChartCard({ sb, h, today, state, closed, userId, reload, readOnly, sharedWith }: {
  sb: SupabaseClient; h: HorizonLike & { id: string }; today: string; state: ChartState; closed: boolean;
  userId: () => Promise<string | null>; /** Read the charts and the days again. */ reload: () => Promise<void>;
  /** The viewer is someone the chart is shared with: they read it and the count, and change nothing. */ readOnly?: boolean;
  /** How many people the chart is shared with, for its owner; null when the page cannot say. */ sharedWith?: number | null;
}) {
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState("");
  /** A chart that was read and is waiting for the person's check. */
  const [draft, setDraft] = useState<ChartDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const chart = useMemo(() => chartInForce(state.charts, today), [state.charts, today]);
  const span = spanOf(h, today);
  const from = span ? span.from : today, to = span ? span.to : today;
  const answers = useMemo(() => new Map(state.days.map((d) => [d.day, d.answer])), [state.days]);
  const count = chartCount(state.charts, state.days, from, today < to ? today : to);
  const todays = chart ? mealsOn(chart, today) : [];

  async function add() {
    setNote(""); setReading(true);
    const res = await readChartFile();
    setReading(false);
    if (!res) return;
    if ("note" in res) { setNote(res.note); return; }
    setDraft(res.draft);
  }
  async function keep(c: ChartChecked) {
    if (!draft) return;
    const uid = await userId();
    if (!uid) { setNote("Sign in again to keep it."); return; }
    setBusy(true); setNote("");
    const err = await keepChart(sb, { horizon_id: h.id, user_id: uid, report_path: draft.path, ...c, meals: draft.read.meals, notes: draft.read.notes, totals: draft.read.totals });
    setBusy(false);
    if (err) { setNote(`Could not keep the chart: ${err}`); return; }
    setDraft(null); await reload();
  }
  async function answer(day: string, a: ChartAnswer) {
    const uid = await userId();
    if (!uid) { setNote("Sign in again to mark the day."); return; }
    // pressing the answer already given takes it back: the day is a dash again
    const err = await saveChartDay(sb, h.id, uid, day, answers.get(day) === a ? null : a);
    if (err) { setNote(`Could not keep that: ${err}`); return; }
    await reload();
  }
  async function takeOff() {
    if (!chart || !confirm("Take this chart off the horizon? The file stays in Reports, and the days you marked stay counted.")) return;
    const err = await removeChart(sb, chart.id);
    if (err) setNote(`Could not take it off: ${err}`); else await reload();
  }

  const Meals = ChartMeals;

  // someone the chart is shared with: its lines and the count, and nothing to press
  if (readOnly) {
    if (!chart) return null;
    const theirs = chartCountWords(count, false, "they");
    return (
      <section id="horizon-chart" class="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5">
        <div class="flex flex-col gap-1">
          <Eyebrow accent>Their diet chart{chart.written_by ? ` · ${chart.written_by}` : ""} · given {dayMonthLong(chart.given_on)} · shared with you</Eyebrow>
          <H2>Today, as the chart has it</H2>
        </div>
        {todays.length ? <Meals meals={showAll ? chart.meals : todays} /> : <Quiet>The chart has no line for today.</Quiet>}
        {chart.notes.length ? <div class="flex flex-col gap-1">{chart.notes.map((n) => <p class="m-0 border-l-[3px] border-border-strong pl-3 text-[13px] leading-relaxed text-text-2" key={n}>"{n}"</p>)}</div> : null}
        {chart.totals.length ? <p class="m-0 text-[13px] leading-relaxed text-text-2">Printed on the chart: {chart.totals.map((t) => `${t.name} ${t.value}`).join(" · ")}</p> : null}
        {chart.meals.length > todays.length ? <button type="button" class="self-start text-[13px] font-semibold text-text-2 hover:text-text" onClick={() => setShowAll((v) => !v)}>{showAll ? "Today only" : "Every day of the chart"}</button> : null}
        <p class="m-0 text-[14px] leading-relaxed text-text">{theirs ? `This week so far: ${theirs}` : "No day is marked this week yet."}</p>
        <Quiet>The chart is as its writer wrote it, read from the page they uploaded. The count is their own word, one answer a day. You can read both and change neither. Verve works nothing out from a chart, and does not tie the count to any other number.</Quiet>
        {chart.review_on ? <Quiet>The chart says it is to be reviewed on {dayMonthYear(chart.review_on)}.</Quiet> : null}
      </section>
    );
  }

  // nothing kept yet, and nothing being checked: the way in
  if (!chart && !draft) {
    if (closed) return null;
    return (
      <section id="horizon-chart" class="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-3"><H2>A diet chart</H2><Eyebrow>test account</Eyebrow></div>
        <p class="m-0 max-w-[640px] text-[14px] leading-relaxed text-text-2">If your dietitian has given you a chart, it can be kept with this horizon. Verve shows it as it was written and counts the days you say you followed it. It does not write a chart, grade one or change one.</p>
        <div class="flex flex-wrap items-center gap-3"><Button onClick={() => void add()} disabled={reading}>{reading ? "Reading the chart…" : "Add a diet chart"}</Button><span class="text-[12px] text-text-3">A PDF, or a photograph of the page</span></div>
        {note ? <p class="m-0 text-[13px] leading-relaxed text-caution">{note}</p> : null}
      </section>
    );
  }

  // a chart that was read, waiting for the person's check
  if (draft) {
    return (
      <section id="horizon-chart" class="flex flex-col gap-4 rounded-[16px] border border-accent-border bg-card p-5">
        <ChartCheck draft={draft} today={today} busy={busy} note={note} keepWords="Keep it with this horizon" onKeep={(c) => void keep(c)} onLeave={() => { setDraft(null); setNote(""); }} key={draft.path} />
      </section>
    );
  }

  // the chart in force: today's lines, the one question, the week
  const c = chart!;
  return (
    <section id="horizon-chart" class="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5">
      <div class="flex flex-col gap-1">
        <Eyebrow accent>Your chart{c.written_by ? ` · ${c.written_by}` : ""} · given {dayMonthLong(c.given_on)} · test account</Eyebrow>
        <H2>Today, as the chart has it</H2>
      </div>
      {todays.length ? <Meals meals={showAll ? c.meals : todays} /> : <Quiet>The chart has no line for today.</Quiet>}
      {c.notes.length ? <div class="flex flex-col gap-1">{c.notes.map((n) => <p class="m-0 border-l-[3px] border-border-strong pl-3 text-[13px] leading-relaxed text-text-2" key={n}>"{n}"</p>)}</div> : null}
      {c.totals.length ? <p class="m-0 text-[13px] leading-relaxed text-text-2">Printed on the chart: {c.totals.map((t) => `${t.name} ${t.value}`).join(" · ")}</p> : null}
      <div class="flex flex-wrap gap-4 text-[13px] font-semibold">
        {c.report_path ? <button type="button" class="text-accent-text" onClick={() => actions.report("view", c.report_path!.split("/").pop() ?? "")}>View the chart</button> : null}
        {c.meals.length > todays.length ? <button type="button" class="text-text-2 hover:text-text" onClick={() => setShowAll((v) => !v)}>{showAll ? "Today only" : "Every day of the chart"}</button> : null}
      </div>
      {!closed ? (
        <div class="flex flex-col gap-2 border-t border-border pt-4">
          <span class="text-[15px] font-semibold text-text">Did today follow the chart?</span>
          <div class="flex flex-wrap gap-1.5">
            {CHART_ANSWERS.map((a) => <button type="button" key={a.key} aria-pressed={answers.get(today) === a.key} onClick={() => void answer(today, a.key)}
              class={`inline-flex min-h-10 items-center rounded-full border px-4 text-[13px] font-semibold ${answers.get(today) === a.key ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-alt text-text hover:border-accent-border"}`}>{a.label}</button>)}
          </div>
        </div>
      ) : null}
      {span ? (
        <div class="grid grid-cols-7 gap-1">
          {DAY_SHORT.map((name, i) => {
            const day = addDays(addDays(span.from, -((new Date(span.from + "T00:00:00").getDay() + 6) % 7)), i);
            const inWeek = day >= span.from && day <= span.to, a = answers.get(day), ahead = day > today;
            return (
              <div key={day} class={`flex h-11 flex-col items-center justify-center rounded-[8px] border font-mono text-[11px] font-semibold ${a === "yes" ? "border-accent-border bg-accent-fill text-accent-text" : !inWeek || ahead ? "border-dashed border-border-strong text-text-3" : "border-border-strong bg-alt text-text-2"}`}>
                <span>{name}</span><span class="text-[10px] font-medium">{!inWeek ? "" : a ?? (ahead ? "" : "–")}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <p class="m-0 text-[14px] leading-relaxed text-text">{count.marked ? `This week so far: ${chartCountWords(count)}` : "No day is marked this week yet."}</p>
      <Quiet>One press a day, and it can be left alone. A day with no answer is a dash. It is not a "no". The count is your own word: it is not a target, and nothing here judges it or ties it to another number.</Quiet>
      {c.review_on ? <Quiet>The chart says it is to be reviewed on {dayMonthYear(c.review_on)}. That date is the chart's. Verve sends no reminder of it.</Quiet> : null}
      {note ? <p class="m-0 text-[13px] leading-relaxed text-caution">{note}</p> : null}
      {!closed ? <div class="flex flex-wrap gap-3"><Button onClick={() => void add()} disabled={reading}>{reading ? "Reading the chart…" : "Add a newer chart"}</Button><Button onClick={() => void takeOff()}>Take it off this horizon</Button></div> : null}
      {sharedWith != null ? <Quiet>{sharedWith > 0
        ? `Shared with ${sharedWith === 1 ? "one person" : `${sharedWith} people`}: they read the chart's lines and your count, and change nothing. The tick is "Diet chart", under Settings, where you gave them access.`
        : "Only you see this chart and your count. To share them with a coach, tick \"Diet chart\" where you give them access, under Settings. It is off until you tick it."}</Quiet> : null}
      <Quiet>Verve shows the chart and counts the days. It does not write a chart, grade one or change one, and the Guide does not answer questions about food. A question about a line is for the person who wrote it.</Quiet>
    </section>
  );
}
