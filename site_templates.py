"""Single presentation template source. Editorial data and SEO are read-only inputs."""
from pathlib import Path
from datetime import date,timedelta
import json, re, html
ROOT=Path(__file__).resolve().parent
BASE="https://resumenestrials.com"
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

MONTHS=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
MONTHS3=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
def iso_date(value):
 value=str(value or "").strip()
 if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",value):return None
 try:return date.fromisoformat(value)
 except ValueError:return None

EDITORIAL_SIGNATURE='<span class="ev-signature">Por <a href="/equipo-editorial/" rel="author">Editorial EMEICRÍTICA</a></span>'
METHOD_NOTE=('<div class="ev-method"><span class="ev-original-label">Cómo se elaboró</span>'
 '<span>Resumen redactado por la Editorial EMEICRÍTICA con apoyo de herramientas de inteligencia artificial, con criterios editoriales fijos, y verificado con controles automáticos contra el artículo original.'
 '</span><span class="ev-method-links"><a href="/metodologia/">Metodología</a><a href="/equipo-editorial/">Cómo trabajamos</a><a href="mailto:resumenestrials@outlook.com">Reportar un error</a></span></div>')
SUBSCRIBE_NOTE=('<div class="ev-method ev-subscribe"><span class="ev-original-label">Avisos por correo</span>'
 '<span>Recibe un aviso cuando publiquemos un resumen nuevo. Es gratis y puedes darte de baja cuando quieras.</span>'
 '<span class="ev-method-links"><a href="/registro.html">Crear cuenta y activar avisos</a><a href="/cuenta.html">Ya tengo cuenta</a></span></div>')
YOUTUBE_ID=re.compile(r"[A-Za-z0-9_-]{11}")
def load_videos():
 """videos.json: {"<id del resumen>": {"youtube_id","titulo","descripcion","fecha_subida","duracion"}}.

 Un video por resumen. Sin entradas no se genera nada; un dato inválido detiene la generación.
 """
 p=ROOT/"videos.json"
 if not p.exists():return {}
 data=json.loads(p.read_text(encoding="utf-8"))
 if not isinstance(data,dict):raise ValueError("videos.json debe ser un objeto {id: video}")
 for k,v in data.items():
  if not re.fullmatch(r"\d+",str(k)) or not isinstance(v,dict):raise ValueError(f"videos.json: entrada inválida {k!r}")
  for f in ("youtube_id","titulo","descripcion","fecha_subida","duracion"):
   if not str(v.get(f) or "").strip():raise ValueError(f"videos.json · {k}: falta {f}")
  if not YOUTUBE_ID.fullmatch(v["youtube_id"]):raise ValueError(f"videos.json · {k}: youtube_id inválido")
  if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",v["fecha_subida"]):raise ValueError(f"videos.json · {k}: fecha_subida debe ser AAAA-MM-DD")
  if not re.fullmatch(r"PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?",v["duracion"]):raise ValueError(f"videos.json · {k}: duracion ISO 8601, p. ej. PT6M30S")
 return data
def video_minutes(d):
 m=re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",d);h,mi,se=(int(x or 0) for x in m.groups())
 return max(1,round((h*3600+mi*60+se)/60))
def video_path(manifest,id):return "/videos/"+manifest[trial_id(id)]["path"].strip("/").split("/")[-1]+"/"
def video_block(r,manifest,videos):
 v=videos.get(trial_id(r["id"]))
 if not v:return ""
 t=esc(v["titulo"]);y=esc(v["youtube_id"])
 return (f'<section class="ev-video" aria-labelledby="ev-video-h"><h2 id="ev-video-h">En video</h2><div class="ev-video-frame">'
  f'<button type="button" class="ev-video-play" data-ev-video="{y}" data-ev-video-title="{t}">{icon("play")}<span>Reproducir: {t}</span></button></div>'
  f'<p class="ev-video-meta">EMEICRÍTICA · {video_minutes(v["duracion"])} min</p><div class="ev-method-links"><a href="{video_path(manifest,r["id"])}">Página del video</a><a href="https://www.youtube.com/watch?v={y}" target="_blank" rel="noopener noreferrer">Ver en YouTube</a></div></section>')
def editorial_dates(r):
 values=[("fecha_publicacion_resumen","Publicado en Resúmenes Trials"),("fecha_revision","Última revisión")]
 parts=[EDITORIAL_SIGNATURE]
 for key,label in values:
  value=r.get(key) or (r.get("actualizado") if key=="fecha_revision" else "")
  if value:parts.append(f'<span>{label}: <time datetime="{esc(value)}">{esc(human_date(value))}</time></span>')
 return '<div class="ev-editorial-dates">'+" · ".join(parts)+'</div>'

def version():
 p=ROOT/"ui/runtime-version.json"
 return json.loads(p.read_text(encoding="utf-8"))["version"] if p.exists() else "nova-v1"
