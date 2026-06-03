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


class FakeEmbedder:
    """Embedder determinista para tests (sin BGE-M3): texto normalizado → vector.

    Mismo texto → mismo vector (coseno 1.0 ≥ umbral → hit); textos distintos →
    vectores distintos. No imita la semántica de BGE-M3, solo su contrato `embed`.
    """

    DIMS = 16

    def embed(self, text: str) -> list[float]:
        import hashlib

        h = hashlib.sha256((text or "").encode("utf-8")).digest()
        return [b / 255.0 for b in h[: self.DIMS]]


def make_inmemory_pcl(state_hasher=None):
    """Construye una fachada PCL 100% en memoria (B8.5) + el FAT que la respalda.

    Devuelve (pcl, fat): `fat` es un FATExtendido(InMemoryFATStore) compartido por
    la instrumentación de la fachada y por las métricas, de modo que `agregar_diario`
    relea los eventos `consulta_servida` que la fachada escribe. `state_hasher`
    (default constante) controla la validez del caché vivo: pásalo derivado del
    estado del grafo para verificar invalidación viva."""
    from app.audit.fat_extendido import FATExtendido, InMemoryFATStore
    from app.orchestrator.audit_logger import AuditLogger, FATAuditSink
    from app.pcl.pcl_cache import InMemoryCacheBackend, PCLCache
    from app.pcl.pcl_facade import PCL
    from app.pcl.pcl_metrics import InMemoryPCLMetricsStore, PCLMetrics

    fat = FATExtendido(InMemoryFATStore())
    cache = PCLCache(
        backend=InMemoryCacheBackend(),
        embedder=FakeEmbedder(),
        state_hasher=state_hasher or (lambda tenant_id, entidades: "stable"),
    )
    metrics = PCLMetrics(store=InMemoryPCLMetricsStore(), fat=fat)
    pcl = PCL(
        cache=cache, metrics=metrics, fat=fat,
        audit=AuditLogger(sink=FATAuditSink(fat=fat)),
    )
    return pcl, fat


def make_inmemory_mo(saldo: float = 100.0, tenant: str = "test-org", reader=None):
    """Construye un MasterOrchestrator 100% en memoria (B8): clasificador real
    (heurística pura, sin LLM), pipelines sobre un reader sintético, sesiones y
    FAT en memoria. La consulta pasa por la fachada PCL en memoria (B8.5: caché +
    modo + instrumentación). Devuelve (mo, audit_sink)."""
    import hashlib

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
    the_reader = reader or EmptyPipelineReader()

    # State hasher derivado del estado mutable del reader: garantiza la "consulta
    # viva" en tests sin DKG (cuando el reader cambia, el state hash cambia → el
    # caché se invalida y se re-evalúa). En producción el state hash lo da el DKG
    # (dkg_state_hash por entidad). Un reader sin estado (EmptyPipelineReader) da
    # un hash constante → el caché funciona normal para los tests de cache hit.
    def _reader_state(tenant_id, entidades):
        estado = repr(sorted(getattr(the_reader, "__dict__", {}).items()))
        return hashlib.sha256(estado.encode("utf-8")).hexdigest()

    pcl, _ = make_inmemory_pcl(state_hasher=_reader_state)
    coord = PipelineCoordinator(
        cotizador=Cotizador(budget_manager=BudgetManager(store=budget_store)),
        dispatcher=JobDispatcher(backend=InMemoryQueueBackend()),
        graph_reader=the_reader,
        pcl=pcl,
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
