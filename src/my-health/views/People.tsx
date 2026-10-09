/**
 * The People control as a view: one button with whose page this is, and
 * under it the menu of everyone, the group, and the ways to add someone or
 * give access; beside the greeting, the line that says what you may do
 * here. Reads the people, the person, the tab and the first name from
 * ../state; every action is asked of the page, which owns the forms.
 */
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { people, person, activeTab, firstName, actions, type PersonLite } from "../state.ts";
import { scopeList } from "../derive/scopes.ts";

const PeopleIcon = () => (
  <span class="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white/8 text-text-secondary"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5a5 5 0 0 1 6 5" /></svg></span>
);

export function PersonMenu() {
  const [open, setOpen] = useState(false);
  const list = people.value, cur = person.value, tab = activeTab.value, first = firstName.value;
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!(e.target as Element).closest("[data-personmenu]")) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!list.some((p) => !!p.id) || !cur) return null;
  const others = list.filter((x) => x.id && !x.self);
  const onGroup = tab === "group";
  const w = !!cur.mine;
  const initialOf = (p: PersonLite) => (p.self ? (first || "You") : (p.name || "?")).trim().charAt(0).toUpperCase();
  const nameOf = (p: PersonLite) => p.self ? (first || "You") : (p.name || "Unnamed");
  const hintOf = (p: PersonLite) => p.self ? "your own page" : `${p.mine ? "in your care" : `shares ${scopeList(p.scopes).toLowerCase() || "nothing yet"} with you`}${p.born_year ? ` · ${p.born_year}` : ""}`;
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  const itemClass = (on: boolean) => `flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] transition-colors ${on ? "bg-accent/15 text-text-primary" : "text-text-primary hover:bg-white/[0.06]"}`;
  const plain = (text: string, fn: () => void, id?: string) => (
    <button type="button" role="menuitem" id={id} onClick={pick(fn)} class={itemClass(false)}><span class="w-[26px] shrink-0"></span><span class="min-w-0 flex-1 truncate font-semibold text-text-secondary">{text}</span></button>
  );
  return (
    <div class="relative" data-personmenu>
      <button type="button" id="personmenubtn" aria-expanded={open ? "true" : "false"} aria-haspopup="menu" aria-controls="personmenu" onClick={() => setOpen(!open)}
        class="flex min-h-10 max-w-full items-center gap-2.5 rounded-full border border-white/14 bg-white/[0.04] py-1.5 pl-2 pr-3.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-white/30 lg:w-full lg:rounded-[12px]">
        {onGroup ? <PeopleIcon /> : <span class="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent/25 text-[11px] font-bold text-accent-light">{initialOf(cur)}</span>}
        <span class="min-w-0 flex-1 truncate text-left">{onGroup ? "Everyone" : nameOf(cur)}</span>
        <svg class="shrink-0 text-text-tertiary" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div id="personmenu" role="menu" class={`absolute left-0 top-full z-30 mt-2 ${open ? "flex" : "hidden"} w-72 max-w-[calc(100vw-3rem)] flex-col gap-0.5 rounded-2xl border border-white/12 bg-[#12122a] p-1.5 shadow-2xl shadow-black/50`}>
        {list.map((p) => { const on = p.id === cur.id && !onGroup; return (
          <button key={p.id || "self"} type="button" role="menuitem" aria-current={on ? "true" : "false"} onClick={pick(() => actions.person("switch", p.id))} class={itemClass(on)}>
            <span class={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${p.self ? "bg-accent/25 text-accent-light" : "bg-white/8 text-text-secondary"}`}>{initialOf(p)}</span>
            <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{nameOf(p)}</span><span class="block truncate text-[11.5px] text-text-tertiary">{hintOf(p)}</span></span>
            {on ? <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg> : null}
          </button>); })}
        <span class="mx-2 my-1 h-px bg-white/[0.08]" aria-hidden="true"></span>
        {others.length ? <button type="button" role="menuitem" id="everyone" aria-current={onGroup ? "true" : "false"} onClick={pick(() => actions.person("everyone"))} class={itemClass(onGroup)}><PeopleIcon /><span class="min-w-0 flex-1 truncate font-semibold">Everyone, ranked by movement</span><span class="font-mono text-[10.5px] text-text-tertiary">{others.length}</span></button> : null}
        {plain("Add a person", () => actions.person("add"), "personadd")}
        {plain("Ask someone to share with you", () => actions.person("ask"), "personask")}
        {w && cur.id ? plain("Who can see this page", () => actions.person("access"), "personaccess") : null}
      </div>
    </div>
  );
}

/** The line under the greeting on someone else's page: whose it is, and what you may do. */
export function PersonHead() {
  const p = person.value;
  if (!p || p.self) return null;
  return (
    <>
      <span class="font-mono text-[10px] font-semibold tracking-[0.14em] text-accent-light">
        {p.mine ? `YOU LOOK AFTER${p.born_year ? ` · BORN ${p.born_year}` : ""}` : `SHARES WITH YOU · ${p.scopes.map((x) => x.toUpperCase()).join(" · ") || "NOTHING YET"} · YOU CAN LOOK, NOT CHANGE`}
      </span>
      <span class="flex items-center gap-3 text-[13px] font-medium">
        {p.mine ? <>
          <button type="button" onClick={() => actions.person("edit")} class="text-accent-light hover:text-text-primary">Edit details</button>
          <button type="button" onClick={() => actions.person("remove")} class="text-text-tertiary hover:text-danger">Remove person</button>
        </> : null}
      </span>
    </>
  );
}

export function TabHead() {
  const p = person.value;
  return <>{!p || p.self ? "Your page" : `${p.name || "Their"}’s page`}</>;
}

export function mountPeople(els: { menu: HTMLElement; head: HTMLElement; tabhead: HTMLElement }) {
  render(<PersonMenu />, els.menu);
  render(<PersonHead />, els.head);
  render(<TabHead />, els.tabhead);
}
