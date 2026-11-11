/**
 * Labs as a view of the document: a section rail on the left, one section
 * on the right, each marker a row that opens into its chart. The grouping,
 * the search and the drawings are ../derive/labs; the state is in ../state.
 * On a phone the rail is the page until a section opens.
 */
import { render } from "preact";
import { useEffect } from "preact/hooks";
import { derived, labSection, expandedAnalyte, mobileSectionOpen, searchQuery, activeTab, actions } from "../state.ts";
import { fmtDay } from "../derive/format.ts";
import { inRange, rangeLabel } from "../derive/markers.ts";
import { SECTIONS, SECTION_ORDER, groupLabs, filterSecs, searchTermsOf, sparkSvg, bigChartHtml } from "../derive/labs.ts";

function Row({ name, rs }: { name: string; rs: any[] }) {
  const latest = rs[rs.length - 1];
  const ok = inRange(latest);
  const valColor = ok === false ? "text-warning" : ok === true ? "text-success" : "text-text-primary";
  const open = expandedAnalyte.value === name;
  const tags: string[] = latest.tags ?? [];
  const explain = latest.explain as { formula: string; body: string; link: { label: string; href: string } } | undefined;
  return (
    <div data-an={name}>
      <button type="button" class="flex w-full items-center gap-3 py-2 text-left"
        onClick={(e) => { expandedAnalyte.value = open ? "" : name; if (!open) (e.currentTarget as HTMLElement).scrollIntoView({ block: "nearest" }); }}>
        <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span class="min-w-0 truncate text-[13px] font-semibold text-text-primary" title={name}>{name}</span>
          {/* What kind of number this is: worked out here rather than printed, and for an LDL, how the lab got it. */}
          {tags.map((t) => (
            <span key={t} class={`shrink-0 rounded-[5px] border px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.5px] ${t === "computed" ? "border-accent-light/40 text-accent-light" : "border-ink/[0.14] text-text-secondary"}`}>{t}</span>
          ))}
        </span>
        <svg class="hidden shrink-0 sm:block" width="120" height="28" viewBox="0 0 120 28" dangerouslySetInnerHTML={{ __html: sparkSvg(rs) }} />
        <span class={`shrink-0 whitespace-nowrap text-right font-mono text-xs ${valColor}`}>{latest.value}{latest.unit ? ` ${latest.unit}` : ""}</span>
        <span class="hidden w-24 shrink-0 truncate text-right font-mono text-[10px] text-text-3 sm:inline" title={rangeLabel(latest)}>{rangeLabel(latest)}</span>
        <span class="text-text-3">{open ? "▾" : "▸"}</span>
      </button>
      {/* A computed figure that needs a sentence: the arithmetic in the report's own numbers, then what it means. */}
      {open && explain ? (
        <div class="mb-2 rounded-xl border border-ink/[0.07] bg-ink/[0.02] p-3">
          <div class="font-mono text-[11px] text-text-secondary">{explain.formula}</div>
          <p class="mt-1.5 text-[12.5px] leading-[1.55] text-text-secondary">{explain.body}</p>
          <a href={explain.link.href} class="mt-2 inline-block text-[12.5px] font-bold text-accent-light hover:underline">{explain.link.label} &rarr;</a>
        </div>
      ) : null}
      {open ? <div dangerouslySetInnerHTML={{ __html: bigChartHtml(rs) }} /> : null}
    </div>
  );
}

