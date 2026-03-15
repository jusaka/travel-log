const CACHE_NAME = 'travellog-v3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/utils.js',
  './js/store.js',
  './js/map.js',
  './js/trips.js',
  './js/stats.js',
  './js/annual.js',
  './js/app.js',
  './data/airports.js',
  './data/world.json',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
