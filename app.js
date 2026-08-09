/* 个人记账工作台 v2 — 应用加载器（拆分加载版）
 * 说明：GitHub 单文件上传存在大小限制，原 app.js 拆分为
 *       app.part1.js ~ app.part4.js，由本文件按序注入。
 *       经典 <script> 共享全局作用域，行为与原单文件一致。
 * 版本：2026-08-09e 关联资产默认选中第一个
 */
(function () {
  var ver = 'v20260809e';
  var parts = ['app.part1.js', 'app.part2.js', 'app.part3.js', 'app.part4.js'];
  for (var i = 0; i < parts.length; i++) {
    document.write('<script src="' + parts[i] + '?' + ver + '"><\/script>');
  }
})();
