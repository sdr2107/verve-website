/**
 * The page's state, as signals (step 3): the document, the person, which
 * tab and section are open, which marker and range. The views read these
 * and re-render only the nodes whose values changed; the page script sets
 * them where it used to assign globals. Nothing here fetches.
 */
import { signal, computed } from "@preact/signals";
import type { MyHealthDocument } from "./document.ts";
import { derivePerson } from "./derive/person.ts";
import type { Rng } from "./derive/lenses.ts";
import { WINDOW_KEYS, DEFAULT_WINDOW, isWindowKey, type WindowKey } from "./derive/timeline.ts";
import type { HorizonFull } from "./horizon/api.ts";

export type PersonLite = { id: string; owner_id: string; account_id: string | null; name: string; born_year: number | null; mine: boolean; self: boolean; scopes: string[];
  /** A page shared with you: the day the share began (the grant's accepted_at), when the page could read it. */
  since?: string | null };

export const doc = signal<MyHealthDocument | null>(null);
export const person = signal<PersonLite | null>(null);
/** Everyone on the account: you first, then the people you look after, then those who share with you. */
export const people = signal<PersonLite[]>([]);
export const firstName = signal("");
/** The vetted role on the signed-in account, if any. It is a fact about a person, so it sits beside their name in the People list and nowhere else. */
export const myRole = signal<"coach" | "clinician" | null>(null);
/** Two places on one sign-in (26 Oct 2026): "health" is your own page and the people you look after;
 *  "clients" is everyone who shares a page with you. The People menu and the group table show one at a time. */
export const space = signal<"health" | "clients">("health");
/** Someone who shares their page with you: a client, not yours to look after. */
export const isClient = (p: PersonLite) => !!p.id && !p.self && !p.mine;
/** One derived object per document; the same document gives the same object. */
export const derived = computed(() => (doc.value ? derivePerson(doc.value) : null));

// ── the tabs and their sections (canvas "My health, redesigned", 8 Nov 2026) ──
/** overview | guide | depth | horizon | body | reports | messages | group */
export const activeTab = signal("overview");
/** The six cards of the Overview, in the app's order. */
export const CARD_KEYS = ["fitness", "vitals", "sleep", "exertion", "movement", "body"] as const;
export type CardKey = (typeof CARD_KEYS)[number];
/** In depth: five windows of time, not chapters by topic (canvas "Verve, one story in four parts", board 04). One year opens first. */
export const DEPTH_KEYS = WINDOW_KEYS;
/** Body: the app's three shelves and the reports on file. */
export const BODY_KEYS = ["metabolic", "heart", "muscle", "reports"] as const;
/**
 * The open section of the active tab (canvas "Verve on the web, refined",
 * boards 04 and 07): one section is on the page at a time. On the Overview
 * "all" is the six cards and a card's key is that section alone; In depth
 * and Body have no page of their own, so they always hold one of their
 * sections: Body its first, In depth the one-year window, when none is
 * named. The hash carries it: #overview-movement, #depth-1y, #body-heart.
 * An address from before 11 Nov 2026 (#depth-sleep) lands on one year.
 */
export const section = signal<string>("all");
/** The sections of each tab that has them, in the sidebar's order. */
export const TAB_SECTIONS: Record<string, readonly string[]> = { overview: CARD_KEYS, depth: DEPTH_KEYS, body: BODY_KEYS };
/** The section a tab shows for a wanted one: the wanted one when the tab has it; else In depth's one year, Body's first, or "all" on the Overview and on a tab with no sections. */
export function sectionFor(tab: string, wanted: string): string {
  const keys = TAB_SECTIONS[tab];
  if (!keys) return "all";
  if (keys.includes(wanted)) return wanted;
  return tab === "overview" ? "all" : tab === "depth" ? DEFAULT_WINDOW : keys[0];
}
/** The name the Overview used before 8 Nov 2026; the same signal. */
export const ovSection = section;
export const openMarkerKey = signal("");
export const openRange = signal<Rng | "">("");
/** A year chosen under Years (or All): that year alone, month by month. */
export const openYear = signal<number | null>(null);
/** A tile tapped: the others step aside and the marker opens right under it. */
export const focusTile = signal(false);
/** Fitness, one card, two units (board 12): METs first, VO₂max a tap away; the choice is kept on the device. */
const FIT_UNIT_KEY = "mh-fit-unit";
const storedFitUnit = (): "mets" | "vo2" => { try { return localStorage.getItem(FIT_UNIT_KEY) === "vo2" ? "vo2" : "mets"; } catch { return "mets"; } };
export const fitUnit = signal<"mets" | "vo2">(typeof localStorage === "undefined" ? "mets" : storedFitUnit());
export function setFitUnit(u: "mets" | "vo2") { fitUnit.value = u; try { localStorage.setItem(FIT_UNIT_KEY, u); } catch { /* private mode */ } }

