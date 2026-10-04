import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const destination=path.resolve(process.argv[2]||'_site');
const required=['auth.js','supabase-config.js','turnstile.js','turnstile-config.js','library-store.js','library-page.js','recommendations.js','trial-data.js','site-runtime.js','site-runtime.css','ui/pdf.js','resumenes.json'];
for(const file of required){
 const built=path.join(destination,file);
 assert(fs.existsSync(built),'Jekyll omitted public runtime dependency '+file);
 const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest(fs.readFileSync(built)),digest(fs.readFileSync(file)),'Jekyll changed public runtime dependency '+file);
}
const seen=new Set(),pending=required.filter(file=>file.endsWith('.js'));
while(pending.length){
 const file=pending.pop();if(seen.has(file))continue;seen.add(file);
 const source=fs.readFileSync(path.join(destination,file),'utf8');
 const imports=source.matchAll(/\b(?:import|export)(?:\s*\(\s*|\s*(?:[^'";\n]*?\bfrom\s*)?)['"]([^'"]+)['"]/g);
 for(const [,specifier] of imports){
  if(!specifier.startsWith('.')&&!specifier.startsWith('/'))continue;
  const dependency=path.posix.normalize(specifier.startsWith('/')?specifier.slice(1):path.posix.join(path.posix.dirname(file),specifier)).split('?')[0].split('#')[0];
  assert(!dependency.startsWith('../'),'Import outside published site');
  assert(fs.existsSync(path.join(destination,dependency)),file+' imports missing public asset '+dependency);
  if(dependency.endsWith('.js'))pending.push(dependency);
 }
}
for(const privatePath of ['templates','docs','scripts','tools','supabase'])assert(!fs.existsSync(path.join(destination,privatePath)),'Jekyll published private build directory '+privatePath);
console.log('JEKYLL ARTIFACT PASS',required.length,'exact public assets;',seen.size,'modules in import closure; private directories excluded');
