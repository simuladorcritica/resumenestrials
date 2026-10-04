import { chromium } from 'playwright';

function assert(value, message) { if (!value) throw new Error(message); }

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1424, height: 700 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      :root{--tinta:#12233b;--tinta-2:#38506e;--teal:#1c8a8a;--teal-hondo:#0f5f5f;--papel:#f7f6f2;--papel-2:#efece4;--linea:#ddd8cc}
      *{box-sizing:border-box} body{margin:0;background:var(--papel)}
      .envoltorio{max-width:1500px;margin:0 auto;padding:0 clamp(20px,6vw,96px)}
      .indice-cabecera{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:30px 0}
      .filtros,.rt-advanced{display:flex;gap:8px;flex-wrap:wrap}.filtro,.rt-advanced select{min-height:44px}
      .buscador{display:flex;flex:1;min-width:280px;min-height:44px}.buscador input{width:100%;min-height:44px}
    </style></head><body><main class="envoltorio"><div class="indice-cabecera">
      <div class="filtros"><button class="filtro">Todos</button><button class="filtro">Crítica</button><button class="filtro">Interna</button></div>
      <div class="rt-advanced"><select><option>2026</option></select><select><option>NEJM</option></select></div>
      <label class="buscador"><input placeholder="Buscar trial, fármaco, tema, autor…"></label>
    </div></main></body></html>`);
    await page.addScriptTag({ path: 'home-control-layout.js' });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      heights: [...document.querySelectorAll('button,select,input')].map(el => el.getBoundingClientRect().height),
      visible: [...document.querySelectorAll('.filtros,.rt-advanced,.buscador')].every(el => getComputedStyle(el).display !== 'none')
    }));
    assert(metrics.scrollWidth <= metrics.innerWidth + 1, `Los controles desbordan a ${viewport.width}px: ${JSON.stringify(metrics)}`);
    assert(metrics.visible, `Algún control contextual quedó oculto a ${viewport.width}px`);
    assert(metrics.heights.every(height => height >= 44), `Algún control perdió su tamaño táctil a ${viewport.width}px: ${metrics.heights}`);
    await page.close();
  }
  console.log('HOME CONTROLS PASS · filtros contextuales sin desborde');
} finally { await browser.close(); }
