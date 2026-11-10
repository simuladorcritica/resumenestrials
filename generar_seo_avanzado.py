from __future__ import annotations

from collections import Counter
from pathlib import Path
from datetime import date
import hashlib
import html
import json
import re

import generar_seo as base

ROOT = base.ROOT
HOME_SOURCE = ROOT / "_includes" / "index-source.html"
CLUSTER_MANIFEST = ROOT / "seo-cluster-manifest.json"
SEO_MANIFEST = ROOT / "seo-manifest.json"
IMAGES_DIR = ROOT / "images" / "trials"
SOCIAL_URLS = ["https://x.com/resumenestrials", "https://t.me/ResumenesTrials", "https://www.youtube.com/@EMEICRITICA"]


def plain(value: object) -> str:
    return base.texto_plano(value)


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def item_id(item: dict) -> str:
    return base.id_texto(item.get("id"))


def cut(value: object, limit: int) -> str:
    text = plain(value)
    if len(text) <= limit:
        return text
    part = text[: limit + 1]
    pos = part.rfind(" ")
    if pos > limit * 0.65:
        part = part[:pos]
    return part.rstrip(" ,.;:") + "…"


def first_sentence(value: object, limit: int = 320) -> str:
    text = plain(value)
    if not text:
        return ""
    m = re.search(r"(?<=[.!?])\s+", text)
    sentence = text[:m.start() + 1] if m else text
    return cut(sentence, limit)


def section_text(item: dict, headings: list[str], limit: int = 520) -> str:
    source = str(item.get("cuerpo") or "")
    for heading in headings:
        pattern = re.compile(
            r"<h2[^>]*>\s*" + re.escape(heading) + r"\s*</h2>(.*?)(?=<h2\b|$)",
            re.I | re.S,
        )
        m = pattern.search(source)
        if m:
            return cut(m.group(1), limit)
    return ""


def population_text(item: dict) -> str:
    text = section_text(item, ["Pregunta de investigación", "Población estudiada", "Población e intervención"], 900)
    if not text:
        return "La aplicabilidad debe limitarse a la población definida por los criterios de inclusión y exclusión del ensayo."
    # La primera parte de la sección suele definir la población antes de describir la intervención.
    for marker in [" La intervención", " El comparador", " Se trata de"]:
        if marker in text:
            text = text.split(marker, 1)[0]
            break
    return cut(text, 430)












def render_home(items: list[dict]) -> str:
    from site_templates import archive
    return archive(items,{base.id_texto(r["id"]):{"path":base.ruta_trial(r)} for r in items})


def update_jsonld_block(source: str, updater) -> str:
    pattern = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
    match = pattern.search(source)
    if not match:
        return source
    try:
        data = json.loads(match.group(1))
    except Exception:
        return source
    updater(data)
    new = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + '</script>'
    return source[:match.start()] + new + source[match.end():]


def ensure_css(source: str) -> str:
    return source


def update_home(items: list[dict]) -> None:
    from site_templates import document, archive
    source=HOME_SOURCE.read_text(encoding="utf-8")
    manifest={base.id_texto(r["id"]):{"path":base.ruta_trial(r)} for r in items}
    HOME_SOURCE.write_text(document(source,archive(items,manifest),"/","archive"),encoding="utf-8")


def update_interactive_home() -> None:
    # Interaction is authored in ui/archive.js; SEO generation never rewrites it.
    return


