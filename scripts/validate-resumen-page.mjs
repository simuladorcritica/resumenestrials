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
for(const token of ["format='a4'", "['a4','mobile']", 'item.corto','item.cuerpo','JSPDF_SRI','sanPDF(','function signal(','Puntos clave','Cómo citar este resumen','Editorial EMEICRÍTICA',"'/fonts/pdf/'"])if(!pdf.includes(token))fail('PDF sin '+token);
// Identidad editorial: fuentes OFL incrustadas (TTF reales), sin marca de agua y un solo punto ocre (la línea de señal).
for(const f of (pdf.match(/FONT_FILES=\{([^}]+)\}/)||[,''])[1].matchAll(/'([a-z0-9-]+)'/g)){const file='fonts/pdf/'+f[1]+'.ttf';if(!fs.existsSync(file)||fs.readFileSync(file).readUInt32BE(0)!==0x00010000)fail('PDF sin la fuente TrueType '+file)}
if(((pdf.match(/FONT_FILES=\{([^}]+)\}/)||[,''])[1].match(/'[a-z0-9-]+'/g)||[]).length<7)fail('PDF con menos de 7 fuentes declaradas');
if(/GState|opacity:/.test(pdf))fail('PDF con marca de agua o transparencias');
if((pdf.match(/C\.ocre/g)||[]).length!==1)fail('El ocre debe usarse solo en el punto de la línea de señal');
// Formato editorial del PDF (decisión del editor, noviembre de 2026): título limpio sin antetítulo de especialidad/tipo,
// ficha sin Especialidad ni Temas, cita solo en APA y Vancouver, y «Puntos clave» en mayúscula inicial con punto final.
for(const token of ["'APA: '","'Vancouver: '",'[Internet]','Disponible en: ','[citado ','export function tidy(','tidy(anchor)'])if(!pdf.includes(token))fail('PDF sin '+token);
if(/studyType\(item\.tipo_estudio\)|\['Especialidad',|\['Temas',/.test(pdf))fail('El PDF volvió a mostrar el antetítulo o Especialidad/Temas');
{const tidy=new Function('return '+(pdf.match(/export function tidy\(s\)(\{[\s\S]*?\n)/)||[,''])[0].replace('export function tidy(s)','function(s)'))();
  for(const r of JSON.parse(fs.readFileSync('resumenes.json','utf8'))){const sec=/<h2>Conclusi[^<]*<\/h2>([\s\S]*?)(?=<h2>|$)/.exec(r.cuerpo||''),m=sec&&/<strong>([\s\S]*?)<\/strong>/.exec(sec[1]);if(!m)continue;const t=tidy(m[1].replace(/<[^>]+>/g,''));if(!/^[^a-záéíóúñ]/.test(t)&&!/^[a-z]+[A-Z]/.test(t)||!/[.!?…]$/.test(t))fail('Mensaje sin formato de oración en el PDF del resumen '+r.id+': '+t.slice(0,40))}}
if(!templates.includes('data-ev-pdf')||!templates.includes('icon("pdf")'))fail('Controles estáticos sin icono PDF SVG');
if(/<script[^>]+src=["'][^"']*(?:pdf-contact|trial-pdf|reader-controls)/.test(html))fail('Múltiples controladores de lectura');
if(failed)process.exit(1);console.log('Resumen detail UX PASS');
