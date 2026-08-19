// Ajustes de consistencia de contenido que no alteran el motor editorial.
function updatePrivacyCopy(){
  const headings=[...document.querySelectorAll('h2,h3,h4')];
  const h=headings.find(x=>/privacidad y contenido/i.test(x.textContent||''));
  if(!h)return;
  let p=h.nextElementSibling;
  if(p?.tagName==='P'){
    p.innerHTML='Resúmenes Trials permite crear una cuenta personal. Al registrarte tratamos los datos que proporcionas —como nombre, nombre de usuario y correo electrónico— para gestionar tu acceso, preferencias y, cuando lo autorizas, avisos de nuevos resúmenes. No utilizamos publicidad comportamental ni vendemos tus datos.';
    const p2=p.nextElementSibling;
    if(p2?.tagName==='P')p2.innerHTML='La autenticación se gestiona mediante Supabase y la protección anti-bot mediante Cloudflare Turnstile. Puedes consultar finalidades, derechos y mecanismos de contacto en el <a href="privacidad.html">Aviso de privacidad</a>.';
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',updatePrivacyCopy);else updatePrivacyCopy();
