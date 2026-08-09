'use strict';
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
        <button class="btn ghost small" data-editrec="${r.id}">编辑</button>
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
      <div class="txn-actions">
        <button class="btn ghost small" data-editasset="${a.id}">编辑</button>
        <button class="btn danger small" data-delasset="${a.id}">删除</button>
      </div>
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
  const assetOpts = () => {
    const list = state.assets;
    const first = list.length ? list[0] : null;
    return '<option value="">无</option>' + list.map(a=>`<option value="${a.id}" ${(a.id===t.assetId) || (!t.assetId && first && a.id===first.id)?'selected':''}>${a.type==='cash'?'💵':'💳'} ${esc(a.name)} (¥${fmtMoney(a.balance)})</option>`).join('');
  };
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
