/* GENERATED FILE. Run: node scripts/build-site-runtime.mjs */
/* source: specialty-classification.js */
(function (root) {
  'use strict';

  const AREAS = Object.freeze(['Medicina Crítica', 'Medicina Interna']);
  const SPECIALTIES = Object.freeze([
    'Cardiolog\u00eda', 'Cirug\u00eda', 'Endocrinolog\u00eda', 'Enfermedades Infecciosas',
    'Gastroenterolog\u00eda', 'Geriatr\u00eda', 'Hematolog\u00eda', 'Infectolog\u00eda',
    'Medicina de Urgencias', 'Medicina F\u00edsica y Rehabilitaci\u00f3n', 'Nefrolog\u00eda',
    'Neumolog\u00eda', 'Neurolog\u00eda', 'Oncolog\u00eda', 'Oftalmolog\u00eda', 'Reumatolog\u00eda', 'VIH'
  ]);
  const REVIEW = 'REVISAR_ESPECIALIDAD';

  const normalize = (value) => String(value || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const match = (text, patterns) => patterns.some((pattern) => pattern.test(text));
  const CANONICAL_SPECIALTY = Object.freeze({
    'Enfermedades Infecciosas': 'Infectolog\u00eda',
    VIH: 'Infectolog\u00eda'
  });

  // Disease and clinical setting rules intentionally precede drug/mechanism terms.
  // A rule needs a recognizable disease/context phrase; isolated terms such as
  // "anticoagulación", "sangrado" or "plaquetas" never select Hematología.
  const RULES = Object.freeze([
    ['Neumolog\u00eda', [
      /\b(?:embolia|tromboembolismo) pulmonar\b/, /\bhipertension pulmonar\b/,
      /\bepoc\b/, /\basma\b/, /\benfermedad (?:pulmonar|intersticial)\b/,
      /\bneumonia (?:adquirida|nosocomial|comunitaria)\b/
    ]],
    ['Neurolog\u00eda', [
      /\b(?:ictus|accidente cerebrovascular|hemorragia intracerebral)\b/,
      /\b(?:oclusion|estenosis) carotidea\b/, /\bneuro(?:log|critic)/,
      /\b(?:epilepsia|esclerosis multiple)\b/
    ]],
    ['Medicina de Urgencias', [
      /\b(?:servicio|departamento) de urgencias\b/, /\bpacientes de urgencias\b/
    ]],
    ['Cardiolog\u00eda', [
      /\b(?:stemi|nstemi|sindrome coronario agudo)\b/, /\binfarto (?:agudo )?(?:de miocardio|miocardico)\b/,
      /\b(?:intervencion coronaria percutanea|angioplastia|revascularizacion coronaria|stent)\b/,
      /\b(?:fibrilacion auricular|arritmia|monitorizacion electrocardiografica|sincope)\b/,
      /\benfermedad tromboembolica venosa\b/,
      /\binsuficiencia cardia?ca\b/, /\b(?:valvulopatia|tavi|ablacion cardiaca)\b/,
      /\b(?:estenosis aortica|cirugia valvular|reemplazo valvular aortico|implante valvular aortico)\b/,
      /\b(?:enfermedad cardiovascular aterosclerotica|prevencion cardiovascular|alto riesgo cardiovascular|lipidos|dislipidemia|colesterol ldl|hipertension arterial|presion arterial)\b/,
      /\bshock cardiogenico\b/
    ]],
    ['Nefrolog\u00eda', [
      /\b(?:enfermedad|lesion) renal (?:cronica|aguda)\b/, /\benfermedad renal terminal\b/,
      /\b(?:nefro|(?:hemo)?dialisis|glomerul|albuminuria)\w*\b/,
      /\bterapia de reemplazo renal\b/
    ]],
    ['Endocrinolog\u00eda', [
      /\bdiabetes (?:mellitus |tipo )?[12]\b/, /\b(?:tiroid|suprarrenal|osteoporosis|obesidad)\w*\b/,
      /\bdiabetes y metabolismo\b/
    ]],
    ['Gastroenterolog\u00eda', [
      /\b(?:cirrosis|hepatitis|pancreatitis|enfermedad inflamatoria intestinal|hemorragia gastrointestinal)\b/,
      /\b(?:hepat|gastro|pancrea)\w*\b/
    ]],
    ['Infectolog\u00eda', [
      /\b(?:vih|tuberculosis|covid-?19|bacteriemia)\b/,
      /\b(?:infeccion|antibiotico|antimicrobiano|vacuna)\w*\b/
    ]],
    ['Reumatolog\u00eda', [
      /\b(?:artritis reumatoide|lupus|vasculitis|espondilitis|espondiloartritis)\b/
    ]],
    ['Hematolog\u00eda', [
      /\b(?:leucemia|linfoma|mieloma|hemofilia|trombocitopenia|purpura trombotica)\b/,
      /\b(?:anemia|hemoglobinopatia|sindrome mielodisplasico|enfermedad de von willebrand)\b/,
      /\b(?:neoplasia hematologica|trastorno primario de (?:la )?coagulacion)\b/
    ]]
  ]);

  function classify(record) {
    const primary = record?.especialidad_principal;
    const secondary = record?.especialidad_secundaria || '';
    if ((!AREAS.includes(primary) && !SPECIALTIES.includes(primary))
      || (secondary && !AREAS.includes(secondary) && !SPECIALTIES.includes(secondary))) {
      return { specialty: REVIEW, confidence: 'none', reason: 'Etiqueta fuera de la taxonomía canónica' };
    }

    // Un ensayo cuyo contexto principal es Medicina Crítica ya está resuelto
    // clínicamente por área; no se fuerza una subespecialidad por palabras clave.
    if (primary === 'Medicina Crítica') {
      return { specialty: '', confidence: 'not-applicable', reason: 'Contexto principal de Medicina Crítica' };
    }

    if (SPECIALTIES.includes(primary)) {
      return { specialty: CANONICAL_SPECIALTY[primary] || primary, confidence: 'high', reason: 'Especialidad principal explícita y canónica' };
    }

    if (secondary && SPECIALTIES.includes(secondary)) {
      return { specialty: CANONICAL_SPECIALTY[secondary] || secondary, confidence: 'high', reason: 'Subespecialidad clínica explícita y canónica' };
    }

    if (/\b(?:servicio|departamento) de urgencias\b/.test(normalize(record?.objetivo))) {
      return { specialty: 'Medicina de Urgencias', confidence: 'medium', reason: 'Ámbito asistencial explícito: servicio de urgencias' };
    }

    const fields = [
      [normalize(record?.titulo), 8],
      [normalize(Array.isArray(record?.temas) ? record.temas.join(' ') : ''), 5],
      [normalize(record?.objetivo), 3],
      [normalize(record?.cuerpo), 1]
    ];
    const scores = RULES.map(([specialty, patterns], order) => ({
      specialty, order,
      score: fields.reduce((total, [text, weight]) => total + (match(text, patterns) ? weight : 0), 0)
    })).filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order);
    if (scores.length && (scores[0].score >= 8 || (scores[0].score >= 5 && scores[0].score - (scores[1]?.score || 0) >= 3))) {
      return {
        specialty: scores[0].specialty,
        confidence: scores[0].score >= 11 ? 'high' : 'medium',
        reason: `Enfermedad y contexto clínico ponderados: ${scores[0].specialty}`
      };
    }
    return { specialty: REVIEW, confidence: 'low', reason: 'No existe evidencia contextual suficiente' };
  }

  root.SpecialtyClassification = Object.freeze({ AREAS, SPECIALTIES, REVIEW, classify, normalize });
})(typeof globalThis !== 'undefined' ? globalThis : window);

