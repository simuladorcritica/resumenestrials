import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidIsoDate } from './article-inventory.mjs';
import { compareResumenesJson, sha256 } from './resumenes-json-guard.mjs';

const EXPECTED_REPOSITORY = 'simuladorcritica/resumenestrials';
const TARGET_FILE = 'resumenes.json';
const BRANCH_PREFIX = 'auto/resumenes-json-';

export class AutomationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function commandLabel(command, args) {
  return [basename(command), ...args.slice(0, 2)].join(' ');
}

function run(command, args, { cwd, encoding = 'utf8', allowFailure = false, quiet = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error && !allowFailure) {
    throw new AutomationError('COMMAND_UNAVAILABLE', `No se pudo ejecutar ${basename(command)}.`);
  }
  if (result.status !== 0 && !allowFailure) {
    throw new AutomationError('COMMAND_FAILED', `${commandLabel(command, args)} terminó con código ${result.status}.`);
  }
  return result;
}

function git(args, options = {}) {
  return run('git', args, options);
}

export function isExpectedOrigin(remoteUrl) {
  const value = String(remoteUrl ?? '').trim().replace(/\.git$/i, '');
  return value === `https://github.com/${EXPECTED_REPOSITORY}`
    || value === `git@github.com:${EXPECTED_REPOSITORY}`
    || value === `ssh://git@github.com/${EXPECTED_REPOSITORY}`;
}

export function buildBranchName(now, localSha256) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${BRANCH_PREFIX}${stamp}-${localSha256.slice(0, 8)}`;
}

function parseArgs(argv) {
  const result = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (!value.startsWith('--')) throw new AutomationError('INVALID_ARGUMENT', `Argumento no reconocido: ${value}`);
    const name = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new AutomationError('INVALID_ARGUMENT', `Falta el valor de ${value}.`);
    result[name] = next;
    index += 1;
  }
  return result;
}

function defaultStateRoot() {
  const localAppData = process.env.LOCALAPPDATA;
  return localAppData
    ? join(localAppData, 'ResumenesTrials', 'resumenes-json-automation')
    : join(homedir(), '.resumenestrials', 'resumenes-json-automation');
}

function writeReport(reportDirectory, report) {
  mkdirSync(reportDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(reportDirectory, `report-${timestamp}-${report.localSha256?.slice(0, 8) ?? 'unknown'}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return reportPath;
}

function acquireLock(stateRoot, repoRoot) {
  mkdirSync(stateRoot, { recursive: true });
  const key = createHash('sha256').update(repoRoot.toLowerCase()).digest('hex').slice(0, 16);
  const lockPath = join(stateRoot, `run-${key}.lock`);
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner = null;
    try {
      owner = JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch {
      // Un archivo incompleto se trata como bloqueo activo por seguridad.
    }
    if (Number.isInteger(owner?.pid)) {
      try {
        process.kill(owner.pid, 0);
        throw new AutomationError('AUTOMATION_ALREADY_RUNNING', 'Ya existe una ejecución activa para este repositorio.');
      } catch (probeError) {
        if (probeError instanceof AutomationError) throw probeError;
        if (probeError.code !== 'ESRCH') {
          throw new AutomationError('AUTOMATION_ALREADY_RUNNING', 'No fue posible confirmar que el bloqueo anterior esté inactivo.');
        }
      }
      unlinkSync(lockPath);
      descriptor = openSync(lockPath, 'wx');
    } else {
      throw new AutomationError('AUTOMATION_ALREADY_RUNNING', 'Existe un bloqueo de ejecución que requiere revisión manual.');
    }
  }
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  closeSync(descriptor);
  return () => {
    try {
      unlinkSync(lockPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  };
}

function ensureSourceFile(targetPath) {
  const actual = resolve(targetPath);
  if (basename(actual).toLowerCase() !== TARGET_FILE) {
    throw new AutomationError('UNEXPECTED_TARGET', `La fuente debe llamarse exactamente ${TARGET_FILE}.`);
  }
  if (!existsSync(actual)) throw new AutomationError('TARGET_MISSING', `No existe ${actual}.`);
}

function changedPaths(repoRoot) {
  const output = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: repoRoot, encoding: 'utf8' }).stdout;
  const entries = output.split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    paths.push(entry.slice(3).replace(/\\/g, '/'));
    if (status.includes('R') || status.includes('C')) {
      index += 1;
      if (entries[index]) paths.push(entries[index].replace(/\\/g, '/'));
    }
  }
  return [...new Set(paths)];
}

