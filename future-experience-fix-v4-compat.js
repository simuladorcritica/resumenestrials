(() => {
  'use strict';
  if (window.__rtFutureFixV4Compat) return;
  window.__rtFutureFixV4Compat = true;
  const style = document.createElement('style');
  style.id = 'rt-unified-reader-v4-compat';
  style.textContent = `
    @media (max-width:700px){
      body.rt-future-trial .rt-evidence-section h2,
      body.rt-future-legacy article h2,
      body.rt-future-legacy article.corto h2{font-size:31px!important;line-height:1.22!important}
      body.rt-future-trial .rt-evidence-section p,
      body.rt-future-trial article.articulo p,
      body.rt-future-trial .rt-evidence-section li,
      body.rt-future-trial article.articulo li,
      body.rt-future-legacy article p,
      body.rt-future-legacy article.corto p,
      body.rt-future-legacy article li,
      body.rt-future-legacy article.corto li{
        font-size:21px!important;line-height:1.78!important;text-align:left!important;hyphens:none!important;-webkit-hyphens:none!important
      }
    }
  `;
  document.head.appendChild(style);
})();
