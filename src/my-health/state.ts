/**
 * The page's state, as signals (step 3): the document, the person, which
 * tab and section are open, which marker and range. The views read these
 * and re-render only the nodes whose values changed; the page script sets
 * them where it used to assign globals. Nothing here fetches.
 */
import { signal, computed } from "@preact/signals";
import type { MyHealthDocument } from "./document.ts";
import { derivePerson } from "./derive/person.ts";
import type { SecKey, Rng } from "./derive/lenses.ts";

export type PersonLite = { id: string; owner_id: string; account_id: string | null; name: string; born_year: number | null; mine: boolean; self: boolean; scopes: string[] };

export const doc = signal<MyHealthDocument | null>(null);
export const person = signal<PersonLite | null>(null);
/** One derived object per document; the same document gives the same object. */
export const derived = computed(() => (doc.value ? derivePerson(doc.value) : null));

export const activeTab = signal("overview");
export const ovSection = signal<"all" | SecKey>("all");
export const openMarkerKey = signal("");
export const openRange = signal<Rng | "">("");
/** A year chosen under Years (or All): that year alone, month by month. */
export const openYear = signal<number | null>(null);
/** A tile tapped: the others step aside and the marker opens right under it. */
export const focusTile = signal(false);

// ── Labs ──
export const labSection = signal("");
/** One chart open at a time. */
export const expandedAnalyte = signal("");
/** Phone: the section list is the page until a section opens. */
export const mobileSectionOpen = signal(false);
/** The search box over Labs and Reports; every word typed must land. */
export const searchQuery = signal("");

/** What the views ask the page to do: the page fills these in. */
export const actions = {
  goTab: (_t: string) => {},
  searchNote: (_text: string) => {},
};
/** Jump into one section of Labs, or straight to one marker's chart. */
export function openLabs(sec: string, analyte = "") {
  labSection.value = sec; expandedAnalyte.value = analyte; mobileSectionOpen.value = true;
  actions.goTab("labs");
}

/** Open a section, as the sidebar and the glance cards do. */
export function setSection(k: "all" | SecKey) {
  ovSection.value = k;
  focusTile.value = false; openYear.value = null; openMarkerKey.value = "";
}
