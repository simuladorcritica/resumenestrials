#!/usr/bin/env python3
"""Fallback de solo lectura para QA local cuando pdftotext no está instalado."""

from pathlib import Path
import sys
import runpy

from pypdf import PdfReader


def main() -> int:
    if '--before' in sys.argv:
        runpy.run_path(str(Path(__file__).with_name('verify-pdf-justification.py')), run_name='__main__')
        return 0
    if len(sys.argv) != 2:
        print("Uso: extract-pdf-text.py archivo.pdf", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    reader = PdfReader(path)
    print("\n".join(page.extract_text() or "" for page in reader.pages))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
