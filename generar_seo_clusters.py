from __future__ import annotations

from pathlib import Path
import html
import json
import re
import shutil
import unicodedata
import xml.etree.ElementTree as ET

import generar_seo as base

ROOT = base.ROOT
CONFIG = ROOT / "seo-clusters.json"
CLUSTER_MANIFEST = ROOT / "seo-cluster-manifest.json"
METHODOLOGY_DIR = ROOT / "metodologia"
EDITORIAL_DIR = ROOT / "equipo-editorial"


def plain(value: object) -> str:
    return base.texto_plano(value)


def norm(value: object) -> str:
    text = unicodedata.normalize("NFKD", plain(value))
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"\s+", " ", text).strip()


def load_clusters() -> list[dict]:
    clusters = json.loads(CONFIG.read_text(encoding="utf-8"))
    if not isinstance(clusters, list):
        raise ValueError("seo-clusters.json debe contener una lista")
    seen = set()
    for c in clusters:
        if not isinstance(c, dict):
            raise ValueError("Cada cluster SEO debe ser un objeto")
        c["slug"] = base.slugify(c.get("slug"), 80)
        if c.get("category") not in base.CATEGORY_PATHS or not c["slug"] or not c.get("name"):
            raise ValueError("Cluster SEO inválido: requiere category, slug y name")
        key = (c["category"], c["slug"])
        if key in seen:
            raise ValueError(f"Cluster duplicado: {key}")
        seen.add(key)
        c["min_items"] = max(1, int(c.get("min_items", 2)))
        c["keywords"] = [norm(x) for x in c.get("keywords", []) if plain(x)]
    return clusters


def cluster_path(c: dict) -> str:
    return f"/{base.CATEGORY_PATHS[c['category']]}/{c['slug']}/"


def cluster_url(c: dict) -> str:
    return f"{base.BASE_URL}{cluster_path(c)}"


def search_text(item: dict) -> str:
    values = [
        item.get("titulo"), item.get("objetivo"), item.get("hallazgo"),
        " ".join(str(x) for x in item.get("temas", []) or []), item.get("revista"),
    ]
    return norm(" ".join(plain(x) for x in values if x))


def classify(item: dict, clusters: list[dict]) -> list[dict]:
    cats = set(base.categorias(item))
    manual = {base.slugify(x, 80) for x in (item.get("seo_clusters") or []) if plain(x)}
    corpus = search_text(item)
    out = []
    for c in clusters:
        if c["category"] not in cats:
            continue
        if c["slug"] in manual or any(k and k in corpus for k in c["keywords"]):
            out.append(c)
    return out


def build_assignments(items: list[dict], clusters: list[dict]):
    all_by_cluster = {c["slug"]: [] for c in clusters}
    raw_by_item = {}
    for item in items:
        found = classify(item, clusters)
        raw_by_item[str(item["id"])] = found
        for c in found:
            all_by_cluster[c["slug"]].append(item)
    active = {
        c["slug"]: all_by_cluster[c["slug"]]
        for c in clusters
        if len(all_by_cluster[c["slug"]]) >= c["min_items"]
    }
    active_slugs = set(active)
    by_item = {k: [c for c in values if c["slug"] in active_slugs] for k, values in raw_by_item.items()}
    return active, by_item


def seo_title(item: dict) -> str:
    title = plain(item.get("titulo")) or "Resumen clínico"
    if ":" in title:
        trial, rest = title.split(":", 1)
        return base.recortar(f"{trial.strip()} trial: {rest.strip()} | Resúmenes Trials", 68)
    return base.recortar(f"{title} | Resúmenes Trials", 68)


def seo_description(item: dict) -> str:
    trial = plain(item.get("titulo", "")).split(":", 1)[0].strip()
    content = plain(item.get("hallazgo") or item.get("objetivo") or "Resumen crítico en español de un ensayo clínico aleatorizado.")
    prefix = f"{trial}: " if trial else ""
    return base.recortar(prefix + content + " Análisis crítico y resultados en español.", 158)


