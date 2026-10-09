/*
 * The site's service worker: what a static host cannot do for us.
 *
 * GitHub Pages sends every file with a ten-minute cache, so each visit
 * revalidates the page's bundles, and the browser discovers the Supabase
 * chunk only after the page script has arrived: a waterfall of half a
 * second before My health can paint. The files under /_astro/ carry a
 * content hash in their name, so they never change under one name; this
 * worker keeps them cache-first, which makes every visit after the first
 * read them from the device.
 *
 * Pages are network-first, with the cached copy only when the network
 * fails, so a deploy shows at once. The one exception is My health, whose
 * words come from the person's document, not the HTML: it is served from
 * the cache and refreshed behind, so the shell paints before the network
 * answers; a deploy reaches it on the visit after.
 *
 * Nothing from another origin passes through here: the Supabase requests
 * are never cached.
 */
const VERSION = "verve-sw-v1";
const ASSETS = `${VERSION}:assets`;
const PAGES = `${VERSION}:pages`;

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request).then((response) => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => null);
  return hit ?? (await refresh) ?? fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_astro/")) { event.respondWith(cacheFirst(request, ASSETS)); return; }
  if (request.mode === "navigate") {
    const myHealth = url.pathname === "/my-health" || url.pathname === "/my-health/";
    event.respondWith(myHealth ? staleWhileRevalidate(request, PAGES) : networkFirst(request, PAGES));
  }
});
