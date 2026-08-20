(() => {
  const injectDesign = () => {
    if (document.getElementById('rt-editorial-tool-v3')) return;
    const style = document.createElement('style');
    style.id = 'rt-editorial-tool-v3';
    style.textContent = `
      body{font-size:16.5px!important;line-height:1.62!important;text-rendering:optimizeLegibility}
      body::before{content:"";display:block;height:3px;background:linear-gradient(90deg,var(--teal-hondo) 0 72%,var(--ambar) 72% 100%)}
      .envoltorio{max-width:1360px!important;padding:48px clamp(24px,5vw,70px) 90px!important}
      header.top{padding-bottom:25px!important;border-bottom:2px solid var(--tinta)!important;margin-bottom:24px!important}
      h1.tit{font-size:clamp(40px,5vw,62px)!important;line-height:.98!important;letter-spacing:-.035em!important;margin:12px 0 10px!important}
      .sub{font-size:17px!important;max-width:62ch!important}
      .cargado{background:transparent!important;border:0!important;border-left:2px solid var(--ambar)!important;border-radius:0!important;padding:8px 0 8px 16px!important;margin:24px 0 14px!important}
      .cols{grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr)!important;gap:clamp(36px,5vw,70px)!important}
      fieldset{margin-bottom:32px!important}
      legend{font-size:9.5px!important;letter-spacing:.17em!important;padding-bottom:10px!important;border-bottom:1px solid var(--tinta)!important}
      label{font-size:9px!important;letter-spacing:.11em!important}
      input[type=text],input[type=number],input[type=url],textarea{border-radius:0!important;border:0!important;border-bottom:1px solid var(--linea)!important;padding:10px 9px!important;background:rgba(255,255,255,.52)!important;box-shadow:none!important}
      input:focus,textarea:focus{border-bottom-color:var(--teal)!important;box-shadow:0 2px 0 rgba(28,138,138,.10)!important}
      .sec-row{border:0!important;border-top:1px solid var(--linea)!important;border-radius:0!important;background:transparent!important;padding:14px 0!important}
      .sec-x{border-radius:0!important;background:transparent!important}
      .btn-sec{border-radius:0!important;border:0!important;border-bottom:1px dashed var(--teal-hondo)!important;padding:7px 0!important}
      .acciones{padding-top:18px!important;border-top:1px solid var(--linea)!important}
      .btn{border-radius:0!important;font-size:10.5px!important;letter-spacing:.065em!important;padding:11px 15px!important}
      .btn-sec2{background:transparent!important}
      .previo-wrap{top:88px!important}
      .previo-tit{font-size:9.5px!important}
      .previo-caja{border:0!important;border-top:2px solid var(--tinta)!important;border-bottom:1px solid var(--linea)!important;border-radius:0!important;background:transparent!important;padding:22px 0!important}
      .pv-tit{font-size:27px!important;line-height:1.08!important;letter-spacing:-.018em!important}
      .pv-caja{background:transparent!important;border-radius:0!important}
      @media(max-width:900px){.cols{grid-template-columns:1fr!important}.previo-wrap{position:static!important}.envoltorio{padding-left:22px!important;padding-right:22px!important}}
      @media(max-width:560px){body::before{height:2px}.envoltorio{padding:34px 17px 60px!important}h1.tit{font-size:44px!important}}
    `;
    document.head.appendChild(style);
  };

  const hoy = () => new Date().toISOString().slice(0, 10);
  const instalar = () => {
    injectDesign();
    if (typeof objeto !== 'function' || typeof existentes === 'undefined' || window.__rtEditorialDatesInstalled) return;
    const baseObjeto = objeto;
    objeto = function objetoConFechasEditoriales() {
      const o = baseObjeto();
      const previo = existentes.find((x) => String(x.id) === String(o.id));
      if (previo?.fecha_publicacion_resumen) o.fecha_publicacion_resumen = previo.fecha_publicacion_resumen;
      else if (!previo) o.fecha_publicacion_resumen = hoy();
      if (previo) o.fecha_revision = hoy();
      else if (!o.fecha_revision) o.fecha_revision = o.fecha_publicacion_resumen;
      return o;
    };
    window.__rtEditorialDatesInstalled = true;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar, { once:true });
  else instalar();
})();
