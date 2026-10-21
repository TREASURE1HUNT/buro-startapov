(() => {
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
  if (!project) {
    root.innerHTML = '<article class="project-detail-main"><div class="section-index">[ ПРОЕКТ НЕ НАЙДЕН ]</div><h1>Такой страницы<br>стартапа нет.</h1><p class="detail-copy">Откройте проект из каталога или создайте собственный.</p><a class="button" href="projects.html">К проектам ↗</a></article>';
    return;
  }
  const votesKey = `buro-community-${project.id || id}`;
  let votes = { up: 0, down: 0, vote: null };
  try { votes = { ...votes, ...JSON.parse(localStorage.getItem(votesKey) || '{}') }; } catch {}
  const voteCount = votes.up + votes.down;
  const positive = voteCount ? Math.round(votes.up / voteCount * 100) : null;
  const contribution = positive === null ? '—' : `${Math.round(positive / 2)} / 50`;
  const account = (() => { try { return JSON.parse(localStorage.getItem('buro-demo-account') || 'null'); } catch { return null; } })();
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
  const mediaHtml = media.map(item => { const src = typeof item === 'string' ? item : item.src; const type = typeof item === 'string' ? '' : item.type; if (!src || !/^data:image\/(png|jpe?g|gif|webp|avif);base64,|^data:video\/(mp4|webm|ogg);base64,/.test(src)) return ''; return type === 'video' || src.startsWith('data:video/') ? `<video controls preload="metadata" src="${src}"></video>` : `<img loading="lazy" src="${src}" alt="Материал проекта">`; }).join('');
  const editable = account && account.role === 'startup' && account.email === project.ownerEmail;
  const art = project.art || 'art-leaf';
  const artCaption = art === 'art-blue' ? 'БЛИЖЕ<br>К МАСТЕРАМ' : art === 'art-orange' ? 'ПРОСТО<br>И ЧИСТО' : 'ПРИРОДА<br>КАК РЕСУРС';
  const aiSlug = (project.name || '').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-');
  let ai = null;
  try { ai = JSON.parse(localStorage.getItem(`buro-ai-review-${aiSlug}`) || 'null'); } catch {}
  root.innerHTML = `<article class="project-detail-main"><div class="section-index">[ ПРОФИЛЬ СТАРТАПА · ${String(project.stage || 'ИДЕЯ').toUpperCase()} ]</div><h1>${escapeHtml(project.name)}</h1><div class="project-art ${art}"><div class="leaf-shape"></div><div class="art-sun"></div><div class="blue-arch"></div><div class="blue-orb"></div><div class="orange-ring"></div><div class="orange-block"></div><span>${artCaption}</span></div>${mediaHtml ? `<div class="project-media-gallery">${mediaHtml}</div>` : ''}<div class="detail-meta"><span>${escapeHtml(project.category || 'Стартап')}</span><span>${escapeHtml(project.stage || 'Идея')}</span><span>ГОТОВНОСТЬ ${Number(project.progress || 0)}%</span></div><h2>Проблема</h2><p class="detail-copy">${escapeHtml(project.problem || 'Описание проблемы пока не добавлено.')}</p><h2>Для кого</h2><p class="detail-copy">${escapeHtml(project.audience || 'Аудитория проекта не указана.')}</p><h2>Ценность решения</h2><p class="detail-copy">${escapeHtml(project.value || 'Описание решения пока не добавлено.')}</p>${`<h2>Команда проекта</h2><p class="detail-copy"><b>${escapeHtml(project.teamName || project.team || 'Команда не указана')}</b>${project.teamResponsibility ? ` — ${escapeHtml(project.teamResponsibility)}` : ''}</p>`}${markdown ? `<h2>Описание проекта</h2><div class="detail-copy markdown-rendered">${renderMarkdown(markdown)}</div>` : ''}${editable ? `<form id="project-media-form" class="project-media-form"><h2>Материалы команды</h2><label>Фото и видео<input name="media" type="file" accept="image/*,video/mp4,video/webm,video/ogg" multiple><small>Файлы сохраняются в браузере этого аккаунта.</small></label><button class="clear-button" type="submit">Добавить в профиль</button><div class="detail-vote-status" role="status"></div></form>` : ''}<a class="project-detail-back" href="projects.html">← НАЗАД К КАТАЛОГУ</a></article><aside class="project-detail-score"><div class="section-index">[ 50% — ОТКЛИК СООБЩЕСТВА ]</div><h2>Оценка сообщества</h2><p>Голосуйте за идею. Ваш выбор обновит общественную оценку этого проекта.</p><div class="community-score-total" id="community-percent">${positive === null ? '—' : `${positive}%`}</div><div class="community-score-caption">ПОДДЕРЖКА СРЕДИ ГОЛОСОВ · <span id="community-total">${voteCount}</span> ГОЛОСОВ</div><div class="detail-votes"><button class="vote-button${votes.vote === 'up' ? ' selected' : ''}" type="button" data-vote="up" aria-label="Поддержать проект" aria-pressed="${votes.vote === 'up'}"><span class="vote-arrow vote-arrow-up" aria-hidden="true"></span><b id="vote-up">${votes.up}</b></button><button class="vote-button${votes.vote === 'down' ? ' selected' : ''}" type="button" data-vote="down" aria-label="Не поддержать проект" aria-pressed="${votes.vote === 'down'}"><span class="vote-arrow vote-arrow-down" aria-hidden="true"></span><b id="vote-down">${votes.down}</b></button></div><div class="detail-vote-status" id="vote-status">${votes.vote ? 'Ваш голос учтён в этом браузере.' : 'Выберите направление — можно изменить его позже.'}</div><p class="community-score-caption">ВЕС В ОБЩЕЙ ОЦЕНКЕ: <span id="community-contribution">${contribution}</span></p><section class="score-breakdown"><div><span>ИИ · 25%</span><b>${scores ? Number(scores.ai) : '—'}</b></div><div><span>НАСТАВНИК · 25%</span><b>${scores?.mentor == null ? '—' : Number(scores.mentor)}</b></div><div><span>СООБЩЕСТВО · 50%</span><b id="community-score-component">${positive ?? '—'}</b></div><div class="score-grand-total"><span>ИТОГОВЫЙ БАЛЛ</span><b id="final-score">${scores?.ai != null && scores?.mentor != null && positive !== null ? baseScore : '—'}</b></div></section><p class="community-score-caption">Формула: ИИ × 25% + наставник × 25% + сообщество × 50%.</p><div class="ai-score-card"><h3>ОЦЕНКА ИИ · 25%</h3>${ai ? `<p><b>${Number(ai.score)} / 100</b> · ${escapeHtml(ai.summary || 'Анализ готов.')}</p><p>${escapeHtml(ai.next_step || '')}</p>` : '<p>Оценка появится после анализа описания проекта.</p>'}${account ? `<span class="community-score-caption">ИИ оценивает проект по данным, указанным командой.</span>` : `<a class="project-detail-back" href="register.html">Войдите, чтобы создать проект ↗</a>`}</div><div class="ai-score-card"><h3>ОЦЕНКА НАСТАВНИКА · 25%</h3>${scores ? `<p>${Number(scores.mentor)} / 100</p>` : '<p>Оценка появится после проверки наставником.</p>'}</div><p class="community-score-caption">В браузере сохраняются лишь ваши действия и черновики.</p></aside>`;
  function paint(message) {
    const total = votes.up + votes.down;
    const rate = total ? Math.round(votes.up / total * 100) : null;
    $('vote-up').textContent = votes.up;
    $('vote-down').textContent = votes.down;
    $('community-total').textContent = total;
    $('community-percent').textContent = rate === null ? '—' : `${rate}%`;
    $('vote-status').textContent = message;
    root.querySelectorAll('[data-vote]').forEach(button => {
      const selected = button.dataset.vote === votes.vote;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  root.querySelectorAll('[data-vote]').forEach(button => button.addEventListener('click', () => {
    const next = button.dataset.vote;
    if (votes.vote === next) { votes[next] = Math.max(0, votes[next] - 1); votes.vote = null; }
    else { if (votes.vote) votes[votes.vote] = Math.max(0, votes[votes.vote] - 1); votes[next] += 1; votes.vote = next; }
    try { localStorage.setItem(votesKey, JSON.stringify(votes)); paint(votes.vote ? 'Спасибо, ваш голос учтён.' : 'Ваш голос отменён.'); }
    catch { paint('Не удалось сохранить голос в этом браузере.'); }
  }));
  const mediaForm = root.querySelector('#project-media-form');
  mediaForm?.addEventListener('submit', event => { event.preventDefault(); const files = [...mediaForm.elements.media.files]; if (!files.length) return; if(files.reduce((total,file)=>total+file.size,0)>3*1024*1024){mediaForm.querySelector('[role=status]').textContent='Общий размер файлов должен быть до 3 МБ.';return;} const load = files.map(file => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve({ src: reader.result, type: file.type.startsWith('video/') ? 'video' : 'image' }); reader.onerror = () => resolve(null); reader.readAsDataURL(file); })); Promise.all(load).then(items => { const clean = items.filter(Boolean); const list = JSON.parse(localStorage.getItem('buro-startapov-projects-v1') || '[]'); const item = list.find(entry => entry.id === (project.id || id)); if (!item) { mediaForm.querySelector('[role=status]').textContent = 'Профиль можно редактировать только автору проекта.'; return; } item.media = [...(item.media || []), ...clean]; localStorage.setItem('buro-startapov-projects-v1', JSON.stringify(list)); location.reload(); }); });
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
})();
