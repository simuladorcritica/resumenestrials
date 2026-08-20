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
    const Wrapped = function (...args) { return wrapDocument(new Original(...args)); };
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

  function applyShortCanonicalLink() {
    if (!shortMode || !canonicalEntry) return;
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
        button.style.display = show ? 'inline-flex' : 'none';
        button.setAttribute('aria-hidden', show ? 'false' : 'true');
        label(button, version === 'breve' ? 'Descargar resumen breve PDF' : 'Descargar resumen completo PDF');
      });
      if (short) applyShortCanonicalLink();
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
      .catch((error) => console.warn('Enlace canónico del resumen breve:', error));
  }

  const start = () => {
    sync();
    new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    let syncAttempts = 0;
    const syncTimer = setInterval(() => {
      syncAttempts += 1;
      sync();
      const expected = shortMode
        ? document.querySelector('[data-pdf-version="breve"]')
        : document.querySelector('[data-pdf-version="completo"]');
      if (expected || syncAttempts >= 120) clearInterval(syncTimer);
    }, 100);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

const seoHelper = document.createElement('script');
seoHelper.defer = true;
if (/\/resumen\.html$/i.test(location.pathname)) {
  seoHelper.src = '/legacy-seo.js?v=1';
  const designHelper = document.createElement('script');
  designHelper.defer = true;
  designHelper.src = '/legacy-reader-design-v4.js?v=1';
  document.head.appendChild(designHelper);
} else if (/\/(?:index\.html)?$/i.test(location.pathname)) {
  seoHelper.src = '/seo-routing.js?v=1';
}
if (seoHelper.src) document.head.appendChild(seoHelper);
