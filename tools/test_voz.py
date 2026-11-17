#!/usr/bin/env python3
"""Pruebas de la voz de los resúmenes completos (tools/voz.py). No llaman a Google Cloud ni necesitan claves."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import voz  # noqa: E402

# 1. Reglas de lectura: cada caso es (texto publicado, texto que se lee).
CASOS = [
    ("una diferencia de 0.0 días (IC 95%, −2.7 a 2.7; p=1.00)", "una diferencia de 0.0 días (intervalo de confianza del 95 por ciento, menos 2.7 a 2.7; p igual a 1.00)"),
    ("(HR 0.40; IC 95% 0.22-0.73; P<0.001)", "(hazard ratio 0.40; intervalo de confianza del 95 por ciento 0.22 a 0.73; p menor de 0.001)"),
    ("IC95%, 0.52 a 1.22", "intervalo de confianza del 95 por ciento, 0.52 a 1.22"),
    ("IC 95% −59% a −52%", "intervalo de confianza del 95 por ciento menos 59% a menos 52%"),
    ("IC 95% -22.0 a 14.7; P = 0.69", "intervalo de confianza del 95 por ciento menos 22.0 a 14.7; p igual a 0.69"),
    ("los IC son amplios y el IC (−10.6 a 2.7) no descarta", "los intervalos de confianza son amplios y el intervalo de confianza (menos 10.6 a 2.7) no descarta"),
    ("odds ratio [OR] 0.56; hazard ratio (HR) de 0.61", "odds ratio 0.56; hazard ratio de 0.61"),
    ("riesgo relativo [RR] 0.90; la edad media (DE) fue de 58.9 (17.4)", "riesgo relativo 0.90; la edad media (desviación estándar) fue de 58.9 (17.4)"),
    ("mediana 65.0 [RIC, 24.5 a 123.3] horas", "mediana 65.0 (rango intercuartílico, 24.5 a 123.3) horas"),
    ("26 (DE 7) frente a 29 (DE 7) por minuto", "26 (desviación estándar 7) frente a 29 (desviación estándar 7) por minuto"),
    ("un NNT de 18 y un NNH de 40", "un número necesario a tratar de 18 y un número necesario para dañar de 40"),
    ("la diferencia ajustada (46.9 − 33.0 = 13.9; 13.9 / 46.9 = 0.296)", "la diferencia ajustada (46.9 menos 33.0 igual a 13.9; 13.9 sobre 46.9 igual a 0.296)"),
    ("906 (508–1529) pg/ml y un rango de 10.5%-10.9%", "906 (508 a 1529) picogramos por mililitro y un rango de 10.5% a 10.9%"),
    ("de -5, sin respuesta, a +4, combativo", "de menos 5, sin respuesta, a más 4, combativo"),
    ("presión de 130/80 mmHg o menor de 90 mm Hg", "presión de 130 sobre 80 milímetros de mercurio o menor de 90 milímetros de mercurio"),
    ("éxito del 100% (127/127) y 73,4% (127/173)", "éxito del 100% (127 sobre 127) y 73,4% (127 sobre 173)"),
    ("aleatorización 1:1:1 y títulos de 1:800", "aleatorización 1 a 1 a 1 y títulos de 1 a 800"),
    ("lactato >2 mmol/l, creatinina de 1.5 mg/dl y hemoglobina <7 g/dl", "lactato mayor de 2 milimoles por litro, creatinina de 1.5 miligramos por decilitro y hemoglobina menor de 7 gramos por decilitro"),
    ("filtrado de 45 ml/min/1.73 m2 y −3.2 mL/min/1.73 m² por año", "filtrado de 45 mililitros por minuto por 1.73 metros cuadrados y menos 3.2 mililitros por minuto por 1.73 metros cuadrados por año"),
    ("noradrenalina a 0.25 µg/kg/min y 30 ml/kg en 3 h", "noradrenalina a 0.25 microgramos por kilogramo por minuto y 30 mililitros por kilogramo en 3 horas"),
    ("1 mg/kg, 1 ml y 2 L de cristaloide en 24 h", "1 miligramo por kilogramo, 1 mililitro y 2 litros de cristaloide en 24 horas"),
    ("IMC de 31 kg/m², área de 8 mm² y plaquetas de 100 000 por mm³", "IMC de 31 kilogramos por metro cuadrado, área de 8 milímetros cuadrados y plaquetas de 100000 por milímetro cúbico"),
    ("plaquetas de 50 000/µl, 80 mg/día y 2 g/1 g cada 8 h", "plaquetas de 50000 por microlitro, 80 miligramos por día y 2 gramos 1 gramo cada 8 horas"),
    ("PEEP de 10 cm H2O con PaO2/FiO2 < 150 mm Hg, FiO2 0.6 y SpO2 92%", "PEEP de 10 centímetros de agua con relación entre la presión arterial de oxígeno y la fracción inspirada de oxígeno menor de 150 milímetros de mercurio, fracción inspirada de oxígeno 0.6 y saturación de oxígeno 92%"),
    ("APACHE II de 22, Killip III o IV, clase funcional II a IV y diabetes tipo 2", "APACHE dos de 22, Killip tres o cuatro, clase funcional dos a cuatro y diabetes tipo 2"),
    ("ensayo de fase III con factor Xa y troponina I", "ensayo de fase tres con factor Xa y troponina I"),
    ("neutrófilos de 10×10⁹/L, 38.5 °C y χ² = 4.2", "neutrófilos de 10 por 10 a la 9 por litro, 38.5 grados Celsius y ji cuadrada igual a 4.2"),
    ("edad ≥18 años, dosis ≤ 5 mg, 37.5±7.8 puntos", "edad mayor o igual a 18 años, dosis menor o igual a 5 miligramos, 37.5 más menos 7.8 puntos"),
    ("ceftazidima/avibactam, cociente proteína/creatinina y PK/PD", "ceftazidima avibactam, cociente proteína creatinina y PK PD"),
    ("COVID-19, IL-6, GLP-1, EQ-5D-5L, CHA2DS2-VASc, P2Y12 y HbA1c no cambian", "COVID-19, IL-6, GLP-1, EQ-5D-5L, CHA2DS2-VASc, P2Y12 y HbA1c no cambian"),
    ("Sedaconda ACD-S® y BIS™", "Sedaconda ACD-S y BIS"),
    ("P de interacción .43", "P de interacción .43"),
    # El nombre de un ensayo se dice de corrido, como palabras, no letra por letra (decisión del editor, 16-nov-2026).
    ("ARISE FLUIDS: vasopresores o líquidos", "Arise Fluids: vasopresores o líquidos"),
    ("los ensayos CLOVERS, CLASSIC y ProMISe", "los ensayos Clovers, Classic y Promise"),
    ("STARRT-AKI, DAPA-CKD, ECLS-SHOCK, REMAP-CAP e IDEAL-ICU", "Start-AKI, Dapa-CKD, ECLS-Shock, Remap-CAP e Ideal-ICU"),
    ("RESCUEicp frente a TTM2 (HR 0.9)", "Rescue ICP frente a TTM2 (hazard ratio 0.9)"),
    ("APACHE II, SOFA, UCI, VIH y SDRA no son nombres de ensayos", "APACHE dos, SOFA, UCI, VIH y SDRA no son nombres de ensayos"),
]
for publicado, leido in CASOS:
    assert voz.leer(publicado) == leido, f"\n  publicado: {publicado}\n  esperado:  {leido}\n  obtenido:  {voz.leer(publicado)}"
    assert voz._cifras(voz.canonico(publicado)) == voz._cifras(leido), f"el caso cambia cifras: {publicado}"

# 1b. Nombres de ensayos: salen de los títulos; la regla general solo cambia mayúsculas por minúsculas.
nombres = voz.nombres_ensayos()
fijos = {k: v for k, v in voz.LEX["ensayos"].items() if not k.startswith("_")}
assert nombres["ARISE"] == "Arise" and nombres["FLUIDS"] == "Fluids" and len(nombres) > 250
assert all(dicho.lower() == escrito.lower() for escrito, dicho in nombres.items() if escrito not in fijos), "fuera del léxico, un nombre solo cambia de mayúsculas a minúsculas"
assert all(len(k) > 3 and not any(c.isdigit() for c in k + v) for k, v in nombres.items()), "los nombres no llevan cifras y las siglas cortas no se tocan"
assert not set(voz.LEX["ensayos_deletreados"]) & set(nombres), "las siglas que se deletrean no se cambian"

# 2. La forma canónica es lo único que toca dígitos, y lo hace igual para el texto publicado y para el leído.
assert voz.canonico("O₂ 10⁹ 12 000 pacientes m2") == "O2 10^9 12000 pacientes m²"
assert voz.canonico("en 2020 150 pacientes") == "en 2020 150 pacientes", "dos números seguidos no son miles"

# 3. Todos los resúmenes publicados: se lee todo menos «Referencia y registro», sin perder cifras ni palabras.
datos = voz.resumenes()
assert len(datos) >= 332
total = 0
for r in datos:
    problemas = voz.revisar(r)
    assert not problemas, f"resumen {r['id']}: " + " | ".join(problemas)
    titulos = [t for t, _ in voz.secciones(r)]
    assert "Referencia y registro" not in titulos and titulos[0] == "Pregunta de investigación" and titulos[-1] == "Conclusión", f"resumen {r['id']}: secciones {titulos}"
    partes = voz.bloques(r)
    assert partes[0].startswith("Resúmenes Trials. ") and partes[-1] == "Fin del resumen." and partes[1] == "Pregunta de investigación."
    assert "doi" not in voz.texto_voz(r).lower().split("pregunta de investigación.")[0], f"resumen {r['id']}: la presentación no lleva la referencia"
    for trozo in voz.trozos(partes):
        assert 0 < len(trozo.encode("utf-8")) <= voz.LIMITE_BYTES
    assert "\n\n".join(voz.trozos(partes)).split() == voz.texto_voz(r).split(), f"resumen {r['id']}: los trozos no suman el texto completo"
    total += len(voz.texto_voz(r))
assert voz.texto_voz(datos[0]) == voz.texto_voz(json.loads(json.dumps(datos[0]))), "el texto para leer es determinista"

# 4. La guarda detecta lo que debe: una cifra que cambia, una palabra que se pierde y un signo sin regla.
modelo = next(r for r in datos if int(r["id"]) == 2)
original = voz.leer
try:
    voz.leer = lambda t: original(t).replace("76", "67", 1)
    assert any("cifras" in p for p in voz.revisar(modelo)), "una cifra cambiada debe detectarse"
    voz.leer = lambda t: original(t).replace("mediana", "", 1)
    assert any("palabra" in p for p in voz.revisar(modelo)), "una palabra perdida debe detectarse"
finally:
    voz.leer = original
corte = modelo["cuerpo"].rindex("</p>")
raro = dict(modelo, cuerpo=modelo["cuerpo"][:corte] + " ∆ 5 ⇒ 6" + modelo["cuerpo"][corte:])
assert any("signos sin regla" in p for p in voz.revisar(raro)), "un signo sin regla de lectura debe detectarse"

# 5. Un párrafo más largo que el límite de la API se parte por oraciones sin perder nada.
largo = " ".join(f"Oración número {i} con sus datos." for i in range(400))
partes = voz.trozos([largo])
assert len(partes) > 1 and all(len(p.encode("utf-8")) <= voz.LIMITE_BYTES for p in partes) and " ".join(partes).split() == largo.split()

# 6. Las muestras: plan válido, voces elegidas por familia y género, y fragmento con presentación.
plan = json.loads((voz.ROOT / "tools" / "voz_muestras.json").read_text(encoding="utf-8"))
falsas = [{"name": f"es-US-{f}-{n}", "ssmlGender": g, "languageCodes": ["es-US"]} for f in ("Chirp3-HD", "Neural2", "Wavenet", "Studio") for n, g in (("Aoede", "FEMALE"), ("Kore", "FEMALE"), ("Zephyr", "FEMALE"), ("Charon", "MALE"), ("Orus", "MALE"), ("Puck", "MALE"))]
assert voz.variantes("Arise Fluids: texto", {"variantes": [{"etiqueta": "Como suena", "cambios": {"Arise Fluids": "Aráis Flúids"}}, {"etiqueta": "nada", "cambios": {"no está": "x"}}]}) == [("", "Arise Fluids: texto"), ("comosuena", "Aráis Flúids: texto")]
elegidas = voz.elegir_voces(plan, falsas)
assert [v for _, _, v in elegidas][:4] == ["es-US-Chirp3-HD-Kore", "es-US-Chirp3-HD-Aoede", "es-US-Chirp3-HD-Charon", "es-US-Chirp3-HD-Orus"], elegidas
assert len(elegidas) == sum(int(f.get("FEMALE", 0)) + int(f.get("MALE", 0)) for f in plan["familias"]) and not any("Studio" in v for _, _, v in elegidas)
por_id = {int(r["id"]): r for r in datos}
for muestra in plan["muestras"]:
    texto = voz.fragmento(por_id[int(muestra["id"])], muestra["seccion"], int(muestra["caracteres"]), bool(muestra.get("presentacion")))
    assert texto.startswith("Resúmenes Trials. ") and len(texto) < int(muestra["caracteres"]) + 400 and not voz._PERMITIDO.search(texto)
import os  # noqa: E402
import contextlib  # noqa: E402
import io  # noqa: E402
import argparse  # noqa: E402
previa = os.environ.pop("GOOGLE_TTS_API_KEY", None)
try:
    with contextlib.redirect_stdout(io.StringIO()) as salida:
        assert voz.cmd_muestras(argparse.Namespace(salida="/nonexistent/nunca")) == 1
    assert "GOOGLE_TTS_API_KEY" in salida.getvalue(), "sin la clave, las muestras terminan con un mensaje claro y sin crear nada"
finally:
    if previa is not None:
        os.environ["GOOGLE_TTS_API_KEY"] = previa

print(f"VOZ PASS: {len(CASOS)} reglas de lectura, {len(datos)} resúmenes sin perder cifras ni palabras ({total} caracteres para leer), guardas, trozos y plan de muestras")