def visible_breadcrumb(item: dict, item_clusters: list[dict]) -> str:
    parts = ['<a href="/">Inicio</a><span>›</span>']
    cats = base.categorias(item)
    if cats:
        cat = cats[0]
        parts.append(f'<a href="/{base.CATEGORY_PATHS[cat]}/">{html.escape(cat)}</a><span>›</span>')
    if item_clusters:
        c = item_clusters[0]
        parts.append(f'<a href="{html.escape(cluster_path(c))}">{html.escape(c["name"])}</a><span>›</span>')
    parts.append('<span>Trial</span>')
    return '<nav class="migas" aria-label="Ruta">' + "".join(parts) + '</nav>'


def update_jsonld(source: str, item: dict, item_clusters: list[dict]) -> str:
    pattern = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
    match = pattern.search(source)
    if not match:
        return source
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return source
    graph = data.get("@graph") if isinstance(data, dict) else None
    if not isinstance(graph, list) or not graph:
        return source
    article = next((x for x in graph if isinstance(x, dict) and x.get("@type") == "Article"), None)
    crumbs = next((x for x in graph if isinstance(x, dict) and x.get("@type") == "BreadcrumbList"), None)
    if article:
        article["author"] = {"@type": "Organization", "name": "Equipo editorial de Resúmenes Trials", "url": f"{base.BASE_URL}/equipo-editorial/"}
        publisher = article.setdefault("publisher", {"@type": "Organization", "name": "Resúmenes Trials"})
        publisher["url"] = f"{base.BASE_URL}/equipo-editorial/"
        configured_cluster_names = {
            plain(value.get("name"))
            for value in json.loads(CONFIG.read_text(encoding="utf-8"))
            if isinstance(value, dict) and plain(value.get("name"))
        }
        names = []
        for x in article.get("about", []) if isinstance(article.get("about"), list) else []:
            if isinstance(x, dict) and x.get("name") and plain(x["name"]) not in configured_cluster_names:
                names.append(x["name"])
        names.extend(c["name"] for c in item_clusters)
        if names:
            article["about"] = [{"@type": "Thing", "name": n} for n in dict.fromkeys(names)]
        published = item.get("fecha_publicacion_resumen") or item.get("fecha_publicado")
        modified = item.get("fecha_revision") or item.get("actualizado")
        if published:
            article["datePublished"] = str(published)
        if modified:
            article["dateModified"] = str(modified)
    if crumbs:
        entries = [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": f"{base.BASE_URL}/"}]
        cats = base.categorias(item)
        if cats:
            cat = cats[0]
            entries.append({"@type": "ListItem", "position": 2, "name": cat, "item": f"{base.BASE_URL}/{base.CATEGORY_PATHS[cat]}/"})
        if item_clusters:
            c = item_clusters[0]
            entries.append({"@type": "ListItem", "position": len(entries) + 1, "name": c["name"], "item": cluster_url(c)})
        entries.append({"@type": "ListItem", "position": len(entries) + 1, "name": plain(item.get("titulo")), "item": base.url_trial(item)})
        crumbs["itemListElement"] = entries
    replacement = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + '</script>'
    return source[:match.start()] + replacement + source[match.end():]


def related(item: dict, items: list[dict], by_item: dict[str, list[dict]], limit: int = 4) -> list[dict]:
    cats = set(base.categorias(item))
    topics = {norm(t) for t in (item.get("temas") or [])}
    clusters = {c["slug"] for c in by_item.get(str(item["id"]), [])}
    scored = []
    for other in items:
        if str(other.get("id")) == str(item.get("id")):
            continue
        score = 4 * len(clusters & {c["slug"] for c in by_item.get(str(other.get("id")), [])})
        score += 2 * len(topics & {norm(t) for t in (other.get("temas") or [])})
        score += len(cats & set(base.categorias(other)))
        if score:
            scored.append((score, str(other.get("fecha") or ""), other))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [x[2] for x in scored[:limit]]


def related_section(item: dict, items: list[dict], by_item: dict[str, list[dict]]) -> str:
    cards = []
    for other in related(item, items, by_item):
        badges = "".join(base.badge(c) for c in base.categorias(other))
        clusters = by_item.get(str(other.get("id")), [])
        cluster = f'<span class="tema">{html.escape(clusters[0]["name"])}</span>' if clusters else ""
        cards.append(f'<article class="rel-item"><a href="{html.escape(base.ruta_trial(other))}">{badges}{cluster}<h3>{html.escape(plain(other.get("titulo")))}</h3><p>{html.escape(plain(other.get("revista")))} · {html.escape(str(other.get("anio") or ""))}</p></a></article>')
    if not cards:
        return ""
    return '<section class="relacionados"><h2>Evidencia relacionada</h2><div class="rel-grid">' + "".join(cards) + '</div></section>'


def add_semantic_css(source: str) -> str:
    if '/seo-semantic.css' not in source:
        source = source.replace('</head>', '<link rel="stylesheet" href="/seo-semantic.css?v=1"></head>', 1)
    return source


def expand_topbar(source: str) -> str:
    old = '<nav><a href="/medicina-critica/">Medicina Crítica</a><a href="/medicina-interna/">Medicina Interna</a></nav>'
    new = '<nav><a href="/medicina-critica/">Medicina Crítica</a><a href="/medicina-interna/">Medicina Interna</a><a href="/metodologia/">Metodología</a><a href="/equipo-editorial/">Equipo editorial</a></nav>'
    return source.replace(old, new)


def improve_trials(items: list[dict], by_item: dict[str, list[dict]]) -> None:
    trust = '<aside class="confianza"><strong>Transparencia editorial</strong><p>Este resumen sigue la <a href="/metodologia/">metodología editorial de Resúmenes Trials</a>. Consulta también el <a href="/equipo-editorial/">equipo editorial y los principios de independencia</a>.</p></aside>'
    for item in items:
        path = base.TRIALS_DIR / base.slug_para_item(item) / "index.html"
        source = path.read_text(encoding="utf-8")
        clusters = by_item.get(str(item["id"]), [])
        source = re.sub(r'<title>.*?</title>', f'<title>{html.escape(seo_title(item))}</title>', source, count=1, flags=re.S)
        source = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{html.escape(seo_description(item))}">', source, count=1, flags=re.S)
        source = add_semantic_css(expand_topbar(source))
        source = re.sub(r'<nav class="migas" aria-label="Ruta">.*?</nav>', visible_breadcrumb(item, clusters), source, count=1, flags=re.S)
        source = re.sub(r'<a class="tema tema-link" href="[^"]+">.*?</a>', '', source, flags=re.S)
        if clusters:
            links = "".join(f'<a class="tema tema-link" href="{html.escape(cluster_path(c))}">{html.escape(c["name"])}</a>' for c in clusters)
            source = source.replace('<header class="art-head"><div class="badges">', '<header class="art-head"><div class="badges">' + links, 1)
        source = update_jsonld(source, item, clusters)
        rel = related_section(item, items, by_item)
        if re.search(r'<section class="relacionados">.*?</section>', source, flags=re.S):
            source = re.sub(r'<section class="relacionados">.*?</section>', rel, source, count=1, flags=re.S)
        elif rel:
            source = source.replace('<nav class="pie-nav">', rel + '<nav class="pie-nav">', 1)
        if '<aside class="confianza">' not in source:
            marker = '<section class="relacionados">' if '<section class="relacionados">' in source else '<nav class="pie-nav">'
            source = source.replace(marker, trust + marker, 1)
        path.write_text(source, encoding="utf-8")


def trial_card(item: dict) -> str:
    topics = "".join(f'<span class="tema">{html.escape(str(t))}</span>' for t in (item.get("temas") or []))
    return f'<article class="cat-card"><a href="{html.escape(base.ruta_trial(item))}"><div class="badges">{topics}</div><h2>{html.escape(plain(item.get("titulo")))}</h2><p class="cat-meta">{html.escape(plain(item.get("revista")))} · {html.escape(str(item.get("anio") or ""))}</p><p>{html.escape(base.recortar(item.get("hallazgo") or item.get("objetivo"), 190))}</p></a></article>'


def collection_schema(name: str, description: str, url: str, items: list[dict]) -> str:
    data = {"@context":"https://schema.org","@type":"CollectionPage","name":name,"description":description,"url":url,"inLanguage":"es-MX","publisher":{"@type":"Organization","name":"Resúmenes Trials","url":f"{base.BASE_URL}/equipo-editorial/"},"mainEntity":{"@type":"ItemList","itemListElement":[{"@type":"ListItem","position":i+1,"name":plain(x.get("titulo")),"url":base.url_trial(x)} for i,x in enumerate(items)]}}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def page_shell(title: str, description: str, canonical: str, body: str, schema: str) -> str:
    topbar = '<header class="topbar"><div class="topbar-in"><a class="marca" href="/"><img src="/logo.png" alt="Resúmenes Trials"></a><nav><a href="/medicina-critica/">Medicina Crítica</a><a href="/medicina-interna/">Medicina Interna</a><a href="/metodologia/">Metodología</a><a href="/equipo-editorial/">Equipo editorial</a></nav></div></header>'
    return f'''<!DOCTYPE html><html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{html.escape(title)}</title><meta name="description" content="{html.escape(base.recortar(description,158))}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="{html.escape(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Resúmenes Trials"><meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(description)}"><meta property="og:url" content="{html.escape(canonical)}"><meta property="og:image" content="{base.BASE_URL}/logo.png"><script type="application/ld+json">{schema}</script><link rel="icon" href="/favicon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/trial.css?v=1"><link rel="stylesheet" href="/seo-semantic.css?v=1"></head><body>{topbar}{body}</body></html>'''


def cluster_page(c: dict, items: list[dict], clusters: list[dict], active: dict[str, list[dict]]) -> str:
    ordered = sorted(items, key=lambda x: str(x.get("fecha") or ""), reverse=True)
    cat_path = base.CATEGORY_PATHS[c["category"]]
    related = "".join(f'<a href="{html.escape(cluster_path(o))}">{html.escape(o["name"])}</a>' for o in clusters if o["category"] == c["category"] and o["slug"] != c["slug"] and active.get(o["slug"]))
    related_html = f'<nav class="cluster-related"><strong>Otros temas:</strong>{related}</nav>' if related else ""
    body = f'<main class="envoltorio categoria"><nav class="migas"><a href="/">Inicio</a><span>›</span><a href="/{cat_path}/">{html.escape(c["category"])}</a><span>›</span><span>{html.escape(c["name"])}</span></nav><header class="cat-head"><p class="eyebrow">Cluster clínico</p><h1>{html.escape(c["name"])}</h1><p>{html.escape(c.get("description") or "")}</p><strong>{len(items)} ensayos relacionados</strong></header>{related_html}<section class="cat-grid">{"".join(trial_card(x) for x in ordered)}</section><nav class="pie-nav"><a href="/{cat_path}/">← Volver a {html.escape(c["category"])}</a></nav></main>'
    return page_shell(f'{c["name"]}: ensayos clínicos | Resúmenes Trials', c.get("description") or "", cluster_url(c), body, collection_schema(c["name"], c.get("description") or "", cluster_url(c), ordered))


def generate_cluster_pages(items: list[dict], clusters: list[dict], active: dict[str, list[dict]]) -> dict:
    for category, cat_path in base.CATEGORY_PATHS.items():
        root = ROOT / cat_path
        if root.exists():
            expected = {
                c["slug"]
                for c in clusters
                if c["category"] == category and active.get(c["slug"])
            }
            stale = sorted(
                child.name
                for child in root.iterdir()
                if child.is_dir() and child.name not in expected
            )
            if stale:
                raise RuntimeError(
                    f"Hay clusters obsoletos en {cat_path} que requieren revisión manual; "
                    "no se eliminaron: " + ", ".join(stale)
                )
    manifest = {}
    for c in clusters:
        values = active.get(c["slug"], [])
        if not values:
            continue
        folder = ROOT / base.CATEGORY_PATHS[c["category"]] / c["slug"]
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "index.html").write_text(cluster_page(c, values, clusters, active), encoding="utf-8")
        manifest[c["slug"]] = {"name":c["name"],"category":c["category"],"path":cluster_path(c),"url":cluster_url(c),"count":len(values),"trial_ids":[str(x["id"]) for x in values]}
    return manifest


