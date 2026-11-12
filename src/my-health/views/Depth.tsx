/**
 * In depth: how did I get here? (canvas "Verve, one story in four parts",
 * board 04; built 11 Nov 2026). Not by topic, across time: five windows, one
 * month to three years, with one year opening first. Each marker has its own
 * lane, all on one line of time, blood work beside fitness; under them, what
 * moved and what held, each marker against itself, with a blood change said
 * against that marker's usual swing. A coach or a clinician sees exactly this
 * page, read-only.
 *
 * The eight sections by topic (Last week, Snapshot, five chapters, the week's
 * every number) left on 11 Nov 2026; each marker's own chart, at every range,
 * is on the Overview's sections, where it always was and where it stays free.
 *
 * One window is on the page at a time; the sidebar lists the five and the
 * arrows at the foot step between them. Every figure is from the derive layer
 * (derive/timeline.ts). The working for "The Guide's read" is still published
 * on a signal, and the head of a window can ask the Guide to read that window.
 */
import { render } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { derived, person, depthLocked, depthWorking, depthLane, guideAsk, horizons, actions, section, setSection, sectionFor, DEPTH_KEYS } from "../state.ts";
import { depthEmpty, depthEmptyText, depthOf } from "../derive/depth.ts";
import { fmtDay, todayStr } from "../derive/format.ts";
import { WINDOWS, timelineOf, windowWorking, dayMonthYear, type Lane, type Timeline, type WindowKey } from "../derive/timeline.ts";
import SWING from "../../data/usual-swing.ts";
import { Pager } from "./Pager.tsx";

/** What the head's button calls the window in view. */
const THIS: Record<WindowKey, string> = { "1m": "this month", "3m": "these three months", "6m": "these six months", "1y": "this year", "3y": "these three years" };
const dayShort = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const dayShortYear = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

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
      <p class="t-small text-text-2">{self ? "How you got here: one month to three years, blood work beside fitness on one line of time, and whether a change is more than its usual swing. Each marker's own chart, at every range, stays on your Overview." : `${name || "This person"}'s Overview, Body and Reports are here as before. In depth on everyone you see comes with Max.`}</p>
      <div class="flex flex-wrap gap-2"><a href="/plans" class="r-btn inline-flex min-h-10 items-center bg-accent px-4 text-[13px] font-semibold text-canvas">See the plans</a><button type="button" onClick={() => actions.goTab("overview")} class="min-h-10 px-3 text-[13px] font-semibold text-text-2 hover:text-text">Not now</button></div>
    </div>
  );
}

/** Where a label sits beside its mark: above it, or under it when the mark is near the top; pulled in at either end of the lane. */
const labelStyle = (x: number, y: number) => ({ left: pct(x), top: pct(1 - y), transform: `translate(${x > 0.93 ? "-100%" : x < 0.07 ? "0" : "-50%"}, ${y > 0.62 ? "9px" : "calc(-100% - 7px)"})` });

