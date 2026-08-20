(() => {
  if (document.getElementById('rt-home-control-layout')) return;
  const style = document.createElement('style');
  style.id = 'rt-home-control-layout';
  style.textContent = `
    @media (min-width:1360px) {
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
        gap:7px !important;
      }
      .indice-cabecera .rt-advanced select {
        min-width:0 !important;
        max-width:190px;
        padding-left:10px !important;
        padding-right:10px !important;
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
    }
  `;
  document.head.appendChild(style);
})();
