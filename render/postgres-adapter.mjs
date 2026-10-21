import pg from 'pg';

const { Pool } = pg;
let pool;

export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the Render Postgres connection.');
  pool ||= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX || 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  return { sql: query };
}

async function query(strings, ...values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
  return (await pool.query(text, values)).rows;
}

export async function closeDatabase() {
  if (pool) { const current = pool; pool = undefined; await current.end(); }
}