/* source: ui/core.js */
(() => {
const E=window.EV={};
E.version=new URL(document.currentScript?.src||location.href).searchParams.get('v')||'design-v1';
E.esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
E.norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
E.plain=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');return d.textContent};
E.safe=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');for(const n of [...d.querySelectorAll('*')]){if(!['H2','P','STRONG','EM','SUB','SUP'].includes(n.tagName))n.replaceWith(document.createTextNode(n.textContent));else for(const a of [...n.attributes])n.removeAttribute(a.name)}return d.innerHTML};
let records,routes,library;
E.data=()=>records??=import('/trial-data.js?v=20261003-laboratorio-v1').then(m=>m.loadTrials());
E.routes=()=>routes??=fetch('/seo-manifest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('No se pudo cargar el índice');return r.json()});
E.library=()=>library??=import('/library-store.js?v=20261003-laboratorio-v1');
E.inferSubspecialty=r=>{if(r?.especialidad_principal!=='Medicina Interna'&&r?.especialidad_secundaria!=='Medicina Interna')return '';const result=globalThis.SpecialtyClassification?.classify(r);return result?.specialty===globalThis.SpecialtyClassification?.REVIEW?'':result?.specialty||''};
E.ready=f=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',f,{once:true}):f();
E.open=id=>{const d=document.getElementById(id);if(d&&!d.open)d.showModal();return d};
E.status=(node,text)=>{if(node)node.textContent=text};
E.searchable=r=>E.norm([r.titulo,r.autor,r.revista,r.anio,r.doi,r.registro,r.especialidad_principal,r.especialidad_secundaria,...(r.temas||[])].join(' '));
E.areas=r=>{const a=[r.especialidad_principal,r.especialidad_secundaria,E.inferSubspecialty(r)].filter(Boolean),internal=['Cardiología','Cirugía','Endocrinología','Enfermedades Infecciosas','Gastroenterología','Geriatría','Hematología','Infectología','Medicina de Urgencias','Medicina Física y Rehabilitación','Nefrología','Neumología','Neurología','Oncología','Oftalmología','Reumatología','VIH'];if(internal.includes(r.especialidad_principal))a.push('Medicina Interna');return [...new Set(a)]};
E.facts=r=>'<dl class="ev-study-facts">'+[['revista','Revista'],['anio','Año'],['fecha','Fecha'],['tipo_estudio','Tipo de estudio'],['especialidad_principal','Especialidad'],['especialidad_secundaria','Especialidad secundaria'],['temas','Temas'],['registro','Registro'],['doi','DOI'],['financiacion','Financiación']].filter(([k])=>r[k]!==''&&r[k]!=null&&(!Array.isArray(r[k])||r[k].length)).map(([k,label])=>'<div><dt>'+label+'</dt><dd data-ev-field="'+k+'">'+E.esc(Array.isArray(r[k])?r[k].join(' · '):r[k])+'</dd></div>').join('')+'</dl>';
E.card=(r,path)=>'<li class="ev-card" data-id="'+r.id+'"><div><a href="'+E.esc(path)+'" data-ev-read="'+r.id+'"><h2>'+E.esc(r.titulo)+'</h2></a></div><div class="ev-meta">'+E.esc(r.revista)+' · '+E.esc(r.fecha)+'<br>'+E.esc(r.especialidad_principal)+'<br>'+E.esc((r.temas||[]).join(' · '))+'<details><summary>Ficha del estudio</summary>'+E.facts(r)+'</details></div><div class="ev-card-foot"><a href="'+E.esc(path)+'" data-ev-read="'+r.id+'">Leer ensayo →</a><button class="ev-icon" type="button" data-ev-card-pdf="'+r.id+'" aria-label="Descargar resumen completo PDF de '+E.esc(r.titulo)+'">↓</button></div></li>';
E.pdf=async(r,brief=false,format=innerWidth<720?'mobile':'a4')=>{const m=await import('/ui/pdf.js?v='+E.version);return m.generatePDF(r,{brief,format})};
E.ready(()=>{
 const root=document.documentElement,menu=document.getElementById('ev-navigation');
 document.querySelectorAll('button[data-ev-theme]').forEach(b=>{const sync=()=>{b.setAttribute('aria-label',root.dataset.evTheme==='claro'?'Cambiar a tema oscuro':'Cambiar a tema claro')};sync();b.onclick=()=>{const t=root.dataset.evTheme==='claro'?'oscuro':'claro';root.dataset.evTheme=t;try{localStorage.setItem('rt-tema',t)}catch{}document.querySelectorAll('button[data-ev-theme]').forEach(x=>x.setAttribute('aria-label',t==='claro'?'Cambiar a tema oscuro':'Cambiar a tema claro'))}});
 document.querySelector('[data-ev-menu]')?.addEventListener('click',e=>{const on=menu.classList.toggle('ev-open');e.currentTarget.setAttribute('aria-expanded',String(on))});
 document.querySelectorAll('[data-ev-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
 document.querySelectorAll('[data-ev-specialties]').forEach(b=>b.onclick=()=>E.open('ev-specialties'));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();document.querySelectorAll('dialog[open]').forEach(d=>d.close());menu.classList.remove('ev-open');document.querySelector('[data-ev-menu]')?.setAttribute('aria-expanded','false')}});
 const box=document.getElementById('ev-search-input'),list=document.getElementById('ev-search-results'),status=document.getElementById('ev-search-status');let timer,searchEpoch=0;
 const highlight=(s,q)=>{const i=E.norm(s).indexOf(q);return i<0?E.esc(s):E.esc(s.slice(0,i))+'<mark>'+E.esc(s.slice(i,i+q.length))+'</mark>'+E.esc(s.slice(i+q.length))};
 async function search(){const epoch=++searchEpoch,q=E.norm(box.value.trim());if(!q){list.innerHTML='';status.textContent='Busca por ensayo, autor, DOI, registro o tema.';return}try{const[rows,map]=await Promise.all([E.data(),E.routes()]);if(epoch!==searchEpoch)return;const matches=rows.filter(r=>E.searchable(r).includes(q));list.innerHTML=matches.slice(0,20).map(r=>'<li><a href="'+E.esc(map[String(r.id)].path)+'" data-ev-read="'+r.id+'"><b>'+highlight(r.titulo,q)+'</b><small>'+highlight([r.revista,r.anio,r.doi,r.registro].filter(Boolean).join(' · '),q)+'</small></a></li>').join('');status.textContent=matches.length?matches.length+' resultados'+(matches.length>20?' · Mostrando 20':''):'Sin resultados. Prueba «sepsis», «SOHO» o el año del estudio.'}catch{status.textContent='No pudimos cargar el buscador. Puedes explorar el archivo.'}}
 box.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,100)});const openSearch=()=>{E.open('ev-search');box.focus();search()};document.querySelectorAll('[data-ev-search]').forEach(b=>b.onclick=openSearch);
 document.addEventListener('keydown',e=>{const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.activeElement?.isContentEditable;if((e.key==='/'&&!editing)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){e.preventDefault();openSearch()}});
 box.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();list.querySelector('a')?.focus()}else if(e.key==='Enter'&&list.querySelector('a')){e.preventDefault();list.querySelector('a').click()}});
 list.addEventListener('keydown',e=>{const links=[...list.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowDown'?1:-1)+links.length)%links.length;links[next]?.focus()}});
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-ev-card-pdf]');if(!b)return;b.disabled=true;try{const r=(await E.data()).find(r=>String(r.id)===b.dataset.evCardPdf);await E.pdf(r)}catch{b.setAttribute('aria-label','No se pudo descargar. Intenta de nuevo.')}finally{b.disabled=false}});
 document.querySelectorAll('.ev-header-nav a').forEach(a=>{if(a.pathname===location.pathname)a.setAttribute('aria-current','page')});
});
})();

