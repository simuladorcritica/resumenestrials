import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const input = process.env.GSC_DATA_FILE || 'seo-data/search-console.json';
const outputDir = process.env.GSC_REPORT_DIR || 'reports';
const config = JSON.parse(readFileSync('seo-config.json', 'utf8'));
const manifest = JSON.parse(readFileSync('seo-manifest.json', 'utf8'));
const clusters = JSON.parse(readFileSync('seo-cluster-manifest.json', 'utf8'));
const gsc = existsSync(input) ? JSON.parse(readFileSync(input, 'utf8')) : { property: config.siteUrl, rows: [] };
const rows = Array.isArray(gsc.rows) ? gsc.rows : [];
const now = rows.length ? [...rows].map((x) => x.date).sort().at(-1) : new Date().toISOString().slice(0,10);
const days = (a,b) => (new Date(a) - new Date(b)) / 86400000;
const aggregate = (windowDays, offset=0) => {
  const end = new Date(`${now}T00:00:00Z`); end.setUTCDate(end.getUTCDate() - offset);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - windowDays + 1);
  const map = new Map();
  for (const row of rows) {
    const d = new Date(`${row.date}T00:00:00Z`); if (d < start || d > end) continue;
    const key = row.page; const x = map.get(key) || {page:key,clicks:0,impressions:0,positionNumerator:0,queries:new Map()};
    x.clicks += +row.clicks || 0; x.impressions += +row.impressions || 0; x.positionNumerator += (+row.position || 0) * (+row.impressions || 0);
    const q=x.queries.get(row.query)||{clicks:0,impressions:0}; q.clicks+=+row.clicks||0; q.impressions+=+row.impressions||0; x.queries.set(row.query,q); map.set(key,x);
  }
  return new Map([...map].map(([k,x])=>[k,{...x,ctr:x.impressions?x.clicks/x.impressions:0,position:x.impressions?x.positionNumerator/x.impressions:0}]));
};
const expectedCtr = (p) => { const entries=Object.entries(config.expectedCtr).map(([k,v])=>[+k,v]).sort((a,b)=>a[0]-b[0]); return (entries.find(([rank])=>p<=rank)||entries.at(-1))[1]; };
const current=aggregate(28), previous=aggregate(28,28), weights=config.weights;
const maxImp=Math.max(1,...[...current.values()].map(x=>x.impressions));
const indexFiles=['_includes/index-source.html','medicina-critica/index.html','medicina-interna/index.html',
  ...Object.values(clusters).map(x=>`${x.path.replace(/^\//,'')}index.html`),
  ...Object.values(manifest).map(x=>`${x.path.replace(/^\//,'')}index.html`)];
const corpus=indexFiles.filter(existsSync).map(file=>readFileSync(file,'utf8')).join('\n');
const opportunities=[];
for(const x of current.values()){
  const prev=previous.get(x.page)||{clicks:0,impressions:0,position:x.position}; const ctrGap=Math.max(0,expectedCtr(x.position)-x.ctr)/Math.max(expectedCtr(x.position),0.001);
  const decline=Math.max(0,(prev.clicks-x.clicks)/Math.max(prev.clicks,1)); const rank=x.position>=4&&x.position<=15?1:x.position<=30?.65:.15;
  const sameQuery=[...x.queries].filter(([,q])=>q.impressions>=5).some(([query])=>[...current.values()].filter(y=>y.page!==x.page&&y.queries.has(query)).length>0)?1:0;
  const path=new URL(x.page).pathname; const incoming=(corpus.match(new RegExp(`href=["']${path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`, 'g'))||[]).length;
  const linkSignal=Math.min(1,incoming/5);
  const score=Math.round(Math.min(100,100*(weights.impressions*Math.log1p(x.impressions)/Math.log1p(maxImp)+weights.ranking*rank+weights.ctrGap*Math.min(1,ctrGap)+weights.decline*Math.min(1,decline)+weights.internalLinks*linkSignal+weights.cannibalization*sameQuery)/Object.values(weights).reduce((a,b)=>a+b,0)));
  const types=[]; if(x.impressions>=20&&x.position>=4&&x.position<=15)types.push('A'); if(x.impressions>=20&&ctrGap>.25)types.push('B'); if(x.position>10&&x.position<=30)types.push('C'); if(sameQuery)types.push('E'); if(decline>.25)types.push('F');
  opportunities.push({page:x.page,score,types,clicks:x.clicks,impressions:x.impressions,ctr:+x.ctr.toFixed(4),position:+x.position.toFixed(1),clickChange:x.clicks-prev.clicks,incomingInternalLinks:incoming});
}
opportunities.sort((a,b)=>b.score-a.score);
const totals=(m)=>[...m.values()].reduce((a,x)=>({clicks:a.clicks+x.clicks,impressions:a.impressions+x.impressions}),{clicks:0,impressions:0});
const render=(label,cur,prev)=>`# SEO ${label} REPORT\n\nPeriodo terminado: ${now}\n\n| Métrica | Actual | Anterior | Cambio |\n|---|---:|---:|---:|\n| Clicks | ${cur.clicks} | ${prev.clicks} | ${cur.clicks-prev.clicks} |\n| Impressions | ${cur.impressions} | ${prev.impressions} | ${cur.impressions-prev.impressions} |\n\n## Top 10 SEO Opportunity Score\n\n${opportunities.slice(0,10).map(x=>`- ${x.score}/100 · tipos ${x.types.join(',')||'—'} · ${x.page} · ${x.clicks} clicks · ${x.impressions} impressions · posición ${x.position}`).join('\n')||'Sin datos de Search Console disponibles.'}\n`;
mkdirSync(outputDir,{recursive:true}); writeFileSync(join(outputDir,'seo-opportunities.json'),JSON.stringify({generatedAt:new Date().toISOString(),property:gsc.property,formula:'ponderación configurable de impresiones, rango, brecha CTR, caída, enlaces internos y canibalización',opportunities},null,2)+'\n');
writeFileSync(join(outputDir,'seo-weekly.md'),render('WEEKLY',totals(aggregate(7)),totals(aggregate(7,7)))); writeFileSync(join(outputDir,'seo-monthly.md'),render('MONTHLY',totals(current),totals(previous)));
console.log('Opportunity Engine: PASS');
console.log('Private report generated: PASS');
