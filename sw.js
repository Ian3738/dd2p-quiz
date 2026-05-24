// 升 cache 版本號就會 invalidate 舊快取
const CACHE = 'dd2p-v5-speed-battle';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './quizzes.json',
  './icon-180.png',
  './icon-512.png',
  './images/sprites/background.png',
  './images/sprites/fighter-p1.png',
  './images/sprites/fighter-p2.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// === Network-first 給 sprites/HTML/CSS/JS/題庫 JSON（讓更新立刻看到）===
// === Cache-first 給題目圖片（量大且不常變動）===
const NETWORK_FIRST = /\/(index\.html|style\.css|game\.js|manifest\.json|quizzes\.json|images\/sprites\/)/;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const useNetworkFirst = NETWORK_FIRST.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');

  if (useNetworkFirst) {
    e.respondWith(
      fetch(req).then((res) => {
        if (url.origin === location.origin && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (url.origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => hit);
      })
    );
  }
});
