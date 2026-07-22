"""
ED-2 §2.5 — Transiciones de la solicitud REUSAN la máquina de estados común.

Test 4 del contrato: transiciones válidas/inválidas de la solicitud sobre la MISMA
máquina de ED-1 (no se declara una nueva). Cada acción de solicitud mapea a una
transición ya declarada en `ciclo_vida.TRANSICIONES`.
"""

from __future__ import annotations

import pytest

from app.eventos_dirigidos import ciclo_vida
from app.solicitudes import servicio


def test_acciones_solicitud_mapean_a_estados_comunes():
    assert servicio.ACCIONES_SOLICITUD == {
        "marcar_leida": ciclo_vida.LEIDO,
        "iniciar_proceso": ciclo_vida.EN_PROCESO,
        "resolver": ciclo_vida.RESUELTO,
        "cancelar": ciclo_vida.CANCELADO,
    }


def test_transiciones_validas_desde_notificado():
    # notificado → leido → en_proceso → resuelto (todas declaradas en la máquina común).
    assert ciclo_vida.transicion_valida(ciclo_vida.NOTIFICADO, ciclo_vida.LEIDO)
    assert ciclo_vida.transicion_valida(ciclo_vida.LEIDO, ciclo_vida.EN_PROCESO)
    assert ciclo_vida.transicion_valida(ciclo_vida.EN_PROCESO, ciclo_vida.RESUELTO)


def test_transicion_invalida_es_error_explicito():
    # resuelto es terminal: no admite reabrir a en_proceso.
    with pytest.raises(ciclo_vida.TransicionInvalida):
        ciclo_vida.validar_transicion(ciclo_vida.RESUELTO, ciclo_vida.EN_PROCESO)
