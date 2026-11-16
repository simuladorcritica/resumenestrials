#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Herramienta de las preguntas clínicas (preguntas-clinicas.json).

La usan las rutinas que publican resúmenes: cuando un ensayo nuevo pertenece a una pregunta que ya existe, se
añade aquí y la página de la pregunta, los enlaces entre ensayos, el sitemap y `llms.txt` se regeneran solos.

Nada se edita a mano. Esta herramienta es la única que escribe el archivo y solo SABE AÑADIR y REPONER:
añade ensayos, y repone una frase únicamente cuando el sitio ya la omite (porque una corrección cambió el pasaje que
citaba). Nunca cambia ni borra una frase que el sitio está publicando.

    python tools/preguntas_clinicas.py criterios [--salida ARCHIVO.json]
        Reglas de pertenencia y de redacción comunes y, por pregunta, su criterio de pertenencia (núcleo y relacionados), sus ejes
        (con la guía para escribir cada frase) y un ejemplo de entrada (JSON). Con --salida lo escribe en UTF-8
        en ese archivo en lugar de imprimirlo (en Windows la consola puede estropear los acentos).

    python tools/preguntas_clinicas.py validar [--estricto]
        Comprueba el archivo contra resumenes.json. Sin --estricto informa de las frases que el sitio omitirá
        (cifra o cita que ya no está en el resumen) y termina con 0. Con --estricto termina con 1 si hay alguna.

    python tools/preguntas_clinicas.py agregar --pregunta SLUG --id N --rol nucleo --diseno FRASES.json --revision REVISION.json
                                               [--etiqueta "Autor 2026"] [--fecha AAAA-MM-DD] [--ensayo]
    python tools/preguntas_clinicas.py agregar --pregunta SLUG --id N --rol relacionado --motivo "Motivo"
        Añade el resumen N a la pregunta. FRASES.json es {eje: entrada}; cada entrada es {"frase": "...", "cita": "..." o
        ["...", "..."]}, o solo {"cita": [...]} en un eje literal (oraciones completas del resumen), o {"sin_dato": "..."}
        cuando el resumen no da ese dato (la página lo dirá: «El resumen de X no informa …»).
        Si algo no cumple, no escribe nada y termina con 1 diciendo por qué. --ensayo comprueba sin escribir.

    python tools/preguntas_clinicas.py reponer --pregunta SLUG --id N --diseno FRASES.json --revision REVISION.json [--fecha] [--ensayo]
        Repone, para un ensayo que ya está en el núcleo, las frases que `validar` informa como OMITIDAS.
        FRASES.json lleva solo esos ejes. Se niega si alguno de esos ejes tiene hoy una frase publicada.

Reglas que hace cumplir (las mismas con las que el sitio decide qué frase publica):
- cada frase empieza por la sigla del ensayo, es una sola oración y no nombra a otro ensayo;
- cada cita es texto literal del resumen publicado de ESE ensayo, y entre las citas están todas las cifras de la frase;
- ninguna frase lleva resultados, juicios, recomendaciones ni afirmaciones sobre el conjunto de ensayos;
- un ensayo de núcleo trae todos los ejes obligatorios de su pregunta, con su frase o con sin_dato: nada se omite en silencio;
- un «sin_dato» queda sellado con la huella del resumen: si una corrección cambia el resumen, deja de publicarse hasta revisarlo;
- REVISION.json es {"cotejo": "VERDE", "fiscal": "VERDE", "omisiones": "VERDE"}: el veredicto de los tres revisores independientes.
  Sin los tres en VERDE no se añade ni se repone nada, y la constancia queda guardada en el ensayo;
- `validar` da ERROR (y la prueba de CI falla) si una entrada incumple las guardas por algo que no sea un cambio del resumen:
  una entrada mal escrita no entra, ni siquiera omitida.
