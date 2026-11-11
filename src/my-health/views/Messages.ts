/**
 * Messages, thread-first (canvas "My health, redesigned", board 7; the thread
 * itself since 26 Oct 2026, docs/design/care-thread/README.md). One dated
 * thread per share, between a person and their coach or clinician.
 *
 *   header     who the thread is with, what they can see, one ⋯ menu that
 *              holds the weekly report switch, the plan, the exports and the
 *              way to Access
 *   the plan   one collapsed line; Show opens it
 *   the thread day separators; system rows as single lines (the weekly
 *              report, a new test, a pinned plan); the coach's words left,
 *              yours right; "new" on what you have not read
 *   composer   Reply, Attach, Send, at the bottom
 *
 * Tables and rules: METTracker supabase/migrations/20261026_messages.sql.
 * Either side writes while the share is active; the person reads their
 * threads always. Nothing here goes to an AI. Plain DOM, like the page.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { esc, fmtDay } from "../derive/format";
import { dueLineOf } from "../derive/reads";
import { actions } from "../state.ts";

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
const METHOD: Record<string, string> = { "six-minute-walk": "6-minute walk", "cooper-run": "Cooper 12-minute run", "1.5-mile-run": "1.5-mile run", "one-mile-walk": "1-mile walk" };
const TIER: Record<string, string> = { low: "Low", belowAverage: "Below average", aboveAverage: "Above average", high: "High", elite: "Elite" };

const day = (iso: string) => String(iso).slice(0, 10);
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmt = (n: unknown) => (n == null ? "—" : Number(n).toLocaleString("en-GB"));
const longDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const ICON = {
  more: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  clip: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.5 12.3 21a5.5 5.5 0 0 1-7.8-7.8L13.6 4a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6L15.5 7.5"/></svg>`,
  file: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>`,
};

export function mountMessages(root: HTMLElement, supabase: SupabaseClient, onUnread: (n: number) => void) {
  let ctx: MessagesContext | null = null;
  let current: Thread | null = null;
  let rows: any[] = [];
  let plan: any = null;
  let report: { on: boolean; dow: number } | null = null;
  let menuOpen = false, planOpen = false, pinOpen = false;
  const openReports = new Set<string>();

  root.innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="t-eyebrow" data-m="eyebrow">Messages</div>
        <h2 class="t-heading mt-1.5 text-text" data-m="title">With your coach</h2>
        <p class="t-small mt-1 text-text-3" data-m="sub"></p>
        <div class="mt-2 flex flex-wrap gap-2" data-m="threads"></div>
      </div>
      <div class="relative" data-m="menuwrap">
        <button type="button" data-m="menu" aria-haspopup="menu" aria-expanded="false" aria-label="More" class="r-btn flex h-10 w-10 items-center justify-center border border-border text-text-2 transition-colors hover:border-border-strong hover:text-text">${ICON.more}</button>
        <div data-m="menupanel" role="menu" class="r-card absolute right-0 top-full z-30 mt-2 hidden w-72 max-w-[calc(100vw-2rem)] flex-col border border-border-strong bg-card p-1.5 shadow-2xl shadow-shade"></div>
      </div>
    </div>
    <div class="mt-4 hidden" data-m="plan"></div>
    <div class="mt-4 hidden" data-m="pinform"></div>
    <div class="mt-4 flex flex-col gap-2.5" data-m="list"></div>
    <div class="mt-4 r-card border border-border bg-card p-3" data-m="composer">
      <textarea rows="2" maxlength="4000" data-m="text" placeholder="Reply…" class="t-body w-full resize-none bg-transparent px-1 text-text placeholder:text-text-4 focus:outline-none"></textarea>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <label class="t-small flex cursor-pointer items-center gap-1.5 font-semibold text-text-2 hover:text-text">${ICON.clip}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" class="hidden" data-m="file" />Attach</label>
        <span class="t-caption text-text-3" data-m="filename"></span>
        <span class="t-caption ml-auto text-text-3" data-m="msg"></span>
        <button type="button" data-m="send" class="r-btn min-h-9 bg-accent px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50">Send</button>
      </div>
    </div>
    <p class="t-caption mt-3 text-text-4">Not for emergencies: messages may not be read quickly. For symptoms, call your doctor or emergency services.</p>`;

  const $m = (k: string) => root.querySelector(`[data-m="${k}"]`) as HTMLElement;
  const say = (t: string) => { $m("msg").textContent = t; };
  const mine = (m: any) => m.sender_role === ctx!.role;

  // ── drawing ──────────────────────────────────────────────────────────
  const metaLine = (m: any, isNew: boolean) => `<div class="t-caption mt-1.5 text-text-3">${m.sender_role === "system" ? "Verve" : mine(m) ? "You" : esc(m.sender_label || (m.sender_role === "person" ? ctx!.personName : "Coach"))} · ${time(m.created_at)}${mine(m) && m.read_at ? " · read" : ""}${isNew ? ` · <span class="text-accent-text">new</span>` : ""}</div>`;
  const systemLine = (text: string, action = "") => `<div class="flex flex-wrap items-baseline gap-x-2 py-1 pl-1"><span class="t-caption text-text-3">${text}</span>${action}</div>`;

  function reportDetails(m: any): string {
    const p = m.payload ?? {};
    const cells: [string, string][] = [];
    if (p.dose != null) cells.push([fmt(p.dose), `MET-min · goal ${fmt(p.goal ?? 500)}`]);
    if (p.mvpa_min != null) cells.push([fmt(p.mvpa_min), "min moderate to vigorous"]);
    if (p.strength_days != null) cells.push([fmt(p.strength_days), "strength days"]);
    if (p.steps != null) cells.push([fmt(p.steps), "steps a day"]);
    if (p.resting_hr != null) cells.push([fmt(p.resting_hr), "resting heart rate"]);
    const tests = (p.tests ?? []).map((t: any) => `${METHOD[t.method] ?? "test"} ${Math.round(Number(t.mets) * 10) / 10} METs`).join(", ");
    const pl = p.plan ? `Week ${p.plan_week} of ${p.plan_weeks} · plan “${esc(p.plan)}”` : "";
    return `<div class="r-card mt-1 border border-border bg-alt p-3"><div class="grid grid-cols-2 gap-3 sm:grid-cols-5">${cells.map(([v, l]) => `<div><div class="t-figure-row text-[18px] text-text">${v}</div><div class="t-caption text-text-3">${l}</div></div>`).join("")}</div>${pl || tests ? `<p class="t-caption mt-2 text-text-2">${[pl, tests ? `Tests: ${esc(tests)}` : ""].filter(Boolean).join(" · ")}</p>` : ""}<p class="t-caption mt-1 text-text-3">Only what the share allows. Counted the way the app counts it.</p></div>`;
  }

  function bubble(m: any, isNew: boolean): string {
    if (m.kind === "report") {
      const p = m.payload ?? {}, open = openReports.has(m.id);
      return systemLine(`Weekly report sent to ${esc(ctx!.role === "person" ? (current?.label || "your coach") : "you")} · ${esc(fmtDay(day(p.week_start)))} to ${esc(fmtDay(day(p.week_end)))}`, `<button type="button" data-report="${esc(m.id)}" class="t-caption font-semibold text-accent-text hover:text-text">${open ? "Hide" : "View"}</button>`) + (open ? reportDetails(m) : "");
    }
    if (m.kind === "test") {
      const p = m.payload ?? {};
      return systemLine(`New fitness test · ${esc(METHOD[p.method] ?? "Fitness test")} ${esc(String(Math.round(Number(p.mets) * 10) / 10))} METs · ${esc(TIER[p.tier] ?? p.tier ?? "")}`, `<button type="button" data-goto-tab="overview" class="t-caption font-semibold text-accent-text hover:text-text">Fitness</button>`);
    }
    if (m.kind === "read") {
      const p = m.payload ?? {};
      const items = (p.conversations ?? []).map((c: any) => `<p class="t-small mt-1.5 text-text-2"><span class="t-eyebrow mr-1.5 text-text-3">${c.who === "coach" ? "coach" : "doctor"}</span>${esc(String(c.text ?? ""))}</p>`).join("");
      return `<div class="${mine(m) ? "ml-auto" : ""} r-card w-full max-w-xl border border-accent-border bg-card p-4">
        <div class="t-eyebrow text-accent-text">The Guide · ${esc(fmtDay(day(p.on ?? m.created_at)))}</div>
        <div class="t-title mt-1 text-text">${esc(String(p.title ?? m.body ?? ""))}</div>
        <p class="t-small mt-1.5 text-text-2">${esc(String(p.lead ?? ""))}</p>${items}${dueLineOf(p.due, p.on ?? m.created_at) ? `<p class="t-caption mt-2 text-text-3">Due: ${esc(dueLineOf(p.due, p.on ?? m.created_at))}</p>` : ""}${metaLine(m, isNew)}</div>`;
    }
    const file = m.file_path ? `<button type="button" data-file="${esc(m.file_path)}" class="r-btn mt-2 flex w-full items-center gap-2.5 border border-border bg-alt px-3 py-2 text-left hover:border-border-strong"><span class="text-text-3">${ICON.file}</span><span class="min-w-0"><span class="t-small block truncate font-semibold text-text">${esc(m.file_name ?? "file")}</span><span class="t-caption text-text-3">${m.file_size ? kb(m.file_size) : ""} · open</span></span></button>` : "";
    if (m.kind === "plan") return systemLine(`Plan pinned · ${esc(m.body ?? "")}`, m.file_path ? `<button type="button" data-file="${esc(m.file_path)}" class="t-caption font-semibold text-accent-text hover:text-text">${esc(m.file_name ?? "plan.pdf")}</button>` : "");
    return `<div class="r-card max-w-[78%] border px-4 py-3 ${mine(m) ? "ml-auto border-accent-border bg-accent-fill" : "border-border bg-alt"}">
      ${m.body ? `<p class="t-body whitespace-pre-line text-text">${esc(m.body)}</p>` : ""}${file}${metaLine(m, isNew)}</div>`;
  }

  function draw() {
    let last = "", html = "";
    const unreadOther = rows.filter((m) => m.sender_role !== ctx!.role && m.sender_role !== "system" && !m.read_at).map((m) => m.id);
    for (const m of rows) {
      const d = day(m.created_at);
      if (d !== last) { html += `<div class="my-2 flex items-center gap-3"><span class="h-px flex-1 bg-border"></span><span class="t-eyebrow">${esc(longDay(d))}</span><span class="h-px flex-1 bg-border"></span></div>`; last = d; }
      html += bubble(m, unreadOther.includes(m.id));
    }
    $m("list").innerHTML = html || `<p class="t-small text-text-3">Nothing here yet. ${ctx!.role === "viewer" ? `Write to ${esc(ctx!.personName.split(" ")[0] || "them")}, or pin their plan from the menu.` : "Write to your coach or clinician, or attach a file."}</p>`;
    drawPlan(); drawMenu();
    const open = current?.status === "active";
    $m("composer").classList.toggle("opacity-50", !open);
    ($m("send") as HTMLButtonElement).disabled = !open;
    if (!open && current) say("This share has stopped: the thread is kept, and no one can write to it.");
  }

  function planWeeks() {
    if (!plan) return null;
    const start = new Date(plan.starts_on + "T00:00:00"), end = new Date(plan.ends_on + "T00:00:00"), now = new Date();
    const weeks = Math.floor((end.getTime() - start.getTime()) / 6.048e8) + 1;
    const wk = Math.min(weeks, Math.max(1, Math.floor((now.getTime() - start.getTime()) / 6.048e8) + 1));
    return { weeks, wk, done: now > end };
  }
  function drawPlan() {
    const el = $m("plan");
    if (!plan) { el.classList.add("hidden"); return; }
    const w = planWeeks()!;
    el.classList.remove("hidden");
    el.innerHTML = `<div class="r-card border border-border bg-card px-4 py-3">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span class="t-eyebrow">The plan</span><span class="t-small min-w-0 flex-1 truncate text-text">${esc(plan.name)}${w.done ? " · ended" : ` · week ${w.wk} of ${w.weeks}`}</span><button type="button" data-plan-toggle class="t-caption font-semibold text-accent-text hover:text-text">${planOpen ? "Hide" : "Show"}</button></div>
      ${planOpen ? `<div class="t-small mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-text-2"><span>${w.weeks} weeks · ${esc(fmtDay(plan.starts_on))} to ${esc(fmtDay(plan.ends_on))}</span>${plan.file_path ? `<button type="button" data-file="${esc(plan.file_path)}" class="font-semibold text-accent-text hover:text-text">${esc(plan.file_name ?? "plan.pdf")}</button>` : ""}<span class="t-caption text-text-3">The thread shows the week of the plan, and the weekly report says it.</span></div>` : ""}</div>`;
  }
  function drawPinForm() {
    const el = $m("pinform");
    el.classList.toggle("hidden", !pinOpen);
    if (!pinOpen) { el.innerHTML = ""; return; }
    el.innerHTML = `<form class="r-card flex flex-wrap items-end gap-3 border border-border bg-card p-4" data-m="pin">
      <div class="basis-full"><div class="t-eyebrow">Pin a plan</div><p class="t-caption mt-1 text-text-3">An attached PDF is pinned with the plan. The thread shows the week of the plan, and the weekly report says it.</p></div>
      <label class="t-caption flex flex-col gap-1 text-text-2">Plan name<input data-m="pname" maxlength="120" required placeholder="Base to 1,000" class="r-btn w-56 border border-border bg-alt px-3 py-1.5 text-[14px] text-text focus:border-accent-border focus:outline-none" /></label>
      <label class="t-caption flex flex-col gap-1 text-text-2">Starts<input type="date" data-m="pstart" required class="r-btn border border-border bg-alt px-3 py-1.5 text-[14px] text-text focus:border-accent-border focus:outline-none" /></label>
      <label class="t-caption flex flex-col gap-1 text-text-2">Weeks<input type="number" min="1" max="52" value="8" data-m="pweeks" required class="r-btn w-20 border border-border bg-alt px-3 py-1.5 text-[14px] text-text focus:border-accent-border focus:outline-none" /></label>
      <button type="submit" class="r-btn min-h-9 border border-accent-border px-4 text-[13px] font-semibold text-accent-text">Pin it</button>
      <button type="button" data-pin-cancel class="min-h-9 px-2 text-[13px] font-semibold text-text-3 hover:text-text">Cancel</button></form>`;
    if (!($m("pstart") as HTMLInputElement).value) ($m("pstart") as HTMLInputElement).value = new Date().toISOString().slice(0, 10);
    $m("pin").addEventListener("submit", pinSubmit);
  }
  function drawMenu() {
    const panel = $m("menupanel");
    panel.classList.toggle("hidden", !menuOpen); panel.classList.toggle("flex", menuOpen);
    $m("menu").setAttribute("aria-expanded", menuOpen ? "true" : "false");
    if (!menuOpen) return;
    const item = (k: string, label: string, sub = "") => `<button type="button" role="menuitem" data-menu="${k}" class="r-btn flex w-full flex-col items-start px-3 py-2 text-left hover:bg-alt"><span class="t-small font-semibold text-text">${label}</span>${sub ? `<span class="t-caption text-text-3">${sub}</span>` : ""}</button>`;
    const w = planWeeks();
    const items: string[] = [];
    if (ctx!.role === "person" && report && current) items.push(`<div class="px-3 py-2"><div class="t-small font-semibold text-text">Send the weekly report</div><div class="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-text-2"><label class="flex items-center gap-1.5"><input type="checkbox" data-r="on" ${report.on ? "checked" : ""} class="h-4 w-4 accent-accent" />${report.on ? "On" : "Off"}</label><select data-r="dow" class="r-btn border border-border bg-alt px-2 py-1 text-[13px] text-text">${DOW.map((d, i) => `<option value="${i}" ${i === report!.dow ? "selected" : ""}>${d}s</option>`).join("")}</select></div><div class="t-caption mt-1 text-text-3" data-r="msg">Last week's dose, minutes, strength days, steps, resting heart rate and any new test. No AI writes it.</div></div>`);
    items.push(item("plan", plan ? "The plan" : "Pin a plan", plan ? `updated ${fmtDay(day(plan.created_at ?? plan.starts_on))}${w ? ` · week ${w.wk} of ${w.weeks}` : ""}` : "a name, a start, the weeks"));
    items.push(item("txt", "Export this thread", "as text"));
    items.push(item("csv", "Export this thread", "as CSV"));
    if (ctx!.role === "person") items.push(item("readings", "Export the readings", "the page's rows as CSV"));
    if (ctx!.role === "person") items.push(item("access", "Who can see this", "Access"));
    panel.innerHTML = items.join(`<span class="mx-2 my-0.5 h-px bg-border" aria-hidden="true"></span>`);
    const save = async () => {
      const on = (panel.querySelector('[data-r="on"]') as HTMLInputElement).checked;
      const dow = Number((panel.querySelector('[data-r="dow"]') as HTMLSelectElement).value);
      const { error } = await supabase.rpc("set_weekly_report", { g: current!.id, on_: on, dow });
      (panel.querySelector('[data-r="msg"]') as HTMLElement).textContent = error ? `Not saved: ${error.message}` : on ? `Saved. The next one goes on ${DOW[dow]}.` : "Saved. No weekly report.";
      if (!error) report = { on, dow };
    };
    panel.querySelector('[data-r="on"]')?.addEventListener("change", save);
    panel.querySelector('[data-r="dow"]')?.addEventListener("change", save);
  }

  function drawThreads() {
    const t = ctx!.threads;
    $m("threads").innerHTML = t.length > 1 ? t.map((x) =>
      `<button type="button" data-thread="${x.id}" class="r-chip border px-3 py-1 text-[12.5px] font-semibold ${x.id === current?.id ? "border-accent-border bg-accent-fill text-accent-text" : "border-border text-text-2 hover:text-text"}">${esc(x.label)}${x.status !== "active" ? " · stopped" : ""}</button>`).join("") : "";
    $m("title").textContent = ctx!.role === "viewer" ? `With ${ctx!.personName || "them"}` : current ? `With ${current.label}` : "With your coach";
    $m("sub").textContent = !current ? (ctx!.role === "person" ? "Share your page with a coach or clinician, under Access, to start a thread." : "")
      : ctx!.role === "viewer" ? `You see what ${ctx!.personName || "they"} shared, read-only · everything is dated and kept on their page · messages are not medical advice`
      : `Reads your week when the weekly report is on · can see every page you shared, read-only · messages are not medical advice`;
  }

  // ── loading ──────────────────────────────────────────────────────────
  async function loadThread() {
    rows = []; plan = null; report = null; say(""); menuOpen = false; pinOpen = false; drawPinForm();
    if (!current) { drawThreads(); $m("list").innerHTML = ""; $m("plan").classList.add("hidden"); drawMenu(); return; }
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

  async function pinSubmit(e: Event) {
    e.preventDefault();
    if (!ctx || !current) return;
    const name = ($m("pname") as HTMLInputElement).value.trim();
    const start = ($m("pstart") as HTMLInputElement).value;
    const weeks = Math.max(1, Number(($m("pweeks") as HTMLInputElement).value) || 8);
    const end = new Date(start + "T00:00:00"); end.setDate(end.getDate() + weeks * 7 - 1);
    const ends = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const pinBtn = $m("pin").querySelector("button[type=submit]") as HTMLButtonElement;
    if (pinBtn.disabled) return;
    pinBtn.disabled = true;
    const file = ($m("file") as HTMLInputElement).files?.[0];
    const up = file ? await upload(file) : null;
    if (file && !up) { pinBtn.disabled = false; return; }
    const { error } = await supabase.from("plans").insert({ grant_id: current.id, person_id: ctx.personId, name, starts_on: start, ends_on: ends, file_path: up?.path ?? null, file_name: up?.name ?? null, created_by: ctx.userId });
    if (error) { pinBtn.disabled = false; say(`Not pinned: ${error.message}`); return; }
    await supabase.from("messages").insert({ grant_id: current.id, person_id: ctx.personId, sender_id: ctx.userId, sender_role: ctx.role, sender_label: ctx.myLabel, kind: "plan", body: `${name}: ${weeks} weeks from ${fmtDay(start)}.`, file_path: up?.path ?? null, file_name: up?.name ?? null, file_size: up?.size ?? null });
    ($m("file") as HTMLInputElement).value = ""; $m("filename").textContent = "";
    pinOpen = false; drawPinForm();
    await loadThread();
  }

  // ── actions ──────────────────────────────────────────────────────────
  document.addEventListener("click", (e) => { if (menuOpen && !(e.target as Element).closest('[data-m="menuwrap"]')) { menuOpen = false; drawMenu(); } });
  root.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-m="menu"]')) { menuOpen = !menuOpen; drawMenu(); return; }
    const mi = t.closest("[data-menu]") as HTMLElement | null;
    if (mi) {
      const k = mi.dataset.menu!;
      menuOpen = false; drawMenu();
      if (k === "plan") { if (plan) { planOpen = true; drawPlan(); $m("plan").scrollIntoView({ block: "nearest" }); } else { pinOpen = true; drawPinForm(); } }
      if (k === "txt") exportAs("txt");
      if (k === "csv") exportAs("csv");
      if (k === "readings") document.getElementById("exportcsv")?.click();
      if (k === "access") actions.person("access");
      return;
    }
    if (t.closest("[data-plan-toggle]")) { planOpen = !planOpen; drawPlan(); return; }
    if (t.closest("[data-pin-cancel]")) { pinOpen = false; drawPinForm(); return; }
    const rp = t.closest("[data-report]") as HTMLElement | null;
    if (rp) { const id = rp.dataset.report!; if (openReports.has(id)) openReports.delete(id); else openReports.add(id); draw(); return; }
    const gt = t.closest("[data-goto-tab]") as HTMLElement | null;
    if (gt) { actions.goTab(gt.dataset.gotoTab!); return; }
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

  return {
    /** A person or a share changed: the threads this page has, and whose side we are on. */
    async load(next: MessagesContext) {
      ctx = next;
      current = next.threads.find((t) => t.status === "active") ?? next.threads[0] ?? null;
      await loadThread();
    },
    /** The tab came into view: mark what is now read. */
    refresh: () => loadThread(),
    countUnread,
  };
}
