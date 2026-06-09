"""
B9.5 — Test del bridge de procedencia contra FalkorDB REAL.

Verifica el cierre del seam escritura↔lectura: tras correr `bridge_and_normalize`
sobre un grafo poblado EXACTAMENTE como lo deja graphrag_sdk a partir de los
schemas del catálogo (labels = EntidadSchema.label, edges = RelacionSchema.label,
SIN :DocumentoSource), los pipelines de lectura (B8, sin tocar) devuelven payloads
POBLADOS y —lo que en la sesión anterior salía VACÍO— con CITA llena.

Requiere un FalkorDB alcanzable (localhost:6379 por defecto, o FALKOR_PORT). Si no
hay, el test se SALTA (no es un fallo de lógica): CI corre con FalkorDB de servicio.
"""
from __future__ import annotations

import os

import pytest

from app.pipelines import (
    tipo1_informativa,
    tipo2_guia_paso_a_paso,
    tipo6_historial,
)
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"


def _falkor_disponible(client) -> bool:
    try:
        return bool(client.health())
    except Exception:  # noqa: BLE001
        return False


@pytest.fixture()
def client():
    from app.graph.dkg_client import DKGClient

    c = DKGClient(host=FALKOR_HOST, port=FALKOR_PORT)
    if not _falkor_disponible(c):
        pytest.skip(f"FalkorDB no alcanzable en {FALKOR_HOST}:{FALKOR_PORT}")
    return c


TENANT = "b95test_bridge"
DOC_ID = "sha256fakeb95deadbeef0001"
DOC2_ID = "sha256fakeb95deadbeef0002"


def _raw(client, tenant, cypher):
    client._graph(tenant).query(cypher)


def _poblar_como_sdk(client):
    """Shape EXACTO de graphrag_sdk con el catálogo (sin :DocumentoSource)."""
    # especificacion.py
    _raw(client, TENANT, """
        CREATE (e:Especificacion {id:'e1', nombre:'Torque del perno B del rotor',
                                  descripcion:'Par de apriete', categoria:'mecanica'})
        CREATE (p:ParametroTecnico {id:'p1', nombre:'par de apriete', valor_nominal:'85'})
        CREATE (u:UnidadMedida {id:'u1', simbolo:'N·m', nombre:'newton metro'})
        CREATE (e)-[:DEFINE_PARAMETRO]->(p)
        CREATE (p)-[:EXPRESADO_EN]->(u)
    """)
    # manual_tecnico.py
    _raw(client, TENANT, """
        CREATE (pr:Procedimiento {id:'pr1', nombre:'Cambio del filtro de refrigerante',
                                  objetivo:'sustituir filtro', ambito:'mantenimiento'})
        CREATE (s1:Paso {id:'s1', numero:'1', descripcion:'Despresuriza el circuito y espera 2 minutos.'})
        CREATE (s2:Paso {id:'s2', numero:'2', descripcion:'Sustituye el cartucho por uno nuevo.'})
        CREATE (epp:EPP {id:'epp1', nombre:'Guantes de nitrilo', norma:'EN 374'})
        CREATE (h:Herramienta {id:'h1', nombre:'Llave de filtro'})
        CREATE (adv:Advertencia {id:'adv1', texto:'No abrir con el sistema presurizado.'})
        CREATE (pr)-[:CONTIENE_PASO]->(s1)
        CREATE (pr)-[:CONTIENE_PASO]->(s2)
        CREATE (pr)-[:REQUIERE_EPP]->(epp)
        CREATE (s1)-[:REQUIERE_HERRAMIENTA]->(h)
        CREATE (s1)-[:TIENE_ADVERTENCIA]->(adv)
    """)
    # calibracion.py (para Historial T6: CertificadoCalibracion + vencimiento)
    _raw(client, TENANT, """
        CREATE (c:CertificadoCalibracion {id:'cert1', nombre:'Calibración anual rotor',
                                          fecha_vencimiento:'2026-12-01'})
    """)


def _poblar_segunda_version(client):
    """Segundo documento del mismo tipo para comparar versiones (T8)."""
    _raw(client, DOC2_ID and TENANT, """
        CREATE (e:Especificacion {id:'e1v2', nombre:'Torque del perno B del rotor v2'})
    """)


@pytest.fixture()
def grafo_poblado(client):
    client.drop_tenant_graph(TENANT)
    _poblar_como_sdk(client)
    yield client
    client.drop_tenant_graph(TENANT)


