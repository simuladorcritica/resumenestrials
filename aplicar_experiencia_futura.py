from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
STYLES = [
    '<link rel="stylesheet" href="/future-experience.css?v=1">',
    '<link rel="stylesheet" href="/future-experience-patch.css?v=1">',
]
FINAL_SCRIPT_V1 = '<script src="/future-experience-final.js?v=1" defer></script>'
FINAL_SCRIPT_V2 = '<script src="/future-experience-final.js?v=2" defer></script>'
FINAL_SCRIPT_V3 = '<script src="/future-experience-final.js?v=3" defer></script>'
SCRIPTS = [
    '<script src="/future-experience.js?v=1" defer></script>',
    FINAL_SCRIPT_V3,
]


def inject(path: Path) -> bool:
    if not path.is_file():
        return False
    source = path.read_text(encoding="utf-8")
    changed = False

    # Cache-bust explícito del ajuste final. Sustituye versiones anteriores,
    # no las duplica, para que navegador/CDN carguen inmediatamente el fix.
    for old in (FINAL_SCRIPT_V1, FINAL_SCRIPT_V2):
        if old in source:
            source = source.replace(old, FINAL_SCRIPT_V3)
            changed = True

    if '</head>' in source:
        missing = ''.join(style for style in STYLES if style not in source)
        if missing:
            source = source.replace('</head>', missing + '</head>', 1)
            changed = True
    if '</body>' in source:
        missing_scripts = ''.join(script for script in SCRIPTS if script not in source)
        if missing_scripts:
            source = source.replace('</body>', missing_scripts + '</body>', 1)
            changed = True
    if changed:
        path.write_text(source, encoding="utf-8")
    return changed


def candidates() -> list[Path]:
    paths = [
        ROOT / '_includes' / 'index-source.html',
        ROOT / 'resumen.html',
        ROOT / 'login.html',
        ROOT / 'registro.html',
        ROOT / 'recuperar.html',
        ROOT / 'cuenta.html',
        ROOT / 'biblioteca.html',
        ROOT / 'privacidad.html',
        ROOT / 'agregar.html',
        ROOT / 'metodologia' / 'index.html',
        ROOT / 'equipo-editorial' / 'index.html',
    ]
    paths.extend(sorted((ROOT / 'trials').glob('*/index.html')))
    paths.extend(sorted((ROOT / 'medicina-critica').glob('**/index.html')))
    paths.extend(sorted((ROOT / 'medicina-interna').glob('**/index.html')))
    seen: set[Path] = set()
    return [p for p in paths if not (p in seen or seen.add(p))]


def main() -> None:
    touched = 0
    checked = 0
    for path in candidates():
        if not path.is_file():
            continue
        checked += 1
        touched += int(inject(path))
    print(f'Experiencia futura: {checked} páginas verificadas, {touched} actualizadas')


if __name__ == '__main__':
    main()
