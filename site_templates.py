"""Single presentation template source. Editorial data and SEO are read-only inputs."""
from pathlib import Path
import json, re, html
ROOT=Path(__file__).resolve().parent
BASE="https://resumenestrials.com"
FONT_URL="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Sora:wght@400;500;600;700&display=swap"
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
 return json.loads(p.read_text(encoding="utf-8"))["version"] if p.exists() else "nova-v1"
ICONS={"search":'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',"sun":'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',"moon":'<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',"menu":'<path d="M4 7h16M4 12h16M4 17h10"/>',"close":'<path d="M6 6l12 12M18 6 6 18"/>',"home":'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-6h4v6"/>',"grid":'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',"bookmark":'<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',"pdf":'<path d="M12 3.5v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4.5 16.5v3h15v-3"/>',"list":'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',"read":'<path d="M3 5.5c3.5-1 6.5-.5 9 1.5 2.5-2 5.5-2.5 9-1.5v13c-3.5-1-6.5-.5-9 1.5-2.5-2-5.5-2.5-9-1.5z"/><path d="M12 7v13"/>',"more":'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',"share":'<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4"/>',"text":'<path d="M4 18 9 6l5 12M5.7 14h6.6"/><path d="M15 18l3-7 3 7M15.8 16h4.4"/>',"clock":'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',"arrow-left":'<path d="M19 12H5M11 6l-6 6 6 6"/>',"arrow-right":'<path d="M5 12h14M13 6l6 6-6 6"/>',"arrow-up":'<path d="M12 19V5M6 11l6-6 6 6"/>',"user":'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',"external":'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',"filter":'<path d="M4 6h16M7 12h10M10 18h4"/>',"spark":'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'}
def icon(name):return '<svg class="ev-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+ICONS[name]+'</svg>'
INTERNAL=("Cardiología","Cirugía","Endocrinología","Enfermedades Infecciosas","Gastroenterología","Geriatría","Hematología","Infectología","Medicina de Urgencias","Medicina Física y Rehabilitación","Nefrología","Neumología","Neurología","Oncología","Oftalmología","Reumatología","VIH")
def area_of(r):
 p=plain(r.get("especialidad_principal")).strip();s=plain(r.get("especialidad_secundaria")).strip()
 if p in ("Medicina Crítica","Medicina Interna"):return p
 if p in INTERNAL:return "Medicina Interna"
 if s in ("Medicina Crítica","Medicina Interna"):return s
 return p or "Evidencia clínica"
def tone(area):return {"Medicina Crítica":"critica","Medicina Interna":"interna"}.get(area,"neutral")
def minutes(value):return max(1,round(len(re.findall(r"\w+",plain(value)))/230))
def readtime(r):
 full=minutes(r.get("cuerpo"));brief=minutes(r.get("corto")) if r.get("corto") else 0
 return f'{icon("clock")}<span>Completo {full} min</span>'+(f'<span>Breve {brief} min</span>' if brief else '')
