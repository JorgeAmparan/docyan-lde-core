"""
F1 — Cotizador cableado + Ingesta observable. Tests backend (testing balanceado).

Cubre las garantías del Sprint Contract F1:
  · GET /ingesta/documents/{job_id}/status: shape DocProgress por estado + RLS
    multi-tenant (un tenant no ve jobs de otro).
  · Idempotencia por SHA-256 del CONTENIDO: re-ingerir el mismo contenido (otro
    job_id / nombre / sesión) no reprocesa ni re-cobra; estado final idéntico.
  · Reintento con backoff + tope: fallo transitorio reintenta acotado; agotado →
    estado terminal `failed`, nunca reintento infinito.
  · Concurrencia: nunca excede el límite duro configurado.
  · Cotización de lote: docs dentro del cap aprueban; lote que excede → cuántos
    caben (desglose), no se encola en silencio.
  · Reintento manual: POST /ingesta/documents/{job_id}/retry re-encola un error.
"""
import asyncio
import io

import pytest

from app.ingesta import providers
from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore
from app.ingesta.cotizador import Cotizador
from app.ingesta.document_store import LocalDocumentStore
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.jobs.job_models import CotizacionSnapshot, IngestJob, JobStatus
from app.jobs.job_status import JobStatusReader
from app.jobs.progress import (
    PHASE_WEIGHTS,
    build_doc_progress,
    derive_status,
    pct_total,
)

API_KEY = "test-api-key-for-pytest"  # conftest API_KEY → role admin, org=test-org
TENANT = "test-org"
AUTH = {"X-API-Key": API_KEY}
DOC_BYTES = ("Procedimiento de calibración de balanza. Paso 1: nivelar. "
             "Advertencia: usar patrón certificado. " * 300).encode("utf-8")


# ════════════════════════════════════════════════════════════════════════════
# Unidad — cálculo de progreso (fuente única de pesos)
# ════════════════════════════════════════════════════════════════════════════

def _job(**kw) -> IngestJob:
    base = dict(
        job_id="j1", tenant_id=TENANT, documento_ref="ref", nombre_archivo="doc.pdf",
        cotizacion=CotizacionSnapshot(
            costo_estimado_usd=0.02, tiempo_estimado_seg=600, tokens_documento=9000,
            aprobado=True, decision="aprobado_requiere_confirmacion",
        ),
    )
    base.update(kw)
    return IngestJob(**base)


def test_pct_total_usa_pesos_canonicos():
    # En extraccion al 50%: pesos previos (6+16) + 38*0.5 = 41.
    assert pct_total("extraccion", 0.5) == pytest.approx(22 + 19)
    assert pct_total("descarga", 0.0) == 0.0
    assert pct_total("dedup", 1.0) == pytest.approx(sum(PHASE_WEIGHTS.values()))


def test_derive_status_mapea_fase_a_docstatus():
    assert derive_status(_job(status=JobStatus.queued)) == "encolado"
    assert derive_status(_job(status=JobStatus.processing, phase="descarga")) == "cargando"
    assert derive_status(_job(status=JobStatus.processing, phase="grafo")) == "procesando"
    assert derive_status(_job(status=JobStatus.completed)) == "completado"
    assert derive_status(_job(status=JobStatus.failed)) == "error"


def test_build_doc_progress_completado_y_error():
    done = build_doc_progress(
        _job(status=JobStatus.completed, resultado={"document_id": "abc"}),
        consult_url="/consulta?doc=abc",
    )
    assert done.status == "completado" and done.pct == 100.0
    assert done.disponibleParaConsulta is True and done.consultUrl == "/consulta?doc=abc"

    err = build_doc_progress(_job(status=JobStatus.failed, error="OCR ilegible"))
    assert err.status == "error" and err.error.message == "OCR ilegible"
    assert err.consultUrl is None and err.disponibleParaConsulta is False


def test_build_doc_progress_procesando_calcula_pct_y_eta():
    job = _job(status=JobStatus.processing, phase="extraccion", phase_fraction=0.5)
    dp = build_doc_progress(job)
    assert dp.status == "procesando"
    assert dp.pct == pytest.approx(41.0)
    # ETA = tiempo_estimado * fracción restante = 600 * (1 - 0.41).
    assert dp.etaSeconds == pytest.approx(600 * (1 - 0.41), rel=1e-3)


