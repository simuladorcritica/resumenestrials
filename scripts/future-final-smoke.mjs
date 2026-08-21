import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const home=readFileSync('_includes/index-source.html','utf8');
const originalIndex=readFileSync('index.html','utf8');
process.once('exit',()=>writeFileSync('index.html',originalIndex,'utf8'));
writeFileSync('index.html',home,'utf8');

function assert(value,message){if(!value)throw new Error(message)}

const newest=[...data].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''))[0];
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));

  await page.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-home',{timeout:10000});
  const account=page.locator('.topbar .top-links #account-entry');
  await account.waitFor({state:'visible',timeout:10000});
  const accountText=(await account.innerText()).trim();
  assert(accountText==='Entrar o crear cuenta'||accountText==='Mi cuenta',`Portada: CTA de cuenta inesperado: ${accountText}`);

  await page.waitForFunction((expected)=>document.querySelectorAll('#indice .fila').length>=expected,data.length,{timeout:10000});
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Portada: debe existir exactamente un trial destacado después de cargar datos');

  // Fuerza el mismo re-render interno sin volver visible el buscador local que se retiró de la interfaz.
  const search=page.locator('#q');
  await search.evaluate((el)=>{el.value='ARISE';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForFunction(()=>document.querySelectorAll('#indice .fila').length===1,{timeout:10000});
  await page.waitForTimeout(50);
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Portada: el trial destacado se perdió tras filtrar');
  await search.evaluate((el)=>{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.waitForFunction((expected)=>document.querySelectorAll('#indice .fila').length>=expected,data.length,{timeout:10000});
  await page.waitForTimeout(50);
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Portada: el trial destacado se perdió tras restaurar el índice');

  const year=page.locator('.grupo-anio .anio-num').first();
  assert(await year.isVisible(),'Portada: el año no es visible en el explorador');
  assert((await year.innerText()).trim()===String(newest.anio),'Portada: el año más reciente no coincide con los datos');

  const source=page.locator('.fila .fuente').first();
  assert(await source.isVisible(),'Portada: la revista/fuente no es visible');
  const sourceText=(await source.innerText()).trim();
  assert(sourceText.includes(newest.revista),`Portada: la revista ${newest.revista} no aparece en la primera ficha`);

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  assert(await account.isVisible(),'Portada móvil: CTA de cuenta no visible');
  assert(await page.locator('#indice .fila.rt-featured').count()===1,'Portada móvil: falta trial destacado');
  const widths=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert(widths.scroll<=widths.client+2,`Portada móvil: overflow ${JSON.stringify(widths)}`);

  assert(errors.length===0,`Errores JavaScript: ${errors.join(' | ')}`);
  console.log(`FINAL NAV PASS · cuenta visible · destacado persistente · año ${newest.anio} · revista ${newest.revista}`);
}finally{await browser.close()}
