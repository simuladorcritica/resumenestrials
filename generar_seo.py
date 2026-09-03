from __future__ import annotations

from pathlib import Path
import html
import json
import re
import shutil
import unicodedata

ROOT = Path(__file__).resolve().parent
BASE_URL = "https://resumenestrials.com"
DATA_PATH = ROOT / "resumenes.json"
MANIFEST_PATH = ROOT / "seo-manifest.json"
SITEMAP_PATH = ROOT / "sitemap.xml"
FEED_PATH = ROOT / "feed.xml"
TRIALS_DIR = ROOT / "trials"

CATEGORY_PATHS = {
    "Medicina Crítica": "medicina-critica",
    "Medicina Interna": "medicina-interna",
}

STOPWORDS = {
    "a", "al", "ante", "bajo", "con", "contra", "de", "del", "desde", "durante",
    "e", "el", "en", "entre", "frente", "hacia", "hasta", "la", "las", "los", "o",
    "para", "por", "que", "se", "sin", "sobre", "un", "una", "y",
}


def texto_plano(valor: object) -> str:
    texto = html.unescape(re.sub(r"<[^>]+>", " ", str(valor or "")))
    return re.sub(r"\s+", " ", texto).strip()


def recortar(valor: object, limite: int = 158) -> str:
    texto = texto_plano(valor)
    if len(texto) <= limite:
        return texto
    corte = texto[: limite + 1]
    espacio = corte.rfind(" ")
    if espacio > 100:
        corte = corte[:espacio]
    return corte.rstrip(" ,.;:") + "…"


def slugify(valor: object, limite: int = 92) -> str:
    base = unicodedata.normalize("NFKD", texto_plano(valor))
    base = "".join(c for c in base if not unicodedata.combining(c)).lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    if len(base) <= limite:
        return base
    base = base[: limite + 1]
    if "-" in base:
        base = base.rsplit("-", 1)[0]
    return base.strip("-")


def slug_para_item(item: dict) -> str:
    manual = slugify(item.get("slug"), 110)
    if manual:
        return manual
    trial_id = str(item.get("id", "")).strip()
    titulo = texto_plano(item.get("titulo"))
    if not titulo:
        return f"trial-{trial_id or 'sin-id'}"

    # Mantiene el acrónimo al principio y conserva términos clínicos útiles.
    if ":" in titulo:
        acronimo, resto = titulo.split(":", 1)
        acr = slugify(acronimo, 28)
        tokens = [t for t in re.split(r"\s+", slugify(resto, 160).replace("-", " ")) if t]
        importantes = [t for t in tokens if t not in STOPWORDS]
        cola = "-".join(importantes[:9]) or slugify(resto, 72)
        base = "-".join(x for x in [acr, cola] if x)
    else:
        base = slugify(titulo, 88)

    base = slugify(base, 96) or f"trial-{trial_id or 'sin-id'}"
    return base


def url_trial(item: dict) -> str:
    return f"{BASE_URL}/trials/{slug_para_item(item)}/"


def url_http(valor: object) -> str:
    value = str(valor or "").strip()
    return value if re.match(r"^https?://", value, re.I) else ""


def ruta_trial(item: dict) -> str:
    return f"/trials/{slug_para_item(item)}/"


def categorias(item: dict) -> list[str]:
    valores = [item.get("especialidad_principal"), item.get("especialidad_secundaria")]
    return [v for i, v in enumerate(valores) if v in CATEGORY_PATHS and v not in valores[:i]]


def fecha_humana(iso: object) -> str:
    valor = str(iso or "").strip()
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", valor)
    if not m:
        return valor
    y, mo, d = m.groups()
    meses = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    return f"{int(d)} de {meses[int(mo)]} de {y}"


def badge(esp: str) -> str:
    clase = "critica" if esp == "Medicina Crítica" else "interna"
    return f'<span class="badge {clase}">{html.escape(esp)}</span>'


def related(item: dict, todos: list[dict], limite: int = 4) -> list[dict]:
    esp = set(categorias(item))
    temas = set(item.get("temas") or [])

    def score(other: dict) -> int:
        if str(other.get("id")) == str(item.get("id")):
            return -1
        other_esp = set(categorias(other))
        other_temas = set(other.get("temas") or [])
        return 2 * len(temas & other_temas) + len(esp & other_esp)

    candidatos = [(score(o), str(o.get("fecha") or ""), o) for o in todos]
    candidatos = [x for x in candidatos if x[0] > 0]
    candidatos.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [x[2] for x in candidatos[:limite]]


