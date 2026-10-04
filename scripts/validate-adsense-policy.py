"""Verify the published outputs and prevent AdSense reinsertion on private/legal routes."""
from html.parser import HTMLParser
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import aplicar_experiencia_futura as future

ROOT = future.ROOT
EXCLUDED_FILES = (
    'login.html', 'registro.html', 'recuperar.html', 'cuenta.html',
    'biblioteca.html', 'privacidad.html', 'privacidad/index.html',
    'terminos/index.html',
    'agregar.html', 'medicina-interna/hematologia-oncologia/index.html',
)
CLIENT = 'ca-pub-3132744538918477'
URL = f'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={CLIENT}'


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.ads = []

    def handle_starttag(self, tag, attrs):
        if tag == 'head':
            self.in_head = True
        attrs = dict(attrs)
        if tag == 'script' and 'adsbygoogle.js' in attrs.get('src', ''):
            self.ads.append((attrs, self.in_head))

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False


def verify(path, source, allowed):
    scripts = Scripts()
    scripts.feed(source)
    if allowed:
        assert len(scripts.ads) == 1, f'{path}: expected exactly one AdSense loader'
        attrs, in_head = scripts.ads[0]
        assert attrs['src'] == URL and in_head, f'{path}: wrong publisher or placement'
        assert attrs.get('crossorigin') == 'anonymous', f'{path}: missing crossorigin'
        assert source.count(URL) == 1, f'{path}: duplicate publisher URL'
    else:
        assert not scripts.ads, f'{path}: forbidden AdSense loader'
        assert 'adsbygoogle' not in source and CLIENT not in source, f'{path}: forbidden AdSense bootstrap'


assert future.ADSENSE_CLIENT == CLIENT and future.ADSENSE_URL == URL
assert (ROOT / 'ads.txt').read_text(encoding='utf-8').strip() == (
    'google.com, pub-3132744538918477, DIRECT, f08c47fec0942fa0'
), 'ads.txt differs from the authorized record'
paths = [p for p in future.candidates() if p.is_file()]
assert len(paths) >= 50
for name in EXCLUDED_FILES:
    assert ROOT / name in paths, f'{name}: missing regeneration candidate'
    assert not future.adsense_allowed(ROOT / name), f'{name}: must remain excluded'
for name in ['_includes/index-source.html', 'medicina-critica/index.html',
             'medicina-interna/index.html', 'metodologia/index.html', 'equipo-editorial/index.html']:
    assert ROOT / name in paths and future.adsense_allowed(ROOT / name), f'{name}: must retain AdSense'
for path in paths:
    verify(path, path.read_text(encoding='utf-8'), future.adsense_allowed(path))

reader = (ROOT / 'resumen.html').read_text(encoding='utf-8')
assert '/resumen.html' in future.ADSENSE_DEFERRED_ROUTES
assert "import('/reader-advertising.js')" in reader, 'Reader must keep the conditional integration'
assert reader.index("import('/reader-advertising.js')") > reader.index('if(!dato){noEncontrado();return;}')
assert '<meta name="robots" content="noindex,follow">' in (ROOT / 'agregar.html').read_text(encoding='utf-8')

# Run this after the full generator pipeline in CI. A second injection must be
# byte-identical, so missing assets or advertising reintroduced by a build fail.
before = {p: p.read_bytes() for p in paths}
for _ in range(2):
    future.main()
    assert all(p.read_bytes() == data for p, data in before.items()), 'Regeneration is not idempotent'

# Simulate a stale generated HTML file containing the old loader. Repair must
# remove only that loader, preserving every other script and all page text.
try:
    with TemporaryDirectory() as directory:
        future.ROOT = Path(directory)
        for name in (*EXCLUDED_FILES, 'resumen.html'):
            path = future.ROOT / name
            path.parent.mkdir(parents=True, exist_ok=True)
            clean = (ROOT / name).read_text(encoding='utf-8')
            path.write_text(clean.replace('</head>', future.ADSENSE_SCRIPT + '</head>', 1), encoding='utf-8')
            assert future.inject(path), f'{name}: did not remove a reintroduced loader'
            assert path.read_text(encoding='utf-8') == clean, f'{name}: unrelated content changed'
            assert not future.inject(path), f'{name}: repair is not idempotent'
finally:
    future.ROOT = ROOT

print(f'ADSENSE POLICY PASS: {len(paths)} outputs, {len(EXCLUDED_FILES)} excluded files, idempotence and reinsertion protection')
