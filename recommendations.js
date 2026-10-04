import { getLibraryState } from './library-store.js?v=20261003-laboratorio-v1';

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
    const anchor=document.querySelector('[data-ev-ids]');
    if(!anchor)return;
    const p=state.preferences||{};
    if(!p.area&&!(Array.isArray(p.interests)&&p.interests.length))return;
    const data=await import('/trial-data.js?v=20261003-laboratorio-v1').then(m=>m.loadTrials());
    const ranked=data.map((r,i)=>({r,s:score(r,state,i)})).sort((a,b)=>b.s-a.s).slice(0,3).map(x=>x.r);
    if(!ranked.length)return;
    const section=document.createElement('section');
    section.className='ev-recommendations';
    section.innerHTML=`<div class="ev-rec-head"><div><span>Selección personal</span><strong>Para ti</strong></div><a href="cuenta.html#preferencias">Ajustar preferencias</a></div><ol>${ranked.map(r=>`<li><a href="resumen.html?id=${encodeURIComponent(r.id)}"><span>${esc(r.revista||specialty(r)||'Evidencia clínica')}</span><b>${esc(r.titulo||r.nombre||'Resumen')}</b><small>Leer resumen →</small></a><details><summary>Ficha del estudio</summary>${window.EV?.facts(r)||''}</details></li>`).join('')}</ol>`;
    anchor.insertAdjacentElement('beforebegin',section);
  }catch(err){console.error('Recommendations init',err)}
}
setTimeout(init,0);