def improve_categories(clusters: list[dict], active: dict[str, list[dict]]) -> None:
    for cat, folder in base.CATEGORY_PATHS.items():
        path = ROOT / folder / "index.html"
        source = add_semantic_css(expand_topbar(path.read_text(encoding="utf-8")))
        source = re.sub(r'<section class="cluster-section">.*?</section>', '', source, flags=re.S)
        cards = []
        for c in clusters:
            values = active.get(c["slug"], [])
            if c["category"] == cat and values:
                cards.append(f'<a class="cluster-card" href="{html.escape(cluster_path(c))}"><span>{len(values)} estudios</span><h2>{html.escape(c["name"])}</h2><p>{html.escape(c.get("description") or "")}</p></a>')
        section = '<section class="cluster-section"><p class="eyebrow">Explorar por tema</p><div class="cluster-grid">' + "".join(cards) + '</div></section>' if cards else ""
        source = source.replace('</header><section class="cat-grid">', '</header>' + section + '<section class="cat-grid">', 1)
        path.write_text(source, encoding="utf-8")


def methodology_page() -> str:
    canonical = f"{base.BASE_URL}/metodologia/"
    desc = "Metodología editorial de Resúmenes Trials: selección, extracción, evaluación crítica, cálculos derivados, transparencia y política de correcciones."
    schema = json.dumps({"@context":"https://schema.org","@type":"WebPage","name":"Metodología editorial | Resúmenes Trials","description":desc,"url":canonical,"inLanguage":"es-MX","publisher":{"@type":"Organization","name":"Resúmenes Trials","url":f"{base.BASE_URL}/equipo-editorial/"}}, ensure_ascii=False, separators=(",", ":"))
    body = '''<main class="envoltorio pagina-institucional"><nav class="migas"><a href="/">Inicio</a><span>›</span><span>Metodología</span></nav><header class="cat-head"><p class="eyebrow">Transparencia editorial</p><h1>Cómo elaboramos los resúmenes</h1><p>Selección, extracción, evaluación crítica, cálculos derivados y política de correcciones.</p></header><article class="prose"><h2>1. Selección de la evidencia</h2><p>Resúmenes Trials prioriza ensayos clínicos aleatorizados y otros trabajos de alta relevancia clínica. Cada entrada identifica el artículo original, la revista, el registro cuando está disponible y el DOI o enlace de publicación.</p><h2>2. Extracción estructurada</h2><p>La lectura se organiza alrededor de la pregunta de investigación, población, intervención, comparador, desenlace primario, diseño, resultados, seguridad, limitaciones y aplicabilidad clínica. Se conserva la distinción entre desenlaces primarios, secundarios y análisis exploratorios.</p><h2>3. Evaluación crítica</h2><p>La síntesis valora aleatorización, cegamiento, pérdidas, análisis por intención de tratar, multiplicidad, potencia estadística, desviaciones del protocolo, validez interna y validez externa cuando estos elementos son pertinentes.</p><h2>4. Cálculos derivados</h2><p>Cuando se presentan medidas calculadas a partir de cifras del artículo, se identifican como cálculos derivados y no como resultados textuales de la publicación original.</p><h2>5. Financiación y conflictos de interés</h2><p>Cuando la publicación original informa financiación o conflictos de interés relevantes, se incorporan a la lectura crítica para contextualizar la evidencia.</p><h2>6. Revisión y correcciones</h2><p>La capa automática genera URLs, metadatos, clusters temáticos y enlaces internos; no altera el contenido científico. Las correcciones se realizan en la fuente de datos y las páginas derivadas se regeneran automáticamente.</p><h2>7. Alcance</h2><p>Los resúmenes están dirigidos a médicos y profesionales de la salud. No sustituyen la lectura del artículo original, las guías vigentes ni el juicio clínico individual.</p></article><aside class="confianza"><strong>Quién publica</strong><p>Consulta el <a href="/equipo-editorial/">equipo editorial y los principios de independencia</a>.</p></aside><nav class="pie-nav"><a href="/">← Volver al índice</a></nav></main>'''
    return page_shell("Metodología editorial | Resúmenes Trials", desc, canonical, body, schema)


