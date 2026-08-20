import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
let failed = false;
const fail = (message) => { failed = true; console.error(`NEWSLETTER FAIL: ${message}`); };
const pass = (message) => console.log(`NEWSLETTER PASS: ${message}`);

const auth = read('auth.js');
const registration = read('registro.html');
const account = read('cuenta.html');
const schema = read('supabase/schema.sql');
const config = read('supabase/config.toml');
const fn = read('supabase/functions/notify-new-summaries/index.ts');
const workflow = read('.github/workflows/notificar-nuevos-resumenes.yml');

for (const token of ['newsletter_opt_in', 'newsletter_opt_in_at']) {
  if (!schema.includes(token) || !auth.includes(token)) fail(`La preferencia ${token} no está integrada entre esquema y cuenta.`);
}
if (!registration.includes('Quiero recibir avisos por correo cuando se publiquen nuevos resúmenes.')) {
  fail('El registro no solicita consentimiento explícito para avisos de nuevos resúmenes.');
} else pass('El registro mantiene consentimiento explícito para nuevos resúmenes.');

if (!account.includes('newsletter') && !account.includes('novedad') && !account.includes('avis')) {
  fail('La página de cuenta no parece ofrecer control de avisos.');
} else pass('La cuenta conserva control de preferencias de avisos.');

for (const token of [
  '[functions.notify-new-summaries]',
  'verify_jwt = false',
]) {
  if (!config.includes(token)) fail(`supabase/config.toml no contiene ${token}`);
}

for (const token of [
  'newsletter_opt_in", true',
  'email_confirmed_at',
  'RESEND_API_KEY',
  'https://api.resend.com/emails/batch',
  'Idempotency-Key',
  'run_attempt',
  'head_branch !== "main"',
  'resumenes.json',
  'cuenta.html',
  'resumenestrials@outlook.com',
]) {
  if (!fn.includes(token)) fail(`La Edge Function no contiene el control requerido: ${token}`);
}
if (!failed) pass('Edge Function: consentimiento, confirmación, origen, idempotencia y opt-out verificados por contrato.');

for (const token of [
  'branches: [main]',
  '- resumenes.json',
  'github.run_id',
  'github.run_attempt',
  'github.sha',
  'notify-new-summaries',
  'for intento in 1 2 3',
]) {
  if (!workflow.includes(token)) fail(`Workflow de avisos incompleto: falta ${token}`);
}
if (!failed) pass('Workflow limitado a altas publicadas en resumenes.json sobre main.');

if (failed) process.exit(1);
console.log('Newsletter integration PASS');
