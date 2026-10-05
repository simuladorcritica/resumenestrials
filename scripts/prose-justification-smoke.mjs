import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {chromium,webkit} from 'playwright';
import {isolate} from './design-browser-suites.mjs';
const base=process.env.RT_BASE_URL||'http://127.0.0.1:8000';
const routes=JSON.parse(fs.readFileSync('seo-manifest.json','utf8'));
const clusters=JSON.parse(fs.readFileSync('seo-cluster-manifest.json','utf8'));
const paths=['/','/medicina-critica/','/medicina-interna/',...Object.values(clusters).map(c=>c.path),'/medicina-interna/hematologia-oncologia/',routes['168'].path,'/resumen.html?id=168','/resumen.html?id=168&v=corto','/resumen/168.html','/metodologia/','/equipo-editorial/','/privacidad.html','/privacidad/','/terminos/','/404.html','/cuenta.html','/biblioteca.html','/registro.html','/login.html','/recuperar.html'];
const excluded=':where(.ev-meta,.ev-count,.ev-eyebrow,.ev-kicker,.ev-trust,.ev-state,.ev-estado,.ev-strength,.ev-hint,.ev-field-error,.ev-pill,.ev-editorial-dates,.ev-turnstile-status,.ev-safe)';
const results=[];
const accountSource=fs.readFileSync('scripts/account-safe-smoke.mjs','utf8'),mockStart=accountSource.indexOf('const mock='),mockEnd=accountSource.indexOf('const map=');assert(mockStart>=0&&mockEnd>mockStart);
const accountMock=vm.runInNewContext(accountSource.slice(mockStart,mockEnd).replace('const mock=','globalThis.mock=')+';mock');
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();
 try{for(const width of [390,1440])for(const theme of ['claro','oscuro']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});await isolate(context,base);await context.addInitScript(t=>localStorage.setItem('rt-tema',t),theme);const page=await context.newPage();
  // Redirect aliases use their canonical production URL. Serve their resources
  // from the exact local checkout, so this regression cannot contact production.
  await context.route('https://resumenestrials.com/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:base+u.pathname+u.search});return route.fulfill({response})});
  for(const path of paths){
   console.log('Prose check',engine.name(),width,theme,path);
   const mockRoute=route=>route.fulfill({contentType:'application/javascript',body:accountMock});if(path==='/cuenta.html')await context.route('https://esm.sh/**',mockRoute);
   const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,path);
   if(path==='/cuenta.html')await page.waitForFunction(()=>document.querySelector('#nombre')?.value==='Prueba');
   if(path==='/medicina-interna/hematologia-oncologia/')await page.waitForURL(u=>u.pathname==='/medicina-interna/');
   if(path==='/privacidad.html')await page.waitForURL(u=>u.pathname==='/privacidad/');
   if(path.startsWith('/resumen.html'))await page.waitForFunction(()=>document.querySelector('article p'));
   if(await page.locator('[data-ev-ids]').count()){
    await page.waitForFunction(()=>document.querySelector('#ev-count')?.textContent.includes(' de '));
    for(const dense of [false,true]){
     const view=page.locator('#ev-view');if((await view.getAttribute('aria-pressed')==='true')!==dense)await view.click();
     const offset=await page.locator('#ev-list>.ev-card:visible').first().evaluate(card=>{const s=getComputedStyle(card);return card.querySelector('h2').getBoundingClientRect().top-card.getBoundingClientRect().top-parseFloat(s.paddingTop)-parseFloat(s.borderTopWidth)});
     assert(Math.abs(offset)<1,`${path} title offset ${offset}; dense=${dense}`);
    }
    await page.locator('#ev-view').click();
   }
   const m=await page.evaluate(excluded=>{
    const visible=n=>n.getClientRects().length&&n.textContent.trim();
    const prose=[...document.querySelectorAll(`p:not(${excluded}),:where(.ev-prose,.ev-body,article.articulo) li`)].filter(visible);
    const controls=[...document.querySelectorAll('a,h1,h2,h3,.ev-meta,.ev-tag,.ev-chip,button,input,select,textarea,label,th,td,summary,nav,.ev-rail')].filter(visible);
    return {lang:document.documentElement.lang,prose:prose.map(n=>{const s=getComputedStyle(n);return {text:n.textContent.slice(0,80),align:s.textAlign,last:s.textAlignLast,hyphens:s.hyphens}}),controls:controls.filter(n=>getComputedStyle(n).textAlign==='justify').map(n=>n.outerHTML.slice(0,140)),topTags:[...document.querySelectorAll('.ev-card>div:first-child>.ev-tag')].length};
   },excluded);
   assert.equal(m.lang,'es-MX',path);assert.ok(m.prose.length,path+' missing prose coverage');for(const p of m.prose){assert.equal(p.align,'justify',path+JSON.stringify(p));assert.equal(p.hyphens,'auto',path+JSON.stringify(p));assert.equal(p.last,'start',path+JSON.stringify(p))}assert.deepEqual(m.controls,[],path);assert.equal(m.topTags,0,path);
   results.push({path,width,theme,engine:engine.name(),paragraphs:m.prose.length,status:'OK'});
   if(await page.locator('[data-ev-reader]').count()){
    await page.waitForFunction(()=>document.querySelector('[data-ev-font]')?.onclick);
    for(const readingWidth of [360,390,768,1440]){
     await page.setViewportSize({width:readingWidth,height:readingWidth<720?844:900});
     const sizes=new Set();
     for(let step=0;step<3;step++){
      for(const focus of [false,true]){
       const button=page.locator('[data-ev-focus]');if((await button.getAttribute('aria-pressed')==='true')!==focus)await button.click();
       const reading=await page.locator('article p').first().evaluate(n=>{const s=getComputedStyle(n);return {size:parseFloat(s.fontSize),align:s.textAlign,hyphens:s.hyphens,last:s.textAlignLast,viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}});
       assert.equal(reading.align,'justify');assert.equal(reading.hyphens,'auto');assert.equal(reading.last,'start');assert(reading.scroll<=reading.viewport&&reading.body<=reading.viewport,JSON.stringify(reading));assert([18,20,22].includes(reading.size));sizes.add(reading.size);
       results.push({path,width:readingWidth,theme,engine:engine.name(),focus,size:reading.size,status:'OK'});
      }
      await page.locator('[data-ev-font]').click();
     }
     assert.deepEqual([...sizes].sort((a,b)=>a-b),[18,20,22]);
    }
    if(await page.locator('[data-ev-focus]').getAttribute('aria-pressed')==='true')await page.locator('[data-ev-focus]').click();
    await page.setViewportSize({width,height:width===390?844:900});
   }
   if(path==='/cuenta.html')await context.unroute('https://esm.sh/**',mockRoute);
  }
  await context.close();
 }}finally{await browser.close()}
}
if(process.env.RT_REPORT_PATH)fs.writeFileSync(process.env.RT_REPORT_PATH,JSON.stringify(results,null,2));console.log('Prose/card regression PASS: '+results.length+' page configurations');
