#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Revisión editorial automática de resumenes.json — Resumenes Trials.

Comprueba, entrada por entrada, que cada resumen respete el formato de la casa
(plantillas prompt_ECA_largo_v11 y prompt_ECA_mediano_bot_v3) y que no haya
errores que rompan la página o las descargas de PDF.

Uso:
    python3 validar_resumenes.py [ruta_al_json]        # por defecto: resumenes.json
    python3 validar_resumenes.py --json out.json       # además vuelca informe JSON

Código de salida: 0 si no hay ERRORES; 1 si hay al menos un ERROR.
Las ADVERTENCIAS nunca cambian el código de salida (son para tu criterio).
"""

import sys, os, re, json, unicodedata, argparse
from datetime import date

# ----------------------------------------------------------------------------
# Canon del esquema y de las secciones (derivado del archivo en vivo + plantillas)
# ----------------------------------------------------------------------------
CAMPOS = [
    "id", "titulo", "autor", "revista", "anio", "fecha", "registro", "doi",
    "financiacion", "original", "especialidad_principal",
    "especialidad_secundaria", "temas", "tipo_estudio",
    "objetivo", "hallazgo", "cuerpo", "corto",
]

SECCIONES_CUERPO = [
    "Referencia y registro",
    "Pregunta de investigación",
    "Diseño metodológico",
    "Población estudiada",
    "Desenlaces",
    "Resultados",
    "Evaluación crítica del riesgo de sesgo",
    "Cálculos derivados del artículo",   # opcional: se omite si no aporta
    "Conclusión",
]
CUERPO_OPCIONAL = {"Cálculos derivados del artículo"}

SECCIONES_CORTO = [
    "Objetivo", "Población e intervención", "Diseño", "Resultados",
    "Seguridad", "Conclusión", "Aplicación clínica",
]

ESPECIALIDADES = {"Medicina Crítica", "Medicina Interna", ""}
TAGS_PERMITIDAS = {"h2", "p", "strong"}

# Factor de impacto de referencia (JCR Clarivate). Se comprueba consistencia
# por revista y se avisa si aparece un valor distinto para la misma revista.
IF_REFERENCIA = {
    "NEJM": "84.5",
    "Intensive Care Med": "21.2",
    "Critical Care": "11.4",
    "Lancet Respir Med": "32.8",
}

EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF"
    "\U0001F900-\U0001F9FF\U00002B00-\U00002BFF\U0000FE00-\U0000FE0F]",
    flags=re.UNICODE,
)

# ----------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------
def strip_html(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()

def h2_titulos(html: str):
    return [
        re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", x)).strip()
        for x in re.findall(r"<h2[^>]*>(.*?)</h2>", html or "", flags=re.I | re.S)
    ]

def norm(s: str) -> str:
    return unicodedata.normalize("NFC", (s or "").strip()).lower()

def run_comun_mas_largo(a: str, b: str):
    """Fragmento contiguo (a nivel de palabra) más largo compartido: la frase ancla."""
    A, B = a.split(), b.split()
    if not A or not B:
        return 0, ""
    best, bi = 0, 0
    prev = [0] * (len(B) + 1)
    for i in range(1, len(A) + 1):
        cur = [0] * (len(B) + 1)
        ai = A[i - 1].lower()
        for j in range(1, len(B) + 1):
            if ai == B[j - 1].lower():
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best, bi = cur[j], i
        prev = cur
    return best, " ".join(A[bi - best:bi])

def es_lista_ordenada_valida(got, canon, opcionales):
    """got debe ser una subsecuencia de canon que respete el orden y conserve
    todas las secciones no opcionales."""
    gi = 0
    for sec in canon:
        if gi < len(got) and norm(got[gi]) == norm(sec):
            gi += 1
        elif sec not in opcionales:
            return False
    return gi == len(got)

# ----------------------------------------------------------------------------
# Validación de una entrada
# ----------------------------------------------------------------------------
class Hallazgos:
    def __init__(self):
        self.errores = []
        self.avisos = []
    def error(self, idn, msg): self.errores.append((idn, msg))
    def aviso(self, idn, msg): self.avisos.append((idn, msg))

def validar_entrada(e, H, if_vistos):
    idn = e.get("id", "?")

    # --- Esquema: campos exactos y en orden ---
    claves = list(e.keys())
    if claves != CAMPOS:
        faltan = [c for c in CAMPOS if c not in claves]
        sobran = [c for c in claves if c not in CAMPOS]
        if faltan: H.error(idn, f"faltan campos: {faltan}")
        if sobran: H.error(idn, f"campos no esperados: {sobran}")
        if not faltan and not sobran:
            H.error(idn, f"orden de campos incorrecto: {claves}")

    # --- Tipos y coherencia de fechas ---
    if not isinstance(e.get("anio"), int):
        H.error(idn, f"'anio' no es entero: {e.get('anio')!r}")
    f = e.get("fecha", "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", f or ""):
        H.error(idn, f"'fecha' no tiene formato AAAA-MM-DD: {f!r}")
    else:
        try:
            y, m, dd = map(int, f.split("-"))
            date(y, m, dd)
            if isinstance(e.get("anio"), int) and e["anio"] != y:
                H.error(idn, f"'anio' ({e['anio']}) no coincide con el año de 'fecha' ({y})")
        except ValueError:
            H.error(idn, f"'fecha' no es una fecha válida: {f!r}")

    # --- Campos obligatorios no vacíos ---
    for c in ("titulo", "autor", "revista", "doi", "original", "objetivo",
              "hallazgo", "cuerpo", "corto", "especialidad_principal"):
        if not str(e.get(c, "")).strip():
            H.error(idn, f"campo obligatorio vacío: '{c}'")
    if not str(e.get("registro", "")).strip():
        H.aviso(idn, "'registro' vacío (¿ensayo sin NCT?)")

    # --- Especialidad ---
    if e.get("especialidad_principal") not in ESPECIALIDADES:
        H.error(idn, f"especialidad_principal fuera de catálogo: {e.get('especialidad_principal')!r}")
    if e.get("especialidad_secundaria") not in ESPECIALIDADES:
        H.aviso(idn, f"especialidad_secundaria fuera de catálogo: {e.get('especialidad_secundaria')!r}")

    # --- DOI ---
    doi = str(e.get("doi", ""))
    if doi and (" " in doi or not doi.lower().startswith("10.")):
        H.aviso(idn, f"'doi' con forma inusual: {doi!r}")

    # --- Título: ACRÓNIMO: descripción en minúsculas ---
    tit = str(e.get("titulo", ""))
    m = re.match(r"^([^:]+):\s+(.+)$", tit)
    if not m:
        H.aviso(idn, f"'titulo' no sigue 'ACRÓNIMO: descripción': {tit!r}")
    else:
        desc = m.group(2)
        primera = desc.lstrip()[:1]
        if primera and primera.isupper():
            H.aviso(idn, f"descripción del título empieza en mayúscula: “…: {desc[:40]}…”")

    # --- Secciones del cuerpo (títulos exactos y en orden; sección 8 opcional) ---
    ct = h2_titulos(e.get("cuerpo", ""))
    if not es_lista_ordenada_valida(ct, SECCIONES_CUERPO, CUERPO_OPCIONAL):
        # detalle: ¿algún título mal escrito?
        malos = [t for t in ct if all(norm(t) != norm(s) for s in SECCIONES_CUERPO)]
        if malos:
            H.error(idn, f"cuerpo: títulos de sección no canónicos: {malos}")
        else:
            H.error(idn, f"cuerpo: secciones incompletas o desordenadas: {ct}")

    # --- Secciones del corto (7 exactas, en orden) ---
    st = h2_titulos(e.get("corto", ""))
    if [norm(x) for x in st] != [norm(x) for x in SECCIONES_CORTO]:
        H.error(idn, f"corto: secciones deben ser {SECCIONES_CORTO}, hay {st}")

    # --- Longitud del corto (250–300 objetivo, tope 350) ---
    palabras = len(strip_html(e.get("corto", "")).split())
    if palabras > 350:
        H.error(idn, f"corto excede el tope de 350 palabras ({palabras})")
    elif palabras < 250:
        H.aviso(idn, f"corto por debajo de 250 palabras ({palabras})")

    # --- Frase ancla: fragmento contiguo compartido corto <-> cuerpo ---
    n_ancla, frag = run_comun_mas_largo(
        strip_html(e.get("corto", "")), strip_html(e.get("cuerpo", "")))
    if n_ancla < 8:
        H.error(idn, f"frase ancla ausente o no idéntica (fragmento común de solo {n_ancla} palabras)")

    # --- Reglas de estilo y léxico sobre el texto visible ---
    campos_texto = {c: e.get(c, "") for c in ("objetivo", "hallazgo", "cuerpo", "corto")}
    blob = " ".join(campos_texto.values())
    low = blob.lower()

    if re.search(r"\bsignificaci[oó]n\b", low):
        H.error(idn, 'usa "significación" (debe ser "significancia")')
    if "norepinefrina" in low:
        H.error(idn, 'usa "norepinefrina" (debe ser "noradrenalina")')
    if "citescore" in low:
        H.error(idn, 'menciona "CiteScore" (usar solo JIF de Clarivate/JCR)')
    if EMOJI.search(blob):
        H.error(idn, "contiene emoji o icono")
    for c, s in campos_texto.items():
        if re.search(r"\s—\s", s):
            H.aviso(idn, f'guion largo usado como conector en "{c}"')
            break
    mref = re.search(r"\b(tabla|figura|ap[eé]ndice|suplement\w*|anexo)\s*(s?\d|\d)", low)
    if mref:
        H.error(idn, f'referencia a la mecánica del documento: "{mref.group(0)}"')

    # --- HTML: etiquetas permitidas y '<' sin escapar (rompe render/PDF) ---
    for c in ("cuerpo", "corto"):
        s = e.get(c, "")
        # Etiquetas HTML reales (empiezan con letra) fuera del set preferido -> aviso
        for tag in re.findall(r"</?([A-Za-z]\w*)", s):
            if tag.lower() not in TAGS_PERMITIDAS:
                H.aviso(idn, f'{c}: etiqueta fuera de <h2>/<p>/<strong>: <{tag}>')
        # '<' seguido de algo que no es letra, '/' ni '!' -> signo matemático sin escapar.
        # Nota: los navegadores modernos y jsPDF lo toleran (se ve bien y el PDF conserva
        # el texto), pero es HTML inválido y rompe cualquier extracción por regex
        # (newsletter, RSS, SEO). Conviene escribir &lt; o "menor de".
        for mm in re.finditer(r"<(?![/!A-Za-z])", s):
            ctx = re.sub(r"\s+", " ", s[max(0, mm.start() - 18):mm.start() + 12])
            H.aviso(idn, f'{c}: "<" sin escapar (HTML inválido; usa &lt; o "menor de"): …{ctx}…')

    # --- Factor de impacto: consistencia por revista ---
    for v in re.findall(r"factor de impacto de ([\d.]+)", e.get("cuerpo", "")):
        rev = e.get("revista", "")
        if_vistos.setdefault(rev, set()).add(v)
        ref = IF_REFERENCIA.get(rev)
        if ref and v != ref:
            H.aviso(idn, f'factor de impacto {v} para {rev} distinto del de referencia ({ref})')
        if "journal citation reports" not in e.get("cuerpo", "").lower():
            H.aviso(idn, "menciona factor de impacto sin citar el Journal Citation Reports de Clarivate")

# ----------------------------------------------------------------------------
# Validación del conjunto
# ----------------------------------------------------------------------------
def validar(data):
    H = Hallazgos()
    if not isinstance(data, list):
        H.error("-", "el archivo raíz no es una lista JSON")
        return H, {}
    ids = [e.get("id") for e in data]
    if len(ids) != len(set(ids)):
        vistos, dup = set(), set()
        for i in ids:
            (dup if i in vistos else vistos).add(i)
        H.error("-", f"IDs duplicados: {sorted(dup)}")
    enteros = [i for i in ids if isinstance(i, int)]
    if enteros:
        faltan = sorted(set(range(1, max(enteros) + 1)) - set(enteros))
        if faltan:
            H.aviso("-", f"huecos en la secuencia de IDs: {faltan}")
    if_vistos = {}
    for e in sorted(data, key=lambda x: x.get("id", 0)):
        validar_entrada(e, H, if_vistos)
    for rev, vs in if_vistos.items():
        if len(vs) > 1:
            H.error("-", f"factor de impacto inconsistente para {rev}: {sorted(vs)}")
    return H, if_vistos

# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Revisión editorial de resumenes.json")
    ap.add_argument("ruta", nargs="?", default="resumenes.json")
    ap.add_argument("--json", dest="salida_json", default=None,
                    help="ruta para volcar el informe en JSON")
    args = ap.parse_args()

    if not os.path.exists(args.ruta):
        print(f"No existe el archivo: {args.ruta}", file=sys.stderr)
        sys.exit(2)
    try:
        data = json.load(open(args.ruta, encoding="utf-8"))
    except json.JSONDecodeError as ex:
        print(f"ERROR: JSON malformado ({ex})", file=sys.stderr)
        sys.exit(1)

    H, _ = validar(data)

    print("=" * 64)
    print(f"  Revisión editorial — {args.ruta}")
    print(f"  Entradas: {len(data)}  |  Errores: {len(H.errores)}  |  Avisos: {len(H.avisos)}")
    print("=" * 64)
    if H.errores:
        print("\nERRORES (rompen el formato o la página/PDF — hay que corregir):")
        for idn, m in H.errores:
            print(f"  [id {idn}] {m}")
    if H.avisos:
        print("\nAVISOS (a tu criterio):")
        for idn, m in H.avisos:
            print(f"  [id {idn}] {m}")
    if not H.errores and not H.avisos:
        print("\nTodo en orden. Ningún problema detectado.")

    if args.salida_json:
        informe = {
            "archivo": args.ruta,
            "entradas": len(data),
            "errores": [{"id": i, "mensaje": m} for i, m in H.errores],
            "avisos": [{"id": i, "mensaje": m} for i, m in H.avisos],
        }
        json.dump(informe, open(args.salida_json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)

    sys.exit(1 if H.errores else 0)

if __name__ == "__main__":
    main()
