import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { console.error(`EDITORIAL FAIL: ${message}`); process.exitCode = 1; };
const ok = (message) => console.log(`EDITORIAL PASS: ${message}`);

const homeAuth = read('home-auth-ui.js');
const interactive = read('interactive-home.js');
const account = read('cuenta.html');
const auth = read('auth.js');
const login = read('login.html');
const register = read('registro.html');
const recovery = read('recuperar.html');

if (!homeAuth.includes('id = "account-entry"')) fail('La portada no define el módulo único de cuenta.');
else ok('Módulo único de cuenta presente.');

if (homeAuth.includes('cuenta-link') || homeAuth.includes('login-link')) fail('Persisten identificadores de CTA separados en la cabecera.');
else ok('No existen CTA separados de Crear cuenta / Entrar en la portada.');

if (!interactive.includes("header.insertBefore(div, search)")) fail('Los filtros avanzados no están integrados dentro de la cabecera del índice.');
else ok('Filtros avanzados integrados en la barra del índice.');

for (const [name, html] of [['cuenta.html', account], ['login.html', login], ['registro.html', register]]) {
  if (/linear-gradient\s*\(/i.test(html)) fail(`${name} conserva un gradiente de estilo dashboard.`);
  else ok(`${name} sin gradientes decorativos.`);
  if (/box-shadow\s*:\s*0\s+18px\s+55px/i.test(html)) fail(`${name} conserva la sombra flotante anterior.`);
  else ok(`${name} sin sombra flotante anterior.`);
}

const registrationLinks = (login.match(/href="registro\.html"/g) || []).length;
if (registrationLinks !== 1) fail(`login.html debe tener una sola ruta visible a registro; encontradas ${registrationLinks}.`);
else ok('Login con una sola ruta a creación de cuenta.');

for (const [name, html] of [['cuenta.html', account], ['login.html', login], ['registro.html', register], ['recuperar.html', recovery]]) {
  if (!html.includes("Fraunces") || !html.includes("Newsreader") || !html.includes("IBM+Plex+Mono")) fail(`${name} no conserva las tres familias tipográficas del sistema.`);
  else ok(`${name} conserva Fraunces, Newsreader e IBM Plex Mono.`);
}

if (!auth.includes('getAccountPreferences') || !auth.includes('updateAccountPreferences')) fail('auth.js no expone el contrato de preferencias de cuenta.');
else ok('Contrato de preferencias disponible en auth.js.');

const requiredAccountFragments = [
  "updateProfile({firstName:",
  "newsletterOptIn:",
  "saved.notifications||{}",
  "saved.preferences||{}",
  "updateAccountPreferences({notifications:{",
  "updateAccountPreferences({preferences:{"
];
for (const fragment of requiredAccountFragments) {
  if (!account.includes(fragment)) fail(`cuenta.html no respeta el contrato actual de auth.js: falta ${fragment}`);
}
if (!process.exitCode) ok('Cuenta y auth.js comparten el mismo contrato de perfil y preferencias.');

const obsoleteAccountFragments = ['notifications_enabled', 'notify_critical_care', 'notify_internal_medicine', 'sort_preference'];
for (const fragment of obsoleteAccountFragments) {
  if (account.includes(fragment)) fail(`cuenta.html usa una clave obsoleta no soportada por auth.js: ${fragment}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('Editorial architecture PASS');
