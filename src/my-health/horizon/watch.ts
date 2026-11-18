/**
 * Adding a marker to a horizon's draft, and watching one (canvas "Verve, Horizon as a programme", board 19; built on
 * the founder's word of 18 November 2026, for test accounts only: "I should be able to add key fitness metrics - maybe
 * steps per day, hand grip strength ... can we add [blood markers] just to monitor and not to change or set a target").
 *
 * A goal ticks the markers its studies speak about. This file lists every other marker the page can follow, so the
 * person can add their own beside them, and says how each one may be held: a number to reach, a number to hold, or
 * watched with no number at all.
 *
 * A watched marker is shown, and nothing more. It has no number to reach, no pace, no track and no colour. It is kept
 * in its own table (horizon_watched), which only its owner reads: no coach, and not the horizon function, so it cannot
 * reach Monday's check-in, the midweek note, the Guide's plan or its chat, a call sheet, or the offer's count.
 *
 * A blood marker can ONLY be watched. Targets on blood markers are still out of Horizon pending the lawyers' review
 * (derive.ts BLOOD_TARGETS_OPEN, 12 November 2026), and this file does not open them: it offers no number on one, in
 * the draft or anywhere else.
 *
 * Pure, no DOM, no fetch; tests/watch.test.mjs runs it under node. Not copied into the horizon function.
 */
import { MARKERS, MARKER_BY_KEY, dayMonthLong, fmtValue, swingRead, targetKeyOf, type MarkerDef, type MarkerKey, type Reading } from "./derive.ts";
import { WEEK_COUNTED, type Mode } from "../../data/programme.ts";

/** The three ways a number is held on a programme horizon, as the picker names them. "hold" is at least, at most, or between two. */
export type Way = "reach" | "hold" | "watch";
export const WAYS_WORDS: Record<Way, { title: string; sub: string }> = {
  reach: { title: "Reach", sub: "A number by the date." },
  hold: { title: "Hold", sub: "At least, at most, or between two." },
  watch: { title: "Watch", sub: "No number. Shown, not judged." },
};
export const wayOf = (mode: Mode): Way => (mode === "reach" ? "reach" : mode === "watch" ? "watch" : "hold");
/** The words under an added row's name. */
export const HELD_WORDS: Record<Mode, string> = { reach: "reach", floor: "held, at least", ceiling: "held, at most", band: "inside a band", watch: "watched" };

/** The markers the picker shows first (board 19, "Often added"), in the board's order. */
export const OFTEN_ADDED: MarkerKey[] = ["steps", "grip", "chair_stands", "weight", "waist", "sleep", "hrv", "longest_session"];
/** The blood markers that can be watched, in the board's order. */
export const BLOOD_WATCHED: MarkerKey[] = ["ldl", "apob", "non_hdl", "remnant", "triglycerides", "hdl", "hba1c", "fasting_glucose", "hs_crp"];
export const isBlood = (marker: string): boolean => MARKER_BY_KEY[marker]?.kind === "blood";

/**
 * The way the picker opens on for each marker: the one that suits it. A person can change it. Vitals that training
 * moves only slowly, or that nobody trains for directly, open on Watch; a number that barely moves in a few months
 * opens on Hold (grip: ../../data/programme.ts GRIP); a time in seconds, and sitting, are held at most.
 */
const OPENS_ON: Partial<Record<MarkerKey, Mode>> = {
  mets: "reach", dose: "floor", zone2_week: "reach", longest_session: "reach", strength_week: "reach", steps: "reach", background: "reach", cadence: "reach", pal: "reach",
  sitting: "ceiling", sleep: "reach", sri: "reach",
  rhr: "watch", hrv: "watch", hrr: "watch", bp: "watch", breathing: "watch", spo2: "watch",
  weight: "reach", waist: "reach", body_fat: "reach", almi: "floor", ffmi: "floor", grip: "floor", chair_stands: "ceiling", sppb: "floor",
};

