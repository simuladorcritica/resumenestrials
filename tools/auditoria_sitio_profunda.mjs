import { chromium } from 'playwright';
import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installTurnstileTestRoutes } from '../scripts/turnstile-test-helpers.mjs';

const BASE = (process.env.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const OUT = process.env.AUDIT_JSON || 'informe_sitio_profundo.json';
const PDF_MIN = 3000;
const manifest=await fetch(BASE+'/seo-manifest.json').then(r=>r.json());
const findings = [];
const resources = new Set();
// Anuncios de Google (AdSense): sus marcos cargan google.com con una CSP propia en modo
// «report-only» y abortan pings al cerrar la página. Es ruido de terceros, no un fallo del sitio.
const AD_HOSTS = /(?:^|\.)(?:googlesyndication\.com|doubleclick\.net|googleadservices\.com|adservice\.google\.com|csp\.withgoogle\.com|fundingchoicesmessages\.google\.com)$/i;
const isAdNoise = (text) => /Framing 'https:\/\/www\.google\.com\/' violates the following report-only Content Security Policy/i.test(text);
const isAdRequest = (url) => { try { return AD_HOSTS.test(new URL(url).hostname); } catch { return false; } };

function add(severity, page, area, message, evidence = '') {
  findings.push({ severity, page: String(page), area, message, evidence: String(evidence).slice(0, 700) });
}

async function guardedGoto(page, url, label) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon/i.test(text) || /Failed to load resource.*429/i.test(text) || isAdNoise(text)) return;
    errors.push(`console: ${text}`);
  };
  const onPageError = (err) => errors.push(`pageerror: ${err.message || err}`);
  const onFailed = (req) => isAdRequest(req.url()) || resources.add(`${label} :: ${req.url()} :: ${req.failure()?.errorText || 'requestfailed'}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onFailed);
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch((err) => {
    errors.push(`navigation: ${err.message}`);
    return null;
  });
  if (response && response.status() >= 400) errors.push(`HTTP ${response.status()}`);
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('requestfailed', onFailed);
  errors.forEach((e) => add('ALTO', label, 'carga/JavaScript', e));
  return response;
}

async function basicA11y(page, label) {
  const result = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean);
    const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    const images = [...document.images].filter((img) => !img.hasAttribute('alt')).map((img) => img.src);
    const unlabeled = [...document.querySelectorAll('input,select,textarea')].filter((el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
      return !el.closest('label');
    }).map((el) => `${el.tagName.toLowerCase()}#${el.id || ''}`);
    return { dup, images, unlabeled, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  if (result.dup.length) add('ALTO', label, 'accesibilidad', 'IDs HTML duplicados', result.dup.join(', '));
  if (result.images.length) add('MEDIO', label, 'accesibilidad', 'imágenes sin atributo alt', result.images.join(' | '));
  if (result.unlabeled.length) add('MEDIO', label, 'accesibilidad', 'controles sin label/aria-label', result.unlabeled.join(', '));
  if (result.overflow > 3) add('ALTO', label, 'responsive', `overflow horizontal de ${result.overflow}px`);
}

async function downloadPDF(page, selector, filename) {
  const button = page.locator(selector).filter({ visible: true }).first();
  if (!(await button.count())) throw new Error(`no existe un control visible ${selector}`);
  // The reader opens one PDF panel; the current version is preselected.
  await button.click();
  const go = page.locator('#ev-pdf-dialog [data-ev-pdf-go][data-format="a4"]');
  await go.waitFor({ state: 'visible', timeout: 10000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 25000 }),
    go.click(),
  ]);
  await page.keyboard.press('Escape').catch(() => {});
  const dir = mkdtempSync(join(tmpdir(), 'rt-audit-'));
  const target = join(dir, filename);
  await download.saveAs(target);
  return { target, size: statSync(target).size };
}

function extractPdfText(target) {
  try {
    return execFileSync('pdftotext', ['-layout', target, '-'], { encoding: 'utf8', timeout: 15000 });
  } catch (err) {
    add('MEDIO', 'PDF', 'auditoría', 'no fue posible extraer texto del PDF con pdftotext', err.message);
    return '';
  }
}

function checkPdf(result, label) {
  if (result.size < PDF_MIN) add('ALTO', label, 'PDF', `PDF sospechosamente pequeño: ${result.size} bytes`);
  const text = extractPdfText(result.target);
  if (!text) return;
  const normalized = text.replace(/\s+/g, ' ');
  for (const token of ['resumenestrials.com', '@resumenestrials', '@ResumenesTrials', 'resumenestrials@outlook.com']) {
    if (!normalized.includes(token)) add('ALTO', label, 'PDF', `el PDF descargado no muestra '${token}'`);
  }
}

