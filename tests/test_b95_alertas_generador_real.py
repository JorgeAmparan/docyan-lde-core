"""
B9.5 — Generador de alertas (Tipo 7) contra FalkorDB REAL + línea ABSOLUTA.

Verifica: (1) se generan alertas administrativas desde vencimientos ingeridos y
el pipeline Tipo 7 las sirve; (2) el safety_validator RECHAZA toda alerta no
administrativa antes de persistirla (cobertura crítica, CLAUDE.md §11.1).
"""
from __future__ import annotations

import os
from datetime import date

import pytest

from app.alerts.generador import generar_alertas_vencimiento
from app.alerts.safety_validator import validar_alerta
from app.pipelines import tipo7_alertas
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "b95test_alertas"


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


def test_genera_alerta_administrativa_y_tipo7_la_sirve(client):
    # Certificado que vence pronto (dentro del horizonte).
    client._graph(TENANT).query(
        "CREATE (c:CertificadoVigencia {id:'c1', nombre:'Calibración balanza A', "
        "fecha_vencimiento:'2026-06-20', timestamp:'2026-06-20'})"
    )
    counters = generar_alertas_vencimiento(client, TENANT, hoy=date(2026, 6, 8))
    assert counters["creadas"] == 1, counters
    assert counters["cuarentena"] == 0

    reader = DKGReader(client)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="¿qué vence?")
    pay = tipo7_alertas.resolver(ctx, reader).payload
    assert pay.solo_administrativas is True
    assert len(pay.alertas) == 1
    assert "vence" in pay.alertas[0].descripcion.lower()
    assert pay.alertas[0].administrativa is True


def test_alerta_fuera_de_horizonte_no_se_crea(client):
    client._graph(TENANT).query(
        "CREATE (c:CertificadoVigencia {id:'c2', nombre:'Calibración lejana', "
        "fecha_vencimiento:'2027-06-01'})"
    )
    counters = generar_alertas_vencimiento(client, TENANT, hoy=date(2026, 6, 8))
    assert counters["creadas"] == 0
    assert counters["fuera_de_horizonte"] == 1


def test_idempotente_no_duplica(client):
    client._graph(TENANT).query(
        "CREATE (c:CertificadoVigencia {id:'c3', nombre:'Cert', fecha_vencimiento:'2026-06-25'})"
    )
    generar_alertas_vencimiento(client, TENANT, hoy=date(2026, 6, 8))
    generar_alertas_vencimiento(client, TENANT, hoy=date(2026, 6, 8))
    rows = client.query(TENANT, "MATCH (a:Alerta) RETURN count(a) AS c", {})
    assert rows[0]["c"] == 1, "MERGE debe evitar duplicados"


def test_gate_rechaza_alerta_no_administrativa(client):
    """LÍNEA ABSOLUTA: un certificado cuyo nombre arrastra texto decisorio
    clínico/operativo NO genera alerta (va a cuarentena, no se persiste)."""
    client._graph(TENANT).query(
        "CREATE (c:CertificadoVigencia {id:'c4', "
        "nombre:'Suspenda el tratamiento del paciente y administre dosis', "
        "fecha_vencimiento:'2026-06-20'})"
    )
    counters = generar_alertas_vencimiento(client, TENANT, hoy=date(2026, 6, 8))
    assert counters["creadas"] == 0, "no debe crear alerta con sugerencia clínica"
    assert counters["cuarentena"] == 1
    rows = client.query(TENANT, "MATCH (a:Alerta) RETURN count(a) AS c", {})
    assert rows[0]["c"] == 0, "ninguna alerta no-administrativa debe persistirse"


def test_safety_validator_unitario():
    """Cobertura directa del gate (sin grafo)."""
    assert validar_alerta("El certificado de calibración vence el 2026-07-01.").admisible
    assert not validar_alerta("Administre 5 mg de insulina al paciente.").admisible
    assert not validar_alerta("Detenga la línea de producción inmediatamente.").admisible
    # Mezcla administrativa + decisoria → rechazada (lo prohibido manda).
    assert not validar_alerta("El documento vence; suspenda el tratamiento.").admisible
