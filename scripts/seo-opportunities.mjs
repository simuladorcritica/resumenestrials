import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIN_IMPRESSIONS = 20;

function dayShift(value, amount) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function aggregateRows(rows, endDate, windowDays, offset = 0) {
  const end = dayShift(endDate, -offset);
  const start = dayShift(end, -(windowDays - 1));
  const map = new Map();
  for (const row of rows) {
    if (row.date < start || row.date > end) continue;
    const current = map.get(row.page) || {
      page: row.page,
      clicks: 0,
      impressions: 0,
      positionNumerator: 0,
      queries: new Map(),
    };
    const impressions = Number(row.impressions) || 0;
    current.clicks += Number(row.clicks) || 0;
    current.impressions += impressions;
    current.positionNumerator += (Number(row.position) || 0) * impressions;
    const query = current.queries.get(row.query) || { clicks: 0, impressions: 0 };
    query.clicks += Number(row.clicks) || 0;
    query.impressions += impressions;
    current.queries.set(row.query, query);
    map.set(row.page, current);
  }
  return new Map([...map].map(([page, value]) => [page, {
    ...value,
    ctr: value.impressions ? value.clicks / value.impressions : 0,
    position: value.impressions ? value.positionNumerator / value.impressions : 0,
  }]));
}

function expectedCtrFor(position, config) {
  const entries = Object.entries(config.expectedCtr)
    .map(([rank, ctr]) => [Number(rank), ctr])
    .sort((left, right) => left[0] - right[0]);
  return (entries.find(([rank]) => position <= rank) || entries.at(-1))[1];
}

function eligibility(cohort) {
  if (cohort === 'D0_6' || cohort === 'D7_13') return 'TOO_EARLY';
  if (cohort === 'D14_27') return 'PRELIMINARY';
  return 'ELIGIBLE';
}

export function classifyOpportunity({ current, previous, cohort, config }) {
  const status = eligibility(cohort);
  if (status !== 'ELIGIBLE') return [status];
  if (current.impressions < MIN_IMPRESSIONS) return ['NO_SIGNAL_YET'];
  const expectedCtr = expectedCtrFor(current.position, config);
  const ctrGap = Math.max(0, expectedCtr - current.ctr) / Math.max(expectedCtr, 0.001);
  const classifications = [];
  if (current.position >= 8 && current.position <= 20) classifications.push('QUICK_WIN');
  if (current.position > 0 && current.position <= 12 && ctrGap > 0.25) classifications.push('CTR_OPPORTUNITY');
  if (previous.impressions >= 10 && current.impressions >= previous.impressions * 1.25) classifications.push('EMERGING');
  if (current.clicks >= 3 && current.clicks > previous.clicks && current.impressions >= previous.impressions) classifications.push('STRONG');
  return classifications.length ? classifications : ['OBSERVE'];
}

function emptyMetrics(page) {
  return { page, clicks: 0, impressions: 0, ctr: 0, position: 0, queries: new Map() };
}

function groupMetrics(opportunities, valueSelector) {
  const groups = new Map();
  for (const item of opportunities) {
    if (item.eligibility !== 'ELIGIBLE') continue;
    for (const value of valueSelector(item).filter(Boolean)) {
      const group = groups.get(value) || { name: value, clicks: 0, impressions: 0, eligibleIds: new Set() };
      group.clicks += item.clicks;
      group.impressions += item.impressions;
      group.eligibleIds.add(item.id);
      groups.set(value, group);
    }
  }
  return [...groups.values()].map((group) => {
    const eligibleArticles = group.eligibleIds.size;
    return {
      name: group.name,
      clicks: group.clicks,
      impressions: group.impressions,
      eligibleArticles,
      clicksPerEligibleArticle: eligibleArticles ? Number((group.clicks / eligibleArticles).toFixed(2)) : null,
      impressionsPerEligibleArticle: eligibleArticles ? Number((group.impressions / eligibleArticles).toFixed(2)) : null,
    };
  }).sort((left, right) => right.impressions - left.impressions || left.name.localeCompare(right.name));
}

function totals(values, eligibleIds = null) {
  return [...values.values()].reduce((total, item) => {
    if (eligibleIds && !eligibleIds.has(item.page)) return total;
    total.clicks += item.clicks;
    total.impressions += item.impressions;
    return total;
  }, { clicks: 0, impressions: 0 });
}

