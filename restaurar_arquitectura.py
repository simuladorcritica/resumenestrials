from __future__ import annotations

from pathlib import Path
import json
import re

import generar_seo as base

ROOT = base.ROOT
TRIALS_DIR = ROOT / "trials"
CLUSTER_MANIFEST = ROOT / "seo-cluster-manifest.json"
SEO_MANIFEST = ROOT / "seo-manifest.json"
INTERNAL_UX = ROOT / "internal-medicine-ux.js"


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


def adaptar_descargas_portada() -> None:
    """Mantiene los PDF de portada al migrar sus enlaces a /trials/.../."""
    if not INTERNAL_UX.exists():
        return
    source = INTERNAL_UX.read_text(encoding="utf-8")

    old_row_id = '''function rowId(row) {
  const link = row.querySelector('a.cabeza[href*="resumen.html?id="]');
  if (!link) return '';
  try { return new URL(link.href, location.href).searchParams.get('id') || ''; }
  catch { return ''; }
}'''
    new_row_id = '''function rowId(row) {
  const direct = row?.dataset?.id;
  if (direct) return String(direct);
  const link = row.querySelector('a.cabeza[href*="resumen.html?id="]');
  if (!link) return '';
  try { return new URL(link.href, location.href).searchParams.get('id') || ''; }
  catch { return ''; }
}'''
    if old_row_id in source:
        source = source.replace(old_row_id, new_row_id, 1)

    # jsPDF dejó de bloquear la carga inicial. La versión breve debe solicitarlo
    # bajo demanda igual que el PDF completo, en vez de degradar a abrir otra URL.
    old_pdf = '''async function generateBriefPDF(record) {
  const ns = window.jspdf;
  if (!ns?.jsPDF) {
    window.open(`resumen.html?id=${record.id}&v=corto`, '_blank', 'noopener');
    return;
  }'''
    new_pdf = '''async function generateBriefPDF(record) {
  if (!window.jspdf?.jsPDF && typeof window.cargarJsPDF === 'function') {
    try { await window.cargarJsPDF(); }
    catch (error) { console.warn('No se pudo cargar jsPDF para la versión breve', error); }
  }
  const ns = window.jspdf;
  if (!ns?.jsPDF) {
    window.open(`resumen.html?id=${record.id}&v=corto`, '_blank', 'noopener');
    return;
  }'''
    if old_pdf in source:
        source = source.replace(old_pdf, new_pdf, 1)

    INTERNAL_UX.write_text(source, encoding="utf-8")


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

    # Regresiones semánticas concretas detectadas durante la revisión.
    if CLUSTER_MANIFEST.exists():
        clusters = json.loads(CLUSTER_MANIFEST.read_text(encoding="utf-8"))
        sepsis = clusters.get("sepsis-shock", {})
        if "24" in [str(x) for x in sepsis.get("trial_ids", [])]:
            errors.append("cluster sepsis-shock: REBOARREST (id 24) clasificado erróneamente")
        neurologia = clusters.get("neurologia", {})
        if "18" in [str(x) for x in neurologia.get("trial_ids", [])]:
            errors.append("cluster neurologia: VESALIUS-CV (id 18) clasificado por una frase de exclusión")

    if INTERNAL_UX.exists():
        ux = INTERNAL_UX.read_text(encoding="utf-8")
        if "const direct = row?.dataset?.id;" not in ux:
            errors.append("descargas de portada: el módulo no reconoce data-id en enlaces canónicos")
        if "await window.cargarJsPDF();" not in ux:
            errors.append("descarga breve: jsPDF no se carga bajo demanda")

    if errors:
        raise SystemExit("Arquitectura inválida:\n- " + "\n- ".join(errors))


def main() -> None:
    for path in sorted(TRIALS_DIR.glob("*/index.html")):
        limpiar_trial(path)
    limpiar_clusters()
    adaptar_descargas_portada()
    validar_arquitectura()
    print("PASS: arquitectura editorial restaurada; SEO no visual y descargas conservados")


if __name__ == "__main__":
    main()
