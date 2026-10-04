(() => {
  // Carga el manifiesto SEO para que otras funciones de la portada puedan
  // consultar las URLs canónicas sin sustituir los enlaces interactivos
  // existentes, que conservan descargas PDF y demás controles.
  fetch('/seo-manifest.json', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then((data) => { window.__RT_SEO_MANIFEST__ = data || {}; })
    .catch((err) => console.warn('SEO manifest:', err));
})();
