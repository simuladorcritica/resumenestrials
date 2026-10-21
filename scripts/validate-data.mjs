import fs from 'node:fs';
import { auditArticleData, isValidIsoDate } from './article-inventory.mjs';

const file = 'resumenes.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const audit = auditArticleData(data);
const errors = [...audit.errors];
const invalidYears = audit.records.filter((record) => {
  const year = Number(record?.anio);
  return !Number.isInteger(year) || year < 1900 || year > 2100;
}).map((record) => record.id);
if (invalidYears.length) errors.push(`años inválidos: ${invalidYears.join(',')}`);
for (const record of audit.records) {
  for (const field of ['fecha_publicacion_resumen', 'fecha_revision', 'actualizado']) {
    if (record?.[field] && !isValidIsoDate(record[field])) {
      errors.push(`ID ${record.id}: ${field} debe usar YYYY-MM-DD`);
    }
  }
}

// Derived data the reader and lists load instead of the full archive: one file per trial
// and the light index must exist and match resumenes.json (the routine must commit datos/).
const { buildIndex } = await import('./build-data-index.mjs');
const missingTrialFiles = [], staleTrialFiles = [];
for (const record of audit.records) {
  const path = `datos/ensayos/${record.id}.json`;
  if (!fs.existsSync(path)) { missingTrialFiles.push(record.id); continue; }
  try {
    const stored = JSON.parse(fs.readFileSync(path, 'utf8'));
    const { ruta, ...rest } = stored;
    if (JSON.stringify(rest) !== JSON.stringify(record) || !String(ruta || '').startsWith('/trials/')) staleTrialFiles.push(record.id);
  } catch { staleTrialFiles.push(record.id); }
}
if (missingTrialFiles.length) errors.push(`faltan datos/ensayos/<id>.json (ejecuta generar_seo.py y versiona datos/): ${missingTrialFiles.join(',')}`);
if (staleTrialFiles.length) errors.push(`datos/ensayos desactualizados respecto de resumenes.json: ${staleTrialFiles.join(',')}`);
if (!fs.existsSync('datos/indice.json')) errors.push('falta datos/indice.json (ejecuta node scripts/build-site-runtime.mjs y versiona datos/)');
else if (fs.readFileSync('datos/indice.json', 'utf8') !== JSON.stringify(buildIndex(audit.records)) + '\n') errors.push('datos/indice.json desactualizado respecto de resumenes.json (ejecuta node scripts/build-site-runtime.mjs)');

const warnings = [];
if (audit.emptyValues) warnings.push(`${audit.emptyValues} valores vacíos presentes (incluye campos opcionales)`);
if (audit.nonIsoBibliographicDates.length) {
  warnings.push(`${audit.nonIsoBibliographicDates.length} fechas bibliográficas legibles conservadas en formato editorial no ISO`);
}
if (audit.nonUrlOriginals.length) {
  warnings.push(`${audit.nonUrlOriginals.length} referencias originales son texto bibliográfico, no URL HTTPS`);
}

console.log(`Validación: ${audit.records.length} resúmenes, ${errors.length} errores, ${warnings.length} advertencias.`);
console.log(`Inventario: IDs duplicados=${audit.duplicateIds.length}, DOI duplicados=${audit.duplicateDois.length}, originales duplicados=${audit.duplicateOriginals.length}, títulos duplicados=${audit.duplicateTitles.length}, slugs duplicados=${audit.duplicateSlugs.length}.`);
for (const warning of warnings) console.warn('WARN', warning);
for (const error of errors) console.error('ERROR', error);
if (errors.length) process.exitCode = 1;
