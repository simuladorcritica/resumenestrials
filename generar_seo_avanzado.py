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
SOCIAL_URLS = ["https://x.com/resumenestrials", "https://t.me/ResumenesTrials"]


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
# Sora y Literata (OFL), las mismas del sitio y de la tarjeta de X. Si faltan, la
# generación se detiene: nunca se publica una imagen con la fuente de emergencia de
# Pillow (diminuta y sin acentos ni eñe).
FONT_FILES = {"marca": "Sora-700.ttf", "etiqueta": "Sora-600.ttf", "titulo": "Literata-600.ttf", "texto": "Literata-400.ttf"}
# Subconjunto latino de las fuentes: lo demás se traduce o se quita para que no salgan cuadros vacíos.
_GLYPH_EXTRA = {0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x20AC, 0x2122, 0x2191, 0x2193, 0x2212, 0x2215}
_GLYPH_EQUIV = {"≥": ">=", "≤": "<=", "→": "->", "←": "<-", "α": "alfa", "β": "beta", "γ": "gamma", "δ": "delta", "κ": "kappa", "μ": "µ", "≈": "~", "≠": "!=", "∼": "~"}


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


def wrap_text(draw, text: str, font_obj, max_width: int, max_lines: int = 4) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = (current + " " + word).strip()
        box = draw.textbbox((0, 0), trial, font=font_obj)
        if current and box[2] - box[0] > max_width:
            lines.append(current)
            current = word
            if len(lines) >= max_lines:
                break
        else:
            current = trial
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and len(" ".join(lines)) < len(text):
        last = lines[-1]
        while last and draw.textbbox((0, 0), last.rstrip(" ,.;:") + "…", font=font_obj)[2] > max_width:
            last = last.rsplit(" ", 1)[0] if " " in last else last[:-1]
        lines[-1] = last.rstrip(" ,.;:") + "…"
    return lines


def fit_text(draw, text: str, kind: str, size_max: int, size_min: int, max_width: int, max_lines: int):
    """Mayor tamaño con el que el texto cabe en max_lines; si no cabe, se recorta con «…»."""
    for size in range(size_max, size_min - 1, -2):
        font_obj = font(kind, size)
        lines = wrap_text(draw, text, font_obj, max_width, max_lines + 1)
        if len(lines) <= max_lines and not lines[-1].endswith("…"):
            return font_obj, lines
    font_obj = font(kind, size_min)
    return font_obj, wrap_text(draw, text, font_obj, max_width, max_lines)


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

    # Misma familia visual que la tarjeta de X: fondo oscuro, franja de la especialidad,
    # sigla grande, revista y año, y el título. Solo texto ya publicado del resumen.
    critical = "Medicina Crítica" in base.categorias(item)
    bg, ink, muted, brand_blue = (7, 11, 22), (237, 241, 255), (166, 176, 207), (122, 184, 255)
    accent = (255, 159, 128) if critical else (185, 162, 255)
    image = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(image)
    s = width / 1200
    margin = int(72 * s)
    inner = width - 2 * margin

    draw.rectangle((0, 0, width, max(8, int(10 * s))), fill=accent)
    draw.text((margin, int(52 * s)), "RESÚMENES TRIALS", font=font("marca", int(26 * s)), fill=brand_blue)
    chip_text = "MEDICINA CRÍTICA" if critical else "MEDICINA INTERNA"
    chip_font = font("etiqueta", int(19 * s))
    chip_w = draw.textlength(chip_text, font=chip_font) + int(36 * s)
    chip_h = int(40 * s)
    chip_y = int(46 * s)
    draw.rounded_rectangle((width - margin - chip_w, chip_y, width - margin, chip_y + chip_h), radius=chip_h // 2, outline=accent, width=max(2, int(2 * s)))
    draw.text((width - margin - chip_w + int(18 * s), chip_y + int(9 * s)), chip_text, font=chip_font, fill=accent)

    title = glyph_safe(plain(item.get("titulo")))
    split = title.find(": ")
    acronym, rest = (title[:split], title[split + 2:]) if 0 < split <= 40 else ("", title)
    footer_y = height - int(84 * s)
    top, bottom = int(128 * s), footer_y - int(56 * s)
    acr_font = acr_lines = None
    if acronym:
        acr_font, acr_lines = fit_text(draw, acronym, "marca", int(96 * s), int(52 * s), inner, 1)
    meta = " · ".join(x for x in [glyph_safe(short_journal(item.get("revista"))), str(item.get("anio") or "")] if x)
    meta_font = font("etiqueta", int(30 * s))
    acr_h = int(acr_font.size * 1.22) if acr_font else 0
    meta_h = int(62 * s)
    lines_room = max(2, int((bottom - top - acr_h - meta_h) // (46 * s * 1.3)))
    title_font, title_lines = fit_text(draw, rest[:1].upper() + rest[1:], "titulo", int(50 * s), int(34 * s), inner, min(lines_room, 5))
    line_h = int(title_font.size * 1.3)
    block_h = acr_h + meta_h + line_h * len(title_lines)
    y = top + max(0, (bottom - top - block_h) // 2)
    if acr_font:
        draw.text((margin, y), acr_lines[0], font=acr_font, fill=ink)
        y += acr_h
    draw.text((margin, y), meta, font=meta_font, fill=accent)
    y += meta_h
    for line in title_lines:
        draw.text((margin, y), line, font=title_font, fill=ink)
        y += line_h

    draw.line((margin, footer_y - int(26 * s), width - margin, footer_y - int(26 * s)), fill=(35, 49, 84), width=max(2, int(2 * s)))
    foot_font = font("etiqueta", int(24 * s))
    draw.text((margin, footer_y), "resumenestrials.com", font=foot_font, fill=brand_blue)
    topics = [glyph_safe(plain(x)) for x in (item.get("temas") or [])]
    if topics:
        topic = topics[0]
        while topic and draw.textlength(topic, font=foot_font) > inner * 0.55:
            topic = topic[:-2].rstrip() + "…" if len(topic) > 3 else ""
        draw.text((width - margin - draw.textlength(topic, font=foot_font), footer_y), topic, font=foot_font, fill=muted)

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
