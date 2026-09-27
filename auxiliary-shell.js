/* Apply the approved shared navigation without replacing account controls. */
(() => {
  function enhance(){
    if(!document.body.matches('.rt-future-account,.rt-future-institutional'))return;
    const bar=document.querySelector('.topbar .top,.topbar .topbar-in,main.page > .top');if(!bar)return;
    const existingTheme=bar.querySelector('.rt-tema-btn');
    if(existingTheme)bar.querySelector('.evidence-theme')?.remove();
    if(bar.dataset.evidenceAux)return;
    bar.dataset.evidenceAux='true';
    let nav=bar.querySelector('nav');if(!nav){nav=document.createElement('nav');nav.setAttribute('aria-label','Navegación principal');bar.append(nav)}
    for(const [href,label] of [['/','Explorar'],['/biblioteca.html','Mi biblioteca'],['/cuenta.html','Mi cuenta']]){
      if([...nav.querySelectorAll('a[href]')].some(a=>new URL(a.href,location.href).pathname.replace(/\/index\.html$/,'/')===href))continue;
      const link=document.createElement('a');link.href=href;link.textContent=label;
      if(location.pathname===href)link.setAttribute('aria-current','page');nav.append(link);
    }
    if(existingTheme)return;
    const theme=document.createElement('button');theme.type='button';theme.className='evidence-theme';
    function label(){theme.textContent=document.body.classList.contains('rt-tema-claro')?'Tema oscuro':'Tema claro';}
    theme.onclick=()=>{const light=document.body.classList.toggle('rt-tema-claro');try{localStorage.setItem('rt-tema',light?'claro':'oscuro')}catch{}label()};label();bar.append(theme);
  }
  function boot(){enhance();const observer=new MutationObserver(enhance);observer.observe(document.body,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
