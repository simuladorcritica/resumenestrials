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

function buildEditorialPrelude() {
  const indexHead = document.querySelector('.indice-cabecera');
  if (!indexHead || document.querySelector('.rt-editorial-prelude')) return;
  const section = document.createElement('section');
  section.className = 'rt-editorial-prelude';
  section.setAttribute('aria-label', 'Cómo explorar la biblioteca');
  section.innerHTML = `
    <div class="rt-prelude-number">01—03</div>
    <div class="rt-prelude-copy">
      <span class="rt-kicker">Biblioteca clínica viva</span>
      <h2>Encuentra la evidencia por la pregunta que quieres resolver, no por el ruido del día.</h2>
    </div>
    <ol class="rt-prelude-steps">
      <li><b>Explora</b><span>Filtra por especialidad, año o revista.</span></li>
      <li><b>Interpreta</b><span>Abre el trial y recorre objetivo, diseño, resultados y aplicación.</span></li>
      <li><b>Conserva</b><span>Guarda lo importante en tu biblioteca personal.</span></li>
    </ol>`;
  indexHead.parentNode.insertBefore(section, indexHead);
}

function buildScrollProgress() {
  if (document.querySelector('.rt-scroll-progress')) return;
  const bar = document.createElement('div');
  bar.className = 'rt-scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const sync = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bar.style.setProperty('--rt-progress', `${Math.min(1, scrollY / max) * 100}%`);
  };
  addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync, { passive: true });
  sync();
}

function installSearchShortcut() {
  const input = document.querySelector('.buscador-input');
  if (!input || input.dataset.shortcutReady) return;
  input.dataset.shortcutReady = '1';
  addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    if (/INPUT|TEXTAREA|SELECT/.test(tag || '')) return;
    event.preventDefault();
    input.focus();
    input.select();
  });
  const search = input.closest('.buscador');
  if (search && !search.querySelector('.rt-search-key')) {
    const key = document.createElement('span');
    key.className = 'rt-search-key';
    key.textContent = '/';
    key.setAttribute('aria-hidden', 'true');
    search.appendChild(key);
  }
}

