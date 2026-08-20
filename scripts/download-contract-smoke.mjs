import { chromium } from 'playwright';
import { mkdtempSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.env.RT_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const requiredContacts = ['resumenestrials.com', '@resumenestrials', '@ResumenesTrials', 'resumenestrials@outlook.com'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function download(page, selector, filename) {
  const button = page.locator(selector).first();
  assert(await button.count(), `No existe ${selector}`);
  assert(await button.isVisible(), `${selector} no está visible cuando debería`);
  const [event] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    button.click(),
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'rt-contract-'));
  const target = join(dir, filename);
  await event.saveAs(target);
  assert(statSync(target).size > 3000, `PDF demasiado pequeño: ${target}`);
  return target;
}

function assertPdfContact(path) {
  const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8', timeout: 15000 }).replace(/\s+/g, ' ');
  for (const token of requiredContacts) assert(text.includes(token), `El PDF no contiene ${token}`);
}

async function shortDiagnostic(page, errors) {
  const snapshot = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    bodyClass: document.body?.className || '',
    contenido: (document.getElementById('contenido')?.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
    buttons: [...document.querySelectorAll('[data-pdf-version]')].map((b) => ({
      version: b.dataset.pdfVersion,
      hidden: b.hidden,
      display: getComputedStyle(b).display,
      text: (b.textContent || '').replace(/\s+/g, ' ').trim(),
    })),
  }));
  return `${JSON.stringify(snapshot)} · errores=${errors.join(' | ') || 'ninguno'}`;
}

const source = readFileSync('_includes/index-source.html', 'utf8');
const fixture = `${source}\n<script type="module" src="internal-medicine-ux.js?v=1"></script>\n<script src="pdf-contact.js?v=2"></script>\n`;
writeFileSync('index-smoke.html', fixture, 'utf8');

const data = await fetch(`${BASE}/resumenes.json`).then((r) => r.json());
const manifest = await fetch(`${BASE}/seo-manifest.json`).then((r) => r.json());
const sample = data.find((r) => r.corto) || data[0];
assert(sample, 'No hay resúmenes para probar');
const entry = manifest[String(sample.id)];
assert(entry?.path, `No existe ruta canónica para id ${sample.id}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(`pageerror:${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(`console:${message.text()}`);
});

await page.goto(`${BASE}/index-smoke.html`, { waitUntil: 'networkidle' });
await page.waitForSelector('.fila-pdf .btn-pdf', { timeout: 15000 });
await page.waitForTimeout(700);
const indexFull = await page.locator('.fila-pdf .btn-pdf:not(.rt-download-brief)').first().innerText();
assert(/Descargar resumen completo PDF/i.test(indexFull), `Etiqueta completa incorrecta en índice: ${indexFull}`);
if (data.some((r) => r.corto)) {
  await page.waitForSelector('.fila-pdf .rt-download-brief', { timeout: 10000 });
  const indexBrief = await page.locator('.fila-pdf .rt-download-brief').first().innerText();
  assert(/Descargar resumen breve PDF/i.test(indexBrief), `Etiqueta breve incorrecta en índice: ${indexBrief}`);
}

await page.goto(`${BASE}${entry.path}`, { waitUntil: 'networkidle' });
await page.waitForSelector(`[data-trial-download="${sample.id}"]`, { timeout: 15000 });
assert(await page.locator('.migas').first().isVisible(), 'El trial canónico no muestra breadcrumb');
assert(!(await page.locator('#resumen-breve,.resumen-breve').count()), 'El trial canónico sigue incrustando el resumen breve');
const canonicalDownloadText = await page.locator(`[data-trial-download="${sample.id}"]`).first().innerText();
assert(/Descargar resumen completo PDF/i.test(canonicalDownloadText), `Botón PDF canónico incorrecto: ${canonicalDownloadText}`);
if (sample.corto) {
  const briefLink = page.locator('.trial-action-brief').first();
  assert(await briefLink.isVisible(), 'El trial canónico no muestra enlace a la lectura breve');
  const href = await briefLink.getAttribute('href');
  assert(href === `/resumen.html?id=${sample.id}&v=corto` || href === `/resumen.html?id=${sample.id}&amp;v=corto`, `Ruta breve incorrecta: ${href}`);
}
const canonicalPdf = await download(page, `[data-trial-download="${sample.id}"]`, 'canonico-completo.pdf');
assertPdfContact(canonicalPdf);

await page.goto(`${BASE}/resumen.html?id=${sample.id}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('[data-pdf-version="completo"]', { timeout: 15000 });
await page.waitForTimeout(300);
assert(await page.locator('[data-pdf-version="completo"]').first().isVisible(), 'El resumen legacy completo no muestra su descarga');
assert(!(await page.locator('[data-pdf-version="breve"]').first().isVisible().catch(() => false)), 'El resumen completo muestra indebidamente la descarga breve');
const fullText = await page.locator('[data-pdf-version="completo"]').first().innerText();
assert(/Descargar resumen completo PDF/i.test(fullText), `Etiqueta completa incorrecta: ${fullText}`);

if (sample.corto) {
  browserErrors.length = 0;
  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.waitForSelector('body.modo-corto', { timeout: 10000 });
    await page.waitForSelector('[data-pdf-version="breve"]', { state: 'attached', timeout: 10000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-pdf-version="breve"]');
      return button && !button.hidden && getComputedStyle(button).display !== 'none';
    }, { timeout: 10000 });
  } catch (error) {
    throw new Error(`La versión breve no terminó de renderizar correctamente: ${await shortDiagnostic(page, browserErrors)}`);
  }
  await page.waitForSelector('.migas .volver-top', { timeout: 10000 });
  assert(await page.locator('article.corto').first().isVisible(), 'El resumen breve perdió su artículo monocolumna');
  const backText = (await page.locator('.migas .volver-top').first().innerText()).replace(/\s+/g, ' ');
  assert(/Volver al índice/i.test(backText), `El resumen breve perdió su navegación anterior: ${backText}`);
  assert(!(await page.locator('[data-pdf-version="completo"]').first().isVisible()), 'El resumen breve muestra indebidamente la descarga completa');
  await page.waitForFunction(() => {
    const link = document.querySelector('.cambio-version');
    return link && /\/trials\//.test(link.href);
  }, { timeout: 15000 });
  const versionHref = await page.locator('.cambio-version').first().getAttribute('href');
  const resolved = new URL(versionHref, `${BASE}/resumen.html`).pathname;
  assert(resolved === entry.path, `La versión breve no vuelve al trial canónico: ${resolved}`);
  const briefText = await page.locator('[data-pdf-version="breve"]').first().innerText();
  assert(/Descargar resumen breve PDF/i.test(briefText), `Etiqueta breve incorrecta: ${briefText}`);
  const briefPdf = await download(page, '[data-pdf-version="breve"]', 'breve.pdf');
  assertPdfContact(briefPdf);
}

await browser.close();
console.log(`Unified trial contract PASS · muestra id ${sample.id}`);
