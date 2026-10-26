import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword, signOut, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink, EmailAuthProvider,
  reauthenticateWithCredential, updatePassword,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDVhtACl-0GnDDsiFfsozxNlaOm6shpsu4',
  authDomain: 'buro-startapov.firebaseapp.com',
  projectId: 'buro-startapov',
  storageBucket: 'buro-startapov.firebasestorage.app',
  messagingSenderId: '920539025266',
  appId: '1:920539025266:web:13e80526abdf63e2c697eb',
  measurementId: 'G-TGCZ8C5PRJ',
};
const auth = getAuth(initializeApp(firebaseConfig));
auth.languageCode = 'ru';
const accountKey = 'buro-demo-account', usersKey = 'buro-browser-users-v1', projectKey = 'buro-startapov-projects-v1', deviceKey = 'buro-trusted-device-id-v1';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
const deviceId = () => { let value = localStorage.getItem(deviceKey); if (!value) { value = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''); localStorage.setItem(deviceKey, value); } return value; };
const deviceLabel = () => `${navigator.platform || 'Device'} · ${navigator.userAgent.includes('Firefox') ? 'Firefox' : navigator.userAgent.includes('Edg') ? 'Edge' : navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser'}`.slice(0, 80);
const call = async body => {
  const response = await fetch('/api/database', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, deviceId: body.deviceId || deviceId(), deviceLabel: body.deviceLabel || deviceLabel() }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) throw Object.assign(new Error(data.error || 'Ошибка сервера.'), { status: response.status });
  return data;
};
function cacheState(data) {
  if (data.account) localStorage.setItem(accountKey, JSON.stringify(data.account));
  for (const [key, value] of Object.entries(data.records || {})) localStorage.setItem(key, JSON.stringify(value));
  if (Array.isArray(data.projects)) {
    const email = String(data.account?.email || '').toLowerCase();
    const local = read(projectKey, []).filter(project => String(project.ownerEmail || '').toLowerCase() !== email);
    localStorage.setItem(projectKey, JSON.stringify([...local, ...data.projects]));
  }
  localStorage.removeItem(usersKey);
}
const redirectAfterLogin = () => new URLSearchParams(location.search).get('next') === 'create.html' ? 'create.html' : 'profile.html';
const show = (node, message, state = 'success') => { if (!node) return; node.textContent = message; node.dataset.state = state; };
function errorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'Аккаунт с такой почтой уже существует. Войдите или восстановите доступ.',
    'auth/invalid-credential': 'Неверный email или пароль.',
    'auth/invalid-email': 'Проверьте адрес электронной почты.',
    'auth/weak-password': 'Пароль должен содержать не менее 6 символов.',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже.',
    'auth/network-request-failed': 'Не удалось подключиться к Firebase. Проверьте интернет и повторите.',
    'auth/operation-not-allowed': 'В Firebase не включён нужный способ входа.',
    'auth/unauthorized-continue-uri': 'В Firebase добавьте домен сайта в Authentication → Settings → Authorized domains.',
  };
  return messages[error.code] || error.message || 'Не удалось выполнить вход.';
}
async function fallbackLegacyLogin(email, password) {
  const legacy = await call({ action: 'login', email, password });
  if (legacy.verificationRequired) return { legacy };
  cacheState(legacy);
  return { legacy, done: true };
}
function legacyCodeStep(form, result, data) {
  form.dataset.legacyPending = data.purpose || 'login';
  form.querySelectorAll('input:not([name="verificationCode"])').forEach(input => { input.disabled = true; });
  let label = form.querySelector('.auth-code-label');
  if (!label) {
    label = document.createElement('label'); label.className = 'auth-code-label';
    label.innerHTML = 'Код из письма<input name="verificationCode" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000"><small>Код действует 10 минут. Проверьте папку «Спам», если письма нет.</small>';
    form.querySelector('.form-actions')?.before(label) || form.append(label);
  }
  const submit = form.querySelector('[type="submit"]'); if (submit) submit.textContent = 'Подтвердить и продолжить ↗';
  show(result, data.message || `Код подтверждения отправлен на ${data.email}.`);
}
async function finishDeviceLink() {
  const stored = read('buro-firebase-device-link', null);
  const email = stored?.email || new URL(location.href).searchParams.get('email');
  const confirmedDeviceId = stored?.deviceId || new URL(location.href).searchParams.get('did') || deviceId();
  const result = document.querySelector('#login-result');
  if (!email) throw new Error('Для завершения входа откройте ссылку на том же устройстве и в том же браузере, где запросили её.');
  const credential = await signInWithEmailLink(auth, email, location.href);
  localStorage.setItem(deviceKey, confirmedDeviceId);
  const data = await call({ action: 'firebase-device-finish', idToken: await credential.user.getIdToken(true), email: credential.user.email, deviceId: confirmedDeviceId });
  cacheState(data); localStorage.removeItem('buro-firebase-device-link');
  show(result, 'Вход подтверждён. Открываю профиль…');
  setTimeout(() => { location.href = stored?.next === 'create.html' ? 'create.html' : 'profile.html'; }, 250);
}

