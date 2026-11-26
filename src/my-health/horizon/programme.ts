/**
 * Horizon as a programme, the arithmetic: what a goal ticks, what the page already reads about a person, the pace a
 * weight number implies against what guidelines describe, three signs for fat or muscle, and the week with a coach.
 * (Canvas "Verve, Horizon as a programme", 15 November 2026; built for test accounts, 16 November 2026.)
 *
 * Everything here is a function of the person's document and the horizon's rows. It sets no number and fills no
 * field: a goal ticks markers, and a figure from a study sits beside the field with its paper named
 * (../../data/programme.ts). The fitness doors and the held numbers live in ./derive.ts, which the pace reads.
 *
 * Pure, no DOM, no fetch; tests/programme.test.mjs runs it under node.
 */
import { addDays, daysBetween } from "../derive/format.ts";
import { weightSeries } from "../derive/lenses.ts";
import { ACTIVITIES, OWN_AT_MOST, OWN_LENGTH, type ActivityKey } from "../../data/activities.ts";
import { DAY_BY_KEY, DOORS, DOOR_BY_KEY, GOAL_BY_KEY, GRIP, WEIGHT, type DayKey, type DayKind, type Door, type GoalKey, type GoalMarker, type Mode } from "../../data/programme.ts";
import {
  MARKER_BY_KEY, dayMonthLong, daysWords, fitnessReadings, fmtValue, fullWeeksSoFar, horizonSpans, isTargetable, latestOf, round, typicalWeek, weekWords, windowWords,
  type DoorReading, type HorizonLike, type MarkerDef, type MarkerKey, type Person, type Reading, type Target,
} from "./derive.ts";

// ── what a horizon keeps about its programme (horizons.programme) ──

export type Writer = "guide" | "coach" | "both";
export type Programme = {
  v: 1; goal: GoalKey;
  /** What the person wants, in their words or the page's (the way in, question 1). Shown above the numbers. */
  aims: string[];
  /** What gets in the way (question 3): keys of BARRIERS. */
  barriers: string[];
  /** The days they can train, 0 for Monday to 6 for Sunday. */
  days: number[];
  place: "home" | "gym" | "both" | null;
  writer: Writer;
  /**
   * The day the horizon was set for (board 14, 17 November 2026): its kind only. A name the person gave the day is not
   * here, because a coach reads this row. It is kept where only its owner reads it (horizon_days).
   */
  day?: { kind: DayKey } | null;
  /**
   * The activities the person ticked, for the week's ideas (board 08 of "Verve, the plan you follow", 26 November 2026;
   * ../../data/activities.ts). Null until they tick anything: the ideas then start from what their sessions say
   * (./lightWeek.ts chosenOf). Nothing here changes what a week asks.
   */
  activities?: ActivityKey[] | null;
  /** Activities in the person's own words: a few, and short. */
  own?: string[];
};
const GOAL_KEYS = new Set<string>(["lose_weight", "build_fitness", "hold", "marathon", "own"]);
const strings = (x: unknown, max: number): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim().slice(0, 80)).slice(0, max) : []);
/** A stored programme read back; null for a horizon set before the programme, or a row that holds something else. */
export function parseProgramme(x: unknown): Programme | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  if (!GOAL_KEYS.has(String(r.goal))) return null;
  const days = Array.isArray(r.days) ? [...new Set(r.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
  return { v: 1, goal: r.goal as GoalKey, aims: strings(r.aims, 6), barriers: strings(r.barriers, 6), days,
    place: r.place === "home" || r.place === "gym" || r.place === "both" ? r.place : null,
    writer: r.writer === "coach" || r.writer === "both" ? r.writer : "guide",
    day: dayOf(r),
    // absent on a horizon set before 26 November 2026, and until the person ticks anything
    activities: Array.isArray(r.activities) ? ACTIVITIES.filter((a) => (r.activities as unknown[]).includes(a.key)).map((a) => a.key) : null,
    own: strings(r.own, OWN_AT_MOST).map((s) => s.slice(0, OWN_LENGTH)) };
}
/** The day a stored programme was set for; null when it was set for a length of time. */
function dayOf(r: Record<string, unknown>): { kind: DayKey } | null {
  const d = r.day && typeof r.day === "object" ? (r.day as Record<string, unknown>).kind : null;
  return typeof d === "string" && DAY_BY_KEY[d] ? { kind: d as DayKey } : null;
}
/** The kind of day a horizon was set for, read from horizons.programme; null for any other horizon. */
export const dayKindOf = (programme: unknown): DayKind | null => { const k = parseProgramme(programme)?.day?.kind; return k ? DAY_BY_KEY[k] ?? null : null; };
/**
 * A day, counted from today (board 14): the days to it, the full weeks a horizon set today would hold, and the short
 * weeks at either end that are shown and never judged. Null for a day that is not ahead of today.
 */
export function dayCount(today: string, on: string): { days: number; full: number; short: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || on <= today) return null;
  const spans = horizonSpans({ starts_on: today, ends_on: on });
  return { days: daysBetween(today, on), full: spans.filter((s) => s.full).length, short: spans.filter((s) => !s.full).length };
}
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── a goal's draft: the markers it ticks, never a number ──

