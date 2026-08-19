import { chromium } from 'playwright';
const BASE=process.env.RT_BASE_URL||'https://resumenestrials.com';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource.*favicon/i.test(m.text()))errors.push(`console: ${m.text()}`)});
async function visit(path,fn){console.log('VISIT',path);await page.goto(BASE+path,{waitUntil:'networkidle',timeout:30000});if(fn)await fn();}
await visit('/',async()=>{await page.waitForSelector('#indice',{timeout:15000});const rows=await page.locator('.fila').count();if(rows<1)throw new Error('La portada no renderizó resúmenes');if(!await page.locator('#rt-user-panel').count())throw new Error('No cargó panel interactivo')});
await visit('/login.html?smoke=1',async()=>{await page.waitForSelector('#turnstile-login',{timeout:10000});await page.waitForTimeout(2500);const text=await page.locator('#turnstile-login').innerText().catch(()=> '');if(/400020|no se pudo cargar/i.test(text))throw new Error(`Turnstile falló: ${text}`)});
await visit('/registro.html?smoke=1',async()=>{await page.waitForSelector('#turnstile-registro',{timeout:10000})});
await visit('/recuperar.html?smoke=1',async()=>{await page.waitForSelector('#turnstile-recuperar',{timeout:10000})});
await visit('/biblioteca.html',async()=>{await page.waitForURL(/login\.html/,{timeout:10000})});
await browser.close();
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Browser smoke PASS');
