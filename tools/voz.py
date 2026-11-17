#!/usr/bin/env python3
"""Voz de los resúmenes completos.

Convierte el texto PUBLICADO de un resumen completo en texto para leer en voz alta y genera muestras de voz con
Google Cloud Text-to-Speech. Solo cambia CÓMO SE LEE: desarrolla símbolos, unidades y abreviaturas estadísticas.
Nunca cambia una cifra ni quita una palabra; `revisar()` lo comprueba y, si un resumen no pasa, no se le genera audio.

Se lee el título, la revista, la fecha y todas las secciones del resumen completo menos «Referencia y registro»
(decisión del editor, 16-nov-2026). El resumen breve no lleva voz.

Los nombres de los ensayos y de las revistas se dicen como suenan en inglés (decisión del editor, 16-nov-2026): con
las voces que admiten SSML (WaveNet, la elegida) van dentro de <lang xml:lang="en-US">; el texto es el mismo.

Órdenes:
  python tools/voz.py texto ID              imprime lo que se leerá del resumen ID
  python tools/voz.py comprobar             pasa las guardas a todos los resúmenes (sale con 1 si alguno falla)
  python tools/voz.py muestras --salida D   genera las muestras de tools/voz_muestras.json en la carpeta D
                                            (necesita la variable de entorno GOOGLE_TTS_API_KEY; nunca se imprime)
  python tools/voz.py generar [--ids 2,69] [--maximo N] [--informe D]
                                            genera el audio de los resúmenes que no lo tienen vigente y lo sube al
                                            almacén (Cloudflare R2), según tools/voz_plan.json. Necesita además
                                            R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET.
                                            Con TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID avisa al editor cuando un
                                            resumen se queda sin audio (cupo del mes, guarda o error).

El audio sigue al texto publicado: un resumen nuevo recibe su audio y uno corregido pierde el anterior en la misma
ejecución y recibe el nuevo. Cada resumen se lee por partes (presentación, cada sección y cierre) y el audio de cada
parte se guarda: al corregir un resumen solo se vuelve a generar la parte que cambió. Van primero los corregidos,
luego los nuevos y al final el archivo antiguo. Nunca se pasa de la parte gratuita del mes: lo que no cabe espera
en cola al mes siguiente (decisiones del editor, 17-nov-2026).
"""
import argparse
import base64
import calendar
import datetime
import hashlib
import hmac
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = 5  # Sube cuando cambien las reglas de lectura o el léxico (queda anotada en cada audio generado).
LEX = json.loads((ROOT / "tools" / "voz_lexico.json").read_text(encoding="utf-8"))
SIN_VOZ = {"Referencia y registro"}
LIMITE_BYTES = 4500  # La API admite 5000 bytes de texto por petición.
LIMITE_SSML = 4900  # Con SSML las etiquetas también cuentan para esos 5000 bytes.
IDIOMA_NOMBRES = "en-US"  # Idioma en que se dicen los nombres de ensayos y revistas.
VOZ = "es-US-Wavenet-B"  # Voz elegida por el editor (16-nov-2026).
MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()

# ---------- Texto publicado ----------

def _plano(fragmento):
    """Texto de un fragmento de `cuerpo` (solo usa h2, p y strong), sin etiquetas."""
    fragmento = re.sub(r"<(?![a-zA-Z/])", "&lt;", fragmento)  # un «<» suelto (p<0.05) no es una etiqueta
    return html.unescape(re.sub(r"</?(?:strong|p|h2)\b[^>]*>", "", fragmento)).strip()


def secciones(r):
    """[(título de la sección, [párrafos])] del resumen completo, en su orden y sin las secciones que no se leen."""
    out = []
    for titulo, cuerpo in re.findall(r"<h2>(.*?)</h2>(.*?)(?=<h2>|$)", r["cuerpo"], re.S):
        titulo = _plano(titulo)
        if titulo in SIN_VOZ:
            continue
        parrafos = [_plano(p) for p in re.findall(r"<p>(.*?)</p>", cuerpo, re.S)]
        resto = _plano(re.sub(r"<p>.*?</p>", "", cuerpo, flags=re.S))
        if resto:
            parrafos.append(resto)  # texto fuera de <p>: no se pierde
        out.append((titulo, [p for p in parrafos if p]))
    return out


def fecha_hablada(iso):
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", str(iso or "").strip())
    return f"{int(m[3])} de {MESES[int(m[2]) - 1]} de {m[1]}" if m and 1 <= int(m[2]) <= 12 else ""


# ---------- Reglas de lectura ----------

_SUPER = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")
_SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
_UNI = LEX["unidades"]
_ATOMO = "|".join(sorted(map(re.escape, _UNI), key=len, reverse=True))
_SUELTA = "|".join(sorted(map(re.escape, LEX["unidades_sueltas"]), key=len, reverse=True))
_ALFA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ"
# Marcas internas de «esto se dice en inglés». Cuentan como letras para que las reglas de lectura den exactamente el
# mismo resultado con marcas que sin ellas (lo comprueba `revisar`); nunca llegan al texto que se envía como texto plano.
_INI, _FIN = "\ue000", "\ue001"
_LETRA = _ALFA + _INI + _FIN
_NUM = r"\d+(?:[.,]\d+)*"
_ROMANO = r"(?:VIII|VII|VI|IV|IX|III|II|I|V|X)"
_ROMANOS = {"I": "uno", "II": "dos", "III": "tres", "IV": "cuatro", "V": "cinco", "VI": "seis", "VII": "siete", "VIII": "ocho", "IX": "nueve", "X": "diez"}
_TRAS = "|".join(sorted((re.escape(k) if k.isupper() else "(?i:" + re.escape(k) + ")" for k in LEX["romanos_tras"]), key=len, reverse=True))
_GRIEGAS = {"α": "alfa", "β": "beta", "δ": "delta", "Δ": "delta", "σ": "sigma", "χ": "ji"}
_PLURAL_IC = re.compile(r"\b((?i:los|sus|ambos|estos|esos|unos|dos|tres))\s+IC\b")
_EXPANSIONES = sorted({v for v in LEX["siglas"].values()}, key=len, reverse=True)


