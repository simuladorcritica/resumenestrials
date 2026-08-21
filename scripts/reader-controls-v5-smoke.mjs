import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const sample=data.find(x=>x.corto&&manifest[String(x.id)]?.path);
if(!sample) throw new Error('No existe trial con resumen breve para probar lector v5');
const trialPath=manifest[String(sample.id)].path;

function assert(value,message){if(!value)throw new Error(message)}
async function noOverflow(page,label){
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(d.scroll<=d.client+2&&d.body<=d.client+2,`${label}: overflow horizontal ${JSON.stringify(d)}`);
}
async function waitV5(page){
  await page.waitForFunction(()=>document.querySelector('.pie-nav')?.dataset.rtReaderNav==='v5',{timeout:15000});
}

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));

  // Resumen completo: navegación y descarga inferior deben reproducir la composición del resumen breve.
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-trial',{timeout:12000});
  await waitV5(page);
  await page.waitForSelector('.rt-reader-bottom-actions[data-rt-reader-bottom-actions="v6"] .rt-reader-footer-download',{state:'visible',timeout:12000});
  const fullFooter=await page.evaluate(()=>{
    const nav=document.querySelector('.pie-nav');
    const back=nav?.querySelector('.rt-reader-back');
    const version=nav?.querySelector('.rt-reader-version');
    const actions=document.querySelector('.rt-reader-bottom-actions');
    const download=actions?.querySelector('.rt-reader-footer-download');
    const footer=document.querySelector('.art-footer');
    if(!nav||!back||!actions||!download)return null;
    const nr=nav.getBoundingClientRect(),br=back.getBoundingClientRect(),ar=actions.getBoundingClientRect(),dr=download.getBoundingClientRect(),fr=footer?.getBoundingClientRect();
    const ns=getComputedStyle(nav),bs=getComputedStyle(back),as=getComputedStyle(actions),ds=getComputedStyle(download);
    return {
      navWidth:nr.width,backWidth:br.width,font:parseFloat(bs.fontSize),color:bs.color,
      borderTop:parseFloat(ns.borderTopWidth),backText:back.textContent.trim(),
      versionText:version?.textContent.trim()||'',versionVisible:!!version&&version.getBoundingClientRect().width>0,
      downloadText:download.textContent.trim(),downloadVisible:dr.width>0&&dr.height>0,
      downloadData:download.getAttribute('data-trial-download')||'',downloadBg:ds.backgroundImage,downloadFont:parseFloat(ds.fontSize),
      actionsBelowNav:ar.top>=nr.bottom-2,downloadLeftAligned:Math.abs(dr.left-ar.left)<=2,
      bottomBorder:parseFloat(as.borderBottomWidth),footerBelow:!fr||fr.top>=ar.bottom-2
    };
  });
  assert(fullFooter,'Completo: falta navegación inferior v5/v6');
  assert(fullFooter.navWidth>500,`Completo: navegación inferior demasiado estrecha (${fullFooter.navWidth}px)`);
  assert(fullFooter.font>=15,`Completo: Volver al índice sigue demasiado pequeño (${fullFooter.font}px)`);
  assert(fullFooter.borderTop>=1,'Completo: falta separador superior de navegación');
  assert(/Volver al índice/i.test(fullFooter.backText),'Completo: texto de regreso incorrecto');
  assert(fullFooter.versionVisible&&/resumen breve/i.test(fullFooter.versionText),'Completo: falta acceso simétrico al resumen breve en el pie');
  assert(fullFooter.downloadVisible,'Completo: falta botón inferior de descarga PDF');
  assert(/Descargar resumen completo PDF/i.test(fullFooter.downloadText),`Completo: texto de descarga inferior incorrecto (${fullFooter.downloadText})`);
  assert(fullFooter.downloadData===String(sample.id),`Completo: botón inferior no conserva el trial id (${fullFooter.downloadData})`);
  assert(fullFooter.downloadFont>=15,'Completo: botón inferior de PDF demasiado pequeño');
  assert(fullFooter.actionsBelowNav,'Completo: la descarga no está debajo de la navegación');
  assert(fullFooter.downloadLeftAligned,'Completo: el botón de descarga no está alineado a la izquierda');
  assert(fullFooter.bottomBorder>=1,'Completo: falta separador inferior bajo la descarga');
  assert(fullFooter.footerBelow,'Completo: el aviso editorial no está debajo de la descarga');
  await noOverflow(page,'Resumen completo desktop');

  // El botón inferior debe usar exactamente el mismo contrato de descarga que el botón superior.
  const downloadContract=await page.evaluate(()=>{
    const top=document.querySelector('.art-head [data-trial-download]');
    const bottom=document.querySelector('.rt-reader-footer-download');
    return {top:top?.getAttribute('data-trial-download')||'',bottom:bottom?.getAttribute('data-trial-download')||'',tag:bottom?.tagName||'',type:bottom?.getAttribute('type')||''};
  });
  assert(downloadContract.top===downloadContract.bottom,'Completo: botón inferior y superior no descargan el mismo resumen');
  assert(downloadContract.tag==='BUTTON','Completo: descarga inferior no es un botón');

  // Resumen breve: guardar en biblioteca + progreso circular/lineal + navegación por secciones.
  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-legacy.modo-corto',{timeout:15000});
  await page.waitForSelector('.rt-reader-rail[data-v4="1"]',{timeout:15000});
  await page.waitForSelector('header.art .rt-save-action',{state:'visible',timeout:15000});
  await waitV5(page);

  const save=page.locator('header.art .rt-save-action');
  assert(/Guardar en biblioteca|Guardado/i.test((await save.innerText()).trim()),'Breve: texto de Guardar en biblioteca incorrecto');
  assert(await save.getAttribute('aria-pressed')!==null,'Breve: botón Guardar sin estado accesible');

  const progressBefore=await page.evaluate(()=>{
    const ring=document.querySelector('.rt-progress-ring');
    const value=document.querySelector('.rt-progress-value')||ring?.querySelector('strong');
    const track=document.querySelector('.rt-progress-track span,.rt-progress-line span');
    return {text:value?.textContent||'',p:ring?.style.getPropertyValue('--p')||'',track:track?.style.width||''};
  });
  assert(/^\d+%$/.test(progressBefore.text),`Breve: progreso inicial inválido (${progressBefore.text})`);
  assert(progressBefore.p!=='','Breve: el anillo no recibe la variable de progreso --p');

  await page.evaluate(()=>{
    const article=document.querySelector('article.corto');
    window.scrollTo({top:article.offsetTop+article.offsetHeight,behavior:'auto'});
  });
  await page.waitForTimeout(350);
  const progressAfter=await page.evaluate(()=>{
    const ring=document.querySelector('.rt-progress-ring');
    const value=document.querySelector('.rt-progress-value')||ring?.querySelector('strong');
    const track=document.querySelector('.rt-progress-track span,.rt-progress-line span');
    return {value:parseInt(value?.textContent||'0',10),p:parseFloat(ring?.style.getPropertyValue('--p')||'0'),track:parseFloat(track?.style.width||'0')};
  });
  const initial=parseInt(progressBefore.text,10);
  assert(progressAfter.value>initial,`Breve: el progreso no avanza (${initial}% → ${progressAfter.value}%)`);
  assert(progressAfter.value>=75,`Breve: el progreso no refleja lectura avanzada (${progressAfter.value}%)`);
  assert(Math.abs(progressAfter.value-progressAfter.p)<=1,`Breve: anillo y porcentaje no coinciden (${progressAfter.p} vs ${progressAfter.value})`);
  assert(progressAfter.track>=progressAfter.value-1,`Breve: barra y porcentaje no coinciden (${progressAfter.track} vs ${progressAfter.value})`);

  const firstNav=page.locator('.rt-rail-nav a').first();
  const target=await firstNav.getAttribute('href');
  assert(target?.startsWith('#'),'Breve: enlace interno de sección inválido');
  await firstNav.click();
  await page.waitForTimeout(180);
  assert((await page.evaluate(()=>location.hash))===target,'Breve: navegación de secciones no actualiza el destino');

  const shortFooter=await page.evaluate(()=>{
    const nav=document.querySelector('.pie-nav'),back=nav?.querySelector('.rt-reader-back'),version=nav?.querySelector('.rt-reader-version');
    return {back:back?.textContent.trim()||'',version:version?.textContent.trim()||'',width:nav?.getBoundingClientRect().width||0};
  });
  assert(/Volver al índice/i.test(shortFooter.back),'Breve: falta Volver al índice unificado');
  assert(/versión completa/i.test(shortFooter.version),'Breve: falta enlace a versión completa en el pie');
  assert(shortFooter.width>500,'Breve: navegación inferior no usa el ancho disponible');
  await noOverflow(page,'Resumen breve desktop');

  // El botón debe conservar el contrato existente: sin sesión lleva a iniciar sesión.
  await page.evaluate(()=>window.scrollTo(0,0));
  await Promise.all([
    page.waitForURL(url=>/\/login\.html/.test(url.pathname),{timeout:15000}),
    save.click()
  ]);

  // Responsive: controles legibles y sin desbordamiento.
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.rt-reader-footer-download',{state:'visible',timeout:15000});
  const mobileFullDownload=await page.locator('.rt-reader-footer-download').boundingBox();
  assert(mobileFullDownload&&mobileFullDownload.width>=330,`Completo móvil: descarga inferior demasiado estrecha (${JSON.stringify(mobileFullDownload)})`);
  await noOverflow(page,'Resumen completo móvil');

  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('header.art .rt-save-action',{state:'visible',timeout:15000});
  await page.waitForSelector('.rt-reader-rail[data-v4="1"]',{timeout:15000});
  const mobileSave=await page.locator('header.art .rt-save-action').boundingBox();
  assert(mobileSave&&mobileSave.width>=330,`Breve móvil: Guardar en biblioteca demasiado estrecho (${JSON.stringify(mobileSave)})`);
  await noOverflow(page,'Resumen breve móvil');

  assert(errors.length===0,`Errores JavaScript: ${errors.join(' | ')}`);
  console.log(`READER CONTROLS V6 PASS · trial ${sample.id} · pie completo igualado + descarga inferior + guardar + progreso ${progressAfter.value}% + navegación + móvil`);
} finally {
  await browser.close();
}
