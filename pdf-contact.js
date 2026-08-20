(() => {
  const CONTACT = 'resumenestrials.com · X: @resumenestrials · Telegram: @ResumenesTrials · Contacto: resumenestrials@outlook.com';

  function addContact(doc) {
    if (!doc || doc.__rtContactDone) return;
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
  }

  function patch() {
    const Ctor = window.jspdf?.jsPDF || window.jsPDF;
    if (!Ctor?.API || Ctor.API.__rtContactPatched) return Boolean(Ctor?.API?.__rtContactPatched);
    const original = Ctor.API.save;
    if (typeof original !== 'function') return false;
    Ctor.API.save = function (...args) {
      addContact(this);
      return original.apply(this, args);
    };
    Ctor.API.__rtContactPatched = true;
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
    if (!button || button.dataset.rtLabel === text) return;
    button.dataset.rtLabel = text;
    button.innerHTML = `${icon}<span>${text}</span>`;
    button.setAttribute('aria-label', text);
  };

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
      return;
    }
    document.querySelectorAll('.fila-pdf').forEach((area) => {
      label(area.querySelector('.btn-pdf:not(.rt-download-brief)'), 'Descargar resumen completo PDF');
      label(area.querySelector('.rt-download-brief'), 'Descargar resumen breve PDF');
    });
  }

  const start = () => {
    sync();
    new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
