#!/usr/bin/env python3
"""Pruebas de la financiación breve de las tarjetas (tools/financiacion_breve.py y financiacion-breve.json).

    python tools/test_financiacion_breve.py

Comprueba el archivo publicado entero, las guardas de la herramienta (no deja pasar un nombre ni una cifra que el resumen no
diga), que una ficha desfasada deja paso al texto completo sin dar errores falsos, y que el índice que leen las tarjetas
coincide con el archivo. No escribe en el repositorio: las pruebas de escritura usan una carpeta temporal.
"""
import contextlib
import io
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import financiacion_breve as fb  # noqa: E402

RAIZ = fb.RAIZ
antes = fb.ARCHIVO.read_bytes()
origen = fb.resumenes()

# 1. El archivo publicado: sin errores, y cada ficha vigente escrita para el texto actual de su resumen.
vigentes, desfasadas, sin_ficha, errores = fb.estado()
assert not errores, "financiacion-breve.json tiene errores:\n" + "\n".join(errores)
assert vigentes, "no hay ninguna ficha vigente"
datos = fb.leer()
assert list(datos) == ["_nota", "fichas"] and datos["_nota"] == fb.NOTA
assert list(datos["fichas"]) == sorted(datos["fichas"], key=int), "las fichas van ordenadas por número de resumen"
for clave in vigentes:
    ficha = datos["fichas"][clave]
    assert ficha["de"] == fb.huella(origen[clave]["financiacion"])
    assert all(len(ficha[c]) <= fb.MAXIMO and ficha[c].endswith(".") for c in fb.CAMPOS), clave
    assert ficha["pago"] != fb.SIN_DATO, clave
# Lo que el resumen no dice no se rellena: se escribe la frase fija, sin variantes.
variantes = {ficha[c] for ficha in datos["fichas"].values() for c in ("papel", "conflictos") if "no consta" in ficha[c].lower() and len(ficha[c]) < 40}
assert variantes <= {fb.SIN_DATO}, f"«{fb.SIN_DATO}» se escribe siempre igual: {variantes}"

# 2. Las guardas, sobre un texto de ejemplo.
TEXTO = ("Financiado por el Instituto Nacional de Salud y por Acme Pharma, fabricante del fármaco, que donó el placebo; "
         "tres de los 12 autores son empleados de Acme. Según el artículo, el patrocinador no intervino en el análisis.")
BUENA = {"de": fb.huella(TEXTO), "pago": "Instituto Nacional de Salud y Acme Pharma, fabricante del fármaco.",
         "papel": "Acme donó el placebo; según el artículo, el patrocinador no intervino en el análisis.",
         "conflictos": "Sí: tres de los 12 autores son empleados de Acme."}
assert fb.revisar("x", BUENA, TEXTO) == [], fb.revisar("x", BUENA, TEXTO)


def falla(cambio, parte):
    fallos = fb.revisar("x", {**BUENA, **cambio}, TEXTO)
    assert any(parte in f for f in fallos), (cambio, fallos)


falla({"pago": "Instituto Nacional de Salud y Pfizer."}, "«Pfizer» no está en el texto del resumen")          # empresa inventada
falla({"conflictos": "Sí: cuatro de los 12 autores son empleados de Acme."}, "la cifra 4 no está")            # cifra inventada, con letra
falla({"conflictos": "Sí: 5 de los 12 autores son empleados de Acme."}, "la cifra 5 no está")                 # cifra inventada, con número
falla({"papel": "Acme diseñó el ensayo junto con Roche."}, "«Roche» no está")                                 # segundo nombre inventado
falla({"papel": "Acme donó el placebo"}, "termina en punto")
falla({"papel": "acme donó el placebo."}, "empieza con mayúscula")
falla({"papel": "Acme donó el <b>placebo</b>."}, "ni marcas")
falla({"papel": "Acme donó el placebo.\nNada más."}, "saltos de línea")
falla({"papel": "A" + "a" * fb.MAXIMO + "."}, f"(máximo {fb.MAXIMO})")
falla({"papel": " "}, "vacío")
falla({"pago": fb.SIN_DATO}, "todo resumen dice quién financió")
assert fb.revisar("x", {k: v for k, v in BUENA.items() if k != "papel"}, TEXTO) == ["x: la ficha lleva exactamente de, pago, papel y conflictos"]
assert fb.revisar("x", {**BUENA, "nota": "x"}, TEXTO) == ["x: la ficha lleva exactamente de, pago, papel y conflictos"]
# Lo que sí pasa: nombres sin acento o con otra caja, «No consta» en papel y conflictos, y cifras escritas de la otra forma.
assert fb.revisar("x", {**BUENA, "papel": fb.SIN_DATO, "conflictos": fb.SIN_DATO}, TEXTO) == []
assert fb.revisar("x", {**BUENA, "conflictos": "Sí: 3 de los doce autores son empleados de ACME."}, TEXTO) == []
assert fb.numeros_de("Seis de los 13 autores; 2,5 mg y 1.200 no cuentan") == {6, 13}
assert "Acme" in fb.nombres_de("El patrocinador fue Acme.") and "El" not in fb.nombres_de("El patrocinador fue Acme.")

