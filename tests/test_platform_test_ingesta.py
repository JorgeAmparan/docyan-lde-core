"""
Parte 2 — Ingesta de documentos de PRUEBA desde la consola de plataforma.

Verifica el endpoint `/platform/test-ingesta/*` (super-admin):
  · Scope: sin auth → 401; token de tenant → 403 (no entra a /platform/*).
  · Aislamiento defensivo: el tenant destino DEBE ser de prueba (demo-/test-); un
    nombre de tenant de cliente se rechaza (400).
  · Flujo canónico: cotiza (provisiona saldo de prueba) → pending_confirmation →
    confirma → queued (encolado hacia el worker real). Sin bypass del cotizador.
  · metadata SÍ / contenido NO: ninguna respuesta filtra el texto del documento.
  · FAT: las acciones quedan auditadas.
"""
import io

import pytest

from app.ingesta import providers as iproviders
from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore
from app.ingesta.cotizador import Cotizador
from app.ingesta.document_store import LocalDocumentStore
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.platform_admin import providers as pproviders
from app.platform_admin.audit import InMemoryPlatformAudit
from app.platform_admin.security import hash_password
from app.platform_admin.store import InMemoryPlatformStore
from app.schemas_documentales.registry import InMemorySchemaStore, SchemaRegistry
from app.schemas_documentales.selector import SchemaSelector

ADMIN_EMAIL = "fundador@xcid.com"
ADMIN_PASS = "founder-pass-123"
SECRET = "TEXTO-CONFIDENCIAL-NUNCA-EXPONER-EN-METADATA"
DOC_BYTES = (
    "Manual de operación de la mezcladora de concreto MAXI-10ND. "
    "El operador deberá verificar la presión antes de arrancar. " + SECRET
).encode("utf-8")


@pytest.fixture
def pwired(monkeypatch, tmp_path):
    """Endpoints cableados a backends EN MEMORIA (cotizador real, gate vigente)."""
    # Plataforma: store con admin para login + audit en memoria.
    pstore = InMemoryPlatformStore()
    paudit = InMemoryPlatformAudit()
    pstore.create_admin(ADMIN_EMAIL, hash_password(ADMIN_PASS), "Fundador")
    monkeypatch.setattr(pproviders, "get_store", lambda: pstore)
    monkeypatch.setattr(pproviders, "get_audit", lambda: paudit)

    # Ingesta: budget compartido entre ensure_budget (endpoint) y el cotizador.
    budget_store = InMemoryBudgetStore()
    budget_manager = BudgetManager(store=budget_store)
    queue_backend = InMemoryQueueBackend()
    cotizador = Cotizador(budget_manager=budget_manager)
    dispatcher = JobDispatcher(backend=queue_backend, budget_manager=budget_manager)
    doc_store = LocalDocumentStore(base_dir=str(tmp_path))

    monkeypatch.setattr(iproviders, "get_budget_manager", lambda: budget_manager)
    monkeypatch.setattr(iproviders, "get_cotizador", lambda: cotizador)
    monkeypatch.setattr(iproviders, "get_dispatcher", lambda: dispatcher)
    monkeypatch.setattr(iproviders, "get_document_store", lambda: doc_store)
    monkeypatch.setattr(
        iproviders, "get_selector",
        lambda: SchemaSelector(registry=SchemaRegistry(store=InMemorySchemaStore())),
    )

    from fastapi.testclient import TestClient

    from app.api.main import app

    return TestClient(app), paudit, queue_backend


