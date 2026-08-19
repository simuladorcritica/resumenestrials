import './client-monitor.js';
import { getProfile } from './auth.js';
import { getLibraryState,toggleFavorite,markRead,touchLastVisit } from './library-store.js';
import { RT_WEB_VERSION } from './app-version.js';

const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let data=[];
let byId=new Map();
let state={signedIn:false,favorites:[],read:[],preferences:{}};
let advanced={year:'',journal:'',status:'all'};
let applying=false;

function injectStyle(){
  if(document.getElementById('rt-interactive-style'))return;
  const s=document.createElement('style');s.id='rt-interactive-style';s.textContent=`
  .rt-user-panel{margin:34px 0 12px;padding:22px 24px;border:1px solid var(--linea);border-radius:10px;background:linear-gradient(135deg,rgba(15,95,95,.07),rgba(255,255,255,.45));display:flex;justify-content:space-between;gap:20px;align-items:center;flex-wrap:wrap}
  .rt-user-panel h2{font-family:'Fraunces',serif;font-size:28px;font-weight:500;margin:0 0 4px}.rt-user-panel p{margin:0;color:var(--tinta-2);font-size:16px}.rt-user-actions{display:flex;gap:8px;flex-wrap:wrap}.rt-user-actions a,.rt-mini-btn{font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.05em;border:1px solid var(--teal-hondo);border-radius:999px;padding:8px 13px;text-decoration:none;background:#fff;color:var(--teal-hondo);cursor:pointer}.rt-user-actions a.primary{background:var(--teal-hondo);color:#fff}
  .rt-advanced{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:16px 0 8px}.rt-advanced select{font:12px 'IBM Plex Mono',monospace;color:var(--tinta);background:#fff;border:1px solid var(--linea);border-radius:4px;padding:8px 10px}.rt-fav{margin-left:8px}.rt-fav[data-on=true]{background:var(--teal-hondo);color:#fff}.rt-unread-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ambar);margin-left:8px;vertical-align:middle}.rt-version{position:fixed;right:8px;bottom:6px;font:9px 'IBM Plex Mono',monospace;color:var(--tinta-2);opacity:.38;z-index:5;pointer-events:none}
  @media(max-width:650px){.rt-user-panel{align-items:flex-start}.rt-user-actions{width:100%}.rt-user-actions a{flex:1;text-align:center}.rt-advanced select{flex:1;min-width:140px}}
  `;document.head.appendChild(s);
}

async function loadData(){
  const r=await fetch('resumenes.json',{cache:'no-store'});if(!r.ok)throw new Error('No se pudo cargar resumenes.json');
  data=await r.json();byId=new Map(data.map(x=>[String(x.id),x]));
}

function articleId(row){const a=row.querySelector('a.cabeza[href*="resumen.html?id="]');if(!a)return null;try{return new URL(a.href,location.href).searchParams.get('id')}catch{return null}}

function journalOptions(){return [...new Set(data.map(r=>r.revista).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));}
function yearOptions(){return [...new Set(data.map(r=>(r.fecha||'').slice(0,4)).filter(Boolean))].sort().reverse();}

function addAdvanced(){
  const header=document.querySelector('.indice-cabecera');if(!header||document.getElementById('rt-advanced'))return;
  const div=document.createElement('div');div.id='rt-advanced';div.className='rt-advanced';
  div.innerHTML=`<select id="rt-year" aria-label="Filtrar por año"><option value="">Todos los años</option>${yearOptions().map(y=>`<option>${esc(y)}</option>`).join('')}</select><select id="rt-journal" aria-label="Filtrar por revista"><option value="">Todas las revistas</option>${journalOptions().map(j=>`<option value="${esc(j)}">${esc(j)}</option>`).join('')}</select>${state.signedIn?'<select id="rt-status" aria-label="Filtrar por estado"><option value="all">Todos</option><option value="unread">No leídos</option><option value="favorites">Guardados</option></select>':''}`;
  header.insertAdjacentElement('afterend',div);
  div.addEventListener('change',()=>{advanced.year=document.getElementById('rt-year')?.value||'';advanced.journal=document.getElementById('rt-journal')?.value||'';advanced.status=document.getElementById('rt-status')?.value||'all';applyPersonalFilters()});
}

