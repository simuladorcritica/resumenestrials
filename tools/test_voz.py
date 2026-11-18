#!/usr/bin/env python3
"""Pruebas de la voz de los resúmenes completos (tools/voz.py). No llaman a Google Cloud ni necesitan claves."""
import json
import re
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
    ("INTERACT4, PARAMEDIC2 y CORE2-TIMI 72b", "Interact 4, Paramedic 2 y Core 2-Timi 72b"),
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

# 1c. Los nombres se dicen en inglés (decisión del editor, 16-nov-2026): con marcas se lee exactamente lo mismo y cada
# nombre queda en un solo tramo; una palabra corriente que coincide con un nombre («Diabetes») no se marca.
I, F = voz._INI, voz._FIN
MARCAS = [
    ("ARISE FLUIDS: vasopresores o líquidos", f"{I}Arise Fluids{F}: vasopresores o líquidos"),
    ("ANDROMEDA-SHOCK-2 mostró", f"{I}Andromeda-Shock{F}-2 mostró"),
    ("ECLS-SHOCK y DanGer-Shock", f"{I}ECLS-Shock{F} y {I}Danger-Shock{F}"),
    ("STARRT-AKI, REMAP-CAP e IDEAL-ICU", f"{I}Start-AKI{F}, {I}Remap-CAP{F} e {I}Ideal-ICU{F}"),
    ("EMPA-REG OUTCOME y EMPEROR-Preserved", f"{I}Empa-REG Outcome{F} y {I}Emperor-Preserved{F}"),
    ("Diabetes al inicio; OPTIMAL-DIABETES", f"Diabetes al inicio; {I}Optimal-Diabetes{F}"),
    ("INTERACT4 y CORE2-TIMI 72b", f"{I}Interact{F} 4 y {I}Core{F} 2-{I}Timi{F} 72b"),
    ("los ensayos CLOVERS, CLASSIC y ProMISe (HR 0.9; IC 95% 0.8-1.1)", f"los ensayos {I}Clovers{F}, {I}Classic{F} y {I}Promise{F} (hazard ratio 0.9; intervalo de confianza del 95 por ciento 0.8 a 1.1)"),
    ("APACHE II, SOFA, UCI y el modelo de Fine-Gray", "APACHE dos, SOFA, UCI y el modelo de Fine-Gray"),
]
for publicado, marcado in MARCAS:
    assert voz.leer(publicado, True) == marcado, f"\n  publicado: {publicado}\n  esperado:  {marcado!r}\n  obtenido:  {voz.leer(publicado, True)!r}"
    assert voz.sin_marcas(marcado) == voz.leer(publicado), f"las marcas cambian la lectura: {publicado}"
assert voz.ssml(voz.leer('ANDROMEDA-SHOCK-2 "mostró" que ARISE FLUIDS', True) + "\n\nL'Hôpital") == (
    '<speak><p><lang xml:lang="en-US">Andromeda-Shock</lang> 2 &quot;mostró&quot; que <lang xml:lang="en-US">Arise Fluids</lang></p><p>L&apos;Hôpital</p></speak>')
assert voz.texto_de_ssml(voz.ssml('Uno "dos"\n\ntres')) == 'Uno "dos"\n\ntres'
assert voz.admite_ssml("es-US-Wavenet-B") and voz.admite_ssml("es-US-Neural2-A") and not voz.admite_ssml("es-US-Chirp3-HD-Kore")

# 2. La forma canónica es lo único que toca dígitos, y lo hace igual para el texto publicado y para el leído.
assert voz.canonico("O₂ 10⁹ 12 000 pacientes m2") == "O2 10^9 12000 pacientes m²"
assert voz.canonico("en 2020 150 pacientes") == "en 2020 150 pacientes", "dos números seguidos no son miles"

# 3. Todos los resúmenes publicados: se lee todo menos «Referencia y registro», sin perder cifras ni palabras.
datos = voz.resumenes()
assert len(datos) >= 332
total = con_nombres = 0
junto = voz._junto  # el SSML solo cambia por un espacio el guion entre un nombre y su cifra
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
    marcadas = voz.bloques(r, True)
    assert [voz.sin_marcas(x) for x in marcadas] == partes, f"resumen {r['id']}: con marcas no se lee lo mismo"
    assert all(re.fullmatch(f"(?:[^{I}{F}]|{I}[^{I}{F}]+{F})*", x) for x in marcadas), f"resumen {r['id']}: marcas mal cerradas"
    # La presentación siempre lleva algo en inglés: la revista con su nombre completo (y el nombre del ensayo, si lo tiene).
    # El 17-nov-2026 llegó el primer resumen de «Crit Care Med», que no estaba en el léxico, y este control lo detectó.
    assert str(r.get("revista") or "").strip() in voz.LEX["revistas"], f"resumen {r['id']}: la revista «{r.get('revista')}» no tiene nombre para leerse (tools/voz_lexico.json, «revistas»)"
    assert I in marcadas[0], f"resumen {r['id']}: la presentación no lleva la revista en inglés"
    peticiones = voz.peticiones(r)
    grupos = voz.partes(r)
    assert [x for g in grupos for x in g] == marcadas and len(grupos) == len(titulos) + 2 and grupos[-1] == ["Fin del resumen."] and [g[0] for g in grupos[1:-1]] == [x + "." for x in map(voz.leer, titulos)], f"resumen {r['id']}: una parte por sección, más presentación y cierre"
    assert peticiones == [x for g in grupos for x in voz.trozos_ssml(g)] and voz.huella(r) != voz.huella_anterior(r), f"resumen {r['id']}: se envía parte por parte"
    assert all(x.startswith("<speak><p>") and x.endswith("</p></speak>") and len(x.encode("utf-8")) <= 5000 for x in peticiones), f"resumen {r['id']}: petición SSML fuera de límite"
    assert all(x.count("<lang ") == x.count("</lang>") and not re.search(r"<(?!/?(?:speak|p|lang)\b)", x) for x in peticiones), f"resumen {r['id']}: SSML mal formado"
    assert junto(" ".join(voz.texto_de_ssml(x) for x in peticiones)) == junto(voz.texto_voz(r)), f"resumen {r['id']}: el SSML no dice lo mismo que el texto"
    con_nombres += sum(x.count("<lang ") for x in peticiones)
    total += len(voz.texto_voz(r))
assert voz.texto_voz(datos[0]) == voz.texto_voz(json.loads(json.dumps(datos[0]))), "el texto para leer es determinista"

