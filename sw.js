const CACHE_NAME = 'midi-bells-v15.1';
const DYNAMIC_CACHE = 'dynamic-cache-v13.8';
const FALLBACK_HTML = '/midi/index.html';
const FALLBACK_IMAGE = '/midi/icon-192.png';

const urlsToCache = [
  // Основные страницы
  '/midi/',
  '/midi/index.html',
  '/midi/processorG.html',
  '/midi/OrganicStudioFinal.html',
  '/midi/Vortex-gen.html',
  '/midi/kolokol0018.html',
  '/midi/converter-A.html',
  '/midi/sound_color_frequency.html',
  '/midi/calc_music.html',
  '/midi/Raman-ir-uv.html',
  '/midi/Eyler.html',
  '/midi/README.html',
  "/midi/container/SWB Generator.html",
  "/midi/container/Spector_bin.html",
  
  // Статические активы
  '/midi/icon-192.png',
  '/midi/icon-512.png',
  '/midi/manifest.json',
  
  // Внешние зависимости
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
   
];

self.addEventListener('install', event => {
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(cache => {
      console.log('[SW] Кэширование основных ресурсов');
      
      return Promise.all(
        urlsToCache.map(url => {
          // Если ресурс внешний (CDN), запрашиваем обычно. 
          // Если локальный (/midi/), заставляем сервер принудительно отдать свежую копию.
          const requestOptions = url.startsWith('http') ? {} : { cache: 'reload' };
          const request = new Request(url, requestOptions);
          
          return cache.add(request).catch(err => {
            console.error(`[SW] Ошибка кэширования: ${url}`, err);
            return Promise.resolve();
          });
        })
      );
    })
    .catch(err => {
      console.error('[SW] Общая ошибка при установке:', err);
    })
  );
});

self.addEventListener('fetch', event => {
  // ================= ВСТАВКА ДЛЯ ПЕРЕДАЧИ ФАЙЛОВ МЕЖДУ СТРАНИЦАМИ PWA =================
  const tempFileUrl = '/midi/get-temporary-file';

  // А) Принимаем файл от главной страницы и сохраняем в кэш
  if (event.request.url.includes(tempFileUrl) && event.request.method === 'PUT') {
    event.respondWith(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          // Создаем чистый Response из тела запроса и кладем в кэш
          return event.request.blob().then(blob => {
            const responseToCache = new Response(blob, {
              status: 200,
              headers: { 'Content-Type': 'audio/wav' }
            });
            return cache.put(tempFileUrl, responseToCache);
          });
        })
        .then(() => {
          // Возвращаем железобетонный JSON-ответ
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
        .catch(err => {
          return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }


  // Б) Отдаем этот файл странице Spector_bin.html, когда она его запросит
  if (event.request.url.includes(tempFileUrl) && event.request.method === 'GET') {
    event.respondWith(
      caches.match(tempFileUrl)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('Файл не найден или устарел', { status: 404 });
        })
    );
    return;
  }

  // 2. Обработка API запросов
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
            // Кэшируем только успешные GET-ответы, 
            // Исключая временный файл передачи данных и ваши внутренние страницы /midi/ (они обновляются по CACHE_NAME)
            if (fetchRes.ok && event.request.method === 'GET' && 
                !event.request.url.includes(tempFileUrl) && 
                !event.request.url.includes('/midi/')) {
              
              const resClone = fetchRes.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  console.log(`[SW] Кэшируем внешний ресурс в динамику: ${event.request.url}`);
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
        Promise.all([
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
            }),
            self.clients.claim()
        ]).then(() => {
            console.log('[SW] Активирован с новым кэшем');
            // Уведомляем все клиенты об обновлении
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'SW_UPDATED' });
                });
            });
        })
    );
});

self.addEventListener('message', event => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});