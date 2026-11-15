/**
 * The Guide's plan on Horizon, as the page draws it (canvas "Verve, the
 * Guide's plan", boards 02 to 06, 13 November 2026): the three questions
 * that come before the first plan, the draft, the plan in use (this week,
 * the climb, strength, the rules behind each step) and the chat about it.
 *
 * Every figure and every sentence of the plan comes from
 * ../horizon/guidePlan.ts; nothing here works anything out. The chat's
 * answers are the model's, written by the horizon function from the same
 * figures; a change it offers is one of the plan's own options and nothing
 * changes until the person presses the button.
 *
 * Guidance on exercise, not medical advice. The plan answers to the
 * person's targets and never sets or changes one: the zone 2 number in
 * "Change it" is the person's own target, typed by them.
 *
 * 14 November 2026 (boards 09 and 10): a finished week stays on the page
 * as "Last week"; the weeks table carries what each finished week did over
 * what it was asked; and the plan says what it does for every target.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { addDays } from "../derive/format.ts";
import { MARKER_BY_KEY, dayMonthLong, latestOf, round, weekMoves, weekdayDayMonth, type Target } from "../horizon/derive.ts";
import {
  guidePlan, storeOf, rowsWith, applyOption, freezeOf, screenOutcome, SCREEN_QUESTIONS, SCREEN_WORDS, STRENGTH, RULE_LINES, LAYOUT_WORDS,
  type ClimbRow, type GuidePlanView, type GuideStored, type GuideChoices, type Layout, type ScreenAnswers,
} from "../horizon/guidePlan.ts";
import {
  addTarget, askGuide, clearAsks, grantConsent, listAsks, loadScreen, removeScreen, saveGuidePlan, saveScreen, updateTarget, ERROR_WORDS,
  type AskRow, type HorizonAccess, type HorizonFull, type ScreenRow,
} from "../horizon/api.ts";

export type GuideCommon = {
  sb: SupabaseClient; h: HorizonFull; person: PersonData; today: string; targets: Target[];
  owner: boolean; closed: boolean;
  /** What the account may do; null when the function could not say. */
  access: HorizonAccess | null;
  userId: () => Promise<string | null>; reload: () => Promise<void>; setNotice: (s: string) => void;
};

// ── small parts ──