# 4. La guarda detecta lo que debe: una cifra que cambia, una palabra que se pierde y un signo sin regla.
modelo = next(r for r in datos if int(r["id"]) == 2)
original = voz.leer
try:
    voz.leer = lambda t, marcas=False: original(t, marcas).replace("76", "67", 1)
    assert any("cifras" in p for p in voz.revisar(modelo)), "una cifra cambiada debe detectarse"
    voz.leer = lambda t, marcas=False: original(t, marcas).replace("mediana", "", 1)
    assert any("palabra" in p for p in voz.revisar(modelo)), "una palabra perdida debe detectarse"
finally:
    voz.leer = original
bloques_bien = voz.bloques
try:
    voz.bloques = lambda r, marcas=False: [x.replace("Arise", "Arise ya", 1) if marcas else x for x in bloques_bien(r, marcas)]
    assert any("marcas" in p for p in voz.revisar(modelo)), "una lectura distinta con marcas debe detectarse"
    voz.bloques = lambda r, marcas=False: [x.replace(F, "", 1) if marcas else x for x in bloques_bien(r, marcas)]
    assert any("no cierran" in p for p in voz.revisar(modelo)), "una marca sin cerrar debe detectarse"
finally:
    voz.bloques = bloques_bien
corte = modelo["cuerpo"].rindex("</p>")
raro = dict(modelo, cuerpo=modelo["cuerpo"][:corte] + " ∆ 5 ⇒ 6" + modelo["cuerpo"][corte:])
assert any("signos sin regla" in p for p in voz.revisar(raro)), "un signo sin regla de lectura debe detectarse"
# Una revista sin nombre en el léxico impide generar el audio: la voz leería su abreviatura tal cual.
sin_revista = dict(datos[0], revista="Rev Inexistente Med")
assert any("no tiene nombre para leerse" in p for p in voz.revisar(sin_revista)), "una revista sin nombre hablado debe detectarse"
assert voz.LEX["revistas"]["Crit Care Med"] == "Critical Care Medicine" and not voz.revisar(dict(datos[0], revista="")), "sin revista no hay nada que nombrar"

# 5. Un párrafo más largo que el límite de la API se parte por oraciones sin perder nada.
largo = " ".join(f"Oración número {i} con sus datos." for i in range(400))
partes = voz.trozos([largo])
assert len(partes) > 1 and all(len(p.encode("utf-8")) <= voz.LIMITE_BYTES for p in partes) and " ".join(partes).split() == largo.split()

# 6. Las muestras: plan válido, voces elegidas por familia y género, y fragmento con presentación.
plan = json.loads((voz.ROOT / "tools" / "voz_muestras.json").read_text(encoding="utf-8"))
falsas = [{"name": f"es-US-{f}-{n}", "ssmlGender": g, "languageCodes": ["es-US"]} for f in ("Chirp3-HD", "Neural2", "Wavenet", "Studio") for n, g in (("Aoede", "FEMALE"), ("Kore", "FEMALE"), ("Zephyr", "FEMALE"), ("Charon", "MALE"), ("Orus", "MALE"), ("Puck", "MALE"))]
assert voz.variantes("Arise Fluids: texto", {"variantes": [{"etiqueta": "Como suena", "cambios": {"Arise Fluids": "Aráis Flúids"}}, {"etiqueta": "nada", "cambios": {"no está": "x"}}]}) == [("", "Arise Fluids: texto"), ("comosuena", "Aráis Flúids: texto")]
por_familias = {"familias": [{"nombre": "Chirp3-HD", "FEMALE": 2, "MALE": 2}, {"nombre": "Wavenet", "FEMALE": 1, "MALE": 1}], "preferidas": ["Kore", "Aoede", "Charon", "Orus"]}
elegidas = voz.elegir_voces(por_familias, falsas)
assert [v for _, _, v in elegidas][:4] == ["es-US-Chirp3-HD-Kore", "es-US-Chirp3-HD-Aoede", "es-US-Chirp3-HD-Charon", "es-US-Chirp3-HD-Orus"], elegidas
assert len(elegidas) == sum(int(f.get("FEMALE", 0)) + int(f.get("MALE", 0)) for f in por_familias["familias"]) and not any("Studio" in v for _, _, v in elegidas)
assert voz.elegir_voces({"voces": ["es-US-Wavenet-Puck", "es-US-Wavenet-NoExiste"]}, falsas) == [("Wavenet", "MALE", "es-US-Wavenet-Puck")], "una voz pedida por su nombre se toma solo si existe"
assert len(voz.elegir_voces(plan, falsas + [{"name": v, "ssmlGender": "MALE", "languageCodes": ["es-US"]} for v in plan.get("voces", [])])) >= 1, "el plan elige al menos una voz"
por_id = {int(r["id"]): r for r in datos}
hay_completo = hay_ingles = False
for muestra in plan["muestras"]:
    r = por_id[int(muestra["id"])]
    todas = voz.versiones(r, muestra)
    assert todas, "cada muestra del plan produce al menos un audio"
    for etiqueta, parrafos, con_marcas in todas:
        texto = "\n\n".join(parrafos)
        assert texto.startswith("Resúmenes Trials. ") and not voz._PERMITIDO.search(voz.sin_marcas(texto))
        assert con_marcas == (I in texto) and (con_marcas or F not in texto), "solo la variante en inglés lleva marcas"
        if muestra.get("completo"):
            assert voz.sin_marcas(texto) == voz.texto_voz(r), "la muestra completa es el resumen entero"
            hay_completo = True
        else:
            assert len(voz.sin_marcas(texto)) < int(muestra["caracteres"]) + 400
        if con_marcas:
            limpio = voz.fragmento(r, muestra["seccion"], int(muestra["caracteres"]), bool(muestra.get("presentacion"))) if not muestra.get("completo") else voz.texto_voz(r)
            assert voz.sin_marcas(texto) == limpio, "la variante en inglés dice el mismo texto"
            assert all(len(x.encode("utf-8")) <= 5000 for x in voz.trozos_ssml(parrafos))
            hay_ingles = True
