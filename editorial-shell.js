/* D02: a labelled mobile disclosure for the existing navigation. */
(() => {
 'use strict';
 function enhance(){
  if(document.body.dataset.edShell)return;
  if(!document.body.matches('.rt-future-home,.rt-future-trial,.rt-future-legacy,.rt-future-hub,.rt-future-cluster'))return;
  const bar=document.querySelector('.topbar-in'),nav=bar?.querySelector('.rt-main-nav');if(!nav)return;
  document.body.dataset.edShell='true';nav.id='ed-main-navigation';
  const button=document.createElement('button');button.type='button';button.className='ed-menu';button.textContent='Menú';button.setAttribute('aria-controls',nav.id);button.setAttribute('aria-expanded','false');bar.prepend(button);
  const close=()=>{button.setAttribute('aria-expanded','false');bar.removeAttribute('data-menu-open')};
  button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));bar.toggleAttribute('data-menu-open',open)});
  bar.addEventListener('keydown',e=>{if(e.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){close();button.focus()}});
  document.addEventListener('click',e=>{if(!bar.contains(e.target))close()});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))close()});
  const account=bar.querySelector('.auth-entry');if(account){const short=document.createElement('span');short.className='ed-account-short';short.textContent='Cuenta';short.setAttribute('aria-hidden','true');account.append(short)}
 }
 function boot(){enhance();const observer=new MutationObserver(()=>{enhance();if(document.body.dataset.edShell)observer.disconnect()});observer.observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
