/**
 * Horizon as a programme, as the page draws it (canvas "Verve, Horizon as a programme", boards 04 to 08, 15 November
 * 2026). Built on the founder's word of 16 November 2026 for test accounts only: the set-up here is offered to an
 * account on the list (../horizon/api.ts programmeTester) and to nobody else, and the cards below it are drawn only on
 * a horizon that was set up as a programme.
 *
 *   ProgrammeSetup  one card at a time (board 18): the day, what for, who writes the plan; what the page already
 *                   reads; the three things it cannot read; a coach and a diet chart beside it; then the horizon
 *                   drafted from the goal, with what studies report beside each field and any marker the person
 *                   adds (board 19). Nothing is kept before "Keep this horizon".
 *   ProgrammeLine   the goal and the person's own words, above the numbers.
 *   WeightCard      the pace a weight number implies beside what guidelines describe, and three signs for fat or muscle.
 *   CallCard        the week with a coach: one sheet both people see, the person's answer, the call, three lines kept.
 *
 * Nothing here works anything out: the arithmetic is ../horizon/programme.ts and ../horizon/derive.ts, the figures
 * and their papers ../../data/programme.ts. The page sets no number and fills no field. It writes no diet.
 */
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { daysBetween } from "../derive/format.ts";
import { arrivalsOf, followable, leftOff } from "../derive/arrivals.ts";
import {
  MARKER_BY_KEY, addMonths, adherenceOf, dayMonth, dayMonthLong, doorOfMethod, dayMonthYear, fitnessBy, fmtValue, historyOf, impliedPace, latestOf, round, typicalOf, vo2Line, weekMoves, weeklyHistory,
  type MarkerDef, type MarkerKey, type PlanRow, type Reading, type Target,
} from "../horizon/derive.ts";
import {
  DAY_AFTER, DAY_BY_KEY, DAY_CHIPS, DAY_FEWEST_FULL_WEEKS, DAY_SHORT_WORDS, DOOR_BY_KEY, FEWEST_AEROBIC_DAYS, FITNESS_RULES, GOALS, GOAL_BY_KEY, GRIP, LENGTH_FOR, LONG_ENOUGH, OWN_GOAL, BARRIERS, TEMPLATE_KEEPS, WAYS, WEEK_COUNTED, WEIGHT, doiUrl,
  type DayKey, type GoalKey, type Line, type Mode,
} from "../../data/programme.ts";
import {
  DAY_NAMES, MODE_WORDS, alreadyReads, callsKept, dayCount, doorLine, goalDraft, mondayRow, noteFor, parseProgramme, sheetWeeks, startingMethod, threeSigns, weightPace,
  type MondayRow, type Programme, type WeekNote, type Writer,
} from "../horizon/programme.ts";
import { guidePlan, rowsWith, screenOutcome, storeOf, isGuideStored, SCREEN_QUESTIONS, SCREEN_WORDS, type GuideStored, type ScreenAnswers } from "../horizon/guidePlan.ts";
import { methodLabel } from "../derive/markers.ts";
import type { PauseChoice, PauseState } from "../horizon/pause.ts";
import { FitnessChooser } from "./FitnessEntry.tsx";
import { ChartCheck, readChartFile, type ChartChecked, type ChartDraft } from "./Beside.tsx";
import { AddMarkerPanel, type Added } from "./Watched.tsx";
import { DoorTiles, WhereLine } from "./Doors.tsx";
import { Sheet } from "./Sheet.tsx";
import { OfferAtSetup } from "./Offer.tsx";
import { STATE_WORDS, ageWords, doorsFor, stateOf, storeOf as healthStoreOf, syncNote, type Door, type ReadingState, type Who } from "../horizon/doors.ts";
import { actions, doc as docSignal, person as personSignal } from "../state.ts";
import { SCOPE_LABEL, offeredScopes } from "../derive/scopes.ts";
import { CHART_SCOPE } from "../horizon/chart.ts";
import { HELD_WORDS, watchedStart, watchedValue, wayOf, waysFor } from "../horizon/watch.ts";
import { CARD_COUNT, NUMBERS_CARD, SETUP_CARDS, besideOptional, cardNeeds, cardShown, clearSetup, emailShape, loadSetup, reachOf, saveSetup, type SetupFacts } from "../horizon/setupCards.ts";
import {
  startHorizon, saveProgramme, setTargetHold, saveScreen, saveGuidePlan, saveDayName, forgetAccess, listWeekNotes, saveWeekNote, keepWatched, keepChart, ERROR_WORDS,
  type ApiError, type HorizonAccess, type HorizonFull, type StartTarget,
} from "../horizon/api.ts";

// ── small parts (the same shapes as ./Horizon.tsx) ──

