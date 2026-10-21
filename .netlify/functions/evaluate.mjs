const configuredKey = process.env.INFERENCE_API_KEY || process.env.OPENAI_API_KEY;
const isDahl = Boolean(process.env.INFERENCE_API_KEY) || configuredKey?.startsWith('dahl_');
const base = (process.env.INFERENCE_BASE_URL || (isDahl ? 'https://inference.dahl.global/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
const model = process.env.INFERENCE_MODEL || process.env.OPENAI_MODEL || (isDahl ? 'zai-org/GLM-5.3-Flash' : 'gpt-4.1-mini');
const rubric = [
  ['problem', 'Ясность и масштаб проблемы', 20],
  ['demand', 'Подтверждение спроса', 20],
  ['customer', 'Конкретность целевой аудитории', 15],
  ['solution', 'Ценность и отличие решения', 15],
  ['business', 'Путь к устойчивой экономике', 15],
  ['execution', 'Соответствие стадии и качество доказательств', 15],
];
const clampText = (value, max = 1200) => String(value || '').trim().slice(0, max);
const validScore = value => Number.isInteger(value) && value >= 0 && value <= 100;
const error = (message, status) => Response.json({ error: message }, { status });

export default async function handler(req) {
  if (req.method !== 'POST') return error('Method not allowed', 405);
  if (!configuredKey) return error('Добавьте INFERENCE_API_KEY в переменные окружения API.', 503);
  let input;
  try { input = await req.json(); } catch { return error('Некорректный JSON.', 400); }
  const project = Object.fromEntries(['name', 'category', 'stage', 'problem', 'audience', 'value', 'description', 'businessModel', 'markets', 'technologies', 'fundingAsk', 'fundingCurrency', 'fundingGoal', 'teamName', 'teamResponsibility', 'news'].map(key => [key, clampText(input[key])]));
  for (const field of ['name', 'category', 'stage', 'problem', 'audience', 'value']) if (!project[field]) return error('Заполните название, направление, стадию, проблему, аудиторию и ценность проекта.', 400);
  const criterionShape = Object.fromEntries(rubric.map(([key]) => [key, { score: 0, evidence: '', gap: '' }]));
  const system = `Ты — аналитик ранних стартапов. Оценивай ТОЛЬКО данные из карточки, не придумывай рынок, клиентов, выручку, конкурентов или результаты. Если подтверждений нет, прямо укажи «не представлено» и снижай demand/evidence. Отличай проверенный факт от заявления команды. Верни ТОЛЬКО корректный JSON без markdown по схеме: {"criteria":${JSON.stringify(criterionShape)},"strengths":["..."],"risks":["..."],"next_steps":["..."],"missing_evidence":["..."],"summary":"..."}. В каждом критерии score — целое 0..100; evidence — что конкретно найдено в описании, gap — чего не хватает. strengths/risks/next_steps/missing_evidence — от 1 до 4 коротких пунктов, все предметные и привязанные к карточке. Если данных мало, не заполняй пробелы оптимистичными допущениями. Ответ на русском.`;
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${configuredKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.1, max_tokens: 1800, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(project) }] }),
    });
    const data = await response.json();
    if (!response.ok) return error(data.error?.message || 'Ошибка inference API', 502);
    const raw = data.choices?.[0]?.message?.content || '';
    const result = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!result.criteria || rubric.some(([key]) => !validScore(result.criteria[key]?.score))) throw new Error('ИИ вернул неполную оценку по критериям. Повторите анализ.');
    for (const [key] of rubric) {
      result.criteria[key].evidence = clampText(result.criteria[key].evidence, 400);
      result.criteria[key].gap = clampText(result.criteria[key].gap, 400);
    }
    const score = Math.round(rubric.reduce((sum, [key, , weight]) => sum + result.criteria[key].score * weight / 100, 0));
    const list = key => Array.isArray(result[key]) ? result[key].slice(0, 4).map(item => clampText(item, 260)) : [];
    return Response.json({ score, rubric: rubric.map(([key, label, weight]) => ({ key, label, weight, ...result.criteria[key] })), summary: clampText(result.summary, 500), strengths: list('strengths'), risks: list('risks'), next_steps: list('next_steps'), missing_evidence: list('missing_evidence'), model, weight: 25, updatedAt: new Date().toISOString(), source: 'inference' });
  } catch (cause) {
    return error(cause.message || 'Не удалось оценить проект.', 502);
  }
}