function injectVisualTuning() {
  if (document.getElementById('rt-home-visual-tuning')) return;
  const style = document.createElement('style');
  style.id = 'rt-home-visual-tuning';
  style.textContent = `
    :root{
      --rt-ink:#10253d;--rt-ink-soft:#496078;--rt-teal:#1c8a8a;--rt-teal-deep:#0d5f61;
      --rt-paper:#f5f2e9;--rt-paper-hi:#fcfaf4;--rt-paper-low:#e9e4d8;--rt-amber:#ca8b2c;
      --rt-line:rgba(16,37,61,.18);--rt-line-strong:rgba(16,37,61,.38);
    }
    html{background:var(--rt-paper)}
    body{font-size:19px!important;line-height:1.58!important;background:radial-gradient(circle at 90% 9%,rgba(28,138,138,.11),transparent 25rem),linear-gradient(90deg,transparent 0,transparent calc(50% - .5px),rgba(16,37,61,.035) 50%,transparent calc(50% + .5px)),var(--rt-paper)!important;color:var(--rt-ink)!important;overflow-x:hidden}
    body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;opacity:.22;background-image:radial-gradient(rgba(16,37,61,.18) .55px,transparent .55px);background-size:9px 9px;mask-image:linear-gradient(to bottom,#000,transparent 78%)}
    .envoltorio{max-width:1540px!important;padding-left:clamp(24px,5.4vw,96px)!important;padding-right:clamp(24px,5.4vw,96px)!important}
    .rt-scroll-progress{position:fixed;z-index:1000;left:0;top:0;width:100%;height:3px;pointer-events:none;background:linear-gradient(90deg,var(--rt-amber) var(--rt-progress,0%),transparent 0)}
    .topbar{background:rgba(245,242,233,.88)!important;backdrop-filter:blur(18px) saturate(1.08)!important;border-bottom:1px solid var(--rt-line)!important}
    .topbar-in{max-width:1540px!important;min-height:86px!important;padding:12px clamp(24px,5.4vw,96px)!important;gap:24px!important}
    .marca-top img{height:52px!important;max-width:min(330px,38vw)!important}.top-links{gap:5px!important}
    .top-links>a:not(.auth-entry){border:1px solid transparent!important;border-radius:50%!important;width:42px!important;height:42px!important}
    .top-links>a:not(.auth-entry):hover{background:var(--rt-paper-hi)!important;border-color:var(--rt-line)!important;transform:translateY(-1px)}
    .top-links .auth-entry{min-height:58px!important;padding:4px 20px!important;margin-right:10px!important;border:0!important;border-right:1px solid var(--rt-line)!important;background:transparent!important}
    .auth-entry-kicker{font-size:9px!important;letter-spacing:.18em!important;color:var(--rt-ink-soft)!important}.auth-entry-main{font:500 18px/1.05 'Fraunces',serif!important;color:var(--rt-teal-deep)!important;border:0!important}
    header.sitio{min-height:min(760px,78vh);display:grid!important;grid-template-columns:minmax(0,1.42fr) minmax(270px,.58fr)!important;grid-template-rows:auto 1fr auto;column-gap:clamp(42px,6vw,96px)!important;padding:clamp(54px,8vh,96px) 0 42px!important;border-bottom:1px solid var(--rt-line-strong)!important;position:relative}
    header.sitio::before{content:"EVIDENCIA / ENSAYOS CLÍNICOS / ESPAÑOL";grid-column:1/-1;align-self:start;font:500 10px/1 'IBM Plex Mono',monospace;letter-spacing:.2em;color:var(--rt-teal-deep);margin-bottom:36px}
    header.sitio::after{content:"RT";position:absolute;right:-.02em;top:.23em;font:500 clamp(180px,28vw,430px)/.78 'Fraunces',serif;letter-spacing:-.08em;color:rgba(15,95,95,.045);pointer-events:none;z-index:0}
    h1.titulo{grid-column:1;grid-row:2;align-self:center;position:relative;z-index:1;text-align:left!important;font-size:clamp(72px,10.4vw,164px)!important;line-height:.82!important;letter-spacing:-.058em!important;font-weight:500!important;margin:0!important;max-width:8ch!important}
    h1.titulo::after{content:".";color:var(--rt-amber)}
    .bajada{grid-column:2;grid-row:2;align-self:end;text-align:left!important;position:relative;z-index:2;padding:30px 0 6px 28px;border-left:1px solid var(--rt-line-strong);font-size:18px!important;color:var(--rt-ink-soft)!important}
    .bajada .lead{font:500 clamp(25px,2.1vw,33px)/1.22 'Fraunces',serif!important;text-align:left!important;margin:0 0 28px!important;color:var(--rt-ink)!important}.bajada-cols{display:grid!important;grid-template-columns:1fr!important;gap:16px!important;font-size:16px;line-height:1.5}.bajada-cols p+ p{padding-top:16px;border-top:1px solid var(--rt-line)}
    .barra-meta{grid-column:1/-1;grid-row:3;display:grid!important;grid-template-columns:repeat(3,1fr)!important;justify-content:stretch!important;gap:0!important;margin-top:54px!important;padding:0!important;border-top:1px solid var(--rt-line-strong)!important;border-bottom:1px solid var(--rt-line)!important}
    .meta-dato{display:grid!important;grid-template-columns:auto 1fr;align-items:baseline!important;gap:14px!important;padding:17px 22px!important;border-right:1px solid var(--rt-line)!important;text-align:left!important}.meta-dato:first-child{padding-left:0!important}.meta-dato:last-child{border-right:0!important}.meta-num{font:500 42px/1 'Fraunces',serif!important;color:var(--rt-ink)!important}.meta-eti{font:500 9px/1.3 'IBM Plex Mono',monospace!important;letter-spacing:.15em!important;margin:0!important;color:var(--rt-ink-soft)!important}
    .seo-hubs-home{max-width:1540px!important;margin:0 auto!important;padding:18px clamp(24px,5.4vw,96px)!important;border:0!important;border-bottom:1px solid var(--rt-line-strong)!important;display:grid!important;grid-template-columns:auto repeat(4,max-content) 1fr!important;gap:0!important;align-items:center!important;background:var(--rt-ink)!important;color:var(--rt-paper)!important}.seo-hubs-label{font:500 9px 'IBM Plex Mono',monospace!important;letter-spacing:.18em!important;color:#b8c4cc!important;margin-right:28px!important}.seo-hubs-home a{border:0!important;border-left:1px solid rgba(255,255,255,.16)!important;border-radius:0!important;background:transparent!important;color:#fff!important;padding:9px 20px!important;min-height:0!important;font:500 11px 'IBM Plex Mono',monospace!important;letter-spacing:.055em!important}.seo-hubs-home a:hover{background:rgba(255,255,255,.06)!important;color:#8bd1cf!important}
    .rt-editorial-prelude{display:grid;grid-template-columns:110px minmax(0,1.2fr) minmax(330px,.8fr);gap:clamp(24px,4vw,64px);align-items:start;margin:84px 0 36px;padding:34px 0 44px;border-top:5px solid var(--rt-ink);border-bottom:1px solid var(--rt-line-strong)}.rt-prelude-number{font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.16em;color:var(--rt-amber);padding-top:6px}.rt-kicker{display:block;font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--rt-teal-deep);margin-bottom:12px}.rt-prelude-copy h2{font:500 clamp(30px,3.3vw,48px)/1.04 'Fraunces',serif;letter-spacing:-.025em;max-width:18ch}.rt-prelude-steps{list-style:none;counter-reset:rtstep;display:grid;gap:0;border-top:1px solid var(--rt-line)}.rt-prelude-steps li{counter-increment:rtstep;display:grid;grid-template-columns:38px 86px 1fr;gap:12px;padding:13px 0;border-bottom:1px solid var(--rt-line);align-items:baseline}.rt-prelude-steps li::before{content:"0" counter(rtstep);font:500 9px 'IBM Plex Mono',monospace;color:var(--rt-amber)}.rt-prelude-steps b{font:500 16px 'Fraunces',serif}.rt-prelude-steps span{font-size:14px;color:var(--rt-ink-soft)}
    .indice-cabecera{position:sticky!important;top:85px!important;z-index:24!important;margin:0 0 8px!important;padding:16px 0!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(310px,.72fr)!important;gap:14px!important;align-items:stretch!important;background:linear-gradient(to bottom,rgba(245,242,233,.98),rgba(245,242,233,.94));border-bottom:1px solid var(--rt-line-strong)!important}.filtros{display:flex!important;align-items:stretch!important;gap:0!important;flex-wrap:wrap!important;border:1px solid var(--rt-line-strong)!important;background:rgba(252,250,244,.6)}.filtro{min-height:48px!important;border:0!important;border-right:1px solid var(--rt-line)!important;border-radius:0!important;padding:10px 16px!important;font-size:10px!important;letter-spacing:.11em!important;background:transparent!important;color:var(--rt-ink-soft)!important}.filtro:last-child{border-right:0!important}.filtro:hover{background:rgba(28,138,138,.065)!important;color:var(--rt-teal-deep)!important}.filtro[aria-pressed="true"]{background:var(--rt-ink)!important;color:#fff!important}.filtro .n{font-size:9px!important;color:inherit}.buscador{position:relative;min-height:50px!important;padding:0 46px 0 18px!important;background:var(--rt-paper-hi)!important;border:1px solid var(--rt-line-strong)!important;border-radius:0!important;box-shadow:none!important}.buscador:focus-within{border-color:var(--rt-teal-deep)!important;box-shadow:inset 0 -3px 0 var(--rt-teal)!important}.buscador-input{font:500 13px 'IBM Plex Mono',monospace!important;letter-spacing:.02em!important}.buscador-lupa{width:18px!important;height:18px!important}.rt-search-key{position:absolute;right:12px;top:50%;transform:translateY(-50%);border:1px solid var(--rt-line);padding:1px 7px;font:10px 'IBM Plex Mono',monospace;color:var(--rt-ink-soft);background:var(--rt-paper)}.conteo-busqueda{font-size:10px!important;letter-spacing:.15em!important;margin:12px 0 24px!important}
    .grupo-anio{display:grid!important;grid-template-columns:minmax(110px,15vw) minmax(0,1fr)!important;gap:clamp(28px,5vw,82px)!important;padding:64px 0!important;border-top:1px solid var(--rt-line-strong)!important;position:relative}.grupo-anio:first-child{padding-top:36px!important}.anio-margen{position:sticky!important;top:180px!important;align-self:start!important}.anio-num{font:500 clamp(54px,7vw,104px)/.82 'Fraunces',serif!important;font-style:normal!important;letter-spacing:-.055em!important;color:var(--rt-ink)!important}.anio-num::after{content:" / archivo";display:block;margin-top:13px;font:500 9px 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--rt-teal-deep)}ol.lista-anio{counter-reset:rtitem!important;border-top:5px solid var(--rt-ink)!important}.fila{counter-increment:rtitem;border-bottom:1px solid var(--rt-line-strong)!important;position:relative;transition:background .22s ease}.fila:hover,.fila:focus-within{background:rgba(252,250,244,.72)}.fila a.cabeza{display:grid!important;grid-template-columns:50px minmax(0,1fr) 38px!important;gap:18px!important;align-items:start!important;padding:28px 8px 20px 0!important}.fila a.cabeza::before{content:counter(rtitem,decimal-leading-zero);font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:var(--rt-amber);padding-top:8px}.fila-cuerpo{grid-column:2}.fila-flecha{grid-column:3;grid-row:1;align-self:center!important;font:400 30px 'Fraunces',serif!important;color:var(--rt-ink)!important}.etiquetas{gap:6px!important;margin-bottom:12px!important}.badge{border-radius:999px!important;font-size:9px!important;letter-spacing:.09em!important;padding:3px 8px!important;background:transparent!important}.fila-cuerpo h3{font:500 clamp(27px,3vw,43px)/1.03 'Fraunces',serif!important;letter-spacing:-.028em!important;max-width:30ch!important;color:var(--rt-ink)!important}.fila-cuerpo .fuente{font:500 10px/1.6 'IBM Plex Mono',monospace!important;letter-spacing:.055em!important;color:var(--rt-ink-soft)!important;margin-top:11px!important}.fila:hover h3{color:var(--rt-teal-deep)!important}.fila:hover .fila-flecha{transform:translateX(4px)!important;color:var(--rt-amber)!important}.fila-pdf{margin:0!important;padding:0 0 22px 68px!important;display:flex!important;gap:12px!important;flex-wrap:wrap!important}.fila-pdf .btn-pdf,.rt-download-brief{border:0!important;border-bottom:1px solid var(--rt-line-strong)!important;border-radius:0!important;background:transparent!important;color:var(--rt-teal-deep)!important;padding:6px 0!important;min-height:31px!important;font:500 9px 'IBM Plex Mono',monospace!important;letter-spacing:.08em!important;text-transform:uppercase!important}.fila-pdf .btn-pdf:hover,.rt-download-brief:hover{color:var(--rt-amber)!important;border-bottom-color:var(--rt-amber)!important;background:transparent!important}.adelanto{padding-left:68px!important}.adelanto-caja{margin:0 0 28px!important;padding:22px 24px!important;background:linear-gradient(135deg,rgba(15,95,95,.055),rgba(255,255,255,.4))!important;border:0!important;border-left:4px solid var(--rt-teal-deep)!important;border-radius:0!important;max-width:84ch!important;box-shadow:none!important}.adelanto-caja .obj{font:500 19px/1.45 'Newsreader',serif!important;color:var(--rt-ink)!important}.adelanto-caja .hallazgo{font-size:17px!important;line-height:1.5!important;color:var(--rt-ink-soft)!important;border-color:var(--rt-line)!important}.adelanto-caja .abrir{font-size:9px!important;letter-spacing:.13em!important}
    .rt-recommendations{margin:70px 0 30px!important;padding:0!important;border:0!important;border-top:5px solid var(--rt-ink)!important}.rt-rec-head{padding:20px 0 18px!important;margin:0!important;border-bottom:1px solid var(--rt-line-strong)!important}.rt-rec-head strong{font:500 36px 'Fraunces',serif!important}.rt-recommendations ol{gap:0!important;border-bottom:1px solid var(--rt-line-strong)!important}.rt-recommendations li{padding:24px!important;border-left:1px solid var(--rt-line)!important}.rt-recommendations li:first-child{padding-left:0!important}.rt-recommendations b{font:500 24px/1.08 'Fraunces',serif!important}.rt-recommendations small{font-size:9px!important;letter-spacing:.1em!important;text-transform:uppercase}
    footer.sitio{margin-top:90px!important;border-top:7px solid var(--rt-ink)!important;background:var(--rt-ink)!important;color:#dce5e8!important}footer.sitio .envoltorio{padding-top:58px!important;padding-bottom:50px!important}footer.sitio h4,footer.sitio a{color:#fff!important}.pie-bloque p,.contacto-lista li{color:#bdc9d0!important}
    .badge.subesp-mi{font-weight:500!important}.badge.subesp-mi[data-subspecialty="cardiologia"]{color:#8f2438!important;border-color:rgba(143,36,56,.55)!important}.badge.subesp-mi[data-subspecialty="infectologia"]{color:#087453!important;border-color:rgba(8,116,83,.55)!important}.badge.subesp-mi[data-subspecialty="neurologia"]{color:#304fa1!important;border-color:rgba(48,79,161,.55)!important}.badge.subesp-mi[data-subspecialty="hematologia"]{color:#713486!important;border-color:rgba(113,52,134,.52)!important}.badge.subesp-mi[data-subspecialty="neumologia"]{color:#087083!important;border-color:rgba(8,112,131,.55)!important}.badge.subesp-mi[data-subspecialty="reumatologia"]{color:#9b326b!important;border-color:rgba(155,50,107,.52)!important}.badge.subesp-mi[data-subspecialty="nefrologia"]{color:#4659a8!important;border-color:rgba(70,89,168,.52)!important}.badge.subesp-mi[data-subspecialty="endocrinologia"]{color:#a94e14!important;border-color:rgba(169,78,20,.52)!important}.badge.subesp-mi[data-subspecialty="gastroenterologia"]{color:#8a6508!important;border-color:rgba(138,101,8,.52)!important}
    @media(max-width:1080px){header.sitio{grid-template-columns:1fr!important;grid-template-rows:auto auto auto auto!important;min-height:auto!important}h1.titulo{grid-column:1;grid-row:2;max-width:8ch!important;margin:30px 0 56px!important}.bajada{grid-column:1;grid-row:3;max-width:760px;padding:0 0 0 26px!important}.barra-meta{grid-column:1;grid-row:4;margin-top:52px!important}.rt-editorial-prelude{grid-template-columns:90px 1fr}.rt-prelude-steps{grid-column:2}.indice-cabecera{grid-template-columns:1fr!important;top:84px!important}.buscador{order:-1}.grupo-anio{grid-template-columns:100px 1fr!important;gap:34px!important}.anio-num{font-size:62px!important}}
    @media(max-width:760px){body{font-size:18px!important;background:var(--rt-paper)!important}.envoltorio{padding-left:18px!important;padding-right:18px!important}.topbar-in{padding-left:16px!important;padding-right:16px!important;min-height:72px!important}.marca-top img{height:42px!important;max-width:180px!important}.top-links .auth-entry{border:0!important;margin:0!important;padding:0 7px!important;min-height:42px!important}.auth-entry-kicker{display:none!important}.auth-entry-main{font-size:13px!important}.top-links>a:not(.auth-entry){width:34px!important;height:34px!important}header.sitio{padding:42px 0 28px!important}header.sitio::before{font-size:8px!important;letter-spacing:.14em!important;margin-bottom:14px!important}h1.titulo{font-size:clamp(58px,20vw,88px)!important;margin:22px 0 40px!important;line-height:.84!important}.bajada{padding-left:18px!important}.bajada .lead{font-size:26px!important}.bajada-cols{font-size:15px!important}.barra-meta{grid-template-columns:1fr!important;border-bottom:0!important}.meta-dato,.meta-dato:first-child{padding:12px 0!important;border-right:0!important;border-bottom:1px solid var(--rt-line)!important}.meta-num{font-size:34px!important}.seo-hubs-home{grid-template-columns:1fr 1fr!important;padding:12px 16px!important}.seo-hubs-label{grid-column:1/-1;margin:0 0 8px!important}.seo-hubs-home a{padding:9px 8px!important;border-left:0!important;border-top:1px solid rgba(255,255,255,.12)!important}.rt-editorial-prelude{grid-template-columns:1fr!important;margin:56px 0 24px!important;padding:24px 0 30px!important}.rt-prelude-number{display:none}.rt-prelude-copy h2{font-size:35px!important;max-width:14ch}.rt-prelude-steps{grid-column:1}.rt-prelude-steps li{grid-template-columns:30px 75px 1fr!important;gap:8px!important}.indice-cabecera{position:relative!important;top:auto!important;padding:10px 0!important}.filtros{display:grid!important;grid-template-columns:1fr 1fr!important}.filtro{border-bottom:1px solid var(--rt-line)!important;text-align:left!important}.grupo-anio{grid-template-columns:1fr!important;gap:20px!important;padding:44px 0!important}.anio-margen{position:relative!important;top:auto!important}.anio-num{font-size:58px!important}.anio-num::after{display:inline-block!important;margin-left:10px!important}.fila a.cabeza{grid-template-columns:34px minmax(0,1fr) 24px!important;gap:10px!important;padding:22px 0 16px!important}.fila-cuerpo h3{font-size:28px!important;max-width:none!important}.fila-pdf,.adelanto{padding-left:44px!important}.adelanto-caja{padding:18px!important}.fila-pdf .btn-pdf,.rt-download-brief{font-size:8px!important}.rt-recommendations ol{grid-template-columns:1fr!important}.rt-recommendations li,.rt-recommendations li:first-child{padding:20px 0!important;border-left:0!important;border-top:1px solid var(--rt-line)!important}}
    @media(max-width:420px){.marca-top img{max-width:145px!important}.top-links>a:not(.auth-entry){display:none!important}.rt-prelude-copy h2{font-size:31px!important}.rt-prelude-steps li{grid-template-columns:26px 1fr!important}.rt-prelude-steps span{grid-column:2}.fila-cuerpo h3{font-size:25px!important}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}.rt-scroll-progress{display:none}}
  `;
  document.head.appendChild(style);
}

injectVisualTuning();
classifySubspecialties();
buildEditorialPrelude();
buildScrollProgress();
installSearchShortcut();

const index = document.getElementById('indice');
if (index) {
  new MutationObserver(() => {
    classifySubspecialties();
    installSearchShortcut();
  }).observe(index, { childList: true, subtree: true });
}