NAV=[("/","Inicio"),("/medicina-critica/","Medicina Crítica"),("/medicina-interna/","Medicina Interna"),("/biblioteca.html","Mi biblioteca")]
INFO=[("/metodologia/","Metodología"),("/equipo-editorial/","Equipo editorial"),("/privacidad/","Privacidad"),("/terminos/","Términos")]
SOCIAL=[("https://t.me/ResumenesTrials","Telegram"),("https://x.com/resumenestrials","X · @resumenestrials")]
def brand(small=False):return '<a class="ev-brand" href="/" aria-label="Resúmenes Trials, ir al inicio"><span class="ev-brand-mark"><img src="/logo.png" width="40" height="40" alt=""></span><span class="ev-brand-name" aria-hidden="true">Resúmenes<b>Trials</b></span></a>'
def header():
 search=('<form class="ev-search" role="search" action="/" method="get" data-ev-search-form>'
  '<label class="ev-sr" for="ev-q">Buscar resúmenes de ensayos clínicos</label>'+icon("search")+
  '<input id="ev-q" name="q" type="search" placeholder="Busca un ensayo, enfermedad o fármaco" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" aria-controls="ev-search-panel">'
  '<button type="button" class="ev-search-clear" data-ev-search-clear aria-label="Borrar búsqueda" hidden>'+icon("close")+'</button>'
  '<kbd class="ev-kbd" aria-hidden="true">/</kbd>'
  '<div id="ev-search-panel" class="ev-search-panel" hidden><p id="ev-search-status" class="ev-search-status" role="status"></p><ul id="ev-search-results" class="ev-results"></ul><a id="ev-search-all" class="ev-search-all" href="/">Ver todos los resultados en el archivo'+icon("arrow-right")+'</a></div>'
  '</form>')
 nav='<nav class="ev-header-nav" aria-label="Navegación principal">'+''.join(f'<a href="{u}">{l}</a>' for u,l in NAV)+'</nav>'
 utilities=('<div class="ev-utilities"><button class="ev-icon-btn" type="button" data-ev-theme aria-label="Cambiar tema">'+'<span class="ev-theme-sun">'+icon("sun")+'</span><span class="ev-theme-moon">'+icon("moon")+'</span></button>'
  '<a class="ev-account-link" href="/cuenta.html">'+icon("user")+'<span>Cuenta</span></a>'
  '<button class="ev-icon-btn ev-menu-toggle" type="button" data-ev-menu aria-controls="ev-menu" aria-expanded="false" aria-label="Abrir menú">'+icon("menu")+'</button></div>')
 return '<a class="ev-skip" href="#ev-main">Saltar al contenido</a><header class="ev-header"><div class="ev-header-inner">'+brand()+nav+search+utilities+'</div></header>'
def footer(home=False):
 col=lambda title,links:'<nav class="ev-footer-col" aria-label="'+title+'"><p class="ev-footer-title">'+title+'</p>'+''.join(f'<a href="{u}">{l}</a>' for u,l in links)+'</nav>'
 notice=(ROOT/'templates/home-disclosure.html').read_text(encoding='utf-8') if home else '<p>Google Search Console se utiliza en modo de solo lectura para revisar la visibilidad del sitio. <a href="/privacidad/">Consulta la política de privacidad</a>.</p>'
 return ('<footer class="ev-footer"><div class="ev-footer-inner"><div class="ev-footer-brand">'+brand()+'<p class="ev-footer-claim">Evidencia sin ruido.</p><p class="ev-footer-about">Resúmenes críticos en español de ensayos clínicos de Medicina Crítica y Medicina Interna.</p></div>'
  +col("Explorar",NAV+[("/cuenta.html","Cuenta")])+col("Transparencia",INFO)+col("Comunidad",SOCIAL+[("/registro.html","Crear cuenta")])+
  '</div><div class="ev-footer-legal">'+notice+'<p>Para médicos y profesionales de la salud. No sustituye el artículo original ni el juicio clínico.</p></div></footer>'
  '<nav class="ev-mobile-nav" aria-label="Navegación móvil"><a href="/">'+icon("home")+'<span>Inicio</span></a><button type="button" data-ev-specialties>'+icon("grid")+'<span>Especialidades</span></button><a href="/biblioteca.html">'+icon("bookmark")+'<span>Biblioteca</span></a><button type="button" data-ev-menu aria-controls="ev-menu" aria-expanded="false">'+icon("menu")+'<span>Menú</span></button></nav>'
  '<button class="ev-top" type="button" data-ev-top aria-label="Volver arriba" hidden>'+icon("arrow-up")+'</button>')
