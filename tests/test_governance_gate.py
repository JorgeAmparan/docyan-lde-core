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


# ── B7 — gate consulta el GRG extendido F2 (umbral por criticidad) ────────────


def test_gate_f2_criticidad_seguridad_bajo_umbral_escala():
    from app.governance.grg_extendido import GRGExtendido

    gate = GovernanceGate(grg=GRGExtendido())
    d = gate.evaluate(
        permiso_requerido=None, permisos=[], score_confianza=0.90,
        criticidad="seguridad",  # umbral 0.95 → bajo umbral
    )
    assert d.bloqueado
    assert d.escalar_a_revisor
    assert d.razon_codigo == "requiere_revision"
    assert d.disclaimer
    assert d.regla_grg.startswith("R-UC")


def test_gate_f2_criticidad_informativa_bajo_umbral_sirve_con_disclaimer():
    from app.governance.grg_extendido import GRGExtendido

    gate = GovernanceGate(grg=GRGExtendido())
    d = gate.evaluate(
        permiso_requerido=None, permisos=[], score_confianza=0.50,
        criticidad="informativa",  # umbral 0.60 → flag + disclaimer, sirve
    )
    assert d.servir
    assert d.disclaimer


def test_gate_f2_criticidad_sobre_umbral_sirve():
    from app.governance.grg_extendido import GRGExtendido

    gate = GovernanceGate(grg=GRGExtendido())
    d = gate.evaluate(
        permiso_requerido=None, permisos=[], score_confianza=0.97,
        criticidad="seguridad",
    )
    assert d.servir
    assert d.razon_codigo == "ok"


def test_gate_sin_criticidad_usa_camino_estatico():
    # Sin criticidad, aunque haya GRG, opera el umbral estático de B4.
    from app.governance.grg_extendido import GRGExtendido

    gate = GovernanceGate(umbral_confianza=0.7, grg=GRGExtendido())
    d = gate.evaluate(permiso_requerido=None, permisos=[], score_confianza=0.5)
    assert d.bloqueado
    assert d.razon_codigo == "confianza_baja"
