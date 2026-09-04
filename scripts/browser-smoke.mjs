import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { installTurnstileTestRoutes } from './turnstile-test-helpers.mjs';
import { belongsToCategory } from './article-inventory.mjs';

const BASE=(process.env.RT_BASE_URL||'https://resumenestrials.com').replace(/\/$/,'');
if (process.env.RT_BASE_URL) {
  const originalIndex=readFileSync('index.html','utf8');
  process.once('exit',()=>writeFileSync('index.html',originalIndex,'utf8'));
  const homeModules='<script type="module" src="/home-auth-ui.js?v=8"></script><script type="module" src="/interactive-home.js?v=20260819.4"></script><script src="/library-filter-cleanup.js?v=1" defer></script><script type="module" src="/recommendations.js?v=2"></script><script src="/specialty-classification.js?v=2"></script><script type="module" src="/internal-medicine-ux.js?v=2"></script><script type="module" src="/home-visual-tuning.js?v=1"></script><script src="/pdf-contact.js?v=2" defer></script><script src="/home-control-layout.js?v=1" defer></script>';
  writeFileSync('index.html',readFileSync('_includes/index-source.html','utf8').replace('</body>',`${homeModules}</body>`),'utf8');
}
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const expectedCrit=data.filter((record)=>belongsToCategory(record,'Medicina Crítica')).length;
const expectedInt=data.filter((record)=>belongsToCategory(record,'Medicina Interna')).length;
const sample=data.find((r)=>r.corto)||data[0];
const entry=manifest[String(sample.id)];

