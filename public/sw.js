const CACHE_NAME = 'rothirsch-erp-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Offline fallback page or basic assets could be cached here
      return cache.addAll([
        '/'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // We use network first, fallback to cache for PWA offline criteria
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