def jsonld_article(item: dict) -> str:
    canonical = url_trial(item)
    descripcion = recortar(item.get("objetivo") or item.get("hallazgo") or "Resumen crítico en español de un ensayo clínico aleatorizado.")
    cats = categorias(item)
    temas = list(item.get("temas") or [])
    about = [{"@type": "Thing", "name": n} for n in [*cats, *temas] if n]
    article = {
        "@type": "Article",
        "headline": texto_plano(item.get("titulo")),
        "description": descripcion,
        "inLanguage": "es-MX",
        "mainEntityOfPage": canonical,
        "url": canonical,
        "publisher": {
            "@type": "Organization",
            "name": "Resúmenes Trials",
            "url": f"{BASE_URL}/",
            "logo": {"@type": "ImageObject", "url": f"{BASE_URL}/logo.png"},
        },
        "author": {"@type": "Organization", "name": "Resúmenes Trials", "url": f"{BASE_URL}/"},
        "image": f"{BASE_URL}/logo.png",
    }
    if about:
        article["about"] = about
    if temas:
        article["keywords"] = temas
    original_url = url_http(item.get("original"))
    if original_url:
        article["isBasedOn"] = original_url
        article["citation"] = original_url
    elif item.get("original"):
        article["citation"] = texto_plano(item.get("original"))

    crumbs = [
        {"@type": "ListItem", "position": 1, "name": "Inicio", "item": f"{BASE_URL}/"},
    ]
    if cats:
        cat = cats[0]
        crumbs.append({
            "@type": "ListItem",
            "position": 2,
            "name": cat,
            "item": f"{BASE_URL}/{CATEGORY_PATHS[cat]}/",
        })
    crumbs.append({
        "@type": "ListItem",
        "position": len(crumbs) + 1,
        "name": texto_plano(item.get("titulo")),
        "item": canonical,
    })
    graph = {
        "@context": "https://schema.org",
        "@graph": [article, {"@type": "BreadcrumbList", "itemListElement": crumbs}],
    }
    return json.dumps(graph, ensure_ascii=False, separators=(",", ":"))


def pagina_trial(item: dict, todos: list[dict]) -> str:
    titulo = texto_plano(item.get("titulo")) or "Resumen clínico"
    canonical = url_trial(item)
    social_image = f"{BASE_URL}/images/trials/{slug_para_item(item)}-16x9.jpg"
    descripcion = recortar(item.get("objetivo") or item.get("hallazgo") or "Resumen crítico en español de un ensayo clínico aleatorizado.")
    cats = categorias(item)
    badges = "".join(badge(c) for c in cats)
    temas = "".join(f'<span class="tema">{html.escape(str(t))}</span>' for t in (item.get("temas") or []))
    fuente = " · ".join(filter(None, [texto_plano(item.get("autor")), texto_plano(item.get("revista")), texto_plano(item.get("registro")), texto_plano(item.get("doi"))]))
    fecha = fecha_humana(item.get("fecha"))

    if cats:
        cat = cats[0]
        crumbs = f'<a href="/">Inicio</a><span>›</span><a href="/{CATEGORY_PATHS[cat]}/">{html.escape(cat)}</a><span>›</span><span>Trial</span>'
    else:
        crumbs = '<a href="/">Inicio</a><span>›</span><span>Trial</span>'

    rel_items = []
    for r in related(item, todos):
        r_cats = "".join(badge(c) for c in categorias(r))
        rel_items.append(
            f'<article class="rel-item"><a href="{html.escape(ruta_trial(r))}">{r_cats}'
            f'<h3>{html.escape(texto_plano(r.get("titulo")))}</h3>'
            f'<p>{html.escape(texto_plano(r.get("revista")))} · {html.escape(str(r.get("anio") or ""))}</p></a></article>'
        )
    relacionados = ""
    if rel_items:
        relacionados = '<section class="relacionados"><h2>Evidencia relacionada</h2><div class="rel-grid">' + "".join(rel_items) + "</div></section>"

    corto = ""
    if item.get("corto"):
        corto = (
            '<section id="resumen-breve" class="resumen-breve">'
            '<details><summary>Resumen breve</summary><div class="breve-cuerpo">'
            + str(item.get("corto") or "") +
            '</div></details></section>'
        )

    original = ""
    original_url = url_http(item.get("original"))
    if original_url:
        original = f'<div class="enlace-original"><strong>Artículo original</strong><br><a href="{html.escape(original_url)}" target="_blank" rel="noopener noreferrer">{html.escape(original_url)}</a></div>'
    elif item.get("original"):
        original = f'<div class="enlace-original"><strong>Referencia del artículo original</strong><br><span>{html.escape(texto_plano(item.get("original")))}</span></div>'

    publication = f'<div class="publicacion">Artículo original publicado: {html.escape(fecha)}</div>' if fecha else ""

    return f'''<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{html.escape(titulo)} | Resúmenes Trials</title>
<meta name="description" content="{html.escape(descripcion)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="{html.escape(canonical)}">
<link rel="alternate" type="application/atom+xml" title="Resúmenes Trials" href="{BASE_URL}/feed.xml">
<meta name="theme-color" content="#f7f6f2">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Resúmenes Trials">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="{html.escape(titulo)}">
<meta property="og:description" content="{html.escape(descripcion)}">
<meta property="og:url" content="{html.escape(canonical)}">
<meta property="og:image" content="{social_image}">
<meta property="og:image:alt" content="Ilustración editorial de {html.escape(titulo)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(titulo)}">
<meta name="twitter:description" content="{html.escape(descripcion)}">
<meta name="twitter:image" content="{social_image}">
<script type="application/ld+json">{jsonld_article(item)}</script>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/trial.css?v=1">
</head>
<body>
<header class="topbar"><div class="topbar-in"><a class="marca" href="/"><img src="/logo.png" alt="Resúmenes Trials"></a><nav><a href="/medicina-critica/">Medicina Crítica</a><a href="/medicina-interna/">Medicina Interna</a></nav></div></header>
<main class="envoltorio">
<nav class="migas" aria-label="Ruta">{crumbs}</nav>
<header class="art-head"><div class="badges">{badges}{temas}</div><h1>{html.escape(titulo)}</h1><div class="fuente">{html.escape(fuente)}</div>{publication}</header>
<article class="articulo">{item.get("cuerpo") or ""}</article>
{corto}
{original}
{relacionados}
<nav class="pie-nav"><a href="/">← Volver al índice</a></nav>
<footer class="art-footer">Resumen crítico para médicos y profesionales de la salud. No sustituye el artículo original ni el juicio clínico.</footer>
</main>
</body>
</html>
'''


