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
  const roleLabels = { startup: 'Стартапер', investor: 'Инвестор', mentor: 'Наставник' };
  const avatar = account.avatar ? `<img class="account-avatar-preview" src="${escape(account.avatar)}" alt="Фото профиля">` : '<span class="account-avatar-placeholder">✳</span>';
  root.innerHTML = `
    <div class="account-settings-head"><div><div class="section-index">[ ПРОФИЛЬ УЧАСТНИКА ]</div><h2 id="account-settings-title">Настройки аккаунта<span class="gradient-text">.</span></h2><p>Данные профиля и учётная запись сохраняются в этом браузере.</p></div><div class="account-avatar">${avatar}</div></div>
    <form id="account-profile-form" class="project-form account-form">
      <div class="form-intro"><span>ЛИЧНЫЕ ДАННЫЕ</span><span class="mono">${escape(roleLabels[account.role] || 'Участник')}</span></div>
      <div class="form-row"><label>Имя<input name="name" required maxlength="100" autocomplete="name" value="${escape(account.name || account.fullName || '')}"></label><label>Email<input name="email" required type="email" maxlength="254" autocomplete="email" value="${escape(account.email || '')}"></label></div>
      <label>Роль<select name="role"><option value="startup" ${account.role === 'startup' ? 'selected' : ''}>Стартапер</option><option value="investor" ${account.role === 'investor' ? 'selected' : ''}>Инвестор</option><option value="mentor" ${account.role === 'mentor' ? 'selected' : ''}>Наставник</option></select></label>
      <label>О себе<textarea name="bio" maxlength="600" rows="4" placeholder="Коротко расскажите о себе">${escape(account.bio || '')}</textarea></label>
      <div class="form-row"><label>Город<input name="location" maxlength="100" value="${escape(account.location || '')}" placeholder="Город"></label><label>Сайт или портфолио<input name="website" type="url" maxlength="300" value="${escape(account.website || '')}" placeholder="https://"></label></div>
      <div class="form-row"><label>Контакт для связи<input name="contact" maxlength="160" value="${escape(account.contact || '')}" placeholder="Telegram, email или телефон"></label><label>Фото профиля<input name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp"></label></div>
      <div class="investor-extra account-investor-fields" ${account.role === 'investor' ? '' : 'hidden'}><label>Интересующие отрасли<input name="investorFocus" maxlength="160" value="${escape(account.investorFocus || '')}" placeholder="Например: климатические технологии, SaaS"></label><label>Диапазон инвестиций<input name="ticketSize" maxlength="100" value="${escape(account.ticketSize || '')}" placeholder="Например: от 500 тыс. до 5 млн ₽"></label></div>
      <div class="form-actions"><button class="button" type="submit">Сохранить профиль <span>↗</span></button><span id="account-save-result" class="register-result" role="status" aria-live="polite"></span></div>
    </form>
    <details class="account-security"><summary>Изменить пароль</summary><form id="account-password-form" class="project-form"><label>Текущий пароль<input name="oldPassword" required type="password" autocomplete="current-password"></label><div class="form-row"><label>Новый пароль<input name="newPassword" required type="password" minlength="8" autocomplete="new-password"></label><label>Повторите новый пароль<input name="confirmPassword" required type="password" minlength="8" autocomplete="new-password"></label></div><button class="clear-button" type="submit">Обновить пароль ↗</button><p id="account-password-result" class="register-result" role="status" aria-live="polite"></p></form></details>`;

  const profileForm = root.querySelector('#account-profile-form');
  const role = profileForm.elements.role;
  const investorFields = root.querySelector('.account-investor-fields');
  role.addEventListener('change', () => { investorFields.hidden = role.value !== 'investor'; });
  profileForm.elements.avatarFile.addEventListener('change', () => {
    const file = profileForm.elements.avatarFile.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { profileForm.elements.avatarFile.value = ''; root.querySelector('#account-save-result').textContent = 'Фото должно быть не больше 2 МБ.'; return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { profileForm.elements.avatarFile.value = ''; root.querySelector('#account-save-result').textContent = 'Выберите PNG, JPG или WebP.'; }
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
    const file = profileForm.elements.avatarFile.files?.[0];
    const persist = avatarData => {
      if (avatarData) updated.avatar = avatarData;
      try {
        localStorage.setItem(accountKey, JSON.stringify(updated));
        const index = users.findIndex(user => user.email === oldEmail);
        if (index >= 0) users[index] = { ...users[index], name: updated.name, email: updated.email, role: updated.role, investorFocus: updated.investorFocus, ticketSize: updated.ticketSize, bio: updated.bio, location: updated.location, website: updated.website, contact: updated.contact, avatar: updated.avatar, updatedAt: updated.updatedAt };
        localStorage.setItem(usersKey, JSON.stringify(users));
        const projects = read('buro-startapov-projects-v1', []);
        let changed = false;
        for (const project of projects) if (project.ownerEmail?.toLowerCase() === oldEmail) { project.ownerEmail = email; changed = true; }
        if (changed) localStorage.setItem('buro-startapov-projects-v1', JSON.stringify(projects));
        result.textContent = 'Профиль сохранён. Данные аккаунта и связанные проекты обновлены.';
        result.dataset.state = 'success';
        setTimeout(() => location.reload(), 450);
      } catch (error) { result.textContent = error.name === 'QuotaExceededError' ? 'В хранилище браузера не хватает места. Уменьшите фото и попробуйте снова.' : 'Не удалось сохранить профиль в браузере.'; result.dataset.state = 'error'; }
    };
    if (file) { const reader = new FileReader(); reader.onload = () => persist(String(reader.result)); reader.onerror = () => { result.textContent = 'Не удалось прочитать фото.'; result.dataset.state = 'error'; }; reader.readAsDataURL(file); }
    else persist(null);
  });

  const passwordForm = root.querySelector('#account-password-form');
  passwordForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!passwordForm.reportValidity()) return;
    const result = root.querySelector('#account-password-result');
    const users = read(usersKey, []);
    const userIndex = users.findIndex(user => user.email === String(account.email || '').toLowerCase());
    if (userIndex < 0 || !users[userIndex].salt || !users[userIndex].passwordHash) { result.textContent = 'Для этой учётной записи пароль не хранится локально. Создайте аккаунт повторно через эту форму входа.'; result.dataset.state = 'error'; return; }
    const oldPassword = passwordForm.elements.oldPassword.value;
    const nextPassword = passwordForm.elements.newPassword.value;
    if (nextPassword !== passwordForm.elements.confirmPassword.value) { result.textContent = 'Новый пароль и подтверждение не совпадают.'; result.dataset.state = 'error'; return; }
    try {
      const encoder = new TextEncoder();
      const hash = async (password, salt) => { const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256); return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join(''); };
      const user = users[userIndex];
      const salt = Uint8Array.from(user.salt.match(/.{2}/g).map(byte => parseInt(byte, 16)));
      if (await hash(oldPassword, salt) !== user.passwordHash) { result.textContent = 'Текущий пароль введён неверно.'; result.dataset.state = 'error'; return; }
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      user.salt = [...newSalt].map(byte => byte.toString(16).padStart(2, '0')).join('');
      user.passwordHash = await hash(nextPassword, newSalt);
      localStorage.setItem(usersKey, JSON.stringify(users));
      passwordForm.reset();
      result.textContent = 'Пароль обновлён.';
      result.dataset.state = 'success';
    } catch { result.textContent = 'Не удалось обновить пароль. Повторите попытку.'; result.dataset.state = 'error'; }
  });
})();
