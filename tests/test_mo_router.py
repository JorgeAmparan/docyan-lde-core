"""
Tests del router del Master Orchestrator (B4 §1).

Sesiones (crear/obtener/transferir/cerrar + aislamiento por tenant) e ingesta vía
MO (cotizador-gate). MO con backends en memoria vía dependency_overrides.
"""
import pytest

from app.api.routers import mo as mo_router
from app.ingesta.cotizador import Cotizador
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.orchestrator.audit_logger import AuditLogger, InMemoryAuditSink
from app.orchestrator.master_orchestrator import MasterOrchestrator
from app.orchestrator.models import Canal, SessionType
from app.orchestrator.pipeline_coordinator import PipelineCoordinator
from app.orchestrator.session_manager import (
    InMemorySessionSpillover,
    InMemorySessionStore,
    SessionManager,
)

HEADERS = {"X-API-Key": "test-api-key-for-pytest"}  # → org=test-org, role=admin


def _build_mo():
    coord = PipelineCoordinator(
        cotizador=Cotizador(),
        dispatcher=JobDispatcher(backend=InMemoryQueueBackend()),
    )
    return MasterOrchestrator(
        pipeline_coordinator=coord,
        session_manager=SessionManager(
            store=InMemorySessionStore(), spillover=InMemorySessionSpillover()
        ),
        audit_logger=AuditLogger(sink=InMemoryAuditSink()),
    )


@pytest.fixture
def mo_client(test_client):
    from app.api.main import app

    mo = _build_mo()
    app.dependency_overrides[mo_router.get_mo] = lambda: mo
    yield test_client, mo
    app.dependency_overrides.pop(mo_router.get_mo, None)


def test_crear_y_obtener_sesion(mo_client):
    client, mo = mo_client
    r = client.post("/mo/sessions",
                    json={"session_type": "consulta", "canal": "pwa",
                          "initial_state": {"k": "v"}},
                    headers=HEADERS)
    assert r.status_code == 200
    sid = r.json()["session_id"]
    g = client.get(f"/mo/sessions/{sid}", headers=HEADERS)
    assert g.status_code == 200
    assert g.json()["state"] == {"k": "v"}


def test_transferir_y_cerrar_sesion(mo_client):
    client, mo = mo_client
    sid = client.post("/mo/sessions",
                      json={"session_type": "consulta", "canal": "pwa",
                            "initial_state": {"ctx": "x"}},
                      headers=HEADERS).json()["session_id"]
    t = client.post(f"/mo/sessions/{sid}/transfer", json={"canal": "whatsapp"},
                    headers=HEADERS)
    assert t.status_code == 200
    assert t.json()["canal"] == "whatsapp"
    assert t.json()["state"]["ctx"] == "x"
    c = client.post(f"/mo/sessions/{sid}/close", json={"reason": "fin"}, headers=HEADERS)
    assert c.status_code == 200
    assert c.json()["spillover"] is True


def test_sesion_de_otro_tenant_no_se_revela(mo_client):
    client, mo = mo_client
    # Sesión sembrada para OTRO tenant directamente en el manager del MO.
    otro_sid = mo.session_manager.create_session(
        "otro-tenant", "u9", SessionType.consulta, Canal.pwa
    )
    r = client.get(f"/mo/sessions/{otro_sid}", headers=HEADERS)
    assert r.status_code == 404


def test_ingesta_via_mo_cotiza_y_confirma(mo_client):
    client, mo = mo_client
    r = client.post("/mo/ingesta",
                    json={"texto_documento": "Documento " * 80, "nombre_archivo": "x.pdf"},
                    headers=HEADERS)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["requiere_confirmacion"] is True
    assert data["cotizacion"]["tiempo_estimado_seg"] > 0
    job_id = data["job_id"]
    c = client.post(f"/mo/ingesta/{job_id}/confirm", headers=HEADERS)
    assert c.status_code == 200
    assert c.json()["status"] == "queued"


def test_query_via_mo(mo_client):
    client, mo = mo_client
    r = client.post("/mo/query",
                    json={"texto": "hola", "canal": "pwa", "score_confianza": 0.95},
                    headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["servido"] is True
