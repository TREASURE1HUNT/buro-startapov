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
const { default: support } = await import('../.netlify/functions/support.mjs');

test('startup content translation preserves item order and validates bounded input', async () => {
  globalThis.fetch = async (url, options) => { assert.equal(url,'https://inference.example.test/v1/chat/completions'); return new Response(JSON.stringify({ choices:[{message:{content:'<think>Translate carefully.</think>\n["A useful product description", "A customer problem"]'}}] }), {status:200}); };
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

test('every public page applies the dark palette before stylesheets to prevent color flash', async () => {
  const pages=['index.html','projects.html','leaderboard.html','method.html','investors.html','create.html','profile.html','project.html','login.html','register.html'];
  for(const page of pages){
    const html=await readFile(path.join(root,page),'utf8');
    const bootstrap=html.indexOf("document.documentElement.dataset.siteTheme='dark'");
    const firstStylesheet=html.indexOf('<link rel="stylesheet"');
    assert.ok(bootstrap>=0,`${page} has early theme bootstrap`);
    assert.ok(firstStylesheet>=0&&bootstrap<firstStylesheet,`${page} sets palette before CSS`);
  }
});

test('public pages defer scripts and Render compresses and caches static assets', async () => {
  const pages=['index.html','projects.html','leaderboard.html','method.html','investors.html','create.html','profile.html','project.html','login.html','register.html'];
  for(const page of pages){
    const html=await readFile(path.join(root,page),'utf8');
    assert.doesNotMatch(html,/<script(?![^>]*\bdefer\b)(?=[^>]*\bsrc=)/,`${page} avoids parser-blocking scripts`);
  }
  const server=await readFile(path.join(root,'render-server.mjs'),'utf8');
  assert.match(server,/gzipSync\(content\)/);
  assert.match(server,/stale-while-revalidate=86400/);
  assert.match(server,/max-age=31536000, immutable/);
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

test('AI evaluator extracts valid JSON when a model wraps it in a thinking block', async () => {
  const keys=['problem','demand','customer','solution','business','execution'];
  const result={criteria:Object.fromEntries(keys.map(key=>[key,{score:70,evidence:'Данные проекта',gap:'Нужно подтвердить'}])),strengths:[],risks:[],next_steps:[],missing_evidence:[],summary:'Проверка'};
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:`<think>Let me reason through the request.</think>\n${JSON.stringify(result)}`}}]}),{status:200});
  const response=await evaluate(new Request('https://site.test/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Тест',category:'SaaS',stage:'Идея',problem:'Проблема',audience:'Клиенты',value:'Решение'})}));
  assert.equal(response.status,200); assert.equal((await response.json()).score,70);
});

