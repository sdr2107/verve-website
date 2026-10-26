/**
 * Messages — one dated thread per share, between a person and their coach or clinician (26 Oct 2026).
 * Design: docs/design/care-thread/README.md. Tables and rules: METTracker supabase/migrations/20261026_messages.sql.
 *
 * Either side writes while the share is active; the person reads their threads always. Text, files
 * (PDF or image, up to 15 MB, private bucket "threads"), a pinned plan, the automatic weekly report and
 * new fitness tests (both written by the database, sender "system"). Nothing here goes to an AI.
 *
 * Plain DOM, like the page around it: the page calls load() when the person or the share changes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esc, fmtDay } from "../derive/format";

export type Thread = { id: string; label: string; status: string };
export type MessagesContext = {
  role: "person" | "viewer";
  personId: string;
  personName: string;
  userId: string;
  myLabel: string;
  threads: Thread[];
};

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_BYTES = 15 * 1024 * 1024;
const FILTERS: [string, string][] = [["all", "All"], ["text", "Messages"], ["file", "Files"], ["read", "Reads"], ["report", "Weekly reports"], ["test", "Tests"]];
const METHOD: Record<string, string> = {
  "six-minute-walk": "6-minute walk", "cooper-run": "Cooper 12-minute run", "1.5-mile-run": "1.5-mile run", "one-mile-walk": "1-mile walk",
};
const TIER: Record<string, string> = { low: "Low", belowAverage: "Below average", aboveAverage: "Above average", high: "High", elite: "Elite" };

const day = (iso: string) => String(iso).slice(0, 10);
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmt = (n: unknown) => (n == null ? "—" : Number(n).toLocaleString("en-GB"));

export function mountMessages(root: HTMLElement, supabase: SupabaseClient, onUnread: (n: number) => void) {
  let ctx: MessagesContext | null = null;
  let current: Thread | null = null;
  let rows: any[] = [];
  let plan: any = null;
  let filter = "all";
  let report: { on: boolean; dow: number } | null = null;

  root.innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><h2 class="text-[22px] font-extrabold tracking-[-0.02em] text-text-primary" data-m="title">Messages</h2>
        <p class="mt-1 text-[13.5px] text-text-secondary" data-m="sub"></p></div>
      <div class="flex flex-wrap gap-2" data-m="threads"></div>
    </div>
    <div class="mt-4 hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-m="report"></div>
    <div class="mt-3 hidden" data-m="plan"></div>
    <div class="mt-4 flex flex-wrap items-center gap-2" data-m="filters"></div>
    <div class="mt-3 flex flex-col gap-2.5" data-m="list"></div>
    <p class="mt-3 font-mono text-[10.5px] tracking-wider text-text-muted">NOT FOR EMERGENCIES · MESSAGES MAY NOT BE READ QUICKLY. FOR SYMPTOMS, CALL YOUR DOCTOR OR EMERGENCY SERVICES.</p>
    <div class="mt-3 rounded-2xl border border-white/12 bg-white/[0.04] p-3" data-m="composer">
      <textarea rows="2" maxlength="4000" data-m="text" placeholder="Write a message…"
        class="w-full resize-none bg-transparent px-1 text-[14.5px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none"></textarea>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <label class="cursor-pointer text-[13px] font-semibold text-text-secondary hover:text-text-primary">
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" data-m="file" />📎 Attach a PDF</label>
        <span class="text-[12px] text-text-tertiary" data-m="filename"></span>
        <button type="button" class="text-[13px] font-semibold text-text-secondary hover:text-text-primary" data-m="pinopen">📌 Pin a plan</button>
        <span class="ml-auto text-[12px] text-text-tertiary" data-m="msg"></span>
        <button type="button" data-m="send" class="min-h-9 rounded-xl bg-accent px-4 py-1.5 text-sm font-bold text-canvas transition-opacity hover:opacity-90">Send</button>
      </div>
      <form class="mt-3 hidden flex-wrap items-end gap-3 border-t border-white/10 pt-3" data-m="pinform">
        <label class="flex flex-col gap-1 text-[12px] text-text-secondary">Plan name<input data-m="pname" maxlength="120" required placeholder="Base to 1,000"
          class="w-56 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[14px] text-text-primary" /></label>
        <label class="flex flex-col gap-1 text-[12px] text-text-secondary">Starts<input type="date" data-m="pstart" required
          class="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[14px] text-text-primary" /></label>
        <label class="flex flex-col gap-1 text-[12px] text-text-secondary">Weeks<input type="number" min="1" max="52" value="8" data-m="pweeks" required
          class="w-20 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[14px] text-text-primary" /></label>
        <button type="submit" class="min-h-9 rounded-xl border border-accent/50 px-4 py-1.5 text-sm font-bold text-accent-light">Pin it</button>
        <span class="basis-full text-[12px] text-text-tertiary">An attached PDF is pinned with the plan. The thread shows the week of the plan, and the weekly report says it.</span>
      </form>
    </div>
    <div class="mt-3 flex gap-4 text-[12px] font-medium text-text-tertiary">
      <button type="button" class="hover:text-text-primary" data-m="csv">Export thread (CSV)</button>
      <button type="button" class="hover:text-text-primary" data-m="txt">Export thread (text)</button>
    </div>`;

  const $m = (k: string) => root.querySelector(`[data-m="${k}"]`) as HTMLElement;
  const say = (t: string) => { $m("msg").textContent = t; };

  // ── drawing ──────────────────────────────────────────────────────────
  function bubble(m: any): string {
    const mine = m.sender_role === ctx!.role;
    const who = m.sender_role === "system" ? "VERVE" : mine ? "YOU" : esc((m.sender_label || (m.sender_role === "person" ? ctx!.personName : "Coach or clinician")).toUpperCase());
    const meta = `<div class="mt-1.5 font-mono text-[10.5px] tracking-wider text-text-muted">${who} · ${time(m.created_at)}${mine && m.read_at ? " · READ" : ""}</div>`;
    if (m.kind === "report") return reportCard(m);
    if (m.kind === "read") {
      const p = m.payload ?? {};
      const items = (p.conversations ?? []).map((c: any) => `<div class="mt-2 flex items-start gap-2 text-[13.5px] text-text-primary"><span class="rounded-full ${c.who === "coach" ? "bg-success/15 text-success-light" : "bg-danger/15 text-danger"} px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider">${c.who === "coach" ? "COACH" : "DOCTOR"}</span><span>${esc(String(c.text ?? ""))}</span></div>`).join("");
      return `<div class="${mine ? "ml-auto" : ""} w-full max-w-xl rounded-2xl border border-violet-400/45 p-4" style="background:linear-gradient(160deg,rgba(129,140,248,.12),rgba(255,255,255,.02))">
        <div class="font-mono text-[10.5px] font-semibold tracking-wider text-accent-light">✦ THE GUIDE'S READ · ${esc(day(p.on ?? m.created_at))}</div>
        <div class="mt-1 text-[18px] text-text-primary" style="font-family:'Newsreader',Georgia,serif">${esc(String(p.title ?? m.body ?? ""))}</div>
        <p class="mt-1.5 text-[14px] leading-relaxed text-text-secondary">${esc(String(p.lead ?? ""))}</p>${items}${p.due ? `<p class="mt-2 text-[12.5px] text-text-tertiary">Due: ${esc(String(p.due))}</p>` : ""}${meta}</div>`;
    }
    if (m.kind === "test") {
      const p = m.payload ?? {};
      return `<div class="mx-auto w-full max-w-xl rounded-2xl border border-orange-400/40 bg-orange-400/[0.06] p-4">
        <div class="font-mono text-[10.5px] font-semibold tracking-wider text-orange-300">FITNESS TEST · ${esc(day(p.on ?? m.created_at))}</div>
        <p class="mt-1 text-[15px] text-text-primary"><b>${esc(METHOD[p.method] ?? "Fitness test")}</b>: ${esc(String(Math.round(Number(p.mets) * 10) / 10))} METs · ${esc(TIER[p.tier] ?? p.tier ?? "")}</p></div>`;
    }
    const file = m.file_path ? `<button type="button" data-file="${esc(m.file_path)}" class="mt-2 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left hover:border-white/25">
        <span class="text-xl">📄</span><span><span class="block text-[14px] font-semibold text-text-primary">${esc(m.file_name ?? "file")}</span><span class="text-[12px] text-text-tertiary">${m.file_size ? kb(m.file_size) : ""} · open</span></span></button>` : "";
    const planTag = m.kind === "plan" ? `<div class="font-mono text-[10.5px] font-semibold tracking-wider text-orange-300">📌 PLAN PINNED</div>` : "";
    return `<div class="max-w-[78%] ${mine ? "ml-auto border-accent/40 bg-accent/[0.12]" : "border-white/10 bg-white/[0.045]"} rounded-2xl border px-4 py-3">
      ${planTag}${m.body ? `<p class="whitespace-pre-line text-[14.5px] leading-relaxed text-text-primary">${esc(m.body)}</p>` : ""}${file}${meta}</div>`;
  }

  function reportCard(m: any): string {
    const p = m.payload ?? {};
    const cell = (v: string, l: string, tone = "text-text-primary") =>
      `<div><div class="font-mono text-[22px] font-bold ${tone}">${v}</div><div class="text-[12px] text-text-tertiary">${l}</div></div>`;
    const cells: string[] = [];
    if (p.dose != null) cells.push(cell(fmt(p.dose), `MET-min · goal ${fmt(p.goal ?? 500)}`, Number(p.dose) >= Number(p.goal ?? 500) ? "text-success" : "text-text-primary"));
    if (p.mvpa_min != null) cells.push(cell(fmt(p.mvpa_min), "min moderate–vigorous"));
    if (p.strength_days != null) cells.push(cell(fmt(p.strength_days), "strength days"));
    if (p.steps != null) cells.push(cell(fmt(p.steps), "steps a day"));
    if (p.resting_hr != null) cells.push(cell(fmt(p.resting_hr), "resting heart rate"));
    const tests = (p.tests ?? []).map((t: any) => `${METHOD[t.method] ?? "test"} ${Math.round(Number(t.mets) * 10) / 10} METs`).join(", ");
    const plan = p.plan ? `Week ${p.plan_week} of ${p.plan_weeks} · plan “${esc(p.plan)}”` : "";
    return `<div class="mx-auto w-full max-w-2xl rounded-2xl border border-success/45 bg-success/[0.06] p-4">
      <div class="font-mono text-[10.5px] font-semibold tracking-wider text-success">WEEKLY REPORT · SENT AUTOMATICALLY · ${esc(fmtDay(day(p.week_start)).toUpperCase())} TO ${esc(fmtDay(day(p.week_end)).toUpperCase())}</div>
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">${cells.join("")}</div>
      ${plan || tests ? `<p class="mt-3 text-[13px] text-text-secondary">${[plan, tests ? `Tests: ${esc(tests)}` : ""].filter(Boolean).join(" · ")}</p>` : ""}
      <p class="mt-1 text-[12px] text-text-tertiary">Only what the share allows. Counted the way the app counts it.</p></div>`;
  }

  function draw() {
    const shown = rows.filter((m) => filter === "all" || m.kind === filter || (filter === "text" && m.kind === "plan"));
    let last = "", html = "";
    for (const m of shown) {
      const d = day(m.created_at);
      if (d !== last) { html += `<div class="my-2 text-center"><span class="rounded-full bg-white/[0.05] px-3 py-1 font-mono text-[10.5px] tracking-wider text-text-tertiary">${esc(fmtDay(d).toUpperCase())}</span></div>`; last = d; }
      html += bubble(m);
    }
    $m("list").innerHTML = html || `<p class="text-[13.5px] text-text-tertiary">Nothing here yet. ${ctx!.role === "viewer" ? `Write to ${esc(ctx!.personName.split(" ")[0] || "them")}, or pin their plan.` : "Write to your coach or clinician, or attach a file."}</p>`;
    $m("filters").innerHTML = FILTERS.map(([k, l]) =>
      `<button type="button" data-filter="${k}" class="rounded-full border px-3 py-1 text-[12.5px] font-semibold ${k === filter ? "border-accent bg-accent/15 text-text-primary" : "border-white/12 text-text-secondary hover:text-text-primary"}">${l}</button>`).join("");
    drawPlan();
    drawReport();
    const open = current?.status === "active";
    $m("composer").classList.toggle("opacity-50", !open);
    ($m("send") as HTMLButtonElement).disabled = !open;
    if (!open) say("This share has stopped: the thread is kept, and no one can write to it.");
  }

  function drawPlan() {
    const el = $m("plan");
    if (!plan) { el.classList.add("hidden"); return; }
    const start = new Date(plan.starts_on + "T00:00:00"), end = new Date(plan.ends_on + "T00:00:00"), now = new Date();
    const weeks = Math.floor((end.getTime() - start.getTime()) / 6.048e8) + 1;   // 8 weeks = start + 55 days
    const wk = Math.min(weeks, Math.max(1, Math.floor((now.getTime() - start.getTime()) / 6.048e8) + 1));
    const done = now > end;
    el.classList.remove("hidden");
    el.innerHTML = `<div class="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-400/45 bg-orange-400/[0.05] px-4 py-3">
      <span class="text-lg">📌</span><div class="flex-1"><div class="font-mono text-[10.5px] font-semibold tracking-wider text-orange-300">${done ? "LAST PLAN · ENDED" : "CURRENT PLAN"}</div>
      <div class="text-[15px] font-bold text-text-primary">${esc(plan.name)} · ${weeks} weeks · ${esc(fmtDay(plan.starts_on))} → ${esc(fmtDay(plan.ends_on))}</div></div>
      <span class="text-[13px] text-text-secondary">${done ? "ended" : `Week ${wk} of ${weeks}`}</span>
      ${plan.file_path ? `<button type="button" data-file="${esc(plan.file_path)}" class="rounded-full border border-white/15 px-3 py-1 text-[12.5px] text-text-secondary hover:text-text-primary">${esc(plan.file_name ?? "plan.pdf")}</button>` : ""}</div>`;
  }

  function drawReport() {
    const el = $m("report");
    if (ctx!.role !== "person" || !report || !current) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    el.innerHTML = `<div class="flex flex-wrap items-center gap-3 text-[14px] text-text-primary">
      <label class="flex items-center gap-2"><input type="checkbox" data-r="on" ${report.on ? "checked" : ""} class="h-4 w-4 accent-[#6366f1]" />
        Send ${esc(current.label)} a weekly report every</label>
      <select data-r="dow" class="rounded-lg border border-white/12 bg-canvas px-2 py-1 text-[14px]">${DOW.map((d, i) => `<option value="${i}" ${i === report!.dow ? "selected" : ""}>${d}</option>`).join("")}</select>
      <span data-r="msg" class="text-[12px] text-text-tertiary"></span></div>
      <p class="mt-1.5 text-[12.5px] text-text-tertiary">Last week's dose against your goal, moderate–vigorous minutes, strength days, steps, resting heart rate and any new test: only what this share allows. No AI writes it. Turn it off any time.</p>`;
    const save = async () => {
      const on = (el.querySelector('[data-r="on"]') as HTMLInputElement).checked;
      const dow = Number((el.querySelector('[data-r="dow"]') as HTMLSelectElement).value);
      const { error } = await supabase.rpc("set_weekly_report", { g: current!.id, on_: on, dow });
      (el.querySelector('[data-r="msg"]') as HTMLElement).textContent = error ? `Not saved: ${error.message}` : on ? `Saved. The next one goes on ${DOW[dow]}.` : "Saved. No weekly report.";
      if (!error) report = { on, dow };
    };
    el.querySelector('[data-r="on"]')!.addEventListener("change", save);
    el.querySelector('[data-r="dow"]')!.addEventListener("change", save);
  }

  function drawThreads() {
    const t = ctx!.threads;
    $m("threads").innerHTML = t.length > 1 ? t.map((x) =>
      `<button type="button" data-thread="${x.id}" class="rounded-full border px-3 py-1 text-[12.5px] font-semibold ${x.id === current?.id ? "border-accent bg-accent/15 text-text-primary" : "border-white/12 text-text-secondary"}">${esc(x.label)}${x.status !== "active" ? " · stopped" : ""}</button>`).join("") : "";
    $m("sub").textContent = !current ? (ctx!.role === "person" ? "Share your page with a coach or clinician (Give access) to start a thread." : "")
      : ctx!.role === "viewer" ? `Between you and ${ctx!.personName}. Everything is dated and kept on their page.`
      : `Between you and ${current.label}. Everything is dated, and it stays yours if you stop sharing.`;
  }

  // ── loading ──────────────────────────────────────────────────────────
  async function loadThread() {
    rows = []; plan = null; report = null; say("");
    if (!current) { drawThreads(); $m("list").innerHTML = ""; $m("plan").classList.add("hidden"); $m("report").classList.add("hidden"); return; }
    const id = current.id;
    const [m, p, g] = await Promise.all([
      supabase.from("messages").select("*").eq("grant_id", id).order("created_at", { ascending: true }).limit(500),
      supabase.from("plans").select("*").eq("grant_id", id).order("starts_on", { ascending: false }).limit(1),
      ctx!.role === "person" ? supabase.from("grants").select("weekly_report, report_dow").eq("id", id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (current?.id !== id) return;
    rows = m.data ?? []; plan = p.data?.[0] ?? null;
    report = g.data ? { on: !!(g.data as any).weekly_report, dow: Number((g.data as any).report_dow ?? 1) } : null;
    drawThreads(); draw();
    const unread = rows.filter((x) => x.sender_role !== ctx!.role && !x.read_at).map((x) => x.id);
    if (unread.length && !root.closest(".hidden")) await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread);
    void countUnread();
  }

  async function countUnread() {
    if (!ctx || !ctx.threads.length) { onUnread(0); return; }
    const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
      .in("grant_id", ctx.threads.map((t) => t.id)).neq("sender_role", ctx.role).is("read_at", null);
    onUnread(count ?? 0);
  }

  async function upload(file: File): Promise<{ path: string; name: string; size: number } | null> {
    if (file.size > MAX_BYTES) { say("That file is over 15 MB."); return null; }
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80);
    const path = `${current!.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from("threads").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { say(`Not uploaded: ${error.message}`); return null; }
    return { path, name: file.name, size: file.size };
  }

  // ── actions ──────────────────────────────────────────────────────────
  root.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;
    const f = t.closest("[data-filter]") as HTMLElement | null;
    if (f) { filter = f.dataset.filter!; draw(); return; }
    const th = t.closest("[data-thread]") as HTMLElement | null;
    if (th && ctx) { current = ctx.threads.find((x) => x.id === th.dataset.thread) ?? current; await loadThread(); return; }
    const fl = t.closest("[data-file]") as HTMLElement | null;
    if (fl) {
      const { data, error } = await supabase.storage.from("threads").createSignedUrl(fl.dataset.file!, 120);
      if (error || !data) { say(`Could not open: ${error?.message ?? "no link"}`); return; }
      window.open(data.signedUrl, "_blank", "noopener");
    }
  });
  ($m("file") as HTMLInputElement).addEventListener("change", () => {
    const file = ($m("file") as HTMLInputElement).files?.[0];
    $m("filename").textContent = file ? `${file.name} · ${kb(file.size)}` : "";
  });
  $m("pinopen").addEventListener("click", () => {
    const form = $m("pinform");
    form.classList.toggle("hidden"); form.classList.toggle("flex");
    if (!($m("pstart") as HTMLInputElement).value) ($m("pstart") as HTMLInputElement).value = new Date().toISOString().slice(0, 10);
  });
  $m("send").addEventListener("click", async () => {
    if (!ctx || !current) return;
    const body = ($m("text") as HTMLTextAreaElement).value.trim();
    const file = ($m("file") as HTMLInputElement).files?.[0];
    if (!body && !file) return;
    const btn = $m("send") as HTMLButtonElement; btn.disabled = true; say(file ? "Uploading…" : "");
    const up = file ? await upload(file) : null;
    if (file && !up) { btn.disabled = false; return; }
    const { error } = await supabase.from("messages").insert({
      grant_id: current.id, person_id: ctx.personId, sender_id: ctx.userId, sender_role: ctx.role, sender_label: ctx.myLabel,
      kind: up ? "file" : "text", body, file_path: up?.path ?? null, file_name: up?.name ?? null, file_size: up?.size ?? null,
    });
    btn.disabled = false;
    if (error) { say(`Not sent: ${error.message}`); return; }
    ($m("text") as HTMLTextAreaElement).value = ""; ($m("file") as HTMLInputElement).value = ""; $m("filename").textContent = "";
    say("Sent.");
    await loadThread();
  });
  $m("pinform").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ctx || !current) return;
    const name = ($m("pname") as HTMLInputElement).value.trim();
    const start = ($m("pstart") as HTMLInputElement).value;
    const weeks = Math.max(1, Number(($m("pweeks") as HTMLInputElement).value) || 8);
    const end = new Date(start + "T00:00:00"); end.setDate(end.getDate() + weeks * 7 - 1);
    const ends = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;   // local, not UTC
    const pinBtn = $m("pinform").querySelector("button[type=submit]") as HTMLButtonElement;
    if (pinBtn.disabled) return;
    pinBtn.disabled = true;
    const file = ($m("file") as HTMLInputElement).files?.[0];
    const up = file ? await upload(file) : null;
    if (file && !up) { pinBtn.disabled = false; return; }
    const { error } = await supabase.from("plans").insert({
      grant_id: current.id, person_id: ctx.personId, name, starts_on: start, ends_on: ends,
      file_path: up?.path ?? null, file_name: up?.name ?? null, created_by: ctx.userId,
    });
    if (error) { pinBtn.disabled = false; say(`Not pinned: ${error.message}`); return; }
    await supabase.from("messages").insert({
      grant_id: current.id, person_id: ctx.personId, sender_id: ctx.userId, sender_role: ctx.role, sender_label: ctx.myLabel, kind: "plan",
      body: `${name}: ${weeks} weeks from ${fmtDay(start)}.`, file_path: up?.path ?? null, file_name: up?.name ?? null, file_size: up?.size ?? null,
    });
    ($m("file") as HTMLInputElement).value = ""; $m("filename").textContent = "";
    $m("pinform").classList.add("hidden"); $m("pinform").classList.remove("flex");
    pinBtn.disabled = false;
    await loadThread();
  });
  const exportAs = (kind: "csv" | "txt") => {
    if (!current) return;
    const who = (m: any) => (m.sender_role === "system" ? "Verve" : m.sender_role === ctx!.role ? "You" : m.sender_label || m.sender_role);
    const text = kind === "csv"
      ? ["date,time,from,kind,message,file", ...rows.map((m) => [day(m.created_at), time(m.created_at), who(m), m.kind, m.kind === "report" ? JSON.stringify(m.payload) : m.body, m.file_name ?? ""]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n")
      : [`Verve messages · ${ctx!.personName} and ${current.label} · exported ${new Date().toISOString().slice(0, 10)}`, "",
         ...rows.map((m) => `${day(m.created_at)} ${time(m.created_at)} · ${who(m)} · ${m.kind}\n${m.kind === "report" ? JSON.stringify(m.payload) : m.body}${m.file_name ? `\n[file: ${m.file_name}]` : ""}\n`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: kind === "csv" ? "text/csv" : "text/plain" }));
    a.download = `verve-messages-${new Date().toISOString().slice(0, 10)}.${kind}`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  $m("csv").addEventListener("click", () => exportAs("csv"));
  $m("txt").addEventListener("click", () => exportAs("txt"));

  return {
    /** A person or a share changed: the threads this page has, and whose side we are on. */
    async load(next: MessagesContext) {
      ctx = next;
      current = next.threads.find((t) => t.status === "active") ?? next.threads[0] ?? null;
      filter = "all";
      await loadThread();
    },
    /** The tab came into view: mark what is now read. */
    refresh: () => loadThread(),
    countUnread,
  };
}
