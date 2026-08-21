from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent
LEGACY_STYLES = [
    '<link rel="stylesheet" href="/future-experience.css?v=1">',
    '<link rel="stylesheet" href="/future-experience-patch.css?v=1">',
    '<link rel="stylesheet" href="/global-search.css?v=1">',
]
STYLES = ['<link rel="stylesheet" href="/site-runtime.css?v=20260821">']
ADSENSE_CLIENT = 'ca-pub-3132744538918477'
ADSENSE_URL = f'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_CLIENT}'
ADSENSE_SCRIPT = f'<script async src="{ADSENSE_URL}" crossorigin="anonymous"></script>'

LEGACY_HOME_PRIVACY = (
    '<p>Este sitio no recopila datos personales de sus visitantes ni utiliza cookies de seguimiento o publicidad. '
    'El proveedor de alojamiento puede registrar datos técnicos, como la dirección IP, en sus propios registros de seguridad. '
    'Al escribirnos por correo o Telegram compartes los datos que decidas incluir en tu mensaje; los usamos únicamente para responderte y no los cedemos a terceros. '
    'Si más adelante se incorporan formularios o registro, se publicará un aviso de privacidad detallado antes de recabar más datos.</p>'
)
ADSENSE_HOME_PRIVACY = (
    '<p>Este sitio utiliza <strong>Google AdSense</strong> para gestionar publicidad. Google y sus socios pueden utilizar cookies, '
    'almacenamiento local u otros identificadores para mostrar, medir y limitar anuncios, prevenir fraude y, según la configuración regional '
    'y el consentimiento aplicable, personalizar publicidad. Esto puede implicar el tratamiento de datos técnicos como la dirección IP, '
    'información del dispositivo o navegador e interacciones con anuncios. Las funciones de cuenta y el tratamiento de datos personales se '
    'describen en el <a href="/privacidad.html">Aviso de privacidad</a>. Al escribirnos por correo o Telegram compartes los datos que decidas '
    'incluir en tu mensaje; los usamos únicamente para responderte.</p>'
)
LEGACY_PROVIDER_NOTICE = (
    '<h2>Proveedores tecnológicos</h2><p>La autenticación y la base de datos de perfiles se gestionan mediante <strong>Supabase</strong>. '
    'El sitio se publica mediante infraestructura de <strong>GitHub</strong>. Cuando aceptas recibir avisos de nuevos resúmenes, el envío de esos '
    'mensajes se procesa mediante <strong>Resend</strong>, proveedor de infraestructura de correo electrónico. Para efectuar el envío, Resend recibe '
    'la información estrictamente necesaria, como la dirección de correo del destinatario y el contenido del mensaje. Estos proveedores pueden '
    'procesar información técnica en los países donde operan sus servicios, conforme a sus propias condiciones y medidas de seguridad.</p>'
)
ADSENSE_PROVIDER_NOTICE = (
    '<h2>Proveedores tecnológicos</h2><p>La autenticación y la base de datos de perfiles se gestionan mediante <strong>Supabase</strong>. '
    'El sitio se publica mediante infraestructura de <strong>GitHub</strong>. Cuando aceptas recibir avisos de nuevos resúmenes, el envío de esos '
    'mensajes se procesa mediante <strong>Resend</strong>, proveedor de infraestructura de correo electrónico. Para efectuar el envío, Resend recibe '
    'la información estrictamente necesaria, como la dirección de correo del destinatario y el contenido del mensaje. El sitio también utiliza '
    '<strong>Google AdSense</strong> para gestionar publicidad; Google y sus socios pueden tratar información técnica y utilizar cookies u otros '
    'identificadores para servir, medir y proteger la publicidad, de acuerdo con la configuración regional y el consentimiento aplicable. Puedes '
    'consultar la <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Política de Privacidad de Google</a>. Estos proveedores '
    'pueden procesar información técnica en los países donde operan sus servicios, conforme a sus propias condiciones y medidas de seguridad.</p>'
)
LEGACY_COOKIE_NOTICE = (
    '<h2>Cookies y navegación pública</h2><p>La navegación pública no requiere una cuenta ni utiliza cookies de publicidad. '
    'El sistema de autenticación puede utilizar almacenamiento local u otros mecanismos técnicos indispensables para mantener una sesión iniciada.</p>'
)
ADSENSE_COOKIE_NOTICE = (
    '<h2>Cookies, publicidad y navegación pública</h2><p>La navegación pública no requiere una cuenta. Para financiar el proyecto, el sitio utiliza '
    '<strong>Google AdSense</strong>. Google y sus socios pueden utilizar cookies, almacenamiento local u otros identificadores para mostrar anuncios, '
    'medir su rendimiento, limitar la frecuencia, detectar fraude y, cuando corresponda, personalizar la publicidad. La información tratada puede '
    'incluir dirección IP, características del dispositivo y navegador e interacciones con anuncios. La disponibilidad y personalización de anuncios '
    'puede variar según la región y el consentimiento aplicable. Puedes administrar preferencias publicitarias desde '
    '<a href="https://myadcenter.google.com/" target="_blank" rel="noopener">Mi centro de anuncios de Google</a>. El sistema de autenticación también '
    'puede utilizar almacenamiento local u otros mecanismos técnicos indispensables para mantener una sesión iniciada.</p>'
)
PRIVACY_REPLACEMENTS = [
    (LEGACY_HOME_PRIVACY, ADSENSE_HOME_PRIVACY),
    (LEGACY_PROVIDER_NOTICE, ADSENSE_PROVIDER_NOTICE),
    (LEGACY_COOKIE_NOTICE, ADSENSE_COOKIE_NOTICE),
]

