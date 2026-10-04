import fs from 'node:fs';import crypto from 'node:crypto';
const jsSources=['specialty-classification.js','ui/core.js','reading-context.js','ui/archive.js','ui/reader.js','ui/forms.js'];
const cssSources=['ui/tokens.css','ui/site.css'];
const bundle=sources=>'/* GENERATED FILE. Run: node scripts/build-site-runtime.mjs */\n'+sources.map(p=>'/* source: '+p+' */\n'+fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n').trim()).join('\n\n')+'\n';
const js=bundle(jsSources),css=bundle(cssSources);
if(Buffer.byteLength(css)>70000)throw Error('CSS supera 70 KB');
if(Buffer.byteLength(js)>90000)throw Error('Runtime JS supera 90 KB');
fs.writeFileSync('site-runtime.js',js);fs.writeFileSync('site-runtime.css',css);
const version=crypto.createHash('sha256').update(js).update(css).update(fs.readFileSync('ui/pdf.js','utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12);
fs.writeFileSync('ui/runtime-version.json',JSON.stringify({version},null,2)+'\n');
console.log('Runtime único: '+Buffer.byteLength(js)+' bytes JS / '+Buffer.byteLength(css)+' bytes CSS · '+version);

