import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflowPath = '.github/workflows/seo-intelligence.yml';
const workflow = readFileSync(workflowPath, 'utf8');
const fetcher = readFileSync('scripts/search-console-fetch.py', 'utf8');
const opportunities = readFileSync('scripts/seo-opportunities.mjs', 'utf8');
const ignore = readFileSync('.gitignore', 'utf8').split(/\r?\n/);

function uploadPaths(source) {
  const paths = [];
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (!/uses:\s*actions\/upload-artifact@/i.test(lines[index])) continue;
    const indent = lines[index].match(/^\s*/)[0].length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const lineIndent = line.match(/^\s*/)[0].length;
      if (line.trim().startsWith('- ') && lineIndent <= indent) break;
      const match = line.match(/^\s*path:\s*(.+?)\s*$/);
      if (match) paths.push(match[1].replace(/^['"]|['"]$/g, ''));
    }
  }
  return paths;
}

function unsafeArtifactPath(path) {
  const normalized = path.replaceAll('\\', '/').trim().toLowerCase();
  if (normalized === 'reports/seo-technical.json') return false;
  return normalized === 'reports/'
    || normalized === 'reports'
    || /(^|\/)seo-data(\/|$)/.test(normalized)
    || /(^|\/)gsc(?:-data)?(\/|$)/.test(normalized)
    || /search-console/.test(normalized)
    || /runner\.temp.*gsc|runner_temp.*gsc/.test(normalized);
}

function unsafeSummaryLines(source) {
  return source.split(/\r?\n/).filter((line) => {
    if (!line.includes('GITHUB_STEP_SUMMARY')) return false;
    if (/\bcat\b/i.test(line)) return true;
    return /seo-(?:weekly|monthly|opportunit)|search-console\.json|\b(?:query|clicks|impressions|ctr|position)\b/i.test(line);
  });
}

test('el workflow mantiene Search Console en el almacenamiento temporal del runner', () => {
  assert.match(workflow, /search-console-fetch\.py --output "\$RUNNER_TEMP\/gsc\/search-console\.json"/);
  assert.match(workflow, /GSC_DATA_FILE:\s*\$\{\{ runner\.temp \}\}\/gsc\/search-console\.json/);
  assert.match(workflow, /GSC_REPORT_DIR:\s*\$\{\{ runner\.temp \}\}\/gsc\/reports/);
  assert.match(workflow, /rm -rf -- "\$private_root"/);
});

test('ningún artefacto SEO incluye datos GSC brutos o derivados', () => {
  const paths = uploadPaths(workflow);
  assert.deepEqual(paths, ['reports/seo-technical.json']);
  assert.equal(paths.some(unsafeArtifactPath), false);
  assert.equal(unsafeArtifactPath('reports/'), true);
  assert.equal(unsafeArtifactPath('${{ runner.temp }}/gsc/reports'), true);
  assert.equal(unsafeArtifactPath('reports/seo-technical.json'), false);
});

test('el summary solo escribe estados y auditoría técnica', () => {
  assert.deepEqual(unsafeSummaryLines(workflow), []);
  assert.equal(unsafeSummaryLines('cat private.md >> "$GITHUB_STEP_SUMMARY"').length, 1);
  assert.equal(unsafeSummaryLines('printf "clicks: 10" >> "$GITHUB_STEP_SUMMARY"').length, 1);
  assert.equal(unsafeSummaryLines('printf "Google Search Console: PASS" >> "$GITHUB_STEP_SUMMARY"').length, 0);
  for (const status of [
    'Google Search Console: PASS',
    'OAuth provider:',
    'Property access: PASS',
    'Opportunity Engine: PASS',
    'Report generated privately: PASS',
  ]) assert.ok(workflow.includes(status), `Falta el estado público permitido: ${status}`);
});

test('los logs de los procesadores no contienen métricas ni identificadores GSC', () => {
  const pythonPrints = [...fetcher.matchAll(/print\(([^\n]*)\)/g)].map((match) => match[1]);
  const jsLogs = [...opportunities.matchAll(/console\.log\(([^\n]*)\)/g)].map((match) => match[1]);
  const privateLogPattern = /len\(rows\)|rows\.length|opportunities\.length|\b(?:query|clicks|impressions|ctr|position|site_url)\b|\$\{(?:start|end|provider)/i;
  assert.equal(pythonPrints.some((line) => privateLogPattern.test(line)), false);
  assert.equal(jsLogs.some((line) => privateLogPattern.test(line)), false);
});

test('los nombres habituales de datasets GSC permanecen ignorados por Git', () => {
  for (const entry of ['seo-data/', 'gsc-data/', 'search-console*.json']) {
    assert.ok(ignore.includes(entry), `Falta ignorar ${entry}`);
  }
});
