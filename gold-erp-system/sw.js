const CACHE_NAME = 'putrimas-v2'; // UBAH ANGKA VERSI INI
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/storage.js',
  './js/api.js',
  './js/auth.js',
  './js/ui.js',
  './icon-192.png',
  './icon-512.png'
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
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});