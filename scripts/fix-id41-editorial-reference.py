import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "resumenes.json"
AUTH = ROOT / "clinical-correction-authorizations.json"
BASE = "dd4623443d6df907afdf4a93c7d45420a1cf38d5"
OLD = "La Tabla 2 corresponde al modelo principal ajustado por las variables de estratificación, mientras que la Tabla S7 añade ajuste por características clínicas potencialmente desequilibradas; este análisis de sensibilidad mantuvo la dirección y magnitud del efecto."
NEW = "La tabla principal corresponde al modelo principal ajustado por las variables de estratificación, mientras que la tabla suplementaria S7 añade ajuste por características clínicas potencialmente desequilibradas; este análisis de sensibilidad mantuvo la dirección y magnitud del efecto."

manifest = json.loads(AUTH.read_text(encoding="utf-8"))
if manifest.get("base_sha") != BASE:
    raise SystemExit("baseline clínico no autorizado")
allowed = {str(x.get("id")): set(x.get("fields") or []) for x in manifest.get("authorizations") or []}
if allowed.get("41") != {"cuerpo"}:
    raise SystemExit("el campo cuerpo del ID 41 no está autorizado exactamente")

data = json.loads(DATA.read_text(encoding="utf-8"))
item = next((x for x in data if str(x.get("id")) == "41"), None)
if item is None:
    raise SystemExit("ID 41 no encontrado")
body = item.get("cuerpo", "")
if body.count(OLD) == 1 and NEW not in body:
    item["cuerpo"] = body.replace(OLD, NEW, 1)
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subprocess.run(["git", "add", "--", "resumenes.json"], cwd=ROOT, check=True)
    print("ID 41: referencia documental normalizada sin ampliar alcance clínico")
elif OLD not in body and body.count(NEW) == 1:
    print("ID 41: referencia documental ya normalizada")
else:
    raise SystemExit("ID 41: reemplazo no único o estado inesperado")
