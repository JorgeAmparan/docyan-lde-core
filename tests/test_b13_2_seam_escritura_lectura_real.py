"""
B13.2 — Invariante escritura↔lectura sobre el shape REAL de GraphRAG-SDK.

Contra FalkorDB REAL. A diferencia de los tests B9.5 (que sembraban nodos en el
shape del READER: `:Especificacion{nombre,valor,unidad}`), este test siembra el
shape que GraphRAG-SDK 1.1.1 REALMENTE escribe — verificado en el grafo de prod:

  · entidades colapsadas a `{id, name, type, description}` con labels `[__Entity__, <Tipo>]`,
  · relaciones como `:RELATES {rel_type:'<LABEL_SCHEMA>'}` (NO el label del schema).

…corre el bridge y exige que los readers B8 devuelvan CONTENIDO CITADO. Si el SDK
cambiara de shape, o el bridge dejara de normalizarlo, este test se pone rojo —
la costura no puede volver a abrirse en silencio (que fue justo el punto ciego de
B9.5: verificó la lectura contra nodos fabricados, nunca contra la ingesta real).
"""
from __future__ import annotations

import os

import pytest

from app.graph.dkg_provenance import bridge_and_normalize
from app.pipelines import tipo1_informativa, tipo2_guia_paso_a_paso
from app.pipelines.base import ContextoPipeline
from app.pipelines.dkg_reader import DKGReader

FALKOR_PORT = int(os.getenv("FALKOR_PORT") or os.getenv("FALKORDB_PORT") or "6379")
FALKOR_HOST = os.getenv("FALKOR_HOST") or os.getenv("FALKORDB_HOST") or "localhost"
TENANT = "b132test_seam"


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


def _seed_sdk_nativo(client) -> None:
    """Siembra nodos/aristas EXACTAMENTE como los escribe GraphRAG-SDK 1.1.1."""
    g = client._graph(TENANT)
    # Especificacion: el dato vive en `name`+`description`, NO en nombre/valor/unidad.
    g.query(
        "CREATE (:`__Entity__`:Especificacion {id:'e_osha', name:'Límite de exposición OSHA PEL (total)', "
        "type:'Especificacion', description:'15 mg/m³ — límite de exposición permisible para polvo total.'})"
    )
    g.query(
        "CREATE (:`__Entity__`:Especificacion {id:'e_fusion', name:'Punto de fusión', "
        "type:'Especificacion', description:'2072 °C según la ficha de datos de seguridad.'})"
    )
    # Procedimiento → Paso vía :RELATES{rel_type:'CONTIENE_PASO'}; Paso → Advertencia
    # vía :RELATES{rel_type:'TIENE_ADVERTENCIA'} (lo que el SDK realmente escribe).
    g.query(
        """
        CREATE (p:`__Entity__`:Procedimiento {id:'p1', name:'Cambio de filtro de refrigerante', type:'Procedimiento'})
        CREATE (s1:`__Entity__`:Paso {id:'s1', name:'Desenergizar y purgar la línea', type:'Paso'})
        CREATE (s2:`__Entity__`:Paso {id:'s2', name:'Retirar el filtro y colocar el nuevo', type:'Paso'})
        CREATE (a1:`__Entity__`:Advertencia {id:'a1', name:'Desenergizar antes de operar', type:'Advertencia'})
        CREATE (p)-[:RELATES {rel_type:'CONTIENE_PASO'}]->(s1)
        CREATE (p)-[:RELATES {rel_type:'CONTIENE_PASO'}]->(s2)
        CREATE (s1)-[:RELATES {rel_type:'TIENE_ADVERTENCIA'}]->(a1)
        """
    )


def _informativa(client, termino):
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta=termino, params={"termino": termino})
    return tipo1_informativa.resolver(ctx, DKGReader(client)).payload


def _procedimiento(client, termino):
    ctx = ContextoPipeline(tenant_id=TENANT, pregunta=termino, params={"termino": termino})
    return tipo2_guia_paso_a_paso.resolver(ctx, DKGReader(client)).payload


def test_seam_specs_sdk_nativo_se_leen_con_cita(client):
    """Shape SDK-nativo + bridge ⇒ T1 devuelve la spec con su valor (description) y CITA."""
    _seed_sdk_nativo(client)
    bridge_and_normalize(
        client, TENANT, doc_id="msds_sha_real",
        tipo_documento="MSDS Óxido de Aluminio", nombre_archivo="msds.pdf",
        content_sha256="msds_sha_real",
    )
    pay = _informativa(client, "OSHA")
    assert len(pay.especificaciones) >= 1, "la spec OSHA debe ser legible tras el bridge"
    espec = next(e for e in pay.especificaciones if "OSHA" in (e.nombre or ""))
    assert espec.nombre and "OSHA" in espec.nombre          # name → nombre
    assert espec.valor and "15" in espec.valor              # description → valor
    assert espec.cita is not None                           # cita vía :DocumentoSource
    # Atribución B13.3 §2.3: nombre = archivo real; tipo = tipo documental (mismo doc).
    assert espec.cita.documento_nombre == "msds.pdf"
    assert espec.cita.documento_tipo == "MSDS Óxido de Aluminio"


def test_seam_punto_fusion_busqueda_por_valor(client):
    """Búsqueda por término que vive en la `description` (valor) — no solo en el nombre."""
    _seed_sdk_nativo(client)
    bridge_and_normalize(
        client, TENANT, doc_id="msds_sha_real",
        tipo_documento="MSDS Óxido de Aluminio", content_sha256="msds_sha_real",
    )
    pay = _informativa(client, "fusión")
    assert any("fusión" in (e.nombre or "").lower() for e in pay.especificaciones)
    espec = next(e for e in pay.especificaciones if "fusión" in (e.nombre or "").lower())
    assert "2072" in (espec.valor or "")


def test_seam_procedimiento_sdk_nativo_devuelve_pasos(client):
    """Procedimiento→Paso vía :RELATES{CONTIENE_PASO} ⇒ T2 devuelve título + pasos + advertencias."""
    _seed_sdk_nativo(client)
    bridge_and_normalize(
        client, TENANT, doc_id="manual_sha_real",
        tipo_documento="Manual técnico", content_sha256="manual_sha_real",
    )
    pay = _procedimiento(client, "filtro")
    assert pay.titulo and "filtro" in pay.titulo.lower()    # name → nombre del procedimiento
    assert len(pay.pasos) == 2, "los 2 pasos deben colgar vía :CONTIENE materializado del :RELATES"
    descs = " ".join((p.descripcion or "") for p in pay.pasos)
    assert "filtro" in descs.lower() or "purgar" in descs.lower()
    # La advertencia cuelga del paso (el reader la recorre con `(paso)-->(:Advertencia)`).
    advertencias = [a for p in pay.pasos for a in (p.advertencias or [])]
    assert any("desenergizar" in (a or "").lower() for a in advertencias)


def test_seam_sin_bridge_no_hay_lectura(client):
    """
    Control NEGATIVO: con el shape SDK-nativo PERO sin correr el bridge, los readers
    NO encuentran nada (nombre/valor están en name/description, sin :DocumentoSource).
    Demuestra que es el bridge — no el azar — lo que cierra la costura.
    """
    _seed_sdk_nativo(client)
    pay = _informativa(client, "OSHA")
    # Sin normalización, e.nombre es NULL → el CONTAINS del reader no casa el término.
    assert pay.especificaciones == [] or all(e.nombre is None for e in pay.especificaciones)