const Eyebrow = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium text-text-3">{children}</div>;
const H2 = ({ children }: { children: any }) => <h2 class="m-0 text-[18px] font-semibold text-text">{children}</h2>;
const Card = ({ children, id, accent }: { children: any; id?: string; accent?: boolean }) => <section id={id} class={`flex flex-col gap-4 rounded-[16px] border bg-card p-5 ${accent ? "border-accent-border" : "border-border"}`}>{children}</section>;
const Button = ({ children, onClick, primary, disabled, type = "button" }: { children: any; onClick?: () => void; primary?: boolean; disabled?: boolean; type?: "button" | "submit" }) => (
  <button type={type} disabled={disabled} onClick={onClick} class={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-50 ${primary ? "bg-accent text-canvas" : "border border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;
const inputClass = "min-h-10 rounded-[10px] border border-border bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border";
const Opt = ({ on, onPick, title, sub, foot, disabled }: { on: boolean; onPick: () => void; title: string; sub: string; foot?: string; disabled?: boolean }) => (
  <button type="button" onClick={onPick} aria-pressed={on} disabled={disabled} class={`flex flex-col items-start gap-1 rounded-[10px] border p-3 text-left disabled:opacity-60 ${on ? "border-accent-border bg-accent-fill" : "border-border bg-alt hover:border-border-strong"}`}>
    <span class={`text-[15px] font-semibold ${on ? "text-accent-text" : "text-text"}`}>{title}</span>
    <span class="text-[12px] leading-relaxed text-text-3">{sub}</span>
    {foot ? <span class="font-mono text-[11px] text-text-3">{foot}</span> : null}
  </button>
);
const Chip = ({ on, onPick, children, disabled }: { on: boolean; onPick?: () => void; children: any; disabled?: boolean }) => (
  <button type="button" onClick={onPick} aria-pressed={on} disabled={disabled} class={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-medium disabled:cursor-default ${on ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
/** A line from a study, with its papers as links: what was found for groups, never what a person will reach. */
const Evidence = ({ line }: { line: Line }) => (
  <p class="m-0 border-l-2 border-border pl-3 text-[13px] leading-relaxed text-text">{line.text}{" "}
    {line.cites.map((c, i) => { const u = doiUrl(c); return <span class="font-mono text-[11px] text-text-3" key={c}>{i ? " · " : ""}{u ? <a href={u} target="_blank" rel="noopener" class="underline-offset-2 hover:underline">{c}</a> : c}</span>; })}
  </p>
);
const browserZone = (): string | null => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };

/** The answers given on the way in (the public page), kept in this browser until a horizon is set. */
const WAY_IN_KEY = "verve-way-in";
export function readWayIn(): { aims: string[]; barriers: string[] } {
  try {
    const x = JSON.parse(localStorage.getItem(WAY_IN_KEY) ?? "null");
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, 6) : []);
    return { aims: list(x?.aims), barriers: list(x?.barriers) };
  } catch { return { aims: [], barriers: [] }; }
}
const clearWayIn = () => { try { localStorage.removeItem(WAY_IN_KEY); } catch { /* a private window: nothing was kept */ } };

// ── the set-up (boards 04 and 05; one card at a time from board 18, with markers added from board 19) ──

type Field = { ticked: boolean; value: string; low: string };
type Length = 3 | 6 | 12 | "date";
/** A row of the draft: the goal's own, or one the person added beside them. */
type Row = { marker: MarkerKey; def: MarkerDef; mode: Mode; missing: boolean; added?: boolean };
const COACH_TICKS = ["activity", "body", "heart"];

/** The frame every card sits in: its question, what it asks, and Next and Back at its foot. On a phone the foot stays at the bottom of the screen. */
const Frame = ({ title, children, card, needs, hint, onBack, onNext }: { title: string; children: any; card: number; /** Why Next is not lit; "" when it is. */ needs: string; hint?: string; onBack: () => void; onNext: () => void }) => (
  // every card is at least this tall, so Next stays where the hand left it (board 23); the first card has no Back
  <section class="flex min-h-[440px] flex-col gap-4 rounded-[16px] border border-accent-border bg-card p-5" aria-label={title}>
    <h2 class="m-0 text-[20px] font-semibold leading-snug tracking-[-0.01em] text-text">{title}</h2>
    <div class="flex flex-1 flex-col gap-4">{children}</div>
    <div class="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-2 rounded-b-[16px] border-t border-border bg-card px-5 py-3 md:static">
      {card > 1 ? <Button onClick={onBack}>Back</Button> : null}
      <Button primary disabled={!!needs} onClick={onNext}>Next</Button>
      <span class={`ml-auto text-right text-[12px] leading-snug ${needs ? "text-text-2" : "text-text-3"}`}>{needs || hint || "Nothing is kept yet"}</span>
    </div>
  </section>
);

export function ProgrammeSetup({ sb, person, today, personId, nav, hasOthers, access, guideOn, userId, onStarted, onError, onCancel, onOwn, after, afterDay, card: asked, goCard, watchOn, onNote }: {
  sb: SupabaseClient; person: PersonData | null; today: string; personId: string; nav: any; hasOthers: boolean;
  access: HorizonAccess | null; guideOn: boolean; userId: () => Promise<string | null>;
  onStarted: (id: string) => Promise<void>; onError: (e: ApiError, retry: () => void) => boolean; onCancel: () => void;
  /** "My own targets": the set-up as it was before the programme. */
  onOwn: () => void;
  /** The goal of the horizon just read to its date. After a weight horizon the next one offered is "Hold what I have". */
  after?: GoalKey | null;
  /** The horizon just read to its date was set for a day (board 14): the next one opens on "Hold what I have". */
  afterDay?: boolean;
  /** The card the address asks for, 1 to 7 (board 18). The set-up shows it, or the furthest card that may be opened. */
  card: number;
  /** Open a card: a step in the browser's history, so its own Back returns to the card it came from. */
  goCard: (n: number) => void;
  /** A line for the page once the horizon is open: whether the invitation's email went. It is sent behind the page, so it never holds the horizon up. */
  onNote?: (words: string) => void;
  /** Watched markers can be kept (api.ts watchedReady): a goal's watched row and one the person adds join the horizon; until then neither is offered. */
  watchOn: boolean;
}) {
  const wayIn = useMemo(readWayIn, []);
  // the answers kept for this tab, so a reload loses nothing (board 18); nothing is on the account until "Keep this horizon"
  const kept = useMemo(() => loadSetup(personId), [personId]);
  const was = (kept?.answers ?? {}) as Record<string, any>;
  const restored = useRef(!!kept);
  // "Time" gets in the way: the Guide's plan opens on the fewest aerobic days it offers. The person can change it in the plan.
  const planChoices = wayIn.barriers.includes("time") ? { aerobic_days: FEWEST_AEROBIC_DAYS } : null;
  const [length, setLength] = useState<Length>(was.length === 6 || was.length === 12 || was.length === "date" ? was.length : 3);
  const [date, setDate] = useState<string>(typeof was.date === "string" ? was.date : "");
  const [goal, setGoal] = useState<GoalKey | null>(typeof was.goal === "string" && GOAL_BY_KEY[was.goal] ? (was.goal as GoalKey) : after === "lose_weight" || afterDay ? "hold" : null);
  // a day to be ready for (board 14): the day sets the date; a name for it is the person's alone
  const [day, setDay] = useState<DayKey | null>(typeof was.day === "string" && DAY_BY_KEY[was.day] ? (was.day as DayKey) : null);
  const [dayName, setDayName] = useState<string>(typeof was.dayName === "string" ? was.dayName : "");
  const [writer, setWriter] = useState<Writer>(was.writer === "coach" || was.writer === "both" ? was.writer : "guide");
  const [days, setDays] = useState<number[]>(Array.isArray(was.days) ? was.days.filter((d: unknown) => Number.isInteger(d)) : []);
  const [place, setPlace] = useState<"home" | "gym" | "both" | null>(was.place === "home" || was.place === "gym" || was.place === "both" ? was.place : null);
  const [screen, setScreen] = useState<Partial<ScreenAnswers>>(was.screen && typeof was.screen === "object" ? was.screen : {});
  const [fields, setFields] = useState<Record<string, Field>>(was.fields && typeof was.fields === "object" ? was.fields : {});
  const [method, setMethod] = useState<string | null>(typeof was.method === "string" ? was.method : null);
  // markers the person added beside the goal's own (board 19), and the one whose way of being held is open
  const [added, setAdded] = useState<Added[]>(Array.isArray(was.added) ? was.added.filter((a: any) => a && MARKER_BY_KEY[a.marker] && typeof a.mode === "string") : []);
  const [adding, setAdding] = useState(false);
  const [current, setCurrent] = useState<MarkerKey | null>(null);
  // beside the horizon (board 18, card 6): a coach to invite, and a diet chart. Both are sent or kept on the last press
  const [coachEmail, setCoachEmail] = useState<string>(typeof was.coachEmail === "string" ? was.coachEmail : "");
  const [coachScopes, setCoachScopes] = useState<string[]>(Array.isArray(was.coachScopes) ? was.coachScopes.filter((x: unknown) => typeof x === "string") : COACH_TICKS);
  const [coachLater, setCoachLater] = useState<boolean>(was.coachLater === true);
  const [chart, setChart] = useState<{ draft: ChartDraft; checked: ChartChecked | null } | null>(was.chart && was.chart.draft?.read ? was.chart : null);
  const [chartReading, setChartReading] = useState(false);
  const [chartNote, setChartNote] = useState("");
  const [seen, setSeen] = useState<number>(kept?.seen ?? 1);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  /** What "Keep this horizon" is doing, said where the button was (board 23): 0 the horizon, 1 what goes with it, 2 opening it. */
  const [keepStep, setKeepStep] = useState(0);
  /** The studies, read in a sheet over the page and closed by its cross (the founder, 18 November 2026). */
  const [studies, setStudies] = useState(false);
  const [problem, setProblem] = useState<{ why: string; card: number } | null>(null);

  const g = goal ? GOAL_BY_KEY[goal] : null;
  const dayKind = day ? DAY_BY_KEY[day] : null;
  const endsOn = length === "date" ? date : addMonths(today, length);
  const count = dayKind && date ? dayCount(today, date) : null;
  // under four full weeks a day offers only what a week can count
  const shortDay = !!count && count.full < DAY_FEWEST_FULL_WEEKS;
  const weeks = endsOn && endsOn > today ? Math.max(1, Math.ceil(daysBetween(today, endsOn) / 7)) : 0;
  // Only what your device shares: a marker nothing is sending is shown, and cannot be ticked
  const off = leftOff(person ? arrivalsOf(person.doc.weeks) : null);
  const goalRows = useMemo<Row[]>(() => (goal ? goalDraft(goal, (m) => followable(off, m), dayKind?.adds ?? []).filter((r) => !shortDay || WEEK_COUNTED.has(r.marker)) : []), [goal, person, day, shortDay]);
  const addRules = { short: shortDay, canWatch: watchOn };
  // what the person added: a marker the goal lists is the goal's row, and one this draft cannot hold is left out
  const addedRows: Row[] = added.flatMap((a): Row[] => {
    const def = MARKER_BY_KEY[a.marker];
    if (!def || goalRows.some((r) => r.marker === a.marker)) return [];
    const ways = waysFor(a.marker, addRules);
    return ways.includes(wayOf(a.mode)) ? [{ marker: a.marker, def, mode: a.mode, missing: !followable(off, a.marker), added: true }] : [];
  });
  const rows: Row[] = [...goalRows, ...addedRows];
  const onFile = useMemo(() => (person ? alreadyReads(person, today) : []), [person, today]);
  // a reading that is not there says where it is added (board 21): the doors that exist for this person's phone
  const who: Who = { store: healthStoreOf(person ? arrivalsOf(person.doc.weeks) : null), synced: !!person?.synced };
  const sync = person ? syncNote(person.doc.weeks, person.synced, new Date()) : null;
  /**
   * Card 4's rows (board 21): what the set-up always lays out, then any other marker of the draft, each with how its
   * reading stands and, where it is missing or from a while ago, the doors it is added by. The two rows that are part
   * of "A typical week" share its weeks, so they carry no doors of their own and are not counted twice.
   */
  type FileRow = { key: string; label: string; sub?: string; value: string | null; from: string; state: ReadingState; doors: Door[]; part?: boolean; blood?: boolean };
  const BASE_MARKER: Record<string, MarkerKey> = { fitness: "mets", week: "zone2_week", steps: "steps", weight: "weight", waist: "waist", grip: "grip" };
  const sentence = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const fileRows: FileRow[] = !person ? [] : [
    ...onFile.map((r): FileRow => {
      const marker = BASE_MARKER[r.key];
      if (!marker) return { key: r.key, label: r.label, value: r.value, from: r.from, state: r.value ? "on_file" : "missing", doors: [], part: true };
      const now = marker === "zone2_week" ? null : latestOf(marker, person, today);
      const state: ReadingState = !r.value ? (followable(off, marker) ? "missing" : "not_sent") : marker === "zone2_week" ? "on_file" : stateOf(marker, now, today);
      const from = state === "old" && now ? `${r.from.replace(/\.$/, "")}. ${sentence(ageWords(now.on, today))}.` : r.from;
      return { key: r.key, label: r.label, value: r.value, from, state, doors: state === "on_file" ? [] : doorsFor(marker, who) };
    }),
    ...rows.filter((r) => r.def.kind !== "weekly" && !Object.values(BASE_MARKER).includes(r.marker)).map((r): FileRow => {
      const blood = r.def.kind === "blood";
      const now = latestOf(r.marker, person, today);
      const state = stateOf(r.marker, now, today, !r.missing);
      const sub = r.added ? (r.mode === "watch" ? "you added it to watch" : "you added it") : r.mode === "watch" ? "watched" : "";
      const value = now ? `${blood ? watchedValue(r.def, now) : now.display ?? fmtValue(r.def, now.value)}${r.def.hm ? "" : ` ${now.unit ?? r.def.unit}`}`.trim() : null;
      const from = now ? `${blood ? "Report of" : `${sentence(r.def.how)},`} ${dayMonthLong(now.on)}.${state === "old" ? ` ${sentence(ageWords(now.on, today))}.` : ""}`
        : blood ? "Shown only because you added it. Verve does not ask for a blood test." : r.missing ? "It comes from a device, and cannot be typed." : sentence(r.def.how) + ".";
      return { key: r.marker, label: r.def.label, sub, value, from, state, doors: state === "on_file" ? [] : doorsFor(r.marker, who), blood };
    }),
  ];
  const guideWrites = writer !== "coach" && !g?.writer;
  const answered = SCREEN_QUESTIONS.every((q) => typeof screen[q.key] === "boolean");
  const outcome = answered ? screenOutcome(screen as ScreenAnswers) : null;
  // who already shares this page far enough to see a horizon ("Activity and fitness"), waiting invitations among them
  const sharing = ((docSignal.value as { sharing?: { status?: unknown; scopes?: unknown }[] } | null)?.sharing ?? []).filter((x) => Array.isArray(x?.scopes) && (x.scopes as unknown[]).includes("activity"));
  const coachWrites = writer !== "guide" || !!g?.writer;
  const lite = personSignal.value;
  const ticksOffered = offeredScopes({ hasAccount: !!lite?.account_id, tester: true }).filter((k) => COACH_TICKS.includes(k) || k === CHART_SCOPE);
  const scopesSent = coachScopes.filter((k) => ticksOffered.includes(k));
  const emailIs = emailShape(coachEmail);
  const me = actions.myEmail().trim().toLowerCase();
  const facts: SetupFacts = {
    hasDay: !!dayKind, dateAhead: !!date && date > today, goal: !!g,
    guideAsks: guideWrites && guideOn, screenAnswered: answered,
    coachNeeded: coachWrites && sharing.length === 0,
    coach: emailIs === "ok" && me && coachEmail.trim().toLowerCase() === me ? "self" : emailIs === "none" && coachLater ? "later" : emailIs,
    coachTicks: scopesSent.length > 0, coachSeesHorizon: scopesSent.includes("activity"),
    chartUnchecked: !!chart && !chart.checked,
  };
  const reach = reachOf(facts, seen);
  const card = cardShown(asked, facts, seen);
  const cardKey = SETUP_CARDS[card - 1].key;
  const needs = cardNeeds(cardKey, facts);

  // a goal ticks its markers; a watched one is left unticked, and no field is ever filled in. What the person added stays
  useEffect(() => {
    if (restored.current) { restored.current = false; return; }
    if (!goal) return;
    setFields((f) => ({ ...Object.fromEntries(added.filter((a) => !goalRows.some((r) => r.marker === a.marker)).map((a) => [a.marker, f[a.marker] ?? { ticked: a.mode !== "watch", value: "", low: "" }])),
      ...Object.fromEntries(goalRows.map((r) => [r.marker, { ticked: r.mode !== "watch" && !r.missing, value: "", low: "" }])) }));
    setAdded((a) => a.filter((x) => !goalRows.some((r) => r.marker === x.marker)));
    setMethod(person ? startingMethod(person, today) : null);
    setPreview(false);
    const gg = GOAL_BY_KEY[goal];
    if (gg?.writer === "coach") setWriter("coach");
    if (gg && length !== "date" && !gg.suits.includes(length)) setLength(gg.suits[0]);
  }, [goal, day, shortDay]);
  // the answers, kept for the tab on every change
  useEffect(() => {
    saveSetup(personId, Math.max(seen, card), { length, date, goal, day, dayName, writer, days, place, screen, fields, method, added, coachEmail, coachScopes, coachLater, chart });
  }, [length, date, goal, day, dayName, writer, days, place, screen, fields, method, added, coachEmail, coachScopes, coachLater, chart, seen, card]);
  useEffect(() => { if (card > seen) setSeen(card); }, [card]);
  // a new card opens at its top; the first one drawn is left where the page already is
  const drawn = useRef(false);
  useEffect(() => {
    if (!drawn.current) { drawn.current = true; return; }
    // the page moves only when the set-up's top is out of sight (after the long last page): a card that is already in view stays where it is
    try { const el = document.getElementById("horizon-setup"); const top = el?.getBoundingClientRect().top ?? 0; if (el && (top < 0 || top > window.innerHeight * 0.6)) el.scrollIntoView({ block: "start" }); } catch { /* an old browser: the page stays where it is */ }
  }, [card]);

  // the page's greeting steps aside while a horizon is being set, so the card keeps one place (board 23)
  useEffect(() => { actions.quietHead(true); return () => actions.quietHead(false); }, []);

  /** Pick a day, or none. A day sets the date's kind and says which goals come first; one goal offered is the goal picked. */
  function pickDay(k: DayKey | null) {
    setDay(k); setPreview(false);
    if (!k) { if (length === "date") setLength(3); return; }
    setLength("date");
    const d = DAY_BY_KEY[k];
    setGoal(d.goals.length === 1 ? d.goals[0] : null);
  }
  const next = () => { if (!needs && card < CARD_COUNT) { setProblem(null); goCard(card + 1); } };
  const back = () => { if (card > 1) { setProblem(null); goCard(card - 1); } };
  const leave = () => { clearSetup(); onCancel(); };

  const field = (k: string): Field => fields[k] ?? { ticked: false, value: "", low: "" };
  const setField = (k: string, patch: Partial<Field>) => { setFields((f) => ({ ...f, [k]: { ...field(k), ...patch } })); setPreview(false); };
  const num = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);
  /** Where a marker stands for this draft: a fitness number is read by the method it will be kept to. */
  const nowOf = (k: MarkerKey): Reading | null => (!person ? null : k === "mets" && method ? fitnessBy(person, method) ?? latestOf(k, person, today) : latestOf(k, person, today));

  // markers added beside the goal's own (board 19)
  const addMarker = (marker: MarkerKey, mode: Mode) => { setAdded((a) => [...a.filter((x) => x.marker !== marker), { marker, mode }]); setField(marker, { ticked: mode !== "watch", value: "", low: "" }); setCurrent(marker); };
  const dropMarker = (marker: MarkerKey) => { setAdded((a) => a.filter((x) => x.marker !== marker)); setFields((f) => { const { [marker]: _gone, ...rest } = f; return rest; }); if (current === marker) setCurrent(null); setPreview(false); };
  const holdMarker = (marker: MarkerKey, mode: Mode) => { setAdded((a) => a.map((x) => (x.marker === marker ? { ...x, mode } : x))); setField(marker, { ticked: mode !== "watch" }); };

  type Chosen = StartTarget & { hold: { mode: string | null; low_value: number | null; method: string | null } | null };
  const chosen = (): Chosen[] => rows.flatMap((r): Chosen[] => {
    const f = field(r.marker), v = num(f.value), lo = num(f.low);
    if (!f.ticked || v == null || r.missing || r.def.kind === "blood") return [];
    if (r.mode === "band" && (lo == null || !(lo < v))) return [];
    const now = nowOf(r.marker);
    const held = r.mode === "floor" || r.mode === "ceiling" || r.mode === "band";
    // the weekly dose is a floor by its marker; any other held number says so in its row
    const mode = held && !r.def.standing ? r.mode : null;
    const m = r.marker === "mets" ? method : null;
    return [{ marker: r.marker, label: r.def.label, unit: now?.unit ?? r.def.unit, start_value: now?.value != null ? round(now.value, r.def.decimals + 1) : null, start_on: now?.on ?? today, target_value: v, cadence: r.def.cadence,
      hold: mode || m ? { mode, low_value: r.mode === "band" ? lo : null, method: m } : null }];
  });
  /** The rows kept as watched: a watched row with no number on it, the goal's own or one the person added. A blood marker is never anything else. */
  const watching = (): Row[] => (watchOn ? rows.filter((r) => !r.missing && r.mode === "watch" && !(r.def.kind !== "blood" && field(r.marker).ticked && num(field(r.marker).value) != null)) : []);
  const draftTargets = chosen();
  /** The Guide's first week, worked out from the draft before anything is kept. */
  const firstWeek = useMemo(() => {
    if (!preview || !person || !guideWrites || !guideOn || !outcome || outcome === "none" || !endsOn || endsOn <= today) return null;
    try { return guidePlan({ horizon: { starts_on: today, ends_on: endsOn }, targets: draftTargets.map((t) => ({ marker: t.marker, target_value: t.target_value })), person, today, mode: outcome, choices: planChoices }); } catch { return null; }
  }, [preview, person, endsOn, outcome, JSON.stringify(draftTargets.map((t) => [t.marker, t.target_value]))]);

  /** What stands between the draft and a horizon: the words, and the card that holds the answer. Null when nothing does. */
  function check(): { why: string; card: number } | null {
    if (length === "date" && !dayKind) return { why: "Choose the day this horizon is for, or a length of time.", card: 1 };
    if (!endsOn || endsOn <= today) return { why: dayKind ? "Give the day's date. It has to be ahead of today." : "The date has to be ahead of today.", card: 1 };
    if (!g || !goal) return { why: "Choose what this horizon is for.", card: 2 };
    if (guideWrites && guideOn && !answered) return { why: "Answer the three questions about your health, or choose a coach to write the plan.", card: 5 };
    const beside = cardNeeds("beside", facts);
    if (beside) return { why: beside, card: 6 };
    if (!draftTargets.length) return { why: "Set at least one number. Every field is empty until you type in it.", card: NUMBERS_CARD };
    if (field("mets").ticked && num(field("mets").value) != null && !method) return { why: "A fitness number needs a test on file. Choose how fitness will be measured, or untick Fitness.", card: NUMBERS_CARD };
    if (rows.some((r) => r.mode === "band" && field(r.marker).ticked && field(r.marker).value !== "" && !(num(field(r.marker).low) != null && num(field(r.marker).low)! < num(field(r.marker).value)!))) return { why: "A band needs both ends: the lower number first.", card: NUMBERS_CARD };
    return null;
  }

  async function keep() {
    const why = check();
    if (why) { setProblem(why); return; }
    const targets = chosen();
    const watched = watching();
    const programme: Programme = { v: 1, goal: goal!, aims: wayIn.aims, barriers: wayIn.barriers, days: [...days].sort(), place, writer: g!.writer === "coach" ? "coach" : writer, day: dayKind ? { kind: dayKind.key } : null };
    // the horizon's title is the kind of day, which a coach and the Guide may read; the name the person gave it is kept apart
    const name = dayKind ? dayKind.title : `${g!.title}, ${length} months`;
    const go = async () => {
      setBusy(true); setKeepStep(0); setProblem(null);
      const res = await startHorizon(sb, {
        person_id: personId, title: name.slice(0, 80), kind: length === "date" ? "date" : "months", months: length === "date" ? null : length, starts_on: today, ends_on: endsOn,
        targets: targets.map(({ hold: _hold, ...t }) => t), plan: { rows: [], author: null },
        checkin_monday: true, checkin_month: true, send_to_coach: programme.writer !== "guide", email_checkin: false, timezone: browserZone(),
      });
      if (!res.ok) { setBusy(false); if (!onError(res.error, () => void go())) setProblem({ why: res.detail ? `${ERROR_WORDS[res.error]} ${res.detail}` : ERROR_WORDS[res.error], card: NUMBERS_CARD }); return; }
      const id = res.data.id;
      setKeepStep(1);
      // what the function does not take: the programme, how each number is held, the method a fitness number is kept to,
      // the day's name, the three answers, the Guide's plan, what is watched, a diet chart, and the invitation to a coach.
      // They do not depend on one another, so they are sent together and not one after another (17 November 2026: keeping
      // a horizon took a second or two to show it). The invitation is sent only now, once there is a horizon to see.
      const uid = await userId();
      const writes: Promise<string | null>[] = [saveProgramme(sb, id, programme)];
      for (const t of targets) if (t.hold) writes.push(setTargetHold(sb, id, t.marker, t.hold));
      if (uid && dayKind && dayName.trim()) writes.push(saveDayName(sb, id, uid, dayName));
      if (uid && guideWrites && guideOn && answered) {
        writes.push(saveScreen(sb, id, uid, screen as ScreenAnswers));
        const oc = screenOutcome(screen as ScreenAnswers);
        if (oc !== "none" && person) {
          const v = guidePlan({ horizon: { starts_on: today, ends_on: endsOn }, targets: targets.map((t) => ({ marker: t.marker, target_value: t.target_value })), person, today, mode: oc, choices: planChoices });
          writes.push(saveGuidePlan(sb, id, rowsWith(v, []), storeOf(v, today), uid));
        }
      }
      if (uid && watched.length) writes.push(keepWatched(sb, id, uid, watched.map((r) => watchedStart(r.marker, nowOf(r.marker), today))));
      if (uid && chart?.checked) writes.push(keepChart(sb, { horizon_id: id, user_id: uid, report_path: chart.draft.path, ...chart.checked, meals: chart.draft.read.meals, notes: chart.draft.read.notes, totals: chart.draft.read.totals }));
      // the invitation's email is sent behind the page (in the recording it held "Keeping…" for seconds): the horizon says in one line whether it went
      if (facts.coach === "ok") { const to = coachEmail.trim().toLowerCase(); void actions.invite(coachEmail, scopesSent).then((r) => onNote?.(r.ok ? `The invitation to ${to} was sent.` : `The invitation to ${to} did not go. ${r.words} Sharing can send it again.`)); }
      const problems = (await Promise.all(writes)).filter((e): e is string => !!e);
      // a horizon set changes what the account may do (the free week has begun): the kept answer is asked again
      forgetAccess();
      clearWayIn(); clearSetup();
      if (problems.length) onNote?.(`The horizon is kept. One part of it was not: ${problems[0]}`);
      setKeepStep(2);
      await onStarted(id);
      setBusy(false);
    };
    await go();
  }

  async function addChart() {
    setChartNote(""); setChartReading(true);
    const res = await readChartFile();
    setChartReading(false);
    if (!res) return;
    if ("note" in res) { setChartNote(res.note); return; }
    setChart({ draft: res.draft, checked: null });
  }

  const goalTicked = goalRows.filter((r) => r.mode !== "watch" && !r.missing).length;
  /** The small grey word on a chip of the picker (board 21): a marker with no reading yet, or one from a while ago. A blood marker, a weekly count and a reading that is fresh carry none. */
  const chipHint = (m: MarkerKey): string | null => {
    const def = MARKER_BY_KEY[m];
    if (!person || !def || def.kind === "blood" || def.kind === "weekly" || !followable(off, m)) return null;
    const now = latestOf(m, person, today);
    const state = stateOf(m, now, today);
    return state === "missing" ? "no reading yet" : state === "old" && now ? `from ${dayMonth(now.on)}` : null;
  };
  const draftTitle = g ? `Your horizon, drafted · ${g.title}${count ? ` · ${count.full} full ${count.full === 1 ? "week" : "weeks"}` : weeks ? ` · ${weeks} weeks` : ""}` : "Your horizon, drafted";

  return (
    <form id="horizon-setup" class="flex max-w-[980px] scroll-mt-4 flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (card === NUMBERS_CARD) void keep(); else next(); }}>
      <header class="flex flex-col gap-2">
        <Eyebrow>Horizon · new · test account</Eyebrow>
        {card === 1 ? (
          <>
            <h1 class="m-0 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">Set a horizon</h1>
            <p class="m-0 text-[15px] leading-relaxed text-text-2">One card at a time. The page shows what it already reads about you, asks only what it cannot read, and you set every number. Nothing is kept until the last press.</p>
            {afterDay && after !== "lose_weight" ? <Evidence line={{ text: DAY_AFTER, cites: [] }} /> : null}
            {after === "lose_weight" ? <Evidence line={{ text: `Your last horizon was for weight, so this one opens on "Hold what I have": a floor, not another loss. ${WEIGHT.after.text} Any other goal can be chosen on the next card.`, cites: WEIGHT.after.cites }} /> : null}
            {wayIn.aims.length > 0 && <p class="m-0 text-[13px] leading-relaxed text-text-2">You said you want: {wayIn.aims.map((a) => `"${a}"`).join(", ")}. It is kept above your numbers.</p>}
            <p class="m-0 text-[13px] text-text-2"><a href="/horizon/" class="font-semibold text-accent-text underline-offset-2 hover:underline">{wayIn.aims.length || wayIn.barriers.length ? "Change your answers to the five questions" : "Start from the five questions"}</a></p>
          </>
        ) : null}
        {hasOthers && <div class="mt-1">{nav}</div>}
        {/* the rail names every card and marks the one in view; a card already seen opens again from it. On a phone it folds to one line */}
        <nav class="mt-1 hidden flex-wrap items-center gap-1.5 md:flex" aria-label="The cards of the set-up">
          {SETUP_CARDS.map((c, i) => {
            const n = i + 1, on = n === card, can = n <= reach && !on;
            return (
              <button type="button" key={c.key} disabled={!can} aria-current={on ? "step" : undefined} onClick={() => { setProblem(null); goCard(n); }}
                class={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] disabled:cursor-default ${on ? "border-accent bg-accent-fill font-semibold text-accent-text" : n <= reach ? "border-accent-border text-accent-text hover:border-accent" : c.key === "beside" && besideOptional(facts) ? "border-dashed border-border-strong text-text-3" : "border-border-strong text-text-3"}`}>
                <span class="font-mono text-[10.5px] font-semibold">{n}</span>{n <= reach || n === CARD_COUNT ? `${c.label}${c.key === "beside" && besideOptional(facts) ? " · optional" : ""}` : null}
              </button>
            );
          })}
        </nav>
        <div class="font-mono text-[11px] font-medium text-text-3 md:hidden">Card {card} of {CARD_COUNT} · {SETUP_CARDS[card - 1].label}{cardKey === "beside" && besideOptional(facts) ? " · optional" : ""}</div>
      </header>

      {cardKey === "day" ? (
        <Frame title="Is there a day you want to be ready for?" card={card} needs={needs} onBack={back} onNext={next}>
          <div class="flex flex-wrap gap-1.5">
            {DAY_CHIPS.map((d) => <Chip key={d.key} on={day === d.key || (d.key === "race" && day === "race_long")} onPick={() => pickDay(d.key)}>{d.label}</Chip>)}
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={!day} onClick={() => pickDay(null)} class={`inline-flex min-h-9 items-center rounded-full border border-dashed px-3 text-[13px] font-medium ${!day ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-alt text-text-2 hover:border-accent-border"}`}>No day. Three months, six months or a year</button>
          </div>
          {!dayKind ? (
            <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
              {([3, 6, 12] as const).map((m) => <Opt key={m} on={length === m} onPick={() => setLength(m)} title={m === 12 ? "1 year" : `${m} months`} sub={LENGTH_FOR[m]} foot={`to ${dayMonthYear(addMonths(today, m))}`} />)}
            </div>
          ) : (
            <div class="flex flex-col gap-4">
              {day === "race" || day === "race_long" ? (
                <div class="flex flex-col gap-2"><span class="text-[14px] font-semibold text-text">How far is it?</span>
                  <div class="flex flex-wrap gap-1.5"><Chip on={day === "race"} onPick={() => pickDay("race")}>Up to 10 km</Chip><Chip on={day === "race_long"} onPick={() => pickDay("race_long")}>A half or full marathon</Chip></div></div>
              ) : null}
              <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div class="flex flex-col gap-3">
                  <label class="flex flex-col gap-1"><Eyebrow>When is it?</Eyebrow><input type="date" value={date} min={today} onInput={(e) => { setDate((e.currentTarget as HTMLInputElement).value); setPreview(false); }} class={`${inputClass} font-mono`} /></label>
                  {count ? (
                    <div class="grid grid-cols-3 gap-2">
                      {[[count.days, count.days === 1 ? "day from today" : "days from today"], [count.full, count.full === 1 ? "full week" : "full weeks"], [count.short, count.short === 1 ? "short week, not judged" : "short weeks, not judged"]].map(([n, w]) => (
                        <div class="flex flex-col gap-0.5 rounded-[10px] border border-border bg-alt px-3 py-2" key={String(w)}><span class="t-figure-row font-semibold text-text">{n}</span><span class="text-[12px] leading-snug text-text-2">{w}</span></div>
                      ))}
                    </div>
                  ) : date ? <Quiet>The day has to be ahead of today.</Quiet> : null}
                  <label class="flex flex-col gap-1"><Eyebrow>A name for it · optional</Eyebrow><input type="text" value={dayName} maxLength={80} onInput={(e) => setDayName((e.currentTarget as HTMLInputElement).value)} placeholder="My sister's wedding" class={inputClass} /></label>
                  <Quiet>Only you see this name. The Guide and a coach are told "{dayKind.forWords}" and the date.</Quiet>
                  <Quiet>The day cannot move. A paused week is set aside and the plan closes up, and the date stays.</Quiet>
                </div>
                <div class="flex flex-col gap-2">
                  <Eyebrow>{count ? `What ${count.full} full ${count.full === 1 ? "week is" : "weeks are"} long enough for` : "What the time is long enough for"}</Eyebrow>
                  {count ? LONG_ENOUGH.map((l) => count.full >= l.least
                    ? <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-t border-border pt-2 first:border-t-0" key={l.key}><span class="text-[13px] font-semibold text-text">{l.label}</span><Evidence line={l.line} /></div>
                    : <div class="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-t border-border pt-2 first:border-t-0" key={l.key}><span class="text-[13px] font-semibold text-text">{l.label}</span><span class="text-[13px] leading-relaxed text-text-2">{l.short}</span></div>)
                    : <Quiet>Give the day's date, and the page shows what the time to it is long enough for.</Quiet>}
                  <Quiet>The lines the goals carry, picked by the time you have. No field is filled in.</Quiet>
                </div>
              </div>
              {shortDay ? <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text-2">{DAY_SHORT_WORDS}</p> : null}
            </div>
          )}
          <Quiet>A day is a reason and a date. It is not a goal: what the horizon is for is the next card.</Quiet>
        </Frame>
      ) : null}

      {cardKey === "goal" ? (
        <Frame title="What is this horizon for?" card={card} needs={needs} onBack={back} onNext={next}>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(dayKind?.goals.length ? [...GOALS].sort((a, b) => (dayKind.goals.includes(a.key) ? dayKind.goals.indexOf(a.key) : 99) - (dayKind.goals.includes(b.key) ? dayKind.goals.indexOf(b.key) : 99)) : GOALS)
              .map((x) => <Opt key={x.key} on={goal === x.key} onPick={() => setGoal(x.key)} title={x.title} sub={x.lead} foot={dayKind ? (dayKind.goals.includes(x.key) ? `Offered first for ${dayKind.forWords}` : undefined) : x.suitsWords} />)}
            <Opt on={false} onPick={() => { clearSetup(); onOwn(); }} title={OWN_GOAL.title} sub={OWN_GOAL.lead} />
          </div>
          {dayKind?.note ? <p class="m-0 text-[13px] leading-relaxed text-text-2">{dayKind.note}</p> : null}
          <Quiet>A goal ticks its markers and shows what studies report beside each number. It fills no field in, and you can add any other marker beside them on the last page.</Quiet>
        </Frame>
      ) : null}

      {cardKey === "writer" ? (
        <Frame title="Who writes the week?" card={card} needs={needs} onBack={back} onNext={next}>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Opt on={writer === "guide" && !g?.writer} disabled={!!g?.writer} onPick={() => setWriter("guide")} title="The Guide" sub={g?.writer ? "The Guide has no rules for this goal yet." : "Worked out from published guidelines and your own weeks. You can open every rule."} />
            <Opt on={writer === "both" && !g?.writer} disabled={!!g?.writer} onPick={() => setWriter("both")} title="The Guide drafts, my coach edits" sub="The Guide's plan, with your coach's changes marked as theirs." />
            <Opt on={writer === "coach" || !!g?.writer} onPick={() => setWriter("coach")} title="My coach or trainer" sub="They see the page you share and write the plan." />
          </div>
          <Quiet>{coachWrites ? (sharing.length ? "Someone already shares this page far enough to see a horizon. Anyone else can be invited on the sixth card." : "Nobody shares this page yet. The sixth card asks for your coach's email, and the invitation is sent when the horizon is kept.") : "A coach can be added later. The horizon does not start again."}{wayIn.barriers.includes("alone") ? " You said no one checks on you: a coach sees the same page you do, and a call sheet for each week." : ""}</Quiet>
        </Frame>
      ) : null}

      {cardKey === "reads" ? (
        <Frame title="What the page already reads" card={card} needs={needs} onBack={back} onNext={next}>
          {!person && <Quiet>Reading your numbers…</Quiet>}
          {person ? (
            <div class="flex flex-wrap items-center gap-2 text-[13px] text-text-2">
              {(["on_file", "old", "missing"] as const).map((k) => { const n = fileRows.filter((r) => !r.part && (k === "missing" ? r.state === "missing" || r.state === "not_sent" : r.state === k)).length; return n ? <span class="inline-flex h-7 items-center rounded-full border border-border-strong bg-alt px-3 font-mono text-[11px] font-semibold text-text" key={k}>{n} {STATE_WORDS[k]}</span> : null; })}
              <span>None of them stops you. A reading that is missing says where it is added.</span>
            </div>
          ) : null}
          {sync ? <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text-2"><span class="font-semibold text-text">{sync.lead}</span> {sync.words}</p> : null}
          <div class="flex flex-col">
            {fileRows.map((r, i) => (
              <div class={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-baseline gap-x-3 gap-y-1 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,2fr)] ${i ? "border-t border-border" : ""}`} key={r.key}>
                <span class="text-[15px] font-medium text-text">{r.label}{r.sub ? <span class="block font-mono text-[11px] font-normal text-text-3">{r.sub}</span> : null}</span>
                <span class={r.value ? "font-mono text-[14px] font-semibold text-text" : "text-[13px] text-caution"}>{r.value ?? (r.state === "not_sent" ? "Nothing is sending this" : r.blood ? "No report on file" : "Not on file")}</span>
                <span class="col-span-2 text-[12px] leading-relaxed text-text-3 md:col-span-1">{r.from}</span>
                {r.doors.length ? <div class="col-span-2 md:col-span-3"><DoorTiles doors={r.doors} /></div> : null}
              </div>
            ))}
          </div>
          <Quiet>Nothing here is typed by you unless it is missing, and nothing is filled in for you. A goal that needs a reading the page does not hold says so before the horizon starts, and never guesses one. Only the places that exist for your phone are named.</Quiet>
        </Frame>
      ) : null}

      {cardKey === "three" ? (
        <Frame title="The three things it cannot read" card={card} needs={needs} onBack={back} onNext={next}>
          <div class="flex flex-col gap-2"><span class="text-[14px] font-semibold text-text">Which days can you train?</span>
            <div class="flex flex-wrap gap-1.5">{DAY_NAMES.map((d, i) => <Chip key={d} on={days.includes(i)} onPick={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))}>{d}</Chip>)}</div></div>
          <div class="flex flex-col gap-2"><span class="text-[14px] font-semibold text-text">Where do you do strength work?</span>
            <div class="flex flex-wrap gap-1.5">{([["home", "At home"], ["gym", "A gym"], ["both", "Both"]] as const).map(([k, l]) => <Chip key={k} on={place === k} onPick={() => setPlace(k)}>{l}</Chip>)}</div></div>
          {guideWrites && guideOn ? (
            <div class="flex flex-col gap-3"><span class="text-[14px] font-semibold text-text">Three questions about your health</span>
              {SCREEN_QUESTIONS.map((q) => (
                <div class="flex flex-col gap-1.5" key={q.key}>
                  <span class="text-[14px] leading-relaxed text-text">{q.text}</span>
                  {q.help ? <Quiet>{q.help}</Quiet> : null}
                  <div class="flex gap-1.5">{([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => <Chip key={l} on={screen[q.key] === v} onPick={() => { setScreen((s) => ({ ...s, [q.key]: v })); setPreview(false); }}>{l}</Chip>)}</div>
                </div>
              ))}
              {outcome ? <p class="m-0 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] leading-relaxed text-text-2">{SCREEN_WORDS[outcome]}</p> : null}
              <Quiet>The plan's own three questions. The answers are yours alone: no coach, and no model, is shown them.</Quiet>
            </div>
          ) : <Quiet>The three questions about your health come before a plan the Guide writes. A coach writes this one, so they are not asked here.</Quiet>}
          <Quiet>The days and the place are kept with the horizon, for the plan and for your coach. Both can be left empty.</Quiet>
        </Frame>
      ) : null}

      {cardKey === "beside" ? (
        <Frame title="Is anyone, or anything, with you on this?" card={card} needs={needs} hint={besideOptional(facts) ? "Both can be left empty" : "The chart can be left empty"} onBack={back} onNext={next}>
          <div class="flex flex-col gap-2">
            <label class="flex flex-col gap-1"><Eyebrow>A coach · their email</Eyebrow>
              <input type="email" value={coachEmail} autocomplete="off" maxLength={160} placeholder="coach@example.com" onInput={(e) => { setCoachEmail((e.currentTarget as HTMLInputElement).value); setCoachLater(false); }} class={`${inputClass} max-w-[360px]`} /></label>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text">
              {ticksOffered.map((k) => <label class="flex min-h-9 items-center gap-2" key={k}><input type="checkbox" checked={coachScopes.includes(k)} onChange={(e) => { const on = (e.currentTarget as HTMLInputElement).checked; setCoachScopes((x) => (on ? [...x.filter((y) => y !== k), k] : x.filter((y) => y !== k))); }} class="h-4 w-4 accent-accent" />{SCOPE_LABEL[k]}</label>)}
            </div>
            <Quiet>They see what you tick, and nothing else. "Activity and fitness" is what lets them see the horizon. "Diet chart" is off until you tick it.{facts.coach === "self" ? " That email is yours." : ""}</Quiet>
            <Quiet>The invitation is sent when you keep the horizon, not before. They get an email with a link that signs them in, and nothing is shared until they open it. Labs and imaging are not offered here: Settings gives those.</Quiet>
            {facts.coachNeeded && facts.coach === "ok" ? (
              <Quiet>{guideWrites ? "Until they accept, the Guide's draft stands as it is." : "Until they accept, nobody writes the week."}</Quiet>
            ) : facts.coachNeeded ? (
              <div class="flex flex-col gap-2 rounded-[10px] border border-border-strong bg-alt px-4 py-3">
                <span class="text-[13px] leading-relaxed text-text-2">You chose a coach to {guideWrites ? "edit" : "write"} the week, and nobody shares this page yet. Give their email here, or invite them later from Settings. {guideWrites ? "Until they accept, the Guide's draft stands as it is." : "Until they accept, nobody writes the week."}</span>
                <div><Chip on={coachLater && emailIs === "none"} onPick={() => { setCoachLater((v) => !v); setCoachEmail(""); }}>Invite them later, from Settings</Chip></div>
              </div>
            ) : sharing.length ? <Quiet>{sharing.length === 1 ? "One person already shares" : `${sharing.length} people already share`} this page far enough to see a horizon. Settings changes what each of them sees.</Quiet> : null}
          </div>
          <div class="flex flex-col gap-3 border-t border-border pt-4">
            {!chart ? (
              <>
                <button type="button" onClick={() => void addChart()} disabled={chartReading} class="flex flex-col items-center gap-1 rounded-[12px] border-[1.5px] border-dashed border-border-strong bg-alt px-4 py-4 text-center hover:border-accent-border disabled:opacity-60">
                  <span class="text-[14px] font-semibold text-text">{chartReading ? "Reading the chart…" : "Add a diet chart"}</span>
                  <span class="text-[13px] text-text-2">If your dietitian has given you one. A PDF, or a photograph of the page</span>
                </button>
                {chartNote ? <p class="m-0 text-[13px] leading-relaxed text-caution">{chartNote}</p> : null}
                <Quiet>Verve shows a chart as it was written and counts the days you say you followed it. It does not write a chart, grade one or change one.</Quiet>
              </>
            ) : !chart.checked ? (
              <ChartCheck draft={chart.draft} today={today} keepWords="Use this chart" onKeep={(c) => setChart({ draft: chart.draft, checked: c })} onLeave={() => { setChart(null); setChartNote(""); }} key={chart.draft.path} />
            ) : (
              <div class="flex flex-col gap-1.5 rounded-[10px] border border-accent-border bg-accent-fill px-4 py-3">
                <span class="text-[14px] font-semibold text-accent-text">Diet chart · {chart.draft.name}</span>
                <span class="text-[13px] leading-relaxed text-text-2">{chart.checked.written_by ? `${chart.checked.written_by} · ` : ""}given {dayMonthLong(chart.checked.given_on)} · {chart.draft.read.meals.length} {chart.draft.read.meals.length === 1 ? "line" : "lines"}. It joins the horizon when you keep it.</span>
                <div class="flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold"><button type="button" class="text-accent-text hover:text-text" onClick={() => setChart({ draft: chart.draft, checked: null })}>Check it again</button><button type="button" class="text-text-2 hover:text-text" onClick={() => setChart(null)}>Take it off</button></div>
              </div>
            )}
            {chart ? <Quiet>The file is already in Reports, as every upload is. Taking the chart off here leaves it there.</Quiet> : null}
          </div>
          <Quiet>One card for the two things that come from other people. Both can be done later, from the horizon's page and from Settings.</Quiet>
        </Frame>
      ) : null}

      {cardKey === "numbers" ? (
        <>
          <Card accent>
            <div class="flex flex-wrap items-center gap-3"><Button onClick={back}>Back</Button><H2>{draftTitle}</H2></div>
            {!g ? <Quiet>Choose what the horizon is for, on the second card. The goal ticks its markers here.</Quiet> : (
              <div class="flex flex-col">
                {rows.map((r, i) => {
                  const f = field(r.marker), v = num(f.value), lo = num(f.low);
                  const blood = r.def.kind === "blood";
                  const now = nowOf(r.marker), unit = now?.unit ?? r.def.unit;
                  const typical = person ? typicalOf(r.marker, person, today) : null;
                  const held = (r.mode === "floor" || r.mode === "ceiling" || r.mode === "band") && !r.def.standing ? { mode: r.mode, low: lo } : null;
                  // a watched row takes no number: the goal's own can still be given one by ticking it, a blood marker never
                  const noNumber = r.mode === "watch" && (blood || r.added || !f.ticked);
                  // no reading on file, and no typical week to read a weekly number against (board 21): the row says so, and where one is added
                  const noReading = !now && !r.missing && typical == null;
                  const stands = blood ? (now ? `${watchedValue(r.def, now)} ${unit}, report of ${dayMonthLong(now.on)}` : "no report on file holds it yet")
                    : !now ? (typical != null ? `a typical week ${fmtValue(r.def, typical)}` : "no reading yet") : r.def.kind === "weekly" ? `last week ${fmtValue(r.def, now.value)}${typical != null ? ` · a typical week ${fmtValue(r.def, typical)}` : ""}` : `today ${now.display ?? fmtValue(r.def, now.value)}`;
                  // the one sentence a number gets (board 24, "the pace words"): shown under every row that has a number, in quiet type
                  const note = r.missing ? "Nothing is sending this reading from your devices, so it could not be followed. Settings › Devices says why."
                    : blood ? "Watched only: shown with its date, and never given a number, a pace or a place in the Guide's words."
                    : noNumber ? (r.added ? "Watched: shown, not judged." : watchOn ? "Watched: shown, not judged. Tick it only if you want a number on it." : "Watched: no number is needed. Tick it only if you want one.")
                    : !f.ticked ? ""
                    : v == null ? ""
                    : noReading ? "No reading yet, so no pace can be read. Your number is kept. The pace starts from the first reading that arrives."
                    : r.marker === "weight" && r.mode === "reach" && now && weeks ? weightPace(now.value, v, weeks).words
                    : person ? impliedPace(r.def, now, v, Math.max(1, weeks), historyOf(r.marker, person, today), today, r.def.standing || r.mode === "floor" ? weeklyHistory(person, r.marker, today, 13) : undefined, typical, held as any) : "";
                  const sub = [blood ? "blood" : "", r.added ? "added by you" : "", r.mode === "reach" ? (r.added ? "reach" : "") : blood ? "watched only" : HELD_WORDS[r.mode]].filter(Boolean).join(" · ");
                  return (
                    <div class={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2.5 md:grid-cols-[auto_minmax(0,1.1fr)_auto_minmax(0,1.5fr)] ${i ? "border-t border-border" : ""}`} key={r.marker}>
                      {r.added
                        ? <input type="checkbox" checked onChange={() => dropMarker(r.marker)} aria-label={`${r.def.label}: take it off the draft`} class="h-5 w-5 accent-accent" />
                        : <input type="checkbox" checked={f.ticked} disabled={r.missing} onChange={(e) => setField(r.marker, { ticked: (e.currentTarget as HTMLInputElement).checked })} aria-label={r.def.label} class="h-5 w-5 accent-accent" />}
                      <span class="text-[15px] text-text">{r.def.label}{sub ? <span class="block font-mono text-[11px] text-text-3">{sub}</span> : null}</span>
                      <span class="col-start-2 flex items-center gap-1.5 md:col-start-auto">
                        {noNumber ? <span class="inline-flex min-h-10 w-28 items-center justify-center rounded-[10px] border border-dashed border-border-strong font-mono text-[11px] font-medium text-text-3">no number</span> : (
                          <>
                            {r.mode === "band" ? <><input type="number" step={10 ** -r.def.decimals} value={f.low} placeholder="between" disabled={!f.ticked} onInput={(e) => setField(r.marker, { low: (e.currentTarget as HTMLInputElement).value })} aria-label={`${r.def.label}: the lower end`} class={`${inputClass} w-28 font-mono`} /><span class="text-[12px] text-text-3">and</span></> : null}
                            <input type="number" step={10 ** -r.def.decimals} value={f.value} placeholder={r.mode === "band" ? "and" : MODE_WORDS[r.mode === "watch" ? "reach" : r.mode]} disabled={!f.ticked} onInput={(e) => setField(r.marker, { value: (e.currentTarget as HTMLInputElement).value })} aria-label={`${r.def.label}: ${r.mode === "band" ? "the upper end" : "the number you want"}`} class={`${inputClass} w-28 font-mono`} />
                          </>
                        )}
                      </span>
                      <span class="col-start-2 flex flex-wrap items-baseline gap-x-3 text-[12px] text-text-3 md:col-start-auto">
                        <span>{blood ? stands : <><span class="font-mono text-[11px]">{unit}</span> · {stands}</>}</span>
                        {r.added && !blood && waysFor(r.marker, addRules).length > 1 ? <button type="button" class="font-semibold text-accent-text hover:text-text" onClick={() => { setCurrent(r.marker); setAdding(true); }}>Change</button> : null}
                        {r.added ? <button type="button" class="font-semibold text-text-2 hover:text-text" onClick={() => dropMarker(r.marker)}>Take it off</button> : null}
                      </span>
                      {note || (r.marker === "mets" && person && f.ticked && !noNumber) ? <span class="col-span-2 text-[12px] leading-relaxed text-text-2 md:col-span-4 md:pl-8">{note}{r.marker === "mets" && person && f.ticked && !noNumber ? ` ${vo2Line(person, today, v, method && now ? now.value : null)}` : ""}</span> : null}
                      {noReading && (f.ticked || noNumber) ? <div class="col-span-2 md:col-span-4 md:pl-8"><WhereLine doors={doorsFor(r.marker, who)} /></div> : null}
                      {r.marker === "mets" && f.ticked && !noNumber && person ? (
                        <>
                          <FitnessChooser person={person} method={method} onPick={(family) => { setMethod(family); setPreview(false); }} />
                          {v != null && now && Math.abs(v - now.value) < now.value * FITNESS_RULES.noChangeShare ? <div class="col-span-2 md:col-span-4 md:pl-8"><Quiet>Your number is inside the 5% two tests of one person differ by with nothing changed. A test at your number will not be called reached.</Quiet></div> : null}
                          {v != null && now && method === "watch" && Math.abs(v - now.value) < now.value * 0.13 ? <div class="col-span-2 md:col-span-4 md:pl-8"><Quiet>Your number is a smaller move than a watch's estimate can be off by. A walk or a run at the start and on the date can show it.</Quiet></div> : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3">
                  <Button onClick={() => { setCurrent(null); setAdding(true); }}>Add a marker</Button>
                  <Button onClick={() => setStudies(true)}>What the studies say</Button>
                  <span class="text-[12px] leading-relaxed text-text-3">The goal ticked {goalTicked}.{addedRows.length ? ` You added ${addedRows.length}.` : ""} Every field is empty until you type in it.</span>
                </div>
              </div>
            )}
            {firstWeek ? (
              <div class="flex flex-col gap-3 rounded-[12px] border border-accent-border bg-accent-fill p-4">
                <div class="font-mono text-[11px] font-medium text-accent-text">The first week, from this draft · nothing is kept yet</div>
                <p class="m-0 text-[14px] leading-relaxed text-text">{firstWeek.lead}</p>
                <div class="grid grid-cols-2 gap-2 md:grid-cols-4">{firstWeek.tiles.map((t) => <div class="flex flex-col gap-0.5 rounded-[10px] border border-accent-border bg-card p-3" key={t.key}><span class="font-mono text-[10px] text-text-3">{t.small}</span><span class="t-figure-row font-semibold text-text">{t.big}</span><span class="text-[12px] leading-relaxed text-text-2">{t.text}</span></div>)}</div>
              </div>
            ) : preview && guideWrites && outcome === "none" ? <Quiet>{SCREEN_WORDS.none}</Quiet> : preview && !guideWrites ? <Quiet>Your coach writes the week once the horizon is kept. They see these numbers and the notes under them.</Quiet> : null}
            {watching().length || chart?.checked || facts.coach === "ok" ? (
              <div class="flex flex-col gap-1 border-t border-border pt-3">
                <Eyebrow>Kept with it, on the same press</Eyebrow>
                {watching().length ? <span class="text-[13px] leading-relaxed text-text-2">Watched, with no number: {watching().map((r) => r.def.label).join(", ")}.</span> : null}
                {chart?.checked ? <span class="text-[13px] leading-relaxed text-text-2">A diet chart, given {dayMonthLong(chart.checked.given_on)}.</span> : null}
                {/* an email leaves this page for someone else: it is named before the press, with a way to drop it (in the recording a made-up address became a real invitation) */}
                {facts.coach === "ok" ? <span class="text-[13px] leading-relaxed text-text"><b class="font-semibold">An email will go to {coachEmail.trim().toLowerCase()}</b> when you keep this horizon. They are offered: {scopesSent.map((k) => SCOPE_LABEL[k]).join(", ")}. <button type="button" class="font-semibold text-accent-text hover:text-text" onClick={() => { setCoachEmail(""); if (facts.coachNeeded) setCoachLater(true); }}>Do not send it</button></span> : null}
              </div>
            ) : null}
          </Card>

          {!busy ? <OfferAtSetup sb={sb} startsOn={today} endsOn={endsOn || null} /> : null}
          {problem && <div class="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-caution/40 bg-alt px-4 py-3 text-[13px] text-caution"><span>{problem.why}</span>{problem.card !== card ? <button type="button" class="min-h-8 font-semibold text-text hover:text-accent-text" onClick={() => { const c = problem.card; setProblem(null); goCard(c); }}>Open that card</button> : null}</div>}
          {busy ? (
            // what the press is doing, said where the button was, each line ticked as it is done
            <div class="flex flex-col gap-1.5 rounded-[12px] border border-accent-border bg-card px-4 py-3" role="status" aria-live="polite">
              {["Keeping your horizon", "Your numbers, the plan and what goes with it", "Opening your horizon"].map((words, i) => (
                <div class={`flex items-center gap-2.5 text-[13.5px] ${i > keepStep ? "text-text-3" : "text-text"}`} key={words}>
                  <span class={`inline-block h-3.5 w-3.5 rounded-full border ${i < keepStep ? "border-accent bg-accent" : i === keepStep ? "border-accent ring-2 ring-accent-fill" : "border-border-strong"}`} aria-hidden="true" />{words}{i < keepStep ? <span class="sr-only"> · done</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <div class="flex flex-wrap items-center gap-3">
              <Button onClick={() => { const why = check(); setProblem(why); setPreview(!why); }}>See the first week</Button>
              <Button type="submit" primary>Keep this horizon</Button>
              <Button onClick={leave}>Cancel</Button>
              <span class="ml-auto text-[12px] text-text-3">{access && !access.pro && access.free.available ? "Free for one week, then Pro. The horizon and your readings stay." : "Stop it any time, the readings stay"}</span>
            </div>
          )}
          <Quiet>The first week is shown before anything is kept, so the decision is made looking at the plan.</Quiet>

          {/* the picker, as a sheet over the page: the rows and Keep stay where they were (board 23) */}
          {adding && g ? (
            <Sheet title="Add a marker" kicker={`${g.title} · beside the goal's own`} wide onClose={() => setAdding(false)}>
              <AddMarkerPanel bare taken={goalRows.map((r) => r.marker)} added={addedRows.map((r) => ({ marker: r.marker, mode: r.mode }))} canFollow={(m) => followable(off, m)} rules={addRules} current={current} hint={chipHint} onPick={addMarker} onDrop={dropMarker} onMode={holdMarker} onClose={() => setAdding(false)} />
              <div class="flex flex-wrap items-center gap-3"><Button primary onClick={() => setAdding(false)}>Done</Button><span class="text-[12px] text-text-3">A marker you add has no study beside it unless the page holds one for it.</span></div>
            </Sheet>
          ) : null}
          {/* the studies, read in a sheet and closed by its cross: off the page until asked for (the founder, 18 November 2026) */}
          {studies && g ? (
            <Sheet title="What the studies say" kicker={g.title} onClose={() => setStudies(false)}>
              <div class="flex flex-col gap-3">
                {g.evidence.map((l) => <Evidence line={l} key={l.text} />)}
                {rows.some((r) => r.marker === "grip") ? <Evidence line={GRIP.moves} /> : null}
              </div>
              <div class="flex flex-col gap-2 border-t border-border pt-4">
                <Eyebrow>What the plan does</Eyebrow>
                <p class="m-0 text-[14px] leading-relaxed text-text">{g.plan}</p>
              </div>
              <Quiet>{TEMPLATE_KEEPS}</Quiet>
              <Quiet>These figures were read from the papers' abstracts on 15 November 2026 and are shown to test accounts only.</Quiet>
            </Sheet>
          ) : null}
        </>
      ) : (
        <div class="flex flex-wrap items-center gap-3"><button type="button" onClick={leave} class="min-h-8 text-[13px] font-semibold text-text-2 hover:text-text">Leave the set-up</button><span class="text-[12px] text-text-3">Your answers are dropped, and nothing was kept.</span></div>
      )}
    </form>
  );
}

// ── above the numbers: the goal, and the person's own words ──

export function ProgrammeLine({ programme }: { programme: Programme }) {
  const g = GOAL_BY_KEY[programme.goal];
  const days = programme.days.map((d) => DAY_NAMES[d]).join(", ");
  const bits = [g ? g.title : "", days ? `Training days: ${days}` : "", programme.place ? `Strength ${programme.place === "home" ? "at home" : programme.place === "gym" ? "at a gym" : "at home and at a gym"}` : "",
    programme.writer === "coach" ? "A coach writes the plan" : programme.writer === "both" ? "The Guide drafts, a coach edits" : ""].filter(Boolean);
  if (!bits.length && !programme.aims.length) return null;
  return (
    <div class="flex flex-col gap-1">
      {programme.aims.length > 0 && <p class="m-0 text-[15px] leading-relaxed text-text">{programme.aims.map((a) => `"${a}"`).join(" · ")}</p>}
      {bits.length > 0 && <p class="m-0 font-mono text-[11px] font-medium text-text-3">{bits.join(" · ")}</p>}
    </div>
  );
}

// ── weight, read safely (board 07) ──

export function WeightCard({ h, targets, person, today, programme, chartLine }: { h: HorizonFull; targets: Target[]; person: PersonData; today: string; programme: Programme | null;
  /** The diet chart's count for the week so far, in its own sentence (board 17): shown under the three signs, and joined to none of them. */ chartLine?: string | null }) {
  const t = targets.find((x) => x.marker === "weight" && !x.mode);
  if (!t || t.start_value == null) return null;
  const weeks = Math.max(1, Math.ceil(daysBetween(t.start_on ?? h.starts_on, h.ends_on) / 7));
  const pace = weightPace(t.start_value, t.target_value, weeks);
  if (pace.read === "none") return null;
  const signs = threeSigns(h, targets, person, today);
  const caution = pace.read === "faster" || pace.read === "steep";
  return (
    <Card id="horizon-weight">
      <div class="flex flex-wrap items-baseline justify-between gap-3"><H2>Weight, read as a pace</H2><span class="text-[12px] text-text-3">The number is yours. The page says what pace it implies.</span></div>
      <p class={`m-0 rounded-[12px] border px-4 py-3 text-[14px] leading-relaxed text-text ${caution ? "border-caution/40 bg-alt" : "border-accent-border bg-accent-fill"}`}>{pace.words}</p>
      {pace.read !== "gain" ? (
        <div class="flex flex-col gap-1.5" aria-hidden="true">
          <div class="relative mt-5 h-3 rounded-full border border-border bg-alt">
            <div class="absolute bottom-0 top-0 bg-accent-border" style={{ left: `${(WEIGHT.weeklyLow / WEIGHT.steep) * 100}%`, width: `${((WEIGHT.weeklyHigh - WEIGHT.weeklyLow) / WEIGHT.steep) * 100}%` }} />
            <div class="absolute top-[-6px] h-6 w-0.5 bg-text" style={{ left: `${pace.mark * 100}%` }} />
            <span class="absolute top-[-22px] whitespace-nowrap font-mono text-[10px] font-semibold text-text" style={{ left: `${pace.mark * 100}%`, transform: `translateX(${pace.mark > 0.85 ? "-100%" : pace.mark < 0.15 ? "0" : "-50%"})` }}>yours · {round(pace.perWeek, 2).toFixed(2)}</span>
          </div>
          <div class="flex justify-between font-mono text-[10px] text-text-3"><span>0</span><span>{WEIGHT.weeklyLow}</span><span>{WEIGHT.weeklyHigh.toFixed(1)}</span><span>{WEIGHT.steep} kg a week</span></div>
        </div>
      ) : null}
      <Evidence line={{ text: `The shaded stretch is ${WEIGHT.weeklyLow} to ${WEIGHT.weeklyHigh} kg a week, the one weekly figure a guideline states. Above ${WEIGHT.steep} kg a week the risk of gallstones climbs steeply.`, cites: [WEIGHT.cites.share, WEIGHT.cites.weekly, WEIGHT.cites.steep] }} />

      <div class="mt-1 text-[15px] font-semibold text-text">Fat or muscle: three signs, side by side</div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        {signs.signs.map((s, i) => (
          <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-alt p-4" key={s.key}>
            <Eyebrow>{i + 1} · {s.title}</Eyebrow>
            <span class="t-figure-row font-semibold text-text">{s.figure}</span>
            <p class="m-0 text-[13px] leading-relaxed text-text-2">{s.words}</p>
            <span class="font-mono text-[11px] text-text-3">{s.cites.map((c, j) => { const u = doiUrl(c); return <span key={c}>{j ? " · " : ""}{u ? <a href={u} target="_blank" rel="noopener" class="underline-offset-2 hover:underline">{c}</a> : c}</span>; })}</span>
          </div>
        ))}
      </div>
      <p class="m-0 rounded-[12px] border border-border-strong bg-card px-4 py-3 text-[15px] leading-relaxed text-text">{signs.read}</p>
      {chartLine ? <p class="m-0 text-[14px] leading-relaxed text-text-2"><span class="font-mono text-[11px] font-medium uppercase tracking-wider text-text-3">The chart</span> · {chartLine} It is shown beside the three signs, and is not read as the cause of any of them.</p> : null}
      <Quiet>{signs.stops} The page writes no diet.</Quiet>
      {programme?.goal === "lose_weight" ? <Evidence line={{ text: `On the date, the next horizon offered is "Hold what I have". ${WEIGHT.after.text}`, cites: WEIGHT.after.cites }} /> : null}
      <Quiet>Read from the papers' abstracts on 15 November 2026. Shown to test accounts only.</Quiet>
    </Card>
  );
}

// ── the week with a coach (board 08) ──

const callWords = (iso: string | null) => { if (!iso) return "No time set"; const d = new Date(iso); return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`; };
const localInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export function CallCard({ sb, h, targets, person, today, owner, closed, tester, programme, planRows, guideOn, userId, setNotice, pause, pausing, onSetAside, chartLine }: {
  sb: SupabaseClient; h: HorizonFull; targets: Target[]; person: PersonData | null; today: string; owner: boolean; closed: boolean;
  /** A test account may write the coach's side of its own horizon, so the sheet can be tried by one person. */
  tester: boolean; programme: Programme; planRows: PlanRow[]; guideOn: boolean;
  userId: () => Promise<string | null>; setNotice: (s: string) => void;
  /** The diet chart's count for last week, in its own sentence, when a chart is kept and this viewer may read it (board 17). */
  chartLine?: string | null;
  /** The horizon's pauses (../horizon/pause.ts), when its owner may use one; null for a coach and for an account it is not offered to. */
  pause?: PauseState | null; pausing?: boolean;
  /** The owner sets last week aside (board 13, A): the page asks, then the function writes it. */
  onSetAside?: (c: PauseChoice) => void;
}) {
  const [notes, setNotes] = useState<WeekNote[] | null>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => setNotes(await listWeekNotes(sb, h.id));
  useEffect(() => { void load(); }, [h.id]);

  const { thisWeek, lastWeek } = sheetWeeks(h, today);
  const stored: GuideStored | null = guideOn && h.plan?.author === "guide" && isGuideStored(h.plan?.guide) ? (h.plan!.guide as GuideStored) : null;
  const view = useMemo(() => { try { return stored && person ? guidePlan({ horizon: h, targets, person, today, stored, self: owner }) : null; } catch { return null; } }, [stored, person, today, h.id]);
  if (!thisWeek) return null;
  const cur = notes ? noteFor(notes, thisWeek.from) : null;
  const prev = notes && lastWeek ? noteFor(notes, lastWeek.from) : null;
  const coachSide = !owner || tester;
  const kept = notes ? callsKept(notes, h, today) : null;
  const review = view?.review ?? null;
  // a paused week is shown and not judged: no line of it is read, nothing is asked about it
  const judged = lastWeek && !lastWeek.paused ? lastWeek : null;
  const adherence = !review && person && judged && planRows.length ? adherenceOf(planRows, person, judged.from, judged.to, h.starts_on) : [];
  const moves = person && judged ? weekMoves(targets, h, person, judged.from, today) : [];
  const short = !judged ? false : review ? review.lines.some((l) => l.state === "short") : adherence.some((a) => a.tone === "caution");
  // the week just ended can still be set aside, until this Sunday (board 13, A)
  const back = owner && !closed && judged ? pause?.choices.find((c) => c.key === "last" && c.ok && c.monday === judged.from) ?? null : null;

  async function write(weekStart: string, patch: Parameters<typeof saveWeekNote>[3]) {
    const uid = await userId();
    if (!uid) { setNotice("Sign in again to continue."); return; }
    setBusy(true);
    const err = await saveWeekNote(sb, h.id, weekStart, patch, uid);
    setBusy(false);
    if (err) setNotice(`Could not keep that: ${err}`); else await load();
  }
  const editing = lines ?? cur?.lines ?? [];

  return (
    <Card id="horizon-call" accent>
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <div class="flex flex-col gap-1"><Eyebrow>The call sheet · {thisWeek.paused ? "paused this week" : thisWeek.n ? `week ${thisWeek.n}` : "a short week"} · {thisWeek.words}</Eyebrow><H2>The week with a coach</H2></div>
        <span class="font-mono text-[12px] font-medium text-text-2">{thisWeek.paused ? "No call: this week is paused" : cur?.call_at ? `Call · ${callWords(cur.call_at)}` : "No call set this week"}{kept && kept.of ? ` · calls kept ${kept.kept} of ${kept.of}` : ""}</span>
      </div>
      <Quiet>One sheet both of you see. On Monday the Guide writes; then a person calls. The call is not recorded, and three lines are kept after it.</Quiet>

      <Eyebrow>Last week against the plan{lastWeek ? ` · ${lastWeek.words}` : ""}</Eyebrow>
      {!lastWeek ? <Quiet>No full week of this horizon has ended yet.</Quiet>
        : lastWeek.paused ? <p class="m-0 text-[14px] leading-relaxed text-text-2">Paused. The plan holds where it was, and the week is not judged.</p>
        : review ? <div class="flex flex-col">{review.lines.map((l) => <div class="grid grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,.7fr))_minmax(0,1.2fr)] items-baseline gap-3 border-t border-border py-2 first:border-t-0" key={l.key}><span class="text-[14px] text-text">{l.label}</span><span class="text-right font-mono text-[13px] text-text-3">{l.plan}</span><span class="text-right font-mono text-[14px] font-semibold text-text">{l.done}</span><span class={`text-[12px] ${l.state === "short" ? "text-caution" : "text-text-2"}`}>{l.word}</span></div>)}</div>
        : adherence.length ? <div class="flex flex-col">{adherence.map((a, i) => <div class="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-baseline gap-3 border-t border-border py-2 first:border-t-0" key={i}><span class="text-[14px] text-text">{a.label}</span><span class="text-right font-mono text-[13px] text-text">{a.done != null && a.of != null ? `${a.done} of ${a.of}` : ""}</span><span class={`text-[12px] ${a.tone === "caution" ? "text-caution" : "text-text-2"}`}>{a.word}</span></div>)}</div>
        : <Quiet>No plan was on file for that week.</Quiet>}
      {chartLine && lastWeek && !lastWeek.paused ? <p class="m-0 text-[14px] leading-relaxed text-text-2"><span class="font-mono text-[11px] font-medium uppercase tracking-wider text-text-3">The diet chart</span> · {chartLine} It is a count of days, and is not read as the cause of anything above.</p> : null}

      {judged && (short || prev?.way) ? (
        <div class="flex flex-col gap-2">
          <Eyebrow>What got in the way · {owner ? "your answer" : "their answer"}</Eyebrow>
          <div class="flex flex-wrap gap-1.5">{WAYS.map((w) => <Chip key={w.key} on={prev?.way === w.key} disabled={!owner || closed || busy} onPick={owner && !closed ? () => void write(judged.from, { way: prev?.way === w.key ? null : w.key }) : undefined}>{w.label}</Chip>)}</div>
          {back && onSetAside ? (
            <div class="flex flex-col gap-1.5">
              <div><Button disabled={!!pausing} onClick={() => onSetAside(back)}>{pausing ? "Pausing…" : "Set last week aside"}</Button></div>
              <span class="text-[13px] leading-relaxed text-text-2">Uses {pause!.allowed === 1 ? "this horizon's pause" : "one of this horizon's pauses"}. {pause!.moves ? `Your date moves to ${new Date(back.ends_on + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "")}.` : "Your date stays where it is."} It can be done until Sunday night.</span>
            </div>
          ) : null}
          <Quiet>Asked only when a line was not done. The answer is a note for the call, and changes nothing about how the week is read.</Quiet>
        </div>
      ) : null}

      {moves.length > 0 && (
        <div class="flex flex-col gap-2">
          <Eyebrow>What moved against the targets</Eyebrow>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-3">{moves.slice(0, 6).map((m) => <div class="flex flex-col gap-0.5 rounded-[10px] border border-border bg-alt p-3" key={m.marker}><span class="t-figure-row font-semibold text-text">{m.before && m.after && m.fresh ? `${m.before} → ${m.after}` : m.after ?? m.before ?? "—"}{m.unit ? <span class="ml-1 font-mono text-[11px] font-medium text-text-3">{m.unit}</span> : null}</span><span class="text-[12px] leading-relaxed text-text-2">{m.label}. {m.fresh ? m.pace_word : "No new reading."}</span></div>)}</div>
        </div>
      )}

      <Eyebrow>This week asks</Eyebrow>
      {thisWeek.paused ? <Quiet>Nothing. This week is paused{view?.paused ? `, and week ${view.week} starts on Monday ${dayMonthLong(view.paused.resumes)}` : ""}.</Quiet>
        : view ? <div class="grid grid-cols-2 gap-2 md:grid-cols-4">{view.tiles.map((t) => <div class="flex flex-col gap-0.5 rounded-[10px] border border-border bg-alt p-3" key={t.key}><span class="font-mono text-[10px] text-text-3">{t.small}</span><span class="t-figure-row font-semibold text-text">{t.big}</span></div>)}</div>
        : planRows.length ? <div class="flex flex-col gap-1">{planRows.map((r, i) => <span class="text-[14px] text-text" key={i}>{r.label}</span>)}</div>
        : <Quiet>{owner ? "Your coach has not written the week yet." : "No plan on file. Write the week in the plan above."}</Quiet>}

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <Eyebrow>The call this week</Eyebrow>
          {thisWeek.paused ? <span class="text-[14px] text-text-2">No call this week. A paused week is not counted.</span> : closed ? <span class="text-[14px] text-text-2">{callWords(cur?.call_at ?? null)}</span> : (
            <label class="flex flex-wrap items-center gap-2 text-[13px] text-text-2">
              <input type="datetime-local" value={localInput(cur?.call_at ?? null)} disabled={busy} onChange={(e) => { const v = (e.currentTarget as HTMLInputElement).value; void write(thisWeek.from, { call_at: v ? new Date(v).toISOString() : null }); }} class={`${inputClass} font-mono text-[13px]`} aria-label="The time of this week's call" />
              <span>Either of you can set it. About twenty minutes.</span>
            </label>
          )}
          <label class="flex items-center gap-2 text-[14px] text-text">
            <input type="checkbox" checked={cur?.call_kept === true} disabled={!coachSide || closed || busy || thisWeek.paused} onChange={(e) => void write(thisWeek.from, { call_kept: (e.currentTarget as HTMLInputElement).checked })} class="h-5 w-5 accent-accent" />
            <span>The call was kept</span>
          </label>
          <Quiet>The coach marks it. Kept calls are counted, and nothing else about a call is scored.</Quiet>
        </div>
        <div class="flex flex-col gap-2">
          <Eyebrow>Kept after the call · written by the coach, read by both</Eyebrow>
          {coachSide && !closed ? (
            <>
              {[0, 1, 2].map((i) => <input type="text" key={i} maxLength={160} value={editing[i] ?? ""} placeholder={["What changes this week", "What stays as it is", "The next call"][i]} onInput={(e) => { const next = [0, 1, 2].map((j) => (j === i ? (e.currentTarget as HTMLInputElement).value : editing[j] ?? "")); setLines(next); }} class={`${inputClass} text-[14px]`} aria-label={`Line ${i + 1} kept after the call`} />)}
              <div><Button disabled={busy || lines == null} onClick={async () => { const uid = await userId(); const clean = (lines ?? []).map((l) => l.trim()).filter(Boolean).slice(0, 3); await write(thisWeek.from, { lines: clean, lines_by: uid }); setLines(null); }}>{busy ? "Keeping…" : "Keep the three lines"}</Button></div>
            </>
          ) : (cur?.lines ?? []).length ? <div class="flex flex-col gap-1 rounded-[10px] border border-border-strong bg-alt px-4 py-3">{cur!.lines.map((l, i) => <span class="text-[14px] leading-relaxed text-text" key={i}>{l}</span>)}</div> : <Quiet>Nothing kept for this week yet.</Quiet>}
          {owner && tester ? <Quiet>Test account: you can write the coach's side of your own horizon here.</Quiet> : null}
        </div>
      </div>

      <details class="text-[13px] text-text-2">
        <summary class="cursor-pointer text-text-3">What a coach can do here</summary>
        <div class="mt-2 flex flex-col gap-1">
          {([[true, "Read the page you chose to share, and this sheet."], [true, "Change the plan's lines. Each change is marked as theirs."], [true, "Write the three lines, and mark the call as kept."], [false, "Set or change a target. They can suggest a number. You type it."], [false, "See your three health answers or your medicines. Those never leave your own page."]] as const)
            .map(([yes, text]) => <div class="grid grid-cols-[28px_minmax(0,1fr)] gap-2" key={text}><span class="font-mono font-semibold text-text">{yes ? "Yes" : "No"}</span><span>{text}</span></div>)}
        </div>
      </details>
      <Quiet>{programme.writer === "guide" ? "This horizon's plan is the Guide's. A coach you share your page with sees this sheet too." : "Food is your coach's own advice, spoken on the call. This page writes no diet."}</Quiet>
    </Card>
  );
}

// ── the trainer's Monday list (board 11): the clients who share a programme horizon, one row each ──

type ListClient = { id: string; name: string };
const listClients = signal<ListClient[]>([]);
type ListRow = MondayRow & { person: ListClient; horizonId: string };

function MondayList({ sb, open }: { sb: SupabaseClient; open: (personId: string) => void }) {
  const clients = listClients.value;
  const [rows, setRows] = useState<ListRow[]>([]);
  useEffect(() => {
    let on = true;
    (async () => {
      if (!clients.length) { setRows([]); return; }
      const today = new Date().toLocaleDateString("en-CA");
      // only what each person shares is readable here: row-level security answers for it
      // (every column, so a paused week is read here as the client's page reads it, and a column a later file brings is not asked for by name)
      const { data: hs } = await sb.from("horizons").select("*").in("person_id", clients.map((c) => c.id)).is("closed_at", null);
      const mine = ((hs ?? []) as any[]).filter((h) => parseProgramme(h.programme));
      if (!mine.length) { if (on) setRows([]); return; }
      const ids = mine.map((h) => h.id);
      const [w, c] = await Promise.all([
        sb.from("horizon_weeks").select("horizon_id, week_start, way, away, call_at, call_kept, lines, lines_by").in("horizon_id", ids),
        sb.from("horizon_checkins").select("horizon_id, kind, for_date, pace").in("horizon_id", ids).eq("kind", "week").order("for_date", { ascending: false }),
      ]);
      const out = mine.flatMap((h): ListRow[] => {
        const person = clients.find((x) => x.id === h.person_id);
        if (!person) return [];
        const notes = ((w.data ?? []) as any[]).filter((n) => n.horizon_id === h.id).map((n) => ({ ...n, week_start: String(n.week_start).slice(0, 10), lines: Array.isArray(n.lines) ? n.lines : [] })) as WeekNote[];
        const latest = ((c.data ?? []) as any[]).find((x) => x.horizon_id === h.id);
        return [{ ...mondayRow(h, notes, latest ? (latest.pace?.adherence ?? []) : null, today), person, horizonId: h.id }];
      }).sort((a, b) => Number(b.today) - Number(a.today) || a.person.name.localeCompare(b.person.name));
      if (on) setRows(out);
    })().catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [clients.map((c) => c.id).join(",")]);
  if (!rows.length) return null;
  return (
    <Card>
      <div class="flex flex-wrap items-baseline justify-between gap-3"><H2>This week's horizons</H2><span class="text-[12px] text-text-3">The people who share a horizon with you. Each row opens their call sheet.</span></div>
      <div class="flex flex-col">
        <div class="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] gap-3 border-b border-border pb-2 font-mono text-[11px] text-text-3 md:grid"><span>Client</span><span>Horizon</span><span>Last week</span><span>Call</span></div>
        {rows.map((r) => (
          <button type="button" key={r.horizonId} onClick={() => open(r.person.id)} class="grid grid-cols-2 items-baseline gap-x-3 gap-y-1 border-b border-border py-3 text-left last:border-b-0 hover:bg-alt md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]">
            <span class="text-[15px] font-semibold text-text">{r.person.name}</span>
            <span class="font-mono text-[12px] text-text-2">{r.horizon}</span>
            <span class="font-mono text-[12px] text-text-2">{r.lastWeek}</span>
            <span class={`text-[13px] font-semibold ${r.today ? "text-accent-text" : "text-text-2"}`}>{r.call}</span>
          </button>
        ))}
      </div>
      <Quiet>You see only people who shared their page with you, and only what each chose to share.</Quiet>
    </Card>
  );
}
/** The list's mount, for the group page: `refresh` with the clients in view; it draws nothing when none of them shares a programme horizon. */
export function mountMondayList(root: HTMLElement, deps: { supabase: SupabaseClient; open: (personId: string) => void }): { refresh: (clients: ListClient[]) => void } {
  render(<MondayList sb={deps.supabase} open={deps.open} />, root);
  return { refresh: (clients) => { listClients.value = clients; } };
}

/** A fitness or grip row's own lines on the targets table: the method it is kept to, how far off that can be, and a newer reading by another method. */
export function holdNotes(p: { marker: string; method?: string | null; other?: { method: string | null; on: string; text: string } | null; mode?: string | null }): string[] {
  const out: string[] = [];
  if (p.marker === "mets" && p.method) {
    out.push(`Kept to one method: ${doorLine(p.method) || methodLabel(p.method)}. Under 5% from the start is not a change.`);
    if (p.other) { const d = doorOfMethod(p.other.method); out.push(`A newer reading by another method is on file: ${p.other.text} on ${dayMonthLong(p.other.on)}${d ? `, ${DOOR_BY_KEY[d].title.replace(/^./, (c) => c.toLowerCase())}` : p.other.method ? `, ${methodLabel(p.other.method)}` : ""}. It is shown and not compared with the start.`); }
  }
  if (p.marker === "grip") out.push(`A number to hold. A move under ${GRIP.noChangeKg} kg reads as no change: two readings of one person differ by that much.`);
  return out;
}
export { parseProgramme, BARRIERS };
export type { Programme, Mode, MarkerDef };
