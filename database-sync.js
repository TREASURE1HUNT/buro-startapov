(() => {
  const banned=new Set(['buro-demo-account','buro-browser-users-v1','buro-startapov-projects-v1']);
  const originalSet=Storage.prototype.setItem,originalRemove=Storage.prototype.removeItem;
  const send=body=>fetch('/api/database',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  async function hydrate(){
    try{
      const response=await fetch('/api/database?action=state',{credentials:'same-origin'});
      if(response.status===401){const account=JSON.parse(localStorage.getItem('buro-demo-account')||'null'),users=JSON.parse(localStorage.getItem('buro-browser-users-v1')||'[]'),legacy=users.find(user=>user.email===account?.email);if(account&&legacy?.salt&&legacy?.passwordHash){const records={};for(const key of Object.keys(localStorage))if(key.startsWith('buro-')&&!banned.has(key))try{records[key]=JSON.parse(localStorage.getItem(key))}catch{};const projects=JSON.parse(localStorage.getItem('buro-startapov-projects-v1')||'[]').filter(p=>String(p.ownerEmail||'').toLowerCase()===String(account.email).toLowerCase());const migrated=await fetch('/api/database',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'migrate-legacy',email:account.email,name:account.name||legacy.name,role:account.role||legacy.role,legacySalt:legacy.salt,legacyHash:legacy.passwordHash,profile:{investorFocus:legacy.investorFocus||'',ticketSize:legacy.ticketSize||'',bio:account.bio||'',avatar:account.avatar||''},records,projects})});if(migrated.ok){const state=await migrated.json();originalSet.call(localStorage,'buro-demo-account',JSON.stringify(state.account));for(const [key,value] of Object.entries(state.records||{}))originalSet.call(localStorage,key,JSON.stringify(value));originalSet.call(localStorage,'buro-startapov-projects-v1',JSON.stringify(state.projects||[]));location.reload();}}return;}
      if(!response.ok)return;
      const state=await response.json();if(!state.account)return;
      let changed=false;const set=(key,value)=>{const encoded=JSON.stringify(value);if(localStorage.getItem(key)!==encoded){originalSet.call(localStorage,key,encoded);changed=true;}};
      set('buro-demo-account',state.account);
      for(const [key,value] of Object.entries(state.records||{}))set(key,value);
      const prior=JSON.parse(localStorage.getItem('buro-startapov-projects-v1')||'[]');const retained=prior.filter(project=>String(project.ownerEmail||'').toLowerCase()!==state.account.email);const combined=[...retained,...(state.projects||[])];set('buro-startapov-projects-v1',combined);
      if(changed){const sig=JSON.stringify([state.account.email,state.projects?.map(p=>p.id),Object.keys(state.records||{}).sort()]);if(sessionStorage.getItem('buro-db-hydrated')!==sig){sessionStorage.setItem('buro-db-hydrated',sig);location.reload();}}
    }catch{}
  }
  hydrate();
  Storage.prototype.setItem=function(key,value){originalSet.call(this,key,value);if(this!==localStorage||!String(key).startsWith('buro-')||banned.has(String(key)))return;let parsed;try{parsed=JSON.parse(String(value))}catch{return}send({action:'record',key:String(key),value:parsed});};
  Storage.prototype.removeItem=function(key){originalRemove.call(this,key);if(this===localStorage&&String(key).startsWith('buro-')&&!banned.has(String(key)))send({action:'record',key:String(key),remove:true});};
  window.BuroDatabase={request:send,hydrate};
})();
