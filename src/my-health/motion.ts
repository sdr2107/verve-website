/**
 * The entrance animation plays the first time a list is drawn in a
 * session, never on a redraw: a tile that only changed its number must not
 * rise again. Views ask for the class by a key; the first asker gets it.
 */
const risen = new Set<string>();
export const riseOnce = (key: string) => (risen.has(key) ? "" : (risen.add(key), "mh-rise"));
export const reset = () => risen.clear();
