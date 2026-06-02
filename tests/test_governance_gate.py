"""Tests del Governance Gate del MO (B4 §5, responsabilidad 5)."""
from app.orchestrator.governance_gate import GovernanceGate


def test_sin_permiso_bloquea():
    gate = GovernanceGate()
    d = gate.evaluate(permiso_requerido="ingesta", permisos=["consulta"])
    assert d.bloqueado
    assert d.razon_codigo == "sin_permiso"


def test_con_permiso_pasa():
    gate = GovernanceGate()
    d = gate.evaluate(permiso_requerido="consulta", permisos=["consulta"])
    assert d.servir
    assert d.razon_codigo == "ok"


def test_confianza_baja_frena_alucinacion():
    gate = GovernanceGate(umbral_confianza=0.7)
    d = gate.evaluate(permiso_requerido=None, permisos=[], score_confianza=0.5)
    assert d.bloqueado
    assert d.razon_codigo == "confianza_baja"


def test_confianza_alta_sirve():
    gate = GovernanceGate(umbral_confianza=0.7)
    d = gate.evaluate(permiso_requerido=None, permisos=[], score_confianza=0.95)
    assert d.servir


def test_segmento_critico_confianza_media_escala_a_revisor():
    gate = GovernanceGate(umbral_confianza=0.7, umbral_critico=0.85)
    d = gate.evaluate(
        permiso_requerido=None, permisos=[], score_confianza=0.8, segmento_critico=True
    )
    assert d.bloqueado
    assert d.escalar_a_revisor
    assert d.razon_codigo == "requiere_revision"


def test_segmento_no_critico_confianza_media_sirve():
    gate = GovernanceGate(umbral_confianza=0.7, umbral_critico=0.85)
    d = gate.evaluate(
        permiso_requerido=None, permisos=[], score_confianza=0.8, segmento_critico=False
    )
    assert d.servir


def test_sin_score_pasa_contenido_determinista():
    gate = GovernanceGate()
    d = gate.evaluate(permiso_requerido=None, permisos=[], score_confianza=None)
    assert d.servir
