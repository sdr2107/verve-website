/**
 * "Add a fitness test": upload a treadmill report, check what was read, save (the founder, 26 November 2026: "I want
 * an option on the app and website to upload the treadmill test report, it parses and adds the date, the METs value
 * and other relevant info and saves it to the CRF test card"; the three steps are the sketch he approved on
 * 27 November 2026). For every account, on the person's own page.
 *
 *   1  Fitness test        one box, "Upload a treadmill report · A PDF or a photo", and "Or type the result" (the card
 *                          that has typed a result since 17 November: ./FitnessEntry.tsx).
 *   2  Check what was read the date, the METs, the protocol, the time, the peak heart rate, why it stopped, and the
 *                          conclusion as printed. "Fix a line" turns the lines into fields. A line the reader did not
 *                          find is empty for the person; nothing is guessed, and nothing says what a result means.
 *   3  Saved               one row where fitness tests already live, with the report's lines beside it. The Fitness
 *                          card on Overview says it back (./Overview.tsx), and a horizon asks about the new test by
 *                          itself (horizon/newTest.ts).
 *
 * The upload is the page's own (actions.readFile): the same bucket, the same reader and the same privacy as Reports.
 * Calm and short, as the founder asked of every page on 27 November: one typeface, no paragraph.
 */
import { render } from "preact";
import { useState } from "preact/hooks";
import { effect, signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { actions, derived, person as personSignal } from "../state.ts";
import { todayStr } from "../derive/format.ts";
import { methodFamily } from "../horizon/derive.ts";
import { CONCLUSION_WORDS, crfRow, onFileAlready, parseTestRead, type TestRead } from "../horizon/fitnessEntry.ts";
import { DATE_UNSURE, NOT_A_TEST, NOT_READ, checkedOf, detailRowsOf, draftFrom, rowsOf, type DetailRow, type Draft, type RowKey } from "../fitnessTest.ts";
import { keepFitnessTest, loadTestDetails } from "../fitnessTestApi.ts";
import { fitnessKept, openFitnessCard, profileOf } from "./FitnessEntry.tsx";

// ── opening it from anywhere ──

type Flow = { step: "add" } | { step: "check"; read: TestRead; path: string; fileName: string };
const flow = signal<Flow | null>(null);
/** Step 1, from the Fitness card's "Add a fitness test". */
export const openTestAdd = () => { flow.value = { step: "add" }; };
/**
 * Step 2, on a report the page has read (the card's own upload, or a file dropped into Reports). False when the file
 * is not a treadmill or mask test: the page then keeps it as a file, as it always has.
 */
export function openTestCheck(out: unknown, path: string, fileName: string): boolean {
  const read = parseTestRead(out);
  if (!read) return false;
  flow.value = { step: "check", read, path, fileName };
  return true;
}
/** The person's own readings that carry a report's lines, for the Fitness card. Empty before the column exists. */
export const testDetailRows = signal<DetailRow[]>([]);

export type FitnessTestDeps = { supabase: SupabaseClient; userId: () => string | null | Promise<string | null>; /** Read the person's document again, so the new reading shows everywhere. */ refresh: () => Promise<void> | void };

// ── small parts ──

const inputClass = "min-h-10 w-full rounded-[10px] border border-border bg-alt px-3 text-[15px] text-text outline-none focus:border-accent-border";
const primary = "inline-flex min-h-10 items-center justify-center rounded-[10px] bg-accent px-5 text-[14px] font-semibold text-canvas disabled:opacity-50";
const plain = "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-border-strong bg-alt px-4 text-[14px] font-medium text-text hover:border-accent-border disabled:opacity-50";
const link = "min-h-9 self-start text-[13px] font-semibold text-accent-text hover:text-text";

function Shell({ title, sub, step, onClose, children }: { title: string; sub?: string | null; step: "add" | "check"; onClose: () => void; children: any }) {
  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:items-center" role="dialog" aria-modal="true" aria-label={title} data-fit-test={step}>
      <section class="flex w-full max-w-[440px] flex-col gap-4 rounded-[16px] border border-border-strong bg-card p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <h2 class="m-0 text-[18px] font-semibold text-text">{title}</h2>
            {sub ? <span class="truncate text-[13px] text-text-2">{sub}</span> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" class="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[18px] leading-none text-text-2 hover:text-text" data-fit-test="close">&times;</button>
        </div>
        {children}
      </section>
    </div>
  );
}

// ── step 1: upload, or type ──

function Add({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  async function upload() {
    setNote(""); setBusy(true);
    const res = await actions.readFile("exercise_test");
    setBusy(false);
    if (!res) return;
    if ("error" in res) { setNote(res.error); return; }
    if (!openTestCheck(res.out, res.path, res.name)) setNote(NOT_A_TEST);
  }
  return (
    <Shell title="Fitness test" step="add" onClose={onClose}>
      <button type="button" disabled={busy} onClick={() => void upload()} data-fit-test="upload"
        class="flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border-strong bg-alt px-4 py-5 text-center hover:border-accent-border disabled:opacity-60">
        <span class="text-[15px] font-medium text-text">{busy ? "Reading…" : "Upload a treadmill report"}</span>
        <span class="text-[13px] text-text-2">A PDF or a photo</span>
      </button>
      {note ? <p class="m-0 text-[13px] leading-relaxed text-text" data-fit-test="problem">{note}</p> : null}
      <button type="button" class={link} data-fit-test="type" onClick={() => { onClose(); openFitnessCard({ kinds: ["treadmill", "mask", "walk6", "cooper", "run15", "walk1", "watch"] }); }}>Or type the result</button>
    </Shell>
  );
}

// ── step 2: check what was read ──

function Check({ read, path, fileName, deps, onClose }: { read: TestRead; path: string; fileName: string; deps: FitnessTestDeps; onClose: () => void }) {
  const today = todayStr();
  const mask = read.mask;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(read));
  const rows = rowsOf(draft, mask);
  // a line the test cannot be saved without is opened for the person at once: the date, and the figure itself
  const needs = (d: Draft) => !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || (mask ? d.vo2.trim() === "" : d.mets.trim() === "");
  const [fix, setFix] = useState(() => needs(draftFrom(read)));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ why: string; row: RowKey | null } | null>(null);
  const set = (k: keyof Draft, v: string) => { setDraft((d) => ({ ...d, [k]: v })); setProblem(null); };
  // the reader could not settle the day: said under the date, until the person has typed one
  const unsure = !!read.dateUnsure && !/^\d{4}-\d{2}-\d{2}$/.test(draft.date);

  async function save() {
    const p = derived.value, who = personSignal.value;
    const profile = profileOf(p, draft.date);
    const c = checkedOf(draft, mask, profile, today);
    if (!c.ok) { setProblem({ why: c.why, row: c.row }); setFix(true); return; }
    if (!who?.self || !p) { setProblem({ why: "A fitness test is kept on your own page only.", row: null }); return; }
    if (onFileAlready(p.crf as any[], draft.date, c.result.method, c.result.mets)) { setProblem({ why: "This test is on file already: the same day and the same METs.", row: null }); return; }
    const uid = await deps.userId();
    if (!uid) { setProblem({ why: "Sign in again to save it.", row: null }); return; }
    const made = crfRow({ id: `web-${crypto.randomUUID()}`, userId: uid, kind: c.kind, fields: c.fields, result: c.result, profile, from: "report", now: new Date().toISOString() });
    if ("error" in made) { setProblem({ why: made.error, row: null }); return; }
    setBusy(true); setProblem(null);
    const kept = await keepFitnessTest(deps.supabase, made.row, c.details);
    if (kept.error) { setBusy(false); setProblem({ why: `That was not saved: ${kept.error}`, row: null }); return; }
    // the report's own conclusion, word for word, kept as the report's and read by nothing (as the typed card keeps it)
    if (read.conclusion && path) {
      await deps.supabase.from("imaging_reports").upsert({ id: crypto.randomUUID(), user_id: uid, ...(who.id ? { person_id: who.id } : {}), modality: mask ? "exercise test with a mask" : "treadmill test",
        report_date: draft.date, report_path: path, impression: read.conclusion, findings: null }, { onConflict: "user_id,report_path" });
    }
    await deps.refresh();
    setBusy(false);
    fitnessKept.value = { family: methodFamily(c.result.method) ?? c.result.method, at: Date.now() };
    onClose();
  }

  const field = (k: RowKey) => {
    if (k === "date") return <input type="date" value={draft.date} max={today} onInput={(e) => set("date", (e.currentTarget as HTMLInputElement).value)} class={inputClass} aria-label="Date of the test" />;
    if (k === "mets") return <input type="text" inputMode="decimal" value={draft.mets} onInput={(e) => set("mets", (e.currentTarget as HTMLInputElement).value)} class={`${inputClass} t-figure-row`} aria-label="METs reached" />;
    if (k === "vo2") return <input type="text" inputMode="decimal" value={draft.vo2} onInput={(e) => set("vo2", (e.currentTarget as HTMLInputElement).value)} class={`${inputClass} t-figure-row`} aria-label="Peak oxygen, ml per kg per minute" />;
    if (k === "protocol") return <input type="text" value={draft.protocol} maxLength={60} placeholder="Bruce" onInput={(e) => set("protocol", (e.currentTarget as HTMLInputElement).value)} class={inputClass} aria-label="Protocol" />;
    if (k === "time") return <input type="text" value={draft.time} placeholder="9:20" onInput={(e) => set("time", (e.currentTarget as HTMLInputElement).value)} class={`${inputClass} t-figure-row`} aria-label="Time, minutes and seconds" />;
    if (k === "peak") return (
      <span class="flex flex-col gap-1">
      <span class="grid grid-cols-2 gap-2">
        <input type="text" inputMode="numeric" value={draft.peakHr} placeholder="beats" onInput={(e) => set("peakHr", (e.currentTarget as HTMLInputElement).value)} class={`${inputClass} t-figure-row`} aria-label="Peak heart rate, beats a minute" />
        <input type="text" inputMode="numeric" value={draft.peakPct} placeholder="% if printed" onInput={(e) => set("peakPct", (e.currentTarget as HTMLInputElement).value)} class={`${inputClass} t-figure-row`} aria-label="Percent of predicted, if the report prints it" />
      </span>
      <span class="text-[12px] text-text-2">Beats a minute, and the % of predicted if the report prints one.</span>
      </span>
    );
    return <input type="text" value={draft.stopped} maxLength={200} onInput={(e) => set("stopped", (e.currentTarget as HTMLInputElement).value)} class={inputClass} aria-label="Why the test stopped" />;
  };

  return (
    <Shell title="Check what was read" sub={`${mask ? "Exercise test with a mask" : "Treadmill test"}${fileName ? ` · ${fileName}` : ""}`} step="check" onClose={onClose}>
      <ul class="m-0 flex list-none flex-col p-0" data-fit-test="rows" data-fixing={fix ? "yes" : "no"}>
        {rows.map((r, i) => (
          <li key={r.key} data-fit-row={r.key} data-read={r.shown ? "yes" : "no"}
            class={`grid items-center gap-x-4 gap-y-1 py-2 ${fix ? "grid-cols-1 sm:grid-cols-[112px_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]"} ${i ? "border-t border-border" : ""}`}>
            <span class="text-[14px] text-text-2">{r.label}</span>
            {fix ? field(r.key)
              : <span class={`min-w-0 text-right ${r.shown ? (r.key === "mets" || r.key === "vo2" ? "t-figure-row text-text" : "text-[15px] text-text") : "text-[14px] text-text-2"}`}>{r.shown || NOT_READ}</span>}
            {r.key === "date" && unsure ? <span class="col-span-full text-[13px] leading-relaxed text-text" data-fit-test="date-unsure">{DATE_UNSURE}</span> : null}
          </li>
        ))}
      </ul>
      {read.conclusion ? (
        <div class="flex flex-col gap-1" data-fit-test="conclusion">
          <p class="m-0 text-[13px] leading-relaxed text-text-2">Conclusion, as printed: <span class="text-text">&ldquo;{read.conclusion}&rdquo;</span></p>
          <p class="m-0 text-[12px] leading-relaxed text-text-2">{CONCLUSION_WORDS}</p>
        </div>
      ) : null}
      {problem ? <p class="m-0 text-[13px] leading-relaxed text-text" data-fit-test="problem">{problem.why}</p> : null}
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class={primary} disabled={busy} onClick={() => void save()} data-fit-test="save">{busy ? "Saving…" : "Save"}</button>
        <button type="button" class={plain} disabled={busy} onClick={() => setFix((f) => !f)} data-fit-test="fix">{fix ? "Done" : "Fix a line"}</button>
      </div>
    </Shell>
  );
}

function Host({ deps }: { deps: FitnessTestDeps }) {
  const f = flow.value;
  const close = () => { flow.value = null; };
  if (!f) return null;
  return f.step === "add" ? <Add onClose={close} /> : <Check key={f.path} read={f.read} path={f.path} fileName={f.fileName} deps={deps} onClose={close} />;
}

/** The card's one place on the page, over any tab; and the report lines of the person's own readings, read when a reading is added. */
export function mountFitnessTest(el: HTMLElement, deps: FitnessTestDeps) {
  render(<Host deps={deps} />, el);
  let asked = "";
  effect(() => {
    const d = derived.value, who = personSignal.value;
    if (!d || !who?.self) { asked = ""; testDetailRows.value = []; return; }
    // the readings on file, as a key: the lines are read again only when the person or their readings change
    const key = `${who.id}:${d.crf.length}:${String(d.crf[d.crf.length - 1]?.measured_on ?? "")}`;
    if (key === asked) return;
    asked = key;
    void Promise.resolve(deps.userId()).then((uid) => (uid ? loadTestDetails(deps.supabase, uid) : [])).then((rows) => { if (asked === key) testDetailRows.value = detailRowsOf(rows); }).catch(() => { /* the card says the reading without its lines */ });
  });
}
