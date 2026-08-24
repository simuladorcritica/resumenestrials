import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function asText(value) {
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
}

export function sha256(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(asText(value), 'utf8')).digest('hex');
}

export function normalizeId(value) {
  return value == null ? '' : String(value).normalize('NFKC').trim();
}

export function normalizeDoi(value) {
  if (value == null) return '';
  let normalized = String(value).normalize('NFKC').trim().toLowerCase();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Un DOI con escapes inválidos sigue siendo comparable como texto literal.
  }
  return normalized
    .replace(/^urn:doi:\s*/i, '')
    .replace(/^doi\s*:\s*/i, '')
    .replace(/^https?:\/\/(?:www\.)?(?:dx\.)?doi\.org\//i, '')
    .replace(/\s+/g, '');
}

export function normalizeTitle(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLowerCase()
    .replace(/&(?:amp|y);/g, ' y ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function semanticFingerprint(value) {
  return JSON.stringify(canonicalize(value));
}

function parseDocument(source, label) {
  const text = asText(source).replace(/^\uFEFF/, '');
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const wrapped = new Error(`${label} no contiene JSON válido: ${error.message}`);
    wrapped.code = `${label.toUpperCase()}_JSON_INVALID`;
    throw wrapped;
  }
  if (!Array.isArray(value)) {
    const error = new Error(`${label} debe contener un arreglo JSON en la raíz.`);
    error.code = `${label.toUpperCase()}_ROOT_NOT_ARRAY`;
    throw error;
  }
  return value;
}

function duplicateValues(items, normalizer, field) {
  const seen = new Map();
  const duplicates = [];
  for (let index = 0; index < items.length; index += 1) {
    const normalized = normalizer(items[index]?.[field]);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicates.push({ value: normalized, firstIndex: seen.get(normalized), duplicateIndex: index });
    } else {
      seen.set(normalized, index);
    }
  }
  return duplicates;
}

function makeIndex(items, normalizer, field) {
  const index = new Map();
  for (let position = 0; position < items.length; position += 1) {
    const key = normalizer(items[position]?.[field]);
    if (!key) continue;
    const positions = index.get(key) ?? [];
    positions.push(position);
    index.set(key, positions);
  }
  return index;
}

function changedFields(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys]
    .filter((key) => semanticFingerprint(before?.[key]) !== semanticFingerprint(after?.[key]))
    .sort((left, right) => left.localeCompare(right));
}

function publicIdentity(article) {
  return {
    id: normalizeId(article?.id) || null,
    doi: normalizeDoi(article?.doi) || null,
    title: String(article?.titulo ?? '').trim() || null,
  };
}

function errorRecord(code, message, details = {}) {
  return { code, message, ...details };
}

