/**
 * Where a reading is added, drawn (canvas "Verve, Horizon as a programme", board 21; built on the founder's word of
 * 18 November 2026, for test accounts). The doors themselves, and which exist for a person, are ../horizon/doors.ts.
 *
 *   DoorTiles   the small tiles under a reading that is missing or from a while ago: one per door, named as the
 *               phone names it, with a way there where the page has one.
 *   WhereLine   one line that names the doors in a few words and opens the tiles under it, for a row with no room.
 *
 * Nothing here fills a value in, holds Next back, or asks for a reading: it says where one would be added.
 */
import { useState } from "preact/hooks";
import { actions } from "../state.ts";
import { GET_APP_PATH } from "../../data/site.ts";
import { doorsInWords, type Door } from "../horizon/doors.ts";

const WAYS: Record<NonNullable<Door["go"]>, { label: string; href?: string; press?: () => void }> = {
  body: { label: "Open Body", press: () => actions.goTab("body") },
  devices: { label: "Open Settings › Devices", press: () => actions.goSettings("devices") },
  sheet: { label: "The paper sheet", href: "/sheet/" },
  get: { label: "Get the app", href: GET_APP_PATH },
};

export function DoorTiles({ doors }: { doors: Door[] }) {
  if (!doors.length) return null;
  return (
    <div class={`grid grid-cols-1 gap-2 ${doors.length >= 3 ? "md:grid-cols-3" : doors.length === 2 ? "md:grid-cols-2" : ""}`}>
      {doors.map((d) => {
        const way = d.go ? WAYS[d.go] : null;
        return (
          <div class="flex flex-col gap-1 rounded-[10px] border border-border bg-alt px-3 py-2.5" key={`${d.key}-${d.head}`}>
            <span class="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-text">{d.head}</span>
            <span class="text-[12.5px] leading-relaxed text-text-2">{d.words}</span>
            {way ? (way.href
              ? <a href={way.href} target={d.go === "get" ? "_blank" : undefined} rel={d.go === "get" ? "noopener" : undefined} class="self-start text-[12px] font-semibold text-accent-text underline-offset-2 hover:underline">{way.label}</a>
              : <button type="button" onClick={way.press} class="min-h-8 self-start text-[12px] font-semibold text-accent-text hover:text-text">{way.label}</button>) : null}
          </div>
        );
      })}
    </div>
  );
}

/** "Where it is added: Apple Health, or the app", which opens the tiles under it. */
export function WhereLine({ doors, lead = "Where it is added" }: { doors: Door[]; lead?: string }) {
  const [open, setOpen] = useState(false);
  if (!doors.length) return null;
  return (
    <div class="flex flex-col gap-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} class="min-h-8 self-start text-left text-[12.5px] font-semibold text-accent-text hover:text-text">{lead}: {doorsInWords(doors)}</button>
      {open ? <DoorTiles doors={doors} /> : null}
    </div>
  );
}