export type DraftRow = { marker: MarkerKey; def: MarkerDef; mode: Mode;
  /** Nothing is sending this reading from the person's devices: the row is shown and says so, and cannot be ticked. */
  missing: boolean };
/**
 * The markers a goal starts a person with. A marker that is out of Horizon (blood) or one the catalogue does not hold
 * is left out; one nothing is sending is kept and marked, so the person sees what the goal would read.
 */
export function goalDraft(goal: GoalKey, canFollow: (marker: MarkerKey) => boolean = () => true, adds: GoalMarker[] = []): DraftRow[] {
  const g = GOAL_BY_KEY[goal];
  if (!g) return [];
  // a day adds markers to the goal's own (board 14); one the goal already holds is not listed twice
  const markers = [...g.markers, ...adds.filter((a) => !g.markers.some((m) => m.marker === a.marker))];
  return markers.flatMap((m) => {
    const def = MARKER_BY_KEY[m.marker];
    if (!def || !isTargetable(m.marker)) return [];
    return [{ marker: def.key, def, mode: m.mode, missing: !canFollow(def.key) }];
  });
}
/** The words on a field for each way of holding a number. */
export const MODE_WORDS: Record<Mode, string> = { reach: "I want", floor: "at least", ceiling: "at most", band: "between", watch: "watched" };

// ── what the page already reads (rule B: measured before asked) ──

export type OnFile = { key: string; label: string; value: string | null; from: string;
  /** What the person can do about a reading that is missing or old. */ action?: { label: string; href: string } | null };
