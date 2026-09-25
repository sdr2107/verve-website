/**
 * The site's fixed addresses and its navigation, in one place.
 *
 * The header and the footer both read NAV, so the same four links appear at
 * the top and the bottom of every page, in the same order. Before this the
 * App Store address was written into five files and the header on each page
 * carried a different subset of the links; the footer was the only place all
 * four appeared.
 */

import { PLANS_OPEN } from "./plans";

export const APP_STORE_URL = "https://apps.apple.com/app/id6760022278";
/**
 * Google Play, once the Android app ships: put its address here and /get
 * starts sending Android visitors to it and shows the second button. Until
 * then it is null, and /get says Android is coming.
 */
export const PLAY_STORE_URL: string | null = null;
/** The page "Get the app" opens, in a new tab: it routes to the store for the device. */
export const GET_APP_PATH = "/get";

/**
 * Stage 2 of the biomarkers: a report's app values go to the app the moment
 * they are read, marked unchecked, and the app asks the person to look at
 * them there. Kept off until the app build that shows the mark was on
 * phones, because an older build would show an unchecked number as a
 * settled one; that build went out on 2026-09-19. Set this back to false and
 * a value reaches the app only by Send, as in stage 1.
 */
export const AUTO_SEND_TO_APP = true;
export const X_URL = "https://x.com/RoplekarSudeep";
export const SUBSTACK_URL =
  "https://substack.com/@roplekarsudeep?r=596iu&utm_campaign=profile&utm_medium=profile-page";
/**
 * The policy and the terms are served by this site at /privacy/ and /terms/,
 * copies of privacy-policy.html and verve-terms-index.html in the app repo,
 * which stays the place they are written. Google's sign-in consent screen
 * needs both on a domain the project owns, which is why they moved here
 * from the separate Pages site; that site still serves the same text.
 */
export const PRIVACY_URL = "/privacy/";
export const TERMS_URL = "/terms/";

export type NavKey = "science" | "my-health" | "plans" | "x" | "substack";

export interface NavLink {
  key: NavKey;
  label: string;
  href: string;
  /** Off-site: opens in a new tab. */
  external?: boolean;
}

export const NAV: NavLink[] = [
  { key: "science", label: "Science", href: "/science" },
  { key: "my-health", label: "My health", href: "/my-health" },
  // the plans page joins the nav when plans open; until then it is a preview at /plans
  ...(PLANS_OPEN ? [{ key: "plans" as const, label: "Plans", href: "/plans" }] : []),
  { key: "x", label: "X", href: X_URL, external: true },
  { key: "substack", label: "Substack", href: SUBSTACK_URL, external: true },
];
