(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  if (path !== '/' && path !== '/index.html') return;
  if (document.querySelector('script[src*="internal-medicine-ux.js"]')) return;

  const script = document.createElement('script');
  script.src = '/internal-medicine-ux.js?v=1';
  script.defer = true;
  script.dataset.rtHomeDownloadsV8 = '1';
  script.addEventListener('error', () => console.error('No se pudo cargar el módulo de descargas breves de la portada'), { once: true });
  document.head.appendChild(script);
})();