const dated = (r: Reading | null) => (r ? dayMonthLong(r.on) : "");
/** The readings a set-up lays out before it asks anything: each with where it came from, and what is not on file. */
export function alreadyReads(person: Person, today: string): OnFile[] {
  const tw = typicalWeek(person, today);
  const f = startingReading(person, today);
  const door = f?.door ? DOOR_BY_KEY[f.door] : null;
  const newest = fitnessReadings(person).slice(-1)[0] ?? null;
  // a newer reading by a less sure method is named beside it, never mixed in
  const also = f && newest && newest.family !== f.family && newest.on > f.on ? ` Also on file: ${newest.door ? DOOR_BY_KEY[newest.door].title.replace(/^./, (c) => c.toLowerCase()) : "another reading"}, ${fmtValue(MARKER_BY_KEY.mets, newest.value)} on ${dayMonthLong(newest.on)}.` : "";
  const minutes = tw.zone2 + tw.harder;
  const steps = latestOf("steps", person, today), weight = latestOf("weight", person, today), waist = latestOf("waist", person, today), grip = latestOf("grip", person, today);
  const weeks = `The last eight full weeks, from your sessions${tw.weeks_read < 8 ? ` (${tw.weeks_read} on file)` : ""}`;
  const has = tw.weeks_read > 0;
  return [
    { key: "fitness", label: "Fitness", value: f ? `${fmtValue(MARKER_BY_KEY.mets, f.value)} METs` : null,
      from: f ? `${door ? door.title : "A reading on file"}, ${dated(f)}${door ? ` · ${door.error}` : ""}.${also}` : "No test on file. Six minutes of walking gives you one.",
      action: { label: f ? "Test again" : "Find your number", href: "/sheet/" } },
    { key: "week", label: "A typical week", value: has ? `${fmtValue(MARKER_BY_KEY.zone2_week, minutes)} min${tw.dose != null ? ` · ${fmtValue(MARKER_BY_KEY.dose, tw.dose)} MET-min` : ""}` : null, from: has ? `${weeks}: zone 2 and harder minutes, ${fmtValue(MARKER_BY_KEY.strength_week, tw.aerobic)} aerobic ${round(tw.aerobic, 0) === 1 ? "session" : "sessions"}` : "No full week of sessions on file yet." },
    { key: "zone2", label: "Of which, zone 2", value: has ? `${fmtValue(MARKER_BY_KEY.zone2_week, tw.zone2)} min` : null, from: has ? "The same weeks" : "" },
    { key: "strength", label: "Strength", value: has ? `${fmtValue(MARKER_BY_KEY.strength_week, tw.strength)} ${round(tw.strength, 0) === 1 ? "session" : "sessions"} a week` : null, from: has ? "The same weeks" : "" },
    { key: "steps", label: "Steps", value: steps ? `${fmtValue(MARKER_BY_KEY.steps, steps.value)} a day` : null, from: steps ? `Seven-day average, ${windowWords(steps) ?? dated(steps)}` : "Nothing is sending steps." },
    { key: "weight", label: "Weight", value: weight ? `${fmtValue(MARKER_BY_KEY.weight, weight.value)} kg` : null, from: weight ? `The scale, ${dated(weight)}` : "No weighing on file." },
    { key: "waist", label: "Waist", value: waist ? `${fmtValue(MARKER_BY_KEY.waist, waist.value)} cm` : null, from: waist ? `The tape, ${dated(waist)}` : "A tape, at the navel. One minute." },
    { key: "grip", label: "Grip strength", value: grip ? `${fmtValue(MARKER_BY_KEY.grip, grip.value)} kg` : null, from: grip ? `A hand dynamometer, ${dated(grip)}` : "It needs a hand dynamometer, and can be left out." },
  ];
}

// ── fitness by its door ──

/** Each door's latest reading, the surest door first: what the set-up offers to keep a fitness number to. */
export function doorsOnFile(person: Person): { door: Door; reading: DoorReading }[] {
  const all = fitnessReadings(person);
  return DOORS.flatMap((door) => { const r = [...all].reverse().find((x) => x.door === door.key); return r ? [{ door, reading: r }] : []; }).sort((a, b) => a.door.rank - b.door.rank || b.reading.on.localeCompare(a.reading.on));
}
/** How old a fitness reading may be and still be the one a new horizon starts from, in days. */
export const FRESH_DAYS = 90;
/**
 * The reading a new fitness target starts from: the surest door that has a reading in the last ninety days, and that
 * door's latest reading. With nothing that recent, the latest reading of any method. The person can choose another.
 */
export function startingReading(person: Person, today: string): DoorReading | null {
  const all = fitnessReadings(person);
  const fresh = doorsOnFile(person).find((d) => daysBetween(d.reading.on, today) <= FRESH_DAYS);
  return fresh?.reading ?? all[all.length - 1] ?? null;
}
/** The method a new fitness target is kept to (a door's key, or the method's own name where it has no door). */
export const startingMethod = (person: Person, today: string): string | null => startingReading(person, today)?.family ?? null;
/** The small line under a fitness row: its door and how far off that door can be. "six-minute walk · about 1 MET either way". */
export const doorLine = (door: string | null | undefined): string => { const d = door ? DOOR_BY_KEY[door] : null; return d ? `${d.title.replace(/^(A|Your) /, "").replace(/^./, (c) => c.toLowerCase())} · ${d.error}` : ""; };

