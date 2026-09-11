(() => {
  'use strict';
  if (window.__rtLibraryFilterCleanup) return;
  window.__rtLibraryFilterCleanup = true;

  let observer;

  function cleanLibraryFilters() {
    const header = document.querySelector('.indice-cabecera');
    if (!header) return false;

    // A pedido explicito del usuario: se quitan los selectores de anio y
    // revista (antes en #rt-advanced) y se deja el buscador de texto como
    // unico control, ampliado visualmente por future-experience-fix-v4.js.
    //
    // #rt-advanced lo construye addAdvanced() (interactive-home.js) recien
    // cuando termina el fetch de resumenes.json, mucho despues de que
    // .buscador ya esta en el DOM (es markup estatico presente desde el
    // primer pintado). Por eso no basta con que exista .buscador para dar
    // por terminada la limpieza: hay que esperar a que #rt-advanced (con
    // #rt-year y #rt-journal ya armados) aparezca, recien ahi quitarlo, y
    // solo entonces desconectar el observer — si se desconecta antes,
    // #rt-advanced quedaria visible para siempre al insertarse mas tarde.
    const buscador = header.querySelector('.buscador');
    const advanced = header.querySelector('#rt-advanced');
    const year = advanced?.querySelector('#rt-year');
    const journal = advanced?.querySelector('#rt-journal');
    if (!buscador || !advanced || !year || !journal) return false;

    header.querySelector('.filtros')?.remove();
    advanced.remove();
    header.dataset.rtSimpleFilters = '1';
    const input = buscador.querySelector('input');
    if (input && !header.querySelector('.ed-index-label')) {
      if (!input.id) input.id = 'ed-index-query';
      const label = document.createElement('label');
      label.className = 'ed-index-label';
      label.htmlFor = input.id;
      label.textContent = 'Buscar en el índice';
      header.insertBefore(label, buscador);
    }
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
