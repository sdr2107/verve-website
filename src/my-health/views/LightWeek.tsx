/**
 * The week, kept light (canvas "Verve, the plan you follow", board 08; the founder, 25 November 2026: "the user
 * giving time and doing something is more important - not to overwhelm the user", then "Yes, amounts first").
 *
 *   LightWeekCard  the first thing a week shows: three amounts, each "done of asked", and a few ideas under them
 *   MyActivities   the activities the ideas draw from: chips the person ticks, and a few words of their own
 *   LoggedCard     the sessions logged this week, and what each filled
 *
 * Every figure and every sentence is worked out in ../horizon/lightWeek.ts from the plan's own readers; nothing is
 * counted here and no model writes any of it. The blocks carry data-light hooks so the page can be checked signed in.
 */
import { useState } from "preact/hooks";
import { ACTIVITIES, OWN_AT_MOST, OWN_LENGTH, type ActivityKey } from "../../data/activities.ts";
import {
  CHOSEN_FROM_SESSIONS, CHOSEN_LEAD, COUNTS_HEAD, COUNTS_NONE, COUNTS_NOTE, NOTHING_ARRIVED, REACHED, cleanKeys, cleanOwn,
  type Chosen, type Ideas, type LightWeek, type LoggedLine,
} from "../horizon/lightWeek.ts";

const Eyebrow = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium text-text-3">{children}</div>;
const H2 = ({ children }: { children: any }) => <h2 class="m-0 text-[18px] font-semibold text-text">{children}</h2>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;
const quietLink = "min-h-9 text-[13px] font-semibold text-accent-text hover:text-text";
const GRID: Record<number, string> = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };
const dayShort = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" });

/**
 * This week, as its amounts. `onSeven` and `onPlan` are the two ways further in, each drawn only where the page it
 * leads to exists today: the week as its seven days, and the six letters the amounts come from.
 */