function perEligible(total, eligibleCount) {
  return {
    clicks: eligibleCount ? Number((total.clicks / eligibleCount).toFixed(2)) : null,
    impressions: eligibleCount ? Number((total.impressions / eligibleCount).toFixed(2)) : null,
  };
}

export function buildOpportunityBaseline({ data, manifest, clusters, gsc, observation, config }) {
  const rows = Array.isArray(gsc.rows) ? gsc.rows : [];
  const endDate = rows.length ? rows.map((row) => row.date).sort().at(-1) : new Date().toISOString().slice(0, 10);
  const windows = {
    current7: aggregateRows(rows, endDate, 7),
    previous7: aggregateRows(rows, endDate, 7, 7),
    current28: aggregateRows(rows, endDate, 28),
    previous28: aggregateRows(rows, endDate, 28, 28),
    current90: aggregateRows(rows, endDate, 90),
    previous90: aggregateRows(rows, endDate, 90, 90),
  };
  const observationByUrl = new Map((observation?.items || []).map((item) => [item.canonical, item]));
  const opportunities = data.map((record) => {
    const id = String(record.id);
    const entry = manifest[id];
    const page = entry?.url;
    const current = windows.current28.get(page) || emptyMetrics(page);
    const previous = windows.previous28.get(page) || emptyMetrics(page);
    const observed = observationByUrl.get(page);
    const cohort = observed?.cohort || 'LEGACY';
    const classifications = classifyOpportunity({ current, previous, cohort, config });
    return {
      id,
      trial: String(record.titulo || ''),
      page,
      journal: String(record.revista || ''),
      specialties: [record.especialidad_principal, record.especialidad_secundaria].filter(Boolean),
      clusters: Array.isArray(entry?.clusters) ? entry.clusters.map((cluster) => cluster.name) : [],
      cohort,
      ageDays: observed?.ageDays ?? null,
      publicationWeek: observed?.publicationWeek || null,
      publicationMonth: observed?.publicationMonth || null,
      eligibility: eligibility(cohort),
      classifications,
      clicks: current.clicks,
      impressions: current.impressions,
      ctr: Number(current.ctr.toFixed(4)),
      position: Number(current.position.toFixed(1)),
      clickChange: current.clicks - previous.clicks,
      impressionChange: current.impressions - previous.impressions,
    };
  });
  const eligibleUrls = new Set(opportunities
    .filter((item) => item.eligibility === 'ELIGIBLE' && item.page)
    .map((item) => item.page));
  const previousEligibleUrls = new Set(
    observation?.comparison?.previousEligibleCanonicals?.filter(Boolean) || [...eligibleUrls],
  );
  const eligibleCount = eligibleUrls.size;
  const previousEligibleCount = previousEligibleUrls.size;
  const windowSummaries = Object.fromEntries(Object.entries(windows).map(([name, values]) => {
    const isPrevious = name.startsWith('previous');
    const denominatorUrls = isPrevious ? previousEligibleUrls : eligibleUrls;
    const denominatorCount = isPrevious ? previousEligibleCount : eligibleCount;
    const total = totals(values, denominatorUrls);
    return [name, {
      ...total,
      eligibleArticleCount: denominatorCount,
      perEligibleArticle: perEligible(total, denominatorCount),
    }];
  }));
  return {
    generatedAt: new Date().toISOString(),
    dataEndDate: endDate,
    property: gsc.property || config.siteUrl,
    inventory: observation?.summary || {
      previousArticleCount: data.length,
      currentArticleCount: data.length,
      newArticles: 0,
      removedArticles: 0,
      modifiedArticles: 0,
      newD0Articles: 0,
      articlesAddedThisMonth: 0,
      cohortCounts: { LEGACY: data.length, D0_6: 0, D7_13: 0, D14_27: 0, D28_59: 0, D60_89: 0, D90_PLUS: 0 },
      transitions: { D0_6: 0, D7_13: 0, D14_27: 0, D28_59: 0, D60_89: 0, D90_PLUS: 0 },
      monthStartCount: data.length,
      inventoryGrowthPercent: 0,
    },
    eligibleArticleCount: eligibleCount,
    previousEligibleArticleCount: previousEligibleCount,
    windows: windowSummaries,
    opportunities,
    groups: {
      journals: groupMetrics(opportunities, (item) => [item.journal]),
      specialties: groupMetrics(opportunities, (item) => item.specialties),
      clusters: groupMetrics(opportunities, (item) => item.clusters),
      ageCohorts: groupMetrics(opportunities, (item) => [item.cohort]),
      publicationWeeks: groupMetrics(opportunities, (item) => [item.publicationWeek]),
      publicationMonths: groupMetrics(opportunities, (item) => [item.publicationMonth]),
      agePublicationMonths: groupMetrics(opportunities, (item) => [item.publicationMonth ? `${item.cohort} · ${item.publicationMonth}` : null]),
    },
  };
}

