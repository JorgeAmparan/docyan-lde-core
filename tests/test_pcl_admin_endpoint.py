"""
Test del endpoint admin GET /admin/pcl/metrics (B8.5 §5, doc §7.3).

DOCYAN LDE™ by XCID.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.api.routers import admin as admin_router
from tests.conftest import make_inmemory_pcl

HEADERS = {"X-API-Key": "test-api-key-for-pytest"}  # → org=test-org, role=admin
ORG = "test-org"
HOY = datetime.now(timezone.utc).date()


@pytest.fixture
def pcl_client(test_client):
    from app.api.main import app

    pcl, _ = make_inmemory_pcl()
    pcl.metrics.store.upsert_dia({
        "tenant_id": ORG, "fecha": HOY.isoformat(),
        "consultas_totales": 10, "consultas_cache_hit": 6,
        "consultas_retrieval_first": 2, "consultas_synthesis_first": 2,
        "costo_total_centavos": 0.08, "costo_promedio_por_consulta": 0.008,
        "costo_promedio_por_consulta_unica": 0.02,
        "latencia_p50_ms": 40, "latencia_p95_ms": 120,
        "top_patrones_detectados": [{"entidad_id": "e1", "consultas": 5}],
        "sugerencias_emitidas": 1, "sugerencias_aceptadas": 1, "sugerencias_rechazadas": 0,
    })
    app.dependency_overrides[admin_router.get_pcl] = lambda: pcl
    yield test_client, pcl
    app.dependency_overrides.pop(admin_router.get_pcl, None)


def test_endpoint_devuelve_agregados(pcl_client):
    client, _ = pcl_client
    desde = (HOY - timedelta(days=7)).isoformat()
    resp = client.get(
        "/admin/pcl/metrics", headers=HEADERS,
        params={"desde": desde, "hasta": HOY.isoformat()},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["tenant_id"] == ORG
    assert len(data["dias"]) == 1
    assert data["dias"][0]["consultas_totales"] == 10
    assert data["totales"]["cache_hit_ratio"] == round(6 / 10, 4)


def test_endpoint_default_ventana_ultimos_30_dias(pcl_client):
    client, _ = pcl_client
    resp = client.get("/admin/pcl/metrics", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["totales"]["consultas_totales"] == 10


def test_endpoint_requiere_rol_admin(pcl_client):
    client, _ = pcl_client
    # Sin credenciales → 401/403 (no expone métricas de ningún DoCo).
    resp = client.get("/admin/pcl/metrics")
    assert resp.status_code in (401, 403)
