(() => {
  const $ = selector => document.querySelector(selector);
  const library = $('#project-library-list');
  const form = $('#project-form');
  if (!library || !form) return;
  const historyKey = 'buro-project-history-v1';
  const projectKey = 'buro-startapov-projects-v1';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const account = read('buro-demo-account', null);
  const sessionUser = account;
  let projects = [];
  let busy = false;
  const tabs = [...document.querySelectorAll('[data-workspace-tab]')];
  const panels = { library: $('#project-library-panel'), history: $('#project-history-panel'), create: $('#project-create-panel') };
  const selectTab = name => {
    tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.workspaceTab === name)));
    Object.entries(panels).forEach(([key, panel]) => { panel.hidden = key !== name; });
    if (name === 'history') renderHistory();
    if (name === 'library') renderLibrary();
  };
  tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab.dataset.workspaceTab)));
  const historyLabel = { created: 'Создан проект', updated: 'Изменён проект', deleted: 'Удалён проект', opened: 'Открыта страница' };
  function log(action, project) {
    const rows = read(historyKey, []);
    rows.unshift({ action, id: project.id, name: project.name || 'Без названия', at: new Date().toISOString() });
    localStorage.setItem(historyKey, JSON.stringify(rows.slice(0, 80)));
  }
  function renderHistory() {
    const host = $('#project-history-list'); if (!host) return;
    const rows = read(historyKey, []);
    host.innerHTML = rows.length ? rows.map(row => `<article class="project-history-item"><span class="history-date">${escape(new Date(row.at).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'}))}</span><div><b>${escape(historyLabel[row.action] || 'Действие')}</b><span>${escape(row.name)}</span></div><a href="project.html?id=${encodeURIComponent(row.id)}">Открыть ↗</a></article>`).join('') : '<div class="library-empty">История появится здесь после просмотра, создания или изменения проектов.</div>';
  }
  function renderLibrary() {
    const search = ($('#library-search')?.value || '').trim().toLocaleLowerCase('ru');
    const category = $('#library-category')?.value || '';
    const filtered = projects.filter(project => {
      const text = [project.name, project.short, project.description, project.problem, project.category, project.stage, project.ownerName, project.teamName].join(' ').toLocaleLowerCase('ru');
      return (!search || text.includes(search)) && (!category || project.category === category);
    });
    $('#library-count').textContent = `${filtered.length} из ${projects.length} проектов`;
    library.innerHTML = filtered.length ? filtered.map(project => {
      const owned = Boolean(sessionUser?.role === 'startup' && sessionUser.email && String(project.ownerEmail || '').toLowerCase() === String(sessionUser.email).toLowerCase());
      const summary = project.description || project.value || project.problem || 'Команда ещё не добавила описание.';
      const id = encodeURIComponent(project.id);
      return `<article class="library-project-card"><div class="library-project-index">${escape(project.category || 'СТАРТАП')}<span>${escape(project.stage || 'Идея')}</span></div><h3>${escape(project.name || 'Без названия')}</h3><p>${escape(summary)}</p><div class="library-project-meta"><span>${escape(project.ownerName || project.teamName || 'Команда проекта')}</span><span>${Number(project.progress || 0)}% готовности</span></div><div class="library-project-actions"><a class="library-open" data-project-open="${escape(project.id)}" href="project.html?id=${id}">Открыть ↗</a>${owned ? `<a class="library-edit" href="create.html?edit=${id}">Редактировать</a><button class="library-delete" type="button" data-project-delete="${escape(project.id)}">Удалить</button>` : ''}</div></article>`;
    }).join('') : '<div class="library-empty">По этому запросу стартапы не найдены.</div>';
    library.querySelectorAll('.library-project-card').forEach(card => window.BuroMotion?.observe(card));
    library.querySelectorAll('[data-project-open]').forEach(link => link.addEventListener('click', () => {
      const project = projects.find(item => String(item.id) === link.dataset.projectOpen); if (project) log('opened', project);
    }));
    library.querySelectorAll('[data-project-delete]').forEach(button => button.addEventListener('click', () => removeProject(button.dataset.projectDelete)));
  }
  async function removeProject(id) {
    const project = projects.find(item => String(item.id) === String(id));
    if (!project || !confirm(`Удалить «${project.name}» из общей библиотеки?`)) return;
    const button = library.querySelector(`[data-project-delete="${CSS.escape(String(id))}"]`); if (button) button.disabled = true;
    try {
      const response = await fetch('/api/database', { method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'delete-project',projectId:id}) });
      const result = await response.json(); if (!response.ok) throw Error(result.error || 'Не удалось удалить проект.');
      projects = projects.filter(item => String(item.id) !== String(id));
      localStorage.setItem(projectKey, JSON.stringify(read(projectKey, []).filter(item => String(item.id) !== String(id))));
      log('deleted', project); renderLibrary(); renderHistory();
    } catch (error) { alert(error.message); if (button) button.disabled = false; }
  }
  async function loadProjects() {
    try {
      const response = await fetch('/api/database?action=projects', { credentials:'same-origin' });
      if (!response.ok) throw Error('Каталог временно недоступен.');
      const data = await response.json();
      const all = [...(data.projects || []), ...read(projectKey, [])];
      projects = [...new Map(all.filter(item => item?.id).map(item => [String(item.id), item])).values()];
      const select = $('#library-category');
      [...new Set(projects.map(item => item.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')).forEach(value => select.add(new Option(value, value)));
      renderLibrary();
    } catch { library.innerHTML = '<div class="library-empty">Не удалось загрузить общие проекты. Обновите страницу чуть позже.</div>'; $('#library-count').textContent = 'Каталог недоступен'; }
  }
  $('#library-search')?.addEventListener('input', renderLibrary);
  $('#library-category')?.addEventListener('change', renderLibrary);
  $('#clear-project-history')?.addEventListener('click', () => { localStorage.removeItem(historyKey); renderHistory(); });

  const editId = new URLSearchParams(location.search).get('edit');
  if (editId) {
    selectTab('create');
    (async () => {
      try {
        let project = read(projectKey, []).find(item => String(item.id) === editId);
        const response = await fetch(`/api/database?action=project&id=${encodeURIComponent(editId)}`, { credentials:'same-origin' });
        if (response.ok) project = (await response.json()).project || project;
        if (!project) throw Error('Проект не найден.');
        if (!sessionUser?.email || String(project.ownerEmail || '').toLowerCase() !== String(sessionUser.email).toLowerCase()) throw Error('Редактировать можно только свой стартап.');
        window.BuroProjectEdit = { project };
        for (const [name, value] of Object.entries(project)) {
          const field = form.elements.namedItem(name);
          if (field && typeof value === 'string' && field.type !== 'file') field.value = value;
        }
        form.dispatchEvent(new Event('input', { bubbles:true }));
        const submit = form.querySelector('[type="submit"]'); if (submit) submit.innerHTML = 'Сохранить изменения <span>↗</span>';
        $('#save-status').textContent = `Редактирование: ${project.name}`;
        $('#draft-tag').textContent = 'РЕДАКТИРОВАНИЕ';
      } catch (error) { $('#save-status').textContent = error.message; selectTab('library'); }
    })();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!form.reportValidity() || busy) return;
    if (!sessionUser?.email || sessionUser.role !== 'startup') { $('#save-status').textContent = 'Войдите под аккаунтом стартапера, чтобы создавать проекты.'; return; }
    const existing = window.BuroProjectEdit?.project || null;
    const fields = Object.fromEntries([...new FormData(form).entries()].filter(([,value]) => typeof value === 'string'));
    const id = existing?.id || `user-${(fields.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'') || Date.now())}`;
    const now = new Date().toISOString();
    const progressFields = ['name','category','stage','problem','audience','value'];
    const project = { ...(existing || {}), ...fields, id, progress:Math.round(progressFields.filter(key=>String(fields[key]||'').trim()).length/progressFields.length*100), art:existing?.art||'art-leaf', ownerEmail:sessionUser.email, ownerName:sessionUser.name||sessionUser.fullName||existing?.ownerName||'Команда проекта', createdAt:existing?.createdAt||now, updatedAt:now, media:existing?.media||[] };
    const submit = form.querySelector('[type="submit"]'); busy = true; if (submit) submit.disabled = true; $('#save-status').textContent = 'Сохраняю проект в общей библиотеке…';
    try {
      const response = await fetch('/api/database', { method:'POST', credentials:'same-origin', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'project',project}) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'Не удалось сохранить проект.');
      const saved = data.project || project; const local = read(projectKey, []); const index = local.findIndex(item => String(item.id) === String(saved.id));
      if (index >= 0) local[index] = saved; else local.push(saved);
      localStorage.setItem(projectKey, JSON.stringify(local)); localStorage.setItem('buro-startapov-project-v1', JSON.stringify(saved));
      log(existing ? 'updated' : 'created', saved); window.BuroProjectEdit = null;
      $('#save-status').textContent = 'Сохранено в общей библиотеке'; $('#draft-tag').textContent = 'СОХРАНЁН';
      if (existing) { projects = [...new Map([...projects, saved].map(item=>[String(item.id),item])).values()]; renderLibrary(); renderHistory(); history.replaceState({}, '', 'create.html'); selectTab('library'); }
      else { $('#save-status').textContent = 'Проект создан. Открываю страницу…'; setTimeout(()=>location.href=`project.html?id=${encodeURIComponent(saved.id)}`,350); }
    } catch (error) { $('#save-status').textContent = error.message; }
    finally { busy = false; if (submit) submit.disabled = false; }
  }, true);
  loadProjects();
})();



