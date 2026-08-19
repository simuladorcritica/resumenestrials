const BASE=process.env.RT_BASE_URL||'https://resumenestrials.com';
const timeout=12000;
const failures=[];
const checks=[];
async function get(path,{json=false}={}){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);const started=Date.now();try{const r=await fetch(BASE+path,{redirect:'follow',signal:c.signal,headers:{'user-agent':'ResumenesTrialsHealth/1.0'}});const ms=Date.now()-started;checks.push({path,status:r.status,ms});if(!r.ok)throw new Error(`HTTP ${r.status}`);return json?await r.json():await r.text()}finally{clearTimeout(t)}}
async function check(path,fn){try{const body=await get(path);if(fn)await fn(body);console.log('PASS',path)}catch(e){failures.push(`${path}: ${e.message}`);console.error('FAIL',path,e.message)}}
await check('/');
await check('/login.html',b=>{for(const x of ['turnstile-login','turnstile.js','auth.js'])if(!b.includes(x))throw new Error(`falta ${x}`)});
await check('/registro.html',b=>{for(const x of ['turnstile-registro','Crear mi cuenta'])if(!b.includes(x))throw new Error(`falta ${x}`)});
await check('/recuperar.html',b=>{if(!b.includes('turnstile-recuperar'))throw new Error('falta Turnstile de recuperación')});
await check('/cuenta.html',b=>{for(const x of ['Datos personales','Notificaciones','Seguridad','Preferencias'])if(!b.includes(x))throw new Error(`falta ${x}`)});
await check('/biblioteca.html');
await check('/turnstile.js',b=>{if(!b.includes('0x4AAAAAAEV-hx4kk2dLe8ZF'))throw new Error('Site Key Turnstile inesperada')});
let articles=[];try{articles=await get('/resumenes.json',{json:true});if(!Array.isArray(articles))throw new Error('JSON no es arreglo');console.log('PASS /resumenes.json',articles.length)}catch(e){failures.push(`/resumenes.json: ${e.message}`)}
for(const r of articles.slice(0,Math.min(12,articles.length))){await check(`/resumen.html?id=${encodeURIComponent(r.id)}`,b=>{if(!b.includes('Resumenes Trials'))throw new Error('HTML inesperado')})}
const slow=checks.filter(x=>x.ms>5000);for(const x of slow)console.warn('SLOW',x.path,`${x.ms}ms`);
console.log('\nResumen:',{checks:checks.length,failures:failures.length,slow:slow.length});
if(failures.length){for(const f of failures)console.error('ERROR',f);process.exit(1)}