async function checkArticle(page, record) {
  const id = record.id;
  const label = `resumen ${id}`;
  await guardedGoto(page, `${BASE}/resumen.html?id=${encodeURIComponent(id)}`, label);
  await page.waitForSelector('.ev-reading-head h1', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(250);

  const title = (await page.locator('.ev-reading-head h1').innerText().catch(() => '')).trim();
  const expected = String(record.titulo || '').replace(/<[^>]+>/g, '').trim();
  if (!title) add('CRÍTICO', label, 'render', 'título ausente');
  else if (title !== expected) add('ALTO', label, 'consistencia', 'título renderizado no coincide con resumenes.json', `${title} != ${expected}`);

  const body = await page.locator('article').first().innerText().catch(() => '');
  if (body.length < 250) add('ALTO', label, 'render', 'cuerpo largo ausente o demasiado corto');
  if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(await page.locator('body').innerText().catch(() => ''))) add('ALTO', label, 'render', 'texto de error/valor JavaScript visible');

  // Decisión editorial (2026-10-26): si Medicina Interna es solo la especialidad secundaria y no
  // hay subtema aplicable, el resumen se queda sin subtema. Solo se exige con Interna como principal.
  if (record.especialidad_principal === 'Medicina Interna') {
    if (!(await page.locator('[data-ev-subspecialty]').count())) add('MEDIO', label, 'clasificación', 'Medicina Interna sin subespecialidad visible');
  }

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => null);
  const expectedCanonical = `https://resumenestrials.com${manifest[String(id)].path}`;
  if (canonical !== expectedCanonical) add('ALTO', label, 'SEO', 'canonical inesperado', `${canonical} != ${expectedCanonical}`);

  const structured = await page.locator('#structured-data').textContent().catch(() => '');
  try { JSON.parse(structured || '{}'); } catch (err) { add('ALTO', label, 'SEO', 'JSON-LD inválido', err.message); }

  const backText = await page.locator('.ev-breadcrumb').innerText().catch(() => '');
  if (/Medicina (?:Crítica|Interna)/.test(backText)) add('MEDIO', label, 'UX', 'la especialidad reapareció junto a Volver al índice', backText);

  const fullVisible = await page.locator('[data-pdf-version="completo"]:visible').count();
  const briefVisibleOnFull = await page.locator('[data-pdf-version="breve"]:visible').count();
  if (!fullVisible) add('CRÍTICO', label, 'PDF/UX', 'la versión completa no muestra su botón de descarga');
  if (briefVisibleOnFull) add('ALTO', label, 'PDF/UX', 'la versión completa muestra indebidamente el botón de resumen breve');

  const fullText = await page.locator('[data-pdf-version="completo"]:visible').first().getAttribute('aria-label').catch(() => '');
  if (fullVisible && !/Descargar resumen completo PDF/i.test(fullText)) add('MEDIO', label, 'UX', 'etiqueta del botón completo poco identificable', fullText);

  try {
    const pdf = await downloadPDF(page, '[data-pdf-version="completo"]', `id-${id}-completo.pdf`);
    checkPdf(pdf, `${label} PDF completo`);
  } catch (err) {
    add('CRÍTICO', label, 'PDF', 'no fue posible descargar PDF completo', err.message);
  }

  await basicA11y(page, label);

  if (record.corto) {
    const shortLabel = `${label} breve`;
    await guardedGoto(page, `${BASE}/resumen.html?id=${encodeURIComponent(id)}&v=corto`, shortLabel);
    await page.waitForSelector('article.ev-body', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(250);

    const shortBody = await page.locator('article.ev-body').innerText().catch(() => '');
    if (shortBody.length < 120) add('ALTO', shortLabel, 'render', 'versión breve ausente o demasiado corta');
    if (record.especialidad_principal === 'Medicina Interna' && !(await page.locator('[data-ev-subspecialty]').count())) add('MEDIO', shortLabel, 'clasificación', 'subespecialidad ausente en la versión breve');

    const briefVisible = await page.locator('[data-pdf-version="breve"]:visible').count();
    const fullVisibleOnBrief = await page.locator('[data-pdf-version="completo"]:visible').count();
    if (!briefVisible) add('ALTO', shortLabel, 'PDF/UX', 'la versión breve no muestra su botón de descarga');
    if (fullVisibleOnBrief) add('ALTO', shortLabel, 'PDF/UX', 'la versión breve muestra indebidamente el botón de resumen completo');

    const briefText = await page.locator('[data-pdf-version="breve"]:visible').first().getAttribute('aria-label').catch(() => '');
    if (briefVisible && !/Descargar resumen breve PDF/i.test(briefText)) add('MEDIO', shortLabel, 'UX', 'etiqueta del botón breve poco identificable', briefText);

    try {
      const pdf = await downloadPDF(page, '[data-pdf-version="breve"]', `id-${id}-breve.pdf`);
      checkPdf(pdf, `${label} PDF breve`);
    } catch (err) {
      add('ALTO', shortLabel, 'PDF', 'no fue posible descargar PDF breve', err.message);
    }

    await basicA11y(page, shortLabel);
  }
}

