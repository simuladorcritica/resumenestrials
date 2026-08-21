import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
const sample=data.find(x=>x.corto&&manifest[String(x.id)]?.path);
if(!sample) throw new Error('No existe trial con resumen breve para probar lector v8');
const trialPath=manifest[String(sample.id)].path;

function assert(value,message){if(!value)throw new Error(message)}
async function noOverflow(page,label){
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  assert(d.scroll<=d.client+2&&d.body<=d.client+2,`${label}: overflow horizontal ${JSON.stringify(d)}`);
}
async function waitV8Full(page){
  await page.waitForFunction(()=>document.querySelector('.pie-nav')?.dataset.rtReaderUi==='v8'&&document.querySelector('.rt-reader-bottom-actions')?.dataset.rtReaderUi==='v8',{timeout:15000});
}
async function assertPdfDownload(page,selector,label){
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:45000}),
    page.locator(selector).click()
  ]);
  const name=download.suggestedFilename();
  assert(/\.pdf$/i.test(name),`${label}: nombre de descarga inválido (${name})`);
  const path=await download.path();
  assert(Boolean(path),`${label}: el navegador no recibió un archivo PDF`);
}

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));

  // Resumen completo: fuente primaria -> navegación -> PDF -> evidencia relacionada.
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-trial',{timeout:15000});
  await page.waitForSelector('.rt-reader-footer-download[data-rt-reader-ui="v8"]',{state:'visible',timeout:15000});
  await waitV8Full(page);

  const full=await page.evaluate((id)=>{
    const original=document.querySelector('.enlace-original');
    const nav=document.querySelector('.pie-nav');
    const actions=document.querySelector('.rt-reader-bottom-actions');
    const related=document.querySelector('.relacionados');
    const back=nav?.querySelector('.rt-reader-back');
    const version=nav?.querySelector('.rt-reader-version');
    const download=actions?.querySelector('.rt-reader-footer-download');
    if(!original||!nav||!actions||!related||!back||!version||!download)return null;
    const br=back.getBoundingClientRect(),vr=version.getBoundingClientRect(),dr=download.getBoundingClientRect();
    const cards=[...related.querySelectorAll('.rel-item')];
    return {
      order:original.nextElementSibling===nav&&nav.nextElementSibling===actions&&actions.nextElementSibling===related,
      backHref:new URL(back.href).pathname,
      briefPath:new URL(version.href).pathname,
      briefId:new URL(version.href).searchParams.get('id'),
      briefMode:new URL(version.href).searchParams.get('v'),
      pdfId:download.getAttribute('data-trial-download'),
      footerPdfId:download.getAttribute('data-rt-footer-download'),
      navWidth:nav.getBoundingClientRect().width,
      backWidth:br.width,versionWidth:vr.width,downloadWidth:dr.width,
      backHeight:br.height,versionHeight:vr.height,downloadHeight:dr.height,
      backClipped:back.scrollWidth>back.clientWidth+2||back.scrollHeight>back.clientHeight+2,
      versionClipped:version.scrollWidth>version.clientWidth+2||version.scrollHeight>version.clientHeight+2,
      downloadClipped:download.scrollWidth>download.clientWidth+2||download.scrollHeight>download.clientHeight+2,
      relatedClipped:cards.some(card=>card.scrollWidth>card.clientWidth+2),
      confidence:document.querySelectorAll('.confianza').length,
      note:/NOTA EDITORIAL|Transparencia editorial/i.test(document.body.innerText),
      expected:String(id)
    };
  },sample.id);
  assert(full,'Completo: falta la estructura final v8');
  assert(full.order,'Completo: el orden fuente → navegación → PDF → evidencia relacionada es incorrecto');
  assert(full.backHref==='/',`Completo: Volver al índice apunta a ${full.backHref}`);
  assert(full.briefPath==='/resumen.html'&&full.briefId===String(sample.id)&&full.briefMode==='corto','Completo: Ver resumen breve no apunta al resumen breve correcto');
  assert(full.pdfId===String(sample.id)&&full.footerPdfId===String(sample.id),'Completo: el PDF inferior no conserva el ID del trial');
  assert(full.navWidth>600,'Completo: la navegación final no usa el ancho disponible');
  assert(Math.abs(full.backWidth-full.versionWidth)<=2,`Completo: Volver y Resumen breve no tienen el mismo ancho (${full.backWidth} vs ${full.versionWidth})`);
  assert(Math.abs(full.backHeight-full.versionHeight)<=2,'Completo: los dos enlaces finales no tienen la misma altura');
  assert(full.downloadWidth>=full.navWidth-2,`Completo: el PDF no queda perfectamente alineado (${full.downloadWidth} vs ${full.navWidth})`);
  assert(full.downloadHeight>=54,'Completo: el botón PDF es demasiado pequeño');
  assert(!full.backClipped&&!full.versionClipped&&!full.downloadClipped,'Completo: hay texto recortado dentro de los controles');
  assert(!full.relatedClipped,'Completo: una tarjeta de evidencia relacionada está recortada');
  assert(full.confidence===0&&!full.note,'Completo: reapareció la nota editorial eliminada');
  await noOverflow(page,'Resumen completo desktop');

  // Función real: volver al índice.
  await Promise.all([
    page.waitForURL(url=>url.pathname==='/'||url.pathname==='/index.html',{timeout:15000}),
    page.locator('.pie-nav .rt-reader-back').click()
  ]);

  // Función real: abrir resumen breve desde el final del completo.
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await waitV8Full(page);
  await Promise.all([
    page.waitForURL(url=>url.pathname==='/resumen.html'&&url.searchParams.get('id')===String(sample.id)&&url.searchParams.get('v')==='corto',{timeout:15000}),
    page.locator('.pie-nav .rt-reader-version').click()
  ]);

  // Función real: descargar PDF completo desde el control inferior.
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await waitV8Full(page);
  await assertPdfDownload(page,'.rt-reader-bottom-actions .rt-reader-footer-download','Completo PDF inferior');

  // Resumen breve: relacionados a ancho completo y dos columnas, con links breves.
  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-legacy.modo-corto',{timeout:15000});
  await page.waitForSelector('.relacionados[data-rt-brief-related="v8"]',{state:'visible',timeout:15000});
  const brief=await page.evaluate(()=>{
    const section=document.querySelector('.relacionados[data-rt-brief-related="v8"]');
    const grid=section.querySelector('.rel-grid');
    const cards=[...section.querySelectorAll('.rel-item')];
    const links=cards.map(card=>card.querySelector('a')?.getAttribute('href')||'');
    const rect=section.getBoundingClientRect();
    const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    const widths=cards.slice(0,2).map(card=>card.getBoundingClientRect().width);
    return {
      width:rect.width,cols,count:cards.length,widths,links,
      clipped:cards.some(card=>card.scrollWidth>card.clientWidth+2),
      beforeFooter:section.nextElementSibling===document.querySelector('footer.art')
    };
  });
  assert(brief.width>=850,`Breve: Evidencia relacionada sigue demasiado estrecha (${brief.width}px)`);
  assert(brief.cols===2,`Breve: Evidencia relacionada no usa dos columnas (${brief.cols})`);
  assert(brief.count>=1&&brief.count<=4,`Breve: cantidad de relacionados inválida (${brief.count})`);
  if(brief.widths.length===2)assert(Math.abs(brief.widths[0]-brief.widths[1])<=3,'Breve: las columnas relacionadas no tienen el mismo ancho');
  assert(brief.links.every(href=>/\/resumen\.html\?id=\d+&v=corto/.test(href)),`Breve: un relacionado no abre su versión breve (${brief.links.join(' | ')})`);
  assert(!brief.clipped,'Breve: hay palabras/tarjetas recortadas en Evidencia relacionada');
  assert(brief.beforeFooter,'Breve: Evidencia relacionada no está al final antes del aviso');
  await noOverflow(page,'Resumen breve desktop');

  // Función real: un relacionado del resumen breve abre otro resumen breve.
  const firstRelated=page.locator('.relacionados[data-rt-brief-related="v8"] .rel-item a').first();
  const href=await firstRelated.getAttribute('href');
  const expectedRelatedId=new URL(href,BASE).searchParams.get('id');
  await Promise.all([
    page.waitForURL(url=>url.pathname==='/resumen.html'&&url.searchParams.get('id')===expectedRelatedId&&url.searchParams.get('v')==='corto',{timeout:15000}),
    firstRelated.click()
  ]);

  // Portada: botones completo/breve con misma geometría y ambos descargan.
  await page.goto(`${BASE}/`,{waitUntil:'domcontentloaded',timeout:30000});
  const row=page.locator(`.fila[data-id="${sample.id}"]`);
  await row.locator('.fila-pdf .btn-pdf').waitFor({state:'visible',timeout:15000});
  await row.locator('.fila-pdf .rt-download-brief').waitFor({state:'visible',timeout:15000});
  const homeButtons=await row.locator('.fila-pdf').evaluate(area=>{
    const full=area.querySelector('.btn-pdf:not(.rt-download-brief)');
    const brief=area.querySelector('.rt-download-brief');
    const fr=full.getBoundingClientRect(),br=brief.getBoundingClientRect();
    const fs=getComputedStyle(full),bs=getComputedStyle(brief);
    return {
      fw:fr.width,bw:br.width,fh:fr.height,bh:br.height,ff:parseFloat(fs.fontSize),bf:parseFloat(bs.fontSize),
      fullText:full.textContent.replace(/\s+/g,' ').trim(),briefText:brief.textContent.replace(/\s+/g,' ').trim(),
      fullClip:full.scrollWidth>full.clientWidth+2||full.scrollHeight>full.clientHeight+2,
      briefClip:brief.scrollWidth>brief.clientWidth+2||brief.scrollHeight>brief.clientHeight+2
    };
  });
  assert(Math.abs(homeButtons.fw-homeButtons.bw)<=2,`Portada: botones PDF con ancho desigual (${homeButtons.fw} vs ${homeButtons.bw})`);
  assert(Math.abs(homeButtons.fh-homeButtons.bh)<=2,`Portada: botones PDF con altura desigual (${homeButtons.fh} vs ${homeButtons.bh})`);
  assert(Math.abs(homeButtons.ff-homeButtons.bf)<.2,`Portada: tipografía desigual (${homeButtons.ff} vs ${homeButtons.bf})`);
  assert(/completo/i.test(homeButtons.fullText)&&/breve/i.test(homeButtons.briefText),'Portada: etiquetas PDF incorrectas');
  assert(!homeButtons.fullClip&&!homeButtons.briefClip,'Portada: texto recortado en los botones PDF');
  await assertPdfDownload(page,`.fila[data-id="${sample.id}"] .fila-pdf .btn-pdf:not(.rt-download-brief)`,'Portada PDF completo');
  await assertPdfDownload(page,`.fila[data-id="${sample.id}"] .fila-pdf .rt-download-brief`,'Portada PDF breve');
  await noOverflow(page,'Portada desktop');

  // Responsive 390 px: todos los bloques deben apilarse sin cortes ni overflow.
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await waitV8Full(page);
  const mobileFull=await page.evaluate(()=>{
    const nav=document.querySelector('.pie-nav');
    const back=nav.querySelector('.rt-reader-back').getBoundingClientRect();
    const version=nav.querySelector('.rt-reader-version').getBoundingClientRect();
    const pdf=document.querySelector('.rt-reader-footer-download').getBoundingClientRect();
    const cols=getComputedStyle(nav).gridTemplateColumns.split(' ').filter(Boolean).length;
    return {cols,bw:back.width,vw:version.width,pw:pdf.width};
  });
  assert(mobileFull.cols===1,`Completo móvil: navegación no apila en una columna (${mobileFull.cols})`);
  assert(mobileFull.bw>=330&&mobileFull.vw>=330&&mobileFull.pw>=330,'Completo móvil: un control quedó demasiado estrecho');
  await noOverflow(page,'Resumen completo móvil');

  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.relacionados[data-rt-brief-related="v8"]',{state:'visible',timeout:15000});
  const mobileBrief=await page.evaluate(()=>{
    const section=document.querySelector('.relacionados[data-rt-brief-related="v8"]');
    const grid=section.querySelector('.rel-grid');
    return {width:section.getBoundingClientRect().width,cols:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length};
  });
  assert(mobileBrief.width>=330,`Breve móvil: Evidencia relacionada demasiado estrecha (${mobileBrief.width})`);
  assert(mobileBrief.cols===1,`Breve móvil: relacionados no colapsan a una columna (${mobileBrief.cols})`);
  await noOverflow(page,'Resumen breve móvil');

  await page.goto(`${BASE}/`,{waitUntil:'domcontentloaded',timeout:30000});
  const mobileRow=page.locator(`.fila[data-id="${sample.id}"] .fila-pdf`);
  await mobileRow.locator('.rt-download-brief').waitFor({state:'visible',timeout:15000});
  const mobileHome=await mobileRow.evaluate(area=>{
    const a=area.querySelector('.btn-pdf:not(.rt-download-brief)').getBoundingClientRect();
    const b=area.querySelector('.rt-download-brief').getBoundingClientRect();
    return {aw:a.width,bw:b.width,ah:a.height,bh:b.height};
  });
  assert(mobileHome.aw>=300&&mobileHome.bw>=300,'Portada móvil: botones PDF demasiado estrechos');
  assert(Math.abs(mobileHome.aw-mobileHome.bw)<=2&&Math.abs(mobileHome.ah-mobileHome.bh)<=2,'Portada móvil: botones PDF desiguales');
  await noOverflow(page,'Portada móvil');

  assert(errors.length===0,`Errores JavaScript: ${errors.join(' | ')}`);
  console.log(`READER UI V8 PASS · trial ${sample.id} · navegación real + 3 descargas PDF reales + retícula completa/breve + portada + móvil`);
} finally {
  await browser.close();
}
