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
    observer.observe(document.documentElement, { childList: true, subtree: true });
    [150, 450, 900, 1800].forEach(ms => setTimeout(() => {
      ensureStyle();
      normalizeLegacy();
    }, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
