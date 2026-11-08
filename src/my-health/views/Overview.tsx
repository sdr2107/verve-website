/**
 * The Overview: the app's six cards, this week so far, as views of the
 * document (canvas "My health, redesigned", 8 Nov 2026, boards 2, 3 and 12).
 *
 *   line      one sentence of figures under the greeting, fixed height
 *   pointer   the Guide's one line: when it read the week, how much it raised
 *   cards     Fitness · Vitals · Sleep · Exertion · Movement · Body, in the
 *             app's order; each a title, one figure in mono with its unit,
 *             the band in words, three to five rows, the writer line
 *   opened    a card opens IN PLACE: the other five shrink to a strip that
 *             stays put, the open one fills the width with its chapter rows,
 *             its markers as tiles and the chart of one of them. The hash
 *             carries the card (#overview-movement).
 *
 * Every figure comes from the derive layer: the app's week row where it
 * wrote one, the app's day rows, the app's helpers' rules. A row with
 * nothing reads a dash and a short reason, never a zero. Nothing animates
 * after load; a card opening slides once, 160 ms.
 */
import { render } from "preact";
import { derived, person, section, setSection, openMarkerKey, openRange, openYear, focusTile, fitUnit, setFitUnit, latestRead, actions, CARD_KEYS, type CardKey } from "../state.ts";
import { addDays, daysBetween, dayWord, esc, fmt1, fmtDay, fmtSleepMin, mondayOf, monthOf, plural, round0, todayStr } from "../derive/format.ts";
import { labRowsFrom, methodLabel, MAXIMAL } from "../derive/markers.ts";
import { activitySummary, actsByDay, fitnessSummary, doseReason, storeOf } from "../derive/activity.ts";
import { bodyHeadline, bodyListOf } from "../derive/body.ts";
import { sleepHeartSummary } from "../derive/heart.ts";
import { RANGE_LABEL, SHELVES, alongsideHtml, chartSvg, drawnFor, workoutsListHtml, type Marker, type Rng } from "../derive/lenses.ts";
import { backgroundOf, dayBars, efficiencyOf, fmtHMin, fmtSigned1, inBedWindow, latestWith, meanOver, rowOn, stagesOf, weekZones, wristTemp, writerLine, writerOf } from "../derive/signals.ts";
import { VO2_CAVEAT, metsOfTest, tierIndexFromCategory, tierIndexOf, tierRangeWords, tierRowFor, tierShort, tierWords, vo2OfTest } from "../derive/fitness.ts";
import { REMNANT_LABEL } from "../derive/lipids.ts";

/** The 14-day dots, the week table and the sources strip: off the Overview since 8 Nov 2026; the table goes to In depth in stage 2. */
export const SHOW_OLD_OVERVIEW = false;

type Tone = "neutral" | "good" | "caution" | "concern";
type Row = { label: string; value: string; unit?: string; note?: string; tone?: Tone };
type Card = {
  key: CardKey; title: string;
  figure: string; unit: string;
  band: { text: string; tone: Tone };
  rows: Row[];
  /** The rows the opened card adds under the card's own. */
  more: Row[];
  writer: string;
  /** The lenses this card opens to, in order. */
  markers: string[];
  /** The open card's heading and its eyebrow. */
  heading: string; eyebrow: string;
  /** Movement: the week against the goal, 0 to 1. */
  progress?: number | null;
};
const TONE_TEXT: Record<Tone, string> = { neutral: "text-text-2", good: "text-good", caution: "text-caution", concern: "text-concern" };
const CARD_TITLE: Record<CardKey, string> = { fitness: "Fitness", vitals: "Vitals", sleep: "Sleep", exertion: "Exertion", movement: "Movement", body: "Body" };
const CARD_MARKERS: Record<CardKey, string[]> = {
  fitness: ["mets", "vo2"],
  vitals: ["rhr", "hrv", "breathing", "spo2", "wrist_temp", "bp"],
  sleep: ["sleep", "sri", "bedtime_sd", "wakes", "deep", "rem"],
  exertion: ["sessions", "hrr", "pal", "sitting", "standing", "vig", "active_kcal", "resting_kcal"],
  movement: ["dose", "z2", "z3", "z1", "strength", "background", "steps", "cadence", "distance", "met"],
  body: [],
};
const DASH = "—";
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const longDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const dayMonth = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });

