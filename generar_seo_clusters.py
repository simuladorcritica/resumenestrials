from __future__ import annotations

from pathlib import Path
import html
import json
import re
import shutil
import unicodedata
import xml.etree.ElementTree as ET

import generar_seo as base
import site_templates as presentation

ROOT = base.ROOT
CONFIG = ROOT / "seo-clusters.json"
CLUSTER_MANIFEST = ROOT / "seo-cluster-manifest.json"
LEGACY_REDIRECTS = ROOT / "seo-legacy-redirects.json"
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


def load_legacy_redirects() -> list[dict]:
    redirects = json.loads(LEGACY_REDIRECTS.read_text(encoding="utf-8"))
    if not isinstance(redirects, list):
        raise ValueError("seo-legacy-redirects.json debe contener una lista")
    seen = set()
    for redirect in redirects:
        source = str(redirect.get("from") or "").strip()
        target = str(redirect.get("to") or "").strip()
        if not re.fullmatch(r"/[a-z0-9-]+/[a-z0-9-]+/", source):
            raise ValueError(f"Ruta legacy inválida: {source or '(vacía)'}")
        if not re.fullmatch(r"/[a-z0-9-]+/", target) or source == target:
            raise ValueError(f"Destino legacy inválido: {target or '(vacío)'}")
        if source in seen:
            raise ValueError(f"Redirect legacy duplicado: {source}")
        seen.add(source)
        redirect["from"] = source
        redirect["to"] = target
    return redirects


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
        raw_by_item[base.id_texto(item["id"])] = found
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
    clusters = {c["slug"] for c in by_item.get(base.id_texto(item["id"]), [])}
    scored = []
    for other in items:
        if base.id_texto(other.get("id")) == base.id_texto(item.get("id")):
            continue
        score = 4 * len(clusters & {c["slug"] for c in by_item.get(base.id_texto(other.get("id")), [])})
        score += 2 * len(topics & {norm(t) for t in (other.get("temas") or [])})
        score += len(cats & set(base.categorias(other)))
        if score:
            scored.append((score, str(other.get("fecha") or ""), other))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [x[2] for x in scored[:limit]]




def add_semantic_css(source: str) -> str:
    return source


def expand_topbar(source: str) -> str:
    return source


def improve_trials(items: list[dict], by_item: dict[str, list[dict]]) -> None:
    for item in items:
        path=base.TRIALS_DIR / base.slug_para_item(item) / "index.html"
        source=path.read_text(encoding="utf-8")
        source=re.sub(r'<title>.*?</title>',f'<title>{html.escape(seo_title(item))}</title>',source,count=1,flags=re.S)
        source=re.sub(r'<meta name="description" content=".*?">',f'<meta name="description" content="{html.escape(seo_description(item))}">',source,count=1,flags=re.S)
        path.write_text(update_jsonld(source,item,by_item.get(base.id_texto(item["id"]),[])),encoding="utf-8")




def collection_schema(name: str, description: str, url: str, items: list[dict]) -> str:
    data = {"@context":"https://schema.org","@type":"CollectionPage","name":name,"description":description,"url":url,"inLanguage":"es-MX","publisher":{"@type":"Organization","name":"Resúmenes Trials","url":f"{base.BASE_URL}/equipo-editorial/"},"mainEntity":{"@type":"ItemList","itemListElement":[{"@type":"ListItem","position":i+1,"name":plain(x.get("titulo")),"url":base.url_trial(x)} for i,x in enumerate(items)]}}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def page_shell(title: str, description: str, canonical: str, body: str, schema: str) -> str:
    source=f'''<!DOCTYPE html><html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>{html.escape(title)}</title><meta name="description" content="{html.escape(base.recortar(description,158))}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="{html.escape(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Resúmenes Trials"><meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(description)}"><meta property="og:url" content="{html.escape(canonical)}"><meta property="og:image" content="{base.BASE_URL}/logo.png"><script type="application/ld+json">{schema}</script><link rel="icon" href="/favicon.png"></head><body></body></html>'''
    route=canonical.removeprefix(base.BASE_URL)
    return presentation.document(source,body,route,"archive" if "data-ev-ids" in body else "document")


def cluster_page(c: dict, items: list[dict], clusters: list[dict], active: dict[str, list[dict]]) -> str:
    ordered=sorted(items,key=lambda x:str(x.get("fecha") or ""),reverse=True)
    manifest=json.loads(base.MANIFEST_PATH.read_text(encoding="utf-8"))
    body=presentation.archive(ordered,manifest,c["name"],cluster_path(c))
    return page_shell(f'{c["name"]}: ensayos clínicos | Resúmenes Trials',c.get("description") or "",cluster_url(c),body,collection_schema(c["name"],c.get("description") or "",cluster_url(c),ordered))


def legacy_redirect_page(redirect: dict) -> str:
    target_url = f"{base.BASE_URL}{redirect['to']}"
    reason = plain(redirect.get("reason") or "Esta colección se integró en una sección vigente.")
    source=f'''<!DOCTYPE html><html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Colección trasladada | Resúmenes Trials</title><meta name="description" content="Esta colección temática se trasladó a su sección canónica vigente."><meta name="robots" content="noindex,follow"><link rel="canonical" href="{html.escape(target_url)}"><meta http-equiv="refresh" content="0; url={html.escape(target_url)}"><script>location.replace({json.dumps(target_url)});</script><link rel="icon" href="/favicon.png"></head><body><section class="ev-notice"><h1>Colección trasladada</h1><p>{html.escape(reason)}</p><p><a href="{html.escape(redirect['to'])}">Continuar a Medicina Interna</a></p></section></body></html>'''
    head=re.search(r"<head[^>]*>(.*?)</head>",source,re.S)[0]
    body=re.search(r"<body[^>]*>(.*?)</body>",source,re.S)[1]
    return presentation.document(head,body,redirect["from"])


