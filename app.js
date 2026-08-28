/* 个人记账工作台 v2 — 应用加载器（拆分加载版）
 * 说明：GitHub 单文件上传存在大小限制，原 app.js 拆分为
 *       app.part1.js ~ app.part4.js，由本文件按序注入。
 *       经典 <script> 共享全局作用域，行为与原单文件一致。
 * 版本：2026-08-09f SW 更新接管后自动刷新，PWA/桌面图标也能拿到最新代码
 */
(function () {
  var ver = 'v20260828a';
  var parts = ['app.part1.js', 'app.part2.js', 'app.part3.js', 'app.part4.js'];
  // 注意：动态插入的脚本 defer 不保证执行顺序，必须用 document.write 保证分片按序执行
  for (var i = 0; i < parts.length; i++) {
  document.write('<script src="' + parts[i] + '?' + ver + '"><\/script>');
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
