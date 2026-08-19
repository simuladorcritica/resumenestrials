import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const files=['cuenta.html','login.html','registro.html','recuperar.html','biblioteca.html'];
let failed=false;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  const scripts=[...html.matchAll(/<script\s+type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
  for(const [i,code] of scripts.entries()){
    const tmp=path.join(os.tmpdir(),`rt-${file.replace(/\W/g,'-')}-${i}.mjs`);
    fs.writeFileSync(tmp,code);
    const r=spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});
    fs.unlinkSync(tmp);
    if(r.status!==0){failed=true;console.error(`ERROR ${file} script ${i+1}\n${r.stderr}`)}else console.log(`PASS ${file} inline module ${i+1}`);
  }
}
if(failed)process.exit(1);
