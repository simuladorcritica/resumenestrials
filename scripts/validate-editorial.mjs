import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { console.error(`EDITORIAL FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`EDITORIAL PASS: ${message}`);

const homeAuth = read('home-auth-ui.js');
const interactive = read('interactive-home.js');
const internalMedicineUx = read('internal-medicine-ux.js');
const homeVisualTuning = read('home-visual-tuning.js');
const homeControlLayout = read('home-control-layout.js');
const memberDesign = read('member-design-v3.js');
const trialCss = read('trial.css');
const semanticCss = read('seo-semantic.css');
const index = read('index.html');
const privacy = read('privacidad.html');
const account = read('cuenta.html');
const auth = read('auth.js');
const login = read('login.html');
const register = read('registro.html');
const recovery = read('recuperar.html');

if (!homeAuth.includes('id = "account-entry"')) fail('La portada no define el módulo único de cuenta.');
else ok('Módulo único de cuenta presente.');

if (homeAuth.includes('cuenta-link') || homeAuth.includes('login-link')) fail('Persisten identificadores de CTA separados en la cabecera.');
else ok('No existen CTA separados de Crear cuenta / Entrar en la portada.');

if (!interactive.includes("header.insertBefore(div, search)")) fail('Los filtros avanzados no están integrados dentro de la cabecera del índice.');
else ok('Filtros avanzados integrados en la barra del índice.');

for (const [name, html] of [['cuenta.html', account], ['login.html', login], ['registro.html', register]]) {
  if (/box-shadow\s*:\s*0\s+18px\s+55px/i.test(html)) fail(`${name} conserva la sombra flotante anterior.`);
  else ok(`${name} sin la sombra flotante del diseño anterior.`);
}

const registrationLinks = (login.match(/href="registro\.html"/g) || []).length;
if (registrationLinks !== 1) fail(`login.html debe tener una sola ruta visible a registro; encontradas ${registrationLinks}.`);
else ok('Login con una sola ruta a creación de cuenta.');

for (const [name, html] of [['cuenta.html', account], ['login.html', login], ['registro.html', register], ['recuperar.html', recovery]]) {
  if (!html.includes('Fraunces') || !html.includes('Newsreader') || !html.includes('IBM+Plex+Mono')) fail(`${name} no conserva las tres familias tipográficas del sistema.`);
  else ok(`${name} conserva Fraunces, Newsreader e IBM Plex Mono.`);
}

if (!auth.includes('getAccountPreferences') || !auth.includes('updateAccountPreferences')) fail('auth.js no expone el contrato de preferencias de cuenta.');
else ok('Contrato de preferencias disponible en auth.js.');

const accountContracts = [
  ['actualización de perfil', /updateProfile\(\{firstName:/],
  ['consentimiento del perfil', /newsletterOptIn:/],
  ['lectura del consentimiento vigente', /notifMaster'\)\.checked=!!profile\?\.newsletter_opt_in/],
  ['lectura de preferencias', /saved\.preferences\s*\|\|\s*\{\}/],
  ['alta y baja de avisos mediante updateProfile', /newsletterOptIn:\$\('notifMaster'\)\.checked/],
  ['escritura de preferencias', /updateAccountPreferences\(\{\s*preferences\s*:/]
];
for (const [label, pattern] of accountContracts) {
  if (!pattern.test(account)) fail(`cuenta.html no respeta el contrato actual de auth.js: falta ${label}.`);
}

const obsoleteAccountFragments = ['notifications_enabled', 'notify_critical_care', 'notify_internal_medicine', 'sort_preference'];
for (const fragment of obsoleteAccountFragments) {
  if (account.includes(fragment)) fail(`cuenta.html usa una clave obsoleta no soportada por auth.js: ${fragment}`);
}
if (!process.exitCode) ok('Cuenta y auth.js comparten el mismo contrato de perfil, avisos y preferencias.');

if (!index.includes('internal-medicine-ux.js')) fail('index.html no carga la capa de subespecialidad y descargas.');
else ok('Portada carga la capa de subespecialidad y descargas.');

const uxFragments = [
  "const MI = 'Medicina Interna'",
  'CURRENT_SUBSPECIALTIES',
  "'Cardiología'",
  "'Infectología'",
  "'Neurología'",
  "'Hematología'",
  "'Neumología'",
  'rt-download-brief',
  'generateBriefPDF',
  "full.textContent = '⬇ Resumen completo'"
];
for (const fragment of uxFragments) {
  if (!internalMedicineUx.includes(fragment)) fail(`internal-medicine-ux.js incompleto: falta ${fragment}`);
}

if (!index.includes('home-visual-tuning.js')) fail('index.html no carga el sistema visual principal de portada.');
else ok('Portada carga el sistema visual editorial 2026.');

const visualFragments = [
  '--rt-paper:#f5f2e9',
  'rt-editorial-prelude',
  'rt-scroll-progress',
  'grid-template-columns:minmax(0,1.42fr)',
  'counter-reset:rtitem',
  '.fila-cuerpo h3{font:500 clamp(27px,3vw,43px)',
  'data-subspecialty="cardiologia"',
  'data-subspecialty="infectologia"',
  'data-subspecialty="neurologia"',
  'data-subspecialty="hematologia"',
  'data-subspecialty="neumologia"'
];
for (const fragment of visualFragments) {
  if (!homeVisualTuning.includes(fragment)) fail(`home-visual-tuning.js incompleto: falta ${fragment}`);
}
if (!homeControlLayout.includes('overflow-x:clip')) fail('La portada no contiene el cierre de desbordamiento horizontal del nuevo lienzo editorial.');
else ok('Lienzo editorial protegido contra desbordamiento horizontal.');

const memberFragments = [
  'data-rt-member-design="v4"',
  'CUADERNO PERSONAL',
  'ARCHIVO PERSONAL / EVIDENCIA GUARDADA',
  'MEMBERS / RT',
  '.mail-note',
  'background:#10253d!important'
];
for (const fragment of memberFragments) {
  if (!memberDesign.includes(fragment)) fail(`member-design-v3.js incompleto: falta ${fragment}`);
}
if (!process.exitCode) ok('Acceso, registro, cuenta y biblioteca comparten el nuevo sistema editorial.');

const trialFragments = [
  'ATLAS DE EVIDENCIA',
  'counter-reset:rtsection',
  'FUENTE PRIMARIA',
  'grid-template-columns:repeat(3,minmax(0,1fr))',
  '--papel:#f5f2e9'
];
for (const fragment of trialFragments) {
  if (!trialCss.includes(fragment)) fail(`trial.css incompleto: falta ${fragment}`);
}
if (!semanticCss.includes('.cluster-card:hover{background:var(--tinta);color:#fff}')) fail('seo-semantic.css no conserva el comportamiento editorial del atlas de clusters.');
else ok('Trials, categorías y clusters comparten el atlas editorial clínico.');

if (!privacy.includes('max-width:68ch') || !privacy.includes('text-align:left') || !privacy.includes('LEGAL / PRIVACIDAD')) {
  fail('El aviso de privacidad no respeta la nueva medida de lectura editorial de pantalla.');
} else ok('Aviso de privacidad con medida de lectura controlada y composición editorial propia.');

if (process.exitCode) process.exit(process.exitCode);
console.log('Editorial architecture PASS');
