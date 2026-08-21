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
    const values = [row.especialidad_principal, ...(Array.isArray(row.temas) ? row.temas : [])].filter(Boolean).slice(0,4);
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