ICONS={"search":'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',"sun":'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',"moon":'<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>',"menu":'<path d="M4 7h16M4 12h16M4 17h10"/>',"close":'<path d="M6 6l12 12M18 6 6 18"/>',"home":'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-6h4v6"/>',"grid":'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',"bookmark":'<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',"pdf":'<path d="M12 3.5v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4.5 16.5v3h15v-3"/>',"list":'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',"read":'<path d="M3 5.5c3.5-1 6.5-.5 9 1.5 2.5-2 5.5-2.5 9-1.5v13c-3.5-1-6.5-.5-9 1.5-2.5-2-5.5-2.5-9-1.5z"/><path d="M12 7v13"/>',"more":'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',"share":'<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4"/>',"text":'<path d="M4 18 9 6l5 12M5.7 14h6.6"/><path d="M15 18l3-7 3 7M15.8 16h4.4"/>',"clock":'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',"play":'<path d="M8.5 5.5v13l10.5-6.5z"/>',"arrow-left":'<path d="M19 12H5M11 6l-6 6 6 6"/>',"arrow-right":'<path d="M5 12h14M13 6l6 6-6 6"/>',"arrow-up":'<path d="M12 19V5M6 11l6-6 6 6"/>',"user":'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',"external":'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',"filter":'<path d="M4 6h16M7 12h10M10 18h4"/>',"spark":'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'}
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
NAV=[("/","Edición actual"),("/medicina-critica/","Medicina Crítica"),("/medicina-interna/","Medicina Interna"),("/archivo/","Archivo")]
MEMBER=[("/biblioteca.html","Mi biblioteca"),("/cuenta.html","Cuenta")]
INFO=[("/metodologia/","Metodología"),("/equipo-editorial/","Editorial"),("/correcciones/","Correcciones"),("/privacidad/","Privacidad"),("/terminos/","Términos")]
SOCIAL=[("https://t.me/ResumenesTrials","Telegram"),("https://x.com/resumenestrials","X · @resumenestrials")]
def brand(small=False):return '<a class="ev-brand" href="/" aria-label="Resúmenes Trials, ir al inicio"><span class="ev-brand-mark"><img src="/logo.png" width="40" height="40" alt=""></span><span class="ev-brand-name" aria-hidden="true">Resúmenes <b>Trials</b></span></a>'
def header(home=False):
 search=('<form class="ev-search" role="search" action="/archivo/" method="get" data-ev-search-form>'
  '<label class="ev-sr" for="ev-q">Buscar resúmenes de ensayos clínicos</label>'+icon("search")+
  '<input id="ev-q" name="q" type="search" placeholder="Buscar en el archivo" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" aria-controls="ev-search-panel">'
  '<button type="button" class="ev-search-clear" data-ev-search-clear aria-label="Borrar búsqueda" hidden>'+icon("close")+'</button>'
  '<kbd class="ev-kbd" aria-hidden="true">/</kbd>'
  '<div id="ev-search-panel" class="ev-search-panel" hidden><p id="ev-search-status" class="ev-search-status" role="status"></p><ul id="ev-search-results" class="ev-results"></ul><a id="ev-search-all" class="ev-search-all" href="/archivo/">Ver todos los resultados en el archivo'+icon("arrow-right")+'</a></div>'
  '</form>')
 nav='<nav class="ev-header-nav" aria-label="Navegación principal">'+''.join(f'<a href="{u}">{l}</a>' for u,l in NAV)+'</nav>'
 # Franja superior: lema (h1 solo en la portada) y utilidades. La barra con marca, secciones, buscador y menú es la que queda fija.
 tag="h1" if home else "b"
 tagline=f'<div class="ev-tagline"><{tag}>Evidencia sin ruido</{tag}><span>Resúmenes críticos de ensayos clínicos, en español</span></div>'
 utilities=('<div class="ev-utilities"><a class="ev-util" href="/biblioteca.html">'+icon("bookmark")+'<span>Mi biblioteca</span></a><button class="ev-icon-btn" type="button" data-ev-theme aria-label="Cambiar tema">'+'<span class="ev-theme-sun">'+icon("sun")+'</span><span class="ev-theme-moon">'+icon("moon")+'</span></button>'
  '<a class="ev-account-link" href="/cuenta.html">'+icon("user")+'<span>Cuenta</span></a></div>')
 menu='<button class="ev-icon-btn ev-menu-toggle" type="button" data-ev-menu aria-controls="ev-menu" aria-expanded="false" aria-label="Abrir menú">'+icon("menu")+'</button>'
 return '<a class="ev-skip" href="#ev-main">Saltar al contenido</a><header class="ev-header"><div class="ev-header-top">'+tagline+utilities+'</div><div class="ev-header-inner">'+brand()+nav+search+menu+'</div></header>'
def footer(home=False):
 col=lambda title,links:'<nav class="ev-footer-col" aria-label="'+title+'"><p class="ev-footer-title">'+title+'</p>'+''.join(f'<a href="{u}">{l}</a>' for u,l in links)+'</nav>'
 notice=(ROOT/'templates/home-disclosure.html').read_text(encoding='utf-8') if home else '<p>Google Search Console se utiliza en modo de solo lectura para revisar la visibilidad del sitio. <a href="/privacidad/">Consulta la política de privacidad</a>.</p>'
 return ('<footer class="ev-footer"><div class="ev-footer-inner"><div class="ev-footer-brand">'+brand()+'<p class="ev-footer-claim">Evidencia sin ruido.</p><p class="ev-footer-about">Resúmenes críticos en español de ensayos clínicos de Medicina Crítica y Medicina Interna.</p></div>'
  +col("Explorar",NAV+MEMBER)+col("Transparencia",INFO)+col("Comunidad",SOCIAL+[("/registro.html","Crear cuenta")])+
  '</div><div class="ev-footer-legal">'+notice+'<p>Para médicos y profesionales de la salud. No sustituye el artículo original ni el juicio clínico.</p></div></footer>'
  '<nav class="ev-mobile-nav" aria-label="Navegación móvil"><a href="/">'+icon("home")+'<span>Inicio</span></a><button type="button" data-ev-specialties>'+icon("grid")+'<span>Especialidades</span></button><a href="/biblioteca.html">'+icon("bookmark")+'<span>Biblioteca</span></a><button type="button" data-ev-menu aria-controls="ev-menu" aria-expanded="false">'+icon("menu")+'<span>Menú</span></button></nav>'
  '<button class="ev-top" type="button" data-ev-top aria-label="Volver arriba" hidden>'+icon("arrow-up")+'</button>')
