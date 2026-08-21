(() => {
  'use strict';
  if (window.__rtFutureFixV4Compat) return;
  window.__rtFutureFixV4Compat = true;
  const style = document.createElement('style');
  style.id = 'rt-unified-reader-v4-compat';
  style.textContent = `
    /* Candado de especificidad: mantiene la escala v4 aunque capas históricas
       vuelvan a insertar estilos después durante re-renders dinámicos. */
    html body.rt-future .rt-main-nav a,
    html body.rt-future .topbar nav a{font-size:16px!important;line-height:1.25!important}
    html body.rt-future .top-links .auth-entry-main{font-size:15px!important;line-height:1.25!important}
    html body.rt-future .rt-nav-search{font-size:15px!important;line-height:1.3!important}

    html body.rt-future.rt-future-home .rt-hero-eyebrow{font-size:14px!important;line-height:1.45!important}
    html body.rt-future.rt-future-home .bajada-cols{font-size:20px!important;line-height:1.72!important}
    html body.rt-future.rt-future-home .rt-hero-cta{font-size:16px!important;line-height:1.3!important}
    html body.rt-future.rt-future-home .meta-eti{font-size:13px!important;line-height:1.35!important}
    html body.rt-future.rt-future-home .rt-orbit-label{font-size:13px!important;line-height:1.3!important}
    html body.rt-future.rt-future-home .rt-orbit-label b{font-size:16px!important;line-height:1.35!important}
    html body.rt-future.rt-future-home .rt-explorer-head p{font-size:20px!important;line-height:1.7!important}
    html body.rt-future.rt-future-home .rt-step b{font-size:20px!important;line-height:1.3!important}
    html body.rt-future.rt-future-home .rt-step span{font-size:18px!important;line-height:1.55!important}
    html body.rt-future.rt-future-home .filtro{font-size:15px!important;line-height:1.35!important}
    html body.rt-future.rt-future-home .filtro .n{font-size:14px!important}
    html body.rt-future.rt-future-home .rt-advanced select{font-size:16px!important}
    html body.rt-future.rt-future-home .buscador-input{font-size:17px!important}
    html body.rt-future.rt-future-home .conteo-busqueda{font-size:14px!important}
    html body.rt-future.rt-future-home .fila-cuerpo .fuente{font-size:15px!important;line-height:1.6!important}
    html body.rt-future.rt-future-home .badge{font-size:13px!important}
    html body.rt-future.rt-future-home .btn-pdf{font-size:15px!important}

    html body.rt-future.rt-future-trial .migas{font-size:15px!important;line-height:1.55!important}
    html body.rt-future.rt-future-trial .art-head::before{font-size:14px!important;line-height:1.4!important}
    html body.rt-future.rt-future-trial .art-head h1{font-size:clamp(58px,5.6vw,88px)!important;line-height:.99!important}
    html body.rt-future.rt-future-trial .badge,
    html body.rt-future.rt-future-trial .tema{font-size:14px!important;line-height:1.4!important}
    html body.rt-future.rt-future-trial .fuente,
    html body.rt-future.rt-future-trial .publicacion{font-size:16px!important;line-height:1.65!important}
    html body.rt-future.rt-future-trial .trial-action,
    html body.rt-future.rt-future-trial .rt-save-action{font-size:16px!important;line-height:1.3!important}
    html body.rt-future.rt-future-trial .rt-evidence-section h2{font-size:31px!important;line-height:1.22!important}
    html body.rt-future.rt-future-trial .rt-evidence-section p,
    html body.rt-future.rt-future-trial article.articulo p,
    html body.rt-future.rt-future-trial .rt-evidence-section li,
    html body.rt-future.rt-future-trial article.articulo li{
      font-size:21px!important;line-height:1.82!important;text-align:justify!important;
      text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important
    }
    html body.rt-future.rt-future-trial .rt-rail-card h3{font-size:14px!important;line-height:1.45!important}
    html body.rt-future.rt-future-trial .rt-progress-copy{font-size:17px!important;line-height:1.55!important}
    html body.rt-future.rt-future-trial .rt-rail-nav a{font-size:16px!important;line-height:1.5!important}
    html body.rt-future.rt-future-trial .rt-rail-source{font-size:14px!important;line-height:1.5!important}

    html body.rt-future.rt-future-legacy,
    html body.rt-future.rt-future-legacy.modo-corto{font-size:21px!important;line-height:1.82!important}
    html body.rt-future.rt-future-legacy header.art h1{font-size:clamp(58px,5.6vw,88px)!important;line-height:.99!important}
    html body.rt-future.rt-future-legacy:not(.modo-corto) [data-pdf-version="breve"]{display:none!important}
    html body.rt-future.rt-future-legacy.modo-corto [data-pdf-version="completo"]{display:none!important}
    html body.rt-future.rt-future-legacy .fuente-linea{font-size:16px!important;line-height:1.65!important}
    html body.rt-future.rt-future-legacy .badge{font-size:14px!important;line-height:1.4!important}
    html body.rt-future.rt-future-legacy .btn-pdf{font-size:16px!important;line-height:1.3!important}
    html body.rt-future.rt-future-legacy .version-nav{font-size:15px!important;line-height:1.5!important}
    html body.rt-future.rt-future-legacy .version-etiqueta{font-size:14px!important}
    html body.rt-future.rt-future-legacy article h2,
    html body.rt-future.rt-future-legacy article.corto h2{font-size:31px!important;line-height:1.22!important}
    html body.rt-future.rt-future-legacy article p,
    html body.rt-future.rt-future-legacy article.corto p,
    html body.rt-future.rt-future-legacy article li,
    html body.rt-future.rt-future-legacy article.corto li{
      font-size:21px!important;line-height:1.82!important;text-align:justify!important;
      text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important
    }
    html body.rt-future.rt-future-legacy .rt-rail-card h3{font-size:14px!important;line-height:1.45!important}
    html body.rt-future.rt-future-legacy .rt-progress-copy{font-size:17px!important;line-height:1.55!important}
    html body.rt-future.rt-future-legacy .rt-rail-nav a{font-size:16px!important;line-height:1.5!important}

    html body.rt-future.rt-future-hub .migas,
    html body.rt-future.rt-future-cluster .migas,
    html body.rt-future.rt-future-institutional .migas{font-size:15px!important;line-height:1.5!important}
    html body.rt-future.rt-future-hub .eyebrow,
    html body.rt-future.rt-future-cluster .eyebrow,
    html body.rt-future.rt-future-institutional .eyebrow{font-size:15px!important;line-height:1.45!important}
    html body.rt-future.rt-future-hub .cluster-card p,
    html body.rt-future.rt-future-cluster .cluster-card p,
    html body.rt-future.rt-future-hub .cat-card p,
    html body.rt-future.rt-future-cluster .cat-card p{font-size:18px!important;line-height:1.62!important}
    html body.rt-future.rt-future-hub .cluster-card span,
    html body.rt-future.rt-future-cluster .cluster-card span,
    html body.rt-future.rt-future-hub .cat-meta,
    html body.rt-future.rt-future-cluster .cat-meta{font-size:14px!important;line-height:1.5!important}

    @media (max-width:700px){
      html body.rt-future.rt-future-home .bajada-cols{font-size:18px!important;line-height:1.68!important}
      html body.rt-future.rt-future-trial .art-head h1,
      html body.rt-future.rt-future-legacy header.art h1{font-size:clamp(48px,13vw,68px)!important;line-height:.99!important}
      html body.rt-future.rt-future-trial .rt-evidence-section h2,
      html body.rt-future.rt-future-legacy article h2,
      html body.rt-future.rt-future-legacy article.corto h2{font-size:31px!important;line-height:1.22!important}
      html body.rt-future.rt-future-trial .rt-evidence-section p,
      html body.rt-future.rt-future-trial article.articulo p,
      html body.rt-future.rt-future-trial .rt-evidence-section li,
      html body.rt-future.rt-future-trial article.articulo li,
      html body.rt-future.rt-future-legacy article p,
      html body.rt-future.rt-future-legacy article.corto p,
      html body.rt-future.rt-future-legacy article li,
      html body.rt-future.rt-future-legacy article.corto li{
        font-size:21px!important;line-height:1.78!important;text-align:left!important;
        hyphens:none!important;-webkit-hyphens:none!important
      }
    }
  `;
  document.head.appendChild(style);
})();
