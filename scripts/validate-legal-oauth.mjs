import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const scope = 'https://www.googleapis.com/auth/webmasters.readonly';

for (const [path, canonical, title] of [
  ['privacidad/index.html', 'https://resumenestrials.com/privacidad/', 'Política de Privacidad'],
  ['terminos/index.html', 'https://resumenestrials.com/terminos/', 'Términos y Condiciones de Uso'],
]) {
  assert(existsSync(path), `Falta ${path}`);
  const source = read(path);
  assert(source.includes(`<link rel="canonical" href="${canonical}">`), `${path}: canonical incorrecto`);
  assert(source.includes(`<h1>${title}</h1>`), `${path}: H1 incorrecto`);
  assert(source.includes('2 de septiembre de 2026'), `${path}: falta fecha visible`);
  assert(!/\bTODO\b|localhost|example\.com|\bTU_[A-Z_]+\b/.test(source), `${path}: contiene marcadores`);
}

const privacy = read('privacidad/index.html');
const privacyText = privacy.replace(/<wbr\s*\/?\s*>/gi, '');
for (const required of [
  scope,
  'solo lectura',
  'Google Search Console',
  'Google AdSense',
  'Supabase',
  'Resend',
  'Cloudflare Turnstile',
  'GitHub',
  'resumenestrials@outlook.com',
  'https://developers.google.com/terms/api-services-user-data-policy',
  'Uso Limitado',
  'visibilidad orgánica',
  'canibalización',
  'clusters',
  'revocar el acceso',
  '30 días',
]) assert(privacyText.includes(required), `Política de Privacidad: falta ${required}`);

const home = read('_includes/index-source.html');
for (const required of ['/privacidad/', '/terminos/', 'Google Search Console', 'solo lectura']) {
  assert(home.includes(required), `Portada: falta ${required}`);
}

const legacy = read('privacidad.html');
assert(legacy.includes('noindex,follow'), 'La URL legal heredada debe ser noindex');
assert(legacy.includes('url=/privacidad/'), 'La URL legal heredada debe dirigir a la canónica');

const fetcher = read('scripts/search-console-fetch.py');
const bootstrap = read('scripts/gsc-oauth-bootstrap.py');
for (const source of [fetcher, bootstrap]) {
  assert(source.includes(scope), 'OAuth GSC debe usar el scope de solo lectura');
  const requestedScopes = [...source.matchAll(/https:\/\/www\.googleapis\.com\/auth\/[A-Za-z0-9._/-]+/g)].map((match) => match[0]);
  assert(requestedScopes.length > 0 && requestedScopes.every((value) => value === scope), 'No se permiten scopes distintos de webmasters.readonly');
}
for (const name of ['GSC_OAUTH_CLIENT_ID', 'GSC_OAUTH_CLIENT_SECRET', 'GSC_OAUTH_REFRESH_TOKEN']) {
  assert(fetcher.includes(name), `Fetcher: falta ${name}`);
  assert(bootstrap.includes(name), `Bootstrap: falta ${name}`);
}
assert(fetcher.includes('invalid_grant') && fetcher.includes('expiró o fue revocado'), 'Fetcher: falta diagnóstico visible de invalid_grant');
assert(read('.gitignore').split(/\r?\n/).includes('.secrets/'), '.secrets/ debe estar ignorado');

const trackedSources = [
  privacy,
  read('terminos/index.html'),
  fetcher,
  bootstrap,
  read('.github/workflows/seo-intelligence.yml'),
  read('docs/google-search-console-oauth.md'),
].join('\n');
assert(!/\[(?:NOMBRE|EMPRESA)\]/i.test(trackedSources), 'Persisten marcadores legales de identidad');
for (const [label, pattern] of [
  ['clave privada', /-----BEGIN PRIVATE KEY-----/],
  ['API key de Google', /AIza[0-9A-Za-z_-]{30,}/],
  ['client ID real', /\b\d{8,}-[a-z0-9_-]{20,}\.apps\.googleusercontent\.com\b/i],
  ['refresh token real', /\b1\/\/[0-9A-Za-z_-]{30,}\b/],
]) assert(!pattern.test(trackedSources), `Posible ${label} versionado`);

console.log('LEGAL + OAUTH PASS · páginas canónicas, disclosure GSC, scope mínimo y secretos fuera del repositorio');
