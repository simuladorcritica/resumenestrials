import { chromium } from 'playwright';
import { resolve } from 'node:path';

function assert(value, message) {
  if (!value) throw new Error(message);
}

// A pedido explícito del usuario se quitaron los selectores de año/revista
// (#rt-year/#rt-journal/.filtros) del índice de la portada: el buscador de
// texto (.buscador) es ahora el único control de esa fila, a todo el ancho
// (ver library-filter-cleanup.js y future-experience-fix-v4.js). Esta prueba
// ya no verifica el ancho de selectores que no existen; en su lugar verifica
// que home-control-layout.js (que sigue controlando el padding del
// envoltorio y el comportamiento de .indice-cabecera a ≥1360px) no reintroduce
// desbordes ni angosta el único control que queda.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1424, height: 500 } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    :root{--tinta:#12233b;--tinta-2:#38506e;--teal:#1c8a8a;--teal-hondo:#0f5f5f;--papel:#f7f6f2;--papel-2:#efece4;--linea:#ddd8cc}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--papel)}
    .envoltorio{max-width:1500px;margin:0 auto;padding:0 clamp(32px,6vw,96px)}
    .indice-cabecera{display:flex;align-items:center;justify-content:space-between;gap:14px 20px;flex-wrap:wrap;margin:56px 0 6px;padding-bottom:4px}
    .buscador{display:flex;align-items:center;gap:10px;background:var(--papel-2);border:1px solid var(--linea);border-radius:12px;padding:20px 26px;width:100%;min-height:64px}
    .buscador input{border:0;background:transparent;width:100%;font:18px monospace}
  </style></head><body><main class="envoltorio"><div class="indice-cabecera">
    <label class="buscador"><input value="" placeholder="Buscar trial, fármaco, tema, autor…"></label>
  </div></main></body></html>`);
  await page.addScriptTag({ path: resolve('home-control-layout.js') });
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const envoltorio = document.querySelector('.envoltorio');
    const header = document.querySelector('.indice-cabecera');
    const search = document.querySelector('.buscador');
    const envStyle = getComputedStyle(envoltorio);
    return {
      headerClient: header.clientWidth,
      headerScroll: header.scrollWidth,
      headerWidth: header.getBoundingClientRect().width,
      searchWidth: search.getBoundingClientRect().width,
      envPaddingLeft: parseFloat(envStyle.paddingLeft),
      envPaddingRight: parseFloat(envStyle.paddingRight),
      noYear: !document.querySelector('#rt-year'),
      noJournal: !document.querySelector('#rt-journal'),
      noFiltros: !document.querySelector('.filtros'),
    };
  });

  assert(metrics.headerScroll <= metrics.headerClient + 1, `Los controles desbordan la fila: ${JSON.stringify(metrics)}`);
  assert(metrics.envPaddingLeft >= 48 && metrics.envPaddingRight >= 48, `El envoltorio perdió el padding ampliado a ≥1360px: ${JSON.stringify(metrics)}`);
  assert(metrics.searchWidth / metrics.headerWidth > 0.95, `El buscador ya no ocupa todo el ancho de la cabecera: ${JSON.stringify(metrics)}`);
  assert(metrics.noYear && metrics.noJournal && metrics.noFiltros, 'No deben existir #rt-year/#rt-journal/.filtros en el índice');
  console.log(`HOME CONTROLS PASS · buscador=${Math.round(metrics.searchWidth)}px de ${Math.round(metrics.headerWidth)}px · sin año/revista`);
} finally {
  await browser.close();
}
