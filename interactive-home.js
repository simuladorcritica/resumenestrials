import './client-monitor.js';
import { getLibraryState, toggleFavorite, markRead, touchLastVisit } from './library-store.js';
import { RT_WEB_VERSION } from './app-version.js';

const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let data = [];
let byId = new Map();
let state = { signedIn:false, favorites:[], read:[], preferences:{} };
let advanced = { year:'', journal:'', status:'all' };
let applying = false;

function injectStyle() {
  if (document.getElementById('rt-interactive-style')) return;
  const s = document.createElement('style');
  s.id = 'rt-interactive-style';
  s.textContent = `
    .rt-advanced{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0}
    .rt-advanced select{appearance:auto;font:400 11px 'IBM Plex Mono',monospace;letter-spacing:.04em;color:var(--tinta-2);background:transparent;border:1px solid var(--linea);border-radius:3px;padding:9px 12px;min-height:37px}
    .rt-advanced select:hover,.rt-advanced select:focus{border-color:var(--teal);outline:none;color:var(--teal-hondo);box-shadow:0 0 0 3px rgba(28,138,138,.08)}
    .rt-fav{margin-left:8px;display:inline-flex;align-items:center;gap:6px;font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--tinta-2);background:transparent;border:0;border-bottom:1px solid transparent;padding:5px 2px;cursor:pointer}
    .rt-fav:hover{color:var(--teal-hondo);border-bottom-color:var(--teal)}
    .rt-fav[data-on=true]{color:var(--teal-hondo)}
    .rt-unread-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ambar);margin-left:9px;vertical-align:middle}
    .rt-version{position:fixed;right:8px;bottom:6px;font:9px 'IBM Plex Mono',monospace;color:var(--tinta-2);opacity:.22;z-index:5;pointer-events:none}
    .rt-member-note{display:flex;align-items:center;justify-content:flex-end;gap:18px;margin:30px 0 -34px;font:10px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--tinta-2)}
    .rt-member-note a{color:var(--teal-hondo);text-decoration:none;border-bottom:1px solid rgba(15,95,95,.25)}
    .rt-member-note a:hover{border-color:var(--teal)}
    @media(max-width:1120px){.indice-cabecera{align-items:flex-start}.rt-advanced{order:2}.buscador{margin-left:auto}}
    @media(max-width:760px){.rt-advanced{width:100%;order:3}.rt-advanced select{flex:1;min-width:135px}.buscador{order:2;margin-left:0}.rt-member-note{justify-content:flex-start;margin:24px 0 -22px;flex-wrap:wrap}.rt-fav{margin-left:0;margin-top:5px}}
  `;
  document.head.appendChild(s);
}

async function loadData() {
  const r = await fetch('resumenes.json', { cache:'no-store' });
  if (!r.ok) throw new Error('No se pudo cargar resumenes.json');
  data = await r.json();
  byId = new Map(data.map((x) => [String(x.id), x]));
}

function articleId(row) {
  const a = row.querySelector('a.cabeza[href*="resumen.html?id="]');
  if (!a) return null;
  try { return new URL(a.href, location.href).searchParams.get('id'); }
  catch { return null; }
}

