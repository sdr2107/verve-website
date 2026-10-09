/**
 * The report archive, as a function of the document: every file in the
 * person's folder with what came out of it (the values filed under its
 * path, the study's own words), the duplicates among them, what each
 * report still has for the app, the imports the app's exports left, and
 * the years with movement on file. Pure.
 */
import { canonName, unitKey } from "../../lib/canon.js";
import { fmtDay, localDay } from "./format.ts";
import { LABELS, appKeyFor, inRange } from "./markers.ts";
import { dateHay, landsAll, searchTermsOf } from "./labs.ts";

export const REPORT_EXT = /\.(pdf|jpe?g|png|webp)$/i;
export const isPhotoName = (name: string) => /\.(jpe?g|png|webp)$/i.test(name);
/** The stored name, as a title: the upload stamp off, underscores as spaces, no extension. */
export const pretty = (name: string | undefined) => (name ?? "").replace(/^\d+-/, "").replace(REPORT_EXT, "").replace(/_/g, " ");
/** The upload time, from the stamp the upload put in front of the name. */
export const stampOf = (name: string) => Number((name.match(/^(\d+)-/) ?? [])[1] ?? 0);
export const APP_KEYS = Object.keys(LABELS);

/** The app stores one unit per marker; a value in another unit is not sent from the archive. */
export function unitFits(key: string, unit: string | null): boolean {
  if (key === "lpa_value") return true;
  const want = LABELS[key].unit;
  if (!want) return true;
  return unitKey(unit ?? "") === unitKey(want);
}

export type AppBound = { key: string; value: number; unit: string | null; name: string };
/** A report's app-bound values: the archived rows under its path whose canonical name is one of the app's markers, in the app's unit. The app tier is the account's own. */
export function appBoundFor(labs: any[], path: string, self: boolean): { date: string; values: AppBound[] } {
  if (!self) return { date: "", values: [] };
  if (path.startsWith("export:")) return { date: "", values: [] };   // came from the app: nothing to send back
  const rows = labs.filter((r) => r.report_path === path);
  const values: AppBound[] = [];
  for (const r of rows) {
    const key = appKeyFor(r.analyte);
    if (!key || values.some((v) => v.key === key) || !unitFits(key, r.unit) || !Number.isFinite(Number(r.value))) continue;
    values.push({ key, value: Number(r.value), unit: r.unit ?? null, name: String(r.analyte) });
  }
  return { date: rows[0]?.measured_on ?? "", values };
}
/** One is "sent" when a lab_readings row on the same day carries that value. */
export function isSent(app: any[], date: string, key: string, value: number): boolean {
  return app.some((a) => localDay(a.measured_at) === date && Number(a[key]) === value);
}
export function reportAppState(labs: any[], app: any[], path: string, self: boolean) {
  const { date, values } = appBoundFor(labs, path, self);
  const pending = values.filter((v) => !isSent(app, date, v.key, v.value));
  const unchecked = app
    .filter((a) => a.report_path === path && a.review_status === "unchecked")
    .reduce((n, a) => n + APP_KEYS.filter((k) => a[k] != null).length, 0);
  return { date, total: values.length, sent: values.length - pending.length, pending, unchecked };
}
/** Reports with app-bound values not yet sent, newest first. */
export function pendingReports(labs: any[], app: any[], self: boolean): string[] {
  const paths = [...new Set(labs.map((r) => r.report_path).filter(Boolean))] as string[];
  return paths
    .filter((p) => reportAppState(labs, app, p, self).pending.length > 0)
    .sort((a, b) => (appBoundFor(labs, b, self).date || "").localeCompare(appBoundFor(labs, a, self).date || ""));
}
/** Values sent as they were read and not yet looked over in the app. */
export function uncheckedInApp(app: any[], self: boolean): number {
  if (!self) return 0;
  return app.filter((a) => a.review_status === "unchecked").reduce((n, a) => n + APP_KEYS.filter((k) => a[k] != null).length, 0);
}

