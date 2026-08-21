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
INTERACTIVE_HOME = ROOT / "interactive-home.js"
CLUSTER_MANIFEST = ROOT / "seo-cluster-manifest.json"
SEO_MANIFEST = ROOT / "seo-manifest.json"
IMAGES_DIR = ROOT / "images" / "trials"
SOCIAL_URLS = ["https://x.com/resumenestrials", "https://t.me/ResumenesTrials"]


def plain(value: object) -> str:
    return base.texto_plano(value)


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


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


def clinical_change(item: dict) -> str:
    conclusion = section_text(item, ["Aplicación clínica", "Conclusión", "Interpretación clínica", "Conclusiones"], 420)
    if conclusion:
        return conclusion
    answer = first_sentence(item.get("hallazgo"), 300)
    if answer:
        return "El dato que debe incorporarse a la lectura clínica es el desenlace observado: " + answer
    return "La interpretación práctica debe apoyarse en el desenlace primario, la magnitud del efecto y las limitaciones descritas en el resumen."


def what_not_proven(item: dict) -> str:
    return (
        "El ensayo no demuestra que sus resultados puedan extrapolarse a pacientes fuera de la población estudiada, "
        "a intervenciones distintas de las comparadas ni a desenlaces que no fueron preespecificados. Los resultados secundarios "
        "y análisis exploratorios deben interpretarse según su diseño y control de multiplicidad."
    )


def home_badges(item: dict) -> str:
    out = []
    for category in base.categorias(item):
        klass = "critica" if category == "Medicina Crítica" else "interna"
        out.append(f'<span class="badge {klass}">{esc(category)}</span>')
    return '<div class="etiquetas">' + "".join(out) + "</div>" if out else ""


def human_date(value: object) -> str:
    v = str(value or "")
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", v)
    return f"{m.group(3)}/{m.group(2)}/{m.group(1)}" if m else v


def home_row(item: dict) -> str:
    date_text = f" · {human_date(item.get('fecha'))}" if item.get("fecha") else ""
    doi = f" · {esc(item.get('doi'))}" if item.get("doi") else ""
    short = (
        f'<a class="abrir abrir-breve" href="resumen.html?id={esc(item.get("id"))}&amp;v=corto">Resumen breve →</a>'
        if item.get("corto") else ""
    )
    return f'''<li class="fila" data-id="{esc(item.get('id'))}">
<a class="cabeza" href="{esc(base.ruta_trial(item))}">
<span class="fila-cuerpo">{home_badges(item)}<h3>{esc(plain(item.get('titulo')))}</h3>
<span class="fuente">{esc(plain(item.get('autor')))} · {esc(plain(item.get('revista')))}{date_text}{doi}</span></span>
<span class="fila-flecha">→</span></a>
<div class="fila-pdf"><button type="button" class="btn-pdf" data-id="{esc(item.get('id'))}" aria-label="Descargar el resumen completo en PDF">⬇ Descargar resumen en PDF</button></div>
<div class="adelanto"><div class="adelanto-interior"><div class="adelanto-caja">
<div class="obj">{item.get('objetivo') or ''}</div><div class="hallazgo">{item.get('hallazgo') or ''}</div>
<div class="abrir-links"><a class="abrir" href="{esc(base.ruta_trial(item))}">Resumen completo →</a>{short}</div>
</div></div></div></li>'''


def render_home(items: list[dict]) -> str:
    ordered = sorted(items, key=lambda x: str(x.get("fecha") or ""), reverse=True)
    groups: dict[str, list[dict]] = {}
    for item in ordered:
        year = str(item.get("anio") or (str(item.get("fecha") or "")[:4]) or "Otros")
        groups.setdefault(year, []).append(item)
    out = []
    for year in sorted(groups, key=lambda x: int(x) if x.isdigit() else -1, reverse=True):
        rows = "".join(home_row(x) for x in groups[year])
        out.append(
            f'<section class="grupo-anio"><div class="anio-margen"><span class="anio-num">{esc(year)}</span></div>'
            f'<ol class="lista-anio">{rows}</ol></section>'
        )
    return "".join(out)


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
    if '/seo-pro.css' not in source:
        source = source.replace('</head>', '<link rel="stylesheet" href="/seo-pro.css?v=1"></head>', 1)
    return source


