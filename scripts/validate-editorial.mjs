import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{console.error('EDITORIAL FAIL: '+m);process.exitCode=1};
const ok=m=>console.log('EDITORIAL PASS: '+m);
const index=read('index.html'),privacy=read('privacidad/index.html'),account=read('cuenta.html'),auth=read('auth.js'),login=read('login.html'),register=read('registro.html'),recovery=read('recuperar.html'),runtime=read('site-runtime.js'),css=read('site-runtime.css'),classifier=read('specialty-classification.js');
for(const font of ['Sora','Literata']){
 const faces=[...css.matchAll(/@font-face\{[^}]*\}/g)].map(m=>m[0]).filter(f=>f.includes("font-family:'"+font+"'"));
 if(!faces.length)fail('site-runtime.css no declara '+font);
 for(const f of faces){
  if(!f.includes('font-display:swap'))fail(font+' sin font-display:swap');
  const src=(f.match(/url\('(\/fonts\/[^']+\.woff2)'\)/)||[])[1];
  if(!src)fail(font+' no se sirve desde /fonts/');
  else if(!fs.existsSync('.'+src)||fs.readFileSync('.'+src).subarray(0,4).toString('latin1')!=='wOF2')fail(font+': falta o no es WOFF2 '+src);
 }
}
if(!fs.existsSync('fonts/OFL-literata.txt')||!fs.existsSync('fonts/OFL-sora.txt'))fail('faltan las licencias OFL de las fuentes');
if(!/fonts\.(googleapis|gstatic)\.com/.test(css))ok('Fuentes Sora y Literata servidas desde el propio sitio.');else fail('site-runtime.css depende de Google Fonts');
for(const [name,html] of [['index',index],['cuenta',account],['login',login],['registro',register],['recuperar',recovery],['privacidad',privacy]]){
 // Fuentes propias: la página no debe depender de servidores externos para mostrarse.
 if(/fonts\.(googleapis|gstatic)\.com/.test(html))fail(name+' depende de Google Fonts (bloquea el render en redes móviles)');
 for(const font of ['Inter+Tight','JetBrains+Mono','Source+Serif+4'])if(html.includes(font))fail(name+' conserva la tipografía anterior '+font);
 if(!html.includes('/site-runtime.js?v=')||!html.includes('/site-runtime.css?v='))fail(name+' no carga runtime versionado');
 if((html.match(/<header class="ev-header">/g)||[]).length!==1)fail(name+' no tiene exactamente una cabecera');
 if(/Fraunces|Newsreader|IBM.Plex.Mono|<style\b/.test(html))fail(name+' conserva presentación anterior o CSS inline');
}
if((login.match(/href="registro\.html"/g)||[]).length!==1)fail('Login debe tener un enlace a registro');
for(const key of ['sub','topic','year','journal','type'])if(!index.includes('data-ev-filter="'+key+'"'))fail('Falta filtro '+key);
if((index.match(/name="ev-area"/g)||[]).length!==3)fail('Falta el selector segmentado de especialidad');
if((index.match(/<input\b[^>]*type="search"/g)||[]).length!==1||!index.includes('id="ev-q"'))fail('La portada debe tener un único buscador');
if(!index.includes('data-ev-card-pdf=')||!runtime.includes('SpecialtyClassification'))fail('Portada sin PDF o taxonomía');
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
