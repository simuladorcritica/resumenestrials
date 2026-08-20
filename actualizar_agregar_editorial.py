from pathlib import Path

path = Path(__file__).resolve().parent / "agregar.html"
source = path.read_text(encoding="utf-8")
tag = '<script src="/agregar-editorial-dates.js?v=1"></script>'
if tag not in source:
    source = source.replace('</body>', tag + '\n</body>', 1)
path.write_text(source, encoding="utf-8")
print("Panel agregar: fechas editoriales automáticas activadas")
