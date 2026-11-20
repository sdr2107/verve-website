/**
 * Settings › For the team › The list: every address for the letter, on one page, as it arrives (canvas "Verve,
 * Horizon as a programme", board 29; the founder, 19 November 2026: "keep everything stored at one place as a list
 * that grows live that i can follow on my desktop").
 *
 * The rows are one table. The database decides who reads them (../list/api.ts): this page is drawn only for an
 * account it answers yes to, and for anyone else there is nothing to draw. The page listens to the table, so a
 * new row appears by itself. It also reads again each minute, so a line that has dropped costs a minute at most.
 *
 * It sends no email and changes no row. Its two buttons do what they say: one writes the list to a file on this
 * computer, the other hands Substack's own file to the database, which adds each address once.
 */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayStr } from "../derive/format.ts";
import { bringIn, listen, readList, type BroughtIn } from "../list/api.ts";
import { byDoor, byTag, countsOf, listCsv, newest, readSubstackFile, stateOf, stateWords, weeksOf, whenWords, doorWords, type Incoming, type ListRow } from "../list/list.ts";

const Cap = ({ children }: { children: any }) => <span class="font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-3">{children}</span>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12.5px] leading-relaxed text-text-3">{children}</p>;
const btn = "inline-flex min-h-10 items-center rounded-[10px] border border-border-strong bg-alt px-4 text-[13.5px] font-semibold text-text transition-colors hover:border-accent-border disabled:opacity-60";
const SHOWN = 50;

