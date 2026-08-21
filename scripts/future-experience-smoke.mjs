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
const finalAsset=await assertAsset('/future-experience-final.js');
assert(finalAsset.includes('rt-final-polish-v3'),'Ajuste final: falta capa de legibilidad v3');
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
  await page.waitForSelector('.rt-orbit',{timeout:10000});
  await page.waitForSelector('.rt-explorer-stage',{timeout:10000});
  await page.waitForFunction(()=>document.querySelectorAll('.rt-hero-actions a').length===1&&!document.querySelector('.rt-step small'),{timeout:10000});
  assert(await page.locator('.fila').count()>=data.length,`Portada: se esperaban al menos ${data.length} filas`);
  assert(await page.locator('.fila.rt-featured').count()===1,'Portada: falta trial destacado');
  assert(await page.locator('.rt-nav-search').isVisible(),'Portada: buscador global no visible');
  assert(await page.locator('#q').isVisible(),'Portada: buscador clínico no visible');
  assert(await page.locator('.seo-hubs-home').count()===0,'Portada: quedan botones inferiores duplicados de metodología/equipo');
  assert(await page.locator('.rt-editorial-prelude').count()===0,'Portada: Explora/Interpreta/Conserva aparece duplicado');
  assert(await page.locator('.rt-step small').count()===0,'Portada: persiste numeración 01/02/03');
  assert(await page.locator('.rt-hero-actions a').count()===1,'Portada: debe conservarse un único CTA superior en el héroe');

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
  await page.waitForSelector('.rt-reader-rail',{timeout:10000});
  await page.waitForFunction(()=>{
    const finding=[...document.querySelectorAll('.rt-reader-rail .rt-rail-card h3')].some(h=>h.textContent.trim().toLowerCase()==='hallazgo clave');
    return !document.querySelector('.rt-summary-deck')&&!finding&&!document.querySelector('.rt-evidence-section[data-index]');
  },{timeout:10000});
  const sectionCount=await page.locator('.rt-evidence-section').count();
  assert(sectionCount>=4,`Trial: solo ${sectionCount} secciones estructuradas`);
  assert(await page.locator('.rt-summary-deck').count()===0,'Trial: no debe existir Resumen editorial');
  assert(await page.locator('.rt-reader-rail .rt-rail-card').filter({hasText:'Hallazgo clave'}).count()===0,'Trial: persiste el recuadro Hallazgo clave');
  assert(await page.locator('.rt-evidence-section[data-index]').count()===0,'Trial: persiste numeración de secciones');
  assert(await page.locator(`[data-trial-download="${sample.id}"]`).isVisible(),'Trial: falta descarga completa');
  if(sample.corto)assert(await page.locator('.trial-action-brief').isVisible(),'Trial: falta acceso al resumen breve');
  assert(await page.locator('.rt-save-action').isVisible(),'Trial: falta guardar en biblioteca');
  const paragraph=page.locator('.rt-evidence-section p').first();
  const trialType=await paragraph.evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),align:getComputedStyle(el).textAlign}));
  assert(trialType.size>=17,`Trial: cuerpo demasiado pequeño (${trialType.size}px)`);
  assert(trialType.align==='justify',`Trial: texto completo no justificado (${trialType.align})`);
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
  await noOverflow(page,'Trial móvil');

  if(sample.corto){
    await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForSelector('body.rt-future-legacy',{timeout:10000});
    await page.waitForSelector('[data-pdf-version="breve"]',{state:'visible',timeout:12000});
    assert(await page.locator('article.corto').isVisible(),'Resumen breve: artículo no visible');
    const shortType=await page.locator('article.corto p').first().evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),max:getComputedStyle(document.querySelector('.envoltorio')).maxWidth}));
    assert(shortType.size>=17,`Resumen breve: cuerpo demasiado pequeño (${shortType.size}px)`);
    assert(shortType.max!=='820px','Resumen breve: conserva ancho distinto al resumen completo');
    await noOverflow(page,'Resumen breve móvil');
  }

  await page.setViewportSize({width:1280,height:900});
  await page.goto(`${BASE}/medicina-critica/`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-hub',{timeout:10000});
  assert(await page.locator('.cluster-card').count()>=3,'Hub: faltan colecciones clínicas');
  assert(await page.locator('.cat-card').count()>=5,'Hub: faltan trials');
  await noOverflow(page,'Hub');

  await page.goto(`${BASE}/login.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-account',{timeout:10000});
  assert(await page.locator('#login').isVisible(),'Login: formulario no visible');
  assert(await page.locator('#identifier').isVisible(),'Login: identificador no visible');
  await noOverflow(page,'Login');

  await page.goto(`${BASE}/registro.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-account',{timeout:10000});
  assert(await page.locator('form').first().isVisible(),'Registro: formulario no visible');
  const mailNote=(await page.locator('.mail-note').textContent()).toLowerCase();
  assert(mailNote.includes('spam')&&mailNote.includes('correo no deseado'),'Registro: el estado exitoso no advierte revisar Spam y Correo no deseado');
  assert(await page.locator('#exito').count()===1,'Registro: falta estado de confirmación exitoso');
  await noOverflow(page,'Registro');

  assert(pageErrors.length===0,`Errores JavaScript detectados: ${pageErrors.join(' | ')}`);
  console.log(`FUTURE EXPERIENCE PASS · ${data.length} resúmenes · trial ${sample.id} · ${sectionCount} secciones · lector simplificado`);
} finally {
  await browser.close();
}
