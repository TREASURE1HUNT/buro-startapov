import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(root, 'admin');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined });
const port = Number(process.env.PORT || 10000);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const hash = value => createHash('sha256').update(value).digest('hex');
const sessions = new Map();
const configs = {
  app_accounts: { key: 'email', columns: ['email','name','role','profile','created_at','updated_at'], editable: ['name','role','profile'] },
  app_projects: { key: 'id', columns: ['id','owner_email','document','created_at','updated_at'], editable: ['document'] },
  app_votes: { key: ['project_id','voter_key'], columns: ['project_id','voter_key','vote','updated_at'], editable: ['vote'] },
  app_records: { key: ['owner_email','record_key'], columns: ['owner_email','record_key','value','updated_at'], editable: ['value'] },
  app_sessions: { key: 'token_hash', columns: ['token_hash','email','expires_at','created_at'], editable: ['expires_at'] },
  app_analytics: { key: 'id', columns: ['id','event_name','route','project_id','visitor_id','created_at'], editable: ['event_name','route','project_id'] },
  schema_migrations: { key: 'version', columns: ['version','applied_at'], editable: [] },
};
const send = (res, status, data, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(data)); };
const body = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); };
function cookie(req) { return (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('buro_admin='))?.slice('buro_admin='.length) || ''; }
function authed(req) { const token = cookie(req), expires = sessions.get(hash(token)); if (!token || !expires || expires < Date.now()) return false; sessions.set(hash(token), Date.now() + 8 * 60 * 60 * 1000); return true; }
function tupleKey(config, values) { return (Array.isArray(config.key) ? config.key : [config.key]).map(k => { if (!(k in values)) throw new Error(`Missing key: ${k}`); return values[k]; }); }
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') { try { await pool.query('SELECT 1'); return send(res, 200, { ok: true, database: 'connected' }); } catch { return send(res, 503, { ok: false }); } }
  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    if (!process.env.ADMIN_API_TOKEN || process.env.ADMIN_API_TOKEN.length < 32) return send(res, 503, { error: 'Настройте ADMIN_API_TOKEN в переменных Render.' });
    const input = await body(req), a = Buffer.from(String(input.token || '')), b = Buffer.from(process.env.ADMIN_API_TOKEN);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return send(res, 401, { error: 'Неверный ключ администратора.' });
    const session = randomBytes(32).toString('base64url'); sessions.set(hash(session), Date.now() + 8 * 60 * 60 * 1000);
    return send(res, 200, { ok: true }, { 'set-cookie': `buro_admin=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` });
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/logout') { const token = cookie(req); if (token) sessions.delete(hash(token)); return send(res, 200, { ok: true }, { 'set-cookie': 'buro_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' }); }
  if (req.method === 'GET' && url.pathname === '/api/admin/session') return send(res, 200, { authenticated: authed(req) });
  if (req.method === 'POST' && url.pathname === '/api/admin/wake') {
    if (!authed(req)) return send(res, 401, { error: 'Войдите в панель администратора.' });
    const input=await body(req),target=['api','database','ai','all'].includes(input.target)?input.target:'all';
    const services={};
    const timeout=()=>AbortSignal.timeout(15000);
    if(target==='all'||target==='database')try{await pool.query('SELECT 1');services.database={ok:true,message:'подключена'};}catch(error){services.database={ok:false,message:`ошибка соединения: ${error.code||'DB'}`};}
    if(target==='all'||target==='api')try{const response=await fetch(process.env.SITE_API_URL||'https://buro-startapov-api.onrender.com/health',{signal:timeout(),cache:'no-store'});services.api={ok:response.ok,message:response.ok?'отвечает и прогрет':'ответил HTTP '+response.status};}catch(error){services.api={ok:false,message:error.name==='TimeoutError'?'тайм-аут при запуске':'не отвечает'};}
    if(target==='all'||target==='ai'){
      const key=process.env.INFERENCE_API_KEY||process.env.OPENAI_API_KEY,base=(process.env.INFERENCE_BASE_URL||((key?.startsWith('dahl_'))?'https://inference.dahl.global/v1':'https://api.openai.com/v1')).replace(/\/$/,'');
      if(!key)services.ai={ok:false,message:'ключ ИИ не настроен на Render'};
      else try{const response=await fetch(base+'/models',{headers:{authorization:`Bearer ${key}`},signal:timeout(),cache:'no-store'});services.ai={ok:response.ok,message:response.ok?'API ИИ доступен':'API ИИ ответил HTTP '+response.status};}catch(error){services.ai={ok:false,message:error.name==='TimeoutError'?'тайм-аут при запуске':'API ИИ не отвечает'};}
    }
    return send(res,200,{services});
  }
  if (url.pathname.startsWith('/api/admin/')) {
    if (!authed(req)) return send(res, 401, { error: 'Войдите в панель администратора.' });
    try {
      if (req.method === 'GET' && url.pathname === '/api/admin/metrics') {
        const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
        const to=url.searchParams.get('to')||new Date().toISOString().slice(0,10);
        const defaultFrom=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
        const from=url.searchParams.get('from')||defaultFrom;
        const grouping=url.searchParams.get('group')||'day';
        if(!validDate(from)||!validDate(to)||!['day','week','month','year'].includes(grouping)||from>to)return send(res,400,{error:'Укажите корректный диапазон дат и группировку.'});
        const [counts, daily, popular, audience] = await Promise.all([
          pool.query(`SELECT (SELECT count(*) FROM app_accounts)::int AS accounts,(SELECT count(*) FROM app_projects)::int AS projects,(SELECT count(*) FROM app_votes)::int AS votes,(SELECT count(*) FROM app_records)::int AS records,(SELECT count(*) FROM app_analytics)::int AS events`),
          pool.query(`SELECT date_trunc($3,created_at)::date AS day,count(*) FILTER (WHERE event_name IN ('page_view','project_view'))::int AS views,count(DISTINCT visitor_id) FILTER (WHERE event_name IN ('page_view','project_view'))::int AS visitors,count(*) FILTER (WHERE event_name='signup')::int AS signups,count(*) FILTER (WHERE event_name='project_create')::int AS projects,count(*) FILTER (WHERE event_name='vote')::int AS votes,count(*) FILTER (WHERE event_name='ai_evaluation')::int AS ai_evaluations FROM app_analytics WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day') GROUP BY 1 ORDER BY 1`,[from,to,grouping]),
          pool.query(`SELECT project_id,count(*)::int AS views FROM app_analytics WHERE event_name='project_view' AND project_id IS NOT NULL AND created_at >= $1::date AND created_at < ($2::date + interval '1 day') GROUP BY project_id ORDER BY views DESC LIMIT 10`,[from,to]),
          pool.query(`SELECT count(*) FILTER (WHERE event_name IN ('page_view','project_view'))::int AS views,count(DISTINCT visitor_id) FILTER (WHERE event_name IN ('page_view','project_view'))::int AS visitors FROM app_analytics WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')`,[from,to]),
        ]);
        return send(res, 200, { counts: counts.rows[0], daily: daily.rows, popular: popular.rows, audience: audience.rows[0], range: { from, to, group: grouping } });
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/tables') return send(res, 200, { tables: Object.keys(configs) });
      const match = url.pathname.match(/^\/api\/admin\/table\/([a-z_]+)$/);
      if (req.method === 'GET' && match) {
        const table = match[1], config = configs[table]; if (!config) return send(res, 404, { error: 'Таблица не найдена.' });
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
        const result = await pool.query(`SELECT ${config.columns.join(',')} FROM ${table} ORDER BY ${Array.isArray(config.key) ? config.key[0] : config.key} LIMIT $1`, [limit]);
        return send(res, 200, { table, columns: config.columns, editable: config.editable, rows: result.rows, total: result.rowCount });
      }
      if (req.method === 'POST' && url.pathname === '/api/admin/update') {
        const input = await body(req), config = configs[input.table]; if (!config || !input.values || typeof input.values !== 'object') return send(res, 400, { error: 'Некорректная запись.' });
        const keys = tupleKey(config, input.key || {}), where = (Array.isArray(config.key) ? config.key : [config.key]).map((column, i) => `${column}=$${i + 1}`).join(' AND ');
        const changes = Object.entries(input.values).filter(([key]) => config.editable.includes(key)); if (!changes.length) return send(res, 400, { error: 'Нет доступных для изменения полей.' });
        const sets = changes.map(([key], i) => `${key}=$${keys.length + i + 1}`).join(', '), vals = changes.map(([key, value]) => ['profile','document','value'].includes(key) ? JSON.stringify(value) : value);
        const result = await pool.query(`UPDATE ${input.table} SET ${sets}${['app_accounts','app_projects','app_records'].includes(input.table) ? ', updated_at=now()' : ''} WHERE ${where} RETURNING ${config.columns.join(',')}`, [...keys, ...vals]);
        if (!result.rowCount) return send(res, 404, { error: 'Запись не найдена.' }); return send(res, 200, { row: result.rows[0] });
      }
      if (req.method === 'POST' && url.pathname === '/api/admin/delete') {
        const input = await body(req), config = configs[input.table]; if (!config) return send(res, 400, { error: 'Таблица не поддерживает удаление.' });
        if (input.table === 'schema_migrations') return send(res, 403, { error: 'Системная таблица версий миграций доступна только для просмотра.' });
        const keys = tupleKey(config, input.key || {}), keyColumns = Array.isArray(config.key) ? config.key : [config.key], where = keyColumns.map((column,i) => `${column}=$${i+1}`).join(' AND ');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          if (input.table === 'app_projects') await client.query('DELETE FROM app_votes WHERE project_id=$1', keys);
          const result = await client.query(`DELETE FROM ${input.table} WHERE ${where}`, keys);
          if (input.table === 'app_accounts') await client.query('DELETE FROM app_votes WHERE project_id NOT IN (SELECT id FROM app_projects)');
          await client.query('COMMIT'); return send(res, result.rowCount ? 200 : 404, { deleted: result.rowCount });
        } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      }
      return send(res, 404, { error: 'Маршрут не найден.' });
    } catch (error) { console.error('Admin request failed', error); return send(res, 500, { error: 'Операция не выполнена. Проверьте формат данных.' }); }
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    try { let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'; const file = path.resolve(staticRoot, relative); if (!file.startsWith(staticRoot + path.sep)) return send(res, 403, { error: 'Forbidden' }); const data = await readFile(file); res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' }); return req.method === 'HEAD' ? res.end() : res.end(data); }
    catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Not Found'); }
  }
  return send(res, 404, { error: 'Not found' });
});
server.listen(port, '0.0.0.0', () => console.log(`Admin site listening on ${port}`));
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, async () => { server.close(); await pool.end(); process.exit(0); });
