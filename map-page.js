// Mapa de evidencia (/mapa/). La vista por tema llega completa en el HTML (site_templates.evidence_map):
// un <i> por ensayo dentro de la casilla (fila × año) que lo contiene. Este módulo lee de ahí el modelo y
// añade lo interactivo: filtrar por especialidad, reagrupar por revista, resaltar y abrir el panel de una casilla.
// Los títulos y hallazgos salen del índice ligero (datos/indice.json), que solo se pide al usarlo; las rutas
// de los ensayos van incrustadas en la página para no descargar seo-manifest.json.
function init() {
  const E = window.EV, root = document.querySelector('[data-ev-map]');
  if (!E || !root) return;
  const body = root.querySelector('tbody'), legend = root.querySelector('.ev-map-legend'), panel = root.querySelector('#ev-map-panel'), field = root.querySelector('#ev-map-hl'), status = root.querySelector('#ev-map-status');
  const years = [...root.querySelectorAll('thead th')].map(th => th.textContent);
  const journals = JSON.parse(root.dataset.evJournals), paths = JSON.parse(root.querySelector('#ev-map-paths').textContent);
  const AREA = { c: 'Medicina Crítica', i: 'Medicina Interna' };
  const themes = new Map([...body.rows].map(tr => [tr.dataset.evRow, tr.cells[0].firstChild.data]));
  const dots = [...body.querySelectorAll('i[data-id]')].map(n => ({ id: n.dataset.id, sub: n.dataset.sub, j: n.dataset.j, bin: n.closest('td').cellIndex - 1, theme: n.closest('tr').dataset.evRow, area: n.dataset.sub === 'critica' ? 'c' : 'i' }));
  const S = { area: '', rows: 'tema', q: '', cell: '' };
  const count = n => n + (n === 1 ? ' ensayo' : ' ensayos');
  const rowOf = d => S.rows === 'revista' ? 'j:' + d.j : d.theme;
  const lastJournal = 'j:' + (journals.length - 1); // «Otras revistas» va siempre al final
  const nameOf = key => key[0] === 'j' ? journals[key.slice(2)] : themes.get(key);
  const shown = () => dots.filter(d => !S.area || d.area === S.area);
  let text;

  // Misma estructura que el HTML generado: con «Todas» y «Por tema» el resultado es idéntico al inicial.
  function draw() {
    const groups = new Map();
    for (const d of shown()) { const key = rowOf(d); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(d); }
    const keys = S.rows === 'revista' ? [...groups.keys()].sort((a, b) => (a === lastJournal) - (b === lastJournal) || groups.get(b).length - groups.get(a).length || a.localeCompare(b)) : [...themes.keys()].filter(key => groups.has(key));
    body.innerHTML = keys.map(key => {
      const all = groups.get(key), name = E.esc(nameOf(key));
      return '<tr data-ev-row="' + E.esc(key) + '"><th scope="row">' + name + '<small>' + (key[0] === 'j' ? '' : AREA[key[0]] + ' · ') + count(all.length) + '</small></th>' + years.map((year, bin) => {
        const cell = all.filter(d => d.bin === bin);
        return cell.length ? '<td><button type="button" class="ev-map-cell" aria-pressed="' + (S.cell === key + '|' + bin) + '" aria-label="' + name + ', ' + year + ': ' + count(cell.length) + '">' + cell.map(d => '<i data-id="' + d.id + '" data-sub="' + d.sub + '" data-j="' + d.j + '"></i>').join('') + '</button></td>' : '<td></td>';
      }).join('') + '</tr>';
    }).join('');
    // La leyenda nombra solo los colores que quedan a la vista.
    const tones = new Set(shown().map(d => d.sub));
    for (const item of legend.children) item.hidden = !tones.has(item.firstElementChild.dataset.sub);
  }

  // Resaltar: atenúa los puntos cuyo título, temas u objetivo no contienen todas las palabras escritas.
  async function highlight() {
    if (S.q.trim() && !text) { try { text = new Map((await E.data()).map(r => [String(r.id), E.norm([r.titulo, (r.temas || []).join(' '), r.objetivo].join(' '))])); } catch { status.textContent = 'No se pudo cargar el índice para resaltar. Inténtalo de nuevo.'; return; } }
    const words = E.norm(S.q).split(/\s+/).filter(Boolean);let hits = 0;
    for (const n of body.querySelectorAll('i')) { const hit = words.every(w => text.get(n.dataset.id)?.includes(w)); n.toggleAttribute('data-dim', !hit); if (hit) hits++; }
    status.textContent = !words.length ? '' : hits ? count(hits) + (hits === 1 ? ' resaltado' : ' resaltados') : 'Ningún ensayo coincide.';
  }

  const pressed = () => { for (const b of body.querySelectorAll('.ev-map-cell')) b.setAttribute('aria-pressed', String(S.cell === b.closest('tr').dataset.evRow + '|' + (b.closest('td').cellIndex - 1))); };
  const button = () => body.querySelector('.ev-map-cell[aria-pressed=true]');
  function save() {
    const p = new URLSearchParams();
    if (S.area) p.set('esp', S.area === 'c' ? 'critica' : 'interna');
    if (S.rows !== 'tema') p.set('filas', S.rows);
    if (S.q.trim()) p.set('resaltar', S.q.trim());
    if (S.cell) p.set('celda', S.cell);
    const query = p.toString();
    history.replaceState(history.state, '', location.pathname + (query ? '?' + query : ''));
  }
  function close(focus) { const b = button(); S.cell = ''; panel.hidden = true; panel.innerHTML = ''; pressed(); save(); if (focus) b?.focus(); }

  // Panel: los ensayos de la casilla, del artículo más reciente al más antiguo; si se pulsó un punto, ese ensayo va primero.
  async function open(key, bin, first, user) {
    const cell = shown().filter(d => rowOf(d) === key && d.bin === bin);
    if (!cell.length) { close(); return; }
    S.cell = key + '|' + bin; pressed(); save();
    const head = '<div class="ev-archive-head"><h2 tabindex="-1">' + E.esc(nameOf(key)) + ', ' + years[bin] + '</h2><p class="ev-count">' + count(cell.length) + '</p><button type="button" class="ev-btn" data-ev-map-close>Cerrar</button></div>';
    panel.hidden = false; panel.innerHTML = head + '<p class="ev-status">Cargando…</p>';
    const reveal = () => { panel.scrollIntoView({ block: 'start' }); if (user) panel.querySelector('h2').focus({ preventScroll: true }); };
    if (user) reveal();
    try {
      const ids = new Set(cell.map(d => d.id)), rows = (await E.data()).filter(r => ids.has(String(r.id)));
      if (S.cell !== key + '|' + bin) return;
      rows.sort((a, b) => (String(b.id) === first) - (String(a.id) === first) || String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id);
      panel.innerHTML = head + '<ul class="ev-list">' + rows.map(r => '<li class="ev-card" data-id="' + r.id + '"><a class="ev-card-title" href="' + E.esc(paths[r.id]) + '" data-ev-read="' + r.id + '"><h2>' + E.esc(r.titulo) + '</h2></a><p class="ev-card-meta"><span>' + E.esc(r.revista) + '</span><span>' + E.esc(E.humanDate(r.fecha)) + '</span></p><p class="ev-intro">' + E.safe(r.hallazgo) + '</p></li>').join('') + '</ul>';
      reveal();
    } catch { if (S.cell === key + '|' + bin) panel.querySelector('.ev-status').textContent = 'No se pudieron cargar los ensayos. Inténtalo de nuevo.'; }
  }

  root.addEventListener('change', e => {
    if (e.target.name === 'ev-map-area') S.area = e.target.value; else if (e.target.name === 'ev-map-rows') S.rows = e.target.value; else return;
    S.cell = ''; panel.hidden = true; panel.innerHTML = ''; draw(); highlight(); save();
  });
  field.addEventListener('input', () => { S.q = field.value; highlight(); save(); });
  body.addEventListener('click', e => {
    const b = e.target.closest('.ev-map-cell'); if (!b) return;
    const key = b.closest('tr').dataset.evRow, bin = b.closest('td').cellIndex - 1, dot = e.target.closest('i')?.dataset.id;
    if (S.cell === key + '|' + bin && !dot) close(); else open(key, bin, dot, true);
  });
  panel.addEventListener('click', e => { if (e.target.closest('[data-ev-map-close]')) close(true); });

  // El estado vive en la URL: al volver desde un ensayo («Volver a la lista») el mapa reaparece como estaba.
  const p = new URLSearchParams(location.search), area = { critica: 'c', interna: 'i' }[p.get('esp')] || '', cell = /^(.+)\|(\d+)$/.exec(p.get('celda') || '');
  S.area = area; S.rows = p.get('filas') === 'revista' ? 'revista' : 'tema'; S.q = field.value = p.get('resaltar') || '';
  for (const n of root.querySelectorAll('input[type=radio]')) n.checked = n.value === (n.name === 'ev-map-area' ? S.area : S.rows);
  if (S.area || S.rows !== 'tema') draw();
  if (S.q) highlight();
  if (cell) open(cell[1], +cell[2]);
  root.dataset.ready = 'true';
}
if (window.EV) init(); else document.addEventListener('DOMContentLoaded', init, { once: true });
