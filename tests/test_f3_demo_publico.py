"""
F3 §D/§E — Endpoint demo público (`POST /demo/query`). Tests backend.

Cubre:
  · Sin auth: el endpoint responde (público).
  · Rate-limit por IP: tras N hits, 429 con Retry-After.
  · Fallback honesto cuando el grafo demo no sostiene la pregunta (no inventa).
  · Camino servido (respuesta citada real) cuando el MO la entrega.
  · Aislamiento solo-lectura: no hay escritura pública contra tenants demo (la
    ingesta exige auth admin/editor → 401/403 sin JWT).
  · CoDo inválido cae a 'hero' (no filtra tenants arbitrarios).
"""
from __future__ import annotations

import pytest

from app.api.routers import demo as demo_router
from app.cache.rate_limiter import InMemoryRateLimiter


class _Kind:
    def __init__(self, v):
        self.value = v


class _NotServedResp:
    """MOResponse falso sin respuesta citada (el grafo demo no la sostiene)."""

    servido = False
    ok = True
    kind = _Kind("info")
    session_id = None
    motivo_bloqueo = None
    data = {}


class _NotServedMO:
    """MO falso y rápido: scopea al tenant demo (aislamiento) y no sirve respuesta."""

    def handle_request(self, req):
        assert req.auth["org_id"].startswith("demo-")
        assert req.auth["role"] == "viewer"
        return _NotServedResp()


class _ServedResp:
    """MOResponse falso que entrega una respuesta citada (camino servido)."""

    servido = True
    ok = True
    kind = _Kind("info")
    session_id = None
    motivo_bloqueo = None
    data = {
        "tipo": "informativa",
        "payload": {"valor": "85", "unidad": "N·m"},
        "cita": {"doc": "Manual Rotina 380", "page": 12},
    }

    def __init__(self, *a, **k):
        pass


class _ServedMO:
    def handle_request(self, req):
        # El tenant llega scopeado al demo (aislamiento): lo verificamos.
        assert req.auth["org_id"].startswith("demo-")
        assert req.auth["role"] == "viewer"
        return _ServedResp()


@pytest.fixture
def demo_client(test_client):
    from app.api.main import app

    mo = _NotServedMO()
    limiter = InMemoryRateLimiter(limit=3, window_seconds=60)
    app.dependency_overrides[demo_router.get_mo] = lambda: mo
    app.dependency_overrides[demo_router.get_rate_limiter] = lambda: limiter
    yield test_client, limiter
    app.dependency_overrides.pop(demo_router.get_mo, None)
    app.dependency_overrides.pop(demo_router.get_rate_limiter, None)


def test_demo_query_sin_auth_responde_fallback(demo_client):
    client, _ = demo_client
    # SIN headers de auth (público). Grafo demo vacío → fallback honesto.
    r = client.post("/demo/query", json={"texto": "¿torque del perno?", "codo": "lab"})
    assert r.status_code == 200
    body = r.json()
    assert body["servido"] is False
    assert "tus documentos" in body["fallback"].lower()
    assert body["codo"] == "lab"
    assert body["tenant_demo"].startswith("demo-")


def test_demo_query_rate_limit_429(demo_client):
    client, _ = demo_client
    # limit=3 → los 3 primeros pasan, el 4º recibe 429 con Retry-After.
    for _ in range(3):
        ok = client.post("/demo/query", json={"texto": "hola", "codo": "lab"})
        assert ok.status_code == 200
    blocked = client.post("/demo/query", json={"texto": "hola", "codo": "lab"})
    assert blocked.status_code == 429
    assert "retry-after" in {k.lower() for k in blocked.headers}


def test_demo_query_codo_invalido_cae_a_hero(demo_client):
    client, _ = demo_client
    r = client.post("/demo/query", json={"texto": "x", "codo": "no-existe"})
    assert r.status_code == 200
    assert r.json()["codo"] == "hero"


def test_demo_query_servido_devuelve_cita():
    from fastapi.testclient import TestClient

    from app.api.main import app

    app.dependency_overrides[demo_router.get_mo] = lambda: _ServedMO()
    app.dependency_overrides[demo_router.get_rate_limiter] = lambda: InMemoryRateLimiter(
        limit=100
    )
    try:
        client = TestClient(app)
        r = client.post("/demo/query", json={"texto": "¿torque?", "codo": "lab"})
        assert r.status_code == 200
        body = r.json()
        assert body["servido"] is True
        assert body["kind"] == "info"
        assert body["resultado"]["cita"]["doc"] == "Manual Rotina 380"
    finally:
        app.dependency_overrides.pop(demo_router.get_mo, None)
        app.dependency_overrides.pop(demo_router.get_rate_limiter, None)


def test_demo_no_permite_escritura_sin_auth(test_client):
    """Aislamiento solo-lectura: la ingesta (escritura) exige auth; sin JWT → 401/403."""
    # No hay endpoint público de escritura para tenants demo. La única escritura de
    # ingesta vive en /ingesta/documents y exige rol admin/editor.
    r = test_client.post("/ingesta/documents", files={"file": ("d.txt", b"x")})
    assert r.status_code in (401, 403)
