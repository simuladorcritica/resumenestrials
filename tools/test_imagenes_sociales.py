#!/usr/bin/env python3
"""Las imágenes sociales (Telegram, X, Google) se dibujan con Sora y Literata incluidas en tools/fonts.

Evita que vuelva a publicarse una imagen hecha con la fuente de emergencia de Pillow,
que es diminuta y no tiene acentos ni eñe."""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import generar_seo_avanzado as g  # noqa: E402


class ImagenesSocialesTests(unittest.TestCase):
    def test_fuentes_incluidas(self):
        for name in g.FONT_FILES.values():
            self.assertTrue((g.FONTS_DIR / name).exists(), name)

    def test_imagen_legible_con_acentos(self):
        from PIL import Image
        item = {"id": 999999, "titulo": "PRUEBA-1: oxigenación y ventilación en la insuficiencia respiratoria aguda",
                "revista": "New England Journal of Medicine", "anio": 2026, "temas": ["Ventilación mecánica"],
                "especialidad_principal": "Medicina Crítica", "especialidad_secundaria": "", "tipo_estudio": "Ensayo clínico aleatorizado"}
        original = g.IMAGES_DIR
        with tempfile.TemporaryDirectory() as tmp:
            g.IMAGES_DIR = Path(tmp)
            try:
                url = g.make_image(item, 1280, 720, "16x9")
            finally:
                g.IMAGES_DIR = original
            image = Image.open(next(Path(tmp).glob("*-16x9.jpg"))).convert("L")
            # La sigla ocupa una franja clara y ancha sobre el fondo oscuro: con la fuente
            # de emergencia la tinta clara sería mínima.
            w, h = image.size
            band = image.crop((int(w * .05), int(h * .2), int(w * .6), int(h * .55)))
            light = sum(1 for p in band.getdata() if p > 180) / (band.width * band.height)
            self.assertGreater(light, 0.03, light)
            self.assertTrue(url.endswith("-16x9.jpg"))

    def test_revista_corta_y_glifos(self):
        self.assertEqual(g.short_journal("New England Journal of Medicine"), "NEJM")
        self.assertEqual(g.short_journal("JAMA Netw Open"), "JAMA")
        self.assertEqual(g.short_journal("Critical Care"), "Critical Care")
        self.assertEqual(g.glyph_safe("β ≥ 2 · ñ"), "beta >= 2 · ñ")


if __name__ == "__main__":
    unittest.main()
