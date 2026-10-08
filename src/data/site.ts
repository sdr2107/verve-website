/**
 * The site's fixed addresses and its navigation, in one place.
 *
 * The header and the footer both read NAV and SOCIAL, so the same links
 * appear at the top and the bottom of every page, in the same order: the
 * site's pages as links, the accounts under one heading, Social. Before this
 * the App Store address was written into five files and the header on each
 * page carried a different subset of the links; the footer was the only
 * place all of them appeared.
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
export const TIKTOK_URL = "https://www.tiktok.com/@verveapp.health";
export const INSTAGRAM_URL = "https://www.instagram.com/verveapp.health/";
export const YOUTUBE_URL = "https://www.youtube.com/@verveapp.health";
/**
 * The policy and the terms are served by this site at /privacy/ and /terms/,
 * copies of privacy-policy.html and verve-terms-index.html in the app repo,
 * which stays the place they are written. Google's sign-in consent screen
 * needs both on a domain the project owns, which is why they moved here
 * from the separate Pages site; that site still serves the same text.
 */
export const PRIVACY_URL = "/privacy/";
export const TERMS_URL = "/terms/";

export type NavKey = "start" | "science" | "my-health" | "coach" | "clinician" | "plans";

export interface NavLink {
  key: NavKey;
  label: string;
  href: string;
  /** Off-site: opens in a new tab. */
  external?: boolean;
}

export const NAV: NavLink[] = [
  // the free sheet: where a visitor with no number yet begins
  { key: "start", label: "Start here", href: "/start" },
  { key: "science", label: "Science", href: "/science" },
  { key: "my-health", label: "My health", href: "/my-health" },
  // the plans page joins the nav when plans open; until then it is a preview at /plans
  ...(PLANS_OPEN ? [{ key: "plans" as const, label: "Plans", href: "/plans" }] : []),
];

export type SocialKey = "x" | "substack" | "tiktok" | "instagram" | "youtube";

export interface SocialLink {
  key: SocialKey;
  label: string;
  /** The handle as the platform shows it; the header and footer print it under the name. */
  handle: string;
  href: string;
}

/**
 * The accounts, under the one heading Social in the header and the footer.
 * X and Substack are Sudeep's own; TikTok, Instagram and YouTube are the app's.
 */
/**
 * The two doors for professionals. Out of the header since 8 October 2026:
 * one Sign in works out who is who, so nobody needs a door. The pages
 * stay as the pitch a coach or a doctor reads first, reached from Start
 * here and from the footer.
 */
export const PRO_PAGES: NavLink[] = [
  { key: "coach", label: "Coach", href: "/coach" },
  { key: "clinician", label: "Clinician", href: "/clinician" },
];

/**
 * The free fifteen-minute call: the Calendly event's address. Null until
 * the event exists; Start here shows the call section only when it is set.
 */
export const CALENDLY_URL: string | null = null;

export const SOCIAL: SocialLink[] = [
  { key: "x", label: "X", handle: "@RoplekarSudeep", href: X_URL },
  { key: "substack", label: "Substack", handle: "@roplekarsudeep", href: SUBSTACK_URL },
  { key: "tiktok", label: "TikTok", handle: "@verveapp.health", href: TIKTOK_URL },
  { key: "instagram", label: "Instagram", handle: "@verveapp.health", href: INSTAGRAM_URL },
  { key: "youtube", label: "YouTube", handle: "@verveapp.health", href: YOUTUBE_URL },
];