// ── weight: the pace a number implies, beside what guidelines describe ──

export type WeightRead = "none" | "gain" | "under" | "inside" | "faster" | "steep";
export type WeightPace = {
  /** Kilos to lose (negative for a gain), the weeks to the date, kilos a week, and the share of today's weight. */
  loss: number; weeks: number; perWeek: number; share: number; read: WeightRead;
  /** The sentence under the field. */ words: string;
  /** Where the pace sits on a track from 0 to 1.5 kg a week (0 to 1); the guideline's weekly figure is the stretch from a third to two thirds. */
  mark: number;
};
const kg = (v: number) => round(Math.abs(v), 1).toFixed(1);
/**
 * A weight number read as a pace. The arithmetic is the person's own (the number they typed, today's weighing, the
 * weeks to their date); the two figures it is set beside are a guideline's, each named. Nothing here says what to
 * aim for. A number faster than the guidelines describe is still theirs to keep, and the sentence says whose it is.
 */
export function weightPace(nowKg: number, targetKg: number, weeks: number): WeightPace {
  const w = Math.max(1, Math.round(weeks));
  const loss = round(nowKg - targetKg, 1), perWeek = loss / w, share = nowKg > 0 ? (loss / nowKg) * 100 : 0;
  const span = `${w} week${w === 1 ? "" : "s"}`;
  const base = { loss, weeks: w, perWeek, share, mark: Math.max(0, Math.min(1, perWeek / WEIGHT.steep)) };
  if (loss === 0) return { ...base, read: "none", words: "Already there; the horizon keeps it in view." };
  if (loss < 0) return { ...base, read: "gain", mark: 0, words: `A gain of ${kg(loss)} kg in ${span} is ${round(Math.abs(perWeek), 2).toFixed(2)} kg a week. The guidelines read here describe loss, so nothing is set beside it.` };
  const rate = round(perWeek, 2);
  // the guideline's share is "within six months": a longer horizon is read on the part of it that falls in the first six
  const share6 = w > WEIGHT.withinWeeks ? share * (WEIGHT.withinWeeks / w) : share;
  const lead = `${kg(loss)} kg in ${span} is ${rate.toFixed(2)} kg a week, and ${round(share, 1).toFixed(1)}% of your weight.`;
  const fastWeek = rate > WEIGHT.weeklyHigh, overShare = round(share6, 1) > WEIGHT.shareHigh;
  const guide = `the ${WEIGHT.shareLow} to ${WEIGHT.shareHigh}% in six months`;
  if (fastWeek || overShare) {
    const what = fastWeek && overShare ? `That is faster than the ${WEIGHT.weeklyLow} to ${WEIGHT.weeklyHigh} kg a week a guideline states, and more than ${guide}.`
      : fastWeek ? `That is faster than the ${WEIGHT.weeklyLow} to ${WEIGHT.weeklyHigh} kg a week a guideline states.`
      : `That is more than ${guide} the US guideline describes.`;
    const steep = rate > WEIGHT.steep;
    return { ...base, read: steep ? "steep" : "faster", words: `${lead} ${what}${steep ? ` Above ${WEIGHT.steep} kg a week the risk of gallstones climbs steeply.` : ""} Verve sets no number. This one is yours to weigh with your doctor.` };
  }
  if (round(share6, 1) < WEIGHT.shareLow) return { ...base, read: "under", words: `${lead} The US guideline describes ${WEIGHT.shareLow} to ${WEIGHT.shareHigh}% within six months. Your number asks for less than that.` };
  return { ...base, read: "inside", words: `${lead} The US guideline describes ${WEIGHT.shareLow} to ${WEIGHT.shareHigh}% within six months. Your number sits inside it.` };
}

// ── fat or muscle: three signs side by side, and no verdict ──