function transitionLines(inventory) {
  return [
    `Nuevos D0–6: ${inventory.newD0Articles ?? 0}`,
    `Pasaron a D7–13: ${inventory.transitions?.D7_13 ?? 0}`,
    `Pasaron a D14–27: ${inventory.transitions?.D14_27 ?? 0}`,
    `Pasaron a D28–59: ${inventory.transitions?.D28_59 ?? 0}`,
    `Pasaron a D60–89: ${inventory.transitions?.D60_89 ?? 0}`,
    `Pasaron a D90+: ${inventory.transitions?.D90_PLUS ?? 0}`,
  ];
}

function metricTable(current, previous) {
  return [
    '| Métrica elegible | Actual | Anterior | Cambio |',
    '|---|---:|---:|---:|',
    `| Clicks | ${current.clicks} | ${previous.clicks} | ${current.clicks - previous.clicks} |`,
    `| Impressions | ${current.impressions} | ${previous.impressions} | ${current.impressions - previous.impressions} |`,
    `| Clicks/artículo elegible | ${current.perEligibleArticle.clicks ?? 'N/D'} | ${previous.perEligibleArticle.clicks ?? 'N/D'} | — |`,
    `| Impressions/artículo elegible | ${current.perEligibleArticle.impressions ?? 'N/D'} | ${previous.perEligibleArticle.impressions ?? 'N/D'} | — |`,
  ];
}

function topOpportunityLines(baseline) {
  const priority = { STRONG: 4, EMERGING: 3, QUICK_WIN: 2, CTR_OPPORTUNITY: 1 };
  const useful = baseline.opportunities.filter((item) => item.classifications.some((value) => ['QUICK_WIN', 'CTR_OPPORTUNITY', 'EMERGING', 'STRONG'].includes(value)));
  useful.sort((left, right) => {
    const leftPriority = Math.max(...left.classifications.map((value) => priority[value] || 0));
    const rightPriority = Math.max(...right.classifications.map((value) => priority[value] || 0));
    return rightPriority - leftPriority || right.impressions - left.impressions || left.id.localeCompare(right.id);
  });
  return useful.slice(0, 10).map((item) => `- ${item.classifications.join(', ')} · ${item.cohort} · ${item.page} · ${item.clicks} clicks · ${item.impressions} impressions · posición ${item.position}`);
}

function topGroupLines(groups) {
  const lines = [];
  for (const [label, values] of [
    ['Cohortes de edad', groups.ageCohorts],
    ['Cohorte de edad × mes de publicación', groups.agePublicationMonths],
    ['Semanas de publicación', groups.publicationWeeks],
    ['Meses de publicación', groups.publicationMonths],
    ['Revistas', groups.journals],
    ['Especialidades', groups.specialties],
    ['Clústeres', groups.clusters],
  ]) {
    lines.push(`### ${label}`, '');
    const useful = values.filter((item) => item.eligibleArticles > 0 && item.impressions >= MIN_IMPRESSIONS).slice(0, 5);
    lines.push(...(useful.length
      ? useful.map((item) => `- ${item.name}: ${item.clicks} clicks · ${item.impressions} impressions · ${item.impressionsPerEligibleArticle} impressions/artículo elegible`)
      : ['Sin volumen suficiente.']));
    lines.push('');
  }
  return lines;
}

