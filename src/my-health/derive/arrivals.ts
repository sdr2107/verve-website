/**
 * Only what your device shares, on the website (14 Nov 2026).
 *
 * The app works out which readings arrive from the person's devices and
 * which do not (its lib/arrivals), and sends that list with its week row
 * (web_weeks.reading_arrivals, the app's arrivalList). This file reads the
 * list and answers one question for every row a device feeds: is this
 * reading on the person's screens? The website keeps no idea of its own
 * about what a WHOOP or a watch sends: the keys decide a row, and the words
 * (why a reading is missing, what a device is called) are the app's, printed
 * as given.
 *
 * With no list (the app has not sent one: an older build, Back up watch
 * readings off, or the column not yet in the database) nothing is left off
 * and every page behaves as before. Under the app's "Show them anyway" the
 * same. A row that HOLDS a figure is never dropped, whatever the list says:
 * the figure is the fact.
 *
 * Pure.
 */

export type ArrivalRow = { key: string; label: string; how?: string; when?: string; why?: string; /** The day a stopped reading last arrived: "24 Oct". */ last?: string };
export type ArrivalDevice = { name: string; phone: boolean; readings: string[]; sent: string; quiet: boolean };
export type ArrivalList = {
  v: 1;
  /** The local day the app made the list: "2026-11-14". */
  day: string;
  /** "Apple Health" · "Health Connect". */
  store: string;
  on: ArrivalRow[];
  off: ArrivalRow[];
  devices: ArrivalDevice[];
  /** The line at the foot of the cards, as the app says it; null with nothing left off. */
  foot: string | null;
  show_all: boolean;
};

const isList = (x: any): x is ArrivalList =>
  !!x && typeof x === "object" && x.v === 1 && Array.isArray(x.on) && Array.isArray(x.off) && Array.isArray(x.devices);

/** The app's list, from the newest week row it wrote that carries one; null when it has sent none. */
export function arrivalsOf(weeks: readonly any[] | null | undefined): ArrivalList | null {
  const rows = (weeks ?? [])
    .filter((w) => w && w.source === "sync" && isList(w.reading_arrivals))
    .sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  return rows.length ? (rows[rows.length - 1].reading_arrivals as ArrivalList) : null;
}

/** The readings left off the screens: empty with no list and under "Show them anyway". */
export function leftOff(list: ArrivalList | null | undefined): Set<string> {
  if (!list || list.show_all) return new Set();
  return new Set(list.off.map((r) => r.key));
}

/**
 * The reading behind a row on the Overview and its opened sections, by the
 * row's label. A row not named here is the person's own (blood pressure,
 * weight, a lab result, the dose, the zones, strength) or a figure worked out
 * from sleep hours that arrive, and is never dropped.
 */
export const ROW_READING: Record<string, string> = {
  "Resting heart rate": "rhr",
  "Sleep": "sleepHours",
  "Sleep efficiency": "sleepEfficiency",
  "HRV": "hrv",
  "Breathing": "breathing",
  "Blood oxygen": "spo2",
  "Wrist temperature": "temp",
  "In bed": "sleepEfficiency",
  "Efficiency": "sleepEfficiency",
  "Deep · REM": "sleepStages",
  "1-min recovery": "hrr",
  "Recovery": "hrr",
  "Activity level": "pal",
  "Sitting, average day": "sitting",
  "Sitting": "sitting",
  "Background movement": "background",
  "Steps": "steps",
  "Cadence": "cadence",
};

const DASH = "—";

/** The rows to draw: one that holds no figure, for a reading on the left-off side of the list, is dropped. */
export function dropUnsent<T extends { label: string; value: string }>(rows: readonly T[], off: ReadonlySet<string>): T[] {
  if (off.size === 0) return [...rows];
  return rows.filter((r) => {
    const key = ROW_READING[r.label];
    return !key || !off.has(key) || (r.value !== DASH && r.value !== "");
  });
}

/** Whether one reading is on the screens. */
export const shows = (off: ReadonlySet<string>, key: string): boolean => !off.has(key);

// ── Horizon: only goals that can be followed ─────────────────────────────────

/**
 * The reading behind a Horizon goal (horizon/derive MARKERS, by key). A goal
 * not named here does not wait for a device: the fitness test, the dose and
 * the other figures of logged sessions, blood pressure, weight, the body's
 * measures and the blood markers.
 */
export const HORIZON_READING: Record<string, string> = {
  steps: "steps", background: "background", sitting: "sitting", pal: "pal", cadence: "cadence",
  sleep: "sleepHours", sri: "sleepHours",
  rhr: "rhr", hrv: "hrv", hrr: "hrr", breathing: "breathing", spo2: "spo2",
};

/** Whether a goal on this marker can be followed: its reading arrives, or it does not wait for a device. */
export function followable(off: ReadonlySet<string>, marker: string): boolean {
  const key = HORIZON_READING[marker];
  return !key || !off.has(key);
}

/**
 * The words on a goal already set whose reading has stopped arriving. The
 * goal is kept; it says it is paused, and since when if the app knows.
 * Null for a goal that can be followed.
 */
export function pausedWords(list: ArrivalList | null | undefined, marker: string): string | null {
  const off = leftOff(list);
  if (followable(off, marker)) return null;
  const row = list!.off.find((r) => r.key === HORIZON_READING[marker]);
  return row?.last ? `Paused · nothing has arrived since ${row.last}` : "Paused · nothing is sending this reading";
}
