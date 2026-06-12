"""
F3 — Restricción absoluta #1: la palabra "traducción"/"translation" (sustantivo de
producto) NO aparece en el sitio público (Narrativa Capa 3 · contrato F3 §1).

Guard automatizado en el CI autoritativo (pytest): escanea la superficie PÚBLICA del
frontend — diccionarios i18n + páginas `(public)` + componentes comerciales + demo —
y falla si encuentra el término. El motor de "traducción rigurosa" es servicio futuro
fuera del MVP y NO se menciona ni se insinúa en lo público.

Se excluyen falsos positivos legítimos NO visibles al usuario:
  · El hook `useTranslation` y los imports de `react-i18next` (API de i18n, no copy).
  · Propiedades CSS `transform`/`transition`/`translate(...)`.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

FRONT = Path(__file__).resolve().parents[1] / "frontend" / "src"

# Superficie pública a escanear (lo que ve el visitante del sitio).
PUBLIC_DIRS = [
    FRONT / "i18n" / "locales",
    FRONT / "app" / "(public)",
    FRONT / "components" / "commercial",
    FRONT / "app" / "demo",
]
PUBLIC_FILES = [
    FRONT / "lib" / "demo-data.ts",
]

# Sustantivo de producto prohibido (ES y EN). \btranslation\b evita "translate(" de CSS.
FORBIDDEN = re.compile(r"traducci[oó]n|\btranslation\b", re.IGNORECASE)
# Falsos positivos NO visibles al usuario (API i18n, CSS).
ALLOW = re.compile(r"useTranslation|react-i18next|i18n|transform|transition|translate\(")


def _iter_files():
    exts = {".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx"}
    for d in PUBLIC_DIRS:
        if d.exists():
            for p in d.rglob("*"):
                if p.is_file() and p.suffix in exts:
                    yield p
    for f in PUBLIC_FILES:
        if f.exists():
            yield f


@pytest.mark.skipif(not FRONT.exists(), reason="frontend/src no disponible")
def test_sin_traduccion_en_superficie_publica():
    ofensores: list[str] = []
    for p in _iter_files():
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if FORBIDDEN.search(line) and not ALLOW.search(line):
                ofensores.append(f"{p.relative_to(FRONT)}:{i}: {line.strip()[:120]}")
    assert not ofensores, (
        "Restricción #1 F3: 'traducción'/'translation' como sustantivo de producto "
        "encontrada en superficie pública:\n" + "\n".join(ofensores)
    )
