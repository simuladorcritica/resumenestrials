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
# Desde el 16-nov-2026 (decisión del editor) la portada lleva, debajo del bloque de la edición (ensayo destacado y «En esta
# edición»), las tarjetas de todos los resúmenes en orden de publicación en el sitio (lo último publicado primero; empate:
# id más alto), todas en el HTML y solo las 12 primeras a la vista. Las ediciones anteriores no llevan tarjetas. El
# buscador con filtros sigue solo en /archivo/.
assert 'data-ev-ids=' not in home and 'id="ev-list"' not in home and 'id="ev-filters"' not in home and 'id="ev-count"' not in home,"The cover must not carry the archive controls"
by_publication=sorted(data,key=lambda r:(str(r["fecha_publicacion_resumen"]),int(r["id"])),reverse=True)
assert home.count('<h1>Evidencia sin ruido</h1>')==1 and home.count("<h1")==1 and 'data-ev-recs' in home
pages=[(monday,rows,ROOT/"ediciones"/monday/"index.html") for monday,rows in weeks[:-1]]+[(weeks[-1][0],weeks[-1][1],ROOT/"_includes/index-source.html")]
for monday,rows,path in pages:
 s=path.read_text(encoding="utf8")
 assert s.count('data-ev-edition="'+monday+'"')==1,f"{path}: edition"
 assert s.count('class="ev-signal"')==1 and s.count("<h1")==1,f"{path}: one signal line and one h1"
 for r in rows:assert 'href="'+manifest[str(r["id"])]["path"]+'"' in s,f"{path}: missing trial {r['id']}"
 assert s.count('class="ev-ed-grid"')==1 and s.count('<article class="ev-ed-lead">')==1 and s.count('class="ev-ed-toc"')==1,f"{path}: the edition block keeps its featured trial and its weekly list"
 if path.parent.parent.name=="ediciones":assert '<link rel="canonical" href="https://resumenestrials.com'+edition_route(monday)+'">' in s
 if path.name!="index-source.html":
  assert "data-ev-feed" not in s,f"{path}: a past edition has no cover cards"
  continue
 feed=re.search(r'<ul class="ev-list" data-ev-feed>(.*?)</ul>',s,re.S);assert feed and s.count("data-ev-feed>")==1,f"{path}: one card list"
 assert '</aside></div><div class="ev-feed"><div class="ev-archive-head"><h2>Biblioteca de ensayos</h2></div><ul class="ev-list" data-ev-feed>' in s,f"{path}: the cards sit right below the edition block"
 expected=by_publication
 cards=re.findall(r'<li class="ev-card" data-id="(\d+)" data-tone="[a-z]+"(?: data-ev-topics="[^"]*")?( hidden)?>',feed[1])
 assert feed[1].count('<li class="ev-card"')==len(cards) and [c[0] for c in cards]==[str(r["id"]) for r in expected],f"{path}: every card, newest publication first"
 assert [bool(c[1]) for c in cards]==[i>=12 for i in range(len(expected))],f"{path}: only the first 12 cards are visible"
 assert s.count("data-ev-feed-more")==(1 if len(expected)>12 else 0)==s.count('</ul><a class="ev-btn ev-more" href="/archivo/" data-ev-feed-more>Ver más</a>'),f"{path}: «Ver más» only when there are more than 12 cards, right after the list"
 for r in expected:assert feed[1].count('<a class="ev-card-title" href="'+manifest[str(r["id"])]["path"]+'" data-ev-read="'+str(r["id"])+'">')==1,f"{path}: card of trial {r['id']}"
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
# Preguntas clínicas (preguntas-clinicas.json): cada página lleva su pregunta, la advertencia de que no es una guía,
# una ficha por ensayo del núcleo (en orden cronológico) con sus campos publicados sin reescribir, y las diferencias
# de diseño compuestas SOLO con frases que pasan las guardas: citas literales del resumen de ese ensayo y cifras
# presentes en ellas. Una frase que ya no las pasa no puede aparecer. Los ensayos del núcleo se enlazan entre sí y
# con su pregunta, los relacionados enlazan la pregunta y el hub la lista.
import site_templates as questions_source
questions_path=ROOT/"preguntas-clinicas.json"
questions=questions_source.parse_questions(json.loads(questions_path.read_text(encoding="utf8"))) if questions_path.exists() else []
records={str(r["id"]):r for r in data};hubs={"Medicina Crítica":"medicina-critica","Medicina Interna":"medicina-interna"}
trial_page=lambda i:(ROOT/manifest[str(i)]["path"].strip("/")/"index.html").read_text(encoding="utf8")
flat=lambda value:re.sub(r"\s+"," ",html_module.unescape(re.sub(r"<[^>]*>"," ",str(value or ""))).replace("\u00a0"," ")).strip()
number=re.compile(r"(?<![\w.,])\d+(?:[.,]\d+)?(?!\w)")
question_ids=set()
for q in questions:
 route="/preguntas/"+q["slug"]+"/";s=(ROOT/route.strip("/")/"index.html").read_text(encoding="utf8");core=[n["id"] for n in q["nucleo"]]
 assert f'<link rel="canonical" href="https://resumenestrials.com{route}">' in s and s.count("<h1")==1 and "<h1>"+html_module.escape(q["pregunta"],quote=True)+"</h1>" in s,route
 assert "Esta página reúne, en breve, ensayos resumidos en Resúmenes Trials relacionados con esta pregunta; no es una revisión de toda la evidencia ni una guía clínica. De cada ensayo da solo lo esencial para situarlo: el detalle está en su resumen." in s,route+": falta la advertencia"
 description=questions_source.question_description(q,records);labels=[questions_source.trial_label(records[str(n["id"])],n) for n in q["nucleo"]]
 assert '<meta name="description" content="'+html_module.escape(description,quote=True)+'">' in s and all(x in description for x in labels),route+": la descripción no nombra a todos los ensayos del núcleo"
 assert '"@type":"Article"' in s and '"@type":"BreadcrumbList"' in s and '"@type":"MedicalCondition"' in s and s.count('"@type":"ScholarlyArticle"')==len(core),route+": datos estructurados"
 assert f'<loc>https://resumenestrials.com{route}</loc><lastmod>{q["fecha_revision"]}</lastmod>' in (ROOT/"sitemap.xml").read_text(encoding="utf8"),route+": sitemap"
 order=sorted(core,key=lambda i:(str(records[str(i)].get("fecha") or ""),i));positions=[s.index(f'<h3><a href="{manifest[str(i)]["path"]}">') for i in order]
 assert positions==sorted(positions),route+": las fichas no van en orden cronológico"
 texts,dropped=questions_source.question_texts(q,records);axes={a["clave"]:a for a in q["ejes"]}
 for n in q["nucleo"]:
  i=n["id"];r=records[str(i)];path=manifest[str(i)]["path"];question_ids.add(str(i));fields=[flat(r.get(k)) for k in ("titulo","objetivo","hallazgo","corto","cuerpo","tipo_estudio")]
  assert "<h4>Qué preguntó</h4><p>"+html_module.escape(r["objetivo"],quote=True)+"</p>" in s and "<h4>Hallazgo principal</h4><p>"+r["hallazgo"]+"</p>" in s,f"{route}: ficha de {i}"
  label=questions_source.trial_label(r,n)
  for axis,entry in n["diseno"].items():
   # Lo que se publicaría de esta entrada; debe estar en la página si y solo si pasa las guardas.
   quotes=[re.sub(r"\s+"," ",c).strip() for c in ([entry["cita"]] if isinstance(entry.get("cita"),str) else entry.get("cita") or [])]
   would=(f"El resumen de {label} no informa {entry['sin_dato'].strip()}." if "sin_dato" in entry else " ".join("«"+re.sub(r"\(\s+","(",re.sub(r"\s+([.,;:)])",r"\1",c))+"»" for c in quotes) if axes[axis].get("tipo")=="literal" else entry["frase"].strip())
   inside=html_module.escape(would,quote=True) in s
   assert inside==((i,axis) in texts),f"{route}: lo de {i}·{axis} está publicado sin pasar las guardas, o falta"
   if inside:
    # Comprobación independiente de las guardas: la huella del resumen, o citas literales con las cifras de la frase dentro.
    if "sin_dato" in entry:assert entry.get("huella")==hashlib.sha256("\n".join(fields).encode("utf8")).hexdigest()[:16],f"{route}: el resumen de {i} cambió y sigue publicado «no informa» en {axis}"
    else:
     assert quotes and all(any(c in field for field in fields) for c in quotes),f"{route}: cita de {i}·{axis} ausente del resumen publicado"
     if "frase" in entry:
      known={m.replace(",",".") for c in quotes for m in number.findall(c)}
      assert would.startswith((label+" ",label+", ")) and all(m.replace(",",".") in known for m in number.findall(would[len(label):])),f"{route}: cifra de {i}·{axis} fuera de su cita"
  page=trial_page(i);assert page.count('data-ev-question="nucleo"')==1 and f'href="{route}"' in page and all(f'href="{manifest[str(j)]["path"]}"' in page for j in core if j!=i),f"{path}: enlazado del núcleo"
 for group in q.get("relacionados",[]):
  for i in group["ids"]:
   path=manifest[str(i)]["path"];question_ids.add(str(i));assert f'href="{path}"' in s,f"{route}: relacionado {i}"
   page=trial_page(i);assert 'data-ev-question="relacionado"' in page and f'href="{route}"' in page,f"{path}: enlace a la pregunta"
 assert f'href="{route}"' in (ROOT/hubs[q["area"]]/"index.html").read_text(encoding="utf8"),route+": el hub no la enlaza"
