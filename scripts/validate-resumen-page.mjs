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

const runtime=fs.readFileSync('site-runtime.js','utf8'),pdf=fs.readFileSync('ui/pdf.js','utf8'),templates=fs.readFileSync('site_templates.py','utf8');
for(const token of ['ev-dynamic-reader','<noscript>','/site-runtime.js?v='])if(!html.includes(token))fail('Lector sin '+token);
for(const token of ['SpecialtyClassification','data-ev-reader','data-ev-sections','data-ev-pdf','data-ev-save','data-ev-return', "p.get('v')==='corto'",'Resumen no encontrado'])if(!runtime.includes(token))fail('Runtime sin '+token);
for(const token of ["format='a4'", "['a4','mobile']", 'item.corto','item.cuerpo','JSPDF_SRI','opacity:.045'])if(!pdf.includes(token))fail('PDF sin '+token);
if(!templates.includes('data-ev-pdf')||!templates.includes('icon("pdf")'))fail('Controles estáticos sin icono PDF SVG');
if(/<script[^>]+src=["'][^"']*(?:pdf-contact|trial-pdf|reader-controls)/.test(html))fail('Múltiples controladores de lectura');
if(failed)process.exit(1);console.log('Resumen detail UX PASS');
