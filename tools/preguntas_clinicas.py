#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Herramienta de las preguntas clínicas (preguntas-clinicas.json).

La usan las rutinas que publican resúmenes: cuando un ensayo nuevo pertenece a una pregunta que ya existe, se
añade aquí y la página de la pregunta, los enlaces entre ensayos, el sitemap y `llms.txt` se regeneran solos.

Nada se edita a mano. Esta herramienta es la única que escribe el archivo y solo SABE AÑADIR y REPONER:
añade ensayos y preguntas, y repone una frase únicamente cuando el sitio ya la omite (porque una corrección cambió el
pasaje que citaba). Nunca cambia ni borra una frase ni una pregunta que el sitio está publicando.

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

    python tools/preguntas_clinicas.py crear --propuesta PREGUNTA.json [--fecha AAAA-MM-DD] [--ensayo]
        Crea una pregunta NUEVA (decisión del editor, 2026-11-16: «automático con candados»). Es la única forma de
        añadir una pregunta. PREGUNTA.json lleva slug, pregunta, nombre, descripcion (con {ensayos}), condicion, area,
        criterio, criterio_relacionados, ejes, nucleo, relacionados (opcional), marco y barrido:
          · nucleo: tres ensayos o más, cada uno {"id": N, "etiqueta"?: "Autor 2026", "diseno": {eje: entrada},
            "revision": {"cotejo": "VERDE", "fiscal": "VERDE", "omisiones": "VERDE"},
            "decision": {"frase_que_decide": "<pasaje literal de ese resumen>", "revisor": "coincide"}};
          · marco: {"revisor": "VERDE"}: un revisor independiente comprobó que la pregunta promete solo lo que sus
            ensayos responden, que el criterio es preciso y que los ensayos son comparables;
          · barrido: {"hasta": <id más alto de resumenes.json>, "revisor": "coincide"}: el redactor y un decisor
            independiente compararon el criterio con todo el archivo y coinciden en qué ensayos pertenecen.
        Se niega si la pregunta ya existe, si un ensayo ya está en el núcleo de otra, si falta alguna constancia, si
        ya se creó una pregunta con esa fecha (una por día) o si alguna frase incumple las guardas. No escribe nada si
        algo no cumple. --ensayo comprueba sin escribir.

    python tools/preguntas_clinicas.py decidir --id N --constancia DECISION.json [--sin-anadir "motivo"] [--fecha] [--ensayo]
        Anota que el resumen N se comparó con cada pregunta en la que no está. `validar` lista como SIN DECIDIR todo
        resumen posterior a la curación de una pregunta (`revisado_hasta`) que no esté en ella ni tenga decisión.
        DECISION.json es {"decisiones": [{"pregunta": "<slug>", "rol": "nucleo|relacionado|nada",
        "frase_que_decide": "<pasaje literal del resumen>", "revisor": "coincide|difiere"}]}, con una decisión por cada
        pregunta pendiente. Anota «nada» si los dos decisores coinciden en que no pertenece y «duda» si difieren (no se
        añade; lo resuelve el editor). Si coinciden en que pertenece se usa `agregar`; solo cuando no pasó la revisión
        se anota con --sin-anadir "motivo" (lo resuelve el editor). Solo añade: nunca cambia una decisión anotada.

