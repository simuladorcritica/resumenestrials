/* Preserve a tab-local return path without changing canonical article URLs. */
(() => {
  'use strict';
  const KEY='rt-reading-context-v1', RETURN='rt-reading-return-v1', VIEW='rt-reading-view-v1:', TTL=12*60*60*1000;
  const path=location.pathname;
  const isReader=/^\/trials\//.test(path)||path==='/resumen.html';
  const isOrigin=p=>p==='/'||p==='/index.html'||p==='/biblioteca.html'||/^\/(medicina-critica|medicina-interna)\//.test(p);
  const parse=value=>{try{return JSON.parse(value)}catch{return null}};
  const read=()=>{try{const ctx=parse(sessionStorage.getItem(KEY));return ctx&&Array.isArray(ctx.targets)&&Date.now()-ctx.at<TTL&&isOrigin(new URL(ctx.origin,location.origin).pathname)&&new URL(ctx.origin,location.origin).origin===location.origin?ctx:null}catch{return null}};
  const write=ctx=>{try{sessionStorage.setItem(KEY,JSON.stringify(ctx))}catch{}};
  function saveView(){if(!isOrigin(path))return;const q=document.querySelector('#q');if(!q)return;try{sessionStorage.setItem(VIEW+path+location.search,JSON.stringify({at:Date.now(),origin:path+location.search,q:q.value,area:document.querySelector('#area')?.value||'',y:scrollY}))}catch{}}
  function reloadView(){try{if(performance.getEntriesByType('navigation')[0]?.type!=='reload')return null;const view=parse(sessionStorage.getItem(VIEW+path+location.search));return view&&Date.now()-view.at<TTL?view:null}catch{return null}}
  function active(){const ctx=read();if(!ctx||!isReader)return null;const id=new URLSearchParams(location.search).get('id')||document.querySelector('[data-trial-download]')?.getAttribute('data-trial-download');const matches=(path!=='/resumen.html'&&ctx.targets.includes(path))||(id&&ctx.id===String(id));if(matches&&id&&ctx.id!==String(id)){ctx.id=String(id);write(ctx)}return matches?ctx:null;}
  function requestReturn(){const ctx=active();if(!ctx)return;try{sessionStorage.setItem(RETURN,JSON.stringify({origin:ctx.origin,at:Date.now()}))}catch{}}
  window.RTReadingContext={destination:()=>active()?.origin||'/',requestReturn};
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link)return;
    if(link.matches('[data-reading-return],.rt-reader-back')){requestReturn();return;}
    if(!isOrigin(path))return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin||!(/^\/trials\//.test(url.pathname)||url.pathname==='/resumen.html'))return;
    const row=link.closest('.fila,.item,.cat-card');
    const id=row?.getAttribute('data-id')||link.dataset.read||url.searchParams.get('id')||row?.querySelector('[data-id]')?.getAttribute('data-id')||'';
    const targets=[url.pathname,...(row?[...row.querySelectorAll('a[href]')].map(a=>new URL(a.href,location.href).pathname).filter(p=>/^\/trials\//.test(p)):[])];
    write({at:Date.now(),origin:path+location.search,id:String(id),targets:[...new Set(targets)],q:document.querySelector('#q')?.value||'',area:document.querySelector('#area')?.value||'',y:scrollY});
  },true);
  function decorate(){if(!isReader)return;const ctx=active();if(!ctx||document.querySelector('[data-reading-return]'))return;const heading=document.querySelector('.art-head,header.art,.articulo');if(!heading)return;const a=document.createElement('a');a.href=ctx.origin;a.className='reading-return';a.dataset.readingReturn='true';a.textContent=ctx.origin.startsWith('/biblioteca.html')?'Volver a mi biblioteca':/^\/(medicina-critica|medicina-interna)\//.test(ctx.origin)?'Volver a la especialidad':'Volver a mis resultados';heading.before(a);}
  let restored=false;
  function restore(){if(restored||!isOrigin(path))return;const reloaded=reloadView(),ctx=reloaded||read();if(!ctx||ctx.origin!==path+location.search)return;let requested=false;try{const flag=parse(sessionStorage.getItem(RETURN));requested=flag?.origin===ctx.origin&&Date.now()-flag.at<60000}catch{}const backward=performance.getEntriesByType('navigation')[0]?.type==='back_forward';if(!requested&&!backward&&!reloaded)return;
    const q=document.querySelector('#q'),area=document.querySelector('#area');
    if(path==='/biblioteca.html'&&!document.querySelector('#list .item,#list [data-library-state="empty"],#list [data-library-state="no-results"]'))return;
    if(q){q.value=ctx.q;q.dispatchEvent(new Event('input',{bubbles:true}))}if(area){area.value=ctx.area;area.dispatchEvent(new Event('change',{bubbles:true}))}
    restored=true;try{sessionStorage.removeItem(RETURN)}catch{}requestAnimationFrame(()=>requestAnimationFrame(()=>{scrollTo(0,ctx.y);q?.focus({preventScroll:true})}));
  }
  function boot(){decorate();restore();let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();restore()})});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);window.addEventListener('pagehide',saveView);window.addEventListener('pageshow',()=>{restored=false;restore()});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();