def dialogs():
 clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf-8")) if (ROOT/"seo-cluster-manifest.json").exists() else {}
 def dialog(id,title,content,kind="sheet"):return f'<dialog id="{id}" class="ev-dialog ev-{kind}" aria-labelledby="{id}-title"><div class="ev-dialog-head"><h2 id="{id}-title">{title}</h2><button class="ev-icon-btn" type="button" data-ev-close aria-label="Cerrar">'+icon("close")+'</button></div><div class="ev-dialog-body">'+content+'</div></dialog>'
 tiles='<div class="ev-tiles"><a class="ev-tile" data-tone="critica" href="/medicina-critica/"><b>Medicina Crítica</b><span>Sepsis, ventilación, choque, neurocríticos y más</span></a><a class="ev-tile" data-tone="interna" href="/medicina-interna/"><b>Medicina Interna</b><span>Cardiología, renal, infecciosas, neumología y más</span></a></div>'
 topics='<p class="ev-dialog-label">Subtemas</p><div class="ev-dialog-chips">'+''.join(f'<a class="ev-chip" href="{esc(c["path"])}">{esc(c["name"])}</a>' for c in clusters.values())+'</div>'
 menu='<nav class="ev-menu-list" aria-label="Menú">'+''.join(f'<a href="{u}">{l}</a>' for u,l in NAV+MEMBER)+'</nav><p class="ev-dialog-label">Transparencia</p><nav class="ev-menu-list ev-menu-minor" aria-label="Transparencia">'+''.join(f'<a href="{u}">{l}</a>' for u,l in INFO)+'</nav><p class="ev-dialog-label">Síguenos</p><nav class="ev-menu-list ev-menu-minor" aria-label="Redes">'+''.join(f'<a href="{u}">{l}</a>' for u,l in SOCIAL)+'</nav>'
 return dialog("ev-specialties","Especialidades",tiles+topics)+dialog("ev-menu","Menú",menu,"drawer")
SIGNAL_SVG='<svg width="96" height="18" viewBox="0 0 96 18"><path d="M0 17C44 17 46 6 84 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="90" cy="6" r="5"/></svg>'
SIGNAL='<div class="ev-signal" aria-hidden="true"><i></i>'+SIGNAL_SVG+'</div>'
HEAD_SCRIPT=('<script>window.evNavigatingAway=false;for(const e of ["beforeunload","pagehide"])addEventListener(e,()=>window.evNavigatingAway=true);addEventListener("pageshow",e=>{if(e.persisted)window.evNavigatingAway=false});'
 '(()=>{const d=document.documentElement;try{const t=localStorage.getItem("rt-tema");d.dataset.evTheme=t==="claro"||t==="oscuro"?t:matchMedia("(prefers-color-scheme:dark)").matches?"oscuro":"claro"}catch{}'
 'try{const w=innerWidth,c=matchMedia("(pointer:coarse)").matches;d.dataset.evDevice=w<720?"movil":w<1100?"tableta":"escritorio";d.dataset.evPointer=c?"tactil":"raton"}catch{}'
 'try{if(/^\\/(trials\\/|resumen(\\.html|\\/))/.test(location.pathname)&&localStorage.getItem("ev-focus")==="true")d.dataset.evReadingMode="on"}catch{}})()</script>')
# Los enlaces antiguos al archivo en la portada (/?q=…, /?esp=…, /#ev-archivo) pasan a /archivo/ antes de pintar, con sus parámetros y ancla.
HOME_REDIRECT='<script>if(/[?&](q|esp|sub|tema|anio|revista|tipo|orden|n|vista)=/.test(location.search)||location.hash==="#ev-archivo")location.replace("/archivo/"+location.search+location.hash)</script>'
def clean_head(source,title=None,route=""):
 h=re.search(r"<head[^>]*>([\s\S]*?)</head>",source,re.I)
 head=h[1] if h else '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
 head=re.sub(r"<style\b[^>]*>[\s\S]*?</style>","",head,flags=re.I)
 head=re.sub(r'<link\b[^>]*(?:rel=["\'](?:stylesheet|preconnect)["\']|fonts\.google|/fonts/)[^>]*>',"",head,flags=re.I)
 head=re.sub(r"<script\b([^>]*)>[\s\S]*?</script>",lambda m:m[0] if "application/ld+json" in m[1] else "",head,flags=re.I)
 head=re.sub(r'<meta\b[^>]*name=["\']theme-color["\'][^>]*>',"",head,flags=re.I)
 if not re.search(r'<meta\b[^>]*charset=',head,re.I):head='<meta charset="UTF-8">'+head
 if not re.search(r'<meta\b[^>]*name=["\']viewport["\']',head,re.I):head+='<meta name="viewport" content="width=device-width,initial-scale=1">'
 if not re.search(r'<title>',head,re.I):head+=f'<title>{esc(title or "Resúmenes Trials")}</title>'
 head+='<meta name="theme-color" content="#0f1b2d" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f6f4f0" media="(prefers-color-scheme: light)">'+(HOME_REDIRECT if route=="/" else "")+HEAD_SCRIPT
 # Fuentes propias (/fonts): ninguna dependencia externa bloquea el primer render.
 head+=f'<link rel="preload" href="/fonts/newsreader-normal-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/site-runtime.css?v={version()}">'
 return head
def document(source,body,route,kind="document",scripts="",title=None):
 head=clean_head(source,title,route)
 if route=="/":scripts+='<script type="module" src="/recommendations.js?v=20261113-revista-v1"></script>'
 if route not in EXCLUDED and route!="/resumen.html" and not route.startswith("/resumen/"):head+=ADSENSE_SCRIPT
 mode="list" if kind=="archive" or route=="/biblioteca.html" else "quick"
 return '<!DOCTYPE html><html lang="es-MX"><head>'+head+'</head><body class="'+("ev-reader" if kind=="reader" else "ev-"+kind)+'" data-ev-search-mode="'+mode+'"><div class="ev-aurora" aria-hidden="true"></div>'+header(route=="/")+'<main id="ev-main" class="ev-main" tabindex="-1">'+body+'</main>'+footer(route=="/")+dialogs()+scripts+f'<script src="/site-runtime.js?v={version()}" defer></script></body></html>\n'
