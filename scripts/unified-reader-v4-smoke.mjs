import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
writeFileSync('index.html',readFileSync('_includes/index-source.html','utf8'),'utf8');

function assert(v,m){if(!v)throw new Error(m)}
async function noOverflow(page,label){
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(d.scroll<=d.client+2&&d.body<=d.client+2,`${label}: overflow ${JSON.stringify(d)}`);
}
async function navDoesNotOverlap(page,label){
  const info=await page.evaluate(()=>{
    const pick=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
    return {brand:pick('.rt-brand'),nav:pick('.rt-main-nav'),actions:pick('.rt-nav-actions')};
  });
  const boxes=Object.entries(info).filter(([,v])=>v);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const [an,a]=boxes[i],[bn,b]=boxes[j];
    const overlapX=Math.min(a.right,b.right)-Math.max(a.x,b.x);
    const overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
    assert(!(overlapX>3&&overlapY>3),`${label}: ${an} se superpone con ${bn}: ${JSON.stringify({a,b})}`);
  }
}
async function waitV4(page){await page.waitForFunction(()=>!!document.getElementById('rt-unified-reader-v4'),{timeout:10000})}

const sample=data.find(x=>x.corto&&manifest[String(x.id)]?.path);
assert(sample,'No existe trial con resumen breve para QA');
const trialPath=manifest[String(sample.id)].path;
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));

  await page.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await waitV4(page);
  await page.waitForSelector('.rt-nav-actions',{timeout:10000});
  await navDoesNotOverlap(page,'Portada desktop');
  await noOverflow(page,'Portada desktop');
  const homeType=await page.evaluate(()=>({nav:parseFloat(getComputedStyle(document.querySelector('.rt-main-nav a')).fontSize),eyebrow:parseFloat(getComputedStyle(document.querySelector('.rt-hero-eyebrow')).fontSize),body:parseFloat(getComputedStyle(document.querySelector('.bajada-cols')).fontSize)}));
  assert(homeType.nav>=15,`Portada: navegación aún pequeña (${homeType.nav}px)`);
  assert(homeType.eyebrow>=13.5,`Portada: microtipografía aún pequeña (${homeType.eyebrow}px)`);
  assert(homeType.body>=19,`Portada: cuerpo aún pequeño (${homeType.body}px)`);

  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-trial',{timeout:10000});
  await page.waitForSelector('.rt-evidence-section p',{timeout:10000});
  await waitV4(page);
  await navDoesNotOverlap(page,'Trial completo desktop');
  await noOverflow(page,'Trial completo desktop');
  const fullType=await page.evaluate(()=>({p:parseFloat(getComputedStyle(document.querySelector('.rt-evidence-section p')).fontSize),h2:parseFloat(getComputedStyle(document.querySelector('.rt-evidence-section h2')).fontSize),meta:parseFloat(getComputedStyle(document.querySelector('.fuente')).fontSize)}));
  assert(fullType.p>=20.5,`Trial completo: cuerpo aún pequeño (${fullType.p}px)`);
  assert(fullType.h2>=30,`Trial completo: subtítulo aún pequeño (${fullType.h2}px)`);
  assert(fullType.meta>=15.5,`Trial completo: metadatos aún pequeños (${fullType.meta}px)`);

  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('body.rt-future-legacy',{timeout:10000});
  await page.waitForSelector('article.corto p',{timeout:12000});
  await waitV4(page);
  await page.waitForSelector('.rt-reader-rail[data-v4="1"]',{timeout:12000});
  await navDoesNotOverlap(page,'Resumen breve desktop');
  await noOverflow(page,'Resumen breve desktop');
  const shortType=await page.evaluate(()=>({p:parseFloat(getComputedStyle(document.querySelector('article.corto p')).fontSize),h2:parseFloat(getComputedStyle(document.querySelector('article.corto h2')).fontSize),max:getComputedStyle(document.querySelector('#contenido>.envoltorio')).maxWidth,cols:getComputedStyle(document.querySelector('#contenido>.envoltorio')).gridTemplateColumns}));
  assert(shortType.p>=20.5,`Resumen breve: cuerpo aún pequeño (${shortType.p}px)`);
  assert(shortType.h2>=30,`Resumen breve: subtítulo aún pequeño (${shortType.h2}px)`);
  assert(Math.abs(shortType.p-fullType.p)<=0.6,`Breve/completo: cuerpo desalineado (${shortType.p}px vs ${fullType.p}px)`);
  assert(Math.abs(shortType.h2-fullType.h2)<=1.1,`Breve/completo: subtítulos desalineados (${shortType.h2}px vs ${fullType.h2}px)`);
  assert(shortType.max!=='820px','Resumen breve: conserva el ancho antiguo de 820px');
  assert(shortType.cols!=='none','Resumen breve: no adoptó arquitectura de lector con rail');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(220);
  await noOverflow(page,'Resumen breve móvil');
  const shortMobile=await page.evaluate(()=>({p:parseFloat(getComputedStyle(document.querySelector('article.corto p')).fontSize),nav:parseFloat(getComputedStyle(document.querySelector('.rt-main-nav a')).fontSize)}));
  assert(shortMobile.p>=18.5,`Resumen breve móvil: cuerpo pequeño (${shortMobile.p}px)`);
  assert(shortMobile.nav>=14.5,`Resumen breve móvil: navegación pequeña (${shortMobile.nav}px)`);

  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector('.rt-evidence-section p',{timeout:10000});
  await waitV4(page);
  await page.waitForTimeout(160);
  await noOverflow(page,'Trial completo móvil');
  const fullMobile=await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.rt-evidence-section p')).fontSize));
  assert(fullMobile>=18.5,`Trial completo móvil: cuerpo pequeño (${fullMobile}px)`);
  assert(Math.abs(shortMobile.p-fullMobile)<=0.6,`Breve/completo móvil: cuerpo desalineado (${shortMobile.p}px vs ${fullMobile}px)`);

  assert(errors.length===0,`Errores JavaScript: ${errors.join(' | ')}`);
  console.log(`UNIFIED READER V4 PASS · trial ${sample.id} · completo ${fullType.p}px · breve ${shortType.p}px · móvil ${fullMobile}px · sin solapamientos`);
}finally{await browser.close()}
