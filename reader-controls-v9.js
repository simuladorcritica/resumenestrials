(() => {
  'use strict';
  if (!location.pathname.toLowerCase().includes('/trials/') || window.__rtReaderControlsV9) return;
  window.__rtReaderControlsV9 = true;

  const root = document.documentElement;
  const state = { suppressUntil: 0, syntheticPdfClick: false };
  const CONTROL_SELECTOR = '.pie-nav .rt-reader-back,.pie-nav .rt-reader-version,.rt-reader-bottom-actions .rt-reader-footer-download';

  function trialId() {
    return String(document.querySelector('.art-head [data-trial-download]')?.getAttribute('data-trial-download') || '').trim();
  }

  function controls() {
    return {
      back: document.querySelector('.pie-nav .rt-reader-back'),
      brief: document.querySelector('.pie-nav .rt-reader-version'),
      pdf: document.querySelector('.rt-reader-bottom-actions .rt-reader-footer-download')
    };
  }

  function ensureStableControls() {
    const id = trialId();
    if (!id) return false;
    const { back, brief, pdf } = controls();
    if (!back || !brief || !pdf) return false;

    const briefHref = `/resumen.html?id=${encodeURIComponent(id)}&v=corto`;
    if (back.getAttribute('href') !== '/') back.setAttribute('href', '/');
    if (brief.getAttribute('href') !== briefHref) brief.setAttribute('href', briefHref);
    if (pdf.getAttribute('data-rt-footer-download') !== id) pdf.setAttribute('data-rt-footer-download', id);
    pdf.disabled = false;

    for (const node of [back, brief, pdf]) {
      node.style.setProperty('pointer-events', 'auto', 'important');
      node.style.setProperty('position', 'relative', 'important');
      node.style.setProperty('z-index', '20', 'important');
      node.dataset.rtReaderControls = 'v9';
    }
    for (const node of [back.closest('.pie-nav'), pdf.closest('.rt-reader-bottom-actions')]) {
      if (!node) continue;
      node.style.setProperty('pointer-events', 'auto', 'important');
      node.style.setProperty('position', 'relative', 'important');
      node.style.setProperty('z-index', '19', 'important');
    }

    root.dataset.rtReaderControlsV9 = 'ready';
    return true;
  }

  function destination(control) {
    const id = trialId();
    if (control?.classList.contains('rt-reader-back')) return '/';
    if (control?.classList.contains('rt-reader-version') && id) return `/resumen.html?id=${encodeURIComponent(id)}&v=corto`;
    return '';
  }

  function cleanPrimaryPointer(event) {
    return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
  }

  function runPdfNow(button) {
    state.syntheticPdfClick = true;
    try {
      button.click();
    } finally {
      state.syntheticPdfClick = false;
    }
  }

  document.addEventListener('pointerup', (event) => {
    const control = event.target instanceof Element ? event.target.closest(CONTROL_SELECTOR) : null;
    if (!control || !cleanPrimaryPointer(event)) return;

    const href = destination(control);
    state.suppressUntil = Date.now() + 1200;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (href) {
      location.assign(href);
      return;
    }
    if (control.classList.contains('rt-reader-footer-download')) runPdfNow(control);
  }, true);

  document.addEventListener('click', (event) => {
    const control = event.target instanceof Element ? event.target.closest(CONTROL_SELECTOR) : null;
    if (!control) return;

    if (state.syntheticPdfClick && control.classList.contains('rt-reader-footer-download')) return;

    if (Date.now() < state.suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const href = destination(control);
    if (href && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.assign(href);
    }
  }, true);

  function boot() {
    ensureStableControls();
    [80, 180, 400, 900, 1600, 2800].forEach((ms) => setTimeout(ensureStableControls, ms));
    const observer = new MutationObserver(() => {
      if (root.dataset.rtReaderControlsV9 === 'ready' && controls().back && controls().brief && controls().pdf) return;
      ensureStableControls();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
