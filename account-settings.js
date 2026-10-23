(() => {
  const root = document.querySelector('#account-settings');
  if (!root) return;
  const accountKey = 'buro-demo-account';
  const usersKey = 'buro-browser-users-v1';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const account = read(accountKey, null);
  if (!account) return;
  root.hidden = false;
  const profileContent=document.querySelector('#profile-content');
  const ownedProjects=read('buro-startapov-projects-v1',[]).filter(project=>String(project.ownerEmail||'').toLowerCase()===String(account.email||'').toLowerCase());
  const tabs=document.createElement('div');tabs.className='account-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Разделы аккаунта');
  tabs.innerHTML='<button type="button" role="tab" id="account-tab-settings" aria-controls="account-settings" aria-selected="true">Настройки аккаунта</button><button type="button" role="tab" id="account-tab-startups" aria-controls="my-startups-panel" aria-selected="false">Мои стартапы</button>';
  const projectsPanel=document.createElement('section');projectsPanel.className='my-startups-panel';projectsPanel.id='my-startups-panel';projectsPanel.setAttribute('role','tabpanel');projectsPanel.setAttribute('aria-labelledby','account-tab-startups');projectsPanel.hidden=true;
  projectsPanel.innerHTML='<div class="owned-startups-heading"><div><div class="section-index">[ УПРАВЛЕНИЕ ПРОЕКТАМИ ]</div><h2>Мои стартапы</h2></div><a class="button" href="create.html">Добавить стартап ↗</a></div><div class="owned-startups-list"></div>';
  const ownedList=projectsPanel.querySelector('.owned-startups-list');
  if(ownedProjects.length){ownedList.innerHTML=ownedProjects.map(project=>{const first=Array.isArray(project.media)?project.media[0]:null;const src=typeof first==='string'?first:first?.src;const video=typeof first==='object'&&first?.type==='video';const cover=src?(video?`<video src="${escape(src)}" muted autoplay loop playsinline></video>`:`<img src="${escape(src)}" alt="">`):'<span>✳</span>';return `<article class="owned-startup-card"><div class="owned-startup-cover">${cover}</div><div class="owned-startup-copy"><span>${escape(project.category||'Стартап')} · ${escape(project.stage||'Идея')}</span><h3>${escape(project.name)}</h3><p>${escape(project.description||project.problem||'')}</p><div class="owned-startup-actions"><a class="button button-outline" href="project.html?id=${encodeURIComponent(project.id)}">Открыть ↗</a><a class="clear-button" href="create.html?edit=${encodeURIComponent(project.id)}">Редактировать</a><button class="clear-button owned-delete" type="button" data-project-id="${escape(project.id)}">Удалить ×</button></div></div></article>`}).join('');}
  else ownedList.innerHTML='<div class="owned-startups-empty"><h3>Пока нет стартапов</h3><p>Создай профиль проекта — он появится здесь для управления.</p></div>';
  if(profileContent){profileContent.hidden=true;profileContent.setAttribute('aria-hidden','true');}
  root.hidden=false;root.setAttribute('role','tabpanel');root.setAttribute('aria-labelledby','account-tab-settings');
  root.parentNode.insertBefore(tabs,root);root.after(projectsPanel);
  const settingsTab=tabs.querySelector('#account-tab-settings'),startupsTab=tabs.querySelector('#account-tab-startups');
  const selectTab=(showStartups)=>{settingsTab.setAttribute('aria-selected',String(!showStartups));startupsTab.setAttribute('aria-selected',String(showStartups));root.hidden=showStartups;projectsPanel.hidden=!showStartups;};
  settingsTab.addEventListener('click',()=>selectTab(false));startupsTab.addEventListener('click',()=>selectTab(true));
  ownedList.querySelectorAll('.owned-delete').forEach(button=>button.addEventListener('click',async()=>{const target=button.dataset.projectId;if(!confirm('Удалить этот стартап? Это удалит его из профиля и каталога.'))return;const response=await fetch('/api/database',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'delete-project',projectId:target})});if(!response.ok){alert((await response.json()).error||'Не удалось удалить проект из базы.');return;}const items=read('buro-startapov-projects-v1',[]);const next=items.filter(project=>project.id!==target||String(project.ownerEmail||'').toLowerCase()!==String(account.email||'').toLowerCase());localStorage.setItem('buro-startapov-projects-v1',JSON.stringify(next));location.reload()}));
  const roleLabels = { startup: 'Стартапер', investor: 'Инвестор', mentor: 'Наставник' };
  const avatar = account.avatar ? `<img class="account-avatar-preview" src="${escape(account.avatar)}" alt="Фото профиля">` : '<span class="account-avatar-placeholder">✳</span>';
  root.innerHTML = `
    <div class="account-settings-head"><div><div class="section-index">[ ПРОФИЛЬ УЧАСТНИКА ]</div><h2 id="account-settings-title">Настройки аккаунта<span class="gradient-text">.</span></h2><p>Данные профиля и учётная запись сохраняются в базе Render.</p></div><div class="account-avatar-picker"><button class="account-avatar account-avatar-button" id="account-avatar-trigger" type="button" aria-label="Изменить фото профиля">${avatar}<span class="account-avatar-overlay" aria-hidden="true">＋</span></button><input name="avatarFile" class="account-avatar-file" form="account-profile-form" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Выберите фото профиля"><small>Нажмите на круг, чтобы изменить фото</small></div></div>
    <form id="account-profile-form" class="project-form account-form">
      <div class="form-intro"><span>ЛИЧНЫЕ ДАННЫЕ</span><span class="mono">${escape(roleLabels[account.role] || 'Участник')}</span></div>
      <div class="form-row"><label>Имя<input name="name" required maxlength="100" autocomplete="name" value="${escape(account.name || account.fullName || '')}"></label><label>Email<input name="email" required type="email" maxlength="254" autocomplete="email" value="${escape(account.email || '')}"></label></div>
      <label>Роль<select name="role"><option value="startup" ${account.role === 'startup' ? 'selected' : ''}>Стартапер</option><option value="investor" ${account.role === 'investor' ? 'selected' : ''}>Инвестор</option><option value="mentor" ${account.role === 'mentor' ? 'selected' : ''}>Наставник</option></select></label>
      <label>О себе<textarea name="bio" maxlength="600" rows="4" placeholder="Коротко расскажите о себе">${escape(account.bio || '')}</textarea></label>
      <div class="form-row"><label>Город<input name="location" maxlength="100" value="${escape(account.location || '')}" placeholder="Город"></label><label>Сайт или портфолио<input name="website" type="url" maxlength="300" value="${escape(account.website || '')}" placeholder="https://"></label></div>
      <label>Контакт для связи<input name="contact" maxlength="160" value="${escape(account.contact || '')}" placeholder="Telegram, email или телефон"></label>
      <div class="investor-extra account-investor-fields" ${account.role === 'investor' ? '' : 'hidden'}><label>Интересующие отрасли<input name="investorFocus" maxlength="160" value="${escape(account.investorFocus || '')}" placeholder="Например: климатические технологии, SaaS"></label><label>Диапазон инвестиций<input name="ticketSize" maxlength="100" value="${escape(account.ticketSize || '')}" placeholder="Например: от 500 тыс. до 5 млн ₽"></label></div>
      <div class="form-actions"><button class="button" type="submit">Сохранить профиль <span>↗</span></button><span id="account-save-result" class="register-result" role="status" aria-live="polite"></span></div>
    </form>
    <details class="account-security"><summary>Изменить пароль</summary><form id="account-password-form" class="project-form"><label>Текущий пароль<input name="oldPassword" required type="password" autocomplete="current-password"></label><div class="form-row"><label>Новый пароль<input name="newPassword" required type="password" minlength="8" autocomplete="new-password"></label><label>Повторите новый пароль<input name="confirmPassword" required type="password" minlength="8" autocomplete="new-password"></label></div><button class="clear-button" type="submit">Обновить пароль ↗</button><p id="account-password-result" class="register-result" role="status" aria-live="polite"></p></form></details>`;

  const profileForm = root.querySelector('#account-profile-form');
  const role = profileForm.elements.role;
  const investorFields = root.querySelector('.account-investor-fields');
  role.addEventListener('change', () => { investorFields.hidden = role.value !== 'investor'; });
  const avatarInput=profileForm.elements.avatarFile,avatarButton=root.querySelector('#account-avatar-trigger');
  avatarButton.addEventListener('click',()=>avatarInput.click());
  avatarInput.addEventListener('change', () => {
    const file = profileForm.elements.avatarFile.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { avatarInput.value = ''; root.querySelector('#account-save-result').textContent = 'Фото должно быть не больше 2 МБ.'; return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { avatarInput.value = ''; root.querySelector('#account-save-result').textContent = 'Выберите PNG, JPG или WebP.'; return; }
    const reader=new FileReader();reader.onload=()=>{let img=avatarButton.querySelector('img');if(!img){img=document.createElement('img');img.className='account-avatar-preview';img.alt='Фото профиля';avatarButton.prepend(img);avatarButton.querySelector('.account-avatar-placeholder')?.remove();}img.src=String(reader.result);};reader.readAsDataURL(file);
  });
  profileForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    const result = root.querySelector('#account-save-result');
    const oldEmail = String(account.email || '').trim().toLowerCase();
    const email = profileForm.elements.email.value.trim().toLowerCase();
    const users = read(usersKey, []);
    if (users.some(user => user.email !== oldEmail && user.email === email)) { result.textContent = 'Этот email уже занят другим аккаунтом.'; result.dataset.state = 'error'; return; }
    const updated = { ...account, name: profileForm.elements.name.value.trim(), email, role: role.value, bio: profileForm.elements.bio.value.trim(), location: profileForm.elements.location.value.trim(), website: profileForm.elements.website.value.trim(), contact: profileForm.elements.contact.value.trim(), investorFocus: profileForm.elements.investorFocus.value.trim(), ticketSize: profileForm.elements.ticketSize.value.trim(), updatedAt: new Date().toISOString() };
    const file = avatarInput.files?.[0];
    const persist = async avatarData => {
      if (avatarData) updated.avatar = avatarData;
      try {
        const cloud=await fetch('/api/database',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'profile',name:updated.name,email:updated.email,role:updated.role,profile:{bio:updated.bio,location:updated.location,website:updated.website,contact:updated.contact,investorFocus:updated.investorFocus,ticketSize:updated.ticketSize,avatar:updated.avatar||''}})});const cloudData=await cloud.json();if(!cloud.ok)throw Error(cloudData.error||'Не удалось сохранить профиль в базе Netlify.');Object.assign(updated,cloudData.account);
        localStorage.setItem(accountKey, JSON.stringify(updated));
        const index = users.findIndex(user => user.email === oldEmail);
        if (index >= 0) users[index] = { ...users[index], name: updated.name, email: updated.email, role: updated.role, investorFocus: updated.investorFocus, ticketSize: updated.ticketSize, bio: updated.bio, location: updated.location, website: updated.website, contact: updated.contact, avatar: updated.avatar, updatedAt: updated.updatedAt };
        localStorage.setItem(usersKey, JSON.stringify(users));
        if(oldEmail!==email){const savedKey=`buro-investor-saved-${oldEmail}`,newSavedKey=`buro-investor-saved-${email}`;const saved=read(savedKey,null);if(saved&&!read(newSavedKey,null))localStorage.setItem(newSavedKey,JSON.stringify(saved));if(saved)localStorage.removeItem(savedKey);}
        const projects = read('buro-startapov-projects-v1', []);
        let changed = false;
        for (const project of projects) if (project.ownerEmail?.toLowerCase() === oldEmail) { project.ownerEmail = email; project.ownerName = updated.name; changed = true; }
        if (changed) localStorage.setItem('buro-startapov-projects-v1', JSON.stringify(projects));
        result.textContent = 'Профиль сохранён. Данные аккаунта и связанные проекты обновлены.';
        result.dataset.state = 'success';
        setTimeout(() => location.reload(), 450);
      } catch (error) { result.textContent = error.message||'Не удалось сохранить профиль в базе данных.'; result.dataset.state = 'error'; }
    };
    if (file) { const reader = new FileReader(); reader.onload = () => persist(String(reader.result)); reader.onerror = () => { result.textContent = 'Не удалось прочитать фото.'; result.dataset.state = 'error'; }; reader.readAsDataURL(file); }
    else persist(null);
  });

  const passwordForm = root.querySelector('#account-password-form');
  passwordForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!passwordForm.reportValidity()) return;
    const result = root.querySelector('#account-password-result');
    const oldPassword = passwordForm.elements.oldPassword.value;
    const nextPassword = passwordForm.elements.newPassword.value;
    if (nextPassword !== passwordForm.elements.confirmPassword.value) { result.textContent = 'Новый пароль и подтверждение не совпадают.'; result.dataset.state = 'error'; return; }
    try {
      if (window.BuroFirebaseAuth?.changePassword) await window.BuroFirebaseAuth.changePassword(oldPassword, nextPassword);
      else {
      const response=await fetch('/api/database',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'password',oldPassword,newPassword:nextPassword})});const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось изменить пароль.');
      }
      passwordForm.reset();
      result.textContent = 'Пароль обновлён.';
      result.dataset.state = 'success';
    } catch(error) { result.textContent = error.message||'Не удалось обновить пароль.'; result.dataset.state = 'error'; }
  });
})();
