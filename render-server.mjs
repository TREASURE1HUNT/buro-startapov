import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import handler from './.netlify/functions/database.mjs';
import { closeDatabase, getDatabase } from './render/postgres-adapter.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 10000);

async function migrate() {
  const db = getDatabase();
  await db.sql`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  const version = '0001_core';
  if ((await db.sql`SELECT version FROM schema_migrations WHERE version=${version}`).length) return;
  const sql = await readFile(path.join(root, 'netlify/database/migrations/0001_core/migration.sql'), 'utf8');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    try {
      await getDatabase().sql`SELECT 1`;
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, database: 'connected' }));
    } catch { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"ok":false}'); }
  }
  if (!req.url?.startsWith('/api/database')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"Not found"}'); }
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
