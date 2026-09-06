import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isValidIsoDate } from './article-inventory.mjs';

const PUBLICATION_FIELD = 'fecha_publicacion_resumen';
const DAY_MS = 86400000;
export const COHORTS = Object.freeze(['LEGACY', 'D0_6', 'D7_13', 'D14_27', 'D28_59', 'D60_89', 'D90_PLUS']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function normalizeDoi(value) {
  return String(value ?? '').trim().toLowerCase()
    .replace(/^urn:doi:\s*/i, '')
    .replace(/^doi\s*:\s*/i, '')
    .replace(/^https?:\/\/(?:www\.)?(?:dx\.)?doi\.org\//i, '')
    .replace(/\s+/g, '');
}

function isoWeek(value) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / DAY_MS) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function cohortForAge(ageDays) {
  if (!Number.isFinite(ageDays)) return 'LEGACY';
  if (ageDays < 7) return 'D0_6';
  if (ageDays < 14) return 'D7_13';
  if (ageDays < 28) return 'D14_27';
  if (ageDays < 60) return 'D28_59';
  if (ageDays < 90) return 'D60_89';
  return 'D90_PLUS';
}

export function checkpointForAge(ageDays) {
  return cohortForAge(ageDays);
}

function aggregateSignals(gsc) {
  const signals = new Map();
  for (const row of gsc.rows || []) {
    const current = signals.get(row.page) || { impressions: 0, clicks: 0 };
    current.impressions += Number(row.impressions) || 0;
    current.clicks += Number(row.clicks) || 0;
    signals.set(row.page, current);
  }
  return signals;
}

function identity(item, entry) {
  return {
    id: String(item.id),
    doi: normalizeDoi(item.doi),
    canonical: entry?.url || null,
  };
}

function technicalFlags({ entry, page, sitemap, navigationCorpus, httpStatus }) {
  const canonical = entry?.url || null;
  const pageExists = Boolean(entry && page);
  const httpOk = httpStatus == null ? pageExists : httpStatus === 200;
  const canonicalValid = pageExists && page.includes(`<link rel="canonical" href="${canonical}">`);
  const sitemapPresent = Boolean(canonical && sitemap.includes(`<loc>${canonical}</loc>`));
  const indexable = pageExists && !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(page);
  const articleSchema = /["']@type["']\s*:\s*["']Article["']/.test(page);
  const breadcrumbSchema = /["']@type["']\s*:\s*["']BreadcrumbList["']/.test(page);
  const schemaValid = articleSchema && breadcrumbSchema;
  const escapedPath = canonical ? new URL(canonical).pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const internalLinks = canonical
    ? (navigationCorpus.match(new RegExp(`href=["']${escapedPath}["']`, 'g')) || []).length
    : 0;
  const hubLinked = internalLinks > 0;
  const published = pageExists && httpOk;
  const discoverable = published && canonicalValid && sitemapPresent && indexable && schemaValid && hubLinked;
  return {
    httpStatus,
    pageExists,
    published,
    canonicalValid,
    sitemapPresent,
    indexable,
    schemaValid,
    hubLinked,
    internalLinks,
    discoverable,
  };
}

function countAtMonthStart(history, today) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const beforeMonth = history.filter((snapshot) => snapshot.date <= monthStart).at(-1);
  return (beforeMonth || history[0])?.count ?? 0;
}

function countsBy(items, field) {
  return Object.fromEntries([...items.reduce((counts, item) => {
    const value = item[field];
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
}

function isPerformanceEligibleCohort(cohort) {
  return cohort === 'LEGACY' || cohort === 'D28_59' || cohort === 'D60_89' || cohort === 'D90_PLUS';
}

export function buildDynamicObservation({
  data,
  manifest,
  sitemap,
  gsc = { rows: [], inspections: [] },
  previousState = null,
  readPage,
  navigationCorpus = '',
  httpByUrl = new Map(),
  canonicalPageCount = null,
  today,
}) {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const previousRecords = new Map((previousState?.records || []).map((item) => [String(item.id), item]));
  const currentIds = new Set(data.map((item) => String(item.id)));
  const baselineInitialized = !previousState;
  const inspections = new Map((gsc.inspections || []).map((item) => [item.url, item]));
  const signals = aggregateSignals(gsc);

  const items = data.map((item) => {
    const id = String(item.id);
    const entry = manifest[id];
    const previous = previousRecords.get(id);
    const page = entry ? readPage(entry) : '';
    const flags = technicalFlags({
      entry,
      page,
      sitemap,
      navigationCorpus,
      httpStatus: httpByUrl.get(entry?.url) ?? null,
    });
    const isNew = !baselineInitialized && !previous;
    const inventoryOrigin = previous?.inventoryOrigin || (isNew ? 'DETECTED' : 'HISTORICAL_BASELINE');
    const editorialDate = isValidIsoDate(item[PUBLICATION_FIELD]) ? String(item[PUBLICATION_FIELD]) : null;
    const productionDatingCandidate = Boolean(previous?.productionDatingCandidate || isNew);
    const technicalPublicationDate = previous?.technicalPublicationDate
      || (productionDatingCandidate && flags.published ? today : null);
    const effectivePublicationDate = editorialDate || technicalPublicationDate;
    const ageDays = effectivePublicationDate
      ? Math.max(0, Math.floor((todayDate - new Date(`${effectivePublicationDate}T00:00:00Z`)) / DAY_MS))
      : null;
    const cohort = cohortForAge(ageDays);
    const canonical = entry?.url || null;
    const signal = signals.get(canonical) || { impressions: 0, clicks: 0 };
    const inspection = inspections.get(canonical);
    const indexed = inspection?.verdict === 'PASS' ? 'CONFIRMED' : inspection ? 'NOT_CONFIRMED' : 'UNKNOWN';
    const alerts = [];
    if (!flags.pageExists) alerts.push('ARTICLE_PAGE_MISSING');
    if (flags.httpStatus != null && flags.httpStatus !== 200) alerts.push('HTTP_NOT_200');
    if (!flags.canonicalValid) alerts.push('CANONICAL_INVALID');
    if (!flags.sitemapPresent) alerts.push('SITEMAP_MISSING');
    if (!flags.schemaValid) alerts.push('SCHEMA_INVALID');
    if (!flags.hubLinked) alerts.push('INTERNAL_LINK_MISSING');
    const entryClusters = Array.isArray(entry?.clusters) ? entry.clusters.map((cluster) => cluster.name) : [];
    return {
      ...identity(item, entry),
      trial: String(item.titulo || ''),
      journal: String(item.revista || ''),
      primarySpecialty: String(item.especialidad_principal || ''),
      secondarySpecialty: String(item.especialidad_secundaria || ''),
      clusters: entryClusters,
      firstDetectedAt: previous?.firstDetectedAt || today,
      inventoryOrigin,
      publicationDate: editorialDate,
      technicalPublicationDate,
      productionDatingCandidate,
      publicationDateSource: editorialDate ? 'EDITORIAL' : technicalPublicationDate ? 'FIRST_CONFIRMED_PRODUCTION' : 'NONE',
      publicationWeek: effectivePublicationDate ? isoWeek(effectivePublicationDate) : null,
      publicationMonth: effectivePublicationDate?.slice(0, 7) || null,
      ageDays,
      cohort,
      checkpoint: cohort,
      isNew,
      ...flags,
      indexed,
      withImpressions: signal.impressions > 0,
      withClicks: signal.clicks > 0,
      performanceEligible: cohort === 'LEGACY' || ageDays >= 28,
      preliminaryPerformance: Number.isFinite(ageDays) && ageDays >= 14 && ageDays < 28,
      attention: Number.isFinite(ageDays) && ageDays >= 28 && signal.impressions === 0 ? 'REVIEW_NO_IMPRESSIONS' : 'NONE',
      alerts,
      fingerprint: fingerprint(item),
    };
  });

  const newArticles = items.filter((item) => item.isNew).map(({ id, doi, canonical, trial, publicationDate, primarySpecialty, secondarySpecialty, clusters, firstDetectedAt }) => ({
    id, doi, canonical, trial, publicationDate, primarySpecialty, secondarySpecialty, clusters, firstDetectedAt,
  }));
  const removedArticles = baselineInitialized ? [] : (previousState.records || [])
    .filter((item) => !currentIds.has(String(item.id)))
    .map(({ id, doi, canonical }) => ({ id: String(id), doi, canonical }));
  const modifiedArticles = baselineInitialized ? [] : items
    .filter((item) => previousRecords.has(item.id) && previousRecords.get(item.id).fingerprint !== item.fingerprint)
    .map(({ id, doi, canonical }) => ({ id, doi, canonical }));
  const currentSitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/resumenestrials\.com\/trials\/[^<]+)<\/loc>/g)].map((match) => match[1]);
  const currentCanonicalPages = Number.isInteger(canonicalPageCount)
    ? canonicalPageCount
    : items.filter((item) => item.pageExists).length;
  const cohortCounts = Object.fromEntries(COHORTS.map((cohort) => [cohort, items.filter((item) => item.cohort === cohort).length]));
  const publicationCohorts = {
    weeks: countsBy(items, 'publicationWeek'),
    months: countsBy(items, 'publicationMonth'),
  };
  const transitions = Object.fromEntries(COHORTS.filter((cohort) => cohort !== 'LEGACY').map((cohort) => [cohort, 0]));
  if (!baselineInitialized) {
    for (const item of items) {
      const previous = previousRecords.get(item.id);
      if (previous && previous.cohort !== item.cohort && item.cohort !== 'LEGACY') transitions[item.cohort] += 1;
    }
  }
  const previousHistory = Array.isArray(previousState?.history) ? previousState.history : [];
  const cutoff = new Date(todayDate.getTime() - 400 * DAY_MS).toISOString().slice(0, 10);
  const history = previousHistory.filter((snapshot) => snapshot.date !== today && snapshot.date >= cutoff);
  history.push({ date: today, count: data.length, maxId: Math.max(0, ...data.map((item) => Number(item.id) || 0)) });
  history.sort((left, right) => left.date.localeCompare(right.date));
  const monthStartCount = countAtMonthStart(history, today);
  const currentEligibleCanonicals = items
    .filter((item) => item.performanceEligible && item.canonical)
    .map((item) => item.canonical);
  const previousEligibleCanonicals = baselineInitialized
    ? currentEligibleCanonicals
    : (previousState.records || [])
      .filter((item) => isPerformanceEligibleCohort(item.cohort) && item.canonical)
      .map((item) => item.canonical);
  const summary = {
    generatedAt: today,
    baselineInitialized,
    previousArticleCount: baselineInitialized ? data.length : previousState.records.length,
    currentArticleCount: data.length,
    currentMaxId: Math.max(0, ...data.map((item) => Number(item.id) || 0)),
    currentCanonicalPages,
    currentSitemapUrls: currentSitemapUrls.length,
    parity: data.length === currentCanonicalPages && data.length === currentSitemapUrls.length,
    newArticles: newArticles.length,
    removedArticles: removedArticles.length,
    modifiedArticles: modifiedArticles.length,
    newD0Articles: newArticles.filter((item) => items.find((current) => current.id === item.id)?.cohort === 'D0_6').length,
    articlesAddedThisMonth: items.filter((item) => item.inventoryOrigin === 'DETECTED' && item.firstDetectedAt >= `${today.slice(0, 7)}-01`).length,
    articlesPublishedThisWeek: items.filter((item) => Number.isFinite(item.ageDays) && item.ageDays <= 6).length,
    articlesPublishedLast28d: items.filter((item) => Number.isFinite(item.ageDays) && item.ageDays <= 27).length,
    articlesWithImpressions: items.filter((item) => item.withImpressions).length,
    articlesWithClicks: items.filter((item) => item.withClicks).length,
    articlesWithoutSignal: items.filter((item) => !item.withImpressions).length,
    cohortCounts,
    publicationCohorts,
    transitions,
    eligibleArticleCount: currentEligibleCanonicals.length,
    previousEligibleArticleCount: previousEligibleCanonicals.length,
    monthStartCount,
    inventoryGrowthPercent: monthStartCount
      ? Number((((data.length - monthStartCount) / monthStartCount) * 100).toFixed(2))
      : 0,
    technicalAlerts: items.reduce((total, item) => total + item.alerts.length, 0),
  };
  return {
    version: 2,
    summary,
    deltas: { newArticles, removedArticles, modifiedArticles },
    comparison: { currentEligibleCanonicals, previousEligibleCanonicals },
    items,
    state: {
      version: 2,
      generatedAt: today,
      history,
      records: items.map(({ id, doi, canonical, firstDetectedAt, inventoryOrigin, technicalPublicationDate, productionDatingCandidate, cohort, fingerprint: itemFingerprint }) => ({
        id, doi, canonical, firstDetectedAt, inventoryOrigin, technicalPublicationDate, productionDatingCandidate, cohort, fingerprint: itemFingerprint,
      })),
    },
  };
}

export function buildArticleMonitoring(options) {
  return buildDynamicObservation(options).items;
}

function renderPrivateReport(observation) {
  const { summary, deltas, items } = observation;
  const lines = [
    '# Vigilancia privada dinámica de inventario y descubrimiento',
    '',
    `Inventario anterior: ${summary.previousArticleCount}`,
    `Inventario actual: ${summary.currentArticleCount}`,
    `Nuevos artículos: ${summary.newArticles}`,
    `Total actual: ${summary.currentArticleCount}`,
    '',
    `Pasaron a D7–13: ${summary.transitions.D7_13}`,
    `Pasaron a D14–27: ${summary.transitions.D14_27}`,
    `Pasaron a D28–59: ${summary.transitions.D28_59}`,
    `Pasaron a D60–89: ${summary.transitions.D60_89}`,
    `Pasaron a D90+: ${summary.transitions.D90_PLUS}`,
    '',
    `Paridad JSON/páginas/sitemap: ${summary.parity ? 'PASS' : 'FAIL'} (${summary.currentArticleCount}/${summary.currentCanonicalPages}/${summary.currentSitemapUrls})`,
    `Eliminados: ${summary.removedArticles}`,
    `Modificados: ${summary.modifiedArticles}`,
    `Alertas técnicas: ${summary.technicalAlerts}`,
    '',
    'Cero impresiones no se interpreta como prueba de no indexación.',
    '',
    '## Cohortes',
    '',
    ...COHORTS.map((cohort) => `- ${cohort}: ${summary.cohortCounts[cohort]}`),
    '',
    '## Cohortes de publicación',
    '',
    `Semanas: ${Object.entries(summary.publicationCohorts.weeks).map(([key, count]) => `${key}=${count}`).join(' · ') || 'Sin fechas'}`,
    `Meses: ${Object.entries(summary.publicationCohorts.months).map(([key, count]) => `${key}=${count}`).join(' · ') || 'Sin fechas'}`,
    '',
    '## Altas detectadas',
    '',
    ...(deltas.newArticles.length
      ? deltas.newArticles.map((item) => `- ID ${item.id} · ${item.trial} · DOI ${item.doi} · ${item.canonical}`)
      : ['Sin altas desde la ejecución anterior.']),
    '',
    '## Seguimiento por artículo con fecha editorial o primera publicación confirmada',
    '',
  ];
  const dated = items.filter((item) => item.cohort !== 'LEGACY');
  if (!dated.length) lines.push('Sin artículos fechados para análisis por edad.');
  else {
    lines.push('| ID | Cohorte | HTTP | Canonical | Sitemap | Schema | Hub | Indexed | Impressions | Clicks |');
    lines.push('|---:|---|---:|---|---|---|---|---|---|---|');
    for (const item of dated) {
      lines.push(`| ${item.id} | ${item.cohort} | ${item.httpStatus ?? 'LOCAL'} | ${item.canonicalValid ? 'PASS' : 'FAIL'} | ${item.sitemapPresent ? 'PASS' : 'FAIL'} | ${item.schemaValid ? 'PASS' : 'FAIL'} | ${item.hubLinked ? 'PASS' : 'FAIL'} | ${item.indexed} | ${item.withImpressions ? 'YES' : 'NO'} | ${item.withClicks ? 'YES' : 'NO'} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function fetchHttpStatuses(urls, fetchImpl) {
  const values = await Promise.all(urls.map(async (url) => {
    try {
      const response = await fetchImpl(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'ResumenesTrialsObservation/1.0', 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(15000),
      });
      return [url, response.status];
    } catch {
      return [url, 0];
    }
  }));
  return new Map(values);
}

export async function runArticleDiscoveryMonitor({ env = process.env, logger = console.log, fetchImpl = globalThis.fetch } = {}) {
  const dataFile = env.GSC_DATA_FILE || 'seo-data/search-console.json';
  const reportDir = env.GSC_REPORT_DIR || 'reports';
  const stateFile = env.SEO_OBSERVATION_STATE_FILE || join(reportDir, 'inventory-state.json');
  const today = env.RT_MONITOR_TODAY || new Date().toISOString().slice(0, 10);
  const data = JSON.parse(readFileSync('resumenes.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('seo-manifest.json', 'utf8'));
  const clusterManifest = existsSync('seo-cluster-manifest.json') ? JSON.parse(readFileSync('seo-cluster-manifest.json', 'utf8')) : {};
  const sitemap = readFileSync('sitemap.xml', 'utf8');
  const gsc = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : { rows: [], inspections: [] };
  const previousState = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null;
  const navigationFiles = [
    '_includes/index-source.html',
    'medicina-critica/index.html',
    'medicina-interna/index.html',
    ...Object.values(clusterManifest).map((entry) => join(entry.path.replace(/^\//, ''), 'index.html')),
  ];
  const navigationCorpus = navigationFiles.filter(existsSync).map((file) => readFileSync(file, 'utf8')).join('\n');
  const previousIds = new Set((previousState?.records || []).map((item) => String(item.id)));
  const previousById = new Map((previousState?.records || []).map((item) => [String(item.id), item]));
  const urlsToCheck = data
    .filter((item) => {
      const previous = previousById.get(String(item.id));
      return isValidIsoDate(item[PUBLICATION_FIELD])
        || (previousState && !previousIds.has(String(item.id)))
        || Boolean(previous?.technicalPublicationDate)
        || Boolean(previous?.productionDatingCandidate);
    })
    .map((item) => manifest[String(item.id)]?.url)
    .filter(Boolean);
  const httpByUrl = env.RT_SKIP_HTTP === 'true' || typeof fetchImpl !== 'function'
    ? new Map()
    : await fetchHttpStatuses([...new Set(urlsToCheck)], fetchImpl);
  const observation = buildDynamicObservation({
    data,
    manifest,
    sitemap,
    gsc,
    previousState,
    today,
    navigationCorpus,
    httpByUrl,
    canonicalPageCount: existsSync('trials')
      ? readdirSync('trials', { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join('trials', entry.name, 'index.html'))).length
      : 0,
    readPage: (entry) => {
      const path = join(entry.path.replace(/^\//, ''), 'index.html');
      return existsSync(path) ? readFileSync(path, 'utf8') : '';
    },
  });
  mkdirSync(reportDir, { recursive: true });
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(join(reportDir, 'article-discovery.json'), `${JSON.stringify({
    version: observation.version,
    summary: observation.summary,
    deltas: observation.deltas,
    comparison: observation.comparison,
    items: observation.items.map(({ fingerprint: _fingerprint, ...item }) => item),
  }, null, 2)}\n`, 'utf8');
  writeFileSync(join(reportDir, 'article-discovery.md'), renderPrivateReport(observation), 'utf8');
  writeFileSync(stateFile, `${JSON.stringify(observation.state, null, 2)}\n`, 'utf8');
  logger('Post-publication monitoring: PASS');
  logger(`Dynamic inventory parity: ${observation.summary.parity ? 'PASS' : 'FAIL'}`);
  return observation;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    await runArticleDiscoveryMonitor();
  } catch (error) {
    console.error(`Post-publication monitoring: FAIL · ${error instanceof Error ? error.message : 'Error desconocido.'}`);
    process.exitCode = 1;
  }
}