def dialogs():
 clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf-8")) if (ROOT/"seo-cluster-manifest.json").exists() else {}
 def dialog(id,title,content,kind="sheet"):return f'<dialog id="{id}" class="ev-dialog ev-{kind}" aria-labelledby="{id}-title"><div class="ev-dialog-head"><h2 id="{id}-title">{title}</h2><button class="ev-icon-btn" type="button" data-ev-close aria-label="Cerrar">'+icon("close")+'</button></div><div class="ev-dialog-body">'+content+'</div></dialog>'
 tiles='<div class="ev-tiles"><a class="ev-tile" data-tone="critica" href="/medicina-critica/"><b>Medicina Crítica</b><span>Sepsis, ventilación, choque, neurocríticos y más</span></a><a class="ev-tile" data-tone="interna" href="/medicina-interna/"><b>Medicina Interna</b><span>Cardiología, renal, infecciosas, neumología y más</span></a></div>'
 topics='<p class="ev-dialog-label">Subtemas</p><div class="ev-dialog-chips">'+''.join(f'<a class="ev-chip" href="{esc(c["path"])}">{esc(c["name"])}</a>' for c in clusters.values())+'</div>'
 menu='<nav class="ev-menu-list" aria-label="Menú">'+''.join(f'<a href="{u}">{l}</a>' for u,l in NAV+[("/cuenta.html","Cuenta")])+'</nav><p class="ev-dialog-label">Transparencia</p><nav class="ev-menu-list ev-menu-minor" aria-label="Transparencia">'+''.join(f'<a href="{u}">{l}</a>' for u,l in INFO)+'</nav><p class="ev-dialog-label">Síguenos</p><nav class="ev-menu-list ev-menu-minor" aria-label="Redes">'+''.join(f'<a href="{u}">{l}</a>' for u,l in SOCIAL)+'</nav>'
 return dialog("ev-specialties","Especialidades",tiles+topics)+dialog("ev-menu","Menú",menu,"drawer")
HEAD_SCRIPT=('<script>window.evNavigatingAway=false;for(const e of ["beforeunload","pagehide"])addEventListener(e,()=>window.evNavigatingAway=true);addEventListener("pageshow",e=>{if(e.persisted)window.evNavigatingAway=false});'
 '(()=>{const d=document.documentElement;try{const t=localStorage.getItem("rt-tema");d.dataset.evTheme=t==="claro"||t==="oscuro"?t:matchMedia("(prefers-color-scheme:light)").matches?"claro":"oscuro"}catch{}'
 'try{const w=innerWidth,c=matchMedia("(pointer:coarse)").matches;d.dataset.evDevice=w<720?"movil":w<1100?"tableta":"escritorio";d.dataset.evPointer=c?"tactil":"raton"}catch{}'
 'try{if(/^\\/(trials\\/|resumen(\\.html|\\/))/.test(location.pathname)&&localStorage.getItem("ev-focus")==="true")d.dataset.evReadingMode="on"}catch{}})()</script>')
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
 head+='<meta name="theme-color" content="#070b16" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f3f5fb" media="(prefers-color-scheme: light)">'+HEAD_SCRIPT
 head+=f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="{FONT_URL}"><link rel="stylesheet" href="/site-runtime.css?v={version()}">'
 return head
def document(source,body,route,kind="document",scripts="",title=None):
 head=clean_head(source,title)
 if route=="/":scripts+='<script type="module" src="/recommendations.js?v=20261010-nova-v1"></script>'
 if route not in EXCLUDED and route!="/resumen.html" and not route.startswith("/resumen/"):head+=ADSENSE_SCRIPT
 mode="list" if kind=="archive" or route=="/biblioteca.html" else "quick"
 return '<!DOCTYPE html><html lang="es-MX"><head>'+head+'</head><body class="'+("ev-reader" if kind=="reader" else "ev-"+kind)+'" data-ev-search-mode="'+mode+'"><div class="ev-aurora" aria-hidden="true"></div>'+header()+'<main id="ev-main" class="ev-main" tabindex="-1">'+body+'</main>'+footer(route=="/")+dialogs()+scripts+f'<script src="/site-runtime.js?v={version()}" defer></script></body></html>\n'