"""
import argparse
import datetime
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import site_templates as st  # noqa: E402  (fuente única de las guardas)

PATH = st.QUESTIONS_PATH


def cargar():
    datos = json.loads(PATH.read_text(encoding="utf-8"))
    st.parse_questions(datos)
    return datos


def resumenes():
    return {st.trial_id(r["id"]): r for r in json.loads((ROOT / "resumenes.json").read_text(encoding="utf-8"))}


def escribir(datos):
    tmp = PATH.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(datos, ensure_ascii=False, indent=2) + "\n")
    os.replace(tmp, PATH)


def obligatorios(q):
    return [a["clave"] for a in q["ejes"] if st.axis_required(a)]


def revisar_entradas(q, diseno, sigla, r, otras):
    """Comprueba cada entrada con las guardas del sitio y sella los sin_dato con la huella del resumen. Devuelve los fallos."""
    ejes = {a["clave"]: a for a in q["ejes"]}
    fallos = []
    for eje, valor in diseno.items():
        if isinstance(valor, dict) and "sin_dato" in valor:
            valor["huella"] = st.summary_print(r)
        if not st.question_entry_shape(ejes[eje], valor):
            fallos.append(f"{eje}: debe ser " + ('{"cita": …}' if st.axis_type(ejes[eje]) == "literal" else '{"frase": …, "cita": …}') + ' o {"sin_dato": …}')
            continue
        _, motivos = st.question_entry_text(ejes[eje], valor, sigla, r, otras)
        if motivos:
            fallos.append(f"{eje}: " + "; ".join(motivos))
    return fallos


CAMBIO_DEL_RESUMEN = ("la cita no está literalmente en el resumen publicado", "el resumen cambió desde que se anotó")


def leer_revision(ruta, fecha):
    """Constancia de las tres revisiones independientes (cotejo, fiscal y omisiones): las tres en VERDE o no se escribe nada."""
    if not ruta:
        return None, "falta --revision: el archivo con el veredicto de los tres revisores independientes (cotejo, fiscal, omisiones)"
    try:
        v = json.loads(Path(ruta).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as e:
        return None, f"no pude leer {ruta}: {e}"
    if not isinstance(v, dict):
        return None, '--revision debe ser {"cotejo": "VERDE", "fiscal": "VERDE", "omisiones": "VERDE"}'
    malos = [k for k in st.QUESTION_REVIEWERS if v.get(k) != "VERDE"]
    if malos:
        return None, "no están en VERDE las revisiones de: " + ", ".join(malos) + " (con un ROJO o una omisión grave sin resolver, el ensayo no se añade)"
    out = {"fecha": fecha, **{k: "VERDE" for k in st.QUESTION_REVIEWERS}}
    if isinstance(v.get("nota"), str) and v["nota"].strip():
        out["nota"] = v["nota"].strip()[:300]
    return out, None


def problemas(datos, trials):
    """(errores de estructura, frases que el sitio omitirá)."""
    errores, omitidas = [], []
    for q in datos["preguntas"]:
        ids = st.question_ids(q)
        for i in ids + [x for g in q["relacionados"] for x in g["ids"]]:
            if st.trial_id(i) not in trials:
                errores.append(f"{q['slug']}: el resumen {i} no existe en resumenes.json")
        if any(st.trial_id(i) not in trials for i in ids):
            continue
        for n in q["nucleo"]:
            try:
                st.trial_label(trials[st.trial_id(n["id"])], n)
            except ValueError as e:
                errores.append(str(e))
        if errores:
            continue
        _, dropped = st.question_design(q, trials)
        for i, eje, motivos in dropped:
            # Solo es una omisión legítima la que causa un cambio del resumen; cualquier otro fallo es una entrada mal escrita.
            if all(m.startswith(CAMBIO_DEL_RESUMEN) for m in motivos):
                omitidas.append((q["slug"], i, eje, motivos))
            else:
                errores.append(f"{q['slug']} · resumen {i} · eje {eje}: entrada que no cumple las guardas (" + "; ".join(motivos) + ")")
    return errores, omitidas


def cmd_criterios(args):
    datos, trials = cargar(), resumenes()
    salida = []
    for q in datos["preguntas"]:
        core = st.question_core(q, trials)
        ejemplo = core[0][0]["diseno"] if core else {}
        salida.append({
            "slug": q["slug"], "pregunta": q["pregunta"], "area": q["area"], "criterio": q["criterio"],
            "criterio_relacionados": q["criterio_relacionados"],
            "nucleo": [{"id": n["id"], "sigla": st.trial_label(r, n), "titulo": r["titulo"]} for n, r in core],
            "relacionados": [{"motivo": g["motivo"], "ids": g["ids"]} for g in q["relacionados"]],
            "ejes": [{"clave": a["clave"], "tipo": st.axis_type(a), "lugar": st.axis_place(a), "obligatorio": st.axis_required(a), "max": a.get("max", 500),
                      "entrada": a["entrada"], "guia": a.get("guia", "")} for a in q["ejes"]],
            "ejemplo_de_frases": ejemplo,
        })
    texto = json.dumps({"pertenencia": datos.get("pertenencia", []), "reglas": datos.get("reglas", []), "preguntas": salida}, ensure_ascii=False, indent=1)
    if args.salida:
        with open(args.salida, "w", encoding="utf-8", newline="\n") as f:
            f.write(texto + "\n")
        print(f"Criterios de {len(salida)} preguntas escritos en {args.salida}")
    else:
        print(texto)
    return 0


def cmd_validar(args):
    datos, trials = cargar(), resumenes()
    errores, omitidas = problemas(datos, trials)
    for e in errores:
        print("ERROR ·", e)
    for slug, i, eje, motivos in omitidas:
        print(f"OMITIDA · {slug} · resumen {i} · eje {eje}: " + "; ".join(motivos))
    total = sum(len(n["diseno"]) for q in datos["preguntas"] for n in q["nucleo"])
    print(f"Preguntas clínicas: {len(datos['preguntas'])} preguntas, {total} frases, {len(omitidas)} omitidas, {len(errores)} errores.")
    return 1 if errores or (args.estricto and omitidas) else 0


def cmd_agregar(args):
    datos, trials = cargar(), resumenes()
    previas = {(s, i, e) for s, i, e, _ in problemas(datos, trials)[1]}
    def no(motivo):
        print("NO SE AÑADE ·", motivo)
        return 1
    q = next((x for x in datos["preguntas"] if x["slug"] == args.pregunta), None)
    if q is None:
        return no(f"no existe la pregunta {args.pregunta}")
    r = trials.get(st.trial_id(args.id))
    if r is None:
        return no(f"el resumen {args.id} no existe en resumenes.json")
    ya_nucleo = {i: x["slug"] for x in datos["preguntas"] for i in st.question_ids(x)}
    if args.id in ya_nucleo:
        return no(f"el resumen {args.id} ya está en el núcleo de {ya_nucleo[args.id]}")
    if any(args.id in g["ids"] for g in q["relacionados"]):
        return no(f"el resumen {args.id} ya está entre los relacionados de {q['slug']}")
    fecha = args.fecha or datetime.date.today().isoformat()
    if st.iso_date(fecha) is None or fecha < q["fecha_publicacion"]:
        return no("la fecha debe ser AAAA-MM-DD y no anterior a la publicación de la pregunta")
    if args.rol == "relacionado":
        motivo = (args.motivo or "").strip()
        if not motivo:
            return no("un relacionado necesita --motivo")
        grupo = next((g for g in q["relacionados"] if g["motivo"] == motivo), None)
        if grupo is None:
            q["relacionados"].append({"motivo": motivo, "ids": [args.id]})
        else:
            grupo["ids"].append(args.id)
    else:
        if not args.diseno:
            return no("un ensayo de núcleo necesita --diseno con sus frases")
        try:
            diseno = json.loads(Path(args.diseno).read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as e:
            return no(f"no pude leer {args.diseno}: {e}")
        if not isinstance(diseno, dict):
            return no("--diseno debe ser un objeto {eje: {frase, cita}}")
        revision, motivo = leer_revision(args.revision, fecha)
        if motivo:
            return no(motivo)
        entrada = {"id": args.id}
        if args.etiqueta:
            entrada["etiqueta"] = args.etiqueta.strip()
        entrada["diseno"] = diseno
        try:
            sigla = st.trial_label(r, entrada)
        except ValueError as e:
            return no(str(e))
        if len(st.question_sections(r)) != len(st.QUESTION_SECTIONS):
            return no("el resumen breve de este ensayo no tiene las secciones «" + "», «".join(st.QUESTION_SECTIONS) + "», que la ficha muestra literales")
        claves = [a["clave"] for a in q["ejes"]]
        sobran = [k for k in diseno if k not in claves]
        faltan = [k for k in obligatorios(q) if k not in diseno]
        if sobran or faltan:
            return no("ejes" + (f" que no son de esta pregunta: {', '.join(sobran)}" if sobran else "")
                      + (";" if sobran and faltan else "") + (f" obligatorios que faltan: {', '.join(faltan)}" if faltan else ""))
        otras = [st.trial_label(x, n) for n, x in st.question_core(q, trials)]
        if sigla in otras:
            return no(f"ya hay un ensayo con la sigla «{sigla}» en esta pregunta; usa --etiqueta para distinguirlo")
        fallos = revisar_entradas(q, diseno, sigla, r, otras)
        if fallos:
            return no("frases que no cumplen · " + " | ".join(fallos))
        entrada["revision"] = revision
        q["nucleo"].append(entrada)
    q["fecha_revision"] = max(q["fecha_revision"], fecha)
    try:
        st.parse_questions(json.loads(json.dumps(datos)))
    except ValueError as e:
        return no(str(e))
    errores, omitidas = problemas(datos, trials)
    nuevas = [f"{s}·{i}·{e}" for s, i, e, _ in omitidas if (s, i, e) not in previas]
    if errores or nuevas:
        return no("el archivo no quedaría limpio: " + "; ".join(errores + nuevas))
    if args.ensayo:
        print(f"ENSAYO · se añadiría el resumen {args.id} a {q['slug']} como {args.rol}.")
        return 0
    escribir(datos)
    print(f"AÑADIDO · resumen {args.id} a {q['slug']} como {args.rol}; fecha de revisión {q['fecha_revision']}.")
    return 0


def cmd_reponer(args):
    datos, trials = cargar(), resumenes()
    def no(motivo):
        print("NO SE REPONE ·", motivo)
        return 1
    q = next((x for x in datos["preguntas"] if x["slug"] == args.pregunta), None)
    if q is None:
        return no(f"no existe la pregunta {args.pregunta}")
    entrada = next((n for n in q["nucleo"] if n["id"] == args.id), None)
    if entrada is None:
        return no(f"el resumen {args.id} no está en el núcleo de {q['slug']}")
    fecha = args.fecha or datetime.date.today().isoformat()
    if st.iso_date(fecha) is None or fecha < q["fecha_publicacion"]:
        return no("la fecha debe ser AAAA-MM-DD y no anterior a la publicación de la pregunta")
    try:
        diseno = json.loads(Path(args.diseno).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as e:
        return no(f"no pude leer {args.diseno}: {e}")
    if not isinstance(diseno, dict) or not diseno:
        return no("--diseno debe ser un objeto {eje: {frase, cita}} con al menos un eje")
    omitidas = {e for s, i, e, _ in problemas(datos, trials)[1] if s == q["slug"] and i == args.id}
    vivas = [e for e in diseno if e not in omitidas]
    if vivas:
        return no("solo se reponen frases que el sitio ya omite; estos ejes no lo están: " + ", ".join(vivas))
    r = trials[st.trial_id(args.id)]
    sigla = st.trial_label(r, entrada)
    otras = [st.trial_label(x, n) for n, x in st.question_core(q, trials)]
    desconocidos = [e for e in diseno if e not in {a["clave"] for a in q["ejes"]}]
    if desconocidos:
        return no("ejes que no son de esta pregunta: " + ", ".join(desconocidos))
    fallos = revisar_entradas(q, diseno, sigla, r, otras)
    if fallos:
        return no("frases que no cumplen · " + " | ".join(fallos))
    revision, motivo = leer_revision(args.revision, fecha)
    if motivo:
        return no(motivo)
    for eje, valor in diseno.items():
        entrada["diseno"][eje] = valor
    entrada["revision"] = revision
    q["fecha_revision"] = max(q["fecha_revision"], fecha)
    st.parse_questions(json.loads(json.dumps(datos)))
    if args.ensayo:
        print(f"ENSAYO · se repondrían {len(diseno)} frases del resumen {args.id} en {q['slug']}.")
        return 0
    escribir(datos)
    print(f"REPUESTO · {len(diseno)} frases del resumen {args.id} en {q['slug']}; fecha de revisión {q['fecha_revision']}.")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="orden", required=True)
    c = sub.add_parser("criterios"); c.add_argument("--salida"); c.set_defaults(f=cmd_criterios)
    v = sub.add_parser("validar"); v.add_argument("--estricto", action="store_true"); v.set_defaults(f=cmd_validar)
    a = sub.add_parser("agregar")
    a.add_argument("--pregunta", required=True); a.add_argument("--id", type=int, required=True)
    a.add_argument("--rol", choices=["nucleo", "relacionado"], required=True)
    a.add_argument("--diseno"); a.add_argument("--motivo"); a.add_argument("--etiqueta"); a.add_argument("--fecha")
    a.add_argument("--ensayo", action="store_true"); a.add_argument("--revision")
    a.set_defaults(f=cmd_agregar)
    r = sub.add_parser("reponer")
    r.add_argument("--pregunta", required=True); r.add_argument("--id", type=int, required=True)
    r.add_argument("--diseno", required=True); r.add_argument("--fecha"); r.add_argument("--ensayo", action="store_true"); r.add_argument("--revision")
    r.set_defaults(f=cmd_reponer)
    args = p.parse_args()
    for flujo in (sys.stdout, sys.stderr):  # la consola de Windows no siempre es UTF-8
        try:
            flujo.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    try:
        return args.f(args)
    except ValueError as e:
        print("ERROR ·", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
