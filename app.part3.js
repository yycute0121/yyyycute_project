'use strict';
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

/* ---- 定期收支弹窗（支持新增/编辑） ---- */
function openRecurringModal(id){
  const isEdit = typeof id === 'string' && !!id;
  const r = isEdit ? state.recurring.find(x=>x.id===id) : null;
  if (isEdit && !r) return;
  const opts = (arr)=> arr.map(c=>`<option ${c===r?.category?'selected':''}>${esc(c)}</option>`).join('');
  const assetOpts = () => {
    const cashFirst = [...state.assets].sort((a,b)=> (a.type==='cash'?-1:1) - (b.type==='cash'?-1:1));
    return '<option value="">无</option>' + cashFirst.map(a=>`<option value="${a.id}" ${a.id===r?.assetId?'selected':''}>${a.type==='cash'?'💵':'💳'} ${esc(a.name)}</option>`).join('');
  };
  const body = `
    <div class="field"><label>类型</label>
      <div class="type-toggle" id="rt">
        <button type="button" class="exp ${r?.type==='expense'?'active':''}" data-t="expense">支出</button>
        <button type="button" class="inc ${r?.type==='income'?'active':''}" data-t="income">收入</button>
      </div></div>
    <div class="field"><label>项目名称</label><input type="text" id="recName" placeholder="如：房租 / 工资" value="${esc(r?r.name:'')}"></div>
    <div class="field"><label>金额（元）</label><input type="number" id="recAmt" min="0" step="0.01" placeholder="0.00" value="${r?r.amount:''}"></div>
    <div class="field"><label>分类</label><select id="recCat">${opts(r?.type==='income'?state.incomeCategories:state.expenseCategories)}</select></div>
    <div class="field"><label>关联资产</label><select id="recAsset">${assetOpts()}</select></div>
    <div class="field"><label>每月执行日（1-28）</label><input type="number" id="recDay" min="1" max="28" value="${r?r.day:1}"></div>
    <div class="modal-actions"><button class="btn solid" id="recSave">${isEdit?'保存修改':'保存'}</button></div>`;
  openModal(isEdit?'编辑定期项目':'新增定期项目', body);
  let curType = r ? r.type : 'expense';
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
    const data = { name, type:curType, amount, category:qs('recCat').value, day, assetId:qs('recAsset').value };
    if (isEdit) Object.assign(r, data);
    else state.recurring.push(Object.assign({ id:uid() }, data));
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
    if (date !== today) return;
    const exist=state.transactions.some(t=>t.recurringId===r.id && t.date===date);
    if (exist) return;
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

/* ---- 资产弹窗（支持新增/编辑） ---- */
function openAssetModal(id){
  const isEdit = typeof id === 'string' && !!id;
  const a = isEdit ? state.assets.find(x=>x.id===id) : null;
  if (isEdit && !a) return;
  const body = `
    <div class="field"><label>名称</label><input type="text" id="aName" placeholder="如：微信零钱 / 招商银行卡" value="${esc(a?a.name:'')}"></div>
    <div class="field"><label>类型</label><select id="aType"><option value="cash" ${a&&a.type==='cash'?'selected':''}>现金 / 电子钱包</option><option value="card" ${a&&a.type==='card'?'selected':''}>银行卡</option></select></div>
    <div class="field"><label>当前余额（元）</label><input type="number" id="aBal" min="0" step="0.01" placeholder="0.00" value="${a!=null?a.balance:''}"></div>
    <div class="modal-actions"><button class="btn solid" id="aSave">${isEdit?'保存修改':'保存'}</button></div>`;
  openModal(isEdit?'编辑资产':'新增资产', body);
  qs('aSave').addEventListener('click', ()=>{
    const name=qs('aName').value.trim(); const balance=parseFloat(qs('aBal').value);
    if(!name){ alert('请输入名称'); return; }
    if(!(balance>=0)){ alert('请输入余额'); return; }
    if (isEdit){ a.name=name; a.type=qs('aType').value; a.balance=balance; }
    else state.assets.push({ id:uid(), name, type:qs('aType').value, balance });
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
  qs('recAddBtn').addEventListener('click', ()=> openRecurringModal());
  qs('recGenBtn').addEventListener('click', generateRecurring);
  qs('recurringList').addEventListener('click', e=>{
    const er=e.target.closest('[data-editrec]'); const dr=e.target.closest('[data-delrec]');
    if(er) openRecurringModal(er.dataset.editrec);
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
  qs('assetAddBtn').addEventListener('click', ()=> openAssetModal());
  qs('assetList').addEventListener('click', e=>{
    const ea=e.target.closest('[data-editasset]'); const da=e.target.closest('[data-delasset]');
    if(ea) openAssetModal(ea.dataset.editasset);
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
