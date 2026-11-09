/**
 * Horizon (Pro on the website): a date, the markers you want different by
 * then, the week that gets you there, and the Guide's check-ins. One mount,
 * `mountHorizon(root, deps)`, draws the horizon in view (canvas board 14)
 * or the four-step set-up (board 15). The arithmetic is ../horizon/derive;
 * the rows and the writer are ../horizon/api. A coach sees everything
 * read-only except the plan, which is theirs to write.
 *
 * Pace is arithmetic on the person's own readings; nothing here recommends
 * a number. The plan is intent for a week, not a session for each day; what
 * the week did comes from the sessions and the nights, never a tick box.
 */
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { addDays, daysBetween, todayStr } from "../derive/format.ts";
import {
  MARKERS, MARKER_BY_KEY, GROUP_LABEL, FIRST_MARKERS, type MarkerKey, type Target, type PlanRow, type PlanKind, type Tone,
  latestOf, historyOf, weeklyHistory, pacesOf, impliedPace, adherenceOf, guideDraftPlan, roadOf, weekOf, daysToGo, nextCheckins, checkinInputs,
  fmtValue, addMonths, longDate, dayMonth, dayMonthLong, dayMonthYear, weekdayDayMonth, clockOf, round, numberWord,
} from "../horizon/derive.ts";
import {
  listHorizons, startHorizon, requestCheckin, grantConsent, savePlan, updateHorizon, stopHorizon, addTarget, removeTarget, ERROR_WORDS,
  type HorizonFull, type PlanAuthor, type StartTarget, type ApiError,
} from "../horizon/api.ts";

export type HorizonDeps = {
  supabase: SupabaseClient;
  /** The person whose page is open; null before the page knows. */
  personId: () => string | null;
  /** The signed-in account; used for updated_by on the plan and for consent. Falls back to the session when absent. */
  userId?: () => string | null;
  derived: () => PersonData | null;
  isOwner: () => boolean;
  goTab: (t: string) => void;
  /** The open horizons, for the sidebar's sub-links; called after every load. */
  onHorizons?: (list: { id: string; title: string; ends_on: string }[]) => void;
  /** The backend is not in place for this project yet (tables missing, or the function answers 404): the page says so and the sidebar dims the door. */
  onOff?: (off: boolean) => void;
};
export type HorizonHandle = { refresh: () => void; open: (hash: string) => void };

/** The route inside the pane: "" (the first open horizon), an id, or "new". */
const route = signal<string>("");
const tick = signal(0);

