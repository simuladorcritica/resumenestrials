(() => {
const E=window.EV={};
E.version=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'design-v1';
E.esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
E.norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
E.plain=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');return d.textContent};
E.safe=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');for(const n of [...d.querySelectorAll('*')]){if(!['H2','P','STRONG','EM','SUB','SUP'].includes(n.tagName))n.replaceWith(document.createTextNode(n.textContent));else for(const a of [...n.attributes])n.removeAttribute(a.name)}return d.innerHTML};
// Optional visual breaks preserve textContent, selection and source clinical HTML.
E.prose=root=>{
 const excluded='.ev-meta,.ev-count,.ev-eyebrow,.ev-kicker,.ev-trust,.ev-state,.ev-estado,.ev-strength,.ev-hint,.ev-field-error,.ev-pill,.ev-editorial-dates,.ev-turnstile-status,.ev-safe';
 for(const paragraph of root.querySelectorAll('p,:where(.ev-prose,.ev-body,article.articulo) li')){
  // The fixed archive introduction needs no extra breaks; text fragments shift when its font swaps.
  if(paragraph.matches('.ev-hero .ev-lead'))continue;
  if(paragraph.matches(excluded)||paragraph.dataset.evProseReady||getComputedStyle(paragraph).textAlign!=='justify')continue;
  const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('button,label,input,select,textarea,h1,h2,h3,th,td,summary'))nodes.push(walker.currentNode);
  for(const node of nodes){
   const fragment=document.createDocumentFragment();let cursor=0,changed=false;
   for(const match of node.data.matchAll(/[\p{L}\p{N}._:/-]{6,}/gu)){
    const word=match[0],technical=/[\d._:/-]/.test(word)||(/^[A-Z]{10,}$/.test(word)),points=new Set();
    if(technical){for(let i=3;i<word.length-2;i+=3)points.add(i);}
    else if(!/^[A-Z]+$/.test(word))for(const syllable of word.matchAll(/[aeiouáéíóúü]([bcdfghjklmnñpqrstvwxyz]+)(?=[aeiouáéíóúü])/gi)){
     const consonants=syllable[1],onset=/(?:[bcdfgpt]r|[bcfgpt]l|ch|ll|rr)$/i.test(consonants)?2:1,point=syllable.index+1+consonants.length-onset;
     if(point>=2&&word.length-point>=2)points.add(point);
    }
    fragment.append(node.data.slice(cursor,match.index));let from=0;
    for(const point of [...points].sort((a,b)=>a-b)){
     fragment.append(word.slice(from,point));const mark=document.createElement(technical?'wbr':'span');
     if(!technical){mark.className='ev-prose-break';mark.setAttribute('aria-hidden','true');}
     fragment.append(mark);from=point;changed=true;
    }
    fragment.append(word.slice(from));cursor=match.index+word.length;
   }
   if(changed){fragment.append(node.data.slice(cursor));node.replaceWith(fragment);}
  }
  paragraph.dataset.evProseReady='true';
 }
};

let records,routes,library;
E.data=()=>records??=import('/trial-data.js?v=20261003-laboratorio-v1').then(m=>m.loadTrials());
E.routes=()=>routes??=fetch('/seo-manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No se pudo cargar el índice');return r.json()});
E.library=()=>library??=import('/library-store.js?v=20261003-laboratorio-v1');
E.inferSubspecialty=r=>{const result=globalThis.SpecialtyClassification?.classify(r);return result?.specialty===globalThis.SpecialtyClassification?.REVIEW?'':result?.specialty||''};
E.ready=f=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f,{once:true}):f();
const dialogOpeners=new WeakMap();
E.open=id=>{const d=document.getElementById(id);if(d&&!d.open){if(!dialogOpeners.has(d))d.addEventListener('close',()=>{const opener=dialogOpeners.get(d);if(!d.open&&opener?.isConnected&&opener.getClientRects().length)opener.focus()});const active=document.activeElement;dialogOpeners.set(d,active&&!['BODY','HTML'].includes(active.tagName)&&active.getClientRects().length?active:document.querySelector('button[data-ev-search]'));d.showModal()}return d};
E.status=(node,text)=>{if(node)node.textContent=text};
E.searchable=r=>E.norm([r.titulo,r.autor,r.revista,r.anio,r.doi,r.registro,r.especialidad_principal,r.especialidad_secundaria,...(r.temas||[])].join(' '));
E.areas=r=>{const a=[r.especialidad_principal,r.especialidad_secundaria,E.inferSubspecialty(r)].filter(Boolean),internal=['Cardiología','Cirugía','Endocrinología','Enfermedades Infecciosas','Gastroenterología','Geriatría','Hematología','Infectología','Medicina de Urgencias','Medicina Física y Rehabilitación','Nefrología','Neumología','Neurología','Oncología','Oftalmología','Reumatología','VIH'];if(internal.includes(r.especialidad_principal))a.push('Medicina Interna');return [...new Set(a)]};
E.facts=r=>'<dl class="ev-study-facts">'+[['revista','Revista'],['anio','Año'],['fecha','Fecha'],['tipo_estudio','Tipo de estudio'],['especialidad_principal','Especialidad'],['especialidad_secundaria','Especialidad secundaria'],['temas','Temas'],['registro','Registro'],['doi','DOI'],['financiacion','Financiación']].filter(([k])=>r[k]!==''&&r[k]!=null&&(!Array.isArray(r[k])||r[k].length)).map(([k,label])=>'<div><dt>'+label+'</dt><dd data-ev-field="'+k+'">'+E.esc(Array.isArray(r[k])?r[k].join(' · '):r[k])+'</dd></div>').join('')+'</dl>';
E.card=(r,path)=>'<li class="ev-card" data-id="'+r.id+'"><div><a href="'+E.esc(path)+'" data-ev-read="'+r.id+'"><h2>'+E.esc(r.titulo)+'</h2></a></div><div class="ev-meta">'+E.esc(r.revista)+' · '+E.esc(r.fecha)+'<br>'+E.esc(r.especialidad_principal)+'<br>'+E.esc((r.temas||[]).join(' · '))+'<details><summary>Ficha del estudio</summary>'+E.facts(r)+'</details></div><div class="ev-card-foot"><a href="'+E.esc(path)+'" data-ev-read="'+r.id+'">Leer ensayo →</a><button class="ev-icon" type="button" data-ev-card-pdf="'+r.id+'" aria-label="Descargar resumen completo PDF de '+E.esc(r.titulo)+'">↓</button></div></li>';
E.pdf=async(r,brief=false,format=innerWidth<720?'mobile':'a4')=>{const m=await import('/ui/pdf.js?v='+E.version);return m.generatePDF(r,{brief,format})};
E.ready(()=>{
 const root=document.documentElement,menu=document.getElementById('ev-navigation');
 E.prose(document);
 document.querySelectorAll('button[data-ev-theme]').forEach(b=>{const sync=()=>{b.setAttribute('aria-label',root.dataset.evTheme==='claro'?'Cambiar a tema oscuro':'Cambiar a tema claro')};sync();b.onclick=()=>{const t=root.dataset.evTheme==='claro'?'oscuro':'claro';root.dataset.evTheme=t;try{localStorage.setItem('rt-tema',t)}catch{}document.querySelectorAll('button[data-ev-theme]').forEach(x=>x.setAttribute('aria-label',t==='claro'?'Cambiar a tema oscuro':'Cambiar a tema claro'))}});
 document.querySelector('[data-ev-menu]')?.addEventListener('click',e=>{const on=menu.classList.toggle('ev-open');e.currentTarget.setAttribute('aria-expanded',String(on))});
 document.querySelectorAll('[data-ev-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
 document.querySelectorAll('[data-ev-specialties]').forEach(b=>b.onclick=()=>E.open('ev-specialties'));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();const dialogs=document.querySelectorAll('dialog[open]'),overlay=dialogs.length||menu.classList.contains('ev-open');dialogs.forEach(d=>d.close());menu.classList.remove('ev-open');document.querySelector('[data-ev-menu]')?.setAttribute('aria-expanded','false');if(!overlay&&document.body.classList.contains('ev-focus'))document.querySelector('[data-ev-focus]')?.click()}});
 const box=document.getElementById('ev-search-input'),list=document.getElementById('ev-search-results'),status=document.getElementById('ev-search-status');let timer,searchEpoch=0;
 const highlight=(s,q)=>{const i=E.norm(s).indexOf(q);return i<0?E.esc(s):E.esc(s.slice(0,i))+'<mark>'+E.esc(s.slice(i,i+q.length))+'</mark>'+E.esc(s.slice(i+q.length))};
 async function search(){const epoch=++searchEpoch,q=E.norm(box.value.trim());if(!q){list.innerHTML='';status.textContent='Busca por ensayo, autor, DOI, registro o tema.';return}try{const[rows,map]=await Promise.all([E.data(),E.routes()]);if(epoch!==searchEpoch)return;const matches=rows.filter(r=>E.searchable(r).includes(q));list.innerHTML=matches.slice(0,20).map(r=>'<li><a href="'+E.esc(map[String(r.id)].path)+'" data-ev-read="'+r.id+'"><b>'+highlight(r.titulo,q)+'</b><small>'+highlight([r.revista,r.anio,r.doi,r.registro].filter(Boolean).join(' · '),q)+'</small></a></li>').join('');status.textContent=matches.length?matches.length+' resultados'+(matches.length>20?' · Mostrando 20':''):'Sin resultados. Prueba «sepsis», «SOHO» o el año del estudio.'}catch{status.textContent='No pudimos cargar el buscador. Puedes explorar el archivo.'}}
 box.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,100)});const openSearch=()=>{E.open('ev-search');box.focus();search()};document.querySelectorAll('[data-ev-search]').forEach(b=>b.onclick=openSearch);
 document.addEventListener('keydown',e=>{const active=document.activeElement,editing=!!active?.getClientRects().length&&(/INPUT|TEXTAREA|SELECT/.test(active.tagName)||active.isContentEditable);if((e.key==='/'&&!editing)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){e.preventDefault();openSearch()}});
 box.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('a')?.focus()}else if(e.key==='Enter'&&list.querySelector('a')){e.preventDefault();list.querySelector('a').click()}});
 list.addEventListener('keydown',e=>{const links=[...list.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowDown'?1:-1)+links.length)%links.length;links[next]?.focus()}});
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-ev-card-pdf]');if(!b)return;b.disabled=true;try{const r=(await E.data()).find(r=>String(r.id)===b.dataset.evCardPdf);await E.pdf(r)}catch{b.setAttribute('aria-label','No se pudo descargar. Intenta de nuevo.')}finally{b.disabled=false}});
 document.querySelectorAll('.ev-header-nav a').forEach(a=>{if(a.pathname===location.pathname)a.setAttribute('aria-current','page')});
});
})();


