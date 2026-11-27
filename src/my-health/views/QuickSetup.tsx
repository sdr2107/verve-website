/**
 * "Set a horizon", made short (the founder, 27 November 2026: "Horizon targets will be - 1. Strength minutes and
 * sessions, 2. steps, 3. zone 2 minutes, 4. weekly MET-min dose and 5. fitness in METs. these 5 should be in the
 * horizon as default"; and of the page as a whole: "i do not know what to click first and where to go next").
 *
 * One screen: how long, the five numbers already filled in and theirs to change (../horizon/defaults.ts says where
 * each comes from), the three questions about health, and Start. Everything else the set-up offers (the other goals,
 * a day to be ready for, a coach, a diet chart, a marker to watch) is one link away, "More choices", and is the
 * set-up of 18 November as it was (./Programme.tsx ProgrammeSetup).
 *
 * WHAT IS KEPT is what that set-up keeps for "Build fitness" with the Guide writing the plan, by the same calls in
 * the same order: the horizon and its targets (the function's `start`), then the programme, the method the fitness
 * number is kept to, the three answers and the Guide's plan. The three questions stay: they decide whether a plan is
 * offered at all and whether it carries harder minutes (the ACSM's screening of 2015; guidePlan.ts).
 *
 * ONE MORE LINE, the same day (the founder: "Yes, ticked"): "Email me my week on Mondays", ticked. The set-up left
 * both email switches off, so a new member who set a horizon had no Monday email at all. The line is shown only to
 * someone whose "Your week" is off; ticked at Start it turns that one switch on (accountApi.ts saveWeekly, the same
 * call Settings makes), with the browser's zone. It is their own tick to take off, and every email has a way out.
 *
 * AND THE LOCKS (the founder, the same day: "6 months and 12 months should be locked with a lock sign for skool
 * founders - that opens up after the 12 weeks and once they pay monthly subscription"). For a founding member three
 * months is the choice: the two longer lengths are drawn with a lock, cannot be chosen, and one line under them says
 * when they open (../horizon/member.ts). No price and no link: there is no way to pay yet. "More choices" is not
 * drawn for them either: it leads to the set-up of 18 November. The horizon function refuses a longer one as well.
 */
import { useEffect, useMemo, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { arrivalsOf, followable, leftOff } from "../derive/arrivals.ts";
import { FEWEST_AEROBIC_DAYS, GOAL_BY_KEY } from "../../data/programme.ts";
import { daysBetween } from "../derive/format.ts";
import { MARKER_BY_KEY, addMonths, dayMonthYear, fitnessBy, latestOf, round, type MarkerKey, type Reading } from "../horizon/derive.ts";
import { defaultTargets, type DefaultKey, type DefaultRow } from "../horizon/defaults.ts";
import { guidePlan, rowsWith, screenOutcome, storeOf, SCREEN_QUESTIONS, SCREEN_WORDS, type ScreenAnswers } from "../horizon/guidePlan.ts";
import { startingMethod, type Programme } from "../horizon/programme.ts";
import { clearSetup } from "../horizon/setupCards.ts";
import { startHorizon, saveProgramme, setTargetHold, saveScreen, saveGuidePlan, forgetAccess, ERROR_WORDS, type ApiError, type StartTarget } from "../horizon/api.ts";
import { clearWayIn, readWayIn } from "./Programme.tsx";
import { loadWeekly, saveWeekly } from "../accountApi.ts";
import { LENGTH_LOCKED_LINE, SETUP_MORE_CHOICES, lengthLocked } from "../horizon/member.ts";
import type { WeeklyState } from "../account.ts";

const GOAL = "build_fitness" as const;
const LENGTHS = [3, 6, 12] as const;
type Length = (typeof LENGTHS)[number];
const browserZone = (): string | null => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };
const numOf = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) > 0 ? Number(s) : null);
const small = "m-0 text-[13px] font-medium text-text-2";
const linkClass = "min-h-9 text-[13px] font-semibold text-accent-text hover:text-text";
const inputClass = "t-figure-row min-h-10 w-[104px] rounded-[10px] border border-border bg-alt px-3 text-right text-text outline-none focus:border-accent-border disabled:opacity-50";