/** The six cards, their opened rows and the line under the greeting, from the derived person. */
function cardsOf(d: NonNullable<typeof derived.value>, self: boolean, unit: "mets" | "vo2"): { cards: Card[]; line: string } {
  const today = todayStr(), monday = mondayOf(new Date());
  const you = self ? "your" : "their", your = self ? "Your" : "Their";
  const heart = sleepHeartSummary(d.signals, today);
  const act = d.weeks.length || d.acts.length ? activitySummary(d.weeks, d.acts, d.goal, today, monday) : null;
  const fit = fitnessSummary(d.crf, today);
  const by = d.by;
  const writer = writerOf(d.signals, today);
  const store = writerLine(writer, storeOf(d.acts, today));
  const cards: Card[] = [];
  const dayRow = (day: string) => rowOn(d.signals, day);

  // ── Fitness: one card, two units (board 12) ──
  {
    const l = fit.latest;
    const mets = metsOfTest(l), vo2 = vo2OfTest(l);
    const row = tierRowFor(d.profile?.age, d.profile?.sex);
    const tier = l ? (tierIndexFromCategory(l.category) ?? (mets != null ? tierIndexOf(mets, row) : null)) : null;
    const prevMets = metsOfTest(fit.prevSame), prevVo2 = vo2OfTest(fit.prevSame);
    const change = unit === "mets" ? (mets != null && prevMets != null ? mets - prevMets : null) : (vo2 != null && prevVo2 != null ? vo2 - prevVo2 : null);
    const method = l ? methodLabel(l.method) : "";
    const rows: Row[] = [];
    if (l) rows.push(unit === "mets" ? { label: "As VO₂max", value: vo2 != null ? fmt1(vo2) : DASH, unit: "mL/kg/min" } : { label: "As METs", value: mets != null ? fmt1(mets) : DASH, unit: "METs" });
    if (l && fit.prevSame) rows.push({ label: `Change since ${monthOf(fit.prevSame.measured_on)}`, value: change == null ? DASH : fmtSigned1(change), unit: unit === "mets" ? "METs" : "mL/kg/min", tone: change != null && change > 0 ? "good" : "neutral" });
    else if (l) rows.push({ label: "Change", value: DASH, note: "first test of its method" });
    if (unit === "vo2" && l) rows.push({ label: "Estimate", value: "", note: VO2_CAVEAT });
    cards.push({
      key: "fitness", title: "Fitness",
      figure: l ? (unit === "mets" ? (mets != null ? fmt1(mets) : DASH) : (vo2 != null ? fmt1(vo2) : DASH)) : DASH,
      unit: l ? (unit === "mets" ? "METs" : "mL/kg/min") : "no test on file",
      band: l ? { text: tier != null ? tierWords(tier, self) : "no tier for this test", tone: "neutral" } : { text: "The app offers a test in six to twelve minutes", tone: "neutral" },
      rows, more: l ? [{ label: "Measured", value: fmtDay(l.measured_on), note: method }] : [],
      writer: l ? (MAXIMAL.has(String(l.method)) || /walk/.test(String(l.method)) ? `Verve's own test · ${method}` : sentence(method)) : "Verve's own test · no wearable needed",
      markers: CARD_MARKERS.fitness,
      heading: l ? `${unit === "mets" ? `${fmt1(mets!)} METs` : `${fmt1(vo2!)} mL/kg/min`}${tier != null ? `, ${tierWords(tier, self).toLowerCase()}` : ""}` : "No fitness test on file",
      eyebrow: `Fitness · ${l ? `last test ${fmtDay(l.measured_on)}` : "the app's test"}`,
    });
  }
  // ── Vitals: resting heart rate, HRV, breathing, oxygen, wrist temperature, the cuff's 30-day mean ──
  {
    const r = heart?.rhr, hv = heart?.hrv;
    const band = r?.latest == null ? { text: "Nothing from a wearable yet", tone: "neutral" as Tone }
      : r.baseline == null ? { text: `A normal needs 14 mornings; ${r.priors} so far`, tone: "neutral" as Tone }
      : r.status === "stronglyElevated" ? { text: `${r.delta} above ${you} usual`, tone: "concern" as Tone }
      : r.status === "elevated" ? { text: `${r.delta} above ${you} usual`, tone: "caution" as Tone }
      : r.status === "below" ? { text: `${Math.abs(r.delta!)} below ${you} usual`, tone: "neutral" as Tone }
      : { text: `${your} usual`, tone: "neutral" as Tone };
    const br = latestWith(d.signals, "breathing_rpm", today), ox = latestWith(d.signals, "spo2_pct", today);
    const wt = wristTemp(d.signals, today);
    const bpM = d.markerByKey("bp"), bpT = bpM?.tile ? bpM.tile() : null;
    const rows: Row[] = [
      { label: "HRV", value: hv?.latest != null ? String(hv.latest) : DASH, unit: hv?.latest != null ? "ms" : "", note: hv?.latest == null ? (hv?.absent ? "none from this writer" : "no nights yet") : hv.below ? "under your band" : "", tone: hv?.below ? "caution" : "neutral" },
      { label: "Breathing", value: br ? fmt1(Number(br.breathing_rpm)) : DASH, unit: br ? "/min" : "", note: br ? "" : "not written by this wearable" },
      { label: "Blood oxygen", value: ox ? round0(Number(ox.spo2_pct)) : DASH, unit: ox ? "%" : "", note: ox ? "" : "not written by this wearable" },
      { label: "Wrist temperature", value: wt ? (wt.delta ? fmtSigned1(wt.value) : fmt1(wt.value)) : DASH, unit: wt ? "°C" : "", note: wt ? (wt.delta ? "" : "against your own nights after 7") : "not written by this wearable" },
      { label: "Blood pressure, 30-day mean", value: bpT ? bpT.headline : DASH, unit: bpT ? "mmHg" : "", note: bpT ? (bpT.sub.startsWith("crisis") ? bpT.sub : "") : "no cuff readings", tone: bpT?.sub.startsWith("crisis") ? "concern" : "neutral" },
    ];
    cards.push({
      key: "vitals", title: "Vitals", figure: r?.latest != null ? String(r.latest) : DASH, unit: r?.latest != null ? "bpm resting" : "no resting rate yet", band, rows,
      more: [{ label: "Resting heart rate", value: r?.latest != null ? String(r.latest) : DASH, unit: "bpm", note: r?.latestDay ? (r.latestDay === today ? "this morning" : dayWord(r.latestDay)) : "" }],
      writer: store, markers: CARD_MARKERS.vitals,
      heading: r?.latest != null ? `${r.latest} bpm resting, ${band.text.toLowerCase()}` : "No resting heart rate yet",
      eyebrow: `Vitals · ${r?.latestDay ? longDay(r.latestDay) : "the mornings"}`,
    });
  }
  // ── Sleep: last night, the window, efficiency, regularity, the stages when the writer stages ──
  {
    const sl = heart?.sleep.last ?? null, usual = heart?.sleep.usual ?? null;
    const row = sl ? dayRow(sl.day) : null;
    const dd = sl && usual != null ? sl.min - usual : null;
    const band: Card["band"] = !sl ? { text: "Nothing from a wearable yet", tone: "neutral" }
      : usual == null ? { text: "A usual comes after seven nights", tone: "neutral" }
      : Math.abs(dd!) < 20 ? { text: `Usual for ${self ? "you" : "them"}`, tone: "neutral" }
      : dd! < 0 ? { text: `${fmtSleepMin(Math.abs(dd!))} under ${you} usual`, tone: sl.band === "short" ? "caution" : "neutral" }
      : { text: `${fmtSleepMin(dd!)} over ${you} usual`, tone: "neutral" };
    const eff = row ? efficiencyOf(row) : null, win = row ? inBedWindow(row) : null, st = row ? stagesOf(row) : null;
    const sri = latestWith(d.signals, "sri_30d", today);
    const rows: Row[] = [
      { label: "In bed", value: win ?? DASH, note: win ? "" : "no window from this writer" },
      { label: "Efficiency", value: eff != null ? String(eff) : DASH, unit: eff != null ? "%" : "", note: eff == null ? "needs the in-bed window" : eff < 85 ? "under the 85 % mark" : "", tone: eff != null && eff < 85 ? "caution" : "neutral" },
      { label: "Regularity, 30 days", value: sri ? round0(Number(sri.sri_30d)) : DASH, note: sri ? "" : "needs 30 nights" },
    ];
    if (st) rows.push({ label: "Deep · REM", value: `${st.deep != null ? fmtHMin(st.deep) : DASH} · ${st.rem != null ? fmtHMin(st.rem) : DASH}`, note: "this writer stages" });
    cards.push({
      key: "sleep", title: "Sleep", figure: sl ? fmtHMin(sl.min) : DASH, unit: sl ? (sl.day === today ? "last night" : `night of ${dayWord(sl.day)}`) : "no night yet", band, rows,
      more: [{ label: "Usual, 30 nights", value: usual != null ? fmtHMin(usual) : DASH }, { label: "Short nights, of 30", value: heart ? `${heart.sleep.shortNights} of ${heart.sleep.nights}` : DASH }],
      writer: sl ? `${store} · ${st ? "stages from this writer" : "no stages from this writer"}` : store, markers: CARD_MARKERS.sleep,
      heading: sl ? `${fmtHMin(sl.min)} last night, ${band.text.toLowerCase()}` : "No night on file",
      eyebrow: `Sleep · ${sl ? longDay(sl.day) : "the nights"}`,
    });
  }
  // ── Exertion: the week's sessions, the minute of recovery, the activity level, the sitting ──
  {
    const weekActs = [...actsByDay(d.acts)].filter(([x]) => x >= monday && x <= today);
    const n = weekActs.reduce((t, [, r]) => t + r.n, 0);
    const lastDay = act?.lastWorkoutDay ?? "";
    const h = heart?.hrr;
    const pal = latestWith(d.signals, "pal", today);
    const sit = meanOver(d.signals, "sedentary_minutes", 7, today);
    const lastAct = [...d.acts].filter((a) => a?.timestamp).sort((x, y) => String(x.timestamp).localeCompare(String(y.timestamp))).pop() ?? null;
    const rows: Row[] = [
      { label: "1-min recovery", value: h?.latest != null ? String(h.latest) : DASH, unit: h?.latest != null ? "bpm" : "", note: h?.latest == null ? "after a session that ends above the band" : h.latest <= 12 ? "at or under the line, 12" : "", tone: h?.latest != null && h.latest <= 12 ? "concern" : "neutral" },
      { label: "Activity level", value: pal ? Number(pal.pal).toFixed(1) : DASH, unit: pal ? "PAL" : "", note: pal ? "" : "needs a week of energy data" },
      { label: "Sitting, average day", value: sit != null ? fmtHMin(sit) : DASH, note: sit == null ? "no sedentary hours from the app yet" : sit >= 600 ? "a long day, past ten hours" : "", tone: sit != null && sit >= 600 ? "caution" : "neutral" },
    ];
    if (lastAct?.effort) rows.push({ label: "Last session's effort", value: sentence(String(lastAct.effort)), note: lastAct.effort_source === "apple" ? "the wearable's rating" : lastAct.effort_source === "manual" ? "yours" : "estimated" });
    cards.push({
      key: "exertion", title: "Exertion", figure: d.synced ? String(n) : DASH, unit: d.synced ? `session${n === 1 ? "" : "s"} this week` : "nothing from the app yet",
      band: !d.synced ? { text: "Cloud sync in the app fills this in", tone: "neutral" } : n === 0 ? { text: lastDay ? `Last session ${dayWord(lastDay)}` : "No session on file", tone: "neutral" } : { text: `Last ${dayWord(lastDay)}${act?.perWeek ? ` · ${Math.round(act.perWeek)} a week ${you} usual` : ""}`, tone: "neutral" },
      rows, more: [], writer: store, markers: CARD_MARKERS.exertion,
      heading: d.synced ? `${plural(n, "session")} this week so far` : "No sessions from the app yet",
      eyebrow: `Exertion · Monday ${dayMonth(monday)} to today`,
    });
  }
  // ── Movement: the dose as the app wrote it, the zones, strength, background movement, steps ──
  {
    const tw = act?.thisWeek ?? null;
    const dose = tw?.dose_met_min ?? null, goal = act?.goalDose ?? Math.round(d.goal * 60);
    const reason = doseReason(tw, d.synced);
    const zones = tw?.dose_basis === "app" && (tw.zone1_min != null || tw.zone2_min != null || tw.zone3_min != null)
      ? { z1: tw.zone1_min, z2: tw.zone2_min, z3: tw.zone3_min } : (() => { const z = weekZones(d.signals, monday); return z ? { z1: z.z1, z2: z.z2, z3: z.z3 } : { z1: null, z2: tw?.zone2_min ?? null, z3: null }; })();
    const strength = tw?.dose_basis === "app" ? tw.strength_sessions : (tw?.strength_sessions ?? null);
    const bg = backgroundOf(d.signals, monday, today, writer);
    const bgText = tw?.dose_basis === "app" && tw.background_min_avg != null ? { value: round0(tw.background_min_avg), unit: "min a day", note: "" } : bg.minutes != null ? { value: round0(bg.minutes), unit: "min a day", note: "" } : { value: DASH, unit: "", note: bg.words };
    const steps = heart?.steps.avg ?? null;
    const stepsWriter = latestWith(d.signals, "steps_source", today)?.steps_source ?? null;
    const daysIn = Math.min(7, daysBetween(monday, today) + 1), toGo = 7 - daysIn;
    const band: Card["band"] = dose == null ? { text: sentence(reason || "no sessions logged"), tone: "neutral" }
      : dose >= goal ? { text: `Goal of ${goal.toLocaleString()} met`, tone: "good" }
      : dose >= (goal * daysIn) / 7 ? { text: `On track for ${goal.toLocaleString()}`, tone: "neutral" }
      : { text: `${(goal - dose).toLocaleString()} to go, ${toGo === 0 ? "the week is done" : plural(toGo, "day") + " left"}`, tone: "neutral" };
    const rows: Row[] = [
      { label: "Zone 2 · Zone 3", value: zones.z2 != null || zones.z3 != null ? `${zones.z2 != null ? round0(zones.z2) : DASH} · ${zones.z3 != null ? round0(zones.z3) : DASH}` : DASH, unit: zones.z2 != null || zones.z3 != null ? "min" : "", note: zones.z2 == null && zones.z3 == null ? "the app writes the zones on its next sync" : zones.z3 == null ? "zone 3 comes with the app's next sync" : "" },
      { label: "Strength", value: strength != null ? String(strength) : DASH, unit: strength != null ? `session${strength === 1 ? "" : "s"}` : "", note: strength == null ? "none logged" : "" },
      { label: "Background movement", value: bgText.value, unit: bgText.unit, note: bgText.note },
      { label: "Steps", value: steps != null ? steps.toLocaleString() : DASH, unit: steps != null ? "a day" : "", note: steps == null ? "no steps in the store" : "" },
    ];
    const writers = tw?.dose_basis === "app" ? `counted by the app · ${plural(tw!.workouts, "session")}` : tw?.dose_basis === "browser" ? `${tw.writers.join(" + ")} · ${plural(tw.workouts, "session")}, one row each${d.synced ? " · the app writes this week on its next sync" : ""}` : d.synced ? "the app writes the week on its next sync" : "Any wearable that writes workouts to the phone's health store";
    cards.push({
      key: "movement", title: "Movement", figure: dose != null ? dose.toLocaleString() : DASH, unit: dose != null ? "MET-min this week" : (reason || "no sessions logged"), band, rows,
      more: [{ label: "Weekly dose", value: dose != null ? dose.toLocaleString() : DASH, unit: dose != null ? "MET-min" : "", note: dose == null ? reason : tw?.dose_basis === "app" ? "the app's rule: logged sessions, moderate or vigorous, MET × minutes, one writer" : "counted here until the app writes the week" }],
      writer: `${writers}${stepsWriter ? ` · steps: ${stepsWriter}` : ""}`, markers: CARD_MARKERS.movement,
      heading: dose != null ? `${dose.toLocaleString()} MET-min of a ${goal.toLocaleString()} goal, with ${toGo === 0 ? "the week complete" : `${plural(toGo, "day")} to go`}` : `No sessions logged this week yet, of a ${goal.toLocaleString()} MET-min goal`,
      eyebrow: `Movement · Monday ${dayMonth(monday)} to Sunday ${dayMonth(addDays(monday, 6))}`,
      progress: dose != null && goal > 0 ? Math.min(1, dose / goal) : null,
    });
  }
  // ── Body: how many markers sit outside their range, which, and three rows ──
  {
    // the app's list and the app's bands (derive/body), so the figure here is the Body page's figure
    const list = bodyListOf(d);
    const labRows = list.sections.flatMap((s) => s.rows).filter((r) => r.value != null);
    const out = list.outside;
    const remnant = [...d.labsShown].filter((l) => l.analyte === REMNANT_LABEL).sort((a, b) => String(a.measured_on).localeCompare(String(b.measured_on))).pop() ?? null;
    const ldl = (by.get("ldl_mgdl") ?? []).slice(-1)[0] ?? null;
    const weight = d.markerByKey("weight")?.series().slice(-1)[0] ?? null;
    const latestLab = d.labs.map((l) => String(l.measured_on ?? "")).filter(Boolean).sort().pop() ?? "";
    const rows: Row[] = [
      { label: REMNANT_LABEL, value: remnant ? fmt1(Number(remnant.value)) : DASH, unit: remnant ? String(remnant.unit ?? "") : "", note: remnant ? "" : "needs total, LDL and HDL on one report" },
      { label: "LDL", value: ldl ? fmt1(ldl.v) : DASH, unit: ldl?.unit ?? "", note: ldl ? "" : "no report yet" },
      { label: "Weight", value: weight ? fmt1(weight.v) : DASH, unit: weight ? "kg" : "", note: weight ? "" : "no weighing yet" },
    ];
    cards.push({
      key: "body", title: "Body", figure: labRows.length ? String(out.length) : DASH, unit: labRows.length ? `marker${out.length === 1 ? "" : "s"} outside range` : "nothing read yet",
      band: labRows.length ? (out.length ? { text: `${out.slice(0, 2).map((r) => r.label).join(" and ")}${out.length > 2 ? ` and ${out.length - 2} more` : ""} outside`, tone: "caution" } : { text: "All in range", tone: "good" }) : { text: "Drop a report on Reports", tone: "neutral" },
      rows, more: [], writer: latestLab ? `Lab report, ${fmtDay(latestLab)}` : "Typed, and from reports", markers: [],
      heading: bodyHeadline(list),
      eyebrow: `Body · ${latestLab ? `latest labs ${fmtDay(latestLab)}` : "the app's list"}`,
    });
  }

  // the line under the greeting: fitness, the dose, last night
  const bits: string[] = [];
  const fc = cards[0], mc = cards[4], sc = cards[2];
  if (fit.latest) bits.push(`Fitness ${fc.figure} ${fc.unit}${fc.band.text.startsWith("no") ? "" : `, ${fc.band.text.toLowerCase()}`}`);
  if (act?.thisWeek?.dose_met_min != null) bits.push(`${mc.figure} MET-min of movement this week across ${plural(act.thisWeek.workouts, "session")}`);
  else if (d.synced) bits.push("no sessions logged this week yet");
  if (heart?.sleep.last) bits.push(`${sc.figure} of sleep ${sc.unit}`);
  const line = bits.length ? bits.map(sentence).join(". ") + "." : "";
  return { cards, line };
}

