(() => {
  if (document.getElementById('rt-home-control-layout')) return;
  const style = document.createElement('style');
  style.id = 'rt-home-control-layout';
  style.textContent = `
    html,body{max-width:100%;overflow-x:clip}
    .indice-cabecera,.indice-cabecera>*{min-width:0}
    @media (min-width:1360px) {
      /* Conservamos el contrato de anchura de los controles y recortamos
         únicamente cualquier ornamento que salga del lienzo editorial.
         Los selectores de año/revista (#rt-advanced) y los pills de
         especialidad (.filtros) ya no existen en el DOM del índice (ver
         library-filter-cleanup.js): el buscador de texto es ahora el único
         control y se deja a todo el ancho (ver future-experience-fix-v4.js
         para su estilo grande/llamativo). */
      .envoltorio {
        padding-left:48px !important;
        padding-right:48px !important;
      }
      .indice-cabecera {
        flex-wrap:nowrap !important;
        justify-content:flex-start !important;
        align-items:stretch !important;
        gap:10px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