async function addUserPanel(){
  const main=document.querySelector('main.envoltorio');if(!main||document.getElementById('rt-user-panel'))return;
  const panel=document.createElement('section');panel.id='rt-user-panel';panel.className='rt-user-panel';
  if(state.signedIn){
    let profile=null;try{profile=await getProfile()}catch{}
    const name=profile?.username||state.user?.user_metadata?.username||'tu cuenta';
    const unread=data.filter(r=>!state.read.includes(String(r.id))).length;
    panel.innerHTML=`<div><h2>Bienvenido, ${esc(name)}</h2><p>${unread?`Tienes ${unread} resúmenes pendientes por explorar.`:'Estás al día con los resúmenes que has abierto.'}</p></div><div class="rt-user-actions"><a class="primary" href="biblioteca.html">Mi biblioteca · ${state.favorites.length}</a><a href="cuenta.html">Preferencias</a></div>`;
  }else{
    panel.innerHTML='<div><h2>Tu evidencia, organizada a tu manera.</h2><p>Inicia sesión para guardar resúmenes, distinguir lo leído y personalizar filtros.</p></div><div class="rt-user-actions"><a class="primary" href="login.html">Iniciar sesión</a><a href="registro.html">Crear cuenta</a></div>';
  }
  main.prepend(panel);
}

function enhanceRows(){
  if(applying)return;applying=true;
  document.querySelectorAll('.fila').forEach(row=>{
    const id=articleId(row);if(!id)return;
    const a=row.querySelector('a.cabeza');
    if(a&&!a.dataset.rtReadBound){a.dataset.rtReadBound='1';a.addEventListener('click',()=>{if(state.signedIn)markRead(id).catch(()=>{})},{capture:true})}
    const title=row.querySelector('.fila-cuerpo h3');
    if(state.signedIn&&title&&!state.read.includes(id)&&!title.querySelector('.rt-unread-dot'))title.insertAdjacentHTML('beforeend','<span class="rt-unread-dot" title="No leído" aria-label="No leído"></span>');
    const pdf=row.querySelector('.fila-pdf');
    if(state.signedIn&&pdf&&!pdf.querySelector('.rt-fav')){
      const b=document.createElement('button');b.type='button';b.className='rt-mini-btn rt-fav';b.dataset.on=String(state.favorites.includes(id));b.textContent=state.favorites.includes(id)?'✓ Guardado':'☆ Guardar';
      b.addEventListener('click',async ev=>{ev.preventDefault();ev.stopPropagation();b.disabled=true;try{const on=await toggleFavorite(id);b.dataset.on=String(on);b.textContent=on?'✓ Guardado':'☆ Guardar';state.favorites=on?[...new Set([...state.favorites,id])]:state.favorites.filter(x=>x!==id);const link=document.querySelector('#rt-user-panel .primary');if(link)link.textContent=`Mi biblioteca · ${state.favorites.length}`;applyPersonalFilters()}catch(err){console.error(err)}finally{b.disabled=false}});
      pdf.appendChild(b);
    }
  });
  applying=false;applyPersonalFilters();
}

function applyPersonalFilters(){
  document.querySelectorAll('.fila').forEach(row=>{
    const id=articleId(row),r=byId.get(String(id));if(!r)return;
    const y=(r.fecha||'').slice(0,4);
    const okYear=!advanced.year||y===advanced.year;
    const okJournal=!advanced.journal||r.revista===advanced.journal;
    const okStatus=advanced.status==='all'||(advanced.status==='unread'&&!state.read.includes(String(id)))||(advanced.status==='favorites'&&state.favorites.includes(String(id)));
    row.dataset.rtPersonalVisible=String(okYear&&okJournal&&okStatus);
    if(!(okYear&&okJournal&&okStatus))row.style.display='none';else if(row.style.display==='none')row.style.display='';
  });
  document.querySelectorAll('.grupo-anio').forEach(g=>{const visible=[...g.querySelectorAll('.fila')].some(r=>getComputedStyle(r).display!=='none');if(!visible)g.style.display='none';else if(g.style.display==='none')g.style.display=''});
}

async function init(){
  injectStyle();
  const v=document.createElement('div');v.className='rt-version';v.textContent=RT_WEB_VERSION;document.body.appendChild(v);
  try{await Promise.all([loadData(),getLibraryState().then(s=>state=s)]);await addUserPanel();addAdvanced();enhanceRows();const indice=document.getElementById('indice');if(indice){new MutationObserver(()=>enhanceRows()).observe(indice,{childList:true,subtree:true})}if(state.signedIn)touchLastVisit().catch(()=>{})}catch(err){console.error('RT interactive init',err)}
}

init();
