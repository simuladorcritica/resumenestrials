#!/usr/bin/env python3
"""Las imágenes sociales (Telegram, X, Google) siguen la identidad editorial: papel, tinta,
la línea de señal con un único punto ocre y las fuentes OFL incluidas en tools/fonts.

Evita que vuelva a publicarse una imagen hecha con la fuente de emergencia de Pillow
(diminuta y sin acentos ni eñe), con la estética anterior (fondo oscuro) o con un título cortado
cuando bastaba con reducir el cuerpo de letra."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import generar_seo_avanzado as g  # noqa: E402

ITEM = {"id": 999999, "titulo": "PRUEBA-1: oxigenación y ventilación en la insuficiencia respiratoria aguda",
        "revista": "New England Journal of Medicine", "anio": 2026, "temas": ["Ventilación mecánica"],
        "especialidad_principal": "Medicina Crítica", "especialidad_secundaria": "", "tipo_estudio": "Ensayo clínico aleatorizado"}
SIZES = ((1280, 720, "16x9"), (1200, 900, "4x3"), (1200, 1200, "1x1"))


def render(item, width, height, suffix):
    from PIL import Image
    original = g.IMAGES_DIR
    with tempfile.TemporaryDirectory() as tmp:
        g.IMAGES_DIR = Path(tmp)
        try:
            url = g.make_image(item, width, height, suffix)
        finally:
            g.IMAGES_DIR = original
        image = Image.open(next(Path(tmp).glob(f"*-{suffix}.jpg"))).convert("RGB")
        image.load()
    return url, image


def is_ochre(p):
    r, gr, b = p
    return r > 165 and .6 < gr / r < .78 and b < 95 and r - b > 110


class ImagenesSocialesTests(unittest.TestCase):
    def test_fuentes_incluidas(self):
        for name in g.FONT_FILES.values():
            self.assertTrue((g.FONTS_DIR / name).exists(), name)
        self.assertNotIn("Sora", " ".join(g.FONT_FILES.values()), "La tarjeta ya no usa la tipografía de la estética anterior")

    def test_imagen_legible_con_acentos(self):
        for width, height, suffix in SIZES:
            url, image = render(ITEM, width, height, suffix)
            self.assertTrue(url.endswith(f"-{suffix}.jpg"))
            self.assertEqual(image.size, (width, height))
            w, h = image.size
            gray = image.convert("L")
            # Papel claro dominante (nada de fondo casi negro).
            corner = image.getpixel((8, 8))
            self.assertTrue(all(abs(a - b) <= 6 for a, b in zip(corner, g.CARD_COLORS["papel"])), corner)
            # El título ocupa una franja ancha de tinta oscura: con la fuente de emergencia sería mínima.
            band = gray.crop((int(w * .05), int(h * .3), int(w * .95), int(h * .75)))
            dark = sum(1 for p in band.getdata() if p < 90) / (band.width * band.height)
            self.assertGreater(dark, 0.03, (suffix, dark))

    def test_un_solo_punto_ocre_en_la_linea_de_senal(self):
        for width, height, suffix in SIZES:
            _, image = render(ITEM, width, height, suffix)
            w, h = image.size
            m = int(72 * w / 1200)
            x0 = m + int(80 * w / 1200)
            y0 = m + int(64 * w / 1200)  # debajo de la cabecera (la especialidad va en óxido, no en ocre)
            region = image.crop((x0, y0, w, h))
            ochre = [(x0 + i % region.width, y0 + i // region.width) for i, p in enumerate(region.getdata()) if is_ochre(p)]
            self.assertTrue(ochre, suffix + ": falta el punto ocre de la línea de señal")
            xs, ys = [p[0] for p in ochre], [p[1] for p in ochre]
            # Un único punto compacto, en el extremo derecho y por encima del antetítulo.
            self.assertLess(max(xs) - min(xs), 22 * w / 1200, (suffix, min(xs), max(xs)))
            self.assertLess(max(ys) - min(ys), 22 * w / 1200, (suffix, min(ys), max(ys)))
            self.assertGreater(min(xs), w - m - 30 * w / 1200)
            self.assertLess(max(ys), h * .35)

    def test_titulo_mas_largo_del_archivo_sin_cortes(self):
        from PIL import Image, ImageDraw
        data = json.loads((ROOT / "resumenes.json").read_text(encoding="utf-8"))
        longest = max(data, key=lambda r: len(g.plain(r.get("titulo"))))
        shortest = min(data, key=lambda r: len(g.plain(r.get("titulo"))))
        draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        for item in (longest, shortest):
            title = g.glyph_safe(g.plain(item["titulo"]))
            for width, height, suffix in SIZES:
                tall = height / width > .7
                scale = width * g.CARD_SUPERSAMPLE / 1200
                size, lines, lh = g.card_title_layout(draw, title, width * g.CARD_SUPERSAMPLE - 2 * round(72 * scale), 10 ** 6,
                                                      round((76 if tall else 64) * scale), round(32 * scale), 6 if tall else 4)
                text = " ".join(w for line in lines for w, _ in line)
                self.assertEqual(text, " ".join(title.split()), (item["id"], suffix))
                self.assertLessEqual(len(lines), 6 if tall else 4)
            # Y la imagen real se genera sin errores en los tres formatos.
            for width, height, suffix in SIZES:
                render(item, width, height, suffix)

    def test_recorte_por_palabra_con_puntos_suspensivos(self):
        from PIL import Image, ImageDraw
        draw = ImageDraw.Draw(Image.new("RGB", (10, 10)))
        title = "SIGLA: " + " ".join(["palabralarga"] * 80)
        size, lines, lh = g.card_title_layout(draw, title, 900, 400, 120, 60, 4)
        self.assertLessEqual(len(lines), 4)
        last = lines[-1][-1][0]
        self.assertTrue(last.endswith("…") and last[:-1] == "palabralarga", last)

    def test_antetitulo_no_llama_eca_a_lo_que_no_lo_es(self):
        self.assertEqual(g.card_study_type("Ensayo clínico aleatorizado multicéntrico, abierto"), "Ensayo clínico aleatorizado")
        self.assertEqual(g.card_study_type("ECA multicéntrico, abierto"), "Ensayo clínico aleatorizado")
        self.assertEqual(g.card_study_type("Metaanálisis de datos individuales de pacientes"), "Metaanálisis")
        self.assertEqual(g.card_study_type("Dos ensayos clínicos aleatorizados gemelos, de fase 3"), "Dos ensayos clínicos aleatorizados")

    def test_revista_corta_y_glifos(self):
        self.assertEqual(g.short_journal("New England Journal of Medicine"), "NEJM")
        self.assertEqual(g.short_journal("JAMA Netw Open"), "JAMA")
        self.assertEqual(g.short_journal("Critical Care"), "Critical Care")
        self.assertEqual(g.glyph_safe("β ≥ 2 · ñ"), "beta >= 2 · ñ")


if __name__ == "__main__":
    unittest.main()
