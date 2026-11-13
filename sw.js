/* Offline cache. Bump VERSION whenever any file changes so phones pick up the update. */
var VERSION = 'pa10-v66';
var SHELL = [
  './', './index.html', './app.css', './app.js', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './vendor/tesseract/tesseract.min.js', './vendor/tesseract/worker.min.js',
  './vendor/tesseract/tesseract-core-lstm.wasm.js', './vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/eng.traineddata.gz'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return caches.open('pa10-data').then(function (d) { return d.addAll(['./data/records.json', './data/extra.json']).catch(function () {}); }); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION && k !== 'pa10-data'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  /* Records: network first so new deadlines show up, cached copy when offline. */
  if (url.pathname.endsWith('/data/records.json') || url.pathname.endsWith('/data/extra.json')) {
    e.respondWith(fetch(req).then(function (r) {
      var copy = r.clone(); caches.open('pa10-data').then(function (c) { c.put(req, copy); }); return r;
    }).catch(function () { return caches.match(req); }));
    return;
  }
  /* Big files that never change: cache first. App code and pages: network first, so fixes arrive at once; cached copy when offline. */
  if (url.pathname.indexOf('/vendor/') !== -1 || url.pathname.indexOf('/icons/') !== -1) {
    e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
    return;
  }
  e.respondWith(fetch(req).then(function (r) {
    var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); return r;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
});