export function QuickSetup({ sb, person, today, personId, guideOn, hasOthers, userId, onStarted, onError, onCancel, onMore, onNote, founding = false, waiting = false }: {
  sb: SupabaseClient; person: PersonData | null; today: string; personId: string;
  /** The Guide's plan can be kept for this project (api.ts guidePlanReady): only then are its three questions asked. */ guideOn: boolean;
  hasOthers: boolean; userId: () => Promise<string | null>;
  onStarted: (id: string) => Promise<void>; onError: (e: ApiError, retry: () => void) => boolean; onCancel: () => void;
  /** The set-up with every choice, as it was. */ onMore: () => void;
  onNote?: (words: string) => void;
  /** The page is drawn for a founding member (state.ts isFounding): three months only, and no "More choices". */ founding?: boolean;
  /** The page is still on the copy this browser kept (horizon/kept.ts): Start waits for the server's own answer. */ waiting?: boolean;
}) {
  const wayIn = useMemo(readWayIn, []);
  const [picked, setLength] = useState<Length>(3);
  // a founding member's horizon is three months, whatever was pressed before the page knew who it is drawn for
  const length: Length = lengthLocked(picked, founding) ? 3 : picked;
  const endsOn = addMonths(today, length);
  const weeks = Math.max(1, Math.floor(daysBetween(today, endsOn) / 7));
  // the method a fitness number is kept to, and the reading it starts from (the set-up's own choice: programme.ts)
  const method = useMemo(() => (person ? startingMethod(person, today) : null), [person, today]);
  const fitness: Reading | null = person ? (method ? fitnessBy(person, method) : null) ?? latestOf("mets", person, today) : null;
  // Only what your device shares: a marker nothing is sending is shown, and takes no number
  const off = leftOff(person ? arrivalsOf(person.doc.weeks) : null);
  const rows = useMemo<DefaultRow[]>(() => (person ? defaultTargets({ person, today, weeks, fitness: method ? fitness : null }) : []), [person, today, weeks, method]);
  // what the person typed, by marker; a field they have not touched shows its default
  const [typed, setTyped] = useState<Partial<Record<DefaultKey, string>>>({});
  const valueOf = (r: DefaultRow) => typed[r.marker] ?? (r.value != null ? String(r.value) : "");
  const usable = (r: DefaultRow) => followable(off, r.marker) && !(r.marker === "mets" && !method) && !(r.marker === "steps" && r.now == null);
  const [screen, setScreen] = useState<Partial<ScreenAnswers>>({});
  const answered = SCREEN_QUESTIONS.every((q) => typeof screen[q.key] === "boolean");
  const outcome = answered ? screenOutcome(screen as ScreenAnswers) : null;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  // "Your week", the Monday email: offered here only while it is off, and ticked until the person unticks it
  const [weekly, setWeekly] = useState<WeeklyState | null>(null);
  const [emailMe, setEmailMe] = useState(true);
  useEffect(() => { let live = true; void userId().then((uid) => (uid ? loadWeekly(sb, uid) : null)).then((w) => { if (live) setWeekly(w); }); return () => { live = false; }; }, []);
  const offersEmail = weekly?.state === "off";

  const nowOf = (k: MarkerKey): Reading | null => (!person ? null : k === "mets" ? fitness : latestOf(k, person, today));
  const chosen = (): StartTarget[] => rows.flatMap((r): StartTarget[] => {
    const v = usable(r) ? numOf(valueOf(r)) : null;
    const def = MARKER_BY_KEY[r.marker];
    if (v == null || !def) return [];
    const now = nowOf(r.marker);
    return [{ marker: r.marker, label: def.label, unit: now?.unit ?? def.unit, start_value: now?.value != null ? round(now.value, def.decimals + 1) : null, start_on: now?.on ?? today, target_value: v, cadence: def.cadence }];
  });

  async function start() {
    const targets = chosen();
    if (!targets.length) { setProblem("Set at least one number."); return; }
    if (guideOn && !answered) { setProblem("Answer the three questions about your health."); return; }
    const g = GOAL_BY_KEY[GOAL];
    const programme: Programme = { v: 1, goal: GOAL, aims: wayIn.aims, barriers: wayIn.barriers, days: [], place: null, writer: "guide", day: null };
    // "Time" gets in the way: the Guide's plan opens on the fewest aerobic days it offers, as in the full set-up
    const planChoices = wayIn.barriers.includes("time") ? { aerobic_days: FEWEST_AEROBIC_DAYS } : null;
    const go = async () => {
      setBusy(true); setProblem("");
      const res = await startHorizon(sb, {
        person_id: personId, title: `${g.title}, ${length} months`.slice(0, 80), kind: "months", months: length, starts_on: today, ends_on: endsOn,
        targets, plan: { rows: [], author: null },
        checkin_monday: true, checkin_month: true, send_to_coach: false, email_checkin: false, timezone: browserZone(),
      });
      if (!res.ok) { setBusy(false); if (!onError(res.error, () => void go())) setProblem(res.detail ? `${ERROR_WORDS[res.error]} ${res.detail}` : ERROR_WORDS[res.error]); return; }
      const id = res.data.id;
      // what the function does not take, sent together as the full set-up sends it: the programme, the method a fitness
      // number is kept to, the three answers and the Guide's plan
      const uid = await userId();
      const writes: Promise<string | null>[] = [saveProgramme(sb, id, programme)];
      if (method && targets.some((t) => t.marker === "mets")) writes.push(setTargetHold(sb, id, "mets", { mode: null, low_value: null, method }));
      if (uid && guideOn && answered) {
        writes.push(saveScreen(sb, id, uid, screen as ScreenAnswers));
        const oc = screenOutcome(screen as ScreenAnswers);
        if (oc !== "none" && person) {
          const v = guidePlan({ horizon: { starts_on: today, ends_on: endsOn }, targets: targets.map((t) => ({ marker: t.marker, target_value: t.target_value, method: t.marker === "mets" ? method : null })), person, today, mode: oc, choices: planChoices });
          writes.push(saveGuidePlan(sb, id, rowsWith(v, []), storeOf(v, today), uid));
        }
      }
      // the Monday email, when the line was shown and left ticked: the one switch Settings has, turned on
      if (uid && offersEmail && emailMe) writes.push(saveWeekly(sb, uid, true, browserZone()).then((w) => (w.state === "on" ? null : "the Monday email was not switched on. Settings has the switch.")));
      const problems = (await Promise.all(writes)).filter((e): e is string => !!e);
      // a horizon set changes what the account may do: the kept answer is asked again
      forgetAccess(); clearWayIn(); clearSetup();
      if (problems.length) onNote?.(`The horizon is kept. One part of it was not: ${problems[0]}`);
      await onStarted(id);
      setBusy(false);
    };
    await go();
  }

  return (
    <form id="horizon-setup" class="flex max-w-[760px] scroll-mt-4 flex-col gap-5" data-quick="setup" onSubmit={(e) => { e.preventDefault(); void start(); }}>
      <header class="flex flex-col gap-1">
        <h1 class="m-0 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-text">Set a horizon</h1>
        <span class="text-[14px] text-text-2" data-quick="span">{weeks} weeks · to {dayMonthYear(endsOn)}</span>
      </header>

      <div class="flex flex-col gap-5 rounded-[16px] border border-border bg-card p-5">
        <div class="flex flex-col gap-2">
          <h2 class={small}>How long</h2>
          <div class="grid w-full grid-cols-3 gap-1 rounded-[12px] border border-border bg-alt p-1 sm:w-auto sm:self-start" role="radiogroup" aria-label="How long">
            {LENGTHS.map((m) => (
              lengthLocked(m, founding)
                ? <button type="button" role="radio" aria-checked={false} aria-disabled="true" disabled key={m} data-quick-length={m} data-quick-locked="yes"
                    class="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-1 whitespace-nowrap rounded-[9px] border border-transparent px-1 text-[13px] font-medium text-text-3 sm:gap-1.5 sm:px-4 sm:text-[14px]">
                    <svg class="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                    <span>{m} months</span><span class="sr-only">, locked</span>
                  </button>
                : <button type="button" role="radio" aria-checked={length === m} key={m} data-quick-length={m} onClick={() => setLength(m)}
                class={`min-h-10 whitespace-nowrap rounded-[9px] px-1 text-[13px] sm:px-4 sm:text-[14px] ${length === m ? "border border-border bg-card font-semibold text-text" : "border border-transparent font-medium text-text-2 hover:text-text"}`}>{m} months</button>
            ))}
          </div>
          {founding ? <p class="m-0 text-[13px] text-text-2" data-quick="locked-line">{LENGTH_LOCKED_LINE}</p> : null}
        </div>

        <div class="flex flex-col gap-1 border-t border-border pt-4">
          <h2 class={small}>Your five numbers</h2>
          <ul class="m-0 flex list-none flex-col divide-y divide-border p-0" data-quick="rows">
            {rows.map((r) => (
              <li key={r.marker} data-quick-row={r.marker} class="flex flex-col gap-2 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:gap-y-1">
                <label for={`quick-${r.marker}`} class="flex min-w-0 items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0">
                  <span class="text-[15px] font-medium text-text">{r.label}</span>
                  {r.now ? <span class="text-[13px] text-text-2">{r.now}</span> : null}
                </label>
                <span class="flex items-center gap-2 sm:justify-end">
                  <input id={`quick-${r.marker}`} type="number" inputMode="decimal" step={10 ** -(MARKER_BY_KEY[r.marker]?.decimals ?? 0)} min="0" value={valueOf(r)} disabled={!usable(r)}
                    onInput={(e) => { setTyped((t) => ({ ...t, [r.marker]: (e.currentTarget as HTMLInputElement).value })); setProblem(""); }} class={inputClass} />
                  <span class="whitespace-nowrap text-[12px] leading-snug text-text-2 sm:w-[112px]">{r.unit}</span>
                </span>
                <span class="text-[12px] leading-snug text-text-2 sm:col-span-2" data-quick-from>{followable(off, r.marker) ? r.from : "Your device does not send this, so it takes no number."}</span>
              </li>
            ))}
          </ul>
        </div>

        {guideOn ? (
          <div class="flex flex-col gap-1 border-t border-border pt-4" data-quick="questions">
            <h2 class={small}>Three questions about your health</h2>
            <ul class="m-0 flex list-none flex-col divide-y divide-border p-0">
              {SCREEN_QUESTIONS.map((q) => (
                <li key={q.key} class="flex flex-col gap-2 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-4 sm:gap-y-1">
                  <span class="text-[15px] leading-snug text-text">{q.text}</span>
                  <span class="flex gap-1" role="radiogroup" aria-label={q.text}>
                    {([[true, "Yes"], [false, "No"]] as const).map(([v, word]) => (
                      <button type="button" role="radio" aria-checked={screen[q.key] === v} key={word} data-quick-answer={`${q.key}-${word.toLowerCase()}`} onClick={() => { setScreen((s) => ({ ...s, [q.key]: v })); setProblem(""); }}
                        class={`min-h-10 min-w-[56px] rounded-[10px] border px-3 text-[14px] ${screen[q.key] === v ? "border-accent-border bg-accent-fill font-semibold text-accent-text" : "border-border bg-alt font-medium text-text hover:border-border-strong"}`}>{word}</button>
                    ))}
                  </span>
                  {q.help ? <span class="text-[12px] leading-snug text-text-2 sm:col-span-2">{q.help}</span> : null}
                </li>
              ))}
            </ul>
            {outcome ? <p class="m-0 text-[13px] text-text-2" data-quick="outcome">{SCREEN_WORDS[outcome]}</p> : null}
          </div>
        ) : null}

        {offersEmail ? (
          <label class="flex cursor-pointer items-start gap-3 border-t border-border pt-4" data-quick="email">
            <input type="checkbox" checked={emailMe} onChange={(e) => setEmailMe((e.currentTarget as HTMLInputElement).checked)} class="mt-0.5 h-5 w-5 shrink-0 accent-accent" />
            <span class="flex min-w-0 flex-col">
              <span class="text-[15px] font-medium text-text">Email me my week on Mondays</span>
              <span class="text-[12px] leading-snug text-text-2">One email a week. One click in any email turns it off.</span>
            </span>
          </label>
        ) : null}

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
          <button type="submit" disabled={busy || waiting} data-quick="start" data-waiting={waiting ? "yes" : "no"} class="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-accent px-6 text-[15px] font-semibold text-canvas disabled:opacity-50">{busy ? "Starting…" : "Start"}</button>
          {waiting && !problem ? <span class="text-[13px] text-text-2" data-quick="waiting">Checking your horizons…</span> : null}
          {problem ? <span class="text-[13px] text-text" data-quick="problem">{problem}</span> : null}
        </div>
      </div>

      {(founding || !SETUP_MORE_CHOICES) && !hasOthers ? null : (
        <div class="flex flex-wrap items-center gap-x-5 gap-y-1" data-quick="links">
          {founding || !SETUP_MORE_CHOICES ? null : <button type="button" onClick={onMore} class={linkClass} data-quick-link="more">More choices</button>}
          {hasOthers ? <button type="button" onClick={() => { clearSetup(); onCancel(); }} class="min-h-9 text-[13px] font-medium text-text-2 hover:text-text" data-quick-link="cancel">Cancel</button> : null}
        </div>
      )}
    </form>
  );
}
