/* 小羊记账平台 — Service Worker
 * 作用：把离线版 HTML 与图标缓存到手机本地，
 *       实现「断网 / 服务器休眠」也能打开 App。
 */
// 2026-08-09g v8：JS/HTML 改网络优先策略，更新不再被旧缓存卡死
const CACHE = 'xiaoyang-ledger-v8';
const ASSETS = [
  './',
  './offline.html',        // 单文件自包含版，断网核心
  './manifest.webmanifest',
  './apple-touch-icon-180.png',
  './icon-192.png',
  './icon.png',
  './brand-sheep.svg',
  './brand-sheep.png',
  './icon.svg'
];

// 安装：预缓存关键资源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存并接管所有页面
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 拦截请求：HTML/JS 走「网络优先」（有网必拿最新代码，避免旧缓存卡住更新），
// 其他静态资源（图标/图片等）走「缓存优先」保证离线可用。
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isDocOrScript = e.request.mode === 'navigate' || /\.js(\?|$)/i.test(url.pathname);
  e.respondWith(isDocOrScript ? fetchFirst(e) : cacheFirst(e));
});

function fetchFirst(e){
  return fetch(e.request)
    .then((resp) => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return resp;
    })
    .catch(() => caches.match(e.request).then((c) => c || caches.match('./offline.html')));
}

function cacheFirst(e){
  return caches.match(e.request).then((cached) => {
    if (cached) return cached;
    return fetch(e.request)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return resp;
      })
      .catch(() => caches.match('./offline.html'));
  });
}
