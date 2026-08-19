import { getLibraryState } from './library-store.js';

const terms={
  sepsis:['sepsis','séptic','septic','infecc'],
  ventilacion:['ventil','mecánica','mechanical ventilation'],
  ards_ecmo:['ards','sdra','ecmo'],
  hemodinamica:['hemodin','choque','shock','vasopres','pressure'],
  renal:['renal','kidney','aki','ácido-base','acid-base'],
  neurocriticos:['neuro','stroke','ictus','tce','brain','cerebral'],
  cardiologia:['cardio','heart','coronar','atrial','cardiac'],
  otros_interna:['diabetes','hepatic','hígado','anemia','internal medicine']
};
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function score(r,state,index){
  const p=state.preferences||{};let s=Math.max(0,2-index/40);
  if(p.area==='critica'&&r.especialidad==='Medicina Crítica')s+=4;
  if(p.area==='interna'&&r.especialidad==='Medicina Interna')s+=4;
  const hay=[r.titulo,r.nombre,r.tema,r.objetivo,r.revista].join(' ').toLowerCase();
  for(const interest of (Array.isArray(p.interests)?p.interests:[]))if((terms[interest]||[]).some(t=>hay.includes(t)))s+=5;
  if(!state.read.includes(String(r.id)))s+=1.5;
  return s;
}

async function init(){
  try{
    const state=await getLibraryState();if(!state.signedIn)return;
    const panel=document.getElementById('rt-user-panel');if(!panel)return;
    const response=await fetch('resumenes.json',{cache:'no-store'});if(!response.ok)return;
    const data=await response.json();
    const ranked=data.map((r,i)=>({r,s:score(r,state,i)})).sort((a,b)=>b.s-a.s).slice(0,3).map(x=>x.r);
    if(!ranked.length)return;
    const section=document.createElement('section');section.className='rt-recommendations';section.innerHTML=`<div class="rt-rec-head"><strong>Para ti</strong><span>Según tus preferencias clínicas</span></div><div class="rt-rec-grid">${ranked.map(r=>`<a href="resumen.html?id=${encodeURIComponent(r.id)}"><span>${esc(r.especialidad||'Evidencia clínica')}</span><b>${esc(r.titulo||r.nombre||'Resumen')}</b><small>${esc(r.revista||'')}</small></a>`).join('')}</div>`;
    const style=document.createElement('style');style.textContent=`.rt-recommendations{margin:14px 0 34px;border-top:1px solid var(--linea);padding-top:22px}.rt-rec-head{display:flex;justify-content:space-between;gap:14px;align-items:baseline;margin-bottom:12px}.rt-rec-head strong{font:500 24px 'Fraunces',serif}.rt-rec-head span{font:10px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--tinta-2)}.rt-rec-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.rt-rec-grid a{display:flex;flex-direction:column;min-height:150px;padding:17px;border:1px solid var(--linea);border-radius:8px;background:rgba(255,255,255,.5);color:var(--tinta);text-decoration:none}.rt-rec-grid a:hover{border-color:var(--teal)}.rt-rec-grid span,.rt-rec-grid small{font:10px 'IBM Plex Mono',monospace;color:var(--tinta-2)}.rt-rec-grid b{font:500 20px/1.18 'Fraunces',serif;margin:9px 0 auto}@media(max-width:760px){.rt-rec-grid{grid-template-columns:1fr}.rt-rec-grid a{min-height:115px}}`;document.head.appendChild(style);
    panel.insertAdjacentElement('afterend',section);
  }catch(err){console.error('Recommendations init',err)}
}

setTimeout(init,0);
