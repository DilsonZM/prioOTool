const CACHE_NAME = 'priotool-v11-autosave-local';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  './js/auth.js',
  './js/firebase-config.js',
  './js/modules/auth-service.js',
  './js/modules/firebase-init.js',
  './js/modules/main.js',
  './js/modules/ui-common.js',
  './assets/img/logo-ot.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});