FACTS=[("revista","Revista"),("anio","Año"),("fecha","Fecha"),("tipo_estudio","Tipo de estudio"),("especialidad_principal","Especialidad"),("especialidad_secundaria","Especialidad secundaria"),("temas","Temas"),("registro","Registro"),("doi","DOI"),("financiacion","Financiación")]
LONG_FACTS=("tipo_estudio","temas","financiacion")
def facts(r):
 return '<dl class="ev-study-facts">'+''.join(f'<div{' class="ev-fact-long"' if key in LONG_FACTS else ''}><dt>{label}</dt><dd data-ev-field="{key}">{esc("\u00a0· ".join(map(str,r[key])) if isinstance(r.get(key),list) else r.get(key))}</dd></div>' for key,label in FACTS if r.get(key) not in ("",None,[]))+'</dl>'
def card(r,manifest):
 id=trial_id(r["id"]);path=esc(manifest[id]["path"]);area=area_of(r);t=esc(r["titulo"]);topics=" · ".join(r.get("temas") or [])
 topics_attr=f' data-ev-topics="{esc(topics)}"' if topics else ''
 return (f'<li class="ev-card" data-id="{id}" data-tone="{tone(area)}"{topics_attr}><a class="ev-card-title" href="{path}" data-ev-read="{id}"><h2>{t}</h2></a>'
  f'<p class="ev-card-meta"><span>{esc(r["revista"])}</span><span>{esc(human_date(r["fecha"]))}</span></p>'
  f'<div class="ev-card-tags"><span class="ev-area" data-tone="{tone(area)}">{esc(area)}</span></div>'
  # La ficha de cada tarjeta se rellena al abrirla (ui/core.js): ~9,000 elementos menos en la portada.
  +f'<details class="ev-card-facts" data-ev-facts="{id}"><summary>Ficha del estudio</summary></details>'+
  f'<div class="ev-card-foot"><p class="ev-readtime">{readtime(r)}</p><div class="ev-card-actions"><a class="ev-btn ev-btn-primary" href="{path}" data-ev-read="{id}" aria-label="Leer resumen: {t}">Leer</a>'
  f'<details class="ev-pdf-menu"><summary class="ev-btn" aria-label="Descargar PDF de {t}">{icon("pdf")}<span>PDF</span></summary><div class="ev-pdf-pop"><button type="button" data-ev-card-pdf="{id}" data-ev-version="completo" aria-label="Descargar resumen completo PDF de {t}">PDF completo</button><button type="button" data-ev-card-pdf="{id}" data-ev-version="breve" aria-label="Descargar resumen breve PDF de {t}">PDF breve</button></div></details></div></div></li>')
def by_date(items):
 """Mismo orden inicial que el archivo en el navegador (más recientes primero, empates estables).

 Así la portada no muestra primero los ensayos más antiguos y luego se reordena.
 """
 def key(r):
  m=re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})",str(r.get("fecha") or "").strip())
  return (0,-int(m[1]+m[2]+m[3])) if m else (1,0)
 return sorted(items,key=key)
# Texto introductorio de cada especialidad y subtema (fuente editorial: templates/textos-temas.json).
def topic_intro(scope):
 texts=json.loads((ROOT/"templates/textos-temas.json").read_text(encoding="utf-8"))
 text=texts.get(str(scope).strip("/"))
 return f'<p class="ev-topic-intro">{esc(text)}</p>' if text else ''
def archive(items,manifest,title="Archivo de evidencia",scope=""):
 import generar_seo as base
 from collections import Counter
 crit=sum(1 for r in items if "Medicina Crítica" in base.categorias(r));inter=sum(1 for r in items if "Medicina Interna" in base.categorias(r))
 if not scope:
  hero=('<section class="ev-hero ev-hero-compact"><div class="ev-hero-copy"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/">'+icon("arrow-left")+'Edición actual</a></nav><p class="ev-eyebrow">Todos los resúmenes</p>'
   '<h1>Archivo</h1>'
   '<p class="ev-lead ev-intro">Encuentra un ensayo, léelo completo o en versión breve y descárgalo en PDF. Escribe en el buscador una enfermedad, un fármaco o el nombre del estudio.</p></div></section>')
 else:
  kind="Especialidad" if scope in ("medicina-critica","medicina-interna") else "Subtema"
  hero=(f'<section class="ev-hero ev-hero-compact"><div class="ev-hero-copy"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/">{icon("arrow-left")}Inicio</a></nav><p class="ev-eyebrow">{kind}</p><h1>{esc(title)}</h1>'
   f'<p class="ev-lead ev-intro">Resúmenes críticos de ensayos clínicos en español. Elige uno para leerlo completo o en versión breve y descargarlo en PDF.</p>'+topic_intro(scope)+'</div></section>')
 segment=''
 if not scope:
  segment=('<div class="ev-segment" role="radiogroup" aria-label="Especialidad">'
   +''.join(f'<label><input type="radio" name="ev-area" value="{v}"{" checked" if not v else ""}><span>{l}</span></label>' for v,l in [("","Todas"),("Medicina Crítica","Medicina Crítica"),("Medicina Interna","Medicina Interna")])+'</div>')
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
  +filters+'<ul class="ev-list" id="ev-list">'+''.join(card(r,manifest) for r in by_date(items))+'</ul>'
  '<div id="ev-empty" class="ev-empty" hidden><p class="ev-empty-title">No encontramos coincidencias</p><p>Prueba con otra palabra, por ejemplo «sepsis», el nombre corto del estudio o el año.</p><button type="button" class="ev-btn ev-btn-primary" data-ev-reset>Ver todos los resúmenes</button></div>'
  '<button id="ev-more" type="button" class="ev-btn ev-more" hidden>Mostrar más</button></section>')
