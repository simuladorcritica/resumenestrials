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

  const boot = () => {
    ensureAccountEntry();
    // La cabecera puede regenerarse una vez durante el arranque de la portada.
    setTimeout(ensureAccountEntry, 350);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
