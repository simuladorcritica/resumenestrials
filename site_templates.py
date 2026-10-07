"""Single presentation template source. Editorial data and SEO are read-only inputs."""
from pathlib import Path
import json, re, html
ROOT=Path(__file__).resolve().parent
BASE="https://resumenestrials.com"
FONT_URL="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;650;700&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap"
EXCLUDED=frozenset({"/login.html","/registro.html","/recuperar.html","/cuenta.html","/biblioteca.html","/privacidad.html","/privacidad/","/privacidad/index.html","/terminos/","/terminos/index.html","/agregar.html","/medicina-interna/hematologia-oncologia/","/medicina-interna/hematologia-oncologia/index.html","/404.html"})
ADSENSE_CLIENT="ca-pub-3132744538918477"
ADSENSE_URL=f"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}"
ADSENSE_SCRIPT=f'<script async src="{ADSENSE_URL}" crossorigin="anonymous"></script>'
def esc(x):return html.escape(str(x or ""),quote=True)
def plain(x):return re.sub(r"<[^>]*>","",str(x or ""))
def trial_id(value):return str(int(value)) if isinstance(value,(int,float)) and float(value).is_integer() else str(value)
def human_date(value):
 value=str(value or "")
 m=re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})",value)
 months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
 return f"{int(m[3])} de {months[int(m[2])-1]} de {m[1]}" if m and 1<=int(m[2])<=12 else value

def editorial_dates(r):
 values=[("fecha_publicacion_resumen","Publicado en Resúmenes Trials"),("fecha_revision","Última revisión")]
 parts=[]
 for key,label in values:
  value=r.get(key) or (r.get("actualizado") if key=="fecha_revision" else "")
  if value:parts.append(f'<span>{label}: <time datetime="{esc(value)}">{esc(human_date(value))}</time></span>')
 return '<div class="ev-editorial-dates">'+" · ".join(parts)+'</div>' if parts else ""

def version():
 p=ROOT/"ui/runtime-version.json"
 return json.loads(p.read_text(encoding="utf-8"))["version"] if p.exists() else "design-v1"
def icon(name):
 paths={"search":'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',"theme":'<path d="M20 15a8 8 0 0 1-11-11 8 8 0 1 0 11 11Z"/>',"menu":'<path d="M4 6h16M4 12h16M4 18h16"/>',"close":'<path d="m6 6 12 12M18 6 6 18"/>',"home":'<path d="m3 11 9-8 9 8M5 9v12h14V9M10 21v-7h4v7"/>',"grid":'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',"book":'<path d="M4 3h13a3 3 0 0 1 3 3v15H6a2 2 0 0 1-2-2V3Zm0 14h16"/>',"pdf":'<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>'}
 return '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>'
def header():
 links=[("/","Explorar"),("/medicina-critica/","Medicina Crítica"),("/medicina-interna/","Medicina Interna"),("/biblioteca.html","Mi biblioteca"),("/cuenta.html","Cuenta")]
 return '<a class="ev-skip ev-button" href="#ev-main">Saltar al contenido</a><header class="ev-header"><div class="ev-header-inner"><a class="ev-brand" href="/"><img src="/logo.png" width="44" height="44" alt="Resúmenes Trials"><span>Resúmenes<br>Trials</span></a><nav id="ev-navigation" class="ev-header-nav" aria-label="Navegación principal">'+''.join(f'<a href="{url}">{label}</a>' for url,label in links)+'</nav><div class="ev-utilities"><button class="ev-icon" type="button" data-ev-search aria-label="Buscar ensayos">'+icon("search")+'</button><button class="ev-icon" type="button" data-ev-theme aria-label="Cambiar tema">'+icon("theme")+'</button><button class="ev-icon ev-menu-toggle" type="button" data-ev-menu aria-controls="ev-navigation" aria-expanded="false" aria-label="Abrir navegación">'+icon("menu")+'</button></div></div></header>'
