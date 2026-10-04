import { chromium } from 'playwright';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { installTurnstileTestRoutes } from './turnstile-test-helpers.mjs';

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
    if(['.git','node_modules','.jekyll-cache','vendor','_includes','templates'].includes(entry.name))continue;
    const rel=dir==='.'?entry.name:join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(rel));else out.push(rel.replaceAll('\\','/'));
  }
  return out;
}

function resolveLocal(from,value){
  if(!value||/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(value))return null;
  if(value.includes('${')||value.includes('{{')||value.includes('{%'))return null;
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
      const resolved=resolveLocal(file,value);
      if(resolved&&!existsSync(join(ROOT,resolved)))fail(file,`recurso/enlace interno inexistente: ${value} -> ${resolved}`);
    }
  }

  const registration=read('registro.html').toLowerCase();
  for(const token of ['spam','correo no deseado','promociones'])if(!registration.includes(token))fail('registro','falta aviso posterior al registro sobre '+token);

  const turnstile=read('turnstile.js');
  const turnstileConfig=read('turnstile-config.js');
  if(!turnstile.includes("import { TURNSTILE_SITE_KEY } from './turnstile-config.js'"))fail('captcha','Turnstile no consume la configuraciÃƒÂ³n pÃƒÂºblica centralizada');
  if(!/TURNSTILE_SITE_KEY\s*=\s*["']0x[\w-]+["']/.test(turnstileConfig))fail('captcha','falta una Site Key pÃƒÂºblica de Turnstile vÃƒÂ¡lida');
  if(/CAPTCHA_ENABLED\s*=\s*false/.test(turnstile))fail('captcha','Turnstile permanece desactivado de forma explÃƒÂ­cita');
  const diagnostic=read('turnstile-check.html');
  if(/challenges\.cloudflare\.com/.test(diagnostic))fail('captcha','la pÃƒÂ¡gina diagnÃƒÂ³stica sigue cargando el widget desactivado');

  const biblioteca=read('biblioteca.html');
  if(!/<script\b[^>]*type=["']module["'][^>]*src=["']\/library-page\.js\?v=20261003-laboratorio-v1["'][^>]*>/.test(biblioteca))fail('biblioteca','no carga el mÃƒÂ³dulo de biblioteca');
  const bibliotecaModule=read('library-page.js');
  if(!bibliotecaModule.includes('especialidad_principal')||!bibliotecaModule.includes('r.temas'))fail('biblioteca','no utiliza el esquema actual de especialidad/temas');
  const recommendations=read('recommendations.js');
  if(!recommendations.includes('especialidad_principal')||!recommendations.includes('r.temas'))fail('recomendaciones','no utiliza el esquema actual de especialidad/temas');

  const auth=read('auth.js');
  const login=read('login.html');
  if(!auth.includes('getMfaLoginState')||!auth.includes('verifyMfaLoginCode')||!login.includes('mfa-form'))fail('2FA','el segundo factor no estÃƒÂ¡ integrado en el inicio de sesiÃƒÂ³n');

  const privacy=read('privacidad/index.html');
  if(!/Resend/.test(privacy))fail('privacidad','no declara al proveedor real de envÃƒÂ­o de correos');

  const data=JSON.parse(read('resumenes.json'));
  const manifest=JSON.parse(read('seo-manifest.json'));
  if(!Array.isArray(data)||!data.length)fail('datos','resumenes.json no contiene registros');
  for(const r of data){
    if(r.id==null)fail('datos','registro sin id');
    if(!r.titulo)fail(`trial ${r.id}`,'sin tÃƒÂ­tulo');
    if(!r.revista)fail(`trial ${r.id}`,'sin revista');
    if(!r.especialidad_principal)warn(`trial ${r.id}`,'sin especialidad principal');
    const entry=manifest[String(r.id)];
    if(!entry?.path)fail(`trial ${r.id}`,'sin ruta canÃƒÂ³nica en seo-manifest');
    else if(!existsSync(join(ROOT,entry.path.replace(/^\//,''),'index.html')))fail(`trial ${r.id}`,`ruta canÃƒÂ³nica no existe: ${entry.path}`);
  }
}


import {runSuite} from './design-browser-suites.mjs';
staticAudit();
if(errors.length)throw Error(errors.join('\n'));
await runSuite('shell');
writeFileSync('full-site-audit.json',JSON.stringify({errors,warnings,staticAudit:true},null,2));
console.log('FULL SITE AUDIT PASS');