const register = document.querySelector('#register-form');
if (register) register.addEventListener('submit', async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  const result = document.querySelector('#register-result');
  if (!register.reportValidity()) return;
  const name = register.elements.fullName.value.trim(), email = register.elements.email.value.trim().toLowerCase();
  const password = register.elements.password.value, role = register.elements.role.value;
  if (password !== register.elements.passwordConfirm.value) { show(result, 'Пароли не совпадают — проверьте оба поля.', 'error'); register.elements.passwordConfirm.focus(); return; }
  try {
    const challenge = await call({ action: 'register', name, email, password, role, investorFocus: register.elements.investorFocus?.value.trim() || '', ticketSize: register.elements.ticketSize?.value.trim() || '' });
    cacheState(challenge); show(result, 'Аккаунт создан. Открываю профиль…'); setTimeout(() => { location.href = 'profile.html'; }, 250);
  } catch (error) { show(result, errorMessage(error), 'error'); }
}, true);

const login = document.querySelector('#login-form');
if (login) login.addEventListener('submit', async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  const result = document.querySelector('#login-result');
  if (!login.reportValidity()) return;
  const email = login.elements.email.value.trim().toLowerCase(), password = login.elements.password.value;
  try {
    let credential;
    try { credential = await signInWithEmailAndPassword(auth, email, password); }
    catch (error) {
      if (!['auth/user-not-found', 'auth/invalid-credential', 'auth/operation-not-allowed', 'auth/network-request-failed'].includes(error.code)) throw error;
      const old = await fallbackLegacyLogin(email, password);
      if (old.legacy?.verificationRequired) { legacyCodeStep(login, result, old.legacy); return; }
      if (old.done) { show(result, 'Вход выполнен. Открываю профиль…'); setTimeout(() => { location.href = redirectAfterLogin(); }, 250); return; }
      throw error;
    }
    let data;
    try { data = await call({ action: 'firebase-session', idToken: await credential.user.getIdToken(true), email }); }
    catch (error) {
      if (error.status === 404) {
        // Existing Render accounts can finish a one-time Firebase claim after proving mailbox ownership.
        throw new Error('Аккаунт создан до подключения Firebase. Напишите в поддержку, чтобы связать его с Firebase.');
      }
      throw error;
    }
    if (data.verificationRequired) throw new Error('Сеанс аккаунта устарел. Зарегистрируйтесь заново.');
    cacheState(data); show(result, 'Вход выполнен. Открываю профиль…');
    setTimeout(() => { location.href = redirectAfterLogin(); }, 250);
  } catch (error) { show(result, errorMessage(error), 'error'); }
}, true);

if (login && isSignInWithEmailLink(auth, location.href)) {
  login.querySelectorAll('input').forEach(input => { input.disabled = true; });
  const stored = read('buro-firebase-device-link', null);
  if (!stored?.deviceId && new URL(location.href).searchParams.get('did')) { localStorage.setItem('buro-firebase-device-link', JSON.stringify({ email: new URL(location.href).searchParams.get('email') || '', next: redirectAfterLogin(), deviceId: new URL(location.href).searchParams.get('did') })); }
  if (stored?.email) { login.elements.email.value = stored.email; }
  finishDeviceLink().catch(error => show(document.querySelector('#login-result'), errorMessage(error), 'error'));
}

window.BuroFirebaseAuth = {
  auth,
  async changePassword(currentPassword, nextPassword) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('Сначала войдите в Firebase-аккаунт.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await updatePassword(user, nextPassword);
  },
};
document.addEventListener('click', event => {
  const button = event.target.closest('#logout');
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  Promise.allSettled([signOut(auth), call({ action: 'logout' })]).finally(() => {
    localStorage.removeItem(accountKey); location.href = 'index.html';
  });
}, true);