# 3. Escritura (aplicar) en una carpeta temporal: entra la ficha buena, no entra la mala, y lo demás no se toca.
real = (fb.ARCHIVO, fb.resumenes)
with tempfile.TemporaryDirectory() as carpeta, contextlib.redirect_stdout(io.StringIO()):
    try:
        fb.ARCHIVO = Path(carpeta) / "financiacion-breve.json"
        fb.resumenes = lambda: {"7": {"id": 7, "titulo": "A", "financiacion": TEXTO}, "8": {"id": 8, "titulo": "B", "financiacion": TEXTO},
                                "9": {"id": 9, "titulo": "C", "financiacion": TEXTO}}
        lote = Path(carpeta) / "lote.json"
        lote.write_text(json.dumps({"8": [BUENA["pago"], BUENA["papel"], BUENA["conflictos"]],
                                    "7": [BUENA["pago"], "Acme diseñó el ensayo junto con Roche.", BUENA["conflictos"]],
                                    "99": ["A.", "B.", "C."], "9": ["Solo dos renglones.", "Falta uno."]}), encoding="utf-8")
        assert fb.cmd_aplicar([str(lote)]) == 1, "un lote con errores sale con 1"
        escrito = json.loads(fb.ARCHIVO.read_text(encoding="utf-8"))
        assert list(escrito["fichas"]) == ["8"] and escrito["fichas"]["8"] == BUENA and escrito["_nota"] == fb.NOTA
        assert fb.estado() == (["8"], [], ["7", "9"], [])
        # El resumen 8 se corrige: su ficha queda desfasada, no da errores aunque el texto nuevo ya no nombre a la empresa, y
        # vuelve a estar pendiente; un archivo con una ficha de un resumen que no existe sí es un error.
        fb.resumenes = lambda: {"8": {"id": 8, "titulo": "B", "financiacion": "Financiado con fondos públicos."}}
        assert fb.estado() == ([], ["8"], [], []) and fb.cmd_validar([]) == 0
        fb.resumenes = lambda: {"7": {"id": 7, "titulo": "A", "financiacion": TEXTO}}
        assert fb.estado()[3] == ["8: no existe ese resumen"] and fb.cmd_validar([]) == 1
    finally:
        fb.ARCHIVO, fb.resumenes = real

# 4. La huella es la misma en la herramienta y en el generador del índice, y el índice publicado coincide con el archivo:
#    con ficha vigente lleva los tres renglones y no el texto completo; sin ella, el texto completo y nada más.
muestra = ["", "Financiado por la industria.", origen[vigentes[0]]["financiacion"], "áéíóú ñ · «»"]
guion = ("import fs from 'node:fs';import {fundingDigest} from './scripts/build-data-index.mjs';"
         "console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(fundingDigest)))")
salida = subprocess.run(["node", "--input-type=module", "-e", guion], input=json.dumps(muestra), cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", check=True).stdout
assert json.loads(salida) == [fb.huella(t) for t in muestra], "la huella de Python y la de Node no coinciden"
indice = {str(r["id"]): r for r in json.loads((RAIZ / "datos/indice.json").read_text(encoding="utf-8"))}
assert set(indice) == set(origen)
for clave, registro in indice.items():
    if clave in vigentes:
        ficha = datos["fichas"][clave]
        assert registro.get("_fin") == [ficha["pago"], ficha["papel"], ficha["conflictos"]] and "financiacion" not in registro, clave
    else:
        assert "_fin" not in registro and registro.get("financiacion") == origen[clave]["financiacion"], clave
    assert "_min" not in registro, "el índice no lleva tiempos de lectura"

assert fb.ARCHIVO.read_bytes() == antes, "las pruebas no deben modificar financiacion-breve.json"
print(f"FINANCIACIÓN BREVE PASS: {len(vigentes)} fichas vigentes, {len(desfasadas)} desfasadas y {len(sin_ficha)} resúmenes sin ficha; "
      "guardas de nombres y cifras, escritura por lotes, ficha desfasada sin errores falsos, huella común con Node e índice al día")
