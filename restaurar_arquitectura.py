from __future__ import annotations

from pathlib import Path
import json
import re

import generar_seo as base

ROOT = base.ROOT
TRIALS_DIR = ROOT / "trials"
CLUSTER_MANIFEST = ROOT / "seo-cluster-manifest.json"
SEO_MANIFEST = ROOT / "seo-manifest.json"


def limpiar_trial(path: Path) -> None:
    """Conserva metadatos SEO/imágenes sociales sin alterar la arquitectura editorial visible."""
    source = path.read_text(encoding="utf-8")

    # La imagen editorial sigue disponible en Open Graph, Twitter y Article JSON-LD,
    # pero no se muestra como una portada gigante dentro del resumen.
    source = re.sub(
        r"\s*<!-- RT-HERO-START -->.*?<!-- RT-HERO-END -->\s*",
        "\n",
        source,
        flags=re.S,
    )

    # La ficha de seis paneles duplicaba objetivo, hallazgo, población y conclusión
    # que ya forman parte del resumen largo y del resumen breve. La intención de
    # búsqueda se conserva en metadatos/manifest, no como contenido repetido.
    source = re.sub(
        r"\s*<!-- RT-INTENT-START -->.*?<!-- RT-INTENT-END -->\s*",
        "\n",
        source,
        flags=re.S,
    )

    # Ya no existe un hero visible: precargar su JPG desperdicia ancho de banda y
    # puede empeorar LCP. Las URLs permanecen en og:image y JSON-LD.
    source = re.sub(
        r'\s*<link rel="preload" as="image" href="https://resumenestrials\.com/images/trials/[^"]+">',
        "",
        source,
    )

    # Evita acumulación de espacios/rupturas creada por capas sucesivas.
    source = re.sub(r"</header>\s*\n\s*<article class=\"articulo\">", '</header>\n<article class="articulo">', source, count=1)
    path.write_text(source, encoding="utf-8")


def limpiar_clusters() -> None:
    """Devuelve los clusters a su arquitectura de colección, sin duplicar cada trial."""
    if not CLUSTER_MANIFEST.exists():
        return
    clusters = json.loads(CLUSTER_MANIFEST.read_text(encoding="utf-8"))
    for entry in clusters.values():
        path = ROOT / str(entry["path"]).lstrip("/") / "index.html"
        if not path.exists():
            continue
        source = path.read_text(encoding="utf-8")
        source = re.sub(
            r"\s*<!-- RT-CLUSTER-SYNTHESIS-START -->.*?<!-- RT-CLUSTER-SYNTHESIS-END -->\s*",
            "\n",
            source,
            flags=re.S,
        )
        path.write_text(source, encoding="utf-8")


def validar_arquitectura() -> None:
    manifest = json.loads(SEO_MANIFEST.read_text(encoding="utf-8"))
    errors: list[str] = []

    for trial_id, entry in manifest.items():
        path = ROOT / str(entry["path"]).lstrip("/") / "index.html"
        if not path.is_file():
            errors.append(f"id {trial_id}: falta {path}")
            continue
        source = path.read_text(encoding="utf-8")
        if "RT-HERO-START" in source or 'class="trial-hero"' in source:
            errors.append(f"id {trial_id}: todavía tiene hero visible")
        if "RT-INTENT-START" in source or 'class="respuesta-clinica"' in source:
            errors.append(f"id {trial_id}: todavía tiene resumen duplicado")
        if '<article class="articulo">' not in source:
            errors.append(f"id {trial_id}: falta artículo principal")
        if 'images/trials/' not in source:
            errors.append(f"id {trial_id}: perdió imagen social/estructurada")
        if '<link rel="canonical"' not in source:
            errors.append(f"id {trial_id}: perdió canonical")

    if CLUSTER_MANIFEST.exists():
        clusters = json.loads(CLUSTER_MANIFEST.read_text(encoding="utf-8"))
        for slug, entry in clusters.items():
            path = ROOT / str(entry["path"]).lstrip("/") / "index.html"
            source = path.read_text(encoding="utf-8") if path.is_file() else ""
            if "RT-CLUSTER-SYNTHESIS-START" in source or 'class="cluster-synthesis"' in source:
                errors.append(f"cluster {slug}: conserva síntesis duplicada")
            if '<section class="cat-grid">' not in source:
                errors.append(f"cluster {slug}: perdió la colección de trials")

    # Regresión concreta detectada durante la revisión: REBOARREST no es un
    # ensayo de sepsis y no debe aparecer en ese cluster.
    if CLUSTER_MANIFEST.exists():
        clusters = json.loads(CLUSTER_MANIFEST.read_text(encoding="utf-8"))
        sepsis = clusters.get("sepsis-shock", {})
        if "24" in [str(x) for x in sepsis.get("trial_ids", [])]:
            errors.append("cluster sepsis-shock: REBOARREST (id 24) clasificado erróneamente")

    if errors:
        raise SystemExit("Arquitectura inválida:\n- " + "\n- ".join(errors))


def main() -> None:
    for path in sorted(TRIALS_DIR.glob("*/index.html")):
        limpiar_trial(path)
    limpiar_clusters()
    validar_arquitectura()
    print("PASS: arquitectura editorial restaurada; SEO no visual conservado")


if __name__ == "__main__":
    main()
