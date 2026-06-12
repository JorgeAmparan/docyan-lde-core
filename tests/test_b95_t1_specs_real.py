"""
B9.5 — Cierre del gap T1: specs consultables (MSDS/calibración) → InfoCard con cita.

Contra FalkorDB REAL: con la entidad canónica `:Especificacion{nombre,valor,unidad}`
que ahora producen los schemas msds/calibracion (+ ficha_tecnica/manual_tecnico),
el bridge crea la procedencia y el pipeline T1 devuelve el VALOR con CITA para
"¿límite de exposición OSHA?" y "¿rango del manómetro?".

(Verifica el camino de LECTURA con el shape que el schema extendido produce. La
extracción REAL con Gemini sobre los PDFs se verifica localmente/CI con clave —
ver el reporte de cierre.)
"""
from __future__ import annotations

import os

import pytest

from app.graph.dkg_provenance import bridge_and_normalize
from app.pipelines import tipo1_informativa
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "b95test_t1specs"


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


def _q(client, termino):
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta=termino, params={"termino": termino})
    return tipo1_informativa.resolver(ctx, DKGReader(client)).payload


def test_msds_limite_exposicion_osha_con_cita(client):
    # Shape que el schema msds EXTENDIDO produce: :Especificacion con valor/unidad inline.
    client._graph(TENANT).query(
        "CREATE (:Especificacion {id:'e_osha', nombre:'Límite de exposición OSHA PEL (total)', "
        "valor:'15', unidad:'mg/m³'}) "
    )
    client._graph(TENANT).query(
        "CREATE (:Especificacion {id:'e_acgih', nombre:'Límite de exposición ACGIH TLV (total)', "
        "valor:'10', unidad:'mg/m³'})"
    )
    bridge_and_normalize(
        client, TENANT, doc_id="msds_sha_001",
        tipo_documento="MSDS Óxido de Aluminio", nombre_archivo="msds_am002.pdf",
        content_sha256="msds_sha_001",
    )
    pay = _q(client, "OSHA")
    assert len(pay.especificaciones) == 1, "debe desambiguar a la spec OSHA"
    espec = pay.especificaciones[0]
    assert espec.valor == "15"
    assert espec.unidad == "mg/m³"
    # Atribución B13.3 §2.3: nombre = archivo real; tipo = tipo documental (mismo doc).
    assert espec.cita is not None
    assert espec.cita.documento_nombre == "msds_am002.pdf"
    assert espec.cita.documento_tipo == "MSDS Óxido de Aluminio"
    assert len(pay.citas) == 1


def test_calibracion_rango_manometro_con_cita(client):
    client._graph(TENANT).query(
        "CREATE (:Especificacion {id:'e_rango', nombre:'Rango de presión del manómetro', "
        "valor:'0-4', unidad:'bar'})"
    )
    client._graph(TENANT).query(
        "CREATE (:Especificacion {id:'e_clase', nombre:'Clase de precisión nominal', "
        "valor:'1,6', unidad:'según UNE-EN 837-1'})"
    )
    bridge_and_normalize(
        client, TENANT, doc_id="calib_sha_001",
        tipo_documento="Certificado calibración G26D50542", nombre_archivo="cert.pdf",
        content_sha256="calib_sha_001",
    )
    pay = _q(client, "rango")
    assert len(pay.especificaciones) == 1
    espec = pay.especificaciones[0]
    assert espec.valor == "0-4"
    assert espec.unidad == "bar"
    assert espec.cita is not None
    assert espec.cita.documento_nombre == "cert.pdf"
    assert "calibración" in (espec.cita.documento_tipo or "").lower()

    # "clase" también consultable.
    pay2 = _q(client, "clase")
    assert pay2.especificaciones[0].valor == "1,6"
