/**
 * Every video Verve has made, and where each one lives on the site.
 *
 * The files are the silent 16:9 website cuts made by ~/Desktop/verve-videos
 * (captions burned in, music off, no voice), one folder a video under
 * public/video/<slug>/ with its poster. Self-hosted on purpose: a YouTube
 * embed would put a third-party cookie on every science page, which the
 * privacy policy would then have to name, and its player does not match the
 * page. `youtube` marks the ones also on the channel, for the link under the
 * title. Durations are the files' own, to the second.
 *
 * `topic` is the science topic page the video explains (its slug, as in
 * scienceTopics.ts); a video without one lives on /videos alone, under its
 * group. The order here is the order on the page.
 */
import { YOUTUBE_URL } from "./site";

export type VideoGroup = "how-verve-works" | "fitness" | "movement" | "sleep-heart" | "body" | "wider-picture";

export interface Video {
  slug: string;
  title: string;
  /** Length, seconds. */
  seconds: number;
  group: VideoGroup;
  /** The science topic page it sits on, when it has one. */
  topic?: string;
  /** Also on the YouTube channel. */
  youtube?: boolean;
}

export const GROUPS: { key: VideoGroup; label: string; blurb: string }[] = [
  { key: "how-verve-works", label: "How Verve works", blurb: "What the app does, screen by screen." },
  { key: "fitness", label: "Fitness", blurb: "Your fitness as a number, and what the number is worth." },
  { key: "movement", label: "Movement", blurb: "How much, how hard, how often, and the rest of the day." },
  { key: "sleep-heart", label: "Sleep and heart", blurb: "What the watch reads while you sleep and in the minute after you stop." },
  { key: "body", label: "Body", blurb: "The markers, their bands, and what to repeat when." },
  { key: "wider-picture", label: "The wider picture", blurb: "The studies behind the field, read one at a time." },
];

