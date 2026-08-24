import { pathToFileURL } from 'node:url';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUIRED_MODE = 'single_recipient';
const REQUIRED_CONFIRMATION = 'SEND_ONE_QA_EMAIL';
const QA_FROM = 'Resúmenes Trials QA <novedades@resumenestrials.com>';
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`Falta ${name}; la prueba QA fue abortada.`);
  return value;
}

export function parseSingleRecipient(value) {
  const recipient = String(value || '').trim();
  if (!recipient) throw new Error('Falta RESEND_QA_RECIPIENT; la prueba QA fue abortada.');
  if (/[,;\r\n]/.test(recipient) || !EMAIL_PATTERN.test(recipient)) {
    throw new Error('RESEND_QA_RECIPIENT debe contener exactamente una dirección de correo válida.');
  }
  return recipient;
}

export async function runResendQa({ env = process.env, fetchImpl = globalThis.fetch, logger = console.log } = {}) {
  if (String(env.RESEND_QA_MODE || '') !== REQUIRED_MODE) {
    throw new Error(`RESEND_QA_MODE debe ser ${REQUIRED_MODE}; la prueba QA fue abortada.`);
  }
  if (String(env.RESEND_QA_CONFIRMATION || '') !== REQUIRED_CONFIRMATION) {
    throw new Error(`La confirmación manual debe ser ${REQUIRED_CONFIRMATION}; la prueba QA fue abortada.`);
  }

  const apiKey = required(env, 'RESEND_API_KEY');
  const recipient = parseSingleRecipient(env.RESEND_QA_RECIPIENT);
  const runId = required(env, 'GITHUB_RUN_ID');
  if (!/^\d+$/.test(runId)) throw new Error('GITHUB_RUN_ID no es válido; la prueba QA fue abortada.');
  if (typeof fetchImpl !== 'function') throw new Error('Fetch no está disponible; la prueba QA fue abortada.');

  const payload = {
    from: QA_FROM,
    to: [recipient],
    subject: `[QA] Resúmenes Trials · verificación controlada ${runId}`,
    text: `Mensaje QA controlado de Resúmenes Trials. Ejecución ${runId}. No corresponde a una notificación editorial ni a un envío de producción.`,
    html: `<p><strong>Mensaje QA controlado de Resúmenes Trials.</strong></p><p>Ejecución ${runId}. No corresponde a una notificación editorial ni a un envío de producción.</p>`,
    tags: [
      { name: 'environment', value: 'qa' },
      { name: 'mode', value: REQUIRED_MODE },
    ],
  };

  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `resumenestrials-resend-qa-${runId}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Resend rechazó el único correo QA (HTTP ${response.status}).`);
  }

  logger(`RESEND QA PASS · mode=${REQUIRED_MODE} · run=${runId} · HTTP ${response.status}`);
  return { status: response.status, mode: REQUIRED_MODE, sent: 1 };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    await runResendQa();
  } catch (error) {
    console.error(`RESEND QA FAIL · ${error instanceof Error ? error.message : 'Error desconocido.'}`);
    process.exitCode = 1;
  }
}

export { QA_FROM, REQUIRED_CONFIRMATION, REQUIRED_MODE, RESEND_ENDPOINT };