/* source: reading-context.js */
/* Preserve a tab-local return path without changing canonical article URLs. */
(() => {
  'use strict';
  const KEY='rt-reading-context-v1', RETURN='rt-reading-return-v1', VIEW='rt-reading-view-v1:', TTL=12*60*60*1000;
  const path=location.pathname;
  const isReader=/^\/trials\//.test(path)||path==='/resumen.html';
  const isOrigin=p=>p==='/'||p==='/index.html'||p==='/biblioteca.html'||/^\/(medicina-critica|medicina-interna)\//.test(p);
  const parse=value=>{try{return JSON.parse(value)}catch{return null}};
  const read=()=>{try{const ctx=parse(sessionStorage.getItem(KEY));return ctx&&Array.isArray(ctx.targets)&&Date.now()-ctx.at<TTL&&isOrigin(new URL(ctx.origin,location.origin).pathname)&&new URL(ctx.origin,location.origin).origin===location.origin?ctx:null}catch{return null}};
  const write=ctx=>{try{sessionStorage.setItem(KEY,JSON.stringify(ctx))}catch{}};
  function saveView(){if(!isOrigin(path))return;const q=(document.querySelector('#ev-q')||document.querySelector('#q'));if(!q)return;try{sessionStorage.setItem(VIEW+path+location.search,JSON.stringify({at:Date.now(),origin:path+location.search,q:q.value,area:(document.querySelector('#ev-area')||document.querySelector('#area'))?.value||'',y:scrollY}))}catch{}}
  function reloadView(){try{if(performance.getEntriesByType('navigation')[0]?.type!=='reload')return null;const view=parse(sessionStorage.getItem(VIEW+path+location.search));return view&&Date.now()-view.at<TTL?view:null}catch{return null}}
  function active(){const ctx=read();if(!ctx||!isReader)return null;const id=new URLSearchParams(location.search).get('id')||document.querySelector('[data-ev-reader]')?.getAttribute('data-ev-reader');const matches=(path!=='/resumen.html'&&ctx.targets.includes(path))||(id&&ctx.id===String(id));if(matches&&id&&ctx.id!==String(id)){ctx.id=String(id);write(ctx)}return matches?ctx:null;}
  function requestReturn(){const ctx=active();if(!ctx)return;try{sessionStorage.setItem(RETURN,JSON.stringify({origin:ctx.origin,at:Date.now()}))}catch{}}
  window.RTReadingContext={destination:()=>active()?.origin||'/',requestReturn,context:()=>active()};
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link)return;
    if(link.matches('[data-reading-return],[data-ev-return]')){const ctx=active();if(ctx)link.href=ctx.origin;requestReturn();return;}
    if(isReader&&link.closest('[data-ev-neighbors]')){const ctx=active(),url=new URL(link.href,location.href);if(ctx&&url.origin===location.origin&&/^\/trials\//.test(url.pathname)){ctx.targets=[...new Set([...ctx.targets,url.pathname])];write(ctx)}return;}
    if(!isOrigin(path))return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin||!(/^\/trials\//.test(url.pathname)||url.pathname==='/resumen.html'))return;
    const row=link.closest('.ev-card,.ev-library-item');
    const id=row?.getAttribute('data-id')||link.dataset.read||url.searchParams.get('id')||row?.querySelector('[data-id]')?.getAttribute('data-id')||'';
    const listTargets=[...document.querySelectorAll('.ev-card:not([hidden]),.ev-library-item:not([hidden])')].map(item=>item.querySelector('a[href*="/trials/"],h2 a[href]')).filter(Boolean).map(a=>new URL(a.href,location.href).pathname).filter(p=>/^\/trials\//.test(p));
    const targets=[...listTargets,url.pathname,...(row?[...row.querySelectorAll('a[href]')].map(a=>new URL(a.href,location.href).pathname).filter(p=>/^\/trials\//.test(p)):[])];
    write({at:Date.now(),origin:path+location.search,id:String(id),targets:[...new Set(targets)],q:(document.querySelector('#ev-q')||document.querySelector('#q'))?.value||'',area:(document.querySelector('#ev-area')||document.querySelector('#area'))?.value||'',y:scrollY});
  },true);
  function decorate(){if(!isReader)return;const ctx=active();if(!ctx||document.querySelector('[data-reading-return],[data-ev-return]'))return;const heading=document.querySelector('[data-ev-reader]');if(!heading)return;const a=document.createElement('a');a.href=ctx.origin;a.className='ev-reading-return';a.dataset.readingReturn='true';a.textContent=ctx.origin.startsWith('/biblioteca.html')?'Volver a mi biblioteca':/^\/(medicina-critica|medicina-interna)\//.test(ctx.origin)?'Volver a la especialidad':'Volver a mis resultados';heading.before(a);}
  let restored=false;
  function restore(){if(restored||!isOrigin(path))return;const reloaded=reloadView(),ctx=reloaded||read();if(!ctx||ctx.origin!==path+location.search)return;let requested=false;try{const flag=parse(sessionStorage.getItem(RETURN));requested=flag?.origin===ctx.origin&&Date.now()-flag.at<60000}catch{}const backward=performance.getEntriesByType('navigation')[0]?.type==='back_forward';if(!requested&&!backward&&!reloaded)return;
    const q=(document.querySelector('#ev-q')||document.querySelector('#q')),area=(document.querySelector('#ev-area')||document.querySelector('#area'));
    if(document.querySelector('[data-ev-ids]')&&!document.querySelector('#ev-count')?.textContent.includes(' de '))return;
    if(path==='/biblioteca.html'&&!document.querySelector('#list .ev-library-item,#list [data-library-state="empty"],#list [data-library-state="no-results"]'))return;
    if(!document.querySelector('[data-ev-ids]')){if(q){q.value=ctx.q;q.dispatchEvent(new Event('input',{bubbles:true}))}if(area){area.value=ctx.area;area.dispatchEvent(new Event('change',{bubbles:true}))}}
    restored=true;try{sessionStorage.removeItem(RETURN)}catch{}requestAnimationFrame(()=>requestAnimationFrame(()=>{scrollTo(0,ctx.y)}));
  }
  function boot(){decorate();restore();let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();restore()})});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);window.addEventListener('pagehide',saveView);window.addEventListener('pageshow',()=>{restored=false;restore()});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* source: ui/archive.js */
(() => {const E=window.EV;E.ready(async()=>{
 const root=document.querySelector('[data-ev-ids]');if(!root)return;
 try{const[all,map,dates]=await Promise.all([E.data(),E.routes(),import('/trial-data.js?v=20261003-laboratorio-v1')]);const ids=new Set(root.dataset.evIds.split(',')),rows=all.filter(r=>ids.has(String(r.id))),nodes=new Map([...document.querySelectorAll('#ev-list>.ev-card')].map(n=>[n.dataset.id,n])),list=document.getElementById('ev-list'),count=document.getElementById('ev-count'),q=document.getElementById('ev-q'),more=document.getElementById('ev-more'),sort=document.getElementById('ev-sort'),view=document.getElementById('ev-view'),chips=document.getElementById('ev-chips'),empty=document.getElementById('ev-empty'),filters=[...document.querySelectorAll('[data-ev-filter]')];let limit=24,timer;const keys={area:'esp',topic:'tema',year:'anio',journal:'revista',type:'tipo'},values={area:r=>E.areas(r),topic:r=>r.temas||[],year:r=>[String(r.anio)],journal:r=>[r.revista],type:r=>[r.tipo_estudio]};
 for(const r of rows){const inferred=E.inferSubspecialty(r),node=nodes.get(String(r.id));if(inferred&&node&&!node.querySelector('[data-ev-subspecialty]')){const badge=document.createElement('span');badge.className='ev-tag';badge.dataset.evSubspecialty='true';badge.textContent=inferred;node.querySelector('.ev-meta').prepend(badge,document.createElement('br'))}}
 for(const f of filters){const unique=[...new Set(rows.flatMap(values[f.dataset.evFilter]).filter(Boolean))].sort((a,b)=>f.dataset.evFilter==='year'?Number(b)-Number(a):a.localeCompare(b,'es'));f.innerHTML='<option value="">Todos</option>'+unique.map(v=>'<option value="'+E.esc(v)+'">'+E.esc(v)+' ('+rows.filter(r=>values[f.dataset.evFilter](r).includes(v)).length+')</option>').join('')}
 function fromURL(){const p=new URLSearchParams(location.search);q.value=p.get('q')||'';for(const f of filters)f.value=p.get(keys[f.dataset.evFilter])||'';sort.value=p.get('orden')||'date';const dense=p.get('vista')==='lista';root.classList.toggle('ev-dense',dense);view.setAttribute('aria-pressed',String(dense));view.textContent=dense?'Tarjetas':'Lista densa';limit=Math.max(24,Number(p.get('n'))||24)}
 function url(){const u=new URL(location.href);for(const k of ['q',...Object.values(keys),'orden','vista','n'])u.searchParams.delete(k);if(q.value.trim())u.searchParams.set('q',q.value.trim());for(const f of filters)if(f.value)u.searchParams.set(keys[f.dataset.evFilter],f.value);if(sort.value!=='date')u.searchParams.set('orden',sort.value);if(root.classList.contains('ev-dense'))u.searchParams.set('vista','lista');if(limit>24)u.searchParams.set('n',String(limit));return u}
 function render(push=false){let chosen=rows.filter(r=>(!q.value.trim()||E.searchable(r).includes(E.norm(q.value.trim())))&&filters.every(f=>!f.value||values[f.dataset.evFilter](r).includes(f.value)));chosen=chosen.slice().sort(sort.value==='title'?(a,b)=>a.titulo.localeCompare(b.titulo,'es'):sort.value==='journal'?(a,b)=>a.revista.localeCompare(b.revista,'es')||a.titulo.localeCompare(b.titulo,'es'):dates.compareTrialDates);const selected=new Set(chosen.slice(0,limit).map(r=>String(r.id)));for(const r of chosen){const n=nodes.get(String(r.id));if(n)list.append(n)}for(const[id,n]of nodes)n.hidden=!selected.has(id);count.textContent=chosen.length+' de '+rows.length+' resúmenes';more.hidden=chosen.length<=limit;empty.hidden=chosen.length!==0;chips.innerHTML=filters.filter(f=>f.value).map(f=>'<button class="ev-chip" type="button" data-ev-clear="'+f.id+'" aria-label="Quitar filtro '+E.esc(f.value)+'">'+E.esc(f.value)+' ×</button>').join('')+(q.value?'<button class="ev-chip" type="button" data-ev-clear="ev-q">Quitar búsqueda ×</button>':'');if(push&&url().href!==location.href)history.pushState(null,'',url())}
 function update(){limit=24;render(true)}
 q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,120)});for(const f of filters)f.onchange=update;sort.onchange=()=>render(true);view.onclick=()=>{const on=root.classList.toggle('ev-dense');view.textContent=on?'Tarjetas':'Lista densa';view.setAttribute('aria-pressed',String(on));render(true)};more.onclick=()=>{limit+=24;render(true)};chips.onclick=e=>{const b=e.target.closest('[data-ev-clear]');if(b){document.getElementById(b.dataset.evClear).value='';update()}};
 root.querySelector('[data-ev-preset]')?.addEventListener('click',e=>{q.value='';for(const f of filters)f.value=f.dataset.evFilter==='area'?'Medicina Crítica':f.dataset.evFilter==='year'?e.currentTarget.dataset.evPreset:'';update()});
 window.addEventListener('popstate',()=>{fromURL();render()});fromURL();render();

 }catch(error){E.archiveError=error;document.getElementById('ev-count').textContent='Archivo disponible · filtros no disponibles. Recarga para reintentar.'}
})})();