export function assertOnlyResumenesChanges(paths) {
  const unexpected = paths.filter((path) => path !== TARGET_FILE);
  if (unexpected.length > 0) {
    throw new AutomationError(
      'UNRELATED_LOCAL_CHANGES',
      `Se detectaron cambios locales fuera de ${TARGET_FILE}; se bloqueó la automatización.`,
    );
  }
}

function assertGitHubCli(repoRoot) {
  const version = run('gh', ['--version'], { cwd: repoRoot, allowFailure: true, quiet: true });
  if (version.error || version.status !== 0) {
    throw new AutomationError('GH_CLI_REQUIRED', 'GitHub CLI (gh) no está instalado o no está disponible en PATH.');
  }
  const auth = run('gh', ['auth', 'status', '--hostname', 'github.com'], { cwd: repoRoot, allowFailure: true, quiet: true });
  if (auth.status !== 0) {
    throw new AutomationError('GH_AUTH_REQUIRED', 'GitHub CLI no tiene una sesión válida para github.com.');
  }
}

function assertGitIdentity(repoRoot) {
  for (const key of ['user.name', 'user.email']) {
    const result = git(['config', '--get', key], { cwd: repoRoot, allowFailure: true });
    if (result.status !== 0 || !String(result.stdout).trim()) {
      throw new AutomationError('GIT_IDENTITY_REQUIRED', `Falta configurar git ${key}.`);
    }
  }
}

function buildPullRequestBody({ comparison, mainSha, localSha }) {
  const identifiers = (comparison.ingestionReport ?? comparison.newArticles).flatMap((article) => {
    if (!article.canonical) {
      return [`- ID ${article.id ?? '(sin ID)'} · DOI ${article.doi ?? '(sin DOI)'} · ${article.title ?? '(sin título)'}`];
    }
    return [
      `- ID ${article.id} · ${article.title}`,
      `  - DOI: ${article.doi}`,
      `  - Clasificación: ${article.classification}`,
      `  - URL canónica: ${article.canonical}`,
      `  - Página estática: ${article.page ? 'PASS' : 'FAIL'}`,
      `  - HTTP: ${article.http}`,
      `  - Sitemap: ${article.sitemap ? 'PASS' : 'FAIL'}`,
      `  - Schema Article/Breadcrumb: ${article.schema ? 'PASS' : 'FAIL'}`,
      `  - Hub/enlace interno: ${article.hub ? 'PASS' : 'FAIL'}`,
      `  - Feed: ${article.feed}`,
      `  - QA de alta: ${article.qa ? 'PASS' : 'FAIL'}`,
    ];
  });
  return [
    '## Automatización local de resumenes.json',
    '',
    `- Base main: \`${mainSha}\``,
    `- SHA-256 local: \`${localSha}\``,
    `- Artículos nuevos: ${comparison.counts.new}`,
    '- Archivos modificados por la automatización: `resumenes.json` exclusivamente.',
    '- Merge automático: desactivado.',
    '- Generación y QA local aislados: PASS.',
    '',
    '### Identificadores detectados',
    '',
    ...identifiers,
    '',
    'Los workflows existentes deben validar este PR antes de cualquier revisión humana o fusión.',
  ].join('\n');
}

