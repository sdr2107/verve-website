/**
 * A horizon's standing as plain counts: how many of its targets read reached today, the calls kept, the weeks of the
 * plan that kept every line. Arithmetic only. What is made of these counts is not decided here and is not written
 * here: a panel shown to test accounts (../views/TesterPanel.tsx) carries its own words, kept in the database and
 * readable by test accounts alone, and fills them with these counts.
 *
 * Pure; tests/programme.test.mjs.
 */
import { daysBetween } from "../derive/format.ts";
import { horizonSpans, type HorizonLike, type Pace, type Target } from "./derive.ts";
import { callsKept, weightPace, type WeekNote } from "./programme.ts";

export type Facts = Record<string, string | number | boolean | null>;

// the page's own words for a number that is there: reached, already there, held (with or without its reason), inside
// its band. "Nearly there" is not reached.
const THERE = /^(reached|already there|held(: .*)?|inside your band)$/i;
const UNREAD = /^no (reading|full week|session|starting value)/i;
/** How many of `n` a share asks for: ten of twelve at 10/12, five of six. */
export const needOf = (n: number, share: number) => Math.ceil(n * share - 1e-9);

/**
 * The counts. `share` is the part of the calls, and of the plan's weeks, that a panel counts as kept (a panel gives
 * its own; with none, every one). `planWeeks` is the plan's finished weeks and how many kept every line, when a plan
 * is in use.
 */
export function horizonFacts(a: { h: HorizonLike; paces: Pace[]; targets: Target[]; notes: WeekNote[]; today: string; planWeeks?: { kept: number; of: number } | null; share?: number }): Facts {
  const share = a.share != null && a.share > 0 && a.share <= 1 ? a.share : 1;
  const judged = a.paces.filter((p) => !UNREAD.test(p.pace_word));
  const reached = judged.filter((p) => THERE.test(p.pace_word) || /^reached in (\d+) of \1 /i.test(p.pace_word)).length;
  // a weight number read as a pace: faster than guidelines describe is said, never decided on
  const w = a.targets.find((t) => t.marker === "weight" && !t.mode && t.start_value != null);
  const weightRead = w ? weightPace(w.start_value!, w.target_value, Math.max(1, Math.ceil(daysBetween(w.start_on ?? a.h.starts_on, a.h.ends_on) / 7))).read : null;
  const weightOk = weightRead == null || weightRead === "none" || weightRead === "gain" ? null : weightRead !== "faster" && weightRead !== "steep";
  const calls = callsKept(a.notes, a.h, a.today);
  const callsOk = calls.of ? calls.kept >= needOf(calls.of, share) : null;
  const plan = a.planWeeks && a.planWeeks.of ? a.planWeeks : null;
  const planOk = plan ? plan.kept >= needOf(plan.of, share) : null;
  const targetsOk = judged.length ? reached === judged.length && weightOk !== false : null;
  const spans = horizonSpans(a.h);
  const cur = spans.find((s) => a.today >= s.from && a.today <= s.to) ?? null;
  return {
    week: cur?.week ?? null, weeks_total: spans.filter((s) => s.full).length,
    judged: judged.length, reached, targets_ok: targetsOk,
    weight_read: weightRead, weight_ok: weightOk,
    method_kept: a.paces.some((p) => p.marker === "mets" && !!p.method) ? true : null,
    calls_kept: calls.kept, calls_of: calls.of, calls_need: calls.of ? needOf(calls.of, share) : null, weeks_away: calls.away, calls_ok: callsOk,
    plan_kept: plan?.kept ?? null, plan_of: plan?.of ?? null, plan_need: plan ? needOf(plan.of, share) : null, plan_ok: planOk,
    // every target reads reached and the calls were kept; or the plan's weeks and the calls were; or neither yet
    standing: targetsOk == null && callsOk == null ? "none" : targetsOk && callsOk ? "targets" : planOk && callsOk ? "weeks" : "not_yet",
  };
}

/** A panel's sentence with its counts put in: "{reached} of {judged}" becomes "2 of 6". A name the counts do not hold is left out. */
export function fill(text: string, facts: Facts): string {
  return String(text ?? "").replace(/\{([a-z_0-9]+)\}/g, (_m, k: string) => { const v = facts[k]; return v == null || typeof v === "boolean" ? "" : String(v); });
}
