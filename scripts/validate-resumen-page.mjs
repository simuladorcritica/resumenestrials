import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const html = fs.readFileSync('resumen.html', 'utf8');
let failed = false;
const fail = (message) => { failed = true; console.error(`RESUMEN FAIL: ${message}`); };
const pass = (message) => console.log(`RESUMEN PASS: ${message}`);

const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((m) => !/\bsrc\s*=/.test(m[1]) && !/application\/ld\+json/i.test(m[1]))
  .map((m) => m[2]);

for (const [index, code] of scripts.entries()) {
  const tmp = path.join(os.tmpdir(), `rt-resumen-${index}.js`);
  fs.writeFileSync(tmp, code);
  const result = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (result.status !== 0) fail(`JavaScript inline ${index + 1}: ${result.stderr}`);
  else pass(`JavaScript inline ${index + 1} válido.`);
}

const required = [
  'SpecialtyClassification',
  'subespecialidadMI(dato)',
  'data-subspecialty=',
  'Descargar resumen completo PDF',
  'Descargar resumen breve PDF',
  'data-pdf-version="completo"',
  'data-pdf-version="breve"',
  'download-icon',
  'migasHTML(){return `<nav class="migas" aria-label="Ruta"><a class="volver-top" href="index.html">← Volver al índice</a></nav>`;}'
];
for (const fragment of required) {
  if (!html.includes(fragment)) fail(`Falta el fragmento requerido: ${fragment}`);
}
if (!html.includes('src="specialty-classification.js')) fail('La página de resumen no carga la taxonomía clínica canónica.');
else pass('La página de resumen carga la taxonomía clínica canónica.');

if (/class="miga-esp"/.test(html)) fail('La especialidad todavía aparece junto a “Volver al índice”.');
else pass('No se muestra Medicina Interna/Crítica junto a “Volver al índice”.');

if (/⬇\s*Descargar/.test(html)) fail('Persisten flechas Unicode antiguas en los botones de descarga.');
else pass('Botones PDF usan iconografía SVG editorial.');

if (failed) process.exit(1);
console.log('Resumen detail UX PASS');
