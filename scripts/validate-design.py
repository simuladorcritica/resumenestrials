from pathlib import Path
import json,re
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import aplicar_experiencia_futura as future
ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/"ui/runtime-version.json").read_text(encoding="utf8"))["version"]
data=json.loads((ROOT/"resumenes.json").read_text(encoding="utf8"));manifest=json.loads((ROOT/"seo-manifest.json").read_text(encoding="utf8"));clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf8"))
home=(ROOT/"_includes/index-source.html").read_text(encoding="utf8")
archive=(ROOT/"archivo/index.html").read_text(encoding="utf8")
assert archive.count('class="ev-card" data-id=')==len(data),"Prerender must include every record"
assert 'id="ev-archivo"' in archive and '<link rel="canonical" href="https://resumenestrials.com/archivo/">' in archive
assert (ROOT/"index.html").read_text(encoding="utf8")==home
# Portada = edición actual (última semana con datos); cada edición anterior tiene página propia con todos sus ensayos enlazados.
from site_templates import editions,edition_route
weeks=editions(data);assert weeks,"At least one edition"
assert 'class="ev-card" data-id=' not in home and 'data-ev-ids=' not in home,"The cover must not carry the archive"
assert home.count('<h1>Evidencia sin ruido</h1>')==1 and home.count("<h1")==1 and 'data-ev-recs' in home
pages=[(monday,rows,ROOT/"ediciones"/monday/"index.html") for monday,rows in weeks[:-1]]+[(weeks[-1][0],weeks[-1][1],ROOT/"_includes/index-source.html")]
for monday,rows,path in pages:
 s=path.read_text(encoding="utf8")
 assert s.count('data-ev-edition="'+monday+'"')==1,f"{path}: edition"
 assert s.count('class="ev-signal"')==1 and s.count("<h1")==1,f"{path}: one signal line and one h1"
 for r in rows:assert 'href="'+manifest[str(r["id"])]["path"]+'"' in s,f"{path}: missing trial {r['id']}"
 if path.parent.parent.name=="ediciones":assert '<link rel="canonical" href="https://resumenestrials.com'+edition_route(monday)+'">' in s
assert sorted(d.name for d in (ROOT/"ediciones").iterdir())==[monday for monday,_ in weeks[:-1]] if len(weeks)>1 else not (ROOT/"ediciones").exists(),"Stale or missing edition pages"
# Mapa de evidencia: un punto por resumen ya en el HTML, las rutas incrustadas iguales a las del manifiesto y su módulo con la huella vigente.
import hashlib
from site_templates import map_bins,map_bin,area_of
mapa=(ROOT/"mapa/index.html").read_text(encoding="utf8")
dots=re.findall(r'<i data-id="(\d+)" data-sub="[a-z]+" data-j="\d"></i>',mapa)
assert sorted(dots,key=int)==sorted((str(r["id"]) for r in data),key=int),"Map must prerender exactly one dot per record"
assert mapa.count('<button type="button" class="ev-map-cell"')==len(re.findall(r'<td><button',mapa)) and '<td><i' not in mapa,"Every dot sits inside a cell button"
assert json.loads(re.search(r'<script type="application/json" id="ev-map-paths">(.*?)</script>',mapa,re.S)[1].replace("<\\/","</"))=={str(r["id"]):manifest[str(r["id"])]["path"] for r in data},"Map paths must match the manifest"
assert '<link rel="canonical" href="https://resumenestrials.com/mapa/">' in mapa and mapa.count("<h1")==1 and "<h1>Mapa de evidencia</h1>" in mapa
assert len(re.findall(r'<input\b[^>]*type="search"',mapa))==1 and 'id="ev-map-hl" type="text"' in mapa,"The map keeps a single search field"
module=hashlib.sha256((ROOT/"map-page.js").read_bytes().replace(b"\r\n",b"\n")).hexdigest()[:12]
assert mapa.count('<script type="module" src="/map-page.js?v='+module+'"></script>')==1,"mapa/index.html must load the current map-page.js (regenerate after editing it)"
assert not re.search(r"\.routes\(|['\"`]/?seo-manifest",(ROOT/"map-page.js").read_text(encoding="utf8")),"The map must not download seo-manifest.json"
# Franja del mapa en la portada y en cada edición: un punto por resumen, apilado por año y coloreado por área, sin cifras.
columns=[[0,0] for _ in map_bins(data)]
for r in data:columns[map_bin(r)][0]+=1;columns[map_bin(r)][1]+=area_of(r)=="Medicina Crítica"
for monday,rows,path in pages:
 s=path.read_text(encoding="utf8");band=re.search(r'<section class="ev-band"[\s\S]*?</section>',s)
 assert band and s.count('class="ev-band"')==1 and s.index('class="ev-band"')>s.index('class="ev-ed-grid"'),f"{path}: map band below the edition"
 mini=re.search(r'<a class="ev-mini" href="/mapa/" aria-label="[^"]+">(.*?)</a>',band[0])
 assert mini and [[c.count("<i"),c.count('data-sub="critica"')] for c in re.findall(r'<span>(.*?)</span>',mini[1])]==columns,f"{path}: miniature"
 assert re.findall(r'<small>([^<]+)</small>',mini[1])==map_bins(data) and '<a class="ev-btn" href="/mapa/">Explorar el mapa</a>' in band[0]
 assert not re.search(r'\d\s*(ensayos?|resúmenes)',re.sub(r'<[^>]+>',' ',band[0])),f"{path}: the band shows no counts"
