/**
 * Horizon (Pro on the website): a date, the markers you want different by
 * then, the week that gets you there, and the Guide's check-ins. One mount,
 * `mountHorizon(root, deps)`, draws the horizon in view (canvas board 14),
 * the four-step set-up (board 15), or, for a horizon whose date has come,
 * the read of the whole road with the next horizon prefilled beneath it
 * (canvas "What brings people back", board 06). The arithmetic is ../horizon/derive;
 * the rows and the writer are ../horizon/api. A coach sees everything
 * read-only except the plan, which is theirs to write.
 *
 * Where am I going? (canvas "Verve, one story in four parts", board 06,
 * 11 Nov 2026): the page states what the person wants first and today
 * second, and a line the Guide wrote can arrive as a draft: not a target
 * until the person sets its number. The horizons it reads are published on a
 * signal for the Overview's cards, In depth's line of time and the Guide's doors.
 *
 * Pace is arithmetic on the person's own readings; nothing here recommends
 * a number. The plan is intent for a week, not a session for each day; what
 * the week did comes from the sessions and the nights, never a tick box.
 *
 * The Guide's plan (canvas "Verve, the Guide's plan", 13 Nov 2026): for a
 * person with no coach the Guide writes the week and its weekly step from
 * their targets, after three questions, and a chat answers questions about
 * it (./GuidePlan.tsx, ../horizon/guidePlan.ts). That is guidance on
 * exercise: the one place the Guide advises. The check-ins still describe.
 * A Free account has one week of Horizon with the plan and one question;
 * after that the plan, the check-ins and the chat are Pro (the function
 * decides; ../horizon/api.ts HorizonAccess).
 */
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { addDays, daysBetween, mondayOf, todayStr } from "../derive/format.ts";
import { actsByDay } from "../derive/activity.ts";
// figuresAsOf, not asOfLine: View has a helper of that name for a check-in's own line, and a second one in the
// same function is read before it exists (the page stopped drawing, 25 to 26 November 2026)
import { asOfLine as figuresAsOf, lastAppSync } from "../derive/asOf.ts";
import { horizons as horizonsSignal, guideDraft, setGuideDraft, isTester, isTeam, testerState, doc as docSignal, accountTester, accountTeam, horizonDoor, seenAs } from "../state.ts";
import { HORIZON_PUBLIC } from "../../data/story.ts";
import { HORIZON_KEPT, maySetHorizon } from "../horizon/access.ts";
import { continuityLine } from "../horizon/founding.ts";
import { seenAccess } from "../horizon/preview.ts";
import { planDoor } from "../../data/plan-door.ts";
import { planInfoSignal } from "./Settings.tsx";
import { chartSharedWith } from "../horizon/chart.ts";
import { arrivalsOf, followable, leftOff, pausedWords } from "../derive/arrivals.ts";
import {
  TARGET_MARKERS, isTargetable, openTargets, MARKER_BY_KEY, GROUP_LABEL, FIRST_MARKERS, type MarkerKey, type PlanRow, type PlanKind, type Tone,
  latestOf, historyOf, weeklyHistory, pacesOf, impliedPace, adherenceOf, guideDraftPlan, roadOf, weekOf, daysToGo, nextCheckins, checkinInputs, checkinLinesOf, landedLine,
  outcomesOf, lastRoadWords, nextSpan, horizonMondays, toTarget, typicalOf, targetKeyOf, vo2Line, ML_PER_MET, type MarkerDef, type Reading,
  fmtValue, addMonths, longDate, dayMonth, dayMonthLong, dayMonthYear, weekdayDayMonth, clockOf, round, numberWord,
  horizonSpans, spanOf, daysWords, weeksWords, weekWords, fitnessBy, pausedWeeksWords, PAUSED_WORD, type Pace,
} from "../horizon/derive.ts";
import { movedWords, pauseState, pauseWhyWords, type PauseChoice, type PauseKey, type PauseState, type PauseWhy } from "../horizon/pause.ts";
import {
  listHorizons, startHorizon, requestCheckin, grantConsent, savePlan, updateHorizon, deleteHorizon, pauseHorizon, addTarget, removeTarget, updateTarget, saveGuidePlan, ERROR_WORDS,
  fetchAccess, rememberedAccess, guidePlanReady, testerAnswer, teamAnswer, loadDayName, watchedReady, listWatched, saveProgramme,
  type HorizonFull, type PlanAuthor, type StartTarget, type ApiError, type HorizonAccess,
} from "../horizon/api.ts";
import { midweekOf, planRowsNow } from "../horizon/midweek.ts";
import { chosenOf, ideasFor, lightWeekOf, loggedLines } from "../horizon/lightWeek.ts";
import { LightWeekCard, LoggedCard, MyActivities } from "./LightWeek.tsx";
import type { ActivityKey } from "../../data/activities.ts";
import { dayKindOf } from "../horizon/programme.ts";
import type { EntryKey } from "../../data/programme.ts";
import { MidweekCard, ChartCard, chartSoFar, chartLastWeek, loadChartState, type ChartState } from "./Beside.tsx";
import { openFitnessCard } from "./FitnessEntry.tsx";
import { guidePlan, freezeOf, isGuideStored, PLAN_MARKERS, type GuideStored } from "../horizon/guidePlan.ts";
import { GuidePlanCard, GuideOffer, GuideLocked } from "./GuidePlan.tsx";
import { ProgrammeSetup, ProgrammeLine, WeightCard, CallCard, holdNotes, parseProgramme } from "./Programme.tsx";
import { WatchedCard } from "./Watched.tsx";
import { OfferOnHorizon } from "./Offer.tsx";
import { WhereLine } from "./Doors.tsx";
import { doorsFor, storeOf, type Who } from "../horizon/doors.ts";
import type { WatchedRow } from "../horizon/watch.ts";
import { cardOfRoute, routeOfCard } from "../horizon/setupCards.ts";
import { HORIZON_PAGES, horizonRoute, routeOfPage, type HorizonPage } from "../horizon/pages.ts";

export type HorizonDeps = {
  supabase: SupabaseClient;
  /** The person whose page is open; null before the page knows. */
  personId: () => string | null;
  /** The signed-in account; used for updated_by on the plan and for consent. Falls back to the session when absent. */
  userId?: () => string | null;
  derived: () => PersonData | null;
  isOwner: () => boolean;
  /** The page open is the signed-in person's own, not one they look after: only then is their own profile read for the plan's Intensity card. */
  isSelf?: () => boolean;
  goTab: (t: string) => void;
  /** The open horizons and the ones read to their date ("done"), for the sidebar's sub-links; called after every load. */
  onHorizons?: (list: { id: string; title: string; ends_on: string; done?: boolean }[]) => void;
  /** The backend is not in place for this project yet (tables missing, or the function answers 404): the page says so and the sidebar dims the door. */
  onOff?: (off: boolean) => void;
};
export type HorizonHandle = { refresh: () => void; open: (hash: string) => void };

/** The route inside the pane: "" (the first open horizon), an id, or "new"; "new-4" is the fourth card of the programme's set-up (../horizon/setupCards.ts). */
const route = signal<string>("");
const tick = signal(0);

