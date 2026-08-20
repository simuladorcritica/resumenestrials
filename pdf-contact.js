(() => {
  const CONTACT = 'resumenestrials.com · X: @resumenestrials · Telegram: @ResumenesTrials · Contacto: resumenestrials@outlook.com';
  const params = new URLSearchParams(location.search);
  const shortMode = /\/resumen\.html$/i.test(location.pathname) && params.get('v') === 'corto';
  const articleId = params.get('id');
  let canonicalEntry = null;

  function addContact(doc) {
    if (!doc || doc.__rtContactDone) return;
    try {
      const active = doc.internal.getCurrentPageInfo?.().pageNumber || 1;
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 95, 95);
        doc.text(CONTACT, w / 2, h - 15, { align: 'center' });
      }
      doc.setPage(Math.min(active, total));
      doc.__rtContactDone = true;
    } catch (error) {
      console.warn('No se pudo añadir el pie de contacto al PDF:', error);
    }
  }

  function wrapDocument(doc) {
    if (!doc || doc.__rtSaveWrapped || typeof doc.save !== 'function') return doc;
    const originalSave = doc.save.bind(doc);
    doc.save = (...args) => {
      addContact(doc);
      return originalSave(...args);
    };
    doc.__rtSaveWrapped = true;
    return doc;
  }

  function patch() {
    const ns = window.jspdf;
    const Original = ns?.jsPDF || window.jsPDF;
    if (typeof Original !== 'function') return false;
    if (Original.__rtConstructorWrapped) return true;

    if (Original.API && typeof Original.API.save === 'function' && !Original.API.__rtContactPatched) {
      const apiSave = Original.API.save;
      Original.API.save = function (...args) {
        addContact(this);
        return apiSave.apply(this, args);
      };
      Original.API.__rtContactPatched = true;
    }

    const Wrapped = function (...args) {
      return wrapDocument(new Original(...args));
    };
    Wrapped.API = Original.API;
    Wrapped.prototype = Original.prototype;
    Wrapped.__rtConstructorWrapped = true;
    Wrapped.__rtOriginal = Original;

    if (ns && ns.jsPDF === Original) ns.jsPDF = Wrapped;
    if (window.jsPDF === Original) window.jsPDF = Wrapped;
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (patch() || attempts > 120) clearInterval(timer);
  }, 100);
  patch();

  const icon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"></path><path d="m7.5 10 4.5 4.5 4.5-4.5"></path><path d="M5 20h14"></path></svg>';
  const label = (button, text) => {
    if (!button) return;
    const current = (button.textContent || '').replace(/\s+/g, ' ').trim();
    if (button.dataset.rtLabel === text && current === text && button.querySelector('svg')) return;
    button.dataset.rtLabel = text;
    button.innerHTML = `${icon}<span>${text}</span>`;
    button.setAttribute('aria-label', text);
  };

  function injectShortStyles() {
    if (!shortMode || document.getElementById('rt-short-unified-style')) return;
    const style = document.createElement('style');
    style.id = 'rt-short-unified-style';
    style.textContent = `
      body.modo-corto .migas.rt-route{
        width:fit-content;max-width:100%;margin:22px 0 0;padding:8px 10px 8px 13px;
        display:flex;align-items:center;gap:8px;flex-wrap:wrap;
        border:1px solid rgba(15,95,95,.18);border-left:3px solid var(--teal-hondo);
        border-radius:5px;background:rgba(255,255,255,.34);box-shadow:0 8px 24px rgba(18,35,59,.035);
        font-family:'IBM Plex Mono',monospace;font-size:10.5px;line-height:1.35;color:#8390a0
      }
      body.modo-corto .migas.rt-route a{
        display:inline-flex;align-items:center;min-height:24px;padding:3px 4px;border-radius:3px;
        color:var(--teal-hondo);text-decoration:none;font-size:10.5px;font-weight:400;
        letter-spacing:.07em;text-transform:none;background:transparent;transition:background .18s ease,color .18s ease,transform .18s ease
      }
      body.modo-corto .migas.rt-route a:hover{background:rgba(28,138,138,.07);color:var(--teal);transform:none}
      body.modo-corto .migas.rt-route>span:not(:last-child){color:#9aa3ad;font-size:12px}
      body.modo-corto .migas.rt-route>span:last-child{
        display:inline-flex;align-items:center;min-height:24px;padding:3px 9px;border-radius:999px;
        background:var(--teal-hondo);color:#fff;letter-spacing:.09em;text-transform:uppercase;font-size:9.5px
      }
      body.modo-corto header.art{padding-top:18px}
      body.modo-corto .acciones-art .btn-pdf.breve{background:rgba(200,137,42,.045);border-color:rgba(200,137,42,.52)}
      body.modo-corto .acciones-art .btn-pdf.breve:hover{background:#9a6820;color:#fff}
      body.modo-corto .version-nav{padding-top:1px}
      body.modo-corto .version-nav .cambio-version{display:inline-flex;align-items:center;gap:6px}
      @media(max-width:620px){body.modo-corto .migas.rt-route{width:100%;border-radius:4px}}
    `;
    document.head.appendChild(style);
  }

  function categoryFromPage() {
    const badge = document.querySelector('header.art .badge.critica,header.art .badge.interna');
    const name = (badge?.textContent || '').trim();
    if (name === 'Medicina Crítica') return { name, path: '/medicina-critica/' };
    if (name === 'Medicina Interna') return { name, path: '/medicina-interna/' };
    return null;
  }

  function applyShortNavigation() {
    if (!shortMode || !canonicalEntry) return;
    injectShortStyles();
    const nav = document.querySelector('.migas');
    if (nav && !nav.classList.contains('rt-route')) {
      const category = categoryFromPage();
      const cluster = Array.isArray(canonicalEntry.clusters) ? canonicalEntry.clusters[0] : null;
      const parts = ['<a href="/">Inicio</a><span>›</span>'];
      if (category) parts.push(`<a href="${category.path}">${category.name}</a><span>›</span>`);
      if (cluster?.path && cluster?.name) parts.push(`<a href="${cluster.path}">${cluster.name}</a><span>›</span>`);
      parts.push('<span>Resumen breve</span>');
      nav.className = 'migas rt-route';
      nav.innerHTML = parts.join('');
      nav.setAttribute('aria-label', 'Ruta');
    }

    const fullHref = canonicalEntry.path || canonicalEntry.url || '/';
    document.querySelectorAll('.cambio-version').forEach((link) => {
      link.href = fullHref;
      link.textContent = 'Ver versión completa →';
    });
  }

  function sync() {
    const isArticle = /\/resumen\.html$/i.test(location.pathname) || document.querySelector('[data-pdf-version]');
    if (isArticle) {
      const short = new URLSearchParams(location.search).get('v') === 'corto';
      document.querySelectorAll('[data-pdf-version]').forEach((button) => {
        const version = button.dataset.pdfVersion;
        const show = short ? version === 'breve' : version === 'completo';
        button.hidden = !show;
        button.style.display = show ? '' : 'none';
        label(button, version === 'breve' ? 'Descargar resumen breve PDF' : 'Descargar resumen completo PDF');
      });
      if (short) applyShortNavigation();
      return;
    }
    document.querySelectorAll('.fila-pdf').forEach((area) => {
      label(area.querySelector('.btn-pdf:not(.rt-download-brief)'), 'Descargar resumen completo PDF');
      label(area.querySelector('.rt-download-brief'), 'Descargar resumen breve PDF');
    });
  }

  if (shortMode && articleId) {
    fetch('/seo-manifest.json', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((manifest) => { canonicalEntry = manifest?.[articleId] || null; sync(); })
      .catch((error) => console.warn('Navegación resumen breve:', error));
  }

  const start = () => {
    sync();
    new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

const seoHelper = document.createElement('script');
seoHelper.defer = true;
if (/\/resumen\.html$/i.test(location.pathname)) {
  seoHelper.src = '/legacy-seo.js?v=1';
} else if (/\/(?:index\.html)?$/i.test(location.pathname)) {
  seoHelper.src = '/seo-routing.js?v=1';
}
if (seoHelper.src) document.head.appendChild(seoHelper);
