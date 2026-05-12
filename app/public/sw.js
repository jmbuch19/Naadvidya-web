// Naadvidya — service worker (Phase 1 PWA).
//
// Strategy:
//   - Cache the app shell on install for fast cold-start
//   - Network-first for GET requests; fall back to cache when offline
//   - Skip non-GET, skip API routes, skip Supabase / Daily / Razorpay / R2 hosts
//   - Skip-waiting + clients.claim so updates take effect on next navigation
//
// Bump CACHE_VERSION when the SW logic changes — old caches get purged.

const CACHE_VERSION = 'naadvidya-v1';
const APP_SHELL = ['/', '/teachers', '/login', '/register', '/icon.svg', '/icon-maskable.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(APP_SHELL).catch((err) => {
        // Don't fail install if a single asset is missing in dev
        console.warn('[sw] precache miss:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin (Supabase, Daily, Razorpay, R2)
  if (url.origin !== self.location.origin) return;

  // Skip API routes — these are dynamic and security-sensitive
  if (url.pathname.startsWith('/api/')) return;

  // Skip Next.js HMR/dev assets
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful navigations and static assets
        if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/_next/static') || url.pathname.endsWith('.svg'))) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
  );
});
