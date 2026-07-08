const CACHE_NAME = 'putrimas-v6'; // Pastikan menaikkan versi ini jika ada update berikutnya
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/storage.js',
  './js/api.js',
  './js/auth.js',
  './js/ui.js',
  './icon-192.png.png',
  './icon-512.png.png'
];

// 1. Install & Simpan Cache Baru
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    }).then(() => self.skipWaiting()) // Memaksa SW baru langsung aktif
  );
});

// 2. FUNGSI BARU: Hapus Cache Lama Otomatis
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Hapus semua nama cache yang tidak sama dengan versi terbaru
          if (cacheName !== CACHE_NAME) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Strategi Pengambilan File (Network-First Fallback Cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    // Mencoba mengambil data asli dari internet (Network) terlebih dahulu
    fetch(event.request).catch(() => {
      // Jika gagal (benar-benar offline), baru ambil dari Cache
      return caches.match(event.request);
    })
  );
});

// 4. Menangkap aksi ketika notifikasi diklik pengguna
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/') !== -1 && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});