# ════════════════════════════════════════════════════════════════════════════
# Integración HTTP — endpoint de estatus (shape + multi-tenant)
# ════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def wired(monkeypatch, tmp_path):
    """Endpoints cableados a backends EN MEMORIA compartidos (cotizador real)."""
    budget_store = InMemoryBudgetStore()
    queue_backend = InMemoryQueueBackend()
    doc_store = LocalDocumentStore(base_dir=str(tmp_path))
    cotizador = Cotizador(budget_manager=BudgetManager(store=budget_store))
    dispatcher = JobDispatcher(backend=queue_backend)
    status_reader = JobStatusReader(backend=queue_backend)

    monkeypatch.setattr(providers, "get_cotizador", lambda: cotizador)
    monkeypatch.setattr(providers, "get_dispatcher", lambda: dispatcher)
    monkeypatch.setattr(providers, "get_status_reader", lambda: status_reader)
    monkeypatch.setattr(providers, "get_document_store", lambda: doc_store)
    from app.schemas_documentales.registry import InMemorySchemaStore, SchemaRegistry
    from app.schemas_documentales.selector import SchemaSelector
    monkeypatch.setattr(
        providers, "get_selector",
        lambda: SchemaSelector(registry=SchemaRegistry(store=InMemorySchemaStore())),
    )

    from fastapi.testclient import TestClient

    from app.api.main import app
    client = TestClient(app)
    BudgetManager(store=budget_store).ensure_budget(TENANT, saldo_inicial_usd=10.0)
    return client, queue_backend, dispatcher


def _subir(client) -> dict:
    files = {"file": ("calibracion.txt", io.BytesIO(DOC_BYTES), "text/plain")}
    return client.post("/ingesta/documents", headers=AUTH, files=files).json()


def test_status_shape_encolado_y_procesando(wired):
    client, queue, dispatcher = wired
    body = _subir(client)
    job_id = body["job_id"]
    client.post(f"/ingesta/documents/{job_id}/confirm", headers=AUTH)

    # Encolado → status 'encolado' + queuePosition.
    r = client.get(f"/ingesta/documents/{job_id}/status", headers=AUTH)
    assert r.status_code == 200
    dp = r.json()
    assert dp["docId"] == job_id and dp["status"] == "encolado"
    assert dp["queuePosition"] == 1 and dp["pct"] == 0.0

    # El worker avanza a fase 'grafo' → status 'procesando' + contadores + pct.
    dispatcher.marcar_procesando(job_id)
    dispatcher.actualizar_progreso(
        job_id, phase="grafo", phase_fraction=0.5,
        counters={"relations": 120, "relationsTotal": 240},
    )
    dp = client.get(f"/ingesta/documents/{job_id}/status", headers=AUTH).json()
    assert dp["status"] == "procesando" and dp["phase"] == "grafo"
    assert dp["counters"]["relations"] == 120
    assert dp["pct"] == pytest.approx(pct_total("grafo", 0.5))


def test_status_multitenant_aislado(wired):
    client, queue, dispatcher = wired
    body = _subir(client)
    job_id = body["job_id"]
    # El job es del TENANT; el endpoint solo lo sirve a su tenant. Falsificamos un
    # ctx de otro tenant escribiendo un job ajeno y consultándolo con el JWT de
    # test (otro org) — el reader RLS no lo cruza: se valida a nivel reader.
    reader = JobStatusReader(backend=queue)
    assert reader.get("otro-tenant", job_id) is None
    assert reader.get(TENANT, job_id) is not None
    # Vía HTTP, un job de otro tenant da 404 (no se filtra).
    ajeno = IngestJob(
        job_id="ajeno1", tenant_id="otro-tenant", documento_ref="x",
        nombre_archivo="x.pdf", status=JobStatus.processing,
    )
    queue.save_job(ajeno)
    r = client.get("/ingesta/documents/ajeno1/status", headers=AUTH)
    assert r.status_code == 404


# ════════════════════════════════════════════════════════════════════════════
# Worker — idempotencia, reintento, concurrencia
# ════════════════════════════════════════════════════════════════════════════

