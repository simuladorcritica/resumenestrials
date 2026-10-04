import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {installTurnstileTestRoutes,assertLoopbackBase} from './turnstile-test-helpers.mjs';
const data=JSON.parse(fs.readFileSync('resumenes.json','utf8')),map=JSON.parse(fs.readFileSync('seo-manifest.json','utf8')),clusters=JSON.parse(fs.readFileSync('seo-cluster-manifest.json','utf8'));
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const anonModule="export function createClient(){return {auth:{async getUser(){return {data:{user:null},error:null}},async getSession(){return {data:{session:null},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}},error:null}},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:null,nextLevel:null},error:null}},async listFactors(){return {data:{totp:[]},error:null}}}}}}";
export async function isolate(context,base,{signedIn=false}={}){
 assertLoopbackBase(base);
 await context.route('**/*',r=>{
  const u=r.request().url();
  if(u.startsWith(base+'/'))return r.continue();
  if(u.includes('esm.sh/'))return r.fulfill({contentType:'application/javascript',body:anonModule});
  if(u.includes('jspdf'))return r.fulfill({contentType:'application/javascript',path:'node_modules/jspdf/dist/jspdf.umd.min.js'});
  // All remote requests are intercepted; the suite cannot create users, mail or telemetry.
  return r.fulfill({status:200,contentType:u.includes('fonts.googleapis')?'text/css':'application/javascript',body:''});
 });
}
async function ready(p,path,base){
 const r=await p.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,path);
 if(await p.locator('[data-ev-ids]').count())await p.waitForFunction(()=>document.querySelector('#ev-count').textContent.includes(' de '));
 if(await p.locator('[data-ev-reader],#ev-dynamic-reader').count())await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick||/no encontrado/i.test(document.querySelector('h1')?.textContent));
}
async function geometry(p){
 const m=await p.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,styles:document.querySelectorAll('style').length,headers:document.querySelectorAll('.ev-header').length}));
 assert(m.sw<=m.w+2&&m.bw<=m.w+2,'Horizontal overflow '+JSON.stringify(m));assert.equal(m.styles,0,'JS/inline style');assert.equal(m.headers,1);
}
async function visibleIds(p){return p.locator('#ev-list>.ev-card:visible').evaluateAll(ns=>ns.map(n=>n.dataset.id))}
async function archive(p,base){
 await ready(p,'/',base);assert.equal(await p.locator('#ev-list>.ev-card').count(),data.length);assert.equal((await visibleIds(p)).length,24);
 await p.locator('#ev-more').click();assert.equal((await visibleIds(p)).length,48);assert(new URL(p.url()).searchParams.get('n')==='48');
 await p.locator('#ev-view').click();assert.equal(await p.locator('#ev-view').getAttribute('aria-pressed'),'true');await p.reload();await p.waitForFunction(()=>document.querySelector('#ev-count').textContent.includes(' de '));assert.equal((await visibleIds(p)).length,48);assert.equal(await p.locator('#ev-view').getAttribute('aria-pressed'),'true');
 for(const [key,param]of [['year','anio'],['journal','revista'],['type','tipo'],['topic','tema'],['area','esp']]){
  await ready(p,'/',base);const option=await p.locator('#ev-'+key+' option').nth(1).getAttribute('value');await p.selectOption('#ev-'+key,option);assert.equal(new URL(p.url()).searchParams.get(param),option);
  const expected=data.filter(r=>key==='area'?p /* classification validated below in browser */:key==='topic'?(r.temas||[]).includes(option):String(r[{year:'anio',journal:'revista',type:'tipo_estudio'}[key]])===option);
  const ids=await visibleIds(p);assert(ids.length>0);if(key!=='area')assert(ids.every(id=>expected.some(r=>String(r.id)===id)),key+"="+option+" ids="+ids.join(",")+" expected="+expected.map(r=>r.id).join(","));
  else assert(await p.evaluate(()=>{const selected=document.querySelector('#ev-area').value;return window.EV.data().then(rs=>[...document.querySelectorAll('#ev-list>.ev-card')].filter(n=>!n.hidden).every(n=>window.EV.areas(rs.find(r=>String(r.id)===n.dataset.id)).includes(selected)))}));
  await p.reload();await p.waitForFunction(()=>document.querySelector('#ev-count').textContent.includes(' de '));assert.equal(await p.inputValue('#ev-'+key),option);await p.locator('[data-ev-clear="ev-'+key+'"]').click();assert.equal((await visibleIds(p)).length,24);
 }
 await p.fill('#ev-q','SOHO');await p.waitForURL(/q=SOHO/);assert((await p.locator('#ev-list>.ev-card:visible h2').allTextContents()).every(t=>/SOHO/i.test(t)));
 await p.fill('#ev-q','__NO_MATCH__');await p.waitForURL(/q=__NO_MATCH__/);assert(await p.locator('#ev-empty').isVisible());assert.equal((await visibleIds(p)).length,0);
 await p.goBack();await p.waitForFunction(()=>document.querySelector('#ev-q').value==='SOHO');assert((await visibleIds(p)).length>0);
 await p.locator('[data-ev-clear="ev-q"]').click();await p.selectOption('#ev-sort','title');const titles=await p.locator('#ev-list>.ev-card:visible h2').allTextContents();assert.deepEqual(titles,titles.slice().sort((a,b)=>a.localeCompare(b,'es')));
 await p.selectOption('#ev-sort','journal');assert.equal(new URL(p.url()).searchParams.get('orden'),'journal');await geometry(p);
}
async function navigation(p,base,width){
 await ready(p,'/',base);if(width<960){await p.locator('[data-ev-menu]').click();assert(await p.locator('#ev-navigation').isVisible());await p.keyboard.press('Escape');assert(!(await p.locator('#ev-navigation').isVisible()));assert.equal(await p.locator('[data-ev-menu]').getAttribute('aria-expanded'),'false');assert.equal(await p.locator('.ev-mobile-nav').locator('a,button').count(),4)}
 await p.keyboard.press('/');assert(await p.locator('#ev-search').isVisible());const sample=data.find(r=>r.doi&&r.registro);
 for(const q of [sample.titulo,sample.doi,sample.registro,String(sample.anio),sample.revista,norm(sample.especialidad_principal),sample.autor]){
  await p.fill('#ev-search-input',q);await p.waitForTimeout(180);assert((await p.locator('#ev-search-results a').count())>0,'Search field '+q);
 }
 await p.fill('#ev-search-input','__SIN_RESULTADOS__');await p.waitForTimeout(180);assert.equal(await p.locator('#ev-search-results a').count(),0);assert(/Sin resultados/.test(await p.locator('#ev-search-status').textContent()));await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#ev-search').open);await p.keyboard.press('Control+k');await p.waitForFunction(()=>document.querySelector('#ev-search').open);
 await p.fill('#ev-search-input',sample.doi);await p.waitForTimeout(180);assert(await p.locator('#ev-search-results mark').count()>0);
 await p.keyboard.press('ArrowDown');assert(await p.locator('#ev-search-results a').first().evaluate(n=>n===document.activeElement));await p.keyboard.press('Enter');await p.waitForURL('**'+map[String(sample.id)].path);
 await p.keyboard.press('Control+k');assert(await p.locator('#ev-search').isVisible());await p.keyboard.press('Escape');assert(!(await p.locator('#ev-search').isVisible()));
 const before=await p.evaluate(()=>document.documentElement.dataset.evTheme);await p.locator('button[data-ev-theme]').click();await p.reload();assert.equal(await p.evaluate(()=>document.documentElement.dataset.evTheme),before==='oscuro'?'claro':'oscuro');
 assert(await p.locator('a[href="/metodologia/"]').first().isVisible());await geometry(p);
}
async function reader(p,base){
 const r=data[0],path=map[String(r.id)].path;await ready(p,path,base);
 const expected=await p.evaluate(r=>new DOMParser().parseFromString(r.cuerpo,'text/html').body.textContent.replace(/\s+/g,' ').trim(),r);
 assert.equal((await p.locator('article').first().textContent()).replace(/\s+/g,' ').trim(),expected);assert.equal((await p.locator('[data-ev-field=titulo]').textContent()).trim(),r.titulo);
 const full=await p.locator('article p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));assert(full>=18);
 const count=await p.locator('article h2').count();assert.equal(await p.locator('[data-ev-toc] a').count(),count);
 await p.locator('[data-ev-sections]').click();assert(await p.locator('#ev-sections').isVisible());await p.locator('#ev-sections nav a').nth(2).click();assert(!(await p.locator('#ev-sections').isVisible()));await p.waitForTimeout(500);assert(await p.locator('progress').evaluate(n=>n.value>0));
 await p.locator('[data-ev-focus]').click();assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'true');await p.locator('[data-ev-font]').click();const altered=await p.locator('article p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));assert.notEqual(altered,full);await p.reload();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('article p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)),altered);
 await p.locator('[data-ev-focus]').click();await p.locator('.ev-version a').nth(1).click();await p.waitForFunction(()=>document.querySelector('[data-ev-reader]')?.dataset.evBrief==='true');assert.equal(await p.locator('.ev-version a').nth(1).getAttribute('aria-current'),'page');const briefExpected=await p.evaluate(r=>new DOMParser().parseFromString(r.corto,'text/html').body.textContent.replace(/\s+/g,' ').trim(),r);assert.equal((await p.locator('article').first().textContent()).replace(/\s+/g,' ').trim(),briefExpected);
 assert.equal(new URL(await p.locator('link[rel=canonical]').getAttribute('href')).pathname,path);assert(await p.locator('[data-ev-neighbors] a').count()>=2);assert(await p.locator('[data-ev-related] .ev-card').count()>0);
 await p.locator('[data-ev-save]').click();await p.waitForURL(/login\.html\?next=/,{waitUntil:'domcontentloaded'});await p.locator('form#login').waitFor({state:'visible'});for(const id of ['0','999','texto','']){await ready(p,'/resumen.html?id='+id,base);assert.equal(await p.locator('h1').textContent(),'Resumen no encontrado');assert.equal(await p.locator('[data-ev-pdf]').count(),0);assert.equal(await p.locator('script[src*="adsbygoogle"]').count(),0)};
 await ready(p,'/?q=SOHO&vista=lista',base);await p.locator('#ev-list>.ev-card:visible [data-ev-read]').first().click();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);const nextHref=await p.locator('[data-ev-neighbors] a').last().getAttribute('href');assert(nextHref.startsWith('/trials/'));await p.locator('[data-ev-neighbors] a').last().click();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.equal(new URL(p.url()).pathname,nextHref);assert.equal(await p.locator('[data-ev-return]').first().getAttribute('href'),'/?q=SOHO&vista=lista');await p.locator('[data-ev-neighbors] a').first().click();await p.waitForFunction(()=>document.querySelector('[data-ev-reader]')?.dataset.evReader==='1');await p.locator('[data-ev-return]').first().click();await p.waitForURL(/q=SOHO/,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('#ev-count')?.textContent.includes(' de '));assert.equal(await p.inputValue('#ev-q'),'SOHO');assert.equal(await p.locator('#ev-view').getAttribute('aria-pressed'),'true');await geometry(p);
}
async function downloads(p,base){
 const r=data[0],path=map[String(r.id)].path;
 for(const route of ['/',path,'/resumen.html?id='+r.id,'/resumen.html?id='+r.id+'&v=corto','/resumen/'+r.id+'.html','/resumen/'+r.id+'-corto.html']){
  await ready(p,route,base);if(route==='/'){await p.fill('#ev-q',r.titulo);await p.waitForTimeout(180)}
  else await p.locator('[data-ev-format]').click();
  const button=p.locator(route==='/'?'#ev-list>.ev-card:visible [data-ev-card-pdf]':'[data-format=a4]').first();
  const [download]=await Promise.all([p.waitForEvent('download'),button.click()]);const name=download.suggestedFilename();assert(name.endsWith('.pdf'));assert(name.includes(String(r.id)));
  const tmp=await download.path();assert(fs.statSync(tmp).size>3000);const bytes=fs.readFileSync(tmp);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.includes(Buffer.from('/Subtype /Image')),'No logo image');
  if(route.includes('corto'))assert(name.includes('breve'));else assert(name.includes('completo'));await geometry(p);
 }
}
async function shell(p,base){
 const paths=['/',map['1'].path,'/resumen.html?id=1&v=corto','/medicina-critica/','/medicina-interna/',...Object.values(clusters).map(c=>c.path),'/metodologia/','/equipo-editorial/','/privacidad/','/terminos/','/login.html','/registro.html','/recuperar.html','/biblioteca.html','/agregar.html','/404.html'];
 for(const path of paths){
  await ready(p,path,base);await geometry(p);await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});const result=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});assert.deepEqual(result,[],path+' accessibility '+JSON.stringify(result));
  if(['/login.html','/registro.html','/recuperar.html','/biblioteca.html','/agregar.html','/privacidad/','/terminos/','/404.html'].includes(path))assert.equal(await p.locator('script[src*="adsbygoogle"]').count(),0,path+' ads');
  if(path==='/biblioteca.html')assert(await p.locator('[data-library-state=signed-out]').isVisible());
 }
 await ready(p,'/registro.html',base);assert(/spam.*correo no deseado|correo no deseado.*spam/is.test(await p.locator('#exito').textContent()));await p.locator('#email').fill('bad');await p.locator('#password').focus();assert.equal(await p.locator('#email').getAttribute('aria-invalid'),'true');
 await p.locator('button[aria-controls=password]').click();assert.equal(await p.locator('#password').getAttribute('type'),'text');await p.locator('button[aria-controls=password]').click();assert.equal(await p.locator('#password').getAttribute('type'),'password');
}
async function sweep(p,base,width,records=data){
 // Keep one WebView within a bounded browser batch. Repeated WebView creation
 // and destruction exposed a native allocator abort in Linux WebKit. Every
 // record and route still runs; the complete browser is closed after 24 records.
 const errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
 for(const r of records){
  for(const path of [map[String(r.id)].path,'/resumen.html?id='+r.id,'/resumen.html?id='+r.id+'&v=corto']){
   await ready(p,path,base);assert.equal(await p.locator('[data-ev-field=titulo]').textContent(),r.titulo);assert(await p.locator('article').first().textContent());assert.equal(await p.locator('[data-ev-sections]').count(),1);await geometry(p);
  }assert.deepEqual(errors,[],'Uncaught browser errors / '+r.id)
 }
}
const tests={archive,navigation,reader,downloads,shell,sweep};
export async function runSuite(name){
 const base=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');assertLoopbackBase(base);assert(tests[name],'Unknown suite');let cases=0;
 if(name==='sweep'){
  const selected=process.env.RT_SWEEP_CASE;const validCases=['chromium','webkit'].flatMap(e=>[390,1440].flatMap(w=>['oscuro','claro'].map(t=>e+':'+w+':'+t)));assert(!selected||validCases.includes(selected),'Invalid sweep matrix case');
  for(const [engine,type]of [['chromium',chromium],['webkit',webkit]])for(const width of [390,1440])for(const theme of ['oscuro','claro']){
   if(selected&&selected!==engine+':'+width+':'+theme)continue;
   let checked=0;
   for(let start=0;start<data.length;start+=24){
    const browser=await type.launch();try{
     const c=await browser.newContext({viewport:{width,height:width===390?844:900},acceptDownloads:true,reducedMotion:'reduce'});await isolate(c,base);await c.addInitScript(t=>localStorage.setItem('rt-tema',t),theme);const page=await c.newPage();
     const batch=data.slice(start,start+24);await sweep(page,base,width,batch);checked+=batch.length*3;await c.close();
    }finally{await browser.close()}
   }
   assert.equal(checked,data.length*3);cases++;console.log('sweep '+engine+' '+width+' '+theme+' PASS '+checked+' views / bounded browser batches');
  }
  console.log('DESIGN sweep PASS '+cases+' configurations');return;
 }

 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){const browser=await type.launch();try{for(const width of [390,1440])for(const theme of ['oscuro','claro']){
  const c=await browser.newContext({viewport:{width,height:width===390?844:900},acceptDownloads:true,reducedMotion:'reduce'});await isolate(c,base);await c.addInitScript(t=>{if(!localStorage.getItem('rt-tema'))localStorage.setItem('rt-tema',t)},theme);const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await installTurnstileTestRoutes(p,base);p.setDefaultTimeout(15000);
  try{await tests[name](p,base,width);assert.deepEqual(errors,[],'Uncaught browser errors');cases++;console.log(name+' '+engine+' '+width+' '+theme+' PASS')}finally{await c.close()}
 }}finally{await browser.close()}}
 console.log('DESIGN '+name+' PASS '+cases+' configurations');
}

