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
const { default: translate } = await import('../.netlify/functions/translate.mjs');

test('startup content translation preserves item order and validates bounded input', async () => {
  globalThis.fetch = async (url, options) => { assert.equal(url,'https://inference.example.test/v1/chat/completions'); return new Response(JSON.stringify({ choices:[{message:{content:'["A useful product description", "A customer problem"]'}}] }), {status:200}); };
  const response=await translate(new Request('https://example.test/api/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:'en',texts:['Полезное описание продукта','Проблема клиента']})}));
  assert.equal(response.status,200); assert.deepEqual((await response.json()).translations,['A useful product description','A customer problem']);
  const invalid=await translate(new Request('https://example.test/api/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language:'xx',texts:['x']})}));
  assert.equal(invalid.status,400);
});

test('startup page enforces responsive markdown and contrast-aware project colors', async () => {
  const project=await readFile(path.join(root,'project-page.js'),'utf8'), css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(project,/luminance>\.42/); assert.match(project,/dataset\.projectSurface/); assert.match(project,/translateProjectContent/);
  assert.match(css,/\.markdown-rendered pre[^}]*overflow:auto/); assert.match(css,/overflow-wrap:anywhere/); assert.match(css,/data-site-theme="light"\] \.hero h1/);
});

test('startup upload accepts larger promo clips while enforcing 8 MB per video and 10 MB total', async () => {
  const upload=await readFile(path.join(root,'site-enhancements.js'),'utf8'), detail=await readFile(path.join(root,'project-page.js'),'utf8');
  assert.match(upload,/file\.size>8\*1024\*1024/); assert.match(upload,/existingBytes\+addedBytes>10\*1024\*1024/); assert.match(upload,/localStorage\.setItem\('buro-startapov-projects-v1'.*catch\{\}location\.href/);
  assert.match(detail,/files\.some\(file=>file\.type\.startsWith\('video\/'\)&&file\.size>8\*1024\*1024\)/); assert.match(detail,/>10\*1024\*1024/);
});

test('admin analytics supports visitor counts across date ranges and day/week/month/year buckets', async () => {
  const admin=await readFile(path.join(root,'render/admin-server.mjs'),'utf8'), server=await readFile(path.join(root,'render-server.mjs'),'utf8'), settings=await readFile(path.join(root,'site-settings.js'),'utf8'), html=await readFile(path.join(root,'admin/index.html'),'utf8'), app=await readFile(path.join(root,'admin/app.js'),'utf8'), migration=await readFile(path.join(root,'netlify/database/migrations/0005_visitor_analytics/migration.sql'),'utf8');
  for(const group of ['day','week','month','year'])assert.match(html,new RegExp(`value="${group}"`));
  assert.match(settings,/site-analytics-visitor-id/); assert.match(server,/visitor_id\) VALUES/); assert.match(migration,/ADD COLUMN IF NOT EXISTS visitor_id TEXT/);
  assert.match(admin,/count\(DISTINCT visitor_id\)/); assert.match(admin,/date_trunc\(\$3,created_at\)/); assert.match(admin,/\['day','week','month','year'\]/); assert.match(html,/analytics-from/); assert.match(html,/analytics-to/); assert.match(app,/УНИКАЛЬНЫЕ ПОСЕТИТЕЛИ/);
});

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

test('site settings include persistent RU/EN language control and metrics with monochrome theme', async () => {
  const js=await readFile(path.join(root,'site-settings.js'),'utf8');
  const html=await readFile(path.join(root,'index.html'),'utf8');
  assert.doesNotMatch(js,/id="site-theme"|themeSelect/); assert.match(js,/site-language/); assert.match(js,/localStorage\.setItem\(settingKey/); assert.match(js,/dataset\.siteTheme = 'dark'/);
  const css=await readFile(path.join(root,'enhancements.css'),'utf8'); assert.match(css,/--green:#f0f0f1/); assert.match(css,/\.header-account-avatar/); assert.match(css,/\.profile-avatar/); assert.match(css,/\.investor-card/);
  assert.match(js,/page_view/); assert.match(js,/project_view/); assert.match(html,/site-settings\.css/); assert.match(html,/site-settings\.js/);
});

test('evaluations are attached to the saved public project document and its details page', async () => {
  const save=await readFile(path.join(root,'site-enhancements.js'),'utf8');
  const details=await readFile(path.join(root,'project-page.js'),'utf8');
  assert.match(save,/\?\{aiEvaluation\}:\{\}/);
  assert.match(details,/project\.aiEvaluation/);
  assert.match(details,/root\.dataset\.aiEvaluation/);
});

test('Firebase auth verifies email and requires a Firebase email link on untrusted devices', async () => {
  const auth=await readFile(path.join(root,'firebase-auth.js'),'utf8');
  const db=await readFile(path.join(root,'.netlify/functions/database.mjs'),'utf8');
  const migration=await readFile(path.join(root,'netlify/database/migrations/0004_email_auth/migration.sql'),'utf8');
  const firebaseMigration=await readFile(path.join(root,'netlify/database/migrations/0006_firebase_auth/migration.sql'),'utf8');
  const settings=await readFile(path.join(root,'account-settings.js'),'utf8');
  const login=await readFile(path.join(root,'login.html'),'utf8');
  const register=await readFile(path.join(root,'register.html'),'utf8');
  const renderServer=await readFile(path.join(root,'render-server.mjs'),'utf8');
  assert.match(auth,/sendEmailVerification/); assert.match(auth,/sendSignInLinkToEmail/); assert.match(auth,/signInWithEmailLink/); assert.match(auth,/confirmedDeviceId/);
  assert.match(db,/accounts:lookup/); assert.match(db,/firebase-device-finish/); assert.match(db,/app_trusted_devices/);
  assert.match(migration,/app_auth_challenges/); assert.match(migration,/email_verified_at/); assert.match(firebaseMigration,/firebase_uid TEXT/);
  assert.match(renderServer,/0006_firebase_auth/); assert.match(register,/type="module" src="firebase-auth\.js"/);
  assert.match(settings,/account-avatar-trigger/); assert.match(login,/href="register\.html"[^>]*>Нет аккаунта\?/);
});

test('startup media ordering rerenders cards and README markdown uses a sanitizer', async () => {
  const enhancements=await readFile(path.join(root,'site-enhancements.js'),'utf8');
  const renderer=await readFile(path.join(root,'markdown-renderer.js'),'utf8');
  const projectHtml=await readFile(path.join(root,'project.html'),'utf8');
  assert.match(enhancements,/\[media\[i\],media\[j\]\]=\[media\[j\],media\[i\]\];renderMedia\(\)/);
  assert.match(renderer,/marked\.parse\(text/); assert.match(renderer,/DOMPurify\.sanitize/);
  assert.match(projectHtml,/vendor\/marked\.umd\.js/); assert.match(projectHtml,/vendor\/purify\.min\.js/);
});

test('Render serves support requests through the deployed language-aware handler', async () => {
  const server=await readFile(path.join(root,'render-server.mjs'),'utf8');
  const support=await readFile(path.join(root,'.netlify/functions/support.mjs'),'utf8');
  assert.match(server,/import supportHandler from '\.\/\.netlify\/functions\/support\.mjs'/);
  assert.match(server,/if \(url\.pathname === '\/api\/support'\)[\s\S]*?supportHandler\(/);
  assert.match(support,/payload\.language === 'en'/);
});

test('English dictionary covers Russian strings rendered in the page templates', async () => {
  const htmlFiles=(await import('node:fs/promises')).readdir(root);
  const dictionary=JSON.parse(await readFile(path.join(root,'deliverables/translations-en.json'),'utf8'));
  const parse5=await import('parse5');
  const missing=new Set();
  const visit=node=>{
    if(node.nodeName==='#text'){const value=node.value.trim();if(value&&/[А-Яа-яЁё]/.test(value)&&!dictionary[value])missing.add(value);}
    for(const attr of node.attrs||[]) if(['placeholder','title','aria-label','alt','content'].includes(attr.name)&&/[А-Яа-яЁё]/.test(attr.value.trim())&&!dictionary[attr.value.trim()])missing.add(attr.value.trim());
    for(const child of node.childNodes||[])visit(child);
  };
  for(const file of (await htmlFiles).filter(name=>name.endsWith('.html')))visit(parse5.parse(await readFile(path.join(root,file),'utf8')));
  assert.deepEqual([...missing],[]);
  for(const file of (await htmlFiles).filter(name=>name.endsWith('.html'))){const source=await readFile(path.join(root,file),'utf8');if(source.includes('site-settings.js'))assert.match(source,/translations-en\.js/);}
});
