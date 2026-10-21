(() => {
  const accountKey='buro-demo-account', usersKey='buro-browser-users-v1', projectKey='buro-startapov-projects-v1';
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
  const records=()=>Object.fromEntries(Object.keys(localStorage).filter(key=>key.startsWith('buro-')&&!key.startsWith('buro-community-')&&!['buro-demo-account','buro-browser-users-v1',projectKey].includes(key)).map(key=>[key,read(key,null)]));
  const projectsFor=email=>read(projectKey,[]).filter(item=>String(item.ownerEmail||'').toLowerCase()===email);
  const call=async body=>{const response=await fetch('/api/database',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Ошибка сервера.'),{status:response.status});return data;};
  function cacheState(data){if(data.account)localStorage.setItem(accountKey,JSON.stringify(data.account));for(const [key,value] of Object.entries(data.records||{}))localStorage.setItem(key,JSON.stringify(value));if(Array.isArray(data.projects)){const local=read(projectKey,[]).filter(p=>String(p.ownerEmail||'').toLowerCase()!==data.account?.email);localStorage.setItem(projectKey,JSON.stringify([...local,...data.projects]));}localStorage.removeItem(usersKey);}
  const register=document.querySelector('#register-form');
  if(location.hash==='#investor'){const option=document.querySelector('input[name=role][value=investor]');if(option){option.checked=true;option.dispatchEvent(new Event('change',{bubbles:true}));}}
  if(register)register.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();if(!register.reportValidity())return;const result=document.querySelector('#register-result');
    const name=register.elements.fullName.value.trim(),email=register.elements.email.value.trim().toLowerCase(),password=register.elements.password.value,role=register.elements.role.value;
    if(password!==register.elements.passwordConfirm.value){result.textContent='Пароли не совпадают — проверьте оба поля.';result.dataset.state='error';register.elements.passwordConfirm.focus();return;}
    try{const data=await call({action:'register',name,email,password,role,investorFocus:register.elements.investorFocus?.value.trim()||'',ticketSize:register.elements.ticketSize?.value.trim()||'',records:records(),projects:projectsFor(email)});cacheState(data);result.textContent='Аккаунт и данные сохранены в базе Netlify. Открываю профиль…';setTimeout(()=>location.href='profile.html',350);}
    catch(error){result.textContent=error.message;result.dataset.state='error';}
  },true);
  const login=document.querySelector('#login-form');
  if(login)login.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();if(!login.reportValidity())return;const result=document.querySelector('#login-result');
    const email=login.elements.email.value.trim().toLowerCase(),password=login.elements.password.value;
    try{let data;try{data=await call({action:'login',email,password});}
      catch(error){if(error.status!==401)throw error;const old=read(usersKey,[]).find(user=>user.email===email);if(!old?.salt||!old.passwordHash)throw error;
        const enc=new TextEncoder(),salt=Uint8Array.from(old.salt.match(/.{2}/g).map(byte=>parseInt(byte,16))),key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256),hash=[...new Uint8Array(bits)].map(byte=>byte.toString(16).padStart(2,'0')).join('');if(hash!==old.passwordHash)throw error;
        data=await call({action:'register',name:old.name||email.split('@')[0],email,password,role:old.role||'startup',investorFocus:old.investorFocus||'',ticketSize:old.ticketSize||'',records:records(),projects:projectsFor(email)});
      }
      cacheState(data);result.textContent='Вход выполнен. Профиль и данные загружены из базы Netlify…';setTimeout(()=>{const next=new URLSearchParams(location.search).get('next');location.href=next==='create.html'?'create.html':'profile.html';},300);
    }catch(error){result.textContent=error.status===401?'Неверный email или пароль.':error.message;result.dataset.state='error';}
  },true);
})();

(() => { const roles=document.querySelectorAll('input[name=role]'),extra=document.querySelector('.investor-extra');const update=()=>{if(extra)extra.hidden=document.querySelector('input[name=role]:checked')?.value!=='investor'};roles.forEach(input=>input.addEventListener('change',update));update();})();
