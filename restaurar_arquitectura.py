from __future__ import annotations

from pathlib import Path
import html
import json
import re

import generar_seo as base

ROOT = base.ROOT
TRIALS_DIR = ROOT / "trials"
CLUSTER_MANIFEST = ROOT / "seo-cluster-manifest.json"
SEO_MANIFEST = ROOT / "seo-manifest.json"
INTERNAL_UX = ROOT / "internal-medicine-ux.js"
TRIAL_PDF = ROOT / "trial-pdf.js"

DOWNLOAD_ICON = '''<svg class="trial-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"></path><path d="m7.5 10 4.5 4.5 4.5-4.5"></path><path d="M5 20h14"></path></svg>'''


def acciones_trial(item: dict) -> str:
    trial_id = html.escape(str(item.get("id", "")))
    breve = ""
    if item.get("corto"):
        breve = (
            f'<a class="trial-action trial-action-brief" href="/resumen.html?id={trial_id}&amp;v=corto">'
            '<span class="trial-action-kicker">Lectura rápida</span>'
            '<span>Ver resumen breve</span><span class="trial-action-arrow" aria-hidden="true">→</span></a>'
        )
    return (
        '<!-- RT-TRIAL-ACTIONS-START -->'
        '<div class="trial-actions" aria-label="Acciones del resumen">'
        f'<button type="button" class="trial-action trial-action-download" data-trial-download="{trial_id}" '
        f'aria-label="Descargar resumen completo PDF">{DOWNLOAD_ICON}<span>Descargar resumen completo PDF</span></button>'
        f'{breve}</div>'
        '<!-- RT-TRIAL-ACTIONS-END -->'
    )


def limpiar_trial(path: Path, item: dict) -> None:
    """Conserva el SEO, restaura la lectura editorial y unifica las acciones del trial."""
    source = path.read_text(encoding="utf-8")

    # Las imágenes editoriales permanecen en Open Graph/Twitter/JSON-LD, nunca como
    # una portada gigante que interrumpa la lectura clínica.
    source = re.sub(
        r"\s*<!-- RT-HERO-START -->.*?<!-- RT-HERO-END -->\s*",
        "\n",
        source,
        flags=re.S,
    )

    # La ficha de intención de búsqueda duplicaba información del artículo.
    source = re.sub(
        r"\s*<!-- RT-INTENT-START -->.*?<!-- RT-INTENT-END -->\s*",
        "\n",
        source,
        flags=re.S,
    )

    # El resumen breve ya no se despliega dentro del resumen completo. Existe como
    # una lectura independiente en /resumen.html?id=...&v=corto.
    source = re.sub(
        r"\s*<section id=\"resumen-breve\" class=\"resumen-breve\">.*?</section>\s*",
        "\n",
        source,
        flags=re.S,
    )

    # Permite regenerar idempotentemente el bloque de acciones.
    source = re.sub(
        r"\s*<!-- RT-TRIAL-ACTIONS-START -->.*?<!-- RT-TRIAL-ACTIONS-END -->\s*",
        "\n",
        source,
        flags=re.S,
    )

    # Ya no existe un hero visible: precargar su JPG desperdicia ancho de banda.
    source = re.sub(
        r'\s*<link rel="preload" as="image" href="https://resumenestrials\.com/images/trials/[^"]+">',
        "",
        source,
    )

    actions = acciones_trial(item)
    source, inserted = re.subn(
        r'(<header class="art-head">.*?)(</header>)',
        lambda match: match.group(1) + actions + match.group(2),
        source,
        count=1,
        flags=re.S,
    )
    if inserted != 1:
        raise RuntimeError(f"No se pudo insertar acciones en {path}")

    if '/trial-pdf.js' not in source:
        source = source.replace('</body>', '<script src="/trial-pdf.js?v=1" defer></script></body>', 1)

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


def validar_arquitectura(items: list[dict]) -> None:
    manifest = json.loads(SEO_MANIFEST.read_text(encoding="utf-8"))
    by_id = {str(item.get("id")): item for item in items}
    errors: list[str] = []

    if not TRIAL_PDF.is_file():
        errors.append("falta trial-pdf.js para descarga directa desde trials canónicos")

    for trial_id, entry in manifest.items():
        path = ROOT / str(entry["path"]).lstrip("/") / "index.html"
        item = by_id.get(str(trial_id), {})
        if not path.is_file():
            errors.append(f"id {trial_id}: falta {path}")
            continue
        source = path.read_text(encoding="utf-8")
        if "RT-HERO-START" in source or 'class="trial-hero"' in source:
            errors.append(f"id {trial_id}: todavía tiene hero visible")
        if "RT-INTENT-START" in source or 'class="respuesta-clinica"' in source:
            errors.append(f"id {trial_id}: todavía tiene resumen duplicado")
        if 'id="resumen-breve"' in source or 'class="resumen-breve"' in source:
            errors.append(f"id {trial_id}: el resumen breve sigue incrustado en la versión completa")
        if '<article class="articulo">' not in source:
            errors.append(f"id {trial_id}: falta artículo principal")
        if f'data-trial-download="{trial_id}"' not in source:
            errors.append(f"id {trial_id}: falta botón de descarga PDF completa")
        if item.get("corto") and f'/resumen.html?id={trial_id}&amp;v=corto' not in source:
            errors.append(f"id {trial_id}: falta enlace independiente al resumen breve")
        if '/trial-pdf.js?v=1' not in source:
            errors.append(f"id {trial_id}: falta controlador de descarga PDF")
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
    items = json.loads(base.DATA_PATH.read_text(encoding="utf-8"))
    by_slug = {base.slug_para_item(item): item for item in items}
    for path in sorted(TRIALS_DIR.glob("*/index.html")):
        item = by_slug.get(path.parent.name)
        if not item:
            raise SystemExit(f"No se encontró el registro fuente para {path}")
        limpiar_trial(path, item)
    limpiar_clusters()
    adaptar_descargas_portada()
    validar_arquitectura(items)
    print("PASS: arquitectura unificada; PDF completo visible y resumen breve como lectura independiente")


if __name__ == "__main__":
    main()
