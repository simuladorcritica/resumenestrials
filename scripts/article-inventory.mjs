const BASE_URL = 'https://resumenestrials.com';

export const REQUIRED_FIELDS = Object.freeze([
  'id', 'titulo', 'autor', 'revista', 'anio', 'fecha', 'registro', 'doi',
  'financiacion', 'original', 'especialidad_principal', 'especialidad_secundaria',
  'temas', 'tipo_estudio', 'objetivo', 'hallazgo', 'cuerpo', 'corto',
]);

const STOPWORDS = new Set([
  'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante',
  'e', 'el', 'en', 'entre', 'frente', 'hacia', 'hasta', 'la', 'las', 'los', 'o',
  'para', 'por', 'que', 'se', 'sin', 'sobre', 'un', 'una', 'y',
]);

export function plainText(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(value, limit = 92) {
  let base = plainText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (base.length <= limit) return base;
  base = base.slice(0, limit + 1);
  if (base.includes('-')) base = base.slice(0, base.lastIndexOf('-'));
  return base.replace(/^-|-$/g, '');
}

export function slugForRecord(record) {
  const manual = slugify(record?.slug, 110);
  if (manual) return manual;
  const id = String(record?.id ?? '').trim();
  const title = plainText(record?.titulo);
  if (!title) return `trial-${id || 'sin-id'}`;
  let base;
  if (title.includes(':')) {
    const separator = title.indexOf(':');
    const acronym = slugify(title.slice(0, separator), 28);
    const tokens = slugify(title.slice(separator + 1), 160).replaceAll('-', ' ').split(/\s+/).filter(Boolean);
    const tail = tokens.filter((token) => !STOPWORDS.has(token)).slice(0, 9).join('-') || slugify(title.slice(separator + 1), 72);
    base = [acronym, tail].filter(Boolean).join('-');
  } else {
    base = slugify(title, 88);
  }
  return slugify(base, 96) || `trial-${id || 'sin-id'}`;
}

export function normalizeDoi(value) {
  return plainText(value).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '');
}

export function normalizeTitle(value) {
  return plainText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeOriginal(value) {
  return plainText(value).toLowerCase().replace(/\/$/, '');
}

function duplicates(records, keyOf) {
  const groups = new Map();
  for (const record of records) {
    const key = keyOf(record);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), String(record?.id ?? '')]);
  }
  return [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([value, ids]) => ({ value, ids }));
}

export function auditArticleData(data) {
  const records = Array.isArray(data) ? data : [];
  const missingFields = [];
  const emptyByField = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, 0]));
  const invalidIds = [];
  const invalidDates = [];
  const nonIsoBibliographicDates = [];
  const nonUrlOriginals = [];

  records.forEach((record, index) => {
    const label = String(record?.id ?? `row-${index + 1}`);
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      invalidIds.push(label);
      return;
    }
    for (const field of REQUIRED_FIELDS) {
      if (!Object.hasOwn(record, field)) {
        missingFields.push({ id: label, field });
        continue;
      }
      const value = record[field];
      if (value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && value.length === 0)) {
        emptyByField[field] += 1;
      }
    }
    if (!Number.isInteger(Number(record.id)) || Number(record.id) < 1) invalidIds.push(label);
    const date = String(record.fecha ?? '').trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      if (/\b(?:19|20)\d{2}\b/.test(date)) nonIsoBibliographicDates.push(label);
      else invalidDates.push(label);
    }
    const original = String(record.original ?? '').trim();
    if (original && !/^https:\/\/[^\s]+$/i.test(original)) nonUrlOriginals.push(label);
  });

  const duplicateIds = duplicates(records, (record) => String(record?.id ?? '').trim());
  const duplicateDois = duplicates(records, (record) => normalizeDoi(record?.doi));
  const duplicateOriginals = duplicates(records, (record) => normalizeOriginal(record?.original));
  const duplicateTitles = duplicates(records, (record) => normalizeTitle(record?.titulo));
  const duplicateSlugs = duplicates(records, slugForRecord);
  const errors = [];
  if (!Array.isArray(data)) errors.push('resumenes.json debe contener un arreglo');
  if (missingFields.length) errors.push(`campos ausentes: ${missingFields.length}`);
  if (invalidIds.length) errors.push(`IDs inválidos: ${invalidIds.join(',')}`);
  if (duplicateIds.length) errors.push('IDs duplicados');
  if (duplicateDois.length) errors.push('DOI duplicados');
  if (duplicateOriginals.length) errors.push('originales duplicados');
  if (duplicateTitles.length) errors.push('títulos duplicados');
  if (duplicateSlugs.length) errors.push('slugs duplicados');
  if (invalidDates.length) errors.push(`fechas bibliográficas irreconocibles: ${invalidDates.join(',')}`);

  return {
    records,
    errors,
    missingFields,
    emptyByField,
    emptyValues: Object.values(emptyByField).reduce((sum, count) => sum + count, 0),
    invalidIds,
    invalidDates,
    nonIsoBibliographicDates,
    nonUrlOriginals,
    duplicateIds,
    duplicateDois,
    duplicateOriginals,
    duplicateTitles,
    duplicateSlugs,
  };
}

export function expectedEntry(record) {
  const slug = slugForRecord(record);
  const path = `/trials/${slug}/`;
  return { id: String(record.id), slug, path, url: `${BASE_URL}${path}` };
}

export function compareCoverage(data, manifest, sitemapTrialUrls, pageSlugs) {
  const expected = data.map(expectedEntry);
  const expectedIds = new Set(expected.map((entry) => entry.id));
  const expectedUrls = new Set(expected.map((entry) => entry.url));
  const expectedSlugs = new Set(expected.map((entry) => entry.slug));
  const manifestEntries = Object.entries(manifest || {});
  const sitemapUrls = [...sitemapTrialUrls];
  const pages = new Set(pageSlugs);
  const missingManifest = expected.filter((entry) => !manifest?.[entry.id]).map((entry) => entry.id);
  const mismatchedManifest = expected.filter((entry) => {
    const actual = manifest?.[entry.id];
    return actual && (actual.slug !== entry.slug || actual.path !== entry.path || actual.url !== entry.url);
  }).map((entry) => entry.id);
  const missingSitemap = expected.filter((entry) => !sitemapUrls.includes(entry.url)).map((entry) => entry.id);
  const missingPages = expected.filter((entry) => !pages.has(entry.slug)).map((entry) => entry.id);
  const extraManifest = manifestEntries.filter(([id]) => !expectedIds.has(id)).map(([id]) => id);
  const extraSitemap = sitemapUrls.filter((url) => !expectedUrls.has(url));
  const extraPages = [...pages].filter((slug) => !expectedSlugs.has(slug));
  const manifestCanonicals = manifestEntries.map(([, entry]) => entry?.url).filter(Boolean);
  const duplicateSitemap = sitemapUrls.length - new Set(sitemapUrls).size;
  const duplicateCanonicals = manifestCanonicals.length - new Set(manifestCanonicals).size;
  const ok = [missingManifest, mismatchedManifest, missingSitemap, missingPages, extraManifest, extraSitemap, extraPages]
    .every((values) => values.length === 0) && duplicateSitemap === 0 && duplicateCanonicals === 0;
  return {
    ok,
    counts: { json: expected.length, manifest: manifestEntries.length, sitemap: sitemapUrls.length, pages: pages.size },
    missingManifest, mismatchedManifest, missingSitemap, missingPages,
    extraManifest, extraSitemap, extraPages, duplicateSitemap, duplicateCanonicals,
  };
}
