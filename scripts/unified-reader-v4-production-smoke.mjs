import { chromium } from 'playwright';

const BASE='https://resumenestrials.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function assert(v,m){if(!v)throw new Error(m)}
async function fetchText(path){
  const sep=path.includes('?')?'&':'?';
  const r=await fetch(`${BASE}${path}${sep}qa=${Date.now()}`,{headers:{'Cache-Control':'no-cache','User-Agent':'Resúmenes-Trials-Reader-V4-QA/1.0'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
}
async function waitForV4(){
  let last='';
  for(let i=1;i<=32;i++){
    try{
      const [html,js]=await Promise.all([fetchText('/'),fetchText('/future-experience-fix-v4.js')]);
      if(html.includes('/future-experience-fix-v4.js?v=1')&&js.includes('rt-unified-reader-v4')){
        console.log(`READER V4 DEPLOYMENT READY · intento ${i}`);return;
      }
      last=`html=${html.includes('/future-experience-fix-v4.js?v=1')} js=${js.includes('rt-unified-reader-v4')}`;
    }catch(e){last=e.message}
    console.log(`Esperando lector v4 (${i}/32) · ${last}`);
    await sleep(15000);
  }
  throw new Error(`Lector v4 no desplegado: ${last}`);
}
async function noOverflow(page,label){
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(d.scroll<=d.client+2&&d.body<=d.client+2,`${label}: overflow ${JSON.stringify(d)}`);
}
async function noNavOverlap(page,label){
  const b=await page.evaluate(()=>{
    const get=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}};
    return [get('.rt-brand'),get('.rt-main-nav'),get('.rt-nav-actions')].filter(Boolean);
  });
  for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++){
    const ox=Math.min(b[i].right,b[j].right)-Math.max(b[i].x,b[j].x);
    const oy=Math.min(b[i].bottom,b[j].bottom)-Math.max(b[i].y,b[j].y);
    assert(!(ox>3&&oy>3),`${label}: navegación superpuesta ${JSON.stringify({a:b[i],b:b[j]})}`);
  }
}

await waitForV4();
const [data,manifest]=await Promise.all([fetchText('/resumenes.json').then(JSON.parse),fetchText('/seo-manifest.json').then(JSON.parse)]);
const sample=data.find(x=>x.corto&&manifest[String(x.id)]?.path);
assert(sample,'Producción: no hay trial con resumen breve');
const path=manifest[String(sample.id)].path;
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));

  await page.goto(`${BASE}/?qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#rt-unified-reader-v4',{timeout:15000});
  await noNavOverlap(page,'Producción portada');
  await noOverflow(page,'Producción portada');
  const home=await page.evaluate(()=>({nav:parseFloat(getComputedStyle(document.querySelector('.rt-main-nav a')).fontSize),eyebrow:parseFloat(getComputedStyle(document.querySelector('.rt-hero-eyebrow')).fontSize),body:parseFloat(getComputedStyle(document.querySelector('.bajada-cols')).fontSize)}));
  assert(home.nav>=15&&home.eyebrow>=13.5&&home.body>=19,`Producción portada: tipografía insuficiente ${JSON.stringify(home)}`);

  await page.goto(`${BASE}${path}?qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.rt-evidence-section p',{timeout:15000});
  await page.waitForSelector('#rt-unified-reader-v4',{timeout:15000});
  await noNavOverlap(page,'Producción completo');
  await noOverflow(page,'Producción completo');
  const full=await page.evaluate(()=>({p:parseFloat(getComputedStyle(document.querySelector('.rt-evidence-section p')).fontSize),h2:parseFloat(getComputedStyle(document.querySelector('.rt-evidence-section h2')).fontSize)}));
  assert(full.p>=20.5&&full.h2>=30,`Producción completo: tipografía insuficiente ${JSON.stringify(full)}`);

  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto&qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('article.corto p',{timeout:15000});
  await page.waitForSelector('.rt-reader-rail[data-v4="1"]',{timeout:15000});
  await page.waitForSelector('#rt-unified-reader-v4',{timeout:15000});
  await noNavOverlap(page,'Producción breve');
  await noOverflow(page,'Producción breve');
  const brief=await page.evaluate(()=>({p:parseFloat(getComputedStyle(document.querySelector('article.corto p')).fontSize),h2:parseFloat(getComputedStyle(document.querySelector('article.corto h2')).fontSize),max:getComputedStyle(document.querySelector('#contenido>.envoltorio')).maxWidth}));
  assert(brief.p>=20.5&&brief.h2>=30,`Producción breve: tipografía insuficiente ${JSON.stringify(brief)}`);
  assert(Math.abs(brief.p-full.p)<=0.6&&Math.abs(brief.h2-full.h2)<=1.1,`Producción breve/completo no uniformes: ${JSON.stringify({full,brief})}`);
  assert(brief.max!=='820px','Producción breve conserva ancho antiguo');

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  await noOverflow(page,'Producción breve móvil');
  const briefMobile=await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('article.corto p')).fontSize));
  assert(briefMobile>=18.5,`Producción breve móvil: fuente pequeña ${briefMobile}px`);

  assert(errors.length===0,`Producción v4: errores JS ${errors.join(' | ')}`);
  console.log(`UNIFIED READER V4 PRODUCTION PASS · trial ${sample.id} · completo ${full.p}px · breve ${brief.p}px`);
}finally{await browser.close()}
