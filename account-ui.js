(() => {
  let account;try{account=JSON.parse(localStorage.getItem('buro-demo-account')||'null')}catch{}
  if(!account)return;
  const header=document.querySelector('.header-actions');if(!header)return;
  document.querySelectorAll('.nav a[href="register.html"]').forEach(link=>link.remove());
  const nav=document.querySelector('.nav');
  if(nav&&!nav.querySelector('a[href="investors.html"]')){const investors=document.createElement('a');investors.href='investors.html';investors.textContent='Инвесторы';const create=nav.querySelector('a[href="create.html"]');nav.insertBefore(investors,create||null);}
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const image=typeof account.avatar==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(account.avatar)?`<img src="${escape(account.avatar)}" alt="">`:'';
  const initial=String(account.name||account.fullName||'У').trim().charAt(0).toLocaleUpperCase('ru');
  const pill=document.createElement('a');pill.className='header-account-pill';pill.href='profile.html';pill.setAttribute('aria-label','Открыть профиль '+String(account.name||'участника'));pill.innerHTML=`<span class="header-account-avatar">${image||`<b>${escape(initial)}</b>`}</span><span>${escape(account.name||'Профиль')}</span>`;
  header.querySelectorAll('a.login').forEach(link=>link.remove());header.insertBefore(pill,header.querySelector('.menu-toggle')||null);
})();
