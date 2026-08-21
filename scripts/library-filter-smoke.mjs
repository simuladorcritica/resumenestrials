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
  await page.waitForSelector('#rt-year',{state:'visible',timeout:12000});
  await page.waitForSelector('#rt-journal',{state:'visible',timeout:12000});
  await page.waitForFunction(()=>document.querySelector('.indice-cabecera')?.dataset.rtSimpleFilters==='1',{timeout:12000});

  assert(await page.locator('.indice-cabecera .filtros').count()===0,'Filtros: permanecen pestañas Todos/Medicina Crítica/Medicina Interna');
  assert(await page.locator('.indice-cabecera .buscador').count()===0,'Filtros: permanece el buscador redundante del renglón');
  assert(await page.locator('#rt-status').count()===0,'Filtros: permanece un tercer selector de estado');
  assert(await page.locator('#rt-advanced select').count()===2,'Filtros: deben existir exactamente año y revista');
  assert(await page.locator('.rt-global-search-input').isVisible(),'Filtros: el buscador global superior debe seguir disponible');
  assert((await page.locator('#rt-year option:checked').innerText()).trim()==='Todos los años','Filtros: el selector de año no muestra el texto completo esperado');
  assert((await page.locator('#rt-journal option:checked').innerText()).trim()==='Todas las revistas','Filtros: el selector de revista no muestra el texto esperado');

  const advancedBox=await page.locator('#rt-advanced').boundingBox();
  const yearBox=await page.locator('#rt-year').boundingBox();
  const journalBox=await page.locator('#rt-journal').boundingBox();
  assert(advancedBox&&Math.abs((advancedBox.x+advancedBox.width/2)-720)<35,`Filtros: el grupo no quedó centrado (${JSON.stringify(advancedBox)})`);
  assert(yearBox&&yearBox.width>=280&&yearBox.height>=56,`Filtros: selector de año demasiado pequeño (${JSON.stringify(yearBox)})`);
  assert(journalBox&&journalBox.width>=390&&journalBox.height>=56,`Filtros: selector de revista demasiado pequeño (${JSON.stringify(journalBox)})`);

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

  const years=[...new Set(data.map(r=>String(r.anio||(r.fecha||'').slice(0,4))).filter(Boolean))];
  const targetYear=years.find(y=>data.filter(r=>String(r.anio||(r.fecha||'').slice(0,4))===y).length<data.length);
  assert(targetYear,'Filtros: no hay un año útil para probar');
  await page.selectOption('#rt-year',targetYear);
  await page.waitForTimeout(120);
  const yearVisible=await page.locator('.fila:visible').evaluateAll(rows=>rows.map(r=>r.dataset.id));
  const yearExpected=new Set(data.filter(r=>String(r.anio||(r.fecha||'').slice(0,4))===targetYear).map(r=>String(r.id)));
  assert(yearVisible.length===yearExpected.size&&yearVisible.every(id=>yearExpected.has(id)),`Filtros: el año ${targetYear} no filtra correctamente`);
  await page.selectOption('#rt-year','');

  const journalCounts=new Map();
  for(const row of data){if(row.revista)journalCounts.set(row.revista,(journalCounts.get(row.revista)||0)+1)}
  const targetJournal=[...journalCounts].sort((a,b)=>b[1]-a[1]).find(([,n])=>n>0&&n<data.length)?.[0];
  assert(targetJournal,'Filtros: no hay una revista útil para probar');
  await page.selectOption('#rt-journal',{label:targetJournal});
  await page.waitForTimeout(120);
  const journalVisible=await page.locator('.fila:visible').evaluateAll(rows=>rows.map(r=>r.dataset.id));
  const journalExpected=new Set(data.filter(r=>r.revista===targetJournal).map(r=>String(r.id)));
  assert(journalVisible.length===journalExpected.size&&journalVisible.every(id=>journalExpected.has(id)),`Filtros: la revista ${targetJournal} no filtra correctamente`);
  await page.selectOption('#rt-journal','');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert(await page.locator('#rt-year').isVisible(),'Filtros móvil: año no visible');
  assert(await page.locator('#rt-journal').isVisible(),'Filtros móvil: revista no visible');
  const mobileBoxes=await Promise.all([page.locator('#rt-year').boundingBox(),page.locator('#rt-journal').boundingBox()]);
  assert(mobileBoxes.every(b=>b&&b.width>330),`Filtros móvil: los selectores no aprovechan el ancho disponible (${JSON.stringify(mobileBoxes)})`);
  const mobile=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth}));
  assert(mobile.sw<=mobile.w+2&&mobile.bw<=mobile.w+2,`Filtros móvil: overflow horizontal ${JSON.stringify(mobile)}`);

  assert(errors.length===0,`Filtros: errores JavaScript ${errors.join(' | ')}`);
  console.log(`LIBRARY FILTER PASS · sin líneas · año visible completo · ${targetYear} · ${targetJournal}`);
} finally {
  await browser.close();
}