type Pt = { d: string; v: number };
const series = (person: Person, key: string): Pt[] => ((person.by.get(key) ?? []) as Pt[]).filter((p) => Number.isFinite(p.v)).slice().sort((a, b) => a.d.localeCompare(b.d));
/** A marker at the start of a horizon (the last reading on or before its first day, or the first within two weeks after) and now, when a newer one is on file. */
function startAndNow(pts: Pt[], startsOn: string): { start: Pt | null; now: Pt | null } {
  const before = pts.filter((p) => p.d <= startsOn);
  const start = before[before.length - 1] ?? pts.find((p) => p.d > startsOn && daysBetween(startsOn, p.d) <= 14) ?? null;
  const last = pts[pts.length - 1] ?? null;
  return { start, now: start && last && last.d > start.d ? last : null };
}
export type Sign = { key: "waist" | "strength" | "scale"; title: string; figure: string; words: string; cites: string[] };
export type Signs = {
  /** The line above the three: where the weight is against where it started. Null without two weighings. */
  weight: string | null;
  signs: Sign[];
  /** The three read together, in one paragraph, and where the page stops. */
  read: string; stops: string;
};
/**
 * The three signs a weight horizon is read by (board 07). Each is the person's own reading at the start and now; the
 * scale's muscle figure is a trend across months and a move inside the scale's own error is said to be that. The
 * page never says the loss is fat: the papers are plain that no home reading shows muscle directly.
 */
