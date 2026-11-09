/**
 * One person's page, derived from their document: the rows merged the way
 * the page merges them (the app's over the imports' on the same key), the
 * readings of every marker by chart key, the weekly goal, and the markers
 * themselves. Computed once per document and kept: the same document
 * gives the same object, so nothing downstream recomputes for nothing.
 */
import type { MyHealthDocument } from "../document.ts";
import { bodyFromSync, crfFromSync, isWorkout, mergeBy, mergeWeeks, type WeekRow } from "./activity.ts";
import { markerPointsFrom, type Pt } from "./markers.ts";
import { buildMarkers, type Marker } from "./lenses.ts";
import { withLipidRatios } from "./lipids.ts";

export interface PersonData {
  doc: MyHealthDocument;
  /** The person has an account of their own: the app's rows exist. */
  synced: boolean;
  labs: any[];
  /** The report rows, each LDL tagged with its method, plus the computed lipid rows (derive/lipids: the two ratios and remnant cholesterol): what the Labs tab lists and judges. Exports and report echoes read `labs`. */
  labsShown: any[];
  imaging: any[];
  app: any[];
  exportRows: { weeks: any[]; crf: any[]; body: any[] };
  /** The weeks as the page reads them: the app's row where it wrote one, the browser's count where not, an import's hours where neither (derive/activity mergeWeeks). */
  weeks: WeekRow[];
  crf: any[];
  body: any[];
  acts: any[];
  profile: any;
  signals: any[];
  weights: any[];
  /** Every reading of every marker, by chart key. */
  by: Map<string, Pt[]>;
  goal: number;
  markers: Marker[];
  markerByKey: (k: string) => Marker | undefined;
}

let memo: PersonData | null = null;

export function derivePerson(doc: MyHealthDocument): PersonData {
  if (memo && memo.doc === doc) return memo;
  const synced = !!doc.person?.account_id;
  const acts = synced ? doc.activities.filter(isWorkout) : [];
  const crf = mergeBy("measured_on", synced ? crfFromSync(doc.app_crf) : [], doc.web_crf);
  const weeks = mergeWeeks(doc.weeks, synced ? acts : []);
  const body = mergeBy("measured_on", synced ? bodyFromSync(doc.waist) : [], doc.web_body);
  const profile = synced ? doc.profile : null;
  const signals = synced ? doc.signals : [];
  const weights = synced ? doc.weights : [];
  const by = markerPointsFrom(doc.labs, doc.app_labs, body, signals);
  const markers = buildMarkers({ signals, acts, weights, profile, crf, weeks, app: doc.app_labs, by });
  const out: PersonData = {
    doc, synced,
    labs: doc.labs, labsShown: withLipidRatios(doc.labs, profile), imaging: doc.imaging, app: doc.app_labs,
    exportRows: { weeks: doc.weeks, crf: doc.web_crf, body: doc.web_body },
    weeks, crf, body, acts, profile, signals, weights, by,
    goal: Number(profile?.weekly_met_hours_goal) || 7.5,
    markers,
    markerByKey: (k) => markers.find((m) => m.key === k),
  };
  memo = out;
  return out;
}