export function LightWeekCard({ light, ideas, eyebrow, onSeven, onPlan, children }: {
  light: LightWeek; ideas: Ideas; /** "Thursday · week 3 of 12" */ eyebrow: string;
  onSeven?: () => void; onPlan?: () => void; /** My activities, where the horizon can keep them. */ children?: any;
}) {
  return (
    <section id="horizon-light" data-light="week" class="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5" aria-label="This week, as three amounts">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <H2>This week</H2>
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <div class={`grid grid-cols-1 gap-3 ${GRID[light.amounts.length] ?? ""}`} data-light="amounts">
        {light.amounts.map((a) => (
          <div key={a.key} data-amount={a.key} data-reached={a.reached ? "yes" : "no"} class="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-border bg-alt p-4">
            <span class="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-text-3">{a.label}</span>
            <span class="flex flex-wrap items-baseline gap-x-1.5"><span class="t-figure text-text">{a.figure}</span><span class="whitespace-nowrap text-[13px] font-medium text-text-3">{a.unit}</span></span>
            {a.reached ? <span class="text-[13px] font-semibold text-good">{REACHED}</span> : null}
            {a.note ? <span class="text-[12px] leading-relaxed text-text-3">{a.note}</span> : null}
          </div>
        ))}
      </div>
      {!light.arrived ? <p class="m-0 text-[13px] leading-relaxed text-text-2" data-light="nothing">{NOTHING_ARRIVED}</p> : null}
      <div class="flex flex-col gap-2" data-light="ideas" data-ideas={ideas.state}>
        {ideas.state === "ideas" ? (
          <>
            <h3 class="m-0 text-[15px] font-semibold text-text">Ideas for this week</h3>
            <p class="m-0 text-[13px] leading-relaxed text-text-2">{ideas.lead}</p>
            <ul class="m-0 flex list-none flex-col p-0">
              {ideas.ideas.map((i, n) => (
                <li key={i.key} data-idea={i.key} class={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2 ${n ? "border-t border-border" : ""}`}>
                  <span class="text-[15px] text-text">{i.text}</span>
                  <span class="font-mono text-[11px] font-medium text-text-3">{i.fills}</span>
                </li>
              ))}
            </ul>
          </>
        ) : <p class="m-0 text-[15px] leading-relaxed text-text-2">{ideas.line}</p>}
      </div>
      {children}
      {onSeven || onPlan ? (
        <div class="flex flex-wrap gap-x-5 gap-y-1">
          {onSeven ? <button type="button" onClick={onSeven} class={quietLink} data-light="seven">See it as seven days</button> : null}
          {onPlan ? <button type="button" onClick={onPlan} class={quietLink} data-light="plan">See the plan behind it</button> : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The activities the ideas draw from. Closed until the person opens it: a week asks for nothing here. A tick is kept
 * at once (the horizon keeps it); the first tick makes the list the person's own, where until then it was read from
 * their sessions.
 */
export function MyActivities({ chosen, busy, onSave }: { chosen: Chosen; busy: boolean; onSave: (next: { activities: ActivityKey[]; own: string[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const on = new Set<ActivityKey>(chosen.keys);
  const toggle = (k: ActivityKey) => onSave({ activities: cleanKeys(on.has(k) ? chosen.keys.filter((x) => x !== k) : [...chosen.keys, k]), own: chosen.own });
  const drop = (s: string) => onSave({ activities: chosen.keys, own: chosen.own.filter((o) => o !== s) });
  const next = cleanOwn([...chosen.own, text]);
  const canAdd = next.length > chosen.own.length;
  const add = () => { if (!canAdd) return; setText(""); onSave({ activities: chosen.keys, own: next }); };
  const chip = (isOn: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium disabled:cursor-default disabled:opacity-60 ${isOn ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-alt text-text hover:border-accent-border"}`;
  return (
    <div class="flex flex-col gap-3 border-t border-border pt-3" data-light="activities" data-from={chosen.from}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} class={`${quietLink} self-start`}>My activities</button>
      {open ? (
        <>
          <p class="m-0 max-w-[640px] text-[13px] leading-relaxed text-text-2">{CHOSEN_LEAD}</p>
          {chosen.from === "sessions" ? <Quiet>{CHOSEN_FROM_SESSIONS}</Quiet> : null}
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="My activities">
            {ACTIVITIES.map((a) => <button type="button" key={a.key} data-activity={a.key} aria-pressed={on.has(a.key)} disabled={busy} onClick={() => toggle(a.key)} class={chip(on.has(a.key))}>{a.label}</button>)}
            {chosen.own.map((s) => <button type="button" key={s} data-activity="own" aria-pressed={true} aria-label={`${s}: take it off`} disabled={busy} onClick={() => drop(s)} class={chip(true)}>{s}<span aria-hidden="true">×</span></button>)}
          </div>
          {chosen.own.length < OWN_AT_MOST ? (
            <form class="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
              <input type="text" value={text} maxLength={OWN_LENGTH} placeholder="Add your own" aria-label="Add an activity of your own" onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
                class="min-h-10 w-full max-w-[240px] rounded-[10px] border border-border bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border" />
              <button type="submit" disabled={busy || !canAdd} class="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-border-strong px-4 text-[13px] font-semibold text-text disabled:opacity-50">Add</button>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** The sessions logged this week, and what each filled. */
export function LoggedCard({ lines }: { lines: LoggedLine[] }) {
  return (
    <section id="horizon-logged" data-light="counts" class="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-5" aria-label={COUNTS_HEAD}>
      <H2>{COUNTS_HEAD}</H2>
      {lines.length ? (
        <div class="flex flex-col">
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-text-3"><span>You logged</span><span>It filled</span></div>
          {lines.map((l, i) => (
            <div key={`${l.day}-${i}`} data-logged={l.kind} class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-baseline gap-3 border-t border-border py-2.5">
              <span class="text-[15px] text-text"><span class="mr-2 font-mono text-[11px] font-medium text-text-3">{dayShort(l.day)}</span>{l.logged}</span>
              <span class="text-[14px] leading-relaxed text-text-2">{l.filled}</span>
            </div>
          ))}
        </div>
      ) : <p class="m-0 text-[15px] leading-relaxed text-text-2">{COUNTS_NONE}</p>}
      <Quiet>{COUNTS_NOTE}</Quiet>
    </section>
  );
}
