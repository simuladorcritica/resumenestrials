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


def font(size: int, bold: bool = False):
    from PIL import ImageFont
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            pass
    return ImageFont.load_default()


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
        lines[-1] = lines[-1].rstrip(" ,.;:") + "…"
    return lines


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

    critical = "Medicina Crítica" in base.categorias(item)
    bg = (247, 246, 242)
    ink = (18, 35, 59)
    muted = (56, 80, 110)
    accent = (15, 95, 95) if critical else (138, 74, 28)
    amber = (200, 137, 42)
    image = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(image)

    # Geometría original determinista: no usa figuras, logos ni material del artículo.
    digest = hashlib.sha256(item_id(item).encode()).digest()
    for i in range(5):
        x = int((digest[i] / 255) * width * 0.75 + width * 0.1)
        y = int((digest[i + 5] / 255) * height * 0.55 + height * 0.2)
        r = int(min(width, height) * (0.055 + digest[i + 10] / 255 * 0.08))
        shade = tuple(int(c * 0.88 + 255 * 0.12) for c in accent)
        draw.ellipse((x-r, y-r, x+r, y+r), outline=shade, width=max(2, width // 420))
    draw.line((width * .07, height * .15, width * .93, height * .15), fill=accent, width=max(3, width // 320))
    draw.rectangle((0, 0, int(width * .028), height), fill=accent)

    pad = int(width * .075)
    brand_font = font(max(18, int(height * .027)), True)
    label_font = font(max(18, int(height * .025)), False)
    acronym_font = font(max(42, int(height * .105)), True)
    title_font = font(max(25, int(height * .047)), False)
    topic_font = font(max(18, int(height * .025)), False)

    draw.text((pad, int(height * .07)), "RESÚMENES TRIALS", font=brand_font, fill=accent)
    category = base.categorias(item)[0] if base.categorias(item) else "Ensayo clínico"
    cat_box = draw.textbbox((0, 0), category.upper(), font=label_font)
    draw.text((width - pad - (cat_box[2]-cat_box[0]), int(height * .07)), category.upper(), font=label_font, fill=muted)

    title = plain(item.get("titulo"))
    acronym, rest = (title.split(":", 1) + [""])[:2] if ":" in title else (title, "")
    y = int(height * .24)
    draw.text((pad, y), cut(acronym, 28), font=acronym_font, fill=ink)
    y += int(height * .15)
    main_text = rest.strip() or title
    for line in wrap_text(draw, main_text, title_font, int(width * .78), 4 if height >= width else 3):
        draw.text((pad, y), line, font=title_font, fill=ink)
        y += int(height * .07)

    topics = [plain(x) for x in (item.get("temas") or [])][:3]
    topic_text = " · ".join(topics) or "Ensayo clínico aleatorizado"
    draw.text((pad, int(height * .86)), cut(topic_text, 90), font=topic_font, fill=amber)
    draw.text((pad, int(height * .92)), "Resumen crítico en español · imagen editorial original", font=label_font, fill=muted)

    image.save(path, "JPEG", quality=88, optimize=True, progressive=True)
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
        author.update({"name": "Equipo editorial de Resúmenes Trials", "url": f"{base.BASE_URL}/equipo-editorial/"})
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


def update_organization_pages() -> None:
    for rel in ["equipo-editorial/index.html", "metodologia/index.html"]:
        path = ROOT / rel
        if not path.exists():
            continue
        source = ensure_css(path.read_text(encoding="utf-8"))
        source = source.replace("Resumenes Trials", "Resúmenes Trials")
        def updater(data):
            if not isinstance(data, dict):
                return
            if data.get("@type") == "Organization":
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
