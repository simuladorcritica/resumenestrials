import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const original=readFileSync('index.html','utf8');
process.once('exit',()=>writeFileSync('index.html',original,'utf8'));
const runtime='<script type="module" src="/interactive-home.js?v=20260927"></script>';
writeFileSync('index.html',readFileSync('_includes/index-source.html','utf8').replace('</body>',runtime+'</body>'),'utf8');

function assert(value,message){if(!value)throw new Error(message)}
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const anonymousAuth=`export function createClient(){return {auth:{async getUser(){return {data:{user:null},error:null}},async getSession(){return {data:{session:null},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}},error:null}},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:null,nextLevel:null},error:null}},async listFactors(){return {data:{totp:[]},error:null}}}}}}`;
  await page.route('https://esm.sh/@supabase/supabase-js@2.112.3*',route=>route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',headers:{'Access-Control-Allow-Origin':'*'},body:anonymousAuth}));
  await page.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded',timeout:25000});
  await page.locator('#rt-advanced').waitFor({timeout:12000});
  assert(await page.locator('.filtros').isVisible(),'Filtros: faltan las áreas clínicas');
  assert(await page.locator('#rt-year').isVisible(),'Filtros: falta el selector de año');
  assert(await page.locator('#rt-journal').isVisible(),'Filtros: falta el selector de revista');
  assert(await page.locator('.buscador').isVisible(),'Filtros: falta la búsqueda');
  const initial=await page.locator('.fila:visible').count();
  assert(initial>0&&initial<=24,`Filtros: el primer bloque debe contener hasta 24 tarjetas (${initial})`);
  assert(await page.locator('#rt-show-more').isVisible(),'Filtros: falta Mostrar más');
  await page.locator('#rt-year').selectOption({index:1});
  await page.waitForTimeout(100);
  assert(/[?&]anio=/.test(page.url()),`Filtros: el año no se reflejó en la URL (${page.url()})`);
  await page.locator('#rt-year').selectOption('');
  await page.locator('#q').fill('SOHO');
  await page.waitForTimeout(150);
  const visible=await page.locator('.fila:visible').allInnerTexts();
  assert(visible.length>0&&visible.every(text=>/SOHO/i.test(text)),`Filtros: búsqueda inesperada (${visible.join(' | ')})`);
  assert(/[?&]q=SOHO/.test(page.url()),`Filtros: la búsqueda no se reflejó en la URL (${page.url()})`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert(!overflow,'Filtros: desborde horizontal en móvil');
  console.log('LIBRARY FILTER PASS · áreas, año, revista, URL y paginación');
}finally{await browser.close()}
