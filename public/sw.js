/* Lantern Quay service worker.
 *
 * The BUILD constant below is replaced with the deploy id by vite.config.ts at build
 * time, so the cache name changes on every deploy and no old shell can survive. skipWaiting() and
 * clients.claim() make the new worker take over at once; the page reloads once on
 * controllerchange and then picks up the new index.html (and its hashed bundles).
 *
 * Navigations are fetched with cache: 'no-store' so GitHub Pages' ten-minute HTTP
 * cache cannot serve a stale shell. Hashed assets are cache-first -- their names
 * change with their content.
 */
const BUILD = '__BUILD__';
const CACHE = `lantern-quay-${BUILD}`;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      // Bypass the HTTP cache entirely: the whole point is that a new deploy's shell
      // must never be masked by a cached copy of index.html.
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
