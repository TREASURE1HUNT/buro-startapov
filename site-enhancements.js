(() => {
  const account = () => { try { return JSON.parse(localStorage.getItem('buro-demo-account') || 'null'); } catch { return null; } };
  const form = document.querySelector('#project-form');
  const page = location.pathname.split('/').pop();
  if (page === 'create.html' || page === 'create') {
    if (!account()) { location.replace('login.html?next=create.html'); return; }
    if (account().role !== 'startup') { location.replace('profile.html'); return; }
    if (form) {
      const add = (html, before) => before.insertAdjacentHTML('beforebegin', html);
      const actions = form.querySelector('.form-actions');
      add('<label>Команда проекта<input name="teamName" maxlength="120" placeholder="Название команды или участники" required></label><label>Кто отвечает за проект?<input name="teamResponsibility" maxlength="180" placeholder="Роль и ответственность, например: Анна — продукт и интервью" required></label><label>Подробное описание проекта (Markdown)<textarea name="descriptionMarkdown" rows="10" placeholder="# О проекте\n\n**Проблема:** ...\n\n## Решение\n- Первый шаг\n- Второй шаг"></textarea><small class="field-hint">Поддерживаются заголовки, списки, ссылки, жирный и курсивный текст, блоки кода.</small></label><label>Загрузить .md вместо ввода<input name="markdownFile" type="file" accept=".md,text/markdown,text/plain"></label><label>Фото и видео стартапа<input name="mediaFiles" type="file" accept="image/*,video/mp4,video/webm,video/ogg" multiple><small class="field-hint">Добавьте визуальные материалы к профилю; общий размер файлов до 3 МБ для браузерного хранения.</small></label>', actions);
      const markdown = form.elements.descriptionMarkdown;
      document.querySelector('#theme-reset')?.addEventListener('click',()=>{form.elements.themePrimary.value='#b8f548';form.elements.themeBackground.value='#101411';form.elements.themeText.value='#edf2e9';});
      form.elements.markdownFile.addEventListener('change', async e => { const file=e.target.files?.[0]; if(file) markdown.value=await file.text(); });
      form.addEventListener('submit', async e => {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!form.reportValidity()) return;
        const user=account(); if(!user){location.href='login.html?next=create.html';return;}
        const files=[...form.elements.mediaFiles.files];
        const total=files.reduce((n,f)=>n+f.size,0); if(total>3*1024*1024){alert('Выберите фото и видео общим размером до 3 МБ.');return;}
        const media=await Promise.all(files.map(file=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve({src:r.result,type:file.type.startsWith('video/')?'video':'image',name:file.name});r.onerror=()=>resolve(null);r.readAsDataURL(file)})));
        const data=Object.fromEntries(['name','description','category','stage','problem','audience','value','teamName','teamResponsibility','descriptionMarkdown','markets','technologies','businessModel','round','fundingAsk','contactEmail','fundingGoal','news','themePrimary','themeBackground','themeText'].map(k=>[k,(form.elements[k]?.value||'').trim()]));
        const id='user-'+(data.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'')||Date.now());
        const record={...data,id,ownerEmail:user.email,ownerName:user.name||user.fullName||"Команда проекта",progress:100,art:'art-leaf',media:media.filter(Boolean),updatedAt:new Date().toISOString()};
        try { localStorage.setItem('buro-startapov-project-v1',JSON.stringify(data)); const list=JSON.parse(localStorage.getItem('buro-startapov-projects-v1')||'[]');const i=list.findIndex(p=>p.id===id);if(i>=0)list[i]=record;else list.push(record);localStorage.setItem('buro-startapov-projects-v1',JSON.stringify(list));location.href='project.html?id='+encodeURIComponent(id); } catch { alert('Не удалось сохранить проект. Уменьшите объём видео или изображений и повторите.'); }
      }, true);
      const aiButton=document.querySelector('#ai-review');
      aiButton?.addEventListener('click',()=>{if(!account()){location.href='login.html?next=create.html';return;}},true);
      form.addEventListener('input',e=>{if(e.target===markdown){const preview=document.querySelector('#preview-problem');if(preview)preview.textContent=markdown.value.slice(0,170)||'Описание появится здесь.';}});
    }
  }
  const login=document.querySelector('#login-form');
  if(login) login.dataset.next=new URLSearchParams(location.search).get('next')||'';
  const ai=document.querySelector('#ai-review');
  ai?.addEventListener('click',()=>{const f=document.querySelector('#project-form'); if(!f)return;const data=Object.fromEntries(['name','category','stage','problem','audience','value'].map(k=>[k,f.elements[k].value.trim()]));const id='user-'+(data.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'')||'draft');const observer=new MutationObserver(()=>{const text=document.querySelector('#ai-result')?.textContent||'';const m=text.match(/Оценка ИИ:\s*(\d+)/);if(m){localStorage.setItem(`buro-project-scores-${id}`,JSON.stringify({ai:Number(m[1]),mentor:null}));observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true,characterData:true});setTimeout(()=>observer.disconnect(),45000);},true);
})();
