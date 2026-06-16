/**
 * Service Worker — EDT EPS PWA
 * Cache statique pour usage hors-ligne
 * Base : /edt-eps/ (GitHub Pages)
 */
const CACHE_NAME = 'edt-eps-v2';
const BASE = '/edt-eps/';

const PRECACHE_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'assets/icons/icon-192.png',
  BASE + 'assets/icons/icon-512.png',
];

// Install — précacher les fichiers statiques
// Ne pas appeler skipWaiting() ici : l'app décide du bon moment
// pour activer la mise à jour (après que l'utilisateur a sauvegardé).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Message : l'app peut déclencher l'activation via postMessage({type:'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Activate — nettoyer les anciens caches
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

// Fetch — stratégie Network First, fallback Cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline', { status: 503 });
        });
      })
  );
});
