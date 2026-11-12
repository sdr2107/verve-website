/**
 * The Guide, its own tab: what stands out? (canvas "Verve, one story in four
 * parts", board 05, 11 Nov 2026; the tab since "My health, redesigned",
 * board 4; the read itself since 26 Oct 2026, docs/design/guides-read/README.md).
 *
 *   the read     a short label in the label face ("The Guide · Thursday 12
 *                November"); how many things stand out; who wrote it and
 *                from what, in the text face (canvas "In depth redrawn",
 *                board 06: two sentences in the label face read as code);
 *                then each thing: one line, a sentence or two, the figures
 *                it rests on (the page's own, counted as they stood on the
 *                day of the read, never the model's), the study behind it
 *                from a fixed shelf of Science pages, and two doors: into
 *                time on In depth, or onto Horizon as a draft target
 *   the aside    your reads, one list, newest first, the read on the page
 *                marked, Open and Delete on every row (board 06); what the
 *                Guide read; what it will not do; the allowance, true to
 *                the server
 *   a window     In depth's head can ask for a read of the window in view
 *                (state.guideAsk): the same form, the same function
 *   premium      shown when the function answers pro_required
 *
 * It describes. It does not advise, name a condition, say why a figure
 * moved, or use a number that is not on the page.
 *
 * Rows: public.web_reads (the viewer's own). Writing: the depth-summary
 * function, through the page's call(). The Overview keeps one line of its
 * own about the latest read; nothing is drawn into the band any more.
 * Plain DOM, like the page.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { effect } from "@preact/signals";
import { addDays, esc, fmtDay, mondayOf, round0, todayStr } from "../derive/format";
import { dueLineOf } from "../derive/reads";
import { derived, guideAsk, horizons, openOverTime, setGuideDraft } from "../state.ts";
import { weekFiguresOf } from "../derive/snapshot.ts";
import { fmtHMin } from "../derive/signals.ts";
import { restingBPOf } from "../derive/markers.ts";
import { LANE_FOR, WINDOWS, DEFAULT_WINDOW, isWindowKey, timelineOf, usualSwingForGuide, type WindowKey } from "../derive/timeline.ts";
import { MARKER_BY_KEY, latestOf, upTo, fmtValue, isTargetable, openTargets, type MarkerKey } from "../horizon/derive.ts";
import { MARKER_KEYS, WILL_NOT, markerOf, standOut, studyOf } from "../derive/guideLines.ts";

export type ReadsContext = {
  personId: string;
  personName: string;      // "" on your own page
  self: boolean;
  /** The page is theirs to set a horizon on: their own, or someone they look after. */
  owner: boolean;
  userId: string;
  myLabel: string;
  consented: boolean;
  /** where a read can be shared: the active threads on this page */
  threads: { id: string; label: string }[];
  /** the page's working (the In depth numbers); null while it is being drawn */
  working: () => Record<string, unknown> | null;
  /** the function's address and the session token */
  call: (body: Record<string, unknown>) => Promise<{ ok: boolean; status: number; out: any }>;
};

type Read = { id: string; title: string; summary: any; facts: any; note: string; shared_at: string | null; downloaded_at: string | null; created_at: string; model: string };

/** The window a read covers, when it read one; null for a read of the week. */
const windowOf = (r: { summary?: any } | null): WindowKey | null => { const w = String(r?.summary?.window ?? ""); return isWindowKey(w) ? w : null; };
const day = (iso: string) => String(iso).slice(0, 10);
const longDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const dayMonth = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const titleOf = (r: Read) => r.title || (String(r.summary?.lead ?? "").split(/(?<=[.!?])\s/)[0] || "A read of your page").slice(0, 80);
/** The week a read covers: the Monday-to-Sunday week before the week it was written in. */
const weekCoveredBy = (r: Read) => addDays(mondayOf(new Date(day(r.created_at) + "T00:00:00")), -7);
const DASH = "—";
export const ALLOWANCE_LINE = "Your first read is included. Pro reads every week, the month and the year too.";

