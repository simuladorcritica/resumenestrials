import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { belongsToCategory } from './article-inventory.mjs';
import { editions } from './editions.mjs';

const BASE=(process.env.RT_BASE_URL||'https://resumenestrials.com').replace(/\/$/,'');
const CANONICAL_ORIGIN='https://resumenestrials.com';
const timeout=15000;
const failures=[];
const checks=[];
const expectedHomeDisclosure=readFileSync('templates/home-disclosure.html','utf8').replace(/\r\n/g,'\n').trim();
const expected=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const clusters=JSON.parse(readFileSync('seo-cluster-manifest.json','utf8'));

// A main push starts CI before Pages finishes. Wait for the requested bundle
// and exact clinical bytes before evaluating the published-site contracts.
if(process.env.RT_WAIT_FOR_DEPLOY==='1'){
 const version=JSON.parse(readFileSync('ui/runtime-version.json','utf8')).version,clinicalSHA=createHash('sha256').update(readFileSync('resumenes.json')).digest('hex');let deployed=false;
 for(let attempt=1;attempt<=36;attempt++){
  try{const stamp=Date.now(),[home,clinical,config]=await Promise.all([fetch(BASE+'/?deploycheck='+stamp,{signal:AbortSignal.timeout(timeout),headers:{'cache-control':'no-cache'}}),fetch(BASE+'/resumenes.json?deploycheck='+stamp,{signal:AbortSignal.timeout(timeout),headers:{'cache-control':'no-cache'}}),fetch(BASE+'/supabase-config.js?deploycheck='+stamp,{signal:AbortSignal.timeout(timeout),headers:{'cache-control':'no-cache'}})]);
   if(home.ok&&clinical.ok&&config.ok&&(await config.text()).replace(/\r\n/g,'\n')===readFileSync('supabase-config.js','utf8').replace(/\r\n/g,'\n')&&await home.text().then(b=>b.includes('/site-runtime.js?v='+version)&&b.replace(/\r\n/g,'\n').includes(expectedHomeDisclosure))&&createHash('sha256').update(Buffer.from(await clinical.arrayBuffer())).digest('hex')===clinicalSHA){deployed=true;break}
  }catch{}
  console.log('Waiting for Pages deployment '+attempt+'/36');if(attempt<36)await new Promise(resolve=>setTimeout(resolve,10000));
 }
 assert(deployed,'The requested Pages deployment did not become available');
}

const expectedIds=new Set(expected.map((r)=>String(r.id)));
const expectedCrit=expected.filter((record)=>belongsToCategory(record,'Medicina Crítica')).length;
const expectedInt=expected.filter((record)=>belongsToCategory(record,'Medicina Interna')).length;
const sample=expected.find((r)=>r.corto)||expected[0];
const sampleEntry=manifest[String(sample?.id)];
const cacheBust=`rtcheck=${Date.now()}`;

function assert(condition,message){if(!condition)throw new Error(message)}
function bust(path){return path.includes('?')?`${path}&${cacheBust}`:`${path}?${cacheBust}`}
async function get(path,{json=false,bustCache=true}={}){
  const c=new AbortController();
  const t=setTimeout(()=>c.abort(),timeout);
  const started=Date.now();
  try{
    const requestPath=bustCache?bust(path):path;
    const r=await fetch(BASE+requestPath,{redirect:'follow',signal:c.signal,headers:{'user-agent':'ResumenesTrialsHealth/2.0','cache-control':'no-cache','pragma':'no-cache'}});
    const ms=Date.now()-started;
    checks.push({path,status:r.status,ms});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return json?await r.json():await r.text();
  }finally{clearTimeout(t)}
}
async function check(path,fn,options){
  try{const body=await get(path,options);if(fn)await fn(body);console.log('PASS',path)}
  catch(e){failures.push(`${path}: ${e.message}`);console.error('FAIL',path,e.message)}
}