// ── the Guide ──
/** The latest read, for the one line the Overview keeps: when it was written and how many things it raised. */
export type LatestRead = { created_at: string; count: number };
export const latestRead = signal<LatestRead | null>(null);
/** The shape the page needs of a read row (web_reads) or the document's copy (depth_summaries): the conversations are the things worth knowing. */
export const readOf = (r: { created_at: string; summary?: any } | null | undefined): LatestRead | null =>
  r?.created_at ? { created_at: String(r.created_at), count: Array.isArray(r.summary?.conversations) ? r.summary.conversations.length : 0 } : null;

// ── Body (the Labs view, under its new door) ──
export const labSection = signal("");
/** One chart open at a time. */
export const expandedAnalyte = signal("");
/** Phone: the section list is the page until a section opens. */
export const mobileSectionOpen = signal(false);
/** The search box over Body and Reports; every word typed must land. */
export const searchQuery = signal("");

// ── In depth ──
/** The plan gate: in depth is on Pro for yourself, on Max for everyone you see. The page sets it from the plan. */
export const depthLocked = signal(false);
/** The page's working, for "The Guide's read"; the Depth view publishes it, the page's AI card reads it. */
export const depthWorking = signal<Record<string, unknown> | null>(null);
/** The lane a link elsewhere on the page asked for ("See Fitness over the last year"): In depth brings it into view and lights it once. */
export const depthLane = signal("");
/** A window the person asked the Guide to read, from In depth's head: the page's Guide view writes it and clears this. */
export const guideAsk = signal<{ window: WindowKey; working: Record<string, unknown> } | null>(null);

// ── Horizon, for the pages beside it ──
/** The person's horizons, open and closed, as the Horizon view last read them; null before it has. The Overview's cards, In depth's line of time and the Guide's doors read it. */
export const horizons = signal<HorizonFull[] | null>(null);
/**
 * A line the Guide wrote, carried to Horizon as a draft: "Make it a target".
 * It is not a target until the person sets a number; "Leave it" clears it. Kept
 * for the tab's life only, per person, so it never follows someone to another page.
 */
export type GuideDraft = { personId: string; marker: string; readOn: string };
const DRAFT_KEY = "mh-guide-draft";
const storedDraft = (): GuideDraft | null => { try { const v = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null"); return v && typeof v.marker === "string" && typeof v.personId === "string" ? v : null; } catch { return null; } };
export const guideDraft = signal<GuideDraft | null>(typeof sessionStorage === "undefined" ? null : storedDraft());
export function setGuideDraft(d: GuideDraft | null) {
  guideDraft.value = d;
  try { if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else sessionStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
}

/** What the views ask the page to do: the page fills these in. */
export const actions = {
  /** A press that changes the page is a step in the browser's history, so Back returns to the page before it. */
  step: () => {},
  goTab: (_t: string) => {},
  searchNote: (_text: string) => {},
  tabCount: (_tab: string, _text: string, _tone?: string) => {},
  /** The Reports tab's writes: parse, view, del, send, rename, rmimport. */
  report: (_kind: string, _name: string, _extra?: string) => {},
  /** The People control: open someone's page, the group, the forms, the access sheet. */
  person: (_kind: "switch" | "add" | "ask" | "access" | "everyone" | "edit" | "remove" | "health" | "clients", _id?: string) => {},
};
/** Jump into one section of Body, or straight to one marker's chart. */
export function openLabs(sec: string, analyte = "") {
  labSection.value = sec; expandedAnalyte.value = analyte; mobileSectionOpen.value = true;
  actions.goTab("body");
}

/** Follow a figure into time: In depth at a window (one year unless named), with that marker's lane in view. */
export function openOverTime(lane: string, window: string = DEFAULT_WINDOW) {
  actions.step();
  depthLane.value = lane;
  section.value = isWindowKey(window) ? window : DEFAULT_WINDOW;
  actions.goTab("depth");
}

/** Open a section of the active tab, as the sidebar, the cards and the arrows at a section's foot do; "all" is the Overview's six cards. */
export function setSection(k: string) {
  if (k !== section.value) actions.step();
  section.value = k;
  focusTile.value = false; openYear.value = null; openMarkerKey.value = "";
}
