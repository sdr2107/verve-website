/**
 * Horizon, made simple: the one page a horizon opens on (the founder, 27 November 2026: "Too many screens - too
 * complex to follow. I want something simple." "you have put too much text with different fonts - my eyes go all over
 * the place - i do not know what to click first and where to go next. I just want to know where am i now, what i did
 * and how i am progressing in fitness.").
 *
 *   This week    "Where you are": five rows, one line each, done of asked with one bar. "What you did": the sessions.
 *   Past weeks   one row for each finished week; press one for its sessions. Fitness in one line under them.
 *   Your plan    three cards (fitness, tier, aim), then six small cards of one size, one for each letter of FITT-VP
 *                (the same day, after seeing the first two live: "rename the science to 'your plan' tabs ... keep it
 *                simple ... tighten the boxes - calm and simple"; ../horizon/yourPlan.ts).
 *
 * And Settings, one link away: three lines and nothing else (the Monday email, a pause, delete).
 *
 * Words are in one face and two colours; figures are the site's row figure (t-figure-row). A row that reached its
 * line is the success colour, and nothing else is coloured. No paragraph stands on any tab. What the page showed
 * before 27 November 2026 is hidden, not deleted (../horizon/pages.ts HORIZON_OLD_PAGES): while it is hidden the foot
 * carries no link to it.
 *
 * Every figure and every word is worked out in ../horizon/simple.ts from the plan's own readers; nothing is counted
 * here. The blocks carry data-simple hooks so the page can be checked signed in.
 */
import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { HORIZON_TABS, type HorizonTab } from "../horizon/pages.ts";
import type { YourPlan } from "../horizon/yourPlan.ts";
import type { WeeklyState } from "../account.ts";
import { NO_SESSIONS, type NowRow, type NowWeek, type PastWeek, type SessionRow } from "../horizon/simple.ts";

const linkClass = "min-h-9 text-[13px] font-semibold text-accent-text hover:text-text";
const small = "m-0 text-[13px] font-medium text-text-2";

/** One of the five rows: the name, a bar, and the figure. At a phone's width the bar sits under the name and the figure. */
function Row({ r }: { r: NowRow }) {
  const tone = r.reached ? "text-good" : "text-text";
  return (
    <li data-row={r.key} data-reached={r.reached ? "yes" : "no"} class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[112px_minmax(0,1fr)_auto]">
      <span class="text-[15px] font-medium text-text">{r.label}</span>
      <span class="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
        {r.share != null
          ? <span class="block h-1.5 w-full overflow-hidden rounded-full bg-alt" aria-hidden="true"><span class={`block h-full rounded-full ${r.reached ? "bg-good" : "bg-accent"}`} style={{ width: `${Math.round(r.share * 100)}%` }} /></span>
          : r.note ? <span class="block text-[13px] leading-snug text-text-2" data-row-note>{r.note}</span> : null}
      </span>
      <span class="flex flex-wrap items-baseline justify-end gap-x-1.5 text-right">
        {r.figure ? <span class={`t-figure-row ${tone}`}>{r.figure}</span> : null}
        {r.unit ? <span class="whitespace-nowrap text-[13px] text-text-2">{r.unit}</span> : null}
        {r.extra ? <span class="whitespace-nowrap text-[13px] text-text-2">· {r.extra}</span> : null}
        {r.reached ? <span class="sr-only">Reached</span> : null}
      </span>
    </li>
  );
}