/** Copies of one file: the same ETag, or the same size and name. The oldest is the original. */
export function findDuplicates(files: any[]): Map<string, string> {
  const dupOf = new Map<string, string>();
  const groups = new Map<string, any[]>();
  for (const f of files) {
    const tag = f.metadata?.eTag ? `etag:${f.metadata.eTag}` : `size:${f.metadata?.size ?? "?"}|${pretty(f.name).toLowerCase()}`;
    (groups.get(tag) ?? groups.set(tag, []).get(tag)!).push(f);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((x, y) => stampOf(x.name) - stampOf(y.name));
    for (const f of g.slice(1)) dupOf.set(f.name, g[0].name);
  }
  return dupOf;
}

export interface ReportCard {
  f: any; name: string; path: string; date: string; uploaded: string;
  o: { date: string; n: number; flagged: number } | null;
  im: any | null;
  original: string | null;
  /** A copy whose original is here, and not kept on purpose. */
  flagged: boolean;
  app: ReturnType<typeof reportAppState> | null;
}
export interface ReportYear { year: string; months: Array<{ month: string; name: string; cards: ReportCard[] }> }

/** The archive, a year at a time, newest first; inside a year a month at a time. */
export function reportYears(files: any[], labs: any[], app: any[], imaging: any[], folder: string, self: boolean, kept: Set<string>, query: string): { years: ReportYear[]; shown: number; total: number } {
  const reports = files.filter((f) => REPORT_EXT.test(f.name));
  // what each report yielded, from the one web_labs fetch
  const outcomes = new Map<string, { date: string; n: number; flagged: number }>();
  for (const r of labs) {
    if (!r.report_path) continue;
    const o = outcomes.get(r.report_path) ?? { date: r.measured_on, n: 0, flagged: 0 };
    o.n++; if (inRange(r) === false) o.flagged++;
    o.date = r.measured_on;
    outcomes.set(r.report_path, o);
  }
  const imagingByPath = new Map(imaging.map((im) => [im.report_path, im]));
  const dupOf = findDuplicates(reports);
  // each file's date: the report's own, else the imaging report's, else the
  // upload's. A copy has no filed values of its own, so it takes its
  // original's date and sits beside it.
  const dated: ReportCard[] = reports.map((f) => {
    const path = `${folder}/${f.name}`;
    const o = outcomes.get(path) ?? null;
    const im = imagingByPath.get(path) ?? null;
    const uploaded = stampOf(f.name) ? new Date(stampOf(f.name)).toISOString().slice(0, 10) : "";
    const original = dupOf.get(f.name) ?? null;
    return { f, name: f.name, path, o, im, date: o?.date ?? im?.report_date ?? uploaded, uploaded, original, flagged: original != null && !kept.has(f.name), app: o ? reportAppState(labs, app, path, self) : null };
  });
  const byName = new Map(dated.map((d) => [d.name, d]));
  for (const d of dated) if (d.original && !d.o && !d.im && byName.get(d.original)?.date) d.date = byName.get(d.original)!.date;
  dated.sort((x, y) => (y.date || "").localeCompare(x.date || "") || stampOf(y.name) - stampOf(x.name));
  // the search: a report matches when every word lands in its name, its date, a value read from it, or its study
  const terms = searchTermsOf(query);
  const hayByPath = new Map<string, string>();
  if (terms.length) {
    for (const r of labs) if (r.report_path) hayByPath.set(r.report_path, `${hayByPath.get(r.report_path) ?? ""} ${canonName(String(r.analyte))} ${r.value}${r.unit ? ` ${r.unit}` : ""}`.toLowerCase());
    for (const im of imaging) if (im.report_path) hayByPath.set(im.report_path, `${hayByPath.get(im.report_path) ?? ""} ${im.modality} imaging ${im.modality === "echo" ? "2d echo echocardiogram" : ""} ${im.impression ?? ""}`.toLowerCase());
  }
  const shown = terms.length ? dated.filter((d) => landsAll(`${pretty(d.name)} ${dateHay(d.date)} ${hayByPath.get(d.path) ?? ""}`.toLowerCase(), terms)) : dated;
  const years = new Map<string, ReportCard[]>();
  for (const d of shown) { const y = d.date ? d.date.slice(0, 4) : "Undated"; (years.get(y) ?? years.set(y, []).get(y)!).push(d); }
  const monthName = (d: string) => new Date(d.slice(0, 7) + "-01T00:00:00").toLocaleDateString(undefined, { month: "long" });
  const out: ReportYear[] = [...years.entries()].map(([year, list]) => {
    const months = new Map<string, ReportCard[]>();
    for (const d of list) { const m = d.date ? d.date.slice(0, 7) : ""; (months.get(m) ?? months.set(m, []).get(m)!).push(d); }
    return { year, months: [...months.entries()].map(([month, cards]) => ({ month, name: month ? monthName(month) : "", cards })) };
  });
  return { years: out, shown: shown.length, total: dated.length };
}

