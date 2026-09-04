import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArticleMonitoring, checkpointForAge } from './article-discovery-monitor.mjs';

const canonical = 'https://resumenestrials.com/trials/alta-nueva/';
const item = { id: 151, titulo: 'Alta nueva', fecha_publicacion_resumen: '2026-08-07' };
const manifest = { 151: { path: '/trials/alta-nueva/', url: canonical } };
const sitemap = `<loc>${canonical}</loc>`;
const page = `<link rel="canonical" href="${canonical}"><article>Contenido</article>`;

test('separa publicado, discoverable, indexed, impresiones y clics', () => {
  const result = buildArticleMonitoring({
    data: [item], manifest, sitemap, today: '2026-09-04',
    readPage: () => page,
    gsc: {
      rows: [{ page: canonical, impressions: 3, clicks: 1 }],
      inspections: [{ url: canonical, verdict: 'PASS' }],
    },
  })[0];
  assert.equal(result.checkpoint, 'D28_PRIMERA_EVALUACION');
  assert.equal(result.published, true);
  assert.equal(result.discoverable, true);
  assert.equal(result.indexed, 'CONFIRMED');
  assert.equal(result.withImpressions, true);
  assert.equal(result.withClicks, true);
  assert.equal(result.attention, 'NONE');
});

test('cero impresiones nunca se declara como no indexado', () => {
  const result = buildArticleMonitoring({
    data: [item], manifest, sitemap, today: '2026-09-04', readPage: () => page,
    gsc: { rows: [], inspections: [] },
  })[0];
  assert.equal(result.indexed, 'UNKNOWN');
  assert.equal(result.withImpressions, false);
  assert.equal(result.attention, 'REVIEW_NO_IMPRESSIONS');
  assert.notEqual(result.indexed, 'NOT_INDEXED');
});

test('aplica ventanas D0, D7, D14 y D28 sin alertas intermedias', () => {
  assert.equal(checkpointForAge(0), 'D0_PUBLICACION_TECNICA');
  assert.equal(checkpointForAge(7), 'D7_DESCUBRIMIENTO_TECNICO');
  assert.equal(checkpointForAge(14), 'D14_PRIMERAS_SENALES_GSC');
  assert.equal(checkpointForAge(28), 'D28_PRIMERA_EVALUACION');
});

