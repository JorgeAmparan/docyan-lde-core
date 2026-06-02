"""
Tests del router de Tokens QR (B4 §6).

Endpoint público GET /qr/{token} (resolución), POST /qr/generate y /qr/revoke
(autenticados). Backends sustituidos por dobles en memoria vía dependency_overrides.
"""
import pytest

from app.api.routers import qr as qr_router
from app.qr.qr_generator import QrGenerator
from app.qr.qr_resolver import QrResolutionError, ResolvedQr
from app.qr.store import InMemoryQrTokenStore

# Auth dev: X-API-Key = test-api-key-for-pytest → org=test-org, role=admin (conftest).
HEADERS = {"X-API-Key": "test-api-key-for-pytest"}


class FakeResolver:
    def __init__(self, mapping=None):
        self.mapping = mapping or {}

    def resolve(self, token):
        if token not in self.mapping:
            raise QrResolutionError("token_no_registrado")
        return self.mapping[token]


@pytest.fixture
def app_with_qr(test_client):
    from app.api.main import app

    store = InMemoryQrTokenStore()
    generator = QrGenerator(store=store, base_url="https://docyan-lde-api.fly.dev")
    resolver = FakeResolver()

    app.dependency_overrides[qr_router.get_qr_generator] = lambda: generator
    app.dependency_overrides[qr_router.get_qr_resolver] = lambda: resolver
    yield test_client, generator, resolver, store
    app.dependency_overrides.pop(qr_router.get_qr_generator, None)
    app.dependency_overrides.pop(qr_router.get_qr_resolver, None)


def test_generate_qr_autenticado(app_with_qr):
    client, generator, resolver, store = app_with_qr
    r = client.post("/qr/generate", json={"entidad_id": "ent-1"}, headers=HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert body["entidad_id"] == "ent-1"
    assert body["url"].startswith("https://docyan-lde-api.fly.dev/qr/")
    assert body["tenant_id"] == "test-org"


def test_generate_qr_sin_auth_rechazado(app_with_qr):
    client, *_ = app_with_qr
    r = client.post("/qr/generate", json={"entidad_id": "ent-1"})
    assert r.status_code == 401


def test_resolve_json_devuelve_contexto(app_with_qr):
    client, generator, resolver, store = app_with_qr
    resolver.mapping["tok-ok"] = ResolvedQr(
        tenant_id="test-org", entidad_id="ent-1",
        entidad={"id": "ent-1", "tipo": "extintor"},
        documentos=[{"id": "d1"}],
        frontend_url="https://consulta.docyan.com/consulta?tenant=test-org&entidad=ent-1",
    )
    r = client.get("/qr/tok-ok", params={"format": "json"})
    assert r.status_code == 200
    assert r.json()["entidad"]["tipo"] == "extintor"


def test_resolve_redirect(app_with_qr):
    client, generator, resolver, store = app_with_qr
    resolver.mapping["tok-ok"] = ResolvedQr(
        tenant_id="test-org", entidad_id="ent-1", entidad={"id": "ent-1"},
        frontend_url="https://consulta.docyan.com/consulta?tenant=test-org&entidad=ent-1",
    )
    r = client.get("/qr/tok-ok", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"].startswith("https://consulta.docyan.com/consulta")


def test_resolve_token_invalido_404(app_with_qr):
    client, *_ = app_with_qr
    r = client.get("/qr/no-existe", params={"format": "json"})
    assert r.status_code == 404


def test_generate_y_revoke(app_with_qr):
    client, generator, resolver, store = app_with_qr
    client.post("/qr/generate", json={"entidad_id": "ent-9"}, headers=HEADERS)
    # Recupera el nonce del registro (único para test-org).
    nonce = next(k[1] for k in store._rows if k[0] == "test-org")
    r = client.post("/qr/revoke", json={"nonce": nonce}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["revocado"] is True
    # Revocar de nuevo → 404.
    r2 = client.post("/qr/revoke", json={"nonce": nonce}, headers=HEADERS)
    assert r2.status_code == 404