export function compareResumenesJson(mainSource, localSource) {
  const report = {
    version: 1,
    status: 'blocked',
    mainSha256: sha256(mainSource),
    localSha256: sha256(localSource),
    counts: { main: null, local: null, new: 0 },
    newArticles: [],
    errors: [],
  };

  let mainItems;
  let localItems;
  try {
    mainItems = parseDocument(mainSource, 'main');
    report.counts.main = mainItems.length;
  } catch (error) {
    report.errors.push(errorRecord(error.code || 'MAIN_JSON_INVALID', error.message));
  }
  try {
    localItems = parseDocument(localSource, 'local');
    report.counts.local = localItems.length;
  } catch (error) {
    report.errors.push(errorRecord(error.code || 'LOCAL_JSON_INVALID', error.message));
  }
  if (!mainItems || !localItems) return report;

  for (const [scope, items] of [['MAIN', mainItems], ['LOCAL', localItems]]) {
    for (const duplicate of duplicateValues(items, normalizeId, 'id')) {
      report.errors.push(errorRecord(
        `${scope}_DUPLICATE_ID`,
        `${scope.toLowerCase()} contiene el ID duplicado ${duplicate.value}.`,
        duplicate,
      ));
    }
    for (const duplicate of duplicateValues(items, normalizeDoi, 'doi')) {
      report.errors.push(errorRecord(
        `${scope}_DUPLICATE_DOI`,
        `${scope.toLowerCase()} contiene un DOI duplicado después de normalizarlo.`,
        duplicate,
      ));
    }
  }

  const localIndexes = {
    id: makeIndex(localItems, normalizeId, 'id'),
    doi: makeIndex(localItems, normalizeDoi, 'doi'),
    title: makeIndex(localItems, normalizeTitle, 'titulo'),
  };
  const matchedLocal = new Map();

  for (let mainIndex = 0; mainIndex < mainItems.length; mainIndex += 1) {
    const mainItem = mainItems[mainIndex];
    const identity = publicIdentity(mainItem);
    const candidates = [
      ['id', normalizeId(mainItem?.id)],
      ['doi', normalizeDoi(mainItem?.doi)],
      ['title', normalizeTitle(mainItem?.titulo)],
    ];
    let match = null;

    for (const [kind, key] of candidates) {
      if (!key) continue;
      const positions = localIndexes[kind].get(key) ?? [];
      if (positions.length > 1 && kind === 'title') {
        report.errors.push(errorRecord(
          'AMBIGUOUS_TITLE_MATCH',
          `No es posible identificar de forma inequívoca el artículo main con ID ${identity.id ?? '(sin ID)'} mediante el título normalizado.`,
          { mainIndex, identity, candidateIndexes: positions },
        ));
        match = { ambiguous: true };
        break;
      }
      if (positions.length === 1) {
        match = { kind, localIndex: positions[0] };
        break;
      }
    }

    if (!match) {
      report.errors.push(errorRecord(
        'EXISTING_ARTICLE_REMOVED',
        `Falta un artículo que existe en main (ID ${identity.id ?? '(sin ID)'}).`,
        { mainIndex, identity },
      ));
      continue;
    }
    if (match.ambiguous) continue;

    if (matchedLocal.has(match.localIndex)) {
      report.errors.push(errorRecord(
        'IDENTITY_COLLISION',
        'Un mismo artículo local coincide con más de un artículo de main.',
        { mainIndex, localIndex: match.localIndex, previousMainIndex: matchedLocal.get(match.localIndex) },
      ));
      continue;
    }
    matchedLocal.set(match.localIndex, mainIndex);

    const localItem = localItems[match.localIndex];
    if (semanticFingerprint(mainItem) !== semanticFingerprint(localItem)) {
      report.errors.push(errorRecord(
        'EXISTING_ARTICLE_MODIFIED',
        `El artículo existente con ID ${identity.id ?? '(sin ID)'} cambió de forma semántica.`,
        {
          mainIndex,
          localIndex: match.localIndex,
          matchedBy: match.kind,
          identity,
          changedFields: changedFields(mainItem, localItem),
        },
      ));
    }
  }

  report.newArticles = localItems
    .map((article, index) => ({ article, index }))
    .filter(({ index }) => !matchedLocal.has(index))
    .map(({ article, index }) => ({ index, ...publicIdentity(article) }));
  report.counts.new = report.newArticles.length;

  if (report.errors.length > 0) {
    report.status = 'blocked';
  } else if (report.newArticles.length > 0) {
    report.status = 'new_articles';
  } else {
    report.status = 'no_changes';
  }
  return report;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) throw new Error(`Argumento no reconocido: ${value}`);
    const name = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Falta el valor de --${name}.`);
    args[name] = next;
    index += 1;
  }
  if (!args.main || !args.local) throw new Error('Uso: node scripts/resumenes-json-guard.mjs --main <archivo> --local <archivo> [--report <archivo>]');
  return args;
}

export function runGuardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = compareResumenesJson(readFileSync(args.main), readFileSync(args.local));
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.report) writeFileSync(args.report, output, { encoding: 'utf8', flag: 'w' });
  process.stdout.write(output);
  return report.status === 'blocked' ? 2 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = runGuardCli();
  } catch (error) {
    process.stderr.write(`ERROR ${error.message}\n`);
    process.exitCode = 1;
  }
}
