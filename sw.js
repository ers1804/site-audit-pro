
const CACHE_NAME = 'siteaudit-v2';
const BASE_PATH = '/site-audit-pro/';
const ASSETS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only intercept requests that are within our app's scope
  if (url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).catch(() => {
          // Fallback to index.html for navigation requests (SPA support)
          if (event.request.mode === 'navigate') {
            return caches.match(BASE_PATH + 'index.html');
          }
        });
      })
    );
  }
});
