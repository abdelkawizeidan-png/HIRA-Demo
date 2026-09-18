/* =====================================================================
   HIRA (Veltrix Power Group demo) — service worker (app-shell cache for
   PWA install).

   Identical strategy to the production service worker -- network-first
   navigations, cache-first precached static assets/pinned CDN libs,
   pass-through for the demo sync Worker API. CACHE_NAME uses its own
   'hira-demo-shell-' prefix so this demo's cache never collides with, or
   gets cleared by, the production site's service worker on a device that
   has both installed.
===================================================================== */
const CACHE_NAME = 'hira-demo-shell-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // a single failed precache entry (e.g. offline on first install) shouldn't block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

function isPrecachedAsset(url) {
  return PRECACHE_URLS.some((u) => url.endsWith(u.replace('./', '')) || url === u);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never touch POST/PUT (the Cloudflare sync writes)

  const url = new URL(req.url);

  // Navigations -- network-first, cache fallback for offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Precached static assets + pinned CDN libraries -- cache-first.
  if (isPrecachedAsset(req.url) || isPrecachedAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  // Everything else (Cloudflare Worker sync API, any other origin) --
  // pass straight through, untouched.
});
