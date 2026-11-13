import fs from 'node:fs';
import {evidenceMap as mapModel,trialCount} from './evidence-map.mjs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{console.error('EDITORIAL FAIL: '+m);process.exitCode=1};
const ok=m=>console.log('EDITORIAL PASS: '+m);
const index=read('index.html'),archive=read('archivo/index.html'),evidenceMap=read('mapa/index.html'),privacy=read('privacidad/index.html'),account=read('cuenta.html'),auth=read('auth.js'),login=read('login.html'),register=read('registro.html'),recovery=read('recuperar.html'),runtime=read('site-runtime.js'),css=read('site-runtime.css'),classifier=read('specialty-classification.js');
for(const font of ['Newsreader','RT Sans','Literata']){
 const faces=[...css.matchAll(/@font-face\{[^}]*\}/g)].map(m=>m[0]).filter(f=>f.includes("font-family:'"+font+"'"));
 if(!faces.length)fail('site-runtime.css no declara '+font);
 for(const f of faces){
  if(!f.includes('font-display:swap'))fail(font+' sin font-display:swap');
  const src=(f.match(/url\('(\/fonts\/[^']+\.woff2)'\)/)||[])[1];
  if(!src)fail(font+' no se sirve desde /fonts/');
  else if(!fs.existsSync('.'+src)||fs.readFileSync('.'+src).subarray(0,4).toString('latin1')!=='wOF2')fail(font+': falta o no es WOFF2 '+src);
 }
}
if(!['literata','newsreader','ibmplexsans'].every(f=>fs.existsSync('fonts/OFL-'+f+'.txt')))fail('faltan las licencias OFL de las fuentes');
// Identidad editorial: sin la tipografía ni los efectos de la estética anterior.
if(/'Sora'|aurora\(|backdrop-filter:blur|linear-gradient\(1[0-9]0deg,#|--ev-grad:linear-gradient/.test(css))fail('site-runtime.css conserva rastros de Nova (Sora, degradados, vidrio)');
if(!/--ev-dot:#c8892a/.test(css)||(css.match(/var\(--ev-dot\)/g)||[]).length!==1)fail('El ocre debe usarse solo en el punto de la línea de señal');
if((index.match(/class="ev-signal"/g)||[]).length!==1)fail('La portada debe tener la línea de señal una sola vez');
// La portada es la edición actual: un único h1 (el lema de la cabecera), ancla de recomendaciones y nada del archivo.
if((index.match(/<h1\b/g)||[]).length!==1||!index.includes('<h1>Evidencia sin ruido</h1>'))fail('La portada debe tener un único h1: Evidencia sin ruido');
if(!index.includes('data-ev-edition=')||!index.includes('data-ev-recs'))fail('La portada no muestra la edición actual o perdió el ancla de recomendaciones');
if(/id="ev-list"|data-ev-ids=|data-ev-filter=|class="ev-steps"/.test(index))fail('La portada no debe incluir el archivo, los filtros ni los pasos');
if(!/fonts\.(googleapis|gstatic)\.com/.test(css))ok('Fuentes Newsreader, RT Sans y Literata servidas desde el propio sitio.');else fail('site-runtime.css depende de Google Fonts');
for(const [name,html] of [['index',index],['archivo',archive],['mapa',evidenceMap],['cuenta',account],['login',login],['registro',register],['recuperar',recovery],['privacidad',privacy]]){
 // Fuentes propias: la página no debe depender de servidores externos para mostrarse.
 if(/fonts\.(googleapis|gstatic)\.com/.test(html))fail(name+' depende de Google Fonts (bloquea el render en redes móviles)');
 for(const font of ['Inter+Tight','JetBrains+Mono','Source+Serif+4'])if(html.includes(font))fail(name+' conserva la tipografía anterior '+font);
 if(!html.includes('/site-runtime.js?v=')||!html.includes('/site-runtime.css?v='))fail(name+' no carga runtime versionado');
 if((html.match(/<header class="ev-header">/g)||[]).length!==1)fail(name+' no tiene exactamente una cabecera');
 if(/Fraunces|Newsreader|IBM.Plex.Mono|<style\b/.test(html))fail(name+' conserva presentación anterior o CSS inline');
}
if((login.match(/href="registro\.html"/g)||[]).length!==1)fail('Login debe tener un enlace a registro');
// El archivo completo vive en /archivo/: filtros, selector de especialidad y PDF por tarjeta.
for(const key of ['sub','topic','year','journal','type'])if(!archive.includes('data-ev-filter="'+key+'"'))fail('Falta filtro '+key);
if((archive.match(/name="ev-area"/g)||[]).length!==3)fail('Falta el selector segmentado de especialidad');
for(const [name,html] of [['La portada',index],['El archivo',archive],['El mapa',evidenceMap]])if((html.match(/<input\b[^>]*type="search"/g)||[]).length!==1||!html.includes('id="ev-q"'))fail(name+' debe tener un único buscador');
// Mapa de evidencia: la vista por tema va en el HTML, con sus tres controles, su leyenda y su panel. El ocre sigue reservado a la línea de señal (regla de arriba).
if((evidenceMap.match(/<h1\b/g)||[]).length!==1||!evidenceMap.includes('<h1>Mapa de evidencia</h1>'))fail('El mapa debe tener un único h1: Mapa de evidencia');
for(const piece of ['data-ev-map','name="ev-map-area"','name="ev-map-rows"','id="ev-map-hl" type="text"','class="ev-map-legend"','id="ev-map-panel"','class="ev-map-cell"'])if(!evidenceMap.includes(piece))fail('Al mapa le falta '+piece);
{
 // Cada resumen, en la fila, el año y el color que dictan los datos (misma regla que el generador, escrita aparte).
 const model=mapModel(JSON.parse(read('resumenes.json')),JSON.parse(read('seo-cluster-manifest.json'))),rows=[...evidenceMap.matchAll(/<tr data-ev-row="([^"]+)"><th scope="row">([^<]+)<small>([^<]+)<\/small><\/th>(.*?)<\/tr>/g)],seen=new Set();
 if(rows.map(r=>r[1]+'|'+r[2]+'|'+r[3]).join('\n')!==model.rows.map(r=>r.key+'|'+r.name+'|'+r.area+' · '+trialCount(r.ids.length)).join('\n'))fail('Las filas del mapa (nombre, área, número y orden) no corresponden a los datos');
 if([...evidenceMap.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m=>m[1]).join('|')!==model.bins.join('|'))fail('Las columnas del mapa no corresponden a los años de los datos');
 for(const [,key,,,cells] of rows)[...cells.matchAll(/<td>(?:<button type="button" class="ev-map-cell" aria-pressed="false" aria-label="([^"]+)">(.*?)<\/button>)?<\/td>/g)].forEach((cell,bin)=>{
  const dots=[...(cell[2]||'').matchAll(/<i data-id="(\d+)" data-sub="([a-z]+)" data-j="(\d)"><\/i>/g)],row=model.rows.find(r=>r.key===key);
  if(row&&dots.length&&cell[1]!==row.name+', '+model.bins[bin]+': '+trialCount(dots.length))fail('Casilla del mapa con nombre accesible incorrecto: '+cell[1]);
  for(const [,id,tone,journal] of dots){const trial=model.trials.get(id);seen.add(id);if(!trial||trial.row!==key||trial.bin!==bin||trial.tone!==tone||trial.journal!==Number(journal))fail('El mapa coloca o colorea mal el resumen '+id)}
 });
 if(seen.size!==model.trials.size||(evidenceMap.match(/<i data-id="/g)||[]).length!==model.trials.size)fail('El mapa debe dibujar exactamente un punto por resumen');
}
if((index.match(/class="ev-band"/g)||[]).length!==1||!index.includes('<a class="ev-btn" href="/mapa/">Explorar el mapa</a>'))fail('La portada debe llevar la franja del mapa una sola vez');
if(!archive.includes('id="ev-archivo"')||!archive.includes('data-ev-ids=')||!archive.includes('data-ev-card-pdf=')||!runtime.includes('SpecialtyClassification'))fail('Archivo sin listado, PDF o taxonomía');
if(!classifier.includes('Hematolog')||!classifier.includes('Neumolog')||classifier.includes('Medicina Interna General'))fail('Taxonomía canónica incompleta');
if(!css.includes('minmax(0,1fr)')||!css.includes('ev-mobile-nav'))fail('Contrato responsive incompleto');
if(!privacy.includes('ev-prose')||!privacy.includes('Política de Privacidad'))fail('Política fuera del sistema institucional');
if (!auth.includes('getAccountPreferences') || !auth.includes('updateAccountPreferences')) fail('auth.js no expone el contrato de preferencias de cuenta.');
else ok('Contrato de preferencias disponible en auth.js.');

const accountContracts = [
  ['actualización de perfil', /updateProfile\(\{firstName:/],
  ['consentimiento del perfil', /newsletterOptIn:/],
  ['lectura del consentimiento vigente', /notifMaster'\)\.checked=!!profile\?\.newsletter_opt_in/],
  ['lectura de preferencias', /saved\.preferences\s*\|\|\s*\{\}/],
  ['alta y baja de avisos mediante updateProfile', /newsletterOptIn:\$\('notifMaster'\)\.checked/],
  ['escritura de preferencias', /updateAccountPreferences\(\{\s*preferences\s*:/]
];
for (const [label, pattern] of accountContracts) {
  if (!pattern.test(account)) fail(`cuenta.html no respeta el contrato actual de auth.js: falta ${label}.`);
}

const obsoleteAccountFragments = ['notifications_enabled', 'notify_critical_care', 'notify_internal_medicine', 'sort_preference'];
for (const fragment of obsoleteAccountFragments) {
  if (account.includes(fragment)) fail(`cuenta.html usa una clave obsoleta no soportada por auth.js: ${fragment}`);
}
if (!process.exitCode) ok('Cuenta y auth.js comparten el mismo contrato de perfil, avisos y preferencias.');


if(process.exitCode)process.exit(process.exitCode);console.log('Editorial architecture PASS');
