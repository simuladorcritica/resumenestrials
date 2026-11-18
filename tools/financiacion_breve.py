#!/usr/bin/env python3
"""Financiación en tres renglones para la ficha de las tarjetas (financiacion-breve.json).

La ficha que se abre en cada tarjeta mostraba el campo `financiacion` entero, que a veces pasa de mil caracteres. Aquí vive
su versión breve: quién pagó, qué papel tuvo la empresa y si los autores declaran conflictos de interés. Se redacta SOLO
con lo que dice el campo `financiacion` del resumen publicado; no añade nada. La página del resumen sigue mostrando el
texto completo.

    python tools/financiacion_breve.py validar        # comprueba el archivo entero (sale con 1 si hay errores)
    python tools/financiacion_breve.py pendientes     # resúmenes sin ficha breve vigente (nuevos o con el texto cambiado)
    python tools/financiacion_breve.py fuente 12 45   # el texto del que hay que partir, con su huella
    python tools/financiacion_breve.py aplicar lote.json   # añade o cambia fichas: {"12": ["quién pagó", "papel", "conflictos"]}

Cada ficha guarda en `de` la huella del texto con el que se escribió. Si el resumen se corrige y su financiación cambia, la
huella deja de coincidir: la tarjeta vuelve a mostrar el texto completo (scripts/build-data-index.mjs) y `pendientes` lo
dice, hasta que se escriba la ficha de nuevo.
"""
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARCHIVO = RAIZ / "financiacion-breve.json"
CAMPOS = ("pago", "papel", "conflictos")
ROTULOS = {"pago": "Quién pagó", "papel": "Papel de la empresa", "conflictos": "Conflictos de interés"}
MAXIMO = 230  # caracteres por renglón
SIN_DATO = "No consta en el resumen."
NOTA = ("Financiación en tres renglones para la ficha de las tarjetas: quién pagó, papel de la empresa y conflictos de interés. "
        "Se redacta solo con lo que dice el campo `financiacion` de cada resumen, sin añadir nada; lo que el resumen no dice "
        f"se escribe «{SIN_DATO}». `de` es la huella de ese texto: si cambia, la tarjeta muestra el texto completo hasta "
        "que se reescriba la ficha. Se cambia con tools/financiacion_breve.py, nunca a mano.")
NUMEROS = {"dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
           "once": 11, "doce": 12, "trece": 13, "catorce": 14, "quince": 15, "dieciseis": 16, "diecisiete": 17, "dieciocho": 18,
           "diecinueve": 19, "veinte": 20, "veintiun": 21, "veintiuno": 21, "veintidos": 22, "veintitres": 23, "veinticuatro": 24,
           "veinticinco": 25, "treinta": 30, "cuarenta": 40, "cincuenta": 50, "ambos": 2, "ambas": 2}
# Palabras que el redactor puede poner con mayúscula sin que estén en el resumen: no nombran a nadie.
LIBRES = {"si", "no", "sin", "el", "la", "los", "las", "un", "una", "fondos", "financiado", "financiada", "ninguno", "ninguna", "tambien",
          "ademas", "segun", "solo", "varios", "varias", "todos", "todas", "ningun", "dono", "donaron", "suministro", "aporto", "participo",
          "patrocino", "diseño", "pago", "pagaron", "empresa", "empresas", "autores", "autor", "resumen", "estado", "industria"}


def huella(texto):
    return hashlib.sha256(str(texto or "").encode("utf-8")).hexdigest()[:12]


def llano(texto):
    """Minúsculas y sin acentos, para comparar nombres."""
    return "".join(c for c in unicodedata.normalize("NFD", str(texto).lower()) if unicodedata.category(c) != "Mn")


def resumenes():
    return {str(r["id"]): r for r in json.loads((RAIZ / "resumenes.json").read_text(encoding="utf-8"))}


def leer():
    if not ARCHIVO.exists():
        return {"_nota": NOTA, "fichas": {}}
    return json.loads(ARCHIVO.read_text(encoding="utf-8"))


def escribir(datos):
    datos = {"_nota": NOTA, "fichas": dict(sorted(datos["fichas"].items(), key=lambda kv: int(kv[0])))}
    ARCHIVO.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def numeros_de(texto):
    """Cifras que nombra un texto, escritas con dígitos o con letra."""
    limpio = llano(texto)
    encontrados = {int(n) for n in re.findall(r"(?<![\w.,])\d{1,4}(?![\w]|[.,]\d)", limpio)}
    return encontrados | {v for k, v in NUMEROS.items() if re.search(rf"\b{k}\b", limpio)}


