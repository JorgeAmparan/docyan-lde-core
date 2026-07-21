"""
ED-1 §4.1 — Máquina de estados del ciclo de vida común de eventos dirigidos.

Transiciones válidas/inválidas + acciones (postponer/comentar self, terminales).
"""
from __future__ import annotations

import pytest

from app.eventos_dirigidos import ciclo_vida as cv


def test_transiciones_validas_declaradas():
    assert cv.transicion_valida(cv.CREADO, cv.NOTIFICADO)
    assert cv.transicion_valida(cv.NOTIFICADO, cv.RECONOCIDO)
    assert cv.transicion_valida(cv.RECONOCIDO, cv.EN_PROCESO)
    assert cv.transicion_valida(cv.EN_PROCESO, cv.RESUELTO)
    assert cv.transicion_valida(cv.NOTIFICADO, cv.ESCALADO)
    assert cv.transicion_valida(cv.ESCALADO, cv.RECONOCIDO)


def test_transiciones_invalidas_son_error_no_silencio():
    # Desde un terminal no hay salida.
    assert not cv.transicion_valida(cv.RESUELTO, cv.NOTIFICADO)
    assert not cv.transicion_valida(cv.CANCELADO, cv.EN_PROCESO)
    # Saltos no declarados.
    assert not cv.transicion_valida(cv.CREADO, cv.RESUELTO)
    with pytest.raises(cv.TransicionInvalida):
        cv.validar_transicion(cv.RESUELTO, cv.NOTIFICADO)
    with pytest.raises(cv.TransicionInvalida):
        cv.validar_transicion("estado_inexistente", cv.NOTIFICADO)


def test_accion_reconocer_transiciona():
    assert cv.aplicar_accion(cv.NOTIFICADO, "reconocer") == cv.RECONOCIDO
    assert cv.aplicar_accion(cv.LEIDO, "reconocer") == cv.RECONOCIDO


def test_accion_resolver_y_suprimir_terminan():
    assert cv.aplicar_accion(cv.EN_PROCESO, "resolver") == cv.RESUELTO
    assert cv.aplicar_accion(cv.NOTIFICADO, "suprimir") == cv.CANCELADO


def test_postponer_requiere_justificacion():
    with pytest.raises(cv.JustificacionRequerida):
        cv.aplicar_accion(cv.NOTIFICADO, "postponer")
    # Con justificación es una transición self (no cambia el estado).
    assert cv.aplicar_accion(cv.NOTIFICADO, "postponer", justificacion="espera insumo") == cv.NOTIFICADO


def test_comentar_es_self_y_no_permitido_en_terminal():
    assert cv.aplicar_accion(cv.RECONOCIDO, "comentar") == cv.RECONOCIDO
    with pytest.raises(cv.TransicionInvalida):
        cv.aplicar_accion(cv.RESUELTO, "comentar")


def test_accion_desconocida():
    with pytest.raises(cv.AccionDesconocida):
        cv.aplicar_accion(cv.NOTIFICADO, "borrar_todo")


def test_accion_invalida_para_estado():
    # No se puede iniciar_proceso desde 'creado' (no reconocido/escalado).
    with pytest.raises(cv.TransicionInvalida):
        cv.aplicar_accion(cv.CREADO, "iniciar_proceso")