def footer(home=False):
 links=[("/metodologia/","Metodología"),("/equipo-editorial/","Equipo editorial"),("/privacidad/","Privacidad"),("/terminos/","Términos"),("/registro.html","Crear cuenta"),("https://t.me/ResumenesTrials","Telegram"),("https://x.com/resumenestrials","X")]
 return '<footer class="ev-footer"><div class="ev-eyebrow">Resúmenes Trials · Evidencia sin ruido</div><nav aria-label="Información y comunidad">'+''.join(f'<a href="{url}">{label}</a>' for url,label in links)+'</nav>'+((ROOT/'templates/home-disclosure.html').read_text(encoding='utf-8') if home else '<p>Google Search Console se utiliza en modo de solo lectura para revisar la visibilidad del sitio. <a href="/privacidad/">Consulta la política de privacidad</a>.</p>')+'<p>Para médicos y profesionales de la salud. No sustituye el artículo original ni el juicio clínico.</p></footer><nav class="ev-mobile-nav" aria-label="Navegación móvil"><a href="/">'+icon("home")+'Inicio</a><button type="button" data-ev-search>'+icon("search")+'Buscar</button><button type="button" data-ev-specialties>'+icon("grid")+'Especialidades</button><a href="/biblioteca.html">'+icon("book")+'Biblioteca</a></nav>'
def dialogs():
 clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf-8")) if (ROOT/"seo-cluster-manifest.json").exists() else {}
 groups='<a href="/medicina-critica/">Medicina Crítica</a><a href="/medicina-interna/">Medicina Interna</a>'+''.join(f'<a href="{esc(c["path"])}">{esc(c["name"])}</a>' for c in clusters.values())
 def dialog(id,title,content):return f'<dialog id="{id}" class="ev-dialog" aria-labelledby="{id}-title"><div class="ev-dialog-head"><h2 id="{id}-title">{title}</h2><button class="ev-icon" type="button" data-ev-close aria-label="Cerrar">'+icon("close")+'</button></div><div class="ev-dialog-body">'+content+'</div></dialog>'
 return dialog("ev-search","Buscar evidencia",'<label class="ev-sr" for="ev-search-input">Buscar por título, autor, revista, año, DOI o tema</label><input id="ev-search-input" type="search" placeholder="Ensayo, autor, DOI o especialidad…" autocomplete="off" aria-controls="ev-search-results"><p class="ev-meta">/ · Ctrl/Cmd+K · ↑↓ · Enter · Esc</p><p id="ev-search-status" class="ev-meta" role="status"></p><ul id="ev-search-results" class="ev-results"></ul>')+dialog("ev-specialties","Explorar especialidades",'<div class="ev-dialog-list">'+groups+'</div>')
def clean_head(source,title=None):
 h=re.search(r"<head[^>]*>([\s\S]*?)</head>",source,re.I)
 head=h[1] if h else '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
 head=re.sub(r"<style\b[^>]*>[\s\S]*?</style>","",head,flags=re.I)
 head=re.sub(r'<link\b[^>]*(?:rel=["\'](?:stylesheet|preconnect)["\']|fonts\.google)[^>]*>',"",head,flags=re.I)
 head=re.sub(r"<script\b([^>]*)>[\s\S]*?</script>",lambda m:m[0] if "application/ld+json" in m[1] else "",head,flags=re.I)
 head=re.sub(r'<meta\b[^>]*name=["\']theme-color["\'][^>]*>',"",head,flags=re.I)
 if not re.search(r'<meta\b[^>]*charset=',head,re.I):head='<meta charset="UTF-8">'+head
 if not re.search(r'<meta\b[^>]*name=["\']viewport["\']',head,re.I):head+='<meta name="viewport" content="width=device-width,initial-scale=1">'
 if not re.search(r'<title>',head,re.I):head+=f'<title>{esc(title or "Resúmenes Trials")}</title>'
 head+='<script>window.evNavigatingAway=false;for(const e of ["beforeunload","pagehide"])addEventListener(e,()=>window.evNavigatingAway=true);addEventListener("pageshow",e=>{if(e.persisted)window.evNavigatingAway=false});try{const t=localStorage.getItem("rt-tema");document.documentElement.dataset.evTheme=t==="claro"||t==="oscuro"?t:matchMedia("(prefers-color-scheme:light)").matches?"claro":"oscuro"}catch{}</script>'
 head+=f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="{FONT_URL}"><link rel="stylesheet" href="/site-runtime.css?v={version()}">'
 return head
def document(source,body,route,kind="document",scripts="",title=None):
 head=clean_head(source,title)
 if route=="/":scripts+='<script type="module" src="/recommendations.js?v=20261003-laboratorio-v1"></script>'
 if route not in EXCLUDED and route!="/resumen.html" and not route.startswith("/resumen/"):head+=ADSENSE_SCRIPT
 return '<!DOCTYPE html><html lang="es-MX"><head>'+head+'</head><body class="'+("ev-reader" if kind=="reader" else "ev-"+kind)+'">'+header()+'<main id="ev-main" class="ev-main">'+body+'</main>'+footer(route=="/")+dialogs()+scripts+f'<script src="/site-runtime.js?v={version()}" defer></script></body></html>\n'
