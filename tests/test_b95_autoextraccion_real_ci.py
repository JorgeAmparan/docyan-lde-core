"""
B9.5 — Auto-extracción REAL con el LLM en vivo (autoridad de CI).

Ejercita el camino de extracción contra Gemini 2.5 Flash de verdad (vía LiteLLM),
igual que el resto de la ingesta. Se SKIPEA sin GEMINI_API_KEY real — lo corre CI
con secrets (o el fundador local). Verifica que el extractor de árbol produce un
`DraftArbol` estructuralmente válido desde un documento de troubleshooting real.
"""
from __future__ import annotations

import os

import pytest

pytest.importorskip("litellm")


def _gemini_disponible() -> bool:
    key = os.getenv("GEMINI_API_KEY", "")
    return bool(key) and not key.startswith(("fake", "gen-types", "dummy"))


requires_gemini = pytest.mark.skipif(
    not _gemini_disponible(),
    reason="Auto-extracción real requiere GEMINI_API_KEY real (autoridad de CI).",
)

_DOC_TROUBLESHOOTING = """
# Guía de diagnóstico — Centrífuga Rotina 380

## La centrífuga no arranca

Primero verifique si el panel de control enciende.

- Si el panel NO enciende: la causa probable es falta de alimentación eléctrica.
  Acción: revise el interruptor principal y el breaker del circuito.
- Si el panel enciende pero no gira: verifique si la tapa está cerrada y asegurada.
  - Si la tapa NO cierra: la causa probable es el interlock de seguridad de la tapa.
    Acción: cierre y asegure la tapa hasta escuchar el clic del seguro.
  - Si la tapa cierra correctamente: la causa probable es una falla del motor.
    Acción: contacte a servicio técnico para inspeccionar el motor y el acople.
"""


@requires_gemini
def test_extraccion_real_arbol_troubleshooting():
    from worker.extraction.tree_extractor import extraer_arbol_diagnostico

    draft = extraer_arbol_diagnostico(_DOC_TROUBLESHOOTING)
    assert draft is not None, "el LLM debe producir un árbol desde un doc de troubleshooting"
    assert len(draft.nodos) >= 3, f"árbol con muy pocos nodos: {len(draft.nodos)}"
    # Hay al menos un nodo de pregunta y al menos uno con causa/acción (hoja).
    assert any(n.pregunta for n in draft.nodos)
    assert any(n.causa_probable or n.accion_resolutoria for n in draft.nodos)
    # Al menos una opción enlaza nodos (estructura de árbol, no lista plana).
    assert any(o.siguiente_nodo_id for n in draft.nodos for o in n.opciones)