export function TheList({ sb }: { sb: SupabaseClient }) {
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState("");
  const [shown, setShown] = useState(SHOWN);
  const [now, setNow] = useState(() => new Date());
  const [file, setFile] = useState<{ name: string; read: Incoming } | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  // the rows already on the page when a new one arrives, so the new one can be marked
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const load = async () => {
    const got = await readList(sb);
    if (!got) { setFailed(true); return; }
    setFailed(false);
    if (known.current) { const add = got.filter((r) => !known.current!.has(r.id)).map((r) => r.id); if (add.length) setFresh((f) => new Set([...f, ...add])); }
    known.current = new Set(got.map((r) => r.id));
    setRows(got); setNow(new Date());
  };
  useEffect(() => {
    let wait: ReturnType<typeof setTimeout> | null = null;
    void load();
    // several rows written together are read once
    const stop = listen(sb, () => { if (wait) clearTimeout(wait); wait = setTimeout(() => void load(), 400); }, setOpen);
    const each = setInterval(() => void load(), 60_000);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => { stop(); clearInterval(each); clearInterval(tick); if (wait) clearTimeout(wait); };
  }, []);

  const today = todayStr();
  const counts = useMemo(() => countsOf(rows ?? [], today), [rows, today]);
  const weeks = useMemo(() => weeksOf(rows ?? [], today), [rows, today]);
  const doors = useMemo(() => byDoor(rows ?? []), [rows]);
  const tags = useMemo(() => byTag(rows ?? []), [rows]);
  const list = useMemo(() => newest(rows ?? [], find), [rows, find]);
  const top = Math.max(1, ...weeks.map((w) => w.count));
  const last = rows && rows.length ? newest(rows)[0] : null;

  const download = () => {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([listCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `verve-letter-list-${today}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const pick = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = "";
    if (!f) return;
    setSaid("");
    if (f.size > 5_000_000) { setSaid("That file is larger than 5 MB. Substack's subscriber file is far smaller: check it is the right one."); return; }
    setFile({ name: f.name, read: readSubstackFile(await f.text()) });
  };
  const take = async () => {
    if (!file || !file.read.rows.length) return;
    setBusy(true);
    let total: BroughtIn = { added: 0, already: 0, refused: 0 }, why = "";
    // the database takes at most 5,000 in one call
    for (let i = 0; i < file.read.rows.length && !why; i += 5000) {
      const r = await bringIn(sb, file.read.rows.slice(i, i + 5000));
      if (typeof r === "string") why = r; else total = { added: total.added + r.added, already: total.already + r.already, refused: total.refused + r.refused };
    }
    setBusy(false);
    setSaid(why ? `The file was not brought in: ${why}` : `${total.added} added. ${total.already} ${total.already === 1 ? "was" : "were"} on the list already.${total.refused ? ` ${total.refused} ${total.refused === 1 ? "was" : "were"} refused as not an address.` : ""} None is sent a welcome.`);
    if (!why) { setFile(null); void load(); }
  };

  if (rows === null) return <Quiet>{failed ? "The list could not be read just now. It is tried again each minute." : "Reading the list…"}</Quiet>;
  const fig = (label: string, n: number, under: string) => (
    <div class="flex flex-col gap-1 rounded-[12px] border border-border bg-card px-3.5 py-3">
      <span class="text-[12px] text-text-2">{label}</span>
      <span class="t-figure leading-none text-text">{n.toLocaleString("en-GB")}</span>
      <span class="text-[11px] leading-snug text-text-3">{under}</span>
    </div>
  );
  return (
    <div class="flex flex-col gap-4" id="the-list">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h3 class="m-0 text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text">The list</h3>
        <span class="inline-flex items-center gap-2 text-[12.5px] text-text-2" role="status">
          <span class={`inline-block h-2 w-2 rounded-full ${open ? "bg-accent ring-4 ring-accent-fill" : "border border-border-strong"}`} aria-hidden="true" />
          {open ? "Live" : "Read again each minute"}{last ? ` · the last address arrived ${whenWords(last.consented_at, now).replace(/^./, (c) => c.toLowerCase())}` : ""}
        </span>
      </div>
      {failed ? <Quiet>The list could not be read just now. What is shown is the last reading. It is tried again each minute.</Quiet> : null}

      <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {fig("On the list", counts.all, "every row ever written")}
        {fig("Confirmed", counts.confirmed, "get the weekly letter")}
        {fig("Waiting for the press", counts.waiting, "no press in the welcome yet")}
        {fig("Stopped", counts.stopped, "pressed Unsubscribe")}
        {fig("This week", counts.thisWeek, `${counts.lastWeek.toLocaleString("en-GB")} the week before`)}
        {fig("Today", counts.today, "since midnight, your time")}
      </div>

      {rows.length === 0 ? (
        <p class="m-0 rounded-[12px] border border-border bg-card px-4 py-3.5 text-[14px] leading-relaxed text-text-2">No address is on the list yet. The first one appears here as it is written.</p>
      ) : (
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div class="flex flex-col gap-2.5 rounded-[14px] border border-border bg-card px-4 py-3.5">
            <Cap>New addresses, week by week</Cap>
            <div class="grid h-28 grid-cols-12 items-end gap-1.5" role="img" aria-label={`New addresses in each of the last twelve weeks: ${weeks.map((w) => w.count).join(", ")}.`}>
              {weeks.map((w) => <div key={w.monday} title={`Week of ${new Date(w.monday + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${w.count}`} class={`rounded-t-[3px] ${w.now ? "bg-accent" : "bg-accent-border"}`} style={{ height: `${w.count ? Math.max(4, Math.round((w.count / top) * 100)) : 0}%` }} />)}
            </div>
            <div class="grid grid-cols-12 gap-1.5 font-mono text-[9.5px] text-text-3">
              {weeks.map((w, i) => <span key={w.monday} class="text-center">{i % 3 === 0 || w.now ? new Date(w.monday + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</span>)}
            </div>
          </div>
          <div class="flex flex-col gap-2 rounded-[14px] border border-border bg-card px-4 py-3.5">
            <Cap>By door</Cap>
            {doors.map((d) => <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-2 text-[13px] text-text first:border-t-0 first:pt-0" key={d.source}><span class="truncate">{d.label}</span><b class="font-mono text-[13px] font-semibold">{d.count.toLocaleString("en-GB")}</b></div>)}
          </div>
          <div class="flex flex-col gap-2 rounded-[14px] border border-border bg-card px-4 py-3.5">
            <Cap>By post · the word on the link</Cap>
            {tags.of === 0 ? <Quiet>No address has come through the Horizon page yet. A post's link carries its word as /horizon?from=the-word.</Quiet>
              : tags.rows.map((t) => <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-2 text-[13px] text-text first:border-t-0 first:pt-0" key={t.tag ?? ""}><span class="truncate">{t.tag ?? "No word on the link"}</span><b class="font-mono text-[13px] font-semibold">{t.count.toLocaleString("en-GB")}</b></div>)}
            {tags.of > 0 ? <Quiet>Counted for the Horizon page's {tags.of.toLocaleString("en-GB")}.</Quiet> : null}
          </div>
        </div>
      )}

      <div class="flex flex-wrap items-center justify-between gap-3">
        <Cap>The newest rows</Cap>
        <div class="flex flex-wrap items-center gap-2">
          <input type="search" value={find} onInput={(e) => { setFind((e.currentTarget as HTMLInputElement).value); setShown(SHOWN); }} placeholder="Find an address" aria-label="Find an address"
            class="min-h-10 w-56 max-w-full rounded-[10px] border border-border-strong bg-card px-3 text-[13.5px] text-text outline-none placeholder:text-text-3 focus:border-accent-border" />
          <input ref={picker} type="file" accept=".csv,text/csv,text/plain" class="hidden" onChange={pick} />
          <button type="button" class={btn} onClick={() => picker.current?.click()}>Bring in a Substack file</button>
          <button type="button" class={btn} onClick={download} disabled={!rows.length}>Download the list</button>
        </div>
      </div>

      {file ? (
        <div class="flex flex-col gap-2.5 rounded-[12px] border border-accent-border bg-accent-fill px-4 py-3.5" role="group" aria-label="A file to bring in">
          <p class="m-0 text-[14px] leading-relaxed text-text"><b class="font-semibold">{file.name}</b>: {file.read.rows.length.toLocaleString("en-GB")} {file.read.rows.length === 1 ? "address" : "addresses"} to bring in.
            {file.read.off ? ` ${file.read.off} ${file.read.off === 1 ? "has" : "have"} emails switched off at Substack and ${file.read.off === 1 ? "is" : "are"} left out.` : ""}
            {file.read.twice ? ` ${file.read.twice} ${file.read.twice === 1 ? "is" : "are"} in the file twice.` : ""}
            {file.read.bad ? ` ${file.read.bad} ${file.read.bad === 1 ? "line holds" : "lines hold"} no address.` : ""}</p>
          <Quiet>Each address is added once, as confirmed on the day it subscribed at Substack. One already on the list is left as it is. None is sent a welcome.</Quiet>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex min-h-10 items-center rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-canvas disabled:opacity-60" disabled={busy || !file.read.rows.length} onClick={() => void take()}>{busy ? "Bringing in…" : `Bring in ${file.read.rows.length.toLocaleString("en-GB")}`}</button>
            <button type="button" class={btn} disabled={busy} onClick={() => setFile(null)}>Not this file</button>
          </div>
        </div>
      ) : null}
      {said ? <p class="m-0 text-[13.5px] leading-relaxed text-text" role="status">{said}</p> : null}

      {rows.length > 0 && (
        <div class="overflow-x-auto rounded-[12px] border border-border bg-card">
          <table class="w-full min-w-[640px] border-collapse text-left text-[13px] text-text">
            <thead><tr class="bg-alt font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-text-2">
              {["When", "Address", "Door", "Post", "State"].map((h) => <th class="px-3 py-2.5 font-semibold" scope="col" key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.slice(0, shown).map((r) => (
                <tr key={r.id} class={`border-t border-border ${fresh.has(r.id) ? "bg-accent-fill" : ""}`}>
                  <td class="whitespace-nowrap px-3 py-2.5 text-text-2">{whenWords(r.consented_at, now)}</td>
                  <td class="max-w-[280px] truncate px-3 py-2.5">{r.email}</td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-text-2">{doorWords(r.source)}</td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-text-2">{r.tag ?? "–"}</td>
                  <td class="whitespace-nowrap px-3 py-2.5"><span class={`inline-flex min-h-[22px] items-center rounded-full border px-2.5 font-mono text-[10.5px] font-semibold ${stateOf(r) === "confirmed" ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong text-text-2"}`}>{stateWords(r)}</span></td>
                </tr>
              ))}
              {list.length === 0 ? <tr class="border-t border-border"><td colSpan={5} class="px-3 py-3 text-text-2">No address on the list holds "{find.trim()}".</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {list.length > shown ? <button type="button" class={`${btn} self-start`} onClick={() => setShown((n) => n + SHOWN)}>Show {Math.min(SHOWN, list.length - shown)} more</button> : null}
      <Quiet>Only an account the database names can open this page. A new row appears at the top by itself. Nothing here sends an email or changes a row that is on the list.</Quiet>
    </div>
  );
}
