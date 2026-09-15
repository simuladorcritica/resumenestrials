import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const DEFAULT_MANIFEST_PATH = 'clinical-correction-authorizations.json';
const SHA_RE = /^[0-9a-f]{40}$/i;
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function resolveCommit(ref) {
  try {
    return execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'rev-parse', `${ref}^{commit}`],
      { encoding: 'utf8' },
    ).trim().toLowerCase();
  } catch (error) {
    throw new Error(`No se pudo resolver el commit base clínico ${ref}: ${error.message}`);
  }
}

export function loadClinicalCorrectionAuthorizations({
  baseRef = process.env.CLINICAL_BASE_REF || 'origin/main',
  manifestPath = process.env.CLINICAL_CORRECTION_MANIFEST || DEFAULT_MANIFEST_PATH,
} = {}) {
  const resolvedBaseSha = resolveCommit(baseRef);

  if (!existsSync(manifestPath)) {
    return {
      manifestPath: null,
      baseSha: resolvedBaseSha,
      byId: new Map(),
      pairs: new Set(),
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Manifest de correcciones clínicas inválido (${manifestPath}): ${error.message}`);
  }

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('El manifest de correcciones clínicas debe ser un objeto JSON.');
  }
  if (manifest.schema_version !== 1) {
    throw new Error('schema_version del manifest de correcciones clínicas debe ser 1.');
  }

  const declaredBaseSha = String(manifest.base_sha || '').trim().toLowerCase();
  if (!SHA_RE.test(declaredBaseSha)) {
    throw new Error('base_sha del manifest debe ser un SHA-1 completo de 40 caracteres.');
  }
  if (declaredBaseSha !== resolvedBaseSha) {
    throw new Error(
      `El manifest está ligado a ${declaredBaseSha}, pero el PR compara contra ${resolvedBaseSha}. ` +
      'Una autorización clínica no puede reutilizarse sobre otro baseline.',
    );
  }

  if (!Array.isArray(manifest.authorizations) || manifest.authorizations.length === 0) {
    throw new Error('authorizations debe contener al menos una autorización explícita.');
  }

  const byId = new Map();
  const pairs = new Set();

  for (const [index, entry] of manifest.authorizations.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Autorización #${index + 1} inválida.`);
    }

    const id = String(entry.id ?? '').trim();
    if (!/^\d+$/.test(id)) {
      throw new Error(`Autorización #${index + 1}: id debe ser numérico y explícito.`);
    }
    if (byId.has(id)) {
      throw new Error(`El ID ${id} aparece más de una vez en el manifest.`);
    }

    if (!Array.isArray(entry.fields) || entry.fields.length === 0) {
      throw new Error(`Autorización del ID ${id}: fields debe ser una lista no vacía.`);
    }

    const reason = String(entry.reason || '').trim();
    if (!reason) {
      throw new Error(`Autorización del ID ${id}: reason es obligatorio para trazabilidad.`);
    }

    const fields = new Set();
    for (const rawField of entry.fields) {
      const field = String(rawField || '').trim();
      if (!FIELD_RE.test(field) || field === 'id' || field === '*') {
        throw new Error(`Autorización del ID ${id}: campo inválido o no permitido: ${field || '(vacío)'}.`);
      }
      if (fields.has(field)) {
        throw new Error(`Autorización del ID ${id}: campo duplicado ${field}.`);
      }
      fields.add(field);
      pairs.add(`${id}:${field}`);
    }

    byId.set(id, { fields, reason });
  }

  return {
    manifestPath,
    baseSha: resolvedBaseSha,
    byId,
    pairs,
  };
}

export function isClinicalFieldAuthorized(authorizations, id, field) {
  const entry = authorizations.byId.get(String(id));
  return Boolean(entry?.fields?.has(String(field)));
}
