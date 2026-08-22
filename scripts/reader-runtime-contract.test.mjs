import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectReaderRuntime, RUNTIME_MARKERS } from './reader-runtime-contract.mjs';

const bundledHtml = '<script type="module" src="/site-runtime.js?v=20260821"></script>';
const bundledRuntime = Object.values(RUNTIME_MARKERS).join('\n');

test('acepta el runtime consolidado desplegado', () => {
  const result = inspectReaderRuntime(bundledHtml, bundledRuntime);
  assert.equal(result.runtimePath, '/site-runtime.js?v=20260821');
  assert.equal(result.ready, true);
  assert.deepEqual(Object.values(result.checks), Array(Object.keys(result.checks).length).fill(true));
});

test('rechaza una referencia directa al lector obsoleto', () => {
  const html = `${bundledHtml}<script src="/reader-controls-v9.js?v=2"></script>`;
  const result = inspectReaderRuntime(html, bundledRuntime);
  assert.equal(result.checks.noObsoleteDirectReference, false);
  assert.equal(result.ready, false);
});

test('rechaza bundles sin el origen o los controles táctiles esperados', () => {
  for (const marker of [RUNTIME_MARKERS.readerSource, RUNTIME_MARKERS.minimumTouchHeight, RUNTIME_MARKERS.touchAction]) {
    const result = inspectReaderRuntime(bundledHtml, bundledRuntime.replace(marker, ''));
    assert.equal(result.ready, false, `El contrato aceptó un runtime sin ${marker}`);
  }
});

test('rechaza páginas que no cargan site-runtime.js', () => {
  const result = inspectReaderRuntime('<script src="/otro-runtime.js"></script>', bundledRuntime);
  assert.equal(result.runtimePath, null);
  assert.equal(result.ready, false);
});
