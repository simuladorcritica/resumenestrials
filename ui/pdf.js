// One PDF contract for canonical, dynamic, legacy and archive readers.
export const JSPDF_VERSION='4.2.1';
export const JSPDF_URL='https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js';
export const JSPDF_SRI='sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3';
export function sanPDF(s){return String(s==null?'':s).normalize('NFKC').replace(/\u2212/g,'-').replace(/[\u2013\u2014\u2015\u2012\u2011]/g,'-').replace(/[\u2018\u2019\u201B\u2032]/g,"'").replace(/[\u201C\u201D\u201F\u2033]/g,'"').replace(/\u2026/g,'...').replace(/[\u00A0\u2007\u2009\u200A\u202F]/g,' ').replace(/\u200B/g,'').replace(/\u2265/g,'>=').replace(/\u2264/g,'<=').replace(/\u2260/g,'!=').replace(/[\u2248\u2245]/g,'~').replace(/\u2192/g,'->').replace(/\u2190/g,'<-').replace(/[\u2080-\u2089]/g,m=>String(m.charCodeAt(0)-0x2080)).replace(/[αβγδμΔχσ]/g,c=>({α:'alpha',β:'beta',γ:'gamma',δ:'delta',μ:'u',Δ:'Delta',χ:'chi',σ:'sigma'}[c]))}
let pending,logoPending,routePending;
export async function loadJsPDF(){if(window.jspdf?.jsPDF)return window.jspdf;if(!pending)pending=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=JSPDF_URL;s.integrity=JSPDF_SRI;s.crossOrigin='anonymous';s.async=true;s.onload=()=>window.jspdf?.jsPDF?resolve(window.jspdf):reject(Error('jsPDF no disponible'));s.onerror=()=>{pending=undefined;s.remove();reject(Error('No se pudo cargar jsPDF'))};document.head.append(s)});return pending}
async function logo(){if(!logoPending)logoPending=fetch('/logo.png').then(async r=>{if(!r.ok)throw Error('Logo no disponible');const b=await r.blob();return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;f.readAsDataURL(b)})}).catch(e=>{logoPending=undefined;throw e});return logoPending}
const plain=s=>{const d=document.createElement('div');d.innerHTML=String(s??'');return d.textContent};
export async function generatePDF(item,{brief=false,format='a4',download=true}={}){
 if(!item?.id||!item.titulo||!(brief?item.corto:item.cuerpo))throw Error('Ensayo incompleto para PDF');
 if(!['a4','mobile'].includes(format))throw Error('Formato de PDF inválido');
 const{jsPDF}=await loadJsPDF(),mobile=format==='mobile',doc=new jsPDF({unit:'pt',format:mobile?[320,640]:'a4',compress:true}),image=await logo(),props=doc.getImageProperties(image);
 const routes=await (routePending??=fetch('/seo-manifest.json').then(r=>{if(!r.ok)throw Error('Rutas PDF no disponibles');return r.json()}));const canonical='https://resumenestrials.com'+routes[String(item.id)].path;
 const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight(),margin=mobile?26:48,usable=width-margin*2,bottom=height-62,bodyFont=mobile?13:10.5,leading=mobile?19:15;
 let y=82;
 function stamp(){doc.saveGraphicsState();doc.setGState(new doc.GState({opacity:.045}));const w=width*.68,h=w*props.height/props.width;doc.addImage(image,'PNG',(width-w)/2,(height-h)/2,w,h,'ev-logo','FAST');doc.restoreGraphicsState();doc.addImage(image,'PNG',margin,24,32,32,'ev-logo','FAST');doc.setFont('helvetica','bold');doc.setFontSize(mobile?8:10);doc.setTextColor(14,68,73);doc.text('RESUMENES TRIALS',margin+42,36);doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(45,63,83);doc.text('ID '+item.id+' / '+(brief?'BREVE':'COMPLETO')+' / '+(mobile?'CELULAR':'A4'),margin+42,49);doc.setDrawColor(25,119,117);doc.setLineWidth(.7);doc.line(margin,64,width-margin,64)}
 stamp();
 function page(){doc.addPage();stamp();y=82}
 function ensure(h){if(y+h>bottom)page()}
 function text(value,{font='times',bold=false,size=bodyFont,line=leading,gap=8}={}){doc.setFont(font,bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(20,35,53);const lines=doc.splitTextToSize(sanPDF(value),usable);for(const l of lines){ensure(line);doc.text(l,margin,y);y+=line}y+=gap}
 text(plain(item.titulo),{font:'helvetica',bold:true,size:mobile?17:19,line:mobile?23:25,gap:10});
 text([item.autor,item.revista,item.anio,item.fecha].filter(Boolean).join(' · '),{font:'helvetica',size:mobile?10:9,line:mobile?15:13});
 for(const[k,label]of[['tipo_estudio','Tipo'],['especialidad_principal','Especialidad'],['especialidad_secundaria','Especialidad secundaria'],['temas','Temas'],['registro','Registro'],['doi','DOI'],['financiacion','Financiacion']]){if(item[k]!==''&&item[k]!=null&&(!Array.isArray(item[k])||item[k].length))text(label+': '+plain(Array.isArray(item[k])?item[k].join(' · '):item[k]),{font:'helvetica',size:mobile?10:8.5,line:mobile?15:12,gap:4})}
 y+=12;
 const source=document.createElement('div');source.innerHTML=brief?item.corto:item.cuerpo;
 for(const node of [...source.children]){const t=node.textContent.replace(/\s+/g,' ').trim();if(!t)continue;if(node.tagName==='H2'){ensure(60);y+=10;text(t,{font:'helvetica',bold:true,size:mobile?14:12,line:mobile?20:17,gap:8})}else text(t)}
 const count=doc.getNumberOfPages();for(let i=1;i<=count;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(6.5);doc.setTextColor(45,63,83);doc.textWithLink('resumenestrials.com / ID '+item.id+' / '+i+' de '+count,margin,height-40,{url:canonical});doc.text('X: @resumenestrials | Telegram: @ResumenesTrials',margin,height-29);doc.text('resumenestrials@outlook.com',margin,height-18)}
 doc.setProperties({title:plain(item.titulo),subject:'Resumen '+item.id+' · '+(brief?'breve':'completo')+' · '+format,author:'Resúmenes Trials',creator:'Resúmenes Trials / jsPDF '+JSPDF_VERSION});
 const filename='Resumen_'+item.id+'_'+(brief?'breve':'completo')+'_'+format+'.pdf';if(download)doc.save(filename);return {doc,filename,pages:count,format,id:item.id,brief}
}