export function mountHorizon(root: HTMLElement, deps: HorizonDeps): HorizonHandle {
  render(<HorizonApp deps={deps} />, root);
  return {
    refresh: () => { tick.value++; },
    open: (hash: string) => { const h = hash.replace(/^#/, ""); route.value = h === "horizon" ? "" : h.replace(/^horizon-/, ""); },
  };
}

// ── small parts ──

const TONE_TEXT: Record<Tone, string> = { good: "text-good", caution: "text-caution", neutral: "text-text-3" };
const Eyebrow = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium text-text-3">{children}</div>;
const H2 = ({ children }: { children: any }) => <h2 class="m-0 text-[18px] font-semibold text-text">{children}</h2>;
const Card = ({ children, id }: { children: any; id?: string }) => <section id={id} class="flex flex-col gap-4 rounded-[16px] border border-border bg-card p-5">{children}</section>;
const Button = ({ children, onClick, primary, disabled, type = "button" }: { children: any; onClick?: () => void; primary?: boolean; disabled?: boolean; type?: "button" | "submit" }) => (
  <button type={type} disabled={disabled} onClick={onClick} class={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-50 ${primary ? "bg-accent text-canvas" : "border border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;
const inputClass = "min-h-10 rounded-[10px] border border-border bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border";

function ProCard({ goTab }: { goTab: (t: string) => void }) {
  return (
    <Card>
      <Eyebrow>Pro</Eyebrow>
      <div class="text-[18px] font-semibold text-text">Horizon is part of Pro on the website.</div>
      <p class="m-0 text-[15px] leading-relaxed text-text-2">A horizon is a date, the markers you want different by then, and the week that gets you there. Free keeps Overview, In depth, Body and the Guide's read. A horizon can be stopped any time; the readings stay.</p>
      <div class="flex flex-wrap gap-2">
        <a href="/plans" class="inline-flex min-h-10 items-center rounded-[10px] bg-accent px-4 text-[13px] font-semibold text-canvas">See the plans</a>
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
        <span>The Guide's writer receives the figures on this page: the targets, where each stands, the week's counts and the plan's rows. It receives no name, no note and no message. Its words come back here and, if you chose it, to your coach.</span>
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
const toTarget = (t: { marker: string; label: string; unit: string | null; start_value: number | null; start_on: string | null; target_value: number; cadence: any; id?: string }): Target =>
  ({ id: t.id, marker: t.marker as MarkerKey, label: t.label, unit: t.unit, start_value: t.start_value != null ? Number(t.start_value) : null, start_on: t.start_on, target_value: Number(t.target_value), cadence: t.cadence ?? MARKER_BY_KEY[t.marker]?.cadence ?? "monthly" });

// ── the plan's rows, editable ──

const PLAN_KINDS: { kind: PlanKind; label: string; n: "count" | "minutes" | "time" | null; words: (n: number) => string }[] = [
  { kind: "sessions_week", label: "Sessions a week", n: "count", words: (n) => `${cap(numberWord(n))} session${n === 1 ? "" : "s"} a week` },
  { kind: "long_session", label: "One long session", n: "minutes", words: (n) => `One session of ${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")} or more` },
  { kind: "strength_week", label: "Strength a week", n: "count", words: (n) => `Strength ${n === 1 ? "once" : n === 2 ? "twice" : `${numberWord(n)} times`} a week` },
  { kind: "zone2_most", label: "Most minutes in zone 2", n: null, words: () => "Most minutes in zone 2" },
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
    const def = PLAN_KINDS.find((k) => k.kind === next.kind)!;
    if (next.kind !== "custom") next.label = def.words(next.n ?? 0);
    return next;
  }));
  return (
    <div class="flex flex-col gap-3">
      {rows.map((r, i) => {
        const def = PLAN_KINDS.find((k) => k.kind === r.kind)!;
        return (
          <div class="flex flex-wrap items-center gap-2" key={i}>
            <select value={r.kind} onChange={(e) => { const kind = (e.currentTarget as HTMLSelectElement).value as PlanKind; const d = PLAN_KINDS.find((k) => k.kind === kind)!; set(i, { kind, n: d.n === "count" ? 3 : d.n === "minutes" ? 90 : d.n === "time" ? 1410 : null, label: kind === "custom" ? "" : d.words(d.n === "count" ? 3 : d.n === "minutes" ? 90 : d.n === "time" ? 1410 : 0) }); }} class={`${inputClass} text-[13px]`}>
              {PLAN_KINDS.map((k) => <option value={k.kind}>{k.label}</option>)}
            </select>
            {def.n === "count" && <input type="number" min={1} max={14} value={r.n ?? 1} onInput={(e) => set(i, { n: Number((e.currentTarget as HTMLInputElement).value) || 1 })} class={`${inputClass} w-20 font-mono`} aria-label="How many" />}
            {def.n === "minutes" && <input type="number" min={15} max={600} step={5} value={r.n ?? 90} onInput={(e) => set(i, { n: Number((e.currentTarget as HTMLInputElement).value) || 90 })} class={`${inputClass} w-24 font-mono`} aria-label="Minutes" />}
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

  const userId = async () => deps.userId?.() ?? (await deps.supabase.auth.getSession()).data.session?.user.id ?? null;

  async function load() {
    if (!personId) { setList([]); return; }
    try {
      const hs = await listHorizons(deps.supabase, personId);
      setList(hs); setLoadError(""); setOff(false); deps.onOff?.(false);
      if (hs.length) setPro("yes");
      deps.onHorizons?.(hs.map((h) => ({ id: h.id, title: h.title, ends_on: h.ends_on })));
    } catch (e: any) {
      if (e?.name === "HorizonOff") { setOff(true); setList([]); setLoadError(""); deps.onOff?.(true); deps.onHorizons?.([]); return; }
      setLoadError(e?.message ?? "Could not read the horizons."); setList([]);
    }
  }
  useEffect(() => { void load(); }, [personId, _tick]);

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
  if (pro === "no") return <ProCard goTab={deps.goTab} />;

  const open = list.filter((h) => !h.closed_at);
  const current = r && r !== "new" ? list.find((h) => h.id === r) ?? null : open[0] ?? null;
  const showSetup = owner && (r === "new" || (!current && !open.length));

  const nav = open.length || owner ? (
    <div class="flex flex-wrap gap-2" role="tablist" aria-label="Your horizons">
      {open.map((h) => (
        <button type="button" role="tab" aria-selected={!showSetup && current?.id === h.id} onClick={() => { route.value = h.id; history.replaceState(null, "", `#horizon-${h.id}`); }}
          class={`rounded-full border px-3 py-1 text-[12px] font-medium ${!showSetup && current?.id === h.id ? "border-accent-border bg-accent-fill text-accent-text" : "border-border text-text-2 hover:border-border-strong"}`}>{shortTitle(h.title)} · {dayMonth(h.ends_on)}</button>
      ))}
      {owner && <button type="button" role="tab" aria-selected={showSetup} onClick={() => { route.value = "new"; history.replaceState(null, "", "#horizon-new"); }} class={`rounded-full border px-3 py-1 text-[12px] font-medium ${showSetup ? "border-accent-border bg-accent-fill text-accent-text" : "border-border text-text-2 hover:border-border-strong"}`}>{open.length ? "Set another" : "Set a horizon"}</button>}
    </div>
  ) : null;

  return (
    <div class="flex flex-col gap-5">
      {notice && <div class="flex items-start justify-between gap-3 rounded-[10px] border border-border-strong bg-alt px-4 py-3 text-[13px] text-text-2"><span>{notice}</span><button type="button" onClick={() => setNotice("")} class="text-text-3 hover:text-text" aria-label="Dismiss">×</button></div>}
      {loadError && <Quiet>{loadError}</Quiet>}
      {consent && <ConsentBox onAgree={() => void agreeConsent()} busy={busy === "consent"} />}
      {showSetup
        ? <Setup deps={deps} person={person} today={today} personId={personId} hasOthers={open.length > 0} nav={nav}
            onStarted={async (id) => { setPro("yes"); await load(); route.value = id; history.replaceState(null, "", `#horizon-${id}`); }}
            onError={onApiError} onCancel={() => { route.value = ""; history.replaceState(null, "", "#horizon"); }} />
        : current
          ? <View deps={deps} h={current} person={person} today={today} owner={owner} nav={nav} busy={busy} setBusy={setBusy} onError={onApiError} setNotice={setNotice} reload={load} userId={userId} />
          : <Card>{nav}<div class="text-[18px] font-semibold text-text">No horizon set.</div><Quiet>{owner ? "A horizon is a date, the markers you want different by then, and the week that gets you there." : "Nothing to see here yet: this person has not set a horizon."}</Quiet></Card>}
    </div>
  );
}

// ── board 14: the horizon in view ──

function View({ deps, h, person, today, owner, nav, busy, setBusy, onError, setNotice, reload, userId }: {
  deps: HorizonDeps; h: HorizonFull; person: PersonData | null; today: string; owner: boolean; nav: any; busy: string; setBusy: (s: string) => void;
  onError: (e: ApiError, retry: () => void) => boolean; setNotice: (s: string) => void; reload: () => Promise<void>; userId: () => Promise<string | null>;
}) {
  const [editingPlan, setEditingPlan] = useState(false);
  const [adding, setAdding] = useState(false);
  const { week, weeks } = weekOf(h, today);
  const togo = daysToGo(h, today);
  const targets = h.targets.map(toTarget);
  const paces = useMemo(() => (person ? pacesOf(targets, h, person, today) : []), [person, h, today]);
  const planRows = h.plan?.rows ?? [];
  const thisMonday = nextCheckins(h, today).thisMonday;
  const adherence = person && planRows.length ? adherenceOf(planRows, person, thisMonday, today) : [];
  const latest = h.checkins[0] ?? null;
  const next = nextCheckins(h, today);
  const road = roadOf(h, today);
  const closed = !!h.closed_at;
  const missingWeek = owner && !closed && h.checkin_monday && today >= thisMonday && !h.checkins.some((c) => c.kind === "week" && c.for_date === thisMonday) && thisMonday > h.starts_on;
  const firstOfMonth = today.slice(0, 7) + "-01";
  const missingMonth = owner && !closed && h.checkin_month && firstOfMonth > h.starts_on && today >= firstOfMonth && !h.checkins.some((c) => c.kind === "month" && c.for_date === firstOfMonth);
  const finalDue = owner && today >= h.ends_on && !h.checkins.some((c) => c.kind === "final");
  const authorWords = h.plan?.author === "coach" ? "written by your coach" : h.plan?.author === "guide" ? "drafted by the Guide" : h.plan ? "written by you" : "";

  async function writeCheckin(kind: "week" | "month" | "final", forDate: string) {
    if (!person) { setNotice("The page is still drawing its numbers; try again in a moment."); return; }
    const go = async () => {
      setBusy("checkin"); setNotice("");
      const res = await requestCheckin(deps.supabase, { horizon_id: h.id, kind, for_date: forDate, inputs: checkinInputs(h, targets, planRows, person, today) });
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
  async function toggle(key: "checkin_monday" | "checkin_month" | "send_to_coach", value: boolean) {
    const err = await updateHorizon(deps.supabase, h.id, { [key]: value } as Partial<Pick<HorizonFull, "checkin_monday" | "checkin_month" | "send_to_coach">>);
    if (err) setNotice(`Could not change that: ${err}`); else await reload();
  }
  async function stop() {
    if (!confirm(`Stop the horizon "${h.title}"? Its targets, plan and check-ins stay on file; it leaves this page.`)) return;
    const err = await stopHorizon(deps.supabase, h.id);
    if (err) setNotice(`Could not stop it: ${err}`); else { route.value = ""; await reload(); }
  }

  return (
    <>
      <header class="flex flex-wrap items-start justify-between gap-6">
        <div class="flex max-w-[680px] flex-col gap-2">
          <Eyebrow>Horizon · set {dayMonthYear(h.starts_on)} · week {week} of {weeks}{closed ? " · stopped" : ""}</Eyebrow>
          <h1 class="m-0 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">{h.title}, {longDate(h.ends_on)}</h1>
          <p class="m-0 text-[15px] leading-relaxed text-text-2">A horizon is a date, the markers you want different by then, and the week that gets you there. The Guide checks the pace every Monday and reads the month at its end. Your coach sees all of it and writes the plan.</p>
          <div class="mt-1">{nav}</div>
        </div>
        <div class="flex min-w-[180px] flex-col items-end gap-1 rounded-[16px] border border-border-strong bg-card px-5 py-4">
          <span class="font-mono text-[28px] font-semibold leading-none text-text">{togo}</span>
          <span class="font-mono text-[11px] font-medium text-text-3">days to go</span>
          <span class="text-[12px] text-text-2">{weeks} weeks · {Math.max(0, week - 1)} behind you</span>
        </div>
      </header>

      <Card id="horizon-targets">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <H2>Targets · {targets.length}</H2>
          <span class="text-[12px] text-text-3">Pace = what has moved against what the date needs · the tick on each track is where you should be today</span>
        </div>
        {!person && <Quiet>Reading your numbers…</Quiet>}
        <div class="flex flex-col">
          <div class="hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,.8fr))_minmax(0,1.6fr)_minmax(0,1.6fr)] gap-3 border-b border-border pb-2 font-mono text-[11px] text-text-3 md:grid">
            <span>Marker</span><span class="text-right">{dayMonth(h.starts_on)}</span><span class="text-right">Now</span><span class="text-right">{dayMonth(h.ends_on)}</span><span>Track</span><span>Pace</span>
          </div>
          {paces.map((p) => (
            <div class="grid grid-cols-2 items-center gap-x-3 gap-y-1 border-b border-border py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,.8fr))_minmax(0,1.6fr)_minmax(0,1.6fr)]" key={p.marker}>
              <span class="col-span-2 flex flex-col md:col-span-1"><span class="text-[15px] text-text">{p.label}</span><span class="text-[12px] text-text-3">{MARKER_BY_KEY[p.marker]?.how ?? ""}</span></span>
              <span class="font-mono text-[15px] font-semibold text-text-3 md:text-right">{p.startText}</span>
              <span class="font-mono text-[15px] font-semibold text-text md:text-right">{p.nowText}{p.unit && p.now != null ? <span class="ml-1 font-mono text-[11px] font-medium text-text-3">{p.unit}</span> : null}</span>
              <span class="font-mono text-[15px] font-semibold text-accent-text md:text-right">{p.targetText}</span>
              <span class="col-span-2 md:col-span-1"><Track progress={p.progress} elapsed={p.elapsed} tone={p.tone} /></span>
              <span class={`col-span-2 flex items-center justify-between text-[13px] font-medium md:col-span-1 ${TONE_TEXT[p.tone]}`}>
                {p.pace_word}
                {owner && !closed && targets.length > 1 && <button type="button" onClick={async () => { const t = targets.find((x) => x.marker === p.marker); if (!t?.id) return; const err = await removeTarget(deps.supabase, t.id); if (err) setNotice(err); else await reload(); }} class="ml-2 text-[11px] font-normal text-text-4 hover:text-text" aria-label={`Remove ${p.label}`}>Remove</button>}
              </span>
            </div>
          ))}
        </div>
        {owner && !closed && person && (adding
          ? <AddTarget person={person} today={today} taken={targets.map((t) => t.marker)} weeks={Math.max(1, Math.ceil(daysBetween(today, h.ends_on) / 7))}
              onAdd={async (t) => { const uid = await userId(); if (!uid) return; const res = await addTarget(deps.supabase, { horizon_id: h.id, user_id: uid, ...t }); if (!res.ok) setNotice(res.detail || ERROR_WORDS.unknown); else { setAdding(false); await reload(); } }}
              onCancel={() => setAdding(false)} />
          : <div><button type="button" onClick={() => setAdding(true)} class="rounded-full border border-border px-3 py-1 text-[12px] text-text-2 hover:border-accent-border">Add a target</button></div>)}
        <Quiet>Any of the site's 34 parameters or the Body list can be a target. Verve does not set the number; it tells you the pace it implies and whether the weeks are keeping it.</Quiet>
      </Card>

      <Card id="horizon-plan">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <H2>The plan{authorWords ? ` · ${authorWords}` : ""}{h.plan ? `, updated ${dayMonthLong(h.plan.updated_at.slice(0, 10))}` : ""}</H2>
          <div class="flex gap-3 text-[13px] font-semibold">
            {planRows.length > 0 && !editingPlan && !closed && <button type="button" onClick={() => setEditingPlan(true)} class="text-text-2 hover:text-text">{owner ? "Edit" : "Edit the plan"}</button>}
            <button type="button" onClick={() => deps.goTab("messages")} class="text-accent-text">Ask about it</button>
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
                {owner && !closed && person && <Button onClick={() => void savePlanRows(guideDraftPlan(person, today), "guide")} disabled={busy === "plan"}>Let the Guide draft one</Button>}
              </div>}
        <Quiet>Without a coach, the Guide drafts the plan from your last eight weeks and you edit it. The plan is intent for a week, not a session for each day; what you did comes from your sessions, never from a tick box.</Quiet>
      </Card>

      <Card id="horizon-checkin">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <H2>The Guide's check-in{latest ? ` · ${weekdayDayMonth(latest.for_date)}` : ""}</H2>
          {!closed && <span class="text-[12px] text-text-3">Next: Monday {dayMonthLong(next.nextMonday)}{next.monthReview ? ` · month review ${dayMonthLong(next.monthReview)}` : ""}</span>}
        </div>
        {latest
          ? <p class="m-0 max-w-[640px] text-[16px] leading-[1.65] text-text">{latest.text}</p>
          : <p class="m-0 text-[15px] text-text-2">{owner ? "No check-in yet. The first one is written on the first Monday after the horizon is set." : "No check-in yet."}</p>}
        {(missingWeek || missingMonth || finalDue) && (
          <div class="flex flex-wrap gap-2">
            {missingWeek && <Button primary disabled={busy === "checkin"} onClick={() => void writeCheckin("week", thisMonday)}>{busy === "checkin" ? "Writing…" : "Write this week's check-in"}</Button>}
            {missingMonth && <Button disabled={busy === "checkin"} onClick={() => void writeCheckin("month", firstOfMonth)}>Write the month's read</Button>}
            {finalDue && <Button primary disabled={busy === "checkin"} onClick={() => void writeCheckin("final", h.ends_on)}>Read the whole road</Button>}
          </div>
        )}
        {h.checkins.length > 1 && (
          <details class="text-[13px] text-text-2">
            <summary class="cursor-pointer text-text-3">Earlier check-ins · {h.checkins.length - 1}</summary>
            <div class="mt-3 flex flex-col gap-4">
              {h.checkins.slice(1).map((c) => <div key={c.id}><div class="font-mono text-[11px] text-text-3">{c.kind === "week" ? "Monday" : c.kind === "month" ? "Month read" : "The whole road"} · {dayMonthYear(c.for_date)}</div><p class="m-0 mt-1 max-w-[640px] leading-relaxed">{c.text}</p></div>)}
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
        <Quiet>Every Monday: a short check-in against the targets{h.send_to_coach ? ", also sent to your coach in Messages" : ""}. Each month's end: a Guide read of the month on the horizon. On the date: a read of the whole road, and the choice to set the next horizon.</Quiet>
      </Card>

      {owner && (
        <Card>
          <H2>Check-ins and who sees them</H2>
          <div class="flex flex-col">
            {([["checkin_monday", "Monday morning check-in against the targets"], ["checkin_month", "A Guide read at each month's end"], ["send_to_coach", "Send each check-in to my coach"]] as const).map(([key, label], i) => (
              <label class={`flex items-center justify-between gap-3 py-3 text-[15px] text-text ${i ? "border-t border-border" : ""}`} key={key}>
                <span>{label}</span>
                <input type="checkbox" checked={h[key]} disabled={closed} onChange={(e) => void toggle(key, (e.currentTarget as HTMLInputElement).checked)} class="h-5 w-5 accent-[#A9ABF7]" />
              </label>
            ))}
          </div>
          <div class="flex flex-wrap items-center gap-3">
            {!closed && <Button onClick={() => void stop()}>Stop this horizon</Button>}
            <Quiet>Check-ins describe pace. They do not change the plan; your coach does, or you do. Stopping keeps the readings.</Quiet>
          </div>
        </Card>
      )}

      <div class="flex flex-wrap items-center gap-3 rounded-[16px] border border-accent-border bg-accent-fill px-5 py-4 text-[13px] text-text-2">
        <span class="font-mono text-[11px] font-medium text-accent-text">Pro</span>
        <span>Horizon is part of Pro on the website. Free keeps Overview, In depth, Body and the Guide's read. A horizon can be stopped any time; the readings stay.</span>
      </div>
    </>
  );
}

/** One more target on a running horizon: the marker, its reading now, the number, the pace it implies. */
function AddTarget({ person, today, taken, weeks, onAdd, onCancel }: { person: PersonData; today: string; taken: MarkerKey[]; weeks: number; onAdd: (t: Omit<StartTarget, "cadence"> & { cadence: any }) => void; onCancel: () => void }) {
  const free = MARKERS.filter((m) => !taken.includes(m.key));
  const [key, setKey] = useState<MarkerKey>(free[0]?.key ?? "mets");
  const [value, setValue] = useState("");
  const def = MARKER_BY_KEY[key];
  const now = latestOf(key, person, today);
  const unit = now?.unit ?? def.unit;
  const n = Number(value);
  const note = value && Number.isFinite(n) ? impliedPace(def, now, n, weeks, historyOf(key, person, today), today, def.standing ? weeklyHistory(person, key, today, 13) : undefined) : def.how;
  return (
    <div class="flex flex-col gap-3 rounded-[10px] border border-border-strong bg-alt p-4">
      <div class="flex flex-wrap items-center gap-2">
        <select value={key} onChange={(e) => { setKey((e.currentTarget as HTMLSelectElement).value as MarkerKey); setValue(""); }} class={`${inputClass} text-[13px]`}>
          {free.map((m) => <option value={m.key}>{m.label}</option>)}
        </select>
        <span class="text-[12px] text-text-3">{now ? `now ${now.display ?? fmtValue(def, now.value)} ${unit}` : "no reading yet"}</span>
        <input type="number" step={10 ** -def.decimals} value={value} onInput={(e) => setValue((e.currentTarget as HTMLInputElement).value)} placeholder="—" class={`${inputClass} w-28 font-mono`} aria-label={`${def.label} target`} />
        <span class="font-mono text-[11px] text-text-3">{unit}</span>
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

function Setup({ deps, person, today, personId, hasOthers, nav, onStarted, onError, onCancel }: {
  deps: HorizonDeps; person: PersonData | null; today: string; personId: string; hasOthers: boolean; nav: any;
  onStarted: (id: string) => Promise<void>; onError: (e: ApiError, retry: () => void) => boolean; onCancel: () => void;
}) {
  const [kind, setKind] = useState<"date" | 3 | 6 | 12>("date");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [shown, setShown] = useState<MarkerKey[]>(FIRST_MARKERS);
  const [allShown, setAllShown] = useState(false);
  const [planChoice, setPlanChoice] = useState<"coach" | "guide">("coach");
  const [planRows, setPlanRows] = useState<PlanRow[] | null>(null);
  const [editingDraft, setEditingDraft] = useState(false);
  const [monday, setMonday] = useState(true);
  const [month, setMonth] = useState(true);
  const [toCoach, setToCoach] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const endsOn = kind === "date" ? date : addMonths(today, kind);
  const days = endsOn ? daysBetween(today, endsOn) : 0;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const guideRows = useMemo(() => (person ? guideDraftPlan(person, today) : []), [person, today]);
  useEffect(() => { if (planChoice === "guide" && planRows == null) setPlanRows(guideRows); }, [planChoice]);

  const draft = (k: MarkerKey): Draft => drafts[k] ?? { ticked: false, value: "" };
  const setDraft = (k: MarkerKey, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [k]: { ...draft(k), ...patch } }));
  const rowsShown = allShown ? MARKERS.map((m) => m.key) : shown;
  const rest = MARKERS.filter((m) => !rowsShown.includes(m.key));

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
        plan: { rows: planChoice === "guide" ? (planRows ?? guideRows) : [], author: planChoice === "guide" ? "guide" : null },
        checkin_monday: monday, checkin_month: month, send_to_coach: toCoach,
      });
      setBusy(false);
      if (!res.ok) { if (!onError(res.error, () => void go())) setProblem(res.detail ? `${ERROR_WORDS[res.error]} ${res.detail}` : ERROR_WORDS[res.error]); return; }
      await onStarted(res.data.id);
    };
    await go();
  }

  return (
    <form class="flex max-w-[980px] flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void start(); }}>
      <header class="flex flex-col gap-2">
        <Eyebrow>Horizon · new</Eyebrow>
        <h1 class="m-0 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-text">Set a horizon</h1>
        <p class="m-0 text-[15px] leading-relaxed text-text-2">Four steps. You choose the date and the numbers; Verve tells you the pace they imply, and then whether the weeks keep it.</p>
        {hasOthers && <div class="mt-1">{nav}</div>}
      </header>

      <Step n={1} title="What is it for?">
        <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Opt on={kind === "date"} onPick={() => setKind("date")} title="A date" sub="A race, an event, a check-up" />
          {([3, 6, 12] as const).map((m) => <Opt key={m} on={kind === m} onPick={() => setKind(m)} title={`${m} months`} sub={`to ${dayMonthYear(addMonths(today, m))}`} />)}
        </div>
        {kind === "date" && (
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-1 basis-[260px] flex-col gap-1"><Eyebrow>Name</Eyebrow><input type="text" value={title} maxLength={80} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} placeholder="Boston Marathon" class={inputClass} /></label>
            <label class="flex flex-col gap-1"><Eyebrow>Date</Eyebrow><input type="date" value={date} min={addDays(today, 7)} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} class={`${inputClass} font-mono`} /></label>
            {days > 0 && <span class="pb-2 text-[13px] text-text-2">{days} days · {weeks} weeks</span>}
          </div>
        )}
      </Step>

      <Step n={2} title="What should be different by then?">
        <p class="m-0 text-[13px] leading-relaxed text-text-2">Tick a marker and set the number. Under each, the pace it implies from where you are today. Nothing here is a recommendation; it is arithmetic on your own readings.</p>
        {!person && <Quiet>Reading your numbers…</Quiet>}
        <div class="flex flex-col">
          {rowsShown.map((k, i) => {
            const def = MARKER_BY_KEY[k]; const d = draft(k);
            const now = person ? latestOf(k, person, today) : null;
            const unit = now?.unit ?? def.unit;
            const n = Number(d.value);
            const note = d.ticked && d.value !== "" && Number.isFinite(n) && person
              ? impliedPace(def, now, n, weeks, historyOf(k, person, today), today, def.standing ? weeklyHistory(person, k, today, 13) : undefined)
              : d.ticked ? "Set the number." : def.how;
            return (
              <div class={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-3 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,.7fr)_auto] ${i ? "border-t border-border" : ""}`} key={k}>
                <input type="checkbox" checked={d.ticked} onChange={(e) => setDraft(k, { ticked: (e.currentTarget as HTMLInputElement).checked })} aria-label={def.label} class="h-5 w-5 accent-[#A9ABF7]" />
                <span class="text-[15px] text-text">{def.label} <span class="text-[12px] text-text-3">{now ? `${def.kind === "blood" ? "" : "now "}${now.display ?? fmtValue(def, now.value)} ${unit}${def.kind === "blood" ? ` on ${dayMonthLong(now.on)}` : ""}` : "no reading yet"}</span></span>
                <input type="number" step={10 ** -def.decimals} value={d.value} placeholder="—" disabled={!d.ticked} onInput={(e) => setDraft(k, { value: (e.currentTarget as HTMLInputElement).value })} aria-label={`${def.label} target`} class={`${inputClass} col-start-2 w-28 font-mono md:col-start-auto`} />
                <span class="font-mono text-[11px] text-text-3">{unit}</span>
                <span class={`col-span-2 text-[12px] leading-relaxed md:col-span-4 md:pl-8 ${d.ticked ? "text-text-2" : "text-text-3"}`}>{note}</span>
              </div>
            );
          })}
        </div>
        {rest.length > 0 && (
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[12px] text-text-3">Add another:</span>
            {rest.slice(0, 6).map((m) => <button type="button" key={m.key} onClick={() => setShown((s) => [...s, m.key])} class="rounded-full border border-border px-3 py-1 text-[12px] text-text-2 hover:border-accent-border">{m.label}</button>)}
            {!allShown && <button type="button" onClick={() => setAllShown(true)} class="rounded-full border border-accent-border bg-accent-fill px-3 py-1 text-[12px] text-accent-text">Any of the {MARKERS.length}</button>}
          </div>
        )}
        {allShown && <Quiet>{Object.entries(GROUP_LABEL).map(([g, l]) => `${l}: ${MARKERS.filter((m) => m.group === g).map((m) => m.label).join(", ")}`).join(" · ")}</Quiet>}
      </Step>

      <Step n={3} title="The week that gets you there">
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Opt on={planChoice === "coach"} onPick={() => setPlanChoice("coach")} title="Ask my coach to write the plan" sub="Your coach sees the targets and the pace notes, writes the week in Messages, and can change it any time." />
          <Opt on={planChoice === "guide"} onPick={() => setPlanChoice("guide")} title="Let the Guide draft one" sub="From your last eight weeks: how many sessions, how much in zone 2, strength, bedtime. You edit it before it starts." />
        </div>
        {planChoice === "guide" && (editingDraft
          ? <PlanEditor rows={planRows ?? guideRows} busy={false} onCancel={() => setEditingDraft(false)} onSave={(rows) => { setPlanRows(rows); setEditingDraft(false); }} />
          : <div class="flex flex-col gap-2">
              {(planRows ?? guideRows).length ? (planRows ?? guideRows).map((r, i) => <div class="text-[15px] text-text" key={i}>{r.label}</div>) : <Quiet>Not enough weeks on file for a draft yet; write the plan after the horizon starts.</Quiet>}
              <div><button type="button" onClick={() => setEditingDraft(true)} class="text-[13px] font-semibold text-text-2 hover:text-text">Edit the draft</button></div>
            </div>)}
      </Step>

      <Step n={4} title="Check-ins">
        <div class="flex flex-col">
          {([["Monday morning check-in against the targets", monday, setMonday], ["A Guide read at each month's end", month, setMonth], ["Send each check-in to my coach", toCoach, setToCoach]] as const).map(([label, on, set], i) => (
            <label class={`flex items-center justify-between gap-3 py-3 text-[15px] text-text ${i ? "border-t border-border" : ""}`} key={label}>
              <span>{label}</span>
              <input type="checkbox" checked={on} onChange={(e) => (set as (v: boolean) => void)((e.currentTarget as HTMLInputElement).checked)} class="h-5 w-5 accent-[#A9ABF7]" />
            </label>
          ))}
        </div>
        <Quiet>Check-ins describe pace. They do not change the plan; your coach does, or you do.</Quiet>
      </Step>

      {problem && <div class="rounded-[10px] border border-caution/40 bg-alt px-4 py-3 text-[13px] text-caution">{problem}</div>}
      <div class="flex flex-wrap items-center gap-3">
        <Button type="submit" primary disabled={busy}>{busy ? "Starting…" : "Start the horizon"}</Button>
        <Button onClick={onCancel}>Cancel</Button>
        <span class="ml-auto text-[12px] text-text-3">Pro · stop it any time, the readings stay</span>
      </div>
    </form>
  );
}
