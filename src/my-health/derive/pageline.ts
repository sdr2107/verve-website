/**
 * The line under the greeting: whose page this is, and who else sees it,
 * as a sentence. A page is someone's; the relationship is said in words
 * with the name of the other side, never stamped on the person as a label
 * (canvas "What brings people back", board 08). The word "client" is never
 * a label on anyone, and no company name sits in a badge.
 *
 * Pure; tests/pageline.test.mjs runs it under node.
 */
export type ShareLite = { viewer_email: string; status: string };
export type ProLite = { email: string; role: string | null; title: string | null };

/** A grant's scopes as a sentence reads them: "activity, body and reports". Labs and imaging together are the reports. */
export function scopesInWords(scopes: string[]): string {
  const has = (k: string) => scopes.includes(k);
  const words: string[] = [];
  if (has("activity")) words.push("activity");
  if (has("body")) words.push("body");
  if (has("heart")) words.push("sleep and heart");
  if (has("labs") && has("imaging")) words.push("reports"); else if (has("labs")) words.push("labs"); else if (has("imaging")) words.push("imaging");
  if (has("notes")) words.push("notes");
  if (!words.length) return "nothing yet";
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

const dayMonth = (iso: string, today = new Date()) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", d.getFullYear() === today.getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
};

/**
 * The owner on their own page: who else sees it. One active share names the other side (a vetted professional
 * by their title and role, anyone else by the address the share was made to); several are counted; none says nothing.
 */
export function ownerLine(sharing: ShareLite[], pros: ProLite[]): { lead: string; who: string } | null {
  const active = sharing.filter((g) => g.status === "active");
  if (!active.length) return null;
  if (active.length > 1) return { lead: "Your page · shared with", who: `${active.length} people` };
  const email = String(active[0].viewer_email ?? "").toLowerCase();
  const pro = pros.find((x) => String(x.email ?? "").toLowerCase() === email);
  const name = (pro?.title ?? "").trim() || active[0].viewer_email;
  const role = pro?.role === "coach" || pro?.role === "clinician" ? pro.role : "";
  return { lead: "Your page · shared with", who: role ? `${name}, ${role}` : name };
}

/** Someone looking at a page shared with them: whose it is, since when, and what the share covers. */
export function viewerLine(name: string, since: string | null | undefined, scopes: string[], today = new Date()): { whose: string; rest: string } {
  const when = since ? dayMonth(since, today) : "";
  return { whose: `${name || "Their"}’s page`, rest: `shared with you${when ? ` since ${when}` : ""} · ${scopesInWords(scopes)}` };
}

/** A page you keep for someone without a login of their own. */
export function careLine(name: string, bornYear: number | null | undefined): { whose: string; rest: string } {
  return { whose: `${name || "Their"}’s page`, rest: `you look after it${bornYear ? ` · born ${bornYear}` : ""}` };
}

/** The chip beside a vetted professional in a list: the role is a fact about them. Nobody else carries one. */
export const roleChip = (role: string | null | undefined): string => (role === "coach" ? "Coach" : role === "clinician" ? "Clinician" : "");
