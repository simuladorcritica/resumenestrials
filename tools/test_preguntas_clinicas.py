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

assert st.QUESTIONS_PATH.read_bytes() == antes, "las pruebas no deben modificar preguntas-clinicas.json"
print("PREGUNTAS CLÍNICAS PASS: guardas por tipo de eje, citas literales, «sin dato» sellado, omisión automática, orden, descripción y herramienta (añadir y reponer)")
