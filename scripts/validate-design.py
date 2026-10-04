from pathlib import Path
import json,re
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import aplicar_experiencia_futura as future
ROOT=Path(__file__).resolve().parents[1]
version=json.loads((ROOT/"ui/runtime-version.json").read_text(encoding="utf8"))["version"]
data=json.loads((ROOT/"resumenes.json").read_text(encoding="utf8"));manifest=json.loads((ROOT/"seo-manifest.json").read_text(encoding="utf8"));clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf8"))
home=(ROOT/"_includes/index-source.html").read_text(encoding="utf8")
assert home.count('class="ev-card" data-id=')==len(data),"Prerender must include every record"
assert (ROOT/"index.html").read_text(encoding="utf8")==home
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
 assert '/metodologia/' in s and '/equipo-editorial/' in s
 images=e.get("images",[])
 assert len(images)==3 and all(u in s and (ROOT/u.replace("https://resumenestrials.com/","")).is_file() for u in images)
 for c in e.get("clusters",[]):assert c["path"] in s
for slug,c in clusters.items():
 p=ROOT/c["path"].strip("/")/"index.html";s=p.read_text(encoding="utf8")
 assert c["count"]>=2 and 'data-ev-ids=' in s
 assert 'RT-CLUSTER-SYNTHESIS-START' not in s
assert '24' not in clusters.get('sepsis-shock',{}).get('trial_ids',[])
assert '18' not in clusters.get('neurologia',{}).get('trial_ids',[])
for name in ["metodologia","equipo-editorial"]:
 s=(ROOT/name/"index.html").read_text(encoding="utf8");assert 'rel="canonical"' in s and 'sameAs' in s
assert '/agregar-editorial-dates.js?v=1' in (ROOT/"agregar.html").read_text(encoding="utf8")
print(f"DESIGN CONTRACT PASS {len(data)} trials / {len(clusters)} active collections / {version}")

