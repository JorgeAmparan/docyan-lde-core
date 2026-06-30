"""
Cross-cutting B7 — MO + Governance Gate (GRG extendido F2) + FAT con hash chain.

Ejercita un flujo de consulta desde el Master Orchestrator de B4 y verifica:
  - que el Governance Gate consulta el GRG extendido (umbrales F2 por criticidad),
  - que la decisión es correcta,
  - que los eventos se loggean al FAT con hash chain íntegro.
"""
from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
from app.audit.integrity_checker import verificar_tenant
from app.ingesta.cotizador import Cotizador
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.orchestrator.audit_logger import AuditLogger, FATAuditSink
from app.orchestrator.master_orchestrator import MasterOrchestrator
from app.orchestrator.models import MORequest
from app.orchestrator.pipeline_coordinator import PipelineCoordinator
from app.orchestrator.session_manager import (
    InMemorySessionSpillover,
    InMemorySessionStore,
    SessionManager,
)

AUTH_ADMIN = {"org_id": "t1", "user_id": "u1", "role": "admin", "email": "a@t1.com"}


def _build_mo_con_fat():
    coord = PipelineCoordinator(
        cotizador=Cotizador(),
        dispatcher=JobDispatcher(backend=InMemoryQueueBackend()),
    )
    fat = FATExtendido(InMemoryFATStore())
    sink = FATAuditSink(fat=fat)
    mo = MasterOrchestrator(
        pipeline_coordinator=coord,
        session_manager=SessionManager(
            store=InMemorySessionStore(), spillover=InMemorySessionSpillover()
        ),
        audit_logger=AuditLogger(sink=sink),
    )
    return mo, fat


def test_consulta_critica_confianza_media_escala_y_loggea_al_fat():
    mo, fat = _build_mo_con_fat()
    # Criticidad seguridad (umbral 0.95) con confianza 0.80 → escala a revisor.
    resp = mo.handle_request(
        MORequest(
            auth=AUTH_ADMIN, accion="consulta", texto="¿procedimiento?",
            payload={"score_confianza": 0.80, "criticidad": "seguridad"},
        )
    )
    assert resp.ok is False
    assert resp.servido is False
    assert "revis" in resp.motivo_bloqueo.lower()

    # El FAT registró los eventos del flujo con hash chain íntegro.
    eventos = fat.eventos("t1")
    assert len(eventos) >= 2
    acciones = {e.tipo_evento for e in eventos}
    assert "request_received" in acciones
    assert "governance_decision" in acciones
    # La decisión de gobernanza quedó en familia F7.
    gov = next(e for e in eventos if e.tipo_evento == "governance_decision")
    assert gov.familia.value == "F7"
    assert gov.payload.get("regla_grg", "").startswith("R-UC")
    # Cadena verificable.
    assert verificar_tenant(fat, "t1").integra


def test_consulta_critica_confianza_alta_sirve_y_cadena_integra():
    mo, fat = _build_mo_con_fat()
    resp = mo.handle_request(
        MORequest(
            auth=AUTH_ADMIN, accion="consulta", texto="dato",
            payload={"score_confianza": 0.97, "criticidad": "seguridad"},
        )
    )
    assert resp.ok and resp.servido
    eventos = fat.eventos("t1")
    assert any(e.tipo_evento == "output_served" for e in eventos)
    assert verificar_tenant(fat, "t1").integra


def test_fat_audit_sink_mapea_familias_y_actor_mo():
    fat = FATExtendido(InMemoryFATStore())
    sink = FATAuditSink(fat=fat)
    sink.record("t1", "request_received", "u1", {"canal": "pwa"})
    sink.record("t1", "governance_decision", "u1", {"servir": True})
    sink.record("t1", "sesion_iniciada", "u1", {"sid": "s1"})
    eventos = fat.eventos("t1")
    fam = {e.tipo_evento: e.familia.value for e in eventos}
    assert fam["request_received"] == "F4"
    assert fam["governance_decision"] == "F7"
    assert fam["sesion_iniciada"] == "F9"
    assert all(e.actor_tipo == "mo" for e in eventos)
    assert verificar_tenant(fat, "t1").integra
