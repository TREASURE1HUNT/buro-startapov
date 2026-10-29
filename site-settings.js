(() => {
  const labels = {
    'Главная':'Home','Проекты':'Projects','Рейтинг':'Leaderboard','Методика':'Method','Создать проект':'Create a project','Аккаунт':'Account','Войти':'Sign in','Начать проект':'Start a project','Все проекты':'All projects','Сейчас в движении.':'In motion now.','Инвесторы':'Investors','Стать инвестором':'Become an investor','Сохранить и открыть проект':'Save and open project','Сохранить изменения':'Save changes','Создать аккаунт':'Create account','Повторите пароль':'Repeat password','Ваше имя':'Your name','Электронная почта':'Email address','Пароль':'Password','Я присоединяюсь как':'I am joining as','Стартапер':'Founder','Инвестор':'Investor','Наставник':'Mentor','Название проекта':'Project name','Коротко о продукте':'A short product summary','Направление':'Category','Текущая стадия':'Current stage','Какую проблему решаете?':'What problem are you solving?','Для кого вы это делаете?':'Who is it for?','Ценность решения':'Solution value','Информация для инвесторов и связи':'Investor and contact details','Оформление страницы стартапа':'Startup page styling','Основной цвет':'Primary color','Цвет фона':'Background color','Цвет текста':'Text color','Сбросить цвета':'Reset colors','Поиск':'Search','Все направления':'All categories','Все стадии':'All stages','Сначала новые':'Newest first','Описание':'Description','Проблема':'Problem','Решение':'Solution','Целевая аудитория':'Target audience','Рынки':'Markets','Технологии':'Technology','Модель продаж':'Sales model','Компания':'Company','Инвестиции':'Investment','Новости':'Updates','Контакт для связи':'Contact','Поддержка ИИ':'AI support','Проверить заполненное описание ИИ':'Review this startup with AI','Оценка сообщества':'Community rating','Открыть проекты':'Browse projects','Выбрать файлы':'Choose files','Сохранить':'Save','Отмена':'Cancel','Очистить форму':'Clear form','Создать проект ↗':'Create a project ↗','Открыть профиль стартапа ↗':'Open startup profile ↗','Проекты сообщества':'Community startups','Профиль':'Profile','Поиск по проектам':'Search projects','Проект не найден':'Project not found','Тема · язык':'Theme · language','Настройки':'Settings','Настройки сайта':'Site settings','Тема':'Theme','Язык':'Language','Язык интерфейса':'Interface language','Размер шрифта':'Font size','Обычный (100%)':'Default (100%)','Крупнее (112%)':'Larger (112%)','Большой (125%)':'Large (125%)','Очень большой (140%)':'Extra large (140%)','Тёмная':'Dark','Светлая':'Light','Русский':'Russian','Открыть настройки сайта':'Open site settings','Доступность':'Accessibility','Увеличенный текст и высокий контраст':'Larger text and higher contrast','Режим для дальтоников':'Color-vision mode','Настройки доступности сохранены':'Accessibility settings saved','Перейти к основному содержимому':'Skip to main content','Предпросмотр страницы стартапа ↗':'Preview startup page ↗','Руководство пользователя ↗':'User guide ↗','Руководство пользователя (PDF)':'User guide (PDF)'
  };
  Object.assign(labels, window.siteTranslationsEN || {});
  const originals = new WeakMap();
  const attrOriginals = new WeakMap();
  const fontBaselines = new WeakMap();
  const fontElements = new Set();
  const settingKey = 'buro-site-preferences-v1';
  let preferences = { language:'ru', lowVision:false, colorVision:false, blindMode:false, fontSize:100, voiceAssistant:false, voiceOutput:false, voiceboxUrl:'http://127.0.0.1:8000', voiceProfileId:'' };
  try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem(settingKey) || '{}') }; } catch {}
  // Once a personal Voicebox profile exists, make it the assistant's default voice.
  if (preferences.voiceProfileId) { preferences.voiceAssistant = true; preferences.voiceOutput = true; try { localStorage.setItem(settingKey, JSON.stringify(preferences)); } catch {} }
  const fontScaleValue = value => [100,112,125,140].includes(Number(value)) ? Number(value) : 100;
  let activeFontScale = fontScaleValue(preferences.fontSize) / 100;
  function scaleText(root = document.body) {
    if (!root) return;
    const elements = [...(root.nodeType === Node.ELEMENT_NODE ? [root] : []), ...(root.querySelectorAll?.('*') || [])];
    for (const element of elements) {
      if (element.closest('svg') || /^(SCRIPT|STYLE|IMG|VIDEO|IFRAME|CANVAS|PATH|META|LINK)$/.test(element.tagName)) continue;
      const hasText = [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
      if (!hasText && !element.matches('input,textarea,select,option,[contenteditable="true"]')) continue;
      if (!fontBaselines.has(element)) {
        let baseline = parseFloat(getComputedStyle(element).fontSize) || 14;
        const parent = element.parentElement;
        if (parent && fontBaselines.has(parent) && Math.abs(baseline - (parseFloat(getComputedStyle(parent).fontSize) || 0)) < .1) baseline = fontBaselines.get(parent);
        fontBaselines.set(element, baseline); fontElements.add(element);
      }
      element.style.setProperty('font-size', `calc(${fontBaselines.get(element)}px * var(--site-font-scale, 1))`, 'important');
    }
  }
  function applyFontSize(value) {
    preferences.fontSize = fontScaleValue(value); activeFontScale = preferences.fontSize / 100;
    document.documentElement.style.setProperty('--site-font-scale', String(activeFontScale * (preferences.lowVision ? 1.12 : 1)));
    for (const element of fontElements) if (element.isConnected) element.style.setProperty('font-size', `calc(${fontBaselines.get(element)}px * var(--site-font-scale, 1))`, 'important');
    scaleText(document.body); savePreferences();
  }
  const theme = () => { document.documentElement.dataset.siteTheme = 'dark'; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#09090F'); };
  const applyAccessibility = () => {
    document.documentElement.dataset.accessibilityLowVision = String(Boolean(preferences.lowVision));
    document.documentElement.dataset.accessibilityColorVision = String(Boolean(preferences.colorVision));
    document.documentElement.dataset.screenReaderAssist = String(Boolean(preferences.blindMode));
  };
  const savePreferences = () => { try { localStorage.setItem(settingKey,JSON.stringify(preferences)); } catch {} };
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
    root.querySelectorAll?.('[placeholder],[title],[aria-label],[alt],[content]').forEach(element => {
      let saved = attrOriginals.get(element); if (!saved) { saved = {}; attrOriginals.set(element, saved); }
      for (const name of ['placeholder','title','aria-label','alt','content']) if (element.hasAttribute(name)) { saved[name] ??= element.getAttribute(name); const original = saved[name]; element.setAttribute(name, translate(original)); }
    });
  }
  function record(event, projectId) {
    let visitorId='';try{visitorId=localStorage.getItem('site-analytics-visitor-id')||'';if(!/^[a-f0-9-]{32,36}$/i.test(visitorId)){visitorId=crypto.randomUUID();localStorage.setItem('site-analytics-visitor-id',visitorId)}}catch{visitorId=`tab-${Date.now()}-${Math.random().toString(36).slice(2)}`}
    const data = JSON.stringify({ event, route:location.pathname, visitorId, ...(projectId ? { projectId } : {}) });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics', new Blob([data], {type:'application/json'}));
    else fetch('/api/analytics',{method:'POST',headers:{'content-type':'application/json'},body:data,keepalive:true}).catch(()=>{});
  }
  document.documentElement.lang = preferences.language; document.documentElement.dataset.siteLanguage = preferences.language;
  // Keep below-the-fold media from competing with the first screen for bandwidth.
  // Images near the viewport stay eager to avoid delaying the visible hero.
  const prepareImage = image => {
    if (!(image instanceof HTMLImageElement)) return;
    const rect = image.getBoundingClientRect();
    image.loading = rect.top < innerHeight * 1.5 ? 'eager' : 'lazy';
    image.decoding = 'async';
  };
  const videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(entry => {
    const video = entry.target;
    if (entry.isIntersecting) {
      video.preload = 'metadata';
      video.play()?.catch(() => {});
    } else {
      video.pause();
      video.preload = 'none';
    }
  }), { rootMargin:'120px 0px', threshold:.01 }) : null;
  const prepareVideo = video => {
    if (!(video instanceof HTMLVideoElement) || !video.autoplay || !videoObserver) return;
    video.pause();
    video.autoplay = false;
    video.preload = 'none';
    videoObserver.observe(video);
  };
  document.querySelectorAll('img').forEach(prepareImage);
  document.querySelectorAll('video[autoplay]').forEach(prepareVideo);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches('img')) prepareImage(node);
    node.querySelectorAll?.('img').forEach(prepareImage);
    if (node.matches('video[autoplay]')) prepareVideo(node);
    node.querySelectorAll?.('video[autoplay]').forEach(prepareVideo);
  }))).observe(document.documentElement, { childList:true, subtree:true });
  theme();
  applyAccessibility();
  const main = document.querySelector('main');
  if (main) {
    main.id ||= 'main-content';
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
    const skip = document.createElement('a'); skip.className = 'accessibility-skip-link'; skip.href = `#${main.id}`; skip.textContent = 'Перейти к основному содержимому'; document.body.prepend(skip);
  }
  const topbar = document.querySelector('.topbar');
  let header = document.querySelector('.header-actions');
  if (topbar && !header) { header=document.createElement('div'); header.className='header-actions site-preferences-only'; topbar.appendChild(header); }
  if (header) {
    const wrap = document.createElement('div'); wrap.className = 'site-preferences';
    wrap.innerHTML = '<button class="site-preferences-button" type="button" aria-label="Открыть настройки сайта" title="Настройки" aria-expanded="false" aria-haspopup="true" aria-controls="site-preferences-panel"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg></button><section class="site-preferences-panel" id="site-preferences-panel" aria-label="Настройки сайта" hidden><h2>Настройки</h2><label for="site-language">Язык интерфейса<select id="site-language" aria-label="Выбрать язык"><option value="ru">Русский</option><option value="en">English</option></select></label><label class="font-size-setting" for="site-font-size">Размер шрифта<select id="site-font-size" aria-label="Размер шрифта"><option value="100">Обычный (100%)</option><option value="112">Крупнее (112%)</option><option value="125">Большой (125%)</option><option value="140">Очень большой (140%)</option></select></label><fieldset class="accessibility-options"><legend>Доступность</legend><label class="accessibility-option"><input id="access-low-vision" type="checkbox"><span>Увеличенный текст и высокий контраст</span></label><label class="accessibility-option accessibility-color-vision-option"><input id="access-color-vision" type="checkbox" aria-describedby="access-color-vision-hint"><span><span class="accessibility-color-vision-title">Цветобезопасная палитра</span><small id="access-color-vision-hint" class="accessibility-option-hint">Заменяет цветовые акценты сайта на различимую сине-оранжевую палитру, добавляет узоры индикаторам и контрастные состояния кнопкам.</small></span></label><label class="accessibility-option"><input id="access-blind-mode" type="checkbox"><span>Улучшенная клавиатурная навигация</span></label></fieldset><fieldset class="voice-assistant-settings"><legend>Голосовой помощник</legend><button id="voice-assistant-toggle" type="button" aria-pressed="false">Включить голосового помощника</button><p class="accessibility-help">Одно нажатие включает голосовой ввод и озвучивание ответов. Нажмите микрофон в чате и задайте вопрос.</p><details><summary>Клонированный голос Voicebox (необязательно)</summary><label for="voicebox-url">Сервер Voicebox<input id="voicebox-url" type="url" value="http://127.0.0.1:8000" placeholder="http://127.0.0.1:8000"></label><label for="voicebox-samples">Мои аудиозаписи (10–30 секунд чистой речи)<input id="voicebox-samples" type="file" accept="audio/*,.ogg,.opus" multiple></label><button id="voicebox-create-profile" type="button">Создать голосовой профиль</button><label for="voicebox-profile">ID профиля<input id="voicebox-profile" type="text" placeholder="Заполнится после создания"></label><p class="accessibility-help">Для клонирования нужен запущенный Voicebox на компьютере. Без профиля помощник сразу использует голос браузера.</p></details></fieldset><p class="accessibility-status" role="status" aria-live="polite"></p></section>';
    header.insertBefore(wrap, header.querySelector('.menu-toggle') || null);
    const button = wrap.querySelector('.site-preferences-button'), panel = wrap.querySelector('section'), languageSelect = wrap.querySelector('#site-language'), fontSizeSelect = wrap.querySelector('#site-font-size');
    const lowVision = wrap.querySelector('#access-low-vision'), colorVision = wrap.querySelector('#access-color-vision'), blindMode = wrap.querySelector('#access-blind-mode');
    const voiceToggle=wrap.querySelector('#voice-assistant-toggle'),voiceboxUrl=wrap.querySelector('#voicebox-url'),voiceProfile=wrap.querySelector('#voicebox-profile'),voiceSamples=wrap.querySelector('#voicebox-samples'),createVoiceProfile=wrap.querySelector('#voicebox-create-profile');
    const status = wrap.querySelector('.accessibility-status');
    languageSelect.value = preferences.language;
    voiceToggle.setAttribute('aria-pressed',String(Boolean(preferences.voiceAssistant)));voiceToggle.textContent=preferences.voiceAssistant?'Выключить голосового помощника':'Включить голосового помощника';voiceboxUrl.value=preferences.voiceboxUrl||'http://127.0.0.1:8000';voiceProfile.value=preferences.voiceProfileId||'';
    const saveVoiceSettings=()=>{preferences.voiceboxUrl=voiceboxUrl.value.trim().replace(/\/$/,'');preferences.voiceProfileId=voiceProfile.value.trim();savePreferences();document.dispatchEvent(new CustomEvent('buro:voice-settings-change',{detail:{...preferences}}));};
    voiceToggle.addEventListener('click',()=>{preferences.voiceAssistant=!preferences.voiceAssistant;preferences.voiceOutput=preferences.voiceAssistant;voiceToggle.setAttribute('aria-pressed',String(preferences.voiceAssistant));voiceToggle.textContent=preferences.voiceAssistant?'Выключить голосового помощника':'Включить голосового помощника';saveVoiceSettings();status.textContent=preferences.voiceAssistant?'Голосовой помощник включён. Откройте чат и нажмите микрофон.':'Голосовой помощник выключен.'});
    [voiceboxUrl,voiceProfile].forEach(control=>control.addEventListener('change',saveVoiceSettings));
    [voiceboxUrl,voiceProfile].forEach(control=>control.addEventListener('input',saveVoiceSettings));
    createVoiceProfile.addEventListener('click',async()=>{const files=Array.from(voiceSamples.files||[]);if(!files.length){status.textContent='Выберите аудиозапись с чистой речью.';voiceSamples.focus();return}createVoiceProfile.disabled=true;createVoiceProfile.textContent='Создаю профиль…';status.textContent='Подключаюсь к Voicebox на этом компьютере…';try{const base=voiceboxUrl.value.trim().replace(/\/$/,'');const health=await fetch(`${base}/health`);if(!health.ok)throw Error('Voicebox не ответил. Запустите приложение и проверьте адрес.');const profileResponse=await fetch(`${base}/profiles`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Мой голос — Бюро',description:'Личный голосовой помощник сайта',language:'ru',voice_type:'cloned'})});if(!profileResponse.ok)throw Error((await profileResponse.text()).slice(0,240));const profile=await profileResponse.json();for(const file of files){const transcriptData=new FormData();transcriptData.append('file',file);transcriptData.append('language','ru');const transcriptResponse=await fetch(`${base}/transcribe`,{method:'POST',body:transcriptData});if(!transcriptResponse.ok)throw Error('Не удалось распознать аудио. Проверьте модель транскрибации Voicebox.');const transcript=await transcriptResponse.json();const sampleData=new FormData();sampleData.append('file',file,file.name);sampleData.append('reference_text',transcript.text);const sampleResponse=await fetch(`${base}/profiles/${encodeURIComponent(profile.id)}/samples`,{method:'POST',body:sampleData});if(!sampleResponse.ok)throw Error('Профиль создан, но образец голоса добавить не удалось: '+(await sampleResponse.text()).slice(0,180))}voiceProfile.value=profile.id;preferences.voiceAssistant=true;preferences.voiceOutput=true;voiceToggle.setAttribute('aria-pressed','true');voiceToggle.textContent='Выключить голосового помощника';saveVoiceSettings();status.textContent='Профиль голоса создан и голосовой помощник включён.'}catch(error){status.textContent=`Не получилось подключиться к Voicebox: ${error.message}. Проверьте, что приложение запущено и разрешает origin сайта в VOICEBOX_CORS_ORIGINS.`}finally{createVoiceProfile.disabled=false;createVoiceProfile.textContent='Создать голосовой профиль'}});
    fontSizeSelect.value = String(fontScaleValue(preferences.fontSize));
    fontSizeSelect.addEventListener('change', () => applyFontSize(fontSizeSelect.value));
    lowVision.checked = Boolean(preferences.lowVision); colorVision.checked = Boolean(preferences.colorVision); blindMode.checked = Boolean(preferences.blindMode);
    button.addEventListener('click',()=>{ panel.hidden = !panel.hidden; button.setAttribute('aria-expanded',String(!panel.hidden)); if(!panel.hidden) requestAnimationFrame(()=>languageSelect.focus()); });
    languageSelect.addEventListener('change',()=>{
      const nextLanguage = languageSelect.value;
      if (!['ru','en'].includes(nextLanguage)) return;
      preferences.language = nextLanguage;
      document.documentElement.lang = nextLanguage;
      document.documentElement.dataset.siteLanguage = nextLanguage;
      savePreferences();
      translateTree(document);
      document.dispatchEvent(new CustomEvent('buro:language-change',{detail:nextLanguage}));
    });
    const updateAccessibility = () => { preferences.lowVision = lowVision.checked; preferences.colorVision = colorVision.checked; preferences.blindMode = blindMode.checked; applyAccessibility(); applyFontSize(preferences.fontSize); savePreferences(); status.textContent = translate('Настройки доступности сохранены'); };
    lowVision.addEventListener('change', updateAccessibility); colorVision.addEventListener('change', updateAccessibility); blindMode.addEventListener('change', updateAccessibility);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();}});
    document.addEventListener('click',event=>{if(!wrap.contains(event.target)){panel.hidden=true;button.setAttribute('aria-expanded','false');}});
  }
  document.querySelectorAll('footer').forEach(footer=>{
    const host=footer.querySelector('.footer-links')||footer;
    if(host.querySelector('a[href="/output/pdf/user-guide.pdf"]'))return;
    const link=document.createElement('a');
    link.className='button user-guide-link';
    link.href='/output/pdf/user-guide.pdf';
    link.setAttribute('aria-label','Руководство пользователя (PDF)');
    link.innerHTML='Руководство пользователя <span aria-hidden="true">↗</span>';
    host.append(link);
  });
  translateTree();
  document.documentElement.style.setProperty('--site-font-scale', '1');
  scaleText(document.body);
  applyFontSize(preferences.fontSize);
  new MutationObserver(records=>records.forEach(mutation=>mutation.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE){translateTree(node);scaleText(node);}else if(node.nodeType===Node.TEXT_NODE){const original=node.nodeValue;originals.set(node,original);node.nodeValue=translate(original);scaleText(node.parentElement);}}))).observe(document.body,{childList:true,subtree:true});
  const projectId = new URLSearchParams(location.search).get('id'); record(projectId ? 'project_view' : 'page_view', projectId);
})();
