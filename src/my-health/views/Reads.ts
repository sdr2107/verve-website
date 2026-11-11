/**
 * The Guide, its own tab (canvas "My health, redesigned", board 4; the read
 * itself since 26 Oct 2026, docs/design/guides-read/README.md).
 *
 *   the read     eyebrow with the day it was read and the week it covers, the
 *                title, the lead, the things worth a conversation, the footer
 *   the aside    what the Guide read: the week's figures as the app counts
 *                them; earlier reads; the allowance, true to the server
 *   premium      shown when the function answers pro_required
 *
 * Rows: public.web_reads (the viewer's own). Writing: the depth-summary
 * function, through the page's call(). The Overview keeps one line of its
 * own about the latest read; nothing is drawn into the band any more.
 * Plain DOM, like the page.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, esc, fmtDay, mondayOf, round0, todayStr } from "../derive/format";
import { dueLineOf } from "../derive/reads";
import { derived } from "../state.ts";
import { weekFiguresOf } from "../derive/snapshot.ts";
import { fmtHMin } from "../derive/signals.ts";
import { restingBPOf } from "../derive/markers.ts";

export type ReadsContext = {
  personId: string;
  personName: string;      // "" on your own page
  self: boolean;
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

const LEARN: [RegExp, string, string][] = [
  [/triglycer/i, "/science/labs", "what triglycerides tell you"],
  [/ldl|apob|cholesterol|lipid|lp\(a\)|lpa/i, "/science/labs", "what the lipid markers tell you"],
  [/glucose|hba1c|insulin|homa/i, "/science/labs", "what blood sugar markers tell you"],
  [/blood pressure|\bbp\b|systolic/i, "/science/labs", "how to read blood pressure"],
  [/strength|resistance/i, "/science", "why strength sits beside aerobic"],
  [/fitness|vo2|met\b|mets|cooper|walk test/i, "/science", "what your fitness number means"],
  [/zone 2|dose|met-min|activity|volume|workout/i, "/science", "how the weekly dose works"],
  [/sleep|hrv|resting heart|recovery/i, "/science/sleep-heart/resting-heart-rate", "how your heart readings are judged"],
  [/waist|weight|body fat|muscle/i, "/science", "what body measurements show"],
];
const learnFor = (t: string) => LEARN.find(([re]) => re.test(t)) ?? null;
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

  // the band on Overview is the page's own one line now (board 2): nothing is drawn here
  function drawBand() { band.innerHTML = ""; }

  function consentBox() {
    return ctx!.consented ? "" : `<label class="mt-3 flex items-start gap-2.5 text-[13px] leading-relaxed text-text-2"><input type="checkbox" data-r="consent" class="mt-0.5 h-4 w-4 shrink-0 accent-accent" /><span>Send the numbers on this page to Anthropic's Claude to write it. Not ${ctx!.self ? "your" : "the"} name, not the reports, not the email, not messages. Deleted from their systems within 30 days; never used to train.</span></label>`;
  }
  const writeLabel = () => {
    if (state === "writing") return "Writing…";
    const monday = mondayOf(new Date());
    const thisWeek = reads.some((r) => day(r.created_at) >= monday);
    return reads.length ? (thisWeek ? "Write a new read" : "Read this week") : "Write my first read";
  };
  const errorLine = () => state === "error" ? `<p class="t-small mt-3 text-concern">${esc(error)}</p>` : "";

  /** What the Guide read: the week the read covers, as the app counts it. */
  function readRows(r: Read | null): string {
    const d = derived.value;
    if (!d) return "";
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
    return card(`<div class="t-eyebrow">What the Guide read</div><div class="mt-2 flex flex-col">${rows.map(([l, v, u]) =>
      `<div class="flex items-baseline justify-between gap-3 border-t border-border py-[7px] first:border-t-0"><span class="t-small text-text-2">${l}</span><span class="shrink-0 whitespace-nowrap"><span class="t-figure-row ${v === DASH ? "text-text-3" : "text-text"}">${v}</span>${u && v !== DASH ? `<span class="t-unit ml-1">${u}</span>` : ""}</span></div>`).join("")}</div>
      <p class="t-caption mt-2 text-text-3">The week of ${esc(dayMonth(monday))}, counted the way the app counts it.</p>`);
  }

  function earlierReads(r: Read | null): string {
    const others = reads.filter((x) => x.id !== r?.id);
    if (!others.length) return "";
    return card(`<div class="t-eyebrow">Earlier reads</div><div class="mt-2 flex flex-col">${others.slice(0, 8).map((x) =>
      `<button type="button" data-open="${x.id}" class="flex items-baseline justify-between gap-3 border-t border-border py-2 text-left first:border-t-0"><span class="t-small min-w-0 truncate text-text">Week of ${esc(dayMonth(weekCoveredBy(x)))}</span><span class="t-caption shrink-0 text-text-3">${esc(fmtDay(day(x.created_at)))}</span></button>`).join("")}</div>`);
  }

  function allowanceCard(r: Read | null): string {
    const shares = r && ctx!.threads.length ? ctx!.threads.map((t) => btn(`share:${t.id}`, r.shared_at ? `Shared · share again with ${esc(t.label)}` : `Share with ${esc(t.label)}`)).join("") : "";
    return card(`<div class="t-eyebrow">Allowance</div><p class="t-small mt-2 text-text-2">${ALLOWANCE_LINE}</p>${consentBox()}
      <div class="mt-3 flex flex-col gap-2">${btn("write", writeLabel(), true, state === "writing")}${shares}${r ? btn("pdf", "Download as PDF") : ""}</div>
      ${r ? `<label class="t-eyebrow mt-4 block">My note</label><textarea data-r="notebox" rows="3" maxlength="2000" placeholder="What I will do about it…" class="r-btn mt-1 w-full resize-none border border-border bg-alt px-3 py-2 text-[13px] text-text placeholder:text-text-3 focus:border-accent-border focus:outline-none">${esc(r.note ?? "")}</textarea><span data-r="notemsg" class="t-caption text-text-3"></span><span data-r="msg" class="t-caption block text-text-3"></span>
      <button type="button" data-r="delete" class="t-caption mt-2 text-left text-text-3 hover:text-concern">Delete this read</button>` : ""}`);
  }

  function firstRead(): string {
    return `<section class="r-card max-w-3xl border border-border bg-card p-6">
      <div class="t-eyebrow">The Guide</div>
      <h2 class="t-display mt-2 text-text">${ctx!.self ? "Your week" : `${esc(ctx!.personName || "This person")}'s week`}, read on Mondays</h2>
      <p class="t-read mt-3 text-text-2">A short read of the week that closed: the sessions, the dose, sleep, the morning readings and the body, counted the way the app counts them. The Guide describes; it does not prescribe. It can only say what this page already shows, and every read is filed here by date.</p>
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

  function readPage(r: Read): string {
    const sm = r.summary ?? {};
    const items = (Array.isArray(sm.conversations) ? sm.conversations : []).map((c: any) => {
      const l = learnFor(`${c.topic ?? ""} ${c.text ?? ""}`);
      const head = String(c.topic ?? "").trim();
      return `<section class="mt-5"><h3 class="t-title text-text">${head ? esc(head.charAt(0).toUpperCase() + head.slice(1)) : c.who === "coach" ? "For your coach" : "For your doctor"}</h3><p class="t-read mt-1.5 text-text-2">${esc(String(c.text ?? ""))}</p>${l ? `<a href="${l[1]}" class="t-caption mt-1.5 inline-block font-semibold text-accent-text hover:text-text">Learn: ${l[2]} &rarr;</a>` : ""}</section>`;
    }).join("");
    const due = dueLineOf(sm.due, r.created_at);
    return `<section class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article class="min-w-0">
        <div class="t-eyebrow">The Guide · read on ${esc(longDay(day(r.created_at)))} · the week of ${esc(dayMonth(weekCoveredBy(r)))}${ctx!.self ? "" : ` · ${esc(ctx!.personName)}`}</div>
        <h2 class="t-display mt-2 text-text">${esc(titleOf(r))}</h2>
        <p class="t-read mt-4 text-text">${esc(String(sm.lead ?? ""))}</p>
        ${items}
        ${due ? `<section class="mt-5"><h3 class="t-title text-text">Due</h3><p class="t-read mt-1.5 text-text-2">${esc(due)}</p></section>` : ""}
        ${sm.notShared ? `<p class="t-small mt-4 text-text-3">${esc(String(sm.notShared))}</p>` : ""}
        <p class="t-caption mt-6 max-w-2xl text-text-3">Written from ${ctx!.self ? "your" : "their"} own readings. The Guide describes; it does not prescribe. Figures are the week's, counted the way the app counts them.${sm.dropped ? ` ${sm.dropped} sentence${sm.dropped === 1 ? "" : "s"} with a number not on the page ${sm.dropped === 1 ? "was" : "were"} dropped.` : ""}</p>
        ${errorLine()}
      </article>
      <aside class="flex flex-col gap-3">${readRows(r)}${earlierReads(r)}${allowanceCard(r)}</aside></section>`;
  }

  function drawTab() {
    if (!ctx) { tab.innerHTML = ""; return; }
    const r = open ?? reads[0] ?? null;
    tab.innerHTML = state === "premium" ? premium() : !r ? firstRead() : readPage(r);
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
    const items = (sm.conversations ?? []).map((c: any) => `<h3>${esc(String(c.topic ?? (c.who === "coach" ? "For your coach" : "For your doctor")))}</h3><p>${esc(String(c.text ?? ""))}</p>`).join("");
    const due = dueLineOf(sm.due, r.created_at);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>The Guide · ${esc(day(r.created_at))}</title>
      <style>body{font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#111;max-width:680px;margin:48px auto;padding:0 24px}h1{font-weight:600;font-size:28px;letter-spacing:-.02em;margin:6px 0 14px}h3{font-size:16px;margin:18px 0 4px}
      .k{font-family:ui-monospace,monospace;font-size:11px;color:#6b6b80}.lead{font-size:17px;line-height:1.6}p{line-height:1.6}.foot{margin-top:32px;font-size:12px;color:#6b6b80;border-top:1px solid #ddd;padding-top:12px}</style></head>
      <body><div class="k">The Guide · read on ${esc(longDay(day(r.created_at)))} · the week of ${esc(dayMonth(weekCoveredBy(r)))}${ctx!.self ? "" : ` · ${esc(ctx!.personName)}`}</div><h1>${esc(titleOf(r))}</h1>
      <p class="lead">${esc(String(sm.lead ?? ""))}</p>${items}${due ? `<h3>Due</h3><p>${esc(due)}</p>` : ""}${r.note ? `<h3>My note</h3><p>${esc(r.note)}</p>` : ""}
      <div class="foot">Written by Verve from the numbers on the My health page. Wellness information, not a diagnosis. verve-app.health</div>
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
    const working = ctx.working();
    if (!working) { state = "error"; error = "The page is still drawing its numbers; try again in a moment."; drawTab(); return; }
    if (!ctx.consented) {
      const box = tab.querySelector("[data-r=consent]") as HTMLInputElement | null;
      if (!box?.checked) { state = "error"; error = "Tick the box first: it says what is sent, and what is not."; goTab("guide"); drawTab(); return; }
      const { error: e } = await supabase.from("ai_consent").upsert({ user_id: ctx.userId, summary_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (e) { state = "error"; error = `Could not record your consent: ${e.message}`; drawTab(); return; }
      ctx.consented = true;
    }
    state = "writing"; error = ""; goTab("guide"); drawTab();
    const { ok, status, out } = await ctx.call({ person_id: ctx.personId, working, force: reads.length > 0 });
    if (status === 402 || out?.error === "pro_required") { state = "premium"; drawTab(); return; }
    if (!ok || !out?.summary) {
      state = "error";
      error = out?.error === "summary_not_open" ? "The Guide is not switched on yet." : status === 429 ? "Today's allowance is used up; try tomorrow." : `Could not write it${out?.detail ? `: ${out.detail}` : out?.error ? `: ${out.error}` : ""}.`;
      drawTab(); return;
    }
    state = "idle";
    await loadReads();
    open = reads[0] ?? null;
    draw();
  }

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
    if (k === "delete" && cur) {
      if (!confirm("Delete this read? It is removed from your reads; a copy you shared into Messages stays there.")) return;
      await supabase.from("web_reads").delete().eq("id", cur.id);
      await loadReads(); open = null; draw(); return;
    }
    const o = t.closest("[data-open]") as HTMLElement | null;
    if (o) { open = reads.find((x) => x.id === o.dataset.open) ?? null; state = "idle"; drawTab(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };
  tab.addEventListener("click", onClick);

  return {
    async load(next: ReadsContext | null) {
      ctx = next; open = null; state = "idle"; error = "";
      await loadReads();
      draw();
    },
    count: () => reads.length,
    /** the latest read, for the Overview's one line and the client list */
    latest: () => reads[0] ?? null,
  };
}
