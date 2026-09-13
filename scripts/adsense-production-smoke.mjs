const BASE = (process.env.RT_BASE_URL || 'https://resumenestrials.com').replace(/\/$/, '');
const ADSENSE_CLIENT = 'ca-pub-3132744538918477';
const ADSENSE_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
const ADS_TXT_RECORD = 'google.com, pub-3132744538918477, DIRECT, f08c47fec0942fa0';
const EXCLUDED_PATHS = [
  '/login.html', '/registro.html', '/recuperar.html', '/cuenta.html', '/biblioteca.html',
  '/privacidad/', '/privacidad/index.html', '/privacidad.html', '/terminos/', '/terminos/index.html',
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function fetchText(path) {
  const joiner = path.includes('?') ? '&' : '?';
  const response = await fetch(`${BASE}${path}${joiner}adsense_qa=${Date.now()}`, {
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': 'Resumenes-Trials-AdSense-QA/1.0',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

function assertAdsenseHtml(path, html, allowed = true) {
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)].map(match => match[0]);
  const loaders = scripts.filter(script => /adsbygoogle\.js/i.test(script));
  if (!allowed) {
    assert(loaders.length === 0 && !html.includes('adsbygoogle') && !html.includes(ADSENSE_CLIENT), `${path}: AdSense está prohibido en esta ruta`);
    return;
  }
  assert(loaders.length === 1 && loaders[0].includes(ADSENSE_URL), `${path}: loader AdSense ausente, duplicado o publisher incorrecto`);
  assert(/crossorigin=["']anonymous["']/.test(loaders[0]), `${path}: falta crossorigin en el loader AdSense`);
  const count = html.split(ADSENSE_URL).length - 1;
  assert(count === 1, `${path}: se esperaba un único script de AdSense y se encontraron ${count}`);
  const headEnd = html.toLowerCase().indexOf('</head>');
  const scriptPos = html.indexOf(ADSENSE_URL);
  assert(headEnd >= 0, `${path}: no contiene </head>`);
  assert(scriptPos >= 0 && scriptPos < headEnd, `${path}: el script de AdSense no está dentro de <head>`);
  assert(html.includes('crossorigin="anonymous"'), `${path}: falta crossorigin="anonymous" en la integración de AdSense`);
}

function assertPrivacyUpdated(home, privacy) {
  assert(home.includes('Google AdSense'), 'Portada: el aviso de privacidad todavía no informa sobre Google AdSense');
  assert(!home.includes('no utiliza cookies de seguimiento o publicidad'), 'Portada: persiste la declaración antigua de que no hay cookies de publicidad');
  assert(privacy.includes('Google AdSense'), 'Aviso de privacidad: falta informar sobre Google AdSense');
  assert(privacy.includes('Cookies, almacenamiento local y publicidad'), 'Política de Privacidad: falta la sección actualizada de cookies y publicidad');
  assert(!privacy.includes('no utiliza cookies de publicidad'), 'Aviso de privacidad: persiste la declaración antigua de que no hay cookies de publicidad');
}

async function waitForAdsenseDeployment() {
  let last = '';
  for (let attempt = 1; attempt <= 32; attempt++) {
    try {
      const [home, adsTxt, privacy] = await Promise.all([
        fetchText('/'),
        fetchText('/ads.txt'),
        fetchText('/privacidad/'),
      ]);
      const count = home.split(ADSENSE_URL).length - 1;
      const adsOk = adsTxt.trim() === ADS_TXT_RECORD;
      const privacyOk = home.includes('Google AdSense') && privacy.includes('Google AdSense') && privacy.includes('Cookies, almacenamiento local y publicidad');
      if (count === 1 && adsOk && privacyOk) {
        assertAdsenseHtml('/', home);
        // Wait for exclusions too: a previously deployed home already has ads.
        for (const path of EXCLUDED_PATHS) assertAdsenseHtml(path, await fetchText(path), false);
        assertPrivacyUpdated(home, privacy);
        console.log(`ADSENSE DEPLOYMENT READY · intento ${attempt}`);
        return;
      }
      last = `script-home=${count}, ads.txt=${adsOk ? 'ok' : 'pendiente'}, privacidad=${privacyOk ? 'ok' : 'pendiente'}`;
    } catch (error) {
      last = error.message;
    }
    console.log(`Esperando despliegue de AdSense (${attempt}/32) · ${last}`);
    await sleep(15000);
  }
  throw new Error(`La integración de AdSense no se propagó a producción: ${last}`);
}

await waitForAdsenseDeployment();

const [dataText, manifestText, adsTxt, homeHtml, privacyHtml] = await Promise.all([
  fetchText('/resumenes.json'),
  fetchText('/seo-manifest.json'),
  fetchText('/ads.txt'),
  fetchText('/'),
  fetchText('/privacidad/'),
]);
assert(adsTxt.trim() === ADS_TXT_RECORD, `ads.txt incorrecto: ${adsTxt.trim()}`);
assertPrivacyUpdated(homeHtml, privacyHtml);

const data = JSON.parse(dataText);
const manifest = JSON.parse(manifestText);
assert(Array.isArray(data) && data.length > 0, 'No hay resúmenes para validar AdSense');
const sample = data.find(item => item.corto) || data[0];
const entry = manifest[String(sample.id)];
assert(entry?.path, `No existe ruta canónica para el resumen ${sample.id}`);
const prague = data.find(item => /PRAGUE-26/i.test(item.titulo || ''));
assert(prague && manifest[String(prague.id)]?.path, 'Falta el control editorial PRAGUE-26');

const paths = [
  '/',
  entry.path,
  `/resumen.html?id=${sample.id}`,
  '/medicina-critica/',
  '/medicina-interna/',
  '/metodologia/',
  '/equipo-editorial/',
  manifest[String(prague.id)].path,
];
if (sample.corto) paths.splice(3, 0, `/resumen.html?id=${sample.id}&v=corto`);

for (const path of paths) {
  const html = await fetchText(path);
  assertAdsenseHtml(path, html);
}
for (const path of EXCLUDED_PATHS) assertAdsenseHtml(path, await fetchText(path), false);

console.log(`ADSENSE PRODUCTION PASS · ${paths.length} controles editoriales con 1 script · ${EXCLUDED_PATHS.length} rutas excluidas con 0 scripts · ${ADSENSE_CLIENT} · ads.txt válido · privacidad actualizada`);
