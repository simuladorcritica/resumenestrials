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
 '</span><span class="ev-method-links"><a href="/metodologia/">Metodología</a><a href="/correcciones/">Correcciones</a><a href="/equipo-editorial/">Cómo trabajamos</a><a href="mailto:resumenestrials@outlook.com">Reportar un error</a></span></div>')
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
# ---------- Preguntas clínicas ----------
# preguntas-clinicas.json es una fuente: cada pregunta reúne ensayos ya resumidos (núcleo) y enlaza los vecinos
# (relacionados). De cada ensayo se muestran sus campos publicados (`objetivo`, `hallazgo`, revista y año) sin
# reescribirlos. El texto propio vive POR ENSAYO: una frase por eje de diseño (intervención, comparador, población,
# desenlace, tamaño). Añadir un ensayo a una pregunta es añadir su entrada; nada de lo ya escrito se toca.
# Guardas mecánicas (question_sentence_errors): una frase que no empieza por la sigla de su ensayo, que cita una
# cifra ausente del resumen publicado de ese ensayo, o que usa lenguaje de resultado o de recomendación, NO se
# publica. Así, si una corrección cambia una cifra citada, la frase desfasada desaparece sola al regenerar.
QUESTIONS_PATH=ROOT/"preguntas-clinicas.json"
QUESTION_CONTEXT="Esta página reúne, en breve, ensayos resumidos en Resúmenes Trials relacionados con esta pregunta; no es una revisión de toda la evidencia ni una guía clínica. De cada ensayo da solo lo esencial para situarlo: el detalle está en su resumen."
QUESTION_NOTE=('<div class="ev-method ev-q-note">'
 '<span><strong>Cómo se elaboró.</strong> Elaborada por la Editorial EMEICRÍTICA con apoyo de inteligencia artificial, solo a partir de los resúmenes publicados en este sitio: «Qué preguntó» y «Hallazgo principal» son texto del resumen, y cada frase añadida tiene una cita literal que la respalda y pasó revisores independientes. No recomienda un tratamiento.'
 '</span><span class="ev-method-links"><a href="/metodologia/">Metodología</a><a href="/correcciones/">Correcciones</a><a href="/equipo-editorial/">Cómo trabajamos</a><a href="mailto:resumenestrials@outlook.com">Reportar un error</a></span></div>')
QUESTION_AREAS={"Medicina Crítica":"/medicina-critica/","Medicina Interna":"/medicina-interna/"}
QUESTION_NUMBER=re.compile(r"(?<![\w.,])\d+(?:[.,]\d+)?(?!\w)")
# Lenguaje que una frase de diseño no puede llevar: resultados, juicios, recomendaciones y afirmaciones sobre el conjunto.
QUESTION_BANNED=re.compile(r"\b(?:conviene|deber[ií]an?|recomend\w*|preferibles?|mejor(?:es)?|peor(?:es)?|apoyan?|respaldan?|demuestr\w*|demostr\w*|confirm\w*|[úu]nic[oa]s?|ning[úu]n\w*|significativ\w*|reduj\w*|reduc[eí]\w*|aument[oó]|aumentaron|disminuy\w*|mejor[oó]|mejoraron|empeor\w*|benefici\w*|eficaz|eficaces|eficacia|efectiv\w*|tuvo|tuvieron|muri[oó]|murieron|sobrevivi\w*|fue (?:de|del|menor|mayor|similar|igual)|no (?:hubo|encontr\w+|difiri\w+|mostr\w+)|riesgo relativo|raz[oó]n de (?:riesgo|momios)|IC 95|HR|OR|NNT|NNH|todos los ensayos|ambos ensayos|en conjunto|los otros|l[oa]s (?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+) (?:ensayos|estudios))\b",re.I)
# En una frase de contexto (lo que ocurrió en el ensayo) caben hechos observados, pero no consejos, juicios ni afirmaciones sobre el conjunto.
QUESTION_ADVICE=re.compile(r"\b(?:conviene|deber[ií]an?|recomend\w*|preferibles?|mejor(?:es)?|peor(?:es)?|apoyan?|respaldan?|demuestr\w*|demostr\w*|confirm\w*|todos los ensayos|ambos ensayos|en conjunto|los otros|l[oa]s (?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+) (?:ensayos|estudios))\b",re.I)
QUESTION_AXIS_TYPES=("diseno","contexto","literal","ausencia")
# La ficha es un resumen breve: no copia secciones del resumen del ensayo (para lo demás está el enlace al resumen).
QUESTION_SECTIONS=();QUESTION_AXIS_PLACES=("juntos","ficha")
def axis_type(a):return a.get("tipo","diseno")
def axis_place(a):return a.get("lugar","juntos")
def axis_required(a):return a.get("obligatorio",a["clave"]!="tamano")
_QUESTIONS_CACHE={}
def question_quotes(value):
 """Citas literales de una frase: un texto o una lista de textos; [] si el valor no es válido."""
 quotes=[value] if isinstance(value,str) else value if isinstance(value,list) else []
 return [re.sub(r"\s+"," ",q).strip() for q in quotes] if quotes and all(isinstance(q,str) and len(q.strip())>=12 for q in quotes) else []
QUESTION_REVIEWERS=("cotejo","fiscal","omisiones")
def question_review_ok(v):
 """Constancia de que el ensayo pasó las tres revisiones independientes: sin ella no entra en una pregunta."""
 return isinstance(v,dict) and isinstance(v.get("fecha"),str) and iso_date(v["fecha"]) is not None and all(v.get(k)=="VERDE" for k in QUESTION_REVIEWERS) and isinstance(v.get("nota",""),str)
def question_entry_shape(axis,v):
 """Forma de una entrada: {sin_dato} (el resumen no da ese dato), {cita} en un eje literal o {frase, cita} en los demás."""
 text=lambda x:isinstance(x,str) and len(x.strip())>=10
 if not isinstance(v,dict):return False
 if "sin_dato" in v:return set(v)<={"sin_dato","huella"} and text(v["sin_dato"]) and isinstance(v.get("huella",""),str)
 if axis_type(axis)=="ausencia":return False
 if axis_type(axis)=="literal":return set(v)=={"cita"} and bool(question_quotes(v["cita"]))
 return set(v)=={"frase","cita"} and text(v["frase"]) and bool(question_quotes(v["cita"]))
# Constancia de decisión. Cada pregunta guarda hasta qué resumen llegó su curación (`revisado_hasta`); todo resumen posterior
# debe estar en la pregunta o tener anotada aquí su decisión para ella: «nada» (los dos decisores coinciden en que no pertenece),
# «duda» (difieren: no se añade y lo resuelve el editor) o «sin_anadir» (pertenece, pero no pasó la revisión: lo resuelve el editor).
# Así ningún resumen nuevo queda sin comparar con las preguntas: `question_undecided()` lista los que faltan.
QUESTION_DECISIONS=("nada","duda","sin_anadir")
def question_decision_ok(d):
 text=lambda v:isinstance(v,str) and bool(v.strip())
 return (isinstance(d,dict) and set(d)=={"id","fecha","huella","preguntas"} and type(d["id"]) is int and isinstance(d["fecha"],str) and iso_date(d["fecha"]) is not None
  and isinstance(d["huella"],str) and bool(re.fullmatch(r"[0-9a-f]{16}",d["huella"])) and isinstance(d["preguntas"],dict) and bool(d["preguntas"])
  and all(isinstance(v,dict) and set(v)<={"rol","frase","propuesto","nota"} and v.get("rol") in QUESTION_DECISIONS and text(v.get("frase")) and len(v["frase"])>=20
   and (v.get("propuesto") in ("nucleo","relacionado") if v["rol"]=="sin_anadir" else "propuesto" not in v) and isinstance(v.get("nota",""),str) and len(v.get("nota",""))<=300 for v in d["preguntas"].values()))
def question_undecided(data,trials):
 """Resúmenes posteriores a la curación de una pregunta que no están en ella ni tienen decisión anotada para ella: [(id, slug)]."""
 decided={d["id"]:d["preguntas"] for d in data.get("decisiones",[])};ids=sorted(int(i) for i in trials if str(i).isdigit());out=[]
 for q in data["preguntas"]:
  members=set(question_ids(q))|{i for g in q["relacionados"] for i in g["ids"]}
  out+=[(i,q["slug"]) for i in ids if i>q["revisado_hasta"] and i not in members and q["slug"] not in decided.get(i,{})]
 return sorted(out)
def question_unresolved(data):
 """Decisiones que esperan al editor: [(id, slug, rol, nota)] con rol «duda» o «sin_anadir», salvo que el resumen ya esté en la pregunta."""
 members={q["slug"]:set(question_ids(q))|{i for g in q["relacionados"] for i in g["ids"]} for q in data["preguntas"]}
 return sorted((d["id"],slug,v["rol"],v.get("nota","")) for d in data.get("decisiones",[]) for slug,v in d["preguntas"].items() if v["rol"]!="nada" and d["id"] not in members.get(slug,set()))
