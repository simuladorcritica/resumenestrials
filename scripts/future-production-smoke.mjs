import { chromium } from 'playwright';

const BASE='https://resumenestrials.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function assert(value,message){if(!value)throw new Error(message)}
async function fetchText(path){
  const r=await fetch(`${BASE}${path}${path.includes('?')?'&':'?'}qa=${Date.now()}`,{headers:{'Cache-Control':'no-cache','User-Agent':'Resúmenes-Trials-Future-QA/1.0'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
}
async function waitForDeployment(){
  let last='';
  for(let i=1;i<=32;i++){
    try{
      const html=await fetchText('/');
      const css=await fetch(`${BASE}/future-experience.css?qa=${Date.now()}`,{signal:AbortSignal.timeout(12000)});
      const js=await fetch(`${BASE}/future-experience.js?qa=${Date.now()}`,{signal:AbortSignal.timeout(12000)});
      const finalJs=await fetch(`${BASE}/future-experience-final.js?qa=${Date.now()}`,{signal:AbortSignal.timeout(12000)});
      if(html.includes('/future-experience.css?v=1')&&html.includes('/future-experience.js?v=1')&&html.includes('/future-experience-final.js?v=3')&&css.ok&&js.ok&&finalJs.ok){
        const finalText=await finalJs.text();
        if(finalText.includes('rt-final-polish-v3')){console.log(`FUTURE DEPLOYMENT READY · intento ${i}`);return;}
      }
      last=`HTML futuro=${html.includes('/future-experience.css?v=1')} final-v3=${html.includes('/future-experience-final.js?v=3')} CSS=${css.status} JS=${js.status} FINAL=${finalJs.status}`;
    }catch(e){last=e.message}
    console.log(`Esperando publicación futura (${i}/32) · ${last}`);
    await sleep(15000);
  }
  throw new Error(`La publicación futura no se propagó: ${last}`);
}
async function noOverflow(page,label){
  const m=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth}));
  assert(m.sw<=m.w+2&&m.bw<=m.w+2,`${label}: overflow ${JSON.stringify(m)}`);
}

