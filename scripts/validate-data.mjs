import fs from 'node:fs';

const file='resumenes.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const errors=[];const warnings=[];
if(!Array.isArray(data)) errors.push('resumenes.json debe contener un arreglo.');
const ids=new Set(),dois=new Map();
for(const [i,r] of (Array.isArray(data)?data:[]).entries()){
  const tag=`registro ${i+1}${r?.id!=null?` (id ${r.id})`:''}`;
  if(r?.id==null||String(r.id).trim()==='')errors.push(`${tag}: falta id.`);else if(ids.has(String(r.id)))errors.push(`${tag}: id duplicado ${r.id}.`);else ids.add(String(r.id));
  for(const f of ['titulo','revista','autor','fecha']) if(!String(r?.[f]??'').trim()) warnings.push(`${tag}: falta ${f}.`);
  if(r?.fecha&&!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha))errors.push(`${tag}: fecha inválida ${r.fecha}; usar YYYY-MM-DD.`);
  if(r?.especialidad&&!['Medicina Crítica','Medicina Interna'].includes(r.especialidad))warnings.push(`${tag}: especialidad no estándar: ${r.especialidad}.`);
  if(r?.doi){const d=String(r.doi).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//,'').trim();if(dois.has(d))warnings.push(`${tag}: DOI repetido con id ${dois.get(d)} (${d}).`);else dois.set(d,r.id)}
  for(const f of ['url','enlace','link'])if(r?.[f]&&!/^https?:\/\//i.test(String(r[f])))warnings.push(`${tag}: ${f} no parece URL absoluta.`);
}
console.log(`Validación: ${data.length} resúmenes, ${errors.length} errores, ${warnings.length} advertencias.`);
for(const w of warnings)console.warn('WARN',w);
for(const e of errors)console.error('ERROR',e);
if(errors.length)process.exit(1);
