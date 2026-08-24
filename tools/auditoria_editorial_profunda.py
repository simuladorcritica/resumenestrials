#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Auditoría editorial profunda y NO destructiva de resumenes.json.

No modifica el archivo. Detecta inconsistencias internas, metadatos sospechosos,
errores ortotipográficos frecuentes y diferencias que requieren revisión humana.

Uso:
  python3 tools/auditoria_editorial_profunda.py resumenes.json --json informe_editorial.json

Salida:
  0 = sin hallazgos CRÍTICOS/ALTOS
  1 = existe al menos un hallazgo CRÍTICO/ALTO
  2 = no fue posible ejecutar la auditoría
"""

import argparse
import html
import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date
from urllib.parse import urlparse

SEVERIDAD_ORDEN = {
    "CRÍTICO": 5,
    "ALTO": 4,
    "REVISIÓN HUMANA": 3,
    "MEDIO": 2,
    "BAJO": 1,
}

DOI_RE = re.compile(r"^10\.\d{4,9}/\S+$", re.I)
REPEATED_WORD_RE = re.compile(r"\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,})\s+\1\b", re.I)
SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+[,:;.!?](?=\s|$)")
DOUBLE_PUNCT_RE = re.compile(r"([,;:.!?])\1+")
DANGEROUS_HTML_RE = re.compile(r"<(script|iframe|object|embed)\b|\bon\w+\s*=", re.I)
CONTROL_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")
PERCENT_RE = re.compile(r"(?<!\w)\d+(?:[.,]\d+)?\s*%")
EFFECT_RE = re.compile(
    r"\b(?:HR|RR|OR(?:\s+ajustad[ao])?)\s*(?:de\s*)?(?:=|:)?\s*[-−]?\d+(?:[.,]\d+)?",
    re.I,
)

TYPOS = {
    r"\btrail\b": "posible 'trail' cuando se quiso escribir 'trial'",
    r"\baleatorisad[oa]s?\b": "posible error ortográfico: 'aleatorisado/a'",
    r"\brandomisad[oa]s?\b": "posible error ortográfico: 'randomisado/a'",
    r"\bdesenlase\b": "posible error ortográfico: 'desenlase'",
    r"\bpacientess\b": "posible duplicación/error en 'paciente(s)'",
}

STYLE_VARIANTS = {
    r"\bnorepinefrina\b": "variante médica válida; revisar solo si se busca uniformidad con 'noradrenalina'",
    r"\bsignificación\b": "variante estadística válida en contexto; revisar solo si se busca uniformidad terminológica",
}

TEXT_FIELDS = ["titulo", "autor", "revista", "financiacion", "objetivo", "hallazgo", "cuerpo", "corto"]


def visible(value):
    raw = str(value or "")
    # Retirar primero las etiquetas evita que un &lt; clínico se convierta en
    # el inicio aparente de una etiqueta y oculte texto hasta el siguiente >.
    # Las etiquetas inline no deben introducir espacios antes de puntuación.
    raw = re.sub(r"</?(?:strong|em)\b[^>]*>", "", raw, flags=re.I)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = html.unescape(raw)
    return re.sub(r"\s+", " ", raw).strip()


def norm(value):
    return unicodedata.normalize("NFC", str(value or "")).strip().casefold()


def norm_key(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def valid_http_url(value):
    try:
        p = urlparse(str(value or ""))
        return p.scheme in {"http", "https"} and bool(p.netloc)
    except Exception:
        return False


def delimiters_balanced(text):
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in text:
        if ch in "([{":
            stack.append(ch)
        elif ch in ")]}":
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack


class Audit:
    def __init__(self):
        self.items = []

    def add(self, severity, idn, area, message, evidence=""):
        self.items.append({
            "severidad": severity,
            "id": idn,
            "area": area,
            "hallazgo": message,
            "evidencia": evidence[:400],
        })

    def count(self, severity):
        return sum(1 for x in self.items if x["severidad"] == severity)

    def has_blocking(self):
        return any(x["severidad"] in {"CRÍTICO", "ALTO"} for x in self.items)


def audit_entry(e, A):
    idn = e.get("id", "?")

    for field in TEXT_FIELDS:
        value = str(e.get(field, "") or "")
        if value and value != unicodedata.normalize("NFC", value):
            A.add("BAJO", idn, "codificación", f"'{field}' no está normalizado en Unicode NFC")
        if CONTROL_RE.search(value):
            A.add("ALTO", idn, "codificación", f"'{field}' contiene caracteres de control")
        if "  " in visible(value):
            A.add("BAJO", idn, "escritura", f"'{field}' contiene espacios dobles visibles")

    blob = " ".join(visible(e.get(f, "")) for f in TEXT_FIELDS)
    blob_low = blob.casefold()

    m = REPEATED_WORD_RE.search(blob)
    if m:
        A.add("MEDIO", idn, "escritura", "palabra repetida consecutivamente", m.group(0))

    if SPACE_BEFORE_PUNCT_RE.search(blob):
        A.add("BAJO", idn, "escritura", "espacio impropio antes de un signo de puntuación")
    if DOUBLE_PUNCT_RE.search(blob):
        A.add("MEDIO", idn, "escritura", "puntuación duplicada", DOUBLE_PUNCT_RE.search(blob).group(0))

    for pattern, msg in TYPOS.items():
        m = re.search(pattern, blob_low, re.I)
        if m:
            A.add("MEDIO", idn, "escritura", msg, m.group(0))

    for pattern, msg in STYLE_VARIANTS.items():
        m = re.search(pattern, blob_low, re.I)
        if m:
            A.add("BAJO", idn, "estilo", msg, m.group(0))

    for field in ("cuerpo", "corto"):
        source = str(e.get(field, "") or "")
        if DANGEROUS_HTML_RE.search(source):
            A.add("CRÍTICO", idn, "HTML", f"'{field}' contiene HTML potencialmente ejecutable")
        if not delimiters_balanced(visible(source)):
            A.add("REVISIÓN HUMANA", idn, "escritura", f"'{field}' contiene paréntesis/corchetes/llaves aparentemente desbalanceados")

    doi = str(e.get("doi", "") or "").strip()
    if doi and not DOI_RE.fullmatch(doi):
        A.add("MEDIO", idn, "metadatos", "DOI con formato no estándar", doi)

    original = str(e.get("original", "") or "").strip()
    if original and not valid_http_url(original):
        A.add("ALTO", idn, "metadatos", "URL del artículo original inválida", original)

    fecha = str(e.get("fecha", "") or "")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", fecha):
        try:
            d = date.fromisoformat(fecha)
            if d > date.today():
                A.add("REVISIÓN HUMANA", idn, "metadatos", "fecha de publicación futura respecto a la ejecución", fecha)
        except ValueError:
            A.add("ALTO", idn, "metadatos", "fecha imposible", fecha)

    title = visible(e.get("titulo", ""))
    if title:
        acronym = title.split(":", 1)[0].strip() if ":" in title else ""
        if acronym and 2 <= len(acronym) <= 35:
            body_short = f"{visible(e.get('cuerpo'))} {visible(e.get('corto'))}".casefold()
            if acronym.casefold() not in body_short:
                A.add("BAJO", idn, "consistencia", "el acrónimo del título no vuelve a aparecer en cuerpo o versión breve", acronym)

    body = visible(e.get("cuerpo", ""))
    finding = visible(e.get("hallazgo", ""))
    if finding and body:
        finding_numbers = set(PERCENT_RE.findall(finding))
        missing = [n for n in finding_numbers if n not in body]
        if missing:
            A.add("REVISIÓN HUMANA", idn, "consistencia numérica", "porcentajes del hallazgo no se localizaron literalmente en el cuerpo largo", ", ".join(missing))

        effects = [re.sub(r"\s+", " ", x.group(0)).strip() for x in EFFECT_RE.finditer(finding)]
        missing_eff = []
        for effect in effects:
            number = re.search(r"[-−]?\d+(?:[.,]\d+)?", effect)
            if not number:
                continue
            variants = {number.group(0), number.group(0).replace(",", "."), number.group(0).replace(".", ",")}
            if not any(value in body for value in variants):
                missing_eff.append(effect)
        if missing_eff:
            A.add("REVISIÓN HUMANA", idn, "consistencia estadística", "medida de efecto del hallazgo no se localizó literalmente en el cuerpo largo", " | ".join(missing_eff))

    short = visible(e.get("corto", ""))
    if short and body:
        if len(short) > len(body) * 0.85:
            A.add("MEDIO", idn, "versión breve", "la versión breve es casi tan larga como el cuerpo principal")

    if e.get("especialidad_principal") == "Medicina Interna":
        temas = " ".join(e.get("temas") or []) if isinstance(e.get("temas"), list) else ""
        if not temas.strip():
            A.add("MEDIO", idn, "clasificación", "artículo de Medicina Interna sin temas para apoyar la subespecialidad")


def audit_set(data, A):
    ids = defaultdict(list)
    dois = defaultdict(list)
    titles = defaultdict(list)
    originals = defaultdict(list)
    journals = defaultdict(set)

    for e in data:
        idn = e.get("id", "?")
        ids[e.get("id")].append(idn)
        if str(e.get("doi", "")).strip():
            dois[norm(e.get("doi"))].append(idn)
        if visible(e.get("titulo")):
            titles[norm_key(visible(e.get("titulo")))].append(idn)
        if str(e.get("original", "")).strip():
            originals[norm(e.get("original"))].append(idn)
        journal_key = norm_key(e.get("revista"))
        if journal_key:
            journals[journal_key].add(str(e.get("revista", "")).strip())

    for key, values in ids.items():
        if key is not None and len(values) > 1:
            A.add("CRÍTICO", "-", "integridad", "ID duplicado", str(key))
    for key, values in dois.items():
        if len(values) > 1:
            A.add("ALTO", ",".join(map(str, values)), "integridad", "DOI duplicado", key)
    for key, values in titles.items():
        if key and len(values) > 1:
            A.add("ALTO", ",".join(map(str, values)), "integridad", "título duplicado tras normalización", key)
    for key, values in originals.items():
        if len(values) > 1:
            A.add("REVISIÓN HUMANA", ",".join(map(str, values)), "integridad", "varios resúmenes apuntan a la misma URL original", key)
    for key, variants in journals.items():
        if len(variants) > 1:
            A.add("MEDIO", "-", "revista", "nombre de revista inconsistente para la misma variante normalizada", " | ".join(sorted(variants)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("archivo", nargs="?", default="resumenes.json")
    parser.add_argument("--json", dest="json_out")
    args = parser.parse_args()

    try:
        with open(args.archivo, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        print(f"ERROR: no fue posible leer {args.archivo}: {exc}", file=sys.stderr)
        return 2

    if not isinstance(data, list):
        print("ERROR: la raíz de resumenes.json debe ser una lista", file=sys.stderr)
        return 2

    A = Audit()
    for e in data:
        if isinstance(e, dict):
            audit_entry(e, A)
        else:
            A.add("CRÍTICO", "-", "integridad", "entrada del JSON que no es objeto/diccionario", repr(e)[:200])
    audit_set([e for e in data if isinstance(e, dict)], A)

    A.items.sort(key=lambda x: (-SEVERIDAD_ORDEN.get(x["severidad"], 0), str(x["id"]), x["area"]))
    summary = {sev: A.count(sev) for sev in SEVERIDAD_ORDEN}
    report = {
        "articulos_revisados": len(data),
        "resumen": summary,
        "hallazgos": A.items,
        "nota": "Auditoría no destructiva. Los hallazgos de REVISIÓN HUMANA no deben considerarse errores confirmados sin verificar la fuente primaria.",
    }

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    print("=" * 72)
    print("AUDITORÍA EDITORIAL PROFUNDA — RESÚMENES TRIALS")
    print(f"Artículos revisados: {len(data)}")
    print(" | ".join(f"{k}: {v}" for k, v in summary.items()))
    print("=" * 72)
    if not A.items:
        print("Sin hallazgos automáticos.")
    else:
        for x in A.items:
            evidence = f" — {x['evidencia']}" if x["evidencia"] else ""
            print(f"[{x['severidad']}] id {x['id']} · {x['area']}: {x['hallazgo']}{evidence}")

    print("\nEsta auditoría NO modificó resumenes.json ni ningún resumen.")
    return 1 if A.has_blocking() else 0


if __name__ == "__main__":
    raise SystemExit(main())
