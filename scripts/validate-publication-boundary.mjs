import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync('_config.yml', 'utf8');
for (const path of [
  'docs',
  'scripts',
  'supabase',
  'tools',
  'runtime',
  'PROMPT_*.md',
  'release-marker*.txt',
  'package.json',
  'deno.json',
]) {
  assert(config.includes(`- ${path}`) || config.includes(`- "${path}"`), `_config.yml no excluye ${path}`);
}
assert(!config.includes('agregar.html'), 'agregar.html requiere decisión editorial antes de excluirse');
console.log('PUBLICATION BOUNDARY PASS');
