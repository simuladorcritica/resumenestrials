import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('resumenes.json', 'utf8'));
const manifest = JSON.parse(readFileSync('seo-manifest.json', 'utf8'));
const sitemap = readFileSync('sitemap.xml', 'utf8');
const entries = new Map();

for (const match of sitemap.matchAll(/<url>(.*?)<\/url>/gs)) {
  const block = match[1];
  const location = block.match(/<loc>(.*?)<\/loc>/s)?.[1];
  const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/s)?.[1] || '';
  if (location) entries.set(location, lastmod);
}

for (const item of data) {
  const url = manifest[String(item.id)]?.url;
  if (!url || !entries.has(url)) throw new Error(`Sitemap sin URL canónica para el resumen ${item.id}`);
  const expected = String(item.fecha_revision || item.actualizado || item.fecha_publicacion_resumen || '').trim();
  const actual = entries.get(url);
  if (actual !== expected) {
    throw new Error(`lastmod incorrecto para el resumen ${item.id}: esperado ${expected || '(omitido)'}, recibido ${actual || '(omitido)'}`);
  }
  if (actual && !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(actual)) {
    throw new Error(`lastmod no usa un formato ISO válido para el resumen ${item.id}: ${actual}`);
  }
}

console.log(`SITEMAP PASS · ${data.length} trials · lastmod solo desde fechas editoriales explícitas`);