/** One marker, in its own lane and on its own scale. Lines and bars are drawn; marks and their figures are set over them, so nothing stretches with the page's width. */
function LaneRow({ l, lit, first }: { l: Lane; lit: boolean; first: boolean }) {
  return (
    <div id={`lane-${l.key}`} class={`grid grid-cols-1 items-center gap-x-4 gap-y-1 py-2 transition-colors duration-500 sm:grid-cols-[156px_minmax(0,1fr)] ${first ? "" : "border-t border-border"} ${lit ? "bg-accent-fill" : ""}`}>
      <div class="min-w-0">
        <div class="text-[13.5px] font-semibold leading-tight text-text">{l.label}</div>
        <div class="font-mono text-[10.5px] font-medium text-text-3">{l.sub}</div>
      </div>
      <div class="relative h-[68px]" role="img" aria-label={l.alt}>
        {(l.marks ?? []).map((m) => <span key={`mark:${m.x}`} class="absolute bottom-0 top-0 border-l border-dashed border-caution" style={{ left: pct(m.x) }} title={m.title}></span>)}
        <div class="absolute inset-x-0 bottom-[14px] top-[18px]">
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {(l.bars ?? []).map((b) => <rect key={b.x0} x={b.x0 * 1000} y={(1 - b.h) * 100} width={Math.max(1, (b.x1 - b.x0) * 1000)} height={b.h * 100} fill="var(--color-accent)"><title>{b.title}</title></rect>)}
            {l.goal ? <line x1="0" x2="1000" y1={(1 - l.goal.y) * 100} y2={(1 - l.goal.y) * 100} stroke="var(--color-accent-text)" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" /> : null}
            {(l.links ?? []).map((seg, i) => <polyline key={`k${i}`} points={seg.map((q) => `${q.x * 1000},${(1 - q.y) * 100}`).join(" ")} fill="none" stroke="var(--color-border-strong)" stroke-width="1.5" vector-effect="non-scaling-stroke" />)}
            {(l.lines ?? []).map((seg, i) => <polyline key={`l${i}`} points={seg.map((q) => `${q.x * 1000},${(1 - q.y) * 100}`).join(" ")} fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />)}
          </svg>
          {(l.dots ?? []).map((q) => (
            <span key={`${q.x}:${q.y}`}>
              <span class={`absolute block ${q.shape === "diamond" ? "h-[8px] w-[8px] rotate-45 bg-text" : "h-[8px] w-[8px] rounded-full bg-accent"}`} style={{ left: pct(q.x), top: pct(1 - q.y), marginLeft: "-4px", marginTop: "-4px" }} title={q.title}></span>
              {q.label ? <span class="absolute whitespace-nowrap font-mono text-[10.5px] font-medium leading-none text-text" style={labelStyle(q.x, q.y)}>{q.label}</span> : null}
            </span>
          ))}
          {/* the words sit in the empty stretch when it is wide enough to hold them; a narrower one is said under the lanes */}
          {(l.gaps ?? []).filter((g) => g.x1 - g.x0 >= 0.16).map((g) => <span key={`gap:${g.x0}`} class="absolute bottom-0 -translate-x-1/2 text-center text-[10px] leading-[1.15] text-text-3" style={{ left: pct((g.x0 + g.x1) / 2) }}>nothing<br />logged</span>)}
        </div>
        {l.goal ? <span class="absolute left-0 top-0 font-mono text-[10px] font-medium leading-none text-accent-text">{l.goal.text}</span> : null}
        {(l.marks ?? []).map((m) => <span key={`text:${m.x}`} class="absolute top-0 whitespace-nowrap text-[10px] leading-none text-caution" style={{ left: pct(m.x), transform: m.x > 0.6 ? "translateX(calc(-100% - 5px))" : "translateX(5px)" }}>{m.text}</span>)}
      </div>
    </div>
  );
}

/** The months under the lanes, and a horizon's own stretch marked over them. */
function Axis({ t }: { t: Timeline }) {
  return (
    <div class="grid grid-cols-1 gap-x-4 border-t border-border-strong pt-1.5 sm:grid-cols-[156px_minmax(0,1fr)]">
      <span class="hidden sm:block"></span>
      <div class="relative h-[22px]">
        {t.stretches.map((s) => <span key={s.label} class="absolute top-0 h-[3px] rounded-full bg-accent" style={{ left: pct(s.x0), width: `max(4px, ${pct(s.x1 - s.x0)})` }} title={s.label}></span>)}
        {t.axis.map((a) => <span key={a.label + a.x} class="absolute top-[7px] whitespace-nowrap font-mono text-[10px] text-text-3" style={{ left: pct(a.x), transform: a.x > 0.95 ? "translateX(-100%)" : a.x < 0.03 ? "none" : "translateX(-50%)" }}>{a.label}</span>)}
      </div>
    </div>
  );
}

const Th = ({ t, right, wide }: { t: string; right?: boolean; /** Shown as a column from the small breakpoint up; on a phone its words sit under the row. */ wide?: boolean }) => <th class={`t-eyebrow pb-2 font-medium ${right ? "pr-2 text-right sm:pr-4" : "text-left"} ${wide ? "hidden sm:table-cell" : ""}`}>{t}</th>;

/** The papers behind the swing figures, one line a marker: the page names the study behind every line it draws. */
function SwingSources() {
  const rows: [string, string, { source?: string; pubmed?: string; note?: string }][] = [
    ["LDL", `${Math.round(SWING.markers.ldlC.swingLowPct)} to ${Math.round(SWING.markers.ldlC.swingHighPct)}%`, SWING.markers.ldlC],
    ["ApoB", `${Math.round(SWING.markers.apoB.swingLowPct)}%`, SWING.markers.apoB],
    ["HbA1c", `${SWING.markers.hba1c.swingLowPct} to ${SWING.markers.hba1c.swingHighPct}% of the value`, SWING.markers.hba1c],
    ["Fasting glucose", `${Math.round(SWING.markers.fastingGlucose.swingLowPct)}%`, SWING.markers.fastingGlucose],
    ["hs-CRP", `more than ${(1 + SWING.markers.hsCRP.risePct / 100).toFixed(1)} times, or a fall of more than ${SWING.markers.hsCRP.fallPct}%`, SWING.markers.hsCRP],
  ];
  return (
    <details class="mt-3">
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

export function Depth() {
  const d = derived.value, p = person.value;
  const locked = depthLocked.value;
  const today = todayStr();
  const cur = sectionFor("depth", section.value) as WindowKey;
  const hz = horizons.value;
  const want = depthLane.value;
  /** A window started after a gap, at the person's word: kept while the page is open, one start per window. */
  const [after, setAfter] = useState<Partial<Record<WindowKey, string>>>({});
  const [lit, setLit] = useState("");
  // the working for the Guide's read is the page's own figures whatever the plan: the Guide has its own gate
  const depth = useMemo(() => (d && p && !depthEmpty(d) ? depthOf(d, p, today) : null), [d, p, today]);
  useEffect(() => { depthWorking.value = depth?.working ?? null; }, [depth]);
  // a horizon that is running, or one read to its date, is a stretch of this line of time
  const stretches = useMemo(() => (hz ?? []).filter((h) => !h.closed_at || h.checkins.some((c) => c.kind === "final")).map((h) => ({ from: h.starts_on, to: h.ends_on, label: `Horizon, ${dayShortYear(h.starts_on)} to ${dayShortYear(h.ends_on)}` })), [hz]);
  const t = useMemo(() => (d && !locked ? timelineOf(d, cur, today, { from: after[cur], horizons: stretches }) : null), [d, locked, cur, today, after, stretches]);
  // a link elsewhere on the page asked for one marker's lane: bring it into view and light it once
  useEffect(() => {
    if (!want || !t) return;
    const el = document.getElementById(`lane-${want}`);
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

  const def = WINDOWS[cur];
  const at = DEPTH_KEYS.indexOf(cur);
  const synced = d.signals.length ? String(d.signals[d.signals.length - 1].day) : String(d.doc.generated_at ?? "").slice(0, 10);
  const askGuide = () => {
    if (!depth) return;
    guideAsk.value = { window: cur, working: { ...depth.working, read: "window", window: windowWorking(t) } };
    actions.goTab("guide");
  };

  return (
    <div class="flex flex-col gap-5">
      {!p.self ? <p class="t-caption text-text-3">Viewing {p.name || "this person"} · read-only · synced {synced ? fmtDay(synced) : "—"} · the athlete's own words appear only in Messages</p> : null}
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="t-eyebrow">In depth <span aria-hidden="true">&rsaquo;</span> {def.label} · {dayMonthYear(t.from)} to today</div>
          <h1 class="t-display mt-2 text-text">{def.name}, on one line of time</h1>
          <p class="t-small mt-2 max-w-3xl text-text-2">How {p.self ? "you" : "they"} got here. Each marker has its own lane and its own scale, and all of them share the months underneath.</p>
        </div>
        {depth && !t.empty ? <button type="button" onClick={askGuide} class="r-btn inline-flex min-h-10 shrink-0 items-center border border-accent-border bg-accent-fill px-4 text-[13px] font-semibold text-accent-text transition-colors hover:border-accent">Ask the Guide to read {THIS[cur]}</button> : null}
      </div>

      {t.empty ? (
        <section class="r-card border border-border bg-card p-5 sm:p-6">
          <p class="t-small text-text-2">Nothing was recorded in this window. A longer one may hold it.</p>
          {t.notes.map((n) => <p key={n} class="t-caption mt-2 max-w-3xl text-text-3">{n}</p>)}
        </section>
      ) : <>
        {/* ── the lanes, on one line of time ── */}
        <section id={`depth-${cur}`} class="r-card border border-border bg-card px-5 pb-4 pt-2 sm:px-6">
          {t.lanes.map((l, i) => <LaneRow key={l.key} l={l} lit={lit === l.key} first={i === 0} />)}
          <Axis t={t} />
          <p class="t-caption mt-3 text-text-2">Lines that move in the same months do not show that one moved the other.</p>
          {t.stretches.length ? <p class="t-caption mt-1 text-text-3">The bar over the months is {p.self ? "your" : "their"} horizon: {t.stretches.map((s) => s.label.replace(/^Horizon, /, "")).join(" · ")}.</p> : null}
          {t.changes.length ? <p class="t-caption mt-1 text-text-3">A new wearable is marked where it began. Figures from two wearables are not set against each other.</p> : null}
          {t.gap ? <p class="t-caption mt-1 text-text-3">Nothing was logged from {dayShort(t.gap.from)} to {dayShort(t.gap.to)}. It is left empty, not drawn as zero. <button type="button" onClick={() => setAfter({ ...after, [cur]: new Date(new Date(t.gap!.to + "T00:00:00").getTime() + 86400000).toLocaleDateString("en-CA") })} class="font-semibold text-accent-text hover:text-text">Start the view after it</button></p> : null}
          {t.custom ? <p class="t-caption mt-1 text-text-3">This view starts on {dayMonthYear(t.from)}, after a stretch with nothing logged. <button type="button" onClick={() => { const next = { ...after }; delete next[cur]; setAfter(next); }} class="font-semibold text-accent-text hover:text-text">Show the whole window</button></p> : null}
          {t.notes.map((n) => <p key={n} class="t-caption mt-1 max-w-3xl text-text-3">{n}</p>)}
        </section>

        {/* ── what moved, and what held ── */}
        {t.rows.length ? <section class="r-card border border-border bg-card p-5 sm:p-6">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="t-title text-text">What moved, and what held</h2>
            <span class="t-caption text-text-3">Each marker against itself: the reading nearest {dayShortYear(t.from)}, and the latest</span>
          </div>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full border-collapse sm:min-w-[640px]">
              <thead><tr><Th t="Marker" /><Th t="Then" right /><Th t="Now" right /><Th t="Change" right /><Th t="More than its usual swing?" wide /></tr></thead>
              <tbody>
                {t.rows.map((r) => (<>
                  <tr key={r.key} class="border-t border-border align-top">
                    <td class="t-small py-2 pr-2 font-semibold text-text sm:pr-3">{r.label}{r.unit ? <span class="t-unit block font-normal sm:ml-1.5 sm:inline">{r.unit}</span> : null}</td>
                    <td class="whitespace-nowrap py-2 pr-2 text-right sm:pr-4"><span class={`t-figure-row ${r.then === "—" ? "text-text-3" : "text-text-2"}`}>{r.then}</span>{r.thenOn ? <span class="t-caption block text-text-3">{dayShortYear(r.thenOn)}</span> : null}</td>
                    <td class="whitespace-nowrap py-2 pr-2 text-right sm:pr-4"><span class={`t-figure-row ${r.now === "—" ? "text-text-3" : "text-text"}`}>{r.now}</span>{r.nowOn ? <span class="t-caption block text-text-3">{r.nowOn === today ? "now" : dayShortYear(r.nowOn)}</span> : null}</td>
                    <td class="whitespace-nowrap py-2 text-right sm:pr-4"><span class={`t-figure-row ${r.change === "—" ? "text-text-3" : "text-text"}`}>{r.change}</span></td>
                    <td class={`t-small hidden py-2 sm:table-cell ${r.quiet ? "text-text-3" : "text-text-2"}`}>{r.words}</td>
                  </tr>
                  {/* on a phone the answer sits under its row, never off the side of the screen */}
                  <tr key={`${r.key}:words`} class="sm:hidden"><td colSpan={4} class={`t-small pb-2.5 ${r.quiet ? "text-text-3" : "text-text-2"}`}>{r.words}</td></tr>
                </>))}
              </tbody>
            </table>
          </div>
          <p class="t-caption mt-3 max-w-3xl text-text-3">{t.rows.some((r) => r.key === "rhr" || r.key === "sleep" || r.key === "steps") ? "A resting heart rate, a night's sleep and a day's steps are two-week averages at each end. " : ""}No colour marks a change as good or bad: the page says what moved, not what it means.</p>
          {t.rows.some((r) => r.range || r.swing) ? <SwingSources /> : null}
        </section> : null}
      </>}

      {depth?.heartRows.length ? <p class="t-caption text-text-3">The mornings and nights behind these lines: <button type="button" onClick={() => exportHeartRows(depth.heartRows, today, p.name)} class="font-semibold text-accent-text hover:text-text">export the last 90 days as CSV</button>. Each marker's own chart, at every range, is on the Overview.</p> : null}

      <Pager at={at + 1} of={DEPTH_KEYS.length}
        prev={at > 0 ? { label: WINDOWS[DEPTH_KEYS[at - 1]].label, go: () => setSection(DEPTH_KEYS[at - 1]) } : null}
        next={at < DEPTH_KEYS.length - 1 ? { label: WINDOWS[DEPTH_KEYS[at + 1]].label, go: () => setSection(DEPTH_KEYS[at + 1]) } : null} />
    </div>
  );
}

export function mountDepth(root: HTMLElement) { render(<Depth />, root); }