function journalOptions() {
  return [...new Set(data.map((r) => r.revista).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
}

function yearOptions() {
  return [...new Set(data.map((r) => (r.fecha || '').slice(0,4)).filter(Boolean))].sort().reverse();
}

function addAdvanced() {
  const header = document.querySelector('.indice-cabecera');
  if (!header || document.getElementById('rt-advanced')) return;
  const div = document.createElement('div');
  div.id = 'rt-advanced';
  div.className = 'rt-advanced';
  div.innerHTML = `<select id="rt-year" aria-label="Filtrar por año"><option value="">Todos los años</option>${yearOptions().map((y) => `<option>${esc(y)}</option>`).join('')}</select><select id="rt-journal" aria-label="Filtrar por revista"><option value="">Todas las revistas</option>${journalOptions().map((j) => `<option value="${esc(j)}">${esc(j)}</option>`).join('')}</select>${state.signedIn ? '<select id="rt-status" aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="unread">No leídos</option><option value="favorites">Guardados</option></select>' : ''}`;
  const search = header.querySelector('.buscador');
  if (search) header.insertBefore(div, search);
  else header.appendChild(div);
  div.addEventListener('change', () => {
    advanced.year = document.getElementById('rt-year')?.value || '';
    advanced.journal = document.getElementById('rt-journal')?.value || '';
    advanced.status = document.getElementById('rt-status')?.value || 'all';
    applyPersonalFilters();
  });
}

function addMemberContext() {
  if (!state.signedIn) return;
  const header = document.querySelector('.indice-cabecera');
  if (!header || document.getElementById('rt-member-note')) return;
  const unread = data.filter((r) => !state.read.includes(String(r.id))).length;
  const n = document.createElement('div');
  n.id = 'rt-member-note';
  n.className = 'rt-member-note';
  n.innerHTML = `<span>${unread} no ${unread === 1 ? 'leído' : 'leídos'}</span><a href="biblioteca.html">Biblioteca · ${state.favorites.length}</a>`;
  header.insertAdjacentElement('beforebegin', n);
}

function enhanceRows() {
  if (applying) return;
  applying = true;
  document.querySelectorAll('.fila').forEach((row) => {
    const id = articleId(row);
    if (!id) return;
    const a = row.querySelector('a.cabeza');
    if (a && !a.dataset.rtReadBound) {
      a.dataset.rtReadBound = '1';
      a.addEventListener('click', () => {
        if (state.signedIn) markRead(id).catch(() => {});
      }, { capture:true });
    }
    const title = row.querySelector('.fila-cuerpo h3');
    if (state.signedIn && title && !state.read.includes(id) && !title.querySelector('.rt-unread-dot')) {
      title.insertAdjacentHTML('beforeend', '<span class="rt-unread-dot" title="No leído" aria-label="No leído"></span>');
    }
    const pdf = row.querySelector('.fila-pdf');
    if (state.signedIn && pdf && !pdf.querySelector('.rt-fav')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rt-fav';
      b.dataset.on = String(state.favorites.includes(id));
      b.textContent = state.favorites.includes(id) ? '✓ Guardado' : '☆ Guardar';
      b.addEventListener('click', async (ev) => {
        ev.preventDefault(); ev.stopPropagation(); b.disabled = true;
        try {
          const on = await toggleFavorite(id);
          b.dataset.on = String(on);
          b.textContent = on ? '✓ Guardado' : '☆ Guardar';
          state.favorites = on ? [...new Set([...state.favorites,id])] : state.favorites.filter((x) => x !== id);
          const link = document.querySelector('#rt-member-note a');
          if (link) link.textContent = `Biblioteca · ${state.favorites.length}`;
          applyPersonalFilters();
        } catch (err) { console.error(err); }
        finally { b.disabled = false; }
      });
      pdf.appendChild(b);
    }
  });
  applying = false;
  applyPersonalFilters();
}

function applyPersonalFilters() {
  document.querySelectorAll('.fila').forEach((row) => {
    const id = articleId(row), r = byId.get(String(id));
    if (!r) return;
    const y = (r.fecha || '').slice(0,4);
    const okYear = !advanced.year || y === advanced.year;
    const okJournal = !advanced.journal || r.revista === advanced.journal;
    const okStatus = advanced.status === 'all' || (advanced.status === 'unread' && !state.read.includes(String(id))) || (advanced.status === 'favorites' && state.favorites.includes(String(id)));
    row.dataset.rtPersonalVisible = String(okYear && okJournal && okStatus);
    if (!(okYear && okJournal && okStatus)) row.style.display = 'none';
    else if (row.style.display === 'none') row.style.display = '';
  });
  document.querySelectorAll('.grupo-anio').forEach((g) => {
    const visible = [...g.querySelectorAll('.fila')].some((r) => getComputedStyle(r).display !== 'none');
    if (!visible) g.style.display = 'none';
    else if (g.style.display === 'none') g.style.display = '';
  });
}

async function init() {
  injectStyle();
  const v = document.createElement('div');
  v.className = 'rt-version';
  v.textContent = RT_WEB_VERSION;
  document.body.appendChild(v);
  try {
    await Promise.all([loadData(), getLibraryState().then((s) => state = s)]);
    addMemberContext();
    addAdvanced();
    enhanceRows();
    const indice = document.getElementById('indice');
    if (indice) new MutationObserver(() => enhanceRows()).observe(indice, { childList:true, subtree:true });
    if (state.signedIn) touchLastVisit().catch(() => {});
  } catch (err) {
    console.error('RT interactive init', err);
  }
}

init();
