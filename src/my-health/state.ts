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
/** In depth: the week that closed, the longer view, then the six chapters and the table that left the Overview. */
export const DEPTH_KEYS = ["lastweek", "snapshot", "fitness", "vitals", "sleep", "exertion", "movement", "everynumber"] as const;
/** Body: the app's three shelves and the reports on file. */
export const BODY_KEYS = ["metabolic", "heart", "muscle", "reports"] as const;
/**
 * The open section of the active tab: a card on the Overview (opened in
 * place), a chapter on In depth, a group on Body; "all" is the tab's own
 * page. The hash carries it: #overview-movement, #depth-sleep, #body-heart.
 */
export const section = signal<string>("all");
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

/** What the views ask the page to do: the page fills these in. */
export const actions = {
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

/** Open a section of the active tab, as the sidebar and the cards do; "all" closes it. */
export function setSection(k: string) {
  section.value = k;
  focusTile.value = false; openYear.value = null; openMarkerKey.value = "";
}
