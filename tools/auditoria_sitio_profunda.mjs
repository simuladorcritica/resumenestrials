import { chromium } from 'playwright';
import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const OUT = process.env.AUDIT_JSON || 'informe_sitio_profundo.json';
const PDF_MIN = 3000;
const findings = [];
const resources = new Set();

function add(severity, page, area, message, evidence = '') {
  findings.push({ severity, page: String(page), area, message, evidence: String(evidence).slice(0, 700) });
}

async function guardedGoto(page, url, label) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon/i.test(text) || /Failed to load resource.*429/i.test(text)) return;
    errors.push(`console: ${text}`);
  };
  const onPageError = (err) => errors.push(`pageerror: ${err.message || err}`);
  const onFailed = (req) => resources.add(`${label} :: ${req.url()} :: ${req.failure()?.errorText || 'requestfailed'}`);
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
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 25000 }),
    button.click(),
  ]);
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
  await page.waitForSelector('header.art h1', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(250);

  const title = (await page.locator('header.art h1').innerText().catch(() => '')).trim();
  const expected = String(record.titulo || '').replace(/<[^>]+>/g, '').trim();
  if (!title) add('CRÍTICO', label, 'render', 'título ausente');
  else if (title !== expected) add('ALTO', label, 'consistencia', 'título renderizado no coincide con resumenes.json', `${title} != ${expected}`);

  const body = await page.locator('article').innerText().catch(() => '');
  if (body.length < 250) add('ALTO', label, 'render', 'cuerpo largo ausente o demasiado corto');
  if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(await page.locator('body').innerText().catch(() => ''))) add('ALTO', label, 'render', 'texto de error/valor JavaScript visible');

  if (record.especialidad_principal === 'Medicina Interna' || record.especialidad_secundaria === 'Medicina Interna') {
    if (!(await page.locator('.badge.subesp-mi').count())) add('MEDIO', label, 'clasificación', 'Medicina Interna sin subespecialidad visible');
  }

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href').catch(() => null);
  const expectedCanonical = `https://resumenestrials.com/resumen.html?id=${id}`;
  if (canonical !== expectedCanonical) add('ALTO', label, 'SEO', 'canonical inesperado', `${canonical} != ${expectedCanonical}`);

  const structured = await page.locator('#structured-data').textContent().catch(() => '');
  try { JSON.parse(structured || '{}'); } catch (err) { add('ALTO', label, 'SEO', 'JSON-LD inválido', err.message); }

  const backText = await page.locator('.migas').innerText().catch(() => '');
  if (/Medicina (?:Crítica|Interna)/.test(backText)) add('MEDIO', label, 'UX', 'la especialidad reapareció junto a Volver al índice', backText);

  const fullVisible = await page.locator('[data-pdf-version="completo"]:visible').count();
  const briefVisibleOnFull = await page.locator('[data-pdf-version="breve"]:visible').count();
  if (!fullVisible) add('CRÍTICO', label, 'PDF/UX', 'la versión completa no muestra su botón de descarga');
  if (briefVisibleOnFull) add('ALTO', label, 'PDF/UX', 'la versión completa muestra indebidamente el botón de resumen breve');

  const fullText = await page.locator('[data-pdf-version="completo"]:visible').first().innerText().catch(() => '');
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
    await page.waitForSelector('article.corto', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(250);

    const shortBody = await page.locator('article.corto').innerText().catch(() => '');
    if (shortBody.length < 120) add('ALTO', shortLabel, 'render', 'versión breve ausente o demasiado corta');
    if ((record.especialidad_principal === 'Medicina Interna' || record.especialidad_secundaria === 'Medicina Interna') && !(await page.locator('.badge.subesp-mi').count())) add('MEDIO', shortLabel, 'clasificación', 'subespecialidad ausente en la versión breve');

    const briefVisible = await page.locator('[data-pdf-version="breve"]:visible').count();
    const fullVisibleOnBrief = await page.locator('[data-pdf-version="completo"]:visible').count();
    if (!briefVisible) add('ALTO', shortLabel, 'PDF/UX', 'la versión breve no muestra su botón de descarga');
    if (fullVisibleOnBrief) add('ALTO', shortLabel, 'PDF/UX', 'la versión breve muestra indebidamente el botón de resumen completo');

    const briefText = await page.locator('[data-pdf-version="breve"]:visible').first().innerText().catch(() => '');
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

  await guardedGoto(page, `${BASE}/index.html`, 'index');
  await page.waitForSelector('#indice .fila', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#rt-year', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);

  const cards = await page.locator('#indice .fila').count();
  if (cards !== data.length) add('ALTO', 'index', 'integridad', `la portada muestra ${cards} filas para ${data.length} registros`);

  const align = await page.evaluate(() => {
    const search = document.querySelector('.buscador');
    const year = document.querySelector('#rt-year');
    const journal = document.querySelector('#rt-journal');
    if (!search || !year || !journal) return null;
    const s = search.getBoundingClientRect(), y = year.getBoundingClientRect(), j = journal.getBoundingClientRect();
    return { searchTop: s.top, yearTop: y.top, journalTop: j.top, maxDelta: Math.max(Math.abs(s.top-y.top), Math.abs(s.top-j.top)) };
  });
  if (!align) add('ALTO', 'index', 'filtros', 'faltan buscador o filtros de año/revista');
  else if (align.maxDelta > 10) add('MEDIO', 'index', 'UX', 'buscador, año y revista no están en el mismo renglón en escritorio', JSON.stringify(align));

  const fullIndexText = await page.locator('.fila-pdf .btn-pdf:not(.rt-download-brief)').first().innerText().catch(() => '');
  if (!/Descargar resumen completo PDF/i.test(fullIndexText)) add('MEDIO', 'index', 'UX', 'los controles del índice no identifican claramente la descarga completa', fullIndexText);
  if (data.some((r) => r.corto)) {
    const briefIndexText = await page.locator('.fila-pdf .rt-download-brief').first().innerText().catch(() => '');
    if (!/Descargar resumen breve PDF/i.test(briefIndexText)) add('MEDIO', 'index', 'UX', 'los controles del índice no identifican claramente la descarga breve', briefIndexText);
  }

  const input = page.locator('.buscador-input');
  if (await input.count()) {
    const term = String(data[0].titulo || '').split(':')[0].trim();
    if (term) {
      await input.fill(term);
      await page.waitForTimeout(300);
      const visible = await page.locator('#indice .fila:visible').count();
      if (visible < 1) add('ALTO', 'index', 'buscador', `buscar '${term}' dejó cero resultados`);
      await input.fill('');
    }
  }
  await basicA11y(page, 'index');

  for (const route of ['privacidad.html', 'login.html', 'registro.html', 'recuperar.html']) {
    await guardedGoto(page, `${BASE}/${route}`, route);
    await basicA11y(page, route);
    if (route === 'privacidad.html') {
      const alignPrivacy = await page.locator('main p:not(.fecha)').first().evaluate((el) => getComputedStyle(el).textAlign).catch(() => '');
      if (alignPrivacy !== 'justify') add('MEDIO', route, 'UX/editorial', 'el texto principal del aviso de privacidad no está justificado', alignPrivacy);
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
