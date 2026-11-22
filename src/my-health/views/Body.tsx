/**
 * Body, with Labs folded in (canvas "My health, redesigned", board 6): the
 * app's list, row for row and in its order. Three groups, Metabolic · Heart ·
 * Muscle; each row the name, when and by whom it was read, a track with the
 * value on its range, the band in words, the value. Tapping a name opens its
 * history. No row says when a test is due; no row draws a trend. The rows
 * and the bands are ../derive/body, from the app's registry copied into
 * src/data/body-list.ts.
 *
 * Then the sections only a report fills (canvas "Verve, Horizon as a
 * programme", board 35; 22 November 2026): blood count, liver, kidney,
 * thyroid and the rest, each marker read only against the range its lab
 * printed (../derive/reportSections). The list of files that sat here as
 * "Lab reports" is gone: the Reports tab is that list.
 *
 * One section at a time (canvas "Verve on the web, refined", board 07): the
 * sidebar lists the app's three, then every report section that holds a
 * marker; a press shows that one. Body opens on Metabolic. A search reads
 * every group, so while words are typed every group with a match is on the
 * page.
 */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { derived, person, section, setSection, sectionFor, activeTab, searchQuery, actions, APP_BODY_KEYS } from "../state.ts";
import { fmtDay } from "../derive/format.ts";
import { bodyHeadline, bodyListOf, type BodyRow, type Tone, type Track } from "../derive/body.ts";
import { searchTermsOf, landsAll } from "../derive/labs.ts";
import { reportSectionsOf, reportHeadline, REPORT_SECTION_LEAD, type ReportRow } from "../derive/reportSections.ts";
import { Pager } from "./Pager.tsx";

/** The app's three sections, by the names the sidebar gives them; a report section carries its own. */
const BODY_TITLE: Record<(typeof APP_BODY_KEYS)[number], string> = { metabolic: "Metabolic", heart: "Heart", muscle: "Muscle" };

const DASH = "—";
const TONE_TEXT: Record<Tone, string> = { good: "text-good", caution: "text-caution", concern: "text-concern", neutral: "text-text-2" };
const SEG_FILL = (band: number, neutral?: boolean) => neutral ? "bg-text-4/40" : band === 0 ? "bg-good/35" : band === 1 ? "bg-caution/35" : "bg-concern/35";
const shortDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Where the value sits in its range: the bands as segments, the value as a dot. */
function RangeTrack({ t, tone }: { t: Track; tone: Tone }) {
  return (
    <span class="relative block h-[6px] w-full overflow-hidden rounded-full bg-alt" aria-hidden="true">
      {t.segments.map((s, i) => <span key={i} class={`absolute top-0 h-full ${SEG_FILL(s.band, s.neutral)}`} style={{ left: `${(s.start * 100).toFixed(1)}%`, width: `${(s.width * 100).toFixed(1)}%` }}></span>)}
      {t.position != null ? <span class={`absolute top-[-2px] h-[10px] w-[10px] -translate-x-1/2 rounded-full border-2 border-card ${tone === "good" ? "bg-good" : tone === "caution" ? "bg-caution" : tone === "concern" ? "bg-concern" : "bg-text-2"}`} style={{ left: `${(t.position * 100).toFixed(1)}%` }}></span> : null}
    </span>
  );
}

