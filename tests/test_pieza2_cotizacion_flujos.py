"""
Sprint Núcleo Consultable — Pieza 2: cotización en TODOS los flujos, sin auto-confirm.

DOCYAN LDE™ by XCID.

Guard estático (el contrato pide "verificar por grep que no queda ningún
POST /ingesta/documents seguido de /confirm automático"): en cada flujo de carga
(`/documentos`, `/onboarding`, `/admin/ingesta`) la confirmación va por un gesto
EXPLÍCITO del usuario (un handler de aprobación), nunca encadenada al upload. Y
cada flujo presenta la tarjeta de cotización (gate de gasto) antes de ingerir.

Más: edge cases de `contar_figuras` (conteo ligero de figuras para el gate, Pieza 3).
"""
from __future__ import annotations

import pathlib
import re

import pytest

from app.ingesta.text_extract import contar_figuras

ROOT = pathlib.Path(__file__).resolve().parents[1]
FRONT = ROOT / "frontend" / "src" / "app" / "(app)"
FLUJOS = {
    "documentos": FRONT / "documentos" / "page.tsx",
    "onboarding": FRONT / "onboarding" / "page.tsx",
    "admin_ingesta": FRONT / "admin" / "ingesta" / "page.tsx",
}


@pytest.mark.parametrize("nombre", sorted(FLUJOS))
def test_flujo_presenta_cotizacion_y_no_auto_confirma(nombre):
    path = FLUJOS[nombre]
    src = path.read_text(encoding="utf-8")

    # 1) El upload existe (POST /ingesta/documents sin /confirm).
    assert "/ingesta/documents" in src, f"{nombre}: no llama al endpoint de cotización"

    # 2) Hay un gate de cotización (la tarjeta) antes de ingerir: o el componente
    #    compartido QuoteCard, o un estado de cotización pendiente que la dispara.
    gate = any(m in src for m in (
        "QuoteCard", "quote-card", "setQuote", "PendingQuote", "pendingQuote", "fitIds",
    ))
    assert gate, f"{nombre}: no se presenta tarjeta de cotización (gate de gasto)"

    # 3) NO hay auto-confirm: el upload y el /confirm no están encadenados (a ≤6
    #    líneas), lo que delataría un confirm disparado por el propio upload sin
    #    gesto del usuario. Solo se consideran LLAMADAS reales (api.post/postForm),
    #    no comentarios que describan el flujo.
    def _es_llamada(ln: str) -> bool:
        s = ln.strip()
        if s.startswith(("*", "//", "/*", "#")):
            return False
        return ("api.post" in s) or ("api.postForm" in s)

    lineas = src.splitlines()
    up_idx = [i for i, ln in enumerate(lineas)
              if _es_llamada(ln) and "/ingesta/documents" in ln and "/confirm" not in ln]
    conf_idx = [i for i, ln in enumerate(lineas) if _es_llamada(ln) and "/confirm" in ln]
    for u in up_idx:
        for c in conf_idx:
            assert abs(c - u) > 6, (
                f"{nombre}: posible auto-confirm (upload línea {u+1} y /confirm línea "
                f"{c+1} encadenados). La confirmación debe ser gesto del usuario."
            )

    # 4) La confirmación se dispara por interacción de usuario (onClick) — no por el
    #    propio upload. (Refuerza el 3: el gate de gasto requiere un gesto explícito.)
    assert "onClick" in src, f"{nombre}: sin afordancia de usuario para aprobar"


def test_consult_view_envia_documento_id_y_session_id():
    """Pieza 1a + Pieza 6: la vista de consulta manda documento_id (aislamiento) y
    session_id (chat persistente) en cada /mo/query."""
    src = (FRONT / "consult" / "consult-view.tsx").read_text(encoding="utf-8")
    assert "documento_id:" in src, "consult-view no envía documento_id"
    assert "session_id:" in src, "consult-view no envía session_id"
    assert "/mo/sessions" in src, "consult-view no crea sesión de chat persistente"


# ── contar_figuras (Pieza 3 — conteo ligero para el gate) ─────────────────────

def test_contar_figuras_no_pdf_es_cero():
    assert contar_figuras(b"texto plano", "nota.txt") == 0
    assert contar_figuras(b"\x00\x01", "hoja.xlsx") == 0


def test_contar_figuras_pdf_malformado_no_lanza_y_es_cero():
    # Best-effort: un PDF ilegible no rompe el cotizador; devuelve 0 (el worker re-mide).
    assert contar_figuras(b"%PDF-1.4 basura no valida", "roto.pdf") == 0
