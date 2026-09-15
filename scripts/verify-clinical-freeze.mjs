import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  isClinicalFieldAuthorized,
  loadClinicalCorrectionAuthorizations,
} from './clinical-correction-authorizations.mjs';

const base = process.env.CLINICAL_BASE_REF || 'origin/main';
const head = process.env.CLINICAL_HEAD_REF || (process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_SHA : '');
const clinicalFields = new Set(['titulo', 'autor', 'revista', 'objetivo', 'hallazgo', 'cuerpo', 'corto']);
const classificationFields = new Set(['especialidad_principal', 'especialidad_secundaria']);

function readBase() {
  const source = execFileSync('git', ['-c', 'safe.directory=*', 'show', `${base}:resumenes.json`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(source);
}

function readCurrent() {
  if (head) {
    const source = execFileSync('git', ['-c', 'safe.directory=*', 'show', `${head}:resumenes.json`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(source);
  }
  return JSON.parse(readFileSync('resumenes.json', 'utf8'));
}

function visible(value) {
  return String(value).replace(/&lt;(?=\d)/g, '<');
}

function changed(oldValue, newValue, key) {
  if (clinicalFields.has(key) && typeof oldValue === 'string' && typeof newValue === 'string') {
    return visible(oldValue) !== visible(newValue);
  }
  return JSON.stringify(oldValue) !== JSON.stringify(newValue);
}

const before = readBase();
const after = readCurrent();
const authorizations = loadClinicalCorrectionAuthorizations({ baseRef: base });
const consumedAuthorizations = new Set();
const beforeById = new Map();
const afterById = new Map();

for (const item of before) {
  const id = String(item?.id ?? '').trim();
  if (!id || beforeById.has(id)) throw new Error(`La base clínica contiene un ID inválido o duplicado: ${id || '(vacío)'}`);
  beforeById.set(id, item);
}
for (const item of after) {
  const id = String(item?.id ?? '').trim();
  if (!id || afterById.has(id)) throw new Error(`resumenes.json contiene un ID inválido o duplicado: ${id || '(vacío)'}`);
  afterById.set(id, item);
}

for (const [id, oldItem] of beforeById) {
  const newItem = afterById.get(id);
  if (!newItem) throw new Error(`Se eliminó el resumen clínico existente con ID ${id}`);
  const keys = new Set([...Object.keys(oldItem), ...Object.keys(newItem)]);
  for (const key of keys) {
    if (classificationFields.has(key)) continue;

    const oldValue = oldItem[key];
    const newValue = newItem[key];
    if (!changed(oldValue, newValue, key)) continue;

    if (isClinicalFieldAuthorized(authorizations, id, key)) {
      consumedAuthorizations.add(`${id}:${key}`);
      continue;
    }

    if (clinicalFields.has(key) && typeof oldValue === 'string' && typeof newValue === 'string') {
      throw new Error(`Cambio editorial no autorizado en resumen ${oldItem.id}, campo ${key}`);
    }
    throw new Error(`Cambio de datos no autorizado en resumen ${oldItem.id}, campo ${key}`);
  }
}

for (const pair of authorizations.pairs) {
  if (!consumedAuthorizations.has(pair)) {
    throw new Error(`Autorización clínica no consumida: ${pair}. El manifest debe describir exactamente el diff de este PR.`);
  }
}

const added = [...afterById.keys()].filter((id) => !beforeById.has(id));
const authorized = consumedAuthorizations.size;
console.log(
  `CLINICAL FREEZE PASS · ${before.length} existentes protegidos · ${added.length} altas nuevas · ${authorized} cambios explícitamente autorizados`,
);