def facts(r):
 fields=[("revista","Revista"),("anio","Año"),("fecha","Fecha"),("tipo_estudio","Tipo de estudio"),("especialidad_principal","Especialidad"),("especialidad_secundaria","Especialidad secundaria"),("temas","Temas"),("registro","Registro"),("doi","DOI"),("financiacion","Financiación")]
 return '<dl class="ev-study-facts">'+''.join(f'<div><dt>{label}</dt><dd data-ev-field="{key}">{esc(" · ".join(map(str,r[key])) if isinstance(r.get(key),list) else r.get(key))}</dd></div>' for key,label in fields if r.get(key) not in ("",None,[]))+'</dl>'
def card(r,manifest):
 path=manifest[trial_id(r["id"])]["path"]
 return f'<li class="ev-card" data-id="{trial_id(r["id"])}"><div><a href="{esc(path)}" data-ev-read="{trial_id(r["id"])}"><h2>{esc(r["titulo"])}</h2></a></div><div class="ev-meta"><span>{esc(r["revista"])} · {esc(r["fecha"])}</span><br><span>{esc(r["especialidad_principal"])}</span><br><span>{esc(" · ".join(r.get("temas") or []))}</span><details><summary>Ficha del estudio</summary>{facts(r)}</details></div><div class="ev-card-foot"><a href="{esc(path)}" data-ev-read="{trial_id(r["id"])}">Leer ensayo →</a><button class="ev-icon" type="button" data-ev-card-pdf="{trial_id(r["id"])}" aria-label="Descargar resumen completo PDF de {esc(r["titulo"])}">{icon("pdf")}</button></div></li>'
def archive(items,manifest,title="Archivo de evidencia",scope=""):
 hero='<section class="ev-hero"><div><p class="ev-eyebrow">Laboratorio de evidencia / Archivo clínico</p><h1>'+("Evidencia clínica.<br>Lectura de precisión." if not scope else esc(title))+'</h1><p class="ev-lead">Ensayos clínicos y lectura crítica para encontrar, interpretar y conservar la evidencia que necesitas.</p></div><aside class="ev-instrument"><div><strong>'+str(len(items))+'</strong><span>RESÚMENES DISPONIBLES</span></div><div class="ev-signal"></div><p class="ev-meta">Medicina Crítica<br>Medicina Interna</p></aside></section>'
 fields=[("area","Especialidad"),("topic","Subtema"),("year","Año"),("journal","Revista"),("type","Tipo de estudio")]
 tools='<div class="ev-tools"><div class="ev-field"><label for="ev-q">Buscar en el archivo</label><input id="ev-q" type="search" placeholder="Ensayo, autor, DOI…" autocomplete="off"></div>'+''.join(f'<div class="ev-field"><label for="ev-{key}">{label}</label><select id="ev-{key}" data-ev-filter="{key}"><option value="">Todos</option></select></div>' for key,label in fields)+'</div>'
 quick_year=max((int(r["anio"]) for r in items if "Medicina Crítica" in [r.get("especialidad_principal"),r.get("especialidad_secundaria")] and str(r.get("anio","")).isdigit()),default=0)
 quick=f'<div class="ev-options"><span class="ev-eyebrow">Acceso rápido</span><button class="ev-chip" type="button" data-ev-preset="{quick_year}">Medicina Crítica · {quick_year}</button></div>' if quick_year else ""
 return hero+f'<section class="ev-archive" data-ev-ids="{",".join(trial_id(r["id"]) for r in items)}"><div class="ev-archive-head"><h2>{esc(title)}</h2><span id="ev-count" class="ev-count" role="status">{len(items)} resúmenes</span></div>'+quick+tools+'<div class="ev-options"><div class="ev-chips" id="ev-chips" role="group" aria-label="Filtros activos"></div><div><label for="ev-sort">Orden </label><select id="ev-sort"><option value="date">Fecha</option><option value="title">Título</option><option value="journal">Revista</option></select> <button type="button" id="ev-view" aria-pressed="false">Lista densa</button></div></div><ul class="ev-list" id="ev-list">'+''.join(card(r,manifest) for r in items)+'</ul><p id="ev-empty" class="ev-notice" hidden>No encontramos coincidencias. Prueba «sepsis», un acrónimo o restablece los filtros.</p><button id="ev-more" type="button" class="ev-more" hidden>Mostrar más</button></section>'
