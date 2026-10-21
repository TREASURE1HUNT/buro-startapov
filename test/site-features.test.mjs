import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.INFERENCE_API_KEY = 'test-token-not-for-production';
process.env.INFERENCE_BASE_URL = 'https://inference.example.test/v1';
process.env.INFERENCE_MODEL = 'test-model';
const { default: evaluate } = await import('../.netlify/functions/evaluate.mjs');

test('AI score is derived from six weighted criteria and returns evidence/gaps', async () => {
  const criteria = { problem:100, demand:90, customer:80, solution:70, business:60, execution:50 };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://inference.example.test/v1/chat/completions');
    assert.equal(options.headers.authorization, 'Bearer test-token-not-for-production');
    const prompt = JSON.parse(options.body).messages[0].content;
    assert.match(prompt, /не придумывай рынок/);
    return new Response(JSON.stringify({ choices:[{message:{content:JSON.stringify({
      criteria:Object.fromEntries(Object.entries(criteria).map(([key,score])=>[key,{score,evidence:'Текст карточки',gap:'Нет ссылки на проверку'}])),
      strengths:['Ясно описана проблема'],risks:['Нет проверки спроса'],next_steps:['Провести 10 интервью'],missing_evidence:['Результаты пилота'],summary:'Есть идея, но пока не показаны подтверждения спроса.'
    })}}]}), {status:200,headers:{'content-type':'application/json'}});
  };
  const response = await evaluate(new Request('https://site.test/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Тест',category:'SaaS',stage:'Идея',problem:'Проблема',audience:'Пользователи',value:'Решение'})}));
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.score,77);
  assert.equal(result.weight,25);
  assert.equal(result.rubric.length,6);
  assert.equal(result.rubric[0].weight,20);
  assert.equal(result.rubric[1].gap,'Нет ссылки на проверку');
  assert.deepEqual(result.next_steps,['Провести 10 интервью']);
});

test('AI evaluator validates required fields before contacting the model', async () => {
  const response = await evaluate(new Request('https://site.test/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Тест'})}));
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/Заполните/);
});

test('Render seed contains exactly twenty attributed public startup cards', async () => {
  const sql=await readFile(path.join(root,'netlify/database/migrations/0003_unicornbase_seed/migration.sql'),'utf8');
  const ids=[...sql.matchAll(/\('unicornbase-[a-z0-9-]+',\s*'\{"id":"(unicornbase-[a-z0-9-]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,20);
  assert.match(sql,/https:\/\/unicornbase\.ru\/startups/);
  assert.match(sql,/ON CONFLICT\(id\) DO NOTHING/);
});

test('site settings include persistent RU/EN and dark/light controls plus metrics', async () => {
  const js=await readFile(path.join(root,'site-settings.js'),'utf8');
  const html=await readFile(path.join(root,'index.html'),'utf8');
  assert.match(js,/site-theme/); assert.match(js,/site-language/); assert.match(js,/localStorage\.setItem\(settingKey/);
  assert.match(js,/page_view/); assert.match(js,/project_view/); assert.match(html,/site-settings\.css/); assert.match(html,/site-settings\.js/);
});

test('evaluations are attached to the saved public project document and its details page', async () => {
  const save=await readFile(path.join(root,'site-enhancements.js'),'utf8');
  const details=await readFile(path.join(root,'project-page.js'),'utf8');
  assert.match(save,/\?\{aiEvaluation\}:\{\}/);
  assert.match(details,/project\.aiEvaluation/);
  assert.match(details,/root\.dataset\.aiEvaluation/);
});