def pagina_categoria(nombre: str, items: list[dict]) -> str:
    path = CATEGORY_PATHS[nombre]
    canonical = f"{BASE_URL}/{path}/"
    desc = f"Ensayos clínicos aleatorizados y evidencia relevante de {nombre}, resumidos críticamente en español para médicos y profesionales de la salud."
    cards = []
    for item in sorted(items, key=lambda x: str(x.get("fecha") or ""), reverse=True):
        temas = "".join(f'<span class="tema">{html.escape(str(t))}</span>' for t in (item.get("temas") or []))
        cards.append(
            f'<article class="cat-card"><a href="{html.escape(ruta_trial(item))}"><div class="badges">{temas}</div>'
            f'<h2>{html.escape(texto_plano(item.get("titulo")))}</h2>'
            f'<p class="cat-meta">{html.escape(texto_plano(item.get("revista")))} · {html.escape(str(item.get("anio") or ""))}</p>'
            f'<p>{html.escape(recortar(item.get("hallazgo") or item.get("objetivo"), 190))}</p></a></article>'
        )
    schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{nombre} | Resúmenes Trials",
        "description": desc,
        "url": canonical,
        "inLanguage": "es-MX",
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": texto_plano(x.get("titulo")), "url": url_trial(x)}
                for i, x in enumerate(sorted(items, key=lambda x: str(x.get("fecha") or ""), reverse=True))
            ],
        },
    }
    return f'''<!DOCTYPE html>
<html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{html.escape(nombre)}: ensayos clínicos | Resúmenes Trials</title>
<meta name="description" content="{html.escape(desc)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{canonical}"><meta property="og:type" content="website"><meta property="og:title" content="{html.escape(nombre)} · Resúmenes Trials"><meta property="og:description" content="{html.escape(desc)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{BASE_URL}/logo.png">
<link rel="alternate" type="application/atom+xml" title="Resúmenes Trials" href="{BASE_URL}/feed.xml">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, separators=(",", ":"))}</script>
<link rel="icon" href="/favicon.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/trial.css?v=1"></head>
<body><header class="topbar"><div class="topbar-in"><a class="marca" href="/"><img src="/logo.png" alt="Resúmenes Trials"></a><nav><a href="/medicina-critica/">Medicina Crítica</a><a href="/medicina-interna/">Medicina Interna</a></nav></div></header>
<main class="envoltorio categoria"><nav class="migas"><a href="/">Inicio</a><span>›</span><span>{html.escape(nombre)}</span></nav><header class="cat-head"><p class="eyebrow">Biblioteca temática</p><h1>{html.escape(nombre)}</h1><p>{html.escape(desc)}</p><strong>{len(items)} resúmenes</strong></header><section class="cat-grid">{''.join(cards)}</section><nav class="pie-nav"><a href="/">← Volver al índice</a></nav></main></body></html>'''


