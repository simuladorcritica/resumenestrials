from __future__ import annotations

import generar_seo as base
import generar_seo_clusters as engine


# Algunos términos aislados son demasiado ambiguos para decidir un cluster.
# Estas reglas exigen que la señal clínica que define al cluster aparezca en
# título o temas, no solo como una mención accesoria del objetivo/hallazgo.
STRONG_REQUIRED = {
    "sepsis-shock": ["sepsis", "septico", "séptico"],
    "hemodinamica-cardiovascular": [
        "hemodinam", "vasopresor", "noradrenalina", "norepinefrina",
        "presion arterial", "presión arterial", "perfusion", "perfusión",
        "inotrop", "cardiogen",
    ],
}

# Frases que contienen una palabra clave, pero describen explícitamente una
# ausencia/antecedente y no convierten al ensayo en evidencia del área.
TITLE_EXCLUSIONS = {
    "neurologia": ["ni ictus", "sin ictus", "ictus previos"],
}


def _contains_any(text: str, needles: list[str]) -> bool:
    return any(engine.norm(x) in text for x in needles if x)


def strict_classify(item: dict, clusters: list[dict]) -> list[dict]:
    """Clasifica por señales clínicas fuertes y evita asociaciones incidentales."""
    cats = set(base.categorias(item))
    manual = {base.slugify(x, 80) for x in (item.get("seo_clusters") or []) if engine.plain(x)}
    title = engine.norm(engine.plain(item.get("titulo")))
    topics = engine.norm(" ".join(str(x) for x in (item.get("temas") or [])))
    strong = engine.norm(" ".join([title, topics]))
    context = engine.norm(" ".join([
        engine.plain(item.get("objetivo")),
        engine.plain(item.get("hallazgo")),
    ]))

    out = []
    for cluster in clusters:
        if cluster["category"] not in cats:
            continue
        slug = cluster["slug"]
        if slug in manual:
            out.append(cluster)
            continue

        exclusions = TITLE_EXCLUSIONS.get(slug, [])
        if exclusions and _contains_any(title, exclusions):
            continue

        required = STRONG_REQUIRED.get(slug)
        if required and not _contains_any(strong, required):
            continue

        strong_hits = {engine.norm(k) for k in cluster["keywords"] if k and engine.norm(k) in strong}
        context_hits = {engine.norm(k) for k in cluster["keywords"] if k and engine.norm(k) in context}

        # Título/temas tienen prioridad. El objetivo/hallazgo solo clasifica si
        # aparecen al menos dos señales distintas, para evitar que eventos
        # secundarios o condiciones de exclusión generen asociaciones falsas.
        if strong_hits or len(context_hits) >= 2:
            out.append(cluster)
    return out


def natural_seo_title(item: dict) -> str:
    # Se conserva exactamente el patrón de títulos previamente aprobado.
    title = engine.plain(item.get("titulo")) or "Resumen clínico"
    if ":" in title:
        trial, rest = title.split(":", 1)
        return f"{trial.strip()} trial: {rest.strip()} | Resúmenes Trials"
    return f"{title} | Resúmenes Trials"


def main() -> None:
    engine.classify = strict_classify
    engine.seo_title = natural_seo_title
    engine.main()


if __name__ == "__main__":
    main()
