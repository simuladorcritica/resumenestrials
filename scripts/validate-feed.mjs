import { readFileSync } from 'node:fs';
const feed=readFileSync('feed.xml','utf8');
const data=JSON.parse(readFileSync('resumenes.json','utf8'));
const manifest=JSON.parse(readFileSync('seo-manifest.json','utf8'));
if(!feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">')) throw new Error('feed.xml no es Atom válido');
if(!feed.includes('<link rel="self" type="application/atom+xml" href="https://resumenestrials.com/feed.xml"/>')) throw new Error('feed.xml no declara self');
const eligible=data.filter(x=>['fecha_revision','actualizado','fecha_publicacion_resumen'].some(k=>/^\d{4}-\d{2}-\d{2}$/.test(String(x[k]||''))));
for(const item of eligible.slice().sort((a,b)=>String(b.fecha_revision||b.actualizado||b.fecha_publicacion_resumen).localeCompare(String(a.fecha_revision||a.actualizado||a.fecha_publicacion_resumen))).slice(0,50)){
  if(!feed.includes(`<id>${manifest[String(item.id)].url}</id>`)) throw new Error(`feed.xml no contiene trial elegible ${item.id}`);
}
console.log(`FEED PASS · ${Math.min(eligible.length,50)} entradas con fecha editorial real`);
