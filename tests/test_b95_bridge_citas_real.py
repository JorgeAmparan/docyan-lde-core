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
    """
    Shape REAL de graphrag_sdk 1.1.1 (verificado en el grafo de prod, B13.2): toda
    entidad colapsada a `{id, name, type, description}` con `[__Entity__, <Tipo>]`, y
    TODA relación como `:RELATES {rel_type:'<LABEL_SCHEMA>'}` (el label del schema vive
    en la propiedad, NO como tipo de arista). El bridge normaliza esto al contrato de
    lectura. (Antes este helper sembraba el shape del CATÁLOGO — labels/props/edges que
    el SDK nunca emite —: ese era el punto ciego que dejó la costura abierta en silencio.)
    """
    # especificacion.py — el valor+unidad vive en `description` (el SDK no separa props).
    _raw(client, TENANT, """
        CREATE (:`__Entity__`:Especificacion {id:'e1', type:'Especificacion',
            name:'Torque del perno B del rotor',
            description:'85 N·m — par de apriete del perno B del rotor.'})
    """)
    # manual_tecnico.py — Procedimiento→Paso vía :RELATES{CONTIENE_PASO}; EPP/herr/adv
    # cuelgan del PASO (como el reader las recorre con `(paso)-->(:EPP)`).
    _raw(client, TENANT, """
        CREATE (pr:`__Entity__`:Procedimiento {id:'pr1', type:'Procedimiento',
            name:'Cambio del filtro de refrigerante'})
        CREATE (s1:`__Entity__`:Paso {id:'s1', type:'Paso',
            name:'Despresuriza el circuito y espera 2 minutos.'})
        CREATE (s2:`__Entity__`:Paso {id:'s2', type:'Paso',
            name:'Sustituye el cartucho del filtro por uno nuevo.'})
        CREATE (epp:`__Entity__`:EPP {id:'epp1', type:'EPP', name:'Guantes de nitrilo'})
        CREATE (h:`__Entity__`:Herramienta {id:'h1', type:'Herramienta', name:'Llave de filtro'})
        CREATE (adv:`__Entity__`:Advertencia {id:'adv1', type:'Advertencia',
            name:'No abrir con el sistema presurizado.'})
        CREATE (pr)-[:RELATES {rel_type:'CONTIENE_PASO'}]->(s1)
        CREATE (pr)-[:RELATES {rel_type:'CONTIENE_PASO'}]->(s2)
        CREATE (s1)-[:RELATES {rel_type:'REQUIERE_EPP'}]->(epp)
        CREATE (s1)-[:RELATES {rel_type:'REQUIERE_HERRAMIENTA'}]->(h)
        CREATE (s1)-[:RELATES {rel_type:'TIENE_ADVERTENCIA'}]->(adv)
    """)
    # calibracion.py (Historial T6) — CertificadoCalibracion con vencimiento.
    _raw(client, TENANT, """
        CREATE (:`__Entity__`:CertificadoCalibracion {id:'cert1', type:'CertificadoCalibracion',
            name:'Calibración anual rotor', fecha_vencimiento:'2026-12-01'})
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
    assert espec.nombre == "Torque del perno B del rotor"   # name → nombre
    # El SDK no separa valor/unidad: el dato vive en `description` → `valor`.
    assert espec.valor and "85" in espec.valor and "N·m" in espec.valor, \
        f"valor desde description esperado, got {espec.valor!r}"
    assert len(pay.citas) >= 1, "Tipo 1 debe traer al menos una cita tras el bridge"
    cita = pay.citas[0]
    assert cita.documento_id == DOC_ID
    assert cita.documento_nombre == "Manual Rotina 380"
    # Regla de integridad de cita (paquete F3): la PRESENCIA de documento_nombre NO
    # es verificación de cita — "citado" = verbatim del documento. Estos specs
    # sintéticos no llevan `spans`, así que NO debe fabricarse un fragmento: el
    # verbatim es None y la UI mostrará "fragmento no disponible". El verbatim real
    # (chunk[start:end]) se asegura en tests/test_cita_integridad.py.
    assert cita.fragmento is None, "sin span, la cita no debe fabricar fragmento"


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
    # Los pasos cuelgan del Procedimiento vía :CONTIENE materializado del :RELATES.
    descs = " ".join((p.descripcion or "") for p in pay.pasos)
    assert "circuito" in descs.lower() or "cartucho" in descs.lower()
    # EPP/herr/adv cuelgan del paso (reader: `(paso)-->(:EPP|:Herramienta|:Advertencia)`).
    epp = [e for p in pay.pasos for e in (p.epp or [])]
    herr = [h for p in pay.pasos for h in (p.herramientas or [])]
    adv = [a for p in pay.pasos for a in (p.advertencias or [])]
    assert "Guantes de nitrilo" in epp, f"EPP debe colgar del paso, got {epp}"
    assert "Llave de filtro" in herr
    assert any("presurizado" in a for a in adv)
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
