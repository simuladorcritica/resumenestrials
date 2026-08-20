function normalizeLabel(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

function classifySubspecialties() {
  document.querySelectorAll('.badge.subesp-mi').forEach((badge) => {
    if (badge.dataset.colorized === '1') return;
    badge.dataset.colorized = '1';
    badge.dataset.subspecialty = normalizeLabel(badge.textContent);
  });
}

function injectVisualTuning() {
  if (document.getElementById('rt-home-visual-tuning')) return;
  const style = document.createElement('style');
  style.id = 'rt-home-visual-tuning';
  style.textContent = `
    body{font-size:19px;line-height:1.68;text-rendering:optimizeLegibility}
    body::before{content:"";display:block;height:3px;background:linear-gradient(90deg,var(--teal-hondo) 0 72%,var(--ambar) 72% 100%)}
    .envoltorio{max-width:1440px;padding-left:clamp(36px,6.5vw,96px);padding-right:clamp(36px,6.5vw,96px)}
    .topbar-in{max-width:1440px;padding:12px clamp(36px,6.5vw,96px);min-height:76px}
    .topbar{background:rgba(247,246,242,.955);backdrop-filter:saturate(1.08) blur(12px)}

    header.sitio{position:relative;padding:74px 0 54px;border-bottom:2px solid var(--tinta)}
    header.sitio::before{content:"PUBLICACIÓN CLÍNICA INDEPENDIENTE · EVIDENCIA EN ESPAÑOL";display:block;margin-bottom:24px;font:500 9.5px/1.4 'IBM Plex Mono',monospace;letter-spacing:.16em;color:var(--teal-hondo)}
    header.sitio::after{content:"";position:absolute;top:55px;right:0;width:54px;height:2px;background:var(--ambar)}
    h1.titulo{font-size:clamp(62px,8.2vw,112px);line-height:.89;letter-spacing:-.047em;margin:0 0 38px;text-align:left;max-width:10ch}
    .bajada{text-align:left;font-size:19px;line-height:1.68}
    .bajada .lead{font-size:clamp(24px,2.35vw,31px);line-height:1.35;max-width:38ch;margin:0 0 38px;color:var(--tinta);letter-spacing:-.008em}
    .bajada-cols{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(46px,7vw,88px);max-width:1050px;border-top:1px solid var(--linea);padding-top:28px}
    .bajada-cols p{font-size:17.5px;line-height:1.65;color:var(--tinta-2);max-width:50ch}

    .barra-meta{justify-content:flex-start;gap:0;flex-wrap:nowrap;margin-top:48px;padding-top:0;border-top:0;border-bottom:1px solid var(--linea);text-align:left}
    .meta-dato{align-items:flex-start;min-width:150px;padding:20px clamp(24px,3.5vw,48px) 21px 0;margin-right:clamp(24px,3.5vw,48px);border-right:1px solid var(--linea)}
    .meta-dato:last-child{border-right:0}
    .meta-num{font-size:34px;line-height:.95}
    .meta-eti{font-size:9px;letter-spacing:.15em;margin-top:8px}

    .indice-cabecera{position:relative;margin:58px 0 0;padding:18px 0 17px;border-top:2px solid var(--tinta);border-bottom:1px solid var(--linea);gap:12px 18px}
    .indice-cabecera::before{content:"ARCHIVO";position:absolute;left:0;top:-25px;font:500 9px 'IBM Plex Mono',monospace;letter-spacing:.16em;color:var(--tinta-2)}
    .filtros{gap:0}
    .filtro{font-size:10px!important;font-weight:500;letter-spacing:.1em!important;min-height:42px!important;padding:11px 14px!important;border-radius:0!important;border-color:transparent!important;border-right:1px solid var(--linea)!important;background:transparent!important}
    .filtro:first-child{border-left:1px solid var(--linea)!important}
    .filtro:hover{color:var(--teal-hondo)!important;background:rgba(15,95,95,.035)!important}
    .filtro[aria-pressed="true"]{color:#fff!important;background:var(--teal-hondo)!important;border-color:var(--teal-hondo)!important}
    .filtro .n{font-size:9px!important;margin-left:6px!important}
    .rt-advanced{gap:8px!important}
    .rt-advanced select{font-size:10px!important;letter-spacing:.055em!important;min-height:42px!important;border-radius:0!important;background:transparent!important;padding-top:10px!important;padding-bottom:10px!important}
    .buscador{min-height:42px!important;border-radius:0!important;background:transparent!important;padding:9px 12px!important}
    .buscador:focus-within{box-shadow:none!important;border-color:var(--teal)!important}
    .buscador-input{font-size:11px!important;letter-spacing:.025em!important}
    .conteo-busqueda{font-size:9px;letter-spacing:.13em;margin:14px 0 4px}

    .grupo-anio{grid-template-columns:clamp(66px,7vw,96px) 1fr;gap:clamp(28px,4.2vw,58px);padding:50px 0;border-top:1px solid var(--linea)}
    .grupo-anio:first-child{padding-top:34px}
    .anio-margen{top:92px}
    .anio-num{font-size:clamp(27px,3vw,38px);color:var(--tinta);font-style:normal;letter-spacing:-.025em}
    .anio-num::after{content:"";display:block;width:30px;height:1px;background:var(--ambar);margin-top:12px}
    .fila{position:relative;border-bottom:1px solid var(--linea)}
    .fila a.cabeza{grid-template-columns:minmax(0,1fr) 30px;padding:29px 0 25px;gap:20px}
    ol.lista-anio .fila:first-child a.cabeza{padding-top:0}
    .etiquetas{gap:9px 16px;margin-bottom:13px}
    .badge{font-size:9px!important;line-height:1.4!important;letter-spacing:.105em!important;padding:0 0 3px!important;border:0!important;border-bottom:1px solid rgba(15,95,95,.32)!important;border-radius:0!important;background:transparent!important}
    .badge.critica{color:var(--teal-hondo)!important}
    .badge.interna{color:var(--interna)!important;border-bottom-color:rgba(138,74,28,.4)!important}
    .fila-cuerpo h3{font-size:clamp(27px,2.45vw,34px);line-height:1.1;letter-spacing:-.022em;max-width:45ch;text-wrap:balance}
    .fila-cuerpo .fuente{font-size:10px;line-height:1.55;margin-top:11px;letter-spacing:.045em}
    .fila-flecha{font-size:25px;color:var(--teal-hondo);opacity:.55}
    .fila:hover .fila-flecha{transform:translateX(5px);opacity:1}
    .fila-pdf{display:flex;align-items:center;gap:17px;padding:0 0 22px;margin-top:-4px}
    .fila-pdf .btn-pdf,.rt-download-brief{font-size:9px!important;letter-spacing:.075em!important;padding:5px 0!important;min-height:28px!important;border:0!important;border-bottom:1px solid rgba(15,95,95,.3)!important;border-radius:0!important;background:transparent!important;color:var(--teal-hondo)!important}
    .fila-pdf .btn-pdf:hover,.rt-download-brief:hover{border-bottom-color:var(--teal)!important;color:var(--teal)!important}
    .adelanto-caja{max-width:78ch;padding:23px 0 27px;border:0;border-top:1px solid var(--linea);background:transparent}
    .adelanto-caja .obj{font-size:18px;line-height:1.55;margin-bottom:15px}
    .adelanto-caja .hallazgo{font-size:17px;line-height:1.58;padding-top:15px;border-top:1px solid rgba(221,216,204,.65)}
    .adelanto-caja .abrir{font-size:9px;letter-spacing:.1em;text-transform:uppercase}

    .rt-recommendations{margin-top:48px!important;padding:24px 0 28px!important;border-top:2px solid var(--tinta)!important;border-bottom:1px solid var(--linea)!important}
    .rt-rec-head strong{font-size:30px!important;letter-spacing:-.015em}
    .rt-recommendations li{padding-left:28px!important;padding-right:28px!important}
    .rt-recommendations li:first-child{padding-left:0!important}
    .rt-recommendations b{font-size:21px!important;line-height:1.12!important}

    .badge.subesp-mi{font-weight:500!important;box-shadow:none!important;background:transparent!important}
    .badge.subesp-mi[data-subspecialty="cardiologia"]{color:#8a3343!important;border-bottom-color:rgba(138,51,67,.5)!important}
    .badge.subesp-mi[data-subspecialty="infectologia"]{color:#087057!important;border-bottom-color:rgba(8,112,87,.5)!important}
    .badge.subesp-mi[data-subspecialty="neurologia"]{color:#38549a!important;border-bottom-color:rgba(56,84,154,.5)!important}
    .badge.subesp-mi[data-subspecialty="hematologia"]{color:#70427f!important;border-bottom-color:rgba(112,66,127,.48)!important}
    .badge.subesp-mi[data-subspecialty="neumologia"]{color:#176f7d!important;border-bottom-color:rgba(23,111,125,.5)!important}
    .badge.subesp-mi[data-subspecialty="reumatologia"]{color:#904269!important;border-bottom-color:rgba(144,66,105,.48)!important}
    .badge.subesp-mi[data-subspecialty="nefrologia"]{color:#475e9c!important;border-bottom-color:rgba(71,94,156,.48)!important}
    .badge.subesp-mi[data-subspecialty="endocrinologia"]{color:#9a541e!important;border-bottom-color:rgba(154,84,30,.5)!important}
    .badge.subesp-mi[data-subspecialty="gastroenterologia"]{color:#84640d!important;border-bottom-color:rgba(132,100,13,.5)!important}
    .badge.subesp-mi[data-subspecialty="medicina-interna-general"]{color:#704a2f!important;border-bottom-color:rgba(112,74,47,.46)!important}

    footer.sitio{margin-top:54px}
    footer.sitio .pie-bloque p{font-size:14.5px;line-height:1.7}
    .contacto-lista li{font-size:14px}

    @media(max-width:1120px){
      .envoltorio,.topbar-in{padding-left:clamp(28px,5vw,54px);padding-right:clamp(28px,5vw,54px)}
      header.sitio{padding-top:60px}
      h1.titulo{font-size:clamp(58px,9vw,94px)}
      .barra-meta{flex-wrap:wrap}
      .indice-cabecera{align-items:flex-start}
      .fila-cuerpo h3{max-width:none}
    }
    @media(max-width:760px){
      body{font-size:18px}
      body::before{height:2px}
      .envoltorio,.topbar-in{padding-left:20px;padding-right:20px}
      header.sitio{padding-top:48px;padding-bottom:42px}
      header.sitio::before{max-width:32ch;line-height:1.55}
      header.sitio::after{top:34px;width:38px}
      h1.titulo{font-size:clamp(52px,16vw,72px);margin-bottom:30px}
      .bajada .lead{font-size:23px}
      .bajada-cols{grid-template-columns:1fr;gap:18px;padding-top:22px}
      .bajada-cols p{font-size:17px}
      .barra-meta{margin-top:36px}
      .meta-dato{min-width:50%;margin:0;padding:16px 18px 17px 0;border-right:0;border-bottom:1px solid var(--linea)}
      .indice-cabecera{margin-top:52px;padding-top:14px}
      .filtros{width:100%;display:grid!important;grid-template-columns:repeat(3,1fr)}
      .filtro{padding:9px 7px!important;font-size:8.5px!important}
      .rt-advanced{width:100%!important}
      .rt-advanced select{flex:1!important;min-width:0!important;width:auto!important}
      .buscador{width:100%!important;min-width:100%!important}
      .grupo-anio{grid-template-columns:1fr;gap:20px;padding:38px 0}
      .anio-margen{position:static}
      .anio-num{font-size:28px}
      .anio-num::after{margin-top:9px}
      .fila a.cabeza{padding:25px 0 22px}
      .fila-cuerpo h3{font-size:27px}
      .fila-pdf{flex-wrap:wrap}
      .rt-recommendations ol{grid-template-columns:1fr!important}
      .rt-recommendations li,.rt-recommendations li:first-child{padding:18px 0!important;border-left:0!important;border-top:1px solid var(--linea)}
    }
    @media(max-width:440px){
      .envoltorio,.topbar-in{padding-left:17px;padding-right:17px}
      .meta-dato{min-width:100%}
      .filtro{letter-spacing:.055em!important}
      .fila-cuerpo h3{font-size:25px}
    }
  `;
  document.head.appendChild(style);
}

injectVisualTuning();
classifySubspecialties();
const index = document.getElementById('indice');
if (index) new MutationObserver(classifySubspecialties).observe(index, { childList: true, subtree: true });
