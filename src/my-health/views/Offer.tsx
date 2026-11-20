/**
 * What goes with a horizon, shown to a test account in the three places board 25 draws (canvas "Verve, Horizon as a
 * programme"; the founder's direction of 18 November 2026: said briefly when a horizon is set, then kept under
 * Settings, with one press on the date).
 *
 *   at the set-up     a few lines above the button that keeps the horizon, said once
 *   under Settings    the same terms while the horizon runs, with no running count; on the date, one of two blocks
 *   on the horizon    a sheet shown once when the row's weeks are behind, and one line on the date
 *
 * NO WORD OF IT IS IN THIS FILE. Every sentence, amount and button name is the row keyed "offer" in
 * `programme_panels`, which only an account in `programme_testers` can read (../horizon/offer.ts says what the row
 * holds). No row, or an account not on the list: nothing is drawn, anywhere.
 *
 * NOTHING CAN BE PRESSED INTO EFFECT. There is no till, so the buttons the row names are drawn switched off, each
 * with the row's words saying why. Nothing here writes to the database.
 */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { openTargets, toTarget } from "../horizon/derive.ts";
import { todayStr } from "../derive/format.ts";
import { actions, derived, horizons, isTester, testerState } from "../state.ts";
import { waitingWords } from "../known.ts";
import { guidePlanReady, loadPanel, type HorizonFull } from "../horizon/api.ts";
import { fill, type Facts } from "../horizon/facts.ts";
import { isOfferBody, markWeekSheetSeen, offerDates, onTheDate, verdictOf, weekDue, weekSheetSeen, type OfferBody, type OfferLine } from "../horizon/offer.ts";
import { useHorizonFacts } from "./TesterPanel.tsx";
import { Sheet } from "./Sheet.tsx";

// one read of the row for as long as the page is open; a read that found nothing is asked again
let row: Promise<OfferBody | null> | null = null;
export function loadOffer(sb: SupabaseClient): Promise<OfferBody | null> {
  if (!row) {
    const mine: Promise<OfferBody | null> = loadPanel(sb, "offer").then((b) => (isOfferBody(b) ? b : null));
    row = mine;
    void mine.then((b) => { if (!b && row === mine) row = null; });
  }
  return row;
}
/** On sign-out: the next account reads for itself. */
export const forgetOffer = (): void => { row = null; };
/** The row's body; null when there is none for this account; undefined while it is being read. */
function useOffer(sb: SupabaseClient, on: boolean): OfferBody | null | undefined {
  const [body, setBody] = useState<OfferBody | null | undefined>(on ? undefined : null);
  useEffect(() => {
    let live = true;
    if (!on) { setBody(null); return; }
    setBody(undefined);
    void loadOffer(sb).then((b) => { if (live) setBody(b); });
    return () => { live = false; };
  }, [on]);
  return body;
}