FACTS=[("revista","Revista"),("anio","Año"),("fecha","Fecha"),("tipo_estudio","Tipo de estudio"),("especialidad_principal","Especialidad"),("especialidad_secundaria","Especialidad secundaria"),("temas","Temas"),("registro","Registro"),("doi","DOI"),("financiacion","Financiación")]
def facts(r):
 return '<dl class="ev-study-facts">'+''.join(f'<div><dt>{label}</dt><dd data-ev-field="{key}">{esc(" · ".join(map(str,r[key])) if isinstance(r.get(key),list) else r.get(key))}</dd></div>' for key,label in FACTS if r.get(key) not in ("",None,[]))+'</dl>'
def card(r,manifest):
 id=trial_id(r["id"]);path=esc(manifest[id]["path"]);area=area_of(r);t=esc(r["titulo"]);topics=" · ".join(r.get("temas") or [])
 topics_attr=f' data-ev-topics="{esc(topics)}"' if topics else ''
 return (f'<li class="ev-card" data-id="{id}" data-tone="{tone(area)}"{topics_attr}><a class="ev-card-title" href="{path}" data-ev-read="{id}"><h2>{t}</h2></a>'
  f'<p class="ev-card-meta"><span>{esc(r["revista"])}</span><span>{esc(human_date(r["fecha"]))}</span></p>'
  f'<div class="ev-card-tags"><span class="ev-area" data-tone="{tone(area)}">{esc(area)}</span></div>'
  +'<details class="ev-card-facts"><summary>Ficha del estudio</summary>'+facts(r)+'</details>'+
  f'<div class="ev-card-foot"><p class="ev-readtime">{readtime(r)}</p><div class="ev-card-actions"><a class="ev-btn ev-btn-primary" href="{path}" data-ev-read="{id}" aria-label="Leer resumen: {t}">Leer</a>'
  f'<details class="ev-pdf-menu"><summary class="ev-btn" aria-label="Descargar PDF de {t}">{icon("pdf")}<span>PDF</span></summary><div class="ev-pdf-pop"><button type="button" data-ev-card-pdf="{id}" data-ev-version="completo" aria-label="Descargar resumen completo PDF de {t}">PDF completo</button><button type="button" data-ev-card-pdf="{id}" data-ev-version="breve" aria-label="Descargar resumen breve PDF de {t}">PDF breve</button></div></details></div></div></li>')