def generate_cluster_pages(items: list[dict], clusters: list[dict], active: dict[str, list[dict]], redirects: list[dict]) -> dict:
    redirect_paths = {redirect["from"].strip("/") for redirect in redirects}
    for category, cat_path in base.CATEGORY_PATHS.items():
        root = ROOT / cat_path
        if root.exists():
            expected = {
                f"{cat_path}/{c['slug']}"
                for c in clusters
                if c["category"] == category and active.get(c["slug"])
            }
            expected.update(path for path in redirect_paths if path.startswith(f"{cat_path}/"))
            stale = sorted(
                child.name
                for child in root.iterdir()
                if child.is_dir() and f"{cat_path}/{child.name}" not in expected
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
        manifest[c["slug"]] = {"name":c["name"],"category":c["category"],"path":cluster_path(c),"url":cluster_url(c),"count":len(values),"trial_ids":[base.id_texto(x["id"]) for x in values]}
    for redirect in redirects:
        folder = ROOT / redirect["from"].strip("/")
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "index.html").write_text(legacy_redirect_page(redirect), encoding="utf-8")
    return manifest


def improve_categories(clusters: list[dict], active: dict[str, list[dict]]) -> None:
    # The common specialty dialog exposes every active collection from the manifest.
    return


def methodology_page() -> str:
    canonical = f"{base.BASE_URL}/metodologia/"
    desc = "Metodología editorial de Resúmenes Trials: selección, extracción, evaluación crítica, cálculos derivados, transparencia y política de correcciones."
    schema = json.dumps({"@context":"https://schema.org","@type":"WebPage","name":"Metodología editorial | Resúmenes Trials","description":desc,"url":canonical,"inLanguage":"es-MX","publisher":{"@type":"Organization","name":"Resúmenes Trials","url":f"{base.BASE_URL}/equipo-editorial/"}}, ensure_ascii=False, separators=(",", ":"))
    source=(ROOT/"templates/documents/metodologia.html").read_text(encoding="utf-8")
    h1=re.search(r"<h1[^>]*>(.*?)</h1>",source,re.S)[1]
    article=re.search(r"<article[^>]*>(.*?)</article>",source,re.S)[1]
    body='<h1>'+h1+'</h1><article class="ev-prose">'+article+'</article>'
    return page_shell("Metodología editorial | Resúmenes Trials", desc, canonical, body, schema)


def editorial_page() -> str:
    canonical = f"{base.BASE_URL}/equipo-editorial/"
    desc = "Información editorial de Resúmenes Trials: propósito, autoría organizacional, independencia, transparencia y enfoque de medicina basada en evidencia."
    schema = json.dumps({"@context":"https://schema.org","@type":"Organization","name":"Resúmenes Trials","url":canonical,"logo":f"{base.BASE_URL}/logo.png","description":desc}, ensure_ascii=False, separators=(",", ":"))
    source=(ROOT/"templates/documents/equipo-editorial.html").read_text(encoding="utf-8")
    h1=re.search(r"<h1[^>]*>(.*?)</h1>",source,re.S)[1]
    article=re.search(r"<article[^>]*>(.*?)</article>",source,re.S)[1]
    body='<h1>'+h1+'</h1><article class="ev-prose">'+article+'</article>'
    return page_shell("Equipo editorial | Resúmenes Trials", desc, canonical, body, schema)


def write_editorial_pages() -> None:
    METHODOLOGY_DIR.mkdir(exist_ok=True)
    (METHODOLOGY_DIR / "index.html").write_text(methodology_page(), encoding="utf-8")
    EDITORIAL_DIR.mkdir(exist_ok=True)
    (EDITORIAL_DIR / "index.html").write_text(editorial_page(), encoding="utf-8")


def update_manifest(items: list[dict], by_item: dict[str, list[dict]]) -> None:
    manifest = json.loads(base.MANIFEST_PATH.read_text(encoding="utf-8"))
    for item in items:
        item_id = base.id_texto(item["id"])
        entry = manifest[item_id]
        entry["seo_title"] = seo_title(item)
        entry["description"] = seo_description(item)
        entry["clusters"] = [{"name":c["name"],"path":cluster_path(c),"url":cluster_url(c)} for c in by_item.get(item_id, [])]
    base.MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_sitemap(items: list[dict], clusters: list[dict], active: dict[str, list[dict]]) -> None:
    category_content = {name: [] for name in base.CATEGORY_PATHS}
    for item in items:
        for cat in base.categorias(item):
            category_content[cat].append(item)
    urls = [
        f"{base.BASE_URL}/",
        f"{base.BASE_URL}/metodologia/",
        f"{base.BASE_URL}/equipo-editorial/",
        f"{base.BASE_URL}/privacidad/",
        f"{base.BASE_URL}/terminos/",
    ]
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
    redirects = load_legacy_redirects()
    active, by_item = build_assignments(items, clusters)
    improve_trials(items, by_item)
    cluster_manifest = generate_cluster_pages(items, clusters, active, redirects)
    improve_categories(clusters, active)
    write_editorial_pages()
    update_manifest(items, by_item)
    CLUSTER_MANIFEST.write_text(json.dumps(cluster_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    update_sitemap(items, clusters, active)
    print(f"SEO semántico: {len(cluster_manifest)} clusters activos, {len(items)} trials enriquecidos y 2 páginas editoriales.")


if __name__ == "__main__":
    main()
