import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOpportunityBaseline, renderMonthly, renderQuarterly, renderWeekly } from './seo-opportunities.mjs';

const config = {
  siteUrl: 'sc-domain:resumenestrials.com',
  expectedCtr: { 3: 0.1, 10: 0.05, 20: 0.02, 100: 0.01 },
};

function fixture() {
  const data = [1, 2, 3, 4].map((id) => ({
    id,
    titulo: `Trial ${id}`,
    revista: id === 3 ? 'Journal A' : 'Journal B',
    especialidad_principal: 'Medicina Crítica',
    especialidad_secundaria: '',
  }));
  const manifest = Object.fromEntries(data.map((item) => [String(item.id), {
    url: `https://resumenestrials.com/trials/trial-${item.id}/`,
    clusters: [{ name: 'Sepsis y shock' }],
  }]));
  const cohorts = ['D0_6', 'D14_27', 'D28_59', 'LEGACY'];
  const observation = {
    summary: {
      previousArticleCount: 3,
      currentArticleCount: 4,
      newArticles: 1,
      removedArticles: 0,
      modifiedArticles: 0,
      newD0Articles: 1,
      articlesAddedThisMonth: 1,
      monthStartCount: 3,
      inventoryGrowthPercent: 33.33,
      cohortCounts: { LEGACY: 1, D0_6: 1, D7_13: 0, D14_27: 1, D28_59: 1, D60_89: 0, D90_PLUS: 0 },
      transitions: { D0_6: 1, D7_13: 0, D14_27: 1, D28_59: 1, D60_89: 0, D90_PLUS: 0 },
    },
    comparison: {
      previousEligibleCanonicals: [manifest['3'].url],
    },
    items: data.map((item, index) => ({
      canonical: manifest[String(item.id)].url,
      cohort: cohorts[index],
      ageDays: index === 3 ? null : [2, 20, 35][index],
      publicationWeek: index === 2 ? '2026-W31' : null,
      publicationMonth: index === 2 ? '2026-08' : null,
    })),
  };
  const rows = [];
  for (const id of [1, 2, 3]) {
    rows.push({ date: '2026-09-01', query: `query-${id}`, page: manifest[String(id)].url, clicks: 5, impressions: 100, ctr: 0.05, position: 12 });
  }
  rows.push({ date: '2026-08-04', query: 'query-3', page: manifest['3'].url, clicks: 1, impressions: 50, ctr: 0.02, position: 15 });
  return {
    data,
    manifest,
    clusters: {},
    observation,
    config,
    gsc: { property: config.siteUrl, rows },
  };
}

test('excluye D0–13, mantiene D14–27 preliminar y clasifica oportunidades maduras', () => {
  const baseline = buildOpportunityBaseline(fixture());
  assert.deepEqual(baseline.opportunities.find((item) => item.id === '1').classifications, ['TOO_EARLY']);
  assert.deepEqual(baseline.opportunities.find((item) => item.id === '2').classifications, ['PRELIMINARY']);
  const mature = baseline.opportunities.find((item) => item.id === '3');
  assert.ok(mature.classifications.includes('QUICK_WIN'));
  assert.ok(mature.classifications.includes('EMERGING'));
  assert.ok(mature.classifications.includes('STRONG'));
  assert.deepEqual(baseline.opportunities.find((item) => item.id === '4').classifications, ['NO_SIGNAL_YET']);
});

test('informa rendimiento por artículo elegible y separa crecimiento de inventario', () => {
  const baseline = buildOpportunityBaseline(fixture());
  assert.equal(baseline.eligibleArticleCount, 2);
  assert.equal(baseline.previousEligibleArticleCount, 1);
  assert.equal(baseline.windows.current28.impressions, 100);
  assert.equal(baseline.windows.current28.perEligibleArticle.impressions, 50);
  assert.equal(baseline.windows.previous28.impressions, 50);
  assert.equal(baseline.windows.previous28.perEligibleArticle.impressions, 50);
  assert.equal(baseline.groups.ageCohorts.find((item) => item.name === 'D28_59').impressions, 100);
  assert.equal(baseline.groups.agePublicationMonths[0].name, 'D28_59 · 2026-08');
  assert.match(renderWeekly(baseline), /Inventario anterior: 3[\s\S]*Inventario actual: 4[\s\S]*Nuevos artículos: 1/);
  assert.match(renderWeekly(baseline), /Nuevos D0–6: 1/);
  assert.match(renderMonthly(baseline), /Crecimiento de inventario[\s\S]*Artículos final del mes: 4[\s\S]*Altas del mes: 1[\s\S]*Crecimiento SEO ajustado[\s\S]*Cohorte de edad × mes de publicación/);
  assert.match(renderQuarterly(baseline), /D0–13 están excluidas y D14–27 permanecen preliminares/);
});
