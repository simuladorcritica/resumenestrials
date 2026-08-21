import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const home=readFileSync('_includes/index-source.html','utf8');
writeFileSync('index.html',home,'utf8');

function assert(value,message){if(!value)throw new Error(message)}
async function noOverflow(page,label){
  const m=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth}));
  assert(m.sw<=m.w+2 && m.bw<=m.w+2,`${label}: overflow horizontal ${JSON.stringify(m)}`);
}
async function assertAsset(path){
  const r=await fetch(`${BASE}${path}`);assert(r.ok,`${path}: HTTP ${r.status}`);const text=await r.text();assert(text.length>100,`${path}: archivo vacío`);return text;
}
await assertAsset('/future-experience.css');
await assertAsset('/future-experience-patch.css');
await assertAsset('/future-experience.js');
await assertAsset('/global-search.css');
const globalSearch=await assertAsset('/global-search.js');
assert(globalSearch.includes('rt-global-search-input'),'Buscador global: falta implementación del campo interactivo');
const finalAsset=await assertAsset('/future-experience-final.js');
assert(finalAsset.includes('rt-final-polish-v3'),'Ajuste final: falta capa de legibilidad v3');
await assertAsset('/future-experience-fix-v4.js');
const trialPdf=await assertAsset('/trial-pdf.js');
const legacyPdf=await assertAsset('/pdf-contact.js');
for(const [label,source] of [['trial-pdf.js',trialPdf],['pdf-contact.js',legacyPdf]]){
  assert(source.includes('@resumenestrials'),`${label}: falta X`);
  assert(source.includes('@ResumenesTrials'),`${label}: falta Telegram`);
}

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));

  await page.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-home',{timeout:10000});
  await page.waitForFunction(()=>!!document.getElementById('rt-unified-reader-v4'),{timeout:10000});
  await page.waitForSelector('.rt-orbit',{timeout:10000});
  await page.waitForSelector('.rt-explorer-stage',{timeout:10000});
  await page.waitForFunction(()=>document.querySelectorAll('.rt-hero-actions a').length===1&&!document.querySelector('.rt-step small'),{timeout:10000});
  assert(await page.locator('.fila').count()>=data.length,`Portada: se esperaban al menos ${data.length} filas`);
  assert(await page.locator('.fila.rt-featured').count()===1,'Portada: falta trial destacado');
  assert(await page.locator('.rt-nav-search').isVisible(),'Portada: buscador global no visible');
  assert(await page.locator('.rt-global-search-input').isVisible(),'Portada: el buscador superior no es un campo funcional');
  assert(await page.locator('#q').isVisible(),'Portada: buscador clínico no visible');
  assert(await page.locator('.seo-hubs-home').count()===0,'Portada: quedan botones inferiores duplicados de metodología/equipo');
  assert(await page.locator('.rt-editorial-prelude').count()===0,'Portada: Explora/Interpreta/Conserva aparece duplicado');
  assert(await page.locator('.rt-step small').count()===0,'Portada: persiste numeración 01/02/03');
  assert(await page.locator('.rt-hero-actions a').count()===1,'Portada: debe conservarse un único CTA superior en el héroe');
  assert(await page.locator('.rt-main-nav a[href="/metodologia/"]').isVisible(),'Portada: Metodología superior debe conservarse');
  assert(await page.locator('.rt-main-nav a[href="/equipo-editorial/"]').isVisible(),'Portada: Equipo editorial superior debe conservarse');

  const globalInput=page.locator('.rt-global-search-input');
  const searchScrollBefore=await page.evaluate(()=>scrollY);
  await globalInput.fill('SOHO');
  await page.waitForSelector('.rt-global-search-result',{timeout:10000});
  const firstGlobalTitle=(await page.locator('.rt-global-search-result-title').first().innerText()).trim();
  assert(/SOHO/i.test(firstGlobalTitle),`Buscador global: SOHO no aparece primero (${firstGlobalTitle})`);
  const soho=data.find(x=>/^SOHO\b/i.test(x.titulo));
  const sohoPath=soho&&manifest[String(soho.id)]?.path;
  assert(sohoPath,'Buscador global: falta ruta canónica de SOHO');
  const firstGlobalHref=await page.locator('.rt-global-search-result').first().getAttribute('href');
  assert(firstGlobalHref===sohoPath,`Buscador global: ruta inesperada ${firstGlobalHref}`);
  const searchScrollAfter=await page.evaluate(()=>scrollY);
  assert(Math.abs(searchScrollAfter-searchScrollBefore)<20,'Buscador global: usar el campo superior desplazó al buscador inferior');
  await globalInput.press('Escape');
  assert(await page.locator('#rt-global-search-results').isHidden(),'Buscador global: Escape no cierra resultados');

  const heroBox=await page.locator('header.sitio .envoltorio').boundingBox();
  assert(heroBox && heroBox.x>20 && heroBox.x+heroBox.width<1420,'Portada: el héroe no quedó centrado dentro del viewport');
  const cta=page.locator('.rt-hero-cta[href="#biblioteca-clinica"]');
  const yBefore=await page.evaluate(()=>scrollY);
  await cta.click();
  await page.waitForTimeout(450);
  const yAfter=await page.evaluate(()=>scrollY);
  assert(yAfter>yBefore+100,'Portada: el botón Explora la biblioteca no desplaza al explorador');
  await page.evaluate(()=>scrollTo(0,0));
  await noOverflow(page,'Portada desktop');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert(await page.locator('.rt-orbit').isVisible(),'Portada móvil: experiencia visual no visible');
  assert(await page.locator('#q').isVisible(),'Portada móvil: búsqueda no visible');
  await noOverflow(page,'Portada móvil');

  const sample=data.find(x=>x.corto)||data[0];
  const trialPath=manifest[String(sample.id)]?.path;
  assert(trialPath,`No hay ruta canónica para ${sample.id}`);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-trial',{timeout:10000});
  await page.waitForFunction(()=>!!document.getElementById('rt-unified-reader-v4'),{timeout:10000});
  await page.waitForSelector('.rt-reader-rail',{timeout:10000});
  await page.waitForFunction(()=>{
    const finding=[...document.querySelectorAll('.rt-reader-rail .rt-rail-card h3')].some(h=>h.textContent.trim().toLowerCase()==='hallazgo clave');
    return !document.querySelector('.rt-summary-deck')&&!finding&&!document.querySelector('.rt-evidence-section[data-index]');
  },{timeout:10000});
  assert(await page.locator('.rt-global-search-input').isVisible(),'Trial: buscador global superior no funcional');
  const sectionCount=await page.locator('.rt-evidence-section').count();
  assert(sectionCount>=4,`Trial: solo ${sectionCount} secciones estructuradas`);
  assert(await page.locator('.rt-summary-deck').count()===0,'Trial: no debe existir Resumen editorial');
  assert(await page.locator('.rt-reader-rail .rt-rail-card').filter({hasText:'Hallazgo clave'}).count()===0,'Trial: persiste el recuadro Hallazgo clave');
  assert(await page.locator('.rt-evidence-section[data-index]').count()===0,'Trial: persiste numeración de secciones');
  assert(!(await page.locator('.rt-main-nav a[href="/metodologia/"]').isVisible()),'Trial: Metodología no debe repetirse fuera de la portada');
  assert(!(await page.locator('.rt-main-nav a[href="/equipo-editorial/"]').isVisible()),'Trial: Equipo editorial no debe repetirse fuera de la portada');
  assert(await page.locator(`[data-trial-download="${sample.id}"]`).isVisible(),'Trial: falta descarga completa');
  if(sample.corto)assert(await page.locator('.trial-action-brief').isVisible(),'Trial: falta acceso al resumen breve');
  assert(await page.locator('.rt-save-action').isVisible(),'Trial: falta guardar en biblioteca');
  const paragraph=page.locator('.rt-evidence-section p').first();
  const trialType=await paragraph.evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),align:getComputedStyle(el).textAlign}));
  assert(trialType.size>=17,`Trial: cuerpo demasiado pequeño (${trialType.size}px)`);
  assert(trialType.align==='justify',`Trial: texto completo no justificado (${trialType.align})`);
  const sectionLook=await page.locator('.rt-evidence-section').first().evaluate(el=>({bg:getComputedStyle(el).backgroundImage,radius:getComputedStyle(el).borderRadius}));
  assert(sectionLook.bg==='none',`Trial: el cuerpo completo conserva tarjetas visuales (${sectionLook.bg})`);
  assert(sectionLook.radius==='0px',`Trial: el cuerpo completo no coincide con la lectura breve (${sectionLook.radius})`);
  const strong=page.locator('.rt-evidence-section strong').first();
  if(await strong.count()){
    const mark=await strong.evaluate(el=>({bg:getComputedStyle(el).backgroundImage,deco:getComputedStyle(el).textDecorationLine}));
    assert(mark.bg==='none',`Trial: la marca conserva fondo que parece tachado (${mark.bg})`);
    assert(mark.deco.includes('underline'),'Trial: la marca clínica no usa subrayado limpio');
  }
  await noOverflow(page,'Trial desktop');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert(await page.locator('.rt-evidence-section').first().isVisible(),'Trial móvil: lectura clínica no visible');
  const trialMobileType=await paragraph.evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),align:getComputedStyle(el).textAlign}));
  const orderOk=await page.evaluate(()=>{
    const article=document.querySelector('article.articulo');
    return !!article?.nextElementSibling?.classList.contains('rt-reader-rail');
  });
  assert(orderOk,'Trial móvil: las herramientas interrumpen la lectura antes del resumen completo');
  await noOverflow(page,'Trial móvil');

  if(sample.corto){
    await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForSelector('body.rt-future-legacy',{timeout:10000});
    await page.waitForFunction(()=>!!document.getElementById('rt-unified-reader-v4'),{timeout:10000});
    await page.waitForSelector('[data-pdf-version="breve"]',{state:'visible',timeout:12000});
    assert(await page.locator('article.corto').isVisible(),'Resumen breve: artículo no visible');
    const shortType=await page.locator('article.corto p').first().evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),max:getComputedStyle(document.querySelector('.envoltorio')).maxWidth}));
    assert(shortType.size>=17,`Resumen breve: cuerpo demasiado pequeño (${shortType.size}px)`);
    assert(Math.abs(shortType.size-trialMobileType.size)<=1,`Resumen breve/completo móvil: tipografías desalineadas (${shortType.size}px vs ${trialMobileType.size}px)`);
    assert(shortType.max!=='820px','Resumen breve: conserva ancho distinto al resumen completo');
    await noOverflow(page,'Resumen breve móvil');
  }

  await page.setViewportSize({width:1280,height:900});
  await page.goto(`${BASE}/medicina-critica/`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-hub',{timeout:10000});
  assert(await page.locator('.cluster-card').count()>=3,'Hub: faltan colecciones clínicas');
  assert(await page.locator('.cat-card').count()>=5,'Hub: faltan trials');
  assert(await page.locator('.rt-global-search-input').isVisible(),'Hub: buscador global superior no funcional');
  const catIndex=await page.locator('.cat-card').first().evaluate(el=>getComputedStyle(el,'::before').content);
  assert(catIndex==='none'||catIndex==='""',`Hub: persiste numeración decorativa (${catIndex})`);
  const hubSearch=page.locator('.rt-global-search-input');
  await hubSearch.fill('ARISE FLUIDS');
  await page.waitForSelector('.rt-global-search-result',{timeout:10000});
  const arise=data.find(x=>/^ARISE FLUIDS\b/i.test(x.titulo));
  const arisePath=arise&&manifest[String(arise.id)]?.path;
  assert(arisePath,'Hub: falta ruta canónica de ARISE FLUIDS');
  assert((await page.locator('.rt-global-search-result').first().getAttribute('href'))===arisePath,'Hub: el buscador global no resuelve ARISE FLUIDS');
  await noOverflow(page,'Hub');

  await page.goto(`${BASE}/login.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-account',{timeout:10000});
  assert(await page.locator('#login').isVisible(),'Login: formulario no visible');
  assert(await page.locator('#identifier').isVisible(),'Login: identificador no visible');
  assert(await page.locator('.rt-global-search-input').isVisible(),'Login: buscador global superior no funcional');
  await noOverflow(page,'Login');

  await page.goto(`${BASE}/registro.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-account',{timeout:10000});
  assert(await page.locator('form').first().isVisible(),'Registro: formulario no visible');
  assert(await page.locator('.rt-global-search-input').isVisible(),'Registro: buscador global superior no funcional');
  const mailNote=(await page.locator('.mail-note').textContent()).toLowerCase();
  assert(mailNote.includes('spam')&&mailNote.includes('correo no deseado'),'Registro: el estado exitoso no advierte revisar Spam y Correo no deseado');
  assert(await page.locator('#exito').count()===1,'Registro: falta estado de confirmación exitoso');
  await noOverflow(page,'Registro');

  assert(pageErrors.length===0,`Errores JavaScript detectados: ${pageErrors.join(' | ')}`);
  console.log(`FUTURE EXPERIENCE PASS · buscador global funcional · ${data.length} resúmenes · trial ${sample.id} · ${sectionCount} secciones`);
} finally {
  await browser.close();
}