# Especialidades y subtemas: el texto de templates/textos-temas.json va íntegro al final, bajo «Sobre esta sección», y no en la cabecera.
import html as html_module
texts=json.loads((ROOT/"templates/textos-temas.json").read_text(encoding="utf8"))
for scope,text in texts.items():
 s=(ROOT/scope/"index.html").read_text(encoding="utf8");block='<section class="ev-about" aria-labelledby="ev-about-h"><h2 id="ev-about-h" class="ev-eyebrow ev-ed-label">Sobre esta sección</h2><p class="ev-topic-intro">'+html_module.escape(text,quote=True)+'</p></section></main>'
 assert s.count(block)==1 and s.count('class="ev-topic-intro"')==1 and s.index(block)>s.index('id="ev-more"'),f"{scope}: section text must close the page content, unchanged"
 hero=re.search(r'<section class="ev-hero">[\s\S]*?</section>',s)[0]
 assert "ev-topic-intro" not in hero and "ev-lead" not in hero and hero.count("<p ")==1,f"{scope}: header keeps the label and the title only"
css=(ROOT/"site-runtime.css").read_text(encoding="utf8");runtime=(ROOT/"site-runtime.js").read_text(encoding="utf8")
assert len(css.encode())<=70000
assert len(runtime.encode())<=90000
assert css.count("!important")<=10
assert "SpecialtyClassification" in runtime and "inferSubspecialty" in runtime
assert "import('/ui/pdf.js?v='" in runtime and "import('/reader-advertising.js')" in runtime
assert "JSPDF_SRI" in (ROOT/"ui/pdf.js").read_text(encoding="utf8")
for p in future.candidates():
 if not p.exists():continue
 s=p.read_text(encoding="utf8")
 assert s.count("/site-runtime.css?v="+version)==1,f"{p}: CSS version"
 assert s.count("/site-runtime.js?v="+version)==1,f"{p}: JS version"
 assert not re.search(r"<style\b|Fraunces|Newsreader|IBM[ +]Plex[ +]Mono",s),f"{p}: obsolete presentation"
 assert s.count('<header class="ev-header">')==1
 assert 'name="viewport"' in s and 'charset=' in s
for r in data:
 e=manifest[str(r["id"])];p=ROOT/e["path"].strip("/")/"index.html";s=p.read_text(encoding="utf8")
 assert '<link rel="canonical" href="'+e["url"]+'">' in s
 assert '<article class="articulo">' in s and 'data-ev-pdf' in s and 'data-ev-reader="'+str(r["id"])+'"' in s
 assert 'id="resumen-breve"' not in s and 'RT-INTENT-START' not in s and 'RT-HERO-START' not in s
 assert not re.search(r'<img[^>]+images/trials/',s)
 assert '/resumen.html?id='+str(r["id"])+'&amp;v=corto' in s
 assert '/metodologia/' in s and '/equipo-editorial/' in s and '/correcciones/' in s
 images=e.get("images",[])
 assert len(images)==3 and all(u in s and (ROOT/u.replace("https://resumenestrials.com/","")).is_file() for u in images)
 for c in e.get("clusters",[]):assert c["path"] in s
for slug,c in clusters.items():
 p=ROOT/c["path"].strip("/")/"index.html";s=p.read_text(encoding="utf8")
 assert c["count"]>=2 and 'data-ev-ids=' in s
 assert 'RT-CLUSTER-SYNTHESIS-START' not in s
assert '24' not in clusters.get('sepsis-shock',{}).get('trial_ids',[])
assert '18' not in clusters.get('neurologia',{}).get('trial_ids',[])
for name in ["metodologia","correcciones","equipo-editorial"]:
 s=(ROOT/name/"index.html").read_text(encoding="utf8");assert 'rel="canonical"' in s and 'sameAs' in s
assert '/agregar-editorial-dates.js?v=1' in (ROOT/"agregar.html").read_text(encoding="utf8")
print(f"DESIGN CONTRACT PASS {len(data)} trials / {len(clusters)} active collections / evidence map / {version}")

