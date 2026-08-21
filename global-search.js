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