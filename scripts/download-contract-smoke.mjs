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
    page.waitForEvent('download', { timeout: 25000 }),
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

const source = readFileSync('_includes/index-source.html', 'utf8');
const fixture = `${source}\n<script type="module" src="internal-medicine-ux.js?v=1"></script>\n<script src="pdf-contact.js?v=2"></script>\n`;
writeFileSync('index-smoke.html', fixture, 'utf8');

const data = await fetch(`${BASE}/resumenes.json`).then((r) => r.json());
const sample = data.find((r) => r.corto) || data[0];
assert(sample, 'No hay resúmenes para probar');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });

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

await page.goto(`${BASE}/resumen.html?id=${sample.id}`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-pdf-version="completo"]', { timeout: 15000 });
await page.waitForTimeout(300);
assert(await page.locator('[data-pdf-version="completo"]').first().isVisible(), 'El resumen completo no muestra su descarga');
assert(!(await page.locator('[data-pdf-version="breve"]').first().isVisible().catch(() => false)), 'El resumen completo muestra indebidamente la descarga breve');
const fullText = await page.locator('[data-pdf-version="completo"]').first().innerText();
assert(/Descargar resumen completo PDF/i.test(fullText), `Etiqueta completa incorrecta: ${fullText}`);
const fullPdf = await download(page, '[data-pdf-version="completo"]', 'completo.pdf');
assertPdfContact(fullPdf);

if (sample.corto) {
  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-pdf-version="breve"]', { timeout: 15000 });
  await page.waitForTimeout(300);
  assert(await page.locator('[data-pdf-version="breve"]').first().isVisible(), 'El resumen breve no muestra su descarga');
  assert(!(await page.locator('[data-pdf-version="completo"]').first().isVisible()), 'El resumen breve muestra indebidamente la descarga completa');
  const briefText = await page.locator('[data-pdf-version="breve"]').first().innerText();
  assert(/Descargar resumen breve PDF/i.test(briefText), `Etiqueta breve incorrecta: ${briefText}`);
  const briefPdf = await download(page, '[data-pdf-version="breve"]', 'breve.pdf');
  assertPdfContact(briefPdf);
}

await browser.close();
console.log(`Download contract PASS · muestra id ${sample.id}`);
