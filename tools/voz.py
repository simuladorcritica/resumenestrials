#!/usr/bin/env python3
"""Voz de los resúmenes completos.

Convierte el texto PUBLICADO de un resumen completo en texto para leer en voz alta y genera muestras de voz con
Google Cloud Text-to-Speech. Solo cambia CÓMO SE LEE: desarrolla símbolos, unidades y abreviaturas estadísticas.
Nunca cambia una cifra ni quita una palabra; `revisar()` lo comprueba y, si un resumen no pasa, no se le genera audio.

Se lee el título, la revista, la fecha y todas las secciones del resumen completo menos «Referencia y registro»
(decisión del editor, 16-nov-2026). El resumen breve no lleva voz.

Órdenes:
  python tools/voz.py texto ID              imprime lo que se leerá del resumen ID
  python tools/voz.py comprobar             pasa las guardas a todos los resúmenes (sale con 1 si alguno falla)
  python tools/voz.py muestras --salida D   genera las muestras de tools/voz_muestras.json en la carpeta D
                                            (necesita la variable de entorno GOOGLE_TTS_API_KEY; nunca se imprime)
"""
import argparse
import base64
import html
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = 2  # Sube cuando cambien las reglas de lectura o el léxico: el audio ya generado deja de valer.
LEX = json.loads((ROOT / "tools" / "voz_lexico.json").read_text(encoding="utf-8"))
SIN_VOZ = {"Referencia y registro"}
LIMITE_BYTES = 4500  # La API admite 5000 bytes de texto por petición.
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
_LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ"
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


def decir_nombres(t):
    """Nombres de ensayos escritos como se dicen. Solo cambia mayúsculas por minúsculas (o lo que fije el léxico)."""
    global _RE_NOMBRES
    nombres = nombres_ensayos()
    if _RE_NOMBRES is None:
        _RE_NOMBRES = re.compile(r"(?<![" + _LETRA + r"0-9])(" + "|".join(sorted(map(re.escape, nombres), key=len, reverse=True)) + r")(?![" + _LETRA + r"0-9])")
    return _RE_NOMBRES.sub(lambda m: nombres[m.group(1)], t)


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


def leer(t):
    """Texto para leer en voz alta. No añade, quita ni cambia cifras ni palabras del texto publicado."""
    t = decir_nombres(canonico(t))
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
    return t.strip()


def revista_hablada(r):
    return LEX["revistas"].get(str(r.get("revista") or "").strip(), str(r.get("revista") or "").strip())


def bloques(r):
    """Lo que se lee, por párrafos y en orden: presentación, cada sección con su título y cierre."""
    fecha = fecha_hablada(r.get("fecha"))
    presentacion = "Resúmenes Trials. " + leer(str(r["titulo"]).strip()).rstrip(".") + "."
    revista = revista_hablada(r)
    if revista:
        presentacion += f" Publicado en {revista}" + (f", el {fecha}." if fecha else ".")
    out = [presentacion]
    for titulo, parrafos in secciones(r):
        out.append(leer(titulo).rstrip(".") + ".")
        out.extend(leer(p) for p in parrafos)
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


# ---------- Guardas ----------

_PERMITIDO = re.compile(r"[^" + _LETRA + r"À-ÖØ-öø-ž0-9ªº \n.,;:()¿?¡!%«»\"'’“”-]")
_OMITIBLES = {k for k in _UNI if re.fullmatch(r"[a-záéíóúñ]{4,}", k)}


def _cifras(t):
    return re.findall(_NUM, t)


def _palabras(t):
    return re.findall(r"[a-záéíóúüñ]{4,}", t)


def revisar(r):
    """Problemas que impiden generar la voz de un resumen (lista vacía = se puede leer)."""
    problemas = []
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
    return problemas


def resumenes():
    return json.loads((ROOT / "resumenes.json").read_text(encoding="utf-8"))


# ---------- Google Cloud Text-to-Speech ----------

API = "https://texttospeech.googleapis.com/v1"


def _api(ruta, clave, cuerpo=None):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    req = urllib.request.Request(API + ruta, data=datos, headers={"X-Goog-Api-Key": clave, "Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            detalle = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", "")
        except (ValueError, OSError):
            detalle = ""
        raise SystemExit(f"Google Cloud respondió {e.code} en {ruta.split('?')[0]}: {detalle[:300]}") from None
    except urllib.error.URLError as e:
        raise SystemExit(f"No se pudo conectar con Google Cloud: {e.reason}") from None


def sintetizar(texto, voz, idioma, clave):
    """MP3 de un texto (ya dentro del límite de bytes)."""
    cuerpo = {"input": {"text": texto}, "voice": {"languageCode": idioma, "name": voz}, "audioConfig": {"audioEncoding": "MP3"}}
    return base64.b64decode(_api("/text:synthesize", clave, cuerpo)["audioContent"])


def fragmento(r, seccion, caracteres, presentacion=False):
    """Los primeros párrafos de una sección, hasta `caracteres`, cortados en fin de oración."""
    parrafos = next((p for t, p in secciones(r) if t == seccion), None)
    if not parrafos:
        raise SystemExit(f"El resumen {r['id']} no tiene la sección «{seccion}»")
    texto = " ".join(leer(p) for p in parrafos)
    if len(texto) > caracteres:
        corte = next((c for c in (texto.rfind(marca, 0, caracteres) for marca in (". ", "; ", ", ", " ")) if c >= caracteres * 0.7), caracteres)
        texto = texto[:corte].rstrip(" ,;.") + "."
    return (bloques(r)[0] + "\n\n" if presentacion else "") + leer(seccion) + ".\n\n" + texto


def variantes(texto, muestra):
    """[(etiqueta, texto)]: el texto tal como lo deja `leer` y, si el plan las pide, variantes de prueba con otra
    forma de escribir algo (solo para comparar de oído en las muestras; no afectan a los resúmenes)."""
    out = [("", texto)]
    for v in muestra.get("variantes", []):
        cambiado = texto
        for a, b in v["cambios"].items():
            cambiado = cambiado.replace(a, b)
        if cambiado != texto:
            out.append((re.sub(r"[^a-z0-9-]", "", str(v["etiqueta"]).lower()), cambiado))
    return out


def elegir_voces(plan, disponibles):
    """[(familia, género, voz)] según el plan: primero las preferidas que existan y después por orden alfabético."""
    elegidas = []
    for familia in plan["familias"]:
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
            base = fragmento(r, muestra["seccion"], int(muestra["caracteres"]), bool(muestra.get("presentacion")))
            for etiqueta, texto in variantes(base, muestra):
                audio = b"".join(sintetizar(x, voz, idioma, clave) for x in trozos(texto.split("\n\n")))
                nombre = f"{numero:02d}_{familia}_{'mujer' if genero == 'FEMALE' else 'hombre'}_{voz.split('-')[-1]}_resumen{r['id']}{'_' + etiqueta if etiqueta else ''}.mp3"
                (salida / nombre).write_bytes(audio)
                total += len(texto)
                indice.append({"archivo": nombre, "voz": voz, "familia": familia, "genero": genero, "resumen": r["id"], "seccion": muestra["seccion"], "variante": etiqueta, "caracteres": len(texto), "bytes": len(audio), "texto": texto})
                print(f"{nombre}: {len(texto)} caracteres, {len(audio)} bytes")
    (salida / "indice.json").write_text(json.dumps({"version": VERSION, "caracteres": total, "muestras": indice}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Muestras: {len(indice)} archivos, {total} caracteres en total.")
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
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
