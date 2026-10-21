const configuredKey = process.env.INFERENCE_API_KEY || process.env.OPENAI_API_KEY;
const isDahl = Boolean(process.env.INFERENCE_API_KEY) || configuredKey?.startsWith('dahl_');
const base = (process.env.INFERENCE_BASE_URL || (isDahl ? 'https://inference.dahl.global/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
const model = process.env.INFERENCE_MODEL || process.env.OPENAI_MODEL || (isDahl ? 'zai-org/GLM-5.3-Flash' : 'gpt-4.1-mini');
const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!configuredKey) return json({ error: 'ИИ-помощник не настроен: добавьте INFERENCE_API_KEY в переменные Netlify.' }, 503);
  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Некорректный JSON.' }, 400); }
  if (typeof payload.message !== 'string' || !payload.message.trim() || payload.message.length > 3000) return json({ error: 'Введите вопрос до 3000 символов.' }, 400);
  const history = Array.isArray(payload.history) ? payload.history.slice(-20).filter(item => item && ['user','assistant'].includes(item.role) && typeof item.content === 'string').map(item => ({ role:item.role, content:item.content.slice(0,3000) })) : [];
  try {
    const response = await fetch(base + '/chat/completions', { method:'POST', headers:{ authorization:'Bearer '+configuredKey, 'content-type':'application/json' }, body:JSON.stringify({ model, temperature:.3, max_tokens:2048, messages:[{ role:'system', content:'Ты — ИИ-помощник Бюро стартапов. Помогай с гипотезами, аккаунтом, созданием проекта и следующим шагом. Методика: 25% ИИ, 25% наставник, 50% сообщество. Отвечай по-русски, по делу. Если пользователь спрашивает, как пользоваться разделом сайта, объясни путь внутри интерфейса.' }, ...history, { role:'user', content:payload.message }] }) });
    let data; try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) return json({ error:response.status===401 ? 'Ключ ИИ не принят. Проверьте INFERENCE_API_KEY в Netlify.' : data.error?.message || 'Ошибка inference API' }, 502);
    return json({ answer:data.choices?.[0]?.message?.content || 'Пустой ответ модели.' });
  } catch (error) { return json({ error:error.message || 'Ошибка ИИ-поддержки.' }, 502); }
}
