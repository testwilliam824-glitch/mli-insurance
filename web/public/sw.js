// 三商美邦人壽 PWA Service Worker
const CACHE_VERSION = 'mli-v1';
const CACHE_NAME = `mli-cache-${CACHE_VERSION}`;

// 預先快取靜態資源（app shell）
const PRECACHE_URLS = [
  '/',
  '/life.html',
  '/property.html',
  '/auto.html',
  '/claim.html',
  '/css/common.css',
  '/css/questionnaire.css',
  '/css/admin.css',
  '/js/questionnaire.js',
  '/js/admin.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// 安裝：預快取
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// 啟用：清舊版 cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('mli-cache-') && k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch 策略：
// - API：永遠走網路（不快取，避免提交資料被攔截）
// - 其他：network-first → 失敗 → cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 一律走網路（避免快取住表單提交）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 只處理 GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match('/')))
  );
});
