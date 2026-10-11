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
  [all,map]=await Promise.all([E.data(),E.routes()]);
  if(dynamic){const p=new URLSearchParams(location.search),id=p.get('id');r=all.find(r=>String(r.id)===id);if(!r){delete root.dataset.evReadingMode;document.title='Resumen no encontrado · Resúmenes Trials';dynamic.innerHTML='<section class="ev-notice ev-doc"><p class="ev-eyebrow">Enlace no válido</p><h1>Resumen no encontrado</h1><p>El identificador no corresponde a un ensayo disponible. Usa el buscador de arriba o vuelve al archivo.</p><a class="ev-btn ev-btn-primary" href="/">Volver al archivo</a></section>';return}brief=p.get('v')==='corto'&&!!r.corto;dynamic.innerHTML=markup(r,map[String(r.id)].path,brief);updateMetadata(r,map[String(r.id)].path,brief)}
  reader=document.querySelector('[data-ev-reader]');if(!reader)return;r??=all.find(x=>String(x.id)===reader.dataset.evReader);brief=reader.dataset.evBrief==='true';if(!r)throw Error('Resumen no disponible');
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
  for(const go of pdfDialog.querySelectorAll('[data-ev-pdf-go]'))go.onclick=async()=>{const version=pdfDialog.querySelector('[name=ev-pdf-version]:checked')?.value||'completo';go.disabled=true;E.status(pdfStatus,'Preparando PDF…');try{await E.pdf(r,version==='breve',go.dataset.format);E.status(pdfStatus,'PDF descargado.');E.status(status,'PDF descargado.');setTimeout(()=>pdfDialog.open&&pdfDialog.close(),900)}catch{E.status(pdfStatus,'No pudimos descargar el PDF. Intenta de nuevo.')}finally{go.disabled=false}};
  pdfBtn.setAttribute('aria-label',brief?'Descargar resumen breve PDF o elegir el completo':'Descargar resumen completo PDF o elegir el breve');pdfBtn.dataset.pdfVersion=brief?'breve':'completo';
  // Save
  const save=reader.querySelector('[data-ev-save]'),saveLabel=save.querySelector('span');let busy=false;
  const syncSave=added=>{saveLabel.textContent=added?'Guardado':'Guardar';save.setAttribute('aria-pressed',String(added))};
  save.onclick=async()=>{if(busy)return;busy=true;save.disabled=true;try{const lib=await E.library(),state=await lib.getLibraryState();if(!state.signedIn){location.href='/login.html?next='+encodeURIComponent(location.pathname+location.search);return}const added=await lib.toggleFavorite(r.id);syncSave(added);E.status(status,added?'Ensayo guardado en tu biblioteca.':'Ensayo retirado de tu biblioteca.')}catch{E.status(status,'No pudimos actualizar tu biblioteca. Intenta de nuevo.')}finally{busy=false;save.disabled=false}};
  E.library().then(lib=>lib.getLibraryState()).then(state=>syncSave(state.signedIn&&state.favorites.includes(String(r.id)))).catch(()=>{});
  // Share
  const share=reader.querySelector('[data-ev-share]'),shareUrl='https://resumenestrials.com'+map[String(r.id)].path;
  share.onclick=async()=>{const data={title:E.plain(r.titulo),text:E.plain(r.titulo)+' · Resúmenes Trials',url:shareUrl};try{if(navigator.share&&root.dataset.evPointer==='tactil'){await navigator.share(data);return}await navigator.clipboard.writeText(shareUrl);E.status(status,'Enlace copiado. Ya puedes pegarlo donde quieras.')}catch(e){if(e?.name!=='AbortError')E.status(status,'Copia este enlace: '+shareUrl)}};
  // Continuity
  const dates=await import('/trial-data.js?v=20261003-laboratorio-v1'),ordered=all.slice().sort(dates.compareTrialDates),index=ordered.findIndex(x=>x.id===r.id);
  const neighbor=(item,dir)=>'<a class="ev-neighbor" data-dir="'+dir+'" href="'+map[String(item.id)].path+'"><small>'+(dir==='prev'?E.icon('left')+'Ensayo anterior':'Ensayo siguiente'+E.icon('right'))+'</small><b>'+E.esc(item.titulo)+'</b></a>';
  reader.querySelector('[data-ev-neighbors]').innerHTML=(index>0?neighbor(ordered[index-1],'prev'):'')+'<a class="ev-btn ev-neighbor-back" href="/" data-ev-return>'+E.icon('list')+'<span>Volver a la lista</span></a>'+(index<ordered.length-1?neighbor(ordered[index+1],'next'):'');
  for(const a of reader.querySelectorAll('[data-ev-return]')){a.href=window.RTReadingContext?.destination()||'/';a.onclick=()=>window.RTReadingContext?.requestReturn()}
  const inferred=E.inferSubspecialty(r);if(inferred){const tag=document.createElement('span');tag.className='ev-tag';tag.dataset.evSubspecialty='true';tag.textContent=inferred;reader.querySelector('.ev-reading-head .ev-card-tags').append(tag)}
  const categories=record=>E.areas(record).filter(s=>E.MAIN.includes(s)),specialty=categories(r),topics=new Set((r.temas||[]).map(E.norm)),clusters=new Set((map[String(r.id)].clusters||[]).map(c=>c.path));
  const rank=all.filter(x=>String(x.id)!==String(r.id)).map(x=>({r:x,s:(map[String(x.id)].clusters||[]).filter(c=>clusters.has(c.path)).length*4+(x.temas||[]).filter(t=>topics.has(E.norm(t))).length*2+categories(x).filter(s=>specialty.includes(s)).length})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||String(b.r.fecha||'').localeCompare(String(a.r.fecha||''))).slice(0,3);
  reader.querySelector('[data-ev-related]').innerHTML=rank.map(x=>E.card(x.r,map[String(x.r.id)].path)).join('');
  if(dynamic)import('/reader-advertising.js').then(m=>m.loadReaderAdvertising(r,article)).catch(()=>{});
 }catch(error){E.readerError=error;if(dynamic)dynamic.innerHTML='<section class="ev-notice ev-doc"><h1>No pudimos cargar el ensayo</h1><p>Revisa tu conexión e inténtalo de nuevo.</p><div class="ev-actions-row"><a class="ev-btn ev-btn-primary" href="">Reintentar</a><a class="ev-btn" href="/">Volver al archivo</a></div></section>'}
});
})();
