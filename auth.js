(() => {
  const accountKey = 'buro-demo-account', usersKey = 'buro-browser-users-v1', projectKey = 'buro-startapov-projects-v1', deviceKey = 'buro-trusted-device-id-v1';
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const records = () => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('buro-') && !key.startsWith('buro-community-') && ![accountKey, usersKey, projectKey, deviceKey].includes(key)).map(key => [key, read(key, null)]));
  const projectsFor = email => read(projectKey, []).filter(item => String(item.ownerEmail || '').toLowerCase() === email);
  const deviceId = () => { let value = localStorage.getItem(deviceKey); if (!value) { value = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''); localStorage.setItem(deviceKey, value); } return value; };
  const deviceLabel = () => `${navigator.platform || 'Device'} · ${navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Edg') ? 'Edge' : navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser'}`.slice(0, 80);
  const call = async body => { const response = await fetch('/api/database', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, deviceId: body.deviceId || deviceId(), deviceLabel: body.deviceLabel || deviceLabel() }) }); const data = await response.json(); if (!response.ok && response.status !== 202) throw Object.assign(new Error(data.error || 'Ошибка сервера.'), { status: response.status }); return data; };
  function cacheState(data) { if (data.account) localStorage.setItem(accountKey, JSON.stringify(data.account)); for (const [key, value] of Object.entries(data.records || {})) localStorage.setItem(key, JSON.stringify(value)); if (Array.isArray(data.projects)) { const local = read(projectKey, []).filter(p => String(p.ownerEmail || '').toLowerCase() !== data.account?.email); localStorage.setItem(projectKey, JSON.stringify([...local, ...data.projects])); } localStorage.removeItem(usersKey); }
  function showCodeStep(form, data, result, kind) {
    form.dataset.authPending = kind;
    form.querySelectorAll('input:not([name="verificationCode"]),select,fieldset').forEach(field => { if (field.type !== 'hidden') field.disabled = true; });
    let label = form.querySelector('.auth-code-label');
    if (!label) { label = document.createElement('label'); label.className = 'auth-code-label'; label.innerHTML = 'Код из письма<input name="verificationCode" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000"><small>Код действует 10 минут. Проверьте папку «Спам», если письма нет.</small>'; form.querySelector('.form-actions')?.before(label) || form.append(label); }
    const submit = form.querySelector('[type="submit"]'); if (submit) submit.innerHTML = 'Подтвердить и продолжить <span>↗</span>';
    let resend = form.querySelector('.auth-resend-code');
    if (!resend) { resend = document.createElement('button'); resend.type = 'button'; resend.className = 'clear-button auth-resend-code'; resend.textContent = 'Отправить код повторно'; form.querySelector('.form-actions')?.append(resend) || form.append(resend); }
    resend.onclick = async () => { resend.disabled = true; try { const response = await call({ action: 'resend-code', email: data.email }); result.textContent = response.message || 'Новый код отправлен.'; result.dataset.state = 'success'; } catch (error) { result.textContent = error.message; result.dataset.state = 'error'; } finally { setTimeout(() => { resend.disabled = false; }, 60000); } };
    result.textContent = data.message || `Код подтверждения отправлен на ${data.email}.`;
    result.dataset.state = 'success';
    form.elements.verificationCode?.focus();
  }
  async function finishAuth(form, result, data, next) {
    if (data.verificationRequired) { showCodeStep(form, data, result, data.purpose); return; }
    cacheState(data);
    result.textContent = 'Подтверждение выполнено. Профиль и данные загружены…'; result.dataset.state = 'success';
    setTimeout(() => { location.href = next || 'profile.html'; }, 300);
  }
  async function verifyPending(form, result) {
    const kind = form.dataset.authPending, email = form.elements.email.value.trim().toLowerCase(), action = kind === 'register' ? 'verify-email' : 'verify-login';
    const data = await call({ action, email, code: form.elements.verificationCode.value.trim() });
    await finishAuth(form, result, data, kind === 'register' ? 'profile.html' : (new URLSearchParams(location.search).get('next') === 'create.html' ? 'create.html' : 'profile.html'));
  }
  const register = document.querySelector('#register-form');
  if (location.hash === '#investor') { const option = document.querySelector('input[name=role][value=investor]'); if (option) { option.checked = true; option.dispatchEvent(new Event('change', { bubbles: true })); } }
  if (register) register.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation(); const result = document.querySelector('#register-result');
    if (register.dataset.authPending) { try { await verifyPending(register, result); } catch (error) { result.textContent = error.message; result.dataset.state = 'error'; } return; }
    if (!register.reportValidity()) return;
    const name = register.elements.fullName.value.trim(), email = register.elements.email.value.trim().toLowerCase(), password = register.elements.password.value, role = register.elements.role.value;
    if (password !== register.elements.passwordConfirm.value) { result.textContent = 'Пароли не совпадают — проверьте оба поля.'; result.dataset.state = 'error'; register.elements.passwordConfirm.focus(); return; }
    try { const data = await call({ action: 'register', name, email, password, role, investorFocus: register.elements.investorFocus?.value.trim() || '', ticketSize: register.elements.ticketSize?.value.trim() || '', records: records(), projects: projectsFor(email) }); await finishAuth(register, result, data, 'profile.html'); }
    catch (error) { result.textContent = error.message; result.dataset.state = 'error'; }
  }, true);
  const login = document.querySelector('#login-form');
  if (login) login.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation(); const result = document.querySelector('#login-result');
    if (login.dataset.authPending) { try { await verifyPending(login, result); } catch (error) { result.textContent = error.message; result.dataset.state = 'error'; } return; }
    if (!login.reportValidity()) return;
    const email = login.elements.email.value.trim().toLowerCase(), password = login.elements.password.value;
    try {
      let data;
      try { data = await call({ action: 'login', email, password }); }
      catch (error) {
        if (error.status !== 401) throw error;
        const old = read(usersKey, []).find(user => user.email === email); if (!old?.salt || !old.passwordHash) throw error;
        const enc = new TextEncoder(), salt = Uint8Array.from(old.salt.match(/.{2}/g).map(byte => parseInt(byte, 16))), key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']), bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256), hashValue = [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (hashValue !== old.passwordHash) throw error;
        data = await call({ action: 'migrate-legacy', name: old.name || email.split('@')[0], email, role: old.role || 'startup', legacySalt: old.salt, legacyHash: old.passwordHash, profile: old.profile || {}, records: records(), projects: projectsFor(email) });
      }
      await finishAuth(login, result, data, new URLSearchParams(location.search).get('next') === 'create.html' ? 'create.html' : 'profile.html');
    } catch (error) { result.textContent = error.status === 401 ? 'Неверный email или пароль.' : error.message; result.dataset.state = 'error'; }
  }, true);
})();

(() => { const roles = document.querySelectorAll('input[name=role]'), extra = document.querySelector('.investor-extra'); const update = () => { if (extra) extra.hidden = document.querySelector('input[name=role]:checked')?.value !== 'investor'; }; roles.forEach(input => input.addEventListener('change', update)); update(); })();