export const INGESTION_PREFLIGHT_STEPS = Object.freeze([
  ['Generación SEO', 'python', ['generar_seo.py']],
  ['Generación semántica', 'python', ['generar_seo_semantico.py']],
  ['Generación avanzada', 'python', ['generar_seo_avanzado.py']],
  ['Restauración editorial', 'python', ['restaurar_arquitectura.py']],
  ['Fechas editoriales', 'python', ['actualizar_agregar_editorial.py']],
  ['Páginas sociales', 'python', ['generar_paginas_sociales.py']],
  ['Validación de datos', 'node', ['scripts/validate-data.mjs']],
  ['Cobertura dinámica', 'node', ['scripts/validate-article-indexability.mjs']],
  ['Sitemap', 'node', ['scripts/validate-sitemap.mjs']],
  ['Feed', 'node', ['scripts/validate-feed.mjs']],
  ['SEO', 'node', ['scripts/validate-seo.mjs']],
  ['Auditoría SEO', 'node', ['scripts/seo-audit.mjs', '--fail-on-high']],
]);

export function assertPreflightResults(results) {
  const failed = results.find((result) => result.status !== 0);
  if (failed) {
    throw new AutomationError(
      'INGESTION_PREFLIGHT_FAILED',
      `La etapa ${failed.label} falló; no se creó rama ni PR.`,
    );
  }
}

function runIngestionPreflight(worktreePath, pythonPath) {
  const results = INGESTION_PREFLIGHT_STEPS.map(([label, runtime, args]) => {
    const command = runtime === 'python' ? pythonPath : process.execPath;
    const result = run(command, args, { cwd: worktreePath, allowFailure: true, quiet: true });
    return { label, status: result.status ?? 1 };
  });
  assertPreflightResults(results);
}

