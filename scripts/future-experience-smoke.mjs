import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const home=readFileSync('_includes/index-source.html','utf8');
writeFileSync('future-home-smoke.html',home,'utf8');

function assert(value,message){if(!value)throw new Error(message)}
async function noOverflow(page,label){
  const m=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth}));
  assert(m.sw<=m.w+2 && m.bw<=m.w+2,`${label}: overflow horizontal ${JSON.stringify(m)}`);
}
async function assertAsset(path){
  const r=await fetch(`${BASE}${path}`);assert(r.ok,`${path}: HTTP ${r.status}`);const text=await r.text();assert(text.length>100,`${path}: archivo vacío`);
}
await assertAsset('/future-experience.css');
await assertAsset('/future-experience-patch.css');
await assertAsset('/future-experience.js');

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));

  await page.goto(`${BASE}/future-home-smoke.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-home',{timeout:10000});
  await page.waitForSelector('.rt-orbit',{timeout:10000});
  await page.waitForSelector('.rt-explorer-stage',{timeout:10000});
  assert(await page.locator('.fila').count()>=data.length,`Portada: se esperaban al menos ${data.length} filas`);
  assert(await page.locator('.fila.rt-featured').count()===1,'Portada: falta trial destacado');
  assert(await page.locator('.rt-nav-search').isVisible(),'Portada: buscador global no visible');
  assert(await page.locator('#q').isVisible(),'Portada: buscador clínico no visible');
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
  await page.waitForSelector('.rt-summary-deck',{timeout:10000});
  await page.waitForSelector('.rt-reader-rail',{timeout:10000});
  const sectionCount=await page.locator('.rt-evidence-section').count();
  assert(sectionCount>=4,`Trial: solo ${sectionCount} secciones estructuradas`);
  assert(await page.locator('.rt-summary-card').count()===4,'Trial: el resumen editorial no tiene 4 módulos');
  assert(await page.locator(`[data-trial-download="${sample.id}"]`).isVisible(),'Trial: falta descarga completa');
  if(sample.corto)assert(await page.locator('.trial-action-brief').isVisible(),'Trial: falta acceso al resumen breve');
  assert(await page.locator('.rt-save-action').isVisible(),'Trial: falta guardar en biblioteca');
  await noOverflow(page,'Trial desktop');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);
  assert(await page.locator('.rt-summary-card').first().isVisible(),'Trial móvil: módulos editoriales no visibles');
  await noOverflow(page,'Trial móvil');

  if(sample.corto){
    await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForSelector('body.rt-future-legacy',{timeout:10000});
    await page.waitForSelector('[data-pdf-version="breve"]',{state:'visible',timeout:12000});
    assert(await page.locator('article.corto').isVisible(),'Resumen breve: artículo no visible');
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
  const text=(await page.locator('body').innerText()).toLowerCase();
  assert(text.includes('spam')||text.includes('correo no deseado'),'Registro: falta aviso para revisar Spam/correo no deseado');
  await noOverflow(page,'Registro');

  assert(pageErrors.length===0,`Errores JavaScript detectados: ${pageErrors.join(' | ')}`);
  console.log(`FUTURE EXPERIENCE PASS · ${data.length} resúmenes · trial ${sample.id} · ${sectionCount} secciones`);
} finally {
  await browser.close();
}
