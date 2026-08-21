(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  if (path !== '/' && path !== '/index.html') return;

  function normalizeButtons(root = document) {
    root.querySelectorAll?.('.fila-pdf').forEach((area) => {
      const buttons = [
        area.querySelector('.btn-pdf:not(.rt-download-brief)'),
        area.querySelector('.rt-download-brief')
      ].filter(Boolean);
      buttons.forEach((button) => {
        button.style.setProperty('font-family', "'IBM Plex Mono', monospace", 'important');
        button.style.setProperty('font-size', '10.5px', 'important');
        button.style.setProperty('font-weight', '600', 'important');
        button.style.setProperty('line-height', '1.28', 'important');
        button.style.setProperty('letter-spacing', '.045em', 'important');
        button.style.setProperty('box-sizing', 'border-box', 'important');
        button.style.setProperty('min-height', '48px', 'important');
        button.style.setProperty('padding', '10px 14px', 'important');
      });
    });
  }

  normalizeButtons();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      normalizeButtons();
    });
  }).observe(document.body, { childList: true, subtree: true });

  if (document.querySelector('script[src*="internal-medicine-ux.js"]')) return;
  const script = document.createElement('script');
  script.src = '/internal-medicine-ux.js?v=1';
  script.defer = true;
  script.dataset.rtHomeDownloadsV8 = '1';
  script.addEventListener('load', () => normalizeButtons(), { once: true });
  script.addEventListener('error', () => console.error('No se pudo cargar el módulo de descargas breves de la portada'), { once: true });
  document.head.appendChild(script);
})();