// ── the pieces ──────────────────────────────────────────────────────────

export function GlanceLine() {
  const d = derived.value;
  const text = d ? cardsOf(d, !!person.value?.self, fitUnit.value).line : "";
  return <>{text}</>;
}

/** The Guide's one line on the Overview: fixed height, filled from the latest read; a link to its tab. */
export function GuidePointer() {
  const r = latestRead.value;
  const go = () => actions.goTab("guide");
  return (
    <button type="button" onClick={go} class="r-card flex h-[56px] w-full items-center gap-4 border border-border bg-card px-5 text-left transition-colors hover:border-border-strong">
      <span class="t-eyebrow shrink-0 text-accent-text">The Guide</span>
      <span class="t-small min-w-0 flex-1 truncate text-text-2">
        {r ? `Read your week on ${longDay(r.created_at.slice(0, 10))}.${r.count ? ` ${r.count === 1 ? "One thing" : `${r.count} things`} worth knowing.` : ""}` : "The Guide reads your week on Mondays."}
      </span>
      <span class="t-small shrink-0 font-semibold text-accent-text">{r ? "Read" : "Open"} &rarr;</span>
    </button>
  );
}

/** One row: the label left, the figure and its unit right; a note, when there is one, on its own line under them. */
function RowLine({ r }: { r: Row }) {
  return (
    <span class="flex flex-col border-t border-border py-[7px] first:border-t-0">
      <span class="flex items-baseline justify-between gap-3">
        <span class="t-small text-text-2">{r.label}</span>
        <span class="shrink-0 whitespace-nowrap text-right">
          {r.value ? <span class={`t-figure-row ${r.tone ? TONE_TEXT[r.tone] : "text-text"}`}>{r.value}</span> : null}
          {r.unit ? <span class="t-unit ml-1">{r.unit}</span> : null}
        </span>
      </span>
      {r.note ? <span class="t-caption mt-0.5 text-right text-text-3">{r.note}</span> : null}
    </span>
  );
}

