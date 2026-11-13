// Transparencia editorial: auditoria-editorial.json → aviso «Resumen en revisión», fe de erratas
// y /correcciones/. Comprueba que las salidas generadas reflejan el archivo versionado, que el
// lector dinámico (ui/reader.js) produce el mismo marcado que site_templates.py y que un archivo
// ausente o inválido no rompe nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL('../' + path, import.meta.url));
const manifest = JSON.parse(read('seo-manifest.json'));
const records = JSON.parse(read('resumenes.json'));
const audit = exists('auditoria-editorial.json') ? JSON.parse(read('auditoria-editorial.json')) : null;
const SEVERITIES = ['CRÍTICO', 'MAYOR', 'MENOR'];
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isId = (v) => Number.isInteger(v) && v >= 0;
const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;

function runtimeAudit() {
  // ui/reader.js con un window mínimo: solo se evalúan las funciones de marcado.
  const core = read('ui/core.js');
  const helpers = core.split('\n').filter((line) => /^E\.(esc|humanDate)=/.test(line)).join('\n');
  const E = { ready() {} };
  const context = { window: { EV: E }, document: { documentElement: {} } };
  vm.runInNewContext('const E=window.EV;' + helpers, context);
  vm.runInNewContext(read('ui/reader.js'), context);
  assert.equal(typeof E.auditMarkup, 'function', 'ui/reader.js debe exponer E.auditMarkup');
  return E.auditMarkup;
}

function staticBlocks(html) {
  return {
    notice: html.match(/<aside class="ev-audit"[\s\S]*?<\/aside>/)?.[0] ?? '',
    errata: html.match(/<section class="ev-errata"[\s\S]*?<\/section>/)?.[0] ?? '',
  };
}

test('auditoria-editorial.json cumple el contrato schema_version 1', { skip: !audit && 'archivo ausente' }, () => {
  assert.equal(audit.schema_version, 1);
  assert(isIsoDate(audit.actualizado), 'actualizado debe ser YYYY-MM-DD');
  assert.equal(typeof audit.estandar, 'string');
  assert(audit.estandar.trim(), 'estandar no puede estar vacío');
  for (const key of ['total', 'auditados', 'sin_auditar']) assert(isCount(audit.archivo?.[key]), `archivo.${key}`);
  for (const key of ['en_revision', 'sin_auditar', 'con_errores_abiertos']) {
    assert(Array.isArray(audit[key]) && audit[key].every(isId), `${key} debe ser una lista de IDs`);
  }
  const union = new Set([...audit.sin_auditar, ...audit.con_errores_abiertos]);
  assert.deepEqual(new Set(audit.en_revision), union, 'en_revision = sin_auditar ∪ con_errores_abiertos');
  for (const key of SEVERITIES) assert(isCount(audit.errores_abiertos?.[key]), `errores_abiertos.${key}`);
  assert(Array.isArray(audit.correcciones));
  for (const [index, entry] of audit.correcciones.entries()) {
    assert(isId(entry.id), `correcciones[${index}].id`);
    assert(isIsoDate(entry.fecha), `correcciones[${index}].fecha`);
    assert(typeof entry.texto === 'string' && entry.texto.trim(), `correcciones[${index}].texto`);
    assert(Array.isArray(entry.campos), `correcciones[${index}].campos`);
    if (index) assert(audit.correcciones[index - 1].fecha >= entry.fecha, 'correcciones: más recientes primero');
  }
});

test('cada página canónica y legada refleja el estado de auditoría de su ID', () => {
  const sinAuditar = new Set((audit?.sin_auditar ?? []).map(String));
  const conErrores = new Set((audit?.con_errores_abiertos ?? []).map(String));
  const fixes = new Map();
  for (const entry of audit?.correcciones ?? []) fixes.set(String(entry.id), (fixes.get(String(entry.id)) ?? 0) + 1);
  let notices = 0, errata = 0;
  for (const record of records) {
    const id = String(record.id);
    const expected = conErrores.has(id) ? 'errores' : sinAuditar.has(id) ? 'revision' : '';
    const pages = [`${manifest[id].path.slice(1)}index.html`, `resumen/${id}.html`];
    if (record.corto) pages.push(`resumen/${id}-corto.html`);
    for (const page of pages) {
      const html = read(page);
      const blocks = staticBlocks(html);
      assert.equal(blocks.notice.match(/data-ev-audit="(\w+)"/)?.[1] ?? '', expected, `${page}: aviso`);
      if (expected) assert(blocks.notice.includes('<a href="/correcciones/">Política de correcciones</a>'), `${page}: enlace`);
      assert.equal((blocks.errata.match(/<li>/g) ?? []).length, fixes.get(id) ?? 0, `${page}: fe de erratas`);
      // Fuera del cuerpo clínico congelado (verify-trial-body-freeze.mjs).
      const body = html.match(/<article class="(?:articulo|ev-body)">([\s\S]*?)<\/article>/)?.[1] ?? '';
      assert(!body.includes('ev-audit') && !body.includes('ev-errata'), `${page}: el cuerpo clínico no cambia`);
      assert.equal((html.match(/<article\b/g) ?? []).length, 1, `${page}: un solo <article>`);
    }
    if (expected) notices += 1;
    if (fixes.has(id)) errata += 1;
  }
  if (audit) assert(notices > 0 && errata > 0, 'los datos versionados deben producir avisos y fe de erratas');
});

