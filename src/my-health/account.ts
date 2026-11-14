/**
 * The account, in the page's words: the plan as the server knows it, the
 * 14-day trial on the website, the weekly email, and the number a visitor
 * brings from the landing page ("Keep it"). Pure, so tests/account.test.mjs
 * can read it without a client; the calls themselves are in ./accountApi.ts.
 *
 * The server side of all of this arrives with a later deploy (the `plan`
 * action of the horizon function, start_web_trial(), email_prefs). Until it
 * does, every answer here is "unknown" and the page says what it said before.
 */

// ── the plan ────────────────────────────────────────────────────────────────

export type PlanThrough = "vip" | "trial" | "web" | "app";
export type PlanInfo = {
  plan: "pro" | "free";
  /** Where Pro comes from, in the server's order of precedence; null on Free. */
  through: PlanThrough | null;
  /** When it ends, when it has an end. */
  until: string | null;
  trial: { available: boolean; ends_at: string | null };
};

/** The function's answer, or null when it is not the shape the contract names (an older function, an error body). */
export function parsePlan(x: unknown): PlanInfo | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.plan !== "pro" && o.plan !== "free") return null;
  const through = o.through === "vip" || o.through === "trial" || o.through === "web" || o.through === "app" ? o.through : null;
  const t = (o.trial && typeof o.trial === "object" ? o.trial : {}) as Record<string, unknown>;
  return {
    plan: o.plan,
    through: o.plan === "pro" ? through : null,
    until: typeof o.until === "string" && o.until ? o.until : null,
    trial: { available: t.available === true, ends_at: typeof t.ends_at === "string" && t.ends_at ? t.ends_at : null },
  };
}

/** "25 November", with the year only when it is not this one. */
export function longDay(iso: string | null, today = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return d.getFullYear() === today.getFullYear() ? s : `${s} ${d.getFullYear()}`;
}

/**
 * The one line under the name and at the top of Plan and billing. Unknown
 * (the server has not answered, or cannot yet) reads as the page read before
 * the server could say: "Free".
 */
export function planLine(info: PlanInfo | null, today = new Date()): string {
  if (!info || info.plan !== "pro") return "Free";
  if (info.through === "app") return "Pro · through the app";
  if (info.through === "vip") return "Pro · on the VIP list";
  if (info.through === "trial") {
    const end = longDay(info.until ?? info.trial.ends_at, today);
    return end ? `Pro · 14-day trial on the website, until ${end}` : "Pro · 14-day trial on the website";
  }
  if (info.through === "web") return "Pro · on the website";
  return "Pro";
}

export type PlanRows = { renews: { value: string; note: string }; payment: { value: string; note: string }; receipts: string };
/** The three rows under the plan line: where it renews, what pays for it, and the receipts. */
export function planRows(info: PlanInfo | null, today = new Date()): PlanRows {
  const none = "None yet. Receipts appear here once plans open for payment on the website.";
  if (info?.plan === "pro" && info.through === "app") return {
    renews: { value: "In the app's store", note: "You bought Pro in the app, so you manage it there: the App Store or Google Play." },
    payment: { value: "—", note: "Paid through the app's store. No card is held here." },
    receipts: "Your receipts are with the store you bought Pro in. None are kept here.",
  };
  if (info?.plan === "pro" && info.through === "vip") return {
    renews: { value: "—", note: "Given by Verve. There is nothing to renew." },
    payment: { value: "—", note: "No card is held here." },
    receipts: none,
  };
  if (info?.plan === "pro" && info.through === "trial") {
    const end = longDay(info.until ?? info.trial.ends_at, today);
    return {
      renews: { value: "Does not renew", note: end ? `Pro on the website until ${end}. Nothing free is taken away when it ends.` : "Pro on the website for 14 days. Nothing free is taken away when it ends." },
      payment: { value: "—", note: "No card was asked for." },
      receipts: none,
    };
  }
  if (info?.plan === "pro" && info.through === "web") {
    const end = longDay(info.until, today);
    return {
      renews: { value: end || "—", note: "Bought on the website. It is the same Pro in the app." },
      payment: { value: "—", note: "Held by the payment provider, never by Verve." },
      receipts: none,
    };
  }
  return {
    renews: { value: "—", note: "Free has nothing to renew." },
    payment: { value: "—", note: "None. Plans are not open for payment on the website yet." },
    receipts: none,
  };
}

/**
 * The trial is offered, and started, only when the server says this account is
 * on Free and never had one. A person who is Pro already (the VIP list, the
 * app's subscription) would spend their one trial for nothing; and when the
 * server cannot say (null), nothing is started at all.
 */
export const trialOffered = (info: PlanInfo | null): boolean => !!info && info.plan === "free" && info.trial.available;

/** After the button: what the page says, from start_web_trial()'s answer. */
export function trialStartedLine(endsAt: string | null, today = new Date()): string {
  const end = longDay(endsAt, today);
  return end ? `Pro on the website until ${end}. Nothing free is taken away when it ends.` : "Pro on the website for 14 days. Nothing free is taken away when it ends.";
}

export type TrialAnswer = { started: boolean; reason?: string; ends_at: string | null };
/** start_web_trial()'s answer in one shape; null when it is not one. */
export function parseTrial(x: unknown): TrialAnswer | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.started !== "boolean") return null;
  return { started: o.started, reason: typeof o.reason === "string" ? o.reason : undefined, ends_at: typeof o.ends_at === "string" && o.ends_at ? o.ends_at : null };
}

// ── "Keep it": the number a visitor brings from the landing page ─────────────

