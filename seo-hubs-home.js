(() => {
  const montar = () => {
    const referencia = document.querySelector('.indice-cabecera');
    if (!referencia || !referencia.parentNode) return;

    let nav = document.querySelector('.seo-hubs-home');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'seo-hubs-home';
      nav.setAttribute('aria-label', 'Explorar colecciones por especialidad');
      nav.innerHTML = `
        <span class="seo-hubs-label">Explorar colecciones</span>
        <a href="/medicina-critica/">Medicina Crítica</a>
        <a href="/medicina-interna/">Medicina Interna</a>
      `;
    }

    if (!document.getElementById('seo-hubs-home-style')) {
      const style = document.createElement('style');
      style.id = 'seo-hubs-home-style';
      style.textContent = `
        .seo-hubs-home {
          display:flex; align-items:baseline; justify-content:flex-start; gap:10px 24px; flex-wrap:wrap;
          margin:38px 0 -14px; padding:18px 0 0; border-top:1px solid var(--linea, #ddd8cc);
          font-family:'IBM Plex Mono', monospace;
        }
        .seo-hubs-label {
          margin-right:2px; font-size:9px; letter-spacing:.15em; text-transform:uppercase;
          color:var(--tinta-2, #38506e);
        }
        .seo-hubs-home a {
          display:inline-flex; align-items:center; min-height:28px; padding:3px 0;
          border:0; border-bottom:1px solid rgba(15,95,95,.26); border-radius:0;
          color:var(--teal-hondo, #0f5f5f); text-decoration:none; font-size:9.5px;
          letter-spacing:.07em; background:transparent;
          transition:border-color .18s ease,color .18s ease;
        }
        .seo-hubs-home a::after { content:'↗'; margin-left:7px; font-size:10px; color:var(--tinta-2,#38506e); }
        .seo-hubs-home a:hover,
        .seo-hubs-home a:focus-visible {
          border-bottom-color:var(--teal, #1c8a8a); color:var(--teal, #1c8a8a); background:transparent;
        }
        @media (max-width:620px) {
          .seo-hubs-home { margin-top:28px; gap:8px 18px; }
          .seo-hubs-label { flex-basis:100%; }
        }
      `;
      document.head.appendChild(style);
    }

    referencia.parentNode.insertBefore(nav, referencia);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar, { once: true });
  } else {
    montar();
  }
})();