Reglas que hace cumplir (las mismas con las que el sitio decide qué frase publica):
- cada frase empieza por la sigla del ensayo, es una sola oración y no nombra a otro ensayo;
- cada cita es texto literal del resumen publicado de ESE ensayo, y entre las citas están todas las cifras de la frase;
- ninguna frase lleva resultados, juicios, recomendaciones ni afirmaciones sobre el conjunto de ensayos (la sigla
  del ensayo se escribe tal cual y no cuenta: «EMPEROR-Reduced» no es lenguaje de resultado);
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
import unicodedata

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
    faltan = {}
    for i, slug in st.question_undecided(datos, trials):
        faltan.setdefault(i, []).append(slug)
    sin_decidir = [{"id": i, "titulo": trials[st.trial_id(i)]["titulo"], "preguntas": slugs} for i, slugs in sorted(faltan.items())]
    # Para crear una pregunta nueva (orden `crear`): cuántos ensayos pide el núcleo, hasta qué resumen llega el barrido,
    # qué ensayos ya están en el núcleo de alguna pregunta (no pueden entrar en otro) y si hoy ya se creó una.
    hoy = datetime.date.today().isoformat()
    crear = {"minimo_nucleo": st.QUESTION_MIN_CORE, "ultimo_id": max(int(i) for i in trials if str(i).isdigit()),
             "ya_se_creo_hoy": any(q["fecha_publicacion"] == hoy for q in datos["preguntas"]),
             "en_nucleo": sorted(i for q in datos["preguntas"] for i in st.question_ids(q))}
    texto = json.dumps({"pertenencia": datos.get("pertenencia", []), "reglas": datos.get("reglas", []), "sin_decidir": sin_decidir, "crear": crear, "preguntas": salida}, ensure_ascii=False, indent=1)
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
    sin_decidir, por_resolver = st.question_undecided(datos, trials), st.question_unresolved(datos)
    for e in errores:
        print("ERROR ·", e)
    for slug, i, eje, motivos in omitidas:
        print(f"OMITIDA · {slug} · resumen {i} · eje {eje}: " + "; ".join(motivos))
    for i, slug in sin_decidir:
        print(f"SIN DECIDIR · resumen {i} · {slug}: falta comparar este resumen con el criterio de la pregunta y anotar la decisión")
    for i, slug, rol, nota in por_resolver:
        print(f"POR RESOLVER · resumen {i} · {slug} · " + ("los dos decisores no coincidieron" if rol == "duda" else "pertenece, pero no se pudo añadir") + (f": {nota}" if nota else "") + " (lo decide el editor)")
    total = sum(len(n["diseno"]) for q in datos["preguntas"] for n in q["nucleo"])
    print(f"Preguntas clínicas: {len(datos['preguntas'])} preguntas, {total} frases, {len(omitidas)} omitidas, {len(errores)} errores, "
          f"{len({i for i, _ in sin_decidir})} resúmenes sin decidir, {len(por_resolver)} por resolver.")
    return 1 if errores or (args.estricto and omitidas) else 0


