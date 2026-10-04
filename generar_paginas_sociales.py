from pathlib import Path
import json
import html
import re

from generar_seo import id_texto, ruta_trial, url_trial, slug_para_item

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "resumen"
BASE_URL = "https://resumenestrials.com"


def texto_plano(valor):
    texto = re.sub(r"<[^>]+>", " ", str(valor or ""))
    return re.sub(r"\s+", " ", texto).strip()


def recortar(valor, limite=190):
    texto = texto_plano(valor)
    if len(texto) <= limite:
        return texto
    corte = texto[: limite + 1]
    espacio = corte.rfind(" ")
    if espacio > 120:
        corte = corte[:espacio]
    return corte.rstrip() + "…"


def pagina(item, corta=False):
    trial_id = id_texto(item["id"])
    titulo_base = texto_plano(item.get("titulo")) or f"Resumen {trial_id}"
    titulo = titulo_base + (" · resumen breve" if corta else "") + " · Resúmenes Trials"
    descripcion = recortar(
        item.get("objetivo")
        or item.get("hallazgo")
        or "Resumen crítico en español de un ensayo clínico aleatorizado."
    )

    archivo = f"{trial_id}-corto.html" if corta else f"{trial_id}.html"
    destino = ruta_trial(item) + ("#resumen-breve" if corta else "")
    canonical = url_trial(item)
    social_image = f"{BASE_URL}/images/trials/{slug_para_item(item)}-16x9.jpg"

    return f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(titulo)}</title>
<meta name="description" content="{html.escape(descripcion)}">
<meta name="robots" content="noindex,follow,max-image-preview:large">
<link rel="canonical" href="{html.escape(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Resúmenes Trials">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="{html.escape(titulo)}">
<meta property="og:description" content="{html.escape(descripcion)}">
<meta property="og:url" content="{html.escape(canonical)}">
<meta property="og:image" content="{social_image}">
<meta property="og:image:secure_url" content="{social_image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="Ilustración editorial de {html.escape(titulo_base)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(titulo)}">
<meta name="twitter:description" content="{html.escape(descripcion)}">
<meta name="twitter:image" content="{social_image}">
<meta name="twitter:image:alt" content="Ilustración editorial de {html.escape(titulo_base)}">
<script>window.location.replace({json.dumps(destino)});</script>
</head>
<body>
<p>Abriendo el resumen de <strong>{html.escape(titulo_base)}</strong>…</p>
<p><a href="{html.escape(destino)}">Continuar al resumen</a></p>
</body>
</html>
'''


def main():
    with (ROOT / "resumenes.json").open("r", encoding="utf-8") as f:
        datos = json.load(f)

    OUT.mkdir(exist_ok=True)
    expected = {
        f'{id_texto(item["id"])}{suffix}.html'
        for item in datos
        if "id" in item
        for suffix in (["", "-corto"] if item.get("corto") else [""])
    }
    stale = sorted(archivo.name for archivo in OUT.glob("*.html") if archivo.name not in expected)
    if stale:
        raise RuntimeError(
            "Hay páginas sociales obsoletas que requieren revisión manual; "
            "no se eliminaron: " + ", ".join(stale)
        )

    generadas = 0
    for item in datos:
        if "id" not in item:
            continue
        trial_id = id_texto(item["id"])
        (OUT / f'{trial_id}.html').write_text(pagina(item, corta=False), encoding="utf-8")
        generadas += 1
        if item.get("corto"):
            (OUT / f'{trial_id}-corto.html').write_text(pagina(item, corta=True), encoding="utf-8")
            generadas += 1

    print(f"Generadas {generadas} páginas sociales a partir de {len(datos)} resúmenes.")


if __name__ == "__main__":
    main()