/* source: ui/reader.js */
(() => {const E=window.EV;
const humanDate=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/),months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return m&&months[Number(m[2])-1]?Number(m[3])+' de '+months[Number(m[2])-1]+' de '+m[1]:String(value||'')};
const editorialDates=r=>{const parts=[];for(const [key,label]of [['fecha_publicacion_resumen','Publicado en Resúmenes Trials'],['fecha_revision','Última revisión']]){const value=r[key]||(key==='fecha_revision'?r.actualizado:'');if(value)parts.push('<span>'+label+': <time datetime="'+E.esc(value)+'">'+E.esc(humanDate(value))+'</time></span>')}return parts.length?'<div class="ev-editorial-dates">'+parts.join(' · ')+'</div>':''};
const cutDescription=text=>{if(text.length<=158)return text;const cut=text.slice(0,159),space=cut.lastIndexOf(' ');return (space>100?cut.slice(0,space):text.slice(0,158)).trim()+'…'};
function updateMetadata(r,path,brief){
 const base='https://resumenestrials.com',url=base+path,title=E.plain(r.titulo)+(brief?' · resumen breve':'')+' · Resumenes Trials',description=E.plain(r.objetivo||r.hallazgo||'Resumen crítico en español de un ensayo clínico aleatorizado.').replace(/\s+/g,' ').trim();
 document.title=title;let canonical=document.querySelector('link[rel=canonical]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}canonical.href=url;
 for(const [selector,value]of [['meta[name=description]',cutDescription(description)],['meta[name=robots]','noindex,follow,max-image-preview:large'],['meta[property="og:title"]',title],['meta[property="og:description"]',cutDescription(description)],['meta[property="og:url"]',url],['meta[name="twitter:title"]',title],['meta[name="twitter:description"]',cutDescription(description)]])document.querySelector(selector)?.setAttribute('content',value);
 const topics=r.temas||[],about=[r.especialidad_principal,r.especialidad_secundaria,E.inferSubspecialty(r),...topics].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).map(name=>({'@type':'MedicalEntity',name}));
 const article={'@type':'MedicalScholarlyArticle',headline:E.plain(r.titulo),description:cutDescription(description),inLanguage:'es',mainEntityOfPage:url,url,publisher:{'@type':'Organization',name:'Resumenes Trials',url:base+'/',logo:{'@type':'ImageObject',url:base+'/logo.png'}}};
 if(r.fecha)article.datePublished=r.fecha;if(r.autor)article.author={'@type':'Person',name:E.plain(r.autor)};if(r.revista)article.isPartOf={'@type':'Periodical',name:E.plain(r.revista)};if(r.original)article.isBasedOn=r.original;if(r.doi)article.identifier=article.sameAs='https://doi.org/'+E.plain(r.doi);if(about.length)article.about=about;if(topics.length)article.keywords=topics.join(', ');
 const crumbs={'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Índice',item:base+'/'},{'@type':'ListItem',position:2,name:r.especialidad_principal||'Resúmenes',item:base+'/'}]},ld=document.getElementById('structured-data');if(ld)ld.textContent=JSON.stringify({'@context':'https://schema.org','@graph':[article,crumbs]});
}
const facts=r=>E.facts(r);
function markup(r,path,brief){return '<section data-ev-reader="'+r.id+'" data-ev-brief="'+brief+'"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/" data-ev-return>← Volver a la lista</a><a href="/metodologia/">Metodología</a></nav><header class="ev-reading-head"><span class="ev-eyebrow">'+E.esc(r.tipo_estudio)+' / '+E.esc(r.anio)+'</span><h1 data-ev-field="titulo">'+E.esc(r.titulo)+'</h1><p class="ev-meta"><span data-ev-field="autor">'+E.esc(r.autor)+'</span> · <span data-ev-field="revista">'+E.esc(r.revista)+'</span> · <span data-ev-field="fecha">'+E.esc(humanDate(r.fecha))+'</span></p><p data-ev-field="hallazgo" class="ev-lead">'+E.safe(r.hallazgo)+'</p>'+editorialDates(r)+'</header>'+facts(r)+'<div class="ev-toolbar" role="region" aria-label="Controles de lectura"><div class="ev-version"><a href="'+E.esc(path)+'"'+(!brief?' aria-current="page"':'')+'>Completo</a><a href="/resumen.html?id='+r.id+'&amp;v=corto"'+(brief?' aria-current="page"':'')+'>Breve</a></div><button type="button" data-ev-sections>Secciones</button><button type="button" data-ev-pdf>↓ PDF</button><button type="button" data-ev-format aria-label="Elegir formato de PDF">Formato</button><button type="button" data-ev-save>Guardar</button><button type="button" data-ev-focus aria-pressed="false">Modo lectura</button><button type="button" data-ev-font aria-label="Cambiar tamaño de letra">A+</button></div><progress class="ev-progress" max="100" value="0" aria-label="Progreso de lectura"></progress><div class="ev-reader-grid"><article class="ev-body">'+E.safe(r[brief?'corto':'cuerpo'])+'</article><aside class="ev-rail"><p class="ev-eyebrow">En esta página</p><nav data-ev-toc aria-label="Secciones del artículo"></nav></aside></div><div class="ev-endmatter"><p class="ev-original">Artículo original: '+(String(r.original).startsWith('https://')?'<a href="'+E.esc(r.original)+'" target="_blank" rel="noopener noreferrer">'+E.esc(r.original)+'</a>':E.esc(r.original))+'</p><nav class="ev-neighbors" aria-label="Continuidad de lectura" data-ev-neighbors></nav><section class="ev-related"><h2>Evidencia relacionada</h2><ul class="ev-list" data-ev-related></ul></section><p class="ev-meta" id="ev-reader-status" role="status"></p></div></section>'}
E.ready(async()=>{
 if(!document.body.classList.contains('ev-reader'))return;
 let all,map,r,reader,brief=false;const dynamic=document.getElementById('ev-dynamic-reader');
 try{[all,map]=await Promise.all([E.data(),E.routes()]);if(dynamic){const p=new URLSearchParams(location.search),id=p.get('id');r=all.find(r=>String(r.id)===id);if(!r){document.title='Resumen no encontrado · Resúmenes Trials';dynamic.innerHTML='<section class="ev-notice"><h1>Resumen no encontrado</h1><p>El identificador no corresponde a un ensayo disponible.</p><a class="ev-button" href="/">Volver al archivo</a></section>';return}brief=p.get('v')==='corto'&&!!r.corto;dynamic.innerHTML=markup(r,map[String(r.id)].path,brief);updateMetadata(r,map[String(r.id)].path,brief)}
 reader=document.querySelector('[data-ev-reader]');if(!reader)return;r??=all.find(x=>String(x.id)===reader.dataset.evReader);brief=reader.dataset.evBrief==='true';if(!r)throw Error('Resumen no disponible');
 const article=reader.querySelector('article'),headings=[...article.querySelectorAll('h2')],toc=reader.querySelector('[data-ev-toc]'),progress=reader.querySelector('progress'),status=document.getElementById('ev-reader-status');
 headings.forEach((h,i)=>h.id='ev-section-'+(i+1));const links=headings.map((h,i)=>'<a href="#'+h.id+'">'+String(i+1).padStart(2,'0')+' · '+E.esc(h.textContent)+'</a>').join('');toc.innerHTML=links;
 const dialog=document.createElement('dialog');dialog.id='ev-sections';dialog.className='ev-dialog';dialog.setAttribute('aria-labelledby','ev-sections-title');dialog.innerHTML='<div class="ev-dialog-head"><h2 id="ev-sections-title">Secciones del ensayo</h2><button type="button" aria-label="Cerrar">×</button></div><div class="ev-dialog-body"><nav class="ev-dialog-list" aria-label="Índice de secciones">'+links+'</nav></div>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();reader.querySelector('[data-ev-sections]').onclick=()=>dialog.showModal();dialog.querySelectorAll('a').forEach(a=>a.onclick=()=>{dialog.close();const h=document.getElementById(a.hash.slice(1));h.tabIndex=-1;setTimeout(()=>h.focus({preventScroll:true}),0)});
 const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)for(const a of document.querySelectorAll('[data-ev-toc] a,#ev-sections a')){if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')}},{rootMargin:'-15% 0px -65% 0px'});headings.forEach(h=>observer.observe(h));
 const update=()=>{const rect=article.getBoundingClientRect(),total=Math.max(1,article.offsetHeight-innerHeight*.5);progress.value=Math.max(0,Math.min(100,-rect.top/total*100))};window.addEventListener('scroll',update,{passive:true});update();
 const focus=reader.querySelector('[data-ev-focus]');focus.onclick=()=>{const on=document.body.classList.toggle('ev-focus');focus.setAttribute('aria-pressed',String(on));try{localStorage.setItem('ev-focus',String(on))}catch{}};
 const font=reader.querySelector('[data-ev-font]');let size=0;try{size=Number(localStorage.getItem('ev-font'))||0;document.body.classList.toggle('ev-focus',localStorage.getItem('ev-focus')==='true');focus.setAttribute('aria-pressed',String(document.body.classList.contains('ev-focus')))}catch{}
 const applyFont=()=>{document.body.classList.toggle('ev-font-small',size===1);document.body.classList.toggle('ev-font-large',size===2);font.setAttribute('aria-label','Cambiar tamaño de letra · '+[20,18,22][size]+' píxeles')};applyFont();font.onclick=()=>{size=(size+1)%3;applyFont();try{localStorage.setItem('ev-font',String(size))}catch{}};
 let format=innerWidth<720?'mobile':'a4';const pdf=reader.querySelector('[data-ev-pdf]');pdf.onclick=async()=>{pdf.disabled=true;E.status(status,'Preparando PDF…');try{await E.pdf(r,brief,format);E.status(status,'PDF descargado.')}catch{E.status(status,'No pudimos descargar el PDF. Intenta de nuevo.')}finally{pdf.disabled=false}};
 const fd=document.createElement('dialog');fd.id='ev-pdf-format';fd.className='ev-dialog';fd.setAttribute('aria-labelledby','ev-pdf-title');fd.innerHTML='<div class="ev-dialog-head"><h2 id="ev-pdf-title">Formato del PDF</h2><button type="button" aria-label="Cerrar">×</button></div><div class="ev-dialog-body"><button type="button" data-format="a4">Descargar · Computadora A4</button> <button type="button" data-format="mobile">Descargar · Celular</button><p class="ev-meta">Elige el formato para descargar esta versión.</p></div>';document.body.append(fd);fd.querySelector('button[aria-label]').onclick=()=>fd.close();fd.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{format=b.dataset.format;reader.querySelector('[data-ev-format]').textContent=format==='mobile'?'Celular':'A4';fd.close();pdf.click()});reader.querySelector('[data-ev-format]').onclick=()=>fd.showModal();
 const save=reader.querySelector('[data-ev-save]');let busy=false;save.onclick=async()=>{if(busy)return;busy=true;save.disabled=true;try{const lib=await E.library(),state=await lib.getLibraryState();if(!state.signedIn){location.href='/login.html?next='+encodeURIComponent(location.pathname+location.search);return}const added=await lib.toggleFavorite(r.id);save.textContent=added?'Guardado':'Guardar';save.setAttribute('aria-pressed',String(added));E.status(status,added?'Ensayo guardado en tu biblioteca.':'Ensayo retirado de tu biblioteca.')}catch{E.status(status,'No pudimos actualizar tu biblioteca. Intenta de nuevo.')}finally{busy=false;save.disabled=false}};
 E.library().then(lib=>lib.getLibraryState()).then(state=>{const added=state.signedIn&&state.favorites.includes(String(r.id));save.textContent=added?'Guardado':'Guardar';save.setAttribute('aria-pressed',String(added))}).catch(()=>{});
 const dates=await import('/trial-data.js?v=20261003-laboratorio-v1'),ordered=all.slice().sort(dates.compareTrialDates),index=ordered.findIndex(x=>x.id===r.id);reader.querySelector('[data-ev-neighbors]').innerHTML=(index>0?'<a class="ev-button" href="'+map[String(ordered[index-1].id)].path+'">← Ensayo anterior</a>':'')+'<a class="ev-button" href="/" data-ev-return>Volver a la lista</a>'+(index<ordered.length-1?'<a class="ev-button" href="'+map[String(ordered[index+1].id)].path+'">Ensayo siguiente →</a>':'');
 for(const a of reader.querySelectorAll('[data-ev-return]')){a.href=window.RTReadingContext?.destination()||'/';a.onclick=()=>window.RTReadingContext?.requestReturn()}
 const inferred=E.inferSubspecialty(r);if(inferred){const badge=document.createElement('span');badge.className='ev-tag';badge.dataset.evSubspecialty='true';badge.textContent=inferred;reader.querySelector('.ev-reading-head').append(badge)}
 const pdfLabel=brief?'Descargar resumen breve PDF':'Descargar resumen completo PDF';pdf.setAttribute('aria-label',pdfLabel);pdf.dataset.pdfVersion=brief?'breve':'completo';

 const categories=record=>E.areas(record).filter(s=>['Medicina Crítica','Medicina Interna'].includes(s)),specialty=categories(r),topics=new Set((r.temas||[]).map(E.norm)),clusters=new Set((map[String(r.id)].clusters||[]).map(c=>c.path));
 const rank=all.filter(x=>String(x.id)!==String(r.id)).map(x=>({r:x,s:(map[String(x.id)].clusters||[]).filter(c=>clusters.has(c.path)).length*4+(x.temas||[]).filter(t=>topics.has(E.norm(t))).length*2+categories(x).filter(s=>specialty.includes(s)).length})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||String(b.r.fecha||'').localeCompare(String(a.r.fecha||''))).slice(0,4);reader.querySelector('[data-ev-related]').innerHTML=rank.map(x=>E.card(x.r,map[String(x.r.id)].path)).join('');
 if(dynamic)import('/reader-advertising.js').then(m=>m.loadReaderAdvertising(r,article)).catch(()=>{});
 }catch(error){E.readerError=error;if(dynamic)dynamic.innerHTML='<section class="ev-notice"><h1>No pudimos cargar el ensayo</h1><a class="ev-button" href="">Reintentar</a> <a class="ev-button" href="/">Volver al archivo</a></section>'}
});
})();

