/**
 * The science section's table of contents — one list that builds everything.
 *
 * The four subject indexes, the twenty topic pages, each topic page's rail,
 * the hub's index, the counts in the opening line, and the anchor-forwarding
 * map on /science all read from here. That is the point: every topic is a
 * page now, at /science/<subject>/<slug>, and the ten addresses the app
 * links to — /science#zone-2 and the rest — have moved twice. A
 * hand-maintained redirect list is a thing someone forgets to update. Add a
 * topic here and it gets its page, its place in the index and the rail, its
 * share of the counts, and its line in the forwarding map at the same time,
 * or it does not exist at all. Its content lives in src/topics/<subject>/
 * <slug>.astro, and the build fails if that file is missing.
 */

import type { Citation } from "./science";
import {
  CRF_SECTION,
  TEST_CRF_SECTION,
  MOVEMENT_BALANCE_SECTION,
  SEDENTARY_EXTRA,
  STEPS_SECTION,
  ZONE2_SECTION,
  ZONE2_HR_SECTION,
  WEEKLY_VOLUME_SECTION,
  BODY_PHENOTYPING_SECTION,
  HEART_HEALTH_SECTION,
  MUSCLE_HEALTH_SECTION,
  SLEEP_RHYTHM_SECTION,
  RESTING_HR_SECTION,
  HEART_RATE_RECOVERY_SECTION,
  SLEEP_TRAINING_SECTION,
} from "./science";
import { BODY_MARKERS } from "./bodyMarkers";

export type SubjectSlug = "fitness" | "movement" | "sleep-heart" | "body";

export interface Subject {
  slug: SubjectSlug;
  /** Short form — breadcrumbs, prev/next links, the hub card heading. */
  label: string;
  /** The line under the heading on the hub card and at the top of the page. */
  blurb: string;
  /** Handed to the next subject's "Next:" footer — written in the second person. */
  teaser: string;
  /** <title> and og:description for the page. */
  metaTitle: string;
  metaDescription: string;
  /**
   * The subject's mark on the hub card: an accent and a glyph, from the
   * design canvas. Carried here rather than in the page so the card, and
   * anything later that wants to badge a subject, agree by construction.
   */
  accent: string;
  /** Tint behind the glyph — the accent at low alpha. */
  accentTint: string;
  /** Path data for a 24x24 stroked icon. */
  icon: string;
  /**
   * A note that rides in the rail on every page of the subject — where the
   * subject sits in the AHA statement, how to connect another wearable.
   */
  aside?: { text: string; href: string; label: string };
}

export interface Topic {
  /**
   * The anchor id, and now the last segment of the topic's address:
   * /science/<subject>/<slug>. The app links to some of these; none of them
   * may change.
   */
  slug: string;
  label: string;
  /** What the topic answers, in one line: under the heading, and in the index. */
  sub: string;
  subject: SubjectSlug;
  citations: Citation[];
  /**
   * Ids that live *inside* this topic's section. They are not topics — they do
   * not appear in the index or the counts — but they are addresses, so they
   * forward with their parent.
   */
  subAnchors?: string[];
}

