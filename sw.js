/* 小羊记账平台 — Service Worker
 * 作用：把离线版 HTML 与图标缓存到手机本地，
 *       实现「断网 / 服务器休眠」也能打开 App。
 */
// 2026-08-09c v4：修复新增按钮事件参数 bug，换缓存名强制全量刷新
const CACHE = 'xiaoyang-ledger-v4';
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

// 拦截请求：优先走缓存（离线可用），失败再回退网络，最后回退离线页
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
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
    })
  );
});