assert hay_ingles, "el plan incluye la variante con los nombres en inglés"
assert voz.versiones(por_id[2], {"seccion": "Pregunta de investigación", "caracteres": 60, "base": False, "variantes": [{"etiqueta": "x", "cambios": {"población": "muestra"}}]})[0][0] == "x", "sin base solo quedan las variantes"
import os  # noqa: E402
import contextlib  # noqa: E402
import io  # noqa: E402
import argparse  # noqa: E402
import tempfile  # noqa: E402
previa = os.environ.pop("GOOGLE_TTS_API_KEY", None)
try:
    with contextlib.redirect_stdout(io.StringIO()) as salida:
        assert voz.cmd_muestras(argparse.Namespace(salida="/nonexistent/nunca")) == 1
    assert "GOOGLE_TTS_API_KEY" in salida.getvalue(), "sin la clave, las muestras terminan con un mensaje claro y sin crear nada"
finally:
    if previa is not None:
        os.environ["GOOGLE_TTS_API_KEY"] = previa

assert con_nombres > 1000, "los nombres de ensayos y revistas quedan marcados para decirse en inglés"
# 7. Almacén: la firma de las peticiones coincide con los ejemplos publicados por AWS (Signature V4 para S3).
import hashlib  # noqa: E402
import http.server  # noqa: E402
import threading  # noqa: E402
# Credenciales de ejemplo de la documentación de AWS (no son claves reales); van partidas para que ningún detector
# de secretos las confunda con una clave de verdad.
CLAVE_ID, SECRETO = "AKIA" + "IOSFODNN7" + "EXAMPLE", "wJalrXUtnFEMI/K7MDENG/" + "bPxRfiCY" + "EXAMPLEKEY"
vacio = hashlib.sha256(b"").hexdigest()
firma = voz.firma_v4("GET", "examplebucket.s3.amazonaws.com", "/test.txt", {"range": "bytes=0-9", "x-amz-content-sha256": vacio, "x-amz-date": "20130524T000000Z"}, vacio, CLAVE_ID, SECRETO, "us-east-1")
assert firma == (f"AWS4-HMAC-SHA256 Credential={CLAVE_ID}/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,"
                 "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"), firma
cuerpo = hashlib.sha256(b"Welcome to Amazon S3.").hexdigest()
firma = voz.firma_v4("PUT", "examplebucket.s3.amazonaws.com", "/test$file.text", {"date": "Fri, 24 May 2013 00:00:00 GMT", "x-amz-content-sha256": cuerpo, "x-amz-date": "20130524T000000Z", "x-amz-storage-class": "REDUCED_REDUNDANCY"}, cuerpo, CLAVE_ID, SECRETO, "us-east-1")
assert firma.endswith("Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd"), firma


# 7b. El cliente del almacén contra un servidor local que comprueba la firma de cada petición (sin salir a la red).
class Cubo(http.server.BaseHTTPRequestHandler):
    objetos, tipos, vistos = {}, {}, []

    def _atender(self):
        datos = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        firmadas = re.search(r"SignedHeaders=([^,]+)", self.headers["Authorization"]).group(1).split(";")
        cab = {k: self.headers[k] for k in firmadas if k != "host"}
        buena = voz.firma_v4(self.command, self.headers["Host"], self.path, cab, hashlib.sha256(datos).hexdigest(), CLAVE_ID, SECRETO)
        Cubo.vistos.append(self.command)
        if self.headers["Authorization"] != buena or self.headers["x-amz-content-sha256"] != hashlib.sha256(datos).hexdigest():
            return self._responder(403, b"<Error><Code>SignatureDoesNotMatch</Code><Message>firma incorrecta</Message><AWSAccessKeyId>NO-MOSTRAR</AWSAccessKeyId></Error>")
        if self.command == "PUT":
            Cubo.objetos[self.path], Cubo.tipos[self.path] = datos, (self.headers["Content-Type"], self.headers["Cache-Control"])
            return self._responder(200, b"")
        if self.command == "DELETE":
            Cubo.objetos.pop(self.path, None)
            return self._responder(204, b"")
        if self.path not in Cubo.objetos:
            return self._responder(404, b"<Error><Code>NoSuchKey</Code></Error>")
        self._responder(200, Cubo.objetos[self.path])

    def _responder(self, estado, datos):
        self.send_response(estado)
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(datos)

    do_GET = do_PUT = do_HEAD = do_DELETE = _atender

    def log_message(self, *_):
        pass


os.environ["NO_PROXY"] = os.environ["no_proxy"] = "127.0.0.1,localhost"
servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Cubo)
threading.Thread(target=servidor.serve_forever, daemon=True).start()
try:
    base = f"http://127.0.0.1:{servidor.server_address[1]}"
    cubo = voz.Almacen("cuenta", CLAVE_ID, SECRETO, "audios", base=base)
    assert cubo.leer("resumenes/2.json") is None and cubo.existe("resumenes/2.json") is None, "lo que no existe se lee como None"
    cubo.escribir("resumenes/2/abc.mp3", b"\xff\xf3" * 50, "audio/mpeg", voz.CACHE_AUDIO)
    assert cubo.leer("resumenes/2/abc.mp3") == b"\xff\xf3" * 50 and cubo.existe("resumenes/2/abc.mp3") == 100
    assert Cubo.tipos["/audios/resumenes/2/abc.mp3"] == ("audio/mpeg", voz.CACHE_AUDIO), "el audio se guarda con su tipo y su caché"
    cubo.borrar("resumenes/2/abc.mp3")
    assert cubo.leer("resumenes/2/abc.mp3") is None and Cubo.vistos == ["GET", "HEAD", "PUT", "GET", "HEAD", "DELETE", "GET"]
    try:
        voz.Almacen("cuenta", CLAVE_ID, "otro-secreto", "audios", base=base).escribir("x.json", b"{}", "application/json", voz.CACHE_FICHA)
        raise AssertionError("una firma incorrecta debe detener la orden")
    except SystemExit as e:
        assert "403" in str(e) and "SignatureDoesNotMatch" in str(e) and "NO-MOSTRAR" not in str(e) and "otro-secreto" not in str(e), "del error solo se muestran el código y el mensaje"
finally:
    servidor.shutdown()


# 8. Generación: almacén y voz simulados. Piloto, nada dos veces, retirada al cambiar el texto, topes y recuperación.
class AlmacenFalso:
    def __init__(self):
        self.objetos, self.tipos = {}, {}

    def leer(self, clave):
        return self.objetos.get(clave)

    def existe(self, clave):
        return len(self.objetos[clave]) if clave in self.objetos else None

    def escribir(self, clave, datos_, tipo, cache):
        self.objetos[clave], self.tipos[clave] = datos_, (tipo, cache)

    def borrar(self, clave):
        self.objetos.pop(clave, None)

    def partes(self):
        return {k for k in self.objetos if k.startswith("partes/")}


