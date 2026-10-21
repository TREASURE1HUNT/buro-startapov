import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

const validId = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const tally = voters => {
  const votes = Object.values(voters || {});
  return { up: votes.filter(v => v === 'up').length, down: votes.filter(v => v === 'down').length };
};

export const handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Используйте POST.' });
  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Некорректный JSON.' }); }
  const { projectId, email, browserId, vote } = input;
  if (!validId(projectId) || !(typeof email === 'string' && email.trim() || typeof browserId === 'string' && browserId)) return json(400, { error: 'Нужны projectId и идентификатор голосующего.' });
  if (vote !== undefined && vote !== null && vote !== 'up' && vote !== 'down') return json(400, { error: 'Голос должен быть up, down или null.' });

  const voter = email?.trim() ? `account:${email.trim().toLowerCase()}` : `browser:${browserId}`;
  const voterKey = createHash('sha256').update(voter).digest('hex');
  const store = getStore('buro-community-votes');
  const key = `project:${projectId}`;

  try {
    let voters = {};
    if (vote === undefined) {
      const data = await store.get(key, { type: 'json' });
      voters = data?.voters && typeof data.voters === 'object' ? data.voters : {};
      return json(200, { ...tally(voters), myVote: voters[voterKey] || null });
    }
    // ETag compare-and-swap prevents two simultaneous votes from overwriting one another.
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await store.getWithMetadata(key, { type: 'json' });
      voters = current?.data?.voters && typeof current.data.voters === 'object' ? current.data.voters : {};
      const next = { ...voters };
      if (vote === null || next[voterKey] === vote) delete next[voterKey];
      else next[voterKey] = vote;
      const result = await store.setJSON(key, { voters: next }, current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
      if (result.modified) return json(200, { ...tally(next), myVote: next[voterKey] || null });
    }
    return json(503, { error: 'Слишком много одновременных изменений. Повторите голосование.' });
  } catch (error) {
    console.error('community-votes error', error);
    return json(503, { error: 'Общее хранилище голосов пока недоступно.' });
  }
};
