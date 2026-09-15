import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  isClinicalFieldAuthorized,
  loadClinicalCorrectionAuthorizations,
} from './clinical-correction-authorizations.mjs';

const base = process.env.CLINICAL_BASE_REF || 'origin/main';
const head = process.env.CLINICAL_HEAD_REF || (process.env.GITHUB_ACTIONS === 'true' ? process.env.GITHUB_SHA : '');
const manifest = JSON.parse(readFileSync('seo-manifest.json', 'utf8'));
const baseManifest = JSON.parse(execFileSync(
  'git',
  ['-c', 'safe.directory=*', 'show', `${base}:seo-manifest.json`],
  { encoding: 'utf8' },
));
const authorizations = loadClinicalCorrectionAuthorizations({ baseRef: base });

function articleBody(source, path) {
  const body = String(source).match(/<article class="articulo">([\s\S]*?)<\/article>/)?.[1];
  if (body == null) throw new Error(`No se encontró el cuerpo clínico en ${path}`);
  return body.replace(/&lt;(?=\d)/g, '<').replace(/\r\n/g, '\n');
}

function readCurrent(path) {
  if (head) {
    return execFileSync('git', ['-c', 'safe.directory=*', 'show', `${head}:${path}`], { encoding: 'utf8' });
  }
  return readFileSync(path, 'utf8');
}

for (const [id, baseEntry] of Object.entries(baseManifest)) {
  const currentEntry = manifest[id];
  if (!currentEntry) throw new Error(`Falta la página canónica del resumen existente con ID ${id}`);
  const beforePath = `${baseEntry.path.slice(1)}index.html`;
  const afterPath = `${currentEntry.path.slice(1)}index.html`;
  const before = execFileSync('git', ['-c', 'safe.directory=*', 'show', `${base}:${beforePath}`], { encoding: 'utf8' });
  const after = readCurrent(afterPath);

  if (articleBody(before, `${base}:${beforePath}`) !== articleBody(after, afterPath)) {
    if (isClinicalFieldAuthorized(authorizations, id, 'cuerpo')) continue;
    throw new Error(`Cambió el cuerpo clínico visible de ${afterPath} sin autorización explícita del campo cuerpo para el ID ${id}`);
  }
}

const added = Object.keys(manifest).filter((id) => !Object.hasOwn(baseManifest, id));
console.log(`TRIAL BODY FREEZE PASS · ${Object.keys(baseManifest).length} páginas existentes protegidas · ${added.length} altas nuevas`);