TRAMA = b"\xff\xf3\x84\xc4" + bytes(188)  # una trama como las de WaveNet: MPEG-2 capa III, 64 kbps, 24 kHz, 576 muestras
assert voz.segundos_mp3(TRAMA * 125) == 3.0
for roto in (b"", TRAMA[:100], TRAMA + b"ID3" + TRAMA, b"\x00" + TRAMA):
    try:
        voz.segundos_mp3(roto)
        raise AssertionError("un MP3 roto debe detectarse")
    except ValueError:
        pass
enviados = []


def voz_falsa(texto):
    assert texto.startswith("<speak>") and len(texto.encode("utf-8")) <= 5000
    enviados.append(texto)
    return TRAMA * (len(texto) // 100 + 1)


def caracteres(*resumenes_):
    """Lo que cuesta leer estos resúmenes: cada parte distinta se paga una sola vez («Fin del resumen.» es de todos)."""
    return sum(len(x) for x in dict.fromkeys(x for r_ in resumenes_ for x in voz.peticiones(r_)))


def silencio(*_):
    pass


AHORA = "2026-11-17T02:00:00Z"
cuatro = [por_id[i] for i in (2, 69, 113, 230)]
assert voz.huella(por_id[2]) == voz.huella(json.loads(json.dumps(por_id[2]))) and re.fullmatch(r"[0-9a-f]{16}", voz.huella(por_id[2])), "la huella es determinista"
assert len({voz.huella(r) for r in cuatro}) == 4
version_previa, voz.VERSION = voz.VERSION, voz.VERSION + 1
assert voz.huella(por_id[2]) == voz.huella(json.loads(json.dumps(por_id[2]))), "subir la versión sin cambiar lo que se lee no obliga a generar otra vez"
voz.VERSION = version_previa
assert all(re.fullmatch(r"partes/[0-9a-f]{32}\.mp3", voz.clave_parte(x)) for x in voz.peticiones(por_id[2])) and len({voz.clave_parte(x) for x in voz.peticiones(por_id[2])}) == len(voz.peticiones(por_id[2]))
assert voz.clave_parte(voz.peticiones(por_id[2])[-1]) == voz.clave_parte(voz.peticiones(por_id[69])[-1]), "dos resúmenes comparten el audio de lo que dicen igual (el cierre)"
plan_piloto = {"automatico": False, "piloto": [2, 69], "tope_mensual": 3900000, "maximo_por_ejecucion": 150}
falso = AlmacenFalso()
inf = voz.generar(cuatro, plan_piloto, falso, voz_falsa, AHORA, avisar=silencio)
assert sorted(inf["generados"]) == [2, 69] and inf["con_audio"] == 2 and sorted(inf["pendientes"]) == [113, 230] and inf["fuera_del_piloto"] == 2 and not inf["error"], inf
assert inf["generados"] == [2, 69], "en el archivo antiguo, primero el más reciente por fecha del artículo"
ficha = json.loads(falso.objetos["resumenes/2.json"])
assert ficha["audio"] == f"resumenes/2/{voz.huella(por_id[2])}.mp3" and ficha["bytes"] == len(falso.objetos[ficha["audio"]]) and ficha["segundos"] == round(voz.segundos_mp3(falso.objetos[ficha["audio"]])) and ficha["voz"] == voz.VOZ
assert set(ficha) == {"id", "audio", "huella", "segundos", "bytes", "voz", "version", "generado"}, "la ficha que lee la página no cambia de forma"
assert falso.tipos[ficha["audio"]] == ("audio/mpeg", voz.CACHE_AUDIO) and falso.tipos["resumenes/2.json"][0].startswith("application/json")
assert set(json.loads(falso.objetos["indice.json"])["resumenes"]) == {"2", "69"}
lista = json.loads(falso.objetos["lista.json"])
assert lista == {"actualizado": AHORA, "ids": [2, 69]} and falso.tipos["lista.json"] == ("application/json; charset=utf-8", voz.CACHE_FICHA) and len(falso.objetos["lista.json"]) < 80, "la lista pública nombra solo los resúmenes con audio, y es pequeña"
assert "".join(enviados[:len(voz.peticiones(por_id[2]))]) == "".join(voz.peticiones(por_id[2])), "se envía exactamente el SSML del resumen"
usados = json.loads(falso.objetos["estado/uso.json"])["2026-11"]
assert usados == inf["caracteres_ejecucion"] == sum(len(x) for x in enviados) == caracteres(por_id[2], por_id[69]) < sum(len(x) for i in (2, 69) for x in voz.peticiones(por_id[i])), "cada parte se paga una sola vez"
# El audio del resumen es la suma, en orden, de los audios de sus partes, y cada parte queda guardada.
assert falso.objetos[ficha["audio"]] == b"".join(falso.objetos[voz.clave_parte(x)] for x in voz.peticiones(por_id[2])) and json.loads(falso.objetos["indice.json"])["resumenes"]["2"]["partes"] == [voz.clave_parte(x) for x in voz.peticiones(por_id[2])]
assert falso.partes() == {voz.clave_parte(x) for i in (2, 69) for x in voz.peticiones(por_id[i])} and all(falso.tipos[k] == ("audio/mpeg", voz.CACHE_AUDIO) for k in falso.partes())
# Segunda ejecución: no se genera ni se paga nada dos veces.
antes = len(enviados)
inf = voz.generar(cuatro, plan_piloto, falso, voz_falsa, AHORA, avisar=silencio)
assert not inf["generados"] and not inf["retirados"] and inf["caracteres_ejecucion"] == 0 and len(enviados) == antes and inf["con_audio"] == 2
# Si el texto de un resumen cambia, su audio viejo se retira antes de generar el nuevo.
corregido = dict(por_id[2], cuerpo=por_id[2]["cuerpo"].replace("mediana", "media", 1))
assert voz.huella(corregido) != voz.huella(por_id[2])
viejo = ficha["audio"]
cambiadas = [x for x in voz.peticiones(corregido) if x not in voz.peticiones(por_id[2])]
sobran = {voz.clave_parte(x) for x in voz.peticiones(por_id[2]) if x not in voz.peticiones(corregido)}
assert len(cambiadas) == 1 == len(sobran), "una corrección en una sección cambia una sola parte"
inf = voz.generar([corregido] + cuatro[1:], plan_piloto, falso, lambda _t: (_ for _ in ()).throw(SystemExit("Google Cloud respondió 429")), AHORA, avisar=silencio)
assert inf["retirados"] == [2] and "429" in inf["error"] and "resumenes/2.json" not in falso.objetos and viejo not in falso.objetos and inf["con_audio"] == 1, "aunque la voz falle, el audio viejo ya no se ofrece"
assert inf["en_cola"]["corregidos"] == [2] and json.loads(falso.objetos["indice.json"])["corregidos"]["2"]["desde"] == AHORA and sobran <= falso.partes(), "el corregido queda anotado y sus partes se conservan hasta tener el audio nuevo"
assert 2 not in json.loads(falso.objetos["lista.json"])["ids"], "un resumen corregido sale de la lista pública en la misma ejecución en que se retira su audio"
antes = len(enviados)
inf = voz.generar([corregido] + cuatro[1:], plan_piloto, falso, voz_falsa, AHORA, avisar=silencio)
assert inf["generados"] == [2] and json.loads(falso.objetos["resumenes/2.json"])["huella"] == voz.huella(corregido) and inf["con_audio"] == 2
assert enviados[antes:] == cambiadas and inf["caracteres_ejecucion"] == len(cambiadas[0]) < caracteres(corregido) / 3, "de un resumen corregido solo se vuelve a generar la parte que cambió"
assert falso.objetos[json.loads(falso.objetos["resumenes/2.json"])["audio"]] == b"".join(falso.objetos[voz.clave_parte(x)] for x in voz.peticiones(corregido))
assert not sobran & falso.partes() and voz.clave_parte(voz.peticiones(por_id[69])[-1]) in falso.partes() and not json.loads(falso.objetos["indice.json"])["corregidos"], "la parte que ya nadie usa se borra; las compartidas se quedan"
assert falso.partes() == {voz.clave_parte(x) for r_ in (corregido, por_id[69]) for x in voz.peticiones(r_)}
# Si se pierde la ficha pero el audio sigue en el almacén, se recupera sin volver a generarlo.
del falso.objetos["resumenes/69.json"]
falso.objetos["indice.json"] = json.dumps({"resumenes": {"2": json.loads(falso.objetos["indice.json"])["resumenes"]["2"]}}).encode()
antes = len(enviados)
inf = voz.generar([corregido] + cuatro[1:], plan_piloto, falso, voz_falsa, AHORA, avisar=silencio)
assert inf["recuperados"] == [69] and not inf["generados"] and len(enviados) == antes and "resumenes/69.json" in falso.objetos
# En automático: tope mensual, máximo por ejecución y resúmenes que no pasan las guardas.
uso_mes = json.loads(falso.objetos["estado/uso.json"])["2026-11"]
falta = caracteres(corregido, por_id[69], por_id[230]) - caracteres(corregido, por_id[69])
inf = voz.generar([corregido] + cuatro[1:], {"automatico": True, "tope_mensual": uso_mes + falta - 1, "maximo_por_ejecucion": 150}, falso, voz_falsa, AHORA, avisar=silencio)
assert not inf["generados"] and inf["detenido_por"] == "tope mensual" and json.loads(falso.objetos["estado/uso.json"])["2026-11"] == uso_mes, "nunca se pasa del tope mensual"
assert inf["pendientes"] == [230, 113] and inf["en_cola"] == {"corregidos": [], "nuevos": [230], "archivo": [113], "renovar": []}, "lo que no cabe se queda en cola (el 230 se publicó en el sitio hace menos de 30 días: cuenta como nuevo)"
inf = voz.generar([corregido] + cuatro[1:], {"automatico": True, "tope_mensual": 3900000, "maximo_por_ejecucion": 150}, falso, voz_falsa, AHORA, maximo=1, avisar=silencio)
assert inf["generados"] == [230] and inf["detenido_por"] == "máximo por ejecución" and inf["pendientes"] == [113]
inf = voz.generar([corregido] + cuatro[1:], {"automatico": True, "tope_mensual": 3900000, "maximo_por_ejecucion": 150}, falso, voz_falsa, "2026-12-01T00:00:00Z", ids=[113, 2], avisar=silencio)
assert inf["generados"] == [113] and inf["con_audio"] == 4 and json.loads(falso.objetos["estado/uso.json"])["2026-12"] == inf["caracteres_ejecucion"] == inf["caracteres_mes"], "cada mes lleva su cuenta"
sin_regla = dict(por_id[69], cuerpo=por_id[69]["cuerpo"][:por_id[69]["cuerpo"].rindex("</p>")] + " ∆ 5 ⇒ 6</p>")
inf = voz.generar([corregido, sin_regla] + cuatro[2:], {"automatico": True, "tope_mensual": 3900000}, falso, voz_falsa, AHORA, avisar=silencio)
assert inf["retirados"] == [69] and "69" in inf["con_problemas"] and not inf["generados"] and "resumenes/69.json" not in falso.objetos, "un resumen que no pasa las guardas se queda sin audio"
# Si la voz falla a media lectura, lo ya generado queda guardado y contado: al reintentar no se paga otra vez.
medio = AlmacenFalso()
cuenta = []


def voz_que_falla(texto):
    if len(cuenta) == 3:
        raise SystemExit("Google Cloud respondió 503")
    cuenta.append(texto)
    return voz_falsa(texto)


inf = voz.generar([por_id[2]], {"automatico": True, "tope_mensual": 3900000}, medio, voz_que_falla, AHORA, avisar=silencio)
assert "503" in inf["error"] and not inf["generados"] and len(medio.partes()) == 3 and json.loads(medio.objetos["estado/uso.json"])["2026-11"] == inf["caracteres_ejecucion"] == sum(len(x) for x in cuenta) and "resumenes/2.json" not in medio.objetos
inf = voz.generar([por_id[2]], {"automatico": True, "tope_mensual": 3900000}, medio, voz_falsa, AHORA, avisar=silencio)
assert inf["generados"] == [2] and inf["caracteres_ejecucion"] == caracteres(por_id[2]) - sum(len(x) for x in cuenta) and json.loads(medio.objetos["estado/uso.json"])["2026-11"] == caracteres(por_id[2])

# 9. Los audios generados antes de leer por partes siguen valiendo mientras su texto no cambie (ninguno se genera otra vez).
antiguo = AlmacenFalso()
ficha_antigua = {"id": 2, "audio": f"resumenes/2/{voz.huella_anterior(por_id[2])}.mp3", "huella": voz.huella_anterior(por_id[2]), "segundos": 3, "bytes": len(TRAMA) * 125, "voz": voz.VOZ, "version": 3, "generado": "2026-11-16T20:00:00Z"}
antiguo.objetos.update({ficha_antigua["audio"]: TRAMA * 125, "resumenes/2.json": json.dumps(ficha_antigua).encode(), "indice.json": json.dumps({"resumenes": {"2": ficha_antigua}}).encode(), "estado/uso.json": b'{"2026-11": 1000}'})
antes = len(enviados)
inf = voz.generar([por_id[2]], {"automatico": True, "tope_mensual": 3900000}, antiguo, voz_falsa, AHORA, avisar=silencio)
assert not inf["retirados"] and not inf["generados"] and not inf["pendientes"] and inf["con_audio"] == 1 and len(enviados) == antes and json.loads(antiguo.objetos["resumenes/2.json"]) == ficha_antigua, "un audio anterior con el mismo texto no se toca"
inf = voz.generar([corregido], {"automatico": True, "tope_mensual": 3900000}, antiguo, voz_falsa, AHORA, avisar=silencio)
assert inf["retirados"] == [2] and inf["generados"] == [2] and ficha_antigua["audio"] not in antiguo.objetos and json.loads(antiguo.objetos["resumenes/2.json"])["huella"] == voz.huella(corregido), "al corregirlo se retira y se genera por partes"
assert inf["caracteres_ejecucion"] == caracteres(corregido), "la primera vez se generan todas sus partes; desde entonces, solo la que cambie"

# 10. Orden y cupo: primero los corregidos, luego los nuevos y al final el archivo antiguo, que no toca la reserva del mes.
nuevo_a, nuevo_b = dict(por_id[113], fecha_publicacion_resumen="2026-11-16"), dict(por_id[230], fecha_publicacion_resumen="2026-11-17")
viejo_a, viejo_b = dict(por_id[69], fecha_publicacion_resumen="2026-08-20"), dict(por_id[149], fecha_publicacion_resumen="2026-08-21")
todos = [viejo_a, nuevo_a, corregido, viejo_b, nuevo_b]
plan_auto = {"automatico": True, "tope_mensual": 3900000, "maximo_por_ejecucion": 150, "dias_nuevo": 30}
orden = AlmacenFalso()
voz.generar([por_id[2]], plan_auto, orden, voz_falsa, AHORA, avisar=silencio)
inf = voz.generar(todos, plan_auto, orden, voz_falsa, AHORA, avisar=silencio)
assert inf["retirados"] == [2] and inf["generados"] == [2, 230, 113] + sorted([69, 149], key=lambda i: (por_id[i]["fecha"], i), reverse=True), "corregido, nuevos del más reciente al más antiguo y archivo por fecha del artículo"
orden = AlmacenFalso()
inf = voz.generar(todos, dict(plan_auto, prioridad=[149]), orden, voz_falsa, AHORA, maximo=2, avisar=silencio)
assert inf["generados"] == [149, 230] and inf["en_cola"] == {"corregidos": [], "nuevos": [113], "archivo": [2, 69] if (por_id[2]["fecha"], 2) > (por_id[69]["fecha"], 69) else [69, 2], "renovar": []}, "el plan puede poner un resumen delante de todos"
# Reserva: al empezar el mes el archivo antiguo solo usa lo que el tope deja libre; los nuevos y los corregidos, todo.
reserva = AlmacenFalso()
coste_nuevos, coste_viejos = caracteres(nuevo_a, nuevo_b), caracteres(nuevo_a, nuevo_b, viejo_a, viejo_b) - caracteres(nuevo_a, nuevo_b)
plan_reserva = dict(plan_auto, tope_mensual=coste_nuevos + coste_viejos + 5000, reserva_mensual=coste_viejos + 4000)
inf = voz.generar([viejo_a, nuevo_a, viejo_b, nuevo_b], plan_reserva, reserva, voz_falsa, "2026-12-01T00:00:00Z", avisar=silencio)
assert inf["generados"] == [230, 113] and inf["detenido_por"] == "reserva del mes" and sorted(inf["en_cola"]["archivo"]) == [69, 149] and inf["caracteres_mes"] == coste_nuevos, "el día 1 la reserva es para corregidos y nuevos"
inf = voz.generar([viejo_a, nuevo_a, viejo_b, nuevo_b], plan_reserva, reserva, voz_falsa, "2026-12-31T23:00:00Z", avisar=silencio)
assert sorted(inf["generados"]) == [69, 149] and not inf["detenido_por"] and not inf["pendientes"] and inf["caracteres_mes"] <= plan_reserva["tope_mensual"], "al acabar el mes el archivo usa el cupo que sobró"
# Nunca se paga: si la parte gratuita no alcanza, los que no caben esperan en cola al mes siguiente, por orden.
corto = AlmacenFalso()
voz.generar([por_id[2]], plan_auto, corto, voz_falsa, AHORA, avisar=silencio)
justo = json.loads(corto.objetos["estado/uso.json"])["2026-11"] + len(cambiadas[0]) + caracteres(por_id[2], nuevo_b) - caracteres(por_id[2])  # cabe la parte corregida y un nuevo
inf = voz.generar(todos, dict(plan_auto, tope_mensual=justo), corto, voz_falsa, AHORA, avisar=silencio)
assert inf["generados"] == [2, 230] and inf["detenido_por"] == "tope mensual" and inf["caracteres_mes"] <= justo and inf["en_cola"]["nuevos"] == [113] and len(inf["en_cola"]["archivo"]) == 2
inf = voz.generar(todos, plan_auto, corto, voz_falsa, "2026-12-01T10:17:00Z", avisar=silencio)
assert inf["generados"][0] == 113 and len(inf["generados"]) == 3 and not inf["pendientes"] and json.loads(corto.objetos["estado/uso.json"])["2026-11"] <= justo, "con el cupo del mes nuevo se atiende la cola, por orden"

# 11. Avisos al editor: se le dice una vez lo que se queda sin audio (cupo, guarda o error) y cuándo se resuelve.
avisos = []


def canal(texto):
    avisos.append(texto)
    return True


aviso = AlmacenFalso()
voz.generar([por_id[2]], plan_auto, aviso, voz_falsa, AHORA, avisar=silencio, notificar=canal)
assert not avisos, "si todo tiene audio no hay nada que avisar"
agotado = dict(plan_auto, tope_mensual=json.loads(aviso.objetos["estado/uso.json"])["2026-11"] + 10)
inf = voz.generar([corregido, nuevo_a, viejo_a], agotado, aviso, voz_falsa, AHORA, avisar=silencio, notificar=canal)
assert len(avisos) == 1 and inf["aviso_enviado"] and "parte gratuita" in avisos[0] and "2 en cola hasta el 1 de diciembre" in avisos[0] and "Corregidos: 2 ARISE FLUIDS." in avisos[0] and "Nuevos: 113" in avisos[0] and "69" not in avisos[0], avisos
voz.generar([corregido, nuevo_a, viejo_a], agotado, aviso, voz_falsa, AHORA, avisar=silencio, notificar=canal)
assert len(avisos) == 1, "lo ya avisado no se repite"
inf = voz.generar([corregido, nuevo_a, nuevo_b, viejo_a], agotado, aviso, voz_falsa, AHORA, avisar=silencio, notificar=lambda _t: False)
assert inf["aviso"] and not inf["aviso_enviado"] and len(avisos) == 1
voz.generar([corregido, nuevo_a, nuevo_b, viejo_a], agotado, aviso, voz_falsa, AHORA, avisar=silencio, notificar=canal)
assert len(avisos) == 2 and "3 en cola" in avisos[1] and "Nuevos: 230" in avisos[1] and "113" not in avisos[1] and "ARISE" not in avisos[1], "si el aviso no salió se reintenta, y solo nombra lo nuevo"
voz.generar([corregido, nuevo_a, nuevo_b, viejo_a], plan_auto, aviso, voz_falsa, "2026-12-01T10:17:00Z", avisar=silencio, notificar=canal)
assert len(avisos) == 3 and "Ya tienen audio los 3 que esperaban cupo" in avisos[2], avisos[2:]
voz.generar([corregido, nuevo_a, nuevo_b, sin_regla], plan_auto, aviso, voz_falsa, "2026-12-02T10:17:00Z", avisar=silencio, notificar=canal)
assert len(avisos) == 4 and "Sin audio hasta arreglar su lectura: 69" in avisos[3] and "signos sin regla" in avisos[3]
voz.generar([corregido, nuevo_a, nuevo_b, sin_regla], plan_auto, aviso, voz_falsa, "2026-12-03T10:17:00Z", avisar=silencio, notificar=canal)
assert len(avisos) == 4
voz.generar([corregido, nuevo_a, nuevo_b, sin_regla, viejo_b], plan_auto, aviso, lambda _t: (_ for _ in ()).throw(SystemExit("Google Cloud respondió 500")), "2026-12-03T11:00:00Z", avisar=silencio, notificar=canal)
voz.generar([corregido, nuevo_a, nuevo_b, sin_regla, viejo_b], plan_auto, aviso, lambda _t: (_ for _ in ()).throw(SystemExit("Google Cloud respondió 500")), "2026-12-03T12:00:00Z", avisar=silencio, notificar=canal)
assert len(avisos) == 5 and "Falló la generación" in avisos[4] and "500" in avisos[4], "un mismo error se avisa una vez"
inf = voz.generar([corregido, nuevo_a, nuevo_b, viejo_a], agotado, aviso, voz_falsa, "2026-12-04T10:17:00Z", ids=[69], avisar=silencio, notificar=canal)
assert len(avisos) == 5 and not inf["aviso"], "una ejecución parcial, pedida a mano, no avisa"
assert all(len(x) < 700 and x.startswith("Audio de los resúmenes · ") for x in avisos)
# 12. Si cambia solo la forma de leer (una regla, el léxico o la voz) y no el texto publicado, el audio sigue siendo fiel
#     al texto: no se retira; se renueva cuando hay cupo, detrás de todo lo demás. Un cambio de reglas nunca deja de golpe
#     sin audio a muchos resúmenes. Una corrección del texto, en cambio, retira el audio siempre.
regla = AlmacenFalso()
voz.generar(cuatro, plan_auto, regla, voz_falsa, AHORA, avisar=silencio)
viejos = {i: json.loads(regla.objetos[f"resumenes/{i}.json"]) for i in (2, 69, 113, 230)}
assert all(json.loads(regla.objetos["indice.json"])["resumenes"][str(i)]["texto"] == voz.fuente(por_id[i]) for i in viejos), "cada audio anota el texto al que corresponde"
nombre_revista = voz.LEX["revistas"]["NEJM"]
voz.LEX["revistas"]["NEJM"] = "New England Journal of Medicine"
try:
    afectados = [i for i in viejos if voz.huella(por_id[i]) != viejos[i]["huella"]]
    assert len(afectados) >= 2 and 230 not in afectados, "la regla nueva toca a varios resúmenes y no a todos"
    sin_cupo = dict(plan_auto, tope_mensual=json.loads(regla.objetos["estado/uso.json"])["2026-11"])
    antes = len(enviados)
    inf = voz.generar(cuatro + [recien := dict(por_id[149], fecha_publicacion_resumen="2026-11-16")], sin_cupo, regla, voz_falsa, AHORA, avisar=silencio, notificar=canal)
    assert not inf["retirados"] and not inf["generados"] and inf["con_audio"] == 4 and sorted(inf["en_cola"]["renovar"]) == sorted(afectados) and inf["pendientes"] == [149] and len(enviados) == antes
    assert all(json.loads(regla.objetos[f"resumenes/{i}.json"]) == viejos[i] and viejos[i]["audio"] in regla.objetos for i in viejos), "sin cupo, los audios anteriores se siguen ofreciendo"
    assert "Nuevos: 149" in avisos[-1] and not any(str(i) + " " in avisos[-1] for i in afectados), "se avisa del nuevo que espera cupo, no de las renovaciones"
    inf = voz.generar(cuatro + [recien], plan_auto, regla, voz_falsa, AHORA, avisar=silencio)
    assert inf["generados"][0] == 149 and sorted(inf["generados"][1:]) == sorted(afectados) and not inf["retirados"] and not inf["en_cola"]["renovar"] and inf["con_audio"] == 5, "primero lo que no tiene audio; después, las renovaciones"
    for i in afectados:
        nueva = json.loads(regla.objetos[f"resumenes/{i}.json"])
        assert nueva["huella"] == voz.huella(por_id[i]) != viejos[i]["huella"] and nueva["audio"] in regla.objetos and viejos[i]["audio"] not in regla.objetos, "al renovarse, la ficha apunta al audio nuevo y el anterior se borra"
    presentaciones = sum(len(voz.peticiones(por_id[i])[0]) for i in afectados)
    assert inf["caracteres_ejecucion"] == caracteres(por_id[2], por_id[69], por_id[113], por_id[230], recien) - caracteres(por_id[2], por_id[69], por_id[113], por_id[230]) + presentaciones, "de cada renovado solo se paga la parte que cambió (la presentación)"
    assert regla.partes() == {voz.clave_parte(x) for r_ in cuatro + [recien] for x in voz.peticiones(r_)}, "no quedan partes sin dueño"
finally:
    voz.LEX["revistas"]["NEJM"] = nombre_revista
# Lo mismo con un audio de antes de leer por partes: la primera ejecución anota su texto y, desde entonces, queda protegido.
antiguo2 = AlmacenFalso()
antiguo2.objetos.update({ficha_antigua["audio"]: TRAMA * 125, "resumenes/2.json": json.dumps(ficha_antigua).encode(), "indice.json": json.dumps({"resumenes": {"2": ficha_antigua}}).encode()})
voz.generar([por_id[2]], plan_auto, antiguo2, voz_falsa, AHORA, avisar=silencio)
assert json.loads(antiguo2.objetos["indice.json"])["resumenes"]["2"]["texto"] == voz.fuente(por_id[2]) and json.loads(antiguo2.objetos["resumenes/2.json"]) == ficha_antigua
voz.LEX["revistas"]["NEJM"] = "New England Journal of Medicine"
try:
    inf = voz.generar([por_id[2]], dict(plan_auto, tope_mensual=1), antiguo2, voz_falsa, AHORA, avisar=silencio)
    assert not inf["retirados"] and inf["en_cola"]["renovar"] == [2] and not inf["pendientes"] and ficha_antigua["audio"] in antiguo2.objetos, "un audio anterior tampoco se retira por un cambio de reglas"
finally:
    voz.LEX["revistas"]["NEJM"] = nombre_revista
inf = voz.generar([corregido], dict(plan_auto, tope_mensual=1), antiguo2, voz_falsa, AHORA, avisar=silencio)
assert inf["retirados"] == [2] and ficha_antigua["audio"] not in antiguo2.objetos and inf["en_cola"]["corregidos"] == [2], "una corrección del texto lo retira aunque no haya cupo para el nuevo"

plan_real = json.loads((voz.ROOT / "tools" / "voz_plan.json").read_text(encoding="utf-8"))
assert plan_real["automatico"] in (True, False) and 0 < plan_real["tope_mensual"] <= 3900000 and all(int(i) in por_id for i in plan_real["piloto"]), "el plan no pasa de la parte gratuita y su piloto existe"
assert all(int(i) in por_id for i in plan_real.get("prioridad", [])) and 0 <= plan_real.get("reserva_mensual", 0) < plan_real["tope_mensual"] and 0 < plan_real.get("dias_nuevo", 30) <= 92, "prioridad, reserva y días de «nuevo» del plan tienen sentido"
previas = {n: os.environ.pop(n, None) for n in ("GOOGLE_TTS_API_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")}
try:
    with contextlib.redirect_stdout(io.StringIO()) as salida:
        assert voz.cmd_generar(argparse.Namespace(ids="", maximo=None, informe="")) == 1
    assert "R2_BUCKET" in salida.getvalue() and "GOOGLE_TTS_API_KEY" in salida.getvalue(), "sin secretos, generar termina con un mensaje claro y sin tocar nada"
finally:
    os.environ.update({n: v for n, v in previas.items() if v is not None})
# Si el almacén no responde, la orden avisa, deja constancia y termina con error, sin mostrar ninguna clave.
entorno = {"GOOGLE_TTS_API_KEY": "CLAVE-GOOGLE-NO-MOSTRAR", "R2_ACCOUNT_ID": "cuenta", "R2_ACCESS_KEY_ID": "id", "R2_SECRET_ACCESS_KEY": "SECRETO-NO-MOSTRAR", "R2_BUCKET": "cubo", "TELEGRAM_BOT_TOKEN": "TOKEN-NO-MOSTRAR", "TELEGRAM_CHAT_ID": "123"}
previas = {n: os.environ.get(n) for n in entorno}
os.environ.update(entorno)
originales, caidos = (voz.generar, voz.enviar_telegram), []
voz.generar = lambda *_a, **_k: (_ for _ in ()).throw(SystemExit("No se pudo conectar con el almacén: tiempo agotado"))
voz.enviar_telegram = lambda texto, token, chat: caidos.append((texto, token, chat)) or True
try:
    with tempfile.TemporaryDirectory() as carpeta, contextlib.redirect_stdout(io.StringIO()) as salida:
        assert voz.cmd_generar(argparse.Namespace(ids="", maximo=None, informe=carpeta)) == 1
        dejado = json.loads((Path(carpeta) / "informe.json").read_text(encoding="utf-8"))
    assert len(caidos) == 1 and "Falló la generación" in caidos[0][0] and "almacén" in caidos[0][0] and caidos[0][1:] == ("TOKEN-NO-MOSTRAR", "123") and dejado["aviso_enviado"] and "almacén" in dejado["error"]
    assert "NO-MOSTRAR" not in salida.getvalue() + json.dumps(dejado) + caidos[0][0], "ninguna clave sale en el registro, en el informe ni en el aviso"
finally:
    voz.generar, voz.enviar_telegram = originales
    for n, v in previas.items():
        os.environ.pop(n, None) if v is None else os.environ.__setitem__(n, v)
# El envío del aviso nunca muestra la dirección (lleva la clave del canal), ni siquiera cuando falla.
with contextlib.redirect_stdout(io.StringIO()) as salida:
    assert voz.enviar_telegram("prueba", "TOKEN NO\nMOSTRAR", "1") is False
assert "MOSTRAR" not in salida.getvalue() and "No se pudo enviar" in salida.getvalue()

print(f"VOZ PASS: {len(CASOS)} reglas de lectura, {len(MARCAS)} de nombres en inglés, {len(datos)} resúmenes sin perder cifras ni palabras ({total} caracteres para leer; {con_nombres} nombres marcados), guardas, trozos, SSML, plan de muestras, almacén y generación (por partes, orden, cupo sin pago, audios anteriores y avisos)")
