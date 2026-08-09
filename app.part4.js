'use strict';
function init(){
  // 1.2.2 筛选选项：首页/记账页保留 day/week/lastWeek/month，统计页额外支持 lastMonth/year/all
  const validFilterTypes = ['day','week','lastWeek','month','lastMonth','year','all','custom'];
  if (!validFilterTypes.includes(state.filter.type)) {
    state.filter.type = 'week';
    save();
  }
  // 老用户迁移：从旧版本升级后首次进入，默认切到「本周」
  if (!state.defaultFilterMigrated) {
    state.filter.type = 'week';
    state.defaultFilterMigrated = true;
    save();
  }
  // 初始化筛选按钮状态
  const homeFilter = state.filter.type;
  [...qs('homeFilterSeg').children].forEach(x=>x.classList.toggle('active', x.dataset.filter===homeFilter));
  [...qs('statsFilterSeg').children].forEach(x=>x.classList.toggle('active', x.dataset.filter===homeFilter));
  [...qs('recordFilterSeg').children].forEach(x=>x.classList.toggle('active', x.dataset.filter===homeFilter));
  [...qs('statsChartTab').children].forEach(x=>x.classList.toggle('active', x.dataset.chart===state.chartTab));
  [...qs('viewSwitch').querySelectorAll('.seg-btn')].forEach(x=>x.classList.toggle('active', x.dataset.view===state.view));
  // 初始化时间范围输入框
  const range = getRange();
  if (qs('sRangeStart')) qs('sRangeStart').value = range.start;
  if (qs('sRangeEnd')) qs('sRangeEnd').value = range.end;
  if (qs('rRangeStart')) qs('rRangeStart').value = range.start;
  if (qs('rRangeEnd')) qs('rRangeEnd').value = range.end;

  bindEvents();
  // Chart.js 异步加载完成后，重渲染当前页以补全图表
  const chartScript = document.querySelector('script[src*="chart.js"]');
  if (chartScript) chartScript.addEventListener('load', () => renderCurrentPage());
  // 顶栏刷新按钮 & 新版本提示
  qs('refreshBtn').addEventListener('click', forceRefresh);
  qs('ubRefresh').addEventListener('click', forceRefresh);
  checkUpdate();
  checkUpdateRemote();
  // 启动时自动检查今天是否有到期的定期收支
  generateRecurring();
  // 根据hash或默认页面启动
  const hash = location.hash.slice(1);
  const validPages = ['home','record','stats','budget','goals','recurring','calendar','assets','settings'];
  switchPage(validPages.includes(hash) ? hash : (state.page || 'home'));
}

/* 强制刷新获取最新代码（数据在 localStorage，不会丢失） */
function forceRefresh(){
  state.seenVersion = APP_VERSION; save();
  location.reload(true);
}

/* 老用户检测版本更新并提示 */
function checkUpdate(){
  const banner = qs('updateBanner');
  if (!banner) return;
  if (state.seenVersion && state.seenVersion !== APP_VERSION){
    banner.hidden = false;
    qs('ubText').textContent = `🎉 已更新到 v${APP_VERSION}，点「刷新」应用最新功能`;
  }
}

/* 远程版本检测：从 version.json 比对，有新版本自动弹提示 */
function checkUpdateRemote(){
  const banner = qs('updateBanner');
  if (!banner) return;
  if (!location.protocol.startsWith('http')) return;   // 离线 file:// 环境不查
  fetch('version.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d || !d.version) return;
      if (d.version === APP_VERSION) return;          // 已是最新
      banner.hidden = false;
      qs('ubText').textContent = `🐑 小羊喊你更新版本啦 v${d.version}，点此更新`;
      // 更新按钮：在线环境直接刷新；离线 file:// 环境引导下载最新离线版
      qs('ubRefresh').onclick = () => {
        if (location.protocol.startsWith('http')) {
          forceRefresh();
        } else if (d.offline) {
          const a = document.createElement('a');
          a.href = d.offline; a.download = d.offline; a.target = '_blank';
          document.body.appendChild(a); a.click(); a.remove();
          alert('已下载最新离线版，请重新打开该文件以应用更新。');
        }
      };
    })
    .catch(() => {/* 离线/无网络时静默跳过 */});
}

init();