function UnitSwitch() {
  const u = fitUnit.value;
  const cls = (on: boolean) => `r-chip px-2.5 py-[3px] font-mono text-[11px] font-medium transition-colors ${on ? "bg-accent-fill text-accent-text border border-accent-border" : "border border-transparent text-text-3 hover:text-text"}`;
  return (
    <span class="flex items-center gap-1" role="group" aria-label="Unit" onClick={(e) => e.stopPropagation()}>
      <button type="button" class={cls(u === "mets")} aria-pressed={u === "mets" ? "true" : "false"} onClick={() => setFitUnit("mets")}>METs</button>
      <button type="button" class={cls(u === "vo2")} aria-pressed={u === "vo2" ? "true" : "false"} onClick={() => setFitUnit("vo2")}>VO₂max</button>
    </span>
  );
}

/** The five tiers for this age and sex, the person's own lit and marked "You". */
function TierStrip({ d }: { d: NonNullable<typeof derived.value> }) {
  const fit = fitnessSummary(d.crf, todayStr());
  const l = fit.latest; if (!l) return null;
  const row = tierRowFor(d.profile?.age, d.profile?.sex);
  const mets = metsOfTest(l);
  const idx = tierIndexFromCategory(l.category) ?? (mets != null ? tierIndexOf(mets, row) : null);
  const ranges = tierRangeWords(row);
  return (
    <span class="mt-3 block">
      <span class="grid grid-cols-5 gap-[3px]">
        {ranges.map((rg, i) => <span key={i} class={`flex h-[6px] rounded-[2px] ${i === idx ? "bg-accent" : "bg-alt"}`} title={`${tierShort(i)} · ${rg} METs`}></span>)}
      </span>
      <span class="mt-1.5 grid grid-cols-5 gap-[3px]">
        {ranges.map((_, i) => <span key={i} class={`t-caption truncate ${i === idx ? "font-semibold text-accent-text" : "text-text-3"}`}>{i === idx ? "You" : tierShort(i)}</span>)}
      </span>
      <span class="t-caption mt-1 block text-text-3">Tiers for {row.age} · {String(d.profile?.sex ?? "").toLowerCase() === "female" ? "women" : "men"} · the app's table</span>
    </span>
  );
}

function Progress({ v }: { v: number | null | undefined }) {
  if (v == null) return null;
  return <span class="mt-2 block h-[4px] w-full overflow-hidden rounded-full bg-alt"><span class="block h-full rounded-full bg-accent" style={{ width: `${Math.round(v * 100)}%` }}></span></span>;
}

