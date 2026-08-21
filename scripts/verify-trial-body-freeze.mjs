import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.env.CLINICAL_BASE_REF || 'origin/main';
const manifest = JSON.parse(readFileSync('seo-manifest.json', 'utf8'));

function articleBody(source, path) {
  const body = String(source).match(/<article class="articulo">([\s\S]*?)<\/article>/)?.[1];
  if (body == null) throw new Error(`No se encontró el cuerpo clínico en ${path}`);
  return body.replace(/&lt;(?=\d)/g, '<').replace(/\r\n/g, '\n');
}

for (const entry of Object.values(manifest)) {
  const path = `${entry.path.slice(1)}index.html`;
  const before = execFileSync('git', ['-c', 'safe.directory=*', 'show', `${base}:${path}`], { encoding: 'utf8' });
  const after = readFileSync(path, 'utf8');
  if (articleBody(before, `${base}:${path}`) !== articleBody(after, path)) {
    throw new Error(`Cambió el cuerpo clínico visible de ${path}`);
  }
}

console.log(`TRIAL BODY FREEZE PASS · ${Object.keys(manifest).length} páginas canónicas`);
