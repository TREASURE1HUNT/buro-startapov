(() => {
  const steps = [
    { kicker: 'FIELD NOTE 01 / НАБЛЮДЕНИЕ', title: 'Начните не с продукта,<br>а с проблемы.', copy: 'Опишите, кто сталкивается с трудностью, как часто и что делает сейчас. Чем конкретнее ситуация, тем проще проверить, нужна ли людям перемена.', proof: '3 разговора с потенциальными пользователями', word: 'ПРОБЛЕМА', signal: 'Одна конкретная история лучше общей догадки.' },
    { kicker: 'FIELD NOTE 02 / ПРОВЕРКА', title: 'Проверьте гипотезу<br>в реальном разговоре.', copy: 'Поговорите с людьми из вашей аудитории. Спрашивайте о последнем случае, а не о том, нравится ли им идея. Ищите повторяющиеся факты.', proof: '5 интервью и заметки о повторяющихся сценариях', word: 'ДОКАЗАТЕЛЬСТВА', signal: 'Спрос подтверждают действия и повторяющиеся случаи.' },
    { kicker: 'FIELD NOTE 03 / ПРОТОТИП', title: 'Соберите только то,<br>что проверит ценность.', copy: 'Сделайте небольшой прототип или ручной тест. Покажите его пользователям и зафиксируйте, что они смогли сделать и где остановились.', proof: 'Один измеримый тест и обратная связь', word: 'ПРОТОТИП', signal: 'Самый полезный MVP отвечает на один вопрос.' },
    { kicker: 'FIELD NOTE 04 / РОСТ', title: 'Улучшайте проект<br>по сигналам аудитории.', copy: 'Сведите результаты в понятный план: что сработало, что меняете и какой показатель проверите следующим. Обновляйте профиль и делитесь прогрессом.', proof: 'Следующий эксперимент, ответственный и дата', word: 'СЛЕДУЮЩИЙ ШАГ', signal: 'Рост начинается с цикла наблюдений и улучшений.' },
  ];
  const tabs = [...document.querySelectorAll('[data-guide]')];
  if (!tabs.length) return;
  let active = 0;
  const $ = id => document.getElementById(id);
  function render(index) {
    active = Math.max(0, Math.min(steps.length - 1, index));
    const step = steps[active];
    $('guide-kicker').textContent = step.kicker;
    $('guide-title').innerHTML = step.title;
    $('guide-copy').textContent = step.copy;
    $('guide-proof').textContent = step.proof;
    $('screen-word').textContent = step.word;
    $('guide-signal').textContent = step.signal;
    $('guide-counter').textContent = `${String(active + 1).padStart(2, '0')} / 04`;
    $('guide-current').textContent = String(active + 1).padStart(2, '0');
    $('screen-step').textContent = active + 1;
    $('guide-progress').style.width = `${((active + 1) / steps.length) * 100}%`;
    $('guide-prev').disabled = active === 0;
    $('guide-next').textContent = active === steps.length - 1 ? 'НАЧАТЬ ПРОЕКТ ↗' : 'ДАЛЬШЕ ↗';
    $('guide-next').setAttribute('aria-label', active === steps.length - 1 ? 'Перейти к созданию проекта' : 'Следующий шаг');
    tabs.forEach((tab, i) => {
      tab.classList.toggle('active', i === active);
      if (i === active) tab.setAttribute('aria-current', 'step'); else tab.removeAttribute('aria-current');
    });
  }
  tabs.forEach(tab => tab.addEventListener('click', () => render(Number(tab.dataset.guide))));
  $('guide-prev').addEventListener('click', () => render(active - 1));
  $('guide-next').addEventListener('click', () => {
    if (active === steps.length - 1) location.href = 'create.html';
    else render(active + 1);
  });
  render(0);
})();
