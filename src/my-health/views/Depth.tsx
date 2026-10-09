/**
 * In depth as a view of the document: the plan gate, the empty line, the
 * head, the four answers, the six chapters and what changed this week.
 * The figures and the markup are ../derive/depth, set once per document;
 * the goto buttons and the heart export are handled by delegation. The
 * working for "In Verve's words" is published on a signal for the page's
 * AI card, which still writes.
 */
import { render } from "preact";
import { useEffect, useMemo } from "preact/hooks";
import { derived, person, depthLocked, depthWorking, actions } from "../state.ts";
import { depthEmpty, depthEmptyText, depthOf } from "../derive/depth.ts";

/** The person's sleep and heart rows of the last 90 days, as a CSV the browser saves. */
function exportHeartRows(rows: any[], today: string, name: string) {
  const cols = ["day", "sleep_minutes", "sleep_start", "resting_hr", "hrr_bpm", "hrr_source", "hrv_night_ms", "hrv_n", "hrv_source", "hrv_method"];
  const cell = (v: unknown) => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `verve-sleep-heart-${(name || "me").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${today}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Lock({ self, name }: { self: boolean; name: string }) {
  const title = self ? "In depth is on Pro." : "In depth on other people is on Max.";
  const body = self
    ? "Four cards that say how you are doing, then activity, fitness, labs and body with the working shown. Your Overview, Labs and Reports stay as they are."
    : `${name || "This person"}'s Overview, Labs and Reports are here as before. In depth on everyone you see, and the group ranked by movement, come with Max; Enterprise adds clients without a family limit.`;
  return (
    <div class="flex max-w-2xl flex-col gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/[0.05] p-5">
      <div class="text-[17px] font-extrabold text-text-primary">{title}</div>
      <p class="text-[13.5px] leading-relaxed text-text-secondary">{body}</p>
      <div class="flex flex-wrap gap-2"><a href="/plans" class="inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-sm font-bold text-canvas">See the plans</a><button type="button" onClick={() => actions.goTab("overview")} class="min-h-10 px-3 text-sm font-semibold text-text-secondary hover:text-text-primary">Not now</button></div>
    </div>
  );
}

export function Depth() {
  const d = derived.value;
  const p = person.value;
  const locked = depthLocked.value;
  const today = new Date().toLocaleDateString("en-CA");
  const depth = useMemo(() => (d && p && !locked && !depthEmpty(d) ? depthOf(d, p, today) : null), [d, p, locked, today]);
  useEffect(() => { depthWorking.value = depth?.working ?? null; }, [depth]);
  if (!d || !p) return null;
  if (locked) return <Lock self={p.self} name={p.name} />;
  if (!depth) return <p class="max-w-3xl text-[13.5px] leading-relaxed text-text-tertiary">{depthEmptyText(p)}</p>;
  const onClick = (e: Event) => {
    const t = (e.target as HTMLElement).closest("[data-goto], #dp-heart-export") as HTMLElement | null;
    if (!t) return;
    if (t.id === "dp-heart-export") { exportHeartRows(depth.heartRows, today, p.name); return; }
    actions.goTab(t.dataset.goto!);
  };
  return (
    <div onClick={onClick}>
      <div dangerouslySetInnerHTML={{ __html: depth.head }} />
      <div class="mt-5 grid border-y border-white/[0.08] sm:grid-cols-2 lg:grid-cols-4" dangerouslySetInnerHTML={{ __html: depth.cards }} />
      <div class="mt-8 flex flex-col gap-10" dangerouslySetInnerHTML={{ __html: depth.chapters }} />
      <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/10 px-5 py-3.5 text-[13px] text-text-secondary" dangerouslySetInnerHTML={{ __html: depth.changed }} />
    </div>
  );
}

export function mountDepth(root: HTMLElement) { render(<Depth />, root); }
