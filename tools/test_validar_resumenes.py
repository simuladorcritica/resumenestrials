#!/usr/bin/env python3
import unittest

from validar_resumenes import Hallazgos, validar_estilo_lexico


def revisar(texto):
    hallazgos = Hallazgos()
    validar_estilo_lexico({"cuerpo": texto}, hallazgos, 999)
    return hallazgos


class ContratoEditorialContextualTests(unittest.TestCase):
    def assert_no_error(self, hallazgos, fragmento):
        self.assertFalse(
            any(fragmento in mensaje for _, mensaje in hallazgos.errores),
            hallazgos.errores,
        )

    def test_significacion_estadistica_es_variante_no_bloqueante(self):
        casos = [
            "El desenlace alcanzó significación estadística (p = 0,025).",
            "El resultado no alcanzó significación estadística, p = 0,132.",
            "El efecto quedó en el límite de la significación (p = 0,05).",
            "Se fijó un nivel de significación alfa de 0,05.",
        ]
        for texto in casos:
            with self.subTest(texto=texto):
                hallazgos = revisar(texto)
                self.assert_no_error(hallazgos, "significación")
                self.assertTrue(any("variante estadística válida" in m for _, m in hallazgos.avisos))

    def test_significacion_sin_contexto_estadistico_sigue_bloqueada(self):
        hallazgos = revisar("La significación del hallazgo no fue explicada.")
        self.assertTrue(any("uso ambiguo" in m for _, m in hallazgos.errores))

    def test_significacion_sin_tilde_sigue_bloqueada(self):
        hallazgos = revisar("El resultado alcanzó significacion estadística, p = 0,03.")
        self.assertTrue(any("debe escribirse con tilde" in m for _, m in hallazgos.errores))

    def test_norepinefrina_es_denominacion_medica_no_bloqueante(self):
        hallazgos = revisar("La dosis de norepinefrina fue de 0,2 mcg/kg/min.")
        self.assert_no_error(hallazgos, "norepinefrina")
        self.assertTrue(any("denominación médica válida" in m for _, m in hallazgos.avisos))

    def test_equivalencia_erronea_de_catecolaminas_sigue_bloqueada(self):
        for texto in (
            "Se administró norepinefrina (adrenalina) como vasopresor.",
            "La epinefrina = noradrenalina se mantuvo durante seis horas.",
            "La norepinefrina, también llamada adrenalina, se mantuvo durante seis horas.",
        ):
            with self.subTest(texto=texto):
                hallazgos = revisar(texto)
                self.assertTrue(any("equipara incorrectamente" in m for _, m in hallazgos.errores))

    def test_referencias_suplementarias_estructuradas_son_validas(self):
        casos = [
            "Los parámetros se detallan en el Material Suplementario S3.",
            "La edad se presenta en la Tabla Suplementaria 5.",
            "Los análisis constan en las Tablas Suplementarias 3 y 4.",
            "La curva aparece en la Figura Suplementaria S2A.",
        ]
        for texto in casos:
            with self.subTest(texto=texto):
                hallazgos = revisar(texto)
                self.assert_no_error(hallazgos, "referencia documental")

    def test_referencia_suplementaria_sin_sustantivo_sigue_bloqueada(self):
        hallazgos = revisar("La cifra procede del suplementario S3.")
        self.assertTrue(any("incorrecta o ambigua" in m for _, m in hallazgos.errores))

    def test_identificador_suplementario_malformado_sigue_bloqueado(self):
        hallazgos = revisar("La cifra figura en la Tabla Suplementaria XX.")
        self.assertTrue(any("incorrecta o ambigua" in m for _, m in hallazgos.errores))

    def test_referencia_documental_ordinaria_sigue_bloqueada(self):
        hallazgos = revisar("Como se observa en la Figura 2, el efecto fue estable.")
        self.assertTrue(any("incorrecta o ambigua" in m for _, m in hallazgos.errores))


if __name__ == "__main__":
    unittest.main()
