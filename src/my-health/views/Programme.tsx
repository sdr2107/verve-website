/**
 * Horizon as a programme, as the page draws it (canvas "Verve, Horizon as a programme", boards 04 to 08, 15 November
 * 2026). Built on the founder's word of 16 November 2026 for test accounts only: the set-up here is offered to an
 * account on the list (../horizon/api.ts programmeTester) and to nobody else, and the cards below it are drawn only on
 * a horizon that was set up as a programme.
 *
 *   ProgrammeSetup  when, what for, who writes the plan; what the page already reads; the three things it cannot
 *                   read; the horizon drafted from the goal, with what studies report beside each field.
 *   ProgrammeLine   the goal and the person's own words, above the numbers.
 *   WeightCard      the pace a weight number implies beside what guidelines describe, and three signs for fat or muscle.
 *   CallCard        the week with a coach: one sheet both people see, the person's answer, the call, three lines kept.
 *
 * Nothing here works anything out: the arithmetic is ../horizon/programme.ts and ../horizon/derive.ts, the figures
 * and their papers ../../data/programme.ts. The page sets no number and fills no field. It writes no diet.
 */
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { daysBetween } from "../derive/format.ts";
import { arrivalsOf, followable, leftOff } from "../derive/arrivals.ts";
import {
  addMonths, adherenceOf, dayMonthLong, doorOfMethod, dayMonthYear, fitnessBy, fmtValue, historyOf, impliedPace, latestOf, round, typicalOf, vo2Line, weekMoves, weeklyHistory,
  type MarkerDef, type MarkerKey, type PlanRow, type Reading, type Target,
} from "../horizon/derive.ts";
import { DOOR_BY_KEY, FEWEST_AEROBIC_DAYS, FITNESS_RULES, GOALS, GOAL_BY_KEY, GRIP, LENGTH_FOR, OWN_GOAL, BARRIERS, TEMPLATE_KEEPS, WAYS, WEIGHT, doiUrl, type GoalKey, type Line, type Mode } from "../../data/programme.ts";
import {
  DAY_NAMES, MODE_WORDS, alreadyReads, callsKept, doorLine, doorsOnFile, goalDraft, mondayRow, noteFor, parseProgramme, sheetWeeks, startingMethod, threeSigns, weightPace,
  type MondayRow, type Programme, type WeekNote, type Writer,
} from "../horizon/programme.ts";
import { guidePlan, rowsWith, screenOutcome, storeOf, isGuideStored, SCREEN_QUESTIONS, SCREEN_WORDS, type GuideStored, type ScreenAnswers } from "../horizon/guidePlan.ts";
import { methodLabel } from "../derive/markers.ts";
import type { PauseChoice, PauseState } from "../horizon/pause.ts";
import {
  startHorizon, saveProgramme, setTargetHold, saveScreen, saveGuidePlan, listWeekNotes, saveWeekNote, ERROR_WORDS,
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
const Step = ({ n, title, children }: { n: number; title: string; children: any }) => (
  <Card><div class="flex items-center gap-3"><span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-accent-border bg-accent-fill font-mono text-[12px] font-semibold text-accent-text">{n}</span><H2>{title}</H2></div>{children}</Card>
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

// ── the set-up (boards 04 and 05) ──

type Field = { ticked: boolean; value: string; low: string };
type Length = 3 | 6 | 12 | "date";

export function ProgrammeSetup({ sb, person, today, personId, nav, hasOthers, access, guideOn, userId, onStarted, onError, onCancel, onOwn, after }: {
  sb: SupabaseClient; person: PersonData | null; today: string; personId: string; nav: any; hasOthers: boolean;
  access: HorizonAccess | null; guideOn: boolean; userId: () => Promise<string | null>;
  onStarted: (id: string) => Promise<void>; onError: (e: ApiError, retry: () => void) => boolean; onCancel: () => void;
  /** "My own targets": the set-up as it was before the programme. */
  onOwn: () => void;
  /** The goal of the horizon just read to its date. After a weight horizon the next one offered is "Hold what I have". */
  after?: GoalKey | null;
}) {
  const wayIn = useMemo(readWayIn, []);
  // "Time" gets in the way: the Guide's plan opens on the fewest aerobic days it offers. The person can change it in the plan.
  const planChoices = wayIn.barriers.includes("time") ? { aerobic_days: FEWEST_AEROBIC_DAYS } : null;
  const [length, setLength] = useState<Length>(3);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [goal, setGoal] = useState<GoalKey | null>(after === "lose_weight" ? "hold" : null);
  const [writer, setWriter] = useState<Writer>("guide");
  const [days, setDays] = useState<number[]>([]);
  const [place, setPlace] = useState<"home" | "gym" | "both" | null>(null);
  const [screen, setScreen] = useState<Partial<ScreenAnswers>>({});
  const [fields, setFields] = useState<Record<string, Field>>({});
  const [method, setMethod] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const g = goal ? GOAL_BY_KEY[goal] : null;
  const endsOn = length === "date" ? date : addMonths(today, length);
  const weeks = endsOn && endsOn > today ? Math.max(1, Math.ceil(daysBetween(today, endsOn) / 7)) : 0;
  // Only what your device shares: a marker nothing is sending is shown, and cannot be ticked
  const off = leftOff(person ? arrivalsOf(person.doc.weeks) : null);
  const rows = useMemo(() => (goal ? goalDraft(goal, (m) => followable(off, m)) : []), [goal, person]);
  const onFile = useMemo(() => (person ? alreadyReads(person, today) : []), [person, today]);
  const doors = useMemo(() => (person ? doorsOnFile(person) : []), [person]);
  const guideWrites = writer !== "coach" && !g?.writer;
  const answered = SCREEN_QUESTIONS.every((q) => typeof screen[q.key] === "boolean");
  const outcome = answered ? screenOutcome(screen as ScreenAnswers) : null;

  // a goal ticks its markers; a watched one is left unticked, and no field is ever filled in
  useEffect(() => {
    if (!goal) return;
    setFields(Object.fromEntries(rows.map((r) => [r.marker, { ticked: r.mode !== "watch" && !r.missing, value: "", low: "" }])));
    setMethod(person ? startingMethod(person, today) : null);
    setPreview(false);
    const gg = GOAL_BY_KEY[goal];
    if (gg?.writer === "coach") setWriter("coach");
    if (gg && length !== "date" && !gg.suits.includes(length)) setLength(gg.suits[0]);
  }, [goal]);

  const field = (k: string): Field => fields[k] ?? { ticked: false, value: "", low: "" };
  const setField = (k: string, patch: Partial<Field>) => { setFields((f) => ({ ...f, [k]: { ...field(k), ...patch } })); setPreview(false); };
  const num = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);
  /** Where a marker stands for this draft: a fitness number is read by the method it will be kept to. */
  const nowOf = (k: MarkerKey): Reading | null => (!person ? null : k === "mets" && method ? fitnessBy(person, method) ?? latestOf(k, person, today) : latestOf(k, person, today));

  type Chosen = StartTarget & { hold: { mode: string | null; low_value: number | null; method: string | null } | null };
  const chosen = (): Chosen[] => rows.flatMap((r): Chosen[] => {
    const f = field(r.marker), v = num(f.value), lo = num(f.low);
    if (!f.ticked || v == null || r.missing) return [];
    if (r.mode === "band" && (lo == null || !(lo < v))) return [];
    const now = nowOf(r.marker);
    const held = r.mode === "floor" || r.mode === "ceiling" || r.mode === "band";
    // the weekly dose is a floor by its marker; any other held number says so in its row
    const mode = held && !r.def.standing ? r.mode : null;
    const m = r.marker === "mets" ? method : null;
    return [{ marker: r.marker, label: r.def.label, unit: now?.unit ?? r.def.unit, start_value: now?.value != null ? round(now.value, r.def.decimals + 1) : null, start_on: now?.on ?? today, target_value: v, cadence: r.def.cadence,
      hold: mode || m ? { mode, low_value: r.mode === "band" ? lo : null, method: m } : null }];
  });
  const draftTargets = chosen();
  /** The Guide's first week, worked out from the draft before anything is kept. */
  const firstWeek = useMemo(() => {
    if (!preview || !person || !guideWrites || !guideOn || !outcome || outcome === "none" || !endsOn || endsOn <= today) return null;
    try { return guidePlan({ horizon: { starts_on: today, ends_on: endsOn }, targets: draftTargets.map((t) => ({ marker: t.marker, target_value: t.target_value })), person, today, mode: outcome, choices: planChoices }); } catch { return null; }
  }, [preview, person, endsOn, outcome, JSON.stringify(draftTargets.map((t) => [t.marker, t.target_value]))]);

  function check(): string {
    if (!g || !goal) return "Choose what this horizon is for.";
    if (length === "date" && !title.trim()) return "Give the date a name: the race, the event.";
    if (!endsOn || endsOn <= today) return "The date has to be ahead of today.";
    if (!draftTargets.length) return "Set at least one number. Every field is empty until you type in it.";
    if (rows.some((r) => r.mode === "band" && field(r.marker).ticked && field(r.marker).value !== "" && !(num(field(r.marker).low) != null && num(field(r.marker).low)! < num(field(r.marker).value)!))) return "A band needs both ends: the lower number first.";
    if (guideWrites && guideOn && !answered) return "Answer the three questions about your health, or choose a coach to write the plan.";
    return "";
  }

  async function keep() {
    const why = check();
    if (why) { setProblem(why); return; }
    const targets = chosen();
    const programme: Programme = { v: 1, goal: goal!, aims: wayIn.aims, barriers: wayIn.barriers, days: [...days].sort(), place, writer: g!.writer === "coach" ? "coach" : writer };
    const name = length === "date" ? title.trim() : `${g!.title}, ${length} months`;
    const go = async () => {
      setBusy(true); setProblem("");
      const res = await startHorizon(sb, {
        person_id: personId, title: name.slice(0, 80), kind: length === "date" ? "date" : "months", months: length === "date" ? null : length, starts_on: today, ends_on: endsOn,
        targets: targets.map(({ hold: _hold, ...t }) => t), plan: { rows: [], author: null },
        checkin_monday: true, checkin_month: true, send_to_coach: programme.writer !== "guide", email_checkin: false, timezone: browserZone(),
      });
      if (!res.ok) { setBusy(false); if (!onError(res.error, () => void go())) setProblem(res.detail ? `${ERROR_WORDS[res.error]} ${res.detail}` : ERROR_WORDS[res.error]); return; }
      const id = res.data.id;
      // what the function does not take: the programme, how each number is held, the method a fitness number is kept to
      const problems: string[] = [];
      const say = (e: string | null) => { if (e) problems.push(e); };
      say(await saveProgramme(sb, id, programme));
      for (const t of targets) if (t.hold) say(await setTargetHold(sb, id, t.marker, t.hold));
      const uid = await userId();
      if (uid && guideWrites && guideOn && answered) {
        say(await saveScreen(sb, id, uid, screen as ScreenAnswers));
        const oc = screenOutcome(screen as ScreenAnswers);
        if (oc !== "none" && person) {
          const v = guidePlan({ horizon: { starts_on: today, ends_on: endsOn }, targets: targets.map((t) => ({ marker: t.marker, target_value: t.target_value })), person, today, mode: oc, choices: planChoices });
          say(await saveGuidePlan(sb, id, rowsWith(v, []), storeOf(v, today), uid));
        }
      }
      setBusy(false);
      clearWayIn();
      if (problems.length) setProblem(`The horizon is kept. One part of it was not: ${problems[0]}`);
      await onStarted(id);
    };
    await go();
  }

  return (
    <form class="flex max-w-[980px] flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void keep(); }}>
      <header class="flex flex-col gap-2">
        <Eyebrow>Horizon · new · test account</Eyebrow>
        <h1 class="m-0 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">Set a horizon</h1>
        <p class="m-0 text-[15px] leading-relaxed text-text-2">Three choices, then the page shows what it already reads about you. It asks only what it cannot read, and you set every number.</p>
        {after === "lose_weight" ? <Evidence line={{ text: `Your last horizon was for weight, so this one opens on "Hold what I have": a floor, not another loss. ${WEIGHT.after.text} Any other goal can be chosen below.`, cites: WEIGHT.after.cites }} /> : null}
        {wayIn.aims.length > 0 && <p class="m-0 text-[13px] leading-relaxed text-text-2">You said you want: {wayIn.aims.map((a) => `"${a}"`).join(", ")}. It is kept above your numbers.</p>}
        <p class="m-0 text-[13px] text-text-2"><a href="/horizon/" class="font-semibold text-accent-text underline-offset-2 hover:underline">{wayIn.aims.length || wayIn.barriers.length ? "Change your answers to the five questions" : "Start from the five questions"}</a></p>
        {hasOthers && <div class="mt-1">{nav}</div>}
      </header>

      <Step n={1} title="How far ahead?">
        <div class="grid grid-cols-1 gap-2 md:grid-cols-4">
          {([3, 6, 12] as const).map((m) => <Opt key={m} on={length === m} onPick={() => setLength(m)} title={m === 12 ? "1 year" : `${m} months`} sub={LENGTH_FOR[m]} foot={`to ${dayMonthYear(addMonths(today, m))}`} />)}
          <Opt on={length === "date"} onPick={() => setLength("date")} title="A date of my own" sub="A race, a wedding, a birthday." />
        </div>
        {length === "date" && (
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-1 basis-[260px] flex-col gap-1"><Eyebrow>Name</Eyebrow><input type="text" value={title} maxLength={80} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} placeholder="The city marathon" class={inputClass} /></label>
            <label class="flex flex-col gap-1"><Eyebrow>Date</Eyebrow><input type="date" value={date} min={today} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} class={`${inputClass} font-mono`} /></label>
            {weeks > 0 && <span class="pb-2 text-[13px] text-text-2">{weeks} weeks</span>}
          </div>
        )}
      </Step>

      <Step n={2} title="What is this horizon for?">
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          {GOALS.map((x) => <Opt key={x.key} on={goal === x.key} onPick={() => setGoal(x.key)} title={x.title} sub={x.lead} foot={x.suitsWords} />)}
          <Opt on={false} onPick={onOwn} title={OWN_GOAL.title} sub={OWN_GOAL.lead} />
        </div>
        <Quiet>A goal ticks its markers and shows what studies report beside each number. It fills no field in.</Quiet>
      </Step>

      <Step n={3} title="Who writes the week?">
        <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Opt on={writer === "guide" && !g?.writer} disabled={!!g?.writer} onPick={() => setWriter("guide")} title="The Guide" sub={g?.writer ? "The Guide has no rules for this goal yet." : "Worked out from published guidelines and your own weeks. You can open every rule."} />
          <Opt on={writer === "coach" || !!g?.writer} onPick={() => setWriter("coach")} title="My coach or trainer" sub="They see the page you share and write the plan. Invite them from Settings." />
          <Opt on={writer === "both" && !g?.writer} disabled={!!g?.writer} onPick={() => setWriter("both")} title="The Guide drafts, my coach edits" sub="The Guide's plan, with your coach's changes marked as theirs." />
        </div>
        <Quiet>A coach can be added later. The horizon does not start again.{wayIn.barriers.includes("alone") ? " You said no one checks on you: a coach sees the same page you do, and a call sheet for each week." : ""}</Quiet>
      </Step>

      <Step n={4} title="What the page already reads">
        {!person && <Quiet>Reading your numbers…</Quiet>}
        <div class="flex flex-col">
          {onFile.map((r, i) => (
            <div class={`grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-baseline gap-x-3 gap-y-1 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,2fr)_auto] ${i ? "border-t border-border" : ""}`} key={r.key}>
              <span class="text-[15px] font-medium text-text">{r.label}</span>
              <span class={r.value ? "font-mono text-[14px] font-semibold text-text" : "text-[13px] text-caution"}>{r.value ?? "Not on file"}</span>
              <span class="col-span-2 text-[12px] leading-relaxed text-text-3 md:col-span-1">{r.from}</span>
              {r.action ? <a href={r.action.href} class="text-[12px] font-semibold text-accent-text md:text-right">{r.action.label}</a> : <span class="hidden md:block" />}
            </div>
          ))}
        </div>
        <Quiet>Nothing here is typed by you unless it is missing. A goal that needs a reading the page does not hold says so before the horizon starts, and never guesses one.</Quiet>
      </Step>

      <Step n={5} title="The three things it cannot read">
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
      </Step>

      <Step n={6} title={g ? `Your horizon, drafted · ${g.title}${weeks ? ` · ${weeks} weeks` : ""}` : "Your horizon, drafted"}>
        {!g ? <Quiet>Choose what the horizon is for, above. The goal ticks its markers here.</Quiet> : (
          <div class="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div class="flex flex-col">
              {rows.map((r, i) => {
                const f = field(r.marker), v = num(f.value), lo = num(f.low);
                const now = nowOf(r.marker), unit = now?.unit ?? r.def.unit;
                const typical = person ? typicalOf(r.marker, person, today) : null;
                const held = (r.mode === "floor" || r.mode === "ceiling" || r.mode === "band") && !r.def.standing ? { mode: r.mode, low: lo } : null;
                const stands = !now ? (typical != null ? `a typical week ${fmtValue(r.def, typical)}` : "no reading yet") : r.def.kind === "weekly" ? `last week ${fmtValue(r.def, now.value)}${typical != null ? ` · a typical week ${fmtValue(r.def, typical)}` : ""}` : `today ${now.display ?? fmtValue(r.def, now.value)}`;
                const note = r.missing ? "Nothing is sending this reading from your devices, so it could not be followed. Settings › Devices says why."
                  : !f.ticked ? (r.mode === "watch" ? "Watched: no number is needed. Tick it only if you want one." : r.def.how)
                  : v == null ? "Set the number."
                  : r.marker === "weight" && r.mode === "reach" && now && weeks ? weightPace(now.value, v, weeks).words
                  : person ? impliedPace(r.def, now, v, Math.max(1, weeks), historyOf(r.marker, person, today), today, r.def.standing || r.mode === "floor" ? weeklyHistory(person, r.marker, today, 13) : undefined, typical, held as any) : "";
                return (
                  <div class={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1.2fr)] ${i ? "border-t border-border" : ""}`} key={r.marker}>
                    <input type="checkbox" checked={f.ticked} disabled={r.missing} onChange={(e) => setField(r.marker, { ticked: (e.currentTarget as HTMLInputElement).checked })} aria-label={r.def.label} class="h-5 w-5 accent-accent" />
                    <span class="text-[15px] text-text">{r.def.label}{r.mode !== "reach" ? <span class="block font-mono text-[11px] text-text-3">{r.mode === "watch" ? "watched" : r.mode === "band" ? "inside a band" : r.mode === "floor" ? "held, at least" : "held, at most"}</span> : null}</span>
                    <span class="col-start-2 flex items-center gap-1.5 md:col-start-auto">
                      {r.mode === "band" ? <><input type="number" step={10 ** -r.def.decimals} value={f.low} placeholder="between" disabled={!f.ticked} onInput={(e) => setField(r.marker, { low: (e.currentTarget as HTMLInputElement).value })} aria-label={`${r.def.label}: the lower end`} class={`${inputClass} w-28 font-mono`} /><span class="text-[12px] text-text-3">and</span></> : null}
                      <input type="number" step={10 ** -r.def.decimals} value={f.value} placeholder={r.mode === "band" ? "and" : MODE_WORDS[r.mode === "watch" ? "reach" : r.mode]} disabled={!f.ticked} onInput={(e) => setField(r.marker, { value: (e.currentTarget as HTMLInputElement).value })} aria-label={`${r.def.label}: ${r.mode === "band" ? "the upper end" : "the number you want"}`} class={`${inputClass} w-28 font-mono`} />
                    </span>
                    <span class="col-start-2 text-[12px] text-text-3 md:col-start-auto"><span class="font-mono text-[11px]">{unit}</span> · {stands}</span>
                    <span class={`col-span-2 text-[12px] leading-relaxed md:col-span-4 md:pl-8 ${f.ticked ? "text-text-2" : "text-text-3"}`}>{note}{r.marker === "mets" && person && f.ticked ? ` ${vo2Line(person, today, v, method && now ? now.value : null)}` : ""}</span>
                    {r.marker === "mets" && f.ticked && doors.length > 0 ? (
                      <div class="col-span-2 flex flex-col gap-1.5 md:col-span-4 md:pl-8">
                        <span class="text-[12px] font-semibold text-text-2">Measured by one method, from start to end</span>
                        <div class="flex flex-wrap gap-1.5">{doors.map((d) => <Chip key={d.door.key} on={method === d.door.key} onPick={() => { setMethod(d.door.key); setPreview(false); }}>{d.door.title.replace(/^(A|Your) /, "").replace(/^./, (c) => c.toUpperCase())} · {fmtValue(r.def, d.reading.value)} on {dayMonthLong(d.reading.on)}</Chip>)}</div>
                        {method && DOOR_BY_KEY[method] ? <Evidence line={DOOR_BY_KEY[method].errorNote} /> : method ? <Quiet>Kept to {methodLabel(method)}. No published error is on file for it here.</Quiet> : null}
                        {v != null && now && Math.abs(v - now.value) < now.value * FITNESS_RULES.noChangeShare ? <Quiet>Your number is inside the 5% two tests of one person differ by with nothing changed. A test at your number will not be called reached.</Quiet> : null}
                      </div>
                    ) : null}
                    {r.marker === "grip" && f.ticked ? <div class="col-span-2 md:col-span-4 md:pl-8"><Evidence line={GRIP.moves} /></div> : null}
                  </div>
                );
              })}
              <Quiet>The goal ticked {rows.filter((r) => r.mode !== "watch" && !r.missing).length} markers. Every field is empty until you type in it, and any row can be unticked.</Quiet>
            </div>
            <div class="flex flex-col gap-3">
              <Eyebrow>Beside the numbers</Eyebrow>
              {g.evidence.map((l) => <Evidence line={l} key={l.text} />)}
              <Eyebrow>What the plan does</Eyebrow>
              <p class="m-0 text-[13px] leading-relaxed text-text-2">{g.plan}</p>
              <Quiet>{TEMPLATE_KEEPS}</Quiet>
              <Quiet>These figures were read from the papers' abstracts on 15 November 2026 and are shown to test accounts only.</Quiet>
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
      </Step>

      {problem && <div class="rounded-[10px] border border-caution/40 bg-alt px-4 py-3 text-[13px] text-caution">{problem}</div>}
      <div class="flex flex-wrap items-center gap-3">
        <Button onClick={() => { const why = check(); setProblem(why); setPreview(!why); }}>See the first week</Button>
        <Button type="submit" primary disabled={busy}>{busy ? "Keeping…" : "Keep this horizon"}</Button>
        <Button onClick={onCancel}>Cancel</Button>
        <span class="ml-auto text-[12px] text-text-3">{access && !access.pro && access.free.available ? "Free for one week, then Pro. The horizon and your readings stay." : "Stop it any time, the readings stay"}</span>
      </div>
      <Quiet>The first week is shown before anything is kept, so the decision is made looking at the plan.</Quiet>
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

export function WeightCard({ h, targets, person, today, programme }: { h: HorizonFull; targets: Target[]; person: PersonData; today: string; programme: Programme | null }) {
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
      <Quiet>{signs.stops} The page writes no diet.</Quiet>
      {programme?.goal === "lose_weight" ? <Evidence line={{ text: `On the date, the next horizon offered is "Hold what I have". ${WEIGHT.after.text}`, cites: WEIGHT.after.cites }} /> : null}
      <Quiet>Read from the papers' abstracts on 15 November 2026. Shown to test accounts only.</Quiet>
    </Card>
  );
}

// ── the week with a coach (board 08) ──

const callWords = (iso: string | null) => { if (!iso) return "No time set"; const d = new Date(iso); return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`; };
const localInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export function CallCard({ sb, h, targets, person, today, owner, closed, tester, programme, planRows, guideOn, userId, setNotice, pause, pausing, onSetAside }: {
  sb: SupabaseClient; h: HorizonFull; targets: Target[]; person: PersonData | null; today: string; owner: boolean; closed: boolean;
  /** A test account may write the coach's side of its own horizon, so the sheet can be tried by one person. */
  tester: boolean; programme: Programme; planRows: PlanRow[]; guideOn: boolean;
  userId: () => Promise<string | null>; setNotice: (s: string) => void;
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