async function main() {
  const dataResp = await fetch(`${BASE}/resumenes.json`);
  if (!dataResp.ok) throw new Error(`No se pudo cargar resumenes.json: HTTP ${dataResp.status}`);
  const data = await dataResp.json();
  if (!Array.isArray(data) || !data.length) throw new Error('resumenes.json vacío o inválido');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  // En local (CI y revisión nocturna) Cloudflare rechaza el dominio con el error 110200:
  // se usa la clave de prueba oficial de Turnstile, igual que en las demás suites.
  if (['localhost', '127.0.0.1', '::1'].includes(new URL(BASE).hostname)) await installTurnstileTestRoutes(page, BASE);

  await guardedGoto(page, `${BASE}/index.html`, 'index');
  await page.waitForSelector('#ev-list>.ev-card', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#ev-year', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);

  const cards = await page.locator('#ev-list>.ev-card').count();
  if (cards !== data.length) add('ALTO', 'index', 'integridad', `la portada muestra ${cards} filas para ${data.length} registros`);

  const align = await page.evaluate(() => ({
    searches: document.querySelectorAll('input[type=search]').length,
    searchVisible: Boolean(document.querySelector('.ev-header #ev-q')?.getClientRects().length),
    year: Boolean(document.querySelector('#ev-year')),
    journal: Boolean(document.querySelector('#ev-journal')),
  }));
  if (!align.year || !align.journal) add('ALTO', 'index', 'filtros', 'faltan filtros de año/revista');
  if (align.searches !== 1 || !align.searchVisible) add('MEDIO', 'index', 'UX', 'el sitio debe mostrar un único buscador visible en la cabecera', JSON.stringify(align));

  const fullIndexText=await page.locator('[data-ev-card-pdf]').first().getAttribute('aria-label').catch(()=>'');
  if(!/Descargar resumen completo PDF/i.test(fullIndexText))add('MEDIO','index','UX','PDF completo no identificado',fullIndexText);
  // Brief reading and its download are checked for every record below.
  const input = page.locator('#ev-q');
  if (await input.count()) {
    const term = String(data[0].titulo || '').split(':')[0].trim();
    if (term) {
      await input.fill(term);
      await page.waitForTimeout(300);
      const visible = await page.locator('#ev-list>.ev-card:visible').count();
      if (visible < 1) add('ALTO', 'index', 'buscador', `buscar '${term}' dejó cero resultados`);
      await input.fill('');
    }
  }
  await basicA11y(page, 'index');

  for (const route of ['privacidad/', 'terminos/', 'login.html', 'registro.html', 'recuperar.html']) {
    await guardedGoto(page, `${BASE}/${route}`, route);
    await basicA11y(page, route);
    if (route === 'privacidad/') {
      const alignPrivacy = await page.locator('main p:not(.fecha)').first().evaluate((el) => getComputedStyle(el).textAlign).catch(() => '');
      if (!['left','start','justify'].includes(alignPrivacy)) add('MEDIO', route, 'UX/editorial', 'alineación del texto de privacidad no legible', alignPrivacy);
    }
  }

  for (const route of ['robots.txt', 'sitemap.xml']) {
    const resp = await fetch(`${BASE}/${route}`).catch(() => null);
    if (!resp || !resp.ok) add('ALTO', route, 'SEO', `no accesible${resp ? `: HTTP ${resp.status}` : ''}`);
  }

  for (const record of data) await checkArticle(page, record);
  for (const item of resources) add('MEDIO', 'recurso', 'red', 'recurso que no pudo cargarse', item);

  await browser.close();

  const counts = findings.reduce((acc, item) => { acc[item.severity] = (acc[item.severity] || 0) + 1; return acc; }, {});
  const report = {
    timestamp: new Date().toISOString(),
    base_url: BASE,
    articles_checked: data.length,
    counts,
    findings,
    integrity_statement: 'La auditoría no modificó ningún resumen ni dato científico.',
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log('='.repeat(72));
  console.log('AUDITORÍA PROFUNDA DE SITIO — RESÚMENES TRIALS');
  console.log(`Artículos: ${data.length} | Hallazgos: ${findings.length}`);
  console.log(Object.entries(counts).map(([k,v]) => `${k}: ${v}`).join(' | ') || 'Sin hallazgos');
  console.log('='.repeat(72));
  findings.forEach((f) => console.log(`[${f.severity}] ${f.page} · ${f.area}: ${f.message}${f.evidence ? ` — ${f.evidence}` : ''}`));
  console.log('\nLa auditoría no modificó ningún resumen ni dato científico.');

  process.exit(findings.some((f) => ['CRÍTICO', 'ALTO'].includes(f.severity)) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
