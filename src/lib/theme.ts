/**
 * The theme a person chose for My health: light, dark, or whatever the
 * device prefers. Public pages are always light and never call this.
 *
 * The choice lives in localStorage under "verve-theme". Layout.astro reads
 * it in the head, before anything paints, and sets <html data-theme>; the
 * stylesheet (src/styles/global.css) does the rest. A browser that will not
 * give storage (a private window, blocked site data) reads as "system" and
 * a choice made there holds for the visit only.
 */
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "verve-theme";
const GROUND = { light: "#F7F7F4", dark: "#0D0D15" };
const isChoice = (v: unknown): v is ThemeChoice => v === "light" || v === "dark" || v === "system";

/** The stored choice; "system" when there is none, when it is not one of the three, or when storage cannot be read. */
export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return isChoice(v) ? v : "system";
  } catch {
    return "system";
  }
}

/** Keeps the choice and puts it on the page at once: the attribute the stylesheet reads, and the browser chrome's colour. */
export function setTheme(choice: ThemeChoice): void {
  const c: ThemeChoice = isChoice(choice) ? choice : "system";
  try { localStorage.setItem(KEY, c); } catch { /* the visit still gets it */ }
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // every colour lands in one frame: no element eases from one set to the other while its neighbour has already changed
  root.classList.add("vrv-theme-switch");
  root.dataset.theme = c;
  void root.offsetWidth;
  const done = () => root.classList.remove("vrv-theme-switch");
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(done)); else done();
  // a page that is not being drawn runs no frames: make sure the class never outlives the switch
  if (typeof setTimeout === "function") setTimeout(done, 400);
  let prefersDark = false;
  try { prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches; } catch { /* light */ }
  const dark = c === "dark" || (c === "system" && prefersDark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? GROUND.dark : GROUND.light);
}
