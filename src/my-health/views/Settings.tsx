/**
 * Settings (canvas "Verve on the web, rethought", board 08): the three
 * parts of the page that ask the server something. Plan and billing shows
 * the plan as the server knows it and, on Free, the 14-day trial; Email and
 * notifications holds the weekly email's switch and each open horizon's
 * check-in switch; Appearance is light, dark or the device's own, one choice
 * for the whole site (src/lib/theme.ts).
 *
 * Profile, Sharing and Data are the page's own markup (the name's edit, the
 * access panel, the exports and the account's deletion are the controls the
 * page already had), so they are not drawn here.
 *
 * The server side of the plan, the trial and the weekly email lands with a
 * later deploy. Until it does: the plan reads as it read before, no trial is
 * offered, and the weekly switch says it is not switched on yet.
 */
import { render } from "preact";
import { useState } from "preact/hooks";
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTheme, setTheme, THEME_EVENT, type ThemeChoice } from "../../lib/theme.ts";
import { listHorizons, updateHorizon, type HorizonFull } from "../horizon/api.ts";
import {
  type PlanInfo, type WeeklyState, ONE_MONDAY_EMAIL, WEEKLY_CARRIES, browserZone, planLine, planRows, trialOffered, weeklyNote,
} from "../account.ts";
import { fetchPlan, loadWeekly, saveWeekly, startWebTrial } from "../accountApi.ts";

/** The plan as the server knows it; null until it answers, and when it cannot. */
export const planInfoSignal = signal<PlanInfo | null>(null);
const weeklySignal = signal<WeeklyState | null>(null);
const horizonsSignal = signal<HorizonFull[] | "off" | null>(null);
const themeSignal = signal<ThemeChoice>("light");

export type SettingsDeps = {
  supabase: SupabaseClient; url: string; anonKey: string;
  userId: () => string;
  /** The signed-in person's own page, where their horizons live; null before it is known. */
  ownPersonId: () => string | null;
  openPlanSheet: () => void;
  goHorizon: () => void;
};
export type SettingsHandle = {
  /** Ask the server again: the plan, the weekly switch, the open horizons. */
  refresh: () => Promise<void>;
  /** Only the plan (cheap; the sidebar's line needs it on every sign-in). */
  refreshPlan: () => Promise<PlanInfo | null>;
};

export function mountSettings(roots: { plan: HTMLElement; email: HTMLElement; appearance: HTMLElement }, deps: SettingsDeps): SettingsHandle {
  themeSignal.value = getTheme();
  // the footer's control and another tab write the same choice: this one follows
  document.addEventListener(THEME_EVENT, () => { themeSignal.value = getTheme(); });
  const refreshPlan = async () => { const info = await fetchPlan(deps.supabase, deps.url, deps.anonKey); planInfoSignal.value = info; return info; };
  const refreshEmail = async () => {
    const uid = deps.userId();
    if (uid) weeklySignal.value = await loadWeekly(deps.supabase, uid);
    const pid = deps.ownPersonId();
    if (!pid) { horizonsSignal.value = []; return; }
    try { horizonsSignal.value = await listHorizons(deps.supabase, pid); } catch { horizonsSignal.value = "off"; }
  };
  render(<PlanBlock deps={deps} refreshPlan={refreshPlan} />, roots.plan);
  render(<EmailBlock deps={deps} refreshEmail={refreshEmail} />, roots.email);
  render(<AppearanceBlock />, roots.appearance);
  return { refresh: async () => { await Promise.all([refreshPlan(), refreshEmail()]); }, refreshPlan };
}