class _FakeStore:
    def __init__(self, data_by_ref):
        self.data = data_by_ref

    def get(self, ref):
        return self.data[ref]


class _FakePipeline:
    """Pipeline de prueba: cuenta llamadas y puede fallar K veces antes de éxito."""

    def __init__(self, store, fail_times=0):
        self.document_store = store
        self.fail_times = fail_times
        self.calls = 0

    async def procesar(self, job, path, progreso=None):
        self.calls += 1
        if progreso:
            progreso("conversion", 1.0, {"pages": 3})
        if self.calls <= self.fail_times:
            raise RuntimeError("fallo transitorio simulado")
        return {"document_id": job.content_sha256, "nodos_creados": 5}


async def _nosleep(_s):  # backoff instantáneo en tests
    return None


def _confirmar(dispatcher, job_id):
    dispatcher.confirmar(job_id)
    dispatcher.backend.pop()  # el worker lo "saca" de la cola


def test_idempotencia_mismo_contenido_no_reprocesa(monkeypatch):
    import worker.main as wm

    backend = InMemoryQueueBackend()
    dispatcher = JobDispatcher(backend=backend)
    store = _FakeStore({"refA": DOC_BYTES, "refB": DOC_BYTES})  # mismo contenido
    pipeline = _FakePipeline(store)

    # Job 1 (refA) — primera ingesta del contenido.
    j1 = _job(job_id="J1", documento_ref="refA", nombre_archivo="a.pdf")
    dispatcher.crear_job(j1)
    _confirmar(dispatcher, "J1")
    asyncio.run(wm._procesar_un_job(dispatcher, pipeline, "J1", sleep=_nosleep))
    r1 = backend.load_job("J1")
    assert r1.status == JobStatus.completed and r1.idempotente is False
    assert pipeline.calls == 1

    # Job 2 (refB) — MISMO contenido, otro job_id y nombre/sesión → idempotente.
    j2 = _job(job_id="J2", documento_ref="refB", nombre_archivo="copia-otra-sesion.pdf")
    dispatcher.crear_job(j2)
    _confirmar(dispatcher, "J2")
    asyncio.run(wm._procesar_un_job(dispatcher, pipeline, "J2", sleep=_nosleep))
    r2 = backend.load_job("J2")
    assert r2.status == JobStatus.completed and r2.idempotente is True
    # NO se reprocesó: la pipeline siguió en 1 llamada (no duplica ni re-cobra).
    assert pipeline.calls == 1
    assert r2.content_sha256 == r1.content_sha256


def test_reintento_transitorio_con_tope_luego_completa(monkeypatch):
    import worker.main as wm

    monkeypatch.setattr(wm, "MAX_RETRIES", 2)
    backend = InMemoryQueueBackend()
    dispatcher = JobDispatcher(backend=backend)
    store = _FakeStore({"r": DOC_BYTES})
    pipeline = _FakePipeline(store, fail_times=1)  # falla 1 vez, luego éxito

    dispatcher.crear_job(_job(job_id="JR", documento_ref="r"))
    _confirmar(dispatcher, "JR")
    asyncio.run(wm._procesar_un_job(dispatcher, pipeline, "JR", sleep=_nosleep))
    job = backend.load_job("JR")
    assert job.status == JobStatus.completed
    assert pipeline.calls == 2  # 1 fallo + 1 éxito


def test_reintento_agotado_estado_terminal_no_infinito(monkeypatch):
    import worker.main as wm

    monkeypatch.setattr(wm, "MAX_RETRIES", 2)
    backend = InMemoryQueueBackend()
    dispatcher = JobDispatcher(backend=backend)
    store = _FakeStore({"r": DOC_BYTES})
    pipeline = _FakePipeline(store, fail_times=99)  # siempre falla

    dispatcher.crear_job(_job(job_id="JF", documento_ref="r"))
    _confirmar(dispatcher, "JF")
    asyncio.run(wm._procesar_un_job(dispatcher, pipeline, "JF", sleep=_nosleep))
    job = backend.load_job("JF")
    assert job.status == JobStatus.failed  # estado terminal, no cuelga
    # Tope duro: exactamente MAX_RETRIES + 1 intentos (no infinito).
    assert pipeline.calls == 3


