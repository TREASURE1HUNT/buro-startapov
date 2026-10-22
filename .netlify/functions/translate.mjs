const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let input; try { input = await request.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
  const texts = input?.texts, language = input?.language === 'en' ? 'English' : input?.language === 'ru' ? 'Russian' : '';
  if (!language || !Array.isArray(texts) || !texts.length || texts.length > 60 || texts.some(t => typeof t !== 'string' || t.length > 1400) || texts.join('').length > 12000) return json(400, { error: 'Invalid translation batch' });
  const key = process.env.INFERENCE_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return json(503, { error: 'Translation service is not configured' });
  try {
    const base=(process.env.INFERENCE_BASE_URL || (process.env.INFERENCE_API_KEY || key.startsWith('dahl_') ? 'https://inference.dahl.global/v1' : 'https://api.openai.com/v1')).replace(/\/$/,'');
    const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.INFERENCE_MODEL || 'zai-org/GLM-5.3-Flash', temperature: 0.1, messages: [{ role: 'system', content: `Translate each input string into ${language}. Preserve technical names, URLs and product names. Return only a JSON array of strings in the exact same order and length.` }, { role: 'user', content: JSON.stringify(texts) }] }) });
    const result = await response.json(); if (!response.ok) return json(502, { error: 'Translation provider error' });
    const content = String(result.choices?.[0]?.message?.content || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const translated = JSON.parse(content);
    if (!Array.isArray(translated) || translated.length !== texts.length || translated.some(t => typeof t !== 'string')) return json(502, { error: 'Invalid translation response' });
    return json(200, { translations: translated });
  } catch { return json(502, { error: 'Translation service is temporarily unavailable' }); }
}
