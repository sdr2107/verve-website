/**
 * The letter's list, as its reader sees it: what a row's state is, the counts, the weeks, the doors, the posts,
 * the file that can be downloaded and the file that can be brought in. (Canvas "Verve, Horizon as a programme",
 * board 29; 19 November 2026.)
 *
 * The list is ONE table, newsletter_signups (METTracker supabase/migrations/20261121_one_list.sql). Every door
 * writes a row there and nothing is carried anywhere by hand. This file reads rows and counts them. It sends
 * nothing and changes nothing.
 *
 * A row is in exactly one state:
 *   stopped     Unsubscribe was pressed. The row stays, so the address is never added again by mistake.
 *   confirmed   "Yes, send me the weekly letter" was pressed, or an account added its own verified address.
 *   waiting     The welcome has gone, or is about to, and no press has been made.
 *
 * Pure; tests/list.test.mjs.
 */
import { addDays, mondayOf } from "../derive/format.ts";

export type ListRow = {
  id: string; email: string; consented_at: string; source: string; tag: string | null;
  confirmed_at: string | null; welcome_sent_at: string | null; unsubscribed_at: string | null;
  consent_text?: string | null; user_id?: string | null;
};
export type RowState = "stopped" | "confirmed" | "waiting";
export const stateOf = (r: ListRow): RowState => (r.unsubscribed_at ? "stopped" : r.confirmed_at ? "confirmed" : "waiting");

/** The doors, in the order the page lists them; a door the page does not know is shown by its own name. */
export const DOORS: Record<string, string> = {
  horizon: "The Horizon page", start: "/start and /sheet", newsletter: "The newsletter page", app: "The app's question", "my-health": "My health's question", substack: "Substack, copied in",
};
export const doorWords = (source: string): string => DOORS[source] ?? source;

/** The local day an instant falls on, as YYYY-MM-DD in the reader's own zone. */
export const dayOf = (iso: string): string => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA"); };

export type ListCounts = { all: number; confirmed: number; waiting: number; stopped: number; thisWeek: number; lastWeek: number; today: number };
/** The six figures at the top. A week is Monday to Sunday in the reader's zone; "new" counts by the day a row was written. */
export function countsOf(rows: ListRow[], today: string): ListCounts {
  const monday = mondayOf(new Date(today + "T00:00:00")), before = addDays(monday, -7);
  const c: ListCounts = { all: rows.length, confirmed: 0, waiting: 0, stopped: 0, thisWeek: 0, lastWeek: 0, today: 0 };
  for (const r of rows) {
    c[stateOf(r)]++;
    const d = dayOf(r.consented_at);
    if (d === today) c.today++;
    if (d >= monday && d <= today) c.thisWeek++;
    else if (d >= before && d < monday) c.lastWeek++;
  }
  return c;
}

/** New addresses in each of the last `n` weeks, oldest first; the last is the week today is in. */
export function weeksOf(rows: ListRow[], today: string, n = 12): { monday: string; count: number; now: boolean }[] {
  const thisMonday = mondayOf(new Date(today + "T00:00:00"));
  const out = Array.from({ length: n }, (_, i) => ({ monday: addDays(thisMonday, -7 * (n - 1 - i)), count: 0, now: i === n - 1 }));
  const at = new Map(out.map((w, i) => [w.monday, i]));
  for (const r of rows) {
    const d = dayOf(r.consented_at);
    if (!d) continue;
    const i = at.get(mondayOf(new Date(d + "T00:00:00")));
    if (i != null) out[i].count++;
  }
  return out;
}

/** How many rows came through each door, largest first; on a tie, in the page's own order of doors. */
export function byDoor(rows: ListRow[]): { source: string; label: string; count: number }[] {
  const n = new Map<string, number>();
  for (const r of rows) n.set(r.source, (n.get(r.source) ?? 0) + 1);
  const order = Object.keys(DOORS);
  const place = (s: string) => { const i = order.indexOf(s); return i < 0 ? order.length : i; };
  return [...n.entries()].map(([source, count]) => ({ source, label: doorWords(source), count }))
    .sort((a, b) => b.count - a.count || place(a.source) - place(b.source) || a.source.localeCompare(b.source));
}

/**
 * Which post brought an address, for the rows that came through a door a post's link can open (a tag is kept only
 * there). Largest first, then "No tag" last. `of` is how many rows that is.
 */
