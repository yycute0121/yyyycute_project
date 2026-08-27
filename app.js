/* 个人记账工作台 v2 — 应用加载器（拆分加载版）
 * 说明：GitHub 单文件上传存在大小限制，原 app.js 拆分为
 *       app.part1.js ~ app.part4.js，由本文件按序注入。
 *       经典 <script> 共享全局作用域，行为与原单文件一致。
 * 版本：2026-08-09f SW 更新接管后自动刷新，PWA/桌面图标也能拿到最新代码
 */
(function () {
  var ver = 'v20260827a';
  var parts = ['app.part1.js', 'app.part2.js', 'app.part3.js', 'app.part4.js'];
  // defer 脚本按顺序执行且并行下载，替代 document.write 的串行阻塞加载
  for (var i = 0; i < parts.length; i++) {
  var s = document.createElement('script');
  s.src = parts[i] + '?' + ver;
  s.defer = true;
  document.head.appendChild(s);
  }
  // Service Worker 更新接管页面后自动刷新一次，保证添加到桌面（PWA）也立即用最新代码
  if ('serviceWorker' in navigator) {
    var swDone = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (swDone) return;
      swDone = true;
      location.reload();
    });
  }
})();