def archive(items,manifest,title="Archivo de evidencia",scope=""):
 import generar_seo as base
 from collections import Counter
 crit=sum(1 for r in items if "Medicina Crítica" in base.categorias(r));inter=sum(1 for r in items if "Medicina Interna" in base.categorias(r))
 if not scope:
  hero=('<section class="ev-hero"><div class="ev-hero-copy"><p class="ev-eyebrow"><span class="ev-pulse" aria-hidden="true"></span>Resúmenes críticos de ensayos clínicos · en español</p>'
   '<h1>Evidencia clínica, <span class="ev-grad-text">clara y al instante.</span></h1>'
   '<p class="ev-lead">Encuentra un ensayo, léelo completo o en versión breve y descárgalo en PDF. Escribe en el buscador una enfermedad, un fármaco o el nombre del estudio.</p></div>'
   f'<ul class="ev-stats" aria-label="Contenido del archivo"><li><strong>{len(items)}</strong><span>resúmenes</span></li><li data-tone="critica"><strong>{crit}</strong><span>Medicina Crítica</span></li><li data-tone="interna"><strong>{inter}</strong><span>Medicina Interna</span></li></ul>'
   '<ol class="ev-steps" aria-label="Cómo usar Resúmenes Trials"><li><b>1</b><span>Busca o elige una especialidad</span></li><li><b>2</b><span>Abre el resumen completo o breve</span></li><li><b>3</b><span>Descárgalo en PDF o guárdalo</span></li></ol></section>')
 else:
  kind="Especialidad" if scope in ("medicina-critica","medicina-interna") else "Subtema"
  hero=(f'<section class="ev-hero ev-hero-compact"><div class="ev-hero-copy"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/">{icon("arrow-left")}Inicio</a></nav><p class="ev-eyebrow"><span class="ev-pulse" aria-hidden="true"></span>{kind}</p><h1>{esc(title)}</h1>'
   f'<p class="ev-lead">{len(items)} resúmenes críticos de ensayos clínicos. Elige uno para leerlo completo o en versión breve y descargarlo en PDF.</p></div></section>')
 segment=''
 if not scope:
  segment=('<div class="ev-segment" role="radiogroup" aria-label="Especialidad">'
   +''.join(f'<label><input type="radio" name="ev-area" value="{v}"{" checked" if not v else ""}><span>{l}<small>{n}</small></span></label>' for v,l,n in [("","Todas",len(items)),("Medicina Crítica","Medicina Crítica",crit),("Medicina Interna","Medicina Interna",inter)])+'</div>')
 quick_year=max((int(r["anio"]) for r in items if "Medicina Crítica" in [r.get("especialidad_principal"),r.get("especialidad_secundaria")] and str(r.get("anio","")).isdigit()),default=0)
 top=[t for t,_ in Counter(t for r in items for t in (r.get("temas") or [])).most_common(5)]
 quick=('<div class="ev-quick"><span class="ev-quick-label">Atajos</span><div class="ev-quick-row">'+(f'<button class="ev-chip ev-chip-strong" type="button" data-ev-preset="{quick_year}">Medicina Crítica · {quick_year}</button>' if quick_year and not scope else '')
  +''.join(f'<button class="ev-chip" type="button" data-ev-topic="{esc(t)}">{esc(t)}</button>' for t in top)+'</div></div>') if (top or quick_year) else ''
 fields=[("sub","Subespecialidad"),("topic","Tema"),("year","Año"),("journal","Revista"),("type","Tipo de estudio")]
 filters=('<div id="ev-filters" class="ev-filters" hidden><div class="ev-filters-grid">'+''.join(f'<div class="ev-field"><label for="ev-{k}">{l}</label><select id="ev-{k}" data-ev-filter="{k}"><option value="">Todos</option></select></div>' for k,l in fields)
  +'<div class="ev-field"><label for="ev-sort">Ordenar por</label><select id="ev-sort"><option value="date">Más recientes</option><option value="title">Título (A–Z)</option><option value="journal">Revista</option></select></div></div></div>')
 heading="Biblioteca de ensayos" if not scope else "Resúmenes de "+esc(title)
 return (hero+f'<section class="ev-archive" id="ev-archivo" data-ev-ids="{",".join(trial_id(r["id"]) for r in items)}"><div class="ev-archive-head"><h2>{heading}</h2><p id="ev-count" class="ev-count" role="status">{len(items)} resúmenes</p></div>'
  +segment+quick+'<div class="ev-archive-bar"><button type="button" class="ev-btn ev-filter-toggle" data-ev-filters aria-expanded="false" aria-controls="ev-filters">'+icon("filter")+'<span>Filtros</span><b class="ev-badge" data-ev-filter-count hidden></b></button><div class="ev-chips" id="ev-chips" role="group" aria-label="Filtros activos"></div><button type="button" class="ev-btn ev-view-toggle" id="ev-view" aria-pressed="false" aria-label="Vista compacta">'+icon("list")+'<span>Vista compacta</span></button></div>'
  +filters+'<ul class="ev-list" id="ev-list">'+''.join(card(r,manifest) for r in items)+'</ul>'
  '<div id="ev-empty" class="ev-empty" hidden><p class="ev-empty-title">No encontramos coincidencias</p><p>Prueba con otra palabra, por ejemplo «sepsis», el nombre corto del estudio o el año.</p><button type="button" class="ev-btn ev-btn-primary" data-ev-reset>Ver todos los resúmenes</button></div>'
  '<button id="ev-more" type="button" class="ev-btn ev-more" hidden>Mostrar más</button></section>')
