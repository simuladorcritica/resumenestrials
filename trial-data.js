// One data request per navigation, shared by the public readers and controls.
// HTTP caching (GitHub Pages: max-age=600 + ETag) is allowed so mobile visits do not
// download the full archive again on every page.
let pending,controller,fullPending;
// Navigation cancels an unfinished request before WebKit tears down its origin.
if(typeof window!=='undefined')for(const event of ['beforeunload','pagehide'])window.addEventListener(event,()=>controller?.abort());
// Listas, búsqueda, filtros y recomendaciones usan el índice ligero (sin cuerpo ni
// corto, ~85 KB comprimido). El texto completo de un ensayo está en datos/ensayos/<id>.json.
const INDEX_URL='/datos/indice.json';
function fetchList(url){
  controller??=new AbortController();
  return fetch(url,{signal:controller.signal}).then(async response => {
    if (!response.ok) throw new Error(`${url.replace(/^\//,'')} HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('resumenes.json debe contener una lista de registros');
    }
    return rows;
  });
}
// Archivo completo: solo como respaldo si falta el archivo de un ensayo.
export function loadFullTrials() {
  if(typeof window!=='undefined'&&window.evNavigatingAway)return Promise.reject(new DOMException('La navegación finalizó','AbortError'));
  return fullPending ??= fetchList('/resumenes.json').catch(error => { fullPending = undefined; throw error; });
}
export function loadTrials() {
  if(typeof window!=='undefined'&&window.evNavigatingAway)return Promise.reject(new DOMException('La navegación finalizó','AbortError'));
  if (!pending) {
    pending = fetchList(INDEX_URL).catch(error => { pending = undefined; throw error; });
  }
  return pending;
}

const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export function trialDateKey(value) {
  const text = String(value ?? '').trim().toLowerCase();
  let year, month, day;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const editorial = /^(\d{1,2}) de ([a-z]+) de (\d{4})(?:$|\s*\()/.exec(text);
  if (iso) [,year,month,day] = iso.map(Number);
  else if (editorial) { day=Number(editorial[1]); month=months.indexOf(editorial[2])+1; year=Number(editorial[3]); }
  else return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month-1, day);
  date.setUTCHours(0,0,0,0);
  return month>=1 && month<=12 && date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day ? date.getTime() : null;
}

// Uninterpretable dates stay last; ties retain the existing stable order.
export function compareTrialDates(a,b) {
  const left=trialDateKey(a.fecha), right=trialDateKey(b.fecha);
  if (left===null) return right===null ? 0 : 1;
  if (right===null) return -1;
  return right-left;
}
