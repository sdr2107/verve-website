/**
 * The science section's table of contents — one list that builds everything.
 *
 * The four subject pages, the hub's topic index, each page's "On this page"
 * nav, the counts in the opening line, and the anchor-forwarding map on
 * /science all read from here. That is the point: splitting one page into
 * four moved ten addresses the app links to, and a hand-maintained redirect
 * list is a thing someone forgets to update. Add a topic here and it appears
 * on its page, in the index, in the counts, and in the forwarding map at the
 * same time, or it does not exist at all.
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
}

export interface Topic {
  /** The anchor id. The app links to some of these; none of them may change. */
  slug: string;
  label: string;
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
    icon: "M3 12h4l3-8 4 16 3-8h4"
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
    icon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"
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
  { slug: "mets-vs-met-h", label: "METs vs MET-hours", subject: "fitness", citations: [] },
  { slug: "crf", label: "Cardiorespiratory fitness", subject: "fitness", citations: CRF_SECTION },
  {
    slug: "test-crf",
    label: "Test your CRF",
    subject: "fitness",
    citations: TEST_CRF_SECTION,
    subAnchors: ["two-windows"],
  },
  { slug: "test-accuracy", label: "How accurate each test is", subject: "fitness", citations: [] },
  { slug: "run-protocols", label: "The run protocols", subject: "fitness", citations: [] },

  // ── Movement ───────────────────────────────────────────────────────────
  { slug: "weekly-volume", label: "Weekly volume", subject: "movement", citations: WEEKLY_VOLUME_SECTION },
  {
    slug: "zone-2",
    label: "Zone 2 training",
    subject: "movement",
    citations: [...ZONE2_SECTION, ...ZONE2_HR_SECTION],
  },
  { slug: "strength-training", label: "Strength training", subject: "movement", citations: [] },
  { slug: "steps", label: "Steps & cadence", subject: "movement", citations: STEPS_SECTION },
  {
    slug: "movement-balance",
    label: "Movement balance",
    subject: "movement",
    citations: [...MOVEMENT_BALANCE_SECTION, ...SEDENTARY_EXTRA],
  },
  { slug: "activity-level", label: "Physical activity level", subject: "movement", citations: [] },

  // ── Sleep & heart ──────────────────────────────────────────────────────
  { slug: "today-tiles", label: "The morning read", subject: "sleep-heart", citations: [] },
  {
    slug: "sleep-rhythm",
    label: "Sleep timing",
    subject: "sleep-heart",
    citations: SLEEP_RHYTHM_SECTION,
    subAnchors: ["connect-wearables"],
  },
  { slug: "sleep-and-training", label: "Sleep and training", subject: "sleep-heart", citations: SLEEP_TRAINING_SECTION },
  { slug: "resting-heart-rate", label: "Resting heart rate", subject: "sleep-heart", citations: RESTING_HR_SECTION },
  { slug: "heart-rate-recovery", label: "Heart rate recovery", subject: "sleep-heart", citations: HEART_RATE_RECOVERY_SECTION },

  // ── Body ───────────────────────────────────────────────────────────────
  { slug: "heart-health", label: "Heart health", subject: "body", citations: HEART_HEALTH_SECTION },
  {
    slug: "body-phenotyping",
    label: "Body phenotyping",
    subject: "body",
    citations: BODY_PHENOTYPING_SECTION,
    subAnchors: ["health-picture", "body-markers"],
  },
  { slug: "muscle-health", label: "Muscle health", subject: "body", citations: MUSCLE_HEALTH_SECTION },
  { slug: "intrinsic-capacity", label: "Intrinsic capacity", subject: "body", citations: [] },
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

/**
 * Anchor → the page it now lives on. Every topic slug and every sub-anchor,
 * derived from TOPICS above, which is why a new topic cannot be left out of
 * it. /science reads this at load and forwards before the first paint.
 */
export const ANCHOR_PAGE: Record<string, string> = Object.fromEntries(
  TOPICS.flatMap((t) =>
    [t.slug, ...(t.subAnchors ?? [])].map((a) => [a, `/science/${t.subject}`]),
  ),
);
