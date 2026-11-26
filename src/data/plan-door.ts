/**
 * The door to the plans from inside My health (26 November 2026).
 *
 * While the Plans page is hidden (./plans.ts PLANS_PAGE_PUBLIC, off since 21 November 2026) /plans tells everyone
 * but the team "Plans are not open yet." A button that says "See the plans" and lands there is a dead button, and
 * My health had nine of them. Every one now asks this file where it leads:
 *
 *   - the Plans page, once it is public again: the day the switch goes on, every link comes back, with its words;
 *   - the app, where Pro can be bought today and opens the same things here, where that is the true next step;
 *   - nowhere, where the app's Pro is not the next step (Horizon is not sold; the family and coach plans are not in
 *     the app). The caller then draws no link at all.
 *
 * Pure; tests/plans-hidden.test.mjs.
 */
import { PLANS_PAGE_PUBLIC } from "./plans.ts";
import { GET_APP_PATH } from "./site.ts";

export type PlanDoor = { href: string; label: string };
export const PRO_IN_THE_APP = "Get Pro in the app";

/**
 * Where a plans link leads. `label` is what the link says when it opens the Plans page. `viaApp` says whether Pro
 * bought in the app is the next step for this gate while the page is hidden.
 */
export function planDoor(label: string, viaApp: boolean, pagePublic: boolean = PLANS_PAGE_PUBLIC): PlanDoor | null {
  if (pagePublic) return { href: "/plans", label };
  return viaApp ? { href: GET_APP_PATH, label: PRO_IN_THE_APP } : null;
}
