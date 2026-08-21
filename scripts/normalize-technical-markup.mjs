import fs from 'node:fs';

const path = process.argv[2] || 'resumenes.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
let changes = 0;

for (const entry of data) {
  for (const field of ['objetivo', 'hallazgo', 'cuerpo', 'corto']) {
    const before = String(entry[field] || '');
    const after = before.replace(/<(\d)/g, '&lt;$1');
    if (after !== before) {
      entry[field] = after;
      changes += (before.match(/<(\d)/g) || []).length;
    }
  }
}

fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Marcado técnico normalizado: ${changes} signos matemáticos escapados; contenido visible sin cambios.`);
