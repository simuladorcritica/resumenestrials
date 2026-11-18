#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pruebas de las guardas de las preguntas clínicas. No escriben en el repositorio (--ensayo o datos en memoria)."""
import argparse
import contextlib
import copy
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import site_templates as st  # noqa: E402

TOOL = [sys.executable, str(ROOT / "tools/preguntas_clinicas.py")]
datos = json.loads(st.QUESTIONS_PATH.read_text(encoding="utf-8"))
preguntas = st.parse_questions(copy.deepcopy(datos))
trials = {st.trial_id(r["id"]): r for r in json.loads((ROOT / "resumenes.json").read_text(encoding="utf-8"))}
antes = st.QUESTIONS_PATH.read_bytes()


try:
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows no siempre es UTF-8
except (AttributeError, ValueError):
    pass


def run(*args):
    r = subprocess.run(TOOL + list(args), capture_output=True, text=True, cwd=ROOT, encoding="utf-8", errors="replace",
                       env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"})
    return r.returncode, r.stdout + r.stderr


# 1. El archivo es válido. Una frase omitida no es un error: el sitio no la publica (se informa para reponerla).
code, out = run("validar")
assert code == 0, out
for q in preguntas:
    shown, dropped = st.question_design(q, trials)
    assert shown, q["slug"]
    for i, eje, motivos in dropped:
        print(f"AVISO · {q['slug']} · resumen {i} · eje {eje}: frase omitida ({'; '.join(motivos)})")
    siglas = [st.trial_label(x, m) for m, x in st.question_core(q, trials)]
    descripcion = st.question_description(q, trials)
    assert "{" not in descripcion and all(x in descripcion for x in siglas), descripcion
    assert (" e " + siglas[-1] in descripcion) == siglas[-1].lower().startswith(("i", "hi")), descripcion

# 1b. Candados de entrada: cada ensayo del núcleo lleva la constancia de sus tres revisiones, y una entrada mal escrita
# (no una que caducó porque el resumen cambió) es un ERROR que detiene la prueba.
for q in preguntas:
    assert all(st.question_review_ok(m.get("revision")) for m in q["nucleo"]), q["slug"]
sin = copy.deepcopy(datos); sin["preguntas"][0]["nucleo"][0].pop("revision", None)
try:
    st.parse_questions(sin); raise AssertionError("un ensayo sin constancia de revisión debe rechazarse")
except ValueError:
    pass

# 2. Guardas de una frase, sobre un ensayo real del núcleo (con una frase de prueba: no depende del archivo).
q = preguntas[0]
n, r = st.question_core(q, trials)[0]
sigla = st.trial_label(r, n)
otras = [st.trial_label(x, m) for m, x in st.question_core(q, trials)]
buena = {"frase": f"{sigla} es un ensayo ya resumido en este sitio.", "cita": st.published_text(r)[1][:120]}
ok = lambda frase, cita=buena["cita"]: st.question_sentence_errors(frase, sigla, r, otras, cita)
assert ok(buena["frase"]) == []
assert ok(buena["frase"].replace(sigla + " ", sigla + ", en su grupo de estudio, ")) == [], "la sigla puede ir seguida de un inciso"
assert ok(buena["frase"].replace(sigla + " ", sigla + "-2 ")), "la sigla debe ser la del ensayo"
assert ok(buena["frase"], "Esta cita no existe en el resumen publicado."), "una cita inventada debe rechazarse"
assert ok(f"{sigla} incluyó 987654 pacientes."), "una cifra ausente de la cita debe rechazarse"
assert ok("El ensayo " + buena["frase"]), "la frase debe empezar por la sigla"
assert ok(f"{sigla} redujo la mortalidad."), "lenguaje de resultado"
assert ok(f"{sigla} es el mejor de los cuatro ensayos."), "juicio y conjunto"
assert ok(f"{sigla} hizo lo mismo que {next(o for o in otras if o != sigla)}."), "no puede nombrar a otro ensayo"
assert ok(f"{sigla} conviene en estos pacientes."), "recomendación"
# Un eje de contexto admite hechos observados, pero no consejos; uno literal solo oraciones completas del resumen; un
# «sin dato» solo vale mientras el resumen no cambie.
contexto = lambda frase: st.question_sentence_errors(frase, sigla, r, otras, buena["cita"], "contexto")
assert contexto(f"{sigla} no mostró diferencias en ese grupo.") == [] and ok(f"{sigla} no mostró diferencias en ese grupo.")
assert contexto(f"{sigla} demuestra que conviene esperar."), "un eje de contexto tampoco admite consejos"
oracion = next(x.strip() + "." for x in st.published_text(r)[4].split(". ") if 60 <= len(x) <= 600 and not x.strip().endswith("."))
assert st.question_literal_errors(oracion, r) == []
assert st.question_literal_errors(oracion[:-1], r) and st.question_literal_errors("Oración que no está en el resumen, aunque sea larga.", r)
assert [k for k, _ in st.question_sections(r)] == list(st.QUESTION_SECTIONS), "la ficha muestra las cuatro secciones del resumen breve"
assert all(v and "<p" not in v and "<h2" not in v for _, v in st.question_sections(r))
assert not st.question_entry_shape({"clave": "x", "entrada": "", "tipo": "ausencia"}, {"frase": f"{sigla} es un ensayo.", "cita": buena["cita"]}), "un eje de ausencia solo admite sin_dato"
sello = {"sin_dato": "la proporción de pacientes quirúrgicos", "huella": st.summary_print(r)}
literal = {"clave": "x", "entrada": "", "tipo": "literal"}
assert st.question_entry_text(literal, sello, sigla, r)[0] == f"El resumen de {sigla} no informa la proporción de pacientes quirúrgicos."
assert st.question_entry_text(literal, dict(sello, huella="otra"), sigla, r)[1], "si el resumen cambió, el «no informa» no se publica"
assert st.question_entry_text(literal, {"sin_dato": "Texto con mayúscula y punto.", "huella": sello["huella"]}, sigla, r)[1]

# 3. Si una corrección cambia el texto citado, la frase desaparece sola (no se publica desfasada) y nada más cambia.
cambiados = copy.deepcopy(trials)
objetivo = cambiados[st.trial_id(n["id"])]
for campo in ("objetivo", "hallazgo", "corto", "cuerpo"):
    objetivo[campo] = "Texto corregido que ya no contiene los pasajes citados."
shown_antes, _ = st.question_design(q, trials)
shown, dropped = st.question_design(q, cambiados)
assert {e for i, e, _ in dropped if i == n["id"]} == set(n["diseno"]), dropped
for (clave, _, frases_antes), (clave2, _, frases) in zip(shown_antes, shown):
    assert clave == clave2 and frases == [f for f in frases_antes if not f.startswith((sigla + " ", sigla + ", ", f"El resumen de {sigla} "))]
assert all(st.question_notes(q, n, st.question_texts(q, trials)[0]) for n, _ in st.question_core(q, trials)), "cada ficha lleva sus notas"
assert not st.question_notes(q, n, st.question_texts(q, cambiados)[0]), "sin citas vigentes, la ficha no publica notas"

# 4. El orden del núcleo es el cronológico del artículo, no el del archivo.
revuelto = copy.deepcopy(q); revuelto["nucleo"].reverse()
assert [m["id"] for m, _ in st.question_core(revuelto, trials)] == [m["id"] for m, _ in st.question_core(q, trials)]
fechas = [str(x.get("fecha")) for _, x in st.question_core(q, trials)]
assert fechas == sorted(fechas)

# 5. La herramienta: añade solo lo que cumple, y en --ensayo no escribe.
usados = {i for x in preguntas for i in st.question_ids(x)} | {i for x in preguntas for g in x["relacionados"] for i in g["ids"]}
libre = next(x for x in trials.values() if int(st.trial_id(x["id"])) not in usados and ":" in x["titulo"] and len(x["titulo"].split(":")[0]) <= 30)
libre_id = int(st.trial_id(libre["id"])); libre_sigla = libre["titulo"].split(":")[0].strip()
cita = st.published_text(libre)[1][:120]  # principio literal de su objetivo
assert len(cita) >= 12
entrada_de = lambda a: ({"sin_dato": "las limitaciones del ensayo"} if st.axis_type(a) in ("literal", "ausencia") else {"frase": f"{libre_sigla} es un ensayo ya resumido en este sitio.", "cita": cita})
frases = {a["clave"]: entrada_de(a) for a in q["ejes"] if st.axis_required(a)}
with tempfile.TemporaryDirectory() as tmp:
    f = Path(tmp) / "frases.json"
    f.write_text(json.dumps(frases, ensure_ascii=False), encoding="utf-8")
    rev = Path(tmp) / "revision.json"; rev.write_text(json.dumps({k: "VERDE" for k in st.QUESTION_REVIEWERS}), encoding="utf-8")
    sin_revision = ["agregar", "--pregunta", q["slug"], "--id", str(libre_id), "--ensayo", "--rol", "nucleo", "--diseno", str(f)]
    code, out = run(*sin_revision); assert code == 1 and "--revision" in out, out
    roja = Path(tmp) / "roja.json"; roja.write_text(json.dumps({"cotejo": "VERDE", "fiscal": "ROJO", "omisiones": "VERDE"}), encoding="utf-8")
    code, out = run(*sin_revision, "--revision", str(roja)); assert code == 1 and "fiscal" in out, out
    base = ["agregar", "--pregunta", q["slug"], "--id", str(libre_id), "--ensayo", "--revision", str(rev)]
    code, out = run(*base, "--rol", "nucleo", "--diseno", str(f)); assert code == 0 and "ENSAYO" in out, out
    code, out = run(*base, "--rol", "relacionado", "--motivo", "Motivo de prueba"); assert code == 0, out
    code, out = run(*base, "--rol", "relacionado"); assert code == 1 and "motivo" in out, out
    code, out = run("agregar", "--pregunta", q["slug"], "--id", str(n["id"]), "--rol", "nucleo", "--diseno", str(f), "--ensayo", "--revision", str(rev)); assert code == 1 and "ya está en el núcleo" in out, out
    code, out = run("agregar", "--pregunta", "no-existe", "--id", str(libre_id), "--rol", "relacionado", "--motivo", "X", "--ensayo"); assert code == 1, out
    malas = dict(frases); malas.pop(next(iter(malas)))
    f.write_text(json.dumps(malas, ensure_ascii=False), encoding="utf-8")
    code, out = run(*base, "--rol", "nucleo", "--diseno", str(f)); assert code == 1 and "obligatorios" in out, out
    malas = {k: ({"frase": f"{libre_sigla} incluyó 987654 pacientes.", "cita": cita} if "frase" in v else v) for k, v in frases.items()}
    f.write_text(json.dumps(malas, ensure_ascii=False), encoding="utf-8")
    code, out = run(*base, "--rol", "nucleo", "--diseno", str(f)); assert code == 1 and "cifras" in out, out
    malas = {k: ({"frase": v["frase"], "cita": "Una cita que no está en el resumen."} if "frase" in v else v) for k, v in frases.items()}
    f.write_text(json.dumps(malas, ensure_ascii=False), encoding="utf-8")
    code, out = run(*base, "--rol", "nucleo", "--diseno", str(f)); assert code == 1 and "cita" in out, out

# 6. Reponer: solo donde el sitio ya omite la frase. Se prueba sobre una copia con una cita que «una corrección cambió».
spec = importlib.util.spec_from_file_location("herramienta_preguntas", ROOT / "tools/preguntas_clinicas.py")
tool = importlib.util.module_from_spec(spec); spec.loader.exec_module(tool)
viva = next(((x, m, e) for x in preguntas for m in x["nucleo"] for e in m["diseno"]
             if not any(i == m["id"] and k == e for i, k, _ in st.question_design(x, trials)[1])), None)
if viva:
    x, m, e = viva
    original = copy.deepcopy(m["diseno"][e])
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "frases.json"; f.write_text(json.dumps({e: original}, ensure_ascii=False), encoding="utf-8")
        destino = Path(tmp) / "criterios.json"
        code, out = run("criterios", "--salida", str(destino)); assert code == 0, out
        criterios = json.loads(destino.read_text(encoding="utf-8"))
        assert criterios["pertenencia"] and criterios["reglas"] and len(criterios["preguntas"]) == len(preguntas)
        assert all(y["criterio"] and y["criterio_relacionados"] and all(a["guia"] for a in y["ejes"]) for y in criterios["preguntas"])
        rev = Path(tmp) / "revision.json"; rev.write_text(json.dumps({k: "VERDE" for k in st.QUESTION_REVIEWERS}), encoding="utf-8")
        orden = lambda **k: argparse.Namespace(pregunta=x["slug"], id=m["id"], diseno=str(f), fecha=None, ensayo=False, revision=str(rev), **k)
        code, out = run("reponer", "--pregunta", x["slug"], "--id", str(m["id"]), "--diseno", str(f), "--ensayo", "--revision", str(rev))
        assert code == 1 and "solo se reponen" in out, out  # la frase está publicada: no se toca
        rota = copy.deepcopy(datos)
        entrada = next(k for y in rota["preguntas"] if y["slug"] == x["slug"] for k in y["nucleo"] if k["id"] == m["id"])
        citas = original["cita"] if isinstance(original["cita"], list) else [original["cita"]]
        entrada["diseno"][e]["cita"] = [c + " Y un añadido que una corrección quitó del resumen." for c in citas]
        copia = Path(tmp) / "preguntas-clinicas.json"; copia.write_text(json.dumps(rota, ensure_ascii=False), encoding="utf-8")
        tool.PATH = copia
        salida = io.StringIO()
        with contextlib.redirect_stdout(salida):
            assert tool.cmd_validar(argparse.Namespace(estricto=False)) == 0 and tool.cmd_validar(argparse.Namespace(estricto=True)) == 1
            mala = {e: {"frase": original["frase"], "cita": [c + " Otra cita que tampoco existe." for c in citas]}}
            f.write_text(json.dumps(mala, ensure_ascii=False), encoding="utf-8")
            assert tool.cmd_reponer(orden()) == 1, "una reposición que no cumple las guardas se rechaza"
            f.write_text(json.dumps({e: original}, ensure_ascii=False), encoding="utf-8")
            assert tool.cmd_reponer(orden()) == 0
            assert tool.cmd_validar(argparse.Namespace(estricto=True)) == (0 if not any(st.question_design(y, trials)[1] for y in preguntas) else 1)
        assert "OMITIDA" in salida.getvalue() and "REPUESTO" in salida.getvalue(), salida.getvalue()
        repuesto = json.loads(copia.read_text(encoding="utf-8"))
        nueva = next(k for y in repuesto["preguntas"] if y["slug"] == x["slug"] for k in y["nucleo"] if k["id"] == m["id"])
        assert nueva["diseno"][e] == original
        tool.PATH = st.QUESTIONS_PATH

# 7. Constancia de decisión: ningún resumen nuevo queda sin comparar con las preguntas. Se prueba sobre una copia del archivo
#    y con un resumen «nuevo» simulado (el contenido de uno real con un id posterior a la curación).
assert all(type(y["revisado_hasta"]) is int for y in preguntas), "cada pregunta guarda hasta qué resumen llegó su curación"
# Un resumen sin decidir NO es un fallo de esta prueba: su alta se publica igual y la rutina lo compara en su siguiente pasada.
assert all(i > next(y for y in preguntas if y["slug"] == slug)["revisado_hasta"] for i, slug in st.question_undecided(datos, trials))
sin_campo = copy.deepcopy(datos); sin_campo["preguntas"][0].pop("revisado_hasta")
try:
    st.parse_questions(sin_campo); raise AssertionError("una pregunta sin revisado_hasta no es válida")
except ValueError as e:
    assert "revisado_hasta" in str(e)
nuevo_id = max(int(i) for i in trials) + 1
con_nuevo = {**trials, str(nuevo_id): {**libre, "id": nuevo_id}}
slugs = [y["slug"] for y in preguntas]
assert st.question_undecided(datos, con_nuevo) == sorted((nuevo_id, y) for y in slugs), "un resumen nuevo queda SIN DECIDIR para cada pregunta"
frase = st.published_text(libre)[1][:80]
assert len(frase) >= 20
with tempfile.TemporaryDirectory() as tmp:
    copia = Path(tmp) / "preguntas-clinicas.json"; copia.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
    tool.PATH = copia; reales = tool.resumenes; tool.resumenes = lambda: con_nuevo
    c = Path(tmp) / "decision.json"
    orden = lambda **k: argparse.Namespace(**{"id": nuevo_id, "constancia": str(c), "sin_anadir": None, "fecha": "2026-11-16", "ensayo": False, **k})
    escribe = lambda filas: c.write_text(json.dumps({"decisiones": filas}, ensure_ascii=False), encoding="utf-8")
    fila = lambda y, rol="nada", revisor="coincide", texto=frase: {"pregunta": y, "rol": rol, "frase_que_decide": texto, "revisor": revisor}
    salida = io.StringIO()
    with contextlib.redirect_stdout(salida):
        assert tool.cmd_validar(argparse.Namespace(estricto=True)) == (1 if any(st.question_design(y, trials)[1] for y in preguntas) else 0), "sin decidir no es un error: el resumen se publica igual"
        escribe([fila(y) for y in slugs[1:]])
        assert tool.cmd_decidir(orden()) == 1, "la constancia debe traer una decisión por cada pregunta pendiente"
        escribe([fila(y, texto="Una frase que no está en el resumen publicado.") for y in slugs])
        assert tool.cmd_decidir(orden()) == 1, "la frase que decide debe ser un pasaje literal de ese resumen"
        escribe([fila(y, revisor="") for y in slugs])
        assert tool.cmd_decidir(orden()) == 1, "sin el veredicto del decisor independiente no se anota"
        escribe([fila(slugs[0], rol="nucleo")] + [fila(y) for y in slugs[1:]])
        assert tool.cmd_decidir(orden()) == 1, "si los dos decisores coinciden en que pertenece, se añade con agregar; no se anota como decidido"
        assert json.loads(copia.read_text(encoding="utf-8")) == datos, "un rechazo no escribe nada"
        assert tool.cmd_decidir(orden(ensayo=True, sin_anadir="No pasó la revisión de omisiones")) == 0 and json.loads(copia.read_text(encoding="utf-8")) == datos
        assert tool.cmd_decidir(orden(sin_anadir="No pasó la revisión de omisiones")) == 0
        anotado = json.loads(copia.read_text(encoding="utf-8")); st.parse_questions(copy.deepcopy(anotado))
        d = next(x for x in anotado["decisiones"] if x["id"] == nuevo_id)
        assert d["huella"] == st.summary_print(con_nuevo[str(nuevo_id)]) and d["preguntas"][slugs[0]] == {"rol": "sin_anadir", "frase": " ".join(frase.split()), "propuesto": "nucleo", "nota": "No pasó la revisión de omisiones"}
        assert all(d["preguntas"][y]["rol"] == "nada" for y in slugs[1:]) and not st.question_undecided(anotado, con_nuevo)
        assert st.question_unresolved(anotado) == [(nuevo_id, slugs[0], "sin_anadir", "No pasó la revisión de omisiones")]
        assert tool.cmd_validar(argparse.Namespace(estricto=False)) == 0
        escribe([fila(y, revisor="difiere") for y in slugs])
        assert tool.cmd_decidir(orden()) == 0 and json.loads(copia.read_text(encoding="utf-8")) == anotado, "una decisión anotada no se cambia"
        # Cuando el editor lo resuelve y el ensayo entra en la pregunta, la decisión pendiente deja de contar.
        resuelto = copy.deepcopy(anotado); next(y for y in resuelto["preguntas"] if y["slug"] == slugs[0])["relacionados"].append({"motivo": "Motivo de prueba", "ids": [nuevo_id]})
        assert not st.question_unresolved(resuelto) and not st.question_undecided(resuelto, con_nuevo)
        # Los decisores difieren: queda como duda para el editor y no se añade.
        copia.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
        escribe([fila(slugs[0], rol="relacionado", revisor="difiere")] + [fila(y) for y in slugs[1:]])
        assert tool.cmd_decidir(orden()) == 0
        dudoso = json.loads(copia.read_text(encoding="utf-8"))
        assert st.question_unresolved(dudoso) == [(nuevo_id, slugs[0], "duda", "")] and all(nuevo_id not in st.question_ids(y) and all(nuevo_id not in g["ids"] for g in y["relacionados"]) for y in dudoso["preguntas"])
    texto = salida.getvalue()
    assert f"SIN DECIDIR · resumen {nuevo_id}" in texto and "POR RESOLVER" in texto and "ANOTADO" in texto and "NO SE ANOTA" in texto and "NADA QUE ANOTAR" in texto, texto
    destino = Path(tmp) / "criterios.json"; copia.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
    with contextlib.redirect_stdout(io.StringIO()):
        assert tool.cmd_criterios(argparse.Namespace(salida=str(destino))) == 0
    assert json.loads(destino.read_text(encoding="utf-8"))["sin_decidir"] == [{"id": nuevo_id, "titulo": libre["titulo"], "preguntas": sorted(slugs)}], "criterios dice a la rutina qué resúmenes faltan por comparar"
    tool.PATH = st.QUESTIONS_PATH; tool.resumenes = reales
mala = copy.deepcopy(datos); mala["decisiones"] = [{"id": 1, "fecha": "2026-11-16", "huella": "0" * 16, "preguntas": {"no-existe": {"rol": "nada", "frase": "x" * 25}}}]
try:
    st.parse_questions(mala); raise AssertionError("una decisión sobre una pregunta inexistente no es válida")
except ValueError:
    pass

# 9. Preguntas nuevas (orden `crear`; decisión del editor, 2026-11-16: «automático con candados»). La herramienta es la
# única que añade una pregunta y exige todos los candados. La propuesta de prueba es una pregunta ya publicada, retirada
# de una copia del archivo: contenido real y ya revisado, sin texto clínico inventado.
ultimo = max(int(i) for i in trials if str(i).isdigit())
limpias = [y for y in preguntas if len(y["nucleo"]) >= st.QUESTION_MIN_CORE and not st.question_design(y, trials)[1]]
if not limpias:
    print("AVISO · crear: ninguna pregunta está hoy sin frases omitidas; la prueba de creación espera a que se repongan")
else:
    modelo = next(y for y in datos["preguntas"] if y["slug"] == limpias[0]["slug"])
    base = copy.deepcopy(datos); base["preguntas"] = [y for y in base["preguntas"] if y["slug"] != modelo["slug"]]
    for d in base.get("decisiones", []):
        d["preguntas"].pop(modelo["slug"], None)
    base["decisiones"] = [d for d in base.get("decisiones", []) if d["preguntas"]]
    st.parse_questions(copy.deepcopy(base))
    otra = base["preguntas"][0]
    literal = lambda i: st.published_text(trials[st.trial_id(i)])[1][:60]

    def propuesta(**cambios):
        nucleo = []
        for m in modelo["nucleo"]:
            item = {"id": m["id"], "diseno": {k: ({"sin_dato": v["sin_dato"]} if "sin_dato" in v else copy.deepcopy(v)) for k, v in m["diseno"].items()},
                    "revision": {k: "VERDE" for k in st.QUESTION_REVIEWERS}, "decision": {"frase_que_decide": literal(m["id"]), "revisor": "coincide"}}
            if m.get("etiqueta"):
                item["etiqueta"] = m["etiqueta"]
            nucleo.append(item)
        pr = {k: copy.deepcopy(modelo[k]) for k in ("slug", "pregunta", "nombre", "descripcion", "condicion", "area", "criterio", "criterio_relacionados", "ejes", "relacionados")}
        pr.update(nucleo=nucleo, marco={"revisor": "VERDE"}, barrido={"hasta": ultimo, "revisor": "coincide"})
        pr.update(cambios)
        return pr

    def con(camino, valor):
        """Propuesta con un cambio en un ensayo del núcleo: con((0, "revision", "fiscal"), "ROJO")."""
        pr = propuesta(); nodo = pr["nucleo"]
        for k in camino[:-1]:
            nodo = nodo[k]
        if valor is None:
            nodo.pop(camino[-1])
        else:
            nodo[camino[-1]] = valor
        return pr

    with tempfile.TemporaryDirectory() as tmp:
        copia = Path(tmp) / "preguntas-clinicas.json"; f = Path(tmp) / "pregunta.json"

        def crear(pr, fecha="2026-12-01", ensayo=False, sobre=base):
            copia.write_text(json.dumps(sobre, ensure_ascii=False), encoding="utf-8"); f.write_text(json.dumps(pr, ensure_ascii=False), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()) as salida:
                codigo = tool.cmd_crear(argparse.Namespace(propuesta=str(f), fecha=fecha, ensayo=ensayo))
            return codigo, salida.getvalue(), json.loads(copia.read_text(encoding="utf-8"))

        tool.PATH = copia
        try:
            codigo, salida, despues = crear(propuesta(), ensayo=True)
            assert codigo == 0 and salida.startswith("ENSAYO") and despues == base, "con --ensayo comprueba sin escribir: " + salida
            codigo, salida, creada = crear(propuesta())
            assert codigo == 0 and salida.startswith("CREADA"), salida
            nueva = st.parse_questions(copy.deepcopy(creada))[-1]
            assert creada["preguntas"][:-1] == base["preguntas"] and creada.get("decisiones") == base.get("decisiones"), "crear solo añade: no toca las demás preguntas ni las decisiones"
            assert nueva["slug"] == modelo["slug"] and nueva["creacion"] == {"fecha": "2026-12-01", "marco": "VERDE", "barrido": "coincide"} and nueva["revisado_hasta"] == ultimo
            assert nueva["fecha_publicacion"] == nueva["fecha_revision"] == "2026-12-01" and all(n["revision"] == {"fecha": "2026-12-01", **{k: "VERDE" for k in st.QUESTION_REVIEWERS}} for n in nueva["nucleo"])
            assert st.question_texts(nueva, trials) == st.question_texts(limpias[0], trials), "la pregunta creada publica exactamente las frases revisadas"
            assert all(slug != modelo["slug"] for _, slug in st.question_undecided(creada, trials)), "el barrido cubre todo el archivo: no deja resúmenes sin decidir"
            # Cada candado, uno por uno: no se crea y el archivo queda como estaba.
            repetido = con((0, "id"), otra["nucleo"][0]["id"])
            casos = [
                ("slug que ya existe", propuesta(slug=otra["slug"]), {}),
                ("título de una pregunta ya publicada", propuesta(pregunta=otra["pregunta"].upper()), {}),
                ("nombre de una pregunta ya publicada", propuesta(nombre=otra["nombre"]), {}),
                ("campo que la propuesta no admite", propuesta(revisado_hasta=0), {}),
                ("menos de tres ensayos en el núcleo", propuesta(nucleo=propuesta()["nucleo"][:st.QUESTION_MIN_CORE - 1]), {}),
                ("un ensayo que ya está en el núcleo de otra pregunta", repetido, {}),
                ("un ensayo que no existe", con((0, "id"), ultimo + 1000), {}),
                ("sin la revisión independiente de la pregunta", {k: v for k, v in propuesta().items() if k != "marco"}, {}),
                ("revisión de la pregunta en ROJO", propuesta(marco={"revisor": "ROJO"}), {}),
                ("sin barrido del archivo", {k: v for k, v in propuesta().items() if k != "barrido"}, {}),
                ("barrido que no llega al último resumen", propuesta(barrido={"hasta": ultimo - 1, "revisor": "coincide"}), {}),
                ("barrido en el que los decisores difieren", propuesta(barrido={"hasta": ultimo, "revisor": "difiere"}), {}),
                ("un revisor del ensayo en ROJO", con((0, "revision", "fiscal"), "ROJO"), {}),
                ("un ensayo sin constancia de revisión", con((1, "revision"), None), {}),
                ("un ensayo sin decisión de pertenencia", con((0, "decision"), None), {}),
                ("decisores que difieren sobre un ensayo", con((0, "decision", "revisor"), "difiere"), {}),
                ("frase que decide que no es literal", con((0, "decision", "frase_que_decide"), "Un pasaje que no está en el resumen de este ensayo."), {}),
                ("un eje obligatorio que falta", con((0, "diseno", next(a["clave"] for a in modelo["ejes"] if st.axis_required(a))), None), {}),
                ("un eje que no es de la pregunta", con((0, "diseno", "eje_inventado"), {"sin_dato": "el dato de prueba"}), {}),
                ("fecha anterior a la regla", propuesta(), {"fecha": st.QUESTION_CREATION_SINCE}),
                ("fecha mal escrita", propuesta(), {"fecha": "1 de diciembre"}),
            ]
            eje, entrada = next((k, v) for k, v in modelo["nucleo"][0]["diseno"].items() if "frase" in v)
            casos.append(("una cifra que no está en la cita", con((0, "diseno", eje, "frase"), entrada["frase"].rstrip(".") + " en 987654 pacientes."), {}))
            casos.append(("una cita que no es literal", con((0, "diseno", eje, "cita"), "Este pasaje no aparece en el resumen publicado del ensayo."), {}))
            for nombre, pr, extra in casos:
                codigo, salida, despues = crear(pr, **extra)
                assert codigo == 1 and salida.startswith("NO SE CREA") and despues == base, f"crear debe rechazar {nombre}: {salida}"
            segunda = propuesta(slug="pregunta-de-prueba", pregunta="¿Pregunta de prueba?", nombre="Pregunta de prueba")
            codigo, salida, despues = crear(segunda, sobre=creada)
            assert codigo == 1 and "por día" in salida and despues == creada, "como máximo una pregunta nueva por día: " + salida
            codigo, salida, despues = crear(segunda, fecha="2026-12-02", sobre=creada)
            assert codigo == 1 and "ya está en el núcleo" in salida and despues == creada, salida
        finally:
            tool.PATH = st.QUESTIONS_PATH
    # Una pregunta nueva sin su constancia de creación (o con ella alterada) no es válida: no se puede añadir a mano.
    for cambio in (lambda y: y.pop("creacion"), lambda y: y["creacion"].update(marco="ROJO"), lambda y: y["creacion"].update(barrido="difiere"), lambda y: y["creacion"].update(fecha="2026-11-30")):
        mala = copy.deepcopy(creada); cambio(mala["preguntas"][-1])
        try:
            st.parse_questions(mala); raise AssertionError("una pregunta nueva sin constancia de creación válida debe rechazarse")
        except ValueError:
            pass
    # Las preguntas de la curación inicial (hasta el 15-nov-2026) no llevan constancia de creación y siguen siendo válidas.
    assert all("creacion" not in y or st.question_creation_ok(y["creacion"], y) for y in preguntas)
    # `criterios` da a la rutina lo que necesita para proponer una pregunta.
    with tempfile.TemporaryDirectory() as tmp:
        destino = Path(tmp) / "criterios.json"
        with contextlib.redirect_stdout(io.StringIO()):
            assert tool.cmd_criterios(argparse.Namespace(salida=str(destino))) == 0
        info = json.loads(destino.read_text(encoding="utf-8"))["crear"]
        assert info["minimo_nucleo"] == st.QUESTION_MIN_CORE and info["ultimo_id"] == ultimo and info["en_nucleo"] == sorted(i for y in preguntas for i in st.question_ids(y)) and isinstance(info["ya_se_creo_hoy"], bool)

# 10. Portada con más de tres preguntas: tarjeta para las tres más recientes y las demás enlazadas en un desplegable.
reales_q = st.load_questions
import datetime  # noqa: E402
ultimo_dia = datetime.date.fromisoformat(max(y["fecha_publicacion"] for y in preguntas))
extra = [dict(copy.deepcopy(preguntas[0]), slug=f"pregunta-de-prueba-{letra}", pregunta=f"¿Pregunta de prueba {letra}?", fecha_publicacion=dia, fecha_revision=dia)
         for letra, dia in (("a", (ultimo_dia + datetime.timedelta(days=1)).isoformat()), ("b", (ultimo_dia + datetime.timedelta(days=2)).isoformat()))]
try:
    st.load_questions = lambda: preguntas + extra
    portada = st.question_cover(list(trials.values()))
finally:
    st.load_questions = reales_q
import re  # noqa: E402
orden = re.findall(r'<a class="ev-q-title" href="/preguntas/([a-z0-9-]+)/">', portada)
# Las dos de prueba son las más recientes; detrás van las reales, de la más reciente a la más antigua (las de un mismo día, en el orden del archivo).
esperado = [extra[1], extra[0]] + sorted(preguntas, key=lambda y: y["fecha_publicacion"], reverse=True)
assert orden == [y["slug"] for y in esperado], "la portada lleva una tarjeta por pregunta, de la más reciente a la más antigua"
resto = re.search(r'<details class="ev-q-more"><summary class="ev-btn"><span>Ver las (\d+) preguntas restantes</span><span>Mostrar menos</span></summary>(.*?)</details>', portada, re.S)
assert resto and re.findall(r'<a class="ev-q-title" href="/preguntas/([a-z0-9-]+)/">', portada[:resto.start()]) == [y["slug"] for y in esperado[:st.QUESTION_HOME]], "a la vista quedan las tres preguntas más recientes, la última primero"
# Al desplegarse, las demás se ven como las de arriba: la misma tarjeta con su línea de tiempo, no una lista de enlaces (decisión del editor, 16-nov-2026).
assert int(resto[1]) == len(esperado) - st.QUESTION_HOME and re.findall(r'<a class="ev-q-title" href="/preguntas/([a-z0-9-]+)/">', resto[2]) == [y["slug"] for y in esperado[st.QUESTION_HOME:]], "las demás preguntas van en el desplegable, en orden"
assert resto[2].count('<article class="ev-q-card">') == resto[2].count('class="ev-q-line') == len(esperado) - st.QUESTION_HOME and "<ul>" not in resto[2], "cada pregunta del desplegable lleva la misma tarjeta, con su línea de tiempo"
assert portada.count('<article class="ev-q-card">') == len(esperado) and "Hallazgo" not in portada
assert ("<details" in st.question_cover(list(trials.values()))) == (len(preguntas) > st.QUESTION_HOME), "el desplegable solo aparece cuando hay más preguntas que tarjetas"

assert st.QUESTIONS_PATH.read_bytes() == antes, "las pruebas no deben modificar preguntas-clinicas.json"
print("PREGUNTAS CLÍNICAS PASS: guardas por tipo de eje, citas literales, «sin dato» sellado, omisión automática, orden, descripción, herramienta (añadir, reponer y crear una pregunta con todos sus candados), constancia de decisión de cada resumen nuevo y portada con más de tres preguntas")
