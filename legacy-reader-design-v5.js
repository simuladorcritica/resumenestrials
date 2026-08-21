(() => {
  'use strict';
  if (!/\/resumen\.html$/i.test(location.pathname)) return;
  if (document.getElementById('rt-legacy-reader-v5')) return;

  const style = document.createElement('style');
  style.id = 'rt-legacy-reader-v5';
  style.textContent = `
    :root{
      --tinta:#eef4f3!important;--tinta-2:#9eb1b9!important;--teal:#24c8b4!important;--teal-hondo:#0d988e!important;
      --papel:#06131f!important;--papel-2:#0a2133!important;--linea:rgba(139,184,194,.22)!important;--ambar:#e2a23a!important;
    }
    html{background:#06131f!important}
    body,body.modo-corto{
      background:radial-gradient(circle at 82% 8%,rgba(36,200,180,.11),transparent 28rem),linear-gradient(180deg,#05121e,#071927 52%,#06131f)!important;
      color:#d0dbde!important;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;
      font-size:18px!important;line-height:1.76!important;overflow-x:hidden!important;
    }
    body::before{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:.18;background-image:linear-gradient(rgba(116,175,186,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(116,175,186,.055) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(#000,transparent 86%)}
    body::after{content:"";position:fixed;left:0;top:0;width:100%;height:3px;z-index:1001;background:linear-gradient(90deg,var(--ambar) 0 18%,var(--teal) 18% 100%)}
    .envoltorio,body.modo-corto .envoltorio{max-width:1320px!important;padding-left:clamp(22px,5.2vw,78px)!important;padding-right:clamp(22px,5.2vw,78px)!important}
    .topbar{background:rgba(4,17,28,.9)!important;border-bottom:1px solid var(--linea)!important;backdrop-filter:blur(20px) saturate(1.15)!important}
    .topbar-in,body.modo-corto .topbar-in{max-width:1320px!important;min-height:76px!important;padding:10px clamp(22px,5.2vw,78px)!important}
    .marca-top img{height:42px!important;width:auto!important;filter:none!important}.top-links{gap:7px!important}.top-links a{color:#9edbd5!important;border-radius:9px!important}.top-links a:hover{background:rgba(36,200,180,.08)!important;color:#62ded1!important}

    .migas{margin:24px 0 0!important;padding:12px 0!important;border-bottom:1px solid var(--linea)!important}
    .migas a.volver-top{background:transparent!important;color:#73d7cc!important;border:1px solid rgba(36,200,180,.28)!important;border-radius:9px!important;padding:9px 13px!important;font-size:11.5px!important;letter-spacing:.08em!important;text-transform:none!important}
    .migas a.volver-top:hover{background:rgba(36,200,180,.08)!important;color:#fff!important;transform:none!important}

    header.art,body.modo-corto header.art{
      position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(280px,330px)!important;
      gap:14px 48px!important;padding:58px 0 42px!important;margin:0!important;border-bottom:1px solid var(--linea)!important;isolation:isolate;
    }
    header.art::before{content:"ENSAYO CLÍNICO · LECTURA EN ESPAÑOL";position:absolute;top:25px;left:0;font:600 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.13em;color:#75cfc6}
    header.art::after{content:"RT";position:absolute;right:0;top:.06em;z-index:-1;font:500 clamp(150px,21vw,300px)/.8 'Fraunces',serif;letter-spacing:-.09em;color:rgba(36,200,180,.035)}
    header.art .etiquetas{grid-column:1;margin:2px 0 5px!important;gap:7px!important}
    .badge{border-radius:999px!important;font-size:10.5px!important;line-height:1.35!important;letter-spacing:.07em!important;padding:5px 9px!important;background:rgba(36,200,180,.055)!important;border-color:rgba(36,200,180,.23)!important;color:#79d4cb!important;box-shadow:none!important}
    header.art h1{grid-column:1;color:#f4f0e6!important;font:500 clamp(48px,5.2vw,76px)/.96 'Fraunces',serif!important;letter-spacing:-.045em!important;max-width:17ch!important;text-wrap:balance!important;margin:0!important}
    .fuente-linea,body.modo-corto .fuente-linea{grid-column:2!important;grid-row:1/4!important;align-self:end!important;padding:20px 0 4px 22px!important;border-left:1px solid var(--linea)!important;font-size:12px!important;line-height:1.7!important;letter-spacing:.03em!important;color:#9eb1b9!important;margin:0!important}
    .acciones-art{grid-column:1;margin-top:10px!important;gap:10px!important}.btn-pdf{min-height:46px!important;border-radius:9px!important;border:1px solid rgba(36,200,180,.34)!important;background:linear-gradient(135deg,#0d988e,#08716c)!important;color:#fff!important;padding:11px 15px!important;font-size:11.5px!important;line-height:1.3!important;letter-spacing:.04em!important;text-transform:none!important}.btn-pdf:hover{background:#0d988e!important;border-color:#46cfc2!important;transform:translateY(-1px)!important}.btn-pdf.breve{background:transparent!important;color:#e1c18d!important;border-color:rgba(226,162,58,.42)!important}.btn-pdf.breve:hover{background:rgba(226,162,58,.08)!important;color:#f5e4c6!important}
    .version-nav{grid-column:1;font-size:11.5px!important;line-height:1.5!important;letter-spacing:.045em!important;color:#91a6af!important}.version-etiqueta{font-size:10.5px!important;color:#e2a23a!important}.cambio-version{color:#70d5ca!important}

    article,article.corto,body.modo-corto article{
      columns:1!important;max-width:960px!important;width:100%!important;margin:0 auto!important;padding:48px 0 22px!important;color:#cbd6da!important;counter-reset:none!important;
    }
    article h2,article.corto h2{
      display:block!important;margin:42px 0 17px!important;padding:20px 0 0!important;border-top:1px solid var(--linea)!important;
      color:#58d2c5!important;font:500 24px/1.28 'Fraunces',serif!important;letter-spacing:-.01em!important;text-transform:none!important;counter-increment:none!important;
    }
    article h2:first-child,article.corto h2:first-child{margin-top:0!important;border-top:0!important;padding-top:0!important}
    article h2::before,article.corto h2::before{display:none!important;content:none!important}
    article p,article.corto p{
      max-width:78ch!important;margin:0 0 19px!important;color:#c8d3d7!important;font-size:18px!important;line-height:1.78!important;
      text-align:justify!important;text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important;
    }
    article p:first-of-type,article.corto p:first-of-type{font-size:18px!important;line-height:1.78!important}
    article strong,article.corto strong{color:#f5f2e9!important;background:none!important;text-decoration-line:underline!important;text-decoration-color:rgba(226,162,58,.58)!important;text-decoration-thickness:1.5px!important;text-underline-offset:.18em!important;text-decoration-skip-ink:auto!important}

    .enlace-original{max-width:960px!important;margin:30px auto 42px!important;padding:20px 22px!important;border:1px solid var(--linea)!important;border-left:3px solid var(--teal)!important;border-radius:10px!important;background:rgba(36,200,180,.035)!important;color:#aebfc5!important;font-size:15.5px!important;line-height:1.6!important}.enlace-original::before{display:none!important}.enlace-original a{color:#73d8cd!important}
    .relacionados{max-width:960px!important;margin:54px auto 0!important;padding-top:25px!important;border-top:1px solid var(--linea)!important}.relacionados h2{font-size:17px!important;line-height:1.35!important;letter-spacing:.06em!important;color:#eef2ef!important;text-transform:none!important}.rel-grid{gap:0 38px!important}.rel-item{padding:21px 0!important;border-color:var(--linea)!important}.rel-item .rel-tit{color:#e1e9e8!important;font-size:23px!important;line-height:1.12!important}.rel-item .rel-fuente{font-size:11.5px!important;line-height:1.5!important;color:#92a8b1!important}
    .pie-nav,footer.art{max-width:960px!important;margin-left:auto!important;margin-right:auto!important;border-color:var(--linea)!important}.volver{font-size:11.5px!important;color:#74d6cc!important}footer.art{font-size:11.5px!important;color:#91a6af!important}.aviso{font-size:13px!important;color:#91a6af!important}

    @media(max-width:900px){
      header.art,body.modo-corto header.art{grid-template-columns:1fr!important}.fuente-linea,body.modo-corto .fuente-linea{grid-column:1!important;grid-row:auto!important;max-width:64ch!important;padding-left:16px!important}.rel-grid{grid-template-columns:1fr!important}
    }
    @media(max-width:620px){
      .envoltorio,body.modo-corto .envoltorio,.topbar-in,body.modo-corto .topbar-in{padding-left:18px!important;padding-right:18px!important}.topbar-in{min-height:66px!important}.marca-top img{height:38px!important}header.art,body.modo-corto header.art{padding-top:56px!important}header.art h1{font-size:clamp(43px,13vw,60px)!important}.acciones-art{display:grid!important;grid-template-columns:1fr!important}.btn-pdf{width:100%!important}article,article.corto,body.modo-corto article{padding-top:36px!important}article h2,article.corto h2{font-size:22px!important}article p,article.corto p{font-size:17px!important;text-align:left!important;hyphens:none!important}.enlace-original{padding:18px!important}
    }
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.setAttribute('aria-hidden', 'true');
  bar.style.cssText = 'position:fixed;left:0;top:0;height:3px;width:0;background:#e2a23a;z-index:1100;pointer-events:none;transition:width .08s linear';
  document.body.appendChild(bar);
  const sync = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bar.style.width = `${Math.min(100, scrollY / max * 100)}%`;
  };
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync, { passive: true });
  sync();
})();
