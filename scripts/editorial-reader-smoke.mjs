import {chromium,webkit} from 'playwright';
import {isolate} from './design-browser-suites.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.RT_BASE_URL||'http://127.0.0.1:8000';
const rows=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const results=[],ids=new Set([1,75,98,112,150]);
for(const key of ['titulo','autor','doi','revista'])ids.add([...rows].sort((a,b)=>String(b[key]||'').length-String(a[key]||'').length)[0].id);
const sizes=[[320,568],[360,800],[375,812],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080]];
for(const type of [chromium,webkit]){const browser=await type.launch();try {
 const context=await browser.newContext({reducedMotion:'reduce'});await isolate(context,base);const page=await context.newPage();
 for(const theme of ['claro','oscuro']){await context.addInitScript(t=>localStorage.setItem('rt-tema',t),theme);
 for(const id of ids)for(const path of [`/resumen.html?id=${id}`,`/resumen.html?id=${id}&v=corto`,manifest[String(id)].path]) {
  await page.goto(base+path);await page.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);await page.evaluate(()=>document.fonts.ready);
  for(const [width,height] of sizes) {
   await page.setViewportSize({width,height});
   await page.waitForTimeout(50);
   const m=await page.evaluate(()=>{
    const p=document.querySelector('[data-ev-reader] article p'),article=p.closest('article'),rail=document.querySelector('.ev-rail'),grid=document.querySelector('.ev-reader-grid'),g=getComputedStyle(grid),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=getComputedStyle(p).font;const ch=ctx.measureText('0').width;
    return {scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,client:document.documentElement.clientWidth,title:document.querySelector('[data-ev-field=titulo]').textContent,align:getComputedStyle(p).textAlign,measure:p.getBoundingClientRect().width,ch,active:document.querySelectorAll('.ev-version [aria-current="page"]').length,display:g.display,tracks:g.gridTemplateColumns.split(/\s+/).map(parseFloat),gap:parseFloat(g.columnGap),rail:rail.getBoundingClientRect().width,clipping:getComputedStyle(article).overflowX};
   });
   const label=`${path} ${width}: ${JSON.stringify(m)}`;
   assert.ok(m.scroll<=m.client&&m.body<=m.client,label);assert.equal(m.title,rows.find(r=>r.id===id).titulo);assert.equal(m.align,'left');assert.ok(m.measure<=75*m.ch+1,label);assert.equal(m.active,1);assert.equal(m.display,width>=720?'grid':'block',label);assert.ok(!['hidden','clip'].includes(m.clipping),label);
   if(width>=720){assert.equal(m.tracks.length,2,label);assert.ok(m.rail>=179&&m.rail<=241,label);assert.ok(m.gap>=31&&m.gap<=57,label)}else assert.equal(m.rail,0,label);
   results.push({engine:type.name(),theme,id,path,width,height,status:'PASS',...m});
  }
 }
 }
 console.log(`Editorial reader/grid PASS: ${results.length} route/viewport checks`);
}finally{if(process.env.RT_REPORT_PATH)writeFileSync(process.env.RT_REPORT_PATH,JSON.stringify(results,null,2));await browser.close()}}