def nombres_de(texto):
    """Palabras que nombran a alguien o algo: con mayúscula inicial o siglas, salvo la primera de cada frase."""
    nombres = set()
    for frase in re.split(r"(?<=[.:;])\s+", texto):
        palabras = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][\wÁÉÍÓÚÜÑáéíóúüñ&'’-]*", frase)
        for i, p in enumerate(palabras):
            if not (p[0].isupper() or (any(c.isdigit() for c in p) and any(c.isalpha() for c in p))):
                continue
            if i == 0 and llano(p) in LIBRES:
                continue
            nombres.add(p)
    return nombres


def revisar(clave, ficha, origen):
    """Errores de una ficha frente al texto del resumen. Lista vacía si todo está bien."""
    errores = []
    if set(ficha) != {"de", *CAMPOS}:
        return [f"{clave}: la ficha lleva exactamente de, pago, papel y conflictos"]
    base = llano(origen)
    permitidos = numeros_de(origen)
    for campo in CAMPOS:
        t = ficha[campo]
        if not isinstance(t, str) or not t.strip():
            errores.append(f"{clave} · {campo}: vacío")
            continue
        if t != t.strip() or "  " in t or "\n" in t or "<" in t or ">" in t:
            errores.append(f"{clave} · {campo}: sin espacios sobrantes, saltos de línea ni marcas")
        if not t.endswith("."):
            errores.append(f"{clave} · {campo}: termina en punto")
        if len(t) > MAXIMO:
            errores.append(f"{clave} · {campo}: {len(t)} caracteres (máximo {MAXIMO})")
        if not t[0].isupper():
            errores.append(f"{clave} · {campo}: empieza con mayúscula")
        if t == SIN_DATO:
            continue
        for nombre in sorted(nombres_de(t)):
            trozos = [x for x in re.split(r"[-’']", llano(nombre)) if len(x) > 1]
            if llano(nombre) in LIBRES or llano(nombre) in base or (trozos and all(x in base for x in trozos)):
                continue
            errores.append(f"{clave} · {campo}: «{nombre}» no está en el texto del resumen")
        for n in sorted(numeros_de(t) - permitidos):
            errores.append(f"{clave} · {campo}: la cifra {n} no está en el texto del resumen")
    if ficha["pago"] == SIN_DATO:
        errores.append(f"{clave} · pago: todo resumen dice quién financió el ensayo")
    return errores


def estado():
    """(vigentes, desfasadas, sin_ficha, errores)."""
    datos, origen = leer(), resumenes()
    vigentes, desfasadas, errores = [], [], []
    if datos.get("_nota") != NOTA:
        errores.append("la nota del archivo no es la de la herramienta")
    for clave, ficha in datos.get("fichas", {}).items():
        if clave not in origen:
            errores.append(f"{clave}: no existe ese resumen")
            continue
        if not isinstance(ficha, dict):
            errores.append(f"{clave}: la ficha no es un objeto")
            continue
        # Una ficha desfasada no se muestra (la tarjeta vuelve al texto completo): queda como pendiente y solo se le exige
        # la forma. Compararla con un texto que ya no es el suyo daría errores que no lo son.
        if ficha.get("de") == huella(origen[clave]["financiacion"]):
            errores += revisar(clave, ficha, origen[clave]["financiacion"])
            vigentes.append(clave)
        else:
            if set(ficha) != {"de", *CAMPOS}:
                errores.append(f"{clave}: la ficha lleva exactamente de, pago, papel y conflictos")
            desfasadas.append(clave)
    sin_ficha = [c for c in origen if c not in datos.get("fichas", {})]
    return vigentes, desfasadas, sin_ficha, errores


def cmd_validar(_args):
    vigentes, desfasadas, sin_ficha, errores = estado()
    for e in errores:
        print("ERROR", e)
    for c in desfasadas:
        print(f"DESFASADA {c}: el resumen cambió su financiación; la tarjeta muestra el texto completo hasta reescribir la ficha")
    print(f"Financiación breve: {len(vigentes)} vigentes, {len(desfasadas)} desfasadas, {len(sin_ficha)} resúmenes sin ficha, {len(errores)} errores.")
    return 1 if errores else 0


def cmd_pendientes(_args):
    _vigentes, desfasadas, sin_ficha, _errores = estado()
    print(" ".join(sorted(desfasadas + sin_ficha, key=int)) or "ninguno")
    return 0


def cmd_fuente(args):
    origen = resumenes()
    for clave in args:
        r = origen[clave]
        print(f"## {clave} · {huella(r['financiacion'])} · {r['titulo']}\n{r['financiacion']}\n")
    return 0


def cmd_aplicar(args):
    lote = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    datos, origen = leer(), resumenes()
    errores = []
    for clave, valores in lote.items():
        if clave not in origen:
            errores.append(f"{clave}: no existe ese resumen")
            continue
        if not (isinstance(valores, list) and len(valores) == 3):
            errores.append(f"{clave}: tres renglones (quién pagó, papel de la empresa, conflictos de interés)")
            continue
        ficha = {"de": huella(origen[clave]["financiacion"]), **dict(zip(CAMPOS, valores))}
        fallos = revisar(clave, ficha, origen[clave]["financiacion"])
        errores += fallos
        if not fallos:
            datos["fichas"][clave] = ficha
    escribir(datos)
    for e in errores:
        print("ERROR", e)
    print(f"Aplicadas {len(lote) - len({e.split(':')[0].split(' ·')[0] for e in errores})} de {len(lote)} fichas; el archivo tiene {len(datos['fichas'])}.")
    return 1 if errores else 0


if __name__ == "__main__":
    ordenes = {"validar": cmd_validar, "pendientes": cmd_pendientes, "fuente": cmd_fuente, "aplicar": cmd_aplicar}
    if len(sys.argv) < 2 or sys.argv[1] not in ordenes:
        sys.exit(__doc__)
    sys.exit(ordenes[sys.argv[1]](sys.argv[2:]))
