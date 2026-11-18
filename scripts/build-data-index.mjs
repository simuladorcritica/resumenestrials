// Índice ligero para listas, búsqueda, filtros y recomendaciones.
// Contiene cada registro sin `cuerpo` ni `corto` (el ~90 % del peso), más:
//   _sub  subespecialidad inferida (specialty-classification.js, que usa el cuerpo)
//   _fin  la financiación en tres renglones para la ficha de las tarjetas (quién pagó, papel de la
//         empresa, conflictos de interés), de financiacion-breve.json. Cuando la hay, el registro
//         no lleva `financiacion`: el texto completo está en la página del resumen.
// El texto completo de cada ensayo vive en datos/ensayos/<id>.json.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function plain(html) {
  return String(html ?? '').replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Huella del texto de financiación para el que se escribió cada ficha breve (la misma de tools/financiacion_breve.py).
export function fundingDigest(text) {
  return crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex').slice(0, 12);
}

export function loadBriefs() {
  const file = ROOT + 'financiacion-breve.json';
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).fichas || {} : {};
}

export function loadClassifier() {
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(new URL('../specialty-classification.js', import.meta.url), 'utf8'), context);
  return context.SpecialtyClassification;
}

export function buildIndex(records, classifier = loadClassifier(), briefs = loadBriefs()) {
  return records.map((record) => {
    const { cuerpo, corto, ...rest } = record;
    const result = classifier.classify(record);
    const sub = result?.specialty === classifier.REVIEW ? '' : result?.specialty || '';
    // La ficha breve solo vale para el texto con el que se escribió: si el resumen cambió, o todavía no tiene la suya,
    // la tarjeta muestra la financiación completa, como antes.
    const brief = briefs[String(record.id)];
    if (brief && brief.de === fundingDigest(record.financiacion)) {
      const { financiacion, ...short } = rest;
      return { ...short, _sub: sub, _fin: [brief.pago, brief.papel, brief.conflictos] };
    }
    return { ...rest, _sub: sub };
  });
}

export function writeIndex() {
  const records = JSON.parse(fs.readFileSync(ROOT + 'resumenes.json', 'utf8'));
  const index = buildIndex(records);
  fs.mkdirSync(ROOT + 'datos', { recursive: true });
  const target = ROOT + 'datos/indice.json';
  const text = JSON.stringify(index) + '\n';
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) fs.writeFileSync(target, text);
  return { count: index.length, bytes: Buffer.byteLength(text) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const { count, bytes } = writeIndex();
  console.log(`Índice ligero: ${count} resúmenes · ${bytes} bytes`);
}
