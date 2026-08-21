import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
writeFileSync('index.html',readFileSync('_includes/index-source.html','utf8'),'utf8');
mkdirSync('future-screenshots',{recursive:true});
const sample=data.find(x=>x.corto)||data[0];
const trial=manifest[String(sample.id)]?.path;
if(!trial)throw new Error('No se encontró trial para captura');

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  async function shot(url,name,selector){
    await page.goto(`${BASE}${url}`,{waitUntil:'domcontentloaded',timeout:25000});
    if(selector)await page.waitForSelector(selector,{timeout:12000});
    await page.waitForTimeout(700);
    await page.screenshot({path:`future-screenshots/${name}.png`,fullPage:true});
  }
  await shot('/index.html','01-home-desktop','.rt-explorer-stage');
  await shot(trial,'02-trial-desktop','.rt-reader-rail');
  if(sample.corto)await shot(`/resumen.html?id=${sample.id}&v=corto`,'03-resumen-breve-desktop','.rt-reader-rail[data-v4="1"]');
  await shot('/medicina-critica/','04-hub-desktop','body.rt-future-hub');
  await shot('/login.html','05-login-desktop','body.rt-future-account');
  await page.setViewportSize({width:390,height:844});
  await shot('/index.html','06-home-mobile','.rt-orbit');
  await shot(trial,'07-trial-mobile','.rt-evidence-section');
  if(sample.corto)await shot(`/resumen.html?id=${sample.id}&v=corto`,'08-resumen-breve-mobile','article.corto');
  console.log(`FUTURE VISUAL CAPTURE PASS · ${sample.corto?8:6} vistas`);
} finally {
  await browser.close();
}
