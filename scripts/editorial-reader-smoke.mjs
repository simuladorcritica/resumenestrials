import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.RT_BASE_URL||'http://127.0.0.1:8000';
const rows=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const browser=await chromium.launch({headless:true,...(process.env.RT_BROWSER_CHANNEL?{channel:process.env.RT_BROWSER_CHANNEL}:{})});
const results=[],ids=new Set([1,75,98,112,150]);
for(const key of ['titulo','autor','doi','revista'])ids.add([...rows].sort((a,b)=>String(b[key]||'').length-String(a[key]||'').length)[0].id);
const sizes=[[320,568],[360,800],[375,812],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080]];
try {
 const page=await browser.newPage();
 for(const id of ids)for(const path of [`/resumen.html?id=${id}`,`/resumen.html?id=${id}&v=corto`,manifest[String(id)].path]) {
  await page.goto(base+path);await page.locator('.ed-version').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
  for(const [width,height] of sizes) {
   await page.setViewportSize({width,height});
   await page.waitForTimeout(250);
   const m=await page.evaluate(()=>{
    const p=document.querySelector('article.articulo p'),article=p.closest('article'),rail=document.querySelector('.rt-reader-rail');
    const grid=document.body.classList.contains('rt-future-trial')?document.querySelector('main.envoltorio'):document.querySelector('#contenido > .envoltorio');
    const g=getComputedStyle(grid);
    return {scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,client:document.documentElement.clientWidth,title:document.querySelector('.art-head h1,header.art h1').textContent,align:getComputedStyle(p).textAlign,measure:p.getBoundingClientRect().width,active:document.querySelectorAll('.ed-version [aria-current="page"]').length,display:g.display,tracks:g.gridTemplateColumns.split(/\s+/).map(parseFloat),gap:parseFloat(g.columnGap),rail:rail.getBoundingClientRect().width,clipping:getComputedStyle(article).overflowX};
   });
   const label=`${path} ${width}: ${JSON.stringify(m)}`;
   assert.ok(m.scroll<=m.client&&m.body<=m.client,label);assert.equal(m.title,rows.find(r=>r.id===id).titulo);assert.equal(m.align,'left');assert.ok(m.measure<=741,label);assert.equal(m.active,1);assert.equal(m.display,'grid',label);assert.ok(!['hidden','clip'].includes(m.clipping),label);
   if(width>=1100){assert.equal(m.tracks.length,2,label);assert.ok(m.tracks[0]<=741&&m.tracks[1]>=199&&m.tracks[1]<=261,label);assert.ok(m.rail>=199&&m.rail<=261,label);assert.ok(Math.abs(m.gap-40)<=1,label)}else assert.equal(m.tracks.length,1,label);
   results.push({id,path,width,height,status:'PASS',...m});
  }
 }
 console.log(`Editorial reader/grid PASS: ${results.length} route/viewport checks`);
}finally{if(process.env.RT_REPORT_PATH)writeFileSync(process.env.RT_REPORT_PATH,JSON.stringify(results,null,2));await browser.close()}
