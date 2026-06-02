"""
Tests end-to-end del Master Orchestrator (B4 §1).

Ejercita el MO con dependencias en memoria: ruteo, Governance Gate, cotizador
integrado (gate sin bypass), sesiones con transición de canal y FAT logging.
"""
import pytest

from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore
from app.ingesta.cotizador import Cotizador
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.orchestrator.audit_logger import AuditLogger, InMemoryAuditSink
from app.orchestrator.master_orchestrator import MasterOrchestrator
from app.orchestrator.models import Canal, MORequest, RequestKind, SessionType
from app.orchestrator.pipeline_coordinator import PipelineCoordinator
from app.orchestrator.session_manager import (
    InMemorySessionSpillover,
    InMemorySessionStore,
    SessionManager,
)


class _EmptyReader:
    """Reader sintético vacío (B8): pipelines producen payloads válidos sin DKG."""

    def informativa(self, t, term, e):
        return {"especificaciones": [], "termino": None, "definicion": None}

    def procedimiento(self, t, term, e):
        return {"procedimiento_id": None, "titulo": "", "pasos": []}

    def recurso_visual(self, t, term, e):
        return {"recurso_id": None, "titulo": "", "etiquetas": [], "leyenda": []}

    def video(self, t, term, e):
        return {"recurso_id": None, "titulo": "", "capitulos": [],
                "subtitulos": [], "transcripcion": None}

    def arbol_diagnostico(self, t, term, e, n):
        return {"arbol_id": None, "titulo": "", "nodo_actual_id": None,
                "pregunta": None, "opciones": []}

    def historial(self, t, e):
        return {"eventos": [], "certificados": [], "observaciones": [], "mediciones": []}

    def alertas(self, t, e):
        return []

    def comparar(self, t, est, i, d):
        return {"izquierda": {}, "derecha": {}}


def build_mo(saldo: float = 100.0):
    budget_store = InMemoryBudgetStore()
    BudgetManager(store=budget_store).ensure_budget("t1", saldo_inicial_usd=saldo)
    cotizador = Cotizador(budget_manager=BudgetManager(store=budget_store))
    queue = InMemoryQueueBackend()
    dispatcher = JobDispatcher(backend=queue)
    coord = PipelineCoordinator(
        cotizador=cotizador, dispatcher=dispatcher, graph_reader=_EmptyReader()
    )
    sink = InMemoryAuditSink()
    sessions = SessionManager(
        store=InMemorySessionStore(),
        spillover=InMemorySessionSpillover(),
    )
    mo = MasterOrchestrator(
        pipeline_coordinator=coord,
        session_manager=sessions,
        audit_logger=AuditLogger(sink=sink),
    )
    return mo, sink, queue


AUTH_ADMIN = {"org_id": "t1", "user_id": "u1", "role": "admin", "email": "a@t1.com"}
AUTH_VIEWER = {"org_id": "t1", "user_id": "u2", "role": "viewer", "email": "v@t1.com"}


def test_fat_logging_cada_request_deja_entrada():
    mo, sink, _ = build_mo()
    resp = mo.handle_request(MORequest(auth=AUTH_ADMIN, accion="consulta", texto="hola"))
    assert resp.ok
    assert len(sink.entries) >= 1
    assert all(e["tenant_id"] == "t1" for e in sink.entries)
    assert any(e["action"] == "request_received" for e in sink.entries)


def test_ingesta_saldo_suficiente_aprueba_y_confirma_encola():
    mo, sink, queue = build_mo(saldo=100.0)
    resp = mo.handle_request(
        MORequest(
            auth=AUTH_ADMIN, accion="ingesta",
            payload={"texto_documento": "Documento de prueba " * 50,
                     "nombre_archivo": "x.pdf"},
        )
    )
    assert resp.kind == RequestKind.ingesta
    cot = resp.data["cotizacion"]
    assert resp.data["requiere_confirmacion"] is True
    assert cot["aprobado"] is True
    assert cot["costo_total_usd"] > 0
    assert cot["tiempo_estimado_seg"] > 0  # estimación de TIEMPO incluida (Adenda §8)
    # Nada encolado todavía (gate sin bypass).
    assert queue.queue_length() == 0
    # Confirmar → encola.
    out = mo.confirmar_ingesta(resp.data["job_id"], "t1", "u1")
    assert out["status"] == "queued"
    assert queue.queue_length() == 1


