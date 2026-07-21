"""
ED-1 §4.7 — Compatibilidad con el pipeline Tipo 7 y `AlertsDashboardPayload`.

Las nuevas propiedades de `:Alerta` (estado/origen/thresholds_notificados) NO
rompen la Consulta: el generador (refactor ED-1) sigue produciendo alertas que el
pipeline T7 sirve como `AlertsDashboardPayload` administrativas.
"""
from __future__ import annotations

import os
from datetime import date

import pytest

from app.alerts.generador import generar_alertas_vencimiento
from app.pipelines import tipo7_alertas
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "ed1_t7compat"


@pytest.fixture()
def client():
    from app.graph.dkg_client import DKGClient

    c = DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)
    try:
        ok = c.health()
    except Exception:  # noqa: BLE001
        ok = False
    if not ok:
        pytest.skip(f"FalkorDB no alcanzable en {FALKOR_HOST}:{FALKOR_PORT}")
    c.drop_tenant_graph(TENANT)
    yield c
    c.drop_tenant_graph(TENANT)


def test_generador_pone_estado_origen_y_t7_sigue_sirviendo(client):
    client._graph(TENANT).query(
        "CREATE (c:CertificadoVigencia {id:'c1', nombre:'Calibración balanza A', "
        "fecha_vencimiento:'2026-06-20', timestamp:'2026-06-20'})"
    )
    counters = generar_alertas_vencimiento(client, TENANT, hoy=date(2026, 6, 8))
    assert counters["creadas"] == 1
    assert counters["cuarentena"] == 0

    # La alerta trae las propiedades nuevas de ED-1.
    rows = client.query(
        TENANT, "MATCH (a:Alerta) RETURN a.estado AS estado, a.origen AS origen", {}
    )
    assert rows[0]["estado"] == "creado"
    assert rows[0]["origen"] == "ingesta"

    # El pipeline T7 sigue sirviendo un AlertsDashboardPayload válido.
    reader = DKGReader(client)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="¿qué vence?")
    pay = tipo7_alertas.resolver(ctx, reader).payload
    assert pay.kind == "alerts_dashboard"
    assert pay.solo_administrativas is True
    assert len(pay.alertas) == 1
    assert pay.alertas[0].administrativa is True
    assert "vence" in pay.alertas[0].descripcion.lower()
