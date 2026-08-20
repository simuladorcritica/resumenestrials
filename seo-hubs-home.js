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
          display:flex; align-items:center; justify-content:flex-start; gap:10px; flex-wrap:wrap;
          margin:34px 0 -22px; padding:14px 0 0; border-top:1px solid var(--linea, #ddd8cc);
          font-family:'IBM Plex Mono', monospace;
        }
        .seo-hubs-label {
          margin-right:4px; font-size:10px; letter-spacing:.13em; text-transform:uppercase;
          color:var(--tinta-2, #38506e);
        }
        .seo-hubs-home a {
          display:inline-flex; align-items:center; min-height:34px; padding:7px 12px;
          border:1px solid var(--linea, #ddd8cc); border-radius:999px;
          color:var(--teal-hondo, #0f5f5f); text-decoration:none; font-size:11px;
          letter-spacing:.05em; background:transparent;
          transition:border-color .2s ease, background .2s ease, color .2s ease;
        }
        .seo-hubs-home a:hover,
        .seo-hubs-home a:focus-visible {
          border-color:var(--teal, #1c8a8a); background:var(--papel-2, #efece4);
          color:var(--teal, #1c8a8a);
        }
        @media (max-width:620px) {
          .seo-hubs-home { margin-top:26px; }
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
