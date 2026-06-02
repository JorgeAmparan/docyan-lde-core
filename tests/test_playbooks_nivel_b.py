"""
Tests Playbooks Nivel B — Secuencia de consultas (B8 §B2).

Crear desde ≥2 consultas guardadas, disparar con vista unificada + provenance por
paso (+ FAT padre/por-paso), reordenar, y cascade-delete protection (bloquear).
"""
import pytest

from app.orchestrator.audit_logger import AuditLogger, InMemoryAuditSink
from app.playbooks.consultas_guardadas import ConsultasGuardadasService
from app.playbooks.models import InMemoryPlaybookStore
from app.playbooks.playbooks_core import PlaybooksService
from tests.conftest import make_inmemory_mo

AUTH = {"org_id": "test-org", "user_id": "u1", "role": "admin", "email": "a@t.com"}
T = "test-org"


def _setup():
    store = InMemoryPlaybookStore()
    consultas = ConsultasGuardadasService(store)
    playbooks = PlaybooksService(store)
    c1 = consultas.guardar(T, "u1", "Especificación", "cuál es el par de apriete",
                           "INFORMATIVA", entidad_referenciada_id="e1")
    c2 = consultas.guardar(T, "u1", "Historial", "historial de calibraciones",
                           "HISTORIAL", entidad_referenciada_id="e1")
    return store, consultas, playbooks, c1, c2


def test_crear_playbook_de_dos_pasos():
    _store, _c, playbooks, c1, c2 = _setup()
    pb = playbooks.crear(T, "u1", "Apertura de turno", pasos=[
        {"consulta_guardada_id": c1["id"], "nota_paso": "primero"},
        {"consulta_guardada_id": c2["id"], "nota_paso": "luego"},
    ])
    assert len(pb["pasos"]) == 2
    assert [p["orden"] for p in pb["pasos"]] == [1, 2]


def test_disparar_playbook_vista_unificada_con_provenance_y_fat():
    _store, _c, playbooks, c1, c2 = _setup()
    pb = playbooks.crear(T, "u1", "Recorrido", pasos=[
        {"consulta_guardada_id": c1["id"]},
        {"consulta_guardada_id": c2["id"]},
    ])
    mo, _ = make_inmemory_mo()
    sink = InMemoryAuditSink()
    audit = AuditLogger(sink=sink)
    res = playbooks.disparar(T, pb["id"], mo, AUTH, audit_logger=audit, actor="u1")
    vista = res["vista_unificada"]
    assert len(vista) == 2
    assert vista[0]["tipo_intencion"] == "INFORMATIVA"
    assert vista[1]["tipo_intencion"] == "HISTORIAL"
    assert all("provenance" in paso for paso in vista)
    # FAT: un padre del Playbook + uno por paso.
    acciones = [e["action"] for e in sink.entries]
    assert acciones.count("playbook_paso_disparado") == 2
    assert acciones.count("playbook_disparado") == 1
    assert res["playbook"]["disparos_totales"] == 1


def test_reordenar_pasos():
    _store, _c, playbooks, c1, c2 = _setup()
    pb = playbooks.crear(T, "u1", "Recorrido", pasos=[
        {"consulta_guardada_id": c1["id"]},
        {"consulta_guardada_id": c2["id"]},
    ])
    actualizado = playbooks.actualizar(T, pb["id"], pasos=[
        {"consulta_guardada_id": c2["id"], "orden": 1},
        {"consulta_guardada_id": c1["id"], "orden": 2},
    ])
    primero = actualizado["pasos"][0]
    assert primero["consulta_guardada_id"] == c2["id"]


def test_cascade_delete_protege_consulta_en_uso():
    store, consultas, playbooks, c1, c2 = _setup()
    playbooks.crear(T, "u1", "Recorrido", pasos=[{"consulta_guardada_id": c1["id"]}])
    # Borrar una consulta en uso por un Playbook activo se BLOQUEA (política).
    with pytest.raises(ValueError):
        consultas.borrar(T, c1["id"])
    # Una consulta NO usada sí se puede borrar.
    assert consultas.borrar(T, c2["id"]) is True