export type AddRules = {
  /** The horizon is for a day under four full weeks away: only what a week can count takes a number (../../data/programme.ts WEEK_COUNTED). */
  short?: boolean;
  /** Watched rows can be kept (the table is there). When false nothing is offered to watch, blood included. */
  canWatch?: boolean;
};
/** The ways a marker may be held in this draft. A blood marker has one way only. Empty when it cannot be added at all. */
export function waysFor(marker: string, rules: AddRules = {}): Way[] {
  const def = MARKER_BY_KEY[marker];
  if (!def) return [];
  const watch: Way[] = rules.canWatch === false ? [] : ["watch"];
  if (def.kind === "blood") return watch;
  if (rules.short && !WEEK_COUNTED.has(marker)) return watch;
  return ["reach", "hold", ...watch];
}
/** The mode a marker is added in: the one that suits it, where this draft allows it; else the first way it does allow. */
export function opensOn(marker: string, rules: AddRules = {}): Mode | null {
  const ways = waysFor(marker, rules);
  if (!ways.length) return null;
  const suited: Mode = isBlood(marker) ? "watch" : OPENS_ON[marker as MarkerKey] ?? "reach";
  if (ways.includes(wayOf(suited))) return suited;
  return ways[0] === "watch" ? "watch" : ways[0] === "hold" ? "floor" : "reach";
}
/** The mode a marker moves to when a way is picked: Hold keeps the kind of hold it had, or opens on the one that suits it. */
export function modeFor(marker: string, way: Way, was: Mode | null = null): Mode {
  if (way === "reach" || way === "watch") return way;
  if (was === "floor" || was === "ceiling" || was === "band") return was;
  const suited = OPENS_ON[marker as MarkerKey];
  return suited === "ceiling" || suited === "band" ? suited : "floor";
}

export type AddChoice = { def: MarkerDef; /** Nothing is sending this reading: shown, and cannot be picked. */ missing: boolean; /** It takes no number in this draft. */ watchOnly: boolean };
export type AddGroup = { key: string; label: string; items: AddChoice[] };
const GROUPS: { key: string; label: string; of: string[] }[] = [
  { key: "fitness", label: "Fitness", of: ["fitness"] }, { key: "movement", label: "Movement", of: ["movement"] },
  { key: "sleep_vitals", label: "Sleep and vitals", of: ["sleep", "vitals"] }, { key: "body", label: "Body", of: ["body"] },
];
/**
 * Everything that can be added beside the goal's own markers: the eight often added first, then every other marker in
 * the page's groups, then the blood markers, which sit apart and are watched only. A marker the goal already lists is
 * left out. VO₂max is Fitness in another unit and is never listed (derive.ts targetKeyOf).
 */
export function addChoices(input: { taken: string[]; canFollow?: (marker: MarkerKey) => boolean } & AddRules): { often: AddChoice[]; groups: AddGroup[]; blood: AddChoice[] } {
  const taken = new Set(input.taken.map(targetKeyOf));
  const can = input.canFollow ?? (() => true);
  const choice = (def: MarkerDef): AddChoice[] => {
    const ways = waysFor(def.key, input);
    return ways.length ? [{ def, missing: !can(def.key), watchOnly: !ways.includes("reach") }] : [];
  };
  const free = MARKERS.filter((m) => m.kind !== "blood" && targetKeyOf(m.key) === m.key && !taken.has(m.key));
  const often = OFTEN_ADDED.flatMap((k) => { const def = free.find((m) => m.key === k); return def ? choice(def) : []; });
  const first = new Set(often.map((c) => c.def.key));
  const groups = GROUPS.map((g) => ({ key: g.key, label: g.label, items: free.filter((m) => g.of.includes(m.group) && !first.has(m.key)).flatMap(choice) })).filter((g) => g.items.length);
  const blood = BLOOD_WATCHED.flatMap((k) => { const def = MARKER_BY_KEY[k]; return def && !taken.has(k) ? choice(def) : []; });
  return { often, groups, blood };
}

