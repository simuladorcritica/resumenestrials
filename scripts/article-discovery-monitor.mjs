import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isValidIsoDate } from './article-inventory.mjs';

const PUBLICATION_FIELD = 'fecha_publicacion_resumen';

export function checkpointForAge(ageDays) {
  if (ageDays < 7) return 'D0_PUBLICACION_TECNICA';
  if (ageDays < 14) return 'D7_DESCUBRIMIENTO_TECNICO';
  if (ageDays < 28) return 'D14_PRIMERAS_SENALES_GSC';
  return 'D28_PRIMERA_EVALUACION';
}

export function buildArticleMonitoring({ data, manifest, sitemap, gsc, readPage, today }) {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const inspectionByUrl = new Map((gsc.inspections || []).map((item) => [item.url, item]));
  const signalsByUrl = new Map();
  for (const row of gsc.rows || []) {
    const current = signalsByUrl.get(row.page) || { impressions: 0, clicks: 0 };
    current.impressions += Number(row.impressions) || 0;
    current.clicks += Number(row.clicks) || 0;
    signalsByUrl.set(row.page, current);
  }

  return data.filter((item) => isValidIsoDate(item[PUBLICATION_FIELD])).map((item) => {
    const publicationDate = String(item[PUBLICATION_FIELD]);
    const ageDays = Math.max(0, Math.floor((todayDate - new Date(`${publicationDate}T00:00:00Z`)) / 86400000));
    const entry = manifest[String(item.id)];
    const page = entry ? readPage(entry) : '';
    const canonical = entry?.url || null;
    const published = Boolean(entry && page);
    const discoverable = published
      && sitemap.includes(`<loc>${canonical}</loc>`)
      && page.includes(`href="${canonical}"`)
      && !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(page);
    const inspection = inspectionByUrl.get(canonical);
    const indexed = inspection?.verdict === 'PASS' ? 'CONFIRMED' : inspection ? 'NOT_CONFIRMED' : 'UNKNOWN';
    const signals = signalsByUrl.get(canonical) || { impressions: 0, clicks: 0 };
    const withImpressions = signals.impressions > 0;
    const withClicks = signals.clicks > 0;
    return {
      id: String(item.id),
      title: String(item.titulo),
      canonical,
      publicationDate,
      ageDays,
      checkpoint: checkpointForAge(ageDays),
      published,
      discoverable,
      indexed,
      withImpressions,
      withClicks,
      attention: ageDays >= 28 && !withImpressions ? 'REVIEW_NO_IMPRESSIONS' : 'NONE',
    };
  });
}

function renderPrivateReport(items, today) {
  const lines = [
    '# Vigilancia privada de descubrimiento de nuevas altas',
    '',
    `Fecha de control: ${today}`,
    '',
    'Cero impresiones no se interpreta como prueba de no indexación.',
    '',
  ];
  if (!items.length) return `${lines.join('\n')}Sin artículos con fecha editorial explícita.\n`;
  lines.push('| ID | Artículo | Ventana | Publicado | Discoverable | Indexed | Impressions | Clicks | Atención |');
  lines.push('|---:|---|---|---|---|---|---|---|---|');
  for (const item of items) {
    lines.push(`| ${item.id} | ${item.title} | ${item.checkpoint} | ${item.published ? 'PASS' : 'FAIL'} | ${item.discoverable ? 'PASS' : 'FAIL'} | ${item.indexed} | ${item.withImpressions ? 'YES' : 'NO'} | ${item.withClicks ? 'YES' : 'NO'} | ${item.attention} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function runArticleDiscoveryMonitor({ env = process.env, logger = console.log } = {}) {
  const dataFile = env.GSC_DATA_FILE || 'seo-data/search-console.json';
  const reportDir = env.GSC_REPORT_DIR || 'reports';
  const today = env.RT_MONITOR_TODAY || new Date().toISOString().slice(0, 10);
  const data = JSON.parse(readFileSync('resumenes.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('seo-manifest.json', 'utf8'));
  const sitemap = readFileSync('sitemap.xml', 'utf8');
  const gsc = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : { rows: [], inspections: [] };
  const items = buildArticleMonitoring({
    data,
    manifest,
    sitemap,
    gsc,
    today,
    readPage: (entry) => {
      const path = join(entry.path.replace(/^\//, ''), 'index.html');
      return existsSync(path) ? readFileSync(path, 'utf8') : '';
    },
  });
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, 'article-discovery.json'), `${JSON.stringify({ generatedAt: today, items }, null, 2)}\n`, 'utf8');
  writeFileSync(join(reportDir, 'article-discovery.md'), renderPrivateReport(items, today), 'utf8');
  logger('Post-publication monitoring: PASS');
  return items;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    runArticleDiscoveryMonitor();
  } catch (error) {
    console.error(`Post-publication monitoring: FAIL · ${error instanceof Error ? error.message : 'Error desconocido.'}`);
    process.exitCode = 1;
  }
}

