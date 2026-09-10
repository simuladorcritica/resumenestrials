import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const originalIndex=readFileSync('index.html','utf8');
process.once('exit',()=>writeFileSync('index.html',originalIndex,'utf8'));
let home=readFileSync('_includes/index-source.html','utf8');
const polish='<link rel="stylesheet" href="/library-filter-polish.css?v=1">';
const runtime='<script type="module" src="/interactive-home.js?v=20260819.4"></script><script src="/library-filter-cleanup.js?v=1" defer></script>';
home=home.replace('</head>',polish+'</head>').replace('</body>',runtime+'</body>');
writeFileSync('index.html',home,'utf8');

function assert(value,message){if(!value)throw new Error(message)}
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-home',{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('.indice-cabecera')?.dataset.rtSimpleFilters==='1',{timeout:12000});
  await page.waitForSelector('.indice-cabecera .buscador',{state:'visible',timeout:12000});

  // A pedido explícito del usuario: se quitaron los selectores de año/revista
  // (#rt-advanced) y los pills de especialidad (.filtros); el buscador de
  // texto (.buscador) es ahora el único control, a todo el ancho de la
  // cabecera. Ver future-experience-fix-v4.js y library-filter-cleanup.js.
  assert(await page.locator('.indice-cabecera .filtros').count()===0,'Filtros: no deben quedar las pestañas Todos/Medicina Crítica/Medicina Interna');
  assert(await page.locator('#rt-advanced').count()===0,'Filtros: no debe quedar el grupo de año/revista (#rt-advanced)');
  assert(await page.locator('#rt-year').count()===0,'Filtros: no debe quedar el selector de año');
  assert(await page.locator('#rt-journal').count()===0,'Filtros: no debe quedar el selector de revista');
  assert(await page.locator('#rt-status').count()===0,'Filtros: no debe quedar un selector de estado');
  assert(await page.locator('.indice-cabecera .buscador').count()===1,'Filtros: debe quedar exactamente un buscador en la cabecera');

  const headerBox=await page.locator('.indice-cabecera').boundingBox();
  const buscadorBox=await page.locator('.indice-cabecera .buscador').boundingBox();
  assert(headerBox&&buscadorBox,'Filtros: no se pudo medir la cabecera o el buscador');
  assert(buscadorBox.width/headerBox.width>0.95,`Filtros: el buscador debe ocupar todo el ancho de la cabecera (${buscadorBox.width}/${headerBox.width})`);
  assert(buscadorBox.height>=44,`Índice: el buscador perdió su tamaño táctil (alto=${buscadorBox.height})`);
  assert(await page.locator('label.ed-index-label').isVisible(),'Índice: falta etiqueta visible de búsqueda');

  const inputFontSize=await page.locator('.buscador-input').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert(inputFontSize>=18,`Filtros: el texto del buscador debe ser grande (font-size=${inputFontSize})`);

  const separators=await page.evaluate(()=>{
    const header=document.querySelector('.indice-cabecera');
    const first=document.querySelector('#indice .grupo-anio');
    const hs=header?getComputedStyle(header):null;
    const before=header?getComputedStyle(header,'::before'):null;
    const after=header?getComputedStyle(header,'::after'):null;
    const fs=first?getComputedStyle(first):null;
    return {
      headerTop:hs?.borderTopWidth,
      headerBottom:hs?.borderBottomWidth,
      headerShadow:hs?.boxShadow,
      beforeDisplay:before?.display,
      beforeContent:before?.content,
      afterDisplay:after?.display,
      afterContent:after?.content,
      firstTop:fs?.borderTopWidth
    };
  });
  assert(separators.headerTop==='0px'&&separators.headerBottom==='0px',`Filtros: la cabecera conserva líneas (${JSON.stringify(separators)})`);
  assert(separators.headerShadow==='none',`Filtros: la cabecera conserva una sombra tipo línea (${separators.headerShadow})`);
  assert(separators.firstTop==='0px',`Filtros: el primer bloque conserva una segunda línea (${separators.firstTop})`);
  assert((separators.beforeDisplay==='none'||separators.beforeContent==='none')&&(separators.afterDisplay==='none'||separators.afterContent==='none'),`Filtros: persiste un separador pseudo-elemento (${JSON.stringify(separators)})`);

  // Búsqueda de texto: debe filtrar en vivo sobre título/autor/revista/DOI
  // (misma lógica que interactive-home.js: aplicar() sobre r._buscable).
  const totalRows=await page.locator('.fila').count();
  const sample=data.find(r=>r.titulo&&r.titulo.length>6);
  assert(sample,'Filtros: no hay un trial de muestra para probar la búsqueda');
  const term=sample.titulo.split(/\s+/).find(w=>w.length>4)||sample.titulo.slice(0,6);
  await page.fill('.buscador-input',term);
  await page.waitForTimeout(150);
  const filteredRows=await page.locator('.fila:visible').count();
  assert(filteredRows>0&&filteredRows<=totalRows,`Filtros: la búsqueda "${term}" no produjo un subconjunto válido (antes=${totalRows} despues=${filteredRows})`);
  await page.fill('.buscador-input','');
  await page.waitForTimeout(150);
  const restoredRows=await page.locator('.fila:visible').count();
  assert(restoredRows===totalRows,`Filtros: limpiar el buscador no restauró todas las filas (antes=${totalRows} despues=${restoredRows})`);

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert(await page.locator('.indice-cabecera .buscador').isVisible(),'Filtros móvil: el buscador no es visible');
  const mobileBuscadorBox=await page.locator('.indice-cabecera .buscador').boundingBox();
  const mobileHeaderBox=await page.locator('.indice-cabecera').boundingBox();
  assert(mobileBuscadorBox&&mobileHeaderBox&&mobileBuscadorBox.width/mobileHeaderBox.width>0.9,`Filtros móvil: el buscador no aprovecha el ancho disponible (${JSON.stringify(mobileBuscadorBox)})`);
  const mobile=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth}));
  assert(mobile.sw<=mobile.w+2&&mobile.bw<=mobile.w+2,`Filtros móvil: overflow horizontal ${JSON.stringify(mobile)}`);

  assert(errors.length===0,`Filtros: errores JavaScript ${errors.join(' | ')}`);
  console.log(`LIBRARY FILTER PASS · sin líneas · buscador grande a todo el ancho · término de prueba "${term}"`);
} finally {
  await browser.close();
}