FONTS_DIR = ROOT / "tools" / "fonts"
# Identidad editorial (docs/DESIGN_SYSTEM.md): Newsreader para cabecera y título, IBM Plex
# (subconjunto RTSans) para etiquetas y Literata cursiva para la firma; todas OFL. Si falta una,
# la generación se detiene: nunca se publica una imagen con la fuente de emergencia de Pillow.
FONT_FILES = {
    "marca": "Newsreader-DisplayBold.ttf",
    "titulo": "Newsreader-Display.ttf",
    "sigla": "Newsreader-DisplayBold.ttf",
    "etiqueta": "IBMPlexSansCondensed-SemiBold.ttf",
    "meta": "IBMPlexSans-Medium.ttf",
    "firma": "Literata-Italic.ttf",
}
# Subconjunto latino de las fuentes: lo demás se traduce o se quita para que no salgan cuadros vacíos.
_GLYPH_EXTRA = {0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x20AC, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215}
_GLYPH_EQUIV = {"≥": ">=", "≤": "<=", "→": "->", "←": "<-", "α": "alfa", "β": "beta", "γ": "gamma", "δ": "delta", "κ": "kappa", "μ": "µ", "≈": "~", "≠": "!=", "∼": "~"}
# Paleta derivada de logo.png: papel, tinta, petróleo y el ocre reservado al punto de la línea de señal.
CARD_COLORS = {
    "papel": (246, 244, 240), "tinta": (18, 35, 59), "secundario": (90, 99, 114), "linea": (221, 216, 204),
    "petroleo": (20, 110, 110), "petroleo_marca": (28, 138, 138), "ocre": (200, 137, 42), "critica": (168, 71, 42),
}
CARD_SUPERSAMPLE = 2


def font(kind: str, size: int):
    from PIL import ImageFont
    path = FONTS_DIR / FONT_FILES[kind]
    if not path.exists():
        raise SystemExit(f"Falta la fuente {path}; no se generan imágenes sociales sin ella.")
    return ImageFont.truetype(str(path), size=size)


def glyph_safe(text: str) -> str:
    import unicodedata
    out = []
    for ch in str(text or ""):
        code = ord(ch)
        if code < 0x100 or 0x2000 <= code <= 0x206F or code in _GLYPH_EXTRA:
            out.append(ch)
        elif ch in _GLYPH_EQUIV:
            out.append(_GLYPH_EQUIV[ch])
        else:
            out.append("".join(c for c in unicodedata.normalize("NFKD", ch) if ord(c) < 0x100 and not unicodedata.combining(c)))
    return "".join(out)


def short_journal(name: str) -> str:
    t = str(name or "").strip()
    if re.match(r"^NEJM\b|New England", t, re.I):
        return "NEJM"
    for pattern, short in ((r"^JAMA\b", "JAMA"), (r"^(The )?Lancet\b", "Lancet"), (r"^BMJ\b", "BMJ"), (r"^J(ournal of the)? Am(erican)? Coll(ege of)? Cardiol", "JACC")):
        if re.match(pattern, t, re.I):
            return short
    return t


def card_study_type(tipo: str) -> str:
    """Antetítulo de la tarjeta: el diseño del estudio sin calificativos (nunca llama ECA a lo que no lo es)."""
    t = plain(tipo)
    if re.match(r"^(Ensayo cl[ií]nico aleatorizado|ECA)\b", t, re.I):
        return "Ensayo clínico aleatorizado"
    if re.match(r"^Dos ensayos cl[ií]nicos aleatorizados\b", t, re.I):
        return "Dos ensayos clínicos aleatorizados"
    return re.split(r",| de ", t, maxsplit=1)[0].strip() or "Ensayo clínico"


def _tracked_width(draw, text: str, font_obj, tracking: float) -> float:
    return sum(draw.textlength(ch, font=font_obj) for ch in text) + tracking * max(0, len(text) - 1)


def _draw_tracked(draw, xy, text: str, font_obj, fill, tracking: float, anchor_right: bool = False) -> None:
    """Versalitas: mayúsculas con espaciado de 0,08 em (Pillow no tiene letter-spacing)."""
    x, y = xy
    if anchor_right:
        x -= _tracked_width(draw, text, font_obj, tracking)
    for ch in text:
        draw.text((x, y), ch, font=font_obj, fill=fill, anchor="ls")
        x += draw.textlength(ch, font=font_obj) + tracking


