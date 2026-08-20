(() => {
  const injectDesign = () => {
    if (document.getElementById('rt-editorial-tool-v4')) return;
    const style = document.createElement('style');
    style.id = 'rt-editorial-tool-v4';
    style.textContent = `
      :root{--rt-ink:#10253d;--rt-ink2:#4a6076;--rt-deep:#0d5f61;--rt-teal:#1c8a8a;--rt-paper:#f5f2e9;--rt-white:#fcfaf4;--rt-line:rgba(16,37,61,.2);--rt-line2:rgba(16,37,61,.42);--rt-amber:#ca8b2c}
      html{background:var(--rt-paper)}
      body{font-size:16px!important;line-height:1.6!important;text-rendering:optimizeLegibility;background:radial-gradient(circle at 91% 7%,rgba(28,138,138,.11),transparent 24rem),var(--rt-paper)!important;color:var(--rt-ink)!important;overflow-x:hidden}
      body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.17;background-image:radial-gradient(rgba(16,37,61,.18) .55px,transparent .55px);background-size:10px 10px;mask-image:linear-gradient(#000,transparent 76%)}
      body::after{content:"";position:fixed;left:0;top:0;width:100%;height:3px;z-index:100;background:linear-gradient(90deg,var(--rt-amber) 0 18%,var(--rt-deep) 18% 100%)}
      .envoltorio{max-width:1480px!important;padding:clamp(38px,5vw,70px) clamp(22px,5vw,76px) 90px!important}
      header.top{position:relative;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:20px 50px!important;padding:36px 0 34px!important;border-bottom:7px solid var(--rt-ink)!important;margin-bottom:34px!important}
      header.top::before{content:"MESA DE EDICIÓN / RT";grid-column:1/-1;font:500 8.5px 'IBM Plex Mono',monospace;letter-spacing:.2em;color:var(--rt-deep)}
      header.top::after{content:"ED";position:absolute;right:0;bottom:-.16em;z-index:-1;font:500 clamp(120px,15vw,220px)/.8 'Fraunces',serif;letter-spacing:-.08em;color:rgba(13,95,97,.05)}
      h1.tit{font-size:clamp(54px,6.5vw,92px)!important;line-height:.84!important;letter-spacing:-.052em!important;margin:16px 0 12px!important;max-width:9ch!important;font-weight:500!important}
      .sub{font-size:18px!important;line-height:1.5!important;max-width:54ch!important;color:var(--rt-ink2)!important}.volver{align-self:end!important;font-size:8.5px!important;letter-spacing:.14em!important;color:var(--rt-deep)!important;padding:7px 0!important;border-bottom:1px solid rgba(13,95,97,.35)!important}
      .cargado{position:relative;background:rgba(252,250,244,.5)!important;border:1px solid var(--rt-line)!important;border-left:5px solid var(--rt-amber)!important;border-radius:0!important;padding:14px 18px!important;margin:25px 0 12px!important;font-size:10px!important;letter-spacing:.035em!important}
      .cargar-opts{padding:12px 0 20px!important;border-bottom:1px solid var(--rt-line2)!important;margin-bottom:38px!important}.cargar-opts input[type=file]{font-size:9px!important}.pegar summary{font-size:9px!important;letter-spacing:.08em!important}
      .cols{grid-template-columns:minmax(0,1.08fr) minmax(390px,.92fr)!important;gap:clamp(46px,6vw,90px)!important;align-items:start!important}
      fieldset{position:relative;margin-bottom:40px!important;padding-left:54px!important}
      fieldset::before{content:counter(fieldset,decimal-leading-zero);position:absolute;left:0;top:3px;font:500 9px 'IBM Plex Mono',monospace;color:var(--rt-amber)}
      form{counter-reset:fieldset}fieldset{counter-increment:fieldset}
      legend{font-size:9px!important;letter-spacing:.18em!important;padding:0 0 11px!important;border-bottom:5px solid var(--rt-ink)!important;color:var(--rt-deep)!important;width:100%!important}
      label{font-size:8.5px!important;letter-spacing:.13em!important;color:var(--rt-ink2)!important;margin-bottom:6px!important}
      .campo{margin-bottom:18px!important}.fila2,.fila3{gap:14px!important}
      input[type=text],input[type=number],input[type=url],textarea{border-radius:0!important;border:0!important;border-bottom:1px solid var(--rt-line2)!important;padding:12px 10px!important;background:rgba(252,250,244,.55)!important;box-shadow:none!important;color:var(--rt-ink)!important;font-size:15.5px!important}
      input:focus,textarea:focus{outline:none!important;border-bottom-color:var(--rt-teal)!important;box-shadow:inset 0 -3px 0 rgba(28,138,138,.12)!important;background:var(--rt-white)!important}.ayuda{font-size:11px!important;color:var(--rt-ink2)!important}
      .sec-row{position:relative;border:0!important;border-bottom:1px solid var(--rt-line)!important;border-radius:0!important;background:transparent!important;padding:16px 0!important;margin:0!important}.sec-row:first-child{border-top:1px solid var(--rt-line)!important}.sec-head{gap:8px!important}.sec-x{border-radius:50%!important;border:1px solid var(--rt-line2)!important;background:transparent!important;width:30px!important;height:30px!important}.sec-x:hover{background:rgba(163,49,31,.06)!important}.btn-sec{border-radius:0!important;border:0!important;border-bottom:1px dashed var(--rt-deep)!important;padding:8px 0!important;font-size:9px!important;letter-spacing:.09em!important;text-transform:uppercase!important}
      .acciones{padding:20px 0!important;border-top:5px solid var(--rt-ink)!important;gap:9px!important}.btn{border-radius:0!important;font:500 9px 'IBM Plex Mono',monospace!important;letter-spacing:.1em!important;text-transform:uppercase!important;padding:12px 16px!important;min-height:44px!important}.btn-primario{background:var(--rt-ink)!important;border-color:var(--rt-ink)!important}.btn-primario:hover{background:var(--rt-deep)!important;border-color:var(--rt-deep)!important}.btn-sec2{background:transparent!important;color:var(--rt-deep)!important;border-color:rgba(13,95,97,.45)!important}.estado{font-size:9.5px!important;letter-spacing:.03em!important}
      .previo-wrap{position:sticky!important;top:28px!important}.previo-wrap::before{content:"VISTA DE PUBLICACIÓN";display:block;margin-bottom:10px;font:500 8.5px 'IBM Plex Mono',monospace;letter-spacing:.18em;color:var(--rt-deep)}.previo-tit{font-size:8.5px!important;letter-spacing:.15em!important;color:var(--rt-amber)!important;margin:22px 0 8px!important}.previo-caja{border:0!important;border-top:6px solid var(--rt-ink)!important;border-bottom:1px solid var(--rt-line2)!important;border-radius:0!important;background:rgba(252,250,244,.56)!important;padding:25px 24px!important;box-shadow:0 28px 70px rgba(16,37,61,.08)!important}.pv-tit{font-size:clamp(29px,3vw,39px)!important;line-height:1.02!important;letter-spacing:-.028em!important}.pv-fuente{font-size:8.5px!important;letter-spacing:.05em!important;margin-top:10px!important}.pv-caja{background:transparent!important;border-radius:0!important;border-left:3px solid var(--rt-deep)!important;padding:14px 0 14px 17px!important;margin-top:20px!important}.pv-obj{font-size:17px!important;line-height:1.48!important}.pv-hall{font-size:15.5px!important;line-height:1.48!important}.pv-h1{font-size:32px!important;line-height:1.04!important;letter-spacing:-.025em!important}.pv-cuerpo h2{font-size:8.5px!important;letter-spacing:.14em!important;border-top:1px solid var(--rt-line)!important;padding-top:12px!important;margin-top:22px!important}.pv-cuerpo p{font-size:15px!important;line-height:1.58!important}.pv-enlace{border-top:1px solid var(--rt-line2)!important;padding-top:12px!important;font-size:9px!important;letter-spacing:.07em!important}
      #salida{font-family:'IBM Plex Mono',monospace!important;font-size:10px!important;line-height:1.45!important;background:#10253d!important;color:#d7e1e6!important;border:0!important;padding:16px!important;min-height:180px!important}
      @media(max-width:980px){.cols{grid-template-columns:1fr!important}.previo-wrap{position:relative!important;top:auto!important}.envoltorio{padding-left:22px!important;padding-right:22px!important}.previo-caja{box-shadow:none!important}}
      @media(max-width:620px){.envoltorio{padding:30px 17px 60px!important}header.top{grid-template-columns:1fr!important}header.top::after{display:none}.volver{justify-self:start!important}h1.tit{font-size:58px!important}fieldset{padding-left:0!important}fieldset::before{position:static!important;display:block;margin-bottom:7px}.fila2,.fila3{grid-template-columns:1fr!important}.acciones{display:grid!important;grid-template-columns:1fr!important}.btn{width:100%!important}}
      @media(prefers-reduced-motion:reduce){*{transition:none!important}}
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