FINAL_SCRIPT_V1 = '<script src="/future-experience-final.js?v=1" defer></script>'
FINAL_SCRIPT_V2 = '<script src="/future-experience-final.js?v=2" defer></script>'
FINAL_SCRIPT_V3 = '<script src="/future-experience-final.js?v=3" defer></script>'
GLOBAL_SEARCH = '<script src="/global-search.js?v=1" defer></script>'
FIX_SCRIPT_V4 = '<script src="/future-experience-fix-v4.js?v=1" defer></script>'
FIX_SCRIPT_V4_COMPAT = '<script src="/future-experience-fix-v4-compat.js?v=1" defer></script>'
LEGACY_UNIFIER_V4 = '<script src="/legacy-unifier-v4.js?v=1" defer></script>'
ENDMATTER_V7 = '<script src="/reader-endmatter-v7.js?v=1" defer></script>'
READER_UI_V8 = '<script src="/reader-ui-v8.js?v=1" defer></script>'
HOME_DOWNLOADS_V8 = '<script src="/home-downloads-v8.js?v=1" defer></script>'
READER_CONTROLS_V9_OLD = '<script src="/reader-controls-v9.js?v=1" defer></script>'
READER_CONTROLS_V9 = '<script src="/reader-controls-v9.js?v=2" defer></script>'
SCRIPTS = [
    '<script src="/site-runtime.js?v=20260821" defer></script>',
]
LEGACY_SCRIPTS = [
    '<script src="/future-experience.js?v=1" defer></script>', GLOBAL_SEARCH,
    FINAL_SCRIPT_V1, FINAL_SCRIPT_V2, FINAL_SCRIPT_V3, FIX_SCRIPT_V4,
    FIX_SCRIPT_V4_COMPAT, LEGACY_UNIFIER_V4, ENDMATTER_V7, READER_UI_V8,
    HOME_DOWNLOADS_V8, READER_CONTROLS_V9_OLD, READER_CONTROLS_V9,
]


def inject(path: Path) -> bool:
    if not path.is_file():
        return False
    source = path.read_text(encoding="utf-8")
    changed = False

    for old in LEGACY_STYLES + LEGACY_SCRIPTS:
        if old in source:
            source = source.replace(old, '')
            changed = True

    for old in (FINAL_SCRIPT_V1, FINAL_SCRIPT_V2):
        if old in source:
            source = source.replace(old, FINAL_SCRIPT_V3)
            changed = True

    if READER_CONTROLS_V9_OLD in source:
        source = source.replace(READER_CONTROLS_V9_OLD, READER_CONTROLS_V9)
        changed = True

    for old, new in PRIVACY_REPLACEMENTS:
        if old in source:
            source = source.replace(old, new)
            changed = True

    if '</head>' in source:
        if ADSENSE_URL not in source:
            source = source.replace('</head>', ADSENSE_SCRIPT + '</head>', 1)
            changed = True
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