assert(expected.length>0,'El repositorio no contiene resúmenes');
assert(sample&&sampleEntry?.path,'No hay muestra canónica para la auditoría');

// La portada es la edición actual (última semana con datos); el archivo completo vive en /archivo/
// y cada edición anterior tiene su página en /ediciones/<lunes>/.
const weeks=editions(expected);
const editionCheck=(edition,label)=>(b)=>{
  assert(b.includes(`data-ev-edition="${edition.monday}"`),`${label} no muestra la edición del ${edition.monday}`);
  assert((b.match(/class="ev-signal"/g)||[]).length===1,`${label} sin la línea de señal`);
  for(const item of edition.items)assert(b.includes(`href="${manifest[String(item.id)].path}"`),`${label} no enlaza el ensayo ${item.id}`);
};
await check('/',(b)=>{
  assert(b.replace(/\r\n/g,'\n').includes(expectedHomeDisclosure),'Portada: falta el aviso original de publicidad y contenido');
  assert(weeks.length>0,'No hay ninguna edición semanal');
  editionCheck(weeks.at(-1),'La portada')(b);
  assert(b.includes('<h1>Evidencia sin ruido</h1>')&&(b.match(/<h1\b/g)||[]).length===1,'Portada sin su único h1');
  assert(!b.includes('class="ev-card" data-id=')&&!b.includes('data-ev-ids='),'La portada no debe incluir el archivo');
});
await check('/archivo/',(b)=>{
  const rows=(b.match(/class="ev-card" data-id=/g)||[]).length;
  assert(rows===expected.length,'El archivo no prerenderiza todos los ensayos');
  assert(b.includes('id="ev-count"')&&b.includes(expected.length+' resúmenes'),'Contador del archivo incorrecto');
  assert(b.includes(sampleEntry.path),`el archivo no enlaza al trial canónico de muestra ${sample.id}`);
});
for(const edition of weeks.slice(0,-1))await check(edition.route,editionCheck(edition,`La edición ${edition.route}`));

let liveArticles=[];
await check('/resumenes.json',(body)=>{
  liveArticles=JSON.parse(body);
  assert(Array.isArray(liveArticles),'JSON no es arreglo');
  assert(liveArticles.length===expected.length,`producción tiene ${liveArticles.length} resúmenes; se esperaban ${expected.length}`);
  const ids=new Set(liveArticles.map((r)=>String(r.id)));
  for(const id of expectedIds)assert(ids.has(id),`producción no contiene id ${id}`);
});

await check('/seo-manifest.json',(body)=>{
  const live=JSON.parse(body);
  assert(Object.keys(live).length===expected.length,`seo-manifest publicado tiene ${Object.keys(live).length}/${expected.length} entradas`);
  for(const id of expectedIds){
    assert(live[id]?.path===manifest[id]?.path,`ruta canónica distinta para id ${id}`);
  }
});

await check(sampleEntry.path,(b)=>{
  assert(b.includes(`data-ev-reader="${sample.id}"`),'trial canónico sin descarga PDF completa');
  assert(b.includes('<article class="articulo">'),'trial canónico sin artículo principal');
  assert(b.includes('<link rel="canonical"'),'trial canónico sin canonical');
  if(sample.corto)assert(b.includes(`/resumen.html?id=${sample.id}&amp;v=corto`),'trial canónico sin enlace a lectura breve');
  assert(!b.includes('id="resumen-breve"'),'trial canónico volvió a incrustar el resumen breve');
});

