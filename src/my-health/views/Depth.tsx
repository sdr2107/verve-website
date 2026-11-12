/**
 * In depth: how did I get here? (canvas "Verve, one story in four parts",
 * board 04, built 11 Nov 2026; redrawn on the canvas "Verve, In depth
 * redrawn", boards 01 to 05, built 12 Nov 2026). Not by topic, across time:
 * five windows, one month to three years, with one year opening first. The
 * window is picked on the page, by a five-way switch at its top right; the
 * sidebar holds no links under In depth.
 *
 * Each marker has a card of its own: three figures (baseline, average, now)
 * over one chart with a scale on its left edge, a dashed baseline and a line
 * drawn from averages, and one sentence under it. Blood work shows its usual
 * swing as a shaded band around the baseline. The cards run two to a row under
 * four headings, one to a row on a phone, and one line at the top counts what
 * moved and what held. A coach or a clinician sees exactly this page, read-only.
 *
 * The lanes on one line of time, and the table "What moved, and what held",
 * left on 12 Nov 2026: the founder's recording showed them with real rows (no
 * scale, every day drawn, blocks and strings, stubs across three years). Each
 * marker's own chart, at every range, is on the Overview's sections, where it
 * always was and where it stays free.
 *
 * Every figure is from the derive layer (derive/timeline.ts). A chart's lines
 * and bars are drawn; its marks and every word are set over the drawing, so
 * they stay the same size at any width and nothing scrolls sideways. The
 * working for "The Guide's read" is still published on a signal, and the head
 * of a window can ask the Guide to read that window.
 */
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { derived, person, depthLocked, depthWorking, depthLane, guideAsk, actions, section, setSection, sectionFor, DEPTH_KEYS } from "../state.ts";
import { depthEmpty, depthEmptyText, depthOf } from "../derive/depth.ts";
import { addDays, fmtDay, todayStr } from "../derive/format.ts";
import { WINDOWS, timelineOf, windowWorking, dayMonthYear, type Card, type Fig, type Spot, type Timeline, type WindowKey, type XY } from "../derive/timeline.ts";
import SWING from "../../data/usual-swing.ts";

const dayShort = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
/** A share of the plot's height, from its foot, as a distance from its top. */
const top = (y: number) => pct(1 - y);

/** The person's sleep and heart rows of the last 90 days, as a CSV the browser saves. */
function exportHeartRows(rows: any[], today: string, name: string) {
  const cols = ["day", "sleep_minutes", "sleep_start", "resting_hr", "hrr_bpm", "hrr_source", "hrv_night_ms", "hrv_n", "hrv_source", "hrv_method"];
  const cell = (v: unknown) => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `verve-sleep-heart-${(name || "me").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${today}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Lock({ self, name }: { self: boolean; name: string }) {
  return (
    <div class="r-card flex max-w-2xl flex-col gap-3 border border-dashed border-accent-border bg-card p-5">
      <div class="t-title text-text">{self ? "In depth is on Pro." : "In depth on other people is on Max."}</div>
      <p class="t-small text-text-2">{self ? "How you got here: one month to three years, a card for each marker with its baseline and its average, blood work beside fitness, and whether a change is more than its usual swing. Each marker's own chart, at every range, stays on your Overview." : `${name || "This person"}'s Overview, Body and Reports are here as before. In depth on everyone you see comes with Max.`}</p>
      <div class="flex flex-wrap gap-2"><a href="/plans" class="r-btn inline-flex min-h-10 items-center bg-accent px-4 text-[13px] font-semibold text-canvas">See the plans</a><button type="button" onClick={() => actions.goTab("overview")} class="min-h-10 px-3 text-[13px] font-semibold text-text-2 hover:text-text">Not now</button></div>
    </div>
  );
}