function assert(condition,message){if(!condition)throw new Error(message)}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
if (process.env.RT_BASE_URL) {
  await installTurnstileTestRoutes(page, BASE);
  await page.route('https://pagead2.googlesyndication.com/**',route=>route.fulfill({contentType:'application/javascript',body:''}));
}
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(30000);
const errors=[];
page.on('pageerror',(e)=>errors.push(`pageerror: ${e.message}`));
page.on('console',(m)=>{
  const text=m.text();
  const harmless=/%c%d font-size:0;color:transparent NaN/.test(text)||/favicon/i.test(text)||/Failed to load resource.*429/i.test(text);
  if(m.type()==='error'&&!harmless)errors.push(`console: ${text}`);
});
async function visit(path,fn){
  console.log('VISIT',path);
  await page.goto(`${BASE}${path}${path.includes('?')?'&':'?'}rtcheck=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  if(fn)await fn();
}
async function noHorizontalOverflow(label){
  const values=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth}));
  assert(values.scrollWidth<=values.innerWidth+2,`${label}: overflow horizontal ${values.scrollWidth}px > ${values.innerWidth}px`);
}
async function validateTurnstile(containerId){
  const slot=page.locator(`#${containerId}`);
  await slot.waitFor({state:'attached',timeout:10000});
  await page.waitForTimeout(500);
  const status=await slot.getAttribute('data-turnstile-status');
  if(status==='disabled'){
    assert(await slot.isHidden(),`${containerId}: Turnstile desactivado pero visible`);
    console.log(`TURNSTILE ${containerId}: disabled by configuration (PASS)`);
    return;
  }
  await slot.waitFor({state:'visible',timeout:10000});
  await page.waitForTimeout(2500);
  const text=await slot.innerText().catch(()=> '');
  const finalStatus=await slot.getAttribute('data-turnstile-status');
  assert(!/400020|invalid sitekey|no se pudo cargar/i.test(text),`${containerId}: Turnstile falló: ${text}`);
  assert(finalStatus!=='error',`${containerId}: Turnstile reporta error`);
}

await visit('/',async()=>{
  await page.waitForSelector('#indice .fila',{timeout:20000});
  await page.waitForSelector('#rt-advanced',{timeout:10000});
  assert(await page.locator('#indice .fila').count()>=data.length,`portada solo renderiza ${await page.locator('#indice .fila').count()}/${data.length} trials`);
  assert((await page.locator('#conteo').innerText()).trim()===String(data.length),'contador total incorrecto');
  assert((await page.locator('#conteo-crit').innerText()).trim()===String(expectedCrit),'contador Medicina Crítica incorrecto');
  assert((await page.locator('#conteo-int').innerText()).trim()===String(expectedInt),'contador Medicina Interna incorrecto');
  if(await page.locator('#rt-user-panel').count())throw new Error('La portada conserva el banner duplicado de autenticación');
  const editorial=await page.locator('#account-entry').count(),legacyCreate=await page.locator('#cuenta-link').count(),legacyLogin=await page.locator('#login-link').count();
  const legacyOk=legacyCreate===1&&legacyLogin===1;
  assert(editorial===1||legacyOk,`Cabecera de cuenta incorrecta: editorial=${editorial}, crear=${legacyCreate}, entrar=${legacyLogin}`);
  assert(editorial<=1,`Módulo editorial de cuenta duplicado: ${editorial}`);
  assert(!(await page.locator('#q').isVisible()),'el buscador local redundante volvió a ser visible');
  const search=page.locator('.rt-global-search-input');
  await search.waitFor({state:'visible'});
  await search.fill('SOHO');
  await page.waitForSelector('.rt-global-search-result',{timeout:10000});
  const firstGlobal=(await page.locator('.rt-global-search-result-title').first().innerText()).trim();
  assert(/SOHO/i.test(firstGlobal),`el buscador global devuelve un resultado inesperado para SOHO: ${firstGlobal}`);
  await search.press('Escape');
  await noHorizontalOverflow('portada escritorio');
});

await visit(entry.path,async()=>{
  await page.waitForSelector(`[data-trial-download="${sample.id}"]`);
  assert(await page.locator('.migas').first().isVisible(),'trial canónico sin breadcrumb');
  assert(await page.locator('article.articulo').first().isVisible(),'trial canónico sin artículo');
  assert(!(await page.locator('#resumen-breve,.resumen-breve').count()),'trial canónico volvió a incrustar el resumen breve');
  if(sample.corto){
    const brief=page.locator('.trial-action-brief').first();
    assert(await brief.isVisible(),'trial canónico sin enlace visible a lectura breve');
    const href=await brief.getAttribute('href');
    assert(href===`/resumen.html?id=${sample.id}&v=corto`||href===`/resumen.html?id=${sample.id}&amp;v=corto`,`enlace breve incorrecto: ${href}`);
  }
  await noHorizontalOverflow('trial canónico escritorio');
});

if(sample.corto){
  await visit(`/resumen.html?id=${sample.id}&v=corto`,async()=>{
    await page.waitForSelector('body.modo-corto',{timeout:12000});
    await page.waitForSelector('[data-pdf-version="breve"]',{state:'visible',timeout:12000});
    assert(await page.locator('article.corto').first().isVisible(),'lector breve perdió su artículo monocolumna');
    assert(!(await page.locator('[data-pdf-version="completo"]').first().isVisible().catch(()=>false)),'lector breve muestra indebidamente PDF completo');
    const full=page.locator('.cambio-version').first();
    await page.waitForFunction(()=>{const a=document.querySelector('.cambio-version');return a&&/\/trials\//.test(a.href)},{timeout:12000});
    const resolved=new URL(await full.getAttribute('href'),BASE).pathname;
    assert(resolved===entry.path,`lector breve no regresa al canónico: ${resolved}`);
    const before=await full.innerText();
    await page.waitForTimeout(800);
    const after=await full.innerText();
    assert(before===after&&/Ver versión completa/i.test(after),'enlace de versión inestable');
    await noHorizontalOverflow('lector breve escritorio');
  });
}

await page.setViewportSize({width:390,height:844});
await visit('/',async()=>{
  await page.waitForSelector('#indice .fila',{timeout:20000});
  assert((await page.locator('#conteo').innerText()).trim()===String(data.length),'contador móvil incorrecto');
  assert(!(await page.locator('#q').isVisible()),'el buscador local redundante volvió a ser visible en móvil');
  assert(await page.locator('#rt-year').isVisible()&&await page.locator('#rt-journal').isVisible(),'los filtros año/revista no son visibles en móvil');
  await noHorizontalOverflow('portada móvil');
});
await visit(entry.path,async()=>{
  await page.waitForSelector(`[data-trial-download="${sample.id}"]`);
  await noHorizontalOverflow('trial canónico móvil');
});

await page.setViewportSize({width:1440,height:1000});
await visit('/login.html?smoke=1',async()=>{await validateTurnstile('turnstile-login')});
await visit('/registro.html?smoke=1',async()=>{await validateTurnstile('turnstile-registro')});
await visit('/recuperar.html?smoke=1',async()=>{await validateTurnstile('turnstile-recuperar')});
await visit('/biblioteca.html',async()=>{await page.waitForURL(/login\.html/,{timeout:12000})});

await browser.close();
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Browser smoke STRICT PASS · ${data.length} trials · desktop + mobile · canonical + short reader + auth`);
