import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { console.error(`NIGHT AUDIT FAIL: ${message}`); process.exitCode = 1; };
const pass = (message) => console.log(`NIGHT AUDIT PASS: ${message}`);

const index = read('index.html');
const resumen = read('resumen.html');
const contact=read('ui/pdf.js'),layout=read('ui/site.css');
const workflow=read('.github/workflows/revision-nocturna.yml'),prompt=read('PROMPT_AUDITORIA_NOCTURNA_RESUMENES_TRIALS.md'),deepAudit=read('tools/auditoria_sitio_profunda.mjs');
for(const [name,html] of [['index',index],['resumen',resumen]])if(!html.includes('/site-runtime.js?v='))fail(name+' sin runtime versionado');
for(const token of ['resumenestrials.com','X: @resumenestrials','Telegram: @ResumenesTrials','resumenestrials@outlook.com','item.corto','item.cuerpo','generatePDF','JSPDF_SRI','opacity:.045'])if(!contact.includes(token))fail('PDF sin '+token);
if(!layout.includes('.ev-tools')||!layout.includes('repeat(5,minmax(110px,1fr))'))fail('Filtros sin alineación escritorio');
for (const token of ['auditoria_editorial_profunda.py', 'auditoria_sitio_profunda.mjs', 'revisar_pagina_pdf.mjs', 'informe_editorial.json', 'informe_sitio_profundo.json', 'poppler-utils']) {
  if (!workflow.includes(token)) fail(`revision-nocturna.yml no integra ${token}`);
}

for(const token of ['pdftotext','data-pdf-version="completo"','data-pdf-version="breve"'])if(!deepAudit.includes(token))fail('Auditoría sin '+token);
for (const token of ['NO MODIFIQUES', 'Consistencia interna entre formatos', 'Auditoría de PDF', 'SEO y descubrimiento', 'Esta auditoría no modificó ningún resumen']) {
  if (!prompt.includes(token)) fail(`Prompt nocturno incompleto: falta “${token}”`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('Night audit integration PASS');
