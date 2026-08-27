/* =========================================================
   个人记账工作台 v2 — 页面路由版
   纯前端 / 本地持久化 (IndexedDB，自动迁移旧 localStorage 数据)
   ========================================================= */
'use strict';

const STORE_KEY = 'pw_account_book_v1';
const APP_VERSION = '1.2.3';
const PALETTE = ['#3498db','#27ae90','#e67e22','#9b59b6','#f1c40f','#e74c3c',
                 '#1abc9c','#34495e','#16a085','#d35400','#8e44ad','#2ecc71',
                 '#f39c12','#c0392b','#2980b9','#7f8c8d'];

const DEFAULTS = {
  incomeCategories: ['工资','奖金','公积金利息','兼职','理财收益','红包','其他收入'],
  expenseCategories: ['餐饮','住房','交通','购物','医疗','娱乐','旅行','人情','学习','服装','其他'],
};

/* ---------- IndexedDB 存储层（异步，不阻塞 UI） ---------- */
const IDB_NAME = 'pw_account_book';
const IDB_STORE = 'kv';
let idbReady = false;

function idbOpen(){
 return new Promise((resolve, reject) => {
 const req = indexedDB.open(IDB_NAME, 1);
 req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
 req.onsuccess = () => resolve(req.result);
 req.onerror = () => reject(req.error);
 });
}
function idbGet(key){
 return idbOpen().then(db => new Promise((resolve, reject) => {
 const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
 req.onsuccess = () => resolve(req.result);
 req.onerror = () => reject(req.error);
 }));
}
function idbSet(key, val){
 return idbOpen().then(db => new Promise((resolve, reject) => {
 const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(val, key);
 req.onsuccess = () => resolve();
 req.onerror = () => reject(req.error);
 }));
}
function idbClear(){
 return idbOpen().then(db => new Promise((resolve, reject) => {
 const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).clear();
 req.onsuccess = () => resolve();
 req.onerror = () => reject(req.error);
 }));
}

/* ---------- 状态 ---------- */
let state = defaultState();

function defaultState(){
 return {
 transactions: [], incomeCategories: DEFAULTS.incomeCategories.slice(),
 expenseCategories: DEFAULTS.expenseCategories.slice(),
 budget: { total: 0, categories: {} },
 goals: [], recurring: [], assets: [],
 filter: { type:'week', single: todayStr(), start:'', end:'' },
 view: 'day', chartTab: 'expense', search: '', calMonth: todayStr().slice(0,7),
 page: 'home', recordPage: 1, defaultFilterMigrated: true, lastBackup: '', lastRestore: '', seenVersion: '',
 };
}

function normalizeState(s){
 const base = defaultState();
 s = Object.assign(base, s || {});
 s.incomeCategories = Array.isArray(s.incomeCategories) && s.incomeCategories.length ? s.incomeCategories : DEFAULTS.incomeCategories.slice();
 s.expenseCategories = Array.isArray(s.expenseCategories) && s.expenseCategories.length ? s.expenseCategories : DEFAULTS.expenseCategories.slice();
 s.transactions = Array.isArray(s.transactions) ? s.transactions : [];
 s.budget = s.budget && typeof s.budget === 'object' ? s.budget : { total: 0, categories: {} };
 s.goals = Array.isArray(s.goals) ? s.goals : [];
 s.recurring = Array.isArray(s.recurring) ? s.recurring : [];
 s.assets = Array.isArray(s.assets) ? s.assets : [];
 s.filter = s.filter && typeof s.filter === 'object' ? s.filter : { type:'week', single: todayStr(), start:'', end:'' };
 return s;
}