/** The window, picked on the page: five buttons at the top right; on a phone they span the width, 44 px tall, with shorter labels a screen reader hears in full. */
function WindowSwitch({ cur, pick }: { cur: WindowKey; pick: (k: WindowKey) => void }) {
  return (
    <div role="group" aria-label="Window" class="grid grid-cols-5 gap-0.5 rounded-[12px] border border-border-strong bg-alt p-[3px] sm:inline-grid sm:rounded-[10px]">
      {DEPTH_KEYS.map((k) => {
        const on = k === cur;
        return (
          <button key={k} type="button" aria-label={WINDOWS[k].label} aria-pressed={on ? "true" : "false"} onClick={() => pick(k)}
            class={`h-11 whitespace-nowrap rounded-[9px] border px-3 text-[13px] transition-colors sm:h-[30px] sm:rounded-[7px] ${on ? "border-border bg-card font-semibold text-text" : "border-transparent font-medium text-text-2 hover:text-text"}`}>
            <span class="sm:hidden" aria-hidden="true">{WINDOWS[k].short}</span><span class="hidden sm:inline" aria-hidden="true">{WINDOWS[k].label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** One of a card's three figures. The latest is the card's largest; the small line under each shortens on a phone. */
function FigView({ f, now }: { f: Fig; now?: boolean }) {
  const dash = f.value === "—";
  return (
    <div class="flex min-w-0 flex-col gap-px" title={f.title}>
      <span class="font-mono text-[10px] font-medium uppercase leading-[1.3] tracking-[0.04em] text-text-3">{f.label}</span>
      <span class={`whitespace-nowrap ${now ? "t-figure" : "t-figure-row"} ${dash ? "text-text-3" : now ? "text-text" : "text-text-2"}`}>{f.value}</span>
      <span class="t-caption text-text-3"><span class="hidden sm:inline">{f.sub}</span><span class="sm:hidden">{f.short}</span></span>
    </div>
  );
}

const poly = (seg: XY[]) => seg.map((q) => `${(q.x * 1000).toFixed(1)},${((1 - q.y) * 100).toFixed(2)}`).join(" ");
/** A word set on the chart: on the card's own ground, so it reads over a line or a band. */
const WORD = "absolute whitespace-nowrap rounded-[3px] bg-card px-1 text-[10px] leading-[1.25]";
/** Where a line's word sits: centred at its place along the line, just over or just under it. */
const wordAt = (s: Spot & { y: number }) => ({ left: pct(s.at), top: top(s.y), transform: `translate(-50%, ${s.above ? "calc(-100% - 3px)" : "3px"})` });

/** A card's chart. The scale's figures sit in the gutter on the left; the weeks or months sit under it. */
function Chart({ c, axis }: { c: Card; axis: Timeline["axis"] }) {
  const ch = c.chart, b = ch.baseline;
  return (
    <div role="img" aria-label={c.alt}>
      {/* a new wearable's words sit over the plot, in a strip of their own */}
      <div class={`relative ml-[46px] mr-1 h-[116px] ${ch.wearable.length ? "mt-4" : ""}`}>
        {ch.ticks.map((t) => <span key={`rule:${t.label}`} class="absolute inset-x-0 border-t border-border" style={{ top: top(t.y) }}></span>)}
        {ch.ticks.map((t) => <span key={`tick:${t.label}`} class="absolute right-full mr-2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] leading-none text-text-3" style={{ top: top(t.y) }}>{t.label}</span>)}
        {ch.wearable.map((m) => <span key={`mark:${m.x}`} class="absolute -top-4 bottom-0 border-l border-dashed border-caution" style={{ left: pct(m.x) }} title={m.title}></span>)}
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {ch.band ? <rect x={ch.band.x0 * 1000} y={(1 - ch.band.y1) * 100} width={(1 - ch.band.x0) * 1000} height={Math.max(0, ch.band.y1 - ch.band.y0) * 100} fill="var(--color-accent)" fill-opacity={ch.band.inner ? 0.07 : 0.12} /> : null}
          {ch.band?.inner ? <rect x={ch.band.x0 * 1000} y={(1 - ch.band.inner.y1) * 100} width={(1 - ch.band.x0) * 1000} height={Math.max(0, ch.band.inner.y1 - ch.band.inner.y0) * 100} fill="var(--color-accent)" fill-opacity="0.1" /> : null}
          {ch.bars.map((r) => <rect key={r.x0} x={r.x0 * 1000} y={(1 - r.h) * 100} width={Math.max(1, (r.x1 - r.x0) * 1000)} height={r.h * 100} fill={r.reached ? "var(--color-accent)" : "var(--color-accent-border)"}><title>{r.title}</title></rect>)}
          {ch.goal ? <line x1="0" x2="1000" y1={(1 - ch.goal.y) * 100} y2={(1 - ch.goal.y) * 100} stroke="var(--color-accent-text)" stroke-width="1" vector-effect="non-scaling-stroke" /> : null}
          {b ? <line x1={b.x0 * 1000} x2={b.x1 * 1000} y1={(1 - b.y) * 100} y2={(1 - b.y) * 100} stroke="var(--color-text-2)" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" /> : null}
          {ch.links.map((seg, i) => <polyline key={`k${i}`} points={poly(seg)} fill="none" stroke="var(--color-border-strong)" stroke-width="1.5" vector-effect="non-scaling-stroke" />)}
          {ch.lines.map((seg, i) => <polyline key={`l${i}`} points={poly(seg)} fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />)}
        </svg>
        {ch.days.map((q) => <span key={`day:${q.x}`} class="absolute block h-[5px] w-[5px] rounded-full bg-accent-border" style={{ left: pct(q.x), top: top(q.y), marginLeft: "-2.5px", marginTop: "-2.5px" }}></span>)}
        {ch.points.map((q) => <span key={`pt:${q.x}`} class="absolute block h-[7px] w-[7px] rounded-full bg-accent" style={{ left: pct(q.x), top: top(q.y), marginLeft: "-3.5px", marginTop: "-3.5px" }} title={q.title}></span>)}
        {/* the words sit in the empty stretch when it is wide enough to hold them; a narrower one is said under the cards */}
        {ch.gaps.filter((g) => g.x1 - g.x0 >= 0.12).map((g) => <span key={`gap:${g.x0}`} class="absolute bottom-1 -translate-x-1/2 text-center text-[10px] leading-[1.15] text-text-3" style={{ left: pct((g.x0 + g.x1) / 2) }}>nothing<br />logged</span>)}
        {/* a line's word sits where nothing drawn is in its way; with no room (and always on a phone) the sentence under the chart names the line */}
        {ch.goal?.shown ? <span class={`${WORD} hidden font-mono text-accent-text sm:block`} style={wordAt(ch.goal)}>{ch.goal.label}</span> : null}
        {b?.shown ? <span class={`${WORD} hidden text-text-2 sm:block`} style={wordAt(b)}>{b.label}</span> : null}
        {ch.marks.map((q) => (
          <span key={`m:${q.x}:${q.y}`}>
            <span class={`absolute block h-[9px] w-[9px] ${q.shape === "diamond" ? "rotate-45 bg-text" : "rounded-full bg-accent"}`} style={{ left: pct(q.x), top: top(q.y), marginLeft: "-4.5px", marginTop: "-4.5px" }} title={q.title}></span>
            {q.label ? <span class={`${WORD} font-mono font-semibold text-text`} style={{ left: pct(q.x), top: top(q.y), transform: `translate(${q.x > 0.93 ? "-100%" : q.x < 0.07 ? "0" : "-50%"}, ${q.above ? "calc(-100% - 7px)" : "8px"})` }}>{q.label}</span> : null}
          </span>
        ))}
        {ch.wearable.map((m) => <span key={`text:${m.x}`} class={`${WORD} -top-[17px] text-caution`} style={{ left: pct(m.x), transform: m.x > 0.5 ? "translateX(calc(-100% - 4px))" : "translateX(4px)" }}>{m.text}</span>)}
      </div>
      <div class="relative ml-[46px] mr-1 mt-1.5 h-[14px]" aria-hidden="true">
        {axis.map((a) => <span key={a.label + a.x} class="absolute top-0 whitespace-nowrap font-mono text-[10px] leading-none text-text-3" style={{ left: pct(a.x), transform: a.x > 0.94 ? "translateX(-100%)" : a.x < 0.05 ? "none" : "translateX(-50%)" }}>{a.label}</span>)}
      </div>
    </div>
  );
}

/** One marker: its name and how it is stepped, three figures, one chart, one sentence. */
function CardView({ c, axis, lit }: { c: Card; axis: Timeline["axis"]; lit: boolean }) {
  return (
    <article id={`card-${c.key}`} class={`r-card flex min-w-0 scroll-mt-6 flex-col gap-2.5 border bg-card px-4 pb-3.5 pt-4 transition-colors duration-500 sm:px-[18px] ${lit ? "border-accent" : "border-border"}`}>
      <div>
        <h3 class="t-body font-semibold leading-tight text-text">{c.label}</h3>
        <span class="t-unit">{c.how}</span>
      </div>
      <div class="grid grid-cols-3 gap-2.5 border-t border-border pt-2.5">
        <FigView f={c.baseline} />
        {c.middle ? <FigView f={c.middle} /> : <span></span>}
        <FigView f={c.now} now />
      </div>
      <Chart c={c} axis={axis} />
      <p class={`t-small border-t border-border pt-2 ${c.quiet ? "text-text-3" : "text-text-2"}`}>{c.answer}{c.legend ? <span class="sm:hidden"> {c.legend}</span> : null}{c.legendWide ? <span class="hidden sm:inline"> {c.legendWide}</span> : null}{c.begins ? ` ${c.begins}` : ""}</p>
    </article>
  );
}

/** The papers behind the swing figures, one line a marker: the page names the study behind every band it draws. */
function SwingSources() {
  const rows: [string, string, { source?: string; pubmed?: string; note?: string }][] = [
    ["LDL", `${Math.round(SWING.markers.ldlC.swingLowPct)} to ${Math.round(SWING.markers.ldlC.swingHighPct)}%`, SWING.markers.ldlC],
    ["ApoB", `${Math.round(SWING.markers.apoB.swingLowPct)}%`, SWING.markers.apoB],
    ["HbA1c", `${SWING.markers.hba1c.swingLowPct} to ${SWING.markers.hba1c.swingHighPct}% of the value`, SWING.markers.hba1c],
    ["Fasting glucose", `${Math.round(SWING.markers.fastingGlucose.swingLowPct)}%`, SWING.markers.fastingGlucose],
    ["hs-CRP", `more than ${(1 + SWING.markers.hsCRP.risePct / 100).toFixed(1)} times, or a fall of more than ${SWING.markers.hsCRP.fallPct}%`, SWING.markers.hsCRP],
  ];
  return (
    <details>
      <summary class="t-caption cursor-pointer font-semibold text-accent-text hover:text-text">Where the swing figures come from</summary>
      <div class="mt-2 flex flex-col gap-2">
        <p class="t-caption max-w-3xl text-text-2">Two results from one person differ a little with nothing having changed: the body varies from week to week, and so does the laboratory. The figure below is how far apart two results can be before the gap is more than that. It assumes the two samples were taken alike, and that the laboratory's own imprecision is typical; yours may differ.</p>
        {rows.map(([name, fig, m]) => (
          <p key={name} class="t-caption max-w-3xl text-text-3"><span class="font-semibold text-text-2">{name}, about {fig}.</span> {m.source} {m.pubmed ? <a href={m.pubmed} target="_blank" rel="noopener" class="font-semibold text-accent-text hover:text-text">PubMed</a> : null}</p>
        ))}
        <p class="t-caption max-w-3xl text-text-3">{SWING.notHeld}</p>
      </div>
    </details>
  );
}

/**
 * One window, drawn: the head with the switch, the line that counts the cards,
 * the cards under their headings, and the notes at the foot. It takes its
 * figures whole, so the page and a preview draw the same thing.
 */
export function WindowView({ t, self, lit, pick, ask, startAfterGap, showWhole }: {
  t: Timeline; self: boolean; lit: string;
  pick: (k: WindowKey) => void;
  /** Asks the Guide to read the window in view; null when there is nothing to send. */
  ask: (() => void) | null;
  startAfterGap: () => void; showWhole: () => void;
}) {
  const def = t.def;
  const blood = t.cards.some((c) => c.chart.band || c.state === "noSwing");
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-5 sm:gap-y-1.5">
        <div class="min-w-0 sm:col-start-1 sm:row-start-1">
          <div class="t-eyebrow">In depth · {dayMonthYear(t.from)} to today</div>
          <h1 class="t-display mt-1.5 text-text">{def.name}</h1>
        </div>
        <div class="sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-end"><WindowSwitch cur={def.key} pick={pick} /></div>
        {ask && !t.empty ? <button type="button" onClick={ask} class="inline-flex min-h-7 items-center self-start text-left text-[13px] font-semibold text-accent-text hover:text-text sm:col-start-1 sm:row-start-2">Ask the Guide to read {def.these} &rarr;</button> : null}
      </div>

      {t.empty ? (
        <section class="r-card border border-border bg-card p-5 sm:p-6">
          <p class="t-small text-text-2">Nothing was recorded in this window. A longer one may hold it.</p>
          {t.notes.map((n) => <p key={n} class="t-caption mt-2 max-w-3xl text-text-3">{n}</p>)}
        </section>
      ) : <>
        {/* ── the window in one line ── */}
        {t.digest.length ? <div class="t-caption flex flex-wrap items-center gap-1.5 text-text-2" aria-label="The window in one line">
          {t.digest.map((g) => <span key={g.state} class="r-chip inline-flex min-h-[26px] items-center gap-1.5 border border-border bg-card px-2.5 py-0.5"><span class="hidden sm:inline">{g.label}</span><span class="sm:hidden">{g.short}</span> <b class="font-mono font-semibold text-text">{g.n}</b></span>)}
          <span class="ml-1">against where each stood on {dayMonthYear(t.from)}</span>
        </div> : null}

        {/* ── a card for each marker, under its heading ── */}
        {t.groups.map((g) => (
          <section key={g.key} class="flex flex-col gap-2.5" aria-label={g.title}>
            <h2 class="mt-1 font-mono text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-accent-text">{g.title}</h2>
            <div class="grid grid-cols-1 gap-3.5 md:grid-cols-2">{g.cards.map((c) => <CardView key={c.key} c={c} axis={t.axis} lit={lit === c.key} />)}</div>
          </section>
        ))}

        {t.once ? <p class="t-small text-text-2">{t.once}</p> : null}

        {/* ── what keeps the page honest ── */}
        <div class="flex flex-col gap-1 border-t border-border pt-3">
          <p class="t-small text-text-2">Lines that move in the same months do not show that one moved the other.</p>
          {t.changes.length ? <p class="t-caption text-text-3">A new wearable is marked where it began. Figures from two wearables are not set against each other.</p> : null}
          {t.gap ? <p class="t-caption text-text-3">Nothing was logged from {dayShort(t.gap.from)} to {dayShort(t.gap.to)}. It is left empty, not drawn as zero. <button type="button" onClick={startAfterGap} class="font-semibold text-accent-text hover:text-text">Start the view after it</button></p> : null}
          {t.custom ? <p class="t-caption text-text-3">This view starts on {dayMonthYear(t.from)}, after a stretch with nothing logged. <button type="button" onClick={showWhole} class="font-semibold text-accent-text hover:text-text">Show the whole window</button></p> : null}
          {t.notes.map((n) => <p key={n} class="t-caption max-w-3xl text-text-3">{n}</p>)}
          <p class="t-caption max-w-3xl text-text-3">The baseline is where {self ? "you" : "they"} stood when the window began: the two-week average to its first day, or the test or report nearest it. No colour marks a change as good or bad: the page says what moved, not what it means.</p>
          {blood ? <SwingSources /> : null}
        </div>
      </>}
    </div>
  );
}

export function Depth() {
  const d = derived.value, p = person.value;
  const locked = depthLocked.value;
  const today = todayStr();
  const cur = sectionFor("depth", section.value) as WindowKey;
  const want = depthLane.value;
  /** A window started after a gap, at the person's word: kept while the page is open, one start per window. */
  const [after, setAfter] = useState<Partial<Record<WindowKey, string>>>({});
  const [lit, setLit] = useState("");
  // the working for the Guide's read is the page's own figures whatever the plan: the Guide has its own gate
  const depth = useMemo(() => (d && p && !depthEmpty(d) ? depthOf(d, p, today) : null), [d, p, today]);
  useEffect(() => { depthWorking.value = depth?.working ?? null; }, [depth]);
  const t = useMemo(() => (d && !locked ? timelineOf(d, cur, today, { from: after[cur] }) : null), [d, locked, cur, today, after]);
  // a link elsewhere on the page asked for one marker's card: bring it into view and light it once
  useEffect(() => {
    if (!want || !t) return;
    const el = document.getElementById(`card-${want}`);
    depthLane.value = "";
    if (!el) return;
    setLit(want);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const off = setTimeout(() => setLit(""), 2400);
    return () => clearTimeout(off);
  }, [want, t]);
  if (!d || !p) return null;
  if (locked) return <Lock self={p.self} name={p.name} />;
  if (!t || depthEmpty(d)) return <p class="t-body max-w-3xl text-text-3">{depthEmptyText(p)}</p>;

  const synced = d.signals.length ? String(d.signals[d.signals.length - 1].day) : String(d.doc.generated_at ?? "").slice(0, 10);
  const askGuide = () => {
    if (!depth) return;
    guideAsk.value = { window: cur, working: { ...depth.working, read: "window", window: windowWorking(t) } };
    actions.goTab("guide");
  };

  return (
    <div class="flex flex-col gap-5">
      {!p.self ? <p class="t-caption text-text-3">Viewing {p.name || "this person"} · read-only · synced {synced ? fmtDay(synced) : "—"} · the athlete's own words appear only in Messages</p> : null}
      <div id={`depth-${cur}`}>
        <WindowView t={t} self={p.self} lit={lit} pick={(k) => setSection(k)} ask={depth ? askGuide : null}
          startAfterGap={() => { if (t.gap) setAfter({ ...after, [cur]: addDays(t.gap.to, 1) }); }}
          showWhole={() => { const next = { ...after }; delete next[cur]; setAfter(next); }} />
      </div>
      {depth?.heartRows.length ? <p class="t-caption text-text-3">The mornings and nights behind these lines: <button type="button" onClick={() => exportHeartRows(depth.heartRows, today, p.name)} class="font-semibold text-accent-text hover:text-text">export the last 90 days as CSV</button>. Each marker's own chart, at every range, is on the Overview.</p> : null}
    </div>
  );
}

export function mountDepth(root: HTMLElement) { render(<Depth />, root); }
