import { chromium } from 'playwright';

const BASE=(process.env.RT_BASE_URL||'https://resumenestrials.com').replace(/\/$/,'');
const RUNTIME_CSS='/site-runtime.css?v=20260821';
const RUNTIME_JS='/site-runtime.js?v=20260821';
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
      const [css,js]=await Promise.all([fetchText('/site-runtime.css'),fetchText('/site-runtime.js')]);
      const htmlOk=html.includes(RUNTIME_CSS)&&html.includes(RUNTIME_JS);
      const cssOk=css.includes('.rt-future-home')&&css.includes('.rt-future-trial');
      const jsOk=['rt-final-polish-v3','rt-unified-reader-v4','rt-global-search-input'].every(marker=>js.includes(marker));
      if(htmlOk&&cssOk&&jsOk){console.log(`FUTURE DEPLOYMENT READY · intento ${i}`);return;}
      last=`runtime-html=${htmlOk} runtime-css=${cssOk} runtime-js=${jsOk}`;
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
async function waitV4(page){await page.waitForFunction(()=>!!document.getElementById('rt-unified-reader-v4'),{timeout:15000})}

await waitForDeployment();
const manifest=JSON.parse(await fetchText('/seo-manifest.json'));
const data=JSON.parse(await fetchText('/resumenes.json'));
assert(Array.isArray(data)&&data.length>0,'Producción: resumenes.json está vacío o no es una lista');
const expectedCount=data.length;
// Legacy bibliographic dates may be human-readable Spanish strings. Sort by
// the explicit publication year first, then use ISO dates only as a tiebreaker.
const iso=(value)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):'';
const newest=[...data].sort((a,b)=>(Number(b.anio)||0)-(Number(a.anio)||0)||iso(b.fecha).localeCompare(iso(a.fecha)))[0];
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
  await waitV4(page);
  await page.waitForSelector('.rt-orbit',{timeout:15000});
  await page.waitForSelector('.rt-explorer-stage',{timeout:15000});
  await page.waitForFunction(expected=>document.querySelectorAll('#indice .fila').length>=expected,expectedCount,{timeout:15000});
  assert(await page.locator('.seo-hubs-home').count()===0,'Producción: persisten botones inferiores duplicados');
  assert(await page.locator('.rt-editorial-prelude').count()===0,'Producción: persiste segundo bloque Explora/Interpreta/Conserva');
  assert(await page.locator('.rt-step small').count()===0,'Producción: persiste numeración de pasos');
  assert(await page.locator('.rt-hero-actions a').count()===1,'Producción: el héroe conserva botones redundantes');
  assert(await page.locator('.rt-main-nav a[href="/metodologia/"]').isVisible(),'Producción portada: falta Metodología superior');
  assert(await page.locator('.rt-main-nav a[href="/equipo-editorial/"]').isVisible(),'Producción portada: falta Equipo editorial superior');

  const heroCta=page.locator('.rt-hero-cta[href="#biblioteca-clinica"]');
  await heroCta.click();
  await page.waitForTimeout(400);
  assert(await page.evaluate(()=>scrollY>100),'Producción: CTA Explora no desplaza a la biblioteca');
  await page.evaluate(()=>scrollTo(0,0));

  const search=page.locator('.rt-global-search-input');
  await search.waitFor({state:'visible',timeout:15000});
  assert(!(await page.locator('#q').isVisible()),'Producción: el buscador redundante del índice sigue visible');
  const searchSample=data.find(item=>/^SOHO\b/i.test(item.titulo))||newest;
  const uniqueSearch=String(searchSample.titulo||'').trim().split(/\s+/)[0];
  const expectedSearchPath=manifest[String(searchSample.id)]?.path;
  assert(uniqueSearch&&expectedSearchPath,'Producción: no hay término o ruta canónica para probar el buscador global');
  await search.fill(uniqueSearch);
  await page.waitForSelector('.rt-global-search-result',{timeout:15000});
  const firstSearchResult=page.locator('.rt-global-search-result').first();
  assert(await firstSearchResult.getAttribute('href')===expectedSearchPath,`Producción: ruta inesperada en búsqueda global para ${uniqueSearch}`);
  await search.press('Escape');
  assert(await page.locator('#rt-global-search-results').isHidden(),'Producción: Escape no cierra los resultados globales');
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Producción: falta ensayo destacado tras usar el buscador global');

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
  assert(await page.locator('.rt-global-search-input').isVisible(),'Producción móvil: búsqueda clínica global no visible');
  assert(!(await page.locator('#q').isVisible()),'Producción móvil: el buscador redundante del índice sigue visible');
  assert(await account.isVisible(),'Producción móvil: CTA de cuenta no visible');
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Producción móvil: falta trial destacado');

  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${BASE}${entry.path}?qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-trial',{timeout:15000});
  await waitV4(page);
  await page.waitForSelector('.rt-reader-rail',{timeout:15000});
  await page.waitForFunction(()=>!document.querySelector('.rt-summary-deck')&&!document.querySelector('.rt-evidence-section[data-index]'),{timeout:15000});
  assert(await page.locator('.rt-summary-deck').count()===0,'Producción trial: persiste Resumen editorial');
  assert(await page.locator('.rt-reader-rail .rt-rail-card').filter({hasText:'Hallazgo clave'}).count()===0,'Producción trial: persiste Hallazgo clave');
  assert(await page.locator('.rt-evidence-section[data-index]').count()===0,'Producción trial: persiste numeración de secciones');
  assert(!(await page.locator('.rt-main-nav a[href="/metodologia/"]').isVisible()),'Producción trial: Metodología se repite fuera de portada');
  assert(!(await page.locator('.rt-main-nav a[href="/equipo-editorial/"]').isVisible()),'Producción trial: Equipo editorial se repite fuera de portada');
  assert(await page.locator('.rt-save-action').isVisible(),'Producción trial: guardar en biblioteca no visible');
  const type=await page.locator('.rt-evidence-section p').first().evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),align:getComputedStyle(el).textAlign}));
  assert(type.size>=17,`Producción trial: cuerpo pequeño (${type.size}px)`);
  assert(type.align==='justify',`Producción trial: cuerpo no justificado (${type.align})`);
  const sectionLook=await page.locator('.rt-evidence-section').first().evaluate(el=>({bg:getComputedStyle(el).backgroundImage,radius:getComputedStyle(el).borderRadius}));
  assert(sectionLook.bg==='none'&&sectionLook.radius==='0px',`Producción trial: formato completo no coincide con breve (${sectionLook.bg}, ${sectionLook.radius})`);
  await noOverflow(page,'Producción trial desktop');

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  const orderOk=await page.evaluate(()=>document.querySelector('article.articulo')?.nextElementSibling?.classList.contains('rt-reader-rail')===true);
  assert(orderOk,'Producción trial móvil: herramientas interrumpen la lectura completa');
  const typeMobile=await page.locator('.rt-evidence-section p').first().evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),align:getComputedStyle(el).textAlign}));
  await noOverflow(page,'Producción trial móvil');

  const trialId=ids[0];
  const shortHtml=await fetchText(`/resumen.html?id=${trialId}&v=corto`);
  if(shortHtml.includes('data-pdf-version="breve"')){
    await page.goto(`${BASE}/resumen.html?id=${trialId}&v=corto&qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('body.rt-future-legacy',{timeout:15000});
    await waitV4(page);
    await page.waitForSelector('[data-pdf-version="breve"]',{state:'visible',timeout:15000});
    const shortType=await page.locator('article.corto p').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    assert(shortType>=17,`Producción resumen breve: cuerpo pequeño (${shortType}px)`);
    assert(Math.abs(shortType-typeMobile.size)<=1,`Producción breve/completo móvil: tipografías desalineadas (${shortType}px vs ${typeMobile.size}px)`);
    await noOverflow(page,'Producción resumen breve');
  }

  await page.setViewportSize({width:1280,height:900});
  await page.goto(`${BASE}/medicina-critica/?qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-hub',{timeout:15000});
  const catIndex=await page.locator('.cat-card').first().evaluate(el=>getComputedStyle(el,'::before').content);
  assert(catIndex==='none'||catIndex==='""',`Producción hub: persiste numeración decorativa (${catIndex})`);
  await noOverflow(page,'Producción hub');

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
  console.log(`FUTURE PRODUCTION STRICT PASS · ${ids.length} trials · UX v4 · lector uniforme · ${entry.path}`);
}finally{await browser.close()}
