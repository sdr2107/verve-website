/**
 * Adding a marker, and the markers a horizon watches (canvas "Verve, Horizon as a programme", board 19; built on the
 * founder's word of 18 November 2026, for test accounts only).
 *
 *   AddMarkerPanel  the picker behind "Add a marker": the eight often added, every other marker by group, the blood
 *                   markers apart and watched only; then how the picked one is held.
 *   WatchedCard     under a horizon's targets: each watched marker's value, its day, and what it was. No number to
 *                   reach, no track, no pace word and no colour.
 *
 * The lists and the words are ../horizon/watch.ts. A watched marker is its owner's alone: no coach is given its row
 * and the horizon function cannot read the table, so nothing watched reaches a check-in, the plan or the Guide.
 */
import { useState } from "preact/hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonData } from "../derive/person.ts";
import { arrivalsOf, followable, leftOff, pausedWords } from "../derive/arrivals.ts";
import { latestOf, type MarkerKey } from "../horizon/derive.ts";
import type { Mode } from "../../data/programme.ts";
import { WAYS_WORDS, addChoices, isBlood, modeFor, opensOn, watchedLine, watchedStart, wayOf, waysFor, type AddChoice, type AddRules, type WatchedRow, type Way } from "../horizon/watch.ts";
import { keepWatched, removeWatched } from "../horizon/api.ts";

const H2 = ({ children }: { children: any }) => <h2 class="m-0 text-[18px] font-semibold text-text">{children}</h2>;
const Quiet = ({ children }: { children: any }) => <p class="m-0 text-[12px] leading-relaxed text-text-3">{children}</p>;

/** A marker added to a draft, and how it is held. */
export type Added = { marker: MarkerKey; mode: Mode };

const HOLDS: { mode: Mode; label: string }[] = [{ mode: "floor", label: "At least" }, { mode: "ceiling", label: "At most" }, { mode: "band", label: "Between two" }];

/**
 * The picker. `taken` are the markers already on the draft or the horizon by another road (the goal's own, or its
 * targets): they are not listed. `added` are the ones picked here, shown lit; pressing a lit one takes it off.
 * `only` narrows what a pick can be: the horizon's page offers "watch" alone, since a number there is "Add a target".
 */