def reading(r,manifest,brief=False,legacy=False):
 id=trial_id(r["id"]);body=r["corto" if brief else "cuerpo"];body=re.sub(r"<(?=\d)","&lt;",body)
 route=manifest[id]["path"];full=f"/resumen.html?id={id}" if legacy else route;short=f"/resumen.html?id={id}&amp;v=corto";area=area_of(r)
 toolbar=(f'<div class="ev-toolbar" role="region" aria-label="Controles de lectura"><div class="ev-version" role="group" aria-label="Versión del resumen"><a href="{full}"'+(' aria-current="page"' if not brief else '')+f'>Completo</a><a href="{short}"'+(' aria-current="page"' if brief else '')+'>Breve</a></div>'
  '<button type="button" class="ev-tool" data-ev-sections>'+icon("list")+'<span>Índice</span></button>'
  '<button type="button" class="ev-tool" data-ev-pdf aria-haspopup="dialog">'+icon("pdf")+'<span>PDF</span></button>'
  '<button type="button" class="ev-tool" data-ev-focus aria-pressed="false">'+icon("read")+'<span>Modo lectura</span></button>'
  '<button type="button" class="ev-tool ev-more-toggle" data-ev-more aria-expanded="false" aria-controls="ev-more-tools">'+icon("more")+'<span>Más</span></button>'
  '<div class="ev-more-tools" id="ev-more-tools"><button type="button" class="ev-tool" data-ev-save>'+icon("bookmark")+'<span>Guardar</span></button><button type="button" class="ev-tool" data-ev-share>'+icon("share")+'<span>Compartir</span></button><button type="button" class="ev-tool" data-ev-font aria-label="Cambiar tamaño de letra">'+icon("text")+'<span>Letra</span></button></div></div>')
 article='<article class="ev-body">'+body+'</article>' if brief or legacy else '<article class="articulo">'+body+'</article>'
 original=(f'<a href="{esc(r["original"])}" target="_blank" rel="noopener noreferrer">{esc(r["original"])}{icon("external")}</a>' if str(r["original"]).startswith("https://") else esc(r["original"]))
 return (f'<section class="ev-reading" data-ev-reader="{id}" data-ev-brief="{str(brief).lower()}"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/" data-ev-return>{icon("arrow-left")}Volver a la lista</a><a href="/metodologia/">Metodología</a></nav>'
  f'<header class="ev-reading-head"><div class="ev-card-tags"><span class="ev-area" data-tone="{tone(area)}">{esc(area)}</span><span class="ev-type">{esc(r["tipo_estudio"])} · {esc(r["anio"])}</span></div><h1 data-ev-field="titulo">{esc(r["titulo"])}</h1>'
  f'<p class="ev-byline"><span data-ev-field="autor">{esc(r["autor"])}</span><span data-ev-field="revista">{esc(r["revista"])}</span><span data-ev-field="fecha">{esc(human_date(r["fecha"]))}</span></p>'
  f'<div class="ev-keyfinding"><p class="ev-keyfinding-label">{icon("spark")}Hallazgo principal</p><p data-ev-field="hallazgo" class="ev-lead">{r["hallazgo"]}</p></div>'
  f'<p class="ev-readtime">{readtime(r)}</p>{editorial_dates(r)}</header>'
  '<details class="ev-facts" open><summary>Ficha técnica del estudio</summary>'+facts(r)+'</details>'+toolbar+'<progress class="ev-progress" max="100" value="0" aria-label="Progreso de lectura"></progress>'
  '<div class="ev-reader-grid">'+article+'<aside class="ev-rail"><p class="ev-rail-title">En esta página</p><nav data-ev-toc aria-label="Secciones del artículo"></nav></aside></div>'
  f'<div class="ev-endmatter"><p class="ev-original"><span class="ev-original-label">Artículo original</span>{original}</p><nav class="ev-neighbors" aria-label="Continuidad de lectura" data-ev-neighbors></nav><section class="ev-related"><h2>Evidencia relacionada</h2><ul class="ev-list" data-ev-related></ul></section><p class="ev-status" id="ev-reader-status" role="status"></p></div></section>')