export function renderWeekly(baseline) {
  const inventory = baseline.inventory;
  return `${[
    '# SEO WEEKLY DYNAMIC REPORT',
    '',
    `Inventario anterior: ${inventory.previousArticleCount}`,
    `Inventario actual: ${inventory.currentArticleCount}`,
    `Nuevos artículos: ${inventory.newArticles}`,
    `Total actual: ${inventory.currentArticleCount}`,
    '',
    ...transitionLines(inventory),
    '',
    `Artículos elegibles para rendimiento: ${baseline.eligibleArticleCount}`,
    `Artículos elegibles en el periodo anterior: ${baseline.previousEligibleArticleCount}`,
    '',
    ...metricTable(baseline.windows.current7, baseline.windows.previous7),
    '',
    '## Oportunidades maduras',
    '',
    ...(topOpportunityLines(baseline).length ? topOpportunityLines(baseline) : ['Sin oportunidades maduras con volumen suficiente.']),
  ].join('\n')}\n`;
}

export function renderMonthly(baseline) {
  const inventory = baseline.inventory;
  return `${[
    '# SEO MONTHLY DYNAMIC REPORT',
    '',
    '## Crecimiento de inventario',
    '',
    `Artículos inicio del mes: ${inventory.monthStartCount}`,
    `Artículos final del mes: ${inventory.currentArticleCount}`,
    `Altas del mes: ${inventory.articlesAddedThisMonth ?? inventory.newArticles}`,
    `Crecimiento porcentual del inventario: ${inventory.inventoryGrowthPercent}%`,
    '',
    '## Crecimiento SEO ajustado por inventario elegible',
    '',
    `Artículos elegibles: ${baseline.eligibleArticleCount}`,
    `Artículos elegibles en el periodo anterior: ${baseline.previousEligibleArticleCount}`,
    '',
    ...metricTable(baseline.windows.current28, baseline.windows.previous28),
    '',
    'El crecimiento total y el rendimiento por artículo se informan por separado.',
    '',
    '## Tendencias con volumen suficiente',
    '',
    ...topGroupLines(baseline.groups),
  ].join('\n')}\n`;
}

export function renderQuarterly(baseline) {
  return `${[
    '# SEO 90-DAY DYNAMIC REPORT',
    '',
    `Periodo terminado: ${baseline.dataEndDate}`,
    `Inventario actual: ${baseline.inventory.currentArticleCount}`,
    `Artículos elegibles: ${baseline.eligibleArticleCount}`,
    `Artículos elegibles en el periodo anterior: ${baseline.previousEligibleArticleCount}`,
    '',
    ...metricTable(baseline.windows.current90, baseline.windows.previous90),
    '',
    'Las páginas D0–13 están excluidas y D14–27 permanecen preliminares.',
  ].join('\n')}\n`;
}

export function runOpportunityEngine({ env = process.env, logger = console.log } = {}) {
  const input = env.GSC_DATA_FILE || 'seo-data/search-console.json';
  const outputDir = env.GSC_REPORT_DIR || 'reports';
  const observationFile = env.SEO_OBSERVATION_FILE || join(outputDir, 'article-discovery.json');
  const config = JSON.parse(readFileSync('seo-config.json', 'utf8'));
  const data = JSON.parse(readFileSync('resumenes.json', 'utf8'));
  const manifest = JSON.parse(readFileSync('seo-manifest.json', 'utf8'));
  const clusters = JSON.parse(readFileSync('seo-cluster-manifest.json', 'utf8'));
  const gsc = existsSync(input) ? JSON.parse(readFileSync(input, 'utf8')) : { property: config.siteUrl, rows: [] };
  const observation = existsSync(observationFile) ? JSON.parse(readFileSync(observationFile, 'utf8')) : null;
  const baseline = buildOpportunityBaseline({ data, manifest, clusters, gsc, observation, config });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'seo-opportunities.json'), `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  writeFileSync(join(outputDir, 'seo-weekly.md'), renderWeekly(baseline), 'utf8');
  writeFileSync(join(outputDir, 'seo-monthly.md'), renderMonthly(baseline), 'utf8');
  writeFileSync(join(outputDir, 'seo-quarterly.md'), renderQuarterly(baseline), 'utf8');
  logger('Opportunity Engine: PASS');
  logger('Private dynamic reports generated: PASS');
  return baseline;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    runOpportunityEngine();
  } catch (error) {
    console.error(`Opportunity Engine: FAIL · ${error instanceof Error ? error.message : 'Error desconocido.'}`);
    process.exitCode = 1;
  }
}
