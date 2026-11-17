/** What a grant may cover, in the words the page uses. */
export const SCOPE_LABEL: Record<string, string> = { labs: "Labs", imaging: "Imaging", activity: "Activity and fitness", body: "Body measurements", heart: "Sleep and heart", notes: "Notes", chart: "Diet chart" };
/** Ticks that come from the app, which only a person with an account has. */
export const APP_SCOPES = new Set(["activity", "body", "heart"]);
/**
 * Ticks offered to test accounts only (Horizon as a programme). "chart" is a diet chart kept with a horizon and the
 * count of days it was followed (board 17, 17 November 2026): its own tick, never part of a preset, off until the
 * person ticks it. The database knows the word from METTracker supabase/migrations/20261119_horizon_chart_share.sql.
 */
export const TEST_SCOPES = new Set(["chart"]);
/** The ticks a person is offered where they give or change access, in order. "Notes" is never one of them. */
export const offeredScopes = (who: { hasAccount: boolean; tester: boolean }): string[] =>
  Object.keys(SCOPE_LABEL).filter((k) => k !== "notes" && (who.hasAccount || !APP_SCOPES.has(k)) && (who.tester || !TEST_SCOPES.has(k)));
export const ALL_SCOPES = ["labs", "imaging", "activity", "body", "notes"];
export const scopeList = (xs: string[]) => xs.map((x) => SCOPE_LABEL[x] ?? x).join(" · ");
