import { createHash, randomBytes, scryptSync, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '../../render/postgres-adapter.mjs';

const db = getDatabase();
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });
const hash = value => createHash('sha256').update(value).digest('hex');
const emailOf = value => String(value || '').trim().toLowerCase();
const cleanAccount = row => row && ({ name: row.name, email: row.email, role: row.role, ...(row.profile || {}), createdAt: row.created_at, emailVerified: Boolean(row.email_verified_at) });
function cookie(req) { return req.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('buro_session='))?.slice('buro_session='.length) || ''; }
async function session(req) {
  const token = cookie(req); if (!token) return null;
  const rows = await db.sql`SELECT a.email, a.name, a.role, a.profile, a.created_at, a.email_verified_at FROM app_sessions s JOIN app_accounts a ON a.email=s.email WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND a.email_verified_at IS NOT NULL LIMIT 1`;
  return rows[0] || null;
}
async function setSession(email) {
  const token = randomBytes(32).toString('base64url');
  await db.sql`INSERT INTO app_sessions(token_hash,email,expires_at) VALUES(${hash(token)},${email},now()+interval '30 days')`;
  return `buro_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
async function stateFor(email) {
  const [users, records, projects] = await Promise.all([
    db.sql`SELECT email,name,role,profile,created_at,email_verified_at FROM app_accounts WHERE email=${email} LIMIT 1`,
    db.sql`SELECT record_key,value FROM app_records WHERE owner_email=${email}`,
    db.sql`SELECT document FROM app_projects WHERE owner_email=${email}`,
  ]);
  return { account: cleanAccount(users[0]), records: Object.fromEntries(records.map(row=>[row.record_key,row.value])), projects: projects.map(row=>row.document) };
}
async function importState(email, records={}, projects=[]) {
  for(const [key,value] of Object.entries(records)) if(/^buro-[\w-]{1,100}$/.test(key)&&!['buro-browser-users-v1','buro-demo-account','buro-startapov-projects-v1'].includes(key)) await db.sql`INSERT INTO app_records(owner_email,record_key,value) VALUES(${email},${key},${JSON.stringify(value)}::jsonb) ON CONFLICT(owner_email,record_key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`;
  for(const project of Array.isArray(projects)?projects:[]) if(validProject(project)&&emailOf(project.ownerEmail)===email) await db.sql`INSERT INTO app_projects(id,owner_email,document) VALUES(${String(project.id)},${email},${JSON.stringify(project)}::jsonb) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document,updated_at=now() WHERE app_projects.owner_email=EXCLUDED.owner_email`;
}
async function importLegacyVotes(projectId) {
  const existing = await db.sql`SELECT 1 FROM app_votes WHERE project_id=${projectId} LIMIT 1`;
  if (existing.length) return;
  try {
    const response = await fetch('https://buro-startapov.netlify.app/api/community-votes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, browserId: `render-migration-${projectId}` }),
    });
    if (!response.ok) return;
    const tally = await response.json();
    for (const [type, count] of [['up', tally.up], ['down', tally.down]]) {
      const amount = Math.max(0, Math.min(10000, Number(count) || 0));
      for (let i = 1; i <= amount; i++) {
        const voterKey = hash(`legacy:${projectId}:${type}:${i}`);
        await db.sql`INSERT INTO app_votes(project_id,voter_key,vote) VALUES(${projectId},${voterKey},${type}) ON CONFLICT DO NOTHING`;
      }
    }
  } catch { /* A missing legacy Netlify vote does not block the Render-backed app. */ }
}
function validProject(value) { return value && typeof value === 'object' && /^[\p{L}\p{N}_-]{1,100}$/u.test(String(value.id || '')) && typeof value.name === 'string' && value.name.trim().length > 0; }

function validDeviceId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(value); }
async function firebaseIdentity(idToken) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyDVhtACl-0GnDDsiFfsozxNlaOm6shpsu4';
  if (!apiKey) return { error: 'Firebase ещё не подключён к API: добавьте FIREBASE_WEB_API_KEY в Render.' };
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 10000) return { error: 'Сеанс Firebase истёк. Войдите ещё раз.' };
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
  if (!response.ok) return { error: 'Не удалось подтвердить сеанс Firebase.' };
  const data = await response.json();
  const user = data.users?.[0];
  if (!user?.localId || !user.email) return { error: 'Firebase не вернул проверенный аккаунт.' };
  return { uid: user.localId, email: emailOf(user.email), emailVerified: Boolean(user.emailVerified), displayName: String(user.displayName || '') };
}
async function sendEmailCode(email, purpose, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: 'Для подтверждения почты настройте RESEND_API_KEY и EMAIL_FROM в Render.' };
  const subject = purpose === 'register' ? 'Подтверждение аккаунта — Бюро стартапов' : 'Код входа — Бюро стартапов';
  const explanation = purpose === 'register' ? 'Введите этот код на сайте, чтобы подтвердить адрес почты и завершить регистрацию.' : 'Введите этот код на сайте, чтобы подтвердить вход с нового устройства.';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject, text: `${explanation}\n\nКод: ${code}\n\nКод действует 10 минут. Если вы не запрашивали его, проигнорируйте это письмо.`, html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><p>${explanation}</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>Код действует 10 минут. Если вы не запрашивали его, проигнорируйте это письмо.</p></div>` }),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    console.error('Verification email provider rejected a message:', response.status, details.name || 'provider_error');
    return { ok: false, error: 'Сервис отправки почты отклонил письмо. Проверьте настройки отправителя в Render.' };
  }
  return { ok: true };
}
async function createAuthChallenge(email, purpose, payload, deviceHash, deviceLabel) {
  const existing = await db.sql`SELECT created_at FROM app_auth_challenges WHERE email=${email} AND purpose=${purpose} AND created_at>now()-interval '60 seconds' LIMIT 1`;
  if (existing.length) return { ok: false, status: 429, error: 'Подождите минуту перед повторной отправкой кода.' };
  const code = String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
  await db.sql`INSERT INTO app_auth_challenges(email,purpose,code_hash,expires_at,attempts,payload,device_hash) VALUES(${email},${purpose},${hash(`${email}:${purpose}:${code}`)},now()+interval '10 minutes',0,${JSON.stringify(payload)}::jsonb,${deviceHash}) ON CONFLICT(email,purpose) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,payload=EXCLUDED.payload,device_hash=EXCLUDED.device_hash,created_at=now()`;
  const sent = await sendEmailCode(email, purpose, code);
  if (!sent.ok) {
    await db.sql`DELETE FROM app_auth_challenges WHERE email=${email} AND purpose=${purpose}`;
    return { ok: false, status: sent.error.includes('настройте') ? 503 : 502, error: sent.error };
  }
  return { ok: true, status: 202, deviceLabel };
}
async function verifyAuthChallenge(email, purpose, code) {
  const rows = await db.sql`SELECT code_hash,expires_at,attempts,payload,device_hash FROM app_auth_challenges WHERE email=${email} AND purpose=${purpose} LIMIT 1`;
  const challenge = rows[0];
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) return { ok: false, error: 'Код истёк. Запросите новый.' };
  if (challenge.attempts >= 5) return { ok: false, error: 'Лимит попыток исчерпан. Запросите новый код.' };
  const actual = hash(`${email}:${purpose}:${String(code || '')}`);
  const expected = Buffer.from(challenge.code_hash, 'hex');
  const supplied = Buffer.from(actual, 'hex');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    await db.sql`UPDATE app_auth_challenges SET attempts=attempts+1 WHERE email=${email} AND purpose=${purpose}`;
    return { ok: false, error: 'Неверный код. Проверьте письмо и попробуйте ещё раз.' };
  }
  return { ok: true, challenge };
}
async function trustDevice(email, deviceHash, deviceLabel) {
  await db.sql`INSERT INTO app_trusted_devices(email,device_hash,device_label,last_used_at) VALUES(${email},${deviceHash},${deviceLabel},now()) ON CONFLICT(email,device_hash) DO UPDATE SET device_label=EXCLUDED.device_label,last_used_at=now()`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
  try {
    if (req.method === 'GET') {
      const action = url.searchParams.get('action') || '';
      if (action === 'projects') {
        const [projects, votes] = await Promise.all([
          db.sql`SELECT document FROM app_projects ORDER BY updated_at DESC`,
          db.sql`SELECT project_id, SUM(CASE WHEN vote='up' THEN 1 ELSE 0 END)::int AS up, SUM(CASE WHEN vote='down' THEN 1 ELSE 0 END)::int AS down FROM app_votes GROUP BY project_id`,
        ]);
        return reply({ projects: projects.map(row => row.document), votes: Object.fromEntries(votes.map(row => [row.project_id, { up: row.up, down: row.down }])) });
      }
      if (action === 'project') { const id=url.searchParams.get('id')||''; const rows=await db.sql`SELECT document FROM app_projects WHERE id=${id} LIMIT 1`; return rows[0]?reply({project:rows[0].document}):reply({error:'Проект не найден.'},404); }
      if (action === 'me' || action === 'state') { const who=await session(req); return who?reply(await stateFor(who.email)):reply({account:null},401); }
      if (action === 'records') { const who=await session(req); if(!who)return reply({error:'Войдите в аккаунт.'},401); const state=await stateFor(who.email); return reply({records:state.records}); }
      if (action === 'vote') { const projectId=url.searchParams.get('projectId')||'';const who=await session(req);if(!/^[\p{L}\p{N}_-]{1,100}$/u.test(projectId))return reply({error:'Некорректный проект.'},400);await importLegacyVotes(projectId);const rows=await db.sql`SELECT SUM(CASE WHEN vote='up' THEN 1 ELSE 0 END)::int AS up,SUM(CASE WHEN vote='down' THEN 1 ELSE 0 END)::int AS down FROM app_votes WHERE project_id=${projectId}`;const mine=who?await db.sql`SELECT vote FROM app_votes WHERE project_id=${projectId} AND voter_key=${hash(who.email)}`:[];return reply({up:rows[0]?.up||0,down:rows[0]?.down||0,myVote:mine[0]?.vote||null}); }
      return reply({error:'Неизвестный запрос.'},404);
    }
    if (req.method !== 'POST') return reply({error:'Метод не поддерживается.'},405);
    const body=await req.json();
    if (body.action === 'firebase-register') {
      const identity = await firebaseIdentity(body.idToken);
      if (identity.error) return reply({ error: identity.error }, identity.error.includes('ещё не подключён') ? 503 : 401);
      if (identity.email !== emailOf(body.email) || identity.emailVerified) return reply({ error: 'Состояние email в Firebase изменилось. Повторите регистрацию.' }, 400);
      const name = String(body.name || '').trim(), role = String(body.role || '');
      if (!name || name.length > 100 || !['startup', 'investor', 'mentor'].includes(role)) return reply({ error: 'Проверьте имя и выбранную роль.' }, 400);
      const profile = { investorFocus: String(body.investorFocus || '').slice(0, 160), ticketSize: String(body.ticketSize || '').slice(0, 100) };
      const saved = await db.sql`SELECT email,firebase_uid,email_verified_at FROM app_accounts WHERE email=${identity.email} LIMIT 1`;
      if (saved[0] && saved[0].firebase_uid !== identity.uid) return reply({ error: 'У этого email уже есть аккаунт. Войдите в него.' }, 409);
      if (saved[0] && !saved[0].firebase_uid) {
        await db.sql`UPDATE app_accounts SET firebase_uid=${identity.uid},updated_at=now() WHERE email=${identity.email} AND firebase_uid IS NULL`;
        return reply({ ok: true, email: identity.email, linkedExistingAccount: true }, 200);
      }
      const rows = await db.sql`INSERT INTO app_accounts(email,name,role,password_hash,password_salt,password_scheme,profile,firebase_uid,email_verified_at) VALUES(${identity.email},${name},${role},'','', 'firebase',${JSON.stringify(profile)}::jsonb,${identity.uid},NULL) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,profile=EXCLUDED.profile,firebase_uid=EXCLUDED.firebase_uid,updated_at=now() WHERE app_accounts.firebase_uid=EXCLUDED.firebase_uid AND app_accounts.email_verified_at IS NULL RETURNING email`;
      if (!rows.length) return reply({ error: 'Не удалось создать Firebase-профиль. Попробуйте войти в существующий аккаунт.' }, 409);
      return reply({ ok: true, email: identity.email }, 201);
    }
    if (body.action === 'firebase-session') {
      const identity = await firebaseIdentity(body.idToken);
      if (identity.error) return reply({ error: identity.error }, identity.error.includes('ещё не подключён') ? 503 : 401);
      if (identity.email !== emailOf(body.email) || !validDeviceId(body.deviceId)) return reply({ error: 'Сеанс или устройство не подтверждены.' }, 400);
      const rows = await db.sql`SELECT email,name,role,profile,created_at,email_verified_at,firebase_uid FROM app_accounts WHERE email=${identity.email} LIMIT 1`;
      const user = rows[0];
      if (!user || user.firebase_uid !== identity.uid) return reply({ error: 'Профиль не найден. Завершите регистрацию через Firebase.' }, 404);
      if (!identity.emailVerified) return reply({ error: 'Подтвердите адрес почты по ссылке в письме Firebase.', verificationRequired: true }, 403);
      if (!user.email_verified_at) {
        await db.sql`UPDATE app_accounts SET email_verified_at=now(),updated_at=now() WHERE email=${identity.email}`;
        await db.sql`INSERT INTO app_analytics(event_name,route) VALUES('signup','/register')`;
      }
      const deviceHash = hash(`device:${body.deviceId}`), deviceLabel = String(body.deviceLabel || 'Browser').slice(0, 80);
      const trusted = await db.sql`SELECT 1 FROM app_trusted_devices WHERE email=${identity.email} AND device_hash=${deviceHash} LIMIT 1`;
      if (!trusted.length) {
        await db.sql`INSERT INTO app_auth_challenges(email,purpose,code_hash,expires_at,attempts,payload,device_hash) VALUES(${identity.email},'login',${hash(`firebase-email-link:${identity.uid}:${deviceHash}`)},now()+interval '15 minutes',0,${JSON.stringify({ firebaseUid: identity.uid, deviceLabel })}::jsonb,${deviceHash}) ON CONFLICT(email,purpose) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,payload=EXCLUDED.payload,device_hash=EXCLUDED.device_hash,created_at=now()`;
        return reply({ verificationRequired: true, purpose: 'device-link', email: identity.email, message: 'Подтвердите вход по ссылке в письме Firebase.' }, 202);
      }
      await trustDevice(identity.email, deviceHash, deviceLabel);
      return reply(await stateFor(identity.email), 200, { 'set-cookie': await setSession(identity.email) });
    }
    if (body.action === 'firebase-device-finish') {
      const identity = await firebaseIdentity(body.idToken);
      if (identity.error) return reply({ error: identity.error }, identity.error.includes('ещё не подключён') ? 503 : 401);
      if (!identity.emailVerified || !validDeviceId(body.deviceId)) return reply({ error: 'Ссылка входа или устройство не подтверждены.' }, 401);
      const deviceHash = hash(`device:${body.deviceId}`);
      const challenges = await db.sql`SELECT payload,device_hash,expires_at FROM app_auth_challenges WHERE email=${identity.email} AND purpose='login' LIMIT 1`;
      const challenge = challenges[0];
      if (!challenge || challenge.device_hash !== deviceHash || new Date(challenge.expires_at).getTime() < Date.now() || challenge.payload?.firebaseUid !== identity.uid) return reply({ error: 'Ссылка устарела или была запрошена на другом устройстве. Войдите снова.' }, 400);
      const account = await db.sql`SELECT 1 FROM app_accounts WHERE email=${identity.email} AND firebase_uid=${identity.uid} AND email_verified_at IS NOT NULL LIMIT 1`;
      if (!account.length) return reply({ error: 'Аккаунт не найден или email не подтверждён.' }, 404);
      await trustDevice(identity.email, deviceHash, String(challenge.payload.deviceLabel || body.deviceLabel || 'Browser').slice(0, 80));
      await db.sql`DELETE FROM app_auth_challenges WHERE email=${identity.email} AND purpose='login'`;
      return reply(await stateFor(identity.email), 200, { 'set-cookie': await setSession(identity.email) });
    }
    if(body.action==='register') {
      const email=emailOf(body.email),name=String(body.name||'').trim(),role=String(body.role||'');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length<1||name.length>100||!['startup','investor','mentor'].includes(role)||typeof body.password!=='string'||body.password.length<8||body.password.length>256)return reply({error:'Проверьте имя, email, роль и пароль (не менее 8 символов).'},400);
      if (!validDeviceId(body.deviceId)) return reply({error:'Обновите страницу и повторите регистрацию.'},400);
      const existing = await db.sql`SELECT email FROM app_accounts WHERE email=${email} LIMIT 1`;
      if (existing.length) return reply({error:'Аккаунт с таким email уже существует.'},409);
      const salt=randomBytes(16).toString('hex'),passwordHash=scryptSync(body.password,salt,64).toString('hex');
      const profile=body.profile&&typeof body.profile==='object'?body.profile:{investorFocus:String(body.investorFocus||''),ticketSize:String(body.ticketSize||'')};
      const payload={name,role,passwordHash,passwordSalt:salt,profile,records:body.records||{},projects:Array.isArray(body.projects)?body.projects:[]};
      const deviceHash=hash(`device:${body.deviceId}`),deviceLabel=String(body.deviceLabel||'Browser').slice(0,80);
      const challenge=await createAuthChallenge(email,'register',payload,deviceHash,deviceLabel);
      return challenge.ok?reply({verificationRequired:true,purpose:'register',email,message:'Код подтверждения отправлен на почту. Введите его, чтобы завершить регистрацию.'},202):reply({error:challenge.error},challenge.status);
    }
    if(body.action==='login') {
      const email=emailOf(body.email); const rows=await db.sql`SELECT email,name,role,profile,created_at,email_verified_at,password_hash,password_salt,password_scheme FROM app_accounts WHERE email=${email} LIMIT 1`; const user=rows[0];
      if(!user||typeof body.password!=='string')return reply({error:'Неверный email или пароль.'},401);
      const expected=Buffer.from(user.password_hash,'hex'),actual=user.password_scheme==='pbkdf2'?pbkdf2Sync(body.password,Buffer.from(user.password_salt,'hex'),120000,32,'sha256'):scryptSync(body.password,user.password_salt,64);
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return reply({error:'Неверный email или пароль.'},401);
      if (!user.email_verified_at) return reply({error:'Этот адрес ещё не подтверждён. Завершите подтверждение регистрации.'},403);
      if (!validDeviceId(body.deviceId)) return reply({error:'Обновите страницу и повторите вход.'},400);
      const deviceHash=hash(`device:${body.deviceId}`),deviceLabel=String(body.deviceLabel||'Browser').slice(0,80);
      const trusted=await db.sql`SELECT 1 FROM app_trusted_devices WHERE email=${email} AND device_hash=${deviceHash} LIMIT 1`;
      if (!trusted.length) {
        const challenge=await createAuthChallenge(email,'login',{},deviceHash,deviceLabel);
        return challenge.ok?reply({verificationRequired:true,purpose:'login',email,message:'На почту отправлен код для подтверждения нового устройства.'},202):reply({error:challenge.error},challenge.status);
      }
      await trustDevice(email,deviceHash,deviceLabel);
      return reply(await stateFor(email),200,{'set-cookie':await setSession(email)});
    }
    if(body.action==='verify-email'||body.action==='verify-login') {
      const email=emailOf(body.email),purpose=body.action==='verify-email'?'register':'login';
      const verified=await verifyAuthChallenge(email,purpose,body.code);
      if(!verified.ok)return reply({error:verified.error},400);
      const {challenge}=verified;
      if(purpose==='register') {
        const saved=challenge.payload||{};
        const rows=await db.sql`INSERT INTO app_accounts(email,name,role,password_hash,password_salt,password_scheme,profile,email_verified_at) VALUES(${email},${String(saved.name||'')},${String(saved.role||'')},${String(saved.passwordHash||'')},${String(saved.passwordSalt||'')},${String(saved.passwordScheme||'scrypt')},${JSON.stringify(saved.profile||{})}::jsonb,now()) ON CONFLICT DO NOTHING RETURNING email,name,role,profile,created_at,email_verified_at`;
        if(!rows[0])return reply({error:'Аккаунт с таким email уже существует.'},409);
        await importState(email,saved.records,saved.projects);
        await db.sql`INSERT INTO app_analytics(event_name,route) VALUES('signup','/register')`;
      }
      await trustDevice(email,challenge.device_hash,String(body.deviceLabel||'Browser').slice(0,80));
      await db.sql`DELETE FROM app_auth_challenges WHERE email=${email} AND purpose=${purpose}`;
      return reply(await stateFor(email),200,{'set-cookie':await setSession(email)});
    }
    if(body.action==='resend-code') {
      const email=emailOf(body.email),rows=await db.sql`SELECT purpose,payload,device_hash FROM app_auth_challenges WHERE email=${email} LIMIT 1`,pending=rows[0];
      if(!pending)return reply({error:'Активный запрос подтверждения не найден. Повторите вход или регистрацию.'},404);
      const challenge=await createAuthChallenge(email,pending.purpose,pending.payload,pending.device_hash,String(body.deviceLabel||'Browser').slice(0,80));
      return challenge.ok?reply({ok:true,message:'Новый код отправлен на вашу почту.'},202):reply({error:challenge.error},challenge.status);
    }
    if(body.action==='logout') { const token=cookie(req); if(token)await db.sql`DELETE FROM app_sessions WHERE token_hash=${hash(token)}`; return reply({ok:true},200,{'set-cookie':'buro_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}); }

    if(body.action==='migrate-legacy') {
      const email=emailOf(body.email),salt=String(body.legacySalt||''),passwordHash=String(body.legacyHash||''),name=String(body.name||'').trim(),role=String(body.role||'');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[a-f0-9]{32}$/i.test(salt)||!/^[a-f0-9]{64}$/i.test(passwordHash)||!['startup','investor','mentor'].includes(role)||!name)return reply({error:'Не удалось перенести локальный аккаунт.'},400);
      const profile=body.profile&&typeof body.profile==='object'?body.profile:{};
      if (!validDeviceId(body.deviceId)) return reply({error:'Обновите страницу и повторите вход.'},400);
      const existing=await db.sql`SELECT email FROM app_accounts WHERE email=${email} LIMIT 1`;if(existing.length)return reply({error:'Аккаунт уже есть в базе — выполните вход.'},409);
      const payload={name,role,passwordHash,passwordSalt:salt,passwordScheme:'pbkdf2',profile,records:body.records||{},projects:Array.isArray(body.projects)?body.projects:[]};
      const challenge=await createAuthChallenge(email,'register',payload,hash(`device:${body.deviceId}`),String(body.deviceLabel||'Browser').slice(0,80));
      return challenge.ok?reply({verificationRequired:true,purpose:'register',email,message:'Код подтверждения отправлен на почту. Введите его, чтобы перенести аккаунт.'},202):reply({error:challenge.error},challenge.status);
    }

    const who=await session(req); if(!who)return reply({error:'Войдите в аккаунт, чтобы сохранить данные.'},401);
    if(body.action==='import') {
      const records=body.records&&typeof body.records==='object'?body.records:{};const projects=Array.isArray(body.projects)?body.projects:[];await importState(who.email,records,projects);return reply({ok:true,records:Object.keys(records).length,projects:projects.length});
    }
    if(body.action==='record') {
      const key=String(body.key||''); if(!/^buro-[\w-]{1,100}$/.test(key)||['buro-browser-users-v1','buro-demo-account'].includes(key))return reply({error:'Недопустимый ключ.'},400);
      if(body.remove){await db.sql`DELETE FROM app_records WHERE owner_email=${who.email} AND record_key=${key}`;return reply({ok:true});}
      await db.sql`INSERT INTO app_records(owner_email,record_key,value) VALUES(${who.email},${key},${JSON.stringify(body.value)}::jsonb) ON CONFLICT(owner_email,record_key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`;
      return reply({ok:true});
    }
    if(body.action==='profile') {
      const name=String(body.name||who.name).trim(),email=emailOf(body.email||who.email),role=['startup','investor','mentor'].includes(body.role)?body.role:who.role;const profile=body.profile&&typeof body.profile==='object'?body.profile:{};
      if(!email||!name)return reply({error:'Заполните имя и email.'},400);
      if(email!==who.email)return reply({error:'Смена email доступна после отдельного подтверждения нового адреса.'},409);
      const rows=await db.sql`UPDATE app_accounts SET name=${name},role=${role},profile=${JSON.stringify(profile)}::jsonb,updated_at=now() WHERE email=${who.email} RETURNING email,name,role,profile,created_at,email_verified_at`;
      if(!rows[0])return reply({error:'Аккаунт не найден.'},404);
      await db.sql`UPDATE app_projects SET document=jsonb_set(jsonb_set(document,'{ownerEmail}',to_jsonb(${email}::text)),'{ownerName}',to_jsonb(${name}::text)),updated_at=now() WHERE owner_email=${email}`;
      return reply({account:cleanAccount(rows[0])});
    }
    if(body.action==='password') {
      const rows=await db.sql`SELECT password_hash,password_salt FROM app_accounts WHERE email=${who.email} LIMIT 1`;const user=rows[0];if(!user||typeof body.oldPassword!=='string'||typeof body.newPassword!=='string'||body.newPassword.length<8||body.newPassword.length>256)return reply({error:'Проверьте текущий пароль и новый пароль (не менее 8 символов).'},400);
      const actual=scryptSync(body.oldPassword,user.password_salt,64),expected=Buffer.from(user.password_hash,'hex');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply({error:'Текущий пароль введён неверно.'},401);
      const salt=randomBytes(16).toString('hex'),passwordHash=scryptSync(body.newPassword,salt,64).toString('hex');await db.sql`UPDATE app_accounts SET password_hash=${passwordHash},password_salt=${salt},password_scheme='scrypt',updated_at=now() WHERE email=${who.email}`;return reply({ok:true});
    }
    if(body.action==='project') {
      const project=body.project;if(!validProject(project))return reply({error:'Заполните название проекта.'},400);
      if(who.role!=='startup')return reply({error:'Создавать проекты может аккаунт стартапера.'},403);
      const document={...project,ownerEmail:who.email,ownerName:who.name};
      const rows=await db.sql`INSERT INTO app_projects(id,owner_email,document) VALUES(${String(project.id)},${who.email},${JSON.stringify(document)}::jsonb) ON CONFLICT(id) DO UPDATE SET document=EXCLUDED.document,updated_at=now() WHERE app_projects.owner_email=EXCLUDED.owner_email RETURNING id`;
      if(!rows[0])return reply({error:'Этот идентификатор проекта принадлежит другой команде.'},409);
      await db.sql`INSERT INTO app_analytics(event_name,route,project_id) VALUES('project_create','/create',${String(project.id)})`;
      return reply({project:document});
    }
    if(body.action==='delete-project') { const rows=await db.sql`DELETE FROM app_projects WHERE id=${String(body.projectId||'')} AND owner_email=${who.email} RETURNING id`;if(rows.length)await db.sql`DELETE FROM app_votes WHERE project_id=${String(body.projectId||'')}`;return rows.length?reply({ok:true}):reply({error:'Проект не найден.'},404); }
    if(body.action==='vote') {
      const projectId=String(body.projectId||'');if(!/^[\p{L}\p{N}_-]{1,100}$/u.test(projectId)||!['up','down',null].includes(body.vote))return reply({error:'Некорректный голос.'},400);
      if(!who)return reply({error:'Войдите в аккаунт, чтобы голосовать.'},401);
      const voterKey=hash(who.email);
      await importLegacyVotes(projectId);
      if(body.vote===null)await db.sql`DELETE FROM app_votes WHERE project_id=${projectId} AND voter_key=${voterKey}`;
      else await db.sql`INSERT INTO app_votes(project_id,voter_key,vote) VALUES(${projectId},${voterKey},${body.vote}) ON CONFLICT(project_id,voter_key) DO UPDATE SET vote=EXCLUDED.vote,updated_at=now()`;
      const rows=await db.sql`SELECT SUM(CASE WHEN vote='up' THEN 1 ELSE 0 END)::int AS up,SUM(CASE WHEN vote='down' THEN 1 ELSE 0 END)::int AS down FROM app_votes WHERE project_id=${projectId}`;
      const mine=await db.sql`SELECT vote FROM app_votes WHERE project_id=${projectId} AND voter_key=${voterKey}`;
      await db.sql`INSERT INTO app_analytics(event_name,route,project_id) VALUES('vote','/project',${projectId})`;
      return reply({up:rows[0]?.up||0,down:rows[0]?.down||0,myVote:mine[0]?.vote||null});
    }
    return reply({error:'Неизвестный запрос.'},404);
  } catch(error) {
    console.error('database function error',error);
    return reply({error:'Ошибка базы данных. Проверьте миграцию и повторите.'},500);
  }
}

