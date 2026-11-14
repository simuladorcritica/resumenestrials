import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {installTurnstileTestRoutes,assertLoopbackBase} from './turnstile-test-helpers.mjs';
import {editions,editionSample} from './editions.mjs';
import {evidenceMap as mapModel,journalRows,trialCount,JOURNALS} from './evidence-map.mjs';
const data=JSON.parse(fs.readFileSync('resumenes.json','utf8')),map=JSON.parse(fs.readFileSync('seo-manifest.json','utf8')),clusters=JSON.parse(fs.readFileSync('seo-cluster-manifest.json','utf8'));
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const model=mapModel(data,clusters);
export const anonModule="export function createClient(){return {auth:{async getUser(){return {data:{user:null},error:null}},async getSession(){return {data:{session:null},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}},error:null}},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:null,nextLevel:null},error:null}},async listFactors(){return {data:{totp:[]},error:null}}}}}}";
export async function isolate(context,base,{signedIn=false}={}){
 assertLoopbackBase(base);
 await context.route('**/*',r=>{
  const u=r.request().url();
  if(u.startsWith(base+'/'))return r.continue();
  if(u.includes('esm.sh/'))return r.fulfill({contentType:'application/javascript',body:anonModule});
  if(u.includes('jspdf'))return r.fulfill({contentType:'application/javascript',path:'node_modules/jspdf/dist/jspdf.umd.min.js'});
  // All remote requests are intercepted; the suite cannot create users, mail or telemetry.
  return r.fulfill({status:200,contentType:u.includes('fonts.googleapis')?'text/css':'application/javascript',body:''});
 });
}
async function ready(p,path,base){
 const r=await p.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,path);
 if(await p.locator('[data-ev-ids]').count())await p.waitForFunction(()=>document.querySelector('#ev-count').dataset.ready);
 if(await p.locator('[data-ev-reader],#ev-dynamic-reader').count())await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick||/no encontrado/i.test(document.querySelector('h1')?.textContent));
}
async function geometry(p){
 const measure=()=>p.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,styles:document.querySelectorAll('style').length,headers:document.querySelectorAll('.ev-header').length}));
 // El ancho se comprueba con la página asentada. En WebKit de Windows, una medición hecha mientras llegan las
 // fuentes o termina una transición dio varias veces un desbordamiento que al instante ya no estaba (CI, 11 a 13
 // de noviembre de 2026, webkit:390:oscuro). Un desbordamiento real sigue ahí tras la espera y la prueba falla igual.
 let m=await measure();
 for(let i=0;i<8&&(m.sw>m.w+2||m.bw>m.w+2);i++){
  await p.evaluate(()=>(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
  await p.waitForTimeout(250);m=await measure();
 }
 if(m.sw>m.w+2||m.bw>m.w+2){
  // Si falla, el mensaje dice en qué página y qué elementos se salen, para corregir la causa y no adivinarla.
  const wide=await p.evaluate(()=>[...document.querySelectorAll('body *')].map(n=>({n,r:n.getBoundingClientRect()})).filter(x=>x.r.width>0&&x.r.right>innerWidth+2).sort((a,b)=>b.r.right-a.r.right).slice(0,4).map(x=>x.n.tagName.toLowerCase()+(x.n.id?'#'+x.n.id:'')+(typeof x.n.className==='string'&&x.n.className?'.'+x.n.className.trim().split(/\s+/).join('.'):'')+' → '+Math.round(x.r.right)));
  assert.fail('Horizontal overflow '+JSON.stringify(m)+' en '+p.url()+' · '+wide.join(' | '));
 }
 assert.equal(m.styles,0,'JS/inline style');assert.equal(m.headers,1);
}
async function visibleIds(p){return p.locator('#ev-list>.ev-card:visible').evaluateAll(ns=>ns.map(n=>n.dataset.id))}
async function singleSearch(p,label){assert.equal(await p.locator('input[type=search]').count(),1,label+' must expose exactly one search field');assert(await p.locator('.ev-header #ev-q').isVisible(),label+' search field visible in header')}
async function openFilters(p){if(!(await p.locator('#ev-filters').isVisible()))await p.locator('[data-ev-filters]').click();assert(await p.locator('#ev-filters').isVisible())}
async function archive(p,base){
 await ready(p,'/archivo/',base);await singleSearch(p,'/archivo/');assert.equal(await p.locator('#ev-list>.ev-card').count(),data.length);assert.equal((await visibleIds(p)).length,24);
 for(const dense of [false,true]){if(dense)await p.locator('#ev-view').click();const boxes=await p.locator('#ev-list>.ev-card:visible>a.ev-card-title[data-ev-read]').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect(),h=n.querySelector('h2').getBoundingClientRect();return {width:b.width,height:b.height,titleOffset:h.top-b.top}}));assert.equal(boxes.length,24);assert(boxes.every(b=>b.width>=44&&b.height>=44&&Math.abs(b.titleOffset)<1),'Card title hit area >=44px and upper alignment, dense='+dense)}await p.locator('#ev-view').click();
 const listPath=new URL(p.url()).pathname;await p.locator('#ev-more').dblclick();await p.waitForTimeout(300);assert.equal(new URL(p.url()).pathname,listPath,'Double click on Mostrar más must not open a card');assert.equal((await visibleIds(p)).length,48);assert(new URL(p.url()).searchParams.get('n')==='48');
 await p.locator('#ev-view').click();assert.equal(await p.locator('#ev-view').getAttribute('aria-pressed'),'true');await p.reload();await p.waitForFunction(()=>document.querySelector('#ev-count').dataset.ready);assert.equal((await visibleIds(p)).length,48);assert.equal(await p.locator('#ev-view').getAttribute('aria-pressed'),'true');
 for(const [key,param]of [['year','anio'],['journal','revista'],['type','tipo'],['topic','tema'],['sub','sub']]){
  await ready(p,'/archivo/',base);await openFilters(p);const option=await p.locator('#ev-'+key+' option').nth(1).getAttribute('value');await p.selectOption('#ev-'+key,option);assert.equal(new URL(p.url()).searchParams.get(param),option);
  const ids=await visibleIds(p);assert(ids.length>0);
  if(key==='sub')assert(await p.evaluate(()=>{const selected=document.querySelector('#ev-sub').value;return window.EV.data().then(rs=>[...document.querySelectorAll('#ev-list>.ev-card')].filter(n=>!n.hidden).every(n=>window.EV.areas(rs.find(r=>String(r.id)===n.dataset.id)).includes(selected)))}));
  else{const expected=data.filter(r=>key==='topic'?(r.temas||[]).includes(option):String(r[{year:'anio',journal:'revista',type:'tipo_estudio'}[key]])===option);assert(ids.every(id=>expected.some(r=>String(r.id)===id)),key+"="+option+" ids="+ids.join(","))}
  assert.equal(await p.locator('[data-ev-filter-count]').textContent(),'1');
  await p.reload();await p.waitForFunction(()=>document.querySelector('#ev-count').dataset.ready);assert.equal(await p.inputValue('#ev-'+key),option);await p.locator('[data-ev-clear="ev-'+key+'"]').click();assert.equal((await visibleIds(p)).length,24);assert(!(await p.locator('[data-ev-filter-count]').isVisible()));
 }
 for(const area of ['Medicina Crítica','Medicina Interna']){
  await ready(p,'/archivo/',base);await p.locator('.ev-segment label').filter({hasText:area}).click();assert.equal(new URL(p.url()).searchParams.get('esp'),area);
  assert(await p.evaluate(area=>window.EV.data().then(rs=>[...document.querySelectorAll('#ev-list>.ev-card')].filter(n=>!n.hidden).every(n=>window.EV.areas(rs.find(r=>String(r.id)===n.dataset.id)).includes(area))),area));
  await p.reload();await p.waitForFunction(()=>document.querySelector('#ev-count').dataset.ready);assert.equal(await p.locator('input[name="ev-area"]:checked').getAttribute('value'),area);await p.locator('[data-ev-clear="ev-area"]').click();assert.equal(await p.locator('input[name="ev-area"]:checked').getAttribute('value'),'');assert.equal((await visibleIds(p)).length,24);
 }
 await ready(p,'/archivo/?esp=Neumolog%C3%ADa',base);assert.equal(await p.inputValue('#ev-sub'),'Neumología','Legacy esp links keep working');
 // Old home links that carry archive parameters land on /archivo/ with the same query and hash, before anything renders.
 const legacy=async path=>{const from=new URL(base+path);await p.goto(from.href,{waitUntil:'commit'});await p.waitForURL(u=>u.pathname==='/archivo/');await p.waitForFunction(()=>document.querySelector('#ev-count')?.dataset.ready);const to=new URL(p.url());assert.equal(to.search,from.search,path+' keeps its query');assert.equal(to.hash,from.hash,path+' keeps its hash')};
 await legacy('/?esp=Neumolog%C3%ADa');assert.equal(await p.inputValue('#ev-sub'),'Neumología','Legacy home esp links keep working');
 await legacy('/?q=SOHO&vista=lista#ev-archivo');assert.equal(await p.inputValue('#ev-q'),'SOHO');assert.equal(await p.locator('#ev-view').getAttribute('aria-pressed'),'true');assert((await p.locator('#ev-list>.ev-card:visible h2').allTextContents()).every(t=>/SOHO/i.test(t)));
 await legacy('/#ev-archivo');assert.equal((await visibleIds(p)).length,24);
 await legacy('/index.html?anio=2026&n=48');assert.equal(await p.inputValue('#ev-year'),'2026');assert.equal((await visibleIds(p)).length,Math.min(48,data.filter(r=>String(r.anio)==='2026').length));
 await ready(p,'/?utm_source=boletin',base);assert.equal(new URL(p.url()).pathname,'/','Other parameters stay on the cover');assert.equal(await p.locator('#ev-list').count(),0);
 await ready(p,'/archivo/',base);const topic=p.locator('[data-ev-topic]').first(),topicValue=await topic.getAttribute('data-ev-topic');await topic.click();assert.equal(new URL(p.url()).searchParams.get('tema'),topicValue);assert.equal(await topic.getAttribute('aria-pressed'),'true');assert((await visibleIds(p)).length>0);await topic.click();assert.equal(new URL(p.url()).searchParams.get('tema'),null);
 await p.locator('[data-ev-preset]').click();assert.equal(new URL(p.url()).searchParams.get('esp'),'Medicina Crítica');assert(new URL(p.url()).searchParams.get('anio'));await p.locator('#ev-chips [data-ev-reset]').click();assert.equal((await visibleIds(p)).length,24);assert.equal(new URL(p.url()).search,'');
 await p.fill('#ev-q','SOHO');await p.waitForURL(/q=SOHO/);assert((await p.locator('#ev-list>.ev-card:visible h2').allTextContents()).every(t=>/SOHO/i.test(t)));assert(await p.locator('[data-ev-search-clear]').isVisible());assert(await p.locator('#ev-search-panel').isHidden(),'List pages filter in place without a results popup');
 await p.locator('#ev-q').press('Enter');assert.equal(new URL(p.url()).pathname,'/archivo/','Enter keeps the visitor on the filtered list');
 await p.fill('#ev-q','__NO_MATCH__');await p.waitForURL(/q=__NO_MATCH__/);assert(await p.locator('#ev-empty').isVisible());assert.equal((await visibleIds(p)).length,0);
 await p.goBack();await p.waitForFunction(()=>document.querySelector('#ev-q').value==='SOHO');assert((await visibleIds(p)).length>0);
 await p.locator('[data-ev-clear="ev-q"]').click();assert.equal(await p.inputValue('#ev-q'),'');await openFilters(p);await p.selectOption('#ev-sort','title');const titles=await p.locator('#ev-list>.ev-card:visible h2').allTextContents();assert.deepEqual(titles,titles.slice().sort((a,b)=>a.localeCompare(b,'es')));
 await p.selectOption('#ev-sort','journal');assert.equal(new URL(p.url()).searchParams.get('orden'),'journal');await geometry(p);
 for(const path of ['/medicina-critica/',Object.values(clusters)[0].path]){await ready(p,path,base);await singleSearch(p,path);assert.equal(await p.locator('input[name="ev-area"]').count(),0);await p.fill('#ev-q','2026');await p.waitForURL(/q=2026/);assert((await visibleIds(p)).length>0);await geometry(p)}
 // Specialties and subtopics: the section text sits below the list under «Sobre esta sección», unchanged and visible; the header keeps the label and the title only.
 const texts=JSON.parse(fs.readFileSync('templates/textos-temas.json','utf8'));
 for(const path of ['/medicina-critica/','/medicina-interna/',Object.values(clusters)[0].path]){await ready(p,path,base);
  const about=await p.evaluate(()=>{const n=document.querySelector('.ev-about'),t=n?.querySelector('p.ev-topic-intro');return n&&{label:n.querySelector('h2').textContent,text:t.textContent,visible:t.getClientRects().length>0&&getComputedStyle(t).visibility==='visible',below:n.getBoundingClientRect().top>=document.querySelector('#ev-archivo').getBoundingClientRect().bottom-1,last:document.querySelector('main').lastElementChild===n,hero:[...document.querySelectorAll('.ev-hero p')].map(x=>x.className),intros:document.querySelectorAll('.ev-topic-intro').length}});
  assert(about,path+' carries its section text');assert.equal(about.label,'Sobre esta sección');assert.equal(about.text,texts[path.replace(/^\/|\/$/g,'')],path+' section text unchanged');assert.deepEqual([about.visible,about.below,about.last,about.intros],[true,true,true,1],path+' section text visible, below the list and last in the page content');assert.deepEqual(about.hero,['ev-eyebrow'],path+' header keeps the label and the title only');await geometry(p)}
}
// Evidence map (/mapa/): one dot per record, checked against the data (scripts/evidence-map.mjs repeats the rule of the generator).
const mapReady=async(p,path,base)=>{await ready(p,path,base);await p.waitForFunction(()=>document.querySelector('[data-ev-map]')?.dataset.ready)};
const mapState=p=>p.evaluate(()=>({years:[...document.querySelectorAll('.ev-map thead th')].map(n=>n.textContent),html:document.querySelector('.ev-map tbody').innerHTML,
 rows:[...document.querySelectorAll('.ev-map tbody tr')].map(tr=>({key:tr.dataset.evRow,name:tr.cells[0].firstChild.data,note:tr.cells[0].querySelector('small').textContent,cells:[...tr.cells].slice(1).map(td=>{const b=td.querySelector('button.ev-map-cell');return b?{label:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed'),ids:[...b.querySelectorAll('i')].map(i=>i.dataset.id),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}:td.childNodes.length?{stray:td.innerHTML}:null})})),
 dots:[...document.querySelectorAll('.ev-map tbody i[data-id]')].map(i=>({id:i.dataset.id,tone:i.dataset.sub,row:i.closest('tr').dataset.evRow,bin:i.closest('td').cellIndex-1,dim:i.hasAttribute('data-dim'),opacity:getComputedStyle(i).opacity}))}));
const byNumber=(a,b)=>a-b,sortedIds=ids=>ids.map(Number).sort(byNumber);
// Rows and cells shown for a grouping: every row header, every cell button (name, count, size) and every dot.
function assertMap(state,rows,trials,label){
 assert.deepEqual(state.years,model.bins,label+' year columns');assert.deepEqual(state.rows.map(r=>r.key),rows.map(r=>r.key),label+' rows and their order');
 state.rows.forEach((row,i)=>{const expected=rows[i];assert.equal(row.name,expected.name,label);assert.equal(row.note,(expected.area?expected.area+' · ':'')+trialCount(expected.ids.length),label+' row label shows area and count');assert.equal(row.cells.length,model.bins.length);
  row.cells.forEach((cell,bin)=>{const ids=expected.ids.filter(id=>model.trials.get(id).bin===bin);if(!ids.length){assert.equal(cell,null,label+' empty cell has no control');return}
   assert(cell&&!cell.stray,label+' non-empty cell is one button');assert.deepEqual(sortedIds(cell.ids),sortedIds(ids),label+' '+expected.key+' '+model.bins[bin]);assert.equal(cell.label,expected.name+', '+model.bins[bin]+': '+trialCount(ids.length));assert(cell.width>=43.99&&cell.height>=43.99,label+' cell target '+JSON.stringify(cell))})});
 assert.deepEqual(sortedIds(state.dots.map(d=>d.id)),sortedIds(trials.map(t=>t.id)),label+' one dot per record');for(const dot of state.dots)assert.equal(dot.tone,model.trials.get(dot.id).tone,label+' dot colour '+dot.id);
}
async function evidenceMap(p,base,width){
 const all=[...model.trials.values()],pick=label=>p.locator('.ev-map-ctl label').filter({hasText:new RegExp('^'+label+'$')}).click(),search=()=>new URL(p.url()).searchParams;
 const requests=[],track=r=>requests.push(new URL(r.url()).pathname);p.on('request',track);
 await mapReady(p,'/mapa/',base);await singleSearch(p,'/mapa/');assert.deepEqual(await p.locator('h1').allTextContents(),['Mapa de evidencia']);assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),'https://resumenestrials.com/mapa/');
 assert.equal(await p.locator('#ev-map-hl').getAttribute('type'),'text','Highlight is not a second search field');assert.equal(await p.locator('.ev-map tbody').locator('a,[tabindex],[role]').count(),0,'Dots are decorative: the cell is the only control');
 // Default view (by topic): every record is one dot in the row and year column its data dictate.
 const initial=await mapState(p);assertMap(initial,model.rows,all,'Por tema');assert.equal(initial.dots.length,data.length);
 for(const dot of initial.dots){const t=model.trials.get(dot.id);assert.equal(dot.row,t.row,'Row of '+dot.id);assert.equal(dot.bin,t.bin,'Year column of '+dot.id)}
 const legend=trials=>[['critica','Medicina Crítica'],['cardio','Cardiología'],['endo','Endocrinología'],['neuro','Neurología'],['nefro','Nefrología'],['neumo','Neumología'],['infecto','Infectología'],['gastro','Gastroenterología'],['onco','Oncología y hematología'],['interna','Medicina Interna'],['otra','Otras subespecialidades']].filter(([tone])=>trials.some(t=>t.tone===tone)).map(([,name])=>name);
 assert.deepEqual(await p.locator('.ev-map-legend li').allTextContents(),legend(all),'Legend names every colour in use');assert.equal(await p.locator('.ev-map-legend li:visible').count(),legend(all).length);
 const colours=await p.evaluate(()=>{const probe=document.createElement('i');document.body.append(probe);const value=name=>{probe.style.color='var('+name+')';return getComputedStyle(probe).color};const out={dot:value('--ev-dot'),tokens:{},used:[...new Set([...document.querySelectorAll('.ev-map-cell i')].map(i=>i.dataset.sub+'|'+getComputedStyle(i).backgroundColor))]};for(const name of ['critica','interna','sub-cardio','sub-endo','sub-neuro','sub-nefro','sub-neumo','sub-infecto','sub-gastro','sub-onco','sub-otra'])out.tokens[name]=value('--ev-'+name);probe.remove();return out});
 for(const pair of colours.used){const [tone,colour]=pair.split('|');assert.equal(colour,colours.tokens[['critica','interna'].includes(tone)?tone:'sub-'+tone],'Dot colour comes from its token: '+pair);assert.notEqual(colour,colours.dot,'No ochre on the map')}
 // Especialidad: only that area's rows and dots; «Todas» restores the initial map exactly.
 for(const [label,area,param]of [['Medicina Crítica','Medicina Crítica','critica'],['Medicina Interna','Medicina Interna','interna']]){
  await pick(label);assert.equal(search().get('esp'),param);const subset=all.filter(t=>t.area===area);assertMap(await mapState(p),model.rows.filter(r=>r.area===area),subset,label);assert(subset.length>0&&subset.length<data.length);assert.deepEqual(await p.locator('.ev-map-legend li:visible').allTextContents(),legend(subset),label+' legend names only the colours in view');
 }
 await pick('Todas');assert.equal((await mapState(p)).html,initial.html,'Clearing the specialty restores the default map');assert.equal(new URL(p.url()).search,'');assert.deepEqual(await p.locator('.ev-map-legend li:visible').allTextContents(),legend(all));
 // Filas: by journal (all areas and one area) and back.
 await pick('Por revista');assert.equal(search().get('filas'),'revista');let state=await mapState(p);assertMap(state,journalRows(all),all,'Por revista');for(const dot of state.dots)assert.equal(dot.row,'j:'+model.trials.get(dot.id).journal,'Journal row of '+dot.id);assert.deepEqual(state.rows.map(r=>r.name).sort(),[...new Set(all.map(t=>JOURNALS[t.journal]))].sort());
 await pick('Medicina Interna');const internal=all.filter(t=>t.area==='Medicina Interna');assertMap(await mapState(p),journalRows(internal),internal,'Por revista · Medicina Interna');
 await p.reload();await p.waitForFunction(()=>document.querySelector('[data-ev-map]')?.dataset.ready);assertMap(await mapState(p),journalRows(internal),internal,'State survives a reload');assert.equal(await p.locator('input[name="ev-map-rows"]:checked').getAttribute('value'),'revista');assert.equal(await p.locator('input[name="ev-map-area"]:checked').getAttribute('value'),'i');
 await pick('Todas');await pick('Por tema');assert.equal((await mapState(p)).html,initial.html,'Grouping by topic again restores the default map');assert.equal(new URL(p.url()).search,'');
 assert(!requests.includes('/datos/indice.json'),'Regrouping and filtering use the page itself: the light index is requested only when highlighting or opening a cell');
 // Resaltar: dims every dot whose title, topics or question lack the words typed; the header search stays untouched.
 const haystack=new Map(data.map(r=>[String(r.id),norm([r.titulo,(r.temas||[]).join(' '),r.objetivo].join(' '))])),acronym=data.map(r=>r.titulo.split(':')[0]).find(a=>/^[A-Z][A-Z0-9-]{3,}$/.test(a));assert(acronym,'A trial acronym to highlight');
 for(const query of ['sepsis',acronym,'Insuficiencia  CARDÍACA']){
  const words=norm(query).split(/\s+/).filter(Boolean),expected=sortedIds(data.filter(r=>words.every(w=>haystack.get(String(r.id)).includes(w))).map(r=>String(r.id)));assert(expected.length>0&&expected.length<data.length,'Highlight sample '+query);
  await p.fill('#ev-map-hl',query);await p.waitForFunction(n=>document.querySelector('#ev-map-status').textContent.startsWith(n+' '),expected.length);state=await mapState(p);
  assert.deepEqual(sortedIds(state.dots.filter(d=>!d.dim).map(d=>d.id)),expected,'Highlighted dots for '+query);assert(state.dots.every(d=>d.dim?Number(d.opacity)<.5:d.opacity==='1'),'Dimmed dots fade, matches stay solid');assert.equal(state.dots.length,data.length,'Highlighting hides nothing');
  assert.equal(await p.locator('#ev-map-status').textContent(),expected.length===1?'1 ensayo resaltado':expected.length+' ensayos resaltados');assert.equal(await p.inputValue('#ev-q'),'');assert(await p.locator('#ev-search-panel').isHidden());
 }
 await pick('Por revista');state=await mapState(p);assert.deepEqual(sortedIds(state.dots.filter(d=>!d.dim).map(d=>d.id)),sortedIds(data.filter(r=>['insuficiencia','cardiaca'].every(w=>haystack.get(String(r.id)).includes(w))).map(r=>String(r.id))),'Highlight survives regrouping');await pick('Por tema');
 await p.fill('#ev-map-hl','__nada__');await p.waitForFunction(()=>document.querySelector('#ev-map-status').textContent==='Ningún ensayo coincide.');assert((await mapState(p)).dots.every(d=>d.dim));
 await p.fill('#ev-map-hl','');await p.waitForFunction(()=>!document.querySelector('.ev-map i[data-dim]'));assert.equal(await p.locator('#ev-map-status').textContent(),'');assert.equal((await mapState(p)).html,initial.html,'Clearing the highlight restores the default map');assert.equal(new URL(p.url()).search,'');
 // A cell opens the panel with exactly its trials: title link, journal and date, key finding.
 const cells=model.rows.flatMap(row=>model.bins.map((year,bin)=>({row,bin,year,ids:row.ids.filter(id=>model.trials.get(id).bin===bin)}))).filter(c=>c.ids.length),largest=cells.reduce((a,b)=>b.ids.length>a.ids.length?b:a),single=cells.find(c=>c.ids.length===1);
 assert.equal(await p.locator('button.ev-map-cell').count(),cells.length,'One button per non-empty cell');assert(largest.ids.length>1&&single);
 const button=c=>p.locator('.ev-map tbody tr[data-ev-row="'+c.row.key+'"]>td:nth-child('+(c.bin+2)+')>button'),record=id=>data.find(r=>String(r.id)===id),parsed=html=>p.evaluate(h=>new DOMParser().parseFromString(h,'text/html').body.textContent,html);
 const newestFirst=ids=>ids.map(record).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||b.id-a.id);
 const panelCards=()=>p.locator('#ev-map-panel .ev-card').evaluateAll(ns=>ns.map(n=>{const a=n.querySelector('a.ev-card-title'),r=a.getBoundingClientRect();return {id:n.dataset.id,href:a.getAttribute('href'),title:a.textContent,meta:[...n.querySelectorAll('.ev-card-meta span')].map(s=>s.textContent),finding:n.querySelector('p.ev-intro').textContent,strong:n.querySelectorAll('p.ev-intro strong').length,width:r.width,height:r.height}}));
 const opened=async(c,first)=>{await p.locator('#ev-map-panel .ev-card').first().waitFor();const cards=await panelCards(),order=newestFirst(c.ids);if(first)order.sort((a,b)=>(String(b.id)===first)-(String(a.id)===first));
  assert.deepEqual(cards.map(x=>x.id),order.map(r=>String(r.id)),'Panel lists exactly the trials of the cell, newest article first'+(first?' after the dot pressed':''));assert.equal(await p.locator('#ev-map-panel h2').first().textContent(),c.row.name+', '+c.year);assert.equal((await p.locator('#ev-map-panel .ev-count').textContent()).trim(),trialCount(c.ids.length));
  for(const [i,card]of cards.entries()){const r=order[i];assert.equal(card.href,map[String(r.id)].path);assert.equal(card.title,r.titulo);assert.equal(card.meta[0],r.revista);assert.equal(card.finding,await parsed(r.hallazgo),'Key finding text is unchanged');assert.equal(card.strong,(r.hallazgo.match(/<strong>/g)||[]).length);assert(card.width>=44&&card.height>=44,'Panel link target')}
  assert.deepEqual((await mapState(p)).rows.flatMap(r=>r.cells.map((x,bin)=>x?.pressed==='true'?r.key+'|'+bin:null)).filter(Boolean),[c.row.key+'|'+c.bin],'Only the open cell is pressed');assert.equal(search().get('celda'),c.row.key+'|'+c.bin);return cards};
 await button(largest).scrollIntoViewIfNeeded();await button(largest).click({position:{x:2,y:2}});let cards=await opened(largest);assert(await p.locator('#ev-map-panel h2').first().evaluate(n=>n===document.activeElement),'Focus moves to the panel');assert(await p.locator('#ev-map-panel h2').first().evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'The panel scrolls into view');await geometry(p);
 for(const card of cards)assert.equal((await p.request.get(base+card.href)).status(),200,'Panel link resolves '+card.href);
 p.off('request',track);assert(requests.includes('/datos/indice.json'));assert(!requests.includes('/seo-manifest.json')&&!requests.includes('/resumenes.json'),'The map never downloads the route manifest or the full archive: '+requests.filter(r=>r.endsWith('.json')).join(' '));
 // Pressing a dot lists its trial first.
 const dot=String(newestFirst(largest.ids).at(-1).id);await p.locator('.ev-map tbody i[data-id="'+dot+'"]').click();cards=await opened(largest,dot);
 // Close returns to the cell; a second press on the open cell closes too.
 await p.locator('[data-ev-map-close]').click();assert(await p.locator('#ev-map-panel').isHidden());assert(await button(largest).evaluate(n=>n===document.activeElement),'Close returns focus to the cell');assert.equal(search().get('celda'),null);assert.equal((await mapState(p)).html,initial.html);
 await button(single).click({position:{x:2,y:2}});await opened(single);await button(single).click({position:{x:2,y:2}});assert(await p.locator('#ev-map-panel').isHidden(),'Pressing the open cell again closes the panel');
 // Changing the grouping closes the panel; a trial opened from the panel returns to the map as it was.
 await button(single).click({position:{x:2,y:2}});await opened(single);await pick('Medicina Crítica');assert(await p.locator('#ev-map-panel').isHidden());assert.equal(search().get('celda'),null);await pick('Todas');
 await button(largest).click({position:{x:2,y:2}});cards=await opened(largest);const origin='/mapa/'+new URL(p.url()).search;await p.locator('#ev-map-panel a.ev-card-title').nth(1).click();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.equal(new URL(p.url()).pathname,cards[1].href);assert.equal((await p.locator('[data-ev-field=titulo]').textContent()).trim(),cards[1].title);
 assert.equal(await p.locator('[data-ev-return]').first().getAttribute('href'),origin,'The reader returns to the map');await p.locator('[data-ev-return]').first().click();await p.waitForURL(base+origin,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('[data-ev-map]')?.dataset.ready);await opened(largest);
 // Narrow screens: the table scrolls inside its own container, starting at the newest year, and the row labels stay in place.
 if(width<720){const scroll=await p.locator('.ev-map-scroll').evaluate(n=>{const box=n.getBoundingClientRect(),years=[...n.querySelectorAll('thead th')],last=years.at(-1).getBoundingClientRect(),inner=n.scrollWidth>n.clientWidth+40;n.scrollLeft=-n.scrollWidth;const first=years[0].getBoundingClientRect(),label=n.querySelector('tbody th').getBoundingClientRect();return {inner,newest:last.right<=box.right+1&&last.left>=box.left,oldest:first.right<=box.right+1&&first.left>=label.right-1,sticky:Math.abs(label.left-box.left)<=1}});assert.deepEqual(scroll,{inner:true,newest:true,oldest:true,sticky:true},'Map scroll '+JSON.stringify(scroll))}
 await geometry(p);
}
// Cover band: a static miniature (one dot per record stacked by year, coloured by area), a two-item legend and the way to the map.
async function mapBand(p,label){
 const band=await p.locator('.ev-band').evaluateAll(ns=>ns.map(n=>{const mini=n.querySelector('a.ev-mini'),box=mini.getBoundingClientRect();return {heading:n.querySelector('h2').textContent,href:mini.getAttribute('href'),name:mini.getAttribute('aria-label'),height:box.height,width:box.width,columns:[...mini.querySelectorAll('span')].map(s=>({dots:s.querySelectorAll('i').length,critical:s.querySelectorAll('i[data-sub=critica]').length})),years:[...mini.querySelectorAll('small')].map(s=>s.textContent),legend:[...n.querySelectorAll('.ev-map-legend li')].map(li=>li.textContent),buttons:[...n.querySelectorAll('a.ev-btn')].map(a=>a.textContent+'|'+a.getAttribute('href')),text:n.textContent,below:box.top>=document.querySelector('.ev-ed-grid').getBoundingClientRect().bottom,controls:n.querySelectorAll('button,input,select').length}}));
 assert.equal(band.length,1,label+' has one map band');const b=band[0],trials=[...model.trials.values()];
 assert.equal(b.heading,'Mapa de evidencia');assert.equal(b.href,'/mapa/');assert(b.name&&b.height>=44&&b.width>=44,label+' the miniature is one link of at least 44 px');assert(b.below,label+' band sits below the edition');assert.equal(b.controls,0);
 assert.deepEqual(b.years,model.bins);assert.deepEqual(b.columns,model.bins.map((_,bin)=>({dots:trials.filter(t=>t.bin===bin).length,critical:trials.filter(t=>t.bin===bin&&t.area==='Medicina Crítica').length})),label+' one small dot per record, stacked by year and coloured by area');assert.equal(b.columns.reduce((n,c)=>n+c.dots,0),data.length);
 assert.deepEqual(b.legend,['Medicina Crítica','Medicina Interna']);assert.deepEqual(b.buttons,['Explorar el mapa|/mapa/']);assert(!/\d\s*(ensayos?|res[uú]menes)/i.test(b.text)&&!b.text.includes(String(data.length)),label+' band shows no counts');
}
// Five sections in the masthead: between 1100 px (where the bar shows them) and 1280 px they stay on one line and the search keeps a usable width.
async function mastheadFit(p,base){
 const size=p.viewportSize();
 for(const w of [1100,1180,1280]){await p.setViewportSize({width:w,height:900});await ready(p,'/mapa/',base);
  // Se mide con la página asentada: `ready` vuelve en DOMContentLoaded y, si las fuentes propias aún no se han
  // aplicado, la tipografía de reserva (más ancha) estrecha el buscador durante un instante. Un buscador
  // estrecho de verdad sigue fallando: tras 2 s la medida es la definitiva.
  const measure=()=>p.evaluate(()=>{const box=s=>document.querySelector(s).getBoundingClientRect(),links=[...document.querySelectorAll('.ev-header-nav a')].map(a=>a.getBoundingClientRect()),bar=box('.ev-header-inner'),search=box('.ev-search'),brand=box('.ev-brand');return {links:links.length,oneLine:links.every(r=>r.width>0&&Math.abs(r.top-links[0].top)<1&&r.height<=bar.height),ordered:links.every((r,i)=>i===0||r.left>=links[i-1].right-1),afterBrand:links[0].left>=brand.right,beforeSearch:links.at(-1).right<=search.left,search:search.width,inside:search.right<=bar.right+1,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)}});
  let m=await measure();for(let i=0;i<8&&m.search<200;i++){await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(250);m=await measure()}
  assert.deepEqual({...m,search:m.search>=200},{links:5,oneLine:true,ordered:true,afterBrand:true,beforeSearch:true,search:true,inside:true,overflow:0},'Masthead at '+w+' px '+JSON.stringify(m));
 }
 await p.setViewportSize(size);
}
async function navigation(p,base,width){
 await ready(p,'/',base);
 if(width<720){assert.equal(await p.locator('.ev-mobile-nav').locator('a,button').count(),4);await p.locator('.ev-mobile-nav [data-ev-menu]').click();assert(await p.locator('#ev-menu').isVisible());await p.keyboard.press('Escape');assert(!(await p.locator('#ev-menu').isVisible()));await p.waitForFunction(()=>document.querySelector('.ev-mobile-nav [data-ev-menu]').getAttribute('aria-expanded')==='false',null,{timeout:2000});await p.locator('.ev-mobile-nav [data-ev-specialties]').click();assert(await p.locator('#ev-specialties').isVisible());assert(await p.locator('#ev-specialties a[href="/medicina-critica/"]').isVisible());await p.keyboard.press('Escape')}
 else{assert(await p.locator('.ev-header-nav a[href="/medicina-critica/"]').isVisible());assert(await p.locator('.ev-header-nav a[href="/archivo/"]').isVisible());assert.equal(await p.locator('.ev-header-nav a[aria-current="page"]').getAttribute('href'),'/')}
 if(width>=720)assert.deepEqual(await p.locator('.ev-header-nav a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')+'|'+n.textContent)),['/|Edición actual','/medicina-critica/|Medicina Crítica','/medicina-interna/|Medicina Interna','/mapa/|Mapa de evidencia','/archivo/|Archivo'],'The map sits between Medicina Interna and Archivo');
 for(const where of ['#ev-menu .ev-menu-list','.ev-footer-col[aria-label="Explorar"]'])assert.deepEqual(await p.locator(where+' a[href="/mapa/"]').allTextContents(),['Mapa de evidencia'],where+' links the map');
 // Cover: the home is the current edition (latest week in the data); the signal line is the edition navigator.
 const all=editions(data),current=all.at(-1),lead=current.items[0],rest=current.items.slice(1),squash=s=>String(s).replace(/\s+/g,''),parsed=html=>p.evaluate(h=>new DOMParser().parseFromString(h,'text/html').body.textContent,html);
 assert.deepEqual(await p.locator('h1').allTextContents(),['Evidencia sin ruido'],'Home has exactly one h1: the masthead tagline');
 assert.equal(await p.locator('.ev-ed').getAttribute('data-ev-edition'),current.monday,'Home shows the latest edition in the data');
 for(const gone of ['#ev-list','[data-ev-ids]','#ev-filters','#ev-count','.ev-steps','.ev-hero'])assert.equal(await p.locator(gone).count(),0,'The cover has no '+gone);
 assert.equal(await p.locator('.ev-signal').count(),1,'One signal line per page');assert.equal(await p.locator('.ev-ednav li').count(),Math.min(12,all.length));assert.equal(await p.locator('.ev-ednav li a[aria-current="page"]').getAttribute('href'),'/');
 assert(await p.locator('.ev-ednav-now').evaluate(n=>{const t=n.closest('.ev-ednav-track').getBoundingClientRect(),r=n.getBoundingClientRect();return r.left>=t.left-1&&r.right<=t.right+1}),'The tick of the edition shown is in view');
 assert.equal(squash(await p.locator('.ev-ed-lead h2').textContent()),squash(lead.titulo),'Lead is the most recent article of the edition');assert.equal(await p.locator('.ev-ed-lead a[data-ev-read]').getAttribute('href'),map[String(lead.id)].path);
 assert.equal(await p.locator('.ev-ed-lead .ev-ed-answer').textContent(),await parsed(lead.hallazgo),'Key finding text is unchanged');assert.equal(await p.locator('.ev-ed-lead .ev-ed-answer strong').count(),(lead.hallazgo.match(/<strong>/g)||[]).length);assert.equal(await p.locator('.ev-ed-finding p').first().textContent(),lead.objetivo);
 if(lead.corto)assert.equal(await p.locator('.ev-ed-lead .ev-actions-row a').nth(1).getAttribute('href'),'/resumen.html?id='+lead.id+'&v=corto');
 assert.equal((await p.locator('.ev-ed-toc .ev-count').textContent()).trim(),current.items.length===1?'1 resumen':current.items.length+' resúmenes');
 assert.deepEqual((await p.locator('.ev-ed-toc a.ev-ed-item').evaluateAll(ns=>ns.map(n=>n.getAttribute('href')))).sort(),rest.map(r=>map[String(r.id)].path).sort(),'Every other trial of the week is prerendered as a link');
 assert.equal(await p.locator('.ev-ed-toc a.ev-ed-item:visible').count(),Math.min(7,rest.length));if(rest.length>7){await p.locator('.ev-ed-more>summary').click();assert.equal(await p.locator('.ev-ed-toc a.ev-ed-item:visible').count(),rest.length)}
 await mapBand(p,'Cover');
 await p.fill('#ev-q','sepsis');await p.waitForTimeout(200);assert(await p.locator('#ev-search-panel').isVisible(),'The cover searches with instant results');assert.equal(new URL(p.url()).pathname+new URL(p.url()).search,'/','Typing on the cover does not navigate');await p.keyboard.press('Escape');await geometry(p);
 if(all.length>1){const previous=all.at(-2);await p.locator('a.ev-ednav-step').first().click();await p.waitForURL(u=>u.pathname===previous.route);assert.equal(await p.locator('h1').count(),1);assert(/^Edición anterior · /.test(await p.locator('h1').textContent()),'A past edition names itself in its h1');assert.equal(await p.locator('.ev-ed').getAttribute('data-ev-edition'),previous.monday);assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),'https://resumenestrials.com'+previous.route);assert.equal(squash(await p.locator('.ev-ed-lead h2').textContent()),squash(previous.items[0].titulo));assert.equal(await p.locator('.ev-ednav li a[aria-current="page"]').getAttribute('href'),previous.route);await mapBand(p,'Past edition');await geometry(p);await p.locator('.ev-ed-top a[href="/"]').click();await p.waitForURL(base+'/')}
 // The band leads to the evidence map.
 await ready(p,'/',base);await p.locator('.ev-band a.ev-btn').click();await p.waitForURL(base+'/mapa/');if(width>=720){assert.equal(await p.locator('.ev-header-nav a[aria-current="page"]').getAttribute('href'),'/mapa/');await mastheadFit(p,base)}
 await evidenceMap(p,base,width);
 for(const path of ['/','/archivo/','/mapa/',...editionSample(data).map(e=>e.route),map['1'].path,'/medicina-interna/','/metodologia/','/biblioteca.html','/login.html']){await ready(p,path,base);await singleSearch(p,path)}
 await ready(p,'/metodologia/',base);await p.locator('body').click({position:{x:2,y:300}});await p.keyboard.press('/');assert(await p.locator('#ev-q').evaluate(n=>n===document.activeElement),'Slash focuses the search');await p.locator('#ev-q').blur();await p.keyboard.press('Control+k');assert(await p.locator('#ev-q').evaluate(n=>n===document.activeElement),'Ctrl+K focuses the search');
 const sample=data.find(r=>r.doi&&r.registro);
 for(const q of [sample.titulo,sample.doi,sample.registro,String(sample.anio),sample.revista,norm(sample.especialidad_principal),sample.autor]){
  await p.fill('#ev-q',q);await p.waitForTimeout(200);assert(await p.locator('#ev-search-panel').isVisible(),'Quick results panel '+q);assert((await p.locator('#ev-search-results a').count())>0,'Search field '+q);
 }
 await p.fill('#ev-q','__SIN_RESULTADOS__');await p.waitForTimeout(200);assert.equal(await p.locator('#ev-search-results a').count(),0);assert(/Sin resultados/.test(await p.locator('#ev-search-status').textContent()));await p.keyboard.press('Escape');assert(await p.locator('#ev-search-panel').isHidden());
 await p.fill('#ev-q',sample.doi);await p.waitForTimeout(200);assert(await p.locator('#ev-search-results mark').count()>0);assert.equal(new URL(await p.locator('#ev-search-all').getAttribute('href'),base).searchParams.get('q'),sample.doi);assert.equal(new URL(await p.locator('#ev-search-all').getAttribute('href'),base).pathname,'/archivo/');
 await p.locator('#ev-q').press('ArrowDown');assert(await p.locator('#ev-search-results a').first().evaluate(n=>n===document.activeElement));await p.keyboard.press('Enter');await p.waitForURL('**'+map[String(sample.id)].path);
 await ready(p,'/metodologia/',base);await p.fill('#ev-q','sepsis');await p.locator('#ev-q').press('Enter');await p.waitForURL(u=>u.pathname==='/archivo/'&&u.searchParams.get('q')==='sepsis');await p.waitForFunction(()=>document.querySelector('#ev-count').dataset.ready);assert.equal(await p.inputValue('#ev-q'),'sepsis');assert((await visibleIds(p)).length>0);
 // The theme control lives in the top strip of the masthead, which scrolls away with the page.
 const before=await p.evaluate(()=>document.documentElement.dataset.evTheme);await p.evaluate(()=>scrollTo(0,0));await p.locator('button[data-ev-theme]').click();await p.reload();assert.equal(await p.evaluate(()=>document.documentElement.dataset.evTheme),before==='oscuro'?'claro':'oscuro');
 assert.equal(await p.evaluate(()=>document.documentElement.dataset.evDevice),width<720?'movil':'escritorio');
 assert(await p.locator('a[href="/metodologia/"]').first().isVisible());await geometry(p);
}
const tool=async(p,name)=>{const button=p.locator('['+name+']');if(!(await button.isVisible())){await p.locator('[data-ev-more]').click();assert.equal(await p.locator('[data-ev-more]').getAttribute('aria-expanded'),'true')}return button};
async function reader(p,base,width){
 for(const [id,badge]of [['98','Neumología'],['165','Neumología'],['168','']]){
  const record=data.find(r=>String(r.id)===id);await ready(p,'/archivo/',base);await p.fill('#ev-q',record.titulo);await p.waitForURL(u=>u.searchParams.get('q')===record.titulo);
  const card=p.locator('#ev-list>.ev-card[data-id="'+id+'"]');assert(await card.isVisible());assert.deepEqual(await card.locator('[data-ev-subspecialty]').allTextContents(),badge?[badge]:[],'Archive subspecialty '+id);
  await card.locator('[data-ev-read]').first().click();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.deepEqual(await p.locator('.ev-reading-head [data-ev-subspecialty]').allTextContents(),badge?[badge]:[],'Reader subspecialty '+id);
 }
 const r=data[0],path=map[String(r.id)].path;await ready(p,path,base);await singleSearch(p,path);
 const expected=await p.evaluate(r=>new DOMParser().parseFromString(r.cuerpo,'text/html').body.textContent.replace(/\s+/g,' ').trim(),r);
 assert.equal((await p.locator('article').first().textContent()).replace(/\s+/g,' ').trim(),expected);assert.equal((await p.locator('[data-ev-field=titulo]').textContent()).trim(),r.titulo);
 const full=await p.locator('article p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));assert(full>=18);
 const count=await p.locator('article h2').count();assert.equal(await p.locator('[data-ev-toc] a').count(),count);
 await p.locator('[data-ev-sections]').click();assert(await p.locator('#ev-sections').isVisible());await p.locator('#ev-sections nav a').nth(2).click();assert(!(await p.locator('#ev-sections').isVisible()));await p.waitForTimeout(500);assert(await p.locator('progress').evaluate(n=>n.value>0));await p.waitForFunction(()=>document.querySelector('[data-ev-toc] a[aria-current]')?.hash==='#'+document.querySelectorAll('article h2')[2].id);await p.locator('[data-ev-sections]').click();await p.locator('#ev-sections nav a').first().click();await p.waitForFunction(()=>document.querySelector('[data-ev-toc] a[aria-current]')?.hash==='#'+document.querySelector('article h2').id);
 await p.locator('[data-ev-focus]').click();assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'true');assert(await p.locator('.ev-header').isHidden(),'Reading mode hides the site chrome');assert(await p.locator('[data-ev-sections]').isVisible(),'Reading controls stay available');
 await (await tool(p,'data-ev-font')).click();const altered=await p.locator('article p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));assert.notEqual(altered,full);await p.reload();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('article p').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)),altered);
 await p.locator('[data-ev-focus]').click();assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'false');assert(await p.locator('.ev-header').isVisible());await p.locator('[data-ev-focus]').click();await p.locator('[data-ev-sections]').click();await p.keyboard.press('Escape');assert(!(await p.locator('#ev-sections').isVisible()));assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'true','Dismiss dialog before leaving reading mode');await p.keyboard.press('Escape');assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'false','Escape leaves reading mode');await p.reload();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.equal(await p.locator('[data-ev-focus]').getAttribute('aria-pressed'),'false','Reading mode exit persists');
 await (await tool(p,'data-ev-share')).click();await p.waitForFunction(()=>/Enlace copiado|Copia este enlace/.test(document.querySelector('#ev-reader-status').textContent));
 await p.locator('[data-ev-pdf]').click();assert(await p.locator('#ev-pdf-dialog').isVisible());assert.equal(await p.locator('[name=ev-pdf-version]:checked').getAttribute('value'),'completo');assert.equal(await p.locator('#ev-pdf-dialog [data-ev-pdf-go].ev-btn-primary').getAttribute('data-format'),width<720?'mobile':'a4','Device format is recommended');await p.keyboard.press('Escape');assert(!(await p.locator('#ev-pdf-dialog').isVisible()));
 await p.locator('.ev-version a').nth(1).click();await p.waitForFunction(()=>document.querySelector('[data-ev-reader]')?.dataset.evBrief==='true');assert.equal(await p.locator('.ev-version a').nth(1).getAttribute('aria-current'),'page');const briefExpected=await p.evaluate(r=>new DOMParser().parseFromString(r.corto,'text/html').body.textContent.replace(/\s+/g,' ').trim(),r);assert.equal((await p.locator('article').first().textContent()).replace(/\s+/g,' ').trim(),briefExpected);
 assert.equal(new URL(await p.locator('link[rel=canonical]').getAttribute('href')).pathname,path);await p.waitForFunction(()=>document.querySelector('[data-ev-reader]')?.dataset.evContinuity==='ready');assert(await p.locator('[data-ev-neighbors] a').count()>=2);assert(await p.locator('[data-ev-related] .ev-card').count()>0);
 const original=p.locator('.ev-original a');await original.scrollIntoViewIfNeeded();const originalBox=await original.boundingBox();assert(originalBox&&originalBox.width>=44&&originalBox.height>=44,'Original article touch target >=44px');const originalHref=await original.getAttribute('href');const [originalPopup]=await Promise.all([p.waitForEvent('popup'),original.click()]);await originalPopup.waitForLoadState('domcontentloaded');assert.equal(originalPopup.url(),originalHref);await originalPopup.close();
 await (await tool(p,'data-ev-save')).click();await p.waitForURL(/login\.html\?next=/,{waitUntil:'domcontentloaded'});await p.locator('form#login').waitFor({state:'visible'});for(const id of ['0','999','texto','']){await ready(p,'/resumen.html?id='+id,base);assert.equal(await p.locator('h1').textContent(),'Resumen no encontrado');assert.equal(await p.locator('[data-ev-pdf]').count(),0);assert.equal(await p.locator('script[src*="adsbygoogle"]').count(),0)};
 await ready(p,'/archivo/?q=SOHO&vista=lista',base);await p.locator('#ev-list>.ev-card:visible [data-ev-read]').first().click();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);await p.waitForFunction(()=>document.querySelector('[data-ev-reader]')?.dataset.evContinuity==='ready');const nextHref=await p.locator('[data-ev-neighbors] a').last().getAttribute('href');assert(nextHref.startsWith('/trials/'));await p.locator('[data-ev-neighbors] a').last().click();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.equal(new URL(p.url()).pathname,nextHref);assert.equal(await p.locator('[data-ev-return]').first().getAttribute('href'),'/archivo/?q=SOHO&vista=lista');await p.locator('[data-ev-neighbors] a').first().click();await p.waitForFunction(()=>document.querySelector('[data-ev-reader]')?.dataset.evReader==='1');await p.locator('[data-ev-return]').first().click();await p.waitForURL(/q=SOHO/,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('#ev-count')?.dataset.ready);assert.equal(await p.inputValue('#ev-q'),'SOHO');assert.equal(await p.locator('#ev-view').getAttribute('aria-pressed'),'true');await geometry(p);
 // A trial opened from the cover returns to the cover.
 await ready(p,'/',base);await p.locator('.ev-ed-lead a[data-ev-read]').click();await p.waitForFunction(()=>document.querySelector('[data-ev-sections]')?.onclick);assert.equal(await p.locator('[data-ev-return]').first().getAttribute('href'),'/');await p.locator('[data-ev-return]').first().click();await p.waitForURL(base+'/',{waitUntil:'domcontentloaded'});assert.equal(await p.locator('.ev-ed-lead').count(),1);
}
async function pdfCheck(download,{brief,format}){const name=download.suggestedFilename();assert(name.endsWith('.pdf'));assert(name.includes(brief?'breve':'completo'),name);if(format)assert(name.endsWith('_'+format+'.pdf'),name);const tmp=await download.path();assert(fs.statSync(tmp).size>3000);const bytes=fs.readFileSync(tmp);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.includes(Buffer.from('/Subtype /Image')),'No logo image');for(const font of ['Newsreader-Medium','Literata-Regular','RTSans-Regular','RTSansCondensed-SemiBold'])assert(bytes.includes(Buffer.from('/BaseFont /'+font)),'PDF sin la fuente incrustada '+font);assert(bytes.includes(Buffer.from('/FontFile2')),'Fuentes no incrustadas');assert(!bytes.includes(Buffer.from('/ca 0.045')),'Marca de agua');return name}
async function downloads(p,base){
 const r=data[0],path=map[String(r.id)].path;
 for(const route of ['/archivo/',path,'/resumen.html?id='+r.id,'/resumen.html?id='+r.id+'&v=corto','/resumen/'+r.id+'.html','/resumen/'+r.id+'-corto.html']){
  await ready(p,route,base);
  if(route==='/archivo/'){await p.fill('#ev-q',r.titulo);await p.waitForTimeout(180);const card=p.locator('#ev-list>.ev-card:visible').first();for(const version of ['completo','breve']){await card.locator('.ev-pdf-menu>summary').click();const [download]=await Promise.all([p.waitForEvent('download'),card.locator('[data-ev-card-pdf][data-ev-version="'+version+'"]').click()]);await pdfCheck(download,{brief:version==='breve'})}await geometry(p);continue}
  const brief=route.includes('corto');
  for(const [version,format]of [[brief?'breve':'completo','a4'],[brief?'completo':'breve','mobile']]){
   await p.locator('[data-ev-pdf]').click();assert.equal(await p.locator('[name=ev-pdf-version]:checked').getAttribute('value'),brief?'breve':'completo','Current version preselected');await p.locator('#ev-pdf-dialog label.ev-option').filter({has:p.locator('input[value="'+version+'"]')}).click();
   const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#ev-pdf-dialog [data-ev-pdf-go][data-format="'+format+'"]').click()]);await p.waitForFunction(()=>!document.querySelector('#ev-pdf-dialog').open,null,{timeout:600});await p.locator('.ev-version a').first().scrollIntoViewIfNeeded();assert(await p.evaluate(()=>{const a=document.querySelector('.ev-version a'),r=a.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('a')===a}),'Reader controls reachable right after a PDF download');await pdfCheck(download,{brief:version==='breve',format});
  }
  await geometry(p);
 }
}
async function shell(p,base){
 const paths=['/','/archivo/','/mapa/',...editionSample(data).map(e=>e.route),map['1'].path,'/resumen.html?id=1&v=corto','/medicina-critica/','/medicina-interna/',...Object.values(clusters).map(c=>c.path),'/metodologia/','/correcciones/','/equipo-editorial/','/privacidad/','/terminos/','/login.html','/registro.html','/recuperar.html','/biblioteca.html','/agregar.html','/404.html'];
 for(const path of paths){
  await ready(p,path,base);await geometry(p);assert.equal(await p.locator('input[type=search]').count(),1,path+' single search');const undersized=await p.locator('a,button,input:not([type=hidden]),select,textarea,summary').evaluateAll(ns=>ns.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&!n.closest('.ev-skip')).map(n=>{const r=n.getBoundingClientRect();return {tag:n.tagName,id:n.id,text:(n.textContent||n.getAttribute('aria-label')||'').trim().slice(0,80),width:r.width,height:r.height}}).filter(r=>r.width<43.99||r.height<43.99));assert.deepEqual(undersized,[],path+' targets below 44 px');await p.addScriptTag({path:'node_modules/axe-core/axe.min.js'});const result=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});assert.deepEqual(result,[],path+' accessibility '+JSON.stringify(result));
  if(['/login.html','/registro.html','/recuperar.html','/biblioteca.html','/agregar.html','/privacidad/','/terminos/','/404.html'].includes(path))assert.equal(await p.locator('script[src*="adsbygoogle"]').count(),0,path+' ads');
  if(path==='/biblioteca.html')assert(await p.locator('[data-library-state=signed-out]').isVisible());
 }
 await ready(p,'/registro.html',base);assert(/spam.*correo no deseado|correo no deseado.*spam/is.test(await p.locator('#exito').textContent()));await p.locator('#email').fill('bad');await p.locator('#password').focus();assert.equal(await p.locator('#email').getAttribute('aria-invalid'),'true');
 await p.locator('button[aria-controls=password]').click();assert.equal(await p.locator('#password').getAttribute('type'),'text');await p.locator('button[aria-controls=password]').click();assert.equal(await p.locator('#password').getAttribute('type'),'password');
 const editorFixture=route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:900000}])});await p.context().route(base+'/resumenes.json',editorFixture);await ready(p,'/agregar.html',base);await p.waitForFunction(()=>document.querySelector('#cargado')?.textContent.includes('1 resúmenes'));for(const [id,value]of Object.entries({id:'900001',titulo:'Caso sintético QA',autor:'Autor de prueba QA',revista:'Revista sintética QA',anio:'2026',registro:'QA-INTERFAZ'}))await p.locator('#'+id).fill(value);await p.selectOption('#especialidad_principal','Medicina Interna');const marker='Marcador sintético de sección QA';await p.locator('.ev-sec-txt').first().fill(marker);await p.click('#generar');const output=JSON.parse(await p.inputValue('#salida'));assert.equal(output.length,2);assert(output.find(r=>r.id===900001)?.cuerpo.includes(marker),'Editor preserves entered section text');assert((await p.locator('#pvArt').textContent()).includes(marker),'Editor preview includes section text');const [download]=await Promise.all([p.waitForEvent('download'),p.click('#descargar')]);assert.equal(download.suggestedFilename(),'resumenes.json');const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert(exported.find(r=>r.id===900001)?.cuerpo.includes(marker),'Editor export preserves section text');await p.context().unroute(base+'/resumenes.json',editorFixture);
}
async function sweep(p,base,width,records=data){
 // Keep one WebView within a bounded browser batch. Repeated WebView creation
 // and destruction exposed a native allocator abort in Linux WebKit. Every
 // record and route still runs; the complete browser is closed after 24 records.
 const errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
 for(const r of records){
  for(const path of [map[String(r.id)].path,'/resumen.html?id='+r.id,'/resumen.html?id='+r.id+'&v=corto']){
   await ready(p,path,base);assert.equal(await p.locator('[data-ev-field=titulo]').textContent(),r.titulo);assert(await p.locator('article').first().textContent());assert.equal(await p.locator('[data-ev-sections]').count(),1);await geometry(p);
  }assert.deepEqual(errors,[],'Uncaught browser errors / '+r.id)
 }
}
const tests={archive,navigation,reader,downloads,shell,sweep};
export async function runSuite(name){
 const base=(process.env.RT_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');assertLoopbackBase(base);assert(tests[name],'Unknown suite');let cases=0;
 if(name==='sweep'){
  const selected=process.env.RT_SWEEP_CASE;const validCases=['chromium','webkit'].flatMap(e=>[390,1440].flatMap(w=>['oscuro','claro'].map(t=>e+':'+w+':'+t)));assert(!selected||validCases.includes(selected),'Invalid sweep matrix case');
  for(const [engine,type]of [['chromium',chromium],['webkit',webkit]])for(const width of [390,1440])for(const theme of ['oscuro','claro']){
   if(selected&&selected!==engine+':'+width+':'+theme)continue;
   let checked=0;
   for(let start=0;start<data.length;start+=24){
    const browser=await type.launch();try{
     const c=await browser.newContext({viewport:{width,height:width===390?844:900},acceptDownloads:true,reducedMotion:'reduce'});await isolate(c,base);await c.addInitScript(t=>localStorage.setItem('rt-tema',t),theme);const page=await c.newPage();
     const batch=data.slice(start,start+24);await sweep(page,base,width,batch);checked+=batch.length*3;await c.close();
    }finally{await browser.close()}
   }
   assert.equal(checked,data.length*3);cases++;console.log('sweep '+engine+' '+width+' '+theme+' PASS '+checked+' views / bounded browser batches');
  }
  console.log('DESIGN sweep PASS '+cases+' configurations');return;
 }

 for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){const browser=await type.launch();try{for(const width of [390,1440])for(const theme of ['oscuro','claro']){
  const c=await browser.newContext({viewport:{width,height:width===390?844:900},acceptDownloads:true,reducedMotion:'reduce'});await isolate(c,base);await c.addInitScript(t=>{if(!localStorage.getItem('rt-tema'))localStorage.setItem('rt-tema',t)},theme);const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await installTurnstileTestRoutes(p,base);p.setDefaultTimeout(15000);
  try{await tests[name](p,base,width);assert.deepEqual(errors,[],'Uncaught browser errors');cases++;console.log(name+' '+engine+' '+width+' '+theme+' PASS')}finally{await c.close()}
 }}finally{await browser.close()}}
 console.log('DESIGN '+name+' PASS '+cases+' configurations');
}