/** A week's sessions: the day, the activity, its minutes, and what it counted as. */
function Sessions({ rows, none }: { rows: SessionRow[]; none: string }) {
  if (!rows.length) return <p class="m-0 text-[14px] text-text-2" data-simple="no-sessions">{none}</p>;
  return (
    <ul class="m-0 flex list-none flex-col p-0" data-simple="sessions">
      {rows.map((s, i) => (
        <li key={`${s.date}-${i}`} data-session={s.kind} class={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 py-2 sm:grid-cols-[40px_minmax(0,1fr)_72px_150px] ${i ? "border-t border-border" : ""}`}>
          <span class="text-[13px] text-text-2">{s.day}</span>
          <span class="min-w-0 truncate text-[15px] text-text">{s.name}</span>
          <span class="whitespace-nowrap text-right text-[14px] text-text">{s.minutes}</span>
          <span class="col-span-2 col-start-2 text-[13px] text-text-2 sm:col-span-1 sm:col-start-auto sm:text-right">{s.counted}</span>
        </li>
      ))}
    </ul>
  );
}

/** A finished week: its number and days, its four figures, and how many reached their line. Pressing it opens its sessions. */
function Week({ w, open, onToggle }: { w: PastWeek; open: boolean; onToggle: () => void }) {
  return (
    <li data-week={w.week} class="border-t border-border first:border-t-0">
      <button type="button" onClick={onToggle} aria-expanded={open}
        class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 py-3 text-left sm:grid-cols-[150px_minmax(0,1fr)_112px]">
        <span class="flex min-w-0 flex-col">
          <span class="text-[15px] font-medium text-text">Week {w.week}</span>
          <span class="text-[12px] text-text-2">{w.dates}</span>
        </span>
        <span class="order-3 col-span-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:order-none sm:col-span-1 lg:grid-cols-[1fr_0.75fr_1.35fr_1.25fr]">
          {w.cells.map((c) => (
            <span key={c.key} data-cell={c.key} data-reached={c.reached ? "yes" : "no"} class="flex min-w-0 flex-col">
              <span class="text-[12px] text-text-2 lg:hidden">{c.label}</span>
              {c.text ? <span class={`t-figure-row whitespace-nowrap ${c.reached ? "text-good" : "text-text"}`}>{c.text}</span> : <span class="text-[13px] text-text-2">Nothing</span>}
            </span>
          ))}
        </span>
        <span class="whitespace-nowrap text-right text-[13px] text-text-2" data-week-count>{w.count ?? ""}</span>
      </button>
      {open ? <div class="pb-3 sm:pl-[166px]" data-week-sessions><Sessions rows={w.sessions} none="No session was logged that week." /></div> : null}
    </li>
  );
}

/** "Your plan": three cards, then the six letters as small cards of one size, then one quiet line where something must be said. */
function Plan({ plan }: { plan: YourPlan | null }) {
  if (!plan) return <p class="m-0 text-[14px] text-text-2" data-plan="reading">Reading your plan…</p>;
  return (
    <>
      {plan.cards.length ? (
        <ul class="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3" data-plan="cards">
          {plan.cards.map((c) => (
            <li key={c.key} data-plan-card={c.key} class="flex flex-col gap-0.5 rounded-[12px] bg-alt px-4 py-3">
              <span class="text-[13px] text-text-2">{c.label}</span>
              <span class="t-figure text-text">{c.big}</span>
              <span class="text-[13px] leading-snug text-text-2">{c.small}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {plan.letters.length ? (
        <div class="flex flex-col gap-2 border-t border-border pt-4">
          <h2 class={small}>Your week, letter by letter</h2>
          <ul class="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3" data-plan="letters">
            {plan.letters.map((l) => (
              <li key={l.key} data-plan-letter={l.key} class="flex min-h-[88px] flex-col gap-0.5 rounded-[12px] border border-border px-4 py-3">
                <span class="text-[13px] text-text-2">{l.label}</span>
                <span class="text-[15px] font-medium leading-snug text-text">{l.now}</span>
                <span class="text-[13px] leading-snug text-text-2">{l.by}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan.line ? <p class={`m-0 text-[13px] text-text-2 ${plan.cards.length ? "border-t border-border pt-3" : ""}`} data-plan="line">{plan.line}</p> : null}
    </>
  );
}

export function SimpleHorizon({ title, head, tab, goTab, now, sessions, past, firstWeek, fitness, kept, nothing, nav, plan, onMore, onSettings, onSetAnother }: {
  title: string; /** "Week 3 of 12 · to 22 February" */ head: string;
  tab: HorizonTab; goTab: (t: HorizonTab) => void;
  now: NowWeek | null; sessions: SessionRow[];
  past: PastWeek[]; /** Before a week is finished: when the first full one ends. */ firstWeek: string | null; fitness: string;
  /** A horizon that is kept and no longer run: the one sentence that says so, or none. */ kept: string | null;
  /** The sentence for a week nothing has arrived for yet. */ nothing: string;
  /** The person's horizons as chips, when they have more than one. */ nav: any;
  /** "Your plan", worked out by ../horizon/yourPlan.ts; null while it is being read. */ plan: YourPlan | null;
  /** The way to the hidden pages: handed in only while they are switched back on (pages.ts HORIZON_OLD_PAGES). */ onMore?: () => void;
  /** Settings are the owner's: absent for someone the page is shared with. */ onSettings?: () => void; onSetAnother?: () => void;
}) {
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  return (
    <section class="flex flex-col gap-5" data-simple="horizon" data-tab={tab}>
      <header class="flex flex-col gap-3">
        <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 class="m-0 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-text">{title}</h1>
          <span class="text-[14px] text-text-2" data-simple="head">{head}</span>
        </div>
        {nav ? <div>{nav}</div> : null}
        <div class="grid w-full grid-cols-3 gap-1 rounded-[12px] border border-border bg-alt p-1 sm:w-auto sm:self-start" role="tablist" aria-label="This horizon">
          {HORIZON_TABS.map(([k, label]) => (
            <button type="button" role="tab" aria-selected={tab === k} key={k} data-simple-tab={k} onClick={() => goTab(k)}
              class={`min-h-10 whitespace-nowrap rounded-[9px] px-1.5 text-[13px] sm:px-5 sm:text-[14px] ${tab === k ? "border border-border bg-card font-semibold text-text" : "border border-transparent font-medium text-text-2 hover:text-text"}`}>{label}</button>
          ))}
        </div>
      </header>

      {tab === "now" ? (
        <div class="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5" data-simple="now" role="tabpanel">
          <div class="flex flex-col gap-1">
            <h2 class={small}>Where you are</h2>
            {now ? <ul class="m-0 flex list-none flex-col divide-y divide-border p-0" data-simple="rows" data-judged={now.judged ? "yes" : "no"}>{now.rows.map((r) => <Row r={r} key={r.key} />)}</ul> : null}
            {kept ? <p class="m-0 text-[13px] text-text-2" data-simple="kept">{kept}</p> : null}
            {!kept && now?.line ? <p class="m-0 text-[13px] text-text-2" data-simple="line">{now.line}</p> : null}
            {now && !now.arrived ? <p class="m-0 text-[13px] text-text-2" data-simple="nothing">{nothing}</p> : null}
          </div>
          <div class="flex flex-col gap-2 border-t border-border pt-4">
            <h2 class={small}>What you did</h2>
            <Sessions rows={sessions} none={NO_SESSIONS} />
          </div>
        </div>
      ) : tab === "past" ? (
        <div class="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-5" data-simple="past" role="tabpanel">
          {past.length ? (
            <>
              <div class="hidden grid-cols-[150px_minmax(0,1fr)_112px] gap-x-4 lg:grid" aria-hidden="true">
                <span />
                <span class="grid grid-cols-[1fr_0.75fr_1.35fr_1.25fr] gap-x-4">{past[0].cells.map((c) => <span key={c.key} class="text-[12px] text-text-2">{c.label}</span>)}</span>
                <span />
              </div>
              <ul class="m-0 flex list-none flex-col p-0" data-simple="weeks">
                {past.map((w) => <Week w={w} key={w.from} open={openWeek === w.week} onToggle={() => setOpenWeek(openWeek === w.week ? null : w.week)} />)}
              </ul>
            </>
          ) : <p class="m-0 text-[14px] text-text-2" data-simple="no-weeks">{firstWeek ?? "No week is finished yet."}</p>}
          <p class="m-0 border-t border-border pt-3 text-[14px] text-text-2" data-simple="fitness">{fitness}</p>
        </div>
      ) : (
        <div class="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5" data-simple="plan" role="tabpanel">
          <Plan plan={plan} />
        </div>
      )}

      {onMore || onSettings || onSetAnother ? (
        <div class="flex flex-wrap items-center gap-x-5 gap-y-1" data-simple="links">
          {onMore ? <button type="button" onClick={onMore} class={linkClass} data-simple-link="more">How the numbers are set</button> : null}
          {onSettings ? <button type="button" onClick={onSettings} class={linkClass} data-simple-link="settings">Settings</button> : null}
          {onSetAnother ? <button type="button" onClick={onSetAnother} class="min-h-9 text-[13px] font-medium text-text-2 hover:text-text" data-simple-link="another">Set another</button> : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Settings: three lines and nothing else (the founder, 27 November 2026: "'How are the numbers set' and 'settings' at
 * the bottom direct us to the old page - the jargon one"). The Monday email is the account's own switch ("Your week",
 * accountApi.ts). A pause and delete are the horizon's existing controls: pressing "Pause" opens the existing ask,
 * handed in as `pauseAsk`. The horizon's older switches are not shown here; what they are set to is left as it is.
 */
export function SimpleSettings({ title, head, onBack, weekly, weeklyBusy, onWeekly, pause, pauseAsk, onPause, onDelete, deleting }: {
  title: string; head: string; onBack: () => void;
  /** The Monday email's switch; null while it is being read. */ weekly: WeeklyState | null; weeklyBusy: boolean; onWeekly: (on: boolean) => void;
  /** A pause, where the horizon can still be paused: whether one can be asked for today, and one small line (what is left, or why not). Null where no pause is offered. */
  pause: { open: boolean; note: string } | null;
  /** The existing ask, drawn under the line once "Pause" is pressed. */ pauseAsk: ComponentChildren; onPause: () => void;
  onDelete: () => void; deleting: boolean;
}) {
  const row = "flex items-center justify-between gap-4 py-3.5";
  const press = "inline-flex min-h-10 shrink-0 items-center justify-center rounded-[10px] border border-border-strong bg-card px-4 text-[14px] font-semibold text-text hover:border-text-3 disabled:opacity-50";
  return (
    <section class="flex max-w-[640px] flex-col gap-5" data-simple="settings">
      <div><button type="button" onClick={onBack} class={linkClass} data-simple-back>← This week</button></div>
      <header class="flex flex-col gap-1">
        <h1 class="m-0 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-text">Settings</h1>
        <span class="text-[14px] text-text-2">{title} · {head}</span>
      </header>
      <div class="flex flex-col divide-y divide-border rounded-[16px] border border-border bg-card px-5" data-settings="lines">
        <label class={`${row} ${weekly?.state === "unavailable" ? "" : "cursor-pointer"}`} data-setting="email" data-state={weekly?.state ?? "reading"}>
          <span class="flex min-w-0 flex-col">
            <span class="text-[15px] font-medium text-text">Email me my week on Mondays</span>
            {weekly?.state === "unavailable" ? <span class="text-[13px] text-text-2">Not switched on for this account yet.</span> : null}
          </span>
          {weekly?.state === "unavailable" ? null
            : <input type="checkbox" checked={weekly?.state === "on"} disabled={!weekly || weeklyBusy} onChange={(e) => onWeekly((e.currentTarget as HTMLInputElement).checked)} class="h-5 w-5 shrink-0 accent-accent" />}
        </label>
        {pause ? (
          <div class="flex flex-col" data-setting="pause">
            <div class={row}>
              <span class="flex min-w-0 flex-col">
                <span class="text-[15px] font-medium text-text">Pause a week</span>
                {pause.note ? <span class="text-[13px] leading-snug text-text-2">{pause.note}</span> : null}
              </span>
              {pauseAsk ? null : <button type="button" disabled={!pause.open} onClick={onPause} class={press}>Pause</button>}
            </div>
            {pauseAsk ? <div class="pb-4">{pauseAsk}</div> : null}
          </div>
        ) : null}
        <div class={row} data-setting="delete">
          <span class="flex min-w-0 flex-col">
            <span class="text-[15px] font-medium text-text">Delete this horizon</span>
            <span class="text-[13px] leading-snug text-text-2">Your readings stay.</span>
          </span>
          <button type="button" disabled={deleting} onClick={onDelete} class={press}>Delete</button>
        </div>
      </div>
    </section>
  );
}
