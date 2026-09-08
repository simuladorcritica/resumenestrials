import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {trialDateKey,compareTrialDates} from '../trial-data.js';

test('bibliographic dates sort without altering their displayed values',()=>{
  const rows=JSON.parse(fs.readFileSync(new URL('../resumenes.json',import.meta.url),'utf8'));
  const original=JSON.stringify(rows);
  const dates={51:'2015-11-09',53:'2018-03-01',54:'2018-03-01',55:'2022-01-18',56:'2022-08-27',85:'2024-05-16',86:'2024-11-16',87:'2022-06-15',88:'2021-01-20',89:'2025-11-21',90:'2023-06-15'};
  for(const row of rows) assert.equal(trialDateKey(row.fecha),Date.parse((dates[row.id]||row.fecha)+'T00:00:00Z'),`id ${row.id}`);
  const recent=rows.filter(r=>[2025,2026].includes(Number(r.anio))).slice().sort(compareTrialDates);
  for(let i=1;i<recent.length;i++) assert.ok(Date.parse(dates[recent[i-1].id]||recent[i-1].fecha)>=Date.parse(dates[recent[i].id]||recent[i].fecha));
  assert.equal(JSON.stringify(rows),original);
});
test('invalid and unknown dates remain last without inventing a date',()=>{
  for(const value of ['','no consta','2026-02-30','2025-02-29','0 de enero de 2026','1 de desconocido de 2026']) assert.equal(trialDateKey(value),null);
  assert.equal(trialDateKey('2024-02-29'),Date.parse('2024-02-29T00:00:00Z'));
  assert.deepEqual([{fecha:''},{fecha:'2026-01-01'},{fecha:'2025-12-31'}].sort(compareTrialDates).map(x=>x.fecha),['2026-01-01','2025-12-31','']);
});
test('concurrent consumers share one request and retry after a failed load',async()=>{
  const originalFetch=globalThis.fetch;let calls=0;
  try {
    globalThis.fetch=async()=>{calls++;return {ok:false,status:503}};
    const {loadTrials}=await import('../trial-data.js?test=retry');
    await assert.rejects(loadTrials(),/503/);
    globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>[{id:1}]}};
    const [a,b,c]=await Promise.all([loadTrials(),loadTrials(),loadTrials()]);
    assert.equal(calls,2);assert.equal(a,b);assert.equal(b,c);assert.deepEqual(a,[{id:1}]);
  } finally {globalThis.fetch=originalFetch;}
});
test('malformed data rejects instead of becoming an empty library',async()=>{
  const originalFetch=globalThis.fetch;
  try {for(const [i,value] of [null,{},[null]].entries()) {
    globalThis.fetch=async()=>({ok:true,json:async()=>value});
    const {loadTrials}=await import(`../trial-data.js?test=invalid${i}`);
    await assert.rejects(loadTrials(),/lista/);
  }} finally {globalThis.fetch=originalFetch;}
});