function CardFace({ c, d, on, onOpen }: { c: Card; d: NonNullable<typeof derived.value>; on: boolean; onOpen: () => void }) {
  return (
    <div role="button" tabIndex={0} aria-expanded={on ? "true" : "false"} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      class={`r-card flex min-h-[236px] cursor-pointer flex-col border bg-card p-5 text-left transition-colors ${on ? "border-border-strong" : "border-border hover:border-border-strong"}`}>
      <span class="flex items-center justify-between gap-3">
        <span class="t-title text-text">{c.title}</span>
        {c.key === "fitness" ? <UnitSwitch /> : null}
      </span>
      <span class="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span class="t-figure text-text">{c.figure}</span>
        <span class="t-unit">{c.unit}</span>
      </span>
      <span class={`t-small mt-1 ${TONE_TEXT[c.band.tone]}`}>{c.band.text}</span>
      {c.key === "fitness" ? <TierStrip d={d} /> : null}
      <Progress v={c.progress} />
      <span class="mt-3 flex flex-col">{c.rows.map((r) => <RowLine key={r.label} r={r} />)}</span>
      <span class="mt-auto flex items-baseline justify-between gap-3 pt-4">
        <span class="t-caption min-w-0 text-text-3">{c.writer}</span>
        <span class="t-caption shrink-0 font-semibold text-accent-text">Open</span>
      </span>
    </div>
  );
}

/** While a card is open the other five shrink to one row each and stay in place. */
function StripCard({ c, onOpen }: { c: Card; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} class="r-card flex items-baseline justify-between gap-3 border border-border bg-card px-4 py-3 text-left transition-colors hover:border-border-strong">
      <span class="t-small text-text-2">{c.title}</span>
      <span class="min-w-0 text-right"><span class="t-figure-row text-text">{c.figure}</span> <span class="t-unit">{c.figure === DASH ? c.unit : c.unit.split(" ")[0]}</span></span>
    </button>
  );
}

const DAY_LETTERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** The week's seven days: the day row's zone minutes stacked, or the sessions' minutes when the app has not sent the zones. */
function WeekBars({ d }: { d: NonNullable<typeof derived.value> }) {
  const bars = dayBars(d.signals, d.acts, mondayOf(new Date()), todayStr());
  const max = Math.max(30, ...bars.map((b) => b.z1 + b.z2 + b.z3 + b.other));
  const h = (v: number) => `${Math.round((v / max) * 100)}%`;
  return (
    <span class="block">
      <span class="flex h-[88px] items-end gap-2">
        {bars.map((b, i) => (
          <span key={b.day} class="flex h-full flex-1 flex-col justify-end gap-[1px]" title={`${DAY_LETTERS[i]}: zone 1 ${b.z1}, zone 2 ${b.z2}, zone 3 ${b.z3}${b.other ? `, other ${b.other}` : ""} min`}>
            {b.future ? <span class="block h-[2px] rounded-[1px] bg-alt"></span> : <>
              <span class="block w-full rounded-t-[2px] bg-z3" style={{ height: h(b.z3) }}></span>
              <span class="block w-full bg-z2" style={{ height: h(b.z2) }}></span>
              <span class="block w-full bg-text-4" style={{ height: h(b.z1) }}></span>
              <span class="block w-full rounded-b-[2px] bg-alt" style={{ height: h(b.other) }}></span>
            </>}
          </span>
        ))}
      </span>
      <span class="mt-1.5 flex gap-2">{DAY_LETTERS.map((l) => <span key={l} class="t-caption flex-1 text-center text-text-3">{l}</span>)}</span>
    </span>
  );
}

/** The chapter rows of the opened Movement card (board 3). */
function movementRows(d: NonNullable<typeof derived.value>, c: Card): Row[] {
  const today = todayStr(), monday = mondayOf(new Date());
  const act = activitySummary(d.weeks, d.acts, d.goal, today, monday);
  const tw = act.thisWeek;
  const z = tw?.dose_basis === "app" && tw.zone2_min != null ? { z1: tw.zone1_min, z2: tw.zone2_min, z3: tw.zone3_min } : (() => { const w = weekZones(d.signals, monday); return w ? { z1: w.z1, z2: w.z2, z3: w.z3 } : { z1: null as number | null, z2: tw?.zone2_min ?? null, z3: null as number | null }; })();
  const cad = latestWith(d.signals, "cadence_spm", today);
  const strength = tw?.strength_sessions ?? null;
  const strengthDays = [...actsByDay(d.acts.filter((a) => a.activity_type === "strength"))].filter(([x]) => x >= monday).map(([x]) => dayWord(x));
  const zoneNote = "the app's split of each logged session's heart rate";
  return [
    c.more[0],
    { label: "Zone 1", value: z.z1 != null ? round0(z.z1) : DASH, unit: z.z1 != null ? "min" : "", note: z.z1 != null ? "easy: under 40 % of heart rate reserve, or under your tested band" : "comes with the app's next sync" },
    { label: "Zone 2", value: z.z2 != null ? round0(z.z2) : DASH, unit: z.z2 != null ? "min" : "", note: z.z2 != null ? "40 to 60 % of heart rate reserve, or your tested band" : zoneNote },
    { label: "Zone 3", value: z.z3 != null ? round0(z.z3) : DASH, unit: z.z3 != null ? "min" : "", note: z.z3 != null ? "hard: over 60 % of heart rate reserve, or over your tested band" : "comes with the app's next sync" },
    { label: "Strength", value: strength != null ? String(strength) : DASH, unit: strength != null ? `session${strength === 1 ? "" : "s"}` : "", note: strengthDays.length ? strengthDays.join(" · ") : strength ? "" : "none logged this week" },
    ...c.rows.filter((r) => r.label === "Background movement" || r.label === "Steps"),
    { label: "Cadence", value: cad ? round0(Number(cad.cadence_spm)) : DASH, unit: cad ? "spm" : "", note: cad ? "the day's best thirty minutes" : "a phone in the pocket writes it" },
  ];
}

