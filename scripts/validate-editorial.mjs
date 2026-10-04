import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=m=>{console.error('EDITORIAL FAIL: '+m);process.exitCode=1};
const ok=m=>console.log('EDITORIAL PASS: '+m);
const index=read('index.html'),privacy=read('privacidad/index.html'),account=read('cuenta.html'),auth=read('auth.js'),login=read('login.html'),register=read('registro.html'),recovery=read('recuperar.html'),runtime=read('site-runtime.js'),css=read('site-runtime.css'),classifier=read('specialty-classification.js');
for(const [name,html] of [['index',index],['cuenta',account],['login',login],['registro',register],['recuperar',recovery],['privacidad',privacy]]){
 for(const font of ['Inter+Tight','JetBrains+Mono','Source+Serif+4'])if(!html.includes(font))fail(name+' no carga '+font);
 if(!html.includes('/site-runtime.js?v=')||!html.includes('/site-runtime.css?v='))fail(name+' no carga runtime versionado');
 if((html.match(/<header class="ev-header">/g)||[]).length!==1)fail(name+' no tiene exactamente una cabecera');
 if(/Fraunces|Newsreader|IBM.Plex.Mono|<style\b/.test(html))fail(name+' conserva presentación anterior o CSS inline');
}
if((login.match(/href="registro\.html"/g)||[]).length!==1)fail('Login debe tener un enlace a registro');
for(const key of ['area','topic','year','journal','type'])if(!index.includes('data-ev-filter="'+key+'"'))fail('Falta filtro '+key);
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
