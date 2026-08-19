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
    const key = normalizeLabel(badge.textContent);
    badge.dataset.colorized = '1';
    badge.dataset.subspecialty = key;
  });
}

function injectVisualTuning() {
  if (document.getElementById('rt-home-visual-tuning')) return;
  const style = document.createElement('style');
  style.id = 'rt-home-visual-tuning';
  style.textContent = `
    /* Más aire lateral y una escala tipográfica de lectura más cómoda. */
    body{font-size:20px;line-height:1.64}
    .envoltorio{max-width:1400px;padding-left:clamp(40px,8vw,120px);padding-right:clamp(40px,8vw,120px)}
    .topbar-in{max-width:1400px;padding-left:clamp(40px,8vw,120px);padding-right:clamp(40px,8vw,120px)}

    header.sitio{padding-top:60px;padding-bottom:56px}
    h1.titulo{font-size:clamp(58px,8.6vw,112px);margin-bottom:34px}
    .bajada{font-size:22px;line-height:1.66}
    .bajada .lead{font-size:clamp(25px,2.45vw,31px);line-height:1.43;margin-bottom:38px}
    .bajada-cols{gap:clamp(38px,5vw,70px)}

    .barra-meta{margin-top:56px;padding-top:34px;gap:clamp(44px,6.5vw,82px)}
    .meta-num{font-size:40px}
    .meta-eti{font-size:12px;letter-spacing:.15em}

    .indice-cabecera{margin-top:64px;gap:24px}
    .filtros{gap:8px}
    .filtro{font-size:14px;font-weight:500;letter-spacing:.075em;padding:11px 18px;min-height:44px}
    .filtro .n{font-size:12.5px;margin-left:7px}
    .buscador{padding:11px 17px;min-width:min(350px,100%);min-height:44px}
    .buscador-input{font-size:14.5px}
    .conteo-busqueda{font-size:12px;margin-top:16px}

    .grupo-anio{grid-template-columns:clamp(82px,9vw,122px) 1fr;gap:clamp(28px,4.5vw,62px);padding:50px 0}
    .anio-num{font-size:clamp(30px,3.2vw,41px)}
    .fila a.cabeza{padding:32px 0;gap:28px}
    .etiquetas{gap:9px;margin-bottom:14px}
    .badge{font-size:11.5px;letter-spacing:.105em;padding:4px 10px;line-height:1.55}
    .fila-cuerpo h3{font-size:34px;line-height:1.17;max-width:47ch}
    .fila-cuerpo .fuente{font-size:13.5px;line-height:1.55;margin-top:12px}
    .fila-flecha{font-size:30px}
    .fila-pdf{padding-bottom:23px}
    .fila-pdf .btn-pdf,.rt-download-brief{font-size:12.5px!important;padding:9px 15px!important;min-height:40px!important}
    .adelanto-caja{padding:27px 32px;max-width:78ch}
    .adelanto-caja .obj{font-size:20px;line-height:1.55;margin-bottom:16px}
    .adelanto-caja .hallazgo{font-size:19px;line-height:1.58;padding-top:16px}
    .adelanto-caja .abrir{font-size:13px}

    footer.sitio .pie-bloque p{font-size:15.5px;line-height:1.72}
    .contacto-lista li{font-size:15px}

    /* Subespecialidades de Medicina Interna: color más visible, sin competir con el título. */
    .badge.subesp-mi{
      font-weight:500!important;
      border-width:1px!important;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);
    }
    .badge.subesp-mi[data-subspecialty="cardiologia"]{color:#8f2438!important;border-color:rgba(143,36,56,.55)!important;background:rgba(197,55,78,.14)!important}
    .badge.subesp-mi[data-subspecialty="infectologia"]{color:#087453!important;border-color:rgba(8,116,83,.55)!important;background:rgba(19,154,105,.14)!important}
    .badge.subesp-mi[data-subspecialty="neurologia"]{color:#304fa1!important;border-color:rgba(48,79,161,.55)!important;background:rgba(66,99,190,.14)!important}
    .badge.subesp-mi[data-subspecialty="hematologia"]{color:#713486!important;border-color:rgba(113,52,134,.52)!important;background:rgba(147,73,169,.14)!important}
    .badge.subesp-mi[data-subspecialty="neumologia"]{color:#087083!important;border-color:rgba(8,112,131,.55)!important;background:rgba(12,145,166,.14)!important}
    .badge.subesp-mi[data-subspecialty="reumatologia"]{color:#9b326b!important;border-color:rgba(155,50,107,.52)!important;background:rgba(190,65,130,.14)!important}
    .badge.subesp-mi[data-subspecialty="nefrologia"]{color:#4659a8!important;border-color:rgba(70,89,168,.52)!important;background:rgba(88,108,194,.14)!important}
    .badge.subesp-mi[data-subspecialty="endocrinologia"]{color:#a94e14!important;border-color:rgba(169,78,20,.52)!important;background:rgba(214,100,31,.14)!important}
    .badge.subesp-mi[data-subspecialty="gastroenterologia"]{color:#8a6508!important;border-color:rgba(138,101,8,.52)!important;background:rgba(190,143,20,.15)!important}
    .badge.subesp-mi[data-subspecialty="medicina-interna-general"]{color:#7d431c!important;border-color:rgba(125,67,28,.48)!important;background:rgba(166,92,39,.12)!important}

    @media(max-width:980px){
      body{font-size:19px}
      .envoltorio,.topbar-in{padding-left:clamp(28px,6vw,58px);padding-right:clamp(28px,6vw,58px)}
      .bajada{font-size:20.5px}
      .fila-cuerpo h3{font-size:30px;max-width:none}
      .fila-cuerpo .fuente{font-size:12.5px}
      .badge{font-size:10.5px}
    }

    @media(max-width:760px){
      body{font-size:18.5px}
      .envoltorio,.topbar-in{padding-left:22px;padding-right:22px}
      header.sitio{padding-top:46px;padding-bottom:44px}
      h1.titulo{font-size:clamp(48px,14vw,68px)}
      .bajada{font-size:19px}
      .bajada .lead{font-size:23px}
      .filtro{font-size:12.5px;padding:10px 13px}
      .buscador-input{font-size:13px}
      .fila-cuerpo h3{font-size:27px}
      .adelanto-caja .obj{font-size:18.5px}
      .adelanto-caja .hallazgo{font-size:17.5px}
    }

    @media(max-width:480px){
      .envoltorio,.topbar-in{padding-left:18px;padding-right:18px}
      .filtro{font-size:11.5px;letter-spacing:.055em}
      .fila-cuerpo h3{font-size:25px}
    }
  `;
  document.head.appendChild(style);
}

injectVisualTuning();
classifySubspecialties();

const index = document.getElementById('indice');
if (index) {
  new MutationObserver(classifySubspecialties).observe(index, { childList: true, subtree: true });
}
