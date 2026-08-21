import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://resumenestrials.com';
const manifest = JSON.parse(readFileSync(join(ROOT, 'seo-manifest.json'), 'utf8'));
const clusters = JSON.parse(readFileSync(join(ROOT, 'seo-cluster-manifest.json'), 'utf8'));

function value(source, pattern, label, file) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1 || !matches[0][1]?.trim()) {
    throw new Error(`${file}: ${label} debe existir exactamente una vez`);
  }
  return matches[0][1].trim();
}

function validatePage(file, expectedCanonical, expectedImages = null) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const canonical = value(source, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/gi, 'canonical', file);
  const ogUrl = value(source, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["'][^>]*>/gi, 'og:url', file);
  const ogTitle = value(source, /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["'][^>]*>/gi, 'og:title', file);
  const ogDescription = value(source, /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["'][^>]*>/gi, 'og:description', file);
  const ogImage = value(source, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["'][^>]*>/gi, 'og:image', file);

  if (canonical !== expectedCanonical || ogUrl !== canonical) {
    throw new Error(`${file}: canonical/og:url inconsistentes (${canonical} · ${ogUrl})`);
  }
  for (const [name, url] of [['canonical', canonical], ['og:url', ogUrl], ['og:image', ogImage]]) {
    if (!url.startsWith(`${BASE}/`)) throw new Error(`${file}: ${name} no usa HTTPS y dominio canónico`);
  }
  const imagePath = ogImage.slice(`${BASE}/`.length);
  if (!existsSync(join(ROOT, imagePath))) throw new Error(`${file}: og:image no existe (${imagePath})`);
  if (expectedImages && !expectedImages.includes(ogImage)) throw new Error(`${file}: og:image no coincide con el manifiesto`);
  if (!ogTitle || !ogDescription) throw new Error(`${file}: Open Graph incompleto`);
}

validatePage('_includes/index-source.html', `${BASE}/`);
validatePage('medicina-critica/index.html', `${BASE}/medicina-critica/`);
validatePage('medicina-interna/index.html', `${BASE}/medicina-interna/`);
validatePage('metodologia/index.html', `${BASE}/metodologia/`);
validatePage('equipo-editorial/index.html', `${BASE}/equipo-editorial/`);

for (const entry of Object.values(clusters)) {
  validatePage(`${entry.path.slice(1)}index.html`, entry.url);
}
for (const entry of Object.values(manifest)) {
  validatePage(`${entry.path.slice(1)}index.html`, entry.url, entry.images || []);
}

console.log(`SEO PASS · canonical + Open Graph coherentes en ${Object.keys(manifest).length} trials, ${Object.keys(clusters).length} clusters y 5 hubs`);
