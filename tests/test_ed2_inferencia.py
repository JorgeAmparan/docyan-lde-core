"""
ED-2 §2.3/§2.4 — Inferencia determinística contexto→tipo + marcado accionable.

Test 2 del contrato: el mapeo produce el tipo correcto; un dato no mapeado no lleva
flag (no-sobre-marcado, evidencia §5.4).
"""

from __future__ import annotations

from app.solicitudes import inferencia


def test_mapeo_produce_tipo_correcto():
    assert inferencia.inferir_tipo("INFORMATIVA", "especificacion") == "cotizacion"
    assert inferencia.inferir_tipo("INFORMATIVA", "ficha_tecnica") == "cotizacion"
    assert inferencia.inferir_tipo("ALERTAS", "calibracion") == "mantenimiento"
    assert inferencia.inferir_tipo("HISTORIAL", "documento_proveedor") == "servicio"


def test_dato_no_mapeado_sin_flag():
    # Un manual técnico consultado informativamente NO es accionable (sin regla).
    assert inferencia.inferir_tipo("INFORMATIVA", "manual_tecnico") is None
    assert inferencia.es_accionable("INFORMATIVA", "manual_tecnico") is False
    # Falta de datos de contexto ⇒ nunca accionable.
    assert inferencia.inferir_tipo(None, "especificacion") is None
    assert inferencia.inferir_tipo("INFORMATIVA", None) is None


def test_intencion_case_insensitive():
    assert inferencia.inferir_tipo("informativa", "especificacion") == "cotizacion"


def test_mapeo_versionado_y_volcable():
    assert inferencia.MAPEO_VERSION
    reglas = inferencia.reglas()
    assert reglas and all(
        {"tipo_intencion", "documento_tipo", "tipo_sugerido"} <= r.keys() for r in reglas
    )
