/**
 * Settings › For the team › The letter: the weekly letter, written here and sent from our own address to the one
 * list (canvas "Verve, Horizon as a programme", board 32; the founder, 20 November 2026: "build what you mocked").
 *
 * Five small pages, one question each: Write, See it, Send yourself one, Send, After. Under them, every letter
 * that has gone.
 *
 * What this page may and may not do is decided elsewhere (METTracker supabase/migrations/20261122_letters.sql and
 * supabase/functions/letter): only the account the database names as the list's reader can keep a draft or call
 * the function; Send is refused until a test of these exact words has gone; the number typed has to be the number
 * there is; nobody gets a letter twice. The page draws none of the email itself: "See it" shows what the function
 * returns, so what is seen is what leaves.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dropDraft, keepDraft, readAudience, readCounts, readLetters, seeIt, sendLetter, sendTest } from "../letter/api.ts";
import {
  QUESTIONS, STEPS, checkLines, clock, dayShort, draftOf, goneOf, goneRow, halfwayOf, notReady, pastedWords, stoppedWords, subjectHint, tested, typedRight, wordsHash,
  type Audience, type Checks, type Counts, type Letter, type Words,
} from "../letter/letter.ts";

const Cap = ({ children }: { children: any }) => <span class="font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-3">{children}</span>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12.5px] leading-relaxed text-text-3">{children}</p>;
const Label = ({ children, for: f }: { children: any; for: string }) => <label for={f} class="text-[12.5px] font-semibold text-text">{children}</label>;
const btn = "inline-flex min-h-10 items-center rounded-[10px] border border-border-strong bg-alt px-4 text-[13.5px] font-semibold text-text transition-colors hover:border-accent-border disabled:opacity-50";
const primary = "inline-flex min-h-10 items-center rounded-[10px] border border-accent bg-accent px-4 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50";
const field = "w-full rounded-[10px] border border-border-strong bg-card px-3 py-2 text-[14px] text-text placeholder:text-text-3 focus:border-accent focus:outline-none";
const link = "min-h-10 text-[13px] font-semibold text-accent-text underline-offset-4 hover:underline";
const Row = ({ label, value, quiet, first }: { label: string; value: any; quiet?: boolean; first?: boolean }) => (
  <div class={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[13px] ${first ? "" : "border-t border-border pt-2"}`}>
    <span class={quiet ? "text-text-3" : "text-text"}>{label}</span><span class="t-figure-row">{value}</span>
  </div>
);

const EMPTY: Words = { subject: "", preheader: "", body: "" };

export function TheLetter({ sb }: { sb: SupabaseClient }) {
  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [counts, setCounts] = useState<Counts[]>([]);
  const [failed, setFailed] = useState(false);
  /** The letter the five pages are about: a draft, a letter going, or one that has gone. null: a new, unkept draft. */
  const [id, setId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [words, setWords] = useState<Words>(EMPTY);
  const [kept, setKept] = useState<"" | "keeping" | "kept" | "failed">("");
  const [hashNow, setHashNow] = useState("");
  const [seen, setSeen] = useState<{ html: string; checks: Checks } | null>(null);
  const [busy, setBusy] = useState("");
  const [said, setSaid] = useState("");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [typed, setTyped] = useState("");
  const [going, setGoing] = useState<{ left: number; stopped: string | null } | null>(null);
  const [other, setOther] = useState(false);
  const [to, setTo] = useState("");
  const opened = useRef(false);
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef<string | null>(null); idRef.current = id;

  const letter = (letters ?? []).find((l) => l.id === id) ?? null;
  const gone = !!letter?.send_started_at;
  const mine = (c: Counts[]) => c.find((x) => x.letter_id === id);

  async function load(): Promise<Letter[] | null> {
    const [ls, cs] = await Promise.all([readLetters(sb), readCounts(sb)]);
    if (!ls) { setFailed(true); return null; }
    setFailed(false); setLetters(ls); setCounts(cs);
    return ls;
  }
  function openLetter(l: Letter | null, at?: number) {
    setId(l?.id ?? null); setWords(l ? { subject: l.subject, preheader: l.preheader, body: l.body } : EMPTY);
    setSeen(null); setSaid(""); setKept(""); setTyped(""); setGoing(null);
    setPage(at ?? (l?.send_finished_at ? 4 : l?.send_started_at ? 3 : 0));
  }
  // the page opens on a letter that stopped halfway, else on the draft, else on an empty first page
  useEffect(() => { void load().then((ls) => { if (ls && !opened.current) { opened.current = true; openLetter(halfwayOf(ls) ?? draftOf(ls)); } }); }, []);
  useEffect(() => { let on = true; void wordsHash(words).then((h) => { if (on) setHashNow(h); }); return () => { on = false; }; }, [words.subject, words.preheader, words.body]);
  useEffect(() => { if (page === 3 || page === 4) { void readAudience(sb).then(setAudience); void readCounts(sb).then(setCounts); } }, [page, id]);
  useEffect(() => () => { if (wait.current) clearTimeout(wait.current); }, []);

  // ── page 1: the words are kept as they are typed ──
  // One keep at a time, in the order they were asked for. The first keep of a letter writes its row; a second
  // keep that began before the first came back would write a second row.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  function keep(w: Words): Promise<Letter | null> {
    const p = chain.current.then(() => keepNow(w));
    chain.current = p.catch(() => null);
    return p;
  }
  async function keepNow(w: Words): Promise<Letter | null> {
    if (!w.subject.trim() && !w.preheader.trim() && !w.body.trim() && !idRef.current) return null;   // nothing to keep yet
    setKept("keeping");
    const r = await keepDraft(sb, idRef.current, w);
    if (typeof r === "string") { setKept("failed"); setSaid(`Not kept: ${r}`); return null; }
    setKept("kept"); setSaid("");
    setId(r.id); idRef.current = r.id;
    setLetters((ls) => [r, ...(ls ?? []).filter((x) => x.id !== r.id)]);
    return r;
  }
  function type(patch: Partial<Words>) {
    const next = { ...words, ...patch };
    setWords(next); setKept(""); setSeen(null);
    if (wait.current) clearTimeout(wait.current);
    wait.current = setTimeout(() => void keep(next), 900);
  }
  function onPaste(e: ClipboardEvent) {
    const html = e.clipboardData?.getData("text/html") ?? "";
    if (!html) return;                                    // plain text pastes as it is
    let pasted = "";
    try { pasted = pastedWords(new DOMParser().parseFromString(html, "text/html").body as any); } catch { return; }
    if (!pasted) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLTextAreaElement, a = el.selectionStart ?? words.body.length, b = el.selectionEnd ?? a;
    type({ body: words.body.slice(0, a) + pasted + words.body.slice(b) });
  }

  // ── page 2 ──
  async function see() {
    const no = notReady(words);
    if (no) { setSaid(no); return; }
    if (wait.current) clearTimeout(wait.current);
    setBusy("see"); setSaid("");
    const k = await keep(words);
    if (!k) { setBusy(""); return; }
    const r = await seeIt(sb, words);
    setBusy("");
    if (typeof r === "string") { setSaid(r); return; }
    setSeen(r); setPage(1);
  }
  // ── page 3 ──
  async function test() {
    if (!id) return;
    setBusy("test"); setSaid("");
    const r = await sendTest(sb, id, other && to.trim() ? to.trim() : undefined);
    setBusy("");
    if (typeof r === "string") { setSaid(r); return; }
    await load();
  }
  // ── page 4: send, and keep going while there are more ──
  async function send() {
    if (!id || !audience) return;
    setBusy("send"); setSaid("");
    let count = gone ? (letter?.to_count ?? audience.confirmed) : Number(typed.trim());
    for (let turn = 0; turn < 400; turn++) {
      const r = await sendLetter(sb, id, count);
      if (r.kind === "count_changed") { setAudience({ ...audience, confirmed: r.now }); setTyped(""); setSaid(`The list changed while this page was open: ${r.now} ${r.now === 1 ? "address is" : "addresses are"} confirmed now. Type that number.`); break; }
      if (r.kind === "test_first") { setSaid("A test of these exact words has to go first."); setPage(2); break; }
      if (r.kind === "failed") { setSaid(r.why); break; }
      count = r.to;
      setGoing({ left: r.left, stopped: r.stopped });
      if (r.done) { await load(); setBusy(""); setPage(4); return; }
      if (r.stopped) break;
    }
    await load();
    setBusy("");
  }

  if (failed && !letters) return <Quiet>The letters could not be read just now. Reload the page to try again.</Quiet>;
  if (!letters) return <Quiet>Reading the letters…</Quiet>;

  const c = mine(counts);
  const far = gone ? (letter!.send_finished_at ? 4 : 3) : seen ? Math.max(1, tested(letter, hashNow) ? 3 : 2) : tested(letter, hashNow) ? 3 : 0;
  const steps = (
    <div class="grid grid-cols-5 gap-1.5" role="list" aria-label="The five pages">
      {STEPS.map((s, i) => {
        const can = !busy && (gone ? i >= 3 && i <= far : i <= far);
        return (
          <button key={s} type="button" role="listitem" disabled={!can} aria-current={i === page ? "step" : undefined} onClick={() => setPage(i)}
            class={`flex min-h-10 flex-col gap-0.5 border-t-[3px] pt-1.5 text-left text-[12px] ${i === page ? "border-accent text-text" : i < page ? "border-accent-border text-text-2" : "border-border text-text-3"} ${can ? "cursor-pointer" : "cursor-default"}`}>
            <span class="font-mono text-[10px] font-semibold uppercase tracking-[0.06em]">{i + 1}</span>{s}
          </button>
        );
      })}
    </div>
  );
  const question = page === 3 && audience ? `Send it to ${gone ? (letter?.to_count ?? audience.confirmed) : audience.confirmed} ${(gone ? (letter?.to_count ?? audience.confirmed) : audience.confirmed) === 1 ? "person" : "people"}?` : QUESTIONS[page];
  const sayLine = said ? <p class="m-0 text-[13px] leading-relaxed text-text" role="status">{said}</p> : null;
  const rows = goneOf(letters);

  return (
    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-4 sm:p-5">
        {steps}
        <h3 class="m-0 text-[19px] font-semibold leading-snug tracking-[-0.01em] text-text">{question}</h3>

        {page === 0 && (gone
          ? <Quiet>This letter has gone, so its words cannot change. <button type="button" class={link} onClick={() => openLetter(null)}>Write a new letter</button></Quiet>
          : <>
            <div class="flex flex-col gap-1.5"><Label for="lt-subject">Subject</Label>
              <input id="lt-subject" class={field} maxLength={200} value={words.subject} onInput={(e) => type({ subject: (e.currentTarget as HTMLInputElement).value })} />
              <Quiet>{subjectHint(words.subject)}</Quiet></div>
            <div class="flex flex-col gap-1.5"><Label for="lt-pre">The line shown beside the subject</Label>
              <input id="lt-pre" class={field} maxLength={200} value={words.preheader} onInput={(e) => type({ preheader: (e.currentTarget as HTMLInputElement).value })} /></div>
            <div class="flex flex-col gap-1.5"><Label for="lt-body">The letter</Label>
              <textarea id="lt-body" class={`${field} min-h-[280px] leading-relaxed`} maxLength={40000} value={words.body} onPaste={onPaste as any} onInput={(e) => type({ body: (e.currentTarget as HTMLTextAreaElement).value })} />
              <Quiet>Plain text. A blank line starts a paragraph, and a short first line is drawn as the headline. A line that is only a link becomes a button: "Read more → https://…". Inside a sentence, write a link as [words](https://…). Pasting from Substack keeps the words and the links and drops the rest.</Quiet></div>
            {sayLine}
            <div class="flex flex-wrap items-center justify-between gap-3">
              <Quiet>{kept === "keeping" ? "Keeping…" : kept === "kept" ? "Kept. Nothing is sent from this page." : "Kept as you type. Nothing is sent from this page."}</Quiet>
              <button type="button" class={primary} disabled={busy === "see"} onClick={() => void see()}>{busy === "see" ? "Drawing it…" : "See it"}</button>
            </div>
          </>)}

        {page === 1 && <>
          {seen
            ? <>
              <iframe title="The letter as it will arrive" sandbox="" srcdoc={seen.html} class="h-[520px] w-full rounded-[12px] border border-border-strong bg-canvas" />
              <Quiet>The grey lines at the foot are added by the sender. You do not type them and cannot remove them. The date is each reader's own.</Quiet>
              <ul class="m-0 flex list-none flex-col gap-1.5 rounded-[12px] border border-border bg-alt p-3">
                {checkLines(seen.checks).map((k) => <li key={k.text} class="grid grid-cols-[14px_minmax(0,1fr)] gap-2 text-[13px] leading-relaxed text-text"><span aria-hidden="true" class={`mt-[7px] h-2 w-2 rounded-full ${k.warn ? "border-2 border-text bg-transparent" : "bg-accent"}`} /><span>{k.warn ? <b class="font-semibold">Check: </b> : null}{k.text}</span></li>)}
              </ul>
            </>
            : <Quiet>Press "See it" on the first page to draw the letter.</Quiet>}
          {sayLine}
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button type="button" class={link} onClick={() => setPage(0)}>Back to the words</button>
            <button type="button" class={primary} disabled={!seen} onClick={() => setPage(2)}>Send yourself one</button>
          </div>
        </>}

        {page === 2 && <>
          <p class="m-0 text-[13.5px] leading-relaxed text-text-2">One copy goes to the address you signed in with, and to nobody else. It is the letter exactly as the list will get it, with a line on top saying it is a test.</p>
          {other
            ? <div class="flex flex-col gap-1.5"><Label for="lt-to">Send the test to</Label>
                <input id="lt-to" type="email" class={field} placeholder="an address that is confirmed on the list" value={to} onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)} />
                <Quiet>Only an address that is confirmed on the list can take a test. Use this when your sign-in address is one Apple made, which may not pass the mail on.</Quiet></div>
            : <button type="button" class={`${link} self-start`} onClick={() => setOther(true)}>Send it to another address on the list</button>}
          <button type="button" class={`${primary} self-start`} disabled={!id || busy === "test"} onClick={() => void test()}>{busy === "test" ? "Sending the test…" : other && to.trim() ? "Send the test" : "Send a test to me"}</button>
          <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-alt p-3">
            <Row first label="Test sent" value={letter?.tested_at ? `${dayShort(letter.tested_at)}, ${clock(letter.tested_at)}` : "Not yet"} />
            <Row quiet label="Changed since the test" value={!letter?.tested_hash ? "–" : tested(letter, hashNow) ? "No" : "Yes"} />
          </div>
          <Quiet>If you change a word after the test, the next page stays shut until a new test has gone.</Quiet>
          {sayLine}
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button type="button" class={link} onClick={() => setPage(0)}>Back to the words</button>
            <button type="button" class={primary} disabled={!tested(letter, hashNow)} onClick={() => setPage(3)}>I have read it</button>
          </div>
        </>}

        {page === 3 && <>
          {!audience ? <Quiet>Counting the list…</Quiet> : gone
            ? <>
              <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-alt p-3">
                <Row first label="Written for" value={letter?.to_count ?? "–"} />
                <Row label="Gone" value={c?.gone ?? 0} />
                <Row label="Still to go" value={going?.left ?? c?.queued ?? 0} />
              </div>
              {busy === "send" ? <Quiet>Sending. Keep this page open.</Quiet> : <>
                {going?.stopped ? <p class="m-0 text-[13px] leading-relaxed text-text" role="status">{stoppedWords(going.stopped, going.left)}</p> : null}
                {(going?.left ?? c?.queued ?? 0) > 0 ? <button type="button" class={`${primary} self-start`} onClick={() => void send()}>Send to the rest</button> : null}
              </>}
            </>
            : <>
              <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-alt p-3">
                <Row first label="Confirmed, will get it" value={audience.confirmed} />
                <Row quiet label="Waiting for the press, will not" value={audience.waiting} />
                <Row quiet label="Stopped, will not" value={audience.stopped} />
              </div>
              {!tested(letter, hashNow) ? <Quiet>A test of these exact words has to go first. <button type="button" class={link} onClick={() => setPage(2)}>Send yourself one</button></Quiet>
                : audience.confirmed === 0 ? <Quiet>Nobody on the list is confirmed yet, so there is nobody to send it to.</Quiet>
                : <>
                  <div class="flex flex-col gap-1.5"><Label for="lt-count">Type the number to send</Label>
                    <input id="lt-count" inputMode="numeric" autocomplete="off" class={`${field} t-figure-row max-w-[120px]`} value={typed} onInput={(e) => setTyped((e.currentTarget as HTMLInputElement).value)} /></div>
                  <button type="button" class={`${primary} self-start`} disabled={!typedRight(typed, audience) || busy === "send"} onClick={() => void send()}>{busy === "send" ? "Sending…" : `Send to ${audience.confirmed}`}</button>
                  {busy === "send" ? <Quiet>{going ? `${going.left} still to go. ` : ""}Keep this page open.</Quiet> : null}
                  <Quiet>A letter that has gone cannot be called back. An address added while it is going gets next week's.</Quiet>
                </>}
            </>}
          {sayLine}
        </>}

        {page === 4 && <>
          {!letter?.send_finished_at ? <Quiet>This letter has not finished going yet.</Quiet> : <>
            <div class="flex items-baseline gap-2.5"><span class="t-figure">{c?.gone ?? letter.to_count ?? 0}</span><span class="text-[13px] text-text-2">sent · finished {dayShort(letter.send_finished_at)} at {clock(letter.send_finished_at)}</span></div>
            <div class="flex flex-col gap-2 rounded-[12px] border border-border bg-alt p-3">
              <Row first label="Delivered" value={c?.reported ? c.delivered : "–"} />
              <Row label="Bounced, row now stopped" value={c?.reported ? c.bounced : "–"} />
              <Row label="Marked as spam, row now stopped" value={c?.reported ? c.complained : "–"} />
              <Row label="Unsubscribed from this letter" value={c?.unsubscribed ?? 0} />
              {c?.skipped ? <Row quiet label="Left the list before it reached them, not sent" value={c.skipped} /> : null}
            </div>
            {!c?.reported ? <Quiet>A dash means the sender has not reported on this letter. It is not a zero.</Quiet> : null}
            <Quiet>Not shown, because it is not collected: who opened it, and who pressed a link.</Quiet>
            {!draftOf(letters) ? <button type="button" class={`${btn} self-start`} onClick={() => openLetter(null)}>Write a new letter</button>
              : <button type="button" class={`${link} self-start`} onClick={() => openLetter(draftOf(letters))}>Go to the letter being written</button>}
          </>}
        </>}
      </div>

      {!gone && id && page === 0 ? <button type="button" class={`${link} self-start`} disabled={!!busy} onClick={async () => { if (wait.current) clearTimeout(wait.current); if (await dropDraft(sb, id)) { const ls = await load(); openLetter(ls ? draftOf(ls) : null); } else setSaid("Could not remove it."); }}>Remove this draft</button> : null}

      <div class="flex flex-col gap-2.5">
        <Cap>Every letter that has gone</Cap>
        {!rows.length ? <Quiet>None yet. The first one sent from here will be listed.</Quiet> : (
          <div class="overflow-x-auto rounded-[12px] border border-border bg-card">
            <table class="w-full min-w-[620px] border-collapse text-left text-[12.5px]">
              <thead><tr class="bg-alt font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-text-2">
                <th class="px-3 py-2">Sent</th><th class="px-3 py-2">Subject</th><th class="px-3 py-2 text-right">To</th><th class="px-3 py-2 text-right">Delivered</th><th class="px-3 py-2 text-right">Bounced</th><th class="px-3 py-2 text-right">Left</th>
              </tr></thead>
              <tbody>
                {rows.map((l) => { const r = goneRow(l, counts.find((x) => x.letter_id === l.id)); return (
                  <tr key={l.id} class="border-t border-border">
                    <td class="whitespace-nowrap px-3 py-2 text-text">{r.sent}</td>
                    <td class="px-3 py-2"><button type="button" class="text-left font-semibold text-accent-text underline-offset-4 hover:underline" onClick={() => openLetter(l)}>{r.subject || "No subject"}</button>{l.send_finished_at ? null : <span class="ml-2 text-text-3">stopped halfway</span>}</td>
                    <td class="px-3 py-2 text-right t-figure-row">{r.to}</td>
                    <td class="px-3 py-2 text-right t-figure-row">{r.delivered ?? "–"}</td>
                    <td class="px-3 py-2 text-right t-figure-row">{r.bounced ?? "–"}</td>
                    <td class="px-3 py-2 text-right t-figure-row">{r.left}</td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Quiet>Only an account the database names can open this page or send from it. Every letter carries the reader's own Unsubscribe button. No letter carries a pixel, and no link reports a press.</Quiet>
    </div>
  );
}