export function byTag(rows: ListRow[], source = "horizon"): { of: number; rows: { tag: string | null; count: number }[] } {
  const mine = rows.filter((r) => r.source === source);
  const n = new Map<string, number>(); let none = 0;
  for (const r of mine) { if (r.tag) n.set(r.tag, (n.get(r.tag) ?? 0) + 1); else none++; }
  const tagged = [...n.entries()].map(([tag, count]) => ({ tag: tag as string | null, count })).sort((a, b) => b.count - a.count || String(a.tag).localeCompare(String(b.tag)));
  return { of: mine.length, rows: [...tagged, ...(none ? [{ tag: null, count: none }] : [])] };
}

/** The newest rows first, narrowed to an address that holds what was typed. */
export function newest(rows: ListRow[], find = ""): ListRow[] {
  const q = find.trim().toLowerCase();
  return rows.filter((r) => !q || r.email.toLowerCase().includes(q)).sort((a, b) => (a.consented_at < b.consented_at ? 1 : a.consented_at > b.consented_at ? -1 : 0));
}

const two = (n: number) => String(n).padStart(2, "0");
/** When a row was written, in the page's words: "4 minutes ago", "Today, 09:12", "Wed 18 Nov". */
export function whenWords(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins >= 0 && mins < 1) return "Just now";
  if (mins >= 1 && mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
  if (d.toLocaleDateString("en-CA") === now.toLocaleDateString("en-CA")) return "Today, " + two(d.getHours()) + ":" + two(d.getMinutes());
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).replace(",", "");
}
/** A row's state in the page's words; a stopped row names its day. */
export function stateWords(r: ListRow): string {
  const s = stateOf(r);
  if (s === "confirmed") return "Confirmed";
  if (s === "waiting") return "Waiting for the press";
  return "Stopped " + new Date(r.unsubscribed_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── the file that goes out ─────────────────────────────────────────────────────
const cell = (v: string) => {
  // a cell that a spreadsheet would run as a formula is written as text
  const s = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
/** The list as a file a spreadsheet opens: one line an address, newest first. */
export function listCsv(rows: ListRow[]): string {
  const head = ["address", "state", "door", "post", "written", "confirmed", "stopped"];
  const lines = newest(rows).map((r) => [r.email, stateOf(r), r.source, r.tag ?? "", r.consented_at, r.confirmed_at ?? "", r.unsubscribed_at ?? ""].map((v) => cell(String(v))).join(","));
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}

// ── the file that comes in ─────────────────────────────────────────────────────
/** One line of a comma-separated file, with quoted cells. */
function cells(line: string): string[] {
  const out: string[] = []; let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const YES = /^(true|yes|1)$/i;
export type Incoming = { rows: { email: string; subscribed_at: string | null }[]; off: number; bad: number; twice: number };
/**
 * Substack's subscriber file, read for what the list needs: an address and the day it subscribed. The column with
 * the addresses is the one named "email"; with no such heading, the first column that holds an address. A row whose
 * emails are switched off at Substack is left out and counted (`off`): that person asked for no letters. Lines with
 * no address are counted (`bad`), and an address given twice is taken once (`twice`).
 */
export function readSubstackFile(text: string): Incoming {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const out: Incoming = { rows: [], off: 0, bad: 0, twice: 0 };
  if (!lines.length) return out;
  const first = cells(lines[0]);
  const head = first.map((h) => h.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, ""));
  const hasHead = !first.some((c) => EMAIL.test(c)) && head.some((h) => h === "email" || h === "email_address");
  let iEmail = hasHead ? head.findIndex((h) => h === "email" || h === "email_address") : first.findIndex((c) => EMAIL.test(c));
  if (iEmail < 0) iEmail = 0;
  const iWhen = hasHead ? head.findIndex((h) => h === "created_at" || h === "subscription_date" || h === "subscribed_at" || h === "start_date") : -1;
  const iOff = hasHead ? head.findIndex((h) => h === "email_disabled" || h === "emails_disabled" || h === "unsubscribed") : -1;
  const seen = new Set<string>();
  for (const line of lines.slice(hasHead ? 1 : 0)) {
    const c = cells(line), email = (c[iEmail] ?? "").toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) { out.bad++; continue; }
    if (iOff >= 0 && YES.test(c[iOff] ?? "")) { out.off++; continue; }
    if (seen.has(email)) { out.twice++; continue; }
    seen.add(email);
    const when = iWhen >= 0 ? new Date(c[iWhen] ?? "") : null;
    out.rows.push({ email, subscribed_at: when && !Number.isNaN(when.getTime()) ? when.toISOString() : null });
  }
  return out;
}
