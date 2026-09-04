import fs from 'node:fs';
import { auditArticleData } from './article-inventory.mjs';

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
    if (record?.[field] && !/^\d{4}-\d{2}-\d{2}$/.test(String(record[field]))) {
      errors.push(`ID ${record.id}: ${field} debe usar YYYY-MM-DD`);
    }
  }
}

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
