/* =========================================================
   个人记账工作台 v2 — 页面路由版
   纯前端 / 本地持久化 (localStorage)
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

/* ---------- 状态 ---------- */
let state = loadState();

function loadState(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.incomeCategories = s.incomeCategories || DEFAULTS.incomeCategories.slice();
      s.expenseCategories = s.expenseCategories || DEFAULTS.expenseCategories.slice();
      s.transactions = s.transactions || [];
      s.budget = s.budget || { total: 0, categories: {} };
      s.goals = s.goals || [];
      s.recurring = s.recurring || [];
      s.assets = s.assets || [];
      s.filter = s.filter || { type:'week', single: todayStr(), start:'', end:'' };
      s.view = s.view || 'day';
      s.chartTab = s.chartTab || 'expense';
      s.search = s.search || '';
      s.calMonth = s.calMonth || todayStr().slice(0,7);
      s.page = s.page || 'home';
      s.recordPage = s.recordPage || 1;
      s.defaultFilterMigrated = s.defaultFilterMigrated || false;
      s.lastBackup = s.lastBackup || '';
      s.lastRestore = s.lastRestore || '';
      s.seenVersion = s.seenVersion || '';
      return s;
    }
  } catch(e){ console.warn('读取本地数据失败', e); }
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

function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* 整库导入：用备份对象覆盖当前数据，补齐缺省字段 */
function importData(obj){
  const base = loadState(); // 取默认骨架
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
  if (!state.assets.length) { sel.innerHTML='<option value="">暂无资产</option>'; return; }
  const cashFirst = [...state.assets].sort((a,b)=> (a.type==='cash'?-1:1) - (b.type==='cash'?-1:1));
  sel.innerHTML = cashFirst.map(a=>`<option value="${a.id}">${a.type==='cash'?'💵':'💳'} ${esc(a.name)} (¥${fmtMoney(a.balance)})</option>`).join('');
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
      const b = budgets[c]; const s = sum(monthExp.filter(t=>t.category===c).map(t=>t.amount));
      return s > b || s/b >= 0.8;
    });
    if (warnCats.length){
      budgetHtml += `<div style="font-size:12px;color:var(--warn-red);font-weight:600">⚠ ${warnCats.map(c=>{
        const b=budgets[c]; const s=sum(monthExp.filter(t=>t.category===c).map(t=>t.amount));
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
  if (homeChartInst) homeChartInst.destroy();
  homeChartInst = new Chart(qs('homeTrendChart').getContext('2d'), cfg);
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
    if (lineInst) lineInst.destroy();
    lineInst = new Chart(lineCanvas.getContext('2d'), cfg);
  } else {
    lineCanvas.hidden = true; pieCanvas.hidden = false;
    const isInc = tab === 'income';
    const txns = getRangeTxns().filter(t=> t.type === (isInc?'income':'expense'));
    const grouped = {};
    txns.forEach(t=>{ grouped[t.category] = (grouped[t.category]||0) + t.amount; });
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
    if (pieInst) pieInst.destroy();
    pieInst = new Chart(pieCanvas.getContext('2d'), cfg);
  }

  // 分类排行
  const isInc = state.chartTab === 'income';
  const txns = getRangeTxns().filter(t=> t.type === (isInc?'income':'expense'));
  const grouped = {};
  txns.forEach(t=>{ grouped[t.category] = (grouped[t.category]||0) + t.amount; });
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

function renderStatsTxnTable(txns, isInc){
  const table = qs('statsTxnTable');
  if (!table) return;
  const emptyHTML = '<thead><tr><th>日期</th><th>总计</th></tr></thead><tbody><tr><td colspan="2" class="empty">当前范围暂无交易记录</td></tr></tbody>';
  if (!txns.length){ table.innerHTML = emptyHTML; return; }

  const keyFn = state.view === 'month' ? t => t.date.slice(0,7)
              : state.view === 'year'  ? t => t.date.slice(0,4)
              : t => t.date;
  const grouped = {};
  txns.forEach(t=>{
    const k = keyFn(t);
    if (!grouped[k]) grouped[k] = {};
    grouped[k][t.category] = (grouped[k][t.category]||0) + t.amount;
  });

  const colTotals = {};
  txns.forEach(t=>{ colTotals[t.category] = (colTotals[t.category]||0) + t.amount; });
  const columns = Object.entries(colTotals).sort((a,b)=>b[1]-a[1]).map(([c])=>c);
  const rows = Object.keys(grouped).sort();
  const typeStr = isInc ? 'income' : 'expense';

  let thead = `<tr><th>日期</th>` + columns.map(c=>`<th>${catIcon(typeStr,c)} ${esc(c)}</th>`).join('') + `<th>总计</th></tr>`;
  const totalRow = { total: 0 };
  columns.forEach(c=> totalRow[c] = 0);

  const tbody = rows.map(k=>{
    const row = grouped[k];
    let rowTotal = 0;
    let tr = `<td>${esc(k)}</td>`;
    columns.forEach(c=>{
      const v = row[c] || 0;
      rowTotal += v;
      totalRow[c] += v;
      tr += `<td>${v ? fmtMoney(v) : '-'}</td>`;
    });
    totalRow.total += rowTotal;
    return `<tr>${tr}<td class="row-total">${fmtMoney(rowTotal)}</td></tr>`;
  }).join('');

  const tfoot = `<tr class="total-row"><td>合计</td>` + columns.map(c=>`<td>${fmtMoney(totalRow[c])}</td>`).join('') + `<td>${fmtMoney(totalRow.total)}</td></tr>`;
  table.innerHTML = `<thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot>`;
}

function trendData(){
  const view = state.view;
  const txns = getRangeTxns();
  if (view === 'day'){
    const {start,end} = getRange();
    let d = parseYmd(start); const e = parseYmd(end);
    const incMap = {}, expMap = {}, labels = [], keys = [];
    while (d <= e){ const k = ymd(d); keys.push(k); labels.push(k.slice(5)); incMap[k]=0; expMap[k]=0; d = addDays(d,1); }
    txns.forEach(t=>{ if (k_in(incMap,t.date)){ t.type==='income'?incMap[t.date]+=t.amount:expMap[t.date]+=t.amount; } });
    return { labels, inc: keys.map(k=>incMap[k]), exp: keys.map(k=>expMap[k]) };
  }
  const map = {};
  txns.forEach(t=>{
    const k = view==='month' ? t.date.slice(0,7) : t.date.slice(0,4);
    if (!map[k]) map[k] = {inc:0, exp:0};
    t.type==='income' ? map[k].inc+=t.amount : map[k].exp+=t.amount;
  });
  const keys = Object.keys(map).sort();
  return {
    labels: keys.map(k=> view==='month'? k.slice(2) : k),
    inc: keys.map(k=>map[k].inc),
    exp: keys.map(k=>map[k].exp),
  };
}
function k_in(obj,k){ return Object.prototype.hasOwnProperty.call(obj,k); }

/* =========================================================
   4. 预算页渲染
   ========================================================= */
function renderBudgetPage(){
  const now = new Date();
  const ms = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const monthExp = state.transactions.filter(t=> t.type==='expense' && t.date.startsWith(ms));
  const spentTotal = sum(monthExp.map(t=>t.amount));
  const budgets = state.budget.categories || {};
  const totalBudget = Number(state.budget.total) || 0;

  const cmp = qs('budgetCmp');
  if (totalBudget > 0){
    const over = spentTotal > totalBudget;
    const remain = totalBudget - spentTotal;
    cmp.innerHTML = `
      <div class="cmp-card ${over?'over':''}"><div class="cmp-label">月度预算总额</div><div class="cmp-value">${fmtMoney(totalBudget)}</div></div>
      <div class="cmp-card ${over?'over':''}"><div class="cmp-label">实际支出</div><div class="cmp-value">${fmtMoney(spentTotal)}</div></div>
      <div class="cmp-card ${over?'over':''}"><div class="cmp-label">${over?'已超支':'剩余可用'}</div><div class="cmp-value">${fmtMoney(Math.abs(remain))}</div><div class="cmp-tip">${over?'⚠ 本月已超出预算 '+fmtMoney(remain*-1):'本月预算执行良好'}</div></div>`;
  } else {
    cmp.innerHTML = `<div class="cmp-card"><div class="cmp-label">月度预算</div><div class="cmp-value">未设置</div><div class="cmp-tip">点击「设置预算」开始规划</div></div>`;
  }

  // 总预算进度条
  const totalBar = qs('budgetTotalBar');
  if (totalBudget > 0){
    const pct = (spentTotal/totalBudget*100);
    let lv = 'lv-ok', tip = '预算充足';
    if (spentTotal > totalBudget){ lv='lv-over'; tip='已超预算'; }
    else if (pct >= 95){ lv='lv-danger'; tip='预算即将用尽'; }
    else if (pct >= 80){ lv='lv-warn'; tip='即将接近预算'; }
    totalBar.innerHTML = `<div class="budget-item ${lv}">
      <div class="bi-top"><span class="bi-cat">总支出预算</span><span class="bi-pct">${pct.toFixed(0)}%</span></div>
      <div class="bi-amt">已支出 ${fmtMoney(spentTotal)} / 预算 ${fmtMoney(totalBudget)}</div>
      <div class="bar"><span style="width:${Math.min(pct,100)}%"></span></div>
      <div class="bi-remain">剩余 ${fmtMoney(totalBudget-spentTotal)}</div>
      <div class="bi-tip">${tip}</div>
    </div>`;
  } else { totalBar.innerHTML = ''; }

  // 分类预算
  const cats = Object.keys(budgets).filter(c=> budgets[c] > 0);
  const grid = qs('budgetGrid');
  if (!cats.length){
    grid.innerHTML = `<div class="empty-tip">尚未设置分类预算</div>`; return;
  }
  grid.innerHTML = cats.map(c=>{
    const budget = budgets[c];
    const spent = sum(monthExp.filter(t=>t.category===c).map(t=>t.amount));
    const pct = budget>0 ? (spent/budget*100) : 0;
    const remain = budget - spent;
    let lv = 'lv-ok', tip = '预算充足';
    if (spent > budget){ lv='lv-over'; tip='已超预算'; }
    else if (pct >= 95){ lv='lv-danger'; tip='预算即将用尽'; }
    else if (pct >= 80){ lv='lv-warn'; tip='即将接近预算'; }
    return `<div class="budget-item ${lv}">
      <div class="bi-top"><span class="bi-cat">${esc(c)}</span><span class="bi-pct">${pct.toFixed(0)}%</span></div>
      <div class="bi-amt">已支出 ${fmtMoney(spent)} / 预算 ${fmtMoney(budget)}</div>
      <div class="bar"><span style="width:${Math.min(pct,100)}%"></span></div>
      <div class="bi-remain">剩余 ${fmtMoney(remain)}</div>
      <div class="bi-tip">${tip}</div>
    </div>`;
  }).join('');
}

/* =========================================================
   5. 储蓄页渲染
   ========================================================= */
function renderGoalsPage(){
  const box = qs('goalList');
  if (!state.goals.length){ box.innerHTML = `<div class="empty-tip">暂无储蓄目标，点击「新建目标」开始攒钱 🌟</div>`; return; }
  box.innerHTML = state.goals.map(g=>{
    const saved = sum(g.records.map(r=>r.amount));
    const pct = g.target>0 ? Math.min(saved/g.target*100,100) : 0;
    const remain = g.target - saved;
    const over = saved >= g.target;
    return `<div class="goal-card">
      <div class="g-top"><span class="g-name">${esc(g.name)}</span><span class="g-deadline">截止 ${esc(g.deadline||'—')}</span></div>
      <div class="g-amt">已存 ${fmtMoney(saved)} / 目标 ${fmtMoney(g.target)}</div>
      <div class="bar"><span style="width:${pct}%;background:${over?'var(--teal)':'var(--blue)'}"></span></div>
      <div class="g-amt">${over?'🎉 已达成目标！':('还差 '+fmtMoney(remain))} · ${pct.toFixed(0)}%</div>
      <div class="g-actions">
        <button class="btn solid small" data-deposit="${g.id}">＋ 存一笔</button>
        <button class="btn ghost small" data-delgoal="${g.id}">删除</button>
      </div>
    </div>`;
  }).join('');
}

/* =========================================================
   6. 定期页渲染
   ========================================================= */
function renderRecurringPage(){
  const box = qs('recurringList');
  if (!state.recurring.length){ box.innerHTML = `<div class="empty-tip">暂无定期项目，点击「新增项目」添加房租、工资等</div>`; return; }
  box.innerHTML = state.recurring.map(r=>`
    <div class="recurring-item">
      <div class="r-left"><span class="r-name">${esc(r.name)}</span><span class="r-sub">每月 ${r.day} 日 · ${esc(r.category)}</span></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="r-amt ${r.type==='income'?'r-income':'r-expense'}">${r.type==='income'?'+':'-'}${fmtMoney(r.amount)}</span>
        <button class="btn danger small" data-delrec="${r.id}">✕</button>
      </div>
    </div>`).join('');
}

/* =========================================================
   7. 日历页渲染
   ========================================================= */
function renderCalendarPage(){
  const [y,m] = state.calMonth.split('-').map(Number);
  qs('calTitle').textContent = `${y}年${m}月`;
  const first = new Date(y, m-1, 1);
  const startDow = (first.getDay()+6)%7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const prevDays = new Date(y, m-1, 0).getDate();

  const dayMap = {};
  state.transactions.forEach(t=>{
    if (!dayMap[t.date]) dayMap[t.date] = {inc:0, exp:0};
    t.type==='income' ? dayMap[t.date].inc+=t.amount : dayMap[t.date].exp+=t.amount;
  });

  const heads = ['一','二','三','四','五','六','日'];
  let cells = heads.map(h=>`<div class="cal-cell head">${h}</div>`).join('');
  for (let i=startDow-1; i>=0; i--){
    const dd = prevDays - i;
    const pd = new Date(y, m-2, dd);
    cells += calCell(ymd(pd), dd, true, dayMap);
  }
  for (let dd=1; dd<=daysInMonth; dd++){
    cells += calCell(ymd(new Date(y, m-1, dd)), dd, false, dayMap);
  }
  const total = startDow + daysInMonth;
  let next = 1;
  while ((total + next - 1) % 7 !== 0 || (total+next-1) < 42){
    if ((total+next-1) >= 42) break;
    const nd = new Date(y, m, next);
    cells += calCell(ymd(nd), next, true, dayMap);
    next++;
  }
  qs('calendar').innerHTML = cells;
}
function calCell(dateStr, dd, other, dayMap){
  const d = dayMap[dateStr];
  const has = d && (d.inc>0 || d.exp>0);
  const exp = d&&d.exp>0 ? `<span class="d-exp">-${Math.round(d.exp)}</span>` : '';
  const inc = d&&d.inc>0 ? `<span class="d-inc">+${Math.round(d.inc)}</span>` : '';
  return `<div class="cal-cell ${other?'other':''} ${has?'has-data':''}" data-day="${dateStr}">
    <span class="d-num">${dd}</span>${exp}${inc}</div>`;
}

/* =========================================================
   8. 资产页渲染
   ========================================================= */
function renderAssetsPage(){
  const cards = qs('assetCards');
  const list = qs('assetList');
  if (!state.assets.length){
    cards.innerHTML = '';
    list.innerHTML = '<div class="empty-tip">暂无资产记录，点击「新增资产」添加</div>';
    return;
  }
  cards.innerHTML = state.assets.map(a=>`
    <div class="stat-card asset-card">
      <div class="stat-icon">${a.type==='cash'?'💵':'💳'}</div>
      <div class="stat-meta">
        <span class="a-name">${esc(a.name)}</span>
        <span class="a-balance">${fmtMoney(a.balance)}</span>
        <span class="a-type">${a.type==='cash'?'现金/电子钱包':'银行卡'}</span>
      </div>
    </div>`).join('');
  list.innerHTML = state.assets.map(a=>`
    <div class="txn-item">
      <div class="txn-cat">${a.type==='cash'?'💵':'💳'}</div>
      <div class="txn-info"><div class="t-note">${esc(a.name)}</div><div class="t-sub">${a.type==='cash'?'现金/电子钱包':'银行卡'}</div></div>
      <div class="txn-amt inc">${fmtMoney(a.balance)}</div>
      <div class="txn-actions"><button class="btn danger small" data-delasset="${a.id}">删除</button></div>
    </div>`).join('');
}

/* =========================================================
   9. 设置页渲染
   ========================================================= */
function renderSettingsPage(){
  const bi = qs('backupInfo');
  if (bi){
    const b = state.lastBackup ? `📦 上次备份：${fmtDateTime(state.lastBackup)}` : '📦 尚未备份';
    const r = state.lastRestore ? ` &nbsp;·&nbsp; 📥 上次恢复：${fmtDateTime(state.lastRestore)}` : '';
    bi.innerHTML = `<span class="${state.lastBackup?'ok':'warn'}">${b}</span>${r}`;
  }
  const ver = qs('appVersion'); if (ver) ver.textContent = 'v' + APP_VERSION;
  const renderCol = (title, arr, kind)=>`
    <div class="cat-col">
      <h4>${title}</h4>
      <div class="cat-chips">${arr.map(c=>`<span class="cat-chip">${esc(c)}<span class="x" data-rm="${esc(c)}" data-kind="${kind}">✕</span></span>`).join('')}</div>
      <div class="cat-add"><input type="text" id="add-${kind}" placeholder="新增分类名"><button class="btn ghost small" data-add="${kind}">添加</button></div>
    </div>`;
  qs('catManage').innerHTML = renderCol('收入分类', state.incomeCategories, 'income') + renderCol('支出分类', state.expenseCategories, 'expense');
}

/* =========================================================
   弹窗系统
   ========================================================= */
function openModal(title, bodyHtml){
  qs('modalTitle').textContent = title;
  qs('modalBody').innerHTML = bodyHtml;
  qs('modalMask').hidden = false;
}
function closeModal(){ qs('modalMask').hidden = true; qs('modalBody').innerHTML = ''; }

/* ---- 编辑账单弹窗 ---- */
function openEditModal(id){
  const t = state.transactions.find(x=>x.id===id); if(!t) return;
  const opts = (arr)=> arr.map(c=>`<option ${c===t.category?'selected':''}>${esc(c)}</option>`).join('');
  const assetOpts = () => state.assets.map(a=>`<option value="${a.id}" ${a.id===t.assetId?'selected':''}>${a.type==='cash'?'💵':'💳'} ${esc(a.name)} (¥${fmtMoney(a.balance)})</option>`).join('');
  const body = `
    <div class="field"><label>类型</label>
      <div class="type-toggle" id="et">
        <button type="button" class="exp ${t.type==='expense'?'active':''}" data-t="expense">支出</button>
        <button type="button" class="inc ${t.type==='income'?'active':''}" data-t="income">收入</button>
      </div></div>
    <div class="field"><label>日期</label><input type="date" id="eDate" value="${t.date}"></div>
    <div class="field"><label>金额</label><input type="number" id="eAmt" step="0.01" min="0" value="${t.amount}"></div>
    <div class="field"><label>分类</label><select id="eCat">${opts(t.type==='income'?state.incomeCategories:state.expenseCategories)}</select></div>
    <div class="field"><label>关联资产</label><select id="eAsset">${assetOpts()}</select></div>
    <div class="field"><label>备注</label><input type="text" id="eNote" value="${esc(t.note||'')}"></div>
    <div class="modal-actions">
      <button class="btn danger" id="eDelete">删除</button>
      <button class="btn solid" id="eSave">保存</button>
    </div>`;
  openModal('编辑账单', body);
  let curType = t.type;
  qs('et').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    curType=b.dataset.t;
    [...qs('et').children].forEach(x=>x.classList.toggle('active', x.dataset.t===curType));
    qs('eCat').innerHTML=(curType==='income'?state.incomeCategories:state.expenseCategories).map(c=>`<option>${esc(c)}</option>`).join('');
  });
  qs('eSave').addEventListener('click', ()=>{
    const amt=parseFloat(qs('eAmt').value); if(!(amt>0)){ alert('金额必须大于0'); return; }
    const newAssetId = qs('eAsset').value;
    // 回滚旧资产余额
    if (t.assetId) {
      const oldAsset = state.assets.find(a=>a.id===t.assetId);
      if (oldAsset) {
        if (t.type==='expense') oldAsset.balance = +(oldAsset.balance + t.amount).toFixed(2);
        if (t.type==='income') oldAsset.balance = +(oldAsset.balance - t.amount).toFixed(2);
      }
    }
    // 应用新资产余额
    if (newAssetId) {
      const newAsset = state.assets.find(a=>a.id===newAssetId);
      if (newAsset) {
        if (curType==='expense') newAsset.balance = +(newAsset.balance - amt).toFixed(2);
        if (curType==='income') newAsset.balance = +(newAsset.balance + amt).toFixed(2);
      }
    }
    Object.assign(t, { type:curType, date:qs('eDate').value||todayStr(), amount:amt, category:qs('eCat').value, note:qs('eNote').value.trim(), assetId:newAssetId });
    save(); closeModal(); renderCurrentPage(); renderAssetsPage();
  });
  qs('eDelete').addEventListener('click', ()=>{
    if(confirm('确定删除？')){
      if (t.assetId) {
        const asset = state.assets.find(a=>a.id===t.assetId);
        if (asset) {
          if (t.type==='expense') asset.balance = +(asset.balance + t.amount).toFixed(2);
          if (t.type==='income') asset.balance = +(asset.balance - t.amount).toFixed(2);
        }
      }
      state.transactions=state.transactions.filter(x=>x.id!==id); save(); closeModal(); renderCurrentPage(); renderAssetsPage();
    }
  });
}

/* ---- 预算设置弹窗 ---- */
function openBudgetModal(){
  const b = state.budget;
  let rows = state.expenseCategories.map(c=>{
    const v = b.categories && b.categories[c]!=null ? b.categories[c] : '';
    return `<div class="field" style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><label style="width:60px;margin:0;font-size:12px">${esc(c)}</label><input type="number" min="0" step="0.01" data-cat="${esc(c)}" value="${v}" placeholder="0" style="flex:1"></div>`;
  }).join('');
  const body = `
    <div class="field"><label>月度总支出预算（元）</label><input type="number" id="bTotal" min="0" step="0.01" value="${b.total||''}" placeholder="例如 5000"></div>
    <hr style="border:none;border-top:1px solid var(--line);margin:12px 0">
    <h4 style="margin-bottom:8px;font-size:14px">各分类月度预算</h4>
    <div id="bCats">${rows}</div>
    <div class="modal-actions"><button class="btn solid" id="bSave">保存预算</button></div>`;
  openModal('设置预算', body);
  qs('bSave').addEventListener('click', ()=>{
    const total = parseFloat(qs('bTotal').value)||0;
    const cats = {};
    qs('bCats').querySelectorAll('input[data-cat]').forEach(inp=>{
      const v = parseFloat(inp.value); if (v>0) cats[inp.dataset.cat] = v;
    });
    state.budget = { total, categories: cats };
    save(); closeModal(); renderCurrentPage();
  });
}

/* ---- 储蓄目标弹窗 ---- */
function openGoalModal(){
  const body = `
    <div class="field"><label>目标名称</label><input type="text" id="gName" placeholder="如：买房首付 / 旅行基金"></div>
    <div class="field"><label>目标总额（元）</label><input type="number" id="gTarget" min="0" step="0.01" placeholder="0.00"></div>
    <div class="field"><label>计划截止日期</label><input type="date" id="gDead"></div>
    <div class="modal-actions"><button class="btn solid" id="gSave">创建目标</button></div>`;
  openModal('新建储蓄目标', body);
  qs('gSave').addEventListener('click', ()=>{
    const name=qs('gName').value.trim(); const target=parseFloat(qs('gTarget').value);
    if(!name){ alert('请输入目标名称'); return; }
    if(!(target>0)){ alert('请输入大于0的目标金额'); return; }
    state.goals.push({ id:uid(), name, target, deadline:qs('gDead').value||'', records:[] });
    save(); closeModal(); renderCurrentPage();
  });
}
function openDepositModal(gid){
  const g = state.goals.find(x=>x.id===gid); if(!g) return;
  const body = `
    <div class="field"><label>存入金额（元）</label><input type="number" id="dAmt" min="0" step="0.01" placeholder="0.00"></div>
    <div class="field"><label>日期</label><input type="date" id="dDate" value="${todayStr()}"></div>
    <div class="modal-actions"><button class="btn solid" id="dSave">确认存入</button></div>`;
  openModal('为「'+g.name+'」存钱', body);
  qs('dSave').addEventListener('click', ()=>{
    const amt=parseFloat(qs('dAmt').value); if(!(amt>0)){ alert('金额必须大于0'); return; }
    g.records.push({ date: qs('dDate').value||todayStr(), amount: amt });
    save(); closeModal(); renderCurrentPage();
  });
}

/* ---- 定期收支弹窗 ---- */
function openRecurringModal(){
  const opts = (arr)=> arr.map(c=>`<option>${esc(c)}</option>`).join('');
  const assetOpts = () => {
    if (!state.assets.length) return '<option value="">暂无资产</option>';
    const cashFirst = [...state.assets].sort((a,b)=> (a.type==='cash'?-1:1) - (b.type==='cash'?-1:1));
    return cashFirst.map(a=>`<option value="${a.id}">${a.type==='cash'?'💵':'💳'} ${esc(a.name)}</option>`).join('');
  };
  const body = `
    <div class="field"><label>类型</label>
      <div class="type-toggle" id="rt">
        <button type="button" class="exp active" data-t="expense">支出</button>
        <button type="button" class="inc" data-t="income">收入</button>
      </div></div>
    <div class="field"><label>项目名称</label><input type="text" id="recName" placeholder="如：房租 / 工资"></div>
    <div class="field"><label>金额（元）</label><input type="number" id="recAmt" min="0" step="0.01" placeholder="0.00"></div>
    <div class="field"><label>分类</label><select id="recCat">${opts(state.expenseCategories)}</select></div>
    <div class="field"><label>关联资产</label><select id="recAsset">${assetOpts()}</select></div>
    <div class="field"><label>每月执行日（1-28）</label><input type="number" id="recDay" min="1" max="28" value="1"></div>
    <div class="modal-actions"><button class="btn solid" id="recSave">保存</button></div>`;
  openModal('新增定期项目', body);
  let curType='expense';
  qs('rt').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    curType=b.dataset.t;
    [...qs('rt').children].forEach(x=>x.classList.toggle('active', x.dataset.t===curType));
    qs('recCat').innerHTML=(curType==='income'?state.incomeCategories:state.expenseCategories).map(c=>`<option>${esc(c)}</option>`).join('');
  });
  qs('recSave').addEventListener('click', ()=>{
    const name=qs('recName').value.trim(); const amount=parseFloat(qs('recAmt').value);
    const day=Math.min(28, Math.max(1, parseInt(qs('recDay').value)||1));
    if(!name){ alert('请输入项目名称'); return; }
    if(!(amount>0)){ alert('金额必须大于0'); return; }
    state.recurring.push({ id:uid(), name, type:curType, amount, category:qs('recCat').value, day, assetId:qs('recAsset').value });
    save(); closeModal(); renderCurrentPage();
  });
}
function generateRecurring(){
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
  const daysInMonth=new Date(y, m+1, 0).getDate();
  const today = ymd(now);
  let added=0;
  state.recurring.forEach(r=>{
    const day=Math.min(r.day, daysInMonth);
    const date=ymd(new Date(y, m, day));
    // 只处理执行日为今天的定期项目
    if (date !== today) return;
    const exist=state.transactions.some(t=>t.recurringId===r.id && t.date===date);
    if (exist) return;
    // 关联资产余额变动
    if (r.assetId) {
      const asset = state.assets.find(a=>a.id===r.assetId);
      if (asset) {
        if (r.type==='expense') asset.balance = +(asset.balance - r.amount).toFixed(2);
        if (r.type==='income') asset.balance = +(asset.balance + r.amount).toFixed(2);
      }
    }
    state.transactions.push({ id:uid(), type:r.type, date, amount:r.amount, category:r.category, note:'定期·'+r.name, recurringId:r.id, assetId:r.assetId });
    added++;
  });
  save(); renderCurrentPage();
  if (added>0) alert(`已生成今日 ${added} 笔定期账单`);
}

/* ---- 资产弹窗 ---- */
function openAssetModal(){
  const body = `
    <div class="field"><label>名称</label><input type="text" id="aName" placeholder="如：微信零钱 / 招商银行卡"></div>
    <div class="field"><label>类型</label><select id="aType"><option value="cash">现金 / 电子钱包</option><option value="card">银行卡</option></select></div>
    <div class="field"><label>当前余额（元）</label><input type="number" id="aBal" min="0" step="0.01" placeholder="0.00"></div>
    <div class="modal-actions"><button class="btn solid" id="aSave">保存</button></div>`;
  openModal('新增资产', body);
  qs('aSave').addEventListener('click', ()=>{
    const name=qs('aName').value.trim(); const balance=parseFloat(qs('aBal').value);
    if(!name){ alert('请输入名称'); return; }
    if(!(balance>=0)){ alert('请输入余额'); return; }
    state.assets.push({ id:uid(), name, type:qs('aType').value, balance });
    save(); closeModal(); renderCurrentPage();
  });
}

/* ---- Excel导出 ---- */
function exportExcel(){
  const list=getListTxns();
  if(!list.length){ alert('当前范围没有可导出的账单'); return; }
  let html='<table border="1" cellspacing="0"><thead><tr><th>日期</th><th>类型</th><th>分类</th><th>金额</th><th>备注</th></tr></thead><tbody>';
  list.forEach(t=>{ html+=`<tr><td>${t.date}</td><td>${t.type==='income'?'收入':'支出'}</td><td>${esc(t.category)}</td><td>${(t.amount||0).toFixed(2)}</td><td>${esc(t.note||'')}</td></tr>`; });
  html+='</tbody></table>';
  const blob=new Blob(['\ufeff'+html], {type:'application/vnd.ms-excel;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`账单_${todayStr()}.xls`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   事件绑定
   ========================================================= */
function bindEvents(){
  // 全局链接跳转委托（首页面板链接等）
  qs('appMain').addEventListener('click', e=>{
    const link = e.target.closest('a.link');
    if (link && link.getAttribute('href')?.startsWith('#')) {
      e.preventDefault();
      const page = link.getAttribute('href').slice(1);
      if (page) switchPage(page, { hideAdd: true });
    }
  });

  // 左侧导航点击
  qs('sidebar').addEventListener('click', e=>{
    const item = e.target.closest('.nav-item');
    if (item) { e.preventDefault(); switchPage(item.dataset.page); }
  });

  // 底部Tab点击
  qs('bottomTab').addEventListener('click', e=>{
    const item = e.target.closest('.tab-item');
    if (!item) return;
    e.preventDefault();
    if (item.dataset.page === 'more') {
      // 打开抽屉
      qs('sidebar').classList.add('open');
      qs('drawerMask').hidden = false;
    } else {
      switchPage(item.dataset.page);
    }
  });

  // 移动端菜单按钮
  qs('menuBtn').addEventListener('click', ()=>{
    qs('sidebar').classList.toggle('open');
    qs('drawerMask').hidden = !qs('sidebar').classList.contains('open');
  });
  qs('drawerMask').addEventListener('click', ()=>{
    qs('sidebar').classList.remove('open');
    qs('drawerMask').hidden = true;
  });

  // 弹窗关闭
  qs('modalClose').addEventListener('click', closeModal);
  qs('modalMask').addEventListener('click', e=>{ if(e.target===qs('modalMask')) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

  // ===== 首页事件 =====
  qs('homeFilterSeg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    state.filter.type=b.dataset.filter;
    if (b.dataset.filter==='day') state.filter.single = todayStr();
    [...qs('homeFilterSeg').children].forEach(x=>x.classList.toggle('active', x===b));
    save(); renderHome();
  });
  qs('homeQuickAdd').addEventListener('click', ()=> switchPage('record'));

  // ===== 记账页事件 =====
  // 类型切换
  qs('recordType').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    const type=b.dataset.t;
    [...qs('recordType').children].forEach(x=>x.classList.toggle('active', x.dataset.t===type));
    qs('rCat').innerHTML=(type==='income'?state.incomeCategories:state.expenseCategories).map(c=>`<option>${esc(c)}</option>`).join('');
    updateAssetSelect(type);
  });
  // 初始化分类选项和资产选项
  qs('rCat').innerHTML=state.expenseCategories.map(c=>`<option>${esc(c)}</option>`).join('');
  updateAssetSelect('expense');
  qs('rDate').value=todayStr();
  qs('aaField').hidden = false; // 默认支出类型，显示 AA
  // AA 开关交互
  const aaField = qs('aaField');
  const aaInputs = qs('aaInputs');
  qs('recordType').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    const type=b.dataset.t;
    aaField.hidden = type !== 'expense';
    if (type !== 'expense') { qs('rAa').checked = false; aaInputs.hidden = true; }
  });
  qs('rAa').addEventListener('change', e=>{ aaInputs.hidden = !e.target.checked; });

  // 添加账单
  qs('rSave').addEventListener('click', ()=>{
    const type = qs('recordType').querySelector('.active').dataset.t;
    const amt = parseFloat(qs('rAmt').value);
    if (!(amt>0)){ alert('请输入大于0的金额'); return; }
    let amount = amt;
    let aa = null;
    if (type === 'expense' && qs('rAa').checked) {
      const total = Math.max(2, parseInt(qs('rAaTotal').value) || 2);
      const mine = Math.max(1, Math.min(total, parseInt(qs('rAaMine').value) || 1));
      amount = +(amt * mine / total).toFixed(2);
      aa = { total, mine, original: amt };
    }
    const assetId = qs('rAsset').value;
    // 更新资产余额
    if (assetId) {
      const asset = state.assets.find(a => a.id === assetId);
      if (asset) {
        if (type === 'expense') asset.balance = +(asset.balance - amount).toFixed(2);
        if (type === 'income') asset.balance = +(asset.balance + amount).toFixed(2);
      }
    }
    state.transactions.push({
      id:uid(), type, date:qs('rDate').value||todayStr(), amount,
      category:qs('rCat').value, note:qs('rNote').value.trim(), aa, assetId
    });
    qs('rAmt').value=''; qs('rNote').value=''; qs('rAa').checked=false; aaInputs.hidden=true;
    save(); renderRecord(); renderAssetsPage();
    // 刷新首页数据
    if (state.page==='home') renderHome();
  });
  // 记账页筛选
  qs('recordFilterSeg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    state.filter.type=b.dataset.filter;
    if (b.dataset.filter==='day') state.filter.single = todayStr();
    state.recordPage = 1;
    [...qs('recordFilterSeg').children].forEach(x=>x.classList.toggle('active', x===b));
    save(); renderRecord();
  });
  // 记账页时间范围
  qs('rRangeStart').addEventListener('change', e=>{
    state.filter.type = 'custom';
    state.filter.start = e.target.value;
    state.recordPage = 1;
    [...qs('recordFilterSeg').children].forEach(x=>x.classList.remove('active'));
    save(); renderRecord();
  });
  qs('rRangeEnd').addEventListener('change', e=>{
    state.filter.type = 'custom';
    state.filter.end = e.target.value;
    state.recordPage = 1;
    [...qs('recordFilterSeg').children].forEach(x=>x.classList.remove('active'));
    save(); renderRecord();
  });
  // 记账页分页
  qs('rPagePrev').addEventListener('click', ()=>{ if(state.recordPage>1){ state.recordPage--; save(); renderRecord(); } });
  qs('rPageNext').addEventListener('click', ()=>{ state.recordPage++; save(); renderRecord(); });
  // 搜索
  qs('rSearch').addEventListener('input', e=>{ state.search=e.target.value; save(); renderRecord(); });
  // 编辑/删除
  qs('recordList').addEventListener('click', e=>{
    const ed=e.target.closest('[data-edit]'); const dl=e.target.closest('[data-del]');
    if(ed) openEditModal(ed.dataset.edit);
    if(dl){ if(confirm('确定删除？')){
      const t = state.transactions.find(x=>x.id===dl.dataset.del);
      if (t && t.assetId) {
        const asset = state.assets.find(a=>a.id===t.assetId);
        if (asset) {
          if (t.type==='expense') asset.balance = +(asset.balance + t.amount).toFixed(2);
          if (t.type==='income') asset.balance = +(asset.balance - t.amount).toFixed(2);
        }
      }
      state.transactions=state.transactions.filter(t=>t.id!==dl.dataset.del);
      save(); renderRecord(); renderAssetsPage();
    } }
  });

  // ===== 统计页事件 =====
  qs('statsFilterSeg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    state.filter.type=b.dataset.filter;
    if (b.dataset.filter==='day') state.filter.single = todayStr();
    [...qs('statsFilterSeg').children].forEach(x=>x.classList.toggle('active', x===b));
    save(); renderStatsPage();
  });
  qs('statsChartTab').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    state.chartTab=b.dataset.chart;
    [...qs('statsChartTab').children].forEach(x=>x.classList.toggle('active', x===b));
    save(); renderStatsPage();
  });
  qs('viewSwitch').querySelector('.seg').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    state.view=b.dataset.view;
    [...qs('viewSwitch').querySelectorAll('.seg-btn')].forEach(x=>x.classList.toggle('active', x===b));
    save(); renderStatsPage();
  });
  qs('sRangeStart').addEventListener('change', e=>{
    state.filter.type = 'custom';
    state.filter.start = e.target.value;
    [...qs('statsFilterSeg').children].forEach(x=>x.classList.remove('active'));
    save(); renderStatsPage();
  });
  qs('sRangeEnd').addEventListener('change', e=>{
    state.filter.type = 'custom';
    state.filter.end = e.target.value;
    [...qs('statsFilterSeg').children].forEach(x=>x.classList.remove('active'));
    save(); renderStatsPage();
  });

  // ===== 预算页事件 =====
  qs('budgetSettingBtn').addEventListener('click', openBudgetModal);

  // ===== 储蓄页事件 =====
  qs('goalAddBtn').addEventListener('click', openGoalModal);
  qs('goalList').addEventListener('click', e=>{
    const dp=e.target.closest('[data-deposit]'); const dg=e.target.closest('[data-delgoal]');
    if(dp) openDepositModal(dp.dataset.deposit);
    if(dg){ if(confirm('删除该储蓄目标？')){ state.goals=state.goals.filter(g=>g.id!==dg.dataset.delgoal); save(); renderGoalsPage(); } }
  });

  // ===== 定期页事件 =====
  qs('recAddBtn').addEventListener('click', openRecurringModal);
  qs('recGenBtn').addEventListener('click', generateRecurring);
  qs('recurringList').addEventListener('click', e=>{
    const dr=e.target.closest('[data-delrec]');
    if(dr){ if(confirm('删除该定期项目？')){ state.recurring=state.recurring.filter(r=>r.id!==dr.dataset.delrec); save(); renderRecurringPage(); } }
  });

  // ===== 日历页事件 =====
  qs('calPrev').addEventListener('click', ()=>{ const [y,m]=state.calMonth.split('-').map(Number); const d=new Date(y,m-2,1); state.calMonth=ymd(d).slice(0,7); save(); renderCalendarPage(); });
  qs('calNext').addEventListener('click', ()=>{ const [y,m]=state.calMonth.split('-').map(Number); const d=new Date(y,m,1); state.calMonth=ymd(d).slice(0,7); save(); renderCalendarPage(); });
  qs('calendar').addEventListener('click', e=>{
    const c=e.target.closest('[data-day]'); if(!c) return;
    state.filter.type='day'; state.filter.single=c.dataset.day;
    save(); switchPage('record');
  });

  // ===== 资产页事件 =====
  qs('assetAddBtn').addEventListener('click', openAssetModal);
  qs('assetList').addEventListener('click', e=>{
    const da=e.target.closest('[data-delasset]');
    if(da){ if(confirm('删除该资产？')){ state.assets=state.assets.filter(a=>a.id!==da.dataset.delasset); save(); renderAssetsPage(); } }
  });

  // ===== 设置页事件 =====
  qs('exportBtn').addEventListener('click', exportExcel);
  qs('clearBtn').addEventListener('click', ()=>{
    if(confirm('⚠ 确定清除所有数据？此操作不可恢复！')){
      localStorage.removeItem(STORE_KEY);
      location.reload();
    }
  });
  qs('backupExportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `记账备份_${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    state.lastBackup = new Date().toISOString();
    save(); renderSettingsPage();
    alert('已导出整库备份 JSON 文件到本地下载目录，请妥善保存。');
  });
  qs('backupImportBtn').addEventListener('click', ()=> qs('backupFile').click());
  qs('backupFile').addEventListener('change', e=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || typeof obj !== 'object' || !Array.isArray(obj.transactions)) throw new Error('格式不正确');
        importData(obj);
        state.lastRestore = new Date().toISOString();
        save();
        alert('✅ 整库数据已恢复，正在刷新…');
        location.reload();
      } catch(err){
        alert('导入失败：文件格式不正确（' + err.message + '）');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });
  qs('catManage').addEventListener('click', e=>{
    const addBtn=e.target.closest('[data-add]');
    const rmBtn=e.target.closest('[data-rm]');
    if(addBtn){
      const kind=addBtn.dataset.add;
      const inp=qs('add-'+kind);
      const name=inp.value.trim();
      if(!name) return;
      const list=kind==='income'?state.incomeCategories:state.expenseCategories;
      if(list.includes(name)){ alert('该分类已存在'); return; }
      list.push(name); inp.value='';
      save(); renderSettingsPage();
    }
    if(rmBtn){
      const kind=rmBtn.dataset.kind, name=rmBtn.dataset.rm;
      const list=kind==='income'?state.incomeCategories:state.expenseCategories;
      const idx=list.indexOf(name);
      if(idx>=0) list.splice(idx,1);
      save(); renderSettingsPage();
    }
  });
}

/* =========================================================
   启动
   ========================================================= */
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
