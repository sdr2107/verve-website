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
 * 27 November 2026: THE MEMBER'S VIEW IS THE DEFAULT. The founder tests on his own account, which is the team's,
 * and kept meeting what a member never sees ("the guide page is still visible", "the 6 months and 12 months
 * horizons are open and not locked"). So one of the team's accounts with no choice kept is shown the site as a
 * founding member, and the team's own view is the choice that is remembered. A strip on every tab says which of
 * the two is on and offers the other in one press (viewStrip). Until that day the team's view was the default
 * and was kept as nothing at all; a browser that holds nothing therefore opens on the member's view.
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
/** The strip's words on the two everyday views, and the press that leads to the other. */
export const MEMBER_VIEW = "You are seeing what a member sees";
export const TEAM_VIEW = "You are seeing the team's view";
export const SEE_TEAM = "See the team's view";
export const SEE_MEMBER = "See what a member sees";
export const VIEW_AS_KEY = "mh-view-as";

/** What one of the team's accounts is shown when it has chosen nothing: the site as a founding member sees it. */
export const DEFAULT_VIEW: ViewAs = "founding";
/** What is kept, read back. Nothing kept, or anything that is not one of the four, is the default. */
export const parseViewAs = (x: unknown): ViewAs => (x === "team" || x === "founding" || x === "founding_last_week" || x === "after" ? x : DEFAULT_VIEW);
/** The view in force. Anything but a team account sees the page as itself, whatever is stored. */
export const viewAsFor = (stored: unknown, team: boolean): ViewAs => (team ? parseViewAs(stored) : "team");

export type ViewStore = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
function browserStore(): ViewStore | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
/** What this browser holds. A private window, or nothing kept: the default, the member's view. */
export function readViewAs(store: ViewStore | null = browserStore()): ViewAs {
  if (!store) return DEFAULT_VIEW;
  try { return parseViewAs(store.getItem(VIEW_AS_KEY)); } catch { return DEFAULT_VIEW; }
}
/** Keep the choice. Every choice is written, the team's view too: it is no longer what an empty browser means. */
export function writeViewAs(view: ViewAs, store: ViewStore | null = browserStore()): void {
  if (!store) return;
  try { store.setItem(VIEW_AS_KEY, view); } catch { /* the choice lasts for this visit only */ }
}

/** The line that stays on the page while a preview is on; null on the team's view. */
export function previewLine(view: ViewAs): string | null {
  if (view === "founding") return MEMBER_VIEW;
  if (view === "founding_last_week") return "Previewing as a founding member in the last week";
  if (view === "after") return "Previewing as a member after the 12 weeks";
  return null;
}

/**
 * The strip at the top of every tab, for one of the team's accounts only: which view is on, and the one press to the
 * other. On the member's view it leads to the team's; on the team's view it leads back to the member's; on one of
 * the two rarer previews (the last week, after the 12 weeks: chosen under Settings › For the team) it leads to the
 * team's view, where that control is. Null for any other account: nothing is drawn for a real member.
 */
export type ViewStrip = { text: string; action: string; to: ViewAs };
export function viewStrip(view: ViewAs, team: boolean): ViewStrip | null {
  if (!team) return null;
  if (view === "team") return { text: TEAM_VIEW, action: SEE_MEMBER, to: "founding" };
  if (view === "founding") return { text: MEMBER_VIEW, action: SEE_TEAM, to: "team" };
  return { text: previewLine(view) ?? "", action: PREVIEW_BACK, to: "team" };
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
