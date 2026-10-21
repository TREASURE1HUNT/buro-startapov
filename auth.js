(() => {
  const usersKey = 'buro-browser-users-v1';
  const currentKey = 'buro-demo-account';
  const encoder = new TextEncoder();
  const bytesToHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  async function hashPassword(password, salt) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
    return bytesToHex(new Uint8Array(bits));
  }
  function readUsers() {
    try { const value = JSON.parse(localStorage.getItem(usersKey) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function show(result, message, error = false) {
    result.textContent = message;
    result.dataset.state = error ? 'error' : 'success';
  }
  const register = document.querySelector('#register-form');
  if (register) register.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!register.reportValidity()) return;
    const result = document.querySelector('#register-result');
    const name = register.elements.fullName.value.trim();
    const email = register.elements.email.value.trim().toLowerCase();
    const password = register.elements.password.value;
    const role = register.elements.role.value;
    try {
      const users = readUsers();
      if (users.some(user => user.email === email)) { show(result, 'Этот email уже зарегистрирован в этом браузере. Войдите в аккаунт.', true); return; }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      users.push({ name, email, role, salt: bytesToHex(salt), passwordHash: await hashPassword(password, salt), createdAt: new Date().toISOString() });
      localStorage.setItem(usersKey, JSON.stringify(users));
      localStorage.setItem(currentKey, JSON.stringify({ name, email, role, createdAt: new Date().toISOString() }));
      show(result, 'Аккаунт создан. Открываю ваш профиль…');
      setTimeout(() => { location.href = 'profile.html'; }, 450);
    } catch (error) {
      show(result, error.name === 'QuotaExceededError' ? 'В хранилище браузера нет места. Удалите старые данные и повторите.' : 'Не удалось сохранить аккаунт. Проверьте, включено ли хранилище браузера.', true);
    }
  }, true);
  const login = document.querySelector('#login-form');
  if (login) login.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!login.reportValidity()) return;
    const result = document.querySelector('#login-result');
    const email = login.elements.email.value.trim().toLowerCase();
    const password = login.elements.password.value;
    try {
      const user = readUsers().find(item => item.email === email);
      if (!user) { show(result, 'Аккаунт для этого email не найден в данном браузере. Создайте его на странице регистрации.', true); return; }
      const salt = Uint8Array.from(user.salt.match(/.{2}/g).map(byte => parseInt(byte, 16)));
      if (await hashPassword(password, salt) !== user.passwordHash) { show(result, 'Неверный email или пароль.', true); return; }
      localStorage.setItem(currentKey, JSON.stringify({ name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }));
      show(result, 'Вы вошли. Открываю профиль…');
      setTimeout(() => { const next = new URLSearchParams(location.search).get('next'); location.href = next === 'create.html' ? 'create.html' : 'profile.html'; }, 350);
    } catch {
      show(result, 'Не удалось выполнить вход. Проверьте, включено ли хранилище браузера.', true);
    }
  }, true);
})();
