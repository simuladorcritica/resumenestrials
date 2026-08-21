import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const sample=data.find(x=>x.corto&&manifest[String(x.id)]?.path);
if(!sample) throw new Error('No existe trial con resumen breve para probar lector v7');
const trialPath=manifest[String(sample.id)].path;

function assert(value,message){if(!value)throw new Error(message)}
async function noOverflow(page,label){
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(d.scroll<=d.client+2&&d.body<=d.client+2,`${label}: overflow horizontal ${JSON.stringify(d)}`);
}
async function waitV5(page){
  await page.waitForFunction(()=>document.querySelector('.pie-nav')?.dataset.rtReaderNav==='v5',{timeout:15000});
}
async function waitV7Full(page){
  await page.waitForFunction(()=>document.querySelector('.pie-nav')?.dataset.rtEndmatterOrder==='v7',{timeout:15000});
}

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));

  // Resumen completo: fuente primaria seguida inmediatamente por navegación, descarga y evidencia relacionada.
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-trial',{timeout:12000});
  await waitV5(page);
  await page.waitForSelector('.rt-reader-bottom-actions[data-rt-reader-bottom-actions="v6"] .rt-reader-footer-download',{state:'visible',timeout:12000});
  await waitV7Full(page);
  const fullFooter=await page.evaluate(()=>{
    const original=document.querySelector('.enlace-original');
    const nav=document.querySelector('.pie-nav');
    const back=nav?.querySelector('.rt-reader-back');
    const version=nav?.querySelector('.rt-reader-version');
    const actions=document.querySelector('.rt-reader-bottom-actions');
    const download=actions?.querySelector('.rt-reader-footer-download');
    const related=document.querySelector('.relacionados');
    const footer=document.querySelector('.art-footer');
    if(!original||!nav||!back||!actions||!download||!related)return null;
    const or=original.getBoundingClientRect(),nr=nav.getBoundingClientRect(),ar=actions.getBoundingClientRect(),dr=download.getBoundingClientRect(),rr=related.getBoundingClientRect(),fr=footer?.getBoundingClientRect();
    const ns=getComputedStyle(nav),bs=getComputedStyle(back),as=getComputedStyle(actions),ds=getComputedStyle(download);
    return {
      navWidth:nr.width,font:parseFloat(bs.fontSize),borderTop:parseFloat(ns.borderTopWidth),backText:back.textContent.trim(),
      versionText:version?.textContent.trim()||'',versionVisible:!!version&&version.getBoundingClientRect().width>0,
      downloadText:download.textContent.trim(),downloadVisible:dr.width>0&&dr.height>0,
      footerPdfId:download.getAttribute('data-rt-footer-download')||'',downloadFont:parseFloat(ds.fontSize),
      originalThenNav:original.nextElementSibling===nav,navThenActions:nav.nextElementSibling===actions,
      actionsThenRelated:actions.nextElementSibling===related,navBelowOriginal:nr.top>=or.bottom-2,
      actionsBelowNav:ar.top>=nr.bottom-2,downloadLeftAligned:Math.abs(dr.left-ar.left)<=2,
      bottomBorder:parseFloat(as.borderBottomWidth),relatedBelow:rr.top>=ar.bottom-2,
      footerBelow:!fr||fr.top>=rr.bottom-2,confidenceCount:document.querySelectorAll('.confianza').length,
      noteText:document.body.innerText.includes('NOTA EDITORIAL')||document.body.innerText.includes('Transparencia editorial')
    };
  });
  assert(fullFooter,'Completo: falta estructura final v7');
  assert(fullFooter.navWidth>500,`Completo: navegación inferior demasiado estrecha (${fullFooter.navWidth}px)`);
  assert(fullFooter.font>=15,`Completo: Volver al índice sigue demasiado pequeño (${fullFooter.font}px)`);
  assert(fullFooter.borderTop===0,`Completo: apareció una línea extra entre fuente primaria y navegación (${fullFooter.borderTop}px)`);
  assert(/Volver al índice/i.test(fullFooter.backText),'Completo: texto de regreso incorrecto');
  assert(fullFooter.versionVisible&&/resumen breve/i.test(fullFooter.versionText),'Completo: falta acceso al resumen breve');
  assert(fullFooter.downloadVisible,'Completo: falta botón inferior de descarga PDF');
  assert(/Descargar resumen completo PDF/i.test(fullFooter.downloadText),`Completo: texto de descarga incorrecto (${fullFooter.downloadText})`);
  assert(fullFooter.footerPdfId===String(sample.id),`Completo: botón inferior no conserva el trial id (${fullFooter.footerPdfId})`);
  assert(fullFooter.downloadFont>=15,'Completo: botón inferior de PDF demasiado pequeño');
  assert(fullFooter.originalThenNav,'Completo: Volver al índice no está inmediatamente debajo del artículo original');
  assert(fullFooter.navThenActions,'Completo: descarga no sigue inmediatamente a la navegación');
  assert(fullFooter.actionsThenRelated,'Completo: Evidencia relacionada no quedó después de los controles');
  assert(fullFooter.navBelowOriginal&&fullFooter.actionsBelowNav&&fullFooter.relatedBelow,'Completo: orden vertical del final incorrecto');
  assert(fullFooter.downloadLeftAligned,'Completo: el botón de descarga no está alineado a la izquierda');
  assert(fullFooter.bottomBorder>=1,'Completo: falta separador inferior bajo la descarga');
  assert(fullFooter.footerBelow,'Completo: el aviso final no está después de la evidencia relacionada');
  assert(fullFooter.confidenceCount===0,'Completo: sigue presente el bloque de nota/transparencia editorial');
  assert(!fullFooter.noteText,'Completo: sigue visible texto de nota editorial');
  await noOverflow(page,'Resumen completo desktop');

  // Debe existir un solo disparador real del PDF; el botón inferior delega en él.
  const downloadContract=await page.evaluate(()=>{
    const real=[...document.querySelectorAll('[data-trial-download]')];
    const top=document.querySelector('.art-head [data-trial-download]');
    const bottom=document.querySelector('.rt-reader-footer-download');
    return {
      realCount:real.length,
      top:top?.getAttribute('data-trial-download')||'',
      bottom:bottom?.getAttribute('data-rt-footer-download')||'',
      tag:bottom?.tagName||'',
      hasRealAttr:bottom?.hasAttribute('data-trial-download')||false
    };
  });
  assert(downloadContract.realCount===1,`Completo: debe existir un único disparador PDF real (${downloadContract.realCount})`);
  assert(downloadContract.top===downloadContract.bottom,'Completo: botón inferior y superior no apuntan al mismo resumen');
  assert(downloadContract.tag==='BUTTON','Completo: descarga inferior no es un botón');
  assert(!downloadContract.hasRealAttr,'Completo: el botón inferior duplicó el atributo del disparador PDF');

  // Resumen breve: guardar + progreso + navegación + evidencia relacionada breve al final.
  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-legacy.modo-corto',{timeout:15000});
  await page.waitForSelector('.rt-reader-rail[data-v4="1"]',{timeout:15000});
  await page.waitForSelector('header.art .rt-save-action',{state:'visible',timeout:15000});
  await waitV5(page);
  await page.waitForSelector('.relacionados[data-rt-brief-related="v7"]',{state:'visible',timeout:15000});

  const save=page.locator('header.art .rt-save-action');
  assert(/Guardar en biblioteca|Guardado/i.test((await save.innerText()).trim()),'Breve: texto de Guardar en biblioteca incorrecto');
  assert(await save.getAttribute('aria-pressed')!==null,'Breve: botón Guardar sin estado accesible');

  const relatedBrief=await page.evaluate(()=>{
    const section=document.querySelector('.relacionados[data-rt-brief-related="v7"]');
    const footer=document.querySelector('footer.art');
    const cards=[...section.querySelectorAll('.rel-item')];
    const links=cards.map(card=>card.querySelector('a')?.getAttribute('href')||'');
    const box=section.getBoundingClientRect();
    return {
      heading:section.querySelector('h2')?.textContent.trim()||'',count:cards.length,links,
      visible:box.width>0&&box.height>0,beforeFooter:section.nextElementSibling===footer,
      confidenceCount:document.querySelectorAll('.confianza').length,
      noteText:document.body.innerText.includes('NOTA EDITORIAL')||document.body.innerText.includes('Transparencia editorial')
    };
  });
  assert(relatedBrief.visible,'Breve: Evidencia relacionada no es visible');
  assert(/Evidencia relacionada/i.test(relatedBrief.heading),'Breve: título de Evidencia relacionada incorrecto');
  assert(relatedBrief.count>=1&&relatedBrief.count<=4,`Breve: cantidad de evidencia relacionada inválida (${relatedBrief.count})`);
  assert(relatedBrief.links.every(href=>/\/resumen\.html\?id=\d+&v=corto/.test(href)),`Breve: los relacionados no abren su versión breve (${relatedBrief.links.join(' | ')})`);
  assert(relatedBrief.beforeFooter,'Breve: Evidencia relacionada no quedó al final antes del aviso');
  assert(relatedBrief.confidenceCount===0&&!relatedBrief.noteText,'Breve: apareció una nota editorial eliminada');

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

  // Responsive: controles y evidencia relacionada legibles y sin desbordamiento.
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.rt-reader-footer-download',{state:'visible',timeout:15000});
  await waitV7Full(page);
  const mobileFullDownload=await page.locator('.rt-reader-footer-download').boundingBox();
  assert(mobileFullDownload&&mobileFullDownload.width>=330,`Completo móvil: descarga inferior demasiado estrecha (${JSON.stringify(mobileFullDownload)})`);
  await noOverflow(page,'Resumen completo móvil');

  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('header.art .rt-save-action',{state:'visible',timeout:15000});
  await page.waitForSelector('.rt-reader-rail[data-v4="1"]',{timeout:15000});
  await page.waitForSelector('.relacionados[data-rt-brief-related="v7"]',{state:'visible',timeout:15000});
  const mobileSave=await page.locator('header.art .rt-save-action').boundingBox();
  assert(mobileSave&&mobileSave.width>=330,`Breve móvil: Guardar en biblioteca demasiado estrecho (${JSON.stringify(mobileSave)})`);
  const mobileRelated=await page.evaluate(()=>{
    const section=document.querySelector('.relacionados[data-rt-brief-related="v7"]');
    const grid=section?.querySelector('.rel-grid');
    const cards=[...section.querySelectorAll('.rel-item')];
    const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    return {width:section.getBoundingClientRect().width,cols,cards:cards.length};
  });
  assert(mobileRelated.width>=330,`Breve móvil: Evidencia relacionada demasiado estrecha (${mobileRelated.width})`);
  assert(mobileRelated.cols===1,`Breve móvil: relacionados no colapsan a una columna (${mobileRelated.cols})`);
  assert(mobileRelated.cards>=1,'Breve móvil: faltan tarjetas relacionadas');
  await noOverflow(page,'Resumen breve móvil');

  assert(errors.length===0,`Errores JavaScript: ${errors.join(' | ')}`);
  console.log(`READER CONTROLS V7 PASS · trial ${sample.id} · fuente→controles→relacionados + nota editorial eliminada + relacionados breves + PDF + guardar + progreso ${progressAfter.value}% + móvil`);
} finally {
  await browser.close();
}
