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

let records,routes,library;const recordCache=new Map();
// Requests in flight are cancelled when the page is left: WebKit otherwise reports the
// interrupted fetch as an uncaught "access control checks" error (same rule as trial-data.js).
let nav=new AbortController();for(const ev of ['beforeunload','pagehide'])addEventListener(ev,()=>nav.abort());addEventListener('pageshow',e=>{if(e.persisted)nav=new AbortController()});
const get=url=>window.evNavigatingAway||nav.signal.aborted?Promise.reject(new DOMException('La navegación finalizó','AbortError')):fetch(url,{signal:nav.signal});
// A failed load must not stay cached: the next action retries (mobile networks drop requests).
E.data=()=>records??=import('/trial-data.js?v=20261003-laboratorio-v1').then(m=>m.loadTrials()).catch(e=>{records=undefined;throw e});
// Full archive (with cuerpo/corto) only as a fallback for a missing trial file.
E.full=()=>import('/trial-data.js?v=20261003-laboratorio-v1').then(m=>m.loadFullTrials());
E.routes=()=>routes??=get('/seo-manifest.json').then(r=>{if(!r.ok)throw Error('No se pudo cargar el índice');return r.json()}).catch(e=>{routes=undefined;throw e});
// One small file per trial (~20 KB) so reading, PDF and controls never wait for the full archive.
// If that file is missing or fails, the full archive is the fallback (unknown ids resolve to null).
E.record=id=>{id=String(id??'').trim();if(!/^\d+$/.test(id))return Promise.resolve(null);if(!recordCache.has(id))recordCache.set(id,get('/datos/ensayos/'+id+'.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(r=>r&&typeof r==='object'&&!Array.isArray(r)&&String(r.id)===id?r:null).catch(e=>{recordCache.delete(id);if(e?.name==='AbortError')throw e;return E.full().then(all=>all.find(x=>String(x.id)===id)||null).catch(()=>{throw e})}));return recordCache.get(id)};
E.library=()=>library??=import('/library-store.js?v=20261003-laboratorio-v1');
E.inferSubspecialty=r=>{if(r&&typeof r._sub==='string')return r._sub;const result=globalThis.SpecialtyClassification?.classify(r);return result?.specialty===globalThis.SpecialtyClassification?.REVIEW?'':result?.specialty||''};
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
E.readtime=r=>{const m=r._min&&!r.cuerpo?r._min:{cuerpo:E.minutes(r.cuerpo),corto:r.corto?E.minutes(r.corto):0};return E.icon('clock')+'<span>Completo '+m.cuerpo+' min</span>'+(m.corto?'<span>Breve '+m.corto+' min</span>':'')};
E.facts=r=>'<dl class="ev-study-facts">'+[['revista','Revista'],['anio','Año'],['fecha','Fecha'],['tipo_estudio','Tipo de estudio'],['especialidad_principal','Especialidad'],['especialidad_secundaria','Especialidad secundaria'],['temas','Temas'],['registro','Registro'],['doi','DOI'],['financiacion','Financiación']].filter(([k])=>r[k]!==''&&r[k]!=null&&(!Array.isArray(r[k])||r[k].length)).map(([k,label])=>'<div><dt>'+label+'</dt><dd data-ev-field="'+k+'">'+E.esc(Array.isArray(r[k])?r[k].join(' · '):r[k])+'</dd></div>').join('')+'</dl>';
E.card=(r,path)=>{const area=E.area(r),tone=E.tone(area),t=E.esc(r.titulo),p=E.esc(path),topics=(r.temas||[]).join(' · ');return '<li class="ev-card" data-id="'+r.id+'" data-tone="'+tone+'"'+(topics?' data-ev-topics="'+E.esc(topics)+'"':'')+'><a class="ev-card-title" href="'+p+'" data-ev-read="'+r.id+'"><h2>'+t+'</h2></a><p class="ev-card-meta"><span>'+E.esc(r.revista)+'</span><span>'+E.esc(E.humanDate(r.fecha))+'</span></p><div class="ev-card-tags"><span class="ev-area" data-tone="'+tone+'">'+E.esc(area)+'</span></div>'+'<details class="ev-card-facts"><summary>Ficha del estudio</summary>'+E.facts(r)+'</details><div class="ev-card-foot"><p class="ev-readtime">'+E.readtime(r)+'</p><div class="ev-card-actions"><a class="ev-btn ev-btn-primary" href="'+p+'" data-ev-read="'+r.id+'" aria-label="Leer resumen: '+t+'">Leer</a><details class="ev-pdf-menu"><summary class="ev-btn" aria-label="Descargar PDF de '+t+'">'+E.icon('pdf')+'<span>PDF</span></summary><div class="ev-pdf-pop"><button type="button" data-ev-card-pdf="'+r.id+'" data-ev-version="completo" aria-label="Descargar resumen completo PDF de '+t+'">PDF completo</button><button type="button" data-ev-card-pdf="'+r.id+'" data-ev-version="breve" aria-label="Descargar resumen breve PDF de '+t+'">PDF breve</button></div></details></div></div></li>'};
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
 // Escape fires 'cancel' synchronously; 'close' is queued. Reset the state on both.
 for(const type of ['cancel','close'])menu?.addEventListener(type,()=>menuButtons.forEach(x=>x.setAttribute('aria-expanded','false')));
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
  try{const r=await E.record(b.dataset.evCardPdf);if(!r)throw Error('Resumen no disponible');await E.pdf(r,b.dataset.evVersion==='breve');b.textContent=label;b.closest('details')?.removeAttribute('open')}catch{b.textContent='No se pudo descargar'}finally{b.disabled=false;setTimeout(()=>{b.textContent=label},2500)}
 });
 // Back to top and header elevation
 const top=document.querySelector('[data-ev-top]');let ticking=false;
 const onScroll=()=>{ticking=false;const y=scrollY;header?.toggleAttribute('data-ev-scrolled',y>8);if(top)top.hidden=y<innerHeight*2};
 addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});onScroll();
 top?.addEventListener('click',()=>{scrollTo({top:0,behavior:E.reduced()?'auto':'smooth'});document.getElementById('ev-main')?.focus({preventScroll:true})});
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
  // Un doble clic en «Mostrar más» no debe abrir la tarjeta que aparece bajo el puntero.
  let moreAt=0;more.onclick=()=>{moreAt=Date.now();limit+=pageSize;render(true)};
  list.addEventListener('click',e=>{if(Date.now()-moreAt<600&&e.target.closest('a,button,summary')){e.preventDefault();e.stopPropagation()}},true);
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

