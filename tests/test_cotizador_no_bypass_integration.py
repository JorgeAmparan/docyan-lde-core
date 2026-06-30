"""
B2.2 §5 — test de INTEGRACIÓN del gate "no bypass" del cotizador.

Maneja el flujo REAL de endpoints (/ingesta/documents, /confirm) con la lógica
REAL del cotizador. Solo se sustituyen los ALMACENES por backends en memoria
(cola, document store) — NUNCA la decisión del cotizador, ni el dispatcher. El
LLM/grafo del worker no se toca: los endpoints nunca lo invocan (la ingesta real
la hace el worker al consumir la cola, fuera de este test).

Garantías verificadas a nivel integración (modelo v2.1: cupo + cotización +
confirmación explícita, SIN saldo prepagado):
  - No se puede llegar a `confirmar` sin pasar por `cotizar` primero.
  - Subir un documento cotiza pero NO encola: solo la confirmación explícita encola.
  - El endpoint de confirmación rechaza un job_id inexistente.
"""
import io

import pytest

from app.ingesta import providers
from app.ingesta.cotizador import Cotizador
from app.ingesta.document_store import LocalDocumentStore
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.jobs.job_status import JobStatusReader

API_KEY = "test-api-key-for-pytest"  # = conftest API_KEY (modo dev → role admin, org=test-org)
TENANT = "test-org"
AUTH = {"X-API-Key": API_KEY}

# Documento de texto no trivial (evita depender de un PDF; extraer_texto lo decodifica).
DOC_BYTES = ("Procedimiento de instalación del seccionador. Paso 1: desenergizar. "
             "Advertencia: alta tensión. " * 300).encode("utf-8")


@pytest.fixture
def wired(monkeypatch, tmp_path):
    """
    Cablea los endpoints con backends EN MEMORIA compartidos. El cotizador y el
    dispatcher son los reales; solo cambian sus almacenes.
    """
    queue_backend = InMemoryQueueBackend()
    doc_store = LocalDocumentStore(base_dir=str(tmp_path))

    cotizador = Cotizador()
    dispatcher = JobDispatcher(backend=queue_backend)
    status_reader = JobStatusReader(backend=queue_backend)

    monkeypatch.setattr(providers, "get_cotizador", lambda: cotizador)
    monkeypatch.setattr(providers, "get_dispatcher", lambda: dispatcher)
    monkeypatch.setattr(providers, "get_status_reader", lambda: status_reader)
    monkeypatch.setattr(providers, "get_document_store", lambda: doc_store)
    # selector real con registry en memoria (no genera: el doc calza heurístico o
    # queda tipo None; no se invoca litellm en el backend).
    from app.schemas_documentales.registry import InMemorySchemaStore, SchemaRegistry
    from app.schemas_documentales.selector import SchemaSelector
    monkeypatch.setattr(
        providers, "get_selector",
        lambda: SchemaSelector(registry=SchemaRegistry(store=InMemorySchemaStore())),
    )

    from fastapi.testclient import TestClient

    from app.api.main import app
    client = TestClient(app)
    return client, queue_backend


def _subir(client) -> dict:
    files = {"file": ("manual.txt", io.BytesIO(DOC_BYTES), "text/plain")}
    return client.post("/ingesta/documents", headers=AUTH, files=files)


def test_confirm_job_inexistente_404(wired):
    client, queue = wired
    r = client.post("/ingesta/documents/noexiste123/confirm", headers=AUTH)
    assert r.status_code == 404
    assert queue.queue_length() == 0


def test_subir_cotiza_pero_no_encola(wired):
    client, queue = wired
    # Subir SOLO cotiza (cupo + cotización); NADA se encola sin confirmación explícita.
    r = _subir(client)
    assert r.status_code == 200
    body = r.json()
    assert body["requiere_confirmacion"] is True
    assert body["cotizacion"]["aprobado"] is True
    # El gate no tiene bypass: la subida NO encoló nada por sí sola.
    assert queue.queue_length() == 0


def test_flujo_aprobado_cotiza_confirma_encola(wired):
    client, queue = wired

    r = _subir(client)
    assert r.status_code == 200
    body = r.json()
    assert body["requiere_confirmacion"] is True
    assert body["cotizacion"]["aprobado"] is True
    job_id = body["job_id"]
    # Aún NO se encoló nada (solo se cotizó).
    assert queue.queue_length() == 0

    # Confirmar → AHORA sí se encola.
    r2 = client.post(f"/ingesta/documents/{job_id}/confirm", headers=AUTH)
    assert r2.status_code == 200
    assert r2.json()["encolado"] is True
    assert queue.queue_length() == 1


def test_unica_via_a_la_cola_es_cotizar_y_confirmar(wired):
    """No hay endpoint que encole sin cotizar: confirmar exige un job creado por
    /ingesta/documents (que SIEMPRE cotiza primero)."""
    client, queue = wired

    # Sin crear job → confirmar inventado falla; cola vacía.
    assert client.post("/ingesta/documents/inventado/confirm", headers=AUTH).status_code == 404
    assert queue.queue_length() == 0

    # El único camino a 'queued' es crear (cotiza) + confirmar.
    body = _subir(client).json()
    client.post(f"/ingesta/documents/{body['job_id']}/confirm", headers=AUTH)
    assert queue.queue_length() == 1


def test_aislamiento_tenant_en_consulta_de_estado(wired):
    """Un job pertenece a su tenant; el status reader no lo cruza."""
    client, queue = wired
    body = _subir(client).json()
    # El reader real, consultado con OTRO tenant, no devuelve el job.
    reader = JobStatusReader(backend=queue)
    assert reader.get("otro-tenant", body["job_id"]) is None
    assert reader.get(TENANT, body["job_id"]) is not None
