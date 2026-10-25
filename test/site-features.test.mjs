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

test('site settings include persistent RU/EN language control and the dark ocean palette', async () => {
  const js=await readFile(path.join(root,'site-settings.js'),'utf8');
  const html=await readFile(path.join(root,'index.html'),'utf8');
  assert.doesNotMatch(js,/id="site-theme"|themeSelect/); assert.match(js,/site-language/); assert.match(js,/localStorage\.setItem\(settingKey/); assert.match(js,/dataset\.siteTheme = 'dark'/);
  const css=await readFile(path.join(root,'enhancements.css'),'utf8'); assert.match(css,/--brand-teal:#706DFF!important/); assert.match(css,/--brand-violet:#8281CC!important/); assert.match(css,/--brand-surface:#4F4F66!important/); assert.match(css,/--brand-muted:#C4C3D7!important/); assert.match(css,/\.header-account-avatar/); assert.match(css,/\.profile-avatar/); assert.match(css,/\.investor-card/); assert.doesNotMatch(css,/filter:grayscale\(1\)!important/); assert.match(css,/img,video,picture[^}]*filter:none!important/);
  assert.match(css,/html\[data-site-theme\] \.leader-panel,html\[data-site-theme\] \.leaderboard-table,html\[data-site-theme\] \.leaderboard\{background:transparent!important/); assert.match(css,/html\[data-site-theme\] \.community-card\{background:#FFFFFF!important/);
  const home=await readFile(path.join(root,'index.html'),'utf8'); assert.doesNotMatch(home,/class="academy-console"/); assert.match(css,/\.project-detail-main,\.project-detail-score/);
  assert.match(js,/page_view/); assert.match(js,/project_view/); assert.match(html,/site-settings\.css/); assert.match(html,/site-settings\.js/);
});

test('signed-in header hides account signup and always exposes investors navigation', async () => {
  const js=await readFile(path.join(root,'account-ui.js'),'utf8');
  assert.match(js,/\.nav a\[href="register\.html"\]/); assert.match(js,/investors\.html/); assert.match(js,/nav\.insertBefore\(investors,create\|\|null\)/);
});

test('account profile separates settings and owned startups into neutral tabs', async () => {
  const settings=await readFile(path.join(root,'account-settings.js'),'utf8');
  const css=await readFile(path.join(root,'enhancements.css'),'utf8');
  const translations=await readFile(path.join(root,'translations-en.js'),'utf8');
  assert.match(settings,/account-tabs/); assert.match(settings,/Настройки аккаунта/); assert.match(settings,/Мои стартапы/);
  assert.match(settings,/aria-selected/); assert.match(settings,/my-startups-panel/);
  assert.match(css,/\.account-tabs \[role="tab"\]\[aria-selected="true"\]\{border-bottom-color:#e5e5e7\}/);
  assert.match(css,/\.my-startups-panel\{[^}]*background:#101011/); assert.match(translations,/Мои стартапы':'My startups/);
});

test('homepage community block replaces washed-out project links with readable community cards', async () => {
  const home=await readFile(path.join(root,'index.html'),'utf8'),css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(home,/community-section/); assert.match(home,/Создавайте вместе с/); assert.match(home,/community-grid/); assert.match(home,/community-card/); assert.doesNotMatch(home,/Открыть ленту проектов|academy-module|Путь к/); assert.ok(home.indexOf('community-section')<home.indexOf('academy-proof'));
  assert.match(css,/\.community-section[^}]*background:#0a0a0d!important/); assert.match(css,/\.community-card p\{[^}]*color:#b8b8c0!important/); assert.match(css,/@media\(max-width:760px\)\{\.community-section/);
});

test('homepage program illustrations stay flat and subdued without bright highlights', async () => {
  const css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(css,/\.academy-module\.module-active,.academy-module\.module-active:hover\{background:#101011!important;box-shadow:none!important\}/);
  assert.match(css,/\.art-observe,\.art-validate,\.art-build,\.art-grow\{background:#101011!important\}/);
  assert.match(css,/\.art-bars i\{background:#66666a!important;box-shadow:none!important\}/);
});

test('evaluations are attached to the saved public project document and its details page', async () => {
  const save=await readFile(path.join(root,'site-enhancements.js'),'utf8');
  const details=await readFile(path.join(root,'project-page.js'),'utf8');
  assert.match(save,/\?\{aiEvaluation\}:\{\}/);
  assert.match(details,/project\.aiEvaluation/);
  assert.match(details,/root\.dataset\.aiEvaluation/);
});

test('Firebase auth confirms email with a site code and requires a Firebase email link on untrusted devices', async () => {
  const auth=await readFile(path.join(root,'firebase-auth.js'),'utf8');
  const db=await readFile(path.join(root,'.netlify/functions/database.mjs'),'utf8');
  const migration=await readFile(path.join(root,'netlify/database/migrations/0004_email_auth/migration.sql'),'utf8');
  const firebaseMigration=await readFile(path.join(root,'netlify/database/migrations/0006_firebase_auth/migration.sql'),'utf8');
  const settings=await readFile(path.join(root,'account-settings.js'),'utf8');
  const login=await readFile(path.join(root,'login.html'),'utf8');
  const register=await readFile(path.join(root,'register.html'),'utf8');
  const renderServer=await readFile(path.join(root,'render-server.mjs'),'utf8');
  assert.doesNotMatch(auth,/sendEmailVerification/); assert.match(auth,/action: 'register'/); assert.match(auth,/verify-email/); assert.doesNotMatch(auth,/createUserWithEmailAndPassword/); assert.match(auth,/firebase-email-start/); assert.match(auth,/firebase-email-finish/); assert.match(auth,/sendSignInLinkToEmail/); assert.match(auth,/signInWithEmailLink/); assert.match(auth,/confirmedDeviceId/);
  assert.match(db,/accounts:lookup/); assert.match(db,/firebase-device-finish/); assert.match(db,/app_trusted_devices/);
  assert.match(migration,/app_auth_challenges/); assert.match(migration,/email_verified_at/); assert.match(firebaseMigration,/firebase_uid TEXT/);
  assert.match(renderServer,/0006_firebase_auth/); assert.match(register,/type="module" src="firebase-auth\.js(?:\?[^\"]+)?"/);
  assert.match(settings,/account-avatar-trigger/); assert.match(login,/href="register\.html"[^>]*>Нет аккаунта\?/);
});

test('startup media ordering rerenders cards and README markdown uses a sanitizer', async () => {
  const enhancements=await readFile(path.join(root,'site-enhancements.js'),'utf8');
  const renderer=await readFile(path.join(root,'markdown-renderer.js'),'utf8');
  const details=await readFile(path.join(root,'project-page.js'),'utf8');
  const projectHtml=await readFile(path.join(root,'project.html'),'utf8');
  assert.doesNotThrow(()=>new Function(renderer)); assert.doesNotThrow(()=>new Function(details));
  assert.match(enhancements,/\[media\[i\],media\[j\]\]=\[media\[j\],media\[i\]\];renderMedia\(\)/);
  assert.match(renderer,/marked\.parse\(text/); assert.match(renderer,/DOMPurify\.sanitize/);
  assert.match(renderer,/raw\.githubusercontent\.com/); assert.match(renderer,/context\.githubUrl/); assert.match(renderer,/loading', 'lazy'/);
  assert.match(details,/markdownContext = \{ githubUrl:/);
  const css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(css,/\.project-art\.has-cover-media\{padding:0!important/);
  assert.match(css,/\.markdown-rendered img\{border:1px solid #343438!important/);
  assert.match(css,/\.markdown-rendered p,.project-detail-main \.markdown-rendered li[^}]*color:#d4d4d7!important/);
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

test('project workspace library and history remain wired with the animated luminous ribbon background', async () => {
  const create=await readFile(path.join(root,'create.html'),'utf8'),lib=await readFile(path.join(root,'project-library.js'),'utf8'),motion=await readFile(path.join(root,'site-motion.js'),'utf8'),index=await readFile(path.join(root,'index.html'),'utf8'),css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(create,/data-workspace-tab="library"/);assert.match(create,/data-workspace-tab="history"/);assert.match(create,/data-workspace-tab="create"/);assert.match(lib,/api\/database\?action=projects/);assert.match(lib,/delete-project/);assert.match(lib,/buro-project-history-v1/);assert.match(index,/Создать проект/);assert.match(motion,/anime\?\.animate/);assert.match(motion,/prefers-reduced-motion/);assert.match(motion,/pathY\(u, lane, time\)/);assert.match(motion,/ctx\.stroke\(\)/);assert.match(css,/\.ocean-wave-canvas/);assert.match(css,/--brand-bg:#09090F/); assert.match(css,/body\{background:#09090F!important;color:#FFFFFF!important\}/); assert.match(motion,/lane < 80/); assert.match(motion,/height \* \.0065/);assert.doesNotMatch(create,/value="#b8f548"/);
});

test('leaderboard panel is transparent and email confirmation uses the on-site code flow', async () => {
  const css=await readFile(path.join(root,'enhancements.css'),'utf8'),auth=await readFile(path.join(root,'firebase-auth.js'),'utf8'),db=await readFile(path.join(root,'.netlify/functions/database.mjs'),'utf8'),motion=await readFile(path.join(root,'site-motion.js'),'utf8');
  assert.match(css,/\.leader-panel\{background:transparent!important;border-color:transparent!important/);
  assert.doesNotMatch(css,/filter:grayscale\(1\)!important/); assert.match(css,/--brand-teal:#706DFF!important/); assert.match(css,/--brand-violet:#8281CC!important/); assert.match(css,/--brand-surface:#4F4F66!important/); assert.match(css,/--brand-muted:#C4C3D7!important/); assert.match(motion,/pathY\(u, lane, time\)/);
  assert.match(auth,/action: 'register'/); assert.match(auth,/verify-email/); assert.doesNotMatch(auth,/createUserWithEmailAndPassword/);
  assert.match(auth,/action: 'firebase-email-start'/); assert.match(auth,/firebase-email-finish/); assert.doesNotMatch(auth,/sendEmailVerification/);
  assert.match(db,/body\.action === 'firebase-email-start'/); assert.match(db,/body\.action === 'firebase-email-finish'/); assert.match(db,/purpose: 'email'/); assert.match(db,/firebase-verify/); assert.match(db,/COALESCE\(email_verified_at,now\(\)\)/);
});

test('site uses the supplied periwinkle palette with the animated ocean and renders animated palette ribbons instead of route lines', async () => {
  const motion=await readFile(path.join(root,'site-motion.js'),'utf8'),css=await readFile(path.join(root,'enhancements.css'),'utf8'),settings=await readFile(path.join(root,'site-settings.js'),'utf8'),settingsCss=await readFile(path.join(root,'site-settings.css'),'utf8');
  assert.match(settings,/dataset\.siteTheme = 'dark'/); assert.match(motion,/pathY\(u, lane, time\)/); assert.match(motion,/palette = \[.*#706DFF/); assert.match(motion,/ctx\.stroke\(\)/); assert.match(motion,/requestAnimationFrame\(draw\)/); assert.doesNotMatch(motion,/route-branch|route-wave-purple/);
  assert.match(css,/--brand-bg:#09090F/); assert.match(css,/body\{background:#09090F!important;color:#FFFFFF!important\}/); assert.match(motion,/lane < 80/); assert.match(motion,/height \* \.0065/); assert.match(css,/--brand-surface:#4F4F66/); assert.match(css,/--brand-text:#FFFFFF/); assert.match(css,/--brand-muted:#C4C3D7/); assert.match(css,/project-detail-score\{background:transparent!important/); assert.match(css,/body main :is\(h1,h2,h3,h4,p,label,small,span,b,strong,li,td,th,legend,summary,dt,dd,figcaption\)/); assert.match(css,/\.leader-row\{padding-block:24px!important;background:transparent!important\}/); assert.match(css,/\.showcase-stage\{border:0!important;box-shadow:none!important;background:transparent!important\}/); assert.match(css,/investor-empty-cta,html\[data-site-theme="dark"\] \.investor-row\{background:transparent!important/); assert.match(css,/\.ocean-wave-canvas/); assert.match(css,/\.academy-route-art\{display:none!important\}/); assert.match(settingsCss,/site-preferences-panel,html\[data-site-theme="dark"\] \.site-preferences-panel select/); assert.match(settingsCss,/html\[data-site-theme="dark"\] \.ai-result\{background:#35354D/);
});

test('ocean canvas respects reduced-motion and keeps the old route network hidden', async () => {
  const motion=await readFile(path.join(root,'site-motion.js'),'utf8'),css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(motion,/prefers-reduced-motion/);assert.match(motion,/createElement\('canvas'\)/);assert.match(motion,/const reduced/);assert.match(css,/\.academy-route-art\{display:none!important\}/);assert.match(css,/\.ocean-wave-canvas\{position:fixed!important/);
});

test('site logo and favicon use the bird mark', async () => {
  const index=await readFile(path.join(root,'index.html'),'utf8'),favicon=await readFile(path.join(root,'favicon.svg'),'utf8');
  assert.match(index,/svg class="brand-mark" viewBox="0 0 40 28"/); assert.doesNotMatch(index,/class="brand-mark"><i>/); assert.match(favicon,/<svg[^>]*viewBox="0 0 40 28"/); assert.match(favicon,/#706DFF/);
});

test('personal library filters by current owner and favorites are saved and exposed in the profile', async () => {
  const lib=await readFile(path.join(root,'project-library.js'),'utf8'),catalog=await readFile(path.join(root,'project-catalog.js'),'utf8'),profile=await readFile(path.join(root,'account-settings.js'),'utf8'),settings=await readFile(path.join(root,'site-settings.js'),'utf8');
  assert.match(lib,/ownerEmail \|\| ''\)\.toLowerCase\(\) === String\(sessionUser\.email/);assert.match(catalog,/buro-favorite-projects-v1/);assert.match(catalog,/data-favorite-id/);assert.match(profile,/favorite-startups-panel/);assert.match(profile,/account-tab-favorites/);assert.match(settings,/aria-hidden="true">文<\/span><\/button><section/);assert.doesNotMatch(settings,/site-preferences-caption|<b>Язык/);
});
