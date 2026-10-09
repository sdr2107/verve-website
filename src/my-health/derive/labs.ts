/**
 * The lab values, grouped the way the Labs tab shows them: section →
 * canonical analyte → readings by date. Pure.
 */
import { canonName } from "../../lib/canon.js";
import { inRange } from "./markers.ts";

export const SECTIONS: Record<string, string> = {
  metabolic: "Metabolic", heart: "Heart", muscle: "Muscle",
  haematology: "Haematology", lipids: "Lipids", liver: "Liver", kidney: "Kidney",
  thyroid: "Thyroid", vitamins_iron: "Vitamins & iron", hormones: "Hormones",
  inflammation: "Inflammation", urine: "Urine", imaging: "Imaging", other: "Other",
};
export const SECTION_ORDER = Object.keys(SECTIONS);

export function groupLabs(labs: any[]): Map<string, Map<string, any[]>> {
  const secs = new Map<string, Map<string, any[]>>();
  for (const r of labs) {
    const s = SECTIONS[r.section] ? r.section : "other";
    const sec = secs.get(s) ?? secs.set(s, new Map()).get(s)!;
    const key = canonName(String(r.analyte));
    (sec.get(key) ?? sec.set(key, []).get(key)!).push(r);
  }
  return secs;
}

/** How many series there are, and how many latest values sit outside their lab's own range. */
export function labsJudged(labs: any[]): { outside: number; judged: number } {
  let outside = 0, judged = 0;
  for (const m of groupLabs(labs).values()) for (const rs of m.values()) { const ok = inRange(rs[rs.length - 1]); if (ok !== null) judged++; if (ok === false) outside++; }
  return { outside, judged };
}
