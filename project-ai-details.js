(() => {
  const root=document.querySelector('#project-detail');if(!root)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const enhance=()=>{
    const card=root.querySelector('.ai-score-card');if(!card||card.dataset.detailed==='true')return;
    let project;try{project=JSON.parse(localStorage.getItem('buro-startapov-projects-v1')||'[]').find(item=>item.id===new URLSearchParams(location.search).get('id'))}catch{}
    let review=null, metadata={};try{review=JSON.parse(root.dataset.aiEvaluation||'null');metadata=JSON.parse(root.dataset.projectMetadata||'{}');if(!review?.rubric?.length)review=null}catch{}
    try{const slug=(project?.name||'').toLowerCase().replace(/[^a-zа-я0-9]+/gi,'-').replace(/^-|-$/g,'');review=review||JSON.parse(localStorage.getItem(`buro-ai-review-${slug}`)||'null')}catch{}
    const imported=project?.importedListing?project:metadata;if(imported?.importedListing&&imported.source&&!root.querySelector('.imported-source-note')){const source=document.createElement('p');source.className='field-hint imported-source-note';source.textContent=`Открытая карточка каталога · источник: ${imported.sourceName||'Unicorn Base'} · снимок ${imported.sourceCheckedAt||''}`;root.querySelector('.detail-meta')?.after(source);}
    if(!review)return;card.dataset.detailed='true';
    card.innerHTML=`<h3>ОЦЕНКА ИИ · 25% ИТОГОВОГО ВЕСА</h3><p><b>${Number(review.score)} / 100</b> · ${esc(review.summary||'')}</p><p class="community-score-caption">Итоговая формула использует долю ИИ 25%; балл ИИ отдельно рассчитывается по рубрике.</p><ol class="ai-project-criteria">${(review.rubric||[]).map(item=>`<li><span><b>${esc(item.label)}</b><small>${esc(item.evidence||'Данные не представлены.')}${item.gap?` Пробел: ${esc(item.gap)}`:''}</small></span><strong>${Number(item.score)}</strong></li>`).join('')}</ol><div class="ai-project-lists">${[['Сильные стороны',review.strengths],['Риски',review.risks],['Следующие действия',review.next_steps],['Не хватает данных',review.missing_evidence]].map(([label,items])=>`<section><b>${label}</b><ul>${(items||[]).map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`).join('')}</div>`;
  };
  new MutationObserver(enhance).observe(root,{childList:true,subtree:true});enhance();
})();
