import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const home=readFileSync('_includes/index-source.html','utf8');
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
  const widths=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert(widths.scroll<=widths.client+2,`Portada móvil: overflow ${JSON.stringify(widths)}`);

  assert(errors.length===0,`Errores JavaScript: ${errors.join(' | ')}`);
  console.log(`FINAL NAV PASS · cuenta visible · año ${newest.anio} · revista ${newest.revista}`);
}finally{await browser.close()}
