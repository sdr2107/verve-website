/**
 * A panel for test accounts: something being tried on a few named accounts before anyone else sees it.
 *
 * Its words are not in this repository. They are a row in `programme_panels` (METTracker
 * supabase/migrations/20261116_horizon_programme.sql), which only an account in `programme_testers` can read. This
 * file draws whatever that row holds, and puts a horizon's own counts into its sentences (../horizon/facts.ts). An
 * account that is not on the list, a row that is not there and a table that is not there all draw nothing.
 *
 * The row's body, every part optional:
 *   eyebrow, title, aside, lead     the head
 *   share                           the part of calls and plan weeks the panel counts as kept (0 to 1)
 *   steps[]   {small, head, text, week}      a row of small cards; one whose `week` is this week is lit
 *   rows_head, rows[] {label, value, ok, show}   lines with a count in them; `ok` and `show` name a count
 *   verdicts  {targets, weeks, not_yet, none}    one sentence, chosen by where the horizon stands
 *   notes[]                         small print
 *   cards_head, cards[] {small, head, figure, lines[]}   boxes of figures, written as the row holds them
 *   foot                            the last line
 */
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { openTargets, pacesOf, toTarget, type Target } from "../horizon/derive.ts";
import { todayStr } from "../derive/format.ts";
import { derived, horizons, isTeam, testerState } from "../state.ts";
import { waitingWords } from "../known.ts";
import { guidePlan, isGuideStored, type GuideStored } from "../horizon/guidePlan.ts";
import { guidePlanReady, listWeekNotes, loadPanel, type HorizonFull } from "../horizon/api.ts";
import { fill, horizonFacts, type Facts } from "../horizon/facts.ts";
import type { WeekNote } from "../horizon/programme.ts";
import { listReader } from "../list/api.ts";
import { TheLetter } from "./TheLetter.tsx";
import { TheList } from "./TheList.tsx";

type Step = { small?: string; head?: string; text?: string; week?: number };
type Row = { label?: string; value?: string; ok?: string; show?: string };
type Box = { small?: string; head?: string; figure?: string; lines?: string[] };
export type PanelBody = {
  eyebrow?: string; title?: string; aside?: string; lead?: string; share?: number;
  steps?: Step[]; rows_head?: string; rows?: Row[]; verdicts?: Record<string, string>; notes?: string[];
  cards_head?: string; cards?: Box[]; foot?: string;
};
const list = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const Eyebrow = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium text-text-3">{children}</div>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;