const H2 = ({ children }: { children: any }) => <h2 class="m-0 text-[18px] font-semibold text-text">{children}</h2>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;
const Kicker = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-accent-text">{children}</div>;
const Btn = ({ children, onClick, primary, disabled }: { children: any; onClick?: () => void; primary?: boolean; disabled?: boolean }) => (
  <button type="button" disabled={disabled} onClick={onClick} class={`inline-flex min-h-11 items-center justify-center rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-50 ${primary ? "bg-accent text-canvas" : "border border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
const browserZone = (): string | null => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };
const thousands = (n: number) => Math.round(n).toLocaleString("en-GB");
const FOOT = "Worked out by the Guide from your targets and the eight weeks before the plan. Guidance on exercise, not medical advice. Stop a session and see a doctor for chest pain, dizziness, fainting or breathlessness that is unusual for you.";

/** A free week that ended in the last thirty days is named; an older one belongs to a horizon set long ago, often under Pro, and is not. */
const recentlyEnded = (until: string | null, nowMs = Date.now()) => { const t = until ? Date.parse(until) : NaN; return Number.isFinite(t) && t <= nowMs && nowMs - t < 30 * 86_400_000; };

/** Free, and the free week is over: the plan, the check-ins and the chat are Pro. The horizon and its readings stay. */
export function GuideLocked({ access }: { access: HorizonAccess }) {
  return (
    <div class="flex flex-col gap-2 rounded-[12px] border border-accent-border bg-accent-fill p-4">
      <div class="font-mono text-[11px] font-medium text-accent-text">Pro</div>
      <div class="text-[15px] font-semibold text-text">The Guide's plan is part of Pro.</div>
      <p class="m-0 text-[13px] leading-relaxed text-text-2">{recentlyEnded(access.free.until) ? `Your free week of Horizon ended on ${dayMonthLong(access.free.until!.slice(0, 10))}. ` : ""}The plan, the Monday check-in and the questions about the plan are part of Pro. Your horizon, its targets and your readings stay here.</p>
      <div><a href="/plans" class="inline-flex min-h-11 items-center rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-canvas">See the plans</a></div>
    </div>
  );
}

// ── the plan's four parts ──

type Tab = "last" | "week" | "climb" | "strength" | "rules";
/** The plan's parts. "Last week" is there once a week of the plan is finished; "The climb" reads "The weeks" when nothing in the aerobic week changes. */
const tabsOf = (v: GuidePlanView): [Tab, string][] => [...(v.review ? [["last", "Last week"] as [Tab, string]] : []), ["week", "This week"], ["climb", v.climbs ? "The climb" : "The weeks"], ["strength", "Strength"], ["rules", "The rules"]];
/** On a Monday or a Tuesday the plan opens on the week just finished; after that, on the week in hand. */
const firstTab = (v: GuidePlanView, today: string): Tab => { const d = new Date(today + "T00:00:00").getDay(); return v.review && (d === 1 || d === 2) ? "last" : "week"; };

function Tabs({ v, tab, pick }: { v: GuidePlanView; tab: Tab; pick: (t: Tab) => void }) {
  return (
    <div class="flex max-w-full gap-1 self-start overflow-x-auto rounded-[10px] border border-border bg-alt p-1" role="tablist" aria-label="The plan's parts">
      {tabsOf(v).map(([k, label]) => (
        <button type="button" role="tab" aria-selected={tab === k} onClick={() => pick(k)}
          class={`min-h-11 shrink-0 whitespace-nowrap rounded-[8px] px-3 text-[13px] font-semibold ${tab === k ? "bg-card text-text" : "text-text-2 hover:text-text"}`}>{label}</button>
      ))}
    </div>
  );
}

/** What the plan does for each target (board 10): the ones it has a line for, the ones it watches, and a fitness target it leaves untouched. */
function Answers({ v }: { v: GuidePlanView }) {
  const a = v.answers;
  if (!a.works.length && !a.watches.length) return null;
  const list = (rows: typeof a.works) => rows.map((x) => (
    <div class="grid grid-cols-1 gap-x-3 border-t border-border pt-2 text-[13px] leading-relaxed text-text-2 first:border-t-0 first:pt-0 sm:grid-cols-[150px_minmax(0,1fr)]" key={x.marker}>
      <b class="font-semibold text-text">{x.label}</b><span>{x.text}</span>
    </div>
  ));
  return (
    <div class="flex flex-col gap-3 rounded-[12px] border border-border bg-canvas p-4">
      <div class={`grid grid-cols-1 gap-4 ${a.watches.length && a.works.length ? "lg:grid-cols-2" : ""}`}>
        {a.works.length > 0 && <div class="flex min-w-0 flex-col gap-2"><span class="text-[15px] font-semibold text-text">{a.worksHead}</span>{list(a.works)}</div>}
        {a.watches.length > 0 && <div class="flex min-w-0 flex-col gap-2"><span class="text-[15px] font-semibold text-text">{a.works.length ? a.watchesHead : `The plan has no line for your ${a.watches.length === 1 ? "target" : "targets"}`}</span>{list(a.watches)}</div>}
      </div>
      {a.note && <p class="m-0 rounded-[10px] border border-accent-border bg-accent-fill px-4 py-3 text-[13px] leading-relaxed text-text">{a.note}</p>}
    </div>
  );
}

const STATE_TEXT = { reached: "text-good", short: "text-caution", neutral: "text-text-3" } as const;

/** The week just finished (board 09): each line against what it was asked, where a zone 2 gap went, what moved, and what it does to the plan. */
function LastWeek({ v, p }: { v: GuidePlanView; p: GuideCommon }) {
  const r = v.review!;
  const moves = weekMoves(p.targets, p.h, p.person, r.monday, p.today);
  const checkin = p.h.checkins.find((c) => c.kind === "week" && c.for_date === addDays(r.monday, 7)) ?? null;
  const nextTest = v.testWeeks.find((w) => w >= v.week) ?? null;
  return (
    <>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div class="flex min-w-0 flex-col gap-3 rounded-[12px] border border-border bg-canvas p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="text-[15px] font-semibold text-text">Week {r.week} · {weekdayDayMonth(r.monday)} to {weekdayDayMonth(r.sunday)}</span>
            <span class="text-[12px] text-text-3">From {p.owner ? "your" : "their"} sessions and days, never from a tick box</span>
          </div>
          <div class="flex flex-col gap-2" role="table" aria-label={`Week ${r.week}: the plan against what was done`}>
            <div class="hidden grid-cols-[100px_84px_minmax(0,1fr)_84px_132px] gap-x-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-text-3 sm:grid" role="row">
              <span>Line</span><span>The plan</span><span /><span>{p.owner ? "You did" : "Done"}</span><span class="text-right">The week</span>
            </div>
            {r.lines.map((l) => (
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[13px] sm:grid-cols-[100px_84px_minmax(0,1fr)_84px_132px]" role="row" key={l.key}>
                <span class="text-text">{l.label}</span>
                <span class="order-3 text-text-2 sm:order-none"><span class="text-[12px] text-text-3 sm:hidden">The plan </span><span class="t-figure-row">{l.plan}</span></span>
                <span class="order-5 col-span-2 h-2 overflow-hidden rounded-full bg-alt sm:order-none sm:col-span-1" aria-hidden="true"><span class="block h-full bg-accent" style={{ width: `${Math.round(l.share * 100)}%` }} /></span>
                <span class="order-4 text-right text-text sm:order-none sm:text-left"><span class="text-[12px] text-text-3 sm:hidden">Done </span><span class="t-figure-row">{l.done}</span></span>
                <span class={`order-2 text-right font-medium sm:order-none ${STATE_TEXT[l.state]}`}>{l.word}</span>
              </div>
            ))}
          </div>
          <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text">{r.summary}</p>
          {r.gap && (
            <div class="flex flex-col gap-2 border-t border-border pt-3">
              <span class="text-[15px] font-semibold text-text">{r.gap.head}</span>
              {r.gap.parts.map((g) => (
                <div class="grid grid-cols-1 gap-x-3 text-[13px] leading-relaxed text-text-2 sm:grid-cols-[150px_minmax(0,1fr)]" key={g.head}><b class="font-semibold text-text">{g.head}</b><span>{g.text}</span></div>
              ))}
              <Quiet>Arithmetic on the week's sessions. No model writes this part.</Quiet>
            </div>
          )}
        </div>

        <div class="flex min-w-0 flex-col gap-3">
          {moves.length > 0 && (
            <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-canvas p-4">
              <span class="text-[15px] font-semibold text-text">What moved against {p.owner ? "your" : "their"} targets</span>
              {moves.map((m) => (
                <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-t border-border pt-2 text-[13px] first:border-t-0 first:pt-0" key={m.marker}>
                  <span class="text-text">{m.label}</span>
                  <span class="t-figure-row whitespace-nowrap text-right text-text">{m.fresh && m.before && m.before !== m.after ? `${m.before} → ${m.after}` : m.after ?? "—"}{m.unit && m.after ? <span class="ml-1 font-mono text-[11px] font-medium text-text-3">{m.unit}</span> : null}</span>
                  <span class="col-span-2 text-[12px] text-text-3">{m.fresh ? m.pace_word : m.marker === "mets" && nextTest ? `No new test · tested in week ${nextTest}` : "No new reading in the week"}</span>
                </div>
              ))}
              <Quiet>The end of the week before against the end of this one. The full table is above.</Quiet>
            </div>
          )}
          {checkin && (
            <div class="flex flex-col gap-2 rounded-[12px] border border-accent-border bg-accent-fill p-4">
              <span class="font-mono text-[11px] font-medium text-accent-text">The Guide's check-in · {weekdayDayMonth(checkin.for_date)} · an AI model</span>
              <p class="m-0 text-[15px] leading-relaxed text-text">{checkin.text}</p>
              <p class="m-0 text-[12px] leading-relaxed text-accent-text">The check-in describes and sets nothing. What comes next is the plan's, and it is fixed text.</p>
            </div>
          )}
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <Kicker>What it does to the plan</Kicker>
        <div class={`grid grid-cols-1 gap-3 ${r.after.length >= 3 ? "lg:grid-cols-3" : r.after.length === 2 ? "lg:grid-cols-2" : ""}`}>
          {r.after.map((c) => (
            <div class="flex min-w-0 flex-col gap-1 rounded-[12px] border border-border bg-canvas p-4" key={c.small}>
              <span class="font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-text-3">{c.small}</span>
              <span class="text-[15px] font-semibold leading-snug text-text">{c.head}</span>
              <span class="text-[13px] leading-relaxed text-text-2">{c.text}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Week({ v }: { v: GuidePlanView }) {
  return (
    <>
      <div class="flex flex-col gap-2">
        <Kicker>{v.started ? "Your week, this week" : `Your week, from ${weekdayDayMonth(v.firstMonday)}`}</Kicker>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {v.tiles.map((t) => (
            <div class="flex min-w-0 flex-col gap-1 rounded-[12px] border border-border bg-canvas p-3" key={t.key}>
              <span class="font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-text-3">{t.small}</span>
              <span class="text-[15px] font-semibold leading-snug text-text">{t.big}</span>
              <span class="text-[13px] leading-relaxed text-text-2">{t.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <Kicker>The same plan, letter by letter</Kicker>
        <div class="overflow-hidden rounded-[12px] border border-border" role="table" aria-label="The plan as FITT-VP">
          <div class="hidden grid-cols-[44px_120px_minmax(0,1.25fr)_minmax(0,1fr)] bg-alt font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-text-2 sm:grid" role="row">
            <span class="p-2" /><span class="p-2">FITT-VP</span><span class="p-2">This week</span><span class="p-2">By the date</span>
          </div>
          {v.fitt.map((r, i) => (
            <div class="grid grid-cols-[32px_minmax(0,1fr)] gap-x-2 border-t border-border bg-card p-2 text-[13px] leading-relaxed text-text-2 first:border-t-0 sm:grid-cols-[44px_120px_minmax(0,1.25fr)_minmax(0,1fr)] sm:gap-x-0 sm:p-0" role="row" key={i}>
              <span class="t-figure-row row-span-3 text-accent-text sm:row-span-1 sm:p-2">{r.letter}</span>
              <span class="font-semibold text-text sm:p-2">{r.name}</span>
              <span class="sm:p-2">{r.now}</span>
              <span class="sm:p-2"><span class="text-text-3 sm:hidden">By the date: </span>{r.by}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <Kicker>Why this, for you</Kicker>
        <ol class="m-0 flex list-none flex-col gap-2 p-0">
          {v.why.map((w, i) => (
            <li class="grid grid-cols-[24px_minmax(0,1fr)] gap-2 text-[13px] leading-relaxed text-text-2" key={i}>
              <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-text font-mono text-[11px] font-semibold text-canvas">{i + 1}</span>
              <span><b class="font-semibold text-text">{w.head}</b> {w.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {v.soFar.length > 0 && (
        <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-canvas p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="text-[15px] font-semibold text-text">This week so far</span>
            <span class="text-[12px] text-text-3">From your sessions and your days, never from a tick box</span>
          </div>
          {v.soFar.map((s) => (
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[13px] text-text first:border-t-0 first:pt-0 sm:grid-cols-[130px_minmax(0,1fr)_150px]" key={s.key}>
              <span>{s.label}</span>
              <span class="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-alt sm:order-none sm:col-span-1" aria-hidden="true"><span class="block h-full bg-accent" style={{ width: `${s.of > 0 ? Math.min(100, Math.round((s.done / s.of) * 100)) : 0}%` }} /></span>
              <span class="t-figure-row text-right text-text">{s.text}</span>
            </div>
          ))}
          <Quiet>Monday's check-in reads the week against these lines. It still describes; the plan is where the next step is written.</Quiet>
        </div>
      )}
    </>
  );
}

/** Weeks ahead that ask the same week, read as one line: a plan that holds says so once, with its steps under it. */
type WeekLine = { rows: ClimbRow[]; first: ClimbRow; last: ClimbRow };
function weekLines(rows: ClimbRow[]): WeekLine[] {
  const out: WeekLine[] = [];
  const same = (x: ClimbRow, y: ClimbRow) => x.state === "future" && y.state === "future" && x.zone2 === y.zone2 && x.harder === y.harder && x.sessions === y.sessions && x.strengthDays === y.strengthDays && x.sets === y.sets;
  for (const w of rows) {
    const cur = out[out.length - 1];
    if (cur && same(cur.last, w)) { cur.rows.push(w); cur.last = w; } else out.push({ rows: [w], first: w, last: w });
  }
  // a run of two is two lines: only three or more of the same week read better as one
  return out.flatMap((g) => (g.rows.length >= 3 ? [g] : g.rows.map((w) => ({ rows: [w], first: w, last: w }))));
}

function Climb({ v }: { v: GuidePlanView }) {
  const max = Math.max(150, ...v.climb.map((w) => w.total));
  const top = Math.ceil(max / 50) * 50;
  const pct = (m: number) => `${(m / top) * 100}%`;
  const first = v.climb[0], last = v.climb[v.climb.length - 1];
  const hasSteps = v.climb.some((w) => w.steps != null);
  const anyDone = v.climb.some((w) => w.done);
  /** A cell: for a finished week, what was done over what was asked, tinted when it was short; otherwise the plan's figure. */
  const cell = (w: ClimbRow, key: "zone2" | "harder" | "strength" | "steps" | "sessions", plan: string, done: string | null) => (
    <td class={`p-2 align-top ${w.done && w.short.includes(key) ? "bg-alt" : ""}`}>
      {w.done && done != null ? <><span class="t-figure-row block text-text">{done}</span><span class="block font-mono text-[11px] text-text-3">of {plan}</span></> : <span class={`t-figure-row ${w.state === "future" ? "text-text-2" : "text-text"}`}>{plan}</span>}
    </td>
  );
  /** What a finished week did to the plan, beside its row. */
  const OUTCOME: Record<string, string> = { short: "zone 2 short", back: "zone 2 short again: the plan stepped back", won: "won a week back" };
  return (
    <>
      {v.climbs ? (
        <div class="flex flex-col gap-3 rounded-[12px] border border-border bg-canvas p-4">
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span class="text-[15px] font-semibold text-text">Minutes a week, by intensity</span>
            <span class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-2">
              <span class="inline-flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-[3px] bg-z2" />Zone 2</span>
              <span class="inline-flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded-[3px] bg-z3" />Harder</span>
            </span>
          </div>
          <div role="img" aria-label={`${v.climb.length} weekly bars. Zone 2 goes from ${first.zone2} to ${last.zone2} minutes, harder minutes from ${first.harder} to ${last.harder}, the week from ${first.total} to ${last.total}.`}>
            <div class="relative flex h-[180px] items-end gap-1 border-b border-border-strong sm:gap-2">
              <div class="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-text" style={{ bottom: pct(150) }} />
              {v.climb.map((w) => (
                <div class={`relative flex h-full min-w-0 flex-1 flex-col justify-end ${w.state === "now" ? "rounded-t-[6px] bg-accent-fill" : ""}`} key={w.week}>
                  <span class="mb-1 hidden text-center font-mono text-[10px] font-semibold text-text md:block">{thousands(w.dose)}</span>
                  <span class="block w-full bg-z3" style={{ height: pct(w.harder) }} />
                  <span class="block w-full bg-z2" style={{ height: pct(w.zone2) }} />
                </div>
              ))}
            </div>
            <div class="flex gap-1 pt-1 sm:gap-2">
              {v.climb.map((w) => <span class={`min-w-0 flex-1 text-center font-mono text-[10px] ${w.state === "now" ? "font-semibold text-accent-text" : "text-text-3"}`} key={w.week}>{w.week}</span>)}
            </div>
          </div>
          <Quiet>What the plan asks each week. The dashed line is 150 minutes, the first flag on the app's Weekly Ascent. Over each bar on a wide screen: that week's dose in MET-minutes. The lit column is this week. {v.climbNote}</Quiet>
        </div>
      ) : (
        <p class="m-0 max-w-[720px] text-[15px] leading-relaxed text-text">Nothing in the aerobic week changes from here to the date, so there is no climb to draw: {first.zone2} minutes in zone 2{first.harder > 0 ? ` and ${first.harder} harder` : ""}, every week{hasSteps && first.steps !== last.steps ? ", with the steps a day rising under it" : ""}.</p>
      )}

      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <Kicker>{anyDone ? "The weeks so far, and the weeks ahead" : "Every week of the plan"}</Kicker>
          {anyDone && <span class="text-[12px] text-text-3">A finished week: what was done, over the plan's line. A tinted cell was short. Ahead: the plan only.</span>}
        </div>
        <div class="overflow-x-auto rounded-[12px] border border-border">
          <table class="w-full min-w-[640px] border-collapse text-left text-[13px] text-text">
            <thead>
              <tr class="bg-alt font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-text-2">
                <th class="p-2 font-semibold">Week</th><th class="p-2 font-semibold">Zone 2</th><th class="p-2 font-semibold">Harder</th><th class="p-2 font-semibold">Strength</th>{hasSteps && <th class="p-2 font-semibold">Steps a day</th>}<th class="p-2 font-semibold">Sessions</th><th class="p-2 font-semibold">Dose</th><th class="p-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {weekLines(v.climb).map((g) => {
                const w = g.first, many = g.rows.length > 1;
                const tests = g.rows.filter((x) => x.test).map((x) => x.week);
                const note = [w.state === "now" ? "now" : "", w.outcome ? OUTCOME[w.outcome] ?? "" : "", !w.done && w.repeats ? "zone 2 asked again" : "", tests.length ? (many ? `fitness test in week ${tests.join(" and week ")}` : "fitness test") : "", w.sets].filter(Boolean).join(" · ");
                return (
                  <tr class={`border-t border-border ${w.state === "now" ? "bg-accent-fill" : "bg-card"}`} key={w.week}>
                    <td class="p-2 align-top text-text-2"><span class="t-figure-row">{many ? `${w.week} to ${g.last.week}` : w.week}</span></td>
                    {cell(w, "zone2", String(w.zone2), w.done ? String(w.done.zone2) : null)}
                    {cell(w, "harder", String(w.harder), w.done ? String(w.done.harder) : null)}
                    {cell(w, "strength", String(w.strengthDays), w.done ? String(w.done.strength) : null)}
                    {hasSteps && cell(w, "steps", w.steps == null ? "" : many && g.last.steps != null && g.last.steps !== w.steps ? `${thousands(w.steps)} to ${thousands(g.last.steps)}` : thousands(w.steps), w.done ? (w.done.steps != null ? thousands(w.done.steps) : "—") : null)}
                    {cell(w, "sessions", String(w.sessions), w.done ? String(w.done.sessions) : null)}
                    <td class="p-2 align-top">{w.done?.dose != null ? <><span class="t-figure-row block text-text">{thousands(w.done.dose)}</span><span class="block font-mono text-[11px] text-text-3">planned {thousands(w.dose)}</span></> : <span class={`t-figure-row ${w.state === "future" ? "text-text-2" : "text-text"}`}>{thousands(w.dose)}</span>}</td>
                    <td class="p-2 align-top text-[12px] text-text-3">{note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Quiet>Zone 2 and harder in minutes, the dose in MET-minutes. A finished week's dose is the one the app measured; a planned week's is an estimate. The week's figures are a guide to the week, not a session for each day.</Quiet>
      </div>

      <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-canvas p-4">
        <span class="text-[15px] font-semibold text-text">How the plan moves</span>
        {v.moves.map((m) => (
          <div class="grid grid-cols-1 gap-x-3 border-t border-border pt-2 text-[13px] leading-relaxed text-text-2 first:border-t-0 first:pt-0 sm:grid-cols-[130px_minmax(0,1fr)]" key={m.head}>
            <b class="font-semibold text-text">{m.head}</b><span>{m.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Strength({ v }: { v: GuidePlanView }) {
  const session = (s: { name: string; sub: string; moves: readonly (readonly [string, string])[] }) => (
    <div class="flex min-w-0 flex-col gap-2 rounded-[12px] border border-border bg-canvas p-4">
      <span class="self-start rounded-full border border-accent-border bg-accent-fill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-accent-text">{s.name}</span>
      <span class="text-[15px] font-semibold text-text">{s.sub}</span>
      {s.moves.map(([k, t]) => <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-2 border-t border-border pt-2 text-[13px] leading-relaxed text-text-2" key={k}><b class="font-semibold text-text">{k}</b><span>{t}</span></div>)}
    </div>
  );
  return (
    <>
      <p class="m-0 max-w-[720px] text-[15px] leading-relaxed text-text">{v.strength.layoutLine}: each muscle group is loaded {v.strength.each}. Push days and pull days spread the body across more sessions, so a split is offered only from three days a week.</p>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {session(STRENGTH.a)}
        {session(STRENGTH.b)}
        <div class="flex min-w-0 flex-col gap-2 rounded-[12px] border border-border-strong bg-canvas p-4">
          <span class="text-[15px] font-semibold text-text">Sets, reps and effort</span>
          {v.strength.hard.map(([k, t]) => <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-2 border-t border-border pt-2 text-[13px] leading-relaxed text-text-2" key={k}><b class="font-semibold text-text">{k}</b><span>{t}</span></div>)}
        </div>
      </div>
      <Quiet>{STRENGTH.note}</Quiet>
      <Quiet>{STRENGTH.keeps}</Quiet>
    </>
  );
}

function Rules() {
  return (
    <>
      <p class="m-0 max-w-[720px] text-[15px] leading-relaxed text-text">The plan is arithmetic over a short list of published rules. Each is here with where it comes from.</p>
      <div class="flex flex-col overflow-hidden rounded-[12px] border border-border">
        {RULE_LINES.map((r) => (
          <div class="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-border bg-card p-3 text-[13px] leading-relaxed text-text-2 first:border-t-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]" key={r.id}>
            <b class="font-semibold text-text">{r.label}</b><span>{r.source}</span>
          </div>
        ))}
      </div>
      <Quiet>The plan never sets or changes a target, never names a condition or plans around a symptom, an injury or a medicine, gives no diet, promises no result, and uses no blood result.</Quiet>
    </>
  );
}

function Body({ v, tab, p }: { v: GuidePlanView; tab: Tab; p: GuideCommon }) {
  return tab === "last" && v.review ? <LastWeek v={v} p={p} /> : tab === "climb" ? <Climb v={v} /> : tab === "strength" ? <Strength v={v} /> : tab === "rules" ? <Rules /> : <Week v={v} />;
}

// ── the zone 2 number: the person's own target, changed from the plan ──

/** The targets with the zone 2 number set to a figure, for working the plan out before it is kept. */
const withZone2 = (targets: Target[], minutes: number): Target[] =>
  targets.some((t) => t.marker === "zone2_week") ? targets.map((t) => (t.marker === "zone2_week" ? { ...t, target_value: minutes } : t))
    : [...targets, { marker: "zone2_week", label: MARKER_BY_KEY.zone2_week.label, unit: MARKER_BY_KEY.zone2_week.unit, start_value: null, start_on: null, target_value: minutes, cadence: MARKER_BY_KEY.zone2_week.cadence }];
/** What the plan would do with a zone 2 number: the plan's own line for that target. */
const zoneLine = (next: GuidePlanView) => { const t = next.answers.works.find((x) => x.marker === "zone2_week")?.text; return t ? `${t}.` : ""; };
/** The person's zone 2 target, set to their figure: the row they have is changed, or one is added from last week's reading as every target starts. */
async function setZone2(p: GuideCommon, uid: string, minutes: number): Promise<string | null> {
  const t = p.targets.find((x) => x.marker === "zone2_week");
  if (t?.id) return updateTarget(p.sb, t.id, minutes);
  const def = MARKER_BY_KEY.zone2_week, now = latestOf("zone2_week", p.person, p.today);
  const res = await addTarget(p.sb, { horizon_id: p.h.id, user_id: uid, marker: "zone2_week", label: def.label, unit: def.unit, start_value: now ? round(now.value, def.decimals + 1) : null, start_on: now?.on ?? p.today, target_value: minutes, cadence: def.cadence });
  return res.ok ? null : res.detail || "the target could not be added";
}

// ── before the first plan: three questions, then the draft ──

function Questions({ onDone, busy, onCancel }: { onDone: (a: ScreenAnswers) => void; busy: boolean; onCancel?: () => void }) {
  const [a, setA] = useState<Partial<ScreenAnswers>>({});
  const all = SCREEN_QUESTIONS.every((q) => typeof a[q.key] === "boolean");
  return (
    <form class="flex flex-col gap-3 rounded-[12px] border border-border-strong bg-canvas p-4" onSubmit={(e) => { e.preventDefault(); if (all) onDone(a as ScreenAnswers); }}>
      <div class="text-[15px] font-semibold text-text">Before the first plan: three questions</div>
      {SCREEN_QUESTIONS.map((q, i) => (
        <fieldset class="m-0 flex flex-col gap-2 border-0 border-t border-border p-0 pt-3" key={q.key}>
          <legend class="float-left mb-2 w-full p-0 text-[15px] leading-relaxed text-text">{i + 1}. {q.text}{q.help ? <span class="mt-1 block text-[13px] leading-relaxed text-text-2">{q.help}</span> : null}</legend>
          <div class="flex gap-2">
            {([["Yes", true], ["No", false]] as const).map(([label, val]) => (
              <label class={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-4 text-[13px] font-semibold ${a[q.key] === val ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-alt text-text"}`} key={label}>
                <input type="radio" name={`screen-${q.key}`} checked={a[q.key] === val} onChange={() => setA((x) => ({ ...x, [q.key]: val }))} class="accent-accent" />{label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Quiet>These are health answers. They are kept with this horizon, only you can read them, and no coach or other person you share your page with is shown them. They decide whether a plan is offered and whether it has harder minutes. You can answer again or remove them at any time.</Quiet>
      <div class="flex flex-wrap gap-2">
        <button type="submit" disabled={!all || busy} class="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-canvas disabled:opacity-50">{busy ? "Keeping…" : "See what is offered"}</button>
        {onCancel && <Btn onClick={onCancel}>Not now</Btn>}
      </div>
    </form>
  );
}