# ---------- Ediciones semanales y portada ----------
SUB_TONE={"Cardiología":"cardio","Endocrinología":"endo","Neurología":"neuro","Nefrología":"nefro","Neumología":"neumo","Infectología":"infecto","Enfermedades Infecciosas":"infecto","VIH":"infecto","Gastroenterología":"gastro","Oncología":"onco","Hematología":"onco"}
def editions(items):
 """Una edición por semana ISO (lunes a domingo) según fecha_publicacion_resumen.

 Devuelve [(lunes ISO, ensayos)] de la más antigua a la más reciente. La edición actual es la última
 semana con datos, nunca la fecha de hoy: regenerar el sitio da siempre el mismo resultado. Dentro de
 cada edición van primero los artículos más recientes (empate: id más alto); el primero es el destacado.
 Un resumen sin fecha de publicación válida no entra en ninguna edición; sigue en el archivo.
 """
 weeks={}
 for r in items:
  d=iso_date(r.get("fecha_publicacion_resumen"))
  if d:weeks.setdefault((d-timedelta(days=d.weekday())).isoformat(),[]).append(r)
 def order(r):
  id=trial_id(r["id"])
  return (str(r["fecha"]).strip() if iso_date(r.get("fecha")) else "",int(id) if id.isdigit() else 0)
 return [(monday,sorted(rows,key=order,reverse=True)) for monday,rows in sorted(weeks.items())]
def edition_route(monday):return f"/ediciones/{monday}/"
def edition_range(monday,sentence=False):
 """«9–15 de noviembre de 2026»; con sentence=True, «del 9 al 15 de noviembre de 2026»."""
 a=date.fromisoformat(monday);b=a+timedelta(days=6)
 end=f"{b.day} de {MONTHS[b.month-1]} de {b.year}"
 start=str(a.day)+("" if a.month==b.month else f" de {MONTHS[a.month-1]}"+("" if a.year==b.year else f" de {a.year}"))
 if sentence:return f"del {start} al {end}"
 return f"{start}–{end}" if a.month==b.month else f"{start} – {end}"
def title_parts(title,limit=44):
 """Sigla del ensayo (lo que precede a «:») y resto del título; sin sigla utilizable, ("", título)."""
 title=str(title or "");k=title.find(":")
 return (title[:k].strip(),title[k+1:].strip()) if 0<k<=limit and title[k+1:].strip() else ("",title)
def edition_nav(eds,index):
 """Línea de señal como navegador: una marca por edición (hasta 12) y el punto sobre la edición mostrada."""
 last=len(eds)-1
 href=lambda i:"/" if i==last else edition_route(eds[i][0])
 # Las 12 más recientes; una edición más antigua se muestra en una ventana de 12 centrada en ella.
 start=max(0,len(eds)-12) if index>=len(eds)-12 else max(0,index-5)
 ticks=""
 for i in range(start,min(len(eds),start+12)):
  monday=eds[i][0];d=date.fromisoformat(monday);now=i==index
  ticks+=('<li class="ev-ednav-now"><span class="ev-signal" aria-hidden="true">'+SIGNAL_SVG+'</span>' if now else '<li>')+f'<a href="{href(i)}"'+(' aria-current="page"' if now else '')+f' title="Semana del {edition_range(monday)}"><time datetime="{monday}">{d.day} {MONTHS3[d.month-1]}</time></a></li>'
 def step(i,label,name):
  if 0<=i<=last:return f'<a class="ev-ednav-step" href="{href(i)}" aria-label="{label}: {edition_range(eds[i][0])}">{icon(name)}</a>'
  return f'<span class="ev-ednav-step" aria-hidden="true">{icon(name)}</span>'
 return '<nav class="ev-ednav" aria-label="Ediciones semanales">'+step(index-1,"Edición anterior","arrow-left")+'<div class="ev-ednav-track"><ol>'+ticks+'</ol></div>'+step(index+1,"Edición siguiente","arrow-right")+'</nav>'
def edition_lead(r,manifest,label):
 id=trial_id(r["id"]);path=esc(manifest[id]["path"]);area=area_of(r);acronym,rest=title_parts(r["titulo"],22)
 sub=next((s for s in (plain(r.get("especialidad_principal")).strip(),plain(r.get("especialidad_secundaria")).strip()) if s and s!=area and s not in ("Medicina Crítica","Medicina Interna")),"")
 tags=('<div class="ev-card-tags"><span class="ev-type">Ensayo destacado</span>'+f'<span class="ev-area" data-tone="{tone(area)}">{esc(area)}</span>'
  +(f'<span class="ev-tag" data-sub="{SUB_TONE.get(sub,"otra")}">{esc(sub)}</span>' if sub else '')+'</div>')
 # La sigla va como titular grande y el resto del título como bajada; el texto del h2 sigue siendo el título completo.
 title=(f'<h2 class="ev-ed-title"><span class="ev-ed-acr">{esc(acronym)}<span class="ev-sr">: </span></span><span class="ev-ed-deck">{esc(rest)}</span></h2>' if acronym
  else f'<h2 class="ev-ed-title ev-ed-title-long">{esc(r["titulo"])}</h2>')
 author=plain(r.get("autor")).strip()
 if author and not re.search(r"(?i)\b(group|investigators|team|collaborat\w*|network|consortium|grupo|investigadores)\b",author):author+=" et al."
 source='<p class="ev-byline">'+''.join(f'<span>{esc(x)}</span>' for x in (author,r.get("revista"),human_date(r.get("fecha"))) if x)+'</p>'
 finding=((f'<h3>Pregunta</h3><p class="ev-intro">{esc(r["objetivo"])}</p>' if r.get("objetivo") else '')
  +(f'<h3>Hallazgo principal</h3><p class="ev-intro ev-ed-answer">{r["hallazgo"]}</p>' if r.get("hallazgo") else ''))
 brief=f'<a class="ev-btn" href="/resumen.html?id={id}&amp;v=corto">En breve · {minutes(r.get("corto"))} min</a>' if r.get("corto") else ''
 return (f'<article class="ev-ed-lead">{label}{tags}{title}{source}'+(f'<div class="ev-ed-finding">{finding}</div>' if finding else '')
  +f'<div class="ev-actions-row"><a class="ev-btn ev-btn-primary" href="{path}" data-ev-read="{id}">Leer el resumen · {minutes(r.get("cuerpo"))} min</a>{brief}</div></article>')