export function AddMarkerPanel({ taken, added, canFollow, rules, only, current, hint, onPick, onDrop, onMode, onClose }: {
  taken: string[]; added: Added[]; canFollow: (marker: MarkerKey) => boolean; rules: AddRules; only?: Way;
  /** A small grey word on a chip before it is picked (board 21): "no reading yet", "from 2 Sep". It can still be picked. */ hint?: (marker: MarkerKey) => string | null;
  /** The marker whose way of being held is shown under the lists. */ current: MarkerKey | null;
  onPick: (marker: MarkerKey, mode: Mode) => void; onDrop: (marker: MarkerKey) => void; onMode: (marker: MarkerKey, mode: Mode) => void; onClose: () => void;
}) {
  const lists = addChoices({ taken, canFollow, ...rules });
  const by = new Map(added.map((a) => [a.marker, a.mode]));
  const press = (c: AddChoice) => {
    const k = c.def.key;
    if (by.has(k)) { onDrop(k); return; }
    const mode = only === "watch" ? "watch" : opensOn(k, rules);
    if (mode) onPick(k, mode);
  };
  const Chips = ({ items, blood }: { items: AddChoice[]; blood?: boolean }) => (
    <div class="flex flex-wrap gap-1.5">
      {items.map((c) => {
        const on = by.has(c.def.key);
        return (
          <button type="button" key={c.def.key} aria-pressed={on} disabled={c.missing} onClick={() => press(c)}
            class={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-medium disabled:cursor-default ${on ? "border-accent-border bg-accent-fill font-semibold text-accent-text" : c.missing ? "border-dashed border-border-strong text-text-3" : blood ? "border-border-strong bg-card text-text-2 hover:border-accent-border" : "border-border-strong bg-alt text-text hover:border-accent-border"}`}>
            {c.def.label}{c.missing ? " · nothing is sending this" : !blood && c.watchOnly && only !== "watch" ? " · to watch" : ""}
            {!c.missing && !on && hint?.(c.def.key) ? <span class="ml-1.5 font-mono text-[10px] font-medium text-text-3">{hint(c.def.key)}</span> : null}
          </button>
        );
      })}
    </div>
  );
  const Group = ({ label, children, first }: { label: string; children: any; first?: boolean }) => (
    <div class={`flex flex-col gap-1.5 ${first ? "" : "border-t border-border pt-3"}`}><span class="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-text-3">{label}</span>{children}</div>
  );
  const cur = current && by.has(current) ? { marker: current, mode: by.get(current)! } : null;
  const ways = cur ? (only ? [only] : waysFor(cur.marker, rules)) : [];
  const curDef = cur ? [...lists.often, ...lists.groups.flatMap((g) => g.items), ...lists.blood].find((c) => c.def.key === cur.marker)?.def ?? null : null;
  return (
    <div class="flex flex-col gap-3 rounded-[12px] border border-border-strong bg-alt p-4" id="horizon-add-marker">
      <div class="flex flex-wrap items-baseline justify-between gap-3"><span class="text-[15px] font-semibold text-text">{only === "watch" ? "Watch a marker" : "Add a marker"}</span><button type="button" onClick={onClose} class="min-h-8 text-[13px] font-semibold text-text-2 hover:text-text">Done</button></div>
      {lists.often.length ? <Group label="Often added" first><Chips items={lists.often} /></Group> : null}
      {lists.groups.map((g, i) => <Group label={g.label} key={g.key} first={!lists.often.length && i === 0}><Chips items={g.items} /></Group>)}
      {lists.blood.length ? <Group label="Blood · to watch only"><Chips items={lists.blood} blood /></Group> : null}
      <Quiet>Every marker this page can follow, in the page's own groups. One that nothing is sending is shown and cannot be picked.{lists.blood.length ? " The blood markers sit apart and take no number: a target on a blood result is not offered." : ""}</Quiet>
      {cur && curDef && only !== "watch" ? (
        <div class="flex flex-col gap-2 border-t border-border pt-3">
          <span class="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-text-3">{curDef.label} · how it is held</span>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
            {(["reach", "hold", "watch"] as Way[]).filter((w) => ways.includes(w)).map((w) => {
              const on = wayOf(cur.mode) === w;
              return (
                <button type="button" key={w} aria-pressed={on} onClick={() => onMode(cur.marker, modeFor(cur.marker, w, cur.mode))} class={`flex flex-col items-start gap-0.5 rounded-[10px] border p-3 text-left ${on ? "border-accent-border bg-accent-fill" : "border-border bg-card hover:border-border-strong"}`}>
                  <span class={`text-[14px] font-semibold ${on ? "text-accent-text" : "text-text"}`}>{WAYS_WORDS[w].title}</span>
                  <span class="text-[12px] leading-relaxed text-text-3">{WAYS_WORDS[w].sub}</span>
                </button>
              );
            })}
          </div>
          {wayOf(cur.mode) === "hold" ? <div class="flex flex-wrap gap-1.5">{HOLDS.map((h) => <button type="button" key={h.mode} aria-pressed={cur.mode === h.mode} onClick={() => onMode(cur.marker, h.mode)} class={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-medium ${cur.mode === h.mode ? "border-accent-border bg-accent-fill text-accent-text" : "border-border-strong bg-card text-text hover:border-accent-border"}`}>{h.label}</button>)}</div> : null}
          <Quiet>{isBlood(cur.marker) ? "A blood marker has one way only. It is watched: shown with its date, and never given a number, a pace or a place in the Guide's words."
            : ways.length === 1 ? "With this little time to the day, it can be watched and not given a number." : "The page opens on the way that suits the marker, and you can change it. No field is filled in: you type every number."}</Quiet>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The watched markers of a horizon, under its targets. Its owner can take one off and, on a test account, watch
 * another. Anyone else is given no rows by the database, so the card is not drawn for them.
 */
export function WatchedCard({ sb, horizonId, rows, setOn, person, today, taken, canEdit, userId, reload, setNotice }: {
  sb: SupabaseClient; horizonId: string; rows: WatchedRow[]; /** The day the horizon was set. */ setOn: string; person: PersonData; today: string;
  /** The markers the horizon holds a target on: they are not offered to watch. */ taken: string[];
  /** The owner of an open horizon on a test account. */ canEdit: boolean;
  userId: () => Promise<string | null>; reload: () => Promise<void>; setNotice: (s: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const arrivals = arrivalsOf(person.doc.weeks);
  const off = leftOff(arrivals);
  if (!rows.length && !canEdit) return null;

  async function watch(marker: MarkerKey) {
    const uid = await userId();
    if (!uid) { setNotice("Sign in again to continue."); return; }
    setBusy(true);
    const err = await keepWatched(sb, horizonId, uid, [watchedStart(marker, latestOf(marker, person, today), today)]);
    setBusy(false);
    if (err) setNotice(`Could not keep that: ${err}`); else await reload();
  }
  async function drop(marker: MarkerKey) {
    const row = rows.find((r) => r.marker === marker);
    if (!row?.id) return;
    setBusy(true);
    const err = await removeWatched(sb, row.id);
    setBusy(false);
    if (err) setNotice(`Could not take it off: ${err}`); else await reload();
  }

  if (!rows.length) {
    return adding
      ? <AddMarkerPanel taken={taken} added={[]} canFollow={(m) => followable(off, m)} rules={{ canWatch: true }} only="watch" current={null} onPick={(m) => void watch(m)} onDrop={() => {}} onMode={() => {}} onClose={() => setAdding(false)} />
      : <div class="flex flex-wrap items-center gap-3"><button type="button" onClick={() => setAdding(true)} class="rounded-full border border-border px-3 py-1 text-[12px] text-text-2 hover:border-accent-border">Watch a marker</button><span class="text-[12px] text-text-3">No number is set on it. It is shown here with its date. Test account.</span></div>;
  }
  return (
    <section id="horizon-watched" class="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-3"><H2>Watched · {rows.length}</H2><span class="text-[12px] text-text-3">No number is set on these. They are shown, and not judged</span></div>
      <div class="flex flex-col">
        {rows.map((r, i) => {
          const l = watchedLine(r, latestOf(r.marker, person, today), { paused: pausedWords(arrivals, r.marker), withHorizon: !r.created_at || String(r.created_at).slice(0, 10) <= setOn });
          return (
            <div class={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-3 md:grid-cols-[minmax(0,1fr)_110px_minmax(0,1.6fr)_auto] ${i ? "border-t border-border" : ""}`} key={r.marker}>
              <span class="flex flex-col"><span class="text-[15px] text-text">{l.label}</span><span class="font-mono text-[11px] text-text-3">{l.how}</span></span>
              <span class="t-figure-row text-right font-semibold text-text md:text-left">{l.value}</span>
              <span class="col-span-2 text-[13px] leading-relaxed text-text-2 md:col-span-1">{l.words}</span>
              {canEdit ? <button type="button" disabled={busy} onClick={() => void drop(r.marker)} class="col-span-2 min-h-8 justify-self-start text-[12px] text-text-3 hover:text-text md:col-span-1 md:justify-self-end" aria-label={`Stop watching ${l.label}`}>Take off</button> : <span class="hidden md:block" />}
            </div>
          );
        })}
      </div>
      {canEdit ? (adding
        ? <AddMarkerPanel taken={[...taken, ...rows.map((r) => r.marker)]} added={[]} canFollow={(m) => followable(off, m)} rules={{ canWatch: true }} only="watch" current={null} onPick={(m) => void watch(m)} onDrop={() => {}} onMode={() => {}} onClose={() => setAdding(false)} />
        : <div><button type="button" onClick={() => setAdding(true)} class="rounded-full border border-border px-3 py-1 text-[12px] text-text-2 hover:border-accent-border">Watch another</button></div>) : null}
      <Quiet>A watched marker has no "I want", no track and no pace. It says the value, the day, and what it was. For a blood marker it also says whether a move is more than that marker's usual swing, in the words In depth uses. Only you see this list: it is not in Monday's check-in, the midweek note, the Guide's plan or its chat, and a coach is not shown it.</Quiet>
      {rows.some((r) => isBlood(r.marker)) ? <Quiet>A blood marker is watched only. Verve sets no number on one, names no cause for a move, and gives no date for another test. Test account.</Quiet> : null}
    </section>
  );
}
