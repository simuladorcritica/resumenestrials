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
const deploy = read('.github/workflows/deploy-newsletter.yml');

for (const token of ['newsletter_opt_in', 'newsletter_opt_in_at']) {
  if (!schema.includes(token) || !auth.includes(token)) fail(`La preferencia ${token} no está integrada entre esquema y cuenta.`);
}
if (!registration.includes('Quiero recibir avisos por correo cuando se publiquen nuevos resúmenes.')) {
  fail('El registro no solicita consentimiento explícito para avisos de nuevos resúmenes.');
} else pass('El registro mantiene consentimiento explícito para nuevos resúmenes.');

const hasNotificationControl = account.includes('notifMaster') && /Recibir(?: un aviso| avisos)? cuando publiquemos nuevos resúmenes\./.test(account);
if (!hasNotificationControl) {
  fail('La página de cuenta no ofrece un control identificable para activar o desactivar los avisos.');
} else pass('La cuenta conserva control directo de alta/baja de avisos.');

for (const token of ['[functions.notify-new-summaries]', 'verify_jwt = false']) {
  if (!config.includes(token)) fail(`supabase/config.toml no contiene ${token}`);
}

for (const token of [
  'newsletter_opt_in", true',
  'email_confirmed_at',
  'RESEND_API_KEY',
  'https://api.resend.com/emails/batch',
  'Idempotency-Key',
  'run_attempt',
  'before_sha',
  'head_branch !== "main"',
  '/installation/repositories?per_page=100',
  'x-github-token',
  'resumenes.json',
  'List-Unsubscribe',
  'List-Unsubscribe-Post',
  'newsletter_opt_in: false',
  'newsletter_opt_in_at: null',
  'cuenta.html#notificaciones',
  'resumenestrials@outlook.com',
]) {
  if (!fn.includes(token)) fail(`La Edge Function no contiene el control requerido: ${token}`);
}
if (!failed) pass('Edge Function: consentimiento, correo confirmado, autenticación de callback, rango completo del push, idempotencia y baja en un clic verificados por contrato.');

for (const token of [
  "cron: '30 18 * * *'",
  'workflow_dispatch',
  "github.ref == 'refs/heads/main'",
  'status=success&branch=main',
  'actions: read',
  'github.run_id',
  'github.run_attempt',
  'github.sha',
  'github.token',
  'X-GitHub-Token',
  'notify-new-summaries',
  'for intento in 1 2 3',
]) {
  if (!workflow.includes(token)) fail(`Workflow de avisos incompleto: falta ${token}`);
}
if (!failed) pass('Workflow diario (12:30, centro de México) con el rango desde el último aviso exitoso, autenticado con token efímero de GitHub Actions y con reintentos.');

for (const token of [
  'SUPABASE_ACCESS_TOKEN',
  'RESEND_API_KEY',
  'hnsmozvatgyrascxbhys',
  'supabase/setup-cli@v3',
  'version: v2.stable',
  'SUPABASE_YES: "1"',
  'supabase secrets set',
  'supabase functions deploy notify-new-summaries',
  '--no-verify-jwt',
  '--use-api',
  'novedades@resumenestrials.com',
  'Verificar servicio desplegado',
  'runtime/newsletter-deploy-status.json',
  'if: always()',
  'failed_stage',
  'OUTCOME_HEALTH',
  '"status": "$status"',
  'newsletter-deploy-status-${{ github.run_id }}',
  'contents: read',
  'GITHUB_STEP_SUMMARY',
]) {
  if (!deploy.includes(token)) fail(`Workflow de despliegue incompleto: falta ${token}`);
}
// El artefacto de estado debe subirse con upload-artifact v7 fijado a una versión exacta
// (Dependabot actualiza el parche; la validación no debe exigir uno concreto).
// `version: latest` rompió el despliegue cuando la CLI pasó sola a la v3 (2026-11-09): no debe volver.
if (/version:\s*latest/.test(deploy)) fail('Workflow de despliegue: la CLI de Supabase debe ir en una versión fija, no en latest.');
if (!/actions\/upload-artifact@v7\.\d+\.\d+\b/.test(deploy)) fail('Workflow de despliegue incompleto: falta actions/upload-artifact@v7.x.y fijado');
if (/git\s+push\s+origin\s+HEAD:main/.test(deploy) || /permissions:\s*[\s\S]*?contents:\s*write/.test(deploy)) {
  fail('El workflow de newsletter no debe escribir directamente en main protegido.');
} else {
  pass('Workflow de despliegue conserva observabilidad mediante artefacto/resumen y no escribe directamente en main.');
}
if (!failed) pass('Despliegue de producción usa la CLI oficial en una versión fija y con confirmación explícita, configura secretos, publica por API, ejecuta health check y conserva el resultado sin commits automáticos a main.');

if (failed) process.exit(1);
console.log('Newsletter integration PASS');
