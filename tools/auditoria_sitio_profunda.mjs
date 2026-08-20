import { chromium } from 'playwright';
import { mkdtempSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const OUT = process.env.AUDIT_JSON || 'informe_sitio_profundo.json';
const PDF_MIN = 3000;
const findings = [];
const resources = new Set();
const LOCAL_QA = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(BASE);
const EXPECTED_LOCAL_THIRD_PARTY = /(?:challenges\.cloudflare\.com|turnstile|supabase\.co|fonts\.googleapis\.com|fonts\.gstatic\.com)/i;

function add(severity, page, area, message, evidence = '') {
  findings.push({ severity, page: String(page), area, message, evidence: String(evidence).slice(0, 500) });
}

function expectedLocalThirdPartyNoise(text) {
  return LOCAL_QA && EXPECTED_LOCAL_THIRD_PARTY.test(String(text || ''));
}

async function guardedGoto(page, url, label) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon/i.test(text) || expectedLocalThirdPartyNoise(text)) return;
    errors.push(`console: ${text}`);
  };
  const onPageError = (err) => {
    const text = err.message || String(err);
    if (!expectedLocalThirdPartyNoise(text)) errors.push(`pageerror: ${text}`);
  };
  const onFailed = (req) => {
    const urlFailed = req.url();
    if (expectedLocalThirdPartyNoise(urlFailed)) return;
    resources.add(`${label} :: ${urlFailed} :: ${req.failure()?.errorText || 'requestfailed'}`);
  };
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

async function duplicateDownload(page, selector, filename) {
  const button = page.locator(selector).first();
  if (!(await button.count())) throw new Error(`no existe ${selector}`);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 25000 }),
    button.click(),
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'rt-audit-'));
  const target = join(dir, filename);
  await download.saveAs(target);
  const size = statSync(target).size;
  const raw = readFileSync(target).toString('latin1');
  return { size, raw };
}

function checkPdf(result, label) {
  if (result.size < PDF_MIN) add('ALTO', label, 'PDF', `PDF sospechosamente pequeño: ${result.size} bytes`);
  // El escaneo binario es una comprobación secundaria: jsPDF puede comprimir/codificar
  // cadenas aunque el pie sea visible. Por eso una ausencia aquí es MEDIO, no un falso CRÍTICO.
  for (const token of ['resumenestrials.com', '@resumenestrials', 'resumenestrials@outlook.com']) {
    if (!result.raw.includes(token)) add('MEDIO', label, 'PDF', `el escaneo binario no localizó '${token}'; revisar visualmente el artefacto`);
  }
}

async function checkArticle(page, record) {
  const id = record.id;
  const label = `resumen ${id}`;
  await guardedGoto(page, `${BASE}/resumen.html?id=${encodeURIComponent(id)}`, label);
  await page.waitForSelector('header.art h1', { timeout: 15000 }).catch(() => {});

  const title = (await page.locator('header.art h1').innerText().catch(() => '')).trim();
  const expected = String(record.titulo || '').replace(/<[^>]+>/g, '').trim();
  if (!title) add('CRÍTICO', label, 'render', 'título ausente');
  else if (title !== expected) add('ALTO', label, 'consistencia', 'título renderizado no coincide con resumenes.json', `${title} != ${expected}`);

  const body = await page.locator('article').innerText().catch(() => '');
  if (body.length < 250) add('ALTO', label, 'render', 'cuerpo largo ausente o demasiado corto');
  if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(await page.locator('body').innerText().catch(() => ''))) {
    add('ALTO', label, 'render', 'texto de error/valor JavaScript visible');
  }

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

  const pdfFooterPatched = await page.evaluate(() => !!(window.jspdf?.jsPDF?.API?.__rtContactFooterPatched || window.jsPDF?.API?.__rtContactFooterPatched)).catch(() => false);
  if (!pdfFooterPatched) add('ALTO', label, 'PDF', 'el módulo de contacto no quedó enlazado al generador jsPDF');

  const fullButtons = page.locator('[data-pdf-version="completo"]');
  if (!(await fullButtons.count())) add('CRÍTICO', label, 'PDF', 'falta botón de resumen completo PDF');
  if (record.corto && !(await page.locator('[data-pdf-version="breve"]').count())) add('ALTO', label, 'PDF', 'falta botón de resumen breve PDF');

  try {
    const pdf = await duplicateDownload(page, '[data-pdf-version="completo"]', `id-${id}-completo.pdf`);
    checkPdf(pdf, `${label} PDF completo`);
  } catch (err) {
    add('CRÍTICO', label, 'PDF', 'no fue posible descargar PDF completo', err.message);
  }

  if (record.corto) {
    try {
      const pdf = await duplicateDownload(page, '[data-pdf-version="breve"]', `id-${id}-breve.pdf`);
      checkPdf(pdf, `${label} PDF breve`);
    } catch (err) {
      add('ALTO', label, 'PDF', 'no fue posible descargar PDF breve', err.message);
    }

    await guardedGoto(page, `${BASE}/resumen.html?id=${encodeURIComponent(id)}&v=corto`, `${label} breve`);
    const shortBody = await page.locator('article.corto').innerText().catch(() => '');
    if (shortBody.length < 120) add('ALTO', `${label} breve`, 'render', 'versión breve ausente o demasiado corta');
    if ((record.especialidad_principal === 'Medicina Interna' || record.especialidad_secundaria === 'Medicina Interna') && !(await page.locator('.badge.subesp-mi').count())) {
      add('MEDIO', `${label} breve`, 'clasificación', 'subespecialidad ausente en la versión breve');
    }
  }

  await basicA11y(page, label);
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
