(() => {
  'use strict';
  if (window.__rtLibraryFilterCleanup) return;
  window.__rtLibraryFilterCleanup = true;

  let observer;

  function cleanLibraryFilters() {
    const header = document.querySelector('.indice-cabecera');
    if (!header) return false;

    header.querySelector('.filtros')?.remove();
    header.querySelector('.buscador')?.remove();
    header.querySelector('#rt-status')?.remove();

    const advanced = header.querySelector('#rt-advanced');
    const year = header.querySelector('#rt-year');
    const journal = header.querySelector('#rt-journal');
    if (!advanced || !year || !journal) return false;

    advanced.setAttribute('role', 'group');
    advanced.setAttribute('aria-label', 'Filtrar la biblioteca por año y revista');
    advanced.querySelectorAll('select').forEach((select) => {
      if (select !== year && select !== journal) select.remove();
    });
    header.dataset.rtSimpleFilters = '1';
    return true;
  }

  function run() {
    if (cleanLibraryFilters()) observer?.disconnect();
  }

  observer = new MutationObserver(run);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
