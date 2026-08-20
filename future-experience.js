(() => {
  'use strict';
  if (window.__rtFutureExperience) return;
  window.__rtFutureExperience = true;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain = (value) => {
    const t = document.createElement('template');
    t.innerHTML = String(value ?? '');
    return (t.content.textContent || '').replace(/\s+/g, ' ').trim();
  };
  const cut = (value, limit = 340) => {
    const text = plain(value);
    if (text.length <= limit) return text;
    const chunk = text.slice(0, limit + 1);
    const split = chunk.lastIndexOf(' ');
    return `${chunk.slice(0, split > limit * .65 ? split : limit).replace(/[ ,.;:]+$/,'')}…`;
  };
  const slug = (value) => plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,70);
  const path = location.pathname.toLowerCase();

  function pageClass() {
    document.body.classList.add('rt-future');
    if (path === '/' || path.endsWith('/index.html') && !path.includes('/trials/') && path.split('/').filter(Boolean).length === 1) document.body.classList.add('rt-future-home');
    if (path.includes('/trials/')) document.body.classList.add('rt-future-trial');
    if (path.endsWith('/resumen.html')) document.body.classList.add('rt-future-legacy');
    if (['/login.html','/registro.html','/recuperar.html','/cuenta.html','/biblioteca.html','/privacidad.html','/agregar.html'].some(p => path.endsWith(p))) document.body.classList.add('rt-future-account');
    if (path === '/medicina-critica/' || path === '/medicina-interna/' || path.endsWith('/medicina-critica/index.html') || path.endsWith('/medicina-interna/index.html')) document.body.classList.add('rt-future-hub');
    if ((path.startsWith('/medicina-critica/') || path.startsWith('/medicina-interna/')) && !document.body.classList.contains('rt-future-hub') && !document.body.classList.contains('rt-future-trial')) document.body.classList.add('rt-future-cluster');
    if (path.startsWith('/metodologia/') || path.startsWith('/equipo-editorial/')) document.body.classList.add('rt-future-institutional');
  }

  function navMarkup() {
    const current = (href) => path === href || (href !== '/' && path.startsWith(href));
    return [
      ['Explorar','/'],['Medicina Crítica','/medicina-critica/'],['Medicina Interna','/medicina-interna/'],['Metodología','/metodologia/'],['Equipo editorial','/equipo-editorial/']
    ].map(([label, href]) => `<a href="${href}"${current(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  }

  function socialLinks() {
    return `<a href="https://t.me/ResumenesTrials" target="_blank" rel="noopener" aria-label="Telegram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4 20-7z"></path></svg></a><a href="https://x.com/resumenestrials" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"></path></svg></a>`;
  }

  function enhanceTopbar() {
    const topbar = $('.topbar');
    const inner = topbar && $('.topbar-in', topbar);
    if (!inner || inner.dataset.rtFuture === '1') return;
    inner.dataset.rtFuture = '1';

    let brand = $('.marca-top,.marca', inner);
    if (!brand) {
      brand = document.createElement('a');
      brand.href = '/';
      brand.className = 'rt-brand';
      brand.innerHTML = '<img src="/logo.png" alt="Resúmenes Trials">';
    }
    brand.classList.add('rt-brand');
    brand.href = '/';
    if (!$('.rt-brand-name', brand)) brand.insertAdjacentHTML('beforeend','<span class="rt-brand-name">Resúmenes Trials</span>');

    let nav = $('nav:not(.top-links)', inner);
    if (!nav) nav = document.createElement('nav');
    nav.className = 'rt-main-nav';
    nav.setAttribute('aria-label','Navegación principal');
    nav.innerHTML = navMarkup();

    let topLinks = $('.top-links', inner);
    if (!topLinks) {
      topLinks = document.createElement('nav');
      topLinks.className = 'top-links';
      topLinks.setAttribute('aria-label','Cuenta y redes');
      topLinks.innerHTML = `<a id="account-entry" class="auth-entry" href="/login.html" aria-label="Entrar o crear una cuenta"><span class="auth-entry-main">Entrar o crear cuenta</span></a>${socialLinks()}`;
    }

    const actions = document.createElement('div');
    actions.className = 'rt-nav-actions';
    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'rt-nav-search';
    search.setAttribute('aria-label','Buscar en Resúmenes Trials');
    search.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><span>Buscar ensayos, fármacos…</span><kbd>/</kbd>';
    search.addEventListener('click', focusSearch);
    actions.append(search, topLinks);
    inner.replaceChildren(brand, nav, actions);

    // En páginas distintas de la portada también reflejamos la sesión si existe.
    if (!document.body.classList.contains('rt-future-home')) {
      import('/auth.js').then(async mod => {
        const user = await mod.currentUser().catch(() => null);
        const entry = $('#account-entry');
        if (user && entry) {
          entry.href = '/cuenta.html';
          const label = entry.querySelector('.auth-entry-main') || entry;
          label.textContent = 'Mi cuenta';
        }
      }).catch(() => {});
    }
  }

  function focusSearch() {
    const input = $('#q,.buscador-input');
    if (input) {
      input.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center'});
      setTimeout(() => input.focus({preventScroll:true}), 220);
      return;
    }
    location.href = '/?focus=search';
  }

  function keyboardSearch() {
    document.addEventListener('keydown', (event) => {
      const tag = event.target?.tagName;
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag || '') || event.target?.isContentEditable;
      if ((event.key === '/' && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        focusSearch();
      }
    });
    if (new URLSearchParams(location.search).get('focus') === 'search') setTimeout(focusSearch, 400);
  }

  function futureOrb() {
    const visual = document.createElement('div');
    visual.className = 'rt-hero-visual';
    visual.setAttribute('aria-hidden','true');
    visual.innerHTML = `<div class="rt-orbit"><div class="rt-orbit-rings"></div><div class="rt-orbit-core"><strong>R<span>T</span></strong></div><div class="rt-orbit-label l1">FILTRAMOS<b>Lo importante</b></div><div class="rt-orbit-label l2">LEEMOS<b>Con profundidad</b></div><div class="rt-orbit-label l3">EXTRAEMOS<b>Lo esencial</b></div></div>`;
    if (matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      visual.addEventListener('pointermove', (event) => {
        const box = visual.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - .5;
        const y = (event.clientY - box.top) / box.height - .5;
        const orb = $('.rt-orbit', visual);
        if (orb) orb.style.transform = `translate3d(${x * 12}px,${y * 12}px,0) rotateX(${y * -3}deg) rotateY(${x * 3}deg)`;
      });
      visual.addEventListener('pointerleave', () => { const orb = $('.rt-orbit', visual); if (orb) orb.style.transform = ''; });
    }
    return visual;
  }

  function enhanceHome() {
    const header = $('header.sitio');
    const wrap = header && $('.envoltorio', header);
    if (!wrap || wrap.dataset.rtFuture === '1') return;
    wrap.dataset.rtFuture = '1';
    const title = $('h1.titulo', wrap), bajada = $('.bajada', wrap), meta = $('.barra-meta', wrap);
    if (!title || !bajada || !meta) return;

    const copy = document.createElement('div');
    copy.className = 'rt-hero-copy';
    copy.innerHTML = '<div class="rt-hero-eyebrow">Evidencia que importa · ensayos clínicos · español</div>';
    copy.append(title, bajada);
    const actions = document.createElement('div');
    actions.className = 'rt-hero-actions';
    actions.innerHTML = '<a class="rt-hero-cta" href="#biblioteca-clinica">Descubre cómo funciona <span>→</span></a><a class="rt-hero-cta secondary" href="/metodologia/">Nuestra metodología</a>';
    copy.append(actions, meta);
    wrap.replaceChildren(copy, futureOrb());

    const main = $('main.envoltorio');
    const controls = main && $('.indice-cabecera', main);
    const state = main && $('#estado', main);
    const index = main && $('#indice', main);
    if (!main || !controls || !index) return;
    const hubs = $('.seo-hubs-home');
    const stage = document.createElement('section');
    stage.className = 'rt-explorer-stage';
    stage.id = 'biblioteca-clinica';
    const intro = document.createElement('div');
    intro.className = 'rt-explorer-head';
    intro.innerHTML = `<div><p class="eyebrow">Biblioteca clínica viva</p><h2>Encuentra la evidencia por la pregunta que quieres resolver.</h2><p>Busca por trial, intervención, fármaco, revista o tema. La arquitectura prioriza lectura, contexto y aplicación clínica sin sacrificar rigor.</p></div><div class="rt-steps"><div class="rt-step"><small>01</small><b>Explora</b><span>Filtra por especialidad, año o revista.</span></div><div class="rt-step"><small>02</small><b>Interpreta</b><span>Abre el trial y recorre objetivo, método, resultados y límites.</span></div><div class="rt-step"><small>03</small><b>Conserva</b><span>Guarda lo importante en tu biblioteca personal.</span></div></div>`;
    stage.append(intro);
    if (hubs) stage.append(hubs);
    stage.append(controls);
    if (state) stage.append(state);
    stage.append(index);
    main.prepend(stage);

    $$('.fila', index).forEach((row, i) => {
      row.style.setProperty('--rt-row-index', String(i + 1));
      if (i === 0) row.classList.add('rt-featured');
    });
    keyboardSearch();
  }

  function sectionText(sections, terms, fallback = '') {
    const match = sections.find(section => terms.some(term => (section.querySelector('h2')?.textContent || '').toLowerCase().includes(term)));
    if (!match) return fallback;
    return cut($$('p,li', match).map(el => el.textContent).join(' '), 360) || fallback;
  }

  function wrapTrialSections(article) {
    if (!article || article.dataset.rtSections === '1') return [];
    article.dataset.rtSections = '1';
    const nodes = [...article.childNodes];
    const frag = document.createDocumentFragment();
    let section = null;
    let index = 0;
    for (const node of nodes) {
      if (node.nodeType === 1 && node.tagName === 'H2') {
        index += 1;
        section = document.createElement('section');
        section.className = 'rt-evidence-section';
        section.dataset.index = String(index).padStart(2,'0');
        const id = node.id || `seccion-${String(index).padStart(2,'0')}-${slug(node.textContent)}`;
        node.id = id;
        section.id = `bloque-${id}`;
        frag.append(section);
      }
      (section || frag).append(node);
    }
    article.replaceChildren(frag);
    return $$('.rt-evidence-section', article);
  }

  async function loadTrialRecord(id) {
    if (!id) return null;
    try {
      const response = await fetch('/resumenes.json',{cache:'no-store'});
      if (!response.ok) return null;
      const rows = await response.json();
      return rows.find(item => String(item.id) === String(id)) || null;
    } catch { return null; }
  }

  function createSummaryDeck(record, sections) {
    const objective = cut(record?.objetivo, 410) || sectionText(sections,['pregunta de investigación','objetivo'],'Consulta el objetivo completo en el análisis detallado.');
    const finding = cut(record?.hallazgo, 410) || sectionText(sections,['resultados','desenlaces'],'Consulta los resultados completos en el análisis detallado.');
    const application = sectionText(sections,['aplicación clínica','interpretación clínica','conclusión'],'La aplicación clínica se interpreta junto con el desenlace primario y las limitaciones del ensayo.');
    const population = sectionText(sections,['población estudiada','pregunta de investigación','población e intervención'],'Revisa los criterios de inclusión y exclusión en el análisis detallado.');
    const deck = document.createElement('section');
    deck.className = 'rt-summary-deck';
    deck.setAttribute('aria-label','Resumen editorial');
    deck.innerHTML = `<h2 class="rt-summary-title">Resumen editorial</h2>${[
      ['Pregunta clínica',objective],['Resultado principal',finding],['Aplicación clínica',application],['Población a la que aplica',population]
    ].map(([label,text]) => `<article class="rt-summary-card"><small>${esc(label)}</small><p>${esc(text)}</p></article>`).join('')}`;
    return deck;
  }

  function createReaderRail(record, sections) {
    const rail = document.createElement('aside');
    rail.className = 'rt-reader-rail';
    rail.setAttribute('aria-label','Herramientas de lectura');
    const nav = sections.map((section, i) => {
      const heading = $('h2', section);
      return `<a href="#${esc(section.id)}" data-section="${i}">${esc(heading?.textContent || `Sección ${i + 1}`)}</a>`;
    }).join('');
    const finding = cut(record?.hallazgo, 270) || 'Lee el resultado primario y su precisión en el análisis detallado.';
    rail.innerHTML = `<section class="rt-rail-card"><h3>Tu progreso</h3><div class="rt-progress-row"><div class="rt-progress-ring"><strong>0%</strong></div><div class="rt-progress-copy">Recorre el análisis completo a tu ritmo.</div></div><div class="rt-progress-line"><span></span></div></section><section class="rt-rail-card"><h3>Hallazgo clave</h3><div class="rt-rail-finding"><strong>RESULTADO PRINCIPAL</strong>${esc(finding)}</div></section><section class="rt-rail-card"><h3>En esta página</h3><nav class="rt-rail-nav">${nav}</nav></section>`;
    return rail;
  }

  function wireReaderProgress(article, sections, rail) {
    const ring = $('.rt-progress-ring', rail), label = $('.rt-progress-ring strong', rail), line = $('.rt-progress-line span', rail), links = $$('.rt-rail-nav a', rail);
    const set = (p) => {
      const value = Math.max(0,Math.min(100,Math.round(p)));
      ring?.style.setProperty('--p',String(value));
      if (label) label.textContent = `${value}%`;
      if (line) line.style.width = `${value}%`;
    };
    const update = () => {
      const rect = article.getBoundingClientRect();
      const start = Math.max(0, -rect.top + 140);
      const total = Math.max(1, article.scrollHeight - innerHeight * .55);
      set(start / total * 100);
    };
    addEventListener('scroll', update, {passive:true}); update();
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries.filter(x => x.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
        if (!visible) return;
        const i = sections.indexOf(visible.target);
        links.forEach((link, j) => link.classList.toggle('is-active', i === j));
      },{rootMargin:'-22% 0px -58% 0px',threshold:[0,.1,.4]});
      sections.forEach(section => observer.observe(section));
    }
  }

  async function addSaveAction(actions, id) {
    if (!actions || !id || $('.rt-save-action', actions)) return;
    const button = document.createElement('button');
    button.type = 'button';button.className = 'rt-save-action';button.innerHTML = '<span aria-hidden="true">☆</span><span>Guardar en biblioteca</span>';button.setAttribute('aria-pressed','false');
    actions.append(button);
    let store = null;
    try {
      store = await import('/library-store.js');
      const state = await store.getLibraryState();
      if (state.signedIn && state.favorites.includes(String(id))) {
        button.setAttribute('aria-pressed','true');button.innerHTML = '<span aria-hidden="true">★</span><span>Guardado</span>';
      }
    } catch {}
    button.addEventListener('click', async () => {
      try {
        store ||= await import('/library-store.js');
        const state = await store.getLibraryState();
        if (!state.signedIn) { location.href = '/login.html'; return; }
        button.disabled = true;
        const added = await store.toggleFavorite(id);
        button.setAttribute('aria-pressed',String(added));button.innerHTML = added ? '<span aria-hidden="true">★</span><span>Guardado</span>' : '<span aria-hidden="true">☆</span><span>Guardar en biblioteca</span>';
      } catch (error) {
        console.warn('Biblioteca:',error?.message || error);
      } finally { button.disabled = false; }
    });
  }

  async function enhanceTrial() {
    const article = $('article.articulo');
    const head = $('.art-head');
    if (!article || !head || article.dataset.rtFuture === '1') return;
    article.dataset.rtFuture = '1';
    const id = $('[data-trial-download]', head)?.getAttribute('data-trial-download') || '';
    const sections = wrapTrialSections(article);
    const record = await loadTrialRecord(id);
    const deck = createSummaryDeck(record, sections);
    head.insertAdjacentElement('afterend',deck);
    const rail = createReaderRail(record, sections);
    deck.insertAdjacentElement('afterend',rail);
    wireReaderProgress(article, sections, rail);
    await addSaveAction($('.trial-actions', head), id);
    keyboardSearch();
  }

  function enhanceCategory() {
    $$('.cat-card').forEach((card,i) => card.style.setProperty('--rt-card-index',String(i + 1)));
    keyboardSearch();
  }

  function addAmbientInteraction() {
    if (!matchMedia('(pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const glow = document.createElement('div');
    glow.className = 'rt-pointer-glow';
    glow.setAttribute('aria-hidden','true');
    document.body.append(glow);
    let raf = 0, x = innerWidth/2, y = innerHeight/2;
    addEventListener('pointermove', event => {
      x = event.clientX;y = event.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => { glow.style.transform = `translate3d(${x}px,${y}px,0)`; raf = 0; });
    },{passive:true});
  }

  async function init() {
    pageClass();
    enhanceTopbar();
    if (document.body.classList.contains('rt-future-home')) enhanceHome();
    if (document.body.classList.contains('rt-future-trial')) await enhanceTrial();
    if (document.body.classList.contains('rt-future-hub') || document.body.classList.contains('rt-future-cluster')) enhanceCategory();
    if (!document.body.classList.contains('rt-future-account')) addAmbientInteraction();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => requestAnimationFrame(init),{once:true});
  else requestAnimationFrame(init);
})();