def update_home(items: list[dict]) -> None:
    source = HOME_SOURCE.read_text(encoding="utf-8")
    source = source.replace('lang="es"', 'lang="es-MX"', 1)
    source = source.replace("Resumenes Trials", "Resúmenes Trials")
    source = source.replace("RESUMENES TRIALS", "RESÚMENES TRIALS")
    source = ensure_css(source)

    total = len(items)
    n_critical = sum("Medicina Crítica" in base.categorias(x) for x in items)
    n_internal = sum("Medicina Interna" in base.categorias(x) for x in items)
    for element_id, value in [("conteo", total), ("conteo-crit", n_critical), ("conteo-int", n_internal),
                              ("n-todos", total), ("n-crit", n_critical), ("n-int", n_internal)]:
        source = re.sub(
            rf'(<span[^>]+id="{re.escape(element_id)}"[^>]*>).*?(</span>)',
            rf'\g<1>{value}\g<2>', source, count=1, flags=re.S,
        )

    prerender = render_home(items)
    start = '<!-- RT-PRERENDER-START -->'
    end = '<!-- RT-PRERENDER-END -->'
    if start in source and end in source:
        source = re.sub(re.escape(start) + r'.*?' + re.escape(end), start + prerender + end, source, count=1, flags=re.S)
    else:
        source = source.replace('<div class="indice" id="indice"></div>', f'<div class="indice" id="indice">{start}{prerender}{end}</div>', 1)

    routes = {str(x["id"]): base.ruta_trial(x) for x in items}
    route_js = (
        '  // RT-SEO-ROUTES-START\n'
        '  const seoRutas = ' + json.dumps(routes, ensure_ascii=False, separators=(",", ":")) + ';\n'
        '  const rutaCanonical = (r) => seoRutas[String(r.id)] || `resumen.html?id=${r.id}`;\n'
        '  // RT-SEO-ROUTES-END\n'
    )
    if '// RT-SEO-ROUTES-START' in source:
        source = re.sub(r'  // RT-SEO-ROUTES-START.*?  // RT-SEO-ROUTES-END\n', route_js, source, count=1, flags=re.S)
    else:
        source = source.replace('  let filtroEsp = "todos";\n', '  let filtroEsp = "todos";\n' + route_js, 1)

    source = source.replace('<li class="fila">\n        <a class="cabeza" href="resumen.html?id=${r.id}">',
                            '<li class="fila" data-id="${r.id}">\n        <a class="cabeza" href="${rutaCanonical(r)}">')
    source = source.replace('<a class="abrir" href="resumen.html?id=${r.id}">Resumen completo →</a>',
                            '<a class="abrir" href="${rutaCanonical(r)}">Resumen completo →</a>')
    source = source.replace('doc.text("resumenestrials.com/resumen.html?id=" + r.id, ML, pageH - 31);',
                            'doc.text("resumenestrials.com" + rutaCanonical(r), ML, pageH - 31);')

    # jsPDF se carga únicamente cuando alguien solicita un PDF.
    source = re.sub(r'\s*<script src="https://cdnjs\.cloudflare\.com/ajax/libs/jspdf/[^/]+/jspdf\.umd\.min\.js"[^>]*></script>', '', source, count=1)
    loader = '''  async function cargarJsPDF() {
    if (window.jspdf?.jsPDF) return window.jspdf;
    if (!window.__rtJsPdfPromise) {
      window.__rtJsPdfPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js";
        s.integrity = "sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3";
        s.crossOrigin = "anonymous";
        s.async = true;
        s.onload = () => resolve(window.jspdf);
        s.onerror = () => reject(new Error("No se pudo cargar jsPDF"));
        document.head.appendChild(s);
      });
    }
    return window.__rtJsPdfPromise;
  }
'''
    if 'async function cargarJsPDF()' not in source:
        source = source.replace('  async function generarPDF(r) {\n', loader + '  async function generarPDF(r) {\n', 1)
    source = source.replace('    const ns = window.jspdf;\n    if (!ns || !ns.jsPDF)',
                            '    const ns = await cargarJsPDF();\n    if (!ns || !ns.jsPDF)')

    source = source.replace(
        '      cont.innerHTML = `<div class="sin-resultados">No se pudieron cargar los resúmenes en este momento. Recarga la página en unos segundos.</div>`;',
        '      if (!cont.querySelector(".fila")) cont.innerHTML = `<div class="sin-resultados">No se pudieron cargar los resúmenes en este momento. Recarga la página en unos segundos.</div>`;'
    )

    def home_jsonld(data):
        if not isinstance(data, dict) or data.get("@type") != "WebSite":
            return
        data["name"] = "Resúmenes Trials"
        data["alternateName"] = ["Resumenes Trials", "Evidencia sin ruido"]
        publisher = data.setdefault("publisher", {"@type": "Organization"})
        publisher.update({
            "name": "Resúmenes Trials",
            "url": f"{base.BASE_URL}/equipo-editorial/",
            "logo": {"@type": "ImageObject", "url": f"{base.BASE_URL}/logo.png"},
            "sameAs": SOCIAL_URLS,
        })
    source = update_jsonld_block(source, home_jsonld)
    HOME_SOURCE.write_text(source, encoding="utf-8")


