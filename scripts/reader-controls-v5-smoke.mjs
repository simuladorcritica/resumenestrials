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
async function waitV8(page){
  await page.waitForFunction(()=>document.querySelector('.pie-nav')?.dataset.rtReaderUi==='v8'&&document.querySelector('.rt-reader-bottom-actions')?.dataset.rtReaderUi==='v8',{timeout:15000});
}
async function expectDownload(page,selector,label){
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:45000}),
    page.locator(selector).click()
  ]);
  const name=download.suggestedFilename();
  assert(/\.pdf$/i.test(name),`${label}: nombre inválido (${name})`);
  assert(Boolean(await download.path()),`${label}: no se recibió el archivo`);
}

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));

  // 1. Final del resumen completo: geometría, destinos y contrato PDF.
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('body.rt-future-trial',{timeout:15000});
  await page.waitForSelector('.rt-reader-footer-download[data-rt-reader-ui="v8"]',{state:'visible',timeout:15000});
  await waitV8(page);
  const full=await page.evaluate((id)=>{
    const original=document.querySelector('.enlace-original');
    const nav=document.querySelector('.pie-nav');
    const actions=document.querySelector('.rt-reader-bottom-actions');
    const related=document.querySelector('.relacionados');
    const back=nav?.querySelector('.rt-reader-back');
    const version=nav?.querySelector('.rt-reader-version');
    const bottom=actions?.querySelector('.rt-reader-footer-download');
    const real=[...document.querySelectorAll('[data-trial-download]')];
    if(!original||!nav||!actions||!related||!back||!version||!bottom)return null;
    const br=back.getBoundingClientRect(),vr=version.getBoundingClientRect(),dr=bottom.getBoundingClientRect(),nr=nav.getBoundingClientRect();
    const vurl=new URL(version.href);
    return {
      order:original.nextElementSibling===nav&&nav.nextElementSibling===actions&&actions.nextElementSibling===related,
      backPath:new URL(back.href).pathname,briefPath:vurl.pathname,briefId:vurl.searchParams.get('id'),briefMode:vurl.searchParams.get('v'),
      realCount:real.length,realId:real[0]?.getAttribute('data-trial-download')||'',bottomHasReal:bottom.hasAttribute('data-trial-download'),
      bottomId:bottom.getAttribute('data-rt-footer-download')||'',navWidth:nr.width,backW:br.width,versionW:vr.width,backH:br.height,versionH:vr.height,pdfW:dr.width,pdfH:dr.height,
      clipped:[back,version,bottom].some(el=>el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2),
      relatedClipped:[...related.querySelectorAll('.rel-item')].some(el=>el.scrollWidth>el.clientWidth+2),
      note:/NOTA EDITORIAL|Transparencia editorial/i.test(document.body.innerText),confidence:document.querySelectorAll('.confianza').length,
      expected:String(id)
    };
  },sample.id);
  assert(full,'Completo: falta estructura v8');
  assert(full.order,'Completo: orden fuente → navegación → PDF → relacionados incorrecto');
  assert(full.backPath==='/','Completo: Volver al índice no apunta a /');
  assert(full.briefPath==='/resumen.html'&&full.briefId===String(sample.id)&&full.briefMode==='corto','Completo: Ver resumen breve tiene destino incorrecto');
  assert(full.realCount===1&&full.realId===String(sample.id),`Completo: debe existir un único disparador canónico PDF (${full.realCount})`);
  assert(!full.bottomHasReal&&full.bottomId===String(sample.id),'Completo: el control inferior no usa el contrato independiente correcto');
  assert(full.navWidth>600,'Completo: navegación final demasiado estrecha');
  assert(Math.abs(full.backW-full.versionW)<=2&&Math.abs(full.backH-full.versionH)<=2,'Completo: controles de navegación no tienen igual geometría');
  assert(full.pdfW>=full.navWidth-2&&full.pdfH>=54,'Completo: botón PDF inferior no queda alineado/ancho completo');
  assert(!full.clipped&&!full.relatedClipped,'Completo: hay texto o tarjetas recortadas');
  assert(!full.note&&full.confidence===0,'Completo: reapareció la nota editorial');
  await noOverflow(page,'Resumen completo desktop');

  // 2. Navegación real: no basta con comprobar href.
  await Promise.all([
    page.waitForURL(url=>url.pathname==='/'||url.pathname==='/index.html',{timeout:15000}),
    page.locator('.pie-nav .rt-reader-back').click()
  ]);
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await waitV8(page);
  await Promise.all([
    page.waitForURL(url=>url.pathname==='/resumen.html'&&url.searchParams.get('id')===String(sample.id)&&url.searchParams.get('v')==='corto',{timeout:15000}),
    page.locator('.pie-nav .rt-reader-version').click()
  ]);

  // 3. Descarga real desde el botón inferior del completo.
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await waitV8(page);
  await expectDownload(page,'.rt-reader-bottom-actions .rt-reader-footer-download','PDF completo inferior');

  // 4. Resumen breve: relacionados iguales a la retícula del completo, no columna angosta.
  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.relacionados[data-rt-brief-related="v8"]',{state:'visible',timeout:15000});
  const brief=await page.evaluate(()=>{
    const section=document.querySelector('.relacionados[data-rt-brief-related="v8"]');
    const grid=section.querySelector('.rel-grid');
    const cards=[...section.querySelectorAll('.rel-item')];
    const widths=cards.slice(0,2).map(x=>x.getBoundingClientRect().width);
    return {
      width:section.getBoundingClientRect().width,
      cols:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      count:cards.length,widths,
      links:cards.map(card=>card.querySelector('a')?.getAttribute('href')||''),
      clipped:cards.some(card=>card.scrollWidth>card.clientWidth+2),
      beforeFooter:section.nextElementSibling===document.querySelector('footer.art')
    };
  });
  assert(brief.width>=780,`Breve: Evidencia relacionada continúa angosta (${brief.width}px)`);
  assert(brief.cols===2,`Breve: Evidencia relacionada no usa dos columnas (${brief.cols})`);
  assert(brief.count>=1&&brief.count<=4,`Breve: cantidad de relacionados inválida (${brief.count})`);
  if(brief.widths.length===2)assert(Math.abs(brief.widths[0]-brief.widths[1])<=3,'Breve: columnas relacionadas desiguales');
  assert(brief.links.every(href=>/\/resumen\.html\?id=\d+&v=corto/.test(href)),`Breve: un relacionado no abre versión breve (${brief.links.join(' | ')})`);
  assert(!brief.clipped&&brief.beforeFooter,'Breve: relacionados recortados o fuera de posición');
  await noOverflow(page,'Resumen breve desktop');

  // 5. El primer relacionado abre realmente otro resumen breve.
  const firstRelated=page.locator('.relacionados[data-rt-brief-related="v8"] .rel-item a').first();
  const relatedId=new URL(await firstRelated.getAttribute('href'),BASE).searchParams.get('id');
  await Promise.all([
    page.waitForURL(url=>url.pathname==='/resumen.html'&&url.searchParams.get('id')===relatedId&&url.searchParams.get('v')==='corto',{timeout:15000}),
    firstRelated.click()
  ]);

  // 6. Portada: PDF completo y breve idénticos en geometría y ambos funcionales.
  await page.goto(`${BASE}/`,{waitUntil:'domcontentloaded',timeout:30000});
  const row=page.locator(`.fila[data-id="${sample.id}"]`);
  await row.locator('.fila-pdf .btn-pdf').waitFor({state:'visible',timeout:15000});
  await row.locator('.fila-pdf .rt-download-brief').waitFor({state:'visible',timeout:15000});
  const home=await row.locator('.fila-pdf').evaluate(area=>{
    const full=area.querySelector('.btn-pdf:not(.rt-download-brief)'),brief=area.querySelector('.rt-download-brief');
    const a=full.getBoundingClientRect(),b=brief.getBoundingClientRect(),as=getComputedStyle(full),bs=getComputedStyle(brief);
    return {aw:a.width,bw:b.width,ah:a.height,bh:b.height,af:parseFloat(as.fontSize),bf:parseFloat(bs.fontSize),
      clipA:full.scrollWidth>full.clientWidth+2||full.scrollHeight>full.clientHeight+2,clipB:brief.scrollWidth>brief.clientWidth+2||brief.scrollHeight>brief.clientHeight+2};
  });
  assert(Math.abs(home.aw-home.bw)<=2&&Math.abs(home.ah-home.bh)<=2,`Portada: botones PDF desiguales (${home.aw}×${home.ah} vs ${home.bw}×${home.bh})`);
  assert(Math.abs(home.af-home.bf)<.2,'Portada: tipografía de los dos PDF es desigual');
  assert(!home.clipA&&!home.clipB,'Portada: texto recortado en botones PDF');
  await expectDownload(page,`.fila[data-id="${sample.id}"] .fila-pdf .btn-pdf:not(.rt-download-brief)`,'PDF completo portada');
  await expectDownload(page,`.fila[data-id="${sample.id}"] .fila-pdf .rt-download-brief`,'PDF breve portada');
  await noOverflow(page,'Portada desktop');

  // 7. Responsive: 390 px, sin desbordamiento y controles apilados.
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${BASE}${trialPath}`,{waitUntil:'domcontentloaded',timeout:30000});
  await waitV8(page);
  const mobileFull=await page.evaluate(()=>{
    const nav=document.querySelector('.pie-nav');
    const els=[nav.querySelector('.rt-reader-back'),nav.querySelector('.rt-reader-version'),document.querySelector('.rt-reader-footer-download')];
    return {cols:getComputedStyle(nav).gridTemplateColumns.split(' ').filter(Boolean).length,widths:els.map(x=>x.getBoundingClientRect().width)};
  });
  assert(mobileFull.cols===1&&mobileFull.widths.every(w=>w>=330),`Completo móvil: controles incorrectos ${JSON.stringify(mobileFull)}`);
  await noOverflow(page,'Resumen completo móvil');

  await page.goto(`${BASE}/resumen.html?id=${sample.id}&v=corto`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('.relacionados[data-rt-brief-related="v8"]',{state:'visible',timeout:15000});
  const mobileBrief=await page.evaluate(()=>{
    const s=document.querySelector('.relacionados[data-rt-brief-related="v8"]'),g=s.querySelector('.rel-grid');
    return {width:s.getBoundingClientRect().width,cols:getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length};
  });
  assert(mobileBrief.width>=330&&mobileBrief.cols===1,`Breve móvil incorrecto ${JSON.stringify(mobileBrief)}`);
  await noOverflow(page,'Resumen breve móvil');

  await page.goto(`${BASE}/`,{waitUntil:'domcontentloaded',timeout:30000});
  const mobileRow=page.locator(`.fila[data-id="${sample.id}"] .fila-pdf`);
  await mobileRow.locator('.rt-download-brief').waitFor({state:'visible',timeout:15000});
  const mh=await mobileRow.evaluate(area=>{
    const a=area.querySelector('.btn-pdf:not(.rt-download-brief)').getBoundingClientRect(),b=area.querySelector('.rt-download-brief').getBoundingClientRect();
    return {aw:a.width,bw:b.width,ah:a.height,bh:b.height};
  });
  assert(mh.aw>=300&&mh.bw>=300&&Math.abs(mh.aw-mh.bw)<=2&&Math.abs(mh.ah-mh.bh)<=2,`Portada móvil: botones desiguales ${JSON.stringify(mh)}`);
  await noOverflow(page,'Portada móvil');

  assert(errors.length===0,`Errores JavaScript: ${errors.join(' | ')}`);
  console.log(`READER UI V8 PASS · trial ${sample.id} · navegación real + 3 descargas PDF reales + relacionados completo/breve + portada + móvil`);
} finally {
  await browser.close();
}
