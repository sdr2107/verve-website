/**
 * A horizon's pages.
 *
 * 27 November 2026, the founder, after seeing the page live: "Too many screens - too complex to follow. I want
 * something simple." "I just want to know where am i now, what i did and how i am progressing in fitness." So a
 * horizon opened on one page with two tabs, "This week" and "Past weeks", and everything the page showed before sat
 * one quiet link away ("How the numbers are set").
 *
 * The same day, after seeing that live: "'How are the numbers set' and 'settings' at the bottom direct us to the old
 * page - the jargon one. From glance, targets, weeks plan - i think we dont need anything, the science card can we
 * bring it to the main horizon page - so we have this week, past weeks and rename the science to 'your plan'". And:
 * "You can hide but dont delete the codebase - we might need it later." So:
 *
 *   THREE TABS   "This week", "Past weeks", "Your plan". And "Settings", three lines, one link away.
 *   HIDDEN       the four small pages of 18 November 2026 (canvas "Verve, Horizon as a programme", boards 22 and 24:
 *                Glance, Targets, The week's plan, The science) and "Notes and settings". Their code is all still
 *                here and in views/Horizon.tsx; nothing on the page leads to them and no address opens one.
 *                HORIZON_OLD_PAGES below turns them back on.
 *
 * An address someone kept, or an email linked to, still lands somewhere sensible: the old plan and science pages
 * open "Your plan", the old notes open "Settings", the old glance and targets open "This week". Monday's email links
 * to "-week" (the function's week.ts): it opens "This week".
 *
 * Pure; tests/horizon-pages.test.mjs runs it under node.
 */
/**
 * Whether the pages of 18 November 2026 are reachable: the link "How the numbers are set" under the tabs, their own
 * small menu, and their addresses. Hidden on 27 November 2026 because the founder met "the jargon one" behind that
 * link: moving the old page one click away had not made it simpler. Set to true to bring them back as they were.
 */
export const HORIZON_OLD_PAGES: boolean = false;

/** The three tabs a horizon opens on. */
export const HORIZON_TABS = [["now", "This week"], ["past", "Past weeks"], ["plan", "Your plan"]] as const;
/** The hidden pages (HORIZON_OLD_PAGES), in the order of their small menu. The third was "This week" until the tab took that name. */
export const HORIZON_PAGES = [["glance", "Glance"], ["targets", "Targets"], ["week", "The week's plan"], ["science", "The science"]] as const;
export type HorizonTab = (typeof HORIZON_TABS)[number][0];
export type OldPage = (typeof HORIZON_PAGES)[number][0] | "notes";
export type HorizonPage = HorizonTab | "settings" | OldPage;
/** One of the three tabs. */
export const isTab = (p: HorizonPage): p is HorizonTab => p === "now" || p === "past" || p === "plan";
/** One of the hidden pages. */
export const isOldPage = (p: HorizonPage): p is OldPage => p === "glance" || p === "targets" || p === "week" || p === "science" || p === "notes";

/** A page's word in an address. "This week" has none: it is the horizon's own address. */
const WORD: Record<Exclude<HorizonPage, "now">, string> = { past: "past", plan: "plan", settings: "settings", glance: "more", targets: "targets", week: "weekplan", science: "science", notes: "notes" };
/**
 * An address's word, read back. The longer word is read before a shorter one that ends it ("weekplan" before "plan").
 * "week" is what Monday's email links to: it opens "This week". While the old pages are hidden, each of their words
 * opens the tab that took its place.
 */
const READ: [string, HorizonPage][] = HORIZON_OLD_PAGES
  ? [["past", "past"], ["weekplan", "week"], ["plan", "plan"], ["settings", "settings"], ["more", "glance"], ["targets", "targets"], ["science", "science"], ["notes", "notes"], ["week", "now"]]
  : [["past", "past"], ["weekplan", "plan"], ["plan", "plan"], ["science", "plan"], ["settings", "settings"], ["notes", "settings"], ["more", "now"], ["targets", "now"], ["week", "now"]];
/**
 * A horizon's route inside the pane: its id, and the page after it ("<id>-past"). An id holds hyphens of its own, so
 * the page is read from the end. A route that names no page is "This week".
 */
export function horizonRoute(route: string): { id: string; page: HorizonPage } {
  for (const [k, page] of READ) if (route.endsWith(`-${k}`) && route.length > k.length + 1) return { id: route.slice(0, -(k.length + 1)), page };
  return { id: route, page: "now" };
}
/** The route of one of a horizon's pages. A hidden page has no route of its own: it is the tab that took its place. */
export function routeOfPage(id: string, page: HorizonPage): string {
  const to = !HORIZON_OLD_PAGES && isOldPage(page) ? horizonRoute(`${id}-${WORD[page]}`).page : page;
  return to === "now" ? id : `${id}-${WORD[to]}`;
}
/**
 * The page a reader is shown. Settings are the owner's: anyone else asking for them is shown "This week". While the
 * old pages are hidden nobody is shown one, whatever was asked for.
 */
export function shownPage(page: HorizonPage, owner: boolean): HorizonPage {
  if (page === "settings") return owner ? "settings" : "now";
  if (isOldPage(page) && !HORIZON_OLD_PAGES) return page === "week" || page === "science" ? "plan" : page === "notes" ? (owner ? "settings" : "now") : "now";
  return page;
}
