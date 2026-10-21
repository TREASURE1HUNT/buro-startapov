import { createHash, randomBytes, scryptSync, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';

const db = getDatabase();
const legacyVotes = getStore('buro-community-votes', { consistency: 'strong' });
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });
const hash = value => createHash('sha256').update(value).digest('hex');
const emailOf = value => String(value || '').trim().toLowerCase();
const cleanAccount = row => row && ({ name: row.name, email: row.email, role: row.role, ...(row.profile || {}), createdAt: row.created_at });
function cookie(req) { return req.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('buro_session='))?.slice('buro_session='.length) || ''; }
async function session(req) {
  const token = cookie(req); if (!token) return null;
  const rows = await db.sql`SELECT a.email, a.name, a.role, a.profile, a.created_at FROM app_sessions s JOIN app_accounts a ON a.email=s.email WHERE s.token_hash=${hash(token)} AND s.expires_at>now() LIMIT 1`;
  return rows[0] || null;
}
async function setSession(email) {
  const token = randomBytes(32).toString('base64url');
  await db.sql`INSERT INTO app_sessions(token_hash,email,expires_at) VALUES(${hash(token)},${email},now()+interval '30 days')`;
  return `buro_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
async function stateFor(email) {
  const [users, records, projects] = await Promise.all([
    db.sql`SELECT email,name,role,profile,created_at FROM app_accounts WHERE email=${email} LIMIT 1`,
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
  const existing=await db.sql`SELECT 1 FROM app_votes WHERE project_id=${projectId} LIMIT 1`;
  if(existing.length)return;
  const old=await legacyVotes.get(`project:${projectId}`,{type:'json'});
  for(const [voterKey,vote] of Object.entries(old?.voters||{})) if(/^[a-f0-9]{64}$/i.test(voterKey)&&(vote==='up'||vote==='down')) await db.sql`INSERT INTO app_votes(project_id,voter_key,vote) VALUES(${projectId},${voterKey},${vote}) ON CONFLICT DO NOTHING`;
}
function validProject(value) { return value && typeof value === 'object' && /^[\p{L}\p{N}_-]{1,100}$/u.test(String(value.id || '')) && typeof value.name === 'string' && value.name.trim().length > 0; }

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
    if(body.action==='register') {
      const email=emailOf(body.email),name=String(body.name||'').trim(),role=String(body.role||'');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length<1||name.length>100||!['startup','investor','mentor'].includes(role)||typeof body.password!=='string'||body.password.length<8||body.password.length>256)return reply({error:'Проверьте имя, email, роль и пароль (не менее 8 символов).'},400);
      const salt=randomBytes(16).toString('hex'),passwordHash=scryptSync(body.password,salt,64).toString('hex');
      const profile=body.profile&&typeof body.profile==='object'?body.profile:{investorFocus:String(body.investorFocus||''),ticketSize:String(body.ticketSize||'')};
      const rows=await db.sql`INSERT INTO app_accounts(email,name,role,password_hash,password_salt,password_scheme,profile) VALUES(${email},${name},${role},${passwordHash},${salt},${'scrypt'},${JSON.stringify(profile)}::jsonb) ON CONFLICT DO NOTHING RETURNING email,name,role,profile,created_at`;
      if(!rows[0])return reply({error:'Аккаунт с таким email уже существует.'},409);
      await importState(email,body.records,body.projects);
      return reply(await stateFor(email),201,{'set-cookie':await setSession(email)});
    }
    if(body.action==='login') {
      const email=emailOf(body.email); const rows=await db.sql`SELECT email,name,role,profile,created_at,password_hash,password_salt,password_scheme FROM app_accounts WHERE email=${email} LIMIT 1`; const user=rows[0];
      if(!user||typeof body.password!=='string')return reply({error:'Неверный email или пароль.'},401);
      const expected=Buffer.from(user.password_hash,'hex'),actual=user.password_scheme==='pbkdf2'?pbkdf2Sync(body.password,Buffer.from(user.password_salt,'hex'),120000,32,'sha256'):scryptSync(body.password,user.password_salt,64);
      if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return reply({error:'Неверный email или пароль.'},401);
      return reply(await stateFor(email),200,{'set-cookie':await setSession(email)});
    }
    if(body.action==='logout') { const token=cookie(req); if(token)await db.sql`DELETE FROM app_sessions WHERE token_hash=${hash(token)}`; return reply({ok:true},200,{'set-cookie':'buro_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}); }

    if(body.action==='migrate-legacy') {
      const email=emailOf(body.email),salt=String(body.legacySalt||''),passwordHash=String(body.legacyHash||''),name=String(body.name||'').trim(),role=String(body.role||'');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[a-f0-9]{32}$/i.test(salt)||!/^[a-f0-9]{64}$/i.test(passwordHash)||!['startup','investor','mentor'].includes(role)||!name)return reply({error:'Не удалось перенести локальный аккаунт.'},400);
      const profile=body.profile&&typeof body.profile==='object'?body.profile:{};
      const rows=await db.sql`INSERT INTO app_accounts(email,name,role,password_hash,password_salt,password_scheme,profile) VALUES(${email},${name},${role},${passwordHash},${salt},${'pbkdf2'},${JSON.stringify(profile)}::jsonb) ON CONFLICT DO NOTHING RETURNING email`;
      if(!rows[0])return reply({error:'Аккаунт уже есть в базе — выполните вход.'},409);
      await importState(email,body.records,body.projects);
      return reply(await stateFor(email),201,{'set-cookie':await setSession(email)});
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
      const rows=await db.sql`UPDATE app_accounts SET email=${email},name=${name},role=${role},profile=${JSON.stringify(profile)}::jsonb,updated_at=now() WHERE email=${who.email} RETURNING email,name,role,profile,created_at`;
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
      return reply({up:rows[0]?.up||0,down:rows[0]?.down||0,myVote:mine[0]?.vote||null});
    }
    return reply({error:'Неизвестный запрос.'},404);
  } catch(error) {
    console.error('database function error',error);
    return reply({error:'Ошибка базы данных. Проверьте миграцию и повторите.'},500);
  }
}