export function mountHorizon(root: HTMLElement, deps: HorizonDeps): HorizonHandle {
  render(<HorizonApp deps={deps} />, root);
  return {
    refresh: () => { tick.value++; },
    open: (hash: string) => { const h = hash.replace(/^#/, ""); route.value = h === "horizon" ? "" : h.replace(/^horizon-/, ""); },
  };
}

/** The browser's IANA zone, so the function reads Monday and the month's first where the person is. */
const browserZone = (): string | null => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };

// ── small parts ──

const TONE_TEXT: Record<Tone, string> = { good: "text-good", caution: "text-caution", neutral: "text-text-3" };
const Eyebrow = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium text-text-3">{children}</div>;
const H2 = ({ children }: { children: any }) => <h2 class="m-0 text-[18px] font-semibold text-text">{children}</h2>;
const Card = ({ children, id }: { children: any; id?: string }) => <section id={id} class="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5">{children}</section>;
const Button = ({ children, onClick, primary, disabled, type = "button" }: { children: any; onClick?: () => void; primary?: boolean; disabled?: boolean; type?: "button" | "submit" }) => (
  <button type={type} disabled={disabled} onClick={onClick} class={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-50 ${primary ? "bg-accent text-canvas" : "border border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;
/**
 * A check-in's words. A Monday check-in kept as short lines (from 16 November 2026) is a list, one line to a job,
 * its head in bold; anything older, a month's read and the whole road are the paragraph they were written as.
 */
function CheckinText({ text, small }: { text: string; small?: boolean }) {
  const lines = checkinLinesOf(text);
  const type = small ? "leading-relaxed" : "text-[16px] leading-[1.65] text-text";
  if (!lines) return <p class={`m-0 max-w-[640px] whitespace-pre-line ${small ? "mt-1 " : ""}${type}`}>{text}</p>;
  return (
    <ul class={`m-0 flex max-w-[640px] list-none flex-col p-0 ${small ? "mt-1 gap-1" : "gap-2"}`}>
      {lines.map((l) => (
        <li class={`flex gap-2.5 ${type}`} key={l.head}>
          <span aria-hidden="true" class="text-text-3">•</span>
          <span><span class="font-semibold text-text">{l.head}:</span> {l.text}</span>
        </li>
      ))}
    </ul>
  );
}
const inputClass = "min-h-10 rounded-[10px] border border-border bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border";

function ProCard({ goTab }: { goTab: (t: string) => void }) {
  // Horizon is not sold while it is not offered to everyone (data/story.ts HORIZON_PUBLIC): no price, no button. A person
  // who meets this card keeps a horizon they set before, and reads that it stays.
  if (!HORIZON_PUBLIC) return <Card><p class="m-0 max-w-[640px] text-[15px] leading-relaxed text-text-2" data-horizon-kept>{HORIZON_KEPT}</p></Card>;
  const plans = planDoor("See the plans", false);
  return (
    <Card>
      <Eyebrow>Pro</Eyebrow>
      <div class="text-[18px] font-semibold text-text">Horizon is part of Pro on the website.</div>
      <p class="m-0 text-[15px] leading-relaxed text-text-2">A horizon is a date, the markers you want different by then, and the week that gets you there. Free has one week of it, on the first horizon you set, and keeps the Overview, Body, Reports and the Guide's first read. A horizon can be deleted any time; the readings stay.</p>
      <div class="flex flex-wrap gap-2">
        {plans ? <a href={plans.href} class="inline-flex min-h-10 items-center rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-canvas">{plans.label}</a> : null}
        <button type="button" onClick={() => goTab("overview")} class="min-h-10 px-3 text-[13px] font-semibold text-text-2 hover:text-text">Not now</button>
      </div>
    </Card>
  );
}

/** The backend is not in place yet: the door and its words, not an error and not the Pro card. */
function OffCard() {
  return (
    <Card>
      <Eyebrow>Horizon · Pro</Eyebrow>
      <div class="text-[18px] font-semibold text-text">A date, the markers you want different by then, and the week that gets you there.</div>
      <p class="m-0 text-[15px] leading-relaxed text-text-2">The Guide checks the pace every Monday and reads the month at its end; a coach sees all of it and writes the plan. Any of the site's markers or the Body list can be a target: Verve does not set the number, it tells you the pace it implies.</p>
      <Quiet>Horizon is not switched on for this account yet.</Quiet>
    </Card>
  );
}

function ConsentBox({ onAgree, busy }: { onAgree: () => void; busy: boolean }) {
  const [ticked, setTicked] = useState(false);
  return (
    <div class="flex flex-col gap-3 rounded-[10px] border border-accent-border bg-accent-fill p-4">
      <label class="flex items-start gap-3 text-[13px] leading-relaxed text-text-2">
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked((e.currentTarget as HTMLInputElement).checked)} class="mt-1" />
        <span>The Guide's writer receives the figures on this page: the targets, where each stands, the week's counts and the plan's rows. It receives no name, no note and no message. Its words come back here and, if you chose it, to your coach. A question you ask about the plan is sent as you typed it.</span>
      </label>
      <div><Button primary disabled={!ticked || busy} onClick={onAgree}>{busy ? "Recording…" : "Agree and continue"}</Button></div>
    </div>
  );
}

/** The track: the filled part is how far the marker has come; the tick is where today sits on the line to the date. */
function Track({ progress, elapsed, tone }: { progress: number; elapsed: number; tone: Tone }) {
  const fill = tone === "good" ? "bg-good" : tone === "caution" ? "bg-caution" : "bg-text-4";
  return (
    <div class="relative h-1.5 w-full rounded-full bg-alt" aria-hidden="true">
      <div class={`absolute left-0 top-0 h-full rounded-full ${fill}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      <div class="absolute top-[-3px] h-3 w-px bg-text-2" style={{ left: `${Math.round(elapsed * 100)}%` }} />
    </div>
  );
}

const shortTitle = (t: string) => t.split(",")[0].split(" ").slice(0, 2).join(" ");
/**
 * Where a marker stands, beside the number being set. A weekly marker's reading is last week alone, which can be a
 * low or a high one, so it is named as last week and a typical week of the last eight sits beside it (board 10).
 */
function standsWords(def: MarkerDef, now: Reading | null, typical: number | null): string {
  if (!now) return typical != null ? ` · a typical week ${fmtValue(def, typical)}` : " · no reading yet";
  const fig = now.display ?? fmtValue(def, now.value);
  if (def.kind === "weekly") return ` · last week ${fig}${typical != null ? ` · a typical week ${fmtValue(def, typical)}` : ""}`;
  return def.kind === "blood" ? ` · ${fig} on ${dayMonthLong(now.on)}` : ` · today ${fig}`;
}
/** Read to its date: closed, with the read of the whole road on file. A horizon stopped before 17 November 2026 (when "Stop" became "Delete") has no such read and is not listed. */
const isDone = (h: HorizonFull) => !!h.closed_at && h.checkins.some((c) => c.kind === "final");
/** The horizons read to their date, newest first; the sidebar and the chips keep the last three. */
const doneOf = (list: HorizonFull[]) => list.filter(isDone).sort((a, b) => b.ends_on.localeCompare(a.ends_on)).slice(0, 3);

// ── the plan's rows, editable ──

const PLAN_KINDS: { kind: PlanKind; label: string; n: "count" | "minutes" | "time" | "steps" | null; words: (n: number) => string }[] = [
  { kind: "sessions_week", label: "Sessions a week", n: "count", words: (n) => `${cap(numberWord(n))} session${n === 1 ? "" : "s"} a week` },
  { kind: "long_session", label: "One long session", n: "minutes", words: (n) => `One session of ${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")} or more` },
  { kind: "strength_week", label: "Strength a week", n: "count", words: (n) => `Strength ${n === 1 ? "once" : n === 2 ? "twice" : `${numberWord(n)} times`} a week` },
  { kind: "zone2_most", label: "Most minutes in zone 2", n: null, words: () => "Most minutes in zone 2" },
  { kind: "zone2_min", label: "Minutes in zone 2 a week", n: "minutes", words: (n) => `${n} minutes in zone 2` },
  { kind: "harder_min", label: "Harder minutes a week", n: "minutes", words: (n) => `${n} harder minutes` },
  { kind: "steps_day", label: "Steps a day", n: "steps", words: (n) => `${Math.round(n).toLocaleString("en-GB")} steps a day` },
  { kind: "bedtime_by", label: "In bed by", n: "time", words: (n) => `In bed by ${clockOf(n)}` },
  { kind: "weigh_in", label: "Weigh in on Monday mornings", n: null, words: () => "Weigh in on Monday mornings" },
  { kind: "custom", label: "Your own line", n: null, words: () => "" },
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function PlanEditor({ rows: initial, onSave, onCancel, busy }: { rows: PlanRow[]; onSave: (rows: PlanRow[]) => void; onCancel: () => void; busy: boolean }) {
  const [rows, setRows] = useState<PlanRow[]>(initial.length ? initial : [{ kind: "sessions_week", label: "Three sessions a week", n: 3 }]);
  const set = (i: number, patch: Partial<PlanRow>) => setRows((rs) => rs.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, ...patch };
    const def = PLAN_KINDS.find((k) => k.kind === next.kind) ?? PLAN_KINDS[PLAN_KINDS.length - 1];
    if (next.kind !== "custom") next.label = def.words(next.n ?? 0);
    return next;
  }));
  return (
    <div class="flex flex-col gap-3">
      {rows.map((r, i) => {
        const def = PLAN_KINDS.find((k) => k.kind === r.kind) ?? PLAN_KINDS[PLAN_KINDS.length - 1];
        return (
          <div class="flex flex-wrap items-center gap-2" key={i}>
            <select value={r.kind} onChange={(e) => { const kind = (e.currentTarget as HTMLSelectElement).value as PlanKind; const d = PLAN_KINDS.find((k) => k.kind === kind)!; const first = d.n === "count" ? 3 : d.n === "minutes" ? 90 : d.n === "time" ? 1410 : d.n === "steps" ? 7000 : null; set(i, { kind, n: first, label: kind === "custom" ? "" : d.words(first ?? 0) }); }} class={`${inputClass} text-[13px]`}>
              {PLAN_KINDS.map((k) => <option value={k.kind}>{k.label}</option>)}
            </select>
            {def.n === "count" && <input type="number" min={1} max={14} value={r.n ?? 1} onInput={(e) => set(i, { n: Number((e.currentTarget as HTMLInputElement).value) || 1 })} class={`${inputClass} w-20 font-mono`} aria-label="How many" />}
            {def.n === "minutes" && <input type="number" min={15} max={600} step={5} value={r.n ?? 90} onInput={(e) => set(i, { n: Number((e.currentTarget as HTMLInputElement).value) || 90 })} class={`${inputClass} w-24 font-mono`} aria-label="Minutes" />}
            {def.n === "steps" && <input type="number" min={1000} max={40000} step={100} value={r.n ?? 7000} onInput={(e) => set(i, { n: Number((e.currentTarget as HTMLInputElement).value) || 7000 })} class={`${inputClass} w-28 font-mono`} aria-label="Steps a day" />}
            {def.n === "time" && <input type="time" value={clockOf(r.n ?? 1410)} onInput={(e) => { const [h, m] = (e.currentTarget as HTMLInputElement).value.split(":").map(Number); set(i, { n: (h || 0) * 60 + (m || 0) }); }} class={`${inputClass} font-mono`} aria-label="Bedtime" />}
            {r.kind === "custom" && <input type="text" value={r.label} maxLength={80} placeholder="Your own line" onInput={(e) => set(i, { label: (e.currentTarget as HTMLInputElement).value })} class={`${inputClass} flex-1`} />}
            {r.kind !== "custom" && <span class="text-[13px] text-text-2">{r.label}</span>}
            <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} class="ml-auto text-[12px] text-text-3 hover:text-text">Remove</button>
          </div>
        );
      })}
      <div class="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRows((rs) => [...rs, { kind: "custom", label: "", n: null }])} class="rounded-full border border-border px-3 py-1 text-[12px] text-text-2 hover:border-accent-border">Add a line</button>
        <span class="flex-1" />
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary disabled={busy || rows.some((r) => !r.label.trim())} onClick={() => onSave(rows.filter((r) => r.label.trim()))}>{busy ? "Saving…" : "Save the plan"}</Button>
      </div>
    </div>
  );
}

// ── the app ──

function HorizonApp({ deps }: { deps: HorizonDeps }) {
  const _tick = tick.value;
  const r = route.value;
  const today = todayStr();
  const personId = deps.personId();
  const owner = deps.isOwner();
  const person = deps.derived();
  const [list, setList] = useState<HorizonFull[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [off, setOff] = useState(false);
  const [pro, setPro] = useState<"unknown" | "yes" | "no">("unknown");
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState<null | (() => void)>(null);
  const [busy, setBusy] = useState("");
  // what the account may do (Pro, or the one free week), and whether the Guide's plan can be kept for this project
  // the page opens on the function's last answer for this tab, and asks again behind it (api.ts rememberedAccess)
  const [accessReal, setAccess] = useState<HorizonAccess | null>(() => rememberedAccess());
  // one of the team's accounts shown the site as a founding member reads what that person would (../horizon/preview.ts)
  const access = seenAccess(accessReal, seenAs.value);
  const [guideOn, setGuideOn] = useState(false);
  // Horizon as a programme is built for test accounts only (api.ts programmeTester); "My own targets" opens the set-up as it was
  const [tester, setTester] = useState(() => isTester.value);
  const [ownTargets, setOwnTargets] = useState(false);
  // watched markers can be kept for this project (board 19; api.ts watchedReady)
  const [watchOn, setWatchOn] = useState(false);

  const userId = async () => deps.userId?.() ?? (await deps.supabase.auth.getSession()).data.session?.user.id ?? null;

  // the person whose horizons the list holds: a page opened for someone else shows the placeholder until theirs are
  // read. Before this the list stood empty while it was being read, and the old set-up was drawn for some seconds
  // before the cards replaced it (the founder's recording, 18 November 2026).
  const loadedFor = useRef<string | null>(null);
  async function load() {
    if (!personId) { loadedFor.current = null; setList(null); horizonsSignal.value = []; return; }
    // another person's page: nothing of the last person's is left on the signal while theirs is read, so no door, card or
    // line of this page is drawn from someone else's horizons for those seconds
    if (loadedFor.current !== personId) { setList(null); if (loadedFor.current != null) horizonsSignal.value = null; }
    try {
      // the closed ones come too: a horizon read to its date stays reachable, with the next one prefilled under it.
      // The two things that decide which page is drawn (the test list, the Guide's plan) are asked beside the horizons
      // and set with them, so the page is drawn once. They used to arrive a moment later, and the page drew itself
      // twice: the plain set-up, then the programme's; the horizon, then its cards (the founder, 17 November 2026).
      const uid = (await userId()) ?? undefined;
      const [hs, asked, guide, watch, askedTeam] = await Promise.all([listHorizons(deps.supabase, personId, true), testerAnswer(deps.supabase, uid), guidePlanReady(deps.supabase), watchedReady(deps.supabase), teamAnswer(deps.supabase, uid)]);
      // an answer sets the account's own flags; "could not be asked" leaves what the page already knows (the last visit's
      // answer). The page is drawn from isTester and isTeam, which are those flags, or the previewed person's while one of
      // the team's accounts is shown the site as a founding member (state.ts).
      if (askedTeam != null) accountTeam.value = askedTeam;
      if (asked != null) { accountTester.value = asked; testerState.value = "known"; }
      // a marker watched with no number is the team's alone (the database refuses anyone else): a founding member is not offered it
      setTester(isTester.value); setGuideOn(guide); setWatchOn(watch && isTeam.value);
      loadedFor.current = personId;
      setList(hs); horizonsSignal.value = hs; setLoadError(""); setOff(false); deps.onOff?.(false);
      if (hs.length) setPro("yes");
      deps.onHorizons?.([...hs.filter((h) => !h.closed_at), ...doneOf(hs)].map((h) => ({ id: h.id, title: h.title, ends_on: h.ends_on, done: !!h.closed_at })));
    } catch (e: any) {
      if (e?.name === "HorizonOff") { horizonsSignal.value = []; loadedFor.current = personId; setOff(true); setList([]); setLoadError(""); deps.onOff?.(true); deps.onHorizons?.([]); return; }
      // a read that failed says nothing new: what the page already knew of this person's horizons stands, and with it
      // the door to them (state.ts horizonDoor). Only a person nothing is known of yet reads as having none.
      if (horizonsSignal.value == null) horizonsSignal.value = [];
      loadedFor.current = personId;
      setLoadError(e?.message ?? "Could not read the horizons."); setList([]);
    }
  }
  useEffect(() => { void load(); }, [personId, _tick]);
  // Back and Forward: the address is put on the pane here too. The page does it for "#horizon-<something>" and leaves
  // "#horizon" alone, which would keep a card of the set-up on screen after the browser had stepped back off it.
  useEffect(() => {
    const on = () => {
      const h = location.hash.replace(/^#/, "");
      if (h !== "horizon" && !h.startsWith("horizon-")) return;
      route.value = h === "horizon" ? "" : h.slice("horizon-".length);
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  /**
   * Open a card of the set-up as a step in the browser's history, so the browser's own Back returns to the card it
   * came from and never leaves the page (board 18). The card's own Back button opens the card before the same way,
   * as a new step: it never asks the browser to step back, because the entry behind is not always the card before
   * (a card opened from the rail, or by its address), and a step back too far would leave the set-up.
   */
  const goCard = (n: number) => {
    const to = routeOfCard(n);
    history.pushState(null, "", `#horizon-${to}`);
    route.value = to;
  };
  useEffect(() => {
    let on = true;
    void fetchAccess(deps.supabase).then((a) => { if (on) setAccess(a); });
    return () => { on = false; };
  }, [personId, _tick]);

  /** What a failed write means for the page; returns true when it was handled by a card rather than a line. */
  function onApiError(error: ApiError, retry: () => void): boolean {
    if (error === "not_switched_on") { setOff(true); deps.onOff?.(true); return true; }
    if (error === "pro_required") { setPro("no"); return true; }
    if (error === "consent_required") { setConsent(() => retry); return true; }
    setNotice(ERROR_WORDS[error]);
    return false;
  }
  async function agreeConsent() {
    const uid = await userId();
    if (!uid) { setNotice("Sign in again to continue."); return; }
    setBusy("consent");
    const err = await grantConsent(deps.supabase, uid);
    setBusy("");
    if (err) { setNotice(`Could not record your consent: ${err}`); return; }
    const retry = consent; setConsent(null); retry?.();
  }

  if (!personId) return <Quiet>Choose a person first.</Quiet>;
  if (list == null) return <div class="h-40 rounded-[16px] border border-border bg-card" aria-busy="true" />;
  if (off) return <OffCard />;
  // Horizon is drawn for an account that has it (state.ts horizonDoor): the page shows no tab to anyone else, and this
  // pane holds nothing for them either
  if (!horizonDoor.value) return null;
  if (pro === "no") return <ProCard goTab={deps.goTab} />;
  // a new horizon is offered only where the function would start one (../horizon/access.ts maySetHorizon)
  const canSet = maySetHorizon({ open: HORIZON_PUBLIC, programme: tester, owner });
  // a founding member's last week: the one sentence, above whatever the pane shows (../horizon/founding.ts)
  const planNow = planInfoSignal.value;
  const lastWeek = owner ? continuityLine({ through: planNow?.through, until: planNow?.until, today }) : null;

  const open = list.filter((h) => !h.closed_at);
  const done = doneOf(list);
  // no open horizon: the last one read to its date is the page, with the next one prefilled beneath it
  // the set-up's own routes: "new", and "new-4" for its fourth card
  const setupCard = cardOfRoute(r);
  const at = horizonRoute(r);
  const current = r && !setupCard ? list.find((h) => h.id === at.id) ?? null : open[0] ?? done[0] ?? null;
  /** Open one of a horizon's pages as a step in the browser's history. */
  const goPage = (id: string, pg: HorizonPage) => {
    const to = routeOfPage(id, pg);
    history.pushState(null, "", `#horizon-${to}`);
    route.value = to;
    try { document.getElementById("horizonroot")?.scrollIntoView({ block: "start" }); } catch { /* the page stays where it is */ }
  };
  const showSetup = canSet && (setupCard > 0 || (!current && !open.length));
  // a line the Guide wrote, carried here as a draft for this person
  const gd = guideDraft.value;
  const draftMarker = gd && gd.personId === personId && MARKER_BY_KEY[targetKeyOf(gd.marker)] && isTargetable(gd.marker) ? (targetKeyOf(gd.marker) as MarkerKey) : null;

  const nav = open.length || done.length || canSet ? (
    <div class="flex flex-wrap gap-2" role="tablist" aria-label="Your horizons">
      {open.map((h) => (
        <button type="button" role="tab" aria-selected={!showSetup && current?.id === h.id} onClick={() => { route.value = h.id; history.replaceState(null, "", `#horizon-${h.id}`); }}
          class={`rounded-full border px-3 py-1 text-[12px] font-medium ${!showSetup && current?.id === h.id ? "border-accent-border bg-accent-fill text-accent-text" : "border-border text-text-2 hover:border-border-strong"}`}>{shortTitle(h.title)} · {dayMonth(h.ends_on)}</button>
      ))}
      {done.map((h) => (
        <button type="button" role="tab" aria-selected={!showSetup && current?.id === h.id} onClick={() => { route.value = h.id; history.replaceState(null, "", `#horizon-${h.id}`); }}
          class={`rounded-full border px-3 py-1 text-[12px] font-medium ${!showSetup && current?.id === h.id ? "border-accent-border bg-accent-fill text-accent-text" : "border-border text-text-3 hover:border-border-strong"}`}>{shortTitle(h.title)} · {dayMonth(h.ends_on)} · done</button>
      ))}
      {canSet && <button type="button" role="tab" aria-selected={showSetup} onClick={() => { route.value = "new"; history.replaceState(null, "", "#horizon-new"); }} class={`rounded-full border px-3 py-1 text-[12px] font-medium ${showSetup ? "border-accent-border bg-accent-fill text-accent-text" : "border-border text-text-2 hover:border-border-strong"}`}>{open.length ? "Set another" : done.length ? "Set the next" : "Set a horizon"}</button>}
    </div>
  ) : null;

  return (
    <div class="flex flex-col gap-5">
      {notice && <div class="flex items-start justify-between gap-3 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] text-text-2"><span>{notice}</span><button type="button" onClick={() => setNotice("")} class="text-text-3 hover:text-text" aria-label="Dismiss">×</button></div>}
      {loadError && <Quiet>{loadError}</Quiet>}
      {consent && <ConsentBox onAgree={() => void agreeConsent()} busy={busy === "consent"} />}
      {lastWeek && <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[14px] leading-relaxed text-text-2" data-continuity>{lastWeek}</p>}
      {showSetup && tester && owner && !ownTargets && (open.length > 0 || !done[0] || !!parseProgramme(done[0].programme))
        ? <ProgrammeSetup sb={deps.supabase} person={person} today={today} personId={personId} nav={nav} hasOthers={open.length > 0 || done.length > 0} access={access} guideOn={guideOn} userId={userId}
            after={!open.length && done[0] ? parseProgramme(done[0].programme)?.goal ?? null : null} afterDay={!open.length && !!done[0] && !!dayKindOf(done[0].programme)} key={!open.length && done[0] ? `after-${done[0].id}` : "programme"}
            card={setupCard || 1} goCard={goCard} watchOn={watchOn} onNote={setNotice}
            onStarted={async (id) => { setPro("yes"); await load(); route.value = id; history.replaceState(null, "", `#horizon-${id}`); try { window.scrollTo({ top: 0 }); } catch { /* the page stays where it is */ } }}
            onError={onApiError} onCancel={() => { route.value = ""; history.replaceState(null, "", "#horizon"); }} onOwn={() => setOwnTargets(true)} />
        : showSetup
        ? <Setup deps={deps} person={person} today={today} personId={personId} hasOthers={open.length > 0 || done.length > 0} nav={nav} draftMarker={draftMarker} access={access} guideOn={guideOn}
            prefill={!open.length && done[0] ? prefillOf(done[0], person, today) : undefined} key={!open.length && done[0] ? `next-${done[0].id}` : "new"}
            onStarted={async (id) => { setPro("yes"); await load(); route.value = id; history.replaceState(null, "", `#horizon-${id}`); }}
            onError={onApiError} onCancel={() => { route.value = ""; history.replaceState(null, "", "#horizon"); }} />
        : current && isDone(current)
          ? <FinalView deps={deps} h={current} person={person} today={today} owner={owner} canSet={canSet} nav={nav} personId={personId} hasOpen={open.length > 0} access={access} guideOn={guideOn} setNotice={setNotice} reload={load}
              onStarted={async (id) => { setPro("yes"); await load(); route.value = id; history.replaceState(null, "", `#horizon-${id}`); }} onError={onApiError} />
        : current
          ? <View deps={deps} h={current} person={person} today={today} owner={owner} nav={nav} busy={busy} setBusy={setBusy} onError={onApiError} setNotice={setNotice} reload={load} userId={userId} access={access} guideOn={guideOn} tester={tester} watchOn={watchOn}
              page={at.id === current.id ? at.page : "glance"} goPage={(pg) => goPage(current.id, pg)} />
          : <Card>{nav}<div class="text-[18px] font-semibold text-text">No horizon set.</div><Quiet>{canSet ? "A horizon is a date, the markers you want different by then, and the week that gets you there." : owner ? "There is no horizon here to read." : "Nothing to see here yet: this person has not set a horizon."}</Quiet></Card>}
    </div>
  );
}

// ── board 14: the horizon in view ──

function View({ deps, h, person, today, owner, nav, busy, setBusy, onError, setNotice, reload, userId, access, guideOn, tester, watchOn, page, goPage }: {
  deps: HorizonDeps; h: HorizonFull; person: PersonData | null; today: string; owner: boolean; nav: any; busy: string; setBusy: (s: string) => void;
  onError: (e: ApiError, retry: () => void) => boolean; setNotice: (s: string) => void; reload: () => Promise<void>; userId: () => Promise<string | null>;
  access: HorizonAccess | null; guideOn: boolean;
  /** A test account for Horizon as a programme (api.ts programmeTester). */ tester: boolean;
  /** Watched markers can be kept for this project (api.ts watchedReady). */ watchOn: boolean;
  /** The small page in view (board 22), and the way to another. */ page: HorizonPage; goPage: (p: HorizonPage) => void;
}) {
  const [editingPlan, setEditingPlan] = useState(false);
  // the horizon in small pages: for its owner on a test account first (board 22). Anyone else is shown the one page, as before.
  const paged = owner && tester;
  const on = (k: HorizonPage) => !paged || page === k;
  /** The target whose detail is open on the Targets page: one line a target, the rest behind it. */
  const [openRow, setOpenRow] = useState<MarkerKey | null>(null);
  // a horizon set up as a programme keeps its goal, the person's own words and who writes the plan
  const programme = parseProgramme(h.programme);
  // a horizon set for a day (board 14): the kind is on the row; the name the person gave it is theirs alone
  const dayKind = dayKindOf(h.programme);
  const [dayName, setDayName] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    setDayName(null);
    if (owner && dayKind) void loadDayName(deps.supabase, h.id).then((n) => { if (on) setDayName(n); });
    return () => { on = false; };
  }, [h.id, owner, dayKind?.key]);
  // a diet chart kept with the horizon (board 17): its owner's, for test accounts. Someone it is shared with (the
  // share's "Diet chart" tick) is given its rows by the database and reads them; anyone else is given none.
  const [chartState, setChartState] = useState<ChartState | null>(null);
  const loadCharts = async () => { setChartState(await loadChartState(deps.supabase, h.id)); };
  // a diet chart is the team's alone for its owner; someone a chart is shared with reads it as before
  const team = isTeam.value;
  useEffect(() => { setChartState(null); if (!owner || team) void loadCharts(); }, [h.id, owner, team]);
  const who = owner ? "you" : "they";
  // the markers this horizon watches, with no number on them (board 19): its owner's alone. The database gives anyone
  // else no rows, so the card is asked for only on the owner's own page.
  const [watched, setWatched] = useState<WatchedRow[]>([]);
  const loadWatched = async () => { setWatched(await listWatched(deps.supabase, h.id)); };
  useEffect(() => { setWatched([]); if (owner && watchOn) void loadWatched(); }, [h.id, owner, watchOn]);
  const [adding, setAdding] = useState(false);
  /** The target whose number is being changed, and what is typed. */
  const [changing, setChanging] = useState<{ marker: MarkerKey; value: string } | null>(null);
  const { week, weeks, short, paused: pausedWeek } = weekOf(h, today);
  // every full week is behind once the short last week has begun; in a paused week, every week before it
  const weeksBehindNow = short === "last" ? weeks : pausedWeek ? week : Math.max(0, week - 1);
  // a pause (board 13): offered to test accounts until the lawyers have answered; the function checks the same list
  const pause = useMemo(() => (owner && tester && !h.closed_at ? pauseState(h, today) : null), [h, today, owner, tester]);
  const [pauseAsk, setPauseAsk] = useState<PauseKey | null>(null);
  const togo = daysToGo(h, today);
  const targets = openTargets(h.targets).map(toTarget);
  const paces = useMemo(() => (person ? pacesOf(targets, h, person, today) : []), [person, h, today]);
  // Only what your device shares (derive/arrivals): a goal set on a reading that has stopped arriving is kept, and says it is paused.
  const arrivalList = person ? arrivalsOf(person.doc.weeks) : null;
  const paused = (marker: string) => pausedWords(arrivalList, marker);
  // a target with no reading yet says where one is added (board 21): the doors that exist for this person's phone
  const whoHas: Who = { store: storeOf(arrivalList), synced: !!person?.synced };
  const spans = useMemo(() => horizonSpans(h), [h.starts_on, h.ends_on, (h.pauses ?? []).join()]);
  // the header names the week today is in by its days: "a short first week, Tue 17 to Sun 22 Nov", "week 3 of 13, Mon 30 Nov to Sun 6 Dec"
  const thisSpan = spanOf(h, today);
  const weekLine = `${weekWords(h, today)}${thisSpan ? `, ${daysWords(thisSpan.from, thisSpan.to)}` : ""}`;
  const firstFull = spans.find((s) => s.full) ?? null;
  /**
   * Under a row's own line. Fitness as VO₂max. A weekly marker says which days its figure holds (the week in progress,
   * counted from the day the horizon was set), which full week the pace is read from, and what stood before the
   * horizon: the week its start column shows and a typical week. The founder read "Today" as this week and found last
   * week's figure under it (15 November 2026).
   */
  const rowNotes = (p: Pace): string[] => {
    if (!person) return [];
    if (p.marker === "mets") return [vo2Line(person, today, p.target, p.method ? p.now : null), ...holdNotes(p)].filter(Boolean);
    if (p.marker === "grip" && p.mode) return holdNotes(p);
    const def = MARKER_BY_KEY[p.marker];
    if (def?.kind !== "weekly") return [];
    const out: string[] = [];
    const w = p.week;
    if (w) out.push(`This week so far: ${daysWords(w.from, w.upto)}${w.paused ? ", paused" : w.full ? "" : ", a short week"}.${w.value == null ? " No session on file yet." : ""}`);
    out.push(p.judged ? `Pace is read from the last full week, ${daysWords(p.judged.from, p.judged.to)}: ${p.judged.text}.`
      : firstFull ? `Pace is read from full weeks. The first ends ${daysWords(firstFull.to, firstFull.to)}.` : "Pace is read from full weeks, and this horizon holds none.");
    const typical = typicalOf(p.marker, person, h.starts_on);
    const before = [p.start != null ? `the week before ${p.startText}` : "", typical != null ? `a typical week ${fmtValue(def, typical)}` : ""].filter(Boolean);
    if (before.length) out.push(`Before the horizon: ${before.join(", ")}.`);
    return out;
  };
  const planRows = h.plan?.rows ?? [];
  // the midweek note (board 15): Thursday's, counted, for the owner of a test account; off when they switched it off
  const midweek = useMemo(() => (person && owner && tester && !h.closed_at && h.checkin_midweek !== false ? midweekOf({ horizon: h, person, today, plan: planRowsNow(h, targets, person, today), targets }) : null), [person, h, today, owner, tester]);
  // when the figures below are from: the app's last sync, said under the targets (derive/asOf; 25 November 2026)
  const asOf = person ? figuresAsOf(lastAppSync(person.exportRows.weeks), new Date(), owner) : null;
  const chartLine = chartSoFar(chartState, h, today, who);
  const chartLast = chartLastWeek(chartState, h, today, who);
  // the fitness number's own test, for the card that adds a result (board 16)
  const fitnessTarget = targets.find((t) => t.marker === "mets") ?? null;
  const KINDS_FOR: Record<string, EntryKey[]> = { lab: ["mask"], walk: ["walk6"], "one-mile-walk": ["walk1"], run: ["cooper", "run15"], treadmill: ["treadmill"], watch: ["watch"] };
  const thisMonday = nextCheckins(h, today).thisMonday;
  // a paused week is asked nothing, so the plan's lines carry no count for it
  const adherence = person && planRows.length && !pausedWeek ? adherenceOf(planRows, person, thisMonday, today, h.starts_on) : [];
  const latest = h.checkins[0] ?? null;
  const next = nextCheckins(h, today);
  const road = roadOf(h, today);
  const closed = !!h.closed_at;
  const missingWeek = owner && !closed && h.checkin_monday && today >= thisMonday && !h.checkins.some((c) => c.kind === "week" && c.for_date === thisMonday) && thisMonday > h.starts_on;
  const firstOfMonth = today.slice(0, 7) + "-01";
  const missingMonth = owner && !closed && h.checkin_month && firstOfMonth > h.starts_on && today >= firstOfMonth && !h.checkins.some((c) => c.kind === "month" && c.for_date === firstOfMonth);
  const finalDue = owner && today >= h.ends_on && !h.checkins.some((c) => c.kind === "final");
  // the Guide writes the Monday check-in itself in the morning (the hour's round); the button is for a Monday that has passed nine without it
  const pastMondayNine = today > thisMonday || new Date().getHours() >= 9;
  const asOfLine = (c: { pace: { as_of?: string | null } | null }) => c.pace && "as_of" in c.pace
    ? (c.pace.as_of ? `Figures as of ${new Date(c.pace.as_of).toLocaleDateString("en-GB", { weekday: "long" })}, before the week's last sync.` : "Written before the app had synced the week.")
    : null;
  const authorWords = h.plan?.author === "coach" ? "written by your coach" : h.plan?.author === "guide" ? "drafted by the Guide" : h.plan ? "written by you" : "";
  // the Guide's plan in use: the Guide is its author and what it started from is on file
  const stored: GuideStored | null = guideOn && h.plan?.author === "guide" && isGuideStored(h.plan?.guide) ? (h.plan!.guide as GuideStored) : null;
  // Free, and the one free week is over: the plan and its chat are Pro. A coach never meets this.
  const locked = owner && !!access && !access.pro && !access.free.running;
  // kept, not running: Horizon is not offered to everyone and this account no longer has it (a founding member after
  // their last day). The page says so once (HORIZON_KEPT), so the lines above it do not say the Guide still checks.
  const keptOnly = locked && !HORIZON_PUBLIC;
  // `mine`: the reader is the person the plan is for, not only the horizon's owner (an owner may keep a horizon for someone they look after)
  const guide = guideOn && person ? { sb: deps.supabase, h, person, today, targets, owner, closed, access, userId, reload, setNotice, mine: owner && !!deps.isSelf?.() } : null;
  // the week, kept light (board 08 of "Verve, the plan you follow", 26 November 2026): three amounts first, a few ideas
  // and what each session filled, for the owner of a programme account. Null in a week that is not judged, on a
  // horizon that has stopped, and when the week asks for none of the three: the page is then as it was.
  const rowsNow = useMemo(() => (paged && person && !closed ? planRowsNow(h, targets, person, today) : []), [paged, person, h, today, closed]);
  const light = useMemo(() => (paged && person && !closed ? lightWeekOf({ horizon: h, person, today, rows: rowsNow, targets }) : null), [paged, person, h, today, closed, rowsNow]);
  // the activities the ideas draw from: the person's ticks once they have ticked, their sessions until then
  const myActs = useMemo(() => (light && person ? chosenOf(programme, person, today) : null), [light, person, today, h.programme]);
  const ideas = light && myActs ? ideasFor(light.amounts, myActs) : null;
  /** A tick is kept at once, with the horizon's other answers (horizons.programme). It changes no number the week asks. */
  async function saveActivities(next: { activities: ActivityKey[]; own: string[] }) {
    if (!programme) return;
    setBusy("activities"); setNotice("");
    const err = await saveProgramme(deps.supabase, h.id, { ...programme, activities: next.activities, own: next.own });
    setBusy("");
    if (err) setNotice(`Could not keep your activities: ${err}`); else await reload();
  }
  // a line the Guide wrote, carried here: a draft until the person sets its number, and gone when they leave it
  const gd = guideDraft.value;
  const draftDef = gd && owner && !closed && gd.personId === h.person_id && isTargetable(gd.marker) && !targets.some((t) => t.marker === targetKeyOf(gd.marker)) ? MARKER_BY_KEY[targetKeyOf(gd.marker)] ?? null : null;
  const draft = draftDef && gd ? { def: draftDef, readOn: gd.readOn, now: person ? latestOf(draftDef.key, person, today) : null } : null;

  // the horizon set before the zone column existed learns its zone on the owner's visit; the scheduled check-in needs it
  useEffect(() => {
    if (!owner || closed || h.timezone) return;
    const tz = browserZone();
    if (tz) void updateHorizon(deps.supabase, h.id, { timezone: tz }).then(() => { /* a column not there yet is not an error worth a line */ });
  }, [h.id, h.timezone, owner, closed]);

  async function writeCheckin(kind: "week" | "month" | "final", forDate: string) {
    const go = async () => {
      setBusy("checkin"); setNotice("");
      // the function computes the figures from the document, as it does on the hour; the zone goes along for a horizon without
      // one, and the page's own figures as the fallback the function keeps for a document it cannot read
      const res = await requestCheckin(deps.supabase, { horizon_id: h.id, kind, for_date: forDate, timezone: browserZone(), inputs: person ? checkinInputs(h, targets, planRows, person, today) : undefined });
      setBusy("");
      if (!res.ok) { onError(res.error, () => void go()); return; }
      await reload();
    };
    await go();
  }
  async function savePlanRows(rows: PlanRow[], author: PlanAuthor) {
    const uid = await userId();
    if (!uid) { setNotice("Sign in again to continue."); return; }
    setBusy("plan");
    const err = await savePlan(deps.supabase, h.id, rows, author, uid);
    setBusy("");
    if (err) { setNotice(`Could not save the plan: ${err}`); return; }
    setEditingPlan(false); await reload();
  }
  /**
   * Just before a number the Guide's plan follows is changed, removed or added: the plan writes down the weeks behind
   * as they were asked, and the week already begun keeps its own figures (guidePlan.ts freezeOf). A plan that has not
   * started, and a marker the plan does not follow, need nothing kept.
   */
  async function keepPlanBefore(marker: string, uid: string): Promise<string | null> {
    if (!stored || !person || !PLAN_MARKERS.has(marker)) return null;
    const frozen = freezeOf(guidePlan({ horizon: h, targets, person, today, stored }), stored, true);
    return frozen === stored ? null : saveGuidePlan(deps.supabase, h.id, planRows, frozen, uid);
  }
  /** The person changes the number they set. Where the target started, and the day, stay as they were. */
  async function changeTarget(marker: MarkerKey, value: number) {
    const t = targets.find((x) => x.marker === marker);
    const uid = await userId();
    if (!t?.id || !uid) { setNotice("Sign in again to continue."); return; }
    setBusy("target");
    // a target kept as VO₂max from before is written back in its own unit
    const raw = h.targets.find((x) => x.id === t.id);
    const err = await keepPlanBefore(marker, uid) ?? await updateTarget(deps.supabase, t.id, raw?.marker === "vo2" ? round(value * ML_PER_MET, 1) : value);
    setBusy("");
    if (err) { setNotice(`Could not change that number: ${err}`); return; }
    setChanging(null); await reload();
  }
  async function toggle(key: "checkin_monday" | "checkin_month" | "send_to_coach" | "email_checkin" | "checkin_midweek", value: boolean) {
    const err = await updateHorizon(deps.supabase, h.id, { [key]: value } as Partial<Pick<HorizonFull, "checkin_monday" | "checkin_month" | "send_to_coach" | "email_checkin" | "checkin_midweek">>);
    if (err) setNotice(`Could not change that: ${err}`); else await reload();
  }
  async function remove() {
    const err = await deleteAfterAsking(deps.supabase, h, access);
    if (err === undefined) return;
    if (err) setNotice(`Could not delete it: ${err}`); else { route.value = ""; history.replaceState(null, "", "#horizon"); await reload(); }
  }
  /** Set a week aside. The function holds the rule and writes the week and the date; the page reads the horizon again. */
  async function setAside(c: PauseChoice) {
    setBusy("pause"); setNotice("");
    const res = await pauseHorizon(deps.supabase, { horizon_id: h.id, week: c.monday, timezone: browserZone() });
    setBusy("");
    if (!res.ok) {
      if (res.error === "pause_refused") setNotice(pauseWhyWords(res.detail as PauseWhy) || ERROR_WORDS.pause_refused);
      else onError(res.error, () => void setAside(c));
      return;
    }
    setPauseAsk(null); await reload();
  }

  // ── the horizon in small pages (board 22) ──
  // the Guide's plan as it stands today, for the glance: the week so far, and whether there are six letters to show
  const planView = useMemo(() => { try { return paged && stored && person ? guidePlan({ horizon: h, targets, person, today, stored, self: owner }) : null; } catch { return null; } }, [paged, stored, person, today, h, targets.length]);
  // the light week is shown once the week is one the plan asks for: a Guide's plan kept midweek begins on the next
  // Monday, and until then the page says when it starts and shows no amounts
  const lightNow = planView && !planView.started ? null : light;
  const about = [
    `A horizon is a date, the markers you want different by then, and the week that gets you there.${keptOnly ? "" : ` The Guide checks the pace every Monday and reads the month at its end.${h.plan?.author === "coach" ? " Your coach sees all of it and writes the plan." : stored ? " The Guide wrote the plan from your targets. A coach you share your page with sees all of it." : " A coach you share your page with sees all of it and can write the plan."}`}`,
    dayKind && dayName ? `${dayName}. Shown to you only.` : "", movedWords(h) ?? "", weeksWords(h), pausedWeeksWords(h),
  ].filter(Boolean);
  const daysLeft = thisSpan ? Math.max(0, daysBetween(today, thisSpan.to)) : 0;
  const goodPaces = paces.filter((p) => !p.paused && p.tone === "good").length;
  const judgedPaces = paces.filter((p) => !p.paused && p.tone !== "neutral").length;
  const weekLines = pausedWeek ? [] : planView?.soFar.length ? planView.soFar.map((x) => ({ label: x.label, text: x.text })) : adherence.filter((a) => a.done != null && a.of != null).map((a) => ({ label: a.label, text: `${a.done} of ${a.of}` }));
  const pagedHead = (
    <header class="flex flex-col gap-3">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div class="flex min-w-0 flex-col gap-1">
          <Eyebrow>Horizon{dayKind ? ` · for ${dayKind.forWords}` : ""}{closed ? " · stopped" : ""}</Eyebrow>
          <h1 class="m-0 text-[26px] font-semibold leading-tight tracking-[-0.01em] text-text">{h.title}, {longDate(h.ends_on)}</h1>
        </div>
        <span class="font-mono text-[12px] font-medium text-text-2">{togo} {togo === 1 ? "day" : "days"} to go · {weekWords(h, today)}</span>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        {/* four places that fit a phone's width side by side, so none is hidden behind a sideways scroll */}
        <div class="grid w-full grid-cols-4 gap-1 rounded-[12px] border border-border bg-alt p-1 sm:flex sm:w-auto" role="tablist" aria-label="The pages of this horizon">
          {HORIZON_PAGES.map(([k, label]) => (
            <button type="button" role="tab" aria-selected={page === k} key={k} onClick={() => goPage(k)}
              class={`min-h-10 whitespace-nowrap rounded-[9px] px-1 text-[12.5px] sm:px-3.5 sm:text-[13px] ${page === k ? "border border-border bg-card font-semibold text-text" : "border border-transparent font-medium text-text-2 hover:text-text"}`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={() => goPage("notes")} aria-current={page === "notes" ? "page" : undefined} class={`min-h-10 text-[13px] font-semibold ${page === "notes" ? "text-accent-text" : "text-text-2 hover:text-text"}`}>Notes and settings</button>
      </div>
      {nav ? <div>{nav}</div> : null}
    </header>
  );
  const tile = (small: string, figure: string, unit: string | undefined, body: any, go: string, to: HorizonPage) => (
    <div class="flex min-w-0 flex-col gap-2 rounded-[14px] border border-border bg-card p-4">
      <span class="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-text-3">{small}</span>
      <span class="t-figure leading-none text-text">{figure}{unit ? <span class="ml-1.5 text-[13px] font-medium text-text-3">{unit}</span> : null}</span>
      <div class="flex flex-col gap-1.5 text-[13px] leading-relaxed text-text-2">{body}</div>
      <button type="button" onClick={() => goPage(to)} class="mt-auto min-h-9 self-start text-[13px] font-semibold text-accent-text hover:text-text">{go}</button>
    </div>
  );
  // the week's three amounts with the ideas under them: the first thing on the glance, and the head of This week.
  // "See it as seven days" and "See the plan behind it" lead to pages that exist today (This week, The science).
  const lightCard = (onGlance: boolean) => (lightNow && ideas && myActs ? (
    <LightWeekCard light={lightNow} ideas={ideas} eyebrow={`${new Date(today + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" })} · ${weekWords(h, today)}`}
      onSeven={onGlance ? () => goPage("week") : undefined} onPlan={planView ? () => goPage("science") : undefined}>
      {programme ? <MyActivities chosen={myActs} busy={busy === "activities"} onSave={(n) => void saveActivities(n)} /> : null}
    </LightWeekCard>
  ) : null);
  const glance = (
    <>
      <div class={`grid grid-cols-1 gap-3 ${lightNow ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {tile("Where you are going", judgedPaces ? `${goodPaces} of ${paces.length}` : String(targets.length), judgedPaces ? "on pace" : targets.length === 1 ? "target" : "targets", (
          <>
            {paces.slice(0, 3).map((p) => (
              <div class="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2" key={p.marker}>
                <span class="truncate text-text">{p.label}</span>
                <span class="h-1.5 overflow-hidden rounded-full bg-alt" aria-hidden="true"><span class="block h-full rounded-full bg-accent" style={{ width: `${Math.round(Math.max(0, Math.min(1, p.progress)) * 100)}%` }} /></span>
              </div>
            ))}
            {!judgedPaces ? <span>No pace can be read until a full week has ended.</span> : null}
          </>
        ), targets.length === 1 ? "See it" : `See all ${numberWord(targets.length)}`, "targets")}
        {lightNow ? null : tile("This week", pausedWeek ? "Paused" : weekLines[0]?.text ?? (planRows.length || planView ? "Planned" : "No plan yet"), pausedWeek || !weekLines[0] || weekLines[0].label.length > 12 ? undefined : weekLines[0].label.toLowerCase(), (
          <>
            {/* a line whose name is a sentence ("Five sessions a week") is said under the figure, not beside it */}
            {!pausedWeek && weekLines[0] && weekLines[0].label.length > 12 ? <span>{weekLines[0].label}.</span> : null}
            {weekLines.slice(1, 3).map((l) => <span key={l.label}>{l.label}: {l.text}.</span>)}
            {pausedWeek ? <span>Nothing is asked this week, and nothing in it is judged.</span>
              : !weekLines.length && planView && !planView.started ? <span>The plan's first week starts on {weekdayDayMonth(planView.firstMonday)}.</span>
              : !closed ? <span>{daysLeft === 0 ? "Today is the week's last day." : `${numberWord(daysLeft).replace(/^./, (c) => c.toUpperCase())} ${daysLeft === 1 ? "day is" : "days are"} left in the week.`}</span> : null}
          </>
        ), "See the week", "week")}
        {planView
          ? tile("Why this week", "F I T T V P", undefined, <span>Six lines behind the week: how often, how hard, how long, what kind, how much, and how it changes. Each names its rule.</span>, "See the science", "science")
          : tile("The plan", h.plan?.author === "coach" ? "A coach" : planRows.length ? "Yours" : "None yet", undefined,
              <span>{h.plan?.author === "coach" ? "Your coach writes the week. Their lines are on This week." : planRows.length ? "You wrote the week's lines. They are on This week." : "No plan is written yet. The Guide can write one from your targets."}</span>, "See the week", "week")}
      </div>
      <section class="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5" aria-label="The latest check-in">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <span class="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-3">{latest ? `${latest.kind === "week" ? "Monday's note" : latest.kind === "month" ? "The month's read" : "The whole road"} · ${weekdayDayMonth(latest.for_date)}` : "Monday's note"}</span>
          <button type="button" onClick={() => goPage("notes")} class="min-h-8 text-[12px] font-semibold text-text-2 hover:text-text">All notes</button>
        </div>
        {latest ? <CheckinText text={latest.text} /> : <p class="m-0 text-[15px] leading-relaxed text-text-2">No note yet. The first arrives on Monday {dayMonthLong(next.nextMonday)}, once the app has synced the week.</p>}
      </section>
    </>
  );
  // the week as its days (board 22): what each day of this week holds so far, from the sessions themselves
  const weekDays = !person ? null : (() => {
    const monday = mondayOf(new Date(today + "T00:00:00"));
    const by = actsByDay(person.acts);
    return (
      <div class="grid grid-cols-7 gap-1.5" aria-label="This week, day by day">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, i) => {
          const day = addDays(monday, i), d = by.get(day), ahead = day > today, out = day < h.starts_on || day > h.ends_on;
          return (
            <div key={day} class={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-[10px] border font-mono text-[11px] font-semibold ${d && d.n ? "border-accent-border bg-accent-fill text-accent-text" : ahead || out ? "border-dashed border-border-strong text-text-3" : "border-border-strong bg-alt text-text-2"} ${day === today ? "ring-1 ring-accent" : ""}`}>
              <span>{name}</span><span class="text-[10px] font-medium">{d && d.n ? `${Math.round(d.min)} min` : ahead || out ? "" : "–"}</span>
            </div>
          );
        })}
      </div>
    );
  })();

  return (
    <>
      {paged ? pagedHead : null}
      {paged && page === "glance" ? lightCard(true) : null}
      {paged && page === "glance" && isTeam.value ? <OfferOnHorizon sb={deps.supabase} h={h} today={today} /> : null}
      {paged && page === "glance" ? glance : null}
      {paged ? null : <header class="flex flex-wrap items-start justify-between gap-6">
        <div class="flex max-w-[680px] flex-col gap-2">
          <Eyebrow>Horizon · set {dayMonthYear(h.starts_on)}{dayKind ? ` · for ${dayKind.forWords}` : ""} · {weekLine}{closed ? " · stopped" : ""}</Eyebrow>
          <h1 class="m-0 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">{h.title}, {longDate(h.ends_on)}</h1>
          <p class="m-0 text-[15px] leading-relaxed text-text-2">A horizon is a date, the markers you want different by then, and the week that gets you there.{keptOnly ? null : <> The Guide checks the pace every Monday and reads the month at its end.{h.plan?.author === "coach" ? (owner ? " Your coach sees all of it and writes the plan." : " You see all of it and write the plan.") : stored ? (owner ? " The Guide wrote the plan from your targets. A coach you share your page with sees all of it." : " The Guide wrote the plan from their targets.") : owner ? " A coach you share your page with sees all of it and can write the plan." : ""}</>}</p>
          {dayKind && dayName ? <p class="m-0 text-[13px] leading-relaxed text-text-2">{dayName}. Shown to you only.</p> : null}
          {movedWords(h) ? <p class="m-0 text-[13px] leading-relaxed text-text-2">{movedWords(h)}</p> : null}
          {weeksWords(h) ? <p class="m-0 text-[13px] leading-relaxed text-text-3">{weeksWords(h)}</p> : null}
          {pausedWeeksWords(h) ? <p class="m-0 text-[13px] leading-relaxed text-text-3">{pausedWeeksWords(h)}</p> : null}
          {programme ? <ProgrammeLine programme={programme} /> : null}
          <div class="mt-1">{nav}</div>
        </div>
        <div class="flex min-w-[180px] flex-col items-end gap-1 rounded-[16px] border border-border-strong bg-card px-5 py-4">
          <span class="t-figure leading-none text-text">{togo}</span>
          <span class="font-mono text-[11px] font-medium text-text-3">days to go</span>
          <span class="text-[12px] text-text-2">{weeks} weeks · {weeksBehindNow} behind you</span>
        </div>
      </header>}

      {on("targets") ? <Card id="horizon-targets">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <H2>Targets · {targets.length}</H2>
          {paged ? <span class="text-[12px] text-text-3">Press a target for how it is read</span> : <span class="text-[12px] text-text-3">Pace = what has moved against what the date needs · the tick on each track is where you should be today</span>}
        </div>
        {!person && <Quiet>Reading your numbers…</Quiet>}
        {asOf ? <p class="m-0 text-[12px] leading-relaxed text-text-3" data-as-of>{asOf}</p> : null}
        <div class="flex flex-col">
          <div class="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_repeat(2,minmax(0,.8fr))_minmax(0,1.5fr)_minmax(0,1.6fr)] gap-3 border-b border-border pb-2 font-mono text-[11px] text-text-3 md:grid">
            <span>Marker</span><span class="text-right">I want, by {dayMonth(h.ends_on)}</span><span class="text-right">Now</span><span class="text-right">On {dayMonth(h.starts_on)}</span><span>Track</span><span>Pace</span>
          </div>
          {paces.map((p) => (
            <div class="grid grid-cols-3 items-center gap-x-3 gap-y-1 border-b border-border py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_repeat(2,minmax(0,.8fr))_minmax(0,1.5fr)_minmax(0,1.6fr)]" key={p.marker}>
              <span class="col-span-3 flex flex-col md:col-span-1">
                {paged
                  ? <button type="button" aria-expanded={openRow === p.marker} onClick={() => setOpenRow(openRow === p.marker ? null : p.marker)} class="min-h-8 text-left text-[15px] text-text hover:text-accent-text">{p.label}</button>
                  : <span class="text-[15px] text-text">{p.label}</span>}
                <span class="text-[12px] text-text-3">{MARKER_BY_KEY[p.marker]?.how ?? ""}{!paged || openRow === p.marker ? `${p.window ? ` · ${p.window}` : ""}${p.source ? ` · ${p.source}` : ""}` : ""}</span>
                {!paged || openRow === p.marker ? rowNotes(p).map((line) => <span class="text-[12px] text-text-3" key={line}>{line}</span>) : null}
                {paused(p.marker) ? <span class="text-[12px] text-text-2">{paused(p.marker)}</span> : null}
              </span>
              <span class="flex flex-col md:block md:text-right"><span class="font-mono text-[10px] text-text-3 md:hidden">I want</span><span class="font-mono text-[15px] font-semibold text-accent-text">{p.mode ? <span class="mr-1 font-sans text-[12px] font-normal text-text-2">{p.mode === "floor" ? "at least" : p.mode === "ceiling" ? "at most" : `${p.lowText ?? "—"} to`}</span> : null}{p.targetText}</span></span>
              <span class="flex flex-col md:block md:text-right"><span class="font-mono text-[10px] text-text-3 md:hidden">{p.week ? "This week" : "Now"}</span><span class="font-mono text-[15px] font-semibold text-text">{p.week ? p.week.text : p.nowText}{p.unit && (p.week ? p.week.value != null : p.now != null) ? <span class="ml-1 whitespace-nowrap font-mono text-[11px] font-medium text-text-3">{p.unit === "sessions" && (p.week ? p.week.value : p.now) === 1 ? "session" : p.unit}</span> : null}</span>{p.week ? <span class="hidden font-mono text-[10px] text-text-3 md:block">this week</span> : null}</span>
              <span class="flex flex-col md:block md:text-right"><span class="font-mono text-[10px] text-text-3 md:hidden">On {dayMonth(h.starts_on)}</span><span class="font-mono text-[15px] font-semibold text-text-3">{p.startText}</span></span>
              <span class="col-span-3 md:col-span-1"><Track progress={p.progress} elapsed={p.elapsed} tone={p.paused ? "neutral" : p.tone} /></span>
              <span class={`col-span-3 flex items-center justify-between text-[13px] font-medium md:col-span-1 ${TONE_TEXT[p.paused ? "neutral" : p.tone]}`}>
                {p.paused ? PAUSED_WORD : p.pace_word}
                {owner && !closed && (!paged || openRow === p.marker) && <span class="ml-2 flex shrink-0 gap-3 text-[12px] font-normal">
                  <button type="button" onClick={() => setChanging(changing?.marker === p.marker ? null : { marker: p.marker, value: String(round(p.target, MARKER_BY_KEY[p.marker]?.decimals ?? 1)) })} class="min-h-8 text-accent-text hover:text-text" aria-label={`Change the number for ${p.label}`}>Change</button>
                  {targets.length > 1 && <button type="button" onClick={async () => { const t = targets.find((x) => x.marker === p.marker); const uid = await userId(); if (!t?.id || !uid) return; const err = await keepPlanBefore(p.marker, uid) ?? await removeTarget(deps.supabase, t.id); if (err) setNotice(err); else await reload(); }} class="min-h-8 text-text-3 hover:text-text" aria-label={`Remove ${p.label}`}>Remove</button>}
                </span>}
              </span>
              {changing?.marker === p.marker && person && MARKER_BY_KEY[p.marker] ? (() => {
                const def = MARKER_BY_KEY[p.marker], n = Number(changing.value), ok = changing.value.trim() !== "" && Number.isFinite(n);
                // a fitness number kept to one method is read by that method here too
                const now = (p.marker === "mets" && p.method ? fitnessBy(person, p.method) : null) ?? latestOf(p.marker, person, today), typical = typicalOf(p.marker, person, today);
                const held = p.mode && def.kind !== "weekly" ? { mode: p.mode, low: targets.find((t) => t.marker === p.marker)?.low_value ?? null } : null;
                return (
                  <form class="col-span-3 flex flex-col gap-2 rounded-[10px] border border-border-strong bg-alt p-3 md:col-span-6" onSubmit={(e) => { e.preventDefault(); if (ok) void changeTarget(p.marker, n); }}>
                    <div class="flex flex-wrap items-center gap-2">
                      <input type="number" step={10 ** -def.decimals} value={changing.value} onInput={(e) => setChanging({ marker: p.marker, value: (e.currentTarget as HTMLInputElement).value })} aria-label={`${p.label}: the number you want`} class={`${inputClass} w-28 bg-card font-mono`} />
                      <span class="text-[12px] text-text-3"><span class="font-mono text-[11px]">{p.unit}</span>{standsWords(def, now, typical)}</span>
                      <span class="flex-1" />
                      <Button onClick={() => setChanging(null)}>Cancel</Button>
                      <Button type="submit" primary disabled={!ok || busy === "target" || n === p.target}>{busy === "target" ? "Keeping…" : "Change the number"}</Button>
                    </div>
                    <Quiet>{ok ? impliedPace(def, now, n, Math.max(1, Math.ceil(daysBetween(today, h.ends_on) / 7)), historyOf(p.marker, person, today), today, p.mode === "floor" && def.kind === "weekly" ? weeklyHistory(person, p.marker, today, 13) : undefined, typical, held) : "Set the number."}{p.marker === "mets" ? ` ${vo2Line(person, today, ok ? n : null)}` : ""}</Quiet>
                    <Quiet>Where it started on {dayMonth(h.starts_on)} stays as it was.{stored && PLAN_MARKERS.has(p.marker) ? (today >= stored.first_monday ? " The Guide's plan follows this number: the week already begun keeps what it asked, and the plan goes on from it." : " The Guide's plan follows this number and is worked out again from it.") : ""}</Quiet>
                  </form>
                );
              })() : null}
              {/* a target with no reading yet (board 21): the dash keeps its reason, and the row says where a reading is added. A weekly count has its own lines above. */}
              {owner && tester && !closed && person && p.now == null && !paused(p.marker) && MARKER_BY_KEY[p.marker]?.kind !== "weekly" ? (
                <div class="col-span-3 flex flex-col gap-1 md:col-span-6">
                  <span class="text-[12.5px] leading-relaxed text-text-2">Waiting for a first reading. Your number is kept, and the pace starts from the first reading that arrives.</span>
                  <WhereLine doors={doorsFor(p.marker, whoHas)} />
                </div>
              ) : null}
              {/* a blood target's two guards, under its row: where the move sits against the marker's usual swing, and a medicine on file */}
              {p.swing || p.medicine ? <span class="col-span-3 text-[12px] leading-relaxed text-text-3 md:col-span-6">{[p.swing?.words, p.medicine].filter(Boolean).join(" ")}</span> : null}
            </div>
          ))}
        </div>
        {draft && !adding ? (
          <div class="flex flex-col gap-2 rounded-[12px] border border-accent-border bg-accent-fill p-4">
            <div class="font-mono text-[11px] font-medium text-accent-text">From the Guide · a draft, not a target</div>
            <div class="text-[15px] font-semibold text-text">{draft.def.label}</div>
            <p class="m-0 text-[13px] leading-relaxed text-accent-text">You chose "Make it a target" on a line the Guide wrote on {dayMonthLong(draft.readOn)}. {draft.now ? `Today it reads ${draft.now.display ?? fmtValue(draft.def, draft.now.value)} ${draft.now.unit ?? draft.def.unit}.` : "There is no reading of it yet."}</p>
            <div class="flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold"><button type="button" onClick={() => setAdding(true)} class="text-accent-text hover:text-text">Set my number</button><button type="button" onClick={() => setGuideDraft(null)} class="text-text-2 hover:text-text">Leave it</button></div>
          </div>
        ) : null}
        {owner && !closed && person && (adding
          ? <AddTarget person={person} today={today} taken={targets.map((t) => t.marker)} weeks={Math.max(1, Math.ceil(daysBetween(today, h.ends_on) / 7))} preset={draft?.def.key}
              onAdd={async (t) => { const uid = await userId(); if (!uid) return; const kept = await keepPlanBefore(t.marker, uid); if (kept) { setNotice(kept); return; } const res = await addTarget(deps.supabase, { horizon_id: h.id, user_id: uid, ...t }); if (!res.ok) setNotice(res.detail || ERROR_WORDS.unknown); else { if (draft && t.marker === draft.def.key) setGuideDraft(null); setAdding(false); await reload(); } }}
              onCancel={() => setAdding(false)} />
          : <div><button type="button" onClick={() => setAdding(true)} class="rounded-full border border-border px-3 py-1 text-[12px] text-text-2 hover:border-accent-border">Add a target</button></div>)}
        {pausedWeek ? <Quiet>This week is paused. No pace is read and the line to your date stands still. A reading you take still counts as a reading.</Quiet> : null}
        {paged
          ? <details class="text-[12px] leading-relaxed text-text-3"><summary class="cursor-pointer">How a pace is read</summary><p class="m-0 mt-2">Pace is what has moved against what the date needs. The tick on each track is where you would be today on a straight line from the start. You set every number under "I want", and can change it. Verve sets none, and promises none. Any of the {TARGET_MARKERS.length} markers on this page can be a target.</p></details>
          : <Quiet>You set every number under "I want", and can change it. Verve sets none, and promises none: it tells you the pace your number implies and whether the weeks are keeping it. Any of the {TARGET_MARKERS.length} markers on this page can be a target.</Quiet>}
        {/* blood markers are out of Horizon pending the lawyers' review: a target set before that is kept in its row, unread, and the page says so */}
        {h.targets.length > targets.length && <Quiet>Blood markers are not offered as targets for now. The {h.targets.length - targets.length === 1 ? "one you set is" : `${numberWord(h.targets.length - targets.length)} you set are`} kept, and not shown or checked while this stands.</Quiet>}
        {paces.some((p) => MARKER_BY_KEY[p.marker]?.kind === "blood") && <Quiet>A blood target is called reached only when the move from its start is more than that marker's usual swing: two reports can differ by that much with nothing having changed. A medicine you have told the app you take is shown beside its target, and is never read as the cause of a change.</Quiet>}
      </Card> : null}

      {/* watched markers, under the targets (board 19): shown with their day, and never judged */}
      {on("targets") && owner && watchOn && person && (watched.length > 0 || (tester && !closed)) ? <WatchedCard sb={deps.supabase} horizonId={h.id} rows={watched} setOn={h.starts_on} person={person} today={today} taken={targets.map((t) => t.marker)} canEdit={tester && !closed} userId={userId} reload={loadWatched} setNotice={setNotice} /> : null}

      {on("targets") && programme && person ? <WeightCard h={h} targets={targets} person={person} today={today} programme={programme} chartLine={chartLine ? chartLine.replace(/^./, (c) => c.toUpperCase()) : null} /> : null}
      {on("targets") && fitnessTarget && owner && tester && !closed ? (
        <div class="flex flex-wrap items-center gap-3">
          <Button onClick={() => openFitnessCard({ kinds: fitnessTarget.method ? KINDS_FOR[fitnessTarget.method] : undefined })}>Add a fitness test result</Button>
          <span class="text-[12px] text-text-3">{fitnessTarget.method ? "Typed here, or taken in the app. The same test as the start." : "Typed here, or taken in the app."}{isTeam.value ? " Test account." : ""}</span>
        </div>
      ) : null}
      {paged && page === "week" ? lightCard(false) : null}
      {paged && page === "week" && !closed ? weekDays : null}
      {paged && page === "week" && lightNow && person ? <LoggedCard lines={loggedLines(person, lightNow.from, addDays(today, 1))} /> : null}
      {on("week") && midweek ? <MidweekCard note={midweek} chartLine={chartLine ? chartLine.replace(/^./, (c) => c.toUpperCase()) : null} /> : null}

      {on("week") || (paged && page === "science") ? <Card id="horizon-plan">
        {paged && page === "science" && !(guide && stored && !editingPlan) ? (
          <>
            <H2>The science behind the week</H2>
            <p class="m-0 max-w-[640px] text-[15px] leading-relaxed text-text-2">This page lays out a plan the Guide writes: its six letters, the rules it rests on and where each comes from. {h.plan?.author === "coach" ? "This horizon's plan is written by your coach, so there is nothing of the Guide's to lay out." : "This horizon has no plan from the Guide yet. It can write one from your targets, on This week."}</p>
          </>
        ) : guide && stored && !editingPlan ? (locked
          ? <GuideLocked access={access!} />
          : <GuidePlanCard {...guide} stored={stored} part={paged ? (page === "science" ? "science" : "week") : undefined} onCoachEdit={() => setEditingPlan(true)}
              onOwnLines={() => { if (confirm("Leave the Guide's plan? This week's lines stay as your own, and the weekly step stops.")) void savePlanRows(planRows, "user"); }} />
        ) : <>
        {guide && owner && !closed && !editingPlan && h.plan?.author !== "coach" && (locked ? <GuideLocked access={access!} /> : <GuideOffer {...guide} />)}
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <H2>The plan{planRows.length && authorWords ? ` · ${authorWords}` : ""}{planRows.length && h.plan ? `, updated ${dayMonthLong(h.plan.updated_at.slice(0, 10))}` : ""}</H2>
          <div class="flex gap-3 text-[13px] font-semibold">
            {planRows.length > 0 && !editingPlan && !closed && <button type="button" onClick={() => setEditingPlan(true)} class="text-text-2 hover:text-text">{owner ? "Edit" : "Edit the plan"}</button>}
            <button type="button" onClick={() => deps.goTab("messages")} class="text-accent-text">{owner ? "Ask my coach in Messages" : "Message them"}</button>
          </div>
        </div>
        {editingPlan
          ? <PlanEditor rows={planRows} busy={busy === "plan"} onCancel={() => setEditingPlan(false)} onSave={(rows) => void savePlanRows(rows, owner ? (h.plan?.author === "guide" && JSON.stringify(rows) === JSON.stringify(planRows) ? "guide" : "user") : "coach")} />
          : planRows.length
            ? <div class="flex flex-col">
                {planRows.map((row, i) => { const a = adherence[i]; return (
                  <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0" key={i}>
                    <span class="text-[15px] text-text">{row.label}</span>
                    <span class="font-mono text-[13px] text-text-2">{a ? (a.done != null && a.of != null ? (row.kind === "zone2_most" ? `${a.done} of ${a.of} min` : row.kind === "bedtime_by" ? `${a.done} of ${a.of} nights` : row.kind === "long_session" ? "" : `This week ${a.done} of ${a.of}`) : "") : ""}</span>
                    <span class={`text-[13px] font-medium ${a ? TONE_TEXT[a.tone] : "text-text-3"}`}>{a?.word ?? ""}</span>
                  </div>); })}
              </div>
            : <div class="flex flex-wrap items-center gap-3">
                <span class="text-[15px] text-text-2">No plan yet.</span>
                {!closed && <Button onClick={() => setEditingPlan(true)}>{owner ? "Write the plan" : "Write the plan for them"}</Button>}
                {owner && !closed && person && !guideOn && <Button onClick={() => void savePlanRows(guideDraftPlan(person, today), "guide")} disabled={busy === "plan"}>Let the Guide draft one</Button>}
              </div>}
        {pausedWeek && planRows.length ? <Quiet>Paused this week: nothing is asked, and nothing in it is judged.</Quiet> : null}
        <Quiet>{guideOn ? "Without a coach, the Guide writes the plan from your targets and you change it." : "Without a coach, the Guide drafts the plan from your last eight weeks and you edit it."} The plan is intent for a week, not a session for each day; what you did comes from your sessions, never from a tick box.</Quiet>
        </>}
      </Card> : null}

      {/* the week with a coach: only where a coach writes or edits the plan, or is the one looking (in the recording it stood on a horizon with no coach) */}
      {on("week") && programme && (programme.writer !== "guide" || !owner)
        ? <CallCard sb={deps.supabase} h={h} targets={targets} person={person} today={today} owner={owner} closed={closed} tester={tester && isTeam.value} programme={programme} planRows={planRows} guideOn={guideOn} userId={userId} setNotice={setNotice}
            chartLine={chartLast ? chartLast.replace(/^./, (c) => c.toUpperCase()) : null}
            pause={pause} pausing={busy === "pause"} onSetAside={(c) => { if (confirm(`Set last week aside, ${c.words}?\n\n${pauseLines(h, c, pause!).join("\n")}`)) void setAside(c); }} />
        : null}

      {owner && team && chartState && !chartState.off && (!paged || (chartState.charts.length ? page === "week" : page === "notes")) ? <ChartCard sb={deps.supabase} h={h} today={today} state={chartState} closed={closed} userId={userId} reload={loadCharts} sharedWith={chartSharedWith((docSignal.value as { sharing?: { status?: unknown; scopes?: unknown }[] } | null)?.sharing)} /> : null}
      {!owner && chartState && chartState.charts.length ? <ChartCard sb={deps.supabase} h={h} today={today} state={chartState} closed={closed} userId={userId} reload={loadCharts} readOnly /> : null}

      {on("notes") ? <Card id="horizon-checkin">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <H2>The Guide's check-in{latest ? ` · ${weekdayDayMonth(latest.for_date)}` : ""}</H2>
          {!closed && <span class="text-[12px] text-text-3">Next: Monday {dayMonthLong(next.nextMonday)}{next.monthReview ? ` · month review ${dayMonthLong(next.monthReview)}` : ""}</span>}
        </div>
        {/* a report filed since the last check-in: what it said, above the words that mention it (board 04) */}
        {(latest?.pace?.landed ?? []).filter((l) => isTargetable(l.marker)).map((l) => (
          <p class="m-0 max-w-[640px] rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text-2" key={`${l.marker}-${l.on}`}>{landedLine(l, targets.find((t) => t.marker === l.marker))}</p>
        ))}
        {latest
          ? <CheckinText text={latest.text} />
          : <p class="m-0 text-[15px] text-text-2">{owner ? "No check-in yet. The first one arrives on the Monday morning after the horizon is set, once the app has synced the week." : "No check-in yet."}</p>}
        {latest && asOfLine(latest) && <Quiet>{asOfLine(latest)}</Quiet>}
        {((missingWeek && pastMondayNine) || missingMonth || finalDue) && (
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap gap-2">
              {missingWeek && pastMondayNine && <Button primary disabled={busy === "checkin"} onClick={() => void writeCheckin("week", thisMonday)}>{busy === "checkin" ? "Writing…" : "Write it now"}</Button>}
              {missingMonth && <Button disabled={busy === "checkin"} onClick={() => void writeCheckin("month", firstOfMonth)}>Write the month's read</Button>}
              {finalDue && <Button primary disabled={busy === "checkin"} onClick={() => void writeCheckin("final", h.ends_on)}>Read the whole road</Button>}
            </div>
            {missingWeek && pastMondayNine && <Quiet>The Guide writes it on Monday morning once the app has synced the week; this writes it with what is there.</Quiet>}
          </div>
        )}
        {h.checkins.length > 1 && (
          <details class="text-[13px] text-text-2">
            <summary class="cursor-pointer text-text-3">Earlier check-ins · {h.checkins.length - 1}</summary>
            <div class="mt-3 flex flex-col gap-4">
              {h.checkins.slice(1).map((c) => <div key={c.id}><div class="font-mono text-[11px] text-text-3">{c.kind === "week" ? "Monday" : c.kind === "month" ? "Month read" : "The whole road"} · {dayMonthYear(c.for_date)}</div><CheckinText text={c.text} small /></div>)}
            </div>
          </details>
        )}
        <div class="flex flex-wrap items-end gap-1 overflow-x-auto pt-2" aria-label={`The road to ${dayMonth(h.ends_on)}`}>
          {road.map((s, i) => (
            <div class="flex min-w-[64px] flex-1 flex-col items-start gap-1" key={`${s.date}-${i}`}>
              <div class="flex w-full items-center"><span class={`h-2.5 w-2.5 rounded-full ${s.state === "now" ? "bg-accent" : s.state === "past" ? "bg-accent-border" : s.state === "end" ? "bg-text" : "border border-border-strong"}`} />{i < road.length - 1 && <span class={`h-px flex-1 ${s.state === "past" || s.state === "now" ? "bg-accent-border" : "bg-border"}`} />}</div>
              <span class={`font-mono text-[11px] ${s.state === "now" ? "text-accent-text" : "text-text-2"}`}>{s.label}</span>
              <span class="text-[11px] text-text-3">{s.sub}</span>
            </div>
          ))}
        </div>
        <Quiet>Every Monday morning, once the app has synced the week: a short check-in against the targets{h.send_to_coach ? ", also sent to your coach in Messages" : ""}. Each month's first day: a Guide read of the month on the horizon. On the date: a read of the whole road, and the choice to set the next horizon.</Quiet>
      </Card> : null}

      {on("notes") && owner && (
        <Card>
          <H2>Check-ins and who sees them</H2>
          <div class="flex flex-col">
            {([["checkin_monday", "Monday morning check-in against the targets"], ["checkin_month", "A Guide read at each month's end"], ["send_to_coach", "Send each check-in to my coach"],
              // the email switch appears once the horizon's row carries it (the column arrives with the function that sends the email)
              ...("email_checkin" in h ? [["email_checkin", "Email me each check-in"] as const] : []),
              // the midweek note's switch appears once the row carries it, for test accounts (board 15)
              ...("checkin_midweek" in h && tester ? [["checkin_midweek", "A midweek note on Thursday, on this page and in The Guide"] as const] : [])] as const).map(([key, label], i) => (
              <label class={`flex items-center justify-between gap-3 py-3 text-[15px] text-text ${i ? "border-t border-border" : ""}`} key={key}>
                <span>{label}</span>
                <input type="checkbox" checked={key === "checkin_midweek" ? h.checkin_midweek !== false : !!h[key]} disabled={closed} onChange={(e) => void toggle(key, (e.currentTarget as HTMLInputElement).checked)} class="h-5 w-5 accent-accent" />
              </label>
            ))}
          </div>
          {"email_checkin" in h && <Quiet>The email carries the check-in's words and your figures. One click in any email turns it off.</Quiet>}
          {pause && pauseAsk ? <PauseAsk h={h} state={pause} pick={pauseAsk} setPick={setPauseAsk} busy={busy === "pause"} onPause={(c) => void setAside(c)} onCancel={() => setPauseAsk(null)} /> : null}
          <div class="flex flex-wrap items-center gap-3">
            {pause && !pauseAsk && pause.left > 0 ? <Button disabled={!pause.open} onClick={() => setPauseAsk((pause.choices.find((c) => c.key === "this" && c.ok) ?? pause.choices.find((c) => c.ok))!.key)}>Pause for a week</Button> : null}
            {pause && pause.used > 0 ? <span class="inline-flex min-h-10 items-center rounded-[10px] border border-dashed border-border-strong px-4 text-[13px] font-semibold text-text-3">Paused {pause.used === 1 ? "once" : pause.used === 2 ? "twice" : `${numberWord(pause.used)} times`} · {pause.taken.join(" and ")}</span> : null}
            <Button disabled={busy === "delete"} onClick={() => void remove()}>Delete this horizon</Button>
          </div>
          {pause && pause.left > 0 && !pause.open ? <Quiet>{pauseWhyWords(pause.choices.find((c) => c.key === "this")?.why)}</Quiet> : null}
          <Quiet>{pause ? `${pause.words} ` : ""}Deleting removes the horizon for good and keeps your readings. Check-ins describe pace. They do not change the plan; your coach does, or you do.</Quiet>
        </Card>
      )}

      {paged && page === "notes" ? (
        <Card>
          <H2>About this horizon</H2>
          <Eyebrow>Set {dayMonthYear(h.starts_on)} · {weekLine}</Eyebrow>
          {about.map((line) => <p class="m-0 max-w-[720px] text-[14px] leading-relaxed text-text-2" key={line}>{line}</p>)}
          {programme ? <ProgrammeLine programme={programme} /> : null}
        </Card>
      ) : null}
      {on("notes") && HORIZON_PUBLIC ? <div class="flex flex-wrap items-center gap-3 rounded-[16px] border border-accent-border bg-accent-fill px-5 py-4 text-[13px] text-text-2">
        <span class="font-mono text-[11px] font-medium text-accent-text">Pro</span>
        <span>Horizon is part of Pro on the website. Free has one week of it, with the plan and one question about the plan, and keeps the Overview, Body, Reports and the Guide's first read. A horizon can be deleted any time; the readings stay.</span>
      </div> : null}
    </>
  );
}

// ── board 06: the whole road, and the next horizon prefilled from it ──

/** What the next horizon's set-up opens with: the last one's span, markers, plan and check-in choices; the numbers are left for the person. */
type Prefill = {
  kind: "date" | 3 | 6 | 12; title: string; date: string;
  markers: MarkerKey[]; /** Beside each marker: what the last road did to it. */ lastRoad: Record<string, string>;
  planRows: PlanRow[]; planAuthor: PlanAuthor | null;
  monday: boolean; month: boolean; toCoach: boolean; /** Never carried over: the email is asked for afresh on each horizon, and its box starts empty. */ email: boolean;
  /** The complete weeks of the road just read. */ weeks: number;
};

/** The next horizon's opening state, from one read to its date. */
function prefillOf(h: HorizonFull, person: PersonData | null, today: string): Prefill {
  const targets = openTargets(h.targets).map(toTarget);
  return {
    ...nextSpan(h, today),
    markers: targets.map((t) => t.marker).filter((k) => !!MARKER_BY_KEY[k]),
    lastRoad: person ? Object.fromEntries(targets.map((t) => [t.marker, lastRoadWords(t, h, person)])) : {},
    planRows: h.plan?.rows ?? [], planAuthor: h.plan?.author ?? null,
    monday: h.checkin_monday, month: h.checkin_month, toCoach: h.send_to_coach,
    // the email is asked for afresh on every horizon: the box never arrives ticked, whatever the last one held
    email: false,
    weeks: Math.max(1, horizonMondays(h).length),
  };
}

function FinalView({ deps, h, person, today, owner, canSet, nav, personId, hasOpen, onStarted, onError, access, guideOn, setNotice, reload }: {
  deps: HorizonDeps; h: HorizonFull; person: PersonData | null; today: string; owner: boolean; /** A new horizon may be set from here (../horizon/access.ts maySetHorizon). */ canSet: boolean; nav: any; personId: string; hasOpen: boolean;
  onStarted: (id: string) => Promise<void>; onError: (e: ApiError, retry: () => void) => boolean;
  access: HorizonAccess | null; guideOn: boolean; setNotice: (s: string) => void; reload: () => Promise<void>;
}) {
  async function remove() {
    const err = await deleteAfterAsking(deps.supabase, h, access);
    if (err === undefined) return;
    if (err) setNotice(`Could not delete it: ${err}`); else { route.value = ""; history.replaceState(null, "", "#horizon"); await reload(); }
  }
  // with another horizon already running, the next one waits behind a button
  const [later, setLater] = useState(hasOpen);
  const final = h.checkins.find((c) => c.kind === "final")!;
  const targets = openTargets(h.targets).map(toTarget);
  const outcomes = useMemo(() => (person ? outcomesOf(targets, h, person) : []), [person, h]);
  const weeksBehind = Math.max(1, horizonMondays(h).length);
  const weekly = h.checkins.filter((c) => c.kind === "week").length, monthly = h.checkins.filter((c) => c.kind === "month").length;
  const road = roadOf(h, today);
  const earlier = h.checkins.filter((c) => c.kind !== "final");
  const prefill: Prefill | null = useMemo(() => (owner ? prefillOf(h, person, today) : null), [h, person, today, owner]);

  return (
    <>
      {/* a horizon that ran to its date, for its owner on a test account: one line saying where what goes with it is read */}
      {owner && isTeam.value ? <OfferOnHorizon sb={deps.supabase} h={h} today={today} /> : null}
      <header class="flex flex-wrap items-start justify-between gap-6">
        <div class="flex max-w-[680px] flex-col gap-2">
          <Eyebrow>Horizon · set {dayMonthYear(h.starts_on)} · the date</Eyebrow>
          <h1 class="m-0 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">{longDate(h.ends_on)}</h1>
          <p class="m-0 text-[15px] leading-relaxed text-text-2">{canSet ? "The whole road, read once. Then the next horizon, prefilled from what moved; the numbers are yours to set." : "The whole road, read once."}</p>
          {weeksWords(h) ? <p class="m-0 text-[13px] leading-relaxed text-text-3">{weeksWords(h)}</p> : null}
          <div class="mt-1">{nav}</div>
        </div>
        <div class="flex min-w-[180px] flex-col items-end gap-1 rounded-[16px] border border-border-strong bg-card px-5 py-4">
          <span class="t-figure leading-none text-text">{weeksBehind}</span>
          <span class="font-mono text-[11px] font-medium text-text-3">{weeksBehind === 1 ? "week" : "weeks"} behind {owner ? "you" : "them"}</span>
          <span class="text-[12px] text-text-2">{weekly} check-in{weekly === 1 ? "" : "s"} · {monthly} month read{monthly === 1 ? "" : "s"}</span>
        </div>
      </header>

      <Card id="horizon-final">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <H2>The Guide's read of the whole road</H2>
          <span class="text-[12px] text-text-3">Written {dayMonthLong(new Date(final.created_at).toLocaleDateString("en-CA"))} · every number in it is in {owner ? "your" : "their"} data</span>
        </div>
        <div class="flex max-w-[680px] flex-col gap-3">
          {final.text.split(/\n{2,}/).map((para, i) => <p class="m-0 text-[16px] leading-[1.65] text-text" key={i}>{para}</p>)}
        </div>
        <div class="flex flex-wrap items-end gap-1 overflow-x-auto pt-2" aria-label={`The road to ${dayMonth(h.ends_on)}`}>
          {road.map((s, i) => (
            <div class="flex min-w-[64px] flex-1 flex-col items-start gap-1" key={`${s.date}-${i}`}>
              <div class="flex w-full items-center"><span class={`h-2.5 w-2.5 rounded-full ${s.state === "end" ? "bg-good" : "bg-accent-border"}`} />{i < road.length - 1 && <span class="h-px flex-1 bg-accent-border" />}</div>
              <span class="font-mono text-[11px] text-text-2">{s.label}</span>
              <span class="text-[11px] text-text-3">{s.state === "end" ? "the whole road" : s.sub}</span>
            </div>
          ))}
        </div>
        {!person && <Quiet>Reading the numbers…</Quiet>}
        <div class="flex flex-col">
          <div class="hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,.8fr))_minmax(0,1.8fr)] gap-3 border-b border-border pb-2 font-mono text-[11px] text-text-3 md:grid">
            <span>Marker</span><span class="text-right">{dayMonth(h.starts_on)}</span><span class="text-right">{dayMonth(h.ends_on)}</span><span class="text-right">Target</span><span>Outcome</span>
          </div>
          {outcomes.map((o) => (
            <div class="grid grid-cols-3 items-center gap-x-3 gap-y-1 border-b border-border py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,.8fr))_minmax(0,1.8fr)]" key={o.marker}>
              <span class="col-span-3 flex flex-col md:col-span-1"><span class="text-[15px] text-text">{o.label}</span><span class="text-[12px] text-text-3">{o.how}</span></span>
              <span class="font-mono text-[15px] font-semibold text-text-3 md:text-right">{o.startText}</span>
              <span class="font-mono text-[15px] font-semibold text-text md:text-right">{o.endText}</span>
              <span class="font-mono text-[15px] font-semibold text-accent-text md:text-right">{o.targetText}</span>
              <span class={`col-span-3 text-[13px] font-medium md:col-span-1 ${TONE_TEXT[o.tone]}`}>{o.word}</span>
              {o.swing || o.medicine ? <span class="col-span-3 text-[12px] leading-relaxed text-text-3 md:col-span-5">{[o.swing, o.medicine].filter(Boolean).join(" ")}</span> : null}
            </div>
          ))}
        </div>
        {earlier.length > 0 && (
          <details class="text-[13px] text-text-2">
            <summary class="cursor-pointer text-text-3">The road's check-ins · {earlier.length}</summary>
            <div class="mt-3 flex flex-col gap-4">
              {earlier.map((c) => <div key={c.id}><div class="font-mono text-[11px] text-text-3">{c.kind === "week" ? "Monday" : "Month read"} · {dayMonthYear(c.for_date)}</div><CheckinText text={c.text} small /></div>)}
            </div>
          </details>
        )}
      </Card>

      {canSet && prefill && (later
        ? <div><Button onClick={() => setLater(false)}>Set the next horizon</Button></div>
        : <Setup deps={deps} person={person} today={today} personId={personId} hasOthers={false} nav={null} prefill={prefill} onStarted={onStarted} onError={onError} onCancel={() => setLater(true)} access={access} guideOn={guideOn} />)}

      {owner && (
        <div class="flex flex-wrap items-center gap-3">
          <Button onClick={() => void remove()}>Delete this horizon</Button>
          <Quiet>Deleting removes this horizon and its read for good. Your readings stay.</Quiet>
        </div>
      )}
    </>
  );
}

// ── board 13: deleting a horizon, and pausing it for a week ──

/**
 * The person is asked once, in the words of what happens, and the horizon is removed. Undefined when they said no;
 * null when it is gone; otherwise why it is not.
 */
async function deleteAfterAsking(sb: SupabaseClient, h: HorizonFull, access: HorizonAccess | null): Promise<string | null | undefined> {
  // Free has one horizon, and its week does not begin again: said before the person removes the only one they can set
  const free = access && !access.pro ? " Free has one horizon: setting another after this is part of Pro." : "";
  if (!confirm(`Delete the horizon "${h.title}"? Its targets, plan, check-ins and notes are removed for good. Your readings stay.${free} This cannot be undone.`)) return undefined;
  return deleteHorizon(sb, h.id);
}

const shortDay = (d: string, year = false) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).replace(",", "");
/** What a pause of one week does, as the lines the person reads before they press it. The same lines for the ask at the foot and for last week's on the call sheet. */
function pauseLines(h: HorizonFull, c: PauseChoice, state: PauseState): string[] {
  return [
    state.moves ? `Your date moves from ${shortDay(h.ends_on)} to ${shortDay(c.ends_on, true)}.` : `Your date stays, ${shortDay(h.ends_on, true)}. The plan closes up by one week.`,
    c.key === "last" ? "Nothing in that week is judged. This week takes its number and asks what it asked." : "Nothing in the paused week is asked or judged.",
    state.allowed === 1 ? "This can be done once on this horizon, and it cannot be taken back." : `This horizon has ${numberWord(state.left)} of its ${numberWord(state.allowed)} pauses left. A pause cannot be taken back.`,
    "Your plan and what you pay for it do not pause.",
  ];
}

/** The ask before a pause (board 13, card 2): which week, what it does, and the two buttons. No reason is asked. */
function PauseAsk({ h, state, pick, setPick, busy, onPause, onCancel }: { h: HorizonFull; state: PauseState; pick: PauseKey; setPick: (k: PauseKey) => void; busy: boolean; onPause: (c: PauseChoice) => void; onCancel: () => void }) {
  const LABEL: Record<PauseKey, string> = { last: "Last week", this: "This week", next: "Next week" };
  // last week is offered only while it can still be set aside; this week and next week are always shown, with why not
  const shown = state.choices.filter((c) => c.key !== "last" || c.ok);
  const chosen = shown.find((c) => c.key === pick && c.ok) ?? shown.find((c) => c.ok) ?? null;
  return (
    <div id="horizon-pause" class="flex flex-col gap-3 rounded-[14px] border border-border-strong bg-alt p-4">
      <span class="text-[15px] font-semibold text-text">Pause this horizon for a week?</span>
      <div class={`grid grid-cols-1 gap-2 ${shown.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`} role="radiogroup" aria-label="The week to pause">
        {shown.map((c) => (
          <button type="button" role="radio" aria-checked={chosen?.key === c.key} disabled={!c.ok || busy} onClick={() => setPick(c.key)} key={c.key}
            class={`flex min-h-[52px] flex-col justify-center gap-0.5 rounded-[10px] border px-3 py-1.5 text-left text-[13px] font-semibold disabled:opacity-50 ${chosen?.key === c.key ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-card text-text"}`}>
            <span>{LABEL[c.key]}</span>
            <span class="font-mono text-[11px] font-medium">{c.words}</span>
            {!c.ok ? <span class="text-[11px] font-normal">{pauseWhyWords(c.why)}</span> : null}
          </button>
        ))}
      </div>
      {chosen ? <ul class="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-text-2">{pauseLines(h, chosen, state).map((l) => <li key={l}>{l}</li>)}</ul> : null}
      <div class="flex flex-wrap gap-2">
        <Button primary disabled={!chosen || busy} onClick={() => chosen && onPause(chosen)}>{busy ? "Pausing…" : "Pause the week"}</Button>
        <Button onClick={onCancel}>Not now</Button>
      </div>
      <Quiet>No reason is asked.</Quiet>
    </div>
  );
}

/** One more target on a running horizon: the marker, its reading now, the number, the pace it implies. */
function AddTarget({ person, today, taken, weeks, preset, onAdd, onCancel }: { person: PersonData; today: string; taken: MarkerKey[]; weeks: number; /** The marker the form opens on: a draft from the Guide. */ preset?: MarkerKey; onAdd: (t: Omit<StartTarget, "cadence"> & { cadence: any }) => void; onCancel: () => void }) {
  // Only what your device shares (derive/arrivals): a goal is offered only where it can be followed.
  const off = leftOff(arrivalsOf(person.doc.weeks));
  const free = TARGET_MARKERS.filter((m) => !taken.includes(m.key) && followable(off, m.key));
  const [key, setKey] = useState<MarkerKey>(preset && free.some((m) => m.key === preset) ? preset : free[0]?.key ?? "mets");
  const [value, setValue] = useState("");
  const def = MARKER_BY_KEY[key];
  const now = latestOf(key, person, today);
  const unit = now?.unit ?? def.unit;
  const n = Number(value);
  const typical = typicalOf(key, person, today);
  const note = `${value && Number.isFinite(n) ? impliedPace(def, now, n, weeks, historyOf(key, person, today), today, def.standing ? weeklyHistory(person, key, today, 13) : undefined, typical) : def.how}${key === "mets" ? ` ${vo2Line(person, today, value && Number.isFinite(n) ? n : null)}` : ""}`;
  return (
    <div class="flex flex-col gap-3 rounded-[10px] border border-border-strong bg-alt p-4">
      <div class="flex flex-wrap items-center gap-2">
        <select value={key} onChange={(e) => { setKey((e.currentTarget as HTMLSelectElement).value as MarkerKey); setValue(""); }} class={`${inputClass} text-[13px]`}>
          {free.map((m) => <option value={m.key}>{m.label}</option>)}
        </select>
        <input type="number" step={10 ** -def.decimals} value={value} onInput={(e) => setValue((e.currentTarget as HTMLInputElement).value)} placeholder="I want" class={`${inputClass} w-28 font-mono`} aria-label={`${def.label}: the number you want`} />
        <span class="text-[12px] text-text-3"><span class="font-mono text-[11px]">{unit}</span>{standsWords(def, now, typical)}</span>
      </div>
      <Quiet>{note}</Quiet>
      <div class="flex gap-2"><Button onClick={onCancel}>Cancel</Button><Button primary disabled={!value || !Number.isFinite(n)} onClick={() => onAdd({ marker: key, label: def.label, unit, start_value: now?.value != null ? round(now.value, def.decimals + 1) : null, start_on: now?.on ?? today, target_value: n, cadence: def.cadence })}>Add</Button></div>
    </div>
  );
}

// ── board 15: setting a horizon ──

type Draft = { ticked: boolean; value: string };

/** One choice among a few: the kind of horizon, who writes the plan. */
const Opt = ({ on, onPick, title, sub }: { on: boolean; onPick: () => void; title: string; sub: string }) => (
  <button type="button" onClick={onPick} aria-pressed={on} class={`flex flex-col items-start gap-1 rounded-[10px] border p-3 text-left ${on ? "border-accent-border bg-accent-fill" : "border-border bg-alt hover:border-border-strong"}`}>
    <span class={`text-[15px] font-semibold ${on ? "text-accent-text" : "text-text"}`}>{title}</span>
    <span class="text-[12px] text-text-3">{sub}</span>
  </button>
);
const Step = ({ n, title, children }: { n: number; title: string; children: any }) => (
  <Card><div class="flex items-center gap-3"><span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent-border bg-accent-fill font-mono text-[12px] font-semibold text-accent-text">{n}</span><H2>{title}</H2></div>{children}</Card>
);

/** What each length is long enough for. Blood work rarely moves beyond its usual swing in three months (the founder, 11 Nov 2026). */
const LENGTH_WORDS: Record<3 | 6 | 12, string> = {
  3: "Three months: long enough for a fitness test to show a change. Two blood reports this close together rarely differ by more than their usual swing.",
  6: "Six months: room for two blood reports. It ends in the opposite season, which shifts some markers a little by itself.",
  12: "Twelve months: the same season at both ends, and room for a marker that moves slowly.",
};

function Setup({ deps, person, today, personId, hasOthers, nav, prefill, draftMarker, onStarted, onError, onCancel, access, guideOn }: {
  deps: HorizonDeps; person: PersonData | null; today: string; personId: string; hasOthers: boolean; nav: any;
  access: HorizonAccess | null; guideOn: boolean;
  /** A line the Guide wrote, carried here: its marker is listed and ticked, the number left for the person. */
  draftMarker?: MarkerKey | null;
  /** The next horizon after one read to its date: the same span, markers, plan and check-in choices, the numbers left empty. */
  prefill?: Prefill;
  onStarted: (id: string) => Promise<void>; onError: (e: ApiError, retry: () => void) => boolean; onCancel: () => void;
}) {
  const next = !!prefill;
  const [kind, setKind] = useState<"date" | 3 | 6 | 12>(prefill?.kind ?? "date");
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [date, setDate] = useState(prefill?.date ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({ ...(prefill ? Object.fromEntries(prefill.markers.map((k) => [k, { ticked: true, value: "" }])) : {}), ...(draftMarker ? { [draftMarker]: { ticked: true, value: "" } } : {}) });
  // Only what your device shares (derive/arrivals): the goals offered are the ones that can be followed. A marker
  // carried over from the last horizon stays on the form, since that goal was the person's own choice.
  const off = leftOff(person ? arrivalsOf(person.doc.weeks) : null);
  const OFFERED = TARGET_MARKERS.filter((m) => followable(off, m.key));
  const notOffered = TARGET_MARKERS.filter((m) => !followable(off, m.key));
  const [shown, setShown] = useState<MarkerKey[]>(() => { const base = prefill?.markers.length ? prefill.markers : FIRST_MARKERS.filter((k) => followable(off, k)); return draftMarker && !base.includes(draftMarker) ? [draftMarker, ...base] : base; });
  const [allShown, setAllShown] = useState(false);
  // "carry": the last horizon's plan, as it stands, until it is edited or a fresh draft is asked for
  const [planChoice, setPlanChoice] = useState<"coach" | "guide" | "carry">(prefill?.planRows.length ? "carry" : "coach");
  const [planRows, setPlanRows] = useState<PlanRow[] | null>(prefill?.planRows.length ? prefill.planRows : null);
  const [carryEdited, setCarryEdited] = useState(false);
  const [editingDraft, setEditingDraft] = useState(false);
  const [monday, setMonday] = useState(prefill?.monday ?? true);
  const [month, setMonth] = useState(prefill?.month ?? true);
  const [toCoach, setToCoach] = useState(prefill?.toCoach ?? false);
  // off unless the person ticks it: an email that carries their figures is their own act, never a box found ticked
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const endsOn = kind === "date" ? date : addMonths(today, kind);
  const days = endsOn ? daysBetween(today, endsOn) : 0;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const guideRows = useMemo(() => (person ? guideDraftPlan(person, today) : []), [person, today]);
  useEffect(() => { if (planChoice === "guide" && planRows == null) setPlanRows(guideRows); }, [planChoice]);

  const draft = (k: MarkerKey): Draft => drafts[k] ?? { ticked: false, value: "" };
  const setDraft = (k: MarkerKey, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [k]: { ...draft(k), ...patch } }));
  const rowsShown = allShown ? [...shown.filter((k) => !OFFERED.some((m) => m.key === k)), ...OFFERED.map((m) => m.key)] : shown;
  const rest = OFFERED.filter((m) => !rowsShown.includes(m.key));

  const targetsChosen = (): StartTarget[] => rowsShown.filter((k) => draft(k).ticked && draft(k).value !== "" && Number.isFinite(Number(draft(k).value))).map((k) => {
    const def = MARKER_BY_KEY[k]; const now = person ? latestOf(k, person, today) : null;
    return { marker: k, label: def.label, unit: now?.unit ?? def.unit, start_value: now?.value != null ? round(now.value, def.decimals + 1) : null, start_on: now?.on ?? today, target_value: Number(draft(k).value), cadence: def.cadence };
  });

  async function start() {
    const name = kind === "date" ? title.trim() : `${kind} months`;
    if (kind === "date" && !name) { setProblem("Give the date a name: the race, the event, the check-up."); return; }
    if (!endsOn || endsOn <= today) { setProblem("The date has to be ahead of today."); return; }
    const targets = targetsChosen();
    if (!targets.length) { setProblem("Tick at least one marker and set its number."); return; }
    if (targets.length > 12) { setProblem("Twelve targets at most; a horizon is not a list of everything."); return; }
    const go = async () => {
      setBusy(true); setProblem("");
      const res = await startHorizon(deps.supabase, {
        person_id: personId, title: name, kind: kind === "date" ? "date" : "months", months: kind === "date" ? null : kind, starts_on: today, ends_on: endsOn, targets,
        // the Guide's plan is written after the horizon is set, once the three questions are answered: it starts with no lines
        plan: planChoice === "guide" ? (guideOn ? { rows: [], author: null } : { rows: planRows ?? guideRows, author: "guide" })
          : planChoice === "carry" ? { rows: planRows ?? [], author: carryEdited ? "user" : (prefill?.planAuthor ?? "user") }
          : { rows: [], author: null },
        checkin_monday: monday, checkin_month: month, send_to_coach: toCoach, email_checkin: email,
        timezone: browserZone(),
      });
      setBusy(false);
      if (!res.ok) { if (!onError(res.error, () => void go())) setProblem(res.detail ? `${ERROR_WORDS[res.error]} ${res.detail}` : ERROR_WORDS[res.error]); return; }
      if (draftMarker) setGuideDraft(null);   // the draft is a target now, or was unticked: either way it is settled
      await onStarted(res.data.id);
    };
    await go();
  }

  return (
    <form class="flex max-w-[980px] flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void start(); }}>
      {next
        ? <header class="flex flex-col gap-1" id="horizon-next">
            <h2 class="m-0 text-[22px] font-semibold leading-tight text-text">Set the next horizon</h2>
            <p class="m-0 text-[15px] leading-relaxed text-text-2">Verve prefills what moved; you set the numbers.</p>
            {hasOthers && <div class="mt-1">{nav}</div>}
          </header>
        : <header class="flex flex-col gap-2">
            <Eyebrow>Horizon · new</Eyebrow>
            <h1 class="m-0 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">Set a horizon</h1>
            <p class="m-0 text-[15px] leading-relaxed text-text-2">Four steps. You choose the date and the numbers; Verve tells you the pace they imply, and then whether the weeks keep it.</p>
            {hasOthers && <div class="mt-1">{nav}</div>}
          </header>}

      <Step n={1} title="What is it for?">
        <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Opt on={kind === "date"} onPick={() => setKind("date")} title="A date" sub="A race, an event, a check-up" />
          {([3, 6, 12] as const).map((m) => <Opt key={m} on={kind === m} onPick={() => setKind(m)} title={`${m} months`} sub={`to ${dayMonthYear(addMonths(today, m))}`} />)}
        </div>
        {kind !== "date" && <Quiet>{LENGTH_WORDS[kind]}</Quiet>}
        {kind === "date" && (
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-1 basis-[260px] flex-col gap-1"><Eyebrow>Name</Eyebrow><input type="text" value={title} maxLength={80} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} placeholder="Boston Marathon" class={inputClass} /></label>
            <label class="flex flex-col gap-1"><Eyebrow>Date</Eyebrow><input type="date" value={date} min={addDays(today, 7)} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} class={`${inputClass} font-mono`} /></label>
            {days > 0 && <span class="pb-2 text-[13px] text-text-2">{days} days · {weeks} weeks</span>}
          </div>
        )}
      </Step>

      <Step n={2} title="What should be different by then?">
        <p class="m-0 text-[13px] leading-relaxed text-text-2">{next
          ? "The same markers, each starting from today's figure. Set the number; under each, what the last road did and the pace the new number implies. Nothing here is a recommendation; it is arithmetic on your own readings."
          : "Tick a marker and set the number. Under each, the pace it implies from where you are today. Nothing here is a recommendation; it is arithmetic on your own readings."}</p>
        {!person && <Quiet>Reading your numbers…</Quiet>}
        {draftMarker && <p class="m-0 rounded-[10px] border border-accent-border bg-accent-fill px-4 py-3 text-[13px] leading-relaxed text-accent-text">From the Guide, a draft: {MARKER_BY_KEY[draftMarker].label} is ticked. Set its number, or untick it. <button type="button" onClick={() => { setGuideDraft(null); setDraft(draftMarker, { ticked: false, value: "" }); }} class="font-semibold underline-offset-2 hover:underline">Leave it</button></p>}
        <div class="flex flex-col">
          {rowsShown.map((k, i) => {
            const def = MARKER_BY_KEY[k]; const d = draft(k);
            const now = person ? latestOf(k, person, today) : null;
            const unit = now?.unit ?? def.unit;
            const n = Number(d.value);
            const lastRoad = prefill?.lastRoad[k] ? `The last road: ${prefill.lastRoad[k]}.` : "";
            const typical = person ? typicalOf(k, person, today) : null;
            const set = d.ticked && d.value !== "" && Number.isFinite(n);
            const note = `${set && person
              ? `${impliedPace(def, now, n, weeks, historyOf(k, person, today), today, def.standing ? weeklyHistory(person, k, today, 13) : undefined, typical)}${lastRoad ? ` ${lastRoad}` : ""}`
              : d.ticked ? `${lastRoad ? `${lastRoad} ` : ""}Set the number.` : def.how}${k === "mets" && person ? ` ${vo2Line(person, today, set ? n : null)}` : ""}`;
            return (
              <div class={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-3 md:grid-cols-[auto_minmax(0,1.1fr)_auto_minmax(0,1.5fr)] ${i ? "border-t border-border" : ""}`} key={k}>
                <input type="checkbox" checked={d.ticked} onChange={(e) => setDraft(k, { ticked: (e.currentTarget as HTMLInputElement).checked })} aria-label={def.label} class="h-5 w-5 accent-accent" />
                <span class="text-[15px] text-text">{def.label}</span>
                {/* what you want first, today beside it */}
                <input type="number" step={10 ** -def.decimals} value={d.value} placeholder="I want" disabled={!d.ticked} onInput={(e) => setDraft(k, { value: (e.currentTarget as HTMLInputElement).value })} aria-label={`${def.label}: the number you want`} class={`${inputClass} col-start-2 w-28 font-mono md:col-start-auto`} />
                <span class="col-start-2 text-[12px] text-text-3 md:col-start-auto"><span class="font-mono text-[11px]">{unit}</span>{standsWords(def, now, typical)}</span>
                <span class={`col-span-2 text-[12px] leading-relaxed md:col-span-4 md:pl-8 ${d.ticked ? "text-text-2" : "text-text-3"}`}>{note}</span>
              </div>
            );
          })}
        </div>
        {rest.length > 0 && (
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[12px] text-text-3">Add another:</span>
            {rest.slice(0, 6).map((m) => <button type="button" key={m.key} onClick={() => setShown((s) => [...s, m.key])} class="rounded-full border border-border px-3 py-1 text-[12px] text-text-2 hover:border-accent-border">{m.label}</button>)}
            {!allShown && <button type="button" onClick={() => setAllShown(true)} class="rounded-full border border-accent-border bg-accent-fill px-3 py-1 text-[12px] text-accent-text">Any of the {OFFERED.length}</button>}
          </div>
        )}
        {allShown && <Quiet>{Object.entries(GROUP_LABEL).filter(([g]) => OFFERED.some((m) => m.group === g)).map(([g, l]) => `${l}: ${OFFERED.filter((m) => m.group === g).map((m) => m.label).join(", ")}`).join(" · ")}</Quiet>}
        {notOffered.length > 0 && <Quiet>Not offered: {notOffered.map((m) => m.label).join(", ")}. Nothing is sending {notOffered.length === 1 ? "it" : "them"} from your devices, so a goal on {notOffered.length === 1 ? "it" : "one"} could not be followed. Settings › Devices says why for each.</Quiet>}
      </Step>

      <Step n={3} title="The week that gets you there">
        {planChoice === "carry"
          ? (editingDraft
            ? <PlanEditor rows={planRows ?? []} busy={false} onCancel={() => setEditingDraft(false)} onSave={(rows) => { setPlanRows(rows); setCarryEdited(true); setEditingDraft(false); }} />
            : <div class="flex flex-col gap-2">
                {(planRows ?? []).map((r, i) => <div class="text-[15px] text-text" key={i}>{r.label}</div>)}
                <Quiet>The plan carries over as it stands; edit it or ask the Guide for a fresh draft from these {numberWord(prefill?.weeks ?? 0)} weeks.</Quiet>
                <div class="flex flex-wrap gap-4">
                  <button type="button" onClick={() => setEditingDraft(true)} class="text-[13px] font-semibold text-text-2 hover:text-text">Edit the plan</button>
                  <button type="button" onClick={() => { setPlanRows(guideRows); setPlanChoice("guide"); }} class="text-[13px] font-semibold text-accent-text">Ask the Guide for a fresh draft</button>
                </div>
              </div>)
          : <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Opt on={planChoice === "coach"} onPick={() => setPlanChoice("coach")} title="Ask my coach to write the plan" sub="Your coach sees the targets and the pace notes, writes the week in Messages, and can change it any time." />
              {guideOn
                ? <Opt on={planChoice === "guide"} onPick={() => setPlanChoice("guide")} title="Let the Guide write the plan" sub="From your targets and your last eight weeks: the shape of a week, how it steps each week to the date, and how strength is laid out. Three questions come first, once the horizon is set." />
                : <Opt on={planChoice === "guide"} onPick={() => setPlanChoice("guide")} title="Let the Guide draft one" sub="From your last eight weeks: how many sessions, how much in zone 2, strength, bedtime. You edit it before it starts." />}
            </div>}
        {planChoice === "guide" && !guideOn && (editingDraft
          ? <PlanEditor rows={planRows ?? guideRows} busy={false} onCancel={() => setEditingDraft(false)} onSave={(rows) => { setPlanRows(rows); setEditingDraft(false); }} />
          : <div class="flex flex-col gap-2">
              {(planRows ?? guideRows).length ? (planRows ?? guideRows).map((r, i) => <div class="text-[15px] text-text" key={i}>{r.label}</div>) : <Quiet>Not enough weeks on file for a draft yet; write the plan after the horizon starts.</Quiet>}
              <div><button type="button" onClick={() => setEditingDraft(true)} class="text-[13px] font-semibold text-text-2 hover:text-text">Edit the draft</button></div>
            </div>)}
      </Step>

      <Step n={4} title="Check-ins">
        <div class="flex flex-col">
          {([["Monday morning check-in against the targets", monday, setMonday], ["A Guide read at each month's end", month, setMonth], ["Send each check-in to my coach", toCoach, setToCoach], ["Email me each check-in", email, setEmail]] as const).map(([label, on, set], i) => (
            <label class={`flex items-center justify-between gap-3 py-3 text-[15px] text-text ${i ? "border-t border-border" : ""}`} key={label}>
              <span>{label}</span>
              <input type="checkbox" checked={on} onChange={(e) => (set as (v: boolean) => void)((e.currentTarget as HTMLInputElement).checked)} class="h-5 w-5 accent-accent" />
            </label>
          ))}
        </div>
        <Quiet>Off unless you tick it. The email carries the check-in's words and your figures; one click in any email turns it off.</Quiet>
        <Quiet>Check-ins describe pace. They do not change the plan; your coach does, or you do.</Quiet>
      </Step>

      {problem && <div class="rounded-[10px] border border-caution/40 bg-alt px-4 py-3 text-[13px] text-caution">{problem}</div>}
      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" primary disabled={busy}>{busy ? "Starting…" : next ? "Start the next horizon" : "Start the horizon"}</Button>
        <Button onClick={onCancel}>{next ? "Not now" : "Cancel"}</Button>
        <span class="ml-auto text-[12px] text-text-3">{access && !access.pro && access.free.available ? "Free for one week, with the plan and one question about it. Then Pro. The horizon and your readings stay." : "Pro · stop it any time, the readings stay"}</span>
      </div>
    </form>
  );
}