const btn = (k: string, t: string, primary = false, disabled = false) =>
  `<button type="button" data-r="${k}" ${disabled ? "disabled" : ""} class="r-btn min-h-10 w-full px-3 text-[13px] font-semibold transition-colors ${primary ? "bg-accent text-canvas hover:opacity-90" : "border border-border text-text-2 hover:border-border-strong hover:text-text"} disabled:opacity-60">${t}</button>`;
const card = (inner: string) => `<div class="r-card border border-border bg-card p-4">${inner}</div>`;

export function mountReads(band: HTMLElement, tab: HTMLElement, supabase: SupabaseClient, goTab: (t: string) => void) {
  let ctx: ReadsContext | null = null;
  let reads: Read[] = [];
  let open: Read | null = null;
  let state: "idle" | "writing" | "premium" | "error" = "idle";
  let error = "";
  /** A window In depth asked the Guide to read; held until it is written, so a consent box ticked in between does not lose it. */
  let pendingAsk: { window: WindowKey; working: Record<string, unknown> } | null = null;
  /** The read whose row is asking "Delete it, or keep it?"; one at a time. */
  let confirming: string | null = null;
  /** Your reads shows the newest eight until the older ones are asked for. */
  let showOlder = false;

  // the band on Overview is the page's own one line now (board 2): nothing is drawn here
  function drawBand() { band.innerHTML = ""; }

  function consentBox() {
    return ctx!.consented ? "" : `<label class="mt-3 flex items-start gap-2.5 text-[13px] leading-relaxed text-text-2"><input type="checkbox" data-r="consent" class="mt-0.5 h-4 w-4 shrink-0 accent-accent" /><span>Send the numbers on this page to Anthropic's Claude to write it. Not ${ctx!.self ? "your" : "the"} name, not the reports, not the email, not messages. Deleted from their systems within 30 days; never used to train.</span></label>`;
  }
  const writeLabel = () => {
    if (state === "writing") return "Writing…";
    if (pendingAsk) return `Read ${WINDOWS[pendingAsk.window].name.toLowerCase()}`;
    const monday = mondayOf(new Date());
    const thisWeek = reads.some((r) => day(r.created_at) >= monday);
    return reads.length ? (thisWeek ? "Write a new read" : "Read this week") : "Write my first read";
  };
  const errorLine = () => state === "error" ? `<p class="t-small mt-3 text-concern">${esc(error)}</p>` : "";

  /** The row a figure sits in, in the aside's list. */
  const figureRow = (l: string, v: string, u: string) =>
    `<div class="flex items-baseline justify-between gap-3 border-t border-border py-[7px] first:border-t-0"><span class="t-small text-text-2">${l}</span><span class="shrink-0 whitespace-nowrap"><span class="t-figure-row ${v === DASH ? "text-text-3" : "text-text"}">${v}</span>${u && v !== DASH ? `<span class="t-unit ml-1">${u}</span>` : ""}</span></div>`;
  /** What the Guide read: the week the read covers, as the app counts it; or, for a read of a window, that window's own table. */
  function readRows(r: Read | null): string {
    const d = derived.value;
    if (!d) return "";
    const win = windowOf(r);
    if (r && win) {
      const t = timelineOf(d, win, day(r.created_at));
      const rows = t.rows.filter((x) => x.now !== DASH).slice(0, 9);
      return card(`<div class="t-eyebrow">What the Guide read</div><div class="mt-2 flex flex-col">${rows.map((x) => figureRow(esc(x.label), esc(x.then !== DASH && x.change !== DASH ? `${x.then} → ${x.now}` : x.now), esc(x.unit))).join("")}</div>
        <p class="t-caption mt-2 text-text-3">${esc(WINDOWS[win].name)} on In depth, as it stood on ${esc(dayMonth(day(r.created_at)))}. Counted by the app and the page before the Guide saw them.</p>`);
    }
    const monday = r ? weekCoveredBy(r) : addDays(mondayOf(new Date()), -7);
    const f = weekFiguresOf(d, monday, todayStr());
    const sunday = addDays(monday, 6);
    const S = (d.by.get("sbp") ?? []).filter((p) => p.d <= sunday), D = (d.by.get("dbp") ?? []).filter((p) => p.d <= sunday);
    const bp = restingBPOf(S, D);
    const rows: [string, string, string][] = [
      ["Sessions", String(f.sessions), ""],
      ["Weekly dose", f.dose != null ? f.dose.toLocaleString() : DASH, f.dose != null ? "MET-min" : ""],
      ["Zone 2 · Zone 3", f.z2 != null || f.z3 != null ? `${f.z2 != null ? round0(f.z2) : DASH} · ${f.z3 != null ? round0(f.z3) : DASH}` : DASH, f.z2 != null || f.z3 != null ? "min" : ""],
      ["Sleep, average", f.sleepAvg != null ? fmtHMin(f.sleepAvg) : DASH, ""],
      ["Resting HR · HRV", f.rhr != null || f.hrv != null ? `${f.rhr != null ? round0(f.rhr) : DASH} · ${f.hrv != null ? round0(f.hrv) : DASH}` : DASH, f.rhr != null || f.hrv != null ? "bpm · ms" : ""],
      ["Blood pressure", bp ? `${bp.sbp}/${bp.dbp}` : DASH, bp ? "mmHg" : ""],
      ["Weight", f.weight != null ? String(Math.round(f.weight * 10) / 10) : DASH, f.weight != null ? "kg" : ""],
      ["Background movement", f.background != null ? round0(f.background) : DASH, f.background != null ? "min a day" : ""],
    ];
    return card(`<div class="t-eyebrow">What the Guide read</div><div class="mt-2 flex flex-col">${rows.map(([l, v, u]) => figureRow(l, v, u)).join("")}</div>
      <p class="t-caption mt-2 text-text-3">The week of ${esc(dayMonth(monday))}, counted by the app and the page before the Guide saw them.</p>`);
  }
  const notCard = () => card(`<div class="t-eyebrow">What it will not do</div><div class="mt-2 flex flex-col">${WILL_NOT.map((w) => `<div class="t-small border-t border-border py-[7px] text-text-2 first:border-t-0">${w}</div>`).join("")}</div>`);
  /** What a read covers, in a few words: the week it read, or the window. */
  const coverOf = (x: Read) => { const w = windowOf(x); return w ? WINDOWS[w].name : `Week of ${dayMonth(weekCoveredBy(x))}`; };

  /** The day a read was written, as its row says it: the year only when it is not this one. */
  const readOn = (x: Read) => { const d = day(x.created_at); return d.slice(0, 4) === todayStr().slice(0, 4) ? dayMonth(d) : fmtDay(d); };
  /**
   * Your reads: one list, newest first, the read on the page marked, and every row opens and deletes (canvas "In depth
   * redrawn", board 06; the founder asked on 12 Nov 2026 where the earlier reads are and how one is deleted). Delete
   * asks in the row itself, never in a browser dialog. The newest eight show; the older ones are one press away.
   */
  const READS_SHOWN = 8;
  function yourReads(r: Read | null): string {
    if (!reads.length) return "";
    const b = "min-h-8 px-1 text-[12.5px] font-semibold";
    const rows = (showOlder ? reads : reads.slice(0, READS_SHOWN)).map((x) => {
      // a read is named by what it covers ("the week of 26 October"), never by the day it was written alone: that day is another row's week
      const when = esc(readOn(x)), cover = esc(coverOf(x)), what = `the read of ${cover.charAt(0).toLowerCase()}${cover.slice(1)}`;
      if (confirming === x.id) return `<div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-[10px] border border-accent-border bg-accent-fill px-2.5 py-2">
        <span class="t-small text-text">Delete ${what}?</span>
        <button type="button" data-delete-yes="${x.id}" class="${b} text-text-2 hover:text-concern">Delete it</button>
        <button type="button" data-delete-no class="${b} text-accent-text hover:text-text">Keep it</button>
        <span class="t-caption col-span-3 text-text-3">Written ${when}. A copy you shared into Messages stays there.</span></div>`;
      return `<div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 border-t border-border pt-1.5 first:border-t-0 first:pt-0">
        <span class="t-small min-w-0 truncate text-text">${cover}</span>
        ${x.id === r?.id ? `<span class="t-caption font-semibold text-accent-text">on the page</span>` : `<button type="button" data-open="${x.id}" aria-label="Open ${what}, written ${when}" class="${b} text-accent-text hover:text-text">Open</button>`}
        <button type="button" data-delete-ask="${x.id}" aria-label="Delete ${what}, written ${when}" class="${b} text-text-2 hover:text-concern">Delete</button>
        <span class="t-caption col-span-3 -mt-1 text-text-3">read ${when}</span></div>`;
    }).join("");
    const older = reads.length > READS_SHOWN && !showOlder ? `<button type="button" data-older class="t-small mt-2 min-h-8 w-full border-t border-border pt-2 text-left font-semibold text-accent-text hover:text-text">Show older reads</button>` : "";
    return card(`<div class="flex items-baseline justify-between gap-3"><div class="t-eyebrow">Your reads</div><span class="t-caption text-text-3">${reads.length} on file</span></div><div class="mt-2 flex flex-col gap-1.5">${rows}</div>${older}`);
  }

  function allowanceCard(r: Read | null): string {
    const shares = r && ctx!.threads.length ? ctx!.threads.map((t) => btn(`share:${t.id}`, r.shared_at ? `Shared · share again with ${esc(t.label)}` : `Share with ${esc(t.label)}`)).join("") : "";
    return card(`<div class="t-eyebrow">Allowance</div><p class="t-small mt-2 text-text-2">${ALLOWANCE_LINE}</p>${consentBox()}
      <div class="mt-3 flex flex-col gap-2">${btn("write", writeLabel(), true, state === "writing")}${shares}${r ? btn("pdf", "Download as PDF") : ""}</div>
      ${r ? `<label class="t-eyebrow mt-4 block">My note</label><textarea data-r="notebox" rows="3" maxlength="2000" placeholder="What I will do about it…" class="r-btn mt-1 w-full resize-none border border-border bg-alt px-3 py-2 text-[13px] text-text placeholder:text-text-3 focus:border-accent-border focus:outline-none">${esc(r.note ?? "")}</textarea><span data-r="notemsg" class="t-caption text-text-3"></span><span data-r="msg" class="t-caption block text-text-3"></span>` : ""}`);
  }

  function firstRead(): string {
    return `<section class="r-card max-w-3xl border border-border bg-card p-6">
      <div class="t-eyebrow">The Guide</div>
      <h2 class="t-display mt-2 text-text">What stands out in ${ctx!.self ? "your" : `${esc(ctx!.personName || "this person")}'s`} figures</h2>
      <p class="t-read mt-3 text-text-2">A short read of the week that closed, on Mondays: at most three things, a sentence or two each, with the figures and the study behind every line. It is written by an AI model from the numbers on this page and nothing else. The Guide describes; it does not advise. Every read is filed here by date.</p>
      ${consentBox()}
      <div class="mt-5 flex flex-wrap items-center gap-3"><span class="w-full sm:w-auto">${btn("write", writeLabel(), true, state === "writing")}</span><span class="t-caption text-text-3">${ALLOWANCE_LINE}</span></div>
      ${errorLine()}</section>`;
  }

  function premium(): string {
    return `<section class="r-card max-w-3xl border border-accent-border bg-card p-6">
      <div class="t-eyebrow text-accent-text">The Guide · Pro</div>
      <h2 class="t-display mt-2 text-text">Your first read was included</h2>
      <p class="t-read mt-3 text-text-2">${ALLOWANCE_LINE} Pro in the Verve app covers the website too, and a read is filed here every time, to compare, share and download.</p>
      <div class="mt-5 flex flex-wrap gap-2"><a href="/plans" class="r-btn inline-flex min-h-10 items-center bg-accent px-4 text-[13px] font-semibold text-canvas">The plans</a><a href="/start" class="r-btn inline-flex min-h-10 items-center border border-border px-4 text-[13px] font-semibold text-text-2 hover:border-border-strong hover:text-text">Start the trial in the app</a></div>
      <p class="t-caption mt-4 text-text-3">Only the numbers go to the AI, never your name, reports, notes or messages.</p></section>`;
  }

  /** The figures a line rests on, from the page as it stood on the day of the read: where the marker stood, how it ran over the window, its usual swing. */
  function figuresFor(marker: MarkerKey | null, r: Read): string {
    const d = derived.value;
    if (!marker || !d) return "";
    const on = day(r.created_at), def = MARKER_BY_KEY[marker];
    const chip = (where: string, fig: string) => `<span class="r-chip inline-flex min-h-6 items-center gap-1.5 border border-border bg-canvas px-2.5 py-0.5 text-[11.5px] text-text-2">${where} <b class="font-mono text-[11.5px] font-semibold text-text">${esc(fig)}</b></span>`;
    const bits: string[] = [];
    const now = latestOf(marker, upTo(d, on), on);
    if (now) bits.push(chip("Overview", `${now.display ?? fmtValue(def, now.value)}${now.unit ?? def.unit ? ` ${now.unit ?? def.unit}` : ""}`));
    const lane = LANE_FOR[marker];
    const row = lane ? timelineOf(d, windowOf(r) ?? DEFAULT_WINDOW, on).rows.find((x) => x.key === lane) ?? null : null;
    if (row && row.then !== DASH && row.now !== DASH) bits.push(chip("In depth", `${row.then} → ${row.now}`));
    if (row?.range) bits.push(chip("Usual swing", row.range));
    return bits.length ? `<div class="mt-3 flex flex-wrap gap-1.5">${bits.join("")}</div>` : "";
  }
  /** A line's foot: the study behind it, then its two doors, into time and onto Horizon. */
  function doorsFor(c: any, marker: MarkerKey | null, r: Read): string {
    const l = studyOf(marker, `${c.topic ?? ""} ${c.headline ?? ""} ${c.text ?? ""}`);
    const door = "min-h-8 font-semibold text-accent-text hover:text-text";
    // a marker that is out of Horizon (blood, pending review) has no target door, and a target already on file for it is not read
    const onHorizon = !!marker && (horizons.value ?? []).some((h) => !h.closed_at && openTargets(h.targets).some((t) => t.marker === marker));
    const over = `<button type="button" data-over="${marker ? esc(LANE_FOR[marker] ?? "") : ""}" data-window="${windowOf(r) ?? DEFAULT_WINDOW}" class="${door}">See it over time &rarr;</button>`;
    const target = !marker || !isTargetable(marker) ? "" : onHorizon ? `<button type="button" data-onhorizon class="${door}">On ${ctx!.self ? "your" : "their"} horizon already &rarr;</button>`
      : ctx!.owner ? `<button type="button" data-target="${esc(marker)}" data-on="${esc(day(r.created_at))}" class="${door}">Make it a target &rarr;</button>` : "";
    return `<div class="t-small mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-2.5">
      ${l ? `<a href="${l.href}" class="t-caption mr-auto text-text-3 hover:text-text">Study: ${l.label}</a>` : `<span class="mr-auto"></span>`}${over}${target}</div>`;
  }

  function readPage(r: Read): string {
    const sm = r.summary ?? {};
    const things: any[] = Array.isArray(sm.conversations) ? sm.conversations : [];
    const win = windowOf(r);
    const items = things.map((c: any) => {
      const marker = markerOf(c);
      const topic = String(c.topic ?? "").trim();
      // a read from 11 Nov 2026 carries its own one-line heading; an older one is headed by its topic
      const head = String(c.headline ?? "").trim() || (topic ? topic.charAt(0).toUpperCase() + topic.slice(1) : c.who === "coach" ? "For your coach" : "For your doctor");
      return `<article class="r-card mt-3 border border-border bg-card p-5"><h3 class="t-title text-text">${esc(head)}</h3><p class="t-read mt-1.5 text-text-2">${esc(String(c.text ?? ""))}</p>${figuresFor(marker, r)}${doorsFor(c, marker, r)}</article>`;
    }).join("");
    const due = dueLineOf(sm.due, r.created_at);
    const whose = ctx!.self ? "your" : "their";
    // the label face holds the short label alone; who wrote the read, and from what, is said in the text face under the heading
    const from = win ? `Read from ${esc(WINDOWS[win].name.toLowerCase())} on In depth, as it stood that day.`
      : `Read from ${whose} Overview and the week of ${esc(dayMonth(weekCoveredBy(r)))}, counted the way the app counts it.`;
    return `<section class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article class="min-w-0">
        <div class="t-eyebrow">The Guide · ${esc(longDay(day(r.created_at)))}${ctx!.self ? "" : ` · ${esc(ctx!.personName)}`}</div>
        <h2 class="t-display mt-2 text-text">${standOut(things.length)}</h2>
        <p class="t-small mt-2 text-text-2">Written by an AI model from ${whose} own figures. ${from}</p>
        ${sm.lead ? `<p class="t-read mt-4 text-text">${esc(String(sm.lead))}</p>` : ""}
        ${items}
        ${due ? `<section class="mt-5"><h3 class="t-title text-text">Due</h3><p class="t-read mt-1.5 text-text-2">${esc(due)}</p></section>` : ""}
        ${sm.notShared ? `<p class="t-small mt-4 text-text-3">${esc(String(sm.notShared))}</p>` : ""}
        <p class="t-caption mt-6 max-w-2xl text-text-3">The Guide describes; it does not advise. The figures under each line are the page's own, as they stood on the day of the read, and the study is one of the Science pages.${sm.dropped ? ` ${sm.dropped} sentence${sm.dropped === 1 ? "" : "s"} with a number not on the page ${sm.dropped === 1 ? "was" : "were"} dropped.` : ""}</p>
        ${errorLine()}
      </article>
      <aside class="flex flex-col gap-3">${yourReads(r)}${readRows(r)}${notCard()}${allowanceCard(r)}</aside></section>`;
  }

  /**
   * While the Guide writes (a few seconds): the read before this one is not on the page, so nobody reads an old
   * read as the answer to what they just asked (the founder, 12 Nov 2026). It says what is being read; every read
   * on file stays one press away, under Your reads. Nothing moves: the page's rule is no motion after load.
   */
  function writingPage(): string {
    const what = pendingAsk ? WINDOWS[pendingAsk.window].name.toLowerCase() : "the week that closed";
    const bar = (w: string) => `<span class="block h-3.5 rounded bg-alt" style="width:${w}"></span>`;
    const ghost = `<div class="r-card flex flex-col gap-2.5 border border-border bg-card p-5">${bar("58%")}${bar("92%")}${bar("74%")}</div>`;
    return `<section class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article class="min-w-0" aria-live="polite" aria-busy="true">
        <div class="t-eyebrow">The Guide · reading now</div>
        <h2 class="t-display mt-2 text-text">Reading ${esc(what)}</h2>
        <p class="t-small mt-2 text-text-2">The figures are counted on this page first, then sent to the writer. It takes a few seconds.${reads.length ? " The read before this one is kept under Your reads." : ""}</p>
        <div class="mt-4 flex flex-col gap-3" aria-hidden="true">${ghost}${ghost}${ghost}</div>
      </article>
      <aside class="flex flex-col gap-3">${yourReads(null)}${notCard()}</aside></section>`;
  }

  function drawTab() {
    if (!ctx) { tab.innerHTML = ""; return; }
    const r = open ?? reads[0] ?? null;
    tab.innerHTML = state === "premium" ? premium() : state === "writing" ? writingPage() : !r ? firstRead() : readPage(r);
    const note = tab.querySelector("[data-r=notebox]") as HTMLTextAreaElement | null;
    note?.addEventListener("blur", async () => {
      if (!r) return;
      const { error: e } = await supabase.from("web_reads").update({ note: note.value.trim() }).eq("id", r.id);
      if (!e) { r.note = note.value.trim(); (tab.querySelector("[data-r=notemsg]") as HTMLElement).textContent = "Note kept."; }
    });
  }

  // ── PDF: the read alone, on a clean page, through the browser's print ──
  function pdf(r: Read) {
    const sm = r.summary ?? {};
    const w = window.open("", "_blank");
    if (!w) return;
    const items = (sm.conversations ?? []).map((c: any) => `<h3>${esc(String(c.headline || c.topic || (c.who === "coach" ? "For your coach" : "For your doctor")))}</h3><p>${esc(String(c.text ?? ""))}</p>`).join("");
    const due = dueLineOf(sm.due, r.created_at);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>The Guide · ${esc(day(r.created_at))}</title>
      <style>body{font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#111;max-width:680px;margin:48px auto;padding:0 24px}h1{font-weight:600;font-size:28px;letter-spacing:-.02em;margin:6px 0 14px}h3{font-size:16px;margin:18px 0 4px}
      .k{font-family:ui-monospace,monospace;font-size:11px;color:#6b6b80}.lead{font-size:17px;line-height:1.6}p{line-height:1.6}.foot{margin-top:32px;font-size:12px;color:#6b6b80;border-top:1px solid #ddd;padding-top:12px}</style></head>
      <body><div class="k">The Guide · read on ${esc(longDay(day(r.created_at)))} · ${esc(coverOf(r).replace(/^Week/, "the week").replace(/^The /, "the "))}${ctx!.self ? "" : ` · ${esc(ctx!.personName)}`}</div><h1>${esc(titleOf(r))}</h1>
      <p class="lead">${esc(String(sm.lead ?? ""))}</p>${items}${due ? `<h3>Due</h3><p>${esc(due)}</p>` : ""}${r.note ? `<h3>My note</h3><p>${esc(r.note)}</p>` : ""}
      <div class="foot">Written by an AI model from the numbers on the My health page. Wellness information, not a diagnosis and not advice. verve-app.health</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    w.document.close();
    void supabase.from("web_reads").update({ downloaded_at: new Date().toISOString() }).eq("id", r.id).then(() => { r.downloaded_at = new Date().toISOString(); });
  }

  async function share(r: Read, grantId: string) {
    const sm = r.summary ?? {};
    const { error: e } = await supabase.from("messages").insert({
      grant_id: grantId, person_id: ctx!.personId, sender_id: ctx!.userId, sender_role: ctx!.self ? "person" : "viewer", sender_label: ctx!.myLabel,
      kind: "read", body: titleOf(r), payload: { read_id: r.id, title: titleOf(r), lead: sm.lead ?? "", conversations: sm.conversations ?? [], due: dueLineOf(sm.due, r.created_at), on: day(r.created_at) },
    });
    const msgEl = tab.querySelector("[data-r=msg]") as HTMLElement | null;
    if (e) { if (msgEl) msgEl.textContent = `Not shared: ${e.message}`; return; }
    await supabase.from("web_reads").update({ shared_at: new Date().toISOString() }).eq("id", r.id);
    r.shared_at = new Date().toISOString();
    drawTab();
    const m2 = tab.querySelector("[data-r=msg]") as HTMLElement | null;
    if (m2) m2.textContent = "Shared into Messages.";
  }

  async function write() {
    if (!ctx) return;
    const ask = pendingAsk;
    const base = ask?.working ?? ctx.working();
    if (!base) { state = "error"; error = "The page is still drawing its numbers; try again in a moment."; drawTab(); return; }
    // the keys a line may be tagged with, and how far two results can differ with nothing having changed: both fixed lists, sent with the figures
    const working = { ...base, markerKeys: MARKER_KEYS, usualSwing: usualSwingForGuide() };
    if (!ctx.consented) {
      const box = tab.querySelector("[data-r=consent]") as HTMLInputElement | null;
      if (!box?.checked) { state = "error"; error = "Tick the box first: it says what is sent, and what is not."; goTab("guide"); drawTab(); return; }
      const { error: e } = await supabase.from("ai_consent").upsert({ user_id: ctx.userId, summary_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (e) { state = "error"; error = `Could not record your consent: ${e.message}`; drawTab(); return; }
      ctx.consented = true;
    }
    state = "writing"; error = ""; goTab("guide"); drawTab();
    const { ok, status, out } = await ctx.call({ person_id: ctx.personId, working, force: reads.length > 0, ...(ask ? { window: ask.window } : {}) });
    if (status === 402 || out?.error === "pro_required") { pendingAsk = null; state = "premium"; drawTab(); return; }
    if (!ok || !out?.summary) {
      state = "error";
      error = out?.error === "summary_not_open" ? "The Guide is not switched on yet." : status === 429 ? "Today's allowance is used up; try tomorrow." : `Could not write it${out?.detail ? `: ${out.detail}` : out?.error ? `: ${out.error}` : ""}.`;
      drawTab(); return;
    }
    state = "idle"; pendingAsk = null;
    await loadReads();
    open = reads[0] ?? null;
    draw();
  }
  // In depth's head asked for a read of the window in view: write it here, on this tab
  effect(() => {
    const a = guideAsk.value;
    if (!a) return;
    guideAsk.value = null;
    pendingAsk = a;
    if (ctx) void write(); else goTab("guide");
  });

  async function loadReads() {
    if (!ctx) { reads = []; return; }
    const { data } = await supabase.from("web_reads").select("id, title, summary, facts, note, shared_at, downloaded_at, created_at, model")
      .eq("person_id", ctx.personId).eq("viewer_id", ctx.userId).order("created_at", { ascending: false }).limit(100);
    reads = (data ?? []) as Read[];
  }

  function draw() { drawBand(); drawTab(); }

  const onClick = async (e: Event) => {
    const t = e.target as HTMLElement;
    const r = t.closest("[data-r]") as HTMLElement | null;
    const k = r?.dataset.r ?? "";
    const cur = open ?? reads[0] ?? null;
    if (k === "write") { await write(); return; }
    if (k === "pdf" && cur) { pdf(cur); return; }
    if (k.startsWith("share:") && cur) { await share(cur, k.slice(6)); return; }
    // Your reads: Delete asks in the row; "Delete it" removes that read, "Keep it" puts the row back
    const ask = t.closest("[data-delete-ask]") as HTMLElement | null;
    if (ask) { confirming = ask.dataset.deleteAsk ?? null; drawTab(); return; }
    if (t.closest("[data-delete-no]")) { confirming = null; drawTab(); return; }
    const yes = t.closest("[data-delete-yes]") as HTMLElement | null;
    if (yes) {
      const id = yes.dataset.deleteYes ?? "";
      confirming = null;
      const { error: e } = await supabase.from("web_reads").delete().eq("id", id);
      if (e) { state = "error"; error = `Could not delete it: ${e.message}`; drawTab(); return; }
      if (open?.id === id) open = null;
      await loadReads(); draw(); return;
    }
    if (t.closest("[data-older]")) { showOlder = true; drawTab(); return; }
    const over = t.closest("[data-over]") as HTMLElement | null;
    if (over) { openOverTime(over.dataset.over ?? "", over.dataset.window); return; }
    const target = t.closest("[data-target]") as HTMLElement | null;
    if (target && ctx) { setGuideDraft({ personId: ctx.personId, marker: target.dataset.target!, readOn: target.dataset.on ?? todayStr() }); goTab("horizon"); return; }
    if (t.closest("[data-onhorizon]")) { goTab("horizon"); return; }
    const o = t.closest("[data-open]") as HTMLElement | null;
    if (o) { open = reads.find((x) => x.id === o.dataset.open) ?? null; state = "idle"; confirming = null; drawTab(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  tab.addEventListener("click", onClick);

  return {
    async load(next: ReadsContext | null) {
      if (next?.personId !== ctx?.personId) pendingAsk = null;   // a window asked for on one person's page is not read on another's
      ctx = next; open = null; state = "idle"; error = ""; confirming = null; showOlder = false;
      await loadReads();
      draw();
    },
    count: () => reads.length,
    /** the latest read, for the Overview's one line and the client list */
    latest: () => reads[0] ?? null,
  };
}