def editorial_page() -> str:
    canonical = f"{base.BASE_URL}/equipo-editorial/"
    desc = "Información editorial de Resúmenes Trials: propósito, autoría organizacional, independencia, transparencia y enfoque de medicina basada en evidencia."
    schema = json.dumps({"@context":"https://schema.org","@type":"Organization","name":"Resúmenes Trials","url":canonical,"logo":f"{base.BASE_URL}/logo.png","description":desc}, ensure_ascii=False, separators=(",", ":"))
    body = '''<main class="envoltorio pagina-institucional"><nav class="migas"><a href="/">Inicio</a><span>›</span><span>Equipo editorial</span></nav><header class="cat-head"><p class="eyebrow">Sobre el proyecto</p><h1>Equipo editorial de Resúmenes Trials</h1><p>Propósito, autoría organizacional, independencia y transparencia editorial.</p></header><article class="prose"><h2>Propósito</h2><p>Resúmenes Trials es un proyecto editorial médico en español orientado a convertir ensayos clínicos complejos en lecturas estructuradas, críticas y trazables hasta la publicación original.</p><h2>Autoría organizacional</h2><p>Mientras no se publique una ficha individual de autor o revisor, las páginas identifican la autoría como “Equipo editorial de Resúmenes Trials”. Así se evita atribuir credenciales personales no documentadas públicamente y se mantiene una autoría consistente.</p><h2>Independencia editorial</h2><p>El objetivo es separar los resultados del artículo de su interpretación. La financiación y los conflictos declarados por los autores se contextualizan cuando son relevantes, y el artículo original permanece enlazado para verificación.</p><h2>Transparencia</h2><p>La arquitectura SEO, el sitemap, los clusters y los enlaces relacionados se generan automáticamente a partir de los datos publicados. La automatización organiza el contenido; no debe inventar resultados ni modificar cifras.</p><h2>Correcciones</h2><p>Si se identifica un error, la corrección se realiza en la fuente de datos. La regeneración automática propaga después el cambio a la página canónica y a las colecciones temáticas.</p></article><aside class="confianza"><strong>Metodología</strong><p>Revisa <a href="/metodologia/">cómo se selecciona, estructura y evalúa la evidencia</a>.</p></aside><nav class="pie-nav"><a href="/">← Volver al índice</a></nav></main>'''
    return page_shell("Equipo editorial | Resúmenes Trials", desc, canonical, body, schema)


