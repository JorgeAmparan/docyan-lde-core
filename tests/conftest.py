import os

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest-min-32-bytes-long-0000")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fake-key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-service-key")
os.environ.setdefault("GEMINI_API_KEY", "fake-key")
os.environ.setdefault("BGE_M3_URL", "http://localhost:8080")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("FALKORDB_HOST", "localhost")
os.environ.setdefault("ORG_ID", "test-org")
os.environ.setdefault("API_KEY", "test-api-key-for-pytest")


@pytest.fixture
def test_client():
    from fastapi.testclient import TestClient

    from app.api.main import app
    return TestClient(app)


# ── Helpers compartidos B8 (MO en memoria + reader sintético) ─────────────────


class EmptyPipelineReader:
    """Reader sintético vacío: los pipelines producen payloads válidos sin DKG."""

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


def make_inmemory_mo(saldo: float = 100.0, tenant: str = "test-org", reader=None):
    """Construye un MasterOrchestrator 100% en memoria (B8): clasificador real
    (heurística pura, sin LLM), pipelines sobre un reader sintético, sesiones y
    FAT en memoria. Devuelve (mo, audit_sink)."""
    from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore
    from app.ingesta.cotizador import Cotizador
    from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
    from app.orchestrator.audit_logger import AuditLogger, InMemoryAuditSink
    from app.orchestrator.master_orchestrator import MasterOrchestrator
    from app.orchestrator.pipeline_coordinator import PipelineCoordinator
    from app.orchestrator.session_manager import (
        InMemorySessionSpillover,
        InMemorySessionStore,
        SessionManager,
    )

    budget_store = InMemoryBudgetStore()
    BudgetManager(store=budget_store).ensure_budget(tenant, saldo_inicial_usd=saldo)
    coord = PipelineCoordinator(
        cotizador=Cotizador(budget_manager=BudgetManager(store=budget_store)),
        dispatcher=JobDispatcher(backend=InMemoryQueueBackend()),
        graph_reader=reader or EmptyPipelineReader(),
    )
    sink = InMemoryAuditSink()
    mo = MasterOrchestrator(
        pipeline_coordinator=coord,
        session_manager=SessionManager(
            store=InMemorySessionStore(), spillover=InMemorySessionSpillover()
        ),
        audit_logger=AuditLogger(sink=sink),
    )
    return mo, sink


# ── DKG / FalkorDB (B1) ──────────────────────────────────────────────────────


def falkordb_available() -> bool:
    """True si hay un FalkorDB alcanzable con el módulo graph (no solo Redis)."""
    try:
        from app.graph.dkg_client import DKGClient

        return DKGClient().health()
    except Exception:
        return False


requires_falkordb = pytest.mark.skipif(
    not falkordb_available(),
    reason="FalkorDB (docyan-lde-graph) no disponible en este entorno.",
)


@pytest.fixture
def dkg():
    """
    Cliente DKG contra el FalkorDB del entorno, con limpieza automática de los
    grafos de tenant que el test cree (rastrea cualquier tenant tocado por
    create_tenant / _create_node). Para tenants creados por otra vía usar
    `dkg.track(tid)`.
    """
    from app.graph.dkg_client import DKGClient

    client = DKGClient()
    created: set[str] = set()

    _orig_create_tenant = client.create_tenant
    _orig_create_node = client._create_node

    def _tracked_create_tenant(tenant_id, props=None):
        created.add(tenant_id)
        return _orig_create_tenant(tenant_id, props)

    def _tracked_create_node(tenant_id, label, props):
        created.add(tenant_id)
        return _orig_create_node(tenant_id, label, props)

    client.create_tenant = _tracked_create_tenant  # type: ignore[method-assign]
    client._create_node = _tracked_create_node  # type: ignore[method-assign]
    client.track = lambda tid: created.add(tid)  # type: ignore[attr-defined]

    try:
        yield client
    finally:
        for tid in created:
            try:
                client.drop_tenant_graph(tid)
            except Exception:
                pass


# ── DTM / FalkorDB (B3) ──────────────────────────────────────────────────────


@pytest.fixture
def dtm():
    """
    Cliente DTM contra el FalkorDB del entorno, con limpieza automática de los
    grafos DTM que el test toque. Cualquier grafo DTM creado vía el cliente se
    rastrea para borrarse al final; usar `dtm.track_graph(name)` para grafos
    creados por otra vía (p. ej. el provisioning o el bridge).
    """
    from app.graph.dtm_client import DTMClient

    client = DTMClient()
    touched: set[str] = set()

    _orig_create_in_graph = client.create_node_in_graph

    def _tracked_create_in_graph(graph_name, label, props):
        touched.add(graph_name)
        return _orig_create_in_graph(graph_name, label, props)

    client.create_node_in_graph = _tracked_create_in_graph  # type: ignore[method-assign]
    client.track_graph = lambda name: touched.add(name)  # type: ignore[attr-defined]
    client.track_tenant = lambda tid: touched.update(  # type: ignore[attr-defined]
        client.list_dtm_graphs(tid)
    )

    try:
        yield client
    finally:
        # Re-escanea por si el provisioning creó grafos no tocados directamente.
        for name in list(touched):
            try:
                client.drop_graph_named(name)
            except Exception:
                pass
