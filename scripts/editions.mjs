// Ediciones semanales del sitio: una por semana ISO (lunes a domingo) según `fecha_publicacion_resumen`.
// Misma regla que site_templates.editions(): la edición actual es la última semana con datos y vive en la
// portada (/); cada edición anterior tiene página propia en /ediciones/<lunes>/. Dentro de una edición el
// primer ensayo (artículo más reciente; empate: id más alto) es el destacado.
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function isoDate(value) {
  const match = ISO.exec(String(value ?? '').trim());
  if (!match) return null;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return date.getUTCFullYear() === +match[1] && date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3] ? date : null;
}

export function editions(data) {
  const weeks = new Map();
  for (const item of data) {
    const date = isoDate(item.fecha_publicacion_resumen);
    if (!date) continue;
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const monday = date.toISOString().slice(0, 10);
    if (!weeks.has(monday)) weeks.set(monday, []);
    weeks.get(monday).push(item);
  }
  const article = (item) => (isoDate(item.fecha) ? String(item.fecha).trim() : '');
  return [...weeks.keys()].sort().map((monday, index, all) => ({
    monday,
    route: index === all.length - 1 ? '/' : `/ediciones/${monday}/`,
    file: index === all.length - 1 ? '_includes/index-source.html' : `ediciones/${monday}/index.html`,
    items: weeks.get(monday).slice().sort((a, b) => article(b).localeCompare(article(a)) || Number(b.id) - Number(a.id)),
  }));
}

export const pastEditions = (data) => editions(data).slice(0, -1);

// Muestra acotada para las suites de navegador: la anterior más reciente, la más antigua y la más larga.
export function editionSample(data) {
  const past = pastEditions(data);
  const largest = past.reduce((best, edition) => (!best || edition.items.length > best.items.length ? edition : best), null);
  return [...new Set([past.at(-1), past[0], largest].filter(Boolean))];
}
