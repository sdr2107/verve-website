/**
 * "See the site as": a preview for Verve's own accounts (26 November 2026; Settings › For the team).
 *
 * The founder's account is the team's, and on the VIP list, so the server never answers it as a founding member.
 * To see what a founding member sees he would need a second account. This is the other way: the page draws
 * itself as it would for that person, from a sample last day, through the same functions the real thing uses
 * (./founding.ts for the sentence of the last week, ../account.ts for the plan line, ./access.ts for the doors), so
 * the preview cannot drift from what a member reads.
 *
 * It is a preview of what the page SHOWS. It changes nothing on the server: the account stays the team's, the
 * database still gives it the team's rows and the functions still answer it as the team. What the server decides
 * (whether a plan is written, whether a new horizon is started) is therefore not previewed.
 *
 * It is honoured only when the server has said this is one of the team's accounts: for any other account whatever
 * the browser holds is ignored. The choice is kept in this browser and nowhere else.
 *
 * Pure but for the storage it is handed; tests/preview.test.mjs.
 */
import type { PlanInfo } from "../account.ts";
import type { HorizonAccess } from "./access.ts";
import { shiftDay } from "./founding.ts";

export type ViewAs = "team" | "founding" | "founding_last_week" | "after";

/** The control, in the order it is drawn. */
export const VIEW_AS: { key: ViewAs; label: string }[] = [
  { key: "team", label: "Team" },
  { key: "founding", label: "Founding member" },
  { key: "founding_last_week", label: "Founding member, last week" },
  { key: "after", label: "After the 12 weeks" },
];
export const VIEW_AS_HEAD = "See the site as";
export const VIEW_AS_NOTE = "A preview of what the page shows. Your account stays the team's.";
/** The way back, on every tab while a preview is on: Settings › For the team is hidden in a preview, as it is for a member. */
export const PREVIEW_BACK = "Back to the team's view";
export const VIEW_AS_KEY = "mh-view-as";

export const parseViewAs = (x: unknown): ViewAs => (x === "founding" || x === "founding_last_week" || x === "after" ? x : "team");
/** The view in force. Anything but a team account sees the page as itself, whatever is stored. */
export const viewAsFor = (stored: unknown, team: boolean): ViewAs => (team ? parseViewAs(stored) : "team");

export type ViewStore = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
function browserStore(): ViewStore | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
/** What this browser holds. A private window, or none: the team's view. */
export function readViewAs(store: ViewStore | null = browserStore()): ViewAs {
  if (!store) return "team";
  try { return parseViewAs(store.getItem(VIEW_AS_KEY)); } catch { return "team"; }
}
/** Keep the choice; the team's view is kept as nothing at all. */
export function writeViewAs(view: ViewAs, store: ViewStore | null = browserStore()): void {
  if (!store) return;
  try { if (view === "team") store.removeItem(VIEW_AS_KEY); else store.setItem(VIEW_AS_KEY, view); } catch { /* the page stays on the team's view */ }
}

/** The line that stays on the page while a preview is on; null on the team's view. */
export function previewLine(view: ViewAs): string | null {
  if (view === "founding") return "Previewing as a founding member";
  if (view === "founding_last_week") return "Previewing as a founding member in the last week";
  if (view === "after") return "Previewing as a member after the 12 weeks";
  return null;
}

/**
 * The two flags the page keeps (../known.ts accessFlags), as the previewed person would hold them: a founding
 * member has the programme and nothing that is the team's; after the 12 weeks, neither. An account that is not
 * the team's is returned as it is.
 */
export function seenFlags(real: { tester: boolean; team: boolean }, view: ViewAs): { tester: boolean; team: boolean } {
  if (view === "team" || !real.team) return real;
  return { tester: view !== "after", team: false };
}

/** The sample last day: far off for a founding member, three days off inside the last week, none once it has passed. */
export function sampleUntil(view: ViewAs, today: string): string | null {
  if (view === "founding") return shiftDay(today, 56);
  if (view === "founding_last_week") return shiftDay(today, 3);
  return null;
}

/** The plan as the previewed person would be told it, in the shape the server answers (../account.ts PlanInfo). */
export function seenPlan(real: PlanInfo | null, view: ViewAs, today: string): PlanInfo | null {
  if (view === "team") return real;
  if (view === "after") return { plan: "free", through: null, until: null, trial: { available: false, ends_at: null } };
  return { plan: "pro", through: "founding", until: `${sampleUntil(view, today)}T12:00:00Z`, trial: { available: false, ends_at: null } };
}

/** What the previewed person may do on Horizon (./access.ts HorizonAccess): Pro while a founding member, and after the 12 weeks Free with no free week left. */
export function seenAccess(real: HorizonAccess | null, view: ViewAs): HorizonAccess | null {
  if (view === "team") return real;
  if (view === "after") return { pro: false, free: { available: false, until: null, running: false }, asks: { limit: 0, left: 0 } };
  return real ? { ...real, pro: true } : null;
}
