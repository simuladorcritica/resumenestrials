import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const disclosure=fs.readFileSync(new URL('../templates/home-disclosure.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
test('original homepage paragraph content remains frozen with LF normalized',()=>assert.equal(crypto.createHash('sha256').update(disclosure).digest('hex'),'2879f0a429678708ed68e5c7cca79213ffd1b39855afb12811266b70fd96c0b8'));
for(const name of ['index.html','_includes/index-source.html'])test(name+' retains the original disclosure exactly once',()=>{
 const html=fs.readFileSync(new URL('../'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');assert.equal(html.split(disclosure).length-1,1);
 assert(disclosure.includes('Google AdSense')&&disclosure.includes('Google Search Console'));
 assert(disclosure.includes('href="/privacidad/"')&&disclosure.includes('href="/terminos/"'));
 assert(!html.includes('no utiliza cookies de seguimiento o publicidad'));
});
