/* D01: group existing version navigation; clinical content and link targets
   remain owned by the canonical/legacy renderers. */
(() => {
  'use strict';
  function enhance() {
    const header=document.querySelector('.art-head, #contenido header.art');
    if (!header || header.querySelector('.ed-version')) return;
    const link=header.querySelector('.trial-action-brief, .rt-legacy-version');
    if (!link) return;
    document.body.dataset.edReader='true';
    const brief=new URLSearchParams(location.search).get('v')==='corto';
    const nav=document.createElement('nav');nav.className='ed-version';nav.setAttribute('aria-label','Versión del resumen');
    const current=document.createElement('span');current.setAttribute('aria-current','page');current.textContent=brief?'Breve':'Completo';
    link.textContent=brief?'Completo':'Breve';
    const actions=link.parentElement;actions.prepend(nav);
    if(brief) nav.append(link,current);else nav.append(current,link);
  }
  function boot(){enhance();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
