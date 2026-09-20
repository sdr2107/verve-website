/**
 * Plans — one login, three plans.
 *
 * Every person has their own login. A plan sits on whoever pays and decides
 * how many people they can see and how deep; it never decides what anyone
 * else must allow. Consent is free on every plan.
 *
 * Prices are null until the business is registered and the numbers are
 * chosen: the page then prints "price to be set" and offers no checkout.
 * Two flags gate the whole thing: PLANS_OPEN puts the page in the nav and
 * lets checkout run; PLANS_ENFORCED makes My health and the reader hold
 * people to their plan. Both off, nothing changes for anyone.
 */

export const PLANS_OPEN = false;
export const PLANS_ENFORCED = false;
/** "In Verve's words" on the In depth tab: off until the depth-summary function is switched on and the policy names it. */
export const AI_SUMMARY_OPEN = false;
/** The yearly price is twelve months less this many. */
export const YEARLY_MONTHS_FREE = 2;

export type PlanKey = "free" | "pro" | "max" | "enterprise";
export type Period = "monthly" | "yearly";
export type Currency = "inr" | "usd";

export interface Plan {
  key: PlanKey;
  name: string;
  tagline: string;
  /** A month, in whole currency units; null = not set yet. Yearly is derived. */
  monthly: Record<Currency, number | null>;
  /** Each further person a month; null = none allowed, or not set. */
  extra: Record<Currency, number | null>;
  /** People included besides you. */
  peopleIncluded: number;
  /** The most people in all, you included; null = no cap. */
  peopleMax: number | null;
  /** What the extra people are called on this plan. */
  peopleWord: string;
  cta: string;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  { key: "free", name: "Free", tagline: "For a look", monthly: { inr: 0, usd: 0 }, extra: { inr: null, usd: null }, peopleIncluded: 1, peopleMax: 2, peopleWord: "person", cta: "Start free" },
  { key: "pro", name: "Pro", tagline: "Your own page, in full", monthly: { inr: null, usd: null }, extra: { inr: null, usd: null }, peopleIncluded: 1, peopleMax: 2, peopleWord: "person", cta: "Choose Pro" },
  { key: "max", name: "Max", tagline: "Your family, up to five", monthly: { inr: null, usd: null }, extra: { inr: null, usd: null }, peopleIncluded: 2, peopleMax: 5, peopleWord: "person", cta: "Choose Max", highlight: true },
  { key: "enterprise", name: "Enterprise", tagline: "For coaches and their clients", monthly: { inr: null, usd: null }, extra: { inr: null, usd: null }, peopleIncluded: 10, peopleMax: null, peopleWord: "client", cta: "Choose Enterprise" },
];

export const planOf = (key: PlanKey): Plan => PLANS.find((p) => p.key === key) ?? PLANS[0];

/** What a plan lets its holder do. The reader's free reads are its own constant, server-side. */
export interface Entitlements {
  /** People besides you the plan lets you see, at any level. */
  peopleIncluded: number;
  /** The most people in all, you included; null = no cap. */
  peopleMax: number | null;
  /** In depth on your own page. */
  depthSelf: boolean;
  /** In depth on everyone you see, and the group view. */
  depthOthers: boolean;
  /** Every report read, not just the first two. */
  unlimitedReads: boolean;
  /** The app's export, imported. */
  importExport: boolean;
}
export function entitlements(key: PlanKey): Entitlements {
  const p = planOf(key);
  return {
    peopleIncluded: p.peopleIncluded,
    peopleMax: p.peopleMax,
    depthSelf: key !== "free",
    depthOthers: key === "max" || key === "enterprise",
    unlimitedReads: key !== "free",
    importExport: key !== "free",
  };
}

/** The chart's rows, in the plans' order: Free, Pro, Max, Enterprise. A string prints; true is a tick; false a dash. */
export const FEATURE_ROWS: { section: string; rows: { label: string; cells: [boolean | string, boolean | string, boolean | string, boolean | string] }[] }[] = [
  { section: "People", rows: [
    { label: "People on your account", cells: ["You", "You", "You + 2, up to 5 in all", "You + 10 clients"] },
    { label: "Each further person", cells: [false, false, "@extra a month, to 5", "@extra a month per client"] },
    { label: "Share your page with anyone", cells: [true, true, true, true] },
    { label: "See a page shared with you", cells: ["1 person, basic", "1 person, basic", "everyone, in depth", "everyone, in depth"] },
  ] },
  { section: "Reports", rows: [
    { label: "Reports read into Labs", cells: ["first 2", "unlimited", "unlimited, every person", "unlimited, every client"] },
    { label: "Values sent to the app", cells: [true, true, true, true] },
    { label: "Photos of reports", cells: [true, true, true, true] },
    { label: "The app's export, imported", cells: [false, true, true, true] },
  ] },
  { section: "Your numbers", rows: [
    { label: "Overview, Labs, Reports", cells: [true, true, true, true] },
    { label: "In depth on yourself", cells: [false, true, true, true] },
    { label: "In depth on everyone you see", cells: [false, false, true, true] },
    { label: "The group, ranked by movement", cells: [false, false, true, true] },
    { label: "This week and retest due, across everyone", cells: [false, false, true, true] },
    { label: "Fitness tests compared within method", cells: [false, true, true, true] },
  ] },
  { section: "The app", rows: [
    { label: "Verve app, free tier", cells: [true, true, true, true] },
    { label: "App Pro", cells: ["separate, in the App Store", "separate", "separate", "separate"] },
  ] },
];

const SYMBOL: Record<Currency, string> = { inr: "₹", usd: "$" };
const fmt = (n: number, c: Currency) => `${SYMBOL[c]}${c === "inr" ? n.toLocaleString("en-IN") : n.toLocaleString("en-US")}`;
/** "₹499" or "price to be set". */
export function priceText(p: Plan, period: Period, c: Currency): string {
  const m = p.monthly[c];
  if (m === 0) return `${SYMBOL[c]}0`;
  if (m == null) return "price to be set";
  return period === "monthly" ? fmt(m, c) : fmt(m * (12 - YEARLY_MONTHS_FREE), c);
}
export function extraText(p: Plan, c: Currency): string {
  const e = p.extra[c];
  return e == null ? "price to be set" : fmt(e, c);
}
