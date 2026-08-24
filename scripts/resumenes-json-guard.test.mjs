import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareResumenesJson,
  normalizeDoi,
  normalizeTitle,
  sha256,
} from './resumenes-json-guard.mjs';

function article(id, overrides = {}) {
  return {
    id,
    titulo: `Artículo clínico ${id}`,
    autor: 'Autor',
    revista: 'Revista',
    fecha: '2026-08-24',
    doi: `10.1000/TEST.${id}`,
    objetivo: 'Objetivo sin cambios',
    cuerpo: '<p>Contenido protegido</p>',
    corto: '<p>Resumen protegido</p>',
    ...overrides,
  };
}

function compare(main, local) {
  return compareResumenesJson(JSON.stringify(main), JSON.stringify(local));
}

test('ignora formato, orden de claves y orden de artículos', () => {
  const first = article(1);
  const second = article(2);
  const reorderedKeys = Object.fromEntries(Object.entries(first).reverse());
  const mainText = JSON.stringify([first, second]);
  const localText = `\n[${JSON.stringify(second, null, 4)},${JSON.stringify(reorderedKeys, null, 2)}]\n`;
  const result = compareResumenesJson(mainText, localText);
  assert.equal(result.status, 'no_changes');
  assert.equal(result.counts.new, 0);
  assert.deepEqual(result.errors, []);
  assert.notEqual(result.mainSha256, result.localSha256);
});

test('detecta exclusivamente artículos realmente nuevos', () => {
  const result = compare([article(1)], [article(1), article(2)]);
  assert.equal(result.status, 'new_articles');
  assert.equal(result.counts.new, 1);
  assert.equal(result.newArticles[0].id, '2');
  assert.equal(result.newArticles[0].doi, '10.1000/test.2');
});

test('el ID interno tiene prioridad y una modificación queda bloqueada', () => {
  const result = compare([article(1)], [article(1, { doi: '10.1000/otro' })]);
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((error) => error.code === 'EXISTING_ARTICLE_MODIFIED' && error.matchedBy === 'id'));
  assert.equal(result.counts.new, 0);
});

test('usa DOI normalizado cuando el ID no coincide', () => {
  const result = compare(
    [article(1, { doi: 'https://doi.org/10.1000/ABC' })],
    [article(99, { doi: 'doi: 10.1000/abc' })],
  );
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((error) => error.code === 'EXISTING_ARTICLE_MODIFIED' && error.matchedBy === 'doi'));
  assert.equal(result.counts.new, 0);
});

test('usa el título normalizado únicamente como último recurso', () => {
  const result = compare(
    [article(1, { doi: '', titulo: 'Oxígeno: evaluación crítica' })],
    [article(55, { doi: '', titulo: 'OXIGENO — evaluacion critica!' })],
  );
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((error) => error.code === 'EXISTING_ARTICLE_MODIFIED' && error.matchedBy === 'title'));
});

test('bloquea la eliminación de un artículo existente', () => {
  const result = compare([article(1), article(2)], [article(2)]);
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((error) => error.code === 'EXISTING_ARTICLE_REMOVED'));
});

test('bloquea IDs duplicados incluso si cambia el tipo JSON', () => {
  const result = compare([article(1)], [article(1), article('1', { doi: '10.1000/unique' })]);
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((error) => error.code === 'LOCAL_DUPLICATE_ID'));
});

test('bloquea DOI duplicados después de normalizar URL, prefijo y mayúsculas', () => {
  const result = compare([article(1)], [
    article(1, { doi: 'https://doi.org/10.1000/DUP' }),
    article(2, { doi: ' DOI: 10.1000/dup ' }),
  ]);
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((error) => error.code === 'LOCAL_DUPLICATE_DOI'));
});

test('bloquea JSON inválido antes de comparar artículos', () => {
  const result = compareResumenesJson(JSON.stringify([article(1)]), '[{"id":1,]');
  assert.equal(result.status, 'blocked');
  assert.equal(result.counts.local, null);
  assert.ok(result.errors.some((error) => error.code === 'LOCAL_JSON_INVALID'));
});

test('bloquea cualquier cambio semántico en contenido existente', () => {
  const result = compare([article(1)], [article(1, { cuerpo: '<p>Contenido médico modificado</p>' })]);
  assert.equal(result.status, 'blocked');
  const error = result.errors.find((item) => item.code === 'EXISTING_ARTICLE_MODIFIED');
  assert.deepEqual(error.changedFields, ['cuerpo']);
});

test('detecta colisiones cruzadas de identidad', () => {
  const result = compare(
    [article(1, { doi: '10.1000/a' }), article(2, { doi: '10.1000/b' })],
    [article(1, { doi: '10.1000/b' })],
  );
  assert.equal(result.status, 'blocked');
  assert.ok(result.errors.some((error) => error.code === 'IDENTITY_COLLISION'));
});

test('normalizadores y SHA-256 son deterministas', () => {
  assert.equal(normalizeDoi(' HTTPS://DX.DOI.ORG/10.1000/Ab C '), '10.1000/abc');
  assert.equal(normalizeTitle('  Ácido—base: ensayo  '), 'acido base ensayo');
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