/* source: ui/reader.js */
(() => {const E=window.EV;
const root=document.documentElement;
const editorialDates=r=>{const parts=[];for(const [key,label]of [['fecha_publicacion_resumen','Publicado en Resúmenes Trials'],['fecha_revision','Última revisión']]){const value=r[key]||(key==='fecha_revision'?r.actualizado:'');if(value)parts.push('<span>'+label+': <time datetime="'+E.esc(value)+'">'+E.esc(E.humanDate(value))+'</time></span>')}return parts.length?'<div class="ev-editorial-dates">'+parts.join(' · ')+'</div>':''};
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
const tool=(attr,icon,label,extra='')=>'<button type="button" class="ev-tool" '+attr+extra+'>'+E.icon(icon)+'<span>'+label+'</span></button>';
function markup(r,path,brief){
 const area=E.area(r),original=String(r.original).startsWith('https://')?'<a href="'+E.esc(r.original)+'" target="_blank" rel="noopener noreferrer">'+E.esc(r.original)+E.icon('external')+'</a>':E.esc(r.original);
 return '<section class="ev-reading" data-ev-reader="'+r.id+'" data-ev-brief="'+brief+'"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/" data-ev-return>'+E.icon('left')+'Volver a la lista</a><a href="/metodologia/">Metodología</a></nav>'
 +'<header class="ev-reading-head"><div class="ev-card-tags"><span class="ev-area" data-tone="'+E.tone(area)+'">'+E.esc(area)+'</span><span class="ev-type">'+E.esc(r.tipo_estudio)+' · '+E.esc(r.anio)+'</span></div><h1 data-ev-field="titulo">'+E.esc(r.titulo)+'</h1><p class="ev-byline"><span data-ev-field="autor">'+E.esc(r.autor)+'</span><span data-ev-field="revista">'+E.esc(r.revista)+'</span><span data-ev-field="fecha">'+E.esc(E.humanDate(r.fecha))+'</span></p>'
 +'<div class="ev-keyfinding"><p class="ev-keyfinding-label">'+E.icon('spark')+'Hallazgo principal</p><p data-ev-field="hallazgo" class="ev-lead">'+E.safe(r.hallazgo)+'</p></div><p class="ev-readtime">'+E.readtime(r)+'</p>'+editorialDates(r)+'</header>'
 +'<details class="ev-facts" open><summary>Ficha técnica del estudio</summary>'+E.facts(r)+'</details>'
 +'<div class="ev-toolbar" role="region" aria-label="Controles de lectura"><div class="ev-version" role="group" aria-label="Versión del resumen"><a href="'+E.esc(path)+'"'+(!brief?' aria-current="page"':'')+'>Completo</a><a href="/resumen.html?id='+r.id+'&amp;v=corto"'+(brief?' aria-current="page"':'')+'>Breve</a></div>'
 +tool('data-ev-sections','list','Índice')+tool('data-ev-pdf','pdf','PDF',' aria-haspopup="dialog"')+tool('data-ev-focus','read','Modo lectura',' aria-pressed="false"')+'<button type="button" class="ev-tool ev-more-toggle" data-ev-more aria-expanded="false" aria-controls="ev-more-tools">'+E.icon('more')+'<span>Más</span></button><div class="ev-more-tools" id="ev-more-tools">'+tool('data-ev-save','bookmark','Guardar')+tool('data-ev-share','share','Compartir')+tool('data-ev-font','text','Letra',' aria-label="Cambiar tamaño de letra"')+'</div></div>'
 +'<progress class="ev-progress" max="100" value="0" aria-label="Progreso de lectura"></progress><div class="ev-reader-grid"><article class="ev-body">'+E.safe(r[brief?'corto':'cuerpo'])+'</article><aside class="ev-rail"><p class="ev-rail-title">En esta página</p><nav data-ev-toc aria-label="Secciones del artículo"></nav></aside></div>'
 +'<div class="ev-endmatter"><p class="ev-original"><span class="ev-original-label">Artículo original</span>'+original+'</p><nav class="ev-neighbors" aria-label="Continuidad de lectura" data-ev-neighbors></nav><section class="ev-related"><h2>Evidencia relacionada</h2><ul class="ev-list" data-ev-related></ul></section><p class="ev-status" id="ev-reader-status" role="status"></p></div></section>';
}
function dialog(id,title,body){const d=document.createElement('dialog');d.id=id;d.className='ev-dialog ev-sheet';d.setAttribute('aria-labelledby',id+'-title');d.innerHTML='<div class="ev-dialog-head"><h2 id="'+id+'-title">'+title+'</h2><button class="ev-icon-btn" type="button" aria-label="Cerrar">'+E.icon('close')+'</button></div><div class="ev-dialog-body">'+body+'</div>';d.querySelector('.ev-dialog-head button').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close()}});document.body.append(d);return d}
const SIZES=[{label:'normal',cls:''},{label:'grande',cls:'ev-font-large'},{label:'pequeña',cls:'ev-font-small'}];// 20 → 22 → 18 px
E.ready(async()=>{
 if(!document.body.classList.contains('ev-reader'))return;
 let all,map,r,reader,brief=false;const dynamic=document.getElementById('ev-dynamic-reader');
 try{
  // Only the trial being read is needed to render and wire the controls; the full
  // archive (neighbours, related) loads afterwards and never blocks reading.
  const pathOf=async rec=>rec.ruta||(await E.routes())[String(rec.id)].path;let path;
  if(dynamic){const p=new URLSearchParams(location.search),id=p.get('id');r=await E.record(id);if(!r){delete root.dataset.evReadingMode;document.title='Resumen no encontrado · Resúmenes Trials';dynamic.innerHTML='<section class="ev-notice ev-doc"><p class="ev-eyebrow">Enlace no válido</p><h1>Resumen no encontrado</h1><p>El identificador no corresponde a un ensayo disponible. Usa el buscador de arriba o vuelve al archivo.</p><a class="ev-btn ev-btn-primary" href="/">Volver al archivo</a></section>';return}brief=p.get('v')==='corto'&&!!r.corto;path=await pathOf(r);dynamic.innerHTML=markup(r,path,brief);updateMetadata(r,path,brief)}
  reader=document.querySelector('[data-ev-reader]');if(!reader)return;r??=await E.record(reader.dataset.evReader);brief=reader.dataset.evBrief==='true';if(!r)throw Error('Resumen no disponible');path??=await pathOf(r).catch(()=>location.pathname);
  const article=reader.querySelector('article'),headings=[...article.querySelectorAll('h2')],toc=reader.querySelector('[data-ev-toc]'),progress=reader.querySelector('progress'),status=document.getElementById('ev-reader-status'),toolbar=reader.querySelector('.ev-toolbar');
  E.prose(reader);
  // Section index: rail on desktop, sheet everywhere.
  headings.forEach((h,i)=>h.id='ev-section-'+(i+1));const links=headings.map((h,i)=>'<a href="#'+h.id+'"><b>'+String(i+1).padStart(2,'0')+'</b><span>'+E.esc(h.textContent)+'</span></a>').join('');toc.innerHTML=links;
  const sections=dialog('ev-sections','Índice del resumen','<nav class="ev-dialog-list ev-toc-list" aria-label="Índice de secciones">'+links+'</nav>');
  reader.querySelector('[data-ev-sections]').onclick=()=>sections.showModal();
  sections.querySelectorAll('a').forEach(a=>a.onclick=e=>{e.preventDefault();sections.close();const h=document.getElementById(a.hash.slice(1));h.tabIndex=-1;h.scrollIntoView({block:'start'});h.focus({preventScroll:true});history.replaceState(history.state,'',a.hash)});
  const indexLinks=[...toc.querySelectorAll('a'),...sections.querySelectorAll('nav a')];let activeSection;
  const update=()=>{const rect=article.getBoundingClientRect(),total=Math.max(1,article.offsetHeight-innerHeight*.5);progress.value=Math.max(0,Math.min(100,-rect.top/total*100));const reference=(parseFloat(getComputedStyle(root).scrollPaddingTop)||0)+(parseFloat(getComputedStyle(headings[0]).scrollMarginTop)||0)+2;let current=headings[0];for(const heading of headings){if(heading.getBoundingClientRect().top>reference)break;current=heading}if(current.id!==activeSection){activeSection=current.id;for(const a of indexLinks){if(a.hash==='#'+activeSection)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')}}};
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});update();
  // Reading mode
  const focus=reader.querySelector('[data-ev-focus]'),focusLabel=focus.querySelector('span');
  const applyFocus=on=>{if(on)root.dataset.evReadingMode='on';else delete root.dataset.evReadingMode;document.body.classList.toggle('ev-focus',on);focus.setAttribute('aria-pressed',String(on));focusLabel.textContent=on?'Salir de lectura':'Modo lectura';update()};
  let focusOn=false;try{focusOn=localStorage.getItem('ev-focus')==='true'}catch{}applyFocus(focusOn);
  focus.onclick=()=>{const on=focus.getAttribute('aria-pressed')!=='true';applyFocus(on);try{localStorage.setItem('ev-focus',String(on))}catch{}};
  // Letter size: normal → grande → pequeña
  const font=reader.querySelector('[data-ev-font]');let size=0;try{size=Number(localStorage.getItem('ev-font'))||0}catch{}if(!SIZES[size])size=0;
  const applyFont=()=>{for(const s of SIZES)if(s.cls)root.classList.toggle(s.cls,s===SIZES[size]);font.setAttribute('aria-label','Cambiar tamaño de letra · ahora '+SIZES[size].label);update()};applyFont();
  font.onclick=()=>{size=(size+1)%SIZES.length;applyFont();try{localStorage.setItem('ev-font',String(size))}catch{}E.status(status,'Tamaño de letra: '+SIZES[size].label+'.')};
  // Overflow tools on small screens
  const moreBtn=reader.querySelector('[data-ev-more]');const setMore=on=>{toolbar.classList.toggle('ev-more-open',on);moreBtn.setAttribute('aria-expanded',String(on))};
  moreBtn.onclick=()=>setMore(!toolbar.classList.contains('ev-more-open'));
  toolbar.querySelector('.ev-more-tools').addEventListener('click',e=>{if(e.target.closest('button'))setTimeout(()=>setMore(false),0)});
  document.addEventListener('pointerdown',e=>{if(toolbar.classList.contains('ev-more-open')&&!toolbar.contains(e.target))setMore(false)});
  // PDF: one panel with version and format, preselected for this device.
  const pdfBtn=reader.querySelector('[data-ev-pdf]'),device=E.defaultFormat();
  const radio=(name,value,label,hint,checked)=>'<label class="ev-option"><input type="radio" name="'+name+'" value="'+value+'"'+(checked?' checked':'')+'><span><b>'+label+'</b><small>'+hint+'</small></span></label>';
  const fmtBtn=(value,label,hint)=>'<button type="button" class="ev-btn ev-format-btn'+(value===device?' ev-btn-primary':'')+'" data-ev-pdf-go data-format="'+value+'">'+E.icon('pdf')+'<span><b>'+label+'</b><small>'+hint+'</small></span></button>';
  const formats=[['mobile','Celular','Letra grande, una columna'],['a4','Computadora (A4)','Para imprimir o pantalla grande']].sort(a=>a[0]===device?-1:1);
  const pdfDialog=dialog('ev-pdf-dialog','Descargar PDF','<fieldset class="ev-options"><legend>1 · Elige la versión</legend>'+radio('ev-pdf-version','completo','Completo','Todas las secciones · '+E.minutes(r.cuerpo)+' min',!brief)+(r.corto?radio('ev-pdf-version','breve','Breve','Lo esencial · '+E.minutes(r.corto)+' min',brief):'')+'</fieldset><fieldset class="ev-options ev-formats"><legend>2 · Descarga en el formato que prefieras</legend>'+formats.map(f=>fmtBtn(...f)).join('')+'</fieldset><p class="ev-dialog-note">Recomendado para este dispositivo: '+(device==='mobile'?'Celular':'Computadora (A4)')+'.</p><p class="ev-status" role="status" data-ev-pdf-status></p>');
  const pdfStatus=pdfDialog.querySelector('[data-ev-pdf-status]');
  pdfBtn.onclick=()=>E.open('ev-pdf-dialog');
  for(const go of pdfDialog.querySelectorAll('[data-ev-pdf-go]'))go.onclick=async()=>{const version=pdfDialog.querySelector('[name=ev-pdf-version]:checked')?.value||'completo';go.disabled=true;E.status(pdfStatus,'Preparando PDF…');try{await E.pdf(r,version==='breve',go.dataset.format);E.status(pdfStatus,'');E.status(status,'PDF descargado.');if(pdfDialog.open)pdfDialog.close()}catch{E.status(pdfStatus,'No pudimos descargar el PDF. Intenta de nuevo.')}finally{go.disabled=false}};
  pdfBtn.setAttribute('aria-label',brief?'Descargar resumen breve PDF o elegir el completo':'Descargar resumen completo PDF o elegir el breve');pdfBtn.dataset.pdfVersion=brief?'breve':'completo';
  // Save
  const save=reader.querySelector('[data-ev-save]'),saveLabel=save.querySelector('span');let busy=false;
  const syncSave=added=>{saveLabel.textContent=added?'Guardado':'Guardar';save.setAttribute('aria-pressed',String(added))};
  save.onclick=async()=>{if(busy)return;busy=true;save.disabled=true;try{const lib=await E.library(),state=await lib.getLibraryState();if(!state.signedIn){location.href='/login.html?next='+encodeURIComponent(location.pathname+location.search);return}const added=await lib.toggleFavorite(r.id);syncSave(added);E.status(status,added?'Ensayo guardado en tu biblioteca.':'Ensayo retirado de tu biblioteca.')}catch{E.status(status,'No pudimos actualizar tu biblioteca. Intenta de nuevo.')}finally{busy=false;save.disabled=false}};
  E.library().then(lib=>lib.getLibraryState()).then(state=>syncSave(state.signedIn&&state.favorites.includes(String(r.id)))).catch(()=>{});
  // Share
  const share=reader.querySelector('[data-ev-share]'),shareUrl='https://resumenestrials.com'+path;
  share.onclick=async()=>{const data={title:E.plain(r.titulo),text:E.plain(r.titulo)+' · Resúmenes Trials',url:shareUrl};try{if(navigator.share&&root.dataset.evPointer==='tactil'){await navigator.share(data);return}await navigator.clipboard.writeText(shareUrl);E.status(status,'Enlace copiado. Ya puedes pegarlo donde quieras.')}catch(e){if(e?.name!=='AbortError')E.status(status,'Copia este enlace: '+shareUrl)}};
  if(dynamic)import('/reader-advertising.js').then(m=>m.loadReaderAdvertising(r,article)).catch(()=>{});
  const inferred=E.inferSubspecialty(r);if(inferred){const tag=document.createElement('span');tag.className='ev-tag';tag.dataset.evSubspecialty='true';tag.textContent=inferred;reader.querySelector('.ev-reading-head .ev-card-tags').append(tag)}
  for(const a of reader.querySelectorAll('[data-ev-return]')){a.href=window.RTReadingContext?.destination()||'/';a.onclick=()=>window.RTReadingContext?.requestReturn()}
  // Continuity and related evidence: background, non-blocking.
  (async()=>{try{
  [all,map]=await Promise.all([E.data(),E.routes()]);
  const dates=await import('/trial-data.js?v=20261003-laboratorio-v1'),ordered=all.slice().sort(dates.compareTrialDates),index=ordered.findIndex(x=>x.id===r.id);
  const neighbor=(item,dir)=>'<a class="ev-neighbor" data-dir="'+dir+'" href="'+map[String(item.id)].path+'"><small>'+(dir==='prev'?E.icon('left')+'Ensayo anterior':'Ensayo siguiente'+E.icon('right'))+'</small><b>'+E.esc(item.titulo)+'</b></a>';
  reader.querySelector('[data-ev-neighbors]').innerHTML=(index>0?neighbor(ordered[index-1],'prev'):'')+'<a class="ev-btn ev-neighbor-back" href="/" data-ev-return>'+E.icon('list')+'<span>Volver a la lista</span></a>'+(index<ordered.length-1?neighbor(ordered[index+1],'next'):'');
  for(const a of reader.querySelectorAll('[data-ev-return]')){a.href=window.RTReadingContext?.destination()||'/';a.onclick=()=>window.RTReadingContext?.requestReturn()}
  const categories=record=>E.areas(record).filter(s=>E.MAIN.includes(s)),specialty=categories(r),topics=new Set((r.temas||[]).map(E.norm)),clusters=new Set((map[String(r.id)].clusters||[]).map(c=>c.path));
  const rank=all.filter(x=>String(x.id)!==String(r.id)).map(x=>({r:x,s:(map[String(x.id)].clusters||[]).filter(c=>clusters.has(c.path)).length*4+(x.temas||[]).filter(t=>topics.has(E.norm(t))).length*2+categories(x).filter(s=>specialty.includes(s)).length})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||String(b.r.fecha||'').localeCompare(String(a.r.fecha||''))).slice(0,3);
  reader.querySelector('[data-ev-related]').innerHTML=rank.map(x=>E.card(x.r,map[String(x.r.id)].path)).join('');
  reader.dataset.evContinuity='ready';
  }catch(error){E.readerContinuityError=error;reader.dataset.evContinuity='error'}})();
 }catch(error){E.readerError=error;if(dynamic)dynamic.innerHTML='<section class="ev-notice ev-doc"><h1>No pudimos cargar el ensayo</h1><p>Revisa tu conexión e inténtalo de nuevo.</p><div class="ev-actions-row"><a class="ev-btn ev-btn-primary" href="">Reintentar</a><a class="ev-btn" href="/">Volver al archivo</a></div></section>'}
});
})();