export interface AppImport { tag: string; kind: "export" | "csv"; exported: string; imported: string; weeks: number; crf: number; body: number; labs: number; sessions: number; from: string; to: string }
/** The app's exports and CSVs dropped here: one line each, rebuilt from the rows they left. */
export function appImportsOf(exportRows: { weeks: any[]; crf: any[]; body: any[] }, labs: any[]): AppImport[] {
  const by = new Map<string, AppImport>();
  const isTag = (t: unknown): t is string => typeof t === "string" && (t.startsWith("export:") || t.startsWith("csv:"));
  const get = (tag: string) => {
    if (by.has(tag)) return by.get(tag)!;
    const [kind, exported = "", stamp = ""] = tag.split(":");
    const imp: AppImport = {
      tag, kind: kind === "csv" ? "csv" : "export", exported: /^\d{4}-\d{2}-\d{2}$/.test(exported) ? exported : "",
      imported: /^\d{10,}$/.test(stamp) ? new Date(Number(stamp)).toLocaleDateString("en-CA") : "",
      weeks: 0, crf: 0, body: 0, labs: 0, sessions: 0, from: "", to: "",
    };
    by.set(tag, imp);
    return imp;
  };
  for (const w of exportRows.weeks) if (isTag(w.import_tag)) {
    const im = get(w.import_tag); im.weeks++; im.sessions += Number(w.workouts) || 0;
    const ws = String(w.week_start); if (!im.from || ws < im.from) im.from = ws; if (!im.to || ws > im.to) im.to = ws;
  }
  for (const c of exportRows.crf) if (isTag(c.import_tag)) get(c.import_tag).crf++;
  for (const b of exportRows.body) if (isTag(b.import_tag)) get(b.import_tag).body++;
  for (const r of labs) if (isTag(r.report_path)) get(r.report_path).labs++;
  return [...by.values()].sort((a, b) => b.tag.localeCompare(a.tag));
}
export function appImportWords(im: AppImport): string {
  const n = (k: number, one: string, many: string) => k ? `${k} ${k === 1 ? one : many}` : "";
  return im.kind === "csv"
    ? [n(im.weeks, "week", "weeks"), n(im.sessions, "session", "sessions"), im.from && im.to ? (im.from.slice(0, 4) === im.to.slice(0, 4) ? im.from.slice(0, 4) : `${im.from.slice(0, 4)} to ${im.to.slice(0, 4)}`) : "", "MET-hours estimated from heart rate"].filter(Boolean).join(" · ")
    : [n(im.weeks, "week", "weeks"), n(im.crf, "fitness test", "fitness tests"), n(im.body, "waist day", "waist days"), n(im.labs, "lab value", "lab values")].filter(Boolean).join(" · ");
}
export const importTitle = (im: AppImport) => im.kind === "csv" ? "Workouts CSV" : `Export of ${im.exported ? fmtDay(im.exported) : "an unknown date"}`;

/** Every year with movement on file: weeks with a session, and whether every one came from a CSV. */
export function yearsOnFile(weeks: any[]): { years: Array<{ year: string; weeks: number; csvOnly: boolean }>; total: number; max: number } {
  const by = new Map<string, { weeks: number; csvOnly: boolean }>();
  for (const w of weeks) {
    if (!(Number(w.minutes) > 0 || Number(w.workouts) > 0 || Number(w.met_hours) > 0)) continue;
    const y = String(w.week_start).slice(0, 4);
    const e = by.get(y) ?? { weeks: 0, csvOnly: true };
    e.weeks++; if (w.source !== "csv") e.csvOnly = false;
    by.set(y, e);
  }
  const years = [...by.keys()].sort().map((year) => ({ year, ...by.get(year)! }));
  return { years, total: years.reduce((t, y) => t + y.weeks, 0), max: Math.max(1, ...years.map((y) => y.weeks)) };
}
