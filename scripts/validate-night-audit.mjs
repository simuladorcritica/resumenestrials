import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { console.error(`NIGHT AUDIT FAIL: ${message}`); process.exitCode = 1; };
const pass = (message) => console.log(`NIGHT AUDIT PASS: ${message}`);

const index = read('index.html');
const resumen = read('resumen.html');
const contact = read('pdf-contact.js');
const layout = read('home-control-layout.js');
const workflow = read('.github/workflows/revision-nocturna.yml');
const prompt = read('PROMPT_AUDITORIA_NOCTURNA_RESUMENES_TRIALS.md');
const deepAudit = read('tools/auditoria_sitio_profunda.mjs');

for (const [name, html] of [['index.html', index], ['resumen.html', resumen]]) {
  if (!html.includes('pdf-contact.js')) fail(`${name} no carga pdf-contact.js`);
  else pass(`${name} carga el controlador de PDF y descargas.`);
}

for (const token of ['resumenestrials.com', 'X: @resumenestrials', 'Telegram: @ResumenesTrials', 'resumenestrials@outlook.com']) {
  if (!contact.includes(token)) fail(`pdf-contact.js no contiene ${token}`);
}
for (const token of ['__rtConstructorWrapped', 'wrapDocument', "version === 'breve'", "version === 'completo'", 'Descargar resumen completo PDF', 'Descargar resumen breve PDF']) {
  if (!contact.includes(token)) fail(`Contrato de descargas incompleto en pdf-contact.js: falta ${token}`);
}
if (!process.exitCode) pass('PDF incluye contacto y la UI separa descarga completa/breve por versión.');

if (!index.includes('pdf-contact.js?v=2')) fail('index.html no invalida caché del controlador actualizado.');
else pass('Portada carga la versión actualizada del controlador de descargas.');

if (!index.includes('home-control-layout.js')) fail('index.html no carga home-control-layout.js');
if (!layout.includes('min-width:1360px') || !layout.includes('flex-wrap:nowrap')) fail('No está fijada la alineación de filtros/buscador en escritorio amplio.');
else pass('Buscador y filtros tienen regla de alineación de una sola fila en escritorio.');

for (const token of ['auditoria_editorial_profunda.py', 'auditoria_sitio_profunda.mjs', 'revisar_pagina_pdf.mjs', 'informe_editorial.json', 'informe_sitio_profundo.json', 'poppler-utils']) {
  if (!workflow.includes(token)) fail(`revision-nocturna.yml no integra ${token}`);
}

for (const token of ['pdftotext', '[data-pdf-version="completo"]:visible', '[data-pdf-version="breve"]:visible', 'Descargar resumen completo PDF', 'Descargar resumen breve PDF']) {
  if (!deepAudit.includes(token)) fail(`Auditoría profunda no valida ${token}`);
}

for (const token of ['NO MODIFIQUES', 'Consistencia interna entre formatos', 'Auditoría de PDF', 'SEO y descubrimiento', 'Esta auditoría no modificó ningún resumen']) {
  if (!prompt.includes(token)) fail(`Prompt nocturno incompleto: falta “${token}”`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('Night audit integration PASS');