/** The panel, drawn from a body and the counts that fill it. */
export function Panel({ body, facts, id }: { body: PanelBody; facts: Facts; id?: string }) {
  const say = (s: string | undefined) => fill(s ?? "", facts);
  const steps = list<Step>(body.steps), rows = list<Row>(body.rows).filter((r) => !r.show || facts[r.show] != null), boxes = list<Box>(body.cards), notes = list<string>(body.notes);
  const verdict = body.verdicts?.[String(facts.standing ?? "")];
  const mark = (name: string | undefined) => { const v = name ? facts[name] : undefined; return v === true ? "Yes" : v === false ? "Not yet" : name ? "·" : ""; };
  return (
    <section id={id} class="flex flex-col gap-4 rounded-[16px] border border-dashed border-accent-border bg-card p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <div class="flex flex-col gap-1">{body.eyebrow ? <Eyebrow>{say(body.eyebrow)}</Eyebrow> : null}{body.title ? <h2 class="m-0 text-[18px] font-semibold text-text">{say(body.title)}</h2> : null}</div>
        {body.aside ? <span class="font-mono text-[12px] font-medium text-text-2">{say(body.aside)}</span> : null}
      </div>
      {body.lead ? <p class="m-0 text-[14px] leading-relaxed text-text-2">{say(body.lead)}</p> : null}
      {steps.length > 0 && (
        <div class="grid grid-cols-1 gap-2 md:grid-cols-5">
          {steps.map((s, i) => (
            <div class={`flex flex-col gap-1 rounded-[12px] border p-3 ${s.week != null && s.week === facts.week ? "border-accent-border bg-accent-fill" : "border-border bg-alt"}`} key={i}>
              <span class="font-mono text-[10px] text-text-3">{say(s.small)}</span><span class="text-[14px] font-semibold text-text">{say(s.head)}</span><span class="text-[12px] leading-relaxed text-text-2">{say(s.text)}</span>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <>
          {body.rows_head ? <Eyebrow>{say(body.rows_head)}</Eyebrow> : null}
          <div class="flex flex-col">
            {rows.map((r, i) => (
              <div class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_auto] items-baseline gap-3 border-t border-border py-2.5 first:border-t-0" key={i}>
                <span class="text-[14px] text-text">{say(r.label)}</span><span class="font-mono text-[12px] text-text-2">{say(r.value)}</span>
                <span class={`text-[13px] font-semibold ${r.ok && facts[r.ok] === false ? "text-caution" : "text-text-2"}`}>{mark(r.ok)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {verdict ? <p class="m-0 rounded-[12px] border border-border-strong bg-alt px-4 py-3 text-[14px] leading-relaxed text-text">{say(verdict)}</p> : null}
      {notes.map((n, i) => <Quiet key={i}>{say(n)}</Quiet>)}
      {boxes.length > 0 && (
        <>
          {body.cards_head ? <Eyebrow>{say(body.cards_head)}</Eyebrow> : null}
          <div class={`grid grid-cols-1 gap-3 ${boxes.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {boxes.map((b, i) => (
              <div class="flex flex-col gap-1.5 rounded-[12px] border border-border bg-alt p-4" key={i}>
                {b.small ? <span class="font-mono text-[10px] text-text-3">{say(b.small)}</span> : null}
                <span class="text-[14px] font-semibold text-text">{say(b.head)}</span>
                {b.figure ? <span class="t-figure-row font-semibold text-text">{say(b.figure)}</span> : null}
                {list<string>(b.lines).map((l, j) => <span class="text-[12px] leading-relaxed text-text-2" key={j}>{say(l)}</span>)}
              </div>
            ))}
          </div>
        </>
      )}
      {body.foot ? <Quiet>{say(body.foot)}</Quiet> : null}
    </section>
  );
}

/** A panel by its key, with no counts: for a page that is not a horizon. Draws nothing until, and unless, the row is readable. */
function Keyed({ sb, panel, facts }: { sb: SupabaseClient; panel: string; facts?: Facts }) {
  const [body, setBody] = useState<PanelBody | null>(null);
  useEffect(() => { let on = true; void loadPanel(sb, panel).then((b) => { if (on) setBody(b as PanelBody | null); }); return () => { on = false; }; }, [panel]);
  return body ? <Panel body={body} facts={facts ?? {}} id={`panel-${panel}`} /> : null;
}
export function mountTesterPanel(root: HTMLElement, deps: { supabase: SupabaseClient; panel: string }): void {
  render(<Keyed sb={deps.supabase} panel={deps.panel} />, root);
}

/**
 * A horizon's counts, as a panel's sentences are filled with them: the page's own arithmetic (../horizon/facts.ts),
 * with the week's notes read once. `share` is the part a row counts as kept; `on` is false until there is a row to fill.
 */
export function useHorizonFacts(sb: SupabaseClient, a: { h: HorizonFull | null; targets: Target[]; person: PersonData | null; today: string; guideOn: boolean; share: number | undefined; on: boolean }): Facts {
  const { h, targets, person, today, guideOn, share, on } = a;
  const [notes, setNotes] = useState<WeekNote[]>([]);
  useEffect(() => {
    let live = true;
    setNotes([]);
    if (h) void listWeekNotes(sb, h.id).then((n) => { if (live) setNotes(n); });
    return () => { live = false; };
  }, [h?.id]);
  return useMemo(() => {
    if (!on || !h || !person) return {};
    const stored: GuideStored | null = guideOn && h.plan?.author === "guide" && isGuideStored(h.plan?.guide) ? (h.plan!.guide as GuideStored) : null;
    let planWeeks: { kept: number; of: number } | null = null;
    try { if (stored) { const past = guidePlan({ horizon: h, targets, person, today, stored }).climb.filter((r) => r.state === "past" && r.done); planWeeks = { kept: past.filter((r) => !r.short.length).length, of: past.length }; } } catch { planWeeks = null; }
    return horizonFacts({ h, paces: pacesOf(targets, h, person, today), targets, notes, today, planWeeks, share });
  }, [on, share, notes, targets, person, today, h?.id, guideOn]);
}

/** The panel on a horizon: the row keyed "horizon", filled with this horizon's counts. */
export function HorizonPanel({ sb, h, targets, person, today, guideOn }: { sb: SupabaseClient; h: HorizonFull; targets: Target[]; person: PersonData; today: string; guideOn: boolean }) {
  const [body, setBody] = useState<PanelBody | null>(null);
  useEffect(() => { let on = true; void loadPanel(sb, "horizon").then((b) => { if (on) setBody(b as PanelBody | null); }); return () => { on = false; }; }, [h.id]);
  const facts = useHorizonFacts(sb, { h, targets, person, today, guideOn, share: typeof body?.share === "number" ? body.share : undefined, on: !!body });
  return body ? <Panel body={body} facts={facts} id="horizon-panel" /> : null;
}

/**
 * Settings › For the team: Verve's own notes, for the named test accounts and nobody else. For the account the
 * database names as the reader of the letter's list, the list is here too and opens first (./TheList.tsx, board 29). The panel that stood in the
 * middle of a horizon lives here (the founder, 18 November 2026: it "is an internal document - we should not be
 * showing the user that after 6 weeks we plan this or that"). Its words are still rows in the database; with an open
 * horizon on the page it is filled with that horizon's counts, as it was.
 */
function TeamPage({ sb }: { sb: SupabaseClient }) {
  const tester = isTeam.value, hs = horizons.value, person = derived.value;
  const [guideOn, setGuideOn] = useState(false);
  useEffect(() => { let on = true; void guidePlanReady(sb).then((g) => { if (on) setGuideOn(g); }); return () => { on = false; }; }, []);
  // the letter's list, for an account the database names as its reader (../list/api.ts); it opens first
  const [reader, setReader] = useState(false);
  const [view, setView] = useState<"list" | "letter" | "notes">("notes");
  useEffect(() => { let on = true; if (!tester) { setReader(false); return; } void listReader(sb).then((r) => { if (on) { setReader(r); if (r) setView("list"); } }); return () => { on = false; }; }, [tester]);
  if (!tester) return <Quiet>{waitingWords(testerState.value, "This page holds notes for Verve's own test accounts. There is nothing on it for this account.")}</Quiet>;
  const h = (hs ?? []).find((x) => !x.closed_at && x.programme) ?? null;
  const tab = (key: "list" | "letter" | "notes", label: string) => (
    <button type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
      class={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${view === key ? "bg-card text-text shadow-[0_1px_0_rgba(20,20,28,0.06)]" : "text-text-2 hover:text-text"}`}>{label}</button>
  );
  // the list and the letter are the reader's alone (board 32: the letter is the third tab, beside the list)
  const tabs = <div class="flex flex-wrap gap-1 self-start rounded-full border border-border bg-alt p-1" role="tablist" aria-label="For the team">{tab("list", "The list")}{tab("letter", "The letter")}{tab("notes", "Our notes")}</div>;
  if (reader && view === "list") return <div class="flex flex-col gap-4">{tabs}<TheList sb={sb} /></div>;
  if (reader && view === "letter") return <div class="flex flex-col gap-4">{tabs}<TheLetter sb={sb} /></div>;
  return (
    <div class="flex flex-col gap-4">
      {reader ? tabs : null}
      <Quiet>Our own notes, on test accounts only. Nobody else is shown this page, and nothing on it is offered to anyone. The words are rows in the database, not in the website's code.</Quiet>
      {h && person ? <HorizonPanel sb={sb} h={h} targets={openTargets(h.targets).map(toTarget)} person={person} today={todayStr()} guideOn={guideOn} /> : <Keyed sb={sb} panel="horizon" />}
      <Keyed sb={sb} panel="plans" />
      {!h ? <Quiet>With an open horizon on the page, the first panel is filled with that horizon's own counts. Open Horizon once, then come back.</Quiet> : null}
    </div>
  );
}
export function mountTeamPage(root: HTMLElement, deps: { supabase: SupabaseClient }): void {
  render(<TeamPage sb={deps.supabase} />, root);
}