/* source: ui/forms.js */
(() => {const E=window.EV;E.ready(()=>{
 if(!document.body.classList.contains('ev-member'))return;
 document.querySelectorAll('input[type=password]').forEach(input=>{const wrap=document.createElement('div');wrap.className='ev-password';input.before(wrap);wrap.append(input);const button=document.createElement('button');button.type='button';button.textContent='Mostrar';button.setAttribute('aria-label','Mostrar contraseña');button.setAttribute('aria-controls',input.id);button.setAttribute('aria-pressed','false');button.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');button.setAttribute('aria-pressed',String(show))};wrap.append(button);if(input.autocomplete==='new-password'){const strength=document.createElement('p');strength.className='ev-strength';strength.setAttribute('role','status');wrap.after(strength);input.addEventListener('input',()=>{const s=input.value,score=Number(s.length>=8)+Number(s.length>=12)+Number(/[a-z]/.test(s)&&/[A-Z]/.test(s))+Number(/\d/.test(s)&&/[^a-z0-9]/i.test(s));strength.textContent=s?'Robustez orientativa: '+['Muy baja','Baja','Media','Alta','Alta'][score]:''})}});
 document.querySelectorAll('form input:not([type=checkbox])').forEach(input=>{const message=document.createElement('p');message.className='ev-field-error';message.id='ev-error-'+input.id;message.hidden=true;const wrap=input.closest('.ev-password');if(wrap)wrap.after(message);else input.after(message);const prior=input.getAttribute('aria-describedby');input.setAttribute('aria-describedby',[prior,message.id].filter(Boolean).join(' '));input.addEventListener('blur',()=>{const bad=!input.validity.valid;input.setAttribute('aria-invalid',String(bad));message.hidden=!bad;message.textContent=input.validity.valueMissing?'Completa este campo.':input.validity.typeMismatch?'Escribe un correo electrónico válido.':input.validity.tooShort?'La contraseña debe tener al menos '+input.minLength+' caracteres.':'Revisa el formato de este campo.'})});
});
})();
