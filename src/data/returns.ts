/**
 * returns — why a person comes back to Verve, said once, used on the home
 * page and on /start (4 Nov 2026).
 *
 * The founder's framing: a wearable's own app says how you are today —
 * recovery, strain, a sleep score — and does it well. Verve does not compete
 * there. It reads the measures that predict how long and how well a person
 * lives, from whatever they wear, against the thresholds clinicians use.
 * Four returns, one per cadence. No wearable is named: Verve is software for
 * any of them, and copy that names one dates itself.
 */
export interface Return {
  cadence: "Daily" | "Weekly" | "Quarterly" | "Yearly";
  title: string;
  body: string;
  href: string;
  cta: string;
}

export const RETURNS_INTRO =
  "Your wearable's app tells you how you are today, and does it well. Verve reads the measures that predict how long and how well you live — fitness in METs against your age and sex, the weekly dose against the ACC's figure, sleep regularity, the markers a clinic would order — from whatever you wear, with the study behind every line.";

export const RETURNS: Return[] = [
  {
    cadence: "Daily",
    title: "The dose this week",
    body: "One bar that fills by Sunday, in MET-minutes, from any wearable, each reading named by the device that wrote it.",
    href: "/science#weekly-dose",
    cta: "Why MET-minutes",
  },
  {
    cadence: "Weekly",
    title: "The Monday read",
    body: "What changed last week and what to do about it, in words, grounded in your own numbers. One a week free; more with Pro.",
    href: "/plans",
    cta: "The Guide",
  },
  {
    cadence: "Quarterly",
    title: "The calendar of measurements",
    body: "A fitness test every eight weeks, the body check-in, the labs on the interval their guideline names. Verve keeps the dates and nudges once.",
    href: "/science#crf",
    cta: "How fitness is graded",
  },
  {
    cadence: "Yearly",
    title: "The report for your doctor",
    body: "Drop a lab report here and the values file themselves. The page you take to the doctor is built from everything the app and the site hold.",
    href: "/my-health",
    cta: "My health",
  },
];