/* source: ui/forms.js */
(() => {const E=window.EV;E.ready(()=>{
 if(!document.body.classList.contains('ev-member'))return;
 document.querySelectorAll('input[type=password]').forEach(input=>{const wrap=document.createElement('div');wrap.className='ev-password';input.before(wrap);wrap.append(input);const button=document.createElement('button');button.type='button';button.textContent='Mostrar';button.setAttribute('aria-label','Mostrar contraseña');button.setAttribute('aria-controls',input.id);button.setAttribute('aria-pressed','false');button.onclick=()=>{const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');button.setAttribute('aria-pressed',String(show))};wrap.append(button);if(input.autocomplete==='new-password'){const strength=document.createElement('p');strength.className='ev-strength';strength.setAttribute('role','status');wrap.after(strength);input.addEventListener('input',()=>{const s=input.value,score=Number(s.length>=8)+Number(s.length>=12)+Number(/[a-z]/.test(s)&&/[A-Z]/.test(s))+Number(/\d/.test(s)&&/[^a-z0-9]/i.test(s));strength.textContent=s?'Robustez orientativa: '+['Muy baja','Baja','Media','Alta','Alta'][score]:''})}});
 document.querySelectorAll('form input:not([type=checkbox])').forEach(input=>{const message=document.createElement('p');message.className='ev-field-error';message.id='ev-error-'+input.id;message.hidden=true;const wrap=input.closest('.ev-password');if(wrap)wrap.after(message);else input.after(message);const prior=input.getAttribute('aria-describedby');input.setAttribute('aria-describedby',[prior,message.id].filter(Boolean).join(' '));input.addEventListener('blur',()=>{const bad=!input.validity.valid;input.setAttribute('aria-invalid',String(bad));message.hidden=!bad;message.textContent=input.validity.valueMissing?'Completa este campo.':input.validity.typeMismatch?'Escribe un correo electrónico válido.':input.validity.tooShort?'La contraseña debe tener al menos '+input.minLength+' caracteres.':'Revisa el formato de este campo.'})});
});
})();
