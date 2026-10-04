import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url);
const sourcePath = new URL('../resumenes.json', import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('una alta sintética N+1 genera página, canonical, sitemap, schema, hub y feed sin tocar la fuente', () => {
  const before = readFileSync(sourcePath);
  const temporary = mkdtempSync(join(tmpdir(), 'rt-ingestion-n-plus-one-'));
  try {
    copyFileSync(new URL('../generar_seo.py', import.meta.url), join(temporary, 'generar_seo.py'));
    const data = JSON.parse(before.toString('utf8'));
    const nextId = Math.max(...data.map((item) => Number(item.id))) + 1;
    const synthetic = {
      ...data.at(-1),
      id: nextId,
      titulo: `SYNTHETIC-N-PLUS-ONE-${nextId}: validación temporal de automatización`,
      autor: 'Fixture local de QA',
      revista: 'Fixture local de QA',
      anio: 2026,
      fecha: '4 de septiembre de 2026',
      registro: `NCT-SYNTHETIC-${nextId}`,
      doi: `10.9999/resumenestrials.synthetic.${nextId}`,
      financiacion: 'Fixture local; no publicable',
      original: `https://example.test/synthetic-${nextId}`,
      especialidad_principal: 'Medicina Crítica',
      especialidad_secundaria: '',
      temas: ['Automatización'],
      tipo_estudio: 'Fixture técnico local',
      objetivo: 'Validar la canalización técnica sin alterar contenido científico.',
      hallazgo: 'La alta sintética solo existe dentro del directorio temporal de la prueba.',
      cuerpo: '<h2>Fixture</h2><p>Contenido técnico temporal.</p>',
      corto: '<p>Fixture técnico temporal.</p>',
      fecha_publicacion_resumen: '2026-09-04',
    };
    const serialized = JSON.stringify([...data, synthetic], null, 2)
      .replace(`"id": ${nextId},`, `"id": ${nextId}.0,`);
    writeFileSync(join(temporary, 'resumenes.json'), `${serialized}\n`, 'utf8');

    const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    const generated = spawnSync(python, ['generar_seo.py'], {
      cwd: temporary,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);

    const manifest = JSON.parse(readFileSync(join(temporary, 'seo-manifest.json'), 'utf8'));
    const entry = manifest[String(nextId)];
    assert.equal(Object.keys(manifest).length, data.length + 1);
    assert.ok(entry?.url?.startsWith('https://resumenestrials.com/trials/'));
    const pagePath = join(temporary, entry.path.replace(/^\//, ''), 'index.html');
    assert.equal(existsSync(pagePath), true);
    const page = readFileSync(pagePath, 'utf8');
    assert.ok(page.includes(`<link rel="canonical" href="${entry.url}">`));
    assert.match(page, /"@type":\s*"Article"/);
    assert.match(page, /"@type":\s*"BreadcrumbList"/);

    const sitemap = readFileSync(join(temporary, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes(`<loc>${entry.url}</loc>`));
    assert.equal([...sitemap.matchAll(/<loc>https:\/\/resumenestrials\.com\/trials\//g)].length, data.length + 1);
    const hub = readFileSync(join(temporary, 'medicina-critica', 'index.html'), 'utf8');
    assert.ok(hub.includes(`href="${entry.path}"`));
    const feed = readFileSync(join(temporary, 'feed.xml'), 'utf8');
    assert.ok(feed.includes(`<id>${entry.url}</id>`));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  assert.equal(sha256(readFileSync(sourcePath)), sha256(before));
});
