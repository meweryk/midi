const CACHE_NAME = 'midi-bells-v1';
const DYNAMIC_CACHE = 'dynamic-cache-v1';
const urlsToCache = [
  '/midi/',
  '/midi/index.html',
  '/midi/kolokol0018.html',
  '/midi/icon-192.png',
  '/midi/icon-512.png',
  // Добавьте другие HTML/CSS/JS файлы
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cacheRes => {
      return cacheRes || fetch(event.request).then(fetchRes => {
        return caches.open(DYNAMIC_CACHE).then(cache => {
          cache.put(event.request.url, fetchRes.clone());
          return fetchRes;
        });
      });
    }).catch(() => {
      // Fallback для ошибок
      if(event.request.url.indexOf('.html') > -1) {
        return caches.match('/midi/index.html');
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
        .map(key => caches.delete(key))
    )
  );
});