def update_interactive_home() -> None:
    source = INTERACTIVE_HOME.read_text(encoding="utf-8")
    old = '''function articleId(row) {
  const a = row.querySelector('a.cabeza[href*="resumen.html?id="]');
  if (!a) return null;
  try { return new URL(a.href, location.href).searchParams.get('id'); }
  catch { return null; }
}'''
    new = '''function articleId(row) {
  const direct = row?.dataset?.id;
  if (direct) return direct;
  const a = row.querySelector('a.cabeza[href*="resumen.html?id="]');
  if (!a) return null;
  try { return new URL(a.href, location.href).searchParams.get('id'); }
  catch { return null; }
}'''
    if old in source:
        source = source.replace(old, new, 1)
    INTERACTIVE_HOME.write_text(source, encoding="utf-8")


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
    digest = hashlib.sha256(str(item.get("id")).encode()).digest()
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


def trial_intent_block(item: dict) -> str:
    answer = first_sentence(item.get("hallazgo"), 330)
    return f'''<!-- RT-INTENT-START --><section class="respuesta-clinica" aria-labelledby="respuesta-clinica-{esc(item.get('id'))}">
<p class="eyebrow">Lectura rápida</p><h2 id="respuesta-clinica-{esc(item.get('id'))}">Respuesta clínica rápida</h2>
<div class="respuesta-grid">
<div><h3>Pregunta clínica</h3><p>{item.get('objetivo') or ''}</p></div>
<div><h3>Resultado principal</h3><p>{item.get('hallazgo') or ''}</p></div>
<div><h3>Respuesta en una frase</h3><p>{esc(answer)}</p></div>
<div><h3>Qué cambia</h3><p>{esc(clinical_change(item))}</p></div>
<div><h3>Qué no demuestra</h3><p>{esc(what_not_proven(item))}</p></div>
<div><h3>Población a la que aplica</h3><p>{esc(population_text(item))}</p></div>
</div></section><!-- RT-INTENT-END -->'''


def editorial_dates(item: dict) -> str:
    published = str(item.get("fecha_publicacion_resumen") or "").strip()
    modified = str(item.get("fecha_revision") or item.get("actualizado") or "").strip()
    if not published and not modified:
        return ""
    parts = []
    if published:
        parts.append(f'<span>Publicado en Resúmenes Trials: <time datetime="{esc(published)}">{esc(base.fecha_humana(published))}</time></span>')
    if modified:
        parts.append(f'<span>Última revisión: <time datetime="{esc(modified)}">{esc(base.fecha_humana(modified))}</time></span>')
    return '<div class="fechas-editoriales">' + " · ".join(parts) + '</div>'


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

    figure = f'''<!-- RT-HERO-START --><figure class="trial-hero"><img src="{esc(hero)}" width="1280" height="720" alt="Imagen editorial de {esc(plain(item.get('titulo')))}" fetchpriority="high" decoding="async"><figcaption>Imagen editorial original de Resúmenes Trials. No reproduce figuras del artículo ni logotipos de la revista.</figcaption></figure><!-- RT-HERO-END -->'''
    if '<!-- RT-HERO-START -->' in source:
        source = re.sub(r'<!-- RT-HERO-START -->.*?<!-- RT-HERO-END -->', figure, source, count=1, flags=re.S)
    else:
        source = source.replace('</header>\n<article class="articulo">', '</header>' + figure + '\n' + trial_intent_block(item) + '\n<article class="articulo">', 1)

    intent = trial_intent_block(item)
    if '<!-- RT-INTENT-START -->' in source:
        source = re.sub(r'<!-- RT-INTENT-START -->.*?<!-- RT-INTENT-END -->', intent, source, count=1, flags=re.S)
    elif '<article class="articulo">' in source:
        source = source.replace('<article class="articulo">', intent + '<article class="articulo">', 1)

    dates = editorial_dates(item)
    source = re.sub(r'<div class="fechas-editoriales">.*?</div>', '', source, flags=re.S)
    if dates:
        source = source.replace('</header>', dates + '</header>', 1)
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


