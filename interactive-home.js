import './client-monitor.js';
import { getLibraryState, toggleFavorite, markRead, touchLastVisit } from './library-store.js';
import { RT_WEB_VERSION } from './app-version.js';

const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
// r.fecha suele ser ISO (AAAA-MM-DD), pero 11 registros historicos usan texto en
// espanol ("27 de agosto de 2022", con eventuales fechas de actualizacion entre
// parentesis). slice(0,4) asumia siempre ISO y devolvia fragmentos como "27 d"
// para esos casos, lo que ademas de ensuciar el selector de anios los excluia
// por error al filtrar por anio. Se toma el primer bloque de 4 digitos, que en
// ambos formatos es siempre el anio.
function extraerAnio(fecha) {
  const m = String(fecha || '').match(/\d{4}/);
  return m ? m[0] : '';
}

// resumenes.json guarda el nombre de la revista tal como aparece en la cita
// original de cada articulo, asi que la misma revista termina con varias
// grafias distintas segun la fuente (105 "NEJM", 13 "New England Journal of
// Medicine", 11 "The New England Journal of Medicine": las 3 son la misma
// publicacion). Sin normalizar, el selector "Filtrar por revista" mostraba 4
// entradas para lo que son en realidad 2 revistas. No se modifica
// resumenes.json (dato de origen, fuera de alcance): la normalizacion vive
// aqui y se aplica tanto a la lista de opciones como al filtro real, para
// que elegir "NEJM" siga encontrando cualquiera de las 4 grafias, incluida
// "NEJM Evidence" (a pedido explicito del editor del sitio, se trata como
// la misma entrada de filtro que "NEJM").
const RT_ALIAS_REVISTA = {
  'New England Journal of Medicine': 'NEJM',
  'The New England Journal of Medicine': 'NEJM',
  'NEJM Evidence': 'NEJM',
};
function normalizarRevista(nombre) {
  return RT_ALIAS_REVISTA[nombre] || nombre;
}
let data = [];
let byId = new Map();
let state = { signedIn:false, favorites:[], read:[], preferences:{} };
let advanced = { year:'', journal:'', status:'all' };
let applying = false;
const PAGE_SIZE = 24;
let visibleLimit = PAGE_SIZE;

function injectStyle() {
  if (document.getElementById('rt-interactive-style')) return;
  const s = document.createElement('style');
  s.id = 'rt-interactive-style';
  s.textContent = `
    .indice-cabecera{gap:14px 20px}
    .filtros{gap:8px}
    .filtro{font-size:14px!important;line-height:1.2;letter-spacing:.065em!important;min-height:44px;padding:11px 18px!important;font-weight:500}
    .filtro .n{font-size:12px!important;margin-left:7px!important;opacity:.78!important}
    .rt-advanced{display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0}
    .rt-advanced select{appearance:auto;font:500 13px/1.2 'IBM Plex Mono',monospace;letter-spacing:.035em;color:var(--tinta-2);background:transparent;border:1px solid var(--linea);border-radius:3px;padding:10px 14px;min-height:44px;cursor:pointer}
    .rt-advanced select:hover,.rt-advanced select:focus{border-color:var(--teal);outline:none;color:var(--teal-hondo);box-shadow:0 0 0 3px rgba(28,138,138,.08)}
    .buscador{min-height:44px!important;padding:10px 15px!important}
    .buscador-input{font-size:14px!important;line-height:1.25}
    .rt-fav{margin-left:8px;display:inline-flex;align-items:center;gap:6px;font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--tinta-2);background:transparent;border:0;border-bottom:1px solid transparent;padding:5px 2px;cursor:pointer}
    .rt-fav:hover{color:var(--teal-hondo);border-bottom-color:var(--teal)}
    .rt-fav[data-on=true]{color:var(--teal-hondo)}
    .rt-unread-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ambar);margin-left:9px;vertical-align:middle}
    .rt-version{display:none!important}
    .rt-filter-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;font:500 13px/1.4 'IBM Plex Mono',monospace;color:var(--tinta-2)}
    .rt-filter-chip,.rt-clear-filters,.rt-show-more{min-height:44px;border:1px solid var(--linea);border-radius:8px;background:transparent;color:var(--teal-hondo);padding:9px 13px;font:500 13px/1.3 'IBM Plex Mono',monospace;cursor:pointer}
    .rt-show-more{display:flex;margin:28px auto;padding-inline:22px}
    .rt-filter-sticky{position:sticky;top:var(--rt-topbar-h,80px);z-index:35;background:var(--papel);padding:12px;border:1px solid var(--linea);border-radius:12px}
    .fila[hidden],.grupo-anio[hidden]{display:none!important}
    .rt-member-note{display:flex;align-items:center;justify-content:flex-end;gap:18px;margin:30px 0 -34px;font:10px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--tinta-2)}
    .rt-member-note a{color:var(--teal-hondo);text-decoration:none;border-bottom:1px solid rgba(15,95,95,.25)}
    .rt-member-note a:hover{border-color:var(--teal)}
    @media(max-width:1120px){.indice-cabecera{align-items:flex-start}.rt-advanced{order:2}.buscador{margin-left:auto}}
    @media(max-width:760px){.filtro{font-size:13px!important;min-height:42px;padding:10px 14px!important}.filtro .n{font-size:11px!important}.rt-advanced{width:100%;order:3}.rt-advanced select{flex:1;min-width:140px;font-size:12.5px;min-height:42px;padding:9px 12px}.buscador{order:2;margin-left:0;width:100%;min-width:100%!important}.buscador-input{font-size:13px!important}.rt-member-note{justify-content:flex-start;margin:24px 0 -22px;flex-wrap:wrap}.rt-fav{margin-left:0;margin-top:5px}}
  `;
  document.head.appendChild(s);
}

