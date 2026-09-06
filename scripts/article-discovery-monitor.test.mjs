import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDynamicObservation, cohortForAge } from './article-discovery-monitor.mjs';

const canonical = 'https://resumenestrials.com/trials/alta-nueva/';
const page = `<link rel="canonical" href="${canonical}"><script type="application/ld+json">{"@type":"Article"}</script><script type="application/ld+json">{"@type":"BreadcrumbList"}</script><article>Contenido</article>`;

function record(id, publicationDate = null) {
  return {
    id,
    titulo: `Alta ${id}`,
    doi: `10.9999/dynamic.${id}`,
    revista: 'Journal fixture',
    especialidad_principal: 'Medicina Crítica',
    especialidad_secundaria: '',
    ...(publicationDate ? { fecha_publicacion_resumen: publicationDate } : {}),
  };
}

function manifestFor(data) {
  return Object.fromEntries(data.map((item) => [String(item.id), {
    path: `/trials/alta-${item.id}/`,
    url: `https://resumenestrials.com/trials/alta-${item.id}/`,
    clusters: [{ name: 'Sepsis y shock' }],
  }]));
}

function observe(data, options = {}) {
  const manifest = manifestFor(data);
  const sitemap = Object.values(manifest).map((entry) => `<loc>${entry.url}</loc>`).join('');
  return buildDynamicObservation({
    data,
    manifest,
    sitemap,
    today: options.today || '2026-09-04',
    previousState: options.previousState || null,
    gsc: options.gsc || { rows: [], inspections: [] },
    httpByUrl: options.httpByUrl || new Map(),
    canonicalPageCount: options.canonicalPageCount ?? null,
    navigationCorpus: Object.values(manifest).map((entry) => `<a href="${new URL(entry.url).pathname}">Trial</a>`).join(''),
    readPage: (entry) => page.replaceAll(canonical, entry.url),
  });
}

test('separa publicación, discoverability, indexación, impresiones y clics', () => {
  const data = [record(151, '2026-08-07')];
  const result = observe(data, {
    gsc: {
      rows: [{ page: manifestFor(data)['151'].url, impressions: 3, clicks: 1 }],
      inspections: [{ url: manifestFor(data)['151'].url, verdict: 'PASS' }],
    },
  }).items[0];
  assert.equal(result.cohort, 'D28_59');
  assert.equal(result.published, true);
  assert.equal(result.discoverable, true);
  assert.equal(result.indexed, 'CONFIRMED');
  assert.equal(result.withImpressions, true);
  assert.equal(result.withClicks, true);
  assert.equal(result.attention, 'NONE');
});

test('cero impresiones nunca se declara como no indexado', () => {
  const result = observe([record(151, '2026-08-07')]).items[0];
  assert.equal(result.indexed, 'UNKNOWN');
  assert.equal(result.withImpressions, false);
  assert.equal(result.attention, 'REVIEW_NO_IMPRESSIONS');
  assert.notEqual(result.indexed, 'NOT_INDEXED');
});

test('aplica todas las cohortes dinámicas y conserva LEGACY', () => {
  assert.equal(cohortForAge(Number.NaN), 'LEGACY');
  assert.equal(cohortForAge(0), 'D0_6');
  assert.equal(cohortForAge(6), 'D0_6');
  assert.equal(cohortForAge(7), 'D7_13');
  assert.equal(cohortForAge(13), 'D7_13');
  assert.equal(cohortForAge(14), 'D14_27');
  assert.equal(cohortForAge(27), 'D14_27');
  assert.equal(cohortForAge(28), 'D28_59');
  assert.equal(cohortForAge(59), 'D28_59');
  assert.equal(cohortForAge(60), 'D60_89');
  assert.equal(cohortForAge(89), 'D60_89');
  assert.equal(cohortForAge(90), 'D90_PLUS');
  const legacy = observe([record(1)]).items[0];
  assert.equal(legacy.cohort, 'LEGACY');
  assert.equal(legacy.publicationDate, null);
  assert.equal(legacy.technicalPublicationDate, null);
});

test('calcula delta, primera detección y transición de cohorte sin inventar fechas históricas', () => {
  const initial = observe([record(1), record(2, '2026-08-22')], { today: '2026-09-04' });
  const changed = [record(2, '2026-08-22'), record(3, '2026-09-11')];
  const next = observe(changed, { today: '2026-09-11', previousState: initial.state });
  assert.equal(next.summary.previousArticleCount, 2);
  assert.equal(next.summary.currentArticleCount, 2);
  assert.equal(next.summary.newArticles, 1);
  assert.equal(next.summary.removedArticles, 1);
  assert.equal(next.deltas.newArticles[0].id, '3');
  assert.equal(next.deltas.removedArticles[0].id, '1');
  assert.equal(next.items.find((item) => item.id === '3').firstDetectedAt, '2026-09-11');
  assert.equal(next.items.find((item) => item.id === '2').cohort, 'D14_27');
  assert.equal(next.summary.transitions.D14_27, 1);
  assert.equal(next.summary.newD0Articles, 1);
  assert.equal(next.summary.articlesAddedThisMonth, 1);
  assert.equal(next.summary.previousEligibleArticleCount, 1);
  assert.equal(next.summary.eligibleArticleCount, 0);
  assert.deepEqual(next.summary.publicationCohorts.weeks, { '2026-W34': 1, '2026-W37': 1 });
});

test('fecha una alta sin fecha editorial cuando su publicación se confirma después', () => {
  const baseline = observe([record(1)], { today: '2026-09-01' });
  const withPending = [record(1), record(2)];
  const url = manifestFor(withPending)['2'].url;
  const pending = observe(withPending, {
    today: '2026-09-02',
    previousState: baseline.state,
    httpByUrl: new Map([[url, 0]]),
  });
  assert.equal(pending.items.find((item) => item.id === '2').technicalPublicationDate, null);
  const confirmed = observe(withPending, {
    today: '2026-09-03',
    previousState: pending.state,
    httpByUrl: new Map([[url, 200]]),
  });
  const article = confirmed.items.find((item) => item.id === '2');
  assert.equal(article.technicalPublicationDate, '2026-09-03');
  assert.equal(article.publicationDateSource, 'FIRST_CONFIRMED_PRODUCTION');
  assert.equal(article.cohort, 'D0_6');
  assert.equal(confirmed.items.find((item) => item.id === '1').cohort, 'LEGACY');
});

test('detecta modificaciones por identidad y mantiene paridad dinámica con 1000 artículos', () => {
  const firstData = [record(1)];
  const initial = observe(firstData);
  const modified = [{ ...record(1), titulo: 'Título modificado' }];
  const delta = observe(modified, { previousState: initial.state });
  assert.equal(delta.summary.modifiedArticles, 1);

  const large = Array.from({ length: 1000 }, (_, index) => record(index + 1));
  const largeObservation = observe(large);
  assert.equal(largeObservation.summary.currentArticleCount, 1000);
  assert.equal(largeObservation.summary.currentMaxId, 1000);
  assert.equal(largeObservation.summary.currentCanonicalPages, 1000);
  assert.equal(largeObservation.summary.currentSitemapUrls, 1000);
  assert.equal(largeObservation.summary.parity, true);
  assert.equal(largeObservation.summary.cohortCounts.LEGACY, 1000);

  const extraPage = observe([record(1)], { canonicalPageCount: 2 });
  assert.equal(extraPage.summary.currentCanonicalPages, 2);
  assert.equal(extraPage.summary.parity, false);
});
