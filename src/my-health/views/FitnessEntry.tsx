/**
 * Fitness: choose the test, then type it or add the report (canvas "Verve, Horizon as a programme", board 16; built
 * on the founder's word of 17 November 2026, for test accounts only).
 *
 *   FitnessChooser   in the set-up, once "Fitness" is ticked: "How will fitness be measured on this horizon?" Five
 *                    tests, the surest first, each with how far off it can be and what is on file. A test with a
 *                    reading is kept to; one without can be taken, typed, or read from a report.
 *   the card         one card, opened from anywhere (openFitnessCard): the fields change with the test. From a
 *                    report it opens on what was read, for the person to check and correct, with the report's own
 *                    conclusion shown word for word and used by nothing.
 *
 * Nothing here works a number out: ../horizon/fitnessEntry.ts does, with the app's own equations. A reading is filed
 * where the app files its own tests, so it shows on Overview, on the horizon and on the phone from one row.
 *
 * A watch's estimate can be typed (the founder, 17 November 2026: a device may make an estimate and not send it). It
 * is kept as the device's estimate, never as a test.
 */
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { actions, derived, person as personSignal } from "../state.ts";
import { weightSeries } from "../derive/lenses.ts";
import { todayStr } from "../derive/format.ts";
import { methodLabel } from "../derive/markers.ts";
import { MARKER_BY_KEY, dayMonthLong, fitnessReadings, fmtValue, methodFamily, type DoorReading } from "../horizon/derive.ts";
import { AGAIN_RULE, DOOR_BY_KEY, ENTRY_LABEL, ENTRY_METHOD, FITNESS_TESTS, ONE_MILE_NOTE, WATCH_TYPED, doiUrl, type EntryKey, type FitnessTest, type Line } from "../../data/programme.ts";
import {
  CONCLUSION_WORDS, ENTRY_FIELDS, clockWords, crfRow, entryFromRead, entryResult, minutesOf, onFileAlready, parseTestRead,
  type EntryField, type EntryFields, type EntryProfile, type TestRead,
} from "../horizon/fitnessEntry.ts";
import { keepFitnessReading } from "../horizon/api.ts";

// ── opening the card from anywhere ──

export type CardStart = {
  /** The tests the card offers, the first one open. All of them when absent. */ kinds?: EntryKey[];
  /** What a report's reader answered, and the file it came from. */ read?: TestRead | null; path?: string | null; fileName?: string | null;
};
const card = signal<CardStart | null>(null);
export const openFitnessCard = (s: CardStart) => { card.value = s; };
/** The reading just kept: the set-up keeps its fitness number to that test. */
export const fitnessKept = signal<{ family: string; at: number } | null>(null);
/**
 * A report the page has read: open the card on it when it is a treadmill or mask test, and say so. False for any
 * other kind of document, which the page then files as it always has.
 */
export function openFitnessRead(out: unknown, path: string, fileName: string): boolean {
  const read = parseTestRead(out);
  if (!read) return false;
  openFitnessCard({ read, path, fileName });
  return true;
}

// ── small parts ──