def reading(r,manifest,brief=False,legacy=False):
 id=trial_id(r["id"]);body=r["corto" if brief else "cuerpo"];body=re.sub(r"<(?=\d)","&lt;",body)
 route=manifest[id]["path"];full=f"/resumen.html?id={id}" if legacy else route;short=f"/resumen.html?id={id}&amp;v=corto"
 toolbar=f'<div class="ev-toolbar" role="region" aria-label="Controles de lectura"><div class="ev-version"><a href="{full}"'+(' aria-current="page"' if not brief else '')+f'>Completo</a><a href="{short}"'+(' aria-current="page"' if brief else '')+'>Breve</a></div><button type="button" data-ev-sections>Secciones</button><button type="button" data-ev-pdf>'+icon("pdf")+'PDF</button><button type="button" data-ev-format aria-label="Elegir formato de PDF">Formato</button><button type="button" data-ev-save>Guardar</button><button type="button" data-ev-focus aria-pressed="false">Modo lectura</button><button type="button" data-ev-font aria-label="Cambiar tamaño de letra">A+</button></div>'
 article='<article class="ev-body">'+body+'</article>' if brief or legacy else '<article class="articulo">'+body+'</article>'
 return f'<section data-ev-reader="{id}" data-ev-brief="{str(brief).lower()}"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/" data-ev-return>← Volver a la lista</a><a href="/metodologia/">Metodología</a></nav><header class="ev-reading-head"><span class="ev-eyebrow">{esc(r["tipo_estudio"])} / {esc(r["anio"])}</span><h1 data-ev-field="titulo">{esc(r["titulo"])}</h1><p class="ev-meta"><span data-ev-field="autor">{esc(r["autor"])}</span> · <span data-ev-field="revista">{esc(r["revista"])}</span> · <span data-ev-field="fecha">{esc(human_date(r["fecha"]))}</span></p><p data-ev-field="hallazgo" class="ev-lead">{r["hallazgo"]}</p>{editorial_dates(r)}</header>'+facts(r)+toolbar+'<progress class="ev-progress" max="100" value="0" aria-label="Progreso de lectura"></progress><div class="ev-reader-grid">'+article+'<aside class="ev-rail"><p class="ev-eyebrow">En esta página</p><nav data-ev-toc aria-label="Secciones del artículo"></nav></aside></div><div class="ev-endmatter"><p class="ev-original">Artículo original: '+(f'<a href="{esc(r["original"])}" target="_blank" rel="noopener noreferrer">{esc(r["original"])}</a>' if str(r["original"]).startswith("https://") else esc(r["original"]))+'</p><nav class="ev-neighbors" aria-label="Continuidad de lectura" data-ev-neighbors></nav><section class="ev-related"><h2>Evidencia relacionada</h2><ul class="ev-list" data-ev-related></ul></section><p class="ev-meta" id="ev-reader-status" role="status"></p></div></section>'