/** The offer above the plan's own lines: the questions, then the draft, then "Use this plan". For the person whose horizon it is. */
export function GuideOffer(p: GuideCommon) {
  const [screen, setScreen] = useState<ScreenRow | null | undefined>(undefined);
  const [answering, setAnswering] = useState(false);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<Tab>("week");
  const [choices, setChoices] = useState<GuideChoices | null>(null);
  const [changing, setChanging] = useState(false);
  /** The choices of a draft are kept on the page until it is used; the zone 2 number is the person's target and is kept at once. */
  async function change(c: GuideChoices, zone2?: number) {
    if (zone2 !== undefined) {
      const uid = await p.userId();
      if (!uid) { p.setNotice("Sign in again to continue."); return; }
      setBusy("zone");
      const err = await setZone2(p, uid, zone2);
      setBusy("");
      if (err) { p.setNotice(`Could not change your zone 2 number: ${err}`); return; }
      await p.reload();
    }
    setChoices(c); setChanging(false);
  }
  useEffect(() => { let on = true; void loadScreen(p.sb, p.h.id).then((r) => { if (on) setScreen(r); }); return () => { on = false; }; }, [p.h.id]);

  async function answer(a: ScreenAnswers) {
    const uid = await p.userId();
    if (!uid) { p.setNotice("Sign in again to continue."); return; }
    setBusy("screen");
    const err = await saveScreen(p.sb, p.h.id, uid, a);
    setBusy("");
    if (err) { p.setNotice(`Could not keep your answers: ${err}`); return; }
    setScreen({ ...a, horizon_id: p.h.id, user_id: uid, answered_at: new Date().toISOString() }); setAnswering(false);
  }
  async function forget() {
    const err = await removeScreen(p.sb, p.h.id);
    if (err) p.setNotice(`Could not remove your answers: ${err}`); else { setScreen(null); setAnswering(false); }
  }

  if (screen === undefined) return null;
  if (answering) return <Questions onDone={(a) => void answer(a)} busy={busy === "screen"} onCancel={() => setAnswering(false)} />;
  if (!screen) {
    return (
      <div class="flex flex-col gap-2 rounded-[12px] border border-accent-border bg-accent-fill p-4">
        <div class="font-mono text-[11px] font-medium text-accent-text">From the Guide</div>
        <div class="text-[15px] font-semibold text-text">The Guide can write a plan from your targets.</div>
        <p class="m-0 text-[13px] leading-relaxed text-text-2">The shape of a week, how it steps each week to the date, and how strength is laid out. Kinds of session, minutes and intensity: not a session for each day. Three questions come first.</p>
        <div><Btn primary onClick={() => setAnswering(true)}>Answer three questions</Btn></div>
      </div>
    );
  }

  const outcome = screenOutcome(screen);
  const answered = `Answered on ${dayMonthLong(screen.answered_at.slice(0, 10))}.`;
  if (outcome === "none") {
    return (
      <div class="flex flex-col gap-2 rounded-[12px] border border-border-strong bg-canvas p-4">
        <div class="text-[15px] font-semibold text-text">No plan is offered. See a doctor first.</div>
        <p class="m-0 text-[13px] leading-relaxed text-text-2">Your answers say a doctor's word should come before a plan of exercise. That is the published rule, and it is not a diagnosis. Your targets and your readings stay as they are.</p>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] font-semibold"><button type="button" onClick={() => setAnswering(true)} class="min-h-11 text-accent-text hover:text-text">Answer again</button><button type="button" onClick={() => void forget()} class="min-h-11 text-text-2 hover:text-text">Remove my answers</button><span class="font-normal text-text-3">{answered}</span></div>
      </div>
    );
  }

  const base = guidePlan({ horizon: p.h, targets: p.targets, person: p.person, today: p.today, mode: outcome });
  const v = choices ? guidePlan({ horizon: p.h, targets: p.targets, person: p.person, today: p.today, mode: outcome, choices }) : base;
  async function use() {
    const uid = await p.userId();
    if (!uid) { p.setNotice("Sign in again to continue."); return; }
    setBusy("use");
    const err = await saveGuidePlan(p.sb, p.h.id, rowsWith(v, p.h.plan?.rows ?? []), storeOf(v, p.today), uid);
    setBusy("");
    if (err) { p.setNotice(`Could not keep the plan: ${err}`); return; }
    await p.reload();
  }
  return (
    <div class="flex flex-col gap-4 rounded-[12px] border border-accent-border p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <H2>The plan · written by the Guide from your targets</H2>
          <span class="text-[12px] text-text-3">A draft until you use it. Guidance on exercise, not medical advice. {v.status}.</span>
        </div>
        <div class="flex flex-wrap gap-2"><Btn primary disabled={busy === "use"} onClick={() => void use()}>{busy === "use" ? "Keeping…" : "Use this plan"}</Btn><Btn onClick={() => setChanging((x) => !x)}>Change it</Btn></div>
      </div>
      {outcome !== "full" && <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text-2">{SCREEN_WORDS[outcome]}</p>}
      {changing && <Changer v={v} busy={busy === "zone"} onSave={(c, z) => void change(c, z)} onCancel={() => setChanging(false)} saveLabel="Show the plan with these"
        preview={(m) => zoneLine(guidePlan({ horizon: p.h, targets: withZone2(p.targets, m), person: p.person, today: p.today, mode: outcome, choices }))} />}
      <p class="m-0 max-w-[820px] text-[16px] leading-[1.6] text-text">{v.lead}</p>
      {v.notes.map((n) => <Quiet key={n}>{n}</Quiet>)}
      <Answers v={v} />
      <Tabs v={v} tab={tab} pick={setTab} />
      <Body v={v} tab={tab} p={p} />
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-3 text-[12px] text-text-3">
        <span>{answered}</span>
        <button type="button" onClick={() => setAnswering(true)} class="min-h-11 font-semibold text-accent-text hover:text-text">Answer again</button>
      </div>
      <Quiet>{FOOT}</Quiet>
    </div>
  );
}

// ── changing the plan: the same closed list the chat offers ──

const STRENGTH_CHOICES: [number, Layout][] = [[2, "whole"], [3, "whole"], [3, "ppl"], [4, "upper_lower"], [4, "push_pull"]];
const selectClass = "min-h-11 rounded-[10px] border border-border-strong bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border";
/** What the field takes: a week of zone 2 between ten minutes and fifteen hours. The plan's own step stays ten minutes whatever is typed. */
const ZONE2_MIN = 10, ZONE2_MAX = 900;

function Changer({ v, busy, onSave, onCancel, saveLabel, preview }: { v: GuidePlanView; busy: boolean;
  /** The choices, and the zone 2 number when the person changed it. */ onSave: (c: GuideChoices, zone2?: number) => void; onCancel: () => void; saveLabel: string;
  /** What the plan would do with a zone 2 number, in the plan's own words. */ preview: (minutes: number) => string }) {
  const [days, setDays] = useState<number>(v.choices.aerobic_days ?? 3);
  const [strength, setStrength] = useState(`${v.choices.strength_days}|${v.choices.layout}`);
  const [out, setOut] = useState<string[]>(v.choices.leave_out);
  const [zone, setZone] = useState(v.aims.zone2 != null ? String(v.aims.zone2) : "");
  const [d, l] = strength.split("|");
  const z = Math.round(Number(zone));
  const zoneOk = zone.trim() !== "" && Number.isFinite(z) && z >= ZONE2_MIN && z <= ZONE2_MAX;
  const zoneChanged = zoneOk && z !== v.aims.zone2;
  const nowZone = v.climb.find((w) => w.state === "now")?.zone2 ?? null;
  return (
    <div class="flex flex-col gap-3 rounded-[12px] border border-border-strong bg-canvas p-4">
      <div class="text-[15px] font-semibold text-text">Change the plan</div>
      <div class="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3">
        <label class="flex flex-col gap-1 text-[12px] text-text-3">Minutes in zone 2 a week, by the date
          <span class="flex flex-wrap items-center gap-2">
            <input type="number" inputMode="numeric" min={ZONE2_MIN} max={ZONE2_MAX} step={5} value={zone} onInput={(e) => setZone((e.currentTarget as HTMLInputElement).value)} placeholder="I want" class={`${selectClass} w-28 font-mono`} />
            <span class="font-mono text-[11px] text-text-3">min · a typical week {v.base.zone2}{v.aims.zone2 != null ? ` · your number now ${v.aims.zone2}` : " · no number set"}</span>
          </span>
        </label>
        <p class="m-0 text-[13px] leading-relaxed text-text-2" aria-live="polite">{zone.trim() === "" ? "This is the number the plan's zone 2 minutes climb to." : !zoneOk ? `Between ${ZONE2_MIN} and ${ZONE2_MAX} minutes.` : `${preview(z)}${zoneChanged && nowZone != null ? ` This week keeps its ${nowZone}.` : ""}`}</p>
        <Quiet>It is your zone 2 target: changing it here changes it in your targets. You set the number. Verve sets none.</Quiet>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-[12px] text-text-3">Aerobic days a week
          <select value={String(days)} onChange={(e) => setDays(Number((e.currentTarget as HTMLSelectElement).value))} class={selectClass}>{[3, 4, 5].map((n) => <option value={String(n)}>{n} days</option>)}</select>
        </label>
        <label class="flex flex-col gap-1 text-[12px] text-text-3">Strength
          <select value={strength} onChange={(e) => setStrength((e.currentTarget as HTMLSelectElement).value)} class={selectClass}>{STRENGTH_CHOICES.map(([n, lay]) => <option value={`${n}|${lay}`}>{n} days: {LAYOUT_WORDS[lay].name}</option>)}</select>
        </label>
      </div>
      {v.base.types.length >= 2 && (
        <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
          <legend class="p-0 text-[12px] text-text-3">Leave a type out of the plan</legend>
          <div class="flex flex-wrap gap-2">
            {v.base.types.map((t) => (
              <label class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-border-strong bg-alt px-3 text-[13px] text-text" key={t}>
                <input type="checkbox" checked={out.includes(t)} disabled={!out.includes(t) && out.length >= v.base.types.length - 1} onChange={(e) => setOut((x) => ((e.currentTarget as HTMLInputElement).checked ? [...x, t] : x.filter((y) => y !== t)))} class="accent-accent" />{t}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Quiet>The days, the strength layout and the types do not change the week's minutes: those follow your numbers and the rules. {v.changing[1]} A split of push and pull days is offered only from three strength days.</Quiet>
      <div class="flex flex-wrap gap-2"><Btn primary disabled={busy || (zone.trim() !== "" && !zoneOk)} onClick={() => onSave({ aerobic_days: days, strength_days: Number(d), layout: l as Layout, leave_out: out }, zoneChanged ? z : undefined)}>{busy ? "Keeping…" : saveLabel}</Btn><Btn onClick={onCancel}>Cancel</Btn></div>
    </div>
  );
}

// ── the plan in use ──

export function GuidePlanCard(p: GuideCommon & { stored: GuideStored; /** The person leaves the Guide's plan for lines of their own. */ onOwnLines: () => void; /** A coach opens the plan's lines to write them. */ onCoachEdit: () => void }) {
  const v = guidePlan({ horizon: p.h, targets: p.targets, person: p.person, today: p.today, stored: p.stored, self: p.owner });
  const [tab, setTab] = useState<Tab>(() => firstTab(v, p.today));
  const [changing, setChanging] = useState(false);
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);

  // the stored lines follow the week, so a check-in that reads them reads this week's
  const kept = useRef("");
  const lines = JSON.stringify(rowsWith(v, p.h.plan?.rows ?? []));
  useEffect(() => {
    if (!p.owner || p.closed || lines === JSON.stringify(p.h.plan?.rows ?? []) || lines === kept.current) return;
    kept.current = lines;
    void p.userId().then((uid) => { if (uid) void saveGuidePlan(p.sb, p.h.id, JSON.parse(lines), p.stored, uid); });
  }, [lines, p.h.id]);

  /**
   * A change is kept. The weeks behind are written down as they were asked first, so the change rewrites none of them;
   * a new zone 2 number starts from the week it is made in, which keeps its own figures (guidePlan.ts freezeOf).
   */
  async function keep(choices: GuideChoices, zone2?: number) {
    const uid = await p.userId();
    if (!uid) { p.setNotice("Sign in again to continue."); return; }
    setBusy(true);
    const stored: GuideStored = { ...freezeOf(v, p.stored, zone2 !== undefined), choices };
    const next = guidePlan({ horizon: p.h, targets: zone2 !== undefined ? withZone2(p.targets, zone2) : p.targets, person: p.person, today: p.today, stored });
    const err = await saveGuidePlan(p.sb, p.h.id, rowsWith(next, p.h.plan?.rows ?? []), stored, uid) ?? (zone2 !== undefined ? await setZone2(p, uid, zone2) : null);
    setBusy(false);
    if (err) { p.setNotice(`Could not change the plan: ${err}`); return; }
    setChanging(false); await p.reload();
  }

  const canChange = p.owner && !p.closed;
  return (
    <>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <H2>The plan · written by the Guide from {p.owner ? "your" : "their"} targets</H2>
          <span class="text-[12px] text-text-3">{v.status} · in use since {dayMonthLong(p.stored.accepted_on)} · guidance on exercise, not medical advice</span>
        </div>
        <div class="flex flex-wrap gap-2">
          {canChange && <Btn onClick={() => setChanging((x) => !x)}>Change it</Btn>}
          {canChange && <Btn primary={!chat} onClick={() => setChat((x) => !x)}>{chat ? "Close the chat" : "Ask about it"}</Btn>}
          {!p.owner && !p.closed && <Btn onClick={p.onCoachEdit}>Write the plan yourself</Btn>}
        </div>
      </div>
      {changing && <Changer v={v} busy={busy} onSave={(c, z) => void keep(c, z)} onCancel={() => setChanging(false)} saveLabel="Change the plan"
        preview={(m) => zoneLine(guidePlan({ horizon: p.h, targets: withZone2(p.targets, m), person: p.person, today: p.today, stored: freezeOf(v, p.stored, true), self: p.owner }))} />}
      {chat && canChange && <Chat {...p} v={v} onApply={(c) => keep(c)} onClose={() => setChat(false)} />}
      <p class="m-0 max-w-[820px] text-[16px] leading-[1.6] text-text">{v.lead}</p>
      {v.notes.map((n) => <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text-2" key={n}>{n}</p>)}
      <Answers v={v} />
      <Tabs v={v} tab={tab} pick={setTab} />
      <Body v={v} tab={tab} p={p} />
      <Quiet>{FOOT}</Quiet>
      {canChange && <div><button type="button" onClick={p.onOwnLines} class="min-h-11 text-[13px] font-semibold text-text-2 hover:text-text">Write my own lines instead</button></div>}
      {!p.owner && <Quiet>The Guide wrote this from their targets. If you write the plan yourself, yours replaces it and reads "written by your coach".</Quiet>}
    </>
  );
}

// ── the chat about the plan ──

const CHIPS = ["Why this week?", "I missed a week", "More zone 2", "Fewer days", "Swap a type"];

function Chat(p: GuideCommon & { v: GuidePlanView; onApply: (c: GuideChoices) => Promise<void>; onClose: () => void }) {
  const [asks, setAsks] = useState<AskRow[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(p.access ? p.access.asks.left : null);
  const [line, setLine] = useState("");
  const [consent, setConsent] = useState<string | null>(null);
  const [ticked, setTicked] = useState(false);
  const [left0, setLeft0] = useState("");                       // the answer whose offered change was left
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { let on = true; void listAsks(p.sb, p.h.id).then((r) => { if (on) setAsks(r); }); return () => { on = false; }; }, [p.h.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [asks?.length, busy]);

  const free = !!p.access && !p.access.pro;
  const none = left != null && left <= 0;
  async function send(text: string) {
    const question = text.trim().slice(0, 500);
    if (!question || busy) return;
    setBusy(true); setLine("");
    const res = await askGuide(p.sb, { horizon_id: p.h.id, question, timezone: browserZone() });
    setBusy(false);
    if (!res.ok) {
      if (res.error === "consent_required") { setConsent(question); return; }
      if (res.error === "pro_required") { setLeft(0); setLine(free ? "That was the free question. More are part of Pro." : ERROR_WORDS.pro_required); return; }
      if (res.error === "week_limit") setLeft(0);
      setLine(ERROR_WORDS[res.error]); return;
    }
    setAsks((a) => [...(a ?? []), { id: res.data.id, horizon_id: p.h.id, question, answer: res.data.answer, rule: res.data.rule, option: res.data.option, created_at: res.data.created_at }]);
    if (res.data.left != null) setLeft(res.data.left);
    setQ("");
  }
  async function agree() {
    const uid = await p.userId();
    if (!uid || !consent) return;
    setBusy(true);
    const err = await grantConsent(p.sb, uid);
    setBusy(false);
    if (err) { setLine(`Could not record your consent: ${err}`); return; }
    const question = consent; setConsent(null); setTicked(false);
    await send(question);
  }
  async function clear() {
    if (!confirm("Clear your questions and the Guide's answers on this horizon? The plan does not change.")) return;
    const err = await clearAsks(p.sb, p.h.id);
    if (err) setLine(`Could not clear them: ${err}`); else setAsks([]);
  }
  const newest = asks?.length ? asks[asks.length - 1].id : "";

  return (
    <section class="flex flex-col overflow-hidden rounded-[12px] border border-border-strong" aria-label="Ask about the plan">
      <div class="flex items-center justify-between gap-3 border-b border-border bg-alt px-4 py-3">
        <div class="flex flex-col gap-0.5"><b class="text-[15px] font-semibold text-text">Ask about the plan</b><span class="text-[12px] text-text-3">The Guide · an AI model, answering from your plan and its rules</span></div>
        <button type="button" onClick={p.onClose} class="min-h-11 px-2 text-[13px] font-semibold text-text-2 hover:text-text">Close</button>
      </div>
      <div class="flex max-h-[520px] flex-col gap-3 overflow-y-auto bg-card p-4" aria-live="polite">
        {asks == null && <Quiet>Reading your questions…</Quiet>}
        {asks?.length === 0 && <Quiet>Ask why a line is what it is, or say what does not fit your week. The Guide explains a line by its rule, or offers a change you can accept or leave. It talks about the plan and nothing else.</Quiet>}
        {(asks ?? []).map((a) => {
          const rule = a.rule ? RULE_LINES.find((r) => r.id === a.rule) : null;
          const option = a.option ? p.v.options.find((o) => o.id === a.option) : null;
          return (
            <div class="flex flex-col gap-3" key={a.id}>
              <div class="max-w-[80%] self-end rounded-[14px_14px_4px_14px] border border-accent-border bg-accent-fill px-3 py-2 text-[15px] leading-relaxed text-text">{a.question}</div>
              <div class="flex max-w-[90%] flex-col gap-2 self-start rounded-[14px_14px_14px_4px] border border-border bg-canvas px-3 py-3 text-[15px] leading-relaxed text-text">
                <p class="m-0">{a.answer}</p>
                {option && a.id === newest && a.id !== left0 && (
                  <>
                    <div class="flex flex-col gap-1 rounded-[12px] border border-accent-border bg-card p-3">
                      <span class="font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-accent-text">A change to the plan</span>
                      {option.rows.map((r) => <div class="flex justify-between gap-3 border-t border-border pt-1 text-[13px] text-text-2" key={r.label}><span>{r.label}</span><b class="t-figure-row text-right text-text">{r.from} → {r.to}</b></div>)}
                    </div>
                    <div class="flex flex-wrap gap-2"><Btn primary onClick={() => { const c = applyOption(p.v, option.id); if (c) void p.onApply(c); }}>Change the plan</Btn><Btn onClick={() => setLeft0(a.id)}>Leave it</Btn></div>
                  </>
                )}
                {rule && <span class="self-start rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] font-medium text-text-3">Rule: {rule.label}</span>}
              </div>
            </div>
          );
        })}
        {busy && <Quiet>The Guide is answering…</Quiet>}
        <div ref={end} />
      </div>
      <div class="flex flex-col gap-3 border-t border-border bg-card p-4">
        {consent != null ? (
          <div class="flex flex-col gap-3 rounded-[10px] border border-accent-border bg-accent-fill p-4">
            <label class="flex items-start gap-3 text-[13px] leading-relaxed text-text-2">
              <input type="checkbox" checked={ticked} onChange={(e) => setTicked((e.currentTarget as HTMLInputElement).checked)} class="mt-1" />
              <span>The Guide's writer receives your question as you typed it, and the plan's figures: its weeks, your targets and a typical week before the plan. It receives no name, no report, no message and none of your three answers.</span>
            </label>
            <div class="flex flex-wrap gap-2"><Btn primary disabled={!ticked || busy} onClick={() => void agree()}>Agree and ask</Btn><Btn onClick={() => { setConsent(null); setTicked(false); }}>Cancel</Btn></div>
          </div>
        ) : none ? (
          <div class="flex flex-wrap items-center gap-3 text-[13px] text-text-2">
            <span>{free ? "That was the free question. More are part of Pro." : ERROR_WORDS.week_limit}</span>
            {free && <a href="/plans" class="inline-flex min-h-11 items-center rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-canvas">See the plans</a>}
          </div>
        ) : (
          <>
            <div class="flex flex-wrap gap-2">{CHIPS.map((c) => <button type="button" disabled={busy} onClick={() => void send(c)} class="inline-flex min-h-11 items-center rounded-full border border-border bg-canvas px-3 text-[13px] font-medium text-text-2 hover:border-accent-border disabled:opacity-50" key={c}>{c}</button>)}</div>
            <form class="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(q); }}>
              <label class="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-text-3">Your question about the plan
                <input type="text" value={q} maxLength={500} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} placeholder="Ask about your plan" class="min-h-11 rounded-[10px] border border-border-strong bg-canvas px-3 text-[15px] text-text outline-none focus:border-accent-border" />
              </label>
              <button type="submit" disabled={busy || !q.trim()} class="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-canvas disabled:opacity-50">Send</button>
            </form>
          </>
        )}
        {line && <p class="m-0 text-[13px] text-text-2" role="status">{line}</p>}
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <Quiet>{left != null && !none ? `${left} ${free ? "free question" : left === 1 ? "question left this week" : "questions left this week"}. ` : ""}Your question is sent to the model as you type it, so leave names out. It is kept here for you to read again; no one you share your page with sees it.</Quiet>
          {!!asks?.length && <button type="button" onClick={() => void clear()} class="min-h-11 text-[12px] font-semibold text-text-2 hover:text-text">Clear the chat</button>}
        </div>
        <Quiet>The Guide does not say what a symptom is, plan around an injury or a medicine, give a diet, or set a target. For those, see a doctor or the person who treats you.</Quiet>
      </div>
    </section>
  );
}