export function threeSigns(h: HorizonLike, targets: Target[], person: Person, today: string): Signs {
  // the one weight series the page reads everywhere (derive/lenses.ts)
  const wt = startAndNow(weightSeries(person.weights), h.starts_on);
  const moved = (a: number, b: number, unit: string, d = 1) => { const x = round(b - a, d); return x === 0 ? "has not moved" : `is ${x < 0 ? "down" : "up"} ${Math.abs(x).toFixed(d)} ${unit}`; };
  const weight = wt.start && wt.now ? `Weight ${moved(wt.start.v, wt.now.v, "kg")}.` : null;

  const ws = startAndNow(series(person, "waist_cm"), h.starts_on);
  const waist: Sign = { key: "waist", title: "The waist", cites: [WEIGHT.cites.waist],
    figure: ws.start && ws.now ? `${round(ws.start.v, 0)} → ${round(ws.now.v, 0)} cm` : ws.start ? `${round(ws.start.v, 0)} cm` : "No tape reading",
    words: ws.start && ws.now ? `The waist ${moved(ws.start.v, ws.now.v, "cm", 0)}. A waist that falls with the weight is the plainest sign the loss is fat.`
      : ws.start ? `No tape reading since the start, ${dayMonthLong(ws.start.d)}. A tape at the navel, once a month.` : "A tape at the navel, once a month. With none on file this sign cannot be read." };

  const ch = startAndNow(series(person, "chair_stand_seconds"), h.starts_on), gr = startAndNow(series(person, "handgrip_kg"), h.starts_on);
  const strengthTarget = targets.find((t) => t.marker === "strength_week")?.target_value ?? null;
  const done = fullWeeksSoFar(person, "strength_week", h, today);
  const kept = done.length ? { k: done.filter((w) => (w.v ?? 0) >= Math.max(1, strengthTarget ?? 1)).length, n: done.length } : null;
  const latestChair = ch.now ?? ch.start, latestGrip = gr.now ?? gr.start;
  const gripHeld = gr.start && gr.now ? gr.start.v - gr.now.v < GRIP.noChangeKg : null;
  const parts: string[] = [];
  if (gr.start && gr.now) parts.push(gripHeld ? `Grip is held: ${round(gr.start.v, 0)} to ${round(gr.now.v, 0)} kg, and a move under ${GRIP.noChangeKg} kg is not a change.` : `Grip ${moved(gr.start.v, gr.now.v, "kg", 0)}, more than two readings differ by.`);
  if (ch.start && ch.now) parts.push(`Five chair rises: ${round(ch.start.v, 1).toFixed(1)} to ${round(ch.now.v, 1).toFixed(1)} seconds.`);
  if (kept) parts.push(`${strengthTarget != null ? `${fmtValue(MARKER_BY_KEY.strength_week, strengthTarget)} strength ${strengthTarget === 1 ? "session" : "sessions"}` : "A strength session"} done in ${kept.k} of ${kept.n} full week${kept.n === 1 ? "" : "s"}.`);
  const strength: Sign = { key: "strength", title: "Strength kept", cites: [WEIGHT.cites.strength],
    figure: [latestChair ? `${round(latestChair.v, 1).toFixed(1)} s` : "", latestGrip ? `${round(latestGrip.v, 0)} kg` : ""].filter(Boolean).join(" · ") || (kept ? `${kept.k} of ${kept.n} weeks` : "No test on file"),
    words: `${parts.join(" ") || "No chair-rise or grip reading on file, and no full week yet."} On a diet alone leg strength fell 7.5%, so the legs are the reading to watch.` };

  const lean = series(person, "alm_kg").length ? series(person, "alm_kg") : series(person, "ffm_kg");
  const sc = startAndNow(lean, h.starts_on);
  const apart = sc.start && sc.now ? daysBetween(sc.start.d, sc.now.d) : 0;
  const delta = sc.start && sc.now && apart >= 28 ? round(sc.now.v - sc.start.v, 1) : null;
  const across = `across ${Math.max(1, Math.round(apart / 7))} weeks`;
  const scale: Sign = { key: "scale", title: "The scale's muscle figure", cites: WEIGHT.cites.scale, figure: "trend only",
    words: delta == null ? `Two readings at least four weeks apart are needed. For one person's change, a home scale can differ from a scan by about ${WEIGHT.scaleErrorKg} kg either way.`
      : Math.abs(delta) < WEIGHT.scaleErrorKg ? `It moved ${Math.abs(delta).toFixed(1)} kg ${across}. That is inside what a home scale can tell: about ${WEIGHT.scaleErrorKg} kg either way against a scan.`
      : `It is ${delta < 0 ? "down" : "up"} ${Math.abs(delta).toFixed(1)} kg ${across}, more than the ${WEIGHT.scaleErrorKg} kg a home scale can differ from a scan by.` };

  // the horizon's own count of its weeks, as the header carries it
  const where = weekWords(h, today);
  const read = [`${where.charAt(0).toUpperCase()}${where.slice(1)}.`, weight ?? "No weighing since the start.",
    ws.start && ws.now ? `The waist ${moved(ws.start.v, ws.now.v, "cm", 0)}.` : "", gripHeld === true ? "Grip is held." : "",
    kept ? `Strength was done in ${kept.k} of ${kept.n} full week${kept.n === 1 ? "" : "s"}.` : "",
    delta != null ? (Math.abs(delta) < WEIGHT.scaleErrorKg ? "The scale's muscle figure shows no move it can tell." : `The scale's muscle figure is ${delta < 0 ? "down" : "up"} ${Math.abs(delta).toFixed(1)} kg.`) : ""].filter(Boolean).join(" ");
  return { weight, signs: [waist, strength, scale], read, stops: WEIGHT.stops };
}

// ── the week with a coach (board 08) ──

/** One week of a horizon as the person and the coach keep it (horizon_weeks). */
export type WeekNote = {
  horizon_id: string; week_start: string;
  /** The person's one-tap answer when the week fell short: a key of WAYS. A note for the call; it changes nothing about how the week is read. */ way: string | null;
  /** No longer written or read (17 November 2026): a week is set aside by a pause, kept on the horizon's own row. The column stays. */ away: boolean;
  call_at: string | null; call_kept: boolean | null;
  /** Up to three lines kept after the call, written by the coach and read by both. */ lines: string[];
  lines_by: string | null; updated_at?: string;
};
export const noteFor = (notes: WeekNote[], weekStart: string): WeekNote | null => notes.find((n) => n.week_start === weekStart) ?? null;
/**
 * The calls kept so far: one for each full week of the horizon that has ended. A paused week is not a full week
 * (derive.ts horizonSpans), so it has no call and is not counted; `paused` says how many of the weeks behind were
 * set aside. Nothing else about a call is scored.
 */