def canonico(t):
    """Forma canónica previa. Es lo único que puede tocar dígitos (O₂ → O2, 10⁹ → 10^9, PaO2/FiO2 → palabras), y por eso
    la guarda de cifras compara contra el texto publicado después de este mismo paso."""
    t = unicodedata.normalize("NFC", t)
    t = re.sub(r"[    ]", " ", t)
    t = re.sub(r"\bmm\s+Hg\b", "mmHg", t)
    t = re.sub(r"\b(mm|cm|m)([23])(?=[\s.,;:)/\]]|$)", lambda m: m.group(1) + ("²" if m.group(2) == "2" else "³"), t)  # m2 → m², mm3 → mm³
    for a, b in LEX["literales"]:
        t = t.replace(a, b)
    t = t.translate(_SUB)
    t = re.sub(r"(?<=\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)", lambda m: "^" + m.group(1).translate(_SUPER), t)  # 10⁹ → 10^9
    t = re.sub(r"χ\s?[²2]", "ji cuadrada", t)
    t = re.sub(r"[Ⅰ-Ⅹ]", lambda m: ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")[ord(m.group(0)) - 0x2160], t)
    t = re.sub(r"(?<![\d.,])(\d{1,3})((?: \d{3})+)(?![\d.,]|\s\d)", lambda m: m.group(1) + m.group(2).replace(" ", ""), t)  # 12 000 → 12000
    return t


_NOMBRES = None


def nombres_ensayos():
    """{nombre escrito: nombre dicho} de las palabras que forman los nombres de los ensayos resumidos.

    El nombre de un ensayo se dice de corrido, como palabras, no letra por letra (decisión del editor, 16-nov-2026):
    ARISE FLUIDS → «Arise Fluids». Se toman las palabras con dos o más mayúsculas y más de tres letras de lo que cada título
    lleva antes de los dos puntos. Las siglas que sí se deletrean (`ensayos_deletreados`) y las de tres letras o menos
    (ICU, CKD, AF) se dejan como están; `ensayos` del léxico fija los casos que no salen bien con la regla general.
    """
    global _NOMBRES
    if _NOMBRES is None:
        fijos = {k: v for k, v in LEX["ensayos"].items() if not k.startswith("_")}
        dejar = set(LEX["ensayos_deletreados"])
        nombres = {}
        for r in resumenes():
            titulo = str(r.get("titulo") or "")
            if ":" not in titulo:
                continue
            for palabra in re.findall(r"[A-Za-z]+", titulo.split(":", 1)[0]):
                if len(palabra) > 3 and sum(c.isupper() for c in palabra) >= 2 and palabra not in dejar:
                    nombres[palabra] = fijos.get(palabra, palabra[0].upper() + palabra[1:].lower())
        nombres.update({k: v for k, v in fijos.items() if k not in dejar})
        _NOMBRES = nombres
    return _NOMBRES


_RE_NOMBRES = None


def decir_nombres(t, marcas=False):
    """Nombres de ensayos escritos como se dicen. Solo cambia mayúsculas por minúsculas (o lo que fije el léxico) y
    separa la cifra pegada al nombre (INTERACT4 → «Interact 4»). Con `marcas`, cada nombre queda entre marcas."""
    global _RE_NOMBRES
    nombres = nombres_ensayos()
    if _RE_NOMBRES is None:
        _RE_NOMBRES = re.compile(r"(?<![" + _LETRA + r"0-9])(" + "|".join(sorted(map(re.escape, nombres), key=len, reverse=True)) + r")(?![" + _LETRA + r"])(?=(\d?))")
    ini, fin = (_INI, _FIN) if marcas else ("", "")
    return _RE_NOMBRES.sub(lambda m: ini + nombres[m.group(1)] + fin + (" " if m.group(2) else ""), t)


def sin_marcas(t):
    return t.replace(_INI, "").replace(_FIN, "")


def _unir(t):
    """Junta en un solo tramo las palabras de un mismo nombre: «Arise Fluids», «Andromeda-Shock», «Remap-CAP»,
    «ECLS-Shock», «Emperor-Preserved». La cifra final («-2») queda fuera y se dice en español."""
    previo = None
    while previo != t:
        previo = t
        t = re.sub(_FIN + r"(-[A-Z]{2,5}|-[A-Z][a-z]+)(?![" + _LETRA + r"0-9])", r"\1" + _FIN, t)
        t = re.sub(r"(?<![" + _LETRA + r"0-9-])([A-Z]{2,5}-)" + _INI, _INI + r"\1", t)
        t = re.sub(_FIN + r"([ -])" + _INI, r"\1", t)
    return t


def _unidad(clave, singular):
    return _UNI[clave][0 if singular else 1]


def _compuesta(m):
    """mg/dl → «miligramos por decilitro»; ml/min/1.73 m² → «mililitros por minuto por 1.73 metros cuadrados»."""
    numero, espacio, primero, producto, resto = m.group("n"), m.group("e") or "", m.group("a"), m.group("b"), m.group("r")
    uno = numero is not None and numero in ("1", "1.0", "1,0")
    cabeza = _unidad(primero, uno) if primero in _UNI else primero
    if producto:
        cabeza += " " + _unidad(producto, True)
    partes = []
    for parte in resto.strip("/").split("/"):
        s = re.fullmatch(r"(1[.,]73)\s?(m²)", parte)
        partes.append(f"{s[1]} {_unidad(s[2], False)}" if s else _unidad(parte, True))
    return (numero or "") + (espacio if numero is not None else "") + (" " if numero is not None and not espacio else "") + cabeza + " por " + " por ".join(partes)


_RE_COMPUESTA = re.compile(
    r"(?:(?P<n>" + _NUM + r")(?P<e>\s?))?(?<![" + _LETRA + r"µμ°])(?P<a>" + _ATOMO + r"|[a-záéíóúñ]{3,})(?:·(?P<b>" + _ATOMO + r"))?"
    r"(?P<r>(?:/(?:1[.,]73\s?m²|" + _ATOMO + r"))+)(?![" + _LETRA + r"0-9µμ°²³])")
_RE_NUM_POR = re.compile(r"(?<=\d)/(" + _ATOMO + r")(?![" + _LETRA + r"0-9µμ°²³/])")
_RE_SUELTA = re.compile(r"(?P<n>" + _NUM + r")(?P<c>[\])]?)(?P<e>\s?)(?P<u>" + _SUELTA + r")(?![" + _LETRA + r"0-9µμ°²³·]|/(?!\d))")
_RE_ROMANOS = re.compile(r"\b(" + _TRAS + r")(\s+)(" + _ROMANO + r"(?:\s*(?:,|/|-|\ba\b|\bo\b|\by\b|\bu\b)\s*" + _ROMANO + r")*)\b(?![" + _LETRA + r"])")


_RE_POR = re.compile(r"(?<=\bpor )(" + "|".join(sorted((re.escape(k) for k in _UNI if len(k) > 1), key=len, reverse=True)) + r")(?![" + _LETRA + r"0-9µμ°²³/·])")


def _suelta(m):
    u = m.group("u")
    if len(u) == 1 and not m.group("e"):
        return m.group(0)  # «2b», «5D», «1c»: una letra pegada al número no es una unidad
    return m.group("n") + m.group("c") + " " + _unidad(u, m.group("n") in ("1", "1.0", "1,0"))


def leer(t, marcas=False):
    """Texto para leer en voz alta. No añade, quita ni cambia cifras ni palabras del texto publicado.
    Con `marcas`, el mismo texto con los nombres de los ensayos entre marcas (para decirlos en inglés)."""
    t = decir_nombres(canonico(t), marcas)
    t = re.sub(r"[™®©]", "", t)
    t = re.sub(r"_+", " ", t)
    t = t.replace("&", " y ")
    for letra, nombre in _GRIEGAS.items():
        t = re.sub(re.escape(letra) + r"(?![µμ])", nombre, t)
    # Estadística
    t = re.sub(r"\bIC\s*(?:del?\s*)?(" + _NUM + r")\s*%?(?=[\s,;:.)(\]]|$)", r"intervalo de confianza del \1 por ciento", t)
    t = _PLURAL_IC.sub(r"\1 intervalos de confianza", t)
    comparar = {"=": "igual a", "<": "menor de", ">": "mayor de", "≤": "menor o igual a", "≥": "mayor o igual a"}
    t = re.sub(r"\b([pP])\s*([=<>≤≥])\s*", lambda m: f"p {comparar[m.group(2)]} ", t)
    # Números romanos tras fase, clase, tipo, APACHE…
    t = _RE_ROMANOS.sub(lambda m: m.group(1) + m.group(2) + re.sub(r"\b" + _ROMANO + r"\b", lambda x: _ROMANOS[x.group(0)], m.group(3)), t)
    # Presión arterial y unidades
    t = re.sub(r"(\d{2,3})/(\d{2,3})(?=\s?mmHg)", r"\1 sobre \2", t)
    t = _RE_COMPUESTA.sub(_compuesta, t)
    t = _RE_NUM_POR.sub(lambda m: " por " + _unidad(m.group(1), True), t)
    t = _RE_SUELTA.sub(_suelta, t)
    t = _RE_POR.sub(lambda m: _unidad(m.group(1), True), t)
    t = re.sub(r"[µμ]", "micro", t)
    # Siglas estadísticas
    for sigla, completo in LEX["siglas"].items():
        t = re.sub(r"(?<![" + _LETRA + r"0-9-])" + re.escape(sigla) + r"(?![" + _LETRA + r"0-9-])", completo, t)
    # Símbolos
    for simbolo, palabras in (("≥", "mayor o igual a"), ("≤", "menor o igual a"), ("<", "menor de"), (">", "mayor de"), ("=", "igual a"),
                              ("±", "más menos"), ("×", "por"), ("^", "a la"), ("≈", "aproximadamente"), ("+", "más")):
        t = t.replace(simbolo, f" {palabras} ")
    # Rangos, negativos y barras
    t = re.sub(r"(?i)\b(fases?\s\d)\s?/\s?(\d)\b", r"\1 \2", t)  # fase 2/3
    t = re.sub(r"(?<![;\d.,])(\d{1,4})((?::\d{1,4})+)(?![\d.,]*\d)", lambda m: m.group(1) + m.group(2).replace(":", " a "), t)  # 1:1, 2:1, 1:800
    t = re.sub(r"(?<=\d)\s+[−-]\s+(?=\d)", " menos ", t)  # resta: 46.9 − 33.0
    t = re.sub(r"(?<=[\d%])[-–—−](?=\d)", " a ", t)  # rango: 0.41-0.92, 508–1529, 10.5%-10.9%
    t = re.sub(r"(?<=\d)\s[–—]\s(?=\d)", " a ", t)
    t = re.sub(r"[−](?=\s?\d)", "menos ", t)
    t = re.sub(r"(?<![" + _LETRA + r"0-9.,%)\]])-(?=\d)", "menos ", t)
    t = t.replace("−", "-")
    t = re.sub(r"\s[–—]\s", ", ", t)
    t = re.sub(r"[–—]", "-", t)
    t = re.sub(r"(?<=\d)\s?/\s?(?=\d)", " sobre ", t)
    t = re.sub(r"\s?/\s?", " ", t)
    t = t.replace("·", " ")
    t = t.replace("[", "(").replace("]", ")")
    # «hazard ratio (HR)» no se dice dos veces
    for completo in _EXPANSIONES:
        t = re.sub("(" + re.escape(completo) + r")\s*\(\s*" + re.escape(completo) + r"\s*\)", r"\1", t, flags=re.I)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\(\s+", "(", t)
    t = re.sub(r"\s+([,;:)]|\.(?!\d))", r"\1", t)
    return _unir(t.strip()) if marcas else t.strip()


def revista_hablada(r):
    return LEX["revistas"].get(str(r.get("revista") or "").strip(), str(r.get("revista") or "").strip())


def bloques(r, marcas=False):
    """Lo que se lee, por párrafos y en orden: presentación, cada sección con su título y cierre.
    Con `marcas`, lo mismo con los nombres de ensayos y la revista entre marcas (se dicen en inglés)."""
    fecha = fecha_hablada(r.get("fecha"))
    presentacion = "Resúmenes Trials. " + leer(str(r["titulo"]).strip(), marcas).rstrip(".") + "."
    revista = revista_hablada(r)
    if revista:
        if marcas and str(r.get("revista") or "").strip() in LEX["revistas"]:
            revista = _INI + revista + _FIN
        presentacion += f" Publicado en {revista}" + (f", el {fecha}." if fecha else ".")
    out = [presentacion]
    for titulo, parrafos in secciones(r):
        out.append(leer(titulo, marcas).rstrip(".") + ".")
        out.extend(leer(p, marcas) for p in parrafos)
    out.append("Fin del resumen.")
    return out


def texto_voz(r):
    return "\n\n".join(bloques(r))


def trozos(parrafos, limite=LIMITE_BYTES):
    """Agrupa párrafos en peticiones de menos de `limite` bytes; un párrafo demasiado largo se parte por oraciones."""
    piezas = []
    for p in parrafos:
        if len(p.encode("utf-8")) <= limite:
            piezas.append(p)
            continue
        actual = ""
        for oracion in re.split(r"(?<=[.;:])\s+", p):
            if actual and len((actual + " " + oracion).encode("utf-8")) > limite:
                piezas.append(actual)
                actual = oracion
            else:
                actual = (actual + " " + oracion).strip()
        if actual:
            piezas.append(actual)
    out, actual = [], ""
    for pieza in piezas:
        if actual and len((actual + "\n\n" + pieza).encode("utf-8")) > limite:
            out.append(actual)
            actual = pieza
        else:
            actual = (actual + "\n\n" + pieza) if actual else pieza
    if actual:
        out.append(actual)
    return out


# ---------- SSML (voces que lo admiten) ----------

def admite_ssml(voz):
    """Chirp HD y Chirp 3 HD solo aceptan texto; WaveNet, Neural2, Standard, Studio y News aceptan SSML."""
    return "Chirp" not in voz


def ssml(texto):
    """SSML de un trozo con marcas: un <p> por párrafo y cada tramo marcado dentro de <lang> para que la misma voz
    lo diga en inglés. No añade ni quita texto; solo cambia por un espacio el guion entre un nombre y su cifra."""
    def parrafo(p):
        for signo, escape in (("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"), ('"', "&quot;"), ("'", "&apos;")):
            p = p.replace(signo, escape)
        p = re.sub(_FIN + r"-(?=\d)", _FIN + " ", p)
        return "<p>" + p.replace(_INI, f'<lang xml:lang="{IDIOMA_NOMBRES}">').replace(_FIN, "</lang>") + "</p>"
    return "<speak>" + "".join(parrafo(p.strip()) for p in texto.split("\n\n") if p.strip()) + "</speak>"


def texto_de_ssml(s):
    """El texto que queda al quitar las etiquetas (para comprobar que el SSML no cambia lo que se lee)."""
    return html.unescape(re.sub(r"<[^>]+>", "", re.sub(r"</p>\s*<p>", "\n\n", s)))


def _junto(t):
    """Para comparar el SSML con el texto: lo único que el SSML cambia es, por un espacio, el guion entre un nombre y su cifra."""
    return re.sub(r"[\s-]+", " ", t).strip()


def trozos_ssml(parrafos, limite=LIMITE_BYTES):
    """Peticiones en SSML a partir de párrafos con marcas, todas dentro del límite de la API."""
    for tope in range(limite, 900, -400):
        partes = [ssml(x) for x in trozos(parrafos, tope)]
        if all(len(x.encode("utf-8")) <= LIMITE_SSML for x in partes):
            return partes
    raise ValueError("no se pudo partir el texto en peticiones SSML dentro del límite de la API")


# ---------- Guardas ----------

_PERMITIDO = re.compile(r"[^" + _ALFA + r"À-ÖØ-öø-ž0-9ªº \n.,;:()¿?¡!%«»\"'’“”-]")
_OMITIBLES = {k for k in _UNI if re.fullmatch(r"[a-záéíóúñ]{4,}", k)}


def _cifras(t):
    return re.findall(_NUM, t)


def _palabras(t):
    return re.findall(r"[a-záéíóúüñ]{4,}", t)


def revisar(r):
    """Problemas que impiden generar la voz de un resumen (lista vacía = se puede leer)."""
    problemas = []
    # La revista se dice con su nombre completo, en inglés. Sin ese nombre la voz leería la abreviatura tal cual («Crit Care Med»).
    revista = str(r.get("revista") or "").strip()
    if revista and revista not in LEX["revistas"]:
        problemas.append(f"la revista «{revista}» no tiene nombre para leerse (tools/voz_lexico.json, «revistas»)")
    partes = secciones(r)
    if not partes or any(not p for _, p in partes):
        problemas.append("una sección no tiene párrafos")
    fuente = "\n".join("\n".join([t] + p) for t, p in partes)
    hablado = "\n".join("\n".join([leer(t)] + [leer(x) for x in p]) for t, p in partes)
    if _cifras(canonico(fuente)) != _cifras(hablado):
        a, b = _cifras(canonico(fuente)), _cifras(hablado)
        i = next((k for k, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
        problemas.append(f"las cifras no coinciden desde la número {i + 1}: publicado {a[i:i + 3]} · leído {b[i:i + 3]}")
    quedan = iter(_palabras(hablado))
    perdida = next((w for w in _palabras(decir_nombres(canonico(fuente))) if w not in _OMITIBLES and not any(w == x for x in quedan)), None)
    if perdida:
        problemas.append(f"se pierde o cambia de sitio la palabra «{perdida}»")
    raros = sorted(set(_PERMITIDO.findall(texto_voz(r))))
    if raros:
        problemas.append("quedan signos sin regla de lectura: " + " ".join(raros))
    grandes = [len(x.encode("utf-8")) for x in trozos(bloques(r)) if len(x.encode("utf-8")) > LIMITE_BYTES]
    if grandes:
        problemas.append(f"un trozo supera el límite de la API ({max(grandes)} bytes)")
    # Con marcas (nombres en inglés) se lee exactamente lo mismo, y el SSML no añade más que etiquetas.
    marcados = bloques(r, True)
    if [sin_marcas(x) for x in marcados] != bloques(r):
        i = next((k for k, (x, y) in enumerate(zip(marcados, bloques(r))) if sin_marcas(x) != y), 0)
        problemas.append(f"las marcas de los nombres cambian la lectura del párrafo {i + 1}")
    elif any(re.search(_INI + "[^" + _FIN + "]*(?:" + _INI + "|$)|^[^" + _INI + "]*" + _FIN, x) for x in marcados):
        problemas.append("las marcas de los nombres no cierran bien")
    else:
        try:
            envios = peticiones(r)
        except ValueError as e:
            problemas.append(str(e))
        else:
            if _junto(" ".join(texto_de_ssml(x) for x in envios)) != _junto(texto_voz(r)):
                problemas.append("el SSML no dice lo mismo que el texto para leer")
    return problemas


def resumenes():
    return json.loads((ROOT / "resumenes.json").read_text(encoding="utf-8"))


# ---------- Google Cloud Text-to-Speech ----------

API = "https://texttospeech.googleapis.com/v1"
AUDIO = {"audioEncoding": "MP3"}
REINTENTOS = 4  # Ante un fallo pasajero (429, 5xx o red) se reintenta con espera creciente.
ESPERA = 5


def _api(ruta, clave, cuerpo=None):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    for intento in range(1, REINTENTOS + 1):
        req = urllib.request.Request(API + ruta, data=datos, headers={"X-Goog-Api-Key": clave, "Content-Type": "application/json; charset=utf-8"})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and intento < REINTENTOS:
                time.sleep(ESPERA * intento)
                continue
            try:
                detalle = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", "")
            except (ValueError, OSError):
                detalle = ""
            raise SystemExit(f"Google Cloud respondió {e.code} en {ruta.split('?')[0]}: {detalle[:300]}") from None
        except urllib.error.URLError as e:
            if intento < REINTENTOS:
                time.sleep(ESPERA * intento)
                continue
            raise SystemExit(f"No se pudo conectar con Google Cloud: {e.reason}") from None


def sintetizar(texto, voz, idioma, clave, es_ssml=False):
    """MP3 de un texto o de un SSML (ya dentro del límite de bytes)."""
    cuerpo = {"input": {"ssml" if es_ssml else "text": texto}, "voice": {"languageCode": idioma, "name": voz}, "audioConfig": AUDIO}
    return base64.b64decode(_api("/text:synthesize", clave, cuerpo)["audioContent"])


def fragmento(r, seccion, caracteres, presentacion=False, marcas=False):
    """Los primeros párrafos de una sección, hasta `caracteres`, cortados en fin de oración.
    Con `marcas`, el mismo fragmento con los nombres entre marcas."""
    parrafos = next((p for t, p in secciones(r) if t == seccion), None)
    if not parrafos:
        raise SystemExit(f"El resumen {r['id']} no tiene la sección «{seccion}»")
    texto = " ".join(leer(p) for p in parrafos)
    cortado = len(texto) > caracteres
    if cortado:
        corte = next((c for c in (texto.rfind(marca, 0, caracteres) for marca in (". ", "; ", ", ", " ")) if c >= caracteres * 0.7), caracteres)
        texto = texto[:corte]
    if marcas:  # el mismo corte, contado sin las marcas
        marcado, vistos, hasta = " ".join(leer(p, True) for p in parrafos), 0, 0
        while vistos < len(texto) or (hasta < len(marcado) and marcado[hasta] == _FIN):
            vistos += marcado[hasta] not in (_INI, _FIN)
            hasta += 1
        texto = marcado[:hasta] + (_FIN if marcado[:hasta].count(_INI) > marcado[:hasta].count(_FIN) else "")
    if cortado:
        texto = texto.rstrip(" ,;.") + "."
    return (bloques(r, marcas)[0] + "\n\n" if presentacion else "") + leer(seccion, marcas) + ".\n\n" + texto


def variantes(texto, muestra):
    """[(etiqueta, texto)]: el texto tal como lo deja `leer` y, si el plan las pide, variantes de prueba con otra
    forma de escribir algo (solo para comparar de oído en las muestras; no afectan a los resúmenes)."""
    out = [("", texto)]
    for v in muestra.get("variantes", []):
        cambiado = texto
        for a, b in v.get("cambios", {}).items():
            cambiado = cambiado.replace(a, b)
        if cambiado != texto:
            out.append((re.sub(r"[^a-z0-9-]", "", str(v["etiqueta"]).lower()), cambiado))
    return out


def versiones(r, muestra):
    """[(etiqueta, párrafos, con marcas)] de una muestra del plan: el texto tal cual (salvo `"base": false`), las
    variantes con `cambios` y, con `"ingles": true`, el mismo texto con los nombres marcados para decirse en inglés.
    `"completo": true` toma el resumen entero en lugar de un fragmento."""
    def parrafos(marcas):
        if muestra.get("completo"):
            return bloques(r, marcas)
        return fragmento(r, muestra["seccion"], int(muestra["caracteres"]), bool(muestra.get("presentacion")), marcas).split("\n\n")
    base = "\n\n".join(parrafos(False))
    out = [(etiqueta, texto.split("\n\n"), False) for etiqueta, texto in variantes(base, muestra) if etiqueta or muestra.get("base", True)]
    for v in muestra.get("variantes", []):
        if v.get("ingles"):
            out.append((re.sub(r"[^a-z0-9-]", "", str(v["etiqueta"]).lower()), parrafos(True), True))
    return out


def elegir_voces(plan, disponibles):
    """[(familia, género, voz)] según el plan: las voces pedidas por su nombre (`voces`) y, por familia, primero las
    preferidas que existan y después por orden alfabético."""
    generos = {v["name"]: v.get("ssmlGender", "") for v in disponibles}
    elegidas = [("-".join(v.split("-")[2:-1]), generos[v], v) for v in plan.get("voces", []) if v in generos]
    for familia in plan.get("familias", []):
        for genero in ("FEMALE", "MALE"):
            candidatas = sorted(v["name"] for v in disponibles if f"-{familia['nombre']}-" in v["name"] and v.get("ssmlGender") == genero)
            fijas = [c for nombre in plan.get("preferidas", []) for c in candidatas if c.endswith("-" + nombre)]
            elegidas += [(familia["nombre"], genero, v) for v in (fijas + [c for c in candidatas if c not in fijas])[:int(familia.get(genero, 0))]]
    return elegidas


def cmd_muestras(args):
    clave = os.environ.get("GOOGLE_TTS_API_KEY", "").strip()
    if not clave:
        print("Falta el secreto GOOGLE_TTS_API_KEY: sin la clave de Google Cloud no se pueden generar las muestras.")
        return 1
    plan = json.loads((ROOT / "tools" / "voz_muestras.json").read_text(encoding="utf-8"))
    datos = {int(r["id"]): r for r in resumenes()}
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    disponibles = []
    for idioma in plan["idiomas"]:
        disponibles += [v for v in _api(f"/voices?languageCode={idioma}", clave).get("voices", []) if idioma in v.get("languageCodes", [])]
    (salida / "voces_disponibles.json").write_text(json.dumps(sorted({v["name"]: v.get("ssmlGender", "") for v in disponibles}.items()), ensure_ascii=False, indent=1), encoding="utf-8")
    elegidas = elegir_voces(plan, disponibles)
    if not elegidas:
        print("Google Cloud no devolvió ninguna voz de las familias pedidas para", ", ".join(plan["idiomas"]))
        return 1
    indice, total = [], 0
    for numero, (familia, genero, voz) in enumerate(elegidas, 1):
        idioma = "-".join(voz.split("-")[:2])
        for muestra in plan["muestras"]:
            r = datos[int(muestra["id"])]
            for etiqueta, parrafos, con_marcas in versiones(r, muestra):
                if con_marcas and not admite_ssml(voz):
                    continue
                peticiones = trozos_ssml(parrafos) if con_marcas else trozos(parrafos)
                audio = b"".join(sintetizar(x, voz, idioma, clave, con_marcas) for x in peticiones)
                sufijo = ("_completo" if muestra.get("completo") else "") + ("_" + etiqueta if etiqueta else "")
                nombre = f"{numero:02d}_{familia}_{'mujer' if genero == 'FEMALE' else 'hombre'}_{voz.split('-')[-1]}_resumen{r['id']}{sufijo}.mp3"
                (salida / nombre).write_bytes(audio)
                enviados = sum(len(x) for x in peticiones)
                total += enviados
                indice.append({"archivo": nombre, "voz": voz, "familia": familia, "genero": genero, "resumen": r["id"], "seccion": "" if muestra.get("completo") else muestra["seccion"], "completo": bool(muestra.get("completo")),
                               "variante": etiqueta, "ssml": con_marcas, "caracteres": enviados, "peticiones": len(peticiones), "bytes": len(audio), "texto": sin_marcas("\n\n".join(parrafos))})
                print(f"{nombre}: {enviados} caracteres en {len(peticiones)} peticiones, {len(audio)} bytes")
    (salida / "indice.json").write_text(json.dumps({"version": VERSION, "caracteres": total, "muestras": indice}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Muestras: {len(indice)} archivos, {total} caracteres en total.")
    return 0


# ---------- Almacén de audios (Cloudflare R2, API compatible con S3) ----------

def firma_v4(metodo, host, ruta, cabeceras, hash_cuerpo, clave_id, secreto, region="auto", servicio="s3"):
    """Cabecera Authorization (AWS Signature V4). `cabeceras` lleva x-amz-date; se firman todas, junto con host."""
    todas = {k.lower(): " ".join(str(v).split()) for k, v in cabeceras.items()}
    todas["host"] = host
    firmadas = ";".join(sorted(todas))
    canonica = "\n".join([metodo, urllib.parse.quote(ruta, safe="/-_.~"), "", "".join(f"{k}:{todas[k]}\n" for k in sorted(todas)), firmadas, hash_cuerpo])
    fecha = todas["x-amz-date"]
    ambito = f"{fecha[:8]}/{region}/{servicio}/aws4_request"
    a_firmar = "\n".join(["AWS4-HMAC-SHA256", fecha, ambito, hashlib.sha256(canonica.encode("utf-8")).hexdigest()])
    clave = ("AWS4" + secreto).encode("utf-8")
    for parte in (fecha[:8], region, servicio, "aws4_request"):
        clave = hmac.new(clave, parte.encode("utf-8"), hashlib.sha256).digest()
    firma = hmac.new(clave, a_firmar.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"AWS4-HMAC-SHA256 Credential={clave_id}/{ambito},SignedHeaders={firmadas},Signature={firma}"


class Almacen:
    """Cubo de Cloudflare R2. Solo lo que hace falta: leer, escribir, comprobar y borrar un objeto.
    Las claves vienen de variables de entorno (secretos de GitHub) y nunca se imprimen."""

    def __init__(self, cuenta, clave_id, secreto, cubo, base=None):
        self.base = base or f"https://{cuenta}.r2.cloudflarestorage.com"
        self.host = urllib.parse.urlsplit(self.base).netloc
        self.clave_id, self.secreto, self.cubo = clave_id, secreto, cubo

    def _pedir(self, metodo, clave, cuerpo=b"", extra=None):
        ruta = f"/{self.cubo}/{clave}"
        for intento in range(1, REINTENTOS + 1):
            cab = {"x-amz-date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"), "x-amz-content-sha256": hashlib.sha256(cuerpo).hexdigest(), **(extra or {})}
            cab["Authorization"] = firma_v4(metodo, self.host, ruta, cab, cab["x-amz-content-sha256"], self.clave_id, self.secreto)
            req = urllib.request.Request(self.base + urllib.parse.quote(ruta, safe="/-_.~"), data=cuerpo if metodo == "PUT" else None, headers=cab, method=metodo)
            try:
                with urllib.request.urlopen(req, timeout=300) as resp:
                    return resp.status, resp.read(), dict(resp.headers)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return 404, b"", {}
                if e.code in (429, 500, 502, 503, 504) and intento < REINTENTOS:
                    time.sleep(ESPERA * intento)
                    continue
                # Del error solo se muestran el código y el mensaje: la respuesta completa repite datos de la petición.
                texto = e.read()[:2000].decode("utf-8", "replace")
                detalle = " · ".join(m.group(1) for m in (re.search(r"<Code>([^<]*)</Code>", texto), re.search(r"<Message>([^<]*)</Message>", texto)) if m)
                raise SystemExit(f"El almacén respondió {e.code} a {metodo} {clave}: {detalle[:300]}") from None
            except urllib.error.URLError as e:
                if intento < REINTENTOS:
                    time.sleep(ESPERA * intento)
                    continue
                raise SystemExit(f"No se pudo conectar con el almacén: {e.reason}") from None

    def leer(self, clave):
        estado, cuerpo, _ = self._pedir("GET", clave)
        return None if estado == 404 else cuerpo

    def existe(self, clave):
        """Tamaño en bytes del objeto, o None si no existe."""
        estado, _, cab = self._pedir("HEAD", clave)
        return None if estado == 404 else int({k.lower(): v for k, v in cab.items()}.get("content-length", 0))

    def escribir(self, clave, datos, tipo, cache):
        self._pedir("PUT", clave, datos, {"content-type": tipo, "cache-control": cache})

    def borrar(self, clave):
        self._pedir("DELETE", clave)


# ---------- Generación del audio de los resúmenes ----------

PLAN = ROOT / "tools" / "voz_plan.json"
CACHE_AUDIO = "public, max-age=31536000, immutable"  # El nombre del archivo lleva la huella: nunca cambia.
CACHE_FICHA = "public, max-age=60"


def partes(r, marcas=True):
    """Lo que se lee, en partes estables: la presentación, cada sección (su título y sus párrafos) y el cierre.
    Cada parte se envía y se guarda por separado, así que corregir una sección no obliga a generar las demás."""
    todo = bloques(r, marcas)
    grupos, i = [todo[:1]], 1
    for _titulo, parrafos in secciones(r):
        grupos.append(todo[i:i + 1 + len(parrafos)])
        i += 1 + len(parrafos)
    grupos.append(todo[i:])
    return [g for g in grupos if g]


def peticiones(r):
    """Lo que se envía a Google para leer un resumen entero: SSML con los nombres en inglés, parte por parte."""
    return [p for grupo in partes(r) for p in trozos_ssml(grupo)]


def peticiones_anteriores(r):
    """Cómo se partía el texto hasta el 17-nov-2026: de corrido, sin atender a las secciones. Solo sirve para
    reconocer los audios generados entonces, que siguen siendo válidos mientras su texto no cambie."""
    return trozos_ssml(bloques(r, True))


def _huella(envios):
    h = hashlib.sha256(f"{VOZ}\n{json.dumps(AUDIO, sort_keys=True)}\n".encode("utf-8"))
    for p in envios:
        h.update(p.encode("utf-8") + b"\n")
    return h.hexdigest()[:16]


def huella(r):
    """Identifica el audio vigente de un resumen: cambia solo si cambia lo que se envía a leer (el texto publicado o
    una regla de lectura que le afecte), la voz o el formato del audio. Un cambio del léxico que no toca a un resumen
    no le cambia la huella, así que no obliga a generarlo otra vez."""
    return _huella(peticiones(r))


def huella_anterior(r):
    """La huella de un audio generado antes de leer por partes (ver `peticiones_anteriores`)."""
    return _huella(peticiones_anteriores(r))


def fuente(r):
    """Huella del texto publicado que se lee (título, revista, fecha y cuerpo), sin reglas de lectura. Distingue una
    corrección del resumen (el audio anterior deja de valer) de un cambio en la forma de leerlo (el audio sigue siendo
    fiel al texto y vale hasta que se renueve)."""
    return hashlib.sha256(json.dumps([str(r.get(k) or "") for k in ("titulo", "revista", "fecha", "cuerpo")], ensure_ascii=False).encode("utf-8")).hexdigest()[:16]


def clave_parte(envio):
    """Dónde se guarda el audio de una parte: depende solo de lo que se envía, de la voz y del formato, así que dos
    resúmenes que dicen lo mismo («Fin del resumen.») comparten audio y una parte sin cambios no se paga dos veces."""
    return "partes/" + hashlib.sha256(f"{VOZ}\n{json.dumps(AUDIO, sort_keys=True)}\n{envio}".encode("utf-8")).hexdigest()[:32] + ".mp3"


def segundos_mp3(datos):
    """Duración de un MP3 recorriendo sus tramas; falla si entre trama y trama hay algo que no es audio."""
    i, muestras, frecuencia = 0, 0, 0
    while i < len(datos):
        if i + 4 > len(datos) or datos[i] != 0xFF or datos[i + 1] & 0xE0 != 0xE0:
            raise ValueError(f"el MP3 no es una sucesión limpia de tramas (byte {i})")
        cab = int.from_bytes(datos[i:i + 4], "big")
        version, capa, tasa, frec, relleno = (cab >> 19) & 3, (cab >> 17) & 3, (cab >> 12) & 15, (cab >> 10) & 3, (cab >> 9) & 1
        if version == 1 or capa != 1 or tasa in (0, 15) or frec == 3:
            raise ValueError(f"trama de MP3 no reconocida (byte {i})")
        kbps = ((0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320) if version == 3 else (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160))[tasa]
        frecuencia = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}[version][frec]
        i += (144 if version == 3 else 72) * kbps * 1000 // frecuencia + relleno
        muestras += 1152 if version == 3 else 576
    if not muestras or i != len(datos):
        raise ValueError("el MP3 está vacío o termina a media trama")
    return muestras / frecuencia


GRUPOS = ("corregidos", "nuevos", "archivo", "renovar")  # El orden en que se atiende lo que falta. Los de «renovar» tienen audio.


def _nombre(r):
    """Cómo se nombra un resumen en un aviso: su número y, si el título lo lleva, el nombre del ensayo."""
    titulo = str(r.get("titulo") or "")
    corto = titulo.split(":")[0].strip()
    return f"{int(r['id'])} {corto}" if ":" in titulo and 0 < len(corto) <= 28 else str(int(r["id"]))


def _lista(claves, por_id, maximo=12):
    nombres = [_nombre(por_id[c]) if c in por_id else c for c in claves]
    return ", ".join(nombres[:maximo]) + (f" y {len(nombres) - maximo} más" if len(nombres) > maximo else "")


def componer_aviso(informe, por_id, previo, ahora):
    """Lo que el editor debe saber y no se le ha dicho todavía. Devuelve (texto, anotado): `texto` vacío si no hay nada
    nuevo; `anotado` es lo que se guarda, una vez enviado el aviso, para no repetirlo en la ejecución siguiente."""
    mes = ahora[:7]
    siguiente = MESES[int(mes[5:7]) % 12]
    cola = informe["en_cola"]
    esperan = [str(c) for c in cola["corregidos"] + cola["nuevos"]] if informe["detenido_por"] == "tope mensual" else []
    ya = set(previo.get("cupo", [])) if previo.get("mes") == mes else set()
    pendientes = {str(c) for c in informe["pendientes"]} | set(informe["con_problemas"])
    lineas = []
    nuevos = [c for c in esperan if c not in ya]
    if nuevos:
        corregidos = [c for c in nuevos if int(c) in cola["corregidos"]]
        recientes = [c for c in nuevos if int(c) in cola["nuevos"]]
        lineas.append(f"Se acabó la parte gratuita de este mes: {len(esperan)} en cola hasta el 1 de {siguiente}."
                      + (f" Corregidos: {_lista(corregidos, por_id)}." if corregidos else "")
                      + (f" Nuevos: {_lista(recientes, por_id)}." if recientes else ""))
    atendidos = [c for c in previo.get("cupo", []) if c in por_id and c not in pendientes]
    if atendidos and not esperan:
        lineas.append(f"Ya tienen audio los {len(atendidos)} que esperaban cupo." if len(atendidos) > 1 else f"Ya tiene audio el que esperaba cupo ({_lista(atendidos, por_id)}).")
    guardas = {c: "; ".join(m)[:200] for c, m in informe["con_problemas"].items()}
    for c in sorted((c for c in guardas if previo.get("guardas", {}).get(c) != guardas[c]), key=int):
        lineas.append(f"Sin audio hasta arreglar su lectura: {_nombre(por_id[c]) if c in por_id else c} ({guardas[c]}).")
    if informe["error"] and informe["error"] != previo.get("error"):
        lineas.append(f"Falló la generación ({informe['error'][:300]}). Se reintenta en la próxima ejecución.")
    anotado = {"mes": mes, "cupo": sorted(esperan, key=int), "guardas": guardas, "error": informe["error"]}
    if not esperan and not atendidos and previo.get("mes") != mes and previo.get("cupo"):
        anotado["cupo"], anotado["mes"] = previo["cupo"], previo["mes"]  # siguen esperando por otro motivo: se dirá cuando tengan audio
    return ("Audio de los resúmenes · " + " · ".join(lineas) if lineas else ""), anotado


def generar(datos, plan, almacen, sintetiza, ahora, ids=None, maximo=None, avisar=print, notificar=None):
    """Genera el audio de los resúmenes que no lo tienen vigente y devuelve un informe.

    En el almacén quedan: `resumenes/<id>/<huella>.mp3` (el audio), `resumenes/<id>.json` (la ficha que consulta la
    página; existe solo si el audio vigente existe), `partes/<huella>.mp3` (el audio de cada parte leída, para no
    pagarla dos veces), `indice.json` (todas las fichas y los corregidos que esperan su audio), `estado/uso.json`
    (caracteres enviados a Google cada mes) y `estado/avisos.json` (lo ya avisado al editor).

    Antes de generar nada, retira la ficha y el audio de todo resumen cuyo texto publicado haya cambiado, de modo que la
    página nunca ofrece un audio que ya no corresponde. Si lo que cambia es solo la forma de leerlo (una regla, el
    léxico o la voz), el audio sigue siendo fiel al texto: se conserva y se renueva cuando haya cupo, así que un cambio
    de reglas nunca deja de golpe sin audio a muchos resúmenes. Después atiende lo que falta en este orden: los
    corregidos (y los que el plan pone en `prioridad`), los nuevos (publicados en el sitio en los últimos `dias_nuevo`
    días), el archivo antiguo y los que hay que renovar. Nunca pasa de `tope_mensual`; el archivo antiguo y las
    renovaciones, además, no tocan la `reserva_mensual`, que se libera día a día: solo usan el cupo que va sobrando.
    Lo que no cabe se queda en cola para el mes siguiente.
    Con `"automatico": false` en el plan solo se generan los resúmenes de `piloto`.
    """
    mes = ahora[:7]
    tope = int(plan.get("tope_mensual", 0))
    guardado = json.loads((almacen.leer("indice.json") or b"{}").decode("utf-8"))
    indice = guardado.get("resumenes", {})
    corregidos = guardado.get("corregidos", {})  # resúmenes cuyo audio se retiró por un cambio y aún no tienen el nuevo
    uso = json.loads((almacen.leer("estado/uso.json") or b"{}").decode("utf-8"))
    uso.setdefault(mes, 0)
    informe = {"fecha": ahora, "version": VERSION, "voz": VOZ, "automatico": bool(plan.get("automatico")), "total": len(datos), "generados": [], "recuperados": [],
               "retirados": [], "con_problemas": {}, "caracteres_ejecucion": 0, "tope_mensual": tope, "detenido_por": "", "error": "", "aviso": "", "aviso_enviado": False}

    def guardar_indice():
        cuerpo = {"version": VERSION, "voz": VOZ, "actualizado": ahora, "resumenes": dict(sorted(indice.items(), key=lambda kv: int(kv[0]))),
                  "corregidos": dict(sorted(corregidos.items(), key=lambda kv: int(kv[0])))}
        almacen.escribir("indice.json", json.dumps(cuerpo, ensure_ascii=False, indent=1).encode("utf-8"), "application/json; charset=utf-8", CACHE_FICHA)

    def limpiar(candidatas):
        """Borra del almacén las partes que ya no usa ningún audio vigente ni espera ningún corregido."""
        usadas = {k for e in indice.values() for k in e.get("partes", [])} | {k for e in corregidos.values() for k in e.get("partes", [])}
        for k in dict.fromkeys(candidatas):
            if k not in usadas:
                almacen.borrar(k)

    # 1. Qué audio le corresponde hoy a cada resumen publicado (solo a los que pasan las guardas).
    vigente, anterior, por_id = {}, {}, {}
    for r in datos:
        clave = str(int(r["id"]))
        por_id[clave] = r
        problemas = revisar(r)
        if problemas:
            informe["con_problemas"][clave] = problemas
            continue
        vigente[clave] = huella(r)
        try:
            anterior[clave] = huella_anterior(r)
        except ValueError:
            anterior[clave] = None

    # 2. Retirar lo que ya no corresponde, antes de generar nada. Un audio de antes de leer por partes sigue valiendo
    #    mientras su texto no cambie. El resumen que pierde su audio y sigue publicado es un corregido: va primero, y
    #    sus partes se conservan hasta que tenga el audio nuevo, para pagar solo la que cambió. Si el texto publicado
    #    es el mismo y solo cambió la forma de leerlo, el audio se queda y pasa a la cola de renovación.
    sueltas, renovar, anotar = [], [], False
    for clave, ficha in list(indice.items()):
        if clave in vigente and ficha.get("huella") in (vigente[clave], anterior[clave]):
            if ficha.get("texto") != fuente(por_id[clave]):  # se anota el texto al que corresponde este audio
                ficha["texto"], anotar = fuente(por_id[clave]), True
            continue
        if clave in vigente and ficha.get("texto") == fuente(por_id[clave]):
            renovar.append(clave)
            continue
        almacen.borrar(f"resumenes/{clave}.json")
        if ficha.get("audio"):
            almacen.borrar(ficha["audio"])
        del indice[clave]
        informe["retirados"].append(int(clave))
        if clave in por_id:
            corregidos[clave] = {"desde": corregidos.get(clave, {}).get("desde", ahora), "partes": list(dict.fromkeys(corregidos.get(clave, {}).get("partes", []) + ficha.get("partes", [])))}
        else:
            sueltas += ficha.get("partes", [])
    for clave in [c for c in corregidos if c not in por_id or c in indice]:
        sueltas += corregidos.pop(clave).get("partes", [])
    if informe["retirados"] or sueltas or anotar:
        limpiar(sueltas)
        guardar_indice()

    # 3. Los que faltan, en orden: corregidos, nuevos y archivo antiguo.
    permitidos = None if plan.get("automatico") else {str(int(x)) for x in plan.get("piloto", [])}
    if ids is not None:
        pedidos = {str(int(x)) for x in ids}
        permitidos = pedidos if permitidos is None else permitidos & pedidos
    momento = datetime.datetime.strptime(ahora, "%Y-%m-%dT%H:%M:%SZ")
    delante = [str(int(x)) for x in plan.get("prioridad", [])]
    desde_nuevo = (momento.date() - datetime.timedelta(days=int(plan.get("dias_nuevo", 30)))).isoformat()
    publicado = lambda c: str(por_id[c].get("fecha_publicacion_resumen") or "")  # noqa: E731

    def grupo(c):
        return 3 if c in renovar else 0 if c in corregidos or c in delante else 1 if publicado(c) >= desde_nuevo else 2

    faltan = [c for c in vigente if c not in indice]
    faltan = (sorted((c for c in faltan if grupo(c) == 0), key=lambda c: (delante.index(c) if c in delante else len(delante), corregidos.get(c, {}).get("desde", ""), int(c)))
              + sorted((c for c in faltan if grupo(c) == 1), key=lambda c: (publicado(c), int(c)), reverse=True)
              + sorted((c for c in faltan if grupo(c) == 2), key=lambda c: (str(por_id[c].get("fecha") or ""), int(c)), reverse=True))
    renovar.sort(key=lambda c: (publicado(c), int(c)), reverse=True)
    cola = [c for c in faltan + renovar if permitidos is None or c in permitidos]
    limite = int(maximo if maximo is not None else plan.get("maximo_por_ejecucion", 0)) or len(cola)
    # El archivo antiguo no toca la reserva del mes, que se va liberando con los días: al final del mes ya no reserva nada.
    dias_mes = calendar.monthrange(momento.year, momento.month)[1]
    queda = 1 - ((momento.day - 1) * 86400 + momento.hour * 3600 + momento.minute * 60 + momento.second) / (dias_mes * 86400)
    tope_archivo = max(0, tope - int(int(plan.get("reserva_mensual", 0)) * queda))

    # 4. Generar, subir y anotar, resumen por resumen (cada uno queda completo antes de pasar al siguiente).
    for clave in cola:
        if len(informe["generados"]) + len(informe["recuperados"]) >= limite:
            informe["detenido_por"] = "máximo por ejecución"
            break
        r = por_id[clave]
        destino = f"resumenes/{clave}/{vigente[clave]}.mp3"
        envios = peticiones(r)
        claves = [clave_parte(x) for x in envios]
        tam = almacen.existe(destino)
        if tam is None:
            hecha = {k: almacen.existe(k) is not None for k in dict.fromkeys(claves)}
            por_pagar = sum(len(x) for k, x in dict(zip(claves, envios)).items() if not hecha[k])
            if tope and por_pagar and uso[mes] + por_pagar > (tope if grupo(clave) < 2 else tope_archivo):
                # No se paga nunca: lo que no cabe en la parte gratuita se queda en cola para el mes siguiente.
                informe["detenido_por"] = "tope mensual" if uso[mes] + por_pagar > tope else "reserva del mes"
                break
            pagado, trozos_audio = 0, []
            try:
                for k, x in zip(claves, envios):
                    parte = almacen.leer(k) if hecha[k] else None
                    if parte is None:
                        parte = sintetiza(x)
                        segundos_mp3(parte)
                        almacen.escribir(k, parte, "audio/mpeg", CACHE_AUDIO)
                        hecha[k] = True
                        pagado += len(x)
                    trozos_audio.append(parte)
                audio = b"".join(trozos_audio)
                duracion = segundos_mp3(audio)
            except (SystemExit, ValueError) as e:
                informe["error"] = f"resumen {clave}: {e}"
            finally:
                if pagado:  # lo ya generado queda guardado y contado aunque el resumen no llegue a completarse
                    uso[mes] += pagado
                    informe["caracteres_ejecucion"] += pagado
                    almacen.escribir("estado/uso.json", json.dumps(uso, indent=1).encode("utf-8"), "application/json; charset=utf-8", CACHE_FICHA)
            if informe["error"]:
                break
            almacen.escribir(destino, audio, "audio/mpeg", CACHE_AUDIO)
            tam = len(audio)
            informe["generados"].append(int(clave))
        else:  # el audio ya estaba (se perdió su ficha): no se vuelve a pagar por él
            duracion = segundos_mp3(almacen.leer(destino))
            pagado = 0
            informe["recuperados"].append(int(clave))
        ficha = {"id": int(clave), "audio": destino, "huella": vigente[clave], "segundos": round(duracion), "bytes": tam, "voz": VOZ, "version": VERSION, "generado": ahora}
        almacen.escribir(f"resumenes/{clave}.json", json.dumps(ficha, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", CACHE_FICHA)
        viejas = corregidos.pop(clave, {}).get("partes", []) + indice.get(clave, {}).get("partes", [])
        sustituido = indice.get(clave, {}).get("audio")
        indice[clave] = dict(ficha, partes=list(dict.fromkeys(claves)), texto=fuente(r))
        if sustituido and sustituido != destino:  # un audio renovado: el anterior deja de ofrecerse al escribirse la ficha nueva
            almacen.borrar(sustituido)
        limpiar(viejas)
        guardar_indice()
        avisar(f"resumen {clave}: {round(duracion)} s, {tam} bytes, {pagado} caracteres nuevos de {sum(len(x) for x in envios)}")

    if not informe["generados"] and not informe["recuperados"] and not informe["retirados"] and not sueltas and not anotar:
        guardar_indice()
    sin_audio = [c for c in faltan if c not in indice]
    por_renovar = [c for c in renovar if indice[c].get("huella") != vigente[c]]
    informe.update({"con_audio": len(indice), "pendientes": [int(c) for c in sin_audio], "caracteres_mes": uso[mes],
                    "en_cola": {nombre: [int(c) for c in sin_audio + por_renovar if grupo(c) == n] for n, nombre in enumerate(GRUPOS)},
                    "fuera_del_piloto": 0 if permitidos is None else sum(1 for c in sin_audio if c not in permitidos)})

    # 5. Avisar al editor de lo que se queda sin audio (solo en las ejecuciones completas, y solo lo que no sabe ya).
    if ids is None and plan.get("automatico"):
        previo = json.loads((almacen.leer("estado/avisos.json") or b"{}").decode("utf-8"))
        informe["aviso"], anotado = componer_aviso(informe, por_id, previo, ahora)
        if informe["aviso"] and notificar is not None:
            informe["aviso_enviado"] = bool(notificar(informe["aviso"]))
        if anotado != previo and (not informe["aviso"] or informe["aviso_enviado"]):
            # Lo avisado se anota solo si el aviso salió: si no, se vuelve a intentar en la ejecución siguiente.
            almacen.escribir("estado/avisos.json", json.dumps(anotado, ensure_ascii=False, indent=1).encode("utf-8"), "application/json; charset=utf-8", CACHE_FICHA)
    return informe


def enviar_telegram(texto, token, chat):
    """Manda el aviso al canal de alertas del editor. Devuelve si salió; del fallo solo se muestra el código, nunca la dirección."""
    datos = urllib.parse.urlencode({"chat_id": chat, "text": texto[:3900], "disable_web_page_preview": "true"}).encode("utf-8")
    try:
        with urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=datos), timeout=60) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        print(f"No se pudo enviar el aviso por Telegram (respuesta {e.code}).")
    except Exception:  # noqa: BLE001 - cualquier otro fallo: el mensaje del error lleva la dirección, que no se muestra
        print("No se pudo enviar el aviso por Telegram (sin conexión o dirección no válida).")
    return False


def cmd_generar(args):
    nombres = ("GOOGLE_TTS_API_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
    valores = {n: os.environ.get(n, "").strip() for n in nombres}
    faltan = [n for n in nombres if not valores[n]]
    if faltan:
        print("Faltan secretos para generar el audio: " + ", ".join(faltan) + ".")
        return 1
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    ids = [int(x) for x in re.findall(r"\d+", args.ids)] if args.ids else None
    almacen = Almacen(valores["R2_ACCOUNT_ID"], valores["R2_ACCESS_KEY_ID"], valores["R2_SECRET_ACCESS_KEY"], valores["R2_BUCKET"])
    ahora = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    idioma = "-".join(VOZ.split("-")[:2])
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip(), os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    notificar = (lambda texto: enviar_telegram(texto, token, chat)) if token and chat else None
    try:
        informe = generar(resumenes(), plan, almacen, lambda x: sintetizar(x, VOZ, idioma, valores["GOOGLE_TTS_API_KEY"], True), ahora, ids, args.maximo, notificar=notificar)
    except SystemExit as e:
        # El almacén no respondió: no se pudo ni leer el estado. Se avisa (sin poder anotar que ya se avisó) y se deja constancia.
        aviso = f"Audio de los resúmenes · Falló la generación ({str(e)[:300]}). Se reintenta en la próxima ejecución."
        enviado = bool(notificar(aviso)) if notificar else False
        if args.informe:
            Path(args.informe).mkdir(parents=True, exist_ok=True)
            (Path(args.informe) / "informe.json").write_text(json.dumps({"fecha": ahora, "version": VERSION, "error": str(e)[:300], "aviso": aviso, "aviso_enviado": enviado}, ensure_ascii=False, indent=1), encoding="utf-8")
        print("ERROR ·", str(e)[:300])
        return 1
    if args.informe:
        Path(args.informe).mkdir(parents=True, exist_ok=True)
        (Path(args.informe) / "informe.json").write_text(json.dumps(informe, ensure_ascii=False, indent=1), encoding="utf-8")
    cola = informe["en_cola"]
    print(f"Audio: {informe['con_audio']} de {informe['total']} resúmenes con audio; generados ahora {len(informe['generados'])}, retirados {len(informe['retirados'])}, "
          f"pendientes {len(informe['pendientes'])} (corregidos {len(cola['corregidos'])}, nuevos {len(cola['nuevos'])}, archivo {len(cola['archivo'])}) y {len(cola['renovar'])} por renovar; "
          f"{informe['caracteres_ejecucion']} caracteres en esta ejecución y {informe['caracteres_mes']} en el mes (tope {informe['tope_mensual']})."
          + (f" Detenido por {informe['detenido_por']}: lo pendiente queda en cola." if informe["detenido_por"] else ""))
    if informe["con_problemas"]:
        print("Sin audio por no pasar las guardas: " + ", ".join(sorted(informe["con_problemas"], key=int)))
    if informe["aviso"]:
        print("Aviso al editor" + (" (enviado)" if informe["aviso_enviado"] else " (NO enviado: faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID o falló el envío)") + ": " + informe["aviso"])
    if informe["error"]:
        print("ERROR ·", informe["error"])
        return 1
    return 0


# ---------- Órdenes ----------

def cmd_texto(args):
    r = next((x for x in resumenes() if int(x["id"]) == args.id), None)
    if r is None:
        print(f"No existe el resumen {args.id}")
        return 1
    print(texto_voz(r))
    for p in revisar(r):
        print("PROBLEMA ·", p, file=sys.stderr)
    return 0


def cmd_comprobar(_args):
    datos = resumenes()
    malos = 0
    caracteres = 0
    for r in datos:
        problemas = revisar(r)
        caracteres += len(texto_voz(r))
        if problemas:
            malos += 1
            print(f"resumen {r['id']}: " + " | ".join(problemas))
    print(f"Voz: {len(datos)} resúmenes, {len(datos) - malos} listos para leerse, {malos} con problemas; {caracteres} caracteres para leer en total.")
    return 1 if malos else 0


def main():
    parser = argparse.ArgumentParser(description="Voz de los resúmenes completos")
    sub = parser.add_subparsers(dest="orden", required=True)
    p = sub.add_parser("texto")
    p.add_argument("id", type=int)
    p.set_defaults(func=cmd_texto)
    p = sub.add_parser("comprobar")
    p.set_defaults(func=cmd_comprobar)
    p = sub.add_parser("muestras")
    p.add_argument("--salida", required=True)
    p.set_defaults(func=cmd_muestras)
    p = sub.add_parser("generar")
    p.add_argument("--ids", default="")
    p.add_argument("--maximo", type=int, default=None)
    p.add_argument("--informe", default="")
    p.set_defaults(func=cmd_generar)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
