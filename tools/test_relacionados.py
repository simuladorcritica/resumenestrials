#!/usr/bin/env python3
"""Pruebas de la evidencia relacionada (site_templates.py: related_trials). Solo usan lo publicado; no llaman a ningún servicio."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import site_templates as rel  # noqa: E402

items = json.loads((ROOT / "resumenes.json").read_text(encoding="utf-8"))
por_id = {str(int(r["id"])): r for r in items}
assert len(items) >= 332

# 1. Forma: una lista por resumen, de enteros, sin el propio resumen, sin repetidos, que existen y como mucho MAXIMO.
libres = rel.related_trials(items)
enlazados = rel.related_linked()
publicados = rel.related_trials(items, enlazados)
for nombre, mapa in (("sin exclusiones", libres), ("publicados", publicados)):
    assert set(mapa) == set(por_id), f"{nombre}: falta o sobra algún resumen"
    for clave, lista in mapa.items():
        assert all(type(x) is int for x in lista) and len(lista) <= rel.RELATED_MAX and len(set(lista)) == len(lista), f"{nombre}: lista mal formada en {clave}"
        assert int(clave) not in lista and all(str(x) in por_id for x in lista), f"{nombre}: {clave} se enlaza a sí mismo o a un resumen que no existe"

# 2. Encuentra lo que debe: grupos de ensayos sobre una misma pregunta, validados editorialmente. Los grupos no son
# exhaustivos (DAPA-HF también tiene cerca DAPA-CKD y DELIVER), así que se exige la mayoría, no todos.
GRUPOS = {
    "líquidos en la sepsis": [2, 69, 113, 149, 230],
    "cristaloides balanceados": [53, 55, 253, 54, 210],
    "soporte circulatorio mecánico": [77, 137, 184, 202],
    "trombectomía tardía": [118, 119, 237],
    "SGLT2 en enfermedad renal": [96, 100, 74],
    "SGLT2 en insuficiencia cardiaca": [101, 59, 73],
}
aciertos = posibles = 0
for nombre, ids in GRUPOS.items():
    for i in ids:
        cupo = min(rel.RELATED_MAX, len(ids) - 1)
        aciertos += len(set(libres[str(i)][:cupo]) & set(ids))
        posibles += cupo
assert aciertos / posibles >= 0.75, f"solo {aciertos} de {posibles} relacionados pertenecen al grupo validado"
assert libres["2"][0] == 69 and set(libres["53"]) == {54, 55, 253} and libres["96"][0] == 100 and libres["118"][0] == 119, "ejemplos conocidos"

# 3. No repite lo que la página ya enlaza: a un ensayo del núcleo de una pregunta no se le proponen los del mismo núcleo.
assert enlazados, "hay preguntas clínicas con núcleo"
for clave, otros in enlazados.items():
    assert not set(map(str, publicados[clave])) & otros, f"el resumen {clave} repite ensayos de su pregunta clínica"
assert 69 in libres["2"] and 69 not in publicados["2"] and publicados["2"], "ARISE FLUIDS: CLOVERS va en su pregunta clínica y los relacionados son otros"

# 4. Umbrales: todo lo que se muestra supera MINIMO y, por debajo de SEGURO, comparte alguna palabra de sus temas.
semejanzas = rel.related_similarities(items)
temas = {c: rel._related_topic_words(r) for c, r in por_id.items()}
for clave, lista in libres.items():
    valor = dict((b, s) for s, b in semejanzas[clave])
    assert [valor[str(x)] for x in lista] == sorted((valor[str(x)] for x in lista), reverse=True), f"{clave}: los relacionados no van del más parecido al menos"
    for x in lista:
        assert valor[str(x)] >= rel.RELATED_MIN and (valor[str(x)] >= rel.RELATED_SAFE or temas[clave] & temas[str(x)]), f"{clave} → {x}: no pasa los umbrales"
sin_relacionados = [c for c, lista in libres.items() if not lista]
assert 0 < len(sin_relacionados) < len(items) * 0.15, "unos pocos resúmenes no tienen ningún ensayo afín, y eso se respeta"
solitario = {"id": 99999, "titulo": "ZZTOP: xilofonoterapia en la zoonosis kafkiana", "objetivo": "Xilofonoterapia frente a placebo.", "hallazgo": "Sin cambios.", "temas": ["Xilofonoterapia"], "cuerpo": "", "fecha": "2026-01-01"}
assert rel.related_trials(items + [solitario])["99999"] == [], "un resumen sin nada parecido no lleva relacionados"

# 5. Determinista: no depende del orden de los resúmenes ni de la ejecución.
assert rel.related_trials(list(reversed(items)), enlazados) == publicados == rel.related_trials(items, enlazados)

# 6. Lo generado coincide: el manifiesto que lee la página lleva exactamente estas listas, y la página las usa.
manifiesto = json.loads((ROOT / "seo-manifest.json").read_text(encoding="utf-8"))
assert {c: v.get("relacionados") for c, v in manifiesto.items()} == publicados, "seo-manifest.json no está al día: hay que regenerar el sitio"
lector = (ROOT / "ui" / "reader.js").read_text(encoding="utf-8")
assert ".relacionados" in lector and "querySelector('.ev-related').hidden=!related.length" in lector, "la página muestra los relacionados del manifiesto y oculta la sección si no hay"

con = [len(v) for v in publicados.values()]
print(f"RELACIONADOS PASS: {len(items)} resúmenes; {aciertos} de {posibles} en los grupos validados; con 3: {con.count(3)}, con 2: {con.count(2)}, con 1: {con.count(1)}, sin relacionados: {con.count(0)}")