def parse_questions(data):
 def fail(slug,why):raise ValueError(f"preguntas-clinicas.json · {slug}: {why}")
 text=lambda v:isinstance(v,str) and bool(v.strip())
 if not isinstance(data,dict) or not isinstance(data.get("preguntas"),list):raise ValueError('preguntas-clinicas.json debe ser {"preguntas": [...]}')
 for k in ("pertenencia","reglas"):
  if not isinstance(data.get(k,[]),list) or any(not text(x) for x in data.get(k,[])):raise ValueError(f'preguntas-clinicas.json: {k} debe ser una lista de textos')
 decisions=data.get("decisiones",[])
 if not isinstance(decisions,list) or any(not question_decision_ok(d) for d in decisions) or len({d["id"] for d in decisions})!=len(decisions):
  raise ValueError('preguntas-clinicas.json: decisiones debe ser una lista de {id, fecha, huella, preguntas: {slug: {rol: nada | duda | sin_anadir, frase}}} sin ids repetidos (la escribe la herramienta)')
 slugs=set();cores=set()
 for q in data["preguntas"]:
  slug=q.get("slug") if isinstance(q,dict) else None
  if not isinstance(slug,str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*",slug) or slug in slugs:raise ValueError(f"preguntas-clinicas.json: slug inválido o repetido {slug!r}")
  slugs.add(slug)
  for f in ("pregunta","nombre","descripcion","condicion","criterio","criterio_relacionados"):
   if not text(q.get(f)):fail(slug,f"falta {f}")
  if q["descripcion"].count("{ensayos}")!=1 or re.search(r"\d",q["descripcion"]):fail(slug,"descripcion lleva {ensayos} una vez (ahí van las siglas del núcleo) y ninguna cifra")
  if q.get("area") not in QUESTION_AREAS:fail(slug,"area debe ser Medicina Crítica o Medicina Interna")
  for f in ("fecha_publicacion","fecha_revision"):
   if not isinstance(q.get(f),str) or iso_date(q[f]) is None:fail(slug,f"{f} debe ser AAAA-MM-DD")
  if q["fecha_revision"]<q["fecha_publicacion"]:fail(slug,"fecha_revision anterior a fecha_publicacion")
  if type(q.get("revisado_hasta")) is not int or q["revisado_hasta"]<0:fail(slug,"falta revisado_hasta: el id del último resumen que cubrió la curación de la pregunta (los posteriores llevan decisión anotada)")
  axes=q.get("ejes")
  if not isinstance(axes,list) or not axes or any(not isinstance(a,dict) or not re.fullmatch(r"[a-z_]+",str(a.get("clave") or "")) or not isinstance(a.get("entrada"),str) or not isinstance(a.get("guia",""),str) or axis_type(a) not in QUESTION_AXIS_TYPES or axis_place(a) not in QUESTION_AXIS_PLACES or not isinstance(axis_required(a),bool) or type(a.get("max",500)) is not int or not 100<=a.get("max",500)<=500 for a in axes) or len({a["clave"] for a in axes})!=len(axes):fail(slug,"ejes debe ser una lista de {clave, entrada, guia, tipo, lugar, obligatorio} con claves distintas")
  for a in axes:
   if re.search(r"\d",a["entrada"]) or QUESTION_BANNED.search(a["entrada"]):fail(slug,f"la entrada del eje {a['clave']} no puede llevar cifras ni lenguaje de resultado")
  if any(axis_place(a)=="ficha" and not a["entrada"].strip() for a in axes):fail(slug,"un eje de ficha necesita su rótulo en entrada")
  if any("rotulo" in a and (not text(a["rotulo"]) or len(a["rotulo"])>60 or re.search(r"\d",a["rotulo"]) or QUESTION_BANNED.search(a["rotulo"])) for a in axes):fail(slug,"el rotulo de un eje es un texto breve, sin cifras ni lenguaje de resultado")
  keys={a["clave"]:a for a in axes};core=q.get("nucleo")
  if not isinstance(core,list) or len(core)<2:fail(slug,"nucleo debe tener al menos dos ensayos")
  ids=[]
  for n in core:
   if not isinstance(n,dict) or type(n.get("id")) is not int or not isinstance(n.get("diseno"),dict) or any(k not in keys or not question_entry_shape(keys[k],v) for k,v in n["diseno"].items()) or ("etiqueta" in n and not text(n["etiqueta"])):fail(slug,"cada ensayo del núcleo lleva id entero, diseno {eje: {frase, cita} | {cita} en un eje literal | {sin_dato}} con ejes declarados y, si no tiene sigla, etiqueta")
   if any(axis_required(a) and a["clave"] not in n["diseno"] for a in axes):fail(slug,f"al ensayo {n['id']} le falta un eje obligatorio (o su sin_dato)")
   if not question_review_ok(n.get("revision")):fail(slug,f"el ensayo {n['id']} no tiene la constancia de sus tres revisiones independientes en VERDE (revision: fecha, cotejo, fiscal, omisiones)")
   ids.append(n["id"])
  if len(set(ids))!=len(ids) or cores&set(ids):fail(slug,"un ensayo solo puede estar una vez en el núcleo, y en el de una sola pregunta")
  cores|=set(ids)
  groups=q.setdefault("relacionados",[])
  if not isinstance(groups,list):fail(slug,"relacionados debe ser una lista")
  seen=set(ids)
  for g in groups:
   gids=g.get("ids") if isinstance(g,dict) else None
   if not isinstance(g,dict) or not text(g.get("motivo")) or re.search(r"\d",g["motivo"]) or len(g["motivo"])>80 or not isinstance(gids,list) or not gids or any(type(i) is not int for i in gids) or seen&set(gids):fail(slug,"cada grupo de relacionados lleva motivo (sin cifras) e ids enteros que no se repiten ni están en el núcleo")
   seen|=set(gids)
 if any(slug not in slugs for d in decisions for slug in d["preguntas"]):raise ValueError("preguntas-clinicas.json: una decisión nombra una pregunta que no existe")
 return data["preguntas"]
def load_questions():
 """Preguntas vigentes, leídas una vez por proceso y por versión del archivo. Sin archivo no hay preguntas."""
 try:key=QUESTIONS_PATH.stat().st_mtime_ns
 except OSError:return []
 if key not in _QUESTIONS_CACHE:_QUESTIONS_CACHE.clear();_QUESTIONS_CACHE[key]=parse_questions(json.loads(QUESTIONS_PATH.read_text(encoding="utf-8")))
 return _QUESTIONS_CACHE[key]
_TRIALS_CACHE={}
def _trials():
 path=ROOT/"resumenes.json";key=path.stat().st_mtime_ns
 if key not in _TRIALS_CACHE:_TRIALS_CACHE.clear();_TRIALS_CACHE[key]={trial_id(r["id"]):r for r in json.loads(path.read_text(encoding="utf-8"))}
 return _TRIALS_CACHE[key]
def question_route(q):return "/preguntas/"+q["slug"]+"/"
def question_trial(q,id,trials=None):
 r=(trials if trials is not None else _trials()).get(trial_id(id))
 if r is None:raise ValueError(f"preguntas-clinicas.json · {q['slug']}: el resumen {id} no existe")
 return r
def question_core(q,trials=None):
 """Ensayos del núcleo en orden cronológico del artículo: [(entrada, resumen)]. El orden del archivo no importa."""
 rows=[(n,question_trial(q,n["id"],trials)) for n in q["nucleo"]]
 return sorted(rows,key=lambda x:(str(x[1].get("fecha") or ""),int(x[0]["id"])))
def question_ids(q):return [n["id"] for n in q["nucleo"]]
def question_description(q,trials=None):
 """Descripción de la página: la plantilla de la pregunta con las siglas del núcleo, en orden cronológico («A, B y C»)."""
 labels=[trial_label(r,n) for n,r in question_core(q,trials)]
 last=labels[-1];joiner=" e " if re.match(r"(?i)h?i(?![aeou])",last) else " y "
 return q["descripcion"].replace("{ensayos}",(", ".join(labels[:-1])+joiner+last) if len(labels)>1 else last)
def trial_label(r,entry):
 """Sigla del ensayo (lo que precede a los dos puntos del título) o la etiqueta fijada en su entrada."""
 if entry.get("etiqueta"):return entry["etiqueta"].strip()
 head,sep,_=str(r["titulo"]).partition(":")
 if not sep or len(head)>30:raise ValueError(f"preguntas-clinicas.json: el resumen {r['id']} no tiene sigla; añade su etiqueta")
 return head.strip()
def published_text(r):
 """Texto publicado de un resumen, sin etiquetas y con los espacios normalizados: donde se buscan las citas."""
 return [re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]*>"," ",str(r.get(k) or ""))).replace("\u00a0"," ")).strip() for k in ("titulo","objetivo","hallazgo","corto","cuerpo","tipo_estudio")]
def question_sentence_errors(sentence,label,r,other_labels=(),quote=None,kind="diseno",limit=500):
 """Motivos por los que una frase de diseño NO puede publicarse (lista vacía: puede).
 `quote` es la cita literal (o las citas) del resumen publicado que la respalda: cada una debe seguir en el resumen
 y entre todas deben contener cada cifra de la frase."""
 errors=[];s=str(sentence or "").strip();quotes=question_quotes(quote);fields=published_text(r)
 if not s.startswith((label+" ",label+", ")):errors.append(f"no empieza por «{label}»")
 if not s.endswith(".") or len(s)>limit or "\n" in s or re.search(r"<\s*/?[a-zA-Z]",s):errors.append(f"debe ser una sola frase de texto, terminada en punto y de {limit} caracteres como máximo (tiene {len(s)})")
 for other in other_labels:
  if other and other!=label and re.search(r"(?<!\w)"+re.escape(other)+r"(?!\w)",s):errors.append(f"nombra otro ensayo («{other}»)")
 bad=(QUESTION_ADVICE if kind=="contexto" else QUESTION_BANNED).search(s)
 if bad:errors.append((f"lenguaje de consejo, juicio o conjunto («{bad[0]}»)" if kind=="contexto" else f"lenguaje de resultado, juicio o conjunto («{bad[0]}»)"))
 if not quotes or any(not any(c in field for field in fields) for c in quotes):errors.append("la cita no está literalmente en el resumen publicado")
 known={m.replace(",",".") for c in quotes for m in QUESTION_NUMBER.findall(c)};body=s[len(label):] if s.startswith(label) else s
 missing=[m for m in QUESTION_NUMBER.findall(body) if m.replace(",",".") not in known]
 if missing:errors.append("cifras que no están en la cita: "+", ".join(missing))
 return errors
def question_literal_errors(quote,r):
 """Motivos por los que una cita literal (lo que el propio resumen dice, entre comillas) NO puede publicarse."""
 quotes=question_quotes(quote);fields=published_text(r);errors=[]
 if not quotes or any(not any(c in field for field in fields) for c in quotes):errors.append("la cita no está literalmente en el resumen publicado")
 if any(len(c)<40 or len(c)>1500 or not c.endswith(".") for c in quotes):errors.append("cada cita literal es una o varias oraciones completas del resumen, de 40 a 1500 caracteres")
 return errors
def summary_print(r):
 """Huella del texto publicado de un resumen: cambia si una corrección lo toca."""
 import hashlib
 return hashlib.sha256("\n".join(published_text(r)).encode("utf-8")).hexdigest()[:16]
def question_missing_errors(text,entry,r):
 """Motivos por los que un «el resumen no informa…» NO puede publicarse: forma, o el resumen cambió desde que se anotó."""
 t=str(text or "").strip();errors=[]
 if len(t)<10 or len(t)>300 or not t[0].islower() or t.endswith(".") or "<" in t or "\n" in t or QUESTION_ADVICE.search(t):errors.append("sin_dato completa la frase «El resumen de X no informa …»: empieza en minúscula, sin punto final, 300 caracteres como máximo y sin juicios")
 if entry.get("huella")!=summary_print(r):errors.append("el resumen cambió desde que se anotó que no daba este dato (o falta la huella)")
 return errors
def question_entry_text(axis,entry,label,r,labels=()):
 """(texto publicable, motivos). Lo que no pasa las guardas no se publica."""
 if "sin_dato" in entry:
  errors=question_missing_errors(entry["sin_dato"],entry,r)
  return (None,errors) if errors else (f"El resumen de {label} no informa {entry['sin_dato'].strip()}.",[])
 if axis_type(axis)=="literal":
  errors=question_literal_errors(entry["cita"],r)
  # Al quitar las etiquetas del resumen quedan espacios sueltos ante la puntuación: se limpian solo al mostrar la cita.
  return (None,errors) if errors else (" ".join("«"+re.sub(r"\(\s+","(",re.sub(r"\s+([.,;:)])",r"\1",c))+"»" for c in question_quotes(entry["cita"])),[])
 errors=question_sentence_errors(entry["frase"],label,r,labels,entry["cita"],axis_type(axis),axis.get("max",500))
 return (None,errors) if errors else (entry["frase"].strip(),[])
def question_texts(q,trials=None):
 """Lo publicable de cada ensayo y eje {(id, clave): texto} y lo que se omite [(id, clave, motivos)]."""
 core=question_core(q,trials);labels=[trial_label(r,n) for n,r in core];texts={};dropped=[]
 for axis in q["ejes"]:
  for (n,r),label in zip(core,labels):
   entry=n["diseno"].get(axis["clave"])
   if not entry:continue
   text,errors=question_entry_text(axis,entry,label,r,labels)
   if errors:dropped.append((n["id"],axis["clave"],errors))
   elif text:texts[(n["id"],axis["clave"])]=text
 return texts,dropped
def question_design(q,trials=None):
 """«Cómo leerlos juntos»: frases publicables por eje, en el orden de la página [(clave, entrada, [frases])], y todo lo omitido con su motivo."""
 texts,dropped=question_texts(q,trials);shown=[]
 for axis in q["ejes"]:
  if axis_place(axis)!="juntos":continue
  ok=[texts[(n["id"],axis["clave"])] for n,_ in question_core(q,trials) if (n["id"],axis["clave"]) in texts]
  if ok:shown.append((axis["clave"],axis["entrada"].strip(),ok))
 return shown,dropped
def question_sections(r):
 """Secciones del resumen breve que la ficha muestra completas y literales: [(título, html)]. Sin texto nuevo: es lo ya publicado."""
 found={}
 for m in re.finditer(r"<h2>\s*([^<]+?)\s*</h2>(.*?)(?=<h2>|$)",str(r.get("corto") or ""),re.S):
  body=re.sub(r"\s+"," ",re.sub(r"</?p[^>]*>"," ",m.group(2))).strip()
  if re.search(r"<(?!/?strong>)",body):body=esc(plain(body))
  if m.group(1) in QUESTION_SECTIONS and body:found[m.group(1)]=body
 return [(k,found[k]) for k in QUESTION_SECTIONS if k in found]
# Rótulos de interfaz de los ejes (no son texto clínico): la pestaña de «Cómo leerlos juntos» y el apartado de la ficha.
# Un eje puede fijar el suyo con `rotulo` en preguntas-clinicas.json.
QUESTION_AXIS_LABELS={"intervencion":"Intervención","comparador":"Comparador","poblacion":"Población","desenlace":"Desenlace primario","tamano":"Tamaño",
 "pacientes":"A quién se incluyó","separacion":"Cómo se separaron las estrategias","limitacion":"Limitación principal","no_informa":"Lo que el resumen no informa"}
def axis_label(a):return (a.get("rotulo") or QUESTION_AXIS_LABELS.get(a["clave"]) or a["clave"].replace("_"," ").capitalize()).strip()
def question_notes(q,n,texts):
 """Apartados de la ficha de un ensayo: [(grupo, rótulo, texto)]. El grupo es la entrada del eje («Para interpretarlo»); el rótulo, el del eje."""
 return [(axis["entrada"].strip().rstrip("."),axis_label(axis),texts[(n["id"],axis["clave"])]) for axis in q["ejes"] if axis_place(axis)=="ficha" and texts.get((n["id"],axis["clave"]))]
def question_anchor(id):return f"ensayo-{int(id)}"
def question_timeline(q,core,base="",label="Ensayos en orden cronológico"):
 """Línea de tiempo de los ensayos del núcleo (año, sigla y revista); cada punto enlaza a la ficha del ensayo en la página de la pregunta."""
 return (f'<nav class="ev-q-line" aria-label="{esc(label)}">'+"".join(f'<a class="ev-q-t" href="{base}#{question_anchor(n["id"])}"><small>{esc(r["anio"])}</small><i></i><b>{esc(trial_label(r,n))}</b><span>{esc(r["revista"])}</span></a>' for n,r in core)+'</nav>')
def question_css():
 """Hoja propia de las preguntas clínicas (su página y la sección de la portada), fuera del runtime único. Lleva en su URL la huella de su contenido."""
 import hashlib
 return '<link rel="stylesheet" href="/ui/preguntas.css?v='+hashlib.sha256((ROOT/"ui/preguntas.css").read_bytes().replace(b"\r\n",b"\n")).hexdigest()[:12]+'">'
def question_cover(items):
 """Sección de la portada: una tarjeta por pregunta clínica, con la línea de tiempo de sus ensayos. No muestra hallazgos: esos van en la página, junto a sus límites."""
 qs=load_questions()
 if not qs:return ""
 trials={trial_id(r["id"]):r for r in items}
 def card(q):
  core=question_core(q,trials);route=question_route(q)
  return (f'<article class="ev-q-card"><div class="ev-q-card-head"><h3><a class="ev-q-title" href="{route}">{esc(q["pregunta"])}</a></h3><a class="ev-q-read" href="{route}">Ver los {len(core)} ensayos{icon("arrow-right")}</a></div>'
   +question_timeline(q,core,route,"Ensayos: "+q["nombre"])+'</article>')
 return ('<section class="ev-q ev-q-home" aria-labelledby="ev-q-h"><div class="ev-archive-head"><h2 id="ev-q-h">Preguntas clínicas</h2><p class="ev-count">Los ensayos resumidos sobre una misma pregunta</p></div>'
  +"".join(card(q) for q in qs)+'</section>')
def question_block(r,manifest):
 """Enlazado entre ensayos: el de núcleo enlaza su pregunta y a los otros del núcleo; el relacionado, solo la pregunta.
 Los enlaces van en su propia fila (.ev-method-links): dentro de una frase, el alto mínimo de pulsación la partiría."""
 id=int(trial_id(r["id"])) if trial_id(r["id"]).isdigit() else None;out=""
 for q in load_questions():
  link=f'<span class="ev-method-links"><a href="{question_route(q)}">{esc(q["pregunta"])}</a></span>'
  if id in question_ids(q):
   others="".join(f'<a href="{esc(manifest[trial_id(x["id"])]["path"])}">{esc(x["titulo"])}</a>' for _,x in question_core(q) if int(trial_id(x["id"]))!=id)
   out+=f'<div class="ev-method" data-ev-question="nucleo"><span class="ev-original-label">Pregunta clínica</span>{link}<span>Otros ensayos de esta pregunta:</span><span class="ev-method-links">{others}</span></div>'
  elif any(id in g["ids"] for g in q["relacionados"]):
   out+=f'<div class="ev-method" data-ev-question="relacionado"><span class="ev-original-label">Ver también</span><span>Pregunta clínica relacionada con este ensayo:</span>{link}</div>'
 return out
def question_links(area):
 """Los hubs de especialidad enlazan sus preguntas clínicas."""
 qs=[q for q in load_questions() if q["area"]==area]
 if not qs:return ""
 return '<div class="ev-method" data-ev-questions><span class="ev-original-label">Preguntas clínicas</span><span class="ev-method-links">'+"".join(f'<a href="{question_route(q)}">{esc(q["pregunta"])}</a>' for q in qs)+'</span></div>'
def question_schema(q,core,manifest,description):
 route=question_route(q);hub=QUESTION_AREAS[q["area"]]
 def study(r):
  s={"@type":"ScholarlyArticle","name":plain(r["titulo"]),"url":BASE+manifest[trial_id(r["id"])]["path"]};doi=plain(r.get("doi")).strip()
  if re.fullmatch(r"10\.\d{4,9}/\S+",doi):s["identifier"]={"@type":"PropertyValue","propertyID":"DOI","value":doi};s["sameAs"]=f"https://doi.org/{doi}"
  return s
 return {"@context":"https://schema.org","@graph":[
  {"@type":"Article","headline":q["pregunta"],"description":description,"inLanguage":"es-MX","mainEntityOfPage":BASE+route,"url":BASE+route,
   "datePublished":q["fecha_publicacion"],"dateModified":q["fecha_revision"],"author":{"@type":"Organization","name":"Editorial EMEICRÍTICA","url":f"{BASE}/equipo-editorial/"},
   "publisher":PUBLISHER,"image":f"{BASE}/logo.png","about":{"@type":"MedicalCondition","name":q["condicion"]},"isBasedOn":[study(r) for r in core]},
  {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Inicio","item":f"{BASE}/"},{"@type":"ListItem","position":2,"name":q["area"],"item":BASE+hub},{"@type":"ListItem","position":3,"name":q["nombre"],"item":BASE+route}]}]}
def question_page(q,items,manifest):
 """Página de una pregunta clínica: una ficha por ensayo del núcleo con sus campos publicados, las diferencias de diseño
 («Cómo leerlos juntos», compuestas con las frases publicables de cada ensayo) y los vecinos."""
 trials={trial_id(r["id"]):r for r in items};route=question_route(q);hub=QUESTION_AREAS[q["area"]];core=question_core(q,trials);texts,_=question_texts(q,trials)
 def ficha(n,r):
  # Las fichas van siempre todas a la vista. Izquierda: lo que preguntó y lo que halló; derecha: lo necesario para interpretarlo.
  path=esc(manifest[trial_id(r["id"])]["path"]);label=esc(trial_label(r,n));notes="";group=None
  for g,k,v in question_notes(q,n,texts):
   if g!=group:notes+=f'<h4>{esc(g)}</h4>';group=g
   notes+=f'<h5>{esc(k)}</h5><p>{esc(v)}</p>'
  sections="".join(f'<h4>{esc(k)}</h4><p>{v}</p>' for k,v in question_sections(r))
  return (f'<section class="ev-q-card" id="{question_anchor(n["id"])}"><div class="ev-q-card-head"><h3><a href="{path}">{label}</a> <span>· {esc(r["revista"])}, {esc(r["anio"])}</span></h3>'
   f'<a class="ev-q-read" href="{path}">Leer el resumen de {label}{icon("arrow-right")}</a></div>'
   f'<div class="ev-q-cols"><div><h4>Qué preguntó</h4><p>{esc(r["objetivo"])}</p><div class="ev-q-finding"><h4>Hallazgo principal</h4><p>{r["hallazgo"]}</p></div>{sections}</div>'
   f'<div class="ev-q-notes">{notes}</div></div></section>')
 # Cada vecino va solo en su elemento de lista: un enlace dentro de una frase justificada partiría la línea.
 related="".join('<section><h3>'+esc(g["motivo"])+'</h3><ul>'+"".join(f'<li><a href="{esc(manifest[trial_id(i)]["path"])}">{esc(question_trial(q,i,trials)["titulo"])}</a></li>' for i in g["ids"])+'</ul></section>' for g in q["relacionados"])
 # «Cómo leerlos juntos»: un panel por eje con una fila por ensayo. Las pestañas son botones de opción sin JavaScript;
 # donde el navegador no admite :has(), ui/preguntas.css deja todos los paneles a la vista.
 design=[(a,[(n,r,texts[(n["id"],a["clave"])]) for n,r in core if (n["id"],a["clave"]) in texts]) for a in q["ejes"] if axis_place(a)=="juntos"];design=[d for d in design if d[1]]
 tabs="".join(f'<label class="ev-q-tab"><input type="radio" name="ev-q-eje"{" checked" if i==0 else ""}><span>{esc(axis_label(a))}</span></label>' for i,(a,_) in enumerate(design))
 panels="".join(f'<section class="ev-q-panel"><h3>{esc(axis_label(a))}</h3>'+(f'<p class="ev-q-lead">{esc(a["entrada"].strip())}</p>' if a["entrada"].strip() else '')
  +"".join(f'<div class="ev-q-row"><b>{esc(trial_label(r,n))}{"" if trial_label(r,n).endswith(str(r["anio"])) else f' <small>{esc(r["anio"])}</small>'}</b><p>{esc(t)}</p></div>' for n,r,t in rows)+'</section>' for a,rows in design)
 together=f'<div class="ev-q-cmp"><div class="ev-q-tabs" role="radiogroup" aria-label="Aspecto del diseño">{tabs}</div>{panels}</div>'
 content=(f'<p>{QUESTION_CONTEXT}</p><h2 class="ev-sr">Los ensayos</h2>'+question_timeline(q,core)+"".join(ficha(n,r) for n,r in core)+(f'<h2>Cómo leerlos juntos</h2>{together}' if design else '')
  +(f'<h2>Ver también</h2><div class="ev-q-rel">{related}</div>' if related else ''))
 years=sorted({str(r["anio"]) for _,r in core});span=years[0] if len(years)==1 else f"{years[0]} a {years[-1]}"
 dates=f'{len(core)} ensayos resumidos · {esc(span)} · Publicado el <time datetime="{q["fecha_publicacion"]}">{esc(human_date(q["fecha_publicacion"]))}</time>'+(f' · Revisado el <time datetime="{q["fecha_revision"]}">{esc(human_date(q["fecha_revision"]))}</time>' if q["fecha_revision"]!=q["fecha_publicacion"] else '')
 body=(f'<div class="ev-doc ev-doc-text ev-q" data-ev-question-page><nav class="ev-breadcrumb" aria-label="Ruta"><a href="{hub}">{icon("arrow-left")}{esc(q["area"])}</a></nav>'
  f'<h1>{esc(q["pregunta"])}</h1><p class="ev-doc-date">{dates}</p><article class="ev-prose">{content}</article>{QUESTION_NOTE}</div>')
 description=question_description(q,trials)
 return document(simple_head(q["pregunta"]+" | Resúmenes Trials",description,route,question_schema(q,[r for _,r in core],manifest,description),"article"),body,route)
def editorial_dates(r):
 values=[("fecha_publicacion_resumen","Publicado en Resúmenes Trials"),("fecha_revision","Última revisión")]
 parts=[EDITORIAL_SIGNATURE]
 for key,label in values:
  value=r.get(key) or (r.get("actualizado") if key=="fecha_revision" else "")
  if value:parts.append(f'<span>{label}: <time datetime="{esc(value)}">{esc(human_date(value))}</time></span>')
 return '<div class="ev-editorial-dates">'+" · ".join(parts)+'</div>'

# Transparencia editorial: auditoria-editorial.json es una fuente que las rutinas locales
# regeneran a diario. Es opcional: si falta, no es válido o un ID no aparece, no se muestra
# aviso ni fe de erratas. Todo valor se valida y se escapa; nunca se confía en sus tipos.
AUDIT_PATH=ROOT/"auditoria-editorial.json"
SEVERITIES=(("CRÍTICO","Críticos"),("MAYOR","Mayores"),("MENOR","Menores"))
CORRECTIONS_LINK='<a href="/correcciones/">Política de correcciones</a>'
def _audit_id(value):
 if isinstance(value,bool):return None
 if isinstance(value,int):return str(value) if value>=0 else None
 if isinstance(value,str) and re.fullmatch(r"\s*\d+\s*",value):return str(int(value))
 return None
def _audit_ids(value):return {i for i in map(_audit_id,value) if i} if isinstance(value,list) else set()
def _audit_count(value):return value if isinstance(value,int) and not isinstance(value,bool) and value>=0 else None
def _audit_date(value):
 import datetime
 if not isinstance(value,str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",value):return ""
 try:datetime.date.fromisoformat(value)
 except ValueError:return ""
 return value
def _audit_text(value):return re.sub(r"\s+"," ",value).strip() if isinstance(value,str) else ""
def parse_audit(data):
 """Normaliza el contenido de auditoria-editorial.json (schema_version 1); None si no es utilizable."""
 if not isinstance(data,dict) or data.get("schema_version")!=1:return None
 archivo=data.get("archivo") if isinstance(data.get("archivo"),dict) else {}
 errores=data.get("errores_abiertos") if isinstance(data.get("errores_abiertos"),dict) else None
 sin_auditar=_audit_ids(data.get("sin_auditar"));con_errores=_audit_ids(data.get("con_errores_abiertos"))
 corrections=[]
 for entry in data.get("correcciones") if isinstance(data.get("correcciones"),list) else []:
  if not isinstance(entry,dict):continue
  id=_audit_id(entry.get("id"));fecha=_audit_date(entry.get("fecha"));texto=_audit_text(entry.get("texto"))
  if id and fecha and texto:corrections.append({"id":id,"fecha":fecha,"texto":texto})
 # Más recientes primero; las entradas de la misma fecha conservan el orden del archivo.
 corrections.sort(key=lambda c:c["fecha"],reverse=True)
 return {"actualizado":_audit_date(data.get("actualizado")),"estandar":_audit_text(data.get("estandar")),
  "total":_audit_count(archivo.get("total")),"auditados":_audit_count(archivo.get("auditados")),
  "sin_auditar":sin_auditar,"con_errores":con_errores,"en_revision":_audit_ids(data.get("en_revision"))|sin_auditar|con_errores,
  "errores":{key:_audit_count(errores.get(key)) for key,_ in SEVERITIES} if errores is not None else None,
  "correcciones":corrections}
def load_audit(path=None):
 path=Path(path) if path else AUDIT_PATH
 try:return parse_audit(json.loads(path.read_text(encoding="utf-8")))
 except (OSError,ValueError):return None
_AUDIT_CACHE={}
def audit():
 """Auditoría vigente, leída una vez por proceso y por versión del archivo."""
 try:key=AUDIT_PATH.stat().st_mtime_ns
 except OSError:key=None
 if key not in _AUDIT_CACHE:_AUDIT_CACHE.clear();_AUDIT_CACHE[key]=load_audit() if key is not None else None
 return _AUDIT_CACHE[key]
def audit_notice(id,data):
 if not data:return ""
 id=_audit_id(id)
 if id in data["con_errores"]:
  text="nuestro equipo de verificación encontró datos que estamos corrigiendo.";state="errores"
 elif id in data["sin_auditar"]:
  standard=f'de {esc(data["estandar"])}' if data["estandar"] else "vigente"
  text=f"lo estamos auditando con nuestro estándar editorial {standard}. Si encontramos algún error, lo corregiremos y lo indicaremos en esta página.";state="revision"
 else:return ""
 return f'<aside class="ev-audit" data-ev-audit="{state}" aria-label="Estado de revisión del resumen"><p><strong>Resumen en revisión:</strong> {text}</p>{CORRECTIONS_LINK}</aside>'
def audit_errata(id,data):
 id=_audit_id(id)
 entries=[c for c in data["correcciones"] if c["id"]==id] if data and id else []
 if not entries:return ""
 items="".join(f'<li>Corregido el <time datetime="{c["fecha"]}">{esc(human_date(c["fecha"]))}</time>. {esc(c["texto"])}</li>' for c in entries)
 return f'<section class="ev-errata" aria-labelledby="ev-errata-title"><h2 id="ev-errata-title">Fe de erratas</h2><ul>{items}</ul><p>{CORRECTIONS_LINK}</p></section>'

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
NAV=[("/","Edición actual"),("/medicina-critica/","Medicina Crítica"),("/medicina-interna/","Medicina Interna"),("/mapa/","Mapa de evidencia"),("/archivo/","Archivo")]
MEMBER=[("/biblioteca.html","Mi biblioteca"),("/cuenta.html","Cuenta")]
INFO=[("/metodologia/","Metodología"),("/correcciones/","Correcciones"),("/equipo-editorial/","Editorial"),("/privacidad/","Privacidad"),("/terminos/","Términos")]
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
 if route.startswith("/preguntas/") or (route=="/" and load_questions()):head+=question_css()
 if route not in EXCLUDED and route!="/resumen.html" and not route.startswith("/resumen/"):head+=ADSENSE_SCRIPT
 mode="list" if kind=="archive" or route=="/biblioteca.html" else "quick"
 return '<!DOCTYPE html><html lang="es-MX"><head>'+head+'</head><body class="'+("ev-reader" if kind=="reader" else "ev-"+kind)+'" data-ev-search-mode="'+mode+'"><div class="ev-aurora" aria-hidden="true"></div>'+header(route=="/")+'<main id="ev-main" class="ev-main" tabindex="-1">'+body+'</main>'+footer(route=="/")+dialogs()+scripts+f'<script src="/site-runtime.js?v={version()}" defer></script></body></html>\n'
FACTS=[("revista","Revista"),("anio","Año"),("fecha","Fecha"),("tipo_estudio","Tipo de estudio"),("especialidad_principal","Especialidad"),("especialidad_secundaria","Especialidad secundaria"),("temas","Temas"),("registro","Registro"),("doi","DOI"),("financiacion","Financiación")]
LONG_FACTS=("tipo_estudio","temas","financiacion")
def facts(r):
 return '<dl class="ev-study-facts">'+''.join(f'<div{' class="ev-fact-long"' if key in LONG_FACTS else ''}><dt>{label}</dt><dd data-ev-field="{key}">{esc("\u00a0· ".join(map(str,r[key])) if isinstance(r.get(key),list) else r.get(key))}</dd></div>' for key,label in FACTS if r.get(key) not in ("",None,[]))+'</dl>'
def card(r,manifest,sub="",hidden=False):
 """Tarjeta de un resumen. `sub` (portada y ediciones) deja ya en el HTML la etiqueta de subespecialidad que en el
 archivo añade ui/archive.js; `hidden` la deja oculta hasta que «Ver más» la muestra."""
 id=trial_id(r["id"]);path=esc(manifest[id]["path"]);area=area_of(r);t=esc(r["titulo"]);topics=" · ".join(r.get("temas") or [])
 topics_attr=f' data-ev-topics="{esc(topics)}"' if topics else ''
 tag=f'<span class="ev-tag" data-ev-subspecialty="true" data-sub="{SUB_TONE.get(sub,"otra")}">{esc(sub)}</span>' if sub else ''
 return (f'<li class="ev-card" data-id="{id}" data-tone="{tone(area)}"{topics_attr}{" hidden" if hidden else ""}><a class="ev-card-title" href="{path}" data-ev-read="{id}"><h2>{t}</h2></a>'
  f'<p class="ev-card-meta"><span>{esc(r["revista"])}</span><span>{esc(human_date(r["fecha"]))}</span></p>'
  f'<div class="ev-card-tags"><span class="ev-area" data-tone="{tone(area)}">{esc(area)}</span>{tag}</div>'
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
# Texto de cada especialidad y subtema (fuente editorial: templates/textos-temas.json). Va al final de la página,
# debajo del listado y bajo el rótulo «Sobre esta sección»: quien llega busca primero los ensayos.
def topic_intro(scope):
 texts=json.loads((ROOT/"templates/textos-temas.json").read_text(encoding="utf-8"))
 text=texts.get(str(scope).strip("/"))
 return f'<section class="ev-about" aria-labelledby="ev-about-h"><h2 id="ev-about-h" class="ev-eyebrow ev-ed-label">Sobre esta sección</h2><p class="ev-topic-intro">{esc(text)}</p></section>' if text else ''
def archive(items,manifest,title="Archivo de evidencia",scope=""):
 import generar_seo as base
 from collections import Counter
 crit=sum(1 for r in items if "Medicina Crítica" in base.categorias(r));inter=sum(1 for r in items if "Medicina Interna" in base.categorias(r))
 if not scope:
  hero=('<section class="ev-hero"><div class="ev-hero-copy"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/">'+icon("arrow-left")+'Edición actual</a></nav><p class="ev-eyebrow">Todos los resúmenes</p>'
   '<h1>Archivo</h1></div></section>')
 else:
  kind="Especialidad" if scope in ("medicina-critica","medicina-interna") else "Subtema"
  hero=f'<section class="ev-hero"><div class="ev-hero-copy"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/">{icon("arrow-left")}Inicio</a></nav><p class="ev-eyebrow">{kind}</p><h1>{esc(title)}</h1></div></section>'
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
  '<button id="ev-more" type="button" class="ev-btn ev-more" hidden>Mostrar más</button></section>'+(question_links(title) if scope in ("medicina-critica","medicina-interna") else '')+(topic_intro(scope) if scope else ''))
# ---------- Ediciones semanales y portada ----------
SUB_TONE={"Cardiología":"cardio","Endocrinología":"endo","Neurología":"neuro","Nefrología":"nefro","Neumología":"neumo","Infectología":"infecto","Enfermedades Infecciosas":"infecto","VIH":"infecto","Gastroenterología":"gastro","Oncología":"onco","Hematología":"onco"}
def published(items):
 """Orden de publicación en el sitio: primero lo último publicado (fecha_publicacion_resumen; empate: id más alto).

 Un resumen sin fecha de publicación válida va al final. scripts/editions.mjs repite la regla para las pruebas.
 """
 def order(r):
  id=trial_id(r["id"]);d=iso_date(r.get("fecha_publicacion_resumen"))
  return (d.isoformat() if d else "",int(id) if id.isdigit() else 0)
 return sorted(items,key=order,reverse=True)
def editions(items):
 """Una edición por semana ISO (lunes a domingo) según fecha_publicacion_resumen.

 Devuelve [(lunes ISO, ensayos)] de la más antigua a la más reciente. La edición actual es la última
 semana con datos, nunca la fecha de hoy: regenerar el sitio da siempre el mismo resultado. Dentro de
 cada edición van en orden de publicación en el sitio: primero lo último publicado (empate: id más alto).
 Un resumen sin fecha de publicación válida no entra en ninguna edición; sigue en el archivo.
 """
 weeks={}
 for r in items:
  d=iso_date(r.get("fecha_publicacion_resumen"))
  if d:weeks.setdefault((d-timedelta(days=d.weekday())).isoformat(),[]).append(r)
 return [(monday,published(rows)) for monday,rows in sorted(weeks.items())]
def edition_route(monday):return f"/ediciones/{monday}/"
def edition_range(monday,sentence=False):
 """«9–15 de noviembre de 2026»; con sentence=True, «del 9 al 15 de noviembre de 2026»."""
 a=date.fromisoformat(monday);b=a+timedelta(days=6)
 end=f"{b.day} de {MONTHS[b.month-1]} de {b.year}"
 start=str(a.day)+("" if a.month==b.month else f" de {MONTHS[a.month-1]}"+("" if a.year==b.year else f" de {a.year}"))
 if sentence:return f"del {start} al {end}"
 return f"{start}–{end}" if a.month==b.month else f"{start} – {end}"
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
FEED_PAGE=12  # Tarjetas a la vista en la portada y en cada edición; «Ver más» muestra otras tantas (ui/core.js).
def feed(rows,manifest):
 """Tarjetas en el orden recibido. Todas van en el HTML (cada ensayo queda enlazado sin JavaScript); a partir de la
 decimotercera salen ocultas y «Ver más» las va mostrando. Sin JavaScript, «Ver más» lleva al archivo."""
 subs=map_subs(rows)
 more='<a class="ev-btn ev-more" href="/archivo/" data-ev-feed-more>Ver más</a>' if len(rows)>FEED_PAGE else ''
 return '<ul class="ev-list" data-ev-feed>'+''.join(card(r,manifest,subs[trial_id(r["id"])],i>=FEED_PAGE) for i,r in enumerate(rows))+'</ul>'+more
def cover(items,manifest,monday=None):
 """Portada: navegador de ediciones, rótulo de la semana y tarjetas en orden de publicación; después las preguntas
 clínicas (solo en /) y la franja del mapa. Sin `monday`, la edición actual (ruta /), que muestra todos los resúmenes
 publicados; con `monday`, una edición anterior, que muestra los de su semana."""
 eds=editions(items)
 if not eds:return '<div class="ev-doc"><p class="ev-eyebrow">Edición actual</p><h2>Todavía no hay una edición semanal</h2><div class="ev-actions-row"><a class="ev-btn ev-btn-primary" href="/archivo/">Ir al archivo</a></div></div>'
 home=monday is None;index=len(eds)-1 if home else [m for m,_ in eds].index(monday);monday,rows=eds[index]
 label=(f'<p class="ev-eyebrow ev-ed-label">Edición actual · {edition_range(monday)}</p>' if home
  else f'<div class="ev-ed-top"><h1 class="ev-eyebrow ev-ed-label">Edición anterior · {edition_range(monday)}</h1><a href="/">Volver a la edición actual</a></div>')
 return (f'<section class="ev-ed" data-ev-edition="{monday}">'+edition_nav(eds,index)+label+feed(published(items) if home else rows,manifest)
  # Ancla de «Para ti» (recommendations.js): solo en la portada, debajo de las tarjetas.
  +('<div data-ev-recs></div>' if home else '')+'</section>'+(question_cover(items) if home else '')+map_band(items))
# ---------- Mapa de evidencia ----------
# Un punto por resumen. Columnas: el año del artículo (todo lo anterior a 2010 en una sola). Filas: los ensayos de
# Medicina Crítica por subtema (seo-cluster-manifest.json; si un ensayo está en varios, el de menos ensayos; en ninguno,
# «Otros temas») y los de Medicina Interna por subespecialidad inferida, la misma etiqueta que muestra el archivo
# (campo _sub de datos/indice.json, que escribe scripts/build-site-runtime.mjs con specialty-classification.js).
# scripts/evidence-map.mjs repite la regla para las pruebas.
MAP_JOURNALS=("NEJM","JAMA","Critical Care","Intensive Care Med","Lancet")
MAP_MIN_ROW=5  # Una subespecialidad con menos ensayos comparte la fila «Otras subespecialidades».
MAP_TONES=(("critica","Medicina Crítica"),("cardio","Cardiología"),("endo","Endocrinología"),("neuro","Neurología"),("nefro","Nefrología"),("neumo","Neumología"),("infecto","Infectología"),("gastro","Gastroenterología"),("onco","Oncología y hematología"),("interna","Medicina Interna"),("otra","Otras subespecialidades"))
def map_bins(items):
 """Columnas: «2000–09» para todo lo anterior a 2010 y después una por año hasta el último con datos."""
 return ["2000–09"]+[str(y) for y in range(2010,max((int(r["anio"]) for r in items),default=2009)+1)]
def map_bin(r):return max(0,int(r["anio"])-2009)
def map_count(n):return "1 ensayo" if n==1 else f"{n} ensayos"
def map_subs(items):
 """Subespecialidad inferida por id. El índice ligero es el primer paso de la generación; si no está al día, se detiene."""
 p=ROOT/"datos/indice.json"
 subs={trial_id(r["id"]):str(r.get("_sub") or "") for r in json.loads(p.read_text(encoding="utf-8"))} if p.exists() else {}
 missing=[trial_id(r["id"]) for r in items if trial_id(r["id"]) not in subs]
 if missing:raise ValueError("datos/indice.json no incluye los resúmenes "+", ".join(missing)+": ejecuta antes node scripts/build-site-runtime.mjs")
 return subs
def map_tone(r,subs):
 """Color del punto: Medicina Crítica, el tono de la subespecialidad o, sin subespecialidad, Medicina Interna."""
 if area_of(r)=="Medicina Crítica":return "critica"
 sub=subs[trial_id(r["id"])]
 return SUB_TONE.get(sub,"otra") if sub else "interna"
def map_rows(items,clusters,subs):
 """Filas por tema: [(clave, nombre, área, ensayos)]. Medicina Crítica primero; en cada área, de más a menos ensayos y la fila «Otros…» al final."""
 from collections import Counter
 import unicodedata
 topics=[(slug,c["name"],set(map(str,c["trial_ids"]))) for slug,c in clusters.items() if c.get("category")=="Medicina Crítica"]
 critical=lambda r:area_of(r)=="Medicina Crítica"
 count=Counter(subs[trial_id(r["id"])] for r in items if not critical(r));rows={}
 for r in items:
  id=trial_id(r["id"])
  if critical(r):
   mine=sorted((len(ids),n) for n,(_,_,ids) in enumerate(topics) if id in ids)
   key,name=("c:"+topics[mine[0][1]][0],topics[mine[0][1]][1]) if mine else ("c:otros","Otros temas")
  else:
   sub=subs[id]
   key,name=("i:"+sub,sub) if sub and count[sub]>=MAP_MIN_ROW else ("i:otras","Otras subespecialidades")
  rows.setdefault(key,(name,[]))[1].append(r)
 fold=lambda text:re.sub("[̀-ͯ]","",unicodedata.normalize("NFD",text)).lower()
 return sorted(((k,n,"Medicina Crítica" if k[0]=="c" else "Medicina Interna",rs) for k,(n,rs) in rows.items()),key=lambda x:(x[0][0]!="c",x[0] in ("c:otros","i:otras"),-len(x[3]),fold(x[1])))
def evidence_map(items,manifest,clusters):
 """Cuerpo de /mapa/. La vista por tema va completa en el HTML; map-page.js reagrupa, filtra, resalta y abre el panel."""
 subs=map_subs(items);bins=map_bins(items);rows=map_rows(items,clusters,subs)
 def order(r):
  id=trial_id(r["id"])
  return (str(r["fecha"]).strip() if iso_date(r.get("fecha")) else "",int(id) if id.isdigit() else 0)
 journal=lambda r:MAP_JOURNALS.index(r["revista"]) if r.get("revista") in MAP_JOURNALS else len(MAP_JOURNALS)
 # Los puntos son decorativos: el control es la casilla (fila × año), un botón con nombre accesible.
 def cell(name,b,rs):
  if not rs:return "<td></td>"
  return (f'<td><button type="button" class="ev-map-cell" aria-pressed="false" aria-label="{esc(name)}, {bins[b]}: {map_count(len(rs))}">'
   +"".join(f'<i data-id="{trial_id(r["id"])}" data-sub="{map_tone(r,subs)}" data-j="{journal(r)}"></i>' for r in sorted(rs,key=order))+'</button></td>')
 body="".join(f'<tr data-ev-row="{esc(key)}"><th scope="row">{esc(name)}<small>{area} · {map_count(len(rs))}</small></th>'
  +"".join(cell(name,b,[r for r in rs if map_bin(r)==b]) for b in range(len(bins)))+'</tr>' for key,name,area,rs in rows)
 seg=lambda name,label,options:(f'<div><span class="ev-quick-label" id="ev-map-{name}-l">{label}</span><div class="ev-segment" role="radiogroup" aria-labelledby="ev-map-{name}-l">'
  +"".join(f'<label><input type="radio" name="ev-map-{name}" value="{v}"{"" if i else " checked"}><span>{l}</span></label>' for i,(v,l) in enumerate(options))+'</div></div>')
 # «Resaltar» es un campo de texto, no de búsqueda: el único buscador de la página sigue siendo el de la cabecera.
 controls=('<div class="ev-map-ctl">'+seg("area","Especialidad",[("","Todas"),("c","Medicina Crítica"),("i","Medicina Interna")])+seg("rows","Filas",[("tema","Por tema"),("revista","Por revista")])
  +'<div><label class="ev-quick-label" for="ev-map-hl">Resaltar</label><input id="ev-map-hl" type="text" placeholder="Fármaco, enfermedad o ensayo" autocomplete="off" autocapitalize="none" spellcheck="false"></div></div>'
  '<p id="ev-map-status" class="ev-status" role="status"></p>')
 present={map_tone(r,subs) for r in items}
 legend='<ul class="ev-map-legend" aria-label="Colores">'+"".join(f'<li><i data-sub="{t}"></i>{l}</li>' for t,l in MAP_TONES if t in present)+'</ul>'
 paths=json.dumps({trial_id(r["id"]):manifest[trial_id(r["id"])]["path"] for r in items},ensure_ascii=False,separators=(",",":")).replace("</","<\\/")
 hero=('<section class="ev-hero"><div class="ev-hero-copy"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/">'+icon("arrow-left")+'Edición actual</a></nav><p class="ev-eyebrow">Todo el archivo</p><h1>Mapa de evidencia</h1>'
  '<p class="ev-lead ev-intro">Cada punto es un ensayo resumido. Las columnas son el año del artículo; las filas, el tema, la subespecialidad o la revista; el color, la especialidad. Elige una casilla para ver sus ensayos.</p></div></section>')
 return (hero+f'<section class="ev-map" id="ev-mapa" data-ev-map data-ev-journals="{esc(json.dumps([*MAP_JOURNALS,"Otras revistas"],ensure_ascii=False))}">'+controls
  +'<div class="ev-map-scroll"><table><caption class="ev-sr">Ensayos resumidos por fila y año del artículo</caption><thead><tr><td></td>'+"".join(f'<th scope="col">{b}</th>' for b in bins)+'</tr></thead><tbody>'+body+'</tbody></table></div>'
  +legend+'<div id="ev-map-panel" class="ev-map-panel" hidden></div><script type="application/json" id="ev-map-paths">'+paths+'</script></section>')
def map_band(items):
 """Franja de la portada: miniatura estática del mapa (un punto por resumen, apilados por año y coloreados por área)."""
 bins=map_bins(items);columns=[[] for _ in bins]
 for r in items:columns[map_bin(r)].append(area_of(r)=="Medicina Crítica")
 mini="".join('<span>'+''.join('<i data-sub="critica"></i>' if critical else '<i></i>' for critical in sorted(column,reverse=True))+f'</span><small>{label}</small>' for label,column in zip(bins,columns))
 return ('<section class="ev-band" aria-labelledby="ev-band-h"><div class="ev-archive-head"><h2 id="ev-band-h">Mapa de evidencia</h2><p class="ev-count">Cada punto es un ensayo resumido, colocado en el año en que se publicó el artículo.</p></div>'
  '<a class="ev-mini" href="/mapa/" aria-label="Abrir el mapa de evidencia">'+mini+'</a>'
  '<ul class="ev-map-legend"><li><i data-sub="critica"></i>Medicina Crítica</li><li><i data-sub="interna"></i>Medicina Interna</li></ul>'
  '<div class="ev-actions-row"><a class="ev-btn" href="/mapa/">Explorar el mapa</a></div></section>')
def map_script():
 """El módulo de la página lleva en su URL la huella de su contenido: un cambio en map-page.js renueva la caché."""
 import hashlib
 return '<script type="module" src="/map-page.js?v='+hashlib.sha256((ROOT/"map-page.js").read_bytes().replace(b"\r\n",b"\n")).hexdigest()[:12]+'"></script>'
def map_page(items,manifest,clusters):
 head=simple_head("Mapa de evidencia | Resúmenes Trials","Mapa de evidencia de Resúmenes Trials: todos los ensayos clínicos resumidos, un punto por ensayo, ordenados por año de publicación y agrupados por tema de Medicina Crítica, subespecialidad de Medicina Interna o revista.","/mapa/",collection_schema("Mapa de evidencia","/mapa/"))
 return document(head,evidence_map(items,manifest,clusters),"/mapa/",scripts=map_script())
def reading(r,manifest,brief=False,legacy=False):
 id=trial_id(r["id"]);body=r["corto" if brief else "cuerpo"];body=re.sub(r"<(?=\d)","&lt;",body)
 route=manifest[id]["path"];full=f"/resumen.html?id={id}" if legacy else route;short=f"/resumen.html?id={id}&amp;v=corto"
 toolbar=(f'<div class="ev-toolbar" role="region" aria-label="Controles de lectura"><div class="ev-version" role="group" aria-label="Versión del resumen"><a href="{full}"'+(' aria-current="page"' if not brief else '')+f'>Completo</a><a href="{short}"'+(' aria-current="page"' if brief else '')+'>Breve</a></div>'
  '<button type="button" class="ev-tool" data-ev-sections>'+icon("list")+'<span>Índice</span></button>'
  '<button type="button" class="ev-tool" data-ev-pdf aria-haspopup="dialog">'+icon("pdf")+'<span>PDF</span></button>'
  '<button type="button" class="ev-tool" data-ev-focus aria-pressed="false">'+icon("read")+'<span>Modo lectura</span></button>'
  '<button type="button" class="ev-tool ev-more-toggle" data-ev-more aria-expanded="false" aria-controls="ev-more-tools">'+icon("more")+'<span>Más</span></button>'
  '<div class="ev-more-tools" id="ev-more-tools"><button type="button" class="ev-tool" data-ev-save>'+icon("bookmark")+'<span>Guardar</span></button><button type="button" class="ev-tool" data-ev-share>'+icon("share")+'<span>Compartir</span></button><button type="button" class="ev-tool" data-ev-font aria-label="Cambiar tamaño de letra">'+icon("text")+'<span>Letra</span></button></div></div>')
 article='<article class="ev-body">'+body+'</article>' if brief or legacy else '<article class="articulo">'+body+'</article>'
 original=(f'<a href="{esc(r["original"])}" target="_blank" rel="noopener noreferrer">{esc(r["original"])}{icon("external")}</a>' if str(r["original"]).startswith("https://") else esc(r["original"]))
 return (f'<section class="ev-reading" data-ev-reader="{id}" data-ev-brief="{str(brief).lower()}"><nav class="ev-breadcrumb" aria-label="Ruta"><a href="/" data-ev-return>{icon("arrow-left")}Volver a la lista</a><a href="/metodologia/">Metodología</a></nav>'
  f'<header class="ev-reading-head">{SIGNAL}<h1 data-ev-field="titulo">{esc(r["titulo"])}</h1>'
  f'<p class="ev-byline"><span data-ev-field="autor">{esc(r["autor"])}</span><span data-ev-field="revista">{esc(r["revista"])}</span><span data-ev-field="fecha">{esc(human_date(r["fecha"]))}</span></p>'
  f'<div class="ev-keyfinding"><p class="ev-keyfinding-label">{icon("spark")}Hallazgo principal</p><p data-ev-field="hallazgo" class="ev-lead">{r["hallazgo"]}</p></div>'
  f'<p class="ev-readtime">{readtime(r)}</p>{editorial_dates(r)}{audit_notice(id,audit())}</header>'
  '<details class="ev-facts" open><summary>Ficha técnica del estudio</summary>'+facts(r)+'</details>'+toolbar+'<progress class="ev-progress" max="100" value="0" aria-label="Progreso de lectura"></progress>'
  '<div class="ev-reader-grid">'+article+'<aside class="ev-rail"><p class="ev-rail-title">En esta página</p><nav data-ev-toc aria-label="Secciones del artículo"></nav></aside></div>'
  f'<div class="ev-endmatter">{audit_errata(id,audit())}{video_block(r,manifest,load_videos()) if not legacy else ""}<p class="ev-original"><span class="ev-original-label">Artículo original</span>{original}</p>{question_block(r,manifest) if not legacy else ""}{METHOD_NOTE}{SUBSCRIBE_NOTE}<nav class="ev-neighbors" aria-label="Continuidad de lectura" data-ev-neighbors></nav><section class="ev-related"><h2>Evidencia relacionada</h2><ul class="ev-list" data-ev-related></ul></section><p class="ev-status" id="ev-reader-status" role="status"></p></div></section>')
def simple_head(title,description,route,schema,og_type="website"):
 canonical=BASE+route
 return ('<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
  f'<title>{esc(title)}</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large">'
  f'<link rel="canonical" href="{canonical}"><meta property="og:type" content="{og_type}"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{BASE}/logo.png">'
  '<link rel="alternate" type="application/atom+xml" title="Resúmenes Trials" href="'+BASE+'/feed.xml">'
  '<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False,separators=(",",":"))+'</script><link rel="icon" href="/favicon.png"></head>')
PUBLISHER={"@type":"Organization","name":"Resúmenes Trials","url":f"{BASE}/equipo-editorial/","logo":{"@type":"ImageObject","url":f"{BASE}/logo.png"}}
def collection_schema(name,route):
 return {"@context":"https://schema.org","@graph":[{"@type":"CollectionPage","name":name,"url":BASE+route,"inLanguage":"es-MX","publisher":PUBLISHER},
  {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Inicio","item":f"{BASE}/"},{"@type":"ListItem","position":2,"name":name,"item":BASE+route}]}]}
def archive_page(items,manifest):
 """Archivo completo: el listado con buscador y filtros que antes ocupaba la portada."""
 head=simple_head("Archivo | Resúmenes Trials","Archivo completo de Resúmenes Trials: todos los resúmenes críticos en español de ensayos clínicos de Medicina Crítica y Medicina Interna, con buscador y filtros por especialidad, tema, año, revista y tipo de estudio.","/archivo/",collection_schema("Archivo de resúmenes","/archivo/"))
 return document(head,archive(items,manifest),"/archivo/","archive")
def edition_page(items,manifest,monday):
 """Página propia de una edición anterior (la actual vive en la portada)."""
 route=edition_route(monday);name="Edición "+edition_range(monday,True)
 description=f"Edición semanal de Resúmenes Trials {edition_range(monday,True)}: resúmenes críticos en español de los ensayos clínicos publicados esa semana."
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
CORRECTIONS_TITLE="Correcciones | Resúmenes Trials"
CORRECTIONS_DESCRIPTION="Política de correcciones de Resúmenes Trials: cómo corregimos los errores confirmados, estado de la auditoría editorial y lista fechada de las correcciones publicadas."
def _plural(n,one,many):return f"{n} {one if n==1 else many}"
def corrections_page(items,manifest,data):
 """Cuerpo de /correcciones/: política, cifras de auditoria-editorial.json y lista completa de correcciones."""
 titles={trial_id(r["id"]):str(r.get("titulo") or "") for r in items if isinstance(r,dict) and "id" in r}
 content=('<h2>Política de correcciones</h2>'
  '<p>Corregimos un resumen en cuanto confirmamos un error. Cada corrección lleva fecha y queda indicada en el propio resumen, en un apartado «Fe de erratas» al final del texto. Los resúmenes que ya compartimos en nuestros canales también se actualizan.</p>'
  '<p>Mientras un resumen no se ha auditado con nuestro estándar editorial vigente, o mientras tiene errores confirmados que todavía estamos corrigiendo, su página lo indica al inicio con el aviso «Resumen en revisión».</p>'
  '<p>Si encuentras un error, escríbenos a <a href="mailto:resumenestrials@outlook.com">resumenestrials@outlook.com</a> con el enlace del resumen y, si puedes, la página o la tabla del artículo donde aparece el dato correcto. Cómo elaboramos y revisamos los resúmenes se explica en la <a href="/metodologia/">metodología</a>.</p>')
 if data:
  figures=[]
  if data["auditados"] is not None and data["total"] is not None:
   standard=f' con el estándar editorial de {esc(data["estandar"])}' if data["estandar"] else ""
   figures.append((f'Resúmenes auditados{standard}',f'{data["auditados"]} de {data["total"]}'))
  figures.append(("Resúmenes en revisión",str(len(data["en_revision"]))))
  dl=lambda pairs:'<dl class="ev-figures">'+"".join(f'<div><dt>{label}</dt><dd>{value}</dd></div>' for label,value in pairs)+'</dl>'
  content+='<h2>Estado de la revisión</h2>'+(f'<p>Datos actualizados al {esc(human_date(data["actualizado"]))}.</p>' if data["actualizado"] else '')+dl(figures)
  if data["errores"] and all(data["errores"][key] is not None for key,_ in SEVERITIES):
   content+='<p>Errores confirmados pendientes de corregir, por gravedad:</p>'+dl([(label,str(data["errores"][key])) for key,label in SEVERITIES])
 entries=data["correcciones"] if data else []
 content+='<h2>Correcciones publicadas</h2>'
 if entries:
  def title(c):
   name=esc(titles.get(c["id"]) or f'Resumen N.º {c["id"]}');path=(manifest.get(c["id"]) or {}).get("path") if c["id"] in titles else None
   return f'<a href="{esc(path)}">{name}</a>' if path else f'<span>{name}</span>'
  content+=f'<p>{_plural(len(entries),"corrección publicada","correcciones publicadas")}, de la más reciente a la más antigua.</p><ul class="ev-corrections">'+"".join(f'<li><time datetime="{c["fecha"]}">{esc(human_date(c["fecha"]))}</time>{title(c)}<span>{esc(c["texto"])}</span></li>' for c in entries)+'</ul>'
 else:content+='<p>Todavía no hay correcciones publicadas.</p>'
 content+='<p>Editorial EMEICRÍTICA</p>'
 date_html=f'<p class="ev-doc-date">Última actualización: {esc(human_date(data["actualizado"]))}</p>' if data and data["actualizado"] else ""
 return doc_page("Transparencia editorial","Correcciones",date_html,content)
def write(path,text):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding="utf-8")
def render_all():
 items=json.loads((ROOT/"resumenes.json").read_text(encoding="utf-8"));manifest=json.loads((ROOT/"seo-manifest.json").read_text(encoding="utf-8"));clusters=json.loads((ROOT/"seo-cluster-manifest.json").read_text(encoding="utf-8"))
 for r in items:
  path=ROOT/manifest[trial_id(r["id"])]["path"].lstrip("/")/"index.html";source=path.read_text(encoding="utf-8")
  write(path,document(source,reading(r,manifest),manifest[trial_id(r["id"])]["path"],"reader"))
 home=ROOT/"_includes/index-source.html";write(home,document(home.read_text(encoding="utf-8"),cover(items,manifest),"/","edition"))
 write(ROOT/"archivo/index.html",archive_page(items,manifest))
 write(ROOT/"mapa/index.html",map_page(items,manifest,clusters))
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
 # /correcciones/: la cabecera SEO la escribe generar_seo_clusters.py, como la de /metodologia/.
 path=ROOT/"correcciones/index.html"
 if path.exists():write(path,document(path.read_text(encoding="utf-8"),corrections_page(items,manifest,audit()),"/correcciones/"))
 videos=load_videos();expected=set()
 for id,v in videos.items():
  r=next((x for x in items if trial_id(x["id"])==id),None)
  if r is None:raise ValueError(f"videos.json: el resumen {id} no existe")
  route=video_path(manifest,id);expected.add(route.strip("/").split("/")[-1])
  write(ROOT/route.lstrip("/")/"index.html",video_page(r,v,manifest))
 qdir=ROOT/"preguntas";questions=load_questions()
 for q in questions:write(qdir/q["slug"]/"index.html",question_page(q,items,manifest))
 if qdir.exists():
  import shutil
  for d in qdir.iterdir():
   if d.is_dir() and d.name not in {q["slug"] for q in questions}:shutil.rmtree(d)
  if not any(qdir.iterdir()):qdir.rmdir()
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
 print(f"DESIGN TEMPLATES PASS: {len(items)} trials, {len(clusters)} subtemas, portada, {len(past)} ediciones anteriores, archivo, mapa, cuenta, lector y documentos")

