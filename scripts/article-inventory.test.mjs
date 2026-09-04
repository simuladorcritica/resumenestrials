import test from 'node:test';
import assert from 'node:assert/strict';
import { auditArticleData, compareCoverage, expectedEntry, slugForRecord } from './article-inventory.mjs';

const record = (id, title, doi = `10.1000/${id}`) => ({
  id,
  titulo: title,
  autor: 'Equipo',
  revista: 'Revista',
  anio: 2026,
  fecha: '2026-01-01',
  registro: `NCT${id}`,
  doi,
  financiacion: 'Declarada',
  original: `https://example.org/${id}`,
  especialidad_principal: 'Medicina Interna',
  especialidad_secundaria: '',
  temas: ['Tema'],
  tipo_estudio: 'Ensayo clínico aleatorizado',
  objetivo: 'Objetivo',
  hallazgo: 'Hallazgo',
  cuerpo: '<p>Cuerpo</p>',
  corto: '<p>Corto</p>',
});

function generatedState(data) {
  const manifest = Object.fromEntries(data.map((item) => {
    const entry = expectedEntry(item);
    return [entry.id, { slug: entry.slug, path: entry.path, url: entry.url }];
  }));
  return {
    manifest,
    sitemap: Object.values(manifest).map((entry) => entry.url),
    pages: Object.values(manifest).map((entry) => entry.slug),
  };
}

test('la cobertura se deriva del tamaño real del JSON', () => {
  const data = [record(1, 'TRIAL-A: tratamiento uno'), record(2, 'TRIAL-B: tratamiento dos')];
  const state = generatedState(data);
  const coverage = compareCoverage(data, state.manifest, state.sitemap, state.pages);
  assert.equal(coverage.ok, true);
  assert.deepEqual(coverage.counts, { json: data.length, manifest: data.length, sitemap: data.length, pages: data.length });
});

test('falla cuando JSON supera páginas, manifiesto o sitemap', () => {
  const data = [record(1, 'TRIAL-A: uno'), record(2, 'TRIAL-B: dos'), record(3, 'TRIAL-C: tres')];
  const partial = generatedState(data.slice(0, 2));
  const coverage = compareCoverage(data, partial.manifest, partial.sitemap, partial.pages);
  assert.equal(coverage.ok, false);
  assert.deepEqual(coverage.missingManifest, ['3']);
  assert.deepEqual(coverage.missingSitemap, ['3']);
  assert.deepEqual(coverage.missingPages, ['3']);
});

test('bloquea ID, DOI, slug, canonical y sitemap duplicados', () => {
  const duplicateData = [record(1, 'TRIAL-A: uno', '10.1000/x'), record(1, 'TRIAL-A: uno', 'https://doi.org/10.1000/X')];
  const audit = auditArticleData(duplicateData);
  assert.equal(audit.duplicateIds.length, 1);
  assert.equal(audit.duplicateDois.length, 1);
  assert.equal(audit.duplicateSlugs.length, 1);
  const clean = [record(1, 'TRIAL-A: uno'), record(2, 'TRIAL-B: dos')];
  const state = generatedState(clean);
  state.manifest['2'].url = state.manifest['1'].url;
  state.sitemap.push(state.sitemap[0]);
  const coverage = compareCoverage(clean, state.manifest, state.sitemap, state.pages);
  assert.equal(coverage.ok, false);
  assert.equal(coverage.duplicateCanonicals, 1);
  assert.equal(coverage.duplicateSitemap, 1);
});

test('el slug no depende de una cifra fija', () => {
  assert.equal(slugForRecord(record(999, 'FUTURE-X: nueva evidencia clínica')), 'future-x-nueva-evidencia-clinica');
});
