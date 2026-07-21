// منصّة الفيزياء — Service Worker
// يخزّن هيكل الصفحة (index.html + الخطوط + الأيقونات) عشان التطبيق
// يفتح حتى بدون إنترنت. بيانات القوانين والأسئلة نفسها تُخزَّن تلقائياً
// عبر Firestore offline persistence (مفعّلة داخل index.html).

const CACHE_VERSION = 'physics-platform-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-180.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.all(
        APP_SHELL.map(url => cache.add(url).catch(() => {}))
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept Firebase/Firestore/Storage/Google API traffic — those
  // need to hit the network directly (Firestore has its own offline cache).
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebasestorage') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('generativelanguage') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // App shell (this same origin): network-first so users always get the
  // latest version when online, falling back to the cached copy offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Fonts and other third-party static assets: cache-first for speed.
  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, resClone)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
