(() => {
const E=window.EV={};
const root=document.documentElement;
E.version=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'nova-v1';
E.esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
E.norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
E.plain=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');return d.textContent};
E.safe=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');for(const n of [...d.querySelectorAll('*')]){if(!['H2','P','STRONG','EM','SUB','SUP'].includes(n.tagName))n.replaceWith(document.createTextNode(n.textContent));else for(const a of [...n.attributes])n.removeAttribute(a.name)}return d.innerHTML};
E.reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
// Optional visual breaks preserve textContent, selection and the source clinical HTML.
E.prose=scope=>{
 for(const paragraph of scope.querySelectorAll('p,:where(.ev-prose,.ev-body,article.articulo) li,.ev-justify')){
  if(paragraph.matches('.ev-hero .ev-lead'))continue;
  if(paragraph.dataset.evProseReady||getComputedStyle(paragraph).textAlign!=='justify')continue;
  const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('a,button,label,input,select,textarea,h1,h2,h3,th,td,summary'))nodes.push(walker.currentNode);
  for(const node of nodes){
   const fragment=document.createDocumentFragment();let cursor=0,changed=false;
   for(const match of node.data.matchAll(/[\p{L}\p{N}._:/-]{6,}/gu)){
    // Trailing punctuation is not part of a technical token ("consultar." stays a word).
    const raw=match[0],word=raw.replace(/[._:/-]+$/,''),tail=raw.slice(word.length);if(word.length<6)continue;
    const technical=/[\d._:/-]/.test(word)||(/^[A-Z]{10,}$/.test(word)),points=new Set();
    if(technical){for(let i=3;i<word.length-2;i+=3)points.add(i);}
    else if(!/^[A-Z]+$/.test(word))for(const syllable of word.matchAll(/[aeiouáéíóúü]([bcdfghjklmnñpqrstvwxyz]+)(?=[aeiouáéíóúü])/gi)){
     const consonants=syllable[1],onset=/(?:[bcdfgpt]r|[bcfgpt]l|ch|ll|rr|dr|tl)$/i.test(consonants)?2:1,point=syllable.index+1+consonants.length-onset;
     if(point>=2&&word.length-point>=2)points.add(point);
    }
    fragment.append(node.data.slice(cursor,match.index));let from=0;
    for(const point of [...points].sort((a,b)=>a-b)){
     fragment.append(word.slice(from,point));const mark=document.createElement(technical?'wbr':'span');
     if(!technical){mark.className='ev-prose-break';mark.setAttribute('aria-hidden','true');}
     fragment.append(mark);from=point;changed=true;
    }
    fragment.append(word.slice(from)+tail);cursor=match.index+raw.length;
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
E.open=id=>{const d=document.getElementById(id);if(d&&!d.open){if(!dialogOpeners.has(d))d.addEventListener('close',()=>{const opener=dialogOpeners.get(d);if(!d.open&&opener?.isConnected&&opener.getClientRects().length)opener.focus()});const active=document.activeElement;dialogOpeners.set(d,active&&!['BODY','HTML'].includes(active.tagName)&&active.getClientRects().length?active:null);d.showModal()}return d};
E.status=(node,text)=>{if(node)node.textContent=text};
E.searchable=r=>E.norm([r.titulo,r.autor,r.revista,r.anio,r.doi,r.registro,r.especialidad_principal,r.especialidad_secundaria,...(r.temas||[])].join(' '));
const INTERNAL=['Cardiología','Cirugía','Endocrinología','Enfermedades Infecciosas','Gastroenterología','Geriatría','Hematología','Infectología','Medicina de Urgencias','Medicina Física y Rehabilitación','Nefrología','Neumología','Neurología','Oncología','Oftalmología','Reumatología','VIH'],MAIN=['Medicina Crítica','Medicina Interna'];
E.MAIN=MAIN;
E.areas=r=>{const a=[r.especialidad_principal,r.especialidad_secundaria,E.inferSubspecialty(r)].filter(Boolean);if(INTERNAL.includes(r.especialidad_principal))a.push('Medicina Interna');return [...new Set(a)]};
E.area=r=>{const p=E.plain(r.especialidad_principal).trim(),s=E.plain(r.especialidad_secundaria).trim();return MAIN.includes(p)?p:INTERNAL.includes(p)?'Medicina Interna':MAIN.includes(s)?s:p||'Evidencia clínica'};
E.tone=area=>({'Medicina Crítica':'critica','Medicina Interna':'interna'}[area]||'neutral');
E.minutes=html=>Math.max(1,Math.round((E.plain(html).match(/[\p{L}\p{N}_]+/gu)||[]).length/230));
const ICONS={pdf:'<path d="M12 3.5v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4.5 16.5v3h15v-3"/>',clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',left:'<path d="M19 12H5M11 6l-6 6 6 6"/>',right:'<path d="M5 12h14M13 6l6 6-6 6"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',read:'<path d="M3 5.5c3.5-1 6.5-.5 9 1.5 2.5-2 5.5-2.5 9-1.5v13c-3.5-1-6.5-.5-9 1.5-2.5-2-5.5-2.5-9-1.5z"/><path d="M12 7v13"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',bookmark:'<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',share:'<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4"/>',text:'<path d="M4 18 9 6l5 12M5.7 14h6.6"/><path d="M15 18l3-7 3 7M15.8 16h4.4"/>',external:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>'};
E.icon=name=>'<svg class="ev-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+ICONS[name]+'</svg>';
E.humanDate=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/),months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return m&&months[Number(m[2])-1]?Number(m[3])+' de '+months[Number(m[2])-1]+' de '+m[1]:String(value||'')};
E.readtime=r=>E.icon('clock')+'<span>Completo '+E.minutes(r.cuerpo)+' min</span>'+(r.corto?'<span>Breve '+E.minutes(r.corto)+' min</span>':'');
E.facts=r=>'<dl class="ev-study-facts">'+[['revista','Revista'],['anio','Año'],['fecha','Fecha'],['tipo_estudio','Tipo de estudio'],['especialidad_principal','Especialidad'],['especialidad_secundaria','Especialidad secundaria'],['temas','Temas'],['registro','Registro'],['doi','DOI'],['financiacion','Financiación']].filter(([k])=>r[k]!==''&&r[k]!=null&&(!Array.isArray(r[k])||r[k].length)).map(([k,label])=>'<div><dt>'+label+'</dt><dd data-ev-field="'+k+'">'+E.esc(Array.isArray(r[k])?r[k].join(' · '):r[k])+'</dd></div>').join('')+'</dl>';
E.card=(r,path)=>{const area=E.area(r),tone=E.tone(area),t=E.esc(r.titulo),p=E.esc(path),topics=(r.temas||[]).join(' · ');return '<li class="ev-card" data-id="'+r.id+'" data-tone="'+tone+'"><a class="ev-card-title" href="'+p+'" data-ev-read="'+r.id+'"><h2>'+t+'</h2></a><p class="ev-card-meta"><span>'+E.esc(r.revista)+'</span><span>'+E.esc(E.humanDate(r.fecha))+'</span></p><div class="ev-card-tags"><span class="ev-area" data-tone="'+tone+'">'+E.esc(area)+'</span></div>'+(topics?'<p class="ev-card-topics">'+E.esc(topics)+'</p>':'')+'<details class="ev-card-facts"><summary>Ficha del estudio</summary>'+E.facts(r)+'</details><div class="ev-card-foot"><p class="ev-readtime">'+E.readtime(r)+'</p><div class="ev-card-actions"><a class="ev-btn ev-btn-primary" href="'+p+'" data-ev-read="'+r.id+'" aria-label="Leer resumen: '+t+'">Leer</a><details class="ev-pdf-menu"><summary class="ev-btn" aria-label="Descargar PDF de '+t+'">'+E.icon('pdf')+'<span>PDF</span></summary><div class="ev-pdf-pop"><button type="button" data-ev-card-pdf="'+r.id+'" data-ev-version="completo" aria-label="Descargar resumen completo PDF de '+t+'">PDF completo</button><button type="button" data-ev-card-pdf="'+r.id+'" data-ev-version="breve" aria-label="Descargar resumen breve PDF de '+t+'">PDF breve</button></div></details></div></div></li>'};
E.device=()=>root.dataset.evDevice||(innerWidth<720?'movil':innerWidth<1100?'tableta':'escritorio');
E.defaultFormat=()=>E.device()==='movil'?'mobile':'a4';
E.pdf=async(r,brief=false,format=E.defaultFormat())=>{const m=await import('/ui/pdf.js?v='+E.version);return m.generatePDF(r,{brief,format})};
E.ready(()=>{
 const header=document.querySelector('.ev-header');
 E.prose(document);
 // Device and pointer type adapt defaults (PDF format, hints) without changing content.
 let resizeTimer;const detect=()=>{const w=innerWidth;root.dataset.evDevice=w<720?'movil':w<1100?'tableta':'escritorio';root.dataset.evPointer=matchMedia('(pointer:coarse)').matches?'tactil':'raton'};detect();addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(detect,150)},{passive:true});
 // Theme
 const syncTheme=()=>{const light=root.dataset.evTheme==='claro';document.querySelectorAll('button[data-ev-theme]').forEach(b=>b.setAttribute('aria-label',light?'Cambiar a tema oscuro':'Cambiar a tema claro'))};syncTheme();
 document.querySelectorAll('button[data-ev-theme]').forEach(b=>b.onclick=()=>{const t=root.dataset.evTheme==='claro'?'oscuro':'claro';root.dataset.evTheme=t;try{localStorage.setItem('rt-tema',t)}catch{}syncTheme()});
 // Menus and dialogs
 const menuButtons=[...document.querySelectorAll('[data-ev-menu]')],menu=document.getElementById('ev-menu');
 menuButtons.forEach(b=>b.onclick=()=>{E.open('ev-menu');menuButtons.forEach(x=>x.setAttribute('aria-expanded','true'))});
 menu?.addEventListener('close',()=>menuButtons.forEach(x=>x.setAttribute('aria-expanded','false')));
 document.querySelectorAll('[data-ev-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
 document.querySelectorAll('[data-ev-specialties]').forEach(b=>b.onclick=()=>E.open('ev-specialties'));
 const here=location.pathname.replace(/index\.html$/,'');
 document.querySelectorAll('.ev-header-nav a,.ev-menu-list a,.ev-mobile-nav a').forEach(a=>{if(a.pathname===here)a.setAttribute('aria-current','page')});
 // Single search: filters the page list, or shows instant results elsewhere.
 const form=document.querySelector('[data-ev-search-form]'),box=document.getElementById('ev-q'),panel=document.getElementById('ev-search-panel'),results=document.getElementById('ev-search-results'),status=document.getElementById('ev-search-status'),all=document.getElementById('ev-search-all'),clear=form?.querySelector('[data-ev-search-clear]'),mode=document.body.dataset.evSearchMode||'quick';
 let timer,epoch=0;
 const showPanel=on=>{if(!panel)return;panel.hidden=!on;form.classList.toggle('ev-search-open',on)};
 const highlight=(s,q)=>{const n=E.norm(s),i=n.indexOf(q);return i<0?E.esc(s):E.esc(s.slice(0,i))+'<mark>'+E.esc(s.slice(i,i+q.length))+'</mark>'+E.esc(s.slice(i+q.length))};
 async function search(){
  const id=++epoch,raw=box.value.trim(),q=E.norm(raw);
  if(!q){results.innerHTML='';status.textContent='';showPanel(false);return}
  showPanel(true);status.textContent='Buscando…';all.href='/?q='+encodeURIComponent(raw)+'#ev-archivo';
  try{const[rows,map]=await Promise.all([E.data(),E.routes()]);if(id!==epoch)return;const matches=rows.filter(r=>E.searchable(r).includes(q));
   results.innerHTML=matches.slice(0,8).map(r=>{const area=E.area(r);return '<li><a href="'+E.esc(map[String(r.id)].path)+'" data-ev-read="'+r.id+'"><span class="ev-result-dot" data-tone="'+E.tone(area)+'" aria-hidden="true"></span><span class="ev-result-text"><b>'+highlight(r.titulo,q)+'</b><small>'+highlight([r.revista,r.anio,r.doi,r.registro].filter(Boolean).join(' · '),q)+'</small></span></a></li>'}).join('');
   status.textContent=matches.length?matches.length+(matches.length===1?' resultado':' resultados')+(matches.length>8?' · mostrando 8':''):'Sin resultados. Prueba «sepsis», el nombre corto del estudio o el año.';all.hidden=!matches.length;
  }catch{if(id===epoch)status.textContent='No pudimos cargar el buscador. Puedes explorar el archivo.'}
 }
 if(box){
  const setPlaceholder=()=>{if(!box.dataset.evOwnLabel)box.placeholder=root.dataset.evDevice==='movil'?'Buscar ensayos':'Busca un ensayo, enfermedad o fármaco'};setPlaceholder();addEventListener('resize',setPlaceholder,{passive:true});
  const syncClear=()=>{if(clear)clear.hidden=!box.value};syncClear();
  box.addEventListener('input',()=>{syncClear();if(mode==='quick'){clearTimeout(timer);timer=setTimeout(search,90)}});
  box.addEventListener('ev-sync',syncClear);
  box.addEventListener('focus',()=>{if(mode==='quick'&&box.value.trim())search()});
  clear?.addEventListener('click',()=>{box.value='';syncClear();box.dispatchEvent(new Event('input',{bubbles:true}));box.focus()});
  form.addEventListener('submit',e=>{e.preventDefault();if(mode==='list'){if(root.dataset.evPointer==='tactil')box.blur();document.getElementById('ev-archivo')?.scrollIntoView({behavior:E.reduced()?'auto':'smooth',block:'start'});return}const raw=box.value.trim();location.href=raw?'/?q='+encodeURIComponent(raw)+'#ev-archivo':'/'});
  box.addEventListener('keydown',e=>{if(mode!=='quick')return;if(e.key==='ArrowDown'&&results.querySelector('a')){e.preventDefault();results.querySelector('a').focus()}});
  results?.addEventListener('keydown',e=>{const links=[...results.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='ArrowUp'&&i===0){box.focus();return}const next=e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowDown'?1:-1)+links.length)%links.length;links[next]?.focus()}});
  document.addEventListener('pointerdown',e=>{if(panel&&!panel.hidden&&!form.contains(e.target))showPanel(false)});
  form.addEventListener('focusout',()=>setTimeout(()=>{if(!form.contains(document.activeElement))showPanel(false)},0));
  const focusSearch=()=>{box.focus();box.select()};
  document.addEventListener('keydown',e=>{const active=document.activeElement,editing=!!active?.getClientRects().length&&(/INPUT|TEXTAREA|SELECT/.test(active.tagName)||active.isContentEditable);if((e.key==='/'&&!editing)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){if(document.querySelector('dialog[open]'))return;e.preventDefault();focusSearch()}});
 }
 // Escape closes the innermost layer first; reading mode is the last layer.
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const dialogs=document.querySelectorAll('dialog[open]'),panelOpen=panel&&!panel.hidden,more=document.querySelector('.ev-toolbar.ev-more-open'),pdfMenu=document.querySelector('details.ev-pdf-menu[open]');
  if(dialogs.length)return;
  if(panelOpen){e.preventDefault();showPanel(false);box.focus();return}
  if(more){e.preventDefault();more.querySelector('[data-ev-more]')?.click();return}
  if(pdfMenu){e.preventDefault();pdfMenu.open=false;pdfMenu.querySelector('summary').focus();return}
  if(document.activeElement===box&&box.value){return}
  if(root.dataset.evReadingMode==='on'){e.preventDefault();document.querySelector('[data-ev-focus]')?.click()}
 });
 // Card PDF menu
 document.addEventListener('click',async e=>{
  for(const d of document.querySelectorAll('details.ev-pdf-menu[open]'))if(!d.contains(e.target))d.open=false;
  const b=e.target.closest('[data-ev-card-pdf]');if(!b)return;b.disabled=true;const label=b.textContent;b.textContent='Preparando…';
  try{const r=(await E.data()).find(r=>String(r.id)===b.dataset.evCardPdf);await E.pdf(r,b.dataset.evVersion==='breve');b.textContent=label;b.closest('details')?.removeAttribute('open')}catch{b.textContent='No se pudo descargar'}finally{b.disabled=false;setTimeout(()=>{b.textContent=label},2500)}
 });
 // Back to top and header elevation
 const top=document.querySelector('[data-ev-top]');let ticking=false;
 const onScroll=()=>{ticking=false;const y=scrollY;header?.toggleAttribute('data-ev-scrolled',y>8);if(top)top.hidden=y<innerHeight*2};
 addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});onScroll();
 top?.addEventListener('click',()=>{scrollTo({top:0,behavior:E.reduced()?'auto':'smooth'});document.getElementById('ev-main')?.focus({preventScroll:true})});
});
})();
