from pathlib import Path
import json
import html
import re

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
    trial_id = str(item["id"])
    titulo_base = texto_plano(item.get("titulo")) or f"Resumen {trial_id}"
    titulo = titulo_base + (" · resumen breve" if corta else "") + " · Resumenes Trials"
    descripcion = recortar(
        item.get("objetivo")
        or item.get("hallazgo")
        or "Resumen crítico en español de un ensayo clínico aleatorizado."
    )

    archivo = f"{trial_id}-corto.html" if corta else f"{trial_id}.html"
    url_social = f"{BASE_URL}/resumen/{archivo}"
    destino = f"../resumen.html?id={trial_id}" + ("&v=corto" if corta else "")
    canonical = f"{BASE_URL}/resumen.html?id={trial_id}"

    # Se usa deliberadamente el logo oficial. X lo muestra como tarjeta cuadrada
    # sin crear ni deformar una imagen de marca alternativa.
    logo = f"{BASE_URL}/logo.png"

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
<meta property="og:site_name" content="Resumenes Trials">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="{html.escape(titulo)}">
<meta property="og:description" content="{html.escape(descripcion)}">
<meta property="og:url" content="{html.escape(url_social)}">
<meta property="og:image" content="{logo}">
<meta property="og:image:secure_url" content="{logo}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="Logo oficial de Resumenes Trials">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{html.escape(titulo)}">
<meta name="twitter:description" content="{html.escape(descripcion)}">
<meta name="twitter:image" content="{logo}">
<meta name="twitter:image:alt" content="Logo oficial de Resumenes Trials">

<script>
  window.location.replace({json.dumps(destino)});
</script>
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

    # Elimina únicamente páginas HTML generadas anteriormente.
    for archivo in OUT.glob("*.html"):
        archivo.unlink()

    generadas = 0
    for item in datos:
        if "id" not in item:
            continue

        (OUT / f'{item["id"]}.html').write_text(
            pagina(item, corta=False), encoding="utf-8"
        )
        generadas += 1

        if item.get("corto"):
            (OUT / f'{item["id"]}-corto.html').write_text(
                pagina(item, corta=True), encoding="utf-8"
            )
            generadas += 1

    print(f"Generadas {generadas} páginas sociales a partir de {len(datos)} resúmenes.")


if __name__ == "__main__":
    main()
