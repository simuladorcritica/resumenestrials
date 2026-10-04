// One data request per navigation, shared by the public readers and controls.
let pending;
export function loadTrials() {
  if (!pending) {
    pending = fetch('/resumenes.json', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`resumenes.json HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
        throw new Error('resumenes.json debe contener una lista de registros');
      }
      return rows;
    }).catch(error => { pending = undefined; throw error; });
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
