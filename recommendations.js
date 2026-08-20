import { getLibraryState } from './library-store.js';

const terms={sepsis:['sepsis','séptic','septic','infecc'],ventilacion:['ventil','mecánica','mechanical ventilation'],ards_ecmo:['ards','sdra','ecmo'],hemodinamica:['hemodin','choque','shock','vasopres','pressure'],renal:['renal','kidney','aki','ácido-base','acid-base'],neurocriticos:['neuro','stroke','ictus','tce','brain','cerebral'],cardiologia:['cardio','heart','coronar','atrial','cardiac'],otros_interna:['diabetes','hepatic','hígado','anemia','internal medicine']};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const specialty=r=>r.especialidad_principal||r.especialidad||'';
const topics=r=>Array.isArray(r.temas)?r.temas:(r.tema?[r.tema]:[]);

function score(r,state,index){
  const p=state.preferences||{};
  let s=Math.max(0,2-index/40);
  const area=specialty(r);
  if(p.area==='critica'&&area==='Medicina Crítica')s+=4;
  if(p.area==='interna'&&area==='Medicina Interna')s+=4;
  const hay=[r.titulo,r.nombre,...topics(r),r.objetivo,r.revista].join(' ').toLowerCase();
  for(const interest of(Array.isArray(p.interests)?p.interests:[]))if((terms[interest]||[]).some(t=>hay.includes(t)))s+=5;
  if(!state.read.includes(String(r.id)))s+=1.5;
  return s;
}

async function init(){
  try{
    const state=await getLibraryState();
    if(!state.signedIn)return;
    const anchor=document.querySelector('.indice-cabecera');
    if(!anchor)return;
    const p=state.preferences||{};
    if(!p.area&&!(Array.isArray(p.interests)&&p.interests.length))return;
    const response=await fetch('resumenes.json',{cache:'no-store'});
    if(!response.ok)return;
    const data=await response.json();
    const ranked=data.map((r,i)=>({r,s:score(r,state,i)})).sort((a,b)=>b.s-a.s).slice(0,3).map(x=>x.r);
    if(!ranked.length)return;
    const section=document.createElement('section');
    section.className='rt-recommendations';
    section.innerHTML=`<div class="rt-rec-head"><div><span>Selección personal</span><strong>Para ti</strong></div><a href="cuenta.html#preferencias">Ajustar preferencias</a></div><ol>${ranked.map(r=>`<li><a href="resumen.html?id=${encodeURIComponent(r.id)}"><span>${esc(r.revista||specialty(r)||'Evidencia clínica')}</span><b>${esc(r.titulo||r.nombre||'Resumen')}</b><small>Leer resumen →</small></a></li>`).join('')}</ol>`;
    const style=document.createElement('style');
    style.textContent=`.rt-recommendations{margin:46px 0 8px;padding:26px 0;border-top:1px solid var(--linea);border-bottom:1px solid var(--linea)}.rt-rec-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:20px}.rt-rec-head>div{display:flex;align-items:baseline;gap:14px}.rt-rec-head span,.rt-rec-head a{font:10px 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--tinta-2)}.rt-rec-head strong{font:500 28px 'Fraunces',serif}.rt-rec-head a{color:var(--teal-hondo);text-decoration:none}.rt-recommendations ol{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:0}.rt-recommendations li{padding:0 24px;border-left:1px solid var(--linea)}.rt-recommendations li:first-child{padding-left:0;border-left:0}.rt-recommendations a{text-decoration:none;color:var(--tinta);display:flex;flex-direction:column;height:100%}.rt-recommendations li span{font:10px 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--tinta-2)}.rt-recommendations b{font:500 20px/1.2 'Fraunces',serif;margin:8px 0 14px}.rt-recommendations small{margin-top:auto;font:10px 'IBM Plex Mono',monospace;color:var(--teal-hondo)}.rt-recommendations li:hover b{color:var(--teal-hondo)}@media(max-width:760px){.rt-rec-head,.rt-rec-head>div{align-items:flex-start;flex-direction:column;gap:5px}.rt-recommendations ol{grid-template-columns:1fr}.rt-recommendations li,.rt-recommendations li:first-child{padding:16px 0;border-left:0;border-top:1px solid var(--linea)}.rt-recommendations li:first-child{border-top:0;padding-top:0}}`;
    document.head.appendChild(style);
    anchor.insertAdjacentElement('beforebegin',section);
  }catch(err){console.error('Recommendations init',err)}
}
setTimeout(init,0);