export const KEEP_KEY = "verve-keep";
export type KeepTest = "walk6" | "run12";
export type Keep = {
  test: KeepTest; distance_m: number; age: number; sex: string; weight_kg: number | null;
  mets: number; vo2: number | null; tier: string | null; on: string; weekly: boolean;
};

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * What the landing page left in local storage, or null when it is not a
 * number this page can file: a test it knows, a date, and METs a person can
 * have (1 to 25). The weekly email is asked for only by a literal true.
 */
export function parseKeep(raw: string | null | undefined): Keep | null {
  if (!raw) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== "object") return null;
  const test = o.test === "walk6" || o.test === "run12" ? o.test : null;
  const mets = num(o.mets);
  if (!test || mets == null || mets < 1 || mets > 25 || !isDay(o.on)) return null;
  const vo2 = num(o.vo2);
  return {
    test, distance_m: num(o.distance_m) ?? 0, age: num(o.age) ?? 0, sex: typeof o.sex === "string" ? o.sex : "",
    weight_kg: num(o.weight_kg), mets, vo2: vo2 != null && vo2 > 3 && vo2 < 90 ? vo2 : null,
    tier: typeof o.tier === "string" && o.tier ? o.tier : null, on: o.on, weekly: o.weekly === true,
  };
}

/** One decimal, always: 8 reads "8.0". */
export const metsText = (m: number): string => m.toFixed(1);

/** The line over the sign-in card for a visitor who came to keep a number. */
export const keepLine = (k: Keep): string => `Sign in to keep your number: ${metsText(k.mets)} METs.`;

export const KEEP_METHOD: Record<KeepTest, string> = { walk6: "six-minute walk", run12: "twelve-minute run" };

export type FirstNumberRow = { user_id: string; person_id: string; measured_on: string; met_capacity: number; vo2max: number | null; method: string; source: string };
/** The row the number becomes, on the person's own page. */
export function keepRow(k: Keep, ids: { userId: string; personId: string }): FirstNumberRow {
  return {
    user_id: ids.userId, person_id: ids.personId, measured_on: k.on,
    met_capacity: Math.round(k.mets * 10) / 10, vo2max: k.vo2 != null ? Math.round(k.vo2 * 10) / 10 : null,
    method: KEEP_METHOD[k.test], source: "website",
  };
}

/** The same test on the same day is already on the page: nothing to write. */
export const alreadyKept = (k: Keep, existing: readonly { measured_on?: string | null; method?: string | null }[]): boolean =>
  existing.some((r) => r.measured_on === k.on && r.method === KEEP_METHOD[k.test]);

export type KeepOutcome = {
  /** The number is on the page now (written just now, or it already was). */
  kept: boolean;
  mets: number;
  /** start_web_trial()'s answer; null when the server could not say (not deployed, offline). */
  trial: TrialAnswer | null;
  /** The weekly email was asked for and the choice was saved. */
  weekly: boolean;
};
export type KeepCard = { title: string; lines: string[]; foot: string | null };

/**
 * The card on Overview after "Keep it". A trial that started says so, with
 * its end; anything else (the trial was used before, the server is not there
 * yet) says only what is true: the number is on the page.
 */
export function keepCard(o: KeepOutcome, today = new Date()): KeepCard | null {
  if (!o.kept) return null;
  const number = `Your number is on your page: ${metsText(o.mets)} METs.`;
  if (o.trial?.started) {
    const end = longDay(o.trial.ends_at, today);
    return {
      title: "14 days of Pro on the website. No card.",
      lines: [number, "The Guide's first read is one press away, on The Guide.", "Add the app and the week fills itself.", ...(o.weekly ? ["Your week arrives by email on Mondays."] : [])],
      foot: end ? `Pro on the website until ${end}. After that the page returns to free, and nothing free is taken away.` : "After 14 days the page returns to free, and nothing free is taken away.",
    };
  }
  return { title: "Your number is on your page.", lines: [`${metsText(o.mets)} METs, on Fitness.`, ...(o.weekly ? ["Your week arrives by email on Mondays."] : [])], foot: null };
}

// ── the weekly email ────────────────────────────────────────────────────────

/** Tri-state: on, off, or the table is not there yet ("not switched on yet", and the switch does nothing). */
export type WeeklyState = { state: "on" | "off" | "unavailable"; timezone: string | null; since?: string | null };
export const weeklyNote = (w: WeeklyState, today = new Date()): string =>
  w.state === "unavailable" ? "Not switched on for this account yet."
  : w.state === "on" ? (longDay(w.since ?? null, today) ? `On since ${longDay(w.since ?? null, today)}. Mondays, once the app has synced the week.` : "On. Mondays, once the app has synced the week.")
  : "Off unless you turn it on.";
/** One Monday email, never two: said once under the two switches. */
export const ONE_MONDAY_EMAIL = "With both on you get one email on Monday, Your week, with the check-in inside it. Whenever a Monday check-in exists it travels in Your week, whichever way the horizon's own switch is set.";
export const WEEKLY_CARRIES = "The week's dose, six figures against the week before, and your horizon's pace when one is open. One click in any email turns it off.";

/** The browser's zone, the one the email's Monday is read in; null when the browser will not say. */
export function browserZone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

// ── Settings ────────────────────────────────────────────────────────────────

export const SETTINGS_SECTIONS = [
  ["profile", "Profile"], ["plan", "Plan and billing"], ["email", "Email and notifications"],
  ["sharing", "Sharing"], ["devices", "Devices"], ["data", "Data"], ["appearance", "Appearance"],
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number][0];
export const isSettingsSection = (s: string): s is SettingsSection => SETTINGS_SECTIONS.some(([k]) => k === s);
