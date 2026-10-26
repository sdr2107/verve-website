/**
 * The Guide's read, as its own place (26 Oct 2026). Design: docs/design/guides-read/README.md.
 *
 *   band     the latest read's opening lines at the top of Overview, "Read it in full", "Write a new read"
 *   tab      one read (title, prose, worth a conversation with Learn links, due, provenance) with its actions:
 *            filed, share into Messages, download as PDF (print), a note, delete; "since your last read";
 *            then Your reads: filters, compare two, what your reads keep saying, the trend across reads
 *   premium  shown when the function answers pro_required: the first read is free, then Pro
 *
 * Rows: public.web_reads (the viewer's own). Writing: the depth-summary function. Plain DOM, like the page.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esc, fmtDay } from "../derive/format";

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
const long = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const titleOf = (r: Read) => r.title || (String(r.summary?.lead ?? "").split(/(?<=[.!?])\s/)[0] || "A read of your page").slice(0, 80);

export function mountReads(band: HTMLElement, tab: HTMLElement, supabase: SupabaseClient, goTab: (t: string) => void) {
  let ctx: ReadsContext | null = null;
  let reads: Read[] = [];
  let open: Read | null = null;
  let state: "idle" | "writing" | "premium" | "error" = "idle";
  let error = "";
  let filter = "all";
  let picked: string[] = [];
  let comparing = false;

  const tag = (who: string) => who === "coach"
    ? `<span class="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-success-light">COACH</span>`
    : `<span class="rounded-full bg-danger/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-danger">DOCTOR</span>`;
  const serif = "font-family:'Newsreader',Georgia,serif";

  // ── the band on Overview ────────────────────────────────────────────
  function drawBand() {
    if (!ctx) { band.innerHTML = ""; return; }
    const r = reads[0];
    const lead = r ? String(r.summary?.lead ?? "").split(/(?<=[.!?])\s/).slice(0, 2).join(" ") : "";
    band.innerHTML = `<div class="relative overflow-hidden rounded-[20px] border border-violet-400/40 p-6 sm:p-7" style="background:linear-gradient(135deg,rgba(129,140,248,.13),rgba(167,139,250,.05) 60%,rgba(255,255,255,.02))">
      <div class="flex flex-wrap items-center gap-2.5"><span class="text-accent-light">✦</span>
        <span class="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent-light">THE GUIDE'S READ${r ? ` · ${esc(new Date(r.created_at).toLocaleDateString("en-GB", { month: "long" }).toUpperCase())}` : ""}</span>
        <span class="rounded-md bg-amber-200/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-200">PRO</span>
        ${r ? `<span class="ml-auto text-[12.5px] text-text-tertiary">Read ${esc(fmtDay(day(r.created_at)))}</span>` : ""}</div>
      <p class="mt-3 max-w-4xl text-[21px] leading-[1.5] text-text-primary sm:text-[23px]" style="${serif}">${r ? esc(lead) : `${ctx.self ? "Your" : `${esc(ctx.personName || "Their")}'s`} page in a few calm sentences: how ${ctx.self ? "you are" : "they are"} doing, what is worth a conversation, and what is due.`}</p>
      <div class="mt-5 flex flex-wrap items-center gap-3">
        ${r ? `<button type="button" data-r="full" class="rounded-xl bg-accent px-4 py-2 text-[14px] font-bold text-canvas">✦ Read it in full</button>` : ""}
        <button type="button" data-r="write" class="rounded-xl ${r ? "border border-white/16 text-text-primary" : "bg-accent text-canvas"} px-4 py-2 text-[14px] font-bold">${r ? "Write a new read" : "✦ Write my first read · free"}</button>
        <span class="text-[12.5px] text-text-tertiary">${r ? (r.summary?.provenance ? esc(r.summary.provenance) : "Every number is from this page") : "The first read is free."}</span></div></div>`;
  }

  // ── the tab ─────────────────────────────────────────────────────────
  function drawTab() {
    if (!ctx) { tab.innerHTML = ""; return; }
    const r = open ?? reads[0] ?? null;
    let left = "";
    if (state === "premium") left = premium();
    else if (!r) left = firstRead();
    else left = readPage(r);
    tab.innerHTML = `<div class="flex flex-col gap-8">${left}${reads.length ? library() : ""}</div>`;
    const note = tab.querySelector("[data-r=notebox]") as HTMLTextAreaElement | null;
    note?.addEventListener("blur", async () => {
      if (!r) return;
      const { error: e } = await supabase.from("web_reads").update({ note: note.value.trim() }).eq("id", r.id);
      if (!e) { r.note = note.value.trim(); (tab.querySelector("[data-r=notemsg]") as HTMLElement).textContent = "Note kept."; }
    });
  }

  function consentBox() {
    return ctx!.consented ? "" : `<label class="mt-3 flex items-start gap-2.5 text-[13px] leading-relaxed text-text-secondary"><input type="checkbox" data-r="consent" class="mt-0.5 h-4 w-4 shrink-0 accent-[#818cf8]" /><span>Send the numbers on this page to Anthropic's Claude to write it. Not ${ctx!.self ? "your" : "the"} name, not the reports, not the email, not messages. Deleted from their systems within 30 days; never used to train.</span></label>`;
  }

  function firstRead() {
    return `<section class="rounded-[20px] border border-violet-400/40 p-7" style="background:linear-gradient(160deg,rgba(129,140,248,.12),rgba(255,255,255,.02))">
      <div class="text-[30px] text-accent-light">✦</div>
      <h2 class="mt-1 text-[34px] leading-tight text-text-primary" style="${serif}">The Guide's read</h2>
      <p class="mt-3 max-w-2xl text-[15px] leading-relaxed text-text-secondary">${ctx!.self ? "Your" : `${esc(ctx!.personName || "This person")}'s`} page in a few calm sentences: how ${ctx!.self ? "you are" : "they are"} doing, at most three things worth a conversation with a doctor or a coach, and what is due. It can only say what this page already shows. Every read is filed here by date, to compare, share and download.</p>
      ${consentBox()}
      <div class="mt-5 flex flex-wrap items-center gap-3"><button type="button" data-r="write" class="rounded-xl bg-accent px-5 py-2.5 text-[14px] font-bold text-canvas" ${state === "writing" ? "disabled" : ""}>${state === "writing" ? "Writing…" : "✦ Write my first read · free"}</button>
        <span class="text-[12.5px] text-text-tertiary">The first read is free; further reads come with Pro.</span></div>
      ${state === "error" ? `<p class="mt-3 text-[13px] text-danger">${esc(error)}</p>` : ""}</section>`;
  }

  function premium() {
    const li = (t: string) => `<div class="mt-2.5 flex gap-2.5 text-[14.5px] text-text-primary"><span class="text-success-light">✓</span><span>${t}</span></div>`;
    return `<section class="text-center"><div class="text-[30px] text-accent-light">✦</div>
      <h2 class="text-[34px] leading-tight text-text-primary" style="${serif}">Your first read was free</h2>
      <p class="mx-auto mt-2 max-w-xl text-[14.5px] text-text-secondary">Further reads come with Pro: a read whenever your numbers change, filed, compared, shared and downloaded.</p>
      <div class="mt-6 grid gap-4 text-left sm:grid-cols-2">
        <div class="rounded-[18px] border border-violet-400/50 p-6" style="background:linear-gradient(160deg,rgba(129,140,248,.12),rgba(255,255,255,.02))">
          <div class="font-mono text-[11px] font-bold tracking-[0.14em] text-accent-light">PRO</div><div class="mt-1 text-[22px] font-extrabold text-text-primary">For you</div>
          ${li("A read whenever your numbers change")}${li("Every read filed, compared and downloadable")}${li("Share a read with your coach or clinician")}${li("What your reads keep saying, over months")}
          <a href="/start" class="mt-5 inline-block rounded-xl bg-accent px-4 py-2 text-[14px] font-bold text-canvas">Start the 14-day trial in the app</a>
          <p class="mt-2 text-[12px] text-text-tertiary">Pro in the Verve app covers the website too · cancel any time</p></div>
        <div class="rounded-[18px] border border-white/10 bg-white/[0.03] p-6">
          <div class="font-mono text-[11px] font-bold tracking-[0.14em] text-text-tertiary">COACH</div><div class="mt-1 text-[22px] font-extrabold text-text-primary">For coaches and clinicians</div>
          ${li("A read for every client who shares with you")}${li("Each client's week read, in your client list")}${li("Share a read into the client's Messages")}${li("Export a client's reads for their file")}
          <a href="mailto:hello@verve-app.health?subject=Verve%20for%20coaches" class="mt-5 inline-block rounded-xl border border-white/16 px-4 py-2 text-[14px] font-bold text-text-primary">Talk to us</a></div></div>
      <p class="mt-4 text-[12.5px] text-text-tertiary">Only the numbers go to the AI, never your name, reports, notes or messages.</p></section>`;
  }

  function readPage(r: Read) {
    const sm = r.summary ?? {};
    const prev = reads[reads.indexOf(r) + 1] ?? null;
    const convo = (Array.isArray(sm.conversations) ? sm.conversations : []).map((c: any) => {
      const l = learnFor(`${c.topic ?? ""} ${c.text ?? ""}`);
      return `<div class="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">${tag(c.who)}<div class="flex-1"><p class="text-[15.5px] leading-relaxed text-text-primary">${esc(String(c.text ?? ""))}</p>${l ? `<a href="${l[1]}" class="mt-1.5 inline-block text-[13px] text-accent-light hover:text-text-primary">Learn: ${l[2]} →</a>` : ""}</div></div>`;
    }).join("");
    const since = prev ? sinceRows(r.facts ?? {}, prev.facts ?? {}) : "";
    const btn = (k: string, t: string, primary = false) => `<button type="button" data-r="${k}" class="w-full rounded-xl ${primary ? "bg-accent text-canvas" : "border border-white/14 text-text-primary hover:border-white/30"} px-3 py-2.5 text-[13.5px] font-bold">${t}</button>`;
    const shareBtns = ctx!.threads.length
      ? ctx!.threads.map((t) => btn(`share:${t.id}`, r.shared_at ? `↗ Shared · share again with ${esc(t.label)}` : `↗ Share with ${esc(t.label)}`)).join("")
      : `<p class="text-[12.5px] text-text-tertiary">Give access to a coach or clinician to share a read with them.</p>`;
    return `<section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_272px]">
      <article>
        <div class="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent-light">✦ THE GUIDE'S READ · ${esc(long(r.created_at).toUpperCase())}${ctx!.self ? "" : ` · ${esc((ctx!.personName || "").toUpperCase())}`}</div>
        <h2 class="mt-2 text-[34px] leading-tight text-text-primary sm:text-[40px]" style="${serif}">${esc(titleOf(r))}</h2>
        <p class="mt-4 text-[19px] leading-[1.6] text-[#dfe5ee]" style="${serif}">${esc(String(sm.lead ?? ""))}</p>
        ${convo ? `<div class="mt-6 font-mono text-[11px] font-semibold tracking-[0.14em] text-text-tertiary">WORTH A CONVERSATION</div><div class="mt-2.5 flex flex-col gap-2.5">${convo}</div>` : ""}
        ${sm.due ? `<div class="mt-5 font-mono text-[11px] font-semibold tracking-[0.14em] text-text-tertiary">DUE</div><p class="mt-1.5 text-[14.5px] text-text-secondary">${esc(String(sm.due))}</p>` : ""}
        ${sm.notShared ? `<p class="mt-3 text-[13px] text-text-tertiary">${esc(String(sm.notShared))}</p>` : ""}
        <p class="mt-5 text-[12.5px] leading-relaxed text-text-muted">Every number is from this page · wellness information, not a diagnosis${sm.dropped ? ` · ${sm.dropped} sentence${sm.dropped === 1 ? "" : "s"} with a number not on the page ${sm.dropped === 1 ? "was" : "were"} dropped` : ""}.</p>
        ${state === "error" ? `<p class="mt-3 text-[13px] text-danger">${esc(error)}</p>` : ""}
      </article>
      <aside class="flex flex-col gap-3.5">
        <div class="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div class="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-text-tertiary">THIS READ</div>
          <div class="rounded-xl bg-accent/15 px-3 py-2.5 text-center text-[13.5px] font-bold text-text-primary">✓ Filed in your reads</div>
          ${shareBtns}
          ${btn("pdf", "↓ Download PDF")}
          <label class="mt-1 font-mono text-[10.5px] font-semibold tracking-[0.14em] text-text-tertiary">MY NOTE</label>
          <textarea data-r="notebox" rows="3" maxlength="2000" placeholder="What I will do about it…" class="w-full resize-none rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none">${esc(r.note ?? "")}</textarea>
          <span data-r="notemsg" class="text-[12px] text-text-tertiary"></span>
          <span data-r="msg" class="text-[12px] text-text-tertiary"></span>
          <button type="button" data-r="delete" class="mt-1 text-left text-[12px] text-text-muted hover:text-danger">Delete this read</button>
        </div>
        ${since ? `<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div class="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-text-tertiary">SINCE YOUR LAST READ · ${esc(fmtDay(day(prev!.created_at)).toUpperCase())}</div><div class="mt-2 flex flex-col gap-1.5 text-[14px] text-text-primary">${since}</div></div>` : ""}
        <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          ${consentBox()}
          <button type="button" data-r="write" class="mt-2 w-full rounded-xl border border-violet-400/50 px-3 py-2.5 text-[13.5px] font-bold text-accent-light" ${state === "writing" ? "disabled" : ""}>${state === "writing" ? "Writing…" : "✦ Write a new read"}</button>
          <p class="mt-2 text-[12px] leading-relaxed text-text-tertiary">Worth asking for when the numbers change: after a retest, a lab report, or a few weeks.</p></div>
      </aside></section>`;
  }

  function sinceRows(a: any, b: any): string {
    const row = (label: string, now: number | null, then: number | null, unit: string, up = true) => {
      if (now == null && then == null) return "";
      if (now == null || then == null) return `<div>${label} <span class="text-text-tertiary">${now == null ? "no new reading" : `${now}${unit}`}</span></div>`;
      const d = Math.round((now - then) * 10) / 10;
      const tone = d === 0 ? "text-text-tertiary" : (d > 0) === up ? "text-success-light" : "text-danger";
      return `<div>${label} <span class="${tone}">${d === 0 ? "=" : d > 0 ? "↑" : "↓"} ${now}${unit}</span>${d === 0 ? "" : ` <span class="text-text-tertiary">from ${then}</span>`}</div>`;
    };
    const outNow: string[] = a.labsOutside ?? [], outThen: string[] = b.labsOutside ?? [];
    const labs = outNow.length || outThen.length ? `<div>Labs outside <span class="${outNow.length > outThen.length ? "text-danger" : outNow.length < outThen.length ? "text-success-light" : "text-text-tertiary"}">${outNow.length}</span> <span class="text-text-tertiary">from ${outThen.length}</span></div>` : "";
    return [row("MET-hours a week", a.metHoursAWeek, b.metHoursAWeek, ""), row("Workouts a week", a.workoutsAWeek, b.workoutsAWeek, ""),
      row("VO₂max", a.vo2max, b.vo2max, ""), row("Resting HR", a.restingHr, b.restingHr, " bpm", false), labs].filter(Boolean).join("");
  }

  function library() {
    const has = (r: Read, who: string) => (r.summary?.conversations ?? []).some((c: any) => c.who === who);
    const list = reads.filter((r) => filter === "all" || (filter === "doctor" && has(r, "doctor")) || (filter === "coach" && has(r, "coach")) || (filter === "notes" && r.note));
    const chip = (k: string, t: string) => `<button type="button" data-f="${k}" class="rounded-full border px-3 py-1 text-[12.5px] font-semibold ${filter === k ? "border-accent bg-accent/15 text-text-primary" : "border-white/12 text-text-secondary hover:text-text-primary"}">${t}</button>`;
    // what the reads keep saying: the topics that recur
    const counts = new Map<string, { n: number; who: string; text: string }>();
    for (const r of reads) for (const c of r.summary?.conversations ?? []) {
      const k = String(c.topic || "").trim(); if (!k) continue;
      const e = counts.get(k) ?? { n: 0, who: c.who, text: c.text }; e.n++; counts.set(k, e);
    }
    const keep = [...counts.entries()].filter(([, e]) => e.n >= 2).sort((x, y) => y[1].n - x[1].n).slice(0, 4);
    const trend = reads.slice(0, 8).reverse().map((r) => ({ m: new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), v: Number(r.facts?.metHoursAWeek) || 0 }));
    const max = Math.max(1, ...trend.map((t) => t.v));
    const rows = list.map((r) => {
      const tags = [...new Set((r.summary?.conversations ?? []).map((c: any) => String(c.who).toUpperCase()))].join(" · ");
      const meta = [tags, r.shared_at ? "Shared" : "", r.downloaded_at ? "Downloaded" : "", r.note ? "1 note" : ""].filter(Boolean).join(" · ");
      const on = (open ?? reads[0])?.id === r.id;
      return `<div class="grid grid-cols-[22px_112px_minmax(0,1fr)_auto] items-center gap-3 border-t border-white/[0.06] px-4 py-3.5 first:border-t-0">
        <input type="checkbox" data-pick="${r.id}" ${picked.includes(r.id) ? "checked" : ""} class="h-4 w-4 accent-[#818cf8]" aria-label="Pick to compare" />
        <div class="font-mono text-[11px] font-semibold tracking-wider ${on ? "text-accent-light" : "text-text-tertiary"}">${esc(fmtDay(day(r.created_at)).toUpperCase())}</div>
        <button type="button" data-open="${r.id}" class="min-w-0 text-left"><div class="truncate text-[17px] text-text-primary" style="${serif}">${esc(titleOf(r))}</div><div class="mt-0.5 text-[12px] text-text-tertiary">${esc(meta)}</div></button>
        <button type="button" data-open="${r.id}" class="text-[12.5px] text-text-secondary hover:text-text-primary">Open</button></div>`;
    }).join("");
    return `<section>
      <div class="flex flex-wrap items-center gap-2"><h3 class="mr-2 text-[22px] font-extrabold text-text-primary">Your reads</h3>
        ${chip("all", `All · ${reads.length}`)}${chip("doctor", "Doctor items")}${chip("coach", "Coach items")}${chip("notes", "With my notes")}
        <button type="button" data-r="compare" class="ml-auto rounded-xl border border-white/14 px-3.5 py-1.5 text-[13px] font-bold ${picked.length === 2 ? "text-text-primary" : "text-text-muted"}">Compare two reads${picked.length ? ` · ${picked.length} of 2` : ""}</button></div>
      ${comparing && picked.length === 2 ? compare() : ""}
      <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div class="rounded-2xl border border-white/10 bg-white/[0.03]">${rows || `<p class="p-4 text-[13.5px] text-text-tertiary">No reads match.</p>`}</div>
        <div class="flex flex-col gap-4">
          <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div class="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-text-tertiary">WHAT YOUR READS KEEP SAYING</div>
            ${keep.length ? keep.map(([k, e]) => { const l = learnFor(`${k} ${e.text}`); return `<div class="mt-2.5 text-[14px] text-text-primary">${tag(e.who)} <span class="ml-1 capitalize">${esc(k)}</span> <span class="text-text-tertiary">in ${e.n} of ${reads.length} reads</span>${l ? `<a href="${l[1]}" class="block text-[12.5px] text-accent-light">Learn: ${l[2]} →</a>` : ""}</div>`; }).join("")
              : `<p class="mt-2 text-[13px] text-text-tertiary">${reads.length < 2 ? "After two reads, the things they both raise gather here." : "Nothing has come up twice yet."}</p>`}</div>
          ${trend.length >= 2 ? `<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div class="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-text-tertiary">MET-HOURS A WEEK AT EACH READ</div>
            <div class="mt-3 flex h-24 items-end gap-2.5">${trend.map((t, i) => `<div class="flex flex-1 flex-col items-center justify-end gap-1"><span class="font-mono text-[10px] text-text-tertiary">${t.v || ""}</span><div class="w-full rounded-t-[5px] ${i === trend.length - 1 ? "bg-success" : "bg-white/20"}" style="height:${Math.max(4, Math.round((t.v / max) * 70))}px"></div><span class="text-[10.5px] text-text-muted">${esc(t.m)}</span></div>`).join("")}</div></div>` : ""}
        </div></div></section>`;
  }

  function compare() {
    const [a, b] = picked.map((id) => reads.find((r) => r.id === id)!).filter(Boolean).sort((x, y) => x.created_at.localeCompare(y.created_at));
    if (!a || !b) return "";
    const col = (r: Read) => `<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div class="font-mono text-[11px] font-semibold tracking-wider text-accent-light">${esc(fmtDay(day(r.created_at)).toUpperCase())}</div>
      <div class="mt-1 text-[20px] text-text-primary" style="${serif}">${esc(titleOf(r))}</div><p class="mt-2 text-[14.5px] leading-relaxed text-text-secondary" style="${serif}">${esc(String(r.summary?.lead ?? ""))}</p>
      ${(r.summary?.conversations ?? []).map((c: any) => `<div class="mt-2.5 flex items-start gap-2.5 text-[13.5px] text-text-primary">${tag(c.who)}<span>${esc(String(c.text ?? ""))}</span></div>`).join("")}</div>`;
    return `<div class="mt-4 grid gap-4 md:grid-cols-2">${col(a)}${col(b)}</div>
      <div class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div class="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-text-tertiary">WHAT MOVED BETWEEN THEM</div><div class="mt-2 flex flex-col gap-1.5 text-[14px] text-text-primary">${sinceRows(b.facts ?? {}, a.facts ?? {}) || `<span class="text-text-tertiary">These two reads do not carry comparable numbers.</span>`}</div></div>`;
  }

  // ── PDF: the read alone, on a clean page, through the browser's print ──
  function pdf(r: Read) {
    const sm = r.summary ?? {};
    const w = window.open("", "_blank");
    if (!w) return;
    const items = (sm.conversations ?? []).map((c: any) => `<p><b>${c.who === "coach" ? "Coach" : "Doctor"}:</b> ${esc(String(c.text ?? ""))}</p>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>The Guide's read · ${esc(day(r.created_at))}</title>
      <style>body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;max-width:680px;margin:48px auto;padding:0 24px}h1{font-family:Georgia,'Times New Roman',serif;font-weight:500;font-size:32px;margin:6px 0 14px}
      .k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b6b80}.lead{font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.6}p{line-height:1.55}.foot{margin-top:32px;font-size:12px;color:#6b6b80;border-top:1px solid #ddd;padding-top:12px}</style></head>
      <body><div class="k">✦ The Guide's read · ${esc(long(r.created_at))}${ctx!.self ? "" : ` · ${esc(ctx!.personName)}`}</div><h1>${esc(titleOf(r))}</h1>
      <p class="lead">${esc(String(sm.lead ?? ""))}</p>${items ? `<div class="k" style="margin-top:22px">Worth a conversation</div>${items}` : ""}
      ${sm.due ? `<div class="k" style="margin-top:18px">Due</div><p>${esc(String(sm.due))}</p>` : ""}${r.note ? `<div class="k" style="margin-top:18px">My note</div><p>${esc(r.note)}</p>` : ""}
      <div class="foot">Written by Verve from the numbers on the My health page. Wellness information, not a diagnosis. verve-app.health</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    w.document.close();
    void supabase.from("web_reads").update({ downloaded_at: new Date().toISOString() }).eq("id", r.id).then(() => { r.downloaded_at = new Date().toISOString(); });
  }

  async function share(r: Read, grantId: string) {
    const sm = r.summary ?? {};
    const { error: e } = await supabase.from("messages").insert({
      grant_id: grantId, person_id: ctx!.personId, sender_id: ctx!.userId, sender_role: ctx!.self ? "person" : "viewer", sender_label: ctx!.myLabel,
      kind: "read", body: titleOf(r), payload: { read_id: r.id, title: titleOf(r), lead: sm.lead ?? "", conversations: sm.conversations ?? [], due: sm.due ?? "", on: day(r.created_at) },
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
      const box = document.querySelector("[data-r=consent]") as HTMLInputElement | null;
      if (!box?.checked) { state = "error"; error = "Tick the box first: it says what is sent, and what is not."; goTab("read"); drawTab(); return; }
      const { error: e } = await supabase.from("ai_consent").upsert({ user_id: ctx.userId, summary_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (e) { state = "error"; error = `Could not record your consent: ${e.message}`; drawTab(); return; }
      ctx.consented = true;
    }
    state = "writing"; error = ""; goTab("read"); drawTab();
    const { ok, status, out } = await ctx.call({ person_id: ctx.personId, working, force: reads.length > 0 });
    if (status === 402 || out?.error === "pro_required") { state = "premium"; drawTab(); return; }
    if (!ok || !out?.summary) {
      state = "error";
      error = out?.error === "summary_not_open" ? "The Guide's read is not switched on yet." : status === 429 ? "Today's allowance is used up; try tomorrow." : `Could not write it${out?.detail ? `: ${out.detail}` : out?.error ? `: ${out.error}` : ""}.`;
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
    if (k === "full") { open = reads[0] ?? null; goTab("read"); drawTab(); window.scrollTo({ top: 0 }); return; }
    if (k === "write") { await write(); return; }
    if (k === "pdf" && cur) { pdf(cur); return; }
    if (k.startsWith("share:") && cur) { await share(cur, k.slice(6)); return; }
    if (k === "delete" && cur) {
      if (!confirm("Delete this read? It is removed from your reads; a copy you shared into Messages stays there.")) return;
      await supabase.from("web_reads").delete().eq("id", cur.id);
      await loadReads(); open = null; picked = picked.filter((x) => x !== cur.id); draw(); return;
    }
    if (k === "compare") { comparing = picked.length === 2 ? !comparing : false; drawTab(); return; }
    const f = t.closest("[data-f]") as HTMLElement | null;
    if (f) { filter = f.dataset.f!; drawTab(); return; }
    const o = t.closest("[data-open]") as HTMLElement | null;
    if (o) { open = reads.find((x) => x.id === o.dataset.open) ?? null; state = "idle"; drawTab(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const pk = t.closest("[data-pick]") as HTMLInputElement | null;
    if (pk) { const id = pk.dataset.pick!; picked = pk.checked ? [...picked.filter((x) => x !== id), id].slice(-2) : picked.filter((x) => x !== id); if (picked.length < 2) comparing = false; drawTab(); }
  };
  band.addEventListener("click", onClick);
  tab.addEventListener("click", onClick);

  return {
    async load(next: ReadsContext | null) {
      ctx = next; open = null; state = "idle"; error = ""; filter = "all"; picked = []; comparing = false;
      await loadReads();
      draw();
    },
    count: () => reads.length,
    /** the latest read's doctor and coach items, for the client list */
    latest: () => reads[0] ?? null,
  };
}