def _login(client) -> str:
    r = client.post("/platform/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _ph(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _tenant_jwt() -> str:
    from app.api.auth import _create_access_token

    return _create_access_token({"id": "u1", "org_id": "alpha", "role": "admin", "email": "a@a.com"})


def _file():
    return {"file": ("maxi10_operacion.txt", io.BytesIO(DOC_BYTES), "text/plain")}


# ── Scope / seguridad ─────────────────────────────────────────────────────────

def test_sin_auth_401(pwired):
    client, *_ = pwired
    r = client.post("/platform/test-ingesta/documents", files=_file(), data={"tenant": "maxi"})
    assert r.status_code == 401


def test_tenant_token_no_entra_403(pwired):
    client, *_ = pwired
    r = client.post(
        "/platform/test-ingesta/documents",
        headers=_ph(_tenant_jwt()), files=_file(), data={"tenant": "maxi"},
    )
    assert r.status_code == 403  # token de tenant: sin scope platform


def test_tenant_destino_de_cliente_rechazado_400(pwired):
    client, *_ = pwired
    token = _login(client)
    r = client.post(
        "/platform/test-ingesta/documents",
        headers=_ph(token), files=_file(), data={"tenant": "alpha"},  # no es demo-/test-
    )
    assert r.status_code == 400


# ── Flujo canónico cotiza → confirma → encola ────────────────────────────────

def test_cotiza_y_confirma_a_tenant_demo(pwired):
    client, paudit, queue_backend = pwired
    token = _login(client)

    # 1) Cotiza (alias "maxi" → graph demo-maxi). Saldo de prueba provisionado.
    r = client.post(
        "/platform/test-ingesta/documents",
        headers=_ph(token), files=_file(), data={"tenant": "maxi"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tenant"] == "demo-maxi"
    assert body["status"] == "pending_confirmation"
    assert body["cotizacion"]["aprobado"] is True
    job_id = body["job_id"]

    # Aún NO encolado (gate sin bypass).
    assert queue_backend.queue_length() == 0

    # 2) Confirma → queued (encolado hacia el worker real).
    rc = client.post(f"/platform/test-ingesta/documents/{job_id}/confirm", headers=_ph(token))
    assert rc.status_code == 200, rc.text
    assert rc.json()["status"] == "queued"
    assert queue_backend.queue_length() == 1
    job = queue_backend.load_job(job_id)
    assert job is not None and job.tenant_id == "demo-maxi"

    # 3) Estado del job (metadata).
    rs = client.get(f"/platform/test-ingesta/documents/{job_id}", headers=_ph(token))
    assert rs.status_code == 200


def test_tenant_libre_con_prefijo_test(pwired):
    client, *_ = pwired
    token = _login(client)
    r = client.post(
        "/platform/test-ingesta/documents",
        headers=_ph(token), files=_file(), data={"tenant": "test-mezcladora"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["tenant"] == "test-mezcladora"


# ── metadata SÍ / contenido NO ───────────────────────────────────────────────

def test_respuestas_no_filtran_contenido(pwired):
    client, *_ = pwired
    token = _login(client)
    r = client.post(
        "/platform/test-ingesta/documents",
        headers=_ph(token), files=_file(), data={"tenant": "maxi"},
    )
    job_id = r.json()["job_id"]
    rc = client.post(f"/platform/test-ingesta/documents/{job_id}/confirm", headers=_ph(token))
    rs = client.get(f"/platform/test-ingesta/documents/{job_id}", headers=_ph(token))
    # El texto del documento NUNCA aparece en ninguna respuesta de plataforma.
    assert SECRET not in r.text
    assert SECRET not in rc.text
    assert SECRET not in rs.text


# ── FAT ───────────────────────────────────────────────────────────────────────

def test_acciones_auditadas_en_fat(pwired):
    client, paudit, _ = pwired
    token = _login(client)
    r = client.post(
        "/platform/test-ingesta/documents",
        headers=_ph(token), files=_file(), data={"tenant": "maxi"},
    )
    client.post(f"/platform/test-ingesta/documents/{r.json()['job_id']}/confirm", headers=_ph(token))
    actions = {e["action"] for e in paudit.entries}
    assert "platform_test_ingesta_cotizada" in actions
    assert "platform_test_ingesta_confirmada" in actions
