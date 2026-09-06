(() => {
  'use strict';
  if (window.__rtReaderPrefs) return;
  window.__rtReaderPrefs = true;

  // Fase 4: tema claro/oscuro real (persistente + preferencia del sistema) y modo lectura.
  // Script aislado a propósito: no toca future-experience.js más allá de lo ya hecho
  // (resolveTheme/pageClass), para no arriesgar la cadena existente.

  const TEMA_KEY = 'rt-tema';
  const MODO_KEY = 'rt-modo-lectura';

  function applyTheme(tema, opts) {
    opts = opts || {};
    document.body.classList.toggle('rt-future', tema === 'oscuro');
    if (opts.persist !== false) {
      try { localStorage.setItem(TEMA_KEY, tema); } catch {}
    }
  }

  function iconSol() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" width="15" height="15"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>';
  }
  function iconLuna() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" width="15" height="15"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path></svg>';
  }

  function temaButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rt-pref-btn rt-tema-btn';
    const paint = () => {
      const oscuro = document.body.classList.contains('rt-future');
      btn.setAttribute('aria-pressed', String(oscuro));
      btn.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      btn.innerHTML = (oscuro ? iconLuna() : iconSol()) + '<span>' + (oscuro ? 'Oscuro' : 'Claro') + '</span>';
    };
    btn.addEventListener('click', () => {
      const next = document.body.classList.contains('rt-future') ? 'claro' : 'oscuro';
      applyTheme(next);
      paint();
    });
    paint();
    return btn;
  }

  function lecturaButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rt-pref-btn rt-lectura-btn';
    const paint = () => {
      const activo = document.body.classList.contains('rt-modo-lectura');
      btn.setAttribute('aria-pressed', String(activo));
      btn.setAttribute('aria-label', activo ? 'Salir del modo lectura' : 'Activar modo lectura');
      btn.textContent = activo ? 'Salir de lectura' : 'Modo lectura';
    };
    btn.addEventListener('click', () => {
      const next = !document.body.classList.contains('rt-modo-lectura');
      document.body.classList.toggle('rt-modo-lectura', next);
      try { localStorage.setItem(MODO_KEY, next ? '1' : '0'); } catch {}
      paint();
    });
    paint();
    return btn;
  }

  function injectControls() {
    const actions = document.querySelector('.rt-nav-actions');
    if (!actions || actions.querySelector('.rt-tema-btn')) return actions ? true : false;
    const topLinks = actions.querySelector('.top-links');
    const wrap = document.createElement('div');
    wrap.className = 'rt-pref-controls';
    wrap.append(temaButton());
    const esLectura = document.body.classList.contains('rt-future-trial') || document.body.classList.contains('rt-future-legacy');
    if (esLectura) wrap.append(lecturaButton());
    if (topLinks) actions.insertBefore(wrap, topLinks); else actions.append(wrap);
    return true;
  }

  function waitAndInject(triesLeft) {
    if (triesLeft === undefined) triesLeft = 90;
    if (window.__rtTemaDisponible === false) return; // ruta sin variante clara verificada
    if (window.__rtTemaDisponible !== true) {
      if (triesLeft <= 0) return;
      requestAnimationFrame(() => waitAndInject(triesLeft - 1));
      return;
    }
    if (injectControls()) return;
    if (triesLeft <= 0) return;
    requestAnimationFrame(() => waitAndInject(triesLeft - 1));
  }

  // Restaurar modo lectura guardado (independiente del tema; funciona en claro u oscuro)
  try {
    if (localStorage.getItem(MODO_KEY) === '1') document.body.classList.add('rt-modo-lectura');
  } catch {}

  // Si el usuario no fijó preferencia manual, seguir la del sistema en vivo
  try {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      let saved = null;
      try { saved = localStorage.getItem(TEMA_KEY); } catch {}
      if (saved !== 'claro' && saved !== 'oscuro' && window.__rtTemaDisponible) {
        applyTheme(mq.matches ? 'oscuro' : 'claro', { persist: false });
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  } catch {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitAndInject(), { once: true });
  } else {
    waitAndInject();
  }
})();
