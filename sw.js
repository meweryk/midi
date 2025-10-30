const CACHE_NAME = 'midi-bells-v9.68';
const DYNAMIC_CACHE = 'dynamic-cache-v9.68';
const FALLBACK_HTML = '/midi/index.html';
const FALLBACK_IMAGE = '/midi/icon-192.png';

const urlsToCache = [
  // Основные страницы
  '/midi/',
  '/midi/index.html',
  '/midi/processorG.html',
  '/midi/kolokol0018.html',
  '/midi/calc_music.html',
  '/midi/raman-ir-uv.html',
  '/midi/Eyler.html',
  
  // Статические активы
  '/midi/icon-192.png',
  '/midi/icon-512.png',
  '/midi/manifest.json',
  
  // Скрипты и стили (добавьте ваши реальные пути)
  //'/midi/main.js',
  //'/midi/styles.css',
  
  // Внешние зависимости
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
   
  // Аудиоресурсы (пример)
  //'/midi/audio/bell.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэширование основных ресурсов');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[SW] Ошибка при установке:', err);
      })
  );
});

self.addEventListener('fetch', event => {
  // 1. Обработка API запросов
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkRes => {
          // Клонируем ответ для кэширования
          const resClone = networkRes.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(event.request, resClone));
          return networkRes;
        })
        .catch(() => {
          // Пытаемся вернуть из кэша при ошибке сети
          return caches.match(event.request);
        })
    );
    return;
  }

  // 2. Обработка статических ресурсов
  event.respondWith(
    caches.match(event.request)
      .then(cacheRes => {
        // 2.1. Ресурс найден в кэше
        if (cacheRes) {
          console.log(`[SW] Используем кэш: ${event.request.url}`);
          return cacheRes;
        }
        
        // 2.2. Загрузка из сети
        return fetch(event.request)
          .then(fetchRes => {
            // Кэшируем только успешные GET-ответы
            if (fetchRes.ok && event.request.method === 'GET') {
              const resClone = fetchRes.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  console.log(`[SW] Кэшируем ресурс: ${event.request.url}`);
                  cache.put(event.request, resClone);
                });
            }
            return fetchRes;
          })
          .catch(error => {
            console.error(`[SW] Ошибка сети: ${event.request.url}`, error);
            
            // 2.3. Fallback-стратегии
            // Для HTML - главная страница
            if (event.request.destination === 'document' || 
                event.request.headers.get('accept').includes('text/html')) {
              return caches.match(FALLBACK_HTML);
            }
            
            // Для изображений - заглушка
            if (event.request.destination === 'image') {
              return caches.match(FALLBACK_IMAGE);
            }
            
            // Для CSS - пустой ответ
            if (event.request.destination === 'style') {
              return new Response('', { 
                status: 204, 
                statusText: 'No Content',
                headers: {'Content-Type': 'text/css'}
              });
            }
            
            // Для JS - пустой ответ
            if (event.request.destination === 'script') {
              return new Response('// Offline', { 
                status: 200,
                headers: {'Content-Type': 'application/javascript'}
              });
            }
            
            // Общий fallback
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
          });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => 
          key !== CACHE_NAME && 
          key !== DYNAMIC_CACHE
        ).map(key => {
          console.log('[SW] Удаляем старый кэш:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      console.log('[SW] Активирован с новым кэшем');
      return self.clients.claim();
    })
  );
});
