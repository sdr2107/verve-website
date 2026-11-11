/**
 * returns — why a person comes back to Verve, said once (4 Nov 2026; cut to
 * one line each for the landing page, 11 Nov 2026, board 01).
 *
 * The founder's framing: a wearable's own app says how you are today —
 * recovery, strain, a sleep score — and does it well. Verve does not compete
 * there. It says where you stand, from whatever you wear, against the
 * thresholds clinicians use. Four returns, one per cadence. No wearable is
 * named: Verve is software for any of them, and copy that names one dates
 * itself. No promise about anyone's lifespan is made here or anywhere on
 * the site; the studies' findings are cited in their own terms.
 */
export interface Return {
  cadence: "Daily" | "Weekly" | "Quarterly" | "Yearly";
  title: string;
  /** One short line: what it is. */
  line: string;
}

export const RETURNS: Return[] = [
  { cadence: "Daily", title: "The dose this week", line: "One bar that fills by Sunday." },
  { cadence: "Weekly", title: "The Monday read", line: "What changed, in words." },
  { cadence: "Quarterly", title: "The calendar of measurements", line: "Verve keeps the dates." },
  { cadence: "Yearly", title: "The page for your doctor", line: "Built from everything on file." },
];
