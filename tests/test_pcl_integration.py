"""
Integración MO ↔ CCP/PCL vía HTTP (B8.5 §2): la consulta pasa por la fachada,
la segunda consulta idéntica es cache hit, y las métricas del día lo reflejan.

DOCYAN LDE™ by XCID.
"""
from datetime import datetime, timezone

import pytest

from app.api.routers import mo as mo_router
from tests.conftest import make_inmemory_mo

HEADERS = {"X-API-Key": "test-api-key-for-pytest"}  # → org=test-org, role=admin
T = "test-org"


@pytest.fixture
def mo_client(test_client):
    from app.api.main import app

    mo, _ = make_inmemory_mo()
    app.dependency_overrides[mo_router.get_mo] = lambda: mo
    yield test_client, mo
    app.dependency_overrides.pop(mo_router.get_mo, None)


def _query(client, texto="cuál es el par de apriete del perno B"):
    return client.post("/mo/query", headers=HEADERS, json={
        "texto": texto, "entidad_id": "e1", "tipo_documento": "NOM",
        "score_confianza": 0.95,
    })


def test_consulta_pasa_por_pcl_y_segunda_es_cache_hit(mo_client):
    client, mo = mo_client

    r1 = _query(client)
    assert r1.status_code == 200, r1.text
    ccp1 = r1.json()["resultado"]["contexto_ccp"]
    assert ccp1 is not None
    assert ccp1["cache_hit"] is False
    assert ccp1["modo_respuesta"] in ("retrieval_first", "synthesis_first")

    r2 = _query(client)  # misma pregunta → cache hit
    ccp2 = r2.json()["resultado"]["contexto_ccp"]
    assert ccp2["cache_hit"] is True
    assert ccp2["modo_respuesta"] == "cache_hit"
    assert ccp2["similitud_cache"] >= 0.92


def test_metricas_del_dia_reflejan_hit(mo_client):
    client, mo = mo_client
    _query(client)
    _query(client)  # cache hit

    metrics = mo.pipeline_coordinator.pcl.metrics
    fila = metrics.agregar_diario(T, datetime.now(timezone.utc).date())
    assert fila["consultas_totales"] == 2
    assert fila["consultas_cache_hit"] == 1


def test_pregunta_distinta_no_es_hit(mo_client):
    client, mo = mo_client
    _query(client, "par de apriete del perno B")
    r = _query(client, "cuándo se calibró el equipo 23")
    ccp = r.json()["resultado"]["contexto_ccp"]
    assert ccp["cache_hit"] is False
