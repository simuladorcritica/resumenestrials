import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.RT_BASE_URL||'http://127.0.0.1:8000';
const rows=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const browser=await chromium.launch({headless:true,...(process.env.RT_BROWSER_CHANNEL?{channel:process.env.RT_BROWSER_CHANNEL}:{})});
let checks=0;
try {
 const page=await browser.newPage();
 for(const id of [1,75,98,112,150])for(const path of [`/resumen.html?id=${id}`,`/resumen.html?id=${id}&v=corto`,manifest[String(id)].path]) {
  await page.goto(base+path);await page.locator('.ed-version').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const width of [320,390,430,768,820,1024,1440,1920]) {
   await page.setViewportSize({width,height:900});
   const m=await page.evaluate(()=>{const p=document.querySelector('article.articulo p');return {scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,title:document.querySelector('.art-head h1,header.art h1').textContent,align:getComputedStyle(p).textAlign,measure:p.getBoundingClientRect().width,active:document.querySelectorAll('.ed-version [aria-current="page"]').length}});
   assert.ok(m.scroll<=m.client,`${path} ${width}: overflow`);assert.equal(m.title,rows.find(r=>r.id===id).titulo);assert.equal(m.align,'left');assert.ok(m.measure<=741);assert.equal(m.active,1);checks++;
  }
 }
 console.log(`Editorial reader PASS: ${checks} route/viewport checks`);
}finally{await browser.close()}