function Row({ r, open, onOpen }: { r: BodyRow | ReportRow; open: boolean; onOpen: () => void }) {
  const sub = r.value == null
    ? (r.subline ?? "not read yet")
    : r.subline ?? `${r.on ? shortDate(r.on) : ""}${r.writer ? ` · ${r.writer}` : ""}`;
  const band = r.value == null ? "" : r.bandLabel ? `${r.bandLabel}${r.once ? " · measured once" : ""}` : r.bandNote ?? (r.bands.length ? "no band for this value" : "");
  const fromReport = "outside" in r;
  // not read yet, as against read with no figure to show (remnant, when its newest report's three do not subtract)
  const unread = r.value == null && !r.noFigure;
  return (
    <div class="border-t border-border first:border-t-0">
      <button type="button" onClick={onOpen} aria-expanded={open ? "true" : "false"} class="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 text-left sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
        <span class={`min-w-0 ${r.noFigure ? "col-span-2 sm:col-span-3" : ""}`}>
          <span class={`t-small block truncate font-semibold ${unread ? "text-text-3" : "text-text"}`}>{r.label}</span>
          <span class={`t-caption block text-text-3 ${r.noFigure ? "" : "truncate"}`}>{sub}</span>
        </span>
        {r.noFigure ? null : <span class="hidden min-w-0 sm:block">{r.track ? <RangeTrack t={r.track} tone={r.tone} /> : <span class="block h-[6px] w-full rounded-full bg-alt/60"></span>}</span>}
        {r.noFigure ? null : <span class={`t-caption min-w-0 truncate ${r.value == null ? "text-text-3" : TONE_TEXT[r.tone]}`}>{band}</span>}
        <span class="shrink-0 whitespace-nowrap text-right">
          <span class={`t-figure-row ${r.value == null ? "text-text-3" : "text-text"}`}>{r.value ?? DASH}</span>
          {r.value != null && r.unit ? <span class="t-unit ml-1">{r.unit}</span> : null}
        </span>
      </button>
      {open ? (
        <div class="mb-3 rounded-[10px] border border-border bg-alt p-3">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="t-eyebrow">History · {r.history.length ? `${r.history.length} reading${r.history.length === 1 ? "" : "s"}` : "nothing read yet"}</span>
            {r.bands.length ? <span class="t-caption text-text-3">The app's bands: {r.bands.map((b) => `${b.label} ${b.range}`).join(" · ")}</span> : fromReport ? <span class="t-caption text-text-3">Each reading against the range its own report printed</span> : null}
          </div>
          {r.history.length ? (
            <div class="mt-2 flex flex-col">
              {[...r.history].reverse().slice(0, 14).map((h) => (
                <div key={`${h.d}|${h.v}`} class="grid grid-cols-[96px_minmax(0,1fr)_auto] items-baseline gap-3 border-t border-border py-1.5 first:border-t-0">
                  <span class="t-caption text-text-3">{fmtDay(h.d)}</span>
                  <span class="t-caption truncate text-text-3">{h.writer}</span>
                  <span class="t-figure-row text-text">{Number.isInteger(h.v) ? h.v : Math.round(h.v * 100) / 100} <span class="t-unit">{h.unit ?? r.unit}</span></span>
                </div>
              ))}
            </div>
          ) : <p class="t-caption mt-2 text-text-3">{r.subline ?? "A lab report on Reports, or a reading in the app, fills this in."}</p>}
        </div>
      ) : null}
    </div>
  );
}

export function Body() {
  const d = derived.value, p = person.value;
  const [openKey, setOpenKey] = useState("");
  const query = searchQuery.value, terms = searchTermsOf(query);
  const tab = activeTab.value;
  const list = d ? bodyListOf(d) : null;
  // the sections only a report fills, after the app's three; one is on the page only when it holds a marker
  const reportSecs = d ? reportSectionsOf(d.labs) : [];
  const present: string[] = [...APP_BODY_KEYS, ...reportSecs.map((s) => s.key)];
  const wanted = sectionFor("body", section.value);
  const cur = present.includes(wanted) ? wanted : APP_BODY_KEYS[0];
  const at = present.indexOf(cur);
  const titleOf = (k: string) => (BODY_TITLE as Record<string, string>)[k] ?? reportSecs.find((s) => s.key === k)?.title ?? "";
  const curReport = terms.length ? null : reportSecs.find((s) => s.key === cur) ?? null;
  const lands = (r: { label: string }) => landsAll(r.label.toLowerCase(), terms);
  const matches = list && terms.length ? list.sections.flatMap((s) => s.rows).filter(lands).length + reportSecs.flatMap((s) => s.rows).filter(lands).length : 0;
  useEffect(() => { if (tab === "body") actions.searchNote(terms.length ? `${matches} row${matches === 1 ? " matches" : "s match"}` : ""); }, [query, matches, tab]);
  if (!d || !list) return <Frame />;
  const self = !!p?.self;
  return (
    <div>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="t-eyebrow">Body <span aria-hidden="true">&rsaquo;</span> {terms.length ? "every group" : titleOf(cur)}{list.latestLab ? ` · latest labs ${fmtDay(list.latestLab)}` : ""}</div>
          <h1 class="t-display mt-2 text-text">{curReport ? reportHeadline(curReport) : bodyHeadline(list)}</h1>
          <p class="t-body mt-3 max-w-3xl text-text-2">{curReport ? REPORT_SECTION_LEAD : "The app's Body list, row for row and in its order: the name, where you sit in the range, the band in words, the value. Labs and body measures live together here. Blood pressure sits with the vitals."}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          {self || p?.mine ? <button type="button" onClick={() => actions.report("pick", "")} class="r-btn min-h-10 bg-accent px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90">Add a lab report</button> : null}
          <button type="button" onClick={() => actions.goTab("reports")} class="r-btn min-h-10 border border-border px-4 text-[13px] font-semibold text-text-2 transition-colors hover:border-border-strong hover:text-text">Reports</button>
        </div>
      </div>
      {terms.length && !matches ? <p class="t-small mt-6 text-text-3">No row matches "{query}". Try part of a name: LDL, waist, grip, TSH.</p> : null}
      <div class="mt-6 flex flex-col gap-5">
        {list.sections.map((s) => {
          const rows = terms.length ? s.rows.filter((r) => landsAll(r.label.toLowerCase(), terms)) : s.rows;
          if (!rows.length || (!terms.length && s.key !== cur)) return null;
          return (
            <section key={s.key} id={`body-${s.key}`} class="r-card border border-border bg-card p-5 sm:px-6">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h3 class="t-title text-text">{s.title}</h3>
                <span class="t-caption text-text-3">{s.recorded} of {s.total} read{s.watch ? ` · ${s.watch} outside` : ""}</span>
              </div>
              <div class="mt-2">{rows.map((r) => <Row key={r.key} r={r} open={openKey === r.key} onOpen={() => setOpenKey(openKey === r.key ? "" : r.key)} />)}</div>
            </section>
          );
        })}
        {reportSecs.map((s) => {
          const rows = terms.length ? s.rows.filter(lands) : s.rows;
          if (!rows.length || (!terms.length && s.key !== cur)) return null;
          return (
            <section key={s.key} id={`body-${s.key}`} class="r-card border border-border bg-card p-5 sm:px-6">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h3 class="t-title text-text">{s.title}</h3>
                <span class="t-caption text-text-3">{s.total} marker{s.total === 1 ? "" : "s"}{s.outside ? ` · ${s.outside} outside ${s.outside === 1 ? "its" : "their"} lab's range` : ""}</span>
              </div>
              <div class="mt-2">{rows.map((r) => <Row key={r.key} r={r} open={openKey === r.key} onOpen={() => setOpenKey(openKey === r.key ? "" : r.key)} />)}</div>
            </section>
          );
        })}
      </div>
      {terms.length ? null : <Pager at={at + 1} of={present.length}
        prev={at > 0 ? { label: titleOf(present[at - 1]), go: () => setSection(present[at - 1]) } : null}
        next={at < present.length - 1 ? { label: titleOf(present[at + 1]), go: () => setSection(present[at + 1]) } : null} />}
      <p class="t-caption mt-4 max-w-3xl text-text-3">{curReport ? "Ranges here are the ones each lab printed." : "Ranges are the app's, read from the same thresholds file."} No row says when a test is due. No row draws a trend; a tap on the name opens the history.</p>
    </div>
  );
}

function Frame() {
  return (
    <div aria-hidden="true">
      <div class="h-3 w-40 rounded bg-alt"></div>
      <div class="mt-3 h-8 w-3/5 rounded bg-alt"></div>
      <div class="mt-6 r-card flex flex-col gap-3 border border-border bg-card p-5">{[0, 1, 2, 3].map((i) => <span key={i} class="h-3.5 w-full rounded bg-alt"></span>)}</div>
    </div>
  );
}

export function mountBody(root: HTMLElement) { render(<Body />, root); }
