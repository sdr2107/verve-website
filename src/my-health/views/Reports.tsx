/**
 * Reports as a view of the document: the archive a year at a time, one
 * card per file with what came out of it; the app's imports; the years
 * with movement on file. The folder listing and the values are in the
 * document; the archive's shape is ../derive/reports. Every write (read
 * the values, view, delete, send, rename, remove an import) is asked of
 * the page through actions.report, since the page owns the upload and
 * review flows. "Keep both" is a decision kept in this browser.
 */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import { derived, doc, person, searchQuery, activeTab, actions } from "../state.ts";
import { fmtDay } from "../derive/format.ts";
import { reportYears, pretty, isPhotoName, appImportsOf, appImportWords, importTitle, yearsOnFile, type ReportCard } from "../derive/reports.ts";

const keptKey = "mh-keep-both";
/** "Keep both" decisions, per file, kept in this browser; bumped so the cards redraw. */
const keptVersion = signal(0);
function keptSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(keptKey) ?? "[]")); } catch { return new Set(); }
}
function keepBoth(name: string) {
  try { localStorage.setItem(keptKey, JSON.stringify([...keptSet(), name])); } catch { /* private mode: the flag returns next visit */ }
  keptVersion.value++;
}

const folderOf = (p: { id: string; owner_id: string; account_id: string | null }) => p.account_id ? p.account_id : `${p.owner_id}/people/${p.id}`;

