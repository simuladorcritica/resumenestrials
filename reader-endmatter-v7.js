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
      max-width:800px!important;width:100%!important;margin:38px auto 0!important;padding:28px 0 0!important;
      border-top:1px solid var(--rt-line)!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados>h2{
      margin:0 0 18px!important;color:#eef2ef!important;font:500 22px/1.25 var(--rt-editorial)!important;
      letter-spacing:-.01em!important;text-transform:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-grid{
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;border:0!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item{
      min-width:0!important;margin:0!important;padding:18px!important;border:1px solid var(--rt-line)!important;
      border-radius:11px!important;background:linear-gradient(180deg,rgba(12,39,57,.68),rgba(7,26,40,.58))!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item a{
      display:block!important;color:inherit!important;text-decoration:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item h3,
    html body.rt-future.rt-future-legacy.modo-corto .rel-item .rel-tit{
      margin:10px 0 0!important;color:#dce6e5!important;font:500 20px/1.16 var(--rt-editorial)!important;
      letter-spacing:-.015em!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item p,
    html body.rt-future.rt-future-legacy.modo-corto .rel-item .rel-fuente{
      margin:10px 0 0!important;color:#91a6af!important;font:500 11px/1.5 var(--rt-mono)!important;
      letter-spacing:.025em!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item:hover{
      border-color:rgba(36,200,180,.38)!important;background:linear-gradient(180deg,rgba(13,48,66,.78),rgba(8,34,49,.68))!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .rel-item:hover h3,
    html body.rt-future.rt-future-legacy.modo-corto .rel-item:hover .rel-tit{color:#72ded3!important}

    @media(max-width:700px){
      html body.rt-future.rt-future-trial .pie-nav{padding-top:18px!important}
      html body.rt-future.rt-future-trial .relacionados{margin-top:28px!important}
      html body.rt-future.rt-future-legacy.modo-corto .relacionados{margin-top:30px!important;padding-top:22px!important}
      html body.rt-future.rt-future-legacy.modo-corto .rel-grid{grid-template-columns:1fr!important}
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