function OpenCard({ c, d }: { c: Card; d: NonNullable<typeof derived.value> }) {
  const today = todayStr();
  const ms = c.key === "body" ? d.markers.filter((m) => m.section === "body" && m.key !== "bp") : c.markers.map((k) => d.markerByKey(k)).filter((m): m is Marker => !!m);
  const have = ms.filter((m) => m.series().length);
  const wanted = openMarkerKey.value && ms.some((m) => m.key === openMarkerKey.value) ? openMarkerKey.value : "";
  const openKey = wanted || (ms.length && c.key !== "body" ? (have[0] ?? ms[0]).key : "");
  const open = openKey ? ms.find((m) => m.key === openKey) ?? null : null;
  const outKeys = new Set(labRowsFrom(d.by, today).filter((r) => r.out).map((r) => r.key));
  const rows = c.key === "movement" ? movementRows(d, c) : [...c.more, ...c.rows];
  const readAt = d.signals.length ? String(d.signals[d.signals.length - 1]?.day ?? "") : "";
  const tap = (m: Marker) => { openMarkerKey.value = m.key; openRange.value = ""; openYear.value = null; focusTile.value = true; };
  const tile = (m: Marker, i: number) => <Tile key={m.key} m={m} i={i} on={m.key === openKey} out={outKeys.has(m.key)} onTap={() => tap(m)} />;
  return (
    <div class="mh-slide r-card col-span-full border border-border-strong bg-card p-5 sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="t-eyebrow">{c.eyebrow}</div>
          <h2 class="t-heading mt-1.5 text-text">{c.heading}</h2>
        </div>
        <div class="flex items-center gap-2">
          {c.key === "fitness" ? <UnitSwitch /> : null}
          <button type="button" onClick={() => { actions.goTab("depth"); setSection(c.key); }} class="r-btn min-h-9 border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-border-strong hover:text-text">In depth</button>
          <button type="button" onClick={() => setSection("all")} class="r-btn min-h-9 border border-border px-3.5 text-[13px] font-semibold text-text-2 transition-colors hover:border-border-strong hover:text-text">Close</button>
        </div>
      </div>
      <div class="mt-5 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div class="min-w-0">
          {c.key === "movement" ? <><WeekBars d={d} /><p class="t-caption mt-2 text-text-3">Logged sessions only, moderate or vigorous, whole-session MET × minutes. One writer per session. The same rule the app uses.</p></> : null}
          {c.key === "fitness" ? <><TierStrip d={d} />{fitUnit.value === "vo2" ? <p class="t-caption mt-2 text-text-3">{VO2_CAVEAT}</p> : null}</> : null}
          <div class={`flex flex-col ${c.key === "movement" || c.key === "fitness" ? "mt-4" : ""}`}>{rows.filter(Boolean).map((r) => <RowLine key={r.label} r={r} />)}</div>
          <p class="t-caption mt-3 text-text-3">{c.writer}{readAt ? ` · read ${readAt === today ? "today" : fmtDay(readAt)}` : ""}. A row with nothing to show reads a dash and the reason, never a zero.</p>
        </div>
        <div class="min-w-0">
          {ms.length ? (
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {c.key === "body"
                ? SHELVES.map(([g, name]) => { const gm = ms.filter((m) => m.group === g); if (!gm.length) return null; return (<>
                    <div key={`shelf:${g}`} class="col-span-full mt-2 flex items-baseline gap-2 first:mt-0"><span class="t-eyebrow">{name}</span><span class="t-caption text-text-3">{gm.filter((m) => m.series().length).length} of {gm.length} read</span></div>
                    {gm.map((m) => tile(m, ms.indexOf(m)))}
                  </>); })
                : ms.map(tile)}
            </div>
          ) : null}
        </div>
      </div>
      {open ? <div class="mt-5"><OpenMarker open={open} markers={d.markers} acts={d.acts} out={outKeys.has(open.key)} /></div> : null}
    </div>
  );
}

export function Glance() {
  const d = derived.value;
  if (!d) return <>{CARD_KEYS.map((k) => <Frame key={k} label={CARD_TITLE[k]} />)}</>;
  const { cards } = cardsOf(d, !!person.value?.self, fitUnit.value);
  const sec = section.value;
  const openCard = cards.find((c) => c.key === sec) ?? null;
  const openOf = (c: Card) => () => { if (section.value === c.key) setSection("all"); else setSection(c.key); };
  if (openCard) {
    return (
      <>
        <div class="col-span-full grid gap-2 sm:grid-cols-5">{cards.filter((c) => c.key !== openCard.key).map((c) => <StripCard key={c.key} c={c} onOpen={openOf(c)} />)}</div>
        <OpenCard c={openCard} d={d} />
      </>
    );
  }
  return <>{cards.map((c) => <CardFace key={c.key} c={c} d={d} on={false} onOpen={openOf(c)} />)}</>;
}

function Frame({ label }: { label: string }) {
  return (
    <div class="r-card flex min-h-[236px] flex-col gap-3 border border-border bg-card p-5" aria-hidden="true">
      <span class="t-title text-text">{label}</span>
      <span class="mt-1 h-7 w-24 rounded-md bg-alt"></span>
      <span class="h-3.5 w-2/5 rounded bg-alt"></span>
      <span class="mt-2 flex flex-col gap-2"><span class="h-3 w-full rounded bg-alt"></span><span class="h-3 w-full rounded bg-alt"></span><span class="h-3 w-4/5 rounded bg-alt"></span></span>
    </div>
  );
}

// ── the tiles and the open marker: the app's lenses, drawn under the opened card ──

function Tile({ m, i, on, out, onTap }: { m: Marker; i: number; on: boolean; out: boolean; onTap: () => void }) {
  const pts = m.series(); const l = pts[pts.length - 1] ?? null;
  const t = m.tile ? m.tile() : null;
  if (t) out = t.out;
  return (
    <button type="button" style={{ "--i": i } as any} aria-current={on ? "true" : "false"} onClick={onTap}
      class={`r-btn flex flex-col gap-1 border p-3 text-left transition-colors ${on ? "border-accent-border bg-accent-fill" : l ? "border-border bg-alt hover:border-border-strong" : "border-dashed border-border hover:border-border-strong"}`}>
      <span class="t-caption text-text-2">{m.label}</span>
      <span class={`t-figure-row ${l ? (out ? "text-caution" : "text-text") : "text-text-3"}`}>
        {t ? t.headline : l ? (m.pointLabel ? m.pointLabel(l) : m.fmt(l.v)) : DASH}{l && m.unit ? <> <span class="t-unit">{m.unit}</span></> : null}
      </span>
      <span class="t-caption text-text-3">{t ? t.sub : l ? (l.d === todayStr() ? "today" : dayWord(l.d)) : "not read yet"}</span>
    </button>
  );
}

const Kicker = ({ text }: { text: string }) => <div class="t-eyebrow">{text}</div>;