function Card({ d, canWrite }: { d: ReportCard; canWrite: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState("");
  const { f, o, im, app } = d;
  const outcome = o
    ? <>{o.n} values · {o.flagged ? <span class="text-warning">{o.flagged} outside range</span> : <span class="text-success">all in range</span>}</>
    : im ? <>the report's own words, on Labs · Imaging</>
    : d.flagged ? null : <span class="text-accent-light">not read yet</span>;
  const appLine = !app || app.total === 0 ? null
    : app.pending.length === 0
      ? app.unchecked
        ? <span class="text-warning">{app.total} in your app, {app.unchecked} awaiting your check there</span>
        : <span class="text-success">{app.total} in your app</span>
      : <><span class="text-warning">{app.pending.length} of {app.total} for your app not sent</span> {canWrite ? <button type="button" onClick={() => actions.report("send", f.name)} class="ml-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent-light hover:bg-accent/20">Send</button> : null}</>;
  const startRename = () => { setLabel(pretty(f.name)); setRenaming(true); };
  const save = () => { setRenaming(false); actions.report("rename", f.name, label); };
  const Buttons = ({ mobile }: { mobile: boolean }) => (
    <>
      <button type="button" onClick={() => actions.report("view", f.name)} class={mobile ? "rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-text-secondary" : "rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-white/25 hover:text-text-primary"}>View</button>
      {canWrite ? <button type="button" onClick={() => actions.report("parse", f.name)} class={mobile ? "rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-text-secondary" : "rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-white/25 hover:text-text-primary"}>{o || im ? "Read again" : "Read values"}</button> : null}
      {canWrite ? (mobile
        ? <button type="button" onClick={() => actions.report("del", f.name)} class="ml-auto rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-text-tertiary">Delete</button>
        : <button type="button" onClick={() => actions.report("del", f.name)} title="Delete" aria-label="Delete report" class="rounded-lg border border-white/12 px-2 py-1.5 text-text-tertiary transition-colors hover:border-danger/50 hover:text-danger"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg></button>) : null}
    </>
  );
  return (
    <div class={`rounded-2xl border ${d.flagged ? "border-warning/45" : "border-white/10"} bg-white/[0.03] p-4`}>
      <div class="flex items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent/[0.12]">
          {isPhotoName(f.name)
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            {renaming ? (
              <>
                <input value={label} maxLength={80} autoFocus onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setRenaming(false); }}
                  class="w-full min-w-0 flex-1 rounded-lg border border-accent/50 bg-white/[0.04] px-2.5 py-1 text-sm font-bold text-text-primary focus:outline-none" />
                <button type="button" onClick={save} class="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-canvas">Save</button>
                <button type="button" onClick={() => setRenaming(false)} class="shrink-0 rounded-lg border border-white/12 px-2.5 py-1 text-xs font-semibold text-text-secondary">Cancel</button>
              </>
            ) : (
              <>
                <div class="truncate text-sm font-semibold text-text-primary">{pretty(f.name)}</div>
                {canWrite ? <button type="button" onClick={startRename} title="Rename" aria-label="Rename report" class="shrink-0 text-text-muted transition-colors hover:text-text-primary"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg></button> : null}
              </>
            )}
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">
            {d.date ? <span class="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-text-secondary">{fmtDay(d.date).toUpperCase()}</span> : null}
            {im ? <span class="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-accent-light">{String(im.modality).toUpperCase()}</span> : null}
            {outcome ? <span>{outcome}</span> : null}
            {appLine ? <span>· {appLine}</span> : null}
          </div>
        </div>
        <div class="hidden shrink-0 items-center gap-2 sm:flex"><Buttons mobile={false} /></div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2 sm:hidden"><Buttons mobile={true} /></div>
      {d.flagged ? (
        <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          <span class="rounded-md bg-warning/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warning">Duplicate</span>
          <span class="min-w-0 flex-1 text-xs leading-relaxed text-text-tertiary">The same file as <strong class="font-semibold text-text-secondary">{pretty(d.original!)}</strong>. Its values were filed once; this PDF is a second copy.</span>
          {canWrite ? <button type="button" onClick={() => actions.report("del", f.name, "quiet")} class="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent-light hover:bg-accent/20">Remove this copy</button> : null}
          {canWrite ? <button type="button" onClick={() => keepBoth(f.name)} class="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-white/25">Keep both</button> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Reports() {
  const d = derived.value, p = person.value, files = doc.value?.files ?? [];
  const query = searchQuery.value;
  void keptVersion.value;
  const self = !!p?.self, canWrite = !!p?.mine;
  const { years, shown, total } = p && d ? reportYears(files, d.labs, d.app, d.imaging, folderOf(p), self, keptSet(), query) : { years: [], shown: 0, total: 0 };
  useEffect(() => { actions.tabCount("reports", total ? String(total) : ""); }, [total]);
  useEffect(() => {
    if (activeTab.value !== "reports" || !query) return;
    actions.searchNote(`${shown} of ${total} report${total === 1 ? "" : "s"} ${shown === 1 ? "matches" : "match"}`);
  }, [query, shown, total, activeTab.value]);
  return (
    <>
      {query && !shown ? <p class="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-text-tertiary">No report matches "{query}". A report matches by its name, its date, a value read from it, or its study.</p> : null}
      {years.map((y) => (
        <details key={y.year} class="group">
          <summary class="flex cursor-pointer list-none items-center gap-2.5 py-1 text-text-primary [&::-webkit-details-marker]:hidden">
            <span class="font-mono text-[13px] font-bold">{y.year}</span>
            <span class="text-xs text-text-tertiary">{y.months.reduce((t, m) => t + m.cards.length, 0)} report{y.months.reduce((t, m) => t + m.cards.length, 0) === 1 ? "" : "s"}</span>
            <svg class="h-3.5 w-3.5 text-text-tertiary transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </summary>
          <div class="mt-2 flex flex-col gap-2.5">
            {y.months.map((m) => (
              <>
                {m.name ? <div key={`m:${m.month}`} class="mt-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-tertiary first:mt-0">{m.name}</div> : null}
                {m.cards.map((c) => <Card key={c.name} d={c} canWrite={canWrite} />)}
              </>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}

export function AppImports() {
  const d = derived.value, p = person.value;
  const imps = d ? appImportsOf(d.exportRows, d.labs) : [];
  if (!imps.length) return null;
  const canWrite = !!p?.mine;
  return (
    <section class="mt-6 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div class="font-mono text-[10px] font-semibold tracking-widest text-text-tertiary">FROM THE VERVE APP</div>
      <div class="mt-2 flex flex-col gap-2">
        {imps.map((im) => (
          <div key={im.tag} class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/[0.08] px-3 py-2 text-[13px]">
            <span class="font-semibold text-text-primary">{importTitle(im)}</span>
            {im.imported ? <span class="text-text-muted">dropped here {fmtDay(im.imported)}</span> : null}
            <span class="text-text-tertiary">{appImportWords(im)}</span>
            {canWrite ? <button type="button" onClick={() => actions.report("rmimport", im.tag)} class="ml-auto min-h-9 text-[12px] font-semibold text-text-tertiary hover:text-danger">Remove</button> : null}
          </div>
        ))}
      </div>
      <p class="mt-2 text-[12px] text-text-muted">The weeks, fitness tests and waist readings are on the Overview; the lab values are on Labs with everything else. Where a week came from both sync and a file, sync wins.</p>
    </section>
  );
}

export function YearsOnFile() {
  const d = derived.value;
  const { years, total, max } = d ? yearsOnFile(d.weeks) : { years: [], total: 0, max: 1 };
  if (years.length <= 1) return null;
  const thisY = String(new Date().getFullYear());
  const csvYears = years.filter((y) => y.csvOnly);
  return (
    <section class="mt-6 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div class="flex items-baseline justify-between"><div class="font-mono text-[10px] font-semibold tracking-widest text-text-tertiary">YEARS ON FILE</div><span class="font-mono text-[10.5px] text-text-tertiary">{years.length} years · {total} weeks</span></div>
      <div class="mt-3 flex items-end gap-2" style={{ height: "110px" }} aria-hidden="true">
        {years.map((y) => { const h = Math.max(4, Math.round((y.weeks / max) * 72)); return (
          <div key={y.year} class="flex flex-1 flex-col items-center gap-1.5"><span class="font-mono text-[10.5px] font-semibold text-text-primary">{y.weeks}</span><span class={`w-full rounded-t-[3px] ${y.year === thisY ? "bg-success" : "bg-accent"}`} style={{ height: `${h}px`, opacity: y.csvOnly ? 0.45 : y.year === thisY ? 1 : 0.8 }}></span><span class={`font-mono text-[10px] ${y.year === thisY ? "text-text-primary" : "text-text-tertiary"}`}>{y.year}</span></div>
        ); })}
      </div>
      <p class="mt-3 text-[12px] leading-relaxed text-text-secondary">Weeks with movement on file, a column a year.{csvYears.length ? " Dim columns came from a CSV: minutes and heart rate, with MET-hours estimated from the heart rate rather than measured in your bands." : ""} The Overview's Years lens lists every year here; pick one and it draws month by month.</p>
    </section>
  );
}

export function mountReports(els: { cards: HTMLElement; imports: HTMLElement; years: HTMLElement }) {
  render(<Reports />, els.cards);
  render(<AppImports />, els.imports);
  render(<YearsOnFile />, els.years);
}
