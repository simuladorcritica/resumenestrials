"""Genera specialty-badges.json: un mapa ligero {ruta_del_trial: {main, sub}}
usado por future-experience-final.js para mostrar en las tarjetas de listado
(hub/cluster) y en la cabecera de cada trial SOLO la especialidad principal
(Medicina Crítica o Medicina Interna) y, si aplica, la subespecialidad clínica
específica (Neumología, Cardiología, etc.) — a pedido explícito del usuario.

No modifica resumenes.json; solo lo lee. Reutiliza la misma lógica canónica
de generar_seo.py (categorias(), INTERNAL_SPECIALTIES) para no duplicar reglas
de clasificación que puedan desincronizarse con el resto del sitio.

Ejecutar de nuevo cada vez que cambie resumenes.json (alta/baja de trials o
cambio de especialidad), igual que se hace con generar_seo.py / generar_seo_clusters.py.
"""
from __future__ import annotations

import json

import generar_seo as base

# Mismo criterio de canonicalización que specialty-classification.js (cliente),
# para que la subespecialidad mostrada sea idéntica en todo el sitio.
CANONICAL_SUBSPECIALTY = {
    "Enfermedades Infecciosas": "Infectología",
    "VIH": "Infectología",
}


def subespecialidad(item: dict) -> str:
    principal = base.texto_plano(item.get("especialidad_principal"))
    secundaria = base.texto_plano(item.get("especialidad_secundaria"))
    if principal in base.INTERNAL_SPECIALTIES:
        return CANONICAL_SUBSPECIALTY.get(principal, principal)
    if secundaria in base.INTERNAL_SPECIALTIES:
        return CANONICAL_SUBSPECIALTY.get(secundaria, secundaria)
    return ""


def main() -> None:
    with open("resumenes.json", encoding="utf-8") as f:
        items = json.load(f)

    out: dict[str, dict[str, str]] = {}
    sin_categoria = 0
    for item in items:
        cats = base.categorias(item)
        main_cat = cats[0] if cats else ""
        if not main_cat:
            sin_categoria += 1
            print(
                "ADVERTENCIA: sin categoria principal resoluble para id",
                item.get("id"),
                item.get("especialidad_principal"),
                item.get("especialidad_secundaria"),
            )
            continue
        sub = subespecialidad(item) if main_cat == "Medicina Interna" else ""
        out[base.ruta_trial(item)] = {"main": main_cat, "sub": sub}

    with open("specialty-badges.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    print(f"specialty-badges.json: {len(out)} rutas mapeadas (de {len(items)} trials, {sin_categoria} sin categoria resoluble)")


if __name__ == "__main__":
    main()
