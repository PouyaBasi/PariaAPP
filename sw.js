// Service worker: offline support + web push (OneSignal) + notification taps
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (e) {}

const CACHE = 'paria-v1';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'messages.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    // network first (so updates arrive), cache as the offline fallback
    e.respondWith(fetch(r).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {}); return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
  } else if (/googleapis\.com$|gstatic\.com$/.test(u.hostname)) {
    // fonts: cache first, refresh in the background
    e.respondWith(caches.match(r).then(m => {
      const net = fetch(r).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)).catch(() => {}); return res; }).catch(() => m);
      return m || net;
    }));
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    if (clients.openWindow) return clients.openWindow('./');
  }));
});
