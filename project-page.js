 (async () => {
  const seeds = {
    forest: { name: 'Вторая жизнь городского леса', short: 'Лесной круг', category: 'Экология', stage: 'Прототип', progress: 72, audience: 'Жители города, которым важны городские зелёные зоны', problem: 'Обрезанные ветки и древесные остатки часто вывозят как отходы, хотя их можно перерабатывать рядом с местом сбора.', value: 'Сервис связывает городские команды благоустройства и местных мастеров, чтобы превращать древесные остатки в полезные предметы и материалы.', art: 'art-leaf' },
    master: { name: 'Найти мастера. Довериться делу.', short: 'Мастер рядом', category: 'Сервисы', stage: 'Проверка проблемы', progress: 54, audience: 'Люди, которым нужен надёжный локальный мастер', problem: 'Людям трудно заранее понять качество работы мастера, сроки и итоговую цену услуги.', value: 'Понятный профиль специалиста, подтверждённые примеры работ и прозрачные условия заказа.', art: 'art-blue' },
    shelf: { name: 'Осознанный выбор каждый день.', short: 'Чистая полка', category: 'Ритейл', stage: 'MVP и тестирование', progress: 88, audience: 'Покупатели, которые хотят быстро сравнить состав и происхождение товара', problem: 'Полезная информация о составе и производстве товара часто спрятана или сложна для сравнения.', value: 'Короткая карточка товара показывает важные характеристики и помогает сопоставлять варианты на полке.', art: 'art-orange' },
  };
  const $ = id => document.getElementById(id);
  const root = $('project-detail');
  if (!root) return;
  const id = new URLSearchParams(location.search).get('id') || '';
  let project = seeds[id];
  if (!project) {
    try { project = (JSON.parse(localStorage.getItem('buro-startapov-projects-v1') || '[]')).find(item => item.id === id); } catch {}
  }
  if (!project && id) { try { const response=await fetch(`/api/database?action=project&id=${encodeURIComponent(id)}`); if(response.ok) project=(await response.json()).project; } catch {} }
  if (!project) {
    root.innerHTML = '<article class="project-detail-main"><div class="section-index">[ ПРОЕКТ НЕ НАЙДЕН ]</div><h1>Такой страницы<br>стартапа нет.</h1><p class="detail-copy">Откройте проект из каталога или создайте собственный.</p><a class="button" href="projects.html">К проектам ↗</a></article>';
    return;
  }
  const votesKey = `buro-community-${project.id || id}`;
  const account = (() => { try { return JSON.parse(localStorage.getItem('buro-demo-account') || 'null'); } catch { return null; } })();
  const voterId = account?.email ? `account:${String(account.email).trim().toLowerCase()}` : `browser:${getAnonymousVoterId()}`;
  const voteSavedLabel = account?.email ? 'Голос учтён для этого аккаунта.' : 'Голос учтён в этом браузере.';
  let votes = readVotes();
  recountVotes();
  const voteCount = votes.up + votes.down;
  const positive = voteCount ? Math.round(votes.up / voteCount * 100) : null;
  const contribution = positive === null ? '—' : `${Math.round(positive / 2)} / 50`;
  const scores = JSON.parse(localStorage.getItem(`buro-project-scores-${project.id || id}`) || 'null');
  const baseScore = Math.round(Number(scores?.ai || 0) * 0.25 + Number(scores?.mentor || 0) * 0.25 + (positive ?? 0) * 0.5);
  const media = Array.isArray(project.media) ? project.media : [];
  const markdown = project.descriptionMarkdown || project.description || '';
  const renderMarkdown = source => {
    const codeBlocks = [];
    let html = escapeHtml(source).replace(/```(?:[a-z0-9_-]+)?\n([\s\S]*?)```/gi, (_, code) => { const marker = `@@CODE${codeBlocks.length}@@`; codeBlocks.push(`<pre class="md-code"><code>${code}</code></pre>`); return marker; });
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^> ?(.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^[-*] \[x\] (.+)$/gim, '<li class="md-task checked">$1</li>').replace(/^[-*] \[ \] (.+)$/gm, '<li class="md-task">$1</li>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>').replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/^---+$/gm, '<hr>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(?:<li(?:\s[^>]*)?>.*<\/li>\n?)+/gs, match => `<ul>${match}</ul>`)
      .replace(/(?:^|\n)(?!<h[23]|<li|<blockquote|<hr|<ul|@@CODE)([^\n]+)(?=\n|$)/g, '<p>$1</p>').replace(/\n/g, '<br>');
    codeBlocks.forEach((block, index) => { html = html.replaceAll(`@@CODE${index}@@`, block); });
    return html;
  };
  const renderMedia = item => { const src = typeof item === 'string' ? item : item?.src; const type = typeof item === 'string' ? '' : item?.type; if (!src || !/^data:image\/(png|jpe?g|gif|webp|avif);base64,|^data:video\/(mp4|webm|ogg);base64,/.test(src)) return ''; return type === 'video' || src.startsWith('data:video/') ? `<video class="project-cover-video" autoplay muted loop playsinline controls preload="metadata" src="${src}"></video>` : `<img class="project-cover-image" loading="lazy" src="${src}" alt="Обложка стартапа">`; };
  const coverMedia=media[0]; const mediaHtml=media.slice(1).map(renderMedia).join('');
  const editable = account && account.role === 'startup' && account.email === project.ownerEmail;
  const art = project.art || 'art-leaf';
  const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  const theme = { primary:safeColor(project.themePrimary,'#b8f548'), background:safeColor(project.themeBackground,'#101411'), text:safeColor(project.themeText,'#edf2e9') };
  document.documentElement.style.setProperty('--project-accent', theme.primary); document.documentElement.style.setProperty('--project-surface', theme.background); document.documentElement.style.setProperty('--project-ink', theme.text);
  const artCaption = art === 'art-blue' ? 'БЛИЖЕ<br>К МАСТЕРАМ' : art === 'art-orange' ? 'ПРОСТО<br>И ЧИСТО' : 'ПРИРОДА<br>КАК РЕСУРС';
  const defaultCoverHtml=`<div class="leaf-shape"></div><div class="art-sun"></div><div class="blue-arch"></div><div class="blue-orb"></div><div class="orange-ring"></div><div class="orange-block"></div><span>${artCaption}</span>`;const coverHtml=coverMedia?renderMedia(coverMedia):defaultCoverHtml;
  const ownerUser=(()=>{try{return JSON.parse(localStorage.getItem('buro-browser-users-v1')||'[]').find(user=>user.email===project.ownerEmail)}catch{return null}})();const ownerAvatar=ownerUser?.avatar&&/^data:image\/(png|jpeg|webp);base64,/i.test(ownerUser.avatar)?`<img src="${escapeHtml(ownerUser.avatar)}" alt="">`:`<b>${escapeHtml((ownerUser?.name||project.ownerName||project.teamName||'К').trim().charAt(0).toLocaleUpperCase('ru'))}</b>`;
  const aiSlug = (project.name || '').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-');
  let ai = null;
  try { ai = JSON.parse(localStorage.getItem(`buro-ai-review-${aiSlug}`) || 'null'); } catch {}
  root.innerHTML = `<article class="project-detail-main"><div class="section-index">[ ПРОФИЛЬ СТАРТАПА · ${String(project.stage || 'ИДЕЯ').toUpperCase()} ]</div><h1>${escapeHtml(project.name)}</h1><div class="project-art ${art} ${coverMedia?'has-cover-media':''}">${coverHtml}</div>${mediaHtml ? `<div class="project-media-gallery">${mediaHtml}</div>` : ''}<div class="detail-meta"><span>${escapeHtml(project.category || 'Стартап')}</span><span>${escapeHtml(project.stage || 'Идея')}</span><span>ГОТОВНОСТЬ ${Number(project.progress || 0)}%</span></div><nav class="startup-tabs" role="tablist" aria-label="Разделы стартапа"><button class="startup-tab active" role="tab" aria-selected="true" data-tab="product">Продукт</button><button class="startup-tab" role="tab" aria-selected="false" data-tab="company">Компания</button><button class="startup-tab" role="tab" aria-selected="false" data-tab="investments">Инвестиции</button><button class="startup-tab" role="tab" aria-selected="false" data-tab="news">Новости</button></nav><section class="startup-panel active" role="tabpanel" data-panel="product"><h2>Описание</h2><div class="detail-copy markdown-rendered">${markdown ? renderMarkdown(markdown) : `<p>${escapeHtml(project.description || project.value || 'Описание пока не добавлено.')}</p>`}</div><div class="startup-info-grid"><article><h3>Проблема</h3><p>${escapeHtml(project.problem || 'Не указана')}</p></article><article><h3>Решение</h3><p>${escapeHtml(project.value || 'Не указано')}</p></article><article><h3>Целевая аудитория</h3><p>${escapeHtml(project.audience || 'Не указана')}</p></article><article><h3>Рынки</h3><p>${escapeHtml(project.markets || 'Не указаны')}</p></article><article><h3>Технологии</h3><p>${escapeHtml(project.technologies || 'Не указаны')}</p></article><article><h3>Модель продаж</h3><p>${escapeHtml(project.businessModel || 'Не указана')}</p></article></div></section><section class="startup-panel" role="tabpanel" data-panel="company" hidden><h2>Компания и команда</h2><div class="project-owner-chip"><span class="project-owner-avatar">${ownerAvatar}</span><span><small>ОСНОВАТЕЛЬ</small><b>${escapeHtml(project.ownerName||ownerUser?.name||project.teamName||'Команда проекта')}</b></span></div><p class="detail-copy"><b>${escapeHtml(project.teamName || project.team || 'Команда не указана')}</b>${project.teamResponsibility ? ` — ${escapeHtml(project.teamResponsibility)}` : ''}</p><p class="detail-copy">Проект развивается на стадии «${escapeHtml(project.stage || 'идея')}».</p><h3>Контакт для связи</h3>${project.contactEmail ? `<a class="button button-outline contact-cta" href="mailto:${encodeURIComponent(project.contactEmail)}?subject=${encodeURIComponent('Интерес к проекту: '+project.name)}">Написать команде ↗</a><p class="field-hint">${escapeHtml(project.contactEmail)}</p>` : '<p class="detail-copy">Контакт пока не указан. Команда может добавить его при создании проекта.</p>'}</section><section class="startup-panel" role="tabpanel" data-panel="investments" hidden><h2>Инвестиционный запрос</h2><div class="startup-info-grid"><article><h3>Раунд</h3><p>${escapeHtml(project.round || 'Не указан')}</p></article><article><h3>Сумма</h3><p>${escapeHtml(project.fundingAsk ? `${project.fundingAsk} ${project.fundingCurrency||'RUB'}` : 'Запрос не указан')}</p></article><article class="wide"><h3>Цель привлечения</h3><p>${escapeHtml(project.fundingGoal || 'Команда пока не описала цель инвестиций.')}</p></article></div>${project.contactEmail ? `<a class="button contact-cta" href="mailto:${encodeURIComponent(project.contactEmail)}?subject=${encodeURIComponent('Инвестиции в проект: '+project.name)}">Связаться по инвестициям ↗</a>` : ''}</section><section class="startup-panel" role="tabpanel" data-panel="news" hidden><h2>Новости и обновления</h2><div class="detail-copy markdown-rendered">${project.news ? renderMarkdown(project.news) : '<p>Команда ещё не добавила обновления. Здесь появятся новости о релизах, проверках гипотез и результатах.</p>'}</div></section>${editable ? `<div class="project-owner-actions"><a class="button button-outline" href="create.html?edit=${encodeURIComponent(project.id||id)}">Редактировать стартап ↗</a><button type="button" class="clear-button delete-startup" id="delete-startup">Удалить стартап ×</button></div><form id="project-media-form" class="project-media-form"><h2>Медиа проекта</h2><label class="media-upload-label"><span class="media-upload-icon">＋</span><b>Добавить фото или видео</b><small>Первый материал — обложка; видео запускается автоматически и повторяется.</small><input name="media" type="file" accept="image/*,video/mp4,video/webm,video/ogg" multiple></label><div id="project-media-manager" class="media-manager"></div><button class="clear-button" type="submit">Добавить выбранные материалы</button><div class="detail-vote-status" role="status"></div></form>` : ''}<a class="project-detail-back" href="projects.html">← НАЗАД К КАТАЛОГУ</a></article><aside class="project-detail-score"><div class="section-index">[ 50% — ОТКЛИК СООБЩЕСТВА ]</div><h2>Оценка сообщества</h2><p>Голосуйте за идею. Ваш выбор обновит общественную оценку этого проекта.</p><div class="community-score-total" id="community-percent">${positive === null ? '—' : `${positive}%`}</div><div class="community-score-caption">ПОДДЕРЖКА СРЕДИ ГОЛОСОВ · <span id="community-total">${voteCount}</span> ГОЛОСОВ</div><div class="detail-votes"><button class="vote-button${votes.vote === 'up' ? ' selected' : ''}" type="button" data-vote="up" aria-label="Поддержать проект" aria-pressed="${votes.vote === 'up'}"><span class="vote-arrow vote-arrow-up" aria-hidden="true"></span><b id="vote-up">${votes.up}</b></button><button class="vote-button${votes.vote === 'down' ? ' selected' : ''}" type="button" data-vote="down" aria-label="Не поддержать проект" aria-pressed="${votes.vote === 'down'}"><span class="vote-arrow vote-arrow-down" aria-hidden="true"></span><b id="vote-down">${votes.down}</b></button></div><div class="detail-vote-status" id="vote-status">${votes.vote ? voteSavedLabel : 'Выберите направление — можно изменить его позже.'}</div><p class="community-score-caption">ВЕС В ОБЩЕЙ ОЦЕНКЕ: <span id="community-contribution">${contribution}</span></p><section class="score-breakdown"><div><span>ИИ · 25%</span><b>${scores?.ai == null ? '—' : Number(scores.ai)}</b></div><div><span>НАСТАВНИК · 25%</span><b>${scores?.mentor == null ? '—' : Number(scores.mentor)}</b></div><div><span>СООБЩЕСТВО · 50%</span><b id="community-score-component">${positive ?? '—'}</b></div><div class="score-grand-total"><span>ИТОГОВЫЙ БАЛЛ</span><b id="final-score">${positive !== null ? baseScore : (scores?.ai != null && scores?.mentor != null ? baseScore : '—')}</b></div></section><p class="community-score-caption">Формула: ИИ × 25% + наставник × 25% + сообщество × 50%.</p><div class="ai-score-card"><h3>ОЦЕНКА ИИ · 25%</h3>${ai ? `<p><b>${Number(ai.score)} / 100</b> · ${escapeHtml(ai.summary || 'Анализ готов.')}</p><p>${escapeHtml(ai.next_step || '')}</p>` : '<p>Оценка появится после анализа описания проекта.</p>'}${account ? `<span class="community-score-caption">ИИ оценивает проект по данным, указанным командой.</span>` : `<a class="project-detail-back" href="register.html">Войдите, чтобы создать проект ↗</a>`}</div><div class="ai-score-card"><h3>ОЦЕНКА НАСТАВНИКА · 25%</h3>${scores?.mentor == null ? '<p>Оценка появится после проверки наставником.</p>' : `<p>${Number(scores.mentor)} / 100</p>`}</div>${account?.role === 'mentor' ? `<form id="mentor-review-form" class="mentor-review-form"><h3>ОБРАТНАЯ СВЯЗЬ НАСТАВНИКА</h3><label>Оценка <input name="mentorScore" type="number" min="0" max="100" step="1" required value="${scores?.mentor ?? ''}"></label><label>Комментарий <textarea name="mentorNote" rows="3" maxlength="600" placeholder="Что команде стоит проверить дальше?">${escapeHtml(scores?.mentorNote || '')}</textarea></label><button class="clear-button" type="submit">Сохранить оценку</button></form>` : ''}<p class="community-score-caption">Голоса хранятся в общем рейтинге сайта и видны всем посетителям.</p></aside>`;
  if (account?.role === 'investor') { const savedKey=`buro-investor-saved-${account.email}`; const saved=()=>{try{return JSON.parse(localStorage.getItem(savedKey)||'[]')}catch{return []}}; const button=document.createElement('button'); button.type='button'; button.className='clear-button investor-save'; const paintSaved=()=>{const list=saved();button.textContent=list.includes(project.id||id)?'✓ В подборке':'＋ Сохранить в подборку';}; paintSaved(); button.addEventListener('click',()=>{const list=saved();const key=project.id||id;const next=list.includes(key)?list.filter(item=>item!==key):[...list,key];localStorage.setItem(savedKey,JSON.stringify(next));paintSaved();}); root.querySelector('.score-breakdown')?.before(button); }
  root.querySelectorAll('.startup-tab').forEach(tab => tab.addEventListener('click', () => { const key=tab.dataset.tab; root.querySelectorAll('.startup-tab').forEach(item=>{const active=item===tab;item.classList.toggle('active',active);item.setAttribute('aria-selected',String(active));}); root.querySelectorAll('.startup-panel').forEach(panel=>{const active=panel.dataset.panel===key;panel.hidden=!active;panel.classList.toggle('active',active);}); }));
  function getAnonymousVoterId() {
    try {
      let visitorId = localStorage.getItem('buro-community-anonymous-id');
      if (!visitorId) { visitorId = `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem('buro-community-anonymous-id', visitorId); }
      return visitorId;
    } catch { return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  }
  function readVotes() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(votesKey) || '{}') || {}; } catch {}
    if (saved.voters && typeof saved.voters === 'object' && !Array.isArray(saved.voters)) return { ...saved, voters: { ...saved.voters } };
    const migrated = { voters: {} };
    const previousVote = saved.vote === 'up' || saved.vote === 'down' ? saved.vote : null;
    for (const type of ['up', 'down']) {
      const count = Math.max(0, Math.floor(Number(saved[type]) || 0));
      const attributed = previousVote === type && count > 0 ? 1 : 0;
      if (attributed) migrated.voters[voterId] = type;
      for (let i = attributed; i < count; i++) migrated.voters[`legacy:${type}:${i + 1}`] = type;
    }
    return migrated;
  }
  function recountVotes() {
    const ballot = Object.values(votes.voters);
    votes.up = ballot.filter(value => value === 'up').length;
    votes.down = ballot.filter(value => value === 'down').length;
    votes.vote = votes.voters[voterId] || null;
  }
  function paint(message) {
    const total = votes.up + votes.down;
    const rate = total ? Math.round(votes.up / total * 100) : null;
    $('vote-up').textContent = votes.up;
    $('vote-down').textContent = votes.down;
    $('community-total').textContent = total;
    $('community-percent').textContent = rate === null ? '—' : `${rate}%`;
    $('community-contribution').textContent = rate === null ? '—' : `${Math.round(rate / 2)} / 50`; $('community-score-component').textContent = rate === null ? '—' : rate;
    const aiScore=Number(scores?.ai), mentorScore=Number(scores?.mentor); const final=$('final-score'); if(final) final.textContent=rate!==null?Math.round((Number.isFinite(aiScore)?aiScore:0)*.25+(Number.isFinite(mentorScore)?mentorScore:0)*.25+rate*.5):(Number.isFinite(aiScore)&&Number.isFinite(mentorScore)?Math.round(aiScore*.25+mentorScore*.25):'—');
    $('vote-status').textContent = message;
    root.querySelectorAll('[data-vote]').forEach(button => {
      const selected = button.dataset.vote === votes.vote;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  let voteRequestBusy = false;
  const voterPayload = account?.email
    ? { email: String(account.email).trim().toLowerCase() }
    : { browserId: getAnonymousVoterId() };
  async function syncCommunityVotes(vote) {
    const response = await fetch('/api/database', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ action:'vote', projectId: String(project.id || id), vote:vote===undefined?null:vote })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось синхронизировать голоса.');
    votes = { ...votes, ...result, voters: votes.voters };
    paint(vote === undefined ? (votes.vote ? voteSavedLabel : 'Голоса загружены из общего рейтинга.') : (votes.vote ? 'Спасибо. Ваш голос учтён в общем рейтинге.' : 'Ваш голос отменён.'));
    window.dispatchEvent(new CustomEvent('buro:rating-change'));
  }
  root.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', async () => {
    if (voteRequestBusy) return;
    voteRequestBusy = true;
    root.querySelectorAll('[data-vote]').forEach(item => { item.disabled = true; });
    try {
      const next = button.dataset.vote === votes.vote ? null : button.dataset.vote;
      await syncCommunityVotes(next);
      try { localStorage.setItem(votesKey, JSON.stringify({ voters: { ...votes.voters, [voterId]: votes.vote } })); } catch {}
    } catch (error) {
      paint(`${error.message} Локальный рейтинг не изменён.`);
    } finally {
      voteRequestBusy = false;
      root.querySelectorAll('[data-vote]').forEach(item => { item.disabled = false; });
    }
  }));
  fetch(`/api/database?action=vote&projectId=${encodeURIComponent(project.id||id)}`,{credentials:'same-origin'}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось загрузить рейтинг.');votes={...votes,...result,voters:votes.voters};paint(votes.vote?voteSavedLabel:'Общий рейтинг загружен из базы Netlify.');}).catch(error=>{const caption=root.querySelector('.community-score-caption:last-child');if(caption)caption.textContent=`${error.message} Войдите, чтобы синхронизировать голос.`;});
  const mentorForm = root.querySelector('#mentor-review-form');
  mentorForm?.addEventListener('submit', event => { event.preventDefault(); const score = Number(mentorForm.elements.mentorScore.value); if (!Number.isInteger(score) || score < 0 || score > 100) return; const key = `buro-project-scores-${project.id || id}`; const current = JSON.parse(localStorage.getItem(key) || '{}'); current.mentor = score; current.mentorNote = mentorForm.elements.mentorNote.value.trim(); localStorage.setItem(key, JSON.stringify(current)); location.reload(); });
  const mediaForm = root.querySelector('#project-media-form');
  const mediaManager=mediaForm?.querySelector('#project-media-manager');
  function drawMedia(){if(!mediaManager)return;mediaManager.innerHTML=media.map((item,index)=>`<article class="media-item" data-index="${index}"><div class="media-thumb">${((typeof item==='object'&&item?.type==='video')||(typeof item==='string'&&item.startsWith('data:video/')))?`<video src="${item.src}" muted autoplay loop playsinline></video>`:`<img src="${typeof item==='string'?item:item.src}" alt="">`}</div><div class="media-item-meta"><b>${index===0?'ОБЛОЖКА':String(index+1).padStart(2,'0')}</b></div><div class="media-item-actions"><button type="button" data-move="-1" ${index===0?'disabled':''}>↑</button><button type="button" data-move="1" ${index===media.length-1?'disabled':''}>↓</button><button type="button" data-remove="${index}">×</button></div></article>`).join('');mediaManager.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.closest('[data-index]').dataset.index),next=index+Number(button.dataset.move);[media[index],media[next]]=[media[next],media[index]];saveMedia()}));mediaManager.querySelectorAll('[data-remove]').forEach(button=>button.addEventListener('click',()=>{media.splice(Number(button.dataset.remove),1);saveMedia()}));}
  function saveMedia(){const list=JSON.parse(localStorage.getItem('buro-startapov-projects-v1')||'[]'),item=list.find(entry=>entry.id===(project.id||id));if(!item)return;item.media=media;localStorage.setItem('buro-startapov-projects-v1',JSON.stringify(list));drawMedia();const hero=root.querySelector('.project-art');if(hero){hero.innerHTML=media.length?renderMedia(media[0]):defaultCoverHtml;hero.classList.toggle('has-cover-media',Boolean(media.length));}}
  drawMedia();
  mediaForm?.addEventListener('submit',async event=>{event.preventDefault();const files=[...mediaForm.elements.media.files];if(!files.length)return;const status=mediaForm.querySelector('[role=status]');if(media.reduce((sum,item)=>sum+Number(item.bytes||Math.ceil((item.src?.length||0)*3/4)),0)+files.reduce((sum,file)=>sum+file.size,0)>3*1024*1024){status.textContent='Суммарный размер медиа не должен превышать 3 МБ.';return;}const added=await Promise.all(files.map(file=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve({src:reader.result,type:file.type.startsWith('video/')?'video':'image',name:file.name,bytes:file.size});reader.onerror=()=>resolve(null);reader.readAsDataURL(file)})));media.push(...added.filter(Boolean));saveMedia();mediaForm.reset();status.textContent='Медиа добавлены и сохранены.';});
  root.querySelector('#delete-startup')?.addEventListener('click',async()=>{if(!confirm('Удалить этот стартап из вашего каталога?'))return;const response=await fetch('/api/database',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'delete-project',projectId:project.id||id})});if(!response.ok){alert((await response.json()).error||'Не удалось удалить проект из базы.');return;}const list=JSON.parse(localStorage.getItem('buro-startapov-projects-v1')||'[]').filter(entry=>entry.id!==(project.id||id)||entry.ownerEmail!==account.email);localStorage.setItem('buro-startapov-projects-v1',JSON.stringify(list));location.href='profile.html'});
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
})();