const list = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const Eyebrow = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-3">{children}</div>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12.5px] leading-relaxed text-text-3">{children}</p>;
/** A button the row names, drawn switched off: there is nothing behind it yet, and the words beside it say so. */
const Off = ({ label, why }: { label: string; why?: string }) => (
  <div class="flex flex-col gap-2">
    <button type="button" disabled aria-disabled="true" class="min-h-11 cursor-not-allowed self-start rounded-full border border-border-strong bg-alt px-5 text-[14px] font-semibold text-text-3">{label}</button>
    {why ? <Quiet>{why}</Quiet> : null}
  </div>
);
const Line = ({ l, say }: { l: OfferLine; say: (s?: string) => string }) => (
  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-t border-border py-3.5 first:border-t-0 first:pt-0">
    <div class="flex flex-col gap-1">
      <span class="text-[15px] font-semibold text-text">{say(l.head)}</span>
      {l.text ? <span class="text-[13.5px] leading-relaxed text-text-2">{say(l.text)}</span> : null}
    </div>
    {l.tag ? <span class="rounded-full border border-border-strong px-2.5 py-1 font-mono text-[10.5px] font-medium text-text-2">{say(l.tag)}</span> : null}
  </div>
);
/** The terms as the row holds them: its lines, then how it is decided. */
function Terms({ body, say, lines }: { body: OfferBody; say: (s?: string) => string; lines: OfferLine[] }) {
  const how = list<string>(body.page?.how);
  return (
    <>
      {lines.length > 0 && <div class="flex flex-col">{lines.map((l, i) => <Line l={l} say={say} key={i} />)}</div>}
      {how.length > 0 && (
        <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-alt px-4 py-3.5">
          {body.page?.how_head ? <Eyebrow>{say(body.page.how_head)}</Eyebrow> : null}
          <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
            {how.map((t, i) => <li class="relative pl-4 text-[13.5px] leading-relaxed text-text-2 before:absolute before:left-0 before:top-[0.62em] before:h-1 before:w-1 before:rounded-full before:bg-text-3" key={i}>{say(t)}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}
/** The row's lines for the time before the week's sheet is due, with the line that says it is coming. */
const linesOf = (body: OfferBody, due: boolean): OfferLine[] => [...list<OfferLine>(body.page?.rows), ...(!due && body.week?.waiting ? [body.week.waiting] : [])];

// ── at the set-up ──────────────────────────────────────────────────────────────
/** Above the button that keeps a horizon: the row's few lines, and the terms in a sheet for whoever wants them now. */
export function OfferAtSetup({ sb, startsOn, endsOn }: { sb: SupabaseClient; startsOn: string; endsOn: string | null }) {
  const body = useOffer(sb, true);
  const [open, setOpen] = useState(false);
  const s = body?.setup, lines = list<string>(s?.lines);
  if (!body || !s || !lines.length || !endsOn || endsOn <= startsOn) return null;
  const facts = offerDates({ starts_on: startsOn, ends_on: endsOn }, startsOn, body.months);
  const say = (t?: string) => fill(t ?? "", facts);
  return (
    <section class="flex flex-col gap-2 rounded-[14px] border border-border bg-card px-5 py-4" id="setup-offer">
      {s.head ? <Eyebrow>{say(s.head)}</Eyebrow> : null}
      {lines.map((l, i) => <p class={`m-0 text-[14px] leading-relaxed ${i === 0 ? "text-text" : "text-text-2"}`} key={i}>{say(l)}</p>)}
      {s.link && body.page ? <button type="button" onClick={() => setOpen(true)} class="min-h-9 self-start text-[13px] font-semibold text-accent-text hover:text-text">{say(s.link)}</button> : null}
      {open ? (
        <Sheet title={say(s.head ?? s.link)} onClose={() => setOpen(false)}>
          {body.page?.lead ? <p class="m-0 text-[14px] leading-relaxed text-text-2">{say(body.page.lead)}</p> : null}
          <Terms body={body} say={say} lines={linesOf(body, false)} />
        </Sheet>
      ) : null}
    </section>
  );
}

// ── under Settings ─────────────────────────────────────────────────────────────
/** The horizon the page speaks of: the open one set up as a programme, else the last such one that ran to its date. */
function horizonFor(hs: HorizonFull[] | null, today: string): HorizonFull | null {
  const mine = (hs ?? []).filter((x) => !!x.programme);
  return mine.find((x) => !x.closed_at)
    ?? [...mine].filter((x) => x.ends_on <= today && x.checkins.some((c) => c.kind === "final")).sort((a, b) => (a.ends_on < b.ends_on ? 1 : -1))[0]
    ?? null;
}
function OfferPage({ sb }: { sb: SupabaseClient }) {
  const tester = isTester.value, hs = horizons.value, person = derived.value;
  const body = useOffer(sb, tester);
  const [guideOn, setGuideOn] = useState(false);
  useEffect(() => { let on = true; void guidePlanReady(sb).then((g) => { if (on) setGuideOn(g); }); return () => { on = false; }; }, []);
  const today = todayStr();
  const h = horizonFor(hs, today);
  const targets = h ? openTargets(h.targets).map(toTarget) : [];
  const counts = useHorizonFacts(sb, { h, targets, person, today, guideOn, share: typeof body?.share === "number" ? body.share : undefined, on: !!body && !!h });
  // "Checking" while the account or the row is still being read: the page used to say "nothing" for those seconds
  if (!tester) return <Quiet>{waitingWords(testerState.value, "There is nothing on this page for this account.")}</Quiet>;
  if (body === undefined) return <Quiet>{waitingWords("asking", "")}</Quiet>;
  if (!body) return <Quiet>There is nothing on this page for this account.</Quiet>;
  if (!h) return body.page?.none ? <p class="m-0 text-[14px] leading-relaxed text-text-2">{body.page.none}</p> : <Quiet>With a horizon set, this page says what goes with it.</Quiet>;
  const facts: Facts = { ...counts, ...offerDates(h, today, body.months) };
  const say = (t?: string) => fill(t ?? "", facts);
  const due = weekDue(h, today, body.week?.after), dated = onTheDate(h, today);
  // a coach's calls are part of the count only where a coach is part of the horizon
  const verdict = dated ? verdictOf(counts, { calls: h.plan?.author === "coach" }) : null;
  const yes = body.date?.reached, no = body.date?.not, w = body.week;
  return (
    <div class="flex flex-col gap-5" id="offer-page">
      {body.page?.lead ? <p class="m-0 max-w-[62ch] text-[14.5px] leading-relaxed text-text-2">{say(body.page.lead)}</p> : null}
      {verdict === "reached" && yes ? (
        <section class="flex flex-col gap-4 rounded-[14px] border border-accent-border bg-accent-fill p-5" id="offer-date">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex max-w-[52ch] flex-col gap-1.5">
              <h3 class="m-0 text-[18px] font-semibold leading-snug text-text">{say(yes.head)}</h3>
              {yes.text ? <p class="m-0 text-[13.5px] leading-relaxed text-text-2">{say(counts.targets_ok !== true && yes.text_weeks ? yes.text_weeks : yes.text)}</p> : null}
            </div>
            {yes.figure ? <div class="flex flex-col items-end gap-0.5"><span class="t-figure leading-none text-text">{say(yes.figure)}</span>{yes.small ? <span class="text-[12px] text-text-3">{say(yes.small)}</span> : null}</div> : null}
          </div>
          {yes.button ? <Off label={say(yes.button)} why={say(yes.off)} /> : null}
          {yes.sums ? <p class="m-0 text-[13.5px] leading-relaxed text-text-2">{say(yes.sums)}</p> : null}
        </section>
      ) : verdict === "not" && no ? (
        <section class="flex flex-col gap-1.5 rounded-[14px] border border-border-strong bg-alt p-5" id="offer-date">
          <h3 class="m-0 text-[17px] font-semibold leading-snug text-text">{say(no.head)}</h3>
          {no.text ? <p class="m-0 text-[13.5px] leading-relaxed text-text-2">{say(no.text)}</p> : null}
        </section>
      ) : null}
      {due && w && (w.title || w.text) ? (
        <section class="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5" id="offer-week">
          {w.kicker ? <Eyebrow>{say(w.kicker)}</Eyebrow> : null}
          {w.title ? <h3 class="m-0 text-[17px] font-semibold leading-snug text-text">{say(w.title)}</h3> : null}
          {w.text ? <p class="m-0 text-[13.5px] leading-relaxed text-text-2">{say(w.text)}</p> : null}
          {w.yes ? <Off label={say(w.yes)} why={say(w.off)} /> : null}
        </section>
      ) : null}
      <Terms body={body} say={say} lines={linesOf(body, due || dated)} />
      {body.page?.foot ? <Quiet>{say(body.page.foot)}</Quiet> : null}
    </div>
  );
}
export function mountOfferPage(root: HTMLElement, deps: { supabase: SupabaseClient }): void {
  render(<OfferPage sb={deps.supabase} />, root);
}

// ── on the horizon ─────────────────────────────────────────────────────────────
/**
 * On a horizon's first page, for its owner on a test account: the sheet the row's weeks call for, shown once, and one
 * line once the date has come. Neither says how the horizon stands: that is Settings' to say, and only on the date.
 */
export function OfferOnHorizon({ sb, h, today }: { sb: SupabaseClient; h: HorizonFull; today: string }) {
  const body = useOffer(sb, true);
  const [shut, setShut] = useState(false);
  useEffect(() => { setShut(false); }, [h.id]);
  if (!body || !h.programme) return null;
  const facts = offerDates(h, today, body.months);
  const say = (t?: string) => fill(t ?? "", facts);
  const w = body.week, d = body.date;
  const sheet = !!w && !!w.title && !h.closed_at && weekDue(h, today, w.after) && !shut && !weekSheetSeen(h.id);
  const close = () => { markWeekSheetSeen(h.id); setShut(true); };
  return (
    <>
      {onTheDate(h, today) && d?.line ? (
        <section class="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-5 py-3.5" id="horizon-offer-line">
          <span class="text-[14px] leading-relaxed text-text">{say(d.line)}</span>
          {d.go ? <button type="button" onClick={() => actions.goSettings("offer")} class="min-h-9 text-[13px] font-semibold text-accent-text hover:text-text">{say(d.go)}</button> : null}
        </section>
      ) : null}
      {sheet && w ? (
        <Sheet title={say(w.title)} kicker={say(w.kicker)} onClose={close}>
          {w.text ? <p class="m-0 text-[14px] leading-relaxed text-text-2">{say(w.text)}</p> : null}
          <div class="flex flex-wrap items-center gap-3">
            {w.yes ? <Off label={say(w.yes)} /> : null}
            {w.no ? <button type="button" onClick={close} class="min-h-11 rounded-full border border-border-strong px-5 text-[14px] font-semibold text-text hover:border-accent-border">{say(w.no)}</button> : null}
          </div>
          {w.yes && w.off ? <Quiet>{say(w.off)}</Quiet> : null}
          {w.foot ? <Quiet>{say(w.foot)}</Quiet> : null}
        </Sheet>
      ) : null}
    </>
  );
}
