(() => {
  'use strict';
  if (window.__rtReaderUIV8) return;
  window.__rtReaderUIV8 = true;

  const $ = (selector, root = document) => root.querySelector(selector);
  const path = location.pathname.toLowerCase();
  const isCanonical = path.includes('/trials/');
  const isLegacyBrief = /\/resumen\.html$/.test(path) && new URLSearchParams(location.search).get('v') === 'corto';
  const isHome = /\/(?:index\.html)?$/.test(path);

  const CSS = `
    /* Reader UI v8: controles funcionales y una retícula estable. */
    html body.rt-future.rt-future-trial .enlace-original,
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8,
    html body.rt-future.rt-future-trial .relacionados{
      grid-column:1!important;min-width:0!important;width:100%!important;max-width:none!important;box-sizing:border-box!important
    }
    html body.rt-future.rt-future-trial .enlace-original{
      margin:8px 0 0!important;padding:20px 22px!important;border:1px solid var(--rt-line)!important;
      border-left:3px solid var(--rt-teal)!important;border-radius:11px!important;background:rgba(36,200,180,.035)!important;
      overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important
    }
    html body.rt-future.rt-future-trial .enlace-original a{
      display:inline!important;max-width:100%!important;overflow-wrap:anywhere!important;word-break:normal!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8{
      display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;
      margin:16px 0 0!important;padding:0 0 28px!important;border-bottom:1px solid var(--rt-line)!important;
      position:relative!important;z-index:3!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8>.pie-nav,
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8>.rt-reader-bottom-actions{
      display:contents!important;margin:0!important;padding:0!important;border:0!important;background:none!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-back,
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-version,
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-footer-download{
      display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;
      width:100%!important;min-width:0!important;min-height:58px!important;margin:0!important;padding:12px 16px!important;
      border:1px solid rgba(116,214,204,.32)!important;border-radius:10px!important;box-sizing:border-box!important;
      font:600 14px/1.3 var(--rt-mono)!important;letter-spacing:.02em!important;text-transform:none!important;
      text-align:center!important;text-decoration:none!important;white-space:normal!important;overflow:visible!important;
      overflow-wrap:break-word!important;word-break:normal!important;hyphens:none!important;cursor:pointer!important;
      pointer-events:auto!important;position:relative!important;z-index:4!important;transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-back,
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-version{
      color:#84ddd4!important;background:rgba(255,255,255,.018)!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-back:hover,
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-version:hover{
      color:#b5f4ed!important;border-color:rgba(116,214,204,.62)!important;background:rgba(36,200,180,.065)!important;transform:translateY(-1px)!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-footer-download{
      color:#fff!important;border-color:rgba(36,200,180,.48)!important;background:linear-gradient(135deg,#0d988e,#08716c)!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-footer-download:hover{
      background:linear-gradient(135deg,#12a79c,#087a74)!important;border-color:#58d8cc!important;transform:translateY(-1px)!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-footer-download:disabled{
      opacity:.62!important;cursor:progress!important;transform:none!important
    }
    html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-footer-download svg{
      width:17px!important;height:17px!important;flex:0 0 auto!important
    }
    html body.rt-future.rt-future-trial .relacionados{
      margin:34px 0 12px!important;padding:24px 0 0!important;border-top:1px solid var(--rt-line)!important
    }
    html body.rt-future.rt-future-trial .rel-grid,
    html body.rt-future.rt-future-trial .rel-item,
    html body.rt-future.rt-future-trial .rel-item a{min-width:0!important}
    html body.rt-future.rt-future-trial .rel-item h3{
      overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important;hyphens:none!important
    }
    html body.rt-future.rt-future-trial .rel-item .badge,
    html body.rt-future.rt-future-trial .rel-item .tema{
      max-width:100%!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important
    }

    /* Resumen breve: la evidencia relacionada ocupa todo el lector y replica la retícula del completo. */
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related]{
      grid-column:1 / -1!important;align-self:start!important;min-width:0!important;width:100%!important;max-width:none!important;
      margin:42px 0 0!important;padding:24px 0 0!important;border:0!important;border-top:1px solid var(--rt-line)!important;
      border-radius:0!important;background:transparent!important;box-shadow:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related]>h2{
      margin:0 0 18px!important;padding:0!important;color:#eef2ef!important;
      font:500 22px/1.25 var(--rt-editorial)!important;letter-spacing:-.01em!important;text-transform:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-grid{
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0 48px!important;
      width:100%!important;min-width:0!important;border:0!important;border-top:1px solid var(--rt-line)!important;background:transparent!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item{
      min-width:0!important;margin:0!important;padding:24px 0!important;border:0!important;border-bottom:1px solid var(--rt-line)!important;
      border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item a{
      display:block!important;min-width:0!important;color:inherit!important;text-decoration:none!important;overflow:visible!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item h3,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item .rel-tit{
      margin:11px 0 0!important;color:#dce6e5!important;font:500 24px/1.08 var(--rt-editorial)!important;
      letter-spacing:-.018em!important;overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important;hyphens:none!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item p,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item .rel-fuente{
      margin:10px 0 0!important;color:#91a6af!important;font:500 10px/1.55 var(--rt-mono)!important;letter-spacing:.035em!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .badge,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .tema{
      display:inline-flex!important;max-width:100%!important;margin:0 5px 5px 0!important;white-space:normal!important;
      overflow-wrap:break-word!important;word-break:normal!important;line-height:1.35!important
    }
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item:hover h3,
    html body.rt-future.rt-future-legacy.modo-corto .relacionados[data-rt-brief-related] .rel-item:hover .rel-tit{color:#72ded3!important}

    /* Portada: las dos descargas tienen exactamente la misma escala y geometría. */
    html body.rt-future-home .fila-pdf{
      display:flex!important;align-items:stretch!important;gap:10px!important;flex-wrap:wrap!important;min-width:0!important
    }
    html body.rt-future-home .fila-pdf .btn-pdf,
    html body.rt-future-home .fila-pdf .rt-download-brief{
      display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;
      flex:0 1 302px!important;width:302px!important;max-width:100%!important;min-width:0!important;min-height:48px!important;
      margin:0!important;padding:10px 14px!important;border:1px solid rgba(15,95,95,.38)!important;border-radius:8px!important;
      box-sizing:border-box!important;background:rgba(15,95,95,.055)!important;color:var(--rt-teal-deep,var(--teal-hondo))!important;
      font:600 10.5px/1.28 'IBM Plex Mono',monospace!important;letter-spacing:.045em!important;text-transform:uppercase!important;
      text-align:left!important;white-space:normal!important;overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important;
      cursor:pointer!important;transition:transform .18s ease,border-color .18s ease,background .18s ease,color .18s ease!important
    }
    html body.rt-future-home .fila-pdf .rt-download-brief{
      background:transparent!important;border-color:rgba(28,138,138,.32)!important
    }
    html body.rt-future-home .fila-pdf .btn-pdf:hover,
    html body.rt-future-home .fila-pdf .rt-download-brief:hover{
      transform:translateY(-1px)!important;border-color:var(--rt-teal,var(--teal))!important;background:rgba(28,138,138,.10)!important;color:var(--rt-ink,var(--tinta))!important
    }
    html body.rt-future-home .fila-pdf .btn-pdf:disabled,
    html body.rt-future-home .fila-pdf .rt-download-brief:disabled{opacity:.56!important;cursor:progress!important;transform:none!important}
    html body.rt-future-home .fila-pdf .btn-pdf svg,
    html body.rt-future-home .fila-pdf .rt-download-brief svg{width:16px!important;height:16px!important;flex:0 0 16px!important}

    @media(max-width:980px){
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8{grid-template-columns:1fr!important}
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-back,
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-version,
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-footer-download{justify-content:flex-start!important;text-align:left!important}
    }
    @media(max-width:700px){
      html body.rt-future.rt-future-trial .enlace-original{padding:18px!important}
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8{gap:9px!important;margin-top:12px!important;padding-bottom:24px!important}
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-back,
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-version,
      html body.rt-future.rt-future-trial .rt-endmatter-controls-v8 .rt-reader-footer-download{min-height:54px!important;font-size:13px!important}
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

  function canonicalTrialId() {
    return $('.art-head [data-trial-download]')?.getAttribute('data-trial-download') ||
      $('.rt-reader-footer-download')?.getAttribute('data-rt-footer-download') || '';
  }

  function ensureCanonicalControls() {
    if (!isCanonical) return;
    const original = $('.enlace-original');
    const nav = $('.pie-nav');
    const source = $('.art-head [data-trial-download]');
    if (!original || !nav || !source) return;

    const id = String(source.getAttribute('data-trial-download') || '').trim();
    if (!id) return;

    let back = nav.querySelector('.rt-reader-back') || nav.querySelector('a[href="/"],a[href="index.html"],a[href="/index.html"]') || nav.querySelector('a');
    if (!back) {
      back = document.createElement('a');
      nav.appendChild(back);
    }
    back.classList.add('rt-reader-back');
    back.href = '/';
    back.textContent = '← Volver al índice';
    back.setAttribute('aria-label', 'Volver al índice de Resúmenes Trials');

    let version = nav.querySelector('.rt-reader-version,.cambio-version');
    if (!version) {
      version = document.createElement('a');
      nav.appendChild(version);
    }
    version.classList.add('rt-reader-version');
    version.href = `/resumen.html?id=${encodeURIComponent(id)}&v=corto`;
    version.textContent = 'Ver resumen breve →';
    version.setAttribute('aria-label', 'Abrir el resumen breve de este artículo');

    let actions = $('.rt-reader-bottom-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'rt-reader-bottom-actions';
      actions.setAttribute('aria-label', 'Descarga del resumen completo');
    }

    let bottom = actions.querySelector('.rt-reader-footer-download');
    if (!bottom || bottom.dataset.rtReaderUi !== 'v8') {
      const fresh = document.createElement('button');
      fresh.type = 'button';
      fresh.className = 'rt-reader-footer-download';
      fresh.innerHTML = source.innerHTML;
      fresh.setAttribute('data-trial-download', id);
      fresh.setAttribute('data-rt-footer-download', id);
      fresh.setAttribute('data-rt-reader-ui', 'v8');
      fresh.setAttribute('aria-label', 'Descargar resumen completo PDF');
      fresh.disabled = false;
      if (bottom) bottom.replaceWith(fresh);
      else actions.appendChild(fresh);
      bottom = fresh;
    } else {
      bottom.setAttribute('data-trial-download', id);
      bottom.setAttribute('data-rt-footer-download', id);
      bottom.disabled = false;
    }

    let shell = $('.rt-endmatter-controls-v8');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'rt-endmatter-controls-v8';
      shell.setAttribute('aria-label', 'Acciones al final del resumen');
      original.insertAdjacentElement('afterend', shell);
    }
    if (nav.parentElement !== shell) shell.appendChild(nav);
    if (actions.parentElement !== shell) shell.appendChild(actions);

    const related = $('.relacionados');
    if (related && related.previousElementSibling !== shell) shell.insertAdjacentElement('afterend', related);

    nav.dataset.rtEndmatterOrder = 'v8';
    actions.dataset.rtEndmatterOrder = 'v8';
    shell.dataset.rtEndmatterOrder = 'v8';
  }

  function polishBriefRelated() {
    if (!isLegacyBrief) return;
    const related = $('.relacionados');
    if (!related) return;
    related.dataset.rtBriefRelated = 'v8';
    related.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      if (/\/resumen\.html\?id=\d+&v=corto/.test(href)) return;
      const match = href.match(/\/trials\/([^/]+)\/?/i);
      if (!match || !window.__RT_SEO_MANIFEST__) return;
      const entry = Object.entries(window.__RT_SEO_MANIFEST__).find(([, meta]) => String(meta?.path || '').includes(`/trials/${match[1]}/`));
      if (entry) anchor.href = `/resumen.html?id=${encodeURIComponent(entry[0])}&v=corto`;
    });
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
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const boot = () => {
    apply();
    watch();
    [80, 180, 420, 900, 1600, 2800].forEach((ms) => setTimeout(apply, ms));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
