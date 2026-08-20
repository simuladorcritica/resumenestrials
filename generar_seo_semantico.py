from __future__ import annotations

import generar_seo as base
import generar_seo_clusters as engine


def strict_classify(item: dict, clusters: list[dict]) -> list[dict]:
    """Clasifica por señales clínicas fuertes y evita asociaciones por menciones incidentales."""
    cats = set(base.categorias(item))
    manual = {base.slugify(x, 80) for x in (item.get("seo_clusters") or []) if engine.plain(x)}
    strong = engine.norm(" ".join([
        engine.plain(item.get("titulo")),
        " ".join(str(x) for x in (item.get("temas") or [])),
    ]))
    context = engine.norm(" ".join([
        engine.plain(item.get("objetivo")),
        engine.plain(item.get("hallazgo")),
    ]))

    out = []
    for cluster in clusters:
        if cluster["category"] not in cats:
            continue
        if cluster["slug"] in manual:
            out.append(cluster)
            continue

        strong_hits = {k for k in cluster["keywords"] if k and k in strong}
        context_hits = {k for k in cluster["keywords"] if k and k in context}

        # Una coincidencia en título/temas es suficiente; en objetivo/hallazgo
        # exigimos dos señales distintas para no convertir menciones accesorias
        # (p. ej. un evento adverso pulmonar) en un cluster temático.
        if strong_hits or len(context_hits) >= 2:
            out.append(cluster)
    return out


def natural_seo_title(item: dict) -> str:
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