const Eyebrow = ({ children }: { children: any }) => <div class="font-mono text-[11px] font-medium text-text-3">{children}</div>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;
const Button = ({ children, onClick, primary, disabled }: { children: any; onClick?: () => void; primary?: boolean; disabled?: boolean }) => (
  <button type="button" disabled={disabled} onClick={onClick} class={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-[13px] font-semibold disabled:opacity-50 ${primary ? "bg-accent text-canvas" : "border border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
const Small = ({ children, onClick, href }: { children: any; onClick?: () => void; href?: string }) => href
  ? <a href={href} class="inline-flex min-h-9 items-center rounded-[10px] border border-border-strong bg-alt px-3 text-[12px] font-semibold text-text hover:border-accent-border">{children}</a>
  : <button type="button" onClick={onClick} class="inline-flex min-h-9 items-center rounded-[10px] border border-border-strong bg-alt px-3 text-[12px] font-semibold text-text hover:border-accent-border">{children}</button>;
const Chip = ({ on, onPick, children }: { on: boolean; onPick: () => void; children: any }) => (
  <button type="button" onClick={onPick} aria-pressed={on} class={`inline-flex min-h-9 items-center rounded-full border px-3 text-left text-[13px] font-medium ${on ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-alt text-text hover:border-accent-border"}`}>{children}</button>
);
const Evidence = ({ line }: { line: Line }) => (
  <p class="m-0 border-l-2 border-border pl-3 text-[13px] leading-relaxed text-text">{line.text}{" "}
    {line.cites.map((c, i) => { const u = doiUrl(c); return <span class="font-mono text-[11px] text-text-3" key={c}>{i ? " · " : ""}{u ? <a href={u} target="_blank" rel="noopener" class="underline-offset-2 hover:underline">{c}</a> : c}</span>; })}
  </p>
);
const inputClass = "min-h-10 w-full rounded-[10px] border border-border bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border";
/** How a family is said in a sentence: "six-minute walk", "one-mile walk", "your watch's estimate". */
const familyWords = (r: DoorReading): string => (r.writer ? methodLabel(r.writer.toLowerCase().replace(/[\s_]+/g, "-")) : r.door ? DOOR_BY_KEY[r.door].title.replace(/^(A|Your) /, "").replace(/^./, (c) => c.toLowerCase()) : "a reading");

// ── the chooser (the set-up, once Fitness is ticked) ──

/** Each test's readings on file: the latest of every family it holds, the newest first. */
export function testsOnFile(person: PersonData): { test: FitnessTest; readings: DoorReading[] }[] {
  const all = fitnessReadings(person);
  return FITNESS_TESTS.map((test) => ({
    test,
    readings: test.families.flatMap((f) => { const r = [...all].reverse().find((x) => x.family === f); return r ? [r] : []; }).sort((a, b) => b.on.localeCompare(a.on)),
  }));
}

export function FitnessChooser({ person, method, onPick }: { person: PersonData; method: string | null; onPick: (family: string) => void }) {
  const rows = useMemo(() => testsOnFile(person), [person]);
  const [note, setNote] = useState("");
  const [reading, setReading] = useState(false);
  const def = MARKER_BY_KEY.mets;
  // a reading just kept through the card is the one the horizon is kept to
  const kept = fitnessKept.value;
  useEffect(() => { if (kept) onPick(kept.family); }, [kept?.at]);

  async function addReport() {
    setNote(""); setReading(true);
    const res = await actions.readFile("exercise_test");
    setReading(false);
    if (!res) return;
    if ("error" in res) { setNote(res.error); return; }
    if (!openFitnessRead(res.out, res.path, res.name)) setNote("That file was not read as a treadmill test or a test with a mask. It is kept in Reports, and nothing was filed from it.");
  }
  const picked = method ? rows.find((r) => r.test.families.includes(method)) ?? null : null;

  return (
    <div class="col-span-2 flex flex-col gap-3 rounded-[12px] border border-accent-border bg-card p-4 md:col-span-4">
      <div class="flex flex-col gap-1">
        <span class="text-[15px] font-semibold text-text">How will fitness be measured on this horizon?</span>
        <span class="text-[13px] leading-relaxed text-text-2">One test, from the first day to the date. The surest comes first. Choose one you can do again.</span>
      </div>
      <div class="flex flex-col">
        {rows.map(({ test, readings }, i) => {
          const on = !!method && test.families.includes(method);
          return (
            <div class={`grid grid-cols-1 gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1.5fr)] ${i ? "border-t border-border" : ""} ${on ? "-mx-2 rounded-[10px] border border-accent-border bg-accent-fill px-2" : ""}`} key={test.door}>
              <div class="flex flex-col gap-0.5">
                <span class="text-[14px] font-semibold text-text">{test.title}</span>
                <span class="text-[12px] leading-relaxed text-text-2">{test.what}</span>
                <span class="text-[12px] leading-relaxed text-text-3">{test.who}</span>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="font-mono text-[13px] font-semibold text-text">{test.error}</span>
                <span class="text-[12px] leading-relaxed text-text-3">{test.errorSub}</span>
              </div>
              <div class="flex flex-col gap-2">
                {readings.length ? (
                  <div class="flex flex-wrap gap-1.5">
                    {readings.map((r) => <Chip key={r.family ?? r.on} on={method === r.family} onPick={() => r.family && onPick(r.family)}>{method === r.family ? "Kept to this" : "Keep to this"} · {fmtValue(def, r.value)} METs, {familyWords(r)}, {dayMonthLong(r.on)}</Chip>)}
                  </div>
                ) : <span class="text-[12px] text-text-3">{test.door === "watch" ? "Your device has not sent an estimate." : "Nothing on file."}</span>}
                <div class="flex flex-wrap gap-1.5">
                  {test.inApp ? <Small href="/get/">Take it in the app</Small> : null}
                  {test.door === "walk" ? <Small href="/sheet/">On paper: the six-minute sheet</Small> : null}
                  <Small onClick={() => openFitnessCard({ kinds: test.entries })}>{test.door === "watch" ? "Type it from your device's app" : readings.length ? "Type another result" : "Type the result"}</Small>
                  {test.report ? <Small onClick={() => void addReport()}>{reading ? "Reading…" : "Add the report"}</Small> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {note ? <p class="m-0 text-[13px] leading-relaxed text-caution">{note}</p> : null}
      {picked ? <Evidence line={method === "one-mile-walk" ? ONE_MILE_NOTE : DOOR_BY_KEY[picked.test.door].errorNote} /> : <Quiet>No test is chosen. A fitness number needs one before the horizon is kept.</Quiet>}
      <Evidence line={AGAIN_RULE} />
      <Quiet>The order is fixed, surest first. The page marks no test as best for you. A reading by another test is filed and shown, and is never compared with the start.</Quiet>
    </div>
  );
}

// ── the card ──

export type FitnessCardDeps = { supabase: SupabaseClient; userId: () => string | null | Promise<string | null>; /** Read the person's document again, so the new reading shows everywhere. */ refresh: () => Promise<void> | void };

/** What the equations need, from the person's document: age on the day of the test, sex, the latest weight, height. */
export function profileOf(p: PersonData | null, on: string): EntryProfile {
  const pr = p?.profile ?? null;
  const born = typeof pr?.date_of_birth === "string" && /^\d{4}-\d{2}-\d{2}/.test(pr.date_of_birth) ? pr.date_of_birth.slice(0, 10) : null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : todayStr();
  const age = born ? Number(day.slice(0, 4)) - Number(born.slice(0, 4)) - (day.slice(5) < born.slice(5) ? 1 : 0) : Number(pr?.age) > 0 ? Number(pr.age) : null;
  const weights = p ? weightSeries(p.weights).filter((w) => w.d <= day) : [];
  const weightKg = weights.length ? weights[weights.length - 1].v : Number(pr?.weight_kg) > 0 ? Number(pr.weight_kg) : null;
  return { age: age != null && age > 0 ? age : null, sex: pr?.sex === "female" ? "female" : pr?.sex ? "male" : null, weightKg, heightCm: Number(pr?.height_cm) > 0 ? Number(pr.height_cm) : null };
}

type Typed = Record<EntryField, string>;
const blank: Typed = { mets: "", vo2: "", protocol: "", minutes: "", metres: "", heartRate: "" };
const typedFrom = (f: EntryFields): Typed => ({
  mets: f.mets != null ? String(f.mets) : "", vo2: f.vo2 != null ? String(f.vo2) : "", protocol: f.protocol ?? "", minutes: f.minutes != null ? clockWords(f.minutes) : "",
  metres: f.metres != null ? String(f.metres) : "", heartRate: f.heartRate != null ? String(f.heartRate) : "",
});
const numberOf = (s: string): number | null => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

function Card({ start, deps, onClose }: { start: CardStart; deps: FitnessCardDeps; onClose: () => void }) {
  const p = derived.value, who = personSignal.value;
  const today = todayStr();
  const fromRead = start.read ? entryFromRead(start.read) : null;
  const kinds: EntryKey[] = fromRead ? (["mask", "treadmill"] as EntryKey[]) : start.kinds?.length ? start.kinds : (Object.keys(ENTRY_LABEL) as EntryKey[]);
  const [kind, setKind] = useState<EntryKey>(fromRead?.kind ?? kinds[0]);
  const [date, setDate] = useState(fromRead?.fields.date || "");
  const [where, setWhere] = useState("");
  const [typed, setTyped] = useState<Typed>(fromRead ? typedFrom(fromRead.fields) : blank);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const fields: EntryFields = { date, where, mets: numberOf(typed.mets), vo2: numberOf(typed.vo2), protocol: typed.protocol.trim() || null, minutes: minutesOf(typed.minutes), metres: numberOf(typed.metres), heartRate: numberOf(typed.heartRate) };
  const profile = profileOf(p, date);
  const result = entryResult(kind, fields, profile, today);
  const self = !!who?.self;

  async function keep() {
    if (!result.ok) { setProblem(result.why); return; }
    if (!self || !p) { setProblem("A fitness reading is kept on your own page only: it is filed with your app's tests."); return; }
    if (onFileAlready(p.crf as any[], date, result.method, result.mets)) { setProblem("A reading like this one is on file already: the same day, the same test, the same METs."); return; }
    const uid = await deps.userId();
    if (!uid) { setProblem("Sign in again to keep it."); return; }
    const made = crfRow({ id: `web-${crypto.randomUUID()}`, userId: uid, kind, fields, result, profile, from: start.read ? "report" : kind === "watch" ? "device" : "typed", now: new Date().toISOString() });
    if ("error" in made) { setProblem(made.error); return; }
    setBusy(true); setProblem("");
    const err = await keepFitnessReading(deps.supabase, made.row);
    if (err) { setBusy(false); setProblem(`Could not keep it: ${err}`); return; }
    // the report's own conclusion, word for word, kept as the report's and read by nothing (as a heart scan's is)
    if (start.read?.conclusion && start.path) {
      await deps.supabase.from("imaging_reports").upsert({ id: crypto.randomUUID(), user_id: uid, ...(who?.id ? { person_id: who.id } : {}), modality: start.read.mask ? "exercise test with a mask" : "treadmill test",
        report_date: date, report_path: start.path, impression: start.read.conclusion, findings: null }, { onConflict: "user_id,report_path" });
    }
    await deps.refresh();
    setBusy(false);
    fitnessKept.value = { family: methodFamily(result.method) ?? result.method, at: Date.now() };
    onClose();
  }

  const read = start.read ?? null;
  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:items-center" role="dialog" aria-modal="true" aria-label="A fitness test result">
      <section class="flex w-full max-w-[560px] flex-col gap-4 rounded-[16px] border border-border-strong bg-card p-5">
        <div class="flex flex-col gap-1">
          <Eyebrow>{read ? `From a report${start.fileName ? ` · ${start.fileName}` : ""} · test account` : "A fitness test · test account"}</Eyebrow>
          <h2 class="m-0 text-[18px] font-semibold text-text">{read ? "What was read, for you to check" : kind === "watch" ? "Type your device's estimate" : "Type the result"}</h2>
          {read ? <p class="m-0 text-[13px] leading-relaxed text-text-2">Read from the printed text. Check each line against the report, and correct any that is wrong.</p> : null}
        </div>
        {kinds.length > 1 ? <div class="flex flex-wrap gap-1.5">{kinds.map((k) => <Chip key={k} on={kind === k} onPick={() => { setKind(k); setProblem(""); }}>{ENTRY_LABEL[k]}</Chip>)}</div> : null}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="flex flex-col gap-1"><Eyebrow>Date of the test</Eyebrow><input type="date" value={date} max={today} onInput={(e) => { setDate((e.currentTarget as HTMLInputElement).value); setProblem(""); }} class={`${inputClass} font-mono`} /></label>
          <label class="flex flex-col gap-1"><Eyebrow>Where · optional</Eyebrow><input type="text" value={where} maxLength={60} onInput={(e) => setWhere((e.currentTarget as HTMLInputElement).value)} class={inputClass} /></label>
        </div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ENTRY_FIELDS[kind].map((f) => (
            <label class={`flex flex-col gap-1 ${ENTRY_FIELDS[kind].length === 1 || f.field === "mets" ? "md:col-span-2" : ""}`} key={f.field}>
              <Eyebrow>{f.label}{f.unit ? ` · ${f.unit}` : ""}</Eyebrow>
              <input type="text" inputMode={f.field === "protocol" || f.field === "minutes" ? "text" : "decimal"} value={typed[f.field]} placeholder={f.field === "minutes" ? "9:12" : f.field === "protocol" ? "Bruce" : ""}
                onInput={(e) => { const v = (e.currentTarget as HTMLInputElement).value; setTyped((t) => ({ ...t, [f.field]: v })); setProblem(""); }} class={`${inputClass} font-mono`} />
            </label>
          ))}
        </div>
        {read ? (
          <div class="flex flex-col gap-2">
            {[["Oxygen measured", read.mask ? "Yes, with a mask" : "No. No mask was used."], ["Peak heart rate", read.peakHr != null ? `${read.peakHr}${read.peakHrPercent != null ? ` · ${read.peakHrPercent}% of predicted` : ""}` : "Not printed"], ["Why it stopped", read.stopped ? `"${read.stopped}"` : "Not printed"]].map(([k, v]) => (
              <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 border-t border-border pt-2 text-[13px]" key={k}><span class="text-text-2">{k}</span><span class="font-mono text-text">{v}</span></div>
            ))}
            {read.conclusion ? <>
              <span class="text-[13px] text-text-2">The report's own conclusion, word for word:</span>
              <p class="m-0 border-l-[3px] border-border-strong pl-3 text-[13px] leading-relaxed text-text">"{read.conclusion}"</p>
            </> : null}
            <Quiet>{CONCLUSION_WORDS}</Quiet>
          </div>
        ) : null}
        <div class="rounded-[10px] border border-border-strong bg-alt px-4 py-3">
          {result.ok
            ? <><div class="flex items-baseline gap-2"><span class="t-figure-row font-semibold text-text">{fmtValue(MARKER_BY_KEY.mets, result.mets)}</span><span class="font-mono text-[11px] text-text-3">METs{kind === "watch" ? " · estimate" : ""}</span></div><p class="m-0 mt-1 text-[12px] leading-relaxed text-text-2">{result.how}</p></>
            : <p class="m-0 text-[13px] leading-relaxed text-text-2">{result.why}</p>}
        </div>
        {kind === "watch" ? <Quiet>{WATCH_TYPED} It can be off by 13% on average, so a walk or a run shows a small change better.</Quiet> : null}
        {kind === "walk1" ? <Evidence line={ONE_MILE_NOTE} /> : null}
        {!self ? <Quiet>This page is not your own. A fitness reading is filed with a person's own app, so it can be kept only on their own page.</Quiet> : null}
        {problem ? <p class="m-0 rounded-[10px] border border-caution/40 bg-alt px-4 py-3 text-[13px] text-caution">{problem}</p> : null}
        <div class="flex flex-wrap items-center gap-3">
          <Button primary disabled={busy || !result.ok} onClick={() => void keep()}>{busy ? "Keeping…" : read ? "Keep the fitness reading" : "Keep it"}</Button>
          <Button onClick={onClose}>{read ? "Not this report" : "Cancel"}</Button>
        </div>
        <Quiet>It is filed where the app files its own tests, as {methodLabel(ENTRY_METHOD[kind])}, so Overview, your horizon and your phone read one list. A horizon kept to another test shows it beside its row and does not compare the two.</Quiet>
      </section>
    </div>
  );
}

function Host({ deps }: { deps: FitnessCardDeps }) {
  const start = card.value;
  // a new card for each opening, so nothing typed into the last one is carried over
  return start ? <Card key={JSON.stringify([start.kinds, start.path, start.read?.date])} start={start} deps={deps} onClose={() => { card.value = null; }} /> : null;
}
/** The card's one place on the page: opened by the set-up, by the horizon's fitness row and by a report the page has read. */
export function mountFitnessCard(el: HTMLElement, deps: FitnessCardDeps) {
  render(<Host deps={deps} />, el);
}
