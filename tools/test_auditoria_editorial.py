#!/usr/bin/env python3
"""Transparencia editorial: aviso «Resumen en revisión», fe de erratas y página /correcciones/.

auditoria-editorial.json es una fuente opcional que regeneran las rutinas locales. Si falta,
no es válida o un ID no aparece, el resumen se publica sin aviso ni fe de erratas. Ningún
valor del archivo se inserta sin escapar."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import site_templates as t  # noqa: E402

BASE = {
    "schema_version": 1,
    "actualizado": "2026-11-08",
    "estandar": "noviembre de 2026",
    "archivo": {"total": 4, "auditados": 2, "sin_auditar": 2},
    "en_revision": [8, 9, 7],
    "sin_auditar": [8, 9],
    "con_errores_abiertos": [7, 9],
    "errores_abiertos": {"CRÍTICO": 1, "MAYOR": 2, "MENOR": 3},
    "correcciones": [
        {"id": 5, "fecha": "2026-11-04", "pr": 1, "campos": ["cuerpo"], "errores": {}, "texto": "Primera corrección."},
        {"id": 5, "fecha": "2026-11-05", "pr": 2, "campos": ["cuerpo"], "errores": {}, "texto": "Segunda <b>corrección</b> & más."},
        {"id": 6, "fecha": "2026-11-05", "pr": 2, "campos": ["corto"], "errores": {}, "texto": "Otra."},
    ],
}


def parsed(**changes):
    data = json.loads(json.dumps(BASE))
    data.update(changes)
    return t.parse_audit(data)


class AvisoEnRevision(unittest.TestCase):
    def test_sin_auditar_muestra_el_estandar_y_el_enlace(self):
        html = t.audit_notice(8, parsed())
        self.assertIn('data-ev-audit="revision"', html)
        self.assertIn("<strong>Resumen en revisión:</strong> lo estamos auditando con nuestro estándar editorial de noviembre de 2026. "
                      "Si encontramos algún error, lo corregiremos y lo indicaremos en esta página.", html)
        self.assertIn('<a href="/correcciones/">Política de correcciones</a>', html)

    def test_errores_abiertos_tiene_precedencia(self):
        for trial in (7, 9, "9"):
            html = t.audit_notice(trial, parsed())
            self.assertIn('data-ev-audit="errores"', html)
            self.assertIn("nuestro equipo de verificación encontró datos que estamos corrigiendo.", html)
            self.assertNotIn("lo estamos auditando", html)

    def test_resumen_auditado_o_ausente_no_muestra_aviso(self):
        self.assertEqual(t.audit_notice(5, parsed()), "")
        self.assertEqual(t.audit_notice(999, parsed()), "")

    def test_estandar_se_escapa(self):
        html = t.audit_notice(8, parsed(estandar='<script>alert(1)</script>'))
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)


class FeDeErratas(unittest.TestCase):
    def test_lineas_mas_recientes_primero_y_escapadas(self):
        html = t.audit_errata(5, parsed())
        self.assertIn('<h2 id="ev-errata-title">Fe de erratas</h2>', html)
        first = html.index("Corregido el <time datetime=\"2026-11-05\">5 de noviembre de 2026</time>. Segunda &lt;b&gt;corrección&lt;/b&gt; &amp; más.")
        second = html.index("Corregido el <time datetime=\"2026-11-04\">4 de noviembre de 2026</time>. Primera corrección.")
        self.assertLess(first, second)
        self.assertEqual(html.count("<li>"), 2)
        self.assertIn('<a href="/correcciones/">Política de correcciones</a>', html)

    def test_sin_correcciones_no_hay_bloque(self):
        self.assertEqual(t.audit_errata(8, parsed()), "")

    def test_entradas_invalidas_se_ignoran(self):
        data = parsed(correcciones=[
            {"id": 5, "fecha": "2026-02-30", "texto": "Fecha imposible."},
            {"id": True, "fecha": "2026-11-05", "texto": "ID booleano."},
            {"id": 5, "fecha": "2026-11-05", "texto": ["no es texto"]},
            {"id": 5, "fecha": "5 de noviembre", "texto": "Fecha no ISO."},
            "no es un objeto",
            {"id": "5", "fecha": "2026-11-06", "texto": "  Válida   con espacios. "},
        ])
        html = t.audit_errata(5, data)
        self.assertEqual(html.count("<li>"), 1)
        self.assertIn("Válida con espacios.", html)


class ArchivoTolerante(unittest.TestCase):
    def test_archivo_ausente_o_invalido(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "no-existe.json"
            self.assertIsNone(t.load_audit(missing))
            broken = Path(tmp) / "roto.json"
            broken.write_text("{no es json", encoding="utf-8")
            self.assertIsNone(t.load_audit(broken))
        for data in (None, [], "texto", {"schema_version": 2}, {"schema_version": "1"}):
            self.assertIsNone(t.parse_audit(data))
        self.assertEqual(t.audit_notice(8, None), "")
        self.assertEqual(t.audit_errata(5, None), "")

    def test_tipos_inesperados_no_rompen(self):
        data = t.parse_audit({"schema_version": 1, "sin_auditar": "8", "con_errores_abiertos": {"7": 1},
                              "archivo": [], "errores_abiertos": "muchos", "correcciones": {"id": 5}})
        self.assertEqual(t.audit_notice(8, data), "")
        self.assertEqual(t.audit_notice(7, data), "")
        self.assertEqual(t.audit_errata(5, data), "")
        page = t.corrections_page([], {}, data)
        self.assertIn("Todavía no hay correcciones publicadas.", page)
        self.assertNotIn("Resúmenes auditados", page)
        self.assertNotIn("por gravedad", page)


class PaginaCorrecciones(unittest.TestCase):
    ITEMS = [{"id": 5, "titulo": "MARCH: carbocisteína"}, {"id": 6, "titulo": "Ensayo <seis>"}]
    MANIFEST = {"5": {"path": "/trials/march/"}, "6": {"path": "/trials/seis/"}}

    def test_cifras_y_lista_completa(self):
        page = t.corrections_page(self.ITEMS, self.MANIFEST, parsed())
        self.assertIn("<h1>Correcciones</h1>", page)
        self.assertIn("Última actualización: 8 de noviembre de 2026", page)
        self.assertIn("<dd>2 de 4</dd>", page)
        self.assertIn("<dt>Resúmenes en revisión</dt><dd>3</dd>", page)
        for label, value in (("Críticos", 1), ("Mayores", 2), ("Menores", 3)):
            self.assertIn(f"<dt>{label}</dt><dd>{value}</dd>", page)
        self.assertIn("3 correcciones publicadas", page)
        self.assertIn('<a href="/trials/march/">MARCH: carbocisteína</a>', page)
        self.assertIn('<a href="/trials/seis/">Ensayo &lt;seis&gt;</a>', page)
        self.assertLess(page.index("Segunda"), page.index("Primera"))
        # Solo el número de resúmenes en revisión, nunca la lista de IDs.
        self.assertNotIn("data-ev-audit", page)
        self.assertIn("Editorial EMEICRÍTICA", page)

    def test_sin_archivo_publica_la_politica(self):
        page = t.corrections_page(self.ITEMS, self.MANIFEST, None)
        self.assertIn("Corregimos un resumen en cuanto confirmamos un error.", page)
        self.assertIn("Todavía no hay correcciones publicadas.", page)
        self.assertNotIn("Estado de la revisión", page)

    def test_id_sin_resumen_no_genera_enlace_roto(self):
        data = parsed(correcciones=[{"id": 4040, "fecha": "2026-11-05", "texto": "Huérfana."}])
        page = t.corrections_page(self.ITEMS, self.MANIFEST, data)
        self.assertIn("<span>Resumen N.º 4040</span>", page)
        self.assertNotIn('href="None"', page)


class LectorEstatico(unittest.TestCase):
    def test_el_aviso_y_la_fe_de_erratas_quedan_fuera_del_cuerpo_clinico(self):
        item = json.loads((ROOT / "resumenes.json").read_text(encoding="utf-8"))[0]
        manifest = json.loads((ROOT / "seo-manifest.json").read_text(encoding="utf-8"))
        original = t.audit
        try:
            data = t.parse_audit({**BASE, "sin_auditar": [item["id"]], "con_errores_abiertos": [],
                                  "correcciones": [{"id": item["id"], "fecha": "2026-11-05", "texto": "Ejemplo."}]})
            t.audit = lambda: data
            html = t.reading(item, manifest)
            legacy = t.reading(item, manifest, brief=True, legacy=True)
        finally:
            t.audit = original
        for page in (html, legacy):
            head = page.index('<header class="ev-reading-head">')
            self.assertLess(head, page.index('class="ev-audit"'), "el aviso va al inicio, en la cabecera del resumen")
            self.assertLess(page.index('class="ev-audit"'), page.index("</header>"))
            body_end = page.index("</article>")
            self.assertLess(body_end, page.index('class="ev-errata"'), "la fe de erratas va después del cuerpo")
            self.assertEqual(page.count("<article"), 1)
        clinical = html[html.index('<article class="articulo">'):html.index("</article>")]
        self.assertNotIn("ev-audit", clinical)
        self.assertNotIn("ev-errata", clinical)


if __name__ == "__main__":
    unittest.main()
