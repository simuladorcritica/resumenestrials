import { chromium } from 'playwright';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';

const ROOT=process.cwd();
const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const errors=[];
const warnings=[];
const fail=(area,msg)=>errors.push(`${area}: ${msg}`);
const warn=(area,msg)=>warnings.push(`${area}: ${msg}`);
const read=p=>readFileSync(join(ROOT,p),'utf8');

function walk(dir='.'){
  const out=[];
  for(const entry of readdirSync(join(ROOT,dir),{withFileTypes:true})){
    if(['.git','node_modules','.jekyll-cache','vendor','_includes'].includes(entry.name))continue;
    const rel=dir==='.'?entry.name:join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(rel));else out.push(rel.replaceAll('\\','/'));
  }
  return out;
}

function resolveLocal(from,value){
  if(!value||/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(value))return null;
  const clean=value.split('#')[0].split('?')[0];
  if(!clean)return null;
  let rel=clean.startsWith('/')?clean.slice(1):normalize(join(dirname(from),clean)).replaceAll('\\','/');
  if(rel.endsWith('/'))rel+= 'index.html';
  if(existsSync(join(ROOT,rel)))return rel;
  if(!extname(rel)&&existsSync(join(ROOT,rel,'index.html')))return `${rel}/index.html`;
  return rel;
}

