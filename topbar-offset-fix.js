/* topbar-offset-fix.js
   Mide la altura REAL y variable de .topbar (cambia segun el ancho de
   viewport porque .rt-main-nav puede pasar a una segunda fila) y la
   expone como la variable CSS --rt-topbar-h en :root. Los elementos
   sticky que deben quedar debajo del topbar (rail de progreso, indice
   de anios en portada, barra de herramientas de biblioteca, etc.)
   usan calc(var(--rt-topbar-h, <valor-de-respaldo>) + separacion)
   en vez de un numero fijo, para no volver a quedar tapados cuando
   el topbar crece.
   No toca autenticacion ni logica de negocio: solo lee geometria del
   DOM y escribe una custom property de CSS. */
(function () {
  'use strict';

  function medirYFijar() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;
    var alto = Math.ceil(topbar.getBoundingClientRect().height);
    if (alto > 0) {
      document.documentElement.style.setProperty('--rt-topbar-h', alto + 'px');
    }
  }

  medirYFijar();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', medirYFijar);
  }
  window.addEventListener('load', medirYFijar);
  window.addEventListener('resize', medirYFijar);
  window.addEventListener('orientationchange', medirYFijar);

  if (window.document && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(medirYFijar).catch(function () {});
  }

  var observado = false;
  function intentarObservar() {
    if (observado) return;
    var topbar = document.querySelector('.topbar');
    if (!topbar) {
      window.setTimeout(intentarObservar, 300);
      return;
    }
    observado = true;
    if (window.ResizeObserver) {
      try {
        var ro = new ResizeObserver(function () { medirYFijar(); });
        ro.observe(topbar);
      } catch (e) {}
    }
  }
  intentarObservar();

  var intentos = 0;
  var sondeo = window.setInterval(function () {
    medirYFijar();
    intentos += 1;
    if (intentos > 24) window.clearInterval(sondeo);
  }, 250);
})();