def generar_sitemap(items: list[dict], categorias_contenido: dict[str, list[dict]]) -> None:
    urls = [f"{BASE_URL}/", f"{BASE_URL}/privacidad/", f"{BASE_URL}/terminos/"]
    urls.extend(f"{BASE_URL}/{CATEGORY_PATHS[n]}/" for n, xs in categorias_contenido.items() if xs)
    urls.extend(url_trial(item) for item in items)
    lineas = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in urls:
        lineas.extend(["  <url>", f"    <loc>{html.escape(url)}</loc>", "  </url>"])
    lineas.append("</urlset>")
    SITEMAP_PATH.write_text("\n".join(lineas) + "\n", encoding="utf-8")


def fecha_editorial(item: dict) -> str:
    """Return only an explicit site publication/update date, never the study date."""
    for key in ("fecha_revision", "actualizado", "fecha_publicacion_resumen"):
        value = str(item.get(key) or "").strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return value
    return ""


def generar_feed(items: list[dict]) -> None:
    dated = [(fecha_editorial(item), item) for item in items]
    dated = [(date, item) for date, item in dated if date]
    dated.sort(key=lambda pair: (pair[0], str(pair[1].get("id") or "")), reverse=True)
    updated = dated[0][0] if dated else "1970-01-01"
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom">',
        '  <title>Resúmenes Trials</title>',
        f'  <id>{BASE_URL}/</id>',
        f'  <link href="{BASE_URL}/"/>',
        f'  <link rel="self" type="application/atom+xml" href="{BASE_URL}/feed.xml"/>',
        f'  <updated>{updated}T00:00:00Z</updated>',
        '  <subtitle>Resúmenes críticos en español de ensayos clínicos.</subtitle>',
    ]
    for date, item in dated[:50]:
        canonical = url_trial(item)
        title = texto_plano(item.get("titulo"))
        description = recortar(item.get("objetivo") or item.get("hallazgo") or "Resumen crítico en español.", 300)
        lines.extend([
            '  <entry>',
            f'    <title>{html.escape(title)}</title>',
            f'    <id>{html.escape(canonical)}</id>',
            f'    <link href="{html.escape(canonical)}"/>',
            f'    <updated>{date}T00:00:00Z</updated>',
            f'    <summary>{html.escape(description)}</summary>',
            '  </entry>',
        ])
    lines.append('</feed>')
    FEED_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def validar(items: object) -> list[dict]:
    if not isinstance(items, list):
        raise ValueError("resumenes.json debe contener una lista")
    ids = []
    slugs = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Cada resumen debe ser un objeto")
        if "id" not in item or not item.get("titulo"):
            raise ValueError("Cada resumen debe tener id y titulo")
        ids.append(str(item["id"]))
        slugs.append(slug_para_item(item))
    if len(ids) != len(set(ids)):
        raise ValueError("Hay IDs duplicados en resumenes.json")
    if len(slugs) != len(set(slugs)):
        raise ValueError("Hay slugs SEO duplicados; usa el campo 'slug' para resolverlos")
    return items


def main() -> None:
    with DATA_PATH.open("r", encoding="utf-8") as f:
        items = validar(json.load(f))

    TRIALS_DIR.mkdir(parents=True, exist_ok=True)

    expected_slugs = {slug_para_item(item) for item in items}
    stale = sorted(
        child.name
        for child in TRIALS_DIR.iterdir()
        if child.is_dir() and child.name not in expected_slugs
    )
    if stale:
        raise RuntimeError(
            "Hay directorios de trials obsoletos que requieren revisión manual; "
            "no se eliminaron: " + ", ".join(stale)
        )

    manifest = {}
    categorias_contenido = {nombre: [] for nombre in CATEGORY_PATHS}

    for item in items:
        slug = slug_para_item(item)
        out = TRIALS_DIR / slug
        out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(pagina_trial(item, items), encoding="utf-8")
        manifest[str(item["id"])] = {
            "slug": slug,
            "path": ruta_trial(item),
            "url": url_trial(item),
            "title": texto_plano(item.get("titulo")),
        }
        for cat in categorias(item):
            categorias_contenido[cat].append(item)

    for nombre, path in CATEGORY_PATHS.items():
        out = ROOT / path
        out.mkdir(exist_ok=True)
        (out / "index.html").write_text(pagina_categoria(nombre, categorias_contenido[nombre]), encoding="utf-8")

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    generar_sitemap(items, categorias_contenido)
    generar_feed(items)
    print(f"SEO generado: {len(items)} trials, {sum(bool(v) for v in categorias_contenido.values())} categorías, sitemap.xml y feed.xml.")


if __name__ == "__main__":
    main()