/* 启动时异步加载：先读 IndexedDB，没有则迁移 localStorage 旧数据 */
async function loadState(){
 try {
 const saved = await idbGet('state');
 if (saved) {
 state = normalizeState(saved);
 } else {
 const raw = localStorage.getItem(STORE_KEY);
 if (raw) {
 state = normalizeState(JSON.parse(raw));
 await idbSet('state', state);
 localStorage.removeItem(STORE_KEY);
 }
 }
 } catch(e){ console.warn('读取本地数据失败', e); }
 idbReady = true;
 // 申请持久化存储，降低被浏览器自动清理的概率
 if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* 防抖保存：300ms 内多次操作只落盘一次；页面隐藏/关闭时立即落盘 */
let saveTimer = null;
function save(){
 clearTimeout(saveTimer);
 saveTimer = setTimeout(saveNow, 300);
}
function saveNow(){
 clearTimeout(saveTimer);
 if (!idbReady) return;
 idbSet('state', state).catch(e => console.warn('保存失败', e));
}
window.addEventListener('beforeunload', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

/* 整库导入：用备份对象覆盖当前数据，补齐缺省字段 */
function importData(obj){
  const base = defaultState(); // 取默认骨架
  state = Object.assign(base, {
    transactions: Array.isArray(obj.transactions) ? obj.transactions : base.transactions,
    incomeCategories: Array.isArray(obj.incomeCategories) ? obj.incomeCategories : base.incomeCategories,
    expenseCategories: Array.isArray(obj.expenseCategories) ? obj.expenseCategories : base.expenseCategories,
    budget: obj.budget && typeof obj.budget==='object' ? obj.budget : base.budget,
    goals: Array.isArray(obj.goals) ? obj.goals : base.goals,
    recurring: Array.isArray(obj.recurring) ? obj.recurring : base.recurring,
    assets: Array.isArray(obj.assets) ? obj.assets : base.assets,
    filter: obj.filter && typeof obj.filter==='object' ? obj.filter : base.filter,
    view: obj.view || base.view,
    chartTab: obj.chartTab || base.chartTab,
    search: obj.search || '',
    calMonth: obj.calMonth || base.calMonth,
    page: obj.page || 'home',
    lastBackup: obj.lastBackup || base.lastBackup,
    lastRestore: obj.lastRestore || base.lastRestore,
  });
  save();
}

/* ---------- 工具 ---------- */
const qs = id => document.getElementById(id);
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayStr(){ return ymd(new Date()); }
function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function parseYmd(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfWeek(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
function startOfMonthStr(d){ return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); }
function endOfMonthStr(d){ return ymd(new Date(d.getFullYear(), d.getMonth()+1, 0)); }
function fmtMoney(n){ return '¥' + (Number(n)||0).toLocaleString('zh-CN',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function updateAssetSelect(type){
  const sel = qs('rAsset');
  if (!sel) return;
  const cashFirst = [...state.assets].sort((a,b)=> (a.type==='cash'?-1:1) - (b.type==='cash'?-1:1));
  const first = cashFirst.length ? cashFirst[0] : null;
  sel.innerHTML = '<option value="">无</option>' + cashFirst.map(a=>`<option value="${a.id}" ${first && a.id===first.id?'selected':''}>${a.type==='cash'?'💵':'💳'} ${esc(a.name)} (${fmtMoney(a.balance)})</option>`).join('');
}
function fmtDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function catIcon(type, cat){
  const map = type==='income'
    ? {工资:'💼',奖金:'🎁',公积金利息:'🏦',兼职:'🛠️',理财收益:'📈',红包:'🧧',其他收入:'💰'}
    : {餐饮:'🍜',住房:'🏠',交通:'🚌',购物:'🛍️',医疗:'💊',娱乐:'🎮',旅行:'✈️',人情:'🎉',学习:'📚',服装:'<img src="cat-clothing.svg" class="cat-icon-img" alt="">',其他:'📦'};
  return map[cat] || (type==='income'?'💰':'📦');
}

/* ---------- 周期范围 ---------- */
function getRange(){
  const f = state.filter.type, now = new Date();
  if (f==='day'){ const s = state.filter.single || todayStr(); return {start:s, end:s}; }
  if (f==='week'){ const s = startOfWeek(now); return {start: ymd(s), end: ymd(addDays(s,6))}; }
  if (f==='lastWeek'){ const s = addDays(startOfWeek(now), -7); return {start: ymd(s), end: ymd(addDays(s,6))}; }
  if (f==='last3Weeks'){ return {start: ymd(addDays(now, -20)), end: ymd(now)}; }
  if (f==='last7Days'){ return {start: ymd(addDays(now, -6)), end: ymd(now)}; }
  if (f==='month'){ return {start: startOfMonthStr(now), end: endOfMonthStr(now)}; }
  if (f==='lastMonth'){ const s=new Date(now.getFullYear(), now.getMonth()-1, 1); const e=new Date(now.getFullYear(), now.getMonth(), 0); return {start: ymd(s), end: ymd(e)}; }
  if (f==='year'){ return {start: ymd(new Date(now.getFullYear(),0,1)), end: ymd(new Date(now.getFullYear(),11,31))}; }
  if (f==='custom'){ return {start: state.filter.start||todayStr(), end: state.filter.end||todayStr()}; }
  if (f==='all'){ return {start: '1970-01-01', end: '2099-12-31'}; }
  return {start: startOfMonthStr(now), end: endOfMonthStr(now)};
}
function getRangeTxns(){
  const {start,end} = getRange();
  return state.transactions.filter(t => t.date >= start && t.date <= end);
}
function getListTxns(){
  let list = getRangeTxns();
  const q = (state.search||'').trim().toLowerCase();
  if (q) list = list.filter(t => (t.note||'').toLowerCase().includes(q) || (t.category||'').toLowerCase().includes(q));
  return list.sort((a,b)=> a.date<b.date?1 : a.date>b.date?-1 : b.id.localeCompare(a.id));
}

/* =========================================================
   页面路由
   ========================================================= */
function switchPage(page, opts={}){
  state.page = page; save();
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(p => p.hidden = true);
  // 显示目标页面
  const target = qs('page-'+page);
  if (target) target.hidden = false;
  // 更新标题
  const title = target?.dataset.title || '首页';
  qs('pageTitle').textContent = title;
  document.title = title + ' - 个人记账工作台';
  // 导航高亮
  document.querySelectorAll('.nav-item, .tab-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  // 关闭移动端抽屉
  qs('sidebar').classList.remove('open');
  qs('drawerMask').hidden = true;
  // 滚动到顶部
  qs('appMain').scrollTop = 0;
  // 触发页面渲染
  renderCurrentPage(opts);
}

function renderCurrentPage(opts={}){
  const p = state.page;
  if (p === 'home') renderHome();
  else if (p === 'record') renderRecord(opts);
  else if (p === 'stats') renderStatsPage();
  else if (p === 'budget') renderBudgetPage();
  else if (p === 'goals') renderGoalsPage();
  else if (p === 'recurring') renderRecurringPage();
  else if (p === 'calendar') renderCalendarPage();
  else if (p === 'assets') renderAssetsPage();
  else if (p === 'settings') renderSettingsPage();
}

/* =========================================================
   1. 首页渲染
   ========================================================= */
let homeChartInst = null;
function renderHome(){
  const txns = getRangeTxns();
  const inc = sum(txns.filter(t=>t.type==='income').map(t=>t.amount));
  const exp = sum(txns.filter(t=>t.type==='expense').map(t=>t.amount));
  qs('homeIncome').textContent = fmtMoney(inc);
  qs('homeExpense').textContent = fmtMoney(exp);
  qs('homeBalance').textContent = fmtMoney(inc - exp);
  qs('homeAsset').textContent = fmtMoney(sum(state.assets.map(a=>a.balance)));

  // 最近3笔
  const recent = state.transactions.slice().sort((a,b)=> a.date<b.date?1 : a.date>b.date?-1 : b.id.localeCompare(a.id)).slice(0,3);
  qs('homeRecent').innerHTML = recent.length ? recent.map(t=>`
    <div class="txn-item">
      <div class="txn-cat">${catIcon(t.type, t.category)}</div>
      <div class="txn-info"><div class="t-note">${esc(t.note || t.category)}</div><div class="t-sub">${t.date}</div></div>
      <div class="txn-amt ${t.type==='income'?'inc':'exp'}">${t.type==='income'?'+':'-'}${fmtMoney(t.amount)}${t.aa?'<span class="aa-tag">AA</span>':''}</div>
    </div>`).join('') : '<div class="empty-tip">暂无交易记录</div>';

  // 预算摘要
  const now = new Date();
  const ms = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const monthExp = state.transactions.filter(t=> t.type==='expense' && t.date.startsWith(ms));
  const spentTotal = sum(monthExp.map(t=>t.amount));
  const spentByCat = {};
  monthExp.forEach(t=>{ spentByCat[t.category] = (spentByCat[t.category]||0) + t.amount; });
  const totalBudget = Number(state.budget.total) || 0;
  const budgets = state.budget.categories || {};
  let budgetHtml = '';
  if (totalBudget > 0){
    const pct = totalBudget>0 ? (spentTotal/totalBudget*100) : 0;
    const over = spentTotal > totalBudget;
    let color = over ? 'var(--warn-red)' : (pct>=80 ? 'var(--warn-yellow)' : 'var(--teal)');
    budgetHtml = `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span>月度总预算</span><span>${pct.toFixed(0)}%</span>
        </div>
        <div class="bar"><span style="width:${Math.min(pct,100)}%;background:${color}"></span></div>
        <div style="font-size:12px;color:var(--ink-soft);margin-top:4px">
          已支出 ${fmtMoney(spentTotal)} / 预算 ${fmtMoney(totalBudget)} · ${over?'已超支':'剩余 '+fmtMoney(totalBudget-spentTotal)}
        </div>
      </div>`;
    // 超支分类预警
    const warnCats = Object.keys(budgets).filter(c=>{
      const b = budgets[c]; const s = spentByCat[c] || 0;
      return s > b || s/b >= 0.8;
    });
    if (warnCats.length){
      budgetHtml += `<div style="font-size:12px;color:var(--warn-red);font-weight:600">⚠ ${warnCats.map(c=>{
        const b=budgets[c]; const s=spentByCat[c] || 0;
        return s>b ? `${c}已超支` : `${c}即将超预算`;
      }).join(' · ')}</div>`;
    }
  } else {
    budgetHtml = '<div class="empty-tip">尚未设置预算，前往「预算」页面设置</div>';
  }
  qs('homeBudgetSummary').innerHTML = budgetHtml;

  // 迷你趋势图
  const wrap = qs('homeTrendChart').parentElement;
  const d = trendData();
  const has = d.labels.length > 0 && (sum(d.inc)>0 || sum(d.exp)>0);
  wrap.classList.toggle('empty', !has);
  if (!has){ if(homeChartInst){homeChartInst.destroy();homeChartInst=null;} return; }
  if (typeof Chart === 'undefined') return;
  const cfg = {
    type:'line',
    data:{ labels:d.labels, datasets:[
      {label:'收入', data:d.inc, borderColor:'#27ae90', backgroundColor:'rgba(39,174,144,.1)', fill:true, tension:.35, pointRadius:2, borderWidth:2},
      {label:'支出', data:d.exp, borderColor:'#e67e22', backgroundColor:'rgba(230,126,34,.1)', fill:true, tension:.35, pointRadius:2, borderWidth:2},
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>'¥'+v, font:{size:10} }, grid:{color:'#f0f0f0'} }, x:{ ticks:{font:{size:10}}, grid:{display:false} } } }
  };
  if (homeChartInst) { homeChartInst.data = cfg.data; homeChartInst.options = cfg.options; homeChartInst.update(); }
  else homeChartInst = new Chart(qs('homeTrendChart').getContext('2d'), cfg);
  }

/* =========================================================
   2. 记账页渲染
   ========================================================= */
function renderRecord(opts={}){
  // 从首页跳转时隐藏新增表单
  const addPanel = qs('page-record').querySelector('.panel');
  if (addPanel) addPanel.hidden = !!opts.hideAdd;
  // 同步时间范围输入框
  const rr = getRange();
  if (qs('rRangeStart')) qs('rRangeStart').value = rr.start;
  if (qs('rRangeEnd')) qs('rRangeEnd').value = rr.end;
  const list = getListTxns();
  const inc = sum(list.filter(t=>t.type==='income').map(t=>t.amount));
  const exp = sum(list.filter(t=>t.type==='expense').map(t=>t.amount));
  qs('rSumInc').textContent = fmtMoney(inc);
  qs('rSumExp').textContent = fmtMoney(exp);
  qs('rSumBal').textContent = fmtMoney(inc - exp);

  // 分页：每页 8 条，最多 3 页；汇总仍按完整 list 计算
  const pageSize = 8, maxPages = 3;
  const totalPages = Math.max(1, Math.min(Math.ceil(list.length / pageSize), maxPages));
  state.recordPage = Math.max(1, Math.min(state.recordPage || 1, totalPages));
  const pageStart = (state.recordPage - 1) * pageSize;
  const pageList = list.slice(pageStart, pageStart + pageSize);

  qs('recordList').innerHTML = pageList.length ? pageList.map(t=>`
    <div class="txn-item">
      <div class="txn-cat">${catIcon(t.type, t.category)}</div>
      <div class="txn-info"><div class="t-note">${esc(t.note || t.category)}</div><div class="t-sub">${t.date} · ${esc(t.category)}</div></div>
      <div class="txn-amt ${t.type==='income'?'inc':'exp'}">${t.type==='income'?'+':'-'}${fmtMoney(t.amount)}${t.aa?'<span class="aa-tag">AA</span>':''}</div>
      <div class="txn-actions">
        <button class="btn ghost small" data-edit="${t.id}">编辑</button>
        <button class="btn danger small" data-del="${t.id}">删除</button>
      </div>
    </div>`).join('') : '<div class="empty-tip">当前范围暂无账单</div>';

  const pg = qs('recordPagination');
  if (pg){
    pg.hidden = list.length === 0;
    qs('rPageInfo').textContent = `${state.recordPage} / ${totalPages}`;
    qs('rPagePrev').disabled = state.recordPage <= 1;
    qs('rPageNext').disabled = state.recordPage >= totalPages;
  }
}

/* =========================================================
   3. 统计页渲染
   ========================================================= */
let pieInst = null, lineInst = null;
function renderStatsPage(){
  // 同步时间范围输入框
  const rr = getRange();
  if (qs('sRangeStart')) qs('sRangeStart').value = rr.start;
  if (qs('sRangeEnd')) qs('sRangeEnd').value = rr.end;

  const wrap = qs('statsChartWrap');
  const tab = state.chartTab;
  const pieCanvas = qs('statsPieChart'), lineCanvas = qs('statsLineChart');


 // 排行/明细/饼图共用的数据，只算一次
 const isInc = tab === 'income';
 const txns = getRangeTxns().filter(t=> t.type === (isInc?'income':'expense'));
 const grouped = {};
 txns.forEach(t=>{ grouped[t.category] = (grouped[t.category]||0) + t.amount; });

  if (tab === 'trend'){
    pieCanvas.hidden = true; lineCanvas.hidden = false;
    const d = trendData();
    const has = d.labels.length > 0;
    wrap.classList.toggle('empty', !has);
    if (!has){ if(lineInst){lineInst.destroy();lineInst=null;} return; }
    if (typeof Chart === 'undefined') return;
    const cfg = {
      type:'line',
      data:{ labels:d.labels, datasets:[
        {label:'收入', data:d.inc, borderColor:'#27ae90', backgroundColor:'rgba(39,174,144,.12)', fill:true, tension:.35, pointRadius:3},
        {label:'支出', data:d.exp, borderColor:'#e67e22', backgroundColor:'rgba(230,126,34,.12)', fill:true, tension:.35, pointRadius:3},
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'top'} }, scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>'¥'+v } } } }
    };
    if (lineInst) { lineInst.data = cfg.data; lineInst.options = cfg.options; lineInst.update(); }
    else lineInst = new Chart(lineCanvas.getContext('2d'), cfg);
  } else {
    lineCanvas.hidden = true; pieCanvas.hidden = false;
    const labels = Object.keys(grouped);
    const data = labels.map(l=>grouped[l]);
    const has = labels.length > 0;
    wrap.classList.toggle('empty', !has);
    if (!has){ if(pieInst){pieInst.destroy();pieInst=null;} return; }
    if (typeof Chart === 'undefined') return;
    const cfg = {
      type:'doughnut',
      data:{ labels, datasets:[{ data, backgroundColor: labels.map((_,i)=>PALETTE[i%PALETTE.length]), borderWidth:2, borderColor:'#fff' }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'58%',
        plugins:{ legend:{position:'right'}, tooltip:{ callbacks:{ label:c=>` ${c.label}: ${fmtMoney(c.parsed)}` } } } }
    };
    if (pieInst) { pieInst.data = cfg.data; pieInst.options = cfg.options; pieInst.update(); }
    else pieInst = new Chart(pieCanvas.getContext('2d'), cfg);
  }

  // 分类排行（复用顶部已算好的 grouped）
  const total = sum(Object.values(grouped));
  const sorted = Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
  qs('statsRank').innerHTML = sorted.length ? sorted.map(([cat, amt], i)=>`
    <div class="rank-item">
      <div class="rank-num">${i+1}</div>
      <div class="rank-name">${catIcon(isInc?'income':'expense', cat)} ${esc(cat)}</div>
      <div class="rank-pct">${total>0 ? (amt/total*100).toFixed(0)+'%' : '0%'}</div>
      <div class="rank-amt">${fmtMoney(amt)}</div>
    </div>`).join('') : '<div class="empty-tip">暂无数据</div>';

  // 交易明细：按视图做分类透视表
  renderStatsTxnTable(txns, isInc);
}

