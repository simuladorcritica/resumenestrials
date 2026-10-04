from __future__ import annotations

import html
import json
import re
import generar_seo as base


def block(item: dict) -> str:
    published = str(item.get('fecha_publicacion_resumen') or '').strip()
    modified = str(item.get('fecha_revision') or item.get('actualizado') or '').strip()
    parts = []
    if published:
        parts.append(f'<span>Publicado en Resúmenes Trials: <time datetime="{html.escape(published)}">{html.escape(base.fecha_humana(published))}</time></span>')
    if modified:
        parts.append(f'<span>Última revisión: <time datetime="{html.escape(modified)}">{html.escape(base.fecha_humana(modified))}</time></span>')
    return '<div class="fechas-editoriales">' + ' · '.join(parts) + '</div>' if parts else ''


def main() -> None:
    items = base.validar(json.loads(base.DATA_PATH.read_text(encoding='utf-8')))
    for item in items:
        path = base.TRIALS_DIR / base.slug_para_item(item) / 'index.html'
        source = path.read_text(encoding='utf-8')
        source = re.sub(r'<div class="fechas-editoriales">.*?</div>', '', source, flags=re.S)
        dates = block(item)
        if dates:
            source = re.sub(r'(<header class="art-head">.*?)(</header>)', lambda m: m.group(1) + dates + m.group(2), source, count=1, flags=re.S)
        path.write_text(source, encoding='utf-8')
    print('Fechas editoriales verificadas en la cabecera de cada trial')


if __name__ == '__main__':
    main()
