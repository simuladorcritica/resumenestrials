import './client-monitor.js';
import {getLibraryState,toggleFavorite,markRead} from './library-store.js?v=20261003-laboratorio-v1';
import {loadTrials,compareTrialDates} from './trial-data.js?v=20261003-laboratorio-v1';
const list=document.getElementById('list'),q=document.getElementById('q'),area=document.getElementById('area'),status=document.getElementById('status');
let all=[],state,busy=false;
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const specialty=r=>r.especialidad_principal||r.especialidad||'Evidencia clínica';
const topics=r=>Array.isArray(r.temas)?r.temas:(r.tema?[r.tema]:[]);
function render(){
  const term=q.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),a=area.value,fav=new Set(state.favorites);
  const saved=all.filter(r=>fav.has(String(r.id)));
  const rows=saved.filter(r=>!a||specialty(r)===a).filter(r=>!term||[r.titulo,r.nombre,r.revista,r.autor,...topics(r),r.objetivo].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term));
  if(!rows.length){
    list.innerHTML=saved.length?'<div class="ev-notice" data-library-state="no-results"><p>No encontramos coincidencias con esta búsqueda.</p><button type="button" class="ev-button" id="clear-library-search">Restablecer búsqueda</button></div>':'<div class="ev-notice" data-library-state="empty"><p>Todavía no has guardado resúmenes. Puedes hacerlo mientras exploras los ensayos.</p><a href="/">Explorar resúmenes</a></div>';
    const reset=document.getElementById('clear-library-search');if(reset)reset.onclick=()=>{q.value='';area.value='';render();q.focus()};return;
  }
  list.innerHTML=rows.map(r=>`<article class="ev-library-item" data-id="${esc(r.id)}"><div><div class="ev-badges"><span class="ev-tag">${esc(specialty(r))}</span>${topics(r)[0]?`<span class="ev-tag">${esc(topics(r)[0])}</span>`:''}</div><h2><a data-read="${esc(r.id)}" href="resumen.html?id=${encodeURIComponent(r.id)}">${esc(r.titulo||r.nombre||'Resumen')}</a></h2><div class="ev-meta">${esc(r.autor||'')} · ${esc(r.revista||'')}${r.fecha?' · '+esc(r.fecha):''}</div></div><button type="button" class="ev-button" data-remove="${esc(r.id)}" aria-label="Quitar de biblioteca: ${esc(r.titulo||r.nombre||'Resumen')}">Quitar de biblioteca</button></article>`).join('');
  list.querySelectorAll('[data-remove]').forEach(button=>button.onclick=async()=>{
    if(busy)return;busy=true;button.disabled=true;status.textContent='Actualizando tu biblioteca…';
    try{await toggleFavorite(button.dataset.remove);state.favorites=state.favorites.filter(x=>x!==String(button.dataset.remove));render();status.textContent='Resumen quitado de tu biblioteca.';q.focus()}
    catch{status.textContent='No pudimos actualizar tu biblioteca. El resumen sigue guardado. Inténtalo de nuevo.';button.focus()}
    finally{busy=false;button.disabled=false}
  });
  list.querySelectorAll('[data-read]').forEach(a=>a.addEventListener('click',()=>markRead(a.dataset.read).catch(()=>{}),{capture:true}));
}
async function load(){
  list.innerHTML='<div class="ev-notice" data-library-state="loading" role="status">Estamos cargando tus resúmenes guardados.</div>';
  try{
    state=await getLibraryState();
    if(state.mfaRequired){location.replace('login.html?mfa=1&next=biblioteca.html');return}
    if(!state.signedIn){
      document.querySelector('.ev-lead').textContent='Guarda los ensayos que quieras volver a consultar.';
      document.querySelector('.ev-tools').hidden=true;
      list.innerHTML='<section class="ev-notice" data-library-state="signed-out"><p><a class="ev-button" href="login.html?next=biblioteca.html">Entrar</a> <a class="ev-button" href="registro.html">Crear cuenta</a></p></section>';
      return
    }
    all=(await loadTrials()).slice().sort(compareTrialDates);render();
  }catch{
    list.innerHTML='<div class="ev-notice" data-library-state="error" role="alert"><p>No pudimos cargar tu biblioteca. Inténtalo de nuevo.</p><button type="button" class="ev-button" id="retry-library">Reintentar</button></div>';
    document.getElementById('retry-library').onclick=load;
  }
}
q.addEventListener('input',()=>{if(state?.signedIn&&all.length)render()});
area.addEventListener('change',()=>{if(state?.signedIn&&all.length)render()});
load();
