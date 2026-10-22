(() => {
  const button = document.querySelector('#ai-review');
  const form = document.querySelector('#project-form');
  if (!button || !form) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  button.addEventListener('click', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const keys = ['name','category','stage','problem','audience','value','description','businessModel','markets','technologies','fundingAsk','fundingCurrency','fundingGoal','teamName','teamResponsibility','news'];
    const data = Object.fromEntries(keys.map(key => [key, form.elements[key]?.value.trim() || '']));
    try { data.language = JSON.parse(localStorage.getItem('buro-site-preferences-v1') || '{}').language || 'ru'; } catch { data.language = 'ru'; }
    if (keys.slice(0,6).some(key => !data[key])) { const note=document.querySelector('#ai-config-note'); if(note)note.textContent='Заполните название, направление, стадию, проблему, аудиторию и ценность, чтобы ИИ мог оценить проект.'; return; }
    let box = document.querySelector('#ai-result');
    if (!box) { box=document.createElement('section'); box.id='ai-result'; box.className='ai-result'; document.querySelector('#ai-config-note')?.after(box); }
    box.textContent='ИИ анализирует проект по шести критериям…'; button.disabled=true;
    try {
      const response=await fetch('/api/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}),review=await response.json();
      if(!response.ok)throw Error(review.error||'Сервис анализа временно недоступен.');
      const slug=data.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'');
      const projectId='user-'+slug;
      localStorage.setItem(`buro-ai-review-${slug}`,JSON.stringify(review));
      localStorage.setItem(`buro-project-scores-${projectId}`,JSON.stringify({ai:review.score,mentor:null,aiReview:review}));
      const criteria=(review.rubric||[]).map(item=>`<li><b>${esc(item.label)} · ${Number(item.score)}/100</b><span>${esc(item.evidence||'Данные не представлены.')}</span>${item.gap?`<small>Пробел: ${esc(item.gap)}</small>`:''}</li>`).join('');
      const list=(title,items)=>`<div class="ai-review-list"><b>${title}</b><ul>${(items||[]).map(item=>`<li>${esc(item)}</li>`).join('')||'<li>Не указано</li>'}</ul></div>`;
      box.innerHTML=`<div class="ai-review-heading"><span>ОЦЕНКА ИИ · 25% ИТОГОВОГО БАЛЛА</span><strong>${Number(review.score)}<small>/100</small></strong></div><p class="ai-review-summary">${esc(review.summary)}</p><p class="ai-review-note">Рубрика взвешена по критериям; оценка 0–100 не равна доле ИИ в итоговой формуле.</p><ol class="ai-review-criteria">${criteria}</ol><div class="ai-review-columns">${list('Сильные стороны',review.strengths)}${list('Риски',review.risks)}${list('Следующие действия',review.next_steps)}${list('Чего не хватает для проверки',review.missing_evidence)}</div>`;
      box.classList.remove('error');
    } catch(error) { box.classList.add('error'); box.textContent=`Не удалось получить содержательную оценку: ${error.message}`; }
    finally { button.disabled=false; }
  },true);
})();