test('AI support strips internal thinking blocks from user-facing answers', async () => {
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'<think>Private reasoning.</think>Вот краткий ответ.'}}]}),{status:200});
  const response=await support(new Request('https://site.test/api/support',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Что дальше?'})}));
  assert.equal(response.status,200); assert.equal((await response.json()).answer,'Вот краткий ответ.');
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

test('site settings provide gear menu, saved accessibility modes, screen-reader skip link and narration', async () => {
  const js=await readFile(path.join(root,'site-settings.js'),'utf8');
  const css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(js,/site-preferences-button[^>]*aria-label="Открыть настройки сайта"/);
  assert.match(js,/<svg viewBox="0 0 24 24"[^>]*aria-hidden="true"/);
  assert.match(js,/<path d="M6 9l6 6 6-6"\/><\/svg>/); assert.doesNotMatch(js,/m19\.4 13\.5/);
  assert.match(css,/The settings trigger is now a standalone down-chevron/); assert.match(css,/border:0!important;border-radius:0!important;background:transparent!important/);
  assert.match(css,/\.site-preferences-button svg\{display:block;width:20px!important;height:20px!important/);
  assert.match(js,/id="access-low-vision"/); assert.match(js,/id="access-color-vision"/); assert.match(js,/id="access-blind-mode"/);
  assert.match(js,/id="site-font-size"/); assert.match(js,/fontSize:100/); assert.match(js,/calc\(\$\{fontBaselines\.get\(element\)\}px \* var\(--site-font-scale/); assert.match(js,/fontSizeSelect\.addEventListener\('change'/); assert.match(js,/value="140">Очень большой/);
  assert.match(js,/preferences\.lowVision = lowVision\.checked/); assert.match(js,/preferences\.colorVision = colorVision\.checked/); assert.match(js,/preferences\.blindMode = blindMode\.checked/);
  assert.match(js,/speechSynthesis\.speak\(utterance\)/); assert.match(js,/speechSynthesis\?\.cancel\(\)/);
  assert.match(js,/accessibility-skip-link/); assert.match(js,/main\.tabIndex = -1/);
  assert.match(css,/data-accessibility-low-vision="true"/); assert.match(css,/data-accessibility-color-vision="true"/); assert.match(css,/data-screen-reader-assist="true"/);
  assert.match(css,/--cv-blue:#56B4E9/); assert.match(css,/repeating-linear-gradient\(135deg,var\(--cv-blue\)/); assert.match(css,/favorite-toggle\.is-favorite\{color:var\(--cv-orange\)/);
  assert.match(js,/accessibility-option-hint/);
  assert.match(css,/Full-site color-vision theme/); assert.match(css,/body\{background:#081A2B!important/); assert.match(css,/\.projects-section,\.community-section,\.academy-proof/); assert.match(css,/body :is\(input,textarea,select/);
  const translations=await readFile(path.join(root,'translations-en.js'),'utf8'); assert.match(translations,/Uses distinct colors and icons to communicate status/);
  assert.match(css,/\.accessibility-skip-link:focus/); assert.match(css,/\.accessibility-speech-controls/);
});

test('startup creation and AI review actions use clear, keyboard-visible button styles', async () => {
  const html=await readFile(path.join(root,'create.html'),'utf8');
  const enhancement=await readFile(path.join(root,'site-enhancements.js'),'utf8');
  const css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(html,/<button class="button" type="submit">Сохранить и открыть проект/);
  assert.match(html,/class="clear-button" type="button" id="clear-form"/);
  assert.match(html,/class="clear-button" id="ai-review" type="button"/);
  assert.match(enhancement,/class="clear-button full-project-preview-trigger"/);
  assert.match(css,/\.project-form \.form-actions \.clear-button/); assert.match(css,/\.project-form #ai-review/); assert.match(css,/\.full-project-preview-trigger:hover/);
  assert.match(css,/\.project-form :is\(\.form-actions button,#ai-review,#theme-reset,\.full-project-preview-trigger\):focus-visible/);
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

test('homepage primary action opens the projects catalog', async () => {
  const html=await readFile(path.join(root,'index.html'),'utf8');
  assert.match(html,/<a class="button" href="projects.html">Проекты <span>↗<\/span><\/a>/);
});

test('homepage community block replaces washed-out project links with readable community cards', async () => {
  const home=await readFile(path.join(root,'index.html'),'utf8'),css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(home,/community-section/); assert.match(home,/Создавайте<br>не в одиночку/); assert.match(home,/community-grid/); assert.match(home,/community-card/); assert.doesNotMatch(home,/Открыть ленту проектов|academy-module|Путь к/); assert.ok(home.indexOf('community-section')<home.indexOf('academy-proof'));
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

test('account signup and login work without email delivery or verification', async () => {
  const auth=await readFile(path.join(root,'firebase-auth.js'),'utf8');
  const db=await readFile(path.join(root,'.netlify/functions/database.mjs'),'utf8');
  assert.match(auth,/cacheState\(challenge\); show\(result, 'Аккаунт создан/);
  assert.doesNotMatch(auth,/legacyCodeStep\(register|firebase-email-start/);
  assert.match(auth,/data\.verificationRequired && data\.purpose === 'device-link'/);
  assert.match(auth,/sendSignInLinkToEmail\(auth, email, settings\)/);
  assert.match(db,/INSERT INTO app_accounts\(email,name,role,password_hash,password_salt,password_scheme,profile,email_verified_at\)/);
  assert.match(db,/await trustDevice\(email,deviceHash,deviceLabel\)/);
  assert.doesNotMatch(db,/await createAuthChallenge\(email,'register'/);
});

test('login device confirmation uses Firebase link and auth script cache is invalidated', async () => {
  const auth=await readFile(path.join(root,'firebase-auth.js'),'utf8');
  const database=await readFile(path.join(root,'.netlify/functions/database.mjs'),'utf8');
  const login=await readFile(path.join(root,'login.html'),'utf8');
  const register=await readFile(path.join(root,'register.html'),'utf8');
  assert.match(database,/purpose: 'device-link'/);
  assert.match(auth,/data\.verificationRequired && data\.purpose === 'device-link'/);
  assert.match(auth,/sendSignInLinkToEmail\(auth, email, settings\)/);
  assert.match(auth,/Ссылка для входа отправлена на/);
  assert.match(login,/firebase-auth\.js\?v=auth-no-signup-mail-login-link-3/);
  assert.match(register,/firebase-auth\.js\?v=auth-no-signup-mail-login-link-3/);
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
  assert.match(create,/data-workspace-tab="library"/);assert.match(create,/data-workspace-tab="history"/);assert.match(create,/data-workspace-tab="create"/);assert.match(lib,/api\/database\?action=projects/);assert.match(lib,/delete-project/);assert.match(lib,/buro-project-history-v1/);assert.match(index,/Создать проект/);assert.match(motion,/anime\?\.animate/);assert.match(motion,/prefers-reduced-motion/);assert.match(motion,/halfDepth = height \* \.25675/);assert.match(motion,/ctx\.fill\(\)/);assert.match(css,/\.ocean-wave-canvas/);assert.match(css,/--brand-bg:#09090F/); assert.match(css,/body\{background:#09090F!important;color:#FFFFFF!important\}/);assert.doesNotMatch(create,/value="#b8f548"/);
});

test('leaderboard panel remains transparent and email verification is disabled', async () => {
  const css=await readFile(path.join(root,'enhancements.css'),'utf8');
  const auth=await readFile(path.join(root,'firebase-auth.js'),'utf8');
  const db=await readFile(path.join(root,'.netlify/functions/database.mjs'),'utf8');
  assert.match(css,/\.leader-panel\{background:transparent!important;border-color:transparent!important/);
  assert.match(auth,/cacheState\(challenge\); show\(result, 'Аккаунт создан/);
  assert.match(db,/Подтверждение по почте отключено/);
  assert.match(db,/email_verified_at\) VALUES\(\$\{email\}.*now\(\)/);
});

test('leaderboard combines the shared database projects with local projects and shared votes', async () => {
  const ranking=await readFile(path.join(root,'ranking.js'),'utf8'),html=await readFile(path.join(root,'leaderboard.html'),'utf8');
  assert.match(ranking,/api\/database\?action=projects/);assert.match(ranking,/remoteProjects=Array\.isArray\(data\.projects\)/);assert.match(ranking,/remoteVotes\[p\.id\]/);assert.match(ranking,/byId\.set\(p\.id,\{\.\.\.p\}\)/);assert.match(html,/ranking\.js\?v=load-remote-projects-1/);
});

test('site uses the supplied periwinkle palette and renders one animated sheet divided into flow lines', async () => {
  const motion=await readFile(path.join(root,'site-motion.js'),'utf8'),css=await readFile(path.join(root,'enhancements.css'),'utf8'),settings=await readFile(path.join(root,'site-settings.js'),'utf8'),settingsCss=await readFile(path.join(root,'site-settings.css'),'utf8');
  assert.match(settings,/dataset\.siteTheme = 'dark'/); assert.match(motion,/halfDepth = height \* \.25675/); assert.match(motion,/surfaceGradient\.addColorStop/); assert.match(motion,/ctx\.fill\(\)/); assert.match(motion,/requestAnimationFrame\(draw\)/); assert.doesNotMatch(motion,/route-branch|route-wave-purple/);
  assert.match(css,/--brand-bg:#09090F/); assert.match(css,/body\{background:#09090F!important;color:#FFFFFF!important\}/); assert.match(motion,/ctx\.closePath\(\)/); assert.match(motion,/ctx\.clip\(\)/); assert.match(motion,/for \(let stripe = 0; stripe < 80; stripe\+\+\)/); assert.match(motion,/stripeGradient\.addColorStop/); assert.match(css,/--brand-surface:#4F4F66/); assert.match(css,/--brand-text:#FFFFFF/); assert.match(css,/--brand-muted:#C4C3D7/); assert.match(css,/project-detail-score\{background:transparent!important/); assert.match(css,/body main :is\(h1,h2,h3,h4,p,label,small,span,b,strong,li,td,th,legend,summary,dt,dd,figcaption\)/); assert.match(css,/\.leader-row\{padding-block:24px!important;background:transparent!important\}/); assert.match(css,/\.showcase-stage\{border:0!important;box-shadow:none!important;background:transparent!important\}/); assert.match(css,/investor-empty-cta,html\[data-site-theme="dark"\] \.investor-row\{background:transparent!important/); assert.match(css,/\.ocean-wave-canvas/); assert.match(css,/\.academy-route-art\{display:none!important\}/); assert.match(settingsCss,/site-preferences-panel,html\[data-site-theme="dark"\] \.site-preferences-panel select/); assert.match(settingsCss,/html\[data-site-theme="dark"\] \.ai-result\{background:#35354D/);
});

test('ocean canvas respects reduced-motion and keeps the old route network hidden', async () => {
  const motion=await readFile(path.join(root,'site-motion.js'),'utf8'),css=await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(motion,/prefers-reduced-motion/);assert.match(motion,/createElement\('canvas'\)/);assert.match(motion,/const reduced/);assert.match(css,/\.academy-route-art\{display:none!important\}/);assert.match(css,/\.ocean-wave-canvas\{position:fixed!important/);
});

test('background wave caches unchanged geometry and gradients while remaining animated during scrolling', async () => {
  const motion = await readFile(path.join(root,'site-motion.js'),'utf8');
  assert.match(motion,/surfaceGradient = ctx\.createLinearGradient/);
  assert.match(motion,/x <= width; x \+= 3/);
  assert.match(motion,/\.755 - \.065 \* u - \.22 \* centralRise - \.065 \* leftRise \+ \.028 \* trough - \.055 \* rightRise/);
  assert.match(motion,/surfaceGradient\.addColorStop\(\.70, 'rgba\(130,129,204,\.23\)'\)/);
  assert.match(motion,/stripeGradient\.addColorStop\(\.70, 'rgba\(130,129,204,\.40\)'\)/);
  assert.match(motion,/ctx\.clip\(\)/);
  assert.match(motion,/for \(let stripe = 0; stripe < 80; stripe\+\+\)/);
  assert.match(motion,/cancelAnimationFrame\(frame\)/);
  assert.match(motion,/if \(!reduced && !document\.hidden\) frame = requestAnimationFrame\(draw\)/);
  assert.match(motion,/sample\.sinU \* phaseCos \+ sample\.cosU \* phaseSin/);
  assert.doesNotMatch(motion,/addEventListener\('scroll'/);
  assert.doesNotMatch(motion,/setTimeout\(resumeWave/);
  assert.match(motion,/if \(!reduced && !document\.hidden\) frame = requestAnimationFrame\(draw\)/);
  assert.match(motion,/if \(reduced && width\)[\s\S]*?frame = requestAnimationFrame\(draw\)/);
});

test('site logo and favicon use the bird mark', async () => {
  const index=await readFile(path.join(root,'index.html'),'utf8'),favicon=await readFile(path.join(root,'favicon.svg'),'utf8');
  assert.match(index,/svg class="brand-mark" viewBox="0 0 40 28"/); assert.doesNotMatch(index,/class="brand-mark"><i>/); assert.match(favicon,/<svg[^>]*viewBox="0 0 40 28"/); assert.match(favicon,/#706DFF/);
});

test('site defers offscreen media and browser font loading without delaying the hero', async () => {
  const settings = await readFile(path.join(root,'site-settings.js'),'utf8');
  const css = await readFile(path.join(root,'enhancements.css'),'utf8');
  const htmlFiles = (await import('node:fs/promises')).readdir(root);
  assert.match(settings,/image\.loading = rect\.top < innerHeight \* 1\.5 \? 'eager' : 'lazy'/);
  assert.match(settings,/image\.decoding = 'async'/);
  assert.match(settings,/new MutationObserver/);
  assert.match(settings,/new IntersectionObserver\(entries => entries\.forEach/);
  assert.match(settings,/video\.preload = 'none'/);
  assert.match(settings,/video\.pause\(\)/);
  assert.match(settings,/video\.play\(\)\?\.catch/);
  assert.match(css,/content-visibility: auto/);
  for (const file of (await htmlFiles).filter(name => name.endsWith('.html'))) {
    const page = await readFile(path.join(root,file),'utf8');
    assert.match(page,/fonts\.googleapis\.com\/css2\?[^"']*display=swap/,`${file} should use non-blocking font display`);
  }
});

test('language menu persists and applies the selected locale with keyboard support and clear styling', async () => {
  const settings = await readFile(path.join(root,'site-settings.js'),'utf8');
  const css = await readFile(path.join(root,'enhancements.css'),'utf8');
  assert.match(settings,/aria-label="Настройки сайта" hidden/);
  assert.match(settings,/Язык интерфейса<select id="site-language"/);
  assert.match(settings,/if \(!\['ru','en'\]\.includes\(nextLanguage\)\) return/);
  assert.match(settings,/localStorage\.setItem\(settingKey,JSON\.stringify\(preferences\)\)/);
  assert.match(settings,/translateTree\(document\)/);
  assert.match(settings,/event\.key==='Escape'/);
  assert.match(settings,/'Язык интерфейса':'Interface language'/);
  assert.match(css,/\.ranking-showcase \.showcase-card\{border:1px solid #7F7F9966!important/);
  assert.match(css,/\.site-preferences-button\[aria-expanded="true"\]/);
  assert.match(css,/\.site-preferences-panel select:focus-visible/);
  assert.match(css,/\.site-preferences-panel select\{width:100%!important;min-height:42px/);
});

test('all native dropdowns share the dark theme, arrow, focus, and selected-option colors', async () => {
  const css = await readFile(path.join(root,'site-settings.css'),'utf8');
  assert.match(css,/html\[data-site-theme="dark"\] body select\{appearance:none!important/);
  assert.match(css,/color-scheme:dark/);
  assert.match(css,/accent-color:#706DFF/);
  assert.match(css,/background-position:right 13px center/);
  assert.match(css,/body select option,html\[data-site-theme="dark"\] body select optgroup\{background:#1D1D33!important;color:#FFFFFF!important\}/);
  assert.match(css,/body select option:checked\{background:#4F4F66!important;color:#FFFFFF!important\}/);
  assert.match(css,/body select:focus-visible\{outline:2px solid #8281CC!important/);
});

test('account avatar, empty startup state, and project form stay clean and responsive', async () => {
  const css = await readFile(path.join(root,'enhancements.css'),'utf8');
  const account = await readFile(path.join(root,'account-settings.js'),'utf8');
  assert.match(account,/account-avatar-overlay/);
  assert.match(css,/\.account-avatar-picker\{background:transparent!important;border:0!important/);
  assert.match(css,/\.account-avatar-overlay\{inset:auto 0 0 auto!important;width:23px;height:23px/);
  assert.match(css,/\.my-startups-panel\{background:transparent!important/);
  assert.match(css,/\.owned-startups-empty[^}]*background:rgba\(29,29,51,\.28\)!important/);
  assert.match(css,/\.form-extra\{background:rgba\(29,29,51,\.48\)!important/);
  assert.match(css,/\.workspace-grid\{grid-template-columns:minmax\(0,1fr\)!important\}/);
});

test('personal library filters by current owner and favorites are saved and exposed in the profile', async () => {
  const lib=await readFile(path.join(root,'project-library.js'),'utf8'),catalog=await readFile(path.join(root,'project-catalog.js'),'utf8'),profile=await readFile(path.join(root,'account-settings.js'),'utf8'),settings=await readFile(path.join(root,'site-settings.js'),'utf8');
  assert.match(lib,/ownerEmail \|\| ''\)\.toLowerCase\(\) === String\(sessionUser\.email/);assert.match(catalog,/buro-favorite-projects-v1/);assert.match(catalog,/data-favorite-id/);assert.match(profile,/favorite-startups-panel/);assert.match(profile,/account-tab-favorites/);assert.match(settings,/site-preferences-button[^>]*aria-label="Открыть настройки сайта"[^>]*>[\s\S]*?<svg/);assert.doesNotMatch(settings,/site-preferences-caption|>文</);
});

test('public member profiles are read-only and expose only explicitly supplied contacts', async () => {
  const db=await readFile(path.join(root,'.netlify/functions/database.mjs'),'utf8'),settings=await readFile(path.join(root,'account-settings.js'),'utf8'),view=await readFile(path.join(root,'public-profile.js'),'utf8'),html=await readFile(path.join(root,'public-profile.html'),'utf8'),project=await readFile(path.join(root,'project-page.js'),'utf8'),catalog=await readFile(path.join(root,'project-catalog.js'),'utf8'),migration=await readFile(path.join(root,'netlify/database/migrations/0007_public_profiles/migration.sql'),'utf8');
  assert.match(db,/action === 'public-profile'/);assert.match(db,/action === 'public-profiles'/);assert.match(db,/profile\?\.contactEmail/);assert.match(db,/publicId: row\.public_id/);assert.match(db,/ownerProfileId: row\.public_id/);assert.match(migration,/ADD COLUMN IF NOT EXISTS public_id TEXT/);
  assert.match(settings,/name="telegram"/);assert.match(settings,/name="contactEmail"/);assert.match(settings,/Почта для входа скрыта/);assert.match(view,/target="_blank" rel="noopener noreferrer"/);assert.doesNotMatch(view,/profile\.email/);assert.match(html,/public-profile.js/);assert.match(project,/public-profile\.html\?id=/);assert.match(catalog,/public-profile\.html\?id=/);
  assert.doesNotMatch(project,/field-hint">\$\{escapeHtml\(project\.contactEmail\)\}/);
});

test('admin uses site colors and can wake API, database, and AI without generating tokens', async () => {
  const html=await readFile(path.join(root,'admin/index.html'),'utf8'),app=await readFile(path.join(root,'admin/app.js'),'utf8'),server=await readFile(path.join(root,'render/admin-server.mjs'),'utf8'),css=await readFile(path.join(root,'admin/styles.css'),'utf8'),config=await readFile(path.join(root,'render.yaml'),'utf8');
  assert.match(html,/wake-all/);assert.match(html,/data-wake="ai"/);assert.match(app,/api\/admin\/wake/);assert.match(server,/SELECT 1/);assert.match(server,/inference\.dahl\.global/);assert.match(server,/\/models/);assert.doesNotMatch(server,/chat\/completions/);assert.match(css,/--bg:#09090F/);assert.match(css,/--lime:#14F195/);assert.match(config,/INFERENCE_API_KEY/);
});

test('role guide is linked from the footer and served as a PDF', async () => {
  const settings=await readFile(path.join(root,'site-settings.js'),'utf8'), server=await readFile(path.join(root,'render-server.mjs'),'utf8'), pdf=await readFile(path.join(root,'output/pdf/user-guide.pdf'));
  assert.match(settings,/user-guide\.pdf/); assert.match(settings,/Руководство пользователя/);
  assert.match(server,/\.pdf': 'application\/pdf'/); assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
});

test('voice assistant is configurable in settings and uses local Voicebox only for opted-in speech', async () => {
  const settings=await readFile(path.join(root,'site-settings.js'),'utf8'),chat=await readFile(path.join(root,'support-chat.js'),'utf8'),server=await readFile(path.join(root,'server.js'),'utf8');
  assert.match(settings,/voice-assistant-enabled/);assert.match(settings,/voice-assistant-output/);assert.match(settings,/voicebox-create-profile/);assert.match(settings,/profiles\/\$\{encodeURIComponent\(profile\.id\)\}\/samples/);assert.match(settings,/localStorage\.setItem\(settingKey/);
  assert.match(chat,/window\.webkitSpeechRecognition/);assert.match(chat,/v1\/audio\/speech/);assert.match(chat,/voicePrefs\.voiceOutput/);
  assert.match(server,/Отвечай только на вопросы о функциях и содержимом этого сайта/);
});