function staticAudit(){
  const files=walk();
  const html=files.filter(f=>f.endsWith('.html'));
  for(const file of html){
    const source=read(file);
    if(/\bundefined\b|\bNaN\b|\[object Object\]/.test(source))warn(file,'contiene un literal JavaScript que debe revisarse');
    const ids=[...source.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]);
    const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
    if(dup.length)fail(file,`IDs duplicados: ${dup.join(', ')}`);
    for(const match of source.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)){
      const value=match[1];
      if(value.includes('{{')||value.includes('{%'))continue;
      const resolved=resolveLocal(file,value);
      if(resolved&&!existsSync(join(ROOT,resolved)))fail(file,`recurso/enlace interno inexistente: ${value} -> ${resolved}`);
    }
  }

  const registration=read('registro.html').toLowerCase();
  for(const token of ['spam','correo no deseado','promociones'])if(!registration.includes(token))fail('registro','falta aviso posterior al registro sobre '+token);

  const turnstile=read('turnstile.js');
  if(!/CAPTCHA_ENABLED\s*=\s*false/.test(turnstile))fail('captcha','Turnstile no está en el estado controlado esperado mientras el Secret Key es inválido');
  const diagnostic=read('turnstile-check.html');
  if(/challenges\.cloudflare\.com/.test(diagnostic))fail('captcha','la página diagnóstica sigue cargando el widget desactivado');

  const biblioteca=read('biblioteca.html');
  if(!biblioteca.includes('especialidad_principal')||!biblioteca.includes('r.temas'))fail('biblioteca','no utiliza el esquema actual de especialidad/temas');
  const recommendations=read('recommendations.js');
  if(!recommendations.includes('especialidad_principal')||!recommendations.includes('r.temas'))fail('recomendaciones','no utiliza el esquema actual de especialidad/temas');

  const auth=read('auth.js');
  const login=read('login.html');
  if(!auth.includes('getMfaLoginState')||!auth.includes('verifyMfaLoginCode')||!login.includes('mfa-form'))fail('2FA','el segundo factor no está integrado en el inicio de sesión');

  const privacy=read('privacidad.html');
  if(!/Resend/.test(privacy))fail('privacidad','no declara al proveedor real de envío de correos');

  const data=JSON.parse(read('resumenes.json'));
  const manifest=JSON.parse(read('seo-manifest.json'));
  if(!Array.isArray(data)||!data.length)fail('datos','resumenes.json no contiene registros');
  for(const r of data){
    if(r.id==null)fail('datos','registro sin id');
    if(!r.titulo)fail(`trial ${r.id}`,'sin título');
    if(!r.revista)fail(`trial ${r.id}`,'sin revista');
    if(!r.especialidad_principal)warn(`trial ${r.id}`,'sin especialidad principal');
    const entry=manifest[String(r.id)];
    if(!entry?.path)fail(`trial ${r.id}`,'sin ruta canónica en seo-manifest');
    else if(!existsSync(join(ROOT,entry.path.replace(/^\//,''),'index.html')))fail(`trial ${r.id}`,`ruta canónica no existe: ${entry.path}`);
  }
}

async function browserAudit(){
  const data=JSON.parse(read('resumenes.json'));
  const manifest=JSON.parse(read('seo-manifest.json'));
  const clusters=JSON.parse(read('seo-cluster-manifest.json'));
  const firstTrial=manifest[String(data[0].id)]?.path;
  const firstCluster=Object.values(clusters).find(x=>x?.path)?.path;
  const publicRoutes=['/index.html','/login.html','/registro.html','/recuperar.html','/privacidad.html','/metodologia/','/equipo-editorial/','/medicina-critica/','/medicina-interna/',firstCluster,firstTrial].filter(Boolean);
  const viewports=[{name:'desktop',width:1440,height:1000},{name:'tablet',width:1024,height:900},{name:'mobile',width:390,height:844}];
  const browser=await chromium.launch({headless:true});
  try{
    for(const viewport of viewports){
      const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
      await page.route('https://fonts.googleapis.com/**',r=>r.abort());
      await page.route('https://fonts.gstatic.com/**',r=>r.abort());
      const pageErrors=[];
      page.on('pageerror',e=>pageErrors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_FAILED|Failed to load resource/i.test(m.text()))pageErrors.push(m.text())});
      for(const route of publicRoutes){
        pageErrors.length=0;
        const response=await page.goto(`${BASE}${route}`,{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>{fail(`${viewport.name} ${route}`,`navegación: ${e.message}`);return null});
        if(response&&response.status()>=400)fail(`${viewport.name} ${route}`,`HTTP ${response.status()}`);
        await page.waitForTimeout(300);
        const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,title:document.title,body:(document.body?.innerText||'').slice(0,5000)})).catch(()=>null);
        if(metrics){
          if(metrics.overflow>4)fail(`${viewport.name} ${route}`,`overflow horizontal ${metrics.overflow}px`);
          if(!metrics.title.trim())fail(`${viewport.name} ${route}`,'documento sin title');
          if(/\bundefined\b|\bNaN\b|\[object Object\]/.test(metrics.body))fail(`${viewport.name} ${route}`,'valor JavaScript visible al usuario');
        }
        if(pageErrors.length)fail(`${viewport.name} ${route}`,`errores JS: ${[...new Set(pageErrors)].join(' | ')}`);
      }
      await page.close();
    }

    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.goto(`${BASE}/registro.html`,{waitUntil:'domcontentloaded'});
    const note=await page.locator('.mail-note').innerText().catch(()=> '');
    if(!/spam/i.test(note)||!/correo no deseado/i.test(note)||!/promociones/i.test(note))fail('registro navegador','el aviso de carpetas alternativas no está renderizado');

    await page.goto(`${BASE}/biblioteca.html`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(700);
    if(!/login\.html/.test(page.url()))fail('biblioteca','usuario no autenticado no fue enviado a login');

    await page.goto(`${BASE}/cuenta.html`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(700);
    if(!/login\.html/.test(page.url()))fail('cuenta','usuario no autenticado no fue enviado a login');
    await page.close();
  }finally{await browser.close()}
}

staticAudit();
await browserAudit();
for(const w of warnings)console.warn('WARN',w);
if(errors.length){for(const e of errors)console.error('FAIL',e);console.error(`FULL SITE AUDIT FAIL · ${errors.length} errores · ${warnings.length} advertencias`);process.exit(1)}
console.log(`FULL SITE AUDIT PASS · ${warnings.length} advertencias no bloqueantes`);
