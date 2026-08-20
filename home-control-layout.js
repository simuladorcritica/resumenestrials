(() => {
  if (document.getElementById('rt-home-control-layout')) return;
  const style = document.createElement('style');
  style.id = 'rt-home-control-layout';
  style.textContent = `
    html,body{max-width:100%;overflow-x:clip}
    .indice-cabecera,.indice-cabecera>*{min-width:0}
    @media (min-width:1360px) {
      /* Conservamos el contrato de anchura de los controles y recortamos
         únicamente cualquier ornamento que salga del lienzo editorial. */
      .envoltorio {
        padding-left:48px !important;
        padding-right:48px !important;
      }
      .indice-cabecera {
        flex-wrap:nowrap !important;
        justify-content:flex-start !important;
        align-items:center !important;
        gap:10px !important;
      }
      .indice-cabecera > .filtros {
        flex:0 0 auto;
        flex-wrap:nowrap !important;
      }
      .indice-cabecera .filtro {
        padding-left:14px !important;
        padding-right:14px !important;
      }
      .indice-cabecera > .rt-advanced {
        margin-left:auto !important;
        flex:0 0 auto;
        flex-wrap:nowrap !important;
        gap:8px !important;
      }
      .indice-cabecera .rt-advanced select {
        max-width:none !important;
        padding-left:12px !important;
        padding-right:12px !important;
      }
      .indice-cabecera #rt-year {
        width:168px !important;
        min-width:168px !important;
      }
      .indice-cabecera #rt-journal {
        width:250px !important;
        min-width:250px !important;
        max-width:none !important;
      }
      .indice-cabecera > .buscador {
        flex:0 1 250px;
        width:250px;
        min-width:220px !important;
        margin-left:2px !important;
      }
    }
    @media (min-width:1180px) and (max-width:1359px) {
      .indice-cabecera > .rt-advanced,
      .indice-cabecera > .buscador {
        align-self:center;
      }
      .indice-cabecera #rt-journal {
        min-width:230px;
      }
    }
  `;
  document.head.appendChild(style);
})();
