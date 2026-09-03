import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const BASE = 'https://resumenestrials.com';
const outputArg = process.argv.indexOf('--output');
const output = outputArg >= 0 ? process.argv[outputArg + 1] : 'reports/seo-baseline.json';
const failOnHigh = process.argv.includes('--fail-on-high');
const data = JSON.parse(readFileSync(join(ROOT, 'resumenes.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'seo-manifest.json'), 'utf8'));
const clusters = JSON.parse(readFileSync(join(ROOT, 'seo-cluster-manifest.json'), 'utf8'));
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const pages = [
  ['/', '_includes/index-source.html'], ['/metodologia/', 'metodologia/index.html'], ['/equipo-editorial/', 'equipo-editorial/index.html'],
  ['/privacidad/', 'privacidad/index.html'], ['/terminos/', 'terminos/index.html'],
  ['/medicina-critica/', 'medicina-critica/index.html'], ['/medicina-interna/', 'medicina-interna/index.html'],
  ...Object.values(clusters).map((x) => [x.path, `${x.path.replace(/^\//, '')}index.html`]),
  ...Object.values(manifest).map((x) => [x.path, `${x.path.replace(/^\//, '')}index.html`]),
];
const findings = [];
const titles = new Map(), descriptions = new Map(), h1s = new Map();
const incoming = new Map(pages.map(([path]) => [path, 0]));
let indexable = 0, schemas = 0, internalLinks = 0, bytes = 0;
const add = (severity, code, file, message) => findings.push({ severity, code, file, message });
const one = (source, regex) => (source.match(regex) || [])[1]?.trim() || '';
const remember = (map, value, file) => { if (value) map.set(value, [...(map.get(value) || []), file]); };

for (const [route, file] of pages) {
  if (!existsSync(join(ROOT, file))) { add('P0', 'missing-page', file, `Falta la página indexable ${route}`); continue; }
  const source = readFileSync(join(ROOT, file), 'utf8');
  bytes += Buffer.byteLength(source);
  const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(source);
  if (!noindex) indexable++;
  const title = one(source, /<title>([\s\S]*?)<\/title>/i);
  const description = one(source, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i);
  const h1 = one(source, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
  const canonical = one(source, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
  remember(titles, title, file); remember(descriptions, description, file); remember(h1s, h1, file);
  if (!title) add('P1', 'missing-title', file, 'Falta title');
  if (!description) add('P2', 'missing-description', file, 'Falta meta description');
  if (!h1) add('P1', 'missing-h1', file, 'Falta H1');
  const expected = `${BASE}${route}`;
  if (canonical !== expected) add('P0', 'canonical-mismatch', file, `${canonical || '(vacío)'} != ${expected}`);
  if (!sitemapUrls.includes(expected)) add('P1', 'sitemap-missing', file, `${expected} no aparece en sitemap`);
  for (const match of source.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(match[1]); schemas++; } catch (error) { add('P1', 'invalid-jsonld', file, error.message); }
  }
  const navigable = source.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  for (const match of navigable.matchAll(/<a\s[^>]*href=["']([^"'#?]+)[^"']*["']/gi)) {
    let href = match[1];
    if (/^(https?:|mailto:|tel:)/i.test(href)) continue;
    if (!href.startsWith('/')) href = `/${normalize(join(dirname(route), href)).replaceAll('\\', '/')}`;
    if (!href.endsWith('/') && !/\.[a-z0-9]+$/i.test(href)) href += '/';
    internalLinks++;
    if (incoming.has(href)) incoming.set(href, incoming.get(href) + 1);
    const local = href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1);
    if (!existsSync(join(ROOT, local))) add('P1', 'broken-internal-link', file, `Enlace roto: ${href}`);
  }
}
for (const [kind, map] of [['title', titles], ['description', descriptions], ['h1', h1s]]) {
  for (const [value, files] of map) if (files.length > 1) add('P2', `duplicate-${kind}`, files.join(', '), `${files.length} páginas comparten: ${value.slice(0, 120)}`);
}
for (const [route, count] of incoming) if (route !== '/' && count === 0) add('P1', 'orphan-page', route, 'Página indexable sin enlaces internos entrantes');
const canonicalUrls = Object.values(manifest).map((x) => x.url);
const duplicateCanonicals = canonicalUrls.filter((url, i) => canonicalUrls.indexOf(url) !== i);
if (new Set(sitemapUrls).size !== sitemapUrls.length) add('P0', 'duplicate-sitemap-url', 'sitemap.xml', 'El sitemap contiene URLs duplicadas');
if (duplicateCanonicals.length) add('P0', 'duplicate-canonical', 'seo-manifest.json', duplicateCanonicals.join(', '));
const report = {
  generatedAt: new Date().toISOString(), source: 'local-static-audit',
  metrics: { summaries: data.length, canonicalTrials: canonicalUrls.length, indexablePages: indexable, sitemapUrls: sitemapUrls.length,
    duplicateCanonicals: duplicateCanonicals.length, noindexPages: pages.length - indexable, orphanPages: findings.filter((x) => x.code === 'orphan-page').length,
    duplicateTitles: findings.filter((x) => x.code === 'duplicate-title').length, duplicateDescriptions: findings.filter((x) => x.code === 'duplicate-description').length,
    duplicateH1: findings.filter((x) => x.code === 'duplicate-h1').length, brokenInternalLinks: findings.filter((x) => x.code === 'broken-internal-link').length,
    validJsonLdBlocks: schemas, htmlBytes: bytes, averageHtmlBytes: Math.round(bytes / Math.max(pages.length, 1)), internalLinks },
  severity: Object.fromEntries(['P0','P1','P2','P3'].map((s) => [s, findings.filter((x) => x.severity === s).length])), findings,
};
mkdirSync(dirname(join(ROOT, output)), { recursive: true });
writeFileSync(join(ROOT, output), `${JSON.stringify(report, null, 2)}\n`);
console.log(`SEO AUDIT ${report.severity.P0 || report.severity.P1 ? 'FAIL' : 'PASS'} · ${data.length} resúmenes · ${indexable} indexables · ${sitemapUrls.length} sitemap · P0=${report.severity.P0} P1=${report.severity.P1} P2=${report.severity.P2}`);
if (failOnHigh && (report.severity.P0 || report.severity.P1)) process.exitCode = 1;
