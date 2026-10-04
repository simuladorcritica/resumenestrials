(() => {
  'use strict';
  if (window.__rtReaderUIV8) return;
  window.__rtReaderUIV8 = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const path = location.pathname.toLowerCase();
  const isCanonical = path.includes('/trials/');
  const isLegacy = /\/resumen\.html$/.test(path);
  const isBrief = /\/resumen\.html$/.test(path) && new URLSearchParams(location.search).get('v') === 'corto';
  const isHome = /\/(?:index\.html)?$/.test(path);

  const CSS = `
    html body.rt-future.rt-future-trial .enlace-original,
    html body.rt-future.rt-future-trial .pie-nav,
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions,
    html body.rt-future.rt-future-trial .relacionados{
      grid-column:1!important;min-width:0!important;width:100%!important;max-width:none!important;box-sizing:border-box!important
    }
    html body.rt-future.rt-future-trial .enlace-original{
      margin:8px 0 0!important;padding:20px 22px!important;border:1px solid var(--rt-line)!important;
      border-left:3px solid var(--rt-teal)!important;border-radius:11px!important;background:rgba(36,200,180,.035)!important;
      overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important
    }
    html body.rt-future.rt-future-trial .enlace-original a{display:inline!important;max-width:100%!important;overflow-wrap:anywhere!important;word-break:normal!important}
    html body.rt-future.rt-future-trial .pie-nav{
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;
      margin:14px 0 0!important;padding:0!important;border:0!important;background:transparent!important;position:relative!important;z-index:3!important
    }
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-back,
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-version,
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions .rt-reader-footer-download{
      display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;width:100%!important;min-width:0!important;
      min-height:58px!important;margin:0!important;padding:12px 16px!important;border:1px solid rgba(116,214,204,.32)!important;border-radius:10px!important;
      box-sizing:border-box!important;font:600 14px/1.3 var(--rt-mono)!important;letter-spacing:.02em!important;text-transform:none!important;
      text-align:center!important;text-decoration:none!important;white-space:normal!important;overflow:visible!important;overflow-wrap:break-word!important;
      word-break:normal!important;hyphens:none!important;cursor:pointer!important;pointer-events:auto!important;position:relative!important;z-index:4!important;
      transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease!important
    }
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-back,
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-version{color:#84ddd4!important;background:rgba(255,255,255,.018)!important}
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-back:hover,
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-version:hover{
      color:#b5f4ed!important;border-color:rgba(116,214,204,.62)!important;background:rgba(36,200,180,.065)!important;transform:translateY(-1px)!important
    }
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions{
      display:block!important;margin:10px 0 0!important;padding:0 0 28px!important;border:0!important;border-bottom:1px solid var(--rt-line)!important;
      background:transparent!important;position:relative!important;z-index:3!important
    }
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions .rt-reader-footer-download{
      color:#fff!important;border-color:rgba(36,200,180,.48)!important;background:linear-gradient(135deg,#0d988e,#08716c)!important
    }
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions .rt-reader-footer-download:hover{
      background:linear-gradient(135deg,#12a79c,#087a74)!important;border-color:#58d8cc!important;transform:translateY(-1px)!important
    }
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions .rt-reader-footer-download:disabled{opacity:.62!important;cursor:progress!important;transform:none!important}
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions .rt-reader-footer-download svg{width:17px!important;height:17px!important;flex:0 0 auto!important}
    html body.rt-future.rt-future-trial .relacionados{margin:34px 0 12px!important;padding:24px 0 0!important;border-top:1px solid var(--rt-line)!important}
    html body.rt-future.rt-future-trial .rel-grid,
    html body.rt-future.rt-future-trial .rel-item,
    html body.rt-future.rt-future-trial .rel-item a{min-width:0!important}
    html body.rt-future.rt-future-trial .rel-item h3{overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important;hyphens:none!important}
    html body.rt-future.rt-future-trial .rel-item .badge,
    html body.rt-future.rt-future-trial .rel-item .tema{
      display:inline-flex!important;max-width:100%!important;margin:0 6px 6px 0!important;white-space:normal!important;
      overflow-wrap:break-word!important;word-break:normal!important;line-height:1.35!important
    }

    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related]{
      grid-column:1/-1!important;align-self:start!important;min-width:0!important;width:100%!important;max-width:none!important;margin:42px 0 0!important;
      padding:24px 0 0!important;border:0!important;border-top:1px solid var(--rt-line)!important;border-radius:0!important;background:transparent!important;
      box-shadow:none!important;overflow:visible!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related]>h2{
      margin:0 0 18px!important;padding:0!important;color:#eef2ef!important;font:500 22px/1.25 var(--rt-editorial)!important;
      letter-spacing:-.01em!important;text-transform:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-grid{
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 48px!important;width:100%!important;min-width:0!important;
      border:0!important;border-top:1px solid var(--rt-line)!important;background:transparent!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item{
      display:block!important;columns:1!important;column-gap:0!important;min-width:0!important;width:100%!important;max-width:100%!important;margin:0!important;
      padding:24px 0!important;border:0!important;border-bottom:1px solid var(--rt-line)!important;border-radius:0!important;background:transparent!important;
      box-shadow:none!important;overflow:visible!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item a{
      display:block!important;min-width:0!important;width:100%!important;color:inherit!important;text-decoration:none!important;overflow:visible!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item h3,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item .rel-tit{
      margin:11px 0 0!important;color:#dce6e5!important;font:500 24px/1.08 var(--rt-editorial)!important;letter-spacing:-.018em!important;
      overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important;hyphens:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item p,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item .rel-fuente{
      margin:10px 0 0!important;color:#91a6af!important;font:500 10px/1.55 var(--rt-mono)!important;letter-spacing:.035em!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .badge,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .tema{
      display:inline-flex!important;max-width:100%!important;margin:0 5px 5px 0!important;white-space:normal!important;overflow-wrap:break-word!important;
      word-break:normal!important;line-height:1.35!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item:hover h3,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item:hover .rel-tit{color:#72ded3!important}

    html body.rt-future-home .fila-pdf{display:flex!important;align-items:stretch!important;gap:10px!important;flex-wrap:wrap!important;min-width:0!important}
    html body.rt-future-home .fila-pdf .btn-pdf,
    html body.rt-future-home .fila-pdf .rt-download-brief{
      display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;flex:0 1 302px!important;width:302px!important;
      max-width:100%!important;min-width:0!important;min-height:48px!important;margin:0!important;padding:10px 14px!important;border:1px solid rgba(15,95,95,.38)!important;
      border-radius:8px!important;box-sizing:border-box!important;background:rgba(15,95,95,.055)!important;color:var(--rt-teal-deep,var(--teal-hondo))!important;
      font:600 10.5px/1.28 'IBM Plex Mono',monospace!important;letter-spacing:.045em!important;text-transform:uppercase!important;text-align:left!important;
      white-space:normal!important;overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important;cursor:pointer!important;
      transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease!important
    }
    html body.rt-future-home .fila-pdf .rt-download-brief{background:transparent!important;border-color:rgba(28,138,138,.32)!important}
    html body.rt-future-home .fila-pdf .btn-pdf:hover,
    html body.rt-future-home .fila-pdf .rt-download-brief:hover{
      transform:translateY(-1px)!important;border-color:var(--rt-teal,var(--teal))!important;background:rgba(28,138,138,.10)!important;color:var(--rt-ink,var(--tinta))!important
    }
    html body.rt-future-home .fila-pdf .btn-pdf:disabled,
    html body.rt-future-home .fila-pdf .rt-download-brief:disabled{opacity:.56!important;cursor:progress!important;transform:none!important}
    html body.rt-future-home .fila-pdf .btn-pdf svg,
    html body.rt-future-home .fila-pdf .rt-download-brief svg{width:16px!important;height:16px!important;flex:0 0 16px!important}

    @media(max-width:700px){
      html body.rt-future.rt-future-trial .enlace-original{padding:18px!important}
      html body.rt-future.rt-future-trial .pie-nav{grid-template-columns:1fr!important;gap:9px!important;margin-top:12px!important}
      html body.rt-future.rt-future-trial .pie-nav .rt-reader-back,
      html body.rt-future.rt-future-trial .pie-nav .rt-reader-version,
      html body.rt-future.rt-future-trial .rt-reader-bottom-actions .rt-reader-footer-download{
        min-height:54px!important;font-size:13px!important;justify-content:flex-start!important;text-align:left!important
      }
      html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related]{margin-top:32px!important;padding-top:22px!important}
      html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-grid{grid-template-columns:1fr!important;gap:0!important}
      html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item h3,
      html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item .rel-tit{font-size:22px!important}
      html body.rt-future-home .fila-pdf{display:grid!important;grid-template-columns:1fr!important}
      html body.rt-future-home .fila-pdf .btn-pdf,
      html body.rt-future-home .fila-pdf .rt-download-brief{width:100%!important;max-width:none!important;justify-content:center!important;text-align:center!important;min-height:50px!important}
    }
  `;

  function ensureStyle() {
    let style = document.getElementById('rt-reader-ui-v8-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'rt-reader-ui-v8-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
  }

  function ensureCanonicalControls() {
    if (!isCanonical) return;
    const original = $('.enlace-original');
    const nav = $('.pie-nav');
    const source = $('.art-head [data-trial-download]');
    if (!original || !nav || !source) return;
    const id = String(source.getAttribute('data-trial-download') || '').trim();
    if (!id) return;

    let back = nav.querySelector('.rt-reader-back') || nav.querySelector('a');
    if (!back) { back = document.createElement('a'); nav.appendChild(back); }
    back.classList.add('rt-reader-back');
    back.href = window.RTReadingContext?.destination() || '/';
    back.textContent = window.RTReadingContext?.destination() && window.RTReadingContext.destination() !== '/' ? 'Volver al origen' : '← Volver al índice';
    back.setAttribute('aria-label', 'Volver al índice de Resúmenes Trials');

    let version = nav.querySelector('.rt-reader-version,.cambio-version');
    if (!version) { version = document.createElement('a'); nav.appendChild(version); }
    version.classList.add('rt-reader-version');
    version.href = `/resumen.html?id=${encodeURIComponent(id)}&v=corto`;
    version.textContent = 'Ver resumen breve →';
    version.setAttribute('aria-label', 'Abrir el resumen breve de este artículo');

    $('.rt-reader-bottom-actions')?.remove();

    const related = $('.relacionados');
    if (original.nextElementSibling !== nav) original.insertAdjacentElement('afterend', nav);
    if (related && nav.nextElementSibling !== related) nav.insertAdjacentElement('afterend', related);
    nav.dataset.rtReaderUi = 'v8';
  }

  function readerPanel(){
    let panel=$('.rt-sections-panel');if(panel)return panel;
    panel=document.createElement('div');panel.className='rt-sections-panel';panel.hidden=true;panel.innerHTML='<div class="rt-sections-sheet" role="dialog" aria-modal="true" aria-labelledby="rt-sections-title"><header><h2 id="rt-sections-title">Secciones</h2><button type="button" aria-label="Cerrar secciones">Cerrar</button></header><nav></nav></div>';document.body.append(panel);
    const close=()=>{panel.hidden=true};panel.addEventListener('click',e=>{if(e.target===panel||e.target.closest('header button')||e.target.closest('nav a'))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});return panel;
  }
  function syncSectionLinks(panel){const source=$('.rt-reader-rail .rt-rail-nav');const nav=$('nav',panel);if(source&&nav&&!nav.children.length)nav.innerHTML=source.innerHTML}
  function createReaderToolbar(){
    if(!isCanonical&&!isLegacy)return;let bar=$('.rt-reader-toolbar');if(bar)return;
    bar=document.createElement('nav');bar.className='rt-reader-toolbar';bar.setAttribute('aria-label','Controles de lectura');
    const version=$('.cambio-version,.rt-reader-version');const isBrief=document.body.classList.contains('modo-corto')||new URLSearchParams(location.search).get('v')==='corto';
    bar.innerHTML=`<a class="rt-toolbar-version" href="${version?.href||'#'}">${isBrief?'Completo':'Breve'}</a><button type="button" data-sections>Secciones</button><button type="button" data-pdf>Descargar PDF</button><button type="button" data-save>Guardar</button><button type="button" data-reading-mode>Modo lectura</button>`;
    const panel=readerPanel();bar.querySelector('[data-sections]').onclick=()=>{syncSectionLinks(panel);panel.hidden=false;panel.querySelector('a,button')?.focus()};
    bar.querySelector('[data-pdf]').onclick=()=>$('.art-head [data-trial-download],header.art [data-trial-download],#descargar')?.click();
    bar.querySelector('[data-save]').onclick=()=>$('.rt-save-action')?.click();
    const reading=bar.querySelector('[data-reading-mode]');const paintReading=()=>{const active=document.body.classList.contains('rt-modo-lectura');reading.setAttribute('aria-pressed',String(active));reading.textContent=active?'Salir de lectura':'Modo lectura'};reading.onclick=()=>{const legacy=$('.rt-lectura-btn');if(legacy){legacy.click()}else{const next=!document.body.classList.contains('rt-modo-lectura');document.body.classList.toggle('rt-modo-lectura',next);try{localStorage.setItem('rt-modo-lectura',next?'1':'0')}catch{}}paintReading()};paintReading();
    const placeholder=$('.rt-mobile-bar[data-reader-placeholder]');if(placeholder)placeholder.replaceWith(bar);else document.body.append(bar);
  }
  async function readerNeighbors(){
    if(!isCanonical&&!isLegacy)return;const nav=$('.pie-nav');if(!nav||nav.dataset.rtNeighbors)return;nav.dataset.rtNeighbors='1';
    const here=location.pathname;let targets=window.RTReadingContext?.context?.()?.targets||[];
    if(targets.length<2){try{const [manifest,rows]=await Promise.all([fetch('/seo-manifest.json').then(r=>r.json()),import('/trial-data.js').then(m=>m.loadTrials())]);const id=new URLSearchParams(location.search).get('id')||$('[data-trial-download]')?.getAttribute('data-trial-download');const current=rows.find(r=>String(r.id)===String(id))||rows.find(r=>manifest[r.id]?.path===here);const specialty=current?.especialidad_principal;targets=rows.filter(r=>!specialty||r.especialidad_principal===specialty).sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))).map(r=>manifest[r.id]?.path).filter(Boolean)}catch{}}
    const index=Math.max(0,targets.indexOf(here));const previous=targets[index-1],next=targets[index+1];const back=nav.querySelector('.rt-reader-back')||nav.querySelector('a');const version=nav.querySelector('.rt-reader-version,.cambio-version');nav.replaceChildren();
    if(previous){const a=document.createElement('a');a.href=previous;a.textContent='← Anterior';nav.append(a)}
    if(back){back.dataset.readingReturn='true';back.textContent='Volver a la lista';nav.append(back)}
    if(next){const a=document.createElement('a');a.href=next;a.textContent='Siguiente →';nav.append(a)}
    version?.remove();
  }

  function polishBriefRelated() {
    if (!isBrief) return;
    const related = $('.relacionados');
    if (related) related.dataset.rtBriefRelated = 'v8';
  }

  function markHomeDownloads() {
    if (!isHome) return;
    document.querySelectorAll('.fila-pdf').forEach((area) => {
      const full = area.querySelector('.btn-pdf:not(.rt-download-brief)');
      const brief = area.querySelector('.rt-download-brief');
      if (full) full.dataset.rtReaderUi = 'v8';
      if (brief) brief.dataset.rtReaderUi = 'v8';
      if (full && brief && !area.querySelector('.rt-pdf-menu')) {
        const menu=document.createElement('details');menu.className='rt-pdf-menu';
        const summary=document.createElement('summary');summary.textContent='Descargar PDF';summary.setAttribute('aria-label','Elegir versión para descargar PDF');
        const options=document.createElement('div');options.className='rt-pdf-options';options.append(full,brief);menu.append(summary,options);area.append(menu);
      }
    });
  }

  function apply() {
    ensureStyle();
    ensureCanonicalControls();
    createReaderToolbar();
    readerNeighbors();
    polishBriefRelated();
    markHomeDownloads();
  }

  function watch() {
    if (document.documentElement.dataset.rtReaderUiWatchV8 === '1') return;
    document.documentElement.dataset.rtReaderUiWatchV8 = '1';
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; apply(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  const boot = () => {
    apply();
    watch();
    [80,180,420,900,1600,2800].forEach((ms) => setTimeout(apply, ms));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