def write_editorial_pages() -> None:
    METHODOLOGY_DIR.mkdir(exist_ok=True)
    (METHODOLOGY_DIR / "index.html").write_text(methodology_page(), encoding="utf-8")
    EDITORIAL_DIR.mkdir(exist_ok=True)
    (EDITORIAL_DIR / "index.html").write_text(editorial_page(), encoding="utf-8")


def update_manifest(items: list[dict], by_item: dict[str, list[dict]]) -> None:
    manifest = json.loads(base.MANIFEST_PATH.read_text(encoding="utf-8"))
    for item in items:
        entry = manifest[str(item["id"])]
        entry["seo_title"] = seo_title(item)
        entry["description"] = seo_description(item)
        entry["clusters"] = [{"name":c["name"],"path":cluster_path(c),"url":cluster_url(c)} for c in by_item.get(str(item["id"]), [])]
    base.MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_sitemap(items: list[dict], clusters: list[dict], active: dict[str, list[dict]]) -> None:
    category_content = {name: [] for name in base.CATEGORY_PATHS}
    for item in items:
        for cat in base.categorias(item):
            category_content[cat].append(item)
    urls = [f"{base.BASE_URL}/", f"{base.BASE_URL}/metodologia/", f"{base.BASE_URL}/equipo-editorial/"]
    urls.extend(f"{base.BASE_URL}/{base.CATEGORY_PATHS[name]}/" for name, values in category_content.items() if values)
    urls.extend(cluster_url(c) for c in clusters if active.get(c["slug"]))
    urls.extend(base.url_trial(item) for item in items)
    root = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    dates = {
        base.url_trial(item): str(
            item.get("fecha_revision")
            or item.get("actualizado")
            or item.get("fecha_publicacion_resumen")
            or ""
        ).strip()
        for item in items
    }
    for url in dict.fromkeys(urls):
        node = ET.SubElement(root, "url")
        ET.SubElement(node, "loc").text = url
        if dates.get(url):
            ET.SubElement(node, "lastmod").text = dates[url]
    ET.ElementTree(root).write(base.SITEMAP_PATH, encoding="utf-8", xml_declaration=True)


def main() -> None:
    items = base.validar(json.loads(base.DATA_PATH.read_text(encoding="utf-8")))
    clusters = load_clusters()
    active, by_item = build_assignments(items, clusters)
    improve_trials(items, by_item)
    cluster_manifest = generate_cluster_pages(items, clusters, active)
    improve_categories(clusters, active)
    write_editorial_pages()
    update_manifest(items, by_item)
    CLUSTER_MANIFEST.write_text(json.dumps(cluster_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    update_sitemap(items, clusters, active)
    print(f"SEO semántico: {len(cluster_manifest)} clusters activos, {len(items)} trials enriquecidos y 2 páginas editoriales.")


if __name__ == "__main__":
    main()
