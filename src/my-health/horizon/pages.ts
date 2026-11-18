/**
 * A horizon's small pages (canvas "Verve, Horizon as a programme", boards 22 and 24; the founder, 18 November 2026:
 * "not all on one page - too much to read and absorb - split into smaller bit sized sections that is easier to
 * visually understand and follow").
 *
 * One glance, then one page for each of the three things a person comes for: where they have to reach, what this
 * week asks, and the science behind it. What is neither sits apart, under "Notes and settings". Each page has an
 * address of its own, so the browser's Back works and a link can open one.
 *
 * The names are the founder's choice of 18 November 2026: "Targets", "This week", "The science".
 *
 * Pure; tests/horizon-pages.test.mjs runs it under node.
 */
export const HORIZON_PAGES = [["glance", "Glance"], ["targets", "Targets"], ["week", "This week"], ["science", "The science"]] as const;
export type HorizonPage = (typeof HORIZON_PAGES)[number][0] | "notes";
/** The pages that are named in an address. The glance is the horizon's own address. */
const NAMED = ["targets", "week", "science", "notes"] as const;
/**
 * A horizon's route inside the pane: its id, and the page after it ("<id>-week"). An id holds hyphens of its own, so
 * the page is read from the end. A route that names no page is the glance.
 */
export function horizonRoute(route: string): { id: string; page: HorizonPage } {
  for (const k of NAMED) if (route.endsWith(`-${k}`) && route.length > k.length + 1) return { id: route.slice(0, -(k.length + 1)), page: k };
  return { id: route, page: "glance" };
}
/** The route of one of a horizon's pages. */
export const routeOfPage = (id: string, page: HorizonPage): string => (page === "glance" ? id : `${id}-${page}`);
