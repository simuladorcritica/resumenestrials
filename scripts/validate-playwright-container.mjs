// La versión del contenedor oficial de Playwright en CI debe coincidir con la fijada en
// package.json: el contenedor trae solo los navegadores de su propia versión.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).dependencies?.playwright
  ?? JSON.parse(readFileSync('package.json', 'utf8')).devDependencies?.playwright;
assert.match(String(version), /^\d+\.\d+\.\d+$/, 'playwright debe fijarse a una versión exacta en package.json');
let found = 0;
for (const file of readdirSync('.github/workflows').filter(f => f.endsWith('.yml'))) {
  const source = readFileSync(`.github/workflows/${file}`, 'utf8');
  for (const match of source.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/g)) {
    found++;
    assert.equal(match[1], version, `${file} usa el contenedor de Playwright v${match[1]}, pero package.json fija ${version}: actualiza ambos juntos`);
  }
}
assert.ok(found > 0, 'no se encontró ningún contenedor de Playwright en .github/workflows');
// deno.lock (función del boletín en Supabase) anota las dependencias de package.json; CI corre
// `deno check --frozen`, que falla si esa lista no coincide.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const expected = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).map(([name, v]) => `npm:${name}@${v}`).sort();
const lock = JSON.parse(readFileSync('deno.lock', 'utf8'));
const locked = [...(lock.workspace?.packageJson?.dependencies || [])].sort();
assert.deepEqual(locked, expected, 'deno.lock no coincide con package.json: actualiza workspace.packageJson.dependencies');
console.log(`PLAYWRIGHT CONTAINER PASS · ${found} trabajos en v${version} · deno.lock al día`);