function buildIngestionReport(worktreePath, comparison) {
  const data = JSON.parse(readFileSync(join(worktreePath, TARGET_FILE), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(worktreePath, 'seo-manifest.json'), 'utf8'));
  const sitemap = readFileSync(join(worktreePath, 'sitemap.xml'), 'utf8');
  const feed = readFileSync(join(worktreePath, 'feed.xml'), 'utf8');
  const navigationFiles = [
    join(worktreePath, '_includes', 'index-source.html'),
    join(worktreePath, 'medicina-critica', 'index.html'),
    join(worktreePath, 'medicina-interna', 'index.html'),
  ].filter(existsSync).map((file) => readFileSync(file, 'utf8')).join('\n');

  return comparison.newArticles.map((candidate) => {
    const item = data[candidate.index];
    const entry = manifest[String(item.id)];
    const pagePath = entry ? join(worktreePath, entry.path.replace(/^\//, ''), 'index.html') : '';
    const page = pagePath && existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
    const editorialDate = ['fecha_publicacion_resumen', 'fecha_revision', 'actualizado']
      .map((key) => item[key]).find(isValidIsoDate);
    const schema = /["']@type["']\s*:\s*["']Article["']/.test(page)
      && /["']@type["']\s*:\s*["']BreadcrumbList["']/.test(page);
    const hub = Boolean(entry?.path && navigationFiles.includes(`href="${entry.path}"`));
    const feedState = editorialDate
      ? (feed.includes(`<id>${entry?.url}</id>`) ? 'PASS' : 'FAIL')
      : 'NO APLICA (sin fecha editorial explícita)';
    const checks = {
      page: Boolean(page),
      http: 'PENDIENTE HASTA EL DESPLIEGUE DE PAGES',
      sitemap: Boolean(entry?.url && sitemap.includes(`<loc>${entry.url}</loc>`)),
      schema,
      hub,
      feed: feedState,
    };
    return {
      id: String(item.id),
      title: String(item.titulo),
      doi: String(item.doi),
      classification: [item.especialidad_principal, item.especialidad_secundaria].filter(Boolean).join(' / '),
      canonical: entry?.url ?? null,
      ...checks,
      qa: checks.page && checks.sitemap && checks.schema && checks.hub && feedState !== 'FAIL',
    };
  });
}

function cleanTemporaryWorktree(repoRoot, temporaryRoot, worktreePath, wasAdded) {
  if (wasAdded) {
    git(['worktree', 'remove', '--force', worktreePath], { cwd: repoRoot, allowFailure: true, quiet: true });
  }
  if (existsSync(temporaryRoot)) rmSync(temporaryRoot, { recursive: true, force: true });
  git(['worktree', 'prune'], { cwd: repoRoot, allowFailure: true, quiet: true });
}

export function runAutomation(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const repoRoot = resolve(args.repo ?? process.cwd());
  const targetPath = resolve(args.file ?? join(repoRoot, TARGET_FILE));
  const pythonPath = args.pythonPath ?? 'python';
  const stateRoot = resolve(args.stateDir ?? defaultStateRoot());
  const reportDirectory = resolve(args.reportDir ?? join(stateRoot, 'reports'));
  ensureSourceFile(targetPath);

  const releaseLock = acquireLock(stateRoot, repoRoot);
  let report = {
    version: 1,
    status: 'blocked',
    repository: EXPECTED_REPOSITORY,
    target: TARGET_FILE,
    sourcePath: targetPath,
    startedAt: new Date().toISOString(),
  };

  try {
    const remoteUrl = git(['remote', 'get-url', 'origin'], { cwd: repoRoot }).stdout.trim();
    if (!isExpectedOrigin(remoteUrl)) {
      throw new AutomationError('UNEXPECTED_ORIGIN', `origin no corresponde a ${EXPECTED_REPOSITORY}.`);
    }
    const localChanges = changedPaths(repoRoot);
    const repositoryTarget = resolve(repoRoot, TARGET_FILE);
    if (targetPath.toLowerCase() === repositoryTarget.toLowerCase()) {
      assertOnlyResumenesChanges(localChanges);
    } else if (localChanges.length > 0) {
      throw new AutomationError(
        'UNRELATED_LOCAL_CHANGES',
        'El repositorio debe estar limpio cuando la fuente maestra se encuentra fuera de él.',
      );
    }

    const localSnapshot = readFileSync(targetPath);
    const localSha = sha256(localSnapshot);
    report.localSha256 = localSha;

    git(['fetch', '--quiet', '--no-tags', 'origin', 'main'], { cwd: repoRoot });
    const mainSha = git(['rev-parse', 'origin/main'], { cwd: repoRoot }).stdout.trim();
    const mainSnapshot = git(['show', 'origin/main:resumenes.json'], { cwd: repoRoot, encoding: null }).stdout;
    const comparison = compareResumenesJson(mainSnapshot, localSnapshot);
    report = { ...report, ...comparison, repository: EXPECTED_REPOSITORY, target: TARGET_FILE, mainCommit: mainSha };

    if (comparison.status === 'blocked') {
      report.status = 'blocked';
      report.reportPath = writeReport(reportDirectory, report);
      return { exitCode: 2, report };
    }
    if (comparison.status === 'no_changes') {
      report.status = 'no_changes';
      report.reportPath = writeReport(reportDirectory, report);
      return { exitCode: 0, report };
    }
    if (!args.dryRun) {
      assertGitHubCli(repoRoot);
      assertGitIdentity(repoRoot);
    }
    if (sha256(readFileSync(targetPath)) !== localSha) {
      throw new AutomationError('LOCAL_FILE_CHANGED_DURING_RUN', `${TARGET_FILE} cambió durante la validación.`);
    }

    const branch = args.dryRun ? null : buildBranchName(new Date(), localSha);
    report.branch = branch;
    report.remoteBranchPushed = false;
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'resumenestrials-json-'));
    const worktreePath = join(temporaryRoot, 'worktree');
    let worktreeAdded = false;
    try {
      git(['worktree', 'add', '--detach', worktreePath, 'origin/main'], { cwd: repoRoot });
      worktreeAdded = true;
      if (!args.dryRun) git(['switch', '-c', branch], { cwd: worktreePath });
      copyFileSync(targetPath, join(worktreePath, TARGET_FILE));

      runIngestionPreflight(worktreePath, pythonPath);
      comparison.ingestionReport = buildIngestionReport(worktreePath, comparison);
      report.ingestionReport = comparison.ingestionReport;
      if (comparison.ingestionReport.some((article) => !article.qa)) {
        throw new AutomationError('INGESTION_REPORT_FAILED', 'El reporte técnico de una nueva alta contiene verificaciones fallidas.');
      }

      if (args.dryRun) {
        report.status = 'dry_run_new_articles';
        report.completedAt = new Date().toISOString();
        report.reportPath = writeReport(reportDirectory, report);
        return { exitCode: 0, report };
      }

      git(['add', '--', TARGET_FILE], { cwd: worktreePath });
      const staged = git(['diff', '--cached', '--name-only', '--'], { cwd: worktreePath }).stdout.trim().split(/\r?\n/).filter(Boolean);
      if (staged.length !== 1 || staged[0].replace(/\\/g, '/') !== TARGET_FILE) {
        throw new AutomationError('UNEXPECTED_STAGED_FILES', `El commit intentó incluir archivos distintos de ${TARGET_FILE}.`);
      }
      git(['diff', '--cached', '--check'], { cwd: worktreePath });
      git(['commit', '-m', `Añadir ${comparison.counts.new} artículos nuevos a resumenes.json`], { cwd: worktreePath });

      git(['fetch', '--quiet', '--no-tags', 'origin', 'main'], { cwd: repoRoot });
      const currentMainSha = git(['rev-parse', 'origin/main'], { cwd: repoRoot }).stdout.trim();
      if (currentMainSha !== mainSha) {
        throw new AutomationError('MAIN_CHANGED_DURING_RUN', 'main cambió durante la ejecución; se bloqueó la subida para volver a comparar.');
      }
      if (sha256(readFileSync(targetPath)) !== localSha) {
        throw new AutomationError('LOCAL_FILE_CHANGED_DURING_RUN', `${TARGET_FILE} cambió antes de la subida.`);
      }

      git(['push', '--set-upstream', 'origin', branch], { cwd: worktreePath });
      report.remoteBranchPushed = true;
      const bodyPath = join(worktreePath, 'pr-body.txt');
      writeFileSync(bodyPath, `${buildPullRequestBody({ comparison, mainSha, localSha })}\n`, 'utf8');
      const pr = run('gh', [
        'pr', 'create',
        '--repo', EXPECTED_REPOSITORY,
        '--base', 'main',
        '--head', branch,
        '--title', `Añadir ${comparison.counts.new} artículos nuevos a resumenes.json`,
        '--body-file', bodyPath,
      ], { cwd: worktreePath });

      report.status = 'pull_request_created';
      report.pullRequestUrl = String(pr.stdout).trim().split(/\r?\n/).find((line) => /^https:\/\/github\.com\//.test(line)) ?? null;
      report.completedAt = new Date().toISOString();
      report.reportPath = writeReport(reportDirectory, report);
      return { exitCode: 0, report };
    } finally {
      cleanTemporaryWorktree(repoRoot, temporaryRoot, worktreePath, worktreeAdded);
    }
  } catch (error) {
    report.status = 'blocked';
    report.errors = [...(report.errors ?? []), {
      code: error.code || 'AUTOMATION_ERROR',
      message: error instanceof AutomationError ? error.message : 'La automatización terminó con un error no esperado.',
    }];
    report.reportPath = writeReport(reportDirectory, report);
    return { exitCode: error instanceof AutomationError ? 2 : 1, report };
  } finally {
    releaseLock();
  }
}

function safeConsoleSummary(report) {
  return {
    status: report.status,
    mainCommit: report.mainCommit ?? null,
    mainSha256: report.mainSha256 ?? null,
    localSha256: report.localSha256 ?? null,
    newArticles: report.counts?.new ?? 0,
    branch: report.branch ?? null,
    pullRequestUrl: report.pullRequestUrl ?? null,
    errorCodes: (report.errors ?? []).map((error) => error.code),
    reportPath: report.reportPath ?? null,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = runAutomation();
  process.stdout.write(`${JSON.stringify(safeConsoleSummary(result.report))}\n`);
  process.exitCode = result.exitCode;
}
