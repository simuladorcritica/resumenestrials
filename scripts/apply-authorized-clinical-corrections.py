import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "resumenes.json"
AUTH_PATH = ROOT / "clinical-correction-authorizations.json"
EXPECTED_BASE = "dd4623443d6df907afdf4a93c7d45420a1cf38d5"
EXPECTED = {"46": {"cuerpo"}, "41": {"cuerpo"}}


def require_authorization():
    manifest = json.loads(AUTH_PATH.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1:
        raise SystemExit("Manifest clínico: schema_version inesperado")
    if manifest.get("base_sha") != EXPECTED_BASE:
        raise SystemExit("Manifest clínico: base_sha distinto del baseline autorizado")
    actual = {
        str(entry.get("id")): set(entry.get("fields") or [])
        for entry in manifest.get("authorizations") or []
    }
    if actual != EXPECTED:
        raise SystemExit(f"Manifest clínico fuera del alcance autorizado: {actual!r}")


def replace_once_or_already(body: str, old: str, new: str, label: str):
    old_count = body.count(old)
    new_count = body.count(new)
    if old_count == 1 and new_count == 0:
        return body.replace(old, new, 1), True
    if old_count == 0 and new_count == 1:
        return body, False
    raise SystemExit(
        f"{label}: no se pudo demostrar un reemplazo único e idempotente "
        f"(old={old_count}, new={new_count})"
    )


def main():
    require_authorization()
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    by_id = {str(item.get("id")): item for item in data}
    if not EXPECTED.keys() <= by_id.keys():
        raise SystemExit("Falta uno de los IDs clínicos autorizados en resumenes.json")

    changed = False

    body46 = by_id["46"]["cuerpo"]
    old46_results = "Sin embargo, el análisis de Kaplan-Meier y el modelo de riesgos proporcionales de Cox sobre la incidencia de LRA a los 28 días mostraron una razón de riesgo (HR) de 1,313 (IC 95% 0,773-2,229, p = 0,313) para el grupo de intervención respecto al control, es decir, numéricamente en sentido contrario al hallazgo de progresión de la LRA a 7 días, aunque sin alcanzar significancia estadística."
    new46_results = "El artículo reporta para la incidencia de LRA a 28 días una razón de riesgo (HR) de 1,313 para intervención frente a control (IC 95% 0,773-2,229; p = 0,313), sin significancia estadística. La parametrización o referencia exacta del modelo de Cox no queda suficientemente clara para resolver por sí sola la dirección clínica del HR; por ello este valor no debe invertirse ni reinterpretarse."
    body46, did = replace_once_or_already(body46, old46_results, new46_results, "ID 46 resultados")
    changed |= did

    old46_bias = "Se detecta una inconsistencia interna relevante que requiere verificación frente a la fuente primaria: mientras que la proporción de progresión de LRA a 7 días (43% frente a 57%) y el análisis de gravedad de la LRA mediante regresión ordinal (p = 0,048) apuntan a un beneficio del grupo de intervención, el análisis de Kaplan-Meier y de Cox sobre la incidencia de LRA a los 28 días muestra el sentido contrario (HR 1,313, numéricamente desfavorable a la intervención), y la propia curva de Kaplan-Meier del artículo (Fig. 3) muestra visualmente una supervivencia libre de LRA menor en el grupo de intervención a partir de aproximadamente el día 7; esta discrepancia entre distintos análisis de desenlaces relacionados con la LRA no se menciona ni se concilia en el texto del artículo."
    new46_bias = "Los desenlaces renales exploratorios no son completamente concordantes entre sí: la progresión de LRA a 7 días fue 43% en intervención frente a 57% en control (RR 0,74; IC 95% 0,52-1,06; p = 0,132) y la regresión ordinal de gravedad favoreció a la intervención (coeficiente = −0,685; p = 0,048), mientras que el artículo reporta para la incidencia de LRA a 28 días un HR de 1,313 para intervención frente a control (IC 95% 0,773-2,229; p = 0,313), sin significancia estadística. La Fig. 3, sin embargo, muestra visualmente la curva identificada como intervención por encima de la de control para supervivencia libre de LRA. Con la información publicada no puede determinarse de forma fiable si esta discordancia depende de la codificación o referencia del modelo de Cox o de la representación gráfica; por ello el HR no debe invertirse ni reinterpretarse. El ensayo fue piloto y no tuvo potencia para establecer eficacia clínica definitiva."
    body46, did = replace_once_or_already(body46, old46_bias, new46_bias, "ID 46 evaluación crítica")
    changed |= did
    by_id["46"]["cuerpo"] = body46

    body41 = by_id["41"]["cuerpo"]
    old41_results = "Conviene advertir que el material suplementario del propio artículo reporta, para este mismo análisis por intención de tratar, medias marginales basales distintas a las de la tabla principal, 237 mmHg en el sillón y 226 mmHg en la cama frente a 228 y 219 mmHg en el cuerpo del artículo, una inconsistencia entre el texto principal y su apéndice que no puede resolverse con la información disponible y que requiere verificación contra la fuente primaria."
    new41_results = "El análisis principal y el análisis de sensibilidad adicional del suplemento presentan medias marginales basales diferentes porque proceden de modelos con ajustes distintos; no deben interpretarse como una inconsistencia numérica del mismo análisis. La Tabla 2 corresponde al modelo principal ajustado por las variables de estratificación, mientras que la Tabla S7 añade ajuste por características clínicas potencialmente desequilibradas; este análisis de sensibilidad mantuvo la dirección y magnitud del efecto."
    body41, did = replace_once_or_already(body41, old41_results, new41_results, "ID 41 resultados")
    changed |= did

    old41_bias = "Además, existen dos inconsistencias internas del propio manuscrito que ameritan verificación contra la fuente primaria: el periodo de reclutamiento se declara distinto entre la sección de métodos y la de resultados, y las medias marginales basales de la relación P/F difieren entre la tabla principal y la tabla equivalente del material suplementario."
    new41_bias = "Persiste, en cambio, una discrepancia documental real en la cronología del reclutamiento: el manuscrito utiliza fechas finales distintas entre secciones y el registro informa una fecha de finalización que no permite identificar por sí sola el último reclutamiento. Esta discrepancia debe conservarse como incertidumbre de cronología y reproducibilidad, sin inferir una fecha correcta no demostrada."
    body41, did = replace_once_or_already(body41, old41_bias, new41_bias, "ID 41 evaluación crítica")
    changed |= did
    by_id["41"]["cuerpo"] = body41

    if changed:
        DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        subprocess.run(["git", "add", "--", "resumenes.json"], cwd=ROOT, check=True)
        print("Correcciones clínicas autorizadas aplicadas y resumenes.json stageado: IDs 46 y 41, campo cuerpo")
    else:
        print("Correcciones clínicas autorizadas ya estaban materializadas; sin cambios adicionales")


if __name__ == "__main__":
    main()
