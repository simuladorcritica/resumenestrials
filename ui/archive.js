(() => {const E=window.EV;E.ready(async()=>{
 const root=document.querySelector('[data-ev-ids]');if(!root)return;
 try{
  const[all,map,dates]=await Promise.all([E.data(),E.routes(),import('/trial-data.js?v=20261003-laboratorio-v1')]);
  const ids=new Set(root.dataset.evIds.split(',')),rows=all.filter(r=>ids.has(String(r.id))),nodes=new Map([...document.querySelectorAll('#ev-list>.ev-card')].map(n=>[n.dataset.id,n]));
  const $=id=>document.getElementById(id),list=$('ev-list'),count=$('ev-count'),q=$('ev-q'),more=$('ev-more'),sort=$('ev-sort'),view=$('ev-view'),chips=$('ev-chips'),empty=$('ev-empty'),panel=$('ev-filters'),toggle=root.querySelector('[data-ev-filters]'),badge=root.querySelector('[data-ev-filter-count]');
  const selects=[...root.querySelectorAll('select[data-ev-filter]')],radios=[...root.querySelectorAll('input[name="ev-area"]')];
  const area={key:'area',id:'ev-area',label:'Especialidad',get value(){return radios.find(r=>r.checked)?.value||''},set value(v){for(const r of radios)r.checked=r.value===v;if(radios.length&&!radios.some(r=>r.checked))radios[0].checked=true}};
  const labels={sub:'Subespecialidad',topic:'Tema',year:'Año',journal:'Revista',type:'Tipo'},keys={area:'esp',sub:'sub',topic:'tema',year:'anio',journal:'revista',type:'tipo'};
  const values={area:r=>E.areas(r),sub:r=>E.areas(r).filter(a=>!E.MAIN.includes(a)),topic:r=>r.temas||[],year:r=>[String(r.anio)],journal:r=>[r.revista],type:r=>[r.tipo_estudio]};
  const filters=[...(radios.length?[area]:[]),...selects.map(s=>({key:s.dataset.evFilter,id:s.id,label:labels[s.dataset.evFilter],get value(){return s.value},set value(v){s.value=v}}))];
  const pageSize=24;let limit=pageSize,timer,scrolled=false;
  for(const r of rows){const inferred=E.inferSubspecialty(r),node=nodes.get(String(r.id));if(inferred&&node&&!node.querySelector('[data-ev-subspecialty]')){const tag=document.createElement('span');tag.className='ev-tag';tag.dataset.evSubspecialty='true';tag.textContent=inferred;node.querySelector('.ev-card-tags').append(tag)}}
  for(const s of selects){const key=s.dataset.evFilter,unique=[...new Set(rows.flatMap(values[key]).filter(Boolean))].sort((a,b)=>key==='year'?Number(b)-Number(a):a.localeCompare(b,'es'));s.innerHTML='<option value="">Todos</option>'+unique.map(v=>'<option value="'+E.esc(v)+'">'+E.esc(v)+' ('+rows.filter(r=>values[key](r).includes(v)).length+')</option>').join('')}
  const has=(f,v)=>f.key==='area'?radios.some(r=>r.value===v):[...$(f.id).options].some(o=>o.value===v);
  function fromURL(){
   const p=new URLSearchParams(location.search);q.value=p.get('q')||'';q.dispatchEvent(new Event('ev-sync'));
   for(const f of filters){const v=p.get(keys[f.key])||'';f.value=has(f,v)?v:''}
   // Legacy links used esp= for any clinical area; keep them working.
   const legacy=p.get('esp');if(legacy&&!E.MAIN.includes(legacy)){const sub=filters.find(f=>f.key==='sub');if(sub&&has(sub,legacy))sub.value=legacy}
   sort.value=p.get('orden')||'date';const dense=p.get('vista')==='lista';root.classList.toggle('ev-dense',dense);syncView(dense);limit=Math.max(pageSize,Number(p.get('n'))||pageSize);
  }
  function syncView(dense){const label=dense?'Vista en tarjetas':'Vista compacta';view.setAttribute('aria-pressed',String(dense));view.setAttribute('aria-label',label);view.querySelector('span').textContent=label}
  function url(){const u=new URL(location.href);u.hash='';for(const k of ['q',...Object.values(keys),'orden','vista','n'])u.searchParams.delete(k);if(q.value.trim())u.searchParams.set('q',q.value.trim());for(const f of filters)if(f.value)u.searchParams.set(keys[f.key],f.value);if(sort.value!=='date')u.searchParams.set('orden',sort.value);if(root.classList.contains('ev-dense'))u.searchParams.set('vista','lista');if(limit>pageSize)u.searchParams.set('n',String(limit));return u}
  function render(push=false){
   const term=E.norm(q.value.trim());
   let chosen=rows.filter(r=>(!term||E.searchable(r).includes(term))&&filters.every(f=>!f.value||values[f.key](r).includes(f.value)));
   chosen=chosen.slice().sort(sort.value==='title'?(a,b)=>a.titulo.localeCompare(b.titulo,'es'):sort.value==='journal'?(a,b)=>a.revista.localeCompare(b.revista,'es')||a.titulo.localeCompare(b.titulo,'es'):dates.compareTrialDates);
   const selected=new Set(chosen.slice(0,limit).map(r=>String(r.id)));for(const r of chosen){const n=nodes.get(String(r.id));if(n)list.append(n)}for(const[id,n]of nodes)n.hidden=!selected.has(id);
   count.textContent=chosen.length+' de '+rows.length+' resúmenes';
   const rest=chosen.length-limit;more.hidden=rest<=0;more.textContent='Mostrar '+Math.min(pageSize,Math.max(rest,0))+' más · quedan '+Math.max(rest,0);
   empty.hidden=chosen.length!==0;
   const active=filters.filter(f=>f.value),advanced=active.filter(f=>f.key!=='area').length;
   if(badge){badge.hidden=!advanced;badge.textContent=String(advanced)}
   chips.innerHTML=active.map(f=>'<button class="ev-chip ev-chip-active" type="button" data-ev-clear="'+f.id+'" aria-label="Quitar filtro '+E.esc(f.label+': '+f.value)+'"><span>'+E.esc(f.value)+'</span>'+E.icon('close')+'</button>').join('')+(q.value.trim()?'<button class="ev-chip ev-chip-active" type="button" data-ev-clear="ev-q" aria-label="Quitar búsqueda"><span>«'+E.esc(q.value.trim())+'»</span>'+E.icon('close')+'</button>':'')+((active.length+(q.value.trim()?1:0))>1?'<button class="ev-chip ev-chip-ghost" type="button" data-ev-reset>Limpiar todo</button>':'');
   const topic=filters.find(f=>f.key==='topic')?.value||'';for(const b of root.querySelectorAll('[data-ev-topic]'))b.setAttribute('aria-pressed',String(b.dataset.evTopic===topic));
   if(push&&url().href!==location.href.replace(/#.*$/,''))history.pushState(null,'',url());
  }
  function update(){limit=pageSize;render(true)}
  function reset(){q.value='';q.dispatchEvent(new Event('ev-sync'));for(const f of filters)f.value='';update()}
  q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,120);
   if(!q.value.trim()){scrolled=false;return}
   if(!scrolled){scrolled=true;const top=root.getBoundingClientRect().top;if(top>innerHeight*.55||top<-root.offsetHeight+innerHeight)root.scrollIntoView({behavior:E.reduced()?'auto':'smooth',block:'start'})}
  });
  for(const s of selects)s.onchange=update;for(const r of radios)r.onchange=update;sort.onchange=()=>render(true);
  view.onclick=()=>{const on=root.classList.toggle('ev-dense');syncView(on);render(true)};
  more.onclick=()=>{limit+=pageSize;render(true)};
  toggle?.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('select')?.focus()});
  root.addEventListener('click',e=>{
   const clear=e.target.closest('[data-ev-clear]');if(clear){const id=clear.dataset.evClear;if(id==='ev-q'){q.value='';q.dispatchEvent(new Event('ev-sync'))}else{const f=filters.find(f=>f.id===id);if(f)f.value=''}update();(chips.querySelector('button')||q).focus();return}
   if(e.target.closest('[data-ev-reset]')){reset();return}
   const preset=e.target.closest('[data-ev-preset]');if(preset){q.value='';q.dispatchEvent(new Event('ev-sync'));for(const f of filters)f.value=f.key==='area'?'Medicina Crítica':f.key==='year'?preset.dataset.evPreset:'';update();return}
   const topic=e.target.closest('[data-ev-topic]');if(topic){const f=filters.find(f=>f.key==='topic');if(f){f.value=f.value===topic.dataset.evTopic?'':topic.dataset.evTopic;update()}}
  });
  window.addEventListener('popstate',()=>{fromURL();render()});fromURL();render();
  if(location.hash==='#ev-archivo'&&q.value)requestAnimationFrame(()=>root.scrollIntoView({block:'start'}));
 }catch(error){E.archiveError=error;document.getElementById('ev-count').textContent='Archivo disponible · filtros no disponibles. Recarga para reintentar.'}
})})();
