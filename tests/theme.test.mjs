// The theme choice (src/lib/theme.ts): three values, "light" for anything else, a page that follows at once, and an event the two controls hear. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";

/** A browser small enough to hold in a test: storage, <html>, the theme-color meta, and what the device prefers. */
function browser({ stored = null, prefersDark = false, storageThrows = false } = {}) {
  const store = new Map(stored == null ? [] : [["verve-theme", stored]]);
  const meta = { content: "#EFE8DB", setAttribute(k, v) { if (k === "content") this.content = v; } };
  const classes = new Set();
  const events = [];
  globalThis.localStorage = {
    getItem(k) { if (storageThrows) throw new Error("blocked"); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (storageThrows) throw new Error("blocked"); store.set(k, String(v)); },
  };
  globalThis.document = {
    documentElement: { dataset: {}, offsetWidth: 0, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } },
    querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? meta : null),
    dispatchEvent: (e) => { events.push(e.type); return true; },
  };
  globalThis.matchMedia = () => ({ matches: prefersDark });
  globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
  return { store, meta, classes, events, html: globalThis.document.documentElement };
}

const { getTheme, setTheme, THEME_EVENT } = await import("../src/lib/theme.ts");

test("the stored choice is read; before anyone chooses, and for anything else or no storage, it is light", () => {
  for (const v of ["light", "dark", "system"]) { browser({ stored: v }); assert.equal(getTheme(), v); }
  browser({ stored: "banana" }); assert.equal(getTheme(), "light");
  browser({}); assert.equal(getTheme(), "light");
  browser({ storageThrows: true }); assert.equal(getTheme(), "light");
  // a device that prefers dark does not decide: only a person choosing System lets it
  browser({ prefersDark: true }); assert.equal(getTheme(), "light");
});

test("a choice is kept, put on the page at once, and the browser chrome follows", () => {
  const b = browser({ prefersDark: false });
  setTheme("dark");
  assert.equal(b.store.get("verve-theme"), "dark");
  assert.equal(b.html.dataset.theme, "dark");
  assert.equal(b.meta.content, "#0D0D15");
  setTheme("light");
  assert.equal(b.html.dataset.theme, "light"); assert.equal(b.meta.content, "#EFE8DB");
  assert.deepEqual(b.events, [THEME_EVENT, THEME_EVENT], "each choice is announced, so the footer's control and Settings show the same answer");
  assert.equal(b.classes.has("vrv-theme-switch"), false, "the no-easing class is gone once the switch has landed");
});

test("system follows the device, and a blocked store still themes the visit", () => {
  const dark = browser({ prefersDark: true });
  setTheme("system");
  assert.equal(dark.html.dataset.theme, "system"); assert.equal(dark.meta.content, "#0D0D15");
  const blocked = browser({ storageThrows: true, prefersDark: false });
  setTheme("dark");
  assert.equal(blocked.html.dataset.theme, "dark"); assert.equal(blocked.meta.content, "#0D0D15");
  // @ts-expect-error: a value outside the three is treated as light
  setTheme("banana");
  assert.equal(blocked.html.dataset.theme, "light");
});
