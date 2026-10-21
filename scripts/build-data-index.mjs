// Índice ligero para listas, búsqueda, filtros y recomendaciones.
// Contiene cada registro sin `cuerpo` ni `corto` (el ~90 % del peso), más dos
// campos precalculados con la misma lógica que el navegador:
//   _sub  subespecialidad inferida (specialty-classification.js, que usa el cuerpo)
//   _min  minutos de lectura del completo y del breve
// El texto completo de cada ensayo vive en datos/ensayos/<id>.json.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function plain(html) {
  return String(html ?? '').replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function minutes(html) {
  return Math.max(1, Math.round((plain(html).match(/[\p{L}\p{N}_]+/gu) || []).length / 230));
}

export function loadClassifier() {
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(new URL('../specialty-classification.js', import.meta.url), 'utf8'), context);
  return context.SpecialtyClassification;
}

export function buildIndex(records, classifier = loadClassifier()) {
  return records.map((record) => {
    const { cuerpo, corto, ...rest } = record;
    const result = classifier.classify(record);
    const sub = result?.specialty === classifier.REVIEW ? '' : result?.specialty || '';
    const min = { cuerpo: minutes(cuerpo) };
    if (corto) min.corto = minutes(corto);
    return { ...rest, _sub: sub, _min: min };
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