def _signal_line(draw, x: float, y_base: float, width: float, stroke: float, radius: float, rise: float, curve: float) -> None:
    """La línea de señal: filete petróleo que al final sube suavemente y termina en el punto ocre."""
    cx, yt = x + width - radius, y_base - rise
    x0 = cx - radius * .9 - curve
    p0, p1, p2, p3 = (x0, y_base), (x0 + curve * .55, y_base), (cx - radius - curve * .42, yt), (cx - radius * .9, yt)
    points = [(x, y_base), p0]
    for i in range(1, 41):
        t = i / 40
        points.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3)))
    w = max(1, round(stroke))
    draw.line(points, fill=CARD_COLORS["petroleo_marca"], width=w, joint="curve")
    r = w / 2
    draw.ellipse((x - r, y_base - r, x + r, y_base + r), fill=CARD_COLORS["petroleo_marca"])
    draw.ellipse((cx - radius, yt - radius, cx + radius, yt + radius), fill=CARD_COLORS["ocre"])


def card_title_layout(draw, title: str, max_width: float, max_height: float, size_max: int, size_min: int, max_lines: int):
    """Título completo con la sigla en seminegrita. Primero reduce el cuerpo de letra; solo si aun así
    no cabe, corta por palabra completa y termina en «…». Devuelve (tamaño, líneas, interlineado)."""
    split = title.find(": ")
    words = []
    for n, word in enumerate(title.split()):
        words.append([word, "sigla" if 0 < split <= 40 and len(" ".join(title.split()[:n + 1])) <= split + 1 else "titulo"])

    def wrap(size, items):
        fonts = {k: font(k, size) for k in ("titulo", "sigla")}
        space = draw.textlength(" ", font=fonts["titulo"])
        lines, line, width = [], [], 0.0
        for word, kind in items:
            w = draw.textlength(word, font=fonts[kind])
            if line and width + space + w > max_width:
                lines.append(line)
                line, width = [], 0.0
            width = width + space + w if line else w
            line.append((word, kind))
        if line:
            lines.append(line)
        return lines

    for size in range(size_max, size_min - 1, -1):
        lines = wrap(size, words)
        if len(lines) <= max_lines and len(lines) * size * 1.13 <= max_height:
            return size, lines, size * 1.13
    size = size_min
    lines_cap = max(1, min(max_lines, int(max_height // (size * 1.13))))
    items = list(words)
    while items:
        candidate = [list(x) for x in items]
        candidate[-1][0] = candidate[-1][0].rstrip(",;:.") + "…"
        lines = wrap(size, candidate)
        if len(lines) <= lines_cap:
            return size, lines, size * 1.13
        items.pop()
    return size, [], size * 1.13


def make_image(item: dict, width: int, height: int, suffix: str) -> str:
    from PIL import Image, ImageDraw
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    slug = base.slug_para_item(item)
    filename = f"{slug}-{suffix}.jpg"
    path = IMAGES_DIR / filename
    public_url = f"{base.BASE_URL}/images/trials/{filename}"
    # Los binarios publicados son artefactos versionados. No se recomprimen en
    # cada regeneración porque distintas versiones de Pillow producen bytes
    # diferentes aunque la imagen visible sea equivalente.
    if path.exists():
        return public_url

    # La tarjeta es la primera página de un artículo de revista, no un anuncio: papel, cabecera con
    # el monograma, la línea de señal (único punto ocre), antetítulo, título completo y pie con la
    # firma editorial. Solo texto ya publicado del resumen.
    ss = CARD_SUPERSAMPLE
    W, H = width * ss, height * ss
    s = W / 1200
    c = CARD_COLORS
    critical = "Medicina Crítica" in base.categorias(item)
    tone = c["critica"] if critical else c["petroleo"]
    image = Image.new("RGB", (W, H), c["papel"])
    draw = ImageDraw.Draw(image)
    m = round(72 * s)
    inner = W - 2 * m

    # Cabecera: monograma + «Resúmenes Trials»; a la derecha, especialidad en versalitas y N.º.
    logo_size = round(54 * s)
    logo = Image.open(ROOT / "logo.png").convert("RGBA").resize((logo_size, logo_size), Image.LANCZOS)
    mast_top = m
    image.paste(logo, (m, mast_top + round(3 * s)), logo)
    draw.text((m + logo_size + round(14 * s), mast_top + round(42 * s)), "Resúmenes Trials", font=font("marca", round(31 * s)), fill=c["tinta"], anchor="ls")
    label_font = font("etiqueta", round(17 * s))
    specialty = "MEDICINA CRÍTICA" if critical else "MEDICINA INTERNA"
    _draw_tracked(draw, (W - m, mast_top + round(26 * s)), specialty, label_font, tone, 17 * s * .08, anchor_right=True)
    number = f"N.º {item.get('id')}"
    number_font = font("meta", round(18 * s))
    draw.text((W - m, mast_top + round(52 * s)), number, font=number_font, fill=c["secundario"], anchor="rs")

    signal_base = mast_top + round(60 * s) + round(26 * s) + round(24 * s)
    _signal_line(draw, m, signal_base, inner, 2.4 * s, 6.6 * s, 17.5 * s, 96 * s)

    # Pie: filete arena, firma editorial y dominio.
    foot_font = font("firma", round(21 * s))
    domain_font = font("meta", round(21 * s))
    foot_base = H - round(62 * s)
    rule_y = foot_base - round(38 * s)
    draw.line((m, rule_y, W - m, rule_y), fill=c["linea"], width=max(1, round(1.5 * s)))
    draw.text((m, foot_base), "Editorial EMEICRÍTICA", font=foot_font, fill=c["secundario"], anchor="ls")
    draw.text((W - m, foot_base), "resumenestrials.com", font=domain_font, fill=c["petroleo"], anchor="rs")

    # Centro: antetítulo en versalitas petróleo y el título completo (4 líneas en 16:9; 6 en 1:1 y 4:3).
    kicker = glyph_safe(f"{card_study_type(item.get('tipo_estudio'))} · {short_journal(item.get('revista'))} {item.get('anio') or ''}".strip()).upper()
    kicker_font = font("etiqueta", round(19 * s))
    tall = height / width > .7
    zone_top, zone_bottom = signal_base + round(40 * s), rule_y - round(44 * s)
    kicker_h = round(19 * s) + round(22 * s)
    title = glyph_safe(plain(item.get("titulo")))
    size, lines, lh = card_title_layout(draw, title, inner, zone_bottom - zone_top - kicker_h, round((76 if tall else 64) * s), round(32 * s), 6 if tall else 4)
    block_h = kicker_h + lh * len(lines)
    y = zone_top + max(0, (zone_bottom - zone_top - block_h) / 2)
    kicker_tracking = 19 * s * .08
    while _tracked_width(draw, kicker, kicker_font, kicker_tracking) > inner and " " in kicker:
        kicker = kicker.rsplit(" ", 1)[0].rstrip(" ·,") + "…"
    _draw_tracked(draw, (m, y + round(19 * s)), kicker, kicker_font, c["petroleo"], kicker_tracking)
    y += kicker_h
    fonts = {k: font(k, size) for k in ("titulo", "sigla")}
    space = draw.textlength(" ", font=fonts["titulo"])
    for line in lines:
        x = m
        baseline = y + size * .9
        for word, kind in line:
            draw.text((x, baseline), word, font=fonts[kind], fill=c["tinta"], anchor="ls")
            x += draw.textlength(word, font=fonts[kind]) + space
        y += lh

    image = image.resize((width, height), Image.LANCZOS)
    image.save(path, "JPEG", quality=90, optimize=True, progressive=True)
    return public_url


def image_urls(item: dict) -> list[str]:
    return [
        make_image(item, 1280, 720, "16x9"),
        make_image(item, 1200, 900, "4x3"),
        make_image(item, 1200, 1200, "1x1"),
    ]






def update_trial_jsonld(source: str, item: dict, images: list[str]) -> str:
    def updater(data):
        graph = data.get("@graph") if isinstance(data, dict) else None
        if not isinstance(graph, list):
            return
        article = next((x for x in graph if isinstance(x, dict) and x.get("@type") == "Article"), None)
        if not article:
            return
        article["image"] = images
        publisher = article.setdefault("publisher", {"@type": "Organization"})
        publisher.update({"name": "Resúmenes Trials", "url": f"{base.BASE_URL}/equipo-editorial/", "sameAs": SOCIAL_URLS})
        publisher.setdefault("logo", {"@type": "ImageObject", "url": f"{base.BASE_URL}/logo.png"})
        author = article.setdefault("author", {"@type": "Organization"})
        author.update({"name": EDITORIAL_NOMBRE, "url": f"{base.BASE_URL}/equipo-editorial/"})
        pub = item.get("fecha_publicacion_resumen")
        mod = item.get("fecha_revision") or item.get("actualizado")
        if pub:
            article["datePublished"] = str(pub)
        if mod:
            article["dateModified"] = str(mod)
    return update_jsonld_block(source, updater)


def update_trial(item: dict) -> dict:
    path = base.TRIALS_DIR / base.slug_para_item(item) / "index.html"
    source = ensure_css(path.read_text(encoding="utf-8"))
    images = image_urls(item)
    hero = images[0]
    source = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{esc(hero)}">', source, count=1)
    source = re.sub(r'<meta name="twitter:image" content="[^"]*">', f'<meta name="twitter:image" content="{esc(hero)}">', source, count=1)
    if f'<link rel="preload" as="image" href="{hero}">' not in source:
        source = source.replace('</head>', f'<link rel="preload" as="image" href="{esc(hero)}"></head>', 1)
    source = update_trial_jsonld(source, item, images)

    if item.get("fecha_publicacion_resumen") and 'property="article:published_time"' not in source:
        source = source.replace('</head>', f'<meta property="article:published_time" content="{esc(item["fecha_publicacion_resumen"])}"></head>', 1)
    if (item.get("fecha_revision") or item.get("actualizado")) and 'property="article:modified_time"' not in source:
        modified = item.get("fecha_revision") or item.get("actualizado")
        source = source.replace('</head>', f'<meta property="article:modified_time" content="{esc(modified)}"></head>', 1)

    path.write_text(source, encoding="utf-8")
    return {
        "images": images,
        "intent": {
            "question": plain(item.get("objetivo")),
            "answer": first_sentence(item.get("hallazgo"), 330),
            "population": population_text(item),
        },
    }





def update_clusters(items: list[dict]) -> None:
    # Collections are rendered from the canonical cluster manifest.
    return


# Sello editorial que firma los resúmenes (decisión del editor, 2026-10-25). La dirección médica no publica su nombre.
EDITORIAL_NOMBRE = "Editorial EMEICRÍTICA"
EDITORIAL_DESCRIPCION = ("Editorial EMEICRÍTICA, sello que publica Resúmenes Trials: dirección médica especializada en Medicina Interna "
                         "y Medicina Crítica, proceso de elaboración, verificación, financiación y correcciones.")


def editorial_head(source: str) -> str:
    """Título, descripción y datos estructurados de /equipo-editorial/ para el sello editorial."""
    titulo = f"{EDITORIAL_NOMBRE} | Resúmenes Trials"
    source = re.sub(r"<title>[^<]*</title>", f"<title>{esc(titulo)}</title>", source, count=1)
    for patron in (r'(<meta name="description" content=")[^"]*(")', r'(<meta property="og:description" content=")[^"]*(")', r'(<meta name="twitter:description" content=")[^"]*(")'):
        source = re.sub(patron, lambda m: m.group(1) + esc(EDITORIAL_DESCRIPCION) + m.group(2), source, count=1)
    for patron in (r'(<meta property="og:title" content=")[^"]*(")', r'(<meta name="twitter:title" content=")[^"]*(")'):
        source = re.sub(patron, lambda m: m.group(1) + esc(titulo) + m.group(2), source, count=1)
    return source


def update_organization_pages() -> None:
    for rel in ["equipo-editorial/index.html", "metodologia/index.html"]:
        path = ROOT / rel
        if not path.exists():
            continue
        source = ensure_css(path.read_text(encoding="utf-8"))
        source = source.replace("Resumenes Trials", "Resúmenes Trials")
        es_editorial = rel.startswith("equipo-editorial/")
        if es_editorial:
            source = editorial_head(source)
        def updater(data):
            if not isinstance(data, dict):
                return
            if data.get("@type") == "Organization" and es_editorial:
                data.update({
                    "name": EDITORIAL_NOMBRE,
                    "url": f"{base.BASE_URL}/equipo-editorial/",
                    "description": EDITORIAL_DESCRIPCION,
                    "email": "resumenestrials@outlook.com",
                    "knowsAbout": ["Medicina Crítica", "Medicina Interna", "Ensayos clínicos aleatorizados", "Medicina basada en evidencia"],
                    "publishingPrinciples": f"{base.BASE_URL}/metodologia/",
                    "brand": {"@type": "Brand", "name": "Resúmenes Trials", "url": f"{base.BASE_URL}/"},
                    "sameAs": SOCIAL_URLS,
                })
            elif data.get("@type") == "Organization":
                data["name"] = "Resúmenes Trials"
                data["sameAs"] = SOCIAL_URLS
            publisher = data.get("publisher")
            if isinstance(publisher, dict):
                publisher["name"] = "Resúmenes Trials"
                publisher["url"] = f"{base.BASE_URL}/equipo-editorial/"
                publisher["sameAs"] = SOCIAL_URLS
        source = update_jsonld_block(source, updater)
        path.write_text(source, encoding="utf-8")


def update_manifest(items: list[dict], extras: dict[str, dict]) -> None:
    if not SEO_MANIFEST.exists():
        return
    manifest = json.loads(SEO_MANIFEST.read_text(encoding="utf-8"))
    for item in items:
        key = item_id(item)
        if key not in manifest:
            continue
        manifest[key].update(extras.get(key, {}))
        if item.get("fecha_publicacion_resumen"):
            manifest[key]["datePublished"] = str(item["fecha_publicacion_resumen"])
        if item.get("fecha_revision") or item.get("actualizado"):
            manifest[key]["dateModified"] = str(item.get("fecha_revision") or item.get("actualizado"))
    SEO_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_image_notice() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    notice = """# Imágenes editoriales de trials\n\nEstas imágenes se generan automáticamente a partir de datos propios de `resumenes.json`.\nNo reproducen figuras, tablas, fotografías, logotipos de revistas ni material gráfico de terceros.\nUsan únicamente composición geométrica original, la marca Resúmenes Trials y texto factual del ensayo con fines descriptivos.\n"""
    (IMAGES_DIR / "README.md").write_text(notice, encoding="utf-8")


def main() -> None:
    items = base.validar(json.loads(base.DATA_PATH.read_text(encoding="utf-8")))
    update_home(items)
    update_interactive_home()
    extras = {}
    for item in items:
        extras[item_id(item)] = update_trial(item)
    update_clusters(items)
    update_organization_pages()
    update_manifest(items, extras)
    write_image_notice()
    print(f"SEO avanzado: portada prerenderizada, {len(items)} trials con imágenes/intención, clusters enriquecidos y rendimiento optimizado.")


if __name__ == "__main__":
    main()
