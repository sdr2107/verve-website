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
 * person's targets and never sets or changes one.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { dayMonthLong, weekdayDayMonth, type Target } from "../horizon/derive.ts";
import {
  guidePlan, storeOf, rowsWith, applyOption, screenOutcome, SCREEN_QUESTIONS, SCREEN_WORDS, STRENGTH, RULE_LINES, LAYOUT_WORDS,
  type GuidePlanView, type GuideStored, type GuideChoices, type Layout, type ScreenAnswers,
} from "../horizon/guidePlan.ts";
import {
  askGuide, clearAsks, grantConsent, listAsks, loadScreen, removeScreen, saveGuidePlan, saveScreen, ERROR_WORDS,
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

type Tab = "week" | "climb" | "strength" | "rules";
const TABS: [Tab, string][] = [["week", "This week"], ["climb", "The climb"], ["strength", "Strength"], ["rules", "The rules"]];

function Tabs({ tab, pick }: { tab: Tab; pick: (t: Tab) => void }) {
  return (
    <div class="grid grid-cols-4 gap-1 rounded-[10px] border border-border bg-alt p-1 sm:inline-grid sm:self-start" role="tablist" aria-label="The plan's parts">
      {TABS.map(([k, label]) => (
        <button type="button" role="tab" aria-selected={tab === k} onClick={() => pick(k)}
          class={`min-h-11 rounded-[8px] px-3 text-[13px] font-semibold ${tab === k ? "bg-card text-text" : "text-text-2 hover:text-text"}`}>{label}</button>
      ))}
    </div>
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

function Climb({ v }: { v: GuidePlanView }) {
  const max = Math.max(150, ...v.climb.map((w) => w.total));
  const top = Math.ceil(max / 50) * 50;
  const pct = (m: number) => `${(m / top) * 100}%`;
  const first = v.climb[0], last = v.climb[v.climb.length - 1];
  return (
    <>
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
        <Quiet>The dashed line is 150 minutes, the first flag on the app's Weekly Ascent. Over each bar on a wide screen: that week's dose in MET-minutes. The lit column is this week. {v.climbNote}</Quiet>
      </div>

      <div class="overflow-x-auto rounded-[12px] border border-border">
        <table class="w-full min-w-[560px] border-collapse text-right font-mono text-[12px] text-text">
          <thead>
            <tr class="bg-alt text-[10px] font-semibold uppercase tracking-[0.05em] text-text-2">
              <th class="p-2 text-left font-semibold">Week</th><th class="p-2 font-semibold">Zone 2</th><th class="p-2 font-semibold">Harder</th><th class="p-2 font-semibold">Total</th><th class="p-2 font-semibold">Dose</th><th class="p-2 text-left font-semibold">Strength</th>{first.steps != null && <th class="p-2 font-semibold">Steps a day</th>}
            </tr>
          </thead>
          <tbody>
            {v.climb.map((w) => (
              <tr class={`border-t border-border ${w.state === "now" ? "bg-accent-fill" : "bg-card"}`} key={w.week}>
                <td class="p-2 text-left text-text-2">{w.week}{w.state === "now" ? " · now" : ""}</td><td class="p-2">{w.zone2}</td><td class="p-2">{w.harder}</td><td class="p-2">{w.total}</td><td class="p-2">{thousands(w.dose)}</td>
                <td class="p-2 text-left font-sans text-text-2">{v.strength.days} · {w.test ? "and a fitness test" : w.sets}{w.repeats ? " · step repeated" : ""}</td>{first.steps != null && <td class="p-2">{w.steps != null ? thousands(w.steps) : ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Quiet>Minutes in the first three columns, the dose in MET-minutes. The week's figures are a guide to the week, not a session for each day.</Quiet>

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

function Body({ v, tab }: { v: GuidePlanView; tab: Tab }) {
  return tab === "week" ? <Week v={v} /> : tab === "climb" ? <Climb v={v} /> : tab === "strength" ? <Strength v={v} /> : <Rules />;
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
          <legend class="float-left mb-2 w-full p-0 text-[15px] leading-relaxed text-text">{i + 1}. {q.text}</legend>
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
      {changing && <Changer v={v} busy={false} onSave={(c) => { setChoices(c); setChanging(false); }} onCancel={() => setChanging(false)} saveLabel="Show the plan with these" />}
      <p class="m-0 max-w-[820px] text-[16px] leading-[1.6] text-text">{v.lead}</p>
      {v.notes.map((n) => <Quiet key={n}>{n}</Quiet>)}
      <Tabs tab={tab} pick={setTab} />
      <Body v={v} tab={tab} />
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

function Changer({ v, busy, onSave, onCancel, saveLabel }: { v: GuidePlanView; busy: boolean; onSave: (c: GuideChoices) => void; onCancel: () => void; saveLabel: string }) {
  const [days, setDays] = useState<number>(v.choices.aerobic_days ?? 3);
  const [strength, setStrength] = useState(`${v.choices.strength_days}|${v.choices.layout}`);
  const [out, setOut] = useState<string[]>(v.choices.leave_out);
  const [d, l] = strength.split("|");
  return (
    <div class="flex flex-col gap-3 rounded-[12px] border border-border-strong bg-canvas p-4">
      <div class="text-[15px] font-semibold text-text">Change the plan</div>
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
      <Quiet>The week's minutes and the step each week do not change with these: they follow your targets and the rules. A split of push and pull days is offered only from three strength days.</Quiet>
      <div class="flex flex-wrap gap-2"><Btn primary disabled={busy} onClick={() => onSave({ aerobic_days: days, strength_days: Number(d), layout: l as Layout, leave_out: out })}>{busy ? "Keeping…" : saveLabel}</Btn><Btn onClick={onCancel}>Cancel</Btn></div>
    </div>
  );
}

// ── the plan in use ──

export function GuidePlanCard(p: GuideCommon & { stored: GuideStored; /** The person leaves the Guide's plan for lines of their own. */ onOwnLines: () => void; /** A coach opens the plan's lines to write them. */ onCoachEdit: () => void }) {
  const [tab, setTab] = useState<Tab>("week");
  const [changing, setChanging] = useState(false);
  const [chat, setChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = guidePlan({ horizon: p.h, targets: p.targets, person: p.person, today: p.today, stored: p.stored, self: p.owner });

  // the stored lines follow the week, so a check-in that reads them reads this week's
  const kept = useRef("");
  const lines = JSON.stringify(rowsWith(v, p.h.plan?.rows ?? []));
  useEffect(() => {
    if (!p.owner || p.closed || lines === JSON.stringify(p.h.plan?.rows ?? []) || lines === kept.current) return;
    kept.current = lines;
    void p.userId().then((uid) => { if (uid) void saveGuidePlan(p.sb, p.h.id, JSON.parse(lines), p.stored, uid); });
  }, [lines, p.h.id]);

  async function keep(choices: GuideChoices) {
    const uid = await p.userId();
    if (!uid) { p.setNotice("Sign in again to continue."); return; }
    setBusy(true);
    const stored: GuideStored = { ...p.stored, choices };
    const next = guidePlan({ horizon: p.h, targets: p.targets, person: p.person, today: p.today, stored });
    const err = await saveGuidePlan(p.sb, p.h.id, rowsWith(next, p.h.plan?.rows ?? []), stored, uid);
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
      {changing && <Changer v={v} busy={busy} onSave={(c) => void keep(c)} onCancel={() => setChanging(false)} saveLabel="Change the plan" />}
      {chat && canChange && <Chat {...p} v={v} onApply={keep} onClose={() => setChat(false)} />}
      <p class="m-0 max-w-[820px] text-[16px] leading-[1.6] text-text">{v.lead}</p>
      {v.notes.map((n) => <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text-2" key={n}>{n}</p>)}
      <Tabs tab={tab} pick={setTab} />
      <Body v={v} tab={tab} />
      <Quiet>{FOOT}</Quiet>
      {canChange && <div><button type="button" onClick={p.onOwnLines} class="min-h-11 text-[13px] font-semibold text-text-2 hover:text-text">Write my own lines instead</button></div>}
      {!p.owner && <Quiet>The Guide wrote this from their targets. If you write the plan yourself, yours replaces it and reads "written by your coach".</Quiet>}
    </>
  );
}

// ── the chat about the plan ──

const CHIPS = ["Why this week?", "I missed a week", "Fewer days", "Swap a type"];

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
