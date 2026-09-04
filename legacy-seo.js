(() => {
  if (!/\/resumen\.html$/i.test(location.pathname)) return;

  if (!document.getElementById('rt-legacy-reader-v3')) {
    const style = document.createElement('style');
    style.id = 'rt-legacy-reader-v3';
    style.textContent = `
      body{font-size:19px!important;line-height:1.72!important;text-rendering:optimizeLegibility}
      body::before{content:"";display:block;height:3px;background:linear-gradient(90deg,var(--teal-hondo) 0 72%,var(--ambar) 72% 100%)}
      .envoltorio{max-width:1280px!important;padding-left:clamp(24px,5.2vw,78px)!important;padding-right:clamp(24px,5.2vw,78px)!important}
      .topbar-in{max-width:1280px!important;padding:14px clamp(24px,5.2vw,78px)!important;min-height:70px!important}
      .marca-top img{height:38px!important}
      .top-links a{border-radius:0!important}
      .migas{margin-top:30px!important;padding-bottom:14px!important;border-bottom:1px solid var(--linea)!important}
      .migas a.volver-top{font-size:9.5px!important;letter-spacing:.1em!important;color:var(--tinta-2)!important;background:transparent!important;padding:4px 0!important;border-radius:0!important;border-bottom:1px solid transparent!important;transform:none!important}
      .migas a.volver-top:hover{color:var(--teal-hondo)!important;border-bottom-color:var(--teal-hondo)!important}
      header.art{position:relative;padding:38px 0!important;border-bottom:1px solid var(--linea)!important}
      header.art::before{content:"";position:absolute;top:18px;left:0;width:42px;height:2px;background:var(--ambar)}
      header.art h1{font-size:clamp(40px,5.4vw,64px)!important;line-height:1.015!important;letter-spacing:-.034em!important;max-width:24ch!important}
      .etiquetas{gap:10px 17px!important}
      .badge{font-size:9px!important;letter-spacing:.1em!important;border:0!important;border-bottom:1px solid currentColor!important;border-radius:0!important;background:transparent!important;padding:0 0 3px!important;box-shadow:none!important}
      .fuente-linea{font-size:10px!important;line-height:1.55!important;margin-bottom:18px!important}
      .acciones-art{gap:17px!important;margin-top:25px!important}
      .btn-pdf{border-radius:0!important;font-size:9.5px!important;letter-spacing:.07em!important;min-height:40px!important;box-shadow:none!important}
      .btn-pdf:not(.breve){background:var(--teal-hondo)!important;color:#fff!important;border-color:var(--teal-hondo)!important}
      .btn-pdf.breve{border:0!important;border-left:2px solid var(--ambar)!important;padding-left:14px!important}
      .version-nav{font-size:9.5px!important;margin-top:18px!important}
      article{padding:36px 0 20px!important;column-gap:clamp(48px,6vw,82px)!important;column-rule:1px solid var(--linea)!important}
      article h2{font-size:10px!important;letter-spacing:.17em!important;margin-top:34px!important}
      article p{text-align:left!important;margin-bottom:17px!important}
      body.modo-corto .envoltorio,body.modo-corto .topbar-in{max-width:900px!important}
      body.modo-corto article{column-rule:0!important}
      .enlace-original{background:transparent!important;border-radius:0!important;border-left:0!important;border-top:1px solid var(--linea)!important;border-bottom:1px solid var(--linea)!important;padding:19px 0!important}
      .relacionados{margin-top:48px!important;border-top:2px solid var(--tinta)!important;padding-top:22px!important}
      .relacionados h2{font-size:10px!important;color:var(--tinta)!important}
      .rel-grid{gap:0 48px!important}.rel-item{padding:20px 0!important}.rel-item .rel-tit{font-size:22px!important;line-height:1.13!important}
      footer.art{font-size:9.5px!important}
      @media(max-width:900px){article{columns:1!important;column-rule:0!important}}
      @media(max-width:620px){body::before{height:2px}.envoltorio,.topbar-in{padding-left:19px!important;padding-right:19px!important}.marca-top img{height:34px!important}header.art h1{font-size:clamp(36px,11vw,49px)!important}.acciones-art{display:grid!important}.btn-pdf{width:100%!important}}
    `;
    document.head.appendChild(style);
  }

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

        const robots = document.querySelector('meta[name="robots"]');
        if (robots) {
          // La URL con query conserva compatibilidad, pero la página estática
          // /trials/... es la única versión indexable.
          const robotsValue = 'noindex,follow,max-image-preview:large';
          if (robots.content !== robotsValue) robots.content = robotsValue;
        }

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