def test_ingesta_saldo_insuficiente_rechaza_sin_encolar():
    mo, sink, queue = build_mo(saldo=0.0)
    resp = mo.handle_request(
        MORequest(
            auth=AUTH_ADMIN, accion="ingesta",
            payload={"texto_documento": "Documento de prueba " * 50,
                     "nombre_archivo": "x.pdf"},
        )
    )
    cot = resp.data["cotizacion"]
    assert cot["aprobado"] is False
    assert "insuficiente" in cot["motivo"].lower()
    assert resp.data["requiere_confirmacion"] is False
    assert queue.queue_length() == 0
    # Confirmar un job rechazado debe fallar (no hay bypass).
    with pytest.raises((ValueError, KeyError)):
        mo.confirmar_ingesta(resp.data["job_id"], "t1", "u1")
    assert queue.queue_length() == 0


def test_permiso_viewer_no_puede_ingerir():
    mo, sink, queue = build_mo()
    resp = mo.handle_request(
        MORequest(auth=AUTH_VIEWER, accion="ingesta",
                  payload={"texto_documento": "x", "nombre_archivo": "x.pdf"})
    )
    assert resp.ok is False
    assert resp.servido is False
    assert "permiso" in resp.motivo_bloqueo.lower()
    assert queue.queue_length() == 0


def test_consulta_confianza_baja_bloqueada():
    mo, sink, _ = build_mo()
    resp = mo.handle_request(
        MORequest(auth=AUTH_ADMIN, accion="consulta", texto="¿y esto?",
                  payload={"score_confianza": 0.3})
    )
    assert resp.servido is False
    assert "alucinación" in resp.motivo_bloqueo.lower() or "confianza" in resp.motivo_bloqueo.lower()


def test_consulta_limpia_servida_y_clasificada():
    """B8: una consulta servida devuelve el envelope tipado con clasificación."""
    mo, sink, _ = build_mo()
    resp = mo.handle_request(
        MORequest(auth=AUTH_ADMIN, accion="consulta",
                  texto="cuál es el valor de presión nominal", canal=Canal.pwa,
                  payload={"score_confianza": 0.95})
    )
    assert resp.servido is True
    assert resp.data["tipo_intencion"] == "INFORMATIVA"
    assert resp.data["payload"]["kind"] == "info_card"
    # La clasificación dejó traza en el FAT (familia F4).
    assert any(e["action"] == "intent_classified" for e in sink.entries)


def test_sesion_completa_con_transicion_de_canal():
    mo, sink, _ = build_mo()
    sid = mo.iniciar_sesion(AUTH_ADMIN, SessionType.consulta, Canal.pwa,
                            initial_state={"contexto": "extintor-5"})
    # Transfiere a WhatsApp preservando estado.
    state = mo.transferir_sesion(sid, Canal.whatsapp)
    assert state.canal == Canal.whatsapp.value
    assert state.state["contexto"] == "extintor-5"
    # Cierra → spillover.
    completed = mo.cerrar_sesion(sid, reason="completada")
    assert completed is not None
    assert mo.session_manager.get_session(sid) is None
    # FAT registró iniciar/transferir/cerrar.
    acciones = {e["action"] for e in sink.entries}
    assert {"sesion_iniciada", "sesion_transferida", "sesion_cerrada"} <= acciones


def test_request_desconocido_no_se_sirve():
    mo, sink, _ = build_mo()
    resp = mo.handle_request(MORequest(auth=AUTH_ADMIN))
    assert resp.kind == RequestKind.desconocido
    assert resp.servido is False
