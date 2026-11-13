// Transparencia editorial en el navegador: aviso «Resumen en revisión», fe de erratas y /correcciones/
// en la página canónica, la legada y el lector dinámico (resumen.html?id=), en ambos motores, temas y
// anchos. También comprueba que el lector dinámico funciona igual si auditoria-editorial.json falta o
// no es JSON. Los IDs se toman del archivo versionado, que las rutinas regeneran a diario.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
import {isolate} from './design-browser-suites.mjs';
const base=process.env.RT_BASE_URL||'http://127.0.0.1:8000';
const engines={chromium,webkit},selected=(process.env.RT_AUDIT_ENGINES||'chromium,webkit').split(',').map(s=>s.trim()).filter(Boolean);
assert(selected.length&&selected.every(name=>engines[name]),'RT_AUDIT_ENGINES solo acepta chromium y webkit');
const manifest=JSON.parse(fs.readFileSync('seo-manifest.json','utf8'));
const audit=fs.existsSync('auditoria-editorial.json')?JSON.parse(fs.readFileSync('auditoria-editorial.json','utf8')):null;
const withErrors=new Set((audit?.con_errores_abiertos||[]).map(String));
const pending=(audit?.sin_auditar||[]).map(String).find(id=>!withErrors.has(id)&&manifest[id]);
const open=[...withErrors].find(id=>manifest[id]);
const fixes=new Map();for(const c of audit?.correcciones||[])fixes.set(String(c.id),(fixes.get(String(c.id))||0)+1);
const corrected=[...fixes.keys()].find(id=>manifest[id]&&!withErrors.has(id)&&!(audit?.sin_auditar||[]).map(String).includes(id));
const clean=Object.keys(manifest).find(id=>!withErrors.has(id)&&!(audit?.sin_auditar||[]).map(String).includes(id)&&!fixes.has(id));
const cases=[[pending,'revision',0],[open,'errores',fixes.get(open)||0],[corrected,'',fixes.get(corrected)||0],[clean,'',0]].filter(([id])=>id);
assert(cases.length>=2,'Los datos versionados deben cubrir al menos un aviso y una fe de erratas');
let checks=0;
async function noOverflow(page,label){const o=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(o<=1,label+' desborda '+o+' px')}
async function expectState(page,label,state,errata){
 await page.waitForFunction(()=>document.querySelector('[data-ev-reader] article p'));
 const notice=page.locator('.ev-audit');
 if(state){
  await notice.waitFor({state:'visible'});assert.equal(await notice.count(),1,label);assert.equal(await notice.getAttribute('data-ev-audit'),state,label);
  const text=(await notice.textContent()).replace(/\s+/g,' ');assert(text.startsWith('Resumen en revisión:'),label+' '+text);
  assert(await notice.locator('a[href="/correcciones/"]').isVisible(),label+' enlace');
  // Va al inicio: dentro de la cabecera del resumen, antes del cuerpo.
  assert(await notice.evaluate(n=>!!n.closest('.ev-reading-head')&&!!(n.compareDocumentPosition(document.querySelector('[data-ev-reader] article'))&Node.DOCUMENT_POSITION_FOLLOWING)),label+' posición');
 }else assert.equal(await notice.count(),0,label+' sin aviso');
 const block=page.locator('.ev-errata');
 if(errata){
  assert(await block.isVisible(),label+' fe de erratas');assert.equal(await block.locator('li').count(),errata,label);
  for(const line of await block.locator('li').allTextContents())assert.match(line,/^Corregido el \d{1,2} de [a-z]+ de \d{4}\. \S/,label);
  assert(await block.evaluate(n=>!!(document.querySelector('[data-ev-reader] article').compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING)),label+' después del cuerpo');
 }else assert.equal(await block.count(),0,label+' sin fe de erratas');
 await noOverflow(page,label);checks++;
}
for(const name of selected){
 const browser=await engines[name].launch();
 try{for(const width of [390,1440])for(const theme of ['claro','oscuro']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});await isolate(context,base);await context.addInitScript(t=>localStorage.setItem('rt-tema',t),theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [id,state,errata] of cases){
   for(const path of [manifest[id].path,'/resumen/'+id+'.html','/resumen.html?id='+id]){
    const label=[name,width,theme,path].join(' ');console.log('Audit check',label);
    const r=await page.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,label);await expectState(page,label,state,errata);
   }
  }
  // Archivo ausente o inválido: el lector dinámico se muestra completo, sin aviso ni fe de erratas.
  for(const [kind,reply] of [['404',{status:404,body:'not found'}],['inválido',{status:200,contentType:'application/json',body:'{no es json'}]]){
   await page.route('**/auditoria-editorial.json',route=>route.fulfill(reply));
   for(const [id] of cases){const label=[name,width,theme,'auditoría '+kind,id].join(' ');const r=await page.goto(base+'/resumen.html?id='+id,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,label);await expectState(page,label,'',0)}
   await page.unroute('**/auditoria-editorial.json');
  }
  const r=await page.goto(base+'/correcciones/',{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,'/correcciones/');
  assert.equal(await page.locator('h1').textContent(),'Correcciones');
  assert.equal(await page.locator('.ev-corrections li').count(),audit?.correcciones?.length||0);
  for(const href of await page.locator('.ev-corrections a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))))assert(Object.values(manifest).some(e=>e.path===href),href);
  assert(await page.locator('.ev-footer a[href="/correcciones/"]').count(),'pie con Correcciones');await noOverflow(page,'/correcciones/ '+width);checks++;
  assert.deepEqual(errors,[],name+' '+width+' '+theme+' errores de página');
  await context.close();
 }}finally{await browser.close()}
}
console.log('EDITORIAL AUDIT SMOKE PASS · '+checks+' vistas · '+selected.join('+'));
