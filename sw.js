// Service worker Otit Saving.
// Naikkan CACHE_VERSION setiap kali daftar APP_SHELL berubah.
var CACHE_VERSION = 'v2';
var CACHE_NAME = 'otit-saving-' + CACHE_VERSION;

var APP_SHELL = [
  './',
  './index.html',
  './config.js',
  './manifest.webmanifest',
  './assets/style.css',
  './assets/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k.indexOf('otit-saving-') === 0 && k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Stale-while-revalidate untuk file aplikasi (same-origin GET).
// Permintaan ke Apps Script (lintas origin, POST) tidak disentuh — data selalu langsung dari server.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        var network = fetch(req)
          .then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(function () {
            // Offline: navigasi jatuh ke index.html dari cache.
            if (req.mode === 'navigate') return cache.match('./index.html');
            return cached;
          });
        if (cached) {
          event.waitUntil(network.catch(function () {}));
          return cached;
        }
        return network;
      });
    })
  );
});