def edition_item(r,manifest):
 id=trial_id(r["id"]);acronym,rest=title_parts(r["titulo"]);d=iso_date(r.get("fecha"))
 when=f"{d.day} {MONTHS3[d.month-1]} {d.year}" if d else str(r.get("fecha") or "")
 return (f'<li><a class="ev-ed-item" href="{esc(manifest[id]["path"])}" data-ev-read="{id}"><span class="ev-ed-item-title">'+(f'<b>{esc(acronym)}</b>: ' if acronym else '')+f'{esc(rest)}</span>'
  f'<span class="ev-card-meta"><span>{esc(r["revista"])}</span><span>{esc(when)}</span><span>{minutes(r.get("cuerpo"))} min</span></span></a></li>')
def edition_toc(rest,manifest,total):
 """Sumario: los demás ensayos de la semana por área; los siete primeros a la vista y el resto en un desplegable."""
 shown=hidden="";left=7
 for area in ("Medicina Crítica","Medicina Interna"):
  rows=[r for r in rest if (area_of(r)=="Medicina Crítica")==(area=="Medicina Crítica")]
  if not rows:continue
  head=f'<h3 class="ev-area" data-tone="{tone(area)}">{area}</h3>';first,later=rows[:left],rows[left:];left-=len(first)
  if first:shown+=head+'<ul class="ev-ed-list">'+''.join(edition_item(r,manifest) for r in first)+'</ul>'
  if later:hidden+=('' if first else head)+'<ul class="ev-ed-list">'+''.join(edition_item(r,manifest) for r in later)+'</ul>'
 more=len(rest)-7
 details=('<details class="ev-ed-more"><summary class="ev-btn"><span>'+(f'Ver los {more} restantes' if more!=1 else 'Ver el restante')+'</span><span>Mostrar menos</span></summary>'+hidden+'</details>') if hidden else ''
 count="1 resumen" if total==1 else f"{total} resúmenes"
 return f'<aside class="ev-ed-toc" aria-labelledby="ev-ed-toc-h"><div class="ev-ed-toc-head"><h2 id="ev-ed-toc-h">En esta edición</h2><p class="ev-count">{count}</p></div>'+shown+details+'</aside>'
def cover(items,manifest,monday=None):
 """Portada de una edición: navegador, ensayo destacado y sumario. Sin `monday`, la edición actual (ruta /)."""
 eds=editions(items)
 if not eds:return '<div class="ev-doc"><p class="ev-eyebrow">Edición actual</p><h2>Todavía no hay una edición semanal</h2><div class="ev-actions-row"><a class="ev-btn ev-btn-primary" href="/archivo/">Ir al archivo</a></div></div>'
 home=monday is None;index=len(eds)-1 if home else [m for m,_ in eds].index(monday);monday,rows=eds[index]
 label=(f'<p class="ev-eyebrow ev-ed-label">Edición actual · {edition_range(monday)}</p>' if home
  else f'<div class="ev-ed-top"><h1 class="ev-eyebrow ev-ed-label">Edición anterior · {edition_range(monday)}</h1><a href="/">Volver a la edición actual</a></div>')
 return (f'<section class="ev-ed" data-ev-edition="{monday}">'+edition_nav(eds,index)+'<div class="ev-ed-grid">'+edition_lead(rows[0],manifest,label)+edition_toc(rows[1:],manifest,len(rows))+'</div>'
  # Ancla de «Para ti» (recommendations.js): solo en la portada, debajo de la edición.
  +('<div data-ev-recs></div>' if home else '')+'</section>')
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
  f'<header class="ev-reading-head">{SIGNAL}<div class="ev-card-tags"><span class="ev-area" data-tone="{tone(area)}">{esc(area)}</span><span class="ev-type">{esc(r["tipo_estudio"])} · {esc(r["anio"])}</span></div><h1 data-ev-field="titulo">{esc(r["titulo"])}</h1>'
  f'<p class="ev-byline"><span data-ev-field="autor">{esc(r["autor"])}</span><span data-ev-field="revista">{esc(r["revista"])}</span><span data-ev-field="fecha">{esc(human_date(r["fecha"]))}</span></p>'
  f'<div class="ev-keyfinding"><p class="ev-keyfinding-label">{icon("spark")}Hallazgo principal</p><p data-ev-field="hallazgo" class="ev-lead">{r["hallazgo"]}</p></div>'
  f'<p class="ev-readtime">{readtime(r)}</p>{editorial_dates(r)}</header>'
  '<details class="ev-facts" open><summary>Ficha técnica del estudio</summary>'+facts(r)+'</details>'+toolbar+'<progress class="ev-progress" max="100" value="0" aria-label="Progreso de lectura"></progress>'
  '<div class="ev-reader-grid">'+article+'<aside class="ev-rail"><p class="ev-rail-title">En esta página</p><nav data-ev-toc aria-label="Secciones del artículo"></nav></aside></div>'
  f'<div class="ev-endmatter">{video_block(r,manifest,load_videos()) if not legacy else ""}<p class="ev-original"><span class="ev-original-label">Artículo original</span>{original}</p>{METHOD_NOTE}{SUBSCRIBE_NOTE}<nav class="ev-neighbors" aria-label="Continuidad de lectura" data-ev-neighbors></nav><section class="ev-related"><h2>Evidencia relacionada</h2><ul class="ev-list" data-ev-related></ul></section><p class="ev-status" id="ev-reader-status" role="status"></p></div></section>')
