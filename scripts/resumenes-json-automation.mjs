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
import { compareResumenesJson, sha256 } from './resumenes-json-guard.mjs';

const EXPECTED_REPOSITORY = 'simuladorcritica/resumenestrials';
const TARGET_FILE = 'resumenes.json';
const BRANCH_PREFIX = 'auto/resumenes-json-';

class AutomationError extends Error {
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

function ensureExactTarget(repoRoot, targetPath) {
  const expected = resolve(repoRoot, TARGET_FILE);
  const actual = resolve(targetPath);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new AutomationError('UNEXPECTED_TARGET', `La automatización solo admite ${expected}.`);
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
  const identifiers = comparison.newArticles.map((article) => (
    `- ID ${article.id ?? '(sin ID)'} · DOI ${article.doi ?? '(sin DOI)'} · ${article.title ?? '(sin título)'}`
  ));
  return [
    '## Automatización local de resumenes.json',
    '',
    `- Base main: \`${mainSha}\``,
    `- SHA-256 local: \`${localSha}\``,
    `- Artículos nuevos: ${comparison.counts.new}`,
    '- Archivos modificados por la automatización: `resumenes.json` exclusivamente.',
    '- Merge automático: desactivado.',
    '',
    '### Identificadores detectados',
    '',
    ...identifiers,
    '',
    'Los workflows existentes deben validar este PR antes de cualquier revisión humana o fusión.',
  ].join('\n');
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
  const stateRoot = resolve(args.stateDir ?? defaultStateRoot());
  const reportDirectory = resolve(args.reportDir ?? join(stateRoot, 'reports'));
  ensureExactTarget(repoRoot, targetPath);

  const releaseLock = acquireLock(stateRoot, repoRoot);
  let report = {
    version: 1,
    status: 'blocked',
    repository: EXPECTED_REPOSITORY,
    target: TARGET_FILE,
    startedAt: new Date().toISOString(),
  };

  try {
    const remoteUrl = git(['remote', 'get-url', 'origin'], { cwd: repoRoot }).stdout.trim();
    if (!isExpectedOrigin(remoteUrl)) {
      throw new AutomationError('UNEXPECTED_ORIGIN', `origin no corresponde a ${EXPECTED_REPOSITORY}.`);
    }
    assertOnlyResumenesChanges(changedPaths(repoRoot));

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
    if (args.dryRun) {
      report.status = 'dry_run_new_articles';
      report.reportPath = writeReport(reportDirectory, report);
      return { exitCode: 0, report };
    }

    assertGitHubCli(repoRoot);
    assertGitIdentity(repoRoot);
    if (sha256(readFileSync(targetPath)) !== localSha) {
      throw new AutomationError('LOCAL_FILE_CHANGED_DURING_RUN', `${TARGET_FILE} cambió durante la validación.`);
    }

    const branch = buildBranchName(new Date(), localSha);
    report.branch = branch;
    report.remoteBranchPushed = false;
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'resumenestrials-json-'));
    const worktreePath = join(temporaryRoot, 'worktree');
    let worktreeAdded = false;
    try {
      git(['worktree', 'add', '--detach', worktreePath, 'origin/main'], { cwd: repoRoot });
      worktreeAdded = true;
      git(['switch', '-c', branch], { cwd: worktreePath });
      copyFileSync(targetPath, join(worktreePath, TARGET_FILE));

      const validation = run(process.execPath, ['scripts/validate-data.mjs'], { cwd: worktreePath, allowFailure: true, quiet: true });
      if (validation.status !== 0) {
        throw new AutomationError('LOCAL_VALIDATION_FAILED', 'La validación de resumenes.json falló antes de crear el commit.');
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