for r in data:
 if str(r["id"]) not in question_ids:assert 'data-ev-question=' not in trial_page(r["id"]),f'{r["id"]}: bloque de pregunta sin pregunta'
# Diseño de las preguntas: hoja propia (ui/preguntas.css) con la huella vigente, solo en estas páginas y en la portada; línea de
# tiempo con un punto por ensayo que lleva a su ficha; un panel por pestaña en «Cómo leerlos juntos»; y sección de la portada,
# entre la edición y el mapa, con una tarjeta por pregunta. La portada no muestra hallazgos: van en la página, junto a sus límites.
question_css='<link rel="stylesheet" href="/ui/preguntas.css?v='+hashlib.sha256((ROOT/"ui/preguntas.css").read_bytes().replace(b"\r\n",b"\n")).hexdigest()[:12]+'">'
question_home=re.search(r'<section class="ev-q ev-q-home"[\s\S]*?</section>',home)
assert bool(question_home)==bool(questions) and home.count(question_css)==(1 if questions else 0),"portada: sección de preguntas clínicas y su hoja"
if question_home:
 assert home.index("data-ev-feed-more" if len(data)>12 else "data-ev-feed>")<home.index("data-ev-recs")<home.index(question_home[0])<home.index('class="ev-band"'),"portada: tarjetas, después las preguntas clínicas y al final el mapa"
 # Tarjeta para las tres preguntas más recientes (las de un mismo día, en el orden del archivo); las demás, enlazadas en un desplegable.
 recent=sorted(questions,key=lambda q:q["fecha_publicacion"],reverse=True)
 assert re.findall(r'<a class="ev-q-title" href="/preguntas/([a-z0-9-]+)/">',question_home[0])==[q["slug"] for q in recent[:3]] and question_home[0].count('<article class="ev-q-card">')==min(3,len(questions)) and "Hallazgo" not in question_home[0],"portada: una tarjeta por cada una de las tres preguntas más recientes, sin hallazgos"
 more=re.search(r'<details class="ev-q-more"><summary class="ev-btn">[^<]+</summary><ul>(.*?)</ul></details>',question_home[0])
 assert bool(more)==(len(questions)>3) and (re.findall(r'<li><a href="/preguntas/([a-z0-9-]+)/">',more[1]) if more else [])==[q["slug"] for q in recent[3:]],"portada: las demás preguntas van enlazadas en el desplegable"