def simple_head(title,description,route,schema,og_type="website"):
 canonical=BASE+route
 return ('<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
  f'<title>{esc(title)}</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large">'
  f'<link rel="canonical" href="{canonical}"><meta property="og:type" content="{og_type}"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{BASE}/logo.png">'
  '<link rel="alternate" type="application/atom+xml" title="Resúmenes Trials" href="'+BASE+'/feed.xml">'
  '<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False,separators=(",",":"))+'</script><link rel="icon" href="/favicon.png"></head>')
PUBLISHER={"@type":"Organization","name":"Resúmenes Trials","url":f"{BASE}/equipo-editorial/","logo":{"@type":"ImageObject","url":f"{BASE}/logo.png"}}
def corrections_page(items,manifest):
 """Registro público de correcciones: resúmenes con fecha_revision, de la más reciente a la más antigua."""
 rev=sorted([r for r in items if r.get("fecha_revision")],key=lambda r:(str(r["fecha_revision"]),int(trial_id(r["id"]))),reverse=True)
 last=rev[0]["fecha_revision"] if rev else ""
 groups={}
 for r in rev:groups.setdefault(r["fecha_revision"],[]).append(r)
 lists="".join(f'<h2><time datetime="{esc(d)}">{esc(human_date(d))}</time></h2><ul>'+"".join(f'<li><a href="{esc(manifest[trial_id(r["id"])]["path"])}">{esc(r["titulo"])} ({esc(r["revista"])} {esc(r["anio"])})</a></li>' for r in rs)+'</ul>' for d,rs in groups.items())
 intro=(f'<p>Aquí aparecen los resúmenes cuyo contenido se corrigió después de publicarse, ordenados por la fecha de su última corrección. Hoy son {len(rev)} de {len(items)} resúmenes publicados. Un mismo resumen puede haberse corregido más de una vez; se muestra la corrección más reciente.</p>'
  '<p>Cada corrección se comprueba contra el artículo original antes de publicarse y se aplica a todas las versiones del resumen: la página completa, la versión breve y el PDF. Cómo se revisan los resúmenes y cómo se decide una corrección está explicado en <a href="/equipo-editorial/">Editorial</a>.</p>'
  '<p>Si encuentras un error, escríbenos a <a href="mailto:resumenestrials@outlook.com">resumenestrials@outlook.com</a> con el enlace del resumen y, si puedes, la página o tabla del artículo donde aparece el dato correcto.</p>')
 body=doc_page('Transparencia editorial','Registro de correcciones',f'<p class="ev-doc-date">Última actualización: {esc(human_date(last))}</p>' if last else "",intro+(lists or '<p>Todavía no hay correcciones publicadas.</p>'))
 schema={"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":"Registro de correcciones","url":f"{BASE}/correcciones/","inLanguage":"es-MX","publisher":PUBLISHER,**({"dateModified":last} if last else {})},
  {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Inicio","item":f"{BASE}/"},{"@type":"ListItem","position":2,"name":"Registro de correcciones","item":f"{BASE}/correcciones/"}]}]}
 head=simple_head("Registro de correcciones | Resúmenes Trials","Resúmenes de ensayos clínicos corregidos después de su publicación, con la fecha de la última corrección. Transparencia editorial de Resúmenes Trials.","/correcciones/",schema)
 return document(head,body,"/correcciones/")
def collection_schema(name,route):
 return {"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":name,"url":BASE+route,"inLanguage":"es-MX","publisher":PUBLISHER},
  {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Inicio","item":f"{BASE}/"},{"@type":"ListItem","position":2,"name":name,"item":BASE+route}]}]}
def archive_page(items,manifest):
 """Archivo completo: el listado con buscador y filtros que antes ocupaba la portada."""
 head=simple_head("Archivo | Resúmenes Trials","Archivo completo de Resúmenes Trials: todos los resúmenes críticos en español de ensayos clínicos de Medicina Crítica y Medicina Interna, con buscador y filtros por especialidad, tema, año, revista y tipo de estudio.","/archivo/",collection_schema("Archivo de resúmenes","/archivo/"))
 return document(head,archive(items,manifest),"/archivo/","archive")
def edition_page(items,manifest,monday):
 """Página propia de una edición anterior (la actual vive en la portada)."""
 route=edition_route(monday);name="Edición "+edition_range(monday,True);rows=dict(editions(items))[monday];acronym=title_parts(rows[0]["titulo"],22)[0]
 description=f"Edición semanal de Resúmenes Trials {edition_range(monday,True)}: resúmenes críticos en español de los ensayos clínicos publicados esa semana"+(f", con {acronym} como ensayo destacado." if acronym else ".")
 return document(simple_head(name+" | Resúmenes Trials",description,route,collection_schema(name,route)),cover(items,manifest,monday),route,"edition")
def video_page(r,v,manifest):
 """Página del video: el video es el contenido principal (requisito de Google para mostrarlo en resultados de video)."""
 route=video_path(manifest,r["id"]);trial=manifest[trial_id(r["id"])]["path"];y=v["youtube_id"]
 schema={"@context":"https://schema.org","@graph":[{"@type":"VideoObject","name":v["titulo"],"description":v["descripcion"],"inLanguage":"es-MX",
   "thumbnailUrl":[f"https://i.ytimg.com/vi/{y}/maxresdefault.jpg",f"https://i.ytimg.com/vi/{y}/hqdefault.jpg"],"uploadDate":v["fecha_subida"],"duration":v["duracion"],
   "embedUrl":f"https://www.youtube.com/embed/{y}","url":BASE+route,"publisher":PUBLISHER,"about":{"@type":"ScholarlyArticle","name":plain(r["titulo"]),"identifier":plain(r.get("doi"))},
   "isBasedOn":BASE+trial},
  {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Inicio","item":f"{BASE}/"},{"@type":"ListItem","position":2,"name":plain(r["titulo"]),"item":BASE+trial},{"@type":"ListItem","position":3,"name":"Video","item":BASE+route}]}]}
 t=esc(v["titulo"])
 body=('<div class="ev-doc ev-doc-text ev-video-page"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="'+esc(trial)+'">'+icon("arrow-left")+'Volver al resumen</a></nav>'
  '<p class="ev-eyebrow">Video · EMEICRÍTICA</p><h1>'+t+'</h1>'
  f'<div class="ev-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/{esc(y)}" title="{t}" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>'
  f'<p class="ev-doc-date">Publicado el {esc(human_date(v["fecha_subida"]))} · {video_minutes(v["duracion"])} min</p>'
  '<article class="ev-prose"><p>'+esc(v["descripcion"])+'</p>'
  f'<p>Resumen crítico completo del ensayo: <a href="{esc(trial)}">{esc(r["titulo"])}</a>.</p>'
  f'<p>Fuente: {esc(r["autor"])} et al. {esc(r["revista"])}, {esc(r["anio"])}. DOI {esc(r.get("doi"))}.</p>'
  '<p>El presentador del video es un personaje creado con inteligencia artificial. El contenido no sustituye el artículo original ni el juicio clínico.</p></article></div>')
 head=simple_head(f'{v["titulo"]} | Video | Resúmenes Trials',v["descripcion"][:155],route,schema,"video.other")
 return document(head,body,route)
def doc_page(eyebrow,h1,date_html,content):return '<div class="ev-doc ev-doc-text"><p class="ev-eyebrow">'+eyebrow+'</p><h1>'+h1+'</h1>'+date_html+'<article class="ev-prose">'+content+'</article></div>'
def write(path,text):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding="utf-8")
def render_all():
 items=json.loads((ROOT/"resumenes.json").read_text(encoding="utf-8"));manifest=json.loads((ROOT/"seo-manifest.json").read_text(encoding="utf-8"));clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf-8"))
 for r in items:
  path=ROOT/manifest[trial_id(r["id"])]["path"].lstrip("/")/"index.html";source=path.read_text(encoding="utf-8")
  write(path,document(source,reading(r,manifest),manifest[trial_id(r["id"])]["path"],"reader"))
 home=ROOT/"_includes/index-source.html";write(home,document(home.read_text(encoding="utf-8"),cover(items,manifest),"/","edition"))
 write(ROOT/"archivo/index.html",archive_page(items,manifest))
 past=[monday for monday,_ in editions(items)[:-1]]
 for monday in past:write(ROOT/"ediciones"/monday/"index.html",edition_page(items,manifest,monday))
 edir=ROOT/"ediciones"
 if edir.exists():
  import shutil
  for d in edir.iterdir():
   if d.is_dir() and d.name not in past:shutil.rmtree(d)
  if not any(edir.iterdir()):edir.rmdir()
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
 write(ROOT/"correcciones/index.html",corrections_page(items,manifest))
 videos=load_videos();expected=set()
 for id,v in videos.items():
  r=next((x for x in items if trial_id(x["id"])==id),None)
  if r is None:raise ValueError(f"videos.json: el resumen {id} no existe")
  route=video_path(manifest,id);expected.add(route.strip("/").split("/")[-1])
  write(ROOT/route.lstrip("/")/"index.html",video_page(r,v,manifest))
 vdir=ROOT/"videos"
 if vdir.exists():
  import shutil
  for d in vdir.iterdir():
   if d.is_dir() and d.name not in expected:shutil.rmtree(d)
  if not any(vdir.iterdir()):vdir.rmdir()
 # Existing inactive subtopic route stays available with its own empty archive.
 path=ROOT/"medicina-interna/hematologia-oncologia/index.html"
 if path.exists():
  source=path.read_text(encoding="utf-8");write(path,document(source,archive([],manifest,"Hematología y oncología","hematologia-oncologia"),"/medicina-interna/hematologia-oncologia/","archive"))
 for name in ["agregar","privacidad"]:
  source=(ROOT/"templates"/(name+".html")).read_text(encoding="utf-8");body=re.search(r"<body>([\s\S]*?)</body>",source)[1]
  if name=="agregar":
   # The section container owns its rows; collection must not depend on legacy CSS names.
   body=body.replace('seccionesEl.querySelectorAll(".sec-row")', "seccionesEl.children")
   body='<div class="ev-doc ev-doc-wide"><p class="ev-eyebrow">Herramienta interna</p><h1>Panel editorial</h1>'+body+'</div>'
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
 write(ROOT/"404.html",document('<head><title>Página no encontrada | Resúmenes Trials</title><meta name="robots" content="noindex,follow"></head>','<div class="ev-doc ev-notfound"><p class="ev-eyebrow">Error 404</p><h1>Página no encontrada</h1><p class="ev-lead">Puedes encontrar el ensayo con el buscador de arriba, en el archivo o en las áreas clínicas.</p><div class="ev-actions-row"><a class="ev-btn ev-btn-primary" href="/archivo/">Ir al archivo</a><a class="ev-btn" href="/medicina-critica/">Medicina Crítica</a><a class="ev-btn" href="/medicina-interna/">Medicina Interna</a></div></div>',"/404.html"))
 # Static index also runs without a local Jekyll process; SEO is identical to the include.
 write(ROOT/"index.html",home.read_text(encoding="utf-8"))
 print(f"DESIGN TEMPLATES PASS: {len(items)} trials, {len(clusters)} subtemas, portada, {len(past)} ediciones anteriores, archivo, cuenta, lector y documentos")

