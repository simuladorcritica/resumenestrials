// Mapa de evidencia (/mapa/) y su miniatura en la portada: un punto por resumen.
// Misma regla que site_templates.map_rows(), escrita aparte para que validadores y suites comprueben las
// páginas contra los datos y no contra su propio HTML:
//   · Columnas: «2000–09» para todo artículo anterior a 2010 y después una por año hasta el último con datos.
//   · Filas por tema: los ensayos de Medicina Crítica van al subtema de seo-cluster-manifest.json que los
//     contiene (si son varios, el de menos ensayos; si ninguno, «Otros temas»); los de Medicina Interna, a su
//     subespecialidad inferida (specialty-classification.js, la etiqueta del archivo). Las subespecialidades
//     con menos de cinco ensayos, o sin subespecialidad, comparten «Otras subespecialidades».
//   · Orden: Medicina Crítica primero y, en cada área, de más a menos ensayos (empate: nombre).
//   · Filas por revista: las cinco revistas con fila propia y «Otras revistas», de más a menos ensayos.
import { loadClassifier } from './build-data-index.mjs';

const CRITICAL = 'Medicina Crítica';
const INTERNAL = 'Medicina Interna';
const INTERNAL_SPECIALTIES = ['Cardiología', 'Cirugía', 'Endocrinología', 'Enfermedades Infecciosas', 'Gastroenterología', 'Geriatría', 'Hematología', 'Infectología', 'Medicina de Urgencias', 'Medicina Física y Rehabilitación', 'Nefrología', 'Neumología', 'Neurología', 'Oncología', 'Oftalmología', 'Reumatología', 'VIH'];
const TONES = { 'Cardiología': 'cardio', 'Endocrinología': 'endo', 'Neurología': 'neuro', 'Nefrología': 'nefro', 'Neumología': 'neumo', 'Infectología': 'infecto', 'Enfermedades Infecciosas': 'infecto', VIH: 'infecto', 'Gastroenterología': 'gastro', 'Oncología': 'onco', 'Hematología': 'onco' };
const MIN_ROW = 5;

export const JOURNALS = ['NEJM', 'JAMA', 'Critical Care', 'Intensive Care Med', 'Lancet', 'Otras revistas'];
export const trialCount = (n) => (n === 1 ? '1 ensayo' : `${n} ensayos`);

const plain = (value) => String(value ?? '').replace(/<[^>]*>/g, '').trim();
const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Área única de cada resumen (la de su etiqueta en tarjetas y portada).
export function areaOf(record) {
  const primary = plain(record.especialidad_principal), secondary = plain(record.especialidad_secundaria);
  if (primary === CRITICAL || primary === INTERNAL) return primary;
  if (INTERNAL_SPECIALTIES.includes(primary)) return INTERNAL;
  if (secondary === CRITICAL || secondary === INTERNAL) return secondary;
  return primary || 'Evidencia clínica';
}

export function evidenceMap(data, clusters, classifier = loadClassifier()) {
  const lastYear = Math.max(2009, ...data.map((record) => Number(record.anio)));
  const bins = ['2000–09'];
  for (let year = 2010; year <= lastYear; year += 1) bins.push(String(year));
  const subspecialty = (record) => {
    const result = classifier.classify(record);
    return result?.specialty === classifier.REVIEW ? '' : result?.specialty || '';
  };
  const topics = Object.entries(clusters).filter(([, cluster]) => cluster.category === CRITICAL)
    .map(([slug, cluster], order) => ({ slug, name: cluster.name, order, ids: new Set(cluster.trial_ids.map(String)) }));
  const records = data.map((record) => {
    const critical = areaOf(record) === CRITICAL;
    return { id: String(record.id), record, critical, sub: critical ? '' : subspecialty(record) };
  });
  const perSub = new Map();
  for (const item of records) if (!item.critical) perSub.set(item.sub, (perSub.get(item.sub) || 0) + 1);

  const rows = new Map(), trials = new Map();
  for (const item of records) {
    let key, name;
    if (item.critical) {
      const topic = topics.filter((entry) => entry.ids.has(item.id)).sort((a, b) => a.ids.size - b.ids.size || a.order - b.order)[0];
      [key, name] = topic ? [`c:${topic.slug}`, topic.name] : ['c:otros', 'Otros temas'];
    } else {
      [key, name] = item.sub && perSub.get(item.sub) >= MIN_ROW ? [`i:${item.sub}`, item.sub] : ['i:otras', 'Otras subespecialidades'];
    }
    if (!rows.has(key)) rows.set(key, { key, name, area: item.critical ? CRITICAL : INTERNAL, ids: [] });
    rows.get(key).ids.push(item.id);
    const journal = JOURNALS.indexOf(item.record.revista);
    trials.set(item.id, {
      id: item.id,
      row: key,
      bin: Math.max(0, Number(item.record.anio) - 2009),
      area: item.critical ? CRITICAL : INTERNAL,
      tone: item.critical ? 'critica' : item.sub ? TONES[item.sub] || 'otra' : 'interna',
      journal: journal < 0 || journal === JOURNALS.length - 1 ? JOURNALS.length - 1 : journal,
    });
  }
  const other = (row) => (row.key === 'c:otros' || row.key === 'i:otras' ? 1 : 0);
  const ordered = [...rows.values()].sort((a, b) => (a.area === CRITICAL ? 0 : 1) - (b.area === CRITICAL ? 0 : 1)
    || other(a) - other(b) || b.ids.length - a.ids.length || (fold(a.name) < fold(b.name) ? -1 : fold(a.name) > fold(b.name) ? 1 : 0));
  return { bins, rows: ordered, trials };
}

// Filas «Por revista» para un conjunto de ensayos del modelo (todas las áreas o una sola).
export function journalRows(trials) {
  const rows = new Map();
  for (const trial of trials) {
    const key = `j:${trial.journal}`;
    if (!rows.has(key)) rows.set(key, { key, name: JOURNALS[trial.journal], ids: [] });
    rows.get(key).ids.push(trial.id);
  }
  const last = `j:${JOURNALS.length - 1}`;
  return [...rows.values()].sort((a, b) => (a.key === last) - (b.key === last) || b.ids.length - a.ids.length || a.key.localeCompare(b.key));
}
