(() => {
  'use strict';
  if (window.__rtFutureFinal) return;
  window.__rtFutureFinal = true;

  const ensureAccountEntry = async () => {
    const topLinks = document.querySelector('.topbar .top-links');
    if (!topLinks) return;

    topLinks.setAttribute('aria-label', 'Cuenta y redes');
    let entry = topLinks.querySelector('#account-entry, .auth-entry');
    if (!entry) {
      entry = document.createElement('a');
      entry.id = 'account-entry';
      entry.className = 'auth-entry';
      entry.href = '/login.html';
      entry.setAttribute('aria-label', 'Entrar o crear una cuenta');
      entry.innerHTML = '<span class="auth-entry-main">Entrar o crear cuenta</span>';
      topLinks.prepend(entry);
    }

    try {
      const mod = await import('/auth.js');
      const user = await mod.currentUser().catch(() => null);
      const label = entry.querySelector('.auth-entry-main') || entry;
      if (user) {
        entry.href = '/cuenta.html';
        entry.setAttribute('aria-label', 'Abrir mi cuenta');
        label.textContent = 'Mi cuenta';
      } else {
        entry.href = '/login.html';
        entry.setAttribute('aria-label', 'Entrar o crear una cuenta');
        label.textContent = 'Entrar o crear cuenta';
      }
    } catch {
      // La navegación sigue siendo utilizable aunque la sesión no pueda consultarse.
    }
  };

  const ensureFeaturedTrial = () => {
    if (!document.body.classList.contains('rt-future-home')) return;
    const index = document.querySelector('#indice');
    if (!index) return;
    const rows = [...index.querySelectorAll('.fila')];
    rows.forEach((row, position) => {
      row.style.setProperty('--rt-row-index', String(position + 1));
      row.classList.toggle('rt-featured', position === 0);
    });
  };

  const watchExplorer = () => {
    const index = document.querySelector('#indice');
    if (!index || index.dataset.rtFutureFinalWatch === '1') return;
    index.dataset.rtFutureFinalWatch = '1';
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        ensureFeaturedTrial();
      });
    };
    new MutationObserver(refresh).observe(index, { childList: true, subtree: true });
    ensureFeaturedTrial();
  };

  const boot = () => {
    ensureAccountEntry();
    watchExplorer();
    // La cabecera y el índice pueden regenerarse durante el arranque de la portada.
    setTimeout(() => {
      ensureAccountEntry();
      watchExplorer();
      ensureFeaturedTrial();
    }, 350);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
