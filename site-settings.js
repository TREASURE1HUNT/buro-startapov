(() => {
  const labels = {
    'Главная':'Home','Проекты':'Projects','Рейтинг':'Leaderboard','Методика':'Method','Создать проект':'Create a project','Аккаунт':'Account','Войти':'Sign in','Начать проект':'Start a project','Все проекты':'All projects','Сейчас в движении.':'In motion now.','Инвесторы':'Investors','Стать инвестором':'Become an investor','Сохранить и открыть проект':'Save and open project','Сохранить изменения':'Save changes','Создать аккаунт':'Create account','Повторите пароль':'Repeat password','Ваше имя':'Your name','Электронная почта':'Email address','Пароль':'Password','Я присоединяюсь как':'I am joining as','Стартапер':'Founder','Инвестор':'Investor','Наставник':'Mentor','Название проекта':'Project name','Коротко о продукте':'A short product summary','Направление':'Category','Текущая стадия':'Current stage','Какую проблему решаете?':'What problem are you solving?','Для кого вы это делаете?':'Who is it for?','Ценность решения':'Solution value','Информация для инвесторов и связи':'Investor and contact details','Оформление страницы стартапа':'Startup page styling','Основной цвет':'Primary color','Цвет фона':'Background color','Цвет текста':'Text color','Сбросить цвета':'Reset colors','Поиск':'Search','Все направления':'All categories','Все стадии':'All stages','Сначала новые':'Newest first','Описание':'Description','Проблема':'Problem','Решение':'Solution','Целевая аудитория':'Target audience','Рынки':'Markets','Технологии':'Technology','Модель продаж':'Sales model','Компания':'Company','Инвестиции':'Investment','Новости':'Updates','Контакт для связи':'Contact','Поддержка ИИ':'AI support','Проверить заполненное описание ИИ':'Review this startup with AI','Оценка сообщества':'Community rating','Открыть проекты':'Browse projects','Выбрать файлы':'Choose files','Сохранить':'Save','Отмена':'Cancel','Очистить форму':'Clear form','Создать проект ↗':'Create a project ↗','Открыть профиль стартапа ↗':'Open startup profile ↗','Проекты сообщества':'Community startups','Профиль':'Profile','Поиск по проектам':'Search projects','Проект не найден':'Project not found','Тема · язык':'Theme · language','Настройки сайта':'Site settings','Тема':'Theme','Язык':'Language','Тёмная':'Dark','Светлая':'Light','Русский':'Russian'
  };
  const originals = new WeakMap();
  const attrOriginals = new WeakMap();
  const settingKey = 'buro-site-preferences-v1';
  let preferences = { theme:'dark', language:'ru' };
  try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem(settingKey) || '{}') }; } catch {}
  const theme = value => { preferences.theme = value; document.documentElement.dataset.siteTheme = value; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'light' ? '#f4f3ec' : '#090909'); };
  const translate = value => preferences.language === 'en' && Object.hasOwn(labels, value.trim()) ? value.replace(value.trim(), labels[value.trim()]) : value;
  function translateTree(root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const original = originals.get(node) ?? node.nodeValue;
      if (!original.trim()) continue;
      originals.set(node, original);
      const next = translate(original);
      if (node.nodeValue !== next) node.nodeValue = next;
    }
    root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(element => {
      let saved = attrOriginals.get(element); if (!saved) { saved = {}; attrOriginals.set(element, saved); }
      for (const name of ['placeholder','title','aria-label']) if (element.hasAttribute(name)) { saved[name] ??= element.getAttribute(name); const original = saved[name]; element.setAttribute(name, translate(original)); }
    });
  }
  function record(event, projectId) {
    const data = JSON.stringify({ event, route:location.pathname, ...(projectId ? { projectId } : {}) });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics', new Blob([data], {type:'application/json'}));
    else fetch('/api/analytics',{method:'POST',headers:{'content-type':'application/json'},body:data,keepalive:true}).catch(()=>{});
  }
  document.documentElement.lang = preferences.language;
  theme(preferences.theme);
  const topbar = document.querySelector('.topbar');
  let header = document.querySelector('.header-actions');
  if (topbar && !header) { header=document.createElement('div'); header.className='header-actions site-preferences-only'; topbar.appendChild(header); }
  if (header) {
    const wrap = document.createElement('div'); wrap.className = 'site-preferences';
    wrap.innerHTML = '<button class="site-preferences-button" type="button" aria-expanded="false" aria-controls="site-preferences-panel"><span aria-hidden="true">◐</span><span class="site-preferences-caption">Тема · язык</span></button><section class="site-preferences-panel" id="site-preferences-panel" hidden><b>Настройки сайта</b><label>Тема<select id="site-theme"><option value="dark">Тёмная</option><option value="light">Светлая</option></select></label><label>Язык<select id="site-language"><option value="ru">Русский</option><option value="en">English</option></select></label></section>';
    header.insertBefore(wrap, header.querySelector('.menu-toggle') || null);
    const button = wrap.querySelector('button'), panel = wrap.querySelector('section'), themeSelect = wrap.querySelector('#site-theme'), languageSelect = wrap.querySelector('#site-language');
    themeSelect.value = preferences.theme; languageSelect.value = preferences.language;
    button.addEventListener('click',()=>{ panel.hidden = !panel.hidden; button.setAttribute('aria-expanded',String(!panel.hidden)); });
    themeSelect.addEventListener('change',()=>{theme(themeSelect.value);localStorage.setItem(settingKey,JSON.stringify(preferences));});
    languageSelect.addEventListener('change',()=>{preferences.language=languageSelect.value;document.documentElement.lang=preferences.language;localStorage.setItem(settingKey,JSON.stringify(preferences));translateTree();});
    document.addEventListener('click',event=>{if(!wrap.contains(event.target)){panel.hidden=true;button.setAttribute('aria-expanded','false');}});
  }
  translateTree();
  new MutationObserver(records=>records.forEach(mutation=>mutation.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE)translateTree(node);else if(node.nodeType===Node.TEXT_NODE){const original=node.nodeValue;originals.set(node,original);node.nodeValue=translate(original);}}))).observe(document.body,{childList:true,subtree:true});
  const projectId = new URLSearchParams(location.search).get('id'); record(projectId ? 'project_view' : 'page_view', projectId);
})();