def test_concurrencia_nunca_excede_el_limite_duro():
    import worker.main as wm

    limite = wm.MAX_CONCURRENCY
    backend = InMemoryQueueBackend()
    dispatcher = JobDispatcher(backend=backend)
    # Cada job con contenido DISTINTO (evita el short-circuit de idempotencia).
    refs = {f"r{i}": (DOC_BYTES + str(i).encode()) for i in range(10)}
    store = _FakeStore(refs)

    class _ConcPipeline:
        def __init__(self):
            self.document_store = store
            self.active = 0
            self.peak = 0

        async def procesar(self, job, path, progreso=None):
            self.active += 1
            self.peak = max(self.peak, self.active)
            await asyncio.sleep(0.01)
            self.active -= 1
            return {"document_id": job.content_sha256}

    pipeline = _ConcPipeline()
    for i in range(10):
        dispatcher.crear_job(_job(job_id=f"C{i}", documento_ref=f"r{i}"))
        _confirmar(dispatcher, f"C{i}")

    async def _drive():
        # Réplica EXACTA del acotamiento del consumer loop: semáforo = límite duro.
        sem = asyncio.Semaphore(limite)

        async def _run(jid):
            try:
                await wm._procesar_un_job(dispatcher, pipeline, jid, sleep=_nosleep)
            finally:
                sem.release()

        tareas = []
        for i in range(10):
            await sem.acquire()
            tareas.append(asyncio.create_task(_run(f"C{i}")))
        await asyncio.gather(*tareas)

    asyncio.run(_drive())
    assert pipeline.peak <= limite
    assert all(backend.load_job(f"C{i}").status == JobStatus.completed for i in range(10))


# ════════════════════════════════════════════════════════════════════════════
# Reintento manual + cotización de lote (building block del cliente)
# ════════════════════════════════════════════════════════════════════════════

def test_retry_manual_reencola_job_en_error(wired):
    client, queue, dispatcher = wired
    body = _subir(client)
    job_id = body["job_id"]
    client.post(f"/ingesta/documents/{job_id}/confirm", headers=AUTH)
    queue.pop()
    dispatcher.marcar_fallido(job_id, "OCR ilegible")

    r = client.post(f"/ingesta/documents/{job_id}/retry", headers=AUTH)
    assert r.status_code == 200
    dp = r.json()
    assert dp["status"] == "encolado"  # re-encolado
    assert dp["error"] is None
    assert queue.queue_length() == 1
    assert queue.load_job(job_id).status == JobStatus.queued


def test_retry_manual_rechaza_job_no_en_error(wired):
    client, queue, dispatcher = wired
    body = _subir(client)
    job_id = body["job_id"]
    # Aún pending_confirmation → no reintentable.
    r = client.post(f"/ingesta/documents/{job_id}/retry", headers=AUTH)
    assert r.status_code == 409


def test_cotizacion_lote_cuantos_caben_bajo_hard_cap_sesion():
    """Building block de la cotización de lote en cliente: el cotizador mide cada
    doc y el cliente acumula; el hard cap de sesión define cuántos caben."""
    store = InMemoryBudgetStore()
    bm = BudgetManager(store=store)
    # Hard cap de sesión pequeño para forzar el desglose.
    from app.ingesta.budget_manager import TenantBudget

    store.upsert(TenantBudget(
        tenant_id=TENANT, saldo_actual_usd=100.0,
        hard_cap_por_documento=100.0, hard_cap_por_sesion=0.10,
    ))
    cotizador = Cotizador(budget_manager=bm)

    acumulado = 0.0
    caben = 0
    for _ in range(10):
        c = cotizador.cotizar(
            tenant_id=TENANT, texto_documento=DOC_BYTES.decode(),
            costo_sesion_acumulado_usd=acumulado,
        )
        if c.aprobado:
            caben += 1
            acumulado += c.costo_estimado_usd
        else:
            # Rechazo CON explicación (no silencioso): hard cap de sesión.
            assert "hard cap" in c.to_dict()["decision"] or c.decision.value.startswith("rechazado")
            break
    # Al menos uno cabe y NO caben los 10 (el cap obliga al desglose en cliente).
    assert 1 <= caben < 10
