import { readFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'https://resumenestrials.com').replace(/\/$/,'');
const timeout=15000;
const failures=[];
const checks=[];
const expected=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const clusters=JSON.parse(readFileSync('seo-cluster-manifest.json','utf8'));
const expectedIds=new Set(expected.map((r)=>String(r.id)));
const expectedCrit=expected.filter((r)=>r.especialidad_principal==='Medicina Crítica'||r.especialidad_secundaria==='Medicina Crítica').length;
const expectedInt=expected.filter((r)=>r.especialidad_principal==='Medicina Interna'||r.especialidad_secundaria==='Medicina Interna').length;
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

await check('/',(b)=>{
  assert(b.includes('RT-PRERENDER-START'),'la portada publicada no está prerenderizada');
  assert(b.includes(`id="conteo">${expected.length}</span>`),`contador total publicado distinto de ${expected.length}`);
  assert(b.includes(`id="conteo-crit">${expectedCrit}</span>`),`contador de Medicina Crítica distinto de ${expectedCrit}`);
  assert(b.includes(`id="conteo-int">${expectedInt}</span>`),`contador de Medicina Interna distinto de ${expectedInt}`);
  const rows=(b.match(/class="fila" data-id=/g)||[]).length;
  assert(rows>=expected.length,`la portada solo contiene ${rows}/${expected.length} trials prerenderizados`);
  assert(b.includes(sampleEntry.path),`la portada no enlaza al trial canónico de muestra ${sample.id}`);
});

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
  assert(b.includes(`data-trial-download="${sample.id}"`),'trial canónico sin descarga PDF completa');
  assert(b.includes('<article class="articulo">'),'trial canónico sin artículo principal');
  assert(b.includes('<link rel="canonical"'),'trial canónico sin canonical');
  if(sample.corto)assert(b.includes(`/resumen.html?id=${sample.id}&amp;v=corto`),'trial canónico sin enlace a lectura breve');
  assert(!b.includes('id="resumen-breve"'),'trial canónico volvió a incrustar el resumen breve');
});

if(sample.corto){
  await check(`/resumen.html?id=${sample.id}&v=corto`,(b)=>{
    assert(b.includes('pdf-contact.js?v=2'),'lector breve no carga el controlador PDF corregido');
    assert(b.includes('data-pdf-version="breve"'),'lector breve perdió su botón PDF');
  });
}

await check('/pdf-contact.js',(b)=>{
  assert(b.includes("link.textContent !== targetText"),'producción no contiene la corrección del ciclo de mutaciones');
  assert(b.includes("link.href !== targetHref"),'producción no contiene la protección idempotente del enlace canónico');
});
await check('/trial-pdf.js',(b)=>{assert(b.includes('data-trial-download'),'controlador PDF canónico inesperado')});

for(const path of ['/medicina-critica/','/medicina-interna/','/metodologia/','/equipo-editorial/']){
  await check(path,(b)=>{assert(/Resúmenes Trials|Resumenes Trials/.test(b),'HTML editorial inesperado')});
}
for(const entry of Object.values(clusters)){
  await check(entry.path,(b)=>{assert(b.includes('cat-grid'),'cluster publicado sin colección de trials')});
}

await check('/sitemap.xml',(b)=>{
  for(const entry of Object.values(manifest))assert(b.includes(entry.url),`sitemap sin ${entry.url}`);
  for(const entry of Object.values(clusters))assert(b.includes(`${BASE}${entry.path}`),`sitemap sin cluster ${entry.path}`);
  for(const path of ['/medicina-critica/','/medicina-interna/','/metodologia/','/equipo-editorial/'])assert(b.includes(`${BASE}${path}`),`sitemap sin ${path}`);
});

await check('/login.html',(b)=>{for(const x of ['turnstile-login','turnstile.js','auth.js'])assert(b.includes(x),`falta ${x}`)});
await check('/registro.html',(b)=>{for(const x of ['turnstile-registro','Crear mi cuenta'])assert(b.includes(x),`falta ${x}`)});
await check('/recuperar.html',(b)=>{assert(b.includes('turnstile-recuperar'),'falta Turnstile de recuperación')});
await check('/cuenta.html',(b)=>{for(const x of ['Datos personales','Notificaciones','Seguridad','Preferencias'])assert(b.includes(x),`falta ${x}`)});
await check('/biblioteca.html');
await check('/turnstile.js',(b)=>{assert(b.includes('0x4AAAAAAEV-hx4kk2dLe8ZF'),'Site Key Turnstile inesperada')});

const slow=checks.filter((x)=>x.ms>5000);
for(const x of slow)console.warn('SLOW',x.path,`${x.ms}ms`);
console.log('\nProducción:',{expected:expected.length,critical:expectedCrit,internal:expectedInt,clusters:Object.keys(clusters).length,checks:checks.length,failures:failures.length,slow:slow.length});
if(failures.length){for(const f of failures)console.error('ERROR',f);process.exit(1)}
console.log('PRODUCTION HEALTH STRICT PASS');