home_cards={q["slug"] for q in sorted(questions,key=lambda q:q["fecha_publicacion"],reverse=True)[:3]}
for q in questions:
 route="/preguntas/"+q["slug"]+"/";s=(ROOT/route.strip("/")/"index.html").read_text(encoding="utf8");card=q["slug"] in home_cards;title=html_module.escape(q["pregunta"],quote=True)
 assert s.count(question_css)==1 and "ev-eyebrow" not in s.split('<main',1)[1].split('</main>',1)[0],route+": hoja de preguntas, y sin rótulo sobre el título"
 assert question_home[0].count(f'<a class="ev-q-title" href="{route}">{title}</a>')==(1 if card else 0) and question_home[0].count(f'<li><a href="{route}">{title}</a></li>')==(0 if card else 1),route+": falta en la portada (tarjeta si es de las tres más recientes; si no, un enlace en el desplegable)"
 for n in q["nucleo"]:
  mark=f'ensayo-{n["id"]}'
  assert s.count(f'<section class="ev-q-card" id="{mark}">')==1 and s.count(f'<a class="ev-q-t" href="#{mark}">')==1,f"{route}: ficha y punto de {n['id']}"
  assert question_home[0].count(f'<a class="ev-q-t" href="{route}#{mark}">')==(1 if card else 0),f"portada: punto de {n['id']} (solo en las preguntas con tarjeta)"
 assert s.count('<input type="radio" name="ev-q-eje"')==s.count('<section class="ev-q-panel">')>=1 and s.count('name="ev-q-eje" checked')==1,route+": una pestaña por panel y una sola elegida"
for p in future.candidates():
 if p.exists() and p not in [ROOT/"_includes/index-source.html",ROOT/"index.html"]+[ROOT/"preguntas"/q["slug"]/"index.html" for q in questions]:assert "/ui/preguntas.css" not in p.read_text(encoding="utf8"),f"{p}: la hoja de preguntas solo va en sus páginas y en la portada"
generated=sorted(p.parent.name for p in (ROOT/"preguntas").glob("*/index.html")) if (ROOT/"preguntas").exists() else []
assert generated==sorted(q["slug"] for q in questions),"preguntas/: sobran o faltan páginas"
print(f"DESIGN CONTRACT PASS {len(data)} trials / {len(clusters)} active collections / evidence map / {version}")

