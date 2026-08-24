#!/usr/bin/env python3
import unittest

from auditoria_editorial_profunda import Audit, audit_entry, visible


class AuditoriaEditorialRegressionTests(unittest.TestCase):
    def test_html_entities_inline_markup_and_decimal_effects_do_not_raise_false_positives(self):
        entry = {
            "id": 1,
            "titulo": "TEST: comparación segura",
            "hallazgo": "Los pacientes tuvieron RR 1.18 sin diferencia concluyente.",
            "cuerpo": (
                "<h2>Resultados</h2><p>Los pacientes tuvieron RR 1.18 "
                "(IC 95%, 0.90 a 1.40) y un valor &lt;1; "
                "el resultado fue <strong>no concluyente</strong>.</p>"
            ),
            "corto": "<p>Los pacientes tuvieron RR 1.18 (IC 95%, 0.90 a 1.40).</p>",
        }
        audit = Audit()
        audit_entry(entry, audit)
        messages = "\n".join(item["hallazgo"] for item in audit.items)
        self.assertNotIn("paciente(s)", messages)
        self.assertNotIn("espacio impropio", messages)
        self.assertNotIn("desbalanceados", messages)
        self.assertNotIn("medida de efecto", messages)
        self.assertIn("<1", visible(entry["cuerpo"]))

    def test_actual_duplicated_plural_is_still_detected(self):
        audit = Audit()
        audit_entry({"id": 2, "hallazgo": "pacientess"}, audit)
        self.assertTrue(any("paciente(s)" in item["hallazgo"] for item in audit.items))

    def test_valid_medical_and_statistical_variants_are_low_severity_style_notes(self):
        audit = Audit()
        audit_entry(
            {"id": 3, "hallazgo": "La norepinefrina no alcanzó significación estadística."},
            audit,
        )
        variants = [item for item in audit.items if "variante" in item["hallazgo"]]
        self.assertEqual(len(variants), 2)
        self.assertTrue(all(item["severidad"] == "BAJO" for item in variants))
        self.assertTrue(all(item["area"] == "estilo" for item in variants))


if __name__ == "__main__":
    unittest.main()
