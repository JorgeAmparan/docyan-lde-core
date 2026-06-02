"""
Tests Playbooks Nivel A — Consultas guardadas (B8 §B1).

Guardar, listar, renombrar, soft-delete, disparo VIVO (re-evalúa contra el grafo
actual) y naming progresivo (la palabra "Playbook" no aparece antes de tiempo).
"""
from app.playbooks.consultas_guardadas import ConsultasGuardadasService
from app.playbooks.models import InMemoryPlaybookStore
from tests.conftest import EmptyPipelineReader, make_inmemory_mo

AUTH = {"org_id": "test-org", "user_id": "u1", "role": "admin", "email": "a@t.com"}
T = "test-org"


def _svc():
    return ConsultasGuardadasService(InMemoryPlaybookStore())


def test_guardar_y_listar():
    svc = _svc()
    c = svc.guardar(T, "u1", "Par de apriete", "cuál es el par de apriete",
                    "INFORMATIVA", entidad_referenciada_id="e1")
    assert c["id"]
    assert c["disparos_totales"] == 0
    items = svc.listar(T, "u1")
    assert len(items) == 1 and items[0]["nombre"] == "Par de apriete"


def test_renombrar_y_soft_delete():
    svc = _svc()
    c = svc.guardar(T, "u1", "viejo", "q", "INFORMATIVA")
    svc.renombrar(T, c["id"], "nuevo")
    assert svc.obtener(T, c["id"])["nombre"] == "nuevo"
    assert svc.borrar(T, c["id"]) is True
    assert svc.listar(T, "u1") == []


def test_disparo_reevalua_contra_grafo_actual():
    """El disparo NO es snapshot: re-evalúa el grafo en el momento del disparo."""
    class MutableReader(EmptyPipelineReader):
        def __init__(self):
            self.valor = "40"

        def informativa(self, t, term, e):
            return {"especificaciones": [{"nombre": "Par", "valor": self.valor, "unidad": "Nm"}],
                    "termino": "Par", "definicion": None}

    reader = MutableReader()
    mo, _ = make_inmemory_mo(reader=reader)
    svc = ConsultasGuardadasService(InMemoryPlaybookStore())
    c = svc.guardar(T, "u1", "Par", "cuál es el par de apriete", "INFORMATIVA",
                    entidad_referenciada_id="e1")

    r1 = svc.disparar(T, c["id"], mo, AUTH)
    assert r1["resultado"]["payload"]["especificaciones"][0]["valor"] == "40"

    # El grafo cambia entre disparos; el siguiente disparo refleja el cambio.
    reader.valor = "55"
    r2 = svc.disparar(T, c["id"], mo, AUTH)
    assert r2["resultado"]["payload"]["especificaciones"][0]["valor"] == "55"
    assert svc.obtener(T, c["id"])["disparos_totales"] == 2


def test_naming_progresivo_termino_playbook():
    """'Playbook' no se habilita con 0/1 consultas; sí con ≥2 relacionadas."""
    svc = _svc()
    assert svc.termino_playbook_disponible(T, "u1") is False
    svc.guardar(T, "u1", "c1", "q1", "INFORMATIVA", entidad_referenciada_id="e1")
    assert svc.termino_playbook_disponible(T, "u1") is False  # solo 1
    svc.guardar(T, "u1", "c2", "q2", "HISTORIAL", entidad_referenciada_id="e1")
    assert svc.termino_playbook_disponible(T, "u1") is True   # 2 sobre la misma entidad


def test_dos_consultas_no_relacionadas_no_habilitan_termino():
    svc = _svc()
    svc.guardar(T, "u1", "c1", "q1", "INFORMATIVA", entidad_referenciada_id="e1")
    svc.guardar(T, "u1", "c2", "q2", "INFORMATIVA", entidad_referenciada_id="e2")
    assert svc.termino_playbook_disponible(T, "u1") is False
