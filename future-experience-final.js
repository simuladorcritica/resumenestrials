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
