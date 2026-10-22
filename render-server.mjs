import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import handler from './.netlify/functions/database.mjs';
import evaluateHandler from './.netlify/functions/evaluate.mjs';
import { closeDatabase, getDatabase } from './render/postgres-adapter.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 10000);
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.ico': 'image/x-icon' };

async function migrate() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('buro-startapov-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const version of ['0001_core', '0002_analytics', '0003_unicornbase_seed', '0004_email_auth']) {
      const applied = await client.query('SELECT version FROM schema_migrations WHERE version=$1', [version]);
      if (!applied.rows.length) {
        const sql = await readFile(path.join(root, `netlify/database/migrations/${version}/migration.sql`), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && req.url === '/health') {
    try {
      await getDatabase().sql`SELECT 1`;
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, database: 'connected' }));
    } catch { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"ok":false}'); }
  }
  if (url.pathname === '/api/analytics' && req.method === 'POST') {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const allowed = new Set(['page_view', 'project_view', 'signup', 'project_create', 'vote', 'ai_evaluation']);
      const event = String(data.event || '');
      if (!allowed.has(event)) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end('{"error":"Invalid event"}'); }
      const projectId = /^[\p{L}\p{N}_-]{1,100}$/u.test(String(data.projectId || '')) ? String(data.projectId) : null;
      const route = String(data.route || '/').slice(0, 160).replace(/[?#].*$/, '');
      await getDatabase().sql`INSERT INTO app_analytics(event_name,route,project_id) VALUES(${event},${route},${projectId})`;
      res.writeHead(202, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end('{"ok":true}');
    } catch { res.writeHead(400, { 'content-type': 'application/json' }); return res.end('{"error":"Invalid analytics event"}'); }
  }
  if (url.pathname === '/api/evaluate') {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await evaluateHandler(new Request(`https://${req.headers.host || 'localhost'}${req.url}`, { method: req.method, headers: req.headers, body: Buffer.concat(chunks), duplex: 'half' }));
      if (response.ok) getDatabase().sql`INSERT INTO app_analytics(event_name,route,project_id) VALUES('ai_evaluation','/create',NULL)`.catch(() => {});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { console.error('AI evaluation failed:', error); res.writeHead(502, { 'content-type': 'application/json' }); return res.end('{"error":"Не удалось выполнить анализ стартапа."}'); }
  }
  if (['/api/support', '/api/community-votes'].includes(url.pathname)) {
    try {
      const chunks = [];
      if (req.method !== 'GET' && req.method !== 'HEAD') for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const upstream = await fetch(`https://buro-startapov.netlify.app${url.pathname}${url.search}`, {
        method: req.method,
        headers: { 'content-type': req.headers['content-type'] || 'application/json' },
        ...(body.length ? { body } : {}),
      });
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' });
      return res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { res.writeHead(502, { 'content-type': 'application/json' }); return res.end('{"error":"AI-сервис временно недоступен."}'); }
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!url.pathname.startsWith('/api/database')) {
      if (url.pathname.startsWith('/api/')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"Not found"}'); }
      try {
        let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (!relative || relative.endsWith('/')) relative += 'index.html';
        else if (!path.extname(relative)) relative += '.html';
        const file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(403); return res.end('Forbidden'); }
        const content = await readFile(file);
        res.writeHead(200, { 'content-type': mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
        return req.method === 'HEAD' ? res.end() : res.end(content);
      } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Not Found'); }
    }
  }
  if (!url.pathname.startsWith('/api/database')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"Not found"}'); }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(`https://${req.headers.host || 'buro-startapov-api.onrender.com'}${req.url}`, {
      method: req.method, headers: req.headers,
      ...(body.length && req.method !== 'GET' && req.method !== 'HEAD' ? { body, duplex: 'half' } : {}),
    });
    const response = await handler(request);
    const headers = {};
    response.headers.forEach((value, key) => { headers[key] = value; });
    const cookies = response.headers.getSetCookie?.();
    if (cookies?.length) headers['set-cookie'] = cookies;
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Database API request failed:', error);
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ error: 'Внутренняя ошибка API.' }));
  }
});

await migrate();
server.listen(port, '0.0.0.0', () => console.log(`Render database API listening on ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { server.close(); await closeDatabase(); process.exit(0); });