if(sample.corto){
  await check(`/resumen.html?id=${sample.id}&v=corto`,(b)=>{
    assert(b.includes('ev-dynamic-reader')&&b.includes('/site-runtime.js?v='),'Lector dinámico sin runtime');
  });
}
await check('/ui/pdf.js',b=>{for(const token of ['JSPDF_SRI','item.corto','item.cuerpo','generatePDF','function signal(','resumenestrials@outlook.com'])assert(b.includes(token),'PDF sin '+token)});
await check('/site-runtime.js',b=>{for(const token of ['data-ev-sections','data-ev-save','data-ev-pdf','SpecialtyClassification'])assert(b.includes(token),'Runtime sin '+token)});
for(const path of ['/auth.js','/supabase-config.js','/turnstile.js','/turnstile-config.js','/library-store.js','/library-page.js','/recommendations.js','/trial-data.js'])await check(path,body=>assert(createHash('sha256').update(body.replace(/\r\n/g,'\n')).digest('hex')===createHash('sha256').update(readFileSync(path.slice(1),'utf8').replace(/\r\n/g,'\n')).digest('hex'),'Dependencia pública ausente o distinta'));
for(const [path,count] of [['/medicina-critica/',expectedCrit],['/medicina-interna/',expectedInt]])await check(path,b=>assert((b.match(/class="ev-card" data-id=/g)||[]).length===count,'Hub sin todos los ensayos'));
for(const path of ['/medicina-critica/','/medicina-interna/','/metodologia/','/equipo-editorial/','/privacidad/','/terminos/']){
  await check(path,(b)=>{assert(/Resúmenes Trials|Resumenes Trials/.test(b),'HTML editorial inesperado')});
}
for(const entry of Object.values(clusters)){
  await check(entry.path,(b)=>{assert(b.includes('data-ev-ids='),'cluster publicado sin colección de trials')});
}

await check('/sitemap.xml',(b)=>{
  for(const entry of Object.values(manifest))assert(b.includes(entry.url),`sitemap sin ${entry.url}`);
  for(const entry of Object.values(clusters))assert(b.includes(`${CANONICAL_ORIGIN}${entry.path}`),`sitemap sin cluster ${entry.path}`);
  for(const path of ['/archivo/',...weeks.slice(0,-1).map(edition=>edition.route),'/medicina-critica/','/medicina-interna/','/metodologia/','/equipo-editorial/','/privacidad/','/terminos/'])assert(b.includes(`<loc>${CANONICAL_ORIGIN}${path}</loc>`),`sitemap sin ${path}`);
});

await check('/login.html',(b)=>{for(const x of ['turnstile-login','turnstile.js','auth.js'])assert(b.includes(x),`falta ${x}`)});
await check('/registro.html',(b)=>{for(const x of ['turnstile-registro','Crear mi cuenta'])assert(b.includes(x),`falta ${x}`)});
await check('/recuperar.html',(b)=>{assert(b.includes('turnstile-recuperar'),'falta Turnstile de recuperación')});
await check('/cuenta.html',(b)=>{for(const x of ['Datos personales','Notificaciones','Seguridad','Preferencias'])assert(b.includes(x),`falta ${x}`)});
await check('/biblioteca.html');
await check('/turnstile-config.js',(b)=>{
  assert(b.includes('0x4AAAAAAEV-hx4kk2dLe8ZF'),'Site Key pública de Turnstile inesperada');
  assert(!b.includes('TU_SITE_KEY'),'Turnstile conserva una Site Key de marcador');
});
await check('/turnstile.js',(b)=>{
  assert(b.includes("from './turnstile-config.js'"),'Turnstile no consume la configuración pública centralizada');
  assert(!/CAPTCHA_ENABLED\s*=\s*false/.test(b),'Turnstile permanece desactivado explícitamente');
});

const slow=checks.filter((x)=>x.ms>5000);
for(const x of slow)console.warn('SLOW',x.path,`${x.ms}ms`);
console.log('\nProducción:',{expected:expected.length,critical:expectedCrit,internal:expectedInt,clusters:Object.keys(clusters).length,checks:checks.length,failures:failures.length,slow:slow.length});
if(failures.length){for(const f of failures)console.error('ERROR',f);process.exit(1)}
console.log('PRODUCTION HEALTH STRICT PASS');
