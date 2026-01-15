const CACHE_NAME = 'siteaudit-v12';

// Cache essential assets only. index.html is our App Shell.
const ASSETS_TO_CACHE = [
  'index.html',
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map(url => {
          return cache.add(url).catch(err => console.warn(`[SW] Failed to cache ${url}:`, err));
        })
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 1. Navigation Fallback: Always serve index.html for navigation requests.
  // This ensures that the PWA always boots from the cached shell regardless of deep links or trailing slashes.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then((response) => {
        return response || fetch(event.request);
      }).catch(() => {
        return fetch(event.request);
      })
    );
    return;
  }

  // 2. Asset Caching Strategy: Cache-first for known static assets, Network-first for others.
  const url = new URL(event.request.url);
  const isCdn = url.hostname === 'cdn.tailwindcss.com' || url.hostname === 'cdnjs.cloudflare.com';
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin || isCdn) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          // Don't cache errors, non-GET requests, or dynamic APIs
          if (!networkResponse || networkResponse.status !== 200 || event.request.method !== 'GET') {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // Silent fail for non-navigation assets
        });
      })
    );
  }
});