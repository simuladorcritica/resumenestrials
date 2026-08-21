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
if (before.length !== after.length) throw new Error(`Cambió el número de resúmenes: ${before.length} -> ${after.length}`);

for (let index = 0; index < before.length; index += 1) {
  const oldItem = before[index];
  const newItem = after[index];
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

console.log(`CLINICAL FREEZE PASS · ${after.length} resúmenes · contenido visible sin cambios`);