def write(path,text):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding="utf-8")
def render_all():
 items=json.loads((ROOT/"resumenes.json").read_text(encoding="utf-8"));manifest=json.loads((ROOT/"seo-manifest.json").read_text(encoding="utf-8"));clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf-8"))
 for r in items:
  path=ROOT/manifest[trial_id(r["id"])]["path"].lstrip("/")/"index.html";source=path.read_text(encoding="utf-8")
  write(path,document(source,reading(r,manifest),manifest[trial_id(r["id"])]["path"],"reader"))
 home=ROOT/"_includes/index-source.html";write(home,document(home.read_text(encoding="utf-8"),archive(items,manifest),"/","archive"))
 for area,slug in [("Medicina Crítica","medicina-critica"),("Medicina Interna","medicina-interna")]:
  import generar_seo as base
  subset=[r for r in items if area in base.categorias(r)];path=ROOT/slug/"index.html";write(path,document(path.read_text(encoding="utf-8"),archive(subset,manifest,area,slug),"/"+slug+"/","archive"))
 for c in clusters.values():
  subset=[r for r in items if trial_id(r["id"]) in set(map(str,c["trial_ids"]))];path=ROOT/c["path"].lstrip("/")/"index.html";write(path,document(path.read_text(encoding="utf-8"),archive(subset,manifest,c["name"],c["path"]),c["path"],"archive"))
 for name in ["metodologia","equipo-editorial","privacidad","terminos"]:
  path=ROOT/name/"index.html";source=path.read_text(encoding="utf-8");content_source=(ROOT/"templates/documents"/(name+".html")).read_text(encoding="utf-8");h1=re.search(r"<h1[^>]*>(.*?)</h1>",content_source,re.S)[1];article=re.search(r'<article\b[^>]*>([\s\S]*?)</article>',content_source)
  content=article[1] if article else re.search(r"<main[^>]*>([\s\S]*?)</main>",content_source)[1]
  content=re.sub(r'<(?:header|nav)\b[^>]*>[\s\S]*?</(?:header|nav)>',"",content)
  content=re.sub(r'\sclass=["\'][^"\']*["\']',"",content)
  date=re.search(r"<p[^>]*>(Última actualización:[^<]+)</p>",content_source)
  date_html='<p class="ev-meta">'+date[1]+'</p>' if date else ""
  write(path,document(source,'<p class="ev-eyebrow">Transparencia editorial</p><h1>'+h1+'</h1>'+date_html+'<article class="ev-prose">'+content+'</article>',"/"+name+"/"))
 # Existing inactive subtopic route stays available with its own empty archive.
 path=ROOT/"medicina-interna/hematologia-oncologia/index.html"
 if path.exists():
  source=path.read_text(encoding="utf-8");write(path,document(source,archive([],manifest,"Hematología y oncología","hematologia-oncologia"),"/medicina-interna/hematologia-oncologia/","archive"))
 for name in ["agregar","privacidad"]:
  source=(ROOT/"templates"/(name+".html")).read_text(encoding="utf-8");body=re.search(r"<body>([\s\S]*?)</body>",source)[1]
  if name=="agregar":
   # The section container owns its rows; collection must not depend on legacy CSS names.
   body=body.replace('seccionesEl.querySelectorAll(".sec-row")', "seccionesEl.children")
   body='<p class="ev-eyebrow">Herramienta interna</p><h1>Panel editorial</h1>'+body
  write(ROOT/(name+".html"),document(source,body,"/"+name+".html","internal" if name=="agregar" else "document"))
 templates=ROOT/"templates/account"
 for name in ["login","registro","recuperar","cuenta","biblioteca"]:
  source=(templates/(name+".html")).read_text(encoding="utf-8")
  body=re.search(r"<body>([\s\S]*?)</body>",source)[1]
  # Navigation cancels the pending vendor script; retain errors while the page is active.
  body=body.replace('pattern="[A-Za-z0-9._-]+"', 'pattern="[A-Za-z0-9._\\-]+"')
  body=re.sub(r"(try\{captcha=await mountTurnstile\([^)]*\)\}catch\(err\)\{)([^}]*)(\})",
              r"\1if(!window.evNavigatingAway){\2}\3",body)
  write(ROOT/(name+".html"),document(source,body,"/"+name+".html","member"))
 source=(ROOT/"templates/reader-head.html").read_text(encoding="utf-8")
 fallback='<noscript><section class="ev-notice"><h1>Leer un ensayo</h1><p>Selecciona el ensayo para abrir su página con contenido disponible sin JavaScript.</p><ul>'+''.join(f'<li><a href="{esc(manifest[trial_id(r["id"])]["path"])}">{esc(r["titulo"])}</a></li>' for r in items)+'</ul></section></noscript>'
 write(ROOT/"resumen.html",document(source,'<div id="ev-dynamic-reader" aria-live="polite"><p class="ev-notice">Cargando ensayo…</p></div>'+fallback,"/resumen.html","reader"))
 write(ROOT/"404.html",document('<head><title>Página no encontrada | Resúmenes Trials</title><meta name="robots" content="noindex,follow"></head>','<p class="ev-eyebrow">Error 404</p><h1>Página no encontrada</h1><p class="ev-lead">Puedes encontrar el ensayo en el archivo o explorar las áreas clínicas.</p><a class="ev-button ev-primary" href="/">Volver al archivo</a>',"/404.html"))
 # Static index also runs without a local Jekyll process; SEO is identical to the include.
 write(ROOT/"index.html",home.read_text(encoding="utf-8"))
 print(f"DESIGN TEMPLATES PASS: {len(items)} trials, {len(clusters)} subtemas, archivo, cuenta, lector y documentos")