export const VIDEOS: Video[] = [
  { slug: "crf-explained", title: "What is cardiorespiratory fitness?", seconds: 29, group: "fitness", topic: "crf" },
  { slug: "crf-tiers-thread", title: "Fitness is a vital sign. Yours is probably not on file.", seconds: 49, group: "fitness", topic: "crf" },
  { slug: "2026-09-29-tier-not-score", title: "A tier, not a score", seconds: 14, group: "fitness", topic: "crf", youtube: true },
  { slug: "one-met", title: "One MET", seconds: 14, group: "fitness", topic: "mets-vs-met-h" },
  { slug: "when-to-retest", title: "When should you retest your fitness?", seconds: 56, group: "fitness", topic: "test-crf" },
  { slug: "watch-vs-run", title: "My watch said 10.9. The run said 8.7.", seconds: 29, group: "fitness", topic: "test-accuracy" },
  { slug: "2026-09-30-watch-vo2max", title: "METs first, estimates labelled", seconds: 16, group: "fitness", topic: "test-accuracy" },
  { slug: "2026-10-01-flags-not-goals", title: "No goal line, just flags", seconds: 14, group: "movement", topic: "weekly-volume" },
  { slug: "acc-exercise-1-dose", title: "Exercise, prescribed: the 2026 ACC statement (part 1, the dose)", seconds: 85, group: "movement", topic: "weekly-volume", youtube: true },
  { slug: "acc-exercise-2-evidence", title: "Exercise, prescribed: the evidence and wearables (part 2)", seconds: 90, group: "movement", topic: "weekly-volume", youtube: true },
  { slug: "2026-10-03-zone2-yours", title: "Your Zone 2 is yours", seconds: 14, group: "movement", topic: "zone-2" },
  { slug: "polarised-training", title: "Polarised training: what is the 80/20 rule?", seconds: 75, group: "movement", topic: "zone-2", youtube: true },
  { slug: "2026-10-04-strength-column", title: "Strength gets its own column", seconds: 14, group: "movement", topic: "strength-training" },
  { slug: "strength-how-much", title: "Strength training: how much is enough to live longer?", seconds: 72, group: "movement", topic: "strength-training", youtube: true },
  { slug: "how-verve-reads-a-workout", title: "How Verve reads a workout", seconds: 59, group: "movement", topic: "a-workout" },
  { slug: "movement-gate", title: "A racing heart isn't a workout", seconds: 16, group: "movement", topic: "a-workout" },
  { slug: "walking-pace", title: "Walking pace", seconds: 14, group: "movement", topic: "steps" },
  { slug: "longest-sit", title: "Your longest sit", seconds: 14, group: "movement", topic: "movement-balance" },
  { slug: "sitting-vs-activity", title: "Does an hour of activity cancel eight hours of sitting?", seconds: 44, group: "movement", topic: "movement-balance" },
  { slug: "rhr-hrr", title: "Resting heart rate and 1-minute recovery", seconds: 54, group: "sleep-heart", topic: "today-tiles" },
  { slug: "2026-10-02-sleep-regularity", title: "Sleep regularity", seconds: 14, group: "sleep-heart", topic: "sleep-rhythm" },
  { slug: "sleep-7-or-8", title: "Seven hours or eight? Duration, regularity and Verve", seconds: 59, group: "sleep-heart", topic: "sleep-rhythm" },
  { slug: "rhr-your-normal", title: "Resting heart rate against your normal", seconds: 14, group: "sleep-heart", topic: "resting-heart-rate" },
  { slug: "hr-recovery", title: "Heart rate recovery: the line is 12", seconds: 14, group: "sleep-heart", topic: "heart-rate-recovery" },
  { slug: "arc-hrv-baseline", title: "Heart rate variability: your own baseline, not a population number", seconds: 95, group: "sleep-heart", topic: "night-hrv", youtube: true },
  { slug: "apob", title: "ApoB", seconds: 14, group: "body", topic: "heart-health" },
  { slug: "lpa", title: "Lp(a): test it once", seconds: 14, group: "body", topic: "heart-health" },
  { slug: "arc-cholesterol-2026", title: "Cholesterol: the 2026 guideline makes LDL the target", seconds: 62, group: "body", topic: "heart-health", youtube: true },
  { slug: "insulin-upstream", title: "Glucose rises last: insulin and HOMA-IR", seconds: 29, group: "body", topic: "body-phenotyping" },
  { slug: "prediabetes-lifestyle", title: "Prediabetes: can lifestyle stop diabetes?", seconds: 32, group: "body", topic: "body-phenotyping", youtube: true },
  { slug: "bp-safe-limit", title: "Is there a safe limit to blood pressure?", seconds: 39, group: "body", topic: "body-phenotyping" },
  { slug: "sprint-under-120", title: "Blood pressure: is a target under 120 worth it?", seconds: 48, group: "body", topic: "body-phenotyping", youtube: true },
  { slug: "grip-strength", title: "Grip strength", seconds: 14, group: "body", topic: "muscle-health" },
  { slug: "intrinsic-capacity", title: "Intrinsic capacity: what you can still do", seconds: 54, group: "body", topic: "intrinsic-capacity" },
  { slug: "verve-intro", title: "Introducing Verve", seconds: 30, group: "how-verve-works", youtube: true },
  { slug: "f01-download-signin", title: "Getting started: download Verve and sign in", seconds: 59, group: "how-verve-works", youtube: true },
  { slug: "science-search", title: "Every threshold, one search", seconds: 24, group: "how-verve-works" },
  { slug: "the-guide", title: "The Guide: win, next, body", seconds: 14, group: "how-verve-works" },
  { slug: "the-guide-explained", title: "The Guide, explained (Pro)", seconds: 54, group: "how-verve-works" },
  { slug: "feature-guide", title: "Verve feature of the day: The Guide", seconds: 129, group: "how-verve-works" },
  { slug: "ascvd-prevention", title: "Built slowly, prevented daily: lifestyle and ASCVD", seconds: 56, group: "wider-picture" },
  { slug: "scot-heart-ct", title: "Heart CT scans: can a scan prevent heart attacks?", seconds: 45, group: "wider-picture", youtube: true },
  { slug: "interheart-risk-factors", title: "Heart attacks: how much does each risk factor matter?", seconds: 158, group: "wider-picture", youtube: true },
  { slug: "exercise-heart-plaque", title: "Heart plaque: can you exercise too much?", seconds: 139, group: "wider-picture", youtube: true },
  { slug: "smoking-quit-any-age", title: "Smoking: quitting at any age gives years back", seconds: 69, group: "wider-picture", youtube: true },
  { slug: "arc-marathon-cpr", title: "Marathon running: low cardiac risk. Know two things.", seconds: 85, group: "wider-picture", youtube: true },
];

export const videoSrc = (v: Video) => `/video/${v.slug}/${v.slug}.mp4`;
export const videoPoster = (v: Video) => `/video/${v.slug}/${v.slug}.jpg`;
export const videoChannel = YOUTUBE_URL;

/** The videos a science topic page carries, in order. */
export const videosForTopic = (topic: string): Video[] => VIDEOS.filter((v) => v.topic === topic);
/** Named videos, in the order named. */
export const videosBySlugs = (slugs: string[]): Video[] => slugs.map((s) => VIDEOS.find((v) => v.slug === s)).filter((v): v is Video => !!v);
export const videosInGroup = (g: VideoGroup): Video[] => VIDEOS.filter((v) => v.group === g);

/** "14 s", "1 min 25 s", "2 min". */
export function fmtSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}
