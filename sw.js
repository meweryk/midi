const CACHE_NAME = 'midi-bells-v15.5';
const DYNAMIC_CACHE = 'dynamic-cache-v15.5';
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
  const url = new URL(event.request.url);
  const tempFileUrl = '/midi/get-temporary-file';
  
  // ================= 1. ВРЕМЕННЫЕ ФАЙЛЫ (ВАШ РАБОТАЮЩИЙ КОД) =================
  // А) Принимаем файл от главной страницы и сохраняем в кэш
  if (event.request.url.includes(tempFileUrl) && event.request.method === 'PUT') {
    event.respondWith(
      caches.open(DYNAMIC_CACHE)
      .then(cache => {
        return event.request.blob().then(blob => {
          const responseToCache = new Response(blob, {
            status: 200,
            headers: { 'Content-Type': 'audio/wav' }
          });
          return cache.put(tempFileUrl, responseToCache);
        });
      })
      .then(() => {
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
  
  // Б) Отдаем этот файл странице Spector_bin.html
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
  
  // ================= 2. НАВИГАЦИЯ ПО СТРАНИЦАМ (НОВЫЙ КОД) =================
  // Проверяем, является ли запрос переходом на HTML-страницу
  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.method === 'GET' &&
      event.request.destination === 'document');
  
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
      .then(response => {
        // Кэшируем страницу для офлайн-доступа
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(async () => {
        // При отсутствии сети - ищем в кэше
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Если нет - показываем главную страницу
        return caches.match(FALLBACK_HTML);
      })
    );
    return;
  }
  
  // ================= 3. API ЗАПРОСЫ (ВАШ КОД) =================
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
      .then(networkRes => {
        const resClone = networkRes.clone();
        caches.open(DYNAMIC_CACHE)
          .then(cache => cache.put(event.request, resClone));
        return networkRes;
      })
      .catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // ================= 4. СТАТИЧЕСКИЕ РЕСУРСЫ (ВАШ КОД С УЛУЧШЕНИЯМИ) =================
  event.respondWith(
    caches.match(event.request)
    .then(cacheRes => {
      if (cacheRes) {
        console.log(`[SW] Используем кэш: ${event.request.url}`);
        return cacheRes;
      }
      
      return fetch(event.request)
        .then(fetchRes => {
          // Кэшируем только успешные GET-ответы
          if (fetchRes.ok && event.request.method === 'GET' &&
            !event.request.url.includes(tempFileUrl)) {
            
            const resClone = fetchRes.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                console.log(`[SW] Кэшируем: ${event.request.url}`);
                cache.put(event.request, resClone);
              });
          }
          return fetchRes;
        })
        .catch(error => {
          console.error(`[SW] Ошибка сети: ${event.request.url}`, error);
          
          // Fallback для HTML
          if (event.request.destination === 'document' ||
            event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match(FALLBACK_HTML);
          }
          
          // Fallback для изображений
          if (event.request.destination === 'image') {
            return caches.match(FALLBACK_IMAGE);
          }
          
          // Fallback для CSS
          if (event.request.destination === 'style') {
            return new Response('', {
              status: 204,
              headers: { 'Content-Type': 'text/css' }
            });
          }
          
          // Fallback для JS
          if (event.request.destination === 'script') {
            return new Response('// Offline', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
            });
          }
          
          return new Response('', { status: 503 });
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