def cmd_decidir(args):
    """Anota la decisión de un resumen para las preguntas en las que no está: «nada», «duda» o «sin_anadir». Solo añade; nunca cambia una decisión anotada."""
    datos, trials = cargar(), resumenes()
    def no(motivo):
        print("NO SE ANOTA ·", motivo)
        return 1
    r = trials.get(st.trial_id(args.id))
    if r is None:
        return no(f"el resumen {args.id} no existe en resumenes.json")
    pendientes = [slug for i, slug in st.question_undecided(datos, trials) if i == args.id]
    if not pendientes:
        print(f"NADA QUE ANOTAR · el resumen {args.id} ya está en sus preguntas o ya tiene decisión para todas.")
        return 0
    try:
        v = json.loads(Path(args.constancia).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as e:
        return no(f"no pude leer {args.constancia}: {e}")
    lista = v.get("decisiones") if isinstance(v, dict) else None
    if not isinstance(lista, list) or any(not isinstance(x, dict) for x in lista):
        return no('--constancia debe ser {"decisiones": [{"pregunta": "<slug>", "rol": "nucleo|relacionado|nada", "frase_que_decide": "…", "revisor": "coincide|difiere"}]}')
    por_slug = {x.get("pregunta"): x for x in lista}
    if len(por_slug) != len(lista):
        return no("la constancia repite una pregunta")
    fecha = args.fecha or datetime.date.today().isoformat()
    if st.iso_date(fecha) is None:
        return no("la fecha debe ser AAAA-MM-DD")
    publicado = st.published_text(r)
    limpio = lambda t: " ".join(str(t).split())
    nuevas = {}
    for slug in pendientes:
        x = por_slug.get(slug)
        if x is None:
            return no(f"falta la decisión para la pregunta {slug}: el resumen se compara con TODAS las preguntas en las que no está")
        rol, revisor, frase = x.get("rol"), x.get("revisor"), limpio(x.get("frase_que_decide") or "")
        if rol not in ("nucleo", "relacionado", "nada") or revisor not in ("coincide", "difiere"):
            return no(f"{slug}: rol debe ser nucleo, relacionado o nada, y revisor coincide o difiere (el veredicto del decisor independiente)")
        if len(frase) < 20 or not any(frase in campo for campo in publicado):
            return no(f"{slug}: frase_que_decide debe ser un pasaje literal (20 caracteres o más) del resumen publicado {args.id}: es la prueba de que se leyó ESTE resumen")
        nota = limpio(x.get("nota") or "")[:300]
        if revisor == "difiere":
            nuevas[slug] = {"rol": "duda", "frase": frase}
        elif rol == "nada":
            nuevas[slug] = {"rol": "nada", "frase": frase}
        else:
            motivo = limpio(args.sin_anadir or "")[:300]
            if not motivo:
                return no(f"{slug}: los dos decisores coinciden en que pertenece ({rol}): añádelo con `agregar`. Solo si no pasó la revisión o la herramienta lo rechazó, anótalo con --sin-anadir \"motivo\" para que lo resuelva el editor")
            nuevas[slug] = {"rol": "sin_anadir", "frase": frase, "propuesto": rol}
            nota = motivo
        if nota:
            nuevas[slug]["nota"] = nota
    entrada = next((d for d in datos["decisiones"] if d["id"] == args.id), None) if "decisiones" in datos else None
    if entrada is None:
        entrada = {"id": args.id, "fecha": fecha, "huella": st.summary_print(r), "preguntas": {}}
        datos.setdefault("decisiones", []).append(entrada)
        datos["decisiones"].sort(key=lambda d: d["id"])
    entrada["preguntas"].update(nuevas)
    try:
        st.parse_questions(json.loads(json.dumps(datos)))
    except ValueError as e:
        return no(str(e))
    resumen = ", ".join(f"{slug}: {v['rol']}" for slug, v in nuevas.items())
    if args.ensayo:
        print(f"ENSAYO · se anotaría la decisión del resumen {args.id} ({resumen}).")
        return 0
    escribir(datos)
    print(f"ANOTADO · decisión del resumen {args.id} ({resumen}).")
    return 0


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
    # Si el resumen tenía una decisión pendiente para esta pregunta (duda o sin_anadir que el editor resolvió), deja de hacer falta.
    for d in list(datos.get("decisiones", [])):
        if d["id"] == args.id and d["preguntas"].pop(q["slug"], None) is not None and not d["preguntas"]:
            datos["decisiones"].remove(d)
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


CAMPOS_PROPUESTA = ("slug", "pregunta", "nombre", "descripcion", "condicion", "area", "criterio", "criterio_relacionados",
                    "ejes", "nucleo", "relacionados", "marco", "barrido")


def cmd_crear(args):
    """Crea una pregunta nueva a partir de una propuesta completa y revisada. Solo añade; es la única forma de añadir una pregunta."""
    datos, trials = cargar(), resumenes()
    previas = {(s, i, e) for s, i, e, _ in problemas(datos, trials)[1]}
    def no(motivo):
        print("NO SE CREA ·", motivo)
        return 1
    try:
        p = json.loads(Path(args.propuesta).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as e:
        return no(f"no pude leer {args.propuesta}: {e}")
    if not isinstance(p, dict):
        return no("--propuesta debe ser un objeto con " + ", ".join(CAMPOS_PROPUESTA))
    sobran = sorted(set(p) - set(CAMPOS_PROPUESTA))
    if sobran:
        return no("campos que la propuesta no admite: " + ", ".join(sobran))
    limpio = lambda t: " ".join(str(t).split()) if isinstance(t, str) else ""
    norma = lambda t: "".join(c for c in unicodedata.normalize("NFD", limpio(t).lower()) if unicodedata.category(c) != "Mn" and c.isalnum())
    fecha = args.fecha or datetime.date.today().isoformat()
    if st.iso_date(fecha) is None or fecha <= st.QUESTION_CREATION_SINCE:
        return no(f"la fecha debe ser AAAA-MM-DD y posterior a {st.QUESTION_CREATION_SINCE}")
    slug = p.get("slug")
    if not isinstance(slug, str) or any(q["slug"] == slug for q in datos["preguntas"]):
        return no(f"ya existe la pregunta {slug!r} o el slug no es un texto")
    for campo, que in (("pregunta", "título"), ("nombre", "nombre")):
        if not norma(p.get(campo)) or any(norma(q[campo]) == norma(p.get(campo)) for q in datos["preguntas"]):
            return no(f"falta {campo} o ya hay una pregunta publicada con ese mismo {que}")
    if any(q["fecha_publicacion"] == fecha for q in datos["preguntas"]):
        return no(f"ya se creó una pregunta con fecha {fecha}: como máximo una pregunta nueva por día")
    marco, barrido = p.get("marco"), p.get("barrido")
    if not isinstance(marco, dict) or marco.get("revisor") != "VERDE":
        return no('falta la revisión independiente de la pregunta en VERDE ("marco": {"revisor": "VERDE"}): con un ROJO sin resolver, la pregunta no se crea')
    ultimo = max(int(i) for i in trials if str(i).isdigit())
    if not isinstance(barrido, dict) or barrido.get("revisor") != "coincide" or type(barrido.get("hasta")) is not int or barrido["hasta"] != ultimo:
        return no(f'falta el barrido de todo el archivo ("barrido": {{"hasta": {ultimo}, "revisor": "coincide"}}): el criterio se compara con todos los resúmenes publicados, hasta el {ultimo}, y los dos decisores deben coincidir')
    nucleo = p.get("nucleo")
    if not isinstance(nucleo, list) or len(nucleo) < st.QUESTION_MIN_CORE or any(not isinstance(n, dict) or type(n.get("id")) is not int for n in nucleo):
        return no(f"una pregunta nueva nace con {st.QUESTION_MIN_CORE} ensayos o más en el núcleo, cada uno con su id entero")
    ids = [n["id"] for n in nucleo]
    if len(set(ids)) != len(ids):
        return no("un ensayo aparece dos veces en el núcleo")
    ya_nucleo = {i: x["slug"] for x in datos["preguntas"] for i in st.question_ids(x)}
    for i in ids:
        if st.trial_id(i) not in trials:
            return no(f"el resumen {i} no existe en resumenes.json")
        if i in ya_nucleo:
            return no(f"el resumen {i} ya está en el núcleo de {ya_nucleo[i]}: un ensayo solo puede estar en el núcleo de una pregunta")
    ejes = p.get("ejes")
    if not isinstance(ejes, list) or not ejes or any(not isinstance(a, dict) or not isinstance(a.get("clave"), str) for a in ejes) or len({a["clave"] for a in ejes}) != len(ejes):
        return no("ejes debe ser una lista de ejes con clave única (clave, entrada, guia, tipo, lugar, obligatorio, max)")
    creacion = {"fecha": fecha, "marco": "VERDE", "barrido": "coincide"}
    nota = limpio(marco.get("nota"))[:300]
    if nota:
        creacion["nota"] = nota
    q = {"slug": slug, "pregunta": limpio(p.get("pregunta")), "nombre": limpio(p.get("nombre")), "revisado_hasta": ultimo,
         "descripcion": limpio(p.get("descripcion")), "condicion": limpio(p.get("condicion")), "area": p.get("area"),
         "fecha_publicacion": fecha, "fecha_revision": fecha, "criterio": limpio(p.get("criterio")),
         "criterio_relacionados": limpio(p.get("criterio_relacionados")), "creacion": creacion, "ejes": ejes, "nucleo": [],
         "relacionados": p.get("relacionados") if p.get("relacionados") is not None else []}
    entradas = []
    for n in nucleo:
        r = trials[st.trial_id(n["id"])]
        de = f"resumen {n['id']}"
        extra = sorted(set(n) - {"id", "etiqueta", "diseno", "revision", "decision"})
        if extra:
            return no(f"{de}: campos que no admite un ensayo del núcleo: " + ", ".join(extra))
        decision = n.get("decision")
        frase = limpio(decision.get("frase_que_decide")) if isinstance(decision, dict) else ""
        if not isinstance(decision, dict) or decision.get("revisor") != "coincide":
            return no(f'{de}: falta su decisión de pertenencia con los dos decisores de acuerdo ("decision": {{"frase_que_decide": "…", "revisor": "coincide"}}); si difieren, el ensayo no entra')
        if len(frase) < 20 or not any(frase in campo for campo in st.published_text(r)):
            return no(f"{de}: frase_que_decide debe ser un pasaje literal (20 caracteres o más) de ese resumen publicado: es la prueba de que se leyó ESTE resumen")
        revision = n.get("revision")
        malos = [k for k in st.QUESTION_REVIEWERS if not isinstance(revision, dict) or revision.get(k) != "VERDE"]
        if malos:
            return no(f"{de}: no están en VERDE las revisiones de: " + ", ".join(malos))
        diseno = n.get("diseno")
        if not isinstance(diseno, dict):
            return no(f"{de}: diseno debe ser un objeto {{eje: {{frase, cita}}}}")
        entrada = {"id": n["id"]}
        if limpio(n.get("etiqueta")):
            entrada["etiqueta"] = limpio(n["etiqueta"])
        entrada["diseno"] = diseno
        try:
            sigla = st.trial_label(r, entrada)
        except ValueError as e:
            return no(str(e))
        if len(st.question_sections(r)) != len(st.QUESTION_SECTIONS):
            return no(f"{de}: su resumen breve no tiene las secciones que la ficha muestra literales")
        claves = [a["clave"] for a in ejes]
        sobran = [k for k in diseno if k not in claves]
        try:
            faltan = [k for k in obligatorios(q) if k not in diseno]
        except (KeyError, TypeError, AttributeError):
            return no("ejes mal formados: cada eje lleva clave, entrada, guia, tipo, lugar, obligatorio y max")
        if sobran or faltan:
            return no(f"{de}: ejes" + (f" que no son de esta pregunta: {', '.join(sobran)}" if sobran else "")
                      + (";" if sobran and faltan else "") + (f" obligatorios que faltan: {', '.join(faltan)}" if faltan else ""))
        entrada["revision"] = {"fecha": fecha, **{k: "VERDE" for k in st.QUESTION_REVIEWERS}}
        if isinstance(revision.get("nota"), str) and revision["nota"].strip():
            entrada["revision"]["nota"] = revision["nota"].strip()[:300]
        entradas.append((entrada, sigla, r))
    siglas = [sigla for _, sigla, _ in entradas]
    if len(set(siglas)) != len(siglas):
        return no("dos ensayos del núcleo comparten sigla; distínguelos con etiqueta")
    for entrada, sigla, r in entradas:
        try:
            fallos = revisar_entradas(q, entrada["diseno"], sigla, r, siglas)
        except (KeyError, TypeError, AttributeError):
            return no("ejes mal formados: cada eje lleva clave, entrada, guia, tipo, lugar, obligatorio y max")
        if fallos:
            return no(f"resumen {entrada['id']} · frases que no cumplen · " + " | ".join(fallos))
        q["nucleo"].append(entrada)
    datos["preguntas"].append(q)
    try:
        st.parse_questions(json.loads(json.dumps(datos)))
    except (ValueError, KeyError, TypeError, AttributeError) as e:
        return no(str(e) if isinstance(e, ValueError) else "la propuesta no tiene la forma de una pregunta (revisa ejes, nucleo y relacionados)")
    errores, omitidas = problemas(datos, trials)
    nuevas = [f"{s}·{i}·{e}" for s, i, e, _ in omitidas if (s, i, e) not in previas]
    if errores or nuevas:
        return no("el archivo no quedaría limpio: " + "; ".join(errores + nuevas))
    if st.question_undecided(datos, trials) != st.question_undecided({**datos, "preguntas": datos["preguntas"][:-1]}, trials):
        return no("la pregunta dejaría resúmenes sin decidir: el barrido debe cubrir todo el archivo")
    resumen = f"«{q['pregunta']}» ({slug}) con {len(q['nucleo'])} ensayos en el núcleo: " + ", ".join(siglas)
    if args.ensayo:
        print("ENSAYO · se crearía la pregunta", resumen + ".")
        return 0
    escribir(datos)
    print("CREADA · pregunta", resumen + f"; revisada hasta el resumen {ultimo}.")
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
    n = sub.add_parser("crear")
    n.add_argument("--propuesta", required=True); n.add_argument("--fecha"); n.add_argument("--ensayo", action="store_true")
    n.set_defaults(f=cmd_crear)
    d = sub.add_parser("decidir")
    d.add_argument("--id", type=int, required=True); d.add_argument("--constancia", required=True); d.add_argument("--sin-anadir", dest="sin_anadir")
    d.add_argument("--fecha"); d.add_argument("--ensayo", action="store_true")
    d.set_defaults(f=cmd_decidir)
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
