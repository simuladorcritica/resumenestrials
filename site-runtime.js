/* GENERATED FILE. Run: node scripts/build-site-runtime.mjs */
/* source: future-experience.js */
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
    if (['/metodologia/','/equipo-editorial/','/privacidad/','/terminos/'].some(p => path.startsWith(p))) document.body.classList.add('rt-future-institutional');
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

/* source: global-search.js */
(() => {
  'use strict';
  if (window.__rtGlobalSearch) return;
  window.__rtGlobalSearch = true;

  const state = {
    rows: null,
    manifest: null,
    loading: null,
    panel: null,
    active: -1,
    owner: null
  };

  const normalize = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function resultPath(row) {
    return state.manifest?.[String(row.id)]?.path || `/resumen.html?id=${encodeURIComponent(row.id)}`;
  }

  function ensurePanel() {
    if (state.panel?.isConnected) return state.panel;
    const panel = document.createElement('section');
    panel.id = 'rt-global-search-results';
    panel.className = 'rt-global-search-results';
    panel.setAttribute('aria-label', 'Resultados de búsqueda');
    panel.hidden = true;
    panel.innerHTML = '<div class="rt-global-search-status">Escribe para buscar en todos los resúmenes.</div>';
    document.body.append(panel);
    state.panel = panel;
    return panel;
  }

  async function loadIndex() {
    if (state.rows && state.manifest) return;
    if (state.loading) return state.loading;
    state.loading = Promise.all([
      fetch('/resumenes.json', { cache: 'force-cache' }),
      fetch('/seo-manifest.json', { cache: 'force-cache' })
    ]).then(async ([dataResponse, manifestResponse]) => {
      if (!dataResponse.ok) throw new Error(`resumenes.json HTTP ${dataResponse.status}`);
      if (!manifestResponse.ok) throw new Error(`seo-manifest.json HTTP ${manifestResponse.status}`);
      const [data, manifest] = await Promise.all([dataResponse.json(), manifestResponse.json()]);
      state.manifest = manifest;
      state.rows = data.map((row) => {
        const topics = Array.isArray(row.temas) ? row.temas.join(' ') : '';
        const haystack = normalize([
          row.titulo, row.autor, row.revista, row.anio, row.registro, row.doi,
          row.especialidad_principal, row.especialidad_secundaria, topics,
          row.tipo_estudio, row.objetivo, row.hallazgo
        ].join(' '));
        return { row, haystack, title: normalize(row.titulo), topics: normalize(topics), journal: normalize(row.revista) };
      });
    }).finally(() => {
      state.loading = null;
    });
    return state.loading;
  }

  function score(entry, tokens, query) {
    if (!tokens.every((token) => entry.haystack.includes(token))) return -1;
    let value = 0;
    if (entry.title === query) value += 120;
    if (entry.title.startsWith(query)) value += 75;
    if (entry.title.includes(query)) value += 45;
    if (entry.journal.includes(query)) value += 20;
    if (entry.topics.includes(query)) value += 18;
    for (const token of tokens) {
      if (entry.title.startsWith(token)) value += 18;
      else if (entry.title.includes(token)) value += 11;
      if (entry.topics.includes(token)) value += 5;
      if (entry.journal.includes(token)) value += 4;
    }
    value += Math.max(0, Number(entry.row.anio || 0) - 2020) * 0.2;
    return value;
  }

  function setActive(index) {
    const options = [...state.panel?.querySelectorAll('[role="option"]') || []];
    if (!options.length) {
      state.active = -1;
      return;
    }
    state.active = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, i) => option.setAttribute('aria-selected', i === state.active ? 'true' : 'false'));
    options[state.active]?.scrollIntoView({ block: 'nearest' });
  }

  function positionPanel(owner = state.owner) {
    const panel = ensurePanel();
    if (!owner || panel.hidden) return;
    const rect = owner.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(680, Math.max(480, rect.width * 1.8), window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.min(window.innerHeight - 120, rect.bottom + 9)}px`;
  }

  function openPanel(owner) {
    const panel = ensurePanel();
    state.owner = owner || state.owner;
    panel.hidden = false;
    positionPanel(state.owner);
  }

  function closePanel() {
    if (state.panel) state.panel.hidden = true;
    state.active = -1;
  }

  async function render(input) {
    const panel = ensurePanel();
    openPanel(input.closest('.rt-global-search-form'));
    const raw = input.value.trim();
    const query = normalize(raw);
    state.active = -1;

    if (!query) {
      panel.innerHTML = '<div class="rt-global-search-status"><strong>Buscar en Resúmenes Trials</strong><span>Escribe un trial, fármaco, intervención, revista, DOI o tema clínico.</span></div>';
      return;
    }

    panel.innerHTML = '<div class="rt-global-search-status">Buscando…</div>';
    try {
      await loadIndex();
      if (normalize(input.value) !== query) return;
      const tokens = query.split(' ').filter(Boolean);
      const matches = state.rows
        .map((entry) => ({ entry, score: score(entry, tokens, query) }))
        .filter((item) => item.score >= 0)
        .sort((a, b) => b.score - a.score || String(b.entry.row.fecha || '').localeCompare(String(a.entry.row.fecha || '')))
        .slice(0, 8);

      if (!matches.length) {
        panel.innerHTML = `<div class="rt-global-search-status"><strong>Sin resultados para “${esc(raw)}”</strong><span>Prueba con el nombre del trial, un fármaco, una revista o un tema más amplio.</span></div>`;
        return;
      }

      panel.innerHTML = `<div class="rt-global-search-meta">${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'} principales</div><div class="rt-global-search-list" role="listbox">${matches.map(({ entry }, index) => {
        const row = entry.row;
        const topics = Array.isArray(row.temas) ? row.temas.slice(0, 2).join(' · ') : '';
        const meta = [row.revista, row.anio, topics].filter(Boolean).join(' · ');
        return `<a class="rt-global-search-result" role="option" aria-selected="${index === 0 ? 'true' : 'false'}" href="${esc(resultPath(row))}" data-search-index="${index}"><span class="rt-global-search-result-title">${esc(row.titulo)}</span><span class="rt-global-search-result-meta">${esc(meta)}</span></a>`;
      }).join('')}</div><div class="rt-global-search-help">↑ ↓ para navegar · Enter para abrir · Esc para cerrar</div>`;
      state.active = 0;
    } catch (error) {
      console.error('Buscador global:', error);
      panel.innerHTML = '<div class="rt-global-search-status"><strong>No fue posible cargar la búsqueda.</strong><span>Intenta de nuevo en unos segundos.</span></div>';
    }
  }

  function install(button) {
    if (!button || button.dataset.rtGlobalSearch === '1') return;
    const form = document.createElement('form');
    form.className = `${button.className} rt-global-search-form`;
    form.dataset.rtGlobalSearch = '1';
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', 'Buscar en Resúmenes Trials');
    form.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input class="rt-global-search-input" type="search" autocomplete="off" spellcheck="false" aria-label="Buscar ensayos, fármacos, revistas o temas" aria-controls="rt-global-search-results" aria-autocomplete="list" placeholder="Buscar ensayos, fármacos…"><kbd>/</kbd>';
    button.replaceWith(form);

    const input = form.querySelector('.rt-global-search-input');
    input.addEventListener('focus', () => render(input));
    input.addEventListener('input', () => render(input));
    input.addEventListener('keydown', (event) => {
      const options = [...ensurePanel().querySelectorAll('[role="option"]')];
      if (event.key === 'ArrowDown' && options.length) {
        event.preventDefault();
        setActive(state.active < 0 ? 0 : state.active + 1);
      } else if (event.key === 'ArrowUp' && options.length) {
        event.preventDefault();
        setActive(state.active <= 0 ? 0 : state.active - 1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
        input.blur();
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const options = [...ensurePanel().querySelectorAll('[role="option"]')];
      const target = options[state.active >= 0 ? state.active : 0];
      if (target) location.href = target.href;
      else render(input);
    });
  }

  function installAll() {
    document.querySelectorAll('button.rt-nav-search').forEach(install);
  }

  document.addEventListener('keydown', (event) => {
    const tag = event.target?.tagName;
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag || '') || event.target?.isContentEditable;
    const shortcut = (event.key === '/' && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k');
    if (!shortcut) return;
    const input = document.querySelector('.rt-global-search-input');
    if (!input) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    input.focus({ preventScroll: true });
    render(input);
  }, true);

  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.rt-global-search-form,.rt-global-search-results')) return;
    closePanel();
  });

  window.addEventListener('resize', () => positionPanel());
  window.addEventListener('scroll', () => positionPanel(), { passive: true });

  const observer = new MutationObserver(() => installAll());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAll, { once: true });
  } else {
    installAll();
  }
})();

/* source: future-experience-final.js */
(() => {
  'use strict';
  if (window.__rtFutureFinal) return;
  window.__rtFutureFinal = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const POLISH_CSS = `
    /* Resúmenes Trials · correcciones UX/legibilidad 2026-08 */
    body.rt-future-home header.sitio .envoltorio{
      max-width:1380px!important;margin-left:auto!important;margin-right:auto!important;
      grid-template-columns:minmax(0,.96fr) minmax(400px,.84fr)!important;
      gap:clamp(48px,5vw,82px)!important;padding-left:clamp(38px,5vw,74px)!important;padding-right:clamp(38px,5vw,74px)!important;
    }
    body.rt-future-home .rt-hero-copy{max-width:690px!important;justify-self:end!important;width:100%!important}
    body.rt-future-home .rt-hero-visual{justify-self:start!important;width:100%!important;max-width:590px!important}
    body.rt-future-home .rt-hero-eyebrow{font-size:11.5px!important;line-height:1.35!important;letter-spacing:.13em!important}
    body.rt-future-home .bajada-cols{font-size:17px!important;line-height:1.68!important;max-width:64ch!important}
    body.rt-future-home .rt-hero-cta{font-size:14px!important;min-height:46px!important;padding:13px 18px!important}
    body.rt-future-home .meta-eti{font-size:10.5px!important;line-height:1.3!important;letter-spacing:.1em!important}
    body.rt-future-home .rt-orbit-label{font-size:10.5px!important;letter-spacing:.12em!important}
    body.rt-future-home .rt-orbit-label b{font-size:13px!important;line-height:1.3!important}

    body.rt-future .rt-main-nav a,body.rt-future .topbar nav a{font-size:13.5px!important;line-height:1.15!important}
    body.rt-future .top-links .auth-entry-main{font-size:12.5px!important}
    body.rt-future:not(.rt-future-home) .rt-main-nav a[href^="/metodologia"],
    body.rt-future:not(.rt-future-home) .rt-main-nav a[href^="/equipo-editorial"]{display:none!important}

    body.rt-future-home .seo-hubs-home,
    body.rt-future-home .rt-editorial-prelude{display:none!important}
    body.rt-future-home .rt-explorer-head{grid-template-columns:minmax(0,1fr) minmax(390px,.72fr)!important;gap:clamp(34px,4vw,58px)!important}
    body.rt-future-home .rt-explorer-head p{font-size:17px!important;line-height:1.65!important}
    body.rt-future-home .rt-step{padding:20px!important;min-height:112px!important}
    body.rt-future-home .rt-step small,body.rt-future-home .rt-prelude-number,body.rt-future-home .rt-prelude-steps li::before{display:none!important;content:none!important}
    body.rt-future-home .rt-step b{font-size:17px!important;margin:0 0 7px!important}
    body.rt-future-home .rt-step span{font-size:15px!important;line-height:1.52!important}
    body.rt-future-home .filtro{font-size:11.5px!important;letter-spacing:.07em!important}
    body.rt-future-home .filtro .n{font-size:11px!important}
    body.rt-future-home .rt-advanced select{font-size:12.5px!important}
    body.rt-future-home .buscador-input{font-size:13px!important}
    body.rt-future-home .conteo-busqueda{font-size:11.5px!important;line-height:1.4!important}
    body.rt-future-home .fila a.cabeza::before{display:none!important;content:none!important}
    body.rt-future-home .fila a.cabeza{grid-template-columns:minmax(0,1fr) auto!important}
    body.rt-future-home .fila-cuerpo .fuente{font-size:11.5px!important;line-height:1.55!important}
    body.rt-future-home .badge{font-size:10.5px!important;line-height:1.45!important}
    body.rt-future-home .btn-pdf{font-size:11.5px!important;line-height:1.25!important;min-height:38px!important;padding:9px 13px!important}
    body.rt-future-home .fila.rt-featured::before{font-size:10px!important}

    body.rt-future-trial .migas{font-size:11.5px!important;line-height:1.45!important}
    body.rt-future-trial .art-head::before{font-size:10.5px!important;line-height:1.3!important}
    body.rt-future-trial .badge,body.rt-future-trial .tema{font-size:10.5px!important;line-height:1.35!important}
    body.rt-future-trial .fuente,body.rt-future-trial .publicacion{font-size:11.5px!important;line-height:1.6!important}
    body.rt-future-trial .trial-action,body.rt-future-trial .rt-save-action{font-size:11.5px!important;line-height:1.25!important;min-height:46px!important}
    body.rt-future-trial .rt-summary-deck{display:none!important}
    body.rt-future-trial .rt-evidence-section::before{display:none!important;content:none!important}
    body.rt-future-trial .articulo{grid-row:3!important}
    body.rt-future-trial .rt-reader-rail{grid-row:3 / span 10!important}
    body.rt-future-trial .rt-evidence-section{
      margin:0!important;padding:30px 0 32px!important;border:0!important;border-top:1px solid var(--rt-line)!important;
      border-radius:0!important;background:transparent!important;box-shadow:none!important;
    }
    body.rt-future-trial .rt-evidence-section:first-child{border-top:0!important;padding-top:0!important}
    body.rt-future-trial .rt-evidence-section h2{font-size:24px!important;line-height:1.25!important;margin-bottom:18px!important}
    body.rt-future-trial .rt-evidence-section p,body.rt-future-trial article.articulo p{
      max-width:78ch!important;font-size:17.5px!important;line-height:1.78!important;
      text-align:justify!important;text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important;
    }
    body.rt-future-trial .rt-evidence-section strong,body.rt-future-trial article.articulo strong{
      background:none!important;text-decoration-line:underline!important;text-decoration-color:rgba(226,162,58,.58)!important;
      text-decoration-thickness:1.5px!important;text-underline-offset:.18em!important;text-decoration-skip-ink:auto!important;
    }
    body.rt-future-trial .rt-rail-card h3{font-size:10.5px!important;line-height:1.4!important}
    body.rt-future-trial .rt-progress-copy{font-size:14px!important;line-height:1.5!important}
    body.rt-future-trial .rt-rail-nav a{font-size:13.5px!important;line-height:1.45!important;padding-top:9px!important;padding-bottom:9px!important}
    body.rt-future-trial .rt-rail-source{font-size:11px!important}

    body.rt-future-hub .migas,body.rt-future-cluster .migas,body.rt-future-institutional .migas{font-size:11.5px!important;line-height:1.45!important}
    body.rt-future-hub .eyebrow,body.rt-future-cluster .eyebrow,body.rt-future-institutional .eyebrow{font-size:11.5px!important;line-height:1.4!important}
    body.rt-future-hub .cluster-card p,body.rt-future-cluster .cluster-card p,
    body.rt-future-hub .cat-card p,body.rt-future-cluster .cat-card p{font-size:15.5px!important;line-height:1.58!important}
    body.rt-future-hub .cluster-card span,body.rt-future-cluster .cluster-card span,
    body.rt-future-hub .cat-meta,body.rt-future-cluster .cat-meta{font-size:11.5px!important;line-height:1.45!important}
    body.rt-future-hub .cat-card::before,body.rt-future-cluster .cat-card::before{display:none!important;content:none!important}

    @media(max-width:980px){
      body.rt-future-home header.sitio .envoltorio{grid-template-columns:1fr!important;max-width:820px!important;padding-left:34px!important;padding-right:34px!important}
      body.rt-future-home .rt-hero-copy{justify-self:center!important;max-width:720px!important}
      body.rt-future-home .rt-hero-visual{justify-self:center!important;max-width:520px!important}
      body.rt-future-home .rt-explorer-head{grid-template-columns:1fr!important}
      body.rt-future-trial .articulo,body.rt-future-trial .rt-reader-rail{grid-row:auto!important}
      body.rt-future-trial .rt-reader-rail{margin-top:24px!important}
    }
    @media(max-width:700px){
      body.rt-future-home header.sitio .envoltorio{padding-left:20px!important;padding-right:20px!important}
      body.rt-future-home .bajada-cols{font-size:16px!important}
      body.rt-future-home .rt-steps{grid-template-columns:1fr!important}
      body.rt-future-trial .rt-evidence-section{padding:24px 0!important}
      body.rt-future-trial .rt-evidence-section:first-child{padding-top:0!important}
      body.rt-future-trial .rt-evidence-section p,body.rt-future-trial article.articulo p{font-size:17px!important;text-align:left!important;hyphens:none!important}
    }
  `;

  const ensurePolishStyle = () => {
    let style = document.getElementById('rt-final-polish-v3');
    if (!style) {
      style = document.createElement('style');
      style.id = 'rt-final-polish-v3';
      style.textContent = POLISH_CSS;
    }
    if (style.parentNode) style.parentNode.removeChild(style);
    document.head.appendChild(style);
  };

  const ensureAccountEntry = async () => {
    const topLinks = $('.topbar .top-links');
    if (!topLinks) return;
    topLinks.setAttribute('aria-label', 'Cuenta y redes');
    let entry = topLinks.querySelector('#account-entry, .auth-entry');
    if (!entry) {
      entry = document.createElement('a');
      entry.id = 'account-entry';
      entry.className = 'auth-entry';
      entry.href = '/login.html';
      entry.setAttribute('aria-label', 'Entrar o crear una cuenta');
      entry.innerHTML = '<span class="auth-entry-main">Entrar o crear cuenta</span>';
      topLinks.prepend(entry);
    }
    try {
      const mod = await import('/auth.js');
      const user = await mod.currentUser().catch(() => null);
      const label = entry.querySelector('.auth-entry-main') || entry;
      if (user) {
        entry.href = '/cuenta.html';
        entry.setAttribute('aria-label', 'Abrir mi cuenta');
        if (label.textContent !== 'Mi cuenta') label.textContent = 'Mi cuenta';
      } else {
        entry.href = '/login.html';
        entry.setAttribute('aria-label', 'Entrar o crear una cuenta');
        if (label.textContent !== 'Entrar o crear cuenta') label.textContent = 'Entrar o crear cuenta';
      }
    } catch {
      // La navegación permanece utilizable aunque no pueda consultarse la sesión.
    }
  };

  const ensureFeaturedTrial = () => {
    if (!document.body.classList.contains('rt-future-home')) return;
    const index = $('#indice');
    if (!index) return;
    const rows = $$('.fila', index);
    rows.forEach((row, position) => {
      row.style.setProperty('--rt-row-index', String(position + 1));
      row.classList.toggle('rt-featured', position === 0);
    });
  };

  const cleanHome = () => {
    if (!document.body.classList.contains('rt-future-home')) return;
    $$('.seo-hubs-home,.rt-editorial-prelude').forEach((node) => node.remove());
    $$('.rt-step small,.rt-prelude-number').forEach((node) => node.remove());
    const actions = $('.rt-hero-actions');
    if (actions) {
      const methodology = actions.querySelector('a[href*="/metodologia"]');
      if (methodology) methodology.remove();
      const primary = actions.querySelector('a[href="#biblioteca-clinica"]');
      if (primary) {
        const targetText = 'Explora la biblioteca →';
        if (primary.textContent !== targetText) primary.textContent = targetText;
        primary.setAttribute('aria-label', 'Explorar la biblioteca clínica');
      }
    }
  };

  const cleanTrial = () => {
    if (!document.body.classList.contains('rt-future-trial')) return;
    $$('.rt-summary-deck').forEach((node) => node.remove());
    $$('.rt-evidence-section[data-index]').forEach((section) => section.removeAttribute('data-index'));
    $$('.rt-reader-rail .rt-rail-card').forEach((card) => {
      const title = (card.querySelector('h3')?.textContent || '').trim().toLowerCase();
      if (title === 'hallazgo clave') card.remove();
    });
    const article = $('article.articulo');
    const rail = $('.rt-reader-rail');
    if (article && rail && article.nextElementSibling !== rail) article.insertAdjacentElement('afterend', rail);
  };

  const wireExplorerLinks = () => {
    if (document.documentElement.dataset.rtExplorerWired === '1') return;
    document.documentElement.dataset.rtExplorerWired = '1';
    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('rt-future-home')) return;
      const link = event.target.closest('.rt-hero-cta[href="#biblioteca-clinica"],.rt-main-nav a[href="/"]');
      if (!link) return;
      const stage = $('#biblioteca-clinica') || $('#indice') || $('.indice-cabecera');
      if (!stage) return;
      event.preventDefault();
      stage.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }, true);
  };

  const normalizePage = () => {
    ensurePolishStyle();
    cleanHome();
    cleanTrial();
    ensureFeaturedTrial();
  };

  const watchDynamicUi = () => {
    if (document.documentElement.dataset.rtFinalWatch === '1') return;
    document.documentElement.dataset.rtFinalWatch = '1';
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        normalizePage();
      });
    };
    new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  };

  const boot = () => {
    ensurePolishStyle();
    ensureAccountEntry();
    wireExplorerLinks();
    normalizePage();
    watchDynamicUi();
    [250, 700, 1400].forEach((delay) => setTimeout(() => {
      ensureAccountEntry();
      normalizePage();
    }, delay));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* source: future-experience-fix-v4.js */
(() => {
  'use strict';
  if (window.__rtFutureFixV4) return;
  window.__rtFutureFixV4 = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const path = location.pathname.toLowerCase();
  const isLegacy = /\/resumen\.html$/.test(path);

  const CSS = `
    /* Resúmenes Trials · unificación de lectura y tipografía v4 */
    body.rt-future{font-size:18px!important}

    /* Navegación: sin colisiones aun con texto grande */
    body.rt-future .topbar-in{
      max-width:1600px!important;width:100%!important;
      grid-template-columns:minmax(220px,auto) minmax(360px,1fr) minmax(500px,auto)!important;
      gap:18px 28px!important;padding:12px clamp(22px,3.6vw,58px)!important;
    }
    body.rt-future .rt-brand-name{font-size:15px!important;line-height:1.2!important;letter-spacing:.13em!important}
    body.rt-future .rt-main-nav{min-width:0!important;gap:5px!important;flex-wrap:nowrap!important}
    body.rt-future .rt-main-nav a,body.rt-future .topbar nav a{
      font-size:16px!important;line-height:1.25!important;padding:10px 11px!important
    }
    body.rt-future .rt-nav-actions{
      min-width:0!important;display:grid!important;grid-template-columns:minmax(250px,330px) auto!important;
      gap:10px!important;align-items:center!important
    }
    body.rt-future .rt-nav-search{min-width:0!important;max-width:none!important;width:100%!important;font-size:15px!important;line-height:1.3!important}
    body.rt-future .rt-nav-search kbd{font-size:11px!important}
    body.rt-future .top-links .auth-entry-main{font-size:15px!important;line-height:1.25!important}
    body.rt-future .rt-nav-account,body.rt-future .top-links .auth-entry{min-height:44px!important;padding:10px 14px!important}

    /* Portada y controles: se elimina microtipografía */
    body.rt-future-home .rt-hero-eyebrow{font-size:14px!important;line-height:1.45!important;letter-spacing:.11em!important}
    body.rt-future-home .bajada-cols{font-size:20px!important;line-height:1.72!important;max-width:62ch!important}
    body.rt-future-home .rt-hero-cta{font-size:16px!important;line-height:1.3!important;min-height:50px!important;padding:14px 19px!important}
    body.rt-future-home .meta-num{font-size:29px!important}
    body.rt-future-home .meta-eti{font-size:13px!important;line-height:1.35!important;letter-spacing:.09em!important}
    body.rt-future-home .rt-orbit-label{font-size:13px!important;line-height:1.3!important;letter-spacing:.10em!important}
    body.rt-future-home .rt-orbit-label b{font-size:16px!important;line-height:1.35!important}
    body.rt-future-home .rt-explorer-head p{font-size:20px!important;line-height:1.7!important}
    body.rt-future-home .rt-step b{font-size:20px!important;line-height:1.3!important}
    body.rt-future-home .rt-step span{font-size:18px!important;line-height:1.55!important}
    body.rt-future-home .filtro{font-size:15px!important;line-height:1.35!important;letter-spacing:.05em!important}
    body.rt-future-home .filtro .n{font-size:14px!important}
    body.rt-future-home .rt-advanced select{font-size:16px!important;line-height:1.4!important}
    body.rt-future-home .buscador-input{font-size:17px!important;line-height:1.4!important}
    body.rt-future-home .conteo-busqueda{font-size:14px!important;line-height:1.5!important}
    body.rt-future-home .fila-cuerpo .fuente{font-size:15px!important;line-height:1.6!important}
    body.rt-future-home .badge{font-size:13px!important;line-height:1.45!important}
    body.rt-future-home .btn-pdf{font-size:15px!important;line-height:1.3!important;min-height:44px!important;padding:10px 14px!important}

    /* Trial canónico: escala cómoda y proporcional */
    body.rt-future-trial .migas{font-size:15px!important;line-height:1.55!important}
    body.rt-future-trial .art-head::before{font-size:14px!important;line-height:1.4!important}
    body.rt-future-trial .badge,body.rt-future-trial .tema{font-size:14px!important;line-height:1.4!important;padding:6px 10px!important}
    body.rt-future-trial .fuente,body.rt-future-trial .publicacion{font-size:16px!important;line-height:1.65!important}
    body.rt-future-trial .trial-action,body.rt-future-trial .rt-save-action{font-size:16px!important;line-height:1.3!important;min-height:52px!important;padding:12px 17px!important}
    body.rt-future-trial .rt-evidence-section h2{font-size:31px!important;line-height:1.22!important;margin-bottom:19px!important}
    body.rt-future-trial .rt-evidence-section p,body.rt-future-trial article.articulo p,
    body.rt-future-trial .rt-evidence-section li,body.rt-future-trial article.articulo li{
      max-width:78ch!important;font-size:21px!important;line-height:1.82!important;
      text-align:justify!important;text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important
    }
    body.rt-future-trial .rt-rail-card h3{font-size:14px!important;line-height:1.45!important}
    body.rt-future-trial .rt-progress-copy{font-size:17px!important;line-height:1.55!important}
    body.rt-future-trial .rt-rail-nav a{font-size:16px!important;line-height:1.5!important;padding-top:10px!important;padding-bottom:10px!important}
    body.rt-future-trial .rt-rail-source{font-size:14px!important;line-height:1.5!important}

    /* Hubs y colecciones */
    body.rt-future-hub .migas,body.rt-future-cluster .migas,body.rt-future-institutional .migas{font-size:15px!important;line-height:1.5!important}
    body.rt-future-hub .eyebrow,body.rt-future-cluster .eyebrow,body.rt-future-institutional .eyebrow{font-size:15px!important;line-height:1.45!important}
    body.rt-future-hub .cluster-card p,body.rt-future-cluster .cluster-card p,
    body.rt-future-hub .cat-card p,body.rt-future-cluster .cat-card p{font-size:18px!important;line-height:1.62!important}
    body.rt-future-hub .cluster-card span,body.rt-future-cluster .cluster-card span,
    body.rt-future-hub .cat-meta,body.rt-future-cluster .cat-meta{font-size:14px!important;line-height:1.5!important}

    /* Resumen legacy: misma arquitectura visual que el trial canónico */
    body.rt-future-legacy,body.rt-future-legacy.modo-corto{font-size:21px!important;line-height:1.82!important}
    body.rt-future-legacy > .envoltorio:first-of-type{display:none!important}
    body.rt-future-legacy .envoltorio,body.rt-future-legacy.modo-corto .envoltorio{
      max-width:1540px!important;width:100%!important;padding-left:clamp(22px,4.2vw,68px)!important;padding-right:clamp(22px,4.2vw,68px)!important
    }
    body.rt-future-legacy .topbar-in,body.rt-future-legacy.modo-corto .topbar-in{max-width:1600px!important}
    body.rt-future-legacy #contenido>.envoltorio{
      display:grid!important;grid-template-columns:minmax(0,1fr) 310px!important;column-gap:34px!important;align-items:start!important
    }
    body.rt-future-legacy header.art,body.rt-future-legacy.modo-corto header.art{
      grid-column:1/-1!important;position:relative!important;display:grid!important;
      grid-template-columns:minmax(0,1.12fr) minmax(300px,.58fr)!important;gap:16px 52px!important;
      padding:42px 0 40px!important;margin:0 0 30px!important;border-bottom:1px solid var(--rt-line)!important;isolation:isolate!important
    }
    body.rt-future-legacy header.art::before{
      content:"ENSAYO CLÍNICO ALEATORIZADO"!important;position:relative!important;top:auto!important;left:auto!important;
      grid-column:1!important;color:#76d8cf!important;font:600 14px/1.4 var(--rt-mono)!important;letter-spacing:.13em!important
    }
    body.rt-future-legacy header.art::after{
      content:""!important;position:absolute!important;right:4%!important;top:12%!important;width:260px!important;height:260px!important;
      border-radius:50%!important;border:1px solid rgba(36,200,180,.12)!important;
      background:radial-gradient(circle,rgba(36,200,180,.10),rgba(36,200,180,.035) 40%,transparent 68%)!important;
      box-shadow:inset 0 0 0 32px rgba(36,200,180,.025),inset 0 0 0 72px rgba(36,200,180,.02)!important;z-index:-1!important
    }
    body.rt-future-legacy header.art h1{
      grid-column:1!important;color:var(--rt-ivory)!important;font:500 clamp(58px,5.6vw,88px)/.99 var(--rt-editorial)!important;
      letter-spacing:-.045em!important;max-width:15ch!important;text-wrap:balance!important;margin:0!important
    }
    body.rt-future-legacy .fuente-linea,body.rt-future-legacy.modo-corto .fuente-linea{
      grid-column:1!important;grid-row:auto!important;max-width:none!important;padding:0!important;border:0!important;
      font-size:16px!important;line-height:1.65!important;letter-spacing:.02em!important;color:#a8bac2!important;margin:4px 0 0!important
    }
    body.rt-future-legacy .etiquetas{grid-column:1!important;margin:4px 0 6px!important}
    body.rt-future-legacy .badge{font-size:14px!important;line-height:1.4!important;padding:6px 10px!important}
    body.rt-future-legacy .acciones-art{grid-column:1!important;margin-top:12px!important;gap:12px!important}
    body.rt-future-legacy .btn-pdf{font-size:16px!important;line-height:1.3!important;min-height:52px!important;padding:12px 17px!important}
    body.rt-future-legacy .version-nav{grid-column:1!important;font-size:15px!important;line-height:1.5!important}
    body.rt-future-legacy .version-etiqueta{font-size:14px!important}
    body.rt-future-legacy article,body.rt-future-legacy article.corto,body.rt-future-legacy.modo-corto article{
      grid-column:1!important;columns:1!important;max-width:none!important;width:100%!important;margin:0!important;padding:0 0 30px!important;color:#ccd8dc!important
    }
    body.rt-future-legacy article h2,body.rt-future-legacy article.corto h2{
      margin:0!important;padding:30px 0 16px!important;border-top:1px solid var(--rt-line)!important;
      color:#58d7cb!important;font:500 31px/1.22 var(--rt-editorial)!important;letter-spacing:-.015em!important;text-transform:none!important
    }
    body.rt-future-legacy article h2:first-child,body.rt-future-legacy article.corto h2:first-child{border-top:0!important;padding-top:0!important}
    body.rt-future-legacy article p,body.rt-future-legacy article.corto p,
    body.rt-future-legacy article li,body.rt-future-legacy article.corto li{
      max-width:78ch!important;margin:0 0 20px!important;color:#cbd7db!important;font-size:21px!important;line-height:1.82!important;
      text-align:justify!important;text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important
    }
    body.rt-future-legacy article strong,body.rt-future-legacy article.corto strong{
      color:#f6f2e9!important;background:none!important;text-decoration-line:underline!important;
      text-decoration-color:rgba(226,162,58,.58)!important;text-decoration-thickness:1.5px!important;text-underline-offset:.18em!important;text-decoration-skip-ink:auto!important
    }
    body.rt-future-legacy .rt-reader-rail{grid-column:2!important;grid-row:auto/span 20!important;position:sticky!important;top:110px!important;align-self:start!important;margin:0!important}
    body.rt-future-legacy .rt-rail-card{padding:20px!important;border-radius:14px!important}
    body.rt-future-legacy .rt-rail-card h3{font-size:14px!important;line-height:1.45!important}
    body.rt-future-legacy .rt-progress-copy{font-size:17px!important;line-height:1.55!important}
    body.rt-future-legacy .rt-rail-nav a{font-size:16px!important;line-height:1.5!important;padding:10px 12px!important}
    body.rt-future-legacy .enlace-original,body.rt-future-legacy .relacionados,body.rt-future-legacy .pie-nav,body.rt-future-legacy footer.art{
      grid-column:1!important;max-width:none!important;width:100%!important
    }
    body.rt-future-legacy .enlace-original{font-size:17px!important;line-height:1.65!important}
    body.rt-future-legacy .relacionados h2{font-size:20px!important}
    body.rt-future-legacy .rel-item .rel-fuente,body.rt-future-legacy .volver,body.rt-future-legacy footer.art{font-size:15px!important;line-height:1.55!important}

    @media(max-width:1500px){
      body.rt-future .topbar-in{
        grid-template-columns:auto minmax(0,1fr)!important;
        grid-template-areas:"brand actions" "nav nav"!important
      }
      body.rt-future .rt-brand{grid-area:brand!important}
      body.rt-future .rt-main-nav{grid-area:nav!important;justify-content:flex-start!important;border-top:1px solid var(--rt-line)!important;padding-top:6px!important}
      body.rt-future .rt-nav-actions{grid-area:actions!important;justify-self:end!important;max-width:620px!important;width:100%!important}
    }
    @media(max-width:980px){
      body.rt-future .topbar-in{grid-template-columns:1fr!important;grid-template-areas:"brand" "nav" "actions"!important;gap:8px!important}
      body.rt-future .rt-brand{justify-self:start!important}
      body.rt-future .rt-main-nav{width:100%!important;overflow-x:auto!important;justify-content:flex-start!important;scrollbar-width:thin!important}
      body.rt-future .rt-nav-actions{justify-self:stretch!important;max-width:none!important;grid-template-columns:minmax(0,1fr) auto!important}
      body.rt-future-legacy #contenido>.envoltorio{grid-template-columns:1fr!important}
      body.rt-future-legacy .rt-reader-rail{grid-column:1!important;grid-row:auto!important;position:relative!important;top:auto!important;margin:12px 0 30px!important}
      body.rt-future-legacy header.art,body.rt-future-legacy.modo-corto header.art{grid-template-columns:1fr!important}
      body.rt-future-legacy header.art::after{width:200px!important;height:200px!important;opacity:.65!important}
    }
    @media(max-width:700px){
      body.rt-future{font-size:17px!important}
      body.rt-future .rt-brand-name{font-size:13px!important}
      body.rt-future .rt-main-nav a{font-size:15px!important}
      body.rt-future .rt-nav-search{font-size:14px!important}
      body.rt-future .top-links .auth-entry-main{font-size:14px!important}
      body.rt-future-home .bajada-cols{font-size:18px!important}
      body.rt-future-home .rt-explorer-head p{font-size:18px!important}
      body.rt-future-trial .rt-evidence-section h2,body.rt-future-legacy article h2,body.rt-future-legacy article.corto h2{font-size:28px!important}
      body.rt-future-trial .rt-evidence-section p,body.rt-future-trial article.articulo p,
      body.rt-future-legacy article p,body.rt-future-legacy article.corto p{font-size:19px!important;text-align:left!important;hyphens:none!important}
      body.rt-future-legacy header.art h1{font-size:clamp(46px,13vw,66px)!important;max-width:none!important}
    }
  `;

  function ensureStyle() {
    let style = document.getElementById('rt-unified-reader-v4');
    if (!style) {
      style = document.createElement('style');
      style.id = 'rt-unified-reader-v4';
      style.textContent = CSS;
    }
    if (style.parentNode) style.parentNode.removeChild(style);
    document.head.appendChild(style);
  }

  function makeRail(article) {
    if (!isLegacy || !article) return;
    const wrap = article.parentElement;
    if (!wrap || wrap.querySelector('.rt-reader-rail[data-v4="1"]')) return;
    const headings = $$('h2', article);
    if (!headings.length) return;
    headings.forEach((h, i) => {
      if (!h.id) h.id = `legacy-section-${i + 1}`;
    });
    const rail = document.createElement('aside');
    rail.className = 'rt-reader-rail';
    rail.dataset.v4 = '1';
    rail.setAttribute('aria-label', 'Herramientas de lectura');
    rail.innerHTML = `
      <section class="rt-rail-card">
        <h3>Tu progreso</h3>
        <div class="rt-progress-row"><div class="rt-progress-ring"><span class="rt-progress-value">0%</span></div><div class="rt-progress-copy">Recorre el análisis a tu ritmo.</div></div>
        <div class="rt-progress-track"><span></span></div>
      </section>
      <section class="rt-rail-card">
        <h3>En esta página</h3>
        <nav class="rt-rail-nav">${headings.map(h => `<a href="#${h.id}">${h.textContent.trim()}</a>`).join('')}</nav>
      </section>`;
    article.insertAdjacentElement('afterend', rail);

    const value = $('.rt-progress-value', rail);
    const track = $('.rt-progress-track span', rail);
    const links = $$('.rt-rail-nav a', rail);
    const sync = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      const pct = Math.max(0, Math.min(100, Math.round(scrollY / max * 100)));
      if (value) value.textContent = `${pct}%`;
      if (track) track.style.width = `${pct}%`;
      let current = headings[0];
      for (const h of headings) if (h.getBoundingClientRect().top <= 155) current = h;
      links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${current?.id}`));
    };
    addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync, { passive: true });
    sync();
  }

  function normalizeLegacy() {
    if (!isLegacy) return;
    const article = $('#contenido article');
    if (!article) return;
    article.classList.add('articulo');
    makeRail(article);
  }

  function boot() {
    ensureStyle();
    normalizeLegacy();
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        ensureStyle();
        normalizeLegacy();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    [150, 450, 900, 1800].forEach(ms => setTimeout(() => {
      ensureStyle();
      normalizeLegacy();
    }, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* source: future-experience-fix-v4-compat.js */
(() => {
  'use strict';
  if (window.__rtReaderPolishV5) return;
  window.__rtReaderPolishV5 = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const path = location.pathname.toLowerCase();
  const isLegacy = /\/resumen\.html$/.test(path);
  const isCanonical = path.includes('/trials/');

  const loadV4Compat = () => new Promise((resolve) => {
    if (window.__rtFutureFixV4Compat) { resolve(); return; }
    let script = document.querySelector('script[data-rt-v4-compat-base="1"]');
    if (script) {
      if (script.dataset.loaded === '1') resolve();
      else {
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', resolve, { once: true });
      }
      return;
    }
    script = document.createElement('script');
    script.src = '/future-experience-fix-v4-compat-base.js?v=1';
    script.defer = true;
    script.dataset.rtV4CompatBase = '1';
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
    script.addEventListener('error', resolve, { once: true });
    document.head.appendChild(script);
  });

  const CSS = `
    /* Lector v5 · navegación inferior, biblioteca y progreso */
    html body.rt-future.rt-future-trial .pie-nav,
    html body.rt-future.rt-future-legacy .pie-nav{
      max-width:none!important;width:100%!important;margin:34px 0 0!important;padding:28px 0 18px!important;
      border-top:1px solid var(--rt-line)!important;border-bottom:0!important;
      display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:space-between!important;
      gap:18px 28px!important;background:transparent!important
    }
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-back,
    html body.rt-future.rt-future-legacy .pie-nav .rt-reader-back{
      display:inline-flex!important;align-items:center!important;min-height:44px!important;padding:0!important;
      color:#72ded3!important;text-decoration:none!important;font:500 16px/1.4 var(--rt-mono)!important;
      letter-spacing:.10em!important;text-transform:uppercase!important;white-space:nowrap!important
    }
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-back:hover,
    html body.rt-future.rt-future-legacy .pie-nav .rt-reader-back:hover{color:#a0f1e9!important}
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-version,
    html body.rt-future.rt-future-legacy .pie-nav .rt-reader-version{
      display:inline-flex!important;align-items:center!important;min-height:44px!important;padding:0!important;
      color:#72ded3!important;text-decoration:none!important;font:500 20px/1.35 var(--rt-font)!important;
      letter-spacing:0!important;text-transform:none!important;white-space:nowrap!important
    }
    html body.rt-future.rt-future-trial .pie-nav .rt-reader-version:hover,
    html body.rt-future.rt-future-legacy .pie-nav .rt-reader-version:hover{color:#a0f1e9!important}

    /* Resumen completo: reproduce la composición inferior del resumen breve. */
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions{
      grid-column:1!important;max-width:none!important;width:100%!important;margin:0!important;padding:8px 0 24px!important;
      border-bottom:1px solid var(--rt-line)!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;
      gap:12px!important;background:transparent!important
    }
    html body.rt-future.rt-future-trial .rt-reader-footer-download{
      display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;
      min-height:52px!important;width:auto!important;padding:12px 17px!important;border-radius:9px!important;
      border:1px solid rgba(36,200,180,.38)!important;background:linear-gradient(135deg,#0d988e,#08716c)!important;
      color:#fff!important;font:600 16px/1.3 var(--rt-mono)!important;letter-spacing:.01em!important;text-transform:none!important;
      cursor:pointer!important;box-shadow:none!important
    }
    html body.rt-future.rt-future-trial .rt-reader-footer-download:hover{
      background:#0d988e!important;border-color:#55d5c9!important;transform:translateY(-1px)!important
    }
    html body.rt-future.rt-future-trial .rt-reader-footer-download:disabled{opacity:.62!important;cursor:progress!important;transform:none!important}
    html body.rt-future.rt-future-trial .rt-reader-footer-download svg{width:17px!important;height:17px!important;flex:0 0 auto!important}
    html body.rt-future.rt-future-trial .art-footer{
      border-top:0!important;margin-top:0!important;padding-top:26px!important
    }

    html body.rt-future.rt-future-legacy.modo-corto header.art .rt-save-action{
      display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;
      min-height:52px!important;width:auto!important;padding:12px 17px!important;border:1px solid rgba(139,184,194,.38)!important;
      border-radius:9px!important;background:rgba(255,255,255,.018)!important;color:#dce8e8!important;
      font:600 16px/1.3 var(--rt-mono)!important;letter-spacing:.02em!important;cursor:pointer!important
    }
    html body.rt-future.rt-future-legacy.modo-corto header.art .rt-save-action:hover{
      border-color:#55d5c9!important;color:#8ce8df!important;background:rgba(36,200,180,.055)!important
    }
    html body.rt-future.rt-future-legacy.modo-corto header.art .rt-save-action[aria-pressed="true"]{
      border-color:rgba(36,200,180,.58)!important;color:#8ce8df!important;background:rgba(36,200,180,.08)!important
    }
    html body.rt-future.rt-future-legacy.modo-corto header.art .rt-save-action:disabled{opacity:.62!important;cursor:progress!important}

    html body.rt-future.rt-future-legacy .rt-progress-ring .rt-progress-value{
      position:relative!important;z-index:1!important;color:#fff!important;font:600 12px/1 var(--rt-font)!important;
      font-variant-numeric:tabular-nums!important
    }
    html body.rt-future.rt-future-legacy .rt-progress-ring{
      transition:background .16s linear!important
    }
    html body.rt-future.rt-future-legacy .rt-progress-track{
      height:4px!important;margin-top:14px!important;border-radius:999px!important;background:rgba(255,255,255,.07)!important;
      overflow:hidden!important
    }
    html body.rt-future.rt-future-legacy .rt-progress-track>span{
      display:block!important;height:100%!important;width:0;border-radius:inherit!important;
      background:linear-gradient(90deg,var(--rt-teal-2),var(--rt-teal))!important;transition:width .16s linear!important
    }
    html body.rt-future.rt-future-legacy article h2{scroll-margin-top:150px!important}
    html body.rt-future.rt-future-legacy .rt-rail-nav a.active,
    html body.rt-future.rt-future-legacy .rt-rail-nav a.is-active{color:#50d0c2!important}
    html body.rt-future.rt-future-legacy .rt-rail-nav a.active::before,
    html body.rt-future.rt-future-legacy .rt-rail-nav a.is-active::before{
      background:var(--rt-teal)!important;box-shadow:0 0 12px rgba(36,200,180,.3)!important
    }

    @media(max-width:700px){
      html body.rt-future.rt-future-trial .pie-nav,
      html body.rt-future.rt-future-legacy .pie-nav{align-items:flex-start!important;padding:22px 0 14px!important;gap:8px 18px!important}
      html body.rt-future.rt-future-trial .pie-nav .rt-reader-back,
      html body.rt-future.rt-future-legacy .pie-nav .rt-reader-back{font-size:14px!important}
      html body.rt-future.rt-future-trial .pie-nav .rt-reader-version,
      html body.rt-future.rt-future-legacy .pie-nav .rt-reader-version{font-size:17px!important}
      html body.rt-future.rt-future-trial .rt-reader-bottom-actions{padding:7px 0 22px!important}
      html body.rt-future.rt-future-trial .rt-reader-footer-download{width:100%!important;min-height:54px!important}
      html body.rt-future.rt-future-legacy.modo-corto header.art .rt-save-action{width:100%!important;min-height:54px!important}
    }
  `;

  function ensureStyle() {
    let style = document.getElementById('rt-reader-polish-v5');
    if (!style) {
      style = document.createElement('style');
      style.id = 'rt-reader-polish-v5';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
  }

  function currentId() {
    if (isLegacy) return new URLSearchParams(location.search).get('id') || '';
    return $('[data-trial-download]')?.getAttribute('data-trial-download') || '';
  }

  function polishFooter() {
    if (!isLegacy && !isCanonical) return;
    const nav = $('.pie-nav');
    if (!nav) return;
    const back = nav.querySelector('a[href="/"],a[href="index.html"],a[href="/index.html"]') || nav.querySelector('a');
    if (back) {
      back.classList.add('rt-reader-back');
      back.textContent = '← Volver al índice';
      back.href = '/';
    }
    let version = nav.querySelector('.cambio-version,.rt-reader-version');
    if (!version && isCanonical) {
      const brief = $('.art-head .trial-action-brief');
      if (brief) {
        version = document.createElement('a');
        version.href = brief.getAttribute('href') || brief.href;
        version.textContent = 'Ver resumen breve →';
        nav.appendChild(version);
      }
    }
    if (version) version.classList.add('rt-reader-version');
    nav.dataset.rtReaderNav = 'v5';
  }

  function ensureCanonicalFooterDownload() {
    if (!isCanonical) return;
    const nav = $('.pie-nav');
    const source = $('.art-head [data-trial-download]');
    if (!nav || !source) return;

    let actions = nav.nextElementSibling;
    if (!actions || !actions.classList.contains('rt-reader-bottom-actions')) {
      actions = document.createElement('div');
      actions.className = 'rt-reader-bottom-actions';
      actions.setAttribute('aria-label', 'Descarga del resumen completo');
      nav.insertAdjacentElement('afterend', actions);
    }
    if (actions.querySelector('.rt-reader-footer-download')) return;

    const trialId = source.getAttribute('data-trial-download') || '';
    const button = source.cloneNode(true);
    button.className = 'rt-reader-footer-download';
    button.removeAttribute('id');
    button.removeAttribute('style');
    button.removeAttribute('data-trial-download');
    button.setAttribute('data-rt-footer-download', trialId);
    button.disabled = false;
    button.classList.remove('is-loading');
    button.setAttribute('aria-label', 'Descargar resumen completo PDF');
    const label = button.querySelector('span:last-child');
    if (label) label.textContent = 'Descargar resumen completo PDF';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      if (!source.disabled) source.click();
    });
    actions.appendChild(button);
    actions.dataset.rtReaderBottomActions = 'v6';
  }

  async function addBriefSaveAction() {
    if (!isLegacy || !document.body.classList.contains('modo-corto')) return;
    const actions = $('header.art .acciones-art');
    const id = currentId();
    if (!actions || !id || actions.querySelector('.rt-save-action')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rt-save-action';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Guardar este resumen en mi biblioteca');
    button.innerHTML = '<span aria-hidden="true">☆</span><span>Guardar en biblioteca</span>';
    actions.appendChild(button);

    let store = null;
    const render = (saved) => {
      button.setAttribute('aria-pressed', String(Boolean(saved)));
      button.setAttribute('aria-label', saved ? 'Quitar este resumen de mi biblioteca' : 'Guardar este resumen en mi biblioteca');
      button.innerHTML = saved ? '<span aria-hidden="true">★</span><span>Guardado</span>' : '<span aria-hidden="true">☆</span><span>Guardar en biblioteca</span>';
    };

    try {
      store = await import('/library-store.js');
      const state = await store.getLibraryState();
      render(state.signedIn && state.favorites.includes(String(id)));
    } catch {
      render(false);
    }

    button.addEventListener('click', async () => {
      try {
        store ||= await import('/library-store.js');
        const state = await store.getLibraryState();
        if (!state.signedIn) {
          location.href = '/login.html';
          return;
        }
        button.disabled = true;
        render(await store.toggleFavorite(id));
      } catch (error) {
        console.warn('Biblioteca:', error?.message || error);
      } finally {
        button.disabled = false;
      }
    });
  }

  function wireLegacyProgress() {
    if (!isLegacy || !document.body.classList.contains('modo-corto')) return;
    const article = $('#contenido article.corto') || $('#contenido article');
    const rail = $('.rt-reader-rail[data-v4="1"]') || $('.rt-reader-rail');
    if (!article || !rail || rail.dataset.rtProgressV5 === '1') return;
    const ring = $('.rt-progress-ring', rail);
    const value = $('.rt-progress-value', rail) || $('.rt-progress-ring strong', rail);
    const track = $('.rt-progress-track span', rail) || $('.rt-progress-line span', rail);
    const headings = $$('h2', article);
    const links = $$('.rt-rail-nav a', rail);
    if (!ring || !value) return;
    rail.dataset.rtProgressV5 = '1';

    let raf = 0;
    const sync = () => {
      raf = 0;
      const top = article.getBoundingClientRect().top + scrollY;
      const start = Math.max(0, top - Math.min(160, innerHeight * .18));
      const end = Math.max(start + 1, top + article.offsetHeight - innerHeight * .42);
      const pct = Math.max(0, Math.min(100, Math.round((scrollY - start) / (end - start) * 100)));
      ring.style.setProperty('--p', String(pct));
      value.textContent = `${pct}%`;
      if (track) track.style.width = `${pct}%`;

      if (headings.length && links.length) {
        let current = headings[0];
        for (const heading of headings) if (heading.getBoundingClientRect().top <= 180) current = heading;
        links.forEach((link) => {
          const active = link.getAttribute('href') === `#${current?.id}`;
          link.classList.toggle('active', active);
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    };
    const requestSync = () => {
      if (raf) return;
      raf = requestAnimationFrame(sync);
    };
    addEventListener('scroll', requestSync, { passive: true });
    addEventListener('resize', requestSync, { passive: true });
    requestSync();
  }

  function apply() {
    ensureStyle();
    polishFooter();
    ensureCanonicalFooterDownload();
    addBriefSaveAction();
    wireLegacyProgress();
  }

  function watch() {
    if (document.documentElement.dataset.rtReaderPolishWatch === '1') return;
    document.documentElement.dataset.rtReaderPolishWatch = '1';
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        apply();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const boot = async () => {
    await loadV4Compat();
    apply();
    watch();
    [120, 350, 800, 1500].forEach((ms) => setTimeout(apply, ms));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* source: legacy-unifier-v4.js */
(() => {
  'use strict';
  if (!/\/resumen\.html$/i.test(location.pathname) || window.__rtLegacyUnifierV4) return;
  window.__rtLegacyUnifierV4 = true;

  const style = document.createElement('style');
  style.id = 'rt-legacy-unifier-v4';
  style.textContent = `
    body.rt-future-legacy.rt-legacy-normalized .migas{
      display:flex!important;align-items:center!important;gap:10px!important;flex-wrap:wrap!important;
      margin:26px 0 0!important;padding:12px 0!important;border-bottom:1px solid var(--rt-line)!important;
      font:500 15px/1.5 var(--rt-mono)!important;letter-spacing:.045em!important;color:#879ca7!important
    }
    body.rt-future-legacy.rt-legacy-normalized .migas::before{
      content:"RUTA"!important;color:var(--rt-amber)!important;font-size:13px!important;letter-spacing:.14em!important;margin-right:5px!important
    }
    body.rt-future-legacy.rt-legacy-normalized .migas a{color:#a8bbc4!important;text-decoration:none!important;font-size:15px!important}
    body.rt-future-legacy.rt-legacy-normalized .migas a.volver-top{
      display:inline-flex!important;align-items:center!important;gap:6px!important;width:auto!important;height:auto!important;
      padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;transform:none!important;
      color:#a8bbc4!important;font:500 15px/1.5 var(--rt-mono)!important;letter-spacing:.045em!important;text-transform:none!important
    }
    body.rt-future-legacy.rt-legacy-normalized .migas a.volver-top:hover{background:transparent!important;color:#71dacf!important;transform:none!important}
    body.rt-future-legacy.rt-legacy-normalized .migas span:last-child{color:#71dacf!important}

    body.rt-future-legacy.rt-legacy-normalized header.art,
    body.rt-future-legacy.rt-legacy-normalized.modo-corto header.art{
      grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr)!important;
      grid-template-rows:auto auto auto auto auto auto!important;
      gap:12px 60px!important;padding:56px 0 44px!important;border-bottom:1px solid var(--rt-line)!important
    }
    body.rt-future-legacy.rt-legacy-normalized header.art::before{display:none!important;content:none!important}
    body.rt-future-legacy.rt-legacy-normalized .rt-legacy-eyebrow{
      grid-column:1!important;grid-row:1!important;margin:0 0 3px!important;
      color:#79d8cf!important;font:600 14px/1.45 var(--rt-mono)!important;letter-spacing:.13em!important;text-transform:uppercase!important
    }
    body.rt-future-legacy.rt-legacy-normalized header.art .etiquetas{
      grid-column:1!important;grid-row:2!important;display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:0 0 8px!important;position:relative!important;inset:auto!important
    }
    body.rt-future-legacy.rt-legacy-normalized header.art .badge{
      display:inline-flex!important;align-items:center!important;min-height:34px!important;padding:5px 11px!important;
      border-radius:999px!important;font-size:14px!important;line-height:1.35!important;letter-spacing:.055em!important
    }
    body.rt-future-legacy.rt-legacy-normalized header.art h1{
      grid-column:1!important;grid-row:3!important;font-size:clamp(48px,6.8vw,92px)!important;line-height:.93!important;
      max-width:17ch!important;letter-spacing:-.048em!important;margin:0!important
    }
    body.rt-future-legacy.rt-legacy-normalized .fuente-linea{
      grid-column:1!important;grid-row:4!important;align-self:auto!important;padding:0!important;border:0!important;
      margin:5px 0 0!important;font-size:16px!important;line-height:1.65!important;color:#a9bbc4!important
    }
    body.rt-future-legacy.rt-legacy-normalized .rt-legacy-publication{
      grid-column:1!important;grid-row:5!important;margin:0!important;color:#8fa5af!important;
      font:500 16px/1.65 var(--rt-mono)!important;letter-spacing:.025em!important
    }
    body.rt-future-legacy.rt-legacy-normalized .acciones-art{
      grid-column:1!important;grid-row:6!important;display:flex!important;align-items:stretch!important;gap:12px!important;flex-wrap:wrap!important;margin:14px 0 0!important
    }
    body.rt-future-legacy.rt-legacy-normalized .acciones-art .btn-pdf{
      display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;
      min-height:52px!important;width:auto!important;padding:12px 17px!important;border-radius:9px!important;
      background:linear-gradient(135deg,#0d988e,#08716c)!important;border:1px solid rgba(36,200,180,.38)!important;
      color:#fff!important;font-size:16px!important;line-height:1.3!important
    }
    body.rt-future-legacy.rt-legacy-normalized .acciones-art .rt-legacy-version{
      display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:52px!important;padding:12px 17px!important;
      border:1px solid rgba(139,184,194,.34)!important;border-radius:9px!important;background:rgba(255,255,255,.015)!important;
      color:#dfe9e8!important;text-decoration:none!important;font:600 16px/1.3 var(--rt-mono)!important;letter-spacing:.025em!important
    }
    body.rt-future-legacy.rt-legacy-normalized .acciones-art .rt-legacy-version:hover{border-color:#55d5c9!important;color:#7fe4da!important}
    body.rt-future-legacy.rt-legacy-normalized .version-nav{display:none!important}

    @media(max-width:1040px){
      body.rt-future-legacy.rt-legacy-normalized header.art,
      body.rt-future-legacy.rt-legacy-normalized.modo-corto header.art{grid-template-columns:1fr!important;gap:11px!important}
    }
    @media(max-width:700px){
      body.rt-future-legacy.rt-legacy-normalized .migas{font-size:13px!important;margin-top:18px!important}
      body.rt-future-legacy.rt-legacy-normalized .migas a,
      body.rt-future-legacy.rt-legacy-normalized .migas a.volver-top{font-size:13px!important}
      body.rt-future-legacy.rt-legacy-normalized .migas::before{font-size:12px!important}
      body.rt-future-legacy.rt-legacy-normalized header.art,
      body.rt-future-legacy.rt-legacy-normalized.modo-corto header.art{padding:44px 0 34px!important}
      body.rt-future-legacy.rt-legacy-normalized .rt-legacy-eyebrow{font-size:14px!important}
      body.rt-future-legacy.rt-legacy-normalized header.art .badge{font-size:13px!important;min-height:32px!important}
      body.rt-future-legacy.rt-legacy-normalized header.art h1{font-size:clamp(48px,13vw,68px)!important;max-width:none!important}
      body.rt-future-legacy.rt-legacy-normalized .fuente-linea,
      body.rt-future-legacy.rt-legacy-normalized .rt-legacy-publication{font-size:14px!important;line-height:1.65!important}
      body.rt-future-legacy.rt-legacy-normalized .acciones-art{display:grid!important;grid-template-columns:1fr!important}
      body.rt-future-legacy.rt-legacy-normalized .acciones-art .btn-pdf,
      body.rt-future-legacy.rt-legacy-normalized .acciones-art .rt-legacy-version{width:100%!important;min-height:54px!important}
    }
  `;
  document.head.appendChild(style);

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const isBrief = params.get('v') === 'corto';
  let recordPromise = null;

  const record = () => {
    if (!recordPromise) {
      recordPromise = fetch('/resumenes.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : [])
        .then(rows => Array.isArray(rows) ? rows.find(x => String(x.id) === String(id)) || null : null)
        .catch(() => null);
    }
    return recordPromise;
  };

  const formatDate = value => {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
  };

  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };

  async function normalize() {
    const header = document.querySelector('#contenido header.art');
    const article = document.querySelector('#contenido article');
    if (!header || !article || header.dataset.rtLegacyUnified === '1') return;
    const row = await record();
    if (!row || !document.contains(header)) return;
    header.dataset.rtLegacyUnified = '1';
    document.body.classList.add('rt-legacy-normalized');

    const wrap = header.parentElement;
    if (wrap) {
      let crumbs = wrap.querySelector(':scope > .migas');
      if (!crumbs) {
        crumbs = make('nav', 'migas');
        wrap.insertBefore(crumbs, header);
      }
      crumbs.setAttribute('aria-label', 'Ruta');
      crumbs.replaceChildren();
      const home = make('a', 'volver-top', '← Volver al índice'); home.href = '/'; crumbs.append(home, make('span','', '›'));
      if (row.especialidad_principal) {
        const href = row.especialidad_principal.toLowerCase().includes('crítica') ? '/medicina-critica/' : '/medicina-interna/';
        const area = make('a','',row.especialidad_principal); area.href = href; crumbs.append(area, make('span','', '›'));
      }
      const last = make('span','',isBrief ? 'Resumen breve' : 'Resumen completo'); crumbs.append(last);
    }

    let eyebrow = header.querySelector('.rt-legacy-eyebrow');
    if (!eyebrow) {
      eyebrow = make('div','rt-legacy-eyebrow','Ensayo clínico aleatorizado');
      header.insertBefore(eyebrow, header.firstChild);
    }

    let tags = header.querySelector('.etiquetas');
    if (!tags) {
      tags = make('div','etiquetas');
      eyebrow.insertAdjacentElement('afterend', tags);
    }
    const clinical = globalThis.SpecialtyClassification?.classify(row)?.specialty;
    const review = globalThis.SpecialtyClassification?.REVIEW;
    const values = [
      row.especialidad_principal,
      clinical && clinical !== review ? clinical : '',
      ...(Array.isArray(row.temas) ? row.temas : [])
    ].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).slice(0,4);
    tags.replaceChildren(...values.map(value => make('span','badge',value)));

    let source = header.querySelector('.fuente-linea');
    if (!source) {
      source = make('div','fuente-linea');
      header.appendChild(source);
    }
    source.textContent = [row.autor, row.revista, row.registro, row.doi].filter(Boolean).join(' · ');

    let publication = header.querySelector('.rt-legacy-publication');
    if (!publication) {
      publication = make('div','rt-legacy-publication');
      source.insertAdjacentElement('afterend', publication);
    }
    publication.textContent = row.fecha ? `Artículo original publicado: ${formatDate(row.fecha)}` : '';

    const actions = header.querySelector('.acciones-art');
    const version = header.querySelector('.version-nav .cambio-version');
    if (actions && version && !actions.querySelector('.rt-legacy-version')) {
      const versionButton = version.cloneNode(true);
      versionButton.classList.add('rt-legacy-version');
      versionButton.textContent = isBrief ? 'Ver versión completa →' : 'Ver resumen breve →';
      actions.appendChild(versionButton);
    }
  }

  function boot() {
    normalize();
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; normalize(); });
    });
    observer.observe(document.body, { childList:true, subtree:true });
    [120,350,800,1500].forEach(ms => setTimeout(normalize, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();

/* source: reader-endmatter-v7.js */
(() => {
  'use strict';
  if (window.__rtEndmatterV7) return;
  window.__rtEndmatterV7 = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const path = location.pathname.toLowerCase();
  const isCanonical = path.includes('/trials/');
  const isLegacy = /\/resumen\.html$/.test(path);

  const CSS = `
    /* End matter v7 · fuente primaria → navegación/descarga → evidencia relacionada */
    html body.rt-future.rt-future-trial .confianza,
    html body.rt-future.rt-future-legacy .confianza{display:none!important}

    html body.rt-future.rt-future-trial .enlace-original{
      margin-bottom:0!important
    }
    html body.rt-future.rt-future-trial .pie-nav{
      margin:0!important;padding:22px 0 8px!important;border-top:0!important
    }
    html body.rt-future.rt-future-trial .rt-reader-bottom-actions{
      margin:0!important;padding:4px 0 24px!important;border-bottom:1px solid var(--rt-line)!important
    }
    html body.rt-future.rt-future-trial .relacionados{
      margin-top:36px!important;padding-top:26px!important
    }

    html body.rt-future.rt-future-legacy.modo-corto .relacionados{
      max-width:800px!important;width:100%!important;min-width:0!important;margin:38px auto 0!important;padding:28px 0 0!important;
      border-top:1px solid var(--rt-line)!important;overflow:hidden!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados>h2{
      margin:0 0 18px!important;color:#eef2ef!important;font:500 22px/1.25 var(--rt-editorial)!important;
      letter-spacing:-.01em!important;text-transform:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-grid{
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;border:0!important;
      width:100%!important;max-width:100%!important;min-width:0!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item{
      display:block!important;columns:1!important;column-gap:0!important;width:100%!important;max-width:100%!important;min-width:0!important;
      margin:0!important;padding:18px!important;border:1px solid var(--rt-line)!important;overflow:hidden!important;
      border-radius:11px!important;background:linear-gradient(180deg,rgba(12,39,57,.68),rgba(7,26,40,.58))!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item a{
      display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;color:inherit!important;text-decoration:none!important;
      overflow-wrap:anywhere!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item .badge,
    html body.rt-future.rt-future-legacy.modo-corto .rel-item .tema{
      display:inline-flex!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important;
      margin:0 6px 6px 0!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item h3,
    html body.rt-future.rt-future-legacy.modo-corto .rel-item .rel-tit{
      max-width:100%!important;margin:10px 0 0!important;color:#dce6e5!important;font:500 20px/1.16 var(--rt-editorial)!important;
      letter-spacing:-.015em!important;overflow-wrap:anywhere!important;word-break:normal!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item p,
    html body.rt-future.rt-future-legacy.modo-corto .rel-item .rel-fuente{
      max-width:100%!important;margin:10px 0 0!important;color:#91a6af!important;font:500 11px/1.5 var(--rt-mono)!important;
      letter-spacing:.025em!important;overflow-wrap:anywhere!important;word-break:normal!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item:hover{
      border-color:rgba(36,200,180,.38)!important;background:linear-gradient(180deg,rgba(13,48,66,.78),rgba(8,34,49,.68))!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item:hover h3,
    html body.rt-future.rt-future-legacy.modo-corto .rel-item:hover .rel-tit{color:#72ded3!important}

    @media(max-width:700px){
      html body.rt-future.rt-future-trial .pie-nav{padding-top:18px!important}
      html body.rt-future.rt-future-trial .relacionados{margin-top:28px!important}
      html body.rt-future.rt-future-legacy.modo-corto .relacionados{
        width:100%!important;max-width:100%!important;min-width:0!important;margin-top:30px!important;padding-top:22px!important
      }
      html body.rt-future.rt-future-legacy.modo-corto .rel-grid{grid-template-columns:minmax(0,1fr)!important}
      html body.rt-future.rt-future-legacy.modo-corto .rel-item{width:100%!important;max-width:100%!important;min-width:0!important}
    }
  `;

  function ensureStyle() {
    let style = document.getElementById('rt-endmatter-v7-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'rt-endmatter-v7-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
  }

  function currentId() {
    if (!isLegacy) return '';
    return new URLSearchParams(location.search).get('id') || '';
  }

  function removeEditorialNote() {
    if (!isCanonical && !isLegacy) return;
    $$('.confianza').forEach((node) => node.remove());
  }

  function arrangeCanonicalEndMatter() {
    if (!isCanonical) return;
    const original = $('.enlace-original');
    const nav = $('.pie-nav');
    if (!original || !nav) return;

    const actions = $('.rt-reader-bottom-actions');
    const related = $('.relacionados');
    original.insertAdjacentElement('afterend', nav);
    if (actions) nav.insertAdjacentElement('afterend', actions);
    const tail = actions || nav;
    if (related) tail.insertAdjacentElement('afterend', related);

    // La capa v5 puede terminar de cargar después; fijamos aquí el acabado final
    // para impedir que reaparezca una línea entre el artículo original y la navegación.
    nav.style.setProperty('border-top', '0', 'important');
    nav.style.setProperty('margin', '0', 'important');

    nav.dataset.rtEndmatterOrder = 'v7';
    if (actions) actions.dataset.rtEndmatterOrder = 'v7';
    if (related) related.dataset.rtEndmatterOrder = 'v7';
  }

  const normalizePath = (value) => {
    try {
      const pathname = new URL(value, location.origin).pathname.replace(/\/index\.html$/i, '/');
      return pathname.endsWith('/') ? pathname : `${pathname}/`;
    } catch {
      return '';
    }
  };

  async function ensureBriefRelatedEvidence() {
    if (!isLegacy || !document.body.classList.contains('modo-corto')) return;
    const root = document.documentElement;
    if (root.dataset.rtBriefRelatedV7 === 'loading' || root.dataset.rtBriefRelatedV7 === 'ready') return;

    const existing = $('.relacionados');
    if (existing) {
      existing.dataset.rtBriefRelated = 'v7';
      root.dataset.rtBriefRelatedV7 = 'ready';
      return;
    }

    const id = currentId();
    if (!id) return;
    root.dataset.rtBriefRelatedV7 = 'loading';

    try {
      const manifestResponse = await fetch('/seo-manifest.json', { cache: 'no-store' });
      if (!manifestResponse.ok) throw new Error(`manifest HTTP ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();
      const canonicalPath = manifest?.[String(id)]?.path;
      if (!canonicalPath) throw new Error(`sin ruta canónica para ${id}`);

      const pageResponse = await fetch(canonicalPath, { cache: 'no-store' });
      if (!pageResponse.ok) throw new Error(`trial HTTP ${pageResponse.status}`);
      const source = new DOMParser().parseFromString(await pageResponse.text(), 'text/html');
      const sourceRelated = source.querySelector('.relacionados');
      if (!sourceRelated) throw new Error(`sin evidencia relacionada para ${id}`);

      const section = document.importNode(sourceRelated, true);
      section.dataset.rtBriefRelated = 'v7';
      section.removeAttribute('data-rt-endmatter-order');

      const reverse = new Map();
      Object.entries(manifest || {}).forEach(([trialId, meta]) => {
        const p = normalizePath(meta?.path || '');
        if (p) reverse.set(p, String(trialId));
      });
      $$('a[href]', section).forEach((anchor) => {
        const relatedId = reverse.get(normalizePath(anchor.getAttribute('href') || ''));
        if (relatedId) anchor.setAttribute('href', `/resumen.html?id=${encodeURIComponent(relatedId)}&v=corto`);
      });

      const footer = $('footer.art');
      const nav = $('.pie-nav');
      if (footer) footer.insertAdjacentElement('beforebegin', section);
      else if (nav) nav.insertAdjacentElement('afterend', section);
      else ($('#contenido .envoltorio') || $('#contenido') || document.body).appendChild(section);

      root.dataset.rtBriefRelatedV7 = 'ready';
    } catch (error) {
      root.dataset.rtBriefRelatedV7 = 'failed';
      console.warn('Evidencia relacionada breve:', error?.message || error);
    }
  }

  function apply() {
    ensureStyle();
    removeEditorialNote();
    arrangeCanonicalEndMatter();
    ensureBriefRelatedEvidence();
  }

  function watch() {
    if (document.documentElement.dataset.rtEndmatterWatchV7 === '1') return;
    document.documentElement.dataset.rtEndmatterWatchV7 = '1';
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        apply();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const boot = () => {
    apply();
    watch();
    [120, 350, 800, 1500, 2600].forEach((ms) => setTimeout(apply, ms));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* source: reader-ui-v8.js */
(() => {
  'use strict';
  if (window.__rtReaderUIV8) return;
  window.__rtReaderUIV8 = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const path = location.pathname.toLowerCase();
  const isCanonical = path.includes('/trials/');
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
    html body.rt-future.rt-future-trial .rel-item .tema{max-width:100%!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important}

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
    back.href = '/';
    back.textContent = '← Volver al índice';
    back.setAttribute('aria-label', 'Volver al índice de Resúmenes Trials');

    let version = nav.querySelector('.rt-reader-version,.cambio-version');
    if (!version) { version = document.createElement('a'); nav.appendChild(version); }
    version.classList.add('rt-reader-version');
    version.href = `/resumen.html?id=${encodeURIComponent(id)}&v=corto`;
    version.textContent = 'Ver resumen breve →';
    version.setAttribute('aria-label', 'Abrir el resumen breve de este artículo');

    let actions = $('.rt-reader-bottom-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'rt-reader-bottom-actions';
      actions.setAttribute('aria-label', 'Descarga del resumen completo');
      nav.insertAdjacentElement('afterend', actions);
    }

    let bottom = actions.querySelector('.rt-reader-footer-download');
    if (!bottom || bottom.dataset.rtReaderUi !== 'v8') {
      const fresh = document.createElement('button');
      fresh.type = 'button';
      fresh.className = 'rt-reader-footer-download';
      fresh.innerHTML = source.innerHTML;
      fresh.setAttribute('data-rt-footer-download', id);
      fresh.setAttribute('data-rt-reader-ui', 'v8');
      fresh.setAttribute('aria-label', 'Descargar resumen completo PDF');
      fresh.disabled = false;
      if (bottom) bottom.replaceWith(fresh); else actions.appendChild(fresh);
    } else {
      bottom.removeAttribute('data-trial-download');
      bottom.setAttribute('data-rt-footer-download', id);
      bottom.disabled = false;
    }

    const related = $('.relacionados');
    if (original.nextElementSibling !== nav) original.insertAdjacentElement('afterend', nav);
    if (nav.nextElementSibling !== actions) nav.insertAdjacentElement('afterend', actions);
    if (related && actions.nextElementSibling !== related) actions.insertAdjacentElement('afterend', related);
    nav.dataset.rtReaderUi = 'v8';
    actions.dataset.rtReaderUi = 'v8';
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
    });
  }

  function apply() {
    ensureStyle();
    ensureCanonicalControls();
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

/* source: home-downloads-v8.js */
(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  if (path !== '/' && path !== '/index.html') return;

  function normalizeButtons(root = document) {
    root.querySelectorAll?.('.fila-pdf').forEach((area) => {
      const buttons = [
        area.querySelector('.btn-pdf:not(.rt-download-brief)'),
        area.querySelector('.rt-download-brief')
      ].filter(Boolean);
      buttons.forEach((button) => {
        button.style.setProperty('font-family', "'IBM Plex Mono', monospace", 'important');
        button.style.setProperty('font-size', '10.5px', 'important');
        button.style.setProperty('font-weight', '600', 'important');
        button.style.setProperty('line-height', '1.28', 'important');
        button.style.setProperty('letter-spacing', '.045em', 'important');
        button.style.setProperty('box-sizing', 'border-box', 'important');
        button.style.setProperty('min-height', '48px', 'important');
        button.style.setProperty('padding', '10px 14px', 'important');
      });
    });
  }

  normalizeButtons();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      normalizeButtons();
    });
  }).observe(document.body, { childList: true, subtree: true });

  if (document.querySelector('script[src*="internal-medicine-ux.js"]')) return;
  if (!document.querySelector('script[src*="specialty-classification.js"]')) {
    const taxonomy = document.createElement('script');
    taxonomy.src = '/specialty-classification.js?v=2';
    document.head.appendChild(taxonomy);
  }
  const script = document.createElement('script');
  script.src = '/internal-medicine-ux.js?v=2';
  script.defer = true;
  script.dataset.rtHomeDownloadsV8 = '1';
  script.addEventListener('load', () => normalizeButtons(), { once: true });
  script.addEventListener('error', () => console.error('No se pudo cargar el módulo de descargas breves de la portada'), { once: true });
  document.head.appendChild(script);
})();

/* source: reader-controls-v9.js */
(() => {
  'use strict';
  if (!location.pathname.toLowerCase().includes('/trials/') || window.__rtReaderControlsV9) return;
  window.__rtReaderControlsV9 = true;

  const root = document.documentElement;
  const state = { suppressUntil: 0, syntheticPdfClick: false };
  const CONTROL_SELECTOR = '.pie-nav .rt-reader-back,.pie-nav .rt-reader-version,.rt-reader-bottom-actions .rt-reader-footer-download';

  function trialId() {
    return String(document.querySelector('.art-head [data-trial-download]')?.getAttribute('data-trial-download') || '').trim();
  }

  function controls() {
    return {
      back: document.querySelector('.pie-nav .rt-reader-back'),
      brief: document.querySelector('.pie-nav .rt-reader-version'),
      pdf: document.querySelector('.rt-reader-bottom-actions .rt-reader-footer-download')
    };
  }

  function ensureStableControls() {
    const id = trialId();
    if (!id) return false;
    const { back, brief, pdf } = controls();
    if (!back || !brief || !pdf) return false;

    const briefHref = `/resumen.html?id=${encodeURIComponent(id)}&v=corto`;
    if (back.getAttribute('href') !== '/') back.setAttribute('href', '/');
    if (brief.getAttribute('href') !== briefHref) brief.setAttribute('href', briefHref);
    if (pdf.getAttribute('data-rt-footer-download') !== id) pdf.setAttribute('data-rt-footer-download', id);
    pdf.disabled = false;

    for (const node of [back, brief, pdf]) {
      node.style.setProperty('pointer-events', 'auto', 'important');
      node.style.setProperty('position', 'relative', 'important');
      node.style.setProperty('z-index', '20', 'important');
      node.style.setProperty('min-height', '54px', 'important');
      node.style.setProperty('touch-action', 'manipulation', 'important');
      node.dataset.rtReaderControls = 'v9';
    }
    for (const node of [back.closest('.pie-nav'), pdf.closest('.rt-reader-bottom-actions')]) {
      if (!node) continue;
      node.style.setProperty('pointer-events', 'auto', 'important');
      node.style.setProperty('position', 'relative', 'important');
      node.style.setProperty('z-index', '19', 'important');
    }

    root.dataset.rtReaderControlsV9 = 'ready';
    return true;
  }

  function destination(control) {
    const id = trialId();
    if (control?.classList.contains('rt-reader-back')) return '/';
    if (control?.classList.contains('rt-reader-version') && id) return `/resumen.html?id=${encodeURIComponent(id)}&v=corto`;
    return '';
  }

  function cleanPrimaryPointer(event) {
    return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
  }

  function runPdfNow(button) {
    state.syntheticPdfClick = true;
    try {
      button.click();
    } finally {
      state.syntheticPdfClick = false;
    }
  }

  document.addEventListener('pointerup', (event) => {
    const control = event.target instanceof Element ? event.target.closest(CONTROL_SELECTOR) : null;
    if (!control || !cleanPrimaryPointer(event)) return;

    const href = destination(control);
    state.suppressUntil = Date.now() + 1200;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (href) {
      location.assign(href);
      return;
    }
    if (control.classList.contains('rt-reader-footer-download')) runPdfNow(control);
  }, true);

  document.addEventListener('click', (event) => {
    const control = event.target instanceof Element ? event.target.closest(CONTROL_SELECTOR) : null;
    if (!control) return;

    if (state.syntheticPdfClick && control.classList.contains('rt-reader-footer-download')) return;

    if (Date.now() < state.suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const href = destination(control);
    if (href && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign(href);
    }
  }, true);

  function boot() {
    ensureStableControls();
    [80, 180, 400, 900, 1600, 2800].forEach((ms) => setTimeout(ensureStableControls, ms));
    const observer = new MutationObserver(() => {
      if (root.dataset.rtReaderControlsV9 === 'ready' && controls().back && controls().brief && controls().pdf) return;
      ensureStableControls();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    addEventListener('resize', ensureStableControls, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
