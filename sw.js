/* 小羊记账平台 — Service Worker
 * 作用：把离线版 HTML 与图标缓存到手机本地，
 *       实现「断网 / 服务器休眠」也能打开 App。
 */
// 2026-08-09h v9：manifest 也走网络优先（PWA start_url 改为 index.html，
//                 避免旧缓存把 manifest.webmanifest 卡住导致启动页无法更新）
const CACHE = 'xiaoyang-ledger-v12';
const ASSETS = [
  './',
  './offline.html',        // 单文件自包含版，断网兜底
 './chart.umd.min.js', // 图表库本地化，避免 CDN 波动拖慢首屏
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

// 拦截请求：
// - version.json 始终走网络（保证版本检测实时）
// - HTML/JS/CSS 走「缓存优先 + 后台更新」：打开秒开，新版本由更新提示条引导刷新
// - 其他静态资源（图标/图片等）走「缓存优先」保证离线可用。
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 跨域请求放行，交给浏览器
  if (/version\.json(\?|$)/i.test(url.pathname)) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  const isDocOrScript = e.request.mode === 'navigate' || /\.(js|css|webmanifest|html)(\?|$)/i.test(url.pathname);
  e.respondWith(isDocOrScript ? staleWhileRevalidate(e) : cacheFirst(e));
});

/* 缓存优先 + 后台更新：有缓存立即返回（秒开），同时后台拉最新写回缓存 */
function staleWhileRevalidate(e){
  return caches.match(e.request).then((cached) => {
    const fetchPromise = fetch(e.request)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return resp;
      })
      .catch(() => cached || caches.match('./offline.html'));
    return cached || fetchPromise;
  });
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
