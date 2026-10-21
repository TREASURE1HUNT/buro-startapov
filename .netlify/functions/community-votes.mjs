import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const validId = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const tally = voters => {
  const votes = Object.values(voters || {});
  return { up: votes.filter(v => v === 'up').length, down: votes.filter(v => v === 'down').length };
};

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Используйте POST.' }, 405);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Некорректный JSON.' }, 400); }
  const { projectId, email, browserId, vote } = input;
  if (!validId(projectId) || !(typeof email === 'string' && email.trim() || typeof browserId === 'string' && browserId)) return json({ error: 'Нужны projectId и идентификатор голосующего.' }, 400);
  if (vote !== undefined && vote !== null && vote !== 'up' && vote !== 'down') return json({ error: 'Голос должен быть up, down или null.' }, 400);

  const voter = email?.trim() ? `account:${email.trim().toLowerCase()}` : `browser:${browserId}`;
  const voterKey = createHash('sha256').update(voter).digest('hex');
  const store = getStore('buro-community-votes');
  const key = `project:${projectId}`;

  try {
    const data = await store.get(key, { type: 'json' });
    const voters = data?.voters && typeof data.voters === 'object' ? { ...data.voters } : {};
    if (vote !== undefined) {
      if (vote === null || voters[voterKey] === vote) delete voters[voterKey];
      else voters[voterKey] = vote;
      await store.setJSON(key, { voters });
    }
    return json({ ...tally(voters), myVote: voters[voterKey] || null });
  } catch (error) {
    console.error('community-votes error', error);
    return json({ error: 'Общее хранилище голосов пока недоступно.' }, 503);
  }
}
