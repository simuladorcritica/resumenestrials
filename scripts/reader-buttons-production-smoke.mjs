import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE='https://resumenestrials.com';
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const sample=data.find(x=>x.corto&&manifest[String(x.id)]?.path);
if(!sample) throw new Error('No existe un trial con resumen breve para probar');
const trialPath=manifest[String(sample.id)].path;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(value,message)=>{if(!value)throw new Error(message)};

async function fetchText(path){
  const sep=path.includes('?')?'&':'?';
  const response=await fetch(`${BASE}${path}${sep}readerqa=${Date.now()}`,{
    headers:{'Cache-Control':'no-cache','Pragma':'no-cache','User-Agent':'Resúmenes-Trials-Reader-Buttons-QA/1.0'},
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.text();
}

async function waitDeployment(){
  let last='';
  for(let i=1;i<=36;i++){
    try{
      const html=await fetchText(trialPath);
      const js=await fetchText('/reader-controls-v9.js');
      const ready=html.includes('/reader-controls-v9.js?v=2')&&js.includes("min-height', '54px'")&&js.includes('__rtReaderControlsV9');
      if(ready){console.log(`READER BUTTONS V9.2 DEPLOYMENT READY · intento ${i}`);return;}
      last=`htmlV2=${html.includes('/reader-controls-v9.js?v=2')} min54=${js.includes("min-height', '54px'")} js=${js.includes('__rtReaderControlsV9')}`;
    }catch(error){last=error.message}
    console.log(`Esperando despliegue de controles v9.2 (${i}/36) · ${last}`);
    await sleep(10000);
  }
  throw new Error(`La capa de controles v9.2 no llegó a producción: ${last}`);
}

async function physicalRelease(page,selector,waiter){
  const locator=page.locator(selector).first();
  await locator.waitFor({state:'visible',timeout:15000});
  await locator.scrollIntoViewIfNeeded();
  const box=await locator.boundingBox();
  assert(box&&box.width>10&&box.height>10,`${selector}: geometría inválida`);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.waitForTimeout(220);
  if(waiter) await Promise.all([waiter(),page.mouse.up()]);
  else await page.mouse.up();
}

await waitDeployment();
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon|429|adsbygoogle/i.test(m.text()))errors.push(m.text())});

  const openTrial=async()=>{
    await page.goto(`${BASE}${trialPath}?readerqa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('html[data-rt-reader-controls-v9="ready"]',{timeout:15000});
    for(const selector of ['.rt-reader-back[data-rt-reader-controls="v9"]','.rt-reader-version[data-rt-reader-controls="v9"]','.rt-reader-footer-download[data-rt-reader-controls="v9"]']){
      assert(await page.locator(selector).isVisible(),`No está visible ${selector}`);
    }
  };

  // 1) Volver al índice: interacción física pointerdown -> pausa -> pointerup.
  await openTrial();
  await physicalRelease(page,'.rt-reader-back',()=>page.waitForURL(url=>url.pathname==='/'||url.pathname==='/index.html',{timeout:15000}));
  assert(new URL(page.url()).pathname==='/'||new URL(page.url()).pathname==='/index.html','Volver al índice no navegó a la portada');

  // 2) Ver resumen breve: debe conservar el mismo id y v=corto.
  await openTrial();
  await physicalRelease(page,'.rt-reader-version',()=>page.waitForURL(url=>url.pathname==='/resumen.html'&&url.searchParams.get('id')===String(sample.id)&&url.searchParams.get('v')==='corto',{timeout:15000}));
  const briefUrl=new URL(page.url());
  assert(briefUrl.pathname==='/resumen.html'&&briefUrl.searchParams.get('id')===String(sample.id)&&briefUrl.searchParams.get('v')==='corto','Ver resumen breve abrió un destino incorrecto');

  // 3) Descargar resumen completo PDF: debe producir un archivo real.
  await openTrial();
  let download=null;
  await physicalRelease(page,'.rt-reader-footer-download',async()=>{
    download=await page.waitForEvent('download',{timeout:45000});
  });
  assert(download,'El botón PDF no inició una descarga');
  assert(/\.pdf$/i.test(download.suggestedFilename()),`Nombre de archivo PDF inesperado: ${download.suggestedFilename()}`);
  assert(Boolean(await download.path()),'La descarga PDF no produjo archivo');

  // 4) La misma capa debe quedar utilizable en móvil, con superficie táctil suficiente.
  await page.setViewportSize({width:390,height:844});
  await openTrial();
  const mobile=await page.evaluate(()=>{
    const selectors=['.rt-reader-back','.rt-reader-version','.rt-reader-footer-download'];
    return selectors.map(selector=>{
      const el=document.querySelector(selector); const r=el?.getBoundingClientRect();
      return {selector,width:r?.width||0,height:r?.height||0,pointer:el?getComputedStyle(el).pointerEvents:'',touch:el?getComputedStyle(el).touchAction:''};
    });
  });
  assert(mobile.every(x=>x.width>=300&&x.height>=54&&x.pointer==='auto'&&x.touch==='manipulation'),`Controles móviles inválidos: ${JSON.stringify(mobile)}`);
  await physicalRelease(page,'.rt-reader-version',()=>page.waitForURL(url=>url.pathname==='/resumen.html'&&url.searchParams.get('id')===String(sample.id)&&url.searchParams.get('v')==='corto',{timeout:15000}));

  assert(errors.length===0,`Errores JavaScript durante la prueba: ${[...new Set(errors)].join(' | ')}`);
  console.log(`READER BUTTONS PRODUCTION PASS · trial ${sample.id} · volver + breve + PDF + móvil mediante interacción física`);
}finally{
  await browser.close();
}
