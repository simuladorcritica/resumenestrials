import test from 'node:test';
import assert from 'node:assert/strict';
import {isKnownAdsRuntimeError} from './production-error-attribution.mjs';
const source='https://pagead2.googlesyndication.com/pagead/js/r20261001/r20190131/rum_fy2021.js:12:262';
const real={message:'int64',stack:'Error: int64\n    at yb ('+source+')\n    at N ('+source+')'};
test('attributes the exact direct AdSense exception captured in production',()=>assert.equal(isKnownAdsRuntimeError(real),true));
for(const [name,error] of [
 ['application exception',{message:'int64',stack:'Error: int64\n at own (https://resumenestrials.com/site-runtime.js:1:2)'}],
 ['mixed application and provider frames',{...real,stack:real.stack+'\n at own (https://resumenestrials.com/site-runtime.js:1:2)'}],
 ['native frame without source',{...real,stack:real.stack+'\n at Array.forEach (<anonymous>)'}],
 ['missing stack',{message:'int64'}],
 ['missing frames',{message:'int64',stack:'Error: int64'}],
 ['unknown message',{...real,message:'TypeError'}],
 ['unrelated provider script',{...real,stack:real.stack.replaceAll('rum_fy2021.js','other.js')}],
 ['deceptive host suffix',{...real,stack:real.stack.replaceAll('pagead2.googlesyndication.com','pagead2.googlesyndication.com.invalid')}],
 ['insecure source',{...real,stack:real.stack.replaceAll('https:','http:')}],
 ['unrecognized frame syntax',{...real,stack:real.stack+'\n unknown source'}],
 ['absent location',{...real,stack:'Error: int64\n at yb'}],
 ['multiple locations in one frame',{...real,stack:real.stack+'\n at own (https://resumenestrials.com/site-runtime.js:1:2) '+source}],
])test('blocks '+name,()=>assert.equal(isKnownAdsRuntimeError(error),false));