export function callsKept(notes: WeekNote[], h: HorizonLike, today: string): { kept: number; of: number; paused: number } {
  const spans = horizonSpans(h);
  const counted = spans.filter((s) => s.full && s.to < today);
  return { kept: counted.filter((s) => noteFor(notes, s.from)?.call_kept === true).length, of: counted.length, paused: spans.filter((s) => s.paused && s.to < today).length };
}
/**
 * The week a call sheet is for: the one today is in, and the week of seven days before it, each by its days. Either
 * may be a paused one, and says so: a paused week is shown and not judged.
 */
export function sheetWeeks(h: HorizonLike, today: string): { thisWeek: { from: string; to: string; words: string; n: number | null; full: boolean; paused: boolean } | null; lastWeek: { from: string; to: string; words: string; n: number | null; paused: boolean } | null } {
  const spans = horizonSpans(h);
  const cur = spans.find((s) => today >= s.from && today <= s.to) ?? null;
  const prev = [...spans].reverse().find((s) => s.to < today && s.days === 7) ?? null;
  return { thisWeek: cur ? { from: cur.from, to: cur.to, words: daysWords(cur.from, cur.to), n: cur.week, full: cur.full, paused: cur.paused } : null,
    lastWeek: prev ? { from: prev.from, to: prev.to, words: daysWords(prev.from, prev.to), n: prev.week, paused: prev.paused } : null };
}
/** The Monday a note is kept under for a day: the week's own first day inside the horizon. */
export const weekStartOf = (h: HorizonLike, day: string): string | null => horizonSpans(h).find((s) => day >= s.from && day <= s.to)?.from ?? null;
// ── the trainer's Monday list (board 11): one row for each client who shares a programme horizon ──

export type MondayRow = {
  /** "Build fitness · week 4 of 13" */ horizon: string;
  /** "Zone 2 a week: 48 of 60", "All lines done", "Paused", "No check-in yet" */ lastWeek: string;
  /** "Call today, 18:30", "Call Wed 18 Nov, 18:30", "No call set" */ call: string;
  /** The call is today and has not been marked kept: the row a trainer starts from. */ today: boolean;
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
/**
 * A client's horizon as one row. Last week is read from what the horizon already holds: a week that was paused, or the
 * lines of the latest Monday check-in (what the plan asked and what the week did). Nothing about the person's page
 * is read that they did not share.
 */
export function mondayRow(h: HorizonLike & { title?: string; programme?: unknown }, notes: WeekNote[], adherence: { label: string; done: number | null; of: number | null }[] | null, today: string): MondayRow {
  const prog = parseProgramme(h.programme);
  const goal = prog ? GOAL_BY_KEY[prog.goal]?.title ?? "Own targets" : (h.title ?? "Horizon").split(",")[0];
  const { thisWeek, lastWeek } = sheetWeeks(h, today);
  const cur = thisWeek ? noteFor(notes, thisWeek.from) : null;
  const short = (adherence ?? []).find((a) => a.done != null && a.of != null && a.done < a.of);
  const last = !lastWeek ? "No full week yet" : lastWeek.paused ? "Paused" : adherence == null ? "No check-in yet" : short ? `${short.label}: ${short.done} of ${short.of}` : adherence.length ? "All lines done" : "No plan line to read";
  const at = cur?.call_at ?? null;
  const isToday = !!at && new Date(at).toLocaleDateString("en-CA") === today;
  const call = thisWeek?.paused ? "No call: paused" : !at ? "No call set" : cur?.call_kept ? `Kept, ${new Date(at).toLocaleDateString("en-GB", { weekday: "short" })}` : isToday ? `Call today, ${clock(at)}` : `Call ${new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${clock(at)}`;
  return { horizon: `${goal} · ${weekWords(h, today)}`, lastWeek: last, call, today: isToday && cur?.call_kept !== true };
}
export { addDays };
