(() => {
  if (!/\/resumen\.html$/i.test(location.pathname)) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;

  fetch('/seo-manifest.json', { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then((manifest) => {
      const entry = manifest?.[id];
      if (!entry?.url) return;
      const canonical = entry.url;

      const enforce = () => {
        let link = document.querySelector('link[rel="canonical"]');
        if (!link) {
          link = document.createElement('link');
          link.rel = 'canonical';
          document.head.appendChild(link);
        }
        if (link.href !== canonical) link.href = canonical;

        let robots = document.querySelector('meta[name="robots"]');
        if (!robots) {
          robots = document.createElement('meta');
          robots.name = 'robots';
          document.head.appendChild(robots);
        }
        const robotsValue = 'noindex,follow,max-image-preview:large';
        if (robots.content !== robotsValue) robots.content = robotsValue;

        const og = document.querySelector('meta[property="og:url"]');
        if (og && og.content !== canonical) og.content = canonical;
      };

      enforce();
      new MutationObserver(enforce).observe(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'content']
      });
    })
    .catch((err) => console.warn('Legacy SEO:', err));
})();
