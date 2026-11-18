/**
 * A sheet over the page: something read or picked without leaving where you are (canvas "Verve, Horizon as a
 * programme", boards 23 and 24; the founder, 18 November 2026: the studies "on click opens as a pop up on the screen
 * and is dismissed on a cross button, so its clutter free").
 *
 * It sits over the page and scrolls by itself, so what was under it stays where it was. It closes on its cross, on
 * Escape, and on a press outside it. It holds no state of its own: the caller decides when it is open.
 */
import { useEffect } from "preact/hooks";

export function Sheet({ title, kicker, onClose, children, wide }: { title: string; /** A small line over the title. */ kicker?: string; onClose: () => void; children: any; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // the page under the sheet does not scroll while it is open
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = was; };
  }, []);
  return (
    <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-canvas-3/70 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class={`flex w-full flex-col gap-4 rounded-[18px] border border-border-strong bg-card p-5 shadow-[0_18px_40px_rgba(20,20,28,0.14)] sm:p-6 ${wide ? "max-w-[820px]" : "max-w-[640px]"}`}>
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            {kicker ? <span class="font-mono text-[11px] font-medium text-text-3">{kicker}</span> : null}
            <h2 class="m-0 text-[19px] font-semibold leading-snug text-text">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong text-[18px] leading-none text-text-2 hover:border-accent-border hover:text-text">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
