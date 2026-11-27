/**
 * A horizon's pages.
 *
 * 27 November 2026, the founder, after seeing the page live: "Too many screens - too complex to follow. I want
 * something simple." "I just want to know where am i now, what i did and how i am progressing in fitness." So a
 * horizon opens on ONE page with two tabs and nothing else: "This week" (where you are, and what you did) and "Past
 * weeks" (how you are progressing). Everything the page showed before is kept, one quiet link away ("How the numbers
 * are set").
 *
 * What sits behind that link is the four small pages of 18 November 2026 (canvas "Verve, Horizon as a programme",
 * boards 22 and 24) and "Notes and settings". Their names in the code are as they were ("glance", "week"); two of
 * their addresses moved, so that a horizon's own address, and the one Monday's email links to ("-week"), land on
 * "This week".
 *
 * Pure; tests/horizon-pages.test.mjs runs it under node.
 */
/** The two tabs a horizon opens on. */
export const HORIZON_TABS = [["now", "This week"], ["past", "Past weeks"]] as const;
/** The pages behind "How the numbers are set", in the order of their small menu. The third was "This week" until the tab took that name. */
export const HORIZON_PAGES = [["glance", "Glance"], ["targets", "Targets"], ["week", "The week's plan"], ["science", "The science"]] as const;
export type HorizonTab = (typeof HORIZON_TABS)[number][0];
export type HorizonPage = HorizonTab | (typeof HORIZON_PAGES)[number][0] | "notes";
/** One of the two tabs, and not a page behind the link. */
export const isTab = (p: HorizonPage): p is HorizonTab => p === "now" || p === "past";

/** A page's word in an address. "This week" has none: it is the horizon's own address. */
const WORD: Record<Exclude<HorizonPage, "now">, string> = { past: "past", glance: "more", targets: "targets", week: "plan", science: "science", notes: "notes" };
/** An address's word, read back. "week" is what Monday's email links to (the function's week.ts): it opens "This week". */
const READ: [string, HorizonPage][] = [["past", "past"], ["more", "glance"], ["targets", "targets"], ["plan", "week"], ["science", "science"], ["notes", "notes"], ["week", "now"]];
/**
 * A horizon's route inside the pane: its id, and the page after it ("<id>-past"). An id holds hyphens of its own, so
 * the page is read from the end. A route that names no page is "This week".
 */
export function horizonRoute(route: string): { id: string; page: HorizonPage } {
  for (const [k, page] of READ) if (route.endsWith(`-${k}`) && route.length > k.length + 1) return { id: route.slice(0, -(k.length + 1)), page };
  return { id: route, page: "now" };
}
/** The route of one of a horizon's pages. */
export const routeOfPage = (id: string, page: HorizonPage): string => (page === "now" ? id : `${id}-${WORD[page]}`);
