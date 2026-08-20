import { chromium } from 'playwright';
import { resolve } from 'node:path';

function assert(value, message) {
  if (!value) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1424, height: 500 } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    :root{--tinta:#12233b;--tinta-2:#38506e;--teal:#1c8a8a;--teal-hondo:#0f5f5f;--papel:#f7f6f2;--papel-2:#efece4;--linea:#ddd8cc}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--papel)}
    .envoltorio{max-width:1500px;margin:0 auto;padding:0 clamp(32px,6vw,96px)}
    .indice-cabecera{display:flex;align-items:center;justify-content:space-between;gap:14px 20px;flex-wrap:wrap;margin:56px 0 6px;padding-bottom:4px}
    .filtros{display:inline-flex;gap:8px;flex-wrap:wrap}
    .filtro{font-family:monospace;font-size:14px;line-height:1.2;letter-spacing:.065em;text-transform:uppercase;color:var(--tinta-2);background:transparent;border:1px solid var(--linea);border-radius:3px;min-height:44px;padding:11px 18px;font-weight:500}
    .filtro .n{font-size:12px;margin-left:7px;opacity:.78}
    .rt-advanced{display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0}
    .rt-advanced select{appearance:auto;font:500 13px/1.2 monospace;letter-spacing:.035em;color:var(--tinta-2);background:transparent;border:1px solid var(--linea);border-radius:3px;padding:10px 14px;min-height:44px;cursor:pointer}
    .buscador{display:flex;align-items:center;gap:10px;background:var(--papel-2);border:1px solid var(--linea);border-radius:3px;padding:10px 15px;min-width:min(320px,100%);min-height:44px}
    .buscador input{border:0;background:transparent;width:100%;font:14px monospace}
  </style></head><body><main class="envoltorio"><div class="indice-cabecera">
    <div class="filtros">
      <button class="filtro">Todos <span class="n">38</span></button>
      <button class="filtro">Medicina Crítica <span class="n">23</span></button>
      <button class="filtro">Medicina Interna <span class="n">18</span></button>
    </div>
    <div class="rt-advanced">
      <select id="rt-year"><option>Todos los años</option></select>
      <select id="rt-journal"><option>Todas las revistas</option><option>Intensive Care Medicine</option></select>
    </div>
    <label class="buscador"><input value="" placeholder="Buscar trial, fármaco"></label>
  </div></main></body></html>`);
  await page.addScriptTag({ path: resolve('home-control-layout.js') });
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const header = document.querySelector('.indice-cabecera');
    const journal = document.querySelector('#rt-journal');
    const year = document.querySelector('#rt-year');
    const search = document.querySelector('.buscador');
    const filters = [...document.querySelectorAll('.filtro')];
    const style = getComputedStyle(journal);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const labelWidth = ctx.measureText(journal.selectedOptions[0].textContent).width;
    return {
      headerClient: header.clientWidth,
      headerScroll: header.scrollWidth,
      journalWidth: journal.getBoundingClientRect().width,
      yearWidth: year.getBoundingClientRect().width,
      searchWidth: search.getBoundingClientRect().width,
      labelWidth,
      journalPadding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
      filterHeights: filters.map((x) => x.getBoundingClientRect().height)
    };
  });

  assert(metrics.headerScroll <= metrics.headerClient + 1, `Los controles desbordan la fila: ${JSON.stringify(metrics)}`);
  assert(metrics.journalWidth >= 245, `El filtro de revistas sigue demasiado estrecho: ${metrics.journalWidth}px`);
  assert(metrics.labelWidth + metrics.journalPadding + 34 < metrics.journalWidth, `“Todas las revistas” aún puede recortarse: ${JSON.stringify(metrics)}`);
  assert(metrics.yearWidth >= 165, `Se redujo el filtro de años: ${metrics.yearWidth}px`);
  assert(metrics.searchWidth >= 220, `Se redujo el buscador: ${metrics.searchWidth}px`);
  assert(metrics.filterHeights.every((h) => h >= 43), `Se redujo la altura de filtros: ${metrics.filterHeights.join(',')}`);
  console.log(`HOME CONTROLS PASS · journal=${Math.round(metrics.journalWidth)}px · row=${metrics.headerClient}px`);
} finally {
  await browser.close();
}
