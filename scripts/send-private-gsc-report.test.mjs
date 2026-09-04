import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { sendPrivateGscReport } from './send-private-gsc-report.mjs';

const recipient = 'admin@example.test';
const apiKey = 're_test_private_value';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'gsc-private-report-'));
  writeFileSync(join(directory, 'seo-weekly.md'), '# Weekly\nprivate-query-value\n10 clicks\n', 'utf8');
  writeFileSync(join(directory, 'seo-monthly.md'), '# Monthly\nhttps://private.example/page\n20 impressions\n', 'utf8');
  writeFileSync(join(directory, 'article-discovery.md'), '# Discovery\nPRIVATE_DISCOVERY_STATUS\n', 'utf8');
  return directory;
}

test('envía exactamente un informe sin filtrar contenido ni destinatario a logs', async () => {
  const directory = fixture();
  const calls = [];
  const logs = [];
  try {
    const result = await sendPrivateGscReport({
      env: {
        RESEND_API_KEY: apiKey,
        GSC_PRIVATE_REPORT_RECIPIENT: recipient,
        GSC_PRIVATE_REPORT_DIR: directory,
        GITHUB_RUN_ID: '12345',
      },
      fetchImpl: async (...args) => {
        calls.push(args);
        return { ok: true, status: 200 };
      },
      logger: (message) => logs.push(message),
    });
    assert.equal(result.sent, 1);
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0][1].body);
    assert.deepEqual(payload.to, [recipient]);
    assert.match(payload.text, /private-query-value/);
    assert.match(payload.text, /private\.example/);
    assert.match(payload.text, /PRIVATE_DISCOVERY_STATUS/);
    const output = logs.join('\n');
    assert.equal(output, 'Private report delivery: PASS');
    assert.doesNotMatch(output, /private-query-value|private\.example|admin@example/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('omite la entrega sin bloquear cuando no hay infraestructura segura', async () => {
  const logs = [];
  const result = await sendPrivateGscReport({
    env: {},
    fetchImpl: async () => { throw new Error('no debe invocarse'); },
    logger: (message) => logs.push(message),
  });
  assert.deepEqual(result, { sent: 0, status: 'skipped' });
  assert.deepEqual(logs, ['Private report delivery: SKIPPED (secure delivery unavailable)']);
});

test('rechaza múltiples destinatarios', async () => {
  const directory = fixture();
  try {
    await assert.rejects(
      sendPrivateGscReport({
        env: {
          RESEND_API_KEY: apiKey,
          GSC_PRIVATE_REPORT_RECIPIENT: 'one@example.test,two@example.test',
          GSC_PRIVATE_REPORT_DIR: directory,
          GITHUB_RUN_ID: '12345',
        },
        fetchImpl: async () => ({ ok: true, status: 200 }),
      }),
      /una única dirección válida/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
