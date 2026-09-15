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

function createFixture(prefix = 'resumenestrials-clinical-') {
  const fixture = mkdtempSync(join(tmpdir(), prefix));
  runGit(fixture, ['init', '--quiet']);
  runGit(fixture, ['config', 'user.name', 'QA']);
  runGit(fixture, ['config', 'user.email', 'qa@example.test']);
  write(join(fixture, 'resumenes.json'), `${JSON.stringify([article(1)], null, 2)}\n`);
  write(join(fixture, 'seo-manifest.json'), `${JSON.stringify({ 1: { path: '/trials/one/' } }, null, 2)}\n`);
  write(join(fixture, 'trials/one/index.html'), '<article class="articulo"><p>Cuerpo protegido</p></article>\n');
  runGit(fixture, ['add', '.']);
  runGit(fixture, ['commit', '--quiet', '-m', 'base']);
  return { fixture, base: runGit(fixture, ['rev-parse', 'HEAD']) };
}

function writeAuthorization(fixture, baseSha, authorizations) {
  write(join(fixture, 'clinical-correction-authorizations.json'), `${JSON.stringify({
    schema_version: 1,
    base_sha: baseSha,
    authorizations,
  }, null, 2)}\n`);
}

test('los controles clínicos aceptan altas y siguen bloqueando cambios existentes sin autorización', () => {
  const { fixture, base } = createFixture('resumenestrials-clinical-additions-');
  try {
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
    assert.match(modifiedClinical.stderr, /Cambio editorial no autorizado|Cambio de datos no autorizado/);

    write(join(fixture, 'trials/one/index.html'), '<article class="articulo"><p>Cuerpo uno cambiado</p></article>\n');
    const modifiedBody = runGuard(bodyGuard, fixture, base);
    assert.notEqual(modifiedBody.status, 0);
    assert.match(modifiedBody.stderr, /sin autorización explícita/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('una autorización exacta y ligada al baseline permite solo el campo declarado', () => {
  const { fixture, base } = createFixture('resumenestrials-clinical-authorized-');
  try {
    write(join(fixture, 'resumenes.json'), `${JSON.stringify([
      article(1, { cuerpo: '<p>Cuerpo clínico corregido</p>' }),
    ], null, 2)}\n`);
    write(join(fixture, 'trials/one/index.html'), '<article class="articulo"><p>Cuerpo clínico corregido</p></article>\n');
    writeAuthorization(fixture, base, [
      {
        id: 1,
        fields: ['cuerpo'],
        reason: 'Corrección documental aprobada para el cuerpo del ID 1.',
      },
    ]);

    const authorizedClinical = runGuard(clinicalGuard, fixture, base);
    const authorizedBody = runGuard(bodyGuard, fixture, base);
    assert.equal(authorizedClinical.status, 0, authorizedClinical.stderr);
    assert.equal(authorizedBody.status, 0, authorizedBody.stderr);
    assert.match(authorizedClinical.stdout, /1 cambios explícitamente autorizados/);

    write(join(fixture, 'resumenes.json'), `${JSON.stringify([
      article(1, {
        cuerpo: '<p>Cuerpo clínico corregido</p>',
        objetivo: 'Cambio adicional no autorizado',
      }),
    ], null, 2)}\n`);
    const extraField = runGuard(clinicalGuard, fixture, base);
    assert.notEqual(extraField.status, 0);
    assert.match(extraField.stderr, /campo objetivo/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('una autorización no puede reutilizarse sobre otro baseline', () => {
  const { fixture, base } = createFixture('resumenestrials-clinical-stale-');
  try {
    write(join(fixture, 'resumenes.json'), `${JSON.stringify([
      article(1, { objetivo: 'Objetivo corregido' }),
    ], null, 2)}\n`);
    writeAuthorization(fixture, '0000000000000000000000000000000000000000', [
      {
        id: 1,
        fields: ['objetivo'],
        reason: 'Prueba de autorización obsoleta.',
      },
    ]);

    const stale = runGuard(clinicalGuard, fixture, base);
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /no puede reutilizarse sobre otro baseline/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('el manifest rechaza comodines y autorizaciones más amplias que el diff real', () => {
  const { fixture, base } = createFixture('resumenestrials-clinical-exact-');
  try {
    write(join(fixture, 'resumenes.json'), `${JSON.stringify([
      article(1, { objetivo: 'Objetivo corregido' }),
    ], null, 2)}\n`);

    writeAuthorization(fixture, base, [
      {
        id: 1,
        fields: ['*'],
        reason: 'Un comodín nunca debe ser válido.',
      },
    ]);
    const wildcard = runGuard(clinicalGuard, fixture, base);
    assert.notEqual(wildcard.status, 0);
    assert.match(wildcard.stderr, /campo inválido o no permitido/);

    writeAuthorization(fixture, base, [
      {
        id: 1,
        fields: ['objetivo', 'corto'],
        reason: 'La autorización debe coincidir exactamente con el diff.',
      },
    ]);
    const unused = runGuard(clinicalGuard, fixture, base);
    assert.notEqual(unused.status, 0);
    assert.match(unused.stderr, /Autorización clínica no consumida: 1:corto/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