def doc_page(eyebrow,h1,date_html,content):return '<div class="ev-doc"><p class="ev-eyebrow"><span class="ev-pulse" aria-hidden="true"></span>'+eyebrow+'</p><h1>'+h1+'</h1>'+date_html+'<article class="ev-prose">'+content+'</article></div>'
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
  date_html='<p class="ev-doc-date">'+date[1]+'</p>' if date else ""
  write(path,document(source,doc_page('Transparencia editorial',h1,date_html,content),"/"+name+"/"))
 # Existing inactive subtopic route stays available with its own empty archive.
 path=ROOT/"medicina-interna/hematologia-oncologia/index.html"
 if path.exists():
  source=path.read_text(encoding="utf-8");write(path,document(source,archive([],manifest,"Hematología y oncología","hematologia-oncologia"),"/medicina-interna/hematologia-oncologia/","archive"))
 for name in ["agregar","privacidad"]:
  source=(ROOT/"templates"/(name+".html")).read_text(encoding="utf-8");body=re.search(r"<body>([\s\S]*?)</body>",source)[1]
  if name=="agregar":
   # The section container owns its rows; collection must not depend on legacy CSS names.
   body=body.replace('seccionesEl.querySelectorAll(".sec-row")', "seccionesEl.children")
   body='<div class="ev-doc ev-doc-wide"><p class="ev-eyebrow"><span class="ev-pulse" aria-hidden="true"></span>Herramienta interna</p><h1>Panel editorial</h1>'+body+'</div>'
  write(ROOT/(name+".html"),document(source,body,"/"+name+".html","internal" if name=="agregar" else "document"))
 templates=ROOT/"templates/account"
 for name in ["login","registro","recuperar","cuenta","biblioteca"]:
  source=(templates/(name+".html")).read_text(encoding="utf-8")
  body=re.search(r"<body>([\s\S]*?)</body>",source)[1]
  # Navigation cancels the pending vendor script; retain errors while the page is active.
  body=body.replace('pattern="[A-Za-z0-9._-]+"', 'pattern="[A-Za-z0-9._\\-]+"')
  body=re.sub(r"(try\{captcha=await mountTurnstile\([^)]*\)\}catch\(err\)\{)([^}]*)(\})",
              r"\1setTimeout(()=>{if(!window.evNavigatingAway){\2}},50);\3",body)
  write(ROOT/(name+".html"),document(source,body,"/"+name+".html","member"))
 source=(ROOT/"templates/reader-head.html").read_text(encoding="utf-8")
 fallback='<noscript><section class="ev-notice ev-doc"><h1>Leer un ensayo</h1><p>Selecciona el ensayo para abrir su página con contenido disponible sin JavaScript.</p><ul>'+''.join(f'<li><a href="{esc(manifest[trial_id(r["id"])]["path"])}">{esc(r["titulo"])}</a></li>' for r in items)+'</ul></section></noscript>'
 write(ROOT/"resumen.html",document(source,'<div id="ev-dynamic-reader" aria-live="polite"><div class="ev-loading"><span class="ev-loading-bar"></span><p>Cargando ensayo…</p></div></div>'+fallback,"/resumen.html","reader"))
 write(ROOT/"404.html",document('<head><title>Página no encontrada | Resúmenes Trials</title><meta name="robots" content="noindex,follow"></head>','<div class="ev-doc ev-notfound"><p class="ev-eyebrow"><span class="ev-pulse" aria-hidden="true"></span>Error 404</p><h1>Página no encontrada</h1><p class="ev-lead">Puedes encontrar el ensayo con el buscador de arriba, en el archivo o en las áreas clínicas.</p><div class="ev-actions-row"><a class="ev-btn ev-btn-primary" href="/">Volver al archivo</a><a class="ev-btn" href="/medicina-critica/">Medicina Crítica</a><a class="ev-btn" href="/medicina-interna/">Medicina Interna</a></div></div>',"/404.html"))
 # Static index also runs without a local Jekyll process; SEO is identical to the include.
 write(ROOT/"index.html",home.read_text(encoding="utf-8"))
 print(f"DESIGN TEMPLATES PASS: {len(items)} trials, {len(clusters)} subtemas, archivo, cuenta, lector y documentos")

