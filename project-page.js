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
  const art = project.art || 'art-leaf';
  const artCaption = art === 'art-blue' ? 'БЛИЖЕ<br>К МАСТЕРАМ' : art === 'art-orange' ? 'ПРОСТО<br>И ЧИСТО' : 'ПРИРОДА<br>КАК РЕСУРС';
  const aiSlug = (project.name || '').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-');
  let ai = null;
  try { ai = JSON.parse(localStorage.getItem(`buro-ai-review-${aiSlug}`) || 'null'); } catch {}
  root.innerHTML = `<article class="project-detail-main"><div class="section-index">[ ПРОФИЛЬ СТАРТАПА · ${String(project.stage || 'ИДЕЯ').toUpperCase()} ]</div><h1>${escapeHtml(project.name)}</h1><div class="project-art ${art}"><div class="leaf-shape"></div><div class="art-sun"></div><div class="blue-arch"></div><div class="blue-orb"></div><div class="orange-ring"></div><div class="orange-block"></div><span>${artCaption}</span></div><div class="detail-meta"><span>${escapeHtml(project.category || 'Стартап')}</span><span>${escapeHtml(project.stage || 'Идея')}</span><span>ГОТОВНОСТЬ ${Number(project.progress || 0)}%</span></div><h2>Проблема</h2><p class="detail-copy">${escapeHtml(project.problem || 'Описание проблемы пока не добавлено.')}</p><h2>Для кого</h2><p class="detail-copy">${escapeHtml(project.audience || 'Аудитория проекта не указана.')}</p><h2>Ценность решения</h2><p class="detail-copy">${escapeHtml(project.value || 'Описание решения пока не добавлено.')}</p><a class="project-detail-back" href="projects.html">← НАЗАД К КАТАЛОГУ</a></article><aside class="project-detail-score"><div class="section-index">[ 50% — ОТКЛИК СООБЩЕСТВА ]</div><h2>Оценка сообщества</h2><p>Голосуйте за идею. Ваш выбор обновит общественную оценку этого проекта.</p><div class="community-score-total" id="community-percent">${positive === null ? '—' : `${positive}%`}</div><div class="community-score-caption">ПОДДЕРЖКА СРЕДИ ГОЛОСОВ · <span id="community-total">${voteCount}</span> ГОЛОСОВ</div><div class="detail-votes"><button class="vote-button${votes.vote === 'up' ? ' selected' : ''}" type="button" data-vote="up" aria-pressed="${votes.vote === 'up'}">👍 <b id="vote-up">${votes.up}</b></button><button class="vote-button${votes.vote === 'down' ? ' selected' : ''}" type="button" data-vote="down" aria-pressed="${votes.vote === 'down'}">👎 <b id="vote-down">${votes.down}</b></button></div><div class="detail-vote-status" id="vote-status">${votes.vote ? 'Ваш голос учтён в этом браузере.' : 'Выберите реакцию — можно изменить её позже.'}</div><p class="community-score-caption">ВЕС В ОБЩЕЙ ОЦЕНКЕ: ${contribution}</p><div class="ai-score-card"><h3>ОЦЕНКА ИИ · 50%</h3>${ai ? `<p><b>${Number(ai.score)} / 100</b> · ${escapeHtml(ai.summary || 'Анализ готов.')}</p><p>${escapeHtml(ai.next_step || '')}</p>` : '<p>Оценка появится после анализа описания проекта на странице создания.</p>'}<a class="project-detail-back" href="create.html">ОТКРЫТЬ ФОРМУ ПРОЕКТА ↗</a></div><p class="community-score-caption">В этой версии голоса хранятся в браузере.</p></aside>`;
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
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
})();
