/**
 * Download the page's data — the person's own, or what a shared page lets a
 * coach or clinician see. One source: the same MyHealthDocument the page
 * draws from, so the file can never hold more than the page shows (row-level
 * security already filtered it by scope) and never less.
 *
 *   JSON  everything, grouped, the rows as stored
 *   CSV   one long table a spreadsheet can filter:
 *         kind, date, measure, value, unit, ref_low, ref_high, source, detail
 *
 * Wide rows (the app's lab_readings, daily_signals, imported weeks) become one
 * line per filled column, so a lab panel of eight values is eight lines.
 */
import type { MyHealthDocument } from "./document";

const HEAD = ["kind", "date", "measure", "value", "unit", "ref_low", "ref_high", "source", "detail"] as const;
type Row = Partial<Record<(typeof HEAD)[number], unknown>>;

/** Columns that are bookkeeping, not measurements. */
const SKIP = new Set([
  "id", "user_id", "person_id", "created_at", "updated_at", "deleted_at", "synced_at", "measured_at", "measured_on",
  "day", "week_start", "source", "import_tag", "assessment_id", "report_path", "note", "notes",
]);

/** A unit read off a column's suffix: glucose_mgdl → mg/dL. Unknown suffixes stay blank rather than guessed. */
function unitOf(col: string): string {
  const m: [RegExp, string][] = [
    [/_mgdl$/, "mg/dL"], [/_mgl$/, "mg/L"], [/_mmoll$/, "mmol/L"], [/_nmoll$/, "nmol/L"], [/_pct$/, "%"],
    [/_kg$/, "kg"], [/_cm$/, "cm"], [/_bpm$/, "bpm"], [/_ms$/, "ms"], [/_min(utes)?$/, "min"], [/_h(ours)?$/, "h"],
    [/_kcal$/, "kcal"], [/_uiuml$/, "µIU/mL"], [/^(sbp|dbp)$/, "mmHg"], [/met_hours$/, "MET-h"],
  ];
  return m.find(([re]) => re.test(col))?.[1] ?? "";
}

function wide(kind: string, rows: any[], dateKey: string, source?: string): Row[] {
  const out: Row[] = [];
  for (const r of rows ?? []) {
    for (const [k, v] of Object.entries(r)) {
      if (SKIP.has(k) || v == null || v === "" || typeof v === "object") continue;
      if (k.endsWith("_unit")) continue;
      const unit = r[`${k.replace(/_value$/, "")}_unit`] ?? unitOf(k);
      out.push({ kind, date: r[dateKey], measure: k, value: v, unit, source: r.source ?? source ?? "" });
    }
  }
  return out;
}

export function exportRows(d: MyHealthDocument): Row[] {
  const rows: Row[] = [];
  for (const l of d.labs ?? []) rows.push({ kind: "lab", date: l.measured_on, measure: l.analyte, value: l.value, unit: l.unit, ref_low: l.ref_low, ref_high: l.ref_high, source: "report", detail: l.section ?? l.ref_text ?? "" });
  rows.push(...wide("lab", d.app_labs, "measured_at", "app"));
  for (const i of d.imaging ?? []) rows.push({ kind: "imaging", date: i.report_date, measure: i.modality, value: i.impression, source: "report" });
  for (const a of d.activities ?? []) rows.push({
    kind: "activity", date: a.timestamp, measure: a.activity_name || a.activity_type, value: a.duration_minutes, unit: "min", source: a.source,
    detail: [a.met_hours != null ? `${a.met_hours} MET-h` : "", a.intensity_category ?? "", a.zone2_minutes ? `Zone 2 ${a.zone2_minutes} min` : "", a.effort != null ? `effort ${a.effort}/10` : ""].filter(Boolean).join(" · "),
  });
  rows.push(...wide("week", d.weeks, "week_start", "import"));
  for (const c of d.app_crf ?? []) rows.push({ kind: "fitness_test", date: c.timestamp, measure: c.estimation_method, value: c.met_capacity, unit: "METs", source: "app", detail: [c.performance_category, c.vo2_max_estimate != null ? `VO2max ${c.vo2_max_estimate} mL/kg/min` : ""].filter(Boolean).join(" · ") });
  for (const c of d.web_crf ?? []) rows.push({ kind: "fitness_test", date: c.measured_on, measure: c.method, value: c.met_capacity, unit: "METs", source: "import", detail: c.vo2max != null ? `VO2max ${c.vo2max} mL/kg/min` : "" });
  for (const w of d.waist ?? []) rows.push({ kind: "body", date: w.measured_at, measure: "waist", value: w.waist_cm, unit: "cm", source: "app" });
  for (const w of d.weights ?? []) rows.push({ kind: "body", date: w.measured_on, measure: "weight", value: w.weight_kg, unit: "kg", source: w.source });
  rows.push(...wide("body", d.web_body, "measured_on", "import"));
  rows.push(...wide("daily", d.signals, "day", "app"));
  return rows;
}

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCSV(d: MyHealthDocument): string {
  return [HEAD.join(","), ...exportRows(d).map((r) => HEAD.map((h) => cell(r[h])).join(","))].join("\n");
}

export function exportJSON(d: MyHealthDocument): string {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    note: "Verve export. Labs are judged against each report's own printed range; fitness tests are estimates from field or lab tests.",
    person: d.person ? { name: d.person.name, born_year: d.person.born_year } : null,
    profile: d.profile,
    labs: { from_reports: d.labs, from_app: d.app_labs },
    imaging: d.imaging,
    activities: d.activities,
    weeks: d.weeks,
    fitness_tests: { app: d.app_crf, imported: d.web_crf },
    body: { waist: d.waist, weights: d.weights, imported: d.web_body },
    daily_signals: d.signals,
  }, null, 2);
}

/** Hand the browser a file. */
export function download(text: string, name: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
