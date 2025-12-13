const CACHE_NAME = 'priotool-v3.0.4';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js?v=3.0.2',
  './js/auth.js?v=3.0.2',
  './js/firebase-config.js?v=3.0.2',
  './js/modules/auth-service.js',
  './js/modules/firebase-init.js',
  './js/modules/main.js',
  './js/modules/ui-common.js',
  './assets/img/logo-ot.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force new SW to activate immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim(); // Take control of all clients immediately
});

self.addEventListener('fetch', (e) => {
  // Network first for HTML to ensure version check works
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
