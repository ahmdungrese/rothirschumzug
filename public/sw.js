const CACHE_NAME = 'rothirsch-erp-v2.16.3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Offline fallback page or basic assets could be cached here
      return cache.addAll([
        '/'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Non-GET requests and API calls must bypass the service worker cache
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  // We use network first, fallback to cache for PWA offline criteria
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
