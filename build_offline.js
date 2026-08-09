const fs = require('fs');
const path = require('path');

const dir = '/workspace';
const chartJs = fs.readFileSync('/tmp/chart.umd.min.js', 'utf8');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const iconSvg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const manifestJson = fs.readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8');

// 1) 内联 CSS（兼容带 ?v= 查询参数）
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="styles\.css[^"]*"[^>]*>/,
  '<style>\n' + css + '\n</style>');

// 2) Chart.js CDN 行 -> 内联（同步，离线可用）
html = html.replace(
  /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@[^"]*"[^>]*><\/script>/,
  '<script>\n' + chartJs + '\n</script>');

// 3) app.js -> 内联（兼容带 ?v= 查询参数）
html = html.replace(/<script[^>]*src="app\.js[^"]*"[^>]*><\/script>/,
  '<script>\n' + appJs + '\n</script>');

// 4) 图标与 manifest 内联为 data URI，使离线版零外部依赖
const iconDataUri = 'data:image/svg+xml,' + encodeURIComponent(iconSvg);
const manifestDataUri = 'data:application/manifest+json,' + encodeURIComponent(manifestJson);
html = html.replace(/<link[^>]*rel="icon"[^>]*href="icon\.svg[^"]*"[^>]*>/,
  '<link rel="icon" href="' + iconDataUri + '" />');
// apple-touch-icon 使用相对路径，部署到任何环境（GitHub Pages / 本地）都生效，
// 不再依赖当前预览服务器，避免服务器休眠后图标拉取失败
html = html.replace(/<link[^>]*rel="apple-touch-icon"[^>]*href="[^"]*"[^>]*>/g,
  '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon-180.png" />');
html = html.replace(/<link[^>]*rel="manifest"[^>]*href="manifest\.webmanifest[^"]*"[^>]*>/,
  '<link rel="manifest" href="manifest.webmanifest" />');

fs.writeFileSync(path.join(dir, 'offline.html'), html, 'utf8');
console.log('offline.html 生成完成，大小', (html.length/1024).toFixed(0), 'KB');