function OpenMarker({ open, markers, acts, out }: { open: Marker; markers: Marker[]; acts: any[]; out: boolean }) {
  // the app's Over Time lenses, by the same names, drawing the same bars
  const ranges: Rng[] = open.daily ? ["week", "4w", "months", "years"] : ["6m", "1y", "all"];
  const range: Rng = openRange.value && ranges.includes(openRange.value as Rng) ? (openRange.value as Rng) : open.daily ? "week" : "1y";
  const year = openYear.value;
  const dr = drawnFor(open, range, year);
  const years = [...new Set(open.series().map((p) => Number(p.d.slice(0, 4))))].sort((a, b) => b - a);
  const yearMenu = (open.daily ? range === "years" : range === "all") && years.length;
  const band = open.daily && range === "week" ? (open.band?.() ?? null) : null;
  const pts = open.series();
  const reads = [...open.reads(pts), ...(open.rangeReads?.(range, year) ?? [])];
  const t = todayStr();
  const monthAgg = (from: string, to: string) => { const xs = pts.filter((p) => p.d >= from && p.d <= to).map((p) => p.v); return xs.length ? { v: open.sum ? xs.reduce((a, b) => a + b, 0) : xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length } : null; };
  const m30 = monthAgg(addDays(t, -29), t), y1 = monthAgg(addDays(t, -364), t), y2 = monthAgg(addDays(t, -729), addDays(t, -365));
  const alongside = dr && open.daily && range === "week" ? alongsideHtml(markers, open, range, dr) : "";
  const comp = open.companion ? markers.find((m) => m.key === open.companion) ?? null : null;
  const compDr = comp ? drawnFor(comp, range, year) : null;
  const compPts = comp ? comp.series() : [];
  const compAgg = (from: string, to: string) => { const xs = compPts.filter((p) => p.d >= from && p.d <= to).map((p) => p.v); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const c30 = comp ? compAgg(addDays(t, -29), t) : null, c1y = comp ? compAgg(addDays(t, -364), t) : null;
  const seg = (on: boolean) => `r-btn min-h-8 px-3 text-[13px] font-semibold transition-colors ${on ? "bg-accent-fill text-accent-text" : "text-text-3 hover:text-text"}`;
  return (
    <>
      <div class="r-card border border-border bg-alt p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="t-title text-text">{open.label}</h3>
            <p class="t-caption mt-0.5 text-text-3">{open.sub}</p>
          </div>
          <div class="r-btn flex gap-1 border border-border p-1" role="group" aria-label="Range">
            {ranges.map((r) => <button key={r} type="button" onClick={() => { openRange.value = r; openYear.value = null; }} class={seg(r === range)}>{r === "4w" && open.table ? "12 weeks" : RANGE_LABEL[r]}</button>)}
          </div>
          {yearMenu ? (
            <label class="t-caption flex items-center gap-2 text-text-3">Year
              <select value={year ?? ""} onChange={(e) => { openYear.value = Number((e.target as HTMLSelectElement).value) || null; }} class="r-btn min-h-8 border border-border bg-card px-2.5 text-[13px] font-semibold text-text focus:border-accent-border focus:outline-none">
                <option value="">all</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select></label>
          ) : null}
        </div>
        {dr ? (
          <>
            <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div class="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <div class="flex items-baseline gap-2.5"><span class={`t-figure ${out ? "text-caution" : "text-text"}`}>{dr.headline}</span><span class="t-small text-text-2" dangerouslySetInnerHTML={{ __html: dr.caption }} /></div>
                {comp && compDr && compDr.headline !== DASH ? (
                  <div class="flex items-baseline gap-2"><span class="t-figure text-text-2">{compDr.headline}</span><span class="t-small text-text-2">{range === "week" ? `kcal active ${compPts.length && compPts[compPts.length - 1].d === t ? "today" : "on the latest day"}` : "kcal active a day"}</span></div>
                ) : null}
              </div>
              <div class="t-caption flex flex-wrap gap-4 text-text-2">
                {band ? <span><span class="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm border border-good/50 bg-good/20 align-[-1px]"></span>{band.why}</span> : null}
                {range === "week" && open.goal?.() ? <span><span class="mr-1.5 inline-block h-0.5 w-3 bg-accent align-[3px]"></span>the week's running total, against the goal</span> : null}
                {range === "week" && open.daily && open.lines?.()?.length ? open.lines().map((l) => <span key={l.value}><span class="mr-1.5 inline-block h-0.5 w-3 align-[3px]" style={`background:${l.color}`}></span>{open.fmt(l.value)} {l.label.toLowerCase()}</span>) : null}
              </div>
            </div>
            <div class="mt-2 overflow-x-auto"><svg viewBox="0 0 820 200" class="block h-auto w-full min-w-[560px]" role="img" aria-label={`${open.label}, ${RANGE_LABEL[range].toLowerCase()} view`} dangerouslySetInnerHTML={{ __html: chartSvg(open, range, dr) }} /></div>
            {dr.rows ? (
              <div class="mt-3 border-t border-border">
                {dr.rows.map((r) => (
                  <div key={r.label} class="grid grid-cols-[1.3fr_0.8fr_1fr_auto] items-baseline gap-3 border-b border-border py-1.5 text-[12.5px] tabular-nums">
                    <span class={r.total ? (r.current ? "font-semibold text-text" : "text-text-2") : "text-text-3"}>{r.label}</span>
                    <span class={`text-right font-mono ${r.total ? "text-text" : "text-text-3"}`}>{r.total ? open.fmt(r.total) : DASH}</span>
                    <span class="text-right text-text-3">{r.avg != null ? `${open.fmt(r.avg)} a day` : ""}</span>
                    <span class="t-eyebrow w-12 text-right text-accent-text">{r.current ? "so far" : ""}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : <p class="t-small mt-4 text-text-3">Nothing read yet for {open.label.toLowerCase()}.{open.section === "heart" || open.key === "steps" ? " The app sends it on every sync once the health store is on." : ""}</p>}
        <div class="mt-4 grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
          <div>
            <Kicker text="What Verve reads" />
            <div class="t-small mt-2 flex flex-col gap-2 leading-relaxed text-text-2">{reads.map((r, i) => <p key={i} dangerouslySetInnerHTML={{ __html: r }} />)}</div>
            <a href={open.science} class="t-caption mt-2.5 inline-block font-semibold text-accent-text hover:text-text">The science behind this &rarr;</a>
          </div>
          <div>
            {dr && open.daily && range === "week"
              ? <><Kicker text="Alongside · the same days" />{alongside ? <div class="mt-2" dangerouslySetInnerHTML={{ __html: alongside }} /> : <div class="mt-2"><p class="t-caption text-text-3">Nothing else read on these days yet.</p></div>}</>
              : <><Kicker text="Source" /><p class="t-small mt-2 leading-relaxed text-text-2">{open.source}</p></>}
          </div>
        </div>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <div class="r-card border border-border bg-alt p-4"><Kicker text={open.daily ? "Last 30 days" : "Last year"} /><div class="t-figure-row mt-1.5 text-[20px] text-text">{open.daily ? (m30 ? open.fmt(m30.v) : DASH) : (y1 ? open.fmt(y1.v) : DASH)} <span class="t-unit">{open.daily ? (m30 ? `${open.unit}${open.sum ? "" : " a day"}` : "") : (y1 ? `${open.unit} average` : "")}</span></div><div class="t-caption mt-0.5 text-text-3">{open.daily ? (m30 ? `${m30.n} days read` : "nothing read") : (y1 ? `${y1.n} reading${y1.n === 1 ? "" : "s"}` : "no reading")}</div>{comp && c30 != null ? <div class="t-figure-row mt-1 text-text-2">{Math.round(c30)} <span class="t-unit">kcal active a day</span></div> : null}</div>
        <div class="r-card border border-border bg-alt p-4"><Kicker text={open.daily ? "Last 12 months" : "The year before"} /><div class="t-figure-row mt-1.5 text-[20px] text-text">{open.daily ? (y1 ? open.fmt(y1.v) : DASH) : (y2 ? open.fmt(y2.v) : DASH)} <span class="t-unit">{open.daily ? (y1 ? `${open.unit}${open.sum ? " in all" : " a day"}` : "") : (y2 ? `${open.unit} average` : "")}</span></div><div class="t-caption mt-0.5 text-text-3">{open.daily ? (y1 && y2 ? `the year before: ${open.fmt(y2.v)}` : y1 ? `${y1.n} days read` : "nothing read") : (y2 ? `${y2.n} reading${y2.n === 1 ? "" : "s"}` : "no reading")}</div>{comp && c1y != null ? <div class="t-figure-row mt-1 text-text-2">{Math.round(c1y)} <span class="t-unit">kcal active a day</span></div> : null}</div>
        <div class="r-card border border-border bg-alt p-4"><Kicker text="Source" /><div class="t-small mt-1.5 leading-relaxed text-text-2">{open.source}</div></div>
      </div>
      {open.key === "sessions" ? <div dangerouslySetInnerHTML={{ __html: workoutsListHtml(acts, range) }} /> : null}
    </>
  );
}

// ── the parts that left the Overview on 8 Nov 2026, kept behind SHOW_OLD_OVERVIEW ──

/** Fourteen dots under the greeting: a day with a night or a resting rate is full, steps alone half, nothing empty. */
export function DaysWithData() {
  const d = derived.value;
  if (!d) return null;
  const today = todayStr();
  const byDay = new Map<string, any>(d.signals.map((r) => [String(r.day), r]));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const kind = (r: any) => !r ? "none" : (r.sleep_minutes != null || r.resting_hr != null) ? "full" : r.steps != null ? "part" : "none";
  const nights = days.filter((x) => byDay.get(x)?.sleep_minutes != null).length;
  const mornings = days.filter((x) => byDay.get(x)?.resting_hr != null).length;
  const writers = [...new Set(days.map((x) => byDay.get(x)?.steps_source).filter(Boolean).map(String))];
  if (!d.signals.length) return null;
  return (
    <div class="flex flex-col items-start gap-2 sm:items-end">
      <span class="t-eyebrow">Days with data · last 14</span>
      <span class="flex gap-[5px]" role="img" aria-label={`Days with data in the last fourteen: ${nights} nights, ${mornings} mornings`}>
        {days.map((x) => { const k = kind(byDay.get(x)); return <span key={x} title={`${dayWord(x)}: ${k === "full" ? "a night or a resting rate" : k === "part" ? "steps only" : "nothing in the store"}`} class={`h-2.5 w-2.5 rounded-full ${k === "full" ? "bg-accent" : k === "part" ? "bg-accent/45" : "bg-alt"}`}></span>; })}
      </span>
      <span class="t-caption text-text-3">{nights} nights · {mornings} mornings{writers.length ? ` · ${esc(writers.join(", "))}` : ""}</span>
    </div>
  );
}

/** The week, every number: Monday to Sunday across, the signals down, straight from the daily signals. Moves to In depth in stage 2. */
export function WeekTable() {
  const d = derived.value;
  if (!d || !d.signals.length) return null;
  const today = todayStr(), mon = mondayOf(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const byDay = new Map<string, any>(d.signals.map((r) => [String(r.day), r]));
  const dose = actsByDay(d.acts);
  const heart = sleepHeartSummary(d.signals, today);
  const base = heart?.rhr.baseline ?? null;
  type R = { label: string; unit: string; of: (x: string) => number | null; fmt: (v: number) => string; tone: (v: number) => string };
  const rows: R[] = [
    { label: "Sleep", unit: "h", of: (x) => byDay.get(x)?.sleep_minutes != null ? byDay.get(x).sleep_minutes / 60 : null, fmt: (v) => v.toFixed(1), tone: (v) => v < 7 ? "text-caution" : "" },
    { label: "Sleep efficiency", unit: "%", of: (x) => efficiencyOf(byDay.get(x)), fmt: (v) => round0(v), tone: (v) => v < 85 ? "text-caution" : "" },
    { label: "Sleeping heart rate", unit: "bpm", of: (x) => byDay.get(x)?.sleep_hr_bpm ?? null, fmt: (v) => round0(v), tone: () => "" },
    { label: "Breathing", unit: "/min", of: (x) => byDay.get(x)?.breathing_rpm ?? null, fmt: (v) => Number(v).toFixed(1), tone: () => "" },
    { label: "Blood oxygen", unit: "%", of: (x) => byDay.get(x)?.spo2_pct ?? null, fmt: (v) => round0(v), tone: () => "" },
    { label: "Resting heart rate", unit: "bpm", of: (x) => byDay.get(x)?.resting_hr ?? null, fmt: (v) => round0(v), tone: (v) => base != null && v - base >= 10 ? "text-concern" : base != null && v - base >= 5 ? "text-caution" : "" },
    { label: "Recovery", unit: "bpm", of: (x) => byDay.get(x)?.hrr_bpm ?? null, fmt: (v) => round0(v), tone: (v) => v <= 12 ? "text-concern" : "" },
    { label: "Dose", unit: "MET-min", of: (x) => x <= today ? (dose.get(x)?.dose ?? 0) : null, fmt: (v) => round0(v), tone: () => "" },
    { label: "Sitting", unit: "h", of: (x) => byDay.get(x)?.sedentary_minutes != null ? byDay.get(x).sedentary_minutes / 60 : null, fmt: (v) => v.toFixed(1), tone: (v) => v >= 12 ? "text-concern" : v >= 10.6 ? "text-caution" : "" },
  ];
  const wd = (x: string) => new Date(x + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
  return (
    <div class="r-card border border-border bg-card p-5 sm:px-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <span class="t-title text-text">The week, every number</span>
        <span class="t-eyebrow">{dayWord(mon)} – {dayWord(addDays(mon, 6))} · from the daily signals</span>
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[520px] border-collapse">
          <thead><tr>
            <th class="w-[150px]"></th>
            {days.map((x) => <th key={x} class={`t-eyebrow pb-2 text-center ${x === today ? "rounded-t-md bg-accent-fill text-accent-text" : ""}`}>{wd(x)}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} class="border-t border-border">
                <td class="t-small py-2 pr-2 text-text-2">{r.label} <span class="t-unit">{r.unit}</span></td>
                {days.map((x) => { const v = r.of(x); const future = x > today; return <td key={x} class={`py-2 text-center font-mono text-[13px] ${x === today ? "bg-accent-fill" : ""} ${v == null ? "text-text-3" : `font-semibold ${r.tone(v) || "text-text"}`}`}>{future ? "·" : v == null ? DASH : r.fmt(v)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="t-caption mt-3 text-text-3">A dash is a day the store holds nothing for; a dot is a day not yet here. Colour only where a line is crossed.</p>
    </div>
  );
}

/** Mount the views into the page's containers, once. */
export function mountOverview(els: { line: HTMLElement; pointer?: HTMLElement; glance: HTMLElement; old?: HTMLElement; section?: HTMLElement; days?: HTMLElement; week?: HTMLElement }) {
  render(<GlanceLine />, els.line);
  if (els.pointer) render(<GuidePointer />, els.pointer);
  render(<Glance />, els.glance);
  if (SHOW_OLD_OVERVIEW) {
    els.old?.classList.remove("hidden");
    if (els.days) render(<DaysWithData />, els.days);
    if (els.week) render(<WeekTable />, els.week);
  }
}
