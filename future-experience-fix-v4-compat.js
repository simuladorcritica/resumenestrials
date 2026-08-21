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