def cluster_synthesis(name: str, description: str, items: list[dict]) -> str:
    ordered = sorted(items, key=lambda x: str(x.get("fecha") or ""), reverse=True)
    topics = Counter(plain(t) for x in items for t in (x.get("temas") or []) if plain(t))
    topic_text = ", ".join(x for x, _ in topics.most_common(6))
    intro = (
        f"Esta biblioteca reúne {len(items)} ensayos clínicos relacionados con {name.lower()}. "
        f"Las preguntas publicadas abarcan {topic_text or 'intervenciones y desenlaces clínicos complementarios'}. "
        "La lectura transversal no combina estudios como si estimaran un único efecto: cada ensayo conserva su población, comparador, desenlace primario y limitaciones. "
        "El objetivo de esta página es mostrar qué preguntas ya tienen evidencia aleatorizada reciente, dónde convergen los resultados y qué incertidumbres siguen abiertas."
    )
    trial_blocks = []
    practical = []
    uncertainty = []
    for item in ordered[:6]:
        title = plain(item.get("titulo"))
        objective = cut(item.get("objetivo"), 230)
        finding = cut(item.get("hallazgo"), 250)
        trial_blocks.append(
            f'<article class="sintesis-trial"><h3><a href="{esc(base.ruta_trial(item))}">{esc(title)}</a></h3>'
            f'<p><strong>Pregunta:</strong> {esc(objective)} <strong>Resultado:</strong> {esc(finding)}</p></article>'
        )
        practical.append(f'<li><a href="{esc(base.ruta_trial(item))}">{esc(title.split(":",1)[0])}</a>: {esc(first_sentence(item.get("hallazgo"), 260))}</li>')
        limitation = section_text(item, ["Evaluación crítica del riesgo de sesgo", "Evaluación crítica", "Limitaciones", "Riesgo de sesgo"], 360)
        if limitation:
            uncertainty.append(f'<li><strong>{esc(title.split(":",1)[0])}:</strong> {esc(first_sentence(limitation, 280))}</li>')

    transversal = (
        f"Los estudios de este cluster cubren {len(topics)} ejes temáticos identificados en la biblioteca. "
        "Eso permite comparar el tipo de pregunta que se está investigando, pero no justificar una metaanálisis informal entre intervenciones distintas. "
        "Para decidir si un resultado es aplicable a un paciente concreto deben revisarse los criterios de inclusión, el comparador, el desenlace primario, la magnitud del efecto y la precisión de sus intervalos."
    )
    uncertain_html = "".join(uncertainty) or '<li>La incertidumbre principal debe revisarse ensayo por ensayo en la sección de evaluación crítica; no se extrapolan efectos fuera de las poblaciones estudiadas.</li>'
    return f'''<!-- RT-CLUSTER-SYNTHESIS-START --><section class="cluster-synthesis">
<p class="eyebrow">Síntesis editorial</p><h2>Qué evidencia reciente tenemos</h2><p>{esc(intro)}</p>
<div class="sintesis-trials">{"".join(trial_blocks)}</div>
<h2>Lectura transversal</h2><p>{esc(transversal)}</p>
<h2>Hallazgos con relevancia práctica</h2><ul>{"".join(practical)}</ul>
<h2>Qué sigue incierto</h2><ul>{uncertain_html}</ul>
<p class="nota-metodo">Esta síntesis se construye exclusivamente a partir de los resúmenes críticos publicados en la biblioteca y conserva enlaces a cada ensayo para verificar población, método, resultados y limitaciones.</p>
</section><!-- RT-CLUSTER-SYNTHESIS-END -->'''


def update_clusters(items: list[dict]) -> None:
    if not CLUSTER_MANIFEST.exists():
        return
    manifest = json.loads(CLUSTER_MANIFEST.read_text(encoding="utf-8"))
    by_id = {str(x["id"]): x for x in items}
    for slug, entry in manifest.items():
        values = [by_id[x] for x in entry.get("trial_ids", []) if x in by_id]
        path = ROOT / str(entry["path"]).lstrip("/") / "index.html"
        if not path.exists():
            continue
        source = ensure_css(path.read_text(encoding="utf-8"))
        synthesis = cluster_synthesis(entry["name"], "", values)
        if '<!-- RT-CLUSTER-SYNTHESIS-START -->' in source:
            source = re.sub(r'<!-- RT-CLUSTER-SYNTHESIS-START -->.*?<!-- RT-CLUSTER-SYNTHESIS-END -->', synthesis, source, count=1, flags=re.S)
        else:
            marker = '<nav class="cluster-related">' if '<nav class="cluster-related">' in source else '<section class="cat-grid">'
            source = source.replace(marker, synthesis + marker, 1)
        path.write_text(source, encoding="utf-8")


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
        key = str(item["id"])
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
        extras[str(item["id"])] = update_trial(item)
    update_clusters(items)
    update_organization_pages()
    update_manifest(items, extras)
    write_image_notice()
    print(f"SEO avanzado: portada prerenderizada, {len(items)} trials con imágenes/intención, clusters enriquecidos y rendimiento optimizado.")


if __name__ == "__main__":
    main()
