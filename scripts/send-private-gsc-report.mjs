import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REPORT_FROM = 'Resúmenes Trials SEO <novedades@resumenestrials.com>';
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const REPORT_FILES = ['seo-weekly.md', 'seo-monthly.md', 'article-discovery.md'];

function singleRecipient(value) {
  const recipient = String(value || '').trim();
  if (!recipient || /[,;\r\n]/.test(recipient) || !EMAIL_PATTERN.test(recipient)) {
    throw new Error('GSC_PRIVATE_REPORT_RECIPIENT debe ser una única dirección válida.');
  }
  return recipient;
}

function loadReport(reportDir) {
  const sections = [];
  for (const name of REPORT_FILES) {
    const path = join(reportDir, name);
    if (!existsSync(path)) throw new Error('Falta un informe privado esperado.');
    sections.push(readFileSync(path, 'utf8').trim());
  }
  return sections.join('\n\n---\n\n');
}

function htmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendPrivateGscReport({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console.log,
} = {}) {
  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const reportDir = String(env.GSC_PRIVATE_REPORT_DIR || '').trim();
  const runId = String(env.GITHUB_RUN_ID || '').trim();

  if (!apiKey || !reportDir) {
    logger('Private report delivery: SKIPPED (secure delivery unavailable)');
    return { sent: 0, status: 'skipped' };
  }
  if (!/^\d+$/.test(runId)) throw new Error('GITHUB_RUN_ID no es válido.');
  if (typeof fetchImpl !== 'function') throw new Error('Fetch no está disponible.');

  const recipient = singleRecipient(env.GSC_PRIVATE_REPORT_RECIPIENT);
  const report = loadReport(reportDir);
  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `resumenestrials-gsc-private-${runId}`,
    },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [recipient],
      subject: '[Privado] Resúmenes Trials · informe de Search Console',
      text: report,
      html: `<p><strong>Informe privado de Search Console</strong></p><pre style="white-space:pre-wrap">${htmlEscape(report)}</pre>`,
      tags: [
        { name: 'report', value: 'gsc-private' },
        { name: 'source', value: 'seo-intelligence' },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) throw new Error(`Resend rechazó el informe privado (HTTP ${response.status}).`);
  logger('Private report delivery: PASS');
  return { sent: 1, status: response.status };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    await sendPrivateGscReport();
  } catch (error) {
    console.error(`Private report delivery: FAIL · ${error instanceof Error ? error.message : 'Error desconocido.'}`);
    process.exitCode = 1;
  }
}

export { REPORT_FILES, REPORT_FROM, RESEND_ENDPOINT, singleRecipient };
