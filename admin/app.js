(() => {
  const $ = selector => document.querySelector(selector);
  const loginScreen = $('#login-screen'), dashboard = $('#dashboard'), loginForm = $('#login-form');
  const tableSelect = $('#table-select'), tableSearch = $('#table-search'), dialog = $('#edit-dialog');
  const fromInput=$('#analytics-from'),toInput=$('#analytics-to'),groupInput=$('#analytics-group');
  let currentTable = '', tableData = null, editContext = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  async function api(path, options = {}) {
    const response = await fetch(path, { credentials:'same-origin', ...options, headers:{ ...(options.body ? { 'content-type':'application/json' } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  function showApp(yes) { loginScreen.hidden = yes; dashboard.hidden = !yes; $('#logout').hidden = !yes; $('#connection').textContent = yes ? 'БАЗА ПОДКЛЮЧЕНА' : 'ЗАКРЫТАЯ ПАНЕЛЬ'; }
  function keyFor(row) {
    if (currentTable === 'app_votes') return { project_id:row.project_id, voter_key:row.voter_key };
    if (currentTable === 'app_records') return { owner_email:row.owner_email, record_key:row.record_key };
    const keys = { app_accounts:'email', app_projects:'id', app_sessions:'token_hash', app_analytics:'id' };
    return { [keys[currentTable]]:row[keys[currentTable]] };
  }
  function cell(value) {
    const raw = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return `<td><div class="json-cell" title="${esc(raw)}">${esc(raw)}</div></td>`;
  }
  function renderTable() {
    if (!tableData) return;
    const q = tableSearch.value.trim().toLocaleLowerCase('ru');
    const rows = tableData.rows.filter(row => !q || JSON.stringify(row).toLocaleLowerCase('ru').includes(q));
    $('#table-head').innerHTML = `<tr>${tableData.columns.map(c=>`<th>${esc(c)}</th>`).join('')}<th>УПРАВЛЕНИЕ</th></tr>`;
    $('#table-body').innerHTML = rows.map(row => `<tr>${tableData.columns.map(column=>cell(row[column]))}<td class="actions-cell"><button class="quiet" data-edit="${esc(JSON.stringify(keyFor(row)))}" ${tableData.editable.length?'':'disabled'}>Изменить</button><button class="quiet" data-delete="${esc(JSON.stringify(keyFor(row)))}" ${currentTable==='schema_migrations'?'disabled':''}>Удалить</button></td></tr>`).join('') || `<tr><td colspan="${tableData.columns.length+1}">Записей нет</td></tr>`;
    $('#table-meta').textContent = `${currentTable} · показано ${rows.length} из ${tableData.total} (лимит списка 500)`;
    $('#table-body').querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>openEdit(JSON.parse(button.dataset.edit), rows.find(row=>JSON.stringify(keyFor(row))===JSON.stringify(JSON.parse(button.dataset.edit))))));
    $('#table-body').querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',()=>deleteRow(JSON.parse(button.dataset.delete))));
  }
  async function loadTable() {
    currentTable = tableSelect.value; if (!currentTable) return;
    $('#table-meta').textContent = 'Загрузка…';
    tableData = await api(`/api/admin/table/${encodeURIComponent(currentTable)}?limit=500`); renderTable();
  }
  function openEdit(key, row) {
    const editable = Object.fromEntries(tableData.editable.map(column=>[column,row[column]]));
    editContext = { table:currentTable,key };
    $('#edit-title').textContent = `${currentTable} · ${Object.values(key).join(' / ')}`;
    $('#edit-json').value = JSON.stringify(editable,null,2); $('#edit-error').textContent = ''; dialog.showModal();
  }
  $('#save-row').addEventListener('click', async () => {
    try { const values = JSON.parse($('#edit-json').value); await api('/api/admin/update',{method:'POST',body:JSON.stringify({ table:editContext.table,key:editContext.key,values })}); dialog.close(); await loadTable(); await loadMetrics(); }
    catch(error) { $('#edit-error').textContent = error.message; }
  });
  async function deleteRow(key) {
    if (!confirm(`Удалить запись из ${currentTable}? Связанные записи могут быть удалены каскадно.`)) return;
    try { await api('/api/admin/delete',{method:'POST',body:JSON.stringify({table:currentTable,key})}); await loadTable(); await loadMetrics(); }
    catch(error) { alert(error.message); }
  }
  async function loadMetrics() {
    const params=new URLSearchParams({from:fromInput.value,to:toInput.value,group:groupInput.value});
    const data = await api(`/api/admin/metrics?${params}`), labels = [['accounts','АККАУНТЫ'],['projects','ПРОЕКТЫ'],['votes','ГОЛОСА'],['records','ЗАПИСИ'],['events','СОБЫТИЯ']];
    $('#metrics').innerHTML = labels.map(([key,label])=>`<article class="metric"><span class="metric-label">${label}</span><strong>${Number(data.counts[key]||0).toLocaleString('ru-RU')}</strong><span class="metric-label">ВСЕГО В БАЗЕ</span></article>`).join('');
    const audience=data.audience||{},range=data.range||{from:fromInput.value,to:toInput.value};
    $('#analytics-range-label').textContent=`${range.from} — ${range.to}`;
    $('#audience-summary').innerHTML=`<article><span>УНИКАЛЬНЫЕ ПОСЕТИТЕЛИ</span><strong>${Number(audience.visitors||0).toLocaleString('ru-RU')}</strong></article><article><span>ПРОСМОТРЫ СТРАНИЦ</span><strong>${Number(audience.views||0).toLocaleString('ru-RU')}</strong></article>`;
    const daily = data.daily || [], peak = Math.max(1,...daily.flatMap(day=>[day.views,day.visitors,day.signups,day.votes,day.ai_evaluations].map(Number)));
    $('#daily-chart').innerHTML = daily.map(d=>{const values=[d.views,d.visitors,d.signups,d.votes,d.ai_evaluations];return `<div class="bar-day" title="${d.day} · просмотры ${values[0]}, уникальные браузеры ${values[1]}, регистрации ${values[2]}, голоса ${values[3]}, ИИ ${values[4]}">${values.map(value=>`<i style="height:${Math.max(value?2:0,Number(value)/peak*100)}%"></i>`).join('')}</div>`;}).join('')||'<span class="hint">Нет событий за выбранный период.</span>';
    $('#popular').innerHTML = (data.popular||[]).map(row=>`<div class="popular-row"><span>${esc(row.project_id)}</span><small>${Number(row.views)} ПРОСМ.</small></div>`).join('') || '<p class="hint">Пока нет просмотров страниц стартапов.</p>';
  }
  async function wake(target) {
    const output=$('#wake-status');output.textContent='Подключаемся к сервисам…';output.dataset.state='loading';
    try {
      const result=await api('/api/admin/wake',{method:'POST',body:JSON.stringify({target})});
      const labels={api:'API сайта',database:'База данных',ai:'ИИ'};
      output.innerHTML=Object.entries(result.services||{}).map(([key,status])=>`<span class="wake-result ${status.ok?'is-ok':'is-error'}"><b>${esc(labels[key]||key)}:</b> ${esc(status.message|| (status.ok?'работает':'ошибка'))}</span>`).join(' ');
      output.dataset.state=Object.values(result.services||{}).every(status=>status.ok)?'success':'error';
    } catch(error){output.textContent=error.message;output.dataset.state='error';}
  }
  async function boot() {
    try { const state = await api('/api/admin/session'); if (state.authenticated) { showApp(true); const {tables}=await api('/api/admin/tables'); tableSelect.innerHTML=tables.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join(''); await Promise.all([loadMetrics(),loadTable()]); } else showApp(false); }
    catch { showApp(false); }
  }
  loginForm.addEventListener('submit',async event=>{event.preventDefault();const button=loginForm.querySelector('button');button.disabled=true;$('#login-error').textContent='';try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({token:$('#token').value})});$('#token').value='';await boot();}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}});
  $('#logout').addEventListener('click',async()=>{await api('/api/admin/logout',{method:'POST'}).catch(()=>{});showApp(false);});
  const today=new Date(),monthAgo=new Date(today);monthAgo.setDate(today.getDate()-29);const dateValue=date=>date.toISOString().slice(0,10);toInput.value=dateValue(today);fromInput.value=dateValue(monthAgo);$('#analytics-apply').addEventListener('click',()=>loadMetrics().catch(error=>alert(error.message)));
  tableSelect.addEventListener('change',loadTable); tableSearch.addEventListener('input',renderTable);
  document.querySelectorAll('.refresh').forEach(button=>button.addEventListener('click',()=>button.dataset.refresh==='metrics'?loadMetrics():loadTable()));
  $('#wake-all').addEventListener('click',()=>wake('all'));
  document.querySelectorAll('[data-wake]').forEach(button=>button.addEventListener('click',()=>wake(button.dataset.wake)));
  boot();
})();
