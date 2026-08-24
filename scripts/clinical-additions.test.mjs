import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clinicalGuard = fileURLToPath(new URL('./verify-clinical-freeze.mjs', import.meta.url));
const bodyGuard = fileURLToPath(new URL('./verify-trial-body-freeze.mjs', import.meta.url));

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function runGit(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function article(id, overrides = {}) {
  return {
    id,
    titulo: `Trial ${id}`,
    autor: 'Autor',
    revista: 'Revista',
    fecha: '2026-08-24',
    doi: `10.1000/${id}`,
    objetivo: 'Objetivo protegido',
    cuerpo: '<p>Cuerpo protegido</p>',
    corto: '<p>Breve protegido</p>',
    ...overrides,
  };
}

function runGuard(script, cwd, base) {
  return spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, CLINICAL_BASE_REF: base },
    encoding: 'utf8',
    windowsHide: true,
  });
}

test('los controles clínicos aceptan altas y siguen bloqueando cambios existentes', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'resumenestrials-clinical-additions-'));
  try {
    runGit(fixture, ['init', '--quiet']);
    runGit(fixture, ['config', 'user.name', 'QA']);
    runGit(fixture, ['config', 'user.email', 'qa@example.test']);
    write(join(fixture, 'resumenes.json'), `${JSON.stringify([article(1)], null, 2)}\n`);
    write(join(fixture, 'seo-manifest.json'), `${JSON.stringify({ 1: { path: '/trials/one/' } }, null, 2)}\n`);
    write(join(fixture, 'trials/one/index.html'), '<article class="articulo"><p>Cuerpo uno</p></article>\n');
    runGit(fixture, ['add', '.']);
    runGit(fixture, ['commit', '--quiet', '-m', 'base']);
    const base = runGit(fixture, ['rev-parse', 'HEAD']);

    write(join(fixture, 'resumenes.json'), `${JSON.stringify([article(1), article(2)], null, 2)}\n`);
    write(join(fixture, 'seo-manifest.json'), `${JSON.stringify({
      1: { path: '/trials/one/' },
      2: { path: '/trials/two/' },
    }, null, 2)}\n`);
    write(join(fixture, 'trials/two/index.html'), '<article class="articulo"><p>Cuerpo dos nuevo</p></article>\n');

    const additionsClinical = runGuard(clinicalGuard, fixture, base);
    const additionsBody = runGuard(bodyGuard, fixture, base);
    assert.equal(additionsClinical.status, 0, additionsClinical.stderr);
    assert.equal(additionsBody.status, 0, additionsBody.stderr);

    write(join(fixture, 'resumenes.json'), `${JSON.stringify([
      article(1, { objetivo: 'Objetivo médico cambiado' }),
      article(2),
    ], null, 2)}\n`);
    const modifiedClinical = runGuard(clinicalGuard, fixture, base);
    assert.notEqual(modifiedClinical.status, 0);
    assert.match(modifiedClinical.stderr, /Cambio editorial|Cambio de datos/);

    write(join(fixture, 'trials/one/index.html'), '<article class="articulo"><p>Cuerpo uno cambiado</p></article>\n');
    const modifiedBody = runGuard(bodyGuard, fixture, base);
    assert.notEqual(modifiedBody.status, 0);
    assert.match(modifiedBody.stderr, /Cambió el cuerpo clínico visible/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