async function loadData() {
  data = await import('/trial-data.js').then(m => m.loadTrials());
  byId = new Map(data.map((x) => [String(x.id), x]));
}

function articleId(row) {
  const direct = row?.dataset?.id;
  if (direct) return direct;
  const a = row.querySelector('a.cabeza[href*="resumen.html?id="]');
  if (!a) return null;
  try { return new URL(a.href, location.href).searchParams.get('id'); }
  catch { return null; }
}

function journalOptions() {
  return [...new Set(data.map((r) => normalizarRevista(r.revista)).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
}

function yearOptions() {
  return [...new Set(data.map((r) => extraerAnio(r.fecha)).filter(Boolean))].sort().reverse();
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
    visibleLimit=PAGE_SIZE;applyPersonalFilters();syncUrl();
  });
}

function queryState(){
  const p=new URLSearchParams(location.search);
  return {q:p.get('q')||'',esp:p.get('esp')||'todos',year:p.get('anio')||'',journal:p.get('revista')||''};
}
function restoreUrlState(){
  const s=queryState(), input=document.getElementById('q');
  if(input&&s.q){input.value=s.q;input.dispatchEvent(new Event('input',{bubbles:true}))}
  const pill=document.querySelector(`.filtro[data-esp="${CSS.escape(s.esp)}"]`);pill?.click();
  const year=document.getElementById('rt-year'),journal=document.getElementById('rt-journal');
  if(year){year.value=s.year;advanced.year=s.year}if(journal){journal.value=s.journal;advanced.journal=s.journal}
}
function syncUrl(){
  const p=new URLSearchParams(),q=document.getElementById('q')?.value.trim()||'';
  const esp=document.querySelector('.filtro[aria-pressed="true"]')?.dataset.esp||'todos';
  if(q)p.set('q',q);if(esp!=='todos')p.set('esp',esp);if(advanced.year)p.set('anio',advanced.year);if(advanced.journal)p.set('revista',advanced.journal);
  history.replaceState(null,'',location.pathname+(p.size?`?${p}`:''));
}
function filterSummary(rows,total){
  let box=document.getElementById('rt-filter-summary');if(!box){box=document.createElement('div');box.id='rt-filter-summary';box.className='rt-filter-summary';document.querySelector('.indice-cabecera')?.append(box)}
  const chips=[];const q=document.getElementById('q')?.value.trim();const esp=document.querySelector('.filtro[aria-pressed="true"]')?.textContent.replace(/\d+/g,'').trim();
  if(q)chips.push(['q',`Búsqueda: ${q}`]);if(esp&&esp!=='Todos')chips.push(['esp',esp]);if(advanced.year)chips.push(['anio',advanced.year]);if(advanced.journal)chips.push(['revista',advanced.journal]);
  box.innerHTML=`<span>${total} resultados</span>${chips.map(([k,v])=>`<button class="rt-filter-chip" data-clear="${k}" aria-label="Quitar filtro ${esc(v)}">${esc(v)} ×</button>`).join('')}${chips.length?'<button class="rt-clear-filters" data-clear="all">Limpiar</button>':''}`;
  box.onclick=e=>{const key=e.target.closest('[data-clear]')?.dataset.clear;if(!key)return;const input=document.getElementById('q');if(key==='q'||key==='all'){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}))}if(key==='esp'||key==='all')document.querySelector('.filtro[data-esp="todos"]')?.click();if(key==='anio'||key==='all'){advanced.year='';document.getElementById('rt-year').value=''}if(key==='revista'||key==='all'){advanced.journal='';document.getElementById('rt-journal').value=''}visibleLimit=PAGE_SIZE;applyPersonalFilters();syncUrl()};
}
function paginate(){
  const eligible=[...document.querySelectorAll('.fila')].filter(r=>r.dataset.rtPersonalVisible!=='false'&&r.style.display!=='none');
  eligible.forEach((row,i)=>row.hidden=i>=visibleLimit);
  document.querySelectorAll('.grupo-anio').forEach(g=>g.hidden=![...g.querySelectorAll('.fila')].some(r=>!r.hidden&&r.dataset.rtPersonalVisible!=='false'&&r.style.display!=='none'));
  let more=document.getElementById('rt-show-more');if(eligible.length>visibleLimit){if(!more){more=document.createElement('button');more.id='rt-show-more';more.className='rt-show-more';more.type='button';more.textContent='Mostrar más';document.getElementById('indice')?.after(more);more.onclick=()=>{visibleLimit+=PAGE_SIZE;applyPersonalFilters()}}}else more?.remove();
  filterSummary(eligible,eligible.length);
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
    if(!row.dataset.rtCardLink){const read=row.querySelector('a.cabeza');if(read){row.dataset.rtCardLink='1';row.addEventListener('click',e=>{if(e.target.closest('a,button,details,summary'))return;read.click()})}}
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
    const y = extraerAnio(r.fecha);
    const okYear = !advanced.year || y === advanced.year;
    const okJournal = !advanced.journal || normalizarRevista(r.revista) === advanced.journal;
    const okStatus = advanced.status === 'all' || (advanced.status === 'unread' && !state.read.includes(String(id))) || (advanced.status === 'favorites' && state.favorites.includes(String(id)));
    row.dataset.rtPersonalVisible = String(okYear && okJournal && okStatus);
    if (!(okYear && okJournal && okStatus)) row.style.display = 'none';
    else if (row.style.display === 'none') row.style.display = '';
  });
  document.querySelectorAll('.grupo-anio').forEach((g) => {
    const visible = [...g.querySelectorAll('.fila')].some((r) => getComputedStyle(r).display !== 'none');
    // El bundle inyecta `.grupo-anio{display:grid!important}` (future-experience.css) y
    // ademas home-visual-tuning.js repite la misma regla !important sin el prefijo
    // .rt-future-home. Un display:none puesto por JS via .style.display nunca puede
    // ganarle a una regla de hoja de estilo marcada !important, asi que el grupo se
    // quedaba visible (con su rotulo de año) aunque los ensayos del año ya estuvieran
    // ocultos por el filtro, dejando un bloque en blanco por cada año sin resultados.
    // Se usa una clase con mayor especificidad (ver future-experience.css) en vez de
    // depender de estilo inline.
    g.classList.toggle('rt-grupo-vacio', !visible);
  });
  paginate();
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
    restoreUrlState();
    document.getElementById('q')?.addEventListener('input',()=>{visibleLimit=PAGE_SIZE;queueMicrotask(()=>{applyPersonalFilters();syncUrl()})});
    document.querySelector('.filtros')?.addEventListener('click',()=>{visibleLimit=PAGE_SIZE;queueMicrotask(()=>{applyPersonalFilters();syncUrl()})});
    document.querySelector('.indice-cabecera')?.classList.add('rt-filter-sticky');
    const indice = document.getElementById('indice');
    if (indice) new MutationObserver(() => enhanceRows()).observe(indice, { childList:true, subtree:true });
    if (state.signedIn) touchLastVisit().catch(() => {});
  } catch (err) {
    console.error('RT interactive init', err);
  }
}

init();
