import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { auditArticleData, compareCoverage, expectedEntry } from './article-inventory.mjs';

const ROOT = process.cwd();
const BASE = 'https://resumenestrials.com';
const data = JSON.parse(readFileSync(join(ROOT, 'resumenes.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'seo-manifest.json'), 'utf8'));
const clusters = JSON.parse(readFileSync(join(ROOT, 'seo-cluster-manifest.json'), 'utf8'));
const redirects = JSON.parse(readFileSync(join(ROOT, 'seo-legacy-redirects.json'), 'utf8'));
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const sitemapTrialUrls = sitemapUrls.filter((url) => url.startsWith(`${BASE}/trials/`));
const pageSlugs = readdirSync(join(ROOT, 'trials'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, 'trials', entry.name, 'index.html')))
  .map((entry) => entry.name);
const dataAudit = auditArticleData(data);
const coverage = compareCoverage(dataAudit.records, manifest, sitemapTrialUrls, pageSlugs);
const errors = [...dataAudit.errors];
const incoming = new Map(dataAudit.records.map((record) => [expectedEntry(record).path, 0]));
let http200 = 0;
let noindex = 0;
let canonicalErrors = 0;
let invalidJsonLd = 0;
let articleSchemas = 0;
let breadcrumbSchemas = 0;

function collectTypes(value, types = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => collectTypes(item, types));
  else if (value && typeof value === 'object') {
    if (typeof value['@type'] === 'string') types.add(value['@type']);
    Object.values(value).forEach((item) => collectTypes(item, types));
  }
  return types;
}

function hrefs(source) {
  const clean = source.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  return [...clean.matchAll(/<a\s[^>]*href=["']([^"'#]+)[^"']*["']/gi)].map((match) => match[1]);
}

for (const record of dataAudit.records) {
  const expected = expectedEntry(record);
  const file = join(ROOT, 'trials', expected.slug, 'index.html');
  if (!existsSync(file)) continue;
  http200 += 1;
  const source = readFileSync(file, 'utf8');
  const robots = source.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i)?.[1] || '';
  if (/\bnoindex\b/i.test(robots)) noindex += 1;
  const canonicals = [...source.matchAll(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/gi)].map((match) => match[1]);
  if (canonicals.length !== 1 || canonicals[0] !== expected.url || !canonicals[0].startsWith('https://') || /[?#]/.test(canonicals[0])) {
    canonicalErrors += 1;
  }
  const types = new Set();
  for (const match of source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectTypes(JSON.parse(match[1]), types); } catch { invalidJsonLd += 1; }
  }
  if (types.has('Article')) articleSchemas += 1;
  else errors.push(`ID ${record.id}: falta schema Article`);
  if (types.has('BreadcrumbList')) breadcrumbSchemas += 1;
  else errors.push(`ID ${record.id}: falta schema BreadcrumbList`);
}

const crawlSources = [
  join(ROOT, '_includes', 'index-source.html'),
  join(ROOT, 'medicina-critica', 'index.html'),
  join(ROOT, 'medicina-interna', 'index.html'),
  ...Object.values(clusters).map((cluster) => join(ROOT, cluster.path.replace(/^\//, ''), 'index.html')),
  ...Object.values(manifest).map((entry) => join(ROOT, entry.path.replace(/^\//, ''), 'index.html')),
].filter((file, index, files) => existsSync(file) && files.indexOf(file) === index);

for (const file of crawlSources) {
  for (const href of hrefs(readFileSync(file, 'utf8'))) {
    let path = href;
    if (href.startsWith(BASE)) path = new URL(href).pathname;
    if (incoming.has(path)) incoming.set(path, incoming.get(path) + 1);
  }
}
const orphans = [...incoming.entries()].filter(([, count]) => count === 0).map(([path]) => path);

const home = readFileSync(join(ROOT, '_includes', 'index-source.html'), 'utf8');
const globalTypes = new Set();
for (const match of home.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
  try { collectTypes(JSON.parse(match[1]), globalTypes); } catch { invalidJsonLd += 1; }
}
if (!globalTypes.has('WebSite')) errors.push('La portada no contiene schema WebSite');
if (!globalTypes.has('Organization')) errors.push('La portada no contiene schema Organization');

for (const redirect of redirects) {
  const sourcePath = String(redirect.from || '');
  const targetPath = String(redirect.to || '');
  const file = join(ROOT, sourcePath.replace(/^\//, ''), 'index.html');
  if (!existsSync(file)) {
    errors.push(`Falta compatibilidad para ${sourcePath}`);
    continue;
  }
  const source = readFileSync(file, 'utf8');
  const target = `${BASE}${targetPath}`;
  if (!/name=["']robots["'][^>]+content=["']noindex,follow/i.test(source)
    || !source.includes(`<link rel="canonical" href="${target}">`)
    || !source.includes(`http-equiv="refresh"`)
    || sitemapUrls.includes(`${BASE}${sourcePath}`)) {
    errors.push(`Compatibilidad SEO inválida para ${sourcePath}`);
  }
}

const legacy = readFileSync(join(ROOT, 'resumen.html'), 'utf8');
if (!/name="robots"[^>]+content="noindex,follow/i.test(legacy)) errors.push('resumen.html debe ser noindex,follow');
if (coverage.missingManifest.length) errors.push(`IDs sin manifiesto: ${coverage.missingManifest.join(',')}`);
if (coverage.mismatchedManifest.length) errors.push(`IDs con manifiesto incoherente: ${coverage.mismatchedManifest.join(',')}`);
if (coverage.missingPages.length) errors.push(`IDs sin página: ${coverage.missingPages.join(',')}`);
if (coverage.missingSitemap.length) errors.push(`IDs sin sitemap: ${coverage.missingSitemap.join(',')}`);
if (coverage.extraManifest.length) errors.push(`IDs extra en manifiesto: ${coverage.extraManifest.join(',')}`);
if (coverage.extraPages.length) errors.push(`páginas extra: ${coverage.extraPages.join(',')}`);
if (coverage.extraSitemap.length) errors.push(`URLs extra de trials en sitemap: ${coverage.extraSitemap.join(',')}`);
if (coverage.duplicateSitemap) errors.push(`URLs de trial duplicadas en sitemap: ${coverage.duplicateSitemap}`);
if (coverage.duplicateCanonicals) errors.push(`canonicals duplicados: ${coverage.duplicateCanonicals}`);
if (noindex) errors.push(`páginas de trial con noindex: ${noindex}`);
if (canonicalErrors) errors.push(`errores canonical: ${canonicalErrors}`);
if (invalidJsonLd) errors.push(`bloques JSON-LD inválidos: ${invalidJsonLd}`);
if (orphans.length) errors.push(`trials huérfanos: ${orphans.length}`);

console.log(`INDEXABILITY ${errors.length ? 'FAIL' : 'PASS'} · JSON=${coverage.counts.json} · pages=${coverage.counts.pages} · sitemap=${coverage.counts.sitemap} · HTTP200=${http200} · noindex=${noindex} · canonicalErrors=${canonicalErrors} · orphans=${orphans.length} · Article=${articleSchemas} · Breadcrumb=${breadcrumbSchemas}`);
for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length) process.exitCode = 1;
