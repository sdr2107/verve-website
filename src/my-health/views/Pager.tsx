/**
 * The arrows at the foot of a section (canvas "Verve on the web, refined",
 * boards 04 and 07): one section is on the page, and the others are one step
 * away. Left is the section before, or the way back the page names; the
 * middle says where this one sits; right is the section after.
 */
export type PagerLink = { label: string; go: () => void };

export function Pager({ prev, next, at, of }: { prev: PagerLink | null; next: PagerLink | null; at: number; of: number }) {
  const link = "inline-flex min-h-10 items-center text-[13.5px] font-semibold text-accent-text transition-colors hover:text-text";
  return (
    <nav aria-label="Sections" class="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-t border-border pt-3">
      <span class="min-w-0">{prev ? <button type="button" onClick={prev.go} class={link}><span aria-hidden="true">&larr;&nbsp;</span><span class="truncate">{prev.label}</span></button> : null}</span>
      <span class="t-eyebrow whitespace-nowrap">{at} of {of}</span>
      <span class="flex min-w-0 justify-end">{next ? <button type="button" onClick={next.go} class={link}><span class="truncate">{next.label}</span><span aria-hidden="true">&nbsp;&rarr;</span></button> : null}</span>
    </nav>
  );
}