def test_antes_del_bridge_no_hay_cita(grafo_poblado):
    """Confirma el estado roto previo: sin bridge, Tipo 1 NO trae cita."""
    reader = DKGReader(client=grafo_poblado)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="torque", params={"termino": "torque"})
    res = tipo1_informativa.resolver(ctx, reader)
    assert res.payload.citas == [], "precondición: sin bridge no debe haber citas"


def test_bridge_cierra_cita_tipo1(grafo_poblado):
    """Tras el bridge: Tipo 1 trae valor, unidad y CITA llena (doc·…)."""
    from app.graph.dkg_provenance import bridge_and_normalize

    bridge_and_normalize(
        grafo_poblado, TENANT,
        doc_id=DOC_ID, tipo_documento="Manual Rotina 380",
        nombre_archivo="rotina380.pdf", content_sha256=DOC_ID,
    )
    reader = DKGReader(client=grafo_poblado)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="torque", params={"termino": "torque"})
    pay = tipo1_informativa.resolver(ctx, reader).payload

    espec = pay.especificaciones[0]
    assert espec.valor == "85", f"valor denormalizado esperado, got {espec.valor!r}"
    assert espec.unidad == "N·m", f"unidad denormalizada esperada, got {espec.unidad!r}"
    assert len(pay.citas) >= 1, "Tipo 1 debe traer al menos una cita tras el bridge"
    cita = pay.citas[0]
    assert cita.documento_id == DOC_ID
    assert cita.documento_nombre == "Manual Rotina 380"


def test_bridge_cierra_pasos_y_cita_tipo2(grafo_poblado):
    """Tras el bridge: Tipo 2 trae pasos ordenados con EPP/herr/adv y cita."""
    from app.graph.dkg_provenance import bridge_and_normalize

    bridge_and_normalize(
        grafo_poblado, TENANT,
        doc_id=DOC_ID, tipo_documento="Manual Rotina 380",
        nombre_archivo="rotina380.pdf", content_sha256=DOC_ID,
    )
    reader = DKGReader(client=grafo_poblado)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="filtro", params={"termino": "filtro"})
    pay = tipo2_guia_paso_a_paso.resolver(ctx, reader).payload

    assert len(pay.pasos) == 2, f"esperados 2 pasos, got {len(pay.pasos)}"
    assert pay.pasos[0].orden == 1
    assert "Guantes de nitrilo" in pay.pasos[0].epp, "EPP debe colgar del paso"
    assert "Llave de filtro" in pay.pasos[0].herramientas
    assert any("presurizado" in a for a in pay.pasos[0].advertencias)
    assert len(pay.citas) >= 1, "Tipo 2 debe traer cita tras el bridge"
    assert pay.citas[0].documento_id == DOC_ID


def test_bridge_historial_certificado_vigencia(grafo_poblado):
    """Tras el bridge: el CertificadoCalibracion aparece como CertificadoVigencia."""
    from app.graph.dkg_provenance import bridge_and_normalize

    bridge_and_normalize(
        grafo_poblado, TENANT,
        doc_id=DOC_ID, tipo_documento="certificado_calibracion",
        content_sha256=DOC_ID,
    )
    reader = DKGReader(client=grafo_poblado)
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta="historial")
    pay = tipo6_historial.resolver(ctx, reader).payload
    descripciones = [c.descripcion for c in pay.certificados_vigencia]
    assert any("Calibración anual" in d for d in descripciones), \
        f"certificado de vigencia esperado en historial, got {descripciones}"


def test_bridge_tipo8_compara_por_documento_source(grafo_poblado):
    """Tras el bridge: T8 encuentra el :DocumentoSource con version/hash."""
    from app.graph.dkg_provenance import bridge_and_normalize

    bridge_and_normalize(
        grafo_poblado, TENANT,
        doc_id=DOC_ID, tipo_documento="Manual Rotina 380", content_sha256=DOC_ID,
    )
    # segundo documento
    _raw(grafo_poblado, TENANT, "CREATE (e:Especificacion {id:'e9', nombre:'spec v2'})")
    bridge_and_normalize(
        grafo_poblado, TENANT,
        doc_id=DOC2_ID, tipo_documento="Manual Rotina 380", content_sha256=DOC2_ID,
    )
    reader = DKGReader(grafo_poblado)
    data = reader.comparar(TENANT, "versiones_documento", DOC_ID, DOC2_ID)
    assert data["izquierda"].get("hash") == DOC_ID
    assert data["derecha"].get("hash") == DOC2_ID