/** Page order, and the order of the cards on the hub. */
export const SUBJECTS: Subject[] = [
  {
    slug: "fitness",
    label: "Fitness",
    blurb:
      "What a MET is, why it is the number Verve leads with, how to measure yours in six to twelve minutes, and how much to trust the answer.",
    teaser:
      "What a MET is, the five tiers, which test to take and how much to trust it.",
    metaTitle: "Fitness — The Science Behind Verve",
    metaDescription:
      "METs, the five cardiorespiratory fitness tiers, which test Verve offers you and how accurate each one is — every threshold traced to the study behind it.",
    accent: "#f97316",
    accentTint: "rgba(249,115,22,0.12)",
    icon: "M3 12h4l3-8 4 16 3-8h4",
    aside: {
      text: "Where this sits in the AHA statement.",
      href: "/crf-map",
      label: "Open the map",
    },
  },
  {
    slug: "movement",
    label: "Movement",
    blurb:
      "How much, how hard, how often, and how much of the rest of the day you spend sitting.",
    teaser:
      "The weekly dose, Zone 2, strength, steps, sitting, and how active your whole day is.",
    metaTitle: "Movement — The Science Behind Verve",
    metaDescription:
      "The weekly aerobic dose, the Zone 2 heart-rate band, strength minutes, steps, sitting and physical activity level — each with the research that drew the line.",
    accent: "#34d399",
    accentTint: "rgba(52,211,153,0.12)",
    icon: "M13 3l-2 9h6l-8 9 2-9H5z"
  },
  {
    slug: "sleep-heart",
    label: "Sleep & heart",
    blurb:
      "What your watch reads while you are asleep and in the minute after you stop, and what each of those readings is worth.",
    teaser:
      "Hours and stages, how steady your nights are, resting rate, and the fall after you stop.",
    metaTitle: "Sleep & heart — The Science Behind Verve",
    metaDescription:
      "Sleep timing and regularity, resting heart rate against your own normal, heart rate recovery, and how the four Today tiles are coloured.",
    accent: "#818cf8",
    accentTint: "rgba(129,140,248,0.14)",
    icon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
    aside: {
      text: "Wearing something else? Oura, Whoop and Garmin reach Verve through Apple Health.",
      href: "/science/sleep-heart/sleep-rhythm#connect-wearables",
      label: "How to connect",
    },
  },
  {
    slug: "body",
    label: "Body",
    blurb:
      "The readings that come from a cuff, a tape measure and a blood draw, in the order the Body page shows them. Each one carries the band Verve screens against and how often it is worth repeating.",
    teaser:
      "Blood pressure and lipids, waist and phenotype, grip and muscle, ageing well.",
    metaTitle: "Body — The Science Behind Verve",
    metaDescription:
      "Blood sugar, blood pressure, lipids, waist and phenotype, muscle health and intrinsic capacity — the screening band Verve uses for each, and how often to repeat it.",
    accent: "#FBBF24",
    accentTint: "rgba(251,191,36,0.12)",
    icon: "M12 8v6M8 10h8M9.5 21l2.5-7 2.5 7"
  },
];

/**
 * Every topic, in the order it appears on its page. `body-markers` is an
 * address but not a topic: it is the marker table, and the markers carry their
 * own citations in bodyMarkers.ts rather than a Citation[] here — so it rides
 * along as a sub-anchor and stays out of the topic count.
 */
export const TOPICS: Topic[] = [
  // ── Fitness ────────────────────────────────────────────────────────────
  { slug: "mets-vs-met-h", label: "METs vs MET-hours", sub: "One is how hard, the other is how much", subject: "fitness", citations: [] },
  { slug: "crf", label: "Cardiorespiratory fitness", sub: "The five tiers, and why they are read against your own age and sex", subject: "fitness", citations: CRF_SECTION },
  {
    slug: "test-crf",
    label: "Test your CRF",
    sub: "Which test you are offered, and why it might not be the hard one",
    subject: "fitness",
    citations: TEST_CRF_SECTION,
    subAnchors: ["two-windows"],
  },
  { slug: "test-accuracy", label: "How accurate each test is", sub: "What r ≈ 0.90 means, what the stars mean, and where each test stops working", subject: "fitness", citations: [] },
  { slug: "run-protocols", label: "The run protocols", sub: "What the app’s checklist is short for", subject: "fitness", citations: [] },

  // ── Movement ───────────────────────────────────────────────────────────
  { slug: "weekly-volume", label: "Weekly volume", sub: "How much per week, and why the summit sits well above 150 minutes", subject: "movement", citations: WEEKLY_VOLUME_SECTION },
  {
    slug: "zone-2",
    label: "Zone 2 training",
    sub: "The weekly target, and the personal heart-rate band behind it",
    subject: "movement",
    citations: [...ZONE2_SECTION, ...ZONE2_HR_SECTION],
  },
  { slug: "strength-training", label: "Strength training", sub: "Where the 60 minutes a week comes from, and why the app no longer draws it as a bar to clear", subject: "movement", citations: [] },
  { slug: "steps", label: "Steps & cadence", sub: "Daily step tiers and cadence zones", subject: "movement", citations: STEPS_SECTION },
  {
    slug: "movement-balance",
    label: "Movement balance",
    sub: "How Verve reads your day beyond workout minutes",
    subject: "movement",
    citations: [...MOVEMENT_BALANCE_SECTION, ...SEDENTARY_EXTRA],
  },
  { slug: "activity-level", label: "Physical activity level", sub: "How active your whole day is, and how much of that number to trust", subject: "movement", citations: [] },

  // ── Sleep & heart ──────────────────────────────────────────────────────
  { slug: "today-tiles", label: "The morning read", sub: "How the four Today tiles are coloured, and where each line comes from", subject: "sleep-heart", citations: [] },
  {
    slug: "sleep-rhythm",
    label: "Sleep timing",
    sub: "Four ways to read one bedtime diary",
    subject: "sleep-heart",
    citations: SLEEP_RHYTHM_SECTION,
    subAnchors: ["connect-wearables"],
  },
  { slug: "sleep-and-training", label: "Sleep and training", sub: "What the Guide’s sleep line is, and what it refuses to claim", subject: "sleep-heart", citations: SLEEP_TRAINING_SECTION },
  { slug: "resting-heart-rate", label: "Resting heart rate", sub: "Measured against your own normal, not a population range", subject: "sleep-heart", citations: RESTING_HR_SECTION },
  { slug: "heart-rate-recovery", label: "Heart rate recovery", sub: "One cited line, and why there is no second one", subject: "sleep-heart", citations: HEART_RATE_RECOVERY_SECTION },

  // ── Body ───────────────────────────────────────────────────────────────
  { slug: "heart-health", label: "Heart health", sub: "ApoB · LDL-C · Lp(a) · hs-CRP — screening bands, not treatment targets", subject: "body", citations: HEART_HEALTH_SECTION },
  {
    slug: "body-phenotyping",
    label: "Body phenotyping",
    sub: "Metabolic syndrome screening, beyond BMI",
    subject: "body",
    citations: BODY_PHENOTYPING_SECTION,
    subAnchors: ["health-picture", "body-markers"],
  },
  { slug: "muscle-health", label: "Muscle health", sub: "Why grip strength is in a fitness app at all", subject: "body", citations: MUSCLE_HEALTH_SECTION },
  { slug: "intrinsic-capacity", label: "Intrinsic capacity", sub: "Why grip, walking speed, chair stand and SPPB belong in the same room — and which parts of the picture Verve does not measure", subject: "body", citations: [] },
];

