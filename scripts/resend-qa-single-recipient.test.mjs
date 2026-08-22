import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REQUIRED_CONFIRMATION,
  REQUIRED_MODE,
  RESEND_ENDPOINT,
  runResendQa,
} from './resend-qa-single-recipient.mjs';

const scriptPath = new URL('./resend-qa-single-recipient.mjs', import.meta.url);
const workflowPath = new URL('../.github/workflows/resend-qa-single-recipient.yml', import.meta.url);
const qaRecipient = 'qa-only@example.test';
const apiKey = 're_test_key_not_real';

function validEnv(overrides = {}) {
  return {
    RESEND_QA_MODE: REQUIRED_MODE,
    RESEND_QA_CONFIRMATION: REQUIRED_CONFIRMATION,
    RESEND_API_KEY: apiKey,
    RESEND_QA_RECIPIENT: qaRecipient,
    GITHUB_RUN_ID: '123456789',
    ...overrides,
  };
}

test('envía exactamente un correo al endpoint individual y no filtra credenciales', async () => {
  const calls = [];
  const logs = [];
  const result = await runResendQa({
    env: validEnv(),
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: true, status: 200 };
    },
    logger: (message) => logs.push(String(message)),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], RESEND_ENDPOINT);
  const options = calls[0][1];
  const body = JSON.parse(options.body);
  assert.deepEqual(body.to, [qaRecipient]);
  assert.match(body.subject, /^\[QA\]/);
  assert.equal(body.tags.find((tag) => tag.name === 'environment')?.value, 'qa');
  assert.equal(body.tags.find((tag) => tag.name === 'mode')?.value, REQUIRED_MODE);
  assert.equal(options.headers['Idempotency-Key'], 'resumenestrials-resend-qa-123456789');
  assert.equal(result.sent, 1);
  assert.doesNotMatch(logs.join('\n'), new RegExp(qaRecipient.replace('.', '\\.')));
  assert.doesNotMatch(logs.join('\n'), new RegExp(apiKey));
});

test('aborta sin destinatario antes de realizar una solicitud', async () => {
  let calls = 0;
  await assert.rejects(
    runResendQa({
      env: validEnv({ RESEND_QA_RECIPIENT: '' }),
      fetchImpl: async () => { calls += 1; },
    }),
    /Falta RESEND_QA_RECIPIENT/,
  );
  assert.equal(calls, 0);
});

test('aborta sin clave de Resend antes de realizar una solicitud', async () => {
  let calls = 0;
  await assert.rejects(
    runResendQa({
      env: validEnv({ RESEND_API_KEY: '' }),
      fetchImpl: async () => { calls += 1; },
    }),
    /Falta RESEND_API_KEY/,
  );
  assert.equal(calls, 0);
});

test('rechaza cualquier intento de indicar más de un destinatario', async () => {
  for (const recipient of ['uno@example.test,dos@example.test', 'uno@example.test;dos@example.test', 'uno@example.test\ndos@example.test']) {
    let calls = 0;
    await assert.rejects(
      runResendQa({
        env: validEnv({ RESEND_QA_RECIPIENT: recipient }),
        fetchImpl: async () => { calls += 1; },
      }),
      /exactamente una dirección/,
    );
    assert.equal(calls, 0);
  }
});

test('aborta si el modo o la confirmación manual no son exactos', async () => {
  for (const overrides of [{ RESEND_QA_MODE: 'production' }, { RESEND_QA_CONFIRMATION: 'yes' }]) {
    let calls = 0;
    await assert.rejects(runResendQa({
      env: validEnv(overrides),
      fetchImpl: async () => { calls += 1; },
    }), /abortada/);
    assert.equal(calls, 0);
  }
});

test('no incorpora integraciones de newsletter ni endpoints masivos', () => {
  const source = readFileSync(scriptPath, 'utf8').toLowerCase();
  for (const forbidden of ['supabase', 'subscriber', 'resumenes.json', 'notify-new-summaries', '/emails/batch']) {
    assert.equal(source.includes(forbidden), false, `El script QA contiene ${forbidden}`);
  }
});

test('el workflow sólo admite activación manual y el entorno QA', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s{2}(push|pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /environment:\s*resend-qa/);
  assert.match(workflow, /secrets\.RESEND_QA_RECIPIENT/);
  assert.match(workflow, /RESEND_QA_MODE:\s*single_recipient/);
  assert.doesNotMatch(workflow, /supabase|subscriber|notify-new-summaries|emails\/batch/i);
});

test('un rechazo remoto no expone el destinatario, la clave ni el cuerpo de respuesta', async () => {
  const remoteBody = 'remote diagnostic that must stay private';
  let error;
  try {
    await runResendQa({
      env: validEnv(),
      fetchImpl: async () => ({ ok: false, status: 403, text: async () => remoteBody }),
    });
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof Error);
  assert.match(error.message, /HTTP 403/);
  assert.doesNotMatch(error.message, new RegExp(qaRecipient.replace('.', '\\.')));
  assert.doesNotMatch(error.message, new RegExp(apiKey));
  assert.doesNotMatch(error.message, new RegExp(remoteBody));
});
