(() => {
  const root=document.querySelector('#public-profile');if(!root)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=value=>{try{const url=new URL(String(value||''));return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return''}};
  const roleLabels={startup:'Стартапер',investor:'Инвестор',mentor:'Наставник'};
  const id=new URLSearchParams(location.search).get('id')||'';
  if(!/^[a-f0-9]{32}$/i.test(id)){root.innerHTML='<h1>Профиль не найден</h1><p>Ссылка на профиль некорректна.</p>';return;}
  fetch(`/api/database?action=public-profile&id=${encodeURIComponent(id)}`,{credentials:'same-origin'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось загрузить профиль.');return data.profile;}).then(profile=>{
    const website=safeUrl(profile.website);let telegram=String(profile.telegram||'').trim();if(telegram&&!/^https?:\/\//i.test(telegram))telegram=`https://t.me/${telegram.replace(/^@/,'').replace(/^t\.me\//i,'')}`;telegram=safeUrl(telegram);
    const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(profile.contactEmail||''))?String(profile.contactEmail).trim():'';
    const avatar=typeof profile.avatar==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(profile.avatar)?`<img class="public-profile-avatar" src="${esc(profile.avatar)}" alt="Фото ${esc(profile.name)}">`:`<span class="public-profile-avatar public-profile-initial">${esc(String(profile.name||'У').trim().charAt(0).toLocaleUpperCase('ru'))}</span>`;
    const links=[telegram?`<a class="button" href="${esc(telegram)}" target="_blank" rel="noopener noreferrer">Telegram ↗</a>`:'',email?`<a class="button button-outline" href="mailto:${encodeURIComponent(email)}">Почта ↗</a>`:''].filter(Boolean).join('');
    root.innerHTML=`<div class="public-profile-head">${avatar}<div><span class="section-index">${esc(roleLabels[profile.role]||'Участник')}</span><h1>${esc(profile.name||'Участник')}</h1>${profile.location?`<p class="public-profile-location">${esc(profile.location)}</p>`:''}</div></div>${profile.bio?`<section class="public-profile-section"><h2>О себе</h2><p>${esc(profile.bio)}</p></section>`:''}${website?`<section class="public-profile-section"><h2>Сайт или портфолио</h2><a href="${esc(website)}" target="_blank" rel="noopener noreferrer">${esc(profile.website)} ↗</a></section>`:''}${links?`<section class="public-profile-section"><h2>Связаться</h2><div class="public-profile-contacts">${links}</div></section>`:''}${!profile.bio&&!profile.location&&!website&&!links?'<p class="public-profile-empty">Участник пока не добавил информацию в публичный профиль.</p>':''}`;
  }).catch(error=>{root.innerHTML=`<h1>Профиль не найден</h1><p>${esc(error.message||'Не удалось загрузить профиль.')}</p>`;});
})();