export const topicsFor = (subject: SubjectSlug) =>
  TOPICS.filter((t) => t.subject === subject);

export const subjectFor = (slug: SubjectSlug) =>
  SUBJECTS.find((s) => s.slug === slug)!;

/** "Subject 2 of 4", and the prev/next links at the foot of each page. */
export const subjectIndex = (slug: SubjectSlug) =>
  SUBJECTS.findIndex((s) => s.slug === slug);

export const subjectNeighbours = (slug: SubjectSlug) => {
  const i = subjectIndex(slug);
  return { prev: SUBJECTS[i - 1] ?? null, next: SUBJECTS[i + 1] ?? null };
};

const citationsIn = (subject: SubjectSlug) =>
  topicsFor(subject).reduce((n, t) => n + t.citations.length, 0);

/**
 * The three figures under the opening line, and the per-subject counts on the
 * hub cards. Counted, never typed — the old line claimed 50 citations across
 * 12 topics while the page carried 60 across 20, because both numbers were
 * written by hand and nobody updated them when a study was added.
 */
export const COUNTS = {
  citations: TOPICS.reduce((n, t) => n + t.citations.length, 0),
  topics: TOPICS.length,
  markers: BODY_MARKERS.length,
};

export const subjectCounts = (slug: SubjectSlug) => ({
  citations: citationsIn(slug),
  topics: topicsFor(slug).length,
});

/** The address of a topic's page. */
export const topicHref = (slug: string) => {
  const t = TOPICS.find((x) => x.slug === slug);
  if (!t) throw new Error(`scienceTopics: no topic "${slug}"`);
  return `/science/${t.subject}/${t.slug}`;
};

/** "Topic 2 of 5", and the prev/next links at the foot of a topic page. */
export const topicPosition = (slug: string) => {
  const t = TOPICS.find((x) => x.slug === slug)!;
  const siblings = topicsFor(t.subject);
  const i = siblings.findIndex((x) => x.slug === slug);
  return {
    n: i + 1,
    of: siblings.length,
    prev: siblings[i - 1] ?? null,
    next: siblings[i + 1] ?? null,
  };
};

/**
 * Anchor → the address it now lives at: a topic's own page, or its parent's
 * page with the anchor kept for a sub-anchor. Every topic slug and every
 * sub-anchor, derived from TOPICS above, which is why a new topic cannot be
 * left out of it. /science reads this at load and forwards before the first
 * paint; so does each subject index, for a link that carried a hash to it.
 */
export const ANCHOR_TARGET: Record<string, string> = Object.fromEntries(
  TOPICS.flatMap((t) => [
    [t.slug, topicHref(t.slug)],
    ...(t.subAnchors ?? []).map((a) => [a, `${topicHref(t.slug)}#${a}`]),
  ]),
);
