const CACHE_NAME = 'putrimas-v5'; // UBAH ANGKA VERSI INI
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
// Menangkap aksi ketika notifikasi diklik pengguna
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Jika aplikasi sudah terbuka, fokuskan tab-nya
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum terbuka, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});