test('el lector dinámico produce el mismo aviso y la misma fe de erratas que las páginas estáticas', () => {
  const auditMarkup = runtimeAudit();
  const normalize = (html) => html.replace(/&#x27;/g, '&#39;');
  for (const record of records) {
    const id = String(record.id);
    const html = read(`${manifest[id].path.slice(1)}index.html`);
    const expected = staticBlocks(html);
    const actual = auditMarkup(audit, record.id);
    assert.equal(normalize(actual.notice), normalize(expected.notice), `aviso ${id}`);
    assert.equal(normalize(actual.errata), normalize(expected.errata), `fe de erratas ${id}`);
  }
});

test('el lector dinámico tolera un archivo ausente, inválido o con tipos inesperados', () => {
  const auditMarkup = runtimeAudit();
  const empty = { notice: '', errata: '' };
  for (const data of [null, undefined, [], 'texto', 7, { schema_version: 2, sin_auditar: [8] }]) {
    assert.deepEqual({ ...auditMarkup(data, 8) }, empty);
  }
  const odd = { schema_version: 1, sin_auditar: '8', con_errores_abiertos: { 7: true }, correcciones: { id: 5 } };
  for (const id of [5, 7, 8]) assert.deepEqual({ ...auditMarkup(odd, id) }, empty);
  const hostile = {
    schema_version: 1, estandar: '<img src=x onerror=alert(1)>', sin_auditar: ['8', true, -1, 'x'],
    correcciones: [
      { id: 8, fecha: '2026-11-04', texto: '<script>alert(1)</script>' },
      { id: '8', fecha: '2026-11-06', texto: 'Más reciente.' },
      { id: 8, fecha: '2026-02-30', texto: 'Fecha imposible.' },
      { id: 8, fecha: '2026-11-05', texto: 42 },
      null,
    ],
  };
  const out = auditMarkup(hostile, 8);
  assert(out.notice.includes('data-ev-audit="revision"'));
  assert(!out.notice.includes('<img') && out.notice.includes('&lt;img'));
  assert.equal((out.errata.match(/<li>/g) ?? []).length, 2);
  assert(!out.errata.includes('<script>') && out.errata.includes('&lt;script&gt;'));
  assert(out.errata.indexOf('Más reciente.') < out.errata.indexOf('&lt;script&gt;'), 'más recientes primero');
  assert(out.errata.includes('Corregido el <time datetime="2026-11-06">6 de noviembre de 2026</time>. Más reciente.'));
});

test('/correcciones/ existe, es indexable, está en el sitemap y se enlaza junto a /metodologia/', () => {
  const page = read('correcciones/index.html');
  assert(page.includes('<link rel="canonical" href="https://resumenestrials.com/correcciones/">'));
  assert(page.includes('<h1>Correcciones</h1>'));
  assert(!/noindex/.test(page.match(/<meta name="robots"[^>]*>/)?.[0] ?? ''));
  assert(read('sitemap.xml').includes('<loc>https://resumenestrials.com/correcciones/</loc>'));
  assert(read('llms.txt').includes('https://resumenestrials.com/correcciones/'));
  if (audit) {
    assert(page.includes(`<dd>${audit.archivo.auditados} de ${audit.archivo.total}</dd>`));
    assert(page.includes(`<dt>Resúmenes en revisión</dt><dd>${new Set(audit.en_revision).size}</dd>`));
    for (const [key, label] of [['CRÍTICO', 'Críticos'], ['MAYOR', 'Mayores'], ['MENOR', 'Menores']]) {
      assert(page.includes(`<dt>${label}</dt><dd>${audit.errores_abiertos[key]}</dd>`), label);
    }
    assert.equal((page.match(/<ul class="ev-corrections">[\s\S]*?<\/ul>/)?.[0].match(/<li>/g) ?? []).length, audit.correcciones.length);
    for (const entry of audit.correcciones) assert(page.includes(`<a href="${manifest[String(entry.id)].path}">`), `enlace canónico ${entry.id}`);
    // Solo la cifra de resúmenes en revisión, no la lista de IDs.
    assert(!page.includes('data-ev-audit'));
  }
  for (const file of ['metodologia/index.html', 'correcciones/index.html', `${manifest['1'].path.slice(1)}index.html`, '_includes/index-source.html']) {
    const html = read(file);
    assert(html.includes('<a href="/metodologia/">Metodología</a><a href="/correcciones/">Correcciones</a>'), `${file}: pie y menú`);
  }
});

test('/metodologia/ describe el método con revisiones asistidas por IA y enlaza las correcciones', () => {
  const page = read('metodologia/index.html');
  const text = page.match(/<article class="ev-prose">([\s\S]*?)<\/article>/)[1];
  // Las revisiones son procesos asistidos por IA supervisados por el editor: la página debe decirlo.
  assert(text.includes('inteligencia artificial') && text.includes('supervisión del editor'));
  assert(text.includes('<a href="/correcciones/">'));
  assert(text.includes('Editorial EMEICRÍTICA'));
});
