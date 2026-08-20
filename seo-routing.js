(() => {
  const manifestUrl = '/seo-manifest.json';
  let manifest = null;

  function idFromHref(href) {
    try {
      const url = new URL(href, location.href);
      if (!/\/resumen\.html$/i.test(url.pathname)) return null;
      return { id: url.searchParams.get('id'), short: url.searchParams.get('v') === 'corto' };
    } catch (_) {
      return null;
    }
  }

  function rewrite(root = document) {
    if (!manifest) return;
    root.querySelectorAll?.('a[href*="resumen.html?id="]').forEach((a) => {
      const parsed = idFromHref(a.getAttribute('href'));
      if (!parsed?.id || !manifest[parsed.id]) return;
      a.href = manifest[parsed.id].path + (parsed.short ? '#resumen-breve' : '');
    });
  }

  fetch(manifestUrl, { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then((data) => {
      manifest = data || {};
      rewrite(document);
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) rewrite(node);
          });
        }
      }).observe(document.body, { childList: true, subtree: true });
    })
    .catch((err) => console.warn('SEO routing:', err));
})();