await waitForDeployment();
const manifest=JSON.parse(await fetchText('/seo-manifest.json'));
const data=JSON.parse(await fetchText('/resumenes.json'));
assert(Array.isArray(data)&&data.length>0,'Producción: resumenes.json está vacío o no es una lista');
const expectedCount=data.length;
const newest=[...data].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))[0];
const ids=Object.keys(manifest).sort((a,b)=>Number(a)-Number(b));
const dataIds=new Set(data.map(item=>String(item.id)));
const manifestIds=new Set(ids);
const missing=[...dataIds].filter(id=>!manifestIds.has(id));
const extra=[...manifestIds].filter(id=>!dataIds.has(id));
assert(ids.length===expectedCount,`Producción: manifest=${ids.length} y resumenes.json=${expectedCount}`);
assert(missing.length===0&&extra.length===0,`Producción: IDs desalineados; faltan=${missing.join(',')||'ninguno'} extras=${extra.join(',')||'ninguno'}`);
const entry=manifest[ids[0]];
assert(entry?.path,'Producción: manifiesto sin primera ruta canónica');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/?qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-home',{timeout:15000});
  await page.waitForSelector('.rt-orbit',{timeout:15000});
  await page.waitForSelector('.rt-explorer-stage',{timeout:15000});
  await page.waitForFunction(expected=>document.querySelectorAll('#indice .fila').length>=expected,expectedCount,{timeout:15000});
  assert(await page.locator('.seo-hubs-home').count()===0,'Producción: persisten botones inferiores duplicados');
  assert(await page.locator('.rt-editorial-prelude').count()===0,'Producción: persiste segundo bloque Explora/Interpreta/Conserva');
  assert(await page.locator('.rt-step small').count()===0,'Producción: persiste numeración de pasos');
  assert(await page.locator('.rt-hero-actions a').count()===1,'Producción: el héroe conserva botones redundantes');

  const heroCta=page.locator('.rt-hero-cta[href="#biblioteca-clinica"]');
  await heroCta.click();
  await page.waitForTimeout(400);
  assert(await page.evaluate(()=>scrollY>100),'Producción: CTA Explora no desplaza a la biblioteca');
  await page.evaluate(()=>scrollTo(0,0));

  const search=page.locator('#q');
  const uniqueSearch=String(newest.doi||newest.titulo||'').trim();
  assert(uniqueSearch,'Producción: no hay término único disponible para probar el buscador');
  await search.fill(uniqueSearch);
  await page.waitForFunction(()=>document.querySelectorAll('#indice .fila').length===1,{timeout:15000});
  await page.waitForTimeout(80);
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Producción: el destacado desaparece al filtrar');
  await search.fill('');
  await page.waitForFunction(expected=>document.querySelectorAll('#indice .fila').length>=expected,expectedCount,{timeout:15000});
  await page.waitForTimeout(80);
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Producción: falta ensayo destacado tras re-render completo');

  const account=page.locator('.topbar .top-links #account-entry');
  await account.waitFor({state:'visible',timeout:15000});
  const accountText=(await account.innerText()).trim();
  assert(accountText==='Entrar o crear cuenta'||accountText==='Mi cuenta',`Producción: CTA de cuenta inesperado: ${accountText}`);
  const year=page.locator('.grupo-anio .anio-num').first();
  assert(await year.isVisible(),'Producción: año no visible en el explorador');
  assert((await year.innerText()).trim()===String(newest.anio),'Producción: año más reciente no coincide con los datos');
  const source=page.locator('.fila .fuente').first();
  assert(await source.isVisible(),'Producción: revista/fuente no visible');
  assert((await source.innerText()).includes(newest.revista),`Producción: la revista ${newest.revista} no aparece en la primera ficha`);
  await noOverflow(page,'Producción portada desktop');

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await noOverflow(page,'Producción portada móvil');
  assert(await page.locator('#q').isVisible(),'Producción móvil: búsqueda clínica no visible');
  assert(await account.isVisible(),'Producción móvil: CTA de cuenta no visible');
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Producción móvil: falta trial destacado');

  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${BASE}${entry.path}?qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-trial',{timeout:15000});
  await page.waitForSelector('.rt-reader-rail',{timeout:15000});
  assert(await page.locator('.rt-summary-deck').count()===0,'Producción trial: persiste Resumen editorial');
  assert(await page.locator('.rt-reader-rail .rt-rail-card').filter({hasText:'Hallazgo clave'}).count()===0,'Producción trial: persiste Hallazgo clave');
  assert(await page.locator('.rt-evidence-section[data-index]').count()===0,'Producción trial: persiste numeración de secciones');
  assert(await page.locator('.rt-save-action').isVisible(),'Producción trial: guardar en biblioteca no visible');
  const type=await page.locator('.rt-evidence-section p').first().evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),align:getComputedStyle(el).textAlign}));
  assert(type.size>=17,`Producción trial: cuerpo pequeño (${type.size}px)`);
  assert(type.align==='justify',`Producción trial: cuerpo no justificado (${type.align})`);
  await noOverflow(page,'Producción trial desktop');

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await noOverflow(page,'Producción trial móvil');

  const trialId=ids[0];
  const shortHtml=await fetchText(`/resumen.html?id=${trialId}&v=corto`);
  if(shortHtml.includes('data-pdf-version="breve"')){
    await page.goto(`${BASE}/resumen.html?id=${trialId}&v=corto&qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('body.rt-future-legacy',{timeout:15000});
    await page.waitForSelector('[data-pdf-version="breve"]',{state:'visible',timeout:15000});
    const shortType=await page.locator('article.corto p').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    assert(shortType>=17,`Producción resumen breve: cuerpo pequeño (${shortType}px)`);
    await noOverflow(page,'Producción resumen breve');
  }

  const pdfContact=await fetchText('/pdf-contact.js');
  const trialPdf=await fetchText('/trial-pdf.js');
  for(const [label,sourceText] of [['pdf-contact.js',pdfContact],['trial-pdf.js',trialPdf]]){
    assert(sourceText.includes('@resumenestrials'),`Producción ${label}: falta X`);
    assert(sourceText.includes('@ResumenesTrials'),`Producción ${label}: falta Telegram`);
  }

  await page.setViewportSize({width:1280,height:900});
  await page.goto(`${BASE}/login.html?qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-account',{timeout:15000});
  assert(await page.locator('#login').isVisible(),'Producción: login no visible');
  await noOverflow(page,'Producción login');

  assert(errors.length===0,`Producción: errores JavaScript: ${errors.join(' | ')}`);
  console.log(`FUTURE PRODUCTION STRICT PASS · ${ids.length} trials · UX v3 · lector simplificado · ${entry.path}`);
}finally{await browser.close()}
