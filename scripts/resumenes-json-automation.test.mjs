import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertOnlyResumenesChanges,
  buildBranchName,
  isExpectedOrigin,
} from './resumenes-json-automation.mjs';

const automationSource = readFileSync(new URL('./resumenes-json-automation.mjs', import.meta.url), 'utf8');
const watcherSource = readFileSync(new URL('./watch-resumenes-json.ps1', import.meta.url), 'utf8');
const installerSource = readFileSync(new URL('./install-resumenes-json-watcher.ps1', import.meta.url), 'utf8');

test('genera exclusivamente ramas auto/resumenes-json-*', () => {
  const branch = buildBranchName(new Date('2026-08-24T15:16:17.000Z'), 'abcdef0123456789');
  assert.equal(branch, 'auto/resumenes-json-20260824T151617Z-abcdef01');
});

test('acepta únicamente el origin esperado por HTTPS o SSH', () => {
  assert.equal(isExpectedOrigin('https://github.com/simuladorcritica/resumenestrials.git'), true);
  assert.equal(isExpectedOrigin('git@github.com:simuladorcritica/resumenestrials.git'), true);
  assert.equal(isExpectedOrigin('https://github.com/otra-cuenta/resumenestrials.git'), false);
});

test('bloquea cambios locales ajenos a resumenes.json', () => {
  assert.doesNotThrow(() => assertOnlyResumenesChanges([]));
  assert.doesNotThrow(() => assertOnlyResumenesChanges(['resumenes.json']));
  assert.throws(() => assertOnlyResumenesChanges(['resumenes.json', 'README.md']), /fuera de resumenes\.json/);
});

test('el publicador usa worktree aislado, valida staging y nunca fusiona', () => {
  assert.match(automationSource, /worktree', 'add'/);
  assert.match(automationSource, /diff', '--cached', '--name-only'/);
  assert.match(automationSource, /staged\.length !== 1/);
  assert.match(automationSource, /'push', '--set-upstream', 'origin', branch/);
  assert.match(automationSource, /'pr', 'create'/);
  assert.match(automationSource, /'--base', 'main'/);
  assert.doesNotMatch(automationSource, /'pr',\s*'merge'|git\(\['merge'|push[^\n]+origin[^\n]+main/);
});

test('el watcher filtra solo resumenes.json y estabiliza escrituras de OneDrive', () => {
  assert.match(watcherSource, /FileSystemWatcher\]\:\:new\([^\n]+, 'resumenes\.json'\)/);
  assert.match(watcherSource, /IncludeSubdirectories = \$false/);
  assert.match(watcherSource, /Get-FileSha256/);
  assert.match(watcherSource, /equalSamples -ge \$StableSamples/);
  assert.match(watcherSource, /DebounceSeconds/);
  assert.match(watcherSource, /System\.Threading\.Mutex/);
  assert.match(watcherSource, /LOCALAPPDATA/);
  assert.doesNotMatch(watcherSource, /NotifyFilter.*DirectoryName|IncludeSubdirectories = \$true/);
});

test('el instalador registra una tarea local al iniciar sesión y no la ejecuta durante la instalación', () => {
  assert.match(installerSource, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(installerSource, /RunLevel Limited/);
  assert.match(installerSource, /El primer arranque guarda una línea base y no crea ramas ni PR/);
  assert.doesNotMatch(installerSource, /Start-ScheduledTask/);
});
