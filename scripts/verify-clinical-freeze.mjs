import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.env.CLINICAL_BASE_REF || 'origin/main';
const clinicalFields = new Set(['titulo', 'autor', 'revista', 'objetivo', 'hallazgo', 'cuerpo', 'corto']);

function readBase() {
  const source = execFileSync('git', ['-c', 'safe.directory=*', 'show', `${base}:resumenes.json`], { encoding: 'utf8' });
  return JSON.parse(source);
}

function visible(value) {
  return String(value).replace(/&lt;(?=\d)/g, '<');
}

const before = readBase();
const after = JSON.parse(readFileSync('resumenes.json', 'utf8'));
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
    const oldValue = oldItem[key];
    const newValue = newItem[key];
    if (clinicalFields.has(key) && typeof oldValue === 'string' && typeof newValue === 'string') {
      if (visible(oldValue) !== visible(newValue)) throw new Error(`Cambio editorial en resumen ${oldItem.id}, campo ${key}`);
      continue;
    }
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) throw new Error(`Cambio de datos en resumen ${oldItem.id}, campo ${key}`);
  }
}

const added = [...afterById.keys()].filter((id) => !beforeById.has(id));
console.log(`CLINICAL FREEZE PASS · ${before.length} existentes sin cambios · ${added.length} altas nuevas`);
