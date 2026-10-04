/* Navegación global única para páginas públicas, lector y cuenta. */
(() => {
  'use strict';
  if (window.__rtEditorialShell) return;
  window.__rtEditorialShell = true;
  const path = location.pathname.replace(/\/index\.html$/i, '/') || '/';
  const items = [['Explorar','/'],['Medicina Crítica','/medicina-critica/'],['Medicina Interna','/medicina-interna/'],['Mi biblioteca','/biblioteca.html']];
  const institutional = [['Metodología','/metodologia/'],['Equipo editorial','/equipo-editorial/'],['Privacidad','/privacidad/'],['Términos','/terminos/']];
  const isReader = /^\/trials\//.test(path) || path === '/resumen.html';
  const current = href => path === href || (href.endsWith('/') && href !== '/' && path.startsWith(href));
  const links = rows => rows.map(([label,href]) => `<a href="${href}"${current(href)?' aria-current="page"':''}>${label}</a>`).join('');
  function themeButton(){
    const button=document.createElement('button');button.type='button';button.className='rt-tema-btn';
    const sync=()=>{const light=document.body.classList.contains('rt-tema-claro');button.innerHTML=light?'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>':'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.7 8.7 0 1 0 20.2 15.3Z"/></svg>';button.setAttribute('aria-label',light?'Cambiar a tema oscuro':'Cambiar a tema claro');button.title=button.getAttribute('aria-label')};
    button.addEventListener('click',()=>{const light=document.body.classList.toggle('rt-tema-claro');try{localStorage.setItem('rt-tema',light?'claro':'oscuro')}catch{}sync()});sync();return button;
  }
  function mountHeader(){
    let header=document.querySelector('.topbar');if(!header){header=document.createElement('header');header.className='topbar';document.body.prepend(header)}
    header.className='topbar';
    const inner=document.createElement('div');inner.className='topbar-in';inner.dataset.rtGlobalShell='1';
    inner.innerHTML=`<a class="rt-brand" href="/" aria-label="Resúmenes Trials, inicio"><img src="/logo.png" alt=""><span class="rt-brand-name">Resúmenes Trials</span></a><nav class="rt-main-nav" id="rt-main-navigation" aria-label="Navegación principal">${links(items)}</nav><div class="rt-nav-actions"><a class="auth-entry" id="account-entry" href="/login.html"><span class="auth-entry-main">Cuenta</span></a></div>`;
    const menu=document.createElement('button');menu.type='button';menu.className='ed-menu';menu.textContent='Menú';menu.setAttribute('aria-controls','rt-main-navigation');menu.setAttribute('aria-expanded','false');
    const close=()=>{menu.setAttribute('aria-expanded','false');inner.removeAttribute('data-menu-open')};
    menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));inner.toggleAttribute('data-menu-open',open)});
    inner.addEventListener('keydown',e=>{if(e.key==='Escape'){close();menu.focus()}});document.addEventListener('click',e=>{if(!inner.contains(e.target))close()});
    inner.prepend(menu);inner.querySelector('.rt-nav-actions').prepend(themeButton());header.replaceChildren(inner);
    if(path==='/')inner.querySelector('.rt-main-nav a[href="/"]')?.addEventListener('click',e=>{e.preventDefault();const target=document.querySelector('#biblioteca-clinica,#q');target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});setTimeout(()=>document.querySelector('#q')?.focus({preventScroll:true}),220)});
    import('/auth.js').then(async mod=>{const user=await mod.currentUser().catch(()=>null);const a=inner.querySelector('#account-entry');if(user){a.href='/cuenta.html';a.querySelector('span').textContent='Mi cuenta'}}).catch(()=>{});
  }
  function mountFooter(){if(document.querySelector('footer.rt-global-footer'))return;const footer=document.createElement('footer');footer.className='rt-global-footer';footer.innerHTML=`<nav aria-label="Información">${links(institutional)}<a href="https://t.me/ResumenesTrials" target="_blank" rel="noopener">Telegram</a><a href="https://x.com/resumenestrials" target="_blank" rel="noopener">X</a></nav><p>Resúmenes críticos para profesionales de la salud.</p>`;document.body.append(footer)}
  function mountMobileBar(){if(isReader&&document.querySelector('.rt-reader-toolbar'))return;const bar=document.createElement('nav');bar.className='rt-mobile-bar';bar.setAttribute('aria-label',isReader?'Controles de lectura':'Accesos rápidos');if(isReader){bar.dataset.readerPlaceholder='true'}else bar.innerHTML='<a href="/">Inicio</a><a href="/?focus=search">Buscar</a><button type="button" data-specialties>Especialidades</button><a href="/biblioteca.html">Mi biblioteca</a>';document.body.append(bar);bar.querySelector('[data-specialties]')?.addEventListener('click',()=>{document.querySelector('.ed-menu')?.click();document.querySelector('.rt-main-nav a[href="/medicina-critica/"]')?.focus()})}
  function mountBackTop(){const b=document.createElement('button');b.type='button';b.className='rt-back-top';b.textContent='↑ Volver arriba';b.hidden=true;b.addEventListener('click',()=>scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}));addEventListener('scroll',()=>{b.hidden=scrollY<innerHeight*2},{passive:true});document.body.append(b)}
  function enhanceHub(){
    const cards=[...document.querySelectorAll('.cat-card')];if(!cards.length)return;const grid=cards[0].parentElement;if(!grid||document.querySelector('.rt-hub-tools'))return;
    const years=[...new Set(cards.flatMap(c=>(c.textContent.match(/\b(20\d{2})\b/g)||[])))].sort().reverse();
    const tools=document.createElement('section');tools.className='rt-hub-tools';tools.innerHTML=`<label>Buscar en esta especialidad<input type="search" placeholder="Buscar ensayo o tema" aria-label="Buscar en esta especialidad"></label><select aria-label="Filtrar por año"><option value="">Todos los años</option>${years.map(y=>`<option>${y}</option>`).join('')}</select><span aria-live="polite"></span>`;grid.before(tools);
    const input=tools.querySelector('input'),year=tools.querySelector('select'),status=tools.querySelector('span');let limit=24;
    const apply=()=>{const q=input.value.trim().toLowerCase(),y=year.value;const matches=cards.filter(c=>(!q||c.textContent.toLowerCase().includes(q))&&(!y||c.textContent.includes(y)));cards.forEach(c=>c.hidden=!matches.includes(c)||matches.indexOf(c)>=limit);status.textContent=`${matches.length} resultados`;let more=document.querySelector('.rt-hub-more');if(matches.length>limit){if(!more){more=document.createElement('button');more.type='button';more.className='rt-hub-more';more.textContent='Mostrar más';grid.after(more);more.onclick=()=>{limit+=24;apply()}}}else more?.remove();const p=new URLSearchParams();if(q)p.set('q',input.value.trim());if(y)p.set('anio',y);history.replaceState(null,'',location.pathname+(p.size?`?${p}`:''))};
    const p=new URLSearchParams(location.search);input.value=p.get('q')||'';year.value=p.get('anio')||'';tools.oninput=()=>{limit=24;apply()};tools.onchange=()=>{limit=24;apply()};cards.forEach(card=>{const a=card.querySelector('a[href]');if(a){card.addEventListener('click',e=>{if(!e.target.closest('a,button'))a.click()})}});apply();
  }
  function boot(){document.querySelectorAll('main.page > .top,.evidence-theme').forEach(x=>x.remove());mountHeader();mountFooter();mountMobileBar();mountBackTop();enhanceHub();document.body.dataset.edShell='true'}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