// ── a watched marker, as the horizon's page shows it ──

/** A blood figure as a report prints it: to the marker's decimals, with no trailing zero ("112", "5.6"). Any other marker reads as the page writes it. */
export const watchedValue = (def: MarkerDef, r: Pick<Reading, "value" | "display">): string =>
  r.display ?? (def.kind === "blood" ? fmtValue(def, r.value).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : fmtValue(def, r.value));

/** One watched marker (public.horizon_watched): where it stood when it began to be watched, and nothing asked of it. */
export type WatchedRow = { id?: string; horizon_id?: string; marker: MarkerKey; unit: string | null; start_value: number | null; start_on: string | null; created_at?: string };
export type WatchedLine = { marker: MarkerKey; label: string; /** The small line under the name: the unit, and how it is read. */ how: string; /** The figure, or a dash. */ value: string; words: string };

/** What the row keeps when a marker begins to be watched: the reading on file that day, if there is one. */
export function watchedStart(marker: MarkerKey, now: Reading | null, today: string): Pick<WatchedRow, "marker" | "unit" | "start_value" | "start_on"> {
  const def = MARKER_BY_KEY[marker];
  const d = def ? def.decimals + 1 : 2;
  return { marker, unit: now?.unit ?? def?.unit ?? null, start_value: now && Number.isFinite(now.value) ? Math.round(now.value * 10 ** d) / 10 ** d : null, start_on: now ? now.on : today };
}
/**
 * A watched row's words: the value, the day, and what it was. For a blood marker it also says where a move sits
 * against that marker's usual swing, in the words In depth already uses (derive.ts swingRead). It never says whether a
 * move is good, names no cause, gives no date for another test, and joins the marker to no other number.
 */
export function watchedLine(row: WatchedRow, now: Reading | null, opts: { /** The words for a reading nothing is sending (derive/arrivals.ts pausedWords). */ paused?: string | null; /** The row was kept with the horizon, not added to it later. */ withHorizon?: boolean } = {}): WatchedLine {
  const pausedWords = opts.paused ?? null;
  const since = opts.withHorizon === false ? "you began to watch it" : "the horizon was set";
  const def = MARKER_BY_KEY[row.marker] ?? ({ key: row.marker, label: row.marker, unit: row.unit ?? "", decimals: 1, kind: "measured", cadence: "monthly", group: "body", how: "" } as MarkerDef);
  const blood = def.kind === "blood";
  const unit = now?.unit ?? row.unit ?? def.unit;
  const how = [def.hm ? "" : unit, blood ? "from your reports" : def.how].filter(Boolean).join(" · ");
  const base = { marker: row.marker, label: def.label, how };
  const start = row.start_value != null && Number.isFinite(Number(row.start_value)) ? Number(row.start_value) : null;
  if (!now) return { ...base, value: "—", words: pausedWords ?? (blood ? "No report on file holds it." : "No reading on file.") };
  const value = watchedValue(def, now);
  if (blood) {
    const on = `Report of ${dayMonthLong(now.on)}.`;
    if (start == null || !row.start_on) return { ...base, value, words: `${on} None was on file when ${since}.` };
    if (now.on <= row.start_on) return { ...base, value, words: `${on} No newer report is on file.` };
    const swing = swingRead(row.marker, start, now.value);
    const same = swing && (swing.state === "inside" || swing.state === "edge") ? " Two results can differ by this much with nothing changed." : "";
    return { ...base, value, words: `Report of ${dayMonthLong(now.on)}, after the one of ${dayMonthLong(row.start_on)}. ${swing ? swing.words : `It was ${watchedValue(def, { value: start })}.`}${same}` };
  }
  if (pausedWords) return { ...base, value, words: pausedWords };
  return { ...base, value, words: start == null ? `No reading was on file when ${since}.` : `Was ${fmtValue(def, start)} when ${since}.` };
}