const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12.5px] leading-relaxed text-text-3">{children}</p>;
const Row = ({ label, value, note, first }: { label: string; value: any; note?: string; first?: boolean }) => (
  <div class={`grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[132px_minmax(0,1fr)] ${first ? "" : "border-t border-border"}`}>
    <div class="text-[13px] text-text-3">{label}</div>
    <div class="min-w-0">
      <div class="text-[15px] font-medium text-text">{value}</div>
      {note && <div class="mt-0.5 text-[12.5px] leading-relaxed text-text-3">{note}</div>}
    </div>
  </div>
);
const Switch = ({ on, disabled, label, onChange }: { on: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
    class={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${on ? "border-accent bg-accent" : "border-border-strong bg-alt"}`}>
    <span class={`absolute top-[2px] h-[18px] w-[18px] rounded-full transition-[left] ${on ? "left-[22px] bg-canvas" : "left-[2px] bg-text-3"}`} />
  </button>
);

// ── Plan and billing ────────────────────────────────────────────────────────

function PlanBlock({ deps, refreshPlan }: { deps: SettingsDeps; refreshPlan: () => Promise<PlanInfo | null> }) {
  const info = planInfoSignal.value;
  const rows = planRows(info);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  async function start() {
    setBusy(true); setSaid("");
    // ask the plan again first: a person who is Pro already must never spend their one trial for nothing
    const fresh = await refreshPlan();
    if (!trialOffered(fresh)) { setBusy(false); setSaid(fresh ? "" : "Could not reach the server. Try again in a moment."); return; }
    const res = await startWebTrial(deps.supabase);
    if (!res) { setBusy(false); setSaid("Could not start it. Try again in a moment."); return; }
    // started: the rows above now say it ("Pro on the website until …"), so nothing is said twice
    await refreshPlan();
    setSaid(res.started ? "" : "This account has already had its 14 days.");
    setBusy(false);
  }
  return (
    <div class="flex flex-col">
      <Row first label="Plan" value={planLine(info)} />
      <Row label="Renews" value={rows.renews.value} note={rows.renews.note} />
      <Row label="Payment method" value={rows.payment.value} note={rows.payment.note} />
      {trialOffered(info) && (
        <div class="flex flex-col gap-2 border-t border-border py-4">
          <div><button type="button" disabled={busy} onClick={() => void start()} class="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[14px] font-semibold text-canvas disabled:opacity-50">{busy ? "Starting…" : "Start 14 days of Pro, no card"}</button></div>
          <Quiet>Pro on the website: the Guide's reads and Horizon, here. No card is asked for, and an account has one trial. Nothing free is taken away when it ends.</Quiet>
        </div>
      )}
      {said && <p class="m-0 border-t border-border py-3 text-[14px] text-text-2" role="status">{said}</p>}
      <div class="border-t border-border py-3">
        <div class="text-[13px] font-semibold text-text">Receipts</div>
        <p class="m-0 mt-1 text-[13px] leading-relaxed text-text-3">{rows.receipts}</p>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3">
        <button type="button" onClick={deps.openPlanSheet} class="text-[13px] font-semibold text-accent-text">What Pro adds</button>
        <a href="/plans" class="text-[13px] font-semibold text-accent-text">See every plan</a>
      </div>
      <Quiet>Where you bought decides where you manage it: the App Store, Google Play, or here. It is the same Pro in all three.</Quiet>
    </div>
  );
}

// ── Email and notifications ─────────────────────────────────────────────────

function EmailBlock({ deps, refreshEmail }: { deps: SettingsDeps; refreshEmail: () => Promise<void> }) {
  const weekly = weeklySignal.value;
  const hs = horizonsSignal.value;
  const [busy, setBusy] = useState("");
  async function setWeekly(on: boolean) {
    const uid = deps.userId();
    if (!uid || !weekly || weekly.state === "unavailable") return;
    setBusy("weekly");
    weeklySignal.value = await saveWeekly(deps.supabase, uid, on, browserZone());
    setBusy("");
  }
  async function setCheckin(h: HorizonFull, on: boolean) {
    setBusy(h.id);
    await updateHorizon(deps.supabase, h.id, { email_checkin: on });
    await refreshEmail();
    setBusy("");
  }
  const open = Array.isArray(hs) ? hs : [];
  return (
    <div class="flex flex-col">
      <div class="flex items-start justify-between gap-4 py-3">
        <div class="min-w-0">
          <div class="text-[15px] font-medium text-text">Your week</div>
          <div class="mt-0.5 text-[12.5px] leading-relaxed text-text-3">{weekly ? weeklyNote(weekly) : "Reading…"}</div>
          <div class="mt-1 text-[12.5px] leading-relaxed text-text-3">{WEEKLY_CARRIES}</div>
        </div>
        <Switch label="Email me my week on Mondays" on={weekly?.state === "on"} disabled={!weekly || weekly.state === "unavailable" || busy === "weekly"} onChange={(v) => void setWeekly(v)} />
      </div>
      <div class="border-t border-border py-3">
        <div class="text-[15px] font-medium text-text">Horizon check-ins</div>
        {hs === null ? <div class="mt-0.5 text-[12.5px] text-text-3">Reading…</div>
          : hs === "off" ? <div class="mt-0.5 text-[12.5px] text-text-3">Not switched on for this account yet.</div>
          : !open.length ? <div class="mt-0.5 text-[12.5px] text-text-3">No open horizon. <button type="button" onClick={deps.goHorizon} class="font-semibold text-accent-text">Set one on Horizon</button></div>
          : (
            <div class="mt-1 flex flex-col">
              {open.map((h) => (
                <div class="flex items-center justify-between gap-4 py-2" key={h.id}>
                  <div class="min-w-0">
                    <div class="truncate text-[14px] text-text-2">{h.title}</div>
                    <div class="text-[12.5px] text-text-3">{"email_checkin" in h ? (h.email_checkin ? "Each check-in by email." : "Off unless you turn it on.") : "Not switched on for this account yet."}</div>
                  </div>
                  <Switch label={`Email me each check-in of ${h.title}`} on={!!h.email_checkin} disabled={!("email_checkin" in h) || busy === h.id} onChange={(v) => void setCheckin(h, v)} />
                </div>
              ))}
            </div>
          )}
      </div>
      <div class="border-t border-border py-3"><Quiet>{ONE_MONDAY_EMAIL}</Quiet></div>
      <div class="border-t border-border py-3">
        <div class="text-[15px] font-medium text-text">The newsletter</div>
        <div class="mt-0.5 text-[12.5px] leading-relaxed text-text-3">One letter a week. It is managed from any letter: each carries its own unsubscribe link.</div>
      </div>
      <Quiet>Each is off until you turn it on, and every email turns itself off in one click.</Quiet>
    </div>
  );
}

// ── Appearance ──────────────────────────────────────────────────────────────

const THEMES: [ThemeChoice, string][] = [["light", "Light"], ["dark", "Dark"], ["system", "System"]];
function AppearanceBlock() {
  const now = themeSignal.value;
  return (
    <div class="flex flex-col gap-3">
      <div class="flex w-full gap-1 rounded-[10px] border border-border bg-alt p-1 sm:w-fit" role="radiogroup" aria-label="Appearance">
        {THEMES.map(([k, label]) => (
          <button type="button" key={k} role="radio" aria-checked={now === k} onClick={() => setTheme(k)}
            class={`min-h-10 flex-1 rounded-[8px] px-5 text-[14px] font-medium sm:flex-none ${now === k ? "bg-accent-fill text-accent-text" : "text-text-2 hover:text-text"}`}>{label}</button>
        ))}
      </div>
      <Quiet>One choice for every page of the site, kept in this browser. System follows this device's light or dark. The same control is in the footer of every page.</Quiet>
    </div>
  );
}
