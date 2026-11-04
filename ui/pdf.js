// One PDF contract for canonical, dynamic, legacy and archive readers.
// Identidad editorial (docs/DESIGN_SYSTEM.md): papel blanco, tinta, petróleo y la línea de señal
// del logo, que termina en el único punto ocre, solo en la cabecera de la página 1.
export const JSPDF_VERSION='4.2.1';
export const JSPDF_URL='https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js';
export const JSPDF_SRI='sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3';
// Safety net for characters the embedded fonts do not cover (and for the core-font fallback).
export function sanPDF(s){return String(s==null?'':s).normalize('NFKC').replace(/−/g,'-').replace(/[–—―‒‑]/g,'-').replace(/[‘’‛′]/g,"'").replace(/[“”‟″]/g,'"').replace(/…/g,'...').replace(/[     ]/g,' ').replace(/​/g,'').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/≠/g,'!=').replace(/[≈≅]/g,'~').replace(/→/g,'->').replace(/←/g,'<-').replace(/[₀-₉]/g,m=>String(m.charCodeAt(0)-0x2080)).replace(/[αβγδμΔχσ]/g,c=>({α:'alpha',β:'beta',γ:'gamma',δ:'delta',μ:'u',Δ:'Delta',χ:'chi',σ:'sigma'}[c]))}
let pending,logoPending,routePending,fontPending;
export async function loadJsPDF(){if(window.jspdf?.jsPDF)return window.jspdf;if(!pending)pending=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=JSPDF_URL;s.integrity=JSPDF_SRI;s.crossOrigin='anonymous';s.async=true;s.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf):reject(Error('jsPDF no disponible'));s.onerror=()=>{pending=undefined;s.remove();reject(Error('No se pudo cargar jsPDF'))};document.head.append(s)});return pending}
async function logo(){if(!logoPending)logoPending=fetch('/logo.png').then(async r=>{if(!r.ok)throw Error('Logo no disponible');const b=await r.blob();return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(b)})}).catch(e=>{logoPending=undefined;throw e});return logoPending}
// Self-hosted OFL subsets, fetched only when a PDF is generated and cached in memory.
const FONT_FILES={title:'newsreader-500',titleB:'newsreader-600',read:'literata-400',readB:'literata-600',readI:'literata-400-italic',ui:'plex-sans-400',cond:'plex-sans-condensed-600'};
const FONT_NAMES={title:'Newsreader-Medium',titleB:'Newsreader-SemiBold',read:'Literata-Regular',readB:'Literata-SemiBold',readI:'Literata-Italic',ui:'RTSans-Regular',cond:'RTSansCondensed-SemiBold'};
const CORE={title:['times','bold'],titleB:['times','bold'],read:['times','normal'],readB:['times','bold'],readI:['times','italic'],ui:['helvetica','normal'],cond:['helvetica','bold']};
const b64=buf=>{const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
async function fonts(){if(!fontPending)fontPending=Promise.all(Object.entries(FONT_FILES).map(async([k,f])=>{const r=await fetch('/fonts/pdf/'+f+'.ttf');if(!r.ok)throw Error('Fuente PDF no disponible: '+f);return [k,b64(await r.arrayBuffer())]})).catch(e=>{fontPending=undefined;throw e});return fontPending}
// Palette derived from logo.png (light theme tokens in ui/tokens.css of the identity spec).
const C={ink:[18,35,59],text:[30,39,51],muted:[90,99,114],accent:[20,110,110],brand:[28,138,138],ocre:[200,137,42],line:[221,216,204],alt:[239,235,227],critica:[168,71,42]};
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const longDate=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?(+m[3])+' de '+MESES[+m[2]-1]+' de '+m[1]:String(v||'')};
const plain=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');return d.textContent};
// Presentation only (resumenes.json is never modified): sentence case and closing period for the
// «Puntos clave» lines; the anchor phrase is extracted from mid-sentence and starts in lowercase.
export function tidy(s){s=String(s??'').replace(/\s+/g,' ').replace(/\s+([.,;:)])/g,'$1').trim().replace(/[,;:]+$/,'');if(!s)return s;const first=s.split(' ')[0];if(first===first.toLocaleLowerCase('es'))s=s.charAt(0).toLocaleUpperCase('es')+s.slice(1);return /[.!?…]$/.test(s)?s:s+'.'}
export function studyType(t){t=String(t||'').trim();let m=/^(?:Ensayo cl[ií]nico aleatorizado|ECA)\b\s*(.*)$/i.exec(t),p='ECA';if(!m){m=/^Dos ensayos cl[ií]nicos aleatorizados\b\s*(.*)$/i.exec(t);p='Dos ECA'}if(!m)return t.split(',')[0];const parts=m[1].split(/,\s*|\s+y\s+/).map(x=>x.trim()).filter(Boolean);return parts.length?p+' '+parts.slice(0,3).join(', '):p}
export async function generatePDF(item,{brief=false,format='a4',download=true}={}){
 if(!item?.id||!item.titulo||!(brief?item.corto:item.cuerpo))throw Error('Ensayo incompleto para PDF');
 if(!['a4','mobile'].includes(format))throw Error('Formato de PDF inválido');
 const{jsPDF}=await loadJsPDF(),mobile=format==='mobile',doc=new jsPDF({unit:'pt',format:mobile?[320,640]:'a4',compress:true}),image=await logo();
 let custom=false;
 try{for(const[k,data]of await fonts()){doc.addFileToVFS(FONT_NAMES[k]+'.ttf',data);doc.addFont(FONT_NAMES[k]+'.ttf',FONT_NAMES[k],'normal')}custom=true}catch{custom=false}
 const routes=await (routePending??=fetch('/seo-manifest.json').then(r=>{if(!r.ok)throw Error('Rutas PDF no disponibles');return r.json()}));const canonical='https://resumenestrials.com'+routes[String(item.id)].path;
 const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=mobile?22:48,U=W-M*2;
 // A4 grid: marginal column for section labels + text column (~68 characters per line).
 const LAB=118,TX=mobile?M:M+134,TW=mobile?U:U-134,bottom=mobile?H-46:H-62,top=mobile?52:78;
 const critical=/Cr[ií]tica/.test(item.especialidad_principal||''),tone=critical?C.critica:C.accent;
 const fecha=longDate(item.fecha_publicacion_resumen),folio=(brief?'Resumen breve N.º ':'Resumen N.º ')+item.id+(fecha?' · '+fecha:''),num=(brief?'Breve · ':'')+'N.º '+item.id;
 const setF=(k,size)=>{if(custom)doc.setFont(FONT_NAMES[k],'normal');else doc.setFont(...CORE[k]);if(size)doc.setFontSize(size)};
 const cov=new Map();
 const covered=(k,cp)=>{if(!custom)return false;let m=cov.get(k);if(!m){m=new Map();cov.set(k,m)}if(!m.has(cp)){setF(k);m.set(cp,doc.getFont().metadata.characterToGlyph(cp)>0)}return m.get(cp)};
 // Keep every glyph the embedded font has («», −, ≥, µ, ñ…); sanPDF only for the rest.
 const fit=(k,s)=>{s=String(s??'').normalize('NFC');if(!custom)return sanPDF(s);let o='';for(let ch of s){let cp=ch.codePointAt(0);if(cp<32)continue;if(cp===0x3BC&&!covered(k,cp)){ch='µ';cp=0xB5}o+=covered(k,cp)?ch:sanPDF(ch)}return o};
 const tw=(k,size,s,cs=0)=>{setF(k,size);return doc.getTextWidth(s)+cs*Math.max(0,[...s].length-1)};
 const put=(k,size,s,x,y,color,{cs=0,right=false,link}={})=>{s=fit(k,s);setF(k,size);doc.setTextColor(...color);const w=tw(k,size,s,cs);const px=right?x-w:x;doc.text(s,px,y,cs?{charSpace:cs}:undefined);if(link)doc.link(px,y-size*.8,w,size*1.1,{url:link});return w};
 let y=0;
 // Rich text: words made of styled segments (bold from <strong>, colour and link per run).
 function words(input,{r,b},color){
  const out=[];let cur=null;
  const push=(ch,k,c,link)=>{if(/\s/.test(ch)){cur=null;return}if(!cur){cur={segs:[]};out.push(cur)}const last=cur.segs[cur.segs.length-1];if(last&&last.k===k&&last.c===c&&last.link===link)last.s+=ch;else cur.segs.push({s:ch,k,c,link})};
  const walk=(node,bold)=>{for(const n of node.childNodes){if(n.nodeType===3)for(const ch of n.nodeValue)push(ch,bold?b:r,color);else if(n.nodeType===1)walk(n,bold||/^(STRONG|B)$/.test(n.tagName))}};
  if(Array.isArray(input))for(const run of input)for(const ch of String(run.t))push(ch,run.k||(run.b?b:r),run.c||color,run.link);
  else if(typeof input==='string'){const d=document.createElement('div');d.innerHTML=input;walk(d,false)}else walk(input,false);
  return out;
 }
 function layout(ws,size,width,{indent=0,cs=0}={}){
  const lines=[];let line={ws:[],w:0};const space=tw(ws[0]?.segs[0]?.k||'read',size,' ');
  const measure=w=>{w.w=0;for(const s of w.segs){s.w=tw(s.k,size,s.s,cs);w.w+=s.w+(cs&&s!==w.segs[0]?cs:0)}};
  // Words wider than the column (long URLs) break after «/», «-» or «.»; never with a hyphen.
  const split=w=>{if(w.segs.length>1||w.w<=width)return [w];const s=w.segs[0],out=[];let rest=s.s;while(rest){let n=rest.length;while(n>1&&tw(s.k,size,rest.slice(0,n),cs)>width)n--;if(n<rest.length){const cut=Math.max(rest.lastIndexOf('/',n-1),rest.lastIndexOf('-',n-1),rest.lastIndexOf('.',n-1));if(cut>0)n=cut+1}const piece={segs:[{...s,s:rest.slice(0,n)}],brk:!!out.length};measure(piece);out.push(piece);rest=rest.slice(n)}return out};
  const list=[];for(const w of ws){for(const s of w.segs)s.s=fit(s.k,s.s);measure(w);list.push(...split(w))}
  for(const w of list){
   const avail=width-(lines.length?0:indent),next=line.ws.length?line.w+space+w.w:w.w;
   if(line.ws.length&&next>avail){lines.push(line);line={ws:[w],w:w.w}}else{line.ws.push(w);line.w=next}}
  if(line.ws.length)lines.push(line);lines.space=space;return lines;
 }
 function drawLine(line,x,yy,size,width,justify,cs,space){
  const gaps=line.ws.length-1,gap=justify&&gaps>0?space+(width-line.w)/gaps:space;let px=x;
  for(const w of line.ws){for(const s of w.segs){setF(s.k,size);doc.setTextColor(...s.c);doc.text(s.s,px,yy,cs?{charSpace:cs}:undefined);if(s.link)doc.link(px,yy-size*.8,s.w,size*1.1,{url:s.link});px+=s.w+cs}px+=gap-cs}
 }
 // Flowing paragraph with page breaks; returns the baseline of its last line.
 function para(input,{x=TX,width=TW,size,lh,fonts:f={r:'read',b:'readB'},color=C.text,justify=false,indent=0,cs=0}){
  const ws=words(input,f,color);if(!ws.length)return y;const lines=layout(ws,size,width,{indent,cs});
  lines.forEach((l,i)=>{ensure(lh);const ix=i?0:indent;drawLine(l,x+ix,y,size,width-ix,justify&&i<lines.length-1&&l.ws.length>1,cs,lines.space);y+=lh});
  return y-lh;
 }
 // Small caps label (uppercase + 0.08 em tracking); may wrap inside the marginal column.
 function label(text,x,yy,width,color,size=mobile?8.4:7.6,lh=10){const lines=layout(words([{t:text.toLocaleUpperCase('es')}],{r:'cond',b:'cond'},color),size,width,{cs:size*.08});lines.forEach((l,i)=>drawLine(l,x,yy+i*lh,size,width,false,size*.08,lines.space));return yy+(lines.length-1)*lh}
 // The signal line: a hairline that rises softly at its end into the ochre dot, as in the monogram.
 function signal(x,yb,width,{stroke,r,rise,curve}){const yt=yb-rise,cx=x+width-r,x0=cx-r*.9-curve;doc.setDrawColor(...C.brand);doc.setLineWidth(stroke);doc.setLineCap('round');doc.moveTo(x,yb);doc.lineTo(x0,yb);doc.curveTo(x0+curve*.55,yb,cx-r-curve*.42,yt,cx-r*.9,yt);doc.stroke();doc.setFillColor(...C.ocre);doc.circle(cx,yt,r,'F');doc.setLineCap('butt')}
 function runningHead(){const s=mobile?9:10;put('titleB',s,'Resúmenes Trials',M,mobile?27:40,C.ink);put('ui',mobile?6.8:7.5,mobile?num:folio,W-M,mobile?27:40,C.muted,{right:true});doc.setDrawColor(...C.line);doc.setLineWidth(.6);doc.line(M,mobile?32:46,W-M,mobile?32:46)}
 function page(){doc.addPage();runningHead();y=top+(mobile?14:0)}
 function ensure(h){if(y+h>bottom)page()}
 // Page 1 masthead: monogram + name, folio, then the signal line (the only ochre dot in the document).
 if(mobile){doc.addImage(image,'PNG',M,16,22,22,'rt-logo','FAST');put('titleB',12.5,'Resúmenes Trials',M+28,31.5,C.ink);put('ui',7.5,num,W-M,31,C.muted,{right:true});signal(M,57,U,{stroke:1.2,r:2.9,rise:8,curve:36})}
 else{doc.addImage(image,'PNG',M,26,26,26,'rt-logo','FAST');put('titleB',14.5,'Resúmenes Trials',M+34,44.5,C.ink);put('ui',7.5,folio,W-M,43,C.muted,{right:true});signal(M,74,U,{stroke:1.3,r:3.3,rise:9,curve:46})}
 y=mobile?80:100;
 // Same editorial imprint for both versions: clean title (no kicker); the brief one is named only in the folio.
 y+=mobile?16:20;
 const t=plain(item.titulo),cut=t.indexOf(': '),titleRuns=cut>0&&cut<=40?[{t:t.slice(0,cut),b:true},{t:t.slice(cut)}]:[{t}];
 const tsize=mobile?19:23,tlh=mobile?22:26.2;
 y=para(titleRuns,{x:M,width:U,size:tsize,lh:tlh,fonts:{r:'title',b:'titleB'},color:C.ink})+(mobile?17:22);
 const refRuns=[{t:'Artículo original: '+[item.autor&&item.autor+' et al.',item.revista,item.anio].filter(Boolean).join(' ')+'.'}];
 if(item.doi)refRuns.push({t:' '},{t:'doi:'+item.doi,c:C.accent,link:'https://doi.org/'+item.doi});
 if(item.registro)refRuns.push({t:' · '+item.registro});
 const rs=mobile?7.8:8,rlh=mobile?11.3:11.6;
 y=para(refRuns,{x:M,width:U,size:rs,lh:rlh,fonts:{r:'ui',b:'ui'},color:C.muted});
 if(mobile){y+=rlh;y=para([{t:folio}],{x:M,width:U,size:rs,lh:rlh,fonts:{r:'ui',b:'ui'},color:C.muted})}
 // «Puntos clave» in both versions: only existing text — objetivo, hallazgo and the anchor phrase
 // of the version being downloaded (its own Conclusión), presented in sentence case by tidy().
 const source=document.createElement('div');source.innerHTML=brief?item.corto:item.cuerpo;
 const anchorOf=html=>{const d=document.createElement('div');d.innerHTML=html||'';let a='',inC=false;for(const n of d.children){if(n.tagName==='H2')inC=/^Conclusi/i.test(n.textContent.trim());else if(inC&&!a){const s=n.querySelector('strong');if(s)a=s.textContent.trim()}}return a};
 {
  const anchor=anchorOf(brief?item.corto:item.cuerpo)||anchorOf(item.cuerpo);
  const rows=[['Pregunta',tidy(plain(item.objetivo))],['Hallazgo',item.hallazgo],['Mensaje',tidy(anchor)]].filter(r=>r[1]);
  const pad=mobile?12:14,ks=mobile?11.5:9.2,klh=mobile?16:13.6,kx=mobile?M+pad:TX,kw=mobile?U-pad*2:TW-pad;
  const laid=rows.map(([k,v])=>({k,ls:layout(words(v,{r:'read',b:'readB'},C.text),ks,kw)}));
  // Plan first (the box may continue on the next page instead of leaving page 1 half empty),
  // then paint paper + 2 pt petroleum rule per page and set the rows on top.
  const rowH=r=>(mobile?13:0)+(r.ls.length-1)*klh,head=mobile?36:37,cont=mobile?16:14,next=top+(mobile?14:0);
  let pg=0,py=y+(mobile?14:16);if(laid.length&&py+head+rowH(laid[0])+12>bottom){pg=1;py=next}const startPg=pg;
  const boxTop=py,segs=[],items=[];let segTop=py,by=py+head,last=by;
  laid.forEach((r,i)=>{if(i){let nb=last+7+(mobile?15:13);if(nb+rowH(r)+10>bottom){segs.push({pg,top:segTop,bottom:last+10});pg++;segTop=next;nb=next+cont}else items.push({pg,sep:last+7});by=nb}
   items.push({pg,r,by});last=by+rowH(r)});
  segs.push({pg,top:segTop,bottom:last+(mobile?12:10)});
  for(let k=0;k<=pg;k++){if(k)page();
   for(const g of segs.filter(g=>g.pg===k)){const first=g===segs[0];if(first){doc.setFillColor(...C.brand);doc.rect(M,g.top,U,2,'F')}doc.setFillColor(...C.alt);doc.rect(M,g.top+(first?2:0),U,g.bottom-g.top-(first?2:0),'F')}
   if(k===startPg)label('Puntos clave',M+pad,boxTop+17,U,C.accent,7.6);
   for(const it of items.filter(it=>it.pg===k)){if(it.sep!=null){doc.setDrawColor(...C.line);doc.setLineWidth(.5);doc.line(M+pad,it.sep,M+U-pad,it.sep);continue}
    let yy=it.by;label(it.r.k,M+pad,yy,LAB,C.muted,mobile?7.2:7.4,9.5);if(mobile)yy+=13;
    it.r.ls.forEach((l,j)=>{drawLine(l,kx,yy,ks,kw,!mobile&&j<it.r.ls.length-1&&l.ws.length>1,0,it.r.ls.space);yy+=klh})}}
  y=segs[segs.length-1].bottom+(mobile?18:20);
 }
 // Ficha del estudio: the same fields as before, in the same order.
 const fields=[['Tipo de estudio',item.tipo_estudio],['Publicación',longDate(item.fecha)]].filter(f=>f[1]);
 const fs=mobile?8.5:7.8,flh=mobile?12:11.4;
 for(const[k,v]of fields){ensure(flh*2);if(mobile){label(k,M,y,U,C.muted,7,9);y+=11;y=para([{t:v}],{x:M,width:U,size:fs,lh:flh,fonts:{r:'ui',b:'ui'}})+flh+5}else{label(k,M,y,LAB,C.muted,7.4,9.5);y=para([{t:v}],{x:TX,width:TW,size:fs,lh:flh,fonts:{r:'ui',b:'ui'}})+flh+4}}
 // Body: marginal section labels on A4, labels above the text on Celular.
 const bs=mobile?13:10,blh=mobile?19:15.5;
 function section(title,color,fn,{size=bs,lh=blh}={}){
  if(mobile){ensure(lh*2+28);y+=14;label(title,M,y,U,color);y+=17;fn();y+=4;return}
  ensure(lh*3);y+=lh*.6;const pg=doc.getNumberOfPages(),end=label(title,M,y,LAB,color);fn();if(doc.getNumberOfPages()===pg)y=Math.max(y,end+lh)
 }
 y+=mobile?0:blh*.6;
 if(item.financiacion)section('Financiación',C.muted,()=>{para([{t:plain(item.financiacion)}],{size:mobile?10.5:9,lh:mobile?15:13.5,justify:!mobile})});
 const nodes=[...source.children];
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i];if(n.tagName!=='H2'){if(n.textContent.trim())para(n,{size:bs,lh:blh,justify:!mobile&&n.tagName==='P'});continue}
  const title=n.textContent.replace(/\s+/g,' ').trim(),paras=[];while(nodes[i+1]&&nodes[i+1].tagName!=='H2')paras.push(nodes[++i]);
  section(title,C.accent,()=>{paras.filter(p=>p.textContent.trim()).forEach((p,j)=>{if(j)y+=mobile?8:0;para(p,{size:bs,lh:blh,justify:!mobile&&p.tagName==='P',indent:!mobile&&j?12:0})})});
 }
 // Closing block (last page): how to cite, notice and contacts.
 y+=mobile?16:blh;ensure(blh*4);doc.setDrawColor(...C.line);doc.setLineWidth(.6);doc.line(M,y-(mobile?6:8),W-M,y-(mobile?6:8));
 const cs=mobile?10.5:9,clh=mobile?15:13.5,close={size:cs,lh:clh};
 // Two citation styles only: APA 7 and Vancouver (web content), both for this summary.
 const pub=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(item.fecha_publicacion_resumen||'')),now=new Date(),ab=MESES.map(m=>m.slice(0,3));
 const apaDate=pub?'('+pub[1]+', '+(+pub[3])+' de '+MESES[+pub[2]-1]+')':'(s. f.)',vanDate=pub?pub[1]+' '+ab[+pub[2]-1]+' '+(+pub[3]):'';
 const cited=now.getFullYear()+' '+ab[now.getMonth()]+' '+now.getDate(),tEnd=/[.?!]$/.test(t)?'':'.';
 section('Cómo citar este resumen',C.accent,()=>{
  para([{t:'APA: ',k:'readB'},{t:'Editorial EMEICRÍTICA. '+apaDate+'. '},{t:t,b:true},{t:tEnd+' Resúmenes Trials. '},{t:canonical,c:C.accent,link:canonical}],{size:cs,lh:clh,fonts:{r:'read',b:'readI'}});y+=clh*.5;
  para([{t:'Vancouver: ',k:'readB'},{t:'Editorial EMEICRÍTICA. '+t+' [Internet]. Resúmenes Trials; '+(vanDate?vanDate+' ':'')+'[citado '+cited+']. Disponible en: '},{t:canonical,c:C.accent,link:canonical}],{size:cs,lh:clh,fonts:{r:'read',b:'readI'}})
 },close);
 section('Aviso',C.muted,()=>{para([{t:'Resumen crítico independiente; no sustituye la lectura del artículo original y puede contener errores; las correcciones se publican en la web.'}],{size:cs,lh:clh})},close);
 section('Contacto',C.muted,()=>{para([{t:'X: @resumenestrials · Telegram: @ResumenesTrials · '},{t:'resumenestrials@outlook.com',c:C.accent,link:'mailto:resumenestrials@outlook.com'}],{size:cs,lh:clh})},close);
 // Footer on every page: sand hairline, imprint, page count and the canonical URL.
 const count=doc.getNumberOfPages();
 for(let i=1;i<=count;i++){doc.setPage(i);const fy=mobile?H-36:H-50;doc.setDrawColor(...C.line);doc.setLineWidth(.6);doc.line(M,fy,W-M,fy);const fsz=mobile?6.4:7;put('ui',fsz,'Resúmenes Trials · Editorial EMEICRÍTICA',M,fy+(mobile?9:10),C.muted);put('ui',fsz,'Página '+i+' de '+count,W-M,fy+(mobile?9:10),C.muted,{right:true});put('ui',mobile?6:6.8,mobile?'resumenestrials.com · Resumen N.º '+item.id:canonical,M,fy+(mobile?18:21),C.accent,{link:canonical})}
 doc.setProperties({title:t,subject:'Resumen '+item.id+' · '+(brief?'breve':'completo')+' · '+format,author:'Editorial EMEICRÍTICA · Resúmenes Trials',creator:'Resúmenes Trials / jsPDF '+JSPDF_VERSION});
 const filename='Resumen_'+item.id+'_'+(brief?'breve':'completo')+'_'+format+'.pdf';if(download)doc.save(filename);return {doc,filename,pages:count,format,id:item.id,brief}
}