export function Labs() {
  const d = derived.value;
  const labs = d?.labsShown ?? [];   // report rows + the computed lipid ratios
  const query = searchQuery.value;
  const terms = searchTermsOf(query);
  const secs = groupLabs(labs);
  const view = filterSecs(secs, query);
  const matches = [...view.values()].reduce((t, m) => t + m.size, 0);
  // the search note lives in the bar above both Labs and Reports; this view owns it while Labs is open
  useEffect(() => {
    if (activeTab.value !== "body") return;
    actions.searchNote(terms.length && matches ? `${matches} marker${matches === 1 ? " matches" : "s match"}` : "");
  }, [query, matches, activeTab.value]);

  if (!labs.length) {
    return (
      <div class="mt-6 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-text-tertiary">
        Nothing here yet — drop a report on the <button type="button" onClick={() => actions.goTab("reports")} class="font-semibold text-accent-light hover:underline">Reports</button> tab and every value in it lands here.
      </div>
    );
  }
  if (terms.length && matches === 0) {
    return <p class="mt-6 rounded-2xl border border-ink/10 bg-ink/[0.03] p-6 text-sm text-text-tertiary">No marker matches "{query}". Try a section, like liver, or part of a name.</p>;
  }
  const current = view.has(labSection.value) ? labSection.value : (SECTION_ORDER.find((x) => view.has(x)) ?? "");
  const sec = view.get(current);
  const analytes = sec ? [...sec.entries()] : [];
  const flaggedIn = analytes.filter(([, rs]) => inRange(rs[rs.length - 1]) === false).length;
  const mobileOpen = mobileSectionOpen.value;
  const imaging = d?.imaging ?? [];
  return (
    <div class="mt-4 flex flex-col gap-4 md:flex-row">
      <nav class={`${mobileOpen ? "hidden md:flex" : "flex"} flex-col gap-1.5 md:w-56 md:shrink-0`}>
        {SECTION_ORDER.filter((s) => view.has(s)).map((s) => {
          const rows = [...view.get(s)!.values()];
          const flagged = rows.filter((rs) => inRange(rs[rs.length - 1]) === false).length;
          const on = s === current;
          return (
            <button key={s} type="button" onClick={() => { labSection.value = s; expandedAnalyte.value = ""; mobileSectionOpen.value = true; }}
              class={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${on ? "bg-accent/15 font-bold text-text-primary" : "text-text-secondary hover:bg-ink/[0.05]"}`}>
              <span class="flex-1">{SECTIONS[s]}</span>
              <span class={`rounded-md ${flagged ? "bg-warning/15 text-warning" : "bg-ink/[0.06] text-text-tertiary"} px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider`}>{rows.length}{flagged ? ` · ${flagged}!` : ""}</span>
              <span class="text-text-3 md:hidden">›</span>
            </button>
          );
        })}
      </nav>
      <div class={`${mobileOpen ? "" : "hidden md:block"} min-w-0 flex-1 rounded-2xl border border-ink/10 bg-ink/[0.03] p-5`}>
        {sec ? (
          <>
            <button type="button" onClick={() => { mobileSectionOpen.value = false; }} class="mb-2 flex items-center gap-1 text-sm font-semibold text-accent-light md:hidden">‹ All sections</button>
            <div class="flex flex-wrap items-baseline gap-3">
              <h3 class="text-base font-extrabold">{SECTIONS[current]}</h3>
              <span class="font-mono text-[10px] text-text-tertiary">{analytes.length} MARKER{analytes.length === 1 ? "" : "S"}</span>
              {flaggedIn ? <span class="rounded-md bg-warning/15 px-2 py-0.5 font-mono text-[9px] tracking-wider text-warning">{flaggedIn} OUT OF RANGE</span> : null}
            </div>
            <div class="mt-2 divide-y divide-ink/[0.05]">{analytes.map(([name, rs]) => <Row key={name} name={name} rs={rs} />)}</div>
            {current === "imaging" && imaging.length ? (
              <>
                <div class="mt-5 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">The reports' own conclusions</div>
                {[...imaging].reverse().map((im, i) => (
                  <div key={`${im.report_path}:${i}`} class="mt-2 rounded-xl border border-ink/[0.07] bg-ink/[0.02] p-3">
                    <div class="flex items-center gap-2">
                      <span class="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-accent-light">{String(im.modality).toUpperCase()}</span>
                      <span class="font-mono text-[10px] text-text-tertiary">{fmtDay(im.report_date)}</span>
                    </div>
                    {im.impression ? <p class="mt-1.5 text-[13px] leading-5 text-text-secondary">{im.impression}</p> : null}
                  </div>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function mountLabs(root: HTMLElement) { render(<Labs />